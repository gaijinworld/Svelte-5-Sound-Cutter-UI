<script lang="ts">
	import { splitStore } from '$lib/stores/splitStore.svelte';
	import { formatTimecode } from '$lib/utils/time';

	let segments = $derived(splitStore.segments);
	let allEnabled = $derived(segments.length > 0 && segments.every((segment) => segment.enabled));
</script>

<div class="flex h-full min-h-0 flex-col bg-white">
	<div class="border-b border-gray-300 px-3 py-2 text-sm font-medium text-gray-800">Split points:</div>

	<div class="min-h-0 flex-1 overflow-auto">
		<table class="w-full border-collapse text-xs text-gray-800">
			<thead class="sticky top-0 bg-[#f8f8f8]">
				<tr class="border-b border-gray-300">
					<th class="w-8 px-2 py-2 text-center">
						<input
							type="checkbox"
							checked={allEnabled}
							onchange={(event) => splitStore.setAllEnabled(event.currentTarget.checked)}
							aria-label="Select all segments"
						/>
					</th>
					<th class="border-l border-gray-200 px-2 py-2 text-left font-medium">Start</th>
					<th class="border-l border-gray-200 px-2 py-2 text-left font-medium">End</th>
					<th class="border-l border-gray-200 px-2 py-2 text-left font-medium">Duration</th>
				</tr>
			</thead>
			<tbody>
				{#each segments as segment (segment.id)}
					<tr class="border-b border-gray-100 hover:bg-blue-50">
						<td class="px-2 py-2 text-center">
							<input
								type="checkbox"
								checked={segment.enabled}
								onchange={(event) => splitStore.setEnabled(segment.id, event.currentTarget.checked)}
								aria-label={`Export segment ${segment.index + 1}`}
							/>
						</td>
						<td class="border-l border-gray-100 px-2 py-2 font-mono whitespace-nowrap">
							{formatTimecode(segment.start)}
						</td>
						<td class="border-l border-gray-100 px-2 py-2 font-mono whitespace-nowrap">
							{formatTimecode(segment.end)}
						</td>
						<td class="border-l border-gray-100 px-2 py-2 font-mono whitespace-nowrap">
							{formatTimecode(segment.duration)}
						</td>
					</tr>
				{/each}
				{#if segments.length === 0}
					<tr>
						<td colspan="4" class="px-4 py-8 text-center text-gray-500">
							Open an MP3 to generate the first segment.
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>
