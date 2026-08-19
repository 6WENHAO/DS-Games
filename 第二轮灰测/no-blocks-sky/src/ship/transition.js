// Cinematic transitions: atmosphere exit / entry and hyperspace warp.
import * as THREE from 'three';
import { shared } from '../render/materials.js';
import { clamp, lerp } from '../core/noise.js';

export class Transition {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.phase = '';
    this.t = 0;
    this.data = null;
  }

  _begin(kind, data = {}) {
    const g = this.game;
    if (this.active) {
      // a previous cinematic was interrupted (mode changed under us): clean it up
      this._end();
    }
    this.active = true;
    this.kind = kind;
    this.phase = 'start';
    this.t = 0;
    this.data = data;
    g.mode = 'transition';
    g.ui.cineBarsOnly(true);
    g.uiBlocking = false;
  }

  _end() {
    this.active = false;
    this.phase = '';
    const g = this.game;
    g.ui.cinematic(null);
    g.ui.plasma(0);
    g.ui.flash(0);
    g.ui.warp(false);
  }

  /* ============================ leaving a planet ============================ */
  exitAtmosphere() {
    const g = this.game;
    if (this.active && this.kind === 'exit') return;
    this._begin('exit');
    g.audio.atmosphereExit(6.5);
    g.audio.stopAmbience();
    g.ui.cinematic({ main: '脱离大气层', sub: 'LEAVING ATMOSPHERE · ' + g.planet.name });
    g.ship.throttle = 1;
    this._startSky = {
      zen: g.sky.uniforms.uZenith.value.clone(),
      hor: g.sky.uniforms.uHorizon.value.clone(),
      fog: shared.uFogColor.value.clone(),
      dens: shared.uFogDensity.value,
    };
  }

  /* ============================ entering a planet ============================ */
  enterAtmosphere(planet) {
    const g = this.game;
    if (this.active && this.kind === 'enter') return;
    this._begin('enter', { planet, loaded: false, loading: false });
    g.audio.atmosphereEntry(8.5);
    g.audio.stopAmbience();
    g.ui.cinematic({ main: '进入大气层', sub: 'ENTERING ATMOSPHERE · ' + planet.name });
    g.ship.throttle = 1;
    g.ship.pulseActive = false;
    g.audio.stopPulseDrive();
    g.music.setIntensity(0.95);
  }

  /* ============================ hyperspace ============================ */
  warpTo(systemSeed) {
    const g = this.game;
    if (this.active && this.kind === 'warp') return;
    this._begin('warp', { systemSeed });
    g.audio.warpJump();
    g.ui.cinematic({ main: '超光速引擎启动', sub: 'HYPERDRIVE ENGAGED' });
    g.music.setMode('warp');
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const g = this.game;
    if (this.kind === 'exit') this._updateExit(dt);
    else if (this.kind === 'enter') this._updateEnter(dt);
    else if (this.kind === 'warp') this._updateWarp(dt);
  }

  /* ---------------------------------------------------------------- */
  _updateExit(dt) {
    const g = this.game;
    const t = this.t;
    const ship = g.ship;
    const obj = ship.object;

    if (t < 3.4) {
      // climb out: pitch up, accelerate, sky darkens, stars appear
      const k = t / 3.4;
      ship.euler.x = lerp(ship.euler.x, 0.55, Math.min(1, dt * 2));
      ship.euler.z = lerp(ship.euler.z, 0.12, Math.min(1, dt * 1.2));
      obj.rotation.set(ship.euler.x, ship.euler.y, ship.euler.z, 'YXZ');
      ship.speed = lerp(ship.speed, 260, Math.min(1, dt * 1.4));
      const fwd = new THREE.Vector3(0, 0, -1).applyEuler(obj.rotation);
      obj.position.addScaledVector(fwd, ship.speed * dt);
      // sky → space
      const s = this._startSky;
      const kk = Math.pow(k, 1.3);
      g.sky.uniforms.uZenith.value.lerpColors(s.zen, new THREE.Color(0x02030a), kk);
      g.sky.uniforms.uHorizon.value.lerpColors(s.hor, new THREE.Color(0x0a1424), kk * 0.9);
      g.sky.uniforms.uStars.value = kk;
      shared.uFogColor.value.lerpColors(s.fog, new THREE.Color(0x02030a), kk);
      shared.uFogDensity.value = lerp(s.dens, 0.0008, kk);
      g.ui.plasma(Math.max(0, 0.35 - k * 0.35));
      g.ui.shake(0.06);
      // camera
      ship.updateCamera(dt);
      if (g.world) g.world.update(obj.position, 1);
      if (g.particles) g.particles.update(dt, null);
      g.sky.update(dt, g.camera.position, g.dayT, g.time);
    } else if (t < 3.9) {
      g.ui.flash(clamp((t - 3.4) / 0.35, 0, 1) * 0.9);
      if (!this.data.switched) {
        this.data.switched = true;
        g.space.enter(g.planet, { fromSurface: true }).then(() => {
          g.activeScene = g.sceneSpace;
          if (g.renderPass) g.renderPass.scene = g.sceneSpace;
          g.audio.startSpaceAmbience();
          g.music.setMode('space');
          g.ui.shipHud(true);
          g.flags.inSpace = true;
        });
      }
    } else if (t < 6.6) {
      g.ui.flash(clamp(1 - (t - 3.9) / 1.1, 0, 1) * 0.9);
      g.space.update(dt);
      g.ui.cinematic({ main: g.system.name + ' 星系', sub: g.system.planets.length + ' 颗行星 · ' + g.system.economy + ' · ' + g.system.race });
    } else {
      g.mode = 'space';
      g.ui.cineBarsOnly(false);
      this._end();
      g.space.keepShipOutOfSolids();
      g.ui.toast({ kind: 'info', name: '已进入轨道', amt: '按住 Tab 启动脉冲引擎', dur: 5000 });
    }
  }

  /* ---------------------------------------------------------------- */
  _updateEnter(dt) {
    const g = this.game;
    const t = this.t;
    const ship = g.ship;
    const obj = ship.object;
    const planet = this.data.planet;

    // kick off the planet load early, hidden behind the cinematic
    if (t > 0.5 && !this.data.loading) {
      this.data.loading = true;
      g.loadPlanet(planet, { silent: true, fromSpace: true, keepMode: true }).then(() => {
        this.data.loaded = true;
      });
    }

    if (t < 3.6) {
      // dive: aim at the planet, plasma builds
      const k = t / 3.6;
      g.space.updateDive(dt, k);
      g.ui.plasma(Math.pow(k, 1.5));
      g.ui.shake(0.05 + k * 0.28);
      const heat = Math.pow(k, 2);
      if (g.particles && Math.random() < 0.9) {
        const cam = g.camera;
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        const p = cam.position.clone().addScaledVector(fwd, 16 + Math.random() * 26);
        p.x += (Math.random() - 0.5) * 22; p.y += (Math.random() - 0.5) * 14; p.z += (Math.random() - 0.5) * 22;
        g.particles.trail(p.x, p.y, p.z, Math.random() < 0.6 ? '#ff9a3a' : '#fff0c0', { life: 0.45, size: 0.3 + heat * 0.5, spread: 0.2, glow: true, grav: 0 });
      }
      if (g.particles) g.particles.update(dt, null);
    } else if (t < 4.3) {
      // punch through: white-out and swap scenes
      g.ui.flash(clamp((t - 3.6) / 0.4, 0, 1));
      g.ui.plasma(1);
      if (this.data.loaded && !this.data.switched) {
        this.data.switched = true;
        g.activeScene = g.sceneSurface;
        if (g.renderPass) g.renderPass.scene = g.sceneSurface;
        g.space.leave();
        // place the ship high up, diving
        const spawn = g.world.gen.findSpawn(Math.floor(Math.random() * 2000 - 1000), Math.floor(Math.random() * 2000 - 1000));
        obj.position.set(spawn.x, 210, spawn.z);
        ship.euler.set(-0.36, Math.random() * Math.PI * 2, 0);
        obj.rotation.set(ship.euler.x, ship.euler.y, ship.euler.z, 'YXZ');
        ship.speed = 210;
        ship.state = 'flying';
        ship.gearOut = 0;
        ship.applyGear();
        g.player.pos.set(spawn.x, 210, spawn.z);
        // start with heavy fog then clear it
        this._fogFrom = 0.075;
        shared.uFogDensity.value = this._fogFrom;
        g.audio.startAmbience(planet.biome, planet.hazard);
        g.music.setMode('surface');
        g.ui.shipHud(true);
        g.flags.inSpace = false;
      }
    } else if (t < 9.4) {
      if (!this.data.switched) { this.t = 4.0; return; } // wait for the load
      const k = clamp((t - 4.3) / 5.1, 0, 1);
      g.ui.flash(clamp(1 - (t - 4.3) / 0.8, 0, 1));
      g.ui.plasma(Math.max(0, 1 - k * 1.5));
      g.ui.shake(Math.max(0, 0.25 - k * 0.3));
      // descend through blocky clouds
      ship.euler.x = lerp(ship.euler.x, -0.12, Math.min(1, dt * 1.2));
      obj.rotation.set(ship.euler.x, ship.euler.y, ship.euler.z, 'YXZ');
      ship.speed = lerp(ship.speed, 90, Math.min(1, dt * 0.8));
      const fwd = new THREE.Vector3(0, 0, -1).applyEuler(obj.rotation);
      obj.position.addScaledVector(fwd, ship.speed * dt);
      obj.position.y = lerp(obj.position.y, 118, Math.min(1, dt * 0.55));
      g.player.pos.copy(obj.position);
      // cloud streaks whipping past
      if (g.particles && k < 0.55) {
        for (let i = 0; i < 2; i++) {
          const p = obj.position.clone().addScaledVector(fwd, 60 + Math.random() * 90);
          p.x += (Math.random() - 0.5) * 70; p.y += (Math.random() - 0.5) * 26; p.z += (Math.random() - 0.5) * 70;
          g.particles.trail(p.x, p.y, p.z, '#ffffff', { life: 0.7, size: 1.6 + Math.random() * 2.2, spread: 0.1, glow: false, grav: 0, drag: 1 });
        }
      }
      // fog clears as we settle in
      shared.uFogDensity.value = lerp(this._fogFrom, 0.0042, Math.pow(k, 0.7));
      g.world.update(obj.position, 5);
      const sunDir = g.sky.update(dt, g.camera.position, g.dayT, g.time);
      shared.uSunDir.value.copy(sunDir);
      shared.uSunIntensity.value = clamp(sunDir.y * 1.6 + 0.28, 0.06, 1);
      g.particles.update(dt, null);
      ship.updateCamera(dt);
      if (t > 5.2) g.ui.cinematic({ main: planet.name, sub: planet.biomeCn + ' · ' + planet.desc + ' · 危害: ' + (planet.hazard === 'none' ? '无' : planet.hazardLevel) });
    } else {
      g.mode = 'fly';
      g.ui.cineBarsOnly(false);
      this._end();
      g.ui.setPlanet(planet);
      g.ui.toast({ kind: 'info', name: '已进入 ' + planet.name + ' 大气层', amt: '按 F 降落', dur: 5200 });
      g.music.setIntensity(0.5);
    }
  }

  /* ---------------------------------------------------------------- */
  _updateWarp(dt) {
    const g = this.game;
    const t = this.t;
    if (t < 2.6) {
      g.ui.warp(true);
      g.space.updateWarpCharge(dt, t / 2.6);
      g.ui.shake(0.04 + (t / 2.6) * 0.2);
      g.ui.cinematic({ main: '超光速引擎启动', sub: 'HYPERDRIVE CHARGING ' + Math.round((t / 2.6) * 100) + '%' });
    } else if (t < 3.2) {
      g.ui.flash(clamp((t - 2.6) / 0.4, 0, 1));
      if (!this.data.switched) {
        this.data.switched = true;
        g.jumpToSystem(this.data.systemSeed);
      }
    } else if (t < 6.0) {
      g.ui.flash(clamp(1 - (t - 3.2) / 1.0, 0, 1));
      g.space.update(dt);
      g.ui.cinematic({ main: g.system.name + ' 星系', sub: '新星系 · ' + g.system.planets.length + ' 颗行星 · ' + g.system.economy });
    } else {
      g.mode = 'space';
      g.ui.warp(false);
      g.ui.cineBarsOnly(false);
      this._end();
      g.music.setMode('space');
      g.flags.warped = true;
      g.ui.toast({ kind: 'quest', name: '跃迁成功: ' + g.system.name, amt: '', dur: 5000 });
    }
  }
}
