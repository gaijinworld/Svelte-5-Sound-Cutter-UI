import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const DEFAULT_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
const CONFIGURED_BASE_URL = import.meta.env.VITE_FFMPEG_CORE_BASE_URL?.trim();
const BASE_URL = (CONFIGURED_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
const FFMPEG_TIMEOUT = 30000;

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export async function loadFfmpeg(): Promise<FFmpeg> {
	if (ffmpeg) return ffmpeg;
	if (loadPromise) return loadPromise;

	loadPromise = (async () => {
		const instance = new FFmpeg();

		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error('FFmpeg load timed out. Check the configured FFmpeg core URL or your connection.')), FFMPEG_TIMEOUT);
		});

		await Promise.race([
			instance.load({
				coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
				wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm')
			}),
			timeoutPromise
		]);

		ffmpeg = instance;
		return instance;
	})().catch((err) => {
		loadPromise = null;
		throw err;
	});

	return loadPromise;
}

export function resetFfmpeg(): void {
	ffmpeg = null;
	loadPromise = null;
}
