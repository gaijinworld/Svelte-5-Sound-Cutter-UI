import type { AudioState } from '$lib/types';

function createAudioStore() {
	let file = $state<File | null>(null);
	let buffer = $state<AudioBuffer | null>(null);
	let duration = $state(0);
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let loopPlayback = $state(true);
	let objectUrl = $state<string | null>(null);

	return {
		get file() {
			return file;
		},
		get buffer() {
			return buffer;
		},
		get duration() {
			return duration;
		},
		get isPlaying() {
			return isPlaying;
		},
		get currentTime() {
			return currentTime;
		},
		get loopPlayback() {
			return loopPlayback;
		},
		get objectUrl() {
			return objectUrl;
		},

		setFile(newFile: File | null) {
			// Revoke previous URL if exists
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
			file = newFile;
			objectUrl = newFile ? URL.createObjectURL(newFile) : null;
		},

		setBuffer(newBuffer: AudioBuffer | null) {
			buffer = newBuffer;
			duration = newBuffer?.duration ?? 0;
		},

		setPlaying(playing: boolean) {
			isPlaying = playing;
		},

		setCurrentTime(time: number) {
			currentTime = time;
		},

		setLoopPlayback(loopEnabled: boolean) {
			loopPlayback = loopEnabled;
		},

		toggleLoopPlayback() {
			loopPlayback = !loopPlayback;
		},

		reset() {
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
			file = null;
			buffer = null;
			duration = 0;
			isPlaying = false;
			currentTime = 0;
			loopPlayback = true;
			objectUrl = null;
		}
	};
}

export const audioStore = createAudioStore();
