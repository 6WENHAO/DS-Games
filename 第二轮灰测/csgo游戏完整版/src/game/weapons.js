// ---------------------------------------------------------------------------
// 武器运行时：装备管理、开火、后坐力/散布、换弹、切枪、开镜、穿墙、命中盒
// ---------------------------------------------------------------------------

import { WEAPONS, GRENADES, GEAR, hitgroupMultiplier, armorPenetratedDamage, damageAtDistance } from './weapondata.js';
import {
  v3, vadd, vsub, vscale, vnorm, vdot, vcross, vdist, clamp, lerp, rnd, rndRange, TAU, DEG,
  anglesToDir, rightFromYaw, vaddScaled, raySphere, rayAABB, UNIT,
} from '../core/math.js';
import { MOVE } from './movement.js';

/** CS inaccuracy 原始值 -> 弧度 */
export const INACC_TO_RAD = 0.0002;
const RECOIL_PITCH = 8.0;
const RECOIL_YAW = 5.0;

/** 命中盒（局部空间：x=右, y=上（脚底为 0）, z=前），按站立高度 1.37m 定义 */
export const HITBOXES = [
  { group: 'head', sphere: [0, 1.235, 0], r: 0.135 },
  { group: 'chest', min: [-0.23, 0.90, -0.16], max: [0.23, 1.13, 0.16] },
  { group: 'stomach', min: [-0.20, 0.57, -0.15], max: [0.20, 0.90, 0.15] },
  { group: 'arm', min: [-0.37, 0.68, -0.14], max: [-0.20, 1.13, 0.14] },
  { group: 'arm', min: [0.20, 0.68, -0.14], max: [0.37, 1.13, 0.14] },
  { group: 'leg', min: [-0.22, 0.00, -0.16], max: [0.22, 0.57, 0.16] },
];
const BOUND_R = 0.75;   // 粗筛球半径（以腰部为中心）

export function weaponDef(id) {
  return WEAPONS[id] || GRENADES[id] || GEAR[id] || null;
}

// --------------------------- 装备 ------------------------------------------

export function emptyInventory(team) {
  return {
    primary: null,
    secondary: team === 't' ? 'glock18' : 'usp_s',
    melee: 'knife',
    grenades: {},        // id -> 数量
    c4: false,
    kit: false,
  };
}

export function initWeaponState(p) {
  p.ammo = {};
  p.wpn = {
    nextFire: 0, reloadEnd: 0, reloading: false, drawEnd: 0,
    recoilIdx: 0, lastFire: -99, punch: [0, 0], punchTarget: [0, 0],
    zoom: 0, burstLeft: 0, burstNext: 0, lastSound: 0,
    pendingSwitch: null, silencer: true,
  };
  p.active = 'secondary';
  refillAmmo(p);
}

/** 把当前所有武器弹药补满 */
export function refillAmmo(p) {
  for (const slot of ['primary', 'secondary', 'melee']) {
    const id = p.inv[slot];
    if (!id) continue;
    const w = WEAPONS[id];
    if (!w) continue;
    p.ammo[id] = { mag: w.magSize || 0, reserve: w.reserveAmmo || 0 };
  }
}

export function giveWeapon(p, id, opts = {}) {
  const w = WEAPONS[id];
  if (w) {
    const slot = w.slot === 'melee' ? 'melee' : (w.slot === 'primary' ? 'primary' : 'secondary');
    if (id === 'zeus') {
      p.inv.zeus = true;
      p.ammo.zeus = { mag: 1, reserve: 0 };
      return true;
    }
    p.inv[slot] = id;
    p.ammo[id] = { mag: w.magSize || 0, reserve: w.reserveAmmo || 0 };
    if (opts.autoSwitch !== false && slot !== 'melee') selectSlot(p, slot, 0);
    return true;
  }
  if (GRENADES[id]) {
    const max = GRENADES[id].maxCarry || 1;
    const cur = p.inv.grenades[id] || 0;
    const total = totalGrenades(p);
    if (cur >= max || total >= 4) return false;
    p.inv.grenades[id] = cur + 1;
    return true;
  }
  if (id === 'kevlar') { p.armor = 100; return true; }
  if (id === 'kevlarhelm') { p.armor = 100; p.helmet = true; return true; }
  if (id === 'defusekit') { p.inv.kit = true; return true; }
  return false;
}

export function totalGrenades(p) {
  let n = 0;
  for (const k in p.inv.grenades) n += p.inv.grenades[k];
  return n;
}

/** 当前手持的物品 id */
export function activeId(p) {
  const a = p.active;
  if (a === 'primary' || a === 'secondary' || a === 'melee') return p.inv[a];
  if (a === 'zeus') return 'zeus';
  if (a === 'c4') return 'c4';
  if (a && a.startsWith('grenade:')) return a.slice(8);
  return p.inv.melee;
}

export function activeDef(p) {
  const id = activeId(p);
  if (id === 'c4') return { name: 'C4', nameCN: 'C4 炸弹', slot: 'c4', class: 'c4', moveSpeed: 250, drawTime: 0.9 };
  return weaponDef(id);
}

export function ammoOf(p, id) {
  if (!p.ammo[id]) return null;
  return p.ammo[id];
}

/** 切换到某个槽位；返回是否成功 */
export function selectSlot(p, slot, now) {
  if (slot === p.active) return false;
  let id = null;
  if (slot === 'primary' || slot === 'secondary' || slot === 'melee') id = p.inv[slot];
  else if (slot === 'zeus') id = p.inv.zeus ? 'zeus' : null;
  else if (slot === 'c4') id = p.inv.c4 ? 'c4' : null;
  else if (slot.startsWith('grenade:')) {
    const g = slot.slice(8);
    id = (p.inv.grenades[g] || 0) > 0 ? g : null;
  }
  if (!id) return false;
  const def = weaponDef(id) || { drawTime: 0.5 };
  p.active = slot;
  p.wpn.reloading = false;
  p.wpn.zoom = 0;
  p.wpn.burstLeft = 0;
  p.wpn.recoilIdx = 0;
  p.wpn.punchTarget[0] = 0; p.wpn.punchTarget[1] = 0;
  p.wpn.drawEnd = now + (def.drawTime || 0.6);
  p.wpn.nextFire = Math.max(p.wpn.nextFire, p.wpn.drawEnd);
  return true;
}

/** 按 CS 的 1/2/3/4/5 逻辑循环切换 */
export function nextGrenadeSlot(p) {
  const order = ['he', 'flash', 'smoke', 'molotov', 'incgrenade', 'decoy'];
  const have = order.filter((g) => (p.inv.grenades[g] || 0) > 0);
  if (!have.length) return null;
  const cur = p.active.startsWith('grenade:') ? p.active.slice(8) : null;
  const i = cur ? have.indexOf(cur) : -1;
  return 'grenade:' + have[(i + 1) % have.length];
}

/** 移动速度（米/秒），受持枪与开镜影响 */
export function maxSpeedOf(p) {
  const def = activeDef(p);
  let s = (def && def.moveSpeed ? def.moveSpeed : 250) * UNIT;
  if (p.wpn.zoom > 0) {
    const zs = def && def.zoomMoveSpeed ? def.zoomMoveSpeed : (def && def.moveSpeed ? def.moveSpeed * 0.45 : 110);
    s = zs * UNIT;
  }
  return s;
}

// --------------------------- 精度与后坐力 -----------------------------------

/** 当前散布锥半角（弧度） */
export function currentSpread(p) {
  const w = WEAPONS[activeId(p)];
  if (!w) return 0;
  const speed = Math.hypot(p.vel[0], p.vel[2]);
  const maxS = Math.max(0.5, (w.moveSpeed || 250) * UNIT);
  const moveRatio = clamp(speed / maxS, 0, 1);
  let inacc;
  if (!p.onGround) {
    inacc = w.inaccJump;
  } else if (p.duckFrac > 0.5) {
    inacc = lerp(w.inaccCrouch, w.inaccMove, moveRatio * 0.8);
  } else {
    inacc = lerp(w.inaccStand, w.inaccMove, Math.pow(moveRatio, 1.3));
  }
  // 连射惩罚：随后坐力序号增加
  const idx = p.wpn.recoilIdx;
  inacc *= 1 + Math.min(idx, 12) * 0.055;
  if (p.wpn.zoom > 0) inacc *= 0.12;
  const spread = (w.spread || 0) + inacc;
  return spread * INACC_TO_RAD * (p.spreadMul || 1);
}

export function updateWeapons(p, dt, now) {
  const st = p.wpn;
  const w = WEAPONS[activeId(p)];
  // 换弹完成
  if (st.reloading && now >= st.reloadEnd) {
    st.reloading = false;
    const id = activeId(p);
    const a = p.ammo[id];
    const def = WEAPONS[id];
    if (a && def) {
      const need = def.magSize - a.mag;
      const take = Math.min(need, a.reserve);
      a.mag += take;
      a.reserve -= take;
    }
  }
  // 后坐力恢复
  const sinceFire = now - st.lastFire;
  const rec = w ? (w.recoveryTime || 0.35) : 0.35;
  if (sinceFire > rec * 0.85) {
    const k = Math.exp(-dt / Math.max(0.05, rec * 0.55));
    st.punchTarget[0] *= k;
    st.punchTarget[1] *= k;
    if (sinceFire > rec * 1.6) {
      // 重置喷射序号（逐步回落，模拟 CS 的 recoil index 衰减）
      st.recoilIdx = Math.max(0, st.recoilIdx - dt * 12);
    }
  }
  const lk = 1 - Math.exp(-dt * 26);
  st.punch[0] += (st.punchTarget[0] - st.punch[0]) * lk;
  st.punch[1] += (st.punchTarget[1] - st.punch[1]) * lk;

  // 连发队列
  if (st.burstLeft > 0 && now >= st.burstNext) {
    st.burstLeft--;
    st._burstFire = true;
  }
}

/** 视角 = 鼠标视角 + 后坐力偏移 */
export function applyPunch(p) {
  p.yaw = p.viewYaw + p.wpn.punch[0] * DEG;
  p.pitch = clamp(p.viewPitch + p.wpn.punch[1] * DEG, -89 * DEG, 89 * DEG);
}

// --------------------------- 命中检测 --------------------------------------

/** 把世界射线转到玩家局部空间并求交，返回 {t, group} 或 null */
export function traceHitboxes(ent, o, d, maxT) {
  const cy = Math.cos(ent.yaw), sy = Math.sin(ent.yaw);
  const fx = cy, fz = sy;
  const rx = -sy, rz = cy;
  const relx = o[0] - ent.pos[0], rely = o[1] - ent.pos[1], relz = o[2] - ent.pos[2];
  const lo = [relx * rx + relz * rz, rely, relx * fx + relz * fz];
  const ld = [d[0] * rx + d[2] * rz, d[1], d[0] * fx + d[2] * fz];
  const scale = (ent.height || MOVE.standHeight) / MOVE.standHeight;

  let best = null, bestT = maxT;
  for (const hb of HITBOXES) {
    if (hb.sphere) {
      const c = [hb.sphere[0], hb.sphere[1] * scale, hb.sphere[2]];
      const t = raySphere(lo, ld, c, hb.r, bestT);
      if (t !== null && t < bestT) { bestT = t; best = hb.group; }
    } else {
      const min = [hb.min[0], hb.min[1] * scale, hb.min[2]];
      const max = [hb.max[0], hb.max[1] * scale, hb.max[2]];
      const h = rayAABB(lo, ld, min, max, bestT);
      if (h && h.t < bestT) { bestT = h.t; best = hb.group; }
    }
  }
  if (!best) return null;
  return { t: bestT, group: best };
}

/**
 * 完整弹道追踪（含穿墙）。
 * @returns 事件数组 [{type:'player'|'world', ...}]
 */
export function traceBullet(game, shooter, origin, dir, w, maxDist) {
  const events = [];
  const world = game.world;
  let o = origin.slice();
  let remaining = maxDist;
  let dmgScale = 1;
  let penLeft = w.penetration >= 1.6 ? 3 : w.penetration >= 0.9 ? 2 : w.penetration > 0.4 ? 1 : 0;
  let guard = 0;

  while (guard++ < 8 && remaining > 0.05) {
    // 最近的玩家
    let pHit = null, pT = remaining, pEnt = null;
    for (const ent of game.players) {
      if (ent === shooter || !ent.alive) continue;
      const cx = ent.pos[0] - o[0], cy = ent.pos[1] + 0.7 - o[1], cz = ent.pos[2] - o[2];
      const proj = cx * dir[0] + cy * dir[1] + cz * dir[2];
      if (proj < -BOUND_R || proj > pT + BOUND_R) continue;
      const d2 = cx * cx + cy * cy + cz * cz - proj * proj;
      if (d2 > BOUND_R * BOUND_R) continue;
      const h = traceHitboxes(ent, o, dir, pT);
      if (h && h.t < pT) { pT = h.t; pHit = h; pEnt = ent; }
    }
    // 最近的墙
    const wHit = world.traceRay(o, dir, remaining);

    if (pHit && (!wHit || pT <= wHit.t)) {
      events.push({
        type: 'player', ent: pEnt, group: pHit.group, t: pT, dmgScale,
        point: [o[0] + dir[0] * pT, o[1] + dir[1] * pT, o[2] + dir[2] * pT],
        dist: maxDist - remaining + pT,
      });
      return events;   // 子弹停在人体上
    }
    if (!wHit) {
      events.push({ type: 'miss', point: [o[0] + dir[0] * remaining, o[1] + dir[1] * remaining, o[2] + dir[2] * remaining] });
      return events;
    }
    events.push({
      type: 'world', point: wHit.point, normal: wHit.normal, mat: wHit.mat,
      t: wHit.t, dmgScale, dist: maxDist - remaining + wHit.t,
    });
    if (penLeft <= 0) return events;

    // 找穿出点
    const maxThick = 0.08 + 0.22 * w.penetration;
    let travelled = 0;
    const step = 0.02;
    let exit = null;
    const probe = [0, 0, 0];
    while (travelled < maxThick) {
      travelled += step;
      probe[0] = wHit.point[0] + dir[0] * travelled;
      probe[1] = wHit.point[1] + dir[1] * travelled;
      probe[2] = wHit.point[2] + dir[2] * travelled;
      if (!world.isSolid(probe)) { exit = probe.slice(); break; }
    }
    if (!exit) return events;   // 太厚，穿不过
    penLeft--;
    dmgScale *= 0.52;
    remaining -= wHit.t + travelled;
    o = vaddScaled(exit, exit, dir, 0.01);
    events.push({ type: 'penetrate', point: exit.slice() });
  }
  return events;
}

// --------------------------- 开火 ------------------------------------------

function randomInCone(dir, cone, out) {
  if (cone <= 1e-6) { out[0] = dir[0]; out[1] = dir[1]; out[2] = dir[2]; return out; }
  const right = vnorm(v3(), vcross(v3(), dir, [0, 1, 0]));
  if (!isFinite(right[0]) || (right[0] === 0 && right[1] === 0 && right[2] === 0)) { right[0] = 1; }
  const up = vcross(v3(), right, dir);
  const th = rnd() * TAU;
  const r = cone * (rnd() * 0.5 + rnd() * 0.5);
  out[0] = dir[0] + (right[0] * Math.cos(th) + up[0] * Math.sin(th)) * r;
  out[1] = dir[1] + (right[1] * Math.cos(th) + up[1] * Math.sin(th)) * r;
  out[2] = dir[2] + (right[2] * Math.cos(th) + up[2] * Math.sin(th)) * r;
  return vnorm(out, out);
}

/** 玩家眼睛（发射点） */
export function shootOrigin(p, out) {
  out = out || v3();
  out[0] = p.pos[0];
  out[1] = p.pos[1] + (p.eyeHeight !== undefined ? p.eyeHeight : MOVE.eyeStand);
  out[2] = p.pos[2];
  return out;
}

/**
 * 尝试开火。返回 { fired, reason }
 * trigger: 'primary' | 'secondary'
 */
export function tryFire(game, p, now, trigger = 'primary') {
  const st = p.wpn;
  const id = activeId(p);
  const def = activeDef(p);
  if (!def) return { fired: false, reason: 'none' };
  if (now < st.drawEnd) return { fired: false, reason: 'draw' };
  if (st.reloading) return { fired: false, reason: 'reload' };
  if (now < st.nextFire) return { fired: false, reason: 'rate' };

  // 手雷 / C4 交给上层
  if (def.class === 'grenade') return { fired: false, reason: 'grenade' };
  if (def.class === 'c4') return { fired: false, reason: 'c4' };

  const w = WEAPONS[id];
  if (!w) return { fired: false, reason: 'none' };

  // 近战
  if (w.class === 'knife') {
    knifeAttack(game, p, now, trigger === 'secondary');
    return { fired: true, melee: true };
  }
  // 电枪
  if (w.class === 'taser') {
    const a = p.ammo.zeus;
    if (!a || a.mag <= 0) { game.audio.play('dryfire'); return { fired: false, reason: 'empty' }; }
    a.mag--;
    st.nextFire = now + 1.2;
    game.audio.play('zeus_fire', p.isLocal ? {} : { pos: p.pos.slice() });
    fireShots(game, p, w, now, 1, 8.5);
    if (a.mag <= 0) setTimeout(() => {}, 0);
    return { fired: true };
  }

  // 狙击枪右键开镜
  if (trigger === 'secondary' && w.zoom) {
    st.zoom = (st.zoom + 1) % (w.zoom.length + 1);
    game.audio.play(st.zoom > 0 ? 'zoom_in' : 'zoom_out', p.isLocal ? {} : { pos: p.pos.slice() });
    st.nextFire = now + 0.22;
    return { fired: false, reason: 'zoom' };
  }
  // 左轮/连发
  if (trigger === 'secondary' && w.burst) {
    st.burstMode = !st.burstMode;
    game.audio.play('weapon_switch', p.isLocal ? {} : { pos: p.pos.slice() });
    st.nextFire = now + 0.25;
    return { fired: false, reason: 'mode' };
  }
  if (trigger === 'secondary' && !w.zoom && !w.burst) return { fired: false, reason: 'noalt' };

  const a = p.ammo[id];
  if (!a || a.mag <= 0) {
    if (now - st.lastSound > 0.25) {
      game.audio.play('dryfire', p.isLocal ? {} : { pos: p.pos.slice() });
      st.lastSound = now;
    }
    st.nextFire = now + 0.2;
    return { fired: false, reason: 'empty' };
  }
  // 非全自动武器需要松开扳机
  if (!w.auto && p.input && p.input.attackHeldSince > st.lastFire && st.lastFire > 0 && p.input.attackHeld) {
    // 由上层用 attackPressed 控制，这里做一层保险
  }

  a.mag--;
  const interval = 60 / (w.rpm || 600);
  st.nextFire = now + interval;
  st.lastFire = now;

  // 后坐力
  const pat = w.pattern && w.pattern.length ? w.pattern[Math.min(w.pattern.length - 1, Math.floor(st.recoilIdx))] : [0, 0];
  const mag = w.recoilMag || 1;
  st.punchTarget[0] = pat[0] * mag * RECOIL_YAW;
  st.punchTarget[1] = pat[1] * mag * RECOIL_PITCH;
  st.recoilIdx = Math.min((w.pattern ? w.pattern.length : 30) - 1, st.recoilIdx + 1);

  // 声音
  const snd = w.sound || 'fire_ak47';
  game.audio.play(snd, p.isLocal ? { volume: 1 } : { pos: p.pos.slice(), volume: 1 });
  // 开镜后开枪自动退镜（栓动狙）
  if (w.zoom && st.zoom > 0 && (w.class === 'sniper') && !w.auto) {
    st.zoom = 0;
    st.nextFire = now + Math.max(interval, 0.35);
  }

  fireShots(game, p, w, now, w.pellets || 1, 0);

  // 弹壳
  const eye = shootOrigin(p, v3());
  const right = rightFromYaw(v3(), p.yaw);
  game.effects.shell(vaddScaled(eye, eye, right, 0.25), right);
  if (p.isLocal) game.effects.muzzle(muzzleWorld(p, v3()), anglesToDir(v3(), p.yaw, p.pitch), w.class === 'sniper' ? 1.4 : 1);
  else game.effects.muzzle(muzzleWorld(p, v3()), anglesToDir(v3(), p.yaw, p.pitch), 1);

  if (a.mag === 0 && p.isBot) requestReload(p, now);
  return { fired: true };
}

/** 枪口的大致世界位置 */
export function muzzleWorld(p, out) {
  const dir = anglesToDir(v3(), p.yaw, p.pitch);
  const right = rightFromYaw(v3(), p.yaw);
  const eye = shootOrigin(p, v3());
  out[0] = eye[0] + dir[0] * 0.55 + right[0] * 0.14 - 0;
  out[1] = eye[1] + dir[1] * 0.55 - 0.08;
  out[2] = eye[2] + dir[2] * 0.55 + right[2] * 0.14;
  return out;
}

function fireShots(game, p, w, now, pellets, overrideRange) {
  const eye = shootOrigin(p, v3());
  const base = anglesToDir(v3(), p.yaw, p.pitch);
  const cone = currentSpread(p);
  const maxDist = overrideRange || Math.min(w.range || 100, 180);
  const dir = v3();
  const start = muzzleWorld(p, v3());
  for (let i = 0; i < pellets; i++) {
    const pelletCone = pellets > 1 ? cone + 0.045 : cone;
    randomInCone(base, pelletCone, dir);
    const events = traceBullet(game, p, eye, dir, w, maxDist);
    resolveBullet(game, p, w, events, start, i === 0);
  }
}

function resolveBullet(game, shooter, w, events, tracerStart, doTracer) {
  let end = null;
  for (const e of events) {
    if (e.type === 'world') {
      game.effects.impact(e.point, e.normal, e.mat, w.class === 'sniper' ? 1.5 : 1);
      const info = game.surfaceSound(e.mat);
      game.audio.play(info, { pos: e.point.slice(), volume: 0.75 });
      if (!end) end = e.point;
    } else if (e.type === 'player') {
      const dmgBase = damageAtDistance(w, e.dist) * e.dmgScale;
      game.applyDamage(e.ent, shooter, dmgBase, e.group, w, e.point, null);
      const dir = vnorm(v3(), vsub(v3(), e.point, tracerStart));
      game.effects.blood(e.point, dir, e.group === 'head' ? 1.6 : 1);
      if (!end) end = e.point;
    } else if (e.type === 'miss') {
      if (!end) end = e.point;
    }
  }
  if (doTracer && end) {
    const dist = vdist(tracerStart, end);
    if (dist > 1.2 || !shooter.isLocal) game.effects.tracer(tracerStart, end, 0.02);
  }
}

// --------------------------- 近战 ------------------------------------------

export function knifeAttack(game, p, now, heavy) {
  const st = p.wpn;
  st.nextFire = now + (heavy ? 1.0 : 0.42);
  st.lastFire = now;
  const w = WEAPONS.knife;
  const eye = shootOrigin(p, v3());
  const dir = anglesToDir(v3(), p.yaw, p.pitch);
  const reach = heavy ? 1.2 : 1.0;
  let hit = null, hitT = reach, hitEnt = null;
  for (const ent of game.players) {
    if (ent === p || !ent.alive) continue;
    if (vdist(ent.pos, p.pos) > reach + 1.2) continue;
    const h = traceHitboxes(ent, eye, dir, hitT);
    if (h && h.t < hitT) { hitT = h.t; hit = h; hitEnt = ent; }
  }
  const wallHit = game.world.traceRay(eye, dir, reach);
  if (hit && (!wallHit || hitT < wallHit.t)) {
    const back = vdot(dir, anglesToDir(v3(), hitEnt.yaw, 0)) > 0.5;   // 背刺
    let dmg = heavy ? (back ? 195 : 65) : (back ? 90 : 25);
    const point = vaddScaled(v3(), eye, dir, hitT);
    game.applyDamage(hitEnt, p, dmg, hit.group === 'head' ? 'chest' : hit.group, w, point, null);
    game.effects.blood(point, dir, 1.2);
    game.audio.play(heavy ? 'knife_stab' : 'knife_hit', { pos: point.slice() });
  } else if (wallHit && wallHit.t < reach) {
    game.effects.impact(wallHit.point, wallHit.normal, wallHit.mat, 0.4);
    game.audio.play('knife_hitwall', { pos: wallHit.point.slice() });
  } else {
    game.audio.play('knife_slash', p.isLocal ? {} : { pos: p.pos.slice() });
  }
}

// --------------------------- 换弹 ------------------------------------------

export function requestReload(p, now) {
  const id = activeId(p);
  const w = WEAPONS[id];
  const st = p.wpn;
  if (!w || w.class === 'knife' || w.class === 'taser' || w.class === 'grenade') return false;
  if (st.reloading) return false;
  const a = p.ammo[id];
  if (!a || a.reserve <= 0 || a.mag >= w.magSize) return false;
  if (now < st.drawEnd) return false;
  st.reloading = true;
  st.reloadEnd = now + (w.reloadTime || 2.5);
  st.nextFire = st.reloadEnd;
  st.zoom = 0;
  st.recoilIdx = 0;
  return true;
}

export function isReloading(p) { return p.wpn.reloading; }

/** HUD 用的弹药文本 */
export function ammoText(p) {
  const id = activeId(p);
  const a = p.ammo[id];
  const def = activeDef(p);
  if (!def) return '';
  if (def.class === 'grenade') return String(p.inv.grenades[id] || 0);
  if (def.class === 'knife' || def.class === 'c4') return '';
  if (!a) return '';
  return `${a.mag} / ${a.reserve}`;
}
