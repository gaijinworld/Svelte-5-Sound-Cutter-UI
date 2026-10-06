import { describe, expect, it } from 'vitest';
import {
	detectAudioFormat,
	isSupportedAudioFile,
	needsWasmDecode,
	outputExtension,
	outputMime,
	fastEncodingArgs,
	preciseEncodingArgs
} from './audioFormat';

describe('detectAudioFormat', () => {
	it('detects formats by extension', () => {
		expect(detectAudioFormat({ name: 'song.mp3' })).toBe('mp3');
		expect(detectAudioFormat({ name: 'song.WAV' })).toBe('wav');
		expect(detectAudioFormat({ name: 'song.m4a' })).toBe('m4a');
		expect(detectAudioFormat({ name: 'song.ogg' })).toBe('ogg');
		expect(detectAudioFormat({ name: 'song.oga' })).toBe('ogg');
		expect(detectAudioFormat({ name: 'song.opus' })).toBe('opus');
		expect(detectAudioFormat({ name: 'song.flac' })).toBe('flac');
		expect(detectAudioFormat({ name: 'song.wma' })).toBe('wma');
		expect(detectAudioFormat({ name: 'song.asf' })).toBe('wma');
	});

	it('falls back to MIME type when the extension is unknown', () => {
		expect(detectAudioFormat({ name: 'song.xyz', type: 'audio/mpeg' })).toBe('mp3');
		expect(detectAudioFormat({ name: 'song.xyz', type: 'audio/x-m4a' })).toBe('m4a');
		expect(detectAudioFormat({ name: 'song.xyz', type: 'audio/x-ms-wma' })).toBe('wma');
	});

	it('prefers extension over a generic MIME type', () => {
		expect(detectAudioFormat({ name: 'clip.wav', type: 'audio/mpeg' })).toBe('wav');
	});

	it('returns null for non-audio files', () => {
		expect(detectAudioFormat({ name: 'doc.pdf', type: 'application/pdf' })).toBeNull();
		expect(detectAudioFormat({ name: 'noext' })).toBeNull();
	});
});

describe('isSupportedAudioFile / needsWasmDecode', () => {
	it('accepts known extensions and audio mime types', () => {
		const f = (name: string, type = '') => ({ name, type }) as File;
		expect(isSupportedAudioFile(f('a.flac'))).toBe(true);
		expect(isSupportedAudioFile(f('b.bin', 'audio/basic'))).toBe(true);
		expect(isSupportedAudioFile(f('c.txt', 'text/plain'))).toBe(false);
	});

	it('flags only WMA for wasm decoding', () => {
		expect(needsWasmDecode('wma')).toBe(true);
		expect(needsWasmDecode('mp3')).toBe(false);
		expect(needsWasmDecode('ogg')).toBe(false);
	});
});

describe('output helpers', () => {
	it('round-trips the extension and mime per format', () => {
		expect(outputExtension('m4a')).toBe('m4a');
		expect(outputMime('m4a')).toBe('audio/mp4');
		expect(outputMime('wav')).toBe('audio/wav');
		expect(outputMime('wma')).toBe('audio/x-ms-wma');
	});

	it('stream-copies in fast mode and re-encodes in precise mode', () => {
		expect(fastEncodingArgs('mp3')).toContain('copy');
		expect(preciseEncodingArgs('mp3')).toContain('libmp3lame');
		expect(fastEncodingArgs('wma')).toContain('asf');
		expect(preciseEncodingArgs('wma')).toContain('wmav2');
		expect(preciseEncodingArgs('wav')).toContain('pcm_s16le');
		expect(preciseEncodingArgs('ogg')).toContain('libvorbis');
		expect(preciseEncodingArgs('opus')).toContain('libopus');
	});
});
