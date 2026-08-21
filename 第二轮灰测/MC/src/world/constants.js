/**
 * world/constants.js
 * ------------------------------------------------------------------
 * World geometry constants shared by the main thread and the workers.
 * Kept dependency-free so workers can import it in isolation.
 */

/** Horizontal size of a chunk column, in blocks. */
export const CHUNK_SIZE = 16;
/**
 * Vertical size of the world, in blocks.
 *
 * Tall enough for vanilla-scale relief: with sea level at 64 there are
 * ~115 blocks of headroom, so mountains can genuinely tower instead of
 * being squashed into a 20-block band.
 */
export const WORLD_HEIGHT = 192;
/** Y coordinate of the ocean surface (vanilla uses 63). */
export const SEA_LEVEL = 64;
/** Blocks in one chunk column. */
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;

/** Bit shifts used for the chunk-local index: (y * 16 + z) * 16 + x. */
export const IDX_Y_SHIFT = 8;
export const IDX_Z_SHIFT = 4;

/** Chunk-local block index from local coordinates. */
export const localIndex = (x, y, z) => (y << IDX_Y_SHIFT) | (z << IDX_Z_SHIFT) | x;

/** Padded neighbourhood used for meshing: one block of margin on every side. */
export const PAD = 1;
export const PADDED_SIZE = CHUNK_SIZE + PAD * 2;          // 18
export const PADDED_HEIGHT = WORLD_HEIGHT + PAD * 2;      // 130
export const PADDED_VOLUME = PADDED_SIZE * PADDED_SIZE * PADDED_HEIGHT;

/** Index into a padded neighbourhood array; coordinates run -1..CHUNK_SIZE. */
export const paddedIndex = (x, y, z) => (
  ((y + PAD) * PADDED_SIZE + (z + PAD)) * PADDED_SIZE + (x + PAD)
);

/** Face ids, matching the shader's FACE_SHADE / FACE_NORMAL tables. */
export const FACE = {
  EAST: 0,   // +X
  WEST: 1,   // -X
  UP: 2,     // +Y
  DOWN: 3,   // -Y
  SOUTH: 4,  // +Z
  NORTH: 5,  // -Z
};

/** Unit offset per face id. */
export const FACE_DIR = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

/** Maximum light level. */
export const MAX_LIGHT = 15;

/** Render passes, in draw order. */
export const PASS = { OPAQUE: 0, CUTOUT: 1, TRANSLUCENT: 2 };

/** Block model kinds understood by the mesher. */
export const MODEL = {
  AIR: 0,
  CUBE: 1,
  CROSS: 2,
  LIQUID: 3,
  TORCH: 4,
};

/** Biome tint sources. */
export const TINT = { NONE: 0, GRASS: 1, FOLIAGE: 2, WATER: 3 };
