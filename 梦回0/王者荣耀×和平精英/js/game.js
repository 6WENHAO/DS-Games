/* ================================================================
   荣耀精英 — 对局主逻辑
   兵线波次 / 野怪刷新 / 空投事件 / 信号圈 / 击杀播报 / 胜负判定
   ================================================================ */
HE.Game = (function () {
  const Game = {};
  Game.G = null;
  const E = () => HE.Entities;

  /* ---------------- 开局 ---------------- */
  Game.startMatch = function (scene, camera, playerHeroId) {
    const G = Game.G = {
      state: 'play', time: 0, scene, camera,
      units: [], heroes: [], projectiles: [], zones: [],
      monsters: {}, campTimers: {},
      kills: { blue: 0, red: 0 },
      playerTeam: 'blue', player: null,
      waveNum: 0, nextWaveT: HE.CFG.FIRST_WAVE, announced5s: false,
      airdropT: HE.CFG.AIRDROP_FIRST,
      zone: null, zoneMesh: null,
      firstBlood: false, towerWarnCd: 0,
      result: null,
    };
    G.aoeDamage = aoeDamage;

    HE.World.build(scene);
    HE.FX.init(scene);

    // 防御塔 + 水晶
    ['blue', 'red'].forEach(team => {
      HE.TOWERS.forEach(conf => addUnit(new (E().Tower)(team, conf)));
      addUnit(new (E().Crystal)(team));
    });
    // 我方防御塔被攻击播报（节流）
    G.units.forEach(u => {
      if (u.kind === 'tower' && u.team === G.playerTeam) {
        const orig = u.onDamaged;
        u.onDamaged = function (src, dmg, opts) {
          if (orig) orig.call(this, src, dmg, opts);
          if (G.towerWarnCd <= 0 && src && src.isHero) {
            G.towerWarnCd = 14;
            HE.Audio.announce(HE.VOICE.towerDangerA, { interrupt: false });
          }
        };
      }
    });

    // 野怪营地计时
    HE.JUNGLE.forEach(c => {
      G.campTimers[c.id] = c.type === 'tyrant' ? HE.CFG.TYRANT_SPAWN
        : c.type === 'overlord' ? HE.CFG.OVERLORD_SPAWN : HE.CFG.BUFF_SPAWN;
    });

    // 英雄阵容：玩家 + 4 AI 队友（蓝）vs 5 AI（红）
    const pDef = HE.HEROES.find(h => h.id === playerHeroId);
    const others = HE.HEROES.filter(h => h.id !== playerHeroId);
    const player = new (E().Hero)(pDef, 'blue', true, '特种兵·指挥官');
    G.player = player;
    addHero(player, HE.LANE_ASSIGN[pDef.id] || 'mid');
    others.forEach((def, i) => {
      const h = new (E().Hero)(def, 'blue', false, HE.BOT_NAMES.blue[i]);
      addHero(h, HE.LANE_ASSIGN[def.id] || 'mid');
      new (HE.AI.HeroAI)(h, HE.LANE_ASSIGN[def.id] || 'mid');
    });
    HE.HEROES.forEach((def, i) => {
      const h = new (E().Hero)(def, 'red', false, HE.BOT_NAMES.red[i]);
      addHero(h, HE.LANE_ASSIGN[def.id] || 'mid');
      new (HE.AI.HeroAI)(h, HE.LANE_ASSIGN[def.id] || 'mid');
    });

    // 开场跳伞（和平精英式空降）
    G.heroes.forEach((h, i) => {
      const base = h.team === 'blue' ? HE.CFG.BLUE_BASE : HE.CFG.RED_BASE;
      h.pos.set(base.x + (i % 5) * 3 - 6, 0, base.z + ((i / 5) | 0) * 4 - 2);
      h.startDrop(30 + Math.random() * 8);
      h.syncMesh();
    });

    setTimeout(() => HE.Audio.announce(HE.VOICE.welcome), 600);
    setTimeout(() => { HE.UI.banner('全军出击！', '', 2000); HE.Audio.announce(HE.VOICE.deploy, { interrupt: false }); }, 3200);
    HE.Audio.music('battle');
  };

  function addUnit(u) {
    Game.G.units.push(u);
    Game.G.scene.add(u.group);
    u.syncMesh();
  }
  function addHero(h, lane) {
    h.lane = lane;
    Game.G.heroes.push(h);
    addUnit(h);
  }
  Game.removeUnit = function (u) {
    const G = Game.G;
    G.scene.remove(u.group);
    const i = G.units.indexOf(u);
    if (i >= 0) G.units.splice(i, 1);
  };

  /* ---------------- 主循环 ---------------- */
  Game.update = function (dt) {
    const G = Game.G;
    if (!G || G.state !== 'play') return;
    G.time += dt;
    if (G.towerWarnCd > 0) G.towerWarnCd -= dt;

    spawnWaves(dt);
    spawnMonsters(dt);
    airdropEvent(dt);
    zoneEvent(dt);
    updateZones(dt);
    passiveIncome(dt);

    for (let i = G.units.length - 1; i >= 0; i--) {
      const u = G.units[i];
      if (u.update) u.update(dt);
      if (u.ai) u.ai.update(dt);
    }
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      const p = G.projectiles[i];
      p.update(dt);
      if (p.dead) G.projectiles.splice(i, 1);
    }
    // 水晶无敌判定：基地塔存活时不可攻击
    if (((G.time * 2) | 0) !== (((G.time - dt) * 2) | 0)) {
      ['blue', 'red'].forEach(team => {
        const baseTower = G.units.find(u => u.kind === 'tower' && u.team === team && u.tier === 3 && u.alive);
        const crystal = G.units.find(u => u.kind === 'crystal' && u.team === team);
        if (crystal) crystal.invulnerable = !!baseTower;
      });
    }
  };

  /* ---------------- 经济与兵线 ---------------- */
  function passiveIncome(dt) {
    const G = Game.G;
    if (G.time < HE.CFG.FIRST_WAVE) return;
    G.heroes.forEach(h => {
      h.gold += HE.CFG.PASSIVE_GOLD * dt;
      h.gainXp(HE.CFG.PASSIVE_XP * dt);
    });
  }
  function spawnWaves(dt) {
    const G = Game.G;
    if (!G.announced5s && G.time >= HE.CFG.FIRST_WAVE - 5) {
      G.announced5s = true;
      HE.Audio.announce(HE.VOICE.minions5s);
      HE.UI.banner('敌军还有五秒到达战场', 'blue', 2400);
    }
    if (G.time >= G.nextWaveT) {
      G.nextWaveT += HE.CFG.WAVE_INTERVAL;
      G.waveNum++;
      const scale = 1 + G.time / 60 * 0.05;
      ['blue', 'red'].forEach(team => {
        for (const lane in HE.LANES) {
          for (let i = 0; i < 3; i++) queueMinion(team, lane, 'melee', scale, i * 0.55);
          for (let i = 0; i < 2; i++) queueMinion(team, lane, 'ranged', scale, 1.8 + i * 0.55);
          if (G.waveNum % HE.CFG.CANNON_EVERY === 0) queueMinion(team, lane, 'cannon', scale, 3.0);
        }
      });
    }
  }
  function queueMinion(team, lane, type, scale, delay) {
    setTimeout(() => {
      const G = Game.G;
      if (!G || G.state !== 'play') return;
      addUnit(new (E().Minion)(team, lane, type, scale));
    }, delay * 1000);
  }

  /* ---------------- 野怪 ---------------- */
  function spawnMonsters(dt) {
    const G = Game.G;
    HE.JUNGLE.forEach(c => {
      if (G.monsters[c.id] && G.monsters[c.id].alive) return;
      G.campTimers[c.id] -= dt;
      if (G.campTimers[c.id] <= 0) {
        const m = new (E().Monster)(c);
        G.monsters[c.id] = m;
        addUnit(m);
        G.campTimers[c.id] = Infinity; // 死亡时重置
      }
    });
  }

  /* ---------------- 空投（和平精英事件） ---------------- */
  function airdropEvent(dt) {
    const G = Game.G;
    G.airdropT -= dt;
    if (G.airdropT > 0) return;
    G.airdropT = HE.CFG.AIRDROP_INTERVAL;
    // 沿河道随机降点
    const t = Math.random() * 90 - 45;
    const x = t + (Math.random() - 0.5) * 16;
    const z = -t + (Math.random() - 0.5) * 16;
    const loot = HE.AIRDROP_LOOT[(Math.random() * HE.AIRDROP_LOOT.length) | 0];
    HE.Audio.sfx('airdrop_plane');
    HE.Audio.announce(HE.VOICE.airdrop, { interrupt: false });
    HE.UI.subBanner(`✈ 空投补给正在投放 — ${loot.name}`, 3200);
    setTimeout(() => {
      if (!Game.G || Game.G.state !== 'play') return;
      addUnit(new (E().AirdropCrate)(x, z, loot));
    }, 1800);
  }

  /* ---------------- 信号圈（和平精英缩圈） ---------------- */
  function zoneEvent(dt) {
    const G = Game.G;
    if (!G.zone && G.time >= HE.CFG.ZONE_START) {
      G.zone = { active: true, x: 0, z: 0, r: 145, targetR: HE.CFG.ZONE_MIN_R, shrinkV: (145 - HE.CFG.ZONE_MIN_R) / HE.CFG.ZONE_SHRINK_TIME };
      HE.Audio.announce(HE.VOICE.zone, { interrupt: false });
      HE.Audio.sfx('zone_warn');
      HE.UI.banner('信号圈开始收缩！', 'blue', 2600);
      const geo = new THREE.CylinderGeometry(1, 1, 26, 64, 1, true);
      const mat = new THREE.MeshBasicMaterial({ color: 0x5ab8ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
      G.zoneMesh = new THREE.Mesh(geo, mat);
      G.zoneMesh.position.set(0, 13, 0);
      G.scene.add(G.zoneMesh);
    }
    if (!G.zone || !G.zone.active) return;
    const z = G.zone;
    if (z.r > z.targetR) {
      z.r = Math.max(z.targetR, z.r - z.shrinkV * dt);
    } else {
      // 决赛圈保持一段时间后能量耗尽消散，进入总攻阶段
      z.holdT = (z.holdT || 0) + dt;
      if (z.holdT >= HE.CFG.ZONE_HOLD) {
        z.active = false;
        if (G.zoneMesh) { G.scene.remove(G.zoneMesh); G.zoneMesh = null; }
        HE.UI.zoneWarning(false);
        HE.Audio.announce(HE.VOICE.zoneEnd, { interrupt: false });
        HE.Audio.sfx('zone_warn');
        HE.UI.banner('信号圈已消散，发起总攻！', 'blue', 2600);
        return;
      }
    }
    if (G.zoneMesh) G.zoneMesh.scale.set(z.r, 1, z.r);
    // 圈外掉血（仅英雄）
    let playerOut = false;
    G.heroes.forEach(h => {
      if (!h.alive || h.dropping > 0) return;
      const d = Math.hypot(h.x - z.x, h.z - z.z);
      if (d > z.r) {
        h.takeDamage(h.maxHp * HE.CFG.ZONE_DPS * dt, null, { trueDmg: true, silent: true });
        if (h.isPlayer) playerOut = true;
      }
    });
    HE.UI.zoneWarning(playerOut);
  }

  /* ---------------- 技能区域（烟雾/燃烧/救援） ---------------- */
  function updateZones(dt) {
    const G = Game.G;
    for (let i = G.zones.length - 1; i >= 0; i--) {
      const z = G.zones[i];
      z.t -= dt;
      if (z.t <= 0) { G.zones.splice(i, 1); continue; }
      if (z.type === 'smoke') {
        if (Math.random() < dt * 6) HE.FX.smokePuff(new THREE.Vector3(z.x, 0, z.z), z.r * 0.5, 1.4);
        G.units.forEach(u => {
          if (u.team === z.team || !u.alive || u.isBuilding) return;
          if (Math.hypot(u.x - z.x, u.z - z.z) < z.r) u.applySlow(0.35, 0.4);
        });
      } else if (z.type === 'fire') {
        if (Math.random() < dt * 14) HE.FX.flame(new THREE.Vector3(z.x, 0, z.z), z.r);
        G.units.forEach(u => {
          if (u.team === z.team || !u.alive || u.isBuilding) return;
          if (Math.hypot(u.x - z.x, u.z - z.z) < z.r) u.takeDamage(z.dps * dt, z.src, { silent: true });
        });
      } else if (z.type === 'rescue') {
        if (Math.random() < dt * 6) HE.FX.healGlow(new THREE.Vector3(z.x + (Math.random() - 0.5) * z.r, 0, z.z + (Math.random() - 0.5) * z.r));
        G.heroes.forEach(h => {
          if (h.team !== z.team || !h.alive) return;
          if (Math.hypot(h.x - z.x, h.z - z.z) < z.r) {
            h.heal(z.hps * dt);
            if (!h.buffs.rescue) { h.buffs.rescue = 0.6; h.computeStats(); }
            else h.buffs.rescue = 0.6;
          }
        });
      }
    }
  }

  /* ---------------- 范围伤害 ---------------- */
  function aoeDamage(pos, r, dmg, src) {
    const G = Game.G;
    G.units.forEach(u => {
      if (!u.alive || u.isBuilding || u.team === src.team || u.untargetable) return;
      if (Math.hypot(u.x - pos.x, u.z - pos.z) < r) {
        const dealt = u.takeDamage(dmg, src);
        if (src.isPlayer) HE.UI.floatDmg(u, dealt, false, false);
      }
    });
  }

  /* ---------------- 死亡结算 ---------------- */
  Game.onUnitDeath = function (unit, src) {
    const G = Game.G;
    if (!G || G.state !== 'play') { if (unit.kind !== 'hero') Game.removeUnit(unit); return; }

    // 击杀者归属：直接来源或最近伤害英雄
    let killer = src && src.isHero ? src : null;
    if (!killer && unit.recentDamagers.length) killer = unit.recentDamagers[unit.recentDamagers.length - 1].hero;

    if (unit.kind === 'minion') {
      HE.FX.deathBurst(unit.pos.clone(), unit.team === 'blue' ? 0x3da9fc : 0xff5c5c);
      if (killer && killer.team !== unit.team) {
        killer.cs++;
        killer.gainGold(unit.goldValue, killer.isPlayer);
        killer.gainXp(unit.xpValue);
        // 周围队友分享经验
        G.heroes.forEach(h => {
          if (h !== killer && h.team === killer.team && h.alive && h.distTo(unit) < 14) h.gainXp(unit.xpValue * 0.6);
        });
      }
      Game.removeUnit(unit);
    }
    else if (unit.kind === 'monster') {
      HE.FX.explosion(unit.pos.clone(), 2.5, 0xc9a35a);
      HE.Audio.sfx('monster', { at: unit.pos });
      const type = unit.camp.type;
      if (killer) {
        if (type === 'redbuff' || type === 'bluebuff') {
          killer.gainGold(HE.CFG.GOLD_BUFF, killer.isPlayer);
          killer.gainXp(unit.xpValue);
          killer.addBuff(type === 'redbuff' ? 'red' : 'blue', 60);
          if (killer.isPlayer) {
            HE.Audio.announce(type === 'redbuff' ? HE.VOICE.buffRed : HE.VOICE.buffBlue, { interrupt: false });
            HE.UI.subBanner(type === 'redbuff' ? '🔥 获得红色增益' : '❄ 获得蓝色增益');
          }
        } else {
          // 暴君 / 主宰：全队奖励
          const gold = type === 'tyrant' ? HE.CFG.GOLD_TYRANT : HE.CFG.GOLD_OVERLORD;
          G.heroes.forEach(h => { if (h.team === killer.team) { h.gainGold(gold); h.gainXp(unit.xpValue * 0.5); } });
          if (type === 'overlord') G.heroes.forEach(h => { if (h.team === killer.team) h.addBuff('overlord', 90); });
          HE.Audio.announce(type === 'tyrant' ? HE.VOICE.tyrant : HE.VOICE.overlord, { interrupt: false });
          HE.UI.banner(`${killer.team === G.playerTeam ? '我方' : '敌方'}击败了${type === 'tyrant' ? '暴君' : '主宰'}`,
            killer.team === G.playerTeam ? 'blue' : 'red', 2200);
        }
      }
      // 重置刷新计时
      G.campTimers[unit.camp.id] = type === 'tyrant' ? HE.CFG.TYRANT_RESPAWN
        : type === 'overlord' ? HE.CFG.OVERLORD_RESPAWN : HE.CFG.BUFF_RESPAWN;
      G.monsters[unit.camp.id] = null;
      Game.removeUnit(unit);
    }
    else if (unit.kind === 'tower') {
      HE.FX.explosion(unit.pos.clone(), 5, 0xffaa55);
      HE.Audio.sfx('explosion_big', { at: unit.pos });
      HE.Player.shake(1.2, 0.5);
      const enemyOfTower = unit.team === 'blue' ? 'red' : 'blue';
      G.heroes.forEach(h => { if (h.team === enemyOfTower) h.gainGold(HE.CFG.GOLD_TOWER); });
      if (killer) killer.gainGold(HE.CFG.GOLD_TOWER_KILLER, killer.isPlayer);
      if (unit.team === G.playerTeam) {
        HE.Audio.announce(HE.VOICE.towerLostA, { interrupt: false });
        HE.UI.banner('我方防御塔被摧毁', 'red', 2000);
      } else {
        HE.Audio.announce(HE.VOICE.towerLostB, { interrupt: false });
        HE.UI.banner('敌方防御塔被摧毁', 'blue', 2000);
      }
      Game.removeUnit(unit);
    }
    else if (unit.kind === 'crystal') {
      HE.FX.explosion(unit.pos.clone(), 8, unit.team === 'blue' ? 0x3da9fc : 0xff5c5c);
      HE.Audio.sfx('explosion_big');
      HE.Player.shake(2.5, 1);
      Game.removeUnit(unit);
      endMatch(unit.team !== G.playerTeam);
    }
    else if (unit.kind === 'hero') {
      onHeroKill(unit, killer);
    }
  };

  function onHeroKill(victim, killer) {
    const G = Game.G;
    const enemyTeam = victim.team === 'blue' ? 'red' : 'blue';
    G.kills[enemyTeam]++;

    let killerName = '防御塔';
    if (killer && killer.team !== victim.team) {
      killer.kda.k++;
      killer.streak++;
      killer.multiKill++;
      killer.multiKillT = 12;
      // 赏金：基础 + 连杀加成 + 终结赏金
      let gold = HE.CFG.GOLD_HERO_BASE + Math.min(300, (killer.streak - 1) * 40) + Math.min(250, victim.deadStreak >= 3 ? victim.deadStreak * 50 : 0);
      killer.gainGold(gold, killer.isPlayer);
      killer.gainXp(160 + victim.level * 18);
      killerName = killer.name;
      // 助攻
      victim.recentDamagers.forEach(r => {
        if (r.hero !== killer && r.hero.team === killer.team && r.hero.alive !== undefined) {
          r.hero.kda.a++;
          r.hero.gainGold(gold * 0.4);
          r.hero.gainXp(80);
        }
      });
    }
    HE.UI.killfeed(killerName, killer ? killer.team : enemyTeam, victim.name, victim.team);
    HE.Audio.sfx('kill_hero', { vol: 0.8 });

    // 播报优先级：一血 > 多杀 > 连胜终结 > 普通
    if (!G.firstBlood) {
      G.firstBlood = true;
      HE.Audio.announce(HE.VOICE.firstblood);
      HE.UI.banner('第一滴血', killer && killer.team === G.playerTeam ? 'blue' : 'red', 2400);
    } else if (killer && killer.multiKill >= 2) {
      const key = ['', '', 'double', 'triple', 'quadra', 'penta'][Math.min(5, killer.multiKill)];
      HE.Audio.announce(HE.VOICE[key]);
      HE.UI.banner(HE.KILL_BANNERS[Math.min(5, killer.multiKill)], killer.team === G.playerTeam ? 'blue' : 'red', 2200);
    } else if (victim.deadStreak >= 5) {
      HE.Audio.announce(HE.VOICE.shutdown, { interrupt: false });
    } else if (killer && killer.streak >= 5) {
      HE.Audio.announce(HE.VOICE.legendary, { interrupt: false });
      HE.UI.banner(`${killer.name} 无人能挡！`, killer.team === G.playerTeam ? 'blue' : 'red', 2200);
    } else {
      HE.Audio.announce(victim.team === G.playerTeam ? HE.VOICE.allyDown : HE.VOICE.enemyDown, { interrupt: false });
    }
    if (victim.isPlayer) HE.Player.shake(1.5, 0.4);
  }

  /* ---------------- 结算 ---------------- */
  function endMatch(win) {
    const G = Game.G;
    if (G.state === 'end') return;
    G.state = 'end';
    G.result = win;
    HE.Audio.music(null);
    HE.Audio.sfx(win ? 'victory' : 'defeat');
    HE.Audio.announce(win ? HE.VOICE.victory : HE.VOICE.defeat);
    HE.UI.banner(win ? '胜利' : '失败', win ? '' : 'red', 2600);
    setTimeout(() => HE.Main.showResult(win), 2600);
  }
  Game.endMatch = endMatch;

  /* ---------------- 对外 ---------------- */
  return Game;
})();
