<script lang="ts">
	import AudioUploader from '$lib/components/AudioUploader.svelte';
	import PlaybackBar from '$lib/components/PlaybackBar.svelte';
	import SplitButton from '$lib/components/SplitButton.svelte';
	import SplitPointsTable from '$lib/components/SplitPointsTable.svelte';
	import WaveformDisplay from '$lib/components/WaveformDisplay.svelte';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';
	import { VISIBLE_VERSION } from '$lib/version';

	let waveformDisplay = $state<WaveformDisplay | undefined>(undefined);
	let mainEl = $state<HTMLElement | undefined>(undefined);

	// Resizable workspace: pane height (bottom-edge grip) and sidebar width
	// (vertical divider) are CSS vars consumed by .workspace-grid below lg.
	let paneHeight = $state<number | null>(null);
	let sidebarWidth = $state(360);

	function startPaneResize(mode: 'height' | 'width', event: PointerEvent) {
		event.preventDefault();
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture(event.pointerId);

		const startX = event.clientX;
		const startY = event.clientY;
		const startHeight = paneHeight ?? mainEl?.getBoundingClientRect().height ?? window.innerHeight;
		const startWidth = sidebarWidth;

		const move = (e: PointerEvent) => {
			if (mode === 'height') {
				paneHeight = Math.min(2000, Math.max(320, startHeight + e.clientY - startY));
			} else {
				sidebarWidth = Math.min(640, Math.max(240, startWidth - (e.clientX - startX)));
			}
		};
		const end = () => {
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', end);
			handle.removeEventListener('pointercancel', end);
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', end);
		handle.addEventListener('pointercancel', end);
	}

	function handlePlay() {
		waveformDisplay?.play();
	}

	function handlePause() {
		waveformDisplay?.pause();
	}

	function handleStop() {
		waveformDisplay?.stop();
	}

	function handleSeek(time: number) {
		waveformDisplay?.seekTo(time);
	}

	function handleKeydown(event: KeyboardEvent) {
		const target = event.target;
		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			(target instanceof HTMLElement && target.isContentEditable)
		) {
			return;
		}

		if (!audioStore.file || event.metaKey || event.ctrlKey || event.altKey) return;

		switch (event.code) {
			case 'Space':
				event.preventDefault();
				audioStore.isPlaying ? handlePause() : handlePlay();
				break;
			case 'KeyS':
				event.preventDefault();
				splitStore.add(audioStore.currentTime);
				break;
			case 'Delete':
			case 'Backspace':
				if (splitStore.selectedPointId) {
					event.preventDefault();
					splitStore.remove(splitStore.selectedPointId);
				}
				break;
			case 'ArrowLeft':
				event.preventDefault();
				handleSeek(audioStore.currentTime - (event.shiftKey ? 1 : 0.1));
				break;
			case 'ArrowRight':
				event.preventDefault();
				handleSeek(audioStore.currentTime + (event.shiftKey ? 1 : 0.1));
				break;
		}
	}
</script>

<svelte:head>
	<title>Audio Splitter App v{VISIBLE_VERSION} Live</title>
	<meta
		name="description"
		content="Split audio files locally in your browser using waveform split points."
	/>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-screen overflow-x-hidden bg-[#ececec] text-gray-900">
	<header class="flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-gray-300 bg-white px-3 py-2 shadow-sm sm:px-4">
		<div class="flex min-w-0 items-center gap-3">
			<div class="text-xl" aria-hidden="true">🎵</div>
			<div class="min-w-0">
				<h1 class="truncate text-sm font-semibold leading-tight sm:text-base">
					Gaijin World Audio Splitter<span
						class="ml-2 inline-block rounded bg-gray-100 px-1.5 py-0.5 align-middle font-mono text-[10px] font-normal text-gray-500"
						>v{VISIBLE_VERSION}</span
					>
				</h1>
				<p class="mp3s-hide mp3s-show-sm text-xs text-gray-500">Local browser splitting — no server upload</p>
			</div>
		</div>

		{#if audioStore.file}
			<AudioUploader compact />
		{/if}
	</header>

	{#if audioStore.file}
		<main
			bind:this={mainEl}
			class="workspace-grid grid min-h-[calc(100vh-4rem)] grid-cols-1"
			style={`--pane-h: ${paneHeight !== null ? `${paneHeight}px` : 'calc(100vh - 4rem)'}; --sbw: ${sidebarWidth}px`}
		>
			<section class="flex min-h-[440px] min-w-0 flex-col border-gray-300 bg-[#efefef] lg:min-h-0">
				<div class="min-h-0 flex-1 p-2 sm:p-4">
					<div class="h-full min-h-[300px] rounded border border-gray-300 bg-white p-2 shadow-inner">
						<WaveformDisplay bind:this={waveformDisplay} />
					</div>
				</div>

				<div
					role="separator"
					aria-orientation="horizontal"
					aria-label="Drag to resize waveform height"
					title="Drag to resize waveform height"
					class="mx-auto mb-1 h-1.5 w-24 shrink-0 cursor-row-resize touch-none rounded-full bg-gray-300 transition-colors hover:bg-blue-500/70"
					onpointerdown={(event) => startPaneResize('height', event)}
				></div>

				<PlaybackBar
					onPlay={handlePlay}
					onPause={handlePause}
					onStop={handleStop}
					onSeek={handleSeek}
				/>
			</section>

			<div
				role="separator"
				aria-orientation="vertical"
				aria-label="Drag to resize split-points panel width"
				title="Drag to resize panel width"
				class="mp3s-hide mp3s-show-lg cursor-col-resize touch-none bg-gray-300 transition-colors hover:bg-blue-500/70"
				onpointerdown={(event) => startPaneResize('width', event)}
			></div>

			<aside class="flex min-h-[360px] min-w-0 flex-col border-t border-gray-300 bg-white lg:min-h-0 lg:border-t-0">
				<div class="min-h-0 flex-1">
					<SplitPointsTable />
				</div>
				<div class="border-t border-gray-300 p-3">
					<SplitButton />
				</div>
			</aside>
		</main>
	{:else}
		<main class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center p-4 sm:p-6">
			<div class="w-full">
				<AudioUploader />
				<div class="mt-6 text-center text-sm text-gray-500">
					Open audio → seek → add split points → review segments → start splitting.
				</div>
			</div>
		</main>
	{/if}
</div>

<style>
	/* Desktop two-pane workspace. Pane height (--pane-h) and sidebar width
	   (--sbw) are driven by the resize grips; defaults preserve the
	   full-viewport layout. */
	@media (min-width: 1024px) {
		.workspace-grid {
			height: var(--pane-h, calc(100vh - 4rem));
			min-height: 0;
			grid-template-columns: minmax(0, 1fr) 8px var(--sbw, 360px);
		}
	}
</style>
