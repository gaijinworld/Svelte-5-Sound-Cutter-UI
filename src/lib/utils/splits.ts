import type { SplitPoint, SplitSegment } from '$lib/types';

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
