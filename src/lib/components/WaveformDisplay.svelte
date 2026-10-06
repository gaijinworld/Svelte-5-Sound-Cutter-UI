<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import WaveSurfer from 'wavesurfer.js';
	import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';
	import { formatTimecode, parseTimecode } from '$lib/utils/time';

	let container = $state<HTMLDivElement | undefined>(undefined);
	let wavesurfer = $state<WaveSurfer | null>(null);
	let isReady = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let zoomPercent = $state(100);
	let zoomSelect = $state('100');
	let showTopRuler = $state(false);
	let showBottomRuler = $state(false);

	// Scroll-space metrics of the waveform content — used to keep split
	// markers glued to their timestamps and to drive the custom scrollbar.
	let scrollLeft = $state(0);
	let viewportWidth = $state(0);
	let contentWidth = $state(0);

	const scrollable = $derived(contentWidth > viewportWidth + 1);
	const thumbWidthPct = $derived(
		contentWidth > 0 ? Math.min(100, (viewportWidth / contentWidth) * 100) : 100
	);
	const thumbLeftPct = $derived(
		contentWidth > 0 ? Math.min(100 - thumbWidthPct, (scrollLeft / contentWidth) * 100) : 0
	);

	const MIN_ZOOM_PCT = 25;
	const MAX_ZOOM_PCT = 500;
	const MAX_PX_PER_SEC = 500;
	const WHEEL_ZOOM_STEP = 1.4;
	const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200, 300, 400, 500];
	const DEFAULT_SAMPLE_RATE = 44_100;

	// Set right after a wheel zoom so the content fraction under the cursor
	// stays put; consumed on the next redrawcomplete.
	let pendingAnchor: { frac: number; x: number } | null = null;

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
			height: 'auto',
			barWidth: 2,
			barGap: 1,
			barRadius: 1,
			normalize: true,
			minPxPerSec: 1,
			// Disabled so zoom percentages below 100% can render the wave
			// narrower than the pane; 100% is applied explicitly on ready.
			fillParent: false,
			hideScrollbar: true,
			sampleRate: DEFAULT_SAMPLE_RATE
		});

		wavesurfer.on('ready', () => {
			isReady = true;
			isLoading = false;
			errorMessage = null;
			audioStore.setBuffer(wavesurfer?.getDecodedData() ?? null);
			audioStore.setCurrentTime(0);
			syncScrollMetrics();
			applyZoomPercent(100);
		});

		wavesurfer.on('scroll', () => {
			scrollLeft = wavesurfer?.getScroll() ?? 0;
		});
		wavesurfer.on('redrawcomplete', () => {
			syncScrollMetrics();
			if (pendingAnchor && wavesurfer) {
				const { frac, x } = pendingAnchor;
				pendingAnchor = null;
				wavesurfer.setScroll(frac * contentWidth - x);
			}
		});
		wavesurfer.on('resize', () => {
			syncScrollMetrics();
			// Keep the selected zoom proportion when the pane resizes
			// (100% always re-fits the file to the new width).
			applyZoomPercent(zoomPercent);
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

	function fitPxPerSec(): number {
		return viewportWidth > 0 && audioStore.duration > 0
			? viewportWidth / audioStore.duration
			: 1;
	}

	function applyZoomPercent(percent: number) {
		if (!wavesurfer) return;
		zoomPercent = Math.max(MIN_ZOOM_PCT, Math.min(MAX_ZOOM_PCT, percent));
		zoomSelect = String(Math.round(zoomPercent));
		wavesurfer.zoom(
			Math.max(0.5, Math.min(MAX_PX_PER_SEC, (fitPxPerSec() * zoomPercent) / 100))
		);
	}

	function handleWheel(event: WheelEvent) {
		if (!wavesurfer || !isReady || !container) return;
		event.preventDefault();

		// Anchor the zoom at the cursor: record the content fraction under
		// the pointer so it stays stationary through the redraw.
		const rect = container.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		pendingAnchor = { frac: (scrollLeft + mouseX) / Math.max(1, contentWidth), x: mouseX };

		applyZoomPercent(zoomPercent * (event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP));
	}

	// Markers live in an overlay over the *visible* part of the waveform, so
	// their px position = content offset - scroll offset. Returns null when
	// the marker is scrolled out of view.
	function markerScreenX(time: number): number | null {
		if (audioStore.duration <= 0 || contentWidth <= 0) return null;
		const x = (time / audioStore.duration) * contentWidth - scrollLeft;
		if (x < -16 || x > viewportWidth + 16) return null;
		return x;
	}

	function syncScrollMetrics() {
		if (!wavesurfer) return;
		scrollLeft = wavesurfer.getScroll();
		viewportWidth = wavesurfer.getWidth();
		contentWidth = wavesurfer.getWrapper()?.getBoundingClientRect().width ?? 0;
	}

	function startThumbDrag(event: PointerEvent) {
		event.preventDefault();
		event.stopPropagation();
		const thumb = event.currentTarget as HTMLElement;
		const track = thumb.parentElement as HTMLElement;
		thumb.setPointerCapture(event.pointerId);

		const startX = event.clientX;
		const startScroll = scrollLeft;
		const trackW = track.clientWidth;
		const thumbW = thumb.offsetWidth;
		const maxScroll = Math.max(0, contentWidth - viewportWidth);
		const travel = Math.max(1, trackW - thumbW);

		const move = (e: PointerEvent) => {
			const ratio = (e.clientX - startX) / travel;
			wavesurfer?.setScroll(Math.max(0, Math.min(maxScroll, startScroll + ratio * maxScroll)));
		};
		const end = () => {
			thumb.removeEventListener('pointermove', move);
			thumb.removeEventListener('pointerup', end);
			thumb.removeEventListener('pointercancel', end);
		};
		thumb.addEventListener('pointermove', move);
		thumb.addEventListener('pointerup', end);
		thumb.addEventListener('pointercancel', end);
	}

	function handleTrackPointerDown(event: PointerEvent) {
		const track = event.currentTarget as HTMLElement;
		const rect = track.getBoundingClientRect();
		const targetScroll = ((event.clientX - rect.left) / rect.width) * contentWidth - viewportWidth / 2;
		wavesurfer?.setScroll(Math.max(0, Math.min(contentWidth - viewportWidth, targetScroll)));
	}

	function commitSelectedPointTime(event: Event) {
		if (!selectedPoint) return;
		const input = event.currentTarget as HTMLInputElement;
		const parsed = parseTimecode(input.value);

		if (parsed === null || !splitStore.update(selectedPoint.id, parsed)) {
			input.value = formatTimecode(selectedPoint.time);
		}
	}

	// Timestamp rulers — independent top/bottom TimelinePlugin instances,
	// recreated whenever the toggles or the wavesurfer instance change.
	// Label font = height/2 internally; style overrides land on the ruler
	// container (inside the wavesurfer shadow root), so spacing/size/colour
	// must all come through plugin options.
	const rulerOptions = (insertPosition: 'beforebegin' | 'afterend') => ({
		insertPosition,
		height: 30,
		formatTimeCallback: formatTimecode,
		primaryLabelSpacing: 96,
		secondaryLabelSpacing: 48,
		secondaryLabelOpacity: 0.35,
		style: {
			fontSize: '12px',
			fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
			fontWeight: '500',
			color: '#1f2937',
			backgroundColor: '#f8fafc',
			paddingTop: '3px',
			paddingBottom: '2px',
			...(insertPosition === 'beforebegin'
				? { borderBottom: '1px solid #e5e7eb' }
				: { borderTop: '1px solid #e5e7eb' })
		}
	});

	$effect(() => {
		const ws = wavesurfer;
		if (!ws) return;
		const top = showTopRuler
			? ws.registerPlugin(TimelinePlugin.create(rulerOptions('beforebegin')))
			: null;
		const bottom = showBottomRuler
			? ws.registerPlugin(TimelinePlugin.create(rulerOptions('afterend')))
			: null;
		return () => {
			top?.destroy();
			bottom?.destroy();
		};
	});

	$effect(() => {
		const objectUrl = audioStore.objectUrl;
		const ws = wavesurfer;
		if (!objectUrl || !ws) return;

		isLoading = true;
		isReady = false;
		errorMessage = null;
		zoomPercent = 100;
		zoomSelect = '100';
		pendingAnchor = null;
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

	<div class="relative flex flex-1 flex-col overflow-hidden">
		<div
			bind:this={container}
			id="mp3s-waveform-scroll"
			class="waveform-container w-full min-h-[230px] flex-1 overflow-x-auto"
			onwheel={handleWheel}
			role="application"
			aria-label="MP3 waveform. Use the mouse wheel to zoom and click to seek."
		></div>

		{#if isReady && audioStore.duration > 0}
			<div class="pointer-events-none absolute inset-0 z-20">
				{#each splitStore.points as point (point.id)}
					{@const x = markerScreenX(point.time)}
					{#if x !== null}
						<button
							class={`pointer-events-auto absolute top-0 h-full w-5 -translate-x-1/2 cursor-pointer border-0 bg-transparent p-0 ${
								point.id === splitStore.selectedPointId ? 'z-20' : 'z-10'
							}`}
							style={`left: ${x}px`}
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
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	{#if scrollable}
		<div
			class="relative mt-1.5 h-2.5 shrink-0 touch-none select-none rounded-full bg-gray-200"
			role="scrollbar"
			aria-orientation="horizontal"
			aria-label="Scroll waveform horizontally"
			aria-controls="mp3s-waveform-scroll"
			aria-valuemin={0}
			aria-valuemax={Math.round(contentWidth - viewportWidth)}
			aria-valuenow={Math.round(scrollLeft)}
			tabindex="0"
			onpointerdown={handleTrackPointerDown}
		>
			<div
				class="absolute top-0 h-full cursor-grab rounded-full bg-gray-400 transition-colors hover:bg-blue-500/80 active:cursor-grabbing active:bg-blue-500"
				style={`left: ${thumbLeftPct}%; width: ${thumbWidthPct}%`}
				onpointerdown={startThumbDrag}
			></div>
		</div>
	{/if}

	<div class="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-gray-200 pt-2 text-xs text-gray-500">
		<span class="font-mono">{formatTimecode(audioStore.currentTime)}</span>
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
			<label class="flex cursor-pointer items-center gap-1 select-none">
				<input type="checkbox" class="accent-blue-600" bind:checked={showTopRuler} />
				Top ruler
			</label>
			<label class="flex cursor-pointer items-center gap-1 select-none">
				<input type="checkbox" class="accent-blue-600" bind:checked={showBottomRuler} />
				Bottom ruler
			</label>
			<label class="flex items-center gap-1 select-none">
				Zoom
				<select
					class="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-gray-700"
					bind:value={zoomSelect}
					onchange={(event) => applyZoomPercent(Number(event.currentTarget.value))}
					aria-label="Zoom level (100% = fit file to pane)"
				>
					{#each ZOOM_PRESETS as preset (preset)}
						<option value={String(preset)}>{preset}%</option>
					{/each}
					{#if !ZOOM_PRESETS.includes(Math.round(zoomPercent))}
						<option value={String(Math.round(zoomPercent))}>{Math.round(zoomPercent)}%</option>
					{/if}
				</select>
			</label>
			{#if Math.round(zoomPercent) !== 100}
				<button class="text-blue-700 hover:underline" onclick={() => applyZoomPercent(100)}>Fit</button>
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
