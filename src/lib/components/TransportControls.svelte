<script lang="ts">
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { regionsStore } from '$lib/stores/regionsStore.svelte';

	interface Props {
		onPlay: () => void;
		onPause: () => void;
		onStop: () => void;
	}

	let { onPlay, onPause, onStop }: Props = $props();

	// Check if a region is selected for display hint
	let hasSelectedRegion = $derived(regionsStore.selectedId !== null);
	let selectedRegionName = $derived(regionsStore.selectedRegion?.name ?? '');
</script>

<div class="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
	<div class="flex items-center gap-2">
		<!-- Stop button -->
		<button
			class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
			onclick={onStop}
			disabled={!audioStore.file}
			title="Stop"
		>
			<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
				<rect x="6" y="6" width="12" height="12" rx="1" />
			</svg>
		</button>

		<!-- Loop toggle -->
		<button
			class={`rounded-lg p-2 transition-colors disabled:opacity-50 ${
				audioStore.loopPlayback
					? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
					: 'text-gray-400 hover:bg-gray-700 hover:text-white'
			}`}
			onclick={() => audioStore.toggleLoopPlayback()}
			disabled={!audioStore.file}
			title={audioStore.loopPlayback ? 'Loop playback: on' : 'Loop playback: off'}
			aria-pressed={audioStore.loopPlayback}
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
			</svg>
		</button>

		<!-- Play/Pause button -->
		{#if audioStore.isPlaying}
			<button
				class="rounded-lg bg-cyan-500 p-3 text-white transition-colors hover:bg-cyan-600"
				onclick={onPause}
				title="Pause"
			>
				<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
					<rect x="6" y="5" width="4" height="14" rx="1" />
					<rect x="14" y="5" width="4" height="14" rx="1" />
				</svg>
			</button>
		{:else}
			<button
				class="rounded-lg bg-cyan-500 p-3 text-white transition-colors hover:bg-cyan-600 disabled:bg-gray-600 disabled:opacity-50"
				onclick={onPlay}
				disabled={!audioStore.file}
				title="Play"
			>
				<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
					<path d="M8 5.14v14.72a1 1 0 001.5.87l11-7.36a1 1 0 000-1.74l-11-7.36A1 1 0 008 5.14z" />
				</svg>
			</button>
		{/if}
	</div>

	<!-- Selected region indicator and keyboard hints -->
	<div class="flex items-center gap-4">
		{#if hasSelectedRegion}
			<div class="flex items-center gap-2 rounded bg-cyan-500/20 px-3 py-1.5">
				<span class="text-xs text-cyan-400">Selected:</span>
				<span class="max-w-32 truncate text-sm text-cyan-300">{selectedRegionName}</span>
			</div>
		{/if}
		<div class="flex items-center gap-4 text-xs text-gray-500">
			<div class="flex items-center gap-1">
				<kbd class="rounded bg-gray-700 px-1.5 py-0.5">Space</kbd>
				<span>{hasSelectedRegion ? 'Play region' : 'Play/Pause'}</span>
			</div>
			<div class="flex items-center gap-1">
				<kbd class="rounded bg-gray-700 px-1.5 py-0.5">Scroll</kbd>
				<span>Zoom</span>
			</div>
			<div class="flex items-center gap-1">
				<kbd class="rounded bg-gray-700 px-1.5 py-0.5">Up/Down</kbd>
				<span>Select region</span>
			</div>
			{#if hasSelectedRegion}
				<div class="flex items-center gap-1">
					<kbd class="rounded bg-gray-700 px-1.5 py-0.5">Del</kbd>
					<span>Delete</span>
				</div>
			{:else}
				<div class="flex items-center gap-1">
					<kbd class="rounded bg-gray-700 px-1.5 py-0.5">Drag</kbd>
					<span>Create region</span>
				</div>
			{/if}
		</div>
	</div>
</div>
