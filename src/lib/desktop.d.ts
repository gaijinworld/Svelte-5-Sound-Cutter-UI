import type { Mp3sDesktopApi, Mp3sDesktopEnv } from '$lib/media/desktopContract';

declare global {
	interface Window {
		MP3S_DESKTOP?: Mp3sDesktopApi;
		MP3S_DESKTOP_ENV?: Mp3sDesktopEnv;
	}
}

export {};
