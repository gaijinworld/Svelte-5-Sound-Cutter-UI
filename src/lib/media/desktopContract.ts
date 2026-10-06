// IPC contract shared by the Electron main process (desktop/src/ipcTypes.ts
// re-exports it) and the renderer bridge. Pure types only — no DOM, no Node.

import type { AudioFormat } from './codecArgs';

export interface OpenAudioResult {
	cancelled: boolean;
	/** Absolute native path — usable as a split input. */
	path?: string;
	/** Loopback URL the renderer can fetch to preview/decode the file. */
	url?: string;
	name?: string;
	size?: number;
}

export interface RegisterSourceResult {
	ok: boolean;
	reason?: string;
	path?: string;
	name?: string;
	size?: number;
}

export interface ChooseOutputDirResult {
	cancelled: boolean;
	path?: string;
}

export interface DesktopSplitRequest {
	jobId: string;
	inputPath: string;
	outputName: string;
	start: number;
	duration: number;
	mode: 'lossless' | 'precise';
	format: AudioFormat;
}

export interface DesktopSplitResponse {
	ok: boolean;
	name: string;
	/** Absolute path of the produced file inside the job directory. */
	path: string;
	size: number;
}

export interface SaveOutputsRequest {
	jobId: string;
	/** Renderer-suggested dialog default (sanitized in main). */
	dirHint?: string;
}

export interface SaveOutputsResult {
	cancelled: boolean;
	dir?: string;
	files?: string[];
}

export interface DesktopProgressEvent {
	jobId: string;
	outTimeMs: number;
	/** 0–100 when the request carried a positive duration, else undefined. */
	pct?: number;
}

export interface Mp3sDesktopApi {
	openAudio(): Promise<OpenAudioResult>;
	pathForFile(file: File): string | null;
	registerSource(path: string): Promise<RegisterSourceResult>;
	chooseOutputDir(): Promise<ChooseOutputDirResult>;
	split(request: DesktopSplitRequest): Promise<DesktopSplitResponse>;
	cancel(jobId: string): Promise<{ cancelled: boolean }>;
	saveOutputs(req: SaveOutputsRequest): Promise<SaveOutputsResult>;
	revealPath(path: string): Promise<string>;
	onProgress(callback: (event: DesktopProgressEvent) => void): () => void;
}

export interface Mp3sDesktopEnv {
	isDesktop: true;
	platform: string;
	version: string;
	apiBase: string;
}
