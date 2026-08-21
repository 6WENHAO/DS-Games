// ---------------------------------------------------------------------------
// 总装：应县佛宫寺释迦塔
//
// 竖向九层结构：明层 5 + 暗层 4，外观「五层六檐」（底层副阶周匝，故多一檐）。
// 平面八角，每层内槽 8 柱、外槽 24 柱，副阶 32 柱。
// 逐层收分（apo 递减）、柱有侧脚生起、上层用材递减（材等 1.0 → 0.88）。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { MAT } from '../lib/materials.js';
import {
  Sculptor,
  InstanceBank,
  trs,
  octRing,
  octBays,
  octCorner,
  octFaceAngle,
  OCT_N,
} from '../lib/geom.js';
import { f, CAI, ZUCAI } from '../lib/cai.js';
import { puzuo, puzuoCorner, puzuoPingzuo, puzuoInner } from './dougong.js';
import {
  platform,
  columnRing,
  lintelRing,
  darkLayer,
  deckRing,
  railing,
  radialBeams,
  wallRing,
  floorPanel,
  ringBays,
} from './structure.js';
import { eaveFace, hipFace, finial, finialChains } from './roof.js';

/* -------------------------------------------------------------------------- */
/*                                 竖向布局                                   */
/* -------------------------------------------------------------------------- */
export const LAYOUT = {
  platform: { h1: 1.7, h2: 2.3, apo: 15.4, sq: 20.2 },
  // 副阶（周匝廊）
  fujie: { apo: 13.6, colH: 4.7, cai: 0.9, perFace: 3, colR: 0.24 },
  stories: [
    { apoOut: 10.9, apoIn: 5.9, colH: 8.1, cai: 1.0, dark: 2.5, colR: 0.29, riseUp: 2.05 },
    { apoOut: 10.3, apoIn: 5.6, colH: 3.5, cai: 0.96, dark: 2.4, colR: 0.275, riseUp: 1.95, pingzuo: 1.35 },
    { apoOut: 9.7, apoIn: 5.3, colH: 3.4, cai: 0.93, dark: 2.3, colR: 0.265, riseUp: 1.9, pingzuo: 1.3 },
    { apoOut: 9.1, apoIn: 5.0, colH: 3.3, cai: 0.9, dark: 2.2, colR: 0.255, riseUp: 1.85, pingzuo: 1.3 },
    { apoOut: 8.5, apoIn: 4.7, colH: 3.2, cai: 0.88, dark: 0, colR: 0.245, riseUp: 0, pingzuo: 1.25 },
  ],
  topRoof: { height: 7.6, yanChu: 0.95, feiChu: 0.6, qiQiao: 0.6, chuQiao: 0.42 },
  finialScale: 1.42,
};

/** 各层出檐参数 */
const EAVE = { yanChu: 0.9, feiChu: 0.58, qiQiao: 0.52, chuQiao: 0.38 };

/* -------------------------------------------------------------------------- */
/*                                   总装                                     */
/* -------------------------------------------------------------------------- */
export function buildPagoda(opts = {}) {
  const root = new THREE.Group();
  root.name = '释迦塔';
  const info = {
    layers: [],
    puzuoCount: 0,
    pieces: 0,
    totalHeight: 0,
    bodyHeight: 0,
    groups: {},
    labels: [],
  };

  /* ------------------------------ 台基 ------------------------------ */
  {
    const s = new Sculptor('台基');
    platform(s, LAYOUT.platform);
    const g = s.finalize();
    g.userData.layer = 'platform';
    root.add(g);
    info.pieces += s.pieces;
    info.groups.platform = g;
  }

  /* ---------------------- 铺作变体（实例化基元）---------------------- */
  const bank = new InstanceBank('铺作');
  const keyLayer = new Map(); // 铺作变体 → 所属层（供分层显示）
  const tie = (key, layer) => {
    keyLayer.set(key, layer);
    return key;
  };
  const defOuter = (cai) =>
    bank.define(`柱头七铺作·${cai}`, (s) =>
      puzuo(s, { scale: cai, jumps: ['hua', 'hua', 'ang', 'ang'], jixin: [false, true, false, true], inner: 2 })
    );
  const defCorner = (cai) =>
    bank.define(`转角铺作·${cai}`, (s) =>
      puzuoCorner(s, { scale: cai, jumps: ['hua', 'hua', 'ang', 'ang'], jixin: [false, true, false, true] })
    );
  const defBujian = (cai) =>
    bank.define(`补间七铺作·${cai}`, (s) =>
      puzuo(s, { scale: cai, jumps: ['hua', 'hua', 'ang', 'ang'], jixin: [false, true, false, true], inner: 1 })
    );
  const defPingzuo = (cai) => bank.define(`平坐铺作·${cai}`, (s) => puzuoPingzuo(s, { scale: cai }));
  const defInner = (cai) => bank.define(`内槽铺作·${cai}`, (s) => puzuoInner(s, { scale: cai }));
  const defFujie = (cai) =>
    bank.define(`副阶五铺作·${cai}`, (s) =>
      puzuo(s, { scale: cai, jumps: ['hua', 'ang'], jixin: [false, true], inner: 1 })
    );

  /* ------------------------------ 副阶 ------------------------------ */
  const fj = LAYOUT.fujie;
  const fjDef = defFujie(fj.cai);
  const fjMeta = fjDef.meta;
  {
    const s = new Sculptor('副阶');
    const heads = columnRing(s, {
      apo: fj.apo,
      perFace: fj.perFace,
      h: fj.colH,
      r: fj.colR,
      y: 0,
      lean: 0.012,
    });
    lintelRing(s, { apo: fj.apo, perFace: fj.perFace, yHead: fj.colH, pu: true, difu: true });
    const yLu = fj.colH + f(10); // 普拍枋上皮
    tie(`副阶五铺作·${fj.cai}`, 'fujie');
    for (const c of heads) bank.place(`副阶五铺作·${fj.cai}`, trs(c.x, yLu, c.z, c.a));
    for (const b of octBays(fj.apo, fj.perFace)) bank.place(`副阶五铺作·${fj.cai}`, trs(b.x, yLu, b.z, b.a));
    info.puzuoCount += heads.length + octBays(fj.apo, fj.perFace).length;
    const g = s.finalize();
    g.userData.layer = 'fujie';
    root.add(g);
    info.pieces += s.pieces;
    info.groups.fujie = g;
    // 副阶檐（八面实例）
    const yL = yLu + fjMeta.liaoyanY + ZUCAI * fj.cai;
    const rLiao = fj.apo + fjMeta.reach;
    bank.define('副阶檐', (s2) =>
      eaveFace(s2, {
        rLiao,
        rWall: LAYOUT.stories[0].apoOut + 0.25,
        riseUp: 1.55,
        ...EAVE,
        yanChu: 0.82,
        feiChu: 0.5,
        qiQiao: 0.44,
        chuQiao: 0.32,
        chuanCount: 10,
      })
    );
    tie('副阶檐', 'fujie');
    for (let i = 0; i < OCT_N; i++) bank.place('副阶檐', trs(0, yL, 0, octFaceAngle(i)));
    info.layers.push({ name: '副阶', y0: 0, yEave: yL });
  }

  /* ---------------------------- 逐层塔身 ---------------------------- */
  let y = 0; // 当前层地面标高
  for (let si = 0; si < LAYOUT.stories.length; si++) {
    const st = LAYOUT.stories[si];
    const cai = st.cai;
    const tag = `${si + 1}层`;
    const s = new Sculptor(tag);

    // 柱网
    const heads = columnRing(s, {
      apo: st.apoOut,
      perFace: 2,
      h: st.colH,
      r: st.colR,
      y,
      base: si === 0,
      lean: 0.01,
      rise: 0.07,
    });
    const iheads = columnRing(s, {
      apo: st.apoIn,
      perFace: 0,
      h: st.colH,
      r: st.colR * 1.12,
      y,
      base: si === 0,
      mat: MAT.zhuIn,
      lean: 0.008,
      rise: 0.05,
    });
    // 阑额 + 普拍枋
    lintelRing(s, { apo: st.apoOut, perFace: 2, yHead: y + st.colH, pu: true, you: si === 0 ? 1.6 : 0, difu: true, difuY: y + 0.1 });
    lintelRing(s, { apo: st.apoIn, perFace: 0, yHead: y + st.colH, pu: true, difu: true, difuY: y + 0.1 });
    // 围护（门窗）
    wallRing(s, {
      apo: st.apoOut,
      perFace: 2,
      y: y + 0.12,
      h: st.colH - 0.18,
      doors: si % 2 === 0 ? [0, 2, 4, 6] : [1, 3, 5, 7],
    });
    // 楼板（内槽井口楼面）
    floorPanel(s, st.apoIn, y);

    /* 铺作：柱头 / 转角 / 补间 / 内槽 */
    const yLu = y + st.colH + f(10);
    defOuter(cai);
    defCorner(cai);
    defBujian(cai);
    defInner(cai);
    for (const kk of ['柱头七铺作', '转角铺作', '补间七铺作', '内槽铺作']) tie(`${kk}·${cai}`, tag);
    let n = 0;
    for (const c of heads) {
      const key = c.corner ? `转角铺作·${cai}` : `柱头七铺作·${cai}`;
      bank.place(key, trs(c.x, yLu, c.z, c.a));
      n++;
    }
    for (const b of octBays(st.apoOut, 2)) {
      bank.place(`补间七铺作·${cai}`, trs(b.x, yLu, b.z, b.a));
      n++;
    }
    for (const c of iheads) {
      bank.place(`内槽铺作·${cai}`, trs(c.x, yLu, c.z, c.a + Math.PI));
      n++;
    }
    for (const b of octBays(st.apoIn, 0)) {
      bank.place(`内槽铺作·${cai}`, trs(b.x, yLu, b.z, b.a + Math.PI));
      n++;
    }
    info.puzuoCount += n;

    // 乳栿（内外槽连系）
    const dm = bank.get(`柱头七铺作·${cai}`).meta;
    radialBeams(s, { apoOut: st.apoOut, apoIn: st.apoIn, y: yLu + (dm.innerTopY ?? 1.0) });

    // 出檐
    const yL = yLu + dm.liaoyanY + ZUCAI * cai;
    const rLiao = st.apoOut + dm.reach;
    const next = LAYOUT.stories[si + 1];
    if (si < LAYOUT.stories.length - 1) {
      const key = `檐·${si + 1}`;
      bank.define(key, (s2) =>
        eaveFace(s2, {
          rLiao,
          rWall: st.apoOut + 0.28,
          riseUp: st.riseUp,
          ...EAVE,
          chuanCount: 9,
        })
      );
      tie(key, tag);
      for (let i = 0; i < OCT_N; i++) bank.place(key, trs(0, yL, 0, octFaceAngle(i)));
    }

    // 暗层（明层之上的刚性桁架箍）
    let yDarkTop = yL;
    if (st.dark > 0) {
      const yDark = yL - 0.2;
      darkLayer(s, { apoOut: st.apoOut, apoIn: st.apoIn, y: yDark, h: st.dark, perFace: 2 });
      yDarkTop = yDark + st.dark;
    }

    const g = s.finalize();
    g.userData.layer = tag;
    root.add(g);
    info.pieces += s.pieces;
    info.groups[tag] = g;
    info.layers.push({ name: tag, y0: y, yEave: yL, yTop: yDarkTop });

    /* 平坐（下一层的地面）*/
    if (next) {
      const sp = new Sculptor(`${si + 2}层平坐`);
      const pzCai = next.cai;
      defPingzuo(pzCai);
      tie(`平坐铺作·${pzCai}`, `平坐${si + 2}`);
      const pzY = yDarkTop;
      const pzHeads = octRing(next.apoOut, 2);
      for (const c of pzHeads) bank.place(`平坐铺作·${pzCai}`, trs(c.x, pzY, c.z, c.a));
      for (const b of octBays(next.apoOut, 2)) bank.place(`平坐铺作·${pzCai}`, trs(b.x, pzY, b.z, b.a));
      info.puzuoCount += pzHeads.length + octBays(next.apoOut, 2).length;
      const pzMeta = bank.get(`平坐铺作·${pzCai}`).meta;
      const deck = deckRing(sp, {
        apo: next.apoOut,
        y: pzY + pzMeta.liaoyanY,
        out: pzMeta.reach + 0.15,
        perFace: 2,
      });
      railing(sp, { apo: next.apoOut + pzMeta.reach + 0.1, y: deck.deckY, h: 0.95, perFace: 2 });
      const gp = sp.finalize();
      gp.userData.layer = `${si + 2}层平坐`;
      root.add(gp);
      info.pieces += sp.pieces;
      info.groups[`平坐${si + 2}`] = gp;
      y = deck.deckY;
    } else {
      /* -------------------- 顶层：攒尖屋顶 + 塔刹 -------------------- */
      const sr = new Sculptor('塔刹');
      const tr = LAYOUT.topRoof;
      bank.define('攒尖坡面', (s2) =>
        hipFace(s2, { rLiao, height: tr.height, ...tr, rTop: 1.2, chuanCount: 9, segR: 5 })
      );
      tie('攒尖坡面', '屋顶');
      for (let i = 0; i < OCT_N; i++) bank.place('攒尖坡面', trs(0, yL, 0, octFaceAngle(i)));
      // 塔刹
      const fs = LAYOUT.finialScale;
      const fm = finial(sr, { r: 1.05 * fs });
      // 刹座落在屋顶顶点
      const shaY = yL + tr.height;
      const gTop = sr.finalize();
      gTop.position.y = shaY;
      gTop.userData.layer = '塔刹';
      root.add(gTop);
      info.pieces += sr.pieces;
      info.groups.finial = gTop;
      // 攒尖坡面实例用绝对坐标，需单独一组（不能带塔刹的偏移）
      const gRoof = new THREE.Group();
      gRoof.name = '屋顶';
      gRoof.userData.layer = '屋顶';
      root.add(gRoof);
      info.groups['屋顶'] = gRoof;
      // 铁链
      const sc = new Sculptor('铁链');
      finialChains(sc, {
        yTop: shaY + fm.top * 0.62,
        yEnd: yL - 0.2,
        rEnd: rLiao / Math.cos(Math.PI / OCT_N) + tr.yanChu + tr.chuQiao,
      });
      const gc = sc.finalize();
      root.add(gc);
      info.pieces += sc.pieces;
      info.totalHeight = shaY + fm.top + LAYOUT.platform.h1 + LAYOUT.platform.h2;
      info.bodyHeight = shaY + fm.top;
      info.layers.push({ name: '塔刹', y0: shaY, yTop: shaY + fm.top });
    }
  }

  /* -------------------------- 生成实例网格 -------------------------- */
  const stat = bank.build((key) => {
    const ln = keyLayer.get(key);
    return (ln && info.groups[ln]) || root;
  });
  info.instMeshes = stat.meshes;
  info.instances = stat.instances;
  info.pieces += stat.pieces;
  info.bank = bank;
  return { group: root, info };
}
