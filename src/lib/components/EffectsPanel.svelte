<script lang="ts">
	import { regionsStore, hasActiveEffects } from '$lib/stores/regionsStore.svelte';
	import { presetsStore } from '$lib/stores/presetsStore.svelte';
	import type { ToneEffectsState } from '$lib/types';
	import { createDefaultToneEffects } from '$lib/utils/toneEffects';

	// Track which sections are expanded
	let expandedSections = $state({
		pitch: true,
		filter: false,
		distortion: false,
		modulation: false,
		space: false
	});

	let effects = $derived(regionsStore.selectedRegion?.effects ?? null);
	let regionName = $derived(regionsStore.selectedRegion?.name ?? '');

	// Preset state
	let showSaveDialog = $state(false);
	let newPresetName = $state('');
	let selectedPresetId = $state<string | null>(null);

	function applyPreset(presetId: string) {
		const preset = presetsStore.getById(presetId);
		const region = regionsStore.selectedRegion;
		if (!preset || !region) return;

		regionsStore.updateEffects(region.id, JSON.parse(JSON.stringify(preset.effects)));
		selectedPresetId = presetId;
	}

	function saveAsPreset() {
		if (!effects || !newPresetName.trim()) return;

		presetsStore.add(newPresetName.trim(), effects);
		newPresetName = '';
		showSaveDialog = false;
	}

	function deletePreset(id: string) {
		presetsStore.remove(id);
		if (selectedPresetId === id) {
			selectedPresetId = null;
		}
	}

	function updateEffect<K extends keyof ToneEffectsState>(
		key: K,
		updates: Partial<ToneEffectsState[K]>
	) {
		const region = regionsStore.selectedRegion;
		if (!region) return;

		const newEffects: ToneEffectsState = {
			...region.effects,
			[key]: { ...region.effects[key], ...updates }
		};
		regionsStore.updateEffects(region.id, newEffects);
	}

	function toggleEffect(key: keyof ToneEffectsState) {
		const region = regionsStore.selectedRegion;
		if (!region) return;

		const newEffects: ToneEffectsState = {
			...region.effects,
			[key]: { ...region.effects[key], enabled: !region.effects[key].enabled }
		};
		regionsStore.updateEffects(region.id, newEffects);
	}

	function resetEffects() {
		const region = regionsStore.selectedRegion;
		if (!region) return;

		regionsStore.updateEffects(region.id, createDefaultToneEffects());
	}

	function copyToAllRegions() {
		const region = regionsStore.selectedRegion;
		if (region) {
			regionsStore.copyEffectsToAll(region.id);
		}
	}

	function toggleSection(section: keyof typeof expandedSections) {
		expandedSections[section] = !expandedSections[section];
	}

	// Count active effects in a section
	function countActive(keys: (keyof ToneEffectsState)[]): number {
		if (!effects) return 0;
		return keys.filter((k) => effects[k].enabled).length;
	}
</script>

<div class="flex h-full flex-col rounded-lg bg-gray-800/50">
	<div class="border-b border-gray-700 px-4 py-3">
		<h2 class="font-semibold text-gray-200">Effects</h2>
		{#if regionName}
			<p class="mt-1 truncate text-xs text-cyan-400">{regionName}</p>
		{/if}
	</div>

	{#if !effects}
		<div class="flex flex-1 flex-col items-center justify-center p-6 text-center">
			<svg class="mb-3 h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
					d="M15.536 8.464a5 5 0 010 7.072M12 9.5l0 5M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M8.464 15.536a5 5 0 010-7.072" />
			</svg>
			<p class="text-sm text-gray-500">Select a region to edit effects</p>
		</div>
	{:else}
		<!-- PRESETS SECTION -->
		<div class="border-b border-gray-700 p-3">
			{#if showSaveDialog}
				<div class="flex gap-2">
					<input
						type="text"
						placeholder="Preset name..."
						bind:value={newPresetName}
						class="flex-1 rounded bg-gray-700 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
						onkeydown={(e) => e.key === 'Enter' && saveAsPreset()}
					/>
					<button
						class="rounded bg-cyan-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
						onclick={saveAsPreset}
						disabled={!newPresetName.trim()}
					>
						Save
					</button>
					<button
						class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-600"
						onclick={() => { showSaveDialog = false; newPresetName = ''; }}
					>
						Cancel
					</button>
				</div>
			{:else}
				<div class="flex gap-2">
					<select
						class="flex-1 rounded bg-gray-700 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
						value={selectedPresetId ?? ''}
						onchange={(e) => {
							const val = e.currentTarget.value;
							if (val) applyPreset(val);
						}}
					>
						<option value="" disabled>Load preset...</option>
						{#if presetsStore.defaultPresets.length > 0}
							<optgroup label="Built-in">
								{#each presetsStore.defaultPresets as preset}
									<option value={preset.id}>{preset.name}</option>
								{/each}
							</optgroup>
						{/if}
						{#if presetsStore.userPresets.length > 0}
							<optgroup label="My Presets">
								{#each presetsStore.userPresets as preset}
									<option value={preset.id}>{preset.name}</option>
								{/each}
							</optgroup>
						{/if}
					</select>
					<button
						class="rounded bg-gray-700 px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
						onclick={() => showSaveDialog = true}
						title="Save current settings as preset"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
					</button>
					{#if selectedPresetId && !presetsStore.getById(selectedPresetId)?.isDefault}
						<button
							class="rounded bg-red-500/20 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/30"
							onclick={() => selectedPresetId && deletePreset(selectedPresetId)}
							title="Delete preset"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<div class="flex-1 space-y-2 overflow-y-auto p-3">

			<!-- PITCH & VOICE -->
			<div class="rounded-lg bg-gray-800">
				<button
					class="flex w-full items-center justify-between p-3"
					onclick={() => toggleSection('pitch')}
				>
					<div class="flex items-center gap-2">
						<span class="text-base">🎤</span>
						<span class="text-sm font-medium text-gray-200">Pitch & Voice</span>
						{#if countActive(['pitchShift', 'vibrato']) > 0}
							<span class="rounded-full bg-pink-500/20 px-2 py-0.5 text-xs text-pink-400">
								{countActive(['pitchShift', 'vibrato'])}
							</span>
						{/if}
					</div>
					<svg class="h-4 w-4 text-gray-400 transition-transform {expandedSections.pitch ? 'rotate-180' : ''}"
						fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{#if expandedSections.pitch}
					<div class="space-y-3 border-t border-gray-700 p-3">
						<!-- Pitch Shift -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Pitch Shift</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.pitchShift.enabled ? 'bg-pink-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('pitchShift')}
								>
									{effects.pitchShift.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="flex items-center gap-2">
								<input type="range" min="-12" max="12" step="1"
									value={effects.pitchShift.pitch}
									oninput={(e) => updateEffect('pitchShift', { pitch: Number(e.currentTarget.value) })}
									disabled={!effects.pitchShift.enabled}
									class="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-700 accent-pink-500 disabled:opacity-40"
								/>
								<span class="w-12 text-right text-xs text-gray-400">
									{effects.pitchShift.pitch > 0 ? '+' : ''}{effects.pitchShift.pitch} st
								</span>
							</div>
						</div>

						<!-- Vibrato -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Vibrato</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.vibrato.enabled ? 'bg-pink-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('vibrato')}
								>
									{effects.vibrato.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Rate</span>
									<input type="range" min="0.5" max="20" step="0.5"
										value={effects.vibrato.frequency}
										oninput={(e) => updateEffect('vibrato', { frequency: Number(e.currentTarget.value) })}
										disabled={!effects.vibrato.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-pink-500 disabled:opacity-40"
									/>
								</div>
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Depth</span>
									<input type="range" min="0" max="1" step="0.05"
										value={effects.vibrato.depth}
										oninput={(e) => updateEffect('vibrato', { depth: Number(e.currentTarget.value) })}
										disabled={!effects.vibrato.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-pink-500 disabled:opacity-40"
									/>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- FILTERS -->
			<div class="rounded-lg bg-gray-800">
				<button
					class="flex w-full items-center justify-between p-3"
					onclick={() => toggleSection('filter')}
				>
					<div class="flex items-center gap-2">
						<span class="text-base">🎛️</span>
						<span class="text-sm font-medium text-gray-200">Filters</span>
						{#if countActive(['lowpass', 'highpass', 'bandpass']) > 0}
							<span class="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-400">
								{countActive(['lowpass', 'highpass', 'bandpass'])}
							</span>
						{/if}
					</div>
					<svg class="h-4 w-4 text-gray-400 transition-transform {expandedSections.filter ? 'rotate-180' : ''}"
						fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{#if expandedSections.filter}
					<div class="space-y-3 border-t border-gray-700 p-3">
						<!-- Lowpass -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Lowpass (Muffle)</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.lowpass.enabled ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('lowpass')}
								>
									{effects.lowpass.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Freq</span>
									<input type="range" min="100" max="10000" step="100"
										value={effects.lowpass.frequency}
										oninput={(e) => updateEffect('lowpass', { frequency: Number(e.currentTarget.value) })}
										disabled={!effects.lowpass.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-cyan-500 disabled:opacity-40"
									/>
								</div>
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Res</span>
									<input type="range" min="0" max="20" step="0.5"
										value={effects.lowpass.resonance}
										oninput={(e) => updateEffect('lowpass', { resonance: Number(e.currentTarget.value) })}
										disabled={!effects.lowpass.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-cyan-500 disabled:opacity-40"
									/>
								</div>
							</div>
						</div>

						<!-- Highpass -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Highpass (Thin)</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.highpass.enabled ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('highpass')}
								>
									{effects.highpass.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="flex items-center gap-2">
								<input type="range" min="20" max="2000" step="20"
									value={effects.highpass.frequency}
									oninput={(e) => updateEffect('highpass', { frequency: Number(e.currentTarget.value) })}
									disabled={!effects.highpass.enabled}
									class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-cyan-500 disabled:opacity-40"
								/>
								<span class="w-12 text-right text-xs text-gray-400">{effects.highpass.frequency}Hz</span>
							</div>
						</div>

						<!-- Bandpass (Radio/Phone) -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Bandpass (Radio)</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.bandpass.enabled ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('bandpass')}
								>
									{effects.bandpass.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Freq</span>
									<input type="range" min="200" max="4000" step="50"
										value={effects.bandpass.frequency}
										oninput={(e) => updateEffect('bandpass', { frequency: Number(e.currentTarget.value) })}
										disabled={!effects.bandpass.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-cyan-500 disabled:opacity-40"
									/>
								</div>
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Q</span>
									<input type="range" min="0.5" max="15" step="0.5"
										value={effects.bandpass.Q}
										oninput={(e) => updateEffect('bandpass', { Q: Number(e.currentTarget.value) })}
										disabled={!effects.bandpass.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-cyan-500 disabled:opacity-40"
									/>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- DISTORTION -->
			<div class="rounded-lg bg-gray-800">
				<button
					class="flex w-full items-center justify-between p-3"
					onclick={() => toggleSection('distortion')}
				>
					<div class="flex items-center gap-2">
						<span class="text-base">⚡</span>
						<span class="text-sm font-medium text-gray-200">Distortion</span>
						{#if countActive(['bitcrusher', 'distortion', 'chebyshev']) > 0}
							<span class="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">
								{countActive(['bitcrusher', 'distortion', 'chebyshev'])}
							</span>
						{/if}
					</div>
					<svg class="h-4 w-4 text-gray-400 transition-transform {expandedSections.distortion ? 'rotate-180' : ''}"
						fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{#if expandedSections.distortion}
					<div class="space-y-3 border-t border-gray-700 p-3">
						<!-- Bitcrusher -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Bitcrusher</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.bitcrusher.enabled ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('bitcrusher')}
								>
									{effects.bitcrusher.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="flex items-center gap-2">
								<input type="range" min="1" max="16" step="1"
									value={effects.bitcrusher.bits}
									oninput={(e) => updateEffect('bitcrusher', { bits: Number(e.currentTarget.value) })}
									disabled={!effects.bitcrusher.enabled}
									class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-orange-500 disabled:opacity-40"
								/>
								<span class="w-10 text-right text-xs text-gray-400">{effects.bitcrusher.bits} bit</span>
							</div>
						</div>

						<!-- Distortion -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Distortion</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.distortion.enabled ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('distortion')}
								>
									{effects.distortion.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Drive</span>
									<input type="range" min="0" max="1" step="0.05"
										value={effects.distortion.amount}
										oninput={(e) => updateEffect('distortion', { amount: Number(e.currentTarget.value) })}
										disabled={!effects.distortion.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-orange-500 disabled:opacity-40"
									/>
								</div>
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Mix</span>
									<input type="range" min="0" max="1" step="0.05"
										value={effects.distortion.wet}
										oninput={(e) => updateEffect('distortion', { wet: Number(e.currentTarget.value) })}
										disabled={!effects.distortion.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-orange-500 disabled:opacity-40"
									/>
								</div>
							</div>
						</div>

						<!-- Chebyshev -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Waveshaper</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.chebyshev.enabled ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('chebyshev')}
								>
									{effects.chebyshev.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="flex items-center gap-2">
								<input type="range" min="1" max="100" step="1"
									value={effects.chebyshev.order}
									oninput={(e) => updateEffect('chebyshev', { order: Number(e.currentTarget.value) })}
									disabled={!effects.chebyshev.enabled}
									class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-orange-500 disabled:opacity-40"
								/>
								<span class="w-10 text-right text-xs text-gray-400">{effects.chebyshev.order}</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- MODULATION -->
			<div class="rounded-lg bg-gray-800">
				<button
					class="flex w-full items-center justify-between p-3"
					onclick={() => toggleSection('modulation')}
				>
					<div class="flex items-center gap-2">
						<span class="text-base">🌀</span>
						<span class="text-sm font-medium text-gray-200">Modulation</span>
						{#if countActive(['chorus', 'tremolo', 'phaser']) > 0}
							<span class="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
								{countActive(['chorus', 'tremolo', 'phaser'])}
							</span>
						{/if}
					</div>
					<svg class="h-4 w-4 text-gray-400 transition-transform {expandedSections.modulation ? 'rotate-180' : ''}"
						fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{#if expandedSections.modulation}
					<div class="space-y-3 border-t border-gray-700 p-3">
						<!-- Chorus -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Chorus</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.chorus.enabled ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('chorus')}
								>
									{effects.chorus.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Rate</span>
									<input type="range" min="0.5" max="10" step="0.5"
										value={effects.chorus.frequency}
										oninput={(e) => updateEffect('chorus', { frequency: Number(e.currentTarget.value) })}
										disabled={!effects.chorus.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-purple-500 disabled:opacity-40"
									/>
								</div>
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Depth</span>
									<input type="range" min="0" max="1" step="0.05"
										value={effects.chorus.depth}
										oninput={(e) => updateEffect('chorus', { depth: Number(e.currentTarget.value) })}
										disabled={!effects.chorus.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-purple-500 disabled:opacity-40"
									/>
								</div>
							</div>
						</div>

						<!-- Tremolo -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Tremolo</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.tremolo.enabled ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('tremolo')}
								>
									{effects.tremolo.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Rate</span>
									<input type="range" min="0.5" max="20" step="0.5"
										value={effects.tremolo.frequency}
										oninput={(e) => updateEffect('tremolo', { frequency: Number(e.currentTarget.value) })}
										disabled={!effects.tremolo.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-purple-500 disabled:opacity-40"
									/>
								</div>
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Depth</span>
									<input type="range" min="0" max="1" step="0.05"
										value={effects.tremolo.depth}
										oninput={(e) => updateEffect('tremolo', { depth: Number(e.currentTarget.value) })}
										disabled={!effects.tremolo.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-purple-500 disabled:opacity-40"
									/>
								</div>
							</div>
						</div>

						<!-- Phaser -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Phaser</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.phaser.enabled ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('phaser')}
								>
									{effects.phaser.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Rate</span>
									<input type="range" min="0.1" max="10" step="0.1"
										value={effects.phaser.frequency}
										oninput={(e) => updateEffect('phaser', { frequency: Number(e.currentTarget.value) })}
										disabled={!effects.phaser.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-purple-500 disabled:opacity-40"
									/>
								</div>
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Oct</span>
									<input type="range" min="1" max="6" step="1"
										value={effects.phaser.octaves}
										oninput={(e) => updateEffect('phaser', { octaves: Number(e.currentTarget.value) })}
										disabled={!effects.phaser.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-purple-500 disabled:opacity-40"
									/>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- SPACE -->
			<div class="rounded-lg bg-gray-800">
				<button
					class="flex w-full items-center justify-between p-3"
					onclick={() => toggleSection('space')}
				>
					<div class="flex items-center gap-2">
						<span class="text-base">🌌</span>
						<span class="text-sm font-medium text-gray-200">Space</span>
						{#if countActive(['reverb', 'delay']) > 0}
							<span class="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
								{countActive(['reverb', 'delay'])}
							</span>
						{/if}
					</div>
					<svg class="h-4 w-4 text-gray-400 transition-transform {expandedSections.space ? 'rotate-180' : ''}"
						fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{#if expandedSections.space}
					<div class="space-y-3 border-t border-gray-700 p-3">
						<!-- Reverb -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Reverb</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.reverb.enabled ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('reverb')}
								>
									{effects.reverb.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="grid grid-cols-2 gap-2">
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Decay</span>
									<input type="range" min="0.1" max="10" step="0.1"
										value={effects.reverb.decay}
										oninput={(e) => updateEffect('reverb', { decay: Number(e.currentTarget.value) })}
										disabled={!effects.reverb.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-blue-500 disabled:opacity-40"
									/>
								</div>
								<div class="flex items-center gap-1">
									<span class="w-10 text-xs text-gray-500">Mix</span>
									<input type="range" min="0" max="1" step="0.05"
										value={effects.reverb.wet}
										oninput={(e) => updateEffect('reverb', { wet: Number(e.currentTarget.value) })}
										disabled={!effects.reverb.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-blue-500 disabled:opacity-40"
									/>
								</div>
							</div>
						</div>

						<!-- Delay -->
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium text-gray-300">Delay</span>
								<button
									class="rounded px-2 py-0.5 text-xs {effects.delay.enabled ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}"
									onclick={() => toggleEffect('delay')}
								>
									{effects.delay.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div class="grid grid-cols-3 gap-2">
								<div class="flex items-center gap-1">
									<span class="w-8 text-xs text-gray-500">Time</span>
									<input type="range" min="0.05" max="1" step="0.05"
										value={effects.delay.time}
										oninput={(e) => updateEffect('delay', { time: Number(e.currentTarget.value) })}
										disabled={!effects.delay.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-blue-500 disabled:opacity-40"
									/>
								</div>
								<div class="flex items-center gap-1">
									<span class="w-8 text-xs text-gray-500">FB</span>
									<input type="range" min="0" max="0.9" step="0.05"
										value={effects.delay.feedback}
										oninput={(e) => updateEffect('delay', { feedback: Number(e.currentTarget.value) })}
										disabled={!effects.delay.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-blue-500 disabled:opacity-40"
									/>
								</div>
								<div class="flex items-center gap-1">
									<span class="w-8 text-xs text-gray-500">Mix</span>
									<input type="range" min="0" max="1" step="0.05"
										value={effects.delay.wet}
										oninput={(e) => updateEffect('delay', { wet: Number(e.currentTarget.value) })}
										disabled={!effects.delay.enabled}
										class="h-1.5 flex-1 appearance-none rounded-full bg-gray-700 accent-blue-500 disabled:opacity-40"
									/>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>

		</div>

		<!-- Action buttons -->
		<div class="flex gap-2 border-t border-gray-700 p-3">
			{#if hasActiveEffects(effects)}
				<button
					class="flex-1 rounded bg-gray-700 py-1.5 text-xs text-gray-300 transition-colors hover:bg-gray-600"
					onclick={resetEffects}
				>
					Reset
				</button>
			{/if}
			{#if regionsStore.regions.length > 1}
				<button
					class="flex-1 rounded bg-cyan-500/20 py-1.5 text-xs text-cyan-400 transition-colors hover:bg-cyan-500/30"
					onclick={copyToAllRegions}
				>
					Copy to All
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	input[type='range'] {
		cursor: pointer;
	}

	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: currentColor;
		cursor: pointer;
	}

	input[type='range']::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: currentColor;
		cursor: pointer;
		border: none;
	}

	input[type='range']:disabled {
		cursor: not-allowed;
	}
</style>
