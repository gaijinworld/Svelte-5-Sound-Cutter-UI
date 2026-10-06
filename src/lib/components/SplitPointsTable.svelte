<script lang="ts">
	import { splitStore } from '$lib/stores/splitStore.svelte';
	import { formatTimecode } from '$lib/utils/time';

	let segments = $derived(splitStore.segments);
	let allEnabled = $derived(segments.length > 0 && segments.every((segment) => segment.enabled));

	// Grid columns shared by the sticky header and the segment cards.
	// Divs + grid (not <table>) so the WP theme's unlayered td/th rules
	// can't force padding or transparent headers onto the rows.
	const cols = 'grid-cols-[1.5rem_1.75rem_1fr_1fr_1fr]';
</script>

<div class="flex h-full min-h-0 flex-col bg-white">
	<div class="flex items-center justify-between border-b border-gray-200 bg-slate-50/80 px-3 py-2">
		<span class="text-sm font-semibold text-gray-800">Split points</span>
		{#if segments.length > 0}
			<span class="rounded-full bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-800">
				{segments.length} segment{segments.length === 1 ? '' : 's'}
			</span>
		{/if}
	</div>

	<div class="min-h-0 flex-1 overflow-auto px-1.5 py-1">
		<div
			class={`mp3s-sticky z-10 grid ${cols} items-center gap-x-1 rounded-md bg-white px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 shadow-[0_1px_0_#e5e7eb]`}
		>
			<span class="flex justify-center">
				<input
					type="checkbox"
					class="accent-blue-600"
					checked={allEnabled}
					onchange={(event) => splitStore.setAllEnabled(event.currentTarget.checked)}
					aria-label="Select all segments"
				/>
			</span>
			<span>#</span>
			<span>Start</span>
			<span>End</span>
			<span>Duration</span>
		</div>

		{#each segments as segment (segment.id)}
			<label
				class={`mt-0.5 grid ${cols} h-8 cursor-pointer items-center gap-x-1 rounded-md border px-1.5 text-xs transition-colors ${
					segment.enabled
						? 'border-gray-200/80 bg-white text-gray-800 shadow-sm hover:border-blue-300 hover:bg-blue-50/60'
						: 'border-gray-100 bg-gray-50/70 text-gray-400 hover:bg-gray-100/70'
				}`}
			>
				<span class="flex justify-center">
					<input
						type="checkbox"
						class="accent-blue-600"
						checked={segment.enabled}
						onchange={(event) => splitStore.setEnabled(segment.id, event.currentTarget.checked)}
						aria-label={`Export segment ${segment.index + 1}`}
					/>
				</span>
				<span class="font-mono text-[10px] font-semibold text-blue-700">{segment.index + 1}</span>
				<span class="whitespace-nowrap font-mono">{formatTimecode(segment.start)}</span>
				<span class="whitespace-nowrap font-mono">{formatTimecode(segment.end)}</span>
				<span class="whitespace-nowrap font-mono">{formatTimecode(segment.duration)}</span>
			</label>
		{/each}
		{#if segments.length === 0}
			<div class="px-4 py-8 text-center text-sm text-gray-500">
				Open an audio file to generate the first segment.
			</div>
		{/if}
	</div>
</div>
