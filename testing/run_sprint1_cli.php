<?php
// CLI helper to run sprint1 tests outside WordPress environment.
// This file is for local development and debugging only.

if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/..' . '/' );
}

function plugin_dir_path( $file ) {
    return __DIR__ . '/../';
}
function plugin_dir_url( $file ) {
    return 'http://localhost/';
}
function add_action( $hook, $callback ) { return true; }
function add_shortcode( $tag, $callback ) { return true; }
function register_rest_route( $namespace, $route, $args ) { return true; }
function register_activation_hook( $file, $callback ) { return true; }
function register_deactivation_hook( $file, $callback ) { return true; }
function wp_enqueue_style() { return true; }
function wp_enqueue_script() { return true; }
function wp_json_encode( $data, $options = 0 ) { return json_encode( $data, $options ); }
function wp_mkdir_p( $dir ) { if ( ! is_dir( $dir ) ) return mkdir( $dir, 0755, true ); return true; }
function rest_url( $path = '' ) { return 'http://localhost/wp-json/' . ltrim( $path, '/' ); }
function wp_create_nonce( $action = '' ) { return 'nonce'; }
function shortcode_exists( $tag ) { return in_array( $tag, array( 'research_review_portal', 'rrp_process_documentation', 'research_process_docs' ), true ); }
function get_user_by( $field, $value ) { return null; }
function get_user_meta( $user_id, $key, $single = false ) { return ''; }
function current_time( $format ) { return date( $format ); }
function is_user_logged_in() { return false; }
function current_user_can() { return true; }
function wp_get_current_user() { return (object) array( 'user_email' => 'admin@cityu.edu.hk' ); }
function wp_generate_password() { return 'password'; }
function wp_insert_user( $userdata ) { return 1; }
function is_wp_error( $object ) { return false; }
function is_email( $email ) { return filter_var( $email, FILTER_VALIDATE_EMAIL ) !== false; }
function get_userdata( $id ) { $u = new stdClass(); $u->ID = $id; $u->roles = array(); return $u; }
function get_role( $role ) { return null; }
function add_role( $role_slug, $display_name, $capabilities = array() ) {
    global $wp_roles;
    if ( ! isset( $wp_roles ) ) {
        $wp_roles = new WP_Roles();
    }
    $wp_roles->roles[ $role_slug ] = array( 'name' => $display_name, 'capabilities' => $capabilities );
    return true;
}
function remove_role( $role_slug ) { return true; }
function username_exists( $username ) { return false; }
function sanitize_text_field( $value ) { return trim( (string) $value ); }

if ( ! class_exists( 'WP_Roles' ) ) {
    class WP_Roles {
        public $roles = array();
    }
}

if ( ! class_exists( 'WP_REST_Request' ) ) {
    class WP_REST_Request {
        private $params = array();

        public function __construct( $params = array() ) {
            $this->params = is_array( $params ) ? $params : array();
        }

        public function get_param( $name ) {
            return isset( $this->params[ $name ] ) ? $this->params[ $name ] : null;
        }

        public function get_json_params() {
            return $this->params;
        }

        public function get_body_params() {
            return $this->params;
        }

        public function get_file_params() {
            return array();
        }
    }
}

if ( ! class_exists( 'WP_REST_Response' ) ) {
    class WP_REST_Response {
        public $data;
        public $status;

        public function __construct( $data = null, $status = 200 ) {
            $this->data = $data;
            $this->status = $status;
        }

        public function header( $name, $value ) {
            return $this;
        }
    }
}

global $wp_roles;
$wp_roles = new WP_Roles();

require __DIR__ . '/../research-review-portal.php';
require __DIR__ . '/sprint1-test-runner.php';

run_sprint1_tests();
