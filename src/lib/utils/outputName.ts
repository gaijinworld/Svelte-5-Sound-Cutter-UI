export function buildPartName(sourceName: string, index: number): string {
	const base = sourceName.replace(/\.[^/.]+$/, '') || 'audio';
	return `${base}_part_${String(index + 1).padStart(3, '0')}.mp3`;
}
