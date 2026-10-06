<script lang="ts">
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';
	import { findAdjacentPoint } from '$lib/utils/splits';
	import { formatTimecode, parseTimecode } from '$lib/utils/time';

	interface Props {
		onPlay: () => void;
		onPause: () => void;
		onStop: () => void;
		onSeek: (time: number) => void;
	}

	let { onPlay, onPause, onStop, onSeek }: Props = $props();
	let timeText = $state('0:00:00.000');
	let editingTime = $state(false);

	let prevPoint = $derived(findAdjacentPoint(splitStore.points, audioStore.currentTime, -1));
	let nextPoint = $derived(findAdjacentPoint(splitStore.points, audioStore.currentTime, 1));

	function jumpToPoint(point: { id: string; time: number } | null) {
		if (!point) return;
		onSeek(point.time);
		splitStore.selectPoint(point.id);
	}

	$effect(() => {
		if (!editingTime) timeText = formatTimecode(audioStore.currentTime);
	});

	function commitTime() {
		const parsed = parseTimecode(timeText);
		editingTime = false;

		if (parsed === null) {
			timeText = formatTimecode(audioStore.currentTime);
			return;
		}

		const safeTime = Math.max(0, Math.min(audioStore.duration, parsed));
		onSeek(safeTime);
		timeText = formatTimecode(safeTime);
	}

	function addSplitPoint() {
		splitStore.add(audioStore.currentTime);
	}
</script>

<div class="border-t border-gray-300 bg-gradient-to-b from-white to-slate-100 px-3 py-2.5">
	<div class="mb-2 h-2.5 overflow-hidden rounded-full bg-gray-200 shadow-inner">
		<div
			class="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width]"
			style={`width: ${audioStore.duration > 0 ? Math.min(100, (audioStore.currentTime / audioStore.duration) * 100) : 0}%`}
		></div>
	</div>

	<div class="flex flex-wrap items-center gap-2 text-sm">
		<button
			class="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-lg text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-500 active:scale-95"
			onclick={audioStore.isPlaying ? onPause : onPlay}
			title={audioStore.isPlaying ? 'Pause' : 'Play'}
		>
			{audioStore.isPlaying ? '❚❚' : '▶'}
		</button>

		<button
			class="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-gray-800"
			onclick={onStop}
			title="Stop"
		>
			■
		</button>

		<div
			class="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white/60 p-0.5 shadow-inner"
			role="group"
			aria-label="Snap navigation"
		>
			<button
				class="flex h-9 w-9 items-center justify-center rounded-md text-sm text-gray-600 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-gray-600"
				onclick={() => onSeek(0)}
				disabled={audioStore.duration <= 0}
				title="Jump to start (Home)"
			>
				⏮
			</button>
			<button
				class="flex h-9 w-9 items-center justify-center rounded-md text-sm text-gray-600 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-gray-600"
				onclick={() => jumpToPoint(prevPoint)}
				disabled={!prevPoint}
				title="Previous split point (,)"
			>
				◄|
			</button>
			<button
				class="flex h-9 w-9 items-center justify-center rounded-md text-sm text-gray-600 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-gray-600"
				onclick={() => jumpToPoint(nextPoint)}
				disabled={!nextPoint}
				title="Next split point (.)"
			>
				|►
			</button>
			<button
				class="flex h-9 w-9 items-center justify-center rounded-md text-sm text-gray-600 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-gray-600"
				onclick={() => onSeek(audioStore.duration)}
				disabled={audioStore.duration <= 0}
				title="Jump to end (End)"
			>
				⏭
			</button>
		</div>

		<label class="ml-1 font-medium text-gray-600" for="playhead-time">Time:</label>
		<input
			id="playhead-time"
			class="h-10 w-36 rounded-lg border border-gray-300 bg-white px-2.5 font-mono text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
			bind:value={timeText}
			onfocus={() => (editingTime = true)}
			onblur={commitTime}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					commitTime();
					(event.currentTarget as HTMLInputElement).blur();
				}
			}}
		/>

		<button
			class="h-10 rounded-lg bg-emerald-600 px-4 font-medium text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
			onclick={addSplitPoint}
			disabled={audioStore.duration <= 0}
			title="Add a split point at the current playhead time"
		>
			✂ Add split point
		</button>

		<span class="ml-auto font-mono text-xs text-gray-500">
			{formatTimecode(audioStore.duration)}
		</span>
	</div>
</div>
