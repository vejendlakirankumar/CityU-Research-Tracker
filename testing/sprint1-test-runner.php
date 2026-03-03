<?php
/**
 * Test Data Generator for Research Review Portal
 * Generates realistic test data for Sprint 1 validation
 */

class Test_Data_Generator {
    
    /**
     * Generate test users with different roles
     */
    public static function create_test_users() {
        $test_users = [
            // Students
            [
                'user_login' => 'student_alice',
                'user_email' => 'alice.chen@cityu.edu.hk',
                'user_pass' => 'TestPass123!',
                'first_name' => 'Alice',
                'last_name' => 'Chen',
                'role' => 'research_student',
                'meta' => [
                    'department' => 'Computer Science',
                    'research_areas' => 'Machine Learning, Data Science',
                    'student_id' => 'CS2021001',
                    'advisor' => 'Dr. Smith'
                ]
            ],
            [
                'user_login' => 'student_bob',
                'user_email' => 'bob.wong@cityu.edu.hk',
                'user_pass' => 'TestPass123!',
                'first_name' => 'Bob',
                'last_name' => 'Wong',
                'role' => 'research_student',
                'meta' => [
                    'department' => 'Engineering',
                    'research_areas' => 'Robotics, AI',
                    'student_id' => 'EE2021002',
                    'advisor' => 'Dr. Lee'
                ]
            ],
            
            // Reviewers
            [
                'user_login' => 'reviewer_smith',
                'user_email' => 'dr.smith@cityu.edu.hk',
                'user_pass' => 'TestPass123!',
                'first_name' => 'John',
                'last_name' => 'Smith',
                'role' => 'research_reviewer',
                'meta' => [
                    'department' => 'Computer Science',
                    'research_areas' => 'Machine Learning, Artificial Intelligence',
                    'expertise_level' => 'Senior',
                    'max_reviews' => '10'
                ]
            ],
            [
                'user_login' => 'reviewer_lee',
                'user_email' => 'dr.lee@cityu.edu.hk', 
                'user_pass' => 'TestPass123!',
                'first_name' => 'Sarah',
                'last_name' => 'Lee',
                'role' => 'research_reviewer',
                'meta' => [
                    'department' => 'Engineering',
                    'research_areas' => 'Robotics, Control Systems',
                    'expertise_level' => 'Senior',
                    'max_reviews' => '8'
                ]
            ],
            
            // Coordinators
            [
                'user_login' => 'coord_wilson',
                'user_email' => 'coord.wilson@cityu.edu.hk',
                'user_pass' => 'TestPass123!',
                'first_name' => 'Mary',
                'last_name' => 'Wilson',
                'role' => 'research_coordinator',
                'meta' => [
                    'department' => 'Computer Science',
                    'research_areas' => 'All CS Areas',
                    'coordinator_level' => 'Department'
                ]
            ],
            
            // Admin
            [
                'user_login' => 'admin_test',
                'user_email' => 'admin@cityu.edu.hk',
                'user_pass' => 'TestPass123!',
                'first_name' => 'Admin',
                'last_name' => 'User',
                'role' => 'research_admin',
                'meta' => [
                    'department' => 'Research Office',
                    'admin_level' => 'System'
                ]
            ]
        ];
        
        return $test_users;
    }
    
    /**
     * Generate test submissions
     */
    public static function create_test_submissions() {
        $submissions = [
            // Conference submission
            [
                'id' => 'CONF-TEST-001',
                'type' => 'conference',
                'title' => 'Machine Learning Advances in Image Recognition',
                'student_id' => 'student_alice',
                'department' => 'Computer Science',
                'status' => 'draft',
                'reviewers' => ['reviewer_smith'],
                'coordinator' => 'coord_wilson',
                'submission_date' => date('Y-m-d H:i:s'),
                'data' => [
                    'conference_name' => 'ICML 2024',
                    'submission_deadline' => '2024-02-15',
                    'abstract' => 'Novel approach to image recognition using deep learning...',
                ]
            ],
            
            // Publication submission
            [
                'id' => 'PUB-TEST-001',
                'type' => 'publication',
                'title' => 'Robotics Control Systems: A Comprehensive Survey',
                'student_id' => 'student_bob',
                'department' => 'Engineering',
                'status' => 'submitted',
                'reviewers' => ['reviewer_lee'],
                'coordinator' => 'coord_wilson',
                'submission_date' => date('Y-m-d H:i:s', strtotime('-2 days')),
                'data' => [
                    'journal_name' => 'IEEE Robotics and Automation',
                    'impact_factor' => '3.8',
                    'manuscript_type' => 'Survey Paper'
                ]
            ],
            
            // Student project
            [
                'id' => 'PROJ-TEST-001',
                'type' => 'student-project',
                'title' => 'AI-Powered Traffic Management System',
                'student_id' => 'student_alice',
                'department' => 'Computer Science',
                'status' => 'under_review',
                'reviewers' => ['reviewer_smith', 'reviewer_lee'],
                'coordinator' => 'coord_wilson',
                'submission_date' => date('Y-m-d H:i:s', strtotime('-1 week')),
                'data' => [
                    'project_type' => 'Final Year Project',
                    'supervisor' => 'Dr. Smith',
                    'duration' => '12 months'
                ]
            ],
            
            // Grant application
            [
                'id' => 'GRANT-TEST-001',
                'type' => 'grant',
                'title' => 'Advanced Neural Networks for Healthcare Applications',
                'student_id' => 'student_bob',
                'department' => 'Engineering',
                'status' => 'approved',
                'reviewers' => ['reviewer_smith', 'reviewer_lee'],
                'coordinator' => 'coord_wilson',
                'submission_date' => date('Y-m-d H:i:s', strtotime('-2 weeks')),
                'data' => [
                    'funding_agency' => 'Research Grants Council',
                    'amount' => '500000',
                    'duration' => '36 months'
                ]
            ]
        ];
        
        return $submissions;
    }
    
    /**
     * Create test WordPress users
     */
    public static function setup_wordpress_test_users() {
        $users = self::create_test_users();
        $created_users = [];
        
        foreach ($users as $user_data) {
            // Check if user exists
            if (!username_exists($user_data['user_login'])) {
                $user_id = wp_create_user(
                    $user_data['user_login'],
                    $user_data['user_pass'],
                    $user_data['user_email']
                );
                
                if (!is_wp_error($user_id)) {
                    // Set user role
                    $user = new WP_User($user_id);
                    $user->set_role($user_data['role']);
                    
                    // Set user meta
                    update_user_meta($user_id, 'first_name', $user_data['first_name']);
                    update_user_meta($user_id, 'last_name', $user_data['last_name']);
                    
                    foreach ($user_data['meta'] as $key => $value) {
                        update_user_meta($user_id, $key, $value);
                    }
                    
                    $created_users[] = [
                        'id' => $user_id,
                        'login' => $user_data['user_login'],
                        'role' => $user_data['role']
                    ];
                }
            }
        }
        
        return $created_users;
    }
    
    /**
     * Generate test data for submissions.json
     */
    public static function update_submissions_json() {
        $submissions = self::create_test_submissions();
        $submissions_file = __DIR__ . '/../data/submissions-test.json';
        
        // Add to existing submissions or create new
        $existing = file_exists($submissions_file) ? json_decode(file_get_contents($submissions_file), true) : [];
        $merged = array_merge($existing, $submissions);
        
        file_put_contents($submissions_file, json_encode($merged, JSON_PRETTY_PRINT));
        return count($submissions);
    }
    
    /**
     * Run all test data generation
     */
    public static function generate_all_test_data() {
        $results = [
            'users_created' => self::setup_wordpress_test_users(),
            'submissions_created' => self::update_submissions_json(),
            'timestamp' => current_time('mysql')
        ];
        
        // Log results
        $log_file = __DIR__ . '/../testing/test-data-log.json';
        file_put_contents($log_file, json_encode($results, JSON_PRETTY_PRINT));
        
        return $results;
    }
}

// Test execution functions
function run_sprint1_tests() {
    echo "=== Sprint 1 Testing Started ===\n";
    
    // 1. Generate test data
    echo "Generating test data...\n";
    $test_data = Test_Data_Generator::generate_all_test_data();
    
    // 2. Test user management
    echo "Testing user management...\n";
    test_user_management();
    
    // 3. Test process documentation
    echo "Testing process documentation...\n";
    test_process_documentation();
    
    // 4. Test REST API security
    echo "Testing REST API security...\n";
    test_rest_api_security();
    
    // 5. Test WordPress integration
    echo "Testing WordPress integration...\n";
    test_wordpress_integration();
    
    echo "=== Sprint 1 Testing Completed ===\n";
}

function test_user_management() {
    global $wp_roles;
    
    $tests = [];
    
    // Test custom roles exist
    $required_roles = ['research_student', 'research_reviewer', 'research_coordinator', 'research_admin'];
    foreach ($required_roles as $role) {
        $tests["role_$role"] = isset($wp_roles->roles[$role]);
    }
    
    // Test user profile extensions
    $test_user = get_user_by('login', 'student_alice');
    if ($test_user) {
        $tests['profile_extensions'] = !empty(get_user_meta($test_user->ID, 'department', true));
    }
    
    log_test_results('user_management', $tests);
    return $tests;
}

function test_process_documentation() {
    $tests = [];
    
    // Test shortcode exists
    $tests['shortcode_exists'] = shortcode_exists('research_process_docs');
    
    // Test CSS/JS files exist
    $tests['css_exists'] = file_exists(__DIR__ . '/../assets/process-docs.css');
    $tests['js_exists'] = file_exists(__DIR__ . '/../assets/process-docs.js');
    
    // Test class exists
    $tests['class_exists'] = class_exists('Portal_Process_Documentation');
    
    log_test_results('process_documentation', $tests);
    return $tests;
}

function test_rest_api_security() {
    $tests = [];
    
    // Test API class exists
    $tests['api_class_exists'] = class_exists('Portal_REST_API');
    
    // Test permission callbacks (would need actual HTTP tests in real scenario)
    $api = new Portal_REST_API();
    $tests['permission_methods_exist'] = method_exists($api, 'check_submission_permissions');
    
    log_test_results('rest_api_security', $tests);
    return $tests;
}

function test_wordpress_integration() {
    $tests = [];
    
    // Test plugin file structure
    $tests['main_plugin_exists'] = file_exists(__DIR__ . '/../research-review-portal.php');
    $tests['includes_exist'] = is_dir(__DIR__ . '/../includes/');
    
    // Test classes are loaded
    $tests['data_class_loaded'] = class_exists('Portal_Data');
    $tests['rest_class_loaded'] = class_exists('Portal_REST_API');
    $tests['user_mgmt_loaded'] = class_exists('Portal_User_Management');
    $tests['process_docs_loaded'] = class_exists('Portal_Process_Documentation');
    
    log_test_results('wordpress_integration', $tests);
    return $tests;
}

function log_test_results($test_suite, $results) {
    $log_file = __DIR__ . '/../testing/sprint1-test-results.md';
    $timestamp = date('Y-m-d H:i:s');
    
    $log_content = "## $test_suite Test Results - $timestamp\n\n";
    
    foreach ($results as $test => $passed) {
        $status = $passed ? '✅ PASS' : '❌ FAIL';
        $log_content .= "- $test: $status\n";
    }
    
    $log_content .= "\n";
    
    // Append to log file
    file_put_contents($log_file, $log_content, FILE_APPEND | LOCK_EX);
}