# enhanced-h264ify (2026 Production Fork)

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success?style=flat-square)](manifest.json)
[![Platform](https://img.shields.io/badge/Platform-Chromium%20111+-blue?style=flat-square)](#requirements)
[![License](https://img.shields.io/badge/License-MIT-orange?style=flat-square)](LICENSE)
[![Target](https://img.shields.io/badge/Focus-Pure%20YouTube-red?style=flat-square)](#how-it-works)

> **FORK LINEAGE / HISTORIAL DE VERSIONES:**
>
> 1. **h264ify** (Original, 2015) — Desarrollado por [erkserkserks](https://github.com/erkserkserks). Bloqueo pionero de VP8/VP9 para forzar decodificación por hardware de H.264.
> 2. **enhanced-h264ify** (Upstream Fork, 2019) — Creado por [alextrv](https://github.com/alextrv). Añadió opciones para bloquear códecs individuales (AV1, Opus, 60fps) e interfaz de configuración.
> 3. **enhanced-h264ify 2026 Edition** (Current Fork, 2026) — Mantenido y mejorado por **LiebeBlack**. Reescritura completa para **Manifest V3**, optimización estricta de rendimiento para hardware de bajos recursos, compatibilidad con el DOM moderno de YouTube (Lit Components 2026), contador de dislikes, bypass de advertencias de contenido y eliminación de dependencias obsoletas.

---

## Overview / Descripción general

**enhanced-h264ify (LiebeBlack Fork)** is an ultra-lightweight, high-performance Chrome/Chromium extension designed to optimize YouTube video playback and reduce CPU/GPU load on low-resource hardware.

By forcing YouTube to serve hardware-accelerated streams (such as H.264 and AAC) instead of computationally expensive software-decoded formats (such as AV1, VP9, or VP8), this extension significantly reduces battery consumption, prevents frame drops, and keeps system temperatures cool.

This fork updates the entire codebase to modern **Manifest V3** standards, focuses **exclusively on official YouTube** (Watch, Shorts, Live, Embeds), and integrates essential quality-of-life playback automations with zero overhead.

---

## Key Features / Características principales

- **Hardware Codec Spoofing**: Block VP8, VP9, AV1, Opus, and MP4A capabilities synchronously on `HTMLMediaElement.prototype.canPlayType` and `MediaSource.isTypeSupported` via `world: MAIN`.
- **60 FPS Video Limiter**: Cap video streams at 30 FPS while automatically suspending the cap on Live Streams so resolution is never downgraded.
- **Return YouTube Dislike**: Restores dislike count estimates non-destructively directly into modern YouTube Lit segmented button view models (`segmented-like-dislike-button-view-model`) via the [Return YouTube Dislike](https://returnyoutubedislike.com) API.
- **Content Warning & Age Gate Bypass**: Automatically dismisses YouTube content warnings ("Viewer discretion is advised" / "Se recomienda la discreción del usuario") across all languages without page reload loops.
- **Inactivity Prompt Auto-Confirmation**: Automatically skips the "Video paused. Continue watching?" prompt during long playback sessions.
- **Audio Loudness Normalization Bypass**: Neutralizes YouTube's backend loudness attenuation (`loudnessDb`) and overrides YouTube's native "Stable Volume" (Volumen estable) dynamic range compression directly on `#movie_player`.
- **Auto-Max Resolution**: Locks the player to the highest available quality level upon startup, with priority for `1080p Premium` (`premium1080`), 1440p, and 4K/8K.
- **Zero Layout Thrashing**: Eliminates `getBoundingClientRect` and forced reflows during cursor movements, ensuring 100% fluid 60fps UI navigation.
- **Strict 200-Item $O(1)$ LRU Caching**: Bounded memory footprint (~6 KB RAM) for instant zero-latency responses without garbage collection pauses.

---

## Options / Configuración disponible

The extension provides 12 independent toggles grouped into 4 clean categories:

| Categoría | Opción | Predeterminado | Función |
| :--- | :--- | :---: | :--- |
| **Vídeo** | Bloquear 60 fps | Desactivado | Rechaza flujos de vídeo con `framerate > 30` (excepto transmisiones en vivo). |
| **Vídeo** | Bloquear H.264 (AVC) | Desactivado | Oculta la capacidad de decodificar H.264. |
| **Vídeo** | Bloquear VP8 | **Activado** | Oculta la capacidad de decodificar VP8. |
| **Vídeo** | Bloquear VP9 | **Activado** | Oculta la capacidad de decodificar VP9. |
| **Vídeo** | Bloquear AV1 | **Activado** | Oculta la capacidad de decodificar AV1 (ahorra alto uso de CPU). |
| **Audio** | Bloquear Opus | **Activado** | Oculta el códec Opus para forzar AAC (MP4A). |
| **Audio** | Bloquear AAC (MP4A) | Desactivado | Oculta AAC. *(Nota: No bloquear Opus y AAC a la vez)*. |
| **Audio** | Desactivar normalización de audio | Desactivado | Neutraliza la compresión de volumen y atenuación de YouTube. |
| **Reproducción** | Máxima resolución al iniciar | Desactivado | Selecciona automáticamente la calidad más alta disponible. |
| **Reproducción** | Omitir pausa por inactividad | Desactivado | Confirma automáticamente el diálogo de confirmación de inactividad. |
| **Reproducción** | Omitir avisos de contenido y edad | Desactivado | Oprime automáticamente el botón de confirmación en advertencias de contenido. |
| **Interfaz** | Mostrar «No me gusta» | Desactivado | Muestra el contador estimado de dislikes en la barra de acciones. |

---

## Architecture & Codebase / Arquitectura del código

```
enhanced-h264ify/
├── manifest.json                  # Manifest V3 configuration (MV3 compliant)
├── options.html                   # Clean, accessible 360px popup UI
├── src/
│   ├── background/
│   │   └── service-worker.js      # Background proxy with 200-item O(1) LRU cache & request dedup
│   ├── common/
│   │   └── config.js              # Shared schema, boolean validation & storage synchronization
│   ├── content/
│   │   ├── bridge.js              # Isolated-world bridge publishing configuration to MAIN world
│   │   ├── codec-guard.js         # Page-world (MAIN) synchronous prototype patcher
│   │   ├── player-control.js      # Page-world (MAIN) player quality & Stable Volume controller
│   │   ├── loudness.js            # Isolated-world volume slider mirroring & mute guard
│   │   ├── playback.js            # Inactivity dialog & content discretion warning bypass
│   │   └── dislikes.js            # Lit-aware non-destructive segmented dislike button injector
│   └── options/
│       ├── options.js             # Options controller with live storage binding
│       └── options.css            # Dark/light theme with GPU-accelerated styling
└── _locales/                      # Multilingual bundles (en, es, cs, ru, uk)
```

---

## Differences from Upstream / Diferencias respecto al upstream

1. **Manifest V3 Pure Architecture**: Updated from legacy Manifest V2 background scripts to a strict event-driven MV3 Service Worker.
2. **Pure YouTube Focus**: Removed discontinued and maintenance-heavy alternative front-end integrations (Invidious, Piped) and eliminated dynamic `scripting` and `optional_host_permissions` for a minimal, clean security profile.
3. **2026 Modern YouTube DOM Compatibility**: Complete overhaul for YouTube's modern Web Components and Lit element hydration (`segmented-like-dislike-button-view-model`, `ytd-enforcement-message-view-model`).
4. **Performance Hardening**:
   - Zero forced reflows (eliminated `getBoundingClientRect` and `offsetWidth` layout thrashing).
   - Fast $O(1)$ tag prefix filtering for MutationObservers.
   - Fast-path container observers that exit in $0.001\text{ ms}$ on mouse hover.
   - Dedicated $O(1)$ LRU Cache capped at 200 items in both background and content scripts.
5. **No Infinite Loops**: Native synthetic mouse sequences on content warnings preventing `&rco=1` router reloads, and protected volume synchronization preventing `volumechange` ping-pong loops.

---

## Requirements & Installation / Requisitos e Instalación

### Requisitos
- **Google Chrome / Chromium / Brave / Edge / Opera 111+**
- Permisos mínimos requeridos: `storage` (para guardar tus preferencias) y `https://returnyoutubedislikeapi.com/*` (para consultar los dislikes si se activa la opción).

### Instalación en modo desarrollador
1. Descarga o clona este repositorio en tu ordenador:
   ```bash
   git clone https://github.com/LiebeBlack/enhanced-h264ify.git
   ```
2. Abre tu navegador Chromium y navega a `chrome://extensions/`.
3. Activa el interruptor **Modo de desarrollador** (Developer mode) en la esquina superior derecha.
4. Haz clic en **Cargar descomprimida** (Load unpacked) y selecciona la carpeta del proyecto.
5. Abre cualquier vídeo en [YouTube](https://www.youtube.com) y configura tus opciones desde el icono de la extensión.

---

## Credits & Attribution / Créditos y Reconocimientos

This project is an open-source derivative work distributed under the **MIT License**:

1. **h264ify** (2015) — Original concept and implementation by [erkserkserks](https://github.com/erkserkserks).
2. **enhanced-h264ify** (2019) — Enhanced options and multi-codec controls by [alextrv](https://github.com/alextrv).
3. **enhanced-h264ify 2026 Edition** (2026) — Manifest V3 rewrite, low-resource hardware performance hardening, 2026 YouTube DOM Lit hydration support, dislike counter restore, content warning bypass, and Spanish localization by **LiebeBlack**.
4. **Return YouTube Dislike** — Dislike estimation data provided by the [Return YouTube Dislike](https://returnyoutubedislike.com) open API under their attribution requirements.

---

## License / Licencia

Released under the [MIT License](LICENSE). Copyright (c) 2015 erkserkserks, 2019 alextrv, 2026 LiebeBlack.
