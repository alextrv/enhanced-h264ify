/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Popup and options page. Renders whatever `EHF.OPTIONS` declares and writes a key only when its
 * switch changes, so the layout, the saved keys and the player's defaults cannot drift apart.
 *
 * Language resolution, in order:
 *   1. `navigator.language` — chrome.i18n follows the browser UI language, which can differ from
 *      the language the user browses in; when that locale is one we ship, it is loaded directly
 *      (extension pages may fetch their own files, no web_accessible_resources involved).
 *   2. `chrome.i18n.getMessage`, which also falls back to the default locale for a missing key.
 *   3. The raw key, so a missing string is visible instead of an empty label.
 */

const { OPTIONS, read, subscribe, write } = EHF;
const BUNDLED_LOCALES = ['en', 'es', 'cs', 'ru', 'uk'];

const api = () => globalThis.browser ?? globalThis.chrome;
const baseLanguage = (tag) => String(tag ?? '').toLowerCase().split('-')[0];

const inputs = new Map();
let strings = null;

const message = (key) => strings?.[key]?.message || api()?.i18n?.getMessage(key) || key;

const loadStrings = async () => {
  const wanted = baseLanguage(navigator.language);
  const active = baseLanguage(api()?.i18n?.getUILanguage?.());
  if (!wanted || wanted === active || !BUNDLED_LOCALES.includes(wanted)) return { locale: active || wanted, table: null };

  const url = api()?.runtime?.getURL?.(`_locales/${wanted}/messages.json`);
  if (!url) return { locale: active || wanted, table: null };

  try {
    return { locale: wanted, table: await (await fetch(url)).json() };
  } catch {
    return { locale: active, table: null };
  }
};

const renderOption = (container, { key, label }) => {
  const item = container.appendChild(document.createElement('li'));
  const row = item.appendChild(document.createElement('label'));
  row.className = 'row';
  row.htmlFor = key;

  const name = Object.assign(document.createElement('span'), { className: 'name', textContent: message(label) });
  const input = Object.assign(document.createElement('input'), { type: 'checkbox', id: key, className: 'checkbox' });
  const check = Object.assign(document.createElement('span'), { className: 'check' });
  check.setAttribute('aria-hidden', 'true');

  row.append(name, input, check);
  inputs.set(key, input);
};

const render = (config) => {
  for (const [key, input] of inputs) input.checked = config[key] === true;
};

document.body.addEventListener('change', async (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !inputs.has(input.id)) return;

  try {
    await write({ [input.id]: input.checked });
  } catch {
    // The store refused the write (extension just updated or reloaded): show what is actually
    // stored rather than a switch that lies about it.
    render(await read());
  }
});

const init = async () => {
  const { locale, table } = await loadStrings();
  strings = table;
  document.documentElement.lang = locale || 'en';

  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = message(element.dataset.i18n);
  }

  for (const option of OPTIONS) {
    const container = document.getElementById(`group-${option.group}`);
    if (container) renderOption(container, option);
  }

  subscribe(render);
  render(await read());
};

init();
