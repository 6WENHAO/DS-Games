/**
 * SALTWAKE — Thresher's Reach, the night the tide came inland.
 *
 * The level data for the shipped chapter. Six districts composite into one
 * grid: an abandoned wharf, the outfall tunnels beneath it, a subsiding
 * street, the failed summoning chamber under the church, the pre-human
 * structure below that, and the fissure where the town gives out.
 *
 * Authored against tools/solve-level.mjs, which proves the level can be
 * finished: every key sits ahead of the door it opens, every weapon, enemy,
 * pickup and mechanism is reachable, the ammo economy leaves a margin, and
 * the playtime lands inside the window.
 */

/* ------------------------------------------------------------------ *
 * grid glyph helpers — plan rows are built as strings so every row is
 * exactly the zone width with no hand-counted padding.
 * ------------------------------------------------------------------ */
const H = (n) => '#'.repeat(n); // solid wall
const F = (n) => '.'.repeat(n); // floor
const W = (n) => '~'.repeat(n); // water
const A = (n) => '^'.repeat(n); // hazard
const DOOR = '+';
const SECRET = 'S';

const CELL = 3.0;
const cx = (c) => (c + 0.5) * CELL;
const cz = (r) => (r + 0.5) * CELL;

/* ------------------------------------------------------------------ *
 * zone plans
 * ------------------------------------------------------------------ */

const docksPlan = [
  H(26),                                                     // r0
  H(1) + F(1) + H(5) + F(3) + H(5) + F(10) + H(1),           // r1  building north walls
  H(1) + F(1) + H(1) + F(3) + H(1) + F(3) + H(1) + F(3) + H(1) + F(10) + H(1), // r2 interiors
  H(1) + F(1) + H(1) + F(3) + H(1) + F(3) + H(1) + F(3) + H(1) + F(10) + H(1), // r3 interiors
  H(1) + F(1) + H(2) + F(1) + H(2) + F(3) + H(2) + SECRET + H(2) + F(10) + H(1), // r4 door + secret
  H(1) + F(24) + H(1),                                       // r5  quay
  H(1) + F(24) + DOOR,                                       // r6  quay, brass gate east
  H(1) + F(4) + W(2) + F(4) + W(2) + F(4) + W(8) + H(1),     // r7  piers
  H(1) + F(4) + W(2) + F(4) + W(2) + F(4) + W(8) + H(1),     // r8
  H(1) + F(4) + W(2) + F(4) + W(2) + F(4) + W(8) + H(1),     // r9
  H(1) + F(4) + W(2) + F(4) + W(2) + F(4) + W(8) + H(1),     // r10
  H(1) + F(4) + W(2) + F(4) + W(2) + F(4) + W(8) + H(1),     // r11
  H(1) + F(4) + W(2) + F(4) + W(2) + F(4) + W(8) + H(1),     // r12
  H(1) + F(4) + W(2) + F(4) + W(2) + F(4) + W(8) + H(1),     // r13
  H(1) + F(4) + W(2) + F(4) + W(2) + F(4) + W(8) + H(1),     // r14
  H(26),                                                     // r15
];

const sewerPlan = [
  H(26),                                                          // r0
  H(1) + F(24) + H(1),                                            // r1
  H(1) + F(4) + H(5) + F(6) + H(5) + F(4) + H(1),                 // r2
  H(1) + F(4) + H(1) + F(3) + H(1) + F(6) + H(1) + F(3) + H(1) + F(4) + H(1), // r3
  H(1) + F(4) + F(1) + F(3) + H(1) + F(6) + F(1) + F(3) + H(1) + F(4) + H(1), // r4 chamber doorways
  H(1) + F(4) + H(5) + F(6) + H(5) + F(4) + H(1),                 // r5
  F(1) + F(24) + H(1),                                            // r6 west entry, main drain
  H(1) + F(4) + H(5) + F(6) + H(5) + F(4) + H(1),                 // r7
  H(1) + F(4) + F(1) + F(3) + H(1) + F(6) + F(1) + F(3) + H(1) + F(4) + H(1), // r8 chamber doorways
  H(1) + F(4) + H(1) + F(3) + H(1) + F(6) + H(1) + F(3) + H(1) + F(4) + H(1), // r9
  H(1) + F(4) + H(5) + F(6) + H(5) + F(4) + H(1),                 // r10
  H(1) + F(11) + DOOR + F(12) + H(1),                             // r11 flood gate
  H(1) + W(24) + H(1),                                            // r12 submerged
  H(1) + W(24) + H(1),                                            // r13
  H(1) + W(24) + H(1),                                            // r14
  H(12) + F(1) + H(13),                                           // r15 south exit
];

const victorianPlan = [
  H(12) + F(1) + H(13),                                           // r0  north opening
  H(1) + F(24) + H(1),                                            // r1  porch
  H(1) + H(1) + H(9) + H(1) + F(3) + H(1) + H(9) + H(1),          // r2  W1/E1 north walls
  H(1) + H(1) + F(9) + H(1) + F(3) + H(1) + F(9) + H(1),          // r3  interiors
  H(1) + H(1) + F(9) + F(1) + F(3) + F(1) + F(9) + H(1),          // r4  interiors + doorways
  H(1) + H(1) + F(9) + H(1) + F(3) + H(1) + F(9) + H(1),          // r5  interiors
  H(1) + H(1) + H(9) + H(1) + F(3) + H(1) + H(9) + H(1),          // r6  south walls
  H(1) + F(24) + H(1),                                            // r7  porch
  H(1) + H(1) + H(9) + H(1) + F(3) + H(1) + H(9) + H(1),          // r8  W2/E2 north walls
  H(1) + H(1) + F(9) + F(1) + F(3) + F(1) + F(9) + H(1),          // r9  interiors + doorways
  H(1) + H(1) + F(9) + H(1) + F(3) + H(1) + F(9) + H(1),          // r10 interiors
  H(1) + H(1) + H(9) + H(1) + F(3) + H(1) + H(9) + H(1),          // r11 south walls
  H(1) + F(24) + H(1),                                            // r12 staircase
  H(1) + F(24) + H(1),                                            // r13 staircase
  H(1) + F(24) + H(1),                                            // r14 staircase
  H(1) + F(24) + H(1),                                            // r15 raised street
  H(1) + F(24) + H(1),                                            // r16 raised street
  H(12) + DOOR + H(13),                                           // r17 bone door
];

// The tilted street climbs three steps southward; the east house E2 has a
// raised interior one step up from the street.
const victorianHeight = [
  '', '', '', '', '', '', '', '', '',                          // r0-r8
  '0'.repeat(16) + '1'.repeat(9) + '0',                        // r9  E2 interior raised
  '0'.repeat(16) + '1'.repeat(9) + '0',                        // r10 E2 interior raised
  '',                                                          // r11
  '0' + '1'.repeat(24) + '0',                                  // r12 step 1
  '0' + '2'.repeat(24) + '0',                                  // r13 step 2
  '0' + '3'.repeat(24) + '0',                                  // r14 step 3
  '0' + '3'.repeat(24) + '0',                                  // r15 raised
  '0' + '3'.repeat(24) + '0',                                  // r16 raised
  '',                                                          // r17 door
];

const altarPlan = [
  H(12) + F(1) + H(13),                                         // r0  north opening
  H(1) + F(24) + H(1),                                          // r1
  H(1) + F(24) + H(1),                                          // r2
  H(1) + F(24) + H(1),                                          // r3
  H(1) + F(7) + A(4) + F(1) + A(5) + F(7) + H(1),               // r4  hazard ring top, gap
  H(1) + F(7) + A(1) + F(8) + A(1) + F(7) + H(1),               // r5
  H(1) + F(7) + A(1) + F(8) + A(1) + F(7) + H(1),               // r6
  H(1) + F(7) + A(1) + F(8) + A(1) + F(7) + H(1),               // r7
  H(1) + F(7) + A(1) + F(8) + A(1) + F(7) + H(1),               // r8
  H(1) + F(7) + A(1) + F(8) + A(1) + F(7) + H(1),               // r9
  H(1) + F(7) + A(1) + F(8) + A(1) + F(7) + H(1),               // r10
  H(1) + H(4) + F(3) + A(10) + F(7) + H(1),                     // r11 hazard bottom + cellar wall
  H(1) + F(4) + H(1) + F(19) + H(1),                            // r12 cellar interior
  H(1) + F(4) + SECRET + F(19) + H(1),                          // r13 cellar secret door
  H(1) + F(4) + H(1) + F(19) + H(1),                            // r14 cellar interior
  H(12) + F(1) + H(13),                                         // r15 south opening
];

const ruinsPlan = [
  H(12) + F(1) + H(13),                                                  // r0  north opening
  H(1) + F(4) + H(1) + F(19) + H(1),                                     // r1  cache top
  H(1) + F(4) + SECRET + F(19) + H(1),                                   // r2  cache secret door
  H(1) + F(24) + H(1),                                                   // r3  entry hall
  H(1) + F(5) + H(2) + F(4) + H(2) + F(4) + H(2) + F(5) + H(1),          // r4  corridor motif 1
  H(1) + F(5) + H(2) + F(4) + H(2) + F(4) + H(2) + F(5) + H(1),          // r5  corridor motif 1
  H(1) + F(24) + H(1),                                                   // r6  hall
  H(1) + F(5) + F(2) + F(4) + H(2) + F(4) + H(2) + F(5) + H(1),          // r7  motif 2, west pillar broken
  H(1) + F(5) + F(2) + F(4) + H(2) + F(4) + H(2) + F(5) + H(1),          // r8  motif 2
  H(1) + F(24) + H(1),                                                   // r9  hall
  H(1) + F(5) + H(2) + F(4) + H(2) + F(4) + F(1) + H(1) + F(5) + H(1),   // r10 motif 3, east niche
  H(1) + F(5) + H(2) + F(4) + H(2) + F(4) + F(1) + H(1) + F(5) + H(1),   // r11 motif 3
  H(1) + F(24) + H(1),                                                   // r12 hall
  H(1) + F(24) + H(1),                                                   // r13 south hall
  H(1) + F(24) + H(1),                                                   // r14
  H(1) + F(24) + H(1),                                                   // r15
  H(1) + F(24) + H(1),                                                   // r16 south hall
  H(12) + DOOR + H(13),                                                  // r17 sigil door
];

// Oversized ceilings: the connecting halls read far taller than the corridors.
const ruinsCeil = [
  'a'.repeat(26), 'a'.repeat(26), 'a'.repeat(26), 'a'.repeat(26),   // r0-r3
  '6'.repeat(26), '6'.repeat(26),                                   // r4-r5
  'a'.repeat(26),                                                   // r6
  '6'.repeat(26), '6'.repeat(26),                                   // r7-r8
  'a'.repeat(26),                                                   // r9
  '6'.repeat(26), '6'.repeat(26),                                   // r10-r11
  'a'.repeat(26), 'a'.repeat(26), 'a'.repeat(26), 'a'.repeat(26), 'a'.repeat(26), // r12-r16
  '6'.repeat(26),                                                   // r17
];

const riftPlan = [
  H(12) + F(1) + H(13),                                             // r0  north opening
  H(1) + F(24) + H(1),                                              // r1
  H(1) + F(24) + H(1),                                              // r2
  H(1) + F(4) + H(4) + F(6) + H(4) + F(6) + H(1),                   // r3  cover pillars
  H(1) + F(4) + H(1) + F(2) + H(1) + F(6) + H(1) + F(2) + H(1) + F(6) + H(1), // r4 hollow pillars
  H(1) + F(4) + H(4) + F(6) + H(4) + F(6) + H(1),                   // r5
  H(1) + F(24) + H(1),                                              // r6
  H(1) + F(24) + H(1),                                              // r7
  H(1) + F(4) + H(4) + F(6) + H(4) + F(6) + H(1),                   // r8
  H(1) + F(4) + H(1) + F(2) + H(1) + F(6) + H(1) + F(2) + H(1) + F(6) + H(1), // r9
  H(1) + F(4) + H(4) + F(6) + H(4) + F(6) + H(1),                   // r10
  H(1) + F(24) + H(1),                                              // r11
  H(1) + F(24) + H(1),                                              // r12 goal
  H(26),                                                            // r13
];

/* ------------------------------------------------------------------ *
 * lights
 * ------------------------------------------------------------------ */
const lamp = (col, row, kind = 'lamp', color = '#c98b2e', radius = 8, intensity = 1.0, y = 3.0, flicker = 0, dynamic = false, bake = true) => {
  const o = { pos: [cx(col), y, cz(row)], color, radius, intensity, kind };
  if (flicker) o.flicker = flicker;
  if (dynamic) o.dynamic = true;
  if (!bake) o.bake = false;
  return o;
};

const lights = [
  // docks — moon and quay lamps
  lamp(12, 8, 'moon', '#8fb0c4', 30, 1.3, 16, 0, false, false),
  lamp(2, 5), lamp(6, 5), lamp(10, 5), lamp(14, 5), lamp(18, 5), lamp(22, 5),
  lamp(4, 3, 'candle', '#c98b2e', 4, 0.9, 1.7, 0.2),
  lamp(12, 3, 'candle', '#c98b2e', 4, 0.9, 1.7, 0.2),
  lamp(4, 7), lamp(10, 7), lamp(16, 7), lamp(4, 11), lamp(10, 11), lamp(16, 11),

  // sewer — dim, damp, flickering
  lamp(28, 6, 'lamp', '#7a8f7a', 7, 0.9, 3.0, 0.3),
  lamp(32, 6, 'lamp', '#7a8f7a', 7, 0.9, 3.0, 0.3),
  lamp(36, 6, 'lamp', '#7a8f7a', 7, 0.9, 3.0, 0.3),
  lamp(40, 6, 'lamp', '#7a8f7a', 7, 0.9, 3.0, 0.3),
  lamp(44, 6, 'lamp', '#7a8f7a', 7, 0.9, 3.0, 0.3),
  lamp(33, 3, 'candle', '#c98b2e', 4, 0.8, 1.6, 0.25),
  lamp(44, 3, 'candle', '#c98b2e', 4, 0.8, 1.6, 0.25),
  lamp(33, 9, 'candle', '#c98b2e', 4, 0.8, 1.6, 0.25),
  lamp(44, 9, 'candle', '#c98b2e', 4, 0.8, 1.6, 0.25),
  lamp(38, 11, 'lamp', '#7a8f7a', 6, 0.8, 3.0, 0.2),
  lamp(38, 13, 'lamp', '#2f5a52', 5, 0.7, 2.0, 0.4),

  // victorian — street lamps and house candles
  lamp(38, 17), lamp(39, 23), lamp(38, 28), lamp(39, 32),
  lamp(31, 19, 'candle', '#c98b2e', 4, 0.9, 1.7, 0.2),
  lamp(45, 19, 'candle', '#c98b2e', 4, 0.9, 1.7, 0.2),
  lamp(31, 24, 'candle', '#c98b2e', 4, 0.9, 1.7, 0.2),
  lamp(45, 24, 'candle', '#c98b2e', 4, 0.9, 1.7, 0.2),
  lamp(46, 31, 'candle', '#c98b2e', 4, 0.9, 1.7, 0.2),
  lamp(29, 17), lamp(46, 17), lamp(29, 23), lamp(46, 23),

  // altar — candles on the ring, ritual centre
  lamp(34, 39, 'candle', '#c98b2e', 4, 0.9, 1.6, 0.2),
  lamp(42, 39, 'candle', '#c98b2e', 4, 0.9, 1.6, 0.2),
  lamp(34, 43, 'candle', '#c98b2e', 4, 0.9, 1.6, 0.2),
  lamp(42, 43, 'candle', '#c98b2e', 4, 0.9, 1.6, 0.2),
  lamp(38, 38, 'candle', '#c98b2e', 4, 0.9, 1.6, 0.2),
  lamp(38, 41, 'ritual', '#9fe08a', 11, 1.4, 2.4, 0.1, true, false),
  lamp(29, 35), lamp(46, 35), lamp(29, 40), lamp(46, 40), lamp(32, 47), lamp(46, 47), lamp(38, 49),

  // ruins — dim hall lights and corridor candles
  lamp(38, 53, 'lamp', '#8fb0c4', 9, 0.8, 4.0, 0.15),
  lamp(38, 56, 'lamp', '#8fb0c4', 9, 0.8, 4.0, 0.15),
  lamp(38, 59, 'lamp', '#8fb0c4', 9, 0.8, 4.0, 0.15),
  lamp(38, 62, 'lamp', '#8fb0c4', 9, 0.8, 4.0, 0.15),
  lamp(38, 65, 'lamp', '#8fb0c4', 9, 0.8, 4.0, 0.15),
  lamp(29, 54, 'candle', '#c98b2e', 4, 0.8, 1.6, 0.2),
  lamp(44, 54, 'candle', '#c98b2e', 4, 0.8, 1.6, 0.2),
  lamp(29, 57, 'candle', '#c98b2e', 4, 0.8, 1.6, 0.2),
  lamp(44, 58, 'candle', '#c98b2e', 4, 0.8, 1.6, 0.2),
  lamp(29, 60, 'candle', '#c98b2e', 4, 0.8, 1.6, 0.2),
  lamp(44, 61, 'candle', '#c98b2e', 4, 0.8, 1.6, 0.2),
  lamp(29, 51, 'candle', '#c98b2e', 4, 0.8, 1.6, 0.2),

  // rift — where the town gives out and the fissure begins.
  // The arena is 26 by 14 cells with a 7 m ceiling, so it needs a real rig: a
  // wide sickly wash to make the floor readable, a ring of pillar sconces around
  // the fight, and two ritual sources at the fissure that stay out of the bake
  // because they pulse.
  lamp(38, 69, 'lamp', '#8a9a44', 16, 1.5, 5.0, 0.15),
  lamp(30, 70, 'lamp', '#7f8f3a', 13, 1.2, 4.4, 0.2),
  lamp(46, 70, 'lamp', '#7f8f3a', 13, 1.2, 4.4, 0.2),
  lamp(28, 74, 'lamp', '#7f8f3a', 13, 1.2, 4.0, 0.2),
  lamp(49, 74, 'lamp', '#7f8f3a', 13, 1.2, 4.0, 0.2),
  lamp(32, 72, 'candle', '#c98b2e', 7, 1.1, 1.8, 0.3),
  lamp(45, 72, 'candle', '#c98b2e', 7, 1.1, 1.8, 0.3),
  lamp(32, 78, 'candle', '#c98b2e', 7, 1.1, 1.8, 0.3),
  lamp(45, 78, 'candle', '#c98b2e', 7, 1.1, 1.8, 0.3),
  // Overhead wash so the boss's upper mass is not a black cut-out.
  lamp(38, 73, 'lamp', '#6f7f2a', 20, 1.3, 6.6, 0.1),
  lamp(38, 78, 'lamp', '#6f7f2a', 18, 1.2, 6.4, 0.1),
  lamp(34, 76, 'lamp', '#8a9a44', 12, 1.0, 3.4, 0.2),
  lamp(43, 76, 'lamp', '#8a9a44', 12, 1.0, 3.4, 0.2),
  lamp(38, 75, 'ritual', '#a82a18', 15, 1.8, 3.0, 0.15, true, false),
  lamp(38, 79, 'lamp', '#8a9a44', 11, 1.1, 3.0, 0.25),
  lamp(38, 80, 'ritual', '#9fe08a', 13, 1.6, 2.4, 0.1, true, false),
];

/* ------------------------------------------------------------------ *
 * props
 * ------------------------------------------------------------------ */
const prop = (id, col, row, size, tile, yaw = 0, roll = 0, extra = {}) => ({
  id, pos: [cx(col), size[1] * 0.5, cz(row)], size, yaw, roll, tile, ...extra,
});

const props = [
  // docks
  prop('crateD1', 15, 5, [1, 1, 1], 'barnacle'),
  prop('crateD2', 16, 5, [1, 1, 1], 'barnacle', 15),
  prop('cargoD', 10, 5, [2, 1.2, 1], 'barnacle', 30),
  prop('piling1', 2, 8, [0.4, 2.2, 0.4], 'beams'),
  prop('piling2', 6, 8, [0.4, 2.2, 0.4], 'beams'),
  prop('piling3', 12, 8, [0.4, 2.2, 0.4], 'beams'),
  prop('piling4', 18, 8, [0.4, 2.2, 0.4], 'beams'),

  // victorian — leaning facades and a stall
  prop('facadeW', 4, 7, [3, 2, 0.4], 'wetBrick', 0, 8),
  prop('facadeE', 19, 7, [3, 2, 0.4], 'wetBrick', 0, -6),
  prop('facadeS', 4, 14, [3, 2.2, 0.4], 'wetBrick', 0, 10),
  prop('stall', 13, 13, [2, 1.4, 1], 'beams', 15),
  prop('crateV1', 7, 12, [1, 1, 1], 'barnacle'),
  prop('crateV2', 17, 12, [1, 1, 1], 'barnacle', 10),

  // altar
  prop('altarBlock', 12, 8, [2, 1.2, 2], 'vault'),
  prop('conduit1', 9, 5, [0.6, 2, 0.6], 'iron'),
  prop('conduit2', 12, 5, [0.6, 2, 0.6], 'iron'),
  prop('conduit3', 15, 5, [0.6, 2, 0.6], 'iron'),

  // ruins — statues and a fallen beam
  prop('statue1', 2, 4, [0.8, 2.4, 0.8], 'ruin'),
  prop('statue2', 20, 4, [0.8, 2.4, 0.8], 'ruin'),
  prop('statue3', 2, 11, [0.8, 2.4, 0.8], 'ruin'),
  prop('beam1', 12, 6, [4, 0.5, 0.5], 'beams', 20, 12, { solid: false }),

  // rift
  prop('column1', 6, 3, [1, 6, 1], 'flesh'),
  prop('column2', 19, 3, [1, 6, 1], 'flesh'),
  prop('column3', 6, 8, [1, 6, 1], 'flesh'),
  prop('column4', 19, 8, [1, 6, 1], 'flesh'),
];

/* ------------------------------------------------------------------ *
 * entities
 * ------------------------------------------------------------------ */
const entities = [
  // ---- weapons (revolver is the starting weapon) ----
  { type: 'weapon', weapon: 'shotgun', col: 5, row: 3 },
  { type: 'weapon', weapon: 'harpoon', col: 44, row: 3 },
  { type: 'weapon', weapon: 'flamer', col: 46, row: 26 },
  { type: 'weapon', weapon: 'focus', col: 35, row: 39 },
  { type: 'weapon', weapon: 'bonecannon', col: 29, row: 51 },

  // ---- keys ----
  { type: 'key', key: 'brass', col: 4, row: 3 },
  { type: 'key', key: 'bone', col: 46, row: 31 },
  { type: 'key', key: 'sigil', col: 38, row: 66 },

  // ---- ammo ----
  { type: 'ammo', ammo: 'brass', amount: 12, col: 3, row: 3 },
  { type: 'ammo', ammo: 'brass', amount: 12, col: 20, row: 5 },
  { type: 'ammo', ammo: 'brass', amount: 12, col: 31, row: 6 },
  { type: 'ammo', ammo: 'brass', amount: 12, col: 33, row: 20 },
  { type: 'ammo', ammo: 'brass', amount: 12, col: 36, row: 39 },
  { type: 'ammo', ammo: 'brass', amount: 12, col: 36, row: 57 },
  { type: 'ammo', ammo: 'shell', amount: 8, col: 16, row: 5 },
  { type: 'ammo', ammo: 'shell', amount: 8, col: 47, row: 6 },
  { type: 'ammo', ammo: 'shell', amount: 8, col: 39, row: 27 },
  { type: 'ammo', ammo: 'shell', amount: 8, col: 36, row: 62 },
  { type: 'ammo', ammo: 'harpoon', amount: 4, col: 44, row: 4 },
  { type: 'ammo', ammo: 'harpoon', amount: 4, col: 33, row: 4 },
  { type: 'ammo', ammo: 'harpoon', amount: 4, col: 32, row: 20 },
  { type: 'ammo', ammo: 'harpoon', amount: 4, col: 36, row: 60 },
  { type: 'ammo', ammo: 'oil', amount: 75, col: 45, row: 25 },
  { type: 'ammo', ammo: 'oil', amount: 75, col: 44, row: 26 },
  { type: 'ammo', ammo: 'oil', amount: 75, col: 41, row: 39 },
  { type: 'ammo', ammo: 'ichor', amount: 10, col: 42, row: 39 },
  { type: 'ammo', ammo: 'ichor', amount: 10, col: 40, row: 57 },
  { type: 'ammo', ammo: 'bone', amount: 5, col: 32, row: 74 },
  { type: 'ammo', ammo: 'bone', amount: 5, col: 45, row: 74 },
  { type: 'ammo', ammo: 'bone', amount: 5, col: 38, row: 65 },
  { type: 'ammo', ammo: 'bone', amount: 5, col: 36, row: 65 },

  // ---- health ----
  { type: 'health', amount: 25, col: 17, row: 5 },
  { type: 'health', amount: 25, col: 38, row: 2 },
  { type: 'health', amount: 25, col: 37, row: 23 },
  { type: 'health', amount: 50, col: 46, row: 20 },
  { type: 'health', amount: 25, col: 31, row: 20 },
  { type: 'health', amount: 50, col: 37, row: 46 },
  { type: 'health', amount: 25, col: 37, row: 62 },
  { type: 'health', amount: 25, col: 44, row: 60 },
  { type: 'health', amount: 50, col: 38, row: 75 },
  { type: 'health', amount: 50, col: 44, row: 80 },

  // ---- armor ----
  { type: 'armor', amount: 50, col: 12, row: 2 },
  { type: 'armor', amount: 50, col: 34, row: 20 },
  { type: 'armor', amount: 50, col: 44, row: 47 },
  { type: 'armor', amount: 50, col: 36, row: 63 },

  // ---- enemies: docks ----
  { type: 'enemy', enemy: 'fisherman', col: 15, row: 5, yaw: 180 },
  { type: 'enemy', enemy: 'fisherman', col: 8, row: 8, yaw: 0 },
  // ---- enemies: sewer ----
  { type: 'enemy', enemy: 'crawler', col: 30, row: 6 },
  { type: 'enemy', enemy: 'crawler', col: 33, row: 6 },
  { type: 'enemy', enemy: 'crawler', col: 40, row: 6 },
  { type: 'enemy', enemy: 'crawler', col: 45, row: 3 },
  { type: 'enemy', enemy: 'crawler', col: 47, row: 8 },
  { type: 'enemy', enemy: 'crawler', col: 33, row: 9 },
  { type: 'enemy', enemy: 'crawler', col: 39, row: 9 },
  { type: 'enemy', enemy: 'fisherman', col: 48, row: 6 },
  // ---- enemies: victorian ----
  { type: 'enemy', enemy: 'cultist', col: 30, row: 20 },
  { type: 'enemy', enemy: 'cultist', col: 45, row: 20 },
  { type: 'enemy', enemy: 'cultist', col: 39, row: 23 },
  { type: 'enemy', enemy: 'cultist', col: 31, row: 25 },
  { type: 'enemy', enemy: 'cultist', col: 45, row: 25 },
  { type: 'enemy', enemy: 'cultist', col: 39, row: 28 },
  { type: 'enemy', enemy: 'cultist', col: 29, row: 31 },
  { type: 'enemy', enemy: 'cultist', col: 45, row: 32 },
  { type: 'enemy', enemy: 'eye', col: 31, row: 26 },
  { type: 'enemy', enemy: 'eye', col: 45, row: 26 },
  { type: 'enemy', enemy: 'eye', col: 39, row: 30 },
  { type: 'enemy', enemy: 'eye', col: 47, row: 31 },
  // ---- enemies: altar ----
  { type: 'enemy', enemy: 'cultist', col: 31, row: 40 },
  { type: 'enemy', enemy: 'cultist', col: 46, row: 40 },
  { type: 'enemy', enemy: 'cultist', col: 32, row: 47 },
  { type: 'enemy', enemy: 'cultist', col: 46, row: 47 },
  { type: 'enemy', enemy: 'eye', col: 38, row: 36 },
  { type: 'enemy', enemy: 'eye', col: 39, row: 46 },
  { type: 'enemy', enemy: 'summoner', col: 40, row: 39 },
  // ---- enemies: ruins ----
  { type: 'enemy', enemy: 'crawler', col: 35, row: 54 },
  { type: 'enemy', enemy: 'crawler', col: 42, row: 55 },
  { type: 'enemy', enemy: 'crawler', col: 35, row: 57 },
  { type: 'enemy', enemy: 'crawler', col: 41, row: 58 },
  { type: 'enemy', enemy: 'crawler', col: 35, row: 60 },
  { type: 'enemy', enemy: 'crawler', col: 40, row: 61 },
  { type: 'enemy', enemy: 'crawler', col: 38, row: 62 },
  { type: 'enemy', enemy: 'eye', col: 44, row: 53 },
  { type: 'enemy', enemy: 'eye', col: 44, row: 63 },
  { type: 'enemy', enemy: 'eye', col: 32, row: 62 },
  { type: 'enemy', enemy: 'summoner', col: 31, row: 66 },
  // ---- enemies: rift ----
  { type: 'enemy', enemy: 'crawler', col: 31, row: 74 },
  { type: 'enemy', enemy: 'crawler', col: 46, row: 74 },
  { type: 'enemy', enemy: 'crawler', col: 38, row: 79 },
  { type: 'enemy', enemy: 'cultist', col: 31, row: 79 },
  { type: 'enemy', enemy: 'cultist', col: 46, row: 79 },
  { type: 'enemy', enemy: 'scion', col: 39, row: 74 },

  // ---- mechanisms ----
  { type: 'mechanism', id: 'sewerValve', col: 33, row: 3, targets: ['sewerGate'], label: 'Outfall valve' },
  { type: 'mechanism', id: 'altarConduits', col: 38, row: 41, targets: ['conduitOne', 'conduitTwo', 'conduitThree'], label: 'The three conduits' },

  // ---- secrets ----
  { type: 'secret', id: 'docksCache', col: 12, row: 3, label: 'Cargo shack cache' },
  { type: 'secret', id: 'sextonCellar', col: 29, row: 47, label: 'Sexton cellar' },
  { type: 'secret', id: 'prehumanCache', col: 30, row: 51, label: 'Pre-human cache' },

  // ---- notes ----
  { type: 'note', id: 'noteTide', col: 3, row: 2, text: 'The harbourmaster\u2019s log ends mid-sentence on the fourteenth. The last page holds one word, repeated, pressed so hard the pen tore.' },
  { type: 'note', id: 'noteGate', col: 37, row: 3, text: 'Someone barricaded the outfall gate from the inside. The wire is wrapped three times and the knots are tied tight.' },
  { type: 'note', id: 'noteDoors', col: 33, row: 19, text: 'Every door on this street faces the harbour. The ones that face away are bricked.' },
  { type: 'note', id: 'noteSubside', col: 43, row: 31, text: 'The townhouses sank in order, west to east. The last one standing faces the church.' },
  { type: 'note', id: 'noteCircle', col: 42, row: 43, text: 'The chalk circle is drawn the wrong way round. They copied it mirrored and called the work done.' },
  { type: 'note', id: 'noteSexton', col: 28, row: 46, text: 'The sexton buried the vestments and the censer the same night. He left this note under the floor.' },
  { type: 'note', id: 'noteCorridor', col: 38, row: 56, text: 'The corridor repeats. Each time the columns lose a little more of their surface.' },
  { type: 'note', id: 'noteSigil', col: 44, row: 65, text: 'The drowned sigil lies where the tide stopped. It has been waiting.' },
  { type: 'note', id: 'noteFissure', col: 44, row: 79, text: 'The town is behind you. The sound in the fissure is the sea counting down.' },

  // ---- triggers ----
  { type: 'trigger', id: 'docksClear', col: 24, row: 5, radius: 3, once: true, fires: [] },
  { type: 'trigger', id: 'altarApproach', col: 38, row: 35, radius: 2, once: true, fires: [] },
  { type: 'trigger', id: 'riftApproach', col: 38, row: 69, radius: 2, once: true, fires: [] },
];

/* ------------------------------------------------------------------ *
 * script beats
 * ------------------------------------------------------------------ */
const script = [
  { at: 'start', do: 'titleCard', text: 'Thresher\u2019s Reach' },
  { at: 'start', do: 'objective', text: 'Follow the tide inland. Put the thing in the fissure back to sleep.' },
  { at: 'docksClear', do: 'subtitle', text: 'The harbour gate is chained from the outside. The key is in the office.' },
  { at: 'altarApproach', do: 'subtitle', text: 'The circle is mirrored. The three conduits still hold a charge.' },
  { at: 'riftApproach', do: 'subtitle', text: 'The town has stopped. Only the fissure moves.' },
  { at: 'riftApproach', do: 'music', value: 'boss' },
];

/* ------------------------------------------------------------------ *
 * level export
 * ------------------------------------------------------------------ */
export const LEVEL = {
  title: 'SALTWAKE',
  subtitle: 'Thresher\u2019s Reach, the night the tide came inland',
  spawn: { col: 4, row: 5, yaw: 90 },
  goal: { col: 38, row: 80, label: 'The Fissure' },
  startingWeapons: ['revolver'],
  startingAmmo: { brass: 24 },
  startingKeys: [],
  zones: [
    {
      id: 'docks', label: 'The Wharf', district: 'docks', col: 0, row: 0,
      plan: docksPlan, floorY: 0, ceilY: 4,
      tiles: { floor: 'dockPlanks', ceil: 'beams', wall: 'wetBrick', trim: 'barnacle', door: 'brassDoor' },
      waterY: -0.6, openSky: true,
    },
    {
      id: 'sewer', label: 'Outfall Tunnels', district: 'sewer', col: 26, row: 0,
      plan: sewerPlan, floorY: 0, ceilY: 4,
      tiles: { floor: 'sewerTile', ceil: 'iron', wall: 'wetBrick', trim: 'sludge', door: 'iron' },
      waterY: -0.3, openSky: false,
    },
    {
      id: 'victorian', label: 'Tilt Street', district: 'victorian', col: 26, row: 16,
      plan: victorianPlan, height: victorianHeight, floorY: 0, ceilY: 5,
      tiles: { floor: 'cobbles', ceil: 'beams', wall: 'wetBrick', trim: 'barnacle', door: 'boneDoor' },
      openSky: false,
    },
    {
      id: 'altar', label: 'The Undercroft', district: 'altar', col: 26, row: 34,
      plan: altarPlan, floorY: 0, ceilY: 5,
      tiles: { floor: 'mosaic', ceil: 'vault', wall: 'wetBrick', trim: 'tapestry', door: 'boneDoor' },
      openSky: false,
    },
    {
      id: 'ruins', label: 'Cyclopean Ruins', district: 'ruins', col: 26, row: 50,
      plan: ruinsPlan, ceil: ruinsCeil, floorY: 0, ceilY: 5,
      tiles: { floor: 'silt', ceil: 'ruin', wall: 'ruin', trim: 'barnacle', door: 'boneDoor' },
      openSky: false,
    },
    {
      id: 'rift', label: 'The Fissure', district: 'rift', col: 26, row: 68,
      plan: riftPlan, floorY: 0, ceilY: 7,
      tiles: { floor: 'flesh', ceil: 'flesh', wall: 'flesh', trim: 'sludge', door: 'boneDoor' },
      openSky: false,
    },
  ],
  doors: [
    { id: 'docksGate', col: 25, row: 6, key: 'brass', label: 'Harbour gate' },
    { id: 'secretDocks', col: 12, row: 4, key: null, label: 'Boarded hatch' },
    { id: 'sewerGate', col: 38, row: 11, key: null, label: 'Outfall gate' },
    { id: 'churchDoor', col: 38, row: 33, key: 'bone', label: 'Church door' },
    { id: 'secretAltar', col: 31, row: 47, key: null, label: 'Cellar door' },
    { id: 'secretRuins', col: 31, row: 52, key: null, label: 'Cache door' },
    { id: 'riftDoor', col: 38, row: 67, key: 'sigil', label: 'Fissure seal' },
  ],
  lights,
  props,
  entities,
  script,
};

export default LEVEL;
