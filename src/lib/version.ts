export const APP_VERSION = '2026.10.07.02';
export const APP_TITLE = 'Audio Splitter App';

declare global {
	interface Window {
		AUDIOSPLITTER_RUNTIME_CONFIG?: { visibleVersion?: string };
	}
}

export const VISIBLE_VERSION =
	(typeof window !== 'undefined' && window.AUDIOSPLITTER_RUNTIME_CONFIG?.visibleVersion) ||
	APP_VERSION;
