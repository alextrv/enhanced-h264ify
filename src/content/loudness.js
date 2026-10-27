/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Loudness normalization bypass. YouTube lowers video.volume below the level its volume
 * slider shows, so the slider stops being an honest control; this mirrors the shown level
 * onto the element's real volume instead.
 *
 * Reverse-engineered surface: the slider is a `role="slider"` div inside
 * `.ytp-volume-panel` (not an <input>), so its aria-valuenow attribute — 0..100, updated
 * for drags and for the keyboard shortcuts alike — is the only change signal available,
 * and `video.volume` is the only thing we may write.
 *
 * Live in the isolated world: the DOM is shared, so no injection is needed, and the
 * feature can react to storage changes instead of waiting for a page reload.
 */
(() => {
  const PANEL_SELECTOR = '.ytp-volume-panel';
  const VOLUME_ATTRIBUTE = 'aria-valuenow';

  let enabled = false;
  let panel = null;
  let panelObserver = null;
  let treeObserver = null;
  let scanQueued = false;

  const livePanel = () => (panel?.isConnected ? panel : document.querySelector(PANEL_SELECTOR));

  const applyVolume = () => {
    const level = Number.parseInt(livePanel()?.getAttribute(VOLUME_ATTRIBUTE) ?? '', 10);
    if (!Number.isFinite(level)) return;

    const video = document.querySelector('video');
    if (!video) return;
    video.volume = Math.min(1, Math.max(0, level / 100));
  };

  const observePanel = () => {
    const next = livePanel();
    if (!next || next === panel) return;

    panelObserver?.disconnect();
    panel = next;
    panelObserver = new MutationObserver(applyVolume);
    panelObserver.observe(panel, { attributes: true, attributeFilter: [VOLUME_ATTRIBUTE] });
    applyVolume();
  };

  const scan = () => {
    scanQueued = false;
    if (enabled) observePanel();
  };

  const onTreeChange = () => {
    // Steady state on a watch page: a single property read per mutation batch. Only while
    // the panel is missing (home, search, ads) do we scan, and then at most once per frame.
    if (panel?.isConnected || scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  };

  const start = () => {
    if (enabled) return;
    enabled = true;
    treeObserver ??= new MutationObserver(onTreeChange);
    treeObserver.observe(document.documentElement, { childList: true, subtree: true });
    observePanel();
  };

  const stop = () => {
    if (!enabled) return;
    enabled = false;
    // A scan can still be queued for a frame that never runs while the tab is hidden; clearing
    // the flag keeps a later start() from being gated by it.
    scanQueued = false;
    treeObserver.disconnect();
    panelObserver?.disconnect();
    panelObserver = null;
    panel = null;
  };

  const sync = (config) => {
    if (config?.disable_LN === true) start();
    else stop();
  };

  // Non-bubbling, so it needs capture; catches the player swapping the <video> element
  // (SPA navigation, ads) where the slider itself never moves.
  document.addEventListener('loadedmetadata', () => {
    if (enabled) applyVolume();
  }, { capture: true, passive: true });

  EHF.read().then(sync);
  EHF.subscribe(sync);
})();
