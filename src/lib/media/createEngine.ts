import { BrowserFfmpegEngine } from './browserFfmpegEngine';
import { DesktopFfmpegEngine } from './desktopFfmpegEngine';
import type { MediaSplitEngine } from './types';

/** Picks the native engine inside the Electron desktop shell, else FFmpeg.wasm. */
export function createSplitEngine(): MediaSplitEngine {
	return typeof window !== 'undefined' && window.MP3S_DESKTOP
		? new DesktopFfmpegEngine()
		: new BrowserFfmpegEngine();
}

export function isDesktopShell(): boolean {
	return typeof window !== 'undefined' && !!window.MP3S_DESKTOP;
}
