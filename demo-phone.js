/* oh-my-term landing — phone demo logic (runs inside demo-phone.html iframe)
   Hosts the real Soft Keyboard v3 against a demo terminal line:
   - memory storage shim (installed in demo-phone.html <head>, before kb.js)
   - minimal i18n bridge so the component never shows raw key names
   - pointer→touch shim so desktop mice can drive the touch-bound keys
   - typing animation hands the buffer to the keyboard on first keypress */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lang = 'zh';
  try {
    var pl = window.parent.document.documentElement;
    if (pl.classList.contains('lang-en')) lang = 'en';
  } catch (e) {}
  var phoneLine = document.getElementById('phoneType');
  var phoneTerm = document.querySelector('.phone-term');
  var sent = [];
  var currentSess = 'claude [build-server-01]';

  /* ---------- i18n bridge (softkey/snippets/sym keys from omta) ---------- */
  var dict = window.OMT_KB_I18N || {};
  function t(key, vars) {
    var entry = dict[key];
    var s = entry ? (entry[lang] != null ? entry[lang] : entry.en) : key;
    if (vars) for (var k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }
  function tHtml(key, vars) {
    var d = document.createElement('div');
    d.textContent = t(key, vars);
    return d.innerHTML;
  }
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    if (window.__omtKb) {
      try {
        window.__omtKb.renderQwerty();
        window.__omtKb.renderSymTabs();
        window.__omtKb.renderSymGrid();
      } catch (e) {}
    }
  }
  globalThis.__omtI18n = {
    omtModuleT: function (_host, key, vars) { return t(key, vars); },
    omtModuleTHtml: function (_host, key, vars) { return tHtml(key, vars); }
  };
  window.__setLang = function (next) {
    lang = next;
    document.documentElement.lang = next;
    document.documentElement.classList.toggle('lang-zh', next === 'zh');
    document.documentElement.classList.toggle('lang-en', next === 'en');
    applyI18n();
  };

  /* ---------- demo terminal line ---------- */
  function renderLine() { if (phoneLine) phoneLine.textContent = phoneLine._buf || ''; }

  function pushToolLine(html) {
    if (!phoneTerm) return;
    var tui = phoneTerm.querySelector('.tui');
    var status = tui.querySelector('.tui-status');
    var div = document.createElement('div');
    div.className = 'tool';
    div.innerHTML = html;
    tui.insertBefore(div, status);
    while (tui.querySelectorAll('.tool, .tool-out').length > 7) {
      var first = tui.querySelector('.tool, .tool-out');
      if (!first || first === status) break;
      first.remove();
    }
  }

  function kbSend(seq) {
    if (!phoneLine) return;
    /* first keypress takes the buffer over from the typing animation */
    if (phoneLine._buf === undefined) {
      phoneLine._cancelled = true;
      phoneLine._buf = phoneLine.textContent;
    }
    if (seq === '\r' || seq === '\n') {
      var text = (phoneLine._buf || '').trim();
      phoneLine._buf = '';
      renderLine();
      if (text) {
        pushToolLine('<span class="t-cyan">⏺</span> <span class="t-dim">' + text.replace(/</g, '&lt;') + '</span>');
        pushToolLine('<span class="t-faint">&nbsp;⎿ </span><span class="t-green">✓ <span class="l-zh">已送达 ' + currentSess + '</span><span class="l-en">sent to ' + currentSess + '</span></span>');
      }
      return;
    }
    if (seq === '\x7f') { phoneLine._buf = (phoneLine._buf || '').slice(0, -1); renderLine(); return; }
    if (seq === '\x1b') { phoneLine._buf = ''; renderLine(); return; }
    if (seq === '\x03') { /* Ctrl+C: show the caret notation, like a real TUI */
      phoneLine._buf = '';
      renderLine();
      pushToolLine('<span class="t-faint">^C</span>');
      return;
    }
    if (seq.length > 0 && seq.charCodeAt(0) >= 32) {
      phoneLine._buf = (phoneLine._buf || '') + seq;
      renderLine();
    }
    /* arrows, tab and other control sequences: visual no-op in the demo */
  }

  /* ---------- typing animation ---------- */
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

  /* ---------- host contract ---------- */
  var host = {
    isMobile: function () { return true; },
    canSend: function () { return true; },
    send: function (seq) { sent.push(seq); kbSend(seq); },
    requestFit: function () {},
    syncGeometry: function () {},
    inputSuppressed: function () { return false; },
    forEachTextarea: function () {},
    focusTerminal: function () {},
    t: t,
    tHtml: tHtml
  };

  /* Host-side data-act delegation for the static DOM keys — mirrors the
     reference implementation in the kb-harness page. */
  function installKbActs(kb) {
    var ACTS = {
      click: {
        'soft-key': function (el) { kb.sendSoftKey(el.getAttribute('data-arg-key')); },
        'toggle-modifier': function (el) { kb.toggleModifier(el.getAttribute('data-arg-mod')); },
        'toggle-snippet-panel': function () { kb.toggleSnippetPanel(); },
        'expand-soft-keyboard': function () { kb.toggleSoftKeyboard(); },
        'collapse-soft-keyboard': function () { kb.collapseSoftKeyboard(); },
        'toggle-settings-panel': function () { kb.toggleSettingsPanel(); },
        'toggle-symbol-layer': function () { kb.toggleSymbolLayer(); },
        'set-lp-delay': function (el) { kb.setLpDelay(Number(el.getAttribute('data-arg-ms'))); },
        'set-scrub-speed': function (el) { kb.setScrubGain(Number(el.getAttribute('data-arg-scale'))); },
        'set-scrub-slop': function (el) { kb.setSlopGain(Number(el.getAttribute('data-arg-gain'))); },
        'start-add-snippet': function () { kb.startAddSnippet(); },
        'toggle-sort-mode': function () { kb.toggleSortMode(); },
        'insert-snippet-char': function (el) { kb.insertSnippetChar({ nl: '\n', tab: '\t', esc: '\x1b' }[el.getAttribute('data-arg-char')]); },
        'save-snippet': function () { kb.saveSnippet(); },
        'cancel-snippet-form': function () { kb.cancelSnippetForm(); },
        'snippet-send': function (el) { kb.sendSnippet(Number(el.getAttribute('data-arg-id'))); },
        'snippet-pin': function (el) { kb.pinSnippet(Number(el.getAttribute('data-arg-id'))); },
        'snippet-edit': function (el) { kb.startEditSnippet(Number(el.getAttribute('data-arg-id'))); },
        'snippet-delete': function (el) { kb.deleteSnippet(Number(el.getAttribute('data-arg-id'))); }
      },
      change: {
        'set-flick-gesture': function (el) { kb.setFlickGesture(el.checked); },
        'set-haptic': function (el) { kb.setHaptic(el.checked); }
      },
      contextmenu: {
        'snippet-handle': function (el, ev) { ev.preventDefault(); ev.stopPropagation(); }
      }
    };
    var dispatch = function (ev) {
      var target = ev.target;
      if (!target || typeof target.closest !== 'function') return;
      var el = target.closest('[data-act]');
      if (!el) return;
      var table = ACTS[ev.type];
      var act = el.getAttribute('data-act');
      var handler = table && Object.prototype.hasOwnProperty.call(table, act) ? table[act] : null;
      if (handler) handler(el, ev);
    };
    document.addEventListener('click', dispatch);
    document.addEventListener('change', dispatch);
    document.addEventListener('contextmenu', dispatch);
  }

  /* Desktop visitors drive a touch-bound component with a mouse: synthesize
     TouchEvents from pointer events for keys bound via the touch path.
     - pointer capture on the keyboard root so releases outside still arrive
     - pointercancel maps to touchcancel (component clears holds on cancel)
     - only the browser's own trusted compat-click is suppressed afterwards;
       the component's internal btn.click() commits (isTrusted=false) pass */
  function installTouchShim(root) {
    var active = null, lastSynth = 0;
    function mkTouch(e, target) {
      return new Touch({
        identifier: 7, target: target,
        clientX: e.clientX, clientY: e.clientY,
        pageX: e.pageX, pageY: e.pageY,
        screenX: e.screenX, screenY: e.screenY,
        radiusX: 2, radiusY: 2, rotationAngle: 0, force: 1
      });
    }
    function dispatch(type, e, target, touches) {
      var tc = mkTouch(e, target);
      target.dispatchEvent(new TouchEvent(type, {
        touches: touches, targetTouches: touches, changedTouches: [tc],
        bubbles: true, cancelable: true, composed: true
      }));
    }
    root.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      var key = e.target.closest('.kb-key, .sym-tab');
      if (!key || !key._kbBound) return;
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
      active = key;
      dispatch('touchstart', e, key, [mkTouch(e, key)]);
      e.preventDefault();
    });
    root.addEventListener('pointermove', function (e) {
      if (!active || e.pointerType !== 'mouse') return;
      dispatch('touchmove', e, active, [mkTouch(e, active)]);
    });
    function finish(e, type) {
      if (!active || e.pointerType !== 'mouse') return;
      dispatch(type, e, active, []);
      active = null;
      lastSynth = Date.now();
    }
    root.addEventListener('pointerup', function (e) { finish(e, 'touchend'); });
    root.addEventListener('pointercancel', function (e) { finish(e, 'touchcancel'); });
    root.addEventListener('click', function (e) {
      if (e.isTrusted && Date.now() - lastSynth < 800 && e.target.closest('.kb-key, .sym-tab')) {
        e.preventDefault(); e.stopPropagation();
      }
    }, true);
  }

  function init() {
    if (!window.SoftKeyboard || !document.getElementById('softKeyboard')) return;
    try {
      var kb = new SoftKeyboard(host);
      kb.setup();
      window.__omtKb = kb;
      installKbActs(kb);
      installTouchShim(document.getElementById('softKeyboard'));
      window.__setLang(lang);
      if (reduceMotion && kb.setFlickGesture) kb.setFlickGesture(false);
      /* lead with the full layout: it is the product's signature view */
      if (!location.hash.includes('collapsed')) kb.toggleSoftKeyboard();
    } catch (err) {
      if (window.console) console.warn('soft keyboard unavailable:', err);
    }
    window.__demo = {
      ready: true,
      kb: window.__omtKb || null,
      sent: sent,
      phoneLine: phoneLine,
      lang: function () { return lang; }
    };
  }

  /* clicking any non-keyboard part of the phone brings it back in front */
  var phoneRoot = document.querySelector('.phone');
  if (phoneRoot) {
    phoneRoot.addEventListener('click', function (e) {
      if (e.target.closest('#softKeyboard')) return;
      try {
        var hv = window.parent.document.querySelector('.hero-visual');
        if (hv) hv.dataset.front = 'phone';
      } catch (err) {}
    });
  }

  /* hamburger: session drawer with Sessions/Devices tabs */
  var burger = document.querySelector('.ph-burger');
  var drawer = document.querySelector('.ph-drawer');
  var phdTabs = Array.prototype.slice.call(document.querySelectorAll('.phd-tab'));
  var phdPanes = Array.prototype.slice.call(document.querySelectorAll('.phd-pane'));
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      drawer.hidden = !drawer.hidden;
      if (!drawer.hidden && typeof closeFiles === 'function') closeFiles();
    });
    phdTabs.forEach(function (tab) {
      tab.addEventListener('click', function (e) {
        e.stopPropagation();
        phdTabs.forEach(function (t2) { t2.classList.toggle('on', t2 === tab); });
        phdPanes.forEach(function (p) {
          p.hidden = p.getAttribute('data-phd-body') !== tab.getAttribute('data-phd');
        });
      });
    });
    var sessRows = Array.prototype.slice.call(drawer.querySelectorAll('.phd-pane[data-phd-body="sessions"] .phd-row'));
    sessRows.forEach(function (row) {
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        var name = row.getAttribute('data-sess');
        if (!name) return;
        currentSess = name;
        sessRows.forEach(function (r2) { r2.classList.toggle('phd-sel', r2 === row); });
        var title = document.querySelector('.ph-title');
        if (title) title.textContent = name;
        drawer.hidden = true; /* picked a session */
      });
    });
  }
  if (location.hash.includes('drawer') && drawer) drawer.hidden = false; /* debug hook */

  /* header ▣ swaps the terminal for a file listing; >_ swaps back */
  var filesBtn = document.getElementById('phFilesBtn');
  var termBtn = document.getElementById('phTermBtn');
  var filesPane = document.querySelector('.ph-files');
  var tuiEl = document.querySelector('.phone-term .tui');
  var closeFiles = function () {
    if (filesPane) filesPane.hidden = true;
    if (termBtn && filesBtn) { termBtn.classList.add('on'); filesBtn.classList.remove('on'); }
    if (tuiEl) tuiEl.style.display = '';
  };
  if (filesBtn && termBtn && filesPane && tuiEl) {
    var setView = function (files) {
      filesBtn.classList.toggle('on', files);
      termBtn.classList.toggle('on', !files);
      filesPane.hidden = !files;
      tuiEl.style.display = files ? 'none' : '';
    };
    filesBtn.addEventListener('click', function () { if (drawer) drawer.hidden = true; setView(true); });
    termBtn.addEventListener('click', function () { setView(false); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      typeInto(phoneLine, 'run the tests and fix what breaks', 62, 1200);
      init();
    });
  } else {
    typeInto(phoneLine, 'run the tests and fix what breaks', 62, 1200);
    init();
  }
})();
