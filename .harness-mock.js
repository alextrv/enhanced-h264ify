/* Harness only: a minimal, realistic chrome.* mock for static browser testing */
globalThis.chrome = (() => {
  const table = {
    "extensionDescription": { "message": "Choose what video and audio codecs YouTube should play for you", "description": "Extension description" },
    "optionsTitlePlayback": { "message": "Playback" },
    "optionsAutoMaxResolution": { "message": "Start at maximum resolution" },
    "optionsAntiInactivity": { "message": "Skip inactivity pause" },
    "optionsBypassAgeGate": { "message": "Dismiss content and age warnings" },
    "optionsTitleInterface": { "message": "Interface" },
    "optionsShowDislikes": { "message": "Show dislike count" },
    "optionsTitle": { "message": "enhanced-h264ify" },
    "optionsBlock60fps": { "message": "Block 60fps" },
    "optionsBlockH264": { "message": "Block H.264 (AVC)" },
    "optionsBlockVP8": { "message": "Block VP8" },
    "optionsBlockVP9": { "message": "Block VP9" },
    "optionsBlockAV1": { "message": "Block AV1" },
    "optionsBlockOpus": { "message": "Block Opus" },
    "optionsBlockMP4A": { "message": "Block AAC (MP4A)" },
    "optionsDisableLN": { "message": "Disable audio normalization" },
    "optionsTitleVideo": { "message": "Video" },
    "optionsTitleAudio": { "message": "Audio" },
    "attributionUpstream": { "message": "enhanced-h264ify (erkserkserks, alextrv, LiebeBlack)", "description": "Upstream authors" },
    "attribution": { "message": "enhanced-h264ify · LiebeBlack", "description": "Credit line shown in the popup footer" }
  };

  const store = Object.create(null);
  const storageListeners = [];
  const messageListeners = [];
  const installedListeners = [];
  const startupListeners = [];

  return {
    storage: {
      local: {
        get: async (defaults) => {
          if (typeof defaults === 'string') {
            return { [defaults]: store[defaults] };
          }
          if (Array.isArray(defaults)) {
            const out = {};
            for (const k of defaults) out[k] = store[k];
            return out;
          }
          return { ...defaults, ...store };
        },
        set: async (patch) => {
          const changes = {};
          for (const [key, value] of Object.entries(patch)) {
            if (store[key] !== value) {
              changes[key] = { oldValue: store[key], newValue: value };
              store[key] = value;
            }
          }
          if (Object.keys(changes).length) {
            for (const listener of storageListeners) {
              try {
                listener(changes, 'local');
              } catch (e) {
                console.error(e);
              }
            }
          }
        },
      },
      onChanged: {
        addListener: (listener) => storageListeners.push(listener),
        removeListener: (listener) => {
          const idx = storageListeners.indexOf(listener);
          if (idx >= 0) storageListeners.splice(idx, 1);
        },
      },
    },
    i18n: {
      getMessage: (key) => table[key]?.message ?? '',
      getUILanguage: () => 'en-US',
    },
    runtime: {
      getURL: (path) => `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(table))}`,
      onInstalled: { addListener: (cb) => installedListeners.push(cb) },
      onStartup: { addListener: (cb) => startupListeners.push(cb) },
      onMessage: {
        addListener: (cb) => messageListeners.push(cb),
        removeListener: (cb) => {
          const idx = messageListeners.indexOf(cb);
          if (idx >= 0) messageListeners.splice(idx, 1);
        },
      },
      sendMessage: (msg, callback) => {
        let responded = false;
        const sendResponse = (data) => {
          if (responded) return;
          responded = true;
          if (callback) callback(data);
        };
        for (const listener of messageListeners) {
          const asyncResult = listener(msg, {}, sendResponse);
          if (asyncResult === true) return;
        }
        if (!responded && callback) {
          if (msg?.type === 'FETCH_DISLIKES') {
            callback({ success: true, data: { dislikes: 1234, deleted: false } });
          }
        }
      },
    },
    __store: store,
    __installedListeners: installedListeners,
    __startupListeners: startupListeners,
  };
})();
