/*
 * 8-line FDN reverb tail (Householder feedback), wet-only output.
 */
class FDNReverbProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 't60', defaultValue: 1.2, minValue: 0.1, maxValue: 8, automationRate: 'k-rate' },
      { name: 'damp', defaultValue: 0.5, minValue: 0, maxValue: 0.95, automationRate: 'k-rate' }
    ];
  }

  constructor() {
    super();
    const sr = sampleRate;
    const base = [1123, 1559, 1907, 2251, 2683, 3109, 3557, 4001];
    this.N = 8;
    this.lens = base.map(n => Math.max(64, Math.round(n * sr / 48000)));
    this.bufs = this.lens.map(n => new Float32Array(n));
    this.posArr = new Int32Array(this.N);
    this.lpArr = new Float64Array(this.N);
    this.inSign = [1, -1, 1, -1, 1, -1, 1, -1];
    this.gains = new Float64Array(this.N).fill(0.5);
    this.t60S = 1.2;
    this.dampS = 0.5;
    this.y = new Float64Array(this.N);
  }

  process(inputs, outputs, par) {
    const inp = inputs[0];
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const OL = out[0];
    const OR = out.length > 1 ? out[1] : out[0];
    const Nsamp = OL.length;
    const IL = inp && inp[0] ? inp[0] : null;
    const IR = inp && inp.length > 1 && inp[1] ? inp[1] : IL;

    this.t60S += 0.15 * (par.t60[0] - this.t60S);
    this.dampS += 0.15 * (par.damp[0] - this.dampS);
    const sr = sampleRate;
    for (let k = 0; k < this.N; k++) {
      this.gains[k] = Math.pow(10, -3 * (this.lens[k] / sr) / this.t60S);
    }
    const damp = this.dampS;
    const bufs = this.bufs, lens = this.lens, posArr = this.posArr;
    const lpArr = this.lpArr, gains = this.gains, inSign = this.inSign, y = this.y;
    const NL = this.N;
    const twoOverN = 2 / NL;

    for (let i = 0; i < Nsamp; i++) {
      const xin = ((IL ? IL[i] : 0) + (IR ? IR[i] : 0)) * 0.5;

      let sum = 0;
      for (let k = 0; k < NL; k++) {
        const v = bufs[k][posArr[k]];
        lpArr[k] += (1 - damp) * (v - lpArr[k]);
        y[k] = lpArr[k] * gains[k];
        sum += y[k];
      }
      const h = sum * twoOverN;

      let ol = 0, or_ = 0;
      for (let k = 0; k < NL; k++) {
        const fb = y[k] - h;
        bufs[k][posArr[k]] = xin * inSign[k] * 0.4 + fb;
        posArr[k]++;
        if (posArr[k] >= lens[k]) posArr[k] = 0;
        if (k & 1) or_ += y[k]; else ol += y[k];
      }

      OL[i] = ol * 0.6;
      OR[i] = or_ * 0.6;
    }
    return true;
  }
}

registerProcessor('fdn-reverb', FDNReverbProcessor);
