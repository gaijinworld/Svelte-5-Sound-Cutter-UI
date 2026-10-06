<script lang="ts">
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { regionsStore } from '$lib/stores/regionsStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();
	let fileInput = $state<HTMLInputElement | undefined>(undefined);
	let isDragging = $state(false);
	let uploadError = $state<string | null>(null);

	function isMp3(file: File): boolean {
		return file.type === 'audio/mpeg' || file.type === 'audio/mp3' || /\.mp3$/i.test(file.name);
	}

	function loadFile(file: File) {
		if (!isMp3(file)) {
			uploadError = 'Please choose an MP3 file.';
			return;
		}

		uploadError = null;
		splitStore.clear();
		regionsStore.clear();
		audioStore.setFile(file);
		audioStore.setCurrentTime(0);
	}

	function openFilePicker() {
		uploadError = null;
		fileInput?.click();
	}

	function handleFileSelect(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		if (file) loadFile(file);
		target.value = '';
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		const file = event.dataTransfer?.files[0];
		if (file) loadFile(file);
	}
</script>

{#if compact}
	<div class="flex items-center gap-2">
		{#if audioStore.file}
			<div class="hidden max-w-72 truncate text-xs text-gray-500 sm:block" title={audioStore.file.name}>
				{audioStore.file.name}
			</div>
		{/if}
		<button
			class="rounded border border-gray-400 bg-[#f5f5f5] px-3 py-2 text-sm text-gray-800 hover:bg-white"
			onclick={openFilePicker}
		>
			📂 Open MP3
		</button>
	</div>
{:else}
	<button
		class={`mx-auto flex min-h-72 w-full max-w-3xl flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white p-8 text-center transition ${
			isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-400 hover:border-gray-500'
		}`}
		onclick={openFilePicker}
		ondrop={handleDrop}
		ondragover={(event) => {
			event.preventDefault();
			isDragging = true;
		}}
		ondragleave={() => (isDragging = false)}
	>
		<div class="mb-4 text-5xl">🎵</div>
		<div class="text-lg font-semibold text-gray-800">Open an MP3 file</div>
		<div class="mt-2 text-sm text-gray-500">Drop an MP3 here or click to browse. Processing stays in your browser.</div>
	</button>
{/if}

<input
	bind:this={fileInput}
	type="file"
	accept=".mp3,audio/mpeg,audio/mp3"
	class="hidden"
	onchange={handleFileSelect}
/>

{#if uploadError}
	<p class="mt-2 text-sm text-red-600">{uploadError}</p>
{/if}
