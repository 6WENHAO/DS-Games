/* ===================================================================
   entity.js — 单位 / 建筑 / 投射物 / 伤害结算

   依赖运行时全局 R.game（由 game.js 创建），用到它的：
     map, fx, hash, units, buildings, projectiles, pathQueue, players,
     powerEff(owner), findNearestRefinery(), queryEnemies(), reveal()

   ── 关键设计 ──────────────────────────────────────────────────────
   · 命令系统：每个单位只有一个 order 对象。攻击移动 (attackMove) 会把
     "原定终点"记在 order.resume 里，打完架自动回到行军路线上，
     这是 RTS 手感的关键，别去掉。
   · 寻路只算静态障碍（地形 + 建筑）。单位之间靠 separation 推挤，
     所以永远不会因为"友军站在路上"而反复重算路径。
   · 卡住检测：连续 stuckLimit 秒没能靠近当前路点，就抖动一下重寻路；
     再失败就放弃命令（否则会出现单位原地抽搐的经典 bug）。
   =================================================================== */
(function () {
  'use strict';
  const R = window.R;
  const U = R.U, T = R.TILE;

  R.ORDER = {
    IDLE: 'idle', MOVE: 'move', ATTACK: 'attack', ATTACKMOVE: 'attackMove',
    GUARD: 'guard', HARVEST: 'harvest', DEPLOY: 'deploy',
    CAPTURE: 'capture', REPAIRB: 'repairB', REARM: 'rearm', SCATTER: 'scatter',
  };
  const O = R.ORDER;

  /* ==================================================================
     Entity —— 单位与建筑的公共基类
     ================================================================== */
  class Entity {
    constructor(def, owner, x, y) {
      this.id = R.uid();
      this.def = def;
      this.owner = owner;
      this.x = x; this.y = y;
      this.maxHp = def.hp;
      this.hp = def.hp;
      this.armor = def.armor;
      this.kind = def.kind || 'building';
      this.sight = def.sight || 5;
      this.dead = false;
      this.selected = false;
      this.hitFlash = 0;          // 受击白闪计时
      this.lastHitBy = null;
      this.lastHitT = -99;
      this.rad = def.rad || 12;
      this.isBuilding = false;
    }

    get faction() { return this.owner ? this.owner.faction : 'guard'; }
    get color() { return this.owner ? this.owner.color : R.NEUTRAL_COLOR; }
    get hpFrac() { return U.clamp01(this.hp / this.maxHp); }

    isEnemy(o) {
      if (!o || !o.owner || !this.owner) return false;
      if (o.owner === this.owner) return false;
      return o.owner.team !== this.owner.team;
    }
    isAlly(o) {
      return !!o && !!o.owner && !!this.owner && o.owner.team === this.owner.team;
    }

    /** 中心到中心距离 */
    distTo(o) { return U.dist(this.x, this.y, o.x, o.y); }

    /**
     * 表面间距：建筑用矩形最近点，单位用圆。
     * 射程判定必须用这个，否则打 3×3 建筑时会因为中心太远而打不着。
     */
    edgeDist(o) {
      let ox = o.x, oy = o.y;
      if (o.isBuilding) {
        ox = U.clamp(this.x, o.rect.x, o.rect.x + o.rect.w);
        oy = U.clamp(this.y, o.rect.y, o.rect.y + o.rect.h);
      }
      let sx = this.x, sy = this.y;
      if (this.isBuilding) {
        sx = U.clamp(ox, this.rect.x, this.rect.x + this.rect.w);
        sy = U.clamp(oy, this.rect.y, this.rect.y + this.rect.h);
      }
      const d = U.dist(sx, sy, ox, oy);
      return Math.max(0, d - (o.isBuilding ? 0 : o.rad) - (this.isBuilding ? 0 : this.rad));
    }

    /** 朝向目标的角度（用表面最近点，打大建筑时炮口才不会歪） */
    angleTo(o) {
      let ox = o.x, oy = o.y;
      if (o.isBuilding) {
        ox = U.clamp(this.x, o.rect.x, o.rect.x + o.rect.w);
        oy = U.clamp(this.y, o.rect.y, o.rect.y + o.rect.h);
      }
      return Math.atan2(oy - this.y, ox - this.x);
    }

    /** 承受伤害。amount 是**已经算过护甲倍率**的最终值 */
    damage(amount, attacker, weapon) {
      if (this.dead || amount <= 0) return 0;
      const before = this.hp;
      this.hp -= amount;
      this.hitFlash = 0.12;
      if (attacker && this.isEnemy(attacker)) {
        this.lastHitBy = attacker;
        this.lastHitT = R.game ? R.game.time : 0;
      }
      if (this.hp <= 0) { this.hp = 0; this.die(attacker); }
      return before - this.hp;
    }

    heal(amount) {
      if (this.dead) return 0;
      const before = this.hp;
      this.hp = Math.min(this.maxHp, this.hp + amount);
      return this.hp - before;
    }

    die() { this.dead = true; }
  }
  R.Entity = Entity;

  /* ==================================================================
     Unit —— 步兵 / 载具 / 飞机
     ================================================================== */
  class Unit extends Entity {
    constructor(def, owner, x, y, angle) {
      super(def, owner, x, y);
      this.speed = def.speed;
      this.angle = angle === undefined ? -U.PI / 2 : angle;
      this.turretAngle = this.angle;
      this.vx = 0; this.vy = 0;
      this.turn = def.turn || 3;
      this.turretTurn = def.turretTurn || 0;
      this.weapon = def.weapon ? R.WEAPONS[def.weapon] : null;
      this.cool = 0;              // 武器冷却
      this.burstLeft = 0;
      this.burstTimer = 0;
      this.target = null;
      this.order = { type: O.IDLE };
      this.path = null;
      this.pathI = 0;
      this.pathPending = false;
      this.pathFails = 0;
      this.stuck = 0;
      this.lastProgress = Infinity;
      this.walkPhase = 0;         // 步兵走路动画
      this.moving = false;
      this.repathCd = 0;
      this.scanCd = R.rng(this.id * 7919)() * 0.4;   // 错开索敌帧，避免同帧尖峰
      this.dustCd = 0;
      this.veteran = 0;

      // 采矿车
      if (def.harvester) {
        this.cargo = 0;
        this.harvState = 'seek';
        this.harvTimer = 0;
        this.oreCell = null;
        this.refinery = null;
      }
      // 飞机
      if (this.kind === 'air') {
        this.alt = def.alt || 30;
        this.ammo = def.ammo || 10;
        this.rearmT = 0;
        this.homePad = null;
        this.hover = R.rng(this.id * 104729)() * U.TAU;
      }
      this.rally = null;          // 生产出厂后的集合点
    }

    get isVehicle() { return this.kind === 'vehicle'; }
    get isInfantry() { return this.kind === 'infantry'; }
    get isAir() { return this.kind === 'air'; }

    /* ---------------- 命令接口 ---------------- */
    stop() {
      this.path = null; this.pathI = 0;
      this.target = null;
      this.order = { type: O.IDLE };
      if (R.game) R.game.pathQueue.cancel(this);
      this.vx = 0; this.vy = 0;
    }

    orderMove(x, y, opts) {
      opts = opts || {};
      this.order = { type: opts.attackMove ? O.ATTACKMOVE : O.MOVE, x, y };
      this.target = null;
      this.pathFails = 0;
      this.requestPath(x, y);
    }

    orderAttack(target) {
      if (!target || target.dead) return;
      this.order = { type: O.ATTACK, target };
      this.target = target;
      this.pathFails = 0;
      // 先不寻路，靠近判定里再决定要不要走
    }

    orderGuard(x, y) {
      this.order = { type: O.GUARD, x: x === undefined ? this.x : x, y: y === undefined ? this.y : y };
      this.target = null;
    }

    orderHarvest(cell) {
      if (!this.def.harvester) return;
      this.order = { type: O.HARVEST };
      this.harvState = 'toOre';
      this.oreCell = cell || null;
      if (!cell) this.harvState = 'seek';
      else this.requestPath((cell.cx + 0.5) * T, (cell.cy + 0.5) * T);
    }

    orderDeploy() {
      if (!this.def.deploysTo) return;
      this.order = { type: O.DEPLOY };
    }

    orderCapture(building) {
      if (!this.def.engineer || !building) return;
      this.order = { type: O.CAPTURE, target: building };
      this.target = building;
      const p = building.enterPoint();
      this.requestPath(p.x, p.y, { tolerance: 1 });
    }

    /** 被爆炸推开 / 让路 */
    scatter() {
      const rnd = R.game ? R.game.rnd : R.rng(1);
      const a = rnd() * U.TAU;
      const d = T * (1.4 + rnd() * 1.4);
      const tx = this.x + Math.cos(a) * d, ty = this.y + Math.sin(a) * d;
      this.order = { type: O.SCATTER, x: tx, y: ty, t: 0 };
      this.path = [{ x: tx, y: ty }]; this.pathI = 0;
    }

    requestPath(x, y, opts) {
      if (this.isAir) { this.path = [{ x, y }]; this.pathI = 0; return; }
      if (!R.game) return;
      R.game.pathQueue.push(this, x, y, opts);
    }

    setPath(pts) {
      this.path = pts && pts.length ? pts : null;
      this.pathI = 0;
      this.stuck = 0;
      this.lastProgress = Infinity;
      if (!this.path) {
        // 已经在目的地
        if (this.order.type === O.MOVE || this.order.type === O.ATTACKMOVE) this.arriveEnd();
      }
    }
    onPathFail() {
      this.pathFails++;
      this.path = null;
      if (this.pathFails >= 3) {
        // 彻底走不到：放弃，转警戒。避免无限重试拖垮 CPU
        const t = this.order.type;
        this.order = { type: O.GUARD, x: this.x, y: this.y };
        if (t === O.HARVEST) { this.order = { type: O.HARVEST }; this.harvState = 'seek'; this.harvTimer = 1.2; }
      } else {
        this.repathCd = 0.5 + this.pathFails * 0.4;
      }
    }
    arriveEnd() {
      const t = this.order.type;
      if (t === O.MOVE || t === O.ATTACKMOVE || t === O.SCATTER) {
        this.order = { type: O.GUARD, x: this.x, y: this.y };
        this.path = null;
      }
    }

    /* ================= 每帧更新 ================= */
    update(dt) {
      if (this.dead) return;
      const G = R.game;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.repathCd > 0) this.repathCd -= dt;
      if (this.cool > 0) this.cool -= dt;
      if (this.burstTimer > 0) this.burstTimer -= dt;

      if (this.isAir) this.updateAir(dt);

      switch (this.order.type) {
        case O.IDLE: this.thinkIdle(dt); break;
        case O.GUARD: this.thinkGuard(dt); break;
        case O.MOVE: this.thinkMove(dt, false); break;
        case O.ATTACKMOVE: this.thinkMove(dt, true); break;
        case O.ATTACK: this.thinkAttack(dt); break;
        case O.HARVEST: this.thinkHarvest(dt); break;
        case O.DEPLOY: this.thinkDeploy(dt); break;
        case O.CAPTURE: this.thinkCapture(dt); break;
        case O.REARM: this.thinkRearm(dt); break;
        case O.SCATTER:
          this.order.t += dt;
          this.followPath(dt);
          if (this.order.t > 1.6 || !this.path) this.arriveEnd();
          break;
        default: this.thinkIdle(dt); break;
      }

      // 炮塔归位（没目标时慢慢转回车头方向）
      if (this.turretTurn && !this.target) {
        this.turretAngle = U.turnToward(this.turretAngle, this.angle, this.turretTurn * 0.35 * dt);
      }
      // 履带碾压
      if (this.def.crush && this.moving) this.doCrush();
      // 行进尘土
      if (this.isVehicle && this.moving) {
        this.dustCd -= dt;
        if (this.dustCd <= 0) {
          this.dustCd = 0.09;
          if (G && G.fx) G.fx.dust(this.x - Math.cos(this.angle) * this.rad * 0.7,
            this.y - Math.sin(this.angle) * this.rad * 0.7, 1, 12, 3);
        }
      }
      // 步兵走路相位
      if (this.moving) this.walkPhase += dt * (this.isInfantry ? 9 : 4);
    }

    /* ---------------- 空军专属 ---------------- */
    updateAir(dt) {
      this.hover += dt * 2.2;
      if (this.rearmT > 0) {
        this.rearmT -= dt;
        if (this.rearmT <= 0) { this.ammo = this.def.ammo; }
      }
      // 弹尽自动返航
      if (this.ammo <= 0 && this.order.type !== O.REARM) {
        const pad = R.game ? R.game.findRearmPad(this.owner, this.x, this.y) : null;
        if (pad) {
          this.homePad = pad;
          this.order = { type: O.REARM };
          this.path = [{ x: pad.x, y: pad.y }]; this.pathI = 0;
        }
      }
    }
    thinkRearm(dt) {
      const pad = this.homePad;
      if (!pad || pad.dead) {
        // 机坪没了，就地补弹（慢）
        this.rearmT = this.rearmT > 0 ? this.rearmT : this.def.rearm * 2;
        if (this.ammo > 0) this.order = { type: O.GUARD, x: this.x, y: this.y };
        return;
      }
      this.path = [{ x: pad.x, y: pad.y }]; this.pathI = 0;
      this.followPath(dt);
      if (U.dist(this.x, this.y, pad.x, pad.y) < 10) {
        this.vx = this.vy = 0; this.moving = false;
        if (this.rearmT <= 0 && this.ammo < this.def.ammo) this.rearmT = this.def.rearm;
        if (this.ammo >= this.def.ammo) this.order = { type: O.GUARD, x: this.x, y: this.y };
      }
    }

    /* ---------------- 待机 / 警戒 ---------------- */
    thinkIdle(dt) {
      this.moving = false;
      this.decel(dt);
      this.autoAcquire(dt, R.px(R.RULES.guardRange));
      if (this.target) this.engage(dt, false);
    }

    thinkGuard(dt) {
      this.autoAcquire(dt, this.weaponRange() * 1.05);
      if (this.target && !this.target.dead) {
        const home = this.order;
        const distHome = U.dist(this.x, this.y, home.x, home.y);
        const chase = R.px(R.RULES.guardRange);
        if (distHome > chase * 1.6) {
          // 追太远了，放弃目标回家
          this.target = null;
          this.requestPath(home.x, home.y);
          this.followPath(dt);
          return;
        }
        this.engage(dt, true);
        return;
      }
      // 回到警戒点
      const d = U.dist(this.x, this.y, this.order.x, this.order.y);
      if (d > T * 1.2 && this.path) { this.followPath(dt); return; }
      if (d > T * 2.2 && !this.path && !this.pathPending && this.repathCd <= 0) {
        this.repathCd = 0.8;
        this.requestPath(this.order.x, this.order.y);
      }
      this.moving = false;
      this.decel(dt);
    }

    /* ---------------- 移动 / 攻击移动 ---------------- */
    thinkMove(dt, aggressive) {
      if (aggressive) {
        this.autoAcquire(dt, this.weaponRange() * 1.0);
        if (this.target && !this.target.dead) {
          // 攻击移动：就地开火，不脱离队列太远
          const d = this.edgeDist(this.target);
          if (d <= this.weaponRange()) {
            this.moving = false; this.decel(dt);
            this.fireAt(this.target, dt);
            return;
          }
          // 目标略远：边走边打（继续沿原路线）
          this.aimTurret(this.target, dt);
        }
      } else if (this.weapon) {
        // 普通移动也会边走边还击（不改变路线）
        this.autoAcquire(dt, this.weaponRange() * 0.95);
        if (this.target && !this.target.dead && this.edgeDist(this.target) <= this.weaponRange()) {
          this.fireAt(this.target, dt, true);
        }
      }
      if (!this.path && !this.pathPending) {
        if (this.repathCd <= 0 && this.order.x !== undefined) {
          const d = U.dist(this.x, this.y, this.order.x, this.order.y);
          if (d > T * 0.9) { this.repathCd = 0.6; this.requestPath(this.order.x, this.order.y); }
          else this.arriveEnd();
        } else {
          this.moving = false; this.decel(dt);
        }
        return;
      }
      this.followPath(dt);
    }

    /* ---------------- 攻击指定目标 ---------------- */
    thinkAttack(dt) {
      const t = this.target;
      if (!t || t.dead) {
        this.target = null;
        this.order = { type: O.GUARD, x: this.x, y: this.y };
        return;
      }
      if (!this.weapon) {
        // 无武器单位被下攻击令 → 当成移动过去（工程师占领、矿车躲避）
        if (this.def.engineer && t.isBuilding && this.isEnemy(t)) { this.orderCapture(t); return; }
        this.orderMove(t.x, t.y);
        return;
      }
      if (!R.canTarget(this.weapon, t)) {
        this.target = null;
        this.order = { type: O.GUARD, x: this.x, y: this.y };
        return;
      }
      this.engage(dt, true);
    }

    /**
     * 交战：射程内停下开火，射程外靠近。
     * @param {boolean} pursue 是否允许主动追击（警戒/攻击命令为 true）
     */
    engage(dt, pursue) {
      const t = this.target;
      if (!t || t.dead) { this.target = null; return; }
      const range = this.weaponRange();
      const d = this.edgeDist(t);
      const wpn = this.weapon;

      // 火炮有最小射程，太近要后退
      if (wpn && wpn.minRange && d < R.px(wpn.minRange)) {
        const away = Math.atan2(this.y - t.y, this.x - t.x);
        const bx = this.x + Math.cos(away) * T * 2.5, by = this.y + Math.sin(away) * T * 2.5;
        if (!this.path && this.repathCd <= 0) { this.repathCd = 0.45; this.requestPath(bx, by); }
        if (this.path) { this.followPath(dt); return; }
      }

      if (d <= range * 0.94) {
        this.path = null;
        this.moving = false;
        this.decel(dt);
        this.fireAt(t, dt);
        return;
      }
      if (!pursue) { this.moving = false; this.decel(dt); return; }

      // 靠近：目标移动超过一定距离才重新寻路，省 CPU
      const tx = t.x, ty = t.y;
      const need = !this.path || !this.chaseAnchor ||
        U.dist(this.chaseAnchor.x, this.chaseAnchor.y, tx, ty) > T * 2.2;
      if (need && !this.pathPending && this.repathCd <= 0) {
        this.repathCd = 0.35;
        this.chaseAnchor = { x: tx, y: ty };
        // 容忍度：让单位停在射程边缘而不是撞上去
        const tol = Math.max(1, Math.floor(range / T) - 1);
        this.requestPath(tx, ty, { tolerance: t.isBuilding ? Math.max(1, tol) : tol });
      }
      if (this.path) this.followPath(dt);
      else { this.moving = false; this.decel(dt); }
      // 边走边瞄
      this.aimTurret(t, dt);
    }

    /* ---------------- 采矿 ---------------- */
    /**
     * 找一格没被同伴占住的矿。
     * 不做这个过滤的话所有矿车会挤在"离精炼厂最近的那一格"上，
     * 一辆采空、其余空转，经济直接瘫掉。
     */
    findOreCell(fromX, fromY, maxR) {
      const G = R.game;
      const map = G.map;
      const self = this;
      const taken = (x, y) => {
        const list = self.owner.units;
        for (let i = 0; i < list.length; i++) {
          const u = list[i];
          if (u === self || u.dead || !u.def.harvester || !u.oreCell) continue;
          if (u.oreCell.cx === x && u.oreCell.cy === y) return true;
        }
        return false;
      };
      const c = map.cellOf(fromX, fromY);
      // 先找没人占的，找不到再退回"随便一格"
      return map.nearestOre(c.cx, c.cy, maxR, taken) || map.nearestOre(c.cx, c.cy, maxR);
    }

    thinkHarvest(dt) {
      const G = R.game;
      const H = this.def.harvester;
      if (!G) return;
      const map = G.map;

      switch (this.harvState) {
        case 'seek': {
          this.harvTimer -= dt;
          this.moving = false; this.decel(dt);
          if (this.harvTimer > 0) return;
          this.harvTimer = 0.6;
          // 已经装满了就别再找矿 —— 否则会在"找矿↔运矿"之间空转
          if (this.cargo >= H.capacity * 0.98) {
            this.harvState = 'toRef';
            this.refinery = G.findNearestRefinery(this.owner, this.x, this.y);
            this.path = null;
            return;
          }
          // 优先在精炼厂附近找矿，减少往返距离
          const ref = G.findNearestRefinery(this.owner, this.x, this.y);
          const from = ref ? ref : this;
          let cell = this.findOreCell(from.x, from.y, 34);
          if (!cell) cell = this.findOreCell(this.x, this.y, 46);
          if (!cell) {
            // 全图没矿了：如果有货就去卸，否则待机
            if (this.cargo > 0) { this.harvState = 'toRef'; this.refinery = ref; }
            else this.harvTimer = 2.5;
            return;
          }
          this.oreCell = cell;
          this.harvState = 'toOre';
          this.requestPath((cell.cx + 0.5) * T, (cell.cy + 0.5) * T);
          break;
        }
        case 'toOre': {
          if (!this.oreCell) { this.harvState = 'seek'; this.harvTimer = 0; return; }
          const cx = this.oreCell.cx, cy = this.oreCell.cy;
          if (map.oreAt(cx, cy) <= 0.5) { this.harvState = 'seek'; this.harvTimer = 0; return; }
          const tx = (cx + 0.5) * T, ty = (cy + 0.5) * T;
          if (U.dist(this.x, this.y, tx, ty) < T * 0.75) {
            this.harvState = 'mining'; this.harvTimer = 0;
            this.path = null; this.moving = false;
            return;
          }
          if (!this.path && !this.pathPending && this.repathCd <= 0) {
            this.repathCd = 0.6; this.requestPath(tx, ty);
          }
          this.followPath(dt);
          break;
        }
        case 'mining': {
          this.moving = false; this.decel(dt);
          const cx = this.oreCell.cx, cy = this.oreCell.cy;
          const want = H.rate * dt;
          const got = map.mine(cx, cy, want);
          this.cargo += got;
          if (got > 0 && G.fx && G.rnd() < dt * 8) {
            G.fx.dust(this.x + (G.rnd() - 0.5) * 14, this.y + (G.rnd() - 0.5) * 14, 1, 10, 3);
          }
          if (this.cargo >= H.capacity) {
            this.cargo = H.capacity;
            this.harvState = 'toRef';
            this.refinery = G.findNearestRefinery(this.owner, this.x, this.y);
            this.path = null;
            return;
          }
          // 注意：判据必须是"这格基本采空"，不能用 got <= 0。
          // 矿脉每秒会再生一点点，got 永远大于 0，矿车会永远卡在同一格
          // 以再生速度慢慢装货（实测 3 分钟只装 100），经济彻底瘫掉。
          if (map.oreAt(cx, cy) > 0.5 && got >= want * 0.5) break;

          const nb = this.findOreCell(this.x, this.y, 8);
          if (nb && (nb.cx !== cx || nb.cy !== cy)) {
            this.oreCell = nb;
            this.harvState = 'toOre';
          } else if (this.cargo > H.capacity * 0.25) {
            // 附近没矿了但装了不少，先回去卸
            this.harvState = 'toRef';
            this.refinery = G.findNearestRefinery(this.owner, this.x, this.y);
            this.path = null;
          } else {
            this.harvState = 'seek';
            this.harvTimer = 0.4;
          }
          break;
        }
        case 'toRef': {
          let ref = this.refinery;
          if (!ref || ref.dead) ref = this.refinery = G.findNearestRefinery(this.owner, this.x, this.y);
          if (!ref) {
            // 没有精炼厂：满载也没处卸，原地等着（别在 seek/toRef 之间空转）
            this.moving = false; this.decel(dt);
            this.harvTimer -= dt;
            if (this.harvTimer <= 0) { this.harvTimer = 2.0; }
            if (this.cargo <= 0) { this.harvState = 'seek'; this.harvTimer = 0; }
            return;
          }
          // 判定用"与精炼厂外壳的距离"，不依赖某个固定坐标点
          if (this.edgeDist(ref) < T * 0.9) {
            this.harvState = 'unload'; this.harvTimer = H.unload;
            this.path = null; this.moving = false;
            ref.docked = this;
            if (R.Audio) R.Audio.play('oreDump', this.x, this.y);
            return;
          }
          if (!this.path && !this.pathPending && this.repathCd <= 0) {
            this.repathCd = 0.6;
            const dock = ref.dockTarget(this.x, this.y);
            this.requestPath(dock.x, dock.y, { tolerance: 0 });
          }
          this.followPath(dt);
          break;
        }
        case 'unload': {
          this.moving = false; this.decel(dt);
          const ref = this.refinery;
          if (!ref || ref.dead) { this.harvState = 'toRef'; return; }
          const rate = H.capacity / H.unload;
          const amt = Math.min(this.cargo, rate * dt);
          this.cargo -= amt;
          this.owner.addCredits(amt);
          if (this.cargo <= 0.5) {
            this.cargo = 0;
            if (ref.docked === this) ref.docked = null;
            this.harvState = 'seek'; this.harvTimer = 0;
            if (this.owner.isHuman && R.Audio) R.Audio.ui('credit');
          }
          break;
        }
        default: this.harvState = 'seek'; break;
      }
    }

    /* ---------------- 基地车展开 ---------------- */
    thinkDeploy(dt) {
      const G = R.game;
      this.moving = false; this.decel(dt);
      if (!G) return;
      const ok = G.tryDeployMcv(this);
      if (!ok) {
        G.notify(this.owner, '此处无法展开建造厂', 'deny');
        this.order = { type: O.GUARD, x: this.x, y: this.y };
      }
    }

    /* ---------------- 工程师占领 ---------------- */
    thinkCapture(dt) {
      const t = this.target;
      if (!t || t.dead) { this.order = { type: O.GUARD, x: this.x, y: this.y }; this.target = null; return; }
      const p = t.enterPoint();
      if (this.edgeDist(t) < T * 0.9 || U.dist(this.x, this.y, p.x, p.y) < T * 0.7) {
        R.game.engineerEnter(this, t);
        return;
      }
      if (!this.path && !this.pathPending && this.repathCd <= 0) {
        this.repathCd = 0.6; this.requestPath(p.x, p.y, { tolerance: 1 });
      }
      this.followPath(dt);
    }

    /* ================= 索敌与开火 ================= */
    weaponRange() { return this.weapon ? R.px(this.weapon.range) : 0; }

    /** 定期扫描周围，挑一个目标 */
    autoAcquire(dt, range) {
      if (!this.weapon) return;
      if (this.target && !this.target.dead) {
        // 目标还在射程内就不换
        if (this.edgeDist(this.target) <= this.weaponRange() * 1.35 &&
            R.canTarget(this.weapon, this.target)) return;
        this.target = null;
      }
      this.scanCd -= dt;
      if (this.scanCd > 0) return;
      this.scanCd = 0.28;
      this.target = this.findTarget(range || this.weaponRange());
    }

    findTarget(range) {
      const G = R.game;
      if (!G || !this.weapon) return null;
      const cands = G.queryHostiles(this.x, this.y, range + 40, this.owner);
      let best = null, bestScore = Infinity;
      for (let i = 0; i < cands.length; i++) {
        const c = cands[i];
        if (c.dead || !R.canTarget(this.weapon, c)) continue;
        const d = this.edgeDist(c);
        if (d > range) continue;
        let score = d;
        // 优先打能反击的、优先打空中（防空单位）
        if (this.weapon.airOnly && c.kind !== 'air') continue;
        if (c.kind === 'air' && this.weapon.air) score -= R.px(2.5);
        if (c.weapon || (c.def && c.def.weapon)) score -= R.px(1.2);
        if (c.def && c.def.harvester) score -= R.px(0.8);
        if (c.isBuilding && !c.def.weapon) score += R.px(3.5);  // 建筑最后打
        if (score < bestScore) { bestScore = score; best = c; }
      }
      return best;
    }

    /** 转炮塔（或车身）瞄准，返回是否已对准 */
    aimTurret(t, dt) {
      const want = this.angleTo(t);
      if (this.turretTurn) {
        this.turretAngle = U.turnToward(this.turretAngle, want, this.turretTurn * dt);
        return Math.abs(U.angleDiff(this.turretAngle, want)) < 0.10;
      }
      // 无炮塔：整体转向（步兵转很快）
      if (!this.moving) {
        this.angle = U.turnToward(this.angle, want, this.turn * dt);
      }
      this.turretAngle = this.angle;
      return Math.abs(U.angleDiff(this.angle, want)) < (this.isInfantry ? 0.5 : 0.18);
    }

    /**
     * 对目标开火。
     * @param {boolean} onMove 是否在行进中开火（需要武器允许）
     */
    fireAt(t, dt, onMove) {
      const wpn = this.weapon;
      if (!wpn || !t || t.dead) return;
      if (this.isAir && this.ammo <= 0) return;
      if (wpn.needStop && (onMove || this.moving)) return;
      if (!R.canTarget(wpn, t)) return;
      const d = this.edgeDist(t);
      if (d > this.weaponRange()) return;
      if (wpn.minRange && d < R.px(wpn.minRange)) return;

      const aligned = this.aimTurret(t, dt);
      // 连发中
      if (this.burstLeft > 0) {
        if (this.burstTimer <= 0) {
          this.shoot(t);
          this.burstLeft--;
          this.burstTimer = wpn.burstGap || 0.07;
          if (this.burstLeft <= 0) this.cool = wpn.cd;
        }
        return;
      }
      if (this.cool > 0 || !aligned) return;
      const burst = wpn.burst || 1;
      if (burst > 1) {
        this.burstLeft = burst;
        this.burstTimer = 0;
      } else {
        this.shoot(t);
        this.cool = wpn.cd;
      }
    }

    /** 真正发射一发 */
    shoot(t) {
      const G = R.game;
      const wpn = this.weapon;
      if (!G || !wpn) return;
      const a = this.turretTurn ? this.turretAngle : this.angleTo(t);
      const muzzle = this.rad + (this.turretTurn ? 8 : 4);
      const mx = this.x + Math.cos(a) * muzzle;
      const my = this.y + Math.sin(a) * muzzle;
      G.spawnProjectile(this, t, wpn, mx, my, a);
      if (this.isAir) this.ammo--;
      const scale = wpn.dmg > 50 ? 1.7 : (wpn.dmg > 25 ? 1.2 : 0.85);
      if (G.fx && wpn.proj !== 'beam') G.fx.muzzle(mx, my, a, scale);
      if (R.Audio && wpn.sfx) R.Audio.play(wpn.sfx, this.x, this.y);
      // 后坐力（视觉）
      this.recoil = Math.min(4, (wpn.dmg / 22));
    }

    /* ================= 移动 ================= */
    decel(dt) {
      const k = Math.exp(-9 * dt);
      this.vx *= k; this.vy *= k;
    }

    followPath(dt) {
      const path = this.path;
      if (!path || this.pathI >= path.length) { this.moving = false; this.decel(dt); return; }
      const wp = path[this.pathI];
      let dx = wp.x - this.x, dy = wp.y - this.y;
      let d = Math.sqrt(dx * dx + dy * dy);
      const arriveR = (this.pathI === path.length - 1) ? Math.max(5, this.rad * 0.5) : Math.max(7, this.rad * 0.8);
      if (d < arriveR) {
        this.pathI++;
        if (this.pathI >= path.length) {
          this.path = null; this.moving = false;
          this.arriveEnd();
          return;
        }
        return;
      }
      // 卡住检测
      if (d < this.lastProgress - 0.6) { this.lastProgress = d; this.stuck = 0; }
      else {
        this.stuck += dt;
        if (this.stuck > 1.15) this.handleStuck();
      }

      const want = Math.atan2(dy, dx);
      let speed = this.speed;

      if (this.isAir) {
        // 飞机直飞，转向平滑但不影响速度
        this.angle = U.turnToward(this.angle, want, this.turn * dt);
        const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
        const align = U.clamp01(Math.cos(U.angleDiff(this.angle, want)));
        this.vx = ca * speed * (0.35 + 0.65 * align);
        this.vy = sa * speed * (0.35 + 0.65 * align);
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.moving = true;
        return;
      }

      if (this.isInfantry) {
        // 步兵：几乎瞬时转向，直接朝路点走
        this.angle = U.turnToward(this.angle, want, this.turn * dt);
        this.turretAngle = this.angle;
      } else {
        // 载具：先转向，夹角大就减速（原地掉头感）
        this.angle = U.turnToward(this.angle, want, this.turn * dt);
        const diff = Math.abs(U.angleDiff(this.angle, want));
        if (diff > 1.2) speed *= 0.12;
        else if (diff > 0.6) speed *= 0.45;
        else speed *= 1 - diff * 0.25;
      }

      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      this.vx = ca * speed;
      this.vy = sa * speed;
      this.moving = true;

      this.tryStep(this.vx * dt, this.vy * dt);
    }

    /** 带地形碰撞的位移（滑墙） */
    tryStep(dx, dy) {
      const map = R.game ? R.game.map : null;
      if (!map) { this.x += dx; this.y += dy; return; }
      const r = this.rad * 0.62;
      const nx = this.x + dx, ny = this.y + dy;
      const okX = this.canStand(map, nx, this.y, r);
      const okY = this.canStand(map, this.x, ny, r);
      if (okX && okY && this.canStand(map, nx, ny, r)) { this.x = nx; this.y = ny; return; }
      if (okX) { this.x = nx; return; }
      if (okY) { this.y = ny; return; }
      // 完全被堵：算一次卡住
      this.stuck += 0.06;
    }

    canStand(map, x, y, r) {
      // 检查身体四个方位所在格
      if (!map.passable(Math.floor((x - r) / T), Math.floor((y - r) / T))) return false;
      if (!map.passable(Math.floor((x + r) / T), Math.floor((y - r) / T))) return false;
      if (!map.passable(Math.floor((x - r) / T), Math.floor((y + r) / T))) return false;
      if (!map.passable(Math.floor((x + r) / T), Math.floor((y + r) / T))) return false;
      return true;
    }

    handleStuck() {
      this.stuck = 0;
      this.lastProgress = Infinity;
      const G = R.game;
      if (!G) return;
      // 目标点抖动一下重寻路；连续失败就放弃
      const o = this.order;
      let tx, ty;
      if (o.type === O.MOVE || o.type === O.ATTACKMOVE) { tx = o.x; ty = o.y; }
      else if (this.path && this.path.length) {
        const last = this.path[this.path.length - 1]; tx = last.x; ty = last.y;
      } else return;
      this.pathFails++;
      if (this.pathFails > 4) { this.arriveEnd(); this.pathFails = 0; return; }
      const j = T * 0.9;
      this.requestPath(tx + (G.rnd() - 0.5) * j, ty + (G.rnd() - 0.5) * j);
    }

    /** 碾压敌方步兵 */
    doCrush() {
      const G = R.game;
      if (!G) return;
      const list = G.queryHostiles(this.x, this.y, this.rad + 8, this.owner);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.dead || e.isBuilding) continue;
        const crushable = e.isInfantry || (this.def.crushHeavy && e.isVehicle && e.armor === 'light');
        if (!crushable) continue;
        if (U.dist(this.x, this.y, e.x, e.y) > this.rad * 0.85 + e.rad * 0.4) continue;
        e.damage(R.RULES.crushDamage, this, null);
        if (G.fx) {
          if (e.isInfantry) G.fx.blood(e.x, e.y, this.angle);
          else G.fx.explosion(e.x, e.y, 'small');
        }
        if (R.Audio) R.Audio.play('hitFlesh', e.x, e.y);
      }
    }

    /* ================= 死亡 ================= */
    die(attacker) {
      if (this.dead) return;
      this.dead = true;
      const G = R.game;
      if (!G) return;
      const fx = G.fx;
      if (this.isInfantry) {
        if (fx) {
          fx.blood(this.x, this.y, (attacker ? this.angleTo(attacker) + U.PI : 0));
          fx.corpse(this.x, this.y, R.Col.scale(this.color, 0.55), this.angle);
        }
        if (R.Audio) R.Audio.play('hitFlesh', this.x, this.y);
      } else if (this.isAir) {
        if (fx) { fx.explosion(this.x, this.y, 'medium'); fx.explosion(this.x, this.y + 6, 'small'); }
        if (R.Audio) R.Audio.play('boomMedium', this.x, this.y);
      } else {
        // 爆炸分档：只有真正的重型目标才用最大档，否则听觉上分不出轻重
        const big = this.maxHp >= 900 || this.def.crushHeavy;
        if (fx) {
          fx.explosion(this.x, this.y, big ? 'large' : 'medium');
          fx.wreck(this.x, this.y, this.def.art, this.angle);
        }
        if (R.Audio) R.Audio.play(big ? 'boomLarge' : 'boomMedium', this.x, this.y);
        // 矿车爆炸会撒矿
        if (this.def.harvester && this.cargo > 30) {
          const c = G.map.cellOf(this.x, this.y);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (G.map.inBounds(c.cx + dx, c.cy + dy) && G.map.canBuildAt(c.cx + dx, c.cy + dy)) {
                const i = G.map.idx(c.cx + dx, c.cy + dy);
                G.map.ore[i] = Math.min(R.RULES.oreMax, G.map.ore[i] + this.cargo / 9);
              }
            }
          }
        }
      }
      G.onUnitDied(this, attacker);
    }
  }
  R.Unit = Unit;

  /* ==================================================================
     Building
     ================================================================== */
  class Building extends Entity {
    constructor(def, owner, cx, cy) {
      const c = R.buildingCenter(def, cx, cy);
      super(def, owner, c.x, c.y);
      this.isBuilding = true;
      this.cx = cx; this.cy = cy;
      this.w = def.size.w; this.h = def.size.h;
      this.rect = { x: cx * T, y: cy * T, w: this.w * T, h: this.h * T };
      this.kind = 'building';
      this.weapon = def.weapon ? R.WEAPONS[def.weapon] : null;
      this.turretAngle = U.PI / 2;
      this.turretTurn = 2.4;
      this.cool = 0;
      this.burstLeft = 0; this.burstTimer = 0;
      this.target = null;
      this.scanCd = R.rng(this.id * 7717)() * 0.3;
      this.riseT = 0;             // 落成动画 0→1
      this.docked = null;         // 精炼厂上的矿车
      this.charge = 0;            // 超级武器充能
      this.chargeReady = false;
      this.repairT = 0;
      this.online = true;         // 电力是否够（防御建筑断电会变慢）
      this.rad = Math.max(this.rect.w, this.rect.h) * 0.42;
      this.smokeCd = 0;
    }

    /** 出兵点（世界坐标） */
    exitPoint() {
      const e = this.def.exit || { x: this.w / 2, y: this.h + 0.5 };
      return { x: (this.cx + e.x) * T, y: (this.cy + e.y) * T };
    }
    /** 首选卸矿点（占地正下方中央） */
    dockPoint() {
      const d = this.def.dock || { x: this.w / 2, y: this.h + 0.4 };
      return { x: (this.cx + d.x) * T, y: (this.cy + d.y) * T };
    }
    /**
     * 采矿车实际该开往的卸矿位置。
     *
     * 为什么不能直接用 dockPoint()：卸矿口固定在建筑正下方，一旦那里
     * 被别的建筑占住（AI 很容易把精炼厂紧贴建造厂盖上去），矿车就永远
     * 到不了卸矿点 —— 满载在"找矿↔运矿"之间死循环，经济彻底归零。
     * 所以这里退化成"绕着占地找一格能站的地方"，并且卸矿判定用的是
     * 与建筑外壳的距离，而不是与某个固定点的距离。
     */
    dockTarget(fromX, fromY) {
      const G = R.game;
      const pref = this.dockPoint();
      if (!G) return pref;
      const map = G.map;
      const pc = map.cellOf(pref.x, pref.y);
      if (map.passable(pc.cx, pc.cy)) return pref;
      // 沿占地外圈找最近的可站格
      let best = null, bd = Infinity;
      for (let ring = 1; ring <= 3 && !best; ring++) {
        for (let y = this.cy - ring; y <= this.cy + this.h - 1 + ring; y++) {
          for (let x = this.cx - ring; x <= this.cx + this.w - 1 + ring; x++) {
            // 只看外圈
            const onRing = (x < this.cx - ring + 1 || x > this.cx + this.w - 2 + ring ||
                            y < this.cy - ring + 1 || y > this.cy + this.h - 2 + ring);
            if (!onRing) continue;
            if (!map.passable(x, y)) continue;
            const wx = (x + 0.5) * T, wy = (y + 0.5) * T;
            const d = U.dist2(fromX, fromY, wx, wy);
            if (d < bd) { bd = d; best = { x: wx, y: wy }; }
          }
        }
      }
      return best || pref;
    }
    /** 工程师进入点 */
    enterPoint() {
      return { x: this.x, y: this.rect.y + this.rect.h + T * 0.4 };
    }

    /** 占用的格子迭代 */
    forEachCell(fn) {
      for (let y = this.cy; y < this.cy + this.h; y++) {
        for (let x = this.cx; x < this.cx + this.w; x++) fn(x, y);
      }
    }

    update(dt) {
      if (this.dead) return;
      const G = R.game;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.riseT < 1) this.riseT = Math.min(1, this.riseT + dt * 2.2);
      if (this.cool > 0) this.cool -= dt;
      if (this.burstTimer > 0) this.burstTimer -= dt;

      const eff = G ? G.powerEff(this.owner) : 1;
      this.online = eff > 0.999 || !this.def.weapon;

      // 防御建筑索敌开火
      if (this.weapon) {
        this.scanCd -= dt;
        if ((!this.target || this.target.dead ||
             this.edgeDist(this.target) > R.px(this.weapon.range) * 1.1) && this.scanCd <= 0) {
          this.scanCd = 0.3;
          this.target = this.findTarget();
        }
        if (this.target && !this.target.dead) {
          const t = this.target;
          const want = this.angleTo(t);
          this.turretAngle = U.turnToward(this.turretAngle, want, this.turretTurn * dt);
          const aligned = Math.abs(U.angleDiff(this.turretAngle, want)) < 0.10;
          const d = this.edgeDist(t);
          if (d <= R.px(this.weapon.range) && R.canTarget(this.weapon, t)) {
            const wpn = this.weapon;
            if (this.burstLeft > 0) {
              if (this.burstTimer <= 0) {
                this.shoot(t); this.burstLeft--;
                this.burstTimer = wpn.burstGap || 0.07;
                if (this.burstLeft <= 0) this.cool = wpn.cd / Math.max(0.35, eff);
              }
            } else if (this.cool <= 0 && aligned) {
              const burst = wpn.burst || 1;
              if (burst > 1) { this.burstLeft = burst; this.burstTimer = 0; }
              else { this.shoot(t); this.cool = wpn.cd / Math.max(0.35, eff); }
            }
          }
        }
      }

      // 超级武器充能
      if (this.def.superWeapon) {
        const sw = this.def.superWeapon;
        if (!this.chargeReady) {
          this.charge += dt * eff;
          if (this.charge >= sw.charge) {
            this.charge = sw.charge; this.chargeReady = true;
            if (G) G.notify(this.owner, '离子炮充能完毕', 'ionReady');
          }
        }
      }

      // 维修厂：修停在平台上的载具
      if (this.def.repairPad) {
        this.repairT -= dt;
        if (this.repairT <= 0) {
          this.repairT = 0.25;
          if (G) G.doRepairPad(this);
        }
      }

      // 半血冒烟
      if (this.hpFrac < 0.55 && G && G.fx) {
        this.smokeCd -= dt;
        if (this.smokeCd <= 0) {
          this.smokeCd = 0.18 + this.hpFrac * 0.8;
          const rr = G.rnd;
          G.fx.smokePuff(this.rect.x + rr() * this.rect.w, this.rect.y + rr() * this.rect.h,
            4 + (1 - this.hpFrac) * 5, this.hpFrac < 0.3);
        }
      }
    }

    findTarget() {
      const G = R.game;
      if (!G || !this.weapon) return null;
      const range = R.px(this.weapon.range);
      const cands = G.queryHostiles(this.x, this.y, range + 48, this.owner);
      let best = null, bestScore = Infinity;
      for (let i = 0; i < cands.length; i++) {
        const c = cands[i];
        if (c.dead || !R.canTarget(this.weapon, c)) continue;
        const d = this.edgeDist(c);
        if (d > range) continue;
        let score = d;
        if (c.kind === 'air' && this.weapon.air) score -= R.px(3);
        if (c.isBuilding) score += R.px(4);
        if (score < bestScore) { bestScore = score; best = c; }
      }
      return best;
    }

    shoot(t) {
      const G = R.game;
      const wpn = this.weapon;
      if (!G || !wpn) return;
      const a = this.turretAngle;
      const m = this.rad * 0.75 + 6;
      const mx = this.x + Math.cos(a) * m, my = this.y + Math.sin(a) * m;
      G.spawnProjectile(this, t, wpn, mx, my, a);
      if (G.fx) G.fx.muzzle(mx, my, a, wpn.dmg > 40 ? 1.6 : 1.0);
      if (R.Audio && wpn.sfx) R.Audio.play(wpn.sfx, this.x, this.y);
    }

    die(attacker) {
      if (this.dead) return;
      this.dead = true;
      const G = R.game;
      if (!G) return;
      if (G.fx) {
        G.fx.explosion(this.x, this.y, 'building');
        // 沿占地范围多点开花
        const n = Math.min(6, this.w * this.h);
        for (let i = 0; i < n; i++) {
          const px = this.rect.x + G.rnd() * this.rect.w;
          const py = this.rect.y + G.rnd() * this.rect.h;
          G.fx.explosion(px, py, i % 2 ? 'medium' : 'small');
        }
        G.fx.rubble(this.x, this.y, this.rect.w, this.rect.h);
      }
      if (R.Audio) R.Audio.play('boomBuilding', this.x, this.y);
      // 发电厂被炸有额外爆炸
      if (this.def.explodePower && G.fx) {
        G.fx.explosion(this.x, this.y, 'large');
        R.Combat.splash(this.x, this.y, 52, 45, R.WEAPONS.tankCannon, this, 1);
      }
      if (this.docked) { this.docked.harvState = 'seek'; this.docked = null; }
      G.onBuildingDied(this, attacker);
    }
  }
  R.Building = Building;

  /* ==================================================================
     Projectile
     ================================================================== */
  class Projectile {
    constructor(shooter, target, wpn, x, y, angle) {
      this.id = R.uid();
      this.shooter = shooter;
      this.owner = shooter.owner;
      this.target = target;
      this.wpn = wpn;
      this.kindName = wpn.proj;
      this.pd = R.PROJ[wpn.proj] || R.PROJ.shell;
      this.x = x; this.y = y;
      this.sx = x; this.sy = y;
      this.angle = angle;
      this.speed = this.pd.speed;
      this.t = 0;
      this.life = this.pd.life || 3;
      this.dead = false;
      this.trailCd = 0;
      // 目标点快照（抛射与直射用）
      this.tx = target ? target.x : x + Math.cos(angle) * 100;
      this.ty = target ? target.y : y + Math.sin(angle) * 100;
      if (this.pd.arc) {
        // 榴弹：锁死落点，飞行时间按距离算
        const d = U.dist(x, y, this.tx, this.ty);
        this.flightT = Math.max(0.35, d / this.speed);
        this.arcH = Math.min(120, d * 0.34);
      }
      if (wpn.proj === 'rocket') {
        this.speed = this.pd.speed;
        // 发射散布，之后再追踪，视觉上像真火箭
        this.angle += (R.game ? (R.game.rnd() - 0.5) : 0) * 0.22;
      }
    }

    update(dt) {
      if (this.dead) return;
      this.t += dt;
      if (this.t >= this.life) { this.expire(); return; }
      const G = R.game;
      const wpn = this.wpn;

      /* --- 光束：生成即命中 --- */
      if (this.kindName === 'beam') {
        if (!this.applied) {
          this.applied = true;
          const t = this.target;
          const ex = t && !t.dead ? t.x : this.tx;
          const ey = t && !t.dead ? t.y : this.ty;
          if (G && G.fx) G.fx.beam(this.sx, this.sy, ex, ey,
            wpn.dmg > 400 ? '#bfe6ff' : '#ffe9c0', wpn.dmg > 400 ? 14 : 2.2, wpn.dmg > 400 ? 0.5 : 0.14);
          if (t && !t.dead) R.Combat.hit(t, this.shooter, wpn, ex, ey, this.angle);
          if (wpn.splash) R.Combat.splash(ex, ey, wpn.splash, wpn.dmg, wpn, this.shooter, 1);
        }
        if (this.t > 0.1) this.dead = true;
        return;
      }

      /* --- 抛物线榴弹 --- */
      if (this.pd.arc) {
        const k = U.clamp01(this.t / this.flightT);
        this.x = U.lerp(this.sx, this.tx, k);
        this.y = U.lerp(this.sy, this.ty, k);
        this.z = Math.sin(k * U.PI) * this.arcH;
        this.angle = Math.atan2(this.ty - this.sy, this.tx - this.sx);
        if (k >= 1) { this.boom(this.tx, this.ty); return; }
        return;
      }

      /* --- 火箭追踪 --- */
      if (this.kindName === 'rocket') {
        if (this.pd.accel) this.speed = Math.min(this.pd.maxSpeed || 700, this.speed + this.pd.accel * dt);
        const t = this.target;
        if (t && !t.dead) {
          const want = Math.atan2(t.y - this.y, t.x - this.x);
          this.angle = U.turnToward(this.angle, want, (this.pd.homing || 3) * dt);
        }
      }

      /* --- 喷火：沿途持续伤害 --- */
      const step = this.speed * dt;
      const px = this.x, py = this.y;
      this.x += Math.cos(this.angle) * step;
      this.y += Math.sin(this.angle) * step;

      if (this.kindName === 'flame') {
        if (G && G.fx) G.fx.flame(this.x, this.y, this.angle, 0.3);
        const hit = this.sweepHit(px, py, 10);
        if (hit) { this.boom(this.x, this.y); return; }
        return;
      }

      // 出界或撞地形（撞岩石/水面算命中地面）
      if (G) {
        const map = G.map;
        if (this.x < 0 || this.y < 0 || this.x > map.pxW || this.y > map.pxH) { this.dead = true; return; }
      }
      if (this.kindName !== 'bullet' && G) {
        const c = G.map.cellOf(this.x, this.y);
        if (G.map.terrainAt(c.cx, c.cy) === R.TERRAIN.ROCK) { this.boom(this.x, this.y); return; }
      }

      // 命中判定：线段扫过的敌人
      const hit = this.sweepHit(px, py, this.kindName === 'bullet' ? 5 : 7);
      if (hit) { this.boom(this.x, this.y, hit); return; }

      // 到达目标点附近也引爆（目标已死时）
      const t2 = this.target;
      if (t2 && !t2.dead) { this.tx = t2.x; this.ty = t2.y; }
      if (U.dist(this.x, this.y, this.tx, this.ty) < 6) {
        if (!t2 || t2.dead) { this.boom(this.x, this.y); return; }
      }

      // 拖尾
      if (this.pd.trail === 'smoke') {
        this.trailCd -= dt;
        if (this.trailCd <= 0 && G && G.fx) {
          this.trailCd = 0.02;
          G.fx.emit(R.FXTYPE.P_SMOKE, this.x, this.y, 0, 0, 0.42, 2.4, '#cfc8be',
            { drag: 1.4, grow: 7, fade: 0.5 });
        }
      } else if (this.pd.trail === 'tracer' && G && G.fx) {
        G.fx.tracer(px, py, this.x, this.y, '#ffe9a0', 1.5);
      }
    }

    /** 线段扫掠命中检测 */
    sweepHit(px, py, pad) {
      const G = R.game;
      if (!G) return null;
      const mx = (px + this.x) * 0.5, my = (py + this.y) * 0.5;
      const r = U.dist(px, py, this.x, this.y) * 0.5 + pad + 16;
      const cands = G.queryHostiles(mx, my, r, this.owner);
      for (let i = 0; i < cands.length; i++) {
        const e = cands[i];
        if (e.dead) continue;
        if (!R.canTarget(this.wpn, e)) continue;
        // 空中单位只能被对空武器打到；地面弹不该撞飞机
        if (e.isBuilding) {
          if (U.segCircle(px, py, this.x, this.y, e.x, e.y, e.rad + pad)) {
            // 更精确：检查是否落在矩形内
            const cx = U.clamp(this.x, e.rect.x, e.rect.x + e.rect.w);
            const cy = U.clamp(this.y, e.rect.y, e.rect.y + e.rect.h);
            if (U.dist(this.x, this.y, cx, cy) < pad + 4) return e;
          }
        } else if (U.segCircle(px, py, this.x, this.y, e.x, e.y, e.rad + pad * 0.5)) {
          return e;
        }
      }
      return null;
    }

    boom(x, y, direct) {
      if (this.dead) return;
      this.dead = true;
      const G = R.game;
      const wpn = this.wpn;
      if (direct) R.Combat.hit(direct, this.shooter, wpn, x, y, this.angle);
      if (wpn.splash) {
        R.Combat.splash(x, y, wpn.splash, wpn.dmg, wpn, this.shooter, direct ? 0.55 : 1, direct);
      } else if (!direct) {
        // 无溅射且没直接命中 → 只留个视觉
      }
      if (G && G.fx) {
        const b = this.pd.boom;
        if (b === 'fire') G.fx.explosion(x, y, 'fire');
        else if (b) G.fx.explosion(x, y, b);
        else G.fx.impact(x, y, this.angle);
      }
      if (R.Audio) {
        const b = this.pd.boom;
        if (b === 'large') R.Audio.play('boomLarge', x, y);
        else if (b === 'medium') R.Audio.play('boomMedium', x, y);
        else if (b === 'small') R.Audio.play('boomSmall', x, y);
        else if (direct) R.Audio.play(direct.isInfantry ? 'hitFlesh' : 'hitSmall', x, y);
      }
    }

    expire() {
      // 火箭/炮弹寿命到了就在原地炸
      if (this.kindName === 'rocket' || this.kindName === 'shell') this.boom(this.x, this.y);
      else this.dead = true;
    }
  }
  R.Projectile = Projectile;

  /* ==================================================================
     Combat —— 伤害结算
     ================================================================== */
  R.Combat = {
    /** 直接命中 */
    hit(target, attacker, wpn, x, y, angle) {
      if (!target || target.dead) return 0;
      const mul = R.armorMul(wpn, target.armor);
      if (mul <= 0) return 0;
      let dmg = wpn.dmg * mul;
      // 老兵加成
      if (attacker && attacker.veteran) dmg *= 1 + attacker.veteran * 0.12;
      const done = target.damage(dmg, attacker, wpn);
      const G = R.game;
      if (G && G.fx) {
        if (target.isInfantry) G.fx.blood(x, y, angle || 0);
        else G.fx.impact(x, y, angle || 0, target.isBuilding ? '#d8c8a8' : '#ffe08a');
      }
      // 被打的单位会还击 / 逃跑
      R.Combat.retaliate(target, attacker);
      return done;
    },

    /** 溅射伤害。allyMul 控制友伤比例 */
    splash(x, y, radius, baseDmg, wpn, attacker, scale, exclude) {
      const G = R.game;
      if (!G) return;
      scale = scale === undefined ? 1 : scale;
      const list = G.queryAll(x, y, radius + 24);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.dead || e === exclude) continue;
        if (e === attacker) continue;
        const mul = R.armorMul(wpn, e.armor);
        if (mul <= 0) continue;
        // 空中单位不吃地面溅射
        if (e.kind === 'air' && !wpn.air) continue;
        let d;
        if (e.isBuilding) {
          const cx = U.clamp(x, e.rect.x, e.rect.x + e.rect.w);
          const cy = U.clamp(y, e.rect.y, e.rect.y + e.rect.h);
          d = U.dist(x, y, cx, cy);
        } else {
          d = Math.max(0, U.dist(x, y, e.x, e.y) - e.rad * 0.6);
        }
        if (d > radius) continue;
        const falloff = 1 - (d / radius) * 0.82;
        let dmg = baseDmg * mul * falloff * scale;
        // 友伤减免（避免 AI 自灭，也让玩家不至于一发火炮团灭自己）
        if (attacker && attacker.owner && e.owner && e.owner.team === attacker.owner.team) dmg *= 0.3;
        if (dmg <= 0.5) continue;
        e.damage(dmg, attacker, wpn);
        if (G.fx && e.isInfantry) G.fx.blood(e.x, e.y, Math.atan2(e.y - y, e.x - x));
        if (attacker && e.isEnemy(attacker)) R.Combat.retaliate(e, attacker);
      }
      // 溅射把附近步兵掀开
      if (radius > 34) {
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (e.dead || !e.isInfantry) continue;
          if (U.dist(x, y, e.x, e.y) < radius * 1.4 && e.order && e.order.type === R.ORDER.IDLE) e.scatter();
        }
      }
    },

    /** 被攻击时的自动反应 */
    retaliate(target, attacker) {
      if (!target || !attacker || target.dead || attacker.dead) return;
      if (target.isBuilding) return;
      if (!target.order) return;
      const t = target.order.type;
      // 只在待机/警戒时自动反击，不打断玩家下的明确命令
      if (t !== R.ORDER.IDLE && t !== R.ORDER.GUARD) return;
      if (target.weapon && R.canTarget(target.weapon, attacker)) {
        if (!target.target || target.target.dead) target.target = attacker;
      } else if (target.def.harvester || target.def.engineer || !target.weapon) {
        // 无法反击的单位跑开
        if (target.def.harvester) {
          // 矿车继续干活，但先躲一下
          if (target.harvState === 'mining' && R.game && R.game.rnd() < 0.5) {
            target.harvState = 'seek'; target.harvTimer = 0;
          }
        } else if (t === R.ORDER.IDLE || t === R.ORDER.GUARD) {
          target.scatter();
        }
      }
    },
  };

})();
