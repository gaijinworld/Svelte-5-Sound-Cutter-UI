// Runs electron-builder with directories.output pointed at a temp dir —
// Windows AV/IDE watchers can hold handles inside the freshly-extracted
// win-unpacked dir, which makes the final .tmp → win-unpacked rename fail
// with EPERM when output lives inside the watched workspace. Final artifacts
// (.exe/.blockmap/latest.yml) are then copied into dist-release/.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'mp3s-dist-'));

const cfg = {
	...pkg.build,
	directories: { ...pkg.build.directories, output: tmpOut }
};
const cfgFile = path.join(tmpOut, 'builder-config.json');
fs.writeFileSync(cfgFile, JSON.stringify(cfg));

const args = ['electron-builder', '--win', '--publish', 'never', '--config', cfgFile];
console.log(`→ packaging into ${tmpOut}`);
execFileSync('pnpm', ['exec', ...args], { cwd: root, stdio: 'inherit', shell: true });

const dest = path.join(root, 'dist-release');
fs.mkdirSync(dest, { recursive: true });
const artifacts = fs
	.readdirSync(tmpOut)
	.filter((f) => /\.(exe|blockmap|yml)$/i.test(f) || f === 'latest.yml');
for (const f of artifacts) {
	fs.copyFileSync(path.join(tmpOut, f), path.join(dest, f));
	console.log(`✅ ${f}`);
}
// win-unpacked is needed for the packaged smoke test — move it as a whole;
// it contains ~2k files so we copy the tree only if the rename still fails.
const unpacked = path.join(tmpOut, 'win-unpacked');
if (fs.existsSync(unpacked)) {
	const target = path.join(dest, 'win-unpacked');
	fs.rmSync(target, { recursive: true, force: true });
	try {
		fs.renameSync(unpacked, target);
	} catch {
		fs.cpSync(unpacked, target, { recursive: true });
	}
	console.log('✅ win-unpacked/');
}
fs.rmSync(tmpOut, { recursive: true, force: true });
console.log(`Done → ${dest}`);
