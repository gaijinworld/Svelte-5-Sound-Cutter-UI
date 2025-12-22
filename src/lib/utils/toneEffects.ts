import type { ToneEffectsState } from '$lib/types';

export function createDefaultToneEffects(): ToneEffectsState {
	return {
		pitchShift: { enabled: false, pitch: 0 },
		vibrato: { enabled: false, frequency: 5, depth: 0.3 },
		lowpass: { enabled: false, frequency: 2000, resonance: 1 },
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
	};
}

export function cloneToneEffects(effects: ToneEffectsState): ToneEffectsState {
	if (typeof structuredClone === 'function') {
		return structuredClone(effects);
	}

	return JSON.parse(JSON.stringify(effects)) as ToneEffectsState;
}
