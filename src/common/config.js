/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * @typedef {Object} OptionDefinition
 * @property {string} key - Unique storage key for the option
 * @property {string} label - i18n message key
 * @property {'video' | 'audio' | 'playback' | 'interface'} group - UI category
 * @property {boolean} default - Fallback value
 */

/**
 * @typedef {Object} EHFConfig
 * @property {boolean} block_60fps
 * @property {boolean} block_h264
 * @property {boolean} block_vp8
 * @property {boolean} block_vp9
 * @property {boolean} block_av1
 * @property {boolean} block_opus
 * @property {boolean} block_mp4a
 * @property {boolean} disable_LN
 * @property {boolean} auto_max_resolution
 * @property {boolean} anti_inactivity
 * @property {boolean} bypass_age_gate
 * @property {boolean} show_dislikes
 */

/**
 * Option schema and storage access for YouTube.
 * Loaded in content scripts, background worker, and options UI.
 * Exposes an immutable global `globalThis.EHF`.
 */
globalThis.EHF = Object.freeze((() => {
  /** @type {readonly OptionDefinition[]} */
  const OPTIONS = Object.freeze([
    { key: 'block_60fps', label: 'optionsBlock60fps', group: 'video', default: false },
    { key: 'block_h264', label: 'optionsBlockH264', group: 'video', default: false },
    { key: 'block_vp8', label: 'optionsBlockVP8', group: 'video', default: true },
    { key: 'block_vp9', label: 'optionsBlockVP9', group: 'video', default: true },
    { key: 'block_av1', label: 'optionsBlockAV1', group: 'video', default: true },
    { key: 'block_opus', label: 'optionsBlockOpus', group: 'audio', default: true },
    { key: 'block_mp4a', label: 'optionsBlockMP4A', group: 'audio', default: true },
    { key: 'disable_LN', label: 'optionsDisableLN', group: 'audio', default: false },
    { key: 'auto_max_resolution', label: 'optionsAutoMaxResolution', group: 'playback', default: false },
    { key: 'anti_inactivity', label: 'optionsAntiInactivity', group: 'playback', default: false },
    { key: 'bypass_age_gate', label: 'optionsBypassAgeGate', group: 'playback', default: false },
    { key: 'show_dislikes', label: 'optionsShowDislikes', group: 'interface', default: false },
  ]);

  /** @type {readonly string[]} */
  const KEYS = Object.freeze(OPTIONS.map(({ key }) => key));

  /** @type {Readonly<EHFConfig>} */
  const DEFAULTS = Object.freeze(
    Object.fromEntries(OPTIONS.map(({ key, default: value }) => [key, value]))
  );

  /**
   * Safely resolve the extension storage area across Chrome and Firefox.
   * @returns {chrome.storage.StorageArea | undefined}
   */
  const getStorageArea = () =>
    globalThis.chrome?.storage?.local ?? globalThis.browser?.storage?.local;

  /**
   * Normalize an untrusted stored dictionary into a validated EHFConfig object.
   * Only strictly boolean values are accepted; all others fall back to defaults.
   * @param {Record<string, unknown> | null | undefined} stored
   * @returns {EHFConfig}
   */
  const normalize = (stored = {}) => {
    const result = {};
    for (const key of KEYS) {
      const val = stored?.[key];
      result[key] = typeof val === 'boolean' ? val : DEFAULTS[key];
    }
    return /** @type {EHFConfig} */ (result);
  };

  /**
   * Asynchronously reads the configuration from storage.
   * Always resolves to a complete, valid config and never rejects.
   * @returns {Promise<EHFConfig>}
   */
  const read = async () => {
    try {
      const area = getStorageArea();
      if (!area?.get) return normalize(DEFAULTS);
      const stored = await area.get(DEFAULTS);
      return normalize(stored);
    } catch (err) {
      console.warn('[EHF] Storage read fallback:', err);
      return normalize(DEFAULTS);
    }
  };

  /**
   * Sanitizes and writes a partial configuration to storage.
   * Rejects unrecognized keys and enforces boolean types.
   * @param {Partial<Record<string, unknown>>} patch
   * @returns {Promise<void>}
   */
  const write = async (patch) => {
    if (!patch || typeof patch !== 'object') return;
    const cleanPatch = {};
    for (const key of KEYS) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        const val = patch[key];
        if (typeof val === 'boolean') {
          cleanPatch[key] = val;
        }
      }
    }
    if (Object.keys(cleanPatch).length === 0) return;

    const area = getStorageArea();
    if (area?.set) {
      await area.set(cleanPatch);
    }
  };

  /**
   * Subscribes a listener to configuration changes.
   * Delivers a complete, normalized snapshot on relevant changes.
   * Returns an unsubscribe function to prevent memory leaks.
   * @param {(config: EHFConfig) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  const subscribe = (listener) => {
    if (typeof listener !== 'function') return () => {};

    const storageApi = globalThis.chrome?.storage ?? globalThis.browser?.storage;
    const onChanged = (changes, areaName) => {
      if (areaName !== 'local') return;
      const isRelevant = KEYS.some((key) => Object.prototype.hasOwnProperty.call(changes, key));
      if (!isRelevant) return;

      read().then((config) => {
        try {
          listener(config);
        } catch (err) {
          console.error('[EHF] Error in config listener:', err);
        }
      });
    };

    storageApi?.onChanged?.addListener(onChanged);
    return () => {
      storageApi?.onChanged?.removeListener(onChanged);
    };
  };

  return {
    OPTIONS,
    KEYS,
    DEFAULTS,
    normalize,
    read,
    write,
    subscribe,
  };
})());
