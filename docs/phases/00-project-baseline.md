# Phase 0 — Project Baseline and Refactor Guardrails

## Goal
Prepare the SoundCutter fork for a staged remodel into **Gaijin World MP3 Splitter — Web** without deleting working functionality prematurely.

## Architectural decision
The product model changes from:

`independent regions + per-region effects`

into:

`ordered split points -> contiguous output segments`

The browser UI remains SvelteKit/Svelte 5 with WaveSurfer.js. Media processing must be isolated behind a future `MediaSplitEngine` interface so the same UI can later run with FFmpeg.wasm in the browser and native FFmpeg in Electron.

## Tasks
- Preserve `main` as the known-good SoundCutter baseline during the staged refactor.
- Use stacked phase branches and draft PRs.
- Keep legacy Effects/Region/Voice Recorder code until the splitter flow is functional.
- Do not couple UI components directly to native Electron or Node APIs.
- Keep browser file processing local; no server upload path.
- Document that Electron work begins only after the web split model and UI are stable.

## Existing capabilities to retain
- Svelte 5 / SvelteKit
- Tailwind CSS
- WaveSurfer.js 7
- FFmpeg.wasm
- `fflate` ZIP support
- MIT project license

## Branch sequence
1. `phase/0-project-baseline`
2. `phase/1a-split-model-timecode`
3. `phase/1b-mp4splitter-layout`
4. `phase/1c-waveform-split-markers`
5. `phase/1d-lossless-ffmpeg-engine`
6. `phase/1e-batch-export`
7. `phase/1fg-responsive-qa-cleanup`
8. `phase/1.1-precise-cut`
9. `phase/2-electron-desktop`

## Acceptance criteria
- Refactor direction and branch strategy are documented.
- No production behavior is removed in this phase.
- Later phases can be reviewed independently as stacked PRs.
