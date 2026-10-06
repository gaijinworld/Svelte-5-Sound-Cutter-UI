<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import WaveSurfer from 'wavesurfer.js';
	import { decodeToWavBlob } from '$lib/audio/ffmpegDecode';
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';
	import { detectAudioFormat, needsWasmDecode } from '$lib/utils/audioFormat';
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

	// Preview decode path: native object URL first; formats the browser
	// cannot decode (WMA/ASF, or any decodeAudioData rejection) are
	// transcoded to WAV via ffmpeg.wasm for display only.
	let previewUrl: string | null = null;
	let wasmFallbackUsed = false;
	let loadNote = $state<string | null>(null);

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
			const file = audioStore.file;
			if (file && !wasmFallbackUsed && wavesurfer) {
				// Native decode failed — try ffmpeg.wasm once (WMA, odd AAC/ALAC…).
				wasmFallbackUsed = true;
				void previewViaWasm(file);
				return;
			}
			isLoading = false;
			isReady = false;
			loadNote = null;
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

	// Timestamp rulers — custom strips rendered as regular DOM siblings of
	// the waveform (NOT inside the wavesurfer shadow root, which clipped and
	// overlaid the old TimelinePlugin rulers). Ticks are positioned in
	// scroll-space like the markers, so they track zoom and pan exactly.
	const RULER_LABEL_W = 76;
	const RULER_MIN_TICK_PX = 96;
	const RULER_INTERVALS_S = [
		0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200,
		1800, 3600
	];

	const rulerTicks = $derived.by(() => {
		if (!isReady || audioStore.duration <= 0 || contentWidth <= 0 || viewportWidth <= 0) {
			return [];
		}
		const pxPerSec = contentWidth / audioStore.duration;
		const interval =
			RULER_INTERVALS_S.find((s) => s * pxPerSec >= RULER_MIN_TICK_PX) ??
			RULER_INTERVALS_S[RULER_INTERVALS_S.length - 1];
		const firstT = Math.max(0, scrollLeft / pxPerSec);
		const lastT = Math.min(audioStore.duration, (scrollLeft + viewportWidth) / pxPerSec);
		const ticks: { t: number; x: number; labelLeft: number; label: string }[] = [];
		for (let t = Math.floor(firstT / interval) * interval; t <= lastT + 1e-9; t += interval) {
			const snapped = Math.round(t * 1e6) / 1e6;
			const x = snapped * pxPerSec - scrollLeft;
			ticks.push({
				t: snapped,
				x,
				labelLeft: Math.max(
					2,
					Math.min(viewportWidth - RULER_LABEL_W - 2, x - RULER_LABEL_W / 2)
				),
				label: formatTimecode(snapped)
			});
		}
		return ticks;
	});

	async function previewViaWasm(file: File) {
		if (!wavesurfer) return;
		try {
			isLoading = true;
			loadNote = 'Browser cannot decode this format — converting via FFmpeg…';
			const blob = await decodeToWavBlob(file);
			if (audioStore.file !== file) return; // user picked another file meanwhile
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = URL.createObjectURL(blob);
			loadNote = null;
			wavesurfer.load(previewUrl);
		} catch (error) {
			isLoading = false;
			loadNote = null;
			errorMessage =
				error instanceof Error ? error.message : 'Could not decode this audio file.';
		}
	}

	$effect(() => {
		const file = audioStore.file;
		const objectUrl = audioStore.objectUrl;
		const ws = wavesurfer;
		if (!file || !objectUrl || !ws) return;

		isLoading = true;
		isReady = false;
		errorMessage = null;
		loadNote = null;
		zoomPercent = 100;
		zoomSelect = '100';
		pendingAnchor = null;
		wasmFallbackUsed = false;
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
		splitStore.selectPoint(null);
		if (needsWasmDecode(detectAudioFormat(file))) {
			wasmFallbackUsed = true;
			void previewViaWasm(file);
		} else {
			ws.load(objectUrl);
		}
	});

	onMount(initWaveSurfer);

	onDestroy(() => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
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
				<span>{loadNote ?? 'Loading waveform…'}</span>
			</div>
		</div>
	{/if}

	{#snippet ruler(position: 'top' | 'bottom')}
		<div
			class={`relative h-7 w-full shrink-0 overflow-hidden border-slate-200 bg-slate-100/80 ${
				position === 'top' ? 'border-b' : 'border-t'
			}`}
			onwheel={handleWheel}
			role="presentation"
		>
			{#each rulerTicks as tick (tick.t)}
				<span
					class={`absolute w-px bg-slate-400 ${position === 'top' ? 'bottom-0 h-1.5' : 'top-0 h-1.5'}`}
					style={`left: ${tick.x}px`}
				></span>
				<span
					class={`absolute overflow-hidden whitespace-nowrap text-center font-mono text-[11px] font-semibold text-slate-600 ${
						position === 'top' ? 'top-[3px]' : 'top-[9px]'
					}`}
					style={`left: ${tick.labelLeft}px; width: ${RULER_LABEL_W}px`}
				>
					{tick.label}
				</span>
			{/each}
		</div>
	{/snippet}

	<div class="relative flex flex-1 flex-col overflow-hidden">
		{#if showTopRuler && isReady && audioStore.duration > 0}
			{@render ruler('top')}
		{/if}

		<div class="relative flex min-h-0 flex-1 flex-col rounded-lg bg-gradient-to-b from-slate-50/80 to-white ring-1 ring-slate-200/60">
			<div
				bind:this={container}
				id="mp3s-waveform-scroll"
				class="waveform-container w-full min-h-[230px] flex-1 overflow-x-auto"
				onwheel={handleWheel}
				role="application"
				aria-label="Audio waveform. Use the mouse wheel to zoom and click to seek."
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

		{#if showBottomRuler && isReady && audioStore.duration > 0}
			{@render ruler('bottom')}
		{/if}
	</div>

	{#if scrollable}
		<div
			class="relative mt-1.5 h-2.5 shrink-0 touch-none select-none rounded-full bg-gray-200 shadow-inner"
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

	<div class="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-gray-500">
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
		<div class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs shadow-sm">
			<span class="font-semibold text-blue-900">Selected split point</span>
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
