/*
 * Flat-6 boxer engine synthesizer (AudioWorklet)
 * Ported from the lightweight pulse-slot architecture (noise-pulse synthesis):
 * - firing order 1-6-2-4-3-5, even 120 deg spacing, banks alternate L/R
 * - per-bank even 240 deg pulse train -> smooth high "howl" (911-like)
 * - each pulse = lowpassed noise burst + low thump, fast attack / slow decay
 * - continuous layers: sub harmonics, intake hiss, mechanical noise
 * - exposes the same parameter set as engine-v8 for drop-in use
 */
class Flat6Processor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 0, minValue: 0, maxValue: 9500, automationRate: 'k-rate' },
      { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'headerLen', defaultValue: 0.85, minValue: 0.3, maxValue: 1.6, automationRate: 'k-rate' },
      { name: 'tailLen', defaultValue: 1.7, minValue: 0.5, maxValue: 3.5, automationRate: 'k-rate' },
      { name: 'crossMix', defaultValue: 0.12, minValue: 0, maxValue: 0.5, automationRate: 'k-rate' },
      { name: 'gain', defaultValue: 1, minValue: 0, maxValue: 2, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    const sr = this.sr = sampleRate;

    // flat-6: 1-6-2-4-3-5, cyl 0-2 = left bank, 3-5 = right bank
    this.events = [
      { a: 0, c: 0 }, { a: 120, c: 5 }, { a: 240, c: 1 },
      { a: 360, c: 3 }, { a: 480, c: 2 }, { a: 600, c: 4 }
    ];
    this.phase = 0;

    let seed = 0x9e3779b9;
    const srnd = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0;
      return seed / 4294967296;
    };
    this.cylGain = []; this.cylTone = []; this.cylDecay = [];
    for (let i = 0; i < 6; i++) {
      this.cylGain.push(0.92 + 0.16 * srnd());
      this.cylTone.push(0.95 + 0.10 * srnd());
      this.cylDecay.push(0.90 + 0.20 * srnd());
    }
    this.rng = 0x1234567;

    const N = this.N = 24;
    this.pOn = new Uint8Array(N);
    this.pEnv = new Float32Array(N);
    this.pDecay = new Float32Array(N);
    this.pPeak = new Float32Array(N);
    this.pA1 = new Float32Array(N);
    this.pLp1 = new Float32Array(N);
    this.pLp2 = new Float32Array(N);
    this.pThump = new Float32Array(N);
    this.pThumpG = new Float32Array(N);
    this.pDelay = new Int32Array(N);
    this.pAtt = new Int32Array(N);
    this.pPanL = new Float32Array(N);
    this.pPanR = new Float32Array(N);

    this.thumpA = 1 - Math.exp(-2 * Math.PI * 150 / sr);

    this.intLp = 0; this.mechLp = 0;
    this.subPhase = 0;
    this.dcXL = 0; this.dcYL = 0; this.dcXR = 0; this.dcYR = 0;
    this.rpmS = 0; this.thrS = 0;
  }

  xs() {
    let x = this.rng;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    this.rng = x;
    return (x / 2147483648) - 1;
  }
  r01() { return (this.xs() + 1) * 0.5; }

  allocPulse() {
    let best = -1, bestEnv = 2;
    for (let i = 0; i < this.N; i++) {
      if (!this.pOn[i]) return i;
      if (this.pEnv[i] < bestEnv) { bestEnv = this.pEnv[i]; best = i; }
    }
    return best;
  }

  setPulse(i, delay, tcMs, cutoff, peak, pan, thumpG) {
    this.pOn[i] = 1;
    this.pDelay[i] = delay;
    this.pEnv[i] = 0;
    this.pDecay[i] = Math.exp(-1000 / (tcMs * this.sr));
    this.pA1[i] = 1 - Math.exp(-2 * Math.PI * Math.min(9000, Math.max(320, cutoff)) / this.sr);
    this.pPeak[i] = peak;
    this.pPanL[i] = Math.cos((pan + 1) * Math.PI / 4) * 1.15;
    this.pPanR[i] = Math.sin((pan + 1) * Math.PI / 4) * 1.15;
    this.pThumpG[i] = thumpG;
    this.pAtt[i] = Math.floor(this.sr * 0.0005);
    this.pLp1[i] = 0; this.pLp2[i] = 0; this.pThump[i] = 0;
  }

  fire(cyl, rpm, load, crackleProb, runGate) {
    const bank = cyl < 3 ? 0 : 1;
    // higher-revving character: shorter pulses, brighter cutoff than the V8
    const tcMs = Math.min(34, Math.max(3.2, 24000 / Math.max(rpm, 240)))
      * this.cylDecay[cyl] * (0.88 + 0.24 * this.r01());
    const fc = (750 + 5600 * load + rpm * 0.34) * this.cylTone[cyl] * (0.92 + 0.16 * this.r01());
    const baseGain = (0.38 + 0.62 * load) * runGate;
    const peak = this.cylGain[cyl] * (0.88 + 0.24 * this.r01()) * baseGain;
    const pan = (bank === 0 ? -1 : 1) * (0.18 + 0.08 * this.r01());
    const thumpG = (0.8 - 0.35 * load);

    const slot = this.allocPulse();
    if (slot >= 0) this.setPulse(slot, 0, tcMs, fc, peak, pan, thumpG);

    if (crackleProb > 0 && this.r01() < crackleProb * 0.55) {
      const cSlot = this.allocPulse();
      if (cSlot >= 0) {
        const d = Math.floor(this.sr * (0.005 + 0.045 * this.r01()));
        const cTc = 3.5 + 7 * this.r01();
        const cFc = 2800 + 3400 * this.r01();
        const cPeak = (0.09 + 0.22 * this.r01()) * runGate;
        const cPan = (this.r01() * 2 - 1) * 0.6;
        this.setPulse(cSlot, d, cTc, cFc, cPeak, cPan, 0);
      }
    }
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    const R = out.length > 1 ? out[1] : out[0];
    const n = L.length;

    this.rpmS += 0.5 * (parameters.rpm[0] - this.rpmS);
    this.thrS += 0.4 * (parameters.throttle[0] - this.thrS);
    const rpm = this.rpmS;
    const thr = this.thrS;
    const eg = parameters.gain[0];

    const load = thr;
    const crackle = (thr < 0.15 && rpm > 3200) ? Math.min(1, (rpm - 3200) / 3000) : 0;
    const runGate = Math.min(1, rpm / 260);
    const dps = rpm * 6 / this.sr;
    const rpmN = Math.min(1, rpm / 8200);

    const fireHz = rpm / 60 * 3;
    const subInc = 2 * Math.PI * Math.max(0.1, fireHz) / this.sr;
    const subGain = (0.15 - 0.07 * rpmN) * (0.3 + 0.7 * load) * runGate;

    const intA = 1 - Math.exp(-2 * Math.PI * (260 + 2600 * thr + rpm * 0.16) / this.sr);
    const intGain = (0.014 + 0.13 * thr) * runGate;
    const mechA = 1 - Math.exp(-2 * Math.PI * 3400 / this.sr);
    const mechGain = (0.012 + 0.05 * rpmN) * runGate;

    for (let i = 0; i < n; i++) {
      const prev = this.phase;
      let ph = prev + dps;
      if (ph >= 720) ph -= 720;
      this.phase = ph;
      if (rpm > 25) {
        const evs = this.events;
        for (let e = 0; e < 6; e++) {
          const a = evs[e].a;
          const hit = ph >= prev ? (a > prev && a <= ph) : (a > prev || a <= ph);
          if (hit) this.fire(evs[e].c, rpm, load, crackle, runGate);
        }
      }

      let sL = 0, sR = 0;
      for (let p = 0; p < this.N; p++) {
        if (!this.pOn[p]) continue;
        if (this.pDelay[p] > 0) { this.pDelay[p]--; continue; }
        let env = this.pEnv[p];
        if (this.pAtt[p] > 0) { env += 1 / (this.sr * 0.0005); this.pAtt[p]--; }
        else env *= this.pDecay[p];
        this.pEnv[p] = env;
        if (env < 0.0006 && this.pAtt[p] <= 0) { this.pOn[p] = 0; continue; }
        const nz = this.xs();
        const a1 = this.pA1[p];
        const lp1 = this.pLp1[p] + a1 * (nz - this.pLp1[p]); this.pLp1[p] = lp1;
        const lp2 = this.pLp2[p] + a1 * (lp1 - this.pLp2[p]); this.pLp2[p] = lp2;
        const th = this.pThump[p] + this.thumpA * (nz - this.pThump[p]); this.pThump[p] = th;
        const sig = (lp2 * 0.9 + th * this.pThumpG[p] * env) * env * this.pPeak[p];
        sL += sig * this.pPanL[p];
        sR += sig * this.pPanR[p];
      }

      this.subPhase += subInc;
      if (this.subPhase > 6.2831853) this.subPhase -= 6.2831853;
      const sub = (Math.sin(this.subPhase) + 0.4 * Math.sin(this.subPhase * 0.5)) * subGain;

      this.intLp += intA * (this.xs() - this.intLp);
      const intake = this.intLp * intGain;

      const mnz = this.xs();
      this.mechLp += mechA * (mnz - this.mechLp);
      const mech = (mnz - this.mechLp) * mechGain;

      const shared = (sub + intake + mech) * 0.9;
      let mL = sL + shared;
      let mR = sR + shared;

      mL = Math.tanh(mL * 1.3) * eg;
      mR = Math.tanh(mR * 1.3) * eg;

      const yL = mL - this.dcXL + 0.996 * this.dcYL;
      this.dcXL = mL; this.dcYL = yL;
      const yR = mR - this.dcXR + 0.996 * this.dcYR;
      this.dcXR = mR; this.dcYR = yR;

      L[i] = yL;
      R[i] = yR;
    }
    return true;
  }
}

registerProcessor('engine-flat6', Flat6Processor);
