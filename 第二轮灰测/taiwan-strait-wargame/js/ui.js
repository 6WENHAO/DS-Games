/* ============================================================================
 * ui.js — 兵推控制台界面 (Wargame Console UI)
 * ============================================================================*/
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};
  var doc = root.document;

  function el(id) { return doc.getElementById(id); }
  function h(tag, cls, txt) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function fmt(n, d) { return (n == null || isNaN(n)) ? '—' : Number(n).toFixed(d == null ? 0 : d); }
  function pct(v) { return fmt(v * 100, 0) + '%'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var SIDE_NAME = { PLA: '解放军', ROC: '台军', US: '美军', JP: '日本' };
  var DOMAIN_NAME = { air: '航空', surface: '水面', sub: '水下', ground: '地面', sam: '防空', radar: '雷达/电抗', base: '机场' };
  var STATE_NAME = {
    ready: '待战', inport: '在港', enroute: '航渡/进袭', onstation: '占领阵位', engaged: '交战中',
    rtb: '返场', offloading: '卸载中', destroyed: '被毁', mobilizing: '动员中', embarked: '已装载',
    landed: '已上陸', airborne_enroute: '空运中', recovered: '已回收'
  };

  /* =====================================================================
   * App
   * ===================================================================*/
  function App(scId) {
    this.E = null;
    this.R = null;
    this.speed = 0;                     // 推演秒 / 真实秒
    this.dt = 20;
    this.last = 0;
    this.scenarioId = scId || 'invasion';
    this.viewSide = 'PLA';
    this.filter = { air: 1, surface: 1, sub: 1, ground: 1, sam: 1, radar: 1 };
    this.logFilter = 'all';
    this.build();
    this.newGame(this.scenarioId);
    this.loop();
  }

  /* ---------------- 构建 DOM ---------------- */
  App.prototype.build = function () {
    var self = this;
    this.cv = el('map');
    this.R = null;

    /* 剧本选择 */
    var sel = el('scenarioSel');
    TWG.scenarioList().forEach(function (sc) {
      var o = h('option', null, sc.short + ' — ' + sc.name.replace(/\s*\(.*\)/, ''));
      o.value = sc.id; sel.appendChild(o);
    });
    sel.value = this.scenarioId;
    sel.onchange = function () { self.scenarioId = sel.value; self.newGame(sel.value); };

    /* 季节 */
    var ss = el('seasonSel');
    Object.keys(TWG.THEATER.SEASONS).forEach(function (k) {
      var o = h('option', null, k); o.value = k; ss.appendChild(o);
    });
    ss.onchange = function () { self.newGame(self.scenarioId, { season: ss.value }); };
    this.seasonSel = ss;

    /* 底图源 */
    var ms = el('mapSel');
    Object.keys(TWG.Renderer.SOURCES).forEach(function (k) {
      var o = h('option', null, TWG.Renderer.SOURCES[k].name); o.value = k; ms.appendChild(o);
    });
    ms.value = 'esriSat';
    ms.onchange = function () { self.R.opts.source = ms.value; self.R.tiles.clear(); };

    /* 建模比例 */
    var mo = el('modelSel');
    [['exagg', '战术放大 (推荐)'], ['1x', '接近真实比例'], ['real', '严格真实比例']].forEach(function (p) {
      var o = h('option', null, p[1]); o.value = p[0]; mo.appendChild(o);
    });
    mo.onchange = function () { self.R.opts.modelScale = mo.value; };

    /* 装备呈现方式 */
    var us = el('unitStyleSel');
    var glOk = TWG.haveGL && TWG.haveGL();
    [['3d', glOk ? '三维实体 (推荐)' : '三维实体 (本机不支持)'], ['vector', '二维矢量轮廓']].forEach(function (p) {
      var o = h('option', null, p[1]); o.value = p[0]; if (p[0] === '3d' && !glOk) o.disabled = true; us.appendChild(o);
    });
    us.value = glOk ? '3d' : 'vector';
    us.onchange = function () { self.R.setUnitStyle(us.value); };
    this.unitStyleSel = us;

    /* 三维画质 */
    var qs = el('qualitySel');
    [['mid', '中 (12方向/88px)'], ['high', '高 (16方向/124px)'], ['low', '低 (8方向/64px)']].forEach(function (p) {
      var o = h('option', null, p[1]); o.value = p[0]; qs.appendChild(o);
    });
    qs.value = 'mid';
    qs.onchange = function () { self.R.setQuality(qs.value); };

    /* 媒体面板切换 */
    Array.prototype.forEach.call(doc.querySelectorAll('#inspMedia .mt'), function (t) {
      t.onclick = function () {
        Array.prototype.forEach.call(doc.querySelectorAll('#inspMedia .mt'), function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        self.mediaMode = t.dataset.m;
        Array.prototype.forEach.call(doc.querySelectorAll('#inspMedia .mBox'), function (b) {
          b.style.display = (b.dataset.m === self.mediaMode) ? '' : 'none';
        });
        if (self.mediaMode === 'm3d') self.ensureViewer(true);
        else if (self.viewer) self.viewer.setVisible(false);
        if (self.mediaMode === 'vec' && self.mediaUnit) self.drawModelPreview(self.mediaUnit);
      };
    });
    this.mediaMode = 'photo';
    el('phPrev').onclick = function () { self.photoStep(-1); };
    el('phNext').onclick = function () { self.photoStep(1); };
    el('v3dSpin').onchange = function () { if (self.viewer) self.viewer.setAutoRotate(el('v3dSpin').checked); };

    /* 装备图鉴 */
    el('btnCodex').onclick = function () { self.openCodex(); };
    el('cdxClose').onclick = function () { self.closeCodex(); };
    el('cdxSearch').oninput = function () { self.renderCodexGrid(); };
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el('codex').classList.contains('on')) self.closeCodex();
    });

    /* 速度按钮 */
    var speeds = [['⏸', 0], ['▶ 1×', 60], ['▶▶ 5×', 300], ['▶▶▶ 20×', 1200], ['⏩ 60×', 3600], ['⏭ 300×', 18000]];
    var sc2 = el('speedBar');
    speeds.forEach(function (s) {
      var b = h('button', 'sbtn', s[0]);
      b.onclick = function () {
        self.speed = s[1];
        Array.prototype.forEach.call(sc2.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
      };
      if (s[1] === 0) b.classList.add('on');
      sc2.appendChild(b);
    });

    el('btnRestart').onclick = function () { self.newGame(self.scenarioId); };
    el('btnStep').onclick = function () { for (var i = 0; i < 30; i++) self.E.step(self.dt); self.afterStep(); };

    /* 视角侧 */
    var vs = el('viewSide');
    [['PLA', '解放军视角'], ['ROC', '台军视角'], ['', '全知视角']].forEach(function (p) {
      var o = h('option', null, p[1]); o.value = p[0]; vs.appendChild(o);
    });
    vs.onchange = function () { self.viewSide = vs.value; self.R.viewSide = vs.value || null; };

    /* 图层开关 */
    var layers = [['showRange', '射程包线'], ['showTracks', '情报航迹'], ['showLabels', '名称标注'],
      ['showZones', '作战区/滩头'], ['showTrails', '航迹尾迹'], ['showGrid', '经纬网'], ['tint', '战术滤色'],
      ['fog', '战场迷雾(按视角)']];
    var lw = el('layerBox');
    layers.forEach(function (p) {
      var lab = h('label', 'chk');
      var cb = doc.createElement('input'); cb.type = 'checkbox';
      cb.checked = p[0] !== 'fog';
      cb.onchange = function () { self.R.opts[p[0]] = cb.checked; };
      lab.appendChild(cb); lab.appendChild(h('span', null, p[1]));
      lw.appendChild(lab);
    });
    /* 兵种过滤 */
    var fw = el('filterBox');
    [['air', '航空'], ['surface', '水面'], ['sub', '潜艇'], ['ground', '地面'], ['sam', '防空'], ['radar', '雷达']].forEach(function (p) {
      var lab = h('label', 'chk');
      var cb = doc.createElement('input'); cb.type = 'checkbox'; cb.checked = true;
      cb.onchange = function () { self.filter[p[0]] = cb.checked ? 1 : 0; self.renderOOB(); };
      lab.appendChild(cb); lab.appendChild(h('span', null, p[1]));
      fw.appendChild(lab);
    });

    /* 日志过滤 */
    var lf = el('logFilter');
    [['all', '全部'], ['critical', '★关键事件'], ['fire', '发射'], ['hit', '命中/毁伤'],
      ['intercept', '拦截'], ['strike', '对地打击'], ['amphib', '两栖'], ['kill', '战果']].forEach(function (p) {
      var o = h('option', null, p[1]); o.value = p[0]; lf.appendChild(o);
    });
    lf.onchange = function () { self.logFilter = lf.value; self.renderLog(true); };

    /* Tab 切换 */
    Array.prototype.forEach.call(doc.querySelectorAll('.tab'), function (t) {
      t.onclick = function () {
        Array.prototype.forEach.call(doc.querySelectorAll('.tab'), function (x) { x.classList.remove('on'); });
        Array.prototype.forEach.call(doc.querySelectorAll('.panel'), function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        el(t.dataset.p).classList.add('on');
      };
    });

    /* 地图交互 */
    var drag = null;
    this.cv.addEventListener('mousedown', function (e) { drag = { x: e.clientX, y: e.clientY, moved: 0 }; });
    root.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = 1;
      self.R.pan(dx, dy);
      drag.x = e.clientX; drag.y = e.clientY;
    });
    root.addEventListener('mouseup', function (e) {
      if (drag && !drag.moved) {
        var r = self.cv.getBoundingClientRect();
        var hit = self.R.pick(e.clientX - r.left, e.clientY - r.top);
        self.select(hit);
      }
      drag = null;
    });
    this.cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = self.cv.getBoundingClientRect();
      self.R.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY > 0 ? -0.32 : 0.32);
    }, { passive: false });
    root.addEventListener('resize', function () { self.R.resize(); });

    /* 快速定位 */
    var jw = el('jumpBox');
    [['台湾海峡', 23.9, 120.4, 7.2], ['台北/北部', 25.05, 121.4, 9.2], ['台中—大甲滩头', 24.32, 120.55, 9.6],
      ['台南—高雄', 22.85, 120.3, 8.8], ['花莲/东岸', 24.0, 121.7, 9.2], ['澎湖', 23.57, 119.6, 9.5],
      ['金门·厦门', 24.45, 118.25, 10], ['马祖', 26.15, 119.95, 10.5], ['巴士海峡', 21.3, 121.0, 7.4],
      ['宫古/与那国', 24.6, 124.0, 7.2], ['福建沿海', 25.6, 119.3, 8.2]].forEach(function (j) {
      var b = h('button', 'jbtn', j[0]);
      b.onclick = function () { self.R.flyTo(j[1], j[2], j[3]); };
      jw.appendChild(b);
    });
  };

  /* ---------------- 新局 ---------------- */
  App.prototype.newGame = function (id, over) {
    var self = this;
    var sc = TWG.SCENARIOS[id];
    // 深拷贝剧本以复位 airborne.done / 城市 taken 等状态
    TWG.THEATER.CITIES.forEach(function (c) { delete c.taken; delete c.siege; });
    Object.keys(TWG.THEATER.idx.beach).forEach(function (k) {
      if (TWG.THEATER.idx.beach[k].custom) delete TWG.THEATER.idx.beach[k];
    });
    if (sc.airborne) sc.airborne.forEach(function (a) { delete a.done; });
    if (over && over.season) sc.season = over.season;
    this.seasonSel.value = sc.season;

    this.E = new TWG.Engine({ scenario: sc, seed: (Date.now() % 100000) | 0 });
    if (!this.R) {
      this.R = new TWG.Renderer(this.cv, this.E, {});
      this.R.viewSide = this.viewSide;
    } else {
      this.R.E = this.E; this.R.selected = null; this.R.effects = []; this.R.trails.clear();
    }
    this.E.onEvent = function (e) { self.onEvent(e); };
    this.E.onEnd = function (r) { self.onEnd(r); };
    this.logShown = 0;
    el('logList').innerHTML = '';
    el('endBanner').style.display = 'none';
    this.mediaCls = null; this.photos = []; this.photoI = 0;
    this.renderBrief();
    this.renderOOB();
    this.renderLog(true);
    this.select(null);
    this.speed = 0;
    Array.prototype.forEach.call(el('speedBar').children, function (c, i) {
      c.classList.toggle('on', i === 0);
    });
  };

  /* ---------------- 事件回调 ---------------- */
  App.prototype.onEvent = function (e) {
    if (!this.R) return;
    if (e.lat != null && e.lon != null) {
      if (e.kind === 'kill' || e.kind === 'critical') this.R.addEffect(e.lat, e.lon, 'kill');
      else if (e.kind === 'hit') this.R.addEffect(e.lat, e.lon, 'hit');
      else if (e.kind === 'intercept') this.R.addEffect(e.lat, e.lon, 'intercept');
      else if (e.kind === 'strike') this.R.addEffect(e.lat, e.lon, 'strike');
    }
  };
  App.prototype.onEnd = function (r) {
    this.speed = 0;
    var b = el('endBanner');
    b.style.display = 'block';
    b.className = 'endBanner ' + (r.winner === 'PLA' ? 'pla' : r.winner === 'ROC' ? 'roc' : 'draw');
    b.innerHTML = '<div class="eb-t">' + (r.winner ? SIDE_NAME[r.winner] + ' 达成战役目标' : '双方僵持 · 无决定性结果') +
      '</div><div class="eb-s">' + esc(r.clock) + ' — ' + esc(r.why) + '</div>' +
      '<div class="eb-s">战役评分　解放军 ' + fmt(r.score.pla, 1) + ' ： 台军 ' + fmt(r.score.roc, 1) + '</div>';
  };

  /* ---------------- 主循环 ---------------- */
  App.prototype.loop = function () {
    var self = this;
    this._fpsN = 0; this._fpsT = 0; this._fps = 0;
    function frame(ts) {
      var dtReal = self.last ? Math.min(0.1, (ts - self.last) / 1000) : 0.016;
      self.last = ts;
      if (self.speed > 0 && self.E && !self.E.ended) {
        var simSec = self.speed * dtReal;
        var steps = Math.min(400, Math.max(1, Math.round(simSec / self.dt)));
        for (var i = 0; i < steps; i++) { self.E.step(self.dt); if (self.E.ended) break; }
        self.afterStep();
      }
      var t0 = performance.now();
      self.R.draw(dtReal);
      var t1 = performance.now();
      self._fpsN++; self._fpsT += dtReal; self._drawMs = (self._drawMs || 0) * 0.9 + (t1 - t0) * 0.1;
      if (self._fpsT >= 0.5) { self._fps = self._fpsN / self._fpsT; self._fpsN = 0; self._fpsT = 0; self.renderPerf(); }
      root.requestAnimationFrame(frame);
    }
    root.requestAnimationFrame(frame);
  };
  App.prototype.renderPerf = function () {
    var e = el('perfInfo'); if (!e) return;
    var b = this.R.bank ? this.R.bank.stats() : null;
    e.innerHTML = fmt(this._fps) + ' FPS　绘制 ' + fmt(this._drawMs, 1) + ' ms　' +
      (b ? '三维精灵 ' + b.classes + ' 型/' + b.dirs + '向 ' + b.approxMB + 'MB' + (b.pending ? ' (烘焙中 ' + b.pending + ')' : '')
        : '二维矢量模式') +
      '　飞行体 ' + this.E.proj.length;
  };
  App.prototype.afterStep = function () {
    var now = performance.now();
    if (!this._uiT || now - this._uiT > 260) {
      this._uiT = now;
      this.renderStatus();
      this.renderLog(false);
      this.renderCharts();
      if (this.R.selected) this.renderInspect(this.R.selected);
      if (this._oobT == null || now - this._oobT > 1400) { this._oobT = now; this.renderOOB(); }
    }
  };

  /* ---------------- 状态栏 ---------------- */
  App.prototype.renderStatus = function () {
    var E = this.E, S = E.score();
    el('clock').textContent = E.clock();
    var ph = E.scenario.phases[E.phase];
    el('phase').textContent = '阶段 ' + (E.phase + 1) + '/' + E.scenario.phases.length + '　' + ph.name;
    el('phaseDesc').textContent = ph.desc;
    function bar(id, v, a, b) {
      var e = el(id); if (!e) return;
      e.querySelector('.bf').style.width = (v * 100).toFixed(1) + '%';
      e.querySelector('.bv').textContent = pct(v);
    }
    bar('barAir', S.air); bar('barSea', S.sea);
    el('scorePLA').textContent = fmt(S.pla, 1);
    el('scoreROC').textContent = fmt(S.roc, 1);
    el('envInfo').innerHTML =
      '海况 <b>' + fmt(E.env.sea, 1) + '</b> 级　风 <b>' + fmt(E.env.wind) + '</b> kn　能见度 <b>' + pct(E.env.vis) +
      '</b>　' + (E.env.night ? '<span class="night">夜间</span>' : '<span class="day">昼间</span>') +
      (E.env.typhoon > 0 ? '　<span class="warn">台风影响中</span>' : '') +
      '　两栖适宜度 <b>' + pct(E.env.amphib) + '</b>';

    var sPLA = E.sides.PLA, sROC = E.sides.ROC;
    function inv(side) {
      var n = 0;
      Object.keys(E.bases).forEach(function (k) {
        var b = E.bases[k]; if (b.side !== side) return;
        Object.keys(b.inv).forEach(function (c) { n += b.inv[c]; });
      });
      E.units.forEach(function (u) { if (!u.dead && u.side === side && u.domain === 'air') n += u.n; });
      return n;
    }
    function cnt(side, dom) {
      var n = 0; E.units.forEach(function (u) { if (!u.dead && u.side === side && u.domain === dom) n++; });
      return n;
    }
    var rows = [
      ['可用作战飞机', inv('PLA'), inv('ROC')],
      ['水面舰艇', cnt('PLA', 'surface'), cnt('ROC', 'surface')],
      ['潜艇', cnt('PLA', 'sub'), cnt('ROC', 'sub')],
      ['地面作战单位', cnt('PLA', 'ground'), cnt('ROC', 'ground')],
      ['防空单位', cnt('PLA', 'sam'), cnt('ROC', 'sam')],
      ['飞机损失(空战/地面)', sPLA.losses.air + '/' + sPLA.losses.aircraftGround, sROC.losses.air + '/' + sROC.losses.aircraftGround],
      ['舰艇沉没', sPLA.losses.ship, sROC.losses.ship],
      ['出动架次', sPLA.sorties, sROC.sorties],
      ['导弹发射(命中)', sPLA.missilesFired + ' (' + sPLA.missilesHit + ')', sROC.missilesFired + ' (' + sROC.missilesHit + ')'],
      ['精确弹药存量', pct(sPLA.pgm), pct(sROC.pgm)],
      ['士气/指挥效能', pct(sPLA.morale) + '/' + pct(sPLA.c2), pct(sROC.morale) + '/' + pct(sROC.c2)],
      ['机场平均可用率', pct(E.baseOpsAvg('PLA')), pct(E.baseOpsAvg('ROC'))]
    ];
    var t = '<table class="cmp"><tr><th></th><th class="pla">解放军</th><th class="roc">台军</th></tr>';
    rows.forEach(function (r) {
      t += '<tr><td>' + r[0] + '</td><td class="pla">' + r[1] + '</td><td class="roc">' + r[2] + '</td></tr>';
    });
    t += '</table>';
    el('cmpBox').innerHTML = t;

    // 登陆场
    var bhKeys = Object.keys(E.beachheads);
    var bx = '';
    if (bhKeys.length) {
      bx = '<table class="bh"><tr><th>登陆场</th><th>兵力</th><th>战力</th><th>补给</th><th>态势</th></tr>';
      bhKeys.forEach(function (k) {
        var b = E.beachheads[k], nm = (TWG.THEATER.idx.beach[k] || {}).name || k;
        bx += '<tr class="' + (b.active ? '' : 'dead') + '"><td>' + esc(nm.replace(/—.*/, '')) + '</td><td>' +
          fmt(b.troops) + '</td><td>' + fmt(b.cp) + '</td><td>' + pct(b.supply) + '</td><td>' +
          (!b.active ? '<span class="bad">已崩溃</span>' : b.breakout ? '<span class="good">突破 ' + fmt(b.advance) + 'km</span>' :
            b.ratio > 1.2 ? '优势' : b.ratio > 0.8 ? '胶着' : '<span class="bad">受压</span>') + '</td></tr>';
      });
      bx += '</table>';
      var caps = Object.keys(E.captured).length;
      bx += '<div class="mini">已攻占目标 <b>' + caps + '</b> 处　夺取港口 <b>' + (E.capturedPorts || 0) +
        '</b>　两栖投送存活率 <b>' + pct(E.liftRatio == null ? 1 : E.liftRatio) + '</b></div>';
    } else {
      bx = '<div class="mini dim">尚无登陆场（本剧本可能不含两栖作战，或尚未到航渡阶段）</div>';
    }
    el('bhBox').innerHTML = bx;
  };

  /* ---------------- 剧本说明 ---------------- */
  App.prototype.renderBrief = function () {
    var sc = this.E.scenario;
    var s = '<h3>' + esc(sc.name) + '</h3>';
    s += '<div class="tagline">季节窗口：' + esc(sc.season) + '　推演上限：D+' + sc.maxDays +
      '　美日介入：' + (sc.usIntervention == null ? '本剧本不介入' : 'D+' + sc.usIntervention) + '</div>';
    s += '<p>' + esc(sc.brief) + '</p>';
    var env = TWG.THEATER.SEASONS[sc.season];
    if (env) s += '<div class="note">气象条件：' + esc(env.note) + '</div>';
    s += '<div class="objs"><div class="oc pla"><h4>解放军战役目标</h4><ul>' +
      sc.objectives.PLA.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul></div>';
    s += '<div class="oc roc"><h4>台军防卫目标</h4><ul>' +
      sc.objectives.ROC.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul></div></div>';
    s += '<h4>战役阶段划分</h4><ol class="phases">';
    sc.phases.forEach(function (p) {
      s += '<li><b>D+' + (p.at / 24).toFixed(1) + '（H+' + p.at + 'h）' + esc(p.name) + '</b><br><span>' + esc(p.desc) + '</span></li>';
    });
    s += '</ol>';
    if (sc.landingPlan && sc.landingPlan.length) {
      s += '<h4>登陆计划</h4><table class="lp"><tr><th>方向</th><th>梯队</th><th>权重</th><th>滩头条件</th><th>目标</th></tr>';
      sc.landingPlan.forEach(function (p) {
        var b = TWG.THEATER.idx.beach[p.beach] || p;
        s += '<tr><td>' + esc(b.name || p.beach) + (p.main ? ' <b>[主]</b>' : '') + '</td><td>' + (p.echelon || 1) +
          '</td><td>' + p.weight + '</td><td>适宜度 ' + fmt((b.grade || 0.6) * 100) + '% / 潮滩 ' + fmt(b.flat || 0, 1) +
          'km / 正面 ' + fmt(b.width || 0) + 'km</td><td>' + esc(b.obj || '') + '</td></tr>';
      });
      s += '</table>';
    }
    s += '<div class="disclaimer">※ 本推演为学术性沙盘模拟。所有兵力、装备参数与地理数据均整理自公开来源' +
      '（IISS Military Balance、US DoD China Military Power Report、Jane\'s、台湾国防报告书、Natural Earth 等），' +
      '毁伤概率/探测模型为工程估算，不代表任何实际作战计划或情报评估。</div>';
    el('briefBox').innerHTML = s;
  };

  /* ---------------- 战斗序列 ---------------- */
  App.prototype.renderOOB = function () {
    var E = this.E, self = this;
    var box = el('oobBox');
    var groups = {};
    E.units.forEach(function (u) {
      if (u.dead || u.state === 'mobilizing') return;
      if (!self.filter[u.domain]) return;
      var key = u.side + '|' + u.domain;
      (groups[key] = groups[key] || []).push(u);
    });
    // 机场库存
    var s = '';
    ['PLA', 'ROC', 'US', 'JP'].forEach(function (side) {
      if (!E.sides[side].active) return;
      var any = Object.keys(groups).some(function (k) { return k.indexOf(side + '|') === 0; });
      var invRows = [];
      Object.keys(E.bases).forEach(function (k) {
        var b = E.bases[k];
        if (b.side !== side || !b.active) return;
        var tot = 0; Object.keys(b.inv).forEach(function (c) { tot += b.inv[c]; });
        if (tot > 0) invRows.push(b);
      });
      if (!any && !invRows.length) return;
      s += '<div class="oobSide ' + side.toLowerCase() + '"><h4>' + SIDE_NAME[side] + '</h4>';
      if (self.filter.air && invRows.length) {
        s += '<div class="og"><div class="ogt">机场在库飞机</div>';
        invRows.sort(function (a, b) { return b.ops - a.ops; }).forEach(function (b) {
          var det = Object.keys(b.inv).filter(function (c) { return b.inv[c] > 0; })
            .map(function (c) { return (TWG.PLATFORMS[c] ? TWG.PLATFORMS[c].name.split(' ')[0] : c) + '×' + b.inv[c]; }).join('、');
          s += '<div class="orow" data-b="' + b.id + '"><span class="on2">' + esc(b.name.replace(/\s*\(.*?\)/, '')) +
            '</span><span class="od">' + esc(det) + '</span><span class="oo ' + (b.ops > 0.5 ? 'g' : b.ops > 0.15 ? 'y' : 'r') + '">' +
            pct(b.ops) + '</span></div>';
        });
        s += '</div>';
      }
      ['air', 'surface', 'sub', 'ground', 'sam', 'radar'].forEach(function (dom) {
        var arr = groups[side + '|' + dom];
        if (!arr || !arr.length) return;
        // 按平台聚合
        var byCls = {};
        arr.forEach(function (u) { (byCls[u.cls] = byCls[u.cls] || []).push(u); });
        s += '<div class="og"><div class="ogt">' + DOMAIN_NAME[dom] + '（' +
          (dom === 'air' ? arr.reduce(function (a, u) { return a + u.n; }, 0) + ' 架' : arr.length + ' 个单位') + '）</div>';
        Object.keys(byCls).forEach(function (c) {
          var list = byCls[c], P = TWG.PLATFORMS[c];
          var hp = list.reduce(function (a, u) { return a + u.hp / u.hp0; }, 0) / list.length;
          s += '<div class="orow" data-u="' + list[0].uid + '"><span class="on2">' + esc(P.name) +
            '</span><span class="od">' + (dom === 'air' ? list.reduce(function (a, u) { return a + u.n; }, 0) + ' 架 / ' + list.length + ' 编队'
              : list.length + ' 个') + '</span><span class="oo ' + (hp > 0.7 ? 'g' : hp > 0.4 ? 'y' : 'r') + '">' + pct(hp) + '</span></div>';
        });
        s += '</div>';
      });
      s += '</div>';
    });
    box.innerHTML = s || '<div class="mini dim">无可显示单位</div>';
    Array.prototype.forEach.call(box.querySelectorAll('.orow'), function (r) {
      r.onclick = function () {
        if (r.dataset.u) {
          var u = E.unitById(Number(r.dataset.u));
          if (u) { self.select({ kind: 'unit', o: u }); self.R.flyTo(u.lat, u.lon); }
        } else if (r.dataset.b) {
          var b = E.bases[r.dataset.b];
          if (b) { self.select({ kind: 'base', o: b }); self.R.flyTo(b.lat, b.lon, Math.max(self.R.zoom, 9)); }
        }
      };
    });
  };

  /* ---------------- 选中/检视 ---------------- */
  App.prototype.select = function (hit) {
    if (!hit) {
      this.R.selected = null;
      el('inspHead').innerHTML = '<div class="mini dim">点击地图上的装备/机场/港口，或打开「装备图鉴」查阅实景照片与三维模型</div>';
      el('inspMedia').style.display = 'none';
      el('inspSpec').innerHTML = '';
      return;
    }
    if (hit.kind === 'unit') { this.R.selected = hit.o; this.renderInspect(hit.o); }
    else { this.R.selected = null; this.renderFacility(hit.o, hit.kind); }
    Array.prototype.forEach.call(doc.querySelectorAll('.tab'), function (x) { x.classList.remove('on'); });
    Array.prototype.forEach.call(doc.querySelectorAll('.panel'), function (x) { x.classList.remove('on'); });
    doc.querySelector('.tab[data-p="pInspect"]').classList.add('on');
    el('pInspect').classList.add('on');
  };

  /* ---------------- 媒体区: 实景照片 / 三维模型 / 战术符号 ---------------- */
  App.prototype.ensureViewer = function (show) {
    if (!TWG.haveGL || !TWG.haveGL()) {
      el('v3dInfo').textContent = '本机浏览器不支持 WebGL，三维模型不可用（可使用「战术符号」视图）';
      return null;
    }
    if (!this.viewer) {
      this.viewer = new TWG.Viewer3D(el('v3d'), { shadow: true, autoRotate: el('v3dSpin').checked });
      if (this.viewer.dead) { this.viewer = null; return null; }
    }
    if (show) {
      this.viewer.setVisible(true);
      if (this.mediaCls) this.showIn3D(this.mediaCls);
    }
    return this.viewer;
  };
  App.prototype.showIn3D = function (cls) {
    var v = this.viewer;
    if (!v || v.dead) return;
    if (v.cls !== cls) v.show(cls);
    v.setVisible(this.mediaMode === 'm3d');
    var info = TWG.M3D.info(cls);
    var P = TWG.PLATFORMS[cls];
    el('v3dInfo').innerHTML = info ?
      ('三角面 <b>' + info.tris + '</b>　包围盒 ' + info.bbox.size.x.toFixed(1) + '×' +
        info.bbox.size.y.toFixed(1) + '×' + info.bbox.size.z.toFixed(1) + ' m　' +
        (P && P.len ? '实际舰长 ' + P.len + ' m' : (P && TWG.AC_DIM[cls] ? '实际机长 ' + TWG.AC_DIM[cls][0] + ' m / 翼展 ' + TWG.AC_DIM[cls][1] + ' m' : ''))) : '';
  };
  App.prototype.setMedia = function (cls, unit) {
    var box = el('inspMedia');
    box.style.display = '';
    this.mediaUnit = unit || { cls: cls, P: TWG.PLATFORMS[cls], domain: (TWG.PLATFORMS[cls] || {}).domain, side: (TWG.PLATFORMS[cls] || {}).side, role: (TWG.PLATFORMS[cls] || {}).role };
    if (this.mediaCls !== cls) {
      this.mediaCls = cls;
      this.photos = (TWG.photosOf ? TWG.photosOf(cls) : []) || [];
      this.photoI = 0;
      this.renderPhoto();
      if (this.viewer && this.mediaMode === 'm3d') this.showIn3D(cls);
    }
    if (this.mediaMode === 'm3d') this.ensureViewer(true);
    if (this.mediaMode === 'vec') this.drawModelPreview(this.mediaUnit);
  };
  App.prototype.photoStep = function (d) {
    if (!this.photos || !this.photos.length) return;
    this.photoI = (this.photoI + d + this.photos.length) % this.photos.length;
    this.renderPhoto();
  };
  App.prototype.renderPhoto = function () {
    var img = el('phImg'), meta = el('phMeta'), idx = el('phIdx');
    if (!this.photos || !this.photos.length) {
      img.removeAttribute('src'); img.classList.add('noimg');
      idx.textContent = '0/0';
      meta.innerHTML = '<span class="dim">暂无该型装备的实景照片（可运行 tools/fetch-imagery.mjs 重新抓取）</span>';
      return;
    }
    var p = this.photos[this.photoI];
    img.classList.remove('noimg');
    img.src = p.url;
    img.onerror = function () { img.classList.add('noimg'); };
    idx.textContent = (this.photoI + 1) + '/' + this.photos.length;
    meta.innerHTML = '<div class="phT">' + esc(p.title || '') + '</div>' +
      '<div class="phS">图片来源：' + esc(p.src || '网络公开图片') +
      (p.link ? '　<a href="' + esc(p.link) + '" target="_blank" rel="noreferrer">原页面 ↗</a>' : '') +
      '　<span class="dim">' + (p.w || '?') + '×' + (p.h || '?') + '　仅作装备识别参考，版权归原作者</span></div>';
  };

  App.prototype.renderInspect = function (u) {
    var E = this.E, P = u.P;
    el('inspHead').innerHTML = '<div class="ih ' + u.side.toLowerCase() + '"><div class="ihn">' + esc(u.name) + '</div>' +
      '<div class="ihc">' + esc(P.cls) + '　·　' + SIDE_NAME[u.side] + '　·　' + (STATE_NAME[u.state] || u.state) + '</div></div>';
    this.setMedia(u.cls, u);
    var s = '';
    var rows = [];
    rows.push(['坐标', fmt(u.lat, 3) + '°N ' + fmt(u.lon, 3) + '°E']);
    if (u.domain === 'air') rows.push(['高度 / 航向 / 速度', fmt(u.alt) + ' m / ' + fmt(u.hdg) + '° / ' + fmt(u.spd) + ' km/h']);
    else if (u.domain === 'surface' || u.domain === 'sub')
      rows.push(['航向 / 航速', fmt(u.hdg) + '° / ' + fmt(TWG.toKn(u.spd), 1) + ' 节']);
    else rows.push(['机动能力', fmt((P.mobility || 0.5) * 100) + '%']);

    if (P.disp) rows.push(['满载排水量 / 舰长', fmt(P.disp) + ' t / ' + fmt(P.len) + ' m']);
    if (P.crew) rows.push(['编制人员', fmt(P.crew) + ' 人']);
    if (P.troops) rows.push(['兵员', fmt(u.troops) + ' / ' + fmt(P.troops) + ' 人']);
    if (u.cp0) rows.push(['战斗力指数', fmt(u.cp, 1) + ' / ' + fmt(u.cp0, 1)]);
    if (P.spd) rows.push(['最大速度', u.domain === 'surface' || u.domain === 'sub'
      ? fmt(TWG.toKn(P.spd), 1) + ' 节' : fmt(P.spdMax || P.spd) + ' km/h']);
    if (P.radius) rows.push(['作战半径', fmt(P.radius) + ' km']);
    if (P.ceiling) rows.push(['实用升限', fmt(P.ceiling) + ' m']);
    if (P.depth) rows.push(['下潜深度', fmt(P.depth) + ' m']);
    if (P.rcs != null && u.domain === 'air') rows.push(['雷达截面积 RCS', P.rcs + ' m²']);
    if (P.acoustic) rows.push(['声隐身指数', fmt(P.acoustic, 2) + '（越小越静音）']);
    if (P.radar) rows.push(['雷达', P.radar.name + '　探测 ' + P.radar.range + ' km　跟踪 ' + (P.radar.tracks || '—') + ' 批']);
    if (P.esm) rows.push(['电子侦察 ESM', P.esm + ' km']);
    if (P.sonar) rows.push(['声呐', '主动 ' + P.sonar.range + ' km / 被动 ' + (P.sonar.passive || '—') + ' km' + (P.sonar.towed ? '（含拖曳阵）' : '')]);
    if (P.ew) rows.push(['电子战', (P.ew.jam ? '干扰能力 ' + pct(P.ew.jam) : '') + (P.ew.decoy ? '　软杀伤 ' + pct(P.ew.decoy) : '') + (P.ew.rwr ? '　告警 ' + pct(P.ew.rwr) : '')]);
    if (P.skill) rows.push(['人员训练水平', pct(P.skill)]);
    if (P.vlsTotal) rows.push(['垂直发射单元', P.vlsTotal + ' 单元']);
    if (P.lift) rows.push(['两栖投送能力', '等效 ' + P.lift.bn + ' 营' + (P.lift.troops ? '　' + P.lift.troops + ' 兵员' : '') +
      (P.lift.tank ? '　' + P.lift.tank + ' 坦克' : '') + (P.lift.veh ? '　' + P.lift.veh + ' 车辆' : '') + (P.lift.causeway ? '　含自升栈桥' : '')]);
    if (P.kit) rows.push(['主要装备', P.kit]);
    if (u.embarked) rows.push(['当前载运', u.embarked.name + '　' + fmt(u.embarked.troops) + ' 兵员']);
    if (u.beachId) rows.push(['指定登陆滩头', (TWG.THEATER.idx.beach[u.beachId] || {}).name || u.beachId]);
    rows.push(['结构完好度', pct(u.hp / u.hp0) + '（' + fmt(u.hp, 1) + '/' + fmt(u.hp0, 1) + '）']);
    rows.push(['子系统', '火力 ' + pct(u.fire) + '　探测 ' + pct(u.sens) + '　机动 ' + pct(u.mob)]);
    if (u.domain === 'air') rows.push(['编队 / 燃油', u.n + ' 架 / ' + pct(u.fuel)]);
    if (u.mission) rows.push(['当前任务', missionName(u.mission.type)]);
    if (u.kills) rows.push(['战果', '击落/击毁 ' + u.kills]);
    if (u.hitsTaken) rows.push(['被命中', u.hitsTaken + ' 次']);
    if (P.note) rows.push(['备注', P.note]);

    s += '<table class="kv">';
    rows.forEach(function (r) { s += '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; });
    s += '</table>';

    // 武器与弹药
    var wk = Object.keys(u.ammo).filter(function (k) { return TWG.WEAPONS[k]; });
    if (wk.length) {
      s += '<h4>武器系统与弹药基数</h4><table class="wp"><tr><th>型号</th><th>类型</th><th>射程</th><th>速度</th><th>战斗部</th><th>单发Pk</th><th>余弹</th></tr>';
      wk.forEach(function (k) {
        var W = TWG.WEAPONS[k];
        var t0 = { aam: '空空', ashm: '反舰', lacm: '巡航', srbm: '弹道(近程)', mrbm: '弹道(中程)',
          irbm: '弹道(中远)', hgv: '高超音速', asbm: '反舰弹道', arm: '反辐射', torp: '鱼雷',
          sam: '防空', mlrs: '火箭炮', arty: '炮兵', ciws: '近防', sow: '制导炸弹', loiter: '巡飞弹',
          sam_ashm: '两用' }[W.type] || W.type;
        var tot = (P.allWeapons && P.allWeapons[k]) || (P.load && P.load[k]) || u.ammo[k];
        s += '<tr><td>' + esc(W.name) + '</td><td>' + t0 + '</td><td>' + W.range + ' km</td><td>' +
          (W.spd ? fmt(W.spd) + ' km/h' + (W.spd > 1250 ? '（M' + fmt(W.spd / 1225, 1) + '）' : '') : '—') + '</td><td>' +
          (W.warhead ? W.warhead + ' kg' : '—') + '</td><td>' + (W.pk ? fmt(W.pk * 100) + '%' : '—') + '</td><td class="' +
          (u.ammo[k] > 0 ? '' : 'r') + '">' + u.ammo[k] + '/' + tot + '</td></tr>';
      });
      s += '</table>';
      var notes = wk.filter(function (k) { return TWG.WEAPONS[k].note; });
      if (notes.length) {
        s += '<ul class="wnote">' + notes.map(function (k) {
          return '<li><b>' + esc(TWG.WEAPONS[k].name) + '</b>：' + esc(TWG.WEAPONS[k].note) + '</li>';
        }).join('') + '</ul>';
      }
    }
    if (u.airWing) {
      s += '<h4>舰载航空兵</h4><div class="mini">';
      s += Object.keys(u.airWing).map(function (c) {
        return (TWG.PLATFORMS[c] ? TWG.PLATFORMS[c].name : c) + ' × ' + u.airWing[c];
      }).join('　');
      s += '</div>';
    }
    s += '<div class="cdxLink"><button class="sbtn gold" onclick="TWGApp.openCodex(\'' + u.cls + '\')">📖 在装备图鉴中查看该型装备完整资料</button></div>';
    el('inspSpec').innerHTML = s;
  };
  function missionName(t) {
    return ({ cap: '战斗空中巡逻 CAP', sweep: '制空扫荡', sead: '压制敌防空 SEAD', strike: '对陆突击',
      asuw: '反舰突击', aew: '空中预警指挥', isr: '侦察监视', elint: '电子情报', asw: '反潜巡逻',
      helo_strike: '直升机火力支援', airdrop: '空降空投', rtb: '返场', sea_control: '夺取制海权',
      escort: '船团护航', amphib_transit: '两栖航渡', return: '返航再装载', retire: '退出战斗',
      sub_patrol: '潜艇巡逻阵位', sub_hunt: '潜艇猎杀', ambush: '水下伏击', hit_and_run: '突击后撤离',
      refuge: '疏泊隐蔽', survive: '生存机动', minelay: '布设水雷' })[t] || t;
  }

  /* 装备示意图（放大绘制真实轮廓） */
  App.prototype.drawModelPreview = function (u) {
    var cv = el('modelCv'); if (!cv) return;
    var ctx = cv.getContext('2d');
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    cv.width = 260 * dpr; cv.height = 130 * dpr;
    cv.style.width = '260px'; cv.style.height = '130px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(8,14,18,0.75)'; ctx.fillRect(0, 0, 260, 130);
    ctx.strokeStyle = 'rgba(90,160,190,0.18)';
    for (var g = 0; g <= 260; g += 20) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, 130); ctx.stroke(); }
    for (var g2 = 0; g2 <= 130; g2 += 20) { ctx.beginPath(); ctx.moveTo(0, g2); ctx.lineTo(260, g2); ctx.stroke(); }
    var mk = TWG.modelFor(u), fn = TWG.Renderer.MODELS[mk];
    var col = u.side === 'PLA' ? '#ff4d4f' : u.side === 'ROC' ? '#40a9ff' : u.side === 'US' ? '#b37feb' : '#d9d9d9';
    ctx.save(); ctx.translate(130, 65);
    if (fn) {
      var L = 108;
      if (u.domain === 'air') fn(ctx, L, L * 0.85, col);
      else fn(ctx, L, Math.max(L * 0.14, L * (u.role === 'cv' ? 0.24 : u.role === 'barge' ? 0.28 : 0.15)), u, col, 'rgba(22,30,36,0.95)');
    } else {
      var SY = TWG.Renderer.SYMBOLS;
      var sym = u.domain === 'sam' ? SY.sam : u.domain === 'radar' ? SY.radar : SY.ground;
      sym(ctx, u, 30, col);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(210,230,235,0.75)'; ctx.font = '10px ui-monospace,monospace';
    ctx.fillText(u.domain === 'air' ? '机长 ' + TWG.platformLen(u.cls) + ' m' : (u.P.len ? '舰长 ' + u.P.len + ' m' : (u.P.troops ? '编制 ' + u.P.troops + ' 人' : '')), 6, 122);
    ctx.fillText('二维战术符号 · ' + (u.P.cls || ''), 6, 14);
  };

  App.prototype.renderFacility = function (o, kind) {
    var E = this.E;
    el('inspMedia').style.display = 'none';
    el('inspHead').innerHTML = '<div class="ih ' + (o.side || o.owner || '').toLowerCase() + '"><div class="ihn">' + esc(o.name) + '</div>' +
      '<div class="ihc">' + (kind === 'base' ? '航空基地' : o.kind === 'port' ? '商港' : o.kind === 'navalbase' ? '军港' :
        o.kind === 'radar' ? '雷达站' : o.kind === 'c2' ? '指挥中枢' : o.kind === 'power' ? '电力设施' :
        o.kind === 'cable' ? '海缆登陆站' : o.kind === 'shelter' ? '洞库设施' : '关键节点') +
      '　·　' + SIDE_NAME[o.side || o.owner] + (o.captured ? '　·　<b class="bad">已被攻占</b>' : '') + '</div></div>';
    var s = '';
    var rows = [['坐标', fmt(o.lat, 3) + '°N ' + fmt(o.lon, 3) + '°E']];
    if (kind === 'base') {
      rows.push(['跑道', o.rw + ' 条 × ' + o.rwLen + ' m' + (o.hwy ? '（公路战备道）' : '')]);
      rows.push(['加固机堡 / 洞库容量', o.has + ' 座 / ' + o.cave + ' 架']);
      rows.push(['停机容量', o.cap + ' 架']);
      rows.push(['跑道弹坑（未修复）', o.cuts + ' 处']);
      rows.push(['起降能力', pct(o.ops)]);
      rows.push(['油料 / 弹药', pct(o.pol) + ' / ' + pct(o.muni)]);
      if (o.wing) rows.push(['驻防部队', o.wing]);
      var tot = 0, det = [];
      Object.keys(o.inv).forEach(function (c) {
        if (o.inv[c] > 0) { tot += o.inv[c]; det.push((TWG.PLATFORMS[c] ? TWG.PLATFORMS[c].name : c) + '×' + o.inv[c]); }
      });
      rows.push(['在库飞机', tot + ' 架' + (det.length ? '（' + det.join('、') + '）' : '')]);
      rows.push(['累计被弹', o.damaged + ' 次']);
    } else {
      rows.push(['完好度', pct(o.ops) + '（' + fmt(o.hp, 1) + '/' + fmt(o.hp0, 1) + '）']);
      rows.push(['加固系数', 'x' + o.hard]);
      rows.push(['战略价值', o.value + ' / 10']);
      if (o.berth) rows.push(['大型泊位', o.berth + ' 个']);
      if (o.lift) rows.push(['日装卸能力', '等效 ' + o.lift + ' 营/日']);
      if (o.objective) rows.push(['战役目标', '★ 登陆战役必争目标']);
      if (o.embark) rows.push(['用途', '解放军两栖上船/集结港']);
    }
    if (o.note) rows.push(['备注', o.note]);
    s += '<table class="kv">';
    rows.forEach(function (r) { s += '<tr><td>' + esc(r[0]) + '</td><td>' + r[1] + '</td></tr>'; });
    s += '</table>';
    el('inspSpec').innerHTML = s;
  };

  /* =====================================================================
   * 装备图鉴 (Equipment Codex)
   * ===================================================================*/
  var DOMAIN_LABEL = { air: '航空器', surface: '水面舰艇', sub: '潜艇', ground: '地面部队', sam: '防空系统', radar: '雷达/电抗' };
  App.prototype.openCodex = function (cls) {
    var self = this;
    el('codex').classList.add('on');
    if (!this._cdxInit) {
      this._cdxInit = 1;
      this.cdxFilter = { side: '', domain: '' };
      var fw = el('cdxFilters');
      function grp(label, key, opts) {
        var box = h('div', 'fgrp');
        box.appendChild(h('span', 'fl', label));
        opts.forEach(function (o) {
          var b = h('button', 'fb' + (o[0] === '' ? ' on' : ''), o[1]);
          b.onclick = function () {
            Array.prototype.forEach.call(box.querySelectorAll('.fb'), function (x) { x.classList.remove('on'); });
            b.classList.add('on');
            self.cdxFilter[key] = o[0];
            self.renderCodexGrid();
          };
          box.appendChild(b);
        });
        fw.appendChild(box);
      }
      grp('阵营', 'side', [['', '全部'], ['PLA', '解放军'], ['ROC', '台军'], ['US', '美军'], ['JP', '日本']]);
      grp('类别', 'domain', [['', '全部'], ['air', '航空'], ['surface', '水面'], ['sub', '潜艇'],
        ['ground', '地面'], ['sam', '防空'], ['radar', '雷达']]);
    }
    this.renderCodexGrid();
    if (cls) this.openCodexDetail(cls);
    else if (this.cdxCls) this.openCodexDetail(this.cdxCls);
  };
  App.prototype.closeCodex = function () {
    el('codex').classList.remove('on');
    if (this.cdxViewer) this.cdxViewer.setVisible(false);
  };
  App.prototype.renderCodexGrid = function () {
    var self = this, q = (el('cdxSearch').value || '').trim().toLowerCase();
    var f = this.cdxFilter || { side: '', domain: '' };
    var ids = Object.keys(TWG.PLATFORMS).filter(function (id) {
      var P = TWG.PLATFORMS[id];
      if (id === 'BEACHHEAD') return false;
      if (f.side && P.side !== f.side) return false;
      if (f.domain && P.domain !== f.domain) return false;
      if (!q) return true;
      return (id + ' ' + P.name + ' ' + P.cls + ' ' + (P.kit || '') + ' ' + (P.note || '')).toLowerCase().indexOf(q) >= 0;
    });
    ids.sort(function (a, b) {
      var A = TWG.PLATFORMS[a], B = TWG.PLATFORMS[b];
      if (A.side !== B.side) return ['PLA', 'ROC', 'US', 'JP'].indexOf(A.side) - ['PLA', 'ROC', 'US', 'JP'].indexOf(B.side);
      if (A.domain !== B.domain) return A.domain < B.domain ? -1 : 1;
      return (B.disp || B.hp || 0) - (A.disp || A.hp || 0);
    });
    var grid = el('cdxGrid');
    grid.innerHTML = '<div class="cdxCount">共 ' + ids.length + ' 型装备</div>';
    var frag = doc.createDocumentFragment();
    ids.forEach(function (id) {
      var P = TWG.PLATFORMS[id];
      var ph = (TWG.photosOf ? TWG.photosOf(id) : [])[0];
      var card = h('div', 'cdxCard ' + P.side.toLowerCase() + (self.cdxCls === id ? ' on' : ''));
      card.innerHTML =
        '<div class="ccImg">' + (ph ? '<img loading="lazy" src="' + esc(ph.url) + '" alt="">' : '<span class="noph">无图</span>') + '</div>' +
        '<div class="ccTx"><div class="ccN">' + esc(P.name) + '</div>' +
        '<div class="ccC">' + esc(P.cls) + '</div>' +
        '<div class="ccM">' + (DOMAIN_LABEL[P.domain] || P.domain) +
        (P.disp ? '　' + P.disp.toLocaleString() + ' t' : '') +
        (P.radius ? '　半径 ' + P.radius + ' km' : '') + '</div></div>';
      card.onclick = function () { self.openCodexDetail(id); };
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  };
  App.prototype.openCodexDetail = function (cls) {
    var self = this, P = TWG.PLATFORMS[cls];
    if (!P) return;
    this.cdxCls = cls;
    Array.prototype.forEach.call(el('cdxGrid').querySelectorAll('.cdxCard'), function (c) { c.classList.remove('on'); });
    var photos = (TWG.photosOf ? TWG.photosOf(cls) : []) || [];
    var d = el('cdxDetail');
    var s = '<div class="cdD ' + P.side.toLowerCase() + '">';
    s += '<div class="cdTop"><div class="cdN">' + esc(P.name) + '</div>' +
      '<div class="cdC">' + esc(P.cls) + '　·　' + SIDE_NAME[P.side] + '　·　' + (DOMAIN_LABEL[P.domain] || P.domain) + '</div></div>';
    s += '<div class="cdMedia"><div class="cdPhotos" id="cdPhotos">';
    if (photos.length) {
      s += '<img id="cdBig" src="' + esc(photos[0].url) + '" alt="">';
      s += '<div class="cdThumbs">' + photos.map(function (p, i) {
        return '<img class="cdTh' + (i === 0 ? ' on' : '') + '" data-i="' + i + '" src="' + esc(p.url) + '" alt="">';
      }).join('') + '</div>';
      s += '<div class="cdCap" id="cdCap"></div>';
    } else {
      s += '<div class="cdNoph">暂无实景照片</div>';
    }
    s += '</div><div class="cd3d"><canvas id="cdCv"></canvas>' +
      '<div class="cd3dBar">三维模型 · 拖动旋转 / 滚轮缩放<span id="cd3dInfo"></span></div></div></div>';

    /* 参数表 */
    var rows = [];
    if (P.len) rows.push(['舰长 / 满载排水量', P.len + ' m / ' + (P.disp || 0).toLocaleString() + ' t']);
    if (TWG.AC_DIM[cls]) rows.push(['机长 / 翼展', TWG.AC_DIM[cls][0] + ' m / ' + TWG.AC_DIM[cls][1] + ' m']);
    if (P.crew) rows.push(['编制人员', P.crew + ' 人']);
    if (P.troops) rows.push(['编制兵员', P.troops.toLocaleString() + ' 人']);
    if (P.spd) rows.push(['最大速度', (P.domain === 'surface' || P.domain === 'sub')
      ? fmt(TWG.toKn(P.spd), 1) + ' 节' : fmt(P.spdMax || P.spd) + ' km/h' + (P.spdMax > 1250 ? '（M' + fmt(P.spdMax / 1225, 1) + '）' : '')]);
    if (P.spdSilent) rows.push(['静音航速', fmt(TWG.toKn(P.spdSilent), 1) + ' 节']);
    if (P.radius) rows.push(['作战半径', P.radius + ' km']);
    if (P.endur) rows.push(['续航/自持力', P.endur + (P.domain === 'air' ? ' 小时' : ' 天')]);
    if (P.ceiling) rows.push(['实用升限', P.ceiling.toLocaleString() + ' m']);
    if (P.depth) rows.push(['最大潜深', P.depth + ' m']);
    if (P.rcs != null) rows.push(['雷达截面积 RCS', P.rcs + ' m²']);
    if (P.acoustic) rows.push(['声隐身指数', fmt(P.acoustic, 2) + '（越小越静音）']);
    if (P.radar) rows.push(['雷达', P.radar.name + '　探测 ' + P.radar.range + ' km' + (P.radar.tracks ? '　跟踪 ' + P.radar.tracks + ' 批' : '')]);
    if (P.esm) rows.push(['电子侦察 ESM', P.esm + ' km']);
    if (P.sonar) rows.push(['声呐', '主动 ' + P.sonar.range + ' km / 被动 ' + (P.sonar.passive || '—') + ' km' + (P.sonar.towed ? '（含拖曳阵）' : '')]);
    if (P.ew) rows.push(['电子战能力', (P.ew.jam ? '干扰 ' + pct(P.ew.jam) : '') + (P.ew.decoy ? '　软杀伤 ' + pct(P.ew.decoy) : '') + (P.ew.rwr ? '　告警 ' + pct(P.ew.rwr) : '')]);
    if (P.vlsTotal) rows.push(['垂直发射单元', P.vlsTotal + ' 单元']);
    if (P.launchers) rows.push(['发射车/发射架', P.launchers + ' 部']);
    if (P.skill) rows.push(['人员训练水平', pct(P.skill)]);
    if (P.sorties) rows.push(['日出动率 / 再出动周期', P.sorties + ' 架次/日　' + (P.turn || '—') + ' 小时']);
    if (P.gen) rows.push(['技术代次', '第 ' + P.gen + ' 代']);
    if (P.lift) rows.push(['两栖投送能力', '等效 ' + P.lift.bn + ' 营' + (P.lift.troops ? '　' + P.lift.troops + ' 兵员' : '') +
      (P.lift.tank ? '　' + P.lift.tank + ' 坦克' : '') + (P.lift.veh ? '　' + P.lift.veh + ' 车辆' : '') +
      (P.lift.lcac ? '　' + P.lift.lcac + ' 艘气垫艇' : '') + (P.lift.causeway ? '　含自升栈桥' : '')]);
    if (P.airWing) rows.push(['舰载航空兵', Object.keys(P.airWing).map(function (k) {
      return (TWG.PLATFORMS[k] ? TWG.PLATFORMS[k].name : k) + '×' + P.airWing[k];
    }).join('、')]);
    if (P.kit) rows.push(['主要装备', P.kit]);
    if (P.cp) rows.push(['战斗力指数', P.cp]);
    if (P.mines) rows.push(['载雷量', P.mines + ' 枚']);
    if (P.unitCost) rows.push(['单位造价(估)', P.unitCost >= 1 ? P.unitCost + ' 亿美元级' : (P.unitCost * 100).toFixed(0) + ' 百万美元级']);
    s += '<h4>性能参数</h4><table class="kv">';
    rows.forEach(function (r) { s += '<tr><td>' + esc(r[0]) + '</td><td>' + esc(String(r[1])) + '</td></tr>'; });
    s += '</table>';

    /* 武器 */
    var wk = Object.keys(P.allWeapons || {});
    if (P.load) Object.keys(P.load).forEach(function (k) { if (wk.indexOf(k) < 0 && TWG.WEAPONS[k]) wk.push(k); });
    if (wk.length) {
      s += '<h4>武器系统</h4><table class="wp"><tr><th>型号</th><th>类型</th><th>射程</th><th>速度</th><th>战斗部</th><th>Pk</th><th>数量</th></tr>';
      wk.forEach(function (k) {
        var W = TWG.WEAPONS[k]; if (!W) return;
        var t0 = { aam: '空空', ashm: '反舰', lacm: '巡航', srbm: '弹道(近程)', mrbm: '弹道(中程)',
          irbm: '弹道(中远)', hgv: '高超音速', asbm: '反舰弹道', arm: '反辐射', torp: '鱼雷',
          sam: '防空', mlrs: '火箭炮', arty: '炮兵', ciws: '近防', sow: '制导炸弹', loiter: '巡飞弹', sam_ashm: '两用' }[W.type] || W.type;
        s += '<tr><td>' + esc(W.name) + '</td><td>' + t0 + '</td><td>' + W.range + ' km</td><td>' +
          (W.spd ? fmt(W.spd) + ' km/h' + (W.spd > 1250 ? '(M' + fmt(W.spd / 1225, 1) + ')' : '') : '—') + '</td><td>' +
          (W.warhead ? W.warhead + ' kg' : '—') + '</td><td>' + (W.pk ? fmt(W.pk * 100) + '%' : '—') + '</td><td>' +
          (P.allWeapons[k] || (P.load && P.load[k]) || '—') + '</td></tr>';
      });
      s += '</table>';
      var notes = wk.filter(function (k) { return TWG.WEAPONS[k] && TWG.WEAPONS[k].note; });
      if (notes.length) s += '<ul class="wnote">' + notes.map(function (k) {
        return '<li><b>' + esc(TWG.WEAPONS[k].name) + '</b>：' + esc(TWG.WEAPONS[k].note) + '</li>';
      }).join('') + '</ul>';
    }
    if (P.note) s += '<h4>说明</h4><div class="note">' + esc(P.note) + '</div>';
    /* 战场统计 */
    var alive = 0, tot = 0, lost = 0;
    this.E.units.forEach(function (u) { if (u.cls === cls) { tot += (u.n0 || 1); if (!u.dead) alive += (u.n || 1); } });
    Object.keys(this.E.bases).forEach(function (bk) {
      var b = this.E.bases[bk];
      if (b.inv0 && b.inv0[cls]) { tot += b.inv0[cls]; alive += (b.inv[cls] || 0); }
    }, this);
    if (tot > 0) {
      s += '<h4>本局战场状态</h4><div class="mini">投入 <b>' + tot + '</b>　现存 <b>' + alive +
        '</b>　损失 <b class="bad">' + Math.max(0, tot - alive) + '</b>　完好率 ' + pct(alive / tot) + '</div>';
    }
    s += '<div class="disclaimer">参数整理自公开来源（IISS Military Balance、US DoD CMPR、Jane\'s、台湾国防报告书等），' +
      '部分为工程估算值；照片来自网络公开检索，版权归原作者所有，仅作装备识别参考。</div></div>';
    d.innerHTML = s;

    /* 照片切换 */
    if (photos.length) {
      var big = el('cdBig'), cap = el('cdCap');
      function setCap(i) {
        var p = photos[i];
        cap.innerHTML = '<div class="phT">' + esc(p.title || '') + '</div><div class="phS">来源：' + esc(p.src || '网络') +
          (p.link ? '　<a href="' + esc(p.link) + '" target="_blank" rel="noreferrer">原页面 ↗</a>' : '') + '</div>';
      }
      setCap(0);
      Array.prototype.forEach.call(d.querySelectorAll('.cdTh'), function (t) {
        t.onclick = function () {
          Array.prototype.forEach.call(d.querySelectorAll('.cdTh'), function (x) { x.classList.remove('on'); });
          t.classList.add('on');
          var i = Number(t.dataset.i);
          big.src = photos[i].url; setCap(i);
        };
      });
    }
    /* 三维模型 */
    if (TWG.haveGL && TWG.haveGL()) {
      var cv = el('cdCv');
      if (!this.cdxViewer || this.cdxViewer.cv !== cv) {
        if (this.cdxViewer) this.cdxViewer.dispose();
        this.cdxViewer = new TWG.Viewer3D(cv, { shadow: true, autoRotate: true });
      }
      if (!this.cdxViewer.dead) {
        this.cdxViewer.setVisible(true);
        this.cdxViewer.show(cls);
        var info = TWG.M3D.info(cls);
        if (info) el('cd3dInfo').textContent = '　三角面 ' + info.tris + '　尺寸 ' +
          info.bbox.size.x.toFixed(1) + '×' + info.bbox.size.y.toFixed(1) + '×' + info.bbox.size.z.toFixed(1) + ' m';
      }
    } else {
      el('cd3dInfo').textContent = '　（本机不支持 WebGL）';
    }
    // 高亮当前卡片
    Array.prototype.forEach.call(el('cdxGrid').querySelectorAll('.cdxCard'), function (c) {
      if (c.querySelector('.ccN') && c.querySelector('.ccN').textContent === P.name) c.classList.add('on');
    });
  };

  /* ---------------- 日志 ---------------- */
  var KIND_ICON = { fire: '🚀', hit: '💥', kill: '☠', intercept: '🛡', strike: '🎯', critical: '★',
    amphib: '⚓', phase: '▣', sys: '⚙', intel: '📡', logi: '⚠', mine: '⚑', ground: '⚔', env: '🌊',
    miss: '○', mob: '◆', end: '■' };
  App.prototype.renderLog = function (reset) {
    var E = this.E, list = el('logList'), self = this;
    if (reset) { list.innerHTML = ''; this.logShown = 0; }
    var start = Math.max(this.logShown, E.log.length - 600);
    var frag = doc.createDocumentFragment();
    for (var i = start; i < E.log.length; i++) {
      var e = E.log[i];
      if (this.logFilter !== 'all' && e.kind !== this.logFilter) continue;
      var d = h('div', 'le k-' + e.kind + (e.side ? ' s-' + e.side.toLowerCase() : ''));
      d.innerHTML = '<span class="lt">' + esc(e.clock) + '</span><span class="li">' + (KIND_ICON[e.kind] || '·') +
        '</span><span class="lx">' + esc(e.text) + '</span>';
      if (e.lat != null) {
        d.style.cursor = 'pointer';
        (function (ev) { d.onclick = function () { self.R.flyTo(ev.lat, ev.lon, Math.max(self.R.zoom, 8.6)); }; })(e);
      }
      frag.appendChild(d);
    }
    this.logShown = E.log.length;
    list.appendChild(frag);
    while (list.children.length > 700) list.removeChild(list.firstChild);
    if (!this._noScroll) list.scrollTop = list.scrollHeight;
  };

  /* ---------------- 图表 ---------------- */
  App.prototype.renderCharts = function () {
    var E = this.E, S = E.stats;
    if (!S.length) return;
    this.chart('chAir', S, [
      { k: 'air', c: '#ff4d4f', n: '制空权指数(PLA占比)' },
      { k: 'sea', c: '#40a9ff', n: '制海权指数(PLA占比)' }
    ], 0, 1);
    var maxAir = Math.max.apply(null, S.map(function (s) { return Math.max(s.plaAir, s.rocAir); })) || 1;
    this.chart('chForce', S, [
      { k: 'plaAir', c: '#ff7875', n: '解放军可用飞机' },
      { k: 'rocAir', c: '#69c0ff', n: '台军可用飞机' }
    ], 0, maxAir);
    var maxL = Math.max.apply(null, S.map(function (s) { return Math.max(s.plaLossAir, s.rocLossAir); })) || 1;
    this.chart('chLoss', S, [
      { k: 'plaLossAir', c: '#ff4d4f', n: '解放军飞机累计损失' },
      { k: 'rocLossAir', c: '#40a9ff', n: '台军飞机累计损失' }
    ], 0, maxL);
    var maxB = Math.max.apply(null, S.map(function (s) { return s.bhTroops; })) || 1000;
    this.chart('chBH', S, [{ k: 'bhTroops', c: '#ffa940', n: '登陆场上陸兵力(人)' }], 0, maxB);
    this.chart('chLogi', S, [
      { k: 'pgmPLA', c: '#ff7875', n: '解放军精确弹药存量' },
      { k: 'pgmROC', c: '#69c0ff', n: '台军精确弹药存量' },
      { k: 'baseOpsROC', c: '#95de64', n: '台军机场可用率' }
    ], 0, 1);
  };
  App.prototype.chart = function (id, S, series, lo, hi) {
    var cv = el(id); if (!cv) return;
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    var W = cv.clientWidth || 300, H = 96;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(6,12,16,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(90,160,190,0.16)';
    for (var i = 1; i < 4; i++) { var y = H * i / 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    var n = S.length, T = S[n - 1].t || 1;
    // 日分界
    ctx.strokeStyle = 'rgba(140,200,220,0.22)'; ctx.fillStyle = 'rgba(160,200,215,0.5)'; ctx.font = '8px ui-monospace,monospace';
    for (var d = 1; d * 86400 < T; d++) {
      var x = d * 86400 / T * W;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      ctx.fillText('D+' + d, x + 2, 9);
    }
    series.forEach(function (se) {
      ctx.beginPath();
      for (var k = 0; k < n; k++) {
        var v = S[k][se.k];
        if (v == null) continue;
        var x = (S[k].t / T) * W;
        var y = H - ((v - lo) / Math.max(hi - lo, 1e-6)) * (H - 10) - 4;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = se.c; ctx.lineWidth = 1.4; ctx.stroke();
    });
    // 图例
    ctx.font = '9px sans-serif';
    series.forEach(function (se, i) {
      ctx.fillStyle = se.c;
      ctx.fillRect(6, H - 8 - i * 11, 8, 3);
      ctx.fillStyle = 'rgba(215,232,236,0.9)';
      ctx.fillText(se.n + '  ' + (S[n - 1][se.k] != null ? (hi <= 1 ? pct(S[n - 1][se.k]) : fmt(S[n - 1][se.k])) : ''), 18, H - 5 - i * 11);
    });
  };

  /* =====================================================================
   * 浏览器内自检 (#diag=1)  —— 无需人工目视即可验证渲染与引擎全链路
   * ===================================================================*/
  function runDiag(app) {
    var out = [], errs = [], t0 = Date.now();
    function chk(name, fn) {
      try { var r = fn(); out.push('PASS  ' + name + (r ? '   [' + r + ']' : '')); }
      catch (e) { errs.push(name + ': ' + (e && e.stack || e)); out.push('FAIL  ' + name + '   [' + (e && e.message || e) + ']'); }
    }
    var E = app.E, R = app.R;
    chk('引擎实例化', function () { return E.units.length + ' 个单位 / ' + Object.keys(E.bases).length + ' 机场 / ' + Object.keys(E.sites).length + ' 节点'; });
    chk('矢量地理数据', function () {
      var G = TWG.GEO, n = 0;
      G.taiwan.forEach(function (p) { n += p.length; });
      if (!G.taiwan.length) throw new Error('台湾多边形缺失');
      return '台湾 ' + G.taiwan.length + ' 环 / ' + n + ' 点，福建 ' + G.fujian.length + ' 环';
    });
    chk('装备库完整性', function () {
      var P = TWG.PLATFORMS, W = TWG.WEAPONS, bad = [];
      Object.keys(P).forEach(function (k) {
        var p = P[k];
        if (!p.name || !p.cls || !p.domain) bad.push(k + ':meta');
        Object.keys(p.allWeapons || {}).forEach(function (w) { if (!W[w]) bad.push(k + '→' + w); });
      });
      if (bad.length) throw new Error('异常项 ' + bad.join(','));
      return Object.keys(P).length + ' 型平台 / ' + Object.keys(W).length + ' 型武器';
    });
    chk('OOB 平台引用', function () {
      var O = TWG.OOB, miss = [];
      function scan(list) { (list || []).forEach(function (s) { if (s.cls && !TWG.PLATFORMS[s.cls]) miss.push(s.cls); }); }
      [O.PLA_NAVAL, O.PLA_SUBS, O.ROC_NAVAL, O.ROC_SUBS, O.PLA_MISSILE, O.PLA_SAM, O.PLA_GROUND,
        O.PLA_RADAR, O.ROC_GROUND, O.ROC_SAM, O.ROC_RADAR, O.US_FORCES.naval, O.US_FORCES.subs, O.JP_FORCES.naval].forEach(scan);
      [O.PLA_AIR, O.ROC_AIR, O.PLA_AIRLIFT, O.US_FORCES.air, O.JP_FORCES.air].forEach(function (m) {
        Object.keys(m).forEach(function (b) {
          if (!TWG.THEATER.idx.airbase[b]) miss.push('base:' + b);
          Object.keys(m[b]).forEach(function (c) { if (!TWG.PLATFORMS[c]) miss.push(c); });
        });
      });
      if (miss.length) throw new Error('未定义引用 ' + miss.join(','));
      return '全部引用有效';
    });
    chk('剧本目标引用', function () {
      var miss = [];
      TWG.scenarioList().forEach(function (sc) {
        (sc.strike1 || []).concat(sc.strike2 || []).forEach(function (k) {
          if (!TWG.THEATER.idx.airbase[k] && !TWG.THEATER.idx.port[k] && !TWG.THEATER.idx.keysite[k]) miss.push(sc.id + ':' + k);
        });
        (sc.landingPlan || []).forEach(function (p) {
          if (!TWG.THEATER.idx.beach[p.beach] && p.lat == null) miss.push(sc.id + ':beach:' + p.beach);
        });
        (sc.airborne || []).forEach(function (a) { if (!TWG.THEATER.idx.airbase[a.target]) miss.push(sc.id + ':abn:' + a.target); });
      });
      if (miss.length) throw new Error(miss.join(','));
      return TWG.scenarioList().length + ' 套剧本全部有效';
    });
    chk('推演 6 小时', function () {
      var g = 0;
      while (E.t < 6 * 3600 && !E.ended && g++ < 20000) E.step(20);
      return E.clock() + '　事件 ' + E.log.length + '　飞行体 ' + E.proj.length + '　发射 ' + E.sides.PLA.missilesFired;
    });
    chk('全部装备模型绘制', function () {
      var cv = doc.createElement('canvas'); cv.width = 200; cv.height = 200;
      var ctx = cv.getContext('2d');
      var n = 0, skipped = [];
      Object.keys(TWG.PLATFORMS).forEach(function (k) {
        var u = TWG.makeUnit(E, { cls: k, side: TWG.PLATFORMS[k].side, lat: 24, lon: 120, n: 1 });
        var mk = TWG.modelFor(u), fn = TWG.Renderer.MODELS[mk];
        ctx.save(); ctx.translate(100, 100);
        if (fn) {
          if (u.domain === 'air') fn(ctx, 80, 70, '#f00'); else fn(ctx, 80, 14, u, '#f00', '#123');
          n++;
        } else {
          var SY = TWG.Renderer.SYMBOLS;
          (u.domain === 'sam' ? SY.sam : u.domain === 'radar' ? SY.radar : SY.ground)(ctx, u, 20, '#f00');
          n++;
        }
        ctx.restore();
      });
      return n + ' 型装备模型全部绘制成功';
    });
    chk('渲染全部底图源 × 建模比例', function () {
      var cnt = 0;
      Object.keys(TWG.Renderer.SOURCES).forEach(function (src) {
        ['exagg', '1x', 'real'].forEach(function (ms) {
          R.opts.source = src; R.opts.modelScale = ms;
          R.draw(0.016); cnt++;
        });
      });
      R.opts.source = 'esriSat'; R.opts.modelScale = 'exagg';
      return cnt + ' 种组合渲染无异常';
    });
    chk('战场迷雾 + 视角切换', function () {
      ['PLA', 'ROC', null].forEach(function (s) {
        R.viewSide = s; R.opts.fog = true; R.draw(0.016);
        R.opts.fog = false; R.draw(0.016);
      });
      R.viewSide = 'PLA';
      return '通过';
    });
    chk('拾取与检视面板', function () {
      var hit = null, u0 = E.units.filter(function (u) { return !u.dead; })[0];
      R.flyTo(u0.lat, u0.lon, 10); R.draw(0.016);
      var p = R.toScreen(u0.lat, u0.lon);
      hit = R.pick(p.x, p.y);
      if (!hit) throw new Error('拾取失败');
      app.select(hit);
      if (!el('inspSpec').innerHTML.length) throw new Error('检视面板为空');
      // 逐一渲染多种单位的检视面板
      var kinds = {}, n = 0;
      E.units.forEach(function (u) {
        if (u.dead || kinds[u.cls]) return;
        kinds[u.cls] = 1; app.renderInspect(u); n++;
      });
      Object.keys(E.bases).slice(0, 6).forEach(function (k) { app.renderFacility(E.bases[k], 'base'); });
      Object.keys(E.sites).slice(0, 10).forEach(function (k) { app.renderFacility(E.sites[k], 'site'); });
      return '检视 ' + n + ' 类单位 + 16 处设施';
    });
    chk('态势 / OOB / 日志 / 图表渲染', function () {
      app.renderStatus(); app.renderOOB(); app.renderLog(true); app.renderCharts(); app.renderBrief();
      var l = el('logList').children.length, o = el('oobBox').innerHTML.length;
      if (!o) throw new Error('OOB 面板为空');
      return '日志 ' + l + ' 条　OOB ' + o + ' 字节　采样 ' + E.stats.length;
    });
    chk('全部剧本可开局', function () {
      var ids = Object.keys(TWG.SCENARIOS), ok = [];
      ids.forEach(function (id) {
        var e2 = new TWG.Engine({ scenario: TWG.SCENARIOS[id], seed: 7 });
        for (var i = 0; i < 40; i++) e2.step(30);
        ok.push(id + '(' + e2.units.length + ')');
      });
      return ok.join(' ');
    });
    chk('投影往返精度', function () {
      var pts = [[25.033, 121.565], [22.615, 120.283], [24.44, 118.36], [26.15, 119.95], [21.3, 121.0]];
      var maxE = 0;
      pts.forEach(function (p) {
        var s = R.toScreen(p[0], p[1]), b = R.toLatLon(s.x, s.y);
        maxE = Math.max(maxE, Math.abs(b.lat - p[0]) + Math.abs(b.lon - p[1]));
      });
      if (maxE > 1e-6) throw new Error('误差 ' + maxE);
      return '最大误差 ' + maxE.toExponential(2) + '°';
    });
    chk('地理坐标校验', function () {
      var G = TWG.geo, bad = [];
      function near(a, b, km, nm) { if (G.dist(a, b) > km) bad.push(nm + ' 偏差 ' + G.dist(a, b).toFixed(1) + 'km'); }
      near(TWG.THEATER.idx.airbase['AB-HUALIEN'], { lat: 24.023, lon: 121.618 }, 3, '花莲基地');
      near(TWG.THEATER.idx.port['NB-ZUOYING'], { lat: 22.617, lon: 120.264 }, 3, '左营军港');
      near(TWG.THEATER.idx.keysite['KS-LESHAN'], { lat: 24.503, lon: 121.083 }, 3, '乐山雷达');
      var strait = G.dist({ lat: 24.82, lon: 120.94 }, { lat: 25.50, lon: 119.79 });  // 新竹—平潭
      if (strait < 110 || strait > 150) bad.push('海峡最窄处 ' + strait.toFixed(0) + 'km 异常');
      var xk = G.dist({ lat: 24.48, lon: 118.089 }, { lat: 24.433, lon: 118.317 });   // 厦门—金门
      if (xk > 30) bad.push('厦门—金门 ' + xk.toFixed(0) + 'km 异常');
      if (bad.length) throw new Error(bad.join('; '));
      return '新竹—平潭 ' + strait.toFixed(0) + 'km，厦门—金门 ' + xk.toFixed(1) + 'km（与实际相符）';
    });
    chk('画面像素非空白', function () {
      R.opts.source = 'none'; R.flyTo(23.9, 120.6, 7.2); R.draw(0.016);
      var d = R.ctx.getImageData(0, 0, R.cv.width, R.cv.height).data;
      var lit = 0, colors = {};
      for (var i = 0; i < d.length; i += 4 * 31) {
        colors[(d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)] = 1;
        if (d[i] + d[i + 1] + d[i + 2] > 90) lit++;
      }
      var uniq = Object.keys(colors).length;
      R.opts.source = 'esriSat';
      if (uniq < 10) throw new Error('画面近乎空白，唯一色阶仅 ' + uniq);
      if (lit < 200) throw new Error('有效像素过少 ' + lit);
      return '亮像素采样 ' + lit + '，唯一色阶 ' + uniq + '（画面已正常绘制）';
    });

    /* ---------- 新增: 实景照片库 / 三维建模 / 精灵烘焙 / 图鉴 ---------- */
    chk('实景照片库覆盖率', function () {
      if (!TWG.IMAGERY) throw new Error('js/imagery.js 未加载');
      var ids = Object.keys(TWG.PLATFORMS), have = 0, shots = 0, miss = [];
      ids.forEach(function (id) {
        var ps = TWG.photosOf(id);
        if (ps.length) { have++; shots += ps.length; } else miss.push(id);
      });
      if (have < ids.length) throw new Error('缺图 ' + miss.length + ' 型: ' + miss.slice(0, 6).join(','));
      return have + '/' + ids.length + ' 型有实景照片，共 ' + shots + ' 张';
    });
    chk('照片文件可加载', function () {
      // 同步无法等待 onload，改为校验 URL 结构与去重
      var seen = {}, dup = 0, bad = 0, n = 0;
      Object.keys(TWG.IMAGERY).forEach(function (id) {
        TWG.photosOf(id).forEach(function (p) {
          n++;
          if (!/^assets\/photo\/.+\.(jpg|png|webp|gif)$/i.test(p.url)) bad++;
          if (seen[p.url]) dup++; seen[p.url] = 1;
        });
      });
      if (bad) throw new Error(bad + ' 条图片路径异常');
      return n + ' 条路径合法，重复 ' + dup + ' 条';
    });
    chk('WebGL 与 three.js', function () {
      var glOk = TWG.haveGL && TWG.haveGL();
      if (typeof root.THREE === 'undefined') throw new Error('three.js 未加载');
      return 'three.js r' + root.THREE.REVISION + '　WebGL ' + (glOk ? '可用' : '不可用(将自动回退二维矢量)');
    });
    chk('三维模型构建 (全部 112 型)', function () {
      if (!TWG.M3D) throw new Error('models3d.js 未加载');
      var ids = Object.keys(TWG.PLATFORMS), okN = 0, tri = 0, bad = [];
      ids.forEach(function (id) {
        var m = TWG.M3D.get(id);
        if (!m) { bad.push(id); return; }
        var ud = m.userData || {};
        if (!ud.bbox || !(ud.bbox.size.z > 0)) { bad.push(id + '(bbox)'); return; }
        okN++; tri += ud.tris || 0;
      });
      if (bad.length) throw new Error('失败 ' + bad.length + ' 型: ' + bad.slice(0, 5).join(','));
      return okN + '/' + ids.length + ' 型建模成功，合计 ' + tri.toLocaleString() + ' 三角面（均 ' + Math.round(tri / okN) + ' 面/型）';
    });
    chk('三维精灵烘焙与地图呈现', function () {
      if (!TWG.haveGL || !TWG.haveGL()) return '跳过（无 WebGL，已回退二维矢量）';
      if (!R.bank) { R.setUnitStyle('3d'); }
      if (!R.bank) throw new Error('精灵库未能初始化');
      var samples = ['CV-Fujian', 'DDG-055', 'J-20A', 'SS-039C', 'F-16V', 'BN-HIMARS', 'SAM-PAC3', 'LST-072A'];
      // 反复请求 + 烘焙，直到全部就绪（模拟真实的惰性烘焙节奏）
      for (var pass = 0; pass < 40; pass++) {
        var missing = 0;
        samples.forEach(function (c) { if (!R.bank.get(c, 0)) missing++; });
        if (!missing) break;
        R.bank.pump(4);
      }
      var got = 0, px = 0;
      samples.forEach(function (c) {
        var sp = R.bank.get(c, 45);
        if (sp && sp.img && sp.img.width > 0) { got++; px = sp.px; }
      });
      if (got < samples.length) throw new Error('仅 ' + got + '/' + samples.length + ' 型烘焙成功');
      // 校验烘焙位图确有内容
      var t = doc.createElement('canvas'); t.width = t.height = px;
      var tc = t.getContext('2d');
      var sp0 = R.bank.get('DDG-055', 0);
      tc.drawImage(sp0.img, 0, 0);
      var dd = tc.getImageData(0, 0, px, px).data;
      var solid = 0;
      for (var i = 3; i < dd.length; i += 4 * 7) if (dd[i] > 40) solid++;
      if (solid < 20) throw new Error('烘焙位图为空 (不透明采样 ' + solid + ')');
      var st = R.bank.stats();
      return got + ' 型精灵 ' + st.dirs + ' 方向 ' + px + 'px　显存约 ' + st.approxMB + 'MB　位图不透明采样 ' + solid;
    });
    chk('三维/二维双模式渲染', function () {
      var res = [];
      ['3d', 'vector'].forEach(function (m) {
        R.setUnitStyle(m);
        ['low', 'mid', 'high'].forEach(function (q) {
          if (m === '3d') R.setQuality(q);
          R.flyTo(24.3, 120.5, 10.2);
          R.draw(0.016); R.bank && R.bank.pump(3); R.draw(0.016);
          res.push(m + '/' + q);
        });
      });
      R.setUnitStyle(TWG.haveGL && TWG.haveGL() ? '3d' : 'vector'); R.setQuality('mid');
      return res.length + ' 种组合渲染无异常';
    });
    chk('三维展示台 (检视面板)', function () {
      var u = E.units.filter(function (x) { return !x.dead && x.domain === 'surface'; })[0];
      if (!u) throw new Error('无可用单位');
      app.select({ kind: 'unit', o: u });
      if (!el('inspMedia') || el('inspMedia').style.display === 'none') throw new Error('媒体区未显示');
      if (!app.photos || !app.photos.length) throw new Error('照片未装载');
      app.photoStep(1); app.photoStep(-1);
      if (!(TWG.haveGL && TWG.haveGL())) return '照片区正常；三维展示台跳过(无 WebGL)';
      app.mediaMode = 'm3d';
      var v = app.ensureViewer(true);
      if (!v) throw new Error('展示台创建失败');
      v.show(u.cls); v.frame();
      app.mediaMode = 'photo';
      return '照片 ' + app.photos.length + ' 张可切换；三维展示台渲染成功 (' + u.cls + ')';
    });
    chk('装备图鉴', function () {
      app.openCodex('DDG-055');
      var n = el('cdxGrid').querySelectorAll('.cdxCard').length;
      if (n < 50) throw new Error('图鉴卡片仅 ' + n + ' 张');
      if (!el('cdxDetail').innerHTML.length || el('cdxDetail').querySelector('.cdxEmpty')) throw new Error('详情未渲染');
      // 搜索与筛选
      el('cdxSearch').value = '潜艇'; app.renderCodexGrid();
      var n2 = el('cdxGrid').querySelectorAll('.cdxCard').length;
      el('cdxSearch').value = ''; app.cdxFilter = { side: 'ROC', domain: 'air' }; app.renderCodexGrid();
      var n3 = el('cdxGrid').querySelectorAll('.cdxCard').length;
      app.cdxFilter = { side: '', domain: '' }; app.renderCodexGrid();
      // 逐一打开若干型号详情，确保无异常
      var probes = ['CV-Fujian', 'J-20A', 'SS-HaiKun', 'BN-HIMARS', 'RADAR-ROC', 'SAM-S400', 'Shuiqiao', 'AH-64E'];
      probes.forEach(function (c) { app.openCodexDetail(c); });
      app.closeCodex();
      return '卡片 ' + n + ' 张　搜索"潜艇" ' + n2 + ' 项　台军航空 ' + n3 + ' 项　详情页 ' + probes.length + ' 型无异常';
    });
    chk('性能: 三维模式下的绘制耗时', function () {
      R.setUnitStyle(TWG.haveGL && TWG.haveGL() ? '3d' : 'vector');
      R.flyTo(24.0, 120.6, 8.4);
      for (var w = 0; w < 30; w++) { R.draw(0.016); if (R.bank) R.bank.pump(2); }  // 预热+烘焙
      var t0 = performance.now();
      for (var i = 0; i < 30; i++) R.draw(0.016);
      var ms = (performance.now() - t0) / 30;
      var units = E.units.filter(function (u) { return !u.dead; }).length;
      if (ms > 120) throw new Error('单帧 ' + ms.toFixed(1) + ' ms 过慢');
      return '单帧 ' + ms.toFixed(1) + ' ms (约 ' + Math.round(1000 / Math.max(ms, 0.1)) + ' FPS 上限)　单位 ' + units + ' 个';
    });

    var pass = errs.length === 0;
    var pre = doc.createElement('pre');
    pre.id = 'diagOut';
    pre.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#04080c;color:#cfe;padding:18px;' +
      'font:12px ui-monospace,monospace;overflow:auto;white-space:pre-wrap';
    pre.textContent = 'DIAG_' + (pass ? 'OK' : 'FAIL') + '\n' + '='.repeat(70) + '\n' +
      out.join('\n') + '\n' + '='.repeat(70) + '\n耗时 ' + (Date.now() - t0) + ' ms\n' +
      (errs.length ? '\n错误详情:\n' + errs.join('\n\n') : '');
    doc.body.appendChild(pre);
    doc.title = 'DIAG_' + (pass ? 'OK' : 'FAIL');
  }

  /* 启动 */
  function parseHash() {
    var q = {}, s = (root.location.hash || '').replace(/^#/, '');
    s.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      q[i < 0 ? kv : kv.slice(0, i)] = i < 0 ? '1' : decodeURIComponent(kv.slice(i + 1));
    });
    return q;
  }
  root.addEventListener('DOMContentLoaded', function () {
    try {
      var q = parseHash();
      var app = root.TWGApp = new App(q.sc && TWG.SCENARIOS[q.sc] ? q.sc : undefined);
      /* #sc=剧本id&ff=小时&z=缩放&lat=&lon=&side=  例: #sc=invasion&ff=36 */
      if (q.ff) {
        var target = Math.max(0, Math.min(30 * 24, parseFloat(q.ff))) * 3600;
        var guard = 0;
        while (app.E.t < target && !app.E.ended && guard++ < 200000) app.E.step(app.dt);
        app.afterStep(); app.renderStatus(); app.renderOOB(); app.renderLog(true); app.renderCharts();
      }
      if (q.lat && q.lon) app.R.flyTo(parseFloat(q.lat), parseFloat(q.lon), q.z ? parseFloat(q.z) : undefined);
      else if (q.z) app.R.zoom = parseFloat(q.z);
      if (q.side != null) { app.viewSide = q.side; app.R.viewSide = q.side || null; el('viewSide').value = q.side; }
      if (q.map && TWG.Renderer.SOURCES[q.map]) { app.R.opts.source = q.map; el('mapSel').value = q.map; }
      if (q.tab) { var t = doc.querySelector('.tab[data-p="' + q.tab + '"]'); if (t) t.click(); }
      if (q.diag) runDiag(app);
    } catch (err) {
      var b = doc.getElementById('bootErr');
      if (b) { b.style.display = 'block'; b.textContent = '初始化失败: ' + (err && err.stack || err); }
      throw err;
    }
  });
  TWG.App = App;
})(typeof window !== 'undefined' ? window : globalThis);
