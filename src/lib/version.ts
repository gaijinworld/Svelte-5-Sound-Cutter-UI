export const APP_VERSION = '2026.10.06.01';
export const APP_TITLE = 'MP3 Splitter App';

declare global {
	interface Window {
		MP3SPLITTER_RUNTIME_CONFIG?: { visibleVersion?: string };
	}
}

export const VISIBLE_VERSION =
	(typeof window !== 'undefined' && window.MP3SPLITTER_RUNTIME_CONFIG?.visibleVersion) ||
	APP_VERSION;
