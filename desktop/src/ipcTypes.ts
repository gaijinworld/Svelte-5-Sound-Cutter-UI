// The IPC contract is defined once in the renderer-facing
// src/lib/media/desktopContract.ts and re-exported here so desktop code and
// the renderer can never drift apart.

export type {
	ChooseOutputDirResult,
	DesktopProgressEvent as ProgressEvent,
	DesktopSplitRequest as SplitRequest,
	DesktopSplitResponse as SplitResponse,
	OpenAudioResult,
	RegisterSourceResult,
	SaveOutputsRequest,
	SaveOutputsResult
} from '../../src/lib/media/desktopContract';
