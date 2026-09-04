<script lang="ts">
	import { onDestroy } from 'svelte';
	import { zipSync } from 'fflate';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';
	import { BrowserFfmpegEngine } from '$lib/media';
	import type { SplitMode, SplitResult } from '$lib/media';
	import { buildZipName } from '$lib/utils/export';
	import { buildPartName } from '$lib/utils/outputName';

	type DownloadResult = SplitResult & { url: string };

	let mode = $state<SplitMode>('lossless');
	let isSplitting = $state(false);
	let isPreparingZip = $state(false);
	let progress = $state(0);
	let currentPart = $state('');
	let results = $state<DownloadResult[]>([]);
	let errorMessage = $state<string | null>(null);
	let statusMessage = $state<string | null>(null);
	let activeEngine: BrowserFfmpegEngine | null = null;
	let cancelRequested = false;

	let selectedCount = $derived(splitStore.segments.filter((segment) => segment.enabled).length);

	function clearResults() {
		for (const result of results) URL.revokeObjectURL(result.url);
		results = [];
	}

	function downloadBlob(blob: Blob, name: string) {
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = name;
		anchor.style.display = 'none';
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	async function startSplitting() {
		const file = audioStore.file;
		const segments = splitStore.segments.filter((segment) => segment.enabled);
		if (!file || segments.length === 0 || isSplitting) return;

		isSplitting = true;
		cancelRequested = false;
		progress = 0;
		currentPart = '';
		errorMessage = null;
		statusMessage = 'Preparing FFmpeg…';
		clearResults();

		const engine = new BrowserFfmpegEngine();
		activeEngine = engine;
		const created: DownloadResult[] = [];

		try {
			await engine.prepare(file);

			for (let index = 0; index < segments.length; index += 1) {
				if (cancelRequested) break;

				const segment = segments[index];
				const name = buildPartName(file.name, segment.index);
				currentPart = name;
				statusMessage = `${mode === 'lossless' ? 'Lossless' : 'Precise'} split ${index + 1} of ${segments.length}`;

				const result = await engine.split(segment, name, { mode });
				if (cancelRequested) break;

				created.push({ ...result, url: URL.createObjectURL(result.blob) });
				results = [...created];
				progress = Math.round(((index + 1) / segments.length) * 100);
			}

			if (cancelRequested) {
				statusMessage = created.length > 0 ? 'Cancelled — completed parts are still available.' : 'Cancelled.';
			} else {
				progress = 100;
				statusMessage = `${created.length} MP3 part${created.length === 1 ? '' : 's'} ready.`;
			}
		} catch (error) {
			if (cancelRequested) {
				statusMessage = created.length > 0 ? 'Cancelled — completed parts are still available.' : 'Cancelled.';
			} else {
				errorMessage = error instanceof Error ? error.message : 'MP3 splitting failed.';
				statusMessage = null;
			}
		} finally {
			await engine.dispose();
			activeEngine = null;
			isSplitting = false;
			currentPart = '';
		}
	}

	async function cancelSplitting() {
		if (!isSplitting || !activeEngine) return;
		cancelRequested = true;
		statusMessage = 'Cancelling…';
		await activeEngine.cancel();
	}

	async function downloadZip() {
		if (results.length === 0 || isPreparingZip) return;
		isPreparingZip = true;
		errorMessage = null;

		try {
			const entries: Record<string, Uint8Array> = {};
			for (const result of results) {
				entries[result.name] = new Uint8Array(await result.blob.arrayBuffer());
			}

			const zipData = zipSync(entries, { level: 0 });
			downloadBlob(
				new Blob([Uint8Array.from(zipData)], { type: 'application/zip' }),
				buildZipName(audioStore.file?.name)
			);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Could not prepare ZIP download.';
		} finally {
			isPreparingZip = false;
		}
	}

	onDestroy(() => {
		clearResults();
		if (activeEngine) void activeEngine.cancel();
	});
</script>

<div class="space-y-3">
	<fieldset class="rounded border border-gray-200 bg-gray-50 p-2" disabled={isSplitting}>
		<legend class="px-1 text-[11px] font-semibold text-gray-600">Splitting mode</legend>
		<label class="flex cursor-pointer items-start gap-2 py-1 text-xs">
			<input
				type="radio"
				name="split-mode"
				value="lossless"
				checked={mode === 'lossless'}
				onchange={() => (mode = 'lossless')}
			/>
			<span><strong>Fast / Lossless</strong> — copies original MP3 frames with no quality loss.</span>
		</label>
		<label class="flex cursor-pointer items-start gap-2 py-1 text-xs">
			<input
				type="radio"
				name="split-mode"
				value="precise"
				checked={mode === 'precise'}
				onchange={() => (mode = 'precise')}
			/>
			<span><strong>Precise</strong> — re-encodes MP3 audio for tighter requested boundaries.</span>
		</label>
	</fieldset>

	<div class="flex gap-2">
		<button
			class="flex flex-1 items-center justify-center gap-2 rounded border border-gray-400 bg-[#f5f5f5] px-3 py-2 text-sm font-medium text-gray-800 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
			onclick={startSplitting}
			disabled={!audioStore.file || selectedCount === 0 || isSplitting}
		>
			<span aria-hidden="true">⚙</span>
			<span>{isSplitting ? 'Splitting…' : `Start splitting (${selectedCount})`}</span>
		</button>

		{#if isSplitting}
			<button
				class="rounded border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
				onclick={cancelSplitting}
			>
				Cancel
			</button>
		{/if}
	</div>

	{#if isSplitting || progress > 0}
		<div class="space-y-1">
			<div class="h-2 overflow-hidden rounded bg-gray-200">
				<div class="h-full bg-blue-600 transition-all" style={`width: ${progress}%`}></div>
			</div>
			<div class="flex justify-between gap-2 text-[11px] text-gray-500">
				<span class="truncate" title={currentPart}>{statusMessage ?? ''}</span>
				<span>{progress}%</span>
			</div>
		</div>
	{:else if statusMessage}
		<div class="text-[11px] text-gray-600">{statusMessage}</div>
	{/if}

	{#if results.length > 0}
		<div class="rounded border border-green-200 bg-green-50 p-2">
			<div class="mb-2 flex items-center justify-between gap-2">
				<div class="text-xs font-semibold text-green-900">MP3 parts ready</div>
				{#if results.length > 1}
					<button
						class="rounded border border-green-300 bg-white px-2 py-1 text-[11px] font-medium text-green-800 hover:bg-green-100 disabled:opacity-50"
						onclick={downloadZip}
						disabled={isPreparingZip}
					>
						{isPreparingZip ? 'Preparing ZIP…' : 'Download all ZIP'}
					</button>
				{/if}
			</div>
			<div class="max-h-32 space-y-1 overflow-auto">
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
		{mode === 'lossless'
			? 'Lossless mode preserves the original MP3 stream, but cuts can align to nearby MP3 frame boundaries.'
			: 'Precise mode re-encodes with libmp3lame quality level 2, so output quality/bitrate characteristics may differ from the source.'}
	</p>
</div>
