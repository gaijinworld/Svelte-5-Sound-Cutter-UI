export function sanitizeFilename(name: string): string {
	return name
		.replace(/[^a-zA-Z0-9_\-\s]/g, '')
		.replace(/\s+/g, '_')
		.toLowerCase();
}

export function buildExportBaseName(name: string, usedNames: Map<string, number>): string {
	const sanitized = sanitizeFilename(name);
	const base = sanitized.length > 0 ? sanitized : 'region';
	const count = (usedNames.get(base) ?? 0) + 1;
	usedNames.set(base, count);
	return count === 1 ? base : `${base}_${count}`;
}

export function buildZipName(fileName: string | null | undefined): string {
	const base = fileName
		? sanitizeFilename(fileName.replace(/\.[^/.]+$/, ''))
		: 'soundcutter_export';
	const safeBase = base.length > 0 ? base : 'soundcutter_export';
	const date = new Date().toISOString().slice(0, 10);
	return `${safeBase}_${date}.zip`;
}
