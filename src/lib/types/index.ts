export interface SplitPoint {
	id: string;
	time: number;
}

export interface SplitSegment {
	id: string;
	index: number;
	start: number;
	end: number;
	duration: number;
	enabled: boolean;
}

export interface AudioState {
	file: File | null;
	buffer: AudioBuffer | null;
	duration: number;
	isPlaying: boolean;
	currentTime: number;
	loopPlayback: boolean;
}
