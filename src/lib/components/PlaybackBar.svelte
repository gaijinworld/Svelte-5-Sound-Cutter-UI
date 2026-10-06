<script lang="ts">
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';
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

<div class="border-t border-gray-300 bg-[#f3f3f3] px-3 py-2">
	<div class="mb-2 h-2 rounded bg-gray-200">
		<div
			class="h-2 rounded bg-blue-500"
			style={`width: ${audioStore.duration > 0 ? Math.min(100, (audioStore.currentTime / audioStore.duration) * 100) : 0}%`}
		></div>
	</div>

	<div class="flex flex-wrap items-center gap-2 text-sm">
		<button
			class="flex h-8 w-8 items-center justify-center rounded border border-gray-400 bg-white hover:bg-gray-100"
			onclick={audioStore.isPlaying ? onPause : onPlay}
			title={audioStore.isPlaying ? 'Pause' : 'Play'}
		>
			{audioStore.isPlaying ? '❚❚' : '▶'}
		</button>

		<button
			class="h-8 rounded border border-gray-400 bg-white px-2 hover:bg-gray-100"
			onclick={onStop}
			title="Stop"
		>
			■
		</button>

		<label class="ml-1 font-medium" for="playhead-time">Time:</label>
		<input
			id="playhead-time"
			class="h-8 w-36 rounded border border-gray-400 bg-white px-2 font-mono text-xs"
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
			class="h-8 rounded border border-gray-400 bg-white px-3 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
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
