/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2019 alextrv, 2015 erkserkserks. See LICENSE.
 * Modified and improved by LiebeBlack.
 */

'use strict';

/**
 * Manifest V3 Service Worker (Production 2026).
 * Handles background request proxying for Return YouTube Dislike API with
 * a strict 200-item O(1) LRU cache, safe AbortController timeouts, and request deduplication.
 * Exclusively focused on YouTube (Shorts, Playlists, Live, Watch, Embeds).
 */
importScripts('../common/config.js');

const ext = globalThis.chrome ?? globalThis.browser;
const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/**
 * Strict 200-element O(1) Least Recently Used (LRU) Cache.
 * Memory-efficient: stores strictly essential primitives ({ dislikes, deleted }).
 * 200 items consume ~6 KB of memory, delivering instant zero-latency responses
 * while maintaining a minimal footprint for low-resource devices.
 */
class LRUCache {
  /**
   * @param {number} capacity
   */
  constructor(capacity = 200) {
    this.capacity = capacity;
    this.map = new Map();
  }

  /**
   * @param {string} key
   * @returns {unknown | undefined}
   */
  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    // Refresh recency (move to MRU tail)
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  /**
   * @param {string} key
   * @param {unknown} value
   */
  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Evict oldest entry (LRU head)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, value);
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.map.has(key);
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}

const dislikesCache = new LRUCache(200);
globalThis.dislikesCache = dislikesCache;
globalThis.LRUCache = LRUCache;

/** In-flight request deduplication to prevent duplicate network calls across tabs/Shorts */
const inFlightRequests = new Map();

/**
 * Fetches dislikes from the Return YouTube Dislike API with timeout and deduplication.
 * @param {string} id
 * @returns {Promise<{ success: boolean, data?: { dislikes: number | null, deleted: boolean }, status?: number, error?: string }>}
 */
const fetchDislikesFromNetwork = async (id) => {
  if (inFlightRequests.has(id)) {
    return inFlightRequests.get(id);
  }

  const promise = (async () => {
    const url = `https://returnyoutubedislikeapi.com/votes?videoId=${encodeURIComponent(id)}`;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timerId = 0;

    if (controller) {
      timerId = setTimeout(() => {
        controller.abort();
      }, 3500);
    }

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller?.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          const minimal = { dislikes: null, deleted: true };
          dislikesCache.set(id, minimal);
        }
        return { success: false, status: response.status };
      }

      const raw = await response.json();
      // Store ONLY essential compact fields to save memory
      const minimal = {
        dislikes: typeof raw?.dislikes === 'number' ? raw.dislikes : null,
        deleted: raw?.deleted === true,
      };
      dislikesCache.set(id, minimal);
      return { success: true, data: minimal };
    } catch (err) {
      return { success: false, error: String(err?.message || err) };
    } finally {
      if (timerId) clearTimeout(timerId);
      inFlightRequests.delete(id);
    }
  })();

  inFlightRequests.set(id, promise);
  return promise;
};

if (ext?.runtime) {
  // Message handler: handles background operations (proxying RYD API requests)
  ext.runtime.onMessage?.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    if (message.type === 'FETCH_DISLIKES' && typeof message.videoId === 'string') {
      const id = message.videoId;
      if (!VIDEO_ID_REGEX.test(id)) {
        sendResponse({ success: false, error: 'Invalid videoId' });
        return false;
      }

      // Check worker 200-item LRU cache first to save network and CPU
      if (dislikesCache.has(id)) {
        sendResponse({ success: true, data: dislikesCache.get(id) });
        return false;
      }

      fetchDislikesFromNetwork(id).then(sendResponse);
      return true; // Indicates asynchronous response
    }

    return false;
  });
}
