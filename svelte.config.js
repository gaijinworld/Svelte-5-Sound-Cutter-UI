import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// SPA fallback: a single index.html shell that the WordPress plugin
		// embeds via shortcode. See wordpress/audio-splitter-v1/.
		adapter: adapter({ fallback: 'index.html' }),
		paths: {
			// Deploy builds set SVELTEKIT_PATHS_BASE to the WP page path (the
			// client router matches location.pathname against it) and
			// SVELTEKIT_PATHS_ASSETS to the plugin dist URL (emitted asset URLs).
			base: process.env.SVELTEKIT_PATHS_BASE ?? '',
			assets: process.env.SVELTEKIT_PATHS_ASSETS ?? ''
		}
	}
};

export default config;
