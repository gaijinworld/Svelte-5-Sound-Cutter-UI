# Phase 1D — Lossless Browser FFmpeg Engine

## Goal
Replace SoundCutter's effect-render/re-encode export path with a splitter-oriented engine that writes the source MP3 to FFmpeg.wasm once and stream-copies each selected segment.

## Implemented in this phase
- `MediaSplitEngine` interface for browser/Electron portability.
- `BrowserFfmpegEngine` using the existing FFmpeg.wasm loader.
- Source file is prepared once per split session.
- Segment output uses `-c:a copy` for no re-encoding.
- Deterministic part names such as `song_part_001.mp3`.
- `SplitButton.svelte` now produces downloadable MP3 parts.

## Fast/lossless command shape
```text
ffmpeg -ss START -i source.mp3 -t DURATION -map 0:a:0 -c:a copy -avoid_negative_ts make_zero output.mp3
```

## Accuracy note
MP3 is frame-based. Lossless stream-copy output can land on a nearby MP3 frame boundary rather than an exact arbitrary millisecond. Phase 1.1 adds an optional precise/re-encode mode.

## Engine abstraction
The UI depends on `MediaSplitEngine`, not on Electron APIs. Phase 2 can swap `BrowserFfmpegEngine` for a native-FFmpeg implementation behind the same interface.

## Acceptance criteria
- Source MP3 is written to FFmpeg.wasm once for a split session.
- Selected contiguous segments can be exported without Tone.js or intermediate WAV creation.
- Resulting Blob MIME type is `audio/mpeg`.
- Temporary virtual-FS output files are deleted after reading.
- Cancel/terminate remains part of the engine contract for Phase 1E UI wiring.

## Verification before merge
```bash
pnpm check
pnpm test
pnpm build
```

Manual QA should compare input/output codec and bitrate with FFprobe and confirm that multiple parts play correctly.
