/* ============================================================
   相机与操作：上帝视角（轨道/缩放/点选）· 第一人称（行走/碰撞/游泳/导览）
   ============================================================ */
'use strict';

/** 体素世界的碰撞与射线查询 */
class WorldQuery {
  constructor(vol, ground, idmap) { this.vol = vol; this.G = ground; this.ID = idmap; }
  groundTop(x, z) {
    const m = this.G.matAt(x, z);
    if (m === GM.water) return FC.WATER_Y - 4;
    if (m === 0) return 0;
    return this.G.heightAt(x, z);
  }
  isWater(x, z) { return this.G.matAt(x, z) === GM.water; }
  solid(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (this.vol.get(x, y, z)) return true;
    return y < this.groundTop(x + 0.5, z + 0.5);
  }
  /** DDA 体素射线：返回 {x,y,z,dist,id} 或 null */
  ray(ox, oy, oz, dx, dy, dz, maxDist = 900) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDx = Math.abs(1 / (dx || 1e-9)), tDy = Math.abs(1 / (dy || 1e-9)), tDz = Math.abs(1 / (dz || 1e-9));
    let tx = ((dx > 0 ? (x + 1 - ox) : (ox - x)) || 1e-9) * tDx;
    let ty = ((dy > 0 ? (y + 1 - oy) : (oy - y)) || 1e-9) * tDy;
    let tz = ((dz > 0 ? (z + 1 - oz) : (oz - z)) || 1e-9) * tDz;
    let t = 0;
    for (let i = 0; i < 4000 && t < maxDist; i++) {
      if (y < 80 && y > -12) {
        const c = this.vol.get(x, y, z);
        if (c) return { x, y, z, dist: t, id: this.ID.at(x + 0.5, z + 0.5), color: c };
        if (y < this.groundTop(x + 0.5, z + 0.5)) return { x, y, z, dist: t, id: this.ID.at(x + 0.5, z + 0.5), ground: true };
      }
      if (tx < ty && tx < tz) { x += stepX; t = tx; tx += tDx; }
      else if (ty < tz) { y += stepY; t = ty; ty += tDy; }
      else { z += stepZ; t = tz; tz += tDz; }
    }
    return null;
  }
}

/* ------------------------------------------------------------
   上帝视角：轨道相机
   ------------------------------------------------------------ */
class GodCamera {
  constructor() {
    this.target = V3.create(0, 6, 120);
    this.dist = 620;
    this.yaw = Math.PI;          // 面向北（-z）
    this.pitch = 0.62;
    this.fovy = 46 * Math.PI / 180;
    this.pos = V3.create();
    this.up = V3.create(0, 1, 0);
    this.velY = 0; this.velD = 0;
    this.tDist = this.dist; this.tYaw = this.yaw; this.tPitch = this.pitch;
    this.tTarget = V3.copy(V3.create(), this.target);
    this.update(0);
  }
  update(dt) {
    const k = 1 - Math.pow(0.0016, Math.max(dt, 1 / 240));
    this.dist += (this.tDist - this.dist) * k;
    this.yaw += (this.tYaw - this.yaw) * k;
    this.pitch += (this.tPitch - this.pitch) * k;
    V3.lerp(this.target, this.target, this.tTarget, k);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.pos[0] = this.target[0] + this.dist * cp * Math.sin(this.yaw);
    this.pos[1] = this.target[1] + this.dist * sp;
    this.pos[2] = this.target[2] + this.dist * cp * Math.cos(this.yaw);
    if (this.pos[1] < 3) this.pos[1] = 3;
  }
  /** 视线方向（单位向量） */
  dir(out) { return V3.norm(out, V3.sub(out, this.target, this.pos)); }
  flyTo(x, y, z, dist, yaw, pitch) {
    V3.set(this.tTarget, x, y, z);
    if (dist !== undefined) this.tDist = dist;
    if (yaw !== undefined) this.tYaw = yaw;
    if (pitch !== undefined) this.tPitch = pitch;
  }
  clamp() {
    this.tDist = Math.max(14, Math.min(2400, this.tDist));
    this.tPitch = Math.max(0.06, Math.min(1.52, this.tPitch));
    this.tTarget[0] = Math.max(FC.X0, Math.min(FC.X1, this.tTarget[0]));
    this.tTarget[2] = Math.max(FC.Z0, Math.min(FC.Z1, this.tTarget[2]));
  }
}

/* ------------------------------------------------------------
   第一人称：行走 / 碰撞 / 上台阶 / 游泳 / 飞行
   ------------------------------------------------------------ */
class Walker {
  constructor(q) {
    this.q = q;
    this.pos = V3.create(0, 1, 560);
    this.vel = V3.create(0, 0, 0);
    this.yaw = Math.PI; this.pitch = 0;
    this.fovy = 68 * Math.PI / 180;
    this.eye = 1.62; this.rad = 0.32; this.height = 1.75;
    this.onGround = false; this.fly = false; this.swim = false;
    this.eyeSmooth = 0;
    this.headBob = 0;
    this.speed = 4.4; this.runSpeed = 11.0;
  }
  place(x, z, y) {
    const q = this.q;
    let yy = y;
    if (yy === undefined) {
      yy = Math.max(0, q.groundTop(x, z));
      for (let t = yy; t < 78; t++) {
        if (!q.solid(x, t, z) && !q.solid(x, t + 1, z)) { yy = t; break; }
      }
    }
    V3.set(this.pos, x, yy, z);
    V3.set(this.vel, 0, 0, 0);
    this.eyeSmooth = 0;
  }
  /** AABB 是否与实体相交（脚点为 pos） */
  hit(x, y, z) {
    const q = this.q, r = this.rad;
    const y0 = Math.floor(y + 0.02), y1 = Math.floor(y + this.height - 0.02);
    for (let yy = y0; yy <= y1; yy++) {
      if (q.solid(x - r, yy, z - r) || q.solid(x + r, yy, z - r) ||
          q.solid(x - r, yy, z + r) || q.solid(x + r, yy, z + r)) return true;
    }
    return false;
  }
  move(dt, input) {
    const q = this.q;
    const p = this.pos;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let fx = 0, fz = 0;
    if (input.fwd) { fx -= sin; fz -= cos; }
    if (input.back) { fx += sin; fz += cos; }
    if (input.left) { fx -= cos; fz += sin; }
    if (input.right) { fx += cos; fz -= sin; }
    const l = Math.hypot(fx, fz);
    if (l > 0) { fx /= l; fz /= l; }
    const waterY = FC.WATER_Y;
    this.swim = q.isWater(p[0], p[2]) && p[1] + this.eye < waterY + 0.6;
    let spd = input.run ? this.runSpeed : this.speed;
    if (this.swim) spd *= 0.55;
    if (this.fly) spd = input.run ? 46 : 15;

    if (this.fly) {
      this.vel[0] = fx * spd; this.vel[2] = fz * spd;
      this.vel[1] = (input.up ? spd : 0) - (input.down ? spd : 0);
    } else {
      const accel = this.onGround ? 34 : 9;
      this.vel[0] += (fx * spd - this.vel[0]) * Math.min(1, accel * dt);
      this.vel[2] += (fz * spd - this.vel[2]) * Math.min(1, accel * dt);
      if (this.swim) {
        this.vel[1] += (waterY - 0.8 - p[1]) * 3.2 * dt * 6;
        this.vel[1] *= 0.86;
        if (input.up) this.vel[1] = 2.6;
      } else {
        this.vel[1] -= 24 * dt;
        if (this.vel[1] < -55) this.vel[1] = -55;
        if (input.up && this.onGround) { this.vel[1] = 7.1; this.onGround = false; }
      }
    }
    // 分轴推进 + 自动上台阶
    const stepAxis = (ai, d) => {
      if (!d) return;
      const nx = p[0] + (ai === 0 ? d : 0), nz = p[2] + (ai === 2 ? d : 0);
      if (!this.hit(nx, p[1], nz)) { p[ai] = ai === 0 ? nx : nz; return; }
      // 尝试抬升 1 格（台阶）
      if (!this.fly) {
        for (const up of [1, 2]) {
          if (!this.hit(nx, p[1] + up, nz) && !this.hit(p[0], p[1] + up, p[2])) {
            p[1] += up; p[ai] = ai === 0 ? nx : nz;
            this.eyeSmooth -= up;
            return;
          }
        }
      }
      this.vel[ai] = 0;
    };
    const maxStep = 0.45;
    let dx = this.vel[0] * dt, dz = this.vel[2] * dt, dy = this.vel[1] * dt;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz), Math.abs(dy)) / maxStep));
    for (let i = 0; i < n; i++) {
      stepAxis(0, dx / n);
      stepAxis(2, dz / n);
      const ny = p[1] + dy / n;
      if (!this.hit(p[0], ny, p[2])) { p[1] = ny; this.onGround = false; }
      else {
        if (dy < 0) {
          this.onGround = true;
          p[1] = Math.ceil(p[1]) - 0.0001;
          // 贴地
          while (!this.hit(p[0], p[1] - 0.02, p[2]) && p[1] > -12) p[1] -= 0.02;
        }
        this.vel[1] = 0; dy = 0;
      }
    }
    if (!this.fly && !this.swim) {
      this.onGround = this.hit(p[0], p[1] - 0.06, p[2]);
    }
    // 越界保护
    if (p[1] < -14) { this.place(0, 560); }
    p[0] = Math.max(FC.X0 + 4, Math.min(FC.X1 - 4, p[0]));
    p[2] = Math.max(FC.Z0 + 4, Math.min(FC.Z1 - 4, p[2]));
    // 视高平滑 + 走路微晃
    this.eyeSmooth += (0 - this.eyeSmooth) * Math.min(1, 12 * dt);
    const spd2 = Math.hypot(this.vel[0], this.vel[2]);
    this.headBob += dt * spd2 * 1.7;
    if (spd2 < 0.2) this.headBob *= 0.9;
  }
  camera(out) {
    const bob = this.onGround ? Math.sin(this.headBob) * 0.045 : 0;
    V3.set(out.pos, this.pos[0], this.pos[1] + this.eye + this.eyeSmooth + bob, this.pos[2]);
    const cp = Math.cos(this.pitch);
    V3.set(out.target,
      out.pos[0] - Math.sin(this.yaw) * cp,
      out.pos[1] + Math.sin(this.pitch),
      out.pos[2] - Math.cos(this.yaw) * cp);
    out.fovy = this.fovy;
    return out;
  }
}

/* ------------------------------------------------------------
   导览路线（第一人称自动漫游）
   ------------------------------------------------------------ */
const TOUR = [
  { x: 0, z: 900, yaw: Math.PI, cap: '中轴线之始 · 天安门前', text: '从天安门外的外金水桥出发，沿御道北行，这条中轴线将贯穿整座紫禁城。' },
  { x: 0, z: 700, yaw: Math.PI, cap: '天安门', text: '皇城正门天安门，重檐歇山城楼高踞十二米城台之上。' },
  { x: 0, z: 500, yaw: Math.PI, cap: '端门', text: '端门与天安门形制相同，明清时此处存放皇帝仪仗。' },
  { x: 0, z: 560, yaw: Math.PI, cap: '午门广场', text: '两翼雁翅楼向南伸出，围成凹形广场，五凤楼当前而立。' },
  { x: 0, z: 470, yaw: Math.PI, cap: '穿过午门', text: '正中的门洞唯皇帝可通行，宗室王公走西侧门，文武官员走东侧门。' },
  { x: 0, z: 408, yaw: Math.PI, cap: '内金水桥', text: '五座汉白玉石桥横跨内金水河，中为御路桥。' },
  { x: 0, z: 350, yaw: Math.PI, cap: '太和门', text: '面阔九间的重檐歇山大门，门前一对明代铜狮。' },
  { x: 0, z: 250, yaw: Math.PI, cap: '太和殿广场', text: '三万平方米的青砖广场，东有体仁阁、西有弘义阁，大典时文武百官在此列班。' },
  { x: 0, z: 200, yaw: Math.PI, cap: '仰望三台', text: '八米高的汉白玉三台之上，太和殿重檐庑殿顶如金色巨冠。' },
  { x: 0, z: 170, y: 10, yaw: Math.PI, cap: '登上丹陛', text: '月台之上陈铜龟、铜鹤、日晷、嘉量，象征江山永固、四海一统。' },
  { x: 0, z: 146, y: 11, yaw: Math.PI, cap: '太和殿前', text: '面阔十一间62米、通高35米，中国现存最大的木构殿宇。' },
  { x: 0, z: 128, y: 11, yaw: Math.PI, cap: '走进金銮殿', text: '殿内六根金柱盘绕蟠龙，正中是九龙金漆宝座与金砖地面。' },
  { x: 0, z: 52, y: 11, yaw: Math.PI, cap: '中和殿', text: '方形攒尖、镀金宝顶，皇帝大典前在此休息受贺。' },
  { x: 0, z: -22, y: 11, yaw: Math.PI, cap: '保和殿', text: '重檐歇山，清代殿试之地，“天子门生”自此而出。' },
  { x: 0, z: -80, yaw: Math.PI, cap: '乾清门横街', text: '一街之隔，外朝与内廷分野。东为景运门，西为隆宗门。' },
  { x: 0, z: -125, yaw: Math.PI, cap: '乾清宫', text: '内廷正殿，殿内高悬“正大光明”匾，清代皇帝在此批阅奏章、接见臣工。' },
  { x: 0, z: -186, yaw: Math.PI, cap: '交泰殿', text: '二十五方皇帝之宝藏于此殿。' },
  { x: 0, z: -216, yaw: Math.PI, cap: '坤宁宫', text: '皇后中宫，东端二间为皇帝大婚洞房。' },
  { x: 0, z: -290, yaw: Math.PI, cap: '御花园', text: '古柏藤萝、亭台错落，钦安殿居中，万春亭与千秋亭东西相望。' },
  { x: 42, z: -296, yaw: Math.PI * 1.2, cap: '万春亭', text: '重檐圆攒尖，下方上圆，为中国亭式建筑之精品。' },
  { x: 62, z: -348, y: 14, yaw: Math.PI * 0.8, cap: '堆秀山·御景亭', text: '登临御景亭，可俯瞰紫禁城金瓦如海。' },
  { x: 0, z: -430, yaw: Math.PI, cap: '神武门', text: '紫禁城北门，出此门便是景山。' },
  { x: 0, z: -640, yaw: 0, cap: '回望紫禁城', text: '自景山南望，九千余间殿宇沿中轴线铺展，是世界上现存规模最大的宫殿建筑群。' },
];

window.WorldQuery = WorldQuery; window.GodCamera = GodCamera; window.Walker = Walker; window.TOUR = TOUR;
