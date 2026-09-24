/* site.js — shared chrome + every public page initializer. All dynamic text
   passes through PHS.esc()/textContent (§79). No content is hard-coded. */
(function () {
  'use strict';
  var BASE = location.pathname.indexOf('/member/') !== -1 ? '../' : '';
  var S = { settings: {}, config: { donationEnabled: false }, homepage: [] };

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  var NAV = [
    ['index.html', 'হোম'], ['about.html', 'আমাদের সম্পর্কে'],
    ['services.html', 'সেবাসমূহ'], ['activities.html', 'কার্যক্রম'],
    ['projects.html', 'প্রকল্প'], ['news.html', 'সংবাদ'],
    ['success-stories.html', 'সাফল্যের গল্প'], ['gallery.html', 'গ্যালারি'],
    ['volunteer.html', 'স্বেচ্ছাসেবক'], ['help.html', 'সহায়তা'],
    ['contact.html', 'যোগাযোগ']
  ];

  function linkHref(l) {
    l = String(l || '').trim();
    if (!l) return '';
    if (/^(https?:)?\/\//i.test(l) || l.charAt(0) === '#') return l;
    return BASE + l.replace(/^\//, '');
  }

  // ------------------------------------------------------------ chrome

  function renderHeader() {
    var org = S.settings.organizationNameBn || S.settings.organizationNameEn || 'পিংনা হিতৈষী সংঘ';
    var host = $('#site-header');
    host.innerHTML =
      '<div class="container header-in">' +
        '<a class="brand" href="' + BASE + 'index.html">' +
          (S.settings.logoFileId ? PHS.imgHtml(S.settings.logoFileId, org, 'brand-logo', 96) : '') +
          '<span class="brand-name"><span>' + PHS.esc(org) + '</span><small>' +
            PHS.esc(S.settings.sloganBn || S.settings.sloganEn || '') + '</small></span></a>' +
        '<button class="nav-toggle" aria-expanded="false" aria-controls="main-nav" aria-label="মেনু">' +
          '<span></span><span></span><span></span></button>' +
        '<nav id="main-nav" class="main-nav" aria-label="প্রধান মেনু"><ul></ul></nav>' +
      '</div>';
    var ul = $('#main-nav ul');
    NAV.forEach(function (n) {
      var href = BASE + n[0];
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = href; a.textContent = n[1];
      var page = location.pathname.split('/').pop() || 'index.html';
      if (page === n[0]) a.setAttribute('aria-current', 'page');
      li.appendChild(a); ul.appendChild(li);
    });
    // Donation nav appears only if the server flag is on (§45/§70).
    if (S.config.donationEnabled) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = BASE + 'donate.html'; a.textContent = 'ডোনেশন';
      li.appendChild(a); ul.appendChild(li);
    }
    var cta = document.createElement('li');
    cta.className = 'nav-cta';
    cta.innerHTML = '<a class="btn nav-login-btn" href="' + BASE + 'member/login.html">' +
      '<span class="ic">👤</span> সদস্য লগইন</a>';
    ul.appendChild(cta);
    var t = $('.nav-toggle', host), nav = $('#main-nav');
    t.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); t.setAttribute('aria-expanded', 'false'); }
    });
  }

  function renderFooter() {
    var st = S.settings;
    var org = st.organizationNameBn || st.organizationNameEn || '';
    var host = $('#site-footer');
    host.className = 'site-footer';
    var contact = [];
    if (st.contactAddress) contact.push('ঠিকানা: ' + st.contactAddress);
    if (st.contactPhone) contact.push('ফোন: ' + st.contactPhone);
    if (st.contactEmail) contact.push('ইমেইল: ' + st.contactEmail);
    var social = [];
    if (st.facebookUrl) social.push(['facebookUrl', st.facebookUrl, 'ফেসবুক']);
    if (st.youtubeUrl) social.push(['youtubeUrl', st.youtubeUrl, 'ইউটিউব']);
    host.innerHTML =
      '<div class="container"><div class="footer-grid">' +
        '<div><h3>' + PHS.esc(org) + '</h3>' +
          '<p class="small">' + PHS.esc(st.sloganBn || st.sloganEn || '') + '</p>' +
          (st.serviceAreaBn || st.serviceAreaEn ?
            '<p class="small">সেবা এলাকা: ' + PHS.esc(st.serviceAreaBn || st.serviceAreaEn) + '</p>' : '') +
        '</div>' +
        '<div><h3>দ্রুত লিংক</h3><ul>' +
          NAV.slice(0, 6).map(function (n) {
            return '<li><a href="' + BASE + n[0] + '">' + PHS.esc(n[1]) + '</a></li>';
          }).join('') +
          '<li><a href="' + BASE + 'member/login.html">সদস্য লগইন</a></li></ul></div>' +
        '<div><h3>যোগাযোগ</h3><ul>' +
          contact.map(function (c) { return '<li class="small">' + PHS.esc(c) + '</li>'; }).join('') +
          social.map(function (s) {
            return '<li><a href="' + PHS.esc(s[1]) + '" rel="noopener">' + PHS.esc(s[2]) + '</a></li>';
          }).join('') +
        '</ul></div>' +
      '</div>' +
      '<div class="footer-bottom">© ' + PHS.bnDigits(new Date().getFullYear()) + ' ' +
        PHS.esc(org) + ' — সর্বস্বত্ব সংরক্ষিত</div></div>';
  }

  function applySeo() {
    if (!PHS_CONFIG.SITE_URL) return;
    var url = PHS_CONFIG.SITE_URL + location.pathname;
    function setLink(rel, href) {
      var l = document.querySelector('link[rel="' + rel + '"]') ||
              document.createElement('link');
      l.rel = rel; l.href = href;
      if (!l.parentNode) document.head.appendChild(l);
    }
    function setMeta(p, c) {
      var m = document.querySelector('meta[property="' + p + '"]') ||
              document.createElement('meta');
      m.setAttribute('property', p); m.content = c;
      if (!m.parentNode) document.head.appendChild(m);
    }
    setLink('canonical', url);
    setMeta('og:url', url);
    setMeta('og:title', document.title);
    var d = document.querySelector('meta[name="description"]');
    if (d) setMeta('og:description', d.content);
    setMeta('og:type', 'website');
    setMeta('og:site_name', S.settings.organizationNameBn ||
            S.settings.organizationNameEn || '');
    if (S.settings.logoFileId) {
      setMeta('og:image', PHS.imgUrl(S.settings.logoFileId, 600));
    }
  }

  function showConfigBanner() {
    if (PHS.hasApi()) return;
    var b = el('div', 'config-banner',
      'সাইট কনফিগারেশন বাকি আছে: assets/js/api.js ফাইলে API_URL সেট করুন।');
    document.body.insertBefore(b, document.body.firstChild);
  }

  // ------------------------------------------------------------ loading UI

  function loadInto(box, fn) {
    box.innerHTML = '<p class="loading">লোড হচ্ছে…</p>';
    function run() {
      fn().catch(function (e) {
        box.innerHTML = '';
        var msg = e.code === 'NETWORK' || e.code === 'CONFIG'
          ? e.message : (e.message || 'কিছু একটা সমস্যা হয়েছে।');
        box.appendChild(el('p', 'load-error', msg));
        var b = el('button', 'btn btn-outline', 'আবার চেষ্টা করুন');
        b.type = 'button';
        b.addEventListener('click', function () { loadInto(box, fn); });
        box.appendChild(b);
      });
    }
    run();
  }

  // ------------------------------------------------------------ card builders

  function btnHtml(href, text, cls) {
    if (!href || !text) return '';
    return '<a class="btn ' + (cls || 'btn-outline') + '" href="' + PHS.esc(linkHref(href)) + '">' +
           PHS.esc(text) + '</a>';
  }

  function serviceCard(it) {
    return '<article class="card card--service">' +
      '<div class="card-body">' +
      '<span class="icon-glyph">' + PHS.esc(it.icon || '🌿') + '</span>' +
      '<h3>' + PHS.esc(it.title) + '</h3>' +
      '<p class="card-text">' + PHS.esc(trunc(it.description, 140)) + '</p>' +
      '<a class="card-link" href="' + PHS.esc(linkHref('projects.html')) + '">সব ক্যাম্পেইন দেখুন</a>' +
      '</div></article>';
  }

  function activityCard(it) {
    var meta = [];
    if (it.category) meta.push('<span class="badge">' + PHS.esc(it.category) + '</span>');
    if (it.date) meta.push(PHS.esc(PHS.dateLabel(it.date)));
    if (it.location) meta.push('📍 ' + PHS.esc(it.location));
    return '<article class="card card--activity">' +
      PHS.imgHtml(it.imageUrl, it.title, 'card-img', 800) +
      '<div class="card-body"><div class="card-meta">' + meta.join('') + '</div>' +
      '<h3>' + PHS.esc(it.title) + '</h3>' +
      '<p class="card-text">' + PHS.esc(trunc(it.shortDescription || it.description, 110)) + '</p>' +
      btnHtml('activity-details.html?' + (it.slug ? 'slug=' + encodeURIComponent(it.slug)
        : 'id=' + encodeURIComponent(it.activityId)), 'বিস্তারিত') +
      '</div></article>';
  }

  function projectCard(it) {
    var pct = 0;
    if (+it.targetAmount > 0) {
      pct = Math.max(0, Math.min(100, Math.round((+it.collectedAmount || 0) / +it.targetAmount * 100)));
    }
    return '<article class="card card--project">' +
      PHS.imgHtml(it.imageUrl, it.title, 'card-img', 800) +
      '<div class="card-body">' +
      (it.category ? '<div class="card-tag">' + PHS.esc(it.category) + '</div>' : '') +
      '<h3>' + PHS.esc(it.title) + '</h3>' +
      '<p class="card-text">' + PHS.esc(trunc(it.description, 100)) + '</p>' +
      (+it.targetAmount > 0 ?
        '<div class="goal-row"><span>লক্ষ্য</span><b>' + pct + '%</b></div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="money-row"><span>সংগৃহীত: <b>' + PHS.bdt(it.collectedAmount || 0) + '</b></span>' +
        '<span>লক্ষ্য: <b>' + PHS.bdt(it.targetAmount) + '</b></span></div>' : '') +
      '<a class="card-link" href="' + PHS.esc(linkHref('project.html?' + (it.slug ? 'slug=' + encodeURIComponent(it.slug)
        : 'id=' + encodeURIComponent(it.projectId)))) + '">বিস্তারিত দেখুন</a>' +
      '</div></article>';
  }

  function newsCard(it) {
    return '<article class="card card--news">' +
      '<div class="card-media">' + PHS.imgHtml(it.imageUrl, it.title, 'card-img', 800) +
      (it.publishedDate ? '<span class="date-badge">' + PHS.esc(PHS.dateLabel(it.publishedDate)) + '</span>' : '') +
      '</div>' +
      '<div class="card-body">' +
      '<h3>' + PHS.esc(it.title) + '</h3>' +
      '<p class="card-text">' + PHS.esc(trunc(it.summary || it.content, 130)) + '</p>' +
      '<a class="card-link" href="' + PHS.esc(linkHref('news-details.html?' + (it.slug ? 'slug=' + encodeURIComponent(it.slug)
        : 'id=' + encodeURIComponent(it.newsId)))) + '">আরও পড়ুন</a>' +
      '</div></article>';
  }

  function storyCard(it) {
    return '<article class="card card--story">' +
      PHS.imgHtml(it.imageUrl, it.title, 'card-img', 800) +
      '<div class="card-body">' +
      '<div class="card-meta">' +
        (it.beneficiaryName ? '👤 ' + PHS.esc(it.beneficiaryName) : '') +
        (it.location ? '📍 ' + PHS.esc(it.location) : '') + '</div>' +
      '<h3>' + PHS.esc(it.title) + '</h3>' +
      '<p class="card-text">' + PHS.esc(trunc(it.story, 120)) + '</p>' +
      btnHtml('success-story.html?' + (it.storyId ? 'id=' + encodeURIComponent(it.storyId) : ''), 'পড়ুন') +
      '</div></article>';
  }

  function trunc(s, n) {
    s = String(s || '').trim();
    return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
  }

  // ------------------------------------------------------------ list helper

  function runList(box, opts) {
    loadInto(box, function () {
      return PHS.api(opts.action, { pageSize: 60 }).then(function (res) {
        var all = res.data.items || [];
        if (!all.length) {
          box.innerHTML = '<p class="loading">এখনো কোনো তথ্য যুক্ত করা হয়নি।</p>';
          return;
        }
        box.innerHTML = '';
        var cats = null;
        if (opts.cats) {
          var set = [];
          all.forEach(function (it) {
            var c = String(it.category || '').trim();
            if (c && set.indexOf(c) < 0) set.push(c);
          });
          if (set.length) {
            cats = { current: 'সব', items: all };
            var chips = el('div', 'chips');
            chips.setAttribute('role', 'group');
            chips.setAttribute('aria-label', 'ক্যাটাগরি অনুযায়ী ফিল্টার');
            function drawChips() {
              chips.innerHTML = '';
              ['সব'].concat(set).forEach(function (c) {
                var b = el('button', 'chip', c);
                b.type = 'button';
                b.setAttribute('aria-pressed', cats.current === c ? 'true' : 'false');
                b.addEventListener('click', function () {
                  cats.current = c; cats.shown = opts.step; drawChips(); drawItems();
                });
                chips.appendChild(b);
              });
            }
            cats.shown = opts.step;
            drawChips();
            box.appendChild(chips);
          }
        }
        var grid = el('div', 'grid grid-3');
        box.appendChild(grid);
        var counter = el('p', 'muted small');
        function drawItems() {
          var list = cats ? cats.items.filter(function (it) {
            return cats.current === 'সব' ||
              String(it.category || '').trim() === cats.current;
          }) : all;
          grid.innerHTML = list.slice(0, cats ? cats.shown : all.length)
            .map(opts.card).join('');
          counter.textContent = 'মোট ' + PHS.bnNumber(list.length) + ' টি';
          var more = box.querySelector('.more-wrap');
          if (more) more.remove();
          if (cats && list.length > cats.shown) {
            var w = el('div', 'more-wrap center mt');
            var b = el('button', 'btn btn-primary', 'আরও দেখুন');
            b.type = 'button';
            b.addEventListener('click', function () {
              cats.shown += opts.step; drawItems();
            });
            w.appendChild(b); box.appendChild(w);
          }
        }
        box.appendChild(counter);
        drawItems();
      });
    });
  }

  // ------------------------------------------------------------ detail helper

  function notFound(box, msg) {
    box.innerHTML = '<div class="notfound"><p class="big" style="font-size:2.4rem">🔍</p>' +
      '<h1>পাওয়া যায়নি</h1><p class="muted">' + PHS.esc(msg) + '</p>' +
      '<a class="btn btn-primary" href="' + BASE + 'index.html">হোমপেজে ফিরুন</a></div>';
  }

  function runDetail(box, action, build) {
    var key = PHS.qs('slug') || PHS.qs('id');
    if (!key) { notFound(box, 'লিংকটি সঠিক নয়।'); return; }
    loadInto(box, function () {
      return PHS.api(action, { idOrSlug: key }).then(function (res) {
        box.innerHTML = '';
        box.appendChild(el('p', 'crumb'));
        box.querySelector('.crumb').innerHTML =
          '<a href="' + BASE + 'index.html">হোম</a> › <a href="javascript:history.back()">পেছনে</a>';
        build(box, res.data);
        if (res.data.title) {
          document.title = res.data.title + ' — ' +
            (S.settings.organizationNameBn || S.settings.organizationNameEn || document.title);
        }
      }).catch(function (e) {
        if (e.code === 'CONTENT_NOT_FOUND') { notFound(box, 'কনটেন্টটি পাওয়া যায়নি বা এখন প্রকাশিত নয়।'); return; }
        throw e;
      });
    });
  }

  function prose(text) {
    return String(text || '').split(/\n{2,}/).map(function (p) {
      p = p.trim(); if (!p) return '';
      return '<p>' + PHS.esc(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  // ------------------------------------------------------------ homepage sections

  function sectionHost(key) { return document.getElementById('section-' + key); }
  function setTitle(host, sec, fallback, eyebrow) {
    if (eyebrow) host.appendChild(el('div', 'eyebrow eyebrow-center', eyebrow));
    host.appendChild(Object.assign(el('h2'), { textContent: sec.title || fallback }));
    if (sec.subtitle) host.appendChild(el('p', 'muted', sec.subtitle));
  }
  function preview(box, action, cardFn, n, more, featured) {
    return PHS.api(action, { pageSize: n }).then(function (res) {
      var items = (res.data.items || []).slice(0, n);
      if (items.length) {
        // "Featured first" — the lead item gets a large side-by-side
        // treatment, the rest sit in the regular grid beneath it. Breaks
        // the monotony of one uniform card grid for every section.
        if (featured && items.length > 1) {
          var lead = el('div', 'featured-item');
          lead.innerHTML = cardFn(items[0]);
          box.appendChild(lead);
          var g2 = el('div', 'grid grid-3 rest-grid');
          g2.innerHTML = items.slice(1).map(cardFn).join('');
          box.appendChild(g2);
        } else {
          var g = el('div', 'grid grid-3');
          g.innerHTML = items.map(cardFn).join('');
          box.appendChild(g);
        }
      }
      if (more) box.appendChild(el('p', 'center mt')).appendChild(
        Object.assign(el('a', 'btn ' + (more.arrow ? 'btn-primary btn-arrow' : 'btn-outline'), more.text),
          { href: linkHref(more.href) }));
    }).catch(function () {
      box.appendChild(el('p', 'muted small', 'এই অংশটি লোড করা যায়নি।'));
    });
  }
  // One shared IntersectionObserver drives every section's entrance — a
  // single orchestrated reveal rather than separate per-card animations.
  var revealIO = null;
  function revealOnScroll(node) {
    if (!node) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    node.classList.add('reveal');
    if (!revealIO && 'IntersectionObserver' in window) {
      revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    }
    if (revealIO) revealIO.observe(node); else node.classList.add('in');
  }

  // Animates a numeral from 0 to its target once it scrolls into view.
  // Only touches plain integers/decimals — text like "৫০+" is left as-is.
  function animateCount(node, raw) {
    var s = String(raw == null ? '' : raw).trim();
    var m = s.match(/^(\d+(?:\.\d+)?)(\D*)$/);
    if (!m || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      node.textContent = PHS.bnNumber(raw); return;
    }
    var target = parseFloat(m[1]), suffix = m[2] || '';
    var isInt = target === Math.round(target);
    function run() {
      var start = null, dur = 900;
      function frame(ts) {
        if (!start) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        var val = target * eased;
        node.textContent = PHS.bnNumber(isInt ? Math.round(val) : val.toFixed(1)) + suffix;
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { run(); io.unobserve(en.target); } });
      }, { threshold: 0.4 });
      io.observe(node);
    } else { run(); }
  }

  function settingsText(keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = String(S.settings[keys[i]] || '').trim();
      if (v) return v;
    }
    return '';
  }
  /** Looks up another configured homepage section's title/buttonLink by key
   *  — used so About can borrow Mission/Vision's own admin-set titles when
   *  it renders them as its side rail (§ layout request), instead of the
   *  full-width sections they'd otherwise render as. */
  function findSection(key) {
    var hit = (S.homepage || []).filter(function (s) { return s.sectionKey === key; })[0];
    return hit || {};
  }

  // §Performance: hero's floating stat card and the impactStats section both
  // need the same getStatistics() data — they used to each fire their own
  // identical request. Memoize per page load so only one round trip happens
  // no matter which (or both) sections are enabled.
  var statsPromise = null;
  function getStatisticsOnce() {
    if (!statsPromise) statsPromise = PHS.api('getStatistics');
    return statsPromise;
  }

  var SECTIONS = {
    hero: function (sec, host) {
      host.hidden = false;
      host.className = 'hero';
      var secondBtn = S.settings.youtubeUrl
        ? '<a class="btn btn-play" href="' + PHS.esc(S.settings.youtubeUrl) + '" target="_blank" rel="noopener">' +
          '<span class="play-dot">▶</span> ভিডিও দেখুন</a>'
        : btnHtml('about.html', 'আমাদের সম্পর্কে জানুন', 'btn-outline');
      host.innerHTML = '<div class="container hero-grid">' +
        '<div><h1>' + PHS.esc(sec.title) + '</h1>' +
        (sec.subtitle ? '<p class="lead">' + PHS.esc(sec.subtitle) + '</p>' : '') +
        (sec.description ? '<p class="lead">' + PHS.esc(sec.description) + '</p>' : '') +
        '<div class="btn-row">' + btnHtml(sec.buttonLink, sec.buttonText, 'btn-primary') +
        secondBtn + '</div></div>' +
        (sec.imageUrl ? '<div class="hero-media">' + PHS.imgHtml(sec.imageUrl, sec.title, 'hero-img', 1200) +
          '<div id="hero-stat-slot"></div></div>' : '') +
        '</div>';
      // Hero renders above the fold immediately — no fade-in delay here,
      // unlike every other section below. The floating stat card is the one
      // piece of real (not decorative) data here, so it loads in separately
      // right after, without holding up the rest of the hero.
      var slot = host.querySelector('#hero-stat-slot');
      if (!slot) return Promise.resolve();
      return getStatisticsOnce().then(function (res) {
        var stats = res.data.stats || [];
        if (!stats.length) return;
        var s0 = stats[0];
        slot.className = 'hero-stat-card';
        slot.innerHTML = '<span class="ic">' + PHS.esc(s0.icon || '📈') + '</span>' +
          '<span><span class="v">' + PHS.esc(PHS.bnNumber(s0.value)) + (s0.unit ? PHS.esc(s0.unit) : '') +
          '</span><br><span class="l">' + PHS.esc(s0.label) + '</span></span>';
      }).catch(function () {});
    },
    about: function (sec, host) {
      var text = settingsText(['aboutBn', 'aboutEn']) || sec.description || sec.subtitle;
      if (!text) return Promise.resolve();
      var missionText = settingsText(['missionBn', 'missionEn']);
      var visionText = settingsText(['visionBn', 'visionEn']);
      var pull = settingsText(['serviceAreaBn', 'serviceAreaEn']);

      // §layout request: Mission + Vision render as a compact side rail next
      // to About (not as their own full-width sections below it) — see the
      // now-inert SECTIONS.mission/vision further down, which used to render
      // them separately and are kept only so an admin toggling them off in
      // the Homepage editor still works as expected.
      var rail = '';
      if (missionText || visionText) {
        var mSec = findSection('mission'), vSec = findSection('vision');
        if (missionText) {
          rail += '<div class="mv-card"><h3>' + PHS.esc(mSec.title || 'আমাদের মিশন') + '</h3>' +
            '<p>' + PHS.esc(trunc(missionText, 90)) + '</p>' +
            '<a class="card-link" href="' + PHS.esc(linkHref('mission.html')) + '">বিস্তারিত</a></div>';
        }
        if (visionText) {
          rail += '<div class="mv-card mv-card-alt"><h3>' + PHS.esc(vSec.title || 'আমাদের ভিশন') + '</h3>' +
            '<p>' + PHS.esc(trunc(visionText, 90)) + '</p>' +
            '<a class="card-link" href="' + PHS.esc(linkHref('vision.html')) + '">বিস্তারিত</a></div>';
        }
      }

      var media = '';
      if (!rail && sec.imageUrl) {
        media = S.settings.youtubeUrl
          ? '<a class="video-thumb" href="' + PHS.esc(S.settings.youtubeUrl) + '" target="_blank" rel="noopener" aria-label="ভিডিও দেখুন">' +
            PHS.imgHtml(sec.imageUrl, sec.title, '', 900) +
            '<span class="play-ic"><span>▶</span></span></a>'
          : PHS.imgHtml(sec.imageUrl, sec.title, 'video-thumb', 900);
      }
      host.hidden = false; host.className = 'section';
      host.innerHTML = '<div class="container split">' +
        '<div><div class="eyebrow">আমাদের সম্পর্কে জানুন</div><h2>' + PHS.esc(sec.title) + '</h2>' +
        '<p class="prose">' + PHS.esc(text) + '</p>' +
        btnHtml(sec.buttonLink || 'about.html', sec.buttonText || 'আরও জানুন') + '</div>' +
        (rail ? '<div class="mv-rail">' + rail + '</div>' :
          (media ? '<div>' + media + '</div>' :
            (pull ? '<div class="pull"><b>সেবা এলাকা</b><p class="muted" style="margin-top:.5rem">' +
              PHS.esc(pull) + '</p></div>' : ''))) +
        '</div>';
      revealOnScroll(host.firstChild);
      return Promise.resolve();
    },
    // Merged into About's side rail above — kept as no-ops (rather than
    // deleted) so an admin who disables/reorders these in the Homepage
    // editor still gets a predictable "hidden" result instead of an error.
    mission: function (sec, host) { host.hidden = true; return Promise.resolve(); },
    vision: function (sec, host) { host.hidden = true; return Promise.resolve(); },
    services: function (sec, host) {
      host.hidden = false; host.className = 'section';
      host.innerHTML = '<div class="container"></div>';
      var c = host.firstChild;
      var head = el('div', 'section-head center'); c.appendChild(head);
      setTitle(head, sec, 'আমাদের সেবাসমূহ', 'ডোনেশন');
      revealOnScroll(c);
      return preview(c, 'getServices', serviceCard, 6,
        { href: 'services.html', text: sec.buttonText || 'সব সেবা দেখুন', arrow: true });
    },
    activities: function (sec, host) {
      host.hidden = false; host.className = 'section';
      host.innerHTML = '<div class="container"></div>';
      var c = host.firstChild;
      var head = el('div', 'section-head'); c.appendChild(head);
      setTitle(head, sec, 'কার্যক্রম');
      revealOnScroll(c);
      return preview(c, 'getActivities', activityCard, 6,
        { href: 'activities.html', text: sec.buttonText || 'সব কার্যক্রম' });
    },
    featuredProjects: function (sec, host) {
      host.hidden = false; host.className = 'section';
      host.innerHTML = '<div class="container"></div>';
      var c = host.firstChild;
      var head = el('div', 'section-head center'); c.appendChild(head);
      setTitle(head, sec, 'প্রকল্পসমূহ', 'ক্যাম্পেইন');
      revealOnScroll(c);
      return preview(c, 'getProjects', projectCard, 3,
        { href: 'projects.html', text: 'সব প্রকল্প', arrow: true });
    },
    impactStats: function (sec, host) {
      host.hidden = false; host.className = 'section';
      host.innerHTML = '<div class="container"></div>';
      var c = host.firstChild;
      var head = el('div', 'section-head center'); c.appendChild(head);
      setTitle(head, sec, 'আমাদের অর্জন');
      revealOnScroll(c);
      return getStatisticsOnce().then(function (res) {
        var stats = res.data.stats || [];
        if (!stats.length) return;
        var band = el('div', 'stat-band');
        var g = el('div', 'stat-grid');
        g.innerHTML = stats.map(function (s, i) {
          return '<div class="stat"><div class="ic">' + PHS.esc(s.icon || '📈') + '</div>' +
            '<div class="v" data-count="' + i + '">…</div>' +
            (s.unit ? '<div class="l">' + PHS.esc(s.unit) + '</div>' : '') +
            '<div class="l">' + PHS.esc(s.label) + '</div></div>';
        }).join('');
        band.appendChild(g);
        c.appendChild(band);
        Array.prototype.forEach.call(g.querySelectorAll('[data-count]'), function (node) {
          var idx = +node.getAttribute('data-count');
          animateCount(node, stats[idx].value);
        });
      }).catch(function () {
        c.appendChild(el('p', 'muted small', 'এই অংশটি লোড করা যায়নি।'));
      });
    },
    news: function (sec, host) {
      host.hidden = false; host.className = 'section';
      host.innerHTML = '<div class="container"></div>';
      var c = host.firstChild;
      var head = el('div', 'section-head center'); c.appendChild(head);
      setTitle(head, sec, 'সংবাদ ও আপডেট', 'ব্লগ থেকে');
      revealOnScroll(c);
      return preview(c, 'getNews', newsCard, 3,
        { href: 'news.html', text: sec.buttonText || 'সব সংবাদ', arrow: true });
    },
    successStories: function (sec, host) {
      host.hidden = false; host.className = 'section';
      host.innerHTML = '<div class="container"></div>';
      var c = host.firstChild;
      var head = el('div', 'section-head'); c.appendChild(head);
      setTitle(head, sec, 'সাফল্যের গল্প');
      revealOnScroll(c);
      return preview(c, 'getSuccessStories', storyCard, 3,
        { href: 'success-stories.html', text: 'সব গল্প' });
    },
    gallery: function (sec, host) {
      host.hidden = false; host.className = 'section section-alt';
      host.innerHTML = '<div class="container"></div>';
      var c = host.firstChild;
      var head = el('div', 'section-head'); c.appendChild(head);
      setTitle(head, sec, 'গ্যালারি');
      revealOnScroll(c);
      return PHS.api('getGallery', { pageSize: 8 }).then(function (res) {
        var items = res.data.items || [];
        if (!items.length) return;
        var g = el('div', 'gal-grid');
        g.innerHTML = items.map(function (it) {
          return '<a class="gal-item" href="' + BASE + 'gallery.html" tabindex="-1" aria-hidden="true">' +
            PHS.imgHtml(it.imageUrl, it.title, '', 480) +
            (it.title ? '<span class="gal-cap">' + PHS.esc(it.title) + '</span>' : '') + '</a>';
        }).join('');
        c.appendChild(g);
        c.appendChild(el('p', 'center mt')).appendChild(
          Object.assign(el('a', 'btn btn-outline', 'পুরো গ্যালারি'),
            { href: BASE + 'gallery.html' }));
      }).catch(function () {
        c.appendChild(el('p', 'muted small', 'এই অংশটি লোড করা যায়নি।'));
      });
    },
    volunteerCta: function (sec, host) {
      host.hidden = false; host.className = 'section';
      host.innerHTML = '<div class="container"><div class="cta">' +
        '<h2>' + PHS.esc(sec.title) + '</h2>' +
        (sec.subtitle ? '<p style="color:rgba(255,255,255,.85)">' + PHS.esc(sec.subtitle) + '</p>' : '') +
        (sec.description ? '<p style="color:rgba(255,255,255,.85)">' + PHS.esc(sec.description) + '</p>' : '') +
        btnHtml(sec.buttonLink || 'volunteer.html', sec.buttonText || 'আবেদন করুন', 'btn-marigold') +
        '</div></div>';
      revealOnScroll(host.firstChild);
      return Promise.resolve();
    },
    helpCta: function (sec, host) {
      host.hidden = false; host.className = 'section section-alt';
      host.innerHTML = '<div class="container"><div class="cta cta-light">' +
        '<h2>' + PHS.esc(sec.title) + '</h2>' +
        (sec.subtitle ? '<p class="muted">' + PHS.esc(sec.subtitle) + '</p>' : '') +
        (sec.description ? '<p>' + PHS.esc(sec.description) + '</p>' : '') +
        btnHtml(sec.buttonLink || 'help.html', sec.buttonText || 'আবেদন করুন', 'btn-primary') +
        '</div></div>';
      revealOnScroll(host.firstChild);
      return Promise.resolve();
    },
    contact: function (sec, host) {
      host.hidden = false; host.className = 'section';
      var st = S.settings;
      var lines = [];
      if (st.contactAddress) lines.push('ঠিকানা: ' + st.contactAddress);
      if (st.contactPhone) lines.push('ফোন: ' + st.contactPhone);
      if (st.contactEmail) lines.push('ইমেইল: ' + st.contactEmail);
      if (!lines.length && !sec.description) return Promise.resolve();
      host.innerHTML = '<div class="container center"><h2>' + PHS.esc(sec.title) + '</h2>' +
        (sec.description ? '<p class="muted">' + PHS.esc(sec.description) + '</p>' : '') +
        lines.map(function (l) { return '<p>' + PHS.esc(l) + '</p>'; }).join('') +
        btnHtml('contact.html', 'যোগাযোগ করুন', 'btn-primary') + '</div>';
      revealOnScroll(host.firstChild);
      return Promise.resolve();
    }
  };

  // ------------------------------------------------------------ pages

  var Pages = {

    home: function () {
      var hosts = {};
      ['hero', 'about', 'mission', 'vision', 'services', 'activities',
       'featuredProjects', 'impactStats', 'news', 'successStories', 'gallery',
       'volunteerCta', 'helpCta', 'contact'].forEach(function (k) {
        var h = sectionHost(k); if (h) { h.hidden = true; hosts[k] = h; }
      });
      // §Performance: each section fetches its own data into its own host
      // element (hosts are fixed-position, pre-existing slots in the static
      // markup — nothing here depends on render ORDER, only on the section
      // being present in S.homepage). They used to be chained one after
      // another (chain.then(...)), so one slow section held up every
      // section below it. Fire them all concurrently instead — a section
      // simply reveals itself whenever its own data arrives.
      (S.homepage || []).forEach(function (sec) {
        var fn = SECTIONS[sec.sectionKey];
        if (!fn || !hosts[sec.sectionKey]) return;
        fn(sec, hosts[sec.sectionKey]);
      });
    },

    about: function () {
      var box = $('#about-body');
      loadInto(box, function () {
        // §Performance: boot() already fetched getSettings into S.settings
        // before this page function runs — re-fetching it here was a
        // duplicate call to the same API. Only getCommittee is new data.
        return PHS.api('getCommittee')
          .then(function (r) {
            var st = S.settings, team = r.data.members || [];
            box.innerHTML = '';
            var org = st.organizationNameBn || st.organizationNameEn || '';
            var html = '<h2>' + PHS.esc(org) + '</h2>' +
              (st.sloganBn || st.sloganEn ? '<p class="muted">' + PHS.esc(st.sloganBn || st.sloganEn) + '</p>' : '') +
              (st.aboutBn || st.aboutEn ? '<div class="prose">' + prose(st.aboutBn || st.aboutEn) + '</div>' : '') +
              (st.organizationType ? '<p><b>ধরন:</b> ' + PHS.esc(st.organizationType) + '</p>' : '') +
              (st.serviceAreaBn || st.serviceAreaEn ?
                '<p><b>সেবা এলাকা:</b> ' + PHS.esc(st.serviceAreaBn || st.serviceAreaEn) + '</p>' : '') +
              (st.missionBn || st.missionEn ? '<h3>মিশন</h3><div class="prose">' + prose(st.missionBn || st.missionEn) + '</div>' : '') +
              (st.visionBn || st.visionEn ? '<h3>ভিশন</h3><div class="prose">' + prose(st.visionBn || st.visionEn) + '</div>' : '');
            var contactBits = [];
            if (st.contactAddress) contactBits.push(st.contactAddress);
            if (st.contactPhone) contactBits.push(st.contactPhone);
            if (st.contactEmail) contactBits.push(st.contactEmail);
            if (contactBits.length) {
              html += '<h3>যোগাযোগ</h3><ul>' + contactBits.map(function (c) {
                return '<li>' + PHS.esc(c) + '</li>'; }).join('') + '</ul>';
            }
            box.appendChild(el('div', 'prose')).innerHTML = html;
            if (team.length) {
              var t = el('section', 'mt');
              t.appendChild(el('h2', '', 'কমিটি / টিম'));
              var g = el('div', 'grid grid-3');
              g.innerHTML = team.map(function (m) {
                return '<article class="card">' +
                  PHS.imgHtml(m.photo, m.name, 'card-img', 400) +
                  '<div class="card-body"><h3>' + PHS.esc(m.name) + '</h3>' +
                  '<p class="muted small">' + PHS.esc(m.designation || '') + '</p>' +
                  (m.shortBio ? '<p class="card-text">' + PHS.esc(trunc(m.shortBio, 120)) + '</p>' : '') +
                  '</div></article>';
              }).join('');
              t.appendChild(g);
              box.appendChild(t);
            }
          });
      });
    },

    mission: function () {
      var box = $('#mv-body');
      loadInto(box, function () {
        // §Performance: no API call needed at all — S.settings is already
        // loaded by boot(). This used to re-fetch getSettings on its own.
        return Promise.resolve().then(function () {
          var t = S.settings.missionBn || S.settings.missionEn;
          box.innerHTML = t ? '<div class="prose">' + prose(t) + '</div>'
            : '<p class="loading">মিশন এখনো যুক্ত করা হয়নি।</p>';
        });
      });
    },
    vision: function () {
      var box = $('#mv-body');
      loadInto(box, function () {
        return Promise.resolve().then(function () {
          var t = S.settings.visionBn || S.settings.visionEn;
          box.innerHTML = t ? '<div class="prose">' + prose(t) + '</div>'
            : '<p class="loading">ভিশন এখনো যুক্ত করা হয়নি।</p>';
        });
      });
    },

    services: function () {
      runList($('#list'), { action: 'getServices', card: serviceCard, step: 9 });
    },
    activities: function () {
      runList($('#list'), { action: 'getActivities', card: activityCard, step: 9, cats: true });
    },
    projects: function () {
      runList($('#list'), { action: 'getProjects', card: projectCard, step: 9, cats: true });
    },
    news: function () {
      runList($('#list'), { action: 'getNews', card: newsCard, step: 6 });
    },
    stories: function () {
      runList($('#list'), { action: 'getSuccessStories', card: storyCard, step: 6 });
    },
    gallery: function () {
      var box = $('#list');
      loadInto(box, function () {
        return PHS.api('getGallery', { pageSize: 60 }).then(function (res) {
          var all = res.data.items || [];
          if (!all.length) {
            box.innerHTML = '<p class="loading">এখনো কোনো ছবি যুক্ত করা হয়নি।</p>';
            return;
          }
          box.innerHTML = '';
          var set = [];
          all.forEach(function (it) {
            var c = String(it.category || '').trim();
            if (c && set.indexOf(c) < 0) set.push(c);
          });
          var current = 'সব', shown = 12;
          var chips = el('div', 'chips'), grid = el('div', 'gal-grid');
          grid.setAttribute('id', 'gal-grid');
          box.appendChild(chips); box.appendChild(grid);
          function drawChips() {
            chips.innerHTML = '';
            if (!set.length) return;
            ['সব'].concat(set).forEach(function (c) {
              var b = el('button', 'chip', c); b.type = 'button';
              b.setAttribute('aria-pressed', current === c ? 'true' : 'false');
              b.addEventListener('click', function () { current = c; shown = 12; drawChips(); draw(); });
              chips.appendChild(b);
            });
          }
          function draw() {
            var list = all.filter(function (it) {
              return current === 'সব' || String(it.category || '').trim() === current;
            });
            grid.innerHTML = list.slice(0, shown).map(function (it) {
              return '<button type="button" class="gal-item" data-title="' +
                PHS.esc(it.title) + '" data-src="' + PHS.esc(PHS.imgUrl(it.imageUrl, 1600)) + '">' +
                PHS.imgHtml(it.imageUrl, it.title, '', 480) + '</button>';
            }).join('');
            var old = box.querySelector('.more-wrap'); if (old) old.remove();
            if (list.length > shown) {
              var w = el('div', 'more-wrap center mt');
              var b = el('button', 'btn btn-primary', 'আরও দেখুন');
              b.type = 'button';
              b.addEventListener('click', function () { shown += 12; draw(); });
              w.appendChild(b); box.appendChild(w);
            }
          }
          drawChips(); draw();
          // Lightbox (accessible: dialog, Esc, focus return — §89)
          var lb = el('div', 'lightbox');
          lb.hidden = true;
          lb.setAttribute('role', 'dialog');
          lb.setAttribute('aria-modal', 'true');
          lb.setAttribute('aria-label', 'ছবি বড় করে দেখুন');
          lb.innerHTML = '<button type="button" class="lb-close">✕ বন্ধ করুন</button>' +
            '<figure class="lb-figure"><img alt=""><figcaption></figcaption></figure>';
          document.body.appendChild(lb);
          var lastFocus = null;
          function close() {
            lb.hidden = true; lb.querySelector('img').src = '';
            if (lastFocus) lastFocus.focus();
          }
          lb.addEventListener('click', function (e) {
            if (e.target === lb || e.target.classList.contains('lb-close')) close();
          });
          document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !lb.hidden) close();
          });
          grid.addEventListener('click', function (e) {
            var b = e.target.closest('.gal-item');
            if (!b) return;
            lastFocus = b;
            lb.querySelector('img').src = b.getAttribute('data-src') || PHS.PH_SRC;
            lb.querySelector('img').alt = b.getAttribute('data-title') || '';
            lb.querySelector('figcaption').textContent = b.getAttribute('data-title') || '';
            lb.hidden = false;
            lb.querySelector('.lb-close').focus();
          });
        });
      });
    },

    'activity-details': function () {
      runDetail($('#detail'), 'getActivityById', function (box, it) {
        var meta = [];
        if (it.category) meta.push('<span class="badge">' + PHS.esc(it.category) + '</span>');
        if (it.date) meta.push(PHS.esc(PHS.dateLabel(it.date)));
        if (it.location) meta.push('📍 ' + PHS.esc(it.location));
        if (+it.beneficiaryCount > 0) {
          meta.push('সহায়তাপ্রাপ্ত: <b>' + PHS.bnNumber(it.beneficiaryCount) + '</b> জন');
        }
        box.appendChild(el('div')).innerHTML =
          '<h1>' + PHS.esc(it.title) + '</h1>' +
          '<div class="card-meta">' + meta.join('') + '</div>';
        var lay = el('div', 'detail-layout');
        if (it.imageUrl) lay.innerHTML = '<div>' + PHS.imgHtml(it.imageUrl, it.title, 'card-img', 1400) + '</div>';
        var body = el('div', 'prose');
        body.innerHTML = prose(it.description || it.shortDescription);
        lay.appendChild(body);
        box.appendChild(lay);
      });
    },
    'project-details': function () {
      runDetail($('#detail'), 'getProjectById', function (box, it) {
        var money = '';
        if ((+it.targetAmount > 0) || (+it.collectedAmount > 0)) {
          money = '<div class="money-row" style="font-size:1rem">' +
            (+it.targetAmount > 0 ? '<span>লক্ষ্য: <b>' + PHS.bdt(it.targetAmount) + '</b></span>' : '') +
            (+it.collectedAmount > 0 ? '<span>সংগৃহীত: <b>' + PHS.bdt(it.collectedAmount) + '</b></span>' : '') +
            (+it.beneficiaryCount > 0 ? '<span>সহায়তাপ্রাপ্ত: <b>' + PHS.bnNumber(it.beneficiaryCount) + '</b> জন</span>' : '') +
            '</div>';
        }
        box.appendChild(el('div')).innerHTML =
          '<h1>' + PHS.esc(it.title) + '</h1>' +
          '<div class="card-meta">' +
            (it.category ? '<span class="badge">' + PHS.esc(it.category) + '</span>' : '') +
            (it.status ? '<span class="badge badge-neutral">' + PHS.esc(it.status) + '</span>' : '') +
            (it.startDate ? PHS.esc(PHS.dateLabel(it.startDate)) : '') +
            (it.endDate ? '– ' + PHS.esc(PHS.dateLabel(it.endDate)) : '') +
            (it.location ? '📍 ' + PHS.esc(it.location) : '') +
          '</div>' + money;
        var lay = el('div', 'detail-layout');
        if (it.imageUrl) lay.innerHTML = '<div>' + PHS.imgHtml(it.imageUrl, it.title, 'card-img', 1400) + '</div>';
        var body = el('div', 'prose');
        body.innerHTML = prose(it.description);
        lay.appendChild(body);
        box.appendChild(lay);
      });
    },
    'news-details': function () {
      runDetail($('#detail'), 'getNewsById', function (box, it) {
        box.appendChild(el('div')).innerHTML =
          '<h1>' + PHS.esc(it.title) + '</h1>' +
          (it.publishedDate ? '<p class="muted">' + PHS.esc(PHS.dateLabel(it.publishedDate)) + '</p>' : '');
        if (it.imageUrl) {
          box.appendChild(el('div')).innerHTML =
            PHS.imgHtml(it.imageUrl, it.title, 'card-img', 1400);
        }
        if (it.summary) box.appendChild(el('p', 'muted', it.summary));
        var body = el('div', 'prose');
        body.innerHTML = prose(it.content);
        box.appendChild(body);
      });
    },
    'story-details': function () {
      runDetail($('#detail'), 'getSuccessStoryById', function (box, it) {
        box.appendChild(el('div')).innerHTML =
          '<h1>' + PHS.esc(it.title) + '</h1>' +
          '<div class="card-meta">' +
            (it.beneficiaryName ? '👤 ' + PHS.esc(it.beneficiaryName) : '') +
            (it.location ? '📍 ' + PHS.esc(it.location) : '') + '</div>';
        if (it.imageUrl) {
          box.appendChild(el('div')).innerHTML =
            PHS.imgHtml(it.imageUrl, it.title, 'card-img', 1400);
        }
        var body = el('div', 'prose');
        body.innerHTML = prose(it.story);
        box.appendChild(body);
      });
    },

    // ------------------------------------------------------------ forms

    volunteer: function () { bindSimpleForm('volunteer-form', 'submitVolunteerApplication', {
      name: { req: true }, phone: { req: true, phone: true },
      email: { email: true }, address: {}, interest: {}, experience: {},
      availability: {}, message: {}
    }); },

    contact: function () {
      bindSimpleForm('contact-form', 'submitContactMessage', {
        name: { req: true }, phone: { phone: true }, email: { email: true },
        subject: {}, message: { req: true }
      }, function (v) {
        return (!v.phone && !v.email) ? 'phone অথবা email — অন্তত একটি দিন।' : '';
      });
      var box = $('#contact-info'), st = S.settings;
      if (!box) return;
      var rows = [];
      if (st.contactAddress) rows.push(['📍 ঠিকানা', st.contactAddress]);
      if (st.contactPhone) rows.push(['📞 ফোন', st.contactPhone]);
      if (st.contactEmail) rows.push(['✉️ ইমেইল', st.contactEmail]);
      if (st.serviceAreaBn || st.serviceAreaEn) rows.push(['🗺️ সেবা এলাকা', st.serviceAreaBn || st.serviceAreaEn]);
      if (st.facebookUrl) rows.push(['ফেসবুক', st.facebookUrl]);
      if (st.youtubeUrl) rows.push(['ইউটিউব', st.youtubeUrl]);
      box.innerHTML = '<h2>যোগাযোগের তথ্য</h2><ul>' + (rows.length ? rows.map(function (r) {
        var val = /^https?:/.test(r[1])
          ? '<a href="' + PHS.esc(r[1]) + '" rel="noopener">' + PHS.esc(r[1]) + '</a>'
          : PHS.esc(r[1]);
        return '<li><b>' + r[0] + ':</b> ' + val + '</li>';
      }).join('') : '<li class="muted">যোগাযোগের তথ্য এখনো যুক্ত করা হয়নি।</li>') + '</ul>';
    },
	
    help: function () {
      var MAX_MB = 5; // UX convenience only — the server enforces the authoritative limit
      var fileInput = $('#attachment'), fileData = null;
      fileInput.addEventListener('change', function () {
        fileData = null;
        var f = fileInput.files && fileInput.files[0];
        var nameEl = $('#attachment-name');
        if (!f) { nameEl.textContent = ''; return; }
        var okType = /^image\/(jpe?g|png|webp)$/.test(f.type) || f.type === 'application/pdf';
        if (!okType) {
          nameEl.textContent = ''; fileInput.value = '';
          PHS.toast('ফাইলের ধরন অনুমোদিত নয় (JPG/PNG/WebP/PDF)।', 'error');
          return;
        }
        if (f.size > MAX_MB * 1024 * 1024) {
          nameEl.textContent = ''; fileInput.value = '';
          PHS.toast('ফাইলটি ' + PHS.bnNumber(MAX_MB) + ' MB-এর বেশি।', 'error');
          return;
        }
        nameEl.textContent = f.name + ' (' + PHS.bnNumber(Math.ceil(f.size / 1024)) + ' KB)';
      });
      bindSimpleForm('help-form', 'submitHelpRequest', {
        applicantName: { req: true }, phone: { req: true, phone: true },
        village: {}, union: {}, upazila: {}, district: {},
        familyMembers: { num: true }, monthlyIncome: { num: true },
        assistanceType: { req: true }, description: { req: true }
      }, null, function (payload, done) {
        var f = fileInput.files && fileInput.files[0];
        if (!f) { done(); return; }
        var fr = new FileReader();
        fr.onload = function () {
          payload.attachment = {
            fileName: f.name, mimeType: f.type,
            dataBase64: String(fr.result).replace(/^data:[^,]+,/, '')
          };
          done();
        };
        fr.onerror = function () {
          PHS.toast('ফাইলটি পড়া যায়নি। আবার চেষ্টা করুন।', 'error');
        };
        fr.readAsDataURL(f);
      });
    },

    /** §Login change: email + password (was: email + emailed OTP each time).
     *  The old OTP machinery is now only used for the "set/reset password"
     *  sub-flow below (view-reset), which proves mailbox ownership once
     *  before letting the member choose a password — it is never itself a
     *  login. A session only ever comes from memberLogin (existing
     *  password) or resetMemberPassword (freshly-chosen password, only
     *  reachable after the emailed code is verified). */
    login: function () {
      if (PHS.getSession()) { location.replace('dashboard.html'); return; }

      var viewLogin = $('#view-login'), viewReset = $('#view-reset');
      var loginForm = $('#login-form');
      var resetStep1 = $('#reset-step1'), resetStep2 = $('#reset-step2');
      var resetReqForm = $('#reset-request-form'), resetConfirmForm = $('#reset-confirm-form');
      var resetEmail = '';

      function enterSession(r) {
        PHS.setSession({
          token: r.data.sessionToken,
          expiresAt: r.data.expiresAt,
          member: r.data.member
        });
        location.replace('dashboard.html');
      }

      // ---- primary: email + password ----
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var em = $('#login-email'), pw = $('#login-pass');
        var emVal = em.value.trim(), pwVal = pw.value;
        var bad = false;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emVal)) {
          fieldErr(em, 'সঠিক ইমেইল ঠিকানা দিন।'); bad = true;
        } else { fieldErr(em, ''); }
        if (!pwVal) { fieldErr(pw, 'পাসওয়ার্ড দিন।'); bad = true; }
        else { fieldErr(pw, ''); }
        if (bad) return;
        submitGuard(loginForm, function () {
          return PHS.api('memberLogin', { email: emVal, password: pwVal }).then(enterSession);
        });
      });

      // ---- toggle: login <-> set/reset password ----
      $('#go-reset').addEventListener('click', function (e) {
        e.preventDefault();
        viewLogin.hidden = true; viewReset.hidden = false;
        resetStep1.hidden = false; resetStep2.hidden = true;
        var em2 = $('#reset-email');
        em2.value = $('#login-email').value || '';
        em2.focus();
      });
      $('#go-login').addEventListener('click', function (e) {
        e.preventDefault();
        viewReset.hidden = true; viewLogin.hidden = false;
        $('#login-email').focus();
      });

      // ---- set/reset step 1: request a code to the registered email ----
      resetReqForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var em = $('#reset-email');
        var v = em.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
          fieldErr(em, 'সঠিক ইমেইল ঠিকানা দিন।'); return;
        }
        fieldErr(em, '');
        submitGuard(resetReqForm, function () {
          return PHS.api('requestMemberPasswordReset', { email: v }).then(function (r) {
            resetEmail = v.toLowerCase();
            resetStep1.hidden = true; resetStep2.hidden = false;
            $('#reset-email-label').textContent = resetEmail;
            PHS.toast(r.message || 'কোড পাঠানো হয়েছে (যদি ইমেইলটি নিবন্ধিত সক্রিয় সদস্যের হয়)।');
            $('#reset-code').focus();
          });
        });
      });
      $('#reset-resend').addEventListener('click', function (e) {
        e.preventDefault();
        submitGuard(resetConfirmForm, function () {
          return PHS.api('requestMemberPasswordReset', { email: resetEmail }).then(function () {
            PHS.toast('নতুন কোড পাঠানো হয়েছে (আগের কোডটি বাতিল)।');
          });
        });
      });

      // ---- set/reset step 2: verify code + choose a new password ----
      resetConfirmForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var codeEl = $('#reset-code'), p1 = $('#reset-newpass'), p2 = $('#reset-newpass2');
        var code = codeEl.value.replace(/\D/g, '');
        var pass1 = p1.value, pass2 = p2.value;
        var bad = false;
        if (code.length !== 6) { fieldErr(codeEl, '৬ ডিজিটের কোড দিন।'); bad = true; }
        else { fieldErr(codeEl, ''); }
        if (pass1.length < 10 || !/[A-Za-z]/.test(pass1) || !/[0-9]/.test(pass1)) {
          fieldErr(p1, 'কমপক্ষে ১০ অক্ষর, অক্ষর ও সংখ্যা উভয়ই থাকতে হবে।'); bad = true;
        } else { fieldErr(p1, ''); }
        if (pass2 !== pass1) { fieldErr(p2, 'দুটি পাসওয়ার্ড মিলছে না।'); bad = true; }
        else { fieldErr(p2, ''); }
        if (bad) return;
        submitGuard(resetConfirmForm, function () {
          return PHS.api('resetMemberPassword',
            { email: resetEmail, code: code, newPassword: pass1 }).then(enterSession);
        });
      });
    },

    notfound: function () {}
  };

  // ------------------------------------------------------------ form engine

  function fieldErr(input, msg) {
    var wrap = input.closest('.field');
    var err = wrap ? wrap.querySelector('.err') : null;
    if (err) err.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function clearErrors(form) {
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (i) {
      fieldErr(i, '');
    });
    var a = form.querySelector('.form-alert');
    if (a) { a.hidden = true; a.textContent = ''; }
  }
  var BD_PHONE = /^(?:\+?880|0)1[3-9]\d{8}$/;
  function validate(form, rules, extra) {
    clearErrors(form);
    var values = {}, firstBad = null;
    Object.keys(rules).forEach(function (name) {
      var r = rules[name], input = form.elements[name];
      if (!input) return;
      var v = String(input.value || '').trim();
      var msg = '';
      if (r.req && !v) msg = 'এই ঘরটি পূরণ করুন।';
      else if (r.phone && v) {
        var p = v.replace(/[\s\-()]/g, '');
        if (!BD_PHONE.test(p)) msg = 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন 01712345678)।';
        else {
          if (p.indexOf('+880') === 0) p = '0' + p.slice(4);
          else if (p.indexOf('880') === 0) p = '0' + p.slice(3);
          v = p;
        }
      }
      else if (r.email && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        msg = 'সঠিক ইমেইল ঠিকানা দিন।';
      }
      else if (r.num && v && !/^\d{1,9}$/.test(v)) msg = 'শুধু সংখ্যা দিন।';
      values[name] = v;
      if (msg) { fieldErr(input, msg); if (!firstBad) firstBad = input; }
    });
    if (extra && !firstBad) {
      var em = extra(values);
      if (em) {
        var target = form.elements.email || form.elements.phone || form.elements.message;
        if (target) fieldErr(target, em);
        firstBad = target;
      }
    }
    if (firstBad) { firstBad.focus(); return null; }
    return values;
  }
  function submitGuard(form, fn) {
    var btn = form.querySelector('button[type="submit"]');
    var alertEl = form.querySelector('.form-alert');
    if (alertEl) alertEl.hidden = true;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    var restore = function () { btn.disabled = false; btn.removeAttribute('aria-busy'); };
    fn().then(restore, function (e) {
      restore();
      if (e.code === 'NETWORK' || e.code === 'CONFIG') {
        PHS.toast(e.message, 'error');           // §94: retryable, honest
        return;
      }
      if (alertEl) {
        alertEl.className = 'form-alert form-alert-error';
        alertEl.textContent = e.message || 'জমা দেওয়া যায়নি। আবার চেষ্টা করুন।';
        alertEl.hidden = false;
        alertEl.focus && alertEl.focus();
      } else {
        PHS.toast(e.message || 'জমা দেওয়া যায়নি।', 'error');
      }
    });
  }

  function bindSimpleForm(formId, action, rules, extraCheck, decorate) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var values = validate(form, rules, extraCheck);
      if (!values) return;
      var payload = values;
      var send = function () {
        submitGuard(form, function () {
          return PHS.api(action, payload).then(function (r) {
            var okBox = el('div', 'form-ok');
            okBox.setAttribute('tabindex', '-1');
            okBox.innerHTML = '<div class="big">✅</div><h2>ধন্যবাদ!</h2>' +
              '<p>' + PHS.esc(r.message || 'আপনার তথ্য জমা হয়েছে।') + '</p>' +
              '<a class="btn btn-primary" href="' + BASE + 'index.html">হোমপেজে ফিরুন</a>';
            form.parentNode.replaceChild(okBox, form);
            okBox.focus();
          });
        });
      };
      if (decorate) decorate(payload, send); else send();
    });
  }

  // ------------------------------------------------------------ boot

  function boot() {
    showConfigBanner();
    if (!PHS.hasApi()) {
      renderHeaderStatic(); renderFooterStatic();
      return;
    }
    var page = document.body.getAttribute('data-page');
    // §Performance: getHomepage is only ever read by Pages.home()/SECTIONS.*
    // (confirmed — no other page touches S.homepage), yet it used to be
    // fetched unconditionally on every public page, holding up header/
    // footer rendering behind an entirely unused API round trip on
    // about/mission/vision/projects/etc. Fetch it only where it's used.
    var calls = [PHS.api('getSettings'), PHS.api('getPublicConfig')];
    if (page === 'home') calls.push(PHS.api('getHomepage'));
    Promise.all(calls).then(function (r) {
      S.settings = r[0].data || {};
      S.config = r[1].data || {};
      S.homepage = (page === 'home' && r[2] && r[2].data && r[2].data.sections) || [];
    }).catch(function () {
      S.settings = {}; S.config = { donationEnabled: false }; S.homepage = [];
      PHS.toast('সাইটের কিছু তথ্য লোড করা যায়নি।', 'error');
    }).then(function () {
      renderHeader(); renderFooter(); applySeo();
      if (Pages[page]) Pages[page]();
    });
  }
  function renderHeaderStatic() {
    var host = $('#site-header');
    host.innerHTML = '<div class="container header-in">' +
      '<a class="brand" href="' + BASE + 'index.html"><span class="brand-name">' +
      '<span>পিংনা হিতৈষী সংঘ</span></span></a>' +
      '<nav class="main-nav open" aria-label="প্রধান মেনু"><ul>' +
      NAV.map(function (n) {
        return '<li><a href="' + BASE + n[0] + '">' + n[1] + '</a></li>';
      }).join('') + '</ul></nav></div>';
  }
  function renderFooterStatic() {
    $('#site-footer').className = 'site-footer';
    $('#site-footer').innerHTML = '<div class="container"><div class="footer-bottom">' +
      'কনফিগারেশন সম্পন্ন হলে সম্পূর্ণ তথ্য দেখা যাবে।</div></div>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();