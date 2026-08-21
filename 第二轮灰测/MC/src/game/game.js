/**
 * game/game.js
 * ------------------------------------------------------------------
 * The game object: owns the world, player, renderer, interface and the
 * fixed-timestep loop, and implements the interactions that connect them
 * (mining, placing, picking up, chatting, saving).
 *
 * Loop shape: a variable-rate render with a fixed 20 Hz tick for the
 * things that must be deterministic (hunger, mob spawning, fluid spread),
 * which is exactly how Minecraft is structured.
 */

import { Renderer } from '../gfx/renderer.js';
import { Camera } from '../gfx/camera.js';
import { World } from '../world/world.js';
import { DayCycle } from './daycycle.js';
import { Player, GAME_MODE } from '../player/player.js';
import { Controls } from '../player/controls.js';
import { raycastVoxels, RayHit } from '../player/raycast.js';
import { MiningState, blockDrops, canPlaceAt, settleGravity, spreadLiquid, updateSupports } from './mining.js';
import { ParticleSystem } from './particles.js';
import { EntityManager } from '../entities/entities.js';
import { Inventory, ItemStack } from './inventory.js';
import { getItem, itemsByName } from './items.js';
import { IconAtlas } from '../ui/icon-atlas.js';
import { Hud } from '../ui/hud.js';
import { DebugOverlay } from '../ui/debug-overlay.js';
import { Chat } from '../ui/chat.js';
import {
  TitleScreen, PauseScreen, SettingsScreen, InventoryScreen,
  CraftingScreen, CreativeScreen, DeathScreen,
} from '../ui/screens.js';
import { font } from '../ui/font.js';
import { t, setLocale, nextLocale, getLocale } from '../ui/i18n.js';
import { sound } from '../audio/sound.js';
import { WorldStorage, loadSettings, saveSettings } from '../core/storage.js';
import { blocks, getBlock, B, IS_LIQUID, IS_COLLIDABLE } from '../world/blocks.js';
import { loadImage, DEFAULT_TEXTURE_BASE } from '../gfx/textures.js';
import { clamp, damp } from '../core/math.js';
import { SEA_LEVEL, WORLD_HEIGHT } from '../world/constants.js';

/** Fixed tick rate for deterministic systems. */
const TICK_RATE = 20;
const TICK_LENGTH = 1 / TICK_RATE;
/** Never simulate more than this many ticks in one frame (tab-switch guard). */
const MAX_TICKS_PER_FRAME = 8;

export class Game {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = loadSettings();
    this.renderer = new Renderer(canvas, {
      renderDistance: this.settings.renderDistance,
      fov: this.settings.fov,
      brightness: this.settings.brightness,
      guiScale: this.settings.guiScale,
      resolutionScale: this.settings.resolutionScale,
      clouds: this.settings.clouds,
      stars: this.settings.stars,
    });

    // Restore a saved language choice before any interface text is built.
    if (this.settings.language) setLocale(this.settings.language);

    this.camera = new Camera();
    this.day = new DayCycle({ time: 1000 });
    this.controls = new Controls(canvas, {
      sensitivity: this.settings.sensitivity,
      invertY: this.settings.invertY,
    });

    /** @type {World|null} */
    this.world = null;
    /** @type {Player|null} */
    this.player = null;
    this.storage = new WorldStorage('world1');
    this.hasSave = false;

    this.chat = new Chat(this);
    this.debug = new DebugOverlay();
    this.mining = new MiningState();
    this.target = new RayHit();
    this.craftingTableGrid = new Inventory(9);

    /** @type {import('../ui/screens.js').Screen|null} */
    this.screen = null;
    this.paused = false;
    this.running = false;
    this.loaded = false;
    this.accumulator = 0;
    this.lastFrame = 0;
    this.elapsed = 0;
    this.spawnPoint = { x: 0, y: SEA_LEVEL + 2, z: 0 };
    this.weather = 'clear';
    this.perspective = 0;   // 0 = first person, 1 = third person behind
    this.rules = { doDaylightCycle: true, doMobSpawning: true, keepInventory: false };
    this.autosaveTimer = 0;
    /** Swing animation for the held item. */
    this.swing = 0;
    this.swingActive = false;
    this.statusText = '';
    /** Flipped to true at the very end of init(). */
    this.ready = false;
    /** Elapsed time of the last deliberate screen close. */
    this.lastScreenCloseAt = -1;
  }

  /* ---------------------------------------------------------------- */
  /* boot                                                            */
  /* ---------------------------------------------------------------- */

  /** Loads assets and shows the title screen. */
  async init(onProgress = () => {}) {
    onProgress(0.05, 'starting WebGL');
    await this.renderer.init((f, label) => onProgress(0.05 + f * 0.6, label));

    onProgress(0.7, 'building icons');
    this.icons = new IconAtlas(this.renderer.gl);
    await this.icons.build(this.renderer.textures, (rel) => loadImage(DEFAULT_TEXTURE_BASE + rel));

    onProgress(0.85, 'measuring font');
    const fontImage = this.renderer.textures.rawFlat.get('font');
    if (fontImage) font.buildFromImage(fontImage); else font.buildFallback();

    this.hud = new Hud(this.renderer.gui, this.renderer.textures, this.icons);

    onProgress(0.92, 'preparing audio');
    /*
     * Audio setup and save-slot probing deliberately do NOT gate the
     * title screen. Creating an AudioContext and opening IndexedDB can
     * both be slow, and in restricted environments (private browsing,
     * blocked storage) they can take arbitrarily long - none of which
     * should stop the player from seeing a menu. Both settle in the
     * background and the title screen picks up `hasSave` on a later frame
     * because it re-reads the flag every time it draws.
     */
    sound.init()
      .then(() => sound.setMasterVolume(this.settings.masterVolume))
      .catch((err) => console.warn(`[game] audio unavailable: ${err?.message ?? err}`));
    this.storage.hasSave()
      .then((has) => { this.hasSave = has; })
      .catch(() => { this.hasSave = false; });

    this.#wireInput();
    onProgress(1, 'ready');

    this.openScreen(new TitleScreen(this));
    /** Set last: external code can wait on this to know init finished. */
    this.ready = true;
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.#frame(t));
    return this;
  }

  /* ---------------------------------------------------------------- */
  /* world lifecycle                                                 */
  /* ---------------------------------------------------------------- */

  /** Creates a fresh world. */
  startWorld({ seed = '', worldType = 'default' } = {}) {
    const numericSeed = this.#parseSeed(seed);
    this.#createWorld(numericSeed, worldType);
    this.spawnPoint = this.world.findSpawnPoint();
    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z);
    this.day.setTime(1000);
    this.loaded = true;
    this.awaitingSpawn = true;
    this.closeScreen();
    this.chat.info(t('chat.generating', { seed: numericSeed, type: worldType }));
    return this;
  }

  /** Restores the saved world. */
  async loadWorld() {
    const meta = await this.storage.loadMeta();
    if (!meta) { this.chat.error(t('chat.noSave')); return false; }
    this.#createWorld(meta.seed, meta.worldType ?? 'default');
    const chunkRecords = await this.storage.loadChunks();
    for (const record of chunkRecords) this.world.restoreChunk(record);
    this.spawnPoint = meta.spawnPoint ?? this.world.findSpawnPoint();
    this.player.fromJSON(meta.player);
    this.day.restore(meta.day);
    if (meta.rules) Object.assign(this.rules, meta.rules);
    this.loaded = true;
    this.awaitingSpawn = true;
    this.closeScreen();
    this.chat.success(t('chat.loaded', { n: chunkRecords.length }));
    return true;
  }

  /**
   * Attempts spawn placement now.
   *
   * Public so a verification harness (or a future "return to spawn"
   * feature) can resolve a pending spawn deterministically instead of
   * waiting for the frame loop to get around to it.
   * @returns {boolean} true once the player has been placed
   */
  trySettleSpawn() {
    if (!this.awaitingSpawn) return true;
    return this.#settleSpawn();
  }

  /**
   * Places the player on solid ground once the spawn chunk exists.
   *
   * Until the terrain is there, `getBlock` reports air everywhere, so a
   * freshly spawned player would fall through the world and land with
   * fall damage. This keeps them parked until the ground is real, then
   * lifts them to the first gap with headroom - which also stops the
   * camera ending up inside a tree.
   */
  #settleSpawn() {
    const player = this.player;
    if (!this.world.isSpawnReady(player.x, player.z)) return false;
    const x = Math.floor(player.x);
    const z = Math.floor(player.z);
    const y = this.#findSafeSpawnY(x, z);
    player.setPosition(x + 0.5, y, z + 0.5);
    this.spawnPoint = { x: x + 0.5, y, z: z + 0.5 };
    this.awaitingSpawn = false;
    return true;
  }

  /**
   * Lowest y with two blocks of headroom above solid ground.
   *
   * Starts from the generator's terrain surface (not the height map, which
   * counts tree canopies) so the player lands on the ground rather than on
   * top of a tree, then walks upward only if that spot is obstructed.
   */
  #findSafeSpawnY(x, z) {
    const clear = (y) => this.world.getBlock(x, y, z) === 0 && this.world.getBlock(x, y + 1, z) === 0;
    const terrain = this.world.terrainHeightAt(x, z);

    if (terrain > 0) {
      // Ground level first: this is where a player expects to appear.
      for (let y = terrain + 1; y < Math.min(WORLD_HEIGHT - 3, terrain + 12); y++) {
        if (IS_COLLIDABLE[this.world.getBlock(x, y - 1, z)] && clear(y)) return y;
      }
    }
    // Fall back to the topmost obstruction (a cave roof, a building).
    const top = Math.min(WORLD_HEIGHT - 4, Math.max(1, this.world.heightAt(x, z)));
    for (let y = top + 2; y > 1; y--) {
      if (IS_COLLIDABLE[this.world.getBlock(x, y - 1, z)] && clear(y)) return y;
    }
    return SEA_LEVEL + 2;
  }

  /** Persists the world header, player and every edited chunk. */
  async saveWorld() {
    if (!this.world) return false;
    const modified = this.world.modifiedChunks().map((c) => c.serialise());
    const ok = await this.storage.save({
      seed: this.world.seed,
      worldType: this.world.worldType,
      player: this.player.toJSON(),
      day: this.day.serialise(),
      spawnPoint: this.spawnPoint,
      rules: this.rules,
    }, modified);
    if (ok) this.hasSave = true;
    return ok;
  }

  #parseSeed(seed) {
    const text = String(seed ?? '').trim();
    if (!text) return (Math.random() * 0x7fffffff) | 0;
    const numeric = Number(text);
    if (!Number.isNaN(numeric) && text.match(/^-?\d+$/)) return numeric | 0;
    // Hash the text, like vanilla's String.hashCode seeds.
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    return h;
  }

  #createWorld(seed, worldType) {
    this.world?.dispose();
    this.world = new World({
      seed,
      worldType,
      workerUrl: new URL('../workers/chunk-worker.js', import.meta.url).href,
      renderDistance: this.settings.renderDistance,
    });
    this.world.onMesh = (chunk, data) => this.renderer.chunks.upload(chunk, data);
    this.world.onChunkUnload = (chunk) => this.renderer.chunks.release(chunk);
    this.world.setLayerTable(this.renderer.buildLayerTable());

    this.player = new Player(this.world);
    this.player.onDamage = (amount, cause) => this.#onPlayerDamaged(amount, cause);
    this.player.onDeath = () => this.openScreen(new DeathScreen(this));
    this.player.onStep = (blockId, x, y, z) => this.#onFootstep(blockId, x, y, z);
    this.player.onSplash = (x, y, z) => {
      this.particles.emitSplash(x, y + 0.2, z);
      sound.playAt('splash', x, y, z, { volume: 0.6 });
    };

    this.particles = new ParticleSystem(this.renderer.gl, this.renderer.textures, this.world);
    this.entities = new EntityManager(this.renderer.gl, this.renderer.textures, this.icons, this.world);
    this.entities.onPickup = (itemId, count) => {
      sound.play('pop', { volume: 0.25, pitch: 1.6 + Math.random() * 0.3 });
      const def = getItem(itemId);
      if (def) this.hud.showItemName(new ItemStack(itemId, count));
    };
    this.entities.onMobDeath = (mob) => this.#onMobDeath(mob);
    this.entities.onMobAttack = () => sound.play('hurt', { volume: 0.5 });
    this.mining.stop();
  }

  /* ---------------------------------------------------------------- */
  /* input wiring                                                    */
  /* ---------------------------------------------------------------- */

  #wireInput() {
    this.controls.onMouseDown = (button) => this.#onMouseDown(button);
    this.controls.onMouseUp = (button) => this.#onMouseUp(button);
    this.controls.onWheelGui = (delta) => this.screen?.wheel?.(delta, this.#screenContext());
    this.controls.onFullscreenToggle = () => this.toggleFullscreen();
    this.controls.onKeyDownRaw = (e) => {
      /*
       * Screens and the chat bar get first refusal on every key. Returning
       * true tells Controls the press was consumed, so it is not also
       * queued as a game action - which is what previously made E close the
       * inventory synchronously and then reopen it from the queue.
       */
      if (this.chat.open) return this.chat.key(e.code);
      return this.screen?.key?.(e.code, this.#screenContext()) === true;
    };
    this.controls.onPointerLockChange = (locked) => {
      if (locked) return;
      if (!this.loaded || this.screen || this.chat.open) return;
      /*
       * Pressing Escape inside a container closes it - but the browser also
       * releases pointer lock for that same keypress, which would then pop
       * the pause menu open right after. Ignore an unlock that arrives just
       * after we deliberately closed a screen; the game re-requests the lock
       * on the next click anyway.
       */
      if (this.elapsed - this.lastScreenCloseAt < 0.4) return;
      this.openScreen(new PauseScreen(this));
    };

    /*
     * Entering or leaving fullscreen changes the CSS size of the canvas, so
     * the drawing buffer and the GUI scale have to be recomputed. Pointer
     * lock is also dropped by some browsers on the transition, so it is
     * re-acquired when the player was playing.
     */
    this.onFullscreenChange = () => {
      this.renderer.resize(true);
      if (this.loaded && !this.screen && !this.chat.open) this.controls.requestPointerLock();
    };
    for (const event of ['fullscreenchange', 'webkitfullscreenchange']) {
      document.addEventListener(event, this.onFullscreenChange);
    }
  }

  /** True when the page is currently displayed fullscreen. */
  get isFullscreen() {
    return !!(document.fullscreenElement ?? document.webkitFullscreenElement);
  }

  /**
   * Toggles fullscreen, like vanilla's F11.
   *
   * Must be called from a user-gesture handler. The whole document element
   * is used rather than the canvas so the chat bar and any DOM overlay stay
   * visible, and because a fullscreen canvas would ignore the page's
   * background colour.
   */
  toggleFullscreen() {
    const root = document.documentElement;
    const enter = root.requestFullscreen ?? root.webkitRequestFullscreen;
    const exit = document.exitFullscreen ?? document.webkitExitFullscreen;

    if (!enter) {
      this.chat.error(t('chat.fullscreenUnsupported'));
      return false;
    }

    try {
      const result = this.isFullscreen
        ? exit?.call(document)
        : enter.call(root, { navigationUI: 'hide' });
      // Both calls return a promise in modern browsers; a rejection here is
      // a policy decision (sandboxed iframe, kiosk mode), not a crash.
      if (result?.catch) {
        result.catch((err) => {
          console.warn(`[game] fullscreen request denied: ${err?.message ?? err}`);
          this.chat.error(t('chat.fullscreenBlocked'));
        });
      }
    } catch (err) {
      console.warn(`[game] fullscreen failed: ${err?.message ?? err}`);
      this.chat.error(t('chat.fullscreenFailed', { error: err?.message ?? err }));
      return false;
    }
    return true;
  }

  /**
   * Saves the current frame as a PNG, like vanilla's F2.
   *
   * The canvas is read in the same task as a fresh render, because with
   * `preserveDrawingBuffer: false` the backbuffer is undefined once the
   * frame has been composited.
   */
  takeScreenshot() {
    try {
      this.renderFrame(0);
      const url = this.canvas.toDataURL('image/png');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const link = document.createElement('a');
      link.href = url;
      link.download = `webcraft-${stamp}.png`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      this.chat.success(t('chat.screenshotSaved', { name: `webcraft-${stamp}.png` }));
      return true;
    } catch (err) {
      console.warn(`[game] screenshot failed: ${err?.message ?? err}`);
      this.chat.error(t('chat.screenshotFailed', { error: err?.message ?? err }));
      return false;
    }
  }

  /** Cursor position in GUI pixels. */
  #guiCursor() {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.renderer.gui.width / Math.max(1, rect.width);
    const scaleY = this.renderer.gui.height / Math.max(1, rect.height);
    return {
      x: (this.controls.cursorX - rect.left) * scaleX,
      y: (this.controls.cursorY - rect.top) * scaleY,
    };
  }

  #screenContext() {
    const cursor = this.#guiCursor();
    return {
      hud: this.hud,
      game: this,
      cursorX: cursor.x,
      cursorY: cursor.y,
      shift: this.controls.keys.has('ShiftLeft') || this.controls.keys.has('ShiftRight'),
    };
  }

  #onMouseDown(button) {
    sound.unlock();
    if (this.screen) {
      const ctx = this.#screenContext();
      this.screen.mouseDown?.(ctx.cursorX, ctx.cursorY, button, ctx);
      return;
    }
    if (!this.loaded) return;
    if (!this.controls.pointerLocked) { this.controls.requestPointerLock(); return; }
    if (button === 0) this.#startBreaking();
    else if (button === 2) this.#usePlace();
    else if (button === 1) this.#pickBlock();
  }

  #onMouseUp(button) {
    if (this.screen) {
      const ctx = this.#screenContext();
      this.screen.mouseUp?.(ctx.cursorX, ctx.cursorY, button, ctx);
      return;
    }
    if (button === 0) this.mining.stop();
  }

  /** Processes the one-shot action queue. */
  #handleActions() {
    const actions = this.controls.takeActions();
    if (!actions) return;
    for (const action of actions) {
      switch (action.type) {
        case 'pause':
          if (this.chat.open) this.chat.closeBar();
          else if (this.screen) this.closeScreen();
          else if (this.loaded) this.openScreen(new PauseScreen(this));
          break;
        case 'inventory':
          if (this.screen) this.closeScreen();
          else if (this.loaded) {
            this.openScreen(this.player.isCreative ? new CreativeScreen(this) : new InventoryScreen(this));
          }
          break;
        case 'chat':
          if (!this.screen && this.loaded) {
            this.controls.exitPointerLock();
            this.chat.openBar(action.command ? '/' : '');
          }
          break;
        case 'text-submit': this.chat.submit(); this.controls.requestPointerLock(); break;
        case 'text-cancel':
          if (this.chat.open) { this.chat.closeBar(); this.controls.requestPointerLock(); }
          break;
        case 'text-complete': this.chat.complete(); break;
        case 'debug': this.debug.toggle(); break;
        case 'perspective': this.perspective = (this.perspective + 1) % 2; break;
        case 'screenshot': this.takeScreenshot(); break;
        case 'drop': this.#dropHeld(action.all); break;
        case 'hotbar':
          if (this.loaded && !this.screen) {
            this.player.inventory.selectSlot(action.slot);
            this.hud.showItemName(this.player.inventory.held);
          }
          break;
        case 'jump-tap':
          if (this.loaded && !this.screen && !this.chat.open) this.player.tapJump(this.elapsed);
          break;
        case 'touch-tap':
          if (this.loaded && !this.screen) this.#startBreaking();
          break;
        default: break;
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* screens                                                         */
  /* ---------------------------------------------------------------- */

  openScreen(screen) {
    this.screen?.onClose?.();
    this.screen = screen;
    this.controls.guiMode = screen?.grabsCursor ?? false;
    if (screen?.grabsCursor) this.controls.exitPointerLock();
    this.mining.stop();
  }

  closeScreen() {
    this.screen?.onClose?.();
    this.screen = null;
    // Timestamp so a pointer-lock release caused by the same Escape press
    // does not immediately open the pause menu.
    this.lastScreenCloseAt = this.elapsed;
    this.controls.guiMode = false;
    if (this.loaded) this.controls.requestPointerLock();
  }

  /** Pause-menu button dispatch. */
  handleMenuAction(action) {
    switch (action) {
      case 'resume': this.closeScreen(); break;
      case 'settings': this.openScreen(new SettingsScreen(this)); break;
      case 'save':
        this.saveWorld().then((ok) => this.chat[ok ? 'success' : 'error'](t(ok ? 'chat.saved' : 'chat.saveFailed')));
        break;
      case 'mode': {
        const order = [GAME_MODE.SURVIVAL, GAME_MODE.CREATIVE, GAME_MODE.SPECTATOR];
        const next = order[(order.indexOf(this.player.mode) + 1) % order.length];
        this.player.setMode(next);
        break;
      }
      case 'quit':
        this.saveWorld().finally(() => {
          this.loaded = false;
          this.openScreen(new TitleScreen(this));
        });
        break;
      default: break;
    }
  }

  /** Applies a settings change from the settings screen. */
  applySetting(key, value) {
    switch (key) {
      case 'renderDistance':
        this.settings.renderDistance = clamp(value, 2, 16);
        this.renderer.applySettings({ renderDistance: this.settings.renderDistance });
        this.world?.setRenderDistance(this.settings.renderDistance);
        break;
      case 'fov':
        this.settings.fov = clamp(value, 30, 120);
        this.renderer.applySettings({ fov: this.settings.fov });
        break;
      case 'sensitivity':
        this.settings.sensitivity = clamp(value, 10, 400) / 45454;
        this.controls.sensitivity = this.settings.sensitivity;
        break;
      case 'brightness':
        this.settings.brightness = clamp(value, 0, 40) / 200;
        this.renderer.applySettings({ brightness: this.settings.brightness });
        break;
      case 'guiScale':
        this.settings.guiScale = clamp(value, 0, 4);
        this.renderer.applySettings({ guiScale: this.settings.guiScale });
        break;
      case 'masterVolume':
        this.settings.masterVolume = clamp(value, 0, 100) / 100;
        sound.setMasterVolume(this.settings.masterVolume);
        break;
      case 'clouds':
        this.settings.clouds = !!value;
        this.renderer.applySettings({ clouds: this.settings.clouds });
        break;
      case 'language': {
        // 'next' comes from the settings button; an explicit tag is also
        // accepted so a saved preference can be restored verbatim.
        const chosen = value === 'next' ? nextLocale() : (setLocale(value) ? value : getLocale());
        this.settings.language = chosen;
        break;
      }
      case 'viewBobbing': this.settings.viewBobbing = !!value; break;
      case 'showFps': this.settings.showFps = !!value; break;
      default: this.settings[key] = value; break;
    }
    saveSettings(this.settings);
  }

  /* ---------------------------------------------------------------- */
  /* interactions                                                    */
  /* ---------------------------------------------------------------- */

  /** Re-casts the view ray and updates `this.target`. */
  #updateTarget() {
    if (!this.loaded || this.player.isSpectator) { this.target.reset(); return; }
    const eyeY = this.player.eyeY;
    raycastVoxels(
      this.world,
      this.player.x, eyeY, this.player.z,
      this.camera.forward[0], this.camera.forward[1], this.camera.forward[2],
      this.player.reach,
      (id) => id !== 0 && !IS_LIQUID[id],
      this.target,
    );
  }

  #startBreaking() {
    if (!this.target.hit) {
      // Swinging at nothing still animates and can hit a mob.
      this.#attackMob();
      this.swingActive = true;
      return;
    }
    this.swingActive = true;
    const mob = this.entities.pickMob(
      this.player.x, this.player.eyeY, this.player.z,
      this.camera.forward[0], this.camera.forward[1], this.camera.forward[2],
      Math.min(this.player.reach, this.target.distance),
    );
    if (mob) { this.#attackMob(mob); return; }
    const held = this.player.inventory.held;
    this.mining.target(this.target.x, this.target.y, this.target.z, this.target.block, held.id);
  }

  #attackMob(known = null) {
    const mob = known ?? this.entities.pickMob(
      this.player.x, this.player.eyeY, this.player.z,
      this.camera.forward[0], this.camera.forward[1], this.camera.forward[2],
      this.player.reach,
    );
    if (!mob) return;
    const held = this.player.inventory.held;
    const damage = held.isEmpty ? 1 : (held.def?.attackDamage ?? 1);
    mob.damage(damage);
    // Knock the mob away from the player.
    const dx = mob.x - this.player.x;
    const dz = mob.z - this.player.z;
    const len = Math.hypot(dx, dz) || 1;
    mob.vx += (dx / len) * 5;
    mob.vz += (dz / len) * 5;
    this.particles.emitCrit(mob.x, mob.y + mob.height * 0.6, mob.z, 6);
    sound.playAt('hurt', mob.x, mob.y, mob.z, { volume: 0.45 });
    if (!held.isEmpty && held.maxDurability) {
      if (held.damageBy(1)) sound.play('click', { volume: 0.5 });
    }
  }

  /** Breaks the block the mining state has finished. */
  #breakBlock(x, y, z) {
    const id = this.world.getBlock(x, y, z);
    if (id === 0) return;
    const def = getBlock(id);
    if (def.hardness < 0) return;

    const held = this.player.inventory.held;
    this.world.setBlock(x, y, z, 0);
    this.particles.emitBlockBreak(x, y, z, id);
    sound.playAt(`dig_${def.sound}`, x + 0.5, y + 0.5, z + 0.5, { volume: 0.55 });

    if (!this.player.isCreative) {
      for (const drop of blockDrops(def, held.id)) {
        this.entities.dropItem(x + 0.5, y + 0.25, z + 0.5, new ItemStack(drop.item, drop.count));
      }
      if (!held.isEmpty && held.maxDurability && def.hardness > 0) {
        if (held.damageBy(1)) sound.play('click', { volume: 0.5 });
      }
      this.player.exhaustion += 0.005;
    }

    // Neighbouring plants fall, and sand/gravel above collapses.
    updateSupports(this.world, x, y, z);
    settleGravity(this.world, x, y + 1, z);
    // Water rushes into the gap.
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) {
      if (this.world.getBlock(x + dx, y + dy, z + dz) === B.WATER) {
        spreadLiquid(this.world, x + dx, y + dy, z + dz, B.WATER, 12);
        break;
      }
    }
    this.mining.stop();
  }

  /** Right click: place a block, use an item, or open a container. */
  #usePlace() {
    this.swingActive = true;
    const inv = this.player.inventory;
    const held = inv.held;

    // --- open a crafting table ---------------------------------
    if (this.target.hit && this.world.getBlock(this.target.x, this.target.y, this.target.z) === B.CRAFTING_TABLE) {
      this.openScreen(new CraftingScreen(this));
      return;
    }

    // --- eat ---------------------------------------------------
    if (!held.isEmpty && held.def?.food) {
      if (this.player.eat(held.def)) {
        if (!this.player.isCreative) inv.consume(inv.selected);
        sound.play('pop', { volume: 0.4, pitch: 0.9 });
        return;
      }
    }

    // --- place -------------------------------------------------
    if (held.isEmpty || !held.def?.placesBlock || !this.target.hit) return;
    const blockId = held.def.placesBlock;
    const px = this.target.placeX();
    const py = this.target.placeY();
    const pz = this.target.placeZ();
    if (!canPlaceAt(this.world, px, py, pz, blockId, [this.player.box])) return;

    if (!this.world.setBlock(px, py, pz, blockId)) return;
    const def = getBlock(blockId);
    sound.playAt(`dig_${def.sound}`, px + 0.5, py + 0.5, pz + 0.5, { volume: 0.5, pitch: 0.85 });
    if (!this.player.isCreative) inv.consume(inv.selected);
    settleGravity(this.world, px, py, pz);
  }

  /** Middle click: copy the targeted block into the hand. */
  #pickBlock() {
    if (!this.target.hit) return;
    this.player.inventory.pickBlock(this.target.block, this.player.isCreative);
    this.hud.showItemName(this.player.inventory.held);
  }

  /** Q: throw the held item (or the whole stack with Ctrl). */
  #dropHeld(all) {
    if (!this.loaded || this.screen) return;
    const inv = this.player.inventory;
    const held = inv.held;
    if (held.isEmpty) return;
    const count = all ? held.count : 1;
    const stack = new ItemStack(held.id, count, held.damage);
    held.count -= count;
    if (held.count <= 0) held.clear();
    inv.version++;
    this.dropStack(stack);
  }

  /** Throws a stack out in front of the player. */
  dropStack(stack) {
    if (!stack || stack.isEmpty) return;
    this.entities.dropItem(
      this.player.x, this.player.eyeY - 0.3, this.player.z, stack,
      [this.camera.forward[0], this.camera.forward[1], this.camera.forward[2]],
    );
  }

  #onFootstep(blockId, x, y, z) {
    const def = getBlock(blockId);
    sound.playStep(def.sound, x, y, z);
    if (def.sound === 'gravel' || def.sound === 'sand' || def.sound === 'snow') {
      this.particles.emitStepDust(x, y, z, blockId, 3);
    }
  }

  #onPlayerDamaged(amount, cause) {
    this.hud.onDamaged();
    sound.play('hurt', { volume: 0.7 });
    void amount; void cause;
  }

  #onMobDeath(mob) {
    for (const entry of mob.loot()) {
      const count = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
      if (count <= 0) continue;
      const item = itemsByName.get(entry.item);
      if (item) {
        this.entities.dropItem(mob.x, mob.y + 0.4, mob.z, new ItemStack(item.id, count));
      }
    }
    this.particles.emitSmoke(mob.x, mob.y + 0.5, mob.z, 6);
    sound.playAt('pop', mob.x, mob.y, mob.z, { volume: 0.4, pitch: 0.7 });
  }

  /** /weather */
  setWeather(kind) { this.weather = kind; }

  /** /summon */
  summonMob(kind) {
    const forward = this.camera.forward;
    const x = this.player.x + forward[0] * 3;
    const z = this.player.z + forward[2] * 3;
    const y = this.world.surfaceY(Math.floor(x), Math.floor(z));
    return !!this.entities.spawnMob(kind, x, y, z);
  }

  respawn() {
    if (!this.rules.keepInventory) {
      for (const stack of this.player.inventory.dropAll()) {
        this.entities.dropItem(this.player.x, this.player.y + 0.5, this.player.z, stack);
      }
    }
    this.player.respawn(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z);
    this.closeScreen();
  }

  /* ---------------------------------------------------------------- */
  /* loop                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * One animation frame.
   *
   * The body is guarded and the next frame is always requested: without
   * that, a single exception anywhere in update or render would silently
   * stop the whole game (the rAF chain would never be re-armed) and the
   * player would just see a frozen picture.
   */
  #frame(now) {
    if (!this.running) return;
    try {
      const frameMs = now - this.lastFrame;
      this.lastFrame = now;
      const dt = Math.min(0.1, frameMs / 1000);
      this.elapsed += dt;
      this.debug.sample(frameMs);

      this.renderer.resize();
      this.#handleActions();

      const screenPauses = this.screen?.pausesGame ?? false;
      if (this.loaded && !screenPauses && !this.chat.open) {
        this.#updateGameplay(dt);
      } else if (this.loaded) {
        // Keep streaming chunks even while paused so the view is complete.
        this.world.update(this.player.x, this.player.z);
        this.world.drainMeshQueue(2);
      }

      this.#render(dt);
    } catch (err) {
      this.#onFrameError(err);
    }
    requestAnimationFrame((t) => this.#frame(t));
  }

  /**
   * Reports a frame error once per unique message so a recurring fault
   * does not flood the chat, and keeps the game playable.
   */
  #onFrameError(err) {
    const key = String(err?.message ?? err);
    this._reportedErrors ??= new Set();
    console.error('[game] frame error:', err);
    if (this._reportedErrors.has(key)) return;
    this._reportedErrors.add(key);
    this.chat.error(t('chat.internalError', { error: key }));
  }

  /**
   * Advances the simulation by `dt` seconds using exactly the same path
   * the frame loop takes.
   *
   * Public so verification harnesses drive the real loop rather than a
   * reimplementation of it - a copy would happily pass while the real
   * loop was broken.
   */
  stepSimulation(dt = 1 / 60) {
    const clamped = Math.min(0.1, Math.max(0, dt));
    this.elapsed += clamped;
    this.#handleActions();
    const screenPauses = this.screen?.pausesGame ?? false;
    if (this.loaded && !screenPauses && !this.chat.open) {
      this.#updateGameplay(clamped);
    } else if (this.loaded) {
      this.world.update(this.player.x, this.player.z);
      this.world.drainMeshQueue(2);
    }
  }

  /**
   * Renders one frame on demand.
   *
   * Public so headless verification harnesses (and any future replay
   * tooling) can drive rendering without relying on
   * requestAnimationFrame, which barely fires under a virtual clock.
   */
  renderFrame(dt = 1 / 60) {
    this.#render(dt);
  }

  #updateGameplay(dt) {
    const player = this.player;

    // --- hold the player still until the ground below them exists ---
    if (this.awaitingSpawn) {
      this.#settleSpawn();
      this.world.update(player.x, player.z);
      this.world.drainMeshQueue();
      this.camera.yaw = player.yaw;
      this.camera.pitch = player.pitch;
      this.camera.setPosition(player.x, player.eyeY, player.z);
      this.camera.update(this.renderer.aspect);
      if (this.rules.doDaylightCycle) this.day.update(dt);
      return;
    }

    // --- look ------------------------------------------------------
    const look = this.controls.takeLookDelta();
    if (look.yaw || look.pitch) {
      player.yaw += look.yaw;
      player.pitch = clamp(player.pitch + look.pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
    }
    const wheel = this.controls.takeWheelSteps();
    if (wheel) {
      player.inventory.scrollSelection(wheel);
      this.hud.showItemName(player.inventory.held);
    }

    // --- move ------------------------------------------------------
    player.update(dt, this.controls.movementInput());
    this.camera.yaw = player.yaw;
    this.camera.pitch = player.pitch;

    // --- view bobbing + third person -------------------------------
    let eyeX = player.x; let eyeY = player.eyeY; let eyeZ = player.z;
    if (this.settings.viewBobbing && player.onGround && !this.perspective) {
      const amount = Math.min(1, Math.hypot(player.vx, player.vz) / 5);
      eyeY += Math.sin(player.bobPhase * 2) * 0.035 * amount;
      this.camera.roll = Math.sin(player.bobPhase) * 0.014 * amount;
    } else {
      this.camera.roll = damp(this.camera.roll, 0, 10, dt);
    }
    if (this.perspective === 1) {
      const back = 4;
      eyeX -= this.camera.forward[0] * back;
      eyeY -= this.camera.forward[1] * back;
      eyeZ -= this.camera.forward[2] * back;
    }
    this.camera.setPosition(eyeX, eyeY, eyeZ);
    // FOV nudges while sprinting and underwater, like vanilla.
    const targetFov = (player.sprinting ? 1.10 : 1) * (player.headInWater ? 0.9 : 1);
    this.camera.fovModifier = damp(this.camera.fovModifier, targetFov, 8, dt);
    this.camera.update(this.renderer.aspect);

    // --- targeting + mining ---------------------------------------
    this.#updateTarget();
    if (this.controls.isMouseDown(0) && !this.screen) {
      if (this.target.hit) {
        const changed = this.mining.target(
          this.target.x, this.target.y, this.target.z,
          this.target.block, player.inventory.held.id,
        );
        void changed;
        if (this.mining.advance(dt)) {
          this.#breakBlock(this.mining.x, this.mining.y, this.mining.z);
        } else if (Math.random() < dt * 12) {
          this.particles.emitBlockHit(
            this.target.x, this.target.y, this.target.z,
            this.target.nx, this.target.ny, this.target.nz, this.target.block,
          );
        }
      } else this.mining.stop();
      this.swingActive = true;
    } else if (!this.controls.isMouseDown(0)) {
      this.mining.stop();
    }

    // --- swing animation -------------------------------------------
    if (this.swingActive) {
      this.swing += dt * 4.2;
      if (this.swing >= 1) { this.swing = 0; this.swingActive = this.controls.isMouseDown(0); }
    }

    // --- fixed ticks ----------------------------------------------
    this.accumulator += dt;
    let ticks = 0;
    while (this.accumulator >= TICK_LENGTH && ticks < MAX_TICKS_PER_FRAME) {
      this.accumulator -= TICK_LENGTH;
      ticks++;
      this.#tick();
    }
    if (this.accumulator > TICK_LENGTH * MAX_TICKS_PER_FRAME) this.accumulator = 0;

    // --- continuous systems ---------------------------------------
    if (this.rules.doDaylightCycle) this.day.update(dt);
    else this.day.update(0);
    this.world.update(player.x, player.z);
    this.world.drainMeshQueue();
    this.particles.update(dt);
    this.entities.update(dt, player, this.day);
    this.chat.update(dt);
    this.hud.update(dt, player);

    sound.setListener(this.camera.position[0], this.camera.position[1], this.camera.position[2], player.yaw);

    // --- ambience --------------------------------------------------
    if (this.target.hit) {
      const id = this.world.getBlock(this.target.x, this.target.y, this.target.z);
      if (id === B.TORCH && Math.random() < dt * 6) {
        this.particles.emitFlame(this.target.x + 0.5, this.target.y + 0.68, this.target.z + 0.5);
      }
    }
    if (player.headInWater && Math.random() < dt * 3) {
      this.particles.emitBubble(player.x, player.eyeY, player.z);
    }

    // --- autosave --------------------------------------------------
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 120) {
      this.autosaveTimer = 0;
      this.saveWorld();
    }
  }

  /** Fixed 20 Hz tick for deterministic systems. */
  #tick() {
    if (this.rules.doMobSpawning) {
      this.tickCounter = (this.tickCounter ?? 0) + 1;
      if (this.tickCounter % 60 === 0) {
        if (this.day.daylight < 0.35) this.entities.trySpawnHostile(this.player, this.day);
        else if (this.tickCounter % 180 === 0) this.entities.trySpawnPassive(this.player);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* rendering                                                       */
  /* ---------------------------------------------------------------- */

  #render(dt) {
    const gl = this.renderer.gl;

    if (!this.loaded) {
      // Title screen: a flat sky plus the menu.
      gl.clearColor(0.05, 0.06, 0.09, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    } else {
      this.renderer.renderWorld({
        camera: this.camera,
        world: this.world,
        day: this.day,
        dt,
        target: this.target.hit
          ? { x: this.target.x, y: this.target.y, z: this.target.z, progress: this.mining.progress }
          : null,
        entities: this.entities,
        particles: this.particles,
      });
    }

    // --- 2D layer -------------------------------------------------
    const batch = this.renderer.gui;
    batch.begin();
    if (this.loaded) {
      this.hud.draw({
        player: this.player,
        showCrosshair: !this.screen && this.perspective === 0,
        underwater: this.player.headInWater,
        chat: this.chat,
        dt,
      });
      this.debug.draw({
        hud: this.hud,
        player: this.player,
        world: this.world,
        renderer: this.renderer,
        day: this.day,
        target: this.target.hit ? this.target : null,
        camera: this.camera,
        particles: this.particles,
        entities: this.entities,
      });
      if (this.settings.showFps && !this.debug.visible) {
        this.hud.drawText(`${this.debug.fps} fps`, 3, 3, { color: 0xffff80 });
      }
    } else {
      this.chat.draw(batch, this.hud, dt);
    }

    if (this.screen) {
      const ctx = this.#screenContext();
      this.screen.update?.(ctx);
      this.screen.draw(ctx);
      // Draw a cursor since the pointer is unlocked.
      batch.rect(ctx.cursorX - 1, ctx.cursorY - 5, 2, 10, 0xffffff, 0.9);
      batch.rect(ctx.cursorX - 5, ctx.cursorY - 1, 10, 2, 0xffffff, 0.9);
    }
    batch.end();
  }

  dispose() {
    this.running = false;
    if (this.onFullscreenChange) {
      for (const event of ['fullscreenchange', 'webkitfullscreenchange']) {
        document.removeEventListener(event, this.onFullscreenChange);
      }
    }
    this.controls.dispose();
    this.world?.dispose();
    this.particles?.dispose();
    this.entities?.dispose();
    this.icons?.dispose();
    this.renderer.dispose();
  }
}

export { blocks, getBlock };

