/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Option schema and storage access, loaded as a plain script by every context that
 * needs it: content scripts cannot be ES modules, and the popup must not disagree
 * with them about keys or defaults — that mismatch is what made the UI show AAC and
 * Opus as allowed while the player had both blocked.
 *
 * Exposes `globalThis.EHF`; nothing else in the extension writes to a shared global.
 */
globalThis.EHF = Object.freeze((() => {
  const OPTIONS = Object.freeze([
    { key: 'block_60fps', label: 'optionsBlock60fps', group: 'video', default: false },
    { key: 'block_h264', label: 'optionsBlockH264', group: 'video', default: false },
    { key: 'block_vp8', label: 'optionsBlockVP8', group: 'video', default: true },
    { key: 'block_vp9', label: 'optionsBlockVP9', group: 'video', default: true },
    { key: 'block_av1', label: 'optionsBlockAV1', group: 'video', default: true },
    { key: 'block_opus', label: 'optionsBlockOpus', group: 'audio', default: true },
    { key: 'block_mp4a', label: 'optionsBlockMP4A', group: 'audio', default: true },
    { key: 'disable_LN', label: 'optionsDisableLN', group: 'audio', default: false },
  ]);

  const KEYS = Object.freeze(OPTIONS.map(({ key }) => key));
  const DEFAULTS = Object.freeze(Object.fromEntries(OPTIONS.map(({ key, default: value }) => [key, value])));

  const api = () => globalThis.browser ?? globalThis.chrome;
  const area = () => api()?.storage?.local;

  /**
   * Only real booleans are trusted. Pre-2.2 builds serialized these through the page's
   * localStorage as strings ("false" was truthy), so anything else falls back to the default.
   */
  const normalize = (stored = {}) =>
    Object.fromEntries(KEYS.map((key) => [key, typeof stored?.[key] === 'boolean' ? stored[key] : DEFAULTS[key]]));

  /** Never rejects: a storage area that is missing or was invalidated by an extension update
   *  yields the documented defaults, which is also what a first run looks like. */
  const read = async () => {
    try {
      return normalize(await area()?.get(DEFAULTS));
    } catch {
      return normalize();
    }
  };

  const write = (patch) => area()?.set(patch);

  /** Re-reads storage instead of merging `changes`, so listeners receive one authoritative
   *  snapshot and never have to reconstruct the parts of the config that did not change. */
  const subscribe = (listener) => {
    api()?.storage?.onChanged?.addListener((changes, areaName) => {
      if (areaName !== 'local' || !KEYS.some((key) => key in changes)) return;
      read().then(listener);
    });
  };

  return { OPTIONS, KEYS, DEFAULTS, normalize, read, write, subscribe };
})());
