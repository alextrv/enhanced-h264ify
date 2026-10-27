/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Isolated-world half of the codec bridge. It is the only part of the extension that
 * touches chrome.storage; the page world (src/content/codec-guard.js) cannot call
 * extension APIs and must answer canPlayType()/isTypeSupported() synchronously.
 *
 * The config therefore travels over the one channel both worlds share, as a JSON string:
 *   - `data-ehf-policy` on <html> is the current state, for a guard that boots later;
 *   - the `ehf-policy` event is the notification, for a guard that is already running.
 * Every change writes both, since the attribute must never lag the event: a guard that
 * starts between the two writes reads the new attribute and then applies an identical
 * payload from the event, which is idempotent.
 *
 * Replaces the old localStorage cache, which wrote the user's settings into youtube.com's
 * own storage, was visible to the page, and raced the player because it was filled by an
 * async chrome.storage read that the injected script did not wait for.
 */
(() => {
  const POLICY_ATTRIBUTE = 'data-ehf-policy';
  const POLICY_EVENT = 'ehf-policy';

  const publish = (config) => {
    const payload = JSON.stringify(config);
    document.documentElement?.setAttribute(POLICY_ATTRIBUTE, payload);
    window.dispatchEvent(new CustomEvent(POLICY_EVENT, { detail: payload }));
  };

  EHF.read().then(publish);
  EHF.subscribe(publish);
})();
