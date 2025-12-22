<script lang="ts">
	import type { FFmpeg } from '@ffmpeg/ffmpeg';
	import { zipSync } from 'fflate';
	import { regionsStore, hasActiveEffects } from '$lib/stores/regionsStore.svelte';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { toneEngine } from '$lib/audio/ToneEffects';
	import { loadFfmpeg, resetFfmpeg } from '$lib/audio/ffmpegClient';
	import type { Region } from '$lib/types';
	import { buildExportBaseName, buildZipName } from '$lib/utils/export';

	type ExportedFile = {
		name: string;
		url: string;
		blob: Blob;
	};

	let ffmpeg: FFmpeg | null = null;
	let hasProgressHandler = false;
	let isLoading = $state(false);
	let isExporting = $state(false);
	let loadProgress = $state(0);
	let exportProgress = $state(0);
	let currentExportRegion = $state('');
	let exportedFiles = $state<ExportedFile[]>([]);
	let errorMessage = $state<string | null>(null);
	let downloadError = $state<string | null>(null);
	let isPreparingZip = $state(false);

	// Count regions with effects
	let regionsWithEffects = $derived(
		regionsStore.regions.filter((r) => hasActiveEffects(r.effects)).length
	);

	function revokeExportedFiles(files: ExportedFile[]) {
		files.forEach((file) => URL.revokeObjectURL(file.url));
	}

	async function loadFFmpeg() {
		if (ffmpeg) return;

		isLoading = true;
		loadProgress = 0;
		errorMessage = null;

		try {
			ffmpeg = await loadFfmpeg();
			if (!hasProgressHandler && ffmpeg) {
				ffmpeg.on('progress', ({ progress }) => {
					if (isExporting) {
						exportProgress = Math.round(progress * 100);
					}
				});
				hasProgressHandler = true;
			}
			loadProgress = 100;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to load FFmpeg';
			errorMessage = message;
			throw new Error(message);
		} finally {
			isLoading = false;
		}
	}

	function resetError() {
		errorMessage = null;
		ffmpeg = null;
		resetFfmpeg();
	}

	function audioBufferToWav(buffer: AudioBuffer): Blob {
		const numChannels = buffer.numberOfChannels;
		const sampleRate = buffer.sampleRate;
		const format = 1; // PCM
		const bitDepth = 16;

		const bytesPerSample = bitDepth / 8;
		const blockAlign = numChannels * bytesPerSample;
		const byteRate = sampleRate * blockAlign;
		const dataLength = buffer.length * blockAlign;
		const bufferLength = 44 + dataLength;

		const arrayBuffer = new ArrayBuffer(bufferLength);
		const view = new DataView(arrayBuffer);

		// Write WAV header
		const writeString = (offset: number, str: string) => {
			for (let i = 0; i < str.length; i++) {
				view.setUint8(offset + i, str.charCodeAt(i));
			}
		};

		writeString(0, 'RIFF');
		view.setUint32(4, bufferLength - 8, true);
		writeString(8, 'WAVE');
		writeString(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, format, true);
		view.setUint16(22, numChannels, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, byteRate, true);
		view.setUint16(32, blockAlign, true);
		view.setUint16(34, bitDepth, true);
		writeString(36, 'data');
		view.setUint32(40, dataLength, true);

		// Interleave channels and write audio data
		const channels: Float32Array[] = [];
		for (let i = 0; i < numChannels; i++) {
			channels.push(buffer.getChannelData(i));
		}

		let offset = 44;
		for (let i = 0; i < buffer.length; i++) {
			for (let channel = 0; channel < numChannels; channel++) {
				const sample = Math.max(-1, Math.min(1, channels[channel][i]));
				const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
				view.setInt16(offset, intSample, true);
				offset += 2;
			}
		}

		return new Blob([arrayBuffer], { type: 'audio/wav' });
	}

	async function exportRegion(
		region: Region,
		baseName: string
	): Promise<ExportedFile | null> {
		if (!audioStore.buffer || !ffmpeg) return null;

		currentExportRegion = region.name;
		exportProgress = 0;

		// Render with the region's own effects using Tone.js
		await toneEngine.init();
		const renderedBuffer = await toneEngine.renderWithEffects(
			audioStore.buffer,
			region.start,
			region.end,
			region.effects // Use region's effects
		);

		// Convert to WAV (use rendered buffer's actual sample rate)
		const wavBlob = audioBufferToWav(renderedBuffer);
		const wavData = new Uint8Array(await wavBlob.arrayBuffer());
		const sampleRate = renderedBuffer.sampleRate;

		// Write WAV to FFmpeg filesystem
		const inputName = `${baseName}.wav`;
		const outputName = `${baseName}.mp3`;

		try {
			try {
				await ffmpeg.deleteFile(inputName);
			} catch {
				// Ignore missing input file
			}
			try {
				await ffmpeg.deleteFile(outputName);
			} catch {
				// Ignore missing output file
			}

			await ffmpeg.writeFile(inputName, wavData);

			// Convert to MP3 (explicitly preserve sample rate)
			await ffmpeg.exec([
				'-i', inputName,
				'-ar', String(sampleRate),
				'-b:a', '192k',
				'-y', outputName
			]);

			// Read the output
			const mp3Data = (await ffmpeg.readFile(outputName)) as Uint8Array;
			const mp3Blob = new Blob([Uint8Array.from(mp3Data)], { type: 'audio/mpeg' });
			const url = URL.createObjectURL(mp3Blob);

			return { name: outputName, url, blob: mp3Blob };
		} finally {
			try {
				await ffmpeg.deleteFile(inputName);
			} catch {
				// Ignore cleanup errors
			}
			try {
				await ffmpeg.deleteFile(outputName);
			} catch {
				// Ignore cleanup errors
			}
		}
	}

	async function exportAll() {
		if (!audioStore.buffer || regionsStore.regions.length === 0) return;

		isExporting = true;
		clearExports();
		errorMessage = null;

		const createdFiles: ExportedFile[] = [];

		try {
			await loadFFmpeg();

			const usedNames = new Map<string, number>();

			for (const region of regionsStore.regions) {
				const baseName = buildExportBaseName(region.name, usedNames);
				const result = await exportRegion(region, baseName);
				if (result) {
					createdFiles.push(result);
					exportedFiles = [...exportedFiles, result];
				}
			}
		} catch (error) {
			console.error('Export failed:', error);
			const message = error instanceof Error ? error.message : 'Export failed';
			errorMessage = message;

			revokeExportedFiles(createdFiles);
			exportedFiles = [];
		} finally {
			isExporting = false;
			currentExportRegion = '';
			exportProgress = 0;
		}
	}

	function downloadFile(file: Pick<ExportedFile, 'name' | 'url'>) {
		const a = document.createElement('a');
		a.href = file.url;
		a.download = file.name;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	async function downloadAll() {
		if (exportedFiles.length === 0 || isPreparingZip) return;

		isPreparingZip = true;
		downloadError = null;

		try {
			const entries: Record<string, Uint8Array> = {};

			for (const file of exportedFiles) {
				const buffer = await file.blob.arrayBuffer();
				entries[file.name] = new Uint8Array(buffer);
			}

			const zipData = zipSync(entries, { level: 0 });
			const zipBlob = new Blob([Uint8Array.from(zipData)], { type: 'application/zip' });
			const zipUrl = URL.createObjectURL(zipBlob);
			downloadFile({ name: buildZipName(audioStore.file?.name), url: zipUrl });
			setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
		} catch (error) {
			console.error('Download all failed:', error);
			downloadError = error instanceof Error ? error.message : 'Download all failed';
		} finally {
			isPreparingZip = false;
		}
	}

	function clearExports() {
		revokeExportedFiles(exportedFiles);
		exportedFiles = [];
		downloadError = null;
	}

	$effect(() => {
		return () => {
			clearExports();
			toneEngine.destroy();
		};
	});
</script>

<div class="rounded-lg bg-gray-800/50 p-4">
	<h2 class="mb-4 font-semibold text-gray-200">Export</h2>

	{#if errorMessage}
		<div class="flex flex-col items-center gap-3 py-6">
			<svg class="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<p class="text-center text-sm text-red-400">{errorMessage}</p>
			<button
				class="rounded bg-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-600"
				onclick={() => {
					resetError();
					void exportAll();
				}}
			>
				Retry Export
			</button>
		</div>
	{:else if isLoading}
		<div class="flex flex-col items-center gap-3 py-6">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent">
			</div>
			<p class="text-sm text-gray-400">Loading FFmpeg...</p>
			<p class="text-xs text-gray-500">This may take a moment on first use</p>
			<div class="h-2 w-full rounded-full bg-gray-700">
				<div
					class="h-full rounded-full bg-cyan-500 transition-all"
					style="width: {loadProgress}%"
				></div>
			</div>
		</div>
	{:else if isExporting}
		<div class="flex flex-col gap-3 py-4">
			<div class="flex items-center justify-between text-sm">
				<span class="text-gray-300">Exporting: {currentExportRegion}</span>
				<span class="text-gray-400">{exportProgress}%</span>
			</div>
			<div class="h-2 w-full rounded-full bg-gray-700">
				<div
					class="h-full rounded-full bg-green-500 transition-all"
					style="width: {exportProgress}%"
				></div>
			</div>
			<p class="text-center text-xs text-gray-500">
				{exportedFiles.length} / {regionsStore.regions.length} regions exported
			</p>
		</div>
	{:else if exportedFiles.length > 0}
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<span class="text-sm text-green-400">{exportedFiles.length} files ready</span>
				<div class="flex gap-2">
					<button
						class="rounded bg-green-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:bg-gray-600 disabled:text-gray-300"
						onclick={downloadAll}
						disabled={isPreparingZip}
					>
						{isPreparingZip ? 'Preparing ZIP...' : 'Download ZIP'}
					</button>
					<button
						class="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-600"
						onclick={clearExports}
					>
						Clear
					</button>
				</div>
			</div>
			{#if downloadError}
				<p class="text-xs text-red-400">{downloadError}</p>
			{/if}

			<div class="max-h-40 space-y-1 overflow-y-auto">
				{#each exportedFiles as file}
					<button
						class="flex w-full items-center justify-between rounded bg-gray-800 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-700"
						onclick={() => downloadFile(file)}
					>
						<span class="truncate text-gray-300">{file.name}</span>
						<svg class="h-4 w-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
							/>
						</svg>
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<div class="flex flex-col items-center gap-3">
			<p class="text-center text-sm text-gray-500">
				{#if regionsStore.regions.length === 0}
					Create regions on the waveform to export
				{:else}
					{regionsStore.regions.length} region{regionsStore.regions.length !== 1 ? 's' : ''} ready to export
				{/if}
			</p>

			<button
				class="w-full rounded-lg bg-green-500 py-3 font-medium text-white transition-colors hover:bg-green-600 disabled:bg-gray-600 disabled:text-gray-400"
				disabled={regionsStore.regions.length === 0 || !audioStore.buffer}
				onclick={exportAll}
			>
				Export All as MP3
			</button>

			{#if regionsWithEffects > 0}
				<p class="text-center text-xs text-cyan-400">
					{regionsWithEffects} region{regionsWithEffects !== 1 ? 's' : ''} with effects
				</p>
			{/if}
		</div>
	{/if}
</div>
