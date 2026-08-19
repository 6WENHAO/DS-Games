/* ============================================================
   palette.js — 配色表（UI / 法庭 / 场景 / 角色底色）
   全部按 NDS 15bit 可表现的范围挑选
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U;
  var P = AA.PAL = {};

  /* ---------- 界面 ---------- */
  P.ui = {
    // 对话框（半透明深蓝黑 + 亮边）
    boxTop: '#0b1024',
    boxBot: '#070a18',
    boxEdge: '#c9d8f5',
    boxEdge2: '#5f7bb5',
    boxInner: '#1b2a52',
    text: '#ffffff',
    textShadow: '#1a2242',
    // 说话者名牌
    nameBg1: '#132049',
    nameBg2: '#0a1030',
    nameEdge: '#e2ecff',
    nameText: '#ffffff',
    // 强调色（红字＝关键词）
    hot: '#ff6a6a',
    cool: '#7fd4ff',
    gold: '#ffd964',
    green: '#8ef08a',
    // 触摸屏底
    tsBg1: '#20305f',
    tsBg2: '#101838',
    tsPanel: '#e9e2c8',
    // 按钮（法庭记录 / 逼供 / 举证）
    btnFace1: '#3f5db0',
    btnFace2: '#1b2a5e',
    btnEdge: '#dce6ff',
    btnEdgeDark: '#0c1230',
    btnText: '#ffffff',
    btnHotFace1: '#c8434f',
    btnHotFace2: '#6d1520',
    btnGoldFace1: '#e0b155',
    btnGoldFace2: '#8a5f16',
    // 生命条
    hpFill1: '#ffe27a',
    hpFill2: '#e07a1e',
    hpBack: '#221a10',
    hpEdge: '#f4e6c0',
    hpLost: '#5a2530'
  };

  /* ---------- 法庭 3D 材质 ---------- */
  P.court = {
    floor: '#6b5e4e',
    floorAlt: '#5d5142',
    carpet: '#7b2230',
    carpetDark: '#5a141f',
    wall: '#9d8f76',
    wallHi: '#b4a68c',
    wallLo: '#7a6e59',
    wood: '#7c5230',
    woodHi: '#96693e',
    woodLo: '#4f321a',
    woodTop: '#8b5f38',
    marble: '#cfc7b4',
    marbleLo: '#a49b88',
    trim: '#c9a44c',
    gold: '#c9a44c',
    goldLo: '#8d7130',
    bench: '#5a3a20',
    curtain: '#2a3d78',
    curtainLo: '#18254f',
    glass: '#8fb2d6',
    dark: '#2a2b38',
    seal: '#d8cda6'
  };
  P.court.trim = '#c9a44c';

  /* ---------- 电台录音室 ---------- */
  P.studio = {
    wall: '#3b4360',
    wallHi: '#4d5679',
    wallLo: '#2a3049',
    foam: '#333a52',
    floor: '#4a3f3a',
    desk: '#5b4436',
    deskHi: '#71563f',
    metal: '#8b93a8',
    metalHi: '#b4bccd',
    metalLo: '#5d6478',
    neonR: '#ff4a5e',
    neonB: '#59c8ff',
    neonG: '#7dffb0',
    glassBlue: '#4e7fa8',
    dark: '#1b1f30',
    screenGlow: '#5ce0ff'
  };
  P.studio.foam = '#333a52';

  /* ---------- 拘留所 ---------- */
  P.jail = {
    wall: '#5d5b52',
    wallHi: '#6f6c61',
    wallLo: '#454339',
    glass: '#7f95a6',
    bar: '#3a3a3a',
    barHi: '#6a6a6a',
    floor: '#4b4a44',
    light: '#e8e0b8'
  };

  /* ---------- 事务所 ---------- */
  P.office = {
    wall: '#8f7c62',
    wallHi: '#a2907a',
    wallLo: '#6d5c46',
    sofa: '#7c3a3a',
    sofaHi: '#95504b',
    desk: '#6a4a2e',
    plant: '#3f7a44',
    plantHi: '#57a05a',
    paper: '#e8e0c8'
  };

  /* ---------- 角色基础色 ---------- */
  P.skin = {
    base: '#f6cfa8',
    lo: '#dda67e',
    hi: '#ffe9cf',
    line: '#6f4426'
  };
  P.skinTan = { base: '#dfa877', lo: '#bd8355', hi: '#f2c79b', line: '#5c3418' };
  P.skinPale = { base: '#fbe0c4', lo: '#e5bb9a', hi: '#fff4e6', line: '#7a5333' };

  P.line = '#241a16';          // 通用描边（不是纯黑，更有手绘味）
  P.lineSoft = '#3a2c26';
  P.white = '#ffffff';
  P.offwhite = '#f0eee4';

  /* ---------- 特效 ---------- */
  P.fx = {
    speedA: '#ffffff',
    speedB: '#1b2340',
    shockBg1: '#1a2a6a',
    shockBg2: '#0a1030',
    objRed1: '#ff5a4a',
    objRed2: '#8e1010',
    objBlue1: '#4aa8ff',
    objBlue2: '#0e2f7a',
    objEdge: '#ffffff',
    objShadow: '#20101a',
    flash: '#ffffff',
    dmgRed: '#ff2a3a'
  };

  /* 生成一条明暗渐层（用于低多面数模型的“赛璐璐”着色） */
  P.ramp = function (base, n, lowAmt, hiAmt) {
    n = n || 4; lowAmt = lowAmt == null ? .55 : lowAmt; hiAmt = hiAmt == null ? .3 : hiAmt;
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0 : i / (n - 1);      // 0 = 最暗
      out.push(t < .5 ? U.shadow(base, U.lerp(lowAmt, 0, t * 2))
        : U.hilite(base, U.lerp(0, hiAmt, (t - .5) * 2)));
    }
    return out;
  };

})(window.AA);
