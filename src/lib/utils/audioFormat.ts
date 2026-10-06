// Supported input formats and their export behaviour. Detection prefers the
// file extension (MIME types for audio are unreliable across OSes/browsers),
// with the browser MIME type as fallback.
//
// The format tables themselves live in $lib/media/codecArgs.ts so the Electron
// main process can share them without pulling in DOM types. They are
// re-exported here for existing imports.

import { formatFromFileName, type AudioFormat } from '$lib/media/codecArgs';

export {
	AUDIO_FORMATS,
	EXTENSION_MAP,
	fastEncodingArgs,
	formatFromFileName,
	outputExtension,
	outputMime,
	preciseEncodingArgs,
	type AudioFormat
} from '$lib/media/codecArgs';

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
	return (
		formatFromFileName(file.name) ?? MIME_MAP[(file.type ?? '').toLowerCase()] ?? null
	);
}

export function isSupportedAudioFile(file: File): boolean {
	return detectAudioFormat(file) !== null || file.type.startsWith('audio/');
}

/** Formats browsers cannot decode via decodeAudioData — need ffmpeg.wasm. */
export function needsWasmDecode(format: AudioFormat | null): boolean {
	return format === 'wma';
}
