# Phase 1F/1G — Responsive UI, QA, Tests, and Cleanup

## Goal
Harden the Web v1 workflow for mobile/desktop use and move critical split math into testable pure utilities.

## Implemented in this phase
- Responsive header/workspace refinements for narrow screens.
- Desktop keeps the MP4Splitter-style side-by-side workspace; smaller screens stack the split table beneath the waveform.
- Large-file browser-memory warning at 250 MB and above.
- Pure `deriveSegments()` utility extracted from the reactive store.
- Vitest coverage for:
  - contiguous split derivation
  - point ordering
  - enabled-state preservation
  - millisecond time formatting/parsing
  - invalid time inputs

## Browser QA matrix
| Environment | Priority |
| --- | --- |
| Chrome / Windows | P0 |
| Edge / Windows | P0 |
| Safari / macOS | P0 |
| Safari / iPhone | P1 |
| Chrome / Android | P1 |
| Firefox | P1 |

## File-size QA
Exercise representative MP3 inputs around 5 MB, 50 MB, 250 MB, and 500 MB. Record load time, waveform decode time, FFmpeg load time, peak memory observations where available, split time, and whether cancellation remains responsive.

## Legacy cleanup
The live route no longer renders Effects, Region Editor, Regions List, legacy Transport Controls, or Voice Recorder. Physical deletion of all legacy Tone/effects modules plus removal of the `tone` dependency should be done only after a local `pnpm install` regenerates `pnpm-lock.yaml` and the full build/test suite passes. Do not hand-edit the lockfile.

## Acceptance criteria
- The app does not force a two-column desktop layout on mobile.
- Header controls remain usable on narrow screens.
- Large files are not hard-blocked but receive an explicit memory warning.
- Split and timecode core logic has unit coverage.
- `pnpm check`, `pnpm test`, and `pnpm build` pass before this PR is marked ready.

## Manual regression checklist
- Open MP3.
- Seek and add at least two split points.
- Edit/delete a split point.
- Toggle output segment checkboxes.
- Export individual MP3s and ZIP.
- Cancel during a multi-segment export.
- Repeat in mobile Safari and desktop Safari.
