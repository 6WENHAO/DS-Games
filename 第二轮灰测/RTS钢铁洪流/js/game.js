/* ===================================================================
   game.js — 世界主控：玩家 / 经济 / 电力 / 生产队列 / 迷雾 / 胜负

   模块职责边界（改代码前先看这里，别把逻辑写串）：
     game.js    规则与状态机，不碰 DOM、不碰 canvas
     input.js   把鼠标键盘翻译成命令，只调用 game 的公开方法
     render.js  只读 game 状态画图，绝不修改状态
     ui.js      DOM 侧边栏 / 弹窗
     ai.js      电脑玩家，通过与人类完全相同的公开方法操作
   =================================================================== */
(function () {
  'use strict';
  const R = window.R;
  const U = R.U, T = R.TILE;

  /* 迷雾状态 */
  const FOG_NONE = 0, FOG_SEEN = 1, FOG_VIS = 2;
  R.FOG = { NONE: FOG_NONE, SEEN: FOG_SEEN, VIS: FOG_VIS };

  /* 生产队列分组：建筑与防御共用一条（和红警一样） */
  const QUEUE_OF = { base: 'structure', def: 'structure', inf: 'inf', veh: 'veh', air: 'air' };
  R.QUEUE_OF = QUEUE_OF;

  /* ==================================================================
     Player
     ================================================================== */
  class Player {
    constructor(index, faction, opts) {
      opts = opts || {};
      this.index = index;
      this.faction = faction;
      const F = R.FACTIONS[faction];
      this.factionDef = F;
      this.name = opts.name || F.name;
      this.color = opts.color || F.color;
      this.color2 = F.color2;
      this.dark = F.dark;
      this.team = opts.team === undefined ? index : opts.team;
      this.isAI = !!opts.isAI;
      this.isHuman = !this.isAI;
      this.credits = R.RULES.startCredits;
      this.buildings = [];
      this.units = [];
      this.defeated = false;
      /** 生产队列：structure / inf / veh / air */
      this.queues = { structure: [], inf: [], veh: [], air: [] };
      /** 已造好、等待玩家落地的建筑 id */
      this.pendingBuild = null;
      /** 统计 */
      this.stats = {
        harvested: 0, spent: 0, unitsBuilt: 0, unitsLost: 0,
        kills: 0, buildingsBuilt: 0, buildingsLost: 0,
      };
      this.powerMade = 0;
      this.powerUsed = 0;
      /** 迷雾 */
      this.fog = null;
      /** 已探明的敌方建筑记忆（AI 与小地图用） */
      this.knownEnemy = new Map();
      this.ai = null;
      this.lastAttackedT = -99;
      this.lastAttackPos = null;
    }

    get powerEff() {
      if (this.powerUsed <= 0) return 1;
      if (this.powerMade >= this.powerUsed) return 1;
      return Math.max(R.RULES.minPowerEff, this.powerMade / this.powerUsed);
    }
    get lowPower() { return this.powerUsed > this.powerMade; }

    addCredits(n) {
      this.credits += n;
      this.stats.harvested += n;
    }
    spend(n) {
      this.credits -= n;
      this.stats.spent += n;
      if (this.credits < 0) this.credits = 0;
    }

    /** 是否拥有某种建筑（活着的） */
    has(id) {
      for (let i = 0; i < this.buildings.length; i++) {
        const b = this.buildings[i];
        if (!b.dead && b.def.id === id) return true;
      }
      return false;
    }
    countBuilding(id) {
      let n = 0;
      for (const b of this.buildings) if (!b.dead && b.def.id === id) n++;
      return n;
    }
    countUnit(id) {
      let n = 0;
      for (const u of this.units) if (!u.dead && u.def.id === id) n++;
      return n;
    }
    /** 雷达是否可用（有雷达站且不缺电） */
    get hasRadar() {
      if (!this.has('radar') && !this.has('tech')) return false;
      return !this.lowPower;
    }

    /** 科技条件是否满足 */
    canBuild(def) {
      if (!def) return false;
      if (def.faction && def.faction !== this.faction) return false;
      // 建筑需要建造厂
      if (R.isBuilding(def.id)) {
        if (def.id !== 'conyard' && !this.has('conyard')) return false;
      } else {
        if (!def.from || !this.has(def.from)) return false;
      }
      const req = def.req || [];
      for (let i = 0; i < req.length; i++) if (!this.has(req[i])) return false;
      if (def.limit && this.countBuilding(def.id) >= def.limit) return false;
      return true;
    }

    /** 未满足的前置，用于 UI 提示 */
    missingReq(def) {
      const out = [];
      if (R.isBuilding(def.id)) {
        if (def.id !== 'conyard' && !this.has('conyard')) out.push('建造厂');
      } else if (def.from && !this.has(def.from)) {
        out.push(R.BUILDINGS[def.from] ? R.BUILDINGS[def.from].name : def.from);
      }
      for (const r of (def.req || [])) {
        if (!this.has(r)) out.push(R.BUILDINGS[r] ? R.BUILDINGS[r].name : r);
      }
      if (def.limit && this.countBuilding(def.id) >= def.limit) out.push('已达上限');
      return out;
    }

    queueOf(def) { return this.queues[QUEUE_OF[def.tab] || 'structure']; }
  }
  R.Player = Player;

  /* ==================================================================
     Game
     ================================================================== */
  class Game {
    constructor(opts) {
      opts = opts || {};
      R.game = this;
      R.resetUid();

      this.opts = opts;
      this.seed = opts.seed || (Math.floor(Math.random() * 1e9) | 0);
      this.rnd = R.rng(this.seed);
      this.mapSize = opts.mapSize || 'medium';
      this.map = R.generateMap(this.mapSize, this.seed);
      this.fx = new R.FX(this.seed ^ 0x5bd1e995);
      this.pathQueue = new R.PathQueue(this.map);

      this.time = 0;
      this.frame = 0;
      this.speed = opts.speed || 1;      // 游戏速度倍率
      this.paused = false;
      this.over = false;
      this.result = null;                // 'win' | 'lose'

      this.units = [];
      this.buildings = [];
      this.projectiles = [];
      this.selection = [];
      this.groups = {};                  // 编队 1..9

      this.hash = new R.SpatialHash(56);
      this._q = [];

      /* --- 玩家 --- */
      const pf = opts.playerFaction || 'guard';
      const ef = opts.enemyFaction || (pf === 'guard' ? 'steel' : 'guard');
      this.players = [
        new Player(0, pf, { name: '你', team: 0 }),
        new Player(1, ef, { name: '敌军', team: 1, isAI: true }),
      ];
      this.me = this.players[0];
      this.difficulty = opts.difficulty || 'normal';

      /* --- 迷雾 --- */
      const n = this.map.w * this.map.h;
      for (const p of this.players) p.fog = new Uint8Array(n);
      this.fogTimer = 0;
      this.fogEnabled = R.RULES.fogEnabled && opts.fog !== false;
      if (!this.fogEnabled) {
        for (const p of this.players) p.fog.fill(FOG_VIS);
      }

      /* --- 通知 --- */
      this.toasts = [];
      this.alerts = [];                  // 小地图警报点

      /* --- 初始基地 --- */
      this.setupStart();

      /* --- AI --- */
      if (R.AI) {
        for (const p of this.players) if (p.isAI) p.ai = new R.AI(this, p, this.difficulty);
      }

      this.stats = { peakUnits: 0 };
      this.notifyCb = null;              // ui.js 注册
    }

    /* ---------------- 初始布置 ---------------- */
    setupStart() {
      const starts = this.map.starts;
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        const s = starts[i % starts.length];
        p.startCell = s;
        // 建造厂中心对齐出生格
        const cyDef = R.BUILDINGS.conyard;
        const cx = s.cx - ((cyDef.size.w / 2) | 0);
        const cy = s.cy - ((cyDef.size.h / 2) | 0);
        const b = this.placeBuilding(p, 'conyard', cx, cy, true);
        if (b) b.riseT = 1;
        // 起步部队
        const c = this.map.centerOf(s.cx, s.cy);
        this.spawnUnit(p, 'harvester', c.x - T * 2.5, c.y + T * 3.2);
        this.spawnUnit(p, 'harvester', c.x + T * 2.5, c.y + T * 3.2);
        for (let k = 0; k < 3; k++) {
          this.spawnUnit(p, 'rifleman', c.x + (k - 1) * T * 1.2, c.y + T * 4.4);
        }
        // 让矿车立刻开工
        for (const u of p.units) if (u.def.harvester) u.orderHarvest(null);
      }
      // 摄像机初始对准玩家基地
      const s0 = starts[0];
      this.startFocus = this.map.centerOf(s0.cx, s0.cy);
    }

    /* ================= 查询 ================= */
    queryAll(x, y, r) {
      const out = this.hash.query(x, y, r, this._q);
      return out;
    }
    /** 敌对目标（含建筑），已按半径粗筛 */
    queryHostiles(x, y, r, owner) {
      const cands = this.hash.query(x, y, r, this._q);
      const out = [];
      for (let i = 0; i < cands.length; i++) {
        const e = cands[i];
        if (e.dead || !e.owner) continue;
        if (e.owner.team === owner.team) continue;
        out.push(e);
      }
      return out;
    }

    findNearestRefinery(owner, x, y) {
      let best = null, bd = Infinity;
      for (const b of owner.buildings) {
        if (b.dead || b.def.id !== 'refinery') continue;
        // 已经有车在卸的稍微降权，避免全挤一个
        const d = U.dist2(x, y, b.x, b.y) * (b.docked ? 2.1 : 1);
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    }
    findRearmPad(owner, x, y) {
      let best = null, bd = Infinity;
      for (const b of owner.buildings) {
        if (b.dead || b.def.id !== 'helipad') continue;
        const d = U.dist2(x, y, b.x, b.y);
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    }
    /** 找 owner 的建造厂（放置建筑时的中心参考） */
    findConyard(owner) {
      for (const b of owner.buildings) if (!b.dead && b.def.isBase) return b;
      return null;
    }

    powerEff(owner) { return owner ? owner.powerEff : 1; }

    /* ================= 生成 / 销毁 ================= */
    spawnUnit(player, defId, x, y, angle) {
      const def = R.UNITS[defId];
      if (!def) return null;
      if (player.units.length >= R.RULES.unitCap) return null;
      const spot = this.map.findFreeSpot(Math.floor(x / T), Math.floor(y / T), 10);
      const u = new R.Unit(def, player, spot.x, spot.y, angle);
      this.units.push(u);
      player.units.push(u);
      player.stats.unitsBuilt++;
      if (this.fx) this.fx.dust(u.x, u.y, 3, 26, 4);
      return u;
    }

    canPlace(player, def, cx, cy, ignoreRadius) {
      if (!def || !def.size) return false;
      const w = def.size.w, h = def.size.h;
      if (cx < 0 || cy < 0 || cx + w > this.map.w || cy + h > this.map.h) return false;
      if (!this.map.footprintOk(cx, cy, w, h)) return false;
      // 不能盖在别人单位头上（步兵会被挤开，载具不行）
      const c = R.buildingCenter(def, cx, cy);
      const list = this.queryAll(c.x, c.y, Math.max(w, h) * T * 0.75 + 14);
      for (const e of list) {
        if (e.dead || e.isBuilding) continue;
        if (e.isAir) continue;
        if (e.x > cx * T - e.rad && e.x < (cx + w) * T + e.rad &&
            e.y > cy * T - e.rad && e.y < (cy + h) * T + e.rad) {
          if (!e.isInfantry) return false;
        }
      }
      if (ignoreRadius) return true;
      return this.buildRadiusOk(player, cx, cy, w, h);
    }

    /** 是否在己方建筑的建造半径内 */
    buildRadiusOk(player, cx, cy, w, h) {
      const R2 = R.RULES.buildRadius;
      for (const b of player.buildings) {
        if (b.dead) continue;
        if (b.def.isWall) continue;      // 墙不能延伸建造范围，否则可以铺墙偷家
        // 矩形间的格距
        const dx = Math.max(b.cx - (cx + w), cx - (b.cx + b.w), 0);
        const dy = Math.max(b.cy - (cy + h), cy - (b.cy + b.h), 0);
        if (Math.max(dx, dy) <= R2) return true;
      }
      return false;
    }

    placeBuilding(player, defId, cx, cy, free) {
      const def = R.BUILDINGS[defId];
      if (!def) return null;
      const b = new R.Building(def, player, cx, cy);
      this.buildings.push(b);
      player.buildings.push(b);
      player.stats.buildingsBuilt++;
      this.map.setOccupied(cx, cy, def.size.w, def.size.h, b.id);
      // 清掉占地下的矿
      b.forEachCell((x, y) => {
        const i = this.map.idx(x, y);
        this.map.ore[i] = 0; this.map.oreSeed[i] = 0;
      });
      this.map._seedList = null;
      // 把站在里面的步兵挤开
      const list = this.queryAll(b.x, b.y, Math.max(b.w, b.h) * T * 0.8 + 16);
      for (const e of list) {
        if (e.dead || e.isBuilding || e.isAir) continue;
        if (e.x > b.rect.x - e.rad && e.x < b.rect.x + b.rect.w + e.rad &&
            e.y > b.rect.y - e.rad && e.y < b.rect.y + b.rect.h + e.rad) e.scatter();
      }
      if (this.fx) {
        this.fx.dust(b.x, b.y, 10, 40, 7);
        this.fx.addShake(1.6);
      }
      if (!free && R.Audio) R.Audio.play('place', b.x, b.y);
      // 精炼厂赠送矿车
      if (def.freeUnit) {
        const e = b.exitPoint();
        const u = this.spawnUnit(player, def.freeUnit, e.x, e.y + T);
        if (u && u.def.harvester) u.orderHarvest(null);
      }
      this.recomputePower(player);
      return b;
    }

    /** 卖掉建筑 / 解散单位 */
    sell(e) {
      if (!e || e.dead) return false;
      const refund = Math.round(e.def.cost * R.RULES.sellRefund);
      e.owner.credits += refund;
      if (R.Audio) R.Audio.play('sell', e.x, e.y);
      if (e.isBuilding) {
        if (this.fx) { this.fx.dust(e.x, e.y, 12, 42, 8); this.fx.rubble(e.x, e.y, e.rect.w, e.rect.h); }
        // 建筑卖出会吐出几个步兵（红警手感）
        const n = Math.min(4, Math.round(e.def.cost / 600));
        for (let i = 0; i < n; i++) {
          const p = e.exitPoint();
          this.spawnUnit(e.owner, 'rifleman', p.x + (this.rnd() - 0.5) * T * 2, p.y + (this.rnd() - 0.5) * T);
        }
        this.removeBuilding(e, true);
      } else {
        e.dead = true;
        if (this.fx) this.fx.dust(e.x, e.y, 6, 30, 5);
      }
      if (this.fx) this.fx.text(e.x, e.y, '+' + refund, '#8fe08a', 13);
      return true;
    }

    removeBuilding(b, silent) {
      if (!b.removed) {
        b.removed = true;
        b.dead = true;
        this.map.setOccupied(b.cx, b.cy, b.w, b.h, 0);
        const arr = b.owner.buildings;
        const i = arr.indexOf(b);
        if (i >= 0) arr.splice(i, 1);
        const j = this.buildings.indexOf(b);
        if (j >= 0) this.buildings.splice(j, 1);
        this.recomputePower(b.owner);
        const k = this.selection.indexOf(b);
        if (k >= 0) this.selection.splice(k, 1);
      }
    }

    onUnitDied(u, attacker) {
      u.owner.stats.unitsLost++;
      if (attacker && attacker.owner) {
        attacker.owner.stats.kills++;
        // 击杀升级：三杀晋升老兵
        attacker.killCount = (attacker.killCount || 0) + 1;
        if (attacker.killCount === 3 && attacker.veteran !== undefined && attacker.veteran < 2) {
          attacker.veteran++;
          attacker.killCount = 0;
          if (this.fx && attacker.owner === this.me) this.fx.text(attacker.x, attacker.y - 10, '晋升', '#ffe08a', 11);
        }
      }
      if (u.owner === this.me && !u.def.harvester) this.notify(u.owner, null, 'unitLost');
      if (u.def.harvester && u.owner === this.me) this.notify(u.owner, '采矿车损失！', 'unitLost');
      const i = this.selection.indexOf(u);
      if (i >= 0) this.selection.splice(i, 1);
    }

    onBuildingDied(b, attacker) {
      b.owner.stats.buildingsLost++;
      if (attacker && attacker.owner) attacker.owner.stats.kills++;
      this.removeBuilding(b);
      if (b.owner === this.me) {
        this.notify(b.owner, b.def.name + '被摧毁', 'unitLost');
        this.alertAt(b.x, b.y);
      }
      // 建造厂没了 → 生产队列作废
      if (b.def.isBase && !b.owner.has('conyard')) {
        b.owner.queues.structure.length = 0;
        b.owner.pendingBuild = null;
      }
    }

    /* ================= 电力 ================= */
    recomputePower(player) {
      let made = 0, used = 0;
      for (const b of player.buildings) {
        if (b.dead) continue;
        const p = b.def.power || 0;
        if (p > 0) made += p; else used += -p;
      }
      const was = player.lowPower;
      player.powerMade = made;
      player.powerUsed = used;
      if (!was && player.lowPower && player === this.me) {
        this.notify(player, '电力不足！', 'needPower');
        if (R.Audio) R.Audio.ui('powerDown');
      }
    }

    /* ================= 生产队列 ================= */
    /** 加入队列。返回 false 表示被拒（前置不足 / 队列满） */
    queueAdd(player, defId, count) {
      const def = R.def(defId);
      if (!def) return false;
      if (!player.canBuild(def)) {
        if (player === this.me) {
          const miss = player.missingReq(def);
          this.notify(player, '需要：' + (miss.join(' / ') || '前置建筑'), 'deny');
        }
        return false;
      }
      const q = player.queueOf(def);
      if (q.length >= 12) return false;
      count = count || 1;
      for (let i = 0; i < count; i++) {
        q.push({ id: defId, def, progress: 0, paid: 0, ready: false, held: false });
      }
      if (player === this.me && R.Audio) R.Audio.ui('click');
      return true;
    }

    /** 从队列取消（从末尾同 id 的开始退） */
    queueCancel(player, defId, all) {
      const def = R.def(defId);
      if (!def) return false;
      const q = player.queueOf(def);
      let removed = 0;
      for (let i = q.length - 1; i >= 0; i--) {
        if (q[i].id !== defId) continue;
        const it = q[i];
        // 退还已付的钱
        player.credits += it.paid;
        q.splice(i, 1);
        removed++;
        if (!all) break;
      }
      if (removed && player.pendingBuild === defId) {
        // 取消的是已完成待放置的
        let stillReady = false;
        for (const it of q) if (it.id === defId && it.ready) stillReady = true;
        if (!stillReady) player.pendingBuild = null;
      }
      if (removed && player === this.me && R.Audio) R.Audio.ui('deny');
      return removed > 0;
    }

    /** 每帧推进所有队列 */
    updateQueues(player, dt) {
      const eff = player.powerEff;
      for (const key in player.queues) {
        const q = player.queues[key];
        if (!q.length) continue;
        const it = q[0];
        if (it.ready) continue;                  // 建筑等着放置，堵住队列
        // 产线还活着吗
        if (!player.canBuild(it.def)) { it.held = true; continue; }
        it.held = false;
        const buildTime = Math.max(0.2, it.def.build);
        // 本帧进度。必须夹住不超过剩余进度，否则最后一帧会多收一次钱
        // （玩家实际支出 > 标价，看起来像"偷钱"）。
        const rate = Math.min(dt * eff / buildTime, 1 - it.progress);
        if (rate <= 0) { this.finishQueueItem(player, q, it); continue; }
        const need = it.def.cost * rate;
        if (player.credits < need) {
          it.starved = true;
          if (player === this.me && !this._creditWarn) {
            this._creditWarn = 2.5;
            this.notify(player, '资金不足', 'needCredits');
          }
          continue;
        }
        it.starved = false;
        player.spend(need);
        it.paid += need;
        it.progress += rate;
        // 建造中的敲击声：按节奏发，交给音频层限流。
        // 注意别在这里调 findProducer() —— 它会改写 lastOut 影响产线轮转。
        if (player === this.me) {
          this._buildSfx = (this._buildSfx || 0) - dt;
          if (this._buildSfx <= 0) {
            this._buildSfx = 0.45;
            const src = this.findConyard(player);
            if (src && R.Audio) R.Audio.play('build', src.x, src.y);
          }
        }
        if (it.progress >= 1) {
          it.progress = 1;
          this.finishQueueItem(player, q, it);
        }
      }
      if (this._creditWarn > 0) this._creditWarn -= dt;
    }

    finishQueueItem(player, q, it) {
      if (R.isBuilding(it.id)) {
        // 建筑：进入"待放置"，由玩家/AI 点地图落地
        it.ready = true;
        player.pendingBuild = it.id;
        if (player === this.me) this.notify(player, it.def.name + '建造完毕，选择位置', 'buildingReady');
        return;
      }
      // 单位：直接出厂
      const from = this.findProducer(player, it.def);
      let x, y;
      if (from) { const e = from.exitPoint(); x = e.x; y = e.y; }
      else { const cy = this.findConyard(player); x = cy ? cy.x : this.map.pxW / 2; y = cy ? cy.y : this.map.pxH / 2; }
      const u = this.spawnUnit(player, it.id, x, y, U.PI / 2);
      q.shift();
      if (!u) return;
      if (u.def.harvester) {
        u.orderHarvest(null);
      } else {
        // 走出厂门口一点，别堵住
        const off = T * (1.6 + this.rnd() * 1.4);
        const a = U.PI / 2 + (this.rnd() - 0.5) * 1.2;
        const rp = (from && from.rally) || null;
        if (rp) u.orderMove(rp.x, rp.y);
        else u.orderMove(x + Math.cos(a) * off, y + Math.sin(a) * off);
      }
      if (player === this.me) this.notify(player, null, 'unitReady');
    }

    /** 找一个能产这个单位的建筑（优先没在忙的） */
    findProducer(player, def) {
      let best = null;
      for (const b of player.buildings) {
        if (b.dead || b.def.id !== def.from) continue;
        if (!best) best = b;
        else if ((b.lastOut || 0) < (best.lastOut || 0)) best = b;
      }
      if (best) best.lastOut = this.time;
      return best;
    }

    /** 玩家点地图放置待建建筑 */
    tryPlacePending(player, cx, cy) {
      const id = player.pendingBuild;
      if (!id) return false;
      const def = R.BUILDINGS[id];
      if (!this.canPlace(player, def, cx, cy)) {
        if (player === this.me) { this.notify(player, '无法在此建造', 'deny'); if (R.Audio) R.Audio.ui('deny'); }
        return false;
      }
      const q = player.queues.structure;
      let idx = -1;
      for (let i = 0; i < q.length; i++) if (q[i].id === id && q[i].ready) { idx = i; break; }
      if (idx < 0) { player.pendingBuild = null; return false; }
      q.splice(idx, 1);
      this.placeBuilding(player, id, cx, cy);
      // 还有别的建好待放的吗
      player.pendingBuild = null;
      for (const it of q) if (it.ready) { player.pendingBuild = it.id; break; }
      return true;
    }

    /* ================= 特殊操作 ================= */
    /** 基地车展开 */
    tryDeployMcv(unit) {
      const def = R.BUILDINGS[unit.def.deploysTo];
      if (!def) return false;
      // 以单位为中心求左上角格
      const cx = Math.round(unit.x / T - def.size.w / 2);
      const cy = Math.round(unit.y / T - def.size.h / 2);
      if (!this.canPlace(unit.owner, def, cx, cy, true)) return false;
      // 展开处不能贴着敌方基地
      unit.dead = true;
      const i = this.selection.indexOf(unit);
      if (i >= 0) this.selection.splice(i, 1);
      const b = this.placeBuilding(unit.owner, def.id, cx, cy);
      if (b) b.riseT = 0;
      if (unit.owner === this.me) this.notify(unit.owner, '建造厂已展开', 'buildingReady');
      return true;
    }

    /** 工程师进入建筑 */
    engineerEnter(eng, b) {
      if (eng.dead || b.dead) return;
      eng.dead = true;
      const i = this.selection.indexOf(eng);
      if (i >= 0) this.selection.splice(i, 1);
      if (eng.isEnemy(b)) {
        // 占领：转换所有权
        this.captureBuilding(b, eng.owner);
        if (eng.owner === this.me) this.notify(eng.owner, '已占领 ' + b.def.name, 'buildingReady');
        else if (b.owner === this.me) this.notify(this.me, b.def.name + '被敌方占领！', 'baseAttack');
      } else {
        // 修复己方建筑
        const healed = b.heal(R.RULES.engineerHeal);
        if (this.fx) this.fx.text(b.x, b.y, '+' + Math.round(healed), '#8fe08a', 12);
      }
      if (R.Audio) R.Audio.play('buildDone', b.x, b.y);
    }

    captureBuilding(b, newOwner) {
      const old = b.owner;
      const i = old.buildings.indexOf(b);
      if (i >= 0) old.buildings.splice(i, 1);
      b.owner = newOwner;
      newOwner.buildings.push(b);
      b.hp = Math.max(b.hp, b.maxHp * 0.35);
      b.target = null;
      if (b.docked) { b.docked.harvState = 'seek'; b.docked = null; }
      this.recomputePower(old);
      this.recomputePower(newOwner);
      if (this.fx) this.fx.dust(b.x, b.y, 10, 36, 6);
    }

    /**
     * 建筑手动修理（input.js 的修理模式把 building.repairing 置 true）。
     * 按 hp 计价，钱不够就自动停止 —— 不会偷偷把玩家的钱花光。
     */
    updateRepairs(dt) {
      for (let i = 0; i < this.buildings.length; i++) {
        const b = this.buildings[i];
        if (b.dead || !b.repairing) continue;
        if (b.hp >= b.maxHp) { b.repairing = false; continue; }
        const amt = R.RULES.repairRate * 0.8 * dt;
        const cost = amt * R.RULES.repairCostPerHp;
        if (b.owner.credits < cost) {
          b.repairing = false;
          if (b.owner === this.me) this.notify(b.owner, '资金不足，修理中止', 'needCredits');
          continue;
        }
        b.owner.spend(cost);
        b.heal(amt);
        if (this.fx && this.rnd() < dt * 9) {
          this.fx.emit(R.FXTYPE.P_SPARK,
            b.rect.x + this.rnd() * b.rect.w, b.rect.y + this.rnd() * b.rect.h,
            0, -34, 0.32, 1.7, '#9fe8ff', { drag: 3 });
        }
      }
    }

    /** 维修厂修车 */    doRepairPad(pad) {
      const list = this.queryAll(pad.x, pad.y, pad.rect.w * 0.6 + 12);
      for (const e of list) {
        if (e.dead || e.isBuilding || !e.isVehicle) continue;
        if (e.owner.team !== pad.owner.team) continue;
        if (e.hp >= e.maxHp) continue;
        if (Math.abs(e.x - pad.x) > pad.rect.w * 0.5 || Math.abs(e.y - pad.y) > pad.rect.h * 0.5) continue;
        const amt = R.RULES.repairRate * 0.25;
        const cost = amt * R.RULES.repairCostPerHp;
        if (pad.owner.credits < cost) continue;
        pad.owner.spend(cost);
        e.heal(amt);
        if (this.fx && this.rnd() < 0.35) {
          this.fx.emit(R.FXTYPE.P_SPARK, e.x + (this.rnd() - 0.5) * 14, e.y + (this.rnd() - 0.5) * 14,
            0, -30, 0.3, 1.6, '#9fe8ff', { drag: 3 });
        }
      }
    }

    /** 发射离子炮 */
    fireIon(player, x, y) {
      let src = null;
      for (const b of player.buildings) {
        if (!b.dead && b.def.superWeapon && b.chargeReady) { src = b; break; }
      }
      if (!src) return false;
      src.chargeReady = false;
      src.charge = 0;
      const wpn = R.WEAPONS[src.def.superWeapon.weapon];
      // 视觉：天降光柱
      if (this.fx) {
        this.fx.beam(x, y - 900, x, y, '#cfe9ff', 22, 0.65);
        this.fx.explosion(x, y, 'building');
        for (let i = 0; i < 10; i++) {
          const a = this.rnd() * U.TAU, d = this.rnd() * wpn.splash;
          this.fx.explosion(x + Math.cos(a) * d, y + Math.sin(a) * d, i % 2 ? 'large' : 'medium');
        }
        this.fx.addShake(13);
        this.fx.flash = 1;
      }
      R.Combat.splash(x, y, wpn.splash, wpn.dmg, wpn, src, 1);
      // 把地面烧焦
      const c = this.map.cellOf(x, y);
      const rr = Math.ceil(wpn.splash / T);
      for (let dy = -rr; dy <= rr; dy++) {
        for (let dx = -rr; dx <= rr; dx++) {
          if (U.len(dx, dy) > rr) continue;
          const tx = c.cx + dx, ty = c.cy + dy;
          if (this.map.inBounds(tx, ty) && this.map.terrainAt(tx, ty) === R.TERRAIN.GRASS) {
            this.map.terrain[this.map.idx(tx, ty)] = R.TERRAIN.DIRT;
          }
        }
      }
      if (this.onTerrainChanged) this.onTerrainChanged();
      if (R.Audio) R.Audio.play('ion', x, y);
      if (player === this.me) this.notify(player, '离子炮发射！', null);
      else this.alertAt(x, y);
      return true;
    }

    /** 拿到某玩家可用的超级武器状态 */
    superWeaponState(player) {
      for (const b of player.buildings) {
        if (b.dead || !b.def.superWeapon) continue;
        return { building: b, ready: b.chargeReady, frac: U.clamp01(b.charge / b.def.superWeapon.charge) };
      }
      return null;
    }

    /* ================= 投射物 ================= */
    spawnProjectile(shooter, target, wpn, x, y, angle) {
      const p = new R.Projectile(shooter, target, wpn, x, y, angle);
      this.projectiles.push(p);
      return p;
    }

    /* ================= 通知 ================= */
    notify(owner, text, vo) {
      if (owner !== this.me) return;
      if (text) {
        this.toasts.push({ text, t: 0, life: 3.4 });
        if (this.toasts.length > 6) this.toasts.shift();
      }
      if (vo && R.Audio) R.Audio.vo(vo);
      if (this.notifyCb) this.notifyCb(text, vo);
    }
    alertAt(x, y) {
      this.alerts.push({ x, y, t: 0, life: 4 });
      if (this.alerts.length > 12) this.alerts.shift();
    }

    /* ================= 迷雾 ================= */
    updateFog() {
      if (!this.fogEnabled) return;
      const map = this.map, w = map.w, h = map.h;
      for (const p of this.players) {
        const fog = p.fog;
        // 可见位降级为"已探明"
        for (let i = 0; i < fog.length; i++) if (fog[i] === FOG_VIS) fog[i] = FOG_SEEN;
        const stamp = (ex, ey, sightTiles) => {
          const cx = Math.floor(ex / T), cy = Math.floor(ey / T);
          const r = Math.ceil(sightTiles);
          const r2 = sightTiles * sightTiles;
          for (let dy = -r; dy <= r; dy++) {
            const yy = cy + dy;
            if (yy < 0 || yy >= h) continue;
            const row = yy * w;
            for (let dx = -r; dx <= r; dx++) {
              if (dx * dx + dy * dy > r2) continue;
              const xx = cx + dx;
              if (xx < 0 || xx >= w) continue;
              fog[row + xx] = FOG_VIS;
            }
          }
        };
        for (const u of p.units) if (!u.dead) stamp(u.x, u.y, u.sight);
        for (const b of p.buildings) if (!b.dead) stamp(b.x, b.y, b.sight + Math.max(b.w, b.h) * 0.5);
      }
      // 更新"已知敌方建筑"记忆
      for (const p of this.players) {
        for (const q of this.players) {
          if (q.team === p.team) continue;
          for (const b of q.buildings) {
            if (b.dead) continue;
            const i = this.map.idx(Math.floor(b.x / T), Math.floor(b.y / T));
            if (p.fog[i] === FOG_VIS) {
              p.knownEnemy.set(b.id, { x: b.x, y: b.y, id: b.def.id, ref: b, t: this.time });
            }
          }
        }
        // 清理已死的记忆
        for (const [k, v] of p.knownEnemy) if (v.ref && v.ref.dead) p.knownEnemy.delete(k);
      }
    }

    /** 某点对某玩家是否可见 */
    visibleTo(player, x, y) {
      if (!this.fogEnabled) return true;
      const cx = Math.floor(x / T), cy = Math.floor(y / T);
      if (!this.map.inBounds(cx, cy)) return false;
      return player.fog[cy * this.map.w + cx] === FOG_VIS;
    }
    exploredBy(player, x, y) {
      if (!this.fogEnabled) return true;
      const cx = Math.floor(x / T), cy = Math.floor(y / T);
      if (!this.map.inBounds(cx, cy)) return false;
      return player.fog[cy * this.map.w + cx] !== FOG_NONE;
    }

    /* ================= 主循环 ================= */
    update(dtReal) {
      if (this.paused || this.over) {
        // 暂停时仍然推进特效，让爆炸不会僵在半空（观感更好）
        return;
      }
      const dt = Math.min(0.05, dtReal) * this.speed;
      this.time += dt;
      this.frame++;

      /* 1. 空间索引：先建好，后面所有查询都用它 */
      this.rebuildHash();

      /* 2. 经济与队列 */
      for (const p of this.players) {
        if (p.defeated) continue;
        this.updateQueues(p, dt);
      }

      /* 3. 建筑 */
      for (let i = 0; i < this.buildings.length; i++) {
        const b = this.buildings[i];
        if (!b.dead) b.update(dt);
      }

      /* 4. 单位 */
      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (!u.dead) u.update(dt);
      }

      /* 5. 单位互相推挤（避免堆叠） */
      this.separate(dt);

      /* 6. 投射物 */
      for (let i = 0; i < this.projectiles.length; i++) {
        const p = this.projectiles[i];
        if (!p.dead) p.update(dt);
      }

      /* 7. 寻路预算 */
      this.pathQueue.process();

      /* 8. 矿脉再生 + 建筑自助修理 */
      this.map.regrow(dt);
      this.updateRepairs(dt);

      /* 9. 清理死亡对象 */
      this.cleanup();

      /* 10. 特效 */
      if (this.fx) this.fx.update(dt);

      /* 11. 迷雾（限频） */
      this.fogTimer -= dt;
      if (this.fogTimer <= 0) { this.fogTimer = 0.14; this.updateFog(); }

      /* 12. AI */
      for (const p of this.players) {
        if (p.ai && !p.defeated) p.ai.update(dt);
      }

      /* 13. 提示与警报老化 */
      for (let i = this.toasts.length - 1; i >= 0; i--) {
        const t = this.toasts[i]; t.t += dt;
        if (t.t >= t.life) this.toasts.splice(i, 1);
      }
      for (let i = this.alerts.length - 1; i >= 0; i--) {
        const a = this.alerts[i]; a.t += dt;
        if (a.t >= a.life) this.alerts.splice(i, 1);
      }

      /* 14. 基地被袭警报 */
      this.checkBaseAttack();

      /* 15. 胜负 */
      this.checkVictory();

      const total = this.units.length;
      if (total > this.stats.peakUnits) this.stats.peakUnits = total;
    }

    rebuildHash() {
      this.hash.clear();
      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (!u.dead) this.hash.insert(u);
      }
      for (let i = 0; i < this.buildings.length; i++) {
        const b = this.buildings[i];
        if (!b.dead) this.hash.insert(b);
      }
    }

    /**
     * 单位分离：把重叠的单位推开。
     * 只处理地面单位；飞机各飞各的。用空间哈希，O(n·k)。
     */
    separate(dt) {
      const list = this.units;
      const q = [];
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (a.dead || a.isAir) continue;
        this.hash.query(a.x, a.y, a.rad * 2 + 18, q);
        let px = 0, py = 0, n = 0;
        for (let j = 0; j < q.length; j++) {
          const b = q[j];
          if (b === a || b.dead || b.isBuilding || b.isAir) continue;
          const dx = a.x - b.x, dy = a.y - b.y;
          const want = (a.rad + b.rad) * 0.92;
          const d2 = dx * dx + dy * dy;
          if (d2 >= want * want) continue;
          let d = Math.sqrt(d2);
          if (d < 0.001) {
            // 完全重合：用 id 决定推开方向，保证确定性
            const ang = (a.id % 360) * U.DEG;
            px += Math.cos(ang); py += Math.sin(ang); n++;
            continue;
          }
          const push = (want - d) / want;
          // 静止单位被移动单位推开的力度更大（让路感）
          const wgt = (a.moving && !b.moving) ? 0.55 : (!a.moving && b.moving ? 1.35 : 1);
          px += (dx / d) * push * wgt;
          py += (dy / d) * push * wgt;
          n++;
        }
        if (n === 0) continue;
        const k = Math.min(1, 1 / Math.sqrt(n));
        const spd = (a.speed || 50) * 0.85;
        let mx = px * k * spd * dt, my = py * k * spd * dt;
        const mag = U.len(mx, my);
        const cap = spd * dt * 1.2;
        if (mag > cap) { mx = mx / mag * cap; my = my / mag * cap; }
        a.tryStep(mx, my);
      }
    }

    cleanup() {
      let n = 0;
      const units = this.units;
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (u.dead) {
          const arr = u.owner.units;
          const j = arr.indexOf(u);
          if (j >= 0) arr.splice(j, 1);
          this.pathQueue.cancel(u);
        } else units[n++] = u;
      }
      units.length = n;

      n = 0;
      const projs = this.projectiles;
      for (let i = 0; i < projs.length; i++) {
        if (!projs[i].dead) projs[n++] = projs[i];
      }
      projs.length = n;

      n = 0;
      const bs = this.buildings;
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        if (b.dead) { if (!b.removed) this.removeBuilding(b); }
        else bs[n++] = b;
      }
      bs.length = n;

      // 清理选择集里的死对象
      for (let i = this.selection.length - 1; i >= 0; i--) {
        if (this.selection[i].dead) this.selection.splice(i, 1);
      }
      for (const k in this.groups) {
        const g = this.groups[k];
        for (let i = g.length - 1; i >= 0; i--) if (g[i].dead) g.splice(i, 1);
      }
    }

    checkBaseAttack() {
      const me = this.me;
      if (this.time - (this._lastBaseWarn || -99) < 12) return;
      for (const b of me.buildings) {
        if (b.dead) continue;
        if (this.time - b.lastHitT < 0.6) {
          this._lastBaseWarn = this.time;
          this.notify(me, '基地遭到攻击！', 'baseAttack');
          this.alertAt(b.x, b.y);
          return;
        }
      }
    }

    checkVictory() {
      if (this.over) return;
      for (const p of this.players) {
        if (p.defeated) continue;
        const aliveB = p.buildings.length > 0;
        const aliveU = p.units.length > 0;
        if (!aliveB && !aliveU) {
          p.defeated = true;
        }
      }
      const alive = this.players.filter((p) => !p.defeated);
      if (alive.length <= 1) {
        this.over = true;
        const win = alive.length === 1 && alive[0] === this.me;
        this.result = win ? 'win' : 'lose';
        if (R.Audio) R.Audio.vo(win ? 'victory' : 'defeat');
        if (this.onGameOver) this.onGameOver(this.result);
      } else if (this.me.defeated) {
        this.over = true; this.result = 'lose';
        if (R.Audio) R.Audio.vo('defeat');
        if (this.onGameOver) this.onGameOver(this.result);
      }
    }

    /* ================= 玩家指令入口（input.js / ai.js 用） ================= */
    /**
     * 对一组单位下达"到某点"的命令，自动排成阵型。
     * 这是手感的关键：一群坦克点同一个点时不该挤成一坨。
     */
    commandMove(units, x, y, attackMove) {
      const list = units.filter((u) => !u.dead && u.owner && !u.isBuilding);
      if (!list.length) return;
      const slots = this.formation(list, x, y);
      for (let i = 0; i < list.length; i++) {
        const u = list[i];
        const s = slots[i];
        u.orderMove(s.x, s.y, { attackMove });
      }
      if (R.Audio && list[0].owner === this.me) R.Audio.ui('order');
    }

    /**
     * 生成阵型槽位并按"就近分配"返回（out[i] 对应 list[i]）。
     * 做法：以目标点为中心排一个方阵，方阵朝向 = 队伍重心 → 目标点的方向，
     * 然后贪心地把每个单位分给离它最近的空槽 —— 这样队列不会交叉打结。
     */
    formation(list, x, y) {
      const n = list.length;
      if (n === 0) return [];
      if (n === 1) return [{ x, y }];

      // 间距取队伍里最大的半径，保证最胖的单位也不重叠
      let rad = 0;
      for (const u of list) rad = Math.max(rad, u.rad);
      const spacing = Math.max(T * 0.9, rad * 2.35);

      // 队伍重心 → 目标点，作为阵型朝向
      let gx = 0, gy = 0;
      for (const u of list) { gx += u.x; gy += u.y; }
      gx /= n; gy /= n;
      let ang = Math.atan2(y - gy, x - gx);
      if (!isFinite(ang)) ang = 0;
      const ca = Math.cos(ang), sa = Math.sin(ang);

      // 方阵：列数取 sqrt，宽面朝前（横队推进，像红警里的坦克墙）
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.6)));
      const rows = Math.ceil(n / cols);
      const slots = [];
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols), c = i % cols;
        const rowCount = Math.min(cols, n - r * cols);
        // 局部坐标：u 沿队列横向，v 沿前进反方向（后排在后面）
        const u0 = (c - (rowCount - 1) / 2) * spacing;
        const v0 = -r * spacing;
        let px = x + (ca * v0 - sa * u0);
        let py = y + (sa * v0 + ca * u0);
        px = U.clamp(px, T * 0.6, this.map.pxW - T * 0.6);
        py = U.clamp(py, T * 0.6, this.map.pxH - T * 0.6);
        slots.push({ x: px, y: py, used: false });
      }

      // 贪心就近分配：按"离目标点最近的单位先挑"的顺序，避免长距离交叉
      const order = [];
      for (let i = 0; i < n; i++) order.push(i);
      order.sort((a, b) =>
        U.dist2(list[a].x, list[a].y, x, y) - U.dist2(list[b].x, list[b].y, x, y));

      const out = new Array(n);
      for (const idx of order) {
        const u = list[idx];
        let best = -1, bd = Infinity;
        for (let s = 0; s < slots.length; s++) {
          if (slots[s].used) continue;
          const d = U.dist2(u.x, u.y, slots[s].x, slots[s].y);
          if (d < bd) { bd = d; best = s; }
        }
        if (best < 0) { out[idx] = { x, y }; continue; }
        slots[best].used = true;
        out[idx] = { x: slots[best].x, y: slots[best].y };
      }
      return out;
    }

    commandAttack(units, target) {
      let any = false;
      for (const u of units) {
        if (u.dead || u.isBuilding) continue;
        if (u.def.engineer && target.isBuilding && u.isEnemy(target)) { u.orderCapture(target); any = true; continue; }
        if (!u.weapon) {
          // 没武器的跟着过去
          u.orderMove(target.x, target.y);
          continue;
        }
        if (!R.canTarget(u.weapon, target)) continue;
        u.orderAttack(target);
        any = true;
      }
      if (any && R.Audio && units[0] && units[0].owner === this.me) R.Audio.ui('order');
      return any;
    }

    commandStop(units) {
      for (const u of units) if (!u.isBuilding) u.stop();
    }
    commandGuard(units) {
      for (const u of units) if (!u.isBuilding) u.orderGuard(u.x, u.y);
    }
    commandDeploy(units) {
      let any = false;
      for (const u of units) {
        if (u.def.deploysTo) { u.orderDeploy(); any = true; }
      }
      return any;
    }
    /** 右键点在矿上 → 矿车去采 */
    commandHarvest(units, cell) {
      let any = false;
      for (const u of units) {
        if (u.def.harvester) { u.orderHarvest(cell); any = true; }
      }
      return any;
    }
  }
  R.Game = Game;

})();
