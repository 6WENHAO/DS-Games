/**
 * entities/models.js
 * ------------------------------------------------------------------
 * Boxy entity models in the Minecraft skin layout.
 *
 * A model is a list of cuboids, each with a size in model units (1/16
 * block, like vanilla) and a UV origin on the skin. `unwrapBox` maps the
 * six faces onto the skin exactly the way Minecraft's own box unwrap
 * does, so official-style skins line up:
 *
 *      +-----+-----+-----------+-----+
 *      | top | bot |           |     |     (row 1: top, bottom)
 *      +-----+-----+-----+-----+-----+
 *      | -X  | +Z  | +X  | -Z  |           (row 2: the four sides)
 *      +-----+-----+-----+-----+
 *
 * Parts are named so the animator can swing legs and turn heads.
 */

import { ENTITY_VERTEX_STRIDE } from '../gfx/shaders/gui.js';

/** One model unit is 1/16 of a block, as in vanilla. */
export const UNIT = 1 / 16;

/**
 * Emits the 6 faces of a cuboid into a float array.
 *
 * @param {number[]} out receives interleaved position/uv/normal floats
 * @param {object} box   {x,y,z,w,h,d,u,v} in model units / texture pixels
 * @param {number} texW @param {number} texH skin dimensions
 */
export function unwrapBox(out, box, texW, texH) {
  const { x, y, z, w, h, d, u, v } = box;
  const x0 = x * UNIT; const x1 = (x + w) * UNIT;
  const y0 = y * UNIT; const y1 = (y + h) * UNIT;
  const z0 = z * UNIT; const z1 = (z + d) * UNIT;
  const iw = 1 / texW; const ih = 1 / texH;

  /** Adds a quad (4 corners, CCW from outside) with a UV rect. */
  const quad = (corners, uu, vv, uw, vh, normal, flipU = false) => {
    const su0 = uu * iw; const sv0 = vv * ih;
    const su1 = (uu + uw) * iw; const sv1 = (vv + vh) * ih;
    const uvs = flipU
      ? [[su1, sv0], [su0, sv0], [su0, sv1], [su1, sv1]]
      : [[su0, sv0], [su1, sv0], [su1, sv1], [su0, sv1]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      out.push(corners[k][0], corners[k][1], corners[k][2], uvs[k][0], uvs[k][1],
        normal[0], normal[1], normal[2]);
    }
  };

  // top (+Y)
  quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], u + d, v, w, d, [0, 1, 0]);
  // bottom (-Y)
  quad([[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], u + d + w, v, w, d, [0, -1, 0]);
  // west (-X)
  quad([[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]].map((p) => p), u, v + d, d, h, [-1, 0, 0]);
  // south (+Z)
  quad([[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]], u + d, v + d, w, h, [0, 0, 1]);
  // east (+X)
  quad([[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]], u + d + w, v + d, d, h, [1, 0, 0]);
  // north (-Z)
  quad([[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0]], u + d + w + d, v + d, w, h, [0, 0, -1]);
}

/**
 * Model definitions. `parts` are grouped so the animator can transform
 * them independently: `body`, `head`, `leg0..3`, `arm0..1`.
 */
export const MODELS = {
  /** Pig / cow / sheep share a quadruped skeleton with different sizes. */
  pig: {
    texture: 'entity_pig',
    texW: 64, texH: 32,
    width: 0.9, height: 0.9,
    parts: {
      body: [{ x: -5, y: 6, z: -8, w: 10, h: 8, d: 16, u: 28, v: 8 }],
      head: [{ x: -4, y: 6, z: -14, w: 8, h: 8, d: 8, u: 0, v: 0 },
        { x: -2, y: 8, z: -15, w: 4, h: 3, d: 1, u: 16, v: 16 }],
      leg0: [{ x: -5, y: 0, z: -7, w: 4, h: 6, d: 4, u: 0, v: 16 }],
      leg1: [{ x: 1, y: 0, z: -7, w: 4, h: 6, d: 4, u: 0, v: 16 }],
      leg2: [{ x: -5, y: 0, z: 3, w: 4, h: 6, d: 4, u: 0, v: 16 }],
      leg3: [{ x: 1, y: 0, z: 3, w: 4, h: 6, d: 4, u: 0, v: 16 }],
    },
  },
  cow: {
    texture: 'entity_cow',
    texW: 64, texH: 32,
    width: 0.9, height: 1.4,
    parts: {
      body: [{ x: -6, y: 8, z: -9, w: 12, h: 10, d: 18, u: 18, v: 4 }],
      head: [{ x: -4, y: 12, z: -15, w: 8, h: 8, d: 6, u: 0, v: 0 },
        { x: -6, y: 17, z: -13, w: 2, h: 2, d: 2, u: 22, v: 0 },
        { x: 4, y: 17, z: -13, w: 2, h: 2, d: 2, u: 22, v: 0 }],
      leg0: [{ x: -6, y: 0, z: -7, w: 4, h: 8, d: 4, u: 0, v: 16 }],
      leg1: [{ x: 2, y: 0, z: -7, w: 4, h: 8, d: 4, u: 0, v: 16 }],
      leg2: [{ x: -6, y: 0, z: 5, w: 4, h: 8, d: 4, u: 0, v: 16 }],
      leg3: [{ x: 2, y: 0, z: 5, w: 4, h: 8, d: 4, u: 0, v: 16 }],
    },
  },
  sheep: {
    texture: 'entity_sheep',
    texW: 64, texH: 32,
    width: 0.9, height: 1.3,
    parts: {
      body: [{ x: -4, y: 7, z: -8, w: 8, h: 8, d: 16, u: 28, v: 8 }],
      head: [{ x: -3, y: 9, z: -13, w: 6, h: 6, d: 6, u: 0, v: 0 }],
      leg0: [{ x: -4, y: 0, z: -6, w: 3, h: 7, d: 3, u: 0, v: 16 }],
      leg1: [{ x: 1, y: 0, z: -6, w: 3, h: 7, d: 3, u: 0, v: 16 }],
      leg2: [{ x: -4, y: 0, z: 4, w: 3, h: 7, d: 3, u: 0, v: 16 }],
      leg3: [{ x: 1, y: 0, z: 4, w: 3, h: 7, d: 3, u: 0, v: 16 }],
    },
  },
  chicken: {
    texture: 'entity_chicken',
    texW: 64, texH: 32,
    width: 0.4, height: 0.7,
    parts: {
      body: [{ x: -3, y: 4, z: -4, w: 6, h: 8, d: 6, u: 0, v: 9 }],
      head: [{ x: -2, y: 10, z: -6, w: 4, h: 6, d: 3, u: 0, v: 0 },
        { x: -1, y: 11, z: -8, w: 2, h: 2, d: 2, u: 14, v: 0 }],
      leg0: [{ x: -3, y: 0, z: -2, w: 1, h: 4, d: 4, u: 26, v: 0 }],
      leg1: [{ x: 2, y: 0, z: -2, w: 1, h: 4, d: 4, u: 26, v: 0 }],
    },
  },
  /** Zombie / skeleton share the biped skeleton. */
  zombie: {
    texture: 'entity_zombie',
    texW: 64, texH: 64,
    width: 0.6, height: 1.95,
    hostile: true, damage: 3, health: 20, speed: 1.5,
    parts: {
      body: [{ x: -4, y: 12, z: -2, w: 8, h: 12, d: 4, u: 16, v: 16 }],
      head: [{ x: -4, y: 24, z: -4, w: 8, h: 8, d: 8, u: 0, v: 0 }],
      arm0: [{ x: -8, y: 12, z: -2, w: 4, h: 12, d: 4, u: 40, v: 16 }],
      arm1: [{ x: 4, y: 12, z: -2, w: 4, h: 12, d: 4, u: 40, v: 16 }],
      leg0: [{ x: -4, y: 0, z: -2, w: 4, h: 12, d: 4, u: 0, v: 16 }],
      leg1: [{ x: 0, y: 0, z: -2, w: 4, h: 12, d: 4, u: 0, v: 16 }],
    },
  },
  skeleton: {
    texture: 'entity_skeleton',
    texW: 64, texH: 32,
    width: 0.6, height: 1.95,
    hostile: true, damage: 2, health: 20, speed: 1.6,
    parts: {
      body: [{ x: -4, y: 12, z: -2, w: 8, h: 12, d: 4, u: 16, v: 16 }],
      head: [{ x: -4, y: 24, z: -4, w: 8, h: 8, d: 8, u: 0, v: 0 }],
      arm0: [{ x: -6, y: 12, z: -1, w: 2, h: 12, d: 2, u: 40, v: 16 }],
      arm1: [{ x: 4, y: 12, z: -1, w: 2, h: 12, d: 2, u: 40, v: 16 }],
      leg0: [{ x: -3, y: 0, z: -1, w: 2, h: 12, d: 2, u: 0, v: 16 }],
      leg1: [{ x: 1, y: 0, z: -1, w: 2, h: 12, d: 2, u: 0, v: 16 }],
    },
  },
  creeper: {
    texture: 'entity_creeper',
    texW: 64, texH: 32,
    width: 0.6, height: 1.7,
    hostile: true, damage: 8, health: 20, speed: 1.4,
    parts: {
      body: [{ x: -4, y: 6, z: -2, w: 8, h: 12, d: 4, u: 16, v: 16 }],
      head: [{ x: -4, y: 18, z: -4, w: 8, h: 8, d: 8, u: 0, v: 0 }],
      leg0: [{ x: -4, y: 0, z: -6, w: 4, h: 6, d: 4, u: 0, v: 16 }],
      leg1: [{ x: 0, y: 0, z: -6, w: 4, h: 6, d: 4, u: 0, v: 16 }],
      leg2: [{ x: -4, y: 0, z: 2, w: 4, h: 6, d: 4, u: 0, v: 16 }],
      leg3: [{ x: 0, y: 0, z: 2, w: 4, h: 6, d: 4, u: 0, v: 16 }],
    },
  },
};

/**
 * Builds GPU-ready geometry for one model, split into named parts so the
 * animator can transform each independently.
 *
 * @returns {{parts: Array<{name: string, offset: number, count: number}>, data: Float32Array}}
 */
export function buildModelGeometry(model) {
  const floats = [];
  const parts = [];
  for (const [name, boxes] of Object.entries(model.parts)) {
    const start = floats.length / 8;
    for (const box of boxes) unwrapBox(floats, box, model.texW, model.texH);
    parts.push({ name, offset: start, count: floats.length / 8 - start });
  }
  return { parts, data: new Float32Array(floats) };
}

/** Floats per vertex in the built geometry: position, uv, normal. */
export const MODEL_FLOATS_PER_VERTEX = 8;
export { ENTITY_VERTEX_STRIDE };
