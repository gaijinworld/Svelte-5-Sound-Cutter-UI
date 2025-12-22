import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, 'THIRD_PARTY_LICENSES.md');

const rawTree = execFileSync('pnpm', ['ls', '--json', '--depth', '1'], {
	cwd: repoRoot,
	encoding: 'utf8'
});

const [root] = JSON.parse(rawTree);
const packages = new Map();

function addPackage(name, dep, scope) {
	const packageName = dep?.name ?? dep?.from ?? name;
	if (!packageName || !dep?.path) return;

	const key = `${packageName}@${dep.version}`;
	if (!packages.has(key)) {
		const packageJsonPath = path.join(dep.path, 'package.json');
		if (!existsSync(packageJsonPath)) {
			return;
		}

		const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
		const license = pkg.license ?? JSON.stringify(pkg.licenses ?? 'UNKNOWN');

		packages.set(key, {
			name: packageName,
			version: dep.version ?? 'UNKNOWN',
			license,
			scope
		});
	}

	for (const [childName, child] of Object.entries(dep.dependencies ?? {})) {
		addPackage(childName, child, scope);
	}
}

for (const [name, dep] of Object.entries(root.dependencies ?? {})) {
	addPackage(name, dep, 'runtime');
}

for (const [name, dep] of Object.entries(root.devDependencies ?? {})) {
	addPackage(name, dep, 'development');
}

const rows = [...packages.values()]
	.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
	.map(
		(pkg) => `| ${pkg.name} | ${pkg.version} | ${pkg.license} | ${pkg.scope} |`
	)
	.join('\n');

const ffmpegCoreNotice = [
	'## Runtime-loaded package',
	'',
	'The app loads `@ffmpeg/core@0.12.6` from `https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm` at runtime.',
	'That package is distributed under the MIT license and should be treated as a runtime dependency when deploying the app.',
	''
].join('\n');

const body = [
	'# Third-Party Licenses',
	'',
	'Generated from the installed dependency graph with `pnpm run licenses:generate`.',
	'',
	'| Package | Version | License | Scope |',
	'| --- | --- | --- | --- |',
	rows,
	'',
	ffmpegCoreNotice
].join('\n');

writeFileSync(outputPath, body);

if (!existsSync(outputPath)) {
	throw new Error('Failed to write THIRD_PARTY_LICENSES.md');
}
