/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2019 alextrv
 * Copyright (c) 2015 erkserkserks
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

function inject () {
  function override() {
    // Override video element canPlayType() function
    HTMLVideoElement.prototype.canPlayType = makeModifiedTypeChecker(HTMLVideoElement.prototype.canPlayType);

    // Override media source extension isTypeSupported() function
    var mse = window.MediaSource;
    // Check for MSE support before use
    if (typeof mse === 'function') {
      mse.isTypeSupported = makeModifiedTypeChecker(mse.isTypeSupported);
    }
  }

  // return a custom MIME type checker that can defer to the original function
  function makeModifiedTypeChecker(origChecker) {
    // Check if a video type is allowed
    return function (type) {
      if (type === undefined) return '';
      // var disallowed_types = [];

      // If video type is in disallowed_types, say we don't support them
      if (localStorage['enhanced-h264ify-block_h264'] === 'true') {
        if (type.indexOf('avc') >= 0) return '';
      }
      if (localStorage['enhanced-h264ify-block_vp8'] === 'true') {
        if (type.indexOf('vp8') >= 0) return '';
      }
      if (localStorage['enhanced-h264ify-block_vp9'] === 'true') {
        if (type.indexOf('vp9') >= 0) return '';
        if (type.indexOf('vp09') >= 0) return '';
      }
      if (localStorage['enhanced-h264ify-block_av1'] === 'true') {
        if (type.indexOf('av01') >= 0) return '';
      }

      if (localStorage['enhanced-h264ify-block_60fps'] === 'true') {
        var match = /framerate=(\d+)/.exec(type);
        if (match && match[1] > 30) return '';
      }

      // Otherwise, ask the browser
      return origChecker.call(this, type);
    };
  }

  override();
}

function useActualVolumeLevel() {

  if (localStorage['enhanced-h264ify-disable_LN'] !== 'true') {
    return;
  }

  var video = document.querySelector('video');
  var config = {attributes: true};

  var onVolumeChange = function(mutationList) {
    var attr = 'aria-valuenow';
    for (var mutation of mutationList) {
      if (mutation.attributeName == attr) {
        // Get current volume level from player's attribute
        // and set the actual volume
        video.volume = mutation.target.attributes[attr].value / 100;
      }
    }
  }

  var volumePanel = document.querySelector('.ytp-volume-panel');
  if (volumePanel) {
    var observer = new MutationObserver(onVolumeChange);
    observer.observe(volumePanel, config);
  }
}
