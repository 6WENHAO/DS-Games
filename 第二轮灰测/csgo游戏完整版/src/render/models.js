// ---------------------------------------------------------------------------
// 模型库：用方块拼出角色 / 武器 / 道具，并提供简易骨骼动画
// ---------------------------------------------------------------------------

import { MeshBuilder, GPUMesh } from './mesh.js';
import { m4, m4mul, m4compose, m4identity, clamp, lerp, v3 } from '../core/math.js';

/** sRGB 十六进制 -> 线性 RGB（渲染器在线性空间做光照） */
export function hexToLinear(hex) {
  let h = (hex || '#ffffff').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2), 1];
}

/** 矩阵池：避免每帧分配 */
export class MatPool {
  constructor(n = 512) {
    this.arr = [];
    for (let i = 0; i < n; i++) this.arr.push(m4());
    this.i = 0;
  }
  reset() { this.i = 0; }
  get() {
    if (this.i >= this.arr.length) this.arr.push(m4());
    return m4identity(this.arr[this.i++]);
  }
}

// 角色尺寸（米）。玩家 hull 高 1.37，模型与之对齐。
export const RIG = {
  hip: 0.60,
  torsoH: 0.46,
  shoulder: 1.02,
  neck: 1.10,
  headR: 0.115,
  headY: 1.235,
  thigh: 0.31,
  shin: 0.29,
  upperArm: 0.25,
  foreArm: 0.24,
  shoulderX: 0.19,
  hipX: 0.10,
};

export class ModelLib {
  constructor(gl) {
    this.gl = gl;
    const B = (sx, sy, sz, cx = 0, cy = 0, cz = 0) => {
      const mb = new MeshBuilder();
      mb.box([cx - sx / 2, cy - sy / 2, cz - sz / 2], [cx + sx / 2, cy + sy / 2, cz + sz / 2], 1, null, true);
      return new GPUMesh(gl, mb);
    };
    // 单位方块（-0.5..0.5），通过缩放矩阵复用
    this.unitBox = B(1, 1, 1);
    const sp = new MeshBuilder(); sp.sphere(0, 0, 0, 0.5, 16, 12);
    this.unitSphere = new GPUMesh(gl, sp);
    const cy = new MeshBuilder(); cy.cylinder(0, -0.5, 0, 0.5, 0.5, 16, true);
    this.unitCyl = new GPUMesh(gl, cy);

    // 角色部件（枢轴在关节处）
    this.head = B(0.23, 0.24, 0.23, 0, 0.12, 0);
    this.torso = B(0.42, RIG.torsoH, 0.24, 0, RIG.torsoH / 2, 0);
    this.pelvis = B(0.34, 0.16, 0.22, 0, -0.08, 0);
    this.upperArm = B(0.10, RIG.upperArm, 0.11, 0, -RIG.upperArm / 2, 0);
    this.foreArm = B(0.09, RIG.foreArm, 0.10, 0, -RIG.foreArm / 2, 0);
    this.thigh = B(0.14, RIG.thigh, 0.16, 0, -RIG.thigh / 2, 0);
    this.shin = B(0.12, RIG.shin, 0.14, 0, -RIG.shin / 2, 0);
    this.foot = B(0.12, 0.07, 0.24, 0, -0.035, -0.05);
    this.helmet = B(0.26, 0.16, 0.27, 0, 0.16, 0);
    this.vest = B(0.45, 0.34, 0.28, 0, RIG.torsoH * 0.62, 0);
    this.hand = B(0.10, 0.10, 0.10);

    // 道具
    this.c4 = B(0.30, 0.10, 0.22, 0, 0.05, 0);
    this.c4panel = B(0.14, 0.02, 0.10, 0, 0.11, 0);
    this.plate = B(0.5, 0.04, 0.5);
    this.pool = new MatPool(768);
    this.viewmodelCache = new Map();
  }

  reset() { this.pool.reset(); }
}

// ------------------------- 角色动画 -----------------------------------------

const _tmpA = m4(), _tmpB = m4();

/**
 * 更新角色动画状态（在实体 update 里调用）
 * ent.anim = { cycle, lean, aimPitch, deathT, deathDir }
 */
export function updateCharacterAnim(ent, dt, speed) {
  if (!ent.anim) ent.anim = { cycle: 0, lean: 0, bob: 0, deathT: 0 };
  const a = ent.anim;
  const norm = clamp(speed / 4.8, 0, 1.6);
  a.cycle += dt * (4.0 + norm * 6.5) * (norm > 0.06 ? 1 : 0);
  if (norm <= 0.06) a.cycle = lerp(a.cycle, Math.round(a.cycle / Math.PI) * Math.PI, 1 - Math.exp(-8 * dt));
  a.speedNorm = lerp(a.speedNorm || 0, norm, 1 - Math.exp(-10 * dt));
  if (!ent.alive) a.deathT = Math.min(1, a.deathT + dt / 0.55);
}

/**
 * 把角色绘制指令推给渲染器。
 *
 * ===== 局部坐标约定（必须与部件网格、动画符号保持一致）=====
 *   +X = 角色右手方向    +Y = 上    **-Z = 角色正前方**
 * 选 -Z 朝前是为了与武器 viewmodel 的约定完全一致（枪管朝 -Z），
 * 这样手上的枪可以直接复用 viewmodel 的方块，不用再做一次翻转。
 * 由此推出的符号（修复前这里整体反了 180°，角色都是背对着跑的）：
 *   - 绕 Y：bodyYaw = -yaw - PI/2  （把局部 -Z 映射到世界 (cos yaw, sin yaw)）
 *   - 绕 X 为正 = 抬头 / 大腿前摆 / 手臂前伸
 *   - 绕 X 为负 = 躯干前倾
 *
 * opts: { cloth, cloth2, skin, gear, hasHelmet, hasArmor, weaponParts }
 */
export function drawCharacter(renderer, lib, ent, opts = {}) {
  const pool = lib.pool;
  const a = ent.anim || { cycle: 0, speedNorm: 0, deathT: 0 };
  const duck = ent.duckFrac || 0;
  const dead = !ent.alive;
  const deathT = a.deathT || 0;

  const cloth = opts.cloth || [0.30, 0.26, 0.20, 1];
  const cloth2 = opts.cloth2 || [0.18, 0.16, 0.13, 1];
  const skin = opts.skin || [0.52, 0.38, 0.30, 1];
  const gearC = opts.gear || [0.10, 0.10, 0.12, 1];

  const yaw = ent.renderYaw !== undefined ? ent.renderYaw : ent.yaw;
  const bodyYaw = -yaw - Math.PI / 2;

  const root = pool.get();
  m4compose(root, [ent.pos[0], ent.pos[1] + (dead ? 0.07 * deathT : 0), ent.pos[2]], [0, bodyYaw, 0], null);

  if (dead) {
    // 倒地：绕左右轴翻转 90°（deathDir 决定前倒还是后倒）
    const fall = pool.get();
    m4compose(fall, [0, 0, 0], [deathT * Math.PI * 0.5 * (a.deathDir || 1), 0, 0], null);
    m4mul(root, root, fall);
  }

  const hipY = lerp(RIG.hip, RIG.hip * 0.62, duck);
  const torsoScale = lerp(1, 0.88, duck);
  const sn = a.speedNorm || 0;
  const c = Math.sin(a.cycle);
  const stride = sn * 0.62;
  const pitch = clamp(ent.pitch || 0, -1.15, 1.15);

  const push = (mesh, mat, color, extra) => {
    renderer.drawModel(mesh, mat, Object.assign({ color, spec: 0.10, gloss: 12 }, extra || {}));
  };
  const local = (parent, pos, rot, scl) => {
    const m = pool.get();
    m4compose(_tmpA, pos, rot, scl);
    m4mul(m, parent, _tmpA);
    return m;
  };

  // ---- 髋部 ----
  const hip = local(root, [0, hipY, 0], [0, 0, 0], null);
  push(lib.pelvis, hip, cloth2);

  // ---- 躯干（前倾 = 负 rx）----
  const lean = -(duck * 0.34 + sn * 0.13) - pitch * 0.10;
  const torso = local(hip, [0, 0, 0], [lean, Math.sin(a.cycle) * 0.05 * sn, 0], [1, torsoScale, 1]);
  push(lib.torso, torso, cloth);
  if (opts.hasArmor) push(lib.vest, torso, gearC, { spec: 0.22, gloss: 24 });

  // ---- 头（抬头 = 正 rx，并抵消躯干前倾）----
  const neck = local(torso, [0, RIG.torsoH, 0], [pitch * 0.75 - lean, 0, 0], null);
  push(lib.head, neck, skin);
  if (opts.hasHelmet) push(lib.helmet, neck, gearC, { spec: 0.3, gloss: 30 });

  // ---- 腿（大腿前摆 = 正 rx）----
  for (const side of [-1, 1]) {
    const phase = side > 0 ? c : -c;
    const thighRot = phase * stride + duck * 0.95;
    const shinRot = -Math.max(0, phase) * stride * 0.75 - duck * 1.55;
    const th = local(hip, [side * RIG.hipX, -0.04, 0], [thighRot, 0, side * 0.04], null);
    push(lib.thigh, th, cloth2);
    const sh = local(th, [0, -RIG.thigh, 0], [shinRot, 0, 0], null);
    push(lib.shin, sh, cloth2);
    const ft = local(sh, [0, -RIG.shin, 0], [-thighRot - shinRot, 0, 0], null);
    push(lib.foot, ft, [0.06, 0.05, 0.05, 1]);
  }

  // ---- 持枪节点：双手与武器挂在同一节点，随视角俯仰 ----
  const aim = dead ? -0.7 : pitch;
  const shoulderY = RIG.torsoH * 0.86;
  const hands = local(torso, [0.02, RIG.torsoH * 0.62, -0.08], [aim - lean, 0, 0], null);

  // 右臂（正 rx = 前伸）
  const rArm = local(torso, [RIG.shoulderX, shoulderY, 0], [1.00 + aim * 0.55, -0.22, -0.20], null);
  push(lib.upperArm, rArm, cloth);
  const rFore = local(rArm, [0, -RIG.upperArm, 0], [0.52 - aim * 0.15, 0.22, 0.10], null);
  push(lib.foreArm, rFore, cloth);
  push(lib.hand, local(rFore, [0, -RIG.foreArm - 0.03, 0], [0, 0, 0], null), skin);
  // 左臂（托前护木，抬得更高）
  const lArm = local(torso, [-RIG.shoulderX, shoulderY, 0], [1.28 + aim * 0.55, 0.42, 0.22], null);
  push(lib.upperArm, lArm, cloth);
  const lFore = local(lArm, [0, -RIG.upperArm, 0], [0.70 - aim * 0.15, -0.34, 0], null);
  push(lib.foreArm, lFore, cloth);
  push(lib.hand, local(lFore, [0, -RIG.foreArm - 0.03, 0], [0, 0, 0], null), skin);

  // ---- 手上的武器：直接复用 viewmodel 方块（同为 -Z 朝前）----
  if (opts.weaponParts && !dead) {
    const gun = local(hands, [0.07, -0.05, -0.20], [0, 0, 0], null);
    for (const p of opts.weaponParts) {
      const pm = pool.get();
      m4compose(_tmpA, p.pos, p.rot || [0, 0, 0], p.size);
      m4mul(pm, gun, _tmpA);
      push(lib.unitBox, pm, p.colorLin, { spec: 0.3, gloss: 26 });
    }
  }
  return root;
}

/** 把 weapondata 的 viewmodel.parts 预处理成带线性颜色的数组 */
export function prepareParts(vm) {
  if (!vm || !vm.parts) return null;
  return vm.parts.map((p) => ({
    pos: p.pos, size: p.size, rot: p.rot || null, colorLin: hexToLinear(p.color),
    name: p.name,
  }));
}

const HAND_SKIN = hexToLinear('#8f6b50');
const HAND_SLEEVE = hexToLinear('#3a3931');

/**
 * 根据武器自身的方块推算"握持的手"应该放在哪里。
 *
 * 之前是写死两个方块（z=+0.10 和 z=-0.16），对步枪勉强能看，
 * 但手枪的握把在 z≈+0.02、枪管只到 z≈-0.16，于是一只手飘在握把后面、
 * 另一只手正好套在枪口上——这就是"手枪建模坏了"的原因。
 * 现在改成从 grip / handguard / barrel 等部件的实际位置推导，
 * 并且托枪的手一定放在枪管**下方**，不会吞掉枪管。
 *
 * @returns [{ pos, size, rot, colorLin }]
 */
export function buildHands(def) {
  const vm = def && def.viewmodel;
  if (!vm || !vm.parts) return [];
  const parts = vm.parts;
  const find = (...names) => {
    for (const n of names) {
      const p = parts.find((x) => x.name === n);
      if (p) return p;
    }
    return null;
  };
  const cls = def.class || 'rifle';
  const out = [];

  // ---- 主手：包住握把 ----
  const grip = find('grip', 'handle', 'frame', 'body');
  const gp = grip ? grip.pos : [0, -0.06, 0.02];
  const addMainHand = (sx) => {
    out.push({
      pos: [gp[0] * sx + 0.004 * sx, gp[1] + 0.016, gp[2] + 0.006],
      size: [0.058, 0.076, 0.086], rot: [0.14, 0, 0], colorLin: HAND_SKIN,
    });
    // 袖子/手腕：从画面右下方伸进来，避免手看起来是悬空的方块
    out.push({
      pos: [gp[0] * sx + 0.020 * sx, gp[1] - 0.058, gp[2] + 0.140],
      size: [0.074, 0.074, 0.20], rot: [-0.20, 0, 0.06 * sx], colorLin: HAND_SLEEVE,
    });
  };
  addMainHand(1);

  if (cls === 'knife') return out;

  // 双枪：左右各一套
  const hasLeftPart = parts.some((p) => p.pos[0] < -0.04);
  if (hasLeftPart && cls === 'pistol') {
    const lp = parts.reduce((a, b) => (b.pos[0] < a.pos[0] ? b : a), parts[0]);
    out.push({
      pos: [lp.pos[0] - 0.004, gp[1] + 0.016, gp[2] + 0.006],
      size: [0.058, 0.076, 0.086], rot: [0.14, 0, 0], colorLin: HAND_SKIN,
    });
    out.push({
      pos: [lp.pos[0] - 0.020, gp[1] - 0.058, gp[2] + 0.140],
      size: [0.074, 0.074, 0.20], rot: [-0.20, 0, -0.06], colorLin: HAND_SLEEVE,
    });
    return out;
  }

  if (cls === 'pistol' || cls === 'taser') {
    // 单手枪的双手握姿：副手贴在握把左侧稍下
    out.push({
      pos: [gp[0] - 0.048, gp[1] - 0.004, gp[2] + 0.014],
      size: [0.052, 0.068, 0.080], rot: [0.10, 0, -0.18], colorLin: HAND_SKIN,
    });
    return out;
  }

  if (cls === 'grenade') {
    out.length = 0;
    out.push({ pos: [0.012, -0.062, 0.016], size: [0.072, 0.072, 0.092], rot: [0.2, 0, 0], colorLin: HAND_SKIN });
    out.push({ pos: [0.026, -0.115, 0.150], size: [0.074, 0.074, 0.19], rot: [-0.2, 0, 0.06], colorLin: HAND_SLEEVE });
    return out;
  }

  // ---- 长枪：副手托在枪管/护木下方 ----
  const fore = find('handguard', 'gasblock', 'barrel', 'body');
  const fp = fore ? fore.pos : [0, 0, -0.20];
  const fz = Math.min(fp[2], -0.13);
  const fh = fore && fore.size ? fore.size[1] : 0.03;
  out.push({
    pos: [fp[0] - 0.008, fp[1] - fh * 0.5 - 0.040, fz + 0.01],
    size: [0.056, 0.070, 0.108], rot: [0.16, 0, 0.05], colorLin: HAND_SKIN,
  });
  out.push({
    pos: [fp[0] - 0.030, fp[1] - fh * 0.5 - 0.105, fz + 0.075],
    size: [0.068, 0.068, 0.135], rot: [0.62, 0, 0.22], colorLin: HAND_SLEEVE,
  });
  return out;
}
