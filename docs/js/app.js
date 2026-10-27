/**
 * enhanced-h264ify Landing Page Interactive Scripts
 * Author: LiebeBlack
 */

(function () {
  'use strict';

  // --- Configuration & Constants ---
  const REPO_OWNER = 'LiebeBlack';
  const REPO_NAME = 'enhanced-h264ify';
  const FALLBACK_VERSION = 'v3.2.0';
  const DEFAULT_ZIP_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/enhanced-h264ify.zip`;
  const RELEASES_PAGE_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;

  // Simulator options metadata
  const SIMULATOR_OPTIONS = [
    {
      id: 'block60fps',
      group: 'group-video',
      titleKey: 'optionsBlock60fps',
      defaultValue: false,
      descEs: 'Rechaza flujos con más de 30 fps para duplicar la fluidez en hardware débil. En directos se suspende para no degradar resolución.',
      descEn: 'Discards streams over 30 fps to double UI fluidity on weaker hardware. Automatically suspended during Live streams.'
    },
    {
      id: 'blockH264',
      group: 'group-video',
      titleKey: 'optionsBlockH264',
      defaultValue: false,
      descEs: 'Bloquea H.264 (AVC). Solo para depuración o pruebas de rendimiento.',
      descEn: 'Blocks H.264 (AVC). Intended for debugging or comparative performance benchmarking.'
    },
    {
      id: 'blockVP8',
      group: 'group-video',
      titleKey: 'optionsBlockVP8',
      defaultValue: true,
      descEs: 'Oculta la compatibilidad con VP8 a YouTube para forzar AVC/H.264 acelerado.',
      descEn: 'Hides VP8 capability from YouTube to force hardware-accelerated AVC/H.264.'
    },
    {
      id: 'blockVP9',
      group: 'group-video',
      titleKey: 'optionsBlockVP9',
      defaultValue: true,
      descEs: 'Oculta VP9 para evitar que la CPU decodifique vídeos de alta resolución por software.',
      descEn: 'Hides VP9 to prevent CPU from software-decoding heavy high-res streams.'
    },
    {
      id: 'blockAV1',
      group: 'group-video',
      titleKey: 'optionsBlockAV1',
      defaultValue: true,
      descEs: 'Bloquea AV1, el formato más pesado para el procesador en ordenadores sin GPU moderna.',
      descEn: 'Blocks AV1, the most CPU-demanding codec on computers without recent hardware decoders.'
    },
    {
      id: 'blockOpus',
      group: 'group-audio',
      titleKey: 'optionsBlockOpus',
      defaultValue: true,
      descEs: 'Oculta Opus para forzar AAC por hardware nativo, ahorrando batería al reproducir audio.',
      descEn: 'Hides Opus to force native hardware AAC, saving battery while playing audio.'
    },
    {
      id: 'blockMP4A',
      group: 'group-audio',
      titleKey: 'optionsBlockMP4A',
      defaultValue: false,
      descEs: 'Oculta AAC (MP4A). Nota: No actives bloqueo de Opus y AAC al mismo tiempo.',
      descEn: 'Hides AAC (MP4A). Note: Avoid blocking both Opus and AAC simultaneously.'
    },
    {
      id: 'disableLN',
      group: 'group-audio',
      titleKey: 'optionsDisableLN',
      defaultValue: false,
      descEs: 'Anula la atenuación de ganancia (loudnessDb) y el «Volumen estable» dinámico de YouTube.',
      descEn: 'Disables YouTube loudness attenuation (loudnessDb) and native dynamic "Stable Volume".'
    },
    {
      id: 'autoMaxResolution',
      group: 'group-playback',
      titleKey: 'optionsAutoMaxResolution',
      defaultValue: false,
      descEs: 'Selecciona automáticamente la resolución más alta (1080p Premium, 1440p, 4K) al cargar el vídeo.',
      descEn: 'Automatically selects the highest resolution (1080p Premium, 1440p, 4K) upon video startup.'
    },
    {
      id: 'antiInactivity',
      group: 'group-playback',
      titleKey: 'optionsAntiInactivity',
      defaultValue: false,
      descEs: 'Omite automáticamente la confirmación de pausa por inactividad tras largas horas de reproducción.',
      descEn: 'Automatically bypasses the inactivity pause confirmation during extended playback sessions.'
    },
    {
      id: 'bypassAgeGate',
      group: 'group-playback',
      titleKey: 'optionsBypassAgeGate',
      defaultValue: false,
      descEs: 'Cierra advertencias de «Se recomienda discreción del espectador» al instante sin recargas en bucle.',
      descEn: 'Automatically dismisses «Viewer discretion is advised» prompts instantly without reload loops.'
    },
    {
      id: 'showDislikes',
      group: 'group-interface',
      titleKey: 'optionsShowDislikes',
      defaultValue: false,
      descEs: 'Muestra el contador estimado de «No me gusta» en los botones Lit de YouTube usando Return YouTube Dislike.',
      descEn: 'Displays estimated dislike counts on YouTube Lit buttons using the Return YouTube Dislike API.'
    }
  ];

  const SIM_LABELS = {
    es: {
      optionsBlock60fps: 'Bloquear 60 fps',
      optionsBlockH264: 'Bloquear H.264 (AVC)',
      optionsBlockVP8: 'Bloquear VP8',
      optionsBlockVP9: 'Bloquear VP9',
      optionsBlockAV1: 'Bloquear AV1',
      optionsBlockOpus: 'Bloquear Opus',
      optionsBlockMP4A: 'Bloquear AAC (MP4A)',
      optionsDisableLN: 'Desactivar normalización de audio',
      optionsAutoMaxResolution: 'Máxima resolución al iniciar',
      optionsAntiInactivity: 'Omitir pausa por inactividad',
      optionsBypassAgeGate: 'Omitir avisos de contenido y edad',
      optionsShowDislikes: 'Mostrar «No me gusta»'
    },
    en: {
      optionsBlock60fps: 'Block 60fps',
      optionsBlockH264: 'Block H.264 (AVC)',
      optionsBlockVP8: 'Block VP8',
      optionsBlockVP9: 'Block VP9',
      optionsBlockAV1: 'Block AV1',
      optionsBlockOpus: 'Block Opus',
      optionsBlockMP4A: 'Block AAC (MP4A)',
      optionsDisableLN: 'Disable audio normalization',
      optionsAutoMaxResolution: 'Start at maximum resolution',
      optionsAntiInactivity: 'Skip inactivity pause',
      optionsBypassAgeGate: 'Dismiss content and age warnings',
      optionsShowDislikes: 'Show dislike count'
    }
  };

  // State
  let currentLang = localStorage.getItem('h264ify_lang') || (navigator.language.startsWith('es') ? 'es' : 'en');
  let currentTheme = localStorage.getItem('h264ify_theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  let simulatorState = {};

  // Initialize simulator state with defaults
  SIMULATOR_OPTIONS.forEach(opt => {
    simulatorState[opt.id] = opt.defaultValue;
  });

  // --- Theme Management ---
  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('h264ify_theme', theme);
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
      themeBtn.setAttribute('title', theme === 'dark' ? 'Cambiar a modo claro / Switch to light mode' : 'Cambiar a modo oscuro / Switch to dark mode');
      themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  // --- Internationalization ---
  function applyLanguage(lang) {
    if (!I18N_DATA[lang]) return;
    currentLang = lang;
    localStorage.setItem('h264ify_lang', lang);
    document.documentElement.setAttribute('lang', lang);

    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      langBtn.innerHTML = lang === 'es' ? '🇺🇸 <b>EN</b>' : '🇪🇸 <b>ES</b>';
      langBtn.setAttribute('title', lang === 'es' ? 'Switch to English' : 'Cambiar a Español');
    }

    const dict = I18N_DATA[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    // Update attributes like placeholder, title or html where marked
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (dict[key]) {
        el.innerHTML = dict[key];
      }
    });

    renderSimulator();
  }

  // --- GitHub Releases Live Fetcher ---
  async function fetchLatestRelease() {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      
      const tagName = data.tag_name || FALLBACK_VERSION;
      const zipAsset = (data.assets || []).find(a => a.name.endsWith('.zip'));
      const downloadUrl = zipAsset ? zipAsset.browser_download_url : DEFAULT_ZIP_URL;
      const sizeText = zipAsset ? ` (~${(zipAsset.size / 1024).toFixed(0)} KB)` : '';

      // Update download buttons
      document.querySelectorAll('.btn-download-action').forEach(btn => {
        btn.setAttribute('href', downloadUrl);
      });

      const versionBadge = document.getElementById('release-version-tag');
      if (versionBadge) {
        versionBadge.textContent = `${tagName}${sizeText}`;
      }
    } catch (err) {
      // Graceful fallback
      document.querySelectorAll('.btn-download-action').forEach(btn => {
        btn.setAttribute('href', DEFAULT_ZIP_URL);
      });
      const versionBadge = document.getElementById('release-version-tag');
      if (versionBadge) {
        versionBadge.textContent = FALLBACK_VERSION;
      }
    }
  }

  // --- Browser URL Switcher for Installation Guide ---
  const BROWSER_URLS = {
    chrome: {
      name: 'Google Chrome',
      url: 'chrome://extensions',
      icon: '🌐'
    },
    edge: {
      name: 'Microsoft Edge',
      url: 'edge://extensions',
      icon: '🌊'
    },
    brave: {
      name: 'Brave Browser',
      url: 'brave://extensions',
      icon: '🦁'
    },
    opera: {
      name: 'Opera / Opera GX',
      url: 'opera://extensions',
      icon: '⭕'
    },
    vivaldi: {
      name: 'Vivaldi',
      url: 'vivaldi://extensions',
      icon: '🔴'
    }
  };

  function setupBrowserTabs() {
    const tabsContainer = document.getElementById('browser-tabs');
    const inputUrl = document.getElementById('browser-ext-url');
    const copyBtn = document.getElementById('copy-url-btn');

    if (!tabsContainer || !inputUrl || !copyBtn) return;

    tabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.browser-tab');
      if (!btn) return;
      tabsContainer.querySelectorAll('.browser-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const browserKey = btn.getAttribute('data-browser');
      if (BROWSER_URLS[browserKey]) {
        inputUrl.value = BROWSER_URLS[browserKey].url;
      }
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(inputUrl.value);
        const originalText = copyBtn.innerHTML;
        const dict = I18N_DATA[currentLang];
        copyBtn.innerHTML = `✓ ${dict.copiedText || 'Copiado!'}`;
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        inputUrl.select();
        document.execCommand('copy');
      }
    });
  }

  // --- Interactive Popup Simulator ---
  function renderSimulator() {
    const groups = {
      'group-video': document.getElementById('sim-group-video'),
      'group-audio': document.getElementById('sim-group-audio'),
      'group-playback': document.getElementById('sim-group-playback'),
      'group-interface': document.getElementById('sim-group-interface')
    };

    if (!groups['group-video']) return;

    Object.values(groups).forEach(ul => { if (ul) ul.innerHTML = ''; });

    const labels = SIM_LABELS[currentLang] || SIM_LABELS.es;

    SIMULATOR_OPTIONS.forEach(opt => {
      const targetUl = groups[opt.group];
      if (!targetUl) return;

      const li = document.createElement('li');
      li.className = 'sim-option-row';

      const label = document.createElement('label');
      label.className = 'sim-label';
      label.setAttribute('for', `sim-${opt.id}`);

      const spanText = document.createElement('span');
      spanText.className = 'sim-text';
      spanText.textContent = labels[opt.titleKey] || opt.id;

      const switchWrap = document.createElement('div');
      switchWrap.className = 'sim-switch';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `sim-${opt.id}`;
      input.checked = !!simulatorState[opt.id];

      const slider = document.createElement('span');
      slider.className = 'sim-slider';

      input.addEventListener('change', () => {
        simulatorState[opt.id] = input.checked;
        showSimulatorFeedback(opt, input.checked);
      });

      switchWrap.appendChild(input);
      switchWrap.appendChild(slider);

      label.appendChild(spanText);
      label.appendChild(switchWrap);
      li.appendChild(label);
      targetUl.appendChild(li);
    });
  }

  function showSimulatorFeedback(opt, isChecked) {
    const feedbackBox = document.getElementById('sim-feedback-box');
    if (!feedbackBox) return;

    const labels = SIM_LABELS[currentLang] || SIM_LABELS.es;
    const name = labels[opt.titleKey] || opt.id;
    const desc = currentLang === 'es' ? opt.descEs : opt.descEn;
    const statusText = isChecked 
      ? (currentLang === 'es' ? '🟢 Activado' : '🟢 Enabled') 
      : (currentLang === 'es' ? '⚪ Desactivado' : '⚪ Disabled');

    feedbackBox.innerHTML = `
      <div class="feedback-badge">${statusText}</div>
      <div class="feedback-title">${name}</div>
      <p class="feedback-desc">${desc}</p>
    `;
    feedbackBox.classList.add('highlight');
    setTimeout(() => feedbackBox.classList.remove('highlight'), 600);
  }

  // --- Smooth Scroll & Mobile Nav ---
  function setupNavigation() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    const scrollTopBtn = document.getElementById('scroll-top-btn');
    if (scrollTopBtn) {
      scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  // --- DOM Ready Bootstrapping ---
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentTheme);
    applyLanguage(currentLang);

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
      });
    }

    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        applyLanguage(currentLang === 'es' ? 'en' : 'es');
      });
    }

    setupBrowserTabs();
    setupNavigation();
    fetchLatestRelease();
  });
})();
