/* api.js — public API transport + shared utilities (used by site.js and,
 * later, the member portal). No secrets ever live here (§68/§69). */
var PHS_CONFIG = {
  /* DEPLOYMENT CONFIG (the only values you edit):
     API_URL : your Apps Script Web App /exec URL, e.g.
               'https://script.google.com/macros/s/AKfycb.../exec'
     SITE_URL: optional; public origin for canonical/OG, e.g.
               'https://yourname.github.io/your-repo' (no trailing slash) */
  API_URL: 'https://script.google.com/macros/s/AKfycbw9nC80SxTCe_v6GrgF-GNnIEYbwp9YhqgDxo5AepPE8Qi7sitZdtcSjqYg3WPR0FG6xA/exec',
  SITE_URL: 'http://localhost:8080/'
};

var PHS = (function () {
  'use strict';
  var SESSION_KEY = 'phs_member_session';

  var BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
                   'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

  function bnDigits(v) {
    return String(v).replace(/[0-9]/g, function (d) { return '০১২৩৪৫৬৭৮৯'[+d]; });
  }
  function groupIn(s) {
    if (s.length <= 3) return s;
    var last = s.slice(-3), rest = s.slice(0, -3), g = [];
    while (rest.length > 2) { g.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
    if (rest) g.unshift(rest);
    return g.join(',') + ',' + last;
  }
  function bdt(n) {
    n = Number(n); if (!isFinite(n)) n = 0;
    var neg = n < 0; n = Math.abs(n);
    var f = (Math.floor(n) === n) ? String(n) : n.toFixed(2);
    var p = f.split('.');
    return '৳ ' + (neg ? '-' : '') + bnDigits(groupIn(p[0]) + (p[1] ? '.' + p[1] : ''));
  }
  function bnNumber(n) {
    n = Number(n); if (!isFinite(n)) return bnDigits(String(n));
    var f = (Math.floor(n) === n) ? String(n) : n.toFixed(2);
    var p = f.split('.');
    return bnDigits(groupIn(p[0]) + (p[1] ? '.' + p[1] : ''));
  }
  function monthLabel(period) {
    var m = String(period || '').match(/^(\d{4})-(\d{2})/);
    return m ? (BN_MONTHS[+m[2] - 1] + ' ' + bnDigits(m[1])) : String(period || '');
  }
  function dateLabel(d) {
    var m = String(d || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) { var s = String(d || ''); return s ? monthLabel(s.slice(0, 7)) : ''; }
    return bnDigits(+m[3]) + ' ' + BN_MONTHS[+m[2] - 1] + ' ' + bnDigits(m[1]);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function qs(name) { return new URLSearchParams(location.search).get(name); }

  // ---------- transport ----------
  function hasApi() { return !!PHS_CONFIG.API_URL; }

  function api(action, data) {
    if (!hasApi()) {
      return Promise.reject({ code: 'CONFIG', message: 'সাইট কনফিগারেশন সম্পন্ন হয়নি (API URL সেট করা হয়নি)।' });
    }
    // Simple request: কোনো custom Content-Type হেডার নয় ⇒ CORS preflight হবে না।
    // Flattened payload: {action, ...সব ফিল্ড, sessionToken} — backend যেভাবে পড়ে।
    var payload = Object.assign({ action: action }, data || {});
    return fetch(PHS_CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json();
    }).then(function (out) {
      if (!out || typeof out.success !== 'boolean') {
        throw { code: 'SERVER', message: 'সার্ভার থেকে অপ্রত্যাশিত উত্তর এসেছে।' };
      }
      if (!out.success) {
        throw { code: (out.error && out.error.code) || 'SERVER',
                message: (out.error && out.error.message) || 'কিছু একটা সমস্যা হয়েছে।' };
      }
      return out;
    }).catch(function (e) {
      if (e && e.code) throw e;
      throw { code: 'NETWORK',
              message: 'নেটওয়ার্ক সমস্যা হয়েছে। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।' };
    });
  }

  // ---------- images (§118) ----------
  var PH_SRC = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
    '<rect width="100%" height="100%" fill="#e9f0ea"/>' +
    '<circle cx="320" cy="140" r="42" fill="#bccfc1"/>' +
    '<path d="M230 290c0-42 40-64 90-64s90 22 90 64z" fill="#bccfc1"/></svg>');

  function imgUrl(src, size) {
    src = String(src || '').trim();
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return src;
    if (/^[A-Za-z0-9_-]{10,}$/.test(src)) { // Drive file id → public thumbnail
      return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(src) +
             '&sz=w' + (size || 1200);
    }
    return '';
  }
  /** Escaped <img> with lazy loading + safe placeholder fallback (§79/§118). */
  function imgHtml(src, alt, cls, size) {
    var u = imgUrl(src, size);
    if (!u) {
      return '<img src="' + PH_SRC + '" alt="" class="' + esc(cls || '') +
             ' ph" loading="lazy" decoding="async">';
    }
    return '<img src="' + esc(u) + '" alt="' + esc(alt || '') + '" class="' + esc(cls || '') +
           '" loading="lazy" decoding="async" ' +
           'onerror="this.onerror=null;this.src=PHS.PH_SRC">';
  }

  // ---------- toast (accessible, §89) ----------
  function toast(msg, type) {
    var root = document.getElementById('phs-toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'phs-toast-root';
      root.setAttribute('aria-live', 'polite');
      document.body.appendChild(root);
    }
    var t = document.createElement('div');
    t.className = 'toast ' + (type === 'error' ? 'toast-error' : 'toast-ok');
    t.setAttribute('role', 'status');
    t.textContent = String(msg || '');
    root.appendChild(t);
    setTimeout(function () {
      t.classList.add('toast-out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
    }, 4200);
  }

  // ---------- member session (shared with Part 6 portal) ----------
  function getSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (s && s.token && Date.parse(s.expiresAt) > Date.now()) return s;
      if (s) localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    return null;
  }
  function setSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s || {})); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  return {
    BN_MONTHS: BN_MONTHS, PH_SRC: PH_SRC,
    bnDigits: bnDigits, bnNumber: bnNumber, bdt: bdt,
    monthLabel: monthLabel, dateLabel: dateLabel,
    esc: esc, qs: qs, hasApi: hasApi, api: api,
    imgUrl: imgUrl, imgHtml: imgHtml, toast: toast,
    getSession: getSession, setSession: setSession, clearSession: clearSession
  };
})();