/* ============================================================
   东西六宫 · 东路（文华殿/奉先殿/宁寿宫/南三所）· 西路（武英殿/慈宁宫/养心殿）
   ============================================================ */
'use strict';

/** 通用院落：宫门 + 前院正殿 + 东西配殿 + 后院后殿，四周宫墙 */
CITY.palace = (A, s) => {
  const cx = s.cx, cz = s.cz;                 // 院落中心
  const w = s.w || 62, d = s.d || 50;
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const G = A.G;
  const tile = s.tile;
  G.rect(x0, z0, x1, z1, GM.plaza, 0);
  // 院墙（南面留宫门）
  const gw = 4;
  A.wallRun(x0, z1, cx - gw - 2, z1, { h: 6, t: 2 });
  A.wallRun(cx + gw + 2, z1, x1, z1, { h: 6, t: 2 });
  A.wallRun(x0, z0, x1, z0, { h: 6, t: 2, gates: s.northGate ? [{ at: cx, w: 3 }] : [] });
  A.wallRun(x0, z0, x0, z1, { h: 6, t: 2 });
  A.wallRun(x1, z0, x1, z1, { h: 6, t: 2 });
  // 宫门
  A.hall({
    name: s.gateName || (s.name + '门'), x: cx, z: z1 - 3, w: 12, d: 8, ph: 2, bh: 6, over: 2, rh: 5,
    type: 'gable', bay: 3, cat: '门', tile,
    sides: { s: 'open', n: 'open', e: 'wall', w: 'wall' }, pave: false,
  });
  // 正殿
  const mainZ = z1 - 22;
  A.hall({
    name: s.name, x: cx, z: mainZ, w: s.mw || 24, d: s.md || 14, ph: 2, bh: 8, over: 3, rh: 7,
    type: s.mtype || 'gable', bay: 4, railing: s.railing, cat: s.cat || '内廷', tile,
    interior: s.interior, throne: s.throne,
    sides: { s: 'door', n: 'wall', e: 'window', w: 'window' },
    desc: s.desc,
  });
  // 东西配殿
  const sz = mainZ + 4;
  for (const sx of [-1, 1]) {
    A.hall({
      x: cx + sx * (w / 2 - 9), z: sz, w: 9, d: 16, ph: 1, bh: 6, over: 2, rh: 5, type: 'juan', bay: 3,
      sides: { s: 'wall', n: 'wall', e: sx > 0 ? 'wall' : 'window', w: sx > 0 ? 'window' : 'wall' },
      pave: false,
    });
  }
  // 后殿 + 后配殿
  if (s.rear !== false) {
    A.hall({
      name: s.rearName, x: cx, z: z0 + 12, w: s.rw || 22, d: 12, ph: 2, bh: 7, over: 3, rh: 6,
      type: 'gable', bay: 4, cat: s.cat || '内廷', tile,
      sides: { s: 'door', n: 'wall', e: 'window', w: 'window' }, pave: false,
    });
    for (const sx of [-1, 1]) {
      A.hall({
        x: cx + sx * (w / 2 - 8), z: z0 + 16, w: 8, d: 12, ph: 1, bh: 6, over: 2, rh: 4, type: 'juan', bay: 3,
        sides: { s: 'wall', n: 'wall', e: sx > 0 ? 'wall' : 'window', w: sx > 0 ? 'window' : 'wall' },
        pave: false,
      });
    }
  }
  A.reg(s.name + '院落', x0, z0, x1, z1, 12, s.cat || '内廷', s.courtDesc || s.desc);
};

/* ------------------------------------------------------------
   东西六宫 + 长街 + 乾东西五所
   ------------------------------------------------------------ */
CITY.sixPalaces = (A) => {
  const G = A.G;
  // 长街铺装
  G.rect(66, -290, 82, -110, GM.path, 0);
  G.rect(-82, -290, -66, -110, GM.path, 0);
  G.rect(146, -290, 152, -110, GM.path, 0);
  G.rect(-152, -290, -146, -110, GM.path, 0);
  A.reg('东一长街', 66, -290, 82, -110, 3, '街巷', '东六宫与后三宫之间的南北通道，长街两侧为高大宫墙。');
  A.reg('西一长街', -82, -290, -66, -110, 3, '街巷', '西六宫与后三宫之间的南北通道，养心殿即在其西。');

  const EW = 60, ED = 50;
  const east = [
    { cx: 115, cz: -140, name: '斋宫', rearName: '诚肃殿', desc: '清雍正以后皇帝行大祀前斋戒之所，殿内设有黄琉璃瓦顶的斋宫神位。' },
    { cx: 115, cz: -196, name: '景仁宫', rearName: '景仁宫后殿', desc: '康熙皇帝诞生于此；清代为妃嫔居所，孝康章皇后、乾隆生母崇庆皇太后曾居。院内有元代石屏风。' },
    { cx: 115, cz: -252, name: '承乾宫', rearName: '承乾宫后殿', desc: '明代为贵妃所居，清顺治帝宠妃董鄂氏（孝献皇后）曾居此宫。' },
    { cx: 115, cz: -308, name: '钟粹宫', rearName: '钟粹宫后殿', desc: '明初为皇太子居所，称兴龙宫；清代为妃嫔居所，晚清慈安太后、光绪帝隆裕皇后曾居。' },
    { cx: 185, cz: -196, name: '延禧宫', rearName: '延禧宫后殿', desc: '清道光二十五年火灾后成废址，宣统元年在此营建“水晶宫”灵沼轩，未成而清亡。' },
    { cx: 185, cz: -252, name: '永和宫', rearName: '同顺斋', desc: '清雍正帝生母孝恭仁皇后（德妃）居此；光绪帝瑾妃亦曾居住。' },
    { cx: 185, cz: -308, name: '景阳宫', rearName: '御书房', desc: '明代为嫔妃居所，清代改为收藏图书之处，后殿御书房曾藏《四库全书荟要》。' },
  ];
  const west = [
    { cx: -115, cz: -140, name: '永寿宫', rearName: '永寿宫后殿', desc: '明清皇贵妃居所，清代亦作为筵宴、办事之处，乾隆年间曾在此设办事处。' },
    { cx: -115, cz: -196, name: '翊坤宫', rearName: '体和殿', desc: '明清妃嫔居所。慈禧居储秀宫时，将翊坤宫后殿改为体和殿，作为进膳与会客之所。' },
    { cx: -115, cz: -252, name: '储秀宫', rearName: '丽景轩', desc: '慈禧太后入宫时居此并生同治帝，光绪十年为庆五十寿辰大修，是西六宫中最为奢华的院落。' },
    { cx: -115, cz: -308, name: '咸福宫', rearName: '同道堂', desc: '道光帝晚年在此居住并病逝；咸丰帝亦曾居此，后殿同道堂为咸丰读书处。' },
    { cx: -185, cz: -140, name: '太极殿', rearName: '体元殿', desc: '原名启祥宫，明嘉庆帝生父兴献王诞生于此，故称启祥；清晚期与长春宫连通，慈禧曾居。' },
    { cx: -185, cz: -196, name: '长春宫', rearName: '怡情书史', desc: '清代妃嫔居所，慈禧、慈安均曾居住。院内四面回廊绘《红楼梦》题材壁画十八幅。' },
    { cx: -185, cz: -252, name: '重华宫', rearName: '崇敬殿', desc: '乾隆帝为皇子时的居所，即位后升为宫，每岁新正在此举行茶宴联句，为清宫文事盛典。' },
  ];
  for (const p of east) CITY.palace(A, Object.assign({ w: EW, d: ED, cat: '东六宫' }, p));
  for (const p of west) CITY.palace(A, Object.assign({ w: EW, d: ED, cat: '西六宫' }, p));

  // 乾东五所 / 乾西五所（皇子居所，绿琉璃瓦）
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const cx = side * (92 + i * 26);
      CITY.palace(A, {
        cx, cz: -352, w: 24, d: 44, mw: 16, md: 11, rw: 14,
        name: (side > 0 ? '乾东' : '乾西') + '五所·' + '一二三四五'[i] + '所',
        gateName: null, cat: '皇子居所', tile: [C.tileGA, C.tileGB],
        desc: '皇子居所，屋顶覆绿琉璃瓦，以别于帝后所居的黄瓦宫殿。',
      });
    }
  }
};

/* ------------------------------------------------------------
   东路：文华殿 · 文渊阁 · 奉先殿 · 箭亭 · 宁寿宫 · 南三所
   ------------------------------------------------------------ */
CITY.eastRoute = (A) => {
  const V = A.V, G = A.G;
  /* ---- 文华殿区 ---- */
  G.rect(104, 250, 216, 392, GM.plaza, 0);
  A.wallRun(104, 250, 104, 392, { h: 6, t: 2 });
  A.wallRun(216, 250, 216, 392, { h: 6, t: 2 });
  A.wallRun(104, 250, 216, 250, { h: 6, t: 2 });
  A.hall({ name: '文华门', x: 160, z: 386, w: 16, d: 10, ph: 2, bh: 7, over: 2, rh: 6, type: 'gable', bay: 4, cat: '门',
    sides: { s: 'open', n: 'open', e: 'wall', w: 'wall' } });
  A.hall({
    name: '文华殿', x: 160, z: 352, w: 28, d: 18, ph: 3, bh: 9, over: 3, rh: 8, type: 'gable', bay: 5,
    railing: true, cat: '东路', interior: true,
    desc: '明代皇帝经筵之所，明末曾为太子讲学处。清代于此举行经筵典礼，殿后主敬殿，两侧本仁、集义二殿，合为工字形建筑群。',
  });
  A.hall({ name: '主敬殿', x: 160, z: 322, w: 24, d: 14, ph: 2, bh: 8, over: 3, rh: 7, type: 'gable', bay: 4, cat: '东路' });
  A.hall({ name: '本仁殿', x: 122, z: 344, w: 10, d: 20, ph: 2, bh: 7, over: 2, rh: 6, type: 'juan', bay: 3, cat: '东路',
    sides: { e: 'door', w: 'wall', s: 'wall', n: 'wall' } });
  A.hall({ name: '集义殿', x: 198, z: 344, w: 10, d: 20, ph: 2, bh: 7, over: 2, rh: 6, type: 'juan', bay: 3, cat: '东路',
    sides: { w: 'door', e: 'wall', s: 'wall', n: 'wall' } });
  // 文渊阁（黑琉璃瓦绿剪边，二层）
  A.platform(140, 268, 182, 292, 0, 3, { style: 'sumeru', railing: true });
  A.body(142, 270, 180, 290, 3, 7, { sides: { s: 'door', n: 'wall', e: 'wall', w: 'wall' }, bay: 5 });
  A.roof(138, 266, 184, 294, 10, 4, { type: 'gable', tile: [C.tileKA, C.tileKB], thk: 1, ridgeH: 1, lift: 1, tref: 5,
    hole: { x0: 143, z0: 271, x1: 179, z1: 289 } });
  A.body(143, 271, 179, 289, 15, 6, { sides: { s: 'window', n: 'window', e: 'window', w: 'window' }, bay: 5, floor: C.beamDark });
  const wyTop = A.roof(139, 267, 183, 293, 21, 7, { type: 'gable', tile: [C.tileKA, C.tileKB], ridgeH: 2, lift: 2 });
  A.reg('文渊阁', 138, 266, 184, 294, wyTop, '东路',
    '清乾隆四十一年建成的皇家藏书楼，专藏《四库全书》。仿宁波天一阁式样，上下二层、面阔六间，覆黑琉璃瓦绿剪边，取“黑主水”以克火之意。');
  G.rect(140, 296, 184, 312, GM.water, FC.WATER_Y);   // 阁前水池
  A.pavilion({ name: '文渊阁碑亭', x: 200, z: 282, r: 5, ph: 2, bh: 5, type: 'pyramid', rh: 5, over: 2, bench: false });
  A.hall({ name: '传心殿', x: 240, z: 350, w: 20, d: 12, ph: 2, bh: 7, over: 3, rh: 6, type: 'gable', bay: 4, cat: '东路',
    desc: '清康熙年间建，内供皇师、帝师、王师及周公、孔子牌位，皇帝御经筵前先在此祭告。' });
  A.hall({ name: '内阁大堂', x: 262, z: 392, w: 26, d: 14, ph: 2, bh: 8, over: 3, rh: 7, type: 'gable', bay: 4, cat: '东路',
    desc: '清代内阁办事之所，位于协和门外东南，为国家中枢文书机构。' });

  /* ---- 箭亭（景运门外大广场）---- */
  G.rect(120, 60, 240, 180, GM.plaza, 0);
  A.hall({
    name: '箭亭', x: 176, z: 120, w: 26, d: 18, ph: 3, bh: 8, over: 4, rh: 8, type: 'gable', bay: 5,
    railing: true, cat: '东路', sides: { s: 'door', n: 'door', e: 'door', w: 'door' },
    desc: '又称射殿，清代皇帝及皇子练习骑射、检阅侍卫之处。乾隆帝曾立卧碑训诫子孙勿忘满洲武功。',
  });

  /* ---- 奉先殿 ---- */
  const fx0 = 96, fx1 = 172, fz0 = -128, fz1 = -40;
  G.rect(fx0, fz0, fx1, fz1, GM.plaza, 0);
  A.wallRun(fx0, fz1, fx1, fz1, { h: 7, t: 2, gates: [{ at: 134, w: 4, name: '奉先门' }] });
  A.wallRun(fx0, fz0, fx1, fz0, { h: 7, t: 2 });
  A.wallRun(fx0, fz0, fx0, fz1, { h: 7, t: 2 });
  A.wallRun(fx1, fz0, fx1, fz1, { h: 7, t: 2 });
  A.hall({
    name: '奉先殿', x: 134, z: -76, w: 34, d: 20, ph: 4, bh: 11, tiers: 2, over: 4, rh: 9, type: 'hip', bay: 5,
    railing: true, interior: true, cat: '东路',
    desc: '皇家祖庙，供奉清代历朝帝后神牌。前殿后寝、中以穿堂相连，呈工字形。每逢朔望、万寿、册封等日皇帝在此行礼。',
  });
  A.hall({ name: '奉先殿后寝', x: 134, z: -106, w: 30, d: 14, ph: 3, bh: 9, over: 3, rh: 8, type: 'hip', bay: 5, cat: '东路' });
  A.hall({ name: '毓庆宫', x: 210, z: -96, w: 22, d: 14, ph: 2, bh: 8, over: 3, rh: 7, type: 'gable', bay: 4, cat: '东路',
    desc: '清康熙为皇太子胤礽所建，后为皇子读书处。嘉庆、道光、咸丰、同治、光绪诸帝幼年均曾在此居住读书。' });

  /* ---- 宁寿宫（外东路）---- */
  const nx = 282;
  G.rect(222, -400, 344, -120, GM.plaza, 0);
  A.wallRun(222, -120, 344, -120, { h: 7, t: 2, gates: [{ at: nx, w: 5, name: '皇极门' }] });
  A.wallRun(222, -400, 344, -400, { h: 7, t: 2 });
  A.wallRun(222, -400, 222, -120, { h: 7, t: 2, gates: [{ at: -260, w: 3, name: '衍祺门' }] });
  A.wallRun(344, -400, 344, -120, { h: 7, t: 2 });
  // 九龙壁
  for (let x = nx - 15; x <= nx + 15; x++) {
    for (let y = 0; y < 6; y++) {
      const c = (y === 5) ? C.tileB : ((x + y) % 3 === 0 ? C.paintBlue : (y % 2 ? C.tileGA : C.paintGreen));
      V.set(x, y, -112, c);
      if (Math.abs((x - nx) % 7) < 2 && y > 0 && y < 5) V.set(x, y, -112, C.goldBright);
    }
    V.set(x, 6, -112, C.tileA);
  }
  A.reg('九龙壁', nx - 15, -114, nx + 15, -110, 8, '东路',
    '乾隆三十七年建，琉璃影壁长29.4米、高3.5米，以270块琉璃塑块拼砌九条巨龙，是紫禁城内唯一的九龙壁。');
  A.hall({ name: '宁寿门', x: nx, z: -152, w: 20, d: 12, ph: 3, bh: 8, over: 3, rh: 7, type: 'gable', bay: 4, cat: '门' });
  A.hall({
    name: '皇极殿', x: nx, z: -190, w: 38, d: 20, ph: 4, bh: 11, tiers: 2, over: 4, rh: 9, type: 'hip', bay: 5,
    railing: true, imperial: true, interior: true, throne: true, cat: '东路',
    desc: '乾隆帝为自己退位后颐养而建的宁寿宫区正殿。嘉庆元年正月，太上皇乾隆在此举行千叟宴，宴请三千余位老者。',
  });
  A.hall({ name: '宁寿宫', x: nx, z: -226, w: 32, d: 16, ph: 3, bh: 10, over: 4, rh: 8, type: 'gable', bay: 5, railing: true, cat: '东路',
    desc: '仿坤宁宫形制，前檐设廊、内设煮肉大灶，为宁寿宫区的“中宫”。' });
  A.hall({ name: '养性殿', x: nx, z: -258, w: 26, d: 16, ph: 3, bh: 9, over: 3, rh: 7, type: 'gable', bay: 4, cat: '东路',
    desc: '仿养心殿而建，乾隆退位后的寝兴之所，殿内亦有“三希堂”式的小书房。' });
  A.hall({ name: '乐寿堂', x: nx, z: -288, w: 30, d: 16, ph: 3, bh: 9, over: 3, rh: 8, type: 'gable', bay: 5, cat: '东路',
    desc: '乾隆的读书之所，慈禧晚年亦曾居此。堂内以紫檀装修、嵌玉透雕，陈设“大禹治水图”玉山。' });
  A.hall({ name: '颐和轩', x: nx, z: -318, w: 26, d: 14, ph: 3, bh: 8, over: 3, rh: 7, type: 'gable', bay: 4, cat: '东路' });
  A.hall({ name: '景祺阁', x: nx, z: -350, w: 22, d: 14, ph: 3, bh: 9, tiers: 2, over: 3, rh: 7, type: 'gable', bay: 4, cat: '东路' });
  // 宁寿宫花园（乾隆花园）
  const gx = 240;
  G.rect(226, -370, 258, -230, GM.soil, 0);
  A.pavilion({ name: '古华轩', x: gx, z: -246, r: 7, ph: 2, bh: 6, type: 'pyramid', rh: 6, over: 2 });
  A.hall({ name: '遂初堂', x: gx, z: -272, w: 18, d: 11, ph: 2, bh: 7, over: 2, rh: 6, type: 'gable', bay: 4, cat: '花园' });
  A.hall({ name: '萃赏楼', x: gx, z: -298, w: 18, d: 11, ph: 2, bh: 9, tiers: 2, over: 2, rh: 6, type: 'gable', bay: 4, cat: '花园' });
  A.hall({ name: '符望阁', x: gx, z: -326, w: 20, d: 16, ph: 3, bh: 11, tiers: 2, over: 3, rh: 8, type: 'pyramid', bay: 4, cat: '花园',
    desc: '乾隆花园主体建筑，方形二层楼阁，内部装修以“迷楼”著称，室内隔断错落如迷宫。' });
  A.hall({ name: '倦勤斋', x: gx, z: -354, w: 22, d: 10, ph: 2, bh: 7, over: 2, rh: 5, type: 'juan', bay: 4, cat: '花园',
    desc: '乾隆花园最北一座，内有通景画与竹丝镶嵌装修，室内戏台为紫禁城内仅存的“室内小戏台”。' });
  A.rockery(252, -258, 6, 8, 7);
  // 畅音阁大戏楼 + 阅是楼
  A.hall({
    name: '畅音阁', x: 322, z: -262, w: 24, d: 24, ph: 3, bh: 10, tiers: 2, over: 4, rh: 9, type: 'gable', bay: 4,
    cat: '东路', railing: true,
    desc: '清宫最大戏楼，三层通高，上层“福台”、中层“禄台”、下层“寿台”，台下设地井与水井，可演神仙鬼怪升降之戏。',
  });
  A.hall({ name: '阅是楼', x: 322, z: -294, w: 22, d: 14, ph: 2, bh: 9, tiers: 2, over: 3, rh: 7, type: 'gable', bay: 4, cat: '东路',
    desc: '与畅音阁相对，为帝后观戏之处。' });

  /* ---- 南三所（撷芳殿）---- */
  for (let i = 0; i < 3; i++) {
    const cx = 246 + i * 42;
    CITY.palace(A, {
      cx, cz: 130, w: 38, d: 78, mw: 20, md: 13, rw: 18,
      name: '南三所·' + '一二三'[i] + '所', cat: '皇子居所', tile: [C.tileGA, C.tileGB],
      desc: '又称撷芳殿，位于东华门内，为清代皇子居所，绿琉璃瓦顶，三所并列。',
    });
  }
  // 上驷院与十八槐
  G.rect(240, 260, 340, 340, GM.soil, 0);
  A.reg('上驷院', 240, 260, 340, 340, 6, '东路', '掌管御用马匹的机构，东华门内北侧。');
};

/* ------------------------------------------------------------
   西路：武英殿 · 慈宁宫 · 寿康宫 · 寿安宫 · 养心殿 · 雨花阁
   ------------------------------------------------------------ */
CITY.westRoute = (A) => {
  const G = A.G;
  /* ---- 武英殿区 ---- */
  G.rect(-216, 250, -104, 392, GM.plaza, 0);
  A.wallRun(-104, 250, -104, 392, { h: 6, t: 2 });
  A.wallRun(-216, 250, -216, 392, { h: 6, t: 2 });
  A.wallRun(-216, 250, -104, 250, { h: 6, t: 2 });
  A.hall({ name: '武英门', x: -160, z: 386, w: 16, d: 10, ph: 2, bh: 7, over: 2, rh: 6, type: 'gable', bay: 4, cat: '门',
    sides: { s: 'open', n: 'open', e: 'wall', w: 'wall' } });
  A.hall({
    name: '武英殿', x: -160, z: 352, w: 28, d: 18, ph: 3, bh: 9, over: 3, rh: 8, type: 'gable', bay: 5,
    railing: true, cat: '西路', interior: true,
    desc: '明代皇帝斋居、召见大臣之所；李自成曾在此即位。清康熙设武英殿修书处，以此地校刻典籍，所出书籍称“殿本”。',
  });
  A.hall({ name: '敬思殿', x: -160, z: 322, w: 24, d: 14, ph: 2, bh: 8, over: 3, rh: 7, type: 'gable', bay: 4, cat: '西路' });
  A.hall({ name: '凝道殿', x: -198, z: 344, w: 10, d: 20, ph: 2, bh: 7, over: 2, rh: 6, type: 'juan', bay: 3, cat: '西路',
    sides: { e: 'door', w: 'wall', s: 'wall', n: 'wall' } });
  A.hall({ name: '焕章殿', x: -122, z: 344, w: 10, d: 20, ph: 2, bh: 7, over: 2, rh: 6, type: 'juan', bay: 3, cat: '西路',
    sides: { w: 'door', e: 'wall', s: 'wall', n: 'wall' } });
  A.hall({ name: '浴德堂', x: -206, z: 316, w: 12, d: 10, ph: 2, bh: 6, over: 2, rh: 5, type: 'lu', bay: 3, cat: '西路',
    desc: '武英殿西侧，后室为穹顶浴室，形制近似土耳其浴室，是紫禁城内极为罕见的阿拉伯式建筑。' });
  A.hall({ name: '南薰殿', x: -250, z: 300, w: 20, d: 12, ph: 2, bh: 7, over: 3, rh: 6, type: 'gable', bay: 4, cat: '西路',
    desc: '藏历代帝王贤臣画像之所。' });
  A.hall({ name: '宝蕴楼', x: -290, z: 360, w: 26, d: 12, ph: 2, bh: 9, tiers: 2, over: 2, rh: 5, type: 'juan', bay: 5, cat: '西路',
    desc: '1915年建于咸安宫旧址的西洋式库房，用以存放由沈阳、热河运来的文物，是紫禁城内首座近代建筑。' });

  /* ---- 慈宁宫区 ---- */
  const cx = -206;
  G.rect(-268, 30, -144, 180, GM.plaza, 0);
  A.wallRun(-268, 180, -144, 180, { h: 7, t: 2, gates: [{ at: cx, w: 5, name: '慈宁门' }] });
  A.wallRun(-268, 30, -144, 30, { h: 7, t: 2 });
  A.wallRun(-268, 30, -268, 180, { h: 7, t: 2 });
  A.wallRun(-144, 30, -144, 180, { h: 7, t: 2 });
  A.hall({
    name: '慈宁宫', x: cx, z: 130, w: 36, d: 20, ph: 4, bh: 11, tiers: 2, over: 4, rh: 9, type: 'gable', bay: 5,
    railing: true, interior: true, cat: '西路',
    desc: '明清两代皇太后与太妃嫔的居所。清顺治、康熙两朝孝庄文皇后（孝庄太后）曾长居于此，乾隆帝生母崇庆皇太后亦居此宫。',
  });
  A.hall({ name: '大佛堂', x: cx, z: 92, w: 30, d: 16, ph: 3, bh: 9, over: 3, rh: 8, type: 'gable', bay: 5, cat: '西路',
    desc: '慈宁宫后殿，清代太后太妃礼佛之所，供奉大量佛像与佛塔。' });
  A.hall({ name: '徽音左门', x: -170, z: 60, w: 8, d: 8, ph: 1, bh: 6, over: 2, rh: 4, type: 'juan', bay: 3, cat: '门' });
  // 慈宁宫花园
  G.rect(-340, 40, -276, 160, GM.soil, 0);
  A.hall({ name: '咸若馆', x: -308, z: 110, w: 18, d: 14, ph: 3, bh: 8, over: 3, rh: 7, type: 'lu', bay: 4, cat: '花园',
    desc: '慈宁宫花园主体建筑，太后太妃礼佛之处，方形盝顶、四面出廊。' });
  A.pavilion({ name: '临溪亭', x: -308, z: 74, r: 5, ph: 2, bh: 5, type: 'pyramid', rh: 5, over: 2 });
  G.rect(-320, 62, -296, 86, GM.water, FC.WATER_Y);
  A.hall({ name: '慈荫楼', x: -308, z: 146, w: 20, d: 11, ph: 2, bh: 9, tiers: 2, over: 2, rh: 5, type: 'juan', bay: 4, cat: '花园' });
  A.rockery(-330, 96, 5, 7, 6);
  A.reg('慈宁宫花园', -340, 40, -276, 160, 10, '花园',
    '紫禁城内四座花园之一，为太后太妃礼佛游憩之所，园内建筑多与佛事相关，布局疏朗、古树成荫。');

  /* ---- 寿康宫 · 寿安宫 · 英华殿 ---- */
  CITY.palace(A, {
    cx: -308, cz: -10, w: 56, d: 60, mw: 26, md: 15, rw: 22, name: '寿康宫', rearName: '寿康宫后殿',
    cat: '西路', railing: true,
    desc: '雍正十三年建，为皇太后居所。乾隆生母崇庆皇太后在此居住四十二年，乾隆帝几乎日日前来问安。',
  });
  CITY.palace(A, {
    cx: -308, cz: -100, w: 60, d: 76, mw: 28, md: 16, rw: 24, name: '寿安宫', rearName: '萱寿堂',
    cat: '西路',
    desc: '明代咸熙宫，清乾隆十六年为庆崇庆皇太后六十寿辰改建，院内曾搭大戏台承演庆寿之戏。',
  });
  A.hall({ name: '英华殿', x: -330, z: -172, w: 24, d: 14, ph: 3, bh: 8, over: 3, rh: 7, type: 'gable', bay: 4, cat: '西路',
    desc: '明清太后、太妃礼佛之殿，殿前有明万历年间所植菩提树两株，并立“菩提树碑”。' });
  A.tree(-342, -158, 0, 'leaf', 1.3); A.tree(-318, -158, 0, 'leaf', 1.3);

  /* ---- 养心殿区 ---- */
  const vx = -104;
  G.rect(-136, -200, -72, -118, GM.plaza, 0);
  A.wallRun(-136, -118, -72, -118, { h: 7, t: 2, gates: [{ at: vx, w: 4, name: '遵义门' }] });
  A.wallRun(-136, -200, -72, -200, { h: 7, t: 2 });
  A.wallRun(-136, -200, -136, -118, { h: 7, t: 2 });
  A.wallRun(-72, -200, -72, -118, { h: 7, t: 2 });
  A.hall({
    name: '养心殿', x: vx, z: -146, w: 28, d: 16, ph: 3, bh: 9, over: 4, rh: 8, type: 'gable', bay: 4,
    railing: true, interior: true, throne: true, cat: '内廷',
    desc: '雍正以后八代皇帝的实际寝宫与理政中心。正殿东暖阁为“垂帘听政”之处，西暖阁设“勤政亲贤”与三希堂，慈禧与光绪的政治风云皆系于此。',
  });
  A.hall({ name: '体顺堂', x: -122, z: -178, w: 12, d: 12, ph: 2, bh: 7, over: 2, rh: 6, type: 'juan', bay: 3, cat: '内廷',
    desc: '养心殿后东侧，皇后侍寝之所。' });
  A.hall({ name: '燕喜堂', x: -86, z: -178, w: 12, d: 12, ph: 2, bh: 7, over: 2, rh: 6, type: 'juan', bay: 3, cat: '内廷',
    desc: '养心殿后西侧，妃嫔侍寝之所。' });
  A.hall({ name: '军机处', x: -132, z: -104, w: 22, d: 9, ph: 1, bh: 6, over: 2, rh: 5, type: 'juan', bay: 4, cat: '西路',
    desc: '清代最高军政中枢的值房，紧邻隆宗门，房舍低矮朴素，却是雍正以后国家决策之地。' });
  A.hall({ name: '内务府', x: -170, z: -60, w: 30, d: 14, ph: 2, bh: 7, over: 3, rh: 6, type: 'gable', bay: 5, cat: '西路',
    desc: '管理皇室财务、庶务的庞大机构，下辖七司三院。' });

  /* ---- 雨花阁 · 中正殿 ---- */
  A.hall({
    name: '雨花阁', x: -178, z: -178, w: 20, d: 20, ph: 3, bh: 9, tiers: 2, over: 3, rh: 8, type: 'pyramid', bay: 4,
    tile: [C.tileGA, C.tileGB], railing: true, cat: '西路', tallFinial: true,
    desc: '紫禁城内最大的藏传佛教密宗神殿，三层楼阁、屋顶覆金铜瓦并设四条铜龙，藏密四部依层分供。',
  });
  A.hall({ name: '中正殿', x: -178, z: -142, w: 24, d: 14, ph: 3, bh: 8, over: 3, rh: 7, type: 'gable', bay: 4, cat: '西路' });
  A.hall({ name: '春华门', x: -150, z: -160, w: 8, d: 8, ph: 1, bh: 6, over: 2, rh: 4, type: 'juan', bay: 3, cat: '门' });
  A.hall({ name: '造办处', x: -230, z: -230, w: 34, d: 14, ph: 1, bh: 6, over: 2, rh: 5, type: 'juan', bay: 5, cat: '西路',
    desc: '清宫制作御用器物的作坊，下设玉作、金玉作、珐琅作等数十作，宫廷工艺之精出于此。' });
};
