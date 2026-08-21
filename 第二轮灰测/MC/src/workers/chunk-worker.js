/**
 * workers/chunk-worker.js
 * ------------------------------------------------------------------
 * Module web worker that does the two expensive jobs off the main
 * thread: terrain generation and chunk meshing.
 *
 * Protocol
 *   -> { type: 'init', seed, layerTable }
 *   -> { type: 'layers', layerTable }                  (after textures load)
 *   -> { type: 'generate', id, cx, cz }
 *   <- { id, cx, cz, blocks, biomes, heights }         (buffers transferred)
 *   -> { type: 'mesh', id, cx, cz, blocks, light, biomes }
 *   <- { id, cx, cz, opaque, cutout, translucent, blocks, light, biomes }
 *
 * Mesh jobs hand their scratch buffers back so the main thread can
 * recycle them instead of allocating ~130 KB per chunk.
 */

import { CHUNK_SIZE, CHUNK_VOLUME } from '../world/constants.js';
import { TerrainGenerator } from '../world/terrain.js';
import { ChunkMesher } from '../world/mesher.js';

/** @type {TerrainGenerator|null} */
let generator = null;
/** @type {ChunkMesher|null} */
let mesher = null;

/** Reusable generation output so repeated jobs do not allocate. */
let genBlocks = null;
let genBiomes = null;
let genHeights = null;

function ensureGenBuffers() {
  if (!genBlocks) {
    genBlocks = new Uint16Array(CHUNK_VOLUME);
    genBiomes = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    genHeights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
  }
}

/** Rebuilds the mesher when the texture layer table arrives or changes. */
function setLayerTable(layerTable) {
  if (!layerTable) return;
  const table = {
    faceLayers: new Int16Array(layerTable.faceLayers),
    grassSideLayers: new Int16Array(layerTable.grassSideLayers),
    snowSideLayer: layerTable.snowSideLayer,
    animGroups: new Uint8Array(layerTable.animGroups),
  };
  if (mesher) mesher.setLayerTable(table);
  else mesher = new ChunkMesher(table);
}

/**
 * Handles one message. Exported so the main thread can reuse the exact
 * same logic when workers are unavailable.
 */
export function handleMessage(msg) {
  switch (msg.type) {
    case 'init': {
      generator = new TerrainGenerator(msg.seed, { type: msg.worldType });
      setLayerTable(msg.layerTable);
      return { ok: true };
    }

    case 'layers': {
      setLayerTable(msg.layerTable);
      return { ok: true };
    }

    case 'generate': {
      if (!generator) throw new Error('worker not initialised');
      ensureGenBuffers();
      generator.generate(msg.cx, msg.cz, {
        blocks: genBlocks, biomes: genBiomes, heights: genHeights,
      });
      // Copy out: the caller takes ownership, we keep our scratch.
      return {
        cx: msg.cx,
        cz: msg.cz,
        blocks: genBlocks.slice(),
        biomes: genBiomes.slice(),
        heights: genHeights.slice(),
      };
    }

    case 'mesh': {
      if (!mesher) throw new Error('mesher has no texture layer table yet');
      const result = mesher.mesh({
        blocks: msg.blocks, light: msg.light, biomes: msg.biomes,
      });
      return {
        cx: msg.cx,
        cz: msg.cz,
        revision: msg.revision,
        opaque: result.opaque,
        cutout: result.cutout,
        translucent: result.translucent,
        // hand the scratch buffers back for recycling
        blocks: msg.blocks,
        light: msg.light,
        biomes: msg.biomes,
      };
    }

    default:
      throw new Error(`unknown message type ${msg.type}`);
  }
}

/** Collects the transferable buffers from a result object. */
function transfersFor(result) {
  const list = [];
  for (const key of ['blocks', 'light', 'biomes', 'heights']) {
    const v = result[key];
    if (v?.buffer) list.push(v.buffer);
  }
  for (const key of ['opaque', 'cutout', 'translucent']) {
    const v = result[key];
    if (v?.buffer) list.push(v.buffer);
  }
  return list;
}

// Only wire up the message port when actually running inside a worker.
if (typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined'
  && self instanceof WorkerGlobalScope) {
  self.onmessage = (ev) => {
    const msg = ev.data;
    try {
      const result = handleMessage(msg);
      if (msg.type === 'init' || msg.type === 'layers') {
        self.postMessage({ id: msg.id, ...result });
        return;
      }
      self.postMessage({ id: msg.id, ...result }, transfersFor(result));
    } catch (err) {
      self.postMessage({ id: msg.id, error: err?.message ?? String(err) });
    }
  };
}
