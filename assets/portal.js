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
        var inReview = mine.filter(function (s) { var st = (s.status || '').toLowerCase(); return st !== 'draft' && st !== 'approved' && st !== 'rejected'; }).length;
        var approved = mine.filter(function (s) { return (s.status || '').toLowerCase() === 'approved'; }).length;
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
        filtered = mine.filter(function (s) { return (s.status || '').toLowerCase() === 'approved'; });
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
          var st = (s.status || '').toLowerCase();
          var badgeCls = st === 'approved' ? 'rrp-dec-approved' :
                         (st === 'rejected' ? 'rrp-dec-rejected' :
                         (st === 'draft'    ? 'rrp-dec-pending'  : 'rrp-dec-pending'));
          return '<li class="rrp-sub-item">' +
            '<div class="rrp-sub-item-header">' +
              '<strong>' + escapeHtml(s.title || 'Untitled') + '</strong>' +
              '<span class="rrp-decision-badge ' + badgeCls + '">' + escapeHtml(s.status || 'Unknown') + '</span>' +
            '</div>' +
            '<div class="rrp-sub-item-meta">' +
              '<span>' + escapeHtml(s.id) + '</span>' +
              '<span>' + escapeHtml(s.type || '—') + '</span>' +
              (s.createdAt ? '<span>' + new Date(s.createdAt).toLocaleDateString() + '</span>' : '') +
            '</div>' +
            '<button type="button" class="rrp-btn secondary" data-detail="' + escapeHtml(s.id) + '">View Details</button>' +
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

    container.innerHTML =
      '<h1>New Submission</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom:1rem;" data-back>&#8592; Back to Dashboard</button>' +
      '<div id="rrp-form-errors"></div>' +
      '<form id="rrp-submit-form" novalidate>' +
        '<div class="rrp-form-block">' +
          '<label>Submission type *</label>' +
          '<select name="submissionType" required>' +
            '<option value="">&#8212; select type &#8212;</option>' +
            '<option value="dissertation">Doctoral Dissertation</option>' +
            '<option value="capstone">Capstone Project</option>' +
            '<option value="research-paper">Research Paper</option>' +
            '<option value="grant-proposal">Grant Proposal</option>' +
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
              '<li><button type="button" class="rrp-nav-link" id="rrp-coord-manage-reviewers-btn">&#128296; Reviewer Pool</button></li>' +
              '<li><button type="button" class="rrp-nav-link" data-view="analytics">&#128202; Analytics</button></li>' +
              '<li><button type="button" class="rrp-nav-link" data-view="overdue">&#128680; Overdue Submissions</button></li>' +
              '<li><button type="button" class="rrp-nav-link" data-view="public">&#127760; Public submissions</button></li>' +
            '</ul>' +
          '</div>' +
          '<div id="rrp-coord-reviewer-pool" style="margin-top:1rem;"></div>' +
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
      });
    });

    // Manage Reviewer Pool toggle
    document.getElementById('rrp-coord-manage-reviewers-btn').addEventListener('click', function () {
      var poolEl = document.getElementById('rrp-coord-reviewer-pool');
      if (poolEl.innerHTML) { poolEl.innerHTML = ''; return; }
      poolEl.innerHTML = '<p class="rrp-loading">Loading reviewers&hellip;</p>';
      api('GET', '/reviewers')
        .then(function (res) {
          var list = res.reviewers || [];
          poolEl.innerHTML =
            '<div class="rrp-nav-card">' +
              '<div class="rrp-nav-card-title">Reviewer Pool (' + list.length + ')</div>' +
              '<ul class="rrp-list" style="max-height:260px;overflow-y:auto;">' +
              list.map(function (r) {
                return '<li style="font-size:.82rem;padding:.4rem 0;border-bottom:1px solid #f0f0f0;">' +
                  '<strong>' + escapeHtml(r.name || r.email) + '</strong><br>' +
                  '<span style="color:var(--rrp-text-muted)">' + escapeHtml(r.email) + '</span><br>' +
                  '<span style="font-size:.75rem;color:#1d6fa4">' + escapeHtml((r.submissionTypes || []).join(', ')) + '</span>' +
                  '</li>';
              }).join('') +
              '</ul>' +
            '</div>';
        })
        .catch(function () {
          poolEl.innerHTML = '<div class="rrp-error">Unable to load reviewers.</div>';
        });
    });

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
        return st !== 'draft' && st !== 'approved' && st !== 'rejected' && st !== 'submitted';
      }).length;
      var approved = all.filter(function (s) { return (s.status || '').toLowerCase() === 'approved'; }).length;

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
        filtered = all.filter(function (s) { return (s.status || '').toLowerCase() === 'approved'; });
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
          var st  = (s.status || '').toLowerCase();
          var cls = st === 'approved' ? 'rrp-dec-approved' : (st === 'rejected' ? 'rrp-dec-rejected' : 'rrp-dec-pending');
          var sum = summary[s.id];
          var hasAssignment = sum && (sum.reviewStages || []).some(function (rs) { return (rs.reviewers || []).length > 0; });
          return '<li class="rrp-sub-item">' +
            '<div class="rrp-sub-item-header">' +
              '<strong>' + escapeHtml(s.title || 'Untitled') + '</strong>' +
              '<span class="rrp-decision-badge ' + cls + '">' + escapeHtml(s.status || 'Unknown') + '</span>' +
            '</div>' +
            '<div class="rrp-sub-item-meta">' +
              '<span>' + escapeHtml(s.id) + '</span>' +
              '<span>' + escapeHtml(s.type || '\u2014') + '</span>' +
              '<span>' + escapeHtml(s.submitterName || s.submitterEmail || '') + '</span>' +
              (s.createdAt ? '<span>' + new Date(s.createdAt).toLocaleDateString() + '</span>' : '') +
            '</div>' +
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

      api('GET', '/reviewers?submissionType=' + encodeURIComponent(sub.type || ''))
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
                  '<span><strong>Type:</strong> ' + escapeHtml(sub.type || '\u2014') + '</span>' +
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
                  '<span>' + escapeHtml(s.type || '') + '</span>' +
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
      '<h1>Analytics</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom: 1rem;" data-back>← Back</button>' +
      '<div id="rrp-analytics-content" class="rrp-analytics-content">Loading analytics…</div>' +
      '<div class="rrp-analytics-actions" style="margin-top: 1rem;"><button class="rrp-btn" id="rrp-export-csv">Export CSV</button><button class="rrp-btn" id="rrp-export-xlsx" style="margin-left:0.5rem;">Export XLSX</button></div>';

    container.querySelector('[data-back]').addEventListener('click', function () { if (typeof backFn === 'function') backFn(); else renderSelection(container); });

    Promise.all([
      api('GET', '/analytics/workflow'),
      api('GET', '/analytics/performance')
    ]).then(function (results) {
      var w = results[0];
      var p = results[1];
      var el = document.getElementById('rrp-analytics-content');
      el.innerHTML =
        '<p><strong>Total submissions:</strong> ' + (w.totalSubmissions || 0) + '</p>' +
        '<p><strong>Average stages per submission:</strong> ' + (w.averageStages || 0) + '</p>' +
        '<p><strong>Mean reviewer load:</strong> ' + (w.meanReviewerLoad || 0) + '</p>' +
        '<p><strong>Finalized submissions:</strong> ' + (p.finalizedCount || 0) + '</p>' +
        '<p><strong>In-progress submissions:</strong> ' + (p.inProgressCount || 0) + '</p>' +
        '<p><strong>Average time to decision (days):</strong> ' + (p.averageTimeToDecisionDays || 0) + '</p>' +
        '<p><strong>Late review alerts:</strong> ' + (p.lateReviewAlerts || 0) + '</p>';

      document.getElementById('rrp-export-csv').addEventListener('click', function () {
        api('GET', '/reports/export?type=workflow&format=csv').then(function (resp) {
          var blob = new Blob([atob(resp.content)], { type: 'text/csv' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = resp.filename || 'rrp-workflow.csv';
          a.click();
        }).catch(function () {
          alert('Export failed');
        });
      });

      document.getElementById('rrp-export-xlsx').addEventListener('click', function () {
        api('GET', '/reports/export?type=workflow&format=xlsx').then(function (resp) {
          var blob = new Blob([atob(resp.content)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = resp.filename || 'rrp-workflow.xlsx';
          a.click();
        }).catch(function () {
          alert('Export failed');
        });
      });

    }).catch(function (err) {
      document.getElementById('rrp-analytics-content').innerHTML = '<div class="rrp-error">Unable to load analytics. Please login and try again.</div>';
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
      var s = (status || '').toLowerCase();
      if (s === 'approved') return 'approved';
      if (s === 'rejected' || s.indexOf('revision') !== -1) return 'action';
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
          var sc  = classifyStatus(item.status);
          var cls = sc === 'approved' ? 'rrp-dec-approved' : (sc === 'action' ? 'rrp-dec-revision' : 'rrp-dec-pending');
          return '<li class="rrp-sub-item">' +
            '<div class="rrp-sub-item-header">' +
              '<strong>' + escapeHtml(item.title || item.id) + '</strong>' +
              '<span class="rrp-decision-badge ' + cls + '">' + escapeHtml(item.status || 'Pending') + '</span>' +
            '</div>' +
            '<div class="rrp-sub-item-meta">' +
              '<span>' + escapeHtml(item.id) + '</span>' +
              '<span>' + escapeHtml(item.type || '\u2014') + '</span>' +
            '</div>' +
            '<button type="button" class="rrp-btn secondary" data-review="' + escapeHtml(item.id) + '">Review</button>' +
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
      '<div class="rrp-form-block"><label>Abstract</label><textarea name="abstract" rows="5">' + escapeHtml(sub.abstract || '') + '</textarea></div>' +
      '<div class="rrp-form-block"><label>Keywords</label><input type="text" name="keywords" value="' + escapeHtml(sub.keywords || '') + '"></div>' +
      '<div class="rrp-form-block"><label>Research area</label><input type="text" name="researchArea" value="' + escapeHtml(sub.researchArea || '') + '"></div>' +
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
      var stagesHtml = (sub.reviewStages || []).map(function (stage, i) {
        var dl = deadlines[i] || {};
        var approved = dl.approved || false;
        var skipped  = stage.skipped || false;
        var decisions = stage.decisions || {};
        var statusClass = skipped ? 'rrp-stage-skipped' : (approved ? 'rrp-stage-approved' : 'rrp-stage-pending');
        var statusLabel = skipped ? 'Skipped' : (approved ? '✓ Approved' : 'In Progress');
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
            '<span><strong>Type:</strong> <span class="rrp-type-badge">' + escapeHtml(sub.type || '—') + '</span></span>' +
            '<span><strong>Status:</strong> <span class="rrp-status">' + escapeHtml(sub.status || '—') + '</span></span>' +
            '<span><strong>Submitted by:</strong> ' + escapeHtml(sub.submitterName || sub.submitterEmail || '—') + '</span>' +
            (sub.createdAt ? '<span><strong>Date:</strong> ' + escapeHtml(new Date(sub.createdAt).toLocaleDateString()) + '</span>' : '') +
          '</div>' +
          (sub.abstract ? '<div class="rrp-detail-abstract"><strong>Abstract</strong><p>' + escapeHtml(sub.abstract) + '</p></div>' : '') +
          (sub.keywords ? '<p><strong>Keywords:</strong> ' + escapeHtml(sub.keywords) + '</p>' : '') +
          (sub.researchArea ? '<p><strong>Research area:</strong> ' + escapeHtml(sub.researchArea) + '</p>' : '') +
        '</div>' +
        ((sub.attachments && sub.attachments.length) ?
          '<div class="rrp-detail-section"><h3>Attachments</h3><ul class="rrp-list">' +
            sub.attachments.map(function (a) {
              return '<li>' + escapeHtml(a.name || a.filename) +
                ' <a class="rrp-btn secondary" target="_blank" href="' + escapeHtml(restBase + '/submissions/' + submissionId + '/attachments/' + encodeURIComponent(a.filename)) + '">Download</a></li>';
            }).join('') +
          '</ul></div>' : '') +
        '<div class="rrp-detail-section"><h3>Review Progress</h3>' + (stagesHtml || '<p>No review stages assigned yet.</p>') + '</div>' +
        (isReviewer ? '<div id="rrp-reviewer-action" class="rrp-detail-section"><h3>Record Your Decision</h3>' + buildReviewerDecisionForm(sub) + '</div>' : '') +
        (isSubmitter && needsRevision ? '<div id="rrp-submitter-revision" class="rrp-detail-section"><h3>Submit Revision</h3>' + buildRevisionForm(sub) + '</div>' : '') +
        (isAdmin ? '<div id="rrp-admin-controls" class="rrp-detail-section"><h3>Administrative Controls</h3>' +
          '<button type="button" class="rrp-btn secondary" id="rrp-skip-stage-btn">Skip Current Stage</button>' +
          '<span id="rrp-skip-msg" style="margin-left:.5rem;"></span>' +
        '</div>' : '');

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
          ['title', 'abstract', 'keywords', 'researchArea'].forEach(function (f) {
            var el2 = revForm.querySelector('[name="' + f + '"]');
            if (el2) updBody[f] = el2.value;
          });
          var msgEl = document.getElementById('rrp-revision-msg');
          msgEl.innerHTML = '<span class="rrp-loading">Saving…</span>';
          // First update content, then mark stage revision submitted
          api('PATCH', '/submissions/' + encodeURIComponent(submissionId), updBody)
            .then(function () {
              var activeStage = getActiveStage(sub.reviewStages || []);
              if (activeStage) {
                return api('PATCH', '/submissions/' + encodeURIComponent(submissionId), { stageRevisionSubmitted: { stageName: activeStage.stageName } });
              }
            })
            .then(function () {
              msgEl.innerHTML = '<span class="rrp-success">Revision submitted.</span>';
              setTimeout(function () { renderSubmissionDetail(submissionId, container, backFn); }, 1400);
            })
            .catch(function (err) {
              msgEl.innerHTML = '<span class="rrp-error">' + escapeHtml((err.data && err.data.error) || 'Failed to submit revision.') + '</span>';
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
    {value: 'doctoral',     label: 'Doctoral (Ph.D. / DBA / Ed.D.)'},
    {value: 'masters',      label: 'Masters'},
    {value: 'bachelors',    label: 'Bachelors'},
    {value: 'certificate',  label: 'Certificate Program'}
  ];

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
              return '<div class="rrp-umr-row">' +
                '<span class="rrp-umr-name"><strong>' + escapeHtml(u.name || u.email) + '</strong></span>' +
                '<span class="rrp-umr-email">' + escapeHtml(u.email) + '</span>' +
                '<span>' + escapeHtml(degree ? degree.label : (u.degree || '—')) + '</span>' +
                '<span class="rrp-umr-types" title="' + escapeHtml(types) + '">' + escapeHtml(types.length > 38 ? types.substring(0, 36) + '…' : types) + '</span>' +
                '<span class="rrp-umr-actions">' +
                  '<button type="button" class="rrp-btn secondary small" data-edit-student="' + u.id + '">Edit</button> ' +
                  '<button type="button" class="rrp-btn danger small"     data-remove-student="' + u.id + '">Remove</button>' +
                '</span>' +
              '</div>';
            }).join('') +
          '</div>';

        el.querySelectorAll('[data-edit-student]').forEach(function (btn) {
          var uid  = parseInt(btn.getAttribute('data-edit-student'), 10);
          var user = users.find(function (u) { return u.id === uid; });
          btn.addEventListener('click', function () {
            renderStudentOnboardForm(container, user, function () { renderStudentManagement(container, backFn); });
          });
        });
        el.querySelectorAll('[data-remove-student]').forEach(function (btn) {
          var uid  = parseInt(btn.getAttribute('data-remove-student'), 10);
          var user = users.find(function (u) { return u.id === uid; });
          btn.addEventListener('click', function () {
            if (!confirm('Remove portal access for ' + escapeHtml(user ? (user.name || user.email) : 'this user') + '?\nThey will lose the Student role but remain as a WordPress user.')) return;
            api('DELETE', '/portal-users/' + uid)
              .then(function ()  { renderStudentManagement(container, backFn); })
              .catch(function () { alert('Failed to remove access. Please try again.'); });
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
    var isEdit = !!(editUser && editUser.id);
    var nameParts = isEdit ? (editUser.name || '').split(' ') : [];
    var state = {
      firstName:             isEdit ? (nameParts[0] || '') : '',
      lastName:              isEdit ? (nameParts.slice(1).join(' ') || '') : '',
      email:                 isEdit ? (editUser.email || '') : '',
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
      if (!isEdit) { payload.email = state.email; payload.password = state.password; payload.role = 'rrp_student'; }
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
          '<div class="rrp-form-row">' +
            '<div class="rrp-form-group"><label>First Name</label><input type="text" id="ob-first-name" class="rrp-input" value="' + escapeHtml(state.firstName) + '" placeholder="First name"></div>' +
            '<div class="rrp-form-group"><label>Last Name</label><input type="text"  id="ob-last-name"  class="rrp-input" value="' + escapeHtml(state.lastName)  + '" placeholder="Last name"></div>' +
          '</div>' +
          (!isEdit ?
            '<div class="rrp-form-group"><label>Email Address <em>*</em></label><input type="email" id="ob-email" class="rrp-input" value="' + escapeHtml(state.email) + '" placeholder="student@cityuniversity.edu"></div>' +
            '<div class="rrp-form-group"><label>Temporary Password</label><input type="text" id="ob-password" class="rrp-input" value="' + escapeHtml(state.password) + '" placeholder="Leave blank to auto-generate">' +
              '<small style="color:var(--rrp-text-muted)">If blank, a secure password is generated automatically.</small></div>'
          : '') +
          '<div id="rrp-ob-step1-msg" style="min-height:1.4rem;"></div>' +
          '<div class="rrp-onboard-actions"><button type="button" class="rrp-btn" id="rrp-ob-next-btn">Continue &#8594;</button></div>';

      } else if (state.step === 2) {
        body =
          '<h2 class="rrp-ob-step-heading">Step 2: Academic Profile</h2>' +
          '<div class="rrp-form-group">' +
            '<label>Degree Program</label>' +
            '<select id="ob-degree" class="rrp-input">' +
              '<option value="">&#8212; Select degree &#8212;</option>' +
              OB_DEGREES.map(function (d) {
                return '<option value="' + escapeHtml(d.value) + '"' + (state.degree === d.value ? ' selected' : '') + '>' + escapeHtml(d.label) + '</option>';
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
            '<button type="button" class="rrp-btn" id="rrp-ob-save-btn">' + (isEdit ? '&#10003; Save Changes' : '&#10003; Create Student') + '</button>' +
          '</div>';
      }

      container.innerHTML =
        '<div class="rrp-onboard-wrap">' +
          '<div class="rrp-onboard-header">' +
            '<button type="button" class="rrp-btn secondary" id="rrp-ob-cancel-btn">&#8592; Back</button>' +
            '<h1>' + (isEdit ? 'Edit Student Profile' : 'Onboard New Student') + '</h1>' +
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
          var em = isEdit ? editUser.email : (container.querySelector('#ob-email') ? container.querySelector('#ob-email').value.trim() : '');
          var pw = isEdit ? '' : (container.querySelector('#ob-password') ? container.querySelector('#ob-password').value : '');
          var msg = container.querySelector('#rrp-ob-step1-msg');
          if (!isEdit && !em) { msg.innerHTML = '<span class="rrp-error">Email is required.</span>'; return; }
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
              return '<div class="rrp-umr-row">' +
                '<span class="rrp-umr-name"><strong>' + escapeHtml(u.name || u.email) + '</strong></span>' +
                '<span class="rrp-umr-email">' + escapeHtml(u.email) + '</span>' +
                '<span>' + escapeHtml(u.department || '—') + '</span>' +
                '<span class="rrp-umr-types" title="' + escapeHtml(types) + '">' + escapeHtml(types.length > 38 ? types.substring(0, 36) + '…' : types) + '</span>' +
                '<span class="rrp-umr-actions">' +
                  '<button type="button" class="rrp-btn secondary small" data-edit-reviewer="' + u.id + '">Edit</button> ' +
                  '<button type="button" class="rrp-btn danger small"     data-remove-reviewer="' + u.id + '">Remove</button>' +
                '</span>' +
              '</div>';
            }).join('') +
          '</div>';

        el.querySelectorAll('[data-edit-reviewer]').forEach(function (btn) {
          var uid  = parseInt(btn.getAttribute('data-edit-reviewer'), 10);
          var user = users.find(function (u) { return u.id === uid; });
          btn.addEventListener('click', function () {
            renderReviewerOnboardForm(container, user, function () { renderReviewerManagement(container, backFn); });
          });
        });
        el.querySelectorAll('[data-remove-reviewer]').forEach(function (btn) {
          var uid  = parseInt(btn.getAttribute('data-remove-reviewer'), 10);
          var user = users.find(function (u) { return u.id === uid; });
          btn.addEventListener('click', function () {
            if (!confirm('Remove portal access for ' + escapeHtml(user ? (user.name || user.email) : 'this user') + '?\nThey will lose the Reviewer role but remain as a WordPress user.')) return;
            api('DELETE', '/portal-users/' + uid)
              .then(function ()  { renderReviewerManagement(container, backFn); })
              .catch(function () { alert('Failed to remove access. Please try again.'); });
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
    var isEdit    = !!(editUser && editUser.id);
    var nameParts = isEdit ? (editUser.name || '').split(' ') : [];

    container.innerHTML =
      '<div class="rrp-onboard-wrap">' +
        '<div class="rrp-onboard-header">' +
          '<button type="button" class="rrp-btn secondary" id="rrp-ob-cancel-btn">&#8592; Back</button>' +
          '<h1>' + (isEdit ? 'Edit Reviewer Profile' : 'Add Reviewer') + '</h1>' +
        '</div>' +
        '<div class="rrp-onboard-body">' +
          (isEdit ? '<p class="rrp-info">Editing: <strong>' + escapeHtml(editUser.email) + '</strong></p>' : '') +
          '<div class="rrp-form-row">' +
            '<div class="rrp-form-group"><label>First Name</label><input type="text" id="ob-first-name" class="rrp-input" value="' + escapeHtml(nameParts[0] || '') + '" placeholder="First name"></div>' +
            '<div class="rrp-form-group"><label>Last Name</label><input type="text" id="ob-last-name" class="rrp-input" value="' + escapeHtml(nameParts.slice(1).join(' ') || '') + '" placeholder="Last name"></div>' +
          '</div>' +
          (!isEdit ?
            '<div class="rrp-form-group"><label>Email Address <em>*</em></label><input type="email" id="ob-email" class="rrp-input" placeholder="reviewer@university.edu"></div>' +
            '<div class="rrp-form-group"><label>Temporary Password</label><input type="text" id="ob-password" class="rrp-input" placeholder="Leave blank to auto-generate"><small style="color:var(--rrp-text-muted)">If blank, a secure password is generated.</small></div>'
          : '') +
          '<div class="rrp-form-row">' +
            '<div class="rrp-form-group"><label>Department / Unit</label><input type="text" id="ob-dept" class="rrp-input" value="' + escapeHtml(isEdit ? (editUser.department || '') : '') + '" placeholder="e.g. Computer Science"></div>' +
            '<div class="rrp-form-group"><label>Expertise / Specialization</label><input type="text" id="ob-expertise" class="rrp-input" value="' + escapeHtml(isEdit ? (editUser.expertise || '') : '') + '" placeholder="e.g. Machine Learning, HCI"></div>' +
          '</div>' +
          '<div class="rrp-form-group">' +
            '<label>Submission Types They Can Review</label>' +
            '<p style="font-size:.83rem;color:var(--rrp-text-muted);margin:.25rem 0 .6rem;">Select all types this reviewer is qualified to evaluate.</p>' +
            '<div class="rrp-checkbox-grid">' +
              OB_ALLOWED_TYPES.map(function (t) {
                var checked = isEdit && (editUser.submissionTypes || []).indexOf(t.value) !== -1;
                return '<label class="rrp-check-chip' + (checked ? ' checked' : '') + '">' +
                  '<input type="checkbox" name="ob-submissionTypes" value="' + escapeHtml(t.value) + '"' + (checked ? ' checked' : '') + '> ' + escapeHtml(t.label) +
                '</label>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div id="rrp-ob-save-msg" style="min-height:1.4rem;margin-top:.5rem;"></div>' +
          '<div class="rrp-onboard-actions">' +
            '<button type="button" class="rrp-btn" id="rrp-ob-save-btn">' + (isEdit ? '&#10003; Save Changes' : '&#10003; Add Reviewer') + '</button>' +
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
      var pw      = isEdit ? '' : (container.querySelector('#ob-password') ? container.querySelector('#ob-password').value : '');
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
      if (!isEdit) { payload.email = em; payload.password = pw; payload.role = 'rrp_reviewer'; }

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
