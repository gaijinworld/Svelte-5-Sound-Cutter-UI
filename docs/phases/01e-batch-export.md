# Phase 1E — Batch Export, ZIP, Progress, Cancellation, and FFmpeg Hosting

## Goal
Turn the lossless engine into a usable multi-segment export workflow.

## Implemented in this phase
- Sequential processing of all enabled segments.
- Coarse per-segment progress reporting.
- Cancel action backed by `FFmpeg.terminate()` through `MediaSplitEngine.cancel()`.
- Completed parts remain downloadable after cancellation.
- Individual MP3 downloads.
- `fflate` ZIP generation with no additional compression (`level: 0`) for already-compressed MP3 data.
- Configurable FFmpeg core base URL through `VITE_FFMPEG_CORE_BASE_URL`.
- `static/ffmpeg/README.md` deployment instructions for self-hosting the FFmpeg core assets.

## Processing sequence
1. Load FFmpeg.wasm.
2. Write source MP3 once.
3. Process enabled segments sequentially.
4. Read each output and expose a Blob URL.
5. Delete temporary output files.
6. Delete source from virtual FS when finished.

## Self-hosting
Production should provide `ffmpeg-core.js` and `ffmpeg-core.wasm` under `/ffmpeg` and set:

```bash
VITE_FFMPEG_CORE_BASE_URL=/ffmpeg
```

The existing unpkg URL remains a development fallback until deployment supplies the binary assets.

## Acceptance criteria
- Disabled segments are not exported.
- Progress reaches 100% after all selected segments complete.
- User can cancel an active session.
- Multiple completed outputs can be downloaded as one ZIP.
- Object URLs are revoked when results are replaced or the component is destroyed.
- Production can point the app at a self-hosted FFmpeg core without source changes.

## Verification before merge
```bash
pnpm check
pnpm test
pnpm build
```

Manual QA should test one segment, three segments, cancellation during processing, and ZIP download.
