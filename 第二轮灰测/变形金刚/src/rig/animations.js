/**
 * animations.js —— 叠加动画层
 *
 * 运行顺序：transformer.apply()（写入基础位姿） → animator.update()（在基础位姿上叠加）
 * 因为基础位姿每帧都重写，所以这里的 += 不会累积漂移。
 * 每条动画都按「机器人权重 / 载具权重」淡入淡出，所以变形过程中不会打架。
 */
const lerp = (a, b, t) => a + (b - a) * t;

export class Animator {
  constructor(rig, tf, M) {
    this.rig = rig;
    this.tf = tf;
    this.M = M;
    this.t = 0;
    this.gait = 0;
    this.walkW = 0;
    this.waveW = 0;
    /* 开关 / 强度 */
    this.idle = true;
    this.idleAmt = 1.0;
    this.wave = false;
    this.headTrack = true;
    this.engineShake = true;
    this.blink = true;
    this._blinkT = 2;
    this._blinkV = 1;
  }

  j(n) { return this.rig.joints[n]?.obj; }

  update(dt, ctx) {
    this.t += dt;
    const t = this.t;
    const rw = this.tf.robotW, vw = this.tf.vehicleW;

    /* ---- 权重淡入淡出 ---- */
    const wantWalk = ctx.moving && rw > 0.5 ? 1 : 0;
    this.walkW = lerp(this.walkW, wantWalk, Math.min(1, dt * 7));
    this.waveW = lerp(this.waveW, this.wave && rw > 0.5 ? 1 : 0, Math.min(1, dt * 5));

    const core = this.j('core'), waist = this.j('waist'), chest = this.j('chest');
    const head = this.j('head'), neck = this.j('neck'), lift = this.rig.lift;

    /* ============ 待机（呼吸 / 微摆 / 环视） ============ */
    const iw = rw * this.idleAmt * (1 - this.walkW) * (this.idle ? 1 : 0);
    if (iw > 0.001) {
      const b = Math.sin(t * 1.45);
      core.position.y += b * 0.022 * iw;
      chest.rotation.x += b * 0.013 * iw;
      waist.rotation.y += Math.sin(t * 0.52) * 0.055 * iw;
      lift.rotation.z += Math.sin(t * 0.61 + 1.1) * 0.008 * iw;
      for (const s of ['L', 'R']) {
        const sh = this.j('shoulder' + s), el = this.j('elbow' + s), sgn = s === 'L' ? -1 : 1;
        sh.rotation.x += Math.sin(t * 1.45 + 0.7) * 0.03 * iw;
        sh.rotation.z += sgn * Math.abs(Math.sin(t * 0.52)) * 0.035 * iw;
        el.rotation.x -= Math.abs(Math.sin(t * 0.75 + 0.4)) * 0.05 * iw;
      }
      if (this.headTrack) {
        const yaw = Math.sin(t * 0.29) * 0.55 + Math.sin(t * 0.17 + 1.7) * 0.4;
        head.rotation.y += yaw * 0.30 * iw;
        head.rotation.x += Math.sin(t * 0.23 + 0.9) * 0.09 * iw;
        neck.rotation.y += yaw * 0.10 * iw;
      }
    }

    /* ============ 步行（机器人态移动） ============ */
    if (this.walkW > 0.003) {
      const w = this.walkW * rw;
      const sp = Math.max(0.25, ctx.speedNorm);
      this.gait += dt * ctx.gaitOmega;
      const p = this.gait;
      const A = 0.40 * sp, K = 0.72 * sp;
      for (const s of ['L', 'R']) {
        const ph = s === 'L' ? p : p + Math.PI;
        const hip = this.j('hip' + s), knee = this.j('knee' + s), ank = this.j('ankle' + s), toe = this.j('toe' + s);
        const sw = Math.sin(ph);
        hip.rotation.x += -sw * A * w;
        knee.rotation.x += Math.max(0, Math.sin(ph + 1.15)) * K * w;
        ank.rotation.x += (sw * 0.18 - Math.max(0, Math.sin(ph + 2.2)) * 0.22) * w;
        toe.rotation.x += Math.max(0, -Math.sin(ph + 0.6)) * 0.30 * w;
        /* 手臂反向摆 */
        const sh = this.j('shoulder' + s), el = this.j('elbow' + s);
        sh.rotation.x += sw * 0.34 * w * sp;
        el.rotation.x += (-0.30 - Math.max(0, sw) * 0.28) * w * sp;
      }
      core.position.y += (Math.abs(Math.sin(p)) * -0.085 + 0.03) * w * sp;
      core.position.z += Math.sin(p * 2) * 0.02 * w;
      waist.rotation.y += Math.sin(p) * 0.13 * w;
      chest.rotation.x += 0.05 * w * sp + Math.abs(Math.sin(p)) * 0.02 * w;
      lift.rotation.z += Math.sin(p) * 0.035 * w;
      head.rotation.x -= 0.04 * w;
    }

    /* ============ 挥手（融合到目标角度，避免与站姿叠加冲突） ============ */
    if (this.waveW > 0.003) {
      const w = this.waveW;
      const sh = this.j('shoulderR'), el = this.j('elbowR'), wr = this.j('wristR');
      sh.rotation.z = lerp(sh.rotation.z, -2.42, w);
      sh.rotation.x = lerp(sh.rotation.x, -0.16, w);
      el.rotation.x = lerp(el.rotation.x, -0.62, w);
      el.rotation.z = lerp(el.rotation.z, Math.sin(t * 7.4) * 0.52, w);
      wr.rotation.z = lerp(wr.rotation.z, Math.sin(t * 7.4 + 0.5) * 0.34, w);
      head.rotation.y = lerp(head.rotation.y, -0.16, w);
      chest.rotation.z = lerp(chest.rotation.z, 0.06, w);
    }

    /* ============ 载具态：悬挂 / 车身姿态 / 发动机抖动 ============ */
    if (vw > 0.02) {
      const sp = ctx.speedNorm;
      if (this.engineShake) {
        core.position.y += Math.sin(t * 37) * 0.0022 * vw;
        core.rotation.z = (core.rotation.z || 0) + Math.sin(t * 41 + 1) * 0.0012 * vw;
      }
      core.position.y += Math.sin(t * 10.5) * 0.016 * sp * vw + Math.sin(t * 17.3) * 0.008 * sp * vw;
      lift.rotation.x = -ctx.accelN * 0.030 * vw;
      lift.rotation.z += -ctx.steerN * sp * 0.055 * vw;
      chest.rotation.x += -ctx.accelN * 0.022 * vw;
    }

    /* ============ 眼睛闪烁 ============ */
    if (this.blink && rw > 0.3) {
      this._blinkT -= dt;
      if (this._blinkT < 0) { this._blinkT = 2.2 + Math.random() * 4.5; this._blinkV = 0; }
      this._blinkV = Math.min(1, this._blinkV + dt * 7);
      const k = 0.22 + 0.78 * this._blinkV;
      this.M.glow.emissiveIntensity *= k;
    }
  }
}
