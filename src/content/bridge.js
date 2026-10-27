/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Isolated-world bridge connecting extension storage with the page world (codec-guard.js).
 * Publishes configuration changes as a DOM attribute (for startup hydration)
 * and dispatches a CustomEvent (for active runtime updates).
 */
(() => {
  const POLICY_ATTRIBUTE = 'data-ehf-policy';
  const POLICY_EVENT = 'ehf-policy';

  /**
   * Safely writes the policy attribute to document.documentElement,
   * deferring until the element exists if run before root creation.
   * @param {string} payload
   */
  const setAttributeSafe = (payload) => {
    if (document.documentElement) {
      document.documentElement.setAttribute(POLICY_ATTRIBUTE, payload);
    } else {
      const onDocReady = () => {
        document.documentElement?.setAttribute(POLICY_ATTRIBUTE, payload);
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onDocReady, { once: true });
      } else {
        requestAnimationFrame(onDocReady);
      }
    }
  };

  let lastPayload = null;

  /**
   * Publishes the policy across the isolated-world boundary.
   * @param {import('../common/config.js').EHFConfig} config
   */
  const publish = (config) => {
    if (!config || typeof config !== 'object') return;
    try {
      const payload = JSON.stringify(config);
      if (payload === lastPayload) return;
      lastPayload = payload;
      setAttributeSafe(payload);
      window.dispatchEvent(new CustomEvent(POLICY_EVENT, { detail: payload }));
    } catch (err) {
      console.warn('[EHF-Bridge] Publish failed:', err);
    }
  };

  if (globalThis.EHF?.read) {
    globalThis.EHF.read().then(publish).catch((err) => {
      console.warn('[EHF-Bridge] Initial read failed:', err);
    });
    globalThis.EHF.subscribe(publish);
  }
})();
