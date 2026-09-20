/* Download source picker for the getting-started page.
   Desktop artifacts ship to two official mirrors in sync, with identical
   filenames: github.com/oh-my-term/release-omtn and gitee.com/oh-my-term/release-omtn.
   Auto mode times both and picks the faster one; a manual pick sticks
   (persisted in localStorage) until the user switches back to Auto. */
(function () {
  'use strict';

  var REPO = 'release-omtn'; // the desktop client channel
  var LS_KEY = 'omt-dl-src';
  var PROBE_TIMEOUT = 2500;
  var API_TIMEOUT = 4000;
  var PLATFORM_KEY = { windows: 'windows-amd64', macos: 'macos-arm64', linux: 'linux-amd64' };

  var SOURCES = {
    github: {
      api: 'https://api.github.com/repos/oh-my-term/' + REPO + '/releases/latest',
      page: 'https://github.com/oh-my-term/' + REPO + '/releases/latest',
      asset: function (tag, name) {
        return 'https://github.com/oh-my-term/' + REPO + '/releases/download/' + tag + '/' + name;
      },
      probe: 'https://github.com/oh-my-term/' + REPO + '/releases/latest/download/SHA256SUMS.txt'
    },
    gitee: {
      api: 'https://gitee.com/api/v5/repos/oh-my-term/' + REPO + '/releases/latest',
      page: 'https://gitee.com/oh-my-term/' + REPO + '/releases/latest',
      asset: function (tag, name) {
        return 'https://gitee.com/oh-my-term/' + REPO + '/releases/download/' + tag + '/' + name;
      },
      probe: 'https://gitee.com/oh-my-term/' + REPO // TTFB signal; refined with the tag below
    }
  };

  var opts = document.getElementById('srcOpts');
  if (!opts) return;
  var hintZh = document.getElementById('srcHintZh');
  var hintEn = document.getElementById('srcHintEn');
  var verEl = document.getElementById('dlVer');

  var mode = 'auto';     // 'auto' | 'github' | 'gitee' (the chosen mode)
  var effective = null;  // what auto picked, null until the probe settles
  var release = null;    // { tag, names: [asset filenames] }
  try {
    var saved = localStorage.getItem(LS_KEY);
    if (saved === 'github' || saved === 'gitee' || saved === 'auto') mode = saved;
  } catch (e) {}

  function fetchJson(url, timeout) {
    if (!window.AbortController) return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, timeout);
    return fetch(url, { signal: ctl.signal, cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).finally(function () { clearTimeout(timer); });
  }

  // Resolve the latest release from whichever API answers first.
  function resolveRelease() {
    function one(id) {
      return fetchJson(SOURCES[id].api, API_TIMEOUT).then(function (d) {
        if (!d || !d.tag_name || !Array.isArray(d.assets) || !d.assets.length) throw new Error('bad payload');
        return { tag: d.tag_name, names: d.assets.map(function (a) { return a.name; }) };
      });
    }
    return new Promise(function (resolve, reject) {
      var pending = 2, settled = false;
      ['github', 'gitee'].forEach(function (id) {
        one(id).then(function (r) {
          if (!settled) { settled = true; resolve(r); }
        }).catch(function () {
          if (--pending === 0 && !settled) reject(new Error('both APIs failed'));
        });
      });
    });
  }

  // Latency probe: resolve time of a no-cors GET (headers received), Infinity on timeout.
  function probeUrl(id) {
    if (id === 'gitee' && release) {
      return SOURCES.gitee.asset(release.tag, 'SHA256SUMS.txt');
    }
    return SOURCES[id].probe;
  }
  function probe(id) {
    var started = Date.now();
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, PROBE_TIMEOUT);
    var reqOpts = { mode: 'no-cors', cache: 'no-store' };
    if (ctl) reqOpts.signal = ctl.signal;
    return fetch(probeUrl(id), reqOpts).then(function () {
      clearTimeout(timer);
      return Date.now() - started;
    }).catch(function () {
      clearTimeout(timer);
      return Infinity;
    });
  }

  function assetName(names, plat) {
    var key = PLATFORM_KEY[plat];
    for (var i = 0; i < names.length; i++) {
      if (names[i].indexOf('omtn-desktop-' + key + '-') === 0) return names[i];
    }
    return null;
  }

  function fmtMs(zh, ms) {
    if (ms === Infinity) return zh ? '超时' : 'timeout';
    if (ms < 1000) return Math.round(ms) + ' ms';
    return (ms / 1000).toFixed(1) + ' s';
  }
  function srcLabel(id) { return id === 'gitee' ? 'Gitee' : 'GitHub'; }
  function hint(zh, en) {
    if (hintZh) hintZh.textContent = zh;
    if (hintEn) hintEn.textContent = en;
  }

  function currentSource() {
    if (mode !== 'auto') return mode;
    return effective || 'github'; // provisional until the probe settles
  }

  function apply() {
    Array.prototype.forEach.call(opts.querySelectorAll('.src-opt'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-src') === mode);
    });
    var src = currentSource();
    Array.prototype.forEach.call(document.querySelectorAll('[data-dl]'), function (a) {
      var name = release ? assetName(release.names, a.getAttribute('data-dl')) : null;
      a.setAttribute('href', name ? SOURCES[src].asset(release.tag, name) : SOURCES[src].page);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-dl-page]'), function (a) {
      a.setAttribute('href', SOURCES[src].page);
    });
    if (release && verEl) {
      verEl.textContent = release.tag;
      verEl.hidden = false;
    }
  }

  function autoPick() {
    hint('正在探测更快的源…', 'probing for the faster mirror…');
    Promise.all([probe('github'), probe('gitee')]).then(function (ms) {
      if (mode !== 'auto') return; // user switched to manual while probing
      if (ms[0] === Infinity && ms[1] === Infinity) {
        effective = null;
        apply();
        hint('两路探测都超时，先用 GitHub，可手动切换', 'both probes timed out; on GitHub for now — switch manually');
        return;
      }
      effective = ms[0] <= ms[1] ? 'github' : 'gitee';
      apply();
      var win = srcLabel(effective), t = fmtMs(true, effective === 'github' ? ms[0] : ms[1]);
      var other = fmtMs(true, effective === 'github' ? ms[1] : ms[0]);
      hint('已自动选择 ' + win + '（' + t + '，另一路 ' + other + '）',
           'auto: ' + (effective === 'gitee' ? 'Gitee mirror' : 'GitHub') + ' (' + fmtMs(false, effective === 'github' ? ms[0] : ms[1]) + ' vs ' + fmtMs(false, effective === 'github' ? ms[1] : ms[0]) + ')');
    });
  }

  opts.addEventListener('click', function (ev) {
    var b = ev.target.closest('.src-opt');
    if (!b) return;
    mode = b.getAttribute('data-src');
    try { localStorage.setItem(LS_KEY, mode); } catch (e) {}
    apply();
    if (mode === 'auto') {
      autoPick();
    } else if (mode === 'gitee') {
      hint('已固定使用 Gitee 镜像', 'pinned to the Gitee mirror');
    } else {
      hint('已固定使用 GitHub', 'pinned to GitHub');
    }
  });

  apply();
  resolveRelease().then(function (r) {
    release = r;
    apply();
  }).catch(function () { /* keep the release-page fallback links */ });
  if (mode === 'auto') {
    autoPick();
  } else if (mode === 'gitee') {
    hint('已固定使用 Gitee 镜像', 'pinned to the Gitee mirror');
  } else {
    hint('已固定使用 GitHub', 'pinned to GitHub');
  }
})();

/* Platform tabs: auto-select the tab matching the visitor's OS (and arch when
   the UA reveals it), with a note when no build exists for the detected arch. */
(function () {
  'use strict';

  var tabs = document.getElementById('dlTabs');
  if (!tabs) return;
  var detectZh = document.getElementById('dlDetectZh');
  var detectEn = document.getElementById('dlDetectEn');
  var OS_LABEL = { windows: 'Windows', macos: 'macOS', linux: 'Linux', android: 'Android', ios: 'iOS' };
  // the release repo ships amd64 for windows/linux and arm64 for macOS today
  function hasBuild(os, arch) {
    if (!arch) return true;
    if (os === 'macos') return arch === 'arm64';
    return arch === 'x86_64';
  }

  function select(name) {
    Array.prototype.forEach.call(tabs.querySelectorAll('.dl-tab'), function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.dl-pane'), function (p) {
      p.hidden = p.getAttribute('data-pane') !== name;
    });
  }

  tabs.addEventListener('click', function (ev) {
    var b = ev.target.closest('.dl-tab');
    if (b) select(b.getAttribute('data-tab'));
  });

  function showDetect(os, arch) {
    if (!os || (!detectZh && !detectEn)) return;
    var label = OS_LABEL[os] || os;
    var archLabel = arch ? ' · ' + arch : '';
    var warn = hasBuild(os, arch) ? '' : '；暂无该架构构建，可到「全部版本」查看';
    if (detectZh) detectZh.textContent = '已识别当前环境：' + label + archLabel + warn;
    if (detectEn) detectEn.textContent = 'Detected environment: ' + label + archLabel + (hasBuild(os, arch) ? '' : '; no build for this arch yet — see "All releases"');
    var line = document.getElementById('dlDetect');
    if (line) line.hidden = false;
  }

  var ua = navigator.userAgent || '';
  var os = null;
  if (/Android/i.test(ua)) os = 'android';
  else if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) os = 'ios';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macos';
  else if (/Windows/i.test(ua)) os = 'windows';
  else if (/Linux|X11/i.test(ua)) os = 'linux';

  var arch = null;
  if (/arm64|aarch64/i.test(ua)) arch = 'arm64';
  else if (/x86_64|amd64|WOW64|Win64/i.test(ua)) arch = 'x86_64';

  select(os || 'windows');
  showDetect(os, arch);

  // macOS UA strings are frozen at "Intel" even on Apple Silicon; UA-CH
  // (Chromium) is the only reliable signal, so refine asynchronously.
  if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    navigator.userAgentData.getHighEntropyValues(['architecture', 'platform']).then(function (d) {
      if (!d || !d.architecture) return;
      var a = d.architecture === 'arm' ? 'arm64' : (d.architecture === 'x86' ? 'x86_64' : d.architecture);
      var p = (d.platform || '').toLowerCase();
      var o = p.indexOf('mac') !== -1 ? 'macos' : (p.indexOf('windows') !== -1 ? 'windows' : (p.indexOf('linux') !== -1 ? 'linux' : os));
      if (o) { os = o; select(o); }
      arch = a;
      showDetect(os, arch);
    }).catch(function () {});
  }
})();
