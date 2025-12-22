<script lang="ts">
	import AudioUploader from '$lib/components/AudioUploader.svelte';
	import WaveformDisplay from '$lib/components/WaveformDisplay.svelte';
	import TransportControls from '$lib/components/TransportControls.svelte';
	import RegionsList from '$lib/components/RegionsList.svelte';
	import RegionEditor from '$lib/components/RegionEditor.svelte';
	import EffectsPanel from '$lib/components/EffectsPanel.svelte';
	import ExportPanel from '$lib/components/ExportPanel.svelte';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { regionsStore } from '$lib/stores/regionsStore.svelte';

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

	function handlePlayRegion(id: string) {
		waveformDisplay?.playRegion(id);
	}

	function handlePlaySelectedRegion() {
		if (regionsStore.selectedId) {
			waveformDisplay?.playRegion(regionsStore.selectedId);
		}
	}

	function selectAdjacentRegion(offset: number) {
		const regions = regionsStore.regions;
		if (regions.length === 0) return;

		const currentIndex = regions.findIndex((region) => region.id === regionsStore.selectedId);

		if (currentIndex === -1) {
			const fallbackIndex = offset > 0 ? 0 : regions.length - 1;
			regionsStore.select(regions[fallbackIndex].id);
			return;
		}

		let nextIndex = currentIndex + offset;
		if (nextIndex < 0) {
			nextIndex = regions.length - 1;
		} else if (nextIndex >= regions.length) {
			nextIndex = 0;
		}

		regionsStore.select(regions[nextIndex].id);
	}

	// Keyboard shortcuts
	function handleKeydown(e: KeyboardEvent) {
		// Ignore if typing in an input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
			return;
		}

		switch (e.code) {
			case 'Space':
				e.preventDefault();
				if (audioStore.isPlaying) {
					handlePause();
				} else {
					// If a region is selected, play that region
					if (regionsStore.selectedId) {
						handlePlaySelectedRegion();
					} else {
						handlePlay();
					}
				}
				break;

			case 'Enter':
				e.preventDefault();
				// Play selected region
				if (regionsStore.selectedId) {
					handlePlaySelectedRegion();
				}
				break;

			case 'Delete':
			case 'Backspace':
				e.preventDefault();
				// Delete selected region
				if (regionsStore.selectedId) {
					regionsStore.remove(regionsStore.selectedId);
				}
				break;

			case 'Escape':
				e.preventDefault();
				// Deselect region and stop playback
				regionsStore.select(null);
				handleStop();
				break;

			case 'ArrowUp':
				if (regionsStore.regions.length === 0) return;
				e.preventDefault();
				selectAdjacentRegion(-1);
				break;

			case 'ArrowDown':
				if (regionsStore.regions.length === 0) return;
				e.preventDefault();
				selectAdjacentRegion(1);
				break;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex min-h-screen flex-col bg-gray-900 text-white">
	<!-- Header -->
	<header class="border-b border-gray-800 px-6 py-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<svg class="h-8 w-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
					/>
				</svg>
				<h1 class="text-xl font-bold">SoundCutter</h1>
			</div>
			<p class="text-sm text-gray-500">Cut, process, and export audio regions</p>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex flex-1 flex-col gap-4 p-6">
		<!-- Audio upload -->
		<AudioUploader />

		{#if audioStore.file}
			<!-- Waveform and controls -->
			<div class="flex flex-col gap-4">
				<WaveformDisplay bind:this={waveformDisplay} />
				<TransportControls onPlay={handlePlay} onPause={handlePause} onStop={handleStop} />
			</div>

			<!-- Panels grid -->
			<div class="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-4">
				<!-- Regions list -->
				<div class="lg:col-span-1">
					<RegionsList onPlayRegion={handlePlayRegion} />
				</div>

				<!-- Region editor -->
				<div class="lg:col-span-1">
					<RegionEditor onPlayRegion={handlePlayRegion} />
				</div>

				<!-- Effects panel -->
				<div class="lg:col-span-1">
					<EffectsPanel />
				</div>

				<!-- Export panel -->
				<div class="lg:col-span-1">
					<ExportPanel />
				</div>
			</div>
		{:else}
			<!-- Instructions when no file loaded -->
			<div class="flex flex-1 flex-col items-center justify-center gap-6 py-12 text-center">
				<div class="max-w-md space-y-4">
					<h2 class="text-2xl font-semibold text-gray-300">How to use SoundCutter</h2>
					<ol class="space-y-3 text-left text-gray-400">
						<li class="flex gap-3">
							<span
								class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-medium text-cyan-400"
								>1</span
							>
							<span>Upload an audio file or record your voice directly</span>
						</li>
						<li class="flex gap-3">
							<span
								class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-medium text-cyan-400"
								>2</span
							>
							<span>Click and drag on the waveform to create cut regions</span>
						</li>
						<li class="flex gap-3">
							<span
								class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-medium text-cyan-400"
								>3</span
							>
							<span>Apply 8-bit or lo-fi effects to give sounds a retro game feel</span>
						</li>
						<li class="flex gap-3">
							<span
								class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-medium text-cyan-400"
								>4</span
							>
							<span>Export all regions as separate MP3 files</span>
						</li>
					</ol>
				</div>

				<div class="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
					<div class="flex items-center gap-2">
						<kbd class="rounded bg-gray-800 px-2 py-1 text-xs">Space</kbd>
						<span>Play/Pause</span>
					</div>
					<div class="flex items-center gap-2">
						<kbd class="rounded bg-gray-800 px-2 py-1 text-xs">Enter</kbd>
						<span>Play region</span>
					</div>
					<div class="flex items-center gap-2">
						<kbd class="rounded bg-gray-800 px-2 py-1 text-xs">Delete</kbd>
						<span>Remove region</span>
					</div>
					<div class="flex items-center gap-2">
						<kbd class="rounded bg-gray-800 px-2 py-1 text-xs">Esc</kbd>
						<span>Deselect</span>
					</div>
					<div class="flex items-center gap-2">
						<kbd class="rounded bg-gray-800 px-2 py-1 text-xs">Drag</kbd>
						<span>Create region</span>
					</div>
					<div class="flex items-center gap-2">
						<kbd class="rounded bg-gray-800 px-2 py-1 text-xs">Double-click</kbd>
						<span>Play region</span>
					</div>
				</div>
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="border-t border-gray-800 px-6 py-3 text-center text-xs text-gray-600">
		SoundCutter - Audio cutting tool for game developers
	</footer>
</div>
