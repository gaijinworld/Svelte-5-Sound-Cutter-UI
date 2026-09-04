import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { loadFfmpeg, resetFfmpeg } from '$lib/audio/ffmpegClient';
import type { SplitSegment } from '$lib/types';
import type { MediaSplitEngine, SplitResult } from './types';

export class BrowserFfmpegEngine implements MediaSplitEngine {
	private ffmpeg: FFmpeg | null = null;
	private inputName: string | null = null;

	async prepare(file: File): Promise<void> {
		await this.dispose();
		this.ffmpeg = await loadFfmpeg();
		this.inputName = `source_${Date.now()}.mp3`;

		const inputData = new Uint8Array(await file.arrayBuffer());
		await this.ffmpeg.writeFile(this.inputName, inputData);
	}

	async split(segment: SplitSegment, outputName: string): Promise<SplitResult> {
		if (!this.ffmpeg || !this.inputName) {
			throw new Error('Splitter engine is not prepared.');
		}

		const start = Math.max(0, segment.start).toFixed(3);
		const duration = Math.max(0, segment.duration).toFixed(3);

		try {
			await this.ffmpeg.deleteFile(outputName);
		} catch {
			// Output does not exist yet.
		}

		await this.ffmpeg.exec([
			'-ss',
			start,
			'-i',
			this.inputName,
			'-t',
			duration,
			'-map',
			'0:a:0',
			'-c:a',
			'copy',
			'-avoid_negative_ts',
			'make_zero',
			'-y',
			outputName
		]);

		const data = (await this.ffmpeg.readFile(outputName)) as Uint8Array;
		const blob = new Blob([Uint8Array.from(data)], { type: 'audio/mpeg' });

		try {
			await this.ffmpeg.deleteFile(outputName);
		} catch {
			// Ignore cleanup failure; the virtual FS is reset on engine teardown.
		}

		return { name: outputName, blob, segment };
	}

	async dispose(): Promise<void> {
		if (this.ffmpeg && this.inputName) {
			try {
				await this.ffmpeg.deleteFile(this.inputName);
			} catch {
				// Ignore missing input file during teardown.
			}
		}

		this.inputName = null;
	}

	async cancel(): Promise<void> {
		if (this.ffmpeg) this.ffmpeg.terminate();
		this.ffmpeg = null;
		this.inputName = null;
		resetFfmpeg();
	}
}
