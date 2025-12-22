<script lang="ts">
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { regionsStore } from '$lib/stores/regionsStore.svelte';
	import { loadFfmpeg } from '$lib/audio/ffmpegClient';
	import VoiceRecorder from './VoiceRecorder.svelte';

	let isDragging = $state(false);
	let fileInput = $state<HTMLInputElement | undefined>(undefined);
	let isConverting = $state(false);
	let uploadError = $state<string | null>(null);

	const ACCEPTED_TYPES = [
		'audio/mpeg',
		'audio/wav',
		'audio/ogg',
		'audio/mp3',
		'audio/x-wav',
		'audio/aiff',
		'audio/x-aiff'
	];

	function isAiffFile(file: File): boolean {
		return (
			file.type.toLowerCase() === 'audio/aiff' ||
			file.type.toLowerCase() === 'audio/x-aiff' ||
			/\.(aiff|aif)$/i.test(file.name)
		);
	}

	async function convertAiffToWav(file: File): Promise<File> {
		const ffmpeg = await loadFfmpeg();
		const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const inputName = `input_${token}.aiff`;
		const outputName = `output_${token}.wav`;

		try {
			const inputData = new Uint8Array(await file.arrayBuffer());
			await ffmpeg.writeFile(inputName, inputData);
			await ffmpeg.exec(['-i', inputName, '-acodec', 'pcm_s16le', outputName]);
			const wavData = (await ffmpeg.readFile(outputName)) as Uint8Array;
			const wavBlob = new Blob([wavData.slice()], { type: 'audio/wav' });
			const baseName = file.name.replace(/\.[^/.]+$/, '');
			return new File([wavBlob], `${baseName}.wav`, { type: 'audio/wav' });
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

	async function handleFile(file: File) {
		if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|aiff|aif)$/i)) {
			uploadError = 'Please upload an MP3, WAV, OGG, or AIFF file.';
			return;
		}

		// Reset previous state
		regionsStore.clear();
		uploadError = null;

		if (isAiffFile(file)) {
			isConverting = true;
			try {
				const converted = await convertAiffToWav(file);
				audioStore.setFile(converted);
			} catch (err) {
				const message = err instanceof Error ? err.message : 'AIFF conversion failed';
				uploadError = message;
			} finally {
				isConverting = false;
			}
			return;
		}

		audioStore.setFile(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		if (isConverting) return;

		const file = e.dataTransfer?.files[0];
		if (file) {
			void handleFile(file);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function handleFileSelect(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			void handleFile(file);
		}
		target.value = '';
	}

	function openFilePicker() {
		if (isConverting) return;
		uploadError = null;
		fileInput?.click();
	}
</script>

{#if !audioStore.file}
	<div class="flex flex-col gap-4 sm:flex-row">
		<!-- File upload area -->
		<button
			class="flex-1 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200
			{isDragging
				? 'border-cyan-400 bg-cyan-500/10'
				: 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'} {isConverting ? 'cursor-not-allowed opacity-60' : ''}"
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			onclick={openFilePicker}
			disabled={isConverting}
		>
			<div class="flex flex-col items-center gap-3">
				<svg
					class="h-12 w-12 {isDragging ? 'text-cyan-400' : 'text-gray-500'}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
					/>
				</svg>
				<div>
					<p class="text-base font-medium {isDragging ? 'text-cyan-400' : 'text-gray-300'}">
						{isConverting
							? 'Converting AIFF...'
							: isDragging
								? 'Drop your audio file here'
								: 'Drop audio file or click to upload'}
					</p>
					<p class="mt-1 text-sm text-gray-500">
						{isConverting ? 'Please wait while we prepare the file' : 'MP3, WAV, OGG, AIFF'}
					</p>
				</div>
			</div>
		</button>

		<!-- Divider -->
		<div class="flex items-center justify-center sm:flex-col">
			<div class="h-px flex-1 bg-gray-700 sm:h-auto sm:w-px"></div>
			<span class="px-3 py-2 text-sm text-gray-500">or</span>
			<div class="h-px flex-1 bg-gray-700 sm:h-auto sm:w-px"></div>
		</div>

		<!-- Voice recorder area -->
		<div
			class="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-600 bg-gray-800/50 p-8"
		>
			<svg class="h-12 w-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
				/>
			</svg>
			<VoiceRecorder />
			<p class="text-sm text-gray-500">Record directly from microphone</p>
		</div>
	</div>

	<input
		bind:this={fileInput}
		type="file"
		accept=".mp3,.wav,.ogg,.aiff,.aif,audio/*"
		class="hidden"
		onchange={handleFileSelect}
	/>
	{#if uploadError}
		<p class="mt-3 text-center text-xs text-red-400">{uploadError}</p>
	{/if}
{:else}
	<div class="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
		<div class="flex items-center gap-3">
			<svg class="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
				/>
			</svg>
			<span class="font-medium text-gray-200">{audioStore.file.name}</span>
			<span class="text-sm text-gray-500">
				({(audioStore.file.size / 1024 / 1024).toFixed(2)} MB)
			</span>
		</div>
		<button
			class="rounded px-3 py-1 text-sm text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
			onclick={() => {
				audioStore.reset();
				regionsStore.clear();
			}}
		>
			Change file
		</button>
	</div>
{/if}
