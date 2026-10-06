// Keeps desktop/package.json version in lock-step with src/lib/version.ts —
// the WP build's single source of truth for the visible version.
const fs = require('node:fs');
const path = require('node:path');

const versionFile = path.resolve(__dirname, '../../src/lib/version.ts');
const pkgFile = path.resolve(__dirname, '../package.json');

const src = fs.readFileSync(versionFile, 'utf8');
const match = src.match(/APP_VERSION\s*=\s*'([^']+)'/);
if (!match) {
	console.error('❌ Could not find APP_VERSION in src/lib/version.ts');
	process.exit(1);
}
const version = match[1];

const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
if (pkg.version === version) {
	console.log(`✅ desktop version already ${version}`);
	process.exit(0);
}
pkg.version = version;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, '\t') + '\n');
console.log(`✅ desktop version synced → ${version}`);
