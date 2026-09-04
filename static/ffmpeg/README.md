# Self-hosted FFmpeg.wasm core

Production deployments should self-host the FFmpeg core instead of depending on a public CDN.

Copy the matching `@ffmpeg/core` 0.12.6 ESM assets into this directory:

- `ffmpeg-core.js`
- `ffmpeg-core.wasm`

Then configure the build/runtime environment:

```bash
VITE_FFMPEG_CORE_BASE_URL=/ffmpeg
```

The application retains the current unpkg URL as a development fallback until these binary assets are supplied by the deployment pipeline.

Do not commit third-party binaries without confirming their license/redistribution requirements and updating `THIRD_PARTY_LICENSES.md` as needed.
