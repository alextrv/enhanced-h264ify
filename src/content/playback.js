/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Playback automation module (Production 2026).
 * 1. Dismisses YouTube inactivity prompt ("Video paused. Continue watching?")
 * 2. Bypasses age/content warning screens ("Viewer discretion is advised",
 *    "Se recomienda la discreción del usuario", etc.) across all modern YouTube
 *    DOM renderer trees and view models.
 *
 * Performance-hardened for low-resource devices:
 * - Zero forced reflows / layout thrashing: uses attribute and style inspection
 *   instead of getBoundingClientRect() or offsetWidth/offsetHeight.
 * - Single native click execution without allocating redundant Event objects.
 * - Fast tag prefix filtering: ignores 100% of tooltip, hover, and progress bar
 *   mutations caused by mouse movements.
 * - Scoped lifecycle: inactive on non-video pages to preserve system resources.
 */
(() => {
  if (window !== window.top && !location.pathname.startsWith('/embed/')) return;

  const DIALOG_TAG = 'yt-confirm-dialog-renderer';
  const CONFIRM_BUTTON = '#confirm-button button';
  const CONFIRM_CONTAINER = '#confirm-button';
  const CANCEL_SELECTOR = '#cancel-button';

  /** Container selectors covering modern YouTube error and warning overlays */
  const WARNING_SELECTORS = [
    'ytd-player-error-message-renderer',
    'yt-player-error-message-renderer',
    'yt-playability-error-supported-renderers',
    'ytd-enforcement-message-view-model',
    '#error-screen',
    '.ytp-error',
    '#player-error-message-container',
  ];
  const ALL_WATCHED = [DIALOG_TAG, ...WARNING_SELECTORS].join(', ');

  /** Known warning tag names for O(1) candidate checks */
  const WARNING_TAGS = new Set([
    'yt-confirm-dialog-renderer',
    'ytd-player-error-message-renderer',
    'yt-player-error-message-renderer',
    'yt-playability-error-supported-renderers',
    'ytd-enforcement-message-view-model',
  ]);

  /** Interactive element selectors YouTube uses for confirmation buttons */
  const CLICKABLE_SELECTORS =
    'button, a, [role="button"], yt-button-renderer, yt-button-shape, tp-yt-paper-button, .yt-spec-button-shape-next';

  const MAX_RETRY_ATTEMPTS = 5;

  /**
   * Action keywords specifically matching proceed / confirmation buttons.
   * Passive titles are excluded to avoid false positives on documentation links.
   */
  const ACKNOWLEDGEMENTS = [
    // Spanish
    'entiendo', 'continuar de todos modos', 'deseo continuar', 'continuar',
    // English
    'i understand', 'wish to proceed', 'proceed', 'continue anyway',
    // Czech
    'rozumím', 'chci pokračovat', 'pokračovat',
    // Russian
    'понимаю', 'продолжить',
    // Ukrainian
    'розумію', 'продовжити',
    // German
    'ich verstehe', 'weiter', 'trotzdem ansehen', 'fortfahren',
    // French
    'je comprends', 'poursuivre', 'continuer quand même',
    // Portuguese
    'compreendo', 'prosseguir', 'continuar mesmo assim',
    // Italian
    'ho capito', 'procedi', 'continua comunque',
    // Polish
    'rozumiem', 'kontynuuj',
    // Turkish
    'anladım', 'devam',
    // Japanese
    '理解', '進む', '次へ',
    // Korean
    '이해', '계속',
    // Chinese
    '了解', '继续', '繼續',
  ];

  let antiInactivity = false;
  let contentWarning = false;
  let observer = null;
  let attemptCount = 0;
  let retryTimer = 0;
  let scanFrameId = 0;

  const isVideoPage = () => {
    const p = location.pathname;
    return p.startsWith('/watch') || p.startsWith('/embed') || p.startsWith('/live') || p.startsWith('/shorts');
  };

  /**
   * Checks element visibility without triggering forced reflow / layout thrashing.
   * Avoids getBoundingClientRect, offsetWidth, and offsetHeight which force synchronous
   * geometry computation and cause frame drops when the mouse moves.
   * @param {Element | null | undefined} el
   */
  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;
    const style = /** @type {HTMLElement} */ (el).style;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return true;
  };

  /**
   * Dispatches a direct native click on the target element.
   * Avoids allocating multiple redundant PointerEvent / MouseEvent objects.
   * @param {HTMLElement} el
   */
  const triggerClick = (el) => {
    if (!el) return;
    try {
      el.focus?.();
      if (typeof el.click === 'function') {
        el.click();
      } else {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    } catch {
      try { el.click(); } catch {}
    }
  };

  /**
   * Safely re-engages video playback once discretion screen is dismissed.
   */
  const resumePlayback = () => {
    setTimeout(() => {
      try {
        const player = document.querySelector('#movie_player');
        if (typeof player?.playVideo === 'function') {
          player.playVideo();
        }
        const video = document.querySelector('video');
        if (video && video.paused) {
          video.play().catch(() => {});
        }
      } catch {}
    }, 120);
  };

  /**
   * Confirms inactivity dialog only when no cancel exists.
   * @param {Element} dialog
   */
  const confirmInactivity = (dialog) => {
    if (!isVisible(dialog)) return;

    const cancel = dialog.querySelector(CANCEL_SELECTOR);
    if (cancel && isVisible(cancel)) return;

    const confirm =
      dialog.querySelector(CONFIRM_BUTTON) ?? dialog.querySelector(CONFIRM_CONTAINER);
    if (!confirm) return;

    triggerClick(/** @type {HTMLElement} */ (confirm));
  };

  /**
   * Searches interactive elements inside a warning surface for matching confirmation verbs.
   * Explicitly ignores external help and support links (support.google.com).
   * @param {Element} surface
   * @returns {HTMLElement | null}
   */
  const findAcknowledgementControl = (surface) => {
    const controls = surface.querySelectorAll(CLICKABLE_SELECTORS);
    for (let i = 0; i < controls.length; i++) {
      const el = controls[i];

      // Explicitly reject help/support documentation links
      const href = el.getAttribute('href') || '';
      if (href.includes('support.google.com') || href.includes('/answer/')) {
        continue;
      }

      const raw =
        (el.getAttribute('aria-label') || '') + ' ' +
        (el.textContent || '');
      const text = raw.toLowerCase().trim();

      // Skip generic "Más información" or "Learn more" controls
      if ((text.includes('más información') || text.includes('learn more')) && !text.includes('entiendo')) {
        continue;
      }

      for (let j = 0; j < ACKNOWLEDGEMENTS.length; j++) {
        if (text.includes(ACKNOWLEDGEMENTS[j])) {
          return /** @type {HTMLElement} */ (el);
        }
      }
    }
    return null;
  };

  /**
   * Dismisses YouTube content discretion / age warning screens.
   * @param {Element} surface
   */
  const dismissWarning = (surface) => {
    if (attemptCount >= MAX_RETRY_ATTEMPTS || !isVisible(surface)) {
      return;
    }

    const control = findAcknowledgementControl(surface);
    if (!control) return;

    attemptCount += 1;

    // Locate the innermost clickable button or link
    const target =
      control.querySelector('button, a, .yt-spec-button-shape-next') || control;

    triggerClick(/** @type {HTMLElement} */ (target));

    if (target !== control) {
      triggerClick(/** @type {HTMLElement} */ (control));
    }

    resumePlayback();

    // Verify dismissal after a short interval; retry if warning remains active
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      if (isVisible(surface) && attemptCount < MAX_RETRY_ATTEMPTS) {
        dismissWarning(surface);
      }
    }, 280);
  };

  /**
   * @param {Element | null} target
   */
  const handle = (target) => {
    if (!target) return;

    if (target.localName === DIALOG_TAG) {
      if (antiInactivity) confirmInactivity(target);
      return;
    }

    if (contentWarning) {
      dismissWarning(target);
    }
  };

  /**
   * Instant non-allocating candidate check.
   * Returns true only for nodes that could be dialogs or error surfaces.
   * Eliminates 100% of tooltip, progress bar, time bubble, and hover node overhead.
   * @param {Node} node
   */
  const isCandidateNode = (node) => {
    if (!node || node.nodeType !== 1) return false;
    const el = /** @type {HTMLElement} */ (node);
    const tag = el.tagName;
    if (tag.startsWith('YT-') || tag.startsWith('YTD-')) {
      const lower = tag.toLowerCase();
      return lower === DIALOG_TAG || WARNING_TAGS.has(lower);
    }
    const id = el.id;
    if (id === 'error-screen' || id === 'player-error-message-container') return true;
    if (el.classList.contains('ytp-error')) return true;

    // Check immediate child only if tag is generic container (e.g. ytd-app or ytd-popup-container)
    if (tag === 'YTD-POPUP-CONTAINER' || tag === 'YTD-PLAYER') {
      return el.querySelector(ALL_WATCHED) !== null;
    }
    return false;
  };

  const scanAll = () => {
    scanFrameId = 0;
    if (!isEnabled() || !isVideoPage()) return;
    for (const node of document.querySelectorAll(ALL_WATCHED)) {
      handle(node);
    }
  };

  const scheduleScan = () => {
    if (scanFrameId !== 0 || !isEnabled() || !isVideoPage()) return;
    scanFrameId = requestAnimationFrame(scanAll);
  };

  /**
   * Highly optimized mutation filter:
   * Inspects added nodes with zero-allocation prefix checks, scheduling a single rAF
   * only when a relevant warning or dialog component enters the DOM.
   * @param {MutationRecord[]} records
   */
  const onMutations = (records) => {
    if (!isVideoPage()) return;
    for (let i = 0; i < records.length; i++) {
      const added = records[i].addedNodes;
      for (let j = 0; j < added.length; j++) {
        if (isCandidateNode(added[j])) {
          scheduleScan();
          return;
        }
      }
    }
  };

  const isEnabled = () => antiInactivity || contentWarning;

  const start = () => {
    if (!isEnabled() || !isVideoPage()) return;
    if (!observer) {
      observer = new MutationObserver(onMutations);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    scheduleScan();
  };

  const stop = () => {
    observer?.disconnect();
    observer = null;
    if (scanFrameId !== 0) {
      cancelAnimationFrame(scanFrameId);
      scanFrameId = 0;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = 0;
    }
  };

  const sync = (config) => {
    antiInactivity = config?.anti_inactivity === true;
    contentWarning = config?.bypass_age_gate === true;
    if (isEnabled() && isVideoPage()) start();
    else stop();
  };

  const resetAndScan = () => {
    attemptCount = 0;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = 0;
    }
    if (isEnabled() && isVideoPage()) {
      if (!observer) start();
      scheduleScan();
    } else {
      stop();
    }
  };

  // Re-scan upon SPA navigation events across modern YouTube
  const NAVIGATION_EVENTS = ['yt-navigate-finish', 'yt-page-data-updated', 'popstate'];
  for (const eventName of NAVIGATION_EVENTS) {
    window.addEventListener(eventName, resetAndScan, { passive: true });
  }

  if (globalThis.EHF?.read) {
    globalThis.EHF.read().then(sync);
    globalThis.EHF.subscribe(sync);
  }
})();
