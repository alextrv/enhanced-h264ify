# enhanced-h264ify

> **h264ify** — [erkserkserks](https://github.com/erkserkserks), 2015
> → **enhanced-h264ify** — [alextrv](https://github.com/alextrv), 2019
> → **reescritura Manifest V3, motor de códecs, rediseño de la interfaz y localización** — **LiebeBlack**

A fork of the well-known h264ify extension for Chrome/Firefox which blocks VP8/VP9 codecs on
YouTube, so that you can use H264 only. This may be useful because there are lots of devices on
the market which support H264 hardware decoding and do not support VP8/VP9.

This extension has new features such as manual blocking of H264, VP8, VP9, AV1, Opus, AAC codecs
and 60fps video, plus an option to defeat YouTube's loudness normalization. By default it blocks
everything but H264 and 60fps video. It works only on YouTube.

## Installation

Install for Firefox: https://addons.mozilla.org/en-US/firefox/addon/enhanced-h264ify/

Install for Chrome: https://chrome.google.com/webstore/detail/enhanced-h264ify/omkfmpieigblcllmkgbflkikinpkodlk

## Requirements

- Chrome / Edge / Opera 147+
- Firefox 148+

Nothing else is required: the extension has no host permissions, no background service worker and
no remote dependencies.

## Languages

The interface is localized with the standard `_locales` mechanism, so it follows the browser
language and falls back to English automatically. Bundled: English, Español, Čeština, Русский,
Українська.

`src/options/options.js` goes one step further: `chrome.i18n` follows the *browser UI* language,
which can differ from the language the user browses in, so when `navigator.language` names a
bundled locale that the UI language does not, that locale file is loaded directly and used
instead — with `chrome.i18n`, and then the raw key, as fallbacks.

## How it works

YouTube decides which formats it may fetch by asking the browser what it can decode, so the
extension only has to answer those questions differently. It lives entirely in content scripts:

| File | World | Job |
| --- | --- | --- |
| `src/common/config.js` | both | Option schema, defaults and `chrome.storage` access — the single source of truth |
| `src/content/bridge.js` | isolated | Publishes the stored options to the page world as a JSON string on `<html data-ehf-policy>` and as an `ehf-policy` event |
| `src/content/codec-guard.js` | page (`world: MAIN`) | Precomputes the codec policy and answers `HTMLMediaElement#canPlayType` / `MediaSource#isTypeSupported` from a result cache |
| `src/content/loudness.js` | isolated | Mirrors the volume slider's `aria-valuenow` onto `video.volume` when loudness normalization bypass is enabled |
| `src/options/options.js` + `options.html` + `options.css` | popup | Renders the option list from the same schema the content scripts use |

Because the page world cannot reach `chrome.storage` and must answer capability questions
synchronously, the two worlds share one channel: `<html data-ehf-policy>` carries the current
options for a guard that boots later, and the `ehf-policy` event notifies a guard that is already
running. Every change writes both, so either boot order sees the current configuration and option
changes apply to the next video without a page reload.

## Resource use

| What | Cost |
| --- | --- |
| Codec blocking (always on) | One `chrome.storage` read per page load, one per option change; every capability question after that is answered from a bounded 512-entry cache |
| **Disable loudness normalization — off (default)** | **Nothing at all: no observer is created** |
| Disable loudness normalization — on | Two `MutationObserver`s: one to locate the volume panel (at most one DOM query per frame, and only until the panel exists) and one on the panel filtered to `aria-valuenow` |
| Popup | Only exists while it is open |
| Background | No service worker, no timers, no network requests |

So the loudness normalization bypass is the only optional feature that costs anything, and leaving
it off — the default — is the cheapest state: the extension then runs no observer at all.

## Notable differences from earlier versions

- No `localStorage`: the extension no longer writes the user's settings into youtube.com's own
  storage, where the page could read them.
- No injected `<script>` tags and no `web_accessible_resources`: page-world code is declared with
  `"world": "MAIN"`, so nothing is exposed at a `chrome-extension://` URL.
- No permanent document-wide scans: the volume panel is observed with an attribute filter, panel
  discovery is coalesced to one scan per frame, and observers are disconnected when the feature is
  switched off.
- Side-by-side credits in the interface, in this file and in every source header.

## Credits

1. **h264ify** — original extension by [erkserkserks](https://github.com/erkserkserks), 2015.
2. **enhanced-h264ify** — fork and extra codec options by [alextrv](https://github.com/alextrv), 2019.
3. **Manifest V3 rewrite, codec policy engine, resource and API hardening, Spanish translation and
   interface redesign** — **LiebeBlack**, 2026. Original MIT license and copyright notices are
   preserved.

## Development

Load the directory unpacked (chrome://extensions → Load unpacked, or about:debugging → Load
Temporary Add-on) and open any YouTube video. Changes to content scripts need a page reload;
changes to `manifest.json` need the extension reloaded.
