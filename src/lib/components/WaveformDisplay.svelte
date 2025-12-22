<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import WaveSurfer from 'wavesurfer.js';
	import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { regionsStore } from '$lib/stores/regionsStore.svelte';

	let container = $state<HTMLDivElement | undefined>(undefined);
	let minimapCanvas = $state<HTMLCanvasElement | undefined>(undefined);
	let wavesurfer = $state<WaveSurfer | null>(null);
	let regionsPlugin: RegionsPlugin | null = null;
	let isReady = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let loopRegionId = $state<string | null>(null);

	const DEFAULT_SAMPLE_RATE = 44100;

	// Zoom state
	let zoomLevel = $state(1);
	let scrollLeft = $state(0);
	let visibleWidth = $state(1);
	const MIN_ZOOM = 1;
	const MAX_ZOOM = 500;

	// Format time as mm:ss.ms
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		const ms = Math.floor((seconds % 1) * 100);
		return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
	}

	function applyLoopMode() {
		if (!wavesurfer) return;
		wavesurfer.getMediaElement().loop = audioStore.loopPlayback && loopRegionId === null;
	}

	function playRegionInternal(regionId: string) {
		const region = regionsPlugin?.getRegions().find((r) => r.id === regionId);
		if (!region) return;

		loopRegionId = audioStore.loopPlayback ? region.id : null;
		applyLoopMode();
		region.play(true); // true = stop at region end
	}

	function initWaveSurfer() {
		if (!container) return;

		// Initialize regions plugin
		regionsPlugin = RegionsPlugin.create();

		// Create WaveSurfer instance
		wavesurfer = WaveSurfer.create({
			container,
			waveColor: '#4ade80',
			progressColor: '#22d3ee',
			cursorColor: '#f472b6',
			cursorWidth: 2,
			height: 128,
			barWidth: 2,
			barGap: 1,
			barRadius: 2,
			normalize: true,
			minPxPerSec: 1,
			sampleRate: DEFAULT_SAMPLE_RATE,
			plugins: [regionsPlugin]
		});

		// Events
		wavesurfer.on('ready', () => {
			isReady = true;
			isLoading = false;
			audioStore.setBuffer(wavesurfer?.getDecodedData() ?? null);
			applyLoopMode();
			updateViewport();
			drawMinimap();
		});

		wavesurfer.on('loading', () => {
			isLoading = true;
		});

		wavesurfer.on('play', () => {
			audioStore.setPlaying(true);
		});

		wavesurfer.on('pause', () => {
			audioStore.setPlaying(false);
		});

		wavesurfer.on('timeupdate', (time) => {
			audioStore.setCurrentTime(time);
		});

		wavesurfer.on('finish', () => {
			audioStore.setPlaying(false);
		});

		wavesurfer.on('scroll', () => {
			updateViewport();
		});

		wavesurfer.on('zoom', () => {
			updateViewport();
		});

		wavesurfer.on('error', (err) => {
			console.error('WaveSurfer error:', err);
			isLoading = false;
			isReady = false;
			errorMessage = err instanceof Error ? err.message : 'Failed to load audio file';
		});

		// Region events
		regionsPlugin.on('region-created', (region) => {
			const existing = regionsStore.regions.find((r) => r.id === region.id);
			if (!existing) {
				const newRegion = regionsStore.add(region.start, region.end);
				region.id = newRegion.id;
				region.setOptions({ color: newRegion.color });
			}
			drawMinimap();
		});

		regionsPlugin.on('region-updated', (region) => {
			regionsStore.update(region.id, {
				start: region.start,
				end: region.end
			});
			drawMinimap();
		});

		regionsPlugin.on('region-clicked', (region, e) => {
			e.stopPropagation();
			regionsStore.select(region.id);
		});

		// Double-click to play region
		regionsPlugin.on('region-double-clicked', (region, e) => {
			e.stopPropagation();
			regionsStore.select(region.id);
			playRegionInternal(region.id);
		});

		regionsPlugin.on('region-out', (region) => {
			if (loopRegionId === region.id && audioStore.loopPlayback && audioStore.isPlaying) {
				region.play(true);
			}
		});

		regionsPlugin.enableDragSelection({
			color: 'rgba(255, 99, 132, 0.4)'
		});
	}

	function updateViewport() {
		if (!wavesurfer || !container) return;

		const wrapper = container.querySelector('div');
		if (!wrapper) return;

		const scrollWidth = wrapper.scrollWidth;
		const clientWidth = wrapper.clientWidth;

		scrollLeft = wrapper.scrollLeft / scrollWidth;
		visibleWidth = clientWidth / scrollWidth;

		drawMinimap();
	}

	function handleWheel(e: WheelEvent) {
		if (!wavesurfer || !isReady) return;

		e.preventDefault();

		// Zoom in/out based on wheel direction
		const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
		const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * zoomFactor));

		if (newZoom !== zoomLevel) {
			zoomLevel = newZoom;
			wavesurfer.zoom(zoomLevel);
		}
	}

	function drawMinimap() {
		if (!minimapCanvas || !isReady) return;

		const ctx = minimapCanvas.getContext('2d');
		if (!ctx) return;

		const width = minimapCanvas.width;
		const height = minimapCanvas.height;

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Draw background
		ctx.fillStyle = '#1f2937';
		ctx.fillRect(0, 0, width, height);

		// Draw simplified waveform representation
		ctx.fillStyle = '#4ade80';
		const buffer = audioStore.buffer;
		if (buffer) {
			const data = buffer.getChannelData(0);
			const step = Math.ceil(data.length / width);
			const amp = height / 2;

			for (let i = 0; i < width; i++) {
				let min = 1.0;
				let max = -1.0;
				for (let j = 0; j < step; j++) {
					const datum = data[i * step + j];
					if (datum < min) min = datum;
					if (datum > max) max = datum;
				}
				const y = (1 + min) * amp;
				const h = Math.max(1, (max - min) * amp);
				ctx.fillRect(i, y, 1, h);
			}
		}

		// Draw regions on minimap
		const regions = regionsStore.regions;
		const duration = audioStore.duration;
		if (duration > 0) {
			regions.forEach((region) => {
				const x = (region.start / duration) * width;
				const w = ((region.end - region.start) / duration) * width;
				ctx.fillStyle = region.color;
				ctx.fillRect(x, 0, Math.max(1, w), height);
			});
		}

		// Draw viewport rectangle
		const viewX = scrollLeft * width;
		const viewW = visibleWidth * width;

		// Viewport border
		ctx.strokeStyle = '#22d3ee';
		ctx.lineWidth = 2;
		ctx.strokeRect(viewX, 0, viewW, height);

		// Viewport fill
		ctx.fillStyle = 'rgba(34, 211, 238, 0.15)';
		ctx.fillRect(viewX, 0, viewW, height);
	}

	function handleMinimapClick(e: MouseEvent) {
		if (!wavesurfer || !minimapCanvas || !isReady) return;

		const rect = minimapCanvas.getBoundingClientRect();
		const x = (e.clientX - rect.left) / rect.width;

		// Seek to clicked position
		wavesurfer.seekTo(x);
	}

	// Redraw minimap when regions change
	$effect(() => {
		// Track regions to trigger redraw
		regionsStore.regions;
		drawMinimap();
	});

	// Load audio when file changes or wavesurfer becomes available
	$effect(() => {
		const url = audioStore.objectUrl;
		const ws = wavesurfer;
		if (url && ws) {
			isLoading = true;
			isReady = false;
			errorMessage = null;
			zoomLevel = 1;
			loopRegionId = null;
			ws.load(url);
		}
	});

	// Keep loop mode in sync when toggle changes
	$effect(() => {
		audioStore.loopPlayback;
		if (!audioStore.loopPlayback) {
			loopRegionId = null;
		}
		applyLoopMode();
	});

	// Sync regions from store to WaveSurfer when store changes externally
	$effect(() => {
		const storeRegions = regionsStore.regions;
		if (!regionsPlugin || !isReady) return;

		const wsRegions = regionsPlugin.getRegions();

		wsRegions.forEach((wsRegion) => {
			if (!storeRegions.find((r) => r.id === wsRegion.id)) {
				wsRegion.remove();
			}
		});

		storeRegions.forEach((storeRegion) => {
			const existing = wsRegions.find((r) => r.id === storeRegion.id);
			if (existing) {
				if (existing.start !== storeRegion.start || existing.end !== storeRegion.end) {
					existing.setOptions({
						start: storeRegion.start,
						end: storeRegion.end
					});
				}
				existing.setOptions({ color: storeRegion.color });
			}
		});
	});

	// Highlight selected region
	$effect(() => {
		const selectedId = regionsStore.selectedId;
		if (!regionsPlugin || !isReady) return;

		regionsPlugin.getRegions().forEach((region) => {
			const storeRegion = regionsStore.regions.find((r) => r.id === region.id);
			if (storeRegion) {
				const isSelected = region.id === selectedId;
				const baseColor = storeRegion.color;
				const color = isSelected ? baseColor.replace('0.4', '0.6') : baseColor;
				region.setOptions({ color });
			}
		});
	});

	onMount(() => {
		initWaveSurfer();
	});

	onDestroy(() => {
		wavesurfer?.destroy();
	});

	// Export methods for transport controls
	export function play() {
		loopRegionId = null;
		applyLoopMode();
		wavesurfer?.play();
	}

	export function pause() {
		wavesurfer?.pause();
	}

	export function stop() {
		loopRegionId = null;
		applyLoopMode();
		wavesurfer?.stop();
	}

	export function playRegion(regionId: string) {
		playRegionInternal(regionId);
	}

	export function seekTo(time: number) {
		if (wavesurfer && audioStore.duration > 0) {
			wavesurfer.seekTo(time / audioStore.duration);
		}
	}

	export function zoom(level: number) {
		zoomLevel = level;
		wavesurfer?.zoom(level);
	}
</script>

<div class="relative rounded-lg bg-gray-900 p-4">
	{#if isLoading}
		<div class="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/80">
			<div class="flex items-center gap-3">
				<div
					class="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"
				></div>
				<span class="text-gray-300">Loading audio...</span>
			</div>
		</div>
	{/if}

	<!-- Main waveform with wheel zoom -->
	<div
		bind:this={container}
		class="waveform-container w-full"
		onwheel={handleWheel}
		role="application"
		aria-label="Audio waveform - use mouse wheel to zoom"
	></div>

	{#if isReady}
		<!-- Time display and zoom info -->
		<div class="mt-2 flex items-center justify-between text-sm text-gray-400">
			<span>{formatTime(audioStore.currentTime)}</span>
			<span class="text-xs text-gray-500">
				{zoomLevel > 1 ? `${Math.round(zoomLevel)}x zoom` : 'Scroll to zoom'}
			</span>
			<span>{formatTime(audioStore.duration)}</span>
		</div>

		<!-- Minimap / Overview HUD -->
		<div class="mt-3">
			<div class="mb-1 flex items-center justify-between">
				<span class="text-xs text-gray-500">Overview</span>
				{#if zoomLevel > 1}
					<button
						class="text-xs text-cyan-400 hover:text-cyan-300"
						onclick={() => zoom(1)}
					>
						Reset zoom
					</button>
				{/if}
			</div>
			<button
				class="relative block h-10 w-full cursor-pointer overflow-hidden rounded border border-gray-700 bg-gray-800"
				onclick={handleMinimapClick}
				aria-label="Click to seek in audio"
			>
				<canvas
					bind:this={minimapCanvas}
					width="400"
					height="40"
					class="h-full w-full"
				></canvas>
			</button>
		</div>
	{:else if errorMessage}
		<div class="flex h-32 flex-col items-center justify-center gap-2">
			<svg class="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<span class="text-red-400">{errorMessage}</span>
			<span class="text-xs text-gray-500">Try uploading a different audio file</span>
		</div>
	{:else if !audioStore.file}
		<div class="flex h-32 items-center justify-center text-gray-500">
			Upload an audio file to see the waveform
		</div>
	{/if}
</div>

<style>
	.waveform-container :global(wave) {
		cursor: crosshair !important;
	}
</style>
