import * as THREE from 'three';
import { Tank } from './tank.js';
import { AIController } from './ai.js';
import { TANKS, TANK_LIST, AI_NAMES_A, AI_NAMES_B } from './tankData.js';
import { makeRNG, clamp } from '../core/utils.js';

/**
 * 战斗管理：队伍生成 / 占点 / 票数 / 重生 / 侦查 / 计分 / 胜负
 */
export class Battle {
  constructor(ctx, { playerTankId = 't34' } = {}) {
    this.ctx = ctx;
    ctx.battle = this;
    this.rng = makeRNG(Date.now() & 0xffff);
    this.tanks = [];
    this.controllers = [];
    this.time = 15 * 60;
    this.tickets = { A: 1000, B: 1000 };
    this.pool = { A: 7, B: 8 };
    this.playerLives = 3;
    this.cap = { ...ctx.layout.cap, progress: 0, owner: null, statusText: '' };
    this.respawnQueue = [];
    this.ended = false;
    this.playerStats = { kills: 0, assists: 0, damage: 0, capture: 0, score: 0, deaths: 0 };
    this.cb = {};  // UI 回调：killFeed, hitFeedback, playerDamaged, toast, centerMsg, end, playerDestroyed
    this._spotAcc = 0;
    this._capMsgState = '';

    this._spawnAll(playerTankId);
  }

  _spawnAll(playerTankId) {
    const L = this.ctx.layout;
    // 玩家
    this.playerTank = this._createTank({
      dataId: playerTankId, team: 'A', name: '车长(你)', isPlayer: true, spawnIndex: 0,
    });
    // 友军
    for (let i = 0; i < 4; i++) {
      const t = this._createTank({
        dataId: TANK_LIST[(this.rng() * 4) | 0], team: 'A', name: AI_NAMES_A[i], spawnIndex: i + 1,
      });
      this.controllers.push(new AIController(this.ctx, t, 100 + i));
    }
    // 敌军
    for (let i = 0; i < 5; i++) {
      const t = this._createTank({
        dataId: TANK_LIST[(this.rng() * 4) | 0], team: 'B', name: AI_NAMES_B[i], spawnIndex: i,
      });
      this.controllers.push(new AIController(this.ctx, t, 200 + i));
    }
  }

  _createTank({ dataId, team, name, isPlayer = false, spawnIndex = 0 }) {
    const tank = new Tank(this.ctx, { data: TANKS[dataId], team, name, isPlayer });
    const spawns = this.ctx.layout.spawns[team];
    const [sx, sz] = spawns[spawnIndex % spawns.length];
    tank.setPosition(
      sx + (this.rng() - 0.5) * 10,
      sz + (this.rng() - 0.5) * 10,
      team === 'A' ? Math.PI : 0
    );
    tank.dataId = dataId;
    tank.kills = 0; tank.deaths = 0; tank.score = 0;
    tank.onDestroyed = (killer, detonation) => this._onTankDestroyed(tank, killer, detonation);
    tank.onDamaged = (shooter, results) => this._onTankDamaged(tank, shooter, results);
    this.tanks.push(tank);
    return tank;
  }

  /* ================= 事件 ================= */
  _onTankDestroyed(tank, killer, detonation) {
    tank.deaths++;
    // 击杀与助攻
    if (killer && killer.team !== tank.team) {
      killer.kills++;
      killer.score += 70;
      if (killer.isPlayer) {
        this.playerStats.kills++;
        this.playerStats.score += 700;
        this.cb.toast?.(`+700 击毁 ${tank.name}`);
        this.cb.hitFeedback?.('kill');
      }
      this.tickets[tank.team] = Math.max(0, this.tickets[tank.team] - 60);
    }
    for (const [uid, dmg] of tank.damageBy) {
      if (killer && uid === killer.uid) continue;
      const assister = this.tanks.find((t) => t.uid === uid);
      if (assister && assister.team !== tank.team && dmg > 20) {
        assister.score += 25;
        if (assister.isPlayer) {
          this.playerStats.assists++;
          this.playerStats.score += 200;
          this.cb.toast?.(`+200 助攻`);
        }
      }
    }
    this.cb.killFeed?.(killer, tank, detonation);

    if (tank.isPlayer) {
      this.playerStats.deaths++;
      this.cb.playerDestroyed?.(killer, this.playerLives > 0);
    } else {
      // AI 重生排队
      if (this.pool[tank.team] > 0) {
        this.pool[tank.team]--;
        this.respawnQueue.push({ team: tank.team, time: 9, name: tank.name, dataId: TANK_LIST[(this.rng() * 4) | 0] });
      }
    }
  }

  _onTankDamaged(tank, shooter, results) {
    if (shooter && shooter.isPlayer && tank.team !== 'A') {
      // 玩家打中敌人 → 命中反馈
      if (results.result === 'pen') {
        this.playerStats.damage += results.dmg || 0;
        this.playerStats.score += Math.round((results.dmg || 0) * 3);
        this.cb.hitFeedback?.('pen', results);
      } else if (results.result === 'ricochet') this.cb.hitFeedback?.('ricochet', results);
      else if (results.result === 'nonpen') this.cb.hitFeedback?.('nonpen', results);
      else if (results.result === 'trackhit') this.cb.hitFeedback?.('track', results);
      else if (results.result === 'splash') this.cb.hitFeedback?.('splash', results);
    }
    if (tank.isPlayer && shooter && shooter !== tank) {
      this.cb.playerDamaged?.(shooter, results);
    }
  }

  onShellHit(/* shell, hit, result */) { /* 保留接口 */ }

  /** 玩家重生 */
  respawnPlayer() {
    if (this.playerLives <= 0 || this.ended) return false;
    this.playerLives--;
    const old = this.playerTank;
    const dataId = old.dataId;
    // 旧车保留为残骸
    this.playerTank = this._createTank({
      dataId, team: 'A', name: '车长(你)', isPlayer: true, spawnIndex: (this.rng() * 3) | 0,
    });
    return true;
  }

  /* ================= 主循环 ================= */
  update(dt) {
    if (this.ended) return;
    this.time -= dt;

    for (const c of this.controllers) c.update(dt);
    for (const t of this.tanks) t.update(dt);
    this.ctx.projectiles.update(dt);

    this._updateCapture(dt);
    this._updateSpotting(dt);
    this._updateRespawns(dt);
    this._checkEnd();
  }

  _updateCapture(dt) {
    const cap = this.cap;
    let nA = 0, nB = 0;
    for (const t of this.tanks) {
      if (!t.alive) continue;
      if (Math.hypot(t.pos.x - cap.x, t.pos.z - cap.z) < cap.r) {
        if (t.team === 'A') nA++; else nB++;
      }
    }
    let rate = 0;
    if (nA > 0 && nB === 0) rate = 10 * Math.min(nA, 3);
    else if (nB > 0 && nA === 0) rate = -10 * Math.min(nB, 3);
    cap.contested = nA > 0 && nB > 0;
    const oldOwner = cap.owner;
    cap.progress = clamp(cap.progress + rate * dt, -100, 100);
    if (cap.progress >= 100) cap.owner = 'A';
    else if (cap.progress <= -100) cap.owner = 'B';
    else if (Math.abs(cap.progress) < 55) cap.owner = null;

    if (cap.owner !== oldOwner) {
      if (cap.owner === 'A') {
        this.cb.centerMsg?.('已占领 A 点！', '我方开始消耗敌方票数');
        // 玩家在圈内得占领分
        if (this.playerTank.alive && Math.hypot(this.playerTank.pos.x - cap.x, this.playerTank.pos.z - cap.z) < cap.r) {
          this.playerStats.capture++;
          this.playerStats.score += 600;
          this.cb.toast?.('+600 占领据点');
        }
      } else if (cap.owner === 'B') {
        this.cb.centerMsg?.('敌方占领了 A 点', '夺回据点阻止票数流失！');
      }
    }

    // 票数流失
    if (cap.owner === 'A') this.tickets.B = Math.max(0, this.tickets.B - 6.5 * dt);
    else if (cap.owner === 'B') this.tickets.A = Math.max(0, this.tickets.A - 6.5 * dt);

    // 状态文本
    cap.statusText = cap.contested ? '据点争夺中！'
      : cap.owner === 'A' ? '我方控制据点'
      : cap.owner === 'B' ? '敌方控制据点'
      : (nA > 0 ? '占领中…' : nB > 0 ? '敌方正在占领…' : '');
  }

  _updateSpotting(dt) {
    this._spotAcc -= dt;
    for (const t of this.tanks) {
      if (t.spotTimer > 0) t.spotTimer -= dt;
    }
    if (this._spotAcc > 0) return;
    this._spotAcc = 0.35;
    const eyeA = new THREE.Vector3();
    const eyeB = new THREE.Vector3();
    for (const enemy of this.tanks) {
      if (enemy.team === 'A' || !enemy.alive) continue;
      let seen = false;
      for (const ally of this.tanks) {
        if (ally.team !== 'A' || !ally.alive) continue;
        const d = ally.pos.distanceTo(enemy.pos);
        if (d > 750) continue;
        eyeA.set(ally.pos.x, ally.pos.y + 2.6, ally.pos.z);
        eyeB.set(enemy.pos.x, enemy.pos.y + 2.2, enemy.pos.z);
        if (this.ctx.world.lineOfSight(eyeA, eyeB)) { seen = true; break; }
      }
      if (seen) enemy.spotTimer = Math.max(enemy.spotTimer, 3.5);
      enemy.spotted = enemy.spotTimer > 0;
    }
  }

  _updateRespawns(dt) {
    for (const r of this.respawnQueue) r.time -= dt;
    const ready = this.respawnQueue.filter((r) => r.time <= 0);
    this.respawnQueue = this.respawnQueue.filter((r) => r.time > 0);
    for (const r of ready) {
      const names = r.team === 'A' ? AI_NAMES_A : AI_NAMES_B;
      const t = this._createTank({
        dataId: r.dataId, team: r.team,
        name: names[(this.rng() * names.length) | 0] + '·' + ((this.rng() * 90 + 10) | 0),
        spawnIndex: (this.rng() * 4) | 0,
      });
      this.controllers.push(new AIController(this.ctx, t, (this.rng() * 10000) | 0));
    }
  }

  _aliveCount(team) {
    let n = 0;
    for (const t of this.tanks) if (t.team === team && t.alive) n++;
    return n;
  }

  _checkEnd() {
    let winner = null, reason = '';
    if (this.tickets.A <= 0) { winner = 'B'; reason = '我方票数耗尽'; }
    else if (this.tickets.B <= 0) { winner = 'A'; reason = '敌方票数耗尽'; }
    else if (this.time <= 0) {
      winner = this.tickets.A >= this.tickets.B ? 'A' : 'B';
      reason = '战斗时间结束';
    } else {
      const aAlive = this._aliveCount('A');
      const bAlive = this._aliveCount('B');
      const aQueued = this.respawnQueue.filter(r => r.team === 'A').length;
      const bQueued = this.respawnQueue.filter(r => r.team === 'B').length;
      const playerCanRespawn = !this.playerTank.alive && this.playerLives > 0;
      if (aAlive === 0 && aQueued === 0 && this.pool.A <= 0 && !playerCanRespawn) { winner = 'B'; reason = '我方部队全灭'; }
      else if (bAlive === 0 && bQueued === 0 && this.pool.B <= 0) { winner = 'A'; reason = '敌方部队全灭'; }
    }
    if (winner) {
      this.ended = true;
      this.cb.end?.(winner, reason, this.playerStats);
    }
  }

  dispose() {
    for (const t of this.tanks) t.dispose();
    this.tanks.length = 0;
    this.controllers.length = 0;
    this.ctx.projectiles.clear();
  }
}
