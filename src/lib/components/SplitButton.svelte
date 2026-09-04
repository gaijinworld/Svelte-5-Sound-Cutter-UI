<script lang="ts">
	import { onDestroy } from 'svelte';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';
	import { BrowserFfmpegEngine } from '$lib/media';
	import type { SplitResult } from '$lib/media';
	import { buildPartName } from '$lib/utils/outputName';

	type DownloadResult = SplitResult & { url: string };

	let isSplitting = $state(false);
	let results = $state<DownloadResult[]>([]);
	let errorMessage = $state<string | null>(null);
	let selectedCount = $derived(splitStore.segments.filter((segment) => segment.enabled).length);

	function clearResults() {
		for (const result of results) URL.revokeObjectURL(result.url);
		results = [];
	}

	async function startSplitting() {
		const file = audioStore.file;
		const segments = splitStore.segments.filter((segment) => segment.enabled);
		if (!file || segments.length === 0 || isSplitting) return;

		isSplitting = true;
		errorMessage = null;
		clearResults();

		const engine = new BrowserFfmpegEngine();
		const created: DownloadResult[] = [];

		try {
			await engine.prepare(file);

			for (const segment of segments) {
				const result = await engine.split(segment, buildPartName(file.name, segment.index));
				created.push({ ...result, url: URL.createObjectURL(result.blob) });
				results = [...created];
			}
		} catch (error) {
			for (const result of created) URL.revokeObjectURL(result.url);
			results = [];
			errorMessage = error instanceof Error ? error.message : 'MP3 splitting failed.';
		} finally {
			await engine.dispose();
			isSplitting = false;
		}
	}

	onDestroy(clearResults);
</script>

<div class="space-y-3">
	<button
		class="flex w-full items-center justify-center gap-2 rounded border border-gray-400 bg-[#f5f5f5] px-3 py-2 text-sm font-medium text-gray-800 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
		onclick={startSplitting}
		disabled={!audioStore.file || selectedCount === 0 || isSplitting}
	>
		<span aria-hidden="true">⚙</span>
		<span>{isSplitting ? 'Splitting…' : `Start splitting (${selectedCount})`}</span>
	</button>

	{#if results.length > 0}
		<div class="rounded border border-green-200 bg-green-50 p-2">
			<div class="mb-2 text-xs font-semibold text-green-900">Lossless MP3 parts ready</div>
			<div class="space-y-1">
				{#each results as result (result.name)}
					<a
						class="block truncate text-xs text-blue-700 hover:underline"
						href={result.url}
						download={result.name}
						title={result.name}
					>
						Download {result.name}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	{#if errorMessage}
		<div class="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
			{errorMessage}
		</div>
	{/if}

	<p class="text-[11px] leading-4 text-gray-500">
		Fast/lossless mode copies MP3 frames without re-encoding. A requested cut may align to a nearby MP3 frame boundary.
	</p>
</div>
