import { VehicleSim, MUSCLE_CAR } from './src/game/physics.ts';

const dt = 1 / 240;

const sim = new VehicleSim(MUSCLE_CAR);
sim.reset(0, 0, 0);
for (let i = 0; i < 240 * 8; i++) {
  sim.update(dt, { throttle: 1, brake: 0, steer: 0, handbrake: false }, false);
}
console.log(`8s WOT straight: v=${sim.speedKmh.toFixed(1)}km/h gear=${sim.gear}`);

const coast = new VehicleSim(MUSCLE_CAR);
coast.reset(0, 0, 0);
coast.vx = 30;
let maxYawCoast = 0;
for (let i = 0; i < 240 * 3; i++) {
  coast.update(dt, { throttle: 0, brake: 0, steer: 0.7, handbrake: false }, false);
  maxYawCoast = Math.max(maxYawCoast, Math.abs(coast.yawRate));
  if (!isFinite(coast.yaw)) throw new Error('coast NaN');
}
const gripYaw = MUSCLE_CAR.muRoad * 9.81 / Math.max(coast.vx, 5);
console.log(`coast corner: v=${coast.speedKmh.toFixed(1)}km/h maxYawRate=${maxYawCoast.toFixed(3)} (grip limit ~${gripYaw.toFixed(3)}) slipF=${(coast.slipFront * 57.3).toFixed(1)}deg`);
if (maxYawCoast < gripYaw * 0.55) throw new Error('FAIL: coasting understeer');

const power = new VehicleSim(MUSCLE_CAR);
power.reset(0, 0, 0);
power.vx = 22;
let maxRearSlip = 0, maxYawPow = 0;
for (let i = 0; i < 240 * 4; i++) {
  power.update(dt, { throttle: 1, brake: 0, steer: 0.5, handbrake: false }, false);
  maxRearSlip = Math.max(maxRearSlip, Math.abs(power.slipRear));
  maxYawPow = Math.max(maxYawPow, Math.abs(power.yawRate));
  if (!isFinite(power.yaw)) throw new Error('power NaN');
}
console.log(`WOT corner: v=${power.speedKmh.toFixed(1)}km/h maxRearSlip=${(maxRearSlip * 57.3).toFixed(1)}deg maxYawRate=${maxYawPow.toFixed(2)}`);
if (maxRearSlip > 20 / 57.3) throw new Error('FAIL: power oversteer spin');

const drift = new VehicleSim(MUSCLE_CAR);
drift.reset(0, 0, 0);
drift.vx = 25;
drift.yawRate = 0.9;
drift.vy = -2.5;
let spun = false;
for (let i = 0; i < 240 * 4; i++) {
  drift.update(dt, { throttle: 0.4, brake: 0, steer: 0, handbrake: false }, false);
  if (Math.abs(drift.yawRate) > 2.5) spun = true;
  if (!isFinite(drift.yaw)) throw new Error('drift NaN');
}
console.log(`drift recovery: residual yawRate=${drift.yawRate.toFixed(3)} vy=${drift.vy.toFixed(2)} assistedSteer=${drift.assistedSteer.toFixed(3)} spun=${spun}`);
if (spun || Math.abs(drift.yawRate) > 0.1) throw new Error('FAIL: no self-recovery');

console.log('ALL PASS');
