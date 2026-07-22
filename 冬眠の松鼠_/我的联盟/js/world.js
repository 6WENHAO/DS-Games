'use strict';
// ---------- 体素世界：数据 / 地形生成 / 贴图 / 网格 / 射线 ----------
const SX = 128, SY = 48, SZ = 128;
const WATER_Y = 10;
const CHUNK = 16;
const CX_COUNT = SX / CHUNK, CZ_COUNT = SZ / CHUNK;

const B = { AIR:0, GRASS:1, DIRT:2, STONE:3, LOG:4, LEAF:5, SAND:6, WATER:7, PLANK:8, COBBLE:9, BEDROCK:10, GOLD:11 };
const BLOCK_NAME = {1:'草方块',2:'泥土',3:'石头',4:'原木',5:'树叶',6:'沙子',7:'水',8:'木板',9:'圆石',10:'基岩',11:'金矿石'};
const BLOCK_COLOR = {1:0x6fae43,2:0x86603f,3:0x7d7d7d,4:0x665132,5:0x3a7c23,6:0xdbcfa3,7:0x3456c9,8:0xb08f57,9:0x6e6e6e,10:0x3c3c3c,11:0xd8b234};

const world = new Uint8Array(SX * SY * SZ);
const bIdx = (x, y, z) => (y * SZ + z) * SX + x;

function getBlock(x, y, z){
  x |= 0; y |= 0; z |= 0;
  if(y < 0) return B.BEDROCK;
  if(y >= SY) return B.AIR;
  if(x < 0 || x >= SX || z < 0 || z >= SZ) return B.BEDROCK; // 世界边界墙
  return world[bIdx(x, y, z)];
}
function getBlockRay(x, y, z){
  if(y < 0) return B.BEDROCK;
  if(y >= SY) return B.AIR;
  if(x < 0 || x >= SX || z < 0 || z >= SZ) return B.AIR;
  return world[bIdx(x, y, z)];
}
function isSolid(id){ return id !== B.AIR && id !== B.WATER; }
function isOpaque(id){ return id !== B.AIR && id !== B.WATER; }

const dirtyChunks = new Set();
function markDirtyAt(x, z){
  const cx = clamp((x / CHUNK) | 0, 0, CX_COUNT - 1);
  const cz = clamp((z / CHUNK) | 0, 0, CZ_COUNT - 1);
  dirtyChunks.add(cx + '_' + cz);
}
function setBlock(x, y, z, id){
  x |= 0; y |= 0; z |= 0;
  if(x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return false;
  if(world[bIdx(x, y, z)] === id) return false;
  world[bIdx(x, y, z)] = id;
  markDirtyAt(x, z);
  if(x % CHUNK === 0) markDirtyAt(x - 1, z);
  if(x % CHUNK === CHUNK - 1) markDirtyAt(x + 1, z);
  if(z % CHUNK === 0) markDirtyAt(x, z - 1);
  if(z % CHUNK === CHUNK - 1) markDirtyAt(x, z + 1);
  return true;
}
function surfaceY(x, z){
  for(let y = SY - 1; y >= 0; y--){
    if(isSolid(getBlock(x, y, z))) return y;
  }
  return 0;
}

// ---------- 地形生成 ----------
function generateWorld(){
  for(let x = 0; x < SX; x++){
    for(let z = 0; z < SZ; z++){
      const n1 = fbm2(x * 0.022 + 31.7, z * 0.022 + 11.3, 4);
      const n2 = fbm2(x * 0.008 + 107.1, z * 0.008 + 331.9, 3);
      let h = Math.floor(3 + n1 * 15 + n2 * 16);
      h = clamp(h, 2, SY - 12);
      const beach = h <= WATER_Y + 1;
      for(let y = 0; y <= h; y++){
        let id;
        if(y === 0) id = B.BEDROCK;
        else if(y === h) id = beach ? B.SAND : B.GRASS;
        else if(y > h - 3) id = beach ? B.SAND : B.DIRT;
        else id = (hash2(x * 7 + y * 131, z * 13 + y * 57) < 0.012) ? B.GOLD : B.STONE;
        world[bIdx(x, y, z)] = id;
      }
      if(h < WATER_Y){
        for(let y = h + 1; y <= WATER_Y; y++) world[bIdx(x, y, z)] = B.WATER;
      }
    }
  }
  // 树
  for(let i = 0; i < 420; i++){
    const x = 3 + (seededRand() * (SX - 6)) | 0;
    const z = 3 + (seededRand() * (SZ - 6)) | 0;
    const h = surfaceY(x, z);
    if(getBlock(x, h, z) !== B.GRASS || h <= WATER_Y + 1 || h > SY - 10) continue;
    if(seededRand() < 0.55) continue;
    const th = 4 + (seededRand() * 2 | 0);
    for(let y = h + 1; y <= h + th; y++) world[bIdx(x, y, z)] = B.LOG;
    const ty = h + th;
    for(let dy = -2; dy <= 1; dy++){
      const r = dy < 0 ? 2 : 1;
      for(let dx = -r; dx <= r; dx++){
        for(let dz = -r; dz <= r; dz++){
          if(Math.abs(dx) === r && Math.abs(dz) === r && seededRand() < 0.6) continue;
          const bx = x + dx, by = ty + dy, bz = z + dz;
          if(bx < 0 || bx >= SX || bz < 0 || bz >= SZ || by >= SY) continue;
          if(world[bIdx(bx, by, bz)] === B.AIR) world[bIdx(bx, by, bz)] = B.LEAF;
        }
      }
    }
  }
}

// ---------- 贴图图集（程序生成像素风） ----------
const ATLAS_COLS = 8, ATLAS_ROWS = 8, TILE_PX = 16;
const TILE = { GRASS_TOP:0, GRASS_SIDE:1, DIRT:2, STONE:3, LOG_SIDE:4, LOG_TOP:5, LEAF:6, SAND:7, PLANK:8, COBBLE:9, BEDROCK:10, GOLD:11, WATER:12 };
let atlasCanvas = null, atlasTex = null, solidMat = null, waterMat = null;

function createAtlas(){
  const cv = document.createElement('canvas');
  cv.width = ATLAS_COLS * TILE_PX; cv.height = ATLAS_ROWS * TILE_PX;
  const ctx = cv.getContext('2d');
  const rng = mulberry32(9871);

  function tilePos(t){ return [(t % ATLAS_COLS) * TILE_PX, ((t / ATLAS_COLS) | 0) * TILE_PX]; }
  function fillTile(t, fn){
    const [ox, oy] = tilePos(t);
    for(let j = 0; j < TILE_PX; j++){
      for(let i = 0; i < TILE_PX; i++){
        const c = fn(i, j, rng);
        ctx.fillStyle = 'rgb(' + (c[0]|0) + ',' + (c[1]|0) + ',' + (c[2]|0) + ')';
        ctx.fillRect(ox + i, oy + j, 1, 1);
      }
    }
  }
  const vary = (base, v, r) => {
    const d = (r() - 0.5) * 2 * v;
    return [base[0] + d, base[1] + d, base[2] + d];
  };

  fillTile(TILE.GRASS_TOP, (i,j,r)=> vary([106,170,64], 14, r));
  fillTile(TILE.DIRT,      (i,j,r)=> vary([134,96,67], 12, r));
  fillTile(TILE.GRASS_SIDE,(i,j,r)=> j < 3 ? vary([106,170,64], 14, r) : (j === 3 && r() < 0.5 ? vary([106,170,64], 14, r) : vary([134,96,67], 12, r)));
  fillTile(TILE.STONE,     (i,j,r)=> vary([125,125,125], 9, r));
  fillTile(TILE.LOG_SIDE,  (i,j,r)=> (i % 4 === 0) ? vary([82,64,38], 6, r) : vary([104,82,50], 7, r));
  fillTile(TILE.LOG_TOP,   (i,j,r)=>{
    const d = Math.max(Math.abs(i - 7.5), Math.abs(j - 7.5));
    return (d|0) % 2 === 0 ? vary([140,113,70], 6, r) : vary([116,92,55], 6, r);
  });
  fillTile(TILE.LEAF,      (i,j,r)=> r() < 0.14 ? vary([32,72,20], 8, r) : vary([58,124,35], 16, r));
  fillTile(TILE.SAND,      (i,j,r)=> vary([219,207,163], 9, r));
  fillTile(TILE.PLANK,     (i,j,r)=> (j % 4 === 3) ? vary([116,92,55], 5, r) : vary([176,143,87], 7, r));
  fillTile(TILE.COBBLE,    (i,j,r)=>{
    const n = vnoise2(i * 0.55 + 3, j * 0.55 + 9);
    return n < 0.42 ? vary([84,84,84], 7, r) : vary([118,118,118], 9, r);
  });
  fillTile(TILE.BEDROCK,   (i,j,r)=> vary([58,58,58], 26, r));
  fillTile(TILE.GOLD,      (i,j,r)=>{
    const spot = hash2(i * 3 + 11, j * 3 + 77) < 0.22;
    return spot ? vary([250,200,60], 15, r) : vary([125,125,125], 9, r);
  });
  fillTile(TILE.WATER,     (i,j,r)=> vary([52,92,205], 14, r));
  return cv;
}

function faceTile(id, f){ // f: 0:-x 1:+x 2:-y 3:+y 4:-z 5:+z
  switch(id){
    case B.GRASS: return f === 3 ? TILE.GRASS_TOP : (f === 2 ? TILE.DIRT : TILE.GRASS_SIDE);
    case B.DIRT: return TILE.DIRT;
    case B.STONE: return TILE.STONE;
    case B.LOG: return (f === 2 || f === 3) ? TILE.LOG_TOP : TILE.LOG_SIDE;
    case B.LEAF: return TILE.LEAF;
    case B.SAND: return TILE.SAND;
    case B.WATER: return TILE.WATER;
    case B.PLANK: return TILE.PLANK;
    case B.COBBLE: return TILE.COBBLE;
    case B.BEDROCK: return TILE.BEDROCK;
    case B.GOLD: return TILE.GOLD;
  }
  return TILE.STONE;
}

// ---------- 区块网格 ----------
const FACES = [
  { dir:[-1, 0, 0], corners:[ {pos:[0,1,0],uv:[0,1]},{pos:[0,0,0],uv:[0,0]},{pos:[0,1,1],uv:[1,1]},{pos:[0,0,1],uv:[1,0]} ] },
  { dir:[ 1, 0, 0], corners:[ {pos:[1,1,1],uv:[0,1]},{pos:[1,0,1],uv:[0,0]},{pos:[1,1,0],uv:[1,1]},{pos:[1,0,0],uv:[1,0]} ] },
  { dir:[ 0,-1, 0], corners:[ {pos:[1,0,1],uv:[1,0]},{pos:[0,0,1],uv:[0,0]},{pos:[1,0,0],uv:[1,1]},{pos:[0,0,0],uv:[0,1]} ] },
  { dir:[ 0, 1, 0], corners:[ {pos:[0,1,1],uv:[1,1]},{pos:[1,1,1],uv:[0,1]},{pos:[0,1,0],uv:[1,0]},{pos:[1,1,0],uv:[0,0]} ] },
  { dir:[ 0, 0,-1], corners:[ {pos:[1,0,0],uv:[0,0]},{pos:[0,0,0],uv:[1,0]},{pos:[1,1,0],uv:[0,1]},{pos:[0,1,0],uv:[1,1]} ] },
  { dir:[ 0, 0, 1], corners:[ {pos:[0,0,1],uv:[0,0]},{pos:[1,0,1],uv:[1,0]},{pos:[0,1,1],uv:[0,1]},{pos:[1,1,1],uv:[1,1]} ] },
];
const FACE_BRIGHT = [0.72, 0.72, 0.5, 1.0, 0.85, 0.85];
const UV_INSET = 0.02;

const chunkMeshes = {};
let worldScene = null;

function initWorldMeshes(scene){
  worldScene = scene;
  atlasCanvas = createAtlas();
  atlasTex = new THREE.CanvasTexture(atlasCanvas);
  atlasTex.magFilter = THREE.NearestFilter;
  atlasTex.minFilter = THREE.NearestFilter;
  atlasTex.generateMipmaps = false;
  solidMat = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true });
  waterMat = new THREE.MeshLambertMaterial({ map: atlasTex, transparent: true, opacity: 0.72, depthWrite: false });
  for(let cx = 0; cx < CX_COUNT; cx++){
    for(let cz = 0; cz < CZ_COUNT; cz++) buildChunk(cx, cz);
  }
}

function buildChunk(cx, cz){
  const key = cx + '_' + cz;
  const old = chunkMeshes[key];
  if(old){
    if(old.solid){ worldScene.remove(old.solid); old.solid.geometry.dispose(); }
    if(old.water){ worldScene.remove(old.water); old.water.geometry.dispose(); }
  }
  const S = { pos:[], nrm:[], uv:[], col:[], idx:[] };
  const W = { pos:[], nrm:[], uv:[], col:[], idx:[] };
  const x0 = cx * CHUNK, z0 = cz * CHUNK;

  for(let x = x0; x < x0 + CHUNK; x++){
    for(let z = z0; z < z0 + CHUNK; z++){
      for(let y = 0; y < SY; y++){
        const b = world[bIdx(x, y, z)];
        if(b === B.AIR) continue;
        const isW = b === B.WATER;
        const T = isW ? W : S;
        for(let f = 0; f < 6; f++){
          const face = FACES[f];
          const n = getBlock(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
          if(isW){ if(n !== B.AIR) continue; }
          else if(isOpaque(n)) continue;
          const tile = faceTile(b, f);
          const tc = tile % ATLAS_COLS, tr = (tile / ATLAS_COLS) | 0;
          const base = T.pos.length / 3;
          const br = isW ? 1.0 : FACE_BRIGHT[f];
          for(let ci = 0; ci < 4; ci++){
            const c = face.corners[ci];
            T.pos.push(x + c.pos[0], y + c.pos[1], z + c.pos[2]);
            T.nrm.push(face.dir[0], face.dir[1], face.dir[2]);
            const u = (tc + UV_INSET + c.uv[0] * (1 - 2 * UV_INSET)) / ATLAS_COLS;
            const v = 1 - (tr + 1 - (UV_INSET + c.uv[1] * (1 - 2 * UV_INSET))) / ATLAS_ROWS;
            T.uv.push(u, v);
            T.col.push(br, br, br);
          }
          T.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
      }
    }
  }
  const entry = { solid: null, water: null };
  if(S.idx.length){
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(S.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(S.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(S.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(S.col, 3));
    g.setIndex(S.idx);
    const m = new THREE.Mesh(g, solidMat);
    m.matrixAutoUpdate = false;
    worldScene.add(m);
    entry.solid = m;
  }
  if(W.idx.length){
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(W.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(W.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(W.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(W.col, 3));
    g.setIndex(W.idx);
    const m = new THREE.Mesh(g, waterMat);
    m.renderOrder = 1;
    m.matrixAutoUpdate = false;
    worldScene.add(m);
    entry.water = m;
  }
  chunkMeshes[key] = entry;
}

function processDirtyChunks(){
  if(dirtyChunks.size === 0) return;
  for(const key of dirtyChunks){
    const [cx, cz] = key.split('_').map(Number);
    buildChunk(cx, cz);
  }
  dirtyChunks.clear();
}

// ---------- 体素射线 (DDA) ----------
function raycastVoxel(o, d, maxDist){
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const b0 = getBlockRay(x, y, z);
  if(isSolid(b0)) return { x, y, z, px: x, py: y, pz: z, dist: 0, block: b0 };
  const stepX = d.x > 0 ? 1 : -1, stepY = d.y > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
  const tdx = d.x !== 0 ? Math.abs(1 / d.x) : Infinity;
  const tdy = d.y !== 0 ? Math.abs(1 / d.y) : Infinity;
  const tdz = d.z !== 0 ? Math.abs(1 / d.z) : Infinity;
  let tmx = d.x !== 0 ? ((d.x > 0 ? (x + 1 - o.x) : (o.x - x)) * tdx) : Infinity;
  let tmy = d.y !== 0 ? ((d.y > 0 ? (y + 1 - o.y) : (o.y - y)) * tdy) : Infinity;
  let tmz = d.z !== 0 ? ((d.z > 0 ? (z + 1 - o.z) : (o.z - z)) * tdz) : Infinity;
  let px = x, py = y, pz = z, t = 0;
  for(let i = 0; i < 512; i++){
    px = x; py = y; pz = z;
    if(tmx <= tmy && tmx <= tmz){ x += stepX; t = tmx; tmx += tdx; }
    else if(tmy <= tmz){ y += stepY; t = tmy; tmy += tdy; }
    else { z += stepZ; t = tmz; tmz += tdz; }
    if(t > maxDist) return null;
    if(y < -2) return null;
    const b = getBlockRay(x, y, z);
    if(isSolid(b)) return { x, y, z, px, py, pz, dist: t, block: b };
  }
  return null;
}

// ---------- 爆炸破坏地形 ----------
function explodeTerrain(cx, cy, cz, radius){
  let count = 0;
  const r2 = radius * radius;
  for(let x = Math.floor(cx - radius); x <= Math.floor(cx + radius); x++){
    for(let y = Math.floor(cy - radius); y <= Math.floor(cy + radius); y++){
      for(let z = Math.floor(cz - radius); z <= Math.floor(cz + radius); z++){
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dz = z + 0.5 - cz;
        if(dx * dx + dy * dy + dz * dz > r2) continue;
        const b = getBlock(x, y, z);
        if(b === B.AIR || b === B.WATER || b === B.BEDROCK) continue;
        setBlock(x, y, z, B.AIR);
        count++;
      }
    }
  }
  return count;
}
