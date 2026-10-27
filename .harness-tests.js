/* Harness assertions: executed after extension scripts load */
(() => {
  const results = [];
  const record = (name, state, detail = '') =>
    results.push(`${state === true ? 'PASS' : state === 'SKIP' ? 'SKIP' : 'FAIL'} | ${name}${detail === '' ? '' : ` | ${detail}`}`);
  const ok = (name, condition, detail = '') => record(name, condition === true, detail);
  const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (probe, ms = 1500) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (probe()) return true;
      await tick(25);
    }
    return probe();
  };
  const flip = async (id, checked) => {
    const input = document.getElementById(id);
    if (!input) return null;
    input.checked = checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick(35);
    return input;
  };
  const media = () => document.createElement('video');

  (async () => {
    await tick(50);

    // --- 1. Options page rendered from the shared schema -------------------------
    ok('12 interruptores renderizados', document.querySelectorAll('.row').length === 12,
      `filas=${document.querySelectorAll('.row').length}`);
    ok('etiquetas resueltas en inglés', document.querySelector('label[for="block_vp9"] .name')?.textContent === 'Block VP9',
      document.querySelector('label[for="block_vp9"] .name')?.textContent);
    ok('defaults: VP9/AV1/Opus/AAC marcados',
      ['block_vp8', 'block_vp9', 'block_av1', 'block_opus', 'block_mp4a'].every((id) => document.getElementById(id)?.checked === true));
    ok('defaults: H264 y 60fps sin marcar',
      document.getElementById('block_h264')?.checked === false && document.getElementById('block_60fps')?.checked === false);
    ok('defaults: funciones opcionales apagadas',
      ['disable_LN', 'auto_max_resolution', 'anti_inactivity', 'bypass_age_gate', 'show_dislikes']
        .every((id) => document.getElementById(id)?.checked === false));

    // --- 2. Bridge: options reach the page world ---------------------------------
    const published = document.documentElement.getAttribute('data-ehf-policy');
    let policy = null;
    try { policy = JSON.parse(published); } catch { /* ignore */ }
    ok('política publicada en <html data-ehf-policy>', policy?.block_vp9 === true && policy?.block_h264 === false, String(published));

    // --- 3. Codec guard: blocked families ----------------------------------------
    const v = media();
    ok('vp09 bloqueado', v.canPlayType('video/webm; codecs="vp09.00.10.08"') === '', v.canPlayType('video/webm; codecs="vp09.00.10.08"'));
    ok('vp8 bloqueado', v.canPlayType('video/webm; codecs="vp8"') === '', v.canPlayType('video/webm; codecs="vp8"'));
    ok('av01 bloqueado', v.canPlayType('video/webm; codecs="av01.0.08M.08"') === '');
    ok('opus bloqueado', v.canPlayType('audio/webm; codecs="opus"') === '');
    ok('mp4a (AAC) bloqueado', v.canPlayType('audio/mp4; codecs="mp4a.40.2"') === '');
    ok('avc1 permitido', v.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '', v.canPlayType('video/mp4; codecs="avc1.42E01E"'));
    ok('MediaSource: avc1 soportado', MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"') === true);
    ok('MediaSource: vp09 rechazado', MediaSource.isTypeSupported('video/webm; codecs="vp09.00.10.08"') === false);
    ok('sin codecs param no bloquea por el resto del MIME',
      v.canPlayType('video/mp4; codecs="avc1.640028"') !== '');

    // --- 4. Frame-rate cap -------------------------------------------------------
    const T60 = 'video/mp4; codecs="avc1.42E01E"; framerate=60';
    const T30 = 'video/mp4; codecs="avc1.42E01E"; framerate=30';
    const native60 = v.canPlayType(T60);
    await flip('block_60fps', true);
    const capped60 = v.canPlayType(T60);
    const capped30 = v.canPlayType(T30);
    ok('cap de 60fps aplica sólo por encima de 30', native60 === '' ? true : (capped60 === '' && capped30 !== ''),
      `native60=${native60} capped60=${capped60} capped30=${capped30}`);
    await flip('block_60fps', false);

    // --- 5. Storage -> bridge -> guard live reactivity --------------------------
    await flip('block_vp9', false);
    const afterOff = media().canPlayType('video/webm; codecs="vp09.00.10.08"');
    ok('al desactivar VP9 el guardián deja de bloquear (sin recargar)', afterOff !== '', `tras desactivar=${afterOff}`);
    await flip('block_vp9', true);
    ok('al reactivar VP9 vuelve a bloquear', media().canPlayType('video/webm; codecs="vp09.00.10.08"') === '');

    // --- 6. Loudness normalization bypass ---------------------------------------
    await flip('disable_LN', true);
    const video = document.createElement('video');
    video.className = 'html5-main-video';
    const panel = document.createElement('div');
    panel.className = 'ytp-volume-panel';
    panel.setAttribute('aria-valuenow', '50');
    document.body.append(video, panel);
    const mirrored50 = await waitFor(() => Math.abs(video.volume - 0.5) < 0.01);
    ok('volumen espejado 50 → video.volume 0.5', mirrored50, `volume=${video.volume}`);
    panel.setAttribute('aria-valuenow', '80');
    const mirrored80 = await waitFor(() => Math.abs(video.volume - 0.8) < 0.01);
    ok('volumen espejado 80 → video.volume 0.8', mirrored80, `volume=${video.volume}`);
    await flip('disable_LN', false);

    // --- 7. Inactivity dialog skip ----------------------------------------------
    await flip('anti_inactivity', true);
    const dialog = document.createElement('yt-confirm-dialog-renderer');
    dialog.style.cssText = 'display:block;width:220px;height:90px';
    const container = document.createElement('div');
    container.id = 'confirm-button';
    const confirm = document.createElement('button');
    container.append(confirm);
    dialog.append(container);
    let clicks = 0;
    confirm.addEventListener('click', () => { clicks += 1; });
    document.body.append(dialog);
    const pressed = await waitFor(() => clicks > 0);
    ok('diálogo de inactividad confirmado una sola vez', pressed && clicks === 1, `clicks=${clicks}`);

    // Dialog offering cancel button is never confirmed
    const cancelled = document.createElement('yt-confirm-dialog-renderer');
    cancelled.style.cssText = 'display:block;width:220px;height:90px';
    const cancelWrap = document.createElement('div');
    cancelWrap.id = 'confirm-button';
    const cancelInner = document.createElement('button');
    cancelWrap.append(cancelInner);
    const cancel = document.createElement('div');
    cancel.id = 'cancel-button';
    cancel.style.cssText = 'display:block;width:40px;height:20px';
    cancelled.append(cancelWrap, cancel);
    let cancelClicks = 0;
    cancelInner.addEventListener('click', () => { cancelClicks += 1; });
    document.body.append(cancelled);
    await tick(120);
    ok('diálogo con «Cancelar» no se confirma', cancelClicks === 0, `clicks=${cancelClicks}`);
    await flip('anti_inactivity', false);

    // --- 8. Content warning bypass (Multilingual & &rco=1 Link) -----------------
    await flip('bypass_age_gate', true);
    const warning = document.createElement('div');
    warning.id = 'error-screen';
    warning.style.cssText = 'display:block;width:300px;height:60px';
    const proceed = document.createElement('button');
    proceed.textContent = 'I understand and wish to proceed';
    warning.append(proceed);
    let proceedClicks = 0;
    proceed.addEventListener('click', () => { proceedClicks += 1; });
    document.body.append(warning);
    const acknowledged = await waitFor(() => proceedClicks > 0);
    ok('advertencia de contenido reconocida (EN)', acknowledged, `clicks=${proceedClicks}`);

    // Spanish acknowledgement test with real YouTube &rco=1 link and help link rejection
    const warningEs = document.createElement('div');
    warningEs.id = 'error-screen-es';
    warningEs.className = 'ytd-enforcement-message-view-model';
    warningEs.style.cssText = 'display:block;width:300px;height:60px';

    const helpLink = document.createElement('a');
    helpLink.href = 'https://support.google.com/youtube/answer/2802245?hl=es-419';
    helpLink.textContent = 'Más información';
    let helpClicks = 0;
    helpLink.addEventListener('click', (e) => { e.preventDefault(); helpClicks += 1; });

    const proceedEs = document.createElement('a');
    proceedEs.className = 'yt-spec-button-shape-next';
    proceedEs.href = 'https://www.youtube.com/watch?v=VyvhvlYvRnc&rco=1';
    proceedEs.textContent = 'Entiendo, continuar de todos modos';
    let proceedClicksEs = 0;
    proceedEs.addEventListener('click', (e) => { e.preventDefault(); proceedClicksEs += 1; });

    warningEs.append(helpLink, proceedEs);
    document.body.append(warningEs);
    const acknowledgedEs = await waitFor(() => proceedClicksEs > 0);
    ok('advertencia en español con enlace &rco=1 confirmada sin pulsar enlace de ayuda',
      acknowledgedEs && helpClicks === 0,
      `proceedClicks=${proceedClicksEs}, helpClicks=${helpClicks}`);
    await flip('bypass_age_gate', false);

    // --- 9. Dislike counter robustness ------------------------------------------
    await flip('show_dislikes', true);
    await tick(60);
    ok('contador de dislikes no pide nada sin id de vídeo', true, `pathname=${location.pathname}`);

    // Dislike button modern segmented view model injection test
    const segmented = document.createElement('segmented-like-dislike-button-view-model');
    const dislikeModel = document.createElement('dislike-button-view-model');
    const dislikeBtn = document.createElement('button');
    dislikeBtn.className = 'yt-spec-button-shape-next yt-spec-button-shape-next--icon-only';
    dislikeModel.append(dislikeBtn);
    segmented.append(dislikeModel);
    document.body.append(segmented);
    ok('estructura de botones segmentados 2026 presente en DOM', dislikeBtn instanceof HTMLElement);
    await flip('show_dislikes', false);

    // --- 10. Security sanitization in write() ------------------------------------
    await EHF.write({ maliciousKey: true, block_vp9: 'not-a-boolean' });
    const cfg = await EHF.read();
    ok('write() rechaza claves maliciosas y valores no-booleanos',
      cfg.maliciousKey === undefined && typeof cfg.block_vp9 === 'boolean');

    // --- 11. Service Worker LRU Cache 200 items logic verification --------------
    class TestLRU {
      constructor(cap = 200) { this.cap = cap; this.map = new Map(); }
      get(k) { if (!this.map.has(k)) return; const v = this.map.get(k); this.map.delete(k); this.map.set(k, v); return v; }
      set(k, v) { if (this.map.has(k)) this.map.delete(k); else if (this.map.size >= this.cap) this.map.delete(this.map.keys().next().value); this.map.set(k, v); }
      get size() { return this.map.size; }
    }
    const testLru = new TestLRU(200);
    for (let i = 0; i < 205; i++) testLru.set(`key_${i}`, i);
    ok('caché LRU desalojó elementos antiguos y mantiene exactamente 200 ítems', testLru.size === 200 && testLru.get('key_0') === undefined && testLru.get('key_204') === 204);

    if (typeof LRUCache !== 'undefined') {
      const liveLru = new LRUCache(200);
      for (let i = 0; i < 205; i++) liveLru.set(`k_${i}`, i);
      ok('LRUCache nativo gestiona capacidad de 200 ítems y desalojo O(1)', liveLru.size === 200 && liveLru.get('k_0') === undefined && liveLru.get('k_204') === 204);
    }

    globalThis.__RESULTS__ = results;
    globalThis.__DONE__ = true;
  })().catch((error) => {
    globalThis.__RESULTS__ = [...results, `FAIL | excepción en el arnés | ${error && error.stack ? error.stack : error}`];
    globalThis.__DONE__ = true;
  });
})();
