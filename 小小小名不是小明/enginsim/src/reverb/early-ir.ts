export interface EarlyIROptions {
  duration: number;
  taps: number;
  size: number;
  color: number;
}

export function makeEarlyIR(ctx: BaseAudioContext, opts: EarlyIROptions): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(64, Math.round(opts.duration * sr));
  const buf = ctx.createBuffer(2, len, sr);
  let seed = 0x2545f4;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) & 0x7fffffff) / 0x7fffffff;
  };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let t = 0; t < opts.taps; t++) {
      const frac = (t + 1) / (opts.taps + 1);
      const jitter = (rand() - 0.5) * 0.35 * opts.size;
      const time = (0.004 + frac * (opts.duration - 0.006)) * (1 + jitter);
      const idx = Math.min(len - 1, Math.max(0, Math.round(time * sr)));
      const sign = rand() < 0.5 ? -1 : 1;
      const a = Math.exp(-3.2 * frac) * (0.5 + rand() * 0.5);
      d[idx] += sign * a;
    }
    let lp = 0;
    const k = 1 - Math.exp(-2 * Math.PI * opts.color / sr);
    for (let i = 0; i < len; i++) {
      lp += k * (d[i] - lp);
      d[i] = lp;
    }
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (peak > 0) for (let i = 0; i < len; i++) d[i] /= peak;
  }
  return buf;
}
