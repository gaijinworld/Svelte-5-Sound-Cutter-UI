<script lang="ts">
	import { regionsStore } from '$lib/stores/regionsStore.svelte';
	import RegionItem from './RegionItem.svelte';

	interface Props {
		onPlayRegion: (id: string) => void;
	}

	let { onPlayRegion }: Props = $props();
	let listContainer: HTMLDivElement | null = null;

	$effect(() => {
		const selectedId = regionsStore.selectedId;
		if (!selectedId || !listContainer) return;

		const target = listContainer.querySelector<HTMLElement>(
			`[data-region-id="${selectedId}"]`
		);
		target?.scrollIntoView({ block: 'nearest' });
	});
</script>

<div class="flex h-full flex-col rounded-lg bg-gray-800/50">
	<div class="flex items-center justify-between border-b border-gray-700 px-4 py-3">
		<h2 class="font-semibold text-gray-200">Regions</h2>
		{#if regionsStore.regions.length > 0}
			<span class="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-400">
				{regionsStore.regions.length}
			</span>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-2" bind:this={listContainer}>
		{#if regionsStore.regions.length === 0}
			<div class="flex h-full flex-col items-center justify-center p-4 text-center">
				<svg class="mb-3 h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
					/>
				</svg>
				<p class="text-sm text-gray-500">No regions yet</p>
				<p class="mt-1 text-xs text-gray-600">
					Click and drag on the waveform to create regions
				</p>
			</div>
		{:else}
			<div class="flex flex-col gap-2">
				{#each regionsStore.regions as region (region.id)}
					<RegionItem
						{region}
						isSelected={region.id === regionsStore.selectedId}
						{onPlayRegion}
					/>
				{/each}
			</div>
		{/if}
	</div>

	{#if regionsStore.regions.length > 0}
		<div class="border-t border-gray-700 p-3">
			<button
				class="w-full rounded-lg bg-red-500/10 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/20"
				onclick={() => regionsStore.clear()}
			>
				Clear all regions
			</button>
		</div>
	{/if}
</div>
