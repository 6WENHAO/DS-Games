/* =====================================================================
 * EntityRenderer — 生物盒子模型、掉落物、粒子、手持物品、第三人称玩家
 * ===================================================================== */
import { Program, Mesh } from './GL.js';
import { entityVS, entityFS, blockVS, blockFS, particleVS, particleFS } from './Shaders.js';
import { buildBlockCubeMesh, buildFlatItemMesh, VERTEX_STRIDE } from '../world/ChunkMesher.js';
import { PARTICLE_FLOATS_PER_VERTEX } from '../game/Particles.js';
import { BLOCKS, blockByName } from '../data/blocks.js';
import { getItem } from '../data/items.js';
import { hexToRgb, clamp01, lerp } from '../math/MathUtils.js';
import * as Mat4 from '../math/Mat4.js';
import settings from '../core/Settings.js';

const PARTICLE_STRIDE = PARTICLE_FLOATS_PER_VERTEX * 4;

/** 玩家（史蒂夫）模型 */
const PLAYER_PARTS = [
  { name: 'legL', size: [0.25, 0.75, 0.25], pos: [0.125, 0.375, 0], color: '#2a3a8f', anim: 'legFL' },
  { name: 'legR', size: [0.25, 0.75, 0.25], pos: [-0.125, 0.375, 0], color: '#2a3a8f', anim: 'legFR' },
  { name: 'body', size: [0.5, 0.75, 0.25], pos: [0, 1.125, 0], color: '#00a8a8', anim: null },
  { name: 'head', size: [0.5, 0.5, 0.5], pos: [0, 1.75, 0], color: '#c99e6d', anim: 'head' },
  { name: 'hair', size: [0.52, 0.16, 0.52], pos: [0, 1.94, 0], color: '#3f2a15', anim: 'head' },
  { name: 'armL', size: [0.25, 0.75, 0.25], pos: [0.375, 1.125, 0], color: '#c99e6d', anim: 'armL' },
  { name: 'armR', size: [0.25, 0.75, 0.25], pos: [-0.375, 1.125, 0], color: '#c99e6d', anim: 'armR' },
  { name: 'eyeL', size: [0.1, 0.1, 0.02], pos: [0.12, 1.82, -0.26], color: '#ffffff', anim: 'head' },
  { name: 'eyeR', size: [0.1, 0.1, 0.02], pos: [-0.12, 1.82, -0.26], color: '#ffffff', anim: 'head' },
  { name: 'pupilL', size: [0.05, 0.08, 0.01], pos: [0.14, 1.82, -0.275], color: '#3a2a8f', anim: 'head' },
  { name: 'pupilR', size: [0.05, 0.08, 0.01], pos: [-0.14, 1.82, -0.275], color: '#3a2a8f', anim: 'head' },
];

export class EntityRenderer {
  constructor(glc, atlas, sharedIbo) {
    this.glc = glc;
    this.atlas = atlas;
    this.sharedIbo = sharedIbo;

    this.entityProgram = new Program(glc, entityVS, entityFS, 'entity');
    this.blockProgram = new Program(glc, blockVS, blockFS, 'blockItem');
    this.particleProgram = new Program(glc, particleVS, particleFS, 'particle');

    // 中心在原点的单位立方体（带法线）
    this.cubeMesh = new Mesh(glc, [
      { name: 'aPos', size: 3, offset: 0, stride: 24 },
      { name: 'aNormal', size: 3, offset: 12, stride: 24 },
    ]);
    this.cubeMesh.uploadShared(this.entityProgram, buildUnitCube(), sharedIbo, 36);

    // 方块/物品网格缓存
    this.blockMeshes = new Map();
    this.itemMeshes = new Map();

    // 粒子动态网格
    this.particleMesh = new Mesh(glc, [
      { name: 'aPos', size: 3, offset: 0, stride: PARTICLE_STRIDE },
      { name: 'aUV', size: 3, offset: 12, stride: PARTICLE_STRIDE },
      { name: 'aColor', size: 4, offset: 24, stride: PARTICLE_STRIDE },
    ]);
    this._particleInit = false;

    this._m = Mat4.create();
    this._m2 = Mat4.create();
    this._invView = Mat4.create();
    this.stats = { entityDraws: 0, particleQuads: 0 };
  }

  /* ---------------- 网格缓存 ---------------- */
  _blockMesh(blockId) {
    let m = this.blockMeshes.get(blockId);
    if (m) return m;
    const def = BLOCKS[blockId];
    if (!def) return null;
    const built = buildBlockCubeMesh(def, 1);
    m = new Mesh(this.glc, [
      { name: 'aPos', size: 3, offset: 0, stride: VERTEX_STRIDE },
      { name: 'aUV', size: 3, offset: 12, stride: VERTEX_STRIDE },
      { name: 'aData', size: 1, offset: 24, stride: VERTEX_STRIDE },
    ]);
    m.uploadShared(this.blockProgram, built.vertices, this.sharedIbo, built.quads * 6);
    this.blockMeshes.set(blockId, m);
    return m;
  }

  _itemMesh(layer) {
    let m = this.itemMeshes.get(layer);
    if (m) return m;
    const built = buildFlatItemMesh(layer);
    m = new Mesh(this.glc, [
      { name: 'aPos', size: 3, offset: 0, stride: VERTEX_STRIDE },
      { name: 'aUV', size: 3, offset: 12, stride: VERTEX_STRIDE },
      { name: 'aData', size: 1, offset: 24, stride: VERTEX_STRIDE },
    ]);
    m.uploadShared(this.blockProgram, built.vertices, this.sharedIbo, built.quads * 6);
    this.itemMeshes.set(layer, m);
    return m;
  }

  /* ---------------- 生物 ---------------- */
  renderMobs(mobs, camera, world, fog) {
    if (mobs.length === 0) return;
    const glc = this.glc, gl = glc.gl;
    glc.setBlend(false);
    glc.setCull(true, gl.BACK);
    const p = this.entityProgram.use()
      .m4('uProj', camera.proj)
      .m4('uView', camera.view)
      .v3('uFogColor', fog.color[0], fog.color[1], fog.color[2])
      .f('uFogStart', fog.start)
      .f('uFogEnd', fog.end);

    const daylight = world.daylight;
    for (const mob of mobs) {
      const anim = mob.animation();
      const light = Math.max(0.15, world.lightAt(
        Math.floor(mob.position[0]), Math.floor(mob.position[1] + mob.height * 0.5),
        Math.floor(mob.position[2]), daylight));
      const hurt = anim.hurt;
      const fuseFlash = mob.fuse > 0 && (Math.sin(mob.fuse * 30) > 0);

      for (const part of mob.def.parts) {
        this._drawPart(p, part, mob.position, mob.renderYaw, anim, light, hurt, fuseFlash);
      }
    }
  }

  renderPlayerModel(player, camera, world, fog, swing) {
    const glc = this.glc, gl = glc.gl;
    glc.setBlend(false);
    glc.setCull(true, gl.BACK);
    const p = this.entityProgram.use()
      .m4('uProj', camera.proj)
      .m4('uView', camera.view)
      .v3('uFogColor', fog.color[0], fog.color[1], fog.color[2])
      .f('uFogStart', fog.start)
      .f('uFogEnd', fog.end);

    const speed = Math.hypot(player.velocity[0], player.velocity[2]);
    const phase = player.bobPhase * 1.6;
    const sw = Math.sin(phase) * clamp01(speed / 4) * 0.85;
    const anim = {
      legFL: sw, legFR: -sw,
      armL: -sw * 0.7 - swing * 1.4, armR: sw * 0.7,
      head: 0, headYaw: 0, hurt: player.damageCooldown > 0.35,
    };
    const light = Math.max(0.15, world.lightAt(
      Math.floor(player.position[0]), Math.floor(player.position[1] + 1),
      Math.floor(player.position[2]), world.daylight));
    const yaw = player.yaw;
    for (const part of PLAYER_PARTS) {
      const scale = player.sneaking && part.name !== 'legL' && part.name !== 'legR' ? 0.92 : 1;
      this._drawPart(p, part, player.position, yaw, anim, light, anim.hurt, false, scale);
    }
  }

  _drawPart(program, part, pos, yaw, anim, light, hurt, flash, yScale = 1) {
    const m = this._m;
    const [w, h, d] = part.size;
    const [ox, oy, oz] = part.pos;

    Mat4.identity(m);
    Mat4.translate(m, m, pos[0], pos[1], pos[2]);
    // 模型前方为 -Z；标准 rotateY(yaw) 把 -Z 转到 (-sin yaw, -cos yaw)，
    // 与玩家/生物的前进方向约定一致（此前 -yaw 会让模型背对前进方向）
    Mat4.rotateY(m, m, yaw);

    const a = part.anim ? (anim[part.anim] || 0) : 0;
    if (part.anim === 'head') {
      Mat4.translate(m, m, ox, oy * yScale - h / 2, oz);
      Mat4.rotateY(m, m, anim.headYaw || 0);
      Mat4.rotateX(m, m, a);
      Mat4.translate(m, m, 0, h / 2, 0);
    } else if (part.anim) {
      // 绕顶端旋转
      Mat4.translate(m, m, ox, oy * yScale + h / 2, oz);
      Mat4.rotateX(m, m, a);
      Mat4.translate(m, m, 0, -h / 2, 0);
    } else {
      Mat4.translate(m, m, ox, oy * yScale, oz);
    }
    Mat4.scale(m, m, w, h, d);

    let [r, g, b] = hexToRgb(part.color);
    if (flash) { r = 1; g = 1; b = 1; }
    else if (hurt) { r = Math.min(1, r * 0.5 + 0.6); g *= 0.45; b *= 0.45; }

    program.m4('uModel', m).v4('uColor', r, g, b, 1).f('uLight', light);
    this.cubeMesh.draw();
    this.stats.entityDraws++;
  }

  /* ---------------- 掉落物 ---------------- */
  renderItems(items, camera, world, fog) {
    if (items.length === 0) return;
    const glc = this.glc, gl = glc.gl;
    glc.setBlend(true, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    glc.setCull(true, gl.BACK);
    this.atlas.bind(0);
    const p = this.blockProgram.use()
      .m4('uProj', camera.proj)
      .m4('uView', camera.view)
      .i('uTex', 0)
      .i('uCutout', 1)
      .f('uLayerOverride', -1)
      .v4('uTint', 1, 1, 1, 1)
      .v3('uFogColor', fog.color[0], fog.color[1], fog.color[2])
      .f('uFogStart', fog.start)
      .f('uFogEnd', fog.end);

    const m = this._m;
    for (const e of items) {
      const light = Math.max(0.2, world.lightAt(
        Math.floor(e.position[0]), Math.floor(e.position[1] + 0.2), Math.floor(e.position[2]), world.daylight));
      const bob = Math.sin(e.age * 3) * 0.045;
      const block = blockByName(e.item);
      Mat4.identity(m);
      Mat4.translate(m, m, e.position[0], e.position[1] + 0.16 + bob, e.position[2]);
      Mat4.rotateY(m, m, e.spin);
      if (block && block.fullCube) {
        // 立方体方块：开启背面剔除，避免看到方块内部
        glc.setCull(true, gl.BACK);
        Mat4.scale(m, m, 0.28, 0.28, 0.28);
        Mat4.translate(m, m, -0.5, -0.5, -0.5);
        p.m4('uModel', m).f('uLight', light);
        const mesh = this._blockMesh(block.id);
        if (mesh) { mesh.draw(); this.stats.entityDraws++; }
      } else {
        // 平面物品（工具/食物）：双面可见
        glc.setCull(false);
        const item = getItem(e.item);
        const layer = item && item.tex ? this.atlas.layer(item.tex)
          : (block ? block.layers[2] : 0);
        Mat4.scale(m, m, 0.42, 0.42, 0.42);
        Mat4.translate(m, m, -0.5, -0.2, 0);
        p.m4('uModel', m).f('uLight', light);
        const mesh = this._itemMesh(layer);
        if (mesh) { mesh.draw(); this.stats.entityDraws++; }
      }
    }
    glc.setCull(true, gl.BACK);
  }

  /* ---------------- 手持物品 ---------------- */
  renderHand(camera, itemName, swing, light, fog, isEating = false) {
    if (!settings.get('showHand')) return;
    const glc = this.glc, gl = glc.gl;
    const block = itemName ? blockByName(itemName) : null;
    const item = itemName ? getItem(itemName) : null;

    Mat4.invert(this._invView, camera.view);
    const m = this._m;
    const s = Math.sin(swing * Math.PI);
    const s2 = Math.sin(swing * Math.PI * 2);

    glc.setBlend(true, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    glc.setDepthTest(true);
    // 手持物品靠得很近，清空深度以避免穿墙
    gl.clear(gl.DEPTH_BUFFER_BIT);

    this.atlas.bind(0);
    const p = this.blockProgram.use()
      .m4('uProj', camera.proj)
      .m4('uView', camera.view)
      .i('uTex', 0)
      .i('uCutout', 1)
      .f('uLayerOverride', -1)
      .f('uLight', Math.max(0.35, light))
      .v4('uTint', 1, 1, 1, 1)
      .v3('uFogColor', fog.color[0], fog.color[1], fog.color[2])
      .f('uFogStart', 9990)
      .f('uFogEnd', 10000);

    Mat4.copy(m, this._invView);
    const eat = isEating ? 0.12 : 0;

    if (block && block.id !== 0 && block.fullCube) {
      glc.setCull(true, gl.BACK);
      Mat4.translate(m, m, 0.56 - s * 0.1, -0.52 + s * 0.16 - eat, -0.72 + s * 0.12);
      Mat4.rotateY(m, m, -0.62 + s * 0.35);
      Mat4.rotateX(m, m, 0.12 - s * 0.6);
      Mat4.rotateZ(m, m, s2 * 0.12);
      Mat4.scale(m, m, 0.4, 0.4, 0.4);
      Mat4.translate(m, m, -0.5, -0.5, -0.5);
      p.m4('uModel', m);
      const mesh = this._blockMesh(block.id);
      if (mesh) { mesh.draw(); this.stats.entityDraws++; }
    } else if (item && (item.tex || block)) {
      // 平面物品（工具/食物）：双面可见
      glc.setCull(false);
      const layer = item.tex ? this.atlas.layer(item.tex) : block.layers[2];
      Mat4.translate(m, m, 0.62 - s * 0.14, -0.55 + s * 0.2 - eat, -0.6 + s * 0.1);
      Mat4.rotateY(m, m, -0.35);
      Mat4.rotateZ(m, m, -0.95 + s * 0.7);
      Mat4.rotateX(m, m, 0.15);
      Mat4.scale(m, m, 0.62, 0.62, 0.62);
      Mat4.translate(m, m, -0.2, -0.2, 0);
      p.m4('uModel', m);
      const mesh = this._itemMesh(layer);
      if (mesh) { mesh.draw(); this.stats.entityDraws++; }
    } else {
      // 空手：画一只手臂
      glc.setCull(true, gl.BACK);
      const ep = this.entityProgram.use()
        .m4('uProj', camera.proj)
        .m4('uView', camera.view)
        .v3('uFogColor', fog.color[0], fog.color[1], fog.color[2])
        .f('uFogStart', 9990).f('uFogEnd', 10000)
        .f('uLight', Math.max(0.4, light))
        .v4('uColor', 0.79, 0.62, 0.43, 1);
      Mat4.copy(m, this._invView);
      Mat4.translate(m, m, 0.42 - s * 0.06, -0.62 + s * 0.24 - eat, -0.62 + s * 0.18);
      Mat4.rotateZ(m, m, -0.35);
      Mat4.rotateX(m, m, 0.5 - s * 0.9);
      Mat4.scale(m, m, 0.18, 0.62, 0.18);
      ep.m4('uModel', m);
      this.cubeMesh.draw();
      this.stats.entityDraws++;
    }

    glc.setCull(true, gl.BACK);
  }

  /* ---------------- 粒子 ---------------- */
  renderParticles(particles, camera, world, fog) {
    const quads = particles.buildVertices(camera, world);
    this.stats.particleQuads = quads;
    if (quads === 0) return;
    const glc = this.glc, gl = glc.gl;

    const verts = particles.vertices.subarray(0, quads * 4 * PARTICLE_FLOATS_PER_VERTEX);
    if (!this._particleInit) {
      this.particleMesh.uploadShared(this.particleProgram, verts, this.sharedIbo, quads * 6, true);
      this._particleInit = true;
    } else {
      gl.bindVertexArray(this.particleMesh.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.particleMesh.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(null);
      this.particleMesh.indexCount = quads * 6;
      glc._state.vao = null;
    }

    glc.setBlend(true, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    glc.setCull(false);
    glc.setDepthMask(false);
    this.atlas.bind(0);
    this.particleProgram.use()
      .m4('uProj', camera.proj)
      .m4('uView', camera.view)
      .i('uTex', 0)
      .v3('uFogColor', fog.color[0], fog.color[1], fog.color[2])
      .f('uFogStart', fog.start)
      .f('uFogEnd', fog.end);
    this.particleMesh.draw();
    glc.setDepthMask(true);
    glc.setCull(true, gl.BACK);
    glc.setBlend(false);
  }
}

/** 中心在原点的单位立方体（含法线），6 个四边形 */
function buildUnitCube() {
  const faces = [
    { n: [1, 0, 0], v: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
    { n: [-1, 0, 0], v: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
    { n: [0, 1, 0], v: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
    { n: [0, -1, 0], v: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
    { n: [0, 0, 1], v: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
    { n: [0, 0, -1], v: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
  ];
  const out = new Float32Array(6 * 4 * 6);
  let i = 0;
  for (const f of faces) {
    for (const v of f.v) {
      out[i++] = v[0]; out[i++] = v[1]; out[i++] = v[2];
      out[i++] = f.n[0]; out[i++] = f.n[1]; out[i++] = f.n[2];
    }
  }
  return out;
}

export { lerp };
