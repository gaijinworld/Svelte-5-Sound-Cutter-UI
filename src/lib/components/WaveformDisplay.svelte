<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import WaveSurfer from 'wavesurfer.js';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';
	import { formatTimecode, parseTimecode } from '$lib/utils/time';

	let container = $state<HTMLDivElement | undefined>(undefined);
	let wavesurfer = $state<WaveSurfer | null>(null);
	let isReady = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let zoomLevel = $state(1);

	const MIN_ZOOM = 1;
	const MAX_ZOOM = 500;
	const DEFAULT_SAMPLE_RATE = 44_100;

	let selectedPoint = $derived(
		splitStore.points.find((point) => point.id === splitStore.selectedPointId) ?? null
	);

	function initWaveSurfer() {
		if (!container) return;

		wavesurfer = WaveSurfer.create({
			container,
			waveColor: '#dc5a16',
			progressColor: '#2563eb',
			cursorColor: '#111827',
			cursorWidth: 2,
			height: 210,
			barWidth: 2,
			barGap: 1,
			barRadius: 1,
			normalize: true,
			minPxPerSec: 1,
			sampleRate: DEFAULT_SAMPLE_RATE
		});

		wavesurfer.on('ready', () => {
			isReady = true;
			isLoading = false;
			errorMessage = null;
			audioStore.setBuffer(wavesurfer?.getDecodedData() ?? null);
			audioStore.setCurrentTime(0);
		});

		wavesurfer.on('loading', () => {
			isLoading = true;
		});

		wavesurfer.on('play', () => audioStore.setPlaying(true));
		wavesurfer.on('pause', () => audioStore.setPlaying(false));
		wavesurfer.on('timeupdate', (time) => audioStore.setCurrentTime(time));
		wavesurfer.on('finish', () => audioStore.setPlaying(false));

		wavesurfer.on('error', (error) => {
			isLoading = false;
			isReady = false;
			errorMessage = error instanceof Error ? error.message : 'Failed to load audio file';
		});
	}

	function handleWheel(event: WheelEvent) {
		if (!wavesurfer || !isReady) return;
		event.preventDefault();

		const factor = event.deltaY < 0 ? 1.2 : 0.8;
		const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * factor));
		if (next === zoomLevel) return;

		zoomLevel = next;
		wavesurfer.zoom(zoomLevel);
	}

	function markerLeft(time: number): number {
		if (audioStore.duration <= 0) return 0;
		return Math.max(0, Math.min(100, (time / audioStore.duration) * 100));
	}

	function commitSelectedPointTime(event: Event) {
		if (!selectedPoint) return;
		const input = event.currentTarget as HTMLInputElement;
		const parsed = parseTimecode(input.value);

		if (parsed === null || !splitStore.update(selectedPoint.id, parsed)) {
			input.value = formatTimecode(selectedPoint.time);
		}
	}

	$effect(() => {
		const objectUrl = audioStore.objectUrl;
		const ws = wavesurfer;
		if (!objectUrl || !ws) return;

		isLoading = true;
		isReady = false;
		errorMessage = null;
		zoomLevel = 1;
		splitStore.selectPoint(null);
		ws.load(objectUrl);
	});

	onMount(initWaveSurfer);

	onDestroy(() => {
		wavesurfer?.destroy();
	});

	export function play() {
		wavesurfer?.play();
	}

	export function pause() {
		wavesurfer?.pause();
	}

	export function stop() {
		wavesurfer?.stop();
		audioStore.setCurrentTime(0);
	}

	export function seekTo(time: number) {
		if (!wavesurfer || audioStore.duration <= 0) return;
		const safeTime = Math.max(0, Math.min(audioStore.duration, time));
		wavesurfer.seekTo(safeTime / audioStore.duration);
		audioStore.setCurrentTime(safeTime);
	}

	export function zoom(level: number) {
		zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
		wavesurfer?.zoom(zoomLevel);
	}
</script>

<div class="relative flex h-full min-h-[330px] flex-col bg-white">
	{#if isLoading}
		<div class="absolute inset-0 z-30 flex items-center justify-center bg-white/85">
			<div class="flex items-center gap-3 text-sm text-gray-600">
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
				<span>Loading waveform…</span>
			</div>
		</div>
	{/if}

	<div class="relative flex-1 overflow-hidden">
		<div
			bind:this={container}
			class="waveform-container h-full min-h-[230px] w-full overflow-x-auto"
			onwheel={handleWheel}
			role="application"
			aria-label="MP3 waveform. Use the mouse wheel to zoom and click to seek."
		></div>

		{#if isReady && audioStore.duration > 0}
			<div class="pointer-events-none absolute inset-0 z-20">
				{#each splitStore.points as point (point.id)}
					<button
						class={`pointer-events-auto absolute top-0 h-full w-5 -translate-x-1/2 cursor-pointer border-0 bg-transparent p-0 ${
							point.id === splitStore.selectedPointId ? 'z-20' : 'z-10'
						}`}
						style={`left: ${markerLeft(point.time)}%`}
						onclick={(event) => {
							event.stopPropagation();
							splitStore.selectPoint(point.id);
						}}
						title={`Split point ${formatTimecode(point.time)}`}
						aria-label={`Select split point at ${formatTimecode(point.time)}`}
					>
						<span
							class={`absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 ${
								point.id === splitStore.selectedPointId ? 'bg-red-600' : 'bg-blue-600'
							}`}
						></span>
						<span
							class={`absolute left-1/2 top-1 -translate-x-1/2 rounded px-1 py-0.5 text-[10px] font-semibold text-white ${
								point.id === splitStore.selectedPointId ? 'bg-red-600' : 'bg-blue-600'
							}`}
						>
							{splitStore.points.findIndex((candidate) => candidate.id === point.id) + 1}
						</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 text-xs text-gray-500">
		<span class="font-mono">{formatTimecode(audioStore.currentTime)}</span>
		<div class="flex items-center gap-3">
			<span>{zoomLevel > 1 ? `${Math.round(zoomLevel)}× zoom` : 'Scroll to zoom'}</span>
			{#if zoomLevel > 1}
				<button class="text-blue-700 hover:underline" onclick={() => zoom(1)}>Reset zoom</button>
			{/if}
		</div>
		<span class="font-mono">{formatTimecode(audioStore.duration)}</span>
	</div>

	{#if selectedPoint}
		<div class="mt-2 flex flex-wrap items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
			<span class="font-medium text-blue-900">Selected split point</span>
			<input
				class="w-36 rounded border border-blue-300 bg-white px-2 py-1 font-mono"
				value={formatTimecode(selectedPoint.time)}
				onchange={commitSelectedPointTime}
				aria-label="Selected split point time"
			/>
			<button
				class="rounded border border-red-300 bg-white px-2 py-1 text-red-700 hover:bg-red-50"
				onclick={() => splitStore.remove(selectedPoint.id)}
			>
				Delete split point
			</button>
		</div>
	{/if}

	{#if errorMessage}
		<div class="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
			{errorMessage}
		</div>
	{/if}
</div>
