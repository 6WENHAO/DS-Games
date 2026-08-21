/**
 * 电影巡航：七个镜头，把“巨构”的七个命题按顺序讲一遍。
 * 这是给第一次进来的人准备的“震撼说明书”。
 */

const V = (a) => ({ x: a[0], y: a[1], z: a[2] });
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createCinematic(cfg) {
  const shots = [
    {
      type: 'orbit', dur: 15,
      r: [1750, 1120], az: [0.45, 1.35], el: [0.10, 0.34],
      look: [[0, 260, 0], [0, 540, 0]], fov: [42, 50],
      title: '一 · 单一巨物',
      text: '巨构不是一群建筑。它是一个构筑物 —— 城市被它整体地吞进去。',
    },
    {
      type: 'path', dur: 13,
      from: [-244, 3.2, -62], to: [-142, 3.4, -62],
      lookFrom: [-140, 9, -54], lookTo: [4, 430, 0],
      fov: [62, 78],
      title: '二 · 尺度暴力',
      text: '偏轴大道宽 22 体素、高 112 体素。抬头，尽头那个东西高 1436 体素。',
    },
    {
      type: 'path', dur: 11,
      from: [-272, 8, 2], to: [-116, 9, 2],
      lookFrom: [-176, 34, 2], lookTo: [-40, 66, 0],
      fov: [70, 60],
      title: '三 · 结构即城市',
      text: '巨柱塔的塔基被掏空成城门。承重的骨架同时是道路、是住区、是城市本身。',
    },
    {
      type: 'path', dur: 12,
      from: [68, 4, 200], to: [68, 4, 54],
      lookFrom: [58, 148, 128], lookTo: [12, 240, 8],
      fov: [76, 82],
      title: '四 · 人造天空',
      text: '天盖在 132 体素处封住天空，只留下按 40 体素节拍开的光缝。天空成了天花板。',
    },
    {
      type: 'path', dur: 20,
      from: [69, 10, 84], to: [69, 1136, 84],
      lookFrom: [0, 46, 0], lookTo: [0, 1080, 0],
      fov: [66, 52], ease: 'inout',
      title: '五 · 层化',
      text: '同一部轿厢，从 10 爬到 1136。中途经过街区、天盖、巨跨、云层 —— 每一层都是另一个世界。',
    },
    {
      type: 'path', dur: 13,
      from: [-470, 900, 430], to: [-214, 1188, 208],
      lookFrom: [0, 880, 0], lookTo: [0, 1290, 0],
      fov: [54, 44],
      title: '六 · 无限',
      text: '顶端穿过云层，消失在雾里；底端穿过基座，消失在深渊里。你看不到它的两端。',
    },
    {
      type: 'orbit', dur: 14,
      r: [1150, 2150], az: [2.35, 3.35], el: [0.30, 0.62],
      look: [[0, 480, 0], [0, 330, 0]], fov: [48, 40],
      title: '巨构 · MEGASTRUCTURE',
      text: '一座可以俯瞰的沙盘，和一个走进去就再也不敢直立的尺度。',
    },
  ];

  let total = 0;
  for (const s of shots) { s.t0 = total; total += s.dur; }

  function sample(time) {
    let t = time % total;
    let shot = shots[shots.length - 1];
    for (const s of shots) { if (t >= s.t0 && t < s.t0 + s.dur) { shot = s; break; } }
    const local = Math.min(1, Math.max(0, (t - shot.t0) / shot.dur));
    const e = shot.ease === 'inout' ? easeInOut(local) : smooth(local);
    const out = { pos: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 0 }, fov: 50, shot, local, index: shots.indexOf(shot) };
    if (shot.type === 'orbit') {
      const r = lerp(shot.r[0], shot.r[1], e);
      const az = lerp(shot.az[0], shot.az[1], local);
      const el = lerp(shot.el[0], shot.el[1], e);
      const lk = {
        x: lerp(shot.look[0][0], shot.look[1][0], e),
        y: lerp(shot.look[0][1], shot.look[1][1], e),
        z: lerp(shot.look[0][2], shot.look[1][2], e),
      };
      out.look = lk;
      out.pos = {
        x: lk.x + r * Math.cos(el) * Math.sin(az),
        y: lk.y + r * Math.sin(el),
        z: lk.z + r * Math.cos(el) * Math.cos(az),
      };
    } else {
      const a = V(shot.from), b = V(shot.to);
      out.pos = { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: lerp(a.z, b.z, e) };
      const la = V(shot.lookFrom), lb = V(shot.lookTo);
      const le = smooth(local);
      out.look = { x: lerp(la.x, lb.x, le), y: lerp(la.y, lb.y, le), z: lerp(la.z, lb.z, le) };
    }
    out.fov = lerp(shot.fov[0], shot.fov[1], e);
    // 镜头切换时的淡入淡出权重
    out.fade = Math.min(1, Math.min(local, 1 - local) / (1.1 / shot.dur));
    return out;
  }

  return { shots, total, sample };
}
