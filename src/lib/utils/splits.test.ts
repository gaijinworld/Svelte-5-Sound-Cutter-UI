import { describe, expect, it } from 'vitest';
import type { SplitPoint } from '$lib/types';
import { deriveSegments } from './splits';

describe('deriveSegments', () => {
	it('derives contiguous output segments from ordered split points', () => {
		const points: SplitPoint[] = [
			{ id: 'a', time: 6 },
			{ id: 'b', time: 16 }
		];

		const segments = deriveSegments(points, 24.192);
		expect(segments.map(({ start, end, duration }) => ({ start, end, duration }))).toEqual([
			{ start: 0, end: 6, duration: 6 },
			{ start: 6, end: 16, duration: 10 },
			{ start: 16, end: 24.192, duration: 8.192 }
		]);
	});

	it('sorts points before deriving segments', () => {
		const points: SplitPoint[] = [
			{ id: 'b', time: 16 },
			{ id: 'a', time: 6 }
		];

		expect(deriveSegments(points, 20).map((segment) => segment.start)).toEqual([0, 6, 16]);
	});

	it('preserves enabled state by stable boundary id', () => {
		const points: SplitPoint[] = [{ id: 'a', time: 6 }];
		const segments = deriveSegments(points, 10, { 'start:a': false });

		expect(segments[0].enabled).toBe(false);
		expect(segments[1].enabled).toBe(true);
	});

	it('returns no segments for invalid duration', () => {
		expect(deriveSegments([], 0)).toEqual([]);
		expect(deriveSegments([], Number.NaN)).toEqual([]);
	});
});
