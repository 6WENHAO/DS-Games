/* ===================================================================
   ai.js — 电脑对手

   原则：AI 只通过与人类**完全相同**的公开接口操作
     game.queueAdd / tryPlacePending / commandMove / commandAttack ...
   它没有额外的伤害加成，也不能穿墙。难度差异只体现在：
     反应间隔、部队规模阈值、经济效率（资金涓流）、科技节奏。

   结构：
     think 分四条独立的"车道"，各有自己的冷却，避免同帧全跑一遍：
       economy  矿车与精炼厂
       build    盖房子（含选址）
       army     出兵与编组
       command  进攻/防守决策
   =================================================================== */
(function () {
  'use strict';
  const R = window.R;
  const U = R.U, T = R.TILE;

  const DIFF = {
    easy: {
      name: '简单', interval: 0.85, attackSize: 8, maxHarvesters: 3,
      trickle: 0, defenses: 3, techAt: 330, expandAt: 260, waveGrowth: 2.2,
      firstAttackAt: 215, homeGuard: 0.30,
      microChance: 0.25, maxArmy: 26,
    },
    normal: {
      name: '普通', interval: 0.55, attackSize: 11, maxHarvesters: 5,
      trickle: 0, defenses: 6, techAt: 210, expandAt: 170, waveGrowth: 3.0,
      firstAttackAt: 155, homeGuard: 0.25,
      microChance: 0.55, maxArmy: 46,
    },
    hard: {
      name: '困难', interval: 0.38, attackSize: 13, maxHarvesters: 7,
      trickle: 9, defenses: 9, techAt: 150, expandAt: 120, waveGrowth: 3.8,
      firstAttackAt: 105, homeGuard: 0.20,
      microChance: 0.85, maxArmy: 70,
    },
  };
  R.AI_DIFF = DIFF;

  R.AI = class AI {
    constructor(game, player, difficulty) {
      this.game = game;
      this.p = player;
      this.d = DIFF[difficulty] || DIFF.normal;
      this.diffKey = DIFF[difficulty] ? difficulty : 'normal';
      this.rnd = R.rng((player.index + 1) * 7919 + game.seed);

      this.tEco = this.rnd() * 0.5;
      this.tBuild = this.rnd() * 0.5;
      this.tArmy = this.rnd() * 0.5;
      this.tCmd = this.rnd() * 0.5;

      /** 军队状态机 */
      this.mode = 'gather';       // gather | attack | defend | regroup
      this.squad = [];
      this.attackTarget = null;
      this.attackPos = null;
      this.waveNo = 0;
      this.modeT = 0;
      this.lastAttackT = -999;

      /** 敌人方向（用于防御选址与进攻集结） */
      const enemy = game.players.find((q) => q.team !== player.team);
      this.enemyStart = enemy ? game.map.centerOf(enemy.startCell.cx, enemy.startCell.cy)
        : { x: game.map.pxW / 2, y: game.map.pxH / 2 };
      const my = game.map.centerOf(player.startCell.cx, player.startCell.cy);
      this.homePos = my;
      this.towardEnemy = Math.atan2(this.enemyStart.y - my.y, this.enemyStart.x - my.x);
      /** 集结点：基地朝敌方 6 格处 */
      this.rally = {
        x: U.clamp(my.x + Math.cos(this.towardEnemy) * T * 7, T * 2, game.map.pxW - T * 2),
        y: U.clamp(my.y + Math.sin(this.towardEnemy) * T * 7, T * 2, game.map.pxH - T * 2),
      };
      this.scouted = false;
      this.emergency = 0;
      this.sellCd = 0;
      this.homeGuards = [];
    }

    /* ================= 主入口 ================= */
    update(dt) {
      const p = this.p;
      if (p.defeated) return;
      if (this.d.trickle) p.credits += this.d.trickle * dt;

      // 待放置建筑：立刻找地方落地（最高优先，否则堵队列）
      if (p.pendingBuild) this.placePending();

      this.tEco -= dt; this.tBuild -= dt; this.tArmy -= dt; this.tCmd -= dt;
      const iv = this.d.interval;
      if (this.tEco <= 0) { this.tEco = iv * 1.6; this.thinkEconomy(); }
      if (this.tBuild <= 0) { this.tBuild = iv; this.thinkBuild(); }
      if (this.tArmy <= 0) { this.tArmy = iv * 1.2; this.thinkArmy(); }
      if (this.tCmd <= 0) { this.tCmd = iv * 0.9; this.thinkCommand(dt); }
      this.modeT += dt;
      if (this.emergency > 0) this.emergency -= dt;

      // 超级武器：对着人类基地最密的地方来一发
      const sw = this.game.superWeaponState(p);
      if (sw && sw.ready) this.fireSuper();
    }

    /* ================= 经济 ================= */
    thinkEconomy() {
      const G = this.game, p = this.p;
      const refineries = p.countBuilding('refinery');
      const harv = p.countUnit('harvester');
      const want = Math.min(this.d.maxHarvesters, Math.max(2, refineries * 2));
      const queued = this.countQueued('harvester');
      if (harv + queued < want && p.has('factory')) {
        G.queueAdd(p, 'harvester');
      }
      // 闲置矿车重新开工（被打断后可能停在原地）
      for (const u of p.units) {
        if (!u.def.harvester || u.dead) continue;
        if (u.order.type !== R.ORDER.HARVEST) u.orderHarvest(null);
      }
    }

    /* ================= 建造 ================= */
    thinkBuild() {
      const G = this.game, p = this.p;
      if (!p.has('conyard')) {
        // 没建造厂了：如果有基地车就展开
        for (const u of p.units) if (u.def.deploysTo) { u.orderDeploy(); return; }
        return;
      }
      // 经济已死就先自救（否则会变成"有建筑但永远没钱"的僵尸，长局僵持不下）
      this.emergencySell();
      if (p.queues.structure.length > 0) return;   // 一次只排一栋，保证资金流
      const id = this.pickBuilding();
      if (id) G.queueAdd(p, id);
    }

    /**
     * 应急变卖：没有精炼厂（或彻底断炊）且钱不够重建时，卖掉最不重要的
     * 建筑换现金。人类玩家可以手动卖楼救场，AI 也得会，不然一旦被拆光
     * 精炼厂就永久失能，对局会拖成毫无意义的僵局。
     */
    emergencySell() {
      const G = this.game, p = this.p;
      const needRef = !p.has('refinery');
      const brokeAndIdle = p.credits < 120 && p.countUnit('harvester') === 0;
      if (!needRef && !brokeAndIdle) return;
      const refCost = R.BUILDINGS.refinery.cost;
      if (p.credits >= refCost + 200) return;      // 钱够了，不用卖
      if (this.sellCd > 0) { this.sellCd -= this.d.interval; return; }

      // 卖出优先级：多余的电厂 → 防御 → 直升机坪/维修厂 → 雷达
      const spare = p.powerMade - p.powerUsed;
      const order = ['helipad', 'repair', 'pillbox', 'turret', 'aa', 'wall', 'radar', 'tech'];
      let victim = null;
      if (spare >= 100) {
        for (const b of p.buildings) if (!b.dead && b.def.id === 'power') { victim = b; break; }
      }
      if (!victim) {
        for (const id of order) {
          for (const b of p.buildings) {
            if (!b.dead && b.def.id === id) { victim = b; break; }
          }
          if (victim) break;
        }
      }
      if (!victim) return;
      G.sell(victim);
      this.sellCd = 3;
    }

    pickBuilding() {
      const G = this.game, p = this.p, t = G.time;
      const D = this.d;
      const has = (x) => p.has(x);
      const cnt = (x) => p.countBuilding(x);

      /* 1. 电力：留出余量，缺电什么都慢 */
      const spare = p.powerMade - p.powerUsed;
      if (spare < 35 && this.canAfford('power', 1.0)) return 'power';

      /* 2. 经济骨架 */
      if (!has('refinery')) return 'refinery';
      if (!has('barracks')) return 'barracks';
      if (!has('factory')) return 'factory';

      /* 3. 第二座精炼厂（扩张经济） */
      if (cnt('refinery') < 2 && t > 55) return 'refinery';

      /* 4. 基础防御：优先在受威胁方向 */
      const defCount = cnt('pillbox') + cnt('turret') + cnt('aa');
      if (defCount < 2 && has('barracks')) return defCount === 0 ? 'pillbox' : 'turret';

      /* 5. 雷达 → 解锁二级 */
      if (!has('radar') && t > 70) return 'radar';

      /* 6. 更多防御 */
      if (defCount < D.defenses) {
        if (cnt('aa') < 1 && has('radar') && t > 140) return 'aa';
        return this.rnd() < 0.55 ? 'turret' : 'pillbox';
      }

      /* 7. 维修厂（让坦克能续航） */
      if (!has('repair') && has('factory') && t > 130) return 'repair';

      /* 8. 三级科技 */
      if (!has('tech') && t > D.techAt) return 'tech';

      /* 9. 第三座精炼厂 / 更多电 */
      if (cnt('refinery') < 3 && t > D.expandAt) return 'refinery';
      if (spare < 90) return 'power';

      /* 10. 空军与超级武器 */
      if (has('radar') && !has('helipad') && t > D.expandAt + 60) return 'helipad';
      if (has('tech') && !has('ion') && this.diffKey !== 'easy') return 'ion';

      /* 11. 后期：堆防御与电力 */
      if (defCount < D.defenses * 2) return this.rnd() < 0.4 ? 'aa' : 'turret';
      if (spare < 160) return 'power';
      if (cnt('refinery') < 4) return 'refinery';
      return null;
    }

    canAfford(id, mul) {
      const d = R.def(id);
      return d ? this.p.credits >= d.cost * (mul || 1) : false;
    }
    countQueued(id) {
      let n = 0;
      for (const k in this.p.queues) for (const it of this.p.queues[k]) if (it.id === id) n++;
      return n;
    }

    /* ---------------- 选址 ---------------- */
    placePending() {
      const G = this.game, p = this.p;
      const id = p.pendingBuild;
      const def = R.BUILDINGS[id];
      if (!def) { p.pendingBuild = null; return; }
      const spot = this.findSpot(def);
      if (spot) {
        G.tryPlacePending(p, spot.cx, spot.cy);
      } else {
        // 找不到位置：把它取消，免得永久堵住队列
        this.stuckPlace = (this.stuckPlace || 0) + 1;
        if (this.stuckPlace > 6) { G.queueCancel(p, id); this.stuckPlace = 0; }
      }
    }

    /**
     * 选址策略：
     *   精炼厂 → 尽量贴近未采完的矿田
     *   防御   → 基地朝敌方那一侧的外围
     *   其它   → 紧凑地贴着已有建筑（省电线、好防守）
     */
    findSpot(def) {
      const G = this.game, p = this.p, map = G.map;
      const cy0 = G.findConyard(p);
      const anchor = cy0 ? { x: cy0.x, y: cy0.y } : this.homePos;
      let prefer = anchor;
      let maxR = R.RULES.buildRadius;

      if (def.id === 'refinery') {
        const field = this.pickOreField();
        if (field) prefer = map.centerOf(field.cx, field.cy);
      } else if (def.tab === 'def') {
        const dir = this.threatDir();
        prefer = {
          x: anchor.x + Math.cos(dir) * T * (R.RULES.buildRadius - 1.5),
          y: anchor.y + Math.sin(dir) * T * (R.RULES.buildRadius - 1.5),
        };
      }

      const pcx = Math.floor(prefer.x / T), pcy = Math.floor(prefer.y / T);
      let best = null, bestScore = Infinity;
      // 以 prefer 为中心螺旋搜索
      for (let r = 0; r <= 22; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const cx = pcx + dx - ((def.size.w / 2) | 0);
            const cy = pcy + dy - ((def.size.h / 2) | 0);
            if (!G.canPlace(p, def, cx, cy)) continue;
            // 评分：离 prefer 越近越好；别把出入口堵死
            const c = R.buildingCenter(def, cx, cy);
            let score = U.dist(c.x, c.y, prefer.x, prefer.y);
            // 生产建筑要留出下方空间出兵
            if (def.produces) {
              let blocked = 0;
              for (let x = cx; x < cx + def.size.w; x++) {
                for (let yy = cy + def.size.h; yy < cy + def.size.h + 2; yy++) {
                  if (!map.terrainPassable(x, yy) || map.occupied[map.idx(x, Math.min(map.h - 1, yy))]) blocked++;
                }
              }
              score += blocked * T * 1.4;
            }
            if (def.id === 'refinery') {
              // 精炼厂离矿越近越好（用矿量密度加权）
              let ore = 0;
              for (let dy2 = -4; dy2 <= 4; dy2++) {
                for (let dx2 = -4; dx2 <= 4; dx2++) {
                  const ox = cx + dx2, oy = cy + dy2;
                  if (map.inBounds(ox, oy)) ore += map.ore[map.idx(ox, oy)];
                }
              }
              score -= ore * 0.55;
            }
            if (score < bestScore) { bestScore = score; best = { cx, cy }; }
          }
        }
        if (best && r > 5) break;      // 找到就差不多了，别浪费 CPU
      }
      return best;
    }

    /** 挑一块还有矿、且不太危险的矿田 */
    pickOreField() {
      const G = this.game, map = G.map;
      let best = null, bestScore = -Infinity;
      for (const f of map.oreFields) {
        // 估算剩余矿量
        let ore = 0;
        const r = Math.ceil(f.r) + 1;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const x = f.cx + dx, y = f.cy + dy;
            if (map.inBounds(x, y)) ore += map.ore[map.idx(x, y)];
          }
        }
        if (ore < 200) continue;
        const c = map.centerOf(f.cx, f.cy);
        const dHome = U.dist(c.x, c.y, this.homePos.x, this.homePos.y);
        const dEnemy = U.dist(c.x, c.y, this.enemyStart.x, this.enemyStart.y);
        // 近自己、远敌人、矿多
        const score = ore * 0.5 - dHome * 1.1 + dEnemy * 0.35;
        if (score > bestScore) { bestScore = score; best = f; }
      }
      return best;
    }

    /** 最近被打的方向；没被打就朝敌方基地 */
    threatDir() {
      const p = this.p, G = this.game;
      let bx = 0, by = 0, n = 0;
      for (const b of p.buildings) {
        if (b.dead) continue;
        if (G.time - b.lastHitT < 25) { bx += b.x; by += b.y; n++; }
      }
      if (n > 0) {
        return Math.atan2(by / n - this.homePos.y, bx / n - this.homePos.x);
      }
      return this.towardEnemy;
    }

    /* ================= 出兵 ================= */
    thinkArmy() {
      const G = this.game, p = this.p;
      const army = this.armyUnits();
      if (army.length >= this.d.maxArmy) return;
      if (p.credits < 220) return;

      // 兵种配比随时间演进：早期步兵，中期坦克，后期重装 + 火炮 + 防空
      const t = G.time;
      const opts = [];
      const push = (id, w) => { const d = R.UNITS[id]; if (d && p.canBuild(d)) opts.push({ id, w }); };

      if (p.has('barracks')) {
        push('rifleman', t < 90 ? 5 : 2);
        push('rocketeer', t < 60 ? 1 : 3);
        push(p.faction === 'guard' ? 'sniper' : 'flamer', t < 120 ? 0.5 : 1.6);
        // 工程师偷家：有一定概率造一个去占领
        if (t > 200 && this.rnd() < 0.10 && p.countUnit('engineer') === 0) push('engineer', 1);
      }
      if (p.has('factory')) {
        push('lightTank', t < 150 ? 3 : 1.4);
        push(p.faction === 'guard' ? 'grizzly' : 'rhino', t < 90 ? 1.5 : 4.5);
        push('scout', this.scouted ? 0.3 : 1.4);
        push('flakTrack', this.enemyHasAir() ? 3 : 0.7);
        push('artillery', t > 180 ? 2.2 : 0.4);
        push('apoc', 3.4);
      }
      if (p.has('helipad') && p.countUnit('gunship') < 4) push('gunship', 2.0);

      if (!opts.length) return;
      // 加权随机
      let total = 0;
      for (const o of opts) total += o.w;
      let pick = this.rnd() * total;
      for (const o of opts) {
        pick -= o.w;
        if (pick <= 0) { G.queueAdd(p, o.id); return; }
      }
      G.queueAdd(p, opts[opts.length - 1].id);
    }

    enemyHasAir() {
      const G = this.game;
      for (const q of G.players) {
        if (q.team === this.p.team) continue;
        for (const u of q.units) if (!u.dead && u.isAir) return true;
      }
      return false;
    }

    /** 可用于作战的单位（排除矿车、基地车、工程师） */
    armyUnits() {
      const out = [];
      for (const u of this.p.units) {
        if (u.dead) continue;
        if (u.def.harvester || u.def.deploysTo) continue;
        if (u.def.engineer) continue;
        out.push(u);
      }
      return out;
    }

    /* ================= 指挥 ================= */
    thinkCommand(dt) {
      const G = this.game, p = this.p;
      const army = this.armyUnits();

      /* --- 防守优先：基地附近有敌人就回防 --- */
      const threat = this.findBaseThreat();
      if (threat) {
        this.emergency = 6;
        this.mode = 'defend';
        this.modeT = 0;
        const near = army.filter((u) => U.dist(u.x, u.y, threat.x, threat.y) < T * 34);
        const use = near.length >= 2 ? near : army;
        for (const u of use) {
          if (u.order.type === R.ORDER.ATTACK && u.target && !u.target.dead &&
              U.dist(u.x, u.y, u.target.x, u.target.y) < T * 8) continue;
          u.orderMove(threat.x + (this.rnd() - 0.5) * T * 3, threat.y + (this.rnd() - 0.5) * T * 3, { attackMove: true });
        }
        // 防守时也让附近的防御建筑目标一致（无需操作，建筑自动索敌）
        return;
      }

      /* --- 侦察：早期派一辆侦察车摸图 --- */
      if (!this.scouted) {
        const sc = p.units.find((u) => !u.dead && u.def.id === 'scout');
        if (sc) {
          if (sc.order.type === R.ORDER.IDLE || sc.order.type === R.ORDER.GUARD) {
            sc.orderMove(this.enemyStart.x + (this.rnd() - 0.5) * T * 10,
              this.enemyStart.y + (this.rnd() - 0.5) * T * 10, { attackMove: true });
          }
          if (U.dist(sc.x, sc.y, this.enemyStart.x, this.enemyStart.y) < T * 14) this.scouted = true;
        }
      }

      /* --- 进攻决策 --- */
      const need = this.d.attackSize + Math.floor(this.waveNo * this.d.waveGrowth);
      // 首波进攻不能太早：要给对手留出建立经济与防御的时间。
      // 实测把这条去掉后，同难度互打有 5/6 局在 3~4 分钟内一边倒结束，
      // 完全没有 RTS 该有的攻防拉锯。
      const tooEarly = G.time < (this.d.firstAttackAt || 0);
      if (this.mode === 'gather' || this.mode === 'defend') {
        if (this.mode === 'defend' && this.emergency <= 0) this.mode = 'gather';
        // 集结
        const idle = army.filter((u) => u.order.type === R.ORDER.IDLE ||
          (u.order.type === R.ORDER.GUARD && U.dist(u.x, u.y, this.rally.x, this.rally.y) > T * 6));
        if (idle.length) {
          const slots = G.formation(idle, this.rally.x, this.rally.y);
          for (let i = 0; i < idle.length; i++) idle[i].orderMove(slots[i].x, slots[i].y);
        }
        const ready = army.filter((u) => U.dist(u.x, u.y, this.rally.x, this.rally.y) < T * 9);
        if (!tooEarly && army.length >= need && ready.length >= Math.ceil(need * 0.65)) {
          this.launchAttack(army);
        }
        return;
      }

      if (this.mode === 'attack') {
        // 目标没了就换
        let tgt = this.attackTarget;
        if (!tgt || tgt.dead) { tgt = this.pickAttackTarget(); this.attackTarget = tgt; }
        if (!tgt) { this.mode = 'gather'; this.modeT = 0; return; }
        this.attackPos = { x: tgt.x, y: tgt.y };

        // 留守部队不参与推进
        const guards = this.homeGuards || [];
        const alive = army.filter((u) => !u.dead && guards.indexOf(u) < 0);
        // 打光了或损失过半 → 撤回重整
        if (alive.length <= Math.max(2, Math.floor(need * 0.3))) {
          this.mode = 'gather'; this.modeT = 0; this.waveNo++;
          this.homeGuards = [];
          for (const u of alive) u.orderMove(this.rally.x, this.rally.y);
          return;
        }
        // 逐个下令：射程内自己打，否则攻击移动过去
        for (const u of alive) {
          if (u.order.type === R.ORDER.ATTACK && u.target && !u.target.dead) continue;
          // 微操：血少的火炮/纸甲后退
          if (this.rnd() < this.d.microChance && u.hpFrac < 0.3 && u.def.id === 'artillery') {
            u.orderMove(this.rally.x, this.rally.y);
            continue;
          }
          const d = U.dist(u.x, u.y, tgt.x, tgt.y);
          if (d < R.px(u.weapon ? u.weapon.range + 1 : 4) && u.weapon && R.canTarget(u.weapon, tgt)) {
            u.orderAttack(tgt);
          } else if (u.order.type !== R.ORDER.ATTACKMOVE || this.modeT > 7) {
            u.orderMove(tgt.x + (this.rnd() - 0.5) * T * 5, tgt.y + (this.rnd() - 0.5) * T * 5, { attackMove: true });
          }
        }
        if (this.modeT > 7) this.modeT = 0;
        // 工程师趁乱偷家
        this.microEngineers();
        return;
      }
    }

    launchAttack(army) {
      const tgt = this.pickAttackTarget();
      if (!tgt) return;
      this.mode = 'attack';
      this.modeT = 0;
      this.attackTarget = tgt;
      this.lastAttackT = this.game.time;
      this.waveNo++;
      const G = this.game;
      // 留一部分部队守家：全军出击后被反打空是最常见的 AI 崩盘方式
      const guardN = Math.floor(army.length * (this.d.homeGuard || 0));
      const sorted = army.slice().sort((a, b) =>
        U.dist2(a.x, a.y, this.homePos.x, this.homePos.y) - U.dist2(b.x, b.y, this.homePos.x, this.homePos.y));
      this.homeGuards = sorted.slice(0, guardN);
      for (const u of this.homeGuards) {
        u.orderGuard(
          this.homePos.x + (this.rnd() - 0.5) * T * 6,
          this.homePos.y + (this.rnd() - 0.5) * T * 6);
      }
      const strike = sorted.slice(guardN);
      if (!strike.length) return;
      const slots = G.formation(strike, tgt.x, tgt.y);
      for (let i = 0; i < strike.length; i++) {
        strike[i].orderMove(slots[i].x, slots[i].y, { attackMove: true });
      }
    }

    /** 挑进攻目标：优先已探明的关键建筑 */
    pickAttackTarget() {
      const G = this.game, p = this.p;
      const PRIORITY = {
        conyard: 10, factory: 9, refinery: 8.5, power: 8, barracks: 7,
        tech: 7, ion: 12, radar: 6, helipad: 6, repair: 5,
        turret: 3, pillbox: 3, aa: 3, wall: 0.4,
      };
      let best = null, bestScore = -Infinity;
      const from = this.rally;
      // 用"已探明"记忆；没探明就朝敌方出生点推
      for (const [, m] of p.knownEnemy) {
        const b = m.ref;
        if (!b || b.dead) continue;
        const pr = PRIORITY[b.def.id] === undefined ? 4 : PRIORITY[b.def.id];
        const d = U.dist(from.x, from.y, b.x, b.y);
        const score = pr * 100 - d * 0.35;
        if (score > bestScore) { bestScore = score; best = b; }
      }
      if (best) return best;
      // 没探明：找任意可见敌方单位，否则打出生点方向
      for (const q of G.players) {
        if (q.team === p.team) continue;
        for (const b of q.buildings) if (!b.dead) return b;
        for (const u of q.units) if (!u.dead) return u;
      }
      return null;
    }

    /** 基地附近的敌人 */
    findBaseThreat() {
      const G = this.game, p = this.p;
      let best = null, bd = Infinity;
      for (const b of p.buildings) {
        if (b.dead) continue;
        const list = G.queryHostiles(b.x, b.y, T * 11, p);
        for (const e of list) {
          if (e.dead || e.isBuilding) continue;
          const d = U.dist(b.x, b.y, e.x, e.y);
          if (d < bd) { bd = d; best = e; }
        }
      }
      return best;
    }

    /** 工程师去占领人类的关键建筑 */
    microEngineers() {
      const p = this.p;
      for (const u of p.units) {
        if (u.dead || !u.def.engineer) continue;
        if (u.order.type === R.ORDER.CAPTURE) continue;
        let best = null, bestScore = -Infinity;
        for (const [, m] of p.knownEnemy) {
          const b = m.ref;
          if (!b || b.dead) continue;
          const w = b.def.id === 'conyard' ? 14 : (b.def.id === 'refinery' ? 9 : (b.def.id === 'factory' ? 8 : 3));
          const score = w * 100 - U.dist(u.x, u.y, b.x, b.y) * 0.4;
          if (score > bestScore) { bestScore = score; best = b; }
        }
        if (best) u.orderCapture(best);
      }
    }

    /** 超级武器目标：人类建筑最密集处 */
    fireSuper() {
      const G = this.game, p = this.p;
      let best = null, bestN = 0;
      for (const q of G.players) {
        if (q.team === p.team) continue;
        for (const b of q.buildings) {
          if (b.dead) continue;
          let n = 0;
          for (const o of q.buildings) {
            if (o.dead) continue;
            if (U.dist(b.x, b.y, o.x, o.y) < 90) n += (o.def.cost / 500);
          }
          if (n > bestN) { bestN = n; best = b; }
        }
      }
      if (best && bestN > 2) G.fireIon(p, best.x, best.y);
    }
  };

})();
