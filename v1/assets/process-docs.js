/**
 * Research Review Portal - Process Documentation JavaScript
 * Interactive features for process documentation
 */

(function () {
  'use strict';

  // Wait for DOM to be ready
  jQuery(document).ready(function ($) {
    initializeProcessDocs();
  });

  function initializeProcessDocs() {
    // Initialize tab functionality
    initializeTabs();
    
    // Initialize interactive timeline
    initializeTimeline();
    
    // Initialize stage expansion functionality
    initializeStageExpansion();
    
    // Initialize process comparison tools
    initializeComparison();
    
    // Initialize search functionality
    initializeSearch();
    
    // Initialize progress tracking simulation
    initializeProgressTracking();
  }

  /**
   * Initialize tab functionality for process selection
   */
  function initializeTabs() {
    $('.process-tab').on('click', function () {
      var type = $(this).data('type');

      // Update active tab
      $('.process-tab').removeClass('active');
      $(this).addClass('active').css('transform', 'scale(1.05)').animate({ 'transform': 'scale(1)' }, 200);

      // Show corresponding content with animation
      $('.process-details').fadeOut(200, function () {
        $('#process-' + type).fadeIn(300);
      });

      // Track tab selection
      trackInteraction('tab_selected', { type: type });
    });
  }

  /**
   * Initialize interactive timeline features
   */
  function initializeTimeline() {
    // Add hover effects to timeline items
    $('.timeline-item, .stage-card').hover(
      function () {
        $(this).find('.timeline-marker .marker-number, .stage-number')
          .css('transform', 'scale(1.1)')
          .css('box-shadow', '0 4px 15px rgba(0, 102, 170, 0.4)');
      },
      function () {
        $(this).find('.timeline-marker .marker-number, .stage-number')
          .css('transform', 'scale(1)')
          .css('box-shadow', '');
      }
    );

    // Add click-to-expand functionality for stage details
    $('.stage-card .stage-header').on('click', function () {
      var $card = $(this).closest('.stage-card');
      var $content = $card.find('.stage-content');

      $card.toggleClass('expanded');
      $content.slideToggle(300);

      // Rotate arrow if present
      var $arrow = $(this).find('.expand-arrow');
      if ($arrow.length) {
        $arrow.css('transform', $card.hasClass('expanded') ? 'rotate(180deg)' : 'rotate(0deg)');
      }
    });
  }

  /**
   * Initialize stage expansion functionality
   */
  function initializeStageExpansion() {
    // Add expand/collapse all button if not in compact mode
    if (!$('.rrp-process-docs').attr('data-style') || $('.rrp-process-docs').attr('data-style') !== 'compact') {
      const $expandAllBtn = $('<button class="expand-all-btn">Expand All Stages</button>');
      $expandAllBtn.css({
        'background': 'var(--primary-color)',
        'color': 'white',
        'border': 'none',
        'padding': '0.5rem 1rem',
        'border-radius': '6px',
        'cursor': 'pointer',
        'margin': '1rem 0',
        'font-size': '0.9rem'
      });

      $('.review-stages h3').after($expandAllBtn);

      $expandAllBtn.on('click', function () {
        const isExpanded = $(this).text().includes('Collapse');
        const $stages = $('.stage-card');

        if (isExpanded) {
          $stages.removeClass('expanded').find('.stage-content').slideUp(200);
          $(this).text('Expand All Stages');
        } else {
          $stages.addClass('expanded').find('.stage-content').slideDown(200);
          $(this).text('Collapse All Stages');
        }
      });
    }

    // Add expand arrows to stage headers
    $('.stage-header').each(function () {
      if (!$(this).find('.expand-arrow').length) {
        $(this).append('<span class="expand-arrow" style="margin-left: auto; transition: transform 0.3s;">▼</span>');
      }
    });
  }

  /**
   * Initialize process comparison functionality
   */
  function initializeComparison() {
    // Add comparison toggle if multiple processes are shown
    if ($('.process-tab').length > 1) {
      const $comparisonBtn = $('<button class="comparison-btn">Compare Processes</button>');
      $comparisonBtn.css({
        'background': 'var(--secondary-color)',
        'color': 'white',
        'border': 'none',
        'padding': '0.5rem 1rem',
        'border-radius': '6px',
        'cursor': 'pointer',
        'margin': '0 1rem 1rem 0',
        'font-size': '0.9rem'
      });

      $('.process-type-selector').append($comparisonBtn);

      $comparisonBtn.on('click', function () {
        toggleComparisonMode();
      });
    }
  }

  /**
   * Toggle comparison mode for multiple processes
   */
  function toggleComparisonMode() {
    const $container = $('.process-content');
    const isComparisonMode = $container.hasClass('comparison-mode');

    if (isComparisonMode) {
      // Exit comparison mode
      $container.removeClass('comparison-mode');
      $('.process-details').hide();
      $('.process-tab.active').trigger('click');
      $('.comparison-btn').text('Compare Processes');
    } else {
      // Enter comparison mode
      $container.addClass('comparison-mode');
      $('.process-details').show().css('width', '48%').css('display', 'inline-block').css('vertical-align', 'top');
      $('.comparison-btn').text('Exit Comparison');
      
      // Add comparison styles
      $container.css({
        'display': 'flex',
        'flex-wrap': 'wrap',
        'gap': '2%'
      });
    }

    trackInteraction('comparison_toggled', { mode: !isComparisonMode ? 'enabled' : 'disabled' });
  }

  /**
   * Initialize search functionality
   */
  function initializeSearch() {
    // Add search box to process overview
    if ($('.process-overview').length) {
      const searchHtml = `
        <div class="process-search" style="margin: 1rem 0 2rem 0;">
          <input type="text" id="process-search-input" placeholder="Search process stages, criteria, or outcomes..." 
                 style="width: 100%; max-width: 400px; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 1rem;">
          <button id="process-search-clear" style="margin-left: 0.5rem; padding: 0.75rem 1rem; background: var(--border-color); border: none; border-radius: 6px; cursor: pointer;">Clear</button>
        </div>
      `;
      
      $('.overview-description').after(searchHtml);

      // Search functionality
      $('#process-search-input').on('keyup', debounce(function () {
        performSearch($(this).val());
      }, 300));

      $('#process-search-clear').on('click', function () {
        $('#process-search-input').val('');
        clearSearchResults();
      });
    }
  }

  /**
   * Perform search across process documentation
   */
  function performSearch(query) {
    if (query.length < 2) {
      clearSearchResults();
      return;
    }

    query = query.toLowerCase();
    let hasResults = false;

    // Search through all visible text in stage cards and timeline items
    $('.stage-card, .timeline-item').each(function () {
      const $element = $(this);
      const text = $element.text().toLowerCase();
      
      if (text.includes(query)) {
        $element.removeClass('search-hidden').addClass('search-highlighted');
        hasResults = true;
        
        // Highlight matching text
        highlightText($element, query);
      } else {
        $element.addClass('search-hidden').removeClass('search-highlighted');
      }
    });

    // Show/hide no results message
    if (!hasResults && !$('.no-search-results').length) {
      $('.stages-container, .timeline-container').before(
        '<div class="no-search-results" style="text-align: center; padding: 2rem; color: var(--muted-text);">No results found for "' + escapeHtml(query) + '"</div>'
      );
    } else if (hasResults) {
      $('.no-search-results').remove();
    }

    trackInteraction('search_performed', { query: query, results: hasResults });
  }

  /**
   * Clear search results and highlighting
   */
  function clearSearchResults() {
    $('.stage-card, .timeline-item').removeClass('search-hidden search-highlighted');
    $('.search-highlight').contents().unwrap();
    $('.no-search-results').remove();
  }

  /**
   * Highlight matching text in search results
   */
  function highlightText($element, query) {
    // Remove existing highlights first
    $element.find('.search-highlight').contents().unwrap();
    
    // Add new highlights
    const regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
    $element.find('*').addBack().contents().filter(function () {
      return this.nodeType === Node.TEXT_NODE && this.textContent.toLowerCase().includes(query);
    }).each(function () {
      if ($(this).parent().hasClass('search-highlight')) return;
      
      const highlighted = this.textContent.replace(regex, (match) =>
        '<span class="search-highlight" style="background: yellow; padding: 2px 4px; border-radius: 3px;">' + escapeHtml(match) + '</span>');
      $(this).replaceWith(highlighted);
    });
  }

  /**
   * Initialize progress tracking simulation
   */
  function initializeProgressTracking() {
    // Add progress tracking demo button
    if ($('.process-footer').length) {
      const $progressBtn = $('<button class="progress-demo-btn" style="background: var(--success-color); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; margin: 1rem 0; font-size: 1rem;">🎯 Simulate Progress Tracking</button>');
      
      $('.helpful-info').append($progressBtn);

      $progressBtn.on('click', function () {
        simulateProgressTracking();
      });
    }
  }

  /**
   * Simulate progress tracking through stages
   */
  function simulateProgressTracking() {
    const $stages = $('.stage-card, .timeline-item');
    let currentStage = 0;

    // Reset all stages
    $stages.removeClass('stage-completed stage-current stage-pending')
           .addClass('stage-pending');

    function advanceStage() {
      if (currentStage < $stages.length) {
        // Mark previous stage as completed
        if (currentStage > 0) {
          $stages.eq(currentStage - 1).removeClass('stage-current').addClass('stage-completed');
        }

        // Mark current stage as in progress
        $stages.eq(currentStage).removeClass('stage-pending').addClass('stage-current');

        // Add visual effects
        const $currentStageCard = $stages.eq(currentStage);
        $currentStageCard.css('border-color', 'var(--warning-color)')
                        .css('box-shadow', '0 4px 15px rgba(230, 126, 34, 0.3)');

        currentStage++;

        // Continue to next stage after delay
        if (currentStage <= $stages.length) {
          setTimeout(advanceStage, 2000);
        } else {
          // Mark last stage as completed
          $stages.last().removeClass('stage-current').addClass('stage-completed');
          
          // Show completion message
          showProgressMessage('🎉 Process Complete! All stages have been successfully reviewed.');
        }
      }
    }

    showProgressMessage('📍 Starting progress simulation...');
    setTimeout(advanceStage, 1000);

    trackInteraction('progress_simulation_started');
  }

  /**
   * Show progress message
   */
  function showProgressMessage(message) {
    // Remove existing message
    $('.progress-message').remove();

    // Add new message
    const $message = $('<div class="progress-message" style="background: var(--primary-color); color: white; padding: 1rem; border-radius: 6px; margin: 1rem 0; text-align: center; animation: fadeInOut 3s ease;">' + message + '</div>');
    
    $('.process-header').after($message);

    // Auto-remove after 3 seconds
    setTimeout(() => $message.fadeOut(), 3000);
  }

  /**
   * Track user interactions for analytics
   */
  function trackInteraction(action, data = {}) {
    // Send to analytics if available
    if (typeof gtag !== 'undefined') {
      gtag('event', action, {
        'event_category': 'process_documentation',
        'event_label': JSON.stringify(data)
      });
    }

    // Console log for debugging
    console.log('Process Documentation Interaction:', action, data);
  }

  /**
   * Utility functions
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    .search-hidden {
      opacity: 0.3 !important;
      pointer-events: none;
    }
    
    .search-highlighted {
      border-color: var(--warning-color) !important;
      box-shadow: 0 0 10px rgba(230, 126, 34, 0.3) !important;
    }
    
    .stage-pending {
      opacity: 0.6;
    }
    
    .stage-current {
      border-color: var(--warning-color) !important;
      box-shadow: 0 4px 15px rgba(230, 126, 34, 0.3) !important;
      transform: scale(1.02);
    }
    
    .stage-completed {
      border-color: var(--success-color) !important;
      opacity: 1;
    }
    
    .stage-completed .stage-number,
    .stage-completed .marker-number {
      background: var(--success-color) !important;
    }
    
    .stage-completed::after {
      content: "✓";
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: var(--success-color);
      color: white;
      border-radius: 50%;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 1.2rem;
    }

    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateY(-10px); }
      20% { opacity: 1; transform: translateY(0); }
      80% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-10px); }
    }
    
    .expand-arrow {
      transition: transform 0.3s ease !important;
    }
    
    @media (max-width: 768px) {
      .comparison-mode .process-details {
        width: 100% !important;
        display: block !important;
        margin-bottom: 2rem;
      }
    }
  `;
  document.head.appendChild(style);

})();