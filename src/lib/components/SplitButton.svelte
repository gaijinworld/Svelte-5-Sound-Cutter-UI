<script lang="ts">
	import { splitStore } from '$lib/stores/splitStore.svelte';

	let selectedCount = $derived(splitStore.segments.filter((segment) => segment.enabled).length);
</script>

<button
	class="flex w-full items-center justify-center gap-2 rounded border border-gray-400 bg-[#f5f5f5] px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
	disabled
	title="Lossless FFmpeg.wasm splitting is wired in Phase 1D"
>
	<span aria-hidden="true">⚙</span>
	<span>Start splitting{selectedCount > 0 ? ` (${selectedCount})` : ''}</span>
</button>
