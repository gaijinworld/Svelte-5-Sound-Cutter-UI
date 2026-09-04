import type { SplitSegment } from '$lib/types';

export interface SplitResult {
	name: string;
	blob: Blob;
	segment: SplitSegment;
}

export interface MediaSplitEngine {
	prepare(file: File): Promise<void>;
	split(segment: SplitSegment, outputName: string): Promise<SplitResult>;
	dispose(): Promise<void>;
	cancel(): Promise<void>;
}
