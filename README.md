# Gaijin World Audio Splitter

Browser-local audio splitter built with SvelteKit (Svelte 5), WaveSurfer.js, and FFmpeg.wasm. Load an audio file, drop ordered split points on the waveform, and export the contiguous segments — losslessly (stream copy) or precisely (re-encode to the same format) — as individual files or a ZIP bundle. No server upload; all processing happens in the browser.

![Audio Splitter app screenshot](./preview.png

## Features
- Open an audio file and see its waveform instantly — MP3, WAV, M4A, AAC, OGG/Opus, FLAC, and WMA (WMA decodes via ffmpeg.wasm for the preview)
- Add ordered split points (button, `S` key, or click); contiguous segments are derived automatically
- Select/edit/delete points with millisecond `H:MM:SS.mmm` precision
- Keyboard workflow: `Space` play/pause, `S` add point, `Delete`/`Backspace` remove, `←`/`→` seek, `Shift+←`/`→` coarse seek
- Enable/disable individual segments before export
- Two cut modes: **Fast/Lossless** (`-c:a copy`, no re-encode) and **Precise** (re-encode to the same codec for tight boundaries). Exports keep the input format — WAV→WAV, M4A→M4A, OGG→OGG…
- Sequential batch export with per-segment progress and cancellation
- Download parts individually (`*_part_001.<ext>` …) or as a ZIP
- Resizable workspace panes, toggleable top/bottom timestamp rulers, cursor-anchored wheel zoom + 25–500% zoom dropdown, synced horizontal scrollbar
- Responsive layout; 250 MB+ input size warning
- Visible version badge (`vYYYY.MM.DD.NN`) in the header and page title

## Privacy and Data Handling
- Audio processing happens locally in the browser.
- No server upload flow is built into this app.
- The FFmpeg.wasm core (`@ffmpeg/core` 0.12.x) is loaded in the browser on first split. WordPress deploys (`pnpm deploy:localwp`, `pnpm package:wpzip`) self-host it — the core files are copied from the `@ffmpeg/core` devDependency into `assets/dist/ffmpeg/` and `VITE_FFMPEG_CORE_BASE_URL` points there, so no third-party CDN is used. Plain `pnpm dev`/`pnpm build` still fall back to `https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm` (see `static/ffmpeg/README.md`).

## Supported Browsers
- Best supported: current desktop Chromium-based browsers
- Expected to work: current Firefox and Safari

## Tooling
- Node.js `22.12.0` or newer
- pnpm `10.21.0`

## Development
```sh
pnpm install
pnpm check
pnpm test
pnpm build
pnpm dev
```

## Usage
1. Open an audio file.
2. Add split points on the waveform or via the playback bar (`S`, or Add Split Point).
3. Edit point times to millisecond precision in the segment table; toggle segments on/off.
4. Choose Fast/Lossless or Precise mode, then Start Splitting.
5. Download each part individually or use Download All ZIP. Parts keep the source format.

## Version and Releases
- Version format: `YYYY.MM.DD.NN` (date + daily increment), e.g. `2026.10.06.01`.
- Single source for the displayed version: `src/lib/version.ts` (`APP_VERSION`). The deployed version may be overridden at runtime by `window.AUDIOSPLITTER_RUNTIME_CONFIG.visibleVersion`, injected by the WordPress plugin.
- On a release bump, keep in sync: `APP_VERSION` in `src/lib/version.ts`, the `<title>` in `src/app.html`, `AUDS_PLUGIN_VERSION` + the `Version:` header in `wordpress/audio-splitter-v1/audio-splitter-v1.php`, and `visibleVersion`/`buildDate` in `wordpress/audio-splitter-v1/runtime-contract.json`.
- Bump work happens on `chore/version-bump-<version>` branches.

## WordPress (LocalWP) Deployment
The app ships as an SPA (`@sveltejs/adapter-static`, `index.html` fallback) embeddable in WordPress via the `audio-splitter-v1` plugin in `wordpress/`:

```sh
pnpm deploy:localwp
```

This builds with `SVELTEKIT_PATHS_BASE=/audio-splitter` (page route) and `SVELTEKIT_PATHS_ASSETS` pointing at the plugin's `assets/dist` URL, then copies the plugin (`audio-splitter-v1.php`, `runtime-contract.json`, `assets/dist/`) into the local site at `%USERPROFILE%\Local Sites\gaijinworld-local\app\public` (override with `LOCALWP_PUBLIC_DIR`, origin override `AUDS_SITE_ORIGIN`). Activating the plugin self-installs the `/audio-splitter/` page containing the `[audio_splitter]` shortcode; the plugin injects `window.AUDIOSPLITTER_RUNTIME_CONFIG` (including `visibleVersion`) into the page.

To package the plugin as a zip for wp-admin upload on a production site:

```sh
pnpm package:wpzip
```

This builds the SPA with `AUDS_SITE_ORIGIN` (default `https://www.gaijinworld.com`) baked into the emitted asset URLs — the zip must be built per-origin since SvelteKit requires absolute asset URLs — stages `audio-splitter-v1/` (PHP + `runtime-contract.json` + `assets/dist/`), and writes `output/audio-splitter.zip` with a SHA256 and version check. Upload via wp-admin → Plugins → Add New → Upload Plugin.

## Desktop App (Electron)
`desktop/` is a pnpm workspace member containing the Electron shell. It serves the web build over a loopback HTTP server, exposes a narrow `window.MP3S_DESKTOP` bridge, and splits with the bundled native `ffmpeg` (`ffmpeg-static`) — so large files never enter WASM memory. See `desktop/README.md` and `desktop/plan.md`.

```sh
pnpm install           # workspace-wide, pulls Electron + FFmpeg binaries
pnpm build             # web renderer (root-relative paths for loopback)
pnpm desktop:dev       # run the app
pnpm desktop:package   # → desktop/dist-release: NSIS installer + portable exe
pnpm desktop:smoke     # headless end-to-end check (dev or --packaged)
```

Unsigned builds show a Windows SmartScreen prompt; code signing is a tracked follow-up.

## Recent Changes
- **2026-10-07** — chore: add `pnpm package:wpzip` production zip packaging (`output/audio-splitter.zip`, per-origin asset URLs); version bump v2026.10.07.02
- **2026-10-07** — chore: rename WordPress plugin/page to `audio-splitter` (`audio-splitter-v1` plugin, `[audio_splitter]` shortcode, `/audio-splitter/` page, `AUDIOSPLITTER_RUNTIME_CONFIG`); version bump v2026.10.07.01
- **2026-10-06** — feat: Electron desktop app — shell, loopback server, native FFmpeg engine, Windows NSIS+portable packaging (#13)
- **2026-10-06** — feat: multi-format audio input (WAV/M4A/AAC/OGG/Opus/FLAC/WMA) + match-input export; renamed to Audio Splitter (#34)
- **2026-10-06** — feat: cursor-anchored wheel zoom + 25–500% dropdown (#33)
- **2026-10-06** — fix: readable ruler timestamps (#32)
- **2026-10-06** — fix: collision-free hide/show utils for WP themes (#28)
- **2026-10-06** — fix(waveform): markers track zoom/scroll + synced scrollbar (#27)
- **2026-10-06** — feat: toggleable timestamp rulers (#26), resizable panes (#25), clickable empty state (#24)
- **2026-10-06** — `fdca18f`-era fixes: waveform fills viewer height (#18), Autoptimize SPA boot + paths.base/assets split (#17), versioned WP title (#16), LocalWP deploy packaging + v2026.10.06.01 (#15)
- **2026-10-06** — `e607a0c` chore: remove legacy Tone/Region/Voice modules and tone dependency (#14)
- **2026-10-06** — `34766ad` Phase 2: define Electron desktop target and native FFmpeg architecture (#9)
- **2026-10-06** — `46f42b7` Phase 1.1: add Fast/Lossless and Precise MP3 cut modes (#8)
- **2026-10-06** — `c2aacf3` Phase 1F/1G: harden responsive UI, QA and split tests (#7)
- **2026-10-06** — `96e4a85` Phase 1E: add batch export, ZIP, progress and cancellation (#6)
- **2026-10-06** — `bef3dcf` Phase 1D: add lossless FFmpeg.wasm split engine (#5)
- **2026-10-06** — `74d2c8d` Phase 1C: replace regions with waveform split markers (#4)
- **2026-10-06** — `4978982` Phase 1B: remodel UI into MP4Splitter-style workspace (#3)
- **2026-10-06** — `8fbe0aa` Phase 1A: add ordered split model and millisecond timecode (#10)
- **2026-10-06** — `405c2e7` docs: establish MP3 Splitter refactor baseline (#1)
- **2026-09-04** — `2f1d4cf` release: prepare public open source repo

## Deployment Note
This repository is a public app source repo, not a published npm package. FFmpeg.wasm's single-threaded core works without cross-origin isolation; if you switch to a multithreaded core, your host must serve the app with:

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

The local Vite dev server already sets these headers.

## Project Files
- `src/lib/components` contains the UI (PlaybackBar, SplitPointsTable, SplitButton, WaveformDisplay, AudioUploader)
- `src/lib/stores` contains app state (`splitStore` owns split points and derived segments)
- `src/lib/media` contains the `MediaSplitEngine` contract, `BrowserFfmpegEngine` (FFmpeg.wasm), and `DesktopFfmpegEngine` (Electron/native)
- `desktop/` contains the Electron app (main/preload/loopback server/native FFmpeg runner) — a pnpm workspace member
- `wordpress/audio-splitter-v1` contains the WordPress plugin wrapper for LocalWP deploys
- `docs/phases` documents the phased refactor (00 → 02)
- `.github/workflows/ci.yml` runs the release checks

## License
- Project license: MIT. See `LICENSE`.
- Third-party dependency licenses: `THIRD_PARTY_LICENSES.md`.
