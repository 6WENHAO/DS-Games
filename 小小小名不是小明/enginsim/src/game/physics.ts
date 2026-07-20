import * as THREE from 'three';

export interface DriveInput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}

export interface VehicleParams {
  mass: number;
  inertiaZ: number;
  a: number;
  b: number;
  hCg: number;
  wheelRadius: number;
  muRoad: number;
  muGrass: number;
  cD: number;
  frontalArea: number;
  maxSteer: number;
  gears: number[];
  finalDrive: number;
  idleRpm: number;
  redline: number;
  shiftUpRpm: number;
  shiftDownRpm: number;
  torqueMax: number;
  downforceCA: number;
  rollStiffness: number;
  steerRate: number;
}

export const MUSCLE_CAR: VehicleParams = {
  mass: 1620,
  inertiaZ: 2600,
  a: 1.42,
  b: 1.38,
  hCg: 0.52,
  wheelRadius: 0.35,
  muRoad: 1.05,
  muGrass: 0.55,
  cD: 0.38,
  frontalArea: 2.3,
  maxSteer: 0.58,
  gears: [3.15, 2.1, 1.55, 1.22, 1.0, 0.82],
  finalDrive: 3.55,
  idleRpm: 850,
  redline: 6600,
  shiftUpRpm: 6300,
  shiftDownRpm: 2100,
  torqueMax: 520,
  downforceCA: 0.35,
  rollStiffness: 1.0,
  steerRate: 5.5
};

export const SPORT_CAR: VehicleParams = {
  mass: 1390,
  inertiaZ: 2050,
  a: 1.55,
  b: 0.98,
  hCg: 0.44,
  wheelRadius: 0.33,
  muRoad: 1.18,
  muGrass: 0.5,
  cD: 0.32,
  frontalArea: 2.0,
  maxSteer: 0.55,
  gears: [3.55, 2.36, 1.78, 1.43, 1.18, 0.97],
  finalDrive: 3.9,
  idleRpm: 950,
  redline: 7800,
  shiftUpRpm: 7500,
  shiftDownRpm: 2900,
  torqueMax: 440,
  downforceCA: 2.1,
  rollStiffness: 0.42,
  steerRate: 7.5
};

const DEG = Math.PI / 180;

function engineTorque(rpm: number, p: VehicleParams): number {
  const span = p.redline * 0.82;
  const base = 0.6 + 0.4 * Math.sin(Math.PI * THREE.MathUtils.clamp((rpm - 800) / span, 0, 1));
  const falloff = 1 - Math.max(0, (rpm - p.redline * 0.94) / (p.redline * 0.21));
  return p.torqueMax * base * Math.max(0.2, falloff);
}

function tireFy(slip: number, mu: number, fz: number): number {
  const B = 9.5, C = 1.55;
  return -mu * fz * Math.sin(C * Math.atan(B * slip));
}

function smoothstep01(x: number, a: number, b: number): number {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export class VehicleSim {
  pos = new THREE.Vector2();
  yaw = 0;
  vx = 0;
  vy = 0;
  yawRate = 0;

  gear = 1;
  rpm: number;
  shiftTimer = 0;
  limiterCut = 0;
  steerAngle = 0;
  slipFront = 0;
  slipRear = 0;
  audioThrottle = 0;
  onGrass = false;
  ax = 0;
  assistedSteer = 0;

  private fyF = 0;
  private fyR = 0;
  private axLp = 0;
  private alphaOpt = 7 * DEG;
  private selfSteerSm = 0;
  private p: VehicleParams;

  constructor(p: VehicleParams) {
    this.p = p;
    this.rpm = p.idleRpm;
  }

  reset(x: number, z: number, yaw: number) {
    this.pos.set(x, z);
    this.yaw = yaw;
    this.vx = this.vy = this.yawRate = 0;
    this.gear = 1;
    this.rpm = this.p.idleRpm;
    this.steerAngle = 0;
    this.fyF = this.fyR = this.ax = this.axLp = 0;
    this.selfSteerSm = 0;
  }

  get speedKmh(): number {
    return Math.hypot(this.vx, this.vy) * 3.6;
  }

  /*
   * Steering assist per the "转向辅助与自回正" spec:
   * - anti-understeer cap from best-radius Ackermann geometry + learned optimal slip
   * - self-countersteer torque from front-axle velocity alignment + yaw damping
   * - state fusion by rear slip angle, faded out at very low speed
   */
  private steerAssist(raw: number, gripAccel: number, offroad: number, dt: number): number {
    const p = this.p;
    const L = p.a + p.b;
    const v = Math.max(Math.abs(this.vx), 0.1);

    const alphaF = Math.atan2(this.vy + p.a * this.yawRate, v);
    const alphaR = Math.atan2(this.vy - p.b * this.yawRate, v);

    if (v > 8 && Math.abs(this.slipFront) > this.alphaOpt * 0.75) {
      const ideal = THREE.MathUtils.clamp(Math.abs(this.slipFront) * 0.9, 4 * DEG, 14 * DEG);
      this.alphaOpt += (ideal - this.alphaOpt) * Math.min(1, dt * 1.0);
    }
    const alphaOptEff = this.alphaOpt + offroad * 12 * DEG;

    const grip = Math.max(0.5, gripAccel);
    const rBest = (v * v) / grip;
    const thetaSlip = Math.atan(L / Math.max(rBest, 1)) + alphaOptEff;
    const thetaAck = Math.atan2(L, 12);
    const thetaBase = Math.max(thetaSlip, thetaAck);
    const capInward = THREE.MathUtils.clamp(thetaBase / p.maxSteer, 0, 1);

    const gamma = 1.0, response = 2.4, kDamp = 0.35;
    const offroadScale = 1 - offroad * 0.5;
    const forceBase = Math.sign(alphaF) * Math.pow(Math.abs(alphaF) / (72 * DEG), gamma) * response * offroadScale;
    const forceDamp = -this.yawRate * kDamp * (1 - Math.abs(raw));
    const selfSteer = THREE.MathUtils.clamp(forceBase + forceDamp, -0.6, 0.6);
    this.selfSteerSm += (selfSteer - this.selfSteerSm) * Math.min(1, dt * 7);

    const isCounter = Math.abs(raw) > 0.01 && Math.sign(raw) !== Math.sign(this.vy || 1);
    const wCap = smoothstep01(Math.abs(alphaR), 2 * DEG, 5 * DEG);
    const capOutward = THREE.MathUtils.clamp((Math.abs(alphaR) + 4 * DEG) / p.maxSteer, 0.5, 1);
    const effCap = THREE.MathUtils.lerp(
      capInward, Math.max(capOutward, capInward), isCounter ? wCap : 0
    );

    const wSteer = smoothstep01(Math.abs(alphaR), 5 * DEG, 12 * DEG);
    const effSelf = THREE.MathUtils.lerp(this.selfSteerSm * 0.5, this.selfSteerSm, wSteer);

    const out = THREE.MathUtils.clamp(raw * effCap + effSelf, -1, 1);
    const fade = smoothstep01(v * 3.6, 1.8, 15);
    return THREE.MathUtils.lerp(raw, out, fade);
  }

  update(dt: number, input: DriveInput, onGrass: boolean) {
    const p = this.p;
    this.onGrass = onGrass;
    const mu = onGrass ? p.muGrass : p.muRoad;
    const offroad = onGrass ? 1 : 0;
    const g = 9.81;
    const L = p.a + p.b;

    this.axLp += (this.ax - this.axLp) * Math.min(1, dt * 5);
    const staticF = (p.mass * g * p.b) / L;
    const staticR = (p.mass * g * p.a) / L;
    const dFz = (p.mass * this.axLp * p.hCg) / L;
    const downforce = 0.5 * 1.22 * p.downforceCA * this.vx * this.vx;
    const fzF = Math.max(staticF * 0.3, staticF - dFz + downforce * 0.42);
    const fzR = Math.max(staticR * 0.3, staticR + dFz + downforce * 0.58);

    this.assistedSteer = this.steerAssist(
      input.steer, mu * (g + downforce / p.mass), offroad, dt
    );
    const targetSteer = this.assistedSteer * p.maxSteer;
    const steerRate = p.steerRate;
    this.steerAngle += THREE.MathUtils.clamp(targetSteer - this.steerAngle, -steerRate * dt, steerRate * dt);
    const delta = this.steerAngle;

    const ratio = p.gears[this.gear - 1] * p.finalDrive;
    const wheelRpm = (this.vx / p.wheelRadius) * 60 / (2 * Math.PI) * ratio;

    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
    } else if (wheelRpm > p.shiftUpRpm && this.gear < p.gears.length) {
      this.gear++;
      this.shiftTimer = 0.22;
    } else if (wheelRpm < p.shiftDownRpm && this.gear > 1 && this.vx > 1) {
      this.gear--;
      this.shiftTimer = 0.15;
    }

    const launch = this.vx < 4 ? p.idleRpm + input.throttle * 2600 : 0;
    const targetRpm = Math.max(p.idleRpm, wheelRpm, launch);
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 18);

    if (this.limiterCut > 0) this.limiterCut -= dt;
    else if (this.rpm >= p.redline) this.limiterCut = 0.05;

    const cut = this.shiftTimer > 0 || this.limiterCut > 0;
    const effThrottle = cut ? 0 : input.throttle;
    this.audioThrottle = effThrottle;

    let driveForce = 0;
    if (effThrottle > 0) {
      driveForce = engineTorque(this.rpm, p) * effThrottle * ratio * 0.88 / p.wheelRadius;
    }
    let brakeForce = input.brake * 14500;
    if (this.vx < 0.3 && input.throttle === 0) brakeForce = Math.max(brakeForce, 3000);

    const vxSafe = Math.max(Math.abs(this.vx), 1.2);
    this.slipFront = Math.atan((this.vy + p.a * this.yawRate) / vxSafe) - delta;
    this.slipRear = Math.atan((this.vy - p.b * this.yawRate) / vxSafe);

    let fyFTarget = tireFy(this.slipFront, mu * 0.97, fzF);
    let fyRTarget = tireFy(this.slipRear, mu, fzR);

    const fxRMax = mu * fzR;
    if (input.handbrake) fyRTarget *= 0.3;

    const fxAvail = Math.sqrt(Math.max(0, fxRMax * fxRMax - fyRTarget * fyRTarget));
    const overspill = 0.18 * fxRMax;
    if (driveForce > fxAvail + overspill) driveForce = fxAvail + overspill;

    let fxR = driveForce - brakeForce * 0.4 * Math.sign(this.vx);
    const fxF = -brakeForce * 0.6 * Math.sign(this.vx);
    if (input.handbrake) fxR -= 9000 * Math.sign(this.vx);

    if (Math.abs(fxR) > fxRMax * 0.96) fxR = fxRMax * 0.96 * Math.sign(fxR);
    fyRTarget *= Math.sqrt(Math.max(0.15, 1 - (fxR / fxRMax) * (fxR / fxRMax)));

    const relax = Math.min(1, dt * Math.max(Math.abs(this.vx), 3) / 0.35);
    this.fyF += (fyFTarget - this.fyF) * relax;
    this.fyR += (fyRTarget - this.fyR) * relax;
    const fyF = this.fyF, fyR = this.fyR;

    const drag = 0.5 * 1.22 * p.cD * p.frontalArea * this.vx * Math.abs(this.vx);
    const roll = 14 * this.vx + (onGrass ? 90 * this.vx : 0);

    const axForce = (fxR + fxF * Math.cos(delta) - fyF * Math.sin(delta) - drag - roll) / p.mass;
    this.ax = axForce;
    const ax = axForce + this.vy * this.yawRate;
    const ay = (fyF * Math.cos(delta) + fyR) / p.mass - this.vx * this.yawRate;
    const rDot = (p.a * fyF * Math.cos(delta) - p.b * fyR) / p.inertiaZ
      - this.yawRate * (1400 / p.inertiaZ);

    this.vx += ax * dt;
    this.vy += ay * dt;
    this.yawRate += rDot * dt;

    if (Math.abs(this.vx) < 2.5) {
      const k = 1 - Math.min(1, dt * (3.5 - Math.abs(this.vx))) * 0.8;
      this.vy *= k;
      this.yawRate *= k;
    }
    if (this.vx < 0) this.vx *= 0.98;

    this.yaw += this.yawRate * dt;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.pos.x += (this.vx * c - this.vy * s) * dt;
    this.pos.y += (this.vx * s + this.vy * c) * dt;
  }
}
