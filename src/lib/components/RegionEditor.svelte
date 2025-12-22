<script lang="ts">
	import { regionsStore, hasActiveEffects } from '$lib/stores/regionsStore.svelte';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { toneEngine } from '$lib/audio/ToneEffects';

	interface Props {
		onPlayRegion: (id: string) => void;
	}

	let { onPlayRegion }: Props = $props();

	// Get selected region reactively
	let region = $derived(regionsStore.selectedRegion);
	let isPreviewingFx = $state(false);
	let previewError = $state<string | null>(null);

	// Preview with effects using Tone.js
	async function previewWithEffects() {
		if (!region || !audioStore.buffer) return;

		isPreviewingFx = true;
		previewError = null;
		try {
			await toneEngine.previewWithEffects(
				audioStore.buffer,
				region.start,
				region.end,
				region.effects
			);
		} catch (err) {
			previewError = err instanceof Error ? err.message : 'Preview failed';
		} finally {
			isPreviewingFx = false;
		}
	}

	function stopPreview() {
		toneEngine.stopPreview();
		isPreviewingFx = false;
	}

	// Format time for display (mm:ss.ms)
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		const ms = Math.floor((seconds % 1) * 1000);
		return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
	}

	// Format time for input (seconds with 3 decimal places)
	function formatTimeInput(seconds: number): string {
		return seconds.toFixed(3);
	}

	// Parse time input back to seconds
	function parseTimeInput(value: string): number | null {
		const num = parseFloat(value);
		if (isNaN(num) || num < 0) return null;
		return num;
	}

	function clampTime(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(value, max));
	}

	// Update region start time
	function updateStart(value: string) {
		if (!region) return;
		const newStart = parseTimeInput(value);
		if (newStart === null) return;

		// Clamp to valid range
		const clampedStart = Math.max(0, Math.min(newStart, region.end - 0.01));
		regionsStore.update(region.id, { start: clampedStart });
	}

	// Update region end time
	function updateEnd(value: string) {
		if (!region) return;
		const newEnd = parseTimeInput(value);
		if (newEnd === null) return;

		// Clamp to valid range
		const maxEnd = audioStore.duration || Infinity;
		const clampedEnd = Math.max(region.start + 0.01, Math.min(newEnd, maxEnd));
		regionsStore.update(region.id, { end: clampedEnd });
	}

	// Nudge start/end by delta
	function nudgeStart(delta: number) {
		if (!region) return;
		const newStart = Math.max(0, Math.min(region.start + delta, region.end - 0.01));
		regionsStore.update(region.id, { start: newStart });
	}

	function nudgeEnd(delta: number) {
		if (!region) return;
		const maxEnd = audioStore.duration || Infinity;
		const newEnd = Math.max(region.start + 0.01, Math.min(region.end + delta, maxEnd));
		regionsStore.update(region.id, { end: newEnd });
	}

	function setStartToPlayhead() {
		if (!region) return;
		const clampedStart = clampTime(audioStore.currentTime, 0, region.end - 0.01);
		regionsStore.update(region.id, { start: clampedStart });
	}

	function setEndToPlayhead() {
		if (!region) return;
		const maxEnd = audioStore.duration || Infinity;
		const clampedEnd = clampTime(audioStore.currentTime, region.start + 0.01, maxEnd);
		regionsStore.update(region.id, { end: clampedEnd });
	}

	// Calculate duration
	let duration = $derived(region ? region.end - region.start : 0);
</script>

{#if region}
	<div class="rounded-lg bg-gray-800/50 p-4">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="font-semibold text-gray-200">Edit Region</h2>
			<div class="flex items-center gap-2">
				<button
					class="rounded bg-cyan-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-cyan-600"
					onclick={() => onPlayRegion(region.id)}
					title="Play region without effects"
				>
					<span class="flex items-center gap-1.5">
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M8 5.14v14.72a1 1 0 001.5.87l11-7.36a1 1 0 000-1.74l-11-7.36A1 1 0 008 5.14z" />
						</svg>
						Play
					</span>
				</button>
				{#if isPreviewingFx}
					<button
						class="rounded bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
						onclick={stopPreview}
						title="Stop preview"
					>
						<span class="flex items-center gap-1.5">
							<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
								<rect x="6" y="6" width="12" height="12" rx="1" />
							</svg>
							Stop
						</span>
					</button>
				{:else}
					<button
						class="rounded bg-purple-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-600 disabled:bg-gray-600 disabled:text-gray-400"
						onclick={previewWithEffects}
						disabled={!hasActiveEffects(region.effects)}
						title={hasActiveEffects(region.effects) ? "Preview with effects applied" : "No effects enabled"}
					>
						<span class="flex items-center gap-1.5">
							<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
							</svg>
							Preview FX
						</span>
					</button>
				{/if}
				<button
					class="rounded bg-red-500/20 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/30"
					onclick={() => regionsStore.remove(region.id)}
					title="Delete region (Delete)"
				>
					Delete
				</button>
			</div>
		</div>

		<!-- Region name -->
		<div class="mb-4">
			<label class="mb-1 block text-xs text-gray-500" for="region-name">Name</label>
			<input
				id="region-name"
				type="text"
				value={region.name}
				onchange={(e) => regionsStore.update(region.id, { name: e.currentTarget.value })}
				class="w-full rounded bg-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
			/>
		</div>

		<div class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded bg-gray-900/50 px-3 py-2">
			<div class="flex items-center gap-2 text-xs text-gray-500">
				<span>Playhead</span>
				<span class="font-mono text-sm text-gray-300">
					{formatTime(audioStore.currentTime)}
				</span>
			</div>
			<div class="flex items-center gap-2">
				<button
					class="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={setStartToPlayhead}
					disabled={!audioStore.buffer}
					title="Set start to playhead"
				>
					Set Start
				</button>
				<button
					class="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={setEndToPlayhead}
					disabled={!audioStore.buffer}
					title="Set end to playhead"
				>
					Set End
				</button>
			</div>
		</div>

		<!-- Time controls -->
		<div class="grid grid-cols-2 gap-4">
			<!-- Start time -->
			<div>
				<label class="mb-1 block text-xs text-gray-500" for="region-start">Start</label>
				<div class="flex items-center gap-1">
					<button
						class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
						onclick={() => nudgeStart(-0.1)}
						title="-100ms"
					>
						-0.1
					</button>
					<button
						class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
						onclick={() => nudgeStart(-0.01)}
						title="-10ms"
					>
						-
					</button>
					<input
						id="region-start"
						type="text"
						value={formatTimeInput(region.start)}
						onchange={(e) => updateStart(e.currentTarget.value)}
						class="w-full min-w-0 rounded bg-gray-700 px-2 py-1.5 text-center text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
					/>
					<button
						class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
						onclick={() => nudgeStart(0.01)}
						title="+10ms"
					>
						+
					</button>
					<button
						class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
						onclick={() => nudgeStart(0.1)}
						title="+100ms"
					>
						+0.1
					</button>
				</div>
				<div class="mt-1 text-center text-xs text-gray-600">{formatTime(region.start)}</div>
			</div>

			<!-- End time -->
			<div>
				<label class="mb-1 block text-xs text-gray-500" for="region-end">End</label>
				<div class="flex items-center gap-1">
					<button
						class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
						onclick={() => nudgeEnd(-0.1)}
						title="-100ms"
					>
						-0.1
					</button>
					<button
						class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
						onclick={() => nudgeEnd(-0.01)}
						title="-10ms"
					>
						-
					</button>
					<input
						id="region-end"
						type="text"
						value={formatTimeInput(region.end)}
						onchange={(e) => updateEnd(e.currentTarget.value)}
						class="w-full min-w-0 rounded bg-gray-700 px-2 py-1.5 text-center text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
					/>
					<button
						class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
						onclick={() => nudgeEnd(0.01)}
						title="+10ms"
					>
						+
					</button>
					<button
						class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
						onclick={() => nudgeEnd(0.1)}
						title="+100ms"
					>
						+0.1
					</button>
				</div>
				<div class="mt-1 text-center text-xs text-gray-600">{formatTime(region.end)}</div>
			</div>
		</div>

		<!-- Duration display -->
		<div class="mt-4 flex items-center justify-between rounded bg-gray-900/50 px-3 py-2">
			<span class="text-xs text-gray-500">Duration</span>
			<span class="font-mono text-sm text-gray-300">{formatTime(duration)}</span>
		</div>

		{#if previewError}
			<p class="mt-3 text-sm text-red-400">{previewError}</p>
		{/if}

		<!-- Keyboard hints -->
		<div class="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
			<span><kbd class="rounded bg-gray-700 px-1">Enter</kbd> Play</span>
			<span><kbd class="rounded bg-gray-700 px-1">Delete</kbd> Remove</span>
			<span><kbd class="rounded bg-gray-700 px-1">Esc</kbd> Deselect</span>
		</div>
	</div>
{:else}
	<div class="rounded-lg bg-gray-800/50 p-4">
		<div class="flex flex-col items-center justify-center py-6 text-center">
			<svg class="mb-2 h-8 w-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
			</svg>
			<p class="text-sm text-gray-500">Select a region to edit</p>
			<p class="mt-1 text-xs text-gray-600">Click on a region or double-click to play</p>
		</div>
	</div>
{/if}
