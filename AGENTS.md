# Agent Notes — Audio Splitter

SvelteKit SPA embedded in WordPress via the `audio-splitter-v1` plugin; also ships as an Electron desktop app.

## Version surfaces (keep in sync on every bump)

`YYYY.MM.DD.NN` format. All of:

- `src/lib/version.ts` → `APP_VERSION`
- `src/app.html` → `<title>Audio Splitter App vX Live</title>`
- `wordpress/audio-splitter-v1/audio-splitter-v1.php` → `Version:` header + `AUDS_PLUGIN_VERSION`
- `wordpress/audio-splitter-v1/runtime-contract.json` → `visibleVersion` + `buildDate`
- `desktop/package.json` → `pnpm -F audio-splitter-desktop sync-version`

Bump work goes on `chore/version-bump-<version>` branches → PR → squash merge.

## Verify

```sh
pnpm check   # svelte-check, 0 errors expected
pnpm test    # vitest, 22 tests
```

## Deploys

| Target | Command | Result |
|---|---|---|
| LocalWP (gaijinworld-local) | `pnpm deploy:localwp` | builds WP variant + copies plugin into `%USERPROFILE%\Local Sites\gaijinworld-local\app\public\wp-content\plugins\audio-splitter-v1` |
| Production zip | `pnpm package:wpzip` | `output/audio-splitter.zip` for wp-admin upload; `AUDS_SITE_ORIGIN` defaults to `https://www.gaijinworld.com` |
| Desktop installers | `pnpm desktop:package` | `desktop/dist-release/` (gitignored) |
| GitHub release | `git tag v<ver> && git push origin v<ver>` | `release-desktop.yml` attaches exes + `latest.yml` |

Gotchas:

- `SVELTEKIT_PATHS_BASE`/`SVELTEKIT_PATHS_ASSETS` are baked at build time — **build once per origin**. Never ship a zip built for `gaijinworld-local.local` to prod.
- WP deploys self-host the FFmpeg.wasm core from `@ffmpeg/core` devDep → `assets/dist/ffmpeg/` + `VITE_FFMPEG_CORE_BASE_URL`. Plain `pnpm dev`/`build` falls back to unpkg.
- `output/` and `build/` are gitignored — never commit zips or build output.
- electron-builder sanitizes `YYYY.MM.DD.NN` → artifact filenames look like `2026.10.0-7.2` (semver-ish). Normal.

## WordPress runtime

- Page `audio-splitter` + shortcode `[audio_splitter]` are **self-installed on plugin activation** — don't hand-create the page.
- Plugin injects `window.AUDIOSPLITTER_RUNTIME_CONFIG` (visibleVersion, routeBase, siteOrigin, runtimeContractUrl); `src/lib/version.ts` reads it with `APP_VERSION` fallback.
- PHP constant prefix is `AUDS_*` (plugin surface). The desktop `MP3S_*`/`mp3s:`/`mp3s-*` identifiers are the Electron IPC namespace — unrelated, don't "fix" them.
- A real docroot directory on the web server shadows the WP page slug — never deploy the SPA to docroot alongside the WP plugin route.
- Prod SEO plugin (Rank Math) overrides `document_title_parts` → server `<title>` shows `Audio Splitter » Gaijin World`; hydration sets the versioned title.

## WP-CLI on this machine (Windows + LocalWP)

Not on PATH; bundled PHP needs mysqli loaded manually:

```bash
PHP="/c/Program Files (x86)/Local/resources/extraResources/lightning-services/php-8.2.29+0/bin/win64/php.exe"
WPCLI="/c/Program Files (x86)/Local/resources/extraResources/bin/wp-cli/wp-cli.phar"
"$PHP" -c /tmp/wpcli-php.ini "$WPCLI" --path="C:/Users/jgoka/Local Sites/gaijinworld-local/app/public" <cmd>
```

`/tmp/wpcli-php.ini` = `extension_dir` (forward slashes!) + `extension=php_mysqli.dll`. See `~/.codex/skills/save-local-repo-progress-sync-to-github/SKILL.md` §8 for the full recipe.
