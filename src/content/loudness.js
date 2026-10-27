/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Loudness normalization bypass (Production 2026).
 * Synchronizes the HTML video element's real volume directly to YouTube's volume slider
 * to disable YouTube's aggressive backend loudness normalization.
 *
 * Performance-hardened for low-resource devices:
 * - Direct attribute observation on `.ytp-volume-panel` (`aria-valuenow`).
 * - Zero event ping-pong loops (avoids redundant `volumechange` event loops).
 * - Mute preservation: respects `video.muted` without unintended un-muting.
 * - One-shot localStorage override for YouTube "Stable Volume" preference.
 * - Disconnects global DOM tree observer as soon as the volume panel is bound.
 */
(() => {
  if (window !== window.top && !location.pathname.startsWith('/embed/')) return;

  const PANEL_SELECTOR = '.ytp-volume-panel';
  const VOLUME_ATTRIBUTE = 'aria-valuenow';
  const MAIN_VIDEO_SELECTORS = Object.freeze([
    '#movie_player video',
    '.html5-main-video',
    'video.video-stream',
    'video',
  ]);

  const TREE_OBSERVER_TIMEOUT_MS = 10000;

  let enabled = false;
  let panel = null;
  let cachedVideo = null;
  let panelObserver = null;
  let treeObserver = null;
  let treeObserverTimer = 0;
  let scanFrameId = 0;

  const isVideoPage = () => {
    const p = location.pathname;
    return (
      p.startsWith('/watch') ||
      p.startsWith('/embed') ||
      p.startsWith('/live') ||
      p.startsWith('/shorts') ||
      p.endsWith('.html') ||
      Boolean(cachedVideo?.isConnected || document.querySelector('#movie_player video, .html5-main-video'))
    );
  };

  const livePanel = () => {
    if (panel?.isConnected) return panel;
    panel = document.querySelector(PANEL_SELECTOR);
    return panel;
  };

  /**
   * Finds the primary active video element with element caching.
   * @returns {HTMLVideoElement | null}
   */
  const findMainVideo = () => {
    if (cachedVideo?.isConnected) return cachedVideo;
    for (let i = 0; i < MAIN_VIDEO_SELECTORS.length; i++) {
      const el = document.querySelector(MAIN_VIDEO_SELECTORS[i]);
      if (el instanceof HTMLVideoElement) {
        cachedVideo = el;
        return el;
      }
    }
    return null;
  };

  /**
   * Disables YouTube's native "Stable Volume" preference in localStorage (once per navigation).
   */
  const disableNativeStableVolume = () => {
    try {
      const raw = localStorage.getItem('yt-player-volume');
      if (raw) {
        const parsed = JSON.parse(raw);
        let modified = false;
        if (typeof parsed?.data === 'string') {
          const inner = JSON.parse(parsed.data);
          if (inner.stableVolumeEnabled !== false) {
            inner.stableVolumeEnabled = false;
            parsed.data = JSON.stringify(inner);
            modified = true;
          }
        } else if (parsed?.data && typeof parsed.data === 'object') {
          if (parsed.data.stableVolumeEnabled !== false) {
            parsed.data.stableVolumeEnabled = false;
            modified = true;
          }
        }
        if (modified) {
          localStorage.setItem('yt-player-volume', JSON.stringify(parsed));
        }
      }

      const stableRaw = localStorage.getItem('yt-player-stable-volume');
      if (stableRaw) {
        const stableParsed = JSON.parse(stableRaw);
        if (stableParsed?.data === 'true' || stableParsed?.data === true) {
          stableParsed.data = 'false';
          localStorage.setItem('yt-player-stable-volume', JSON.stringify(stableParsed));
        }
      }
    } catch {}
  };

  /**
   * Applies slider volume percentage to the video element.
   * Respects mute state and includes delta-check to prevent redundant assignments.
   */
  const applyVolume = () => {
    if (!enabled || !isVideoPage()) return;

    const panelEl = livePanel();
    const rawVal = panelEl?.getAttribute(VOLUME_ATTRIBUTE);
    if (!rawVal) return;

    const level = Number.parseInt(rawVal, 10);
    if (!Number.isFinite(level)) return;

    const video = findMainVideo();
    if (!video || !video.isConnected) return;

    // Respect mute state: do not alter volume if the user muted the video
    if (video.muted) return;

    const targetVolume = Math.min(1, Math.max(0, level / 100));
    if (Math.abs(video.volume - targetVolume) > 0.005) {
      video.volume = targetVolume;
    }
  };

  const disconnectTreeObserver = () => {
    if (treeObserverTimer) {
      clearTimeout(treeObserverTimer);
      treeObserverTimer = 0;
    }
    if (treeObserver) {
      treeObserver.disconnect();
      treeObserver = null;
    }
  };

  /**
   * Attaches attribute observer directly to the volume panel,
   * disconnecting global tree observer once bound.
   */
  const observePanel = () => {
    const next = livePanel();
    if (!next) return;

    if (next !== panel) {
      panelObserver?.disconnect();
      panel = next;
      panelObserver = new MutationObserver(applyVolume);
      panelObserver.observe(panel, {
        attributes: true,
        attributeFilter: [VOLUME_ATTRIBUTE],
      });
      applyVolume();
    }

    disconnectTreeObserver();
  };

  const scan = () => {
    scanFrameId = 0;
    if (enabled && isVideoPage()) {
      observePanel();
      applyVolume();
    }
  };

  const ensureTreeObserver = () => {
    if (treeObserver || !enabled || !isVideoPage()) return;
    treeObserver = new MutationObserver(onTreeChange);
    treeObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    if (treeObserverTimer) clearTimeout(treeObserverTimer);
    treeObserverTimer = setTimeout(() => {
      treeObserverTimer = 0;
      disconnectTreeObserver();
    }, TREE_OBSERVER_TIMEOUT_MS);
  };

  const onTreeChange = (records) => {
    if (panel?.isConnected) {
      disconnectTreeObserver();
      return;
    }
    if (scanFrameId !== 0 || !isVideoPage()) return;

    for (let i = 0; i < records.length; i++) {
      const added = records[i].addedNodes;
      for (let j = 0; j < added.length; j++) {
        const node = added[j];
        if (node.nodeType === 1) {
          const el = /** @type {HTMLElement} */ (node);
          if (
            el.classList.contains('ytp-volume-panel') ||
            el.classList.contains('ytp-chrome-bottom') ||
            el.id === 'movie_player' ||
            el.tagName.startsWith('YTD-PLAYER') ||
            el.querySelector?.(PANEL_SELECTOR)
          ) {
            scanFrameId = requestAnimationFrame(scan);
            return;
          }
        }
      }
    }
  };

  const start = () => {
    if (enabled) return;
    enabled = true;
    disableNativeStableVolume();
    if (!isVideoPage()) return;
    observePanel();
    applyVolume();
    if (!panel?.isConnected) {
      ensureTreeObserver();
    }
  };

  const stop = () => {
    enabled = false;
    if (scanFrameId !== 0) {
      cancelAnimationFrame(scanFrameId);
      scanFrameId = 0;
    }
    disconnectTreeObserver();
    panelObserver?.disconnect();
    panelObserver = null;
    panel = null;
    cachedVideo = null;
  };

  const sync = (config) => {
    if (config?.disable_LN === true) start();
    else stop();
  };

  const onNavigation = () => {
    cachedVideo = null;
    if (!enabled) return;
    if (!isVideoPage()) {
      if (scanFrameId !== 0) {
        cancelAnimationFrame(scanFrameId);
        scanFrameId = 0;
      }
      disconnectTreeObserver();
      panelObserver?.disconnect();
      panelObserver = null;
      panel = null;
      return;
    }

    if (!panel?.isConnected) {
      panel = null;
      panelObserver?.disconnect();
      panelObserver = null;
      observePanel();
      if (!panel?.isConnected) {
        ensureTreeObserver();
      }
    }

    disableNativeStableVolume();
    applyVolume();
  };

  const NAVIGATION_EVENTS = ['yt-navigate-finish', 'yt-page-data-updated', 'popstate'];
  for (const name of NAVIGATION_EVENTS) {
    window.addEventListener(name, onNavigation, { passive: true });
  }

  // Lifecycle stream hooks
  document.addEventListener(
    'loadedmetadata',
    () => {
      if (enabled && isVideoPage()) applyVolume();
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    'playing',
    () => {
      if (enabled && isVideoPage()) applyVolume();
    },
    { capture: true, passive: true }
  );

  if (globalThis.EHF?.read) {
    globalThis.EHF.read().then(sync);
    globalThis.EHF.subscribe(sync);
  }
})();
