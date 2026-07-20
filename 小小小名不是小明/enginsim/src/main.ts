import { EngineAudio } from './core/EngineAudio';
import { V8Viz } from './viz';

const engine = new EngineAudio();
let running = false;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const vizCanvas = $<HTMLCanvasElement>('viz');
const viz = new V8Viz(vizCanvas);
engine.onTelemetry = (t) => viz.update(t);

const IDLE_RPM = 850;
const REDLINE = 6600;
const STALL = 250;

let rpm = 0;
let throttleInput = 0;
let keyThrottle = 0;
let limiterCut = 0;

const rpmText = $('rpmText');
const rpmBar = $('rpmBar');
const startBtn = $<HTMLButtonElement>('startBtn');
const throttleSlider = $<HTMLInputElement>('throttle');
const headerLen = $<HTMLInputElement>('headerLen');
const tailLen = $<HTMLInputElement>('tailLen');
const crossMix = $<HTMLInputElement>('crossMix');
const blower = $<HTMLInputElement>('blower');
const volume = $<HTMLInputElement>('volume');

function torqueCurve(r: number): number {
  const x = r / 7000;
  return Math.max(0.15, Math.sin(Math.PI * Math.min(1, x * 1.35)) * (1 - 0.25 * x));
}

let lastT = performance.now();
function tick(now: number) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  const userThrottle = Math.max(throttleInput, keyThrottle);

  if (running) {
    let effThrottle = userThrottle;

    if (rpm < IDLE_RPM && effThrottle < 0.2) {
      effThrottle = Math.max(effThrottle, Math.min(0.25, (IDLE_RPM - rpm) / 400));
    }

    if (limiterCut > 0) {
      limiterCut -= dt;
      effThrottle = 0;
    } else if (rpm >= REDLINE) {
      limiterCut = 0.06;
    }

    const accel = effThrottle * torqueCurve(rpm) * 5200;
    const engineBrake = 180 + rpm * 0.16 + (rpm * rpm) * 1.6e-5;
    rpm += (accel - engineBrake) * dt;
    if (rpm < STALL) rpm = STALL;
    if (rpm > REDLINE + 150) rpm = REDLINE + 150;

    engine.setRpm(rpm);
    engine.setThrottle(effThrottle);
  } else {
    rpm = Math.max(0, rpm - 1400 * dt);
    if (engine.isReady) {
      engine.setRpm(rpm);
      engine.setThrottle(0);
    }
  }

  rpmText.textContent = String(Math.round(rpm));
  rpmBar.style.width = `${Math.min(100, (rpm / 7300) * 100)}%`;
  viz.draw();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

startBtn.addEventListener('click', async () => {
  if (!engine.isReady) {
    startBtn.textContent = 'Loading...';
    await engine.init();
    applySliders();
  }
  await engine.resume();
  running = !running;
  if (running && rpm < IDLE_RPM) rpm = Math.max(rpm, 600);
  startBtn.textContent = running ? 'Stop Engine' : 'Start Engine';
  startBtn.classList.toggle('on', running);
});

function applySliders() {
  if (!engine.isReady) return;
  engine.setHeaderLength(parseFloat(headerLen.value));
  engine.setTailLength(parseFloat(tailLen.value));
  engine.setCrossMix(parseInt(crossMix.value, 10) / 100);
  engine.setBlower(parseInt(blower.value, 10) / 100);
  engine.setVolume((parseInt(volume.value, 10) / 100) * 0.9);
}

throttleSlider.addEventListener('input', () => {
  throttleInput = parseInt(throttleSlider.value, 10) / 100;
});
headerLen.addEventListener('input', () => {
  $('headerVal').textContent = parseFloat(headerLen.value).toFixed(2);
  applySliders();
});
tailLen.addEventListener('input', () => {
  $('tailVal').textContent = parseFloat(tailLen.value).toFixed(2);
  applySliders();
});
crossMix.addEventListener('input', () => {
  $('crossVal').textContent = (parseInt(crossMix.value, 10) / 100).toFixed(2);
  applySliders();
});
blower.addEventListener('input', () => {
  $('blowerVal').textContent = `${blower.value}%`;
  applySliders();
});
volume.addEventListener('input', () => {
  $('volVal').textContent = `${volume.value}%`;
  applySliders();
});

document.querySelectorAll<HTMLButtonElement>('.btn.scene').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn.scene').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (engine.isReady) engine.setScene(btn.dataset.scene!);
  });
});

window.addEventListener('keydown', e => {
  if (e.code === 'KeyW' && !e.repeat) keyThrottle = 1;
});
window.addEventListener('keyup', e => {
  if (e.code === 'KeyW') keyThrottle = 0;
});
