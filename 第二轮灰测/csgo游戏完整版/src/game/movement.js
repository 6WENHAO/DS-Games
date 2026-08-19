// ---------------------------------------------------------------------------
// 移动物理：复刻 Source/CS:GO 的加速模型
//   - 地面：friction -> accelerate（wishspeed 全量）
//   - 空中：airaccelerate，wishspeed 上限 30 u/s（可空中转身/加速）
//   - 轴分离的 AABB 碰撞 + 0.45m 自动上台阶 + 蹲伏高度过渡
// 实体位置约定为“脚底中心”（pos.y = 脚底），AABB = pos ± radius，高度向上。
// ---------------------------------------------------------------------------

import { v3, clamp, vlenXZ } from '../core/math.js';

const U = 0.01905;   // CS 单位 -> 米

export const MOVE = {
  gravity: 800 * U,          // 15.24 m/s²
  accelerate: 5.5,
  airAccelerate: 12,
  friction: 5.2,
  stopSpeed: 80 * U,
  jumpVel: 5.45,             // 起跳速度，跳跃高度 ≈ 0.97m
  stepHeight: 0.45,
  radius: 0.30,              // 半宽（32 单位宽 -> 0.61m）
  standHeight: 1.37,
  crouchHeight: 0.90,
  eyeStand: 1.22,
  eyeCrouch: 0.75,
  duckSpeed: 0.34,           // 蹲伏时速度倍率
  walkSpeed: 0.52,           // 按住 Shift 静步倍率
  airWishCap: 30 * U,        // 空中 wishspeed 上限
  maxSpeedDefault: 250 * U,
  jumpCooldown: 0.10,
  duckTransition: 0.28,      // 蹲下/起立所需秒数
  ladderSpeed: 200 * U,
  maxFallSpeed: 60,
  landHardSpeed: 7.0,        // 超过该下落速度算重着地
  fallDamageSpeed: 8.2,      // 开始受落地伤害的速度
};

const _boxes = [];
const _min = v3(), _max = v3();

function hullMin(out, pos, r) { out[0] = pos[0] - r; out[1] = pos[1]; out[2] = pos[2] - r; return out; }
function hullMax(out, pos, r, h) { out[0] = pos[0] + r; out[1] = pos[1] + h; out[2] = pos[2] + r; return out; }

/** 该位置的 hull 是否与世界重叠 */
export function hullStuck(world, pos, r, h) {
  hullMin(_min, pos, r); hullMax(_max, pos, r, h);
  _min[1] += 0.001; _max[1] -= 0.001;
  _min[0] += 0.001; _max[0] -= 0.001;
  _min[2] += 0.001; _max[2] -= 0.001;
  return world.overlaps(_min, _max, _boxes) > 0;
}

/** 沿单轴移动并解决碰撞。返回 true 表示被阻挡 */
function moveAxis(world, pos, r, h, axis, delta) {
  if (delta === 0) return false;
  pos[axis] += delta;
  hullMin(_min, pos, r); hullMax(_max, pos, r, h);
  // 轻微收缩，避免与共面几何体互相卡住
  const shrink = 0.0015;
  _min[0] += shrink; _max[0] -= shrink;
  _min[2] += shrink; _max[2] -= shrink;
  _min[1] += shrink; _max[1] -= shrink;
  if (!world.overlaps(_min, _max, _boxes)) return false;

  let blocked = false;
  if (delta > 0) {
    let limit = Infinity;
    for (const s of _boxes) limit = Math.min(limit, s.min[axis]);
    if (limit < Infinity) {
      pos[axis] = axis === 1 ? limit - h - 0.001 : limit - r - 0.001;
      blocked = true;
    }
  } else {
    let limit = -Infinity;
    for (const s of _boxes) limit = Math.max(limit, s.max[axis]);
    if (limit > -Infinity) {
      pos[axis] = axis === 1 ? limit + 0.001 : limit + r + 0.001;
      blocked = true;
    }
  }
  return blocked;
}

/**
 * 尝试整段位移（含自动上台阶）。
 * @returns { blockedX, blockedZ, blockedY, landed, hitCeil }
 */
function slideMove(world, ent, dx, dy, dz) {
  const r = MOVE.radius, h = ent.height;
  const res = { blockedX: false, blockedZ: false, landed: false, hitCeil: false, stepped: 0 };
  const startX = ent.pos[0], startY = ent.pos[1], startZ = ent.pos[2];

  // 先垂直
  if (dy !== 0) {
    const b = moveAxis(world, ent.pos, r, h, 1, dy);
    if (b) {
      if (dy < 0) { res.landed = true; ent.vel[1] = 0; }
      else { res.hitCeil = true; ent.vel[1] = 0; }
    }
  }

  // 再水平（记录被阻挡情况以便尝试台阶）
  const preX = ent.pos[0], preZ = ent.pos[2];
  res.blockedX = moveAxis(world, ent.pos, r, h, 0, dx);
  res.blockedZ = moveAxis(world, ent.pos, r, h, 2, dz);

  if ((res.blockedX || res.blockedZ) && (ent.onGround || res.landed)) {
    // 台阶尝试：抬高 stepHeight 后重新水平移动，再落回
    const savedX = ent.pos[0], savedZ = ent.pos[2];
    const trial = { pos: [preX, ent.pos[1], preZ], vel: ent.vel, height: h, onGround: ent.onGround };
    const up = MOVE.stepHeight;
    // 头顶是否有空间
    let can = true;
    trial.pos[1] += up;
    if (hullStuck(world, trial.pos, r, h)) can = false;
    if (can) {
      moveAxis(world, trial.pos, r, h, 0, dx);
      moveAxis(world, trial.pos, r, h, 2, dz);
      // 落回地面
      const fell = moveAxis(world, trial.pos, r, h, 1, -up - 0.02);
      const gainedBefore = Math.hypot(savedX - preX, savedZ - preZ);
      const gainedAfter = Math.hypot(trial.pos[0] - preX, trial.pos[2] - preZ);
      if (gainedAfter > gainedBefore + 0.001 && !hullStuck(world, trial.pos, r, h)) {
        ent.pos[0] = trial.pos[0];
        ent.pos[2] = trial.pos[2];
        res.stepped = trial.pos[1] - startY;
        ent.pos[1] = trial.pos[1];
        if (fell) { res.landed = true; }
        res.blockedX = false; res.blockedZ = false;
      }
    }
  }
  return res;
}

/** 向下探测地面：返回 { onGround, groundY, mat } */
export function probeGround(world, pos, r, h, dist = 0.06) {
  hullMin(_min, pos, r); hullMax(_max, pos, r, h);
  _min[1] -= dist;
  _max[1] = pos[1] + 0.02;
  _min[0] += 0.02; _max[0] -= 0.02;
  _min[2] += 0.02; _max[2] -= 0.02;
  if (!world.overlaps(_min, _max, _boxes)) return { onGround: false, groundY: -Infinity, mat: null };
  let top = -Infinity, mat = null;
  for (const s of _boxes) {
    if (s.max[1] <= pos[1] + 0.03 && s.max[1] > top) { top = s.max[1]; mat = s.mat; }
  }
  if (top === -Infinity) return { onGround: false, groundY: -Infinity, mat: null };
  return { onGround: true, groundY: top, mat };
}

/** 尝试把卡在墙里的实体推出来 */
export function unstick(world, ent) {
  const r = MOVE.radius, h = ent.height;
  if (!hullStuck(world, ent.pos, r, h)) return true;
  const dirs = [
    [0, 0.1, 0], [0, 0.35, 0], [0, 0.8, 0],
    [0.35, 0, 0], [-0.35, 0, 0], [0, 0, 0.35], [0, 0, -0.35],
    [0.7, 0.2, 0], [-0.7, 0.2, 0], [0, 0.2, 0.7], [0, 0.2, -0.7],
    [0.7, 0.5, 0.7], [-0.7, 0.5, 0.7], [0.7, 0.5, -0.7], [-0.7, 0.5, -0.7],
    [0, 1.5, 0], [1.5, 0.5, 0], [-1.5, 0.5, 0], [0, 0.5, 1.5], [0, 0.5, -1.5],
  ];
  const p = ent.pos;
  for (const d of dirs) {
    const t = [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
    if (!hullStuck(world, t, r, h)) { p[0] = t[0]; p[1] = t[1]; p[2] = t[2]; return true; }
  }
  return false;
}

function accelerate(ent, wishDir, wishSpeed, accel, dt) {
  const cur = ent.vel[0] * wishDir[0] + ent.vel[2] * wishDir[2];
  const add = wishSpeed - cur;
  if (add <= 0) return;
  let accelSpeed = accel * wishSpeed * dt;
  if (accelSpeed > add) accelSpeed = add;
  ent.vel[0] += wishDir[0] * accelSpeed;
  ent.vel[2] += wishDir[2] * accelSpeed;
}

function applyFriction(ent, dt) {
  const speed = Math.hypot(ent.vel[0], ent.vel[2]);
  if (speed < 0.02) { ent.vel[0] = 0; ent.vel[2] = 0; return; }
  const control = speed < MOVE.stopSpeed ? MOVE.stopSpeed : speed;
  let drop = control * MOVE.friction * dt;
  let newSpeed = speed - drop;
  if (newSpeed < 0) newSpeed = 0;
  const s = newSpeed / speed;
  ent.vel[0] *= s;
  ent.vel[2] *= s;
}

/**
 * 主移动函数。
 * ent: { pos, vel, onGround, ducking, duckFrac, height, maxSpeed, jumpTimer, lastFallSpeed }
 * cmd: { forward, side, jump, duck, walk, wishYaw }
 * @returns { landed, landSpeed, stepped, hitCeil, speed }
 */
export function moveEntity(world, ent, cmd, dt) {
  if (dt <= 0) return { landed: false, landSpeed: 0, stepped: 0, hitCeil: false, speed: 0 };
  dt = Math.min(dt, 0.05);

  // ---- 蹲伏过渡 ----
  const wantDuck = !!cmd.duck;
  const rate = dt / MOVE.duckTransition;
  if (wantDuck) {
    ent.duckFrac = Math.min(1, ent.duckFrac + rate);
  } else if (ent.duckFrac > 0) {
    // 起立需要头顶空间
    const targetH = MOVE.crouchHeight + (MOVE.standHeight - MOVE.crouchHeight) * Math.max(0, ent.duckFrac - rate);
    const probe = { pos: ent.pos, height: targetH };
    if (!hullStuck(world, ent.pos, MOVE.radius, targetH)) ent.duckFrac = Math.max(0, ent.duckFrac - rate);
  }
  ent.ducking = ent.duckFrac > 0.5;
  const newHeight = MOVE.crouchHeight + (MOVE.standHeight - MOVE.crouchHeight) * (1 - ent.duckFrac);
  ent.height = newHeight;
  ent.eyeHeight = MOVE.eyeCrouch + (MOVE.eyeStand - MOVE.eyeCrouch) * (1 - ent.duckFrac);

  // ---- 期望方向 ----
  const yaw = cmd.wishYaw !== undefined ? cmd.wishYaw : ent.yaw;
  const fx = Math.cos(yaw), fz = Math.sin(yaw);
  const rx = -Math.sin(yaw), rz = Math.cos(yaw);
  let wx = fx * cmd.forward + rx * cmd.side;
  let wz = fz * cmd.forward + rz * cmd.side;
  const wl = Math.hypot(wx, wz);
  let wishSpeed = 0;
  const wishDir = [0, 0, 0];
  if (wl > 1e-5) {
    wishDir[0] = wx / wl; wishDir[2] = wz / wl;
    wishSpeed = Math.min(wl, 1) * ent.maxSpeed;
    if (cmd.walk) wishSpeed *= MOVE.walkSpeed;
    if (ent.duckFrac > 0.05) wishSpeed *= (1 - ent.duckFrac * (1 - MOVE.duckSpeed));
  }
  if (ent.speedPenalty) wishSpeed *= ent.speedPenalty;   // 例如开镜/中弹减速

  // ---- 梯子 ----
  if (ent.onLadder) {
    ent.vel[1] = cmd.forward * MOVE.ladderSpeed;
    ent.vel[0] = wishDir[0] * MOVE.ladderSpeed * 0.4;
    ent.vel[2] = wishDir[2] * MOVE.ladderSpeed * 0.4;
  }

  // ---- 地面/空中加速 ----
  const wasOnGround = ent.onGround;
  ent.jumpTimer = Math.max(0, (ent.jumpTimer || 0) - dt);
  let jumped = false;
  if (ent.onGround) {
    applyFriction(ent, dt);
    accelerate(ent, wishDir, wishSpeed, MOVE.accelerate, dt);
    ent.vel[1] = Math.min(ent.vel[1], 0);
    if (cmd.jump && ent.jumpTimer <= 0 && !ent.noJump) {
      ent.vel[1] = MOVE.jumpVel;
      ent.onGround = false;
      ent.jumpTimer = MOVE.jumpCooldown;
      jumped = true;
    }
  } else {
    accelerate(ent, wishDir, Math.min(wishSpeed, MOVE.airWishCap), MOVE.airAccelerate, dt);
  }

  // ---- 重力 ----
  if (!ent.onGround && !ent.onLadder) {
    ent.vel[1] -= MOVE.gravity * dt;
    if (ent.vel[1] < -MOVE.maxFallSpeed) ent.vel[1] = -MOVE.maxFallSpeed;
  }

  const fallSpeedBefore = -ent.vel[1];

  // ---- 位移 ----
  const res = slideMove(world, ent, ent.vel[0] * dt, ent.vel[1] * dt, ent.vel[2] * dt);

  // ---- 地面检测 ----
  if (ent.vel[1] <= 0.001) {
    const g = probeGround(world, ent.pos, MOVE.radius, ent.height, 0.08);
    if (g.onGround) {
      ent.pos[1] = g.groundY;
      ent.groundMat = g.mat;
      if (!ent.onGround) { res.landed = true; res.landSpeed = fallSpeedBefore; }
      ent.onGround = true;
      if (ent.vel[1] < 0) ent.vel[1] = 0;
    } else {
      ent.onGround = false;
    }
  } else {
    ent.onGround = false;
  }
  if (jumped) ent.onGround = false;

  // ---- 出界保护 ----
  const b = world.bounds;
  if (ent.pos[1] < b.min[1] - 8) {
    ent.outOfWorld = true;
  }
  ent.pos[0] = clamp(ent.pos[0], b.min[0] - 2, b.max[0] + 2);
  ent.pos[2] = clamp(ent.pos[2], b.min[2] - 2, b.max[2] + 2);

  res.speed = Math.hypot(ent.vel[0], ent.vel[2]);
  res.jumped = jumped;
  return res;
}

/** 计算实体眼睛位置 */
export function eyePos(ent, out) {
  out = out || [0, 0, 0];
  out[0] = ent.pos[0];
  out[1] = ent.pos[1] + (ent.eyeHeight !== undefined ? ent.eyeHeight : MOVE.eyeStand);
  out[2] = ent.pos[2];
  return out;
}
