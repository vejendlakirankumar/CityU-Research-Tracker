<?php
/**
 * Research Review Portal — Authentication Provider
 *
 * Abstracts the login/logout mechanism so the portal can switch from
 * WordPress-native authentication to Microsoft Entra ID (Azure AD) SSO
 * with minimal configuration changes.
 *
 * ── Current mode ─────────────────────────────────────────────────────────────
 * RRP_AUTH_PROVIDER = 'wordpress'   (default — no changes needed)
 * Users log in through the standard WordPress login page.
 *
 * ── Switching to Entra ID ────────────────────────────────────────────────────
 * 1. Register an App Registration in your Azure portal (Entra ID → App registrations).
 *    Set the redirect URI to:
 *      https://<your-domain>/wp-json/research-portal/v1/auth/callback
 *
 * 2. Add the following constants to wp-config.php (do NOT commit secrets):
 *
 *      define( 'RRP_AUTH_PROVIDER',      'entra' );
 *      define( 'RRP_ENTRA_TENANT_ID',    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' );
 *      define( 'RRP_ENTRA_CLIENT_ID',    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' );
 *      define( 'RRP_ENTRA_CLIENT_SECRET','your-client-secret-value' );
 *      define( 'RRP_ENTRA_REDIRECT_URI', 'https://<your-domain>/wp-json/research-portal/v1/auth/callback' );
 *
 * 3. Register the callback route — already done in class-portal-rest.php
 *    (see RRP_AUTH_PROVIDER check there).
 *
 * ── Authorization model (unchanged in both modes) ────────────────────────────
 * Entra handles authentication only (who you are).
 * Portal roles (Student / Reviewer / Coordinator / Admin) are assigned locally
 * by the portal administrator and are never synced from Entra groups.
 * A brand-new Entra user gets no portal role until an admin assigns one.
 * ─────────────────────────────────────────────────────────────────────────────
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'RRP_AUTH_PROVIDER' ) ) {
	// Default: use WordPress native auth.
	// Change to 'entra' in wp-config.php once Entra constants are set.
	define( 'RRP_AUTH_PROVIDER', 'wordpress' );
}

class RRP_Auth_Provider {

	/**
	 * Return the login URL for whichever provider is active.
	 *
	 * @param string $redirect_to  URL to return to after successful login.
	 * @return string
	 */
	public static function get_login_url( $redirect_to = '' ) {
		if ( RRP_AUTH_PROVIDER === 'entra' ) {
			return self::entra_auth_url( $redirect_to );
		}
		return wp_login_url( $redirect_to ?: home_url() );
	}

	/**
	 * Return the logout URL for whichever provider is active.
	 *
	 * @param string $redirect_to  URL to land on after logout.
	 * @return string
	 */
	public static function get_logout_url( $redirect_to = '' ) {
		if ( RRP_AUTH_PROVIDER === 'entra' ) {
			return self::entra_logout_url( $redirect_to );
		}
		return wp_logout_url( $redirect_to ?: home_url() );
	}

	/**
	 * True when there is an authenticated session (provider-agnostic).
	 *
	 * @return bool
	 */
	public static function is_authenticated() {
		return is_user_logged_in();
	}

	// ── Entra stubs ── (inactive until RRP_AUTH_PROVIDER = 'entra') ─────────

	/**
	 * Build the Entra OAuth 2.0 authorization URL.
	 * Falls back gracefully to WP login if constants are not yet configured.
	 */
	private static function entra_auth_url( $redirect_to ) {
		if ( ! defined( 'RRP_ENTRA_TENANT_ID' ) || ! defined( 'RRP_ENTRA_CLIENT_ID' ) ) {
			// Constants not set yet — degrade gracefully
			return wp_login_url( $redirect_to ?: home_url() );
		}

		$state = wp_create_nonce( 'rrp_entra_state' );

		if ( $redirect_to ) {
			// Store the post-login destination for 5 minutes
			set_transient( 'rrp_entra_post_login_' . $state, $redirect_to, 300 );
		}

		$params = array(
			'client_id'     => RRP_ENTRA_CLIENT_ID,
			'response_type' => 'code',
			'redirect_uri'  => defined( 'RRP_ENTRA_REDIRECT_URI' ) ? RRP_ENTRA_REDIRECT_URI : '',
			'response_mode' => 'query',
			'scope'         => 'openid profile email',
			'state'         => $state,
		);

		return 'https://login.microsoftonline.com/' . RRP_ENTRA_TENANT_ID
			. '/oauth2/v2.0/authorize?' . http_build_query( $params );
	}

	/**
	 * Build the Entra logout URL (also signs the user out of Entra SSO).
	 */
	private static function entra_logout_url( $redirect_to ) {
		if ( ! defined( 'RRP_ENTRA_TENANT_ID' ) ) {
			return wp_logout_url( $redirect_to ?: home_url() );
		}
		$post_logout = rawurlencode( $redirect_to ?: home_url() );
		return 'https://login.microsoftonline.com/' . RRP_ENTRA_TENANT_ID
			. '/oauth2/v2.0/logout?post_logout_redirect_uri=' . $post_logout;
	}

	/**
	 * Handle the incoming Entra OAuth callback.
	 *
	 * Registered as:  GET /wp-json/research-portal/v1/auth/callback
	 * Active only when RRP_AUTH_PROVIDER = 'entra'.
	 *
	 * Full implementation flow (to be completed once Entra constants are set):
	 *   1. Verify the 'state' nonce against the transient set in entra_auth_url().
	 *   2. Exchange the 'code' parameter for tokens via the token endpoint.
	 *   3. Decode the id_token and extract: oid, email, name, department claims.
	 *   4. Call self::map_entra_user() to find or create the local WP user.
	 *   5. Call wp_set_auth_cookie() and redirect to the portal.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_Error|void
	 */
	public static function handle_entra_callback( WP_REST_Request $request ) {
		// Stub — full implementation activates once Entra is provisioned.
		return new WP_Error(
			'entra_not_configured',
			'Microsoft Entra authentication is not yet configured. Set RRP_AUTH_PROVIDER = "entra" and the four Entra constants in wp-config.php.',
			array( 'status' => 501 )
		);
	}

	/**
	 * Map Entra id_token claims to a local WP user account.
	 *
	 * Lookup order:
	 *   1. Find existing user by stable Entra OID (survives email/name changes).
	 *   2. Fall back to email match (for users pre-created by admin).
	 *   3. Create a new WP user with NO portal roles — admin must assign roles
	 *      before the user gains any portal access.
	 *
	 * On every login the display_name is refreshed from Entra.
	 * The department claim is only written on first login (admin can override).
	 *
	 * @param array $claims  Decoded id_token payload: { oid, email, name, department }
	 * @return int|WP_Error  WP user ID on success.
	 */
	public static function map_entra_user( array $claims ) {
		$oid   = sanitize_text_field( $claims['oid']   ?? '' );
		$email = sanitize_email(      $claims['email'] ?? '' );
		$name  = sanitize_text_field( $claims['name']  ?? '' );

		if ( ! $oid || ! $email ) {
			return new WP_Error( 'entra_invalid_claims', 'Missing oid or email in Entra token.' );
		}

		// 1. Find by stable OID (preferred — survives email changes)
		$by_oid = get_users( array(
			'meta_key'   => 'rrp_entra_oid',
			'meta_value' => $oid,
			'number'     => 1,
		) );
		$user = $by_oid[0] ?? null;

		// 2. Fall back to email
		if ( ! $user ) {
			$user = get_user_by( 'email', $email );
		}

		// 3. Auto-provision — no portal role assigned; admin must grant access
		if ( ! $user ) {
			$user_id = wp_insert_user( array(
				'user_login'   => sanitize_user( $email ),
				'user_email'   => $email,
				'display_name' => $name,
				'user_pass'    => wp_generate_password( 32 ),
				'role'         => '', // Intentionally empty — admin assigns portal roles
			) );
			if ( is_wp_error( $user_id ) ) {
				return $user_id;
			}
			$user = get_userdata( $user_id );
		}

		// Always update the stable OID link
		update_user_meta( $user->ID, 'rrp_entra_oid', $oid );

		// Sync display_name from Entra on every login
		if ( $name && $name !== $user->display_name ) {
			wp_update_user( array( 'ID' => $user->ID, 'display_name' => $name ) );
		}

		// Sync department only on first login (admin may override locally)
		if ( ! empty( $claims['department'] ) && ! get_user_meta( $user->ID, 'rrp_department', true ) ) {
			update_user_meta( $user->ID, 'rrp_department', sanitize_text_field( $claims['department'] ) );
		}

		return $user->ID;
	}
}
