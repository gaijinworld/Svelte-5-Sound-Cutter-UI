<script lang="ts">
	import { onDestroy } from 'svelte';
	import { zipSync } from 'fflate';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';
	import { BrowserFfmpegEngine } from '$lib/media';
	import type { SplitMode, SplitResult } from '$lib/media';
	import { buildZipName } from '$lib/utils/export';
	import { buildPartName } from '$lib/utils/outputName';
	import { detectAudioFormat, outputExtension } from '$lib/utils/audioFormat';

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
		const format = detectAudioFormat(file);
		const ext = format ? outputExtension(format) : 'mp3';

		try {
			await engine.prepare(file);

			for (let index = 0; index < segments.length; index += 1) {
				if (cancelRequested) break;

				const segment = segments[index];
				const name = buildPartName(file.name, segment.index, ext);
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
				statusMessage = `${created.length} ${ext.toUpperCase()} part${created.length === 1 ? '' : 's'} ready.`;
			}
		} catch (error) {
			if (cancelRequested) {
				statusMessage = created.length > 0 ? 'Cancelled — completed parts are still available.' : 'Cancelled.';
			} else {
				errorMessage = error instanceof Error ? error.message : 'Audio splitting failed.';
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
	<fieldset
		class="rounded-xl border border-gray-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-sm"
		disabled={isSplitting}
	>
		<legend class="px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Splitting mode</legend>
		<label class="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 text-xs transition-colors hover:bg-blue-50/70">
			<input
				type="radio"
				class="mt-0.5 accent-blue-600"
				name="split-mode"
				value="lossless"
				checked={mode === 'lossless'}
				onchange={() => (mode = 'lossless')}
			/>
			<span><strong class="text-gray-800">Fast / Lossless</strong> — copies the original audio stream with no quality loss.</span>
		</label>
		<label class="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 text-xs transition-colors hover:bg-blue-50/70">
			<input
				type="radio"
				class="mt-0.5 accent-blue-600"
				name="split-mode"
				value="precise"
				checked={mode === 'precise'}
				onchange={() => (mode = 'precise')}
			/>
			<span><strong class="text-gray-800">Precise</strong> — re-encodes to the same format for tighter requested boundaries.</span>
		</label>
	</fieldset>

	<div class="flex gap-2">
		<button
			class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
			onclick={startSplitting}
			disabled={!audioStore.file || selectedCount === 0 || isSplitting}
		>
			<span aria-hidden="true">⚙</span>
			<span>{isSplitting ? 'Splitting…' : `Start splitting (${selectedCount})`}</span>
		</button>

		{#if isSplitting}
			<button
				class="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
				onclick={cancelSplitting}
			>
				Cancel
			</button>
		{/if}
	</div>

	{#if isSplitting || progress > 0}
		<div class="space-y-1">
			<div class="h-2.5 overflow-hidden rounded-full bg-gray-200 shadow-inner">
				<div
					class="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
					style={`width: ${progress}%`}
				></div>
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
		<div class="rounded-lg border border-green-200 bg-green-50 p-2.5 shadow-sm">
			<div class="mb-2 flex items-center justify-between gap-2">
				<div class="text-xs font-semibold text-green-900">Audio parts ready</div>
				{#if results.length > 1}
					<button
						class="rounded-md bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-50"
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
			? 'Lossless mode preserves the original audio stream, but cuts may snap to nearby frame/packet boundaries.'
			: 'Precise mode re-encodes the audio stream, so output quality/bitrate characteristics may differ from the source.'}
	</p>
</div>
