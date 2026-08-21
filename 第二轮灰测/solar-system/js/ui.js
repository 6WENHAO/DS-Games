/* =======================================================================
 *  ui.js  —  界面：天体清单 / 天体档案 / 陨石参数 / 实时物理预览 /
 *            撞击结果解读 / 星球变化追踪 / 屏幕标注与准星 / 输入
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});
  const M = SS.M, V = SS.M.v3, M3 = SS.M.m3;
  const $ = (id) => document.getElementById(id);
  const Imp = SS.Impact;

  const UI = {
    target: null,
    aim: null,             // 体坐标单位方向
    mat: null,
    diameter: 100,
    velocity: 20,
    angle: 45,
    azimuth: 0,
    ocean: false,
    preview: null,
    lastResult: null,
    firing: false,
    timeScale: 1,          // 天/秒
    prevScale: 1,
    labels: true,
    pins: [],
    aimEl: null,
  };

  /* ------------------------------ 格式化 ----------------------------- */
  const fmtLen = Imp.fmtLen, fmtMass = Imp.fmtMass, fmtTime = Imp.fmtTime;
  function fmtE(J) {
    const mt = J / Imp.J_PER_MT;
    if (mt < 1e-3) return (J / 4.184e9).toFixed(2) + ' 吨TNT';
    if (mt < 1) return (mt * 1000).toFixed(mt > 0.01 ? 1 : 2) + ' 千吨TNT';
    if (mt < 1e6) return mt.toFixed(mt < 100 ? 1 : 0) + ' 百万吨TNT';
    return mt.toExponential(2) + ' 百万吨TNT';
  }
  function fmtNum(x, d) {
    if (!isFinite(x)) return '—';
    if (Math.abs(x) >= 1e6 || (Math.abs(x) < 1e-3 && x !== 0)) return x.toExponential(d === undefined ? 2 : d);
    return x.toFixed(d === undefined ? 2 : d);
  }
  function srgbCss(c) {
    const f = (x) => Math.round(255 * Math.pow(M.clamp(x, 0, 1), 1 / 2.2));
    return 'rgb(' + f(c[0]) + ',' + f(c[1]) + ',' + f(c[2]) + ')';
  }
  const OUTCOME = {
    ground: ['落地成坑', 'ground'], airburst: ['空中爆炸', 'airburst'],
    burnup: ['大气烧毁', 'burnup'], fall: ['减速陨落', 'fall'],
    gasburst: ['气层深爆', 'gasburst'], vaporized: ['瞬间汽化', 'vaporized'],
  };

  /* ------------------------------ 初始化 ----------------------------- */
  UI.init = function () {
    UI.mat = SS.DATA.IMPACTORS[3];   // 普通石质
    buildBodyList();
    buildMaterials();
    buildPresets();
    bindControls();
    bindInput();
    UI.aimEl = document.createElement('div');
    UI.aimEl.className = 'aim';
    UI.aimEl.innerHTML = '<b>撞击点</b>';
    UI.aimEl.style.display = 'none';
    $('overlay').appendChild(UI.aimEl);
    UI.setTarget(SS.World.byId.earth, true);
    SS.FX.onImpact = onImpact;
    $('help-close').onclick = () => $('help-modal').classList.remove('open');
    $('btn-help').onclick = () => $('help-modal').classList.add('open');
    if (!localStorage.getItem('ss-seen')) {
      $('help-modal').classList.add('open');
      localStorage.setItem('ss-seen', '1');
    }
  };

  function buildBodyList() {
    const wrap = $('body-list');
    wrap.innerHTML = '';
    for (const b of SS.World.bodies) {
      const d = b.def;
      const el = document.createElement('div');
      el.className = 'body-item' + (d.cls === 'moon' ? ' moon' : '');
      el.dataset.id = d.id;
      const col = srgbCss(d.look.colA);
      let badge = '';
      if (d.target.type === 'gas') badge = '<span class="badge">无地面</span>';
      else if (!d.atmo) badge = '<span class="badge">真空</span>';
      else if (d.atmo.rho0 > 5) badge = '<span class="badge">浓密大气</span>';
      el.innerHTML = '<i class="dot" style="background:' + col + ';color:' + col + '"></i>' +
        '<span class="nm">' + d.name + '</span>' + badge;
      el.onclick = () => { SS.Cam.setFocus(b); UI.setTarget(b); };
      wrap.appendChild(el);
    }
  }

  function buildMaterials() {
    const row = $('mat-row');
    row.innerHTML = '';
    SS.DATA.IMPACTORS.forEach((m) => {
      const el = document.createElement('div');
      el.className = 'mat' + (m === UI.mat ? ' active' : '');
      el.innerHTML = '<div class="sw" style="background:' + srgbCss(m.color) + '"></div>' + m.name.slice(0, 4);
      el.onclick = () => {
        UI.mat = m;
        row.querySelectorAll('.mat').forEach((x) => x.classList.remove('active'));
        el.classList.add('active');
        $('v-mat').textContent = m.name;
        $('mat-desc').textContent = m.desc + ' · 密度 ' + m.density + ' kg/m³ · 抗压强度 ' +
          (m.strength >= 1e6 ? (m.strength / 1e6).toFixed(1) + ' MPa' : (m.strength / 1e3).toFixed(0) + ' kPa');
        refreshPreview();
      };
      row.appendChild(el);
    });
    $('v-mat').textContent = UI.mat.name;
    $('mat-desc').textContent = UI.mat.desc + ' · 密度 ' + UI.mat.density + ' kg/m³ · 抗压强度 ' +
      (UI.mat.strength / 1e6).toFixed(1) + ' MPa';
  }

  function buildPresets() {
    const sel = $('preset-select');
    SS.DATA.PRESETS.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      const p = SS.DATA.PRESETS.find((x) => x.id === sel.value);
      if (!p) { $('preset-desc').textContent = ''; return; }
      $('preset-desc').textContent = p.note;
      const b = SS.World.byId[p.body];
      SS.Cam.setFocus(b);
      UI.setTarget(b);
      UI.mat = SS.DATA.IMPACTORS.find((m) => m.id === p.mat) || UI.mat;
      buildMaterials();
      UI.diameter = p.d;
      UI.velocity = p.v;
      UI.angle = p.angle;
      UI.ocean = false;
      syncSliders();
      refreshPreview();
      toast('已载入预设：' + p.name + ' — 点“投放陨石”开始', 'warn');
    };
  }

  /* --------------------------- 滑杆映射 ----------------------------- */
  const D_MIN = 1, D_MAX = 1e6;      // m
  const dToSlider = (d) => Math.round(1000 * Math.log10(d / D_MIN) / Math.log10(D_MAX / D_MIN));
  const sliderToD = (s) => D_MIN * Math.pow(D_MAX / D_MIN, s / 1000);

  function vRange() {
    const b = UI.target;
    const vmin = Math.max(0.3, b ? b.def.vesc : 1);
    return { vmin, vmax: 72 };
  }
  const vToSlider = (v) => {
    const r = vRange();
    return Math.round(1000 * M.clamp((v - r.vmin) / (r.vmax - r.vmin), 0, 1));
  };
  const sliderToV = (s) => {
    const r = vRange();
    return r.vmin + (r.vmax - r.vmin) * (s / 1000);
  };

  function syncSliders() {
    $('s-diam').value = dToSlider(UI.diameter);
    $('s-vel').value = vToSlider(UI.velocity);
    $('s-ang').value = Math.round(UI.angle);
    $('s-az').value = Math.round(UI.azimuth * 180 / Math.PI) % 360;
    $('v-diam').textContent = fmtLen(UI.diameter);
    $('v-vel').textContent = UI.velocity.toFixed(1) + ' km/s';
    $('v-ang').textContent = Math.round(UI.angle) + '°';
    $('v-az').textContent = (Math.round(UI.azimuth * 180 / Math.PI) % 360) + '°';
    $('tick-vmin').textContent = vRange().vmin.toFixed(1) + ' km/s';
    $('opt-ocean').checked = UI.ocean;
  }

  function bindControls() {
    $('s-diam').oninput = (e) => {
      UI.diameter = sliderToD(+e.target.value);
      $('v-diam').textContent = fmtLen(UI.diameter);
      refreshPreview();
    };
    $('s-vel').oninput = (e) => {
      UI.velocity = sliderToV(+e.target.value);
      $('v-vel').textContent = UI.velocity.toFixed(1) + ' km/s';
      refreshPreview();
    };
    $('s-ang').oninput = (e) => {
      UI.angle = +e.target.value;
      $('v-ang').textContent = UI.angle + '°';
      refreshPreview();
    };
    $('s-az').oninput = (e) => {
      UI.azimuth = (+e.target.value) * Math.PI / 180;
      $('v-az').textContent = (+e.target.value) + '°';
    };
    $('opt-ocean').onchange = (e) => { UI.ocean = e.target.checked; refreshPreview(); };
    $('btn-fire').onclick = fire;
    $('btn-reset').onclick = () => {
      const b = UI.target;
      if (!b) return;
      b.reset();
      b.scarDirty = 'clear';
      UI.lastResult = null;
      $('result').innerHTML = '<div class="empty">尚无撞击记录</div>';
      renderChanges();
      toast(b.def.name + ' 已复原到撞击前的状态');
    };

    // 时间倍率
    $('time-group').querySelectorAll('.tbtn').forEach((btn) => {
      btn.onclick = () => {
        $('time-group').querySelectorAll('.tbtn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        UI.timeScale = parseFloat(btn.dataset.scale);
      };
    });

    const R = SS.R;
    $('opt-orbits').onchange = (e) => { R.settings.showOrbits = e.target.checked; };
    $('opt-atmo').onchange = (e) => { R.settings.showAtmo = e.target.checked; };
    $('opt-stars').onchange = (e) => { R.settings.showStars = e.target.checked; };
    $('opt-labels').onchange = (e) => {
      UI.labels = e.target.checked;
      if (!e.target.checked) UI.pins.forEach((p) => { p.el.style.display = 'none'; });
    };
    $('opt-quality').onchange = (e) => {
      R.setQuality(e.target.value);
      toast('画质：' + e.target.selectedOptions[0].textContent);
    };
    $('s-relief').oninput = (e) => {
      R.settings.reliefGain = +e.target.value;
      $('v-relief').textContent = '×' + e.target.value;
    };
    $('s-boost').oninput = (e) => {
      R.settings.sizeBoost = +e.target.value;
      $('v-boost').textContent = '×' + e.target.value;
    };
    document.querySelectorAll('.collapse').forEach((b) => {
      b.onclick = () => {
        const p = $(b.dataset.target);
        p.classList.toggle('collapsed');
        b.textContent = p.classList.contains('collapsed') ? '+' : '–';
      };
    });
  }

  /* ------------------------------ 目标 ------------------------------ */
  UI.setTarget = function (body, silent) {
    UI.target = body;
    $('target-name').textContent = body.def.name;
    const r = vRange();
    UI.velocity = M.clamp(body.def.typicalV, r.vmin, r.vmax);
    UI.ocean = body.id === 'earth';
    $('ocean-wrap').style.display = (body.id === 'earth' || body.id === 'titan') ? 'flex' : 'none';
    // 默认瞄准正对相机的那一点
    UI.aim = subCameraDir(body);
    document.querySelectorAll('.body-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.id === body.id);
    });
    renderBodyFile(body);
    syncSliders();
    probeAim();
    refreshPreview();
    renderChanges();
    $('result').innerHTML = '<div class="empty">尚无撞击记录 · 设定参数后点“投放陨石”</div>';
    UI.lastResult = null;
    if (!silent) $('aim-hint').textContent = '在' + body.def.name + '表面点击可改变撞击点';
  };

  function subCameraDir(body) {
    const cam = SS.Cam.pos;
    const d = V.norm([cam[0] - body.pos[0], cam[1] - body.pos[1], cam[2] - body.pos[2]]);
    return V.norm(M3.xform(M3.transpose(body.rotM), d));
  }

  function renderBodyFile(b) {
    const d = b.def;
    const P = Imp.surfacePressure(d.atmo, d.g);
    const rows = [
      ['半径', (d.radius).toLocaleString() + ' km'],
      ['质量', d.mass.toExponential(3) + ' kg'],
      ['表面重力', d.g.toFixed(2) + ' m/s² (' + (d.g / 9.807).toFixed(2) + ' g)'],
      ['逃逸速度', d.vesc.toFixed(2) + ' km/s'],
      ['自转周期', Math.abs(b.st.rotHours) < 48
        ? Math.abs(b.st.rotHours).toFixed(3) + ' 小时' + (b.st.rotHours < 0 ? '（逆行）' : '')
        : (Math.abs(b.st.rotHours) / 24).toFixed(2) + ' 天' + (b.st.rotHours < 0 ? '（逆行）' : '')],
      ['转轴倾角', b.st.tilt.toFixed(2) + '°'],
      ['地表气压', P > 0 ? (P >= 1e5 ? (P / 101325).toFixed(2) + ' atm' : P.toFixed(P < 10 ? 3 : 0) + ' Pa') : '真空'],
      ['靶体', d.target.label],
      ['典型撞击速度', d.typicalV.toFixed(1) + ' km/s'],
    ];
    if (d.orbit) {
      rows.push(['轨道半长轴', d.parent === 'sun'
        ? (d.orbit.a / SS.DATA.AU).toFixed(3) + ' AU'
        : (d.orbit.a).toLocaleString() + ' km']);
      rows.push(['公转周期', Math.abs(d.orbit.T) < 400
        ? Math.abs(d.orbit.T).toFixed(2) + ' 天'
        : (Math.abs(d.orbit.T) / 365.25).toFixed(2) + ' 年']);
      rows.push(['偏心率', d.orbit.e.toFixed(4)]);
    }
    $('body-file').innerHTML = '<h3>' + d.name + ' <span style="color:var(--txt-dim);font-size:11px">' +
      d.en + '</span></h3><div class="desc">' + d.desc + '</div>' +
      rows.map((r) => '<div class="kv"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
  }

  /* ---------------------------- 物理预览 ---------------------------- */
  function simulate() {
    const b = UI.target;
    if (!b) return null;
    return Imp.simulate({
      body: b.def, diameter: UI.diameter, density: UI.mat.density,
      strength: UI.mat.strength, velocity: UI.velocity, angle: UI.angle,
      ocean: UI.ocean && (b.id === 'earth' || b.id === 'titan'),
    });
  }

  /** 用 GPU 探针读回撞击点的真实地形，决定是海洋撞击还是陆地撞击 */
  function probeAim() {
    const b = UI.target;
    if (!b || !UI.aim || !SS.R.probeSurface) return null;
    let pr = null;
    try { pr = SS.R.probeSurface(b, UI.aim); } catch (e) { pr = null; }
    UI.aimProbe = pr;
    if (!pr) return null;
    if (pr.hasOcean) UI.ocean = !pr.land;      // 由地形决定，不再让用户猜
    const wrap = $('ocean-wrap');
    if (wrap) wrap.style.display = pr.hasOcean ? 'flex' : 'none';
    $('opt-ocean').checked = UI.ocean;
    let label;
    const gasTarget = b.def.target.type === 'gas';
    if (gasTarget) label = '云顶（无固体表面）';
    else if (pr.hasOcean && !pr.land) label = '深海';
    else if (pr.ice) label = pr.land ? '冰盖 / 极区' : '海冰';
    else label = pr.heightM > (b.def.look.relief * 0.35) ? '高地' : '平原';
    const el = $('aim-terrain');
    if (el) {
      el.textContent = gasTarget ? label : (label + ' · 海拔 ' + (pr.heightM >= 0 ? '+' : '') +
        (Math.abs(pr.heightM) > 1000 ? (pr.heightM / 1000).toFixed(2) + ' km'
          : pr.heightM.toFixed(0) + ' m'));
    }
    return pr;
  }
  UI.probeAim = probeAim;

  function refreshPreview() {
    const res = simulate();
    UI.preview = res;
    if (!res) return;
    const oc = OUTCOME[res.outcome] || ['—', 'burnup'];
    let line2 = '';
    if (res.crater) {
      line2 = '最终坑径 <b>' + fmtLen(res.crater.DfrEff > 0 ? res.crater.DfrEff : res.crater.Dfr) +
        '</b> · 深 ' + fmtLen(res.crater.dfr) + ' · 震级 M' + res.seismic.M.toFixed(1);
    } else if (res.outcome === 'airburst' || res.outcome === 'burnup') {
      line2 = '爆发高度 <b>' + fmtLen(res.entry.burstAlt) + '</b>' +
        (res.blast && !res.blast.none && res.blast.r_forest > 0
          ? ' · 地面破坏半径 ' + fmtLen(res.blast.r_forest) : ' · 地面几乎无感');
    } else if (res.gas) {
      line2 = '暗斑直径 <b>' + res.gas.scarKm.toFixed(0) + ' km</b> · 羽流高 ' +
        res.gas.plumeHeightKm.toFixed(0) + ' km';
    } else if (res.outcome === 'fall') {
      line2 = '落地速度 <b>' + res.entry.v.toFixed(0) + ' m/s</b> · 残余 ' + fmtMass(res.entry.m);
    } else if (res.sun) {
      line2 = '相当于太阳 <b>' + fmtTime(res.sun.seconds) + '</b> 的辐射输出';
    }
    $('preview').innerHTML =
      '<div class="pv-top"><span class="pv-e">' + fmtE(res.E0) + '</span>' +
      '<span class="tag ' + oc[1] + '">' + oc[0] + '</span></div>' +
      '<div class="hint" style="font-size:11px;color:var(--txt)">' + line2 + '</div>' +
      '<div class="hint">质量 ' + fmtMass(res.m0) + ' · 相当于 ' +
      (res.hiroshima >= 1 ? fmtNum(res.hiroshima, 1) + ' 颗广岛原子弹' :
        (res.hiroshima * 100).toFixed(1) + '% 颗广岛原子弹') + '</div>';
  }
  UI.refreshPreview = refreshPreview;

  /* ------------------------------ 发射 ------------------------------ */
  function fire() {
    const b = UI.target;
    if (!b || UI.firing) return;
    if (!UI.aim) UI.aim = subCameraDir(b);
    const res = simulate();
    UI.firing = true;
    $('btn-fire').disabled = true;
    $('status-line').textContent = '来袭天体已进入' + b.def.name + '引力场';

    const m = SS.FX.launch({
      body: b, dirLocal: UI.aim, angle: UI.angle, azimuth: UI.azimuth,
      velocity: UI.velocity, diameter: UI.diameter, material: UI.mat,
      result: res,
    });
    // 时间倍率按真实飞行时间设定：把整段进入过程压缩到约 12 秒观看
    const accel = M.clamp(m.flightSeconds / 12, 0.05, 600);
    setTimeAccel(accel);
    toast(fmtLen(UI.diameter) + ' 的' + UI.mat.name + '以 ' + UI.velocity.toFixed(1) +
      ' km/s 冲向' + b.def.name + '：真实飞行 ' + fmtTime(m.flightSeconds) +
      '，时间倍率 ×' + (accel < 1 ? accel.toFixed(2) : accel.toFixed(0)), 'warn');
  }
  UI.fire = fire;

  /** 设定“模拟秒/真实秒”的加速倍率 */
  function setTimeAccel(accel) {
    setTimeScale(accel / 86400);
  }
  UI.setTimeAccel = setTimeAccel;

  function setTimeScale(s) {
    UI.timeScale = s;
    let best = null;
    $('time-group').querySelectorAll('.tbtn').forEach((btn) => {
      const v = parseFloat(btn.dataset.scale);
      btn.classList.remove('active');
      if (best === null || Math.abs(v - s) < Math.abs(best.v - s)) best = { btn, v };
    });
    if (best) best.btn.classList.add('active');
  }

  function onImpact(body, res, dir) {
    UI.firing = false;
    $('btn-fire').disabled = false;
    UI.lastResult = res;
    renderResult(res, body);
    renderChanges();
    renderBodyFile(body);
    const oc = OUTCOME[res.outcome] || ['—'];
    toast('撞击完成：' + oc[0] + (res.crater && res.crater.DfrEff > 0
      ? ' · 坑径 ' + fmtLen(res.crater.DfrEff) : ''), 'hit');
    $('status-line').textContent = body.def.name + ' 已记录 ' + body.st.impacts + ' 次撞击';

    // 弹道喷出物的真实飞行时间通常是几分钟到几小时 → 自动给出合适的观察倍率
    if (res.ejecta) {
      const g = body.def.g;
      const tEj = 1.414 * Math.sqrt(Math.max(4 * res.ejecta.rMin, 100) / g);
      const accel = M.clamp(tEj / 15, 1, 4000);
      setTimeAccel(accel);
      setTimeout(() => {
        toast('时间倍率 ×' + accel.toFixed(0) + '：喷出物按真实弹道飞行（' +
          fmtTime(tEj) + ' 量级）。继续加速可以看到熔体冷却与尘幕沉降。');
      }, 1200);
    }
  }

  /* ---------------------------- 结果面板 ---------------------------- */
  function kv(k, v, hint) {
    return '<div class="kv"><span>' + k + (hint ? ' <i style="opacity:.5">' + hint + '</i>' : '') +
      '</span><b>' + v + '</b></div>';
  }

  function renderResult(res, body) {
    const oc = OUTCOME[res.outcome] || ['—', 'burnup'];
    let h = '<div class="res-title"><b>撞击报告</b><span class="tag ' + oc[1] + '">' + oc[0] + '</span></div>';

    h += kv('入射动能', fmtE(res.E0));
    h += kv('入射质量', fmtMass(res.m0));
    h += kv('等效广岛原子弹', res.hiroshima >= 1 ? fmtNum(res.hiroshima, 1) + ' 颗' : (res.hiroshima * 100).toFixed(1) + '%');

    const e = res.entry;
    if (body.def.atmo) {
      h += '<div class="sep"></div><div class="mini-label">大气进入</div>';
      h += kv('解体高度', e.fragmented ? fmtLen(e.breakupAlt) : '未解体（强度足够）');
      h += kv('碎片云展宽', e.spreadRatio.toFixed(2) + ' ×');
      h += kv('剩余动能', (e.energyFraction * 100).toFixed(1) + '%');
      if (res.outcome === 'airburst' || res.outcome === 'burnup') h += kv('爆发高度', fmtLen(e.burstAlt));
      else h += kv('落地速度', (e.v / 1000).toFixed(2) + ' km/s');
    }

    if (res.crater) {
      const c = res.crater;
      h += '<div class="sep"></div><div class="mini-label">撞击坑</div>';
      h += kv('瞬时坑直径', fmtLen(c.Dtc));
      h += kv('最终坑直径', fmtLen(c.DfrEff > 0 ? c.DfrEff : c.Dfr),
        c.type === 'simple' ? '简单坑' : c.type === 'basin' ? '盆地' : '复杂坑');
      h += kv('坑深 / 坑缘高', fmtLen(c.dfr) + ' / ' + fmtLen(c.rim));
      if (c.centralPeak) h += kv('中央峰', '有' + (c.terraces ? ' · 坑壁阶地' : ''));
      h += kv('挖掘体积', fmtNum(c.volume / 1e9, 2) + ' km³');
      if (c.meltVol > 0) h += kv('冲击熔融体积', fmtNum(c.meltVol / 1e9, 3) + ' km³ · 厚 ' + fmtLen(c.meltDepth));
      h += kv('占星球周长', ((c.Dfr / (2 * Math.PI * body.def.radius * 1000)) * 100).toFixed(3) + '%');
    }

    if (res.seismic) {
      h += '<div class="sep"></div><div class="mini-label">环境效应</div>';
      h += kv('地震震级', 'M ' + res.seismic.M.toFixed(2));
    }
    if (res.thermal) {
      h += kv('火球半径', fmtLen(res.thermal.fireballR));
      if (res.thermal.horizonKm) h += kv('火球可见距离', fmtNum(res.thermal.horizonKm, 0) + ' km');
    }
    if (res.blast) {
      if (res.blast.none) h += kv('空气冲击波', '无（真空）');
      else {
        h += kv('20 kPa 半径', fmtLen(res.blast.r_total), '建筑倒塌');
        h += kv('6.9 kPa 半径', fmtLen(res.blast.r_forest), '树木倒伏');
        h += kv('2 kPa 半径', fmtLen(res.blast.r_glass), '玻璃破碎');
        h += kv('最大风速', (res.blast.windTotal * 3.6).toFixed(0) + ' km/h');
      }
    }
    if (res.ejecta) {
      h += kv('喷出物毯半径', fmtNum(res.ejecta.radiusKm, 1) + ' km', '厚度 ∝ r⁻³');
      h += kv('最慢喷出速度', (res.ejecta.vMin / 1000).toFixed(2) + ' km/s',
        '坑缘 45° 弹道');
      h += kv('逃逸质量比例', (res.ejecta.escapeFraction * 100).toFixed(3) + '% · ' +
        fmtMass(res.ejecta.massLost), 'r_min/r_esc');
      if (res.ejecta.glowSeconds > 0) {
        h += kv('熔体辉光时长', fmtTime(res.ejecta.glowSeconds), '辐射结壳时标');
      }
    }
    if (res.tsunami) {
      h += '<div class="sep"></div><div class="mini-label">撞击海啸</div>';
      h += kv('瞬时水腔直径', res.tsunami.cavityKm.toFixed(1) + ' km');
      h += kv('坑缘波高', fmtLen(res.tsunami.rimWaveM));
      h += kv('1000 km 处波高', fmtLen(res.tsunami.at1000km));
      h += kv('传播速度', res.tsunami.speedKmh.toFixed(0) + ' km/h');
      h += kv('近岸爬高放大', '× ' + res.tsunami.runupFactor);
    }
    if (res.gas) {
      h += '<div class="sep"></div><div class="mini-label">云层伤痕</div>';
      h += kv('能量沉积深度', res.gas.depthBar.toFixed(2) + ' bar');
      h += kv('羽流高度', res.gas.plumeHeightKm.toFixed(0) + ' km');
      h += kv('暗斑直径', res.gas.scarKm.toFixed(0) + ' km（地球直径的 ' + (res.gas.scarKm / 12742).toFixed(2) + ' 倍）');
      h += kv('存续时间', res.gas.lifetimeDays.toFixed(0) + ' 天');
    }
    if (res.globalDust > 0.001 || res.damagedFraction > 0.0001) {
      h += '<div class="sep"></div><div class="mini-label">全球效应</div>';
      h += kv('尘幕光学厚度 τ', res.globalDust.toFixed(3));
      h += kv('地表日照', (res.insolation * 100).toFixed(res.insolation < 0.1 ? 3 : 1) + '%', 'e^-τ');
      h += kv('直接受灾面积', (res.damagedFraction * 100).toFixed(res.damagedFraction < 0.01 ? 3 : 1) + '%',
        '球冠面积占比');
      const shift = Imp.snowLineShift(res.globalDust, body.id === 'earth' ? 255 : 210, 0.55);
      if (shift > 0.5) h += kv('雪线向赤道推进', shift.toFixed(1) + '°', '一维能量平衡');
    }
    if (res.spin) {
      h += '<div class="sep"></div><div class="mini-label">星球动力学</div>';
      h += kv('自转周期变化', (res.spin.rotDeltaSec * 1000).toExponential(2) + ' ms');
      h += kv('相对自转角动量', res.spin.ratio.toExponential(2));
      h += kv('转轴偏移', res.spin.tiltDeltaDeg.toExponential(2) + '°');
    }
    if (res.recurrenceYears) {
      h += kv('同级事件复发周期', fmtNum(res.recurrenceYears, 1) + ' 年', '按地球通量估算');
    }
    res.notes.forEach((n) => { h += '<div class="res-note">' + n + '</div>'; });
    $('result').innerHTML = h;
  }

  /* ---------------------------- 变化面板 ---------------------------- */
  function bar(v, col) {
    return '<div class="bar"><i style="width:' + (M.clamp(v, 0, 1) * 100).toFixed(1) +
      '%;background:' + col + '"></i></div>';
  }

  function renderChanges() {
    const b = UI.target;
    if (!b) return;
    const st = b.st, d = b.def;
    let h = '<div class="res-title"><b>' + d.name + ' 的现状</b></div>';
    if (!st.impacts) {
      h += '<div class="empty">这颗星球还保持着原始状态。<br>投放陨石后，这里会记录它被改变了多少。</div>';
      $('changes').innerHTML = h;
      return;
    }
    h += kv('人为撞击次数', st.impacts + ' 次');
    h += kv('累计释放能量', fmtE(st.energy));
    if (st.craterCount) h += kv('留下的撞击坑', st.craterCount + ' 个');
    if (st.biggestCraterKm) h += kv('最大坑直径', fmtNum(st.biggestCraterKm, 1) + ' km');
    if (st.escapedMass) h += kv('抛入太空的物质', fmtMass(st.escapedMass));

    const rot0 = Math.abs(d.rotHours), rot1 = Math.abs(st.rotHours);
    if (Math.abs(rot1 - rot0) > 1e-12) {
      h += kv('自转周期', rot1.toFixed(6) + ' h', 'Δ ' + ((rot1 - rot0) * 3600 * 1000).toExponential(2) + ' ms');
    }
    if (Math.abs(st.tilt - d.tilt) > 1e-9) h += kv('转轴倾角', st.tilt.toFixed(6) + '°');

    if (st.tau > 0.001) {
      h += '<div class="sep"></div><div class="mini-label">平流层尘幕 τ = ' + st.tau.toFixed(3) + '</div>' +
        bar(Math.min(1, st.tau / 3), 'linear-gradient(90deg,#c08a5a,#ff7a4a)') +
        '<div class="mini-label">地表日照 ' + (st.insolation * 100).toFixed(st.insolation < 0.1 ? 2 : 1) + '%</div>' +
        bar(st.insolation, 'linear-gradient(90deg,#6a5a30,#ffe9a8)') +
        '<div class="hint">e^-τ 给出到达地表的阳光比例；尘幕按 1.5 年的 e 折时标沉降（皮纳图博火山标定）。' +
        '把时间倍率调到“1年/秒”就能看到它褪去。</div>';
    }
    if (st.snowLineLat !== null && st.iceBoost > 0.005) {
      const lat0 = Math.asin(Math.min(1, d.look.ice)) * 180 / Math.PI;
      h += '<div class="mini-label" style="margin-top:6px">雪线纬度 ' +
        st.snowLineLat.toFixed(1) + '°（原 ' + lat0.toFixed(1) + '°）</div>' +
        bar(1 - st.snowLineLat / 90, 'linear-gradient(90deg,#6aa0c8,#dff2ff)') +
        '<div class="hint">由一维能量平衡推出：T = T₀·f<sup>1/4</sup>，年均温梯度 0.55 K/度。' +
        (st.snowLineLat < 12 ? '已接近全球冰封（雪球地球）。' : '') + '</div>';
    }
    if (b.id === 'earth') {
      h += '<div class="mini-label" style="margin-top:6px">植被覆盖（光合作用受限）</div>' +
        bar(st.green, 'linear-gradient(90deg,#4a7a2a,#7fe05a)');
      h += '<div class="mini-label" style="margin-top:6px">夜面灯光（受灾面积推算）</div>' +
        bar(st.cityLights, 'linear-gradient(90deg,#7a5a20,#ffd27a)');
      if (st.damaged > 0.001) h += kv('累计直接受灾面积', (st.damaged * 100).toFixed(2) + '%');
      if (st.green < 0.85) h += '<div class="hint">植被按 ~170 年的时标恢复覆盖度；真实生态系统的完全恢复需要 10⁵–10⁶ 年，这里没有模拟那么长。</div>';
    }
    if (b.blots.length) h += kv('云层暗斑', b.blots.length + ' 处（正在被环流剪切拉长）');
    $('changes').innerHTML = h;
  }
  UI.renderChanges = renderChanges;

  /* ---------------------------- 屏幕标注 ---------------------------- */
  function ensurePins() {
    if (UI.pins.length) return;
    const ov = $('overlay');
    SS.World.bodies.forEach((b) => {
      const el = document.createElement('div');
      el.className = 'pin' + (b.def.cls === 'moon' ? ' moon' : '');
      el.innerHTML = '<i></i><span>' + b.def.name + '</span>';
      el.style.display = 'none';
      ov.appendChild(el);
      UI.pins.push({ b, el });
    });
  }

  UI.updateOverlay = function () {
    ensurePins();
    const Cam = SS.Cam, R = SS.R;
    const W = R.W, H = R.H;
    for (const p of UI.pins) {
      const b = p.b;
      if (!UI.labels) { p.el.style.display = 'none'; continue; }
      const rel = [b.pos[0] - Cam.pos[0], b.pos[1] - Cam.pos[1], b.pos[2] - Cam.pos[2]];
      const pr = Cam.project(rel);
      const sr = b.screenSize / (R.RH / H);
      const isMoon = b.def.cls === 'moon';
      let show = !!pr && pr.x > -0.05 && pr.x < 1.05 && pr.y > -0.05 && pr.y < 1.05;
      if (show && isMoon && sr < 2.5 && Cam.focus !== b && Cam.focus !== b.parent) show = false;
      if (show && sr > H * 0.9) show = false;
      if (!show) { p.el.style.display = 'none'; continue; }
      p.el.style.display = 'flex';
      p.el.classList.toggle('focus', Cam.focus === b);
      const off = Math.min(Math.max(sr, 4) + 8, 90);
      p.el.style.left = (pr.x * W) + 'px';
      p.el.style.top = (pr.y * H + off) + 'px';
    }

    // 准星
    const t = UI.target;
    if (t && UI.aim) {
      const pt = SS.World.surfacePoint(t, UI.aim, t.radius * 0.002, SS.R.settings.sizeBoost);
      const rel = [pt[0] - Cam.pos[0], pt[1] - Cam.pos[1], pt[2] - Cam.pos[2]];
      // 只在朝向相机的一侧显示
      const nWorld = V.norm(M3.xform(t.rotM, UI.aim));
      const toCam = V.norm([Cam.pos[0] - t.pos[0], Cam.pos[1] - t.pos[1], Cam.pos[2] - t.pos[2]]);
      const pr = Cam.project(rel);
      const sr = t.screenSize / (R.RH / H);
      if (pr && V.dot(nWorld, toCam) > -0.05 && sr > 6) {
        UI.aimEl.style.display = 'block';
        UI.aimEl.style.left = (pr.x * W) + 'px';
        UI.aimEl.style.top = (pr.y * H) + 'px';
      } else {
        UI.aimEl.style.display = 'none';
      }
      const lat = Math.asin(M.clamp(UI.aim[1], -1, 1)) * 180 / Math.PI;
      const lon = Math.atan2(UI.aim[2], UI.aim[0]) * 180 / Math.PI;
      $('aim-coord').textContent = (lat >= 0 ? 'N' : 'S') + Math.abs(lat).toFixed(1) + '° ' +
        (lon >= 0 ? 'E' : 'W') + Math.abs(lon).toFixed(1) + '°';
    } else {
      UI.aimEl.style.display = 'none';
    }
  };

  /* ------------------------------ 输入 ------------------------------ */
  function bindInput() {
    const cv = $('gl');
    let down = false, moved = false, lx = 0, ly = 0, downTime = 0;

    cv.addEventListener('pointerdown', (e) => {
      down = true; moved = false; lx = e.clientX; ly = e.clientY; downTime = performance.now();
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      if (Math.abs(dx) + Math.abs(dy) > 3) { moved = true; cv.classList.add('dragging'); }
      SS.Cam.orbit(dx * 0.005, dy * 0.005);
      lx = e.clientX; ly = e.clientY;
    });
    cv.addEventListener('pointerup', (e) => {
      down = false;
      cv.classList.remove('dragging');
      if (moved || performance.now() - downTime > 400) return;
      clickPick(e.clientX, e.clientY, false);
    });
    cv.addEventListener('dblclick', (e) => clickPick(e.clientX, e.clientY, true));
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      SS.Cam.zoom(Math.exp(M.clamp(e.deltaY, -220, 220) * 0.0016));
    }, { passive: false });

    // 触屏双指缩放
    let pinch = null;
    cv.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pinch) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        SS.Cam.zoom(pinch / Math.max(d, 1));
        pinch = d;
      }
    }, { passive: true });
    cv.addEventListener('touchend', () => { pinch = null; }, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setTimeScale(UI.timeScale === 0 ? (UI.prevScale || 1) : 0);
        if (UI.timeScale === 0) UI.prevScale = 1;
      } else if (e.key === 'f' || e.key === 'F') fire();
      else if (e.key === 'r' || e.key === 'R') $('btn-reset').click();
      else if (e.key === 'h' || e.key === 'H') $('help-modal').classList.toggle('open');
    });
  }

  function clickPick(cx, cy, dbl) {
    const rect = $('gl').getBoundingClientRect();
    const sx = (cx - rect.left) / rect.width;
    const sy = (cy - rect.top) / rect.height;
    const rd = SS.Cam.ray(sx, sy);
    const hit = SS.World.pick(SS.Cam.pos, rd, SS.R.settings.sizeBoost, 0.006);
    if (!hit) return;
    const b = hit.body;
    // 命中当前目标（且看得清）→ 改瞄准点；否则锁定该天体
    const sr = b.screenSize;
    if (!dbl && b === UI.target && sr > 12) {
      const dir = SS.World.pickSurface(b, SS.Cam.pos, rd, SS.R.settings.sizeBoost);
      if (dir) {
        UI.aim = dir;
        probeAim();
        refreshPreview();
        return;
      }
    }
    SS.Cam.setFocus(b);
    UI.setTarget(b);
  }

  /* ------------------------------ Toast ----------------------------- */
  function toast(msg, kind) {
    const box = $('toast');
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      setTimeout(() => el.remove(), 420);
    }, 4200);
    while (box.children.length > 4) box.removeChild(box.firstChild);
  }
  UI.toast = toast;

  SS.UI = UI;
})(window);
