// Supported input formats and their export behaviour. Detection prefers the
// file extension (MIME types for audio are unreliable across OSes/browsers),
// with the browser MIME type as fallback.

export type AudioFormat = 'mp3' | 'wav' | 'm4a' | 'aac' | 'ogg' | 'opus' | 'flac' | 'wma';

const EXTENSION_MAP: Record<string, AudioFormat> = {
	mp3: 'mp3',
	wav: 'wav',
	wave: 'wav',
	m4a: 'm4a',
	aac: 'aac',
	ogg: 'ogg',
	oga: 'ogg',
	opus: 'opus',
	flac: 'flac',
	wma: 'wma',
	asf: 'wma'
};

const MIME_MAP: Record<string, AudioFormat> = {
	'audio/mpeg': 'mp3',
	'audio/mp3': 'mp3',
	'audio/wav': 'wav',
	'audio/x-wav': 'wav',
	'audio/wave': 'wav',
	'audio/mp4': 'm4a',
	'audio/x-m4a': 'm4a',
	'audio/aac': 'aac',
	'audio/x-aac': 'aac',
	'audio/ogg': 'ogg',
	'audio/opus': 'opus',
	'audio/flac': 'flac',
	'audio/x-flac': 'flac',
	'audio/x-ms-wma': 'wma',
	'audio/x-ms-asf': 'wma'
};

export const AUDIO_ACCEPT =
	'.mp3,.wav,.wave,.m4a,.aac,.ogg,.oga,.opus,.flac,.wma,.asf,audio/*';

export function detectAudioFormat(file: { name: string; type?: string }): AudioFormat | null {
	const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
	if (ext && EXTENSION_MAP[ext]) return EXTENSION_MAP[ext];
	const mime = (file.type ?? '').toLowerCase();
	return MIME_MAP[mime] ?? null;
}

export function isSupportedAudioFile(file: File): boolean {
	return detectAudioFormat(file) !== null || file.type.startsWith('audio/');
}

/** Formats browsers cannot decode via decodeAudioData — need ffmpeg.wasm. */
export function needsWasmDecode(format: AudioFormat | null): boolean {
	return format === 'wma';
}

export function outputExtension(format: AudioFormat): string {
	return format === 'opus' ? 'opus' : format;
}

export function outputMime(format: AudioFormat): string {
	switch (format) {
		case 'mp3':
			return 'audio/mpeg';
		case 'wav':
			return 'audio/wav';
		case 'm4a':
			return 'audio/mp4';
		case 'aac':
			return 'audio/aac';
		case 'ogg':
		case 'opus':
			return 'audio/ogg';
		case 'flac':
			return 'audio/flac';
		case 'wma':
			return 'audio/x-ms-wma';
	}
}

/** ffmpeg args for the Fast/Lossless mode: stream-copy inside the same container. */
export function fastEncodingArgs(format: AudioFormat): string[] {
	const copy = ['-c:a', 'copy'];
	switch (format) {
		case 'mp3':
			return [...copy, '-avoid_negative_ts', 'make_zero'];
		case 'wav':
			return [...copy, '-f', 'wav'];
		case 'm4a':
			return [...copy, '-f', 'mp4', '-movflags', '+faststart'];
		case 'aac':
			return [...copy, '-f', 'adts'];
		case 'ogg':
			return [...copy, '-f', 'ogg'];
		case 'opus':
			return [...copy, '-f', 'opus'];
		case 'flac':
			return [...copy, '-f', 'flac'];
		case 'wma':
			return [...copy, '-f', 'asf'];
	}
}

/** ffmpeg args for Precise mode: decode + re-encode to the same codec. */
export function preciseEncodingArgs(format: AudioFormat): string[] {
	switch (format) {
		case 'mp3':
			return ['-c:a', 'libmp3lame', '-q:a', '2'];
		case 'wav':
			return ['-c:a', 'pcm_s16le', '-f', 'wav'];
		case 'm4a':
			return ['-c:a', 'aac', '-b:a', '192k', '-f', 'mp4', '-movflags', '+faststart'];
		case 'aac':
			return ['-c:a', 'aac', '-b:a', '192k', '-f', 'adts'];
		case 'ogg':
			return ['-c:a', 'libvorbis', '-q:a', '5', '-f', 'ogg'];
		case 'opus':
			return ['-c:a', 'libopus', '-b:a', '128k', '-f', 'opus'];
		case 'flac':
			return ['-c:a', 'flac', '-f', 'flac'];
		case 'wma':
			return ['-c:a', 'wmav2', '-b:a', '128k', '-f', 'asf'];
	}
}
