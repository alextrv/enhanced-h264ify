/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Page-world half of the codec bridge, declared as `"world": "MAIN"` so it needs no
 * <script> injection and the extension exposes no page-fetchable URLs.
 *
 * YouTube picks a format by asking the browser what it can decode — HTMLMediaElement#
 * canPlayType for progressive and MediaSource#isTypeSupported for MSE (which is how
 * youtube.com and the embeds actually stream) — so patching those two answers is enough
 * to steer format selection. Both are read on the player's critical path, hence the
 * precomputed policy and the result cache.
 *
 * Everything lives inside this function on purpose: top-level `const` in a page-world
 * script would occupy the page's own lexical scope, where a name YouTube happens to
 * reuse would turn into a SyntaxError in youtube.com's code.
 */
(() => {
  const POLICY_ATTRIBUTE = 'data-ehf-policy'; // written by src/content/bridge.js
  const POLICY_EVENT = 'ehf-policy';

  const MAX_FRAMERATE = 30;
  const CACHE_LIMIT = 512;

  /** RFC 6381 codec prefixes as they appear in the `codecs` MIME parameter. */
  const CODEC_FAMILIES = Object.freeze({
    block_h264: ['avc'],
    block_vp8: ['vp8'],
    block_vp9: ['vp9', 'vp09'],
    block_av1: ['av01'],
    block_opus: ['opus'],
    block_mp4a: ['mp4a'],
  });

  const CODECS_PARAMETER = /codecs\s*=\s*"?([^";]*)/i;
  /** Ratios are legal: `framerate=60000/1001` is 59.94, not 60000. */
  const FRAMERATE_PARAMETER = /framerate\s*=\s*(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?/i;

  let policy = null;
  let nativeCanPlayType = null;
  const canPlayTypeResults = new Map();
  const isTypeSupportedResults = new Map();

  const buildPolicy = (config) => {
    const prefixes = Object.entries(CODEC_FAMILIES)
      .filter(([key]) => config?.[key] === true)
      .flatMap(([, family]) => family);

    return {
      /** One regex for every blocked family: codec tokens are separated by `"`, `,` and
       *  whitespace, so a non-alphanumeric boundary keeps `avc` from matching inside a
       *  longer identifier while still matching every `avcN` variant. */
      blockedCodecs: prefixes.length ? new RegExp(`(?:^|[^a-z0-9])(?:${prefixes.join('|')})`, 'i') : null,
      blockHighFramerate: config?.block_60fps === true,
    };
  };

  const exceedsFramerateCap = (type) => {
    const match = FRAMERATE_PARAMETER.exec(type);
    if (!match) return false;
    const framerate = Number(match[1]) / Number(match[2] ?? 1);
    return framerate > MAX_FRAMERATE;
  };

  /** The codecs parameter value, or the whole MIME string when there is no codecs parameter,
   *  so a codec name appearing in some later parameter can never block a format. */
  const codecsValue = (type) => CODECS_PARAMETER.exec(type)?.[1] ?? type;

  const decide = (type, native, receiver, blocked) => {
    if (policy === null) return native.call(receiver, type);
    if (policy.blockedCodecs?.test(codecsValue(type)) || (policy.blockHighFramerate && exceedsFramerateCap(type))) return blocked;

    return native.call(receiver, type);
  };

  const resolveType = (type, native, receiver, cache, blocked) => {
    const cached = cache.get(type);
    if (cached !== undefined) return cached;

    const answer = decide(type, native, receiver, blocked);
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(type, answer);
    return answer;
  };

  /** Named function expressions keep the patched methods' `name` and `length` intact, and the
   *  blocked answer keeps each channel's contract: canPlayType answers with `''`, the HTML spec
   *  string, while MediaSource#isTypeSupported is declared to return a boolean.
   *
   *  Anything that is not a string is forwarded with its original argument list: calling the
   *  native with an explicit `undefined` would coerce it to the string "undefined" and return a
   *  value where the browser itself raises TypeError. */
  const canPlayTypeGuard = function canPlayType(type) {
    return typeof type === 'string'
      ? resolveType(type, nativeCanPlayType, this, canPlayTypeResults, '')
      : nativeCanPlayType.apply(this, arguments);
  };

  const createIsTypeSupportedGuard = (native) => function isTypeSupported(type) {
    return typeof type === 'string'
      ? resolveType(type, native, this, isTypeSupportedResults, false)
      : native.apply(this, arguments);
  };

  const replaceMethod = (target, name, value, native) => {
    if (typeof native !== 'function') return;
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, descriptor && 'value' in descriptor
      ? { ...descriptor, value }
      : { value, writable: true, configurable: true });
  };

  const install = () => {
    const prototype = globalThis.HTMLMediaElement?.prototype;
    nativeCanPlayType = prototype?.canPlayType;
    replaceMethod(prototype, 'canPlayType', canPlayTypeGuard, nativeCanPlayType);

    // Chrome and Firefox expose MediaSource; Safari 17+ also exposes ManagedMediaSource.
    for (const name of ['MediaSource', 'ManagedMediaSource']) {
      const constructor = globalThis[name];
      const native = constructor?.isTypeSupported;
      replaceMethod(constructor, 'isTypeSupported', createIsTypeSupportedGuard(native), native);
    }
  };

  const applyPolicy = (payload) => {
    let config;
    try {
      config = JSON.parse(payload);
    } catch {
      return; // <html> attributes are writable by the page: a malformed payload keeps the last valid policy
    }
    if (config === null || typeof config !== 'object') return;

    policy = buildPolicy(config);
    canPlayTypeResults.clear();
    isTypeSupportedResults.clear();
  };

  install();

  window.addEventListener(POLICY_EVENT, (event) => {
    if (typeof event.detail === 'string') applyPolicy(event.detail);
  });

  // Listen before reading, so a change that lands in between is not missed: the bridge
  // always writes the attribute before dispatching, so the read can only be too new.
  applyPolicy(document.documentElement?.getAttribute(POLICY_ATTRIBUTE) ?? '');
})();
