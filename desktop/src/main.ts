import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { startLocalRendererServer } from './server';
import {
	LocalApiError,
	cancelJob,
	copyJobOutputsTo,
	getSourceByToken,
	killAll,
	registerSource,
	runSplit,
	sweepStaleJobs
} from './ffmpeg';
import { AUDIO_FORMATS } from '../../src/lib/media/codecArgs';
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

let mainWindow: BrowserWindow | null = null;
let serverInstance: http.Server | null = null;
let serverPort = 0;

const SMOKE_TEST = process.argv.includes('--mp3s-smoke-test');
// Smoke-test seam: native dialogs cannot be driven headlessly, so scripted
// paths let the packaged-app check exercise the same IPC handlers end to end.
const SMOKE_INPUT_FILE = process.env.MP3S_SMOKE_INPUT_FILE || '';
const SMOKE_OUTPUT_DIR = process.env.MP3S_SMOKE_OUTPUT_DIR || '';

if (SMOKE_TEST) {
	app.setPath('userData', fs.mkdtempSync(path.join(app.getPath('temp'), 'mp3s-smoke-')));
}

const AUDIO_FILE_FILTERS = [
	{
		name: 'Audio files',
		extensions: ['mp3', 'wav', 'wave', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'wma', 'asf']
	},
	{ name: 'All files', extensions: ['*'] }
];

function resolveAppVersion(): string {
	const base = app.getAppPath();
	for (const pkgPath of [path.join(base, 'package.json'), path.join(base, '..', 'package.json')]) {
		try {
			const pkg = require(pkgPath) as { version?: string };
			if (pkg?.version) return pkg.version;
		} catch {
			// keep looking
		}
	}
	return app.getVersion();
}

function apiBase(): string {
	return `http://127.0.0.1:${serverPort}/api/mp3s`;
}

function sourceUrl(token: string): string {
	return `${apiBase()}/source/${token}`;
}

function trustedSender(event: Electron.IpcMainInvokeEvent): boolean {
	return (
		event.sender === mainWindow?.webContents &&
		event.senderFrame === mainWindow?.webContents.mainFrame
	);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

async function createWindow(): Promise<void> {
	const appVersion = resolveAppVersion();
	const windowTitle = `Audio Splitter v${appVersion}${app.isPackaged ? '' : ' (dev)'}`;

	// The loopback server must be up before the window: apiBase is injected
	// into the preload via additionalArguments.
	const started = await startLocalRendererServer(path.join(__dirname, 'renderer'));
	serverInstance = started.server;
	serverPort = started.port;

	mainWindow = new BrowserWindow({
		show: !SMOKE_TEST,
		width: 1440,
		height: 920,
		minWidth: 1024,
		minHeight: 680,
		title: windowTitle,
		icon: path.join(__dirname, '..', 'assets', 'icon.png'),
		backgroundColor: '#f8fafc',
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			additionalArguments: [`--mp3s-app-version=${appVersion}`, `--mp3s-api-base=${apiBase()}`]
		}
	});

	// Keep the packaged version in the title bar instead of letting the
	// renderer's static <title> (no access to app.getVersion()) win.
	mainWindow.webContents.on('page-title-updated', (event) => {
		event.preventDefault();
		mainWindow?.setTitle(windowTitle);
	});

	// No new windows from the renderer; external links go to the OS browser.
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith('https:') || url.startsWith('http:')) {
			void shell.openExternal(url);
		}
		return { action: 'deny' };
	});

	mainWindow.webContents.on('will-navigate', (event, target) => {
		const current = mainWindow?.webContents.getURL();
		if (current && new URL(target).origin !== new URL(current).origin) {
			event.preventDefault();
			if (target.startsWith('https://')) void shell.openExternal(target);
		}
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	// Load "/" — the SvelteKit router cannot match "/index.html" as a route
	// and would render its "Not found" error page. The server maps "/" to
	// index.html anyway.
	void mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);
}

function registerIpc(): void {
	ipcMain.handle('mp3s:audio-open', async (event): Promise<OpenAudioResult> => {
		if (!trustedSender(event)) throw new LocalApiError(403, 'Untrusted window.');
		if (SMOKE_TEST && SMOKE_INPUT_FILE) {
			const record = registerSource(SMOKE_INPUT_FILE);
			return {
				cancelled: false,
				path: record.path,
				url: sourceUrl(record.token),
				name: record.name,
				size: record.size
			};
		}
		if (!mainWindow) throw new LocalApiError(500, 'The app window is not ready.');
		const result = await dialog.showOpenDialog(mainWindow, {
			title: 'Open an audio file',
			properties: ['openFile'],
			filters: AUDIO_FILE_FILTERS
		});
		if (result.canceled || !result.filePaths[0]) return { cancelled: true };
		const record = registerSource(result.filePaths[0]);
		return {
			cancelled: false,
			path: record.path,
			url: sourceUrl(record.token),
			name: record.name,
			size: record.size
		};
	});

	ipcMain.handle('mp3s:register-source', (event, inputPath: unknown): RegisterSourceResult => {
		if (!trustedSender(event)) throw new LocalApiError(403, 'Untrusted window.');
		if (typeof inputPath !== 'string' || !inputPath.trim() || !path.isAbsolute(inputPath)) {
			return { ok: false, reason: 'Invalid path.' };
		}
		try {
			const record = registerSource(inputPath);
			return { ok: true, path: record.path, name: record.name, size: record.size };
		} catch (error) {
			return {
				ok: false,
				reason: error instanceof Error ? error.message : 'Could not register the file.'
			};
		}
	});

	ipcMain.handle('mp3s:choose-output-dir', async (event): Promise<ChooseOutputDirResult> => {
		if (!trustedSender(event)) throw new LocalApiError(403, 'Untrusted window.');
		if (SMOKE_TEST && SMOKE_OUTPUT_DIR) {
			fs.mkdirSync(SMOKE_OUTPUT_DIR, { recursive: true });
			return { cancelled: false, path: SMOKE_OUTPUT_DIR };
		}
		if (!mainWindow) throw new LocalApiError(500, 'The app window is not ready.');
		const result = await dialog.showOpenDialog(mainWindow, {
			title: 'Choose a folder for the split parts',
			properties: ['openDirectory', 'createDirectory']
		});
		return result.canceled || !result.filePaths[0]
			? { cancelled: true }
			: { cancelled: false, path: result.filePaths[0] };
	});

	ipcMain.handle('mp3s:split', async (event, payload: unknown): Promise<SplitResponse> => {
		if (!trustedSender(event)) throw new LocalApiError(403, 'Untrusted window.');
		const req = payload as Partial<SplitRequest> | undefined;
		if (
			!req ||
			typeof req.jobId !== 'string' ||
			typeof req.inputPath !== 'string' ||
			typeof req.outputName !== 'string' ||
			!isFiniteNumber(req.start) ||
			!isFiniteNumber(req.duration) ||
			(req.mode !== 'lossless' && req.mode !== 'precise') ||
			!AUDIO_FORMATS.includes(req.format as never)
		) {
			throw new LocalApiError(400, 'Invalid split request.');
		}
		const send = (e: ProgressEvent) => {
			try {
				event.sender.send('mp3s:progress', e);
			} catch {
				// Window may already be gone.
			}
		};
		const result = await runSplit(req as SplitRequest, send);
		return { ok: true, ...result };
	});

	ipcMain.handle('mp3s:cancel', (event, jobId: unknown) => {
		if (!trustedSender(event)) throw new LocalApiError(403, 'Untrusted window.');
		return { cancelled: typeof jobId === 'string' ? cancelJob(jobId) : false };
	});

	ipcMain.handle('mp3s:save-outputs', async (event, payload: unknown): Promise<SaveOutputsResult> => {
		if (!trustedSender(event)) throw new LocalApiError(403, 'Untrusted window.');
		const req = payload as SaveOutputsRequest | undefined;
		if (!req || typeof req.jobId !== 'string') throw new LocalApiError(400, 'Invalid request.');

		let dir: string | undefined;
		if (SMOKE_TEST && SMOKE_OUTPUT_DIR) {
			fs.mkdirSync(SMOKE_OUTPUT_DIR, { recursive: true });
			dir = SMOKE_OUTPUT_DIR;
		} else {
			if (!mainWindow) throw new LocalApiError(500, 'The app window is not ready.');
			const picked = await dialog.showOpenDialog(mainWindow, {
				title: 'Choose a folder for the split parts',
				defaultPath:
					typeof req.dirHint === 'string' && req.dirHint ? req.dirHint : app.getPath('music'),
				properties: ['openDirectory', 'createDirectory']
			});
			if (picked.canceled || !picked.filePaths[0]) return { cancelled: true };
			dir = picked.filePaths[0];
		}

		const files = copyJobOutputsTo(req.jobId, dir);
		return { cancelled: false, dir, files: files.map((f) => path.basename(f)) };
	});

	ipcMain.handle('mp3s:reveal', (event, targetPath: unknown): Promise<string> => {
		if (!trustedSender(event)) return Promise.resolve('Untrusted window.');
		const p = typeof targetPath === 'string' ? targetPath.trim() : '';
		if (!p || !path.isAbsolute(p)) return Promise.resolve('Invalid path.');
		try {
			if (!fs.existsSync(p)) return Promise.resolve('This path does not exist on your PC.');
		} catch {
			return Promise.resolve('This path does not exist on your PC.');
		}
		shell.showItemInFolder(p);
		return Promise.resolve('');
	});
}

if (process.platform === 'win32') {
	app.setAppUserModelId('com.gaijinworld.audiosplitter');
}

app.whenReady().then(async () => {
	sweepStaleJobs();
	registerIpc();
	await createWindow();

	app.on('activate', async () => {
		if (BrowserWindow.getAllWindows().length === 0) await createWindow();
	});
});

app.on('before-quit', () => {
	killAll();
});

app.on('window-all-closed', () => {
	if (serverInstance) {
		serverInstance.close();
		serverInstance = null;
	}
	if (process.platform !== 'darwin') app.quit();
});
