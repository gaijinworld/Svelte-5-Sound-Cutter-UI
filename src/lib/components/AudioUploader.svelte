<script lang="ts">
	import { audioStore } from '$lib/stores/audioStore.svelte';
	import { splitStore } from '$lib/stores/splitStore.svelte';

	interface Props {
		compact?: boolean;
	}

	const LARGE_FILE_BYTES = 250 * 1024 * 1024;

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

		if (
			file.size >= LARGE_FILE_BYTES &&
			!window.confirm(
				`This MP3 is ${(file.size / 1024 / 1024).toFixed(0)} MB. Large files may require significant browser memory. Continue?`
			)
		) {
			return;
		}

		uploadError = null;
		splitStore.clear();
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
	<div class="flex min-w-0 items-center gap-2">
		{#if audioStore.file}
			<div class="mp3s-hide mp3s-show-sm max-w-72 truncate text-xs text-gray-500" title={audioStore.file.name}>
				{audioStore.file.name}
			</div>
		{/if}
		<button
			class="shrink-0 rounded border border-gray-400 bg-[#f5f5f5] px-3 py-2 text-sm text-gray-800 hover:bg-white"
			onclick={openFilePicker}
		>
			📂 Open MP3
		</button>
	</div>
{:else}
	<button
		class={`group mx-auto flex min-h-72 w-full max-w-3xl cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-gradient-to-b from-white to-blue-50/70 p-6 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 sm:p-10 ${
			isDragging ? 'scale-[1.01] border-blue-600 bg-blue-50 shadow-lg' : 'border-blue-400/70'
		}`}
		onclick={openFilePicker}
		ondrop={handleDrop}
		ondragover={(event) => {
			event.preventDefault();
			isDragging = true;
		}}
		ondragleave={() => (isDragging = false)}
	>
		<div
			class={`mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-inner transition-colors sm:h-20 sm:w-20 sm:text-4xl ${
				isDragging ? 'bg-blue-200' : 'bg-blue-100 group-hover:bg-blue-200'
			}`}
			aria-hidden="true"
		>
			🎵
		</div>
		<div class="text-lg font-semibold text-gray-800 sm:text-xl">Open an MP3 file</div>
		<div class="mt-2 text-sm text-gray-500">
			Drop an MP3 anywhere on this card, or browse your files. Processing stays in your browser.
		</div>
		<span
			class="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-blue-500"
		>
			📂 Browse MP3…
		</span>
		<div class="mt-4 text-xs text-gray-400">Files 250 MB and larger show a browser-memory warning before loading.</div>
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
