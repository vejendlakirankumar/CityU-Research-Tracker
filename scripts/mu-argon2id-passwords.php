<?php
/**
 * Argon2id Password Hashing for WordPress
 *
 * Must-use plugin (mu-plugin) — WordPress loads mu-plugins before
 * wp-includes/pluggable.php, so defining wp_hash_password() and
 * wp_check_password() here takes precedence over WordPress's built-in
 * phpass/bcrypt implementations, with no core-file modifications required.
 *
 * ── Hash compatibility (all handled transparently) ──────────────────────────
 *   $argon2id$  — Argon2id  — verified natively via password_verify()
 *   $2y$ / $2b$ — bcrypt    — verified via password_verify(), upgraded on login
 *   $P$ / $H$   — phpass    — verified via PasswordHash class, upgraded on login
 *
 * ── Upgrade path ─────────────────────────────────────────────────────────────
 * Existing users keep their current hash until they log in.  On the next
 * successful authentication WordPress calls wp_check_password(), which detects
 * the outdated algorithm and calls wp_set_password() to rehash as Argon2id.
 * The process is invisible to the user and requires no manual intervention.
 *
 * ── Requirements ─────────────────────────────────────────────────────────────
 * PHP 7.2+ compiled with libargon2 (php8.1 on this server qualifies).
 * If PASSWORD_ARGON2ID is unavailable this file exits silently and WordPress
 * falls back to its built-in phpass implementation — no breakage.
 *
 * ── Author ───────────────────────────────────────────────────────────────────
 * Kiran Kumar Vejendla — vejendlakirankumar@cityu.edu
 * City University of Seattle · School of Technology and Computing (STC)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Graceful fallback: if libargon2 is unavailable, do nothing and let
// WordPress's default phpass handle everything.
if ( ! defined( 'PASSWORD_ARGON2ID' ) ) {
	return;
}

// Argon2id parameters — memory-hard to resist GPU/ASIC brute-force.
// memory_cost 65536 KiB = 64 MiB; time_cost 4 iterations; threads 2.
const RRP_ARGON2ID_OPTIONS = [
	'memory_cost' => 65536,
	'time_cost'   => 4,
	'threads'     => 2,
];

/**
 * Hash a password using Argon2id.
 *
 * WordPress calls this when creating users, resetting passwords, and after
 * a successful login where rehashing is needed (via wp_set_password).
 *
 * @param  string $password Plain-text password.
 * @return string           Argon2id hash string (starts with '$argon2id$').
 */
function wp_hash_password( string $password ): string {
	return password_hash( $password, PASSWORD_ARGON2ID, RRP_ARGON2ID_OPTIONS );
}

/**
 * Verify a password against a stored hash.
 *
 * Handles Argon2id, bcrypt ($2y$/$2b$), and legacy phpass ($P$/$H$) hashes.
 * On successful verification with a non-Argon2id hash, silently rehashes the
 * password to Argon2id so the user's stored hash is transparently upgraded.
 *
 * @param  string     $password Plain-text password to check.
 * @param  string     $hash     Stored hash to check against.
 * @param  int|string $user_id  WP user ID — used only for the silent rehash.
 * @return bool                 True if the password matches the hash.
 */
function wp_check_password( string $password, string $hash, int|string $user_id = '' ): bool {

	// ── Argon2id or bcrypt (PHP's password_verify handles both) ──────────────
	if (
		str_starts_with( $hash, '$argon2id$' ) ||
		str_starts_with( $hash, '$2y$' )       ||
		str_starts_with( $hash, '$2b$' )
	) {
		$check = password_verify( $password, $hash );

		// Transparent upgrade: bcrypt hashes → Argon2id on next successful login.
		// password_needs_rehash() returns false for already-correct Argon2id hashes,
		// so this only fires when the algo or cost params differ.
		if (
			$check &&
			$user_id &&
			function_exists( 'wp_set_password' ) &&
			password_needs_rehash( $hash, PASSWORD_ARGON2ID, RRP_ARGON2ID_OPTIONS )
		) {
			wp_set_password( $password, (int) $user_id );
		}

		/** This filter is documented in wp-includes/pluggable.php */
		return (bool) apply_filters( 'check_password', $check, $password, $hash, $user_id );
	}

	// ── Legacy phpass ($P$ or $H$) ────────────────────────────────────────────
	// Older WordPress installs used phpass which produces hashes starting with
	// '$P$' (portable) or '$H$' (htpasswd-compatible).  password_verify() does
	// not understand phpass, so we delegate to WordPress's own PasswordHash class.
	require_once ABSPATH . WPINC . '/class-phpass.php';
	$wp_hasher = new PasswordHash( 8, true );
	$check      = $wp_hasher->CheckPassword( $password, $hash );

	// Transparent upgrade: phpass hashes → Argon2id on next successful login.
	if ( $check && $user_id && function_exists( 'wp_set_password' ) ) {
		wp_set_password( $password, (int) $user_id );
	}

	/** This filter is documented in wp-includes/pluggable.php */
	return (bool) apply_filters( 'check_password', $check, $password, $hash, $user_id );
}
