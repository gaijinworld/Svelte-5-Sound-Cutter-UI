// Drives the real Electron binary through the same IPC handlers the UI uses.
// The bundled ffmpeg generates its own WAV fixture (dogfooding), then splits
// it losslessly and reads the result back over the loopback API.
//
//   node scripts/smoke.cjs             — dev binary (repo checkout)
//   node scripts/smoke.cjs --packaged  — dist-release/win-unpacked build
const { _electron } = require('playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

(async () => {
	const root = path.resolve(__dirname, '..');
	const packaged = process.argv.includes('--packaged');
	const inputFile = path.join(os.tmpdir(), `mp3s-smoke-input-${process.pid}.wav`);
	const outDir = path.join(os.tmpdir(), `mp3s-smoke-out-${process.pid}`);

	// Dogfood: the bundled ffmpeg makes our WAV fixture (2 s sine tone).
	const ffmpeg = require('ffmpeg-static');
	const ffmpegBin = packaged ? ffmpeg.replace('app.asar', 'app.asar.unpacked') : ffmpeg;
	const gen = spawnSync(
		ffmpegBin,
		['-hide_banner', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', inputFile],
		{ stdio: 'pipe' }
	);
	assert.equal(gen.status, 0, `fixture generation failed: ${gen.stderr}`);

	const childEnv = {
		...process.env,
		MP3S_SMOKE_INPUT_FILE: inputFile,
		MP3S_SMOKE_OUTPUT_DIR: outDir
	};
	// A leaked ELECTRON_RUN_AS_NODE turns the binary into plain Node.
	delete childEnv.ELECTRON_RUN_AS_NODE;

	const desktop = await _electron.launch({
		executablePath: packaged
			? path.join(root, 'dist-release', 'win-unpacked', 'Audio Splitter.exe')
			: require('electron'),
		args: packaged ? ['--mp3s-smoke-test'] : [root, '--mp3s-smoke-test'],
		cwd: root,
		env: childEnv
	});

	let smokeProfile;
	try {
		smokeProfile = await desktop.evaluate(({ app }) => app.getPath('userData'));
		assert.ok(
			path.resolve(smokeProfile).startsWith(path.resolve(os.tmpdir()) + path.sep + 'mp3s-smoke-'),
			'smoke test must use an isolated userData dir'
		);

		const page = await desktop.firstWindow();
		await page.waitForFunction(() => !!window.MP3S_DESKTOP_ENV?.isDesktop);

		// Bridge surface + env.
		const env = await page.evaluate(() => ({
			isDesktop: window.MP3S_DESKTOP_ENV.isDesktop,
			platform: window.MP3S_DESKTOP_ENV.platform,
			version: window.MP3S_DESKTOP_ENV.version,
			hasBridge: typeof window.MP3S_DESKTOP.openAudio === 'function'
		}));
		assert.equal(env.isDesktop, true);
		assert.equal(env.platform, process.platform);
		assert.ok(env.hasBridge, 'MP3S_DESKTOP bridge missing');
		assert.notEqual(env.version, '0.0.0-dev', 'version arg not propagated');

		// Renderer is served over loopback HTTP.
		assert.match(page.url(), /^http:\/\/(127\.0\.0\.1|localhost):\d+\//);

		// Sandbox assertions: no Node leakage into the page.
		const sandbox = await page.evaluate(() => ({
			hasRequire: typeof window.require === 'function',
			hasProcess: typeof window.process === 'object',
			hasNodeBuffer: typeof window.Buffer === 'function'
		}));
		assert.deepEqual(sandbox, { hasRequire: false, hasProcess: false, hasNodeBuffer: false });

		// Local API guards: health OK same-origin, foreign Origin rejected.
		const health = await page.evaluate(async () => {
			const r = await fetch(`${window.MP3S_DESKTOP_ENV.apiBase}/health`);
			return r.json();
		});
		assert.equal(health.ok, true);
		const apiBase = `${new URL(page.url()).origin}/api/mp3s`;
		const crossSite = await desktop.evaluate(async (_e, base) => {
			return fetch(`${base}/health`, { headers: { Origin: 'https://untrusted.example' } }).then(
				(r) => r.status
			);
		}, apiBase);
		assert.equal(crossSite, 403);

		// End-to-end: open (smoke seam) → register → split [0,1s) lossless →
		// bytes back over /api/mp3s/output → save-outputs copies to temp dir.
		const result = await page.evaluate(async () => {
			const api = window.MP3S_DESKTOP;
			const base = window.MP3S_DESKTOP_ENV.apiBase;
			const opened = await api.openAudio();
			if (opened.cancelled || !opened.path) return { error: 'openAudio rejected' };
			const reg = await api.registerSource(opened.path);
			if (!reg.ok) return { error: `registerSource: ${reg.reason}` };
			const jobId = 'smoke-job';
			const split = await api.split({
				jobId,
				inputPath: opened.path,
				outputName: 'smoke_part_001.wav',
				start: 0,
				duration: 1,
				mode: 'lossless',
				format: 'wav'
			});
			if (!split.ok) return { error: 'split failed' };
			const blob = await fetch(
				`${base}/output/${encodeURIComponent(jobId)}/${encodeURIComponent(split.name)}`
			).then((r) => r.blob());
			const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
			const saved = await api.saveOutputs({ jobId });
			return { riff: String.fromCharCode(...head), size: blob.size, saved };
		});
		assert.equal(result.riff, 'RIFF', `expected RIFF output, got: ${JSON.stringify(result)}`);
		assert.ok(result.size > 1000, 'output too small');
		assert.equal(result.saved.cancelled, false);
		assert.ok(
			result.saved.dir && result.saved.files.includes('smoke_part_001.wav'),
			'saveOutputs did not copy the part'
		);
		assert.ok(
			fs.existsSync(path.join(outDir, 'smoke_part_001.wav')),
			'saved file missing on disk'
		);

		console.log(
			JSON.stringify({
				packaged,
				rendered: true,
				loopback: true,
				sandboxed: true,
				foreignOriginRejected: true,
				nativeSplit: true,
				saveOutputs: true
			})
		);
	} finally {
		await desktop.close();
		for (const p of [inputFile, outDir]) {
			try {
				fs.rmSync(p, { recursive: true, force: true });
			} catch {
				/* best effort */
			}
		}
		if (
			smokeProfile &&
			path.resolve(smokeProfile).startsWith(path.resolve(os.tmpdir()) + path.sep + 'mp3s-smoke-')
		) {
			fs.rmSync(path.resolve(smokeProfile), { recursive: true, force: true });
		}
	}
})().catch((error) => {
	console.error(error.stack || error.message);
	process.exitCode = 1;
});
