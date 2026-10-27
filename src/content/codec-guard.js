/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Page-world (MAIN) codec interceptor.
 * Patches HTMLMediaElement#canPlayType and MediaSource#isTypeSupported
 * synchronously to enforce user-selected video and audio codec policies.
 *
 * Performance-hardened (Production 2026):
 * - O(1) LRU cache with strict 200-item ceiling (identical to service worker).
 * - Zero iterator allocations or batch eviction thrashing.
 * - Single-pass live stream detection cached across playback.
 */
(() => {
  const POLICY_ATTRIBUTE = 'data-ehf-policy';
  const POLICY_EVENT = 'ehf-policy';

  const MAX_FRAMERATE = 30;
  const CACHE_LIMIT = 200;
  const PLAYER_SELECTOR = '#movie_player';

  const PAGE_DATA_EVENTS = ['yt-navigate-finish', 'yt-page-data-updated'];

  /** RFC 6381 codec prefixes as they appear in MIME codecs parameters */
  const CODEC_FAMILIES = Object.freeze({
    block_h264: ['avc'],
    block_vp8: ['vp8'],
    block_vp9: ['vp9', 'vp09'],
    block_av1: ['av01'],
    block_opus: ['opus'],
    block_mp4a: ['mp4a'],
  });

  const CODECS_PARAMETER = /codecs\s*=\s*"?([^";]*)/i;
  const FRAMERATE_PARAMETER = /framerate\s*=\s*(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?/i;

  /** Standard extension defaults used to prevent startup race leaks before bridge hydrates */
  const DEFAULT_CONFIG = Object.freeze({
    block_60fps: false,
    block_h264: false,
    block_vp8: true,
    block_vp9: true,
    block_av1: true,
    block_opus: true,
    block_mp4a: true,
  });

  let nativeCanPlayType = null;
  const canPlayTypeResults = new Map();
  const isTypeSupportedResults = new Map();

  let liveState = null;
  let navigated = false;

  /**
   * Compiles the blocked codec regex and frame-rate flags from a config object.
   * @param {Record<string, unknown> | null | undefined} config
   */
  const buildPolicy = (config) => {
    const prefixes = Object.entries(CODEC_FAMILIES)
      .filter(([key]) => config?.[key] === true)
      .flatMap(([, family]) => family);

    return {
      blockedCodecs: prefixes.length
        ? new RegExp(`(?:^|[^a-z0-9])(?:${prefixes.join('|')})`, 'i')
        : null,
      blockHighFramerate: config?.block_60fps === true,
    };
  };

  /** Start with default policy to protect against early queries before bridge loads */
  let policy = buildPolicy(DEFAULT_CONFIG);

  /**
   * Evaluates if a given MIME type string requests a framerate above 30fps.
   * @param {string} type
   */
  const exceedsFramerateCap = (type) => {
    const match = FRAMERATE_PARAMETER.exec(type);
    if (!match) return false;
    const numerator = Number(match[1]);
    const denominator = Number(match[2] ?? 1) || 1;
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return false;
    }
    return (numerator / denominator) > MAX_FRAMERATE;
  };

  /**
   * Extracts the codecs parameter value, or falls back to the full MIME string.
   * @param {string} type
   */
  const codecsValue = (type) => CODECS_PARAMETER.exec(type)?.[1] ?? type;

  /**
   * Checks whether the currently playing item is a live stream.
   * Prevents degrading live stream resolution when no 30fps alternative exists.
   */
  const detectLive = () => {
    try {
      const player = document.querySelector(PLAYER_SELECTOR);
      const data = player?.getVideoData?.();
      if (typeof data?.isLive === 'boolean') return data.isLive;

      const video = document.querySelector('video');
      if (video?.duration === Infinity) return true;

      const initial = globalThis.ytInitialPlayerResponse?.videoDetails?.isLive;
      return typeof initial === 'boolean' && !navigated ? initial : null;
    } catch {
      return null;
    }
  };

  const refreshLiveState = () => {
    const next = detectLive();
    if (next === null || next === liveState) return;

    liveState = next;
    canPlayTypeResults.clear();
    isTypeSupportedResults.clear();
  };

  const isLiveStream = () => {
    if (liveState === null) refreshLiveState();
    return liveState === true;
  };

  const onVideoChange = () => {
    navigated = true;
    liveState = null;
    refreshLiveState();
  };

  /**
   * Evaluates format support against the active codec and framerate policy.
   * @param {string} type
   * @param {Function | null} native
   * @param {unknown} receiver
   * @param {unknown} blockedAnswer - '' for canPlayType, false for isTypeSupported
   */
  const decide = (type, native, receiver, blockedAnswer) => {
    if (policy === null) {
      return typeof native === 'function' ? native.call(receiver, type) : blockedAnswer;
    }

    if (policy.blockedCodecs && policy.blockedCodecs.test(codecsValue(type))) {
      return blockedAnswer;
    }

    if (policy.blockHighFramerate && !isLiveStream() && exceedsFramerateCap(type)) {
      return blockedAnswer;
    }

    return typeof native === 'function' ? native.call(receiver, type) : blockedAnswer;
  };

  /**
   * Strict O(1) LRU insertion and eviction for bounded cache memory.
   * @param {Map<string, unknown>} cache
   * @param {string} key
   * @param {unknown} value
   */
  const setCached = (cache, key, value) => {
    if (cache.has(key)) {
      cache.delete(key);
    } else if (cache.size >= CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    cache.set(key, value);
  };

  /**
   * Resolves format support through O(1) LRU cache or native evaluation.
   * @param {string} type
   * @param {Function | null} native
   * @param {unknown} receiver
   * @param {Map<string, unknown>} cache
   * @param {unknown} blockedAnswer
   */
  const resolveType = (type, native, receiver, cache, blockedAnswer) => {
    if (cache.has(type)) {
      const cached = cache.get(type);
      // Refresh recency in O(1)
      cache.delete(type);
      cache.set(type, cached);
      return cached;
    }

    const answer = decide(type, native, receiver, blockedAnswer);
    setCached(cache, type, answer);
    return answer;
  };

  const canPlayTypeGuard = function canPlayType(type) {
    if (typeof type !== 'string') {
      return typeof nativeCanPlayType === 'function'
        ? nativeCanPlayType.apply(this, arguments)
        : '';
    }
    return resolveType(type, nativeCanPlayType, this, canPlayTypeResults, '');
  };

  const createIsTypeSupportedGuard = (native) =>
    function isTypeSupported(type) {
      if (typeof type !== 'string') {
        return typeof native === 'function' ? native.apply(this, arguments) : false;
      }
      return resolveType(type, native, this, isTypeSupportedResults, false);
    };

  /**
   * Securely replaces a prototype method while maintaining property attributes.
   * @param {object | undefined} target
   * @param {string} name
   * @param {Function} value
   * @param {Function | null} native
   */
  const replaceMethod = (target, name, value, native) => {
    if (!target || typeof native !== 'function') return;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(target, name);
      Object.defineProperty(
        target,
        name,
        descriptor && 'value' in descriptor
          ? { ...descriptor, value }
          : { value, writable: true, configurable: true }
      );
    } catch (err) {
      console.warn(`[EHF-Guard] Unable to patch ${name}:`, err);
    }
  };

  const install = () => {
    const mediaProto = globalThis.HTMLMediaElement?.prototype;
    if (mediaProto) {
      nativeCanPlayType = mediaProto.canPlayType;
      replaceMethod(mediaProto, 'canPlayType', canPlayTypeGuard, nativeCanPlayType);
    }

    for (const name of ['MediaSource', 'ManagedMediaSource']) {
      const ctor = globalThis[name];
      if (ctor) {
        const native = ctor.isTypeSupported;
        replaceMethod(ctor, 'isTypeSupported', createIsTypeSupportedGuard(native), native);
      }
    }
  };

  /**
   * Parses and applies a new policy payload from the isolated-world bridge.
   * @param {string} payload
   */
  const applyPolicy = (payload) => {
    if (!payload || typeof payload !== 'string') return;
    let config;
    try {
      config = JSON.parse(payload);
    } catch {
      return;
    }
    if (!config || typeof config !== 'object') return;

    policy = buildPolicy(config);
    canPlayTypeResults.clear();
    isTypeSupportedResults.clear();
  };

  install();

  window.addEventListener(POLICY_EVENT, (event) => {
    if (typeof event.detail === 'string') {
      applyPolicy(event.detail);
    }
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

  for (const name of PAGE_DATA_EVENTS) {
    window.addEventListener(name, onVideoChange, { passive: true });
  }

  document.addEventListener('loadedmetadata', onVideoChange, { passive: true, capture: true });

  // Hydrate with attribute policy if available on boot
  const initialPayload = document.documentElement?.getAttribute(POLICY_ATTRIBUTE);
  if (initialPayload) {
    applyPolicy(initialPayload);
  }
})();
