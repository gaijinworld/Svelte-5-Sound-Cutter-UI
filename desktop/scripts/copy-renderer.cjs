const fs = require('node:fs');
const path = require('node:path');

// The SvelteKit build emits to repo-root build/ (adapter-static SPA fallback
// emits index.html). For the desktop shell the default root-relative paths
// are exactly right — the loopback server serves the directory at "/".
const primarySourceDir = path.resolve(__dirname, '../../build');
const targetDir = path.resolve(__dirname, '../dist/renderer');

if (!fs.existsSync(primarySourceDir) || !fs.existsSync(path.join(primarySourceDir, 'index.html'))) {
	console.error('❌ Web build output not found (need build/index.html).');
	console.error(`Checked:\n  - ${primarySourceDir}`);
	console.error("👉 Run 'pnpm build' in the repo root before building desktop.");
	process.exit(1);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(primarySourceDir, targetDir, { recursive: true });

console.log(`✅ Copied web bundle from ${primarySourceDir} → ${targetDir}`);
