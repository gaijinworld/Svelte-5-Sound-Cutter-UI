import type { SplitSegment } from '$lib/types';

export type SplitMode = 'lossless' | 'precise';

export interface SplitOptions {
	mode?: SplitMode;
	/** Per-part progress (0–100). Native engines stream FFmpeg progress; the
	 *  browser engine may ignore it. */
	onProgress?: (pct: number) => void;
}

export interface SplitResult {
	name: string;
	blob: Blob;
	segment: SplitSegment;
}

export interface MediaSplitEngine {
	prepare(file: File): Promise<void>;
	split(segment: SplitSegment, outputName: string, options?: SplitOptions): Promise<SplitResult>;
	dispose(): Promise<void>;
	cancel(): Promise<void>;
}
