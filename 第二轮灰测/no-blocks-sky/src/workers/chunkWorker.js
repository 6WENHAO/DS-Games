// Chunk generation + meshing worker.
import { PlanetGen } from '../world/worldgen.js';
import { meshChunk } from '../world/mesher.js';

let gen = null;
let planetSeed = 0;

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    gen = new PlanetGen(msg.planet);
    planetSeed = msg.planet.seed >>> 0;
    self.postMessage({ type: 'ready' });
    return;
  }
  if (msg.type === 'gen' && gen) {
    const { cx, cz, edits } = msg;
    const out = gen.genChunk(cx, cz);
    // apply persisted edits before meshing
    if (edits && edits.length) {
      for (let i = 0; i < edits.length; i += 4) {
        const x = edits[i], y = edits[i + 1], z = edits[i + 2], id = edits[i + 3];
        if (y < 0 || y >= 128) continue;
        out.voxels[x + 16 * (z + 16 * y)] = id;
        out.pad[(x + 1) + 18 * ((z + 1) + 18 * y)] = id;
      }
    }
    const mesh = meshChunk(out.pad, cx, cz, planetSeed);
    const transfers = [out.voxels.buffer, out.heights.buffer];
    for (const part of [mesh.opaque, mesh.alpha]) {
      transfers.push(part.position.buffer, part.uv.buffer, part.light.buffer, part.emit.buffer, part.sway.buffer, part.tint.buffer, part.index.buffer);
    }
    self.postMessage({
      type: 'chunk', cx, cz,
      voxels: out.voxels, heights: out.heights, spawns: out.spawns,
      opaque: mesh.opaque, alpha: mesh.alpha,
    }, transfers);
  }
};
