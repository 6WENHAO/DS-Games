/* 铁幕1994 — 通用 UI 组件（提示条 / 悬浮说明 / 弹窗 / 卡片信息渲染） */
(function () {
  'use strict';
  var IC = window.IC;
  var U = IC.Util, R = IC.Rules;
  var UI = IC.UI = {};

  /* ---------------- 屏幕切换 ---------------- */
  UI.show = function (id) {
    var list = document.querySelectorAll('.screen');
    for (var i = 0; i < list.length; i++) list[i].classList.remove('on');
    var el = document.getElementById(id);
    if (el) el.classList.add('on');
    UI.current = id;
  };

  /* ---------------- 提示条 ---------------- */
  UI.toast = function (msg, kind, ms) {
    var t = U.el('div', 'toast' + (kind ? ' ' + kind : ''), U.esc(msg).replace(/\n/g, '<br>'));
    document.body.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s';
      t.style.opacity = '0';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, ms || 2600);
  };

  /* ---------------- 悬浮说明 ---------------- */
  var tipEl = null;
  UI.tip = function (html, ev) {
    if (!tipEl) tipEl = document.getElementById('tip');
    if (!tipEl) return;
    tipEl.innerHTML = html;
    tipEl.style.display = 'block';
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    var x = (ev.clientX || 0) + 16, y = (ev.clientY || 0) + 12;
    if (x + w > window.innerWidth - 10) x = (ev.clientX || 0) - w - 14;
    if (y + h > window.innerHeight - 10) y = window.innerHeight - h - 12;
    tipEl.style.left = Math.max(6, x) + 'px';
    tipEl.style.top = Math.max(6, y) + 'px';
  };
  UI.hideTip = function () { if (tipEl) tipEl.style.display = 'none'; };
  UI.bindTip = function (el, htmlFn) {
    el.addEventListener('mousemove', function (ev) { UI.tip(typeof htmlFn === 'function' ? htmlFn() : htmlFn, ev); });
    el.addEventListener('mouseleave', UI.hideTip);
    return el;
  };

  /* ---------------- 弹窗 ---------------- */
  UI.modal = function (title, bodyHtml, buttons, opts) {
    opts = opts || {};
    var root = document.getElementById('modal-root');
    var back = U.el('div', 'modal-back');
    var panel = U.el('div', 'panel modal');
    var head = U.el('div', 'panel-h', '<span>' + title + '</span>');
    var body = U.el('div', 'panel-b');
    if (typeof bodyHtml === 'string') body.innerHTML = bodyHtml; else if (bodyHtml) body.appendChild(bodyHtml);
    var foot = U.el('div', 'panel-b', '');
    foot.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--line)';
    function close() { if (back.parentNode) back.parentNode.removeChild(back); }
    (buttons || [{ label: '关闭' }]).forEach(function (b) {
      var btn = U.el('button', 'btn ' + (b.cls || ''), b.label);
      btn.onclick = function () {
        var keep = b.fn ? b.fn() : false;
        if (!keep) close();
      };
      foot.appendChild(btn);
    });
    panel.appendChild(head); panel.appendChild(body); panel.appendChild(foot);
    back.appendChild(panel);
    if (!opts.sticky) back.addEventListener('click', function (e) { if (e.target === back) close(); });
    root.appendChild(back);
    return { close: close, body: body, back: back };
  };

  UI.confirm = function (title, text, onYes, yesLabel) {
    UI.modal(title, '<p>' + text + '</p>', [
      { label: '取消' },
      { label: yesLabel || '确认', cls: 'primary', fn: function () { onYes(); } }
    ]);
  };

  /* ---------------- 文本 ---------------- */
  UI.paras = function (arr) {
    if (!arr) return '';
    if (typeof arr === 'string') return '<p>' + U.esc(arr) + '</p>';
    return arr.map(function (p) { return '<p>' + U.esc(p) + '</p>'; }).join('');
  };
  UI.sideName = function (s) { return s === 'NATO' ? '北约' : '华约'; };
  UI.sideFull = function (s) { return s === 'NATO' ? '北大西洋公约组织' : '华沙条约组织'; };
  UI.catName = function (c) { return (R.CATEGORY[c] || {}).name || c; };
  UI.country = function (c) { return R.COUNTRY[c] || c; };
  UI.vetName = function (v) { return (window.DATA_VET[v] || {}).name || v; };

  UI.kindName = function (k) {
    return ({ AT: '动能穿甲', ATGM: '反坦克导弹', HE: '高爆杀伤', SMALL: '轻武器', AA: '防空', ARTY: '间瞄火力', BOMB: '航空弹药', NUKE: '核装置' })[k] || k;
  };

  /* 单位军标图标（渲染器提供，缺失时退化为文字） */
  UI.symbol = function (card, side, w, h) {
    var box = U.el('span');
    box.style.cssText = 'display:inline-block;width:' + w + 'px;height:' + h + 'px;vertical-align:middle';
    try {
      if (IC.Render && IC.Render.symbolCanvas) {
        var cv = IC.Render.symbolCanvas(card, side, Math.min(w, h));
        if (cv) {
          cv.style.width = w + 'px'; cv.style.height = h + 'px';
          box.appendChild(cv);
          return box;
        }
      }
    } catch (e) { /* 退化 */ }
    box.textContent = (R.CATEGORY[card.category] || {}).symbol || '?';
    box.style.cssText += ';font-size:10px;color:#9fb0c2;text-align:center';
    return box;
  };

  /* 武器行 HTML */
  UI.weaponHtml = function (w, ammo) {
    return '<div class="wr-t"><span>' + U.esc(w.name) + '</span><span class="dim">' + UI.kindName(w.kind) + '</span></div>' +
      '<div class="wr-s">' +
      (w.pen ? '<span>穿深 ' + w.pen + '</span>' : '') +
      (w.he ? '<span>杀伤 ' + w.he + '</span>' : '') +
      '<span>命中 ' + Math.round((w.acc || 0) * 100) + '%</span>' +
      '<span>射程 ' + (w.rmin ? w.rmin + '-' : '') + w.rmax + '格</span>' +
      '<span>射速 ' + (w.rof || 1) + '</span>' +
      (ammo != null ? '<span' + (ammo <= 0 ? ' style="color:#c25b52"' : '') + '>弹药 ' + ammo + '</span>' : '') +
      (w.air ? '<span class="tag">可对空</span>' : '') +
      '</div>';
  };

  /* 卡片悬浮说明 */
  UI.cardTip = function (card) {
    var s = card.stats || {};
    var h = '<h4>' + U.esc(card.name) + '</h4>';
    h += '<div class="tp-r"><span class="dim">' + UI.country(card.country) + ' · ' + UI.catName(card.category) + ' · ' + U.esc(card.role || '') + '</span>' +
      '<span class="tag ' + (card.era === 1994 ? 'era94' : '') + '">' + card.era + '</span></div>';
    h += '<div class="hr"></div>';
    h += '<div class="tp-r"><span>召唤分值</span><b style="color:var(--gold)">' + card.cost + '</b></div>';
    h += '<div class="tp-r"><span>可用数量 / 编制</span><b>' + (card.avail || '-') + ' / ' + (card.strength || '-') + '</b></div>';
    h += '<div class="tp-r"><span>老兵度</span><b>' + UI.vetName(card.vet) + '</b></div>';
    h += '<div class="tp-r"><span>装甲 正/侧/顶</span><b>' + (s.armorF || 0) + ' / ' + (s.armorS || 0) + ' / ' + (s.armorT || 0) + '</b></div>';
    h += '<div class="tp-r"><span>机动 / 观测 / 隐蔽</span><b>' + (s.move || 0) + ' / ' + (s.optics || 0) + ' / ' + (s.stealth || 0) + '</b></div>';
    h += '<div class="hr"></div>';
    (card.weapons || []).forEach(function (w) {
      h += '<div style="margin-bottom:3px">' + UI.weaponHtml(w) + '</div>';
    });
    if (card.traits && card.traits.length) {
      h += '<div class="hr"></div><div class="dim" style="font-size:11px">特性：' + card.traits.map(function (t) { return UI.traitName(t); }).join('、') + '</div>';
    }
    if (card.desc) h += '<div class="hr"></div><div style="font-family:var(--serif);font-style:italic;color:#b6bfc9">' + U.esc(card.desc) + '</div>';
    return h;
  };

  UI.TRAITS = {
    smoke: '发烟', thermal: '热成像', gas_turbine: '燃气轮机', amphibious: '两栖', at_team: '反坦克组',
    manpads: '便携防空', sniper: '狙击', engineer: '工程', recon: '侦察', spec_ops: '特种作战',
    shock: '突击', cheap_conscript: '动员兵', nbc: '三防', era: '反应装甲', heliborne: '机降',
    counter_battery: '反炮兵', radar: '雷达', sead: '反辐射', stealth_air: '隐身', laser_guided: '激光制导',
    cluster: '集束', thermobaric: '温压', airborne: '空降', marine: '海军陆战', command: '指挥',
    supply: '补给', repair: '维修', mine_plow: '扫雷犁', jammer: '干扰', sigint: '电子侦察',
    psyops: '心理战', decoy: '假目标', cyber: '网络战', gps: '卫星导航', nuke_capable: '核投掷资格',
    dug_in: '预设阵地'
  };
  UI.traitName = function (t) { return UI.TRAITS[t] || t; };

  /* 通用列表渲染 */
  UI.list = function (host, items, build) {
    U.clear(host);
    items.forEach(function (it, i) { host.appendChild(build(it, i)); });
    return host;
  };
})();
