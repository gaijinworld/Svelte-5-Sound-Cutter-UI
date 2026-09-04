# Phase 2 — Electron Desktop Application

## Goal
Reuse the Web v1 Svelte splitter UI in a secure Electron shell while replacing FFmpeg.wasm with native FFmpeg for large files, faster processing, native file dialogs, and offline desktop operation.

## Architecture
```text
Svelte UI
   |
MediaSplitEngine
   |--------------------------|
BrowserFfmpegEngine      DesktopFfmpegEngine
   |                          |
FFmpeg.wasm                  IPC
                              |
                        Electron main
                              |
                        native FFmpeg
```

The renderer must not receive unrestricted Node.js access.

## Security requirements
Electron BrowserWindow configuration:

```ts
webPreferences: {
  preload: PRELOAD_PATH,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}
```

Expose only narrow, typed IPC functions through `contextBridge`. Do not expose `require`, `process`, `fs`, or `child_process` to the renderer.

## Proposed structure
```text
desktop/
├── main.ts
├── preload.ts
├── ipc/
│   ├── openAudio.ts
│   ├── chooseOutputDirectory.ts
│   └── splitAudio.ts
└── ffmpeg/
    └── nativeFfmpeg.ts
```

## Preload API shape
```ts
contextBridge.exposeInMainWorld('desktopAPI', {
  openAudio: () => ipcRenderer.invoke('audio:open'),
  chooseOutputDirectory: () => ipcRenderer.invoke('audio:choose-output'),
  splitAudio: (request) => ipcRenderer.invoke('audio:split', request),
  cancelSplit: (jobId) => ipcRenderer.invoke('audio:cancel', jobId)
});
```

## Native split command — lossless
```text
ffmpeg -ss START -i input.mp3 -t DURATION -map 0:a:0 -c:a copy -avoid_negative_ts make_zero output.mp3
```

## Native split command — precise
```text
ffmpeg -ss START -i input.mp3 -t DURATION -map 0:a:0 -c:a libmp3lame -q:a 2 output.mp3
```

## Desktop-specific tasks
- Add Electron / Electron-Vite dependencies and regenerate the lockfile locally.
- Add main/preload build targets.
- Implement native Open File and Choose Output Directory dialogs.
- Implement `DesktopFfmpegEngine` behind the existing `MediaSplitEngine` contract.
- Bundle or resolve compatible native FFmpeg/FFprobe binaries with license documentation.
- Stream native FFmpeg progress to the renderer over narrow IPC events.
- Support cancellation by terminating only the active FFmpeg child process.
- Preserve the same split-point, segment selection, filename, Fast/Lossless, and Precise-mode UI.
- Add very-large-file QA beyond browser-memory limits.

## Packaging
### Windows
- x64 package first.
- Confirm SmartScreen/signing strategy before public distribution.
- Validate file paths containing spaces and Japanese characters.

### macOS
- Apple Silicon and Intel/universal strategy.
- Hardened runtime.
- Code signing and notarization before public distribution.

## Acceptance criteria
- Same Svelte splitter workflow as Web v1.
- Renderer has no Node integration.
- Native FFmpeg performs selected segment exports.
- Large files do not need to be copied into WASM memory.
- Native save/open dialogs work.
- Cancellation terminates the active job without killing the app.
- Windows and macOS packaging/documentation are reproducible.

## PR strategy
This phase branch currently records the desktop implementation contract only. Do not add Electron dependencies by hand without regenerating `pnpm-lock.yaml` locally. When Web v1 is merged and verified, implement the Electron shell on this branch (or split Phase 2 into 2A shell/IPC, 2B native FFmpeg, and 2C packaging PRs).
