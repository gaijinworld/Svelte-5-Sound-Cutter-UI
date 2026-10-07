/**
 * Builds the SPA for the LocalWP WordPress embed and copies the
 * audio-splitter-v1 plugin into the Local site's plugins directory.
 *
 * Usage:
 *   pnpm deploy:localwp
 *   LOCALWP_PUBLIC_DIR="C:\path\to\app\public" pnpm deploy:localwp
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginSrc = join(repoRoot, 'wordpress', 'audio-splitter-v1');
const buildDir = join(repoRoot, 'build');

const publicDir =
	process.env.LOCALWP_PUBLIC_DIR ??
	join(process.env.USERPROFILE ?? '', 'Local Sites', 'gaijinworld-local', 'app', 'public');
const pluginDest = join(publicDir, 'wp-content', 'plugins', 'audio-splitter-v1');
const distDest = join(pluginDest, 'assets', 'dist');

// WP page path the SPA is embedded on — the client router matches
// location.pathname against paths.base. Must equal AUDS_PAGE_SLUG.
const pathsBase = '/audio-splitter';
// Absolute URL the built assets are served from — must match
// plugin_dest/assets/dist. SvelteKit requires paths.assets to be absolute.
const siteOrigin = process.env.AUDS_SITE_ORIGIN ?? 'https://gaijinworld-local.local';
const pathsAssets = `${siteOrigin}/wp-content/plugins/audio-splitter-v1/assets/dist`;
// Self-hosted FFmpeg.wasm core — bundled under assets/dist/ffmpeg/ so the
// deployed app never hits a third-party CDN.
const ffmpegCoreBaseUrl = `${pathsAssets}/ffmpeg`;

if (!existsSync(publicDir)) {
	console.error(`LocalWP public dir not found: ${publicDir}`);
	console.error('Set LOCALWP_PUBLIC_DIR to the site public root.');
	process.exit(1);
}

console.log(`1/3 Building SPA (base=${pathsBase}, assets=${pathsAssets}) ...`);
const build = spawnSync('pnpm', ['build'], {
	cwd: repoRoot,
	stdio: 'inherit',
	shell: true,
	env: {
		...process.env,
		SVELTEKIT_PATHS_BASE: pathsBase,
		SVELTEKIT_PATHS_ASSETS: pathsAssets,
		VITE_FFMPEG_CORE_BASE_URL: ffmpegCoreBaseUrl
	}
});
if (build.status !== 0) process.exit(build.status ?? 1);

if (!existsSync(join(buildDir, 'index.html'))) {
	console.error(`Build output missing ${join(buildDir, 'index.html')} — adapter-static misconfigured?`);
	process.exit(1);
}

// Stage the self-hosted FFmpeg.wasm core into build/ffmpeg/ so it ships inside
// assets/dist/ffmpeg/ in the deployed plugin.
const require = createRequire(import.meta.url);
const coreEsmDir = join(dirname(require.resolve('@ffmpeg/core')), '..', 'esm');
for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
	const src = join(coreEsmDir, file);
	if (!existsSync(src)) {
		console.error(`FFmpeg core asset missing: ${src} — is @ffmpeg/core installed?`);
		process.exit(1);
	}
	mkdirSync(join(buildDir, 'ffmpeg'), { recursive: true });
	cpSync(src, join(buildDir, 'ffmpeg', file));
}

console.log(`2/3 Copying plugin template -> ${pluginDest}`);
mkdirSync(pluginDest, { recursive: true });
for (const file of ['audio-splitter-v1.php', 'runtime-contract.json']) {
	cpSync(join(pluginSrc, file), join(pluginDest, file));
}

console.log(`3/3 Syncing assets -> ${distDest}`);
rmSync(distDest, { recursive: true, force: true });
mkdirSync(distDest, { recursive: true });
cpSync(buildDir, distDest, { recursive: true });

console.log('Done. Activate "Audio Splitter App (Production V1)" in wp-admin (or via a bootstrap script) — the /audio-splitter/ page is created on activation.');
