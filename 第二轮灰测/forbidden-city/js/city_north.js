/* ============================================================
   御花园 · 神武门内 · 景山 · 外围（太庙/社稷坛/街市）· 花木陈设
   ============================================================ */
'use strict';

CITY.garden = (A) => {
  const V = A.V, G = A.G;
  const z0 = -378, z1 = -256, x0 = -80, x1 = 80;
  G.rect(x0, z0, x1, z1, GM.soil, 0);
  // 园墙
  A.wallRun(x0, z1, x1, z1, { h: 6, t: 2 });
  A.wallRun(x0, z0, x1, z0, { h: 6, t: 2, gates: [{ at: 0, w: 4 }] });
  A.wallRun(x0, z0, x0, z1, { h: 6, t: 2 });
  A.wallRun(x1, z0, x1, z1, { h: 6, t: 2 });
  // 石子甬路（十字主路 + 环路）
  G.rect(-6, z0, 6, z1, GM.slab, 0);
  G.rect(x0 + 4, -318, x1 - 4, -312, GM.slab, 0);
  G.ring(x0 + 6, z0 + 6, x1 - 6, z1 - 6, 4, GM.slab, 0);

  // 天一门 + 钦安殿（重檐盝顶）
  A.glazedGate(0, -278, { w: 8, h: 8, name: '天一门', desc: '御花园钦安殿前的琉璃门，取“天一生水”之义，明嘉靖年间建。' });
  A.wallRun(-20, -278, -8, -278, { h: 5, t: 1 });
  A.wallRun(8, -278, 20, -278, { h: 5, t: 1 });
  A.wallRun(-20, -278, -20, -312, { h: 5, t: 1 });
  A.wallRun(20, -278, 20, -312, { h: 5, t: 1 });
  A.wallRun(-20, -312, 20, -312, { h: 5, t: 1 });
  A.hall({
    name: '钦安殿', x: 0, z: -296, w: 18, d: 13, ph: 4, bh: 9, over: 3, rh: 7, type: 'lu', flat: 0.6, bay: 4,
    railing: true, imperial: true, cat: '御花园', interior: true,
    desc: '御花园中轴主体建筑，明代嘉靖帝崇道所建，供奉玄天上帝。重檐盝顶为紫禁城内孤例，殿前设“天一门”与连理柏。',
  });
  A.tree(-9, -286, 0, 'cypress', 1.4); A.tree(9, -286, 0, 'cypress', 1.4);

  // 万春亭（东）· 千秋亭（西）：上圆下方重檐
  A.pavilion({
    name: '万春亭', x: 42, z: -296, r: 8, ph: 3, bh: 6, tiers: 2, rh: 7, over: 2, type: 'round',
    cat: '御花园', desc: '御花园东侧重檐圆攒尖亭，下方上圆、十二根柱，与西侧千秋亭对称，是中国古代亭式建筑的精品。',
  });
  A.pavilion({
    name: '千秋亭', x: -42, z: -296, r: 8, ph: 3, bh: 6, tiers: 2, rh: 7, over: 2, type: 'round',
    cat: '御花园', desc: '与万春亭形制相同、东西对称，取“千秋万春”之意。',
  });
  // 浮碧亭（东）· 澄瑞亭（西）：跨池而建
  G.rect(30, -352, 54, -334, GM.water, FC.WATER_Y);
  G.rect(-54, -352, -30, -334, GM.water, FC.WATER_Y);
  A.pavilion({ name: '浮碧亭', x: 42, z: -343, r: 6, ph: 3, bh: 6, rh: 6, over: 2, type: 'gable', cat: '御花园',
    desc: '明万历年间建，亭跨于金鱼池上，前檐出抱厦，亭内天花绘百花图案。' });
  A.pavilion({ name: '澄瑞亭', x: -42, z: -343, r: 6, ph: 3, bh: 6, rh: 6, over: 2, type: 'gable', cat: '御花园',
    desc: '与浮碧亭东西对称，同为跨池水亭。' });
  // 堆秀山与御景亭
  A.rockery(62, -358, 12, 10, 13, {});
  A.pavilion({ name: '御景亭', x: 62, z: -358, r: 5, y: 13, ph: 1, bh: 5, rh: 5, over: 2, type: 'pyramid',
    cat: '御花园', pave: false,
    desc: '筑于堆秀山之巅，山以太湖石叠成、内设石阶蹬道。每年重阳节帝后登此亭赏景，可俯瞰紫禁城全景。' });
  A.hall({ name: '延晖阁', x: -62, z: -358, w: 20, d: 12, ph: 3, bh: 9, tiers: 2, over: 2, rh: 6, type: 'gable', bay: 4,
    cat: '御花园', desc: '园西北二层楼阁，与堆秀山对称，登阁可远眺西山。' });
  A.hall({ name: '摛藻堂', x: 64, z: -324, w: 20, d: 10, ph: 2, bh: 7, over: 2, rh: 5, type: 'juan', bay: 4, cat: '御花园',
    desc: '曾藏《四库全书荟要》一万二千册，是清宫重要的藏书处。' });
  A.hall({ name: '位育斋', x: -64, z: -324, w: 20, d: 10, ph: 2, bh: 7, over: 2, rh: 5, type: 'juan', bay: 4, cat: '御花园' });
  A.hall({ name: '绛雪轩', x: 68, z: -276, w: 16, d: 10, ph: 2, bh: 7, over: 2, rh: 5, type: 'juan', bay: 4, cat: '御花园',
    desc: '园东南轩馆，前有太平花五株，花开如雪，故名绛雪。轩前琉璃花坛内立有木化石。' });
  A.hall({ name: '养性斋', x: -68, z: -276, w: 16, d: 10, ph: 2, bh: 8, tiers: 2, over: 2, rh: 5, type: 'juan', bay: 4, cat: '御花园',
    desc: '平面呈凹形的转角楼，清嘉庆、道光年间为皇帝读书处，末代皇帝溥仪的英文教师庄士敦曾在此居。' });
  A.pavilion({ name: '四神祠', x: -30, z: -366, r: 5, ph: 2, bh: 5, rh: 5, over: 2, type: 'pyramid', cat: '御花园' });
  A.well(30, -366);
  A.reg('御花园', x0, z0, x1, z1, 14, '御花园',
    '明永乐年间与紫禁城同期建成，原名宫后苑，占地约1.2万平方米。园内古柏藤萝、亭台错落，以钦安殿为中轴主体，是帝后休憩游赏之地。');

  /* ---- 顺贞门与神武门内广场 ---- */
  A.glazedGate(0, -382, { w: 10, h: 9, name: '顺贞门', desc: '御花园北门，为内廷北端门户，帝后祭祀出宫多由此门。' });
  G.rect(-120, -466, 120, -382, GM.plaza, 0);
  A.corridor(-118, -400, -60, -392, { h: 5, face: 'n' });
  A.corridor(60, -400, 118, -392, { h: 5, face: 'n' });
  A.corridor(-118, -450, -60, -442, { h: 5, face: 's' });
  A.corridor(60, -450, 118, -442, { h: 5, face: 's' });
};

/* ------------------------------------------------------------
   景山 · 太庙 · 社稷坛 · 城外街市
   ------------------------------------------------------------ */
CITY.outskirts = (A) => {
  const G = A.G, V = A.V;
  /* ---- 景山 ---- */
  const jz = -720;
  G.rect(-220, -900, 220, -560, GM.grass, 0);
  A.wallRun(-220, -560, 220, -560, { h: 6, t: 2, gates: [{ at: 0, w: 5 }] });
  A.wallRun(-220, -900, 220, -900, { h: 6, t: 2 });
  A.wallRun(-220, -900, -220, -560, { h: 6, t: 2 });
  A.wallRun(220, -900, 220, -560, { h: 6, t: 2 });
  A.hall({ name: '绮望楼', x: 0, z: -578, w: 26, d: 12, ph: 3, bh: 9, tiers: 2, over: 3, rh: 6, type: 'gable', bay: 5,
    cat: '景山', desc: '景山南麓门内的两层楼阁，清乾隆十五年建，内供孔子像，为官学生徒祭祀之所。' });
  // 土山（五峰）
  A.mound(0, jz, 112, 78, 45);
  A.mound(-70, jz + 14, 42, 32, 30);
  A.mound(70, jz + 14, 42, 32, 30);
  A.mound(-116, jz + 26, 32, 26, 20);
  A.mound(116, jz + 26, 32, 26, 20);
  // 五亭
  A.pavilion({ name: '万春亭（景山）', x: 0, z: jz, r: 9, y: 45, ph: 2, bh: 7, tiers: 2, rh: 8, over: 3, type: 'pyramid',
    cat: '景山', pave: false, tallFinial: true,
    desc: '景山中峰之亭，乾隆十六年建，三重檐四角攒尖顶。此处为北京旧城中轴线的最高点，俯瞰紫禁城金瓦如海。' });
  A.pavilion({ name: '观妙亭', x: -70, z: jz + 14, r: 7, y: 30, ph: 2, bh: 6, rh: 6, over: 2, type: 'pyramid', cat: '景山', pave: false });
  A.pavilion({ name: '辑芳亭', x: 70, z: jz + 14, r: 7, y: 30, ph: 2, bh: 6, rh: 6, over: 2, type: 'pyramid', cat: '景山', pave: false });
  A.pavilion({ name: '周赏亭', x: -116, z: jz + 26, r: 6, y: 20, ph: 2, bh: 5, rh: 5, over: 2, type: 'pyramid', cat: '景山', pave: false });
  A.pavilion({ name: '富览亭', x: 116, z: jz + 26, r: 6, y: 20, ph: 2, bh: 5, rh: 5, over: 2, type: 'pyramid', cat: '景山', pave: false });
  A.hall({ name: '寿皇殿', x: 0, z: -848, w: 40, d: 20, ph: 4, bh: 11, tiers: 2, over: 4, rh: 9, type: 'hip', bay: 5,
    railing: true, cat: '景山', desc: '景山北麓的皇家祖先影堂，仿太庙形制，供奉清代帝后画像，乾隆十四年移建于此。' });
  G.rect(-60, -880, 60, -800, GM.plaza, 0);
  A.reg('景山', -220, -900, 220, -560, 60, '景山',
    '明永乐年间以营建紫禁城所掘之土堆筑，原名万岁山，为紫禁城北面的镇山。清乾隆时于五峰各建一亭，中峰万春亭是俯瞰紫禁城的最佳视点。');

  /* ---- 太庙（端门东）---- */
  const tx = 220, tz = 660;
  G.rect(120, 560, 330, 800, GM.plaza, 0);
  A.wallRun(120, 560, 330, 560, { h: 8, t: 3, gates: [{ at: tx, w: 5 }] });
  A.wallRun(120, 800, 330, 800, { h: 8, t: 3 });
  A.wallRun(120, 560, 120, 800, { h: 8, t: 3 });
  A.wallRun(330, 560, 330, 800, { h: 8, t: 3 });
  A.hall({ name: '太庙享殿', x: tx, z: tz, w: 50, d: 26, ph: 6, bh: 13, tiers: 2, over: 5, rh: 11, type: 'hip', bay: 6,
    railing: true, imperial: true, interior: true, cat: '皇城',
    desc: '明清两代皇帝祭祀祖先的宗庙正殿，面阔十一间，规制与太和殿相埒，殿内立六十八根金丝楠木大柱。' });
  A.hall({ name: '太庙寝殿', x: tx, z: tz - 50, w: 40, d: 18, ph: 4, bh: 10, over: 4, rh: 8, type: 'hip', bay: 5, cat: '皇城' });
  A.hall({ name: '太庙戟门', x: tx, z: tz + 44, w: 30, d: 14, ph: 4, bh: 9, over: 3, rh: 7, type: 'hip', bay: 5, cat: '门' });
  for (let i = 0; i < 6; i++) { A.tree(150 + i * 30, 590, 0, 'cypress', 1.2); A.tree(150 + i * 30, 780, 0, 'cypress', 1.2); }

  /* ---- 社稷坛（端门西）---- */
  G.rect(-330, 560, -120, 800, GM.plaza, 0);
  A.wallRun(-330, 560, -120, 560, { h: 8, t: 3, gates: [{ at: -220, w: 5 }] });
  A.wallRun(-330, 800, -120, 800, { h: 8, t: 3 });
  A.wallRun(-330, 560, -330, 800, { h: 8, t: 3 });
  A.wallRun(-120, 560, -120, 800, { h: 8, t: 3 });
  // 五色土方坛（三层）
  A.platform(-250, 640, -190, 700, 0, 1, { style: 'plain', face: C.marbleD, top: C.marbleS });
  A.platform(-246, 644, -194, 696, 1, 1, { style: 'plain', face: C.marbleD, top: C.marbleS });
  A.platform(-242, 648, -198, 692, 2, 1, { style: 'plain', face: C.marbleD, top: C.marble });
  // 五色土
  const soilC = [C.flowerRed, C.tileKA, C.paintBlue, C.marble, C.sand];
  for (let i = 0; i < 5; i++) {
    const q = [[-240, 650, -222, 668], [-218, 650, -200, 668], [-240, 672, -222, 690], [-218, 672, -200, 690], [-228, 664, -212, 676]][i];
    V.box(q[0], 3, q[1], q[2], 3, q[3], soilC[i]);
  }
  A.reg('社稷坛', -330, 560, -120, 800, 8, '皇城',
    '明清两代祭祀社（土地）稷（五谷）之神的场所，坛上按东青、南红、西白、北黑、中黄铺填五色土，象征普天之下莫非王土。');
  A.hall({ name: '社稷坛拜殿', x: -220, z: 730, w: 36, d: 18, ph: 4, bh: 10, over: 4, rh: 8, type: 'hip', bay: 5, cat: '皇城' });
  for (let i = 0; i < 6; i++) { A.tree(-310 + i * 30, 590, 0, 'cypress', 1.2); A.tree(-310 + i * 30, 780, 0, 'cypress', 1.2); }

  /* ---- 城外林荫与街市 ---- */
  const R = A.rnd;
  for (let i = 0; i < 260; i++) {
    const side = Math.floor(R() * 4);
    let x, z;
    const M = FC.WX + FC.MOAT_IN + FC.MOAT_W + 34, MZ = FC.WZ + FC.MOAT_IN + FC.MOAT_W + 34;
    if (side === 0) { x = -M - 20 - R() * 150; z = -MZ + R() * (MZ * 2); }
    else if (side === 1) { x = M + 20 + R() * 150; z = -MZ + R() * (MZ * 2); }
    else if (side === 2) { x = -M - 100 + R() * (M * 2 + 200); z = -MZ - 20 - R() * 90; }
    else { x = -M - 100 + R() * (M * 2 + 200); z = MZ + 20 + R() * 90; }
    if (Math.abs(x) < 210 && z < -520) continue;         // 让开景山
    if (Math.abs(x) > 110 && Math.abs(x) < 340 && z > 540 && z < 820) continue;  // 让开太庙社稷坛
    if (Math.abs(x) < 30 && z > 480) continue;           // 让开御道
    if (G.matAt(x, z) === GM.water || G.matAt(x, z) === 0) continue;   // 不种在水里
    A.tree(x, z, 0, R() < 0.55 ? 'cypress' : 'leaf', 0.8 + R() * 0.5);
  }
};

/* ------------------------------------------------------------
   花木陈设：宫内古树、铜缸、灯杆等
   ------------------------------------------------------------ */
CITY.dressing = (A) => {
  const R = A.rnd;
  // 御花园古柏
  for (let i = 0; i < 46; i++) {
    const x = -76 + R() * 152, z = -374 + R() * 112;
    if (Math.abs(x) < 8) continue;
    if (Math.abs(x) < 24 && z > -314 && z < -276) continue;
    if (Math.abs(Math.abs(x) - 42) < 10 && z > -306 && z < -286) continue;
    A.tree(x, z, 0, R() < 0.7 ? 'cypress' : 'leaf', 0.85 + R() * 0.45);
  }
  // 慈宁宫花园、乾隆花园古树
  for (let i = 0; i < 20; i++) A.tree(-338 + R() * 60, 44 + R() * 112, 0, R() < 0.6 ? 'cypress' : 'leaf', 0.8 + R() * 0.4);
  for (let i = 0; i < 14; i++) A.tree(228 + R() * 28, -366 + R() * 130, 0, 'cypress', 0.75 + R() * 0.35);
  // 十八槐（东华门内）
  for (let i = 0; i < 18; i++) A.tree(250 + (i % 6) * 16, 250 + Math.floor(i / 6) * 18, 0, 'leaf', 1.25);
  // 箭亭广场古树
  for (let i = 0; i < 10; i++) A.tree(126 + R() * 100, 64 + R() * 108, 0, 'leaf', 1.0 + R() * 0.4);
  // 太和殿广场四隅铜缸、宫灯杆
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
    A.vat(s * 146, 210 + i * 24);
  }
  // 神武门内、顺贞门外古柏
  for (let i = 0; i < 16; i++) A.tree(-112 + R() * 224, -462 + R() * 70, 0, 'cypress', 0.9 + R() * 0.3);
  // 宫内值房零星（东西华门内）
  for (let i = 0; i < 6; i++) {
    A.corridor(300, 60 + i * 30, 340, 60 + i * 30 + 10, { h: 5, face: 'w' });
    A.corridor(-340, 60 + i * 30, -300, 60 + i * 30 + 10, { h: 5, face: 'e' });
  }
  // 城墙内侧沿墙值房
  for (let i = 0; i < 8; i++) {
    A.corridor(-360 + i * 90, 430, -300 + i * 90, 440, { h: 5, face: 'n' });
  }
  // 宫灯：御花园甬路、乾清宫月台、太和殿月台、神武门内
  for (let z = -374; z <= -262; z += 14) { A.lantern(8, z); A.lantern(-8, z); }
  for (const s of [-1, 1]) { A.lantern(s * 18, -128, 4); A.lantern(s * 34, -122, 4); }
  for (const s of [-1, 1]) { A.lantern(s * 40, 178, 10); A.lantern(s * 40, 168, 10); }
  for (const s of [-1, 1]) for (const z of [-460, -440, -420]) A.lantern(s * 24, z);
};
