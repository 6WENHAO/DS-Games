// ---------------------------------------------------------------------------
// Game：把渲染、物理、武器、AI、规则、UI 串起来的主控
// ---------------------------------------------------------------------------

import { Renderer } from '../render/renderer.js';
import { ModelLib, drawCharacter, prepareParts, hexToLinear, buildHands } from '../render/models.js';
import { World, surfaceInfo } from './world.js';
import { NavMesh } from './navmesh.js';
import { Effects } from './effects.js';
import { GrenadeSystem } from './grenades.js';
import { Player, TEAM_COLORS } from './player.js';
import { BotBrain, DIFFICULTY, botName } from './bots.js';
import { Match, PHASE } from './match.js';
import { getMap } from './maps/index.js';
import { AudioSystem } from '../audio/audio.js';
import { Input, BINDS, anyDown, anyPressed } from '../core/input.js';
import { HUD } from '../ui/hud.js';
import { Menus, loadSettings, saveSettings } from '../ui/menu.js';
import {
  WEAPONS, GRENADES, GEAR, ECONOMY, hitgroupMultiplier, armorPenetratedDamage,
} from './weapondata.js';
import {
  activeId, activeDef, tryFire, requestReload, selectSlot, giveWeapon, nextGrenadeSlot,
  currentSpread, initWeaponState, emptyInventory, totalGrenades, refillAmmo, ammoText,
} from './weapons.js';
import { MOVE, unstick, probeGround } from './movement.js';
import {
  v3, vadd, vsub, vscale, vnorm, vdot, vcross, vdist, vdistXZ, clamp, lerp, damp, rnd, rndRange,
  rndPick, rndInt, DEG, TAU, anglesToDir, m4, m4compose, m4mul, m4identity, angleDelta, gauss,
} from '../core/math.js';

const MODE_RULES = {
  competitive: { mode: 'bomb', maxRounds: 24, roundTime: 115, freezeTime: 8, warmupTime: 10 },
  casual: { mode: 'bomb', maxRounds: 16, roundTime: 135, freezeTime: 6, warmupTime: 8, startMoney: 1000 },
  deathmatch: { mode: 'dm', dmTime: 420, dmRespawn: 2.5, warmupTime: 0 },
};

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.headless = !!opts.headless;
    if (this.headless) {
      // 无渲染无 DOM 模式：用于 Node 端逻辑自测
      this.renderer = makeStubRenderer();
      this.lib = null;
      this.audio = makeStubAudio();
      this.input = makeStubInput();
      this.settings = Object.assign({}, DEFAULT_SETTINGS_FALLBACK);
      this.hud = makeStubHud();
      this.menus = makeStubMenus();
    } else {
      this.renderer = new Renderer(canvas);
      this.lib = new ModelLib(this.renderer.gl);
      this.audio = new AudioSystem();
      this.input = new Input(canvas);
      this.settings = loadSettings();
      this.hud = new HUD(this);
      this.menus = new Menus(this);
    }

    this.players = [];
    this.localPlayer = null;
    this.viewPlayer = null;
    this.world = null;
    this.nav = null;
    this.effects = null;
    this.grenades = null;
    this.match = new Match(this, MODE_RULES.competitive);
    this.mode = 'bomb';
    this.map = null;

    this.time = 0;
    this.running = false;
    this.paused = true;
    this.fps = 0;
    this.frameMs = 0;
    this._fpsAcc = 0;
    this._fpsCount = 0;
    this.camera = { pos: v3(0, 1.6, 0), yaw: 0, pitch: 0, fov: 90, roll: 0 };
    this.shakeAmount = 0;
    this.shakeTime = 0;
    this.droppedWeapons = [];
    this.fireOwners = [];
    this.killfeed = [];
    this.lights = [];
    this.spectateIdx = 0;
    this.deathCamTime = 0;
    this.vm = {
      sway: [0, 0], swayVel: [0, 0], bob: 0, kick: 0, kickRot: 0,
      lastYaw: 0, lastPitch: 0, drawT: 0, reloadT: 0,
    };
    this.tSiteTarget = 'A';
    this._spotIdx = 0;
    this._handCache = new Map();
    this.applySettings();

    if (!this.headless) {
      this.input.onLockChange((locked) => {
        // 指针锁被 Esc / 切窗口释放 -> 暂停并弹出菜单。
        // _uiUnlock 表示这是我们为了让鼠标能点购买菜单而主动解锁的，不算暂停。
        if (!locked && this.running && !this.paused && !this._uiUnlock) {
          this.setPaused(true);
          this.showPauseMenu();
        }
      });
      canvas.addEventListener('mousedown', () => {
        if (this.running && this.paused && !this.menus.mainOpen && !this.menus.settingsOpen) this.setPaused(false);
      });
      window.addEventListener('resize', () => this.renderer.resize());
    }
  }

  // ======================= 初始化 / 设置 ===================================

  async init(onProgress) {
    onProgress(0.05, '生成程序化贴图…');
    await frame();
    this.renderer.init((f, t) => onProgress(0.05 + f * 0.7, t));
    onProgress(0.8, '初始化音频…');
    await frame();
    this.audio.setMasterVolume(this.settings.masterVolume);
    onProgress(0.9, '准备完成');
    await frame();
  }

  applySettings() {
    const s = this.settings;
    this.input.sensitivity = s.sensitivity;
    this.input.invertY = s.invertY;
    this.input.rawInput = s.rawInput;
    this.renderer.shadowEnabled = s.shadows;
    this.renderer.shadowStrength = s.shadowStrength;
    this.renderer.viewmodelFov = s.viewmodelFov;
    this.audio.setMasterVolume(s.masterVolume);
    this.audio.setVolume('sfx', s.sfxVolume);
    if (!this.headless) saveSettings(s);
  }

  // ======================= 开局 ===========================================

  startMatch(config) {
    const mapDef = getMap(config.map);
    const rules = Object.assign({}, MODE_RULES[config.mode] || MODE_RULES.competitive);
    if (mapDef.mode === 'dm' && rules.mode !== 'dm') Object.assign(rules, MODE_RULES.deathmatch);
    this.mode = rules.mode;
    this.loadMap(mapDef);

    this.match = new Match(this, rules);
    this.players.length = 0;
    const myTeam = config.team === 'random' ? (rnd() < 0.5 ? 't' : 'ct') : config.team;
    const skill = (DIFFICULTY[config.difficulty] || DIFFICULTY.normal).skill;
    const perTeam = this.mode === 'dm' ? Math.max(2, config.bots) : config.bots;

    const me = new Player({ name: '你', team: myTeam, isLocal: true });
    me.money = rules.startMoney || 800;
    this.players.push(me);
    this.localPlayer = me;
    this.viewPlayer = me;
    // 无头自测模式下让"本地玩家"也交给 AI 驱动
    if (this.headless) me.bot = new BotBrain(me, this, skill);

    const other = myTeam === 't' ? 'ct' : 't';
    for (let i = 0; i < perTeam; i++) {
      const b = new Player({ name: botName(), team: myTeam, isBot: true, skill: jitterSkill(skill) });
      b.money = rules.startMoney || 800;
      b.bot = new BotBrain(b, this, b.skill);
      this.players.push(b);
    }
    for (let i = 0; i < perTeam + 1; i++) {
      const b = new Player({ name: botName(), team: other, isBot: true, skill: jitterSkill(skill) });
      b.money = rules.startMoney || 800;
      b.bot = new BotBrain(b, this, b.skill);
      this.players.push(b);
    }

    this.time = 0;
    this.droppedWeapons.length = 0;
    this.fireOwners.length = 0;
    this.match.startWarmup();
    this.running = true;
    this.menus.showMain(false);
    this.menus.showSettings(false);
    this.menus.toggleBuy(false);
    this.setPaused(false);
    this.hud.notify(`${this.map.nameCN} · ${this.mode === 'dm' ? '死斗' : '炸弹拆除'} · 你是${myTeam === 't' ? '恐怖分子' : '反恐精英'}`, 4);
  }

  loadMap(mapDef) {
    this.map = mapDef;
    this.world = new World(this.renderer.gl, mapDef);
    const seeds = [...(mapDef.spawns.t || []), ...(mapDef.spawns.ct || [])]
      .map((s) => [s.pos[0], s.pos[1] + 0.05, s.pos[2]]);
    this.nav = new NavMesh(this.world, { seeds });
    this.effects = new Effects(this.world);
    this.grenades = new GrenadeSystem(this);
    this.renderer.setWorld(this.world.batches);
    this.renderer.setEnv(mapDef.sky);
    this.hud.buildRadar(mapDef);
    this.mapLights = (mapDef.lights || []).slice();
    console.log('[地图]', mapDef.id, this.world.stats, this.nav.stats);
  }

  setPaused(p) {
    this.paused = p;
    if (p) this._pauseAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.headless) return;
    const hint = document.getElementById('pause-hint');
    if (hint) hint.classList.toggle('hidden', !p || this.menus.mainOpen || this.menus.settingsOpen);
    if (p) {
      this.input.unlock();
    } else {
      this.audio.init();
      this._uiUnlock = false;
      this.input.lock();
      this.menus.showMain(false);
      this.menus.showSettings(false);
    }
  }

  /** 打开购买菜单：主动释放指针锁，让玩家能用鼠标点击 */
  openBuy() {
    this._uiUnlock = true;
    this.input.unlock();
    this.menus.toggleBuy(true);
    this.audio.play('ui_click', { bus: 'ui' });
  }

  closeBuy() {
    this.menus.toggleBuy(false);
    this.audio.play('ui_back', { bus: 'ui' });
    this._uiUnlock = false;
    if (this.running && !this.paused) this.input.lock();
  }

  // ======================= 出生 / 角色分配 =================================

  spawnPointFor(team, index) {
    const list = this.map.spawns[team] || [];
    if (!list.length) return { pos: [0, 1, 0], yaw: 0 };
    const base = list[index % list.length];
    // 避免重叠：在附近找空位
    const p = { pos: base.pos.slice(), yaw: base.yaw };
    for (let tries = 0; tries < 12; tries++) {
      let occupied = false;
      for (const o of this.players) {
        if (!o.alive) continue;
        if (vdistXZ(o.pos, p.pos) < 0.85) { occupied = true; break; }
      }
      if (!occupied) break;
      p.pos[0] = base.pos[0] + rndRange(-2.4, 2.4);
      p.pos[2] = base.pos[2] + rndRange(-2.4, 2.4);
      const gy = this.world.groundHeight(p.pos[0], base.pos[1] + 2, p.pos[2]);
      p.pos[1] = gy === -Infinity ? base.pos[1] : gy;
    }
    return p;
  }

  respawnPlayer(p) {
    const team = p.team;
    const idx = this.players.filter((x) => x.team === team).indexOf(p);
    const sp = this.spawnPointFor(team, this.mode === 'dm' ? rndInt(0, 99) : idx);
    p.spawn(sp, this.time);
    unstick(this.world, p);
    if (this.mode === 'dm') {
      // 死斗直接发满配
      if (!p.inv.primary) giveWeapon(p, p.team === 't' ? 'ak47' : 'm4a4', { autoSwitch: true });
      p.armor = 100; p.helmet = true;
      refillAmmo(p);
      p.inv.grenades = { he: 1, flash: 1 };
    }
    if (p.isBot && p.bot) p.bot.resetForRound();
  }

  respawnAll(warmup) {
    for (const p of this.players) {
      const idx = this.players.filter((x) => x.team === p.team).indexOf(p);
      const sp = this.spawnPointFor(p.team, idx);
      p.spawn(sp, this.time);
      unstick(this.world, p);
      p.respawnTimer = 0;
      if (this.mode === 'dm' || warmup) {
        if (!p.inv.primary) giveWeapon(p, p.team === 't' ? 'ak47' : 'm4a4', { autoSwitch: true });
        p.armor = 100; p.helmet = true;
        p.inv.grenades = { he: 1, flash: 1 };
        refillAmmo(p);
      }
    }
    this.spectateIdx = 0;
    this.viewPlayer = this.localPlayer;
  }

  assignRoles() {
    const sites = this.world.bombsites.map((s) => s.name);
    if (!sites.length) return;
    this.tSiteTarget = rndPick(sites);
    const ts = this.players.filter((p) => p.team === 't' && p.isBot);
    const cts = this.players.filter((p) => p.team === 'ct' && p.isBot);
    ts.forEach((p, i) => {
      // 大部分打主目标，1 个去另一边牵制
      p.bot.site = (i === ts.length - 1 && ts.length > 2 && sites.length > 1)
        ? sites.find((s) => s !== this.tSiteTarget) : this.tSiteTarget;
      p.bot.holdSpot = null;
    });
    cts.forEach((p, i) => {
      p.bot.site = sites[i % sites.length];
      p.bot.holdSpot = null;
    });
  }

  // ======================= 经济 / 购买 ====================================

  itemDef(id) { return WEAPONS[id] || GRENADES[id] || GEAR[id] || null; }

  alreadyOwns(p, id) {
    if (WEAPONS[id]) {
      if (id === 'zeus') return !!p.inv.zeus;
      const slot = WEAPONS[id].slot;
      if (slot === 'primary') return p.inv.primary === id;
      if (slot === 'secondary') return p.inv.secondary === id;
      return false;
    }
    if (GRENADES[id]) return (p.inv.grenades[id] || 0) >= (GRENADES[id].maxCarry || 1);
    if (id === 'kevlar') return p.armor > 0;
    if (id === 'kevlarhelm') return p.armor > 0 && p.helmet;
    if (id === 'defusekit') return p.inv.kit;
    return false;
  }

  canBuy(p, id) {
    const d = this.itemDef(id);
    if (!d) return false;
    if (!this.match.inBuyTime) return false;
    if (!this.world.inBuyzone(p.pos, p.team)) return false;
    if ((d.team || 'both') !== 'both' && d.team !== p.team) return false;
    if (p.money < (d.price || 0)) return false;
    if (this.alreadyOwns(p, id)) return false;
    if (GRENADES[id] && totalGrenades(p) >= 4) return false;
    if (id === 'defusekit' && p.team !== 'ct') return false;
    return true;
  }

  buy(p, id, silent) {
    if (!this.canBuy(p, id)) {
      if (!silent && p.isLocal) {
        this.audio.play('buy_fail', { bus: 'ui' });
        const d = this.itemDef(id);
        if (!this.match.inBuyTime) this.hud.notify('购买时间已结束');
        else if (!this.world.inBuyzone(p.pos, p.team)) this.hud.notify('必须在出生点购买区内');
        else if (d && p.money < d.price) this.hud.notify('金钱不足');
        else if (this.alreadyOwns(p, id)) this.hud.notify('已经拥有该装备');
      }
      return false;
    }
    const d = this.itemDef(id);
    // 换主武器时丢掉旧的
    if (WEAPONS[id] && WEAPONS[id].slot === 'primary' && p.inv.primary) this.dropWeapon(p, 'primary');
    if (WEAPONS[id] && WEAPONS[id].slot === 'secondary' && p.inv.secondary && id !== p.inv.secondary) p.inv.secondary = null;
    p.addMoney(-d.price, this.match.rules.maxMoney);
    giveWeapon(p, id, { autoSwitch: p.isLocal && WEAPONS[id] && WEAPONS[id].slot === 'primary' });
    if (!silent) this.audio.play('buy_success', { bus: 'ui' });
    if (p.isLocal) this.hud.notify(`已购买 ${d.nameCN || d.name}（-$${d.price}）`, 1.6);
    return true;
  }

  dropWeapon(p, slot) {
    const id = p.inv[slot];
    if (!id) return;
    const a = p.ammo[id] || { mag: 0, reserve: 0 };
    const dir = anglesToDir(v3(), p.yaw, 0);
    this.droppedWeapons.push({
      id, pos: [p.pos[0] + dir[0] * 0.6, p.pos[1] + 0.55, p.pos[2] + dir[2] * 0.6],
      vel: [dir[0] * 3 + p.vel[0], 1.6, dir[2] * 3 + p.vel[2]],
      yaw: p.yaw, ammo: { mag: a.mag, reserve: a.reserve }, t: 0, rest: false,
    });
    p.inv[slot] = null;
    if (p.active === slot) selectSlot(p, p.inv.primary ? 'primary' : (p.inv.secondary ? 'secondary' : 'melee'), this.time);
  }

  tryPickup(p) {
    for (let i = 0; i < this.droppedWeapons.length; i++) {
      const d = this.droppedWeapons[i];
      if (vdist(p.pos, d.pos) > 1.5) continue;
      const w = WEAPONS[d.id];
      if (!w) continue;
      const slot = w.slot === 'primary' ? 'primary' : 'secondary';
      if (p.inv[slot]) {
        if (!p.isLocal) continue;
        this.dropWeapon(p, slot);
      }
      p.inv[slot] = d.id;
      p.ammo[d.id] = { mag: d.ammo.mag, reserve: d.ammo.reserve };
      selectSlot(p, slot, this.time);
      this.droppedWeapons.splice(i, 1);
      this.audio.play('weapon_draw', p.isLocal ? {} : { pos: p.pos.slice() });
      if (p.isLocal) this.hud.notify(`拾取 ${w.nameCN}`, 1.4);
      return true;
    }
    return false;
  }

  // ======================= 伤害 / 死亡 ====================================

  surfaceSound(mat) { return surfaceInfo(mat).impact; }

  applyDamage(victim, attacker, rawDamage, hitgroup, weapon, point, cause) {
    if (!victim.alive || rawDamage <= 0) return 0;
    if (attacker && attacker !== victim && attacker.team === victim.team &&
        !this.match.rules.friendlyFire && cause !== 'fall') {
      return 0;   // 关闭友伤
    }
    const mult = hitgroupMultiplier(hitgroup);
    let dmg = rawDamage * mult;
    const res = armorPenetratedDamage(dmg, weapon.armorPen === undefined ? 1 : weapon.armorPen,
      victim.armor > 0, victim.helmet, hitgroup);
    dmg = res.damage;
    if (victim.armor > 0 && res.armorLoss > 0) {
      victim.armor = Math.max(0, victim.armor - res.armorLoss);
      if (victim.isLocal || (attacker && attacker.isLocal)) {
        this.audio.play(hitgroup === 'head' && victim.helmet ? 'hit_helmet' : 'hit_armor',
          { pos: point ? point.slice() : undefined, volume: 0.7 });
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    victim.health -= dmg;
    victim.lastAttacker = attacker;
    victim.lastDamageTime = this.time;
    if (!victim._dmgBy) victim._dmgBy = new Map();
    if (attacker && attacker !== victim) {
      victim._dmgBy.set(attacker, (victim._dmgBy.get(attacker) || 0) + dmg);
      attacker.damageDealt += dmg;
    }

    // 反馈
    if (attacker && attacker.isLocal) {
      this.hud.hit(victim.health <= 0);
      this.audio.play(hitgroup === 'head' ? 'hit_headshot' : 'hit_flesh', { volume: 0.85 });
    }
    if (victim.isLocal) {
      const ang = attacker ? Math.atan2(attacker.pos[0] - victim.pos[0], -(attacker.pos[2] - victim.pos[2])) - victim.yaw + Math.PI / 2 : null;
      this.hud.hurt(dmg, attacker ? -(angleDelta(0, Math.atan2(
        attacker.pos[2] - victim.pos[2], attacker.pos[0] - victim.pos[0]) - victim.yaw) - Math.PI / 2) : null);
      this.audio.play(rnd() < 0.5 ? 'player_pain1' : 'player_pain2', { volume: 0.8 });
      this.shakeAmount = Math.min(1.6, this.shakeAmount + dmg * 0.012);
    } else if (victim.isBot && victim.bot) {
      victim.bot.onHurt(attacker);
    }
    if (victim.health <= 0) this.kill(victim, attacker, weapon, hitgroup, cause);
    return dmg;
  }

  kill(victim, attacker, weapon, hitgroup, cause) {
    if (!victim.alive) return;
    victim.alive = false;
    victim.health = 0;
    victim.deaths++;
    victim.score -= 0;
    victim.anim.deathT = 0;
    victim.anim.deathDir = rnd() < 0.5 ? 1 : -1;
    victim.deathPos = victim.pos.slice();
    victim.respawnTimer = this.match.rules.dmRespawn || 3;
    const headshot = hitgroup === 'head';

    if (attacker && attacker !== victim) {
      attacker.kills++;
      attacker.roundKills++;
      attacker.score += 2;
      const award = weapon.killAward !== undefined ? weapon.killAward : ECONOMY.killAwardDefault;
      attacker.addMoney(award, this.match.rules.maxMoney);
      if (attacker.isLocal) {
        this.hud.center(`击杀 ${victim.name}${headshot ? '（爆头）' : ''}  +$${award}`, 1.4);
        if (attacker.roundKills >= 2) this.audio.play('killstreak', { volume: 0.5 });
      }
      if (attacker.isBot && attacker.bot) attacker.bot.target = null;
    } else if (attacker === victim || !attacker) {
      victim.addMoney(cause === 'fall' ? 0 : ECONOMY.suicidePenalty, this.match.rules.maxMoney);
    }
    // 助攻
    if (victim._dmgBy) {
      let bestAssist = null, bestDmg = 0;
      for (const [a, d] of victim._dmgBy) {
        if (a === attacker || a.team === victim.team) continue;
        if (d > bestDmg && d >= 40) { bestDmg = d; bestAssist = a; }
      }
      if (bestAssist) { bestAssist.assists++; bestAssist.score += 1; }
      victim._dmgBy.clear();
    }

    // 掉落
    if (victim.inv.primary) this.dropWeapon(victim, 'primary');
    else if (victim.inv.secondary) this.dropWeapon(victim, 'secondary');
    this.match.onDeath(victim);

    // 提示
    const wName = weapon.nameCN || weapon.name || '';
    this.hud.killFeed(attacker && attacker !== victim ? attacker.name : null,
      attacker ? attacker.team : 'ct', victim.name, victim.team, wName, headshot,
      (attacker && attacker.isLocal) || victim.isLocal);
    this.audio.play(rnd() < 0.5 ? 'player_death' : 'player_death2',
      { pos: victim.pos.slice(), volume: 0.9 });
    if (headshot && attacker && attacker.isLocal) this.audio.play('hit_headshot', { volume: 1 });

    if (victim.isLocal) {
      this.deathCamTime = 0;
      this.spectateIdx = 0;
      this.nextSpectate(0);
      this.hud.center('你被击杀了', 2);
    }
    // 队友警觉
    for (const p of this.players) {
      if (p.isBot && p.bot && p.team === victim.team && p !== victim) {
        if (vdist(p.pos, victim.pos) < 22 && attacker) p.bot.onHurt(attacker);
      }
    }
  }

  radio(player, sound, delay = 0) {
    const opts = player.isLocal ? { bus: 'voice', volume: 0.75 } : { pos: player.pos.slice(), bus: 'voice', volume: 0.55 };
    if (delay > 0) opts.delay = delay;
    this.audio.play(sound, opts);
  }

  shake(pos, amount, radius) {
    const d = vdist(this.camera.pos, pos);
    const k = clamp(1 - d / radius, 0, 1);
    this.shakeAmount = Math.min(2.5, this.shakeAmount + amount * k * k);
  }

  notify(text, dur, team) { this.hud.notify(text, dur, team); }

  onRoundStart() {
    if (this.menus.buyOpen) this.closeBuy();
    this.hud.hideBanner();
    if (this.localPlayer.isLocal) {
      this.viewPlayer = this.localPlayer;
      if (this.settings.autoBuy) this.autoBuy(this.localPlayer);
    }
  }

  onRoundEnd(winner, reason) {
    const names = { t: '恐怖分子获胜', ct: '反恐精英获胜' };
    const reasons = {
      elim: '全歼对手', explode: '炸弹爆炸', defuse: '炸弹已拆除', time: '时间耗尽',
    };
    this.hud.banner(names[winner], reasons[reason] || '', winner === 't' ? 'var(--t)' : 'var(--ct)');
    if (this.match.mvp) this.hud.notify(`本回合 MVP：${this.match.mvp.name}`, 4, winner);
  }

  onSwapSides() {
    this.viewPlayer = this.localPlayer;
    this.hud.banner('半场交换', '双方交换阵营', '#fff');
  }

  onGameOver(winner) {
    this.running = false;
    this.setPaused(true);
    this.menus.showGameOver(winner);
  }

  autoBuy(p) {
    const seq = p.team === 't'
      ? ['kevlarhelm', 'ak47', 'flash', 'he', 'smoke']
      : ['kevlarhelm', 'm4a4', 'flash', 'he', 'defusekit'];
    for (const id of seq) this.buy(p, id, true);
  }

  // ======================= 主循环 =========================================

  update(dt) {
    if (!this.running) return;
    this.time += dt;
    const me = this.localPlayer;

    // 输入 -> 本地玩家
    const cmd = this.headless ? null : this.handleLocalInput(dt);

    // 更新所有玩家
    for (const p of this.players) {
      if (p.bot) {
        const bcmd = p.bot.update(dt);
        if (this.match.phase === PHASE.FREEZE) { bcmd.forward = 0; bcmd.side = 0; bcmd.jump = false; }
        p.yaw = p.viewYaw; p.pitch = p.viewPitch;
        p.update(this, dt, bcmd);
      } else if (p === me) {
        p.update(this, dt, cmd);
      } else {
        p.update(this, dt, { forward: 0, side: 0, jump: false, duck: false, walk: false });
      }
      if (p.outOfWorld && p.alive) {
        p.outOfWorld = false;
        this.applyDamage(p, null, 999, 'chest', { name: '深渊', nameCN: '掉出地图', armorPen: 1, killAward: 0 }, p.pos.slice(), 'fall');
      }
    }

    // 火焰伤害
    this.updateFire(dt);
    // 投掷物
    this.grenades.update(dt);
    // 掉落物
    this.updateDropped(dt);
    // 特效
    this.effects.update(dt);
    // 规则
    this.match.update(dt);
    // 敌人可见性（雷达）
    this.updateSpotting(dt);

    // 相机
    this.updateCamera(dt);
    // 音频听者
    const dir = anglesToDir(v3(), this.camera.yaw, this.camera.pitch);
    this.audio.setListener(this.camera.pos, dir, [0, 1, 0]);
    // HUD
    this.hud.update(dt);
    this.input.endFrame();
  }

  updateFire(dt) {
    for (let i = this.fireOwners.length - 1; i >= 0; i--) {
      const f = this.fireOwners[i];
      if (this.time > f.until) { this.fireOwners.splice(i, 1); continue; }
    }
    for (const p of this.players) {
      if (!p.alive) continue;
      const intensity = this.effects.fireAt(p.pos);
      if (intensity > 0) {
        p.burning = 0.4;
        const src = this.fireOwners.find((f) => vdistXZ(f.pos, p.pos) < f.radius + 0.6);
        this.applyDamage(p, src ? src.owner : null, (src ? src.dps : 20) * dt * intensity, 'chest',
          { name: '燃烧', nameCN: '燃烧', class: 'fire', armorPen: 1, killAward: 300 }, p.pos.slice(), 'fire');
        if (p.isLocal && rnd() < dt * 3) this.audio.play('player_pain1', { volume: 0.4 });
      } else {
        p.burning = Math.max(0, p.burning - dt);
      }
    }
  }

  updateDropped(dt) {
    for (const d of this.droppedWeapons) {
      d.t += dt;
      if (d.rest) continue;
      d.vel[1] -= MOVE.gravity * dt;
      const step = vscale(v3(), d.vel, dt);
      const len = Math.hypot(step[0], step[1], step[2]);
      if (len > 1e-5) {
        const dir = vscale(v3(), step, 1 / len);
        const hit = this.world.traceRay(d.pos, dir, len + 0.08);
        if (hit && hit.t <= len + 0.08) {
          d.pos[0] = hit.point[0] + hit.normal[0] * 0.06;
          d.pos[1] = hit.point[1] + hit.normal[1] * 0.06;
          d.pos[2] = hit.point[2] + hit.normal[2] * 0.06;
          if (hit.normal[1] > 0.6) { d.rest = true; d.vel[0] = d.vel[1] = d.vel[2] = 0; }
          else { d.vel[1] *= -0.2; d.vel[0] *= 0.5; d.vel[2] *= 0.5; }
        } else {
          d.pos[0] += step[0]; d.pos[1] += step[1]; d.pos[2] += step[2];
        }
      }
    }
    // Bot 自动捡枪
    for (const p of this.players) {
      if (!p.alive || !p.isBot) continue;
      if (p.inv.primary) continue;
      this.tryPickup(p);
      if (this.mode === 'bomb') this.match.tryPickupBomb(p);
    }
    if (this.droppedWeapons.length > 24) this.droppedWeapons.splice(0, this.droppedWeapons.length - 24);
  }

  updateSpotting(dt) {
    // 分摊到多帧：每帧检查若干敌人
    const me = this.localPlayer;
    const mates = this.players.filter((p) => p.alive && p.team === me.team);
    const enemies = this.players.filter((p) => p.alive && p.team !== me.team);
    if (!enemies.length) return;
    const checks = Math.min(enemies.length, 3);
    for (let k = 0; k < checks; k++) {
      const e = enemies[(this._spotIdx + k) % enemies.length];
      let seen = false;
      for (const m of mates) {
        const eye = m.eye(v3());
        const tgt = [e.pos[0], e.pos[1] + e.height * 0.7, e.pos[2]];
        if (vdist(eye, tgt) > (m.isLocal ? 95 : 55)) continue;
        if (!this.world.visible(eye, tgt)) continue;
        if (this.effects.smokeOcclusion(eye, tgt) > 0.6) continue;
        // 队友需要大致朝向；本人用视锥
        const to = vnorm(v3(), vsub(v3(), tgt, eye));
        const view = anglesToDir(v3(), m.yaw, m.pitch);
        if (vdot(view, to) < (m.isLocal ? Math.cos(this.camera.fov * DEG * 0.62) : 0.15)) continue;
        seen = true; break;
      }
      if (seen) e.spottedUntil = this.time + 3.0;
    }
    this._spotIdx = (this._spotIdx + checks) % enemies.length;
  }

  isSpotted(p) { return (p.spottedUntil || 0) > this.time; }

  // ======================= 本地输入 =======================================

  handleLocalInput(dt) {
    const p = this.localPlayer;
    const inp = this.input;
    const cmd = { forward: 0, side: 0, jump: false, duck: false, walk: false };
    const menus = this.menus;

    // 面板类按键（即使暂停也响应）
    // 注意：浏览器按 Esc 会自己释放指针锁，onLockChange 已经把游戏暂停并弹出菜单了。
    // 所以这里只用 Esc 关面板，并加 350ms 防抖，避免"按一下 Esc 立刻又回到游戏"。
    if (inp.pressed('Escape')) {
      if (menus.buyOpen) this.closeBuy();
      else if (menus.settingsOpen) menus.showSettings(false);
      else if (this.paused) {
        if (performance.now() - (this._pauseAt || 0) > 350) {
          menus.showMain(false);
          this.setPaused(false);
        }
      } else { this.setPaused(true); this.showPauseMenu(); }
    }
    if (this.paused) { inp.takeLook(); return cmd; }

    // 记分板
    const sbDown = anyDown(inp, BINDS.scoreboard);
    if (sbDown !== this._sbShown) { this._sbShown = sbDown; menus.showScoreboard(sbDown); }

    // 购买菜单（打开时主动解锁指针，这样鼠标能点击选项）
    if (anyPressed(inp, BINDS.buy)) {
      if (menus.buyOpen) this.closeBuy();
      else if (this.match.inBuyTime && this.world.inBuyzone(p.pos, p.team)) {
        this.openBuy();
      } else {
        this.audio.play('buy_fail', { bus: 'ui' });
        this.hud.notify(this.match.inBuyTime ? '必须在购买区内' : '购买时间已结束');
      }
    }
    if (menus.buyOpen) {
      // 购买时间结束就自动关闭，避免指针一直解锁着
      if (!this.match.inBuyTime) {
        this.closeBuy();
        this.hud.notify('购买时间结束');
      } else {
        for (let i = 1; i <= 9; i++) if (inp.pressed('Digit' + i)) menus.buyKey(i);
        if (inp.pressed('Backspace')) menus.backBuyLevel();
        inp.takeLook();
        return cmd;
      }
    }

    // 视角
    const zoomScale = p.wpn.zoom > 0 ? (p.wpn.zoom === 1 ? 0.42 : 0.22) : 1;
    const look = inp.takeLook();
    if (p.alive) {
      p.viewYaw += look.yaw * zoomScale;
      p.viewPitch = clamp(p.viewPitch + look.pitch * zoomScale, -89 * DEG, 89 * DEG);
    } else {
      // 观战自由转视角
      this.specYaw = (this.specYaw || this.camera.yaw) + look.yaw;
      this.specPitch = clamp((this.specPitch || 0) + look.pitch, -80 * DEG, 80 * DEG);
      if (inp.btnPressed(0)) this.nextSpectate(1);
      if (inp.btnPressed(2)) this.nextSpectate(-1);
      return cmd;
    }

    // 移动
    cmd.forward = (anyDown(inp, BINDS.forward) ? 1 : 0) - (anyDown(inp, BINDS.back) ? 1 : 0);
    cmd.side = (anyDown(inp, BINDS.right) ? 1 : 0) - (anyDown(inp, BINDS.left) ? 1 : 0);
    cmd.jump = anyDown(inp, BINDS.jump);
    cmd.duck = anyDown(inp, BINDS.duck);
    cmd.walk = anyDown(inp, BINDS.walk);
    if (this.match.phase === PHASE.FREEZE) { cmd.forward = 0; cmd.side = 0; cmd.jump = false; }

    // 切枪
    if (inp.pressed('Digit1')) this.switchTo('primary');
    if (inp.pressed('Digit2')) this.switchTo('secondary');
    if (inp.pressed('Digit3')) this.switchTo('melee');
    if (inp.pressed('Digit4')) { const s = nextGrenadeSlot(p); if (s) this.switchTo(s); }
    if (inp.pressed('Digit5')) this.switchTo('c4');
    if (anyPressed(inp, BINDS.zeus)) this.switchTo('zeus');
    if (anyPressed(inp, BINDS.lastWeapon)) this.switchTo(this._lastSlot || 'secondary');
    const wheel = inp.takeWheel();
    if (wheel) this.cycleWeapon(wheel > 0 ? 1 : -1);

    // 换弹
    if (anyPressed(inp, BINDS.reload)) {
      if (requestReload(p, this.time)) this.audio.play('reload_start', { volume: 0.9 });
    }
    // 丢弃
    if (anyPressed(inp, BINDS.drop)) {
      if (p.active === 'primary' && p.inv.primary) this.dropWeapon(p, 'primary');
      else if (p.active === 'secondary' && p.inv.secondary) this.dropWeapon(p, 'secondary');
    }
    // 使用（拾取 / 下包 / 拆包）
    const useDown = anyDown(inp, BINDS.use);
    if (anyPressed(inp, BINDS.use)) {
      this.tryPickup(p);
      this.match.tryPickupBomb(p);
    }
    if (this.mode === 'bomb') {
      if (p.team === 't' && p.inv.c4) this.match.tryPlant(p, useDown && Math.hypot(p.vel[0], p.vel[2]) < 1.2);
      if (p.team === 'ct' && this.match.bombPlanted) this.match.tryDefuse(p, useDown);
    }

    // 开火
    const def = activeDef(p);
    const w = WEAPONS[activeId(p)];
    if (def && def.class === 'grenade') {
      if (inp.btnPressed(0)) this.throwActiveGrenade(1.0);
      else if (inp.btnPressed(2)) this.throwActiveGrenade(0.42);
    } else if (def && def.class === 'c4') {
      // C4 用 E 安放
    } else if (w) {
      const wantFire = w.auto ? inp.btn(0) : inp.btnPressed(0);
      if (wantFire && this.match.phase !== PHASE.FREEZE) tryFire(this, p, this.time, 'primary');
      if (inp.btnPressed(2) && this.match.phase !== PHASE.FREEZE) tryFire(this, p, this.time, 'secondary');
    }

    // 提示文本
    this.updateHint(p, useDown);
    return cmd;
  }

  switchTo(slot) {
    const p = this.localPlayer;
    const prev = p.active;
    if (selectSlot(p, slot, this.time)) {
      this._lastSlot = prev;
      this.vm.drawT = 1;
      this.audio.play('weapon_draw', { volume: 0.6 });
    }
  }

  cycleWeapon(dir) {
    const p = this.localPlayer;
    const order = [];
    if (p.inv.primary) order.push('primary');
    if (p.inv.secondary) order.push('secondary');
    order.push('melee');
    for (const g of Object.keys(p.inv.grenades)) if (p.inv.grenades[g] > 0) order.push('grenade:' + g);
    if (p.inv.c4) order.push('c4');
    const i = order.indexOf(p.active);
    const next = order[(i + dir + order.length) % order.length];
    if (next) this.switchTo(next);
  }

  throwActiveGrenade(power) {
    const p = this.localPlayer;
    const id = activeId(p);
    if (!GRENADES[id]) return;
    this.grenades.throwGrenade(p, id, power);
    this.vm.kick = 0.6;
    // 用完自动切枪
    if ((p.inv.grenades[id] || 0) <= 0) {
      const s = nextGrenadeSlot(p);
      this.switchTo(s || (p.inv.primary ? 'primary' : (p.inv.secondary ? 'secondary' : 'melee')));
    }
  }

  updateHint(p, useDown) {
    const m = this.match;
    let hint = '';
    if (this.mode === 'bomb') {
      if (p.team === 't' && p.inv.c4 && this.world.bombsiteAt(p.pos) && !m.bombPlanted) {
        hint = m.planter === p ? '正在安放炸弹…' : '按住 <b>E</b> 安放炸弹';
      } else if (p.team === 'ct' && m.bombPlanted && m.bombPos && vdistXZ(p.pos, m.bombPos) < 1.7) {
        hint = m.defuser === p ? '正在拆除…' : `按住 <b>E</b> 拆除炸弹（${p.inv.kit ? '5' : '10'} 秒）`;
      } else if (m.bombDropped && vdist(p.pos, m.bombDropped.pos) < 1.8 && p.team === 't') {
        hint = '按 <b>E</b> 拾取 C4';
      }
    }
    if (!hint) {
      for (const d of this.droppedWeapons) {
        if (vdist(p.pos, d.pos) < 1.5) {
          hint = `按 <b>E</b> 拾取 ${WEAPONS[d.id] ? WEAPONS[d.id].nameCN : d.id}`;
          break;
        }
      }
    }
    if (!hint && m.inBuyTime && this.world.inBuyzone(p.pos, p.team)) hint = '按 <b>B</b> 打开购买菜单';
    this.hud.setHint(hint);
    // 进度条
    if (m.planter === p) this.hud.showProgress('安放炸弹', p.plantProgress);
    else if (m.defuser === p) this.hud.showProgress('拆除炸弹', p.defuseProgress);
    else this.hud.hideProgress();
  }

  nextSpectate(dir) {
    const me = this.localPlayer;
    const list = this.players.filter((p) => p.alive && p.team === me.team);
    if (!list.length) { this.viewPlayer = me; return; }
    this.spectateIdx = (this.spectateIdx + dir + list.length) % list.length;
    this.viewPlayer = list[this.spectateIdx];
  }

  showPauseMenu() {
    const body = document.getElementById('menu-body');
    body.innerHTML = `
      <div class="card" style="grid-column:1/-1;text-align:center">
        <div style="font-size:26px;font-weight:700;letter-spacing:3px;margin-bottom:6px">游戏已暂停</div>
        <div class="help" style="margin-bottom:16px">${this.map.nameCN} · 第 ${this.match.round} 回合 · ${this.match.score.t} : ${this.match.score.ct}</div>
        <div class="btn-row" style="justify-content:center">
          <button class="big" id="btn-resume">继续游戏</button>
          <button class="ghost" id="btn-psettings">设置</button>
          <button class="ghost" id="btn-leave">退出到主菜单</button>
        </div>
      </div>`;
    this.menus.showMain(true);
    document.getElementById('btn-resume').onclick = () => { this.menus.showMain(false); this.setPaused(false); };
    document.getElementById('btn-psettings').onclick = () => this.menus.showSettings(true);
    document.getElementById('btn-leave').onclick = () => {
      this.running = false;
      this.menus.buildMain();
      this.menus.showMain(true);
    };
  }

  // ======================= 相机 ===========================================

  updateCamera(dt) {
    const me = this.localPlayer;
    const cam = this.camera;
    let view = this.viewPlayer && this.viewPlayer.alive ? this.viewPlayer : null;

    if (me.alive) {
      view = me;
      this.viewPlayer = me;
    } else {
      this.deathCamTime += dt;
      if (!view || !view.alive) {
        const list = this.players.filter((p) => p.alive && p.team === me.team);
        view = list[0] || null;
        this.viewPlayer = view || me;
      }
    }

    if (view) {
      const eye = view.eye(v3());
      cam.pos[0] = eye[0]; cam.pos[1] = eye[1]; cam.pos[2] = eye[2];
      cam.yaw = view.yaw;
      cam.pitch = view.pitch;
    } else {
      // 死亡且无队友可看：停在尸体上方
      const d = me.deathPos;
      cam.pos[0] = d[0]; cam.pos[1] = d[1] + 2.2 + this.deathCamTime * 0.35; cam.pos[2] = d[2];
      cam.yaw = this.specYaw !== undefined ? this.specYaw : cam.yaw;
      cam.pitch = clamp(this.specPitch !== undefined ? this.specPitch : -0.5, -1.4, 0.6);
    }

    // FOV（开镜）
    const vp = this.viewPlayer || me;
    const w = WEAPONS[activeId(vp)];
    let targetFov = this.settings.fov;
    if (w && w.zoom && vp.wpn.zoom > 0) targetFov = w.zoom[Math.min(vp.wpn.zoom - 1, w.zoom.length - 1)];
    cam.fov = damp(cam.fov, targetFov, 22, dt);

    // 抖动
    if (this.shakeAmount > 0.001) {
      this.shakeTime += dt;
      const s = this.shakeAmount;
      cam.pos[0] += Math.sin(this.shakeTime * 61) * s * 0.035;
      cam.pos[1] += Math.sin(this.shakeTime * 47 + 1.3) * s * 0.035;
      cam.pos[2] += Math.cos(this.shakeTime * 53) * s * 0.035;
      cam.roll = Math.sin(this.shakeTime * 29) * s * 0.02;
      this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.2);
    } else cam.roll = 0;

    // 死亡后视角微微下沉
    if (!me.alive && view === null) cam.roll += 0.1;
  }

  // ======================= 渲染 ===========================================

  render(dt) {
    const r = this.renderer;
    const lib = this.lib;
    if (!this.world || this.headless || !lib) return;
    lib.reset();
    r.beginFrame(this.camera, dt);

    // 光源：地图静态光 + 特效动态光，取最近 8 个
    this.lights.length = 0;
    for (const l of this.mapLights || []) this.lights.push(l);
    this.effects.collectLights(this.lights);
    this.lights.sort((a, b) => vdist(a.pos, this.camera.pos) - vdist(b.pos, this.camera.pos));
    r.setLights(this.lights.slice(0, 8));

    // 角色
    const firstPerson = this.viewPlayer === this.localPlayer && this.localPlayer.alive;
    for (const p of this.players) {
      if (p === this.viewPlayer && (firstPerson || p.alive)) {
        if (p === this.viewPlayer && this.viewPlayer.alive) continue;   // 第一人称不画自己
      }
      if (!p.alive && p.anim.deathT >= 1 && vdist(p.pos, this.camera.pos) > 60) continue;
      const c = TEAM_COLORS[p.team];
      const wparts = p.alive ? this.weaponParts(activeId(p)) : null;
      drawCharacter(r, lib, p, {
        cloth: c.cloth, cloth2: c.cloth2,
        skin: [0.48, 0.34, 0.26, 1],
        gear: p.team === 't' ? [0.13, 0.12, 0.10, 1] : [0.10, 0.12, 0.16, 1],
        hasHelmet: p.helmet, hasArmor: p.armor > 0,
        weaponParts: wparts,
      });
    }

    // 掉落武器
    for (const d of this.droppedWeapons) {
      const parts = this.weaponParts(d.id);
      if (!parts) continue;
      const base = lib.pool.get();
      m4compose(base, d.pos, [0.2, d.yaw + Math.PI / 2, 1.35], null);
      for (const part of parts) {
        const m = lib.pool.get();
        const tmp = lib.pool.get();
        m4compose(tmp, part.pos, part.rot || [0, 0, 0], part.size);
        m4mul(m, base, tmp);
        r.drawModel(lib.unitBox, m, { color: part.colorLin, spec: 0.3, gloss: 24 });
      }
      r.drawSprite('glow', [d.pos[0], d.pos[1] + 0.12, d.pos[2]], 0.5, [0.4, 0.5, 0.6, 0.25], { additive: true });
    }

    // 炸弹
    const m = this.match;
    if (m.bombPlanted && m.bombPos) {
      const mm = lib.pool.get();
      m4compose(mm, m.bombPos, [0, 0.4, 0], null);
      r.drawModel(lib.c4, mm, { color: [0.10, 0.10, 0.11, 1], spec: 0.25, gloss: 20 });
      const blink = (this.time * (1 / Math.max(0.12, m.beepInterval))) % 1 > 0.5 ? 1 : 0.06;
      const lp = [m.bombPos[0], m.bombPos[1] + 0.14, m.bombPos[2]];
      r.drawSprite('glow', lp, 0.35, [2.2 * blink, 0.25 * blink, 0.2 * blink, 0.9], { additive: true });
    } else if (m.bombDropped) {
      const mm = lib.pool.get();
      m4compose(mm, m.bombDropped.pos, [0, 0.7, 0], null);
      r.drawModel(lib.c4, mm, { color: [0.12, 0.11, 0.10, 1] });
      r.drawSprite('glow', m.bombDropped.pos, 0.7, [1.4, 0.9, 0.3, 0.4], { additive: true });
    }

    // 投掷物 + 特效
    this.grenades.render(r, lib);
    this.effects.render(r);

    // 队友轮廓提示（简单的头顶标记）
    const me = this.localPlayer;
    for (const p of this.players) {
      if (!p.alive || p === this.viewPlayer) continue;
      if (p.team !== me.team) continue;
      const d = vdist(p.pos, this.camera.pos);
      if (d > 45) continue;
      const col = p.team === 't' ? [1.4, 0.9, 0.3, 0.75] : [0.4, 0.8, 1.4, 0.75];
      r.drawSprite('ring', [p.pos[0], p.pos[1] + 1.62, p.pos[2]], 0.24, col, { additive: true });
    }

    // 第一人称武器
    if (firstPerson && this.settings.viewmodel) this.renderViewmodel(dt);

    r.endFrame();
  }

  weaponParts(id) {
    let parts = this.lib.viewmodelCache.get(id);
    if (parts === undefined) {
      const def = WEAPONS[id] || GRENADES[id];
      parts = def && def.viewmodel ? prepareParts(def.viewmodel) : null;
      this.lib.viewmodelCache.set(id, parts);
    }
    return parts;
  }

  renderViewmodel(dt) {
    const p = this.localPlayer;
    const r = this.renderer;
    const lib = this.lib;
    const id = activeId(p);
    const def = WEAPONS[id] || GRENADES[id];
    if (!def || !def.viewmodel) return;
    const parts = this.weaponParts(id);
    if (!parts) return;
    const vm = this.vm;

    // 鼠标晃动（武器滞后）
    const dy = angleDelta(vm.lastYaw, p.viewYaw);
    const dp = p.viewPitch - vm.lastPitch;
    vm.lastYaw = p.viewYaw; vm.lastPitch = p.viewPitch;
    vm.swayVel[0] = damp(vm.swayVel[0] + dy * 1.4, 0, 8, dt);
    vm.swayVel[1] = damp(vm.swayVel[1] + dp * 1.4, 0, 8, dt);
    vm.sway[0] = clamp(damp(vm.sway[0] + vm.swayVel[0] * dt * 6, 0, 6, dt), -0.09, 0.09);
    vm.sway[1] = clamp(damp(vm.sway[1] + vm.swayVel[1] * dt * 6, 0, 6, dt), -0.09, 0.09);

    // 走动摆动
    const speed = Math.hypot(p.vel[0], p.vel[2]);
    const sn = clamp(speed / 4.8, 0, 1);
    vm.bob += dt * (5 + sn * 7);
    const bobX = Math.sin(vm.bob) * 0.012 * sn;
    const bobY = Math.abs(Math.cos(vm.bob)) * 0.010 * sn;

    // 开火后坐
    const sinceFire = this.time - p.wpn.lastFire;
    const fireK = clamp(1 - sinceFire / 0.12, 0, 1);
    vm.kick = Math.max(vm.kick * Math.exp(-dt * 9), fireK * 0.85);

    // 换弹 / 拔枪动画
    const st = p.wpn;
    let reloadRot = 0, reloadDrop = 0;
    if (st.reloading) {
      const w = WEAPONS[id];
      const total = (w && w.reloadTime) || 2.5;
      const t = clamp(1 - (st.reloadEnd - this.time) / total, 0, 1);
      const s = Math.sin(t * Math.PI);
      reloadRot = s * 0.75;
      reloadDrop = s * 0.14;
    }
    vm.drawT = damp(vm.drawT, 0, 7, dt);
    const drawDrop = vm.drawT * 0.22;
    const drawRot = vm.drawT * 0.5;

    const origin = def.viewmodel.origin;
    const zoomHide = st.zoom > 0 ? 1 : 0;
    if (zoomHide) return;   // 开镜时隐藏模型

    const pos = [
      origin[0] + vm.sway[0] + bobX,
      origin[1] + vm.sway[1] + bobY - reloadDrop - drawDrop - vm.kick * 0.012 - p.landDip * 0.5,
      origin[2] + vm.kick * 0.035,
    ];
    const rot = [
      -vm.sway[1] * 1.5 + reloadRot + drawRot - vm.kick * 0.14,
      -vm.sway[0] * 1.5,
      vm.sway[0] * 0.8 + reloadRot * 0.25,
    ];
    const base = m4compose(m4(), pos, rot, null);
    for (const part of parts) {
      const mtx = lib.pool.get();
      const tmp = lib.pool.get();
      m4compose(tmp, part.pos, part.rot || [0, 0, 0], part.size);
      m4mul(mtx, base, tmp);
      r.drawViewmodel(lib.unitBox, mtx, { color: part.colorLin, spec: 0.34, gloss: 28 });
    }
    // 手：位置由武器自身的握把/护木推导（见 models.js buildHands）
    for (const h of this.handsFor(id)) {
      const mtx = lib.pool.get();
      const tmp = lib.pool.get();
      m4compose(tmp, h.pos, h.rot || [0, 0, 0], h.size);
      m4mul(mtx, base, tmp);
      r.drawViewmodel(lib.unitBox, mtx, { color: h.colorLin, spec: 0.09, gloss: 7 });
    }
    // 枪口焰
    if (fireK > 0.15 && WEAPONS[id] && WEAPONS[id].class !== 'knife') {
      const mz = def.viewmodel.muzzle;
      // 把相机空间的枪口位置转到世界坐标（右/上/前三个轴都取真实相机基向量，
      // 之前 up 写死成 [0,1,0]，抬头/低头时枪焰会飘到枪管外面）
      const dir = anglesToDir(v3(), this.camera.yaw, this.camera.pitch);
      const right = vnorm(v3(), vcross(v3(), dir, [0, 1, 0]));
      const up = vnorm(v3(), vcross(v3(), right, dir));
      const cp = [pos[0] + mz[0], pos[1] + mz[1], pos[2] + mz[2]];
      const world = [0, 0, 0];
      for (let i = 0; i < 3; i++) {
        world[i] = this.camera.pos[i] + right[i] * cp[0] + up[i] * cp[1] - dir[i] * cp[2];
      }
      this.renderer.drawSprite('flash', world, 0.30 * (0.6 + fireK), [2.6, 1.8, 0.9, fireK], { additive: true, rot: rnd() * 6.283 });
    }
  }

  /** 缓存每把武器推导出来的手部方块 */
  handsFor(id) {
    let hands = this._handCache.get(id);
    if (hands === undefined) {
      const def = WEAPONS[id] || GRENADES[id];
      hands = def && def.viewmodel ? buildHands(def) : [];
      this._handCache.set(id, hands);
    }
    return hands;
  }
}

function jitterSkill(base) {
  return clamp(base + gauss() * 0.14, 0.05, 1);
}
function frame() { return new Promise((r) => requestAnimationFrame(() => r())); }

// --------------------------------------------------------------------------
// 无头模式（Node 自测）用的桩件
// --------------------------------------------------------------------------

const DEFAULT_SETTINGS_FALLBACK = {
  sensitivity: 2.2, invertY: false, rawInput: true, fov: 90, viewmodelFov: 68,
  masterVolume: 0, sfxVolume: 0, shadows: false, shadowStrength: 0,
  radarRotate: true, radarZoom: 62, crosshairColor: '#35ff6a', crosshairSize: 7,
  crosshairGap: 3, crosshairThick: 2, crosshairDot: false, showPerf: false,
  viewmodel: false, autoBuy: false, bloodEnabled: false,
};

function makeStubRenderer() {
  const noop = () => {};
  return {
    stats: { drawCalls: 0, tris: 0 }, height: 1080, dpr: 1, width: 1920, aspect: 16 / 9,
    shadowEnabled: false, shadowStrength: 0, viewmodelFov: 68, gl: null,
    env: {}, time: 0,
    resize: noop, init: noop, setWorld: noop, setEnv: noop, setLights: noop,
    beginFrame: noop, endFrame: noop, drawModel: noop, drawSprite: noop,
    drawLine: noop, drawDecal: noop, drawViewmodel: noop,
  };
}

function makeStubAudio() {
  const stats = { calls: 0 };
  return {
    stats, ready: true,
    init: () => {}, setMasterVolume: () => {}, setVolume: () => {},
    setListener: () => {}, stopAll: () => {}, suspend: () => {}, resume: () => {},
    play: (name) => { stats.calls++; return { id: 0, stop() {}, setPos() {}, setVolume() {} }; },
    stop: () => {},
  };
}

function makeStubInput() {
  return {
    sensitivity: 2.2, invertY: false, rawInput: true, locked: false,
    isDown: () => false, pressed: () => false, released: () => false,
    btn: () => false, btnPressed: () => false, btnReleased: () => false,
    takeLook: () => ({ yaw: 0, pitch: 0 }), takeWheel: () => 0,
    endFrame: () => {}, lock: () => {}, unlock: () => {}, onLockChange: () => {},
  };
}

function makeStubHud() {
  const log = [];
  return {
    log, buildRadar: () => {}, update: () => {},
    killFeed: (a, at, v, vt, w, hs) => log.push({ type: 'kill', a, v, w, hs }),
    notify: (t) => log.push({ type: 'notify', t }),
    center: () => {}, banner: () => {}, hideBanner: () => {},
    hit: () => {}, hurt: () => {}, showProgress: () => {}, hideProgress: () => {},
    setHint: () => {},
  };
}

function makeStubMenus() {
  return {
    config: {}, buyOpen: false, mainOpen: false, settingsOpen: false,
    showMain: () => {}, showSettings: () => {}, toggleBuy: () => false,
    showScoreboard: () => {}, showGameOver: () => {}, buildMain: () => {},
    renderBuy: () => {}, buyKey: () => {}, backBuyLevel: () => false,
  };
}
