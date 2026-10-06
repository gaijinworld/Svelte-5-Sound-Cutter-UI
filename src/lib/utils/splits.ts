import type { SplitPoint, SplitSegment } from '$lib/types';

/** Positions closer than this count as the same point for matching/dedup. */
export const SPLIT_EPSILON_SECONDS = 0.005;

/**
 * Nearest split point strictly before (`direction = -1`) or after (`1`)
 * `time`, using the shared epsilon so a playhead sitting on a point still
 * navigates to its neighbour. Returns null when none exists.
 */
export function findAdjacentPoint(
	points: SplitPoint[],
	time: number,
	direction: -1 | 1
): SplitPoint | null {
	let best: SplitPoint | null = null;
	for (const point of points) {
		const inRange =
			direction < 0
				? point.time < time - SPLIT_EPSILON_SECONDS
				: point.time > time + SPLIT_EPSILON_SECONDS;
		if (inRange && (!best || (direction < 0 ? point.time > best.time : point.time < best.time))) {
			best = point;
		}
	}
	return best;
}

export function deriveSegments(
	points: SplitPoint[],
	duration: number,
	enabled: Record<string, boolean> = {}
): SplitSegment[] {
	if (!Number.isFinite(duration) || duration <= 0) return [];

	const sortedPoints = [...points]
		.filter((point) => Number.isFinite(point.time) && point.time > 0 && point.time < duration)
		.sort((a, b) => a.time - b.time);

	const boundaries = [
		{ id: 'start', time: 0 },
		...sortedPoints,
		{ id: 'end', time: duration }
	];

	return boundaries.slice(0, -1).map((boundary, index) => {
		const next = boundaries[index + 1];
		const id = `${boundary.id}:${next.id}`;

		return {
			id,
			index,
			start: boundary.time,
			end: next.time,
			duration: next.time - boundary.time,
			enabled: enabled[id] ?? true
		};
	});
}
