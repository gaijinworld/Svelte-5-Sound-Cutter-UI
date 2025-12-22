import { describe, expect, it } from 'vitest';
import { cloneToneEffects, createDefaultToneEffects } from './toneEffects';

describe('tone effects helpers', () => {
	it('creates a fresh default state each time', () => {
		const first = createDefaultToneEffects();
		const second = createDefaultToneEffects();

		first.delay.enabled = true;

		expect(second.delay.enabled).toBe(false);
	});

	it('deep clones effect state', () => {
		const original = createDefaultToneEffects();
		original.pitchShift.enabled = true;
		original.pitchShift.pitch = 7;

		const cloned = cloneToneEffects(original);
		cloned.pitchShift.pitch = -3;

		expect(original.pitchShift.pitch).toBe(7);
		expect(cloned.pitchShift.pitch).toBe(-3);
	});
});
