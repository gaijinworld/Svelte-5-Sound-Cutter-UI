# Self-hosted FFmpeg.wasm core

WordPress deploys self-host the FFmpeg.wasm core — no public CDN dependency.

`pnpm deploy:localwp` and `pnpm package:wpzip` copy `ffmpeg-core.js` and
`ffmpeg-core.wasm` from the `@ffmpeg/core` devDependency (`node_modules`) into
`build/ffmpeg/`, which ships inside the plugin's `assets/dist/ffmpeg/`; both
scripts also set `VITE_FFMPEG_CORE_BASE_URL` to the plugin's deployed
`assets/dist/ffmpeg` URL so the app loads the bundled copy.

Plain `pnpm dev` / `pnpm build` (and the desktop build) do not set
`VITE_FFMPEG_CORE_BASE_URL`, so the app falls back to
`https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm` — a development fallback only.

To self-host in a non-WP deployment, place `ffmpeg-core.js` and
`ffmpeg-core.wasm` at a servable path and build with:

```bash
VITE_FFMPEG_CORE_BASE_URL=/ffmpeg
```
