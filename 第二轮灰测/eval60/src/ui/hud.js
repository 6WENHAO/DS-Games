/**
 * HUD：仪表、目标标记、雷达、警告与提示。
 * 直接操作 DOM（比在 canvas 里画文字更清晰、且天然适配高 DPI 与手机）。
 */
import * as THREE from 'three';
import { clamp, clamp01, formatDistance, formatSpeed } from '../util/math.js';

const _v = new THREE.Vector3();
const _local = new THREE.Vector3();
const _mat = new THREE.Matrix4();

export class HUD {
  constructor(dom) {
    this.dom = dom;
    this.visible = true;
    this.markers = new Map();
    this.radarCtx = dom.radar?.getContext('2d') ?? null;
    this._msgTimer = 0;
    this._fpsAcc = 0;
    this._fpsFrames = 0;
    this._fps = 60;
    this._lastWarnKey = '';
    this.resizeRadar();
  }

  resizeRadar() {
    const c = this.dom.radar;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = c.clientWidth || 148;
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
    this._radarDpr = dpr;
    this._radarSize = size;
  }

  toggle() {
    this.visible = !this.visible;
    this.dom.root.classList.toggle('hud-hidden', !this.visible);
  }

  message(text, ms = 2600) {
    if (!this.dom.toast) return;
    this.dom.toast.textContent = text;
    this.dom.toast.classList.add('show');
    this._msgTimer = ms / 1000;
  }

  /** 创建/更新天体屏幕标记 */
  _updateMarkers(camera, bodies, target, shipPos) {
    const layer = this.dom.markerLayer;
    if (!layer) return;
    const w = layer.clientWidth, h = layer.clientHeight;
    const half = { x: w / 2, y: h / 2 };
    for (const b of bodies) {
      let m = this.markers.get(b.key);
      if (!m) {
        const el = document.createElement('div');
        el.className = `marker marker-${b.type}`;
        el.innerHTML = `<span class="mk-ring"></span><span class="mk-label"></span>`;
        layer.appendChild(el);
        m = { el, label: el.querySelector('.mk-label') };
        this.markers.set(b.key, m);
      }
      _v.copy(b.position).project(camera);
      const dist = shipPos.distanceTo(b.position);
      const behind = _v.z > 1;
      const onScreen = !behind && Math.abs(_v.x) < 1.08 && Math.abs(_v.y) < 1.08;
      const isTarget = target && target.key === b.key;
      // 距离过近时（占满屏幕）不显示标记
      const angular = Math.atan2(b.radius, Math.max(dist, 1));
      const tooClose = angular > 0.55;
      if ((!onScreen && !isTarget) || tooClose) {
        m.el.style.display = 'none';
        continue;
      }
      let x = clamp(_v.x, -1, 1) * half.x + half.x;
      let y = -clamp(_v.y, -1, 1) * half.y + half.y;
      if (behind || !onScreen) {
        // 目标在视野外：贴边显示
        const len = Math.hypot(_v.x, _v.y) || 1;
        const k = 0.94 / len;
        x = _v.x * k * (behind ? -1 : 1) * half.x + half.x;
        y = -_v.y * k * (behind ? -1 : 1) * half.y + half.y;
        x = clamp(x, 26, w - 26);
        y = clamp(y, 26, h - 26);
      }
      m.el.style.display = 'block';
      m.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      m.el.classList.toggle('is-target', !!isTarget);
      m.el.classList.toggle('off-screen', behind || !onScreen);
      m.label.textContent = isTarget
        ? `${b.cn} ${b.name}  ${formatDistance(dist)}`
        : `${b.cn}  ${formatDistance(dist)}`;
    }
  }

  _drawRadar(flight, bodies, blackHole, target) {
    const ctx = this.radarCtx;
    if (!ctx) return;
    const dpr = this._radarDpr;
    const S = this._radarSize;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2, R = S / 2 - 4;

    // 背景
    ctx.fillStyle = 'rgba(6,14,24,0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(90,200,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,200,255,0.16)';
    for (const r of [R * 0.33, R * 0.66]) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.stroke();

    // 以飞船为原点、机头朝上的局部坐标
    _mat.copy(new THREE.Matrix4().makeRotationFromQuaternion(flight.quaternion)).invert();
    const scale = 100000;
    const plot = (pos, radius, color, isTarget, label) => {
      _local.copy(pos).sub(flight.position).applyMatrix4(_mat);
      const d = Math.hypot(_local.x, _local.z);
      // 对数压缩，近处精细远处也能看到
      const k = Math.log10(1 + d / 60) / Math.log10(1 + scale / 60);
      const rr = clamp01(k) * R;
      const ang = Math.atan2(_local.x, -_local.z);
      const px = cx + Math.sin(ang) * rr;
      const py = cy - Math.cos(ang) * rr;
      const size = clamp(2 + radius / 260, 2, 5.5);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px, py, isTarget ? size + 1.6 : size, 0, Math.PI * 2); ctx.fill();
      if (isTarget) {
        ctx.strokeStyle = '#ffd257';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(px, py, size + 4.5, 0, Math.PI * 2); ctx.stroke();
      }
      // 上下高度指示
      if (Math.abs(_local.y) > 200) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - clamp(_local.y / 3000, -8, 8));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    for (const b of bodies) {
      const col = b.type === 'star' ? '#ffcf6a'
        : b.type === 'moon' ? '#9fb4c8'
          : `#${new THREE.Color(b.color).getHexString()}`;
      plot(b.position, b.radius, col, target && target.key === b.key);
    }
    if (blackHole) plot(blackHole.position, blackHole.rs, '#c07bff', target && target.key === 'bh');

    // 本舰
    ctx.fillStyle = '#eaf6ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx - 3.4, cy + 4); ctx.lineTo(cx + 3.4, cy + 4);
    ctx.closePath(); ctx.fill();
  }

  update(dt, ctx) {
    const { flight, camera, bodies, blackHole, target, cameraMode, quality } = ctx;
    const d = this.dom;

    this._fpsAcc += dt; this._fpsFrames++;
    if (this._fpsAcc > 0.5) {
      this._fps = this._fpsFrames / this._fpsAcc;
      this._fpsAcc = 0; this._fpsFrames = 0;
    }

    if (this._msgTimer > 0) {
      this._msgTimer -= dt;
      if (this._msgTimer <= 0) d.toast?.classList.remove('show');
    }

    if (!this.visible) return;

    const t = flight.telemetry();
    // 数值
    if (d.speed) d.speed.textContent = formatSpeed(t.speed);
    if (d.throttleVal) d.throttleVal.textContent = `${Math.round(t.throttle * 100)}%`;
    if (d.throttleBar) d.throttleBar.style.transform = `scaleY(${t.throttle.toFixed(3)})`;
    if (d.energyBar) d.energyBar.style.transform = `scaleX(${(t.energy / 100).toFixed(3)})`;
    if (d.hullBar) d.hullBar.style.transform = `scaleX(${(t.hull / 100).toFixed(3)})`;
    if (d.energyVal) d.energyVal.textContent = `${Math.round(t.energy)}`;
    if (d.hullVal) d.hullVal.textContent = `${Math.round(t.hull)}`;
    if (d.fps) d.fps.textContent = `${Math.round(this._fps)} FPS · ${quality}`;
    if (d.mode) d.mode.textContent = { chase: '追尾视角', cockpit: '座舱视角', cine: '电影视角' }[cameraMode] ?? cameraMode;
    if (d.boostLamp) d.boostLamp.classList.toggle('on', t.boost > 0.35);
    if (d.warpLamp) d.warpLamp.classList.toggle('on', t.warp > 0.2);

    // 目标信息
    if (d.targetName && target) {
      const dist = flight.position.distanceTo(target.position);
      d.targetName.textContent = `${target.cn} · ${target.name}`;
      d.targetDist.textContent = formatDistance(dist);
      const closing = -_v.copy(target.position).sub(flight.position).normalize().dot(flight.velocity);
      d.targetClose.textContent = `${closing > 0 ? '-' : '+'}${formatSpeed(Math.abs(closing))}`;
    }

    // 警告
    if (d.warnBox) {
      const w = t.warnings.slice().sort((a, b) => b.level - a.level)[0];
      if (w) {
        d.warnBox.textContent = w.text;
        d.warnBox.classList.add('show');
        d.warnBox.classList.toggle('critical', w.level > 0.55);
      } else {
        d.warnBox.classList.remove('show');
      }
    }

    // 屏幕标记 + 雷达
    this._updateMarkers(camera, bodies, target, flight.position);
    this._drawRadar(flight, bodies, blackHole, target);

    // 速度矢量指示
    if (d.velVec && flight.speed > 3) {
      _v.copy(flight.position).addScaledVector(flight.velocity, 220 / Math.max(1, flight.speed));
      _v.project(camera);
      if (_v.z < 1) {
        const layer = this.dom.markerLayer;
        const x = _v.x * layer.clientWidth / 2 + layer.clientWidth / 2;
        const y = -_v.y * layer.clientHeight / 2 + layer.clientHeight / 2;
        d.velVec.style.display = 'block';
        d.velVec.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      } else {
        d.velVec.style.display = 'none';
      }
    } else if (d.velVec) {
      d.velVec.style.display = 'none';
    }
  }
}
