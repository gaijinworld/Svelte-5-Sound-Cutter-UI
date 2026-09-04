# Phase 1B — MP4Splitter-style Web Workspace

## Goal
Remodel the SoundCutter dashboard into the MP4Splitter-inspired two-pane workspace while preserving the existing WaveSurfer component until Phase 1C.

## Implemented in this phase
- New light desktop workspace with waveform/preview area on the left and split table on the right.
- `PlaybackBar.svelte` with play/pause/stop, millisecond time entry, and Add Split Point.
- `SplitPointsTable.svelte` backed by `splitStore.segments`.
- MP3-focused uploader and compact Open MP3 control.
- Staged Start Splitting control; the FFmpeg engine is wired in Phase 1D.

## Desktop layout
- Left: waveform workspace + playback/time/split controls.
- Right: Start / End / Duration table + segment checkboxes + split action.

## Mobile strategy
The CSS grid collapses to one column. Phase 1F/1G performs dedicated mobile/Safari refinement.

## Important transitional note
`WaveformDisplay.svelte` still contains legacy WaveSurfer region behavior in this phase. Phase 1C removes drag-created regions and replaces them with split markers sourced from `splitStore.points`.

## Acceptance criteria
- Opening an MP3 enters the splitter workspace.
- The right table automatically shows the whole-file segment after duration is known.
- Adding a split point from the playback bar updates the table.
- Segment checkboxes map to the splitter selection state.
- No Effects, Region Editor, or Voice Recorder panels are rendered by the main page.

## Verification before merge
```bash
pnpm check
pnpm test
pnpm build
```
