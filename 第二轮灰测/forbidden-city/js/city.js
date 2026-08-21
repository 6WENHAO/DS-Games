/* ============================================================
   紫禁城总体：坐标系以紫禁城几何中心为原点
     x：东正 / 西负     z：南正 / 北负     y：上
     宫城 753m(东西) × 961m(南北)，中轴线 x = 0
   ============================================================ */
'use strict';

const FC = {
  // 宫墙外皮
  WX: 376, WZ: 480,
  WALL_H: 10, WALL_T: 9,
  // 护城河（筒子河）
  MOAT_IN: 20, MOAT_W: 52, MOAT_IN_S: 100,
  // 世界范围（含景山、端门天安门）
  X0: -640, X1: 640, Z0: -1010, Z1: 1080,
  WATER_Y: -2,
};

const CITY = {};   // 各区builder挂载点

function buildCity(vol, ground, idmap, progress) {
  const A = new Arch(vol, ground, idmap);
  const steps = [
    ['基础地形与街道', () => CITY.terrain(A)],
    ['宫墙·角楼·护城河', () => CITY.rampart(A)],
    ['午门与端门天安门', () => CITY.southGates(A)],
    ['外朝：太和门与三大殿', () => CITY.outerCourt(A)],
    ['内廷：乾清门与后三宫', () => CITY.innerCourt(A)],
    ['东西六宫与长街', () => CITY.sixPalaces(A)],
    ['东路：文华殿·奉先殿·宁寿宫', () => CITY.eastRoute(A)],
    ['西路：武英殿·慈宁宫·养心殿', () => CITY.westRoute(A)],
    ['御花园与神武门', () => CITY.garden(A)],
    ['景山与外围', () => CITY.outskirts(A)],
    ['花木陈设', () => CITY.dressing(A)],
  ];
  for (let i = 0; i < steps.length; i++) {
    if (progress) progress(i / steps.length, steps[i][0]);
    steps[i][1]();
  }
  if (progress) progress(1, '完成');
  return A;
}

/* ------------------------------------------------------------
   一、基础地形：宫城内外地面、护城河外街道
   ------------------------------------------------------------ */
CITY.terrain = (A) => {
  const G = A.G;
  // 城外：土黄地面 + 林地
  G.rect(FC.X0, FC.Z0, FC.X1, FC.Z1, GM.soil, 0);
  // 宫城内：整体青砖地面
  G.rect(-FC.WX, -FC.WZ, FC.WX, FC.WZ, GM.plaza, 0);
  // 环城街道（沿护城河外侧）
  const mo = FC.WX + FC.MOAT_IN + FC.MOAT_W, mz = FC.WZ + FC.MOAT_IN + FC.MOAT_W;
  G.ring(-mo - 30, -mz - 30, mo + 30, mz + 110, 28, GM.path, 0);
  // 护城河：南段外移，环抱午门凹形广场
  const ix0 = -(FC.WX + FC.MOAT_IN + FC.MOAT_W), ix1 = FC.WX + FC.MOAT_IN + FC.MOAT_W;
  const iz0 = -(FC.WZ + FC.MOAT_IN + FC.MOAT_W);
  const iz1 = FC.WZ + FC.MOAT_IN_S + FC.MOAT_W;
  const jx0 = -(FC.WX + FC.MOAT_IN), jx1 = FC.WX + FC.MOAT_IN;
  const jz0 = -(FC.WZ + FC.MOAT_IN), jz1 = FC.WZ + FC.MOAT_IN_S;
  const water = (x0, z0, x1, z1) => G.rect(x0, z0, x1, z1, GM.water, FC.WATER_Y);
  water(ix0, iz0, ix1, jz0);            // 北段
  water(ix0, jz1, ix1, iz1);            // 南段（外移）
  water(ix0, jz0, jx0, jz1);            // 西段
  water(jx1, jz0, ix1, jz1);            // 东段
  // 午门广场铺装（河内）
  G.rect(jx0, FC.WZ, jx1, jz1, GM.plaza, 0);
  // 河岸驳石
  const V = A.V;
  const bank = (x0, z0, x1, z1) => {
    for (let x = Math.round(x0); x <= Math.round(x1); x++)
      for (let z = Math.round(z0); z <= Math.round(z1); z++) {
        V.set(x, -1, z, C.stone); V.set(x, -2, z, C.brickDark);
        V.set(x, -3, z, C.brickDark);
      }
  };
  // 河两侧各铺一条驳岸（1m 宽，位于水面边缘）
  for (const [x0, z0, x1, z1] of [
    [ix0, iz0, ix1, iz0 + 1], [ix0, iz1 - 1, ix1, iz1],
    [ix0, iz0, ix0 + 1, iz1], [ix1 - 1, iz0, ix1, iz1],
    [jx0 - 1, jz0 - 1, jx1 + 1, jz0], [jx0 - 1, jz1, jx1 + 1, jz1 + 1],
    [jx0 - 1, jz0 - 1, jx0, jz1 + 1], [jx1, jz0 - 1, jx1 + 1, jz1 + 1],
    [ix0, iz1 - 1, ix1, iz1],
  ]) bank(x0, z0, x1, z1);
  A.reg('筒子河（护城河）', jx1, -60, ix1, 60, 2, '水系',
    '环绕宫城的护城河，宽52米、深约6米，河帮以条石砌筑，俗称筒子河。');
};

/* ------------------------------------------------------------
   二、宫墙、角楼、四门城台、马道
   ------------------------------------------------------------ */
CITY.rampart = (A) => {
  const V = A.V, G = A.G;
  const X = FC.WX, Z = FC.WZ, H = FC.WALL_H, T = FC.WALL_T;
  // 城墙主体：外皮内收（下宽上窄）
  const seg = (x0, z0, x1, z1, horiz) => {
    for (let y = 0; y < H; y++) {
      const inset = Math.floor(y / (H - 1) * 2);       // 收分
      if (horiz) V.box(x0, y, z0 + inset, x1, y, z1 - inset, (y % 4 === 3) ? C.cityWallD : C.cityWall);
      else V.box(x0 + inset, y, z0, x1 - inset, y, z1, (y % 4 === 3) ? C.cityWallD : C.cityWall);
    }
  };
  seg(-X, -Z, X, -Z + T, true);        // 北墙
  seg(-X, Z - T, X, Z, true);          // 南墙
  seg(-X, -Z, -X + T, Z, false);       // 西墙
  seg(X - T, -Z, X, Z, false);         // 东墙
  // 墙顶：宇墙(内)、女墙(外)、海墁地面
  const cap = (x0, z0, x1, z1) => {
    V.box(x0, H, z0, x1, H, z1, C.brickGray);
  };
  cap(-X + 2, -Z + 2, X - 2, -Z + T - 2); cap(-X + 2, Z - T + 2, X - 2, Z - 2);
  cap(-X + 2, -Z + 2, -X + T - 2, Z - 2); cap(X - T + 2, -Z + 2, X - 2, Z - 2);
  const parapet = (x0, z0, x1, z1, dir) => {
    // dir: 'n','s','e','w' 指外侧
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const y0 = H + 1;
      V.box(x, y0, z, x, y0 + 1, z, C.cityWall);
      const along = (dir === 'n' || dir === 's') ? x : z;
      if (along % 5 !== 0) V.set(x, y0 + 2, z, C.cityWall);     // 垛口
      else V.set(x, y0 + 2, z, 0);
    }
  };
  parapet(-X + 2, -Z + 2, X - 2, -Z + 2, 'n');   parapet(-X + 2, Z - 2, X - 2, Z - 2, 's');
  parapet(-X + 2, -Z + 2, -X + 2, Z - 2, 'w');   parapet(X - 2, -Z + 2, X - 2, Z - 2, 'e');
  // 内侧宇墙（矮）
  const inner = (x0, z0, x1, z1) => { V.box(x0, H + 1, z0, x1, H + 1, z1, C.cityWall); };
  inner(-X + 2, -Z + T - 2, X - 2, -Z + T - 2); inner(-X + 2, Z - T + 2, X - 2, Z - T + 2);
  inner(-X + T - 2, -Z + 2, -X + T - 2, Z - 2); inner(X - T + 2, -Z + 2, X - T + 2, Z - 2);
  A.reg('紫禁城城墙', -X, -Z, X, -Z + T, H + 3, '城防',
    '城墙高约10米，底宽8.6米、顶宽6.6米，周长约3.4公里，以夯土包砌城砖，顶部海墁并设垛口。');

  // ---- 四座角楼（十字脊三重檐，九梁十八柱七十二脊）----
  const corner = (cx, cz, name) => {
    const r = 11;
    A.platform(cx - r - 1, cz - r - 1, cx + r + 1, cz + r + 1, H, 1, { style: 'plain', face: C.brickGray, top: C.brickGray });
    // 下层十字形屋身
    A.body(cx - r, cz - 5, cx + r, cz + 5, H + 1, 6, { sides: { s: 'window', n: 'window', e: 'window', w: 'window' }, bay: 4 });
    A.body(cx - 5, cz - r, cx + 5, cz + r, H + 1, 6, { sides: { s: 'window', n: 'window', e: 'window', w: 'window' }, bay: 4 });
    A.roof(cx - r - 2, cz - r - 2, cx + r + 2, cz + r + 2, H + 7, 5,
      { type: 'cross', thk: 1, ridgeH: 1, lift: 2, gw: 5, gwz: 5, tref: 7 });
    // 中层
    A.body(cx - 7, cz - 4, cx + 7, cz + 4, H + 12, 4, { sides: { s: 'window', n: 'window', e: 'window', w: 'window' }, bay: 3 });
    A.body(cx - 4, cz - 7, cx + 4, cz + 7, H + 12, 4, { sides: { s: 'window', n: 'window', e: 'window', w: 'window' }, bay: 3 });
    A.roof(cx - 9, cz - 9, cx + 9, cz + 9, H + 16, 4, { type: 'cross', thk: 1, ridgeH: 1, lift: 1, gw: 4, gwz: 4, tref: 5 });
    // 上层十字脊
    A.body(cx - 5, cz - 3, cx + 5, cz + 3, H + 20, 4, { sides: { s: 'window', n: 'window', e: 'window', w: 'window' }, bay: 3 });
    A.body(cx - 3, cz - 5, cx + 3, cz + 5, H + 20, 4, { sides: { s: 'window', n: 'window', e: 'window', w: 'window' }, bay: 3 });
    const top = A.roof(cx - 7, cz - 7, cx + 7, cz + 7, H + 24, 6, { type: 'cross', ridgeH: 2, lift: 2, gw: 4, gwz: 4 });
    A.reg(name, cx - r, cz - r, cx + r, cz + r, top, '城防',
      '紫禁城四隅角楼，三重檐十字脊歇山顶，九梁十八柱七十二条脊，是中国古代木构建筑的精巧之作。');
  };
  corner(-X + 13, -Z + 13, '西北角楼');
  corner(X - 13, -Z + 13, '东北角楼');
  corner(-X + 13, Z - 13, '西南角楼');
  corner(X - 13, Z - 13, '东南角楼');

  // ---- 马道（登城斜道）----
  const mado = (cx, cz, dir) => {
    for (let s = 0; s < H; s++) {
      const y = s;
      if (dir === 'e') V.box(cx + s * 2, 0, cz - 4, cx + s * 2 + 1, y, cz + 4, C.brickGrayD);
      else V.box(cx - s * 2 - 1, 0, cz - 4, cx - s * 2, y, cz + 4, C.brickGrayD);
    }
  };
  mado(-X + T + 1, 400, 'w'); mado(X - T - 1, 400, 'e');
  mado(-X + T + 1, -420, 'w'); mado(X - T - 1, -420, 'e');

  // ---- 东华门 / 西华门 ----
  const sideGate = (sx, name, desc) => {
    const gx = sx * (X - T / 2);
    // 城台开券门
    V.clearBox(sx > 0 ? X - T : -X, 0, 292, sx > 0 ? X : -X + T, 6, 308);
    V.box(sx > 0 ? X - T : -X, 7, 292, sx > 0 ? X : -X + T, 7, 308, C.brickGray);
    A.gate({
      name, x: gx, z: 300, w: 30, d: 14, y: FC.WALL_H + 1, ph: 0, bh: 6, tiers: 2,
      openings: 3, over: 3, rh: 6, cat: '门', desc,
    });
    G.rect(gx - 20, 292, gx + 20, 308, GM.plaza, 0);
  };
  sideGate(1, '东华门', '紫禁城东门，门楼面阔五间、重檐庑殿顶。门钉纵九横八，为紫禁城诸门中的特例。');
  sideGate(-1, '西华门', '紫禁城西门，形制与东华门相同，清代帝后由此往西苑（今中南海）游幸。');
  // 东华门、西华门外石桥
  A.bridge(X + FC.MOAT_IN + FC.MOAT_W / 2, 300, 7, 26, { dir: 'ew', rise: 3, y: 1 });
  A.bridge(-(X + FC.MOAT_IN + FC.MOAT_W / 2), 300, 7, 26, { dir: 'ew', rise: 3, y: 1 });

  // ---- 神武门 ----
  V.clearBox(-16, 0, -Z, 16, 7, -Z + T);
  V.box(-16, 8, -Z, 16, 8, -Z + T, C.brickGray);
  A.gate({
    name: '神武门', x: 0, z: -Z + T / 2, w: 34, d: 15, y: FC.WALL_H + 1, ph: 0, bh: 7, tiers: 2,
    openings: 3, over: 4, rh: 8, cat: '门',
    desc: '紫禁城北门，原名玄武门，清康熙年间避讳改称神武门。门楼面阔五间、重檐庑殿顶，上悬钟鼓以报更。',
  });
  A.bridge(0, -(Z + FC.MOAT_IN + FC.MOAT_W / 2), 12, 26, { dir: 'ns', rise: 3, y: 1 });
  G.rect(-40, -Z - 90, 40, -Z, GM.plaza, 0);
};

/* ------------------------------------------------------------
   三、午门 · 端门 · 天安门
   ------------------------------------------------------------ */
CITY.southGates = (A) => {
  const V = A.V, G = A.G, Z = FC.WZ;
  // ---- 午门：凹字形城台 ----
  const bodyZ0 = Z - 40, bodyZ1 = Z;        // 主体城台（含在南墙内）
  const H = 12;
  // 主体城台
  A.platform(-62, bodyZ0, 62, bodyZ1, 0, H, { style: 'plain', face: C.cityWall, top: C.brickGray, stone: C.stone });
  // 两翼（雁翅楼城台）向南伸出
  A.platform(-62, bodyZ1, -46, bodyZ1 + 88, 0, H, { style: 'plain', face: C.cityWall, top: C.brickGray });
  A.platform(46, bodyZ1, 62, bodyZ1 + 88, 0, H, { style: 'plain', face: C.cityWall, top: C.brickGray });
  // 券门：中间三门 + 左右掖门
  for (const [x, w] of [[0, 4], [-22, 3], [22, 3]]) {
    V.clearBox(x - w, 0, bodyZ0 - 1, x + w, 7 + (w > 3 ? 1 : 0), bodyZ1 + 1);
    V.box(x - w, 8 + (w > 3 ? 1 : 0), bodyZ0 - 1, x + w, 8 + (w > 3 ? 1 : 0), bodyZ1 + 1, C.brickGray);
  }
  for (const x of [-52, 52]) {   // 左右掖门（开在两翼根部）
    V.clearBox(x - 3, 0, bodyZ0 - 1, x + 3, 6, bodyZ1 + 1);
    V.box(x - 3, 7, bodyZ0 - 1, x + 3, 7, bodyZ1 + 1, C.brickGray);
  }
  // 五凤楼：正楼（面阔九间 重檐庑殿）
  A.hall({
    name: '午门·五凤楼', x: 0, z: bodyZ0 + 20, w: 60, d: 24, y: H, ph: 1, bh: 12, tiers: 2,
    over: 5, rh: 10, type: 'hip', bay: 6, cat: '外朝正门', pave: false,
    sides: { s: 'window', n: 'window', e: 'window', w: 'window' },
    desc: '紫禁城正门，因平面呈凹形、五座楼阁如凤翼，故称五凤楼。明清两代于此颁诏、献俘、廷杖，冬至前颁次年历书。',
  });
  // 四座阙亭（两翼南端与主楼两端）
  for (const x of [-54, 54]) {
    A.pavilion({ x, z: bodyZ1 + 80, r: 6, y: H, ph: 1, bh: 6, type: 'pyramid', rh: 6, over: 2, pave: false });
    A.pavilion({ x, z: bodyZ1 + 20, r: 6, y: H, ph: 1, bh: 6, type: 'pyramid', rh: 6, over: 2, pave: false });
  }
  // 雁翅楼廊庐
  A.body(-60, bodyZ1 + 28, -48, bodyZ1 + 72, H + 1, 6, { sides: { s: 'window', n: 'window', e: 'open', w: 'window' }, bay: 4 });
  A.roof(-62, bodyZ1 + 26, -46, bodyZ1 + 74, H + 7, 4, { type: 'hip', thk: 1, ridgeH: 1, lift: 1, tref: 5 });
  A.body(48, bodyZ1 + 28, 60, bodyZ1 + 72, H + 1, 6, { sides: { s: 'window', n: 'window', e: 'window', w: 'open' }, bay: 4 });
  A.roof(46, bodyZ1 + 26, 62, bodyZ1 + 74, H + 7, 4, { type: 'hip', thk: 1, ridgeH: 1, lift: 1, tref: 5 });
  G.rect(-46, Z, 46, Z + 92, GM.plaza, 0);
  A.reg('午门前广场', -46, Z, 46, Z + 92, 2, '广场', '午门凹形广场，明清举行颁诏、献俘典礼之处。');

  // ---- 端门 ----
  const dz = Z + 210;
  A.platform(-60, dz - 15, 60, dz + 15, 0, 11, { style: 'plain', face: C.cityWall, top: C.brickGray, stone: C.stone });
  for (const [x, w] of [[0, 4], [-20, 3], [20, 3]]) {
    V.clearBox(x - w, 0, dz - 16, x + w, 7, dz + 16);
    V.box(x - w, 8, dz - 16, x + w, 8, dz + 16, C.brickGray);
  }
  A.hall({
    name: '端门', x: 0, z: dz, w: 44, d: 20, y: 11, ph: 1, bh: 10, tiers: 2, over: 4, rh: 9,
    type: 'hip', bay: 5, cat: '皇城', pave: false,
    sides: { s: 'window', n: 'window', e: 'window', w: 'window' },
    desc: '皇城端门，与天安门形制相同，明清时存放皇帝仪仗。端门与午门之间为御道广场。',
  });
  // 皇城墙（端门东西）
  A.wallRun(-300, dz, -60, dz, { h: 8, t: 3 });
  A.wallRun(60, dz, 300, dz, { h: 8, t: 3 });

  // ---- 天安门 ----
  const tz = Z + 390;
  A.platform(-66, tz - 17, 66, tz + 17, 0, 12, { style: 'plain', face: C.cityWall, top: C.brickGray, stone: C.stone });
  for (const [x, w] of [[0, 5], [-22, 3], [22, 3], [-40, 2], [40, 2]]) {
    V.clearBox(x - w, 0, tz - 18, x + w, 7 + (w > 4 ? 1 : 0), tz + 18);
    V.box(x - w, 8 + (w > 4 ? 1 : 0), tz - 18, x + w, 8 + (w > 4 ? 1 : 0), tz + 18, C.brickGray);
  }
  A.hall({
    name: '天安门', x: 0, z: tz, w: 56, d: 22, y: 12, ph: 1, bh: 12, tiers: 2, over: 5, rh: 10,
    type: 'hip', bay: 6, cat: '皇城', pave: false,
    sides: { s: 'door', n: 'door', e: 'window', w: 'window' },
    desc: '明永乐十八年建，初名承天门，清顺治八年重修改称天安门。城楼面阔九间、进深五间，重檐歇山顶，是明清皇城正门。',
  });
  A.wallRun(-300, tz, -66, tz, { h: 9, t: 3 });
  A.wallRun(66, tz, 300, tz, { h: 9, t: 3 });
  // 外金水河 + 五座金水桥 + 华表石狮
  G.rect(-140, tz + 34, 140, tz + 48, GM.water, FC.WATER_Y);
  for (const [x, w] of [[0, 6], [-30, 5], [30, 5], [-58, 4], [58, 4]]) {
    A.bridge(x, tz + 41, w, 12, { dir: 'ns', rise: 2, y: 1, imperial: x === 0 });
  }
  A.huabiao(-32, tz + 26); A.huabiao(32, tz + 26);
  A.huabiao(-32, tz + 56); A.huabiao(32, tz + 56);
  A.lion(-18, tz + 24); A.lion(18, tz + 24);
  G.rect(-160, tz + 14, 160, tz + 34, GM.plaza, 0);
  G.rect(-200, tz + 48, 200, tz + 120, GM.plaza, 0);
  // 御道（让开护城河南段，另设石桥）
  const mz0 = Z + FC.MOAT_IN_S, mz1 = Z + FC.MOAT_IN_S + FC.MOAT_W;
  G.rect(-20, Z + 92, 20, mz0, GM.slab, 0);
  G.rect(-20, mz1, 20, tz - 18, GM.slab, 0);
  A.bridge(0, (mz0 + mz1) / 2, 11, 28, { dir: 'ns', rise: 3, y: 1, imperial: true });
  A.reg('午门外御道桥', -12, mz0, 12, mz1, 5, '桥梁', '端门与午门之间跨越筒子河的御路石桥。');
  A.reg('外金水桥', -70, tz + 30, 70, tz + 52, 4, '桥梁', '天安门前外金水河上的五座汉白玉石桥，中为御路桥，仅皇帝可通行。');
};

window.FC = FC; window.CITY = CITY; window.buildCity = buildCity;
