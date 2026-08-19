// Chunk streaming, block access, raycasting, persistence.
import * as THREE from 'three';
import { CH, CH_H, GW, PAD, PlanetGen, innerIdx, padIdx } from './worldgen.js';
import { meshChunk } from './mesher.js';
import { BLOCKS, BID, isOpaque } from './blocks.js';

const key = (cx, cz) => cx + ',' + cz;

export class World {
  constructor(planet, materials, scene, opts = {}) {
    this.planet = planet;
    this.gen = new PlanetGen(planet);
    this.scene = scene;
    this.matOpaque = materials.opaque;
    this.matAlpha = materials.alpha;
    this.chunks = new Map();
    this.editsByChunk = new Map(); // key -> [lx,y,lz,id,...]
    this.viewDist = opts.viewDist || 7;
    this.group = new THREE.Group();
    this.group.name = 'chunks';
    scene.add(this.group);
    this.queue = [];
    this.dirty = new Set();
    this.inflight = new Map();
    this.spawnQueue = [];
    this.onChunkReady = null;
    this.workers = [];
    this.workerBusy = [];
    this.ready = false;
    this.stats = { chunks: 0, tris: 0 };
    this._initWorkers(opts.workers || Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)));
  }

  _initWorkers(n) {
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('../workers/chunkWorker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => this._onWorkerMessage(i, e.data);
      w.postMessage({ type: 'init', planet: this.planet });
      this.workers.push(w);
      this.workerBusy.push(0);
    }
  }

  _onWorkerMessage(wi, msg) {
    if (msg.type === 'ready') { this.ready = true; return; }
    if (msg.type !== 'chunk') return;
    this.workerBusy[wi] = Math.max(0, this.workerBusy[wi] - 1);
    const k = key(msg.cx, msg.cz);
    this.inflight.delete(k);
    // discard if it drifted out of range
    const chunk = {
      cx: msg.cx, cz: msg.cz, key: k,
      voxels: msg.voxels, heights: msg.heights,
      meshOpaque: null, meshAlpha: null, spawned: false, spawns: msg.spawns,
    };
    this.chunks.set(k, chunk);
    this._applyMeshData(chunk, msg.opaque, msg.alpha);
    if (msg.spawns && msg.spawns.length) this.spawnQueue.push(...msg.spawns);
    if (this.onChunkReady) this.onChunkReady(chunk);
  }

  _buildGeometry(part) {
    if (!part.count) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(part.position, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(part.uv, 2));
    g.setAttribute('aLight', new THREE.BufferAttribute(part.light, 1, true));
    g.setAttribute('aEmit', new THREE.BufferAttribute(part.emit, 1, true));
    g.setAttribute('aSway', new THREE.BufferAttribute(part.sway, 1, true));
    g.setAttribute('aTint', new THREE.BufferAttribute(part.tint, 3, true));
    g.setIndex(new THREE.BufferAttribute(part.index, 1));
    g.computeBoundingSphere();
    return g;
  }

  _applyMeshData(chunk, opaquePart, alphaPart) {
    const px = chunk.cx * CH, pz = chunk.cz * CH;
    if (chunk.meshOpaque) { this.group.remove(chunk.meshOpaque); chunk.meshOpaque.geometry.dispose(); chunk.meshOpaque = null; }
    if (chunk.meshAlpha) { this.group.remove(chunk.meshAlpha); chunk.meshAlpha.geometry.dispose(); chunk.meshAlpha = null; }
    const go = this._buildGeometry(opaquePart);
    if (go) {
      const m = new THREE.Mesh(go, this.matOpaque);
      m.position.set(px, 0, pz);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      m.userData.chunk = chunk.key;
      this.group.add(m);
      chunk.meshOpaque = m;
    }
    const ga = this._buildGeometry(alphaPart);
    if (ga) {
      const m = new THREE.Mesh(ga, this.matAlpha);
      m.position.set(px, 0, pz);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      m.renderOrder = 10;
      this.group.add(m);
      chunk.meshAlpha = m;
    }
  }

  /** Queue chunk loads around a position, unload distant ones. */
  update(pos, maxRequests = 3) {
    this.flushDirty(1);
    const pcx = Math.floor(pos.x / CH), pcz = Math.floor(pos.z / CH);
    const R = this.viewDist;
    const wanted = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > (R + 0.5) * (R + 0.5)) continue;
        const cx = pcx + dx, cz = pcz + dz;
        const k = key(cx, cz);
        if (this.chunks.has(k) || this.inflight.has(k)) continue;
        wanted.push({ cx, cz, d2, k });
      }
    }
    wanted.sort((a, b) => a.d2 - b.d2);
    let sent = 0;
    for (const w of wanted) {
      if (sent >= maxRequests) break;
      const wi = this._pickWorker();
      if (wi < 0) break;
      const edits = this.editsByChunk.get(w.k);
      this.workers[wi].postMessage({ type: 'gen', cx: w.cx, cz: w.cz, edits: edits ? edits.slice() : null });
      this.workerBusy[wi]++;
      this.inflight.set(w.k, true);
      sent++;
    }
    // unload
    const unloadR = R + 2;
    for (const [k, chunk] of this.chunks) {
      const dx = chunk.cx - pcx, dz = chunk.cz - pcz;
      if (dx * dx + dz * dz > unloadR * unloadR) {
        if (chunk.meshOpaque) { this.group.remove(chunk.meshOpaque); chunk.meshOpaque.geometry.dispose(); }
        if (chunk.meshAlpha) { this.group.remove(chunk.meshAlpha); chunk.meshAlpha.geometry.dispose(); }
        this.chunks.delete(k);
      }
    }
    this.stats.chunks = this.chunks.size;
  }

  _pickWorker() {
    let best = -1, bestLoad = 99;
    for (let i = 0; i < this.workers.length; i++) {
      if (this.workerBusy[i] < bestLoad) { bestLoad = this.workerBusy[i]; best = i; }
    }
    return bestLoad >= 3 ? -1 : best;
  }

  isLoaded(x, z) { return this.chunks.has(key(Math.floor(x / CH), Math.floor(z / CH))); }

  loadedFraction(pos, radius = 3) {
    const pcx = Math.floor(pos.x / CH), pcz = Math.floor(pos.z / CH);
    let total = 0, have = 0;
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      total++;
      if (this.chunks.has(key(pcx + dx, pcz + dz))) have++;
    }
    return have / total;
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= CH_H) return 0;
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    const c = this.chunks.get(key(cx, cz));
    if (!c) return 0;
    const lx = x - cx * CH, lz = z - cz * CH;
    return c.voxels[innerIdx(lx, y, lz)];
  }

  /** Get block, generating the value on the fly if the chunk isn't loaded (slower). */
  getBlockOrGen(x, y, z) {
    const b = this.getBlock(x, y, z);
    if (b) return b;
    if (this.isLoaded(x, z)) return b;
    const h = this.gen.heightInt(x, z);
    if (y <= h) return BID.STONE;
    if (this.planet.terrain.water && y <= this.planet.terrain.sea) return BID.WATER;
    return 0;
  }

  setBlock(x, y, z, id, record = true) {
    if (y < 1 || y >= CH_H) return false;
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    const k = key(cx, cz);
    const c = this.chunks.get(k);
    if (!c) return false;
    const lx = x - cx * CH, lz = z - cz * CH;
    const i = innerIdx(lx, y, lz);
    if (c.voxels[i] === id) return false;
    c.voxels[i] = id;
    if (record) {
      let arr = this.editsByChunk.get(k);
      if (!arr) { arr = []; this.editsByChunk.set(k, arr); }
      arr.push(lx, y, lz, id);
    }
    this.markDirty(cx, cz);
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CH - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CH - 1) this.markDirty(cx, cz + 1);
    return true;
  }

  markDirty(cx, cz) { this.dirty.add(key(cx, cz)); }

  /** rebuild at most `budget` dirty chunk meshes (called once per frame) */
  flushDirty(budget = 2) {
    if (!this.dirty.size) return 0;
    let done = 0;
    for (const k of Array.from(this.dirty)) {
      if (done >= budget) break;
      this.dirty.delete(k);
      const c = this.chunks.get(k);
      if (!c) continue;
      this.remesh(c.cx, c.cz);
      done++;
    }
    return done;
  }

  buildPad(cx, cz) {
    const pad = new Uint8Array(GW * GW * CH_H);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.chunks.get(key(cx + dx, cz + dz));
        if (!c) continue;
        const x0 = dx * CH, z0 = dz * CH;
        const xa = Math.max(-PAD, x0), xb = Math.min(CH + PAD - 1, x0 + CH - 1);
        const za = Math.max(-PAD, z0), zb = Math.min(CH + PAD - 1, z0 + CH - 1);
        if (xa > xb || za > zb) continue;
        for (let y = 0; y < CH_H; y++) {
          for (let z = za; z <= zb; z++) {
            const srcZ = z - z0;
            const rowStart = innerIdx(xa - x0, y, srcZ);
            const len = xb - xa + 1;
            const dst = padIdx(xa, y, z);
            pad.set(c.voxels.subarray(rowStart, rowStart + len), dst);
          }
        }
      }
    }
    return pad;
  }

  remesh(cx, cz) {
    const c = this.chunks.get(key(cx, cz));
    if (!c) return;
    const pad = this.buildPad(cx, cz);
    const mesh = meshChunk(pad, cx, cz, this.planet.seed >>> 0);
    this._applyMeshData(c, mesh.opaque, mesh.alpha);
  }

  /** DDA voxel raycast. Returns {x,y,z,nx,ny,nz,id,dist} or null. */
  raycast(origin, dir, maxDist = 6, opts = {}) {
    const skipLiquid = opts.skipLiquid !== false;
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / (dir.x || 1e-9));
    const tDeltaY = Math.abs(1 / (dir.y || 1e-9));
    const tDeltaZ = Math.abs(1 / (dir.z || 1e-9));
    let tMaxX = ((dir.x > 0 ? x + 1 - origin.x : origin.x - x)) * tDeltaX;
    let tMaxY = ((dir.y > 0 ? y + 1 - origin.y : origin.y - y)) * tDeltaY;
    let tMaxZ = ((dir.z > 0 ? z + 1 - origin.z : origin.z - z)) * tDeltaZ;
    let nx = 0, ny = 0, nz = 0;
    let t = 0;
    for (let i = 0; i < 512; i++) {
      const id = this.getBlock(x, y, z);
      if (id) {
        const d = BLOCKS[id];
        const passable = (skipLiquid && id === BID.WATER);
        if (!passable) return { x, y, z, nx, ny, nz, id, dist: t };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
      if (t > maxDist) break;
      if (y < 0 || y >= CH_H) break;
    }
    return null;
  }

  solidAt(x, y, z) {
    const id = this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    if (!id) return false;
    const d = BLOCKS[id];
    return d.solid && d.collide;
  }

  blockAt(x, y, z) { return this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); }

  /** highest non-air block at column, using loaded data else generator */
  surfaceY(x, z) {
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    const c = this.chunks.get(key(cx, cz));
    if (c) {
      const lx = Math.floor(x) - cx * CH, lz = Math.floor(z) - cz * CH;
      for (let y = CH_H - 1; y > 0; y--) {
        const id = c.voxels[innerIdx(lx, y, lz)];
        if (id && BLOCKS[id].collide && BLOCKS[id].solid) return y;
      }
      return 1;
    }
    return this.gen.heightInt(Math.floor(x), Math.floor(z));
  }

  serializeEdits() {
    const out = {};
    for (const [k, arr] of this.editsByChunk) out[k] = arr;
    return out;
  }

  loadEdits(obj) {
    if (!obj) return;
    this.editsByChunk = new Map(Object.entries(obj).map(([k, v]) => [k, v.slice()]));
  }

  dispose() {
    for (const w of this.workers) w.terminate();
    for (const [, c] of this.chunks) {
      if (c.meshOpaque) c.meshOpaque.geometry.dispose();
      if (c.meshAlpha) c.meshAlpha.geometry.dispose();
    }
    this.chunks.clear();
    this.scene.remove(this.group);
  }
}
