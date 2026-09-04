# Desktop target (Phase 2)

This directory is reserved for the Electron desktop target of **Gaijin World MP3 Splitter**.

Implementation begins after the Web v1 stacked PRs are merged and validated.

Key rule: reuse the Svelte UI and `MediaSplitEngine` contract; do not fork the product into a separate desktop UI.

Planned responsibilities:

- Electron main process: app lifecycle, native dialogs, native FFmpeg child processes.
- Preload: narrow typed `contextBridge` API only.
- Renderer: existing Svelte splitter UI with no direct Node access.
- Desktop engine: adapter from the shared `MediaSplitEngine` contract to IPC/native FFmpeg.

See `docs/phases/02-electron-desktop.md` for the full architecture, security requirements, command shapes, packaging tasks, and acceptance criteria.
