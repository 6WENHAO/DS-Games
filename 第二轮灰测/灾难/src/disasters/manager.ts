import * as THREE from 'three';
import type { Sandbox } from '../sandbox';
import {
  BlastDisaster,
  LightningDisaster,
  MeteorDisaster,
  NukeDisaster,
} from './instant';
import type { DisasterCtx } from './instant';
import {
  BlackHoleDisaster,
  FloodDisaster,
  QuakeDisaster,
  StormDisaster,
  TornadoDisaster,
} from './sustained';
import { SPECS } from './types';
import type { Disaster, DisasterId, DisasterSpec } from './types';

const DEFAULT_HINT = '左键拖动旋转 · 右键拖动平移 · 滚轮缩放 · 选择下方灾难后点击城市';

/** Arms, fires and ticks all nine disasters. */
export class DisasterManager {
  readonly specs: DisasterSpec[] = SPECS;
  armed: DisasterId | null = null;
  onMessage: (text: string) => void = () => {};

  private impl = new Map<DisasterId, Disaster>();
  private steerVec = new THREE.Vector2();

  constructor(private readonly sandbox: Sandbox) {
    const ctx: DisasterCtx = {
      sandbox,
      message: (t) => this.onMessage(t),
    };
    const list: Disaster[] = [
      new BlastDisaster(ctx),
      new MeteorDisaster(ctx),
      new LightningDisaster(ctx),
      new TornadoDisaster(ctx),
      new BlackHoleDisaster(ctx),
      new NukeDisaster(ctx),
      new QuakeDisaster(ctx),
      new FloodDisaster(ctx),
      new StormDisaster(ctx),
    ];
    for (const d of list) this.impl.set(d.id, d);
  }

  spec(id: DisasterId): DisasterSpec {
    const s = this.specs.find((x) => x.id === id);
    if (!s) throw new Error(`unknown disaster ${id}`);
    return s;
  }

  isRunning(id: DisasterId): boolean {
    return this.impl.get(id)?.running ?? false;
  }

  get anySustainedRunning(): boolean {
    for (const d of this.impl.values()) if (d.sustained && d.running) return true;
    return false;
  }

  /** Toolbar press: arm, disarm, or early-stop a running sustained disaster. */
  select(id: DisasterId): void {
    const d = this.impl.get(id);
    if (!d) return;
    if (d.sustained && d.running) {
      d.stop();
      this.armed = null;
      return;
    }
    this.armed = this.armed === id ? null : id;
  }

  cancel(): void {
    this.armed = null;
  }

  /** Left click on the map. */
  release(point: THREE.Vector3): boolean {
    if (!this.armed) return false;
    const d = this.impl.get(this.armed);
    if (!d) return false;
    d.trigger(point.x, point.z, this.sandbox.power);
    if (d.sustained) this.armed = null;
    return true;
  }

  reticleRadius(): number {
    if (!this.armed) return 0;
    return this.spec(this.armed).radius(this.sandbox.power);
  }

  reticleColor(): number {
    return this.armed ? this.spec(this.armed).hex : 0xffffff;
  }

  hint(): string {
    for (const d of this.impl.values()) {
      if (d.sustained && d.running) {
        const h = d.runningHint();
        if (h) return h;
      }
    }
    const nuke = this.impl.get('nuke');
    if (nuke && nuke.running) return nuke.runningHint();
    if (this.armed) return this.spec(this.armed).hint;
    return DEFAULT_HINT;
  }

  update(dt: number, simDt: number, steer: THREE.Vector2): void {
    this.steerVec.copy(steer);
    for (const d of this.impl.values()) {
      if (d.sustained && d.running) d.steer(this.steerVec, dt);
      d.update(dt, simDt);
    }
  }

  reset(): void {
    for (const d of this.impl.values()) d.reset();
    this.armed = null;
  }
}
