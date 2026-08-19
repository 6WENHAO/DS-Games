// ---------------------------------------------------------------------------
// 比赛规则：回合流程、经济、炸弹拆除、半场交换、加时、死斗模式
// ---------------------------------------------------------------------------

import { ECONOMY, WEAPONS, GRENADES, lossBonus } from './weapondata.js';
import { emptyInventory, initWeaponState, selectSlot, giveWeapon, refillAmmo, totalGrenades } from './weapons.js';
import { v3, vdistXZ, vdist, clamp, rnd, rndPick, rndInt } from '../core/math.js';

export const PHASE = {
  WARMUP: 'warmup',
  FREEZE: 'freeze',
  LIVE: 'live',
  OVER: 'over',
  HALFTIME: 'halftime',
  GAMEOVER: 'gameover',
};

export const DEFAULT_RULES = {
  mode: 'bomb',            // bomb | dm
  maxRounds: 24,           // MR12：先到 13 胜
  freezeTime: 6,
  buyTime: 20,
  roundTime: 115,
  bombTimer: 40,
  plantTime: 3.2,
  defuseKit: 5,
  defuseNoKit: 10,
  overtime: true,
  overtimeRounds: 6,
  overtimeMoney: 10000,
  roundEndDelay: 5.5,
  warmupTime: 12,
  friendlyFire: false,
  dmTime: 600,
  dmRespawn: 3,
  startMoney: 800,
  maxMoney: 16000,
};

export class Match {
  constructor(game, rules = {}) {
    this.game = game;
    this.rules = Object.assign({}, DEFAULT_RULES, rules);
    this.mode = this.rules.mode;
    this.phase = PHASE.WARMUP;
    this.timer = this.rules.warmupTime;
    this.round = 0;
    this.score = { t: 0, ct: 0 };
    this.lossStreak = { t: 0, ct: 0 };
    this.firstHalf = true;
    this.overtimeNum = 0;
    this.bombPlanted = false;
    this.bombPos = null;
    this.bombTimeLeft = 0;
    this.bombCarrier = null;
    this.bombDropped = null;     // {pos}
    this.defuser = null;
    this.defuseTime = 0;
    this.planter = null;
    this.plantTimer = 0;
    this.lastBeep = 0;
    this.beepInterval = 1;
    this.roundWinner = null;
    this.roundReason = '';
    this.roundEndTime = 0;
    this.mvp = null;
    this.matchOver = false;
    this.winnerTeam = null;
    this.history = [];
    this.startedAt = 0;
  }

  get roundsToWin() {
    if (this.overtimeNum > 0) {
      return Math.floor(this.rules.maxRounds / 2) + 1 + this.overtimeNum * (this.rules.overtimeRounds / 2 + 0.5);
    }
    return Math.floor(this.rules.maxRounds / 2) + 1;
  }

  get halfRounds() { return Math.floor(this.rules.maxRounds / 2); }

  get inBuyTime() {
    if (this.phase === PHASE.FREEZE) return true;
    if (this.phase === PHASE.LIVE) return this.liveTime < this.rules.buyTime;
    if (this.phase === PHASE.WARMUP) return true;
    return false;
  }

  get displayTime() {
    if (this.bombPlanted && this.phase === PHASE.LIVE) return this.bombTimeLeft;
    return Math.max(0, this.timer);
  }

  // ------------------------- 回合流程 --------------------------------------

  startWarmup() {
    this.phase = PHASE.WARMUP;
    this.timer = this.rules.warmupTime;
    this.game.respawnAll(true);
    this.game.notify('热身回合 — 按 B 购买，开始前无限复活');
  }

  startRound() {
    const g = this.game;
    this.round++;
    this.phase = PHASE.FREEZE;
    this.timer = this.rules.freezeTime;
    this.liveTime = 0;
    this.bombPlanted = false;
    this.bombPos = null;
    this.bombDropped = null;
    this.bombTimeLeft = this.rules.bombTimer;
    this.defuser = null;
    this.defuseTime = 0;
    this.planter = null;
    this.plantTimer = 0;
    this.roundWinner = null;
    this.roundReason = '';
    g.effects.clear();
    g.grenades.clear();
    g.fireOwners.length = 0;
    g.droppedWeapons.length = 0;
    g.killfeed.length = 0;
    g.respawnAll(false);
    this.giveBomb();
    g.assignRoles();
    for (const p of g.players) if (p.bot) p.bot.resetForRound();
    g.audio.play('round_start', { volume: 0.7 });
    g.notify(`第 ${this.round} 回合 — ${this.mode === 'bomb' ? '炸弹拆除' : '死斗'}`);
    g.onRoundStart();
  }

  giveBomb() {
    if (this.mode !== 'bomb') return;
    const ts = this.game.players.filter((p) => p.team === 't' && p.alive);
    if (!ts.length) return;
    for (const p of ts) p.inv.c4 = false;
    // 优先给真人玩家（如果是 T）
    const human = ts.find((p) => p.isLocal);
    const carrier = human && rnd() < 0.5 ? human : rndPick(ts);
    carrier.inv.c4 = true;
    this.bombCarrier = carrier;
    if (carrier.isLocal) this.game.notify('你拿到了 C4 — 到包点按住 E 安放');
  }

  endRound(winner, reason) {
    if (this.phase === PHASE.OVER || this.phase === PHASE.GAMEOVER) return;
    const g = this.game;
    this.phase = PHASE.OVER;
    this.roundWinner = winner;
    this.roundReason = reason;
    this.timer = this.rules.roundEndDelay;
    this.score[winner]++;
    this.history.push({ round: this.round, winner, reason });

    // 经济结算
    this.payout(winner, reason);

    // MVP：本回合击杀最多者
    let best = null;
    for (const p of g.players) {
      if (p.team !== winner) continue;
      if (!best || p.roundKills > best.roundKills) best = p;
    }
    if (reason === 'defuse' && this.lastDefuser) best = this.lastDefuser;
    if (reason === 'explode' && this.lastPlanter) best = this.lastPlanter;
    if (best) { best.mvps++; this.mvp = best; }

    const names = { t: '恐怖分子', ct: '反恐精英' };
    const reasons = {
      elim: '全歼对手', explode: '炸弹爆炸', defuse: '成功拆除炸弹',
      time: '时间耗尽，守点成功', surrender: '对手认输',
    };
    g.notify(`${names[winner]}获胜 — ${reasons[reason] || ''}`, 3.5, winner);
    g.audio.play(winner === 'ct' ? 'round_win_ct' : 'round_win_t', { volume: 0.8 });
    if (this.mvp) g.audio.play('mvp', { volume: 0.5 });
    g.onRoundEnd(winner, reason);
  }

  payout(winner, reason) {
    const loser = winner === 't' ? 'ct' : 't';
    const eco = ECONOMY;
    let winReward = eco.winReward;
    if (reason === 'defuse') winReward = eco.winByDefuse;
    if (reason === 'explode') winReward = eco.winByBombCT;
    for (const p of this.game.players) {
      if (p.team === winner) p.addMoney(winReward, this.rules.maxMoney);
    }
    this.lossStreak[loser] = Math.min(4, this.lossStreak[loser] + 1);
    this.lossStreak[winner] = Math.max(0, this.lossStreak[winner] - 1);
    const bonus = eco.lossBonusTiers[this.lossStreak[loser] - 1] || eco.lossBonusTiers[0];
    for (const p of this.game.players) {
      if (p.team === loser) {
        let amt = bonus;
        // T 输了但下了包，全队额外奖励
        if (loser === 't' && this.bombPlanted) amt += eco.bombPlantTeamReward;
        p.addMoney(amt, this.rules.maxMoney);
      }
    }
  }

  swapSides() {
    const g = this.game;
    const tmp = this.score.t;
    this.score.t = this.score.ct;
    this.score.ct = tmp;
    const ls = this.lossStreak.t;
    this.lossStreak.t = this.lossStreak.ct;
    this.lossStreak.ct = ls;
    for (const p of g.players) {
      p.setTeam(p.team === 't' ? 'ct' : 't');
      p.money = this.overtimeNum > 0 ? this.rules.overtimeMoney : this.rules.startMoney;
      p.armor = 0; p.helmet = false;
      p.inv.kit = false;
    }
    this.firstHalf = !this.firstHalf;
    g.notify('半场交换！双方交换阵营', 4);
    g.onSwapSides();
  }

  checkMatchEnd() {
    const need = this.roundsToWin;
    const played = this.score.t + this.score.ct;
    if (this.score.t >= need) return 't';
    if (this.score.ct >= need) return 'ct';
    if (played >= this.rules.maxRounds + this.overtimeNum * this.rules.overtimeRounds) {
      if (this.score.t === this.score.ct) {
        if (this.rules.overtime) return null;   // 进入加时
        return 'draw';
      }
      return this.score.t > this.score.ct ? 't' : 'ct';
    }
    return null;
  }

  gameOver(winner) {
    this.phase = PHASE.GAMEOVER;
    this.matchOver = true;
    this.winnerTeam = winner;
    const names = { t: '恐怖分子', ct: '反恐精英', draw: '双方' };
    this.game.notify(`比赛结束！${names[winner] || ''}获胜 ${this.score.t} : ${this.score.ct}`, 10);
    this.game.onGameOver(winner);
  }

  // ------------------------- 每帧 ------------------------------------------

  update(dt) {
    const g = this.game;
    if (this.phase === PHASE.GAMEOVER) return;

    if (this.mode === 'dm') { this.updateDM(dt); return; }

    if (this.phase === PHASE.WARMUP) {
      this.timer -= dt;
      if (this.timer <= 0) { this.score.t = 0; this.score.ct = 0; this.round = 0; this.startRound(); }
      return;
    }
    if (this.phase === PHASE.FREEZE) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = PHASE.LIVE;
        this.timer = this.rules.roundTime;
        this.liveTime = 0;
        g.audio.play('ui_click', { volume: 0.4 });
        g.notify('回合开始！', 1.2);
        for (const p of g.players) if (p.isBot && p.bot) p.bot.chooseObjective();
      }
      return;
    }
    if (this.phase === PHASE.OVER) {
      this.timer -= dt;
      if (this.timer <= 0) {
        const w = this.checkMatchEnd();
        if (w) { this.gameOver(w); return; }
        const played = this.score.t + this.score.ct;
        const totalRegular = this.rules.maxRounds;
        if (played === this.halfRounds) { this.swapSides(); }
        else if (played === totalRegular && this.score.t === this.score.ct && this.rules.overtime) {
          this.overtimeNum++;
          for (const p of g.players) p.money = this.rules.overtimeMoney;
          g.notify(`进入加时赛 OT${this.overtimeNum}！`, 4);
          this.swapSides();
        } else if (this.overtimeNum > 0 &&
                   (played - totalRegular) % this.rules.overtimeRounds === this.rules.overtimeRounds / 2) {
          this.swapSides();
        }
        this.startRound();
      }
      return;
    }

    // ---- LIVE ----
    this.liveTime += dt;
    if (!this.bombPlanted) {
      this.timer -= dt;
      if (this.timer <= 0) { this.endRound('ct', 'time'); return; }
      if (this.timer < 10.5 && this.timer + dt >= 10.5) g.audio.play('ten_seconds', { volume: 0.6 });
    } else {
      this.bombTimeLeft -= dt;
      // 滴答加速
      const frac = this.bombTimeLeft / this.rules.bombTimer;
      this.beepInterval = clamp(frac * 1.05 + 0.12, 0.12, 1.05);
      this.lastBeep += dt;
      if (this.lastBeep >= this.beepInterval) {
        this.lastBeep = 0;
        g.audio.play('c4_beep', { pos: this.bombPos ? this.bombPos.slice() : undefined, volume: 0.65 });
      }
      if (this.bombTimeLeft <= 0) {
        this.explodeBomb();
        return;
      }
    }

    // 拆包进度
    if (this.defuser) {
      const d = this.defuser;
      const ok = d.alive && this.bombPos && vdistXZ(d.pos, this.bombPos) < 1.7 &&
                 d.team === 'ct' && Math.hypot(d.vel[0], d.vel[2]) < 1.2;
      if (!ok) this.abortDefuse();
      else {
        this.defuseTime += dt;
        d.defuseProgress = this.defuseTime / this.defuseTotal;
        if (this.defuseTime >= this.defuseTotal) this.finishDefuse(d);
      }
    }
    // 下包进度
    if (this.planter) {
      const p = this.planter;
      const ok = p.alive && p.inv.c4 && g.world.bombsiteAt(p.pos) && p.onGround &&
                 Math.hypot(p.vel[0], p.vel[2]) < 1.2;
      if (!ok) this.abortPlant();
      else {
        this.plantTimer += dt;
        p.plantProgress = this.plantTimer / this.rules.plantTime;
        if (this.plantTimer >= this.rules.plantTime) this.finishPlant(p);
      }
    }

    // 胜负判定
    const tAlive = g.players.filter((p) => p.team === 't' && p.alive).length;
    const ctAlive = g.players.filter((p) => p.team === 'ct' && p.alive).length;
    if (tAlive === 0 && !this.bombPlanted) { this.endRound('ct', 'elim'); return; }
    if (ctAlive === 0) {
      if (!this.bombPlanted) { this.endRound('t', 'elim'); return; }
      // 包已下且 CT 全灭 -> T 直接赢
      this.endRound('t', 'explode');
      return;
    }
  }

  updateDM(dt) {
    const g = this.game;
    if (this.phase === PHASE.WARMUP) {
      this.phase = PHASE.LIVE;
      this.timer = this.rules.dmTime;
      g.notify('死斗模式开始 — 击杀数最高者获胜', 3);
      return;
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      let bestT = 0, bestCT = 0;
      for (const p of g.players) (p.team === 't' ? bestT += p.kills : bestCT += p.kills);
      this.score.t = bestT; this.score.ct = bestCT;
      this.gameOver(bestT === bestCT ? 'draw' : (bestT > bestCT ? 't' : 'ct'));
      return;
    }
    // 重生
    for (const p of g.players) {
      if (p.alive) continue;
      p.respawnTimer = (p.respawnTimer || 0) - dt;
      if (p.respawnTimer <= 0) {
        g.respawnPlayer(p);
        p.money = 16000;
        if (p.isBot && p.bot) p.bot.bought = false;
      }
    }
    let t = 0, ct = 0;
    for (const p of g.players) (p.team === 't' ? t += p.kills : ct += p.kills);
    this.score.t = t; this.score.ct = ct;
  }

  // ------------------------- 炸弹 ------------------------------------------

  tryPlant(p, hold) {
    if (this.mode !== 'bomb' || this.bombPlanted || this.phase !== PHASE.LIVE) return false;
    if (!p.alive || p.team !== 't' || !p.inv.c4) return false;
    if (!this.game.world.bombsiteAt(p.pos)) {
      if (p.isLocal && !this._warnedSite) {
        this._warnedSite = true;
        this.game.notify('必须在包点内才能安放炸弹');
        setTimeout(() => { this._warnedSite = false; }, 2500);
      }
      return false;
    }
    if (!hold) { this.abortPlant(); return false; }
    if (this.planter !== p) {
      this.planter = p;
      this.plantTimer = 0;
      this.game.audio.play('c4_plant', p.isLocal ? {} : { pos: p.pos.slice() });
      if (p.isLocal) this.game.notify('正在安放炸弹…');
    }
    return true;
  }

  abortPlant() {
    if (this.planter) {
      this.planter.plantProgress = 0;
      this.planter = null;
      this.plantTimer = 0;
    }
  }

  finishPlant(p) {
    const g = this.game;
    this.bombPlanted = true;
    this.planter = null;
    this.lastPlanter = p;
    p.plantProgress = 0;
    p.inv.c4 = false;
    const gy = g.world.groundHeight(p.pos[0], p.pos[1] + 1, p.pos[2]);
    this.bombPos = [p.pos[0], gy === -Infinity ? p.pos[1] : gy, p.pos[2]];
    this.bombTimeLeft = this.rules.bombTimer;
    this.bombSite = g.world.bombsiteAt(p.pos);
    p.addMoney(ECONOMY.bombPlantReward, this.rules.maxMoney);
    p.score += 2;
    g.audio.play('bomb_planted_alarm', { volume: 0.8 });
    g.notify(`炸弹已在 ${this.bombSite ? this.bombSite.name : ''} 点安放！`, 3, 't');
    g.radio(p, 'radio_bombdown', 0);
    if (p.active === 'c4') selectSlot(p, p.inv.primary ? 'primary' : 'secondary', g.time);
    for (const b of g.players) if (b.bot) { b.bot.holdSpot = null; b.bot.chooseObjective(); }
  }

  tryDefuse(p, hold) {
    if (!this.bombPlanted || this.phase !== PHASE.LIVE) return false;
    if (!p.alive || p.team !== 'ct' || !this.bombPos) return false;
    if (vdistXZ(p.pos, this.bombPos) > 1.7) { if (this.defuser === p) this.abortDefuse(); return false; }
    if (!hold) { if (this.defuser === p) this.abortDefuse(); return false; }
    if (this.defuser !== p) {
      this.defuser = p;
      this.defuseTime = 0;
      this.defuseTotal = p.inv.kit ? this.rules.defuseKit : this.rules.defuseNoKit;
      this._defuseSound = this.game.audio.play('c4_defuse_start', p.isLocal ? { loop: true } : { pos: p.pos.slice(), loop: true });
      if (p.isLocal) this.game.notify(`正在拆除炸弹…（${this.defuseTotal} 秒${p.inv.kit ? '，有拆弹器' : '，无拆弹器'}）`);
    }
    return true;
  }

  abortDefuse() {
    if (this._defuseSound) { try { this._defuseSound.stop(); } catch (e) {} this._defuseSound = null; }
    if (this.defuser) {
      this.defuser.defuseProgress = 0;
      if (this.defuseTime > 0.4) this.game.audio.play('c4_defuse_abort', { pos: this.defuser.pos.slice() });
      this.defuser = null;
    }
    this.defuseTime = 0;
  }

  finishDefuse(p) {
    if (this._defuseSound) { try { this._defuseSound.stop(); } catch (e) {} this._defuseSound = null; }
    p.defuseProgress = 0;
    this.defuser = null;
    this.lastDefuser = p;
    p.addMoney(ECONOMY.defuseReward, this.rules.maxMoney);
    p.score += 2;
    this.game.audio.play('c4_defuse_done', { volume: 0.9 });
    this.endRound('ct', 'defuse');
  }

  explodeBomb() {
    const g = this.game;
    const pos = this.bombPos;
    g.effects.explosion([pos[0], pos[1] + 0.4, pos[2]], 14, 2.4);
    g.audio.play('c4_explode', { volume: 1 });
    g.shake(pos, 3.2, 60);
    for (const p of g.players) {
      if (!p.alive) continue;
      const d = vdist(p.pos, pos);
      if (d > 16) continue;
      const dmg = 500 * Math.pow(1 - clamp(d / 16, 0, 1), 1.2);
      g.applyDamage(p, this.lastPlanter, dmg, 'chest', { name: 'C4', nameCN: 'C4 炸弹', class: 'bomb', armorPen: 1, killAward: 0 }, p.pos.slice(), 'bomb');
    }
    this.bombPlanted = false;
    this.endRound('t', 'explode');
  }

  /** 玩家死亡时的规则处理（掉包等） */
  onDeath(victim) {
    if (victim.inv && victim.inv.c4) {
      victim.inv.c4 = false;
      this.bombDropped = { pos: [victim.pos[0], victim.pos[1] + 0.1, victim.pos[2]] };
      this.game.notify('C4 掉落！', 2, 't');
    }
    if (this.defuser === victim) this.abortDefuse();
    if (this.planter === victim) this.abortPlant();
  }

  /** 有人捡起掉落的 C4 */
  tryPickupBomb(p) {
    if (!this.bombDropped || p.team !== 't' || !p.alive) return false;
    if (vdist(p.pos, this.bombDropped.pos) > 1.6) return false;
    p.inv.c4 = true;
    this.bombDropped = null;
    this.bombCarrier = p;
    this.game.audio.play('c4_pickup', p.isLocal ? {} : { pos: p.pos.slice() });
    if (p.isLocal) this.game.notify('已拾取 C4');
    return true;
  }
}
