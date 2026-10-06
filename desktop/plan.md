# Audio Splitter — Electron Desktop Implementation Plan

Implements [issue #13](https://github.com/gaijinworld/Svelte-5-Sound-Cutter-UI/issues/13)
per the contract in [`docs/phases/02-electron-desktop.md`](../docs/phases/02-electron-desktop.md),
modeled on the proven desktop architecture of
[`telegram-media-downloader-v3`](https://github.com/gaijinworld/telegram-media-downloader-v3)
(`C:\src\telegram-media-downloader-v3\desktop`).

## Decisions (locked with maintainer)

| Decision | Choice |
|---|---|
| FFmpeg binaries | `ffmpeg-static` + `ffprobe-static` npm packages; `asarUnpack` in electron-builder; GPL/LGPL license + NOTICE documented |
| Renderer serving | Loopback HTTP server on `127.0.0.1:<random>` inside the main process (matches reference; identical behavior to web deploy) |
| Package manager | `desktop/` is a **pnpm workspace member** — shared root `pnpm-lock.yaml` (regenerated locally, per issue constraint) |
| First PR scope | **2A + 2B together** (shell/IPC + native engine) → working desktop splitter; Windows x64 only (NSIS + portable). macOS config documented as follow-up needing Apple cert/hardware |

## Architecture — mapped from the reference

```text
telegram-media-downloader-v3                →   Svelte-5-Sound-Cutter-UI
────────────────────────────────────────────────────────────────────────────
desktop/src/main.ts     (window, security)  →   desktop/src/main.ts
desktop/src/preload.ts  (TGMD_* bridges)    →   desktop/src/preload.ts (MP3S_* bridges)
backend-proxy/local-engine (/api/tgmd)      →   /api/mp3s/* (file streaming + job control)
scripts/copy-app-dist.cjs (../build→dist/renderer) → scripts/copy-renderer.cjs (same)
scripts/local-smoke.cjs (playwright _electron)     → scripts/smoke.cjs (same pattern)
electron-builder "build" block in package.json     → same layout, NSIS+portable, --publish never
```

```text
Svelte UI (unchanged)
   │  splitStore / PlaybackBar / WaveformDisplay
   ▼
SplitButton ──► createSplitEngine()          ← new factory
                    │
        ┌───────────┴──────────────┐
BrowserFfmpegEngine      DesktopFfmpegEngine   ← both implement MediaSplitEngine
   (FFmpeg.wasm)                  │  window.MP3S_DESKTOP
                                  ▼
                             preload contextBridge (narrow, typed)
                                  ▼ ipcRenderer.invoke
                             Electron main
                                  ▼
                       native ffmpeg (ffmpeg-static binary)
```

## Directory layout

```text
desktop/
├── package.json              # electron, electron-builder, tsup, playwright-core, typescript
├── tsconfig.json
├── plan.md                   # this file
├── assets/
│   └── icon.png              # 512×512 app icon (task: generate from brand)
├── src/
│   ├── main.ts               # window lifecycle, security, IPC registration
│   ├── preload.ts            # contextBridge → window.MP3S_DESKTOP / MP3S_DESKTOP_ENV
│   ├── server.ts             # loopback static server + /api/mp3s/* endpoints
│   ├── ffmpeg.ts             # binary resolution, spawn, progress parse, cancel
│   └── ipcTypes.ts           # request/response types shared main↔preload↔renderer
├── scripts/
│   ├── copy-renderer.cjs     # ../build → dist/renderer (like copy-app-dist.cjs)
│   └── smoke.cjs             # playwright-core _electron smoke test
├── dist/                     # tsup output (main.js, preload.js, renderer/) — gitignored
└── dist-release/             # electron-builder output — gitignored
```

Renderer-side additions (web app, unchanged UI):

```text
src/lib/media/
├── desktopFfmpegEngine.ts    # NEW — MediaSplitEngine over window.MP3S_DESKTOP
├── createEngine.ts           # NEW — picks desktop vs browser engine
└── browserFfmpegEngine.ts    # unchanged
src/lib/desktop.d.ts          # NEW — window.MP3S_* typing
src/lib/utils/audioFormat.ts  # split codec arg tables → src/lib/media/codecArgs.ts (shared w/ desktop)
```

## Key design: file paths, not file bytes

The whole point of 2B is that **big files never enter renderer/WASM memory for
splitting**. Two paths a file can arrive by:

1. **Native open dialog** — `audio:open` IPC → `dialog.showOpenDialog` → returns
   `{path, name, size}`. The renderer never gets raw bytes for the split; it
   loads the *preview* via a loopback URL.
2. **Drag/drop or file input** — sandboxed renderer `File` objects carry no
   `.path` (Electron ≥32). Preload exposes `pathForFile(file)` implemented with
   `webUtils.getPathForFile` — the blessed API for recovering real paths.

Preview/waveform still needs decoded audio. The main process exposes the chosen
file through the loopback server at `/api/mp3s/source` → renderer does
`wavesurfer.load(url)` / `fetch → decodeAudioData` — streams from disk, no copy
through IPC.

## IPC surface (narrow, typed — no Node leaked)

`preload.ts`:

```ts
import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('MP3S_DESKTOP_ENV', {
  isDesktop: true,
  platform: process.platform,
  version: APP_VERSION // injected via additionalArguments like reference
});

contextBridge.exposeInMainWorld('MP3S_DESKTOP', {
  // native file dialog → { cancelled, path?, name?, size? }
  openAudio: () => ipcRenderer.invoke('mp3s:audio-open'),
  // recover real path of a dropped/picked File (webUtils — no Node in renderer)
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  // URL the renderer can feed WaveSurfer/fetch for preview of a source path
  sourceUrlFor: (path: string) => ipcRenderer.invoke('mp3s:source-url', path),
  // native output dir picker → { cancelled, path? }
  chooseOutputDir: () => ipcRenderer.invoke('mp3s:choose-output-dir'),
  // split one segment on disk → { ok, name, path } — file lands in outDir or job temp
  split: (req: SplitRequest) => ipcRenderer.invoke('mp3s:split', req),
  // stream result bytes back to renderer (for the existing Download/ZIP UI)
  readResult: (path: string) => ipcRenderer.invoke('mp3s:read-result', path),
  cancel: (jobId: string) => ipcRenderer.invoke('mp3s:cancel', jobId),
  revealPath: (path: string) => ipcRenderer.invoke('mp3s:reveal', path),
  onProgress: (cb: (p: { jobId: string; outTimeMs: number; pct?: number }) => void) => {
    const l = (_e, p) => cb(p);
    ipcRenderer.on('mp3s:progress', l);
    return () => ipcRenderer.removeListener('mp3s:progress', l);
  }
});
```

Main-process guards copied from the reference pattern:

```ts
function trustedSender(e: Electron.IpcMainInvokeEvent): boolean {
  return e.sender === mainWindow?.webContents
      && e.senderFrame === mainWindow?.webContents.mainFrame;
}
// every ipcMain.handle(...) checks trustedSender + validates payload types
// + sanitizes file basenames: .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
```

## Loopback server (`server.ts`)

Mirrors `startLocalRendererServer` from the reference — same traversal guard,
same SPA fallback, plus two API routes:

- `GET /api/mp3s/source?token=<nonce>` — streams the registered source file
  (supports `Range` for seeking preview). Path comes only from the server's own
  job registry, never from query-supplied paths.
- `GET /api/mp3s/output/<jobId>/<name>` — streams a produced segment so the
  renderer's existing `Blob → <a download>` + ZIP UI works byte-identical.
- Any `/api/*` miss → `404` JSON (never fall through to `index.html`).

`ffmpeg.ts` — binary resolution:

```ts
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';

function resolveBinary(p: string | null): string {
  if (!p) throw new Error('FFmpeg binary not bundled.');
  // electron-builder asarUnpack puts binaries next to app.asar
  return app.isPackaged ? p.replace('app.asar', 'app.asar.unpacked') : p;
}
```

Lossless/precise arg tables: **extract** `fastEncodingArgs`/`preciseEncodingArgs`
from `src/lib/utils/audioFormat.ts` into `src/lib/media/codecArgs.ts` (pure TS,
no DOM types) so `desktop/` imports the same tables — single source of truth,
covered by existing `audioFormat.test.ts` cases.

## Native split commands (from the contract)

```text
# lossless (stream copy)
ffmpeg -ss START -i INPUT -t DUR -map 0:a:0 -c:a copy -avoid_negative_ts make_zero -y OUT
# precise (re-encode, same-codec tables from codecArgs.ts)
ffmpeg -ss START -i INPUT -t DUR -map 0:a:0 <codecArgs> -y OUT
# progress: add -nostats -progress pipe:1 → parse out_time_ms → mp3s:progress events
# cancel: job registry holds ChildProcess; mp3s:cancel → child.kill('SIGKILL') (win32: taskkill tree)
```

## Renderer integration diff (small, surgical)

```ts
// src/lib/media/createEngine.ts  (NEW)
import type { MediaSplitEngine } from './types';
import { BrowserFfmpegEngine } from './browserFfmpegEngine';
import { DesktopFfmpegEngine } from './desktopFfmpegEngine';

export function createSplitEngine(): MediaSplitEngine {
  return window.MP3S_DESKTOP ? new DesktopFfmpegEngine() : new BrowserFfmpegEngine();
}
```

```ts
// SplitButton.svelte — one-line swap
const engine = createSplitEngine();          // was: new BrowserFfmpegEngine()
```

```ts
// desktopFfmpegEngine.ts — prepare() resolves the real path:
async prepare(file: File) {
  this.inputPath = window.MP3S_DESKTOP!.pathForFile(file) // dropped/picked
    ?? (await openDialogIfNeeded());                     // or via audio:open flow
}
// split() → invoke('mp3s:split', {jobId, inputPath, start, duration, mode, name})
//          → returns {path}; blob = await fetch(`/api/mp3s/output/${jobId}/${name}`).then(r=>r.blob())
```

`AudioUploader.svelte` — when `MP3S_DESKTOP` exists, the browse button calls
`openAudio()` (native dialog); dropped files work unchanged via `pathForFile`.
The `LARGE_FILE_BYTES` confirm can be relaxed on desktop (native = no WASM
memory cliff) — keep the warning but raise the threshold only in desktop mode.

## `desktop/package.json` (modeled on reference)

```jsonc
{
  "name": "audio-splitter-desktop",
  "version": "2026.10.06.01",          // synced from src/lib/version.ts by sync script
  "main": "dist/main.js",
  "private": true,
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build:ts": "tsup src/main.ts src/preload.ts --format cjs --target node20 --out-dir dist --external electron --clean",
    "copy:web": "node ./scripts/copy-renderer.cjs",
    "build": "pnpm typecheck && pnpm build:ts && pnpm copy:web",
    "dev": "pnpm build:ts && electron dist/main.js",
    "package:win": "pnpm build && electron-builder --win nsis --publish never",
    "package:win:portable": "pnpm build && electron-builder --win portable --publish never",
    "package:win:all": "pnpm build && electron-builder --win --publish never",
    "test:smoke": "node scripts/smoke.cjs"
  },
  "devDependencies": { "electron": "^38.x", "electron-builder": "^26.x",
    "tsup": "^8.x", "typescript": "^5.x", "playwright-core": "1.x" },
  "dependencies": { "ffmpeg-static": "^5.x", "ffprobe-static": "^3.x" },
  "build": {
    "appId": "com.gaijinworld.audiosplitter",
    "productName": "Audio Splitter",
    "directories": { "output": "dist-release" },
    "files": ["dist/**/*", "assets/**/*", "package.json"],
    "asarUnpack": ["node_modules/ffmpeg-static/**", "node_modules/ffprobe-static/**"],
    "win": { "icon": "assets/icon.png", "target": ["nsis", "portable"], "signExecutable": false },
    "nsis": {
      "oneClick": false, "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true, "createStartMenuShortcut": true,
      "artifactName": "Audio.Splitter.Setup.${version}.exe"
    },
    "portable": { "artifactName": "Audio.Splitter.${version}.Portable.exe" }
  }
}
```

`pnpm-workspace.yaml` gains:

```yaml
packages:
  - desktop
onlyBuiltDependencies:
  - esbuild
  - electron          # postinstall downloads the binary
  - ffmpeg-static     # postinstall downloads ffmpeg
  - ffprobe-static    # postinstall downloads ffprobe
```

## Renderer build for desktop

`svelte.config.js` already reads `SVELTEKIT_PATHS_BASE` / `SVELTEKIT_PATHS_ASSETS`.
New script in root `package.json`:

```jsonc
"build:desktop": "cross-env SVELTEKIT_PATHS_BASE= SVELTEKIT_PATHS_ASSETS= vite build"
```

→ `build/` with `/`-relative assets, served by the loopback server at root.
`copy-renderer.cjs` mirrors `copy-app-dist.cjs`: `../build → desktop/dist/renderer`,
fatal-with-instructions if missing.

The WP-specific bits degrade gracefully: `MP3SPLITTER_RUNTIME_CONFIG` is absent
→ renderer falls back to defaults; desktop injects `MP3S_DESKTOP_ENV` instead.
Title bar: `Audio Splitter v<version>` with `page-title-updated` →
`event.preventDefault()` (reference pattern) so the SPA's static `<title>`
doesn't clobber the packaged version.

## Smoke test (`scripts/smoke.cjs`, mirrors `local-smoke.cjs`)

`_electron.launch` with `--mp3s-smoke-test` + isolated `userData` (temp dir):

1. Window renders "Gaijin World Audio Splitter" heading.
2. `window.MP3S_DESKTOP_ENV.isDesktop === true`.
3. Loopback server serves `index.html` on `http://127.0.0.1:<port>`.
4. **End-to-end split**: generate a WAV sine via the bundled ffmpeg itself
   (dogfooding), register it as source via the smoke seam
   (`MP3S_SMOKE_INPUT_FILE` env → skips dialog), run `mp3s:split` lossless on
   `[0, 5s)`, assert output file exists on disk and reads back as RIFF.
5. `mp3s:cancel` on a long job → process terminates, app stays alive.
6. Cross-origin fetch to `/api/mp3s/*` with foreign `Origin` → 403
   (reuse the host/origin guard from `serveLocalApi`).

## Release flow (mirrors reference workflow)

`.github/workflows/release-desktop.yml`:

- Trigger: tag `vYYYY.MM.DD.HHMM`
- `windows-latest` → `pnpm install` → `pnpm build` (web) → `pnpm -F audio-splitter-desktop build`
- `electron-builder --win --publish never` → `dist-release/*.exe`
- `softprops/action-gh-release` uploads Setup + Portable + `latest.yml`
- `--publish never` is mandatory (same guardrail as the reference)

## Task checklist

### 2A — shell + IPC
- [ ] `pnpm-workspace.yaml`: add `packages: [desktop]` + `onlyBuiltDependencies` for electron/ffmpeg-static/ffprobe-static; regenerate `pnpm-lock.yaml` locally
- [ ] `desktop/package.json`, `tsconfig.json`, `assets/icon.png`
- [ ] `src/main.ts`: window (contextIsolation/sandbox on, nodeIntegration off), title pin, external-link guard, will-navigate guard
- [ ] `src/server.ts`: loopback static server + traversal guard + `/api/mp3s/source|output` + 404 for unknown `/api/*`
- [ ] `src/preload.ts`: `MP3S_DESKTOP`/`MP3S_DESKTOP_ENV` bridges incl. `webUtils.getPathForFile`
- [ ] `src/ipcTypes.ts` + `trustedSender` + payload validation on every handler
- [ ] `scripts/copy-renderer.cjs`, root `build:desktop` script
- [ ] `src/lib/desktop.d.ts` renderer typing

### 2B — native engine
- [ ] Extract codec arg tables → `src/lib/media/codecArgs.ts` (shared renderer+desktop; tests stay green)
- [ ] `src/ffmpeg.ts`: resolve unpacked binaries, spawn with `-progress pipe:1`, job registry, kill-tree cancel
- [ ] `src/lib/media/desktopFfmpegEngine.ts` + `createEngine.ts`; `SplitButton` swap
- [ ] `AudioUploader`: native open path on desktop + `pathForFile` for drops
- [ ] Progress events → engine `onProgress` → per-part status line
- [ ] Results "Save all to folder…" (`chooseOutputDir` + copy) + `revealPath` on desktop

### 2C — Windows packaging (this PR's config; signing later)
- [ ] electron-builder config (above), `package:win*` scripts
- [ ] `scripts/smoke.cjs` — dev + `--packaged` modes
- [ ] `release-desktop.yml` workflow (tag-driven, `--publish never`, gh-release upload)
- [ ] Docs: `desktop/README.md` (build/run/package), FFmpeg GPL/LGPL `NOTICE`, update `docs/phases/02-electron-desktop.md` status + repo README desktop section

### Deferred
- macOS (hardened runtime, universal/x64+arm64, signing + notarization — needs Apple cert/hardware)
- Windows code signing / SmartScreen strategy decision before public distribution
- Very-large-file QA matrix (>2 GB sources)

## Walkthrough / QA

1. `pnpm install` (root) → `pnpm build` (web) → `pnpm -F audio-splitter-desktop dev` → app window shows splitter UI on loopback URL
2. Drop a large WAV → waveform loads via `/api/mp3s/source` stream (check Network: no multi-GB IPC copy)
3. Add split points → Start splitting (Fast) → parts appear; "Save all to folder" writes to picked dir; `reveal` opens Explorer
4. Precise mode → same flow, re-encoded output
5. Cancel mid-split → job dies, app responsive, partial files stay
6. `pnpm -F audio-splitter-desktop package:win:all` → `dist-release/` has `Audio.Splitter.Setup.<ver>.exe` + `Audio.Splitter.<ver>.Portable.exe`
7. `test:smoke --packaged` passes on the unpacked build
8. Filename edge cases: paths with spaces + Japanese characters (contract requirement)
9. Web build unchanged: `pnpm deploy:localwp` still works; `window.MP3S_DESKTOP` absent → browser engine path untouched

## Risks / watch-items

- **Blocksy-style collisions**: none — desktop renderer is standalone (no WP theme); the `mp3s-*` utilities remain for the WP embed only
- **SmartScreen**: unsigned exes warn — documented in plan; signing deferred to 2C follow-up
- **ffmpeg-static build flags**: package ships full GPL builds — NOTICE + license file in `desktop/` and in the installer payload
- **Antivirus heuristics** on spawned child processes from portable exe — mitigation: keep `files`/asarUnpack layout standard; document in README
- **pnpm workspace + electron-builder quirk**: builder resolves deps from `desktop/package.json`; keep `dependencies` (ffmpeg-static) there, not root
