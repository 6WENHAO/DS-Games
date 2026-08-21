/**
 * src/game/levels.js
 *
 * Level data for the 3D Sokoban lawn plot.
 *
 * These ten levels are original designs, authored for this project and verified
 * by tools/verify-levels.mjs. The design idiom — a compact footprint, a single
 * mechanic per level, and a teaching order that builds one idea at a time —
 * follows the Microban tradition established by David W. Skinner. No level is
 * copied from Microban or any other published collection.
 *
 * Grid format is XSB: rows are strings, ragged rows are padded with spaces on
 * the right by the consumer. Footprint stays within 9 columns by 8 rows so the
 * board fits the lawn plot; levels 1-3 stay within 7 by 6.
 */

export const LEVEL_CHARS = { WALL: '#', FLOOR: ' ', GOAL: '.', BOX: '$', BOX_ON_GOAL: '*', PLAYER: '@', PLAYER_ON_GOAL: '+' };

export const LEVELS = [
  {
    id: 'grove-01',
    par: 2,   // shortest push count found by tools/verify-levels.mjs
    name: 'First Furrow',
    hint: 'One crate, one mark. Walk behind the crate and push it onto the mark.',
    concept: 'basic push',
    grid: [
      '#######',
      '#     #',
      '#@$ . #',
      '#     #',
      '#######',
    ],
  },
  {
    id: 'grove-02',
    par: 4,   // shortest push count found by tools/verify-levels.mjs
    name: 'Corner Bed',
    hint: 'The mark sits in a corner. Push the crate left to the wall, then up that wall onto the mark.',
    concept: 'corner goal',
    grid: [
      '#######',
      '#.    #',
      '# ##  #',
      '#  $  #',
      '#  @  #',
      '#######',
    ],
  },
  {
    id: 'grove-03',
    par: 6,   // shortest push count found by tools/verify-levels.mjs
    name: 'Around the Stump',
    hint: 'The stump blocks the straight line. Push the crate past the stump, up the far side, then back along the top row.',
    concept: 'turning a corner',
    grid: [
      '#######',
      '# .   #',
      '# ##  #',
      '#@$   #',
      '#     #',
      '#######',
    ],
  },
  {
    id: 'grove-04',
    par: 8,   // shortest push count found by tools/verify-levels.mjs
    name: 'Two Beds',
    hint: 'Two crates, two marks. Send each crate to the mark on its own side of the plot.',
    concept: 'two crates',
    grid: [
      '#########',
      '#.      #',
      '# @   $ #',
      '#   #   #',
      '# $     #',
      '#      .#',
      '#########',
    ],
  },
  {
    id: 'grove-05',
    par: 10,   // shortest push count found by tools/verify-levels.mjs
    name: 'Two Gates',
    hint: 'Each gate in the fence is one tile wide. Line a crate up with a gate, then push it straight through.',
    concept: 'using a corridor',
    grid: [
      '#########',
      '#@  #   #',
      '#  $#   #',
      '#      .#',
      '#   #   #',
      '#  $#   #',
      '#      .#',
      '#########',
    ],
  },
  {
    id: 'grove-06',
    par: 12,   // shortest push count found by tools/verify-levels.mjs
    name: 'The Long Way Round',
    hint: 'A crate against the fence slides only along that fence. Walk this crate right, down, and back along the low row, around the shed.',
    concept: 'avoiding a wall-lock',
    grid: [
      '#########',
      '#@      #',
      '# $     #',
      '# ####  #',
      '# ####  #',
      '#  .. $ #',
      '#########',
    ],
  },
  {
    id: 'grove-07',
    par: 14,   // shortest push count found by tools/verify-levels.mjs
    name: 'Far Mark First',
    hint: 'Both crates share one passage and one column. Send the crate bound for the upper mark through first.',
    concept: 'ordering crates',
    grid: [
      '########',
      '#   #  #',
      '# $ #. #',
      '#   #  #',
      '# $ #. #',
      '#      #',
      '#  @   #',
      '########',
    ],
  },
  {
    id: 'grove-08',
    par: 16,   // shortest push count found by tools/verify-levels.mjs
    name: 'The Compost Bay',
    hint: 'The bay is three tiles across and its mouth is one tile wide. Turn the second crate a row early, so you keep a tile to stand on.',
    concept: 'repositioning in a tight room',
    grid: [
      '#########',
      '#@      #',
      '# $ $   #',
      '#    # ##',
      '#####   #',
      '#####   #',
      '#####. .#',
      '#########',
    ],
  },
  {
    id: 'grove-09',
    par: 21,   // shortest push count found by tools/verify-levels.mjs
    name: 'Three in a Row',
    hint: 'Three crates leave the yard through one gap. Take the lowest crate first and work upward.',
    concept: 'three crates',
    grid: [
      '#########',
      '#   #   #',
      '# $ #   #',
      '# $ #   #',
      '# $ #...#',
      '#       #',
      '#   @   #',
      '#########',
    ],
  },
  {
    id: 'grove-10',
    par: 26,   // shortest push count found by tools/verify-levels.mjs
    name: 'The Whole Plot',
    hint: 'Four crates climb the same two columns. Fill the leftmost mark first and leave the corner mark for last.',
    concept: 'ordering in tight space',
    grid: [
      '#########',
      '#   ....#',
      '# ####  #',
      '# $ $   #',
      '# $ $   #',
      '#   @   #',
      '#########',
    ],
  },
];

export default LEVELS;
