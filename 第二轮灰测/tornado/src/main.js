/**
 * main.js — 应用入口：装配引擎 / 光影 / 龙卷风 / 物理 / 场景 / UI，并驱动主循环。
 */
import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { Lighting } from './core/Lighting.js';
import { PhysicsWorld } from './core/MiniPhysics.js';
import { Tornado } from './tornado/Tornado.js';
import { TornadoVolume } from './tornado/TornadoVolume.js';
import { DebrisPool, DebrisSwarm } from './tornado/Debris.js';
import { Panel } from './ui/Panel.js';
import { P, FLAGS } from './core/Params.js';
import { clamp, damp, lerp } from './core/Random.js';

const SCENES = {
  ocean: { label: '大海', load: () => import('./scenes/OceanScene.js').then((m) => m.OceanScene) },
  desert: { label: '沙漠', load: () => import('./scenes/DesertScene.js').then((m) => m.DesertScene) },
  plain: { label: '平原', load: () => import('./scenes/PlainScene.js').then((m) => m.PlainScene) },
};

const CAM_MODES = ['orbit', 'chase', 'cinema', 'ground'];
const CAM_LABEL = { orbit: '自由环视', chase: '追踪涡心', cinema: '电影运镜', ground: '地面视角' };

class App {
  constructor() {
    const bootMsg = document.getElementById('bootMsg');
    const bootBar = document.getElementById('bootBar');
    this.boot = (p, msg) => {
      if (bootBar) bootBar.style.width = (p * 100).toFixed(0) + '%';
      if (msg && bootMsg) bootMsg.textContent = msg;
    };

    this.engine = new Engine(document.getElementById('gl'));
    if (!this.engine.isWebGL2) throw new Error('需要 WebGL2 支持');
    this.boot(0.12, 'WebGL2 就绪 · ' + String(this.engine.rendererName).slice(0, 52));

    this.lighting = new Lighting(this.engine.renderer);
    this.tornado = new Tornado();
    this.volume = new TornadoVolume(this.lighting);
    this.physics = new PhysicsWorld();
    this.physics.tornado = this.tornado;
    this.debris = new DebrisPool(this.physics, this.lighting, FLAGS.lowend ? 260 : 900);
    this.swarm = new DebrisSwarm(this.lighting, FLAGS.lowend ? 2200 : 9000);

    this.engine.volumePass = (colorTex, depthTex, volRT, compRT) => {
      if (!(P.get('t_visible') && P.get('t_density') > 0.002)) return null;
      this.tornado.syncUniforms(this.volume.uniforms);
      this.volume.render(this.engine.renderer, this.engine.camera, this.engine, colorTex, depthTex, volRT, compRT);
      return compRT.texture;
    };

    this.panel = new Panel(this);
    this.scene = null;
    this.sceneName = null;
    this.camMode = FLAGS.freecam ? 'orbit' : 'orbit';
    this._camT = 0;
    this._focus = new THREE.Vector3();
    this.frames = 0;
    this.errors = [];

    P.on('q_renderScale', () => this.engine.resize());
    P.on('t_halfRes', () => this.engine.applyQuality());
    this._bindKeys();
    addEventListener('resize', () => this.engine.resize());
  }

  _bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === '1') this.switchScene('ocean');
      else if (k === '2') this.switchScene('desert');
      else if (k === '3') this.switchScene('plain');
      else if (k === 'c') {
        this.camMode = CAM_MODES[(CAM_MODES.indexOf(this.camMode) + 1) % CAM_MODES.length];
        this.panel.toast('镜头：' + CAM_LABEL[this.camMode]);
      } else if (k === ' ') { this.strike(); e.preventDefault(); }
      else if (k === 'h') this.panel.el.classList.toggle('hide');
      else if (k === 'p') { this.engine.paused = !this.engine.paused; this.panel.toast(this.engine.paused ? '已暂停' : '继续'); }
      else if (k === 'r') this.rebuild();
    });
  }

  async switchScene(name) {
    if (!SCENES[name] || this._switching || this.sceneName === name) return;
    this._switching = true;
    this.boot(0.2, '载入场景：' + SCENES[name].label);
    try {
      if (this.scene) { this.scene.dispose(); this.scene = null; }
      this.physics.clear();
      const Cls = await SCENES[name].load();
      const sc = new Cls({
        engine: this.engine, lighting: this.lighting, tornado: this.tornado,
        physics: this.physics, debris: this.debris, swarm: this.swarm,
        toast: (m) => this.panel.toast(m), boot: this.boot,
      });
      await sc.init();
      this.scene = sc;
      this.sceneName = name;
      this.panel.setScene(name);
      this.camMode = CAM_MODES.includes(FLAGS.cam) ? FLAGS.cam : 'orbit';
      if (FLAGS.camDist) {
        const d = this.engine.camera.position.clone().sub(this.engine.controls.target);
        d.setLength(FLAGS.camDist);
        this.engine.camera.position.copy(this.engine.controls.target).add(d);
      }
      /* 让龙卷风回到场景内的合理位置 */
      this.tornado.strike(sc.camStart.target.x + 260, sc.camStart.target.z - 160, 0.1);
      this.boot(1, '就绪');
      document.getElementById('boot')?.classList.add('done');
    } catch (err) {
      this.errors.push(String(err && err.stack || err));
      window.__diag?.('SCENE ERROR ' + name + ': ' + (err && err.stack || err));
      this.boot(1, '场景载入失败：' + (err && err.message || err));
      throw err;
    } finally {
      this._switching = false;
    }
  }

  strike() {
    if (!this.scene) return;
    /* 朝相机注视方向前方的地面点扑过去；若场景有建筑群则优先扑向最近的建筑 */
    const c = this.engine.controls.target;
    let tx = c.x, tz = c.z;
    const pick = this.scene.pickStrikeTarget?.();
    if (pick) { tx = pick.x; tz = pick.z; }
    this.tornado.strike(tx, tz, 30);
    this.panel.toast('龙卷风正在扑向目标');
  }

  rebuild() {
    if (!this.scene) return;
    this.physics.bodies.length = 0;
    this.scene.rebuild?.();
    this.panel.toast('场景已重建');
  }

  _updateCamera(dt) {
    const cam = this.engine.camera;
    const ctl = this.engine.controls;
    const t = this.tornado;
    const f = this._focus;
    /* 焦点：龙卷风与相机目标之间，供阴影框使用 */
    f.set(t.position.x, t.position.y + 40, t.position.z).lerp(ctl.target, 0.45);

    if (this.camMode === 'chase') {
      ctl.target.x = damp(ctl.target.x, t.position.x, 1.6, dt);
      ctl.target.z = damp(ctl.target.z, t.position.z, 1.6, dt);
      ctl.target.y = damp(ctl.target.y, t.position.y + t.height * 0.28, 1.2, dt);
    } else if (this.camMode === 'cinema') {
      this._camT += dt;
      const a = this._camT * 0.055;
      const dist = lerp(420, 1150, 0.5 + 0.5 * Math.sin(this._camT * 0.045));
      const hgt = lerp(60, 420, 0.5 + 0.5 * Math.sin(this._camT * 0.031 + 1.2));
      cam.position.set(
        t.position.x + Math.cos(a) * dist,
        t.position.y + hgt,
        t.position.z + Math.sin(a) * dist);
      ctl.target.set(t.position.x, t.position.y + t.height * 0.3, t.position.z);
    } else if (this.camMode === 'ground') {
      /* 地面视角：站在 520 m 外仰望，整根涡柱刚好入画 */
      const back = FLAGS.camDist || 520;
      const ang = Math.atan2(this.engine.camera.position.z - t.position.z, this.engine.camera.position.x - t.position.x);
      const gx = t.position.x + Math.cos(ang) * back;
      const gz = t.position.z + Math.sin(ang) * back;
      const gy = this.scene ? this.scene.heightAt(gx, gz) : 0;
      cam.position.set(gx, gy + 14, gz);
      ctl.target.set(t.position.x, t.position.y + t.height * 0.34, t.position.z);
    }
    /* 不要钻到地下 */
    const gh = this.scene ? this.scene.heightAt(cam.position.x, cam.position.z) : 0;
    const minY = gh + (this.scene?.waterMode ? 3.5 : 2.5);
    if (cam.position.y < minY) cam.position.y = minY;
  }

  frame() {
    const dt = this.engine.tick();
    this.frames++;
    if (this.scene) {
      this.tornado.update(dt, this.engine.time);
      this._updateCamera(dt);
      this.scene.update(dt);
      this.physics.step(dt);
      this.debris.update();
      this.swarm.update(this.tornado, this.engine);
      this.lighting.update(this.engine.camera, dt, this._focus, this.tornado);
      this.engine.render(this.scene.scene);

      const s = this.engine.stats();
      this.panel.updateStats(this.engine.dt || 0.016, {
        scene: SCENES[this.sceneName]?.label || '-',
        fps: s.fps, ms: s.ms, calls: s.calls, tris: s.tris, programs: s.programs,
        volScale: s.volScale, debris: this.physics.bodies.length, sleeping: this.physics.sleeping,
        vmax: this.tornado.vmax, dist: this.tornado.distanceTo(this.engine.camera.position),
        extra: (CAM_LABEL[this.camMode] || '') + ' ' + (this.scene.extraStats?.() || ''),
      });
    }
  }

  async run() {
    await this.switchScene(FLAGS.scene in SCENES ? FLAGS.scene : 'plain');
    if (FLAGS.cycle) { await this.runCycle(); return; }
    const loop = () => {
      try { this.frame(); } catch (e) {
        this.errors.push(String(e && e.stack || e));
        window.__diag?.('FRAME ERROR: ' + (e && e.stack || e));
        if (this.errors.length > 6) return;    // 连续报错就停，避免刷屏
      }
      if (FLAGS.frames && this.frames >= FLAGS.frames) {
        if (FLAGS.selftest) this.selftest();
        else document.title = 'render:done';
        return;                       // 停止渲染，便于无头截图/自检
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** 渲染 n 帧（用于自检的确定性推进） */
  runFrames(n) {
    return new Promise((resolve) => {
      let i = 0;
      const step = () => {
        try { this.frame(); } catch (e) {
          this.errors.push(String(e && e.stack || e));
          window.__diag?.('FRAME ERROR: ' + (e && e.stack || e));
        }
        if (++i >= n) { resolve(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /** 三场景轮转自检：同时验证切场景的 dispose / 重建路径不泄漏不报错 */
  async runCycle() {
    const per = FLAGS.frames || 20;
    this.visited = [];
    for (const name of ['ocean', 'desert', 'plain']) {
      await this.switchScene(name);
      this.visited.push(name);
      await this.runFrames(per);
      /* 顺手验证"打击 / 重建"两条交互路径 */
      this.strike();
      await this.runFrames(6);
      this.rebuild();
      await this.runFrames(4);
      this.cycleStats = this.cycleStats || {};
      this.cycleStats[name] = { ...this.engine.stats(), extra: this.scene.extraStats?.() || '' };
    }
    this.selftest();
  }

  /** 无头自检：把关键状态写进 #diag，便于 --dump-dom / 截图读取 */
  selftest() {
    const out = [];
    const ok = [];
    const bad = [];
    const chk = (cond, msg) => { (cond ? ok : bad).push(msg); };
    const e = this.engine, t = this.tornado;
    out.push('renderer: ' + e.rendererName);
    out.push('webgl2: ' + e.isWebGL2 + '  msaa: ' + e.msaa + '  size: ' + e.size.x + 'x' + e.size.y);
    out.push('frames: ' + this.frames + '  avg ms: ' + e.perf.ms.toFixed(1));
    const s = e.stats();
    out.push('draw calls: ' + s.calls + '  tris: ' + s.tris + '  programs: ' + s.programs);
    out.push('scene: ' + this.sceneName + '  objects: ' + this.scene.scene.children.length);
    out.push('tornado: pos=' + t.position.toArray().map((v) => v.toFixed(1)).join(',') +
      ' vmax=' + t.vmax.toFixed(1) + ' omega=' + t.omega.toFixed(2) + ' H=' + t.height);
    const w = t.windAt(new THREE.Vector3(t.position.x + t.baseRadius, t.position.y + 20, t.position.z));
    out.push('wind@wall: ' + w.length().toFixed(1) + ' m/s  ' + w.toArray().map((v) => v.toFixed(1)).join(','));
    out.push('debris: ' + this.physics.bodies.length + ' floaters: ' + this.physics.floaters.length);
    out.push('scene extra: ' + (this.scene.extraStats?.() || '-'));
    if (this.scene.propBatchInfo) out.push('prop batching: ' + JSON.stringify(this.scene.propBatchInfo));
    /* 逐类型 draw call 归因，便于定位性能热点 */
    try {
      const tally = {};
      this.scene.scene.traverse((o) => {
        if (!o.visible) return;
        if (o.isMesh || o.isPoints || o.isLine) {
          const k = o.isInstancedMesh ? 'instanced' : (o.name || o.type).split('/')[0] || o.type;
          tally[k] = (tally[k] || 0) + 1;
        }
      });
      const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([k, v]) => k + '=' + v).join(' ');
      out.push('visible meshes: ' + top);
    } catch { }
    out.push('errors: ' + this.errors.length);
    for (const er of this.errors.slice(0, 3)) out.push('  ! ' + er.split('\n')[0]);

    chk(e.isWebGL2, 'webgl2');
    chk(this.frames >= (FLAGS.frames || 90), 'frames rendered');
    chk(s.calls > 3, 'draw calls > 3');
    chk(s.programs > 4, 'shader programs compiled');
    /* 着色器编译/链接失败会走 console.error，被 index.html 收集进 __DIAG */
    const diagText = (window.__DIAG || []).join('\n');
    chk(!/Shader Error|not compiled|VALIDATE_STATUS false/i.test(diagText), 'no shader compile errors');
    chk(!/JS-ERROR|PROMISE-REJECT/i.test(diagText), 'no uncaught js errors');
    chk(Number.isFinite(t.position.x + t.position.y + t.position.z), 'tornado position finite');
    chk(Number.isFinite(w.length()) && w.length() > 10, 'wind field alive');
    chk(this.errors.length === 0, 'no runtime errors');
    const extra = this.scene.selftest?.() || [];
    for (const [cond, msg] of extra) chk(cond, msg);
    if (FLAGS.cycle) {
      chk((this.visited || []).length === 3, 'all three scenes built (' + (this.visited || []).join(',') + ')');
      chk(this.engine.renderer.info.memory.textures < 260, 'texture count sane (' + this.engine.renderer.info.memory.textures + ')');
      chk(this.engine.renderer.info.memory.geometries < 3000, 'geometry count sane (' + this.engine.renderer.info.memory.geometries + ')');
      if (this.cycleStats) {
        for (const k in this.cycleStats) {
          const c = this.cycleStats[k];
          out.push(`  [${k}] calls=${c.calls} tris=${c.tris} ${c.extra}`);
        }
      }
    }

    out.push('');
    out.push('PASS: ' + ok.join(', '));
    if (bad.length) out.push('FAIL: ' + bad.join(', '));
    out.push(bad.length ? 'SELFTEST FAIL' : 'SELFTEST PASS');
    const el = document.getElementById('diag');
    el.hidden = false;
    el.textContent = (window.__DIAG?.length ? window.__DIAG.join('\n') + '\n---\n' : '') + out.join('\n');
    document.title = bad.length ? 'selftest:fail' : 'selftest:pass';
  }
}

(async () => {
  try {
    const app = new App();
    window.__app = app;
    await app.run();
  } catch (e) {
    window.__diag?.('BOOT ERROR: ' + (e && e.stack || e));
    const bm = document.getElementById('bootMsg');
    if (bm) { bm.textContent = '启动失败：' + (e && e.message || e); bm.style.color = '#ff6b6b'; }
    document.title = 'selftest:fail';
    const el = document.getElementById('diag');
    if (el) { el.hidden = false; el.textContent = (window.__DIAG || []).join('\n'); }
  }
})();
