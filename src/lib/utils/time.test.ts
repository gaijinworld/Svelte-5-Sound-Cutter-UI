import { describe, expect, it } from 'vitest';
import { formatTimecode, parseTimecode } from './time';

describe('timecode utilities', () => {
	it('formats millisecond timecodes', () => {
		expect(formatTimecode(6)).toBe('0:00:06.000');
		expect(formatTimecode(90.25)).toBe('0:01:30.250');
		expect(formatTimecode(3723.004)).toBe('1:02:03.004');
	});

	it('parses millisecond timecodes', () => {
		expect(parseTimecode('0:00:06.000')).toBe(6);
		expect(parseTimecode('0:01:30.250')).toBe(90.25);
		expect(parseTimecode('1:02:03.004')).toBe(3723.004);
	});

	it('rejects invalid values', () => {
		expect(parseTimecode('not-a-time')).toBeNull();
		expect(parseTimecode('0:60:00.000')).toBeNull();
		expect(parseTimecode('0:00:60.000')).toBeNull();
	});
});
