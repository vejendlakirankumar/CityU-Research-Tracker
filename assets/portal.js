(function () {
  'use strict';

  var restBase = (window.RRP && window.RRP.restBase) ? window.RRP.restBase.replace(/\/$/, '') : '';
  var nonce = (window.RRP && window.RRP.nonce) || '';
  var isLoggedIn = (window.RRP && window.RRP.isLoggedIn) || false;
  var loginUrl = (window.RRP && window.RRP.loginUrl) || '/wp-login.php';
  var logoutUrl = (window.RRP && window.RRP.logoutUrl) || '/wp-login.php?action=logout';

  function api(method, path, body) {
    var url = restBase + path;
    var opts = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': nonce
      }
    };
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    return fetch(url, opts).then(function (r) {
      var ct = r.headers.get('Content-Type') || '';
      var next = ct.indexOf('application/json') !== -1 ? r.json() : r.text();
      return next.then(function (data) {
        if (!r.ok) throw { status: r.status, data: data };
        return data;
      });
    });
  }

  var SUBMISSION_TYPES = [
    { id: 'conference', title: 'Conference / Symposium', subtitle: 'Applied Research Symposium, Doctor of IT Forum' },
    { id: 'publication', title: 'Publication', subtitle: 'Journal and publication submissions' },
    { id: 'student', title: 'Student Project', subtitle: 'Capstone and student research' },
    { id: 'grant', title: 'Grant', subtitle: 'Funding and grant proposals' }
  ];

  var TYPE_LABEL_MAP = {
    'dissertation':    'Doctoral Dissertation',
    'capstone':        'Capstone Project',
    'student-project': 'Student Project',
    'student':         'Student Project',
    'research-paper':  'Research Paper',
    'publication':     'Publication',
    'conference':      'Conference Paper',
    'conference paper': 'Conference Paper',
    'grant':           'Grant Proposal',
    'grant-proposal':  'Grant Proposal'
  };

  function typeLabel(raw) {
    return TYPE_LABEL_MAP[(raw || '').toLowerCase()] || (raw || '—');
  }

  function statusBadgeCls(status) {
    var s = (status || '').toLowerCase().replace(/[\s_]+/g, '-');
    if (s === 'approved' || s === 'confirmed-for-presentation' || s === 'published' ||
        s === 'approved-for-submission' || s === 'accepted' || s === 'conditionally-accepted')
                                                               return 'rrp-dec-approved';
    if (s === 'rejected')                                      return 'rrp-dec-rejected';
    if (s === 'needs-revision' || s === 'revision-required'
        || s === 'revision' || s === 'needs-revision')         return 'rrp-dec-revision';
    if (s === 'revision-submitted')                            return 'rrp-dec-revision';
    if (s === 'draft')                                         return 'rrp-dec-draft';
    if (s === 'submitted')                                     return 'rrp-dec-submitted';
    if (s.indexOf('review') !== -1 || s.indexOf('in-progress') !== -1)
                                                               return 'rrp-dec-inreview';
    return 'rrp-dec-pending';
  }

  function isApprovedStatus(status) {
    var s = (status || '').toLowerCase().replace(/[\s_]+/g, '-');
    return s === 'approved' || s === 'confirmed-for-presentation' || s === 'published' ||
           s === 'approved-for-submission' || s === 'accepted' || s === 'conditionally-accepted';
  }

  var typeToApi = { conference: 'conference', publication: 'publication', student: 'student-project', grant: 'grant' };

  function getQueryParam(name) {
    var match = window.location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
  }

  // ── Student Dashboard ──────────────────────────────────────────────────────
  function renderStudentDashboard(container, activeFilter) {
    var userName   = (window.RRP && window.RRP.userName)   || 'Student';
    var userEmail  = ((window.RRP && window.RRP.userEmail) || '').toLowerCase();
    var profileUrl = (window.RRP && window.RRP.profileUrl) || '/wp-admin/profile.php';
    activeFilter   = activeFilter || 'all';

    container.innerHTML =
      '<div class="rrp-student-banner">' +
        '<div class="rrp-student-banner-info">' +
          '<div class="rrp-student-banner-title">Welcome, ' + escapeHtml(userName) + '</div>' +
          '<div class="rrp-student-banner-sub">City University of Seattle &nbsp;·&nbsp; School of Technology and Computing</div>' +
        '</div>' +
        '<button type="button" class="rrp-btn rrp-new-submission-btn" id="rrp-student-new-btn">＋ New Submission</button>' +
      '</div>' +
      '<div class="rrp-student-layout">' +
        '<div class="rrp-student-main">' +
          '<div id="rrp-student-stats" class="rrp-stats-row"><p class="rrp-loading">Loading…</p></div>' +
          '<div id="rrp-student-submissions" class="rrp-dashboard-section">' +
            '<h2>My Submissions</h2><p class="rrp-loading">Loading submissions…</p>' +
          '</div>' +
        '</div>' +
        '<aside class="rrp-student-aside">' +
          '<div class="rrp-profile-card">' +
            '<div class="rrp-profile-icon">&#128100;</div>' +
            '<div class="rrp-profile-name">' + escapeHtml(userName) + '</div>' +
            '<div class="rrp-profile-email">' + escapeHtml(userEmail) + '</div>' +
            '<div class="rrp-profile-role">Student &middot; CityU STC</div>' +
            '<a class="rrp-btn secondary" style="margin-top:0.75rem;display:block;text-align:center;" href="' + escapeHtml(profileUrl) + '">Edit Profile</a>' +
          '</div>' +
          '<div class="rrp-nav-card">' +
            '<div class="rrp-nav-card-title">Quick links</div>' +
            '<ul class="rrp-nav-list">' +
              '<li><button type="button" class="rrp-nav-link" data-view="analytics">&#128202; Analytics</button></li>' +
              '<li><button type="button" class="rrp-nav-link" data-view="public">&#127760; Public submissions</button></li>' +
            '</ul>' +
          '</div>' +
        '</aside>' +
      '</div>';

    document.getElementById('rrp-student-new-btn').addEventListener('click', function () {
      renderStudentForm(container);
    });

    container.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view');
        if (view === 'analytics') renderAnalytics(container, function () { renderStudentDashboard(container); });
        if (view === 'public')    renderPublic(container,    function () { renderStudentDashboard(container); });
      });
    });

    // Load student's own submissions
    api('GET', '/submissions')
      .then(function (res) {
        var all  = res.submissions || [];
        var mine = all.filter(function (s) {
          return (s.submitterEmail || '').toLowerCase() === userEmail;
        });

        var total    = mine.length;
        var inReview = mine.filter(function (s) { var st = (s.status || '').toLowerCase(); return st !== 'draft' && !isApprovedStatus(s.status) && st !== 'rejected'; }).length;
        var approved = mine.filter(function (s) { return isApprovedStatus(s.status); }).length;
        var drafts   = mine.filter(function (s) { return (s.status || '').toLowerCase() === 'draft'; }).length;

        document.getElementById('rrp-student-stats').innerHTML =
          '<button class="rrp-stat-card' + (activeFilter === 'all' ? ' rrp-stat-active' : '') + '" data-stat-filter="all">' +
            '<span class="rrp-stat-value">' + total + '</span>' +
            '<span class="rrp-stat-label">Total</span>' +
          '</button>' +
          '<button class="rrp-stat-card rrp-stat-blue' + (activeFilter === 'inreview' ? ' rrp-stat-active' : '') + '" data-stat-filter="inreview">' +
            '<span class="rrp-stat-value">' + inReview + '</span>' +
            '<span class="rrp-stat-label">In Review</span>' +
          '</button>' +
          '<button class="rrp-stat-card rrp-stat-green' + (activeFilter === 'approved' ? ' rrp-stat-active' : '') + '" data-stat-filter="approved">' +
            '<span class="rrp-stat-value">' + approved + '</span>' +
            '<span class="rrp-stat-label">Approved</span>' +
          '</button>' +
          '<button class="rrp-stat-card rrp-stat-muted' + (activeFilter === 'draft' ? ' rrp-stat-active' : '') + '" data-stat-filter="draft">' +
            '<span class="rrp-stat-value">' + drafts + '</span>' +
            '<span class="rrp-stat-label">Drafts</span>' +
          '</button>';

        // Stat card click → filter list
        document.querySelectorAll('[data-stat-filter]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var f = btn.getAttribute('data-stat-filter');
            renderSubmissionList(mine, f);
            document.querySelectorAll('[data-stat-filter]').forEach(function (b) {
              b.classList.toggle('rrp-stat-active', b.getAttribute('data-stat-filter') === f);
            });
          });
        });

        renderSubmissionList(mine, activeFilter);
      })
      .catch(function () {
        document.getElementById('rrp-student-stats').innerHTML = '<div class="rrp-error">Unable to load your submissions.</div>';
      });

    function renderSubmissionList(mine, filter) {
      var filtered = mine;
      if (filter === 'inreview') {
        filtered = mine.filter(function (s) { var st = (s.status || '').toLowerCase(); return st !== 'draft' && st !== 'approved' && st !== 'rejected'; });
      } else if (filter === 'approved') {
        filtered = mine.filter(function (s) { return isApprovedStatus(s.status); });
      } else if (filter === 'draft') {
        filtered = mine.filter(function (s) { return (s.status || '').toLowerCase() === 'draft'; });
      }

      var listEl = document.getElementById('rrp-student-submissions');
      var heading = filter === 'inreview' ? 'Under Review' :
                    filter === 'approved' ? 'Approved' :
                    filter === 'draft'    ? 'Drafts' : 'All Submissions';

      if (filtered.length === 0) {
        listEl.innerHTML =
          '<h2>' + heading + '</h2>' +
          '<div class="rrp-empty-state">' +
            '<p>' + (mine.length === 0 ? 'You have no submissions yet.' : 'No submissions match this filter.') + '</p>' +
            (mine.length === 0 ? '<button type="button" class="rrp-btn" id="rrp-empty-new-btn">＋ Make your first submission</button>' : '') +
          '</div>';
        var emptyBtn = document.getElementById('rrp-empty-new-btn');
        if (emptyBtn) emptyBtn.addEventListener('click', function () { renderStudentForm(container); });
        return;
      }

      listEl.innerHTML =
        '<h2>' + heading + ' <span class="rrp-count-badge">' + filtered.length + '</span></h2>' +
        '<ul class="rrp-list rrp-submissions-list">' +
        filtered.map(function (s) {
          var firstReviewer = '';
          (s.reviewStages || []).forEach(function (rs) {
            if (!firstReviewer && rs.reviewers && rs.reviewers.length) {
              firstReviewer = rs.reviewers[0].name || rs.reviewers[0].email;
            }
          });
          return '<li class="rrp-sub-item">' +
            '<div class="rrp-sub-item-header">' +
              '<strong>' + escapeHtml(s.title || 'Untitled') + '</strong>' +
              '<span class="rrp-decision-badge ' + statusBadgeCls(s.status) + '">' + escapeHtml(s.status || 'Submitted') + '</span>' +
            '</div>' +
            '<div class="rrp-sub-item-meta">' +
              '<span class="rrp-meta-id"><span class="rrp-meta-lbl">ID</span>' + escapeHtml(s.id) + '</span>' +
              '<span><span class="rrp-meta-lbl">Category</span>' + escapeHtml(typeLabel(s.submissionType || s.type)) + '</span>' +
              (s.createdAt ? '<span><span class="rrp-meta-lbl">Submitted</span>' + new Date(s.createdAt).toLocaleDateString() + '</span>' : '') +
              (firstReviewer ? '<span><span class="rrp-meta-lbl">Reviewer</span>' + escapeHtml(firstReviewer) + '</span>' : '') +
            '</div>' +
            '<div class="rrp-sub-item-actions">' +
              '<button type="button" class="rrp-btn secondary" data-detail="' + escapeHtml(s.id) + '">View Details</button>' +
            '</div>' +
            '</li>';
        }).join('') +
        '</ul>';

      listEl.querySelectorAll('[data-detail]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          renderSubmissionDetail(btn.getAttribute('data-detail'), container, function () { renderStudentDashboard(container); });
        });
      });
    }
  }

  // ── Simplified Student Submission Form ────────────────────────────────────
  function renderStudentForm(container) {
    var userName  = (window.RRP && window.RRP.userName)  || '';
    var userEmail = (window.RRP && window.RRP.userEmail) || '';

    var studentTypeMap = {
      'dissertation':    'student-project',
      'capstone':        'student-project',
      'research-paper':  'publication',
      'grant-proposal':  'grant'
    };

    var STUDENT_FORM_TYPES = {
      'dissertation':   'Doctoral Dissertation',
      'capstone':       'Capstone Project',
      'research-paper': 'Research Paper',
      'grant-proposal': 'Grant Proposal'
    };
    var allowedTypes = (window.RRP && window.RRP.allowedTypes && window.RRP.allowedTypes.length)
      ? window.RRP.allowedTypes
      : Object.keys(STUDENT_FORM_TYPES);
    var typeOptions = allowedTypes.map(function (t) {
      return '<option value="' + t + '">' + (STUDENT_FORM_TYPES[t] || t) + '</option>';
    }).join('');

    container.innerHTML =
      '<h1>New Submission</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom:1rem;" data-back>&#8592; Back to Dashboard</button>' +
      '<div id="rrp-form-errors"></div>' +
      '<form id="rrp-submit-form" novalidate>' +
        '<div class="rrp-form-block">' +
          '<label>Submission type *</label>' +
          '<select name="submissionType" required>' +
            '<option value="">&#8212; select type &#8212;</option>' +
            typeOptions +
          '</select>' +
        '</div>' +
        '<div class="rrp-form-block">' +
          '<label>Title * <span class="rrp-hint">(max 200 characters)</span></label>' +
          '<input type="text" name="title" required maxlength="200">' +
          '<span class="rrp-counter" id="rrp-title-counter">0 / 200</span>' +
        '</div>' +
        '<div class="rrp-form-block">' +
          '<label>Research area *</label>' +
          '<input type="text" name="researchArea" required placeholder="e.g. Computer Science, Business Administration&#8230;">' +
        '</div>' +
        '<div class="rrp-form-block">' +
          '<label>Document <span class="rrp-hint">(PDF, DOC, DOCX, TXT &#8211; max 2 MB)</span></label>' +
          '<input type="file" name="files" id="rrp-file-input" accept=".pdf,.doc,.docx,.txt">' +
          '<div id="rrp-file-list" class="rrp-file-list"></div>' +
        '</div>' +
        '<div class="rrp-form-actions">' +
          '<button type="submit" class="rrp-btn" id="rrp-submit-btn">Submit</button>' +
          '<button type="button" class="rrp-btn secondary" id="rrp-draft-btn">Save draft</button>' +
        '</div>' +
      '</form>';

    container.querySelector('[data-back]').addEventListener('click', function () { renderStudentDashboard(container); });

    var form = document.getElementById('rrp-submit-form');

    // Live title counter
    var titleInput   = form.querySelector('[name="title"]');
    var titleCounter = document.getElementById('rrp-title-counter');
    titleInput.addEventListener('input', function () {
      var len = titleInput.value.length;
      titleCounter.textContent = len + ' / 200';
      titleCounter.className = 'rrp-counter' + (len > 190 ? ' rrp-counter-warn' : (len > 0 ? ' rrp-counter-ok' : ''));
    });

    // File list preview
    var fileInput  = document.getElementById('rrp-file-input');
    var fileListEl = document.getElementById('rrp-file-list');
    fileInput.addEventListener('change', function () {
      var files = Array.from(fileInput.files || []);
      fileListEl.innerHTML = files.map(function (f) {
        var mb = (f.size / 1024 / 1024).toFixed(2);
        var ok = f.size <= 2 * 1024 * 1024;
        return '<div class="rrp-file-item' + (!ok ? ' rrp-file-item-warn' : '') + '">' +
          escapeHtml(f.name) + ' (' + mb + ' MB)' + (!ok ? ' &#9888; exceeds 2 MB limit' : '') + '</div>';
      }).join('');
    });

    // Save draft
    document.getElementById('rrp-draft-btn').addEventListener('click', function () {
      var fd   = new FormData(form);
      var sType = fd.get('submissionType') || '';
      var body  = {
        type:           studentTypeMap[sType] || 'student-project',
        submissionType: sType,
        title:          fd.get('title')        || '',
        researchArea:   fd.get('researchArea') || '',
        submitterName:  userName,
        submitterEmail: userEmail,
        affiliation:    'City University of Seattle',
        status:         'draft'
      };
      var errEl = document.getElementById('rrp-form-errors');
      api('POST', '/submit', body)
        .then(function (res) {
          errEl.innerHTML = '<div class="rrp-info">Draft saved. Reference: <strong>' + escapeHtml(res.id) + '</strong></div>';
        })
        .catch(function () {
          errEl.innerHTML = '<div class="rrp-info">Draft saved locally (server unavailable).</div>';
        });
    });

    // Submit
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = document.getElementById('rrp-form-errors');
      errEl.innerHTML = '';
      var fd    = new FormData(form);
      var sType = fd.get('submissionType') || '';
      var title = (fd.get('title') || '').trim();

      if (!sType)  { errEl.innerHTML = '<div class="rrp-error">Please select a submission type.</div>'; return; }
      if (!title)  { errEl.innerHTML = '<div class="rrp-error">Title is required.</div>'; return; }
      if (!(fd.get('researchArea') || '').trim()) { errEl.innerHTML = '<div class="rrp-error">Research area is required.</div>'; return; }

      var body = {
        type:           studentTypeMap[sType] || 'student-project',
        submissionType: sType,
        title:          title,
        researchArea:   (fd.get('researchArea') || '').trim(),
        submitterName:  userName,
        submitterEmail: userEmail,
        affiliation:    'City University of Seattle'
      };

      var submitBtn = document.getElementById('rrp-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting\u2026';

      api('POST', '/submit', body)
        .then(function (res) {
          var files = fileInput.files;
          if (files && files.length > 0 && res.id) {
            var fileData = new FormData();
            for (var i = 0; i < files.length; i++) { fileData.append('files[]', files[i]); }
            return fetch(restBase + '/submissions/' + encodeURIComponent(res.id) + '/attachments', {
              method: 'POST',
              headers: { 'X-WP-Nonce': nonce },
              body: fileData
            }).then(function () { return res; });
          }
          return res;
        })
        .then(function (res) {
          container.innerHTML =
            '<div class="rrp-student-success">' +
              '<div class="rrp-success-icon">&#10003;</div>' +
              '<h1>Submission received!</h1>' +
              '<p>' + escapeHtml(res.message || 'Your submission has been received successfully.') + '</p>' +
              '<p><strong>Reference ID:</strong> <code>' + escapeHtml(res.id) + '</code></p>' +
              '<p>A confirmation will be sent to <strong>' + escapeHtml(userEmail) + '</strong>. Track status on your dashboard.</p>' +
              '<button type="button" class="rrp-btn" id="rrp-back-dashboard">&#8592; Back to Dashboard</button>' +
            '</div>';
          document.getElementById('rrp-back-dashboard').addEventListener('click', function () { renderStudentDashboard(container); });
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
          var msg = (err.data && err.data.errors && err.data.errors.length)
            ? err.data.errors.join(' ')
            : ((err.data && err.data.error) || 'Submission failed. Please try again.');
          errEl.innerHTML = '<div class="rrp-error">' + escapeHtml(msg) + '</div>';
        });
    });
  }

  // ── Coordinator / Admin Dashboard ─────────────────────────────────────────
  function renderCoordinatorDashboard(container, activeFilter) {
    var userName   = (window.RRP && window.RRP.userName)   || 'Coordinator';
    var userRole   = (window.RRP && window.RRP.userRole)   || 'Coordinator';
    var profileUrl = (window.RRP && window.RRP.profileUrl) || '/wp-admin/profile.php';
    activeFilter   = activeFilter || 'all';

    // Stage labels per submission type (for the assignment UI)
    var TYPE_STAGES = {
      'dissertation':    ['Chair Review', 'Committee Review', 'Program Director Approval', 'Dissertation Director Sign-Off'],
      'capstone':        ['Advisor Review', 'Program Director Approval'],
      'student-project': ['Advisor Review', 'Program Director Approval'],
      'research-paper':  ['Peer Review', 'Program Director Approval'],
      'publication':     ['Peer Review', 'Program Director Approval'],
      'conference':      ['Peer Review', 'Program Director Approval'],
      'grant':           ['Multi-Criteria Review', 'Program Director Approval'],
      'grant-proposal':  ['Multi-Criteria Review', 'Program Director Approval']
    };
    var DEFAULT_STAGES = ['Initial Review', 'Final Approval'];

    function stagesForSub(sub) {
      var key = (sub.submissionType || sub.type || '').toLowerCase().replace(/\s+/g, '-');
      return TYPE_STAGES[key] || TYPE_STAGES[sub.type] || DEFAULT_STAGES;
    }

    container.innerHTML =
      '<div class="rrp-student-banner rrp-coordinator-banner">' +
        '<div class="rrp-student-banner-info">' +
          '<div class="rrp-student-banner-title">Welcome, ' + escapeHtml(userName) + '</div>' +
          '<div class="rrp-student-banner-sub">City University of Seattle &nbsp;&middot;&nbsp; ' + escapeHtml(userRole) + ' &mdash; Research Review Portal</div>' +
        '</div>' +
        '<button type="button" class="rrp-btn rrp-new-submission-btn" id="rrp-coord-auto-assign-btn">&#9881; Auto-assign All</button>' +
      '</div>' +
      '<div class="rrp-student-layout">' +
        '<div class="rrp-student-main">' +
          '<div id="rrp-coord-stats" class="rrp-stats-row"><p class="rrp-loading">Loading&hellip;</p></div>' +
          '<div id="rrp-coord-submissions" class="rrp-dashboard-section">' +
            '<h2>All Submissions</h2><p class="rrp-loading">Loading&hellip;</p>' +
          '</div>' +
        '</div>' +
        '<aside class="rrp-student-aside">' +
          '<div class="rrp-profile-card">' +
            '<div class="rrp-profile-icon">&#128101;</div>' +
            '<div class="rrp-profile-name">' + escapeHtml(userName) + '</div>' +
            '<div class="rrp-profile-role rrp-profile-role-coord">' + escapeHtml(userRole) + ' &middot; CityU STC</div>' +
            '<a class="rrp-btn secondary" style="margin-top:0.75rem;display:block;text-align:center;" href="' + escapeHtml(profileUrl) + '">Edit Profile</a>' +
          '</div>' +
          '<div class="rrp-nav-card">' +
            '<div class="rrp-nav-card-title">Quick links</div>' +
            '<ul class="rrp-nav-list">' +
              '<li><button type="button" class="rrp-nav-link" data-view="students">&#127891; Students</button></li>' +
              '<li><button type="button" class="rrp-nav-link" data-view="reviewers">&#128101; Reviewers</button></li>' +
              '<li><button type="button" class="rrp-nav-link" data-view="programs">&#127979; Programs</button></li>' +
              '<li><button type="button" class="rrp-nav-link" data-view="analytics">&#128202; Analytics</button></li>' +
              '<li><button type="button" class="rrp-nav-link" data-view="overdue">&#128680; Overdue Submissions</button></li>' +
              '<li><button type="button" class="rrp-nav-link" data-view="public">&#127760; Public submissions</button></li>' +
            '</ul>' +
          '</div>' +
          '<div id="rrp-coord-reviewer-pool"></div>' +
        '</aside>' +
      '</div>' +
      // Inline assignment panel (hidden until triggered)
      '<div id="rrp-coord-assign-panel" style="display:none;" class="rrp-assign-panel"></div>';

    // Quick-nav links
    container.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view');
        if (view === 'analytics') renderAnalytics(container, function () { renderCoordinatorDashboard(container); });
        if (view === 'public')    renderPublic(container,    function () { renderCoordinatorDashboard(container); });
        if (view === 'overdue')   renderOverdue(container);
        if (view === 'students')  renderStudentManagement(container, function () { renderCoordinatorDashboard(container); });
        if (view === 'reviewers') renderReviewerManagement(container, function () { renderCoordinatorDashboard(container); });
        if (view === 'programs')  renderProgramManagement(container, function () { renderCoordinatorDashboard(container); });
      });
    });

    // Manage Reviewer Pool toggle — removed (use Reviewers quick link instead)

    // Auto-assign all submissions
    document.getElementById('rrp-coord-auto-assign-btn').addEventListener('click', function () {
      if (!confirm('Auto-assign reviewers from pool to all unassigned submissions?\n\nExisting assignments will not be overwritten.')) return;
      var btn = document.getElementById('rrp-coord-auto-assign-btn');
      btn.disabled = true; btn.textContent = 'Assigning\u2026';
      api('POST', '/config/apply-pool-to-submissions', {})
        .then(function (res) {
          btn.disabled = false; btn.textContent = '\u2699 Auto-assign All';
          alert('Done. Applied: ' + (res.applied || 0) + ', Skipped: ' + (res.skipped || 0) + ' of ' + (res.total || 0) + ' total.');
          renderCoordinatorDashboard(container, activeFilter);
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = '\u2699 Auto-assign All';
          alert('Auto-assign failed. Please try again.');
        });
    });

    // Load all submissions + assignment summary in parallel
    Promise.all([
      api('GET', '/submissions'),
      api('GET', '/assignment-summary')
    ]).then(function (results) {
      var all   = results[0].submissions || [];
      var summary = {};
      (results[1].submissions || []).forEach(function (s) { summary[s.id] = s; });

      var unassigned = all.filter(function (s) {
        var sum = summary[s.id];
        if (!sum) return true;
        return !(sum.reviewStages || []).some(function (st) { return (st.reviewers || []).length > 0; });
      }).length;
      var inReview = all.filter(function (s) {
        var st = (s.status || '').toLowerCase();
        return st !== 'draft' && !isApprovedStatus(s.status) && st !== 'rejected' && st !== 'submitted';
      }).length;
      var approved = all.filter(function (s) { return isApprovedStatus(s.status); }).length;

      document.getElementById('rrp-coord-stats').innerHTML =
        '<button class="rrp-stat-card'       + (activeFilter === 'all'        ? ' rrp-stat-active' : '') + '" data-stat-filter="all">' +
          '<span class="rrp-stat-value">' + all.length + '</span><span class="rrp-stat-label">Total</span>' +
        '</button>' +
        '<button class="rrp-stat-card rrp-stat-warn'  + (activeFilter === 'unassigned' ? ' rrp-stat-active' : '') + '" data-stat-filter="unassigned">' +
          '<span class="rrp-stat-value">' + unassigned + '</span><span class="rrp-stat-label">Needs Assignment</span>' +
        '</button>' +
        '<button class="rrp-stat-card rrp-stat-blue'  + (activeFilter === 'inreview'   ? ' rrp-stat-active' : '') + '" data-stat-filter="inreview">' +
          '<span class="rrp-stat-value">' + inReview   + '</span><span class="rrp-stat-label">In Review</span>' +
        '</button>' +
        '<button class="rrp-stat-card rrp-stat-green' + (activeFilter === 'approved'   ? ' rrp-stat-active' : '') + '" data-stat-filter="approved">' +
          '<span class="rrp-stat-value">' + approved   + '</span><span class="rrp-stat-label">Approved</span>' +
        '</button>';

      document.querySelectorAll('[data-stat-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var f = btn.getAttribute('data-stat-filter');
          renderSubmissionList(all, summary, f);
          document.querySelectorAll('[data-stat-filter]').forEach(function (b) {
            b.classList.toggle('rrp-stat-active', b.getAttribute('data-stat-filter') === f);
          });
        });
      });

      renderSubmissionList(all, summary, activeFilter);

    }).catch(function () {
      document.getElementById('rrp-coord-stats').innerHTML = '<div class="rrp-error">Unable to load submissions.</div>';
    });

    function renderSubmissionList(all, summary, filter) {
      var filtered = all;
      if (filter === 'unassigned') {
        filtered = all.filter(function (s) {
          var sum = summary[s.id];
          if (!sum) return true;
          return !(sum.reviewStages || []).some(function (st) { return (st.reviewers || []).length > 0; });
        });
      } else if (filter === 'inreview') {
        filtered = all.filter(function (s) {
          var st = (s.status || '').toLowerCase();
          return st !== 'draft' && st !== 'approved' && st !== 'rejected' && st !== 'submitted';
        });
      } else if (filter === 'approved') {
        filtered = all.filter(function (s) { return isApprovedStatus(s.status); });
      }

      var heading = filter === 'unassigned' ? 'Needs Assignment' :
                    filter === 'inreview'   ? 'In Review' :
                    filter === 'approved'   ? 'Approved' : 'All Submissions';

      var listEl = document.getElementById('rrp-coord-submissions');
      if (!listEl) return;

      if (filtered.length === 0) {
        listEl.innerHTML = '<h2>' + heading + '</h2><div class="rrp-empty-state"><p>No submissions match this filter.</p></div>';
        return;
      }

      listEl.innerHTML =
        '<h2>' + heading + ' <span class="rrp-count-badge">' + filtered.length + '</span></h2>' +
        '<ul class="rrp-list rrp-submissions-list">' +
        filtered.map(function (s) {
          var sum = summary[s.id];
          var hasAssignment = sum && (sum.reviewStages || []).some(function (rs) { return (rs.reviewers || []).length > 0; });
          var firstReviewer = '';
          var currentStage  = '';
          if (sum) {
            (sum.reviewStages || []).forEach(function (rs) {
              if (!firstReviewer && rs.reviewers && rs.reviewers.length) {
                firstReviewer = rs.reviewers[0].name || rs.reviewers[0].email;
                currentStage  = rs.stageName;
              }
            });
          }
          return '<li class="rrp-sub-item">' +
            '<div class="rrp-sub-item-header">' +
              '<strong>' + escapeHtml(s.title || 'Untitled') + '</strong>' +
              '<span class="rrp-decision-badge ' + statusBadgeCls(s.status) + '">' + escapeHtml(s.status || 'Submitted') + '</span>' +
            '</div>' +
            '<div class="rrp-sub-item-meta">' +
              '<span class="rrp-meta-id"><span class="rrp-meta-lbl">ID</span>' + escapeHtml(s.id) + '</span>' +
              '<span><span class="rrp-meta-lbl">Category</span>' + escapeHtml(typeLabel(s.submissionType || s.type)) + '</span>' +
              '<span><span class="rrp-meta-lbl">Submitted by</span>' + escapeHtml(s.submitterName || s.submitterEmail || '\u2014') + '</span>' +
              (s.createdAt ? '<span><span class="rrp-meta-lbl">Date</span>' + new Date(s.createdAt).toLocaleDateString() + '</span>' : '') +
            '</div>' +
            (firstReviewer || !hasAssignment ?
              '<div class="rrp-sub-item-review-info">' +
                (firstReviewer
                  ? '<span>&#128100; <span class="rrp-meta-lbl">Reviewer &mdash;</span> ' + escapeHtml(firstReviewer) + '</span>' +
                    (currentStage ? '<span>&#128196; <span class="rrp-meta-lbl">Stage &mdash;</span> ' + escapeHtml(currentStage) + '</span>' : '')
                  : '<span class="rrp-review-unassigned">&#9888; Not yet assigned</span>') +
              '</div>' : '') +
            '<div class="rrp-sub-item-actions">' +
              '<button type="button" class="rrp-btn secondary" data-detail="' + escapeHtml(s.id) + '">View</button>' +
              '<button type="button" class="rrp-btn' + (hasAssignment ? ' secondary' : '') + '" data-assign="' + escapeHtml(s.id) + '">' +
                (hasAssignment ? '&#9998; Edit Assignment' : '&#43; Assign Reviewers') +
              '</button>' +
            '</div>' +
          '</li>';
        }).join('') +
        '</ul>';

      listEl.querySelectorAll('[data-detail]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          renderSubmissionDetail(btn.getAttribute('data-detail'), container, function () { renderCoordinatorDashboard(container); });
        });
      });
      listEl.querySelectorAll('[data-assign]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var subId = btn.getAttribute('data-assign');
          var sub   = all.find(function (s) { return s.id === subId; });
          openAssignPanel(sub, summary[subId]);
        });
      });
    }

    function openAssignPanel(sub, summaryEntry) {
      var panel = document.getElementById('rrp-coord-assign-panel');
      panel.style.display = '';
      panel.innerHTML = '<p class="rrp-loading">Loading reviewers&hellip;</p>';
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

      api('GET', '/reviewers')
        .then(function (res) {
          var reviewers = res.reviewers || [];
          var stages    = stagesForSub(sub);
          var existing  = {};
          ((summaryEntry && summaryEntry.reviewStages) || []).forEach(function (rs) {
            existing[rs.stageName] = (rs.reviewers || []).map(function (r) { return r.email; });
          });

          panel.innerHTML =
            '<div class="rrp-assign-panel-inner">' +
              '<div class="rrp-assign-panel-header">' +
                '<h2>Assign Reviewers &mdash; <span style="font-weight:400;">' + escapeHtml(sub.title || sub.id) + '</span></h2>' +
                '<div class="rrp-assign-panel-meta">' +
                  '<span><strong>ID:</strong> ' + escapeHtml(sub.id) + '</span>' +
                  '<span><strong>Type:</strong> ' + escapeHtml(typeLabel(sub.submissionType || sub.type) || '\u2014') + '</span>' +
                  '<span><strong>Submitted by:</strong> ' + escapeHtml(sub.submitterName || sub.submitterEmail || '\u2014') + '</span>' +
                  '<span><strong>Status:</strong> ' + escapeHtml(sub.status || '\u2014') + '</span>' +
                '</div>' +
              '</div>' +
              '<div id="rrp-assign-stages">' +
                stages.map(function (stageName) {
                  var currentEmails = existing[stageName] || [];
                  return '<div class="rrp-assign-stage" data-stage="' + escapeHtml(stageName) + '">' +
                    '<h3 class="rrp-assign-stage-title">' + escapeHtml(stageName) + '</h3>' +
                    '<div class="rrp-assign-reviewer-grid">' +
                    reviewers.map(function (r) {
                      var checked = currentEmails.indexOf(r.email) !== -1;
                      return '<label class="rrp-reviewer-chip' + (checked ? ' rrp-reviewer-chip-checked' : '') + '">' +
                        '<input type="checkbox" value="' + escapeHtml(r.email) + '" data-name="' + escapeHtml(r.name || r.email) + '" data-id="' + escapeHtml(r.id || '') + '"' + (checked ? ' checked' : '') + '>' +
                        '<span>' + escapeHtml(r.name || r.email) + '<small>' + escapeHtml(r.email) + '</small></span>' +
                      '</label>';
                    }).join('') +
                    (reviewers.length === 0 ? '<p style="color:var(--rrp-text-muted);font-size:.85rem;">No reviewers in pool for this submission type.<br>Add reviewers via <em>Manage Reviewer Pool</em> or update <code>data/reviewers.json</code>.</p>' : '') +
                    '</div>' +
                  '</div>';
                }).join('') +
              '</div>' +
              '<div class="rrp-assign-panel-actions">' +
                '<button type="button" class="rrp-btn" id="rrp-assign-save-btn">&#10003; Save Assignment</button>' +
                '<button type="button" class="rrp-btn secondary" id="rrp-assign-cancel-btn">Cancel</button>' +
                '<span id="rrp-assign-msg" style="margin-left:1rem;"></span>' +
              '</div>' +
            '</div>';

          // Toggle chip style on check
          panel.querySelectorAll('.rrp-reviewer-chip input').forEach(function (cb) {
            cb.addEventListener('change', function () {
              cb.closest('.rrp-reviewer-chip').classList.toggle('rrp-reviewer-chip-checked', cb.checked);
            });
          });

          document.getElementById('rrp-assign-cancel-btn').addEventListener('click', function () {
            panel.style.display = 'none';
            panel.innerHTML = '';
          });

          document.getElementById('rrp-assign-save-btn').addEventListener('click', function () {
            var msgEl  = document.getElementById('rrp-assign-msg');
            var stageData = [];
            panel.querySelectorAll('[data-stage]').forEach(function (stageEl) {
              var stageName = stageEl.getAttribute('data-stage');
              var selected  = [];
              stageEl.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) {
                selected.push({ id: cb.getAttribute('data-id'), name: cb.getAttribute('data-name'), email: cb.value });
              });
              stageData.push({ stageName: stageName, reviewers: selected });
            });

            msgEl.innerHTML = '<span class="rrp-loading">Saving\u2026</span>';
            var saveBtn = document.getElementById('rrp-assign-save-btn');
            saveBtn.disabled = true;

            api('PATCH', '/submissions/' + encodeURIComponent(sub.id), { reviewStages: stageData })
              .then(function () {
                msgEl.innerHTML = '<span class="rrp-success">Assignment saved.</span>';
                // Notify reviewers if new ones were added
                return api('POST', '/submissions/' + encodeURIComponent(sub.id) + '/skip-stage', { notifyOnly: true }).catch(function () {});
              })
              .then(function () {
                setTimeout(function () {
                  panel.style.display = 'none';
                  panel.innerHTML = '';
                  renderCoordinatorDashboard(container, activeFilter);
                }, 1200);
              })
              .catch(function (err) {
                saveBtn.disabled = false;
                msgEl.innerHTML = '<span class="rrp-error">' + escapeHtml((err.data && err.data.error) || 'Save failed.') + '</span>';
              });
          });
        })
        .catch(function () {
          panel.innerHTML = '<div class="rrp-error">Unable to load reviewer list.</div>';
        });
    }

    function renderOverdue(container) {
      container.innerHTML =
        '<h1>Overdue Submissions</h1>' +
        '<button type="button" class="rrp-btn secondary" style="margin-bottom:1rem;" data-back>&#8592; Back</button>' +
        '<div id="rrp-overdue-content"><p class="rrp-loading">Loading&hellip;</p></div>';
      container.querySelector('[data-back]').addEventListener('click', function () { renderCoordinatorDashboard(container); });
      api('GET', '/analytics/overdue')
        .then(function (res) {
          var list = res.overdue || [];
          var el   = document.getElementById('rrp-overdue-content');
          if (!list.length) { el.innerHTML = '<p>No overdue submissions. &#127881;</p>'; return; }
          el.innerHTML =
            '<ul class="rrp-list rrp-submissions-list">' +
            list.map(function (s) {
              return '<li class="rrp-sub-item">' +
                '<div class="rrp-sub-item-header">' +
                  '<strong>' + escapeHtml(s.title || s.id) + '</strong>' +
                  '<span class="rrp-decision-badge rrp-dec-rejected">Overdue</span>' +
                '</div>' +
                '<div class="rrp-sub-item-meta">' +
                  '<span>' + escapeHtml(s.id) + '</span>' +
                  '<span>' + escapeHtml(typeLabel(s.submissionType || s.type)) + '</span>' +
                  '<span>' + escapeHtml(s.submitterEmail || '') + '</span>' +
                '</div>' +
                '<button type="button" class="rrp-btn secondary" data-detail="' + escapeHtml(s.id) + '">View</button>' +
              '</li>';
            }).join('') +
            '</ul>';
          el.querySelectorAll('[data-detail]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              renderSubmissionDetail(btn.getAttribute('data-detail'), container, function () { renderCoordinatorDashboard(container); });
            });
          });
        })
        .catch(function () {
          document.getElementById('rrp-overdue-content').innerHTML = '<div class="rrp-error">Unable to load overdue data.</div>';
        });
    }
  }

  function renderSelection(container) {
    if (!isLoggedIn) {
      container.innerHTML =
        '<div class="rrp-user-banner rrp-user-banner-guest">' +
          '<span>You are not logged in. Please <a href="' + escapeHtml(loginUrl) + '">log in</a> to submit and track your research.</span>' +
          '<a class="rrp-btn" href="' + escapeHtml(loginUrl) + '">Log in</a>' +
        '</div>' +
        '<h1>Research Submission Process</h1>' +
        '<p class="rrp-info">Select a submission type below to view the process details.</p>' +
        '<p class="rrp-info">If you do not have an account, contact your administrator.</p>' +
        '<div style="margin-top:1rem;"><a class="rrp-btn" href="/">View process documentation</a></div>';
      return;
    }

    var headerBanner = '<div class="rrp-user-banner rrp-user-banner-loggedin">' +
      '<span>Logged in as <strong>' + escapeHtml(window.RRP.userName || 'Unknown') + '</strong> (' + escapeHtml(window.RRP.userRole || 'User') + ')</span>' +
      '<a href="' + escapeHtml(logoutUrl) + '" class="rrp-btn secondary">Logout</a>' +
      '</div>';

    container.innerHTML = headerBanner +
      '<h1>Research Review Portal</h1>' +
      '<p style="color: var(--rrp-text-muted); margin-bottom: 1rem;">Choose a submission type to get started.</p>' +
      '<div class="rrp-type-cards" id="rrp-type-cards"></div>' +
      '<div class="rrp-view-toggle" style="margin-top: 1.5rem;">' +
        '<button type="button" class="rrp-btn secondary" data-view="submit">Submit new abstract</button>' +
        '<button type="button" class="rrp-btn secondary" data-view="status">Check my submissions</button>' +
        '<button type="button" class="rrp-btn secondary" data-view="dashboard">Dashboard</button>' +
        '<button type="button" class="rrp-btn secondary" data-view="analytics">Analytics</button>' +
        '<button type="button" class="rrp-btn secondary" data-view="reviewer">Reviewer Dashboard</button>' +
        '<button type="button" class="rrp-btn secondary" data-view="public">Research & symposium (public)</button>' +
      '</div>';

    var cards = document.getElementById('rrp-type-cards');
    SUBMISSION_TYPES.forEach(function (t) {
      var div = document.createElement('div');
      div.className = 'rrp-type-card';
      div.dataset.type = t.id;
      div.innerHTML = '<h3>' + escapeHtml(t.title) + '</h3><p>' + escapeHtml(t.subtitle) + '</p>';
      div.addEventListener('click', function () {
        container.querySelectorAll('.rrp-type-card').forEach(function (c) { c.classList.remove('selected'); });
        div.classList.add('selected');
        container.dataset.selectedType = t.id;
      });
      cards.appendChild(div);
    });

    container.querySelectorAll('.rrp-view-toggle [data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.dataset.view;
        if (view === 'submit') {
          var type = container.dataset.selectedType || 'conference';
          renderForm(container, type);
        } else if (view === 'status') {
          renderStatus(container);
        } else if (view === 'dashboard') {
          renderDashboard(container);
        } else if (view === 'analytics') {
          renderAnalytics(container);
        } else if (view === 'reviewer') {
          renderReviewerDashboard(container);
        } else {
          renderPublic(container);
        }
      });
    });

    var startMode = getQueryParam('start');
    if (startMode) {
      if (['submit', 'status', 'dashboard', 'analytics', 'reviewer', 'public'].indexOf(startMode) !== -1) {
        container.querySelector('.rrp-view-toggle [data-view="' + startMode + '"]').click();
        return;
      }
      if (SUBMISSION_TYPES.some(function (t) { return t.id === startMode; })) {
        var selectedCard = container.querySelector('.rrp-type-card[data-type="' + startMode + '"]');
        if (selectedCard) {
          selectedCard.click();
        }
      }
    }

    // select first type by default
    if (!container.dataset.selectedType) {
      var firstCard = container.querySelector('.rrp-type-card');
      if (firstCard) {
        firstCard.click();
      }
    }
  }

  function renderForm(container, type) {
    var apiType = typeToApi[type] || type;
    var typeInfo = SUBMISSION_TYPES.find(function (t) { return t.id === type; }) || { title: type };
    var draftKey = 'rrp_draft_' + apiType;
    var savedDraft = null;
    try { savedDraft = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch (e) {}

    container.innerHTML =
      '<h1>Submit: ' + escapeHtml(typeInfo.title) + '</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom: 1rem;" data-back>← Back</button>' +
      (savedDraft ? '<div class="rrp-draft-notice"><strong>Draft restored</strong> – unsaved work from a previous visit. <button type="button" class="rrp-btn secondary rrp-btn-sm" id="rrp-clear-draft">Clear</button></div>' : '') +
      '<div id="rrp-form-errors"></div>' +
      '<form id="rrp-submit-form" novalidate>' +
        '<div class="rrp-form-block"><label>Name *</label><input type="text" name="submitterName" required autocomplete="name"></div>' +
        '<div class="rrp-form-block"><label>Email *</label><input type="email" name="submitterEmail" required autocomplete="email"></div>' +
        '<div class="rrp-form-block"><label>Affiliation *</label><input type="text" name="affiliation" required></div>' +
        '<div class="rrp-form-block"><label>Title * <span class="rrp-hint">(max 200 characters)</span></label>' +
          '<input type="text" name="title" required maxlength="200"><span class="rrp-counter" id="rrp-title-counter">0 / 200</span></div>' +
        '<div class="rrp-form-block"><label>Abstract * <span class="rrp-hint">' + (apiType === 'conference' ? '250–500 words recommended' : 'required') + '</span></label>' +
          '<textarea name="abstract" rows="6" required></textarea><span class="rrp-counter" id="rrp-abstract-counter">0 words</span></div>' +
        '<div class="rrp-form-block"><label>Keywords * <span class="rrp-hint">(3–5, comma-separated)</span></label>' +
          '<input type="text" name="keywords" required><span class="rrp-counter" id="rrp-keywords-counter">0 keywords</span></div>' +
        '<div class="rrp-form-block"><label>Research area / Category *</label><input type="text" name="researchArea" required></div>' +
        (apiType === 'conference' ? '<div class="rrp-form-block"><label>Presentation preference *</label><select name="presentationPreference"><option value="">— select —</option><option value="oral">Oral</option><option value="poster">Poster</option></select></div>' : '') +
        (apiType === 'publication' ? '<div class="rrp-form-block"><label>Publication type *</label><input type="text" name="publicationType" required></div>' : '') +
        (apiType === 'student-project' ? '<div class="rrp-form-block"><label>Project type *</label><input type="text" name="projectType" required></div>' : '') +
        (apiType === 'grant' ? '<div class="rrp-form-block"><label>Funding agency *</label><input type="text" name="fundingAgency" required></div>' : '') +
        '<div class="rrp-form-block"><label>Supporting files <span class="rrp-hint">(optional – PDF, DOC, DOCX, PPT, PPTX, TXT – max 2 MB each, up to 5)</span></label>' +
          '<input type="file" name="files" id="rrp-file-input" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.txt">' +
          '<div id="rrp-file-list" class="rrp-file-list"></div>' +
        '</div>' +
        '<div class="rrp-form-actions">' +
          '<button type="submit" class="rrp-btn" id="rrp-submit-btn">Submit</button>' +
          '<button type="button" class="rrp-btn secondary" id="rrp-draft-btn">Save draft</button>' +
          '<button type="button" class="rrp-btn secondary" id="rrp-preview-btn">Preview</button>' +
        '</div>' +
      '</form>' +
      '<div id="rrp-preview-panel" style="display:none;" class="rrp-preview-panel"></div>';

    container.querySelector('[data-back]').addEventListener('click', function () { renderSelection(container); });

    var form = document.getElementById('rrp-submit-form');

    // Restore draft values
    if (savedDraft) {
      Object.keys(savedDraft).forEach(function (k) {
        var el = form.elements[k];
        if (el) el.value = savedDraft[k] || '';
      });
    }

    // Clear draft button
    var clearBtn = document.getElementById('rrp-clear-draft');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        localStorage.removeItem(draftKey);
        var notice = container.querySelector('.rrp-draft-notice');
        if (notice) notice.remove();
      });
    }

    // Live counters
    var titleInput = form.querySelector('[name="title"]');
    var titleCounter = document.getElementById('rrp-title-counter');
    titleInput.addEventListener('input', function () {
      var len = titleInput.value.length;
      titleCounter.textContent = len + ' / 200';
      titleCounter.className = 'rrp-counter' + (len > 190 ? ' rrp-counter-warn' : (len > 0 ? ' rrp-counter-ok' : ''));
    });
    if (savedDraft && savedDraft.title) titleInput.dispatchEvent(new Event('input'));

    var abstractEl = form.querySelector('[name="abstract"]');
    var abstractCounter = document.getElementById('rrp-abstract-counter');
    abstractEl.addEventListener('input', function () {
      var words = abstractEl.value.trim() ? abstractEl.value.trim().split(/\s+/).length : 0;
      abstractCounter.textContent = words + ' word' + (words !== 1 ? 's' : '');
      var ok = apiType !== 'conference' || (words >= 250 && words <= 500);
      abstractCounter.className = 'rrp-counter' + (!ok && words > 0 ? ' rrp-counter-warn' : (ok && words > 0 ? ' rrp-counter-ok' : ''));
    });
    if (savedDraft && savedDraft.abstract) abstractEl.dispatchEvent(new Event('input'));

    var keywordsEl = form.querySelector('[name="keywords"]');
    var keywordsCounter = document.getElementById('rrp-keywords-counter');
    keywordsEl.addEventListener('input', function () {
      var kws = keywordsEl.value.split(',').map(function (k) { return k.trim(); }).filter(Boolean);
      keywordsCounter.textContent = kws.length + ' keyword' + (kws.length !== 1 ? 's' : '');
      keywordsCounter.className = 'rrp-counter' + (kws.length > 0 && (kws.length < 3 || kws.length > 5) ? ' rrp-counter-warn' : (kws.length >= 3 && kws.length <= 5 ? ' rrp-counter-ok' : ''));
    });
    if (savedDraft && savedDraft.keywords) keywordsEl.dispatchEvent(new Event('input'));

    // File list preview
    var fileInput = document.getElementById('rrp-file-input');
    var fileListEl = document.getElementById('rrp-file-list');
    fileInput.addEventListener('change', function () {
      var files = Array.from(fileInput.files || []);
      if (files.length > 5) {
        fileListEl.innerHTML = '<div class="rrp-error">Maximum 5 files allowed.</div>';
        return;
      }
      fileListEl.innerHTML = files.map(function (f) {
        var mb = (f.size / 1024 / 1024).toFixed(2);
        var ok = f.size <= 2 * 1024 * 1024;
        return '<div class="rrp-file-item' + (!ok ? ' rrp-file-item-warn' : '') + '">' +
          escapeHtml(f.name) + ' (' + mb + ' MB)' + (!ok ? ' ⚠ exceeds 2 MB limit' : '') + '</div>';
      }).join('');
    });

    // Save draft
    document.getElementById('rrp-draft-btn').addEventListener('click', function () {
      var fd = new FormData(form);
      var body = { type: apiType };
      fd.forEach(function (v, k) { if (k !== 'files') body[k] = v; });
      try { localStorage.setItem(draftKey, JSON.stringify(body)); } catch (e) {}
      body.status = 'draft';
      var errEl = document.getElementById('rrp-form-errors');
      api('POST', '/submit', body)
        .then(function (res) {
          errEl.innerHTML = '<div class="rrp-info">Draft saved. Reference: <strong>' + escapeHtml(res.id) + '</strong></div>';
        })
        .catch(function () {
          errEl.innerHTML = '<div class="rrp-info">Draft saved locally.</div>';
        });
    });

    // Preview
    document.getElementById('rrp-preview-btn').addEventListener('click', function () {
      var fd = new FormData(form);
      var body = {};
      fd.forEach(function (v, k) { if (k !== 'files') body[k] = v; });
      var panel = document.getElementById('rrp-preview-panel');
      panel.style.display = '';
      panel.innerHTML =
        '<div class="rrp-preview-header"><h2>Preview</h2>' +
          '<button type="button" class="rrp-btn secondary rrp-btn-sm" id="rrp-close-preview">✕ Close preview</button></div>' +
        '<table class="rrp-preview-table">' +
          Object.keys(body).filter(function (k) { return body[k]; }).map(function (k) {
            return '<tr><th>' + escapeHtml(k) + '</th><td>' + escapeHtml(body[k]) + '</td></tr>';
          }).join('') +
        '</table>';
      document.getElementById('rrp-close-preview').addEventListener('click', function () { panel.style.display = 'none'; });
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Submit
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = document.getElementById('rrp-form-errors');
      errEl.innerHTML = '';
      var fd = new FormData(form);
      var body = { type: apiType };
      fd.forEach(function (v, k) { if (k !== 'files') body[k] = v; });
      var submitBtn = document.getElementById('rrp-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';

      api('POST', '/submit', body)
        .then(function (res) {
          try { localStorage.removeItem(draftKey); } catch (e) {}
          // Upload files if any were selected
          var files = fileInput.files;
          if (files && files.length > 0 && res.id) {
            var fileData = new FormData();
            for (var i = 0; i < files.length; i++) { fileData.append('files[]', files[i]); }
            return fetch(restBase + '/submissions/' + encodeURIComponent(res.id) + '/attachments', {
              method: 'POST',
              headers: { 'X-WP-Nonce': nonce },
              body: fileData
            }).then(function () { return res; });
          }
          return res;
        })
        .then(function (res) {
          container.innerHTML =
            '<h1>Submission received</h1>' +
            '<div class="rrp-success">' + escapeHtml(res.message || 'Thank you.') + '</div>' +
            '<p><strong>Reference ID:</strong> <code>' + escapeHtml(res.id) + '</code></p>' +
            '<p>A confirmation email will be sent to your address. Track status under "Check my submissions".</p>' +
            '<button type="button" class="rrp-btn secondary" data-back>← Back to portal</button>';
          container.querySelector('[data-back]').addEventListener('click', function () { renderSelection(container); });
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
          var msg = (err.data && err.data.errors && err.data.errors.length) ? err.data.errors.join(' ') : (err.data && err.data.error) || 'Submission failed. Please check all required fields.';
          errEl.innerHTML = '<div class="rrp-error">' + escapeHtml(msg) + '</div>';
        });
    });
  }

  function renderDashboard(container) {
    container.innerHTML =
      '<h1>Dashboard</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom: 1rem;" data-back>← Back</button>' +
      '<div class="rrp-form-block" id="rrp-dashboard-filters" style="margin-bottom: 1rem;"></div>' +
      '<div id="rrp-dashboard-content"><p class="rrp-loading">Loading dashboard…</p></div>';

    container.querySelector('[data-back]').addEventListener('click', function () { renderSelection(container); });

    function applyDashboardFilter(data) {
      var status = document.getElementById('rrp-dashboard-filter-status').value;
      var type = document.getElementById('rrp-dashboard-filter-type').value;
      var items = data.overview.progressSummary || [];
      if (status !== 'all') {
        items = items.filter(function (s) { return (s.status || '').toLowerCase() === status.toLowerCase(); });
      }
      if (type !== 'all') {
        items = items.filter(function (s) { return (s.type || '').toLowerCase() === type.toLowerCase(); });
      }
      return items;
    }

    api('GET', '/dashboard')
      .then(function (data) {
        var c = document.getElementById('rrp-dashboard-content');
        var o = data.overview || {};
        var u = data.user || {};

        var statuses = Object.keys(o.statusCounts || {});
        var types = Object.keys(o.typeCounts || {});

        document.getElementById('rrp-dashboard-filters').innerHTML =
          '<label>Status filter</label><select id="rrp-dashboard-filter-status"><option value="all">All</option>' + statuses.map(function (s) { return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>'; }).join('') + '</select>' +
          '<label>Type filter</label><select id="rrp-dashboard-filter-type"><option value="all">All</option>' + types.map(function (t) { return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>'; }).join('') + '</select>';

        function renderProgressList() {
          var list = applyDashboardFilter(data);
          var rows = list.slice(0, 20).map(function (s) {
            return '<li><strong>' + escapeHtml(s.title || s.id) + '</strong> (' + escapeHtml(s.id) + ') ' +
              '<span class="rrp-status">' + escapeHtml(s.status || '') + '</span> ' +
              '<span>' + (s.progress || 0) + '%</span> ' +
              '<button type="button" class="rrp-btn secondary" data-detail="' + escapeHtml(s.id) + '" style="margin-left:.25rem;">Details</button>' +
              '<button type="button" class="rrp-btn secondary" data-timeline="' + escapeHtml(s.id) + '" style="margin-left:.25rem;">Timeline</button></li>';
          }).join('');
          document.getElementById('rrp-dashboard-progress').innerHTML = '<ul class="rrp-list">' + (rows || '<li>No matching submissions.</li>') + '</ul>';
          document.querySelectorAll('[data-timeline]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              renderTimeline(btn.getAttribute('data-timeline'), container);
            });
          });
          document.querySelectorAll('[data-detail]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              renderSubmissionDetail(btn.getAttribute('data-detail'), container, function () { renderDashboard(container); });
            });
          });
        }

        c.innerHTML =
          '<div class="rrp-dashboard-grid">' +
            '<div><strong>Total submissions:</strong> ' + (o.totalSubmissions || 0) + '</div>' +
            '<div><strong>My submissions:</strong> ' + (u.mySubmissionsCount || 0) + '</div>' +
            '<div><strong>Assigned reviews:</strong> ' + (u.assignedSubmissionsCount || 0) + '</div>' +
            '<div><strong>Pending review:</strong> ' + (u.pendingReviewCount || 0) + '</div>' +
          '</div>' +
          '<div class="rrp-dashboard-section"><h3>Status counts</h3>' +
          '<ul>' + Object.keys(o.statusCounts || {}).map(function (k) { return '<li>' + escapeHtml(k) + ': ' + o.statusCounts[k] + '</li>'; }).join('') + '</ul></div>' +
          '<div class="rrp-dashboard-section"><h3>Type counts</h3>' +
          '<ul>' + Object.keys(o.typeCounts || {}).map(function (k) { return '<li>' + escapeHtml(k) + ': ' + o.typeCounts[k] + '</li>'; }).join('') + '</ul></div>' +
          '<div class="rrp-dashboard-section"><h3>Recent progress</h3><div id="rrp-dashboard-progress"></div></div>' +
          '<div id="rrp-dashboard-notifications"><h3>Loading notifications…</h3></div>';

        renderProgressList();

        document.getElementById('rrp-dashboard-filter-status').addEventListener('change', renderProgressList);
        document.getElementById('rrp-dashboard-filter-type').addEventListener('change', renderProgressList);

        return api('GET', '/notifications');
      })
      .then(function (notifyData) {
        var block = document.getElementById('rrp-dashboard-notifications');
        if (!block) return;
        var note = notifyData.notifications || [];
        if (note.length === 0) {
          block.innerHTML = '<div>No active notifications.</div>';
          return;
        }
        block.innerHTML = '<div><h3>Notifications</h3><ul>' + note.map(function (n) {
          return '<li>' + escapeHtml(n.message) + ' (' + escapeHtml(n.id) + ', ' + escapeHtml(n.status || '') + ')</li>';
        }).join('') + '</ul></div>';
      })
      .catch(function () {
        container.querySelector('#rrp-dashboard-content').innerHTML = '<div class="rrp-error">Unable to fetch dashboard data.</div>';
      });
  }

  function renderStatus(container) {
    container.innerHTML =
      '<h1>Check my submissions</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom: 1rem;" data-back>← Back</button>' +
      '<div class="rrp-form-block rrp-check-email">' +
        '<label>Your email</label>' +
        '<input type="email" id="rrp-status-email" placeholder="submitter@cityu.edu">' +
        '<button type="button" class="rrp-btn" id="rrp-status-fetch">Load my submissions</button>' +
      '</div>' +
      '<div id="rrp-status-list"></div>';

    container.querySelector('[data-back]').addEventListener('click', function () { renderSelection(container); });

    document.getElementById('rrp-status-fetch').addEventListener('click', function () {
      var email = document.getElementById('rrp-status-email').value.trim();
      var listEl = document.getElementById('rrp-status-list');
      if (!email) {
        listEl.innerHTML = '<div class="rrp-error">Enter your email.</div>';
        return;
      }
      listEl.innerHTML = '<p class="rrp-loading">Loading…</p>';
      api('GET', '/submissions')
        .then(function (res) {
          var mine = (res.submissions || []).filter(function (s) {
            return (s.submitterEmail || '').toLowerCase() === email.toLowerCase();
          });
          if (mine.length === 0) {
            listEl.innerHTML = '<p>No submissions found for this email.</p>';
            return;
          }
          listEl.innerHTML = '<h2>Your submissions</h2><ul class="rrp-list">' +
            mine.map(function (s) {
              var isDraft = (s.status || '').toLowerCase() === 'draft';
              return '<li>' +
                '<span><strong>' + escapeHtml(s.title || s.id) + '</strong>' +
                (isDraft ? ' <span class="rrp-decision-badge rrp-dec-pending">Draft</span>' : '') +
                ' · ' + escapeHtml(s.id) + '</span>' +
                '<span class="rrp-status">' + escapeHtml(s.status || '') + '</span>' +
                '<button type="button" class="rrp-btn secondary" style="margin-left:.5rem;" data-detail="' + escapeHtml(s.id) + '">View Details</button>' +
                '</li>';
            }).join('') +
          '</ul>';
          listEl.querySelectorAll('[data-detail]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              renderSubmissionDetail(btn.getAttribute('data-detail'), container, function () { renderStatus(container); });
            });
          });
        })
        .catch(function () {
          listEl.innerHTML = '<div class="rrp-error">Could not load submissions.</div>';
        });
    });
  }

  function renderAnalytics(container, backFn) {
    container.innerHTML =
      '<h1>&#128202; Analytics</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom:1rem;" data-back>&#8592; Back</button>' +
      '<div id="rrp-analytics-content"><p class="rrp-loading">Loading analytics&hellip;</p></div>' +
      '<div class="rrp-analytics-actions" style="margin-top:1rem;">' +
        '<button class="rrp-btn" id="rrp-export-csv">Export CSV</button>' +
        '<button class="rrp-btn" id="rrp-export-xlsx" style="margin-left:0.5rem;">Export XLSX</button>' +
      '</div>';

    container.querySelector('[data-back]').addEventListener('click', function () {
      if (typeof backFn === 'function') backFn(); else renderSelection(container);
    });

    Promise.all([
      api('GET', '/analytics/workflow'),
      api('GET', '/analytics/performance'),
      api('GET', '/analytics/daily').catch(function () { return { dates: [], series: [] }; })
    ]).then(function (results) {
      var w     = results[0];
      var p     = results[1];
      var daily = results[2];
      var el = document.getElementById('rrp-analytics-content');
      if (!el) return;

      // ── Status distribution bar chart ─────────────────────────────────────
      var byStatus = w.totalByStatus || {};
      var byType   = w.totalByType   || {};
      var total    = w.totalSubmissions || 0;

      var STATUS_COLORS = {
        'Submitted':          '#3b82f6',
        'Under Review':       '#f59e0b',
        'Under Initial Review': '#f59e0b',
        'Administrative Review': '#f59e0b',
        'Revision Required':  '#8b5cf6',
        'Revision Submitted': '#a78bfa',
        'Approved':           '#22c55e',
        'Confirmed for Presentation': '#22c55e',
        'Published':          '#22c55e',
        'Approved for Submission': '#22c55e',
        'Rejected':           '#ef4444',
        'Draft':              '#94a3b8'
      };
      function statusColor(s) {
        if (STATUS_COLORS[s]) return STATUS_COLORS[s];
        if (s && s.indexOf(': In Progress') !== -1) return '#f59e0b';
        return DEFAULT_COLOR;
      }
      var DEFAULT_COLOR = '#64748b';

      // Sort statuses by count desc
      var statusEntries = Object.keys(byStatus).sort(function (a, b) { return byStatus[b] - byStatus[a]; });
      var maxCount = statusEntries.length ? byStatus[statusEntries[0]] : 1;

      var barsHtml = statusEntries.map(function (status) {
        var count = byStatus[status];
        var pct   = total > 0 ? Math.round((count / total) * 100) : 0;
        var barW  = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
        var color = statusColor(status);
        return '<div class="rrp-chart-row">' +
          '<div class="rrp-chart-label">' + escapeHtml(status) + '</div>' +
          '<div class="rrp-chart-bar-wrap">' +
            '<div class="rrp-chart-bar" style="width:' + barW + '%;background:' + color + ';" title="' + count + ' submissions"></div>' +
          '</div>' +
          '<div class="rrp-chart-value">' + count + ' <span class="rrp-chart-pct">(' + pct + '%)</span></div>' +
        '</div>';
      }).join('') || '<p style="color:var(--rrp-text-muted)">No submissions yet.</p>';

      // ── Submission type breakdown ─────────────────────────────────────────
      var typeEntries = Object.keys(byType).sort(function (a, b) { return byType[b] - byType[a]; });
      var typesHtml = typeEntries.map(function (t) {
        var count = byType[t];
        var pct   = total > 0 ? Math.round((count / total) * 100) : 0;
        var barW  = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
        return '<div class="rrp-chart-row">' +
          '<div class="rrp-chart-label">' + escapeHtml(typeLabel(t)) + '</div>' +
          '<div class="rrp-chart-bar-wrap">' +
            '<div class="rrp-chart-bar" style="width:' + barW + '%;background:#0ea5e9;"></div>' +
          '</div>' +
          '<div class="rrp-chart-value">' + count + ' <span class="rrp-chart-pct">(' + pct + '%)</span></div>' +
        '</div>';
      }).join('') || '<p style="color:var(--rrp-text-muted)">No submissions yet.</p>';

      el.innerHTML =
        // ── Line chart: daily submissions by status ─────────────────────────
        '<div class="rrp-analytics-card">' +
          '<h2 class="rrp-analytics-card-title">Daily Submissions by Status</h2>' +
          buildLineChart(daily) +
        '</div>' +

        // ── Chart: Status distribution ──────────────────────────────────────
        '<div class="rrp-analytics-card">' +
          '<h2 class="rrp-analytics-card-title">Submissions by Status</h2>' +
          '<div class="rrp-chart">' + barsHtml + '</div>' +
        '</div>' +

        // ── Chart: By type ──────────────────────────────────────────────────
        '<div class="rrp-analytics-card">' +
          '<h2 class="rrp-analytics-card-title">Submissions by Type</h2>' +
          '<div class="rrp-chart">' + typesHtml + '</div>' +
        '</div>' +

        // ── Summary stat tiles ──────────────────────────────────────────────
        '<div class="rrp-analytics-card">' +
          '<h2 class="rrp-analytics-card-title">Summary</h2>' +
          '<div class="rrp-analytics-tiles">' +
            '<div class="rrp-analytics-tile">' +
              '<div class="rrp-analytics-tile-val">' + total + '</div>' +
              '<div class="rrp-analytics-tile-lbl">Total Submissions</div>' +
            '</div>' +
            '<div class="rrp-analytics-tile rrp-tile-green">' +
              '<div class="rrp-analytics-tile-val">' + (p.finalizedCount || 0) + '</div>' +
              '<div class="rrp-analytics-tile-lbl">Finalized</div>' +
            '</div>' +
            '<div class="rrp-analytics-tile rrp-tile-amber">' +
              '<div class="rrp-analytics-tile-val">' + (p.inProgressCount || 0) + '</div>' +
              '<div class="rrp-analytics-tile-lbl">In Progress</div>' +
            '</div>' +
            '<div class="rrp-analytics-tile rrp-tile-red">' +
              '<div class="rrp-analytics-tile-val">' + (p.lateReviewAlerts || 0) + '</div>' +
              '<div class="rrp-analytics-tile-lbl">Late Alerts</div>' +
            '</div>' +
            '<div class="rrp-analytics-tile">' +
              '<div class="rrp-analytics-tile-val">' + (p.averageTimeToDecisionDays != null ? p.averageTimeToDecisionDays + 'd' : '—') + '</div>' +
              '<div class="rrp-analytics-tile-lbl">Avg. Time to Decision</div>' +
            '</div>' +
            '<div class="rrp-analytics-tile">' +
              '<div class="rrp-analytics-tile-val">' + (w.averageStages || 0) + '</div>' +
              '<div class="rrp-analytics-tile-lbl">Avg. Stages / Submission</div>' +
            '</div>' +
            '<div class="rrp-analytics-tile">' +
              '<div class="rrp-analytics-tile-val">' + (w.meanReviewerLoad || 0) + '</div>' +
              '<div class="rrp-analytics-tile-lbl">Mean Reviewer Load</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      document.getElementById('rrp-export-csv').addEventListener('click', function () {
        api('GET', '/reports/export?type=workflow&format=csv').then(function (resp) {
          var blob = new Blob([atob(resp.content)], { type: 'text/csv' });
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = resp.filename || 'rrp-workflow.csv'; a.click();
        }).catch(function () { alert('Export failed'); });
      });

      document.getElementById('rrp-export-xlsx').addEventListener('click', function () {
        api('GET', '/reports/export?type=workflow&format=xlsx').then(function (resp) {
          var blob = new Blob([atob(resp.content)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = resp.filename || 'rrp-workflow.xlsx'; a.click();
        }).catch(function () { alert('Export failed'); });
      });

    }).catch(function () {
      var el = document.getElementById('rrp-analytics-content');
      if (el) el.innerHTML = '<div class="rrp-error">Unable to load analytics. Please login and try again.</div>';
    });
  }

  function renderReviewerDashboard(container, activeFilter) {
    var userName   = (window.RRP && window.RRP.userName)   || 'Reviewer';
    var userEmail  = ((window.RRP && window.RRP.userEmail) || '').toLowerCase();
    var profileUrl = (window.RRP && window.RRP.profileUrl) || '/wp-admin/profile.php';
    activeFilter   = activeFilter || 'all';

    container.innerHTML =
      '<div class="rrp-student-banner rrp-reviewer-banner">' +
        '<div class="rrp-student-banner-info">' +
          '<div class="rrp-student-banner-title">Welcome, ' + escapeHtml(userName) + '</div>' +
          '<div class="rrp-student-banner-sub">City University of Seattle &nbsp;&middot;&nbsp; Research Reviewer</div>' +
        '</div>' +
      '</div>' +
      '<div class="rrp-student-layout">' +
        '<div class="rrp-student-main">' +
          '<div id="rrp-reviewer-stats" class="rrp-stats-row"><p class="rrp-loading">Loading&hellip;</p></div>' +
          '<div id="rrp-reviewer-submissions" class="rrp-dashboard-section">' +
            '<h2>Assigned Submissions</h2><p class="rrp-loading">Loading&hellip;</p>' +
          '</div>' +
          '<div id="rrp-reviewer-coi-section" style="margin-top:1.5rem;"></div>' +
        '</div>' +
        '<aside class="rrp-student-aside">' +
          '<div class="rrp-profile-card">' +
            '<div class="rrp-profile-icon">&#128101;</div>' +
            '<div class="rrp-profile-name">' + escapeHtml(userName) + '</div>' +
            '<div class="rrp-profile-email">' + escapeHtml(userEmail) + '</div>' +
            '<div class="rrp-profile-role rrp-profile-role-reviewer">Reviewer &middot; CityU STC</div>' +
            '<a class="rrp-btn secondary" style="margin-top:0.75rem;display:block;text-align:center;" href="' + escapeHtml(profileUrl) + '">Edit Profile</a>' +
          '</div>' +
          '<div class="rrp-nav-card">' +
            '<div class="rrp-nav-card-title">Reviewer tools</div>' +
            '<ul class="rrp-nav-list">' +
              '<li><button type="button" class="rrp-nav-link" id="rrp-load-templates-btn">&#128203; Criteria Templates</button></li>' +
              '<li><button type="button" class="rrp-nav-link" id="rrp-show-coi-btn">&#9888;&#65039; Declare Conflict of Interest</button></li>' +
              '<li><button type="button" class="rrp-nav-link" data-view="analytics">&#128202; Analytics</button></li>' +
              '<li><button type="button" class="rrp-nav-link" data-view="public">&#127760; Public submissions</button></li>' +
            '</ul>' +
          '</div>' +
          '<div id="rrp-reviewer-templates" style="margin-top:1rem;"></div>' +
        '</aside>' +
      '</div>';

    // Quick nav links
    container.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var view = btn.getAttribute('data-view');
        if (view === 'analytics') renderAnalytics(container, function () { renderReviewerDashboard(container); });
        if (view === 'public')    renderPublic(container,    function () { renderReviewerDashboard(container); });
      });
    });

    // Criteria templates (loads into aside)
    document.getElementById('rrp-load-templates-btn').addEventListener('click', function () {
      var output = document.getElementById('rrp-reviewer-templates');
      if (output.innerHTML) { output.innerHTML = ''; return; }
      output.innerHTML = '<p class="rrp-loading">Loading templates&hellip;</p>';
      api('GET', '/config/review-templates').then(function (resp) {
        output.innerHTML = '<div class="rrp-nav-card"><div class="rrp-nav-card-title">Criteria Templates</div>';
        if (Array.isArray(resp) && resp.length) {
          output.innerHTML += '<ul class="rrp-list">' + resp.map(function (t) {
            return '<li style="font-size:.82rem"><strong>' + escapeHtml(t.name || 'Unnamed') + '</strong><br>' +
              '<span style="color:var(--rrp-text-muted)">' + escapeHtml((t.criteria || []).map(function (c) { return c.label + ' (' + c.weight + '%)'; }).join(', ')) + '</span></li>';
          }).join('') + '</ul>';
        } else {
          output.innerHTML += '<p style="font-size:.85rem">No templates configured.</p>';
        }
        output.innerHTML += '</div>';
      }).catch(function () {
        output.innerHTML = '<div class="rrp-error">Unable to load templates.</div>';
      });
    });

    // COI declaration (toggles inline below list)
    document.getElementById('rrp-show-coi-btn').addEventListener('click', function () {
      var section = document.getElementById('rrp-reviewer-coi-section');
      if (section.innerHTML) { section.innerHTML = ''; return; }
      section.innerHTML =
        '<div class="rrp-dashboard-section">' +
          '<h3>Declare Conflict of Interest</h3>' +
          '<div class="rrp-form-block"><label>Submission ID</label>' +
            '<input type="text" id="rrp-coi-submission-id" placeholder="e.g. PROJ-2026-001"></div>' +
          '<div class="rrp-form-block"><label>Reason</label>' +
            '<textarea id="rrp-coi-reason" rows="3" placeholder="Describe the conflict of interest&hellip;"></textarea></div>' +
          '<button type="button" class="rrp-btn" id="rrp-declare-coi-btn">Declare Conflict</button>' +
          '<div id="rrp-coi-msg" style="margin-top:.75rem;"></div>' +
        '</div>';
      document.getElementById('rrp-declare-coi-btn').addEventListener('click', function () {
        var subId  = document.getElementById('rrp-coi-submission-id').value.trim();
        var reason = document.getElementById('rrp-coi-reason').value.trim();
        var msgEl  = document.getElementById('rrp-coi-msg');
        if (!subId || !reason) { msgEl.innerHTML = '<div class="rrp-error">Both fields are required.</div>'; return; }
        api('POST', '/conflicts', { reviewerEmail: userEmail, submissionId: subId, reason: reason })
          .then(function () { msgEl.innerHTML = '<div class="rrp-success">Conflict declared successfully.</div>'; })
          .catch(function () { msgEl.innerHTML = '<div class="rrp-error">Failed to declare conflict.</div>'; });
      });
    });

    if (!userEmail) {
      document.getElementById('rrp-reviewer-stats').innerHTML = '<div class="rrp-error">Reviewer email not available. Please log in again.</div>';
      return;
    }

    // Load metrics + assigned submissions
    Promise.all([
      api('GET', '/analytics/reviewer?reviewerEmail=' + encodeURIComponent(userEmail)),
      api('GET', '/reviews?reviewerEmail='            + encodeURIComponent(userEmail))
    ]).then(function (results) {
      var metrics     = results[0];
      var submissions = results[1].submissions || [];

      var total    = metrics.totalAssigned  || 0;
      var pending  = metrics.pending        || 0;
      var approved = metrics.approved       || 0;
      var action   = (metrics.needsRevision || 0) + (metrics.rejected || 0);

      document.getElementById('rrp-reviewer-stats').innerHTML =
        '<button class="rrp-stat-card'      + (activeFilter === 'all'      ? ' rrp-stat-active' : '') + '" data-stat-filter="all">' +
          '<span class="rrp-stat-value">' + total    + '</span><span class="rrp-stat-label">Total</span>' +
        '</button>' +
        '<button class="rrp-stat-card rrp-stat-blue'  + (activeFilter === 'pending'  ? ' rrp-stat-active' : '') + '" data-stat-filter="pending">' +
          '<span class="rrp-stat-value">' + pending  + '</span><span class="rrp-stat-label">Pending</span>' +
        '</button>' +
        '<button class="rrp-stat-card rrp-stat-green' + (activeFilter === 'approved' ? ' rrp-stat-active' : '') + '" data-stat-filter="approved">' +
          '<span class="rrp-stat-value">' + approved + '</span><span class="rrp-stat-label">Approved</span>' +
        '</button>' +
        '<button class="rrp-stat-card rrp-stat-warn'  + (activeFilter === 'action'   ? ' rrp-stat-active' : '') + '" data-stat-filter="action">' +
          '<span class="rrp-stat-value">' + action   + '</span><span class="rrp-stat-label">Action Required</span>' +
        '</button>';

      document.querySelectorAll('[data-stat-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var f = btn.getAttribute('data-stat-filter');
          renderSubmissionList(submissions, f);
          document.querySelectorAll('[data-stat-filter]').forEach(function (b) {
            b.classList.toggle('rrp-stat-active', b.getAttribute('data-stat-filter') === f);
          });
        });
      });

      renderSubmissionList(submissions, activeFilter);

    }).catch(function () {
      document.getElementById('rrp-reviewer-stats').innerHTML = '<div class="rrp-error">Unable to load reviewer data.</div>';
    });

    function classifyStatus(status) {
      if (isApprovedStatus(status)) return 'approved';
      var s = (status || '').toLowerCase();
      if (s === 'rejected' || s === 'revision required') return 'action';
      return 'pending';
    }

    function renderSubmissionList(submissions, filter) {
      var filtered = submissions;
      if (filter === 'pending')  filtered = submissions.filter(function (s) { return classifyStatus(s.status) === 'pending'; });
      if (filter === 'approved') filtered = submissions.filter(function (s) { return classifyStatus(s.status) === 'approved'; });
      if (filter === 'action')   filtered = submissions.filter(function (s) { return classifyStatus(s.status) === 'action'; });

      var heading = filter === 'pending'  ? 'Pending Review' :
                    filter === 'approved' ? 'Approved' :
                    filter === 'action'   ? 'Action Required' : 'All Assigned Submissions';

      var listEl = document.getElementById('rrp-reviewer-submissions');
      if (!listEl) return;

      if (filtered.length === 0) {
        listEl.innerHTML =
          '<h2>' + heading + '</h2>' +
          '<div class="rrp-empty-state"><p>' +
            (submissions.length === 0 ? 'No submissions are currently assigned to you.' : 'No submissions match this filter.') +
          '</p></div>';
        return;
      }

      listEl.innerHTML =
        '<h2>' + heading + ' <span class="rrp-count-badge">' + filtered.length + '</span></h2>' +
        '<ul class="rrp-list rrp-submissions-list">' +
        filtered.map(function (item) {
          var dueTxt = item.deadline ? new Date(item.deadline).toLocaleDateString() : '\u2014';
          var dueNear = item.deadline && (new Date(item.deadline) - Date.now()) < 3 * 86400000;
          return '<li class="rrp-sub-item">' +
            '<div class="rrp-sub-item-header">' +
              '<strong>' + escapeHtml(item.title || item.id) + '</strong>' +
              '<span class="rrp-decision-badge ' + statusBadgeCls(item.status) + '">' + escapeHtml(item.status || 'Pending') + '</span>' +
            '</div>' +
            '<div class="rrp-sub-item-meta">' +
              '<span class="rrp-meta-id"><span class="rrp-meta-lbl">ID</span>' + escapeHtml(item.id) + '</span>' +
              '<span><span class="rrp-meta-lbl">Category</span>' + escapeHtml(typeLabel(item.submissionType || item.type)) + '</span>' +
              (item.createdAt ? '<span><span class="rrp-meta-lbl">Submitted</span>' + new Date(item.createdAt).toLocaleDateString() + '</span>' : '') +
              '<span class="' + (dueNear ? 'rrp-due-soon' : '') + '"><span class="rrp-meta-lbl">Due</span>' + dueTxt + '</span>' +
            '</div>' +
            '<div class="rrp-sub-item-actions">' +
              '<button type="button" class="rrp-btn secondary" data-review="' + escapeHtml(item.id) + '">Review</button>' +
            '</div>' +
          '</li>';
        }).join('') +
        '</ul>';

      listEl.querySelectorAll('[data-review]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          renderSubmissionDetail(btn.getAttribute('data-review'), container, function () { renderReviewerDashboard(container); });
        });
      });
    }
  }

  function renderPublic(container, backFn) {
    container.innerHTML =
      '<h1>Research & symposium</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom: 1rem;" data-back>← Back</button>' +
      '<p style="color: var(--rrp-text-muted);">Accepted and published work.</p>' +
      '<div id="rrp-public-list"></div>';

    container.querySelector('[data-back]').addEventListener('click', function () { if (typeof backFn === 'function') backFn(); else renderSelection(container); });

    var listEl = document.getElementById('rrp-public-list');
    listEl.innerHTML = '<p class="rrp-loading">Loading…</p>';
    api('GET', '/submissions/public')
      .then(function (res) {
        var list = res.submissions || [];
        if (list.length === 0) {
          listEl.innerHTML = '<p>No public submissions yet.</p>';
          return;
        }
        listEl.innerHTML =
          '<ul class="rrp-list rrp-public-list">' +
            list.map(function (s) {
              var abs = (s.abstract || '').substring(0, 300);
              if ((s.abstract || '').length > 300) abs += '…';
              return '<li><div><strong>' + escapeHtml(s.title || '—') + '</strong> · ' + escapeHtml(s.id) + ' <span class="rrp-status">' + escapeHtml(s.status || '') + '</span></div>' +
                (abs ? '<div class="rrp-abstract">' + escapeHtml(abs) + '</div>' : '') + '</li>';
            }).join('') +
          '</ul>';
      })
      .catch(function () {
        listEl.innerHTML = '<div class="rrp-error">Could not load public list.</div>';
      });
  }

  function getActiveStage(stages) {
    for (var i = 0; i < stages.length; i++) {
      if (!stages[i].skipped) {
        var decs = stages[i].decisions || {};
        var revs = stages[i].reviewers || [];
        if (revs.length === 0) return stages[i];
        var allApproved = revs.every(function (r) {
          return (decs[(r.email || '').toLowerCase()] || '').toLowerCase() === 'approved';
        });
        if (!allApproved) return stages[i];
      }
    }
    return stages.length ? stages[stages.length - 1] : null;
  }

  function buildReviewerDecisionForm(sub) {
    var userEmail = ((window.RRP && window.RRP.userEmail) || '').toLowerCase();
    var stages = sub.reviewStages || [];
    var pending = stages.filter(function (s) {
      var assigned = (s.reviewers || []).some(function (r) { return (r.email || '').toLowerCase() === userEmail; });
      var decided = (s.decisions || {})[userEmail];
      return assigned && !decided && !s.skipped;
    });
    if (!pending.length) return '<p>No pending stages to review.</p>';
    return '<form id="rrp-decision-form">' +
      '<div class="rrp-form-block"><label>Stage</label><select name="stageName">' +
        pending.map(function (s) { return '<option value="' + escapeHtml(s.stageName) + '">' + escapeHtml(s.stageName) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="rrp-form-block"><label>Decision *</label><select name="decision">' +
        '<option value="Approved">Approved</option>' +
        '<option value="Needs Revision">Needs Revision</option>' +
        '<option value="Rejected">Rejected</option>' +
      '</select></div>' +
      '<div class="rrp-form-block"><label>Feedback <span class="rrp-hint">(required for Needs Revision / Rejected)</span></label>' +
        '<textarea name="feedbackMsg" rows="3" placeholder="Your feedback to the submitter…"></textarea></div>' +
      '<button type="submit" class="rrp-btn">Save Decision</button> ' +
      '<span id="rrp-decision-msg" style="margin-left:.5rem;"></span>' +
    '</form>';
  }

  function buildRevisionForm(sub) {
    return '<p style="color:var(--rrp-text-muted);font-size:.9rem;">Please revise your submission based on the reviewer feedback and resubmit.</p>' +
    '<form id="rrp-revision-form">' +
      '<div class="rrp-form-block"><label>Title</label><input type="text" name="title" value="' + escapeHtml(sub.title || '') + '" maxlength="200"></div>' +
      '<div class="rrp-form-block"><label>Research area</label><input type="text" name="researchArea" value="' + escapeHtml(sub.researchArea || '') + '"></div>' +
      '<div class="rrp-form-block"><label>Revised document <span class="rrp-hint">(optional — PDF, DOC, DOCX, max 2 MB)</span></label>' +
        '<input type="file" name="revisionFile" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt">' +
      '</div>' +
      '<button type="submit" class="rrp-btn">Submit Revision</button> ' +
      '<span id="rrp-revision-msg" style="margin-left:.5rem;"></span>' +
    '</form>';
  }

  function renderSubmissionDetail(submissionId, container, backFn) {
    var userEmail = ((window.RRP && window.RRP.userEmail) || '').toLowerCase();
    var userRole  = (window.RRP && window.RRP.userRole) || '';
    var isAdmin   = userRole === 'Admin' || userRole === 'Coordinator';

    container.innerHTML =
      '<h1>Submission Details</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom:1rem;" data-back>← Back</button>' +
      '<div id="rrp-detail-content"><p class="rrp-loading">Loading…</p></div>';

    container.querySelector('[data-back]').addEventListener('click', function () {
      if (typeof backFn === 'function') backFn(); else renderSelection(container);
    });

    Promise.all([
      api('GET', '/submissions/' + encodeURIComponent(submissionId)),
      api('GET', '/submissions/' + encodeURIComponent(submissionId) + '/deadlines').catch(function () { return { deadlines: [] }; })
    ]).then(function (results) {
      var sub = results[0];
      var deadlines = results[1].deadlines || [];
      var el = document.getElementById('rrp-detail-content');
      if (!el) return;

      var isReviewer = (sub.assignedReviewers || []).some(function (r) {
        return (r.email || '').toLowerCase() === userEmail;
      });
      if (!isReviewer && sub.reviewStages) {
        sub.reviewStages.forEach(function (s) {
          if ((s.reviewers || []).some(function (r) { return (r.email || '').toLowerCase() === userEmail; })) { isReviewer = true; }
        });
      }
      var isSubmitter = (sub.submitterEmail || '').toLowerCase() === userEmail;
      var needsRevision = sub.status === 'Revision Required' || sub.status === 'Rejected';

      // Stage timeline HTML
      // Find the index of the current active stage so future stages can show "Not Started"
      var _allStages = sub.reviewStages || [];
      var _activeStageIdx = -1;
      for (var _asi = 0; _asi < _allStages.length; _asi++) {
        if (_allStages[_asi].skipped) continue;
        var _asDecs = _allStages[_asi].decisions || {};
        var _asRevs = _allStages[_asi].reviewers || [];
        if (_asRevs.length === 0) { _activeStageIdx = _asi; break; }
        var _asAllApproved = _asRevs.every(function (r) {
          return (_asDecs[(r.email || '').toLowerCase()] || '').toLowerCase() === 'approved';
        });
        if (!_asAllApproved) { _activeStageIdx = _asi; break; }
      }

      var stagesHtml = _allStages.map(function (stage, i) {
        var dl = deadlines[i] || {};
        var approved = dl.approved || false;
        var skipped  = stage.skipped || false;
        var decisions = stage.decisions || {};
        var hasRevisionDec = Object.keys(decisions).some(function (k) {
          return (decisions[k] || '').toLowerCase() === 'needs revision';
        });
        var isFuture = !skipped && !approved && _activeStageIdx !== -1 && i > _activeStageIdx;
        var statusClass, statusLabel;
        if (skipped)           { statusClass = 'rrp-stage-skipped';     statusLabel = 'Skipped'; }
        else if (approved)     { statusClass = 'rrp-stage-approved';    statusLabel = '✓ Approved'; }
        else if (isFuture)     { statusClass = 'rrp-stage-not-started'; statusLabel = 'Not Started'; }
        else if (hasRevisionDec) { statusClass = 'rrp-stage-revision';  statusLabel = 'Revision Requested'; }
        else                   { statusClass = 'rrp-stage-pending';     statusLabel = 'In Progress'; }
        var reviewerRows = (stage.reviewers || []).map(function (r) {
          var em  = (r.email || '').toLowerCase();
          var dec = decisions[em] || 'Pending';
          var cls = dec === 'Approved' ? 'rrp-dec-approved' : (dec === 'Rejected' ? 'rrp-dec-rejected' : (dec === 'Needs Revision' ? 'rrp-dec-revision' : 'rrp-dec-pending'));
          return '<li>' + escapeHtml(r.name || r.email) + ' <span class="rrp-decision-badge ' + cls + '">' + escapeHtml(dec) + '</span></li>';
        }).join('');
        var feedbackHtml = (stage.feedback || []).map(function (f) {
          return '<div class="rrp-feedback-item"><span class="rrp-feedback-meta">' + escapeHtml(f.name || f.email || f.role) + ':</span> ' + escapeHtml(f.message) + '</div>';
        }).join('');
        return '<div class="rrp-stage-block ' + statusClass + '">' +
          '<div class="rrp-stage-header"><strong>' + escapeHtml(stage.stageName) + '</strong>' +
            '<span class="rrp-stage-status">' + statusLabel + '</span>' +
            (dl.deadline ? '<span class="rrp-deadline-badge">Due: ' + escapeHtml(new Date(dl.deadline).toLocaleDateString()) + '</span>' : '') +
          '</div>' +
          (reviewerRows ? '<ul class="rrp-reviewer-decisions">' + reviewerRows + '</ul>' : '') +
          (feedbackHtml ? feedbackHtml : '') +
        '</div>';
      }).join('');

      el.innerHTML =
        '<div class="rrp-detail-info">' +
          '<h2>' + escapeHtml(sub.title || sub.id) + '</h2>' +
          '<div class="rrp-detail-meta">' +
            '<span><strong>ID:</strong> ' + escapeHtml(sub.id) + '</span>' +
            '<span><strong>Type:</strong> <span class="rrp-type-badge">' + escapeHtml(typeLabel(sub.submissionType || sub.type) || '—') + '</span></span>' +
            '<span><strong>Status:</strong> <span class="rrp-status">' + escapeHtml(sub.status || '—') + '</span></span>' +
            '<span><strong>Submitted by:</strong> ' + escapeHtml(sub.submitterName || sub.submitterEmail || '—') + '</span>' +
            (sub.createdAt ? '<span><strong>Date:</strong> ' + escapeHtml(new Date(sub.createdAt).toLocaleDateString()) + '</span>' : '') +
          '</div>' +
          (sub.abstract ? '<div class="rrp-detail-abstract"><strong>Abstract</strong><p>' + escapeHtml(sub.abstract) + '</p></div>' : '') +
          (sub.keywords ? '<p><strong>Keywords:</strong> ' + escapeHtml(sub.keywords) + '</p>' : '') +
          (sub.researchArea ? '<p><strong>Research area:</strong> ' + escapeHtml(sub.researchArea) + '</p>' : '') +
        '</div>' +
        ((sub.attachments && sub.attachments.length) ?
          (function () {
            // Group attachments by revisionRound (0 = original, 1+ = revisions)
            var groups = {};
            sub.attachments.forEach(function (a) {
              var rr = (a.revisionRound != null) ? a.revisionRound : 0;
              if (!groups[rr]) groups[rr] = [];
              groups[rr].push(a);
            });
            var rounds = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
            var maxRound = rounds[rounds.length - 1];
            var html = '<div class="rrp-detail-section"><h3>Documents</h3>' +
              '<div id="rrp-inline-viewer" class="rrp-inline-viewer" style="display:none;"></div>';
            rounds.forEach(function (rr) {
              var isLatest = rr === maxRound;
              var groupLabel = rr === 0 ? 'Original Submission' : 'Revision ' + rr;
              html += '<div class="rrp-attach-group' + (isLatest ? ' rrp-attach-group-latest' : '') + '">' +
                '<div class="rrp-attach-group-header">' +
                  '<span class="rrp-attach-round-badge' + (isLatest ? ' latest' : '') + '">' + escapeHtml(groupLabel) + '</span>' +
                  (isLatest ? '<span class="rrp-latest-badge">Latest</span>' : '') +
                '</div>' +
                '<ul class="rrp-list rrp-attachment-list">';
              groups[rr].forEach(function (a) {
                var isPdf = (a.filename || a.name || '').toLowerCase().endsWith('.pdf');
                var fileUrl = escapeHtml(restBase + '/submissions/' + submissionId + '/attachments/' + encodeURIComponent(a.filename || a.name) + '?_wpnonce=' + nonce);
                var inlineUrl = fileUrl + '&inline=1';
                var uploadedDate = a.uploadedAt ? new Date(a.uploadedAt).toLocaleString() : null;
                html += '<li class="rrp-attach-item">' +
                  '<span class="rrp-attach-icon">&#128196;</span> ' +
                  '<span class="rrp-attach-name">' + escapeHtml(a.name || a.filename) + '</span>' +
                  (uploadedDate ? '<span class="rrp-attach-date">Uploaded: ' + escapeHtml(uploadedDate) + '</span>' : '') +
                  '<span class="rrp-attach-actions">' +
                  (isPdf ? '<button type="button" class="rrp-btn secondary" data-inline-url="' + inlineUrl + '" data-inline-name="' + escapeHtml(a.name || a.filename) + '">&#128065; View</button> ' : '') +
                  '<a class="rrp-btn secondary" target="_blank" href="' + fileUrl + '">&#8595; Download</a>' +
                  '</span></li>';
              });
              html += '</ul></div>';
            });
            html += '</div>';
            return html;
          })() : '') +
        '<div class="rrp-detail-section"><h3>Review Progress</h3>' + (stagesHtml || '<p>No review stages assigned yet.</p>') + '</div>' +
        '<div class="rrp-detail-section rrp-annotations-section" id="rrp-annotations">' +
          '<h3>&#128221; Annotations &amp; Comments</h3>' +
          ((sub.internalComments && sub.internalComments.length) ?
            '<ul class="rrp-comment-list">' +
            sub.internalComments.map(function (c) {
              return '<li class="rrp-comment-item">' +
                '<div class="rrp-comment-meta">' +
                  '<strong>' + escapeHtml(c.by || 'Unknown') + '</strong>' +
                  (c.stage ? ' &middot; <em>' + escapeHtml(c.stage) + '</em>' : '') +
                  (c.at ? ' &middot; <span class="rrp-comment-time">' + new Date(c.at).toLocaleString() + '</span>' : '') +
                '</div>' +
                '<div class="rrp-comment-text">' + escapeHtml(c.text) + '</div>' +
              '</li>';
            }).join('') +
            '</ul>' : '<p style="color:var(--rrp-text-muted);font-size:.88rem;">No comments yet.</p>') +
          (isReviewer || isAdmin ?
            '<div class="rrp-add-comment" id="rrp-add-comment-form">' +
              '<textarea id="rrp-comment-text" rows="3" placeholder="Add annotation or comment&hellip;" style="width:100%;box-sizing:border-box;"></textarea>' +
              '<div style="display:flex;gap:.5rem;margin-top:.5rem;">' +
                '<button type="button" class="rrp-btn" id="rrp-comment-save">&#128203; Save Comment</button>' +
                '<span id="rrp-comment-msg" style="align-self:center;"></span>' +
              '</div>' +
            '</div>' : '') +
        '</div>' +
        (isReviewer ? '<div id="rrp-reviewer-action" class="rrp-detail-section"><h3>Record Your Decision</h3>' + buildReviewerDecisionForm(sub) + '</div>' : '') +
        (isSubmitter && needsRevision ? '<div id="rrp-submitter-revision" class="rrp-detail-section"><h3>Submit Revision</h3>' + buildRevisionForm(sub) + '</div>' : '') +
        (isAdmin ? '<div id="rrp-admin-controls" class="rrp-detail-section"><h3>Administrative Controls</h3>' +
          '<button type="button" class="rrp-btn secondary" id="rrp-skip-stage-btn">Skip Current Stage</button>' +
          '<span id="rrp-skip-msg" style="margin-left:.5rem;"></span>' +
        '</div>' : '');

      // Wire inline document viewer
      var viewerEl = document.getElementById('rrp-inline-viewer');
      if (viewerEl) {
        el.querySelectorAll('[data-inline-url]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var url  = btn.getAttribute('data-inline-url');
            var name = btn.getAttribute('data-inline-name');
            var isOpen = viewerEl.style.display !== 'none' && viewerEl.getAttribute('data-current') === url;
            if (isOpen) {
              viewerEl.style.display = 'none';
              viewerEl.innerHTML = '';
              viewerEl.removeAttribute('data-current');
              btn.textContent = '\u{1F441} View';
            } else {
              el.querySelectorAll('[data-inline-url]').forEach(function (b) { b.textContent = '\u{1F441} View'; });
              viewerEl.style.display = '';
              viewerEl.setAttribute('data-current', url);
              viewerEl.innerHTML = '<div class="rrp-viewer-toolbar"><strong>' + escapeHtml(name) + '</strong>' +
                '<button type="button" class="rrp-btn secondary" id="rrp-viewer-close">&#10005; Close</button></div>' +
                '<iframe src="' + url + '" class="rrp-viewer-frame" title="' + escapeHtml(name) + '"></iframe>';
              document.getElementById('rrp-viewer-close').addEventListener('click', function () {
                viewerEl.style.display = 'none'; viewerEl.innerHTML = ''; viewerEl.removeAttribute('data-current');
                btn.textContent = '\u{1F441} View';
              });
              viewerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              btn.textContent = '&#x2715; Close viewer';
            }
          });
        });
      }

      // Wire annotation / comment save
      var commentSaveBtn = document.getElementById('rrp-comment-save');
      if (commentSaveBtn) {
        commentSaveBtn.addEventListener('click', function () {
          var txt    = (document.getElementById('rrp-comment-text').value || '').trim();
          var msgEl  = document.getElementById('rrp-comment-msg');
          if (!txt) { msgEl.innerHTML = '<span class="rrp-error">Please enter a comment.</span>'; return; }
          var activeStage = '';
          (sub.reviewStages || []).forEach(function (rs) {
            if (!activeStage && !(rs.skipped) && rs.stageName) activeStage = rs.stageName;
          });
          msgEl.innerHTML = '<span class="rrp-loading">Saving&hellip;</span>';
          commentSaveBtn.disabled = true;
          api('POST', '/submissions/' + encodeURIComponent(submissionId) + '/comments', {
            stage: activeStage || 'General',
            text:  txt,
            by:    (window.RRP && window.RRP.userName) || userRole
          }).then(function () {
              msgEl.innerHTML = '';
              commentSaveBtn.disabled = false;
              document.getElementById('rrp-comment-text').value = '';
              renderSubmissionDetail(submissionId, container, backFn);
            }).catch(function () {
              commentSaveBtn.disabled = false;
              msgEl.innerHTML = '<span class="rrp-error">Failed to save comment.</span>';
            });
        });
      }

      // Wire reviewer decision form
      var decForm = document.getElementById('rrp-decision-form');
      if (decForm) {
        decForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var stageName   = decForm.querySelector('[name="stageName"]').value;
          var decision    = decForm.querySelector('[name="decision"]').value;
          var feedbackMsg = decForm.querySelector('[name="feedbackMsg"]').value;
          var body = { stageDecision: { stageName: stageName, reviewerEmail: userEmail, decision: decision } };
          if (feedbackMsg && (decision === 'Needs Revision' || decision === 'Rejected')) {
            body.stageFeedback = { stageName: stageName, role: 'reviewer', email: userEmail, name: (window.RRP && window.RRP.userName) || '', message: feedbackMsg };
          }
          var msgEl = document.getElementById('rrp-decision-msg');
          msgEl.innerHTML = '<span class="rrp-loading">Saving…</span>';
          api('PATCH', '/submissions/' + encodeURIComponent(submissionId), body)
            .then(function () {
              msgEl.innerHTML = '<span class="rrp-success">Decision recorded.</span>';
              setTimeout(function () { renderSubmissionDetail(submissionId, container, backFn); }, 1400);
            })
            .catch(function (err) {
              msgEl.innerHTML = '<span class="rrp-error">' + escapeHtml((err.data && err.data.error) || 'Failed to save.') + '</span>';
            });
        });
      }

      // Wire revision form
      var revForm = document.getElementById('rrp-revision-form');
      if (revForm) {
        revForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var updBody = {};
          ['title', 'researchArea'].forEach(function (f) {
            var el2 = revForm.querySelector('[name="' + f + '"]');
            if (el2) updBody[f] = el2.value;
          });
          var fileInput = revForm.querySelector('[name="revisionFile"]');
          var hasFile   = fileInput && fileInput.files && fileInput.files.length > 0;
          var msgEl = document.getElementById('rrp-revision-msg');
          msgEl.innerHTML = '<span class="rrp-loading">Submitting…</span>';

          var firstStageName = (sub.reviewStages && sub.reviewStages[0]) ? sub.reviewStages[0].stageName : '';

          // Step 1: upload revised file (if any)
          var uploadStep = hasFile
            ? (function () {
                var fd = new FormData();
                fd.append('files', fileInput.files[0]);
                return fetch(restBase + '/submissions/' + encodeURIComponent(submissionId) + '/attachments', {
                  method: 'POST',
                  headers: { 'X-WP-Nonce': nonce },
                  body: fd
                }).then(function (r) {
                  if (!r.ok) return r.json().then(function (d) { throw d; });
                });
              })()
            : Promise.resolve();

          // Step 2: update title / researchArea, then reset workflow to stage 0
          uploadStep
            .then(function () {
              return api('PATCH', '/submissions/' + encodeURIComponent(submissionId), updBody);
            })
            .then(function () {
              if (!firstStageName) return;
              return api('PATCH', '/submissions/' + encodeURIComponent(submissionId), {
                stageRevisionSubmitted: { stageName: firstStageName }
              });
            })
            .then(function () {
              msgEl.innerHTML = '<span class="rrp-success">Revision submitted. The submission has been sent back to Chair Review.</span>';
              setTimeout(function () { renderSubmissionDetail(submissionId, container, backFn); }, 1800);
            })
            .catch(function (err) {
              msgEl.innerHTML = '<span class="rrp-error">' + escapeHtml((err && err.error) || (err && err.data && err.data.error) || 'Failed to submit revision.') + '</span>';
            });
        });
      }

      // Wire skip stage button
      var skipBtn = document.getElementById('rrp-skip-stage-btn');
      if (skipBtn) {
        skipBtn.addEventListener('click', function () {
          if (!confirm('Skip the current pending stage? All assigned reviewers will be marked as Approved for that stage.')) return;
          var msgEl = document.getElementById('rrp-skip-msg');
          msgEl.innerHTML = '<span class="rrp-loading">Skipping…</span>';
          api('POST', '/submissions/' + encodeURIComponent(submissionId) + '/skip-stage', {})
            .then(function () {
              msgEl.innerHTML = '<span class="rrp-success">Stage skipped.</span>';
              setTimeout(function () { renderSubmissionDetail(submissionId, container, backFn); }, 1400);
            })
            .catch(function (err) {
              msgEl.innerHTML = '<span class="rrp-error">' + escapeHtml((err.data && err.data.error) || 'Failed.') + '</span>';
            });
        });
      }

    }).catch(function () {
      var el = document.getElementById('rrp-detail-content');
      if (el) el.innerHTML = '<div class="rrp-error">Unable to load submission. You may not have permission to view it.</div>';
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderTimeline(submissionId, container) {
    container.innerHTML =
      '<h1>Timeline: ' + escapeHtml(submissionId) + '</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom: 1rem;" data-back>← Back</button>' +
      '<div id="rrp-timeline-content"><p class="rrp-loading">Loading timeline…</p></div>';

    container.querySelector('[data-back]').addEventListener('click', function () { renderDashboard(container); });

    api('GET', '/submissions/' + encodeURIComponent(submissionId) + '/timeline')
      .then(function (res) {
        var content = document.getElementById('rrp-timeline-content');
        if (!res.timeline || !res.timeline.length) {
          content.innerHTML = '<p>No timeline data available.</p>';
          return;
        }
        content.innerHTML = '<div class="rrp-dashboard-section"><h3>Review timeline</h3></div>' +
          '<ul class="rrp-list">' + res.timeline.map(function (stage) {
            var reviewerList = (stage.reviewers || []).map(function (r) {
              return '<li>' + escapeHtml(r.name || r.email) + ' - ' + escapeHtml(r.decision || 'Pending') + '</li>';
            }).join('');
            return '<li><strong>' + escapeHtml(stage.stageName) + '</strong> - ' + escapeHtml(stage.status) + '<ul>' + reviewerList + '</ul></li>';
          }).join('') + '</ul>';
      })
      .catch(function () {
        document.getElementById('rrp-timeline-content').innerHTML = '<div class="rrp-error">Unable to load timeline.</div>';
      });
  }

  function boot() {
    var el = document.getElementById('research-review-portal');
    if (!el || !restBase) {
        if (el) el.innerHTML = '<p class="rrp-error">Portal API not configured.</p>';
        return;
    }
    var role = (window.RRP && window.RRP.userRole) || '';
    if (isLoggedIn && role === 'Student') {
      renderStudentDashboard(el);
    } else if (isLoggedIn && role === 'Reviewer') {
      renderReviewerDashboard(el);
    } else if (isLoggedIn && (role === 'Coordinator' || role === 'Admin')) {
      renderCoordinatorDashboard(el);
    } else {
      renderSelection(el);
    }
  }

  // ── Shared onboarding constants ──────────────────────────────────────────
  var OB_TYPE_STAGES = {
    'dissertation':    ['Chair Review', 'Committee Review', 'Program Director Approval', 'Dissertation Director Sign-Off'],
    'capstone':        ['Advisor Review', 'Program Director Approval'],
    'student-project': ['Advisor Review', 'Program Director Approval'],
    'research-paper':  ['Peer Review', 'Program Director Approval'],
    'publication':     ['Peer Review', 'Program Director Approval'],
    'conference':      ['Peer Review', 'Program Director Approval'],
    'grant':           ['Multi-Criteria Review', 'Program Director Approval'],
    'grant-proposal':  ['Multi-Criteria Review', 'Program Director Approval']
  };
  var OB_TYPE_LABELS = {
    'dissertation': 'Doctoral Dissertation', 'capstone': 'Capstone Project',
    'student-project': 'Student Project', 'research-paper': 'Research Paper',
    'publication': 'Publication', 'conference': 'Conference Paper',
    'grant': 'Grant Proposal', 'grant-proposal': 'Grant Proposal'
  };
  var OB_ALLOWED_TYPES = [
    {value: 'dissertation',   label: 'Doctoral Dissertation'},
    {value: 'capstone',       label: 'Capstone Project'},
    {value: 'research-paper', label: 'Research Paper'},
    {value: 'grant',          label: 'Grant Proposal'},
    {value: 'publication',    label: 'Publication'},
    {value: 'conference',     label: 'Conference Paper'}
  ];
  var OB_DEGREES = [
    // School of Business
    {value:'emba',                     label:"Executive Master's in Business Administration",                        level:'masters',    school:'Business'},
    {value:'mba',                      label:'Master of Business Administration',                                    level:'masters',    school:'Business'},
    {value:'ms-healthcare-admin',      label:'MS in Healthcare Administration',                                      level:'masters',    school:'Business'},
    {value:'ms-management',            label:'MS in Management',                                                     level:'masters',    school:'Business'},
    {value:'ms-management-leadership', label:'MS in Management and Leadership',                                      level:'masters',    school:'Business'},
    {value:'ms-org-leadership',        label:'MS in Organizational Leadership',                                      level:'masters',    school:'Business'},
    {value:'ms-tech-product-mgmt',     label:'MS in Technology and Product Management',                              level:'masters',    school:'Business'},
    {value:'ms-project-mgmt',          label:"Master's in Project Management",                                       level:'masters',    school:'Business'},
    {value:'ms-hrm',                   label:'MS Human Resources Management',                                        level:'masters',    school:'Business'},
    {value:'dba',                      label:'Doctor of Business Administration',                                    level:'doctoral',   school:'Business'},
    // School of Education
    {value:'med-alt-cert',             label:'M.Ed. Alternative Routes to Certification',                            level:'masters',    school:'Education'},
    {value:'med-curriculum',           label:'M.Ed. in Curriculum and Instruction',                                  level:'masters',    school:'Education'},
    {value:'mit',                      label:'Master in Teaching',                                                   level:'masters',    school:'Education'},
    {value:'med-adult-ed',             label:'M.Ed. in Adult Education and Instructional Design',                    level:'masters',    school:'Education'},
    {value:'med-ed-leadership-cert',   label:'M.Ed. in Educational Leadership: Administrator Certification',         level:'masters',    school:'Education'},
    {value:'med-elementary',           label:'M.Ed. in Elementary Education',                                        level:'masters',    school:'Education'},
    {value:'med-leadership',           label:'M.Ed. in Leadership',                                                  level:'masters',    school:'Education'},
    {value:'med-reading',              label:'M.Ed. in Reading Instruction',                                         level:'masters',    school:'Education'},
    {value:'med-special-ed',           label:'M.Ed. in Special Education',                                           level:'masters',    school:'Education'},
    {value:'edd-leadership',           label:'Doctor of Education in Leadership',                                    level:'doctoral',   school:'Education'},
    {value:'eds-leadership',           label:'Ed.S. in Leadership',                                                  level:'specialist', school:'Education'},
    // School of Technology
    {value:'ms-ai',                    label:'MS in Artificial Intelligence',                                        level:'masters',    school:'Technology'},
    {value:'ms-cs',                    label:'MS in Computer Science',                                               level:'masters',    school:'Technology'},
    {value:'ms-cybersecurity',         label:'MS in Cybersecurity',                                                  level:'masters',    school:'Technology'},
    {value:'ms-data-science',          label:'MS in Data Science',                                                   level:'masters',    school:'Technology'},
    {value:'dit',                      label:'Doctor of Information Technology',                                     level:'doctoral',   school:'Technology'}
  ];
  var OB_DEGREE_SCHOOLS = ['Business', 'Education', 'Technology'];

  var LEVEL_BADGES = {
    'masters':    '<span class="rrp-badge-masters">Master&#x2019;s</span>',
    'doctoral':   '<span class="rrp-badge-doctoral">Doctoral</span>',
    'specialist': '<span class="rrp-badge-specialist">Specialist</span>'
  };

  // ── Student Management ────────────────────────────────────────────────────
  function renderStudentManagement(container, backFn) {
    container.innerHTML =
      '<div class="rrp-mgmt-page-header">' +
        '<button type="button" class="rrp-btn secondary" id="rrp-mgmt-back">&#8592; Back</button>' +
        '<h1>&#127891; Student Management</h1>' +
        '<button type="button" class="rrp-btn" id="rrp-onboard-student-btn">&#43; Onboard New Student</button>' +
      '</div>' +
      '<div id="rrp-student-list"><p class="rrp-loading">Loading students&hellip;</p></div>';

    document.getElementById('rrp-mgmt-back').addEventListener('click', function () {
      if (backFn) backFn(); else renderCoordinatorDashboard(container);
    });
    document.getElementById('rrp-onboard-student-btn').addEventListener('click', function () {
      renderStudentOnboardForm(container, null, function () { renderStudentManagement(container, backFn); });
    });

    api('GET', '/portal-users?role=student')
      .then(function (res) {
        var users = res.users || [];
        var el = document.getElementById('rrp-student-list');
        if (!el) return;
        if (users.length === 0) {
          el.innerHTML =
            '<div class="rrp-empty-state" style="margin-top:2rem;">' +
              '<p>No students enrolled yet. Click <strong>&#43; Onboard New Student</strong> to get started.</p>' +
            '</div>';
          return;
        }
        el.innerHTML =
          '<div class="rrp-user-mgmt-table">' +
            '<div class="rrp-umr-head">' +
              '<span>Name</span><span>Email</span><span>Degree</span><span>Allowed Types</span><span>Actions</span>' +
            '</div>' +
            users.map(function (u) {
              var types  = (u.allowedTypes || []).map(function (t) { return OB_TYPE_LABELS[t] || t; }).join(', ') || '—';
              var degree = OB_DEGREES.find(function (d) { return d.value === u.degree; });
              var nameCell = '<strong>' + escapeHtml(u.name || u.email) + '</strong>' +
                (u.jsonOnly ? ' <span class="rrp-badge-legacy" title="Submitter found in submissions — no portal login yet">Legacy</span>' : '');
              var degreeCell = u.jsonOnly
                ? '<em style="color:var(--rrp-text-muted);font-size:.85rem;">No portal account</em>'
                : escapeHtml(degree ? degree.label : (u.degree || '—'));
              var actionsCell = u.jsonOnly
                ? '<button type="button" class="rrp-btn small" data-import-student="' + encodeURIComponent(u.jsonStudentEmail || u.email) + '" data-student-obj="' + u.id + '">&#8659; Import</button> ' +
                  '<button type="button" class="rrp-btn danger small" data-dismiss-student="' + encodeURIComponent(u.jsonStudentEmail || u.email) + '">Dismiss</button>'
                : '<button type="button" class="rrp-btn secondary small" data-edit-student="' + u.id + '">Edit</button> ' +
                  '<button type="button" class="rrp-btn danger small" data-remove-student="' + u.id + '">Remove</button>';
              return '<div class="rrp-umr-row' + (u.jsonOnly ? ' rrp-umr-row-legacy' : '') + '">' +
                '<span class="rrp-umr-name">' + nameCell + '</span>' +
                '<span class="rrp-umr-email">' + escapeHtml(u.email) + '</span>' +
                '<span>' + degreeCell + '</span>' +
                '<span class="rrp-umr-types" title="' + escapeHtml(types) + '">' + escapeHtml(types.length > 38 ? types.substring(0, 36) + '…' : types) + '</span>' +
                '<span class="rrp-umr-actions">' + actionsCell + '</span>' +
              '</div>';
            }).join('') +
          '</div>';

        el.querySelectorAll('[data-edit-student]').forEach(function (btn) {
          var uid  = btn.getAttribute('data-edit-student');
          var user = users.find(function (u) { return String(u.id) === uid; });
          btn.addEventListener('click', function () {
            renderStudentOnboardForm(container, user, function () { renderStudentManagement(container, backFn); });
          });
        });
        el.querySelectorAll('[data-import-student]').forEach(function (btn) {
          var uid  = btn.getAttribute('data-student-obj');
          var user = users.find(function (u) { return String(u.id) === uid; });
          btn.addEventListener('click', function () {
            renderStudentOnboardForm(container, user, function () { renderStudentManagement(container, backFn); });
          });
        });
        el.querySelectorAll('[data-remove-student]').forEach(function (btn) {
          var uid  = btn.getAttribute('data-remove-student');
          var user = users.find(function (u) { return String(u.id) === uid; });
          btn.addEventListener('click', function () {
            if (!confirm('Remove portal access for ' + escapeHtml(user ? (user.name || user.email) : 'this user') + '?\nThey will lose the Student role but remain as a WordPress user.')) return;
            api('DELETE', '/portal-users/' + uid)
              .then(function ()  { renderStudentManagement(container, backFn); })
              .catch(function () { alert('Failed to remove access. Please try again.'); });
          });
        });
        el.querySelectorAll('[data-dismiss-student]').forEach(function (btn) {
          var email = decodeURIComponent(btn.getAttribute('data-dismiss-student'));
          var user  = users.find(function (u) { return (u.jsonStudentEmail || u.email) === email; });
          btn.addEventListener('click', function () {
            if (!confirm('Dismiss legacy entry for ' + escapeHtml(user ? (user.name || user.email) : email) + '?\nTheir submission history is preserved.')) return;
            api('DELETE', '/portal-users/json-student/' + encodeURIComponent(email))
              .then(function ()  { renderStudentManagement(container, backFn); })
              .catch(function () { alert('Failed to dismiss entry. Please try again.'); });
          });
        });
      })
      .catch(function () {
        var el = document.getElementById('rrp-student-list');
        if (el) el.innerHTML = '<div class="rrp-error">Unable to load students.</div>';
      });
  }

  // ── Student Onboard Form (3-step wizard) ──────────────────────────────────
  function renderStudentOnboardForm(container, editUser, backFn) {
    var isJsonOnly = !!(editUser && editUser.jsonOnly);
    var isEdit     = !!(editUser && editUser.id) && !isJsonOnly;
    var isImport   = isJsonOnly;
    var nameParts  = (isEdit || isImport) ? (editUser.name || '').split(' ') : [];
    var state = {
      firstName:             (isEdit || isImport) ? (nameParts[0] || '') : '',
      lastName:              (isEdit || isImport) ? (nameParts.slice(1).join(' ') || '') : '',
      email:                 (isEdit || isImport) ? (editUser.email || '') : '',
      password:              '',
      degree:                isEdit ? (editUser.degree || '') : '',
      allowedTypes:          isEdit ? (editUser.allowedTypes || []) : [],
      defaultStageReviewers: isEdit ? (editUser.defaultStageReviewers || {}) : {},
      step: 1
    };

    function captureStep2() {
      state.allowedTypes = [];
      container.querySelectorAll('[name="ob-allowedTypes"]:checked').forEach(function (cb) {
        state.allowedTypes.push(cb.value);
      });
      var degEl = container.querySelector('#ob-degree');
      if (degEl) state.degree = degEl.value;
    }

    function captureStep3() {
      var stageEl = container.querySelector('#rrp-ob-stage-reviewers');
      if (!stageEl) return;
      var captured = {};
      stageEl.querySelectorAll('[data-ob-type]').forEach(function (typeBlock) {
        var typeName = typeBlock.getAttribute('data-ob-type');
        captured[typeName] = {};
        typeBlock.querySelectorAll('[data-ob-stage]').forEach(function (stageBlock) {
          var stageName = stageBlock.getAttribute('data-ob-stage');
          var selected = [];
          stageBlock.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) {
            selected.push({ id: cb.getAttribute('data-id'), name: cb.getAttribute('data-name'), email: cb.value });
          });
          captured[typeName][stageName] = selected;
        });
      });
      state.defaultStageReviewers = captured;
    }

    function loadReviewersForStep3() {
      var el = container.querySelector('#rrp-ob-stage-reviewers');
      if (!el) return;
      if (state.allowedTypes.length === 0) {
        el.innerHTML = '<p class="rrp-info">No submission types selected in Step 2. Go back and select at least one type to pre-assign reviewers.</p>';
        return;
      }
      el.innerHTML = '<p class="rrp-loading">Loading reviewer pool&hellip;</p>';
      api('GET', '/reviewers')
        .then(function (res) {
          var allReviewers = res.reviewers || [];
          el.innerHTML = state.allowedTypes.map(function (typeName) {
            var stages  = OB_TYPE_STAGES[typeName] || ['Initial Review', 'Final Approval'];
            var existing = state.defaultStageReviewers[typeName] || {};
            return '<div class="rrp-ob-type-block" data-ob-type="' + escapeHtml(typeName) + '">' +
              '<h3 class="rrp-ob-type-heading">' + escapeHtml(OB_TYPE_LABELS[typeName] || typeName) + '</h3>' +
              stages.map(function (stageName) {
                var existingEmails = (existing[stageName] || []).map(function (r) { return r.email; });
                return '<div class="rrp-assign-stage" data-ob-stage="' + escapeHtml(stageName) + '">' +
                  '<h4 class="rrp-assign-stage-title">' + escapeHtml(stageName) + '</h4>' +
                  '<div class="rrp-assign-reviewer-grid">' +
                  allReviewers.map(function (r) {
                    var checked = existingEmails.indexOf(r.email) !== -1;
                    return '<label class="rrp-reviewer-chip' + (checked ? ' rrp-reviewer-chip-checked' : '') + '">' +
                      '<input type="checkbox" value="' + escapeHtml(r.email) + '" data-name="' + escapeHtml(r.name || r.email) + '" data-id="' + escapeHtml(r.id || '') + '"' + (checked ? ' checked' : '') + '>' +
                      '<span>' + escapeHtml(r.name || r.email) + '<small>' + escapeHtml(r.email) + '</small></span>' +
                    '</label>';
                  }).join('') +
                  (allReviewers.length === 0 ? '<p style="font-size:.83rem;color:var(--rrp-text-muted)">No reviewers in pool yet. Add reviewers first.</p>' : '') +
                  '</div>' +
                '</div>';
              }).join('') +
            '</div>';
          }).join('');
          el.querySelectorAll('.rrp-reviewer-chip input').forEach(function (cb) {
            cb.addEventListener('change', function () {
              cb.closest('.rrp-reviewer-chip').classList.toggle('rrp-reviewer-chip-checked', cb.checked);
            });
          });
        })
        .catch(function () { el.innerHTML = '<div class="rrp-error">Unable to load reviewers.</div>'; });
    }

    function saveStudent() {
      captureStep3();
      var msgEl   = container.querySelector('#rrp-ob-save-msg');
      var saveBtn = container.querySelector('#rrp-ob-save-btn');
      if (!msgEl || !saveBtn) return;
      msgEl.innerHTML = '<span class="rrp-loading">Saving&hellip;</span>';
      saveBtn.disabled = true;
      var payload = {
        firstName: state.firstName, lastName: state.lastName,
        degree: state.degree, allowedTypes: state.allowedTypes,
        defaultStageReviewers: state.defaultStageReviewers
      };
      var method = isEdit ? 'PATCH' : 'POST';
      var endpoint = isEdit ? '/portal-users/' + editUser.id : '/portal-users';
      if (!isEdit) { payload.email = state.email; payload.role = 'rrp_student'; }
      if (state.password) { payload.password = state.password; }
      api(method, endpoint, payload)
        .then(function () {
          msgEl.innerHTML = '<span class="rrp-success">' + (isEdit ? 'Student profile updated.' : 'Student created successfully.') + '</span>';
          setTimeout(function () { if (backFn) backFn(); else renderCoordinatorDashboard(container); }, 1200);
        })
        .catch(function (err) {
          saveBtn.disabled = false;
          msgEl.innerHTML = '<span class="rrp-error">' + escapeHtml((err.data && err.data.error) || 'Save failed. Please try again.') + '</span>';
        });
    }

    function renderStep() {
      var stepTitles = ['Basic Info', 'Academic Profile', 'Pre-assign Reviewers'];
      var stepsHtml  = stepTitles.map(function (lbl, i) {
        var cls = state.step === i + 1 ? 'active' : (state.step > i + 1 ? 'done' : '');
        return '<span class="rrp-ob-step ' + cls + '">' + (i + 1) + '. ' + lbl + '</span>';
      }).join('');

      var body = '';
      if (state.step === 1) {
        body =
          '<h2 class="rrp-ob-step-heading">Step 1: Basic Information</h2>' +
          (isEdit ? '<p class="rrp-info">Editing: <strong>' + escapeHtml(editUser.email) + '</strong></p>' : '') +
          (isImport ? '<p class="rrp-info">Creating a portal login for <strong>' + escapeHtml(editUser.name || editUser.email) + '</strong>. This student submitted work before having a portal account.</p>' : '') +
          '<div class="rrp-form-row">' +
            '<div class="rrp-form-group"><label>First Name</label><input type="text" id="ob-first-name" class="rrp-input" value="' + escapeHtml(state.firstName) + '" placeholder="First name"></div>' +
            '<div class="rrp-form-group"><label>Last Name</label><input type="text"  id="ob-last-name"  class="rrp-input" value="' + escapeHtml(state.lastName)  + '" placeholder="Last name"></div>' +
          '</div>' +
          (!isEdit ?
            '<div class="rrp-form-group"><label>Email Address <em>*</em></label><input type="email" id="ob-email" class="rrp-input" value="' + escapeHtml(state.email) + '" placeholder="student@cityuniversity.edu"></div>' +
            '<div class="rrp-form-group"><label>Temporary Password</label><input type="text" id="ob-password" class="rrp-input" value="' + escapeHtml(state.password) + '" placeholder="Leave blank to auto-generate">' +
              '<small style="color:var(--rrp-text-muted)">If blank, a secure password is generated automatically.</small></div>'
          : '<div class="rrp-form-group"><label>Change Password <em>(optional)</em></label><input type="text" id="ob-password" class="rrp-input" value="" placeholder="Leave blank to keep current password"><small style="color:var(--rrp-text-muted)">Only fill this to set a new password.</small></div>') +
          '<div id="rrp-ob-step1-msg" style="min-height:1.4rem;"></div>' +
          '<div class="rrp-onboard-actions"><button type="button" class="rrp-btn" id="rrp-ob-next-btn">Continue &#8594;</button></div>';

      } else if (state.step === 2) {
        body =
          '<h2 class="rrp-ob-step-heading">Step 2: Academic Profile</h2>' +
          '<div class="rrp-form-group">' +
            '<label>Program</label>' +
            '<select id="ob-degree" class="rrp-input">' +
              '<option value="">&#8212; Select program &#8212;</option>' +
              OB_DEGREE_SCHOOLS.map(function (sch) {
                var opts = OB_DEGREES.filter(function (d) { return d.school === sch; }).map(function (d) {
                  return '<option value="' + escapeHtml(d.value) + '"' + (state.degree === d.value ? ' selected' : '') + '>' + escapeHtml(d.label) + '</option>';
                }).join('');
                return '<optgroup label="School of ' + sch + '">' + opts + '</optgroup>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="rrp-form-group">' +
            '<label>Allowed Submission Types</label>' +
            '<p style="font-size:.83rem;color:var(--rrp-text-muted);margin:.25rem 0 .6rem;">Select which submission types this student may submit.</p>' +
            '<div class="rrp-checkbox-grid">' +
              OB_ALLOWED_TYPES.map(function (t) {
                var checked = state.allowedTypes.indexOf(t.value) !== -1;
                return '<label class="rrp-check-chip' + (checked ? ' checked' : '') + '">' +
                  '<input type="checkbox" name="ob-allowedTypes" value="' + escapeHtml(t.value) + '"' + (checked ? ' checked' : '') + '> ' + escapeHtml(t.label) +
                '</label>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="rrp-onboard-actions">' +
            '<button type="button" class="rrp-btn secondary" id="rrp-ob-prev-btn">&#8592; Previous</button>' +
            '<button type="button" class="rrp-btn" id="rrp-ob-next-btn">Continue &#8594;</button>' +
          '</div>';

      } else {
        body =
          '<h2 class="rrp-ob-step-heading">Step 3: Pre-assign Reviewers <span style="font-weight:400;font-size:.88rem;">(Optional)</span></h2>' +
          '<p class="rrp-info">Choose default reviewers for each stage per submission type. These will be auto-suggested when the student\'s submissions are routed.</p>' +
          '<div id="rrp-ob-stage-reviewers"><p class="rrp-loading">Loading&hellip;</p></div>' +
          '<div id="rrp-ob-save-msg" style="min-height:1.4rem;margin-top:.5rem;"></div>' +
          '<div class="rrp-onboard-actions">' +
            '<button type="button" class="rrp-btn secondary" id="rrp-ob-prev-btn">&#8592; Previous</button>' +
            '<button type="button" class="rrp-btn" id="rrp-ob-save-btn">' + (isEdit ? '&#10003; Save Changes' : (isImport ? '&#8659; Import &amp; Create Account' : '&#10003; Create Student')) + '</button>' +
          '</div>';
      }

      container.innerHTML =
        '<div class="rrp-onboard-wrap">' +
          '<div class="rrp-onboard-header">' +
            '<button type="button" class="rrp-btn secondary" id="rrp-ob-cancel-btn">&#8592; Back</button>' +
            '<h1>' + (isEdit ? 'Edit Student Profile' : (isImport ? 'Import Legacy Student' : 'Onboard New Student')) + '</h1>' +
            '<div class="rrp-ob-steps">' + stepsHtml + '</div>' +
          '</div>' +
          '<div class="rrp-onboard-body">' + body + '</div>' +
        '</div>';

      container.querySelector('#rrp-ob-cancel-btn').addEventListener('click', function () {
        if (backFn) backFn(); else renderCoordinatorDashboard(container);
      });

      var prevBtn = container.querySelector('#rrp-ob-prev-btn');
      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          if (state.step === 2) captureStep2();
          if (state.step === 3) captureStep3();
          state.step--;
          renderStep();
        });
      }

      if (state.step === 1) {
        container.querySelector('#rrp-ob-next-btn').addEventListener('click', function () {
          var fn = container.querySelector('#ob-first-name').value.trim();
          var ln = container.querySelector('#ob-last-name').value.trim();
          var em = (isEdit || isImport) ? (editUser.email) : (container.querySelector('#ob-email') ? container.querySelector('#ob-email').value.trim() : '');
          var pw = container.querySelector('#ob-password') ? container.querySelector('#ob-password').value : '';
          var msg = container.querySelector('#rrp-ob-step1-msg');
          if (!isEdit && !isImport && !em) { msg.innerHTML = '<span class="rrp-error">Email is required.</span>'; return; }
          state.firstName = fn; state.lastName = ln; state.email = em; state.password = pw;
          state.step = 2; renderStep();
        });
      } else if (state.step === 2) {
        container.querySelectorAll('.rrp-check-chip input').forEach(function (cb) {
          cb.addEventListener('change', function () {
            cb.closest('.rrp-check-chip').classList.toggle('checked', cb.checked);
          });
        });
        container.querySelector('#rrp-ob-next-btn').addEventListener('click', function () {
          captureStep2();
          state.step = 3;
          renderStep();
          loadReviewersForStep3();
        });
      } else {
        loadReviewersForStep3();
        container.querySelector('#rrp-ob-save-btn').addEventListener('click', saveStudent);
      }
    }

    renderStep();
  }

  // ── Reviewer Management ───────────────────────────────────────────────────
  function renderReviewerManagement(container, backFn) {
    container.innerHTML =
      '<div class="rrp-mgmt-page-header">' +
        '<button type="button" class="rrp-btn secondary" id="rrp-mgmt-back">&#8592; Back</button>' +
        '<h1>&#128101; Reviewer Management</h1>' +
        '<button type="button" class="rrp-btn" id="rrp-onboard-reviewer-btn">&#43; Add Reviewer</button>' +
      '</div>' +
      '<div id="rrp-reviewer-list"><p class="rrp-loading">Loading reviewers&hellip;</p></div>';

    document.getElementById('rrp-mgmt-back').addEventListener('click', function () {
      if (backFn) backFn(); else renderCoordinatorDashboard(container);
    });
    document.getElementById('rrp-onboard-reviewer-btn').addEventListener('click', function () {
      renderReviewerOnboardForm(container, null, function () { renderReviewerManagement(container, backFn); });
    });

    api('GET', '/portal-users?role=reviewer')
      .then(function (res) {
        var users = res.users || [];
        var el = document.getElementById('rrp-reviewer-list');
        if (!el) return;
        if (users.length === 0) {
          el.innerHTML =
            '<div class="rrp-empty-state" style="margin-top:2rem;">' +
              '<p>No reviewers enrolled yet. Click <strong>&#43; Add Reviewer</strong> to add one.</p>' +
            '</div>';
          return;
        }
        el.innerHTML =
          '<div class="rrp-user-mgmt-table">' +
            '<div class="rrp-umr-head">' +
              '<span>Name</span><span>Email</span><span>Department</span><span>Submission Types</span><span>Actions</span>' +
            '</div>' +
            users.map(function (u) {
              var types = (u.submissionTypes || []).map(function (t) { return OB_TYPE_LABELS[t] || t; }).join(', ') || '—';
              var nameCell = '<strong>' + escapeHtml(u.name || u.email) + '</strong>' +
                (u.jsonOnly ? ' <span class="rrp-badge-legacy" title="Seeded from reviewer pool — no portal login yet">Legacy</span>' : '');
              var deptCell = u.jsonOnly
                ? '<em style="color:var(--rrp-text-muted);font-size:.85rem;">No portal account</em>'
                : escapeHtml(u.department || '—');
              var actionsCell = u.jsonOnly
                ? '<button type="button" class="rrp-btn small" data-import-reviewer="' + u.id + '">&#8659; Import</button> ' +
                  '<button type="button" class="rrp-btn danger small" data-remove-json="' + u.id + '">Remove</button>'
                : '<button type="button" class="rrp-btn secondary small" data-edit-reviewer="' + u.id + '">Edit</button> ' +
                  '<button type="button" class="rrp-btn danger small"     data-remove-reviewer="' + u.id + '">Remove</button>';
              return '<div class="rrp-umr-row' + (u.jsonOnly ? ' rrp-umr-row-legacy' : '') + '">' +
                '<span class="rrp-umr-name">' + nameCell + '</span>' +
                '<span class="rrp-umr-email">' + escapeHtml(u.email) + '</span>' +
                '<span>' + deptCell + '</span>' +
                '<span class="rrp-umr-types" title="' + escapeHtml(types) + '">' + escapeHtml(types.length > 38 ? types.substring(0, 36) + '…' : types) + '</span>' +
                '<span class="rrp-umr-actions">' + actionsCell + '</span>' +
              '</div>';
            }).join('') +
          '</div>';

        el.querySelectorAll('[data-edit-reviewer]').forEach(function (btn) {
          var uid  = btn.getAttribute('data-edit-reviewer');
          var user = users.find(function (u) { return String(u.id) === uid; });
          btn.addEventListener('click', function () {
            renderReviewerOnboardForm(container, user, function () { renderReviewerManagement(container, backFn); });
          });
        });
        el.querySelectorAll('[data-import-reviewer]').forEach(function (btn) {
          var uid  = btn.getAttribute('data-import-reviewer');
          var user = users.find(function (u) { return String(u.id) === uid; });
          btn.addEventListener('click', function () {
            renderReviewerOnboardForm(container, user, function () { renderReviewerManagement(container, backFn); });
          });
        });
        el.querySelectorAll('[data-remove-reviewer]').forEach(function (btn) {
          var uid  = btn.getAttribute('data-remove-reviewer');
          var user = users.find(function (u) { return String(u.id) === uid; });
          btn.addEventListener('click', function () {
            if (!confirm('Remove portal access for ' + escapeHtml(user ? (user.name || user.email) : 'this user') + '?\nThey will lose the Reviewer role but remain as a WordPress user.')) return;
            api('DELETE', '/portal-users/' + uid)
              .then(function ()  { renderReviewerManagement(container, backFn); })
              .catch(function () { alert('Failed to remove access. Please try again.'); });
          });
        });
        el.querySelectorAll('[data-remove-json]').forEach(function (btn) {
          var jsonId = btn.getAttribute('data-remove-json');
          var user   = users.find(function (u) { return String(u.id) === jsonId; });
          btn.addEventListener('click', function () {
            if (!confirm('Remove ' + escapeHtml(user ? (user.name || user.email) : 'this reviewer') + ' from the reviewer pool?\nThis cannot be undone.')) return;
            api('DELETE', '/portal-users/json/' + jsonId)
              .then(function ()  { renderReviewerManagement(container, backFn); })
              .catch(function () { alert('Failed to remove reviewer. Please try again.'); });
          });
        });
      })
      .catch(function () {
        var el = document.getElementById('rrp-reviewer-list');
        if (el) el.innerHTML = '<div class="rrp-error">Unable to load reviewers.</div>';
      });
  }

  // ── Reviewer Onboard Form ─────────────────────────────────────────────────
  function renderReviewerOnboardForm(container, editUser, backFn) {
    var isJsonOnly = !!(editUser && editUser.jsonOnly);
    var isEdit     = !!(editUser && editUser.id) && !isJsonOnly;
    var isImport   = isJsonOnly;  // legacy pool entry: create a WP account from JSON data
    var nameParts  = (isEdit || isImport) ? (editUser.name || '').split(' ') : [];
    var modeTitle  = isImport ? 'Import Legacy Reviewer' : (isEdit ? 'Edit Reviewer Profile' : 'Add Reviewer');

    container.innerHTML =
      '<div class="rrp-onboard-wrap">' +
        '<div class="rrp-onboard-header">' +
          '<button type="button" class="rrp-btn secondary" id="rrp-ob-cancel-btn">&#8592; Back</button>' +
          '<h1>' + modeTitle + '</h1>' +
        '</div>' +
        '<div class="rrp-onboard-body">' +
          (isEdit   ? '<p class="rrp-info">Editing: <strong>' + escapeHtml(editUser.email) + '</strong></p>' : '') +
          (isImport ? '<p class="rrp-info">Creating a portal login for <strong>' + escapeHtml(editUser.name || editUser.email) + '</strong>. This reviewer exists in the pool but has no portal account yet.</p>' : '') +
          '<div class="rrp-form-row">' +
            '<div class="rrp-form-group"><label>First Name</label><input type="text" id="ob-first-name" class="rrp-input" value="' + escapeHtml(nameParts[0] || '') + '" placeholder="First name"></div>' +
            '<div class="rrp-form-group"><label>Last Name</label><input type="text" id="ob-last-name" class="rrp-input" value="' + escapeHtml(nameParts.slice(1).join(' ') || '') + '" placeholder="Last name"></div>' +
          '</div>' +
          (!isEdit ?
            '<div class="rrp-form-group"><label>Email Address <em>*</em></label><input type="email" id="ob-email" class="rrp-input" value="' + escapeHtml(isImport ? (editUser.email || '') : '') + '" placeholder="reviewer@university.edu"></div>' +
            '<div class="rrp-form-group"><label>Temporary Password</label><input type="text" id="ob-password" class="rrp-input" placeholder="Leave blank to auto-generate"><small style="color:var(--rrp-text-muted)">If blank, a secure password is generated.</small></div>'
          : '<div class="rrp-form-group"><label>Change Password <em>(optional)</em></label><input type="text" id="ob-password" class="rrp-input" value="" placeholder="Leave blank to keep current password"><small style="color:var(--rrp-text-muted)">Only fill this to set a new password.</small></div>') +
          '<div class="rrp-form-row">' +
            '<div class="rrp-form-group"><label>Department / Unit</label><input type="text" id="ob-dept" class="rrp-input" value="' + escapeHtml(isEdit ? (editUser.department || '') : '') + '" placeholder="e.g. Computer Science"></div>' +
            '<div class="rrp-form-group"><label>Expertise / Specialization</label><input type="text" id="ob-expertise" class="rrp-input" value="' + escapeHtml(isEdit ? (editUser.expertise || '') : '') + '" placeholder="e.g. Machine Learning, HCI"></div>' +
          '</div>' +
          '<div class="rrp-form-group">' +
            '<label>Submission Types They Can Review</label>' +
            '<p style="font-size:.83rem;color:var(--rrp-text-muted);margin:.25rem 0 .6rem;">Select all types this reviewer is qualified to evaluate.</p>' +
            '<div class="rrp-checkbox-grid">' +
              OB_ALLOWED_TYPES.map(function (t) {
                var checked = (isEdit || isImport) && (editUser.submissionTypes || []).indexOf(t.value) !== -1;
                return '<label class="rrp-check-chip' + (checked ? ' checked' : '') + '">' +
                  '<input type="checkbox" name="ob-submissionTypes" value="' + escapeHtml(t.value) + '"' + (checked ? ' checked' : '') + '> ' + escapeHtml(t.label) +
                '</label>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div id="rrp-ob-save-msg" style="min-height:1.4rem;margin-top:.5rem;"></div>' +
          '<div class="rrp-onboard-actions">' +
            '<button type="button" class="rrp-btn" id="rrp-ob-save-btn">' + (isEdit ? '&#10003; Save Changes' : (isImport ? '&#8659; Import &amp; Create Account' : '&#10003; Add Reviewer')) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    container.querySelectorAll('.rrp-check-chip input').forEach(function (cb) {
      cb.addEventListener('change', function () {
        cb.closest('.rrp-check-chip').classList.toggle('checked', cb.checked);
      });
    });

    container.querySelector('#rrp-ob-cancel-btn').addEventListener('click', function () {
      if (backFn) backFn(); else renderCoordinatorDashboard(container);
    });

    container.querySelector('#rrp-ob-save-btn').addEventListener('click', function () {
      var msgEl   = container.querySelector('#rrp-ob-save-msg');
      var saveBtn = container.querySelector('#rrp-ob-save-btn');
      var fn      = container.querySelector('#ob-first-name').value.trim();
      var ln      = container.querySelector('#ob-last-name').value.trim();
      var em      = isEdit ? editUser.email : (container.querySelector('#ob-email') ? container.querySelector('#ob-email').value.trim() : '');
      var pw      = container.querySelector('#ob-password') ? container.querySelector('#ob-password').value : '';
      var dept    = container.querySelector('#ob-dept').value.trim();
      var exp     = container.querySelector('#ob-expertise').value.trim();
      var types   = [];
      container.querySelectorAll('[name="ob-submissionTypes"]:checked').forEach(function (cb) { types.push(cb.value); });

      if (!isEdit && !em) { msgEl.innerHTML = '<span class="rrp-error">Email is required.</span>'; return; }

      msgEl.innerHTML = '<span class="rrp-loading">Saving&hellip;</span>';
      saveBtn.disabled = true;

      var payload = { firstName: fn, lastName: ln, submissionTypes: types, department: dept, expertise: exp };
      var method   = isEdit ? 'PATCH' : 'POST';
      var endpoint = isEdit ? '/portal-users/' + editUser.id : '/portal-users';
      if (!isEdit) { payload.email = em; payload.role = 'rrp_reviewer'; }
      if (pw) { payload.password = pw; }

      api(method, endpoint, payload)
        .then(function () {
          msgEl.innerHTML = '<span class="rrp-success">' + (isEdit ? 'Reviewer updated.' : 'Reviewer added successfully.') + '</span>';
          setTimeout(function () { if (backFn) backFn(); else renderCoordinatorDashboard(container); }, 1200);
        })
        .catch(function (err) {
          saveBtn.disabled = false;
          msgEl.innerHTML = '<span class="rrp-error">' + escapeHtml((err.data && err.data.error) || 'Save failed.') + '</span>';
        });
    });
  }

  // ── SVG Line Chart builder ─────────────────────────────────────────────────
  function buildLineChart(dailyData) {
    var dates  = (dailyData && dailyData.dates)  || [];
    var series = (dailyData && dailyData.series) || [];
    // Filter to only series that have at least one non-zero value
    var activeSeries = series.filter(function (s) { return s.values.some(function (v) { return v > 0; }); });
    if (!dates.length || !activeSeries.length) {
      return '<p style="color:var(--rrp-text-muted);font-size:.88rem">No submission data available yet.</p>';
    }

    var W = 700, H = 260;
    var padL = 36, padT = 14, padR = 18, padB = 46;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    var n = dates.length;

    var maxVal = 1;
    activeSeries.forEach(function (s) { s.values.forEach(function (v) { if (v > maxVal) maxVal = v; }); });
    // Round up maxVal to a nice number
    var yMax = Math.ceil(maxVal * 1.15) || 1;

    var labelStep = Math.max(1, Math.ceil(n / 14));

    function xPos(i)  { return padL + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2); }
    function yPos(v)  { return padT + (1 - v / yMax) * innerH; }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" ' +
      'style="width:100%;height:auto;display:block;overflow:visible;">\n';

    // Horizontal grid lines + Y labels
    var ySteps = 4;
    for (var yi = 0; yi <= ySteps; yi++) {
      var yv  = yMax * (1 - yi / ySteps);
      var ypx = padT + (yi / ySteps) * innerH;
      svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + ypx.toFixed(1) + '" y2="' + ypx.toFixed(1) + '" stroke="#e2e8f0" stroke-width="1"/>\n';
      svg += '<text x="' + (padL - 5) + '" y="' + (ypx + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="#94a3b8">' + Math.round(yv) + '</text>\n';
    }

    // X axis base line
    svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + innerH) + '" y2="' + (padT + innerH) + '" stroke="#cbd5e1" stroke-width="1"/>\n';

    // X axis date labels
    for (var xi = 0; xi < n; xi += labelStep) {
      var xpx = xPos(xi);
      var lbl = dates[xi] ? dates[xi].slice(5) : '';
      svg += '<text x="' + xpx.toFixed(1) + '" y="' + (padT + innerH + 14) + '" text-anchor="middle" font-size="10" fill="#94a3b8">' + escapeHtml(lbl) + '</text>\n';
    }
    // Always show last date if not already shown
    if ((n - 1) % labelStep !== 0 && n > 1) {
      svg += '<text x="' + xPos(n - 1).toFixed(1) + '" y="' + (padT + innerH + 14) + '" text-anchor="middle" font-size="10" fill="#94a3b8">' + escapeHtml(dates[n - 1].slice(5)) + '</text>\n';
    }

    // Shaded areas + polylines
    activeSeries.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return xPos(i).toFixed(1) + ',' + yPos(v).toFixed(1); }).join(' ');
      // Light fill area
      var areaFirst = xPos(0).toFixed(1) + ',' + (padT + innerH);
      var areaLast  = xPos(n - 1).toFixed(1) + ',' + (padT + innerH);
      svg += '<polygon points="' + areaFirst + ' ' + pts + ' ' + areaLast + '" fill="' + s.color + '" fill-opacity="0.08"/>\n';
      // Line
      svg += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>\n';
      // Dots (only when few data points)
      if (n <= 35) {
        s.values.forEach(function (v, i) {
          if (v === 0) return;
          svg += '<circle cx="' + xPos(i).toFixed(1) + '" cy="' + yPos(v).toFixed(1) + '" r="3.5" fill="' + s.color + '" stroke="#fff" stroke-width="1.5"/>\n';
        });
      }
    });

    svg += '</svg>';

    // Legend
    var legend = '<div class="rrp-linechart-legend">';
    activeSeries.forEach(function (s) {
      legend += '<span class="rrp-lc-legend-item"><span class="rrp-lc-swatch" style="background:' + s.color + '"></span>' + escapeHtml(s.status) + '</span>';
    });
    legend += '</div>';

    return svg + legend;
  }

  // ── Programs Management ───────────────────────────────────────────────────
  function renderProgramManagement(container, backFn) {
    container.innerHTML =
      '<div class="rrp-mgmt-page-header">' +
        '<button type="button" class="rrp-btn secondary" id="rrp-prog-back">&#8592; Back</button>' +
        '<h1>&#127979; Program Management</h1>' +
        '<span></span>' +
      '</div>' +
      '<p style="font-size:.88rem;color:var(--rrp-text-muted);margin-bottom:1rem">Manage program directors for each degree program. Changes are saved to the portal configuration.</p>' +
      '<div id="rrp-programs-body"><p class="rrp-loading">Loading programs&hellip;</p></div>';

    document.getElementById('rrp-prog-back').addEventListener('click', function () {
      if (backFn) backFn(); else renderCoordinatorDashboard(container);
    });

    Promise.all([
      api('GET', '/config'),
      api('GET', '/reviewers')
    ]).then(function (results) {
      var config    = results[0];
      var reviewers = (results[1].reviewers || results[1] || []);
      var programs  = (config.programs || []).slice(); // copy

      // Build reviewer id → object map
      var reviewerMap = {};
      reviewers.forEach(function (r) { reviewerMap[r.id] = r; });

      var schools = ['Business', 'Education', 'Technology'];
      var html = '';

      schools.forEach(function (school) {
        var schoolProgs = programs.filter(function (p) { return p.school === school; });
        if (!schoolProgs.length) return;
        html +=
          '<div class="rrp-analytics-card rrp-prog-school-section">' +
            '<h2 class="rrp-prog-school-title">School of ' + escapeHtml(school) + ' &nbsp;<small style="font-weight:400;color:var(--rrp-text-muted);font-size:.8rem">' + schoolProgs.length + ' programs</small></h2>' +
            '<div class="rrp-prog-header"><span>Program</span><span>Level</span><span>Program Director</span><span>Actions</span></div>';

        schoolProgs.forEach(function (prog) {
          var dir  = reviewerMap[prog.programDirectorId];
          var dirDisplay = dir
            ? escapeHtml(dir.name)
            : (prog.programDirectorId ? escapeHtml(prog.programDirectorId) : '<em style="color:var(--rrp-text-muted)">Not assigned</em>');
          var levelBadge = LEVEL_BADGES[prog.level] || escapeHtml(prog.level || '');

          var reviewerOptions = '<option value="">&#8212; None &#8212;</option>' +
            reviewers.map(function (r) {
              return '<option value="' + escapeHtml(r.id) + '"' + (r.id === prog.programDirectorId ? ' selected' : '') + '>' + escapeHtml(r.name) + '</option>';
            }).join('');

          html +=
            '<div class="rrp-prog-row" data-prog-id="' + escapeHtml(prog.id) + '">' +
              '<span class="rrp-prog-name">' + escapeHtml(prog.label) + '</span>' +
              '<span>' + levelBadge + '</span>' +
              '<span class="rrp-prog-director" data-field="director">' + dirDisplay + '</span>' +
              '<span><button class="rrp-btn rrp-btn-sm" data-edit-prog="' + escapeHtml(prog.id) + '">&#9998; Edit</button></span>' +
            '</div>' +
            '<div class="rrp-prog-edit-row" id="rrp-prog-edit-' + escapeHtml(prog.id) + '" style="display:none;">' +
              '<span class="rrp-prog-name" style="font-style:italic;color:var(--rrp-text-muted)">' + escapeHtml(prog.label) + '</span>' +
              '<span>' + levelBadge + '</span>' +
              '<span><select class="rrp-input rrp-prog-dir-select" style="font-size:.83rem;padding:.3rem .5rem;">' + reviewerOptions + '</select></span>' +
              '<span style="display:flex;gap:.4rem;align-items:center;">' +
                '<button class="rrp-btn rrp-btn-sm" data-save-prog="' + escapeHtml(prog.id) + '">&#10003; Save</button>' +
                '<button class="rrp-btn secondary rrp-btn-sm" data-cancel-prog="' + escapeHtml(prog.id) + '">Cancel</button>' +
                '<span class="rrp-prog-save-msg" style="font-size:.78rem;"></span>' +
              '</span>' +
            '</div>';
        });

        html += '</div>';
      });

      var body = document.getElementById('rrp-programs-body');
      if (body) body.innerHTML = html;

      // ── Event listeners ──────────────────────────────────────────────────
      container.querySelectorAll('[data-edit-prog]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-edit-prog');
          // Collapse any other open edit rows first
          container.querySelectorAll('.rrp-prog-edit-row').forEach(function (r) { r.style.display = 'none'; });
          var editRow = document.getElementById('rrp-prog-edit-' + id);
          if (editRow) editRow.style.display = 'grid';
        });
      });

      container.querySelectorAll('[data-cancel-prog]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var editRow = document.getElementById('rrp-prog-edit-' + btn.getAttribute('data-cancel-prog'));
          if (editRow) editRow.style.display = 'none';
        });
      });

      container.querySelectorAll('[data-save-prog]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id      = btn.getAttribute('data-save-prog');
          var editRow = document.getElementById('rrp-prog-edit-' + id);
          var select  = editRow ? editRow.querySelector('.rrp-prog-dir-select') : null;
          var msgEl   = editRow ? editRow.querySelector('.rrp-prog-save-msg')   : null;
          if (!select) return;

          var newDirId = select.value;
          var idx = -1;
          for (var i = 0; i < programs.length; i++) { if (programs[i].id === id) { idx = i; break; } }
          if (idx === -1) return;
          programs[idx] = Object.assign({}, programs[idx], { programDirectorId: newDirId });

          btn.disabled = true;
          btn.textContent = 'Saving…';
          if (msgEl) msgEl.innerHTML = '';

          api('PUT', '/config', { programs: programs }).then(function () {
            // Update display row
            var row = container.querySelector('[data-prog-id="' + id + '"]');
            if (row) {
              var dirCell = row.querySelector('[data-field="director"]');
              if (dirCell) {
                var updatedDir = reviewerMap[newDirId];
                dirCell.innerHTML = updatedDir ? escapeHtml(updatedDir.name) : (newDirId ? escapeHtml(newDirId) : '<em style="color:var(--rrp-text-muted)">Not assigned</em>');
              }
            }
            if (editRow) editRow.style.display = 'none';
            btn.disabled = false;
            btn.textContent = '\u2713 Save';
          }).catch(function (err) {
            if (msgEl) msgEl.innerHTML = '<span class="rrp-error">' + escapeHtml((err && err.data && err.data.error) || 'Save failed') + '</span>';
            btn.disabled = false;
            btn.textContent = '\u2713 Save';
          });
        });
      });

    }).catch(function () {
      var body = document.getElementById('rrp-programs-body');
      if (body) body.innerHTML = '<div class="rrp-error">Failed to load programs. Please try again.</div>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
