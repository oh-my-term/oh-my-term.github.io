/* oh-my-term landing — page-level interactions
   nav state, scroll reveal, bilingual toggle, hero typing.
   The phone demo (real Soft Keyboard v3) lives in demo-phone.js and runs
   inside the demo-phone.html iframe. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- nav ---------- */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- scroll reveal ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- language toggle ---------- */
  var langToggle = document.getElementById('langToggle');
  if (langToggle) {
    langToggle.addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.classList.contains('lang-zh') ? 'en' : 'zh';
      root.classList.remove('lang-zh', 'lang-en');
      root.classList.add('lang-' + next);
      root.lang = next;
      try { localStorage.setItem('omt-lang', next); } catch (e) {}
      document.title = next === 'zh'
        ? 'oh-my-term — 为 Vibe Coding 而生的终端管理器'
        : 'oh-my-term — The terminal manager built for Vibe Coding';
      var frame = document.querySelector('.phone-frame');
      if (frame && frame.contentWindow && frame.contentWindow.__setLang) {
        try { frame.contentWindow.__setLang(next); } catch (e) {}
      }
    });
  }

  /* ---------- desk: Terminal / Files view switch ---------- */
  var termBtn = document.getElementById('deskViewTerm');
  var filesBtn = document.getElementById('deskViewFiles');
  var filesPane = document.querySelector('.desk-files');
  var deskTui = document.querySelector('.desk-main .tui');
  if (termBtn && filesBtn && filesPane && deskTui) {
    var setView = function (files) {
      termBtn.classList.toggle('primary', !files);
      filesBtn.classList.toggle('primary', files);
      filesPane.hidden = !files;
      deskTui.style.display = files ? 'none' : '';
    };
    termBtn.addEventListener('click', function (ev) { ev.stopPropagation(); setView(false); });
    filesBtn.addEventListener('click', function (ev) { ev.stopPropagation(); setView(true); });
  }

  /* ---------- hero visual: click a device to bring it in front;
     the phone side switches back via demo-phone.js (same-origin) ---------- */
  var heroVisual = document.querySelector('.hero-visual');
  var desk = document.querySelector('.desk');
  if (heroVisual && desk) {
    desk.addEventListener('click', function () { heroVisual.dataset.front = 'desk'; });
  }

  /* ---------- desk sidebar: Sessions / Devices tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.desk-tab[data-pane]'));
  var panes = Array.prototype.slice.call(document.querySelectorAll('.side-pane[data-pane-body]'));
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function (ev) {
      ev.stopPropagation(); /* don't trigger the desk click-to-front */
      tabs.forEach(function (t2) { t2.classList.toggle('on', t2 === tab); });
      panes.forEach(function (p) {
        p.hidden = p.getAttribute('data-pane-body') !== tab.getAttribute('data-pane');
      });
    });
  });

  /* ---------- hero typing ---------- */
  function typeInto(el, text, speed, startDelay) {
    if (!el) return;
    if (reduceMotion) { el.textContent = text; return; }
    var i = 0;
    setTimeout(function step() {
      if (el._cancelled) return;
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, speed + Math.random() * 55);
    }, startDelay);
  }

  var startTyping = function () {
    typeInto(document.getElementById('heroType'), 'refactor the auth module to use middleware', 42, 900);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTyping);
  } else {
    startTyping();
  }
})();
