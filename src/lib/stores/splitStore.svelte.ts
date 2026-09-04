import type { SplitPoint, SplitSegment } from '$lib/types';
import { audioStore } from './audioStore.svelte';

export const SPLIT_EPSILON_SECONDS = 0.005;

function createSplitStore() {
	let points = $state<SplitPoint[]>([]);
	let enabled = $state<Record<string, boolean>>({});
	let selectedPointId = $state<string | null>(null);

	function createId(): string {
		return crypto.randomUUID();
	}

	function sortPoints() {
		points = [...points].sort((a, b) => a.time - b.time);
	}

	function isDuplicate(time: number, ignoreId?: string): boolean {
		return points.some(
			(point) => point.id !== ignoreId && Math.abs(point.time - time) < SPLIT_EPSILON_SECONDS
		);
	}

	function add(time: number): SplitPoint | null {
		const duration = audioStore.duration;

		if (duration <= 0) return null;
		if (time <= SPLIT_EPSILON_SECONDS) return null;
		if (time >= duration - SPLIT_EPSILON_SECONDS) return null;
		if (isDuplicate(time)) return null;

		const point: SplitPoint = { id: createId(), time };
		points = [...points, point];
		sortPoints();
		selectedPointId = point.id;
		return point;
	}

	function remove(id: string) {
		points = points.filter((point) => point.id !== id);
		if (selectedPointId === id) selectedPointId = null;
	}

	function update(id: string, time: number): boolean {
		const duration = audioStore.duration;
		if (duration <= 0) return false;

		const safeTime = Math.max(
			SPLIT_EPSILON_SECONDS,
			Math.min(duration - SPLIT_EPSILON_SECONDS, time)
		);

		if (isDuplicate(safeTime, id)) return false;

		points = points.map((point) => (point.id === id ? { ...point, time: safeTime } : point));
		sortPoints();
		return true;
	}

	function clear() {
		points = [];
		enabled = {};
		selectedPointId = null;
	}

	function getSegments(): SplitSegment[] {
		const duration = audioStore.duration;
		if (duration <= 0) return [];

		const boundaries = [
			{ id: 'start', time: 0 },
			...[...points].sort((a, b) => a.time - b.time),
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

	function setEnabled(id: string, value: boolean) {
		enabled = { ...enabled, [id]: value };
	}

	function setAllEnabled(value: boolean) {
		const nextEnabled: Record<string, boolean> = {};
		for (const segment of getSegments()) nextEnabled[segment.id] = value;
		enabled = nextEnabled;
	}

	function selectPoint(id: string | null) {
		selectedPointId = id;
	}

	return {
		get points() {
			return points;
		},
		get segments() {
			return getSegments();
		},
		get selectedPointId() {
			return selectedPointId;
		},
		add,
		remove,
		update,
		clear,
		setEnabled,
		setAllEnabled,
		selectPoint
	};
}

export const splitStore = createSplitStore();
