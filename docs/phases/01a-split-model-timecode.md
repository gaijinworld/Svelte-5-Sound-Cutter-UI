# Phase 1A — Split Model and Millisecond Timecode

## Goal
Replace the future splitter business model with ordered split points that derive contiguous output segments, while keeping legacy region/effect code temporarily available.

## Implemented in this phase
- `SplitPoint` and `SplitSegment` types.
- `splitStore.svelte.ts` as the new single source of truth for split points.
- Millisecond `H:MM:SS.mmm` formatting and parsing utilities.
- Duplicate and boundary rejection using a 5 ms epsilon.
- Segment enable/disable state and selected split-point state.

## Expected behavior
For a 24.192 s file with split points at 6.000 and 16.000 seconds, the derived segments are:

- 0.000 → 6.000
- 6.000 → 16.000
- 16.000 → 24.192

The user never manually creates the three regions.

## Follow-up wiring
Phase 1B consumes `splitStore.segments` in the MP4Splitter-style table. Phase 1C visualizes `splitStore.points` as waveform markers.

## Acceptance criteria
- Split points are maintained in ascending time order.
- Start/end boundaries cannot be inserted as split points.
- Near-duplicate points are rejected.
- Segment duration is always `end - start`.
- Segments default to enabled and can be individually disabled.
- Time utilities support values such as `0:00:06.000`, `0:01:30.250`, and `1:02:03.004`.

## Verification to run before merge
```bash
pnpm check
pnpm test
```

Phase 1G adds dedicated unit coverage for the split derivation and time parser.
