# Phase 1C — Waveform Split Markers and Keyboard Workflow

## Goal
Replace legacy drag-created WaveSurfer regions with split-point markers driven by `splitStore.points`.

## Implemented in this phase
- Reworked `WaveformDisplay.svelte` without the WaveSurfer Regions plugin.
- Vertical split markers are rendered over the waveform from the split store.
- Clicking a marker selects it.
- Selected split points can be edited with millisecond timecodes or deleted.
- Waveform play, pause, stop, seek, zoom, and current-time synchronization remain available.
- Keyboard workflow:
  - `Space`: play/pause
  - `S`: add split point at playhead
  - `Delete` / `Backspace`: delete selected split point
  - `Left` / `Right`: seek 100 ms
  - `Shift` + `Left` / `Right`: seek 1 second

## Data-flow rule
WaveSurfer is now presentation/playback infrastructure only. It does not own the split model.

`splitStore.points -> waveform markers`

`splitStore.segments -> sidebar table`

## Acceptance criteria
- Dragging on the waveform does not create arbitrary output regions.
- Adding a split point updates both the waveform markers and sidebar-derived segments.
- Selecting/editing/deleting markers preserves contiguous segment derivation.
- Keyboard commands are ignored while typing in text inputs.

## Verification before merge
```bash
pnpm check
pnpm test
pnpm build
```

Manual QA: open an MP3, seek to two positions, press `S` at each, edit one marker, delete the other, and confirm the sidebar segment boundaries update correctly.
