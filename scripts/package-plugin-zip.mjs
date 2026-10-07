/**
 * Builds the SPA for a production WordPress embed and packages the
 * audio-splitter-v1 plugin (PHP + runtime-contract.json + assets/dist)
 * as a zip suitable for wp-admin -> Plugins -> Add New -> Upload Plugin.
 *
 * Usage:
 *   pnpm package:wpzip
 *   AUDS_SITE_ORIGIN="https://www.gaijinworld.com" pnpm package:wpzip
 *   AUDS_ZIP_NAME="audio-splitter.zip" AUDS_OUT_DIR="C:\path\to\out" pnpm package:wpzip
 *
 * The SPA's emitted asset URLs are absolute (SvelteKit paths.assets), so the
 * zip MUST be built with the production origin — a zip built for
 * gaijinworld-local.local will 404 its JS/CSS when installed on prod.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginSrc = join(repoRoot, 'wordpress', 'audio-splitter-v1');
const buildDir = join(repoRoot, 'build');

// WP page path the SPA is embedded on — the client router matches
// location.pathname against paths.base. Must equal AUDS_PAGE_SLUG.
const pathsBase = '/audio-splitter';
// Production origin — baked into emitted asset URLs.
const siteOrigin = (process.env.AUDS_SITE_ORIGIN ?? 'https://www.gaijinworld.com').replace(/\/$/, '');
const pathsAssets = `${siteOrigin}/wp-content/plugins/audio-splitter-v1/assets/dist`;

const outDir = process.env.AUDS_OUT_DIR ?? join(repoRoot, 'output');
const zipName = process.env.AUDS_ZIP_NAME ?? 'audio-splitter.zip';
const zipPath = join(outDir, zipName);

console.log(`1/4 Building SPA (base=${pathsBase}, assets=${pathsAssets}) ...`);
const build = spawnSync('pnpm', ['build'], {
	cwd: repoRoot,
	stdio: 'inherit',
	shell: true,
	env: { ...process.env, SVELTEKIT_PATHS_BASE: pathsBase, SVELTEKIT_PATHS_ASSETS: pathsAssets }
});
if (build.status !== 0) process.exit(build.status ?? 1);

const indexPath = join(buildDir, 'index.html');
if (!existsSync(indexPath)) {
	console.error(`Build output missing ${indexPath} — adapter-static misconfigured?`);
	process.exit(1);
}

console.log(`2/4 Staging plugin payload ...`);
const stageRoot = mkdtempSync(join(tmpdir(), 'audio-splitter-zip-'));
const pluginStage = join(stageRoot, 'audio-splitter-v1');
mkdirSync(pluginStage, { recursive: true });
for (const file of ['audio-splitter-v1.php', 'runtime-contract.json']) {
	cpSync(join(pluginSrc, file), join(pluginStage, file));
}
cpSync(buildDir, join(pluginStage, 'assets', 'dist'), { recursive: true });

// Guard: the staged payload must reference the intended origin and must not
// leak the local origin into emitted asset URLs.
const indexHtml = readFileSync(join(pluginStage, 'assets', 'dist', 'index.html'), 'utf8');
if (!indexHtml.includes(`${siteOrigin}/wp-content/plugins/audio-splitter-v1/assets/dist`)) {
	console.error(`Staged index.html does not reference ${pathsAssets} — wrong build origin?`);
	process.exit(1);
}
const leakedOrigin = indexHtml.match(/https?:\/\/(?!www\.w3\.org)[a-z0-9.-]+/g)?.find(
	(u) => !u.startsWith(siteOrigin)
);
if (leakedOrigin) {
	console.error(`Staged index.html leaks a foreign origin: ${leakedOrigin}`);
	process.exit(1);
}

console.log(`3/4 Zipping -> ${zipPath}`);
mkdirSync(outDir, { recursive: true });
rmSync(zipPath, { force: true });
const zip = spawnSync(
	'powershell',
	[
		'-NoProfile',
		'-Command',
		`Compress-Archive -Path '${join(stageRoot, 'audio-splitter-v1')}' -DestinationPath '${zipPath}' -Force`
	],
	{ stdio: 'inherit' }
);
if (zip.status !== 0) process.exit(zip.status ?? 1);
rmSync(stageRoot, { recursive: true, force: true });

console.log(`4/4 Verifying zip ...`);
const zipBytes = readFileSync(zipPath);
const sha256 = createHash('sha256').update(zipBytes).digest('hex');
const versionMatch = readFileSync(join(pluginSrc, 'audio-splitter-v1.php'), 'utf8').match(
	/AUDS_PLUGIN_VERSION', '([^']+)'/
);
const titleMatch = indexHtml.match(/<title>([^<]*)<\/title>/);
console.log(`   plugin version : ${versionMatch?.[1] ?? 'NOT FOUND'}`);
console.log(`   index <title>  : ${titleMatch?.[1] ?? 'NOT FOUND'}`);
console.log(`   zip            : ${zipPath} (${(zipBytes.length / 1024).toFixed(0)} KB)`);
console.log(`   sha256         : ${sha256}`);
console.log('Done. Upload via wp-admin -> Plugins -> Add New -> Upload Plugin.');
