export function buildPartName(sourceName: string, index: number, extension = 'mp3'): string {
	const base = sourceName.replace(/\.[^/.]+$/, '') || 'audio';
	return `${base}_part_${String(index + 1).padStart(3, '0')}.${extension}`;
}
