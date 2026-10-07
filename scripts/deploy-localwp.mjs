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
	env: { ...process.env, SVELTEKIT_PATHS_BASE: pathsBase, SVELTEKIT_PATHS_ASSETS: pathsAssets }
});
if (build.status !== 0) process.exit(build.status ?? 1);

if (!existsSync(join(buildDir, 'index.html'))) {
	console.error(`Build output missing ${join(buildDir, 'index.html')} — adapter-static misconfigured?`);
	process.exit(1);
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
