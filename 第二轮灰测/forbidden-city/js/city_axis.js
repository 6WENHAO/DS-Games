/* ============================================================
   中轴线：外朝（太和门·三大殿）与内廷（乾清门·后三宫）
   ============================================================ */
'use strict';

/* 内金水河：自西北入，沿西侧南下，横贯太和门前，东南出 */
CITY.goldenWater = (A) => {
  const G = A.G, V = A.V;
  const W = 11;
  const put = (x0, z0, x1, z1) => {
    G.rect(x0, z0, x1, z1, GM.water, FC.WATER_Y);
    // 河帮
    for (let x = Math.round(x0) - 1; x <= Math.round(x1); x++)
      for (let z = Math.round(z0) - 1; z <= Math.round(z1); z++) {
        const edge = (x < x0 || x >= x1 || z < z0 || z >= z1);
        if (edge) { V.set(x, -1, z, C.marbleS); V.set(x, -2, z, C.stone); V.set(x, -3, z, C.stone); }
      }
  };
  // 西路：自西北角南下
  put(-330, -430, -330 + W, -150);
  put(-330, -160, -250, -160 + W);
  put(-250, -160, -250 + W, 250);
  put(-250, 250, -180, 250 + W);
  put(-180, 250, -180 + W, 392);
  // 横贯太和门前广场（自西向东）
  put(-180, 392, 180, 392 + W);
  // 东路出宫
  put(180, 392, 180 + W, 250);
  put(180, 250, 260, 250 + W);
  put(260, 250, 260 + W, 430);
  A.reg('内金水河', -60, 388, 60, 404, 2, '水系',
    '内金水河自紫禁城西北引玉泉山水入宫，蜿蜒二千余米，兼具消防、排水与造景之用，河上共架桥二十余座。');
  // 断虹桥（武英殿东）
  A.bridge(-245, 40, 5, 12, { dir: 'ns', rise: 2, y: 1 });
  A.reg('断虹桥', -252, 26, -238, 54, 4, '桥梁', '元代遗构，单孔石拱桥，桥栏望柱上刻有石狮二十只，形态各异。');
};

/* ------------------------------------------------------------
   外朝：午门内广场 → 太和门 → 三大殿
   ------------------------------------------------------------ */
CITY.outerCourt = (A) => {
  const V = A.V, G = A.G;
  CITY.goldenWater(A);

  /* ---- 午门内广场与内金水桥（五座）---- */
  G.rect(-180, 340, 180, 440, GM.plaza, 0);
  for (const [x, w] of [[0, 7], [-26, 5], [26, 5], [-50, 4], [50, 4]]) {
    A.bridge(x, 397, w, 12, { dir: 'ns', rise: 2, y: 1, imperial: x === 0 });
  }
  A.reg('内金水桥', -58, 386, 58, 410, 4, '桥梁',
    '太和门前内金水河上的五座石桥，中央御路桥供皇帝专用，两侧王公桥、品级桥依次外列。');

  /* ---- 太和门及左右门 ---- */
  A.hall({
    name: '太和门', x: 0, z: 330, w: 40, d: 20, ph: 4, bh: 10, tiers: 2, over: 4, rh: 9,
    type: 'gable', bay: 5, imperial: true, railing: true, cat: '外朝',
    sides: { s: 'door', n: 'door', e: 'wall', w: 'wall' },
    desc: '紫禁城外朝正门，面阔九间、重檐歇山顶。明代皇帝在此“御门听政”，清顺治帝在此颁布大清入关第一诏。',
  });
  A.lion(-24, 352); A.lion(24, 352);
  A.hall({ name: '昭德门', x: -52, z: 332, w: 18, d: 12, ph: 3, bh: 7, over: 3, rh: 6, type: 'gable', bay: 4, cat: '门' });
  A.hall({ name: '贞度门', x: 52, z: 332, w: 18, d: 12, ph: 3, bh: 7, over: 3, rh: 6, type: 'gable', bay: 4, cat: '门' });
  // 太和门东西：协和门、熙和门
  A.hall({ name: '协和门', x: 150, z: 330, w: 14, d: 20, ph: 3, bh: 7, over: 3, rh: 7, type: 'gable', bay: 4, cat: '门',
    sides: { s: 'wall', n: 'wall', e: 'door', w: 'door' } });
  A.hall({ name: '熙和门', x: -150, z: 330, w: 14, d: 20, ph: 3, bh: 7, over: 3, rh: 7, type: 'gable', bay: 4, cat: '门',
    sides: { s: 'wall', n: 'wall', e: 'door', w: 'door' } });
  // 太和门院落东西庑
  A.corridor(-176, 344, -76, 352, { h: 5, face: 'n' });
  A.corridor(76, 344, 176, 352, { h: 5, face: 'n' });
  A.corridor(-176, 300, -168, 344, { h: 5, face: 'e' });
  A.corridor(168, 300, 176, 344, { h: 5, face: 'w' });

  /* ---- 太和殿广场 ---- */
  G.rect(-160, 190, 160, 320, GM.plaza, 0);
  G.rect(-14, 190, 14, 320, GM.slab, 0);       // 御道
  // 东西庑房（连檐通脊）
  A.corridor(-160, 200, -150, 318, { h: 6, face: 'e', rh: 4 });
  A.corridor(150, 200, 160, 318, { h: 6, face: 'w', rh: 4 });
  // 体仁阁（东）· 弘义阁（西）：二层楼阁
  const ge = (x, name, desc) => {
    A.platform(x - 18, 232, x + 18, 268, 0, 3, { style: 'sumeru', railing: true });
    A.body(x - 16, 234, x + 16, 266, 3, 7, { sides: { s: 'door', n: 'wall', e: 'wall', w: 'wall' }, bay: 4 });
    A.roof(x - 20, 230, x + 20, 270, 10, 4, { type: 'hip', thk: 1, ridgeH: 1, lift: 1, tref: 5,
      hole: { x0: x - 15, z0: 235, x1: x + 15, z1: 265 } });
    A.body(x - 15, 235, x + 15, 265, 15, 6, { sides: { s: 'window', n: 'window', e: 'window', w: 'window' }, bay: 4, floor: C.beamDark });
    const top = A.roof(x - 19, 231, x + 19, 269, 21, 8, { type: 'hip', ridgeH: 2, lift: 2 });
    A.stairs(x, 268, 9, 0, 3, 's', {});
    A.reg(name, x - 20, 230, x + 20, 270, top, '外朝', desc);
  };
  ge(122, '体仁阁', '太和殿东侧崇楼，明称文楼，清乾隆时重建。上下二层，曾为皇家缎库。');
  ge(-122, '弘义阁', '太和殿西侧崇楼，明称武楼，与体仁阁东西对称，清代为内库贮银之所。');
  // 中左门/中右门、左翼门/右翼门
  A.hall({ name: '中右门', x: -68, z: 196, w: 12, d: 12, ph: 2, bh: 6, over: 2, rh: 5, type: 'gable', bay: 3, cat: '门' });
  A.hall({ name: '中左门', x: 68, z: 196, w: 12, d: 12, ph: 2, bh: 6, over: 2, rh: 5, type: 'gable', bay: 3, cat: '门' });
  A.hall({ name: '右翼门', x: -152, z: 250, w: 10, d: 14, ph: 2, bh: 6, over: 2, rh: 5, type: 'gable', bay: 3, cat: '门' });
  A.hall({ name: '左翼门', x: 152, z: 250, w: 10, d: 14, ph: 2, bh: 6, over: 2, rh: 5, type: 'gable', bay: 3, cat: '门' });

  /* ---- 三台（工字形汉白玉台基，高8米）---- */
  const TH = 8;
  const tri = [
    [-80, 92, 80, 196],      // 太和殿段（宽）
    [-46, 16, 46, 92],       // 中和殿段（窄腰）
    [-64, -62, 64, 16],      // 保和殿段
  ];
  for (const [x0, z0, x1, z1] of tri) {
    // 三层叠落
    A.platform(x0, z0, x1, z1, 0, 3, { style: 'plain', face: C.marbleD, top: C.marbleS, stone: C.stone });
    A.platform(x0 + 3, z0 + 3, x1 - 3, z1 - 3, 3, 3, { style: 'plain', face: C.marbleD, top: C.marbleS });
    A.platform(x0 + 6, z0 + 6, x1 - 6, z1 - 6, 6, 2, { style: 'plain', face: C.marbleD, top: C.marble });
  }
  // 栏杆（三层各一圈，南面留踏跺口）
  A.railing(-80, 92, 80, 196, 3, [{ x0: -14, z0: 190, x1: 14, z1: 200 }]);
  A.railing(-77, 95, 77, 193, 6, [{ x0: -14, z0: 188, x1: 14, z1: 198 }]);
  A.railing(-74, 98, 74, 190, 8, [{ x0: -14, z0: 186, x1: 14, z1: 196 }]);
  A.railing(-46, 16, 46, 92, 3, []);
  A.railing(-64, -62, 64, 16, 3, [{ x0: -12, z0: -66, x1: 12, z1: -58 }]);
  A.railing(-58, -56, 58, 10, 8, [{ x0: -12, z0: -60, x1: 12, z1: -52 }]);
  // 南面三层大踏跺（中为御路）
  A.stairs(0, 196, 28, 0, 3, 's', { imperial: true });
  A.stairs(0, 193, 26, 3, 6, 's', { imperial: true });
  A.stairs(0, 190, 24, 6, 8, 's', { imperial: true });
  // 东西侧踏跺
  for (const s of [-1, 1]) {
    A.stairs(s * 80, 150, 12, 0, 8, s > 0 ? 'e' : 'w', {});
    A.stairs(s * 64, -20, 10, 0, 8, s > 0 ? 'e' : 'w', {});
  }
  // 北面下三台
  A.stairs(0, -62, 22, 0, 8, 'n', { imperial: true });
  A.reg('三台（汉白玉台基）', -80, -62, 80, 196, TH + 1, '外朝',
    '三大殿共处一座工字形汉白玉台基之上，台高8.13米，四周环以栏板望柱，龙头石首伸出以排雨水。');

  /* ---- 太和殿 ---- */
  // 月台（丹陛）
  A.platform(-46, 150, 46, 186, TH, 2, { style: 'plain', face: C.marbleD, top: C.marble });
  A.railing(-46, 150, 46, 186, TH + 2, [{ x0: -14, z0: 180, x1: 14, z1: 190 }]);
  A.hall({
    name: '太和殿', x: 0, z: 128, w: 64, d: 37, y: TH, ph: 3, bh: 14, tiers: 2, over: 7, rh: 12,
    type: 'hip', bay: 6, imperial: true, railing: true, interior: true, throne: true, cat: '外朝三大殿',
    sides: { s: 'door', n: 'door', e: 'window', w: 'window' }, pave: false,
    desc: '俗称金銮殿，明永乐十八年建成，现存为清康熙三十四年重建。面阔十一间62.24米，进深五间37.2米，通高35.05米，是中国现存最大的木结构大殿。殿内设九龙金漆宝座，明清两代皇帝登基、大婚、册立皇后、命将出征等大典均在此举行。',
  });
  // 月台陈设：铜龟、铜鹤、日晷、嘉量、铜鼎
  A.craneTurtle(-30, 168, 10); A.craneTurtle(-24, 168, 10);
  A.craneTurtle(30, 168, 10); A.craneTurtle(24, 168, 10);
  A.sundial(-38, 172, 10); A.sundial(38, 172, 10);
  // 十八座铜鼎（三台东西两侧）
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) A.cauldron(s * 78, 100 + i * 11, 8);

  /* ---- 中和殿 ---- */
  A.hall({
    name: '中和殿', x: 0, z: 52, w: 25, d: 25, y: TH, ph: 3, bh: 11, over: 5, rh: 12,
    type: 'pyramid', bay: 5, railing: true, imperial: true, cat: '外朝三大殿', pave: false,
    sides: { s: 'door', n: 'door', e: 'door', w: 'door' }, interior: true, tallFinial: true,
    desc: '方形单檐四角攒尖顶，覆黄琉璃瓦、镀金宝顶。皇帝赴太和殿大典前在此稍事休息、接受执事官员朝拜；每十年纂修玉牒亦在此呈览。',
  });
  /* ---- 保和殿 ---- */
  A.hall({
    name: '保和殿', x: 0, z: -22, w: 50, d: 25, y: TH, ph: 3, bh: 12, tiers: 2, over: 5, rh: 10,
    type: 'gable', bay: 5, railing: true, imperial: true, interior: true, cat: '外朝三大殿', pave: false,
    sides: { s: 'door', n: 'door', e: 'window', w: 'window' },
    desc: '重檐歇山顶，面阔九间。明代册立皇后、皇太子时在此更衣；清代殿试自乾隆后移至此举行，为“天子门生”登第之地。',
  });

  /* ---- 三台两侧：中和殿东西 弘政门/后左门等小门 ---- */
  A.hall({ name: '后右门', x: -74, z: -66, w: 10, d: 10, ph: 2, bh: 6, over: 2, rh: 5, type: 'gable', bay: 3, cat: '门' });
  A.hall({ name: '后左门', x: 74, z: -66, w: 10, d: 10, ph: 2, bh: 6, over: 2, rh: 5, type: 'gable', bay: 3, cat: '门' });
};

/* ------------------------------------------------------------
   内廷：乾清门横街 → 后三宫
   ------------------------------------------------------------ */
CITY.innerCourt = (A) => {
  const V = A.V, G = A.G;
  /* ---- 乾清门横街 ---- */
  G.rect(-200, -96, 200, -66, GM.plaza, 0);
  // 横街南侧庑房（保和殿后）
  A.corridor(-150, -96, -90, -88, { h: 5, face: 'n' });
  A.corridor(90, -96, 150, -88, { h: 5, face: 'n' });
  /* ---- 乾清门 ---- */
  A.hall({
    name: '乾清门', x: 0, z: -104, w: 30, d: 14, ph: 4, bh: 9, over: 4, rh: 8,
    type: 'gable', bay: 5, imperial: true, railing: true, cat: '内廷正门',
    sides: { s: 'open', n: 'open', e: 'wall', w: 'wall' },
    desc: '内廷正门，面阔五间、单檐歇山顶，两侧有八字影壁。清康熙以后，皇帝在此“御门听政”，为清代前期最重要的听政场所。',
  });
  // 门前镀金铜狮、八字影壁
  A.lion(-20, -92); A.lion(20, -92);
  A.wallRun(-46, -96, -18, -96, { h: 6, t: 2 });
  A.wallRun(18, -96, 46, -96, { h: 6, t: 2 });
  // 内左门、内右门
  A.hall({ name: '内右门', x: -34, z: -106, w: 10, d: 10, ph: 2, bh: 6, over: 2, rh: 5, type: 'gable', bay: 3, cat: '门' });
  A.hall({ name: '内左门', x: 34, z: -106, w: 10, d: 10, ph: 2, bh: 6, over: 2, rh: 5, type: 'gable', bay: 3, cat: '门' });
  // 景运门（东）、隆宗门（西）
  A.hall({
    name: '景运门', x: 92, z: -82, w: 14, d: 20, ph: 3, bh: 8, over: 3, rh: 7, type: 'gable', bay: 4, cat: '门',
    sides: { s: 'wall', n: 'wall', e: 'door', w: 'door' },
    desc: '内廷与外朝东侧要冲，与隆宗门同为“禁门”，非奏事待旨者不许私入。',
  });
  A.hall({
    name: '隆宗门', x: -92, z: -82, w: 14, d: 20, ph: 3, bh: 8, over: 3, rh: 7, type: 'gable', bay: 4, cat: '门',
    sides: { s: 'wall', n: 'wall', e: 'door', w: 'door' },
    desc: '内廷西侧禁门，门额至今留有嘉庆十八年天理教起义时射入的箭头。',
  });

  /* ---- 后三宫院墙 ---- */
  const WX = 64;
  A.wallRun(-WX, -110, -46, -110, { h: 7, t: 2 });
  A.wallRun(46, -110, WX, -110, { h: 7, t: 2 });
  A.wallRun(-WX, -110, -WX, -258, { h: 7, t: 2, gates: [{ at: -150, w: 3, name: '月华门' }] });
  A.wallRun(WX, -110, WX, -258, { h: 7, t: 2, gates: [{ at: -150, w: 3, name: '日精门' }] });
  A.wallRun(-WX, -258, WX, -258, { h: 7, t: 2 });

  /* ---- 乾清宫 ---- */
  G.rect(-62, -108, 62, -256, GM.plaza, 0);
  A.platform(-40, -164, 40, -122, 0, 4, { style: 'sumeru', railing: true, railGaps: [{ x0: -12, z0: -128, x1: 12, z1: -118 }] });
  A.hall({
    name: '乾清宫', x: 0, z: -148, w: 44, d: 22, ph: 4, bh: 12, tiers: 2, over: 5, rh: 10,
    type: 'hip', bay: 5, imperial: true, railing: true, interior: true, throne: true, cat: '内廷后三宫',
    sides: { s: 'door', n: 'door', e: 'window', w: 'window' },
    desc: '内廷正殿，面阔九间、重檐庑殿顶。明代与清初为皇帝寝宫，雍正后改为处理政务、接见臣工之所，殿内高悬“正大光明”匾。皇帝驾崩后灵柩在此停放。',
  });
  // 月台上的江山社稷金殿、铜龟鹤、日晷嘉量、四座金缸
  A.pavilion({ x: -14, z: -126, r: 3, y: 4, ph: 1, bh: 4, type: 'pyramid', rh: 3, over: 1, bench: false, pave: false, name: '社稷江山金殿·西' });
  A.pavilion({ x: 14, z: -126, r: 3, y: 4, ph: 1, bh: 4, type: 'pyramid', rh: 3, over: 1, bench: false, pave: false, name: '社稷江山金殿·东' });
  A.craneTurtle(-26, -130); A.craneTurtle(26, -130);
  A.sundial(-34, -126); A.sundial(34, -126);
  for (const s of [-1, 1]) { A.vat(s * 44, -140); A.vat(s * 44, -152); }
  A.stairs(0, -122, 16, 0, 4, 's', { imperial: true });

  /* ---- 交泰殿 ---- */
  A.hall({
    name: '交泰殿', x: 0, z: -186, w: 15, d: 15, ph: 3, bh: 8, over: 3, rh: 8,
    type: 'pyramid', bay: 3, railing: true, cat: '内廷后三宫', tallFinial: true,
    sides: { s: 'door', n: 'door', e: 'wall', w: 'wall' },
    desc: '取《易经》“天地交泰”之义。清代二十五方皇帝之宝（御玺）收藏于此，每年正月由内阁大学士在此开封。',
  });
  /* ---- 坤宁宫 ---- */
  A.hall({
    name: '坤宁宫', x: 0, z: -216, w: 38, d: 18, ph: 3, bh: 11, tiers: 2, over: 4, rh: 9,
    type: 'hip', bay: 5, railing: true, interior: true, cat: '内廷后三宫',
    sides: { s: 'door', n: 'window', e: 'window', w: 'window' },
    desc: '明代皇后中宫。清顺治十二年仿盛京清宁宫改建，东端二间为皇帝大婚洞房，西侧四间为萨满教祭神之所，宫内设锅灶煮祭肉。',
  });
  /* ---- 坤宁门 ---- */
  A.hall({
    name: '坤宁门', x: 0, z: -252, w: 14, d: 10, ph: 2, bh: 7, over: 2, rh: 6, type: 'gable', bay: 3, cat: '门',
    sides: { s: 'open', n: 'open', e: 'wall', w: 'wall' },
    desc: '后三宫北门，出此门即御花园。',
  });
  // 东西暖殿、庑房
  A.corridor(-62, -160, -50, -120, { h: 5, face: 'e' });
  A.corridor(50, -160, 62, -120, { h: 5, face: 'w' });
  A.corridor(-62, -244, -46, -204, { h: 5, face: 'e' });
  A.corridor(46, -244, 62, -204, { h: 5, face: 'w' });
  void V;
};
