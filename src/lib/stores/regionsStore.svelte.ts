import type { Region, ToneEffectsState } from '$lib/types';
import { cloneToneEffects, createDefaultToneEffects } from '$lib/utils/toneEffects';

const COLORS = [
	'rgba(255, 99, 132, 0.4)',
	'rgba(54, 162, 235, 0.4)',
	'rgba(255, 206, 86, 0.4)',
	'rgba(75, 192, 192, 0.4)',
	'rgba(153, 102, 255, 0.4)',
	'rgba(255, 159, 64, 0.4)',
	'rgba(199, 199, 199, 0.4)',
	'rgba(83, 102, 255, 0.4)'
];

export function hasActiveEffects(effects: ToneEffectsState): boolean {
	return Object.values(effects).some((e) => e.enabled);
}

function createRegionsStore() {
	let regions = $state<Region[]>([]);
	let selectedId = $state<string | null>(null);
	let colorIndex = 0;

	function generateId(): string {
		return `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	function getNextColor(): string {
		const color = COLORS[colorIndex % COLORS.length];
		colorIndex++;
		return color;
	}

	return {
		get regions() {
			return regions;
		},
		get selectedId() {
			return selectedId;
		},
		get selectedRegion() {
			return regions.find((r) => r.id === selectedId) ?? null;
		},

		add(start: number, end: number, name?: string): Region {
			const region: Region = {
				id: generateId(),
				name: name ?? `Region ${regions.length + 1}`,
				start,
				end,
				color: getNextColor(),
				effects: createDefaultToneEffects()
			};
			regions = [...regions, region];
			selectedId = region.id;
			return region;
		},

		update(id: string, updates: Partial<Omit<Region, 'id'>>) {
			regions = regions.map((r) => (r.id === id ? { ...r, ...updates } : r));
		},

		updateEffects(id: string, effects: ToneEffectsState) {
			regions = regions.map((r) => (r.id === id ? { ...r, effects: cloneToneEffects(effects) } : r));
		},

		copyEffectsToAll(sourceId: string) {
			const source = regions.find((r) => r.id === sourceId);
			if (source) {
				regions = regions.map((r) => ({ ...r, effects: cloneToneEffects(source.effects) }));
			}
		},

		remove(id: string) {
			regions = regions.filter((r) => r.id !== id);
			if (selectedId === id) {
				selectedId = regions.length > 0 ? regions[0].id : null;
			}
		},

		select(id: string | null) {
			selectedId = id;
		},

		clear() {
			regions = [];
			selectedId = null;
			colorIndex = 0;
		},

		// Import regions from WaveSurfer
		syncFromWaveSurfer(wsRegions: { id: string; start: number; end: number }[]) {
			wsRegions.forEach((wsRegion) => {
				const existing = regions.find((r) => r.id === wsRegion.id);
				if (existing) {
					existing.start = wsRegion.start;
					existing.end = wsRegion.end;
				}
			});
			regions = [...regions];
		}
	};
}

export const regionsStore = createRegionsStore();
