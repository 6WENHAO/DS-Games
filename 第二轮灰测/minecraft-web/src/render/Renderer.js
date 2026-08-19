/* =====================================================================
 * Renderer — 渲染总控
 *   · 管理 section 网格的构建队列（带时间预算）
 *   · 三个渲染层 + 视锥剔除 + 距离排序
 *   · 天空 / 云 / 实体 / 粒子 / 选择框 / 破坏裂纹 / 手持物品
 * ===================================================================== */
import { GLContext, Program, Mesh, makeQuadIndices } from './GL.js';
import { chunkVS, chunkFS, blockVS, blockFS, lineVS, lineFS } from './Shaders.js';
import { TextureAtlas } from './TextureAtlas.js';
import { SkyRenderer } from './SkyRenderer.js';
import { meshSection, VERTEX_STRIDE } from '../world/ChunkMesher.js';
import { LAYER, SECTION_COUNT, SECTION_HEIGHT, CHUNK_SIZE } from '../core/Constants.js';
import { STATE } from '../world/Chunk.js';
import settings from '../core/Settings.js';
import * as Mat4 from '../math/Mat4.js';

const MAX_QUADS_PER_MESH = 32768;

const CHUNK_LAYOUT = [
  { name: 'aPos', size: 3, offset: 0, stride: VERTEX_STRIDE },
  { name: 'aUV', size: 3, offset: 12, stride: VERTEX_STRIDE },
  { name: 'aData', size: 1, offset: 24, stride: VERTEX_STRIDE },
];

export class Renderer {
  constructor(canvas) {
    this.glc = new GLContext(canvas, { antialias: false });
    const glc = this.glc;
    const gl = glc.gl;

    this.atlas = new TextureAtlas(glc).build();
    this.sky = new SkyRenderer(glc, this.atlas);

    this.chunkProgram = new Program(glc, chunkVS, chunkFS, 'chunk');
    this.blockProgram = new Program(glc, blockVS, blockFS, 'block');
    this.lineProgram = new Program(glc, lineVS, lineFS, 'line');

    // 共享四边形索引缓冲
    this.sharedIbo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sharedIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, makeQuadIndices(MAX_QUADS_PER_MESH), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // 线框立方体
    this.outlineMesh = new Mesh(glc, [{ name: 'aPos', size: 3, offset: 0, stride: 12 }]);
    this.outlineMesh.upload(this.lineProgram, buildWireCube());

    // 单方块立方体（破坏裂纹 / 手持）
    this.cubeMesh = new Mesh(glc, CHUNK_LAYOUT);
    this._cubeMeshBlockId = -1;

    this.stats = {
      drawCalls: 0, triangles: 0, meshedThisFrame: 0,
      visibleSections: 0, meshQueue: 0, gpuMemMB: 0,
    };
    this._gpuBytes = 0;
    this._visible = [];
    this._translucent = [];
    this.time = 0;
    this.underwater = false;
  }

  get gl() { return this.glc.gl; }

  resize(w, h) {
    const scale = settings.get('resolutionScale') / 100;
    return this.glc.resize(w, h, scale);
  }

  /* ================= 网格构建 ================= */

  /**
   * 消耗 world.dirtySections，最多花费 budgetMs 毫秒
   */
  buildMeshes(world, camera, budgetMs = 6) {
    this.stats.meshedThisFrame = 0;
    const set = world.dirtySections;
    if (set.size === 0) { this.stats.meshQueue = 0; return; }

    // 按距离排序（每帧取最近的一批）
    const cx0 = Math.floor(camera.position[0]) >> 4;
    const cz0 = Math.floor(camera.position[2]) >> 4;
    const list = [];
    for (const key of set) {
      const p = key.split(',');
      const cx = +p[0], cz = +p[1], si = +p[2];
      const dx = cx - cx0, dz = cz - cz0;
      list.push({ key, cx, cz, si, d: dx * dx + dz * dz });
    }
    list.sort((a, b) => a.d - b.d);
    this.stats.meshQueue = list.length;

    const deadline = performance.now() + budgetMs;
    let processed = 0;
    for (const item of list) {
      if (processed > 0 && performance.now() > deadline) break;
      const chunk = world.getChunk(item.cx, item.cz);
      if (!chunk) { set.delete(item.key); continue; }
      if (!world.canMesh(chunk)) continue;      // 保留在集合里，等邻居就绪
      set.delete(item.key);
      chunk.sectionDirty[item.si] = 0;
      this._buildSection(world, chunk, item.si);
      processed++;
      this.stats.meshedThisFrame++;
    }
  }

  _buildSection(world, chunk, si) {
    const results = meshSection(world, chunk, si);
    const slot = chunk.meshes[si];
    for (let l = 0; l < LAYER.COUNT; l++) {
      const res = results[l];
      if (!res || res.quads === 0) {
        if (slot[l]) {
          this._gpuBytes -= slot[l].byteSize;
          slot[l].destroy();
          slot[l] = null;
        }
        continue;
      }
      let mesh = slot[l];
      if (!mesh) {
        mesh = new Mesh(this.glc, CHUNK_LAYOUT);
        slot[l] = mesh;
      } else {
        this._gpuBytes -= mesh.byteSize;
      }
      const quads = Math.min(res.quads, MAX_QUADS_PER_MESH);
      mesh.uploadShared(this.chunkProgram, res.vertices, this.sharedIbo, quads * 6);
      this._gpuBytes += mesh.byteSize;
    }
  }

  /** 丢弃一个区块的全部网格 */
  dropChunk(chunk) {
    for (let si = 0; si < SECTION_COUNT; si++) {
      const slot = chunk.meshes[si];
      for (let l = 0; l < LAYER.COUNT; l++) {
        if (slot[l]) { this._gpuBytes -= slot[l].byteSize; slot[l].destroy(); slot[l] = null; }
      }
    }
  }

  /* ================= 渲染 ================= */

  render(world, camera, ctx) {
    const glc = this.glc, gl = glc.gl;
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;
    this.time += ctx.dt;

    const rd = settings.get('renderDistance');
    const fogOn = settings.get('fog');
    const far = rd * CHUNK_SIZE;
    this.underwater = ctx.underwater;

    const biomeFog = ctx.biomeFog || null;
    this.sky.update(world, camera, biomeFog);

    // 雾参数
    let fogStart, fogEnd, fogColor;
    if (ctx.underwater) {
      fogStart = 0.2; fogEnd = 22;
      fogColor = [0.10, 0.28, 0.55];
    } else if (world.weather !== 'clear') {
      fogStart = far * 0.30; fogEnd = far * 0.85;
      fogColor = this.sky.fogColor;
    } else {
      fogStart = fogOn ? far * 0.72 : far * 4;
      fogEnd = fogOn ? far * 0.95 : far * 5;
      fogColor = this.sky.fogColor;
    }
    this._fog = { start: fogStart, end: fogEnd, color: fogColor };

    glc.clear(fogColor[0], fogColor[1], fogColor[2], 1);

    // ---------- 天空 ----------
    this.sky.render(world, camera, ctx.underwater);

    // ---------- 收集可见 section ----------
    this._collectVisible(world, camera, far);

    const daylight = world.daylight;
    const minLight = 0.03 + (settings.get('brightness') / 100) * 0.22;
    const smooth = settings.get('smoothLighting') ? 1 : 0;

    this.atlas.bind(0);
    const p = this.chunkProgram.use()
      .m4('uProj', camera.proj)
      .m4('uView', camera.view)
      .i('uTex', 0)
      .f('uDaylight', daylight)
      .f('uMinLight', minLight)
      .f('uTime', this.time)
      .f('uSmooth', smooth)
      .v3('uFogColor', fogColor[0], fogColor[1], fogColor[2])
      .f('uFogStart', fogStart)
      .f('uFogEnd', fogEnd)
      .i('uUnderwater', ctx.underwater ? 1 : 0)
      .f('uAlpha', 1)
      .f('uWave', 0);

    // ---------- 不透明层 ----------
    glc.setBlend(false);
    glc.setDepthMask(true);
    glc.setCull(true, gl.BACK);
    p.i('uCutout', 0);
    this._drawLayer(LAYER.OPAQUE, p);

    // ---------- 镂空层（树叶/玻璃/植物） ----------
    p.i('uCutout', 1);
    glc.setCull(false);
    this._drawLayer(LAYER.CUTOUT, p);
    glc.setCull(true, gl.BACK);

    return p;
  }

  /** 半透明层要在实体/粒子之后绘制 */
  renderTranslucent(world, camera) {
    const glc = this.glc, gl = glc.gl;
    if (this._translucent.length === 0) return;
    const fog = this._fog;
    this.atlas.bind(0);
    const p = this.chunkProgram.use()
      .m4('uProj', camera.proj)
      .m4('uView', camera.view)
      .i('uTex', 0)
      .f('uDaylight', world.daylight)
      .f('uMinLight', 0.03 + (settings.get('brightness') / 100) * 0.22)
      .f('uTime', this.time)
      .f('uSmooth', settings.get('smoothLighting') ? 1 : 0)
      .v3('uFogColor', fog.color[0], fog.color[1], fog.color[2])
      .f('uFogStart', fog.start)
      .f('uFogEnd', fog.end)
      .i('uUnderwater', this.underwater ? 1 : 0)
      .i('uCutout', 0)
      .f('uAlpha', 1)
      .f('uWave', 1);

    glc.setBlend(true, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    glc.setDepthMask(false);
    // 开启背面剔除：冰等透明完整立方体不再显示内表面（内外反转）。
    // 液体由网格双面输出（正 + 反绕序）保证从内侧仍可见。
    glc.setCull(true, gl.BACK);

    // 由远及近
    this._translucent.sort((a, b) => b.d - a.d);
    for (const s of this._translucent) {
      const mesh = s.chunk.meshes[s.si][LAYER.TRANSLUCENT];
      if (!mesh) continue;
      p.v3('uChunkOffset', s.chunk.originX, 0, s.chunk.originZ);
      this.stats.triangles += mesh.draw();
      this.stats.drawCalls++;
    }

    glc.setDepthMask(true);
    glc.setCull(true, gl.BACK);
    glc.setBlend(false);
  }

  _collectVisible(world, camera, far) {
    this._visible.length = 0;
    this._translucent.length = 0;
    const f = camera.frustum;
    const ex = camera.eye[0], ey = camera.eye[1], ez = camera.eye[2];
    const farSq = (far + 24) * (far + 24);

    for (const chunk of world.chunks.values()) {
      if (chunk.state < STATE.LIT) continue;
      const bx = chunk.originX, bz = chunk.originZ;
      const dx = bx + 8 - ex, dz = bz + 8 - ez;
      const dsq = dx * dx + dz * dz;
      if (dsq > farSq) continue;
      if (!f.intersectsBox(bx, 0, bz, bx + CHUNK_SIZE, 128, bz + CHUNK_SIZE)) continue;

      for (let si = 0; si < SECTION_COUNT; si++) {
        const slot = chunk.meshes[si];
        if (!slot[0] && !slot[1] && !slot[2]) continue;
        const y0 = si * SECTION_HEIGHT;
        if (!f.intersectsBox(bx, y0, bz, bx + CHUNK_SIZE, y0 + SECTION_HEIGHT, bz + CHUNK_SIZE)) continue;
        const dy = y0 + 8 - ey;
        const d3 = dsq + dy * dy;
        this._visible.push({ chunk, si, d: d3 });
        if (slot[LAYER.TRANSLUCENT]) this._translucent.push({ chunk, si, d: d3 });
      }
    }
    this._visible.sort((a, b) => a.d - b.d);
    this.stats.visibleSections = this._visible.length;
  }

  _drawLayer(layer, program) {
    let lastChunk = null;
    for (const s of this._visible) {
      const mesh = s.chunk.meshes[s.si][layer];
      if (!mesh) continue;
      if (lastChunk !== s.chunk) {
        program.v3('uChunkOffset', s.chunk.originX, 0, s.chunk.originZ);
        lastChunk = s.chunk;
      }
      this.stats.triangles += mesh.draw();
      this.stats.drawCalls++;
    }
  }

  /* ================= 选择框 / 破坏裂纹 ================= */

  renderSelection(camera, hit, progress) {
    if (!hit) return;
    const glc = this.glc, gl = glc.gl;
    const model = Mat4.create();

    // 线框
    glc.setBlend(true, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    glc.setDepthMask(false);
    const s = 1.002;
    Mat4.fromTranslation(model, hit.x - 0.001, hit.y - 0.001, hit.z - 0.001);
    Mat4.scale(model, model, s, s, s);
    this.lineProgram.use()
      .m4('uProj', camera.proj)
      .m4('uView', camera.view)
      .m4('uModel', model)
      .v4('uColor', 0, 0, 0, 0.42);
    gl.lineWidth(2);
    this.outlineMesh.draw(gl.LINES);
    this.stats.drawCalls++;

    // 裂纹
    if (progress > 0.001) {
      const stage = Math.min(9, Math.floor(progress * 10));
      const layer = this.atlas.layer('destroy_stage_' + stage);
      this._ensureCubeMesh();
      const sc = 1.004;
      Mat4.fromTranslation(model, hit.x - 0.002, hit.y - 0.002, hit.z - 0.002);
      Mat4.scale(model, model, sc, sc, sc);
      this.atlas.bind(0);
      this.blockProgram.use()
        .m4('uProj', camera.proj)
        .m4('uView', camera.view)
        .m4('uModel', model)
        .i('uTex', 0)
        .f('uLight', 1)
        .f('uLayerOverride', layer)
        .i('uCutout', 1)
        .v4('uTint', 1, 1, 1, 0.92)
        .v3('uFogColor', 0, 0, 0)
        .f('uFogStart', 9999)
        .f('uFogEnd', 10000);
      this.cubeMesh.draw();
      this.stats.drawCalls++;
    }

    glc.setDepthMask(true);
    glc.setBlend(false);
  }

  _ensureCubeMesh() {
    if (this._cubeMeshBlockId === 0) return;
    // 生成一个 uv 为 0..1 的标准立方体（层由 uLayerOverride 覆盖）
    const verts = [];
    const FACES_LOCAL = [
      // origin, du, dv per face (与 Constants.FACES 一致)
      [[1, 0, 1], [0, 0, -1], [0, 1, 0], 0],
      [[0, 0, 0], [0, 0, 1], [0, 1, 0], 1],
      [[0, 1, 1], [1, 0, 0], [0, 0, -1], 2],
      [[0, 0, 0], [1, 0, 0], [0, 0, 1], 3],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0], 4],
      [[1, 0, 0], [-1, 0, 0], [0, 1, 0], 5],
    ];
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const [o, du, dv, f] of FACES_LOCAL) {
      for (const [cu, cv] of corners) {
        verts.push(
          o[0] + du[0] * cu + dv[0] * cv,
          o[1] + du[1] * cu + dv[1] * cv,
          o[2] + du[2] * cu + dv[2] * cv,
          cu, 1 - cv, 0, f,
        );
      }
    }
    this.cubeMesh.uploadShared(this.blockProgram, new Float32Array(verts), this.sharedIbo, 6 * 6);
    this._cubeMeshBlockId = 0;
  }

  /** 调试线框盒（实体碰撞箱） */
  renderBox(camera, minX, minY, minZ, maxX, maxY, maxZ, color = [1, 1, 1, 0.6]) {
    const glc = this.glc, gl = glc.gl;
    const model = Mat4.create();
    Mat4.fromTranslation(model, minX, minY, minZ);
    Mat4.scale(model, model, maxX - minX, maxY - minY, maxZ - minZ);
    glc.setBlend(true, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    glc.setDepthMask(false);
    this.lineProgram.use()
      .m4('uProj', camera.proj)
      .m4('uView', camera.view)
      .m4('uModel', model)
      .v4('uColor', color[0], color[1], color[2], color[3]);
    this.outlineMesh.draw(gl.LINES);
    glc.setDepthMask(true);
    this.stats.drawCalls++;
  }

  get gpuMemoryMB() { return this._gpuBytes / 1048576; }
}

/** 单位立方体的 12 条棱（LINES） */
function buildWireCube() {
  const v = [
    [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1],
    [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const out = new Float32Array(edges.length * 6);
  let i = 0;
  for (const [a, b] of edges) {
    out[i++] = v[a][0]; out[i++] = v[a][1]; out[i++] = v[a][2];
    out[i++] = v[b][0]; out[i++] = v[b][1]; out[i++] = v[b][2];
  }
  return out;
}
