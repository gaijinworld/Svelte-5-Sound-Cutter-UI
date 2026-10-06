# Audio Splitter — Desktop (Electron)

Electron shell for the SvelteKit audio splitter. Splits run through the
system-native FFmpeg binary bundled via `ffmpeg-static` — large files never
enter WASM memory.

Architecture and rationale: [`desktop/plan.md`](./plan.md) · contract:
[`docs/phases/02-electron-desktop.md`](../docs/phases/02-electron-desktop.md).

## Layout

```
desktop/
├── src/
│   ├── main.ts        # window, security guards, IPC handlers
│   ├── preload.ts     # contextBridge → window.MP3S_DESKTOP / MP3S_DESKTOP_ENV
│   ├── server.ts      # loopback HTTP: static renderer + /api/mp3s/*
│   ├── ffmpeg.ts      # binary resolution, spawn, progress, job registry
│   └── ipcTypes.ts    # re-exports shared contract types
├── scripts/
│   ├── copy-renderer.cjs  # ../build → dist/renderer
│   ├── sync-version.cjs   # package.json version ← src/lib/version.ts
│   ├── smoke.cjs          # playwright-core _electron end-to-end check
│   └── make-icon.cjs      # regenerates assets/icon.png (pure Node)
├── assets/icon.png
├── dist/              # tsup output + copied renderer (gitignored)
└── dist-release/      # electron-builder output (gitignored)
```

## Develop

```bash
pnpm install            # root — installs workspace incl. electron binaries
pnpm build              # web app → ../build (root-relative paths for loopback)
pnpm desktop:dev        # tsup + electron dist/main.js
```

## Package (Windows)

```bash
pnpm build              # web renderer first
pnpm desktop:package    # → dist-release/: Audio.Splitter.Setup.*.exe
                        #                  + Audio.Splitter.*.Portable.exe
                        #                  + latest.yml + .blockmap
```

If packaging fails with `EPERM ... rename win-unpacked.tmp`, an IDE watcher or
AV is holding the extraction dir inside the workspace — use
`pnpm -F audio-splitter-desktop package:win:local`, which builds into a temp
dir and copies the artifacts back. CI is unaffected (fresh machine).

Unsigned builds trigger SmartScreen on first launch — expected until code
signing lands (tracked as a follow-up under issue #13 phase 2C).

## Smoke test

```bash
# dev binary:
pnpm -F audio-splitter-desktop test:smoke
# packaged build (after package:win:all):
node desktop/scripts/smoke.cjs --packaged
```

The smoke test generates its own 2 s WAV fixture with the bundled ffmpeg,
opens it through the IPC smoke seam (`MP3S_SMOKE_INPUT_FILE`), runs a real
lossless split, streams the output back over `/api/mp3s/output/…`, and copies
it to `MP3S_SMOKE_OUTPUT_DIR` via `save-outputs`. It also asserts sandboxing
(no `require`/`process`/`Buffer` in the page), loopback serving, and that a
foreign `Origin` gets 403. A throwaway `userData` dir under the OS temp keeps
the run isolated — the dir is removed afterwards.

## Release flow

Tag `vYYYY.MM.DD.HHMM` → `.github/workflows/release-desktop.yml` builds on
`windows-latest`, runs the packaged smoke test, then uploads
`dist-release/*.exe|blockmap|latest.yml` via `action-gh-release`.
`electron-builder` is always invoked with `--publish never`.

## Security model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Renderer sees only `window.MP3S_DESKTOP` / `MP3S_DESKTOP_ENV` — no Node,
  no `require`, no raw `ipcRenderer`
- IPC handlers validate sender (`webContents` + `mainFrame`) and payload types
- Split inputs are restricted to paths registered by the open dialog or
  `webUtils.getPathForFile` — renderer-supplied arbitrary paths are refused
- `/api/mp3s/*` enforces loopback `Host` + same-origin `Origin`
- `will-navigate`/`setWindowOpenHandler` keep the window on the trusted
  loopback origin; `https:` links open in the OS browser

## Versioning

`desktop/package.json` version is synced from `src/lib/version.ts`
(`APP_VERSION`) by `scripts/sync-version.cjs` — it runs inside `pnpm build`.
Bump `APP_VERSION`; do not edit the package version by hand.
