<script lang="ts">
	import { tick } from 'svelte';
	import type { Region } from '$lib/types';
	import { regionsStore, hasActiveEffects } from '$lib/stores/regionsStore.svelte';

	interface Props {
		region: Region;
		isSelected: boolean;
		onPlayRegion: (id: string) => void;
	}

	let { region, isSelected, onPlayRegion }: Props = $props();

	let isEditing = $state(false);
	let editName = $state('');
	let nameInput = $state<HTMLInputElement | undefined>(undefined);

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		const ms = Math.floor((seconds % 1) * 100);
		return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
	}

	function startEditing() {
		editName = region.name;
		isEditing = true;
	}

	function saveEdit() {
		if (editName.trim()) {
			regionsStore.update(region.id, { name: editName.trim() });
		}
		isEditing = false;
	}

	function cancelEdit() {
		editName = region.name;
		isEditing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			saveEdit();
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	$effect(() => {
		if (!isEditing) return;

		void tick().then(() => {
			nameInput?.focus();
			nameInput?.select();
		});
	});
</script>

<div
	class="group flex items-center gap-3 rounded-lg p-3 transition-colors
	{isSelected ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-750'}"
	role="button"
	tabindex="0"
	data-region-id={region.id}
	onclick={() => regionsStore.select(region.id)}
	onkeydown={(e) => e.key === 'Enter' && regionsStore.select(region.id)}
>
	<!-- Color indicator -->
	<div class="h-8 w-1 rounded-full" style="background-color: {region.color.replace('0.4', '1')}">
	</div>

	<!-- Region info -->
	<div class="min-w-0 flex-1">
		{#if isEditing}
			<input
				bind:this={nameInput}
				type="text"
				bind:value={editName}
				onblur={saveEdit}
				onkeydown={handleKeydown}
				class="w-full rounded bg-gray-600 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
				aria-label="Region name"
			/>
		{:else}
			<div class="flex items-center gap-2">
				<button
					class="block truncate text-left font-medium text-gray-200 hover:text-white"
					ondblclick={startEditing}
					title="Double-click to rename"
				>
					{region.name}
				</button>
				{#if hasActiveEffects(region.effects)}
					<span
						class="rounded bg-purple-500/30 px-1.5 py-0.5 text-[10px] font-bold text-purple-300"
						title="Effects applied"
					>
						FX
					</span>
				{/if}
			</div>
		{/if}
		<div class="text-xs text-gray-500">
			{formatTime(region.start)} - {formatTime(region.end)}
			<span class="ml-2 text-gray-600">
				({formatTime(region.end - region.start)})
			</span>
		</div>
	</div>

	<!-- Actions -->
	<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
		<!-- Play button -->
		<button
			class="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-600 hover:text-cyan-400"
			onclick={(e) => {
				e.stopPropagation();
				onPlayRegion(region.id);
			}}
			title="Preview this region"
		>
			<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
				<path d="M8 5.14v14.72a1 1 0 001.5.87l11-7.36a1 1 0 000-1.74l-11-7.36A1 1 0 008 5.14z" />
			</svg>
		</button>

		<!-- Delete button -->
		<button
			class="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-600 hover:text-red-400"
			onclick={(e) => {
				e.stopPropagation();
				regionsStore.remove(region.id);
			}}
			title="Delete region"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
				/>
			</svg>
		</button>
	</div>
</div>
