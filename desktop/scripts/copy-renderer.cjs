const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// The desktop renderer must be the root-relative web build — the WP deploy
// variant (SVELTEKIT_PATHS_BASE=/audio-splitter + plugin asset URLs) would 404
// inside the app. So this script rebuilds the web app itself with those env
// vars cleared, then copies ../build → dist/renderer. MP3S_SKIP_WEB_BUILD=1
// skips the rebuild when build/ is already the desktop variant.

const repoRoot = path.resolve(__dirname, '../..');
const sourceDir = path.join(repoRoot, 'build');
const targetDir = path.resolve(__dirname, '../dist/renderer');

if (!process.env.MP3S_SKIP_WEB_BUILD) {
	console.log('→ Building web renderer (root-relative paths)…');
	const env = { ...process.env };
	delete env.SVELTEKIT_PATHS_BASE;
	delete env.SVELTEKIT_PATHS_ASSETS;
	execFileSync('pnpm', ['build'], { cwd: repoRoot, stdio: 'inherit', env, shell: true });
}

if (!fs.existsSync(sourceDir) || !fs.existsSync(path.join(sourceDir, 'index.html'))) {
	console.error('❌ Web build output not found (need build/index.html).');
	console.error(`Checked:\n  - ${sourceDir}`);
	console.error("👉 Run 'pnpm build' in the repo root before building desktop.");
	process.exit(1);
}

// Guard against copying a WP-pathed build by accident.
const index = fs.readFileSync(path.join(sourceDir, 'index.html'), 'utf8');
if (index.includes('wp-content/plugins/audio-splitter-v1') || index.includes('/audio-splitter/')) {
	console.error('❌ build/ contains the WordPress variant (wp-content asset URLs).');
	console.error('   Rebuild for desktop: pnpm build  (with SVELTEKIT_PATHS_* unset)');
	process.exit(1);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`✅ Copied web bundle from ${sourceDir} → ${targetDir}`);
