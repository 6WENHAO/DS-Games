/**
 * ui/debug-overlay.js
 * ------------------------------------------------------------------
 * The F3 screen: the same information vanilla shows, which is exactly
 * what you want while debugging terrain and performance.
 *
 * Left column  - build info, frame timing, chunk counts, position,
 *                facing, biome, light levels, the targeted block.
 * Right column - GPU and memory details plus the render pipeline stats.
 *
 * A small frame-time graph sits at the bottom right, like vanilla's
 * lagometer.
 */

import { blocks } from '../world/blocks.js';
import { CHUNK_SIZE } from '../world/constants.js';
import { t, biomeName, modeName, entryName } from './i18n.js';

const GRAPH_SAMPLES = 120;

export class DebugOverlay {
  constructor() {
    this.visible = false;
    this.frameTimes = new Float32Array(GRAPH_SAMPLES);
    this.frameIndex = 0;
    this.fps = 0;
    this.frameCount = 0;
    this.fpsTimer = 0;
    this.worstFrame = 0;
  }

  toggle() { this.visible = !this.visible; }

  /** Records one frame's duration in milliseconds. */
  sample(frameMs) {
    this.frameTimes[this.frameIndex] = frameMs;
    this.frameIndex = (this.frameIndex + 1) % GRAPH_SAMPLES;
    this.frameCount++;
    this.fpsTimer += frameMs / 1000;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      this.worstFrame = Math.max(...this.frameTimes);
    }
  }

  /**
   * @param {object} ctx
   * @param {import('./hud.js').Hud} ctx.hud
   * @param {import('../player/player.js').Player} ctx.player
   * @param {import('../world/world.js').World} ctx.world
   * @param {import('../gfx/renderer.js').Renderer} ctx.renderer
   * @param {import('../game/daycycle.js').DayCycle} ctx.day
   * @param {object|null} ctx.target
   */
  draw({ hud, player, world, renderer, day, target, camera, particles, entities }) {
    if (!this.visible) return;
    const batch = hud.batch;
    const bx = Math.floor(player.x);
    const by = Math.floor(player.y);
    const bz = Math.floor(player.z);
    const biome = world.biomeAt(bx, bz);
    const chunkX = bx >> 4;
    const chunkZ = bz >> 4;

    const left = [
      `WebCraft (${renderer.chunks.stats.drawCalls} draws, ${(renderer.chunks.stats.quadsDrawn / 1000).toFixed(1)}k quads)`,
      `${this.fps} fps  (worst ${this.worstFrame.toFixed(1)} ms)`,
      `C: ${renderer.chunks.stats.chunksDrawn}/${world.chunks.size}  culled ${renderer.chunks.stats.chunksCulled}`,
      `gen ${world.stats.generating}  mesh ${world.stats.meshing}  queue ${world.meshQueue.length}`,
      `E: ${entities?.count ?? 0} entities, ${particles?.count ?? 0} particles`,
      '',
      `XYZ: ${player.x.toFixed(3)} / ${player.y.toFixed(5)} / ${player.z.toFixed(3)}`,
      `Block: ${bx} ${by} ${bz}`,
      `Chunk: ${bx & 15} ${by & 15} ${bz & 15} in ${chunkX} ${by >> 4} ${chunkZ}`,
      `${t('debug.facing')}: ${camera.facing()} (${camera.minecraftYaw().toFixed(1)} / ${(-camera.pitch * 180 / Math.PI).toFixed(1)})`,
      `Velocity: ${player.vx.toFixed(2)} ${player.vy.toFixed(2)} ${player.vz.toFixed(2)}`,
      `Light: ${world.getSkyLight(bx, by + 1, bz)} sky, ${world.getBlockLight(bx, by + 1, bz)} block`,
      `${t('debug.biome')}: ${biomeName(biome.name, biome.displayName)}  (T ${biome.temperature.toFixed(2)} D ${biome.downfall.toFixed(2)})`,
      `Time: ${day.formatTime()}  day ${day.dayNumber}  daylight ${day.daylight.toFixed(2)}`,
      `${t('debug.mode')}: ${modeName(player.mode)}${player.flying ? ' (flying)' : ''}${player.onGround ? '' : ' (airborne)'}`,
      `${t('debug.standingOn')}: ${entryName(player.standingOn())}`,
    ];

    const gpuBytes = renderer.chunks.stats.gpuBytes;
    const heap = performance.memory
      ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)}/${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(0)} MB`
      : 'n/a';
    const right = [
      `${renderer.caps.vendor}`,
      `${renderer.caps.renderer}`.slice(0, 48),
      `${renderer.caps.version}`,
      '',
      `Mesh VRAM: ${(gpuBytes / 1048576).toFixed(1)} MB`,
      `Texture layers: ${renderer.textures.layerCount}`,
      `JS heap: ${heap}`,
      `Workers: ${world.pool.usingFallback ? 'fallback' : world.pool.size}`,
      `Render distance: ${renderer.settings.renderDistance} (${renderer.settings.renderDistance * CHUNK_SIZE} blocks)`,
      `Seed: ${world.seed}`,
      `World type: ${world.worldType}`,
      '',
      t('debug.targeted'),
    ];
    if (target?.hit) {
      const def = blocks[target.block];
      right.push(`  ${entryName(def.name, def.displayName)}`);
      right.push(`  ${target.x} ${target.y} ${target.z}`);
      right.push(`  face ${['east', 'west', 'up', 'down', 'south', 'north'][target.face]}`);
      right.push(`  hardness ${def.hardness}  tool ${def.tool ?? 'any'}`);
      right.push(`  light ${world.getSkyLight(target.x, target.y, target.z)}/${world.getBlockLight(target.x, target.y, target.z)}`);
    } else {
      right.push(  );
    }

    // --- left column ------------------------------------------
    left.forEach((line, i) => {
      if (!line) return;
      const w = hud.measure(line) + 2;
      batch.rect(1, 1 + i * 10, w, 10, 0x000000, 0.55);
      hud.drawText(line, 2, 3 + i * 10, { color: 0xe0e0e0, shadow: false });
    });

    // --- right column -----------------------------------------
    right.forEach((line, i) => {
      if (!line) return;
      const w = hud.measure(line) + 2;
      const x = batch.width - w - 1;
      batch.rect(x, 1 + i * 10, w, 10, 0x000000, 0.55);
      hud.drawText(line, x + 1, 3 + i * 10, { color: 0xe0e0e0, shadow: false });
    });

    this.#drawGraph(batch, hud);
  }

  /** Frame-time bars, green under 16 ms, red past 33 ms. */
  #drawGraph(batch, hud) {
    const h = 40;
    const w = GRAPH_SAMPLES;
    const x0 = batch.width - w - 2;
    const y0 = batch.height - h - 2;
    batch.rect(x0, y0, w, h, 0x000000, 0.5);
    for (let i = 0; i < GRAPH_SAMPLES; i++) {
      const index = (this.frameIndex + i) % GRAPH_SAMPLES;
      const ms = this.frameTimes[index];
      if (ms <= 0) continue;
      const barH = Math.min(h, Math.max(1, Math.round(ms / 50 * h)));
      const colour = ms > 33 ? 0xff4040 : ms > 18 ? 0xffd040 : 0x40ff60;
      batch.rect(x0 + i, y0 + h - barH, 1, barH, colour, 0.9);
    }
    // 16.6 ms (60 fps) reference line
    const line = Math.round(16.6 / 50 * h);
    batch.rect(x0, y0 + h - line, w, 1, 0xffffff, 0.35);
    hud.drawText('50ms', x0 + 2, y0 + 1, { color: 0xa0a0a0, shadow: false });
  }
}
