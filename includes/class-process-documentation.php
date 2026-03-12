<?php
/**
 * Research Review Portal - Process Documentation
 * Public-facing documentation for submission and review processes
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class RRP_Process_Documentation {

	/**
	 * Process documentation data for each submission type
	 */
	const PROCESS_DOCUMENTATION = array(
		'conference' => array(
			'title' => 'Conference Paper Submission Process',
			'description' => 'Detailed workflow for submitting papers to academic conferences including the Applied Research Symposium and Doctor of IT Forum.',
			'estimated_total_time' => '4-6 weeks',
			'requirements' => array(
				'Word count: 250-500 words for abstract',
				'3-5 keywords required',
				'Research area classification',
				'Presentation preference (oral or poster)',
				'Supporting documentation (optional)',
			),
			'stages' => array(
				array(
					'name' => 'Initial Screening',
					'description' => 'Administrative review of submission completeness and basic requirements',
					'reviewers_required' => 1,
					'estimated_time' => '2-3 business days',
					'reviewer_role' => 'Administrative Staff',
					'criteria' => array(
						'Complete submission form',
						'Abstract meets word count requirements',
						'Required fields populated',
						'File attachments properly formatted',
					),
					'possible_outcomes' => array(
						'Approved' => 'Move to next stage',
						'Revision Required' => 'Return to submitter for corrections',
					),
				),
				array(
					'name' => 'Reviewer Assignment',
					'description' => 'Assignment of qualified reviewers based on expertise and availability',
					'reviewers_required' => 1,
					'estimated_time' => '1-2 business days',
					'reviewer_role' => 'Coordinator',
					'criteria' => array(
						'Match reviewer expertise to research area',
						'Check reviewer availability and workload',
						'Avoid conflicts of interest',
					),
					'possible_outcomes' => array(
						'Approved' => 'Reviewers assigned, proceed to peer review',
					),
				),
				array(
					'name' => 'Peer Review',
					'description' => 'Expert evaluation of research quality, methodology, and contribution',
					'reviewers_required' => 2,
					'estimated_time' => '7-14 business days',
					'reviewer_role' => 'Subject Matter Experts',
					'criteria' => array(
						'Research novelty and significance',
						'Methodology appropriateness',
						'Technical quality and rigor',
						'Clarity of presentation',
						'Relevance to conference theme',
					),
					'possible_outcomes' => array(
						'Approved' => 'Both reviewers approve',
						'Revision Required' => 'Reviewers request modifications',
						'Rejected' => 'Fundamental issues identified',
					),
				),
				array(
					'name' => 'Review Consolidation',
					'description' => 'Synthesis of reviewer feedback and determination of final recommendations',
					'reviewers_required' => 2,
					'estimated_time' => '3-5 business days',
					'reviewer_role' => 'Senior Reviewers/Coordinators',
					'criteria' => array(
						'Reconcile conflicting reviewer opinions',
						'Assess revision completeness (if applicable)',
						'Ensure consistent evaluation standards',
					),
					'possible_outcomes' => array(
						'Approved' => 'Move to final decision stage',
						'Additional Review Required' => 'Seek additional expert opinion',
					),
				),
				array(
					'name' => 'Final Decision',
					'description' => 'Official acceptance or rejection decision with detailed feedback',
					'reviewers_required' => 1,
					'estimated_time' => '2-3 business days',
					'reviewer_role' => 'Program Committee Chair',
					'criteria' => array(
						'Overall contribution to conference',
						'Alignment with conference goals',
						'Quality relative to other submissions',
						'Presentation logistics',
					),
					'possible_outcomes' => array(
						'Accepted - Oral Presentation' => 'Accepted for oral presentation',
						'Accepted - Poster Presentation' => 'Accepted for poster session',
						'Rejected' => 'Not accepted for this conference',
					),
				),
				array(
					'name' => 'Confirmation',
					'description' => 'Final confirmation of presentation details and logistics',
					'reviewers_required' => 1,
					'estimated_time' => '1-2 business days',
					'reviewer_role' => 'Conference Coordinator',
					'criteria' => array(
						'Presenter availability confirmed',
						'Technical requirements documented',
						'Registration completed',
					),
					'possible_outcomes' => array(
						'Confirmed' => 'Ready for conference presentation',
					),
				),
			),
		),
		'publication' => array(
			'title' => 'Publication Submission Process',
			'description' => 'Comprehensive review process for journal articles and research publications.',
			'estimated_total_time' => '6-10 weeks',
			'requirements' => array(
				'Extended abstract or full paper',
				'Publication type specification',
				'3-5 keywords required',
				'Research area classification',
				'Bibliography and citations',
			),
			'stages' => array(
				array(
					'name' => 'Administrative Check',
					'description' => 'Initial administrative review for submission guidelines compliance',
					'reviewers_required' => 1,
					'estimated_time' => '3-5 business days',
					'reviewer_role' => 'Editorial Assistant',
					'criteria' => array(
						'Formatting compliance',
						'Required sections present',
						'Citation format correct',
						'Ethical considerations met',
					),
					'possible_outcomes' => array(
						'Approved' => 'Proceed to reviewer matching',
						'Revision Required' => 'Format/administrative corrections needed',
					),
				),
				array(
					'name' => 'Reviewer Matching',
					'description' => 'Identification and assignment of expert reviewers in relevant field',
					'reviewers_required' => 1,
					'estimated_time' => '3-7 business days',
					'reviewer_role' => 'Associate Editor',
					'criteria' => array(
						'Subject matter expertise alignment',
						'Reviewer reputation and qualifications',
						'Availability and response history',
						'Conflict of interest screening',
					),
					'possible_outcomes' => array(
						'Approved' => 'Expert reviewers assigned',
						'Extended Search' => 'Difficulty finding qualified reviewers',
					),
				),
				array(
					'name' => 'Expert Review',
					'description' => 'In-depth peer review by subject matter experts',
					'reviewers_required' => 2,
					'estimated_time' => '14-21 business days',
					'reviewer_role' => 'Field Experts',
					'criteria' => array(
						'Original contribution to knowledge',
						'Methodological rigor and validity',
						'Literature review completeness',
						'Data analysis and interpretation',
						'Writing quality and clarity',
						'Reproducibility of results',
					),
					'possible_outcomes' => array(
						'Accept' => 'Recommended for publication',
						'Minor Revisions' => 'Small improvements needed',
						'Major Revisions' => 'Significant changes required',
						'Reject' => 'Fundamental flaws identified',
					),
				),
				array(
					'name' => 'Director Assessment',
					'description' => 'Senior leadership review for strategic alignment and quality assurance',
					'reviewers_required' => 2,
					'estimated_time' => '5-7 business days',
					'reviewer_role' => 'Research Directors',
					'criteria' => array(
						'Alignment with institutional goals',
						'Potential impact and visibility',
						'Resource implications',
						'Strategic value to department',
					),
					'possible_outcomes' => array(
						'Endorsed' => 'Full institutional support',
						'Conditional' => 'Support with modifications',
						'Declined' => 'Does not align with priorities',
					),
				),
				array(
					'name' => 'Final Decision',
					'description' => 'Editorial decision incorporating all reviewer feedback',
					'reviewers_required' => 1,
					'estimated_time' => '3-5 business days',
					'reviewer_role' => 'Editor-in-Chief',
					'criteria' => array(
						'Synthesis of all reviewer comments',
						'Journal fit and scope alignment',
						'Publication standards compliance',
					),
					'possible_outcomes' => array(
						'Accepted' => 'Approved for publication',
						'Rejected' => 'Not suitable for publication',
					),
				),
				array(
					'name' => 'Tracking',
					'description' => 'Ongoing monitoring of publication progress and outcomes',
					'reviewers_required' => 1,
					'estimated_time' => 'Ongoing',
					'reviewer_role' => 'Publication Coordinator',
					'criteria' => array(
						'Track submission to target journals',
						'Monitor review process status',
						'Record publication outcomes',
					),
					'possible_outcomes' => array(
						'Published' => 'Successfully published',
						'In Review' => 'Under journal review',
						'Withdrawn' => 'Submission withdrawn',
					),
				),
			),
		),
		'student-project' => array(
			'title' => 'Student Project Review Process',
			'description' => 'Comprehensive review and approval process for capstone projects and student research initiatives.',
			'estimated_total_time' => '3-5 weeks',
			'requirements' => array(
				'Project proposal with clear objectives',
				'Student information and contact details',
				'Project type classification',
				'Expected timeline and deliverables',
				'Resource requirements',
			),
			'stages' => array(
				array(
					'name' => 'Advisor Matching',
					'description' => 'Assignment of appropriate faculty advisor based on project scope and expertise',
					'reviewers_required' => 1,
					'estimated_time' => '2-3 business days',
					'reviewer_role' => 'Academic Coordinator',
					'criteria' => array(
						'Faculty expertise alignment',
						'Advisor availability and capacity',
						'Student academic background compatibility',
						'Project complexity appropriateness',
					),
					'possible_outcomes' => array(
						'Approved' => 'Suitable advisor assigned',
						'Alternative Required' => 'Seek different advisor',
					),
				),
				array(
					'name' => 'Advisor Consultation',
					'description' => 'Initial consultation between student and assigned advisor to refine project scope',
					'reviewers_required' => 1,
					'estimated_time' => '3-7 business days',
					'reviewer_role' => 'Faculty Advisor',
					'criteria' => array(
						'Project feasibility assessment',
						'Resource requirement evaluation',
						'Timeline realism review',
						'Learning objectives alignment',
					),
					'possible_outcomes' => array(
						'Approved' => 'Project scope confirmed',
						'Revision Required' => 'Project needs modification',
					),
				),
				array(
					'name' => 'Feasibility Check',
					'description' => 'Technical and practical feasibility assessment of proposed project',
					'reviewers_required' => 1,
					'estimated_time' => '3-5 business days',
					'reviewer_role' => 'Technical Reviewer',
					'criteria' => array(
						'Technical complexity assessment',
						'Available resources sufficiency',
						'Timeline achievability',
						'Risk assessment and mitigation',
					),
					'possible_outcomes' => array(
						'Feasible' => 'Project is technically achievable',
						'Needs Modification' => 'Scope adjustment required',
						'Infeasible' => 'Alternative project needed',
					),
				),
				array(
					'name' => 'Director Approval',
					'description' => 'Departmental approval from academic director for project authorization',
					'reviewers_required' => 1,
					'estimated_time' => '2-3 business days',
					'reviewer_role' => 'Academic Director',
					'criteria' => array(
						'Alignment with program goals',
						'Resource allocation approval',
						'Academic standards compliance',
						'Institutional policy adherence',
					),
					'possible_outcomes' => array(
						'Approved' => 'Project officially authorized',
						'Conditional' => 'Approval with conditions',
						'Denied' => 'Project not approved',
					),
				),
				array(
					'name' => 'Project Setup',
					'description' => 'Establishment of project infrastructure and initial deliverable planning',
					'reviewers_required' => 1,
					'estimated_time' => '1-2 business days',
					'reviewer_role' => 'Project Coordinator',
					'criteria' => array(
						'Resource allocation confirmation',
						'Milestone establishment',
						'Communication protocols setup',
						'Documentation requirements defined',
					),
					'possible_outcomes' => array(
						'Setup Complete' => 'Project ready to begin',
					),
				),
				array(
					'name' => 'Milestone Tracking',
					'description' => 'Ongoing monitoring of project progress and milestone achievement',
					'reviewers_required' => 1,
					'estimated_time' => 'Ongoing throughout project',
					'reviewer_role' => 'Faculty Advisor',
					'criteria' => array(
						'Milestone completion tracking',
						'Quality assessment of deliverables',
						'Timeline adherence monitoring',
						'Resource utilization review',
					),
					'possible_outcomes' => array(
						'On Track' => 'Project progressing normally',
						'Attention Needed' => 'Intervention required',
						'Complete' => 'Project successfully finished',
					),
				),
			),
		),
		'grant' => array(
			'title' => 'Grant Proposal Review Process',
			'description' => 'Comprehensive evaluation process for funding applications and research grant proposals.',
			'estimated_total_time' => '8-12 weeks',
			'requirements' => array(
				'Complete grant application',
				'Funding agency specification',
				'Budget and resource justification',
				'Project timeline and milestones',
				'Expected outcomes and impact',
			),
			'stages' => array(
				array(
					'name' => 'Compliance Check',
					'description' => 'Verification of grant application compliance with funding agency requirements',
					'reviewers_required' => 1,
					'estimated_time' => '3-5 business days',
					'reviewer_role' => 'Grants Administrator',
					'criteria' => array(
						'Application completeness',
						'Format and structure compliance',
						'Eligibility requirements met',
						'Deadline adherence',
						'Required signatures and approvals',
					),
					'possible_outcomes' => array(
						'Compliant' => 'Meets all formal requirements',
						'Corrections Needed' => 'Minor compliance issues',
						'Non-Compliant' => 'Major compliance failures',
					),
				),
				array(
					'name' => 'Review Assignment',
					'description' => 'Assignment of appropriate reviewers with relevant expertise and authority',
					'reviewers_required' => 1,
					'estimated_time' => '5-7 business days',
					'reviewer_role' => 'Research Director',
					'criteria' => array(
						'Reviewer expertise matching',
						'Conflict of interest screening',
						'Review panel composition',
						'Authority level appropriateness',
					),
					'possible_outcomes' => array(
						'Panel Assigned' => 'Review committee established',
						'External Review Required' => 'Need outside experts',
					),
				),
				array(
					'name' => 'Multi-Criteria Review',
					'description' => 'Comprehensive evaluation across multiple assessment dimensions',
					'reviewers_required' => 2,
					'estimated_time' => '14-21 business days',
					'reviewer_role' => 'Subject Matter Experts',
					'criteria' => array(
						'Scientific/technical merit',
						'Innovation and significance',
						'Methodology and approach',
						'Team qualifications and experience',
						'Budget justification and efficiency',
						'Institutional capacity',
						'Potential impact and outcomes',
					),
					'possible_outcomes' => array(
						'Highly Recommended' => 'Strong endorsement',
						'Recommended' => 'Support with minor concerns',
						'Conditionally Recommended' => 'Support dependent on modifications',
						'Not Recommended' => 'Significant issues identified',
					),
				),
				array(
					'name' => 'Committee Meeting',
					'description' => 'Formal committee review meeting to discuss and evaluate proposals',
					'reviewers_required' => 2,
					'estimated_time' => '7-10 business days',
					'reviewer_role' => 'Review Committee Members',
					'criteria' => array(
						'Collective assessment and discussion',
						'Comparative evaluation with other proposals',
						'Funding priority determination',
						'Risk assessment and mitigation',
					),
					'possible_outcomes' => array(
						'Endorsed' => 'Committee supports proposal',
						'Deferred' => 'Request for more information',
						'Declined' => 'Committee does not support',
					),
				),
				array(
					'name' => 'Final Decision',
					'description' => 'Official institutional decision on grant proposal support',
					'reviewers_required' => 1,
					'estimated_time' => '3-5 business days',
					'reviewer_role' => 'Institutional Official',
					'criteria' => array(
						'Institutional strategic alignment',
						'Resource availability',
						'Commitment capacity',
						'Regulatory compliance assurance',
					),
					'possible_outcomes' => array(
						'Approved' => 'Institutional support granted',
						'Conditional Approval' => 'Support with specific conditions',
						'Declined' => 'No institutional support',
					),
				),
				array(
					'name' => 'Development Support',
					'description' => 'Assistance with proposal development and submission optimization',
					'reviewers_required' => 1,
					'estimated_time' => '5-10 business days',
					'reviewer_role' => 'Grant Development Specialist',
					'criteria' => array(
						'Proposal strengthening recommendations',
						'Submission strategy development',
						'Agency liaison support',
						'Post-submission tracking setup',
					),
					'possible_outcomes' => array(
						'Enhanced' => 'Proposal optimized for submission',
						'Ready' => 'Proposal ready as-is',
					),
				),
				array(
					'name' => 'Submission Tracking',
					'description' => 'Ongoing monitoring of submitted proposal status and outcomes',
					'reviewers_required' => 1,
					'estimated_time' => 'Ongoing',
					'reviewer_role' => 'Grants Coordinator',
					'criteria' => array(
						'Agency review process tracking',
						'Response to agency queries',
						'Outcome documentation',
						'Success/failure analysis',
					),
					'possible_outcomes' => array(
						'Funded' => 'Grant awarded',
						'Under Review' => 'In agency review process',
						'Declined' => 'Not funded',
						'Withdrawn' => 'Proposal withdrawn',
					),
				),
			),
		),
	);

	/**
	 * Initialize process documentation
	 */
	public static function init() {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_scripts' ) );
		add_shortcode( 'rrp_process_documentation', array( __CLASS__, 'shortcode_documentation' ) );
		// Backward compatibility alias used in Sprint 1 documentation
		add_shortcode( 'research_process_docs', array( __CLASS__, 'shortcode_documentation' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_api_routes' ) );
	}

	/**
	 * Enqueue scripts for interactive features
	 */
	public static function enqueue_scripts() {
		wp_enqueue_script(
			'rrp-process-docs',
			RRP_PLUGIN_URL . 'assets/process-docs.js',
			array( 'jquery' ),
			'1.0.0',
			true
		);
		wp_enqueue_style(
			'rrp-process-docs',
			RRP_PLUGIN_URL . 'assets/process-docs.css',
			array(),
			'1.0.0'
		);
		
		wp_localize_script( 'rrp-process-docs', 'rrpProcessDocs', array(
			'restBase' => rest_url( 'research-portal/v1' ),
			'nonce' => wp_create_nonce( 'wp_rest' ),
		) );
	}

	/**
	 * Register API routes for process documentation
	 */
	public static function register_api_routes() {
		register_rest_route( 'research-portal/v1', '/process-docs/(?P<type>[a-zA-Z0-9\-]+)', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get_process_documentation' ),
			'permission_callback' => '__return_true', // Public endpoint
			'args'                => array(
				'type' => array(
					'required' => true,
					'validate_callback' => function( $param ) {
						return array_key_exists( $param, self::PROCESS_DOCUMENTATION );
					},
				),
			),
		) );
	}

	/**
	 * API endpoint to get process documentation
	 */
	public static function get_process_documentation( WP_REST_Request $request ) {
		$type = $request->get_param( 'type' );
		
		if ( ! isset( self::PROCESS_DOCUMENTATION[ $type ] ) ) {
			return new WP_REST_Response(
				array( 'error' => 'Invalid submission type' ),
				404
			);
		}

		return new WP_REST_Response( self::PROCESS_DOCUMENTATION[ $type ], 200 );
	}

	/**
	 * Shortcode to display process documentation
	 */
	public static function shortcode_documentation( $atts ) {
		$atts = shortcode_atts( array(
			'type' => 'all',
			'style' => 'full', // full, compact, timeline
		), $atts );

		ob_start();
		?>
		<div class="rrp-process-docs" data-style="<?php echo esc_attr( $atts['style'] ); ?>">
			<?php if ( $atts['type'] === 'all' ) : ?>
				<?php self::render_all_processes( $atts['style'] ); ?>
			<?php else : ?>
				<?php self::render_single_process( $atts['type'], $atts['style'] ); ?>
			<?php endif; ?>
		</div>
		<?php
		return ob_get_clean();
	}

	/**
	 * Render documentation for all submission types
	 */
	private static function render_all_processes( $style ) {
		?>
		<div class="rrp-process-overview">
			<h1>Research Submission Process Guide</h1>
			<p class="overview-description">
				The Research Review Portal supports four types of submissions, each with a tailored review process designed to ensure quality and appropriate evaluation. Select a submission type below to view the detailed process.
			</p>

			<div class="process-type-selector">
				<div class="process-tabs">
					<?php foreach ( self::PROCESS_DOCUMENTATION as $type => $data ) : ?>
						<button class="process-tab" data-type="<?php echo esc_attr( $type ); ?>">
							<h3><?php echo esc_html( $data['title'] ); ?></h3>
							<span class="estimated-time">⏱️ <?php echo esc_html( $data['estimated_total_time'] ); ?></span>
						</button>
					<?php endforeach; ?>
				</div>
			</div>

			<div class="process-content">
				<?php foreach ( self::PROCESS_DOCUMENTATION as $type => $data ) : ?>
					<div class="process-details" id="process-<?php echo esc_attr( $type ); ?>" style="display: none;">
						<?php self::render_process_details( $type, $data, $style ); ?>
					</div>
				<?php endforeach; ?>
			</div>
		</div>

		<script>
		jQuery(document).ready(function($) {
			// Show first process by default
			$('.process-tab:first').addClass('active');
			$('.process-details:first').show();

			// Tab switching functionality
			$('.process-tab').on('click', function() {
				var type = $(this).data('type');
				
				// Update active tab
				$('.process-tab').removeClass('active');
				$(this).addClass('active');
				
				// Show corresponding content
				$('.process-details').hide();
				$('#process-' + type).show();
			});
		});
		</script>
		<?php
	}

	/**
	 * Render documentation for a single submission type
	 */
	private static function render_single_process( $type, $style ) {
		if ( ! isset( self::PROCESS_DOCUMENTATION[ $type ] ) ) {
			echo '<p>Invalid submission type specified.</p>';
			return;
		}

		$data = self::PROCESS_DOCUMENTATION[ $type ];
		self::render_process_details( $type, $data, $style );
	}

	/**
	 * Render detailed process information
	 */
	private static function render_process_details( $type, $data, $style ) {
		?>
		<div class="process-header">
			<h2><?php echo esc_html( $data['title'] ); ?></h2>
			<p class="process-description"><?php echo esc_html( $data['description'] ); ?></p>
			
			<div class="process-meta">
				<div class="meta-item">
					<strong>Total Estimated Time:</strong> 
					<span class="highlight"><?php echo esc_html( $data['estimated_total_time'] ); ?></span>
				</div>
				<div class="meta-item">
					<strong>Number of Review Stages:</strong>
					<span class="highlight"><?php echo count( $data['stages'] ); ?></span>
				</div>
			</div>
		</div>

		<div class="process-requirements">
			<h3>📋 Submission Requirements</h3>
			<ul class="requirements-list">
				<?php foreach ( $data['requirements'] as $requirement ) : ?>
					<li><?php echo esc_html( $requirement ); ?></li>
				<?php endforeach; ?>
			</ul>
		</div>

		<?php if ( $style === 'timeline' ) : ?>
			<?php self::render_timeline_view( $data['stages'] ); ?>
		<?php else : ?>
			<?php self::render_stages_view( $data['stages'], $style ); ?>
		<?php endif; ?>

		<div class="process-footer">
			<div class="helpful-info">
				<h3>💡 Helpful Information</h3>
				<ul>
					<li><strong>Progress Tracking:</strong> You can track your submission status at any time through the portal dashboard.</li>
					<li><strong>Notifications:</strong> Email notifications are sent at each stage transition and when reviewer feedback is available.</li>
					<li><strong>Revisions:</strong> If revisions are requested, you'll have the opportunity to address feedback and resubmit.</li>
					<li><strong>Questions:</strong> Contact the research office if you have questions about the review process.</li>
				</ul>
			</div>
		</div>
		<?php
	}

	/**
	 * Render stages in detailed view
	 */
	private static function render_stages_view( $stages, $style ) {
		?>
		<div class="review-stages <?php echo esc_attr( $style ); ?>">
			<h3>🔄 Review Process Stages</h3>
			
			<div class="stages-container">
				<?php foreach ( $stages as $index => $stage ) : ?>
					<div class="stage-card" data-stage="<?php echo esc_attr( $index + 1 ); ?>">
						<div class="stage-header">
							<div class="stage-number"><?php echo esc_html( $index + 1 ); ?></div>
							<div class="stage-title">
								<h4><?php echo esc_html( $stage['name'] ); ?></h4>
								<div class="stage-meta">
									<span class="reviewers-count">👥 <?php echo esc_html( $stage['reviewers_required'] ); ?> reviewer<?php echo $stage['reviewers_required'] > 1 ? 's' : ''; ?></span>
									<span class="estimated-time">⏱️ <?php echo esc_html( $stage['estimated_time'] ); ?></span>
								</div>
							</div>
						</div>
						
						<div class="stage-content">
							<p class="stage-description"><?php echo esc_html( $stage['description'] ); ?></p>
							
							<div class="stage-details">
								<div class="reviewer-role">
									<strong>Reviewer Role:</strong> <?php echo esc_html( $stage['reviewer_role'] ); ?>
								</div>
								
								<div class="review-criteria">
									<strong>Evaluation Criteria:</strong>
									<ul>
										<?php foreach ( $stage['criteria'] as $criterion ) : ?>
											<li><?php echo esc_html( $criterion ); ?></li>
										<?php endforeach; ?>
									</ul>
								</div>
								
								<div class="possible-outcomes">
									<strong>Possible Outcomes:</strong>
									<div class="outcomes-list">
										<?php foreach ( $stage['possible_outcomes'] as $outcome => $description ) : ?>
											<div class="outcome-item">
												<span class="outcome-name"><?php echo esc_html( $outcome ); ?>:</span>
												<span class="outcome-description"><?php echo esc_html( $description ); ?></span>
											</div>
										<?php endforeach; ?>
									</div>
								</div>
							</div>
						</div>
						
						<?php if ( $index < count( $stages ) - 1 ) : ?>
							<div class="stage-arrow">⬇️</div>
						<?php endif; ?>
					</div>
				<?php endforeach; ?>
			</div>
		</div>
		<?php
	}

	/**
	 * Render timeline view of stages
	 */
	private static function render_timeline_view( $stages ) {
		?>
		<div class="review-timeline">
			<h3>📈 Process Timeline</h3>
			
			<div class="timeline-container">
				<div class="timeline-line"></div>
				<?php foreach ( $stages as $index => $stage ) : ?>
					<div class="timeline-item" data-stage="<?php echo esc_attr( $index + 1 ); ?>">
						<div class="timeline-marker">
							<div class="marker-number"><?php echo esc_html( $index + 1 ); ?></div>
						</div>
						<div class="timeline-content">
							<h4><?php echo esc_html( $stage['name'] ); ?></h4>
							<div class="timeline-meta">
								<span class="time-estimate">⏱️ <?php echo esc_html( $stage['estimated_time'] ); ?></span>
								<span class="reviewer-info">👥 <?php echo esc_html( $stage['reviewer_role'] ); ?></span>
							</div>
							<p><?php echo esc_html( $stage['description'] ); ?></p>
						</div>
					</div>
				<?php endforeach; ?>
			</div>
		</div>
		<?php
	}
}

// Initialize process documentation
if ( defined( 'RRP_PLUGIN_DIR' ) ) {
	RRP_Process_Documentation::init();
}