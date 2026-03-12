<?php
/**
 * Plugin Name: Research Review Portal
 * Description: Research submission and review workflow for conferences, publications, student projects, and grants. Port of the CityU Research Review Portal for WordPress.
 * Version: 1.0.0
 * Author: CityU C4CYI
 * License: MIT
 * Text Domain: research-review-portal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'RRP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'RRP_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'RRP_DATA_DIR', RRP_PLUGIN_DIR . 'data/' );
define( 'RRP_UPLOADS_DIR', RRP_DATA_DIR . 'uploads/' );

require_once RRP_PLUGIN_DIR . 'includes/class-portal-data.php';
require_once RRP_PLUGIN_DIR . 'includes/class-portal-rest.php';
require_once RRP_PLUGIN_DIR . 'includes/class-user-management.php';
require_once RRP_PLUGIN_DIR . 'includes/class-process-documentation.php';

class Research_Review_Portal {

	public static function init() {
		add_shortcode( 'research_review_portal', array( __CLASS__, 'shortcode_portal' ) );
		add_action( 'wp_body_open', array( __CLASS__, 'render_site_banner' ) );
		add_action( 'wp_head', array( __CLASS__, 'render_site_banner_fallback' ), 0 );
	}

	public static function render_site_banner() {
		if ( ! function_exists( 'is_user_logged_in' ) ) {
			return;
		}

		$logged_in = is_user_logged_in();
		$login_url = wp_login_url( home_url() );
		$logout_url = wp_logout_url( home_url() );
		$current_user = wp_get_current_user();
		$user_name = $current_user->exists() ? ( $current_user->display_name ?: $current_user->user_login ) : '';
		$user_roles = $current_user->exists() ? $current_user->roles : array();
		$role_label = '';
		if ( in_array( 'rrp_student', $user_roles, true ) ) {
			$role_label = 'Student';
		} elseif ( in_array( 'rrp_reviewer', $user_roles, true ) ) {
			$role_label = 'Reviewer';
		} elseif ( in_array( 'rrp_coordinator', $user_roles, true ) ) {
			$role_label = 'Coordinator';
		} elseif ( in_array( 'rrp_admin', $user_roles, true ) || in_array( 'administrator', $user_roles, true ) ) {
			$role_label = 'Admin';
		}

		echo '<div class="rrp-site-banner ' . ( $logged_in ? 'rrp-site-banner-loggedin' : 'rrp-site-banner-guest' ) . '">' .
			'<div class="rrp-site-banner_content">';

		if ( $logged_in ) {
			echo '<span>Logged in as <strong>' . esc_html( $user_name ) . '</strong> (' . esc_html( $role_label ?: 'User' ) . ')</span>';
		} else {
			echo '<span>Guest user: please log in to submit documents and access your dashboard.</span>';
		}

		echo '</div><div class="rrp-site-banner_actions">';
		if ( $logged_in ) {
			echo '<a class="rrp-btn secondary" href="' . esc_url( add_query_arg( 'portal', '1', home_url( '/' ) ) ) . '">My Portal</a>';
			echo '<a class="rrp-btn" href="' . esc_url( $logout_url ) . '">Logout</a>';
		} else {
			echo '<a class="rrp-btn" href="' . esc_url( $login_url ) . '">Login</a>';
		}
		echo '</div></div>';
	}

	public static function render_site_banner_fallback() {
		// If theme doesn't support wp_body_open, render in head and use JS to move into body start.
		?>
		<style>
		.rrp-site-banner { box-sizing: border-box; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 1rem; z-index: 99999; font-size: 0.95rem; }
		.rrp-site-banner-guest { background: #f0f7ff; border-bottom: 1px solid #cfe2ff; color: #084298; }
		.rrp-site-banner-loggedin { background: #e7f5ec; border-bottom: 1px solid #a8d8ab; color: #1d4620; }
		.rrp-site-banner .rrp-site-banner_actions a { margin-left: 0.5rem; }
		</style>
		<script>
		(function() {
			var banner = document.querySelector('.rrp-site-banner');
			if (!banner) return;
			var body = document.body;
			if (body.firstChild && body.firstChild.nodeName !== 'STYLE') {
				body.insertBefore(banner, body.firstChild);
			}
		})();
		</script>
		<?php
	}


	public static function shortcode_portal( $atts ) {
		do_action( 'rrp_portal_enqueue' );
		wp_enqueue_style(
			'research-review-portal',
			RRP_PLUGIN_URL . 'assets/portal.css',
			array(),
			'1.0.0'
		);
		wp_enqueue_script(
			'research-review-portal',
			RRP_PLUGIN_URL . 'assets/portal.js',
			array(),
			'1.0.0',
			true
		);

		$logged_in = is_user_logged_in();
		$login_url = wp_login_url( get_permalink() );
		$logout_url = wp_logout_url( get_permalink() );
		$current_user = wp_get_current_user();
		$user_name = $current_user->exists() ? ( $current_user->display_name ?: $current_user->user_login ) : '';
		$user_roles = $current_user->exists() ? $current_user->roles : array();
		$role_label = '';
		if ( in_array( 'rrp_student', $user_roles, true ) ) {
			$role_label = 'Student';
		} elseif ( in_array( 'rrp_reviewer', $user_roles, true ) ) {
			$role_label = 'Reviewer';
		} elseif ( in_array( 'rrp_coordinator', $user_roles, true ) ) {
			$role_label = 'Coordinator';
		} elseif ( in_array( 'rrp_admin', $user_roles, true ) || in_array( 'administrator', $user_roles, true ) ) {
			$role_label = 'Admin';
		}

		wp_add_inline_script( 'research-review-portal', sprintf(
			'window.RRP = { restBase: %s, nonce: %s, isLoggedIn: %s, loginUrl: %s, logoutUrl: %s, userName: %s, userRole: %s, userEmail: %s };',
			wp_json_encode( rest_url( 'research-portal/v1' ) ),
			wp_json_encode( wp_create_nonce( 'wp_rest' ) ),
			wp_json_encode( $logged_in ),
			wp_json_encode( $login_url ),
			wp_json_encode( $logout_url ),
			wp_json_encode( $user_name ),
			wp_json_encode( $role_label ),
			wp_json_encode( $current_user->exists() ? $current_user->user_email : '' )
		), 'before' );

		ob_start();

		$show_portal = isset( $_GET['portal'] ) && '1' === $_GET['portal'];

		if ( ! $show_portal || ! $logged_in ) {
			?>
			<div id="research-review-portal" class="rrp-portal">
				<div class="rrp-notice">
					<h1>Welcome to CityU Research Review Portal</h1>
					<p>The portal provides an end-to-end workflow for research submission and peer review.</p>
					<ul>
						<li>Conference / Symposium: Applied Research Symposium, Doctor of IT Forum</li>
						<li>Publication: Journal and publication submissions</li>
						<li>Student Project: Capstone and student research proposals</li>
						<li>Grant: Funding and grant proposal submissions</li>
					</ul>
					<p>This page is open to any visitor. To submit documents and access your personalized dashboard, please log in below.</p>
					<p><a href="<?php echo esc_url( $login_url ); ?>" class="rrp-btn">Log in to submit and access dashboard</a></p>
					<?php if ( $logged_in ) : ?>
						<p><a href="<?php echo esc_url( add_query_arg( 'portal', '1', get_permalink() ) ); ?>" class="rrp-btn secondary">Go to your portal</a></p>
					<?php endif; ?>
				</div>
				<div class="rrp-process-docs-container">
					<h2>Submission Process Flow (by type)</h2>
					<?php echo do_shortcode( '[rrp_process_documentation type="all" style="compact"]' ); ?>
				</div>
			</div>
			<?php
			return ob_get_clean();
		}

		?>
		<div id="research-review-portal" class="rrp-portal" data-rest-base="<?php echo esc_attr( rest_url( 'research-portal/v1' ) ); ?>" data-nonce="<?php echo esc_attr( wp_create_nonce( 'wp_rest' ) ); ?>">
			<div class="rrp-loading">Loading portal…</div>
		</div>
		<?php
		return ob_get_clean();
	}
}

	add_action( 'init', array( 'Research_Review_Portal', 'init' ) );
	add_action( 'rest_api_init', array( 'Portal_REST', 'register_routes' ) );

	add_action( 'rrp_daily_report', array( 'Portal_REST', 'scheduled_report' ) );

	register_activation_hook( __FILE__, function() {
		if ( ! wp_next_scheduled( 'rrp_daily_report' ) ) {
			wp_schedule_event( time(), 'daily', 'rrp_daily_report' );
		}
	} );

	register_deactivation_hook( __FILE__, function() {
		wp_clear_scheduled_hook( 'rrp_daily_report' );
	} );
