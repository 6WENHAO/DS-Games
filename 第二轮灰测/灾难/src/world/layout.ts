/** Shared city layout constants (all original, procedurally derived). */
export const VOX = 1;
export const BLOCKS = 6;
export const BLOCK = 14;
export const ROAD = 6;
export const CITY_SPAN = BLOCKS * BLOCK + (BLOCKS + 1) * ROAD; // 126
export const CITY_HALF = CITY_SPAN / 2; // 63
export const GROUND_SIZE = 1400;

/** World-space min corner of block (i,j). */
export function blockMin(i: number): number {
  return -CITY_HALF + ROAD + i * (BLOCK + ROAD);
}

export function blockCenter(i: number): number {
  return blockMin(i) + BLOCK / 2;
}

/** True when a world coordinate falls on a road strip (not a block). */
export function onRoad(v: number): boolean {
  const t = v + CITY_HALF;
  if (t < 0 || t > CITY_SPAN) return true;
  const m = t % (BLOCK + ROAD);
  return m < ROAD;
}

/** Centre line of the road ring nearest to `v`, used by cars / pedestrians. */
export function roadLines(): number[] {
  const out: number[] = [];
  for (let i = 0; i <= BLOCKS; i++) out.push(-CITY_HALF + i * (BLOCK + ROAD) + ROAD / 2);
  return out;
}

export const PALETTE = {
  coral: 0xff8f6b,
  sun: 0xffd45e,
  sky: 0x6fc9ff,
  pink: 0xff9ec4,
  mint: 0x8fe3b8,
  violet: 0xb99cff,
  cream: 0xfff0d2,
  teal: 0x59d3d0,
  peach: 0xffc39a,
  lilac: 0xd7c1ff,
} as const;

export const BUILDING_COLORS: number[] = [
  0xff8f6b, 0xffd45e, 0x7cc9ff, 0xff9ec4, 0x8fe3b8, 0xb99cff, 0xfff0d2, 0x59d3d0, 0xffc39a,
  0xd7c1ff, 0xf9a3a3, 0x9ad6ff, 0xffe08a, 0xa8e6a1,
];
