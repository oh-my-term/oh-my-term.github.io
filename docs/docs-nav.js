/* Shared docs chrome: sidebar TOC (rendered from one chapter list, current
   page highlighted with its sub-sections) + prev/next pager + scrollspy.
   Each chapter page sets <body data-doc="<chapter-id>>. */
(function () {
  'use strict';

  var CHAPTERS = [
    { id: 'overview', file: 'overview.html', zh: '总览', en: 'Overview',
      subs: [
        { id: 'components', zh: '组件模型', en: 'Components' },
        { id: 'security', zh: '安全模型', en: 'Security model' },
        { id: 'versioning', zh: '版本号体系', en: 'Versioning' },
        { id: 'downloads', zh: '下载与校验', en: 'Downloads' }
      ] },
    { id: 'omts', file: 'omts.html', zh: '服务端 omts', en: 'Server · omts',
      subs: [
        { id: 'deploy-single', zh: '单机部署', en: 'Single node' },
        { id: 'deploy-multi', zh: '多节点部署', en: 'Multi node' },
        { id: 'omts-cli', zh: '启动参数', en: 'CLI flags' },
        { id: 'omts-net', zh: '网络要求', en: 'Networking' }
      ] },
    { id: 'omtc', file: 'omtc.html', zh: '设备端 omtc', en: 'Device agent · omtc',
      subs: [
        { id: 'omtc-install', zh: '安装与注册', en: 'Install' },
        { id: 'omtc-cmds', zh: '命令', en: 'Commands' },
        { id: 'omtc-conf', zh: '配置文件', en: 'client.conf' },
        { id: 'omtc-faq', zh: '常见问题', en: 'FAQ' }
      ] },
    { id: 'omtn', file: 'omtn.html', zh: '客户端手册', en: 'Client manual',
      subs: [
        { id: 'omtn-platforms', zh: '平台', en: 'Platforms' },
        { id: 'omtn-terms', zh: '主界面与会话', en: 'Main UI' },
        { id: 'omtn-term', zh: '终端', en: 'Terminal' },
        { id: 'omtn-kb', zh: '软键盘', en: 'Soft keyboard' },
        { id: 'omtn-files', zh: '文件管理', en: 'Files' },
        { id: 'omtn-trust', zh: '连接与信任', en: 'Trust' },
        { id: 'omtn-account', zh: '登录与账号', en: 'Account' },
        { id: 'omtn-update', zh: '更新与源', en: 'Updates' },
        { id: 'omtn-shell', zh: '桌面壳与移动端', en: 'Shell & mobile' }
      ] },
    { id: 'admin', file: 'admin.html', zh: '管理员手册', en: 'Admin manual',
      subs: [
        { id: 'admin-entry', zh: '身份与入口', en: 'Entry' },
        { id: 'admin-users', zh: '用户管理', en: 'Users' },
        { id: 'admin-oauth', zh: 'OAuth 登录', en: 'OAuth' },
        { id: 'admin-settings', zh: '系统设置', en: 'Settings' },
        { id: 'admin-diag', zh: '诊断与集群', en: 'Diagnostics' }
      ] }
  ];

  function zhEn(zh, en) {
    var s = document.createElement('span'); s.className = 'l-zh'; s.textContent = zh;
    var e = document.createElement('span'); e.className = 'l-en'; e.textContent = en;
    var f = document.createDocumentFragment();
    f.appendChild(s); f.appendChild(e);
    return f;
  }

  var page = document.body.getAttribute('data-doc');
  var nav = document.getElementById('docNav');

  if (nav) {
    var frag = document.createDocumentFragment();
    CHAPTERS.forEach(function (ch) {
      var a = document.createElement('a');
      a.href = ch.file;
      a.setAttribute('data-spy-page', ch.id);
      if (page === ch.id) a.className = 'on';
      a.appendChild(zhEn(ch.zh, ch.en));
      frag.appendChild(a);
      if (page === ch.id) {
        ch.subs.forEach(function (s) {
          var sa = document.createElement('a');
          sa.className = 'sub';
          sa.href = '#' + s.id;
          sa.setAttribute('data-spy', s.id);
          sa.appendChild(zhEn(s.zh, s.en));
          frag.appendChild(sa);
        });
      }
    });
    nav.appendChild(frag);

    // scrollspy: highlight the sub-section currently in view
    if ('IntersectionObserver' in window) {
      var links = {};
      Array.prototype.forEach.call(nav.querySelectorAll('a[data-spy]'), function (a) {
        links[a.getAttribute('data-spy')] = a;
      });
      var targets = [];
      Object.keys(links).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) targets.push(el);
      });
      function setActive(id) {
        Object.keys(links).forEach(function (k) { links[k].classList.toggle('on', k === id); });
      }
      var current = null;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) current = e.target.id;
        });
        if (current && links[current]) setActive(current);
      }, { rootMargin: '-80px 0px -70% 0px' });
      targets.forEach(function (t) { io.observe(t); });
    }
  }

  // prev/next pager (index first, chapters, back to index)
  var pager = document.getElementById('docPager');
  if (pager) {
    var seq = [{ file: '../docs.html', zh: '文档首页', en: 'Docs home' }]
      .concat(CHAPTERS.map(function (c) { return { file: c.file, zh: c.zh, en: c.en }; }));
    var idx = -1;
    for (var i = 0; i < seq.length; i++) {
      if (page && seq[i].file === page + '.html') { idx = i; break; }
    }
    if (idx > 0) {
      var p = seq[idx - 1];
      var pa = document.createElement('a');
      pa.className = 'doc-page-nav prev';
      pa.href = p.file;
      pa.appendChild(zhEn('← ' + p.zh, '← ' + p.en));
      pager.appendChild(pa);
    }
    if (idx > -1 && idx < seq.length - 1) {
      var n = seq[idx + 1];
      var na = document.createElement('a');
      na.className = 'doc-page-nav next';
      na.href = n.file;
      na.appendChild(zhEn(n.zh + ' →', n.en + ' →'));
      pager.appendChild(na);
    }
  }
})();
