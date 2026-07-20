import { makeEarlyIR } from '../reverb/early-ir';
import { SCENES, type ScenePreset } from '../reverb/presets';

export interface EngineAudioOptions {
  workletBase?: string;
  context?: AudioContext;
  destination?: AudioNode;
  engineName?: 'engine-v8' | 'engine-flat6';
}

export interface EngineTelemetry {
  phase: number;
  rpm: number;
  throttle: number;
  blower: number;
  env: Float32Array;
  radL: number;
  radR: number;
}

export class EngineAudio {
  ctx!: AudioContext;
  private engine!: AudioWorkletNode;
  private fdn!: AudioWorkletNode;
  private dryGain!: GainNode;
  private earlyGain!: GainNode;
  private tailGain!: GainNode;
  private convolver!: ConvolverNode;
  private preDelay!: DelayNode;
  private cabinFilter!: BiquadFilterNode;
  private master!: GainNode;
  private limiter!: DynamicsCompressorNode;
  private ready = false;
  onTelemetry?: (t: EngineTelemetry) => void;

  async init(opts: EngineAudioOptions = {}): Promise<void> {
    this.ctx = opts.context ?? new AudioContext({ latencyHint: 'interactive' });
    const base = opts.workletBase ?? '/worklets/';
    const v = '?v=' + Date.now();
    await this.ctx.audioWorklet.addModule(base + 'engine-v8.js' + v);
    await this.ctx.audioWorklet.addModule(base + 'engine-flat6.js' + v);
    await this.ctx.audioWorklet.addModule(base + 'fdn-reverb.js' + v);

    this.engine = new AudioWorkletNode(this.ctx, opts.engineName ?? 'engine-v8', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2]
    });
    this.engine.port.onmessage = (ev: MessageEvent<EngineTelemetry>) => {
      this.onTelemetry?.(ev.data);
    };
    this.fdn = new AudioWorkletNode(this.ctx, 'fdn-reverb', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2]
    });

    this.dryGain = this.ctx.createGain();
    this.earlyGain = this.ctx.createGain();
    this.tailGain = this.ctx.createGain();
    this.convolver = this.ctx.createConvolver();
    this.convolver.normalize = false;
    this.preDelay = this.ctx.createDelay(0.2);
    this.cabinFilter = this.ctx.createBiquadFilter();
    this.cabinFilter.type = 'lowpass';
    this.cabinFilter.frequency.value = 20000;
    this.cabinFilter.Q.value = 0.6;
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.12;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;

    this.engine.connect(this.dryGain);
    this.engine.connect(this.convolver);
    this.convolver.connect(this.earlyGain);
    this.engine.connect(this.preDelay);
    this.preDelay.connect(this.fdn);
    this.fdn.connect(this.tailGain);

    this.dryGain.connect(this.cabinFilter);
    this.earlyGain.connect(this.cabinFilter);
    this.tailGain.connect(this.cabinFilter);
    this.cabinFilter.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.connect(opts.destination ?? this.ctx.destination);

    this.setScene('exterior', 0);
    this.ready = true;
  }

  get isReady(): boolean { return this.ready; }
  get output(): AudioNode { return this.master; }

  private param(name: string): AudioParam {
    return this.engine.parameters.get(name)!;
  }

  setRpm(v: number): void { this.param('rpm').value = v; }
  setThrottle(v: number): void { this.param('throttle').value = Math.min(1, Math.max(0, v)); }
  setHeaderLength(m: number): void { this.param('headerLen').value = m; }
  setTailLength(m: number): void { this.param('tailLen').value = m; }
  setCrossMix(v: number): void { this.param('crossMix').value = v; }
  setBlower(v: number): void { this.param('blower').value = Math.min(1, Math.max(0, v)); }
  setVolume(v: number): void {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
  }

  setScene(name: string, fade = 0.25): void {
    const p: ScenePreset = SCENES[name] ?? SCENES.exterior;
    const t = this.ctx.currentTime;
    this.convolver.buffer = makeEarlyIR(this.ctx, p.ir);
    this.earlyGain.gain.setTargetAtTime(p.early, t, fade);
    this.tailGain.gain.setTargetAtTime(p.tail, t, fade);
    this.dryGain.gain.setTargetAtTime(1.0, t, fade);
    this.preDelay.delayTime.setTargetAtTime(p.preDelay, t, fade);
    this.cabinFilter.frequency.setTargetAtTime(p.cabinLp, t, fade);
    this.fdn.parameters.get('t60')!.value = p.t60;
    this.fdn.parameters.get('damp')!.value = p.damp;
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  async suspend(): Promise<void> {
    if (this.ctx.state === 'running') await this.ctx.suspend();
  }

  dispose(): void {
    this.engine.disconnect();
    this.fdn.disconnect();
    this.master.disconnect();
    void this.ctx.close();
    this.ready = false;
  }
}
