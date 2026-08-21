/* =========================================================================
 * GREENFALL · game.js —— 主循环 / 输入 / 交互 / 任务 / 存档 / MOD 接口
 * ======================================================================= */
(function (GF) {
  'use strict';

  const U = GF.util;
  const SAVE_KEY = 'greenfall.save.v1';

  /* ------------------------------------------- 图集平均色（粒子/地图） */
  const avgCache = Object.create(null);
  function avgColor(texName) {
    if (avgCache[texName]) return avgCache[texName];
    const a = GF.Atlas.build();
    const i = GF.Atlas.index[texName];
    if (i === undefined || !a.canvas) return (avgCache[texName] = [0.5, 0.5, 0.5]);
    const T = GF.Atlas.TILE;
    const g = a.canvas.getContext('2d');
    const d = g.getImageData((i % GF.Atlas.COLS) * T, Math.floor(i / GF.Atlas.COLS) * T, T, T).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let p = 0; p < d.length; p += 4) {
      if (d[p + 3] < 40) continue;
      r += d[p]; gg += d[p + 1]; b += d[p + 2]; n++;
    }
    if (!n) n = 1;
    return (avgCache[texName] = [r / n / 255, gg / n / 255, b / n / 255]);
  }

  /* ==================================================== Game */
  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new GF.Renderer(canvas);
      this.audio = new GF.Audio();
      this.ui = new GF.UI(this);
      this.keys = Object.create(null);
      this.mouse = { l: false, r: false };
      this.sensitivity = 0.0032;
      this.dayLength = 1200;
      this.particles = [];
      this.elapsed = 0;
      this.swing = 0;
      this.bobPhase = 0;
      this.mining = null;
      this.target = null;
      this.flags = Object.create(null);
      this.notes = new Set();
      this.discovered = new Set();
      this.unlocks = Object.create(null);
      this.lightOn = false;
      this.gunCd = 0;
      this.fishing = null;
      this.paused = false;
      this.fps = 60; this._fpsT = 0; this._frames = 0;
      this.spawnPoint = null;
      this.aiming = false;
    }

    /* -------------------------------------------------- 新游戏 */
    newGame(seed) {
      this.seed = (seed == null ? (Math.random() * 2147483647) | 0 : seed) | 0;
      // 重置地标基准高度缓存（不同种子地形不同）
      for (const l of GF.Landmarks.list) l.baseY = null;
      this.world = new GF.World(this.seed);
      this.world.onDisposeMesh = (c) => this.renderer.disposeChunk(c);
      this.inv = new GF.Inventory(24);
      this.player = new GF.Player(8.5, 60, 8.5);
      this.sv = new GF.Survival(this.player, this.inv, this.world);
      this.ents = new GF.EntityManager(this.world);
      this.flags = Object.create(null);
      this.notes = new Set();
      this.discovered = new Set();
      this.unlocks = Object.create(null);
      this.quests = new GF.Quests({
        inv: this.inv, world: this.world, flags: this.flags,
        notes: this.notes, discovered: this.discovered, unlocks: this.unlocks,
      });
      this.particles.length = 0;
      this.ui.closePanel();

      // 出生点：起点营地
      const camp = GF.Landmarks.list[0];
      this.spawning = true;
      this.ui.showLoading('正在生成世界…', 0.05);
      const spawnChunks = [];
      const ccx = Math.floor(camp.x / GF.CHUNK), ccz = Math.floor(camp.z / GF.CHUNK);
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) spawnChunks.push([ccx + dx, ccz + dz]);
      let i = 0;
      const step = () => {
        const t0 = performance.now();
        while (i < spawnChunks.length && performance.now() - t0 < 40) {
          this.world.generateNow(spawnChunks[i][0], spawnChunks[i][1]); i++;
        }
        this.ui.showLoading('正在生成世界…  ' + i + '/' + spawnChunks.length, 0.05 + 0.9 * i / spawnChunks.length);
        if (i < spawnChunks.length) return requestAnimationFrame(step);
        // 落地
        let y = GF.HEIGHT - 2;
        for (; y > 2; y--) if (this.world.isSolid(camp.x, y, camp.z)) break;
        this.player.x = camp.x + 0.5; this.player.z = camp.z + 3.5; this.player.y = y + 1.2;
        this.player.yaw = Math.PI; this.player.pitch = -0.1;
        this.spawnPoint = { x: this.player.x, y: this.player.y, z: this.player.z };
        // 初始物品（很少 —— 一切从零开始）
        this.inv.add('cloth_scrap', 3);
        this.inv.add('branch', 2);
        this.inv.add('berries', 4);
        this.inv.add('rag_bandage', 1);
        this.inv.add('water_dirty_bottle', 1);
        this.inv.add('bottle_empty', 1);
        this.inv.add('can_empty', 1);        // 能在火上煮水，比铁锅早得多
        this.inv.add('matches', 1);
        this.discover(camp, true);
        this.spawning = false;
        this.ui.hideLoading();
        this.ui.toast('你在一处废弃营地醒来。先做一把石斧。', 'good');
        GF.bus.emit('game:start');
      };
      requestAnimationFrame(step);
    }

    /* -------------------------------------------------- 事件绑定 */
    bind() {
      const cv = this.canvas;
      cv.addEventListener('click', () => {
        this.audio.resume();
        if (!this.ui.isModal() && document.pointerLockElement !== cv) cv.requestPointerLock();
      });
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === cv;
      });
      document.addEventListener('mousemove', (e) => {
        if (!this.locked || this.ui.isModal()) return;
        const s = this.sensitivity * (this.aiming ? 0.45 : 1);
        this.player.yaw -= e.movementX * s;
        this.player.pitch = U.clamp(this.player.pitch - e.movementY * s, -1.55, 1.55);
      });
      cv.addEventListener('mousedown', (e) => {
        if (this.ui.isModal()) return;
        if (e.button === 0) { this.mouse.l = true; this.onPrimary(); }
        if (e.button === 2) { this.mouse.r = true; this.onSecondary(); }
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) { this.mouse.l = false; this.mining = null; this.ui.setProgress(0); }
        if (e.button === 2) { this.mouse.r = false; this.aiming = false; }
      });
      cv.addEventListener('contextmenu', (e) => e.preventDefault());
      cv.addEventListener('wheel', (e) => {
        if (this.ui.isModal()) return;
        e.preventDefault();
        this.inv.sel = (this.inv.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
        this.audio.ui();
      }, { passive: false });

      window.addEventListener('keydown', (e) => {
        if (e.target && e.target.tagName === 'INPUT') return;
        this.keys[e.code] = true;
        const k = e.code;
        if (k === 'Escape') {
          if (this.ui.isModal()) this.ui.closePanel(); else this.ui.openPanel('settings');
          e.preventDefault(); return;
        }
        if (this.ui.isModal()) {
          if (k === 'KeyE' || k === 'KeyC' || k === 'KeyM' || k === 'KeyJ') this.ui.closePanel();
          return;
        }
        if (k === 'KeyE') { this.ui.openPanel('inventory'); this.audio.ui(); document.exitPointerLock(); }
        else if (k === 'KeyC') { this.ui.openPanel('craft'); this.audio.ui(); document.exitPointerLock(); }
        else if (k === 'KeyM') { this.ui.openPanel('map'); this.audio.ui(); document.exitPointerLock(); }
        else if (k === 'KeyJ') { this.ui.openPanel('journal'); this.audio.ui(); document.exitPointerLock(); }
        else if (k === 'KeyF') this.toggleLight();
        else if (k === 'KeyR') this.reload();
        else if (k === 'KeyQ') this.dropOne();
        else if (k === 'KeyG') this.onSecondary();
        else if (k === 'F5') { this.save(); this.ui.toast('已保存。', 'good'); e.preventDefault(); }
        else if (k === 'F9') { if (this.load()) this.ui.toast('存档已载入。', 'good'); e.preventDefault(); }
        else if (k.startsWith('Digit')) {
          const n = parseInt(k.slice(5), 10);
          if (n >= 1 && n <= 9) { this.inv.sel = n - 1; this.audio.ui(); }
        }
      });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
      window.addEventListener('blur', () => { this.keys = Object.create(null); this.mouse.l = this.mouse.r = false; });

      /* ---- 游戏事件 ---- */
      GF.bus.on('toast', (p) => this.ui.toast(p.text, p.kind));
      GF.bus.on('player:hit', (p) => {
        if (!this.sv.alive) return;
        this.sv.takeHit(p.dmg, p);
        this.audio.hurt();
        this.spawnParticles(this.player.x, this.player.eyeY - 0.3, this.player.z, 6, [0.6, 0.1, 0.1], 0.06, 0.045);
      });
      GF.bus.on('player:fall', (p) => { this.sv.takeHit(p.dmg, {}); this.audio.hurt(); });
      GF.bus.on('player:death', (p) => {
        this.sv.stats.deaths++;
        this.audio.death();
        this.dropAllOnDeath();
        this.ui.openPanel('death', p);
        document.exitPointerLock();
      });
      GF.bus.on('entity:die', (p) => {
        this.sv.stats.kills++;
        this.flags.kills = (this.flags.kills || 0) + 1;
        this.spawnParticles(p.x, p.y + 0.8, p.z, 14, [0.45, 0.1, 0.12], 0.09, 0.05);
        let left = [];
        for (const d of p.drops) { const rem = this.inv.add(d.item, d.n); if (rem > 0) left.push({ item: d.item, n: rem }); }
        if (left.length) this.dropContainer(Math.floor(p.x), Math.floor(p.y) + 1, Math.floor(p.z), left);
        if (p.drops.length) this.ui.toast('获得：' + p.drops.map((d) => GF.Items.nameOf(d.item) + '×' + d.n).join('、'));
      });
      GF.bus.on('tool:broke', (p) => { this.ui.toast(GF.Items.nameOf(p.item) + ' 断了。', 'bad'); this.audio.error(); });
      GF.bus.on('mob:giveup', (p) => {
        // 掠食者放弃追击时给个明确反馈，让玩家知道可以喘口气了
        if (p.dist > 30 || !p.e.cfg.predator) return;
        if (this._giveupT && this.elapsed - this._giveupT < 8) return;
        this._giveupT = this.elapsed;
        this.ui.toast(p.e.cfg.name + '放弃了追击，退了回去。', 'good');
      });
      GF.bus.on('sfx', (p) => { if (this.audio[p.kind]) this.audio[p.kind](); });
      GF.bus.on('noise', (p) => this.ents.noise(this.player.x, this.player.y, this.player.z, p.level));
      GF.bus.on('weather', (k) => {
        const names = { clear: '云散了。', overcast: '天色阴了下来。', fog: '雾起来了 —— 能见度很差。', rain: '开始下雨了。', storm: '暴雨。找地方躲。' };
        this.ui.toast(names[k] || k, k === 'storm' ? 'warn' : '');
        if (k === 'storm') this.audio.thunder();
      });
      GF.bus.on('day:new', (d) => { this.ui.toast('第 ' + d + ' 天。你还活着。', 'good'); this.sv.stats.nightsSurvived++; });
      window.addEventListener('beforeunload', () => { try { this.save(); } catch (e) { } });
    }

    /* ================================================ 每帧更新 */
    loop(now) {
      const dt = Math.min(0.05, (now - (this._last || now)) / 1000);
      this._last = now;
      this.elapsed += dt;
      this._frames++; this._fpsT += dt;
      if (this._fpsT > 0.5) { this.fps = Math.round(this._frames / this._fpsT); this._frames = 0; this._fpsT = 0; }

      if (!this.world) { requestAnimationFrame((t) => this.loop(t)); return; }
      if (this.spawning) { requestAnimationFrame((t) => this.loop(t)); return; }
      const modal = this.ui.isModal();
      const alive = this.sv.alive;

      if (!modal && alive) {
        this.updateMovement(dt);
        this.updateMining(dt);
      }
      if (alive) {
        this.world.advanceTime(dt, this.dayLength);
        this.sv.tick(dt, {
          moving: this.movingNow, sprint: this.sprintNow, working: !!this.mining,
        });
        this.sv.spoilTick(dt * (86400 / this.dayLength));
        this.ents.update(dt, this.player, this.sv);
        this.world.randomTick(dt, this.player.x, this.player.y, this.player.z, 1);
      }
      this.updateParticles(dt);
      this.updateLight(dt);
      this.updateFishing(dt);
      this.gunCd = Math.max(0, this.gunCd - dt);
      this.swing = this.swing > 0 ? Math.max(0, this.swing - dt * 3.6) : 0;

      // 世界流式生成
      this.world.pump(this.player.x, this.player.z, 7);
      if (!this._unloadT || this.elapsed - this._unloadT > 4) {
        this._unloadT = this.elapsed;
        this.world.unloadFar(this.player.x, this.player.z, this.renderer.renderDist + 1);
      }

      // 地标发现 / 任务
      if (!this._discT || this.elapsed - this._discT > 1) {
        this._discT = this.elapsed;
        const n = GF.Landmarks.nearest(this.player.x, this.player.z);
        if (n.d < n.l.r * 0.85) this.discover(n.l);
        this.checkQuests();
      }
      // 环境音
      if (!this._ambT || this.elapsed - this._ambT > 1.5) {
        this._ambT = this.elapsed;
        this.audio.ambient({ wind: this.world.weather.wind, rain: this.world.weather.rain });
        if (Math.random() < 0.25) {
          const h = this.ents.nearestHostile(this.player.x, this.player.z, 26);
          if (h && h.e.type.startsWith('zombie')) this.audio.zombie();
        }
      }
      // 雨
      if (this.world.weather.rain > 0.05 && this.particles.length < 900) this.spawnRain(dt);

      this.raycastTarget();
      this.render(dt);
      this.ui.update(dt);
      requestAnimationFrame((t) => this.loop(t));
    }

    /* -------------------------------------------------- 移动 */
    updateMovement(dt) {
      const p = this.player, k = this.keys, w = this.world;
      const fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
      const side = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
      p.crouch = !!k.ControlLeft || !!k.ControlRight;
      const wantSprint = (!!k.ShiftLeft || !!k.ShiftRight) && fwd > 0 && !p.crouch;
      const canSprint = wantSprint && this.sv.stamina > 6 && this.sv.hunger > 8;
      p.sprint = canSprint;

      const overload = this.inv.overloadRatio();
      let speed = 4.25;
      if (p.crouch) speed = 1.7;
      else if (canSprint) speed = 6.35;
      speed *= (1 - U.clamp(overload * 0.55, 0, 0.6));
      speed *= (this.sv.pain > 60 ? 0.82 : 1);
      speed *= (this.sv.temp < 35 ? 0.85 : 1);
      if (this.sv.stamina < 12) speed *= 0.72;
      if (this.sv.hasEffect('boost')) speed *= 1.18;
      for (const kk of GF.EQUIP_SLOTS) {
        const s = this.inv.equip[kk]; if (!s) continue;
        const d = GF.Items.get(s.item); if (d && d.speed) speed *= (1 + d.speed);
      }

      const inWater = w.isLiquid(Math.floor(p.x), Math.floor(p.y + 0.6), Math.floor(p.z));
      const head = w.isLiquid(Math.floor(p.x), Math.floor(p.eyeY), Math.floor(p.z));
      if (inWater) speed *= 0.6;

      // 梯子
      const cur = w.getBlockSafe(Math.floor(p.x), Math.floor(p.y + 0.6), Math.floor(p.z));
      const onLadder = cur > 0 && GF.Blocks.list[cur].climb;

      const B = U.moveBasis(p.yaw);
      let ax = B.fx * fwd + B.rx * side, az = B.fz * fwd + B.rz * side;
      const m = Math.hypot(ax, az);
      if (m > 0) { ax /= m; az /= m; }
      this.movingNow = m > 0;
      this.sprintNow = canSprint && m > 0;

      const accel = (p.onGround || inWater || onLadder) ? 34 : 8;
      p.vx += ax * speed * accel * dt;
      p.vz += az * speed * accel * dt;
      const vh = Math.hypot(p.vx, p.vz);
      // 只在地面上或有输入时限速，这样跳跃中不会被硬生生"减速"
      if (vh > speed && (p.onGround || m > 0)) { p.vx = p.vx / vh * speed; p.vz = p.vz / vh * speed; }

      if (onLadder) {
        p.vy = (k.Space ? 3.4 : (k.ShiftLeft ? -4.2 : (m > 0 ? 2.6 : -0.4)));
      } else if (k.Space) {
        if (inWater) p.vy = Math.min(p.vy + 22 * dt, 3.2);
        else if (p.onGround && this.sv.stamina > 4) {
          p.vy = 8.0 * (1 - overload * 0.22);
          this.sv.stamina -= 3.4;
          this.ents.noise(p.x, p.y, p.z, 4);
        }
      }

      const before = { x: p.x, z: p.z };
      p.physics(w, dt);
      const moved = Math.hypot(p.x - before.x, p.z - before.z);
      this.sv.stats.distance += moved;

      // 脚步声与噪音
      p.stepDist += moved;
      const stride = p.crouch ? 1.5 : canSprint ? 1.05 : 1.35;
      if (p.stepDist > stride && (p.onGround || inWater)) {
        p.stepDist = 0;
        const gb = w.getBlockSafe(Math.floor(p.x), Math.floor(p.y - 0.2), Math.floor(p.z));
        const mat = gb > 0 ? GF.Blocks.list[gb].step : 'dirt';
        this.audio.step(inWater ? 'mud' : mat);
        const base = p.crouch ? 2 : canSprint ? 13 : 7;
        const quiet = this.inv.quietness();
        const lvl = base * (1 - quiet) * (mat === 'plank_floor' ? 0.7 : 1) * (1 + overload * 0.5);
        p.noiseLevel = lvl;
        this.ents.noise(p.x, p.y, p.z, lvl);
      } else if (moved < 0.001) p.noiseLevel = Math.max(0, p.noiseLevel - dt * 8);

      // 窒息
      if (head) {
        p.swimT += dt;
        if (p.swimT > 14) { p.hp -= dt * 6; if (Math.random() < dt * 3) this.spawnParticles(p.x, p.eyeY, p.z, 3, [0.7, 0.85, 0.95], 0.05, 0.04); }
      } else p.swimT = Math.max(0, p.swimT - dt * 3);

      // 尖刺方块伤害（碎玻璃/铁蒺藜）
      const footId = w.getBlockSafe(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
      if (footId > 0) {
        const fb = GF.Blocks.list[footId];
        if ((fb.key === 'barbed_wire' || fb.key === 'glass_broken') && !this._spikeT) {
          const boots = this.inv.equip.feet;
          const bd = boots ? GF.Items.get(boots.item) : null;
          if (!bd || !bd.spikeImmune) {
            this.sv.takeHit(fb.key === 'barbed_wire' ? 6 : 3, { bleed: 0.6 });
            this.ui.toast(fb.name + '划伤了你 —— 工装靴能免疫。', 'bad');
          }
          this._spikeT = 1.2;
        }
        if (fb.key === 'barbed_wire') { p.vx *= 0.3; p.vz *= 0.3; }
      }
      if (this._spikeT) this._spikeT = Math.max(0, this._spikeT - dt);

      this.bobPhase += moved * 3.2;
    }

    /* -------------------------------------------------- 射线目标 */
    raycastTarget() {
      const p = this.player;
      const d = p.dirVec();
      const reach = this.reach();
      const hit = this.world.raycast(p.x, p.eyeY, p.z, d[0], d[1], d[2], reach);
      this.target = hit;
      if (!hit) { this.ui.setTarget(null); return; }
      const b = hit.block;
      const held = this.inv.held();
      const hd = held ? GF.Items.get(held.item) : null;
      const info = { name: b.name };
      // 采集需求
      const bi = GF.Blocks.breakInfo(b, hd && hd.tool ? hd.tool : null);
      if (b.loot) info.action = '右键搜刮';
      else if (b.station) info.action = '右键使用（' + (GF.Recipes.STATIONS[b.station] ? GF.Recipes.STATIONS[b.station].name : b.station) + '）';
      else if (b.door) info.action = '右键开关';
      else if (b.bed) info.action = '右键休息';
      else if (b.key === 'radio_console') info.action = '右键操作电台';
      else if (b.key === 'door_locked') info.action = '需要钥匙卡';
      if (!bi.ok) info.warn = bi.why;
      else if (b.hard < 1e8) info.sub = `${bi.seconds.toFixed(1)}s`;
      if (b.desc) info.sub = (info.sub ? info.sub + ' · ' : '') + b.desc;
      this.ui.setTarget(info);
    }
    reach() {
      const held = this.inv.held();
      const d = held ? GF.Items.get(held.item) : null;
      return 4.6 + (d && d.reach ? d.reach - 4.2 : 0);
    }

    /* -------------------------------------------------- 挖掘 */
    updateMining(dt) {
      if (!this.mouse.l) { this.mining = null; this.ui.setProgress(0); return; }
      const held = this.inv.held();
      const hd = held ? GF.Items.get(held.item) : null;
      if (hd && hd.gun) return;                       // 持枪时左键是射击
      const t = this.target;
      if (!t) { this.mining = null; this.ui.setProgress(0); return; }
      const b = t.block;
      const bi = GF.Blocks.breakInfo(b, hd && hd.tool ? hd.tool : null);
      if (!bi.ok) {
        this.mining = null; this.ui.setProgress(0);
        if (!this._warnT || this.elapsed - this._warnT > 1.4) {
          this._warnT = this.elapsed;
          this.ui.toast(bi.why + '（当前：' + (hd ? hd.name : '徒手') + '）', 'warn');
          this.audio.error();
        }
        return;
      }
      const key = t.x + ',' + t.y + ',' + t.z;
      if (!this.mining || this.mining.key !== key) this.mining = { key, t: 0, total: bi.seconds, x: t.x, y: t.y, z: t.z };
      const staminaFactor = this.sv.stamina > 5 ? 1 : 0.45;
      this.mining.t += dt * staminaFactor;
      this.swing = Math.max(this.swing, 0.35);
      this.ui.setProgress(this.mining.t / this.mining.total);
      if (Math.random() < dt * 5.5) {
        this.audio.mine(b.step);
        const col = avgColor(b.tex.side || b.tex.all || b.tex.top);
        this.spawnParticles(t.x + 0.5, t.y + 0.5, t.z + 0.5, 2, col, 0.05, 0.045);
      }
      if (this.mining.t >= this.mining.total) {
        this.breakBlock(t.x, t.y, t.z);
        this.mining = null; this.ui.setProgress(0);
      }
    }

    breakBlock(x, y, z) {
      const w = this.world;
      const id = w.getBlock(x, y, z);
      if (id <= 0) return;
      const b = GF.Blocks.list[id];
      const held = this.inv.held();
      const hd = held ? GF.Items.get(held.item) : null;

      // 容器：先把里面的东西倒出来
      if (b.loot) {
        const c = w.containerAt(x, y, z);
        if (c && c.items && c.items.length) { this.ui.toast('先把里面的东西拿走。', 'warn'); this.openContainer(x, y, z); return; }
      }
      // 掉落
      const drops = [];
      for (const d of (b.drops || [])) {
        if (d.chance != null && Math.random() > d.chance) continue;
        const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
        if (n > 0) drops.push({ item: d.item, n });
      }
      let overflow = [];
      for (const d of drops) { const rem = this.inv.add(d.item, d.n); if (rem > 0) overflow.push({ item: d.item, n: rem }); }
      if (overflow.length) { this.ui.toast('背包放不下了，掉在地上。', 'warn'); }
      w.setBlock(x, y, z, 0);
      if (overflow.length) this.dropContainer(x, y, z, overflow);

      // 上方的植物/火把会掉下来
      const above = w.getBlock(x, y + 1, z);
      if (above > 0 && GF.Blocks.list[above].support) {
        const ab = GF.Blocks.list[above];
        for (const d of (ab.drops || [])) if (Math.random() <= (d.chance == null ? 1 : d.chance)) this.inv.add(d.item, d.min);
        w.setBlock(x, y + 1, z, 0);
      }

      // 徒手割伤
      if (!b.tool && (b.key === 'glass_broken' || b.key === 'barbed_wire' || b.key === 'thick_vine')) {
        const gl = this.inv.equip.hands, gd = gl ? GF.Items.get(gl.item) : null;
        if (!gd || !gd.noHandCut) {
          if (Math.random() < 0.35) { this.sv.takeHit(2, { bleed: 0.5 }); this.ui.toast('手被划开了 —— 戴上手套。', 'bad'); }
        }
      }
      // 工具磨损
      if (b.tool && held && hd && hd.tool) {
        const idx = this.inv.sel;
        this.inv.damageTool(idx, Math.max(1, Math.round(b.hard * 0.6)));
      }
      this.audio.breakBlock(b.step);
      const col = avgColor(b.tex.side || b.tex.all || b.tex.top);
      this.spawnParticles(x + 0.5, y + 0.5, z + 0.5, 9, col, 0.085, 0.06);
      this.ents.noise(x, y, z, b.tool ? 12 : 5);
      this.sv.stats.blocksMined++;
      this.sv.stamina = Math.max(0, this.sv.stamina - (b.tool ? 1.2 : 0.4));
      // 任务旗标
      if (b.key.startsWith('crop_') && b.key.endsWith('_3')) this.flags.harvested = (this.flags.harvested || 0) + 1;
      GF.bus.emit('block:broken', { x, y, z, block: b });
    }

    dropContainer(x, y, z, items) {
      const w = this.world;
      let py = y;
      for (let i = 0; i < 4; i++) { if (w.getBlock(x, py, z) === 0) break; py++; }
      w.setBlock(x, py, z, GF.Blocks.ID.backpack_drop);
      const c = w.containerAt(x, py, z);
      if (c) { c.items = items.map((i) => ({ item: i.item, n: i.n, dur: i.dur || null })); c.table = null; }
    }

    dropAllOnDeath() {
      const items = [];
      for (let i = 0; i < this.inv.slots.length; i++) {
        const s = this.inv.slots[i];
        if (s) { items.push(s); this.inv.slots[i] = null; }
      }
      if (items.length) this.dropContainer(Math.floor(this.player.x), Math.floor(this.player.y), Math.floor(this.player.z), items);
    }

    /* -------------------------------------------------- 左键动作 */
    onPrimary() {
      const held = this.inv.held();
      const hd = held ? GF.Items.get(held.item) : null;
      this.swing = 1;
      if (hd && hd.gun) { this.shoot(hd, held); return; }
      // 近战
      const reach = this.reach();
      const e = this.ents.meleeHit(this.player, reach, 0.6);
      if (e) {
        const dmg = hd && hd.tool ? hd.tool.dmg : 3;
        const real = e.hurt(dmg * (0.85 + Math.random() * 0.3), this.player);
        if (hd && hd.bleedChance && Math.random() < hd.bleedChance) e.bleeding += 0.8;
        this.audio.hit(); this.ui.hitMark();
        this.spawnParticles(e.x, e.y + e.cfg.h * 0.6, e.z, 6, [0.5, 0.12, 0.12], 0.07, 0.045);
        this.sv.stamina = Math.max(0, this.sv.stamina - 3.2);
        this.ents.noise(this.player.x, this.player.y, this.player.z, 9);
        if (hd && hd.tool) this.inv.damageTool(this.inv.sel, 2);
        return;
      }
      if (hd && hd.throwable) { this.throwItem(hd); return; }
    }

    /* -------------------------------------------------- 右键动作 */
    onSecondary() {
      const t = this.target;
      const held = this.inv.held();
      const hd = held ? GF.Items.get(held.item) : null;

      // 瞄准
      if (hd && (hd.gun || hd.grants === 'zoom')) this.aiming = true;

      /* --- 与方块交互优先 --- */
      if (t) {
        const b = t.block;
        // 上锁的门
        if (b.key === 'door_locked') {
          const need = ['keycard_yellow', 'keycard_red', 'keycard_blue'];
          const have = need.find((k) => this.inv.count(k) > 0);
          if (have) {
            this.world.setBlock(t.x, t.y, t.z, 0);
            this.flags['used_' + have] = true;
            this.ui.toast('用' + GF.Items.nameOf(have) + '打开了门。', 'good');
            this.audio.place();
          } else this.ui.toast('锁死了。需要钥匙卡，或者用撬棍慢慢拆。', 'warn');
          return;
        }
        if (b.door) { this.world.setBlock(t.x, t.y, t.z, GF.Blocks.ID[b.door]); this.audio.place(); this.ents.noise(t.x, t.y, t.z, 6); return; }
        if (b.loot) { this.openContainer(t.x, t.y, t.z); return; }
        if (b.key === 'radio_console') { this.ui.openPanel('radio'); document.exitPointerLock(); return; }
        if (b.bed) {
          this.spawnPoint = { x: t.x + 0.5, y: t.y + 1.2, z: t.z + 0.5 };
          this.flags.bedSet = true;
          this.ui.openPanel('sleep'); document.exitPointerLock(); return;
        }
        if (b.station) {
          this.ui.craftStation = b.station;
          this.ui.openPanel('craft'); document.exitPointerLock(); return;
        }
        // 成熟作物直接收获
        if (b.key.startsWith('crop_') && b.key.endsWith('_3')) { this.breakBlock(t.x, t.y, t.z); return; }
        // 铲子造耕地
        if (hd && hd.tool && hd.tool.type === 'shovel' && (b.key === 'grass' || b.key === 'dirt' || b.key === 'rich_soil' || b.key === 'moss_ground')) {
          this.world.setBlock(t.x, t.y, t.z, GF.Blocks.ID.farmland);
          this.inv.damageTool(this.inv.sel, 2);
          this.audio.place(); this.ui.toast('翻好了一块地。');
          return;
        }
        // 浇水（手持水桶 + 背包里有水）
        if (hd && (hd.key === 'bucket' || hd.key === 'bucket_empty') && b.key === 'farmland') {
          const src = ['water_dirty_bottle', 'rain_water', 'water_clean_bottle'].find((k) => this.inv.count(k) > 0);
          if (src) {
            this.inv.remove(src, 1);
            this.inv.add('bottle_empty', 1);
            this.world.setBlock(t.x, t.y, t.z, GF.Blocks.ID.farmland_wet);
            this.ui.toast('浇过水的地长得快得多。');
            this.audio.drink();
          } else this.ui.toast('桶是空的 —— 先去水边装水。', 'warn');
          return;
        }
        // 播种
        if (hd && hd.seed) {
          const below = b.key;
          if (below === 'farmland' || below === 'farmland_wet' || below === 'planter' || below === 'rich_soil') {
            if (this.world.getBlock(t.x, t.y + 1, t.z) === 0) {
              this.world.setBlock(t.x, t.y + 1, t.z, GF.Blocks.ID[hd.seed + '_0']);
              this.inv.remove(held.item, 1);
              this.audio.place(); this.ui.toast('播下了' + hd.name + '。');
              return;
            }
          } else { this.ui.toast('需要耕地或育苗箱。', 'warn'); return; }
        }
        // 点火
        if (hd && hd.igniter && (b.key === 'campfire' || b.key === 'log_oak' || b.key === 'planks')) {
          this.ents.noise(t.x, t.y, t.z, 8);
          this.ui.toast('火点起来了。');
          this.flags.litFire = true;
          this.audio.place();
          return;
        }
        // 钓鱼（手持钓竿对着水面）
        if (hd && hd.fish && b.liquid) { this.startFishing(); return; }
        // 装水（对着水面右键；空手也可以，只要背包里有空容器）
        if (b.liquid) { this.fillWater(held, hd, b); return; }
        // 净水器
        if (hd && hd.purify) { this.purify(); return; }
      }

      /* --- 手持物自身用途 --- */
      if (hd) {
        if (hd.schematic) {
          if (this.unlocks[hd.schematic]) this.ui.toast('这份图纸你已经掌握了。', 'warn');
          else {
            this.unlocks[hd.schematic] = true;
            this.inv.remove(held.item, 1);
            this.ui.toast('掌握了新技术：' + GF.Recipes.UNLOCKS[hd.schematic], 'good');
            this.audio.quest();
          }
          return;
        }
        if (hd.note) {
          this.notes.add(hd.note);
          this.inv.remove(held.item, 1);
          this.ui.openPanel('note', hd.note); document.exitPointerLock();
          this.audio.quest();
          return;
        }
        if (hd.key === 'map_fragment') {
          const undisc = GF.Landmarks.list.filter((l) => !this.discovered.has(l.key));
          if (undisc.length) {
            const l = undisc[Math.floor(Math.random() * undisc.length)];
            this.discover(l, true);
            this.inv.remove('map_fragment', 1);
            this.ui.toast('地图碎片揭示了：' + l.name + ' (' + l.x + ', ' + l.z + ')', 'good');
          } else this.ui.toast('地图已经完整了。');
          return;
        }
        if (hd.food || hd.drink || hd.med) {
          const msg = this.sv.consume(this.inv.sel);
          if (msg) this.ui.toast(msg);
          if (hd.drink && !hd.drink.sick) this.flags.drankClean = true;
          if (hd.key === 'vaccine_proto') { this.flags.usedVaccine = true; this.ui.toast('注射完成。你感到一阵灼热，然后是奇异的平静。', 'good'); }
          return;
        }
        if (hd.armor) { this.inv.equipFrom(this.inv.sel); this.audio.ui(); return; }
        if (hd.place) { this.placeBlock(hd, held); return; }
        if (hd.fluid) { const s = this.drinkFrom(held, hd); if (s) return; }
      }
      // 空手：吃/捡
      if (!t) this.ui.toast('这里没什么可以做的。');
    }

    /* -------------------------------------------------- 放置方块 */
    placeBlock(hd, held) {
      const t = this.target;
      if (!t) { this.ui.toast('对着一个表面放置。', 'warn'); return; }
      const bx = t.x + t.nx, by = t.y + t.ny, bz = t.z + t.nz;
      const w = this.world;
      if (w.getBlock(bx, by, bz) !== 0 && !w.isLiquid(bx, by, bz)) { this.audio.error(); return; }
      const blockKey = hd.place;
      const nb = GF.Blocks.byKey[blockKey];
      if (!nb) return;
      // 不能卡住自己
      const p = this.player;
      if (nb.solid && GF.collides(w, p.x, p.y, p.z, 0.3, 1.8) === false) {
        const px0 = Math.floor(p.x - 0.3), px1 = Math.floor(p.x + 0.3);
        const pz0 = Math.floor(p.z - 0.3), pz1 = Math.floor(p.z + 0.3);
        const py0 = Math.floor(p.y), py1 = Math.floor(p.y + 1.79);
        if (bx >= px0 && bx <= px1 && bz >= pz0 && bz <= pz1 && by >= py0 && by <= py1) {
          this.ui.toast('你站在那里。', 'warn'); return;
        }
      }
      // 支撑检查（更贴近现实：不能凭空放）
      const supported = w.isSolid(bx, by - 1, bz) || w.isSolid(bx, by + 1, bz)
        || w.isSolid(bx - 1, by, bz) || w.isSolid(bx + 1, by, bz)
        || w.isSolid(bx, by, bz - 1) || w.isSolid(bx, by, bz + 1);
      if (!supported) { this.ui.toast('悬空放不住 —— 需要有依托。', 'warn'); this.audio.error(); return; }
      if (nb.support && !w.isSolid(bx, by - 1, bz) && !nb.climb) { this.ui.toast('这个需要放在实心方块上。', 'warn'); return; }
      // 火源需要点火物
      if (nb.station === 'fire' && nb.key === 'campfire') {
        const ign = this.inv.slots.find((s) => s && GF.Items.get(s.item) && GF.Items.get(s.item).igniter);
        if (!ign) { this.ui.toast('没有火源 —— 需要火柴、打火机或钻木取火弓。', 'warn'); return; }
        this.flags.litFire = true;
      }
      w.setBlock(bx, by, bz, nb.id);
      this.inv.remove(held.item, 1);
      this.audio.place();
      this.ents.noise(bx, by, bz, 4);
      if (nb.key === 'workbench') this.flags.builtBench = true;
      if (nb.key === 'forge') this.flags.builtForge = true;
      if (nb.bed) { this.spawnPoint = { x: bx + 0.5, y: by + 1.2, z: bz + 0.5 }; this.flags.bedSet = true; this.ui.toast('重生点已设置。', 'good'); }
      GF.bus.emit('block:placed', { x: bx, y: by, z: bz, block: nb });
    }

    /* -------------------------------------------------- 水与容器 */
    // 水以"瓶"为单位：装水需要空瓶（塑料×3 可做），提桶一次能装 4 瓶
    fillWater(held, hd, b) {
      const empties = this.inv.count('bottle_empty') + this.inv.count('can_empty');
      if (empties <= 0) {
        this.ui.toast('需要空容器 —— 空瓶（塑料 ×3）或搜刮到的空罐头。', 'warn');
        this.audio.error();
        return;
      }
      const isBucket = hd && (hd.key === 'bucket' || hd.key === 'bucket_empty');
      let n = Math.min(isBucket ? 4 : 1, empties);
      let taken = 0;
      for (const k of ['bottle_empty', 'can_empty']) {
        while (taken < n && this.inv.count(k) > 0) { this.inv.remove(k, 1); taken++; }
      }
      this.inv.add('water_dirty_bottle', taken);
      this.ui.toast(`装了 ${taken} 瓶生水。直接喝有 60% 概率生病 —— 用锅或空罐在火上煮沸。`, 'warn');
      this.audio.drink();
    }
    drinkFrom(held, hd) {
      if (this.inv.count('water_clean_bottle') > 0) {
        const i = this.inv.slots.findIndex((s) => s && s.item === 'water_clean_bottle');
        this.sv.consume(i); this.flags.drankClean = true; return true;
      }
      return false;
    }
    purify() {
      const n = this.inv.count('water_dirty_bottle');
      if (!n) { this.ui.toast('没有生水可以过滤。', 'warn'); return; }
      if (this.inv.count('charcoal_filter') < 1) { this.ui.toast('净水器需要活性炭滤芯。', 'warn'); return; }
      const k = Math.min(n, 3);
      this.inv.remove('water_dirty_bottle', k);
      this.inv.add('water_clean_bottle', k);
      if (Math.random() < 0.34) this.inv.remove('charcoal_filter', 1);
      this.ui.toast('过滤了 ' + k + ' 瓶净水。', 'good');
      this.audio.craft();
    }

    startFishing() {
      if (this.fishing) return;
      this.fishing = { t: 0, need: 5 + Math.random() * 9 };
      this.ui.toast('抛出鱼线……安静地等。');
    }
    updateFishing(dt) {
      if (!this.fishing) return;
      if (!this.mouse.r) { this.fishing = null; return; }
      this.fishing.t += dt;
      this.ui.setProgress(this.fishing.t / this.fishing.need);
      if (this.fishing.t >= this.fishing.need) {
        this.fishing = null; this.ui.setProgress(0);
        const r = Math.random();
        if (r < 0.62) { this.inv.add('fish_raw', 1); this.ui.toast('钓上来一条鱼。', 'good'); }
        else if (r < 0.72) { this.inv.add('reed_stalk', 2); this.ui.toast('钓上来一把水草。'); }
        else if (r < 0.8) { this.inv.add('scrap_metal', 1); this.ui.toast('钓上来一块废铁。'); }
        else this.ui.toast('鱼跑了。');
        this.inv.damageTool(this.inv.sel, 1);
        this.audio.craft();
      }
    }

    /* -------------------------------------------------- 枪械 */
    shoot(hd, held) {
      if (this.gunCd > 0) return;
      const g = hd.gun;
      const mag = held.mag || 0;
      if (mag <= 0) {
        if (this.inv.count(g.ammo) > 0) { this.ui.toast('弹匣空了 —— 按 R 装填。', 'warn'); }
        else this.ui.toast('没有' + GF.Items.nameOf(g.ammo) + '。', 'warn');
        this.audio.error();
        this.gunCd = 0.4;
        return;
      }
      held.mag = mag - 1;
      this.gunCd = 60 / g.rpm;
      const p = this.player, d = p.dirVec();
      const supp = this.inv.count('suppressor') > 0 && (hd.key === 'pistol_9mm' || hd.key === 'smg_9mm');
      const noise = g.noise * (supp ? 0.42 : 1) * (g.kind === 'bow' ? 1 : 1);
      if (g.kind === 'bow') this.audio.bow(); else this.audio.gunshot(noise > 30);
      this.ents.noise(p.x, p.y, p.z, noise);
      this.spawnParticles(p.x + d[0] * 0.8, p.eyeY + d[1] * 0.8 - 0.15, p.z + d[2] * 0.8, 5, [0.9, 0.85, 0.6], 0.1, 0.085);
      const pellets = g.pellets || 1;
      let hitAny = false;
      for (let i = 0; i < pellets; i++) {
        const sp = g.spread * (this.aiming ? 0.45 : 1) * (this.sv.stamina < 20 ? 1.6 : 1);
        const dx = d[0] + (Math.random() - 0.5) * sp * 2, dy = d[1] + (Math.random() - 0.5) * sp * 2, dz = d[2] + (Math.random() - 0.5) * sp * 2;
        const m = Math.hypot(dx, dy, dz);
        const r = this.ents.rayHit(p.x, p.eyeY, p.z, dx / m, dy / m, dz / m, 120);
        const bh = this.world.raycast(p.x, p.eyeY, p.z, dx / m, dy / m, dz / m, 120);
        if (r && (!bh || r.t < bh.dist)) {
          r.e.hurt(g.dmg * (0.85 + Math.random() * 0.3), p);
          r.e.bleeding += 0.5;
          hitAny = true;
          this.spawnParticles(r.e.x, r.e.y + r.e.cfg.h * 0.6, r.e.z, 8, [0.5, 0.1, 0.1], 0.1, 0.045);
        } else if (bh) {
          const col = avgColor(bh.block.tex.side || bh.block.tex.all || bh.block.tex.top);
          this.spawnParticles(bh.x + 0.5, bh.y + 0.5, bh.z + 0.5, 4, col, 0.08, 0.05);
        }
      }
      if (hitAny) this.ui.hitMark();
      this.swing = 0.6;
    }

    reload() {
      const held = this.inv.held();
      const hd = held ? GF.Items.get(held.item) : null;
      if (!hd || !hd.gun) return;
      const g = hd.gun;
      const have = this.inv.count(g.ammo);
      if (!have) { this.ui.toast('没有' + GF.Items.nameOf(g.ammo) + '。', 'warn'); this.audio.error(); return; }
      const cur = held.mag || 0;
      const need = g.mag - cur;
      const take = Math.min(need, have);
      if (take <= 0) return;
      this.inv.remove(g.ammo, take);
      held.mag = cur + take;
      this.audio.place();
      this.ui.toast('装填 ' + (cur + take) + '/' + g.mag);
      this.gunCd = g.kind === 'bow' ? g.draw : 1.4;
    }

    throwItem(hd) {
      const p = this.player, d = p.dirVec();
      this.inv.remove(this.inv.held().item, 1);
      const kind = hd.throwable;
      const tx = p.x + d[0] * 12, ty = p.eyeY + d[1] * 12, tz = p.z + d[2] * 12;
      const hit = this.world.raycast(p.x, p.eyeY, p.z, d[0], d[1], d[2], 14);
      const ex = hit ? hit.x + 0.5 : tx, ey = hit ? hit.y + 0.5 : ty, ez = hit ? hit.z + 0.5 : tz;
      if (kind === 'lure') {
        this.ents.noise(ex, ey, ez, 34);
        this.ui.toast('响声在远处炸开 —— 它们朝那边去了。');
        this.audio.gunshot(false);
      } else if (kind === 'frag') {
        this.audio.gunshot(true);
        this.spawnParticles(ex, ey, ez, 40, [0.95, 0.8, 0.4], 0.3, 0.16);
        for (const e of this.ents.list.slice()) {
          const dd = Math.hypot(e.x - ex, e.y - ey, e.z - ez);
          if (dd < 6) e.hurt(70 * (1 - dd / 6), p);
        }
        this.ents.noise(ex, ey, ez, 60);
      } else if (kind === 'fire') {
        this.audio.breakBlock('glass');
        this.spawnParticles(ex, ey, ez, 46, [1.0, 0.55, 0.15], 0.26, 0.18);
        for (const e of this.ents.list.slice()) {
          const dd = Math.hypot(e.x - ex, e.y - ey, e.z - ez);
          if (dd < 4.5) { e.hurt(35, p); e.bleeding += 0.6; }
        }
        this.ents.noise(ex, ey, ez, 26);
      } else if (kind === 'smoke') {
        this.spawnParticles(ex, ey, ez, 90, [0.8, 0.82, 0.8], 0.2, 0.3);
        for (const e of this.ents.list) if (Math.hypot(e.x - ex, e.z - ez) < 8) { e.state = 'idle'; e.alertT = 0; }
        this.ui.toast('烟雾弥漫开来。');
      }
      this.swing = 1;
    }

    /* -------------------------------------------------- 容器 */
    openContainer(x, y, z) {
      const c = this.world.containerAt(x, y, z);
      if (!c) return;
      c.opened = true;
      this.ui.openPanel('container', { x, y, z });
      document.exitPointerLock();
      this.audio.ui();
      // 首次开箱的关键物品提示
      if (c.items) for (const s of c.items) {
        const d = GF.Items.get(s.item);
        if (d && (d.schematic || d.note || d.radioPart || d.unlocks)) {
          this.ui.toast('里面有重要的东西。', 'good'); break;
        }
      }
    }
    takeAll() {
      if (!this.ui.container) return;
      const arr = this.ui.container.data.items;
      let full = false;
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i]; if (!s) continue;
        const rem = this.inv.add(s.item, s.n, s.dur);
        if (rem === 0) arr[i] = null; else { s.n = rem; full = true; }
      }
      if (full) this.ui.toast('背包装不下全部。', 'warn'); else this.audio.ui();
    }

    /* -------------------------------------------------- 合成 */
    nearbyStations() {
      const p = this.player, w = this.world;
      const out = Object.create(null);
      const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
      for (let dy = -1; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const id = w.getBlock(px + dx, py + dy, pz + dz);
        if (id <= 0) continue;
        const b = GF.Blocks.list[id];
        if (b.station) out[b.station] = true;
      }
      return out;
    }

    craft(rid) {
      const r = GF.Recipes.all[rid];
      if (!r) return false;
      if (!GF.Recipes.known(r, this.unlocks)) { this.ui.toast('还没有掌握这个配方。', 'warn'); return false; }
      if (r.station !== 'hand') {
        const near = this.nearbyStations();
        if (!near[r.station]) { this.ui.toast('需要靠近' + GF.Recipes.STATIONS[r.station].name + '。', 'warn'); this.audio.error(); return false; }
      }
      if (!this.inv.hasAll(r.ins)) { this.ui.toast('材料不够。', 'warn'); this.audio.error(); return false; }
      if (r.need && !this.inv.hasToolType(r.need)) { this.ui.toast('需要' + (GF.Blocks.NEED_TOOL_NAME[r.need] || r.need) + '类工具。', 'warn'); this.audio.error(); return false; }
      if (r.needItem && !this.inv.hasItem(r.needItem)) { this.ui.toast('需要 ' + GF.Items.nameOf(r.needItem) + '。', 'warn'); this.audio.error(); return false; }
      // 燃料
      if (r.fuel) {
        const fi = this.inv.slots.findIndex((s) => s && GF.Items.get(s.item) && GF.Items.get(s.item).fuel);
        if (fi < 0) { this.ui.toast('需要燃料（树枝、木炭、煤…）。', 'warn'); this.audio.error(); return false; }
        this.inv.slots[fi].n -= 1;
        if (this.inv.slots[fi].n <= 0) this.inv.slots[fi] = null;
      }
      this.inv.removeAll(r.ins);
      const left = this.inv.add(r.out, r.n);
      if (left > 0) { this.ui.toast('背包放不下产物，掉在脚下。', 'warn'); this.dropContainer(Math.floor(this.player.x), Math.floor(this.player.y), Math.floor(this.player.z), [{ item: r.out, n: left }]); }
      this.sv.stamina = Math.max(0, this.sv.stamina - Math.min(18, r.time * 0.35));
      this.sv.stats.itemsCrafted++;
      this.audio.craft();
      this.ui.toast('制作完成：' + GF.Items.nameOf(r.out) + (r.n > 1 ? ' ×' + r.n : ''), 'good');
      // 任务旗标
      if (r.out.startsWith('axe_')) this.flags.craftedAxe = true;
      if (r.out === 'iron_ingot') this.flags.gotIron = true;
      if (r.out === 'workbench_item') this.flags.hasBenchItem = true;
      if (r.out === 'water_clean_bottle') this.flags.boiledWater = true;
      GF.bus.emit('craft', r);
      return true;
    }

    /* -------------------------------------------------- 使用物品槽 */
    useItemSlot(i) {
      const s = this.inv.slots[i];
      if (!s) return;
      const d = GF.Items.get(s.item);
      if (!d) return;
      if (d.food || d.drink || d.med) {
        const msg = this.sv.consume(i);
        if (msg) this.ui.toast(msg);
        if (d.drink && !d.drink.sick) this.flags.drankClean = true;
        this.ui.rerender();
      } else if (d.armor) { this.inv.equipFrom(i); this.audio.ui(); this.ui.rerender(); }
      else if (d.schematic) {
        if (!this.unlocks[d.schematic]) {
          this.unlocks[d.schematic] = true; this.inv.remove(s.item, 1);
          this.ui.toast('掌握了新技术：' + GF.Recipes.UNLOCKS[d.schematic], 'good'); this.audio.quest();
        }
        this.ui.rerender();
      } else if (d.note) {
        this.notes.add(d.note); this.inv.remove(s.item, 1);
        this.ui.openPanel('note', d.note);
      }
    }

    dropOne() {
      const s = this.inv.held();
      if (!s) return;
      const p = this.player;
      const d = p.dirVec();
      const x = Math.floor(p.x + d[0] * 1.6), y = Math.floor(p.y), z = Math.floor(p.z + d[2] * 1.6);
      this.dropContainer(x, y, z, [{ item: s.item, n: 1, dur: s.dur }]);
      this.inv.remove(s.item, 1);
      this.ui.toast('丢下了 ' + GF.Items.nameOf(s.item) + '。');
    }

    /* -------------------------------------------------- 光源 */
    toggleLight() {
      const src = this.inv.slots.find((s) => s && GF.Items.get(s.item) && GF.Items.get(s.item).light);
      const eq = GF.EQUIP_SLOTS.map((k) => this.inv.equip[k]).find((s) => s && GF.Items.get(s.item) && GF.Items.get(s.item).light);
      if (!src && !eq) { this.ui.toast('没有可用的光源（手电筒 / 头灯 / 油灯）。', 'warn'); return; }
      const d = GF.Items.get((src || eq).item);
      if (d.needBattery && this.inv.count('battery') === 0 && !this.lightOn) { this.ui.toast('没有电池。', 'warn'); return; }
      this.lightOn = !this.lightOn;
      this.ui.toast(this.lightOn ? '打开了' + d.name + '。' : '关闭了光源。');
      this.audio.ui();
    }
    updateLight(dt) {
      if (!this.lightOn) { this.handLight = 0; return; }
      this.handLight = 0.55;
      this._batT = (this._batT || 0) + dt;
      if (this._batT > 60) {
        this._batT = 0;
        const src = this.inv.slots.find((s) => s && GF.Items.get(s.item) && GF.Items.get(s.item).needBattery);
        if (src) {
          if (this.inv.count('battery') > 0) {
            if (Math.random() < 0.5) { this.inv.remove('battery', 1); this.inv.add('battery_dead', 1); }
          } else { this.lightOn = false; this.ui.toast('电池耗尽了。', 'warn'); }
        }
      }
    }

    /* -------------------------------------------------- 睡眠 */
    doSleep(hours) {
      // 附近有敌人不能睡
      const h = this.ents.nearestHostile(this.player.x, this.player.z, 16);
      if (h) { this.ui.toast('附近有东西在动 —— 睡不着。', 'warn'); return; }
      this.sv.sleep(hours);
      this.ui.toast('睡了 ' + hours + ' 小时。' + (this.sv.infection > 0 ? '感染在恶化。' : ''), this.sv.infection > 0 ? 'warn' : 'good');
      for (const [k, c] of this.world.chunks) { c.litDirty = true; c.meshDirty = true; }
    }

    respawn() {
      const sp = this.spawnPoint || { x: 8.5, y: 60, z: 8.5 };
      const p = this.player;
      p.x = sp.x; p.y = sp.y; p.z = sp.z;
      p.vx = p.vy = p.vz = 0;
      p.hp = p.maxHp * 0.55;
      this.sv.alive = true;
      this.sv.hunger = Math.max(35, this.sv.hunger);
      this.sv.thirst = Math.max(35, this.sv.thirst);
      this.sv.bleed = 0; this.sv.temp = 37; this.sv.sick = Math.max(0, this.sv.sick - 40);
      this.sv.infection = Math.max(0, this.sv.infection - 30);
      this.sv.fatigue = 20;
      this.sv.deathCause = null;
      this.ui.toast('你又醒了。物品掉在死的地方。', 'warn');
      this.canvas.requestPointerLock();
    }

    /* -------------------------------------------------- 主线：电台 */
    installRadioPart(k) {
      if (this.inv.count(k) <= 0) return;
      this.inv.remove(k, 1);
      this.flags['installed_' + k] = true;
      this.ui.toast('装上了 ' + GF.Items.nameOf(k) + '。', 'good');
      this.audio.craft();
    }
    radioPowered() {
      const p = this.player, w = this.world;
      const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
      for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) for (let dy = -2; dy <= 2; dy++) {
        const id = w.getBlock(px + dx, py + dy, pz + dz);
        if (id > 0) {
          const b = GF.Blocks.list[id];
          if (b.key === 'generator' && (this.flags.generatorFueled || this.inv.count('diesel_jug') > 0 || this.inv.count('fuel_can') > 0)) return true;
          if (b.key === 'solar_panel' && this.world.sunLevel() > 0.5) return true;
        }
      }
      return false;
    }
    sendSignal() {
      if (this.inv.count('diesel_jug') > 0) this.inv.remove('diesel_jug', 1);
      else if (this.inv.count('fuel_can') > 0) this.inv.remove('fuel_can', 1);
      this.flags.generatorFueled = true;
      this.flags.signalSent = true;
      this.audio.quest();
      const hasVax = this.inv.count('vaccine_proto') > 0 || this.flags.usedVaccine;
      const text = hasVax
        ? '……嘶……收到，长风。我们看到你的信号了。\n带上样本，向西南 40 公里，河谷有一处收容点。\n还有人活着。你也一样。\n\n【结局 A：一线希望】'
        : '……嘶……收到你的信号了，长风。\n我们没有疫苗，也守不了多久，但门是开着的。\n向西南走。别停。\n\n【结局 B：把门开着】';
      this.ui.el.modal.innerHTML = this.ui.frame('信号已发出', `<div class="ending"><pre>${text}</pre>
        <p class="sub">你可以继续在这个世界里活下去。</p><button class="btn big" id="cont">继续</button></div>`, 'center', true);
      this.ui.panel = 'ending';
      this.ui.el.modal.classList.add('show');
      document.getElementById('cont').onclick = () => this.ui.closePanel();
      document.exitPointerLock();
    }

    /* -------------------------------------------------- 地标发现 */
    discover(l, silent) {
      if (this.discovered.has(l.key)) return;
      this.discovered.add(l.key);
      if (!silent) {
        this.ui.toast('发现地标：' + l.icon + ' ' + l.name, 'good');
        this.audio.quest();
      }
    }

    checkQuests() {
      const ch = this.quests.evaluate();
      for (const c of ch) {
        if (c.kind === 'done') { this.ui.toast('✔ 任务完成：' + c.d.name, 'good'); this.audio.quest(); }
        else if (c.kind === 'new') this.ui.toast('◈ 新任务：' + c.d.name);
      }
    }

    /* -------------------------------------------------- 粒子 */
    // size = 世界尺寸（米）：碎屑 0.05~0.09，血 0.04，火光 0.14，烟 0.3
    spawnParticles(x, y, z, n, col, spread, size) {
      const s = size == null ? 0.055 : size;
      for (let i = 0; i < n; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 0.55, y: y + (Math.random() - 0.5) * 0.55, z: z + (Math.random() - 0.5) * 0.55,
          vx: (Math.random() - 0.5) * spread * 26, vy: Math.random() * spread * 22, vz: (Math.random() - 0.5) * spread * 26,
          r: col[0], g: col[1], b: col[2], a: 1,
          size: s * (0.65 + Math.random() * 0.7),
          life: 0.45 + Math.random() * 0.8, t: 0, grav: 1,
        });
      }
      if (this.particles.length > 2600) this.particles.splice(0, this.particles.length - 2600);
    }
    spawnRain(dt) {
      const p = this.player, w = this.world;
      const n = Math.floor(this.world.weather.rain * 70 * dt * 6);
      for (let i = 0; i < n; i++) {
        const x = p.x + (Math.random() - 0.5) * 34, z = p.z + (Math.random() - 0.5) * 34;
        const cy = Math.min(GF.HEIGHT - 2, p.y + 16);
        this.particles.push({
          x, y: cy, z, vx: 1.4 * w.weather.wind, vy: -22, vz: 0.8,
          r: 0.62, g: 0.72, b: 0.82, a: 0.45, size: 0.032, life: 1.6, t: 0, grav: 0, rain: 1,
        });
      }
    }
    updateParticles(dt) {
      const w = this.world;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.t += dt;
        if (p.t > p.life) { this.particles.splice(i, 1); continue; }
        p.vy -= 22 * p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.a = 1 - p.t / p.life;
        if (p.rain && w.isSolid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) { this.particles.splice(i, 1); continue; }
        if (!p.rain && p.grav && w.isSolid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) { p.vy = 0; p.grav = 0; }
      }
    }

    /* -------------------------------------------------- 渲染 */
    render(dt) {
      const p = this.player;
      const d = p.dirVec();
      const held = this.inv.held();
      const hd = held ? GF.Items.get(held.item) : null;
      let blockTex = null, tint = [1, 1, 1];
      if (hd) {
        if (hd.place && GF.Blocks.byKey[hd.place]) {
          const b = GF.Blocks.byKey[hd.place];
          blockTex = b.tex.side || b.tex.all || b.tex.top;
        } else {
          blockTex = 'white';
          const cat = hd.cat;
          tint = cat === 'tool' ? [0.72, 0.74, 0.78] : cat === 'weap' ? [0.42, 0.42, 0.46]
            : cat === 'food' ? [0.85, 0.7, 0.42] : cat === 'med' ? [0.92, 0.92, 0.9]
              : cat === 'drink' ? [0.55, 0.78, 0.88] : [0.7, 0.66, 0.55];
        }
      }
      const camBob = this.movingNow ? Math.sin(this.bobPhase) * (p.sprint ? 0.055 : 0.03) : 0;
      const fovNow = (this.renderer.fov) * (this.aiming && hd && hd.gun && hd.gun.scope ? 1 / hd.gun.scope : (this.aiming ? 0.82 : 1));
      this.renderer.render({
        world: this.world,
        cam: { x: p.x, y: p.eyeY + camBob, z: p.z, dir: d },
        entities: this.ents.renderList(),
        particles: this.particles,
        target: this.mouse.l && this.mining ? this.mining : this.target,
        held: hd ? { blockTex, tint } : null,
        swing: this.swing,
        bob: camBob * 6,
        handLight: this.handLight || 0,
        elapsed: this.elapsed,
        fov: fovNow,
      });
    }

    /* -------------------------------------------------- 存档 */
    save() {
      try {
        const data = {
          v: 1, seed: this.seed,
          player: { x: this.player.x, y: this.player.y, z: this.player.z, yaw: this.player.yaw, pitch: this.player.pitch, hp: this.player.hp },
          world: this.world.serialize(),
          inv: this.inv.serialize(),
          sv: this.sv.serialize(),
          quests: this.quests.serialize(),
          flags: this.flags,
          notes: Array.from(this.notes),
          discovered: Array.from(this.discovered),
          unlocks: this.unlocks,
          spawn: this.spawnPoint,
          settings: {
            rd: this.renderer.renderDist, fov: this.renderer.fov, sens: this.sensitivity,
            vol: this.audio.volume, zm: this.ents.zombieMul, am: this.ents.animalMul, day: this.dayLength,
          },
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        return true;
      } catch (e) { console.error('save fail', e); this.ui.toast('保存失败：' + e.message, 'bad'); return false; }
    }

    load() {
      let raw;
      try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
      if (!raw) return false;
      let d;
      try { d = JSON.parse(raw); } catch (e) { return false; }
      this.seed = d.seed;
      for (const l of GF.Landmarks.list) l.baseY = null;
      this.world = new GF.World(this.seed);
      this.world.onDisposeMesh = (c) => this.renderer.disposeChunk(c);
      this.world.deserialize(d.world);
      this.inv = new GF.Inventory(24);
      this.inv.deserialize(d.inv);
      this.player = new GF.Player(d.player.x, d.player.y, d.player.z);
      this.player.yaw = d.player.yaw; this.player.pitch = d.player.pitch; this.player.hp = d.player.hp;
      this.sv = new GF.Survival(this.player, this.inv, this.world);
      this.sv.deserialize(d.sv);
      this.ents = new GF.EntityManager(this.world);
      this.flags = d.flags || {};
      this.notes = new Set(d.notes || []);
      this.discovered = new Set(d.discovered || []);
      this.unlocks = d.unlocks || {};
      this.spawnPoint = d.spawn;
      this.quests = new GF.Quests({
        inv: this.inv, world: this.world, flags: this.flags,
        notes: this.notes, discovered: this.discovered, unlocks: this.unlocks,
      });
      this.quests.deserialize(d.quests);
      if (d.settings) {
        this.renderer.renderDist = d.settings.rd || 8;
        this.renderer.fov = d.settings.fov || 72;
        this.sensitivity = d.settings.sens || 0.0032;
        this.audio.setVolume(d.settings.vol == null ? 0.55 : d.settings.vol);
        this.ents.zombieMul = d.settings.zm == null ? 0.55 : d.settings.zm;
        this.ents.animalMul = d.settings.am == null ? 1 : d.settings.am;
        this.dayLength = d.settings.day || 1200;
      }
      this.particles.length = 0;
      this.ui.closePanel();
      // 预生成脚下区块
      const ccx = Math.floor(this.player.x / GF.CHUNK), ccz = Math.floor(this.player.z / GF.CHUNK);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.world.generateNow(ccx + dx, ccz + dz);
      return true;
    }
    hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  }

  /* ============================================== MOD 接口 */
  GF.mods = [];
  GF.registerMod = function (mod) {
    GF.mods.push(mod);
    if (mod.setup) { try { mod.setup(GF); } catch (e) { console.error('[mod setup]', mod.name, e); } }
    return mod;
  };

  /* ============================================== 启动 */
  GF.boot = function () {
    const canvas = document.getElementById('gl');
    let game;
    try { game = new Game(canvas); }
    catch (e) {
      document.body.innerHTML = `<div style="color:#e8e4d0;font:16px system-ui;padding:40px;line-height:1.8">
        <h2>无法启动</h2><p>${e.message}</p>
        <p>请使用较新版本的 Chrome / Edge / Firefox 打开。</p></div>`;
      return;
    }
    GF.game = game;
    game.ui.build();
    game.bind();
    for (const m of GF.mods) if (m.ready) { try { m.ready(game, GF); } catch (e) { console.error('[mod ready]', e); } }
    // 有存档则提示继续
    if (game.hasSave()) {
      game.ui.showLoading('发现存档', 1);
      const el = document.getElementById('loading');
      const p = document.createElement('div');
      p.className = 'setrow';
      p.innerHTML = `<button class="btn big" id="lcont">继续游戏</button><button class="btn" id="lnew">新游戏</button>`;
      el.querySelector('.lwrap').appendChild(p);
      document.getElementById('lcont').onclick = () => {
        p.remove();
        if (game.load()) { game.ui.hideLoading(); game.ui.toast('欢迎回来。', 'good'); }
        else game.newGame();
        window.requestAnimationFrame((t) => game.loop(t));
      };
      document.getElementById('lnew').onclick = () => { p.remove(); game.newGame(); window.requestAnimationFrame((t) => game.loop(t)); };
    } else {
      game.newGame();
      window.requestAnimationFrame((t) => game.loop(t));
    }
    window.addEventListener('resize', () => game.renderer.resize());
  };
})(globalThis.GF = globalThis.GF || {});
