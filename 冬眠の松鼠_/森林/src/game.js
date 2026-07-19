import * as THREE from 'three';
import { CONFIG } from './core/config.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { createTerrain } from './world/terrain.js';
import { DayNight } from './world/sky.js';
import { Ocean } from './world/water.js';
import { TreeSystem } from './world/trees.js';
import { Vegetation } from './world/vegetation.js';
import { CrashSite } from './world/props.js';
import { WorldItems } from './systems/worldItems.js';
import { Inventory } from './systems/inventory.js';
import { Survival } from './systems/survival.js';
import { BuildingSystem } from './systems/building.js';
import { CannibalManager } from './entities/cannibal.js';
import { AnimalManager } from './entities/animals.js';
import { Player } from './player/player.js';
import { ViewModel } from './player/viewmodel.js';
import { ITEMS } from './systems/items.js';
import { getHeight } from './world/heightfield.js';

const SAVE_KEY = 'theforest_web_save';

export class Game {
  constructor(canvas, ui) {
    this.ui = ui;
    this.canvas = canvas;

    // ---- 渲染器 ----
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, CONFIG.graphics.viewDistance * 4);
    this.scene.add(this.camera);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ---- 输入 ----
    this.input = new Input(canvas);
    this.input.onKeyPress = (code) => this._onKey(code);
    this.input.onPointerUnlock = () => {
      if (this.running && !this.ui.isAnyOpen()) this._openPause();
    };

    // ---- 世界 ----
    this.terrain = createTerrain(this.scene);
    this.dayNight = new DayNight(this.scene, this.renderer);
    this.ocean = new Ocean(this.scene);
    this.trees = new TreeSystem(this.scene);
    this.vegetation = new Vegetation(this.scene);
    this.worldItems = new WorldItems(this.scene);
    this.worldItems.scatterInitial();
    this.crashSite = new CrashSite(this.scene, this.worldItems);

    // ---- 系统 ----
    this.inventory = new Inventory();
    this.survival = new Survival();
    this.buildings = new BuildingSystem(this.scene);
    this.cannibals = new CannibalManager(this.scene);
    this.animals = new AnimalManager(this.scene);

    // ---- 玩家 ----
    this.player = new Player(this.camera, this.input);
    this.viewModel = new ViewModel(this.camera);

    this.inventory.onChange = () => this._refreshUI();

    this.running = false;
    this.paused = false;
    this.attackCooldown = 0;
    this.pendingHit = null;
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();

    this._bindMenuButtons();
  }

  // ================= 生命周期 =================

  newGame() {
    const sp = this.crashSite.spawnPoint;
    this.player.teleport(sp.x, sp.y + 0.5, sp.z);
    this.player.yaw = Math.atan2(sp.x, sp.z); // 面向岛心
    this.inventory.slots.clear();
    this.inventory.add('hatchet');
    this.inventory.equip('hatchet');
    this.viewModel.equip('hatchet');
    this._start();
    this.ui.notify('飞机坠毁了……先捡起周围的补给');
    this.ui.notify('用手斧砍树收集原木，按 B 打开生存手册');
  }

  continueGame() {
    const ok = this.load();
    if (!ok) return this.newGame();
    this._start();
    this.ui.notify('读取存档成功');
  }

  _start() {
    this.running = true;
    this.paused = false;
    this.survival.dead = false;
    Audio.init();
    Audio.resume();
    this.ui.hideTitle();
    this.ui.hideAllPanels();
    this.input.enabled = true;
    this.input.lock();
    this._refreshUI();
    this.clock.getDelta();
    if (!this._loopStarted) {
      this._loopStarted = true;
      this.renderer.setAnimationLoop(() => this._frame());
    }
  }

  _respawn() {
    const shelter = this.buildings.structures.find((s) => s.type === 'shelter');
    const sp = shelter || this.crashSite.spawnPoint;
    this.survival.deserialize({ health: 60, hunger: 60, thirst: 60, energy: 70, stamina: 100 });
    this.player.teleport(sp.x, getHeight(sp.x, sp.z) + 0.5, sp.z);
    this.ui.deathScreen.classList.add('hidden');
    this.paused = false;
    this.input.lock();
  }

  // ================= 存档 =================

  save() {
    const data = {
      version: 1,
      player: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z, yaw: this.player.yaw },
      survival: this.survival.serialize(),
      inventory: this.inventory.serialize(),
      time: { t: this.dayNight.time, day: this.dayNight.day },
      buildings: this.buildings.serialize(),
      trees: this.trees.serialize(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    this.ui.notify('游戏已保存');
  }

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      this.player.teleport(data.player.x, data.player.y, data.player.z);
      this.player.yaw = data.player.yaw || 0;
      this.survival.deserialize(data.survival);
      this.inventory.deserialize(data.inventory);
      this.dayNight.time = data.time.t;
      this.dayNight.day = data.time.day;
      this.buildings.deserialize(data.buildings);
      this.trees.deserialize(data.trees, this.dayNight.day);
      this.viewModel.equip(this.inventory.equipped);
      return true;
    } catch (e) {
      console.error('load fail', e);
      return false;
    }
  }

  static hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  // ================= 输入处理 =================

  _bindMenuButtons() {
    const $ = (id) => document.getElementById(id);
    $('btn-respawn').addEventListener('click', () => this._respawn());
    $('btn-resume').addEventListener('click', () => this._closePanels());
    $('btn-save').addEventListener('click', () => {
      if (this.buildings.findNear(this.player.position, 6, 'shelter')) {
        this.save();
        this._closePanels();
      } else {
        this.ui.notify('需要靠近庇护所才能存档');
        Audio.play('ui_error', { volume: 0.6 });
      }
    });
    $('btn-quit').addEventListener('click', () => location.reload());
  }

  _onKey(code) {
    if (!this.running || this.survival.dead) return;

    switch (code) {
      case 'Escape':
        if (this.ui.isAnyOpen()) this._closePanels();
        else this._openPause();
        break;
      case 'KeyI':
      case 'Tab':
        this._togglePanel(this.ui.inventoryScreen, () => this._renderInventory());
        break;
      case 'KeyC':
        this._togglePanel(this.ui.craftingScreen, () => {
          this.ui.renderCrafting(this.inventory, (r) => this._craft(r));
        });
        break;
      case 'KeyB':
        this._togglePanel(this.ui.bookScreen, () => {
          Audio.play('book_open', { volume: 0.8 });
          this.ui.renderBuildings(this.inventory, (b) => {
            this.buildings.setBlueprint(b.id);
            this._closePanels();
            this.ui.notify(`移动到目标位置，左键放置【${b.name}】，R 旋转`);
          });
        });
        break;
      case 'KeyE':
        this._interact();
        break;
      case 'KeyR':
        this.buildings.rotateBlueprint();
        break;
      case 'KeyQ':
        this.buildings.clearBlueprint();
        break;
      default: {
        // 快捷栏 1-5
        const m = code.match(/^Digit([1-5])$/);
        if (m) {
          const items = this.inventory.hotbarItems();
          const id = items[Number(m[1]) - 1];
          if (id) {
            const def = ITEMS[id];
            if (def.equip) {
              this.inventory.equip(id);
              this.viewModel.equip(this.inventory.equipped);
            } else {
              this._useItem(id);
            }
          }
        }
      }
    }
  }

  _togglePanel(el, renderFn) {
    const isOpen = !el.classList.contains('hidden');
    this._closePanels();
    if (!isOpen) {
      renderFn();
      el.classList.remove('hidden');
      this.paused = false;
      this.input.unlock();
    }
  }

  _closePanels() {
    this.ui.hideAllPanels();
    this.paused = false;
    if (this.running && !this.survival.dead) this.input.lock();
  }

  _openPause() {
    this.ui.hideAllPanels();
    this.ui.pauseScreen.classList.remove('hidden');
    this.paused = true;
    this.input.unlock();
  }

  // ================= 物品/合成 =================

  _renderInventory() {
    this.ui.renderInventory(
      this.inventory,
      (id) => {
        this.inventory.equip(id);
        this.viewModel.equip(this.inventory.equipped);
        this._renderInventory();
      },
      (id) => this._useItem(id)
    );
  }

  _useItem(id) {
    const def = ITEMS[id];
    if (!def) return;
    if (def.use === 'eat') {
      if (this.inventory.remove(id, 1)) {
        this.survival.eat(def);
        Audio.play('cloth_1', { volume: 0.7 });
        this.ui.notify(`吃掉了 ${def.name}`);
      }
    } else if (def.use === 'drink') {
      if (this.inventory.remove(id, 1)) {
        this.inventory.add('waterskin_empty');
        this.survival.drink(def.water);
        Audio.play('cloth_2', { volume: 0.7 });
        this.ui.notify('喝了水袋里的水');
      }
    } else if (def.use === 'heal') {
      if (this.survival.health >= 100) { this.ui.notify('生命值已满'); return; }
      if (this.inventory.remove(id, 1)) {
        this.survival.eat({ health: def.health });
        Audio.play('cloth_2', { volume: 0.7 });
        this.ui.notify('使用了绷带');
      }
    }
    // 刷新打开中的物品栏
    if (!this.ui.inventoryScreen.classList.contains('hidden')) {
      this._renderInventory();
    }
  }

  _craft(recipe) {
    if (this.inventory.pay(recipe.cost)) {
      this.inventory.add(recipe.out, recipe.count);
      Audio.play('ui_confirm', { volume: 0.7 });
      this.ui.notify(`合成了 ${ITEMS[recipe.out].name}`);
      this.ui.renderCrafting(this.inventory, (r) => this._craft(r));
    }
  }

  // ================= 交互 =================

  _getInteraction() {
    const pos = this.player.position;
    const hour = this.dayNight.day * 24 + this.dayNight.hour;

    // 1. 可搜刮物
    const loot = this.crashSite.findLootable(pos, 2.6);
    if (loot) return { type: 'loot', target: loot, label: `E ${loot.label}` };

    // 2. 掉落物
    const item = this.worldItems.findNearest(this.player.eyePos, 2.8);
    if (item) return { type: 'pickup', target: item, label: `E 拾取 ${this._itemLabel(item.type)}` };

    // 3. 浆果丛
    const bush = this.vegetation.findBerryBush(pos, 2.8, hour);
    if (bush) return { type: 'berry', target: bush, label: 'E 采集浆果' };

    // 4. 篝火烹饪
    const fire = this.buildings.findNear(pos, 2.8, 'campfire');
    if (fire && this.inventory.count('meat_raw') > 0) {
      return { type: 'cook', target: fire, label: 'E 烤肉' };
    }

    // 5. 庇护所睡觉/存档
    const shelter = this.buildings.findNear(pos, 3.2, 'shelter');
    if (shelter) return { type: 'sleep', target: shelter, label: this.dayNight.isNight ? 'E 睡到天亮（存档）' : 'E 休息（存档）' };

    // 6. 水边喝水/灌水
    const groundH = getHeight(pos.x, pos.z);
    if (groundH < CONFIG.world.beachLevel - 0.6 && this.player.pitch < -0.35) {
      if (this.inventory.count('waterskin_empty') > 0) return { type: 'fill', label: 'E 喝水并灌满水袋' };
      return { type: 'drink', label: 'E 喝水' };
    }

    return null;
  }

  _itemLabel(type) {
    const map = {
      log: '原木', stick: '树枝', stone: '石头', apple: '苹果',
      medkit: '医疗箱', machete: '砍刀',
    };
    return map[type] || type;
  }

  _interact() {
    const act = this._getInteraction();
    if (!act) return;
    const pos = this.player.position;

    switch (act.type) {
      case 'loot': {
        act.target.looted = true;
        for (const { id, n } of act.target.loot) {
          this.inventory.add(id, n);
          this.ui.notify(`获得 ${ITEMS[id].name} ×${n}`);
        }
        Audio.play('handle_leather', { volume: 0.8 });
        break;
      }
      case 'pickup': {
        const t = act.target.type;
        this.worldItems.removeItem(act.target);
        Audio.play('cloth_1', { volume: 0.7 });
        if (t === 'medkit') {
          this.inventory.add('bandage', 2);
          this.ui.notify('获得 绷带 ×2');
        } else if (t === 'machete') {
          this.inventory.add('machete');
          this.ui.notify('获得 砍刀！(装备后攻击更强)');
        } else {
          this.inventory.add(t, 1);
          this.ui.notify(`拾取 ${this._itemLabel(t)}`);
        }
        break;
      }
      case 'berry': {
        act.target.lastPicked = this.dayNight.day * 24 + this.dayNight.hour;
        this.inventory.add('berries', 4);
        Audio.play('cloth_2', { volume: 0.7 });
        this.ui.notify('采集了 浆果 ×4');
        break;
      }
      case 'cook': {
        const n = this.inventory.count('meat_raw');
        this.inventory.remove('meat_raw', n);
        this.inventory.add('meat_cooked', n);
        Audio.play('chop', { volume: 0.5, rate: 0.8 });
        this.ui.notify(`烤熟了 ${n} 块肉`);
        break;
      }
      case 'sleep': {
        if (this.dayNight.isNight) {
          this.dayNight.time = 0.27; // 清晨
          this.dayNight.day++;
          this.survival.sleep();
          this.ui.notify('你安睡到了清晨');
        } else {
          this.survival.energy = Math.min(100, this.survival.energy + 25);
          this.ui.notify('小憩了一会');
        }
        this.save();
        break;
      }
      case 'drink': {
        this.survival.drink(45);
        Audio.playRandom(['cloth_1', 'cloth_2'], { volume: 0.5, rate: 0.75 });
        this.ui.notify('喝了几口水');
        break;
      }
      case 'fill': {
        this.survival.drink(45);
        this.inventory.remove('waterskin_empty', 1);
        this.inventory.add('waterskin_full');
        Audio.playRandom(['cloth_1', 'cloth_2'], { volume: 0.5, rate: 0.75 });
        this.ui.notify('灌满了水袋');
        break;
      }
    }
  }

  // ================= 攻击 =================

  _tryAttack() {
    if (this.attackCooldown > 0) return;

    // 蓝图放置优先
    if (this.buildings.blueprint) {
      if (this.buildings.place(this.inventory)) {
        this.ui.notify('建造完成');
      } else {
        Audio.play('ui_error', { volume: 0.5 });
      }
      return;
    }

    const def = this.inventory.equippedDef;
    if (!def) {
      // 空手也可以打（弱）
      this.viewModel.swing();
      this.attackCooldown = CONFIG.player.attackCooldown;
      this.pendingHit = { time: 0.2, damage: 5, chopPower: 0, range: 2.0 };
      return;
    }

    if (this.survival.stamina.value < CONFIG.survival.staminaAttack * 0.5) {
      return; // 没体力
    }
    this.survival.stamina.value = Math.max(0, this.survival.stamina.value - CONFIG.survival.staminaAttack);

    this.viewModel.swing();
    this.attackCooldown = CONFIG.player.attackCooldown;
    this.pendingHit = {
      time: 0.22,
      damage: def.damage || 8,
      chopPower: def.chopPower || 0,
      range: def.range || CONFIG.player.attackRange,
    };
  }

  _resolveHit() {
    const hit = this.pendingHit;
    this.pendingHit = null;
    const fwd = this.player.forward;
    const eye = this.player.eyePos;

    // 1. 敌人
    if (this.cannibals.tryHit(this.player.position, fwd, hit.range, hit.damage)) {
      Audio.playRandom(['knife_1', 'knife_2'], { volume: 0.8 });
      return;
    }
    // 2. 动物
    if (this.animals.tryHit(this.player.position, fwd, hit.range + 0.6)) {
      this.inventory.add('meat_raw', 2);
      this.ui.notify('猎到了兔子！获得 生肉 ×2');
      return;
    }
    // 3. 树木
    if (hit.chopPower > 0) {
      this.raycaster.set(eye, fwd);
      this.raycaster.far = hit.range + 1.2;
      const treeHit = this.trees.raycast(this.raycaster, hit.range + 1.2);
      if (treeHit) {
        const result = this.trees.chop(treeHit.index, treeHit.point, this.dayNight.day, hit.chopPower);
        if (result === 'felled') {
          const t = this.trees.trees[treeHit.index];
          this.worldItems.dropLogsAt(t.x, t.z, CONFIG.trees.logsPerTree);
          this.inventory.add('stick', 2);
          this.ui.notify('树倒了！捡起地上的原木（+树枝×2）');
        }
        return;
      }
    }
    // 4. 落空
    Audio.play('impact_soft', { volume: 0.15, rate: 1.4 });
  }

  // ================= 主循环 =================

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.running) return;

    const anyOpen = this.ui.isAnyOpen();

    if (!this.paused && !this.survival.dead) {
      if (this.input.pointerLocked) {
        this.player.updateLook();
        if (this.input.attackPressed) this._tryAttack();
      }

      // 玩家物理（面板打开时也继续，世界不停摆）
      this.player.speedFactor = this.survival.speedFactor || 1;
      this.player.updateMovement(dt, this.trees, this.buildings, this.survival.stamina);

      // 攻击命中判定（延迟到挥舞中段）
      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.pendingHit) {
        this.pendingHit.time -= dt;
        if (this.pendingHit.time <= 0) this._resolveHit();
      }

      // 世界更新
      const gameHoursDelta = (dt / CONFIG.time.dayLength) * 24;
      this.dayNight.update(dt, this.player.position);
      this.ocean.update(dt, this.dayNight.sunLight.position.clone().sub(this.player.position), this.dayNight.dayFactor);

      const landed = this.trees.update(dt, this.dayNight.day, this.player.position);
      for (const f of landed) {
        const t = this.trees.trees[f.index];
        this.worldItems.dropLogsAt(t.x, t.z, CONFIG.trees.logsPerTree);
      }

      this.buildings.update(dt);
      this.buildings.updateBlueprint(this.player.position, this.player.forwardFlat);

      this.cannibals.update(dt, this.player.position, this.dayNight.isNight, this.buildings, (dmg) => {
        this.survival.damage(dmg, '被食人族杀死了');
        this.ui.damageFlash();
        Audio.play('impact_punch', { volume: 0.9 });
      });
      this.animals.update(dt, this.player.position);

      // 生存状态
      this.survival.update(dt, gameHoursDelta, this.dayNight.isNight);
      if (this.survival.dead) {
        this.ui.showDeath(this.survival.deathCause);
        this.input.unlock();
      }

      // 视模型动画
      const moving = this.input.down('KeyW') || this.input.down('KeyA') || this.input.down('KeyS') || this.input.down('KeyD');
      this.viewModel.update(dt, moving);

      // 音频
      Audio.setListener(this.player.eyePos);
      const groundH = getHeight(this.player.position.x, this.player.position.z);
      const shore = THREE.MathUtils.clamp(1 - (groundH - CONFIG.world.beachLevel) / 12, 0, 1);
      Audio.updateAmbience(this.dayNight.dayFactor, shore);

      // HUD
      this.ui.updateBars(this.survival);
      this.ui.setClock(this.dayNight.clockText);
      if (!anyOpen) {
        const act = this._getInteraction();
        if (act) this.ui.showPrompt(act.label);
        else this.ui.hidePrompt();
      } else {
        this.ui.hidePrompt();
      }
    }

    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  _refreshUI() {
    const items = this.inventory.hotbarItems();
    this.ui._inv = this.inventory;
    this.ui.renderHotbar(items, this.inventory.equipped, (id) => {
      const def = ITEMS[id];
      if (def.equip) {
        this.inventory.equip(id);
        this.viewModel.equip(this.inventory.equipped);
      } else {
        this._useItem(id);
      }
    });
  }
}
