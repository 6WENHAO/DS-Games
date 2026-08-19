/** 确定性 PRNG（mulberry32）。相同种子 + 相同调用序列 => 相同结果。 */
export class Rng {
  private s: number;
  readonly seed: number;
  calls = 0;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  next(): number {
    this.calls++;
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(minInclusive: number, maxExclusive: number): number {
    return Math.floor(this.range(minInclusive, maxExclusive));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))];
  }

  /** 按权重挑选；权重必须为非负数 */
  weighted<T>(entries: readonly { item: T; weight: number }[]): T {
    const total = entries.reduce((a, b) => a + Math.max(0, b.weight), 0);
    if (total <= 0) return entries[0].item;
    let roll = this.next() * total;
    for (const e of entries) {
      roll -= Math.max(0, e.weight);
      if (roll <= 0) return e.item;
    }
    return entries[entries.length - 1].item;
  }

  clone(): Rng {
    const r = new Rng(this.seed);
    r.s = this.s;
    r.calls = this.calls;
    return r;
  }

  snapshot(): { s: number; calls: number } {
    return { s: this.s, calls: this.calls };
  }

  restore(snap: { s: number; calls: number }): void {
    this.s = snap.s;
    this.calls = snap.calls;
  }
}

export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
