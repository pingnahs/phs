/* admin.js — admin dashboard shell + all screens. Server-side authorization
   is the only authority; the UI merely reflects it. */
(function () {
  'use strict';
  var SESSION_KEY = 'phs_admin_session';
  var BASE = '../';
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function esc(s) { return PHS.esc(s); }
  function dt(s) { var x = String(s || '').slice(0, 16).replace('T', ' '); return x || '—'; }

  // ------------------------------------------------------------ session

  function getSess() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (s && s.token && Date.parse(s.expiresAt) > Date.now()) return s;
      if (s) localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    return null;
  }
  function apiA(action, data) {
    var s = getSess();
    return PHS.api(action, Object.assign({ sessionToken: s ? s.token : '' }, data || {}))
      .catch(function (e) {
        if (e.code === 'AUTH_EXPIRED' || e.code === 'AUTH_INVALID') {
          localStorage.removeItem(SESSION_KEY);
          location.replace('login.html?exp=1');
          e.handled = true;
        }
        throw e;
      });
  }

  // ------------------------------------------------------------ status maps

  var STATUS = {
    PENDING: { l: 'যাচাই চলছে', i: '🔎', c: 'badge-pending' },
    APPROVED: { l: 'অনুমোদিত', i: '✅', c: 'badge-published' },
    REJECTED: { l: 'প্রত্যাখ্যাত', i: '❌', c: 'badge-archived' },
    CANCELLED: { l: 'বাতিল', i: '🚫', c: 'badge-draft' },
    PAID: { l: 'পরিশোধিত', i: '✅', c: 'badge-published' },
    PARTIAL: { l: 'আংশিক', i: '🟡', c: 'badge-under' },
    DUE: { l: 'বকেয়া', i: '⏳', c: 'badge-archived' },
    NOT_APPLICABLE: { l: 'প্রযোজ্য নয়', i: '—', c: 'badge-draft' },
    DRAFT: { l: 'খসড়া', i: '📝', c: 'badge-draft' },
    PUBLISHED: { l: 'প্রকাশিত', i: '🌐', c: 'badge-published' },
    ARCHIVED: { l: 'আর্কাইভড', i: '📦', c: 'badge-archived' },
    NEW: { l: 'নতুন', i: '🆕', c: 'badge-new' },
    UNDER_REVIEW: { l: 'যাচাইয়াধীন', i: '🔎', c: 'badge-under' },
    COMPLETED: { l: 'সম্পন্ন', i: '✅', c: 'badge-completed' },
    RESOLVED: { l: 'সমাধান', i: '✅', c: 'badge-resolved' },
    ACTIVE: { l: 'সক্রিয়', i: '✅', c: 'badge-active' },
    INACTIVE: { l: 'নিষ্ক্রিয়', i: '⏸️', c: 'badge-inactive' }
  };
  function badge(s) {
    var m = STATUS[String(s || '')] || { l: String(s || '—'), i: '•', c: 'badge-draft' };
    return '<span class="badge ' + m.c + '">' + m.i + ' ' + esc(m.l) + '</span>';
  }

  // ------------------------------------------------------------ modal / confirm

  function modal(title, bodyHtml, opts) {
    opts = opts || {};
    var root = el('div', 'modal-root');
    root.innerHTML = '<div class="modal-backdrop"></div>' +
      '<div class="modal' + (opts.wide ? ' modal-wide' : '') +
      '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="modal-head"><h2>' + esc(title) + '</h2>' +
      '<button type="button" class="modal-x" aria-label="বন্ধ করুন">✕</button></div>' +
      '<div class="modal-body"></div></div>';
    root.querySelector('.modal-body').innerHTML = bodyHtml;
    document.body.appendChild(root);
    var close = function () {
      document.removeEventListener('keydown', onKey);
      root.remove();
    };
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    root.querySelector('.modal-x').addEventListener('click', close);
    root.querySelector('.modal-backdrop').addEventListener('click', close);
    var f = root.querySelector('.modal-body input,.modal-body select,.modal-body textarea,button');
    if (f) f.focus();
    return { root: root, body: root.querySelector('.modal-body'), close: close };
  }
  function confirmBn(title, msg, okLabel, danger) {
    return new Promise(function (res) {
      var m = modal(title,
        '<p>' + esc(msg) + '</p><div class="form-actions">' +
        '<button type="button" class="btn ' + (danger ? '' : 'btn-primary') +
        '" id="cf-y" style="' + (danger ? 'background:var(--danger)' : '') + '">' +
        esc(okLabel || 'নিশ্চিত করুন') + '</button>' +
        '<button type="button" class="btn btn-outline" id="cf-n">বাতিল</button></div>');
      m.root.querySelector('#cf-y').addEventListener('click', function () { m.close(); res(true); });
      m.root.querySelector('#cf-n').addEventListener('click', function () { m.close(); res(false); });
    });
  }

  // ------------------------------------------------------------ shared widgets

  function fieldHtml(f, val) {
    var id = 'fld-' + f.k + '-' + Math.random().toString(36).slice(2, 7);
    var v = val === undefined || val === null ? '' : String(val);
    if (f.type === 'textarea') {
      return '<div class="field"><label' + (f.req ? ' class="req"' : '') + ' for="' + id + '">' +
        esc(f.label) + '</label><textarea id="' + id + '" name="' + f.k + '" rows="' +
        (f.rows || 4) + '">' + esc(v) + '</textarea>' +
        (f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '') +
        '<span class="err" aria-live="polite"></span></div>';
    }
    if (f.type === 'select') {
      return '<div class="field"><label' + (f.req ? ' class="req"' : '') + ' for="' + id + '">' +
        esc(f.label) + '</label><select id="' + id + '" name="' + f.k + '">' +
        f.options.map(function (o) {
          return '<option value="' + esc(o.v) + '"' + (o.v === v ? ' selected' : '') + '>' +
            esc(o.l) + '</option>';
        }).join('') + '</select><span class="err"></span></div>';
    }
    if (f.type === 'checkbox') {
      return '<div class="field field-check"><label><input type="checkbox" id="' + id +
        '" name="' + f.k + '"' + (v === 'TRUE' || v === true ? ' checked' : '') + '> ' +
        esc(f.label) + '</label><span class="err"></span></div>';
    }
    if (f.type === 'image') {
      return '<div class="field"><label' + (f.req ? ' class="req"' : '') + '>' + esc(f.label) +
        '</label><input type="text" name="' + f.k + '" value="' + esc(v) +
        '" placeholder="File ID বা URL (ঐচ্ছিক — আপলোড করলে স্বয়ংক্রিয় ভরবে)">' +
        '<div class="file-row"><input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" data-upload="' +
        f.purpose + '"><span class="file-name"></span></div>' +
        '<div class="img-preview">' + (v ? PHS.imgHtml(v, '', 'img-preview-thumb', 200) : '') + '</div>' +
        '<span class="err" aria-live="polite"></span></div>';
    }
    return '<div class="field"><label' + (f.req ? ' class="req"' : '') + ' for="' + id + '">' +
      esc(f.label) + '</label><input id="' + id + '" name="' + f.k + '" type="' +
      (f.type || 'text') + '" value="' + esc(v) + '"' +
      (f.min !== undefined ? ' min="' + f.min + '"' : '') +
      (f.max !== undefined ? ' max="' + f.max + '"' : '') +
      (f.step ? ' step="' + f.step + '"' : '') + '>' +
      (f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '') +
      '<span class="err" aria-live="polite"></span></div>';
  }
  function fieldErr(input, msg) {
    var w = input.closest('.field');
    var e = w ? w.querySelector('.err') : null;
    if (e) e.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  /** Upload an image through the audited admin endpoint; fills sibling input. */
  function bindUploads(body) {
    body.addEventListener('change', function (e) {
      var inp = e.target.closest('input[data-upload]');
      if (!inp || !inp.files || !inp.files[0]) return;
      var f = inp.files[0];
      var nameEl = inp.parentNode.querySelector('.file-name');
      if (!/^image\/(jpe?g|png|webp)$/.test(f.type)) {
        inp.value = ''; PHS.toast('শুধু JPG/PNG/WebP ছবি দিন।', 'error'); return;
      }
      if (f.size > 5 * 1024 * 1024) {
        inp.value = ''; PHS.toast('ছবিটি ৫ MB-এর বেশি।', 'error'); return;
      }
      nameEl.textContent = 'আপলোড হচ্ছে…';
      var fr = new FileReader();
      fr.onload = function () {
        apiA('uploadMedia', {
          purpose: inp.getAttribute('data-upload'),
          fileName: f.name, mimeType: f.type,
          dataBase64: String(fr.result).replace(/^data:[^,]+,/, '')
        }).then(function (r) {
          var holder = inp.closest('.field').querySelector('input[type="text"]');
          if (holder) holder.value = r.data.fileId;
          var preview = inp.closest('.field').querySelector('.img-preview');
          if (preview) preview.innerHTML = PHS.imgHtml(r.data.fileId, '', 'img-preview-thumb', 200);
          nameEl.textContent = f.name + ' ✓';
          PHS.toast('ছবি আপলোড হয়েছে।');
        }).catch(function (err) {
          nameEl.textContent = '';
          PHS.toast(err.message || 'আপলোড ব্যর্থ।', 'error');
        });
      };
      fr.readAsDataURL(f);
    });
  }
  function pager(host, page, totalPages, cb) {
    host.innerHTML = '';
    totalPages = totalPages || 1;
    if (totalPages <= 1) return;
    var w = el('div', 'pager');
    function b(label, p, dis, cur) {
      var x = el('button', 'chip', label);
      x.type = 'button';
      if (cur) x.setAttribute('aria-current', 'page');
      if (dis) x.disabled = true;
      x.addEventListener('click', function () { cb(p); });
      w.appendChild(x);
    }
    b('‹', page - 1, page <= 1);
    var s = Math.max(1, page - 2), e2 = Math.min(totalPages, s + 4);
    s = Math.max(1, e2 - 4);
    if (s > 1) { b(PHS.bnDigits(1), 1); if (s > 2) w.appendChild(el('span', 'muted', '…')); }
    for (var i = s; i <= e2; i++) b(PHS.bnDigits(i), i, false, i === page);
    if (e2 < totalPages) {
      if (e2 < totalPages - 1) w.appendChild(el('span', 'muted', '…'));
      b(PHS.bnDigits(totalPages), totalPages);
    }
    b('›', page + 1, page >= totalPages);
    host.appendChild(w);
  }
  function table(host, cols, rows, emptyMsg) {
    if (!rows.length) {
      host.innerHTML = '<p class="loading">' + esc(emptyMsg || 'কোনো তথ্য পাওয়া যায়নি।') + '</p>';
      return;
    }
    host.innerHTML = '<div class="twrap"><table class="atable"><thead><tr>' +
      cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + cols.map(function (c) {
          var v = c.fmt ? c.fmt(r) : esc(r[c.k] === undefined || r[c.k] === null ? '' : r[c.k]);
          return '<td data-l="' + esc(c.label) + '"' + (c.num ? ' class="num"' : '') + '>' + v + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function loadInto(box, fn) {
    box.innerHTML = '<p class="loading">লোড হচ্ছে…</p>';
    fn().catch(function (e) {
      if (e.handled) return;
      box.innerHTML = '';
      box.appendChild(el('p', 'load-error', e.message || 'কিছু একটা সমস্যা হয়েছে।'));
      var b = el('button', 'btn btn-outline', 'আবার চেষ্টা করুন');
      b.type = 'button';
      b.addEventListener('click', function () { loadInto(box, fn); });
      box.appendChild(b);
    });
  }
  function csvDownload(res) {
    var blob = new Blob(['\uFEFF' + res.data.csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = res.data.filename || 'export.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    PHS.toast(PHS.bnNumber(res.data.rowCount) + ' সারি ডাউনলোড হয়েছে।');
  }
  /** §Finance/§10: dependency-free income-vs-expenditure bar chart. rows:
   *  [{label, income, expenditure}], oldest→newest. No chart library used —
   *  keeps the product's zero-dependency footprint and works offline. */
  function finChart(host, rows) {
    if (!rows || !rows.length) { host.innerHTML = '<p class="loading">চার্টের জন্য যথেষ্ট তথ্য নেই।</p>'; return; }
    var max = 1;
    rows.forEach(function (r) { max = Math.max(max, r.income || 0, r.expenditure || 0); });
    var cols = rows.map(function (r) {
      var hi = Math.max(Math.round(((r.income || 0) / max) * 100), (r.income > 0 ? 2 : 0));
      var he = Math.max(Math.round(((r.expenditure || 0) / max) * 100), (r.expenditure > 0 ? 2 : 0));
      var shortLbl = String(r.label || '').split(' ')[0].slice(0, 3);
      return '<div class="fin-chart-col" title="' + esc(r.label) + ' — আয় ' + PHS.bdt(r.income) +
        ', ব্যয় ' + PHS.bdt(r.expenditure) + '">' +
        '<div class="fin-chart-bar-pair">' +
        '<div class="fin-bar fin-bar-income" style="height:' + hi + '%"></div>' +
        '<div class="fin-bar fin-bar-exp" style="height:' + he + '%"></div>' +
        '</div><div class="fin-chart-label">' + esc(shortLbl) + '</div></div>';
    }).join('');
    host.innerHTML = '<div class="fin-chart"><div class="fin-chart-bars">' + cols + '</div>' +
      '<div class="fin-chart-legend"><span><i class="fin-dot fin-dot-income"></i>আয়</span>' +
      '<span><i class="fin-dot fin-dot-exp"></i>ব্যয়</span></div></div>';
  }

  // ------------------------------------------------------------ shell + nav

  var NAV = [
    { g: 'প্রধান', items: [
      ['dashboard.html', '📊', 'ড্যাশবোর্ড', 'dashboard'],
      ['members.html', '👥', 'সদস্য', 'members'],
      ['payments.html', '🧾', 'পেমেন্ট যাচাই', 'payments'],
      ['chanda.html', '💰', 'চাঁদা', 'chanda'],
      ['finance.html', '💵', 'আর্থিক ব্যবস্থাপনা', 'finance'],
      ['reports.html', '📈', 'রিপোর্ট', 'reports']] },
    { g: 'কনটেন্ট', items: [
      ['activities.html', '🏃', 'কার্যক্রম', 'content:activities'],
      ['services.html', '🤝', 'সেবা', 'content:services'],
      ['projects.html', '🏗️', 'প্রকল্প', 'content:projects'],
      ['news.html', '📰', 'সংবাদ', 'content:news'],
      ['success-stories.html', '🌟', 'সাফল্যের গল্প', 'content:successStories'],
      ['gallery.html', '🖼️', 'গ্যালারি', 'content:gallery'],
      ['homepage.html', '🏠', 'হোমপেজ', 'homepage'],
      ['statistics.html', '🔢', 'পরিসংখ্যান', 'statistics'],
      ['committee.html', '🎖️', 'কমিটি', 'committee']] },
    { g: 'ইনবক্স', items: [
      ['volunteers.html', '🙋', 'স্বেচ্ছাসেবক', 'inbox:volunteers'],
      ['help.html', '🆘', 'সহায়তা আবেদন', 'inbox:helpRequests'],
      ['messages.html', '✉️', 'বার্তা', 'inbox:contactMessages']] },
    { g: 'সিস্টেম', items: [
      ['settings.html', '⚙️', 'সেটিংস', 'settings'],
      ['migration.html', '🗄️', 'মাইগ্রেশন', 'migration'],
      ['audit.html', '🕵️', 'অডিট', 'audit']] }
  ];

  function renderShell(sess) {
    var page = document.body.getAttribute('data-page') || '';
    var mod = document.body.getAttribute('data-module') || '';
    var cur = mod ? page + ':' + mod : page;
    var title = document.title.split('—')[0].trim();
    var side = el('aside', 'admin-side');
    side.innerHTML = '<button type="button" class="side-close" aria-label="মেনু বন্ধ করুন">✕</button>';
    NAV.forEach(function (g) {
      side.appendChild(el('h3', '', g.g));
      g.items.forEach(function (it) {
        var a = document.createElement('a');
        a.href = it[0]; a.innerHTML = '<span>' + it[1] + '</span> ' + esc(it[2]);
        if (cur === it[3]) a.setAttribute('aria-current', 'page');
        side.appendChild(a);
      });
    });
    var main = el('div', 'admin-main');
    main.innerHTML =
      '<div class="admin-top"><button type="button" class="side-toggle btn btn-outline mini" ' +
      'aria-label="মেনু">☰ মেনু</button><h1>' + esc(title) + '</h1>' +
      '<span class="muted small">' + esc((sess.admin && (sess.admin.email || sess.admin.username)) || '') +
      ' · ' + badge(sess.admin && sess.admin.role || 'ADMIN') + '</span>' +
      '<button type="button" class="logout-btn" id="a-logout">লগআউট</button></div>' +
      '<div id="page-root"></div>';
    $('.admin-shell').innerHTML = '';
    $('.admin-shell').appendChild(side);
    $('.admin-shell').appendChild(main);
    $('.side-toggle').addEventListener('click', function () { side.classList.add('open'); });
    side.querySelector('.side-close').addEventListener('click', function () { side.classList.remove('open'); });
    side.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') side.classList.remove('open');
    });
    $('#a-logout').addEventListener('click', function () {
      var s = getSess();
      var done = function () { localStorage.removeItem(SESSION_KEY); location.replace('login.html'); };
      if (s) PHS.api('adminLogout', { sessionToken: s.token }).then(done, done); else done();
    });
    return $('#page-root');
  }

  // ============================================================ PAGES

  var Pages = {

    // ---------------- dashboard (§41) ----------------
    dashboard: function (root) {
      loadInto(root, function () {
        return apiA('getDashboardStats').then(function (r) {
          var s = r.data;
          root.innerHTML = '';
          if (s.chandaExceptions && s.chandaExceptions.length) {
            var w = el('div', 'warn-box');
            w.innerHTML = '<b>চাঁদা ইঞ্জিন সতর্কতা:</b> ' +
              PHS.bnNumber(s.chandaExceptions.length) + ' জন সদস্যের হিসাব সম্ভব হয়নি (যোগদানের মাস অনুপস্থিত/অবৈধ)। ' +
              'সদস্য পেজ থেকে সংশোধন করুন।';
            root.appendChild(w);
          }
          var cards = [
            ['👥', 'মোট সদস্য', PHS.bnNumber(s.totalMembers)],
            ['✅', 'সক্রিয় সদস্য', PHS.bnNumber(s.activeMembers)],
            ['⏸️', 'নিষ্ক্রিয় সদস্য', PHS.bnNumber(s.inactiveMembers)],
            ['🔎', 'অপেক্ষমাণ পেমেন্ট', PHS.bnNumber(s.pendingPayments)],
            ['✅', 'আজ অনুমোদিত', PHS.bnNumber(s.approvedPaymentsToday)],
            ['❌', 'আজ প্রত্যাখ্যাত', PHS.bnNumber(s.rejectedPaymentsToday)],
            ['🗓️', 'এই মাসে অনুমোদিত', PHS.bnNumber(s.approvedPaymentsThisMonth)],
            ['💰', 'মোট প্রত্যাশিত চাঁদা', PHS.bdt(s.totalExpectedChanda)],
            ['🟢', 'মোট অনুমোদিত চাঁদা', PHS.bdt(s.totalApprovedChanda)],
            ['📅', 'অগ্রিম চাঁদা (অনুমোদিত)', PHS.bdt(s.totalAdvanceChanda)],
            ['⏳', 'মোট বকেয়া চাঁদা', PHS.bdt(s.totalOutstandingChanda)]
          ];
          var g = el('div', 'cards');
          g.innerHTML = cards.map(function (c) {
            return '<div class="stat"><div class="ic">' + c[0] + '</div>' +
              '<div class="v">' + c[2] + '</div><div class="l">' + c[1] + '</div></div>';
          }).join('');
          root.appendChild(g);
          var quick = el('div', 'actions mt');
          [['payments.html?status=PENDING', '🔎 যাচাইয়ের অপেক্ষায় (' + PHS.bnNumber(s.pendingPayments) + ')'],
           ['members.html', '👥 সদস্য ব্যবস্থাপনা'],
           ['chanda.html', '💰 মাসিক চাঁদা রিপোর্ট']].forEach(function (q) {
            var a = el('a', 'btn btn-outline', q[1]); a.href = q[0]; quick.appendChild(a);
          });
          root.appendChild(quick);
          // §9/§Finance: finance snapshot appended below the existing dashboard —
          // purely additive, and failure here never breaks the dashboard above.
          var finBox = el('div', 'mt');
          root.appendChild(finBox);
          loadInto(finBox, function () {
            return apiA('getFinancialSummaryAdmin').then(function (fr) {
              var f = fr.data;
              finBox.innerHTML = '';
              finBox.appendChild(el('h3', '', 'আর্থিক সারসংক্ষেপ'));
              var balCls = f.currentBalance >= 0 ? 'stat-balance-pos' : 'stat-balance-neg';
              var fg = el('div', 'cards');
              fg.innerHTML = [
                ['📈', 'মোট আয়', PHS.bdt(f.totalIncome), ''],
                ['📉', 'মোট ব্যয়', PHS.bdt(f.totalExpenditure), ''],
                ['🏦', 'বর্তমান স্থিতি', PHS.bdt(f.currentBalance), balCls],
                ['🎁', 'মোট অনুদান', PHS.bdt(f.totalDonation), '']
              ].map(function (c) {
                return '<div class="stat ' + c[3] + '"><div class="ic">' + c[0] + '</div>' +
                  '<div class="v">' + c[2] + '</div><div class="l">' + c[1] + '</div></div>';
              }).join('');
              finBox.appendChild(fg);
              var link = el('a', 'btn btn-outline', '💵 সম্পূর্ণ আর্থিক ব্যবস্থাপনা');
              link.href = 'finance.html';
              finBox.appendChild(link);
            });
          });
        });
      });
    },

    // ---------------- members ----------------
    members: function (root) {
      var state = { search: '', status: '', page: 1 };
      root.innerHTML =
        '<div class="toolbar">' +
        '<div class="field"><label for="m-q">খুঁজুন (নাম/কোড/ইমেইল/ফোন)</label><input id="m-q"></div>' +
        '<div class="field"><label for="m-st">অবস্থা</label><select id="m-st"><option value="">সব</option>' +
        '<option value="ACTIVE">সক্রিয়</option><option value="INACTIVE">নিষ্ক্রিয়</option></select></div>' +
        '<button type="button" class="btn btn-outline" id="m-ref">রিফ্রেশ</button>' +
        '<button type="button" class="btn btn-primary" id="m-add">+ নতুন সদস্য</button></div>' +
        '<div id="m-list"></div><div id="m-pager"></div>';
      var list = $('#m-list');
      function draw() {
        loadInto(list, function () {
          return apiA('getMembers', { search: state.search, status: state.status,
            page: state.page, pageSize: 12 }).then(function (r) {
            table(list, [
              { k: 'photo', label: '', fmt: function (m) {
                  return '<div class="avatar mini-avatar">' +
                    (m.profilePhotoFileId ? PHS.imgHtml(m.profilePhotoFileId, '', '', 80) :
                      esc((m.nameBn || m.nameEn || m.memberCode || 'স').trim().charAt(0))) +
                    '</div>'; } },
              { k: 'memberCode', label: 'কোড' },
              { k: 'name', label: 'নাম', fmt: function (m) {
                  return esc(m.nameBn || m.nameEn || '—'); } },
              { k: 'contact', label: 'যোগাযোগ', fmt: function (m) {
                  return esc(m.phone || m.email || '—'); } },
              { k: 'monthlyChandaAmount', label: 'মাসিক চাঁদা', num: true,
                fmt: function (m) { return PHS.bdt(m.monthlyChandaAmount); } },
              { k: 'joiningMonth', label: 'যোগদান', fmt: function (m) {
                  return m.joiningMonth ? esc(PHS.monthLabel(m.joiningMonth)) : '—'; } },
              { k: 'status', label: 'অবস্থা', fmt: function (m) { return badge(m.status); } },
              { k: 'act', label: 'অ্যাকশন', fmt: function (m) {
                  return '<div class="actions">' +
                    '<button type="button" class="btn btn-outline mini" data-view="' + esc(m.memberId) + '">দেখুন</button>' +
                    '<button type="button" class="btn btn-outline mini" data-edit="' + esc(m.memberId) + '">এডিট</button></div>'; } }
            ], r.data.items);
            pager($('#m-pager'), r.data.page, r.data.totalPages, function (p) {
              state.page = p; draw();
            });
            list.querySelectorAll('[data-view]').forEach(function (b) {
              b.addEventListener('click', function () { viewMember(b.getAttribute('data-view')); });
            });
            list.querySelectorAll('[data-edit]').forEach(function (b) {
              b.addEventListener('click', function () { editMember(b.getAttribute('data-edit')); });
            });
          });
        });
      }
      function viewMember(id) {
        loadIntoModal(id);
      }
      function loadIntoModal(id) {
        apiA('getMember', { memberId: id }).then(function (r) {
          var d = r.data, m = d.member, c = d.chanda;
          var html = '<div id="mv-' + esc(id) + '"></div>';
          var mm = modal('সদস্য: ' + (m.nameBn || m.nameEn || m.memberCode), html, { wide: true });
          var box = mm.body.querySelector('#mv-' + id);
          var head = el('div', 'member-head');
          head.innerHTML = '<div class="avatar" id="mav">' +
            esc((m.nameBn || m.nameEn || m.memberCode || 'স').trim().split(/\s+/)
              .slice(0, 2).map(function (x) { return x.charAt(0); }).join('')) + '</div>' +
            '<div><h3 style="margin:0">' + esc(m.nameBn || m.nameEn) + '</h3>' +
            '<div class="code">কোড: ' + esc(m.memberCode) + ' ' + badge(m.status) + '</div></div>';
          box.appendChild(head);
          // §Image fix: render the actual photo via PHS.imgUrl (correct
          // thumbnail format) instead of always leaving initials showing.
          if (m.profilePhotoFileId) {
            var mPhotoUrl = PHS.imgUrl(m.profilePhotoFileId, 200);
            if (mPhotoUrl) {
              var mImg = new Image();
              mImg.alt = 'প্রোফাইল ছবি';
              mImg.onload = function () {
                var av = box.querySelector('#mav');
                if (av) { av.textContent = ''; av.appendChild(mImg); }
              };
              mImg.src = mPhotoUrl;
            }
          }
          var photoBtn = el('div', 'file-row mt');
          photoBtn.innerHTML = '<input type="file" accept="image/*" id="mphoto">' +
            '<span class="file-name">প্রোফাইল ছবি আপলোড</span>';
          box.appendChild(photoBtn);
          photoBtn.querySelector('#mphoto').addEventListener('change', function () {
            var f = this.files && this.files[0];
            if (!f) return;
            if (!/^image\/(jpe?g|png|webp)$/.test(f.type)) {
              PHS.toast('শুধু ছবি দিন।', 'error'); return;
            }
            var fr = new FileReader();
            fr.onload = function () {
              apiA('uploadMemberPhoto', { memberId: id, fileName: f.name,
                mimeType: f.type, dataBase64: String(fr.result).replace(/^data:[^,]+,/, '') })
                .then(function () { PHS.toast('ছবি আপলোড হয়েছে।'); mm.close(); viewMember(id); },
                  function (e) { PHS.toast(e.message || 'ব্যর্থ।', 'error'); });
            };
            fr.readAsDataURL(f);
          });
          var kv = el('div', 'kv mt');
          function row(k, v) {
            return '<div class="row"><div class="k">' + k + '</div><div class="v">' + (v || '—') + '</div></div>';
          }
          kv.innerHTML =
            row('ইমেইল', esc(m.email)) + row('মোবাইল', esc(m.phone)) +
            row('ঠিকানা', esc(m.address)) +
            row('যোগদান', (m.joiningDate ? esc(PHS.dateLabel(m.joiningDate)) : '') +
              (m.joiningMonth ? ' (' + esc(PHS.monthLabel(m.joiningMonth)) + ')' : '')) +
            row('মাসিক চাঁদা', PHS.bdt(m.monthlyChandaAmount)) +
            row('তৈরি', dt(m.createdAt));
          box.appendChild(kv);
          if (d.chandaError || !c) {
            box.appendChild(el('div', 'warn-box mt',
              (d.chandaError && d.chandaError.message) || 'চাঁদার হিসাব সম্ভব হয়নি।'));
          } else {
            var g = el('div', 'cards mt');
            g.style.gridTemplateColumns = 'repeat(3,1fr)';
            g.innerHTML = [
              ['পরিশোধিত মাস', PHS.bnNumber(c.paidMonths)],
              ['বকেয়া মাস', PHS.bnNumber(c.dueMonths)],
              ['যাচাই চলছে', PHS.bnNumber(c.pendingMonths)],
              ['আংশিক', PHS.bnNumber(c.partialMonths)],
              ['মোট বকেয়া', PHS.bdt(c.totalOutstandingAmount)],
              ['মোট পরিশোধিত চাঁদা', PHS.bdt(c.grandTotalPaidAmount)],
              ['অগ্রিম চাঁদা', PHS.bdt(c.totalAdvancePaidAmount)],
              ['পরিশোধিত ধারাবাহিকভাবে', c.paidThroughMonth ? PHS.monthLabel(c.paidThroughMonth) : '—']
            ].map(function (s) {
              return '<div class="stat"><div class="v">' + s[1] + '</div><div class="l">' + s[0] + '</div></div>';
            }).join('');
            box.appendChild(g);
            box.appendChild(el('p', 'small muted', 'চলতি মাস (' +
              PHS.monthLabel(c.currentMonth) + '): ')).innerHTML += ' ' + badge(c.currentMonthStatus);
          }
          var tbl = el('div', 'mt');
          tbl.appendChild(el('h3', '', 'সাম্প্রতিক পেমেন্ট (সর্বশেষ ১০)'));
          table(tbl, [
            { k: 'period', label: 'মাস', fmt: function (p) { return esc(PHS.monthLabel(p.period)); } },
            { k: 'amount', label: 'পরিমাণ', num: true, fmt: function (p) { return PHS.bdt(p.amount); } },
            { k: 'paymentMethod', label: 'মাধ্যম' },
            { k: 'transactionId', label: 'TrxID', fmt: function (p) {
                return '<span class="mono">' + esc(p.transactionId || '—') + '</span>'; } },
            { k: 'status', label: 'অবস্থা', fmt: function (p) { return badge(p.status); } }
          ], d.recentPayments || []);
          box.appendChild(tbl);
          var acts = el('div', 'form-actions');
          var eBtn = el('button', 'btn btn-outline', 'এডিট করুন');
          eBtn.type = 'button';
          eBtn.addEventListener('click', function () { mm.close(); editMember(id); });
          var sBtn = el('button', 'btn ' + (m.status === 'ACTIVE' ? '' : 'btn-primary'), '');
          sBtn.type = 'button';
          sBtn.textContent = m.status === 'ACTIVE' ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন';
          sBtn.style.background = m.status === 'ACTIVE' ? 'var(--danger)' : '';
          sBtn.addEventListener('click', function () {
            var to = m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            confirmBn('অবস্থা পরিবর্তন',
              to === 'INACTIVE' ? 'সদস্যকে নিষ্ক্রিয় করা হবে (ডেটা মুছবে না)। নিশ্চিত?' :
              'সদস্যকে সক্রিয় করা হবে। নিশ্চিত?', 'হ্যাঁ', to === 'INACTIVE')
              .then(function (yes) {
                if (!yes) return;
                apiA('updateMemberStatus', { memberId: id, status: to })
                  .then(function () { PHS.toast('অবস্থা পরিবর্তন হয়েছে।'); mm.close(); draw(); },
                    function (e) { PHS.toast(e.message || 'ব্যর্থ।', 'error'); });
              });
          });
          acts.appendChild(eBtn); acts.appendChild(sBtn);
          box.appendChild(acts);
        }).catch(function (e) { PHS.toast(e.message || 'লোড ব্যর্থ।', 'error'); });
      }
      function editMember(id) {
        apiA('getMember', { memberId: id }).then(function (r) {
          var m = r.data.member;
          var F = [
            { k: 'nameBn', label: 'নাম (বাংলা)' }, { k: 'nameEn', label: 'নাম (ইংরেজি)' },
            { k: 'email', label: 'ইমেইল', type: 'email' },
            { k: 'phone', label: 'মোবাইল', type: 'tel' },
            { k: 'address', label: 'ঠিকানা' },
            { k: 'joiningDate', label: 'যোগদানের তারিখ', type: 'date' },
            { k: 'joiningMonth', label: 'যোগদানের মাস (YYYY-MM)', hint: 'চাঁদার যোগ্যতা এটি দিয়ে নির্ধারিত হয়।' },
            { k: 'monthlyChandaAmount', label: 'মাসিক চাঁদা (৳)', type: 'number', step: '0.01', min: 1 }
          ];
          var formHtml = F.map(function (f) { return fieldHtml(f, m[f.k]); }).join('') +
            '<div class="form-actions"><button type="submit" class="btn btn-primary">সংরক্ষণ</button></div>';
          var mm = modal('সদস্য এডিট — ' + m.memberCode, '<form id="me-f" novalidate>' + formHtml + '</form>');
          bindUploads(mm.body);
          var form = mm.body.querySelector('#me-f');
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var payload = { memberId: id };
            var bad = null;
            F.forEach(function (f) {
              var inp = form.elements[f.k];
              var v = String(inp.value || '').trim();
              if (f.req && !v) { fieldErr(inp, 'পূরণ করুন।'); bad = bad || inp; return; }
              if (f.k === 'monthlyChandaAmount' && v && !(Number(v) > 0)) {
                fieldErr(inp, 'সঠিক পরিমাণ দিন।'); bad = bad || inp; return;
              }
              if (f.k === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
                fieldErr(inp, 'সঠিক ইমেইল দিন।'); bad = bad || inp; return;
              }
              if (f.k === 'phone' && v && !/^(\+?880|0)1[3-9]\d{8}$/.test(v.replace(/[\s-]/g, ''))) {
                fieldErr(inp, 'সঠিক মোবাইল নম্বর দিন।'); bad = bad || inp; return;
              }
              if (f.k === 'joiningMonth' && v && !/^\d{4}-\d{2}$/.test(v)) {
                fieldErr(inp, 'ফরম্যাট: YYYY-MM'); bad = bad || inp; return;
              }
              payload[f.k] = v;
            });
            if (bad) { bad.focus(); return; }
            apiA('updateMember', payload).then(function () {
              PHS.toast('সদস্য হালনাগাদ হয়েছে।'); mm.close(); draw();
            }).catch(function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
          });
        }).catch(function (e) { PHS.toast(e.message || 'লোড ব্যর্থ।', 'error'); });
      }
      $('#m-add').addEventListener('click', function () {
        var F = [
          { k: 'nameBn', label: 'নাম (বাংলা)', hint: 'নাম (বাংলা বা ইংরেজি) — অন্তত একটি আবশ্যক' },
          { k: 'nameEn', label: 'নাম (ইংরেজি)' },
          { k: 'email', label: 'ইমেইল', type: 'email', hint: 'এই ইমেইল দিয়ে সদস্য লগইন করবেন' },
          { k: 'phone', label: 'মোবাইল', type: 'tel' },
          { k: 'address', label: 'ঠিকানা' },
          { k: 'joiningDate', label: 'যোগদানের তারিখ', type: 'date' },
          { k: 'joiningMonth', label: 'যোগদানের মাস (YYYY-MM) *', hint: 'আবশ্যক — এটি ছাড়া চাঁদা হিসাব হবে না। তারিখ দিলে মাস স্বয়ংক্রিয় ধরা হবে।' },
          { k: 'monthlyChandaAmount', label: 'মাসিক চাঁদা (৳) *', type: 'number', step: '0.01', min: 1 },
          { k: 'memberCode', label: 'সদস্য কোড', hint: 'খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে (PHSxxxx)' },
          { k: 'status', label: 'অবস্থা', type: 'select', options: [
            { v: 'ACTIVE', l: 'সক্রিয়' }, { v: 'INACTIVE', l: 'নিষ্ক্রিয়' }] }
        ];
        var mm = modal('নতুন সদস্য', '<form id="mc-f" novalidate>' +
          F.map(function (f) { return fieldHtml(f); }).join('') +
          '<div class="form-actions"><button type="submit" class="btn btn-primary">যুক্ত করুন</button></div></form>');
        var form = mm.body.querySelector('#mc-f');
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var payload = {}, bad = null;
          F.forEach(function (f) {
            var inp = form.elements[f.k];
            var v = String(inp.value || '').trim();
            payload[f.k] = v;
          });
          if (!payload.nameBn && !payload.nameEn) {
            fieldErr(form.elements.nameBn, 'নাম (বাংলা বা ইংরেজি) দিন।'); bad = form.elements.nameBn;
          }
          if (!payload.joiningMonth && payload.joiningDate) {
            payload.joiningMonth = payload.joiningDate.slice(0, 7);
          }
          if (!payload.joiningMonth) {
            fieldErr(form.elements.joiningMonth, 'আবশ্যক — চাঁদার যোগ্যতার ভিত্তি।'); bad = bad || form.elements.joiningMonth;
          }
          if (!(Number(payload.monthlyChandaAmount) > 0)) {
            fieldErr(form.elements.monthlyChandaAmount, 'সঠিক পরিমাণ দিন।'); bad = bad || form.elements.monthlyChandaAmount;
          }
          if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) {
            fieldErr(form.elements.email, 'সঠিক ইমেইল দিন।'); bad = bad || form.elements.email;
          }
          if (bad) { bad.focus(); return; }
          apiA('createMember', payload).then(function () {
            PHS.toast('সদস্য যুক্ত হয়েছে।'); mm.close(); draw();
          }).catch(function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
        });
      });
      $('#m-q').addEventListener('input', function () {
        state.search = this.value.trim(); state.page = 1;
        clearTimeout(window.__mt); window.__mt = setTimeout(draw, 350);
      });
      $('#m-st').addEventListener('change', function () { state.status = this.value; state.page = 1; draw(); });
      $('#m-ref').addEventListener('click', draw);
      draw();
    },

    // ---------------- payments (§42) ----------------
    payments: function (root) {
      var q = {
        status: PHS.qs('status') || 'PENDING', period: '', paymentMethod: '',
        search: '', dateFrom: '', dateTo: '', page: 1
      };
      var methods = [];
      root.innerHTML =
        '<div id="p-cards" class="cards"></div>' +
        '<div class="toolbar">' +
        '<div class="field"><label for="p-st">অবস্থা</label><select id="p-st">' +
        ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', ''].map(function (s) {
          return '<option value="' + s + '"' + (q.status === s ? ' selected' : '') + '>' +
            (s ? STATUS[s].i + ' ' + STATUS[s].l : 'সব') + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label for="p-per">মাস</label><input id="p-per" type="month"></div>' +
        '<div class="field"><label for="p-m">মাধ্যম</label><select id="p-m"><option value="">সব</option></select></div>' +
        '<div class="field"><label for="p-df">তারিখ (থেকে)</label><input id="p-df" type="date"></div>' +
        '<div class="field"><label for="p-dt">তারিখ (পর্যন্ত)</label><input id="p-dt" type="date"></div>' +
        '<div class="field"><label for="p-q">খুঁজুন (কোড/নাম/TrxID/PaymentID)</label><input id="p-q"></div>' +
        '<button type="button" class="btn btn-outline" id="p-ref">রিফ্রেশ</button></div>' +
        '<div id="p-list"></div><div id="p-pager"></div>';
      loadInto($('#p-cards'), function () {
        return apiA('getDashboardStats').then(function (r) {
          var s = r.data;
          $('#p-cards').innerHTML = [
            ['🔎', 'অপেক্ষমাণ', PHS.bnNumber(s.pendingPayments)],
            ['✅', 'আজ অনুমোদিত', PHS.bnNumber(s.approvedPaymentsToday)],
            ['❌', 'আজ প্রত্যাখ্যাত', PHS.bnNumber(s.rejectedPaymentsToday)],
            ['🗓️', 'এই মাসে অনুমোদিত', PHS.bnNumber(s.approvedPaymentsThisMonth)]
          ].map(function (c) {
            return '<div class="stat"><div class="ic">' + c[0] + '</div><div class="v">' + c[2] +
              '</div><div class="l">' + c[1] + '</div></div>';
          }).join('');
        });
      });
      apiA('listPaymentMethodsAdmin').then(function (r) {
        methods = r.data.methods || [];
        var sel = $('#p-m');
        methods.forEach(function (m) {
          var o = document.createElement('option');
          o.value = m.methodName; o.textContent = m.displayName || m.methodName;
          sel.appendChild(o);
        });
      }).catch(function () {});
      function approve(id) {
        confirmBn('পেমেন্ট অনুমোদন', 'এই পেমেন্ট অনুমোদন করলে সংশ্লিষ্ট মাসের চাঁদায় গণনা হবে। নিশ্চিত?', 'অনুমোদন করুন')
          .then(function (yes) {
            if (!yes) return;
            apiA('approvePayment', { paymentId: id })
              .then(function () { PHS.toast('অনুমোদিত হয়েছে।'); draw(); },
                function (e) { PHS.toast(e.message || 'ব্যর্থ।', 'error'); });
          });
      }
      function reject(id) {
        var mm = modal('পেমেন্ট প্রত্যাখ্যান',
          '<div class="field"><label class="req" for="rj-n">কারণ (সদস্য দেখতে পাবেন)</label>' +
          '<textarea id="rj-n" rows="3" maxlength="500"></textarea><span class="err"></span></div>' +
          '<div class="form-actions"><button type="button" class="btn" id="rj-go" ' +
          'style="background:var(--danger);color:#fff">প্রত্যাখ্যান করুন</button></div>');
        mm.body.querySelector('#rj-go').addEventListener('click', function () {
          var note = mm.body.querySelector('#rj-n').value.trim();
          if (!note) { fieldErr(mm.body.querySelector('#rj-n'), 'কারণ লিখুন।'); return; }
          apiA('rejectPayment', { paymentId: id, adminNote: note })
            .then(function () { PHS.toast('প্রত্যাখ্যাত হয়েছে।'); mm.close(); draw(); },
              function (e) { PHS.toast(e.message || 'ব্যর্থ।', 'error'); });
        });
      }
      function viewPay(id) {
        apiA('getPaymentSubmission', { paymentId: id }).then(function (r) {
          var p = r.data;
          function row(k, v) {
            return '<div class="row"><div class="k">' + k + '</div><div class="v">' + (v || '—') + '</div></div>';
          }
          var kv = '<div class="kv">' +
            row('সদস্য', esc(p.memberCode + ' — ' + p.memberName)) +
            row('মাস', esc(PHS.monthLabel(p.period))) +
            row('পরিমাণ', PHS.bdt(p.amount)) +
            row('মাধ্যম', esc(p.paymentMethod)) +
            row('TrxID', '<span class="mono">' + esc(p.transactionId) + '</span>') +
            row('প্রেরকের নম্বর', esc(p.senderPhone)) +
            row('জমা', dt(p.submittedAt)) +
            row('অবস্থা', badge(p.status)) +
            (p.approvedAt ? row('অনুমোদন', dt(p.approvedAt)) : '') +
            (p.rejectedAt ? row('প্রত্যাখ্যান', dt(p.rejectedAt)) : '') +
            (p.note ? row('সদস্যের মন্তব্য', esc(p.note)) : '') +
            (p.adminNote ? row('অ্যাডমিন নোট', esc(p.adminNote)) : '') +
            '</div>';
          var acts = '<div class="form-actions">' +
            (p.screenshotFileId ? '<button type="button" class="btn btn-outline" id="sc-v">🖼️ স্ক্রিনশট দেখুন</button>' +
              '<span class="hint">লিংক ~১৫ মিনিট বৈধ।</span>' : '<span class="muted small">স্ক্রিনশট নেই</span>') +
            (p.status === 'PENDING' ?
              '<button type="button" class="btn btn-primary" id="ap-go">অনুমোদন</button>' +
              '<button type="button" class="btn" id="rj-go2" style="background:var(--danger);color:#fff">প্রত্যাখ্যান</button>' : '') +
            '</div>';
          var mm = modal('পেমেন্ট বিস্তারিত', kv + acts, { wide: true });
          var sv = mm.body.querySelector('#sc-v');
          if (sv) sv.addEventListener('click', function () {
            sv.disabled = true; sv.textContent = 'লিংক তৈরি হচ্ছে…';
            apiA('getPaymentScreenshot', { paymentId: id }).then(function (s) {
              if (s.data && s.data.viewUrl) window.open(s.data.viewUrl, '_blank', 'noopener');
              sv.disabled = false; sv.textContent = '🖼️ আবার খুলুন';
            }).catch(function (e) { sv.disabled = false; PHS.toast(e.message, 'error'); });
          });
          var ag = mm.body.querySelector('#ap-go');
          if (ag) ag.addEventListener('click', function () { mm.close(); approve(id); });
          var rg = mm.body.querySelector('#rj-go2');
          if (rg) rg.addEventListener('click', function () { mm.close(); reject(id); });
        }).catch(function (e) { PHS.toast(e.message || 'লোড ব্যর্থ।', 'error'); });
      }
      function draw() {
        loadInto($('#p-list'), function () {
          return apiA('getPayments', {
            status: q.status, period: q.period, paymentMethod: q.paymentMethod,
            search: q.search, dateFrom: q.dateFrom, dateTo: q.dateTo,
            page: q.page, pageSize: 15
          }).then(function (r) {
            table($('#p-list'), [
              { k: 'member', label: 'সদস্য', fmt: function (p) {
                  return esc(p.memberCode + ' ' + p.memberName); } },
              { k: 'period', label: 'মাস', fmt: function (p) { return esc(PHS.monthLabel(p.period)); } },
              { k: 'amount', label: 'পরিমাণ', num: true, fmt: function (p) { return PHS.bdt(p.amount); } },
              { k: 'paymentMethod', label: 'মাধ্যম' },
              { k: 'transactionId', label: 'TrxID', fmt: function (p) {
                  return '<span class="mono">' + esc(p.transactionId) + '</span>'; } },
              { k: 'submittedAt', label: 'জমা', fmt: function (p) { return dt(p.submittedAt); } },
              { k: 'status', label: 'অবস্থা', fmt: function (p) { return badge(p.status); } },
              { k: 'act', label: 'অ্যাকশন', fmt: function (p) {
                  var h = '<div class="actions"><button type="button" class="btn btn-outline mini" data-v="' +
                    esc(p.paymentId) + '">দেখুন</button>';
                  if (p.status === 'PENDING') {
                    h += '<button type="button" class="btn btn-primary mini" data-a="' + esc(p.paymentId) + '">অনুমোদন</button>' +
                         '<button type="button" class="btn mini" data-r="' + esc(p.paymentId) +
                         '" style="background:var(--danger);color:#fff">প্রত্যাখ্যান</button>';
                  }
                  return h + '</div>'; } }
            ], r.data.items);
            pager($('#p-pager'), r.data.page, r.data.totalPages, function (p) { q.page = p; draw(); });
            $('#p-list').querySelectorAll('[data-v]').forEach(function (b) {
              b.addEventListener('click', function () { viewPay(b.getAttribute('data-v')); });
            });
            $('#p-list').querySelectorAll('[data-a]').forEach(function (b) {
              b.addEventListener('click', function () { approve(b.getAttribute('data-a')); });
            });
            $('#p-list').querySelectorAll('[data-r]').forEach(function (b) {
              b.addEventListener('click', function () { reject(b.getAttribute('data-r')); });
            });
          });
        });
      }
      ['p-st', 'p-per', 'p-m', 'p-df', 'p-dt'].forEach(function (id) {
        $('#' + id).addEventListener('change', function () {
          q.status = $('#p-st').value; q.period = $('#p-per').value;
          q.paymentMethod = $('#p-m').value; q.dateFrom = $('#p-df').value; q.dateTo = $('#p-dt').value;
          q.page = 1; draw();
        });
      });
      $('#p-q').addEventListener('input', function () {
        q.search = this.value.trim(); q.page = 1;
        clearTimeout(window.__pt); window.__pt = setTimeout(draw, 350);
      });
      $('#p-ref').addEventListener('click', function () {
        loadInto($('#p-cards'), function () { return apiA('getDashboardStats'); }); draw();
      });
      draw();
    },

    // ---------------- chanda (§72 monthly + dues) ----------------
    chanda: function (root) {
      root.innerHTML =
        '<div class="tabs" role="tablist">' +
        '<button type="button" class="chip" id="t1" aria-pressed="true">মাসিক চাঁদা</button>' +
        '<button type="button" class="chip" id="t2" aria-pressed="false">সদস্য বকেয়া</button></div>' +
        '<div id="tab-monthly"></div><div id="tab-dues" hidden></div>';
      var monthly = $('#tab-monthly'), dues = $('#tab-dues');
      function tab(which) {
        $('#t1').setAttribute('aria-pressed', which === 1 ? 'true' : 'false');
        $('#t2').setAttribute('aria-pressed', which === 2 ? 'true' : 'false');
        monthly.hidden = which !== 1; dues.hidden = which !== 2;
      }
      $('#t1').addEventListener('click', function () { tab(1); });
      $('#t2').addEventListener('click', function () { tab(2); });

      monthly.innerHTML =
        '<div class="toolbar">' +
        '<div class="field"><label for="c-per">মাস</label><input id="c-per" type="month" value="' +
        PHS.monthKeyNowLocal() + '"></div>' +
        '<div class="field field-check"><label><input type="checkbox" id="c-inact"> নিষ্ক্রিয় সদস্যও</label></div>' +
        '<button type="button" class="btn btn-outline" id="c-go">দেখুন</button></div>' +
        '<div id="c-sum" class="sum-band" hidden></div><div id="c-warn"></div><div id="c-list"></div>';
      function drawMonthly() {
        var period = $('#c-per').value || PHS.monthKeyNowLocal();
        loadInto($('#c-list'), function () {
          return apiA('getReportMonthlyChanda', { period: period,
            includeInactive: $('#c-inact').checked }).then(function (r) {
            var d = r.data;
            var sum = $('#c-sum'); sum.hidden = false;
            sum.innerHTML =
              '<span>যোগ্য সদস্য: <b>' + PHS.bnNumber(d.eligibleMembers) + '</b></span>' +
              '<span>পরিশোধিত: <b>' + PHS.bnNumber(d.paidMembers) + '</b></span>' +
              '<span>অপরিশোধিত: <b>' + PHS.bnNumber(d.unpaidMembers) + '</b></span>' +
              '<span>প্রত্যাশিত: <b>' + PHS.bdt(d.expectedCollection) + '</b></span>' +
              '<span>অনুমোদিত: <b>' + PHS.bdt(d.approvedCollection) + '</b></span>' +
              '<span>যাচাইতে: <b>' + PHS.bdt(d.pendingAmount) + '</b></span>' +
              '<span>বকেয়া: <b>' + PHS.bdt(d.outstandingAmount) + '</b></span>';
            var warn = $('#c-warn'); warn.innerHTML = '';
            if (d.exceptions && d.exceptions.length) {
              var w = el('div', 'warn-box');
              w.innerHTML = '<b>ইঞ্জিন বাদ দিয়েছে:</b> ' + d.exceptions.map(function (x) {
                return esc(x.memberId + ' — ' + x.code); }).join(' · ');
              warn.appendChild(w);
            }
            table($('#c-list'), [
              { k: 'memberCode', label: 'কোড' },
              { k: 'name', label: 'নাম' },
              { k: 'status', label: 'অবস্থা', fmt: function (m) { return badge(m.status); } },
              { k: 'requiredAmount', label: 'প্রয়োজন', num: true, fmt: function (m) { return PHS.bdt(m.requiredAmount); } },
              { k: 'approvedPaidAmount', label: 'অনুমোদিত', num: true, fmt: function (m) { return PHS.bdt(m.approvedPaidAmount); } },
              { k: 'pendingSubmittedAmount', label: 'যাচাইতে', num: true, fmt: function (m) { return PHS.bdt(m.pendingSubmittedAmount); } },
              { k: 'outstandingAmount', label: 'বকেয়া', num: true, fmt: function (m) { return PHS.bdt(m.outstandingAmount); } }
            ], d.rows, 'এই মাসে কোনো যোগ্য সদস্য নেই।');
          });
        });
      }
      $('#c-go').addEventListener('click', drawMonthly);

      dues.innerHTML =
        '<div class="toolbar">' +
        '<div class="field"><label for="d-q">খুঁজুন</label><input id="d-q"></div>' +
        '<div class="field"><label for="d-min">নূন্যতম বকেয়া মাস</label><input id="d-min" type="number" value="1" min="0"></div>' +
        '<div class="field"><label for="d-s">সাজান</label><select id="d-s">' +
        '<option value="outstandingAmount">বকেয়া (বেশি আগে)</option>' +
        '<option value="dueMonths">বকেয়া মাস</option>' +
        '<option value="lastPaidMonth">পুরোনো পরিশোধ আগে</option>' +
        '<option value="memberCode">কোড</option></select></div>' +
        '<div class="field field-check"><label><input type="checkbox" id="d-inact"> নিষ্ক্রিয়ও</label></div>' +
        '<button type="button" class="btn btn-outline" id="d-go">দেখুন</button></div>' +
        '<div id="d-list"></div><div id="d-pager"></div>';
      var dState = { page: 1 };
      function drawDues() {
        loadInto($('#d-list'), function () {
          return apiA('getReportMemberDues', { search: $('#d-q').value.trim(),
            minDueMonths: Number($('#d-min').value) || 0, sortBy: $('#d-s').value,
            includeInactive: $('#d-inact').checked, page: dState.page, pageSize: 20 })
            .then(function (r) {
              table($('#d-list'), [
                { k: 'memberCode', label: 'কোড' },
                { k: 'name', label: 'নাম' },
                { k: 'dueMonths', label: 'বকেয়া মাস', num: true, fmt: function (m) { return PHS.bnNumber(m.dueMonths); } },
                { k: 'pendingMonths', label: 'যাচাইতে', num: true, fmt: function (m) { return PHS.bnNumber(m.pendingMonths); } },
                { k: 'outstandingAmount', label: 'বকেয়া টাকা', num: true, fmt: function (m) { return PHS.bdt(m.outstandingAmount); } },
                { k: 'lastPaidMonth', label: 'সর্বশেষ পরিশোধ', fmt: function (m) {
                    return m.lastPaidMonth ? esc(PHS.monthLabel(m.lastPaidMonth)) : '—'; } },
                { k: 'paidThroughMonth', label: 'ধারাবাহিক পর্যন্ত', fmt: function (m) {
                    return m.paidThroughMonth ? esc(PHS.monthLabel(m.paidThroughMonth)) : '—'; } }
              ], r.data.items);
              pager($('#d-pager'), r.data.page, r.data.totalPages, function (p) { dState.page = p; drawDues(); });
            });
        });
      }
      $('#d-go').addEventListener('click', function () { dState.page = 1; drawDues(); });
      tab(1); drawMonthly();
    },

    // ---------------- finance (Expenditure + Donation + unified summary) ----------------
    finance: function (root) {
      root.innerHTML =
        '<div class="tabs" role="tablist">' +
        '<button type="button" class="chip" id="f-t1" aria-pressed="true">সারসংক্ষেপ</button>' +
        '<button type="button" class="chip" id="f-t2" aria-pressed="false">ব্যয় (Expenditure)</button>' +
        '<button type="button" class="chip" id="f-t3" aria-pressed="false">অনুদান (Donation)</button></div>' +
        '<div id="f-tab-sum"></div><div id="f-tab-exp" hidden></div><div id="f-tab-don" hidden></div>';
      var sum = $('#f-tab-sum'), expT = $('#f-tab-exp'), donT = $('#f-tab-don');
      function ftab(which) {
        $('#f-t1').setAttribute('aria-pressed', which === 1 ? 'true' : 'false');
        $('#f-t2').setAttribute('aria-pressed', which === 2 ? 'true' : 'false');
        $('#f-t3').setAttribute('aria-pressed', which === 3 ? 'true' : 'false');
        sum.hidden = which !== 1; expT.hidden = which !== 2; donT.hidden = which !== 3;
        if (which === 1 && !sum.dataset.loaded) { sum.dataset.loaded = '1'; drawSummary(); }
        if (which === 2 && !expT.dataset.loaded) { expT.dataset.loaded = '1'; initExpenditureTab(); }
        if (which === 3 && !donT.dataset.loaded) { donT.dataset.loaded = '1'; initDonationTab(); }
      }
      $('#f-t1').addEventListener('click', function () { ftab(1); });
      $('#f-t2').addEventListener('click', function () { ftab(2); });
      $('#f-t3').addEventListener('click', function () { ftab(3); });

      var EXP_METHODS = [{ v: 'CASH', l: 'নগদ (Cash)' }, { v: 'BANK', l: 'ব্যাংক (Bank)' },
        { v: 'MOBILE_BANKING', l: 'মোবাইল ব্যাংকিং' }, { v: 'OTHER', l: 'অন্যান্য' }];
      var DON_METHODS = [{ v: 'CASH', l: 'নগদ (Cash)' }, { v: 'BANK', l: 'ব্যাংক (Bank)' },
        { v: 'BKASH', l: 'বিকাশ (bKash)' }, { v: 'NAGAD', l: 'নগদ অ্যাপ (Nagad)' }, { v: 'OTHER', l: 'অন্যান্য' }];
      var DONOR_TYPES = [{ v: 'MEMBER', l: 'সদস্য' }, { v: 'NON_MEMBER', l: 'সদস্য নন' },
        { v: 'ORGANIZATION', l: 'প্রতিষ্ঠান' }, { v: 'OTHER', l: 'অন্যান্য' }];
      function donorTypeLabel(v) {
        var m = DONOR_TYPES.filter(function (x) { return x.v === v; })[0];
        return m ? m.l : (v || '—');
      }

      // ---------- Summary tab ----------
      function drawSummary() {
        loadInto(sum, function () {
          return Promise.all([apiA('getFinancialSummaryAdmin'), apiA('getFinancialTrendsAdmin', { months: 12 })])
            .then(function (rs) {
              var s = rs[0].data, months = rs[1].data.months;
              sum.innerHTML = '';
              if (s.chandaExceptions && s.chandaExceptions.length) {
                var w = el('div', 'warn-box');
                w.innerHTML = '<b>চাঁদা ইঞ্জিন সতর্কতা:</b> ' + PHS.bnNumber(s.chandaExceptions.length) +
                  ' জন সদস্যের হিসাব সম্ভব হয়নি। "চাঁদা" পেজ থেকে সংশোধন করুন।';
                sum.appendChild(w);
              }
              var balCls = s.currentBalance >= 0 ? 'stat-balance-pos' : 'stat-balance-neg';
              var g = el('div', 'cards');
              g.innerHTML = [
                ['💰', 'মোট চাঁদা আয়', PHS.bdt(s.totalChada), ''],
                ['🎁', 'মোট অনুদান', PHS.bdt(s.totalDonation), ''],
                ['➕', 'অন্যান্য আয়', PHS.bdt(s.otherIncome), ''],
                ['📈', 'মোট আয়', PHS.bdt(s.totalIncome), ''],
                ['📉', 'মোট ব্যয়', PHS.bdt(s.totalExpenditure), ''],
                ['🏦', 'বর্তমান স্থিতি', PHS.bdt(s.currentBalance), balCls]
              ].map(function (c) {
                return '<div class="stat ' + c[3] + '"><div class="ic">' + c[0] + '</div>' +
                  '<div class="v">' + c[2] + '</div><div class="l">' + c[1] + '</div></div>';
              }).join('');
              sum.appendChild(g);
              var sub = el('div', 'sum-band');
              sub.innerHTML = '<span>সদস্য অনুদান: <b>' + PHS.bdt(s.totalMemberDonation) + '</b></span>' +
                '<span>বহিরাগত/প্রাতিষ্ঠানিক অনুদান: <b>' + PHS.bdt(s.totalNonMemberDonation) + '</b></span>';
              sum.appendChild(sub);
              // §Advance Chanda fix: "মোট চাঁদা আয়" above is now the true
              // total (current + advance, via Chanda.gs grandTotalPaidAmount)
              // — this breaks it down, mirroring the donation sub-band.
              if (s.totalAdvanceChada > 0) {
                var chandaSub = el('div', 'sum-band');
                chandaSub.innerHTML = '<span>চলতি মাস পর্যন্ত চাঁদা: <b>' + PHS.bdt(s.totalChadaThroughCurrentMonth) + '</b></span>' +
                  '<span>অগ্রিম চাঁদা: <b>' + PHS.bdt(s.totalAdvanceChada) + '</b></span>';
                sum.appendChild(chandaSub);
              }
              sum.appendChild(el('h3', '', 'মাসিক আয় বনাম ব্যয় (গত ১২ মাস)'));
              var chartHost = el('div');
              sum.appendChild(chartHost);
              finChart(chartHost, months);
              sum.appendChild(el('h3', 'mt', 'সাম্প্রতিক ব্যয়'));
              var reBox = el('div'); sum.appendChild(reBox);
              table(reBox, [
                { k: 'date', label: 'তারিখ', fmt: function (r) { return esc(PHS.dateLabel(r.date)); } },
                { k: 'purpose', label: 'উদ্দেশ্য' },
                { k: 'category', label: 'ক্যাটাগরি' },
                { k: 'amount', label: 'পরিমাণ', num: true, fmt: function (r) { return PHS.bdt(r.amount); } }
              ], s.recentExpenditure, 'কোনো সাম্প্রতিক ব্যয় নেই।');
              sum.appendChild(el('h3', 'mt', 'সাম্প্রতিক অনুদান'));
              var rdBox = el('div'); sum.appendChild(rdBox);
              table(rdBox, [
                { k: 'date', label: 'তারিখ', fmt: function (r) { return esc(PHS.dateLabel(r.date)); } },
                { k: 'donorType', label: 'দাতার ধরন', fmt: function (r) { return esc(donorTypeLabel(r.donorType)); } },
                { k: 'donorName', label: 'দাতা' },
                { k: 'amount', label: 'পরিমাণ', num: true, fmt: function (r) { return PHS.bdt(r.amount); } }
              ], s.recentDonation, 'কোনো সাম্প্রতিক অনুদান নেই।');
            });
        });
      }

      // ---------- Expenditure tab ----------
      function initExpenditureTab() {
        var state = { search: '', category: '', status: 'ACTIVE', dateFrom: '', dateTo: '', page: 1 };
        expT.innerHTML =
          '<div class="toolbar">' +
          '<div class="field"><label for="e-q">খুঁজুন</label><input id="e-q"></div>' +
          '<div class="field"><label for="e-cat">ক্যাটাগরি</label><input id="e-cat" placeholder="যেমন Medical Camp"></div>' +
          '<div class="field"><label for="e-st">অবস্থা</label><select id="e-st">' +
          '<option value="ACTIVE" selected>সক্রিয়</option><option value="CANCELLED">বাতিল</option>' +
          '<option value="">সব</option></select></div>' +
          '<div class="field"><label for="e-df">তারিখ (থেকে)</label><input id="e-df" type="date"></div>' +
          '<div class="field"><label for="e-dt">তারিখ (পর্যন্ত)</label><input id="e-dt" type="date"></div>' +
          '<button type="button" class="btn btn-outline" id="e-ref">রিফ্রেশ</button>' +
          '<button type="button" class="btn btn-primary" id="e-add">+ নতুন ব্যয়</button></div>' +
          '<div id="e-total" class="sum-band"></div>' +
          '<div id="e-list"></div><div id="e-pager"></div>';

        function draw() {
          loadInto($('#e-list'), function () {
            return apiA('getExpendituresAdmin', {
              search: state.search, category: state.category, status: state.status,
              dateFrom: state.dateFrom, dateTo: state.dateTo, page: state.page, pageSize: 15
            }).then(function (r) {
              $('#e-total').innerHTML = '<span>মোট সক্রিয় ব্যয়: <b>' + PHS.bdt(r.data.totalActiveAmount) + '</b></span>';
              table($('#e-list'), [
                { k: 'date', label: 'তারিখ', fmt: function (x) { return esc(PHS.dateLabel(x.date)); } },
                { k: 'purpose', label: 'উদ্দেশ্য' },
                { k: 'category', label: 'ক্যাটাগরি' },
                { k: 'amount', label: 'পরিমাণ', num: true, fmt: function (x) { return PHS.bdt(x.amount); } },
                { k: 'paymentMethod', label: 'মাধ্যম' },
                { k: 'referenceNumber', label: 'রেফারেন্স', fmt: function (x) {
                    return x.referenceNumber ? '<span class="mono">' + esc(x.referenceNumber) + '</span>' : '—'; } },
                { k: 'status', label: 'অবস্থা', fmt: function (x) { return badge(x.status); } },
                { k: 'act', label: 'অ্যাকশন', fmt: function (x) {
                    var h = '<div class="actions"><button type="button" class="btn btn-outline mini" data-e="' +
                      esc(x.expenditureId) + '">এডিট</button>';
                    if (x.status === 'ACTIVE') {
                      h += '<button type="button" class="btn mini" data-c="' + esc(x.expenditureId) +
                        '" style="background:var(--danger);color:#fff">বাতিল</button>';
                    }
                    return h + '</div>'; } }
              ], r.data.items, 'কোনো ব্যয় পাওয়া যায়নি।');
              pager($('#e-pager'), r.data.page, r.data.totalPages, function (p) { state.page = p; draw(); });
              $('#e-list').querySelectorAll('[data-e]').forEach(function (b) {
                b.addEventListener('click', function () {
                  var it = r.data.items.filter(function (x) { return x.expenditureId === b.getAttribute('data-e'); })[0];
                  openExpenditureForm(it);
                });
              });
              $('#e-list').querySelectorAll('[data-c]').forEach(function (b) {
                b.addEventListener('click', function () {
                  var id = b.getAttribute('data-c');
                  confirmBn('ব্যয় বাতিল', 'এই ব্যয়টি বাতিল করলে আর্থিক হিসাব থেকে বাদ যাবে। নিশ্চিত?', 'বাতিল করুন', true)
                    .then(function (yes) {
                      if (!yes) return;
                      apiA('cancelExpenditure', { expenditureId: id })
                        .then(function () { PHS.toast('ব্যয় বাতিল হয়েছে।'); draw(); },
                          function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
                    });
                });
              });
            });
          });
        }

        function openExpenditureForm(it) {
          var F = [
            { k: 'date', label: 'তারিখ *', type: 'date' },
            { k: 'purpose', label: 'উদ্দেশ্য / কারণ *' },
            { k: 'category', label: 'ক্যাটাগরি *', hint: 'যেমন Medical Camp, Relief, Administration' },
            { k: 'amount', label: 'পরিমাণ (৳) *', type: 'number', min: 1, step: '0.01' },
            { k: 'paymentMethod', label: 'পেমেন্ট মাধ্যম', type: 'select', options: EXP_METHODS },
            { k: 'referenceNumber', label: 'Reference/Receipt (ঐচ্ছিক)' },
            { k: 'description', label: 'বিস্তারিত বিবরণ (ঐচ্ছিক)', type: 'textarea', rows: 3 }
          ];
          var mm = modal(it ? 'ব্যয় এডিট করুন' : 'নতুন ব্যয় যুক্ত করুন',
            '<form id="ef" novalidate>' +
            F.map(function (f) {
              var dflt = f.k === 'paymentMethod' ? 'CASH' : (f.k === 'date' ? PHS.dateKeyNowLocal() : '');
              return fieldHtml(f, it ? it[f.k] : dflt);
            }).join('') +
            '<div class="form-actions"><button type="submit" class="btn btn-primary">সংরক্ষণ</button></div></form>');
          var form = mm.body.querySelector('#ef');
          function submit(extra) {
            var bad = null;
            var p = it ? { expenditureId: it.expenditureId } : {};
            ['date', 'purpose', 'category'].forEach(function (k) {
              var v = String(form.elements[k].value || '').trim();
              if (!v) { fieldErr(form.elements[k], 'আবশ্যক।'); bad = bad || form.elements[k]; }
              else fieldErr(form.elements[k], '');
              p[k] = v;
            });
            var amt = Number(form.elements.amount.value);
            if (!amt || amt <= 0) { fieldErr(form.elements.amount, 'সঠিক পরিমাণ দিন।'); bad = bad || form.elements.amount; }
            else fieldErr(form.elements.amount, '');
            p.amount = amt;
            p.paymentMethod = form.elements.paymentMethod.value;
            p.referenceNumber = String(form.elements.referenceNumber.value || '').trim();
            p.description = String(form.elements.description.value || '').trim();
            if (bad) { bad.focus(); return; }
            if (extra) Object.assign(p, extra);
            var action = it ? 'updateExpenditure' : 'addExpenditure';
            apiA(action, p).then(function () {
              PHS.toast(it ? 'ব্যয় হালনাগাদ হয়েছে।' : 'ব্যয় যুক্ত হয়েছে।'); mm.close(); draw();
            }, function (err) {
              if (!extra && err.code === 'POSSIBLE_DUPLICATE_EXPENDITURE') {
                confirmBn('একই ধরনের ব্যয় পাওয়া গেছে', err.message, 'তবুও যুক্ত করুন', true).then(function (yes) {
                  if (yes) submit({ confirmDuplicate: true });
                });
                return;
              }
              PHS.toast(err.message || 'ব্যর্থ।', 'error');
            });
          }
          form.addEventListener('submit', function (e) { e.preventDefault(); submit(null); });
        }

        ['e-st', 'e-df', 'e-dt'].forEach(function (id) {
          $('#' + id).addEventListener('change', function () {
            state.status = $('#e-st').value; state.dateFrom = $('#e-df').value; state.dateTo = $('#e-dt').value;
            state.page = 1; draw();
          });
        });
        $('#e-cat').addEventListener('input', function () {
          state.category = this.value.trim(); state.page = 1;
          clearTimeout(window.__ect); window.__ect = setTimeout(draw, 350);
        });
        $('#e-q').addEventListener('input', function () {
          state.search = this.value.trim(); state.page = 1;
          clearTimeout(window.__eqt); window.__eqt = setTimeout(draw, 350);
        });
        $('#e-ref').addEventListener('click', draw);
        $('#e-add').addEventListener('click', function () { openExpenditureForm(null); });
        draw();
      }

      // ---------- Donation tab ----------
      function initDonationTab() {
        var state = { search: '', donorType: '', status: 'PENDING', dateFrom: '', dateTo: '', page: 1 };
        donT.innerHTML =
          '<div class="toolbar">' +
          '<div class="field"><label for="o-q">খুঁজুন</label><input id="o-q"></div>' +
          '<div class="field"><label for="o-dt2">দাতার ধরন</label><select id="o-dt2"><option value="">সব</option>' +
          DONOR_TYPES.map(function (t) { return '<option value="' + t.v + '">' + t.l + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="field"><label for="o-st">অবস্থা</label><select id="o-st">' +
          ['PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED', ''].map(function (s) {
            return '<option value="' + s + '"' + (state.status === s ? ' selected' : '') + '>' +
              (s ? (STATUS[s] ? STATUS[s].i + ' ' + STATUS[s].l : s) : 'সব') + '</option>';
          }).join('') + '</select></div>' +
          '<div class="field"><label for="o-df">তারিখ (থেকে)</label><input id="o-df" type="date"></div>' +
          '<div class="field"><label for="o-dtt">তারিখ (পর্যন্ত)</label><input id="o-dtt" type="date"></div>' +
          '<button type="button" class="btn btn-outline" id="o-ref">রিফ্রেশ</button>' +
          '<button type="button" class="btn btn-primary" id="o-add">+ নতুন অনুদান</button></div>' +
          '<p class="step-note">সদস্যরা Payment পেজ থেকে নিজে অনুদান জমা দিলে তা প্রথমে <b>PENDING</b> অবস্থায় আসে — এখানে অনুমোদন/প্রত্যাখ্যান করুন। Admin নিজে "+ নতুন অনুদান" দিয়ে যোগ করলে তা সরাসরি সক্রিয় থাকে।</p>' +
          '<div id="o-total" class="sum-band"></div>' +
          '<div id="o-list"></div><div id="o-pager"></div>';

        function draw() {
          loadInto($('#o-list'), function () {
            return apiA('getDonationsAdmin', {
              search: state.search, donorType: state.donorType, status: state.status,
              dateFrom: state.dateFrom, dateTo: state.dateTo, page: state.page, pageSize: 15
            }).then(function (r) {
              $('#o-total').innerHTML =
                '<span>সদস্য অনুদান: <b>' + PHS.bdt(r.data.totalMemberDonation) + '</b></span>' +
                '<span>বহিরাগত/প্রাতিষ্ঠানিক: <b>' + PHS.bdt(r.data.totalNonMemberDonation) + '</b></span>' +
                '<span>মোট (সক্রিয়): <b>' + PHS.bdt(r.data.totalActiveAmount) + '</b></span>';
              table($('#o-list'), [
                { k: 'date', label: 'তারিখ', fmt: function (d) { return esc(PHS.dateLabel(d.date)); } },
                { k: 'donorType', label: 'দাতার ধরন', fmt: function (d) { return esc(donorTypeLabel(d.donorType)); } },
                { k: 'donorName', label: 'দাতা' },
                { k: 'purpose', label: 'উদ্দেশ্য' },
                { k: 'amount', label: 'পরিমাণ', num: true, fmt: function (d) { return PHS.bdt(d.amount); } },
                { k: 'paymentMethod', label: 'মাধ্যম' },
                { k: 'referenceNumber', label: 'রেফারেন্স', fmt: function (d) {
                    return d.referenceNumber ? '<span class="mono">' + esc(d.referenceNumber) + '</span>' : '—'; } },
                { k: 'status', label: 'অবস্থা', fmt: function (d) { return badge(d.status); } },
                { k: 'act', label: 'অ্যাকশন', fmt: function (d) {
                    if (d.status === 'PENDING') {
                      return '<div class="actions">' +
                        '<button type="button" class="btn mini" data-appr="' + esc(d.donationId) +
                        '" style="background:var(--green-600);color:#fff">অনুমোদন</button>' +
                        '<button type="button" class="btn btn-outline mini" data-rej="' + esc(d.donationId) +
                        '">প্রত্যাখ্যান</button></div>';
                    }
                    var h = '<div class="actions"><button type="button" class="btn btn-outline mini" data-e="' +
                      esc(d.donationId) + '">এডিট</button>';
                    if (d.status === 'ACTIVE') {
                      h += '<button type="button" class="btn mini" data-c="' + esc(d.donationId) +
                        '" style="background:var(--danger);color:#fff">বাতিল</button>';
                    }
                    return h + '</div>'; } }
              ], r.data.items, 'কোনো অনুদান পাওয়া যায়নি।');
              pager($('#o-pager'), r.data.page, r.data.totalPages, function (p) { state.page = p; draw(); });
              $('#o-list').querySelectorAll('[data-e]').forEach(function (b) {
                b.addEventListener('click', function () {
                  var it = r.data.items.filter(function (x) { return x.donationId === b.getAttribute('data-e'); })[0];
                  openDonationForm(it);
                });
              });
              $('#o-list').querySelectorAll('[data-c]').forEach(function (b) {
                b.addEventListener('click', function () {
                  var id = b.getAttribute('data-c');
                  confirmBn('অনুদান বাতিল', 'এই অনুদানটি বাতিল করলে আর্থিক হিসাব থেকে বাদ যাবে। নিশ্চিত?', 'বাতিল করুন', true)
                    .then(function (yes) {
                      if (!yes) return;
                      apiA('cancelDonation', { donationId: id })
                        .then(function () { PHS.toast('অনুদান বাতিল হয়েছে।'); draw(); },
                          function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
                    });
                });
              });
              $('#o-list').querySelectorAll('[data-appr]').forEach(function (b) {
                b.addEventListener('click', function () {
                  var id = b.getAttribute('data-appr');
                  apiA('approveDonation', { donationId: id })
                    .then(function () { PHS.toast('অনুদান অনুমোদিত হয়েছে।'); draw(); },
                      function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
                });
              });
              $('#o-list').querySelectorAll('[data-rej]').forEach(function (b) {
                b.addEventListener('click', function () {
                  var id = b.getAttribute('data-rej');
                  var mm = modal('অনুদান প্রত্যাখ্যান',
                    '<form id="rjf" novalidate>' +
                    fieldHtml({ k: 'adminNote', label: 'কারণ *', type: 'textarea', rows: 3,
                      hint: 'সদস্য এই কারণ দেখতে পাবেন।' }, '') +
                    '<div class="form-actions"><button type="submit" class="btn btn-primary">প্রত্যাখ্যান করুন</button></div></form>');
                  mm.body.querySelector('#rjf').addEventListener('submit', function (e) {
                    e.preventDefault();
                    var reason = String(this.elements.adminNote.value || '').trim();
                    if (!reason) { fieldErr(this.elements.adminNote, 'কারণ আবশ্যক।'); return; }
                    apiA('rejectDonation', { donationId: id, adminNote: reason })
                      .then(function () { PHS.toast('অনুদান প্রত্যাখ্যাত হয়েছে।'); mm.close(); draw(); },
                        function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
                  });
                });
              });
            });
          });
        }

        function openDonationForm(it) {
          var isMember = it ? it.donorType === 'MEMBER' : true;
          var html =
            '<form id="of" novalidate>' +
            fieldHtml({ k: 'date', label: 'তারিখ *', type: 'date' }, it ? it.date : PHS.dateKeyNowLocal()) +
            fieldHtml({ k: 'donorType', label: 'দাতার ধরন *', type: 'select', options: DONOR_TYPES },
              it ? it.donorType : 'MEMBER') +
            '<div class="field" id="of-mem-wrap"' + (isMember ? '' : ' hidden') + '>' +
            '<label>সদস্য</label><input id="of-mem-q" placeholder="নাম/কোড দিয়ে খুঁজুন" value="' +
            (isMember && it ? esc(it.donorName) : '') + '">' +
            '<div id="of-mem-results" class="hint"></div><span class="err"></span></div>' +
            '<div class="field" id="of-name-wrap"' + (isMember ? ' hidden' : '') + '>' +
            fieldHtml({ k: 'donorName', label: 'দাতার নাম *' }, !isMember && it ? it.donorName : '') + '</div>' +
            fieldHtml({ k: 'purpose', label: 'উদ্দেশ্য (ঐচ্ছিক)' }, it ? it.purpose : '') +
            fieldHtml({ k: 'amount', label: 'পরিমাণ (৳) *', type: 'number', min: 1, step: '0.01' }, it ? it.amount : '') +
            fieldHtml({ k: 'paymentMethod', label: 'পেমেন্ট মাধ্যম', type: 'select', options: DON_METHODS },
              it ? it.paymentMethod : 'CASH') +
            fieldHtml({ k: 'referenceNumber', label: 'Reference (ঐচ্ছিক)' }, it ? it.referenceNumber : '') +
            fieldHtml({ k: 'description', label: 'বিস্তারিত বিবরণ (ঐচ্ছিক)', type: 'textarea', rows: 3 }, it ? it.description : '') +
            '<div class="form-actions"><button type="submit" class="btn btn-primary">সংরক্ষণ</button></div></form>';
          var mm = modal(it ? 'অনুদান এডিট করুন' : 'নতুন অনুদান যুক্ত করুন', html);
          var form = mm.body.querySelector('#of');
          var selectedMemberId = isMember && it ? it.memberId : '';
          var memWrap = mm.body.querySelector('#of-mem-wrap'), nameWrap = mm.body.querySelector('#of-name-wrap');
          var memQ = mm.body.querySelector('#of-mem-q'), memResults = mm.body.querySelector('#of-mem-results');
          form.elements.donorType.addEventListener('change', function () {
            var v = form.elements.donorType.value;
            memWrap.hidden = v !== 'MEMBER'; nameWrap.hidden = v === 'MEMBER';
            if (v !== 'MEMBER') selectedMemberId = '';
          });
          var searchT;
          memQ.addEventListener('input', function () {
            selectedMemberId = '';
            var q = memQ.value.trim();
            clearTimeout(searchT);
            if (q.length < 2) { memResults.innerHTML = ''; return; }
            searchT = setTimeout(function () {
              apiA('getMembers', { search: q, page: 1, pageSize: 6 }).then(function (r) {
                memResults.innerHTML = (r.data.items || []).map(function (m) {
                  return '<button type="button" class="chip mini" data-mid="' + esc(m.memberId) + '" data-mname="' +
                    esc(m.nameBn || m.nameEn || m.memberCode) + '">' +
                    esc(m.memberCode + ' — ' + (m.nameBn || m.nameEn)) + '</button>';
                }).join(' ') || '<span class="muted small">কোনো মিল পাওয়া যায়নি।</span>';
                memResults.querySelectorAll('[data-mid]').forEach(function (b) {
                  b.addEventListener('click', function () {
                    selectedMemberId = b.getAttribute('data-mid');
                    memQ.value = b.getAttribute('data-mname');
                    memResults.innerHTML = '<span class="muted small">নির্বাচিত ✓</span>';
                  });
                });
              }).catch(function () {});
            }, 300);
          });
          function submit(extra) {
            var bad = null;
            var p = it ? { donationId: it.donationId } : {};
            p.date = String(form.elements.date.value || '').trim();
            if (!p.date) { fieldErr(form.elements.date, 'আবশ্যক।'); bad = form.elements.date; }
            else fieldErr(form.elements.date, '');
            p.donorType = form.elements.donorType.value;
            if (p.donorType === 'MEMBER') {
              if (!selectedMemberId) { fieldErr(memQ, 'তালিকা থেকে একজন সদস্য নির্বাচন করুন।'); bad = bad || memQ; }
              else { p.memberId = selectedMemberId; fieldErr(memQ, ''); }
            } else {
              p.donorName = String(form.elements.donorName.value || '').trim();
              if (!p.donorName) { fieldErr(form.elements.donorName, 'আবশ্যক।'); bad = bad || form.elements.donorName; }
              else fieldErr(form.elements.donorName, '');
            }
            p.purpose = String(form.elements.purpose.value || '').trim();
            var amt = Number(form.elements.amount.value);
            if (!amt || amt <= 0) { fieldErr(form.elements.amount, 'সঠিক পরিমাণ দিন।'); bad = bad || form.elements.amount; }
            else fieldErr(form.elements.amount, '');
            p.amount = amt;
            p.paymentMethod = form.elements.paymentMethod.value;
            p.referenceNumber = String(form.elements.referenceNumber.value || '').trim();
            p.description = String(form.elements.description.value || '').trim();
            if (bad) { bad.focus(); return; }
            if (extra) Object.assign(p, extra);
            var action = it ? 'updateDonation' : 'addDonation';
            apiA(action, p).then(function () {
              PHS.toast(it ? 'অনুদান হালনাগাদ হয়েছে।' : 'অনুদান যুক্ত হয়েছে।'); mm.close(); draw();
            }, function (err) {
              if (!extra && err.code === 'POSSIBLE_DUPLICATE_DONATION') {
                confirmBn('একই ধরনের অনুদান পাওয়া গেছে', err.message, 'তবুও যুক্ত করুন', true).then(function (yes) {
                  if (yes) submit({ confirmDuplicate: true });
                });
                return;
              }
              PHS.toast(err.message || 'ব্যর্থ।', 'error');
            });
          }
          form.addEventListener('submit', function (e) { e.preventDefault(); submit(null); });
        }

        ['o-dt2', 'o-st', 'o-df', 'o-dtt'].forEach(function (id) {
          $('#' + id).addEventListener('change', function () {
            state.donorType = $('#o-dt2').value; state.status = $('#o-st').value;
            state.dateFrom = $('#o-df').value; state.dateTo = $('#o-dtt').value;
            state.page = 1; draw();
          });
        });
        $('#o-q').addEventListener('input', function () {
          state.search = this.value.trim(); state.page = 1;
          clearTimeout(window.__oqt); window.__oqt = setTimeout(draw, 350);
        });
        $('#o-ref').addEventListener('click', draw);
        $('#o-add').addEventListener('click', function () { openDonationForm(null); });
        draw();
      }

      ftab(1);
    },

    // ---------------- reports (§72 payments/methods + §73 export) ----------------
    reports: function (root) {
      root.innerHTML =
        '<div class="sec-card"><h2>পেমেন্ট রিপোর্ট</h2>' +
        '<div class="toolbar">' +
        '<div class="field"><label for="r-code">সদস্য কোড</label><input id="r-code"></div>' +
        '<div class="field"><label for="r-per">মাস</label><input id="r-per" type="month"></div>' +
        '<div class="field"><label for="r-yr">অথবা বছর</label><input id="r-yr" type="number" min="2000" max="2100"></div>' +
        '<div class="field"><label for="r-st">অবস্থা</label><select id="r-st"><option value="">সব</option>' +
        ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map(function (s) {
          return '<option value="' + s + '">' + STATUS[s].l + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field"><label for="r-df">থেকে</label><input id="r-df" type="date"></div>' +
        '<div class="field"><label for="r-dt">পর্যন্ত</label><input id="r-dt" type="date"></div>' +
        '<button type="button" class="btn btn-primary" id="r-go">দেখুন</button></div>' +
        '<div id="r-list"></div><div id="r-pager"></div></div>' +
        '<div class="sec-card"><h2>পেমেন্ট মাধ্যম রিপোর্ট (অনুমোদিত)</h2>' +
        '<div class="toolbar"><div class="field"><label for="pm-yr">বছর (খালি = সব)</label>' +
        '<input id="pm-yr" type="number" min="2000" max="2100"></div>' +
        '<div class="field"><label for="pm-per">অথবা মাস</label><input id="pm-per" type="month"></div>' +
        '<button type="button" class="btn btn-outline" id="pm-go">দেখুন</button></div>' +
        '<div id="pm-list"></div></div>' +
        '<div class="sec-card"><h2>CSV এক্সপোর্ট (§73)</h2>' +
        '<div class="toolbar"><div class="field"><label for="ex-t">ডেটা</label><select id="ex-t">' +
        '<option value="members">সদস্য + চাঁদা সারসংক্ষেপ</option>' +
        '<option value="payments">পেমেন্ট রেকর্ড</option>' +
        '<option value="monthlyChanda">মাসিক চাঁদা (চলতি মাস)</option>' +
        '<option value="memberDues">সদস্য বকেয়া</option>' +
        '<option value="paymentMethods">পেমেন্ট মাধ্যম</option>' +
        '<option value="expenditure">ব্যয় (Expenditure)</option>' +
        '<option value="donations">অনুদান (Donation)</option>' +
        '<option value="auditLogs">অডিট লগ</option></select></div>' +
        '<button type="button" class="btn btn-primary" id="ex-go">⬇️ ডাউনলোড</button>' +
        '<span class="hint">সংবেদনশীল ডেটা — শুধুমাত্র অনুমোদিত অ্যাডমিন। প্রতিটি এক্সপোর্ট অডিট হয়।</span></div></div>';
      var rState = { page: 1 };
      function drawR() {
        loadInto($('#r-list'), function () {
          return apiA('getReportPayments', {
            memberCode: $('#r-code').value.trim(), period: $('#r-per').value,
            year: $('#r-yr').value || '', status: $('#r-st').value,
            dateFrom: $('#r-df').value, dateTo: $('#r-dt').value,
            page: rState.page, pageSize: 20 }).then(function (r) {
            table($('#r-list'), [
              { k: 'memberCode', label: 'কোড' },
              { k: 'memberName', label: 'নাম' },
              { k: 'period', label: 'মাস', fmt: function (p) { return esc(PHS.monthLabel(p.period)); } },
              { k: 'amount', label: 'পরিমাণ', num: true, fmt: function (p) { return PHS.bdt(p.amount); } },
              { k: 'paymentMethod', label: 'মাধ্যম' },
              { k: 'transactionId', label: 'TrxID', fmt: function (p) {
                  return '<span class="mono">' + esc(p.transactionId) + '</span>'; } },
              { k: 'status', label: 'অবস্থা', fmt: function (p) { return badge(p.status); } },
              { k: 'submittedAt', label: 'জমা', fmt: function (p) { return dt(p.submittedAt); } }
            ], r.data.items);
            pager($('#r-pager'), r.data.page, r.data.totalPages, function (p) { rState.page = p; drawR(); });
          });
        });
      }
      $('#r-go').addEventListener('click', function () { rState.page = 1; drawR(); });
      function drawPm() {
        loadInto($('#pm-list'), function () {
          return apiA('getReportPaymentMethods', { year: $('#pm-yr').value || '',
            period: $('#pm-per').value }).then(function (r) {
            table($('#pm-list'), [
              { k: 'method', label: 'মাধ্যম' },
              { k: 'count', label: 'সংখ্যা', num: true, fmt: function (m) { return PHS.bnNumber(m.count); } },
              { k: 'totalAmount', label: 'মোট (অনুমোদিত)', num: true, fmt: function (m) { return PHS.bdt(m.totalAmount); } }
            ], r.data.methods);
          });
        });
      }
      $('#pm-go').addEventListener('click', drawPm);
      $('#ex-go').addEventListener('click', function () {
        apiA('exportData', { type: $('#ex-t').value }).then(csvDownload)
          .catch(function (e) { PHS.toast(e.message || 'ব্যর্থ।', 'error'); });
      });
      drawR(); drawPm();
    },

    // ---------------- generic CMS (§115) ----------------
    content: function (root, moduleKey) {
      var M = CMS_MODULES[moduleKey];
      if (!M) { root.innerHTML = '<p class="load-error">অজানা মডিউল।</p>'; return; }
      var state = { search: '', pub: '', page: 1 };
      root.innerHTML =
        '<div class="toolbar">' +
        '<div class="field"><label for="cm-q">খুঁজুন</label><input id="cm-q"></div>' +
        '<div class="field"><label for="cm-pub">অবস্থা</label><select id="cm-pub"><option value="">সব</option>' +
        '<option value="PUBLISHED">প্রকাশিত</option><option value="DRAFT">খসড়া</option>' +
        '<option value="ARCHIVED">আর্কাইভড</option></select></div>' +
        '<button type="button" class="btn btn-outline" id="cm-ref">রিফ্রেশ</button>' +
        '<button type="button" class="btn btn-primary" id="cm-add">+ নতুন যুক্ত করুন</button></div>' +
        '<div id="cm-list"></div><div id="cm-pager"></div>';
      function rowActs(it) {
        var pub = String(it.publicationStatus || '');
        var h = '<div class="actions">' +
          '<button type="button" class="btn btn-outline mini" data-e="' + esc(it.id) + '">এডিট</button>';
        if (M.previewUrl) {
          h += '<a class="btn btn-outline mini" target="_blank" rel="noopener" href="' +
            esc(M.previewUrl(it)) + '">প্রিভিউ</a>';
        }
        if (pub !== 'PUBLISHED') {
          h += '<button type="button" class="btn btn-primary mini" data-p="' + esc(it.id) + '">প্রকাশ</button>';
        } else {
          h += '<button type="button" class="btn btn-outline mini" data-u="' + esc(it.id) + '">আনপাবলিশ</button>';
        }
        if (pub !== 'ARCHIVED') {
          h += '<button type="button" class="btn mini" data-x="' + esc(it.id) +
            '" style="background:var(--danger);color:#fff">আর্কাইভ</button>';
        }
        return h + '</div>';
      }
      function draw() {
        loadInto($('#cm-list'), function () {
          return apiA('adminListContent', { module: M.key, search: state.search,
            publicationStatus: state.pub, page: state.page, pageSize: 12 }).then(function (r) {
            var cols = [{ k: M.idField, label: 'ID', fmt: function (it) {
                return '<span class="mono small">' + esc(String(it[M.idField]).slice(0, 14)) + '…</span>'; } },
              { k: 'title', label: 'শিরোনাম' }]
              .concat(M.listExtra || [])
              .concat([{ k: 'publicationStatus', label: 'অবস্থা',
                fmt: function (it) { return badge(it.publicationStatus); } },
                { k: 'act', label: 'অ্যাকশন', fmt: rowActs }]);
            table($('#cm-list'), cols, r.data.items);
            pager($('#cm-pager'), r.data.page, r.data.totalPages, function (p) { state.page = p; draw(); });
            $('#cm-list').querySelectorAll('[data-e]').forEach(function (b) {
              b.addEventListener('click', function () { openForm(b.getAttribute('data-e')); });
            });
            ['data-p', 'data-u', 'data-x'].forEach(function (attr, i) {
              $('#cm-list').querySelectorAll('[' + attr + ']').forEach(function (b) {
                b.addEventListener('click', function () {
                  var id = b.getAttribute(attr);
                  var to = ['PUBLISHED', 'DRAFT', 'ARCHIVED'][i];
                  var msg = to === 'PUBLISHED' ? 'প্রকাশ করা হবে — পাবলিক সাইটে দেখা যাবে।' :
                            to === 'ARCHIVED' ? 'আর্কাইভ করা হবে — পাবলিক সাইট থেকে সরে যাবে (পুনরুদ্ধারযোগ্য)।' :
                            'আনপাবলিশ করা হবে — খসড়া হবে।';
                  confirmBn('অবস্থা পরিবর্তন', msg, 'নিশ্চিত', to === 'ARCHIVED')
                    .then(function (yes) {
                      if (!yes) return;
                      apiA('adminSetPublication', { module: M.key, id: id,
                        publicationStatus: to }).then(function () {
                        PHS.toast('অবস্থা: ' + STATUS[to].l); draw();
                      }, function (e) { PHS.toast(e.message, 'error'); });
                    });
                });
              });
            });
          });
        });
      }
      function openForm(id) {
        var after = function (row) {
          var F = M.fields;
          var html = F.map(function (f) { return fieldHtml(f, row ? row[f.k] : ''); }).join('') +
            '<div class="form-actions"><button type="submit" class="btn btn-primary">সংরক্ষণ</button></div>';
          var mm = modal((row ? 'এডিট' : 'নতুন') + ' — ' + M.title,
            '<form id="cf-f" novalidate>' + html + '</form>', { wide: true });
          bindUploads(mm.body);
          var form = mm.body.querySelector('#cf-f');
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var payload = row ? { module: M.key, id: id } : { module: M.key };
            var bad = null;
            F.forEach(function (f) {
              var inp = form.elements[f.k];
              if (!inp) return;
              var v;
              if (f.type === 'checkbox') { payload[f.k] = inp.checked; return; }
              v = String(inp.value || '').trim();
              if (f.req && !v) { fieldErr(inp, 'আবশ্যক।'); bad = bad || inp; return; }
              if (f.num && v && isNaN(Number(v))) {
                fieldErr(inp, 'সংখ্যা দিন।'); bad = bad || inp; return;
              }
              payload[f.k] = v;
            });
            if (bad) { bad.focus(); return; }
            apiA(row ? 'adminUpdateContent' : 'adminCreateContent', payload)
              .then(function () { PHS.toast('সংরক্ষিত হয়েছে।'); mm.close(); draw(); })
              .catch(function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
          });
        };
        if (id) {
          apiA('adminGetContent', { module: M.key, id: id })
            .then(function (r) { after(r.data); })
            .catch(function (e) { PHS.toast(e.message, 'error'); });
        } else { after(null); }
      }
      $('#cm-add').addEventListener('click', function () { openForm(null); });
      $('#cm-q').addEventListener('input', function () {
        state.search = this.value.trim(); state.page = 1;
        clearTimeout(window.__ct); window.__ct = setTimeout(draw, 350);
      });
      $('#cm-pub').addEventListener('change', function () { state.pub = this.value; state.page = 1; draw(); });
      $('#cm-ref').addEventListener('click', draw);
      draw();
    },

    // ---------------- homepage (§46) ----------------
    homepage: function (root) {
      loadInto(root, function () {
        return apiA('getHomepageAdmin').then(function (r) {
          root.innerHTML = '';
          root.appendChild(el('p', 'step-note',
            'প্রতিটি সেকশন চালু/বন্ধ, ক্রম ও লেখা এখানে নিয়ন্ত্রিত হয়। পরিবর্তন সাথে সাথে পাবলিক সাইটে প্রযোজ্য হয়।'));
          var form = el('form'); form.noValidate = true;
          (r.data.sections || []).forEach(function (s) {
            var card = el('div', 'sec-card');
            card.setAttribute('data-key', s.sectionKey);
            card.innerHTML = '<h3>#' + PHS.bnDigits(s.displayOrder) + ' ' + esc(s.sectionKey) + '</h3>' +
              '<div class="row2">' +
              fieldHtml({ k: 'title', label: 'শিরোনাম' }, s.title) +
              fieldHtml({ k: 'subtitle', label: 'সাবটাইটেল' }, s.subtitle) +
              fieldHtml({ k: 'description', label: 'বিবরণ', type: 'textarea', rows: 2 }, s.description) +
              fieldHtml({ k: 'imageUrl', label: 'ছবি', type: 'image', purpose: 'organization' }, s.imageUrl) +
              fieldHtml({ k: 'buttonText', label: 'বাটন লেখা' }, s.buttonText) +
              fieldHtml({ k: 'buttonLink', label: 'বাটন লিংক' }, s.buttonLink) +
              fieldHtml({ k: 'displayOrder', label: 'ক্রম', type: 'number', min: 0 }, s.displayOrder) +
              fieldHtml({ k: 'enabled', label: 'চালু', type: 'checkbox' }, s.enabled ? 'TRUE' : 'FALSE') +
              '</div>';
            form.appendChild(card);
          });
          var acts = el('div', 'form-actions');
          var save = el('button', 'btn btn-primary', 'সব সংরক্ষণ করুন');
          save.type = 'submit';
          acts.appendChild(save);
          form.appendChild(acts);
          root.appendChild(form);
          bindUploads(root);
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var sections = [];
            root.querySelectorAll('.sec-card').forEach(function (card) {
              var g = function (k) {
                var i = card.querySelector('[name="' + k + '"]');
                return i ? (i.type === 'checkbox' ? i.checked : String(i.value || '').trim()) : undefined;
              };
              sections.push({
                sectionKey: card.getAttribute('data-key'),
                title: g('title'), subtitle: g('subtitle'), description: g('description'),
                imageUrl: g('imageUrl'), buttonText: g('buttonText'), buttonLink: g('buttonLink'),
                displayOrder: Number(g('displayOrder')) || 0, enabled: !!g('enabled')
              });
            });
            apiA('updateHomepage', { sections: sections })
              .then(function () { PHS.toast('হোমপেজ হালনাগাদ হয়েছে।'); },
                function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
          });
        });
      });
    },

    // ---------------- statistics (§59) ----------------
    statistics: function (root) {
      root.innerHTML = '<div class="toolbar"><button type="button" class="btn btn-primary" id="s-add">+ নতুন পরিসংখ্যান</button>' +
        '<span class="hint">সংখ্যাগুলো বাস্তব তথ্য থেকে দিন — কখনো বানানো যাবে না।</span></div><div id="s-list"></div>';
      function draw() {
        loadInto($('#s-list'), function () {
          return apiA('getStatisticsAdmin').then(function (r) {
            table($('#s-list'), [
              { k: 'label', label: 'লেবেল' },
              { k: 'value', label: 'মান', num: true, fmt: function (s) { return PHS.bnNumber(s.value); } },
              { k: 'unit', label: 'একক' }, { k: 'icon', label: 'আইকন' },
              { k: 'displayOrder', label: 'ক্রম', num: true },
              { k: 'status', label: 'অবস্থা', fmt: function (s) { return badge(s.status); } },
              { k: 'act', label: 'অ্যাকশন', fmt: function (s) {
                  return '<div class="actions">' +
                    '<button type="button" class="btn btn-outline mini" data-e="' + esc(s.statId) + '">এডিট</button>' +
                    (s.status !== 'ARCHIVED' ? '<button type="button" class="btn mini" data-x="' + esc(s.statId) +
                      '" style="background:var(--danger);color:#fff">আর্কাইভ</button>' : '') + '</div>'; } }
            ], r.data.stats);
            $('#s-list').querySelectorAll('[data-e]').forEach(function (b) {
              b.addEventListener('click', function () {
                var it = r.data.stats.filter(function (s) { return s.statId === b.getAttribute('data-e'); })[0];
                openForm(it);
              });
            });
            $('#s-list').querySelectorAll('[data-x]').forEach(function (b) {
              b.addEventListener('click', function () {
                confirmBn('আর্কাইভ', 'এই পরিসংখ্যান পাবলিক সাইট থেকে সরে যাবে। নিশ্চিত?', 'আর্কাইভ', true)
                  .then(function (yes) {
                    if (!yes) return;
                    apiA('deleteStatistic', { statId: b.getAttribute('data-x') })
                      .then(function () { PHS.toast('আর্কাইভ হয়েছে।'); draw(); },
                        function (e) { PHS.toast(e.message, 'error'); });
                  });
              });
            });
          });
        });
      }
      function openForm(it) {
        var F = [
          { k: 'label', label: 'লেবেল *' },
          { k: 'value', label: 'মান *', type: 'number', step: 'any', min: 0 },
          { k: 'unit', label: 'একক (যেমন জন, টি)' },
          { k: 'icon', label: 'আইকন (ইমোজি)', hint: 'যেমন 📚 🍲 ❤️' },
          { k: 'displayOrder', label: 'ক্রম', type: 'number', min: 0 },
          { k: 'status', label: 'অবস্থা', type: 'select', options: [
            { v: 'DRAFT', l: 'খসড়া' }, { v: 'PUBLISHED', l: 'প্রকাশিত' }, { v: 'ARCHIVED', l: 'আর্কাইভড' }] }
        ];
        var mm = modal(it ? 'এডিট' : 'নতুন পরিসংখ্যান',
          '<form id="sf" novalidate>' +
          F.map(function (f) { return fieldHtml(f, it ? it[f.k] : ''); }).join('') +
          '<div class="form-actions"><button type="submit" class="btn btn-primary">সংরক্ষণ</button></div></form>');
        var form = mm.body.querySelector('#sf');
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var p = it ? { statId: it.statId } : {};
          var bad = null;
          F.forEach(function (f) {
            var v = String(form.elements[f.k].value || '').trim();
            if (f.req && !v) { fieldErr(form.elements[f.k], 'আবশ্যক।'); bad = bad || form.elements[f.k]; }
            p[f.k] = v;
          });
          if (bad) { bad.focus(); return; }
          apiA('upsertStatistic', p).then(function () { PHS.toast('সংরক্ষিত।'); mm.close(); draw(); },
            function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
        });
      }
      $('#s-add').addEventListener('click', function () { openForm(null); });
      draw();
    },

    // ---------------- committee (§58) ----------------
    committee: function (root) {
      root.innerHTML = '<div class="toolbar">' +
        '<span class="hint">শুধুমাত্র সত্যিকারের সদস্য যুক্ত করুন। পাবলিক প্রদর্শনের জন্য “পাবলিক দৃশ্যমান” চালু করতে হবে।</span>' +
        '<button type="button" class="btn btn-primary" id="cm-add2">+ নতুন সদস্য</button></div><div id="cm-list2"></div>';
      function draw() {
        loadInto($('#cm-list2'), function () {
          return apiA('getCommitteeAdmin').then(function (r) {
            table($('#cm-list2'), [
              { k: 'name', label: 'নাম' }, { k: 'designation', label: 'পদবি' },
              { k: 'displayOrder', label: 'ক্রম', num: true },
              { k: 'status', label: 'অবস্থা', fmt: function (m) { return badge(m.status); } },
              { k: 'publicVisibility', label: 'পাবলিক', fmt: function (m) {
                  return m.publicVisibility ? '✅ দৃশ্যমান' : '🚫 লুকানো'; } },
              { k: 'act', label: 'অ্যাকশন', fmt: function (m) {
                  return '<div class="actions">' +
                    '<button type="button" class="btn btn-outline mini" data-e="' + esc(m.id) + '">এডিট</button>' +
                    '<button type="button" class="btn mini" data-x="' + esc(m.id) +
                    '" style="background:var(--danger);color:#fff">সরান</button></div>'; } }
            ], r.data.members);
            $('#cm-list2').querySelectorAll('[data-e]').forEach(function (b) {
              b.addEventListener('click', function () {
                var it = r.data.members.filter(function (m) { return m.id === b.getAttribute('data-e'); })[0];
                openForm(it);
              });
            });
            $('#cm-list2').querySelectorAll('[data-x]').forEach(function (b) {
              b.addEventListener('click', function () {
                confirmBn('সরান', 'তালিকা থেকে সরানো হবে (নিষ্ক্রিয় + লুকানো)। নিশ্চিত?', 'সরান', true)
                  .then(function (yes) {
                    if (!yes) return;
                    apiA('removeCommitteeMember', { id: b.getAttribute('data-x') })
                      .then(function () { PHS.toast('সরানো হয়েছে।'); draw(); },
                        function (e) { PHS.toast(e.message, 'error'); });
                  });
              });
            });
          });
        });
      }
      function openForm(it) {
        var F = [
          { k: 'name', label: 'নাম *' }, { k: 'designation', label: 'পদবি' },
          { k: 'shortBio', label: 'সংক্ষিপ্ত পরিচিতি', type: 'textarea', rows: 3 },
          { k: 'photo', label: 'ছবি', type: 'image', purpose: 'committee' },
          { k: 'displayOrder', label: 'ক্রম', type: 'number', min: 0 },
          { k: 'status', label: 'অবস্থা', type: 'select', options: [
            { v: 'ACTIVE', l: 'সক্রিয়' }, { v: 'INACTIVE', l: 'নিষ্ক্রিয়' }] },
          { k: 'publicVisibility', label: 'পাবলিক সাইটে দৃশ্যমান', type: 'checkbox' }
        ];
        var mm = modal(it ? 'এডিট' : 'নতুন কমিটি সদস্য',
          '<form id="kf" novalidate>' +
          F.map(function (f) { return fieldHtml(f, it ? it[f.k] : ''); }).join('') +
          '<div class="form-actions"><button type="submit" class="btn btn-primary">সংরক্ষণ</button></div></form>', { wide: true });
        bindUploads(mm.body);
        var form = mm.body.querySelector('#kf');
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var p = it ? { id: it.id } : {};
          var bad = null;
          F.forEach(function (f) {
            var inp = form.elements[f.k];
            if (f.type === 'checkbox') { p[f.k] = inp.checked; return; }
            var v = String(inp.value || '').trim();
            if (f.req && !v) { fieldErr(inp, 'আবশ্যক।'); bad = bad || inp; }
            p[f.k] = v;
          });
          if (bad) { bad.focus(); return; }
          apiA('upsertCommittee', p).then(function () { PHS.toast('সংরক্ষিত।'); mm.close(); draw(); },
            function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
        });
      }
      $('#cm-add2').addEventListener('click', function () { openForm(null); });
      draw();
    },

    // ---------------- inboxes (§55–57) ----------------
    inbox: function (root, key) {
      var C = INBOX_CFG[key];
      var state = { status: '', search: '', page: 1 };
      root.innerHTML =
        '<div class="toolbar">' +
        '<div class="field"><label for="i-q">খুঁজুন</label><input id="i-q"></div>' +
        '<div class="field"><label for="i-st">অবস্থা</label><select id="i-st"><option value="">সব</option>' +
        C.statuses.map(function (s) {
          return '<option value="' + s + '">' + (STATUS[s] ? STATUS[s].i + ' ' + STATUS[s].l : s) + '</option>';
        }).join('') + '</select></div>' +
        '<button type="button" class="btn btn-outline" id="i-ref">রিফ্রেশ</button></div>' +
        '<div id="i-list"></div><div id="i-pager"></div>';
      function view(id) {
        apiA(C.one, { id: id }).then(function (r) {
          var it = r.data;
          var rows = C.fields.map(function (f) {
            var v = it[f[0]];
            if (v === '' || v === null || v === undefined) return '';
            return '<div class="row"><div class="k">' + esc(f[1]) + '</div><div class="v">' + esc(v) + '</div></div>';
          }).join('');
          var attach = key === 'helpRequests' && it.attachmentFileId ?
            '<div class="form-actions"><button type="button" class="btn btn-outline" id="at-v">📎 সংযুক্তি দেখুন</button>' +
            '<span class="hint">লিংক ~১৫ মিনিট বৈধ।</span></div>' : '';
          var mm = modal(C.title + ' — বিস্তারিত',
            '<div class="kv">' + rows + '</div>' + attach +
            '<div class="mt"><h3>অবস্থা পরিবর্তন</h3>' +
            '<div class="toolbar"><div class="field"><label for="st-s">নতুন অবস্থা</label><select id="st-s">' +
            C.statuses.map(function (s) {
              return '<option value="' + s + '"' + (String(it.status) === s ? ' selected' : '') + '>' +
                (STATUS[s] ? STATUS[s].l : s) + '</option>';
            }).join('') + '</select></div>' +
            '<div class="field" style="flex:2"><label for="st-n">অ্যাডমিন নোট (ঐচ্ছিক)</label><input id="st-n"></div>' +
            '<button type="button" class="btn btn-primary" id="st-go">সংরক্ষণ</button></div></div>', { wide: true });
          var av = mm.body.querySelector('#at-v');
          if (av) av.addEventListener('click', function () {
            av.disabled = true;
            apiA('getHelpRequestAttachment', { requestId: id }).then(function (s) {
              if (s.data && s.data.viewUrl) window.open(s.data.viewUrl, '_blank', 'noopener');
              av.disabled = false;
            }).catch(function (e) { av.disabled = false; PHS.toast(e.message, 'error'); });
          });
          mm.body.querySelector('#st-go').addEventListener('click', function () {
            apiA(C.set, { id: id, status: mm.body.querySelector('#st-s').value,
              adminNote: mm.body.querySelector('#st-n').value.trim() })
              .then(function () { PHS.toast('অবস্থা হালনাগাদ হয়েছে।'); mm.close(); draw(); },
                function (e) { PHS.toast(e.message, 'error'); });
          });
        }).catch(function (e) { PHS.toast(e.message, 'error'); });
      }
      function draw() {
        loadInto($('#i-list'), function () {
          return apiA(C.list, { status: state.status, search: state.search,
            page: state.page, pageSize: 15 }).then(function (r) {
            table($('#i-list'), [
              { k: 'who', label: 'প্রেরক', fmt: function (it) {
                  return esc(it[C.whoField] || '—'); } },
              { k: C.whoField === 'applicantName' ? 'phone' : 'phone', label: 'মোবাইল' },
              { k: 'main', label: C.mainLabel, fmt: function (it) {
                  return esc(String(it[C.mainField] || '').slice(0, 60)); } },
              { k: 'createdAt', label: 'তারিখ', fmt: function (it) { return dt(it.createdAt); } },
              { k: 'status', label: 'অবস্থা', fmt: function (it) { return badge(it.status); } },
              { k: 'act', label: 'অ্যাকশন', fmt: function (it) {
                  return '<button type="button" class="btn btn-outline mini" data-v="' +
                    esc(it[C.idField]) + '">দেখুন</button>'; } }
            ], r.data.items);
            pager($('#i-pager'), r.data.page, r.data.totalPages, function (p) { state.page = p; draw(); });
            $('#i-list').querySelectorAll('[data-v]').forEach(function (b) {
              b.addEventListener('click', function () { view(b.getAttribute('data-v')); });
            });
          });
        });
      }
      $('#i-q').addEventListener('input', function () {
        state.search = this.value.trim(); state.page = 1;
        clearTimeout(window.__it); window.__it = setTimeout(draw, 350);
      });
      $('#i-st').addEventListener('change', function () { state.status = this.value; state.page = 1; draw(); });
      $('#i-ref').addEventListener('click', draw);
      draw();
    },

    // ---------------- settings (org §47 + payment methods §33) ----------------
    settings: function (root) {
      root.innerHTML = '<div class="sec-card"><h2>সংগঠনের তথ্য / মিশন / ভিশন</h2>' +
        '<form id="org-f" novalidate></form></div>' +
        '<div class="sec-card"><h2>পেমেন্ট মাধ্যম (§33)</h2>' +
        '<p class="step-note">এখানে শুধু প্রদর্শনের তথ্য রাখুন — কোনো পাসওয়ার্ড/PIN/সিক্রেট নয়। স্ট্যাটাস ACTIVE করলে সদস্য পোর্টালে দেখা যাবে।</p>' +
        '<div class="toolbar"><button type="button" class="btn btn-primary" id="pm-add">+ নতুন মাধ্যম</button></div>' +
        '<div id="pm-list2"></div></div>';
      var ORG_FIELDS = [
        { g: 'পরিচিতি', fields: [
          { k: 'organizationNameBn', label: 'সংগঠনের নাম (বাংলা)' },
          { k: 'organizationNameEn', label: 'সংগঠনের নাম (ইংরেজি)' },
          { k: 'sloganBn', label: 'স্লোগান (বাংলা)' }, { k: 'sloganEn', label: 'স্লোগান (ইংরেজি)' },
          { k: 'organizationType', label: 'সংগঠনের ধরন' }]},
        { g: 'মিশন / ভিশন / পরিচিতি', fields: [
          { k: 'missionBn', label: 'মিশন (বাংলা)', type: 'textarea', rows: 3 },
          { k: 'missionEn', label: 'মিশন (ইংরেজি)', type: 'textarea', rows: 3 },
          { k: 'visionBn', label: 'ভিশন (বাংলা)', type: 'textarea', rows: 3 },
          { k: 'visionEn', label: 'ভিশন (ইংরেজি)', type: 'textarea', rows: 3 },
          { k: 'aboutBn', label: 'আমাদের সম্পর্কে (বাংলা)', type: 'textarea', rows: 4 },
          { k: 'aboutEn', label: 'আমাদের সম্পর্কে (ইংরেজি)', type: 'textarea', rows: 4 }]},
        { g: 'সেবা ও যোগাযোগ', fields: [
          { k: 'serviceAreaBn', label: 'সেবা এলাকা (বাংলা)', type: 'textarea', rows: 2 },
          { k: 'serviceAreaEn', label: 'সেবা এলাকা (ইংরেজি)', type: 'textarea', rows: 2 },
          { k: 'contactPhone', label: 'যোগাযোগ ফোন' }, { k: 'contactEmail', label: 'যোগাযোগ ইমেইল' },
          { k: 'contactAddress', label: 'ঠিকানা' },
          { k: 'facebookUrl', label: 'ফেসবুক পেজ URL' }, { k: 'youtubeUrl', label: 'ইউটিউব URL' }]},
        { g: 'ব্র্যান্ডিং', fields: [
          { k: 'logoFileId', label: 'লোগো', type: 'image', purpose: 'organization' },
          { k: 'faviconFileId', label: 'ফেভিকন', type: 'image', purpose: 'organization' }]}
      ];
      loadInto($('#org-f'), function () {
        return apiA('getOrganizationSettingsAdmin').then(function (r) {
          var map = {};
          (r.data.settings || []).forEach(function (s) { map[s.key] = s.value; });
          var form = $('#org-f');
          form.innerHTML = '';
          ORG_FIELDS.forEach(function (g) {
            var h = el('h3', '', g.g);
            form.appendChild(h);
            var grid = el('div', 'row2');
            grid.style.display = 'grid'; grid.style.gap = '.6rem';
            grid.style.gridTemplateColumns = 'repeat(auto-fit,minmax(260px,1fr))';
            g.fields.forEach(function (f) { grid.innerHTML += fieldHtml(f, map[f.k]); });
            form.appendChild(grid);
          });
          var b = el('button', 'btn btn-primary', 'সব সংরক্ষণ করুন');
          b.type = 'submit'; b.style.marginTop = '1rem';
          form.appendChild(b);
          bindUploads(form);
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var settings = {};
            ORG_FIELDS.forEach(function (grp) {
              grp.fields.forEach(function (f) {
                var inp = form.elements[f.k];
                if (!inp) return;
                settings[f.k] = inp.type === 'checkbox' ? inp.checked : String(inp.value || '').trim();
              });
            });
            apiA('updateOrganizationSettings', { settings: settings })
              .then(function () { PHS.toast('সেটিংস সংরক্ষিত হয়েছে।'); },
                function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
          });
        });
      });
      function drawPm() {
        loadInto($('#pm-list2'), function () {
          return apiA('listPaymentMethodsAdmin').then(function (r) {
            table($('#pm-list2'), [
              { k: 'methodName', label: 'মাধ্যম' },
              { k: 'account', label: 'নম্বর/হিসাব', fmt: function (m) {
                  return esc(m.mobileNumber || m.accountNumber || '—'); } },
              { k: 'displayOrder', label: 'ক্রম', num: true },
              { k: 'status', label: 'অবস্থা', fmt: function (m) { return badge(m.status); } },
              { k: 'act', label: 'অ্যাকশন', fmt: function (m) {
                  return '<button type="button" class="btn btn-outline mini" data-e="' +
                    esc(m.methodId) + '">এডিট</button>'; } }
            ], r.data.methods);
            $('#pm-list2').querySelectorAll('[data-e]').forEach(function (b) {
              b.addEventListener('click', function () {
                var it = r.data.methods.filter(function (m) {
                  return m.methodId === b.getAttribute('data-e'); })[0];
                openPm(it);
              });
            });
          });
        });
      }
      function openPm(it) {
        var F = [
          { k: 'displayName', label: 'প্রদর্শনের নাম' },
          { k: 'accountName', label: 'হিসাবের নাম' },
          { k: 'accountNumber', label: 'একাউন্ট নম্বর (ব্যাংক)' },
          { k: 'mobileNumber', label: 'মোবাইল নম্বর (বিকাশ/রকেট)' },
          { k: 'bankName', label: 'ব্যাংকের নাম' }, { k: 'branch', label: 'শাখা' },
          { k: 'routingNumber', label: 'রাউটিং নম্বর' },
          { k: 'instructions', label: 'নির্দেশনা (সদস্য দেখবে)', type: 'textarea', rows: 2 },
          { k: 'displayOrder', label: 'ক্রম', type: 'number', min: 0 },
          { k: 'status', label: 'অবস্থা', type: 'select', options: [
            { v: 'ACTIVE', l: 'সক্রিয় (সদস্য দেখবে)' }, { v: 'INACTIVE', l: 'নিষ্ক্রিয়' }] }
        ];
        var mm = modal(it ? 'এডিট: ' + it.methodName : 'নতুন মাধ্যম',
          '<form id="pf" novalidate>' +
          (it ? '' : fieldHtml({ k: 'methodName', label: 'মাধ্যমের নাম (ইংরেজি) *', hint: 'যেমন bKash / Rocket / Bank' })) +
          F.map(function (f) { return fieldHtml(f, it ? it[f.k] : ''); }).join('') +
          '<div class="form-actions"><button type="submit" class="btn btn-primary">সংরক্ষণ</button></div></form>');
        var form = mm.body.querySelector('#pf');
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var p = it ? { methodId: it.methodId } : {};
          if (!it) {
            p.methodName = String(form.elements.methodName.value || '').trim();
            if (!p.methodName) { fieldErr(form.elements.methodName, 'আবশ্যক।'); return; }
          }
          var bad = null;
          F.forEach(function (f) {
            var v = String(form.elements[f.k].value || '').trim();
            if (f.req && !v) { fieldErr(form.elements[f.k], 'আবশ্যক।'); bad = bad || form.elements[f.k]; }
            p[f.k] = v;
          });
          if (bad) { bad.focus(); return; }
          apiA('upsertPaymentMethod', p).then(function () { PHS.toast('সংরক্ষিত।'); mm.close(); drawPm(); },
            function (err) { PHS.toast(err.message || 'ব্যর্থ।', 'error'); });
        });
      }
      $('#pm-add').addEventListener('click', function () { openPm(null); });
      drawPm();
    },

    // ---------------- migration (§74/§75) — FIXED ----------------
    migration: function (root) {
      root.innerHTML =
        '<div class="warn-box"><b>গুরুত্বপূর্ণ:</b> ঐতিহাসিক ডেটা <span class="mono">Historical</span> নামে শিটে রাখুন ' +
        '(কলাম: Member Code, Month/Period, Amount, Method, Transaction ID, Note…)। ' +
        'প্রতিটি ইম্পোর্টের আগে স্বয়ংক্রিয় ব্যাকআপ নেওয়া হয়। সন্দেহজনক সারি বাদ দেওয়া হয় না — রিপোর্টে আসে।</div>' +
        '<div class="sec-card"><h2>১. প্রিভিউ (কিছু লেখা হয় না)</h2>' +
        '<div class="toolbar"><button type="button" class="btn btn-outline" id="mg-prev">প্রিভিউ চালান</button></div>' +
        '<div id="mg-prev-out"></div></div>' +
        '<div class="sec-card"><h2>২. ইম্পোর্ট</h2>' +
        '<div class="toolbar"><button type="button" class="btn" id="mg-imp" ' +
        'style="background:var(--danger);color:#fff">ইম্পোর্ট চালান</button>' +
        '<span class="hint">আগে প্রিভিউ দেখে নিন। ইম্পোর্ট পুনরাবৃত্তিযোগ্য — একই সারি দ্বিতীয়বার ঢুকবে না।</span></div>' +
        '<div id="mg-imp-out"></div></div>' +
        '<div class="sec-card"><h2>৩. রিকনসিলিয়েশন</h2>' +
        '<div class="toolbar"><button type="button" class="btn btn-outline" id="mg-rec">রিপোর্ট তৈরি করুন</button></div>' +
        '<div id="mg-rec-out"></div></div>' +
        '<div class="sec-card"><h2>রক্ষণাবেক্ষণ</h2>' +
        '<div class="toolbar"><button type="button" class="btn btn-outline" id="mg-rev">পুরোনো ফাইল-শেয়ার লিংক বাতিল</button></div></div>';

      function show(host, res) {
        host.innerHTML = '';
        var pre = el('pre', 'report');
        pre.textContent = JSON.stringify(res.data, null, 2);
        host.appendChild(pre);
        if (res.data.imported !== undefined) {
          host.appendChild(el('p', 'small muted',
            'ব্যাকআপ: ' + (res.data.backup ? res.data.backup.name : '—')));
        }
      }

      $('#mg-prev').addEventListener('click', function () {
        loadInto($('#mg-prev-out'), function () {
          return apiA('migrationPreview', {}).then(function (r) {
            show($('#mg-prev-out'), r);
            return r;
          });
        });
      });

      $('#mg-imp').addEventListener('click', function () {
        confirmBn('মাইগ্রেশন ইম্পোর্ট',
          'প্রিভিউ দেখে নিয়েছেন? ইম্পোর্ট চালালে ঐতিহাসিক রেকর্ড APPROVED হিসেবে যুক্ত হবে (ব্যাকআপ স্বয়ংক্রিয়)। নিশ্চিত?',
          'ইম্পোর্ট করুন', true).then(function (yes) {
          if (!yes) return;
          loadInto($('#mg-imp-out'), function () {
            return apiA('migrationImport', {}).then(function (r) {
              show($('#mg-imp-out'), r);
              PHS.toast(PHS.bnNumber(r.data.imported || 0) + ' রেকর্ড ইম্পোর্ট হয়েছে।');
              return r;
            });
          });
        });
      });

      $('#mg-rec').addEventListener('click', function () {
        loadInto($('#mg-rec-out'), function () {
          return apiA('migrationReconcile', {}).then(function (r) {
            show($('#mg-rec-out'), r);
            return r;
          });
        });
      });

      $('#mg-rev').addEventListener('click', function () {
        apiA('revokeFileSharing', { maxAgeMinutes: 15 })
          .then(function (r) { PHS.toast(r.message || 'সম্পন্ন।'); })
          .catch(function (e) { PHS.toast(e.message, 'error'); });
      });
    },

    // ---------------- audit (§82) ----------------
    audit: function (root) {
      var state = { page: 1 };
      root.innerHTML =
        '<div class="toolbar">' +
        '<div class="field"><label for="a-at">অভিনেতা</label><select id="a-at">' +
        '<option value="">সব</option><option>ADMIN</option><option>MEMBER</option>' +
        '<option>PUBLIC</option><option>SYSTEM</option></select></div>' +
        '<div class="field"><label for="a-ac">অ্যাকশনে খুঁজুন</label><input id="a-ac" placeholder="যেমন PAYMENT"></div>' +
        '<div class="field"><label for="a-et">এন্টিটি টাইপ</label><input id="a-et"></div>' +
        '<button type="button" class="btn btn-outline" id="a-go">দেখুন</button></div>' +
        '<div id="a-list"></div><div id="a-pager"></div>';
      function draw() {
        loadInto($('#a-list'), function () {
          return apiA('getAuditLogs', { actorType: $('#a-at').value,
            action: $('#a-ac').value.trim(), entityType: $('#a-et').value.trim(),
            page: state.page, pageSize: 20 }).then(function (r) {
            table($('#a-list'), [
              { k: 'timestamp', label: 'সময়', fmt: function (x) { return dt(x.timestamp); } },
              { k: 'actorType', label: 'অভিনেতা' },
              { k: 'actorId', label: 'আইডি', fmt: function (x) {
                  return '<span class="mono small">' + esc(String(x.actorId || '').slice(0, 16)) + '</span>'; } },
              { k: 'action', label: 'অ্যাকশন', fmt: function (x) {
                  return '<span class="mono">' + esc(x.action) + '</span>'; } },
              { k: 'entity', label: 'এন্টিটি', fmt: function (x) {
                  return esc((x.entityType || '') + ' ' + String(x.entityId || '').slice(0, 14)); } },
              { k: 'metadata', label: 'মেটাডেটা', fmt: function (x) {
                  var m = x.metadata || '';
                  try { m = JSON.stringify(JSON.parse(m)); } catch (e) {}
                  return '<span class="mono small">' + esc(String(m).slice(0, 80)) + '</span>'; } }
            ], r.data.items);
            pager($('#a-pager'), r.data.page, r.data.totalPages, function (p) { state.page = p; draw(); });
          });
        });
      }
      $('#a-go').addEventListener('click', function () { state.page = 1; draw(); });
      draw();
    },

    // ---------------- login ----------------
    'a-login': function () {
      if (new URLSearchParams(location.search).get('exp')) {
        var a = $('#lg-alert');
        a.textContent = 'সেশনের মেয়াদ শেষ হয়েছে। আবার লগইন করুন।';
        a.hidden = false;
      }
      var form = $('#lg-form');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var em = $('#lg-email'), pw = $('#lg-pass'), alertEl = $('#lg-alert');
        alertEl.hidden = true;
        var okAll = true;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim()) &&
            em.value.trim().length < 3) {
          fieldErr(em, 'ইমেইল বা ইউজারনেম দিন।'); okAll = false;
        } else fieldErr(em, '');
        if (!pw.value) { fieldErr(pw, 'পাসওয়ার্ড দিন।'); okAll = false; } else fieldErr(pw, '');
        if (!okAll) return;
        var btn = form.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = 'লগইন হচ্ছে…';
        PHS.api('adminLogin', { email: em.value.trim(), password: pw.value })
          .then(function (r) {
            localStorage.setItem(SESSION_KEY, JSON.stringify({
              token: r.data.sessionToken, expiresAt: r.data.expiresAt, admin: r.data.admin
            }));
            location.replace('dashboard.html');
          })
          .catch(function (err) {
            btn.disabled = false; btn.textContent = 'লগইন';
            alertEl.className = 'form-alert form-alert-error';
            alertEl.textContent = err.message || 'লগইন ব্যর্থ।';
            alertEl.hidden = false;
          });
      });
    }
  };

  // ============================================================ CMS/inbox configs

  var CMS_MODULES = {
    activities: { key: 'activities', title: 'কার্যক্রম', idField: 'activityId',
      previewUrl: function (it) {
        return BASE + 'activity-details.html?' + (it.slug ? 'slug=' + encodeURIComponent(it.slug)
          : 'id=' + encodeURIComponent(it.activityId)); },
      listExtra: [
        { k: 'category', label: 'ক্যাটাগরি' },
        { k: 'date', label: 'তারিখ', fmt: function (it) { return it.date ? esc(PHS.dateLabel(it.date)) : '—'; } }],
      fields: [
        { k: 'title', label: 'শিরোনাম *' },
        { k: 'slug', label: 'স্লাগ (খালি রাখলে শিরোনাম থেকে)', hint: 'URL-বান্ধব নাম' },
        { k: 'category', label: 'ক্যাটাগরি' },
        { k: 'date', label: 'তারিখ', type: 'date' },
        { k: 'location', label: 'স্থান' },
        { k: 'beneficiaryCount', label: 'সহায়তাপ্রাপ্ত সংখ্যা', type: 'number', min: 0 },
        { k: 'displayOrder', label: 'ক্রম', type: 'number', min: 0 },
        { k: 'shortDescription', label: 'সংক্ষিপ্ত বিবরণ' },
        { k: 'description', label: 'বিস্তারিত বিবরণ', type: 'textarea', rows: 6 },
        { k: 'imageUrl', label: 'ছবি', type: 'image', purpose: 'activity' }] },
    services: { key: 'services', title: 'সেবা', idField: 'serviceId',
      previewUrl: function () { return BASE + 'services.html'; },
      listExtra: [{ k: 'icon', label: 'আইকন' }],
      fields: [
        { k: 'title', label: 'শিরোনাম *' },
        { k: 'description', label: 'বিবরণ', type: 'textarea', rows: 5 },
        { k: 'icon', label: 'আইকন (ইমোজি)', hint: 'যেমন 📚 🍲 ❤️' },
        { k: 'displayOrder', label: 'ক্রম', type: 'number', min: 0 },
        { k: 'imageUrl', label: 'ছবি', type: 'image', purpose: 'organization' }] },
    projects: { key: 'projects', title: 'প্রকল্প', idField: 'projectId',
      previewUrl: function (it) {
        return BASE + 'project.html?' + (it.slug ? 'slug=' + encodeURIComponent(it.slug)
          : 'id=' + encodeURIComponent(it.projectId)); },
      listExtra: [
        { k: 'category', label: 'ক্যাটাগরি' },
        { k: 'status2', label: 'প্রকল্প অবস্থা', fmt: function (it) { return esc(it.status || '—'); } }],
      fields: [
        { k: 'title', label: 'শিরোনাম *' },
        { k: 'slug', label: 'স্লাগ' },
        { k: 'category', label: 'ক্যাটাগরি' },
        { k: 'status', label: 'প্রকল্পের অবস্থা (যেমন ONGOING/COMPLETED)' },
        { k: 'location', label: 'স্থান' },
        { k: 'targetAmount', label: 'লক্ষ্য (৳)', type: 'number', step: '0.01', min: 0 },
        { k: 'collectedAmount', label: 'সংগৃহীত (৳)', type: 'number', step: '0.01', min: 0,
          hint: 'শুধু বাস্তব অনুমোদিত তথ্য — বানানো যাবে না' },
        { k: 'beneficiaryCount', label: 'সহায়তাপ্রাপ্ত', type: 'number', min: 0 },
        { k: 'startDate', label: 'শুরু', type: 'date' },
        { k: 'endDate', label: 'শেষ', type: 'date' },
        { k: 'displayOrder', label: 'ক্রম', type: 'number', min: 0 },
        { k: 'description', label: 'বিবরণ', type: 'textarea', rows: 6 },
        { k: 'imageUrl', label: 'ছবি', type: 'image', purpose: 'project' }] },
    news: { key: 'news', title: 'সংবাদ', idField: 'newsId',
      previewUrl: function (it) {
        return BASE + 'news-details.html?' + (it.slug ? 'slug=' + encodeURIComponent(it.slug)
          : 'id=' + encodeURIComponent(it.newsId)); },
      listExtra: [{ k: 'publishedDate', label: 'প্রকাশের তারিখ',
        fmt: function (it) { return it.publishedDate ? esc(PHS.dateLabel(it.publishedDate)) : '—'; } }],
      fields: [
        { k: 'title', label: 'শিরোনাম *' },
        { k: 'slug', label: 'স্লাগ' },
        { k: 'summary', label: 'সারসংক্ষেপ' },
        { k: 'content', label: 'মূল লেখা', type: 'textarea', rows: 8 },
        { k: 'publishedDate', label: 'প্রকাশের তারিখ', type: 'date',
          hint: 'খালি রাখলে প্রকাশের সময় স্বয়ংক্রিয় সেট হবে' },
        { k: 'imageUrl', label: 'ছবি', type: 'image', purpose: 'news' }] },
    successStories: { key: 'successStories', title: 'সাফল্যের গল্প', idField: 'storyId',
      previewUrl: function (it) { return BASE + 'success-story.html?id=' + encodeURIComponent(it.storyId); },
      listExtra: [{ k: 'beneficiaryName', label: 'উপকারভোগী' }],
      fields: [
        { k: 'title', label: 'শিরোনাম *' },
        { k: 'beneficiaryName', label: 'উপকারভোগীর নাম', hint: 'সম্মতি থাকলেই দিন' },
        { k: 'location', label: 'স্থান' },
        { k: 'story', label: 'গল্প', type: 'textarea', rows: 7 },
        { k: 'imageUrl', label: 'ছবি', type: 'image', purpose: 'successStory' }] },
    gallery: { key: 'gallery', title: 'গ্যালারি', idField: 'galleryId',
      previewUrl: function () { return BASE + 'gallery.html'; },
      listExtra: [{ k: 'category', label: 'ক্যাটাগরি' }],
      fields: [
        { k: 'title', label: 'শিরোনাম' },
        { k: 'imageUrl', label: 'ছবি *', type: 'image', purpose: 'gallery', req: true },
        { k: 'category', label: 'ক্যাটাগরি' },
        { k: 'description', label: 'ক্যাপশন/বিবরণ' },
        { k: 'displayOrder', label: 'ক্রম', type: 'number', min: 0 }] }
  };

  var INBOX_CFG = {
    volunteers: { title: 'স্বেচ্ছাসেবক আবেদন', list: 'getVolunteers', one: 'getVolunteer',
      set: 'updateVolunteerStatus', idField: 'volunteerId', whoField: 'name',
      mainField: 'interest', mainLabel: 'আগ্রহ',
      statuses: ['NEW', 'APPROVED', 'REJECTED', 'ARCHIVED'],
      fields: [['name', 'নাম'], ['phone', 'মোবাইল'], ['email', 'ইমেইল'], ['address', 'ঠিকানা'],
        ['interest', 'আগ্রহের বিষয়'], ['experience', 'অভিজ্ঞতা'], ['availability', 'সময়'],
        ['message', 'বার্তা'], ['adminNote', 'অ্যাডমিন নোট']] },
    helpRequests: { title: 'সহায়তা আবেদন', list: 'getHelpRequests', one: 'getHelpRequest',
      set: 'updateHelpRequestStatus', idField: 'requestId', whoField: 'applicantName',
      mainField: 'assistanceType', mainLabel: 'সহায়তার ধরন',
      statuses: ['NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'],
      fields: [['applicantName', 'আবেদনকারী'], ['phone', 'মোবাইল'], ['village', 'গ্রাম'],
        ['union', 'ইউনিয়ন'], ['upazila', 'উপজেলা'], ['district', 'জেলা'],
        ['familyMembers', 'পরিবারের সদস্য'], ['monthlyIncome', 'মাসিক আয়'],
        ['assistanceType', 'সহায়তার ধরন'], ['description', 'বিবরণ'],
        ['adminNote', 'অ্যাডমিন নোট']] },
    contactMessages: { title: 'যোগাযোগ বার্তা', list: 'getContactMessages', one: 'getContactMessage',
      set: 'updateContactMessageStatus', idField: 'messageId', whoField: 'name',
      mainField: 'subject', mainLabel: 'বিষয়',
      statuses: ['NEW', 'RESOLVED', 'ARCHIVED'],
      fields: [['name', 'নাম'], ['phone', 'মোবাইল'], ['email', 'ইমেইল'],
        ['subject', 'বিষয়'], ['message', 'বার্তা'], ['adminNote', 'অ্যাডমিন নোট']] }
  };

  // ============================================================ boot

  function boot() {
    var page = document.body.getAttribute('data-page');
    if (!PHS.hasApi()) {
      document.body.insertBefore(el('div', 'config-banner',
        'কনফিগারেশন বাকি: assets/js/api.js-এ API_URL সেট করুন।'), document.body.firstChild);
      return;
    }
    if (page === 'a-login') { Pages['a-login'](); return; }
    var sess = getSess();
    if (!sess) { location.replace('login.html'); return; }
    PHS.api('adminSessionCheck', { sessionToken: sess.token })
      .then(function (r) {
        sess.admin = r.data.admin;
        localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
        var root = renderShell(sess);
        var mod = document.body.getAttribute('data-module');
        if (page === 'content') Pages.content(root, mod);
        else if (page === 'inbox') Pages.inbox(root, mod);
        else if (Pages[page]) Pages[page](root);
      })
      .catch(function (e) {
        if (!e.handled) {
          localStorage.removeItem(SESSION_KEY);
          location.replace('login.html');
        }
      });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  /** Small helper used by chanda page default month (local, Bengali tz intent). */
  if (!PHS.monthKeyNowLocal) {
    PHS.monthKeyNowLocal = function () {
      var d = new Date();
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    };
  }
  /** §Finance: default "today" for date inputs on the Expenditure/Donation forms. */
  if (!PHS.dateKeyNowLocal) {
    PHS.dateKeyNowLocal = function () {
      var d = new Date();
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    };
  }
})();