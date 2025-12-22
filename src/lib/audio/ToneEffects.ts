/**
 * Tone.js-based Effects Engine
 * Provides high-quality audio effects for voice manipulation
 */
import * as Tone from 'tone';
import type { ToneEffectsState } from '$lib/types';

export class ToneEffectsEngine {
	private initialized = false;

	async init(): Promise<void> {
		if (this.initialized) return;
		await Tone.start();
		this.initialized = true;
	}

	/**
	 * Render an audio buffer with effects applied using offline processing
	 */
	async renderWithEffects(
		audioBuffer: AudioBuffer,
		startTime: number,
		endTime: number,
		effects: ToneEffectsState
	): Promise<AudioBuffer> {
		// Validate times
		const clampedStart = Math.max(0, Math.min(startTime, audioBuffer.duration));
		const clampedEnd = Math.max(clampedStart, Math.min(endTime, audioBuffer.duration));
		const duration = Math.max(0.01, clampedEnd - clampedStart);

		// Extract the region from the buffer
		const regionBuffer = this.extractRegion(audioBuffer, clampedStart, clampedEnd);

		// Use Tone.Offline for rendering
		const rendered = await Tone.Offline(async ({ transport }) => {
			// Create a buffer source
			const player = new Tone.Player(regionBuffer).toDestination();

			// Build and connect effects chain
			const chain = this.buildEffectsChain(effects);

			if (chain.length > 0) {
				player.disconnect();
				player.chain(...chain, Tone.getDestination());
			}

			// Start playback
			player.start(0);
		}, duration);

		// Convert ToneAudioBuffer to AudioBuffer
		return rendered.get() as unknown as AudioBuffer;
	}

	/**
	 * Preview audio with effects in real-time
	 */
	private previewPlayer: Tone.Player | null = null;
	private previewChain: Tone.ToneAudioNode[] = [];

	async previewWithEffects(
		audioBuffer: AudioBuffer,
		startTime: number,
		endTime: number,
		effects: ToneEffectsState
	): Promise<void> {
		this.stopPreview();
		await this.init();

		const clampedStart = Math.max(0, Math.min(startTime, audioBuffer.duration));
		const clampedEnd = Math.max(clampedStart, Math.min(endTime, audioBuffer.duration));

		const regionBuffer = this.extractRegion(audioBuffer, clampedStart, clampedEnd);

		this.previewPlayer = new Tone.Player(regionBuffer);
		this.previewChain = this.buildEffectsChain(effects);

		if (this.previewChain.length > 0) {
			this.previewPlayer.chain(...this.previewChain, Tone.getDestination());
		} else {
			this.previewPlayer.toDestination();
		}

		this.previewPlayer.start();
	}

	stopPreview(): void {
		if (this.previewPlayer) {
			this.previewPlayer.stop();
			this.previewPlayer.dispose();
			this.previewPlayer = null;
		}
		this.previewChain.forEach((node) => node.dispose());
		this.previewChain = [];
	}

	/**
	 * Build the effects chain based on enabled effects
	 */
	private buildEffectsChain(effects: ToneEffectsState): Tone.ToneAudioNode[] {
		const chain: Tone.ToneAudioNode[] = [];

		// === PITCH & VOICE ===
		if (effects.pitchShift.enabled) {
			chain.push(
				new Tone.PitchShift({
					pitch: effects.pitchShift.pitch,
					windowSize: 0.1,
					delayTime: 0,
					feedback: 0
				})
			);
		}

		if (effects.vibrato.enabled) {
			chain.push(
				new Tone.Vibrato({
					frequency: effects.vibrato.frequency,
					depth: effects.vibrato.depth,
					type: 'sine'
				})
			);
		}

		// === FILTERS ===
		if (effects.lowpass.enabled) {
			chain.push(
				new Tone.Filter({
					frequency: effects.lowpass.frequency,
					type: 'lowpass',
					rolloff: -24,
					Q: effects.lowpass.resonance
				})
			);
		}

		if (effects.highpass.enabled) {
			chain.push(
				new Tone.Filter({
					frequency: effects.highpass.frequency,
					type: 'highpass',
					rolloff: -24,
					Q: 1
				})
			);
		}

		if (effects.bandpass.enabled) {
			chain.push(
				new Tone.Filter({
					frequency: effects.bandpass.frequency,
					type: 'bandpass',
					Q: effects.bandpass.Q
				})
			);
		}

		// === DISTORTION ===
		if (effects.bitcrusher.enabled) {
			chain.push(
				new Tone.BitCrusher({
					bits: effects.bitcrusher.bits
				})
			);
		}

		if (effects.distortion.enabled) {
			chain.push(
				new Tone.Distortion({
					distortion: effects.distortion.amount,
					wet: effects.distortion.wet
				})
			);
		}

		if (effects.chebyshev.enabled) {
			chain.push(
				new Tone.Chebyshev({
					order: effects.chebyshev.order,
					wet: 1
				})
			);
		}

		// === MODULATION ===
		if (effects.chorus.enabled) {
			chain.push(
				new Tone.Chorus({
					frequency: effects.chorus.frequency,
					delayTime: effects.chorus.delayTime,
					depth: effects.chorus.depth,
					wet: 0.5
				}).start()
			);
		}

		if (effects.tremolo.enabled) {
			chain.push(
				new Tone.Tremolo({
					frequency: effects.tremolo.frequency,
					depth: effects.tremolo.depth,
					type: 'sine'
				}).start()
			);
		}

		if (effects.phaser.enabled) {
			chain.push(
				new Tone.Phaser({
					frequency: effects.phaser.frequency,
					octaves: effects.phaser.octaves,
					baseFrequency: effects.phaser.baseFrequency
				})
			);
		}

		// === SPACE ===
		if (effects.reverb.enabled) {
			chain.push(
				new Tone.Reverb({
					decay: effects.reverb.decay,
					wet: effects.reverb.wet
				})
			);
		}

		if (effects.delay.enabled) {
			chain.push(
				new Tone.FeedbackDelay({
					delayTime: effects.delay.time,
					feedback: effects.delay.feedback,
					wet: effects.delay.wet
				})
			);
		}

		return chain;
	}

	/**
	 * Extract a region from an AudioBuffer
	 */
	private extractRegion(buffer: AudioBuffer, start: number, end: number): Tone.ToneAudioBuffer {
		const sampleRate = buffer.sampleRate;
		const startSample = Math.floor(start * sampleRate);
		const endSample = Math.floor(end * sampleRate);
		const length = endSample - startSample;

		const regionBuffer = Tone.context.createBuffer(
			buffer.numberOfChannels,
			length,
			sampleRate
		);

		for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
			const sourceData = buffer.getChannelData(channel);
			const destData = regionBuffer.getChannelData(channel);
			for (let i = 0; i < length; i++) {
				destData[i] = sourceData[startSample + i] || 0;
			}
		}

		return new Tone.ToneAudioBuffer(regionBuffer);
	}

	destroy(): void {
		this.stopPreview();
	}
}

export const toneEngine = new ToneEffectsEngine();
