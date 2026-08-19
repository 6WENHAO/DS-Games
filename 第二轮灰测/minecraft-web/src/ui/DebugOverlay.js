/* =====================================================================
 * DebugOverlay — F3 调试信息面板
 * ===================================================================== */
import { BLOCKS } from '../data/blocks.js';
import { BIOME_NAMES, facingFromYaw } from '../core/Constants.js';
import { RAD2DEG } from '../math/MathUtils.js';

export class DebugOverlay {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('debug-overlay');
    this.left = document.createElement('div');
    this.left.className = 'col';
    this.right = document.createElement('div');
    this.right.className = 'col right';
    this.el.appendChild(this.left);
    this.el.appendChild(this.right);
    this.visible = false;
    this._timer = 0;
  }

  toggle() {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
    if (this.visible) this.update(1);
  }

  update(dt) {
    if (!this.visible) return;
    this._timer += dt;
    if (this._timer < 0.12) return;
    this._timer = 0;

    const g = this.game;
    const p = g.player;
    const w = g.world;
    const r = g.renderer;
    const loop = g.loop;

    const bx = Math.floor(p.position[0]), by = Math.floor(p.position[1]), bz = Math.floor(p.position[2]);
    const cx = bx >> 4, cz = bz >> 4;
    const sky = w.getSkyLight(bx, by + 1, bz);
    const blk = w.getBlockLight(bx, by + 1, bz);
    const biome = BIOME_NAMES[w.biomeAt(bx, bz)] || '?';
    const t = w.timeOfDay | 0;
    const phase = w.isNight ? '夜晚' : '白天';

    const hit = g.hit;
    const hitBlock = hit ? BLOCKS[hit.id] : null;

    this.left.textContent = [
      `MineWeb 1.0  ${loop.fps} fps  (帧 ${loop.frameMsSmooth.toFixed(1)}ms 峰值 ${loop.maxFrameMs.toFixed(1)}ms)`,
      `区块 C: ${w.loadedChunkCount} 已加载 / ${w.pendingChunks} 待处理 / 网格队列 ${r.stats.meshQueue}`,
      `可见 section: ${r.stats.visibleSections}   绘制调用: ${r.stats.drawCalls}   三角形: ${(r.stats.triangles / 1000).toFixed(1)}k`,
      `实体 E: ${g.entities.stats.mobs} 生物 + ${g.entities.stats.items} 掉落物   粒子: ${g.particles.activeCount}`,
      ``,
      `XYZ: ${p.position[0].toFixed(3)} / ${p.position[1].toFixed(3)} / ${p.position[2].toFixed(3)}`,
      `方块: ${bx} ${by} ${bz}`,
      `区块: ${bx & 15} ${by & 15} ${bz & 15} in ${cx} ${cz}`,
      `朝向: ${facingFromYaw(p.yaw)} (yaw ${(p.yaw * RAD2DEG).toFixed(1)} / pitch ${(p.pitch * RAD2DEG).toFixed(1)})`,
      `速度: ${Math.hypot(p.velocity[0], p.velocity[2]).toFixed(2)} 格/秒  Y ${p.velocity[1].toFixed(2)}`,
      `光照: 天光 ${sky} / 方块光 ${blk}   日光强度 ${w.daylight.toFixed(2)}`,
      `生物群系: ${biome}`,
      `时间: ${t} (${phase} 第 ${w.dayCount + 1} 天)   天气: ${w.weather}`,
      `状态: ${p.onGround ? '地面' : '空中'}${p.inWater ? ' 水中' : ''}${p.flying ? ' 飞行' : ''}${p.sprinting ? ' 疾跑' : ''}${p.sneaking ? ' 潜行' : ''}`,
      `站在: ${p.standingOn}`,
    ].join('\n');

    const info = r.glc.info;
    this.right.textContent = [
      `MineWeb · WebGL2 · 无依赖`,
      `渲染器: ${String(info.renderer).slice(0, 46)}`,
      `分辨率: ${r.glc.width}×${r.glc.height} (×${r.glc.pixelRatio.toFixed(2)})`,
      `贴图: ${r.atlas.layerCount} 层 16×16 (${r.atlas.buildMs?.toFixed(0)}ms 生成)`,
      ``,
      `区块内存: ${w.memoryMB.toFixed(1)} MB`,
      `GPU 网格: ${r.gpuMemoryMB.toFixed(1)} MB`,
      `光照队列: ${g.world.lighting.pending}`,
      `种子: ${w.seedString}`,
      `世界类型: ${w.type}`,
      ``,
      hit ? `目标: ${hitBlock ? hitBlock.display : '?'} (${hitBlock ? hitBlock.name : ''})` : '目标: 无',
      hit ? `坐标: ${hit.x} ${hit.y} ${hit.z}  面: ${['+X', '-X', '+Y', '-Y', '+Z', '-Z'][hit.face] || '?'}` : '',
      hit ? `硬度: ${hitBlock ? hitBlock.hardness : 0}  工具: ${hitBlock ? hitBlock.tool : '-'}` : '',
      ``,
      `游戏模式: ${p.gamemode}`,
      `按 F3 关闭 · F 切换视角 · T 聊天`,
    ].join('\n');
  }
}
