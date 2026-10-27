/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Options and popup controller (Production 2026 - Pure YouTube Edition).
 * Binds UI inputs to the shared EHF configuration schema.
 * Fast, lightweight, zero extraneous operations.
 */
(() => {
  const { OPTIONS, read, subscribe, write } = globalThis.EHF;
  const BUNDLED_LOCALES = ['en', 'es', 'cs', 'ru', 'uk'];

  const baseLanguage = (tag) => String(tag ?? '').toLowerCase().split('-')[0];

  const inputs = new Map();
  let strings = null;

  /**
   * Resolves a localized string from the loaded locale dictionary,
   * falling back to chrome.i18n.getMessage or the key itself.
   * @param {string} key
   * @returns {string}
   */
  const message = (key) =>
    strings?.[key]?.message ||
    globalThis.chrome?.i18n?.getMessage(key) ||
    globalThis.browser?.i18n?.getMessage(key) ||
    key;

  /**
   * Loads localized message bundles matching navigator.language if shipped.
   * @returns {Promise<{ locale: string, table: Record<string, { message: string }> | null }>}
   */
  const loadStrings = async () => {
    const wanted = baseLanguage(navigator.language);
    const ext = globalThis.chrome ?? globalThis.browser;
    const active = baseLanguage(ext?.i18n?.getUILanguage?.());

    if (!wanted || wanted === active || !BUNDLED_LOCALES.includes(wanted)) {
      return { locale: active || wanted || 'en', table: null };
    }

    const url = ext?.runtime?.getURL?.(`_locales/${wanted}/messages.json`);
    if (!url) return { locale: active || wanted, table: null };

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const table = await response.json();
      return { locale: wanted, table };
    } catch {
      return { locale: active || 'en', table: null };
    }
  };

  /**
   * Dynamically constructs an option switch row.
   * @param {HTMLElement} container
   * @param {import('../common/config.js').OptionDefinition} option
   */
  const renderOption = (container, { key, label }) => {
    const item = container.appendChild(document.createElement('li'));
    const row = item.appendChild(document.createElement('label'));
    row.className = 'row';
    row.htmlFor = key;

    const name = Object.assign(document.createElement('span'), {
      className: 'name',
      textContent: message(label),
    });
    const input = Object.assign(document.createElement('input'), {
      type: 'checkbox',
      id: key,
      className: 'checkbox',
    });
    const check = Object.assign(document.createElement('span'), {
      className: 'check',
    });
    check.setAttribute('aria-hidden', 'true');

    row.append(name, input, check);
    inputs.set(key, input);
  };

  /**
   * Updates checkbox states to mirror the configuration snapshot.
   * @param {Record<string, boolean>} config
   */
  const render = (config) => {
    if (!config) return;
    for (const [key, input] of inputs) {
      input.checked = config[key] === true;
    }
  };

  document.body.addEventListener('change', async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !inputs.has(input.id)) return;

    try {
      await write({ [input.id]: input.checked });
    } catch {
      // Revert UI to match actual storage if write fails
      render(await read());
    }
  });

  const init = async () => {
    try {
      const { locale, table } = await loadStrings();
      strings = table;
      document.documentElement.lang = locale || 'en';

      for (const element of document.querySelectorAll('[data-i18n]')) {
        const key = element.getAttribute('data-i18n');
        if (key) element.textContent = message(key);
      }

      for (const option of OPTIONS) {
        const container = document.getElementById(`group-${option.group}`);
        if (container) renderOption(container, option);
      }

      const config = await read();
      subscribe(render);
      render(config);
    } catch (err) {
      console.error('[EHF-Options] Initialization error:', err);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
