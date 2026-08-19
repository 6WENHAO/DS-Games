/* =========================================================================
   相机（自写轨道控制 + 电影感巡航 + 预设机位）与界面
   ========================================================================= */
class Orbit {
  constructor(cam, dom) {
    this.cam = cam; this.dom = dom;
    this.target = new THREE.Vector3(0, 90, 0);
    this.tGoal = this.target.clone();
    this.sph = new THREE.Spherical(1800, 1.15, 2.2);
    this.gGoal = { r: 1800, phi: 1.15, th: 2.2 };
    this.minR = 14; this.maxR = 16000;
    this.drag = 0; this.px = 0; this.py = 0; this.pinch = 0;
    this.anim = null; this.userTime = 0;
    const d = dom;
    d.style.touchAction = 'none';
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    d.addEventListener('pointerdown', (e) => {
      d.setPointerCapture(e.pointerId);
      this.drag = (e.button === 2 || e.shiftKey) ? 2 : 1;
      this.px = e.clientX; this.py = e.clientY; this.mark();
    });
    d.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.px, dy = e.clientY - this.py;
      this.px = e.clientX; this.py = e.clientY;
      if (this.drag === 1) {
        this.gGoal.th -= dx * 0.0042;
        this.gGoal.phi = clamp(this.gGoal.phi - dy * 0.0035, 0.035, 1.62);
      } else this.pan(dx, dy);
      this.mark();
    });
    const up = (e) => { this.drag = 0; };
    d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
    d.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = Math.exp(clamp(e.deltaY, -260, 260) * 0.0011);
      this.gGoal.r = clamp(this.gGoal.r * k, this.minR, this.maxR);
      this.mark();
    }, { passive: false });
    d.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const a = e.touches[0], b = e.touches[1];
        const dd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (this.pinch) { this.gGoal.r = clamp(this.gGoal.r * (this.pinch / dd), this.minR, this.maxR); }
        this.pinch = dd; this.mark(); this.drag = 0;
      }
    }, { passive: true });
    d.addEventListener('touchend', () => { this.pinch = 0; });
  }
  mark() { this.userTime = 2.5; this.anim = null; if (S.orbit) setOrbit(false); }
  pan(dx, dy) {
    const r = this.sph.radius * 0.0016;
    const fwd = _v0.copy(this.cam.position).sub(this.target).setY(0).normalize();
    const rgt = _v1.set(-fwd.z, 0, fwd.x);
    this.tGoal.addScaledVector(rgt, dx * r).addScaledVector(fwd, dy * r * 0.9);
    this.tGoal.y = clamp(this.tGoal.y, 0, 900);
  }
  goto(pos, tgt, dur = 1.7) {
    const p0 = this.cam.position.clone(), t0 = this.target.clone();
    this.anim = { p0, t0, p1: pos.clone(), t1: tgt.clone(), t: 0, dur };
  }
  setFrom(pos, tgt) {
    this.tGoal.copy(tgt); this.target.copy(tgt);
    const off = _v0.copy(pos).sub(tgt);
    const s = new THREE.Spherical().setFromVector3(off);
    this.gGoal.r = s.radius; this.gGoal.phi = clamp(s.phi, 0.035, 1.62); this.gGoal.th = s.theta;
    this.sph.radius = s.radius; this.sph.phi = this.gGoal.phi; this.sph.theta = s.theta;
  }
  update(dt) {
    if (this.userTime > 0) this.userTime -= dt;
    if (this.anim) {
      const a = this.anim; a.t += dt;
      const k = clamp(a.t / a.dur, 0, 1), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.cam.position.lerpVectors(a.p0, a.p1, e);
      this.target.lerpVectors(a.t0, a.t1, e);
      this.cam.lookAt(this.target);
      if (k >= 1) { this.setFrom(a.p1, a.t1); this.anim = null; }
      return;
    }
    if (S.orbit && this.userTime <= 0) {
      this.gGoal.th += dt * 0.026;
      this.gGoal.phi = clamp(this.gGoal.phi + Math.sin(S.t * 0.07) * dt * 0.012, 0.09, 1.4);
      this.gGoal.r *= 1 + Math.sin(S.t * 0.045) * dt * 0.02;
    }
    const k = 1 - Math.exp(-dt * 6.5);
    this.sph.radius = lerp(this.sph.radius, this.gGoal.r, k);
    this.sph.phi = lerp(this.sph.phi, this.gGoal.phi, k);
    this.sph.theta = lerp(this.sph.theta, this.gGoal.th, k);
    this.target.lerp(this.tGoal, k);
    const p = _v0.setFromSpherical(this.sph).add(this.target);
    // 不入水、不入山
    const gh = landHeight(p.x, p.z) + 3.5;
    const minY = Math.max(3.2, gh);
    if (p.y < minY) {
      p.y = minY;
      this.sph.setFromVector3(_v1.copy(p).sub(this.target));
      this.gGoal.phi = Math.min(this.gGoal.phi, this.sph.phi);
    }
    this.cam.position.copy(p);
    this.cam.lookAt(this.target);
  }
}

/* 机位预设 */
const VIEWS = [
  { p: [1000, 154, -620], t: [360, 95, 85], n: '马林角经典远景' },
  { p: [-902, 74.8, 4.8], t: [320, 76.5, 3.4], n: '桥面行车视角' },
  { p: [404, 8, 168], t: [640, 168, -6], n: '塔基仰望' },
  { p: [-96, 11, 268], t: [420, 96, -40], n: '海面掠行' },
  { p: [-1168, 18, 188], t: [-880, 108, 26], n: '堡垒点仰视' },
  { p: [-1620, 760, -1720], t: [40, 90, 30], n: '航拍全景' },
];
function applyView(i, controls, dur = 1.8) {
  const v = VIEWS[i]; if (!v) return;
  setOrbit(false);
  controls.goto(new THREE.Vector3(...v.p), new THREE.Vector3(...v.t), dur);
  controls.userTime = 3.5;
}

/* ---------------- 界面 ---------------- */
let ui = {};
function setOrbit(on) {
  S.orbit = on;
  if (ui.bOrbit) ui.bOrbit.classList.toggle('on', on);
}
function fmtHour(h) {
  const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
function setupUI(controls, renderer) {
  ui = {
    sHour: document.getElementById('sHour'), vHour: document.getElementById('vHour'),
    sFog: document.getElementById('sFog'), sCar: document.getElementById('sCar'),
    bOrbit: document.getElementById('bOrbit'), bLight: document.getElementById('bLight'),
    bXray: document.getElementById('bXray'), stats: document.getElementById('stats'),
    clock: document.getElementById('clock'),
  };
  ui.sHour.value = S.hour; ui.sFog.value = S.fog; ui.sCar.value = S.traffic;
  ui.vHour.textContent = fmtHour(S.hour);
  ui.sHour.addEventListener('input', () => {
    S.hour = parseFloat(ui.sHour.value);
    ui.vHour.textContent = fmtHour(S.hour);
    envDirty = true;
  });
  ui.sFog.addEventListener('input', () => { S.fog = parseFloat(ui.sFog.value); });
  ui.sCar.addEventListener('input', () => { S.traffic = parseFloat(ui.sCar.value); });
  ui.bOrbit.addEventListener('click', () => { setOrbit(!S.orbit); controls.userTime = 0; });
  ui.bLight.addEventListener('click', () => { S.lamps = !S.lamps; ui.bLight.classList.toggle('on', S.lamps); });
  ui.bXray.addEventListener('click', () => { S.xray = !S.xray; ui.bXray.classList.toggle('on', S.xray); applyXray(); });
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.addEventListener('click', () => applyView(parseInt(b.dataset.view, 10), controls));
  });
  addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '6') applyView(parseInt(e.key, 10) - 1, controls);
    else if (e.code === 'Space') { setOrbit(!S.orbit); controls.userTime = 0; e.preventDefault(); }
    else if (e.key === 'h' || e.key === 'H') {
      S.ui = !S.ui;
      document.querySelectorAll('.hud').forEach((n) => { n.style.display = S.ui ? '' : 'none'; });
    } else if (e.key === 'x' || e.key === 'X') { ui.bXray.click(); }
  });
}
function applyXray() {
  const on = S.xray;
  for (const m of [MAT.road, MAT.walk, MAT.concreteS]) {
    m.transparent = on; m.opacity = on ? 0.17 : 1; m.depthWrite = !on; m.needsUpdate = true;
  }
  MAT.orange.emissive.setHex(on ? 0x2a0a02 : 0x000000);
  MAT.orange.emissiveIntensity = on ? 1 : 0;
}
