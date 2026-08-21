/**
 * SALTWAKE — the director.
 *
 * Owns everything that makes the level a level rather than a room full of
 * enemies: pickups, doors and keys, the valve and conduit mechanisms, proximity
 * triggers, readable notes, secrets, the rising tide, the boss sequence and the
 * ending.
 *
 * The level's `script` array is a list of beats keyed to trigger ids, so the
 * pacing lives in the level data rather than in code.
 */
import * as THREE from 'three';
import { AMMO, PLAYER, WEAPONS } from '../core/config.js';
import { createActorMaterial, createWorldMaterial } from '../gfx/materials.js';
import { buildPickupModel } from '../gfx/models.js';
import { SurfaceBuilder, CELL } from '../world/build.js';
import { TILES } from '../gfx/textures.js';

const DOOR_TIME = 0.9;
const INTERACT_RANGE = 2.9;

export class Director {
  /**
   * @param {object} ctx { world, level, player, weapons, enemies, fx, sanity, audio, hud, scene, stage, lights }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.level = ctx.level;
    this.world = ctx.world;

    this.pickups = [];
    this.notes = [];
    this.mechanisms = [];
    this.triggers = [];
    this.secrets = new Map();
    this.conduits = [];

    this.material = createActorMaterial({});
    this.pickupGroup = new THREE.Group();
    ctx.scene.add(this.pickupGroup);

    this.tide = { active: false, from: 0, to: 0, t: 0, duration: 1, zones: [] };
    this.waterMesh = null;
    this.waterOffset = 0;

    this.objective = '';
    this.finished = false;
    this.endingShown = false;
    this.bossPhase = 0;
    this.elapsed = 0;
    this.musicIntensity = 0;
    this.subtitleQueue = [];

    this.buildEntities();
    this.buildWater();
    this.runScript('start');
  }

  /* ------------------------------------------------------------ setup */

  buildEntities() {
    const { world, scene } = this.ctx;
    const grid = world.grid;

    for (const ent of this.level.entities || []) {
      const cell = grid.get(ent.col, ent.row);
      if (!cell) continue;
      const c = grid.centreOf(ent.col, ent.row);
      const y = ent.y !== undefined ? ent.y : cell.floorY;

      switch (ent.type) {
        case 'weapon':
        case 'ammo':
        case 'health':
        case 'armor':
        case 'key': {
          const modelKind = ent.type === 'weapon' ? 'weapon'
            : ent.type === 'key' ? 'key' : ent.type;
          const mesh = buildPickupModel(modelKind, this.material);
          mesh.position.set(c.x, y + 0.45, c.z);
          this.pickupGroup.add(mesh);
          this.pickups.push({ ...ent, mesh, x: c.x, y, z: c.z, taken: false, bobPhase: Math.random() * 6.28 });
          break;
        }
        case 'note': {
          const mesh = buildPickupModel('note', this.material);
          mesh.position.set(c.x, y + 0.5, c.z);
          this.pickupGroup.add(mesh);
          this.notes.push({ ...ent, mesh, x: c.x, y, z: c.z, read: false });
          break;
        }
        case 'mechanism': {
          const mesh = buildPickupModel('armor', this.material);
          mesh.position.set(c.x, y + 0.7, c.z);
          mesh.scale.setScalar(1.35);
          this.pickupGroup.add(mesh);
          const m = { ...ent, mesh, x: c.x, y, z: c.z, used: false, count: 0 };
          this.mechanisms.push(m);
          if (ent.id && ent.id.startsWith('conduit')) this.conduits.push(m);
          break;
        }
        case 'secret': {
          this.secrets.set(`${ent.col},${ent.row}`, { ...ent, found: false });
          break;
        }
        case 'trigger': {
          this.triggers.push({
            ...ent,
            x: c.x,
            z: c.z,
            radius: ent.radius || CELL * 1.1,
            fired: false,
          });
          break;
        }
        default:
          break;
      }
    }

    // Give the player the starting loadout.
    const { weapons } = this.ctx;
    for (const id of this.level.startingWeapons || []) {
      const i = WEAPONS.findIndex((w) => w.id === id);
      if (i >= 0) { weapons.owned[i] = true; weapons.loaded[i] = WEAPONS[i].capacity; }
    }
    for (const [kind, amount] of Object.entries(this.level.startingAmmo || {})) {
      weapons.giveAmmo(kind, amount);
    }
    for (const k of this.level.startingKeys || []) this.ctx.player.giveKey(k);
  }

  /** A flat surface over every water cell, which the tide can raise. */
  buildWater() {
    const grid = this.world.grid;
    const surf = new SurfaceBuilder();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    let any = false;
    grid.forEach((cell, col, row) => {
      if (!cell.water || cell.waterY === null || cell.waterY === undefined) return;
      any = true;
      const x0 = col * CELL;
      const z0 = row * CELL;
      const y = cell.waterY;
      surf.quad(
        V(x0, y, z0 + CELL), V(x0 + CELL, y, z0 + CELL),
        V(x0 + CELL, y, z0), V(x0, y, z0),
        new THREE.Vector3(0, 1, 0), TILES.sludge, CELL * 0.5, CELL * 0.5,
        { kind: 'water', col, row },
      );
    });
    if (!any) return;
    // Water is lit slightly hot so it reads as a surface rather than a hole.
    for (let i = 0; i < surf.col.length; i += 3) {
      surf.col[i] = 0.55; surf.col[i + 1] = 0.72; surf.col[i + 2] = 0.68;
    }
    this.waterMaterial = createWorldMaterial();
    this.waterMesh = surf.build(this.waterMaterial, 'water');
    this.ctx.scene.add(this.waterMesh);
  }

  /* ------------------------------------------------------------ script */

  runScript(at) {
    for (const beat of this.level.script || []) {
      if (beat.at !== at) continue;
      this.doBeat(beat);
    }
  }

  doBeat(beat) {
    const { hud, audio } = this.ctx;
    switch (beat.do) {
      case 'subtitle':
        if (hud) hud.showSubtitle(beat.text, beat.seconds || 5);
        break;
      case 'titleCard':
        if (hud) hud.showTitleCard(beat.text, beat.subtext, beat.seconds || 4);
        break;
      case 'objective':
        this.objective = beat.text;
        if (hud) hud.setObjective(beat.text);
        break;
      case 'music': {
        // Levels may name an intensity or give a number.
        const named = { calm: 0.12, unease: 0.3, combat: 0.7, boss: 1.0 };
        const v = typeof beat.value === 'string' ? (named[beat.value] ?? 0.5)
          : (beat.value === undefined ? 0.5 : beat.value);
        this.musicIntensity = v;
        if (audio) audio.setMusicIntensity(v);
        break;
      }
      case 'sound':
        if (audio) audio.play(beat.value || 'distantHorn', { volume: beat.volume || 0.8 });
        break;
      case 'tide':
        this.startTide(beat.value === undefined ? 1.6 : beat.value, beat.seconds || 40);
        break;
      case 'open':
        this.openDoor(beat.value, true);
        break;
      case 'spawn':
        if (beat.enemy && Number.isFinite(beat.col)) {
          const cell = this.world.grid.get(beat.col, beat.row);
          if (cell) {
            const c = this.world.grid.centreOf(beat.col, beat.row);
            const e = this.ctx.enemies.spawn(beat.enemy, c.x, cell.floorY, c.z, {});
            e.awake = true;
          }
        }
        break;
      case 'boss':
        this.beginBoss();
        break;
      case 'end':
        this.finish(beat.text);
        break;
      default:
        break;
    }
  }

  /**
   * Resolves a target name from the level data. Levels are allowed to name a
   * door directly rather than prefixing it, so a bare id that matches a door is
   * treated as one; anything else becomes a script cue. Unknown names are
   * reported once rather than failing silently.
   */
  fireTargets(targets, sourceId) {
    let handled = 0;
    for (const target of targets || []) {
      if (typeof target !== 'string') continue;
      if (target.startsWith('door:')) { this.openDoor(target.slice(5), true); handled += 1; continue; }
      if (target.startsWith('tide:')) { this.startTide(parseFloat(target.slice(5)) || 1.5, 30); handled += 1; continue; }
      if (target.startsWith('script:')) { this.runScript(target.slice(7)); handled += 1; continue; }
      if (target === 'boss') { this.beginBoss(); handled += 1; continue; }
      if (this.world.doors.has(target)) { this.openDoor(target, true); handled += 1; continue; }
      // Not a door and not a prefixed cue: run it as a script label.
      this.runScript(target);
      handled += 1;
    }
    if (handled === 0 && sourceId) {
      console.warn('[saltwake] mechanism "%s" had no resolvable targets', sourceId);
    }
    return handled;
  }

  /* ------------------------------------------------------------ doors */

  openDoor(id, force = false) {
    const door = this.world.doors.get(id);
    if (!door || door.open) return false;
    const { player, audio, hud } = this.ctx;
    if (!force && door.key && !player.hasKey(door.key)) {
      if (audio) audio.play('doorLocked', { volume: 0.8 });
      if (hud) hud.showSubtitle(`Locked. It wants the ${door.key} key.`, 2.6);
      return false;
    }
    door.open = true;
    door.cell.doorOpen = true;
    if (door.cell.collider) door.cell.collider.disabled = true;
    if (audio) audio.play('doorOpen', { position: { x: door.cell.col * CELL, y: door.cell.floorY + 1, z: door.cell.row * CELL } });
    // A newly opened door invalidates the enemy flow field.
    this.ctx.enemies.flowOrigin.col = -999;
    return true;
  }

  /* ------------------------------------------------------------ tide */

  startTide(rise, duration) {
    this.tide.active = true;
    this.tide.from = this.waterOffset;
    this.tide.to = this.waterOffset + rise;
    this.tide.t = 0;
    this.tide.duration = duration;
    if (this.ctx.audio) this.ctx.audio.play('tideRush', { volume: 1 });
    if (this.ctx.hud) this.ctx.hud.showSubtitle('The water is coming up.', 4);
  }

  applyWaterOffset(offset) {
    const delta = offset - this.waterOffset;
    if (Math.abs(delta) < 1e-5) return;
    this.waterOffset = offset;
    if (this.waterMesh) this.waterMesh.position.y = offset;
    this.world.grid.forEach((cell) => {
      if (cell.waterY === null || cell.waterY === undefined) return;
      if (cell.baseWaterY === undefined) cell.baseWaterY = cell.waterY;
      cell.waterY = cell.baseWaterY + offset;
    });
  }

  /* ------------------------------------------------------------ boss */

  beginBoss() {
    const { audio, hud, enemies } = this.ctx;
    if (this.bossPhase > 0) return;
    this.bossPhase = 1;
    this.musicIntensity = 1;
    if (audio) { audio.setMusicIntensity(1); audio.play('scionRoar', { volume: 1 }); }
    if (hud) {
      hud.setObjective('Break the three conduits, then put it back to sleep.');
      hud.showSubtitle('It is already awake enough to notice you.', 5);
    }
    // Wake the boss and let it move.
    if (enemies.boss) {
      enemies.boss.awake = true;
      enemies.setState(enemies.boss, 'chase');
    }
  }

  /** Called when a conduit mechanism is destroyed or used. */
  breakConduit(m) {
    const { enemies, audio, hud } = this.ctx;
    if (m.used) return;
    m.used = true;
    m.mesh.visible = false;
    const broken = this.conduits.filter((c) => c.used).length;
    if (enemies.boss) enemies.breakConduit(enemies.boss);
    if (audio) audio.play('ritualPulse', { volume: 1 });
    if (hud) {
      const left = this.conduits.length - broken;
      hud.showSubtitle(left > 0
        ? `Conduit dark. ${left} still burning.`
        : 'The last conduit is dark. It can be hurt now.', 4);
    }
  }

  /* ------------------------------------------------------------ interaction */

  /** Pressing use: doors, mechanisms and notes, nearest first. */
  interact() {
    const { player, hud, audio } = this.ctx;
    const px = player.pos.x;
    const pz = player.pos.z;

    let best = null;
    let bestDist = INTERACT_RANGE;

    for (const m of this.mechanisms) {
      if (m.used) continue;
      const d = Math.hypot(m.x - px, m.z - pz);
      if (d < bestDist) { bestDist = d; best = { kind: 'mechanism', ref: m }; }
    }
    for (const n of this.notes) {
      const d = Math.hypot(n.x - px, n.z - pz);
      if (d < bestDist) { bestDist = d; best = { kind: 'note', ref: n }; }
    }
    // Doors within reach, including the one directly ahead.
    for (const [id, door] of this.world.doors) {
      if (door.open) continue;
      const dx = (door.cell.col + 0.5) * CELL - px;
      const dz = (door.cell.row + 0.5) * CELL - pz;
      const d = Math.hypot(dx, dz);
      if (d < bestDist) { bestDist = d; best = { kind: 'door', ref: id }; }
    }

    if (!best) return false;
    if (best.kind === 'door') return this.openDoor(best.ref);
    if (best.kind === 'note') {
      best.ref.read = true;
      if (hud) hud.showSubtitle(best.ref.text, 7);
      if (audio) audio.play('uiConfirm', { volume: 0.5 });
      return true;
    }
    // mechanism
    const m = best.ref;
    if (m.id && m.id.startsWith('conduit')) { this.breakConduit(m); return true; }
    m.used = true;
    m.count += 1;
    if (audio) audio.play('mechanismTurn', { volume: 0.9 });
    if (hud) hud.showSubtitle(m.label || 'The mechanism turns.', 4);
    this.fireTargets(m.targets, m.id);
    return true;
  }

  /* ------------------------------------------------------------ frame */

  update(dt, time) {
    const { player, enemies, audio, hud } = this.ctx;
    this.elapsed += dt;

    /* --- pickups --- */
    for (const p of this.pickups) {
      if (p.taken) continue;
      // Spinning and bobbing on the stop-motion clock so pickups read as sprites.
      const step = Math.floor(time * 8) / 8;
      p.mesh.rotation.y = step * 1.6 + p.bobPhase;
      p.mesh.position.y = p.y + 0.45 + Math.sin(step * 2.2 + p.bobPhase) * 0.06;
      const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
      if (d > 1.25 || Math.abs(p.y - player.pos.y) > 2.2) continue;
      if (this.collect(p)) {
        p.taken = true;
        p.mesh.visible = false;
      }
    }

    /* --- notes and mechanisms idle motion --- */
    for (const n of this.notes) n.mesh.rotation.y = Math.floor(time * 6) / 6 * 0.5;
    for (const m of this.mechanisms) {
      if (m.used) continue;
      m.mesh.rotation.y = Math.floor(time * 8) / 8 * 1.1;
      if (this.ctx.lights && m.id && m.id.startsWith('conduit')) {
        this.ctx.lights.add({ x: m.x, y: m.y + 0.9, z: m.z }, 8, '#9fe08a', 1.2);
      }
    }

    /* --- triggers --- */
    for (const t of this.triggers) {
      if (t.fired && t.once !== false) continue;
      const d = Math.hypot(t.x - player.pos.x, t.z - player.pos.z);
      if (d > t.radius) continue;
      t.fired = true;
      this.runScript(t.id);
      this.fireTargets(t.fires, t.id);
    }

    /* --- secrets --- */
    const col = Math.floor(player.pos.x / CELL);
    const row = Math.floor(player.pos.z / CELL);
    const secret = this.secrets.get(`${col},${row}`);
    if (secret && !secret.found) {
      secret.found = true;
      player.secretsFound.add(secret.id);
      if (audio) audio.play('secretFound', { volume: 0.9 });
      if (hud) { hud.showSecret(); hud.showSubtitle(secret.label || 'You found something that was hidden.', 4); }
    }

    /* --- tide --- */
    if (this.tide.active) {
      this.tide.t += dt;
      const k = Math.min(1, this.tide.t / this.tide.duration);
      // Eased so the last stretch is slow and dreadful.
      const eased = k * k * (3 - 2 * k);
      this.applyWaterOffset(this.tide.from + (this.tide.to - this.tide.from) * eased);
      if (k >= 1) this.tide.active = false;
    }

    /* --- boss sequence --- */
    // The fight arms itself when the player enters the boss's district, so the
    // level data does not have to remember to place a trigger for it.
    if (this.bossPhase === 0 && enemies.boss) {
      const here = this.world.grid.atWorld(player.pos.x, player.pos.z);
      const there = this.world.grid.atWorld(enemies.boss.pos.x, enemies.boss.pos.z);
      if (here && there && here.district === there.district) this.beginBoss();
    }
    if (this.bossPhase > 0 && enemies.boss) {
      const boss = enemies.boss;
      if (boss.armorPhase === 0 && this.bossPhase === 1) {
        this.bossPhase = 2;
        if (hud) hud.showSubtitle('The plates are open. Put everything into it.', 4);
      }
      if (!boss.alive && this.bossPhase < 3) {
        this.bossPhase = 3;
        this.runScript('bossDead');
        if (audio) audio.setMusicIntensity(0.15);
        if (hud) hud.setObjective('Reach the edge of the fissure.');
      }
    }

    /* --- combat music: intensity follows how many things want you dead --- */
    if (audio) {
      let threat = 0;
      for (const e of enemies.list) {
        if (!e.alive || !e.awake) continue;
        const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
        if (d < 26) threat += e.def.boss ? 3 : 1;
      }
      const want = this.bossPhase > 0 && this.bossPhase < 3 ? 1
        : Math.min(1, threat / 5);
      this.musicIntensity += (want - this.musicIntensity) * Math.min(1, dt * 0.9);
      audio.setMusicIntensity(this.musicIntensity);
      audio.setSanity(player.sanity01);
    }

    /* --- the goal --- */
    if (!this.finished && this.level.goal) {
      const gd = Math.hypot(
        (this.level.goal.col + 0.5) * CELL - player.pos.x,
        (this.level.goal.row + 0.5) * CELL - player.pos.z,
      );
      const bossDown = !enemies.boss || !enemies.boss.alive;
      if (gd < CELL * 1.2 && bossDown) this.finish();
    }
  }

  collect(p) {
    const { player, weapons, audio, hud } = this.ctx;
    switch (p.type) {
      case 'weapon': {
        if (!weapons.giveWeapon(p.weapon)) return false;
        const def = WEAPONS.find((w) => w.id === p.weapon);
        if (audio) audio.play('pickupAmmo', { volume: 0.9 });
        if (hud) {
          hud.flashPickup('weapon');
          hud.showSubtitle(`${def.name}. ${def.description}`, 6);
        }
        return true;
      }
      case 'ammo': {
        const amount = p.amount || AMMO[p.ammo].pickup;
        if (weapons.giveAmmo(p.ammo, amount) <= 0) return false;
        if (audio) audio.play('pickupAmmo', { volume: 0.6 });
        if (hud) hud.flashPickup('ammo');
        return true;
      }
      case 'health': {
        if (player.health >= PLAYER.maxHealth) return false;
        player.heal(p.amount || 25);
        if (audio) audio.play('pickupHealth', { volume: 0.7 });
        if (hud) hud.flashPickup('health');
        return true;
      }
      case 'armor': {
        if (player.armor >= PLAYER.maxArmor) return false;
        player.addArmor(p.amount || 30);
        if (audio) audio.play('pickupArmor', { volume: 0.7 });
        if (hud) hud.flashPickup('armor');
        return true;
      }
      case 'key': {
        player.giveKey(p.key);
        if (audio) audio.play('pickupKey', { volume: 1 });
        if (hud) {
          hud.setKeys([...player.keys]);
          hud.flashPickup('key');
          hud.showSubtitle(`${p.key} key.`, 3.5);
        }
        return true;
      }
      default:
        return false;
    }
  }

  finish(text) {
    if (this.finished) return;
    this.finished = true;
    const { hud, audio } = this.ctx;
    if (audio) { audio.setMusicIntensity(0.1); audio.play('distantHorn', { volume: 1 }); }
    const lines = text ? [text] : (this.level.ending || [
      'The Firstborn settles back into the fissure.',
      'The water in the harbour does not go down.',
      'Somewhere below the town, something else answers the horn.',
    ]);
    if (hud) hud.showEnding(lines);
    this.endingShown = true;
  }

  stats() {
    return {
      elapsed: this.elapsed,
      secrets: this.secrets.size,
      secretsFound: this.ctx.player.secretsFound.size,
      kills: this.ctx.enemies.killCount,
      objective: this.objective,
      finished: this.finished,
      bossPhase: this.bossPhase,
    };
  }
}
