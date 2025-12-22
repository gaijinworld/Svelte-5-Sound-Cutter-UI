<script lang="ts">
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { regionsStore } from '$lib/stores/regionsStore.svelte';

	let isRecording = $state(false);
	let isPaused = $state(false);
	let recordingTime = $state(0);
	let audioLevel = $state(0);
	let error = $state<string | null>(null);
	let hasPermission = $state<boolean | null>(null);

	let mediaRecorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let analyser: AnalyserNode | null = null;
	let animationFrame: number | null = null;
	let audioContext: AudioContext | null = null;
	let mediaStream: MediaStream | null = null;

	function isRecordingSupported(): boolean {
		return (
			typeof window !== 'undefined' &&
			typeof navigator !== 'undefined' &&
			typeof navigator.mediaDevices?.getUserMedia === 'function' &&
			typeof MediaRecorder !== 'undefined'
		);
	}

	function getSupportedMimeType(): string | null {
		if (!isRecordingSupported()) return null;

		if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
			return 'audio/webm;codecs=opus';
		}

		if (MediaRecorder.isTypeSupported('audio/webm')) {
			return 'audio/webm';
		}

		if (MediaRecorder.isTypeSupported('audio/mp4')) {
			return 'audio/mp4';
		}

		return null;
	}

	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function updateAudioLevel() {
		if (!analyser) return;

		const dataArray = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(dataArray);

		// Calculate average level
		const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
		audioLevel = Math.min(100, (average / 128) * 100);

		if (isRecording && !isPaused) {
			animationFrame = requestAnimationFrame(updateAudioLevel);
		}
	}

	async function requestMicrophoneAccess(): Promise<MediaStream> {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			});
			hasPermission = true;
			return stream;
		} catch (err) {
			hasPermission = false;
			if (err instanceof Error) {
				if (err.name === 'NotAllowedError') {
					throw new Error('Microphone access denied. Please allow microphone access in your browser settings.');
				} else if (err.name === 'NotFoundError') {
					throw new Error('No microphone found. Please connect a microphone and try again.');
				}
			}
			throw new Error('Could not access microphone');
		}
	}

	async function startRecording() {
		error = null;
		audioChunks = [];

		try {
			const mimeType = getSupportedMimeType();
			if (!mimeType) {
				throw new Error('This browser does not support in-app audio recording.');
			}

			mediaStream = await requestMicrophoneAccess();

			// Set up audio analysis for level meter
			audioContext = new AudioContext();
			const source = audioContext.createMediaStreamSource(mediaStream);
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;
			source.connect(analyser);

			mediaRecorder = new MediaRecorder(mediaStream, { mimeType });

			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					audioChunks.push(e.data);
				}
			};

			mediaRecorder.onstop = () => {
				const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
				const extension = blob.type.includes('webm') ? 'webm' : 'mp4';
				const fileName = `recording_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.${extension}`;
				const file = new File([blob], fileName, { type: blob.type });

				// Clear previous state and load recording
				regionsStore.clear();
				audioStore.setFile(file);

				cleanup();
			};

			mediaRecorder.start(100); // Collect data every 100ms
			isRecording = true;
			isPaused = false;
			recordingTime = 0;

			// Start timer
			timerInterval = setInterval(() => {
				if (!isPaused) {
					recordingTime++;
				}
			}, 1000);

			// Start audio level monitoring
			updateAudioLevel();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to start recording';
			cleanup();
		}
	}

	function pauseRecording() {
		if (mediaRecorder && mediaRecorder.state === 'recording') {
			mediaRecorder.pause();
			isPaused = true;
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
				animationFrame = null;
			}
		}
	}

	function resumeRecording() {
		if (mediaRecorder && mediaRecorder.state === 'paused') {
			mediaRecorder.resume();
			isPaused = false;
			updateAudioLevel();
		}
	}

	function stopRecording() {
		if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
			mediaRecorder.stop();
		}
		isRecording = false;
		isPaused = false;
	}

	function cancelRecording() {
		if (mediaRecorder) {
			mediaRecorder.ondataavailable = null;
			mediaRecorder.onstop = null;
			if (mediaRecorder.state !== 'inactive') {
				mediaRecorder.stop();
			}
		}
		cleanup();
	}

	function cleanup() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = null;
		}
		if (mediaStream) {
			mediaStream.getTracks().forEach((track) => track.stop());
			mediaStream = null;
		}
		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}
		analyser = null;
		mediaRecorder = null;
		isRecording = false;
		isPaused = false;
		recordingTime = 0;
		audioLevel = 0;
	}

	// Cleanup on component destroy
	$effect(() => {
		return () => {
			cleanup();
		};
	});
</script>

{#if !isRecording}
	<button
		class="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-500"
		onclick={startRecording}
		disabled={!isRecordingSupported()}
	>
		<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
			<circle cx="12" cy="12" r="6" />
		</svg>
		Record Voice
	</button>
{:else}
	<div class="flex flex-col gap-3 rounded-lg bg-gray-800 p-4">
		<!-- Recording indicator and timer -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="relative flex h-4 w-4 items-center justify-center">
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
						class:hidden={isPaused}
					></span>
					<span class="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
				</div>
				<span class="font-mono text-lg font-medium text-white">
					{formatTime(recordingTime)}
				</span>
				{#if isPaused}
					<span class="text-sm text-yellow-400">Paused</span>
				{/if}
			</div>
		</div>

		<!-- Audio level meter -->
		<div class="h-2 overflow-hidden rounded-full bg-gray-700">
			<div
				class="h-full rounded-full transition-all duration-75"
				class:bg-green-500={audioLevel < 70}
				class:bg-yellow-500={audioLevel >= 70 && audioLevel < 90}
				class:bg-red-500={audioLevel >= 90}
				style="width: {audioLevel}%"
			></div>
		</div>

		<!-- Controls -->
		<div class="flex items-center gap-2">
			{#if isPaused}
				<button
					class="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-500"
					onclick={resumeRecording}
				>
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M8 5v14l11-7z" />
					</svg>
					Resume
				</button>
			{:else}
				<button
					class="flex items-center gap-1 rounded bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-yellow-500"
					onclick={pauseRecording}
				>
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M6 4h4v16H6zm8 0h4v16h-4z" />
					</svg>
					Pause
				</button>
			{/if}

			<button
				class="flex items-center gap-1 rounded bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500"
				onclick={stopRecording}
			>
				<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
					<rect x="6" y="6" width="12" height="12" />
				</svg>
				Done
			</button>

			<button
				class="flex items-center gap-1 rounded bg-gray-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-500"
				onclick={cancelRecording}
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
				Cancel
			</button>
		</div>
	</div>
{/if}

{#if error}
	<p class="mt-2 text-sm text-red-400">{error}</p>
{/if}

{#if hasPermission === false}
	<p class="mt-2 text-sm text-gray-400">
		To enable recording, please allow microphone access in your browser settings and refresh the page.
	</p>
{/if}

{#if !isRecordingSupported()}
	<p class="mt-2 text-sm text-gray-400">
		This browser does not support microphone recording in SoundCutter.
	</p>
{/if}
