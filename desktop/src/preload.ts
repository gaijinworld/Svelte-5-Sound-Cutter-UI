import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
	ChooseOutputDirResult,
	OpenAudioResult,
	ProgressEvent,
	RegisterSourceResult,
	SaveOutputsRequest,
	SaveOutputsResult,
	SplitRequest,
	SplitResponse
} from './ipcTypes';

const arg = (name: string): string | undefined =>
	(process.argv || []).find((a) => a.startsWith(`--mp3s-${name}=`))?.split('=').slice(1).join('=');

const APP_VERSION = arg('app-version') || '0.0.0-dev';
const API_BASE = arg('api-base') || '';

contextBridge.exposeInMainWorld('MP3S_DESKTOP_ENV', {
	isDesktop: true,
	platform: process.platform,
	version: APP_VERSION,
	apiBase: API_BASE
});

contextBridge.exposeInMainWorld('MP3S_DESKTOP', {
	// Native open dialog → registers the file and returns a streamable URL.
	openAudio: (): Promise<OpenAudioResult> => ipcRenderer.invoke('mp3s:audio-open'),
	// Recover the real on-disk path of a dropped/picked File (Electron >=32).
	pathForFile: (file: File): string | null => {
		try {
			return webUtils.getPathForFile(file) || null;
		} catch {
			return null;
		}
	},
	// Whitelist a dropped file path for use as a native split input.
	registerSource: (path: string): Promise<RegisterSourceResult> =>
		ipcRenderer.invoke('mp3s:register-source', path),
	chooseOutputDir: (): Promise<ChooseOutputDirResult> =>
		ipcRenderer.invoke('mp3s:choose-output-dir'),
	split: (request: SplitRequest): Promise<SplitResponse> =>
		ipcRenderer.invoke('mp3s:split', request),
	cancel: (jobId: string): Promise<{ cancelled: boolean }> =>
		ipcRenderer.invoke('mp3s:cancel', jobId),
	// Copy every produced output of a job into a user-picked folder.
	saveOutputs: (req: SaveOutputsRequest): Promise<SaveOutputsResult> =>
		ipcRenderer.invoke('mp3s:save-outputs', req),
	// "" on success, else an OS error message. Reveals a file in Explorer.
	revealPath: (path: string): Promise<string> => ipcRenderer.invoke('mp3s:reveal', path),
	onProgress: (callback: (event: ProgressEvent) => void): (() => void) => {
		const listener = (_e: unknown, payload: ProgressEvent) => callback(payload);
		ipcRenderer.on('mp3s:progress', listener);
		return () => ipcRenderer.removeListener('mp3s:progress', listener);
	}
});
