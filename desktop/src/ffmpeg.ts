import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import ffmpegStaticPath from 'ffmpeg-static';
import {
	fastEncodingArgs,
	preciseEncodingArgs,
	type AudioFormat
} from '../../src/lib/media/codecArgs';
import type { ProgressEvent, SplitRequest } from './ipcTypes';

export class LocalApiError extends Error {
	constructor(
		public readonly status: number,
		message: string
	) {
		super(message);
	}
}

interface SplitJob {
	id: string;
	dir: string;
	proc: ChildProcessWithoutNullStreams | null;
	outputs: Set<string>;
	cancelled: boolean;
}

const jobs = new Map<string, SplitJob>();
const sourceByToken = new Map<string, { path: string; name: string; size: number }>();
const registeredPaths = new Set<string>();

/** ffmpeg-static resolves inside app.asar once packaged — use the unpacked copy. */
export function resolveFfmpegPath(): string {
	if (typeof ffmpegStaticPath !== 'string' || !ffmpegStaticPath) {
		throw new LocalApiError(500, 'FFmpeg binary is not bundled with this build.');
	}
	const resolved = app.isPackaged
		? ffmpegStaticPath.replace('app.asar', 'app.asar.unpacked')
		: ffmpegStaticPath;
	if (!fs.existsSync(resolved)) {
		throw new LocalApiError(500, `FFmpeg binary missing at ${resolved}`);
	}
	return resolved;
}

export function sanitizeBasename(name: string): string {
	const base = path.basename(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
	return base.slice(0, 180) || 'output';
}

function jobsRoot(): string {
	const dir = path.join(app.getPath('temp'), 'mp3s-jobs');
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

/** Remove stale job dirs (from crashed/killed runs) at startup. */
export function sweepStaleJobs(): void {
	const root = jobsRoot();
	for (const entry of fs.readdirSync(root)) {
		try {
			fs.rmSync(path.join(root, entry), { recursive: true, force: true });
		} catch {
			// Best effort — the dir may still be locked by a stray process.
		}
	}
}

export function registerSource(inputPath: string): {
	path: string;
	token: string;
	name: string;
	size: number;
} {
	const resolved = path.resolve(inputPath);
	const stat = fs.lstatSync(resolved);
	if (!stat.isFile() || stat.isSymbolicLink()) {
		throw new LocalApiError(400, 'The selected item is not a regular file.');
	}
	registeredPaths.add(resolved);
	// Reuse an existing token when the same file is registered again.
	for (const [token, record] of sourceByToken) {
		if (record.path === resolved) return { token, ...record };
	}
	const token = randomUUID();
	const record = { path: resolved, name: path.basename(resolved), size: stat.size };
	sourceByToken.set(token, record);
	return { token, ...record };
}

export function isRegisteredSource(inputPath: string): boolean {
	return registeredPaths.has(path.resolve(inputPath));
}

export function getSourceByToken(token: string): { path: string; name: string; size: number } | null {
	return sourceByToken.get(token) ?? null;
}

export function jobDir(jobId: string): string {
	const safe = sanitizeBasename(jobId);
	return path.join(jobsRoot(), safe);
}

function ensureJob(jobId: string): SplitJob {
	let job = jobs.get(jobId);
	if (!job) {
		const dir = jobDir(jobId);
		fs.mkdirSync(dir, { recursive: true });
		job = { id: jobId, dir, proc: null, outputs: new Set(), cancelled: false };
		jobs.set(jobId, job);
	}
	return job;
}

export function getJobOutput(jobId: string, name: string): string | null {
	const job = jobs.get(jobId);
	if (!job) return null;
	const resolved = path.resolve(job.dir, sanitizeBasename(name));
	if (!resolved.startsWith(path.resolve(job.dir) + path.sep)) return null;
	return job.outputs.has(resolved) && fs.existsSync(resolved) ? resolved : null;
}

export function cancelJob(jobId: string): boolean {
	const job = jobs.get(jobId);
	if (!job) return false;
	job.cancelled = true;
	if (job.proc && !job.proc.killed) job.proc.kill();
	return true;
}

export function disposeJob(jobId: string): void {
	const job = jobs.get(jobId);
	if (!job) return;
	if (job.proc && !job.proc.killed) job.proc.kill();
	jobs.delete(jobId);
	try {
		fs.rmSync(job.dir, { recursive: true, force: true });
	} catch {
		// Best effort.
	}
}

export function listJobOutputs(jobId: string): { name: string; path: string }[] {
	const job = jobs.get(jobId);
	if (!job) return [];
	return [...job.outputs].map((p) => ({ name: path.basename(p), path: p }));
}

export function copyJobOutputsTo(jobId: string, destDir: string): string[] {
	const job = jobs.get(jobId);
	if (!job) throw new LocalApiError(404, 'No outputs for this job.');
	const resolved = path.resolve(destDir);
	const stat = fs.lstatSync(resolved);
	if (!stat.isDirectory()) throw new LocalApiError(400, 'Not a directory.');
	const written: string[] = [];
	for (const src of job.outputs) {
		const dest = path.join(resolved, sanitizeBasename(path.basename(src)));
		fs.copyFileSync(src, dest);
		written.push(dest);
	}
	return written;
}

/**
 * Run a single segment split. Emits progress via `onProgress` and resolves
 * with the output file path. Uses spawn argv arrays — never a shell string.
 */
export function runSplit(
	req: SplitRequest,
	onProgress: (event: ProgressEvent) => void
): Promise<{ path: string; name: string; size: number }> {
	return new Promise((resolve, reject) => {
		const inputPath = path.resolve(req.inputPath);
		if (!isRegisteredSource(inputPath)) {
			reject(new LocalApiError(403, 'Input path is not a registered audio source.'));
			return;
		}
		if (!Number.isFinite(req.start) || req.start < 0) {
			reject(new LocalApiError(400, 'Invalid start time.'));
			return;
		}
		if (!Number.isFinite(req.duration) || req.duration <= 0) {
			reject(new LocalApiError(400, 'Invalid duration.'));
			return;
		}

		const job = ensureJob(req.jobId);
		const outName = sanitizeBasename(req.outputName);
		const outPath = path.join(job.dir, outName);
		try {
			fs.rmSync(outPath, { force: true });
		} catch {
			// ignore
		}

		const encoding =
			req.mode === 'precise'
				? preciseEncodingArgs(req.format)
				: fastEncodingArgs(req.format);

		const args = [
			'-hide_banner',
			'-nostats',
			'-progress',
			'pipe:1',
			'-ss',
			Math.max(0, req.start).toFixed(3),
			'-i',
			inputPath,
			'-t',
			Math.max(0.001, req.duration).toFixed(3),
			'-map',
			'0:a:0',
			...encoding,
			'-y',
			outPath
		];

		let proc: ChildProcessWithoutNullStreams;
		try {
			proc = spawn(resolveFfmpegPath(), args, { windowsHide: true });
		} catch (error) {
			reject(error instanceof Error ? error : new Error('Failed to start FFmpeg.'));
			return;
		}
		job.proc = proc;

		let stderrTail = '';
		let progressBuf = '';
		proc.stderr.on('data', (chunk: Buffer) => {
			stderrTail = (stderrTail + chunk.toString('utf8')).slice(-4000);
		});
		proc.stdout.on('data', (chunk: Buffer) => {
			progressBuf += chunk.toString('utf8');
			let idx: number;
			while ((idx = progressBuf.indexOf('\n')) >= 0) {
				const line = progressBuf.slice(0, idx).trim();
				progressBuf = progressBuf.slice(idx + 1);
				if (!line.startsWith('out_time_ms=')) continue;
				const outUs = Number(line.split('=')[1]);
				if (!Number.isFinite(outUs)) continue;
				const outTimeMs = outUs / 1000;
				const pct =
					req.duration > 0
						? Math.min(100, Math.max(0, (outTimeMs / (req.duration * 1000)) * 100))
						: undefined;
				onProgress({ jobId: req.jobId, outTimeMs, pct });
			}
		});

		proc.on('error', (error) => {
			if (job.proc === proc) job.proc = null;
			reject(error);
		});
		proc.on('close', (code) => {
			if (job.proc === proc) job.proc = null;
			if (job.cancelled) {
				try {
					fs.rmSync(outPath, { force: true });
				} catch {
					// ignore
				}
				reject(new LocalApiError(499, 'Cancelled.'));
				return;
			}
			if (code !== 0 || !fs.existsSync(outPath)) {
				const detail = stderrTail.split('\n').filter(Boolean).slice(-3).join(' | ');
				reject(
					new LocalApiError(
						502,
						`FFmpeg exited with code ${code ?? 'null'}${detail ? ` — ${detail}` : ''}`
					)
				);
				return;
			}
			job.outputs.add(outPath);
			resolve({
				path: outPath,
				name: `${outName}`,
				size: fs.statSync(outPath).size
			});
		});
	});
}

export function killAll(): void {
	for (const job of jobs.values()) {
		if (job.proc && !job.proc.killed) job.proc.kill();
	}
	jobs.clear();
}
