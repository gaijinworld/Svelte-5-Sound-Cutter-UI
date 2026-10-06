import { loadFfmpeg } from '$lib/audio/ffmpegClient';

/**
 * Decodes an audio file to a 44.1 kHz stereo WAV blob via ffmpeg.wasm.
 * Used as a waveform-preview path for formats browsers cannot decode
 * natively (e.g. WMA/ASF) or when decodeAudioData rejects a file.
 * The original File is still what the split engine exports from.
 */
export async function decodeToWavBlob(file: File): Promise<Blob> {
	const ffmpeg = await loadFfmpeg();
	const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? 'bin';
	const inputName = `preview_in_${Date.now()}.${ext}`;
	const outputName = 'preview_out.wav';

	await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));

	try {
		await ffmpeg.exec(['-i', inputName, '-vn', '-ac', '2', '-ar', '44100', '-f', 'wav', '-y', outputName]);
		const data = (await ffmpeg.readFile(outputName)) as Uint8Array;
		return new Blob([Uint8Array.from(data)], { type: 'audio/wav' });
	} finally {
		for (const name of [inputName, outputName]) {
			try {
				await ffmpeg.deleteFile(name);
			} catch {
				// Best-effort cleanup of the virtual FS.
			}
		}
	}
}
