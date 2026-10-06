// Pure, environment-agnostic audio-format tables shared by the browser
// (FFmpeg.wasm) engine and the Electron main process (native FFmpeg). Keep
// this file free of DOM and Node imports — desktop tsup bundles it directly.

export type AudioFormat = 'mp3' | 'wav' | 'm4a' | 'aac' | 'ogg' | 'opus' | 'flac' | 'wma';

export const AUDIO_FORMATS: readonly AudioFormat[] = [
	'mp3',
	'wav',
	'm4a',
	'aac',
	'ogg',
	'opus',
	'flac',
	'wma'
];

export const EXTENSION_MAP: Record<string, AudioFormat> = {
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

export function formatFromFileName(name: string): AudioFormat | null {
	const ext = name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
	return ext ? (EXTENSION_MAP[ext] ?? null) : null;
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
