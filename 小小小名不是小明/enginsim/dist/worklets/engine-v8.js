class EngineV8Processor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 900, minValue: 0, maxValue: 9500, automationRate: 'k-rate' },
      { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'headerLen', defaultValue: 0.85, minValue: 0.3, maxValue: 1.6, automationRate: 'k-rate' },
      { name: 'tailLen', defaultValue: 1.7, minValue: 0.5, maxValue: 3.5, automationRate: 'k-rate' },
      { name: 'crossMix', defaultValue: 0.12, minValue: 0, maxValue: 0.5, automationRate: 'k-rate' },
      { name: 'blower', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'gain', defaultValue: 1, minValue: 0, maxValue: 2, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    const sr = sampleRate;
    this.sr = sr;
    this.cExh = 480;

    this.cyls = [
      [0, 0], [90, 1], [180, 1], [270, 0],
      [360, 1], [450, 0], [540, 0], [630, 1]
    ];
    this.evoOffset = 128;

    this.prevD = new Float64Array(8).fill(1e9);
    this.amp = new Float64Array(8);
    this.tauMul = new Float64Array(8).fill(1);
    this.env1 = new Float64Array(8);
    this.env2 = new Float64Array(8);
    this.atk = new Int32Array(8);
    this.k1 = new Float64Array(8).fill(0.99);
    this.k2 = new Float64Array(8).fill(0.995);

    this.LEN = 2048;
    this.MASK = this.LEN - 1;
    this.bufA = [new Float32Array(this.LEN), new Float32Array(this.LEN)];
    this.bufB = [new Float32Array(this.LEN), new Float32Array(this.LEN)];
    this.pos = 0;

    this.phase = 0;
    this.rpmS = 0; this.thrS = 0; this.hlS = 0.85; this.tlS = 1.7; this.xS = 0.12; this.blS = 0;
    this.thrPrev = 0;

    this.bodyLp1 = 0; this.bodyLp2 = 0; this.bodyLp3 = 0;
    this.hissHp = 0; this.hissLp = 0;
    this.inHissHp = 0; this.inHissLp = 0;
    this.dcL = 0; this.dcR = 0;
    this.prevRadL = 0; this.prevRadR = 0;
    this.flutter = 0;
    this.ns = 0x9e3779b9 | 0;
    this.blk = 0;
    this.radAccL = 0;
    this.radAccR = 0;
    this.radCnt = 0;

    this.blwrPhase = 0;
    this.bypassEnv = 0;
    this.bypassNoise = 0;
    this.beltPhase = 0;
  }

  rand() {
    this.ns = (this.ns * 1664525 + 1013904223) | 0;
    return ((this.ns >>> 0) & 0x7fffffff) / 0x7fffffff;
  }

  rollAmp(i, thr, rpm) {
    const unev = (1 - thr) * Math.max(0, 1 - Math.max(0, rpm - 700) / 2200);
    const spread = 0.08 + 0.6 * unev;
    let a = (0.28 + 1.0 * thr) * (1 + (this.rand() - 0.5) * 2 * spread);
    a *= 1 + Math.max(0, (rpm - 1800) / 4000);
    let tm = 1;
    if (thr < 0.13 && rpm > 2600 && this.rand() < 0.13) {
      a = 2.0 + this.rand() * 1.8;
      tm = 0.55;
    }
    this.amp[i] = a;
    this.tauMul[i] = tm;
  }

  process(inputs, outputs, par) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const L = out[0];
    const R = out.length > 1 ? out[1] : out[0];
    const N = L.length;
    const sr = this.sr;

    this.rpmS += 0.5 * (par.rpm[0] - this.rpmS);
    this.thrS += 0.4 * (par.throttle[0] - this.thrS);
    this.hlS += 0.2 * (par.headerLen[0] - this.hlS);
    this.tlS += 0.2 * (par.tailLen[0] - this.tlS);
    this.xS += 0.2 * (par.crossMix[0] - this.xS);
    this.blS += 0.18 * (par.blower[0] - this.blS);
    const outGain = par.gain[0];

    const rpm = this.rpmS, thr = this.thrS, bl = this.blS;

    const unevG = (1 - thr) * Math.max(0, 1 - Math.max(0, rpm - 700) / 2200);
    this.flutter += 0.08 * ((this.rand() - 0.5) * 2 - this.flutter);
    const rpmEff = Math.max(0, rpm * (1 + this.flutter * 0.018 * unevG));

    const dPhase = rpmEff * 6 / sr;
    const nA = Math.max(2, Math.min(900, Math.round(2 * this.hlS / this.cExh * sr)));
    const nB = Math.max(2, Math.min(1800, Math.round(2 * this.tlS / this.cExh * sr)));

    const interFire = 15 / Math.max(rpm, 500);
    const tau1 = Math.min(0.010, Math.max(0.0025, interFire * 0.55));
    const tau2 = tau1 * 2.6;
    const negCoef = 0.42 / (1 + rpm / 2500);
    for (let c = 0; c < 8; c++) {
      const tm = this.tauMul[c];
      this.k1[c] = Math.exp(-1 / (tau1 * tm * sr));
      this.k2[c] = Math.exp(-1 / (tau2 * tm * sr));
    }
    const attStep = 1 / (0.0010 * sr);

    const PULLEY = 2.0;
    const LOBES = 3;
    const blowerRPS = rpmEff / 60 * PULLEY;
    const blowerFreq = blowerRPS * LOBES;
    const dBlwr = blowerFreq * 2 * Math.PI / sr;

    const rColl = -0.25;
    const rCollLoop = rColl * 0.90;
    const txCoef = 1 - Math.abs(rColl);
    const rMouth = -0.68;
    const rMouthLoop = rMouth * 0.92;
    const radCoef = 1 + rMouth;

    const cyls = this.cyls, prevD = this.prevD, amp = this.amp;
    const env1 = this.env1, env2 = this.env2, atk = this.atk;
    const k1 = this.k1, k2 = this.k2;
    const bufA = this.bufA, bufB = this.bufB, MASK = this.MASK;
    const evo = this.evoOffset;
    let phase = this.phase, pos = this.pos;
    let bodyLp1 = this.bodyLp1, bodyLp2 = this.bodyLp2, bodyLp3 = this.bodyLp3;
    let hissHp = this.hissHp, hissLp = this.hissLp;
    let inHissHp = this.inHissHp, inHissLp = this.inHissLp;
    let dcL = this.dcL, dcR = this.dcR;
    let prevRadL = this.prevRadL, prevRadR = this.prevRadR;
    let bPh = this.blwrPhase, beltPh = this.beltPhase;
    let bpEnv = this.bypassEnv, bpNoise = this.bypassNoise;
    let thrPrev = this.thrPrev;
    let accL = 0, accR = 0;

    const hissAmt = thr * (0.25 + rpm / 9000) * (0.03 + bl * 0.10);
    const blwrAmt = bl * (0.14 + thr * 0.36 + Math.max(0, (rpm - 800) / 7000) * 0.35);
    const intakeAmt = bl * thr * (0.08 + rpm / 9000 * 0.15);
    const bodyK = 1 - Math.exp(-2 * Math.PI * 95 / sr);
    const bodyK3 = 1 - Math.exp(-2 * Math.PI * 12 / sr);
    const running = rpmEff > 40;

    const thrDrop = thrPrev - thr;
    if (thrDrop > 0.25 && bpEnv < 0.01) {
      bpEnv = 1.0 + this.rand() * 0.8;
      bpNoise = this.rand() * 2 - 1;
    }
    thrPrev = thr;

    for (let i = 0; i < N; i++) {
      phase += dPhase;
      if (phase >= 720) phase -= 720;

      let excL = 0, excR = 0;
      for (let c = 0; c < 8; c++) {
        if (running) {
          let d = phase - (cyls[c][0] + evo);
          if (d < 0) d += 720;
          if (d < prevD[c]) {
            this.rollAmp(c, thr, rpm);
            env1[c] = amp[c];
            env2[c] = amp[c];
            atk[c] = 0;
          }
          prevD[c] = d;
        }
        if (env1[c] > 1e-4) {
          atk[c]++;
          let att = atk[c] * attStep;
          if (att > 1) att = 1;
          const p = (env1[c] - negCoef * env2[c]) * att;
          env1[c] *= k1[c];
          env2[c] *= k2[c];
          if (cyls[c][1] === 0) excL += p; else excR += p;
        }
      }

      const yA0 = bufA[0][(pos - nA + this.LEN) & MASK];
      const yB0 = bufB[0][(pos - nB + this.LEN) & MASK];
      const tx0 = yA0 * txCoef;
      const yA1 = bufA[1][(pos - nA + this.LEN) & MASK];
      const yB1 = bufB[1][(pos - nB + this.LEN) & MASK];
      const tx1 = yA1 * txCoef;

      bufA[0][pos] = excL + yA0 * rCollLoop;
      bufA[1][pos] = excR + yA1 * rCollLoop;
      bufB[0][pos] = tx0 + tx1 * this.xS + yB0 * rMouthLoop;
      bufB[1][pos] = tx1 + tx0 * this.xS + yB1 * rMouthLoop;

      const radL = yB0 * radCoef;
      const radR = yB1 * radCoef;
      const dRL = radL - prevRadL; prevRadL = radL;
      const dRR = radR - prevRadR; prevRadR = radR;
      accL += radL < 0 ? -radL : radL;
      accR += radR < 0 ? -radR : radR;

      this.ns = (this.ns * 1664525 + 1013904223) | 0;
      const nz = (((this.ns >>> 0) & 0x7fffffff) / 0x7fffffff - 0.5) * 2;

      const flow = excL + excR;
      const turb = nz * flow * 0.22;

      bodyLp1 += bodyK * (flow - bodyLp1);
      bodyLp2 += bodyK * (bodyLp1 - bodyLp2);
      bodyLp3 += bodyK3 * (bodyLp2 - bodyLp3);
      const body = (bodyLp2 - bodyLp3) * 2.8;

      hissHp += 0.12 * (nz - hissHp);
      const hpOut = nz - hissHp;
      hissLp += 0.35 * (hpOut - hissLp);
      const hiss = hissLp * hissAmt;

      // ---- supercharger sound ----

      // Roots blower whine: additive harmonics at blower pumping frequency
      bPh += dBlwr;
      if (bPh > 2 * Math.PI) bPh -= 2 * Math.PI;
      const h = [1, 2, 3, 4, 5.05, 6, 7.1, 8, 9.95];
      const hA = [1, 0.55, 0.32, 0.16, 0.08, 0.05, 0.035, 0.02, 0.01];
      let whine = 0;
      let a = 0;
      for (let hh = 0; hh < h.length; hh++) {
        a += h[hh] * blowerRPS * 2;
        if (a > sr * 0.44) break;
        const s = Math.sin(bPh * h[hh] + (hh * 0.4));
        whine += s * hA[hh];
      }
      whine *= blwrAmt;

      // Belt whir: faint high-freq sine + noise, slightly independent from blower
      beltPh += dBlwr * 0.78;
      if (beltPh > 2 * Math.PI) beltPh -= 2 * Math.PI;
      const belt = (Math.sin(beltPh * 5.3) * 0.4 + Math.sin(beltPh * 6.7) * 0.25) * blwrAmt * 0.12;

      // Enhanced intake roar (blower pulling air)
      inHissHp += 0.15 * (nz - inHissHp);
      const inhpHp = nz - inHissHp;
      inHissLp += 0.45 * (inhpHp - inHissLp);
      const intakeRoar = inHissLp * intakeAmt * 1.6;

      // Bypass flutter when throttle slams shut
      if (bpEnv > 0.001) {
        bpEnv *= 0.998;
        bpNoise = (bpNoise + nz * 0.3) * 0.92;
        const bypassGain = bpEnv * bl * thr * 0.45;
        whine += bpNoise * bypassGain * 0.5;
      }

      const sigL = radL * 1.0 + dRL * 3.5;
      const sigR = radR * 1.0 + dRR * 3.5;

      let l = (sigL * 1.05 + sigR * 0.45 + body + turb + hiss + whine + belt + intakeRoar) * 1.8;
      let r = (sigR * 1.05 + sigL * 0.45 + body + turb + hiss + whine + belt + intakeRoar) * 1.8;

      const fl0 = l - dcL; dcL += 0.002 * fl0;
      const fr0 = r - dcR; dcR += 0.002 * fr0;

      const fl = Math.tanh(fl0);
      const fr = Math.tanh(fr0);

      L[i] = fl * 1.15 * outGain;
      R[i] = fr * 1.15 * outGain;

      pos = (pos + 1) & MASK;
    }

    this.phase = phase; this.pos = pos;
    this.bodyLp1 = bodyLp1; this.bodyLp2 = bodyLp2; this.bodyLp3 = bodyLp3;
    this.hissHp = hissHp; this.hissLp = hissLp;
    this.inHissHp = inHissHp; this.inHissLp = inHissLp;
    this.dcL = dcL; this.dcR = dcR;
    this.prevRadL = prevRadL; this.prevRadR = prevRadR;
    this.blwrPhase = bPh; this.beltPhase = beltPh;
    this.bypassEnv = bpEnv; this.bypassNoise = bpNoise;
    this.thrPrev = thrPrev;

    this.radAccL += accL; this.radAccR += accR; this.radCnt += N;
    this.blk++;
    if ((this.blk & 1) === 0) {
      const envSnap = new Float32Array(8);
      for (let c = 0; c < 8; c++) envSnap[c] = env1[c];
      this.port.postMessage({
        phase: phase,
        rpm: this.rpmS,
        throttle: this.thrS,
        blower: this.blS,
        env: envSnap,
        radL: this.radAccL / this.radCnt,
        radR: this.radAccR / this.radCnt
      });
      this.radAccL = 0; this.radAccR = 0; this.radCnt = 0;
    }
    return true;
  }
}

registerProcessor('engine-v8', EngineV8Processor);
