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

  function renderAnalytics(container) {
    container.innerHTML =
      '<h1>Analytics</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom: 1rem;" data-back>← Back</button>' +
      '<div id="rrp-analytics-content" class="rrp-analytics-content">Loading analytics…</div>' +
      '<div class="rrp-analytics-actions" style="margin-top: 1rem;"><button class="rrp-btn" id="rrp-export-csv">Export CSV</button><button class="rrp-btn" id="rrp-export-xlsx" style="margin-left:0.5rem;">Export XLSX</button></div>';

    container.querySelector('[data-back]').addEventListener('click', function () { renderSelection(container); });

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

  function renderReviewerDashboard(container) {
    container.innerHTML =
      '<h1>Reviewer Dashboard</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom: 1rem;" data-back>← Back</button>' +
      '<div class="rrp-form-block"><label>Reviewer Email</label><input type="email" id="rrp-reviewer-email" placeholder="reviewer@cityu.edu.hk" required></div>' +
      '<button type="button" class="rrp-btn" id="rrp-reviewer-metrics-btn">Load Metrics</button>' +
      '<button type="button" class="rrp-btn secondary" id="rrp-load-templates-btn" style="margin-left:0.5rem;">Load Criteria Templates</button>' +
      '<div id="rrp-reviewer-metrics" style="margin-top:1rem;"></div>' +
      '<div id="rrp-reviewer-templates" style="margin-top:1rem;"></div>' +
      '<div id="rrp-reviewer-rate" style="margin-top:1rem;"></div>' +
      '<div id="rrp-reviewer-coi" style="margin-top:1rem;"></div>';

    container.querySelector('[data-back]').addEventListener('click', function () { renderSelection(container); });

    function showReviewerMetrics(email) {
      var output = document.getElementById('rrp-reviewer-metrics');
      output.innerHTML = '<p class="rrp-loading">Loading reviewer metrics…</p>';

      Promise.all([
        api('GET', '/analytics/reviewer?reviewerEmail=' + encodeURIComponent(email)),
        api('GET', '/reviews?reviewerEmail=' + encodeURIComponent(email)),
        api('GET', '/analytics/workload?reviewerEmail=' + encodeURIComponent(email))
      ]).then(function (results) {
        var metrics = results[0];
        var submissions = results[1].submissions || [];
        var workload = results[2];

        output.innerHTML =
          '<p><strong>Email:</strong> ' + escapeHtml(metrics.reviewerEmail || email) + '</p>' +
          '<p><strong>Total assigned:</strong> ' + (metrics.totalAssigned || 0) + '</p>' +
          '<p><strong>Pending:</strong> ' + (metrics.pending || 0) + '</p>' +
          '<p><strong>Approved:</strong> ' + (metrics.approved || 0) + '</p>' +
          '<p><strong>Rejected:</strong> ' + (metrics.rejected || 0) + '</p>' +
          '<p><strong>Needs revision:</strong> ' + (metrics.needsRevision || 0) + '</p>' +
          '<p><strong>Overdue:</strong> ' + (metrics.overdue || 0) + '</p>' +
          '<p><strong>Active submissions:</strong> ' + ((workload.activeSubmissions && workload.activeSubmissions.length) || 0) + '</p>';

        if (submissions.length) {
          output.innerHTML += '<h3>Assigned submissions</h3><ul class="rrp-list">' + submissions.map(function (item) {
            return '<li><strong>' + escapeHtml(item.title || item.id) + '</strong> · ' + escapeHtml(item.status || 'N/A') +
              ' <button type="button" class="rrp-btn secondary" data-review="' + escapeHtml(item.id) + '">Review</button></li>';
          }).join('') + '</ul>';
          output.querySelectorAll('[data-review]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              renderSubmissionDetail(btn.getAttribute('data-review'), container, function () { renderReviewerDashboard(container); });
            });
          });
        }
      }).catch(function () {
        output.innerHTML = '<div class="rrp-error">Unable to load reviewer metrics.</div>';
      });
    }

    function loadTemplates() {
      var output = document.getElementById('rrp-reviewer-templates');
      output.innerHTML = '<p class="rrp-loading">Loading review templates…</p>';
      api('GET', '/config/review-templates').then(function (resp) {
        output.innerHTML = '<h3>Review Criteria Templates</h3>';
        if (Array.isArray(resp)) {
          output.innerHTML += '<ul class="rrp-list">' + resp.map(function (template) {
            return '<li><strong>' + escapeHtml(template.name || 'Unnamed') + '</strong> ⚖ ' + escapeHtml((template.criteria || []).map(function (c) { return c.label + ' (' + c.weight + '%)'; }).join(', ')) + '</li>';
          }).join('') + '</ul>';
        } else {
          output.innerHTML += '<p>No templates available.</p>';
        }
      }).catch(function () {
        output.innerHTML = '<div class="rrp-error">Unable to load review templates.</div>';
      });
    }

    function ratingForm() {
      var container = document.getElementById('rrp-reviewer-rate');
      container.innerHTML =
        '<h3>Submit Review Rating</h3>' +
        '<div class="rrp-form-block"><label>Submission ID</label><input type="text" id="rrp-rating-submission-id" placeholder="SUB-2026-001" required></div>' +
        '<div class="rrp-form-block"><label>Review comments</label><textarea id="rrp-rating-comments" rows="3" placeholder="Add your assessment"></textarea></div>' +
        '<div class="rrp-form-block"><label>Ratings (JSON array of name/score)</label><textarea id="rrp-rating-values" rows="3" placeholder="[{\"label\":\"Originality\",\"score\":4}]" required></textarea></div>' +
        '<button type="button" class="rrp-btn" id="rrp-reviewer-submit-rating">Submit Rating</button>' +
        '<div id="rrp-reviewer-rating-message" style="margin-top:.75rem;"></div>';

      document.getElementById('rrp-reviewer-submit-rating').addEventListener('click', function () {
        var email = document.getElementById('rrp-reviewer-email').value;
        var submissionId = document.getElementById('rrp-rating-submission-id').value;
        var comments = document.getElementById('rrp-rating-comments').value;
        var ratingsRaw = document.getElementById('rrp-rating-values').value;

        if (!email || !submissionId || !ratingsRaw) {
          document.getElementById('rrp-reviewer-rating-message').innerHTML = '<div class="rrp-error">Please fill in required rating fields.</div>';
          return;
        }

        var ratings;
        try { ratings = JSON.parse(ratingsRaw); } catch (e) {
          document.getElementById('rrp-reviewer-rating-message').innerHTML = '<div class="rrp-error">Ratings JSON invalid.</div>';
          return;
        }

        api('POST', '/reviews/rate', { reviewerEmail: email, submissionId: submissionId, ratings: ratings, comments: comments })
          .then(function () { document.getElementById('rrp-reviewer-rating-message').innerHTML = '<div class="rrp-success">Rating submitted.</div>'; })
          .catch(function () { document.getElementById('rrp-reviewer-rating-message').innerHTML = '<div class="rrp-error">Failed to submit rating.</div>'; });
      });
    }

    function conflictForm() {
      var container = document.getElementById('rrp-reviewer-coi');
      container.innerHTML =
        '<h3>Declare Conflict of Interest</h3>' +
        '<div class="rrp-form-block"><label>Submission ID</label><input type="text" id="rrp-coi-submission-id" placeholder="SUB-2026-001" required></div>' +
        '<div class="rrp-form-block"><label>Reason</label><textarea id="rrp-coi-reason" rows="2" placeholder="Describe conflict"></textarea></div>' +
        '<button type="button" class="rrp-btn" id="rrp-reviewer-declare-coi">Declare Conflict</button>' +
        '<div id="rrp-reviewer-coi-message" style="margin-top:.75rem;"></div>';

      document.getElementById('rrp-reviewer-declare-coi').addEventListener('click', function () {
        var email = document.getElementById('rrp-reviewer-email').value;
        var submissionId = document.getElementById('rrp-coi-submission-id').value;
        var reason = document.getElementById('rrp-coi-reason').value;

        if (!email || !submissionId || !reason) {
          document.getElementById('rrp-reviewer-coi-message').innerHTML = '<div class="rrp-error">All fields are required.</div>';
          return;
        }

        api('POST', '/conflicts', { reviewerEmail: email, submissionId: submissionId, reason: reason })
          .then(function () { document.getElementById('rrp-reviewer-coi-message').innerHTML = '<div class="rrp-success">Conflict declared.</div>'; })
          .catch(function () { document.getElementById('rrp-reviewer-coi-message').innerHTML = '<div class="rrp-error">Failed to declare conflict.</div>'; });
      });
    }

    document.getElementById('rrp-reviewer-metrics-btn').addEventListener('click', function () {
      var email = document.getElementById('rrp-reviewer-email').value;
      if (!email) {
        alert('Please enter reviewer email.');
        return;
      }
      showReviewerMetrics(email);
      ratingForm();
      conflictForm();
    });

    document.getElementById('rrp-load-templates-btn').addEventListener('click', loadTemplates);
  }

  function renderPublic(container) {
    container.innerHTML =
      '<h1>Research & symposium</h1>' +
      '<button type="button" class="rrp-btn secondary" style="margin-bottom: 1rem;" data-back>← Back</button>' +
      '<p style="color: var(--rrp-text-muted);">Accepted and published work.</p>' +
      '<div id="rrp-public-list"></div>';

    container.querySelector('[data-back]').addEventListener('click', function () { renderSelection(container); });

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
    renderSelection(el);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
