import { describe, expect, it } from 'vitest';
import type { SplitPoint } from '$lib/types';
import { deriveSegments, findAdjacentPoint } from './splits';

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

describe('findAdjacentPoint', () => {
	const points: SplitPoint[] = [
		{ id: 'a', time: 4 },
		{ id: 'b', time: 8 },
		{ id: 'c', time: 12 }
	];

	it('finds the previous point strictly before the playhead', () => {
		expect(findAdjacentPoint(points, 10, -1)?.id).toBe('b');
		expect(findAdjacentPoint(points, 8.1, -1)?.id).toBe('b');
		expect(findAdjacentPoint(points, 4, -1)).toBeNull();
		expect(findAdjacentPoint(points, 0, -1)).toBeNull();
	});

	it('finds the next point strictly after the playhead', () => {
		expect(findAdjacentPoint(points, 10, 1)?.id).toBe('c');
		expect(findAdjacentPoint(points, 0, 1)?.id).toBe('a');
		expect(findAdjacentPoint(points, 12, 1)).toBeNull();
		expect(findAdjacentPoint(points, 20, 1)).toBeNull();
	});

	it('skips the point the playhead sits on (epsilon tolerance)', () => {
		expect(findAdjacentPoint(points, 8, -1)?.id).toBe('a');
		expect(findAdjacentPoint(points, 8, 1)?.id).toBe('c');
		expect(findAdjacentPoint(points, 8.003, -1)?.id).toBe('a');
	});

	it('returns null for empty lists and unsorted input still works', () => {
		expect(findAdjacentPoint([], 5, -1)).toBeNull();
		expect(findAdjacentPoint([], 5, 1)).toBeNull();
		const unsorted: SplitPoint[] = [
			{ id: 'c', time: 12 },
			{ id: 'a', time: 4 },
			{ id: 'b', time: 8 }
		];
		expect(findAdjacentPoint(unsorted, 10, -1)?.id).toBe('b');
		expect(findAdjacentPoint(unsorted, 6, 1)?.id).toBe('b');
	});
});
