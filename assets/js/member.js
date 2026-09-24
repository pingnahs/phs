/* member.js — member portal shell + 5 pages. Identity comes ONLY from the
   session token (server-derived); all Chanda figures are server-computed. */
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  var ORG = 'পিংনা হিতৈষী সংঘ';

  var STATUS = {
    PAID:       { label: 'পরিশোধিত',   icon: '✅', cls: 'badge-paid' },
    APPROVED:   { label: 'অনুমোদিত',   icon: '✅', cls: 'badge-paid' },
    PARTIAL:    { label: 'আংশিক',      icon: '🟡', cls: 'badge-partial' },
    DUE:        { label: 'বকেয়া',      icon: '⏳', cls: 'badge-due' },
    PENDING:    { label: 'যাচাই চলছে', icon: '🔎', cls: 'badge-pending' },
    REJECTED:   { label: 'প্রত্যাখ্যাত', icon: '❌', cls: 'badge-rejected' },
    CANCELLED:  { label: 'বাতিল',      icon: '🚫', cls: 'badge-na' },
    NOT_APPLICABLE: { label: 'প্রযোজ্য নয়', icon: '—', cls: 'badge-na' }
  };
  function badge(status) {
    var s = STATUS[String(status || '')] ||
            { label: String(status || '—'), icon: '•', cls: 'badge-na' };
    return '<span class="badge ' + s.cls + '">' + s.icon + ' ' + PHS.esc(s.label) + '</span>';
  }
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'স';
    return parts.length === 1 ? parts[0].slice(0, 2)
      : parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
  }
  /** Session-aware API call: expiry/invalidity → clean re-login (§11). */
  function apiM(action, data) {
    var s = PHS.getSession();
    return PHS.api(action, Object.assign({ sessionToken: s ? s.token : '' }, data || {}))
      .catch(function (e) {
        if (e.code === 'AUTH_EXPIRED' || e.code === 'AUTH_INVALID') {
          PHS.clearSession();
          location.replace('login.html?exp=1');
          e.handled = true;
        }
        throw e;
      });
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
  function fieldErr(input, msg) {
    var wrap = input.closest('.field');
    var err = wrap ? wrap.querySelector('.err') : null;
    if (err) err.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function busy(btn, on, label) {
    btn.disabled = !!on;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.innerHTML = '<span class="spin" aria-hidden="true"></span> ' + PHS.esc(label || 'অপেক্ষা করুন…');
      btn.setAttribute('aria-busy', 'true');
    } else {
      btn.textContent = btn.dataset.label || btn.textContent;
      btn.removeAttribute('aria-busy');
    }
  }
  /** §Finance/§10: dependency-free income-vs-expenditure bar chart (mirrors
   *  the admin.js version — kept local per this file's existing convention
   *  of not sharing internals across the two portal scripts). */
  function finChart(host, rows) {
    if (!host) return;
    if (!rows || !rows.length) { host.innerHTML = '<p class="loading">চার্টের জন্য যথেষ্ট তথ্য নেই।</p>'; return; }
    var max = 1;
    rows.forEach(function (r) { max = Math.max(max, r.income || 0, r.expenditure || 0); });
    var cols = rows.map(function (r) {
      var hi = Math.max(Math.round(((r.income || 0) / max) * 100), (r.income > 0 ? 2 : 0));
      var he = Math.max(Math.round(((r.expenditure || 0) / max) * 100), (r.expenditure > 0 ? 2 : 0));
      var shortLbl = String(r.label || '').split(' ')[0].slice(0, 3);
      return '<div class="fin-chart-col" title="' + PHS.esc(r.label) + ' — আয় ' + PHS.bdt(r.income) +
        ', ব্যয় ' + PHS.bdt(r.expenditure) + '">' +
        '<div class="fin-chart-bar-pair">' +
        '<div class="fin-bar fin-bar-income" style="height:' + hi + '%"></div>' +
        '<div class="fin-bar fin-bar-exp" style="height:' + he + '%"></div>' +
        '</div><div class="fin-chart-label">' + PHS.esc(shortLbl) + '</div></div>';
    }).join('');
    host.innerHTML = '<div class="fin-chart"><div class="fin-chart-bars">' + cols + '</div>' +
      '<div class="fin-chart-legend"><span><i class="fin-dot fin-dot-income"></i>আয়</span>' +
      '<span><i class="fin-dot fin-dot-exp"></i>ব্যয়</span></div></div>';
  }

  var NAV = [
    ['dashboard.html', 'ড্যাশবোর্ড'], ['chanda.html', 'চাঁদা'],
    ['payment.html', 'পেমেন্ট'], ['payments.html', 'পেমেন্ট ইতিহাস'],
    ['finance.html', 'আর্থিক তথ্য'], ['profile.html', 'প্রোফাইল']
  ];

  function renderShell() {
    var host = $('#site-header');
    host.innerHTML =
      '<div class="container header-in">' +
        '<a class="brand" href="dashboard.html"><span class="brand-name">' +
          '<span>' + PHS.esc(ORG) + '</span><small>সদস্য পোর্টাল</small></span></a>' +
        '<button type="button" class="logout-btn" id="logout-top">লগআউট</button>' +
      '</div>';
    var nav = $('#portal-nav .chips');
    var page = location.pathname.split('/').pop();
    NAV.forEach(function (n) {
      var b = el('button', 'chip', n[1]);
      b.type = 'button';
      if (page === n[0]) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', function () { location.href = n[0]; });
      nav.appendChild(b);
    });
    function doLogout() {
      var s = PHS.getSession();
      var done = function () { PHS.clearSession(); location.replace('login.html'); };
      if (s && PHS.hasApi()) {
        PHS.api('logoutMember', { sessionToken: s.token }).then(done, done);
      } else { done(); }
    }
    $('#logout-top').addEventListener('click', doLogout);
  }

  // ------------------------------------------------------------ pages

  var Pages = {

    // ---------------- §12 dashboard ----------------
    'm-dashboard': function () {
      var box = $('#dash');
      loadInto(box, function () {
        return apiM('getMyDashboard').then(function (r) {
          var d = r.data, p = d.profile, c = d.chanda;
          box.innerHTML = '';
          var head = el('div', 'member-head');
          head.innerHTML =
            '<div class="avatar" id="avatar">' + PHS.esc(initials(p.nameBn || p.nameEn || p.memberCode)) + '</div>' +
            '<div><h1>' + PHS.esc(p.nameBn || p.nameEn || p.memberCode) + '</h1>' +
            '<div class="code">কোড: ' + PHS.esc(p.memberCode) +
            (p.joiningMonth ? ' · যোগদান: ' + PHS.esc(PHS.monthLabel(p.joiningMonth)) : '') + '</div></div>';
          box.appendChild(head);
          // §Image fix: render straight from the fileId via PHS.imgUrl (the
          // correct public-thumbnail format) — no extra round trip, and no
          // reliance on the temp-view endpoint meant for sensitive documents.
          // Falls back to the initials already in #avatar if the photo 404s.
          if (p.profilePhotoFileId) {
            var photoUrl = PHS.imgUrl(p.profilePhotoFileId, 240);
            if (photoUrl) {
              var img = new Image();
              img.alt = 'প্রোফাইল ছবি';
              img.onload = function () {
                var av = $('#avatar');
                if (av) { av.textContent = ''; av.appendChild(img); av.classList.add('has-photo'); }
              };
              img.src = photoUrl; // onerror: initials fallback already in place
            }
          }
          if (d.chandaError || !c) {
            box.appendChild(el('div', 'big-alert big-alert-warn',
              (d.chandaError && d.chandaError.message) ||
              'চাঁদার হিসাব এখন দেখানো যাচ্ছে না। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।'));
            return;
          }
          var g = el('div', 'stat-grid-3 mt');
          g.innerHTML = [
            ['💰', 'মাসিক চাঁদা', PHS.bdt(c.currentMonthRequiredAmount || p.monthlyChandaAmount)],
            ['✅', 'পরিশোধিত মাস', PHS.bnNumber(c.paidMonths)],
            ['⏳', 'বকেয়া মাস', PHS.bnNumber(c.dueMonths)],
            ['🔎', 'যাচাই চলছে', PHS.bnNumber(c.pendingMonths)],
            ['🧾', 'মোট বকেয়া', PHS.bdt(c.totalOutstandingAmount)],
            ['📅', 'পরিশোধিত ধারাবাহিকভাবে', c.paidThroughMonth ? PHS.monthLabel(c.paidThroughMonth) : '—'],
            ['🏆', 'সর্বশেষ পরিশোধিত মাস', c.lastPaidMonth ? PHS.monthLabel(c.lastPaidMonth) : '—'],
            ['📌', 'চলতি মাস (' + PHS.esc(PHS.monthLabel(c.currentMonth)) + ')', '']
          ].map(function (s, i) {
            return '<div class="stat"><div class="ic">' + s[0] + '</div>' +
              '<div class="v">' + s[2] + '</div><div class="l">' + s[1] + '</div>' +
              (i === 7 ? badge(c.currentMonthStatus) : '') + '</div>';
          }).join('');
          box.appendChild(g);
          if (d.latestPayment) {
            var lp = d.latestPayment;
            var card = el('div', 'card mt');
            card.innerHTML = '<div class="card-body"><h3>সর্বশেষ পেমেন্ট জমা</h3>' +
              '<div class="card-meta">' + PHS.esc(PHS.monthLabel(lp.period)) +
              ' · ' + PHS.bdt(lp.amount) + ' · ' + PHS.esc(lp.paymentMethod) + '</div>' +
              '<p class="card-text">ট্রানজেকশন: ' + PHS.esc(lp.transactionId) +
              ' · অবস্থা: ' + badge(lp.status) + '</p>' +
              '<a class="btn btn-outline" href="payments.html">পেমেন্ট ইতিহাস</a></div>';
            box.appendChild(card);
          }
          var payable = c.currentMonthStatus !== 'PAID' &&
                        c.totalOutstandingAmount > 0;
          var act = el('div', 'center mt');
          var a = el('a', 'btn ' + (payable ? 'btn-primary' : 'btn-outline'),
            payable ? 'চাঁদা পরিশোধ করুন' : 'চাঁদার বিবরণ দেখুন');
          a.href = payable ? 'payment.html' : 'chanda.html';
          act.appendChild(a);
          box.appendChild(act);
        });
      });
      // §7: Financial Overview — independent of this member's own chanda calc
      // status (org-wide figures only), so it still loads even if the block
      // above hit a per-member chanda exception.
      var finBox = $('#fin-overview');
      if (finBox) {
        loadInto(finBox, function () {
          return apiM('getFinancialSummary').then(function (r) {
            var f = r.data;
            finBox.innerHTML = '';
            finBox.appendChild(el('h2', '', 'সংগঠনের আর্থিক তথ্য'));
            var balCls = f.currentBalance >= 0 ? 'stat-balance-pos' : 'stat-balance-neg';
            var g = el('div', 'stat-grid-3');
            g.innerHTML = [
              ['💰', 'মোট চাঁদা আয়', PHS.bdt(f.totalChada), ''],
              ['🎁', 'মোট অনুদান', PHS.bdt(f.totalDonation), ''],
              ['➕', 'অন্যান্য আয়', PHS.bdt(f.otherIncome), ''],
              ['📈', 'মোট আয়', PHS.bdt(f.totalIncome), ''],
              ['📉', 'মোট ব্যয়', PHS.bdt(f.totalExpenditure), ''],
              ['🏦', 'বর্তমান স্থিতি', PHS.bdt(f.currentBalance), balCls]
            ].map(function (c) {
              return '<div class="stat ' + c[3] + '"><div class="ic">' + c[0] + '</div>' +
                '<div class="v">' + c[2] + '</div><div class="l">' + c[1] + '</div></div>';
            }).join('');
            finBox.appendChild(g);
            // §Advance Chanda fix: "মোট চাঁদা আয়" above is now the true total
            // (current + advance, from Chanda.gs's grandTotalPaidAmount) —
            // this line breaks it down so it's clear at a glance, without
            // touching the existing 6-card grid.
            if (f.totalAdvanceChada > 0) {
              var chandaBreak = el('div', 'sum-band');
              chandaBreak.innerHTML =
                '<span>বর্তমান মাস পর্যন্ত চাঁদা: <b>' + PHS.bdt(f.totalChadaThroughCurrentMonth) + '</b></span>' +
                '<span>অগ্রিম চাঁদা: <b>' + PHS.bdt(f.totalAdvanceChada) + '</b></span>';
              finBox.appendChild(chandaBreak);
            }
            var link = el('a', 'btn btn-outline mt', 'সম্পূর্ণ আর্থিক তথ্য দেখুন');
            link.href = 'finance.html';
            finBox.appendChild(link);
          });
        });
      }
    },

    // ---------------- chanda page ----------------
    'm-chanda': function () {
      var box = $('#chanda');
      loadInto(box, function () {
        return Promise.all([apiM('getMyChanda'), apiM('getMyPayableMonths').catch(function () { return null; })])
          .then(function (res) {
          var r = res[0], pm = res[1] && res[1].data;
          var c = r.data.chanda;
          box.innerHTML = '';
          if (r.data.chandaError || !c) {
            box.appendChild(el('div', 'big-alert big-alert-warn',
              (r.data.chandaError && r.data.chandaError.message) ||
              'চাঁদার হিসাব দেখানো যাচ্ছে না। অ্যাডমিনের সাথে যোগাযোগ করুন।'));
            return;
          }
          box.appendChild(el('h1', '', 'আমার চাঁদা'));
          var band = el('div', 'sum-band');
          band.innerHTML =
            '<span>মোট প্রত্যাশিত (বর্তমান মাস পর্যন্ত): <b>' + PHS.bdt(c.totalExpectedAmount) + '</b></span>' +
            '<span>বর্তমান মাস পর্যন্ত চাঁদা (পরিশোধিত): <b>' + PHS.bdt(c.totalPaidAmount) + '</b></span>' +
            '<span>মোট বকেয়া: <b>' + PHS.bdt(c.totalOutstandingAmount) + '</b></span>' +
            (c.totalCreditAmount > 0 ? '<span>ক্রেডিট: <b>' + PHS.bdt(c.totalCreditAmount) + '</b></span>' : '');
          box.appendChild(band);
          // §Advance Chanda fix: the core engine intentionally never reports
          // future-dated months in monthlyBreakdown/totalPaidAmount (it caps
          // at the current month — a future month isn't "expected" yet), but
          // that money is real and already approved, so it must still be
          // shown to the member. totalAdvancePaidAmount/grandTotalPaidAmount
          // come straight from the engine now (§Advance in Chanda.gs), so
          // this always matches Admin Financial Management exactly.
          if (c.totalAdvancePaidAmount > 0) {
            var advBand = el('div', 'sum-band advance-band');
            advBand.innerHTML =
              '<span>✅ অগ্রিম চাঁদা: <b>' + PHS.bdt(c.totalAdvancePaidAmount) + '</b>' +
              (pm && pm.advancePaid && pm.advancePaid.length
                ? ' (' + pm.advancePaid.map(function (a) { return PHS.esc(PHS.monthLabel(a.period)); }).join(', ') + ' পর্যন্ত)'
                : '') + '</span>' +
              '<span>মোট পরিশোধিত চাঁদা: <b>' + PHS.bdt(c.grandTotalPaidAmount) + '</b></span>';
            box.appendChild(advBand);
          }
          box.appendChild(el('h2', '', 'মাস-ভিত্তিক অবস্থা'));
          if (!c.monthlyBreakdown.length) {
            box.appendChild(el('p', 'loading', 'প্রযোজ্য কোনো মাস নেই।'));
            return;
          }
          c.monthlyBreakdown.slice().reverse().forEach(function (m) {
            var row = el('div', 'month-row');
            row.innerHTML =
              '<span class="m-title">' + PHS.esc(PHS.monthLabel(m.period)) + '</span>' +
              badge(m.status) +
              '<span class="grow"></span>' +
              '<span class="m-amt">প্রয়োজন ' + PHS.bdt(m.requiredAmount) +
              ' · পরিশোধিত ' + PHS.bdt(m.approvedPaidAmount) +
              (m.pendingSubmittedAmount > 0 ? ' · জমা (যাচাইতে) ' + PHS.bdt(m.pendingSubmittedAmount) : '') +
              (m.outstandingAmount > 0 ? ' · বকেয়া <b>' + PHS.bdt(m.outstandingAmount) + '</b>' : '') +
              '</span>';
            if (m.outstandingAmount > 0 && m.status !== 'PAID') {
              var a = el('a', 'btn btn-outline', 'পরিশোধ করুন');
              a.href = 'payment.html?period=' + encodeURIComponent(m.period);
              row.appendChild(a);
            }
            box.appendChild(row);
          });
          if (pm && pm.advanceEnabled && (pm.advance || []).length) {
            var advCta = el('a', 'btn btn-primary mt', '📅 অগ্রিম (Advance) মাস পরিশোধ করুন');
            advCta.href = 'payment.html';
            box.appendChild(advCta);
          }
        });
      });
    },

    // ---------------- §34/§92 + §1(Advance)/§2(Donation) payment flow ----------------
    'm-payment': function () {
      var box = $('#pay');
      loadInto(box, function () {
        var preset = PHS.qs('period') || '';
        return Promise.all([
          apiM('getMyPayableMonths'),
          apiM('getPaymentMethods'),
          PHS.hasApi() ? PHS.api('getPublicConfig') : Promise.resolve({ data: {} })
        ]).then(function (res) {
          var pm = res[0].data, methods = res[1].data.methods || [];
          var maxMB = (res[2].data && res[2].data.screenshotMaxMB) || 5;
          box.innerHTML = '';
          box.appendChild(el('h1', '', 'চাঁদা পরিশোধ'));

          var due = pm.due || [];
          var advance = pm.advanceEnabled ? (pm.advance || []).filter(function (m) { return !m.pendingSubmitted; }) : [];
          var duePending = due.filter(function (m) { return m.pendingSubmitted; });
          var dueSelectable = due.filter(function (m) { return !m.pendingSubmitted; });
          var canDonate = !!pm.donationEnabled;

          if (!dueSelectable.length && !advance.length && !canDonate) {
            box.appendChild(el('div', 'form-ok',
              '<div class="big">🎉</div><h2>কোনো বকেয়া নেই</h2>' +
              '<p class="muted">আপনার প্রযোজ্য সব মাস পরিশোধিত।</p>' +
              '<a class="btn btn-primary" href="chanda.html">চাঁদার বিবরণ</a>'));
            return;
          }
          if (!methods.length) {
            box.appendChild(el('div', 'big-alert big-alert-warn',
              'পেমেন্ট মাধ্যম এখনো সক্রিয় করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।'));
            return;
          }
          if (duePending.length) {
            box.appendChild(el('div', 'step-note',
              PHS.bnNumber(duePending.length) + 'টি মাসের জমা ইতিমধ্যে যাচাই-বাকি (PENDING) আছে — ' +
              'সেগুলো নিচে আর দেখানো হচ্ছে না, দ্বৈত জমা এড়াতে।'));
          }

          var byPeriod = {};
          dueSelectable.forEach(function (m) { byPeriod[m.period] = { amount: m.amount, label: PHS.monthLabel(m.period) }; });
          advance.forEach(function (m) { byPeriod[m.period] = { amount: m.amount, label: PHS.monthLabel(m.period) }; });
          var defaultPeriod = (preset && byPeriod[preset]) ? preset : (dueSelectable[0] ? dueSelectable[0].period : '');

          function monthGroup(title, list, groupId, autoCheckPeriod) {
            if (!list.length) return '';
            return '<h2>' + PHS.esc(title) + '</h2>' +
              (list.length > 1 ? '<label class="select-all-row"><input type="checkbox" data-group-all="' + groupId +
                '"> সব (' + PHS.bnNumber(list.length) + 'টি) নির্বাচন করুন</label>' : '') +
              '<div class="period-group" data-group="' + groupId + '">' +
              list.map(function (m) {
                var checked = m.period === autoCheckPeriod ? ' checked' : '';
                return '<label class="method-card"><input type="checkbox" name="periods" value="' +
                  PHS.esc(m.period) + '" data-group="' + groupId + '"' + checked + '>' +
                  '<b>' + PHS.esc(PHS.monthLabel(m.period)) + '</b> — ' + PHS.esc(PHS.bdt(m.amount)) + '</label>';
              }).join('') + '</div>';
          }

          var form = el('form', 'form-card');
          form.noValidate = true;
          form.innerHTML =
            '<div class="form-alert form-alert-error" role="alert" tabindex="-1" hidden></div>' +
            '<h2>১. মাস নির্বাচন করুন</h2>' +
            (dueSelectable.length ? monthGroup('চলতি/বকেয়া মাস', dueSelectable, 'due', defaultPeriod) :
              '<p class="muted small">কোনো বকেয়া মাস নেই।</p>') +
            (advance.length ? monthGroup('অগ্রিম (Advance) মাস — ভবিষ্যতের জন্য এখনই দিন', advance, 'advance', '') : '') +
            '<span class="err" id="period-err" aria-live="polite"></span>' +
            (canDonate ?
              '<h2>২. চাঁদার বাইরে অতিরিক্ত অনুদান (ঐচ্ছিক)</h2>' +
              '<div class="field"><label for="donAmt">অনুদানের পরিমাণ (৳)</label>' +
              '<input id="donAmt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="০">' +
              '<span class="hint">এটি মাসিক চাঁদা থেকে সম্পূর্ণ আলাদাভাবে গণ্য হবে।</span>' +
              '<span class="err" aria-live="polite"></span></div>' +
              '<div class="field"><label for="donPurpose">অনুদানের উদ্দেশ্য (ঐচ্ছিক)</label>' +
              '<input id="donPurpose" maxlength="150" placeholder="যেমন ত্রাণ তহবিল"></div>' : '') +
            '<h2>' + (canDonate ? '৩' : '২') + '. মোট পরিমাণ</h2>' +
            '<div class="field"><label>সর্বমোট (৳)</label><div><span id="grand-total" class="amount-total">৳০</span></div>' +
            '<div id="total-breakdown" class="step-note"></div></div>' +
            '<h2>' + (canDonate ? '৪' : '৩') + '. পেমেন্ট করুন</h2>' +
            '<div id="methods"></div>' +
            '<h2>' + (canDonate ? '৫' : '৪') + '. জমার তথ্য</h2>' +
            '<div class="field"><label class="req" for="txn">ট্রানজেকশন আইডি</label>' +
            '<input id="txn" name="transactionId" autocomplete="off" placeholder="যেমন 8N7fj2Kd19">' +
            '<span class="hint">বিকাশ/রকেট/ব্যাংক রশিদের TrxID। চাঁদা ও অনুদান একসাথে দিলে একই TrxID ব্যবহার করুন।</span>' +
            '<span class="err" aria-live="polite"></span></div>' +
            '<div class="field"><label class="req" for="sphone">প্রেরকের মোবাইল নম্বর</label>' +
            '<input id="sphone" name="senderPhone" type="tel" inputmode="tel" autocomplete="tel">' +
            '<span class="err" aria-live="polite"></span></div>' +
            '<div class="field"><label for="shot">পেমেন্ট স্ক্রিনশট (JPG/PNG/WebP, সর্বোচ্চ ' +
            PHS.bnNumber(maxMB) + ' MB)</label>' +
            '<input id="shot" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">' +
            '<div id="preview"></div><span class="err" aria-live="polite"></span></div>' +
            '<div class="field"><label for="note">মন্তব্য (ঐচ্ছিক)</label>' +
            '<textarea id="note" name="note" rows="2" maxlength="300"></textarea><span class="err"></span></div>' +
            '<div class="form-actions"><button type="submit" class="btn btn-primary">জমা দিন</button>' +
            '<a class="btn btn-outline" href="chanda.html">বাতিল</a></div>' +
            '<p class="step-note mt">জমা দেওয়ার পর অবস্থা হবে <b>যাচাই চলছে</b> — ' +
            'অ্যাডমিন যাচাই করলে অনুমোদিত দেখাবে।</p>';
          box.appendChild(form);

          var periodBoxes = Array.prototype.slice.call(form.querySelectorAll('input[name="periods"]'));
          var periodErr = $('#period-err');
          var donAmtInp = $('#donAmt'), grandTotal = $('#grand-total'), breakdown = $('#total-breakdown');

          function selectedPeriods() {
            return periodBoxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
          }
          function syncTotals() {
            periodErr.textContent = '';
            form.querySelectorAll('[data-group-all]').forEach(function (allBox) {
              var g = allBox.getAttribute('data-group-all');
              var members = periodBoxes.filter(function (b) { return b.getAttribute('data-group') === g; });
              var checkedCount = members.filter(function (b) { return b.checked; }).length;
              allBox.checked = checkedCount === members.length;
              allBox.indeterminate = checkedCount > 0 && checkedCount < members.length;
            });
            var selP = selectedPeriods();
            var chandaTotal = selP.reduce(function (s, p) { return s + (byPeriod[p] ? byPeriod[p].amount : 0); }, 0);
            var donAmt = donAtmSafe();
            grandTotal.textContent = PHS.bdt(chandaTotal + donAmt);
            var parts = [];
            if (selP.length) {
              parts.push(PHS.bnNumber(selP.length) + 'টি মাসের চাঁদা: ' + PHS.esc(PHS.bdt(chandaTotal)));
            }
            if (donAmt > 0) parts.push('অনুদান: ' + PHS.esc(PHS.bdt(donAmt)));
            breakdown.innerHTML = parts.join(' + ') || 'কোনো মাস/অনুদান নির্বাচিত নয়।';
          }
          function donAtmSafe() {
            if (!donAmtInp) return 0;
            var v = Number(donAmtInp.value);
            return (v > 0) ? v : 0;
          }
          periodBoxes.forEach(function (b) { b.addEventListener('change', syncTotals); });
          form.querySelectorAll('[data-group-all]').forEach(function (allBox) {
            allBox.addEventListener('change', function () {
              var g = allBox.getAttribute('data-group-all');
              periodBoxes.filter(function (b) { return b.getAttribute('data-group') === g; })
                .forEach(function (b) { b.checked = allBox.checked; });
              syncTotals();
            });
          });
          if (donAmtInp) donAmtInp.addEventListener('input', syncTotals);
          syncTotals();

          var mwrap = $('#methods');
          mwrap.innerHTML = methods.map(function (m, i) {
            var lines = [];
            if (m.accountName) lines.push('হিসাবের নাম: ' + PHS.esc(m.accountName));
            var num = m.mobileNumber || m.accountNumber;
            if (num) lines.push('নম্বর/হিসাব: <span class="acc">' + PHS.esc(num) + '</span> ' +
              '<button type="button" class="copy-btn" data-copy="' + PHS.esc(num) + '">কপি</button>');
            if (m.bankName) lines.push('ব্যাংক: ' + PHS.esc(m.bankName) +
              (m.branch ? ' · ' + PHS.esc(m.branch) : '') +
              (m.routingNumber ? ' · রাউটিং ' + PHS.esc(m.routingNumber) : ''));
            if (m.instructions) lines.push('<span class="hint">' + PHS.esc(m.instructions) + '</span>');
            return '<label class="method-card"><input type="radio" name="paymentMethod" value="' +
              PHS.esc(m.methodName) + '"' + (i === 0 ? ' checked' : '') + '>' +
              '<b>' + PHS.esc(m.displayName || m.methodName) + '</b>' +
              (lines.length ? '<div class="step-note">' + lines.join('<br>') + '</div>' : '') +
              '</label>';
          }).join('');
          mwrap.addEventListener('click', function (e) {
            var b = e.target.closest('.copy-btn');
            if (!b) return;
            e.preventDefault();
            var txt = b.getAttribute('data-copy');
            var done = function () { PHS.toast('কপি হয়েছে: ' + txt); };
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(txt).then(done, done);
            } else { done(); }
          });

          var shot = $('#shot'), preview = $('#preview'), fileData = null;
          shot.addEventListener('change', function () {
            fileData = null; preview.innerHTML = '';
            var f = shot.files && shot.files[0];
            if (!f) return;
            if (!/^image\/(jpe?g|png|webp)$/.test(f.type)) {
              shot.value = ''; PHS.toast('শুধু JPG/PNG/WebP ছবি দিন।', 'error'); return;
            }
            if (f.size > maxMB * 1024 * 1024) {
              shot.value = ''; PHS.toast('ছবিটি ' + PHS.bnNumber(maxMB) + ' MB-এর বেশি।', 'error'); return;
            }
            var url = URL.createObjectURL(f);
            preview.innerHTML = '<div class="preview-box">' +
              '<img src="' + url + '" alt="স্ক্রিনশট প্রিভিউ">' +
              '<button type="button" class="preview-remove" aria-label="স্ক্রিনশট সরান">✕</button>' +
              '<div class="file-name">' + PHS.esc(f.name) + ' (' +
              PHS.bnNumber(Math.ceil(f.size / 1024)) + ' KB)</div></div>';
            preview.querySelector('.preview-remove').addEventListener('click', function () {
              fileData = null; shot.value = ''; preview.innerHTML = '';
            });
            var fr = new FileReader();
            fr.onload = function () {
              fileData = { fileName: f.name, mimeType: f.type,
                           dataBase64: String(fr.result).replace(/^data:[^,]+,/, '') };
            };
            fr.onerror = function () { PHS.toast('ছবিটি পড়া যায়নি।', 'error'); };
            fr.readAsDataURL(f);
          });

          var alertEl = form.querySelector('.form-alert');
          function showAlert(msg) { alertEl.textContent = msg; alertEl.hidden = false; alertEl.focus(); }
          function vErr(id, msg) { fieldErr($('#' + id), msg); }
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            alertEl.hidden = true;
            var okAll = true;
            ['txn', 'sphone'].forEach(function (id) { vErr(id, ''); });
            if (donAmtInp) vErr('donAmt', '');
            periodErr.textContent = '';
            var selP = selectedPeriods();
            var donationAmount = donAtmSafe();
            if (donAmtInp && donAmtInp.value && !(donationAmount > 0)) {
              vErr('donAmt', 'সঠিক পরিমাণ দিন অথবা খালি রাখুন।'); okAll = false;
            }
            if (!selP.length && donationAmount <= 0) {
              periodErr.textContent = 'অন্তত একটি মাস নির্বাচন করুন অথবা অনুদানের পরিমাণ দিন।';
              okAll = false;
            }
            var txn = $('#txn').value.trim();
            if (!/^[A-Za-z0-9_-]{4,40}$/.test(txn)) {
              vErr('txn', 'ট্রানজেকশন আইডি ৪–৪০ অক্ষর (অক্ষর/সংখ্যা/-/_) হতে হবে।');
              okAll = false;
            }
            var ph = $('#sphone').value.replace(/[\s\-()]/g, '');
            if (/^\+880/.test(ph)) ph = '0' + ph.slice(4);
            else if (/^880/.test(ph)) ph = '0' + ph.slice(3);
            if (!/^01[3-9]\d{8}$/.test(ph)) {
              vErr('sphone', 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন 01712345678)।');
              okAll = false;
            }
            var method = form.querySelector('input[name="paymentMethod"]:checked');
            if (!method) { PHS.toast('পেমেন্ট মাধ্যম নির্বাচন করুন।', 'error'); okAll = false; }
            if (!okAll) return;

            var btn = form.querySelector('button[type="submit"]');
            busy(btn, true, 'প্রস্তুত হচ্ছে…');
            var totalAmount = selP.reduce(function (s, p) { return s + (byPeriod[p] ? byPeriod[p].amount : 0); }, 0) + donationAmount;
            var finish = function (r) {           // §35: honest PENDING result
              box.innerHTML = '';
              box.appendChild(el('div', 'form-ok')).innerHTML =
                '<div class="big">📨</div><h2>জমা সম্পন্ন হয়েছে</h2>' +
                '<p>' + PHS.esc(r.message) + '</p>' +
                '<p class="muted small">' +
                (selP.length ? 'মাস: ' + PHS.esc(selP.map(function (p) { return PHS.monthLabel(p); }).join(', ')) + ' · ' : '') +
                (donationAmount > 0 ? 'অনুদান: ' + PHS.esc(PHS.bdt(donationAmount)) + ' · ' : '') +
                'সর্বমোট: ' + PHS.esc(PHS.bdt(totalAmount)) +
                ' · অবস্থা: ' + badge('PENDING') + '</p>' +
                '<div class="form-actions" style="justify-content:center">' +
                '<a class="btn btn-primary" href="payments.html">পেমেন্ট ইতিহাস</a>' +
                '<a class="btn btn-outline" href="dashboard.html">ড্যাশবোর্ড</a></div>';
            };
            var send = function (ticket) {
              busy(btn, true, 'জমা হচ্ছে…');
              apiM('submitChandaAndDonation', {
                periods: selP, donationAmount: donationAmount > 0 ? donationAmount : '',
                donationPurpose: $('#donPurpose') ? $('#donPurpose').value.trim() : '',
                paymentMethod: method.value, transactionId: txn, senderPhone: ph,
                note: $('#note').value.trim(), screenshotTicket: ticket || ''
              }).then(finish, function (err) {
                busy(btn, false);
                if (!err.handled) showAlert(err.message || 'জমা দেওয়া যায়নি। আবার চেষ্টা করুন।');
              });
            };
            if (!fileData) { send(''); return; }   // screenshot optional
            busy(btn, true, 'স্ক্রিনশট আপলোড হচ্ছে…');
            apiM('uploadPaymentScreenshot', fileData).then(function (up) {
              send(up.data.uploadTicket);
            }, function (err) {
              busy(btn, false);
              if (!err.handled) showAlert(err.message || 'স্ক্রিনশট আপলোড করা যায়নি।');
            });
          });
        });
      });
    },

    // ---------------- payment history (§88) ----------------
    'm-payments': function () {
      var box = $('#hist');
      var fPeriod = $('#f-period'), fStatus = $('#f-status');
      function draw() {
        loadInto(box, function () {
          var q = {};
          if (fPeriod.value) q.period = fPeriod.value;
          if (fStatus.value) q.status = fStatus.value;
          q.pageSize = 100;
          return apiM('getMyPayments', q).then(function (r) {
            var items = r.data.items || [];
            box.innerHTML = '';
            if (!items.length) {
              box.appendChild(el('p', 'loading', 'এই ফিল্টারে কোনো পেমেন্ট পাওয়া যায়নি।'));
              return;
            }
            items.forEach(function (p) {
              var card = el('div', 'month-row');
              card.innerHTML =
                '<span class="m-title">' + PHS.esc(PHS.monthLabel(p.period)) + '</span>' +
                badge(p.status) + '<span class="grow"></span>' +
                '<span class="m-amt">' + PHS.esc(PHS.bdt(p.amount)) + ' · ' +
                PHS.esc(p.paymentMethod) + ' · TrxID ' + PHS.esc(p.transactionId) + '</span>';
              var meta = [];
              if (p.submittedAt) meta.push('জমা: ' + PHS.esc((p.submittedAt || '').slice(0, 10)));
              if (p.approvedAt) meta.push('অনুমোদন: ' + PHS.esc((p.approvedAt || '').slice(0, 10)));
              if (p.status === 'REJECTED' && p.adminNote) {
                meta.push('কারণ: ' + PHS.esc(p.adminNote));
              }
              if (meta.length) {
                var d = el('div', 'step-note'); d.style.flexBasis = '100%';
                d.textContent = meta.join(' · ');
                card.appendChild(d);
              }
              box.appendChild(card);
            });
          });
        });
      }
      fPeriod.addEventListener('change', draw);
      fStatus.addEventListener('change', draw);
      draw();

      // §2 Donation — member's own submissions, same trust-model transparency
      // as Chanda payments above (own PENDING/ACTIVE/REJECTED/CANCELLED, not masked).
      var donHist = $('#hist-don');
      if (donHist) {
        loadInto(donHist, function () {
          return apiM('getMyDonations', { pageSize: 50 }).then(function (r) {
            var items = r.data.items || [];
            donHist.innerHTML = '';
            if (!items.length) {
              donHist.appendChild(el('p', 'loading', 'আপনি এখনো কোনো অনুদান জমা দেননি।'));
              return;
            }
            items.forEach(function (d) {
              var card = el('div', 'month-row');
              card.innerHTML =
                '<span class="m-title">' + PHS.esc(d.purpose || 'অনুদান') + '</span>' +
                badge(d.status) + '<span class="grow"></span>' +
                '<span class="m-amt">' + PHS.esc(PHS.bdt(d.amount)) + ' · ' +
                PHS.esc(d.paymentMethod) + (d.referenceNumber ? ' · TrxID ' + PHS.esc(d.referenceNumber) : '') + '</span>';
              var meta = [];
              if (d.date) meta.push('তারিখ: ' + PHS.esc(PHS.dateLabel(d.date)));
              if (d.status === 'REJECTED' && d.adminNote) meta.push('কারণ: ' + PHS.esc(d.adminNote));
              if (meta.length) {
                var mrow = el('div', 'step-note'); mrow.style.flexBasis = '100%';
                mrow.textContent = meta.join(' · ');
                card.appendChild(mrow);
              }
              donHist.appendChild(card);
            });
          });
        });
      }
    },

    // ---------------- §7/§8 finance (org-wide Financial Overview) ----------------
    'm-finance': function () {
      var sumBox = $('#fin-sum'), chartBox = $('#fin-chart-box'), expBox = $('#fin-exp'), donBox = $('#fin-don');

      loadInto(sumBox, function () {
        return Promise.all([apiM('getFinancialSummary'), apiM('getFinancialTrends', { months: 12 })])
          .then(function (rs) {
            var f = rs[0].data, months = rs[1].data.months;
            sumBox.innerHTML = '';
            var balCls = f.currentBalance >= 0 ? 'stat-balance-pos' : 'stat-balance-neg';
            var g = el('div', 'stat-grid-3');
            g.innerHTML = [
              ['💰', 'মোট চাঁদা আয়', PHS.bdt(f.totalChada), ''],
              ['🎁', 'মোট অনুদান', PHS.bdt(f.totalDonation), ''],
              ['➕', 'অন্যান্য আয়', PHS.bdt(f.otherIncome), ''],
              ['📈', 'মোট আয়', PHS.bdt(f.totalIncome), ''],
              ['📉', 'মোট ব্যয়', PHS.bdt(f.totalExpenditure), ''],
              ['🏦', 'বর্তমান স্থিতি', PHS.bdt(f.currentBalance), balCls]
            ].map(function (c) {
              return '<div class="stat ' + c[3] + '"><div class="ic">' + c[0] + '</div>' +
                '<div class="v">' + c[2] + '</div><div class="l">' + c[1] + '</div></div>';
            }).join('');
            sumBox.appendChild(g);
            if (f.totalAdvanceChada > 0) {
              var chandaBreak2 = el('div', 'sum-band');
              chandaBreak2.innerHTML =
                '<span>বর্তমান মাস পর্যন্ত চাঁদা: <b>' + PHS.bdt(f.totalChadaThroughCurrentMonth) + '</b></span>' +
                '<span>অগ্রিম চাঁদা: <b>' + PHS.bdt(f.totalAdvanceChada) + '</b></span>';
              sumBox.appendChild(chandaBreak2);
            }
            finChart(chartBox, months);
          });
      });

      // ---- Expenditure: full detailed list, Category/Date filter (§2/§8) ----
      var expState = { category: '', dateFrom: '', dateTo: '', page: 1, totalPages: 1, items: [] };
      function drawExp(reset) {
        if (reset) { expState.page = 1; expState.items = []; expBox.innerHTML = '<p class="loading">লোড হচ্ছে…</p>'; }
        apiM('getExpenditures', {
          category: expState.category, dateFrom: expState.dateFrom, dateTo: expState.dateTo,
          page: expState.page, pageSize: 10
        }).then(function (r) {
          expState.items = expState.items.concat(r.data.items);
          expState.totalPages = r.data.totalPages;
          renderExp(r.data.totalActiveAmount);
        }).catch(function (e) {
          if (e.handled) return;
          expBox.innerHTML = '';
          expBox.appendChild(el('p', 'load-error', e.message || 'কিছু একটা সমস্যা হয়েছে।'));
        });
      }
      function renderExp(totalActiveAmount) {
        expBox.innerHTML = '';
        var band = el('div', 'sum-band');
        band.innerHTML = '<span>মোট সক্রিয় ব্যয়: <b>' + PHS.bdt(totalActiveAmount) + '</b></span>';
        expBox.appendChild(band);
        if (!expState.items.length) {
          expBox.appendChild(el('p', 'loading', 'কোনো ব্যয়ের তথ্য পাওয়া যায়নি।'));
          return;
        }
        expState.items.forEach(function (x) {
          var row = el('div', 'fin-row');
          row.innerHTML =
            '<div class="fin-top"><span class="fin-purpose">' + PHS.esc(x.purpose) + '</span>' +
            '<span class="fin-amt">' + PHS.esc(PHS.bdt(x.amount)) + '</span></div>' +
            '<div class="fin-meta">' + PHS.esc(PHS.dateLabel(x.date)) +
            (x.category ? ' · ' + PHS.esc(x.category) : '') +
            (x.paymentMethod ? ' · ' + PHS.esc(x.paymentMethod) : '') + '</div>' +
            (x.description ? '<div class="fin-meta">' + PHS.esc(x.description) + '</div>' : '');
          expBox.appendChild(row);
        });
        if (expState.page < expState.totalPages) {
          var more = el('button', 'btn btn-outline load-more', 'আরও দেখুন');
          more.type = 'button';
          more.addEventListener('click', function () { expState.page++; drawExp(false); });
          expBox.appendChild(more);
        }
      }
      $('#fx-cat').addEventListener('input', function () {
        expState.category = this.value.trim();
        clearTimeout(window.__mfct); window.__mfct = setTimeout(function () { drawExp(true); }, 350);
      });
      $('#fx-df').addEventListener('change', function () { expState.dateFrom = this.value; drawExp(true); });
      $('#fx-dt').addEventListener('change', function () { expState.dateTo = this.value; drawExp(true); });
      drawExp(true);

      // ---- Donation: aggregate + recent list (member-donor identity masked
      // server-side — this member never sees who else donated, §8) ----
      var donState = { page: 1, totalPages: 1, items: [] };
      var DONOR_LABEL = { MEMBER: 'সদস্য', NON_MEMBER: 'সদস্য নন', ORGANIZATION: 'প্রতিষ্ঠান', OTHER: 'অন্যান্য' };
      function drawDon(reset) {
        if (reset) { donState.page = 1; donState.items = []; donBox.innerHTML = '<p class="loading">লোড হচ্ছে…</p>'; }
        apiM('getDonations', { page: donState.page, pageSize: 10 }).then(function (r) {
          donState.items = donState.items.concat(r.data.items);
          donState.totalPages = r.data.totalPages;
          renderDon(r.data.totalActiveAmount);
        }).catch(function (e) {
          if (e.handled) return;
          donBox.innerHTML = '';
          donBox.appendChild(el('p', 'load-error', e.message || 'কিছু একটা সমস্যা হয়েছে।'));
        });
      }
      function renderDon(totalActiveAmount) {
        donBox.innerHTML = '';
        var band = el('div', 'sum-band');
        band.innerHTML = '<span>মোট সক্রিয় অনুদান: <b>' + PHS.bdt(totalActiveAmount) + '</b></span>';
        donBox.appendChild(band);
        if (!donState.items.length) {
          donBox.appendChild(el('p', 'loading', 'কোনো অনুদানের তথ্য পাওয়া যায়নি।'));
          return;
        }
        donState.items.forEach(function (d) {
          var lbl = DONOR_LABEL[d.donorType] || d.donorType || '—';
          var row = el('div', 'fin-row is-donation');
          row.innerHTML =
            '<div class="fin-top"><span class="fin-purpose">' + PHS.esc(d.purpose || lbl) + '</span>' +
            '<span class="fin-amt">' + PHS.esc(PHS.bdt(d.amount)) + '</span></div>' +
            '<div class="fin-meta">' + PHS.esc(PHS.dateLabel(d.date)) + ' · ' + PHS.esc(lbl) +
            (d.donorType !== 'MEMBER' && d.donorName ? ' · ' + PHS.esc(d.donorName) : '') + '</div>';
          donBox.appendChild(row);
        });
        if (donState.page < donState.totalPages) {
          var more = el('button', 'btn btn-outline load-more', 'আরও দেখুন');
          more.type = 'button';
          more.addEventListener('click', function () { donState.page++; drawDon(false); });
          donBox.appendChild(more);
        }
      }
      drawDon(true);
    },

    // ---------------- profile (§13, read-only) ----------------
    'm-profile': function () {
      var box = $('#prof');
      loadInto(box, function () {
        return apiM('getMyProfile').then(function (r) {
          var p = r.data;
          box.innerHTML = '';
          var head = el('div', 'member-head');
          head.innerHTML =
            '<div class="avatar" id="avatar">' +
            PHS.esc(initials(p.nameBn || p.nameEn || p.memberCode)) + '</div>' +
            '<div><h1>' + PHS.esc(p.nameBn || p.nameEn || p.memberCode) + '</h1>' +
            '<div class="code">' + badge(p.status) + '</div></div>';
          box.appendChild(head);
          if (p.profilePhotoFileId) {
            var photoUrl2 = PHS.imgUrl(p.profilePhotoFileId, 240);
            if (photoUrl2) {
              var img2 = new Image();
              img2.alt = 'প্রোফাইল ছবি';
              img2.onload = function () {
                var av = $('#avatar');
                if (av) { av.textContent = ''; av.appendChild(img2); av.classList.add('has-photo'); }
              };
              img2.src = photoUrl2;
            }
          }
          var kv = el('div', 'kv mt');
          function row(k, v) {
            return '<div class="row"><div class="k">' + k + '</div><div class="v">' +
              (v || '—') + '</div></div>';
          }
          kv.innerHTML =
            row('সদস্য কোড', PHS.esc(p.memberCode)) +
            row('নাম (বাংলা)', PHS.esc(p.nameBn)) +
            row('নাম (ইংরেজি)', PHS.esc(p.nameEn)) +
            row('ইমেইল', PHS.esc(p.email)) +
            row('মোবাইল', PHS.esc(p.phone)) +
            row('ঠিকানা', PHS.esc(p.address)) +
            row('যোগদানের তারিখ', p.joiningDate ? PHS.esc(PHS.dateLabel(p.joiningDate)) : '') +
            row('যোগদানের মাস', p.joiningMonth ? PHS.esc(PHS.monthLabel(p.joiningMonth)) : '') +
            row('মাসিক চাঁদা', PHS.esc(PHS.bdt(p.monthlyChandaAmount)));
          box.appendChild(kv);
          var note = el('p', 'step-note mt',
            'তথ্য পরিবর্তনের প্রয়োজন হলে অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।');
          box.appendChild(note);
        });
      });
    }
  };

  // ------------------------------------------------------------ boot

  function boot() {
    if (!PHS.hasApi()) {
      document.body.insertBefore(el('div', 'config-banner',
        'কনফিগারেশন বাকি: assets/js/api.js-এ API_URL সেট করুন।'), document.body.firstChild);
      var n = $('#portal-nav .chips');
      if (n) n.innerHTML = '';
      return;
    }
    var s = PHS.getSession();
    var page = document.body.getAttribute('data-page');
    if (!s) { location.replace('login.html'); return; }
    // §Performance: renderShell()/Pages[page]() used to wait on getSettings
    // first, adding one full, purely-cosmetic API round trip to the front
    // of every single page load. getSettings is a public route (no
    // sessionToken) that only supplies the header's organization name —
    // it has no bearing on the page's own data, so it must never block it.
    // Render immediately with the default name and patch it in once the
    // (parallel, non-blocking) settings call resolves.
    renderShell();
    if (Pages[page]) Pages[page]();
    PHS.api('getSettings').then(function (r) {
      if (r.data && (r.data.organizationNameBn || r.data.organizationNameEn)) {
        ORG = r.data.organizationNameBn || r.data.organizationNameEn;
        var nameEl = document.querySelector('#site-header .brand-name > span');
        if (nameEl) nameEl.textContent = ORG;
      }
    }).catch(function () {});
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();