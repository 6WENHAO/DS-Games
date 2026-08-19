/* =====================================================================
 * Interaction — 挖掘 / 放置 / 攻击 / 使用物品
 * ===================================================================== */
import { BLOCKS, blockByName, idByName, IS_REPLACEABLE, IS_SOLID } from '../data/blocks.js';
import { getItem, blockIdOfItem } from '../data/items.js';
import { TOOL, GAMEMODE, SHAPE, MATERIAL } from '../core/Constants.js';
import { AABB } from '../math/AABB.js';
import { bus, EV } from '../core/EventBus.js';
import { raycastEntities } from './Raycast.js';

/** 方块所需的挖掘等级 */
function requiredLevel(block) {
  const n = block.name;
  if (n === 'obsidian') return 4;
  if (n === 'diamond_ore' || n === 'gold_ore' || n === 'redstone_ore' || n === 'emerald_ore') return 3;
  if (n === 'iron_ore' || n === 'copper_ore' || n === 'lapis_ore') return 2;
  return 1;
}

/** 计算挖掘耗时（秒） */
export function breakTime(block, item, creative) {
  if (creative) return 0;
  if (block.hardness < 0) return Infinity;
  if (block.hardness === 0) return 0;
  const isCorrect = item && block.tool !== TOOL.NONE && item.tool === block.tool;
  const speed = isCorrect ? (item.speed || 1) : 1;
  const canHarvest = !block.requiresTool || (isCorrect && (item.level || 0) >= requiredLevel(block));
  const factor = canHarvest ? 1.5 : 5;
  return (block.hardness * factor) / speed;
}

export function canHarvest(block, item) {
  if (!block.requiresTool) return true;
  if (!item) return false;
  const isCorrect = block.tool !== TOOL.NONE && item.tool === block.tool;
  return isCorrect && (item.level || 0) >= requiredLevel(block);
}

export class Interaction {
  constructor(game) {
    this.game = game;
    this.breaking = false;
    this.breakX = 0; this.breakY = 0; this.breakZ = 0;
    this.breakProgress = 0;
    this.breakTotal = 0;
    this.breakLatch = false;         // 破坏一个方块后锁定，松开左键才允许再挖
    this.swing = 0;                 // 0..1 挥手动画
    this.swingActive = false;
    this.placeCooldown = 0;
    this.attackCooldown = 0;
    this.useTime = 0;               // 长按右键（进食）
    this.eating = false;
    this.digSoundTimer = 0;
    this.airId = 0;
    this.waterId = idByName('water');
  }

  get target() { return this.game.hit; }

  /** 每帧更新 */
  update(dt, input) {
    const game = this.game;
    const player = game.player;
    const hit = game.hit;

    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    // 挥手动画
    if (this.swingActive) {
      this.swing += dt * 4.2;
      if (this.swing >= 1) { this.swing = 0; this.swingActive = false; }
    }

    const leftDown = input.mouse.left && input.locked;
    const rightDown = input.mouse.right && input.locked;

    // ---------- 左键：挖掘 / 攻击 ----------
    if (leftDown) {
      if (this.breakLatch) {
        // 本轮按住已破坏过一个方块：等待松开（一次点击 = 一次破坏）
        if (!this.swingActive) this.startSwing();
      } else {
        // 优先攻击实体
        const ent = this._pickEntity();
        if (ent && this.attackCooldown <= 0) {
          this._attack(ent.entity);
        } else if (hit) {
          this._mine(dt, hit);
        } else {
          this.breaking = false;
          this.breakProgress = 0;
          if (!this.swingActive && input.mouseJust.left) this.startSwing();
        }
      }
    } else {
      this.breaking = false;
      this.breakProgress = 0;
      this.digSoundTimer = 0;
      this.breakLatch = false;   // 松开左键，解除"一次破坏"闩锁
    }

    // ---------- 右键：放置 / 使用 ----------
    if (rightDown) {
      this.useTime += dt;
      const stack = game.inventory.selectedStack;
      const item = stack ? getItem(stack.item) : null;

      if (item && item.kind === 'food' && (player.food < 20 || player.isCreative)) {
        this.eating = true;
        if (this.useTime > 1.4) {
          this.useTime = 0;
          this.eating = false;
          if (player.eat(item) && !player.isCreative) game.inventory.consumeSelected(1);
        }
      } else if (input.mouseJust.right || this.placeCooldown <= 0) {
        this.eating = false;
        if (input.mouseJust.right) {
          this._useOrPlace(hit);
          this.placeCooldown = 0.22;
        }
      }
    } else {
      this.useTime = 0;
      this.eating = false;
    }
  }

  startSwing() {
    this.swing = 0.001;
    this.swingActive = true;
  }

  _pickEntity() {
    const game = this.game;
    const cam = game.camera;
    const list = game.entities.mobs;
    if (list.length === 0) return null;
    return raycastEntities(list, cam.eye[0], cam.eye[1], cam.eye[2],
      cam.forward[0], cam.forward[1], cam.forward[2], 3.6);
  }

  _attack(entity) {
    const game = this.game;
    const stack = game.inventory.selectedStack;
    const item = stack ? getItem(stack.item) : null;
    const dmg = item && item.kind === 'tool' ? item.damage : 1;
    this.attackCooldown = 0.45;
    this.startSwing();
    entity.damage(dmg, game.player.position, game.entities);
    if (item && item.durability) game.inventory.damageSelected(1);
    bus.emit(EV.SOUND, 'hit', { volume: 0.4 });
  }

  /** 挖掘 */
  _mine(dt, hit) {
    const game = this.game;
    const player = game.player;
    const block = BLOCKS[hit.id];
    if (!block || block.hardness < 0) {
      this.breaking = false;
      return;
    }

    const stack = game.inventory.selectedStack;
    const item = stack ? getItem(stack.item) : null;

    if (!this.breaking || hit.x !== this.breakX || hit.y !== this.breakY || hit.z !== this.breakZ) {
      this.breaking = true;
      this.breakX = hit.x; this.breakY = hit.y; this.breakZ = hit.z;
      this.breakProgress = 0;
      this.breakTotal = breakTime(block, item, player.isCreative);
      this.startSwing();
    }

    if (!this.swingActive) this.startSwing();

    if (this.breakTotal <= 0.0001) {
      this._destroy(hit, block, item);
      return;
    }

    this.breakProgress += dt / this.breakTotal;

    // 挖掘音效与碎屑
    this.digSoundTimer += dt;
    if (this.digSoundTimer > 0.24) {
      this.digSoundTimer = 0;
      bus.emit(EV.SOUND, 'dig', { material: block.material, volume: 0.22 });
      game.particles.digging(hit.x, hit.y, hit.z, hit.id, hit.face);
    }

    if (this.breakProgress >= 1) this._destroy(hit, block, item);
  }

  /** 真正移除方块 */
  _destroy(hit, block, item) {
    const game = this.game;
    const player = game.player;
    game.world.setBlock(hit.x, hit.y, hit.z, this.airId);

    game.particles.blockBreak(hit.x, hit.y, hit.z, hit.id, 16);
    bus.emit(EV.SOUND, 'break', { material: block.material, volume: 0.5 });
    bus.emit(EV.BLOCK_BROKEN, hit.x, hit.y, hit.z, hit.id);

    // 掉落
    if (!player.isCreative && block.drops && canHarvest(block, item)) {
      let dropName = block.drops;
      let count = block.dropCount || 1;
      // 树叶：小概率掉树苗/苹果
      if (block.material === MATERIAL.PLANT && block.name.endsWith('_leaves')) {
        if (Math.random() < 0.06) { dropName = block.name.replace('_leaves', '_sapling'); count = 1; }
        else if (Math.random() < 0.01) { dropName = 'apple'; count = 1; }
        else dropName = null;
      }
      if (dropName && getItem(dropName)) {
        game.entities.dropItem(hit.x + 0.5, hit.y + 0.35, hit.z + 0.5, dropName, count);
      }
      player.addXp(block.group === 'ore' ? 2 : 0);
    }

    // 工具磨损
    if (!player.isCreative && item && item.durability) game.inventory.damageSelected(1);

    this.breaking = false;
    this.breakProgress = 0;
    this.breakLatch = true;    // 按住期间只破坏这一个，松开左键后重置
  }

  /** 右键：使用方块或放置 */
  _useOrPlace(hit) {
    const game = this.game;
    const player = game.player;
    const stack = game.inventory.selectedStack;
    const item = stack ? getItem(stack.item) : null;

    // 1) 使用已有方块（工作台/熔炉/箱子）
    if (hit) {
      const targetBlock = BLOCKS[hit.id];
      if (targetBlock) {
        if (targetBlock.name === 'crafting_table') {
          game.openInventory('craft');
          this.startSwing();
          return;
        }
        if (targetBlock.name === 'furnace' || targetBlock.name === 'furnace_lit') {
          game.openInventory('smelt');
          this.startSwing();
          return;
        }
        if (targetBlock.name === 'chest') {
          game.openInventory('inv');
          this.startSwing();
          return;
        }
        // 锄头耕地
        if (item && item.tool === TOOL.HOE &&
            (targetBlock.name === 'grass_block' || targetBlock.name === 'dirt')) {
          game.world.setBlock(hit.x, hit.y, hit.z, idByName('farmland'));
          bus.emit(EV.SOUND, 'dig', { material: MATERIAL.DIRT, volume: 0.4 });
          game.inventory.damageSelected(1);
          this.startSwing();
          return;
        }
      }
    }

    // 2) 放置方块
    if (!item || item.kind !== 'block') {
      this.startSwing();
      return;
    }
    if (!hit) { this.startSwing(); return; }

    const blockId = blockIdOfItem(item.name);
    if (blockId <= 0) return;
    const def = BLOCKS[blockId];

    let x = hit.px, y = hit.py, z = hit.pz;
    const existing = game.world.getBlockSafe(x, y, z);
    if (existing !== 0 && !IS_REPLACEABLE[existing]) {
      // 目标已被占用，试试直接替换命中的方块（草、水）
      if (IS_REPLACEABLE[hit.id]) { x = hit.x; y = hit.y; z = hit.z; }
      else return;
    }
    if (y < 0 || y > 126) return;

    // 与玩家重叠检查
    if (IS_SOLID[blockId]) {
      const box = new AABB(x, y, z, x + 1, y + 1, z + 1);
      if (box.intersectsEps(player.box, 1e-4)) return;
      for (const m of game.entities.mobs) {
        if (box.intersectsEps(m.box, 1e-4)) return;
      }
    }

    // 支撑检查（植物/火把）
    if (!this._canSupport(def, x, y, z)) return;

    game.world.setBlock(x, y, z, blockId);
    bus.emit(EV.SOUND, 'place', { material: def.material, volume: 0.5 });
    bus.emit(EV.BLOCK_PLACED, x, y, z, blockId);
    this.startSwing();

    if (!player.isCreative) game.inventory.consumeSelected(1);
  }

  _canSupport(def, x, y, z) {
    const world = this.game.world;
    const below = world.getBlockSafe(x, y - 1, z);
    if (def.shape === SHAPE.CROSS) {
      const b = BLOCKS[below];
      if (!b) return false;
      const soil = ['grass_block', 'dirt', 'podzol', 'coarse_dirt', 'farmland', 'sand', 'red_sand',
        'grass_block_snowy', 'mycelium'];
      if (def.name === 'sugar_cane' || def.name === 'lily_pad') return true;
      return soil.includes(b.name);
    }
    if (def.shape === SHAPE.TORCH) {
      if (below > 0 && IS_SOLID[below]) return true;
      // 侧面附着
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const s = world.getBlockSafe(x + dx, y, z + dz);
        if (s > 0 && IS_SOLID[s] && BLOCKS[s].fullCube) return true;
      }
      return false;
    }
    if (def.shape === SHAPE.FARMLAND) {
      return below === this.waterId || (below > 0 && IS_SOLID[below]);
    }
    return true;
  }

  /** 中键取色 */
  pickBlock(hit) {
    if (!hit) return;
    const game = this.game;
    const block = BLOCKS[hit.id];
    if (!block) return;
    const name = block.name;
    if (!getItem(name)) return;
    if (game.inventory.pickItem(name, game.player.isCreative)) {
      bus.emit(EV.TOAST, block.display);
    }
  }

  /** 丢弃当前物品 */
  dropSelected(all = false) {
    const game = this.game;
    const stack = game.inventory.selectedStack;
    if (!stack) return;
    const n = all ? stack.count : 1;
    const cam = game.camera;
    const e = game.entities.dropItem(
      cam.eye[0] + cam.forward[0] * 0.6,
      cam.eye[1] - 0.2,
      cam.eye[2] + cam.forward[2] * 0.6,
      stack.item, n);
    if (e) {
      e.velocity[0] = cam.forward[0] * 6;
      e.velocity[1] = cam.forward[1] * 6 + 1.4;
      e.velocity[2] = cam.forward[2] * 6;
      e.pickupDelay = 1;
    }
    if (!game.player.isCreative || true) game.inventory.consumeSelected(n);
  }
}

export { GAMEMODE };
