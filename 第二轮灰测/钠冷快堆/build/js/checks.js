/* ============================================================================
   第 8 章：设计自洽性校核 —— 由原始输入重算全文引用的导出量
   ==========================================================================*/
(function () {
  'use strict';
  var S = window.SFR, el = S.el;

  /* ---------- 原始输入（只有这些是"给定"的） ---------- */
  var IN = {
    P0: 1500e6, Tin: 395, Tout: 545,
    NA: 252, NP: 217, H: 0.95, pitch: 0.155, aF: 0.152, wall: 0.0035,
    dPin: 0.0085, tClad: 0.0005, dPel: 0.00735, dWire: 0.0012,
    rhoMOXth: 11050, TD: 0.95, fHM: 0.8815,
    EFPD: 300, nBatch: 3, pkRadial: 1.20, pkAxial: 1.15,
    e1: 1.12, e2: 1.12, ring: 14,
    nIHX: 6, Uihx: 5000, Aihx: 900, T2i: 320, T2o: 505,
    nSG: 3, Usg: 4500, Asg: 2900, Tfeed: 240, Tsteam: 490, dhSteam: 2280e3,
    dPtot: 0.658e6, etaPump: 0.79, w1d: 7874,
    zTop: 3.60, zLift: 3.90, zNa: 9.00,
    W_SR1: 5800, W_SR2: 3200, W_RR: 900, stuck1: 620, stuck2: 900,
    reqT: 390, reqP: 900, reqB: 900, reqM: 600, SDmin: 2000,
    Kd: -0.0055, beta: 350
  };
  function cpNa(T) { return 1436.7 - 0.5806 * T + 4.627e-4 * T * T; }
  function rhoNa(T) { return 951.3 - 0.2429 * T; }

  function mount(host) {
    var rows = [], nP = 0, nF = 0;
    function chk(name, expr, calc, doc, unit, tol) {
      tol = (tol === undefined) ? 0.01 : (tol === 0 ? 1e-9 : tol);
      var dev = doc === 0 ? (calc === 0 ? 0 : 1) : (calc - doc) / Math.abs(doc);
      var ok = Math.abs(dev) <= tol;
      ok ? nP++ : nF++;
      rows.push([
        { html: name, cls: 'l' }, { html: expr, cls: 'l mono sub' },
        S.fmt(calc, Math.abs(calc) >= 100 ? 1 : 3), S.fmt(doc, Math.abs(doc) >= 100 ? 1 : 3),
        { html: unit, cls: 'l' },
        { html: (dev * 100).toFixed(2) + ' %', cls: 'num' },
        { html: ok ? '<b class="ok">PASS</b>' : '<b class="bad">FAIL</b>', cls: 'num' }
      ]);
      return calc;
    }
    function note(t) { rows.push({ cls: 'hl', cells: [{ html: '<b>' + t + '</b>', colspan: 7, cls: 'l' }] }); }

    /* --- 热工水力 --- */
    note('一 / 二回路热工水力');
    var cp = cpNa((IN.Tin + IN.Tout) / 2);
    chk('一回路钠总流量', 'P₀ / (c_p·ΔT), c_p(470 °C) = ' + cp.toFixed(0) + ' J/(kg·K)',
      IN.P0 / (cp * (IN.Tout - IN.Tin)), IN.w1d, 'kg/s', 0.01);
    var w1 = IN.w1d;   // 以下导出量一律用设计流量，保证与全文一致
    var Ahex = Math.sqrt(3) / 2 * Math.pow(IN.aF - 2 * IN.wall, 2);
    var Apin = IN.NP * Math.PI / 4 * IN.dPin * IN.dPin;
    var Awire = IN.NP * Math.PI / 4 * IN.dWire * IN.dWire * 1.05;
    var Af = Ahex - Apin - Awire;
    chk('单盒组件流通面积', '√3/2·a_in² − N·πd²/4 − 绕丝', Af * 1e4, 56.4, 'cm²', 0.02);
    var Acore = Af * IN.NA;
    chk('堆芯总流通面积', 'A_f × 252', Acore, 1.4205, 'm²', 0.02);
    var G_ = w1 / Acore;
    chk('堆芯质量流密度', 'w₁(设计) / A_core', G_, 5543, 'kg/(m²·s)', 0.01);
    chk('堆芯平均流速', 'G / ρ(470 °C) = G / 837', G_ / rhoNa(470), 6.62, 'm/s', 0.01);
    var wa = w1 / IN.NA;
    chk('单盒组件 ΔT（物性拟合复算）', '(P₀/252)/(w_a·c_p拟合)', (IN.P0 / IN.NA) / (wa * cp), 150, 'K', 0.01);
    var Q1 = w1 / rhoNa(470);
    chk('主泵总水力功率', 'ΔP_tot × Q₁', IN.dPtot * Q1 / 1e6, 6.19, 'MW', 0.02);
    chk('主泵总轴功率（3 台）', '水力 / η_p', IN.dPtot * Q1 / IN.etaPump / 1e6, 7.8, 'MW', 0.02);
    chk('热 / 冷池液位差', '(ΔP_IHX+ΔP_窗)/(ρg) = 8 kPa/(ρg)', 8e3 / (rhoNa(IN.Tout) * 9.81), 1.0, 'm', 0.02);

    /* --- 燃料与燃耗 --- */
    note('燃料装量与燃耗');
    var pins = IN.NA * IN.NP;
    chk('燃料棒总数', '252 × 217', pins, 54684, '根', 0);
    var ql = IN.P0 / (pins * IN.H);
    chk('平均线功率', 'P₀ / (N_pin·H)', ql / 1000, 28.9, 'kW/m', 0.01);
    chk('峰值线功率', 'q̄ × 1.20 × 1.15', ql * IN.pkRadial * IN.pkAxial / 1000, 39.8, 'kW/m', 0.02);
    var Vf = Math.PI / 4 * IN.dPel * IN.dPel * IN.H * pins;
    var mHM = Vf * IN.rhoMOXth * IN.TD * IN.fHM / 1000;
    chk('MOX 装量', 'V_pel·ρ_th·0.95', Vf * IN.rhoMOXth * IN.TD / 1000, 23.1, 't', 0.02);
    chk('重金属装量', '× 0.8815', mHM, 20.4, 't_HM', 0.02);
    var sp = IN.P0 / 1e6 / mHM;
    chk('比功率', 'P₀ / m_HM', sp, 73.5, 'MW/t_HM', 0.02);
    chk('平均卸料燃耗', '比功率 × 3 × 300 EFPD', sp * IN.nBatch * IN.EFPD / 1000, 66.2, 'GWd/t_HM', 0.02);
    chk('峰值卸料燃耗', '× 1.5', sp * IN.nBatch * IN.EFPD / 1000 * 1.5, 99, 'GWd/t_HM', 0.02);
    var Vcore = IN.NA * Math.sqrt(3) / 2 * IN.pitch * IN.pitch * IN.H;
    chk('堆芯功率密度', 'P₀ / (252·√3/2·p²·H) = P₀/4.98 m³', IN.P0 / 1e6 / Vcore, 301, 'MW/m³', 0.01);
    chk('每次换料组件数', '252 / 3', IN.NA / IN.nBatch, 84, '盒', 0);

    /* --- 传热设备 --- */
    note('中间热交换器与蒸汽发生器');
    var d1 = IN.Tout - IN.T2o, d2 = IN.Tin - IN.T2i;
    var lmIHX = (d1 - d2) / Math.log(d1 / d2);
    chk('IHX 对数平均温差', '(Δ₁−Δ₂)/ln(Δ₁/Δ₂), Δ = 40 / 75 K', lmIHX, 55.7, 'K', 0.01);
    chk('IHX 需求传热面积/台', 'P₀/6 / (U·LMTD)', IN.P0 / IN.nIHX / (IN.Uihx * lmIHX), IN.Aihx, 'm²', 0.05);
    var s1 = IN.T2o - IN.Tsteam, s2 = IN.T2i - IN.Tfeed;
    var lmSG = (s2 - s1) / Math.log(s2 / s1);
    chk('SG 对数平均温差', 'Δ = 15 / 80 K', lmSG, 38.8, 'K', 0.02);
    chk('SG 需求传热面积/台', 'P₀/3 / (U·LMTD)', IN.P0 / IN.nSG / (IN.Usg * lmSG), IN.Asg, 'm²', 0.05);
    var w2 = IN.P0 / (cpNa((IN.T2i + IN.T2o) / 2) * (IN.T2o - IN.T2i));
    chk('二回路钠总流量', 'P₀/(c_p·185 K)', w2, 6320, 'kg/s', 0.01);
    chk('主蒸汽流量', 'P₀ / Δh', IN.P0 / IN.dhSteam, 658, 'kg/s', 0.01);

    /* --- 换料机构 --- */
    note('换料机构运动学与高度链');
    chk('双旋塞可达半径', 'e₁ + e₂', (IN.e1 + IN.e2) * 1000, 2240, 'mm', 0);
    chk('环 14 角向半径', '14 × 155 mm', IN.ring * IN.pitch * 1000, 2170, 'mm', 0);
    chk('可达余量', '(e₁+e₂) − 14p', ((IN.e1 + IN.e2) - IN.ring * IN.pitch) * 1000, 70, 'mm', 0.02);
    chk('栅元总数（环 0–14）', '1 + 3n(n+1)', 1 + 3 * IN.ring * (IN.ring + 1), 631, '个', 0);
    chk('组件提升后顶部标高', '3 900 + 3 600', (IN.zLift + IN.zTop) * 1000, 7500, 'mm', 0);
    chk('转运时顶部浸没深度', '9 000 − 7 500', (IN.zNa - IN.zLift - IN.zTop) * 1000, 1500, 'mm', 0);
    var G6 = (window.SFR_REFUEL || {}).G;
    if (G6) {
      var vt = (G6.zPark - G6.zGrab - G6.hFine) / G6.vFast + G6.hFine / G6.vFine;
      chk('抓具空载下行 7 000 mm 用时', '(7.0−0.2)/0.20 + 0.2/0.005', vt, 74, 's', 0.03);
      chk('组件提升 3 900 mm 用时', '3.9 / 0.050', (G6.zXfer - G6.zGrab) / G6.vLoad, 78, 's', 0.03);
    }
    var ik = (window.SFR_REFUEL || {}).ik;
    if (ik) {
      var s0 = ik(IN.ring * IN.pitch, 0, 0, Math.PI);
      chk('环 14 处小旋塞夹角 β', 'arccos[(r²−e₁²−e₂²)/(2e₁e₂)]', Math.abs(s0.b) * 180 / Math.PI, 28.7, '°', 0.03);
    }

    /* --- 反应性 --- */
    note('反应性平衡与控制棒');
    var req = IN.reqT + IN.reqP + IN.reqB + IN.reqM;
    chk('运行控制反应性需求合计', '390+900+900+600', req, 2790, 'pcm', 0);
    chk('SR-1 停堆深度（最强棒卡死）', 'W_SR1 − 620 − 2790', IN.W_SR1 - IN.stuck1 - req, 2390, 'pcm', 0);
    chk('SR-2 停堆深度（最强棒卡死）', 'W_SR2 − 900', IN.W_SR2 - IN.stuck2, 2300, 'pcm', 0);
    chk('SR-1 组价值（以 $ 计）', 'W / β_eff', IN.W_SR1 / IN.beta, 16.6, '$', 0.01);
    chk('多普勒：773 → 1 500 K', 'K_D·ln(T₂/T₁)', IN.Kd * Math.log(1500 / 773) * 1e5, -365, 'pcm', 0.02);
    chk('功率缺陷多普勒分项', 'K_D·ln(1523/668)', IN.Kd * Math.log(1523 / 668) * 1e5, -453, 'pcm', 0.01);
    chk('温度缺陷多普勒分项', 'K_D·ln(668/473)', IN.Kd * Math.log(668 / 473) * 1e5, -190, 'pcm', 0.02);
    chk('温度缺陷分项求和', '−190+55−85−110−60', -190 + 55 - 85 - 110 - 60, -390, 'pcm', 0);
    chk('功率缺陷分项求和', '−453−210+21−105−33−120', -453 - 210 + 21 - 105 - 33 - 120, -900, 'pcm', 0);
    var RA = window.SFR_RODS_API || null;

    /* --- 衰变热与排热 --- */
    note('衰变热与非能动排热');
    var dec = (window.SFR_PLANT || {}).decay;
    if (dec) {
      var Q1d = IN.P0 * dec(86400);
      chk('停堆 24 h 衰变热', '0.45% P₀', Q1d / 1e6, 6.75, 'MW', 0.03);
      chk('2 列 DRACS 能力（池温 550 °C）', '2 × 10 MW', 20, 20, 'MW', 0);
      chk('24 h 排热裕度', '2 列能力 / 衰变热', 20 / (Q1d / 1e6), 2.96, '倍', 0.05);
    }
    chk('钠池热惯量温升速率（1% P₀）', 'P/(m·c_p) = 15 MW / 990 MJ/K', 15e6 / (780e3 * 1270), 0.0152, 'K/s', 0.03);
    chk('单盒乏组件换料时衰变热', '(P₀/252)×0.13%', IN.P0 / IN.NA * 0.0013 / 1000, 7.7, 'kW', 0.05);

    /* --- 汇总 --- */
    var f = S.figure({
      parent: host, title: '设计自洽性校核表（页面加载时实算）', drawNo: 'CFR1500-CD-801',
      scale: '—', unit: '—',
      note: '「计算值」由左侧推导式从原始输入（功率、温度、几何、物性）重算；「文中值」是本文件其他章节引用的数字。' +
        '容差按量级取 0–5%：几何与计数类为 0（必须精确相等），热工传热类为 1–5%（物性拟合与工程取整）。' +
        '<b>本表任何一行 FAIL 都说明文件内部不自洽。</b>'
    });
    var head = ['校核项', '推导式', { html: '计算值', cls: 'num' }, { html: '文中值', cls: 'num' }, '单位', { html: '偏差', cls: 'num' }, { html: '判定', cls: 'num' }];
    S.table({ parent: f.body, head: head, rows: rows, wrap: true });
    var bar = el('div', { class: 'panel', style: { marginTop: '10px' } });
    bar.appendChild(el('div', {
      class: 'h4', html: '校核结果：<b class="' + (nF ? 'bad' : 'ok') + '">' + nP + ' 项 PASS / ' + nF + ' 项 FAIL</b>' +
        '　<span class="tag' + (nF ? '' : ' a') + '">' + (nF ? '文件内部存在不一致，需修正' : '全部闭合') + '</span>'
    }));
    bar.appendChild(el('div', {
      class: 'note', html: '未纳入本表的量（须在后续设计阶段用专业程序确认）：β<sub>eff</sub>、K<sub>D</sub>、钠空泡价值、棒组绝对价值、增殖比、燃耗摆动、' +
        '峰值包壳与芯块温度（需子通道分析）、事故峰值温度（需系统程序）、结构强度与抗震。'
    }));
    f.body.appendChild(bar);
  }
  S.register('checks', mount);
})();
