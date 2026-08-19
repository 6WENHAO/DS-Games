// Boot + main loop. Core systems are required; content modules load defensively so
// the demo always runs even while a module is being iterated on.
import * as THREE from 'three';
import { Engine, QUALITY } from './core/engine.js';
import { Input } from './core/input.js';
import { Events, TaskQueue, makeRNG, clamp, damp, smoothstep } from './core/utils.js';
import { Terrain } from './world/terrain.js';
import { SkySystem } from './world/sky.js';
import { WaterSystem } from './world/water.js';
import { Weather } from './world/weather.js';
import { height, normalAt, slopeAt, WORLD, REGIONS, regionAt, findFlatSpot } from './world/heightfield.js';
import { CollisionWorld } from './gameplay/collision.js';
import { InteractSystem } from './gameplay/interact.js';
import { FX } from './gameplay/fx.js';
import { Combat } from './gameplay/combat.js';
import { Player } from './gameplay/player.js';
import { ActionCamera } from './gameplay/camera.js';
import { Inventory } from './gameplay/inventory.js';
import { Environment } from './gameplay/environment.js';
import { PhotoMode } from './gameplay/photo.js';
import { Opening } from './gameplay/opening.js';
import { Tutorial } from './gameplay/tutorial.js';
import { Nameplates } from './gameplay/nameplates.js';
import { ElementalSight } from './gameplay/sight.js';
import { createUIStub, createAudioStub } from './ui/stub.js';

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');
const tier = params.get('q') || (SHOT ? 'med' : 'high');

const boot = document.getElementById('boot');
const setTip = (s) => { const el = boot?.querySelector('.boot-tip'); if (el) el.textContent = s; };
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
async function opt(path, label) {
  try { const m = await import(path); return m; }
  catch (e) { console.warn('[module missing] ' + label + ' (' + path + '): ' + e.message); return null; }
}

/** Walk outward from the world centre to find a shoreline spawn. */
function findBeachSpawn(angle = Math.atan2(330, 1640)) {
  const dx = Math.sin(angle), dz = Math.cos(angle);
  let best = null;
  for (let r = 1380; r < 1980; r += 6) {
    const x = dx * r, z = dz * r, h = height(x, z);
    if (h > 1.2 && h < 4.6 && slopeAt(x, z) < 0.34) { best = { x, y: h, z }; break; }
  }
  return best ?? { x: 330, y: height(330, 1640), z: 1640 };
}

class Game {
  constructor() {
    const canvas = document.getElementById('gl');
    this.engine = new Engine(canvas, QUALITY[tier] ? tier : 'high');
    const e = this.engine;
    this.ctx = {
      THREE, engine: e, renderer: e.renderer, scene: e.scene, camera: e.camera,
      quality: e.quality, tier, shotMode: SHOT, forceIntro: params.has('intro'),
      input: new Input(canvas), events: new Events(), tasks: new TaskQueue(6),
      rng: makeRNG(0xC0FFEE), shadowFocus: new THREE.Vector3(),
      paused: false, dialogueOpen: false, time: { elapsed: 0, dt: 0 }, fx: e.fx,
      windFields: [], game: this,
    };
    e.resize();
    this.ctx.input.wantLock = true;
  }

  async init() {
    const ctx = this.ctx;
    const t0 = performance.now();

    setTip('正在编织天空与大气…'); await frame();
    ctx.sky = new SkySystem(ctx);
    if (params.has('tod')) ctx.sky.setTimeOfDay(parseFloat(params.get('tod')));

    setTip('正在塑造提瓦特的大地…'); await frame();
    ctx.terrain = new Terrain(ctx);

    setTip('正在注入湖泊与海洋…'); await frame();
    ctx.water = new WaterSystem(ctx);
    ctx.weather = new Weather(ctx);
    if (params.has('weather')) ctx.weather.set(params.get('weather'), 0.5);

    setTip('正在构建物理与战斗系统…'); await frame();
    ctx.collision = new CollisionWorld(ctx);
    ctx.interact = new InteractSystem(ctx);
    ctx.fx3d = new FX(ctx);
    ctx.combat = new Combat(ctx);

    // ---------------- optional content modules ----------------
    setTip('正在唤醒角色…'); await frame();
    const chars = await opt('./char/characters.js', 'characters');
    if (chars?.createCharacter) ctx.characters = chars;

    ctx.player = new Player(ctx);
    ctx.camera3 = new ActionCamera(ctx);
    ctx.inventory = new Inventory(ctx);
    ctx.environment = new Environment(ctx);
    ctx.photo = new PhotoMode(ctx);
    ctx.nameplates = new Nameplates(ctx);
    ctx.sight = new ElementalSight(ctx);
    ctx.tutorial = new Tutorial(ctx);

    setTip('正在准备界面…'); await frame();
    const uiMod = await opt('./ui/ui.js', 'ui');
    try { ctx.ui = uiMod?.createUI ? uiMod.createUI(ctx) : createUIStub(ctx); }
    catch (e) { console.error('[ui] init failed', e); ctx.ui = createUIStub(ctx); }

    const audioMod = await opt('./audio/audio.js', 'audio');
    try { ctx.audio = audioMod?.createAudio ? audioMod.createAudio(ctx) : createAudioStub(); }
    catch (e) { console.error('[audio] init failed', e); ctx.audio = createAudioStub(); }

    setTip('正在种下草木与建造蒙德城…'); await frame();
    const veg = await opt('./world/vegetation.js', 'vegetation');
    const sca = await opt('./world/scatter.js', 'scatter');
    const str = await opt('./world/structures.js', 'structures');
    const twn = await opt('./world/townDetail.js', 'townDetail');
    const amb = await opt('./world/ambientlife.js', 'ambientlife');
    this.safeNew('structures', () => str?.Structures && (ctx.structures = new str.Structures(ctx)));
    this.safeNew('townDetail', () => twn?.TownDetail && (ctx.townDetail = new twn.TownDetail(ctx)));
    this.safeNew('vegetation', () => veg?.Vegetation && (ctx.vegetation = new veg.Vegetation(ctx)));
    this.safeNew('scatter', () => sca?.Scatter && (ctx.scatter = new sca.Scatter(ctx)));
    this.safeNew('ambientlife', () => amb?.AmbientLife && (ctx.ambient = new amb.AmbientLife(ctx)));

    setTip('正在召唤丘丘人…'); await frame();
    const en = await opt('./enemies/manager.js', 'enemies');
    this.safeNew('enemies', () => en?.EnemyManager && (ctx.enemies = new en.EnemyManager(ctx)));

    setTip('正在书写传说…'); await frame();
    const q = await opt('./quest/quests.js', 'quests');
    const pz = await opt('./quest/puzzles.js', 'puzzles');
    const wo = await opt('./quest/worldobjects.js', 'worldobjects');
    const np = await opt('./quest/npcs.js', 'npcs');
    this.safeNew('worldobjects', () => wo?.WorldObjects && (ctx.worldObjects = new wo.WorldObjects(ctx)));
    this.safeNew('puzzles', () => pz?.PuzzleSystem && (ctx.puzzles = new pz.PuzzleSystem(ctx)));
    if (!params.has('nostory')) {
      this.safeNew('quests', () => q?.QuestSystem && (ctx.quests = new q.QuestSystem(ctx)));
      this.safeNew('npcs', () => np?.NPCSystem && (ctx.npcs = new np.NPCSystem(ctx)));
    }

    // ---------------- spawn ----------------
    let spawn;
    if (params.has('pos')) {
      const [x, y, z] = params.get('pos').split(',').map(Number);
      spawn = { x, z, y: height(x, z) };
    } else if (params.get('spawn') === 'village' || SHOT) {
      spawn = findFlatSpot(10, 66, ctx.rng, 14);
    } else {
      spawn = findBeachSpawn();
    }
    ctx.player.position.set(spawn.x, spawn.y + 0.05, spawn.z);
    ctx.player.lastSafe.copy(ctx.player.position);
    ctx.player.respawnPoint.copy(ctx.player.position);
    ctx.shadowFocus.copy(ctx.player.position);
    ctx.terrain.preload(spawn.x, spawn.z, 3);
    ctx.camera3.yaw = params.has('yaw') ? parseFloat(params.get('yaw')) : Math.atan2(-spawn.x, -spawn.z);
    ctx.camera3.focus.copy(ctx.player.position);
    ctx.camera3.update(0.016, ctx.player);

    // ---------------- events ----------------
    ctx.events.on('ui:dialogueStart', () => { ctx.dialogueOpen = true; ctx.input.releaseLock?.(); ctx.audio?.duckMusic?.(0.6, 0.4); });
    ctx.events.on('ui:dialogueEnd', () => { ctx.dialogueOpen = false; ctx.audio?.duckMusic?.(0, 1.2); });
    ctx.events.on('quest:completed', () => ctx.audio?.sfx?.('quest_complete'));
    ctx.events.on('quest:accepted', () => ctx.audio?.sfx?.('quest_accept'));
    ctx.events.on('puzzle:solved', () => ctx.audio?.sfx?.('puzzle_solve'));
    ctx.events.on('waypoint:unlocked', () => ctx.audio?.sfx?.('waypoint_unlock'));
    ctx.events.on('chest:opened', () => ctx.audio?.sfx?.('chest_open'));
    ctx.events.on('waypoint:unlocked', () => ctx.player.respawnPoint.copy(ctx.player.position));
    const unlockAudio = () => { ctx.audio?.unlock?.(); removeEventListener('pointerdown', unlockAudio); removeEventListener('keydown', unlockAudio); };
    addEventListener('pointerdown', unlockAudio); addEventListener('keydown', unlockAudio);

    this._debugEl = document.createElement('div');
    this._debugEl.id = 'debug';
    document.getElementById('ui-root').appendChild(this._debugEl);
    if (params.has('debug')) this._debugEl.classList.add('on');

    // warm up: run a few frames of generation before showing anything
    setTip('正在预热渲染管线…');
    for (let i = 0; i < 4; i++) { ctx.tasks.run(30); ctx.sky.update(0.016, i === 0); this.engine.render(); await frame(); }

    boot?.classList.add('hide');
    setTimeout(() => boot?.remove(), 1000);
    this.ready = true;
    console.log('[boot] ready in ' + Math.round(performance.now() - t0) + 'ms');
    ctx.events.emit('game:ready');

  }

  /** Runs AFTER the render loop is live, so the cinematic camera actually animates. */
  async playOpening() {
    const ctx = this.ctx;
    if ((SHOT && !params.has('intro')) || params.has('nointro')) {
      ctx.audio?.music?.('field_day', { fade: 3 });
      ctx.ui?.hud?.show?.();
      ctx.ui?.cinematic?.(false);
      this.started = true;
      if (params.has('nointro') && !params.has('notut')) ctx.tutorial.start(2.0);
      return;
    }
    const opening = new Opening(ctx);
    this.opening = opening;
    try {
      opening.start();                                  // title vista: real world flythrough
      await ctx.ui.intro.play({ backdrop3d: true });     // waits for the player to click
    } catch (e) { console.warn('[intro]', e); }
    try { await opening.finish(); }                      // prologue cinematic -> hands over control
    catch (e) {
      console.warn('[opening]', e);
      ctx.camera3.mode = 'follow'; ctx.camera3.cinematic = null;
      ctx.player.root.visible = true; ctx.player.setControlEnabled(true);
      ctx.fx.uFade.value = 0; ctx.fx.uRadial.value = 0;
      ctx.ui?.hud?.show?.();
    }
    ctx.audio?.music?.('field_day', { fade: 3 });
    ctx.ui?.hud?.show?.();
    if (!SHOT) ctx.input.requestLock?.();
    this.started = true;
    if (!params.has('notut')) ctx.tutorial.start(1.6);
  }

  safeNew(name, fn) {
    try { fn(); } catch (e) { console.error('[module ' + name + '] init failed:', e); this.ctx.moduleErrors = (this.ctx.moduleErrors ?? 0) + 1; }
  }
  safeUpdate(name, obj, dt, ...rest) {
    if (!obj?.update) return;
    try { obj.update(dt, ...rest); }
    catch (e) {
      const k = '_warn_' + name;
      if (!this[k]) { this[k] = 1; console.error('[' + name + '.update]', e); }
    }
  }

  update(realDt) {
    const ctx = this.ctx;
    // hitstop scales gameplay time but never the camera or UI
    let dt = realDt;
    if (ctx.combat.hitstopT > 0) { ctx.combat.hitstopT -= realDt; dt = realDt * 0.14; }
    if (ctx.paused) dt = 0;
    ctx.time.dt = dt; ctx.time.elapsed += dt;

    if (this.opening?.active || this.opening?.prologueRunning) {
      this.safeUpdate('opening', this.opening, realDt);
      // opening flythrough: stream terrain around the cinematic camera, not the player
      ctx.shadowFocus.copy(ctx.camera.position);
      this.safeUpdate('sky', ctx.sky, realDt);
      this.safeUpdate('weather', ctx.weather, realDt);
      this.safeUpdate('terrain', ctx.terrain, realDt, ctx.camera.position);
      this.safeUpdate('water', ctx.water, realDt);
      this.safeUpdate('vegetation', ctx.vegetation, realDt, ctx.camera.position);
      this.safeUpdate('scatter', ctx.scatter, realDt, ctx.camera.position);
      this.safeUpdate('structures', ctx.structures, realDt);
      this.safeUpdate('townDetail', ctx.townDetail, realDt);
      this.safeUpdate('ambient', ctx.ambient, realDt, ctx.camera.position);
      ctx.camera3.update(realDt, ctx.player);
      ctx.fx3d.update(realDt, ctx.camera);
      this.safeUpdate('ui', ctx.ui, realDt);
      ctx.tasks.run(12);
      this.engine.updateSun(ctx.sky.sunDir, 0);
      ctx.input.endFrame(realDt);
      return;
    }
    this.safeUpdate('photo', ctx.photo, realDt);
    if (dt > 0 && !ctx.photo.active) {
      this.safeUpdate('player', ctx.player, dt);
      this.safeUpdate('environment', ctx.environment, dt);
      this.safeUpdate('sight', ctx.sight, dt);
      this.safeUpdate('tutorial', ctx.tutorial, dt);
      this.safeUpdate('enemies', ctx.enemies, dt);
      this.safeUpdate('combat', ctx.combat, dt);
      this.safeUpdate('interact', ctx.interact, dt);
      this.safeUpdate('quests', ctx.quests, dt);
      this.safeUpdate('puzzles', ctx.puzzles, dt);
      this.safeUpdate('worldobjects', ctx.worldObjects, dt);
      this.safeUpdate('npcs', ctx.npcs, dt);
    } else if (dt > 0) {
      this.safeUpdate('enemies', ctx.enemies, dt);
      this.safeUpdate('combat', ctx.combat, dt);
    }
    ctx.camera3.update(realDt, ctx.player);

    const p = ctx.player.position;
    ctx.shadowFocus.copy(p).addScaledVector(ctx.player.velocity, 0.28);
    this.safeUpdate('sky', ctx.sky, realDt);
    this.safeUpdate('weather', ctx.weather, realDt);
    this.safeUpdate('terrain', ctx.terrain, realDt, p);
    this.safeUpdate('water', ctx.water, realDt);
    this.safeUpdate('vegetation', ctx.vegetation, realDt, p);
    this.safeUpdate('scatter', ctx.scatter, realDt, p);
    this.safeUpdate('structures', ctx.structures, realDt);
    this.safeUpdate('townDetail', ctx.townDetail, realDt);
    this.safeUpdate('ambient', ctx.ambient, realDt, p);
    ctx.fx3d.update(realDt, ctx.camera);
    this.safeUpdate('nameplates', ctx.nameplates, realDt);
    this.safeUpdate('ui', ctx.ui, realDt);
    ctx.tasks.run(ctx.tasks.length > 400 ? 14 : ctx.tasks.length > 60 ? 9 : 5);
    if (ctx.audio?.update) { try { ctx.audio.update(realDt); } catch (e) { if (!this._aw) { this._aw = 1; console.warn('[audio]', e); } } }
    else ctx.audio?.listener?.(ctx.camera);
    this.engine.updateSun(ctx.sky.sunDir, 0);

    this._syncHud(realDt);
    this._regionCheck();
    this._musicCheck(realDt);
    if (ctx.input.justPressed('debug')) this._debugEl.classList.toggle('on');
    if (this._debugEl.classList.contains('on')) this._debug();
    ctx.input.endFrame(realDt);
  }

  _syncHud(dt) {
    const ctx = this.ctx, pl = ctx.player, hud = ctx.ui?.hud;
    if (!hud) return;
    hud.setHP?.(pl.member.hp, pl.member.maxHp);
    hud.setStamina?.(pl.stamina, pl.staminaMax ?? 240);
    const m = pl.member;
    hud.setSkill?.(0, m.skillCd, m.def.skill.cd);
    hud.setSkill?.(1, m.energy >= m.energyMax ? 0 : 1, 1, m.energy / m.energyMax);
    if (!this._partySent || this._partySent !== pl.activeIdx) {
      hud.setParty?.(pl.party.map(x => ({ name: x.name, element: x.element, hp: x.hp, maxHp: x.maxHp, id: x.id })));
      hud.setActive?.(pl.activeIdx);
      this._partySent = pl.activeIdx;
    }
    if (pl.lockOn && pl.lockOn.alive !== false) {
      const c = pl.lockOn.center ? pl.lockOn.center(new THREE.Vector3()) : pl.lockOn.root.position;
      const s = ctx.camera3.project(c);
      hud.setLockOn?.(s.x, s.y, s.visible);
    } else hud.setLockOn?.(0, 0, false);
  }

  _regionCheck() {
    const p = this.ctx.player.position;
    const r = regionAt(p.x, p.z);
    if (r?.id !== this._region) {
      this._region = r?.id;
      if (r) {
        this.ctx.ui?.hud?.setRegion?.(r.name);
        this.ctx.events.emit('player:region', { region: r });
      }
    }
  }

  _musicCheck(dt) {
    this._mt = (this._mt ?? 0) + dt;
    if (this._mt < 1.2) return;
    this._mt = 0;
    const ctx = this.ctx;
    if (!ctx.audio?.music) return;
    let track = 'field_day';
    const bossOn = ctx.enemies?.bossActive ?? ctx.enemies?.enemies?.some(e => e.isBoss || String(e.type ?? '').startsWith('boss'));
    if (bossOn) track = 'boss';
    else if ((ctx.enemies?.aggroCount ?? 0) > 0) track = 'combat';
    else if (this._region === 'mondstadt') track = 'town';
    else if (this._region === 'windrise') track = 'windrise';
    else if (ctx.sky.dayFactor < 0.18) track = 'field_night';
    if (track !== this._track) { this._track = track; ctx.audio.music(track, { fade: track === 'combat' || track === 'boss' ? 1.2 : 3 }); }
    const amb = this._region === 'dragonspine' ? 'snow' : this._region === 'lake' ? 'lake'
      : this._region === 'stormbearer' ? 'forest' : ctx.sky.dayFactor < 0.18 ? 'night' : 'meadow';
    if (amb !== this._amb) { this._amb = amb; ctx.audio.ambience?.(amb); }
  }

  _debug() {
    const ctx = this.ctx, p = ctx.player.position, e = this.engine;
    this._debugEl.textContent = [
      `fps ${e.fps}  tier ${tier}  draws ${e.stats.drawCalls}  tris ${(e.stats.tris / 1000) | 0}k`,
      `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  region ${this._region ?? '-'}`,
      `state ${ctx.player.state}  hp ${ctx.player.member.hp | 0}  sta ${ctx.player.stamina | 0}  combo ${ctx.player.comboIdx}`,
      `tod ${ctx.sky.timeOfDay.toFixed(2)}h  chunks ${ctx.terrain.chunks.size}  tasks ${ctx.tasks.length}`,
      `enemies ${ctx.enemies?.enemies?.length ?? 0} (aggro ${ctx.enemies?.aggroCount ?? 0})  interacts ${ctx.interact.list.length}`,
      `weather ${ctx.weather?.name}  cold ${(ctx.coldLevel ?? 0).toFixed(2)}  wind ${(ctx.wind?.strength ?? 0).toFixed(2)}`,
      `colliders ${ctx.collision.count}  modules ${['characters', 'ui', 'audio', 'vegetation', 'structures', 'enemies', 'quests'].filter(k => ctx[k] && !ctx[k].stub).length}/7`,
    ].join('\n');
  }
}

const game = new Game();
globalThis.__GAME = {
  get ready() { return !!game.ready; },
  get fps() { return game.engine.fps; },
  get drawCalls() { return game.engine.stats.drawCalls; },
  get tris() { return game.engine.stats.tris; },
  get phase() { return game.started ? 'play' : game.ready ? 'intro' : 'loading'; },
  lastError: null, game, get ctx() { return game.ctx; }, THREE,
  tp(x, z) { game.ctx.player.teleport(x, z); },
  tod(h) { game.ctx.sky.setTimeOfDay(h); },
  weather(n) { game.ctx.weather.set(n, 0.5); },
  /** Test helper: click through any open dialogue until gameplay resumes. */
  tutorial(on) { on === false ? game.ctx.tutorial.skip() : game.ctx.tutorial.start(0.2); },
  prologue() { return game.opening ? game.opening.playPrologue() : 'no opening'; },
  skipDialogue(maxMs = 20000) {
    return new Promise(resolve => {
      const t0 = performance.now();
      let clear = 0;
      const tick = () => {
        const open = game.ctx.dialogueOpen || game.ctx.paused;
        if (!open) { if (++clear >= 4) return resolve(true); }
        else clear = 0;
        if (performance.now() - t0 > maxMs) return resolve(!open);
        // Enter + clicks only: Space would also be read as a jump by the player controller.
        dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', bubbles: true }));
        for (const sel of ['#dialogue-box', '.dialogue-box', '#dialogue', '#dialogue .dlg-next', '.dlg-choice']) {
          document.querySelector(sel)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
        setTimeout(tick, 130);
      };
      tick();
    });
  },
  hud(on = true) { on ? game.ctx.ui?.hud?.show?.() : game.ctx.ui?.hud?.hide?.(); game.ctx.ui?.cinematic?.(false); },
  cam(yaw, pitch, dist) { const c = game.ctx.camera3; if (yaw != null) c.yaw = yaw; if (pitch != null) c.pitch = pitch; if (dist != null) c.wantDist = dist; },
  spawn(type, n = 1) { const p = game.ctx.player.position; for (let i = 0; i < n; i++) game.ctx.enemies?.spawn(type, new THREE.Vector3(p.x + 4 + i * 2, p.y, p.z + 4)); },
  modules() { const c = game.ctx; return { characters: !!c.characters, ui: !!c.ui && !c.ui.stub, audio: !!c.audio && !c.audio.stub, vegetation: !!c.vegetation, scatter: !!c.scatter, structures: !!c.structures, ambient: !!c.ambient, enemies: !!c.enemies, quests: !!c.quests, puzzles: !!c.puzzles, worldObjects: !!c.worldObjects, npcs: !!c.npcs, errors: c.moduleErrors ?? 0 }; },
};
addEventListener('error', e => { globalThis.__GAME.lastError = String(e.message); });
addEventListener('unhandledrejection', e => { globalThis.__GAME.lastError = 'promise: ' + String(e.reason); });

game.init().then(() => {
  const loop = () => {
    const dt = game.engine.tick();
    try { game.update(dt); game.engine.render(); }
    catch (err) { globalThis.__GAME.lastError = String(err?.stack || err); console.error(err); }
    requestAnimationFrame(loop);
  };
  loop();
  return game.playOpening();
}).catch(err => {
  globalThis.__GAME.lastError = String(err?.stack || err);
  console.error('[init]', err);
  setTip('初始化失败: ' + err.message);
});
