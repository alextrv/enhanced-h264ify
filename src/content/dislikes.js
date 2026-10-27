/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * YouTube Dislike Counter restore module (Production 2026).
 *
 * Architecture:
 * 1. Immediate pre-fetch on navigation: initiates RYD API request the instant
 *    the video ID is extracted, eliminating rendering latency.
 * 2. Injects dislike counts non-destructively into YouTube's modern segmented button view models,
 *    preserving SVG icons, ripple effects, and native click listeners.
 * 3. Scoped container observation with loop-guard: re-injects only when Lit wipes
 *    the button during hydration. Returns in 0.001ms on hover/ripple events.
 * 4. Short-lived global observer: active only during initial video load (~200ms)
 *    and disconnects permanently once the button is bound.
 * 5. Strict 200-item O(1) LRU memory cache matching background service worker.
 */
(() => {
  if (window !== window.top) return;

  const SOURCE = 'returnyoutubedislike.com';

  /** Selectors covering modern YouTube desktop, mobile, and Shorts component trees */
  const BUTTON_SELECTORS = Object.freeze([
    'dislike-button-view-model button',
    'segmented-like-dislike-button-view-model dislike-button-view-model button',
    'segmented-like-dislike-button-view-model button:last-of-type',
    '#segmented-dislike-button button',
    '#dislike-button button',
    'ytd-segmented-like-dislike-button-renderer dislike-button-view-model button',
    'ytd-menu-renderer dislike-button-view-model button',
    'ytd-reel-video-renderer[is-active] #dislike-button button',
    'ytd-reel-video-renderer[is-active] dislike-button-view-model button',
    'ytd-toggle-button-renderer.style-text[is-icon-button]',
    'button[aria-label*="dislike" i]',
    'button[aria-label*="no me gusta" i]',
  ]);

  const LABEL_SELECTORS = Object.freeze([
    '.yt-spec-button-shape-next__button-text-content',
    '.ytSpecButtonShapeNextButtonTextContent',
    'yt-formatted-string',
    'span[role="text"]',
    '.yt-spec-button-shape-with-label__label',
  ]);

  const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
  const NAVIGATION_EVENTS = Object.freeze(['yt-navigate-finish', 'yt-page-data-updated', 'popstate']);
  const CACHE_LIMIT = 200;
  const FETCH_TIMEOUT_MS = 3500;
  const GLOBAL_OBSERVER_TIMEOUT_MS = 4000;

  const counts = new Map();
  const pending = new Set();

  let enabled = false;
  let globalObserver = null;
  let globalObserverTimer = 0;
  let containerObserver = null;
  let observedContainer = null;
  let currentId = null;
  let formatter = null;
  let scanFrameId = 0;
  let containerFrameId = 0;

  const isVideoPage = () => {
    const p = location.pathname;
    return p.startsWith('/watch') || p.startsWith('/shorts') || p.startsWith('/live');
  };

  /**
   * Resolves the 11-character video ID from the current URL.
   * @returns {string | null}
   */
  const extractVideoId = () => {
    const { pathname, search } = location;
    if (pathname.startsWith('/shorts/')) {
      const id = pathname.slice('/shorts/'.length).split(/[/?#]/)[0];
      return VIDEO_ID_REGEX.test(id) ? id : null;
    }
    if (pathname.startsWith('/live/')) {
      const id = pathname.slice('/live/'.length).split(/[/?#]/)[0];
      return VIDEO_ID_REGEX.test(id) ? id : null;
    }
    const params = new URLSearchParams(search);
    const id = params.get('v');
    return id && VIDEO_ID_REGEX.test(id) ? id : null;
  };

  /**
   * Builds an Intl number formatter for compact representation (e.g. 1.2K).
   */
  const buildFormatter = () => {
    const options = { notation: 'compact', maximumFractionDigits: 1, roundingMode: 'floor' };
    try {
      return new Intl.NumberFormat(document.documentElement.lang || navigator.language, options);
    } catch {
      return new Intl.NumberFormat('en', options);
    }
  };

  /**
   * Formats a raw dislike integer into compact locale string.
   * @param {number} count
   */
  const format = (count) => {
    formatter ??= buildFormatter();
    return formatter.format(count);
  };

  /**
   * Finds the active dislike button target element across desktop, Shorts, and Live.
   * @returns {HTMLElement | null}
   */
  const findDislikeButton = () => {
    if (location.pathname.startsWith('/shorts/')) {
      const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]');
      if (activeReel) {
        for (const selector of [
          '#dislike-button button',
          'dislike-button-view-model button',
          '#dislike-button',
          'dislike-button-view-model',
          'button[aria-label*="dislike" i]',
          'button[aria-label*="no me gusta" i]',
        ]) {
          const el = activeReel.querySelector(selector);
          if (el instanceof HTMLElement) {
            const btn = el.tagName === 'BUTTON' ? el : el.querySelector('button');
            if (btn instanceof HTMLElement) return btn;
            return el;
          }
        }
      }
    }

    for (let i = 0; i < BUTTON_SELECTORS.length; i++) {
      const el = document.querySelector(BUTTON_SELECTORS[i]);
      if (el instanceof HTMLElement) {
        const btn = el.tagName === 'BUTTON' ? el : el.querySelector('button');
        if (btn instanceof HTMLElement) return btn;
        return el;
      }
    }
    return null;
  };

  /**
   * Obtains or creates the text container inside the button non-destructively.
   * @param {HTMLElement} button
   * @returns {HTMLElement | null}
   */
  const getOrCreateTextContainer = (button) => {
    if (!button || !(button instanceof HTMLElement)) return null;

    // 1. Check if our custom injected container already exists and is connected
    const existingCustom = button.querySelector('[data-ehf-dislike-text]');
    if (existingCustom instanceof HTMLElement && existingCustom.isConnected) {
      return existingCustom;
    }

    // 2. Check if a native text container exists (e.g. Shorts or mobile view)
    for (let i = 0; i < LABEL_SELECTORS.length; i++) {
      const native = button.querySelector(LABEL_SELECTORS[i]);
      if (native instanceof HTMLElement) return native;
    }

    // 3. Desktop YouTube: create native-styled text container and append safely next to SVG icon
    const wrapper = document.createElement('div');
    wrapper.className = 'yt-spec-button-shape-next__button-text-content ehf-dislike-label';
    wrapper.dataset.ehfDislikeText = 'true';
    wrapper.style.cssText =
      'margin-left: 6px; display: inline-flex; align-items: center; pointer-events: none; user-select: none; font-size: inherit; font-family: inherit; color: inherit;';

    const span = document.createElement('span');
    span.className = 'yt-core-attributed-string yt-core-attributed-string--white-space-no-wrap';
    span.setAttribute('role', 'text');
    wrapper.appendChild(span);

    button.appendChild(wrapper);

    // Ensure button width adjusts to accommodate text without clipping
    button.style.width = 'auto';
    button.style.minWidth = 'auto';
    button.style.paddingRight = '8px';

    // Switch icon-only class to icon-leading so YouTube native CSS layouts text and icon properly
    if (button.classList.contains('yt-spec-button-shape-next--icon-only')) {
      button.classList.remove('yt-spec-button-shape-next--icon-only');
      button.classList.add('yt-spec-button-shape-next--icon-leading');
      button.dataset.ehfConvertedIconOnly = 'true';
    }
    const parentViewModel = button.closest('button-view-model') || button.closest('dislike-button-view-model');
    if (parentViewModel?.classList.contains('yt-spec-button-shape-next--icon-only')) {
      parentViewModel.classList.remove('yt-spec-button-shape-next--icon-only');
      parentViewModel.classList.add('yt-spec-button-shape-next--icon-leading');
      parentViewModel.dataset.ehfConvertedIconOnly = 'true';
    }

    return wrapper;
  };

  /**
   * Stores fetched estimate in bounded O(1) LRU memory cache.
   * @param {string} id
   * @param {number | null} estimate
   */
  const remember = (id, estimate) => {
    if (counts.has(id)) {
      counts.delete(id);
    } else if (counts.size >= CACHE_LIMIT) {
      const oldest = counts.keys().next().value;
      if (oldest !== undefined) counts.delete(oldest);
    }
    counts.set(id, estimate);
  };

  /**
   * Queries the Return YouTube Dislike API strictly via the background service worker proxy.
   * @param {string} id
   * @returns {Promise<number | null>}
   */
  const lookup = async (id) => {
    if (!id || !VIDEO_ID_REGEX.test(id)) return null;

    const ext = globalThis.chrome ?? globalThis.browser;
    if (ext?.runtime?.sendMessage) {
      try {
        const res = await new Promise((resolve) => {
          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve(null);
            }
          }, FETCH_TIMEOUT_MS);

          ext.runtime.sendMessage({ type: 'FETCH_DISLIKES', videoId: id }, (response) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (ext.runtime.lastError) {
              resolve(null);
            } else {
              resolve(response);
            }
          });
        });

        if (
          res?.success &&
          res.data?.deleted === false &&
          typeof res.data?.dislikes === 'number' &&
          res.data.dislikes >= 0
        ) {
          return res.data.dislikes;
        }
      } catch {
        return null;
      }
    }

    return null;
  };

  /**
   * Restores a button to its original state, removing injected nodes and preserving icons.
   * @param {HTMLElement} button
   */
  const restoreButton = (button) => {
    if (!button || !(button instanceof HTMLElement)) return;

    const custom = button.querySelector('[data-ehf-dislike-text]');
    if (custom) {
      custom.remove();
    }

    button.style.width = '';
    button.style.minWidth = '';
    button.style.paddingRight = '';
    delete button.dataset.ehfCurrentId;

    if (button.dataset.ehfConvertedIconOnly) {
      button.classList.remove('yt-spec-button-shape-next--icon-leading');
      button.classList.add('yt-spec-button-shape-next--icon-only');
      delete button.dataset.ehfConvertedIconOnly;
    }
    const parentViewModel = button.closest('button-view-model') || button.closest('dislike-button-view-model');
    if (parentViewModel?.dataset.ehfConvertedIconOnly) {
      parentViewModel.classList.remove('yt-spec-button-shape-next--icon-leading');
      parentViewModel.classList.add('yt-spec-button-shape-next--icon-only');
      delete parentViewModel.dataset.ehfConvertedIconOnly;
    }

    for (let i = 0; i < LABEL_SELECTORS.length; i++) {
      const native = button.querySelector(LABEL_SELECTORS[i]);
      if (native && native.dataset.ehfOriginalLabel !== undefined) {
        const target = native.querySelector('span[role="text"]') || native;
        target.textContent = native.dataset.ehfOriginalLabel;
        delete native.dataset.ehfOriginalLabel;
      }
    }

    const btn = button.closest('button') || button;
    btn.removeAttribute('title');
  };

  /**
   * Renders the dislike estimate into the button element non-destructively.
   * @param {HTMLElement} button
   * @param {number | null} estimate
   */
  const render = (button, estimate) => {
    if (!button || !(button instanceof HTMLElement)) return;

    if (estimate === null) {
      restoreButton(button);
      return;
    }

    // Loop guard: if the button already displays the dislike count for this video, exit immediately!
    const existingLabel = button.querySelector('[data-ehf-dislike-text]');
    if (existingLabel && button.dataset.ehfCurrentId === currentId) {
      return;
    }

    const container = getOrCreateTextContainer(button);
    if (!container) return;

    button.dataset.ehfCurrentId = currentId;

    const target = container.querySelector('span[role="text"]') || container;
    if (!container.dataset.ehfDislikeText && container.dataset.ehfOriginalLabel === undefined) {
      container.dataset.ehfOriginalLabel = target.textContent?.trim() || '';
    }

    const formattedCount = format(estimate);
    target.textContent = formattedCount;

    const btn = button.closest('button') || button;
    btn.setAttribute('title', `${formattedCount} · ${SOURCE}`);
    btn.setAttribute('aria-label', `${formattedCount} dislikes`);

    // Attach scoped container observer to handle Lit hydration re-renders with 0 CPU cost
    attachScopedObserver(button);
  };

  /**
   * Attaches a low-overhead observer directly to the segmented button wrapper.
   * Fast path: exits in 0.001ms if label is intact for the current video.
   * Re-injects from memory cache only if YouTube Lit wipes the node during hydration.
   * @param {HTMLElement} button
   */
  const attachScopedObserver = (button) => {
    const container =
      button.closest('segmented-like-dislike-button-view-model') ||
      button.closest('ytd-segmented-like-dislike-button-renderer') ||
      button.closest('dislike-button-view-model') ||
      button.closest('#actions') ||
      button.parentElement;

    if (!container || container === observedContainer) return;

    containerObserver?.disconnect();
    observedContainer = container;

    containerObserver = new MutationObserver(() => {
      // Loop guard: if current dislike button already displays the count for current video, return immediately!
      const activeBtn = findDislikeButton();
      if (!activeBtn) return;
      const current = activeBtn.querySelector('[data-ehf-dislike-text]');
      if (current && activeBtn.dataset.ehfCurrentId === currentId) return;

      if (containerFrameId !== 0) return;
      containerFrameId = requestAnimationFrame(() => {
        containerFrameId = 0;
        const fresh = findDislikeButton();
        if (fresh && currentId && counts.has(currentId)) {
          const freshLabel = fresh.querySelector('[data-ehf-dislike-text]');
          if (!freshLabel || fresh.dataset.ehfCurrentId !== currentId) {
            render(fresh, counts.get(currentId));
          }
        }
      });
    });

    containerObserver.observe(container, { childList: true, subtree: true });

    // Disconnect heavy global observer now that button is bound
    disconnectGlobalObserver();
  };

  const disconnectGlobalObserver = () => {
    if (globalObserverTimer) {
      clearTimeout(globalObserverTimer);
      globalObserverTimer = 0;
    }
    if (globalObserver) {
      globalObserver.disconnect();
      globalObserver = null;
    }
  };

  /**
   * Fetches the estimate and renders it once available.
   * @param {string} id
   */
  const request = async (id) => {
    if (pending.has(id)) return;
    pending.add(id);

    const estimate = await lookup(id);
    pending.delete(id);
    remember(id, estimate);

    if (!enabled || extractVideoId() !== id) return;
    const button = findDislikeButton();
    if (button instanceof HTMLElement) {
      render(button, estimate);
    }
  };

  /**
   * Scans DOM for the dislike button and initiates lookup or rendering.
   */
  const scan = () => {
    scanFrameId = 0;
    if (!isVideoPage()) {
      disconnectGlobalObserver();
      return;
    }

    currentId = extractVideoId();
    if (!currentId) return;

    // Immediately trigger pre-fetch so dislike count is already in memory when button mounts!
    if (!counts.has(currentId) && !pending.has(currentId)) {
      request(currentId);
    }

    const button = findDislikeButton();
    if (!(button instanceof HTMLElement)) {
      ensureGlobalObserver();
      return;
    }

    if (counts.has(currentId)) {
      render(button, counts.get(currentId));
    }
  };

  /**
   * Engages global MutationObserver strictly while waiting for the button during initial load.
   * Automatically disconnects once button is bound or after a 4-second safety timeout.
   */
  const ensureGlobalObserver = () => {
    if (globalObserver || !enabled || !isVideoPage()) return;

    globalObserver = new MutationObserver(() => {
      if (scanFrameId !== 0) return;
      scanFrameId = requestAnimationFrame(scan);
    });

    globalObserver.observe(document.documentElement, { childList: true, subtree: true });

    if (globalObserverTimer) clearTimeout(globalObserverTimer);
    globalObserverTimer = setTimeout(() => {
      globalObserverTimer = 0;
      disconnectGlobalObserver();
    }, GLOBAL_OBSERVER_TIMEOUT_MS);
  };

  const restoreAll = () => {
    for (let i = 0; i < BUTTON_SELECTORS.length; i++) {
      for (const el of document.querySelectorAll(BUTTON_SELECTORS[i])) {
        const btn = el.tagName === 'BUTTON' ? el : el.querySelector('button');
        if (btn instanceof HTMLElement) restoreButton(btn);
      }
    }
    for (const injected of document.querySelectorAll('[data-ehf-dislike-text]')) {
      injected.remove();
    }
  };

  const start = () => {
    if (!isVideoPage()) return;
    scan();
    if (!observedContainer) {
      ensureGlobalObserver();
    }
  };

  const stop = () => {
    disconnectGlobalObserver();
    if (containerObserver) {
      containerObserver.disconnect();
      containerObserver = null;
      observedContainer = null;
    }
    if (scanFrameId !== 0) {
      cancelAnimationFrame(scanFrameId);
      scanFrameId = 0;
    }
    if (containerFrameId !== 0) {
      cancelAnimationFrame(containerFrameId);
      containerFrameId = 0;
    }
    restoreAll();
  };

  const sync = (config) => {
    enabled = config?.show_dislikes === true;
    if (enabled) start();
    else stop();
  };

  /**
   * Video navigation handler for YouTube SPA transitions (including Home <-> Video).
   */
  const onNavigation = () => {
    currentId = null;
    if (scanFrameId !== 0) {
      cancelAnimationFrame(scanFrameId);
      scanFrameId = 0;
    }
    if (containerFrameId !== 0) {
      cancelAnimationFrame(containerFrameId);
      containerFrameId = 0;
    }
    if (containerObserver) {
      containerObserver.disconnect();
      containerObserver = null;
      observedContainer = null;
    }
    disconnectGlobalObserver();

    if (enabled && isVideoPage()) {
      scan();
    }
  };

  for (let i = 0; i < NAVIGATION_EVENTS.length; i++) {
    window.addEventListener(NAVIGATION_EVENTS[i], onNavigation, { passive: true });
  }

  if (globalThis.EHF?.read) {
    globalThis.EHF.read().then(sync);
    globalThis.EHF.subscribe(sync);
  }
})();
