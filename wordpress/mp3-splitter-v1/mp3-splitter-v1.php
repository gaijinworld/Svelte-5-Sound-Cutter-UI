<?php
/**
 * Plugin Name: MP3 Splitter App (Production V1)
 * Plugin URI: https://github.com/gaijinworld/Svelte-5-Sound-Cutter-UI
 * Description: Browser-local MP3 splitter; ordered split points, lossless/precise FFmpeg.wasm export, batch ZIP download.
 * Version: 2026.10.06.01
 * Author: GaijinWorld
 * Author URI: https://github.com/gaijinworld
 * License: MIT
 */

if (!defined('ABSPATH')) {
    exit;
}

define('MP3S_PLUGIN_VERSION', '2026.10.06.01');
define('MP3S_PLUGIN_FILE', __FILE__);
define('MP3S_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('MP3S_PLUGIN_URL', plugin_dir_url(__FILE__));
define('MP3S_PAGE_SLUG', 'mp3-splitter');
define('MP3S_PAGE_TITLE', 'MP3 Splitter');
define('MP3S_SHORTCODE', 'mp3_splitter');

final class MP3S_Plugin {
    private static ?MP3S_Plugin $instance = null;

    public static function instance(): MP3S_Plugin {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_shortcode(MP3S_SHORTCODE, [$this, 'render_shortcode']);
    }

    /**
     * Self-install the /mp3-splitter/ page on activation.
     */
    public static function activate(): void {
        $page = get_page_by_path(MP3S_PAGE_SLUG);
        if ($page instanceof WP_Post) {
            if (strpos($page->post_content, '[' . MP3S_SHORTCODE . ']') === false) {
                wp_update_post([
                    'ID' => $page->ID,
                    'post_content' => trim($page->post_content . "\n\n[" . MP3S_SHORTCODE . ']'),
                ]);
            }
            return;
        }

        wp_insert_post([
            'post_title' => MP3S_PAGE_TITLE,
            'post_name' => MP3S_PAGE_SLUG,
            'post_status' => 'publish',
            'post_type' => 'page',
            'post_content' => '[' . MP3S_SHORTCODE . ']',
            'comment_status' => 'closed',
            'ping_status' => 'closed',
        ]);
    }

    public function render_shortcode(): string {
        $markup = $this->get_app_markup();
        if ($markup === null) {
            return '<div class="mp3s-build-error" role="alert">MP3 Splitter is temporarily unavailable because its application assets are missing. Deploy the production frontend build or contact the site administrator.</div>';
        }
        return $this->get_runtime_config_tag() . "\n" . $markup;
    }

    private function get_runtime_config(): array {
        $request_scheme = is_ssl() ? 'https' : 'http';
        return [
            'visibleVersion' => MP3S_PLUGIN_VERSION,
            'appName' => MP3S_PAGE_TITLE,
            'routeBase' => esc_url_raw(set_url_scheme(home_url('/' . MP3S_PAGE_SLUG . '/'), $request_scheme)),
            'siteOrigin' => esc_url_raw(set_url_scheme(home_url('/'), $request_scheme)),
            'runtimeContractUrl' => esc_url_raw(MP3S_PLUGIN_URL . 'runtime-contract.json'),
        ];
    }

    private function get_runtime_config_tag(): string {
        return '<script>window.MP3SPLITTER_RUNTIME_CONFIG = ' . wp_json_encode($this->get_runtime_config()) . ';</script>';
    }

    /**
     * Returns the head asset tags + body markup of the built SPA shell.
     * The build is produced with SVELTEKIT_PATHS_BASE pointing at this
     * plugin's assets/dist URL, so all emitted URLs are already absolute.
     */
    private function get_app_markup(): ?string {
        $index_path = MP3S_PLUGIN_DIR . 'assets/dist/index.html';
        if (!is_readable($index_path)) {
            return null;
        }

        $html = (string) file_get_contents($index_path);

        if (preg_match('/<head[^>]*>(.*)<\/head>\s*<body[^>]*>(.*)<\/body>/is', $html, $m)) {
            return $m[1] . "\n" . $m[2];
        }
        return $html;
    }
}

register_activation_hook(MP3S_PLUGIN_FILE, ['MP3S_Plugin', 'activate']);

MP3S_Plugin::instance();
