import { describe, expect, it, vi } from 'vitest';
import { buildExportBaseName, buildZipName, sanitizeFilename } from './export';

describe('export utilities', () => {
	it('sanitizes filenames for browser downloads', () => {
		expect(sanitizeFilename(' Boss VO #1!.wav ')).toBe('_boss_vo_1wav_');
	});

	it('creates stable unique region export names', () => {
		const usedNames = new Map<string, number>();

		expect(buildExportBaseName('Intro Hit', usedNames)).toBe('intro_hit');
		expect(buildExportBaseName('Intro Hit', usedNames)).toBe('intro_hit_2');
		expect(buildExportBaseName('***', usedNames)).toBe('region');
	});

	it('builds a dated zip name from the source file', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-29T10:00:00Z'));

		expect(buildZipName('Boss Line Final.wav')).toBe('boss_line_final_2026-03-29.zip');
		expect(buildZipName(undefined)).toBe('soundcutter_export_2026-03-29.zip');

		vi.useRealTimers();
	});
});
