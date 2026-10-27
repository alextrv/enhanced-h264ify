/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Auto-select maximum available resolution and player audio control (Production 2026).
 * Runs in the page world (MAIN) to access YouTube player DOM expando methods
 * (`#movie_player.setPlaybackQualityRange()`, `getAvailableQualityData()`,
 * and `#movie_player.setStableVolume(false)`).
 *
 * Performance-hardened:
 * 1. Executes strictly once at the start of each new video (zero timers during playback).
 * 2. Event-driven triggers: uses `loadeddata` and `canplay` to apply immediately
 *    on stream readiness with zero polling loops.
 * 3. Uses zero-allocation single-pass ranking with full support for 1080p Premium,
 *    4K, 5K, and 8K profiles.
 * 4. Disables YouTube's native Stable Volume compression directly on the player
 *    instance in the page world when `disable_LN` is active.
 * 5. Never overrides user manual quality adjustments mid-playback.
 */
(() => {
  const POLICY_ATTRIBUTE = 'data-ehf-policy';
  const POLICY_EVENT = 'ehf-policy';
  const PLAYER_SELECTOR = '#movie_player';
  const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

  const MAX_ATTEMPTS = 6;
  const ATTEMPT_STEP = 50;
  const ATTEMPT_CEILING = 200;
  const NAVIGATION_EVENTS = Object.freeze(['yt-navigate-finish', 'yt-page-data-updated', 'popstate']);

  /** Resolution hierarchy names from lowest to highest */
  const LEVEL_ORDER = Object.freeze([
    'tiny', 'small', 'medium', 'large', 'hd720', 'hd1080', 'premium1080', 'hd1440', 'hd2160', 'hd2880', 'hd4320', 'highres',
  ]);

  let enabled = false;
  let disableLN = false;
  let attempts = 0;
  let timer = 0;
  let appliedVideoId = null;
  let cachedPlayer = null;

  const isVideoPage = () => {
    const p = location.pathname;
    return p.startsWith('/watch') || p.startsWith('/embed') || p.startsWith('/live');
  };

  /**
   * Resolves the active video ID from the URL.
   * @returns {string | null}
   */
  const extractVideoId = () => {
    const { pathname, search } = location;
    if (pathname.startsWith('/live/')) {
      const id = pathname.slice('/live/'.length).split(/[/?#]/)[0];
      return VIDEO_ID_REGEX.test(id) ? id : null;
    }
    const params = new URLSearchParams(search);
    const id = params.get('v');
    return id && VIDEO_ID_REGEX.test(id) ? id : null;
  };

  /**
   * Calculates a numeric rank for comparing quality levels without object creation.
   * Grants higher rank to Premium 1080p streams over standard 1080p.
   * @param {string | undefined} quality
   * @param {string | undefined} qualityLabel
   * @returns {number}
   */
  const qualityRank = (quality, qualityLabel) => {
    if (qualityLabel) {
      let height = Number.parseInt(qualityLabel, 10);
      if (Number.isFinite(height)) {
        if (qualityLabel.includes('Premium') || quality === 'premium1080') {
          height += 1;
        }
        return height;
      }
    }
    const index = quality ? LEVEL_ORDER.indexOf(quality) : -1;
    return index < 0 ? 0 : (index + 1) * 1000;
  };

  /**
   * Finds the highest quality in a single pass without allocating intermediate arrays.
   * @param {any} player
   * @returns {string | null}
   */
  const findHighestQuality = (player) => {
    try {
      const detailed = player.getAvailableQualityData?.();
      if (Array.isArray(detailed) && detailed.length) {
        let bestQuality = null;
        let bestRank = -1;
        for (let i = 0; i < detailed.length; i++) {
          const item = detailed[i];
          if (!item?.quality || item.quality === 'auto') continue;
          const rank = qualityRank(item.quality, item.qualityLabel);
          if (rank > bestRank) {
            bestRank = rank;
            bestQuality = item.quality;
          }
        }
        if (bestQuality) return bestQuality;
      }

      const names = player.getAvailableQualityLevels?.();
      if (Array.isArray(names) && names.length) {
        let bestQuality = null;
        let bestRank = -1;
        for (let i = 0; i < names.length; i++) {
          const q = names[i];
          if (!q || q === 'auto') continue;
          const rank = qualityRank(q, undefined);
          if (rank > bestRank) {
            bestRank = rank;
            bestQuality = q;
          }
        }
        return bestQuality;
      }
    } catch {
      // Player expando access error
    }
    return null;
  };

  const getPlayer = () => {
    if (cachedPlayer?.isConnected) return cachedPlayer;
    cachedPlayer = document.querySelector(PLAYER_SELECTOR);
    return cachedPlayer;
  };

  /**
   * Directly invokes player method in the MAIN page world to turn off native Stable Volume.
   * @param {any} [player]
   */
  const disableNativeStableVolume = (player) => {
    if (!disableLN) return;
    try {
      const p = player ?? getPlayer();
      if (typeof p?.setStableVolume === 'function') {
        p.setStableVolume(false);
      }
    } catch {}
  };

  const schedule = () => {
    if (!enabled || attempts >= MAX_ATTEMPTS || !isVideoPage()) return;
    if (timer) clearTimeout(timer);
    attempts += 1;
    timer = setTimeout(apply, Math.min(ATTEMPT_STEP * attempts, ATTEMPT_CEILING));
  };

  /**
   * Applies the maximum resolution once per video startup.
   */
  const apply = () => {
    timer = 0;
    if (!isVideoPage()) return;

    const player = getPlayer();
    disableNativeStableVolume(player);

    if (!enabled) return;

    const currentVideoId = extractVideoId();
    if (!currentVideoId) return;

    // Already applied for this video? Exit immediately to preserve user manual choices.
    if (appliedVideoId === currentVideoId) return;

    if (!player) {
      schedule();
      return;
    }

    // Verify player has loaded data for the current video
    const playerVideoId = player.getVideoData?.()?.video_id;
    if (playerVideoId && playerVideoId !== currentVideoId) {
      schedule();
      return;
    }

    const target = findHighestQuality(player);
    if (!target) {
      schedule();
      return;
    }

    // Successfully resolved target quality: apply and permanently mark this video as settled
    attempts = 0;
    appliedVideoId = currentVideoId;

    try {
      const currentQuality = player.getPlaybackQuality?.();
      if (currentQuality !== target) {
        player.setPlaybackQualityRange?.(target, target);
        if (typeof player.setPlaybackQuality === 'function') {
          player.setPlaybackQuality(target);
        }
      }
    } catch (err) {
      console.warn('[EHF-PlayerControl] Failed to set playback quality:', err);
    }
  };

  /**
   * Resets state and triggers one-shot quality adjustment for a new video.
   */
  const onVideoStart = () => {
    if (!isVideoPage()) return;

    disableNativeStableVolume(getPlayer());

    if (!enabled) return;
    const nextVideoId = extractVideoId();
    if (nextVideoId && nextVideoId === appliedVideoId) return;

    appliedVideoId = null;
    attempts = 0;
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
    apply();
  };

  const stop = () => {
    attempts = 0;
    appliedVideoId = null;
    cachedPlayer = null;
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
  };

  const applyPolicy = (payload) => {
    if (!payload || typeof payload !== 'string') return;
    let config;
    try {
      config = JSON.parse(payload);
    } catch {
      return;
    }
    if (!config || typeof config !== 'object') return;

    disableLN = config.disable_LN === true;
    if (disableLN) {
      disableNativeStableVolume(getPlayer());
    }

    const next = config.auto_max_resolution === true;
    if (next === enabled) return;

    enabled = next;
    if (enabled) onVideoStart();
    else stop();
  };

  // Listen for YouTube single-page app video navigation
  for (const name of NAVIGATION_EVENTS) {
    window.addEventListener(name, onVideoStart, { passive: true });
  }

  // Fast event triggers: apply instantly when video media pipeline buffers stream data
  document.addEventListener('loadeddata', () => {
    if (isVideoPage()) {
      disableNativeStableVolume(getPlayer());
      if (enabled && !appliedVideoId) apply();
    }
  }, { capture: true, passive: true });

  document.addEventListener('canplay', () => {
    if (isVideoPage()) {
      disableNativeStableVolume(getPlayer());
      if (enabled && !appliedVideoId) apply();
    }
  }, { capture: true, passive: true });

  window.addEventListener('pagehide', stop);

  // Cross-world policy synchronization
  window.addEventListener(POLICY_EVENT, (event) => {
    if (typeof event.detail === 'string') applyPolicy(event.detail);
  });

  // Backup observer for document attribute policy changes
  try {
    const attrObserver = new MutationObserver(() => {
      const payload = document.documentElement?.getAttribute(POLICY_ATTRIBUTE);
      if (payload) applyPolicy(payload);
    });
    if (document.documentElement) {
      attrObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [POLICY_ATTRIBUTE],
      });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.documentElement) {
          attrObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: [POLICY_ATTRIBUTE],
          });
        }
      }, { once: true });
    }
  } catch {
    // Ignore observer setup error
  }

  const initialPayload = document.documentElement?.getAttribute(POLICY_ATTRIBUTE);
  if (initialPayload) {
    applyPolicy(initialPayload);
  }
})();
