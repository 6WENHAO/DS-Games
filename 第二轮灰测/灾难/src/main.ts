import * as THREE from 'three';
import './style.css';
import { SandboxControls } from './core/controls';
import { Engine } from './core/engine';
import { clamp } from './core/rng';
import { DisasterManager } from './disasters/manager';
import { Sandbox } from './sandbox';
import { Hud } from './ui/hud';
import { Reticle } from './ui/reticle';

const container = document.getElementById('app');
if (!container) throw new Error('#app container missing');

const engine = new Engine(container);
const sandbox = new Sandbox(engine);
const manager = new DisasterManager(sandbox);
const reticle = new Reticle(engine.scene);

let slowMotion = false;
let hoverPoint: THREE.Vector3 | null = null;
const steer = new THREE.Vector2();

const hud = new Hud(container, manager.specs, {
  onSelect: (id) => {
    sandbox.audio.resume();
    sandbox.audio.uiClick();
    manager.select(id);
    syncUi();
    if (!manager.armed && !manager.isRunning(id)) reticle.hide();
  },
  onRebuild: () => {
    sandbox.audio.resume();
    sandbox.audio.uiClick();
    manager.reset();
    sandbox.rebuild();
    controls.reset();
    reticle.hide();
    hud.toast('城市已重建');
    syncUi();
  },
  onSlow: (on) => {
    slowMotion = on;
    engine.timeScale = on ? 0.26 : 1;
    sandbox.audio.setSlowMotion(on);
    hud.toast(on ? '慢镜头开启' : '慢镜头关闭');
  },
  onSound: (on) => {
    sandbox.audio.setEnabled(on);
    if (on) sandbox.audio.resume();
    hud.toast(on ? '音效开启' : '音效关闭');
  },
  onPower: (v) => {
    sandbox.power = clamp(v, 0.35, 2.2);
  },
  onTilt: (v) => {
    engine.setTiltAmount(v);
  },
});

const controls = new SandboxControls(engine.camera, engine.renderer.domElement, {
  onTap: (ground) => {
    sandbox.audio.resume();
    if (manager.release(ground)) syncUi();
  },
  onHover: (ground) => {
    hoverPoint = ground;
    updateReticle();
  },
  onCancel: () => {
    if (manager.armed) {
      manager.cancel();
      reticle.hide();
      syncUi();
      hud.toast('已取消当前灾难');
    }
  },
  onGesture: () => sandbox.audio.resume(),
});

manager.onMessage = (text) => hud.toast(text);
sandbox.power = 1;
engine.setTiltAmount(0.45);

function updateReticle(): void {
  if (manager.armed && hoverPoint) {
    reticle.show(hoverPoint.x, hoverPoint.z, manager.reticleRadius(), manager.reticleColor());
    engine.renderer.domElement.classList.add('armed');
  } else {
    reticle.hide();
    engine.renderer.domElement.classList.remove('armed');
  }
}

function syncUi(): void {
  hud.syncTools(manager.armed, (id) => manager.isRunning(id));
  hud.setHint(manager.hint());
  updateReticle();
}

let statTimer = 0;
engine.onUpdate((dt, simDt) => {
  controls.update(dt);
  controls.steerVector(steer);
  manager.update(dt, simDt, steer);
  sandbox.update(dt, simDt);
  reticle.update(dt);
  sandbox.screen.update(dt);
  hud.update(dt);

  statTimer -= dt;
  if (statTimer <= 0) {
    statTimer = 0.25;
    hud.setStats({
      voxels: sandbox.voxelCount,
      debris: sandbox.debrisCount,
      peds: sandbox.crowd.aliveCount,
      fps: engine.fps,
    });
    hud.setHint(manager.hint());
    hud.syncTools(manager.armed, (id) => manager.isRunning(id));
  }
});

engine.start();
syncUi();

// hide the boot splash once the first real frame is on screen
const hideBoot = (): void => {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('hidden');
  window.setTimeout(() => boot.remove(), 600);
};
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    hideBoot();
    hud.toast(`微缩城市已就绪 · ${sandbox.voxelCount.toLocaleString('en-US')} 体素`);
  });
});
// fallback in case the tab is hidden and rAF never fires
window.setTimeout(hideBoot, 2500);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    slowMotion = !slowMotion;
    engine.timeScale = slowMotion ? 0.26 : 1;
    sandbox.audio.setSlowMotion(slowMotion);
    hud.toast(slowMotion ? '慢镜头开启' : '慢镜头关闭');
  }
});

// Debug/verification handle: also lets tooling drive deterministic frames when
// the host browser throttles requestAnimationFrame.
(window as unknown as { __sandbox?: unknown }).__sandbox = {
  engine,
  sandbox,
  manager,
  controls,
  hud,
  step: (frames = 1, dt = 1 / 60, render = true): void => {
    for (let i = 0; i < frames; i++) engine.frame(dt, render);
  },
  capture: (): string => {
    engine.frame(1 / 60, true);
    return engine.captureDataURL();
  },
};
