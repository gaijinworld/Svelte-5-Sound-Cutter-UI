import type { SplitSegment } from '$lib/types';
import { detectAudioFormat, type AudioFormat } from '$lib/utils/audioFormat';
import type { Mp3sDesktopApi } from './desktopContract';
import type { MediaSplitEngine, SplitOptions, SplitResult } from './types';

// File objects synthesized from native-dialog picks have no real filesystem
// path, and dropped Files carry one only via webUtils in the preload. The
// uploader records dialog-picked paths here so the engine can resolve them.
// WeakMap: entries die with the File objects.
const filePaths = new WeakMap<File, string>();

export function rememberDesktopFilePath(file: File, path: string): void {
	filePaths.set(file, path);
}

function api(): Mp3sDesktopApi {
	const bridge = window.MP3S_DESKTOP;
	if (!bridge) throw new Error('Desktop bridge is unavailable.');
	return bridge;
}

export class DesktopFfmpegEngine implements MediaSplitEngine {
	private jobId: string | null = null;
	private inputPath: string | null = null;
	private format: AudioFormat = 'mp3';
	private unsubscribe: (() => void) | null = null;
	private partProgress: ((pct: number) => void) | null = null;

	/** Job holding this run's outputs on disk — used by "Save all to folder". */
	get currentJobId(): string | null {
		return this.jobId;
	}

	async prepare(file: File): Promise<void> {
		await this.dispose();

		const bridge = api();
		const path = bridge.pathForFile(file) ?? filePaths.get(file) ?? null;
		if (!path) {
			throw new Error('Could not resolve a local path for this file.');
		}
		const reg = await bridge.registerSource(path);
		if (!reg.ok || !reg.path) {
			throw new Error(reg.reason ?? 'Could not register the audio source.');
		}

		this.inputPath = reg.path;
		this.format = detectAudioFormat(file) ?? 'mp3';
		this.jobId = crypto.randomUUID();
		this.unsubscribe = bridge.onProgress((event) => {
			if (event.jobId === this.jobId && typeof event.pct === 'number') {
				this.partProgress?.(event.pct);
			}
		});
	}

	async split(
		segment: SplitSegment,
		outputName: string,
		options: SplitOptions = {}
	): Promise<SplitResult> {
		if (!this.jobId || !this.inputPath) {
			throw new Error('Splitter engine is not prepared.');
		}
		const base = window.MP3S_DESKTOP_ENV?.apiBase;
		if (!base) throw new Error('Desktop bridge is unavailable.');

		this.partProgress = options.onProgress ?? null;
		const res = await api().split({
			jobId: this.jobId,
			inputPath: this.inputPath,
			outputName,
			start: segment.start,
			duration: segment.duration,
			mode: options.mode ?? 'lossless',
			format: this.format
		});
		this.partProgress = null;

		// The output lives on disk inside the job dir; stream it back over the
		// loopback server so the existing Blob/download/ZIP UI works unchanged.
		const blob = await fetch(
			`${base}/output/${encodeURIComponent(this.jobId)}/${encodeURIComponent(res.name)}`
		).then((r) => {
			if (!r.ok) throw new Error(`Could not read ${res.name} (HTTP ${r.status}).`);
			return r.blob();
		});

		return { name: res.name, blob, segment };
	}

	async dispose(): Promise<void> {
		this.partProgress = null;
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.inputPath = null;
		// The job dir intentionally survives: "Save all to folder" needs the
		// produced files on disk after splitting finishes. The main process
		// sweeps stale job dirs on next launch.
	}

	async cancel(): Promise<void> {
		if (this.jobId) await api().cancel(this.jobId);
	}
}
