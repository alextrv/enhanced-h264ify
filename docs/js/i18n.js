/**
 * Internationalization dictionary for enhanced-h264ify landing page.
 * Supports: Spanish (es) & English (en).
 */
const I18N_DATA = {
  es: {
    // Nav
    navFeatures: "Características",
    navHistory: "Historia y Linaje",
    navInstall: "Cómo Instalar",
    navSimulator: "Simulador",
    navFaq: "Preguntas",
    navGithub: "GitHub",
    navDownload: "Descargar .ZIP",

    // Hero
    heroBadge: "Edición 2026 · Manifest V3 · Reescrito por LiebeBlack",
    heroTitle: "Aceleración por Hardware real para YouTube",
    heroSubtitle: "Optimiza la reproducción de vídeo, reduce drásticamente el uso de CPU/GPU, ahorra batería y elimina los micro-tirones forzando códecs ligeros por hardware (H.264 y AAC) en lugar de formatos pesados (AV1, VP9).",
    btnDownload: "Descargar Extensión (.zip)",
    btnInstallGuide: "Guía de Instalación Paso a Paso",
    btnViewGithub: "Ver Código Fuente",
    heroVersionInfo: "Versión v3.2.0 · Archivo ZIP listo para cargar en Chromium",

    // Metrics
    metricCpuTitle: "Hasta -70%",
    metricCpuDesc: "Menor carga en CPU al ver vídeos en 1080p y 4K",
    metricBatteryTitle: "+35%",
    metricBatteryDesc: "Más autonomía de batería en laptops y portátiles",
    metricRamTitle: "~6 KB",
    metricRamDesc: "Consumo de memoria con estricto caché LRU O(1)",
    metricReflowTitle: "0 ms",
    metricReflowDesc: "Cero bloqueos de renderizado (sin layout thrashing)",

    // History & Lineage
    historyTitle: "Linaje del Proyecto e Historia del Fork",
    historySubtitle: "Desde el pionero h264ify en 2015 hasta la reescritura moderna total para Manifest V3 en 2026 por LiebeBlack.",
    
    stage1Badge: "2015 · El Origen",
    stage1Title: "h264ify (erkserkserks)",
    stage1Desc: "El proyecto pionero original. erkserkserks descubrió que interceptar canPlayType e isTypeSupported en el navegador obligaba a YouTube a servir flujos en H.264 (acelerados por hardware en tarjetas gráficas e integradas) en vez del costoso VP8/VP9 decodificado por CPU.",
    
    stage2Badge: "2019 · El Fork Intermedio",
    stage2Title: "enhanced-h264ify (alextrv)",
    stage2Desc: "Añadió mayor granularidad con interruptores individuales para bloquear AV1, Opus y limitar a 60 fps mediante una ventana emergente de opciones en Manifest V2.",
    
    stage3Badge: "2026 · La Reescritura Completa",
    stage3Title: "enhanced-h264ify 2026 (LiebeBlack)",
    stage3Desc: "Mantenedor actual. LiebeBlack tomó el proyecto y reescribió por completo el código para Manifest V3: eliminó librerías obsoletas y dependencias lentas, adaptó la extensión al nuevo DOM de YouTube con componentes Lit 2026, integró el contador de Dislikes, solucionó advertencias de contenido e inactividad, y optimizó el rendimiento con cero forced reflows y caché LRU O(1).",

    // Features
    featuresTitle: "Características y Funciones Principales",
    featuresSubtitle: "Diseñado para máximo rendimiento en hardware de bajos recursos sin perder fidelidad audiovisual.",
    
    feat1Title: "Bloqueo de AV1, VP9 y VP8",
    feat1Desc: "Obliga a YouTube a entregar vídeo codificado en AVC / H.264. Tu tarjeta gráfica o gráfica integrada decodifica el vídeo en hardware sin calentar tu ordenador.",
    
    feat2Title: "Audio AAC de Bajo Consumo",
    feat2Desc: "Bloquea el códec de audio Opus para solicitar streams de audio AAC (MP4A), decodificados nativamente con mínimo impacto en batería.",
    
    feat3Title: "Límite Inteligente a 30 FPS",
    feat3Desc: "Descarta flujos de 60 fps para hardware modesto. Suspende inteligentemente el límite en transmisiones en directo (Live) para no degradar la resolución.",
    
    feat4Title: "Retorno de Dislikes (RYD)",
    feat4Desc: "Restaura la cantidad estimada de «No me gusta» en la barra de acciones de YouTube usando la API de Return YouTube Dislike integrada directamente en los botones Lit.",
    
    feat5Title: "Omitir Pausa por Inactividad",
    feat5Desc: "Confirma de forma automática el cartel de «¿El vídeo se ha pausado? ¿Deseas seguir viendo?» para que tus listas de reproducción no se interrumpan.",
    
    feat6Title: "Bypass de Avisos de Contenido y Edad",
    feat6Desc: "Acepta automáticamente advertencias como «Se recomienda discreción del espectador» en cualquier idioma mediante eventos sintéticos, sin bucles de recarga &rco=1.",
    
    feat7Title: "Neutralizar Normalización y «Volumen Estable»",
    feat7Desc: "Anula la compresión dinámica agresiva de YouTube y la atenuación loudnessDb directamente en el reproductor para escuchar el audio tal como fue masterizado.",
    
    feat8Title: "Máxima Calidad Automática",
    feat8Desc: "Fija el reproductor en la mayor resolución posible al iniciar (1080p Premium, 1440p o 4K) evitando que YouTube baje la calidad arbitrariamente.",

    // Installation Guide
    installTitle: "Guía de Instalación: Cargar Desempaquetada sin Errores",
    installSubtitle: "Instalación en menos de 1 minuto en cualquier navegador basado en Chromium (Chrome, Edge, Brave, Opera, Vivaldi).",
    
    step1Num: "1",
    step1Title: "Descargar el archivo ZIP",
    step1Desc: "Descarga la última versión empaquetada lista para usar.",
    step1Btn: "Descargar enhanced-h264ify.zip",
    
    step2Num: "2",
    step2Title: "Descomprimir en una carpeta permanente",
    step2Desc: "Extrae el archivo .zip en una carpeta donde no vayas a borrarla accidentalmente (por ejemplo: Documentos o Documentos/GitHub). Debe contener manifest.json y las carpetas src, icons y _locales.",
    step2Tip: "Importante: No elimines la carpeta después de instalar, ya que el navegador la lee directamente desde esa ubicación.",

    step3Num: "3",
    step3Title: "Abrir la página de extensiones",
    step3Desc: "Escribe o copia la siguiente dirección en la barra de navegación de tu navegador:",
    copyBtn: "Copiar enlace",
    copiedText: "¡Copiado!",

    step4Num: "4",
    step4Title: "Activar el «Modo de desarrollador»",
    step4Desc: "En la esquina superior derecha de la página de extensiones, enciende el interruptor que dice «Modo de desarrollador» (o «Developer mode»).",

    step5Num: "5",
    step5Title: "Hacer clic en «Cargar descomprimida»",
    step5Desc: "Haz clic en el botón «Cargar descomprimida» (Load unpacked) arriba a la izquierda y selecciona la carpeta donde extrajiste la extensión (la que contiene manifest.json).",
    step5ErrorHelp: "Solución de error común: Si recibes el error «Manifest file is missing», asegúrate de seleccionar la carpeta raíz que contiene directamente a manifest.json y no una subcarpeta vacía.",

    step6Num: "6",
    step6Title: "¡Listo! Fija el icono y disfruta",
    step6Desc: "Aparecerá el icono rojo de enhanced-h264ify en la barra de herramientas de tu navegador. Haz clic en él para abrir la ventana de opciones y configurar tus preferencias.",

    // Simulator
    simTitle: "Simulador Interactivo de Opciones",
    simSubtitle: "Prueba la interfaz real de la extensión aquí mismo. Activa o desactiva interruptores para ver qué efecto tienen en YouTube.",
    simCategoryVideo: "Vídeo",
    simCategoryAudio: "Audio",
    simCategoryPlayback: "Reproducción",
    simCategoryInterface: "Interfaz",
    simFooterAttribution: "enhanced-h264ify · LiebeBlack",

    // FAQ
    faqTitle: "Preguntas Frecuentes (FAQ)",
    faq1Q: "¿Por qué YouTube hace que mi computadora se caliente o consuma mucha batería?",
    faq1A: "Por defecto, YouTube prioriza códecs como AV1 y VP9. En equipos sin tarjetas gráficas modernas con soporte de hardware dedicado para AV1, el procesador (CPU) debe decodificar cada cuadro por software, lo que genera 80-100% de uso de CPU, ventiladores al máximo y drenaje rápido de la batería.",
    
    faq2Q: "¿Por qué instalar la extensión en modo desempaquetado?",
    faq2A: "El modo desempaquetado te brinda acceso directo al código fuente más reciente mantenido por LiebeBlack con Manifest V3, sin telemetría, sin tiempos de espera por revisiones de tiendas de extensiones y con la garantía total de transparencia y privacidad.",

    faq3Q: "¿Cómo se actualiza la extensión cuando haya una nueva versión?",
    faq3A: "Solo tienes que descargar el nuevo .zip desde la sección de Releases, extraer los archivos reemplazando los antiguos en la misma carpeta, y presionar el icono de recargar (🔄) en chrome://extensions. ¡Toda tu configuración se mantendrá intacta!",

    faq4Q: "¿Es compatible con YouTube Shorts, emisiones en directo y vídeos insertados?",
    faq4A: "Sí. Esta versión 2026 de LiebeBlack incluye soporte nativo y reglas especiales para Shorts, Lives (donde desactiva inteligentemente el tope de 30fps para no bajar resolución) y reproductores embebidos.",

    // Footer
    footerDesc: "Optimización de decodificación por hardware para YouTube. Reescritura moderna para Manifest V3 por LiebeBlack.",
    footerLineage: "Linaje: LiebeBlack (2026) · alextrv (2019) · erkserkserks (2015)",
    footerLicense: "Licencia de código abierto MIT.",
    footerScrollTop: "Subir al inicio ↑"
  },

  en: {
    // Nav
    navFeatures: "Features",
    navHistory: "History & Lineage",
    navInstall: "How to Install",
    navSimulator: "Simulator",
    navFaq: "FAQ",
    navGithub: "GitHub",
    navDownload: "Download .ZIP",

    // Hero
    heroBadge: "2026 Edition · Manifest V3 · Rewritten by LiebeBlack",
    heroTitle: "True Hardware Acceleration for YouTube",
    heroSubtitle: "Optimize video playback, dramatically reduce CPU/GPU load, extend battery life, and eliminate micro-stutter by forcing lightweight hardware codecs (H.264 & AAC) instead of heavy software formats (AV1, VP9).",
    btnDownload: "Download Extension (.zip)",
    btnInstallGuide: "Step-by-Step Install Guide",
    btnViewGithub: "View Source Code",
    heroVersionInfo: "Version v3.2.0 · Ready-to-load ZIP archive for Chromium",

    // Metrics
    metricCpuTitle: "Up to -70%",
    metricCpuDesc: "Lower CPU load when streaming 1080p and 4K videos",
    metricBatteryTitle: "+35%",
    metricBatteryDesc: "Extra battery longevity on laptops and portable devices",
    metricRamTitle: "~6 KB",
    metricRamDesc: "Memory footprint with strict O(1) LRU bounded caching",
    metricReflowTitle: "0 ms",
    metricReflowDesc: "Zero UI rendering locks (no layout thrashing)",

    // History & Lineage
    historyTitle: "Project Lineage & Fork History",
    historySubtitle: "From the pioneering h264ify in 2015 to the complete modern Manifest V3 rewrite in 2026 by LiebeBlack.",
    
    stage1Badge: "2015 · The Origin",
    stage1Title: "h264ify (erkserkserks)",
    stage1Desc: "The original pioneer project. erkserkserks discovered that intercepting canPlayType and isTypeSupported inside the browser forced YouTube to serve hardware-accelerated H.264 streams instead of CPU-intensive VP8/VP9 on aging computers.",
    
    stage2Badge: "2019 · The Upstream Fork",
    stage2Title: "enhanced-h264ify (alextrv)",
    stage2Desc: "Added granular control with individual toggles to block AV1, Opus, and cap framerates at 60 fps using a popup settings interface under Manifest V2.",
    
    stage3Badge: "2026 · The Full Rewrite",
    stage3Title: "enhanced-h264ify 2026 (LiebeBlack)",
    stage3Desc: "Current maintainer. LiebeBlack took over the fork and completely rewrote the codebase for Manifest V3: eliminated obsolete libraries and slow dependencies, adapted the extension to modern 2026 YouTube Lit components DOM, integrated Return YouTube Dislikes, automated content and inactivity prompt bypasses, and hardened performance with zero forced reflows and an O(1) LRU cache.",

    // Features
    featuresTitle: "Key Features & Capabilities",
    featuresSubtitle: "Engineered for maximum playback performance on low-spec hardware without sacrificing audiovisual clarity.",
    
    feat1Title: "AV1, VP9 & VP8 Codec Blocking",
    feat1Desc: "Forces YouTube to deliver AVC / H.264 video streams. Your graphics card or integrated GPU handles decoding directly in hardware without heating up your computer.",
    
    feat2Title: "Low-Power AAC Audio",
    feat2Desc: "Blocks CPU-intensive Opus audio codecs to request native AAC (MP4A) streams, decoded with minimal energy consumption.",
    
    feat3Title: "Smart 30 FPS Frame Limiter",
    feat3Desc: "Drops 60 fps streams down to 30 fps for modest systems. Intelligently suspends the limiter during Live streams to prevent resolution downgrades.",
    
    feat4Title: "Return YouTube Dislikes (RYD)",
    feat4Desc: "Restores estimated dislike counts on YouTube video action bars using the Return YouTube Dislike API, seamlessly integrated into modern Lit buttons.",
    
    feat5Title: "Skip Inactivity Pauses",
    feat5Desc: "Automatically confirms the «Video paused. Continue watching?» prompt so your music and playlists play indefinitely without interruption.",
    
    feat6Title: "Content Warning & Age Gate Bypass",
    feat6Desc: "Instantly dismisses «Viewer discretion is advised» prompts in any language using native synthetic event sequences without infinite &rco=1 reload loops.",
    
    feat7Title: "Neutralize Loudness & «Stable Volume»",
    feat7Desc: "Neutralizes YouTube's aggressive backend loudnessDb attenuation and native compression directly on the player to hear audio with true dynamic range.",
    
    feat8Title: "Automatic Maximum Quality",
    feat8Desc: "Locks the video player to the highest resolution available on startup (1080p Premium, 1440p, or 4K), preventing sudden automatic quality drops.",

    // Installation Guide
    installTitle: "Installation Guide: Load Unpacked Without Errors",
    installSubtitle: "Install in less than 1 minute on any Chromium-based browser (Chrome, Edge, Brave, Opera, Vivaldi).",
    
    step1Num: "1",
    step1Title: "Download the ZIP archive",
    step1Desc: "Download the latest pre-packaged release ready for installation.",
    step1Btn: "Download enhanced-h264ify.zip",
    
    step2Num: "2",
    step2Title: "Extract to a permanent folder",
    step2Desc: "Extract the .zip into a directory where it won't be deleted accidentally (e.g. Documents or Documents/GitHub). It must contain manifest.json along with src, icons, and _locales.",
    step2Tip: "Important: Do not delete this folder after loading, as the browser loads the extension directly from this disk path.",

    step3Num: "3",
    step3Title: "Open the Extensions page",
    step3Desc: "Paste or type the following address into your browser URL bar:",
    copyBtn: "Copy Link",
    copiedText: "Copied!",

    step4Num: "4",
    step4Title: "Enable «Developer Mode»",
    step4Desc: "In the top-right corner of the Extensions page, switch ON the toggle labeled «Developer mode».",

    step5Num: "5",
    step5Title: "Click «Load unpacked»",
    step5Desc: "Click the «Load unpacked» button at the top-left and select the extracted folder (the one containing manifest.json).",
    step5ErrorHelp: "Troubleshooting tip: If you get «Manifest file is missing», ensure you select the root folder containing manifest.json directly, not an empty or higher-level folder.",

    step6Num: "6",
    step6Title: "All done! Pin the icon & enjoy",
    step6Desc: "The red enhanced-h264ify icon will appear in your browser toolbar. Click it to open the popup and customize your codec preferences.",

    // Simulator
    simTitle: "Interactive Options Simulator",
    simSubtitle: "Try out the real extension popup interface right here. Flip the switches to explore what each toggle controls on YouTube.",
    simCategoryVideo: "Video",
    simCategoryAudio: "Audio",
    simCategoryPlayback: "Playback",
    simCategoryInterface: "Interface",
    simFooterAttribution: "enhanced-h264ify · LiebeBlack",

    // FAQ
    faqTitle: "Frequently Asked Questions (FAQ)",
    faq1Q: "Why does YouTube cause my computer to overheat or drain battery fast?",
    faq1A: "By default, YouTube prioritizes AV1 and VP9 codecs. On computers without modern dedicated AV1/VP9 hardware decoder chips, your CPU is forced to decode every video frame via software, causing 80-100% CPU usage, noisy fans, and rapid battery depletion.",
    
    faq2Q: "Why should I install the extension as an unpacked folder?",
    faq2A: "Unpacked mode gives you direct, verified access to the latest Manifest V3 build rewritten by LiebeBlack, completely telemetry-free, without weeks of extension store review delays, and with 100% code transparency.",

    faq3Q: "How do I update the extension when a new release is published?",
    faq3A: "Simply download the new .zip from the Releases page, extract and replace the files inside the existing folder, and click the refresh button (🔄) on chrome://extensions. All your settings are retained!",

    faq4Q: "Does it support YouTube Shorts, Live streams, and embedded videos?",
    faq4A: "Yes. This 2026 edition by LiebeBlack includes comprehensive support and dedicated safeguards for Shorts, Live streams (where the 30fps cap is suspended to preserve max resolution), and embedded players.",

    // Footer
    footerDesc: "Hardware-accelerated video decoding optimizer for YouTube. Modern Manifest V3 rewrite by LiebeBlack.",
    footerLineage: "Lineage: LiebeBlack (2026) · alextrv (2019) · erkserkserks (2015)",
    footerLicense: "Open Source under MIT License.",
    footerScrollTop: "Back to top ↑"
  }
};
