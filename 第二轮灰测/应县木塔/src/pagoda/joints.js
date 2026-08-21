// ---------------------------------------------------------------------------
// 榫卯图解：把塔上真正用到的七种榫卯做成可「拆开 / 合上」的示教模型
//
// 每种榫卯由若干「零件组」构成，每组带一个拆解方向与距离；
// update(t) 中 t = 0 完全组装、t = 1 完全拆开。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { MAT } from '../lib/materials.js';
import { Sculptor } from '../lib/geom.js';
import { f, CAI_T, DANCAI, ZUCAI, DOU, gongProfile } from '../lib/cai.js';
import { douBlock } from './dougong.js';

/* ------------------------------- 小工具 --------------------------------- */
/** 四块围出中间卯口（矩形透孔）的构件 */
function blockWithMortise(s, mat, w, h, d, mw, md, x = 0, y = 0, z = 0, tile = 0.4) {
  const sw = (w - mw) / 2;
  const sd = (d - md) / 2;
  if (sw > 1e-4) {
    s.box(mat, sw, h, d, x - (w - sw) / 2, y, z, 0, tile);
    s.box(mat, sw, h, d, x + (w - sw) / 2, y, z, 0, tile);
  }
  if (sd > 1e-4) {
    s.box(mat, mw, h, sd, x, y, z - (d - sd) / 2, 0, tile);
    s.box(mat, mw, h, sd, x, y, z + (d - sd) / 2, 0, tile);
  }
}

/** 方柱侧样（可在任意高度开卯口），profile 沿 Z 挤出 */
function postProfile(w, h, slots = []) {
  // slots: [{y, hh, depth, side:+1右/-1左}]
  const pts = [[-w / 2, 0], [w / 2, 0]];
  const right = slots.filter((s0) => s0.side > 0).sort((a, b) => a.y - b.y);
  for (const s0 of right) {
    pts.push([w / 2, s0.y]);
    pts.push([w / 2 - s0.depth, s0.y]);
    pts.push([w / 2 - s0.depth, s0.y + s0.hh]);
    pts.push([w / 2, s0.y + s0.hh]);
  }
  pts.push([w / 2, h], [-w / 2, h]);
  const left = slots.filter((s0) => s0.side < 0).sort((a, b) => b.y - a.y);
  for (const s0 of left) {
    pts.push([-w / 2, s0.y + s0.hh]);
    pts.push([-w / 2 + s0.depth, s0.y + s0.hh]);
    pts.push([-w / 2 + s0.depth, s0.y]);
    pts.push([-w / 2, s0.y]);
  }
  return pts;
}

/* ========================================================================== */
/*                              七种榫卯                                      */
/* ========================================================================== */
export const JOINTS = [
  {
    id: 'mantou',
    name: '馒头榫',
    sub: '柱头 ↔ 普拍枋 / 栌斗',
    desc:
      '柱头凿出圆榫（形如馒头），插入普拍枋底面的圆卯口，再上坐栌斗。' +
      '它只管「定位、防位移」，竖向荷载靠木材端面直接承压传递，因此柱头不会被榫头压劈。',
    points: ['榫径约为柱径 1/3', '榫长 6 分°（约 10cm）', '不承重，只防错动'],
    size: 1.9,
    build(add) {
      add('普拍枋（带卯口）', [0, 1, 0], 0.85, (s) => {
        blockWithMortise(s, MAT.fang, 1.5, f(10), 0.52, 0.2, 0.2, 0, 0.92, 0);
        s.box(MAT.dou, 0.02, 0.001, 0.02, 0, 0.92, 0); // 占位
      });
      add('栌斗', [0, 1, 0], 1.5, (s) => {
        douBlock(s, 'lu', 0, 1.09, 0, 0, { slot: 'cross' });
      });
      add('柱（柱头出馒头榫）', [0, -1, 0], 0.35, (s) => {
        s.cyl(MAT.zhu, 0.26, 0.28, 0.9, 0, 0, 0, 16, 0, 0.7);
        s.cyl(MAT.tenon, 0.098, 0.1, f(10) + 0.02, 0, 0.9, 0, 12, 0, 0.35);
      });
    },
  },
  {
    id: 'yanwei',
    name: '燕尾榫',
    sub: '阑额 ↔ 柱头',
    desc:
      '阑额端头做成「大头在外、小头在内」的燕尾形，自上而下落入柱头的燕尾卯口。' +
      '受拉时越拉越紧，是横向拉结构件（额、枋）的标准做法，又称「银锭榫」。',
    points: ['榫颈小、榫头大 → 抗拔', '自上而下入卯（不能水平抽出）', '常配「乍」（微斜）加紧'],
    size: 2.2,
    build(add) {
      add('柱（燕尾卯口）', [-1, 0, 0], 0.9, (s) => {
        const pts = postProfile(0.5, 1.5, [{ y: 1.02, hh: 0.34, depth: 0.17, side: 1 }]);
        s.profile(MAT.zhu, pts, 0.5, 0, 0, 0, 0, 0.6);
      });
      add('阑额（燕尾榫）', [1, 0, 0], 0.75, (s) => {
        s.box(MAT.fang, 1.15, 0.34, 0.26, 0.75, 1.02, 0, 0, 0.6);
        // 燕尾榫头（平面梯形，竖向挤出）
        const dt = [
          [0, -0.055],
          [0.19, -0.105],
          [0.19, 0.105],
          [0, 0.055],
        ];
        s.profileR(MAT.tenon, dt, 0.3, 0.18, 1.04, 0, -Math.PI / 2, Math.PI, 0, 0.3);
      });
    },
  },
  {
    id: 'dajiao',
    name: '十字搭交（刻半榫）',
    sub: '华拱 × 泥道拱',
    desc:
      '两拱在栌斗口内十字相交，各在相交处刻去一半断面 —— 华拱刻下半、泥道拱刻上半，' +
      '合起来正好一材。拱底又被斗耳夹住，于是「上下相扣、左右相夹」，节点不需要一根钉子。',
    points: ['各刻断面一半（7.5 分°）', '刻口宽 = 材厚 10 分°', '斗耳夹持防侧移'],
    size: 2.6,
    build(add) {
      add('栌斗', [0, -1, 0], 0.55, (s) => {
        douBlock(s, 'lu', 0, 0, 0, 0, { slot: 'cross' });
      });
      const y0 = (DOU.lu.ping + DOU.lu.yi) * 1;
      add('泥道拱（刻上半）', [0, 0.35, -1], 0.7, (s) => {
        const pts = gongProfile(f(62), DANCAI, { notchTop: [{ x: 0, w: CAI_T, d: DANCAI / 2 }] });
        s.profile(MAT.gong, pts, CAI_T, 0, y0, 0, 0, 0.3);
      });
      add('华拱（刻下半）', [0, 0.75, 1], 0.7, (s) => {
        const pts = gongProfile(f(72), DANCAI, { notchBot: [{ x: 0, w: CAI_T, d: DANCAI / 2 }] });
        s.profile(MAT.gong, pts, CAI_T, 0, y0, 0, -Math.PI / 2, 0.3);
      });
      add('散斗 ×2', [0, 1, 0], 1.1, (s) => {
        const e = (f(62) - DOU.san.size) / 2;
        douBlock(s, 'san', e, y0 + DANCAI, 0, 0, { slot: 'x' });
        douBlock(s, 'san', -e, y0 + DANCAI, 0, 0, { slot: 'x' });
      });
    },
  },
  {
    id: 'doukou',
    name: '斗口与斗耳',
    sub: '斗 ↔ 拱',
    desc:
      '斗自上而下分「耳、平、欹」三段：耳高 4–8 分°，两耳之间的槽即斗口，宽度恰为一材厚（10 分°）。' +
      '拱落进斗口，两侧被耳夹紧；耳以下的「平 + 欹」正好等于一栔（6 分°），于是每叠一层升高 21 分°。',
    points: ['斗口宽 = 材厚 = 10 分°', '平 + 欹 = 栔 = 6 分°', '材 + 栔 = 21 分° = 一足材'],
    size: 1.5,
    build(add) {
      add('交互斗（十字口）', [0, -1, 0], 0.3, (s) => {
        douBlock(s, 'jiaohu', 0, 0, 0, 0, { slot: 'cross' });
      });
      add('瓜子拱', [0, 0.4, 1], 0.55, (s) => {
        const yy = (DOU.jiaohu.ping + DOU.jiaohu.yi) * 1;
        const pts = gongProfile(f(62), DANCAI, {});
        s.profile(MAT.gong, pts, CAI_T, 0, yy, 0, 0, 0.3);
      });
      add('齐心斗 + 散斗', [0, 1, 0], 0.95, (s) => {
        const yy = (DOU.jiaohu.ping + DOU.jiaohu.yi) * 1 + DANCAI;
        douBlock(s, 'qixin', 0, yy, 0, 0, { slot: 'x' });
        const e = (f(62) - DOU.san.size) / 2;
        douBlock(s, 'san', e, yy, 0, 0, { slot: 'x' });
        douBlock(s, 'san', -e, yy, 0, 0, { slot: 'x' });
      });
    },
  },
  {
    id: 'chazhu',
    name: '叉柱造',
    sub: '上层柱 ↔ 下层平坐铺作',
    desc:
      '上层檐柱的柱脚十字开口，直接「叉」在下层平坐铺作的栌斗之上，柱脚被斗耳与拱十字卡住。' +
      '这是宋辽楼阁逐层叠垒的标准做法，木塔五层就是这样一层层叉上去的；' +
      '代价是上层柱心比下层内收（故有收分），好处是层间不需任何铁件。',
    points: ['柱脚十字开口，深约 1/3 柱径', '柱心逐层内收 → 形成收分', '层与层之间靠自重压紧'],
    size: 2.8,
    build(add) {
      add('平坐柱', [0, -1, 0], 0.5, (s) => {
        s.cyl(MAT.zhu, 0.25, 0.27, 1.0, 0, 0, 0, 16, 0, 0.7);
      });
      add('普拍枋', [0, -1, 0], 0.9, (s) => {
        s.box(MAT.fang, 1.3, f(10), 0.5, 0, 1.0, 0, 0, 0.6);
      });
      add('栌斗 + 十字拱', [0, 0, 0], 0, (s) => {
        const yb = 1.0 + f(10);
        douBlock(s, 'lu', 0, yb, 0, 0, { slot: 'cross' });
        const y0 = yb + (DOU.lu.ping + DOU.lu.yi);
        const p1 = gongProfile(f(62), DANCAI, { notchTop: [{ x: 0, w: CAI_T, d: DANCAI / 2 }] });
        s.profile(MAT.gong, p1, CAI_T, 0, y0, 0, 0, 0.3);
        const p2 = gongProfile(f(62), DANCAI, { notchBot: [{ x: 0, w: CAI_T, d: DANCAI / 2 }] });
        s.profile(MAT.gong, p2, CAI_T, 0, y0, 0, -Math.PI / 2, 0.3);
      });
      add('上层柱（柱脚十字开口）', [0, 1, 0], 1.3, (s) => {
        const yb = 1.0 + f(10) + DOU.lu.h + DANCAI * 0.35;
        // 柱脚开十字口：用四个 1/4 柱瓣表示
        const r = 0.26;
        const gap = CAI_T / 2;
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) {
            s.box(MAT.tenon, r - gap, 0.42, r - gap, sx * (r + gap) * 0.55, yb, sz * (r + gap) * 0.55, 0, 0.4);
          }
        s.cyl(MAT.zhu, 0.24, 0.26, 1.5, 0, yb + 0.42, 0, 16, 0, 0.7);
      });
    },
  },
  {
    id: 'tousun',
    name: '透榫 · 半榫 · 木楔',
    sub: '乳栿 ↔ 柱',
    desc:
      '梁栿入柱有两种：贯穿柱身、另一侧露出榫头的叫「透榫」（抗拔最好，露头再打木楔锁住）；' +
      '只入柱身一半的叫「半榫」（用于不便贯穿处）。木塔内外槽之间的乳栿即以透榫穿柱，' +
      '两端再被铺作里跳压住，形成「梁—柱—斗拱」三向锁结。',
    points: ['透榫贯穿柱身并出头', '出头处打木楔（销）防退出', '半榫需另加暗销或箍件'],
    size: 3.0,
    build(add) {
      add('柱（透榫卯口）', [0, 0, -1], 0.0, (s) => {
        const pts = postProfile(0.52, 2.0, [
          { y: 0.95, hh: ZUCAI, depth: 0.52, side: 1 },
        ]);
        s.profile(MAT.zhu, pts, 0.52, 0, 0, 0, 0, 0.6);
      });
      add('乳栿（透榫出头）', [1, 0, 0], 1.15, (s) => {
        s.box(MAT.liang, 1.25, ZUCAI, CAI_T * 1.5, 0.88, 0.95, 0, 0, 0.6);
        s.box(MAT.tenon, 0.62, ZUCAI * 0.62, CAI_T * 0.9, 0.06, 0.95 + ZUCAI * 0.19, 0, 0, 0.4);
      });
      add('木楔', [-1, 0.6, 0], 0.55, (s) => {
        s.boxR(MAT.tenon, 0.055, 0.3, 0.16, -0.2, 1.0, 0, 0, 0, 0.06, 0.3);
      });
    },
  },
  {
    id: 'xiecheng',
    name: '斜撑十字搭接',
    sub: '暗层桁架',
    desc:
      '暗层里成对的斜撑在中点十字相交，各刻去一半，再用木销穿钉；' +
      '八个面都这样做，整个暗层就成了一道刚性的八边形箍。木塔历经四十余次地震而不倒，' +
      '关键就在这四道暗层箍与柔性榫卯节点的配合 —— 榫卯可以微动耗能，箍圈则保证整体不散。',
    points: ['交点各刻一半 + 木销', '暗层共四道，形成刚性箍', '榫卯微动 = 天然阻尼'],
    size: 2.4,
    build(add) {
      const L = 2.0;
      const W = f(16);
      const T = f(11);
      add('斜撑甲（刻上半）', [0, 0, 1], 0.5, (s) => {
        const pts = gongProfile(L, W, {
          juan: 0.02,
          tip: W - 0.001,
          notchTop: [{ x: 0, w: T, d: W / 2 }],
        });
        s.profileR(MAT.xie, pts, T, 0, 0.6, 0, 0, 0, 0.62, 0.4);
      });
      add('斜撑乙（刻下半）', [0, 0, -1], 0.5, (s) => {
        const pts = gongProfile(L, W, {
          juan: 0.02,
          tip: W - 0.001,
          notchBot: [{ x: 0, w: T, d: W / 2 }],
        });
        s.profileR(MAT.xie, pts, T, 0, 0.6, 0, 0, 0, -0.62, 0.4);
      });
      add('木销', [0, 0, 1], 0.9, (s) => {
        s.bar(MAT.tenon, 0.028, T * 2.6, 0, 0.6, 0, 'z', 8, 0.2);
      });
    },
  },
];

/* ========================================================================== */
/*                            构建一个榫卯示教件                               */
/* ========================================================================== */
export function buildJoint(spec) {
  const group = new THREE.Group();
  group.name = '榫卯:' + spec.id;
  const parts = [];
  spec.build((name, dir, dist, fn) => {
    const s = new Sculptor(name);
    fn(s);
    const g = s.finalize();
    g.name = name;
    group.add(g);
    const v = new THREE.Vector3(dir[0], dir[1], dir[2]);
    if (v.lengthSq() > 0) v.normalize();
    parts.push({ g, dir: v, dist, name });
  });
  return {
    group,
    parts,
    spec,
    update(t) {
      for (const p of parts) p.g.position.copy(p.dir).multiplyScalar(p.dist * t);
    },
  };
}

/** 全部七件，排成一列（含木作台座） */
export function buildJointBench(o = {}) {
  const group = new THREE.Group();
  group.name = '榫卯图解';
  const gap = o.gap ?? 4.2;
  const items = [];
  const s = new Sculptor('台座');
  JOINTS.forEach((spec, i) => {
    const j = buildJoint(spec);
    const x = (i - (JOINTS.length - 1) / 2) * gap;
    j.group.position.set(x, 0.9, 0);
    group.add(j.group);
    items.push({ ...j, x, index: i });
    // 台座
    s.box(MAT.stone, gap * 0.86, 0.75, 2.6, x, 0, 0, 0, 1);
    s.box(MAT.stoneDark, gap * 0.9, 0.15, 2.75, x, 0.75, 0, 0, 1);
  });
  group.add(s.finalize());
  return { group, items, update: (t) => items.forEach((it) => it.update(t)) };
}
