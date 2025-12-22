import type { ToneEffectsState } from '$lib/types';
import { cloneToneEffects } from '$lib/utils/toneEffects';

const STORAGE_KEY = 'soundcutter_presets';

export interface Preset {
	id: string;
	name: string;
	effects: ToneEffectsState;
	isDefault?: boolean;
}

// Default presets for common use cases
const DEFAULT_PRESETS: Preset[] = [
	{
		id: 'character-voice',
		name: 'Character Voice',
		isDefault: true,
		effects: {
			pitchShift: { enabled: true, pitch: 3 },
			vibrato: { enabled: true, frequency: 8, depth: 0.25 },
			lowpass: { enabled: true, frequency: 1500, resonance: 2 },
			highpass: { enabled: false, frequency: 200 },
			bandpass: { enabled: false, frequency: 1000, Q: 2 },
			bitcrusher: { enabled: false, bits: 8 },
			distortion: { enabled: false, amount: 0.4, wet: 0.5 },
			chebyshev: { enabled: false, order: 50 },
			chorus: { enabled: false, frequency: 1.5, delayTime: 3.5, depth: 0.7 },
			tremolo: { enabled: false, frequency: 4, depth: 0.5 },
			phaser: { enabled: false, frequency: 0.5, octaves: 3, baseFrequency: 350 },
			reverb: { enabled: false, decay: 1.5, wet: 0.3 },
			delay: { enabled: false, time: 0.25, feedback: 0.3, wet: 0.3 }
		}
	},
	{
		id: 'radio-voice',
		name: 'Radio/Walkie-Talkie',
		isDefault: true,
		effects: {
			pitchShift: { enabled: false, pitch: 0 },
			vibrato: { enabled: false, frequency: 5, depth: 0.3 },
			lowpass: { enabled: false, frequency: 2000, resonance: 1 },
			highpass: { enabled: false, frequency: 200 },
			bandpass: { enabled: true, frequency: 1800, Q: 3 },
			bitcrusher: { enabled: true, bits: 10 },
			distortion: { enabled: true, amount: 0.15, wet: 0.4 },
			chebyshev: { enabled: false, order: 50 },
			chorus: { enabled: false, frequency: 1.5, delayTime: 3.5, depth: 0.7 },
			tremolo: { enabled: false, frequency: 4, depth: 0.5 },
			phaser: { enabled: false, frequency: 0.5, octaves: 3, baseFrequency: 350 },
			reverb: { enabled: false, decay: 1.5, wet: 0.3 },
			delay: { enabled: false, time: 0.25, feedback: 0.3, wet: 0.3 }
		}
	},
	{
		id: 'retro-8bit',
		name: 'Retro 8-bit',
		isDefault: true,
		effects: {
			pitchShift: { enabled: false, pitch: 0 },
			vibrato: { enabled: false, frequency: 5, depth: 0.3 },
			lowpass: { enabled: true, frequency: 4000, resonance: 0 },
			highpass: { enabled: false, frequency: 200 },
			bandpass: { enabled: false, frequency: 1000, Q: 2 },
			bitcrusher: { enabled: true, bits: 4 },
			distortion: { enabled: false, amount: 0.4, wet: 0.5 },
			chebyshev: { enabled: false, order: 50 },
			chorus: { enabled: false, frequency: 1.5, delayTime: 3.5, depth: 0.7 },
			tremolo: { enabled: false, frequency: 4, depth: 0.5 },
			phaser: { enabled: false, frequency: 0.5, octaves: 3, baseFrequency: 350 },
			reverb: { enabled: false, decay: 1.5, wet: 0.3 },
			delay: { enabled: false, time: 0.25, feedback: 0.3, wet: 0.3 }
		}
	},
	{
		id: 'deep-voice',
		name: 'Deep Voice',
		isDefault: true,
		effects: {
			pitchShift: { enabled: true, pitch: -5 },
			vibrato: { enabled: false, frequency: 5, depth: 0.3 },
			lowpass: { enabled: true, frequency: 3000, resonance: 1 },
			highpass: { enabled: false, frequency: 200 },
			bandpass: { enabled: false, frequency: 1000, Q: 2 },
			bitcrusher: { enabled: false, bits: 8 },
			distortion: { enabled: false, amount: 0.4, wet: 0.5 },
			chebyshev: { enabled: false, order: 50 },
			chorus: { enabled: true, frequency: 0.5, delayTime: 5, depth: 0.3 },
			tremolo: { enabled: false, frequency: 4, depth: 0.5 },
			phaser: { enabled: false, frequency: 0.5, octaves: 3, baseFrequency: 350 },
			reverb: { enabled: true, decay: 0.8, wet: 0.2 },
			delay: { enabled: false, time: 0.25, feedback: 0.3, wet: 0.3 }
		}
	},
	{
		id: 'chipmunk',
		name: 'Chipmunk',
		isDefault: true,
		effects: {
			pitchShift: { enabled: true, pitch: 8 },
			vibrato: { enabled: true, frequency: 6, depth: 0.15 },
			lowpass: { enabled: false, frequency: 2000, resonance: 1 },
			highpass: { enabled: true, frequency: 300 },
			bandpass: { enabled: false, frequency: 1000, Q: 2 },
			bitcrusher: { enabled: false, bits: 8 },
			distortion: { enabled: false, amount: 0.4, wet: 0.5 },
			chebyshev: { enabled: false, order: 50 },
			chorus: { enabled: false, frequency: 1.5, delayTime: 3.5, depth: 0.7 },
			tremolo: { enabled: false, frequency: 4, depth: 0.5 },
			phaser: { enabled: false, frequency: 0.5, octaves: 3, baseFrequency: 350 },
			reverb: { enabled: false, decay: 1.5, wet: 0.3 },
			delay: { enabled: false, time: 0.25, feedback: 0.3, wet: 0.3 }
		}
	},
	{
		id: 'muffled',
		name: 'Muffled/Behind Wall',
		isDefault: true,
		effects: {
			pitchShift: { enabled: false, pitch: 0 },
			vibrato: { enabled: false, frequency: 5, depth: 0.3 },
			lowpass: { enabled: true, frequency: 600, resonance: 3 },
			highpass: { enabled: false, frequency: 200 },
			bandpass: { enabled: false, frequency: 1000, Q: 2 },
			bitcrusher: { enabled: false, bits: 8 },
			distortion: { enabled: false, amount: 0.4, wet: 0.5 },
			chebyshev: { enabled: false, order: 50 },
			chorus: { enabled: false, frequency: 1.5, delayTime: 3.5, depth: 0.7 },
			tremolo: { enabled: false, frequency: 4, depth: 0.5 },
			phaser: { enabled: false, frequency: 0.5, octaves: 3, baseFrequency: 350 },
			reverb: { enabled: true, decay: 0.5, wet: 0.15 },
			delay: { enabled: false, time: 0.25, feedback: 0.3, wet: 0.3 }
		}
	},
	{
		id: 'spooky',
		name: 'Spooky/Ghost',
		isDefault: true,
		effects: {
			pitchShift: { enabled: true, pitch: -2 },
			vibrato: { enabled: true, frequency: 3, depth: 0.4 },
			lowpass: { enabled: false, frequency: 2000, resonance: 1 },
			highpass: { enabled: false, frequency: 200 },
			bandpass: { enabled: false, frequency: 1000, Q: 2 },
			bitcrusher: { enabled: false, bits: 8 },
			distortion: { enabled: false, amount: 0.4, wet: 0.5 },
			chebyshev: { enabled: false, order: 50 },
			chorus: { enabled: true, frequency: 0.3, delayTime: 8, depth: 0.8 },
			tremolo: { enabled: false, frequency: 4, depth: 0.5 },
			phaser: { enabled: true, frequency: 0.2, octaves: 4, baseFrequency: 200 },
			reverb: { enabled: true, decay: 4, wet: 0.5 },
			delay: { enabled: true, time: 0.4, feedback: 0.5, wet: 0.3 }
		}
	},
	{
		id: 'robot',
		name: 'Robot',
		isDefault: true,
		effects: {
			pitchShift: { enabled: false, pitch: 0 },
			vibrato: { enabled: false, frequency: 5, depth: 0.3 },
			lowpass: { enabled: false, frequency: 2000, resonance: 1 },
			highpass: { enabled: false, frequency: 200 },
			bandpass: { enabled: true, frequency: 1200, Q: 4 },
			bitcrusher: { enabled: true, bits: 6 },
			distortion: { enabled: true, amount: 0.3, wet: 0.5 },
			chebyshev: { enabled: false, order: 50 },
			chorus: { enabled: false, frequency: 1.5, delayTime: 3.5, depth: 0.7 },
			tremolo: { enabled: true, frequency: 15, depth: 0.3 },
			phaser: { enabled: false, frequency: 0.5, octaves: 3, baseFrequency: 350 },
			reverb: { enabled: false, decay: 1.5, wet: 0.3 },
			delay: { enabled: false, time: 0.25, feedback: 0.3, wet: 0.3 }
		}
	}
];

function createPresetsStore() {
	let presets = $state<Preset[]>([]);

	// Load from localStorage on init
	function loadFromStorage(): Preset[] {
		if (typeof window === 'undefined') return [...DEFAULT_PRESETS];

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const userPresets = JSON.parse(stored) as Preset[];
				// Merge with defaults (defaults first, then user presets)
				return [...DEFAULT_PRESETS, ...userPresets];
			}
		} catch (e) {
			console.error('Failed to load presets:', e);
		}
		return [...DEFAULT_PRESETS];
	}

	// Save user presets to localStorage
	function saveToStorage() {
		if (typeof window === 'undefined') return;

		try {
			// Only save non-default presets
			const userPresets = presets.filter((p) => !p.isDefault);
			localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets));
		} catch (e) {
			console.error('Failed to save presets:', e);
		}
	}

	// Initialize
	presets = loadFromStorage();

	return {
		get presets() {
			return presets;
		},

		get defaultPresets() {
			return presets.filter((p) => p.isDefault);
		},

		get userPresets() {
			return presets.filter((p) => !p.isDefault);
		},

		add(name: string, effects: ToneEffectsState): Preset {
			const preset: Preset = {
				id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
				name,
				effects: cloneToneEffects(effects),
				isDefault: false
			};
			presets = [...presets, preset];
			saveToStorage();
			return preset;
		},

		update(id: string, name: string, effects: ToneEffectsState) {
			presets = presets.map((p) =>
				p.id === id && !p.isDefault
					? { ...p, name, effects: cloneToneEffects(effects) }
					: p
			);
			saveToStorage();
		},

		remove(id: string) {
			// Can't remove default presets
			const preset = presets.find((p) => p.id === id);
			if (preset?.isDefault) return;

			presets = presets.filter((p) => p.id !== id);
			saveToStorage();
		},

		getById(id: string): Preset | undefined {
			return presets.find((p) => p.id === id);
		},

		// Reload from storage (useful if another tab modified it)
		reload() {
			presets = loadFromStorage();
		}
	};
}

export const presetsStore = createPresetsStore();
