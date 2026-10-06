<script lang="ts">
	import AudioUploader from '$lib/components/AudioUploader.svelte';
	import PlaybackBar from '$lib/components/PlaybackBar.svelte';
	import SplitButton from '$lib/components/SplitButton.svelte';
	import SplitPointsTable from '$lib/components/SplitPointsTable.svelte';
	import WaveformDisplay from '$lib/components/WaveformDisplay.svelte';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';

	let waveformDisplay: WaveformDisplay;

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
	<title>Gaijin World MP3 Splitter</title>
	<meta
		name="description"
		content="Split MP3 files locally in your browser using waveform split points."
	/>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-screen overflow-x-hidden bg-[#ececec] text-gray-900">
	<header class="flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-gray-300 bg-white px-3 py-2 shadow-sm sm:px-4">
		<div class="flex min-w-0 items-center gap-3">
			<div class="text-xl" aria-hidden="true">🎵</div>
			<div class="min-w-0">
				<h1 class="truncate text-sm font-semibold leading-tight sm:text-base">Gaijin World MP3 Splitter</h1>
				<p class="hidden text-xs text-gray-500 sm:block">Local browser splitting — no server upload</p>
			</div>
		</div>

		{#if audioStore.file}
			<AudioUploader compact />
		{/if}
	</header>

	{#if audioStore.file}
		<main class="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:h-[calc(100vh-4rem)] lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px]">
			<section class="flex min-h-[440px] min-w-0 flex-col border-gray-300 bg-[#efefef] lg:min-h-0 lg:border-r">
				<div class="min-h-0 flex-1 p-2 sm:p-4">
					<div class="h-full min-h-[300px] rounded border border-gray-300 bg-white p-2 shadow-inner">
						<WaveformDisplay bind:this={waveformDisplay} />
					</div>
				</div>

				<PlaybackBar
					onPlay={handlePlay}
					onPause={handlePause}
					onStop={handleStop}
					onSeek={handleSeek}
				/>
			</section>

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
					Open MP3 → seek → add split points → review segments → start splitting.
				</div>
			</div>
		</main>
	{/if}
</div>
