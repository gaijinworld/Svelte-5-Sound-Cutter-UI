export function formatTimecode(seconds: number): string {
	const totalMs = Math.max(0, Math.round(seconds * 1000));
	const hours = Math.floor(totalMs / 3_600_000);
	const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
	const secs = Math.floor((totalMs % 60_000) / 1000);
	const ms = totalMs % 1000;

	return (
		`${hours}:` +
		`${minutes.toString().padStart(2, '0')}:` +
		`${secs.toString().padStart(2, '0')}.` +
		`${ms.toString().padStart(3, '0')}`
	);
}

export function parseTimecode(input: string): number | null {
	const value = input.trim();
	const match = value.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/);

	if (!match) return null;

	const hours = Number(match[1] ?? 0);
	const minutes = Number(match[2]);
	const seconds = Number(match[3]);
	const millis = Number((match[4] ?? '').padEnd(3, '0') || 0);

	if (minutes > 59 || seconds > 59) return null;

	return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}
