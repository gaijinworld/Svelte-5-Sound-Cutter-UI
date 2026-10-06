import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// SPA fallback: a single index.html shell that the WordPress plugin
		// embeds via shortcode. See wordpress/mp3-splitter-v1/.
		adapter: adapter({ fallback: 'index.html' }),
		paths: {
			// Deploy builds set SVELTEKIT_PATHS_BASE to the plugin asset URL so
			// module scripts/imports resolve under wp-content/plugins/...
			base: process.env.SVELTEKIT_PATHS_BASE ?? ''
		}
	}
};

export default config;
