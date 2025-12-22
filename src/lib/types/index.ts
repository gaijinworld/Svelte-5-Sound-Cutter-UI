export interface Region {
	id: string;
	name: string;
	start: number;
	end: number;
	color: string;
	effects: ToneEffectsState;
}

export interface AudioState {
	file: File | null;
	buffer: AudioBuffer | null;
	duration: number;
	isPlaying: boolean;
	currentTime: number;
	loopPlayback: boolean;
}

export interface ExportState {
	isExporting: boolean;
	progress: number;
	currentRegion: string | null;
}

export interface PitchShiftParams {
	enabled: boolean;
	pitch: number;
}

export interface VibratoParams {
	enabled: boolean;
	frequency: number;
	depth: number;
}

export interface LowpassParams {
	enabled: boolean;
	frequency: number;
	resonance: number;
}

export interface HighpassParams {
	enabled: boolean;
	frequency: number;
}

export interface BandpassParams {
	enabled: boolean;
	frequency: number;
	Q: number;
}

export interface BitcrusherToneParams {
	enabled: boolean;
	bits: number;
}

export interface DistortionParams {
	enabled: boolean;
	amount: number;
	wet: number;
}

export interface ChebyshevParams {
	enabled: boolean;
	order: number;
}

export interface ChorusParams {
	enabled: boolean;
	frequency: number;
	delayTime: number;
	depth: number;
}

export interface TremoloParams {
	enabled: boolean;
	frequency: number;
	depth: number;
}

export interface PhaserParams {
	enabled: boolean;
	frequency: number;
	octaves: number;
	baseFrequency: number;
}

export interface ReverbParams {
	enabled: boolean;
	decay: number;
	wet: number;
}

export interface DelayParams {
	enabled: boolean;
	time: number;
	feedback: number;
	wet: number;
}

export interface ToneEffectsState {
	pitchShift: PitchShiftParams;
	vibrato: VibratoParams;
	lowpass: LowpassParams;
	highpass: HighpassParams;
	bandpass: BandpassParams;
	bitcrusher: BitcrusherToneParams;
	distortion: DistortionParams;
	chebyshev: ChebyshevParams;
	chorus: ChorusParams;
	tremolo: TremoloParams;
	phaser: PhaserParams;
	reverb: ReverbParams;
	delay: DelayParams;
}
