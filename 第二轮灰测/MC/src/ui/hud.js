/**
 * ui/hud.js
 * ------------------------------------------------------------------
 * The in-game heads-up display, drawn with the vanilla GUI sprite sheets
 * so it looks like the real thing:
 *
 *   widgets.png -> hotbar frame, selection outline, crosshair
 *   icons.png   -> hearts, hunger haunches, armour, breath bubbles,
 *                  experience bar
 *
 * Sprite coordinates below are the vanilla atlas offsets.
 */

import { font } from './font.js';
import { DynamicGlyphCache } from './glyph-cache.js';
import { MAX_HEALTH, MAX_HUNGER } from '../player/player.js';
import { getItem } from '../game/items.js';
import { entryName } from './i18n.js';

/** Characters above this code point are not in the 256-glyph bitmap sheet. */
const BITMAP_MAX_CODE_POINT = 0xff;
/** Quick test for "this string needs the dynamic glyph cache". */
const NEEDS_DYNAMIC = /[^\u0000-\u00ff]/;
/** Section sign used by vanilla's colour/format codes. */
const FORMAT_CHAR = '\u00a7';

/** Regions inside gui/widgets.png. */
const W = {
  hotbar: { x: 0, y: 0, w: 182, h: 22 },
  selection: { x: 0, y: 22, w: 24, h: 24 },
  crosshairSheet: 'icons',
};

/** Regions inside gui/icons.png. */
const I = {
  crosshair: { x: 0, y: 0, w: 15, h: 15 },
  heartBackground: { x: 16, y: 0, w: 9, h: 9 },
  heartFull: { x: 52, y: 0, w: 9, h: 9 },
  heartHalf: { x: 61, y: 0, w: 9, h: 9 },
  heartFlashBackground: { x: 25, y: 0, w: 9, h: 9 },
  hungerBackground: { x: 16, y: 27, w: 9, h: 9 },
  hungerFull: { x: 52, y: 27, w: 9, h: 9 },
  hungerHalf: { x: 61, y: 27, w: 9, h: 9 },
  armourBackground: { x: 16, y: 9, w: 9, h: 9 },
  armourFull: { x: 34, y: 9, w: 9, h: 9 },
  armourHalf: { x: 25, y: 9, w: 9, h: 9 },
  bubble: { x: 16, y: 18, w: 9, h: 9 },
  bubblePop: { x: 25, y: 18, w: 9, h: 9 },
  xpBarBackground: { x: 0, y: 64, w: 182, h: 5 },
  xpBarFill: { x: 0, y: 69, w: 182, h: 5 },
};

export class Hud {
  /**
   * @param {import('../gfx/sprite-batch.js').SpriteBatch} batch
   * @param {import('../gfx/textures.js').TextureSet} textures
   * @param {import('./icon-atlas.js').IconAtlas} icons
   */
  constructor(batch, textures, icons) {
    this.batch = batch;
    this.textures = textures;
    this.icons = icons;
    /**
     * Fallback atlas for code points the bitmap sheet lacks (CJK, Cyrillic,
     * ...). Created lazily on first use so a purely ASCII session never
     * allocates a 512x512 texture.
     */
    this.glyphs = null;
    /** Held-item name toast, shown briefly after switching slots. */
    this.itemToast = { text: '', time: 0 };
    /** Damage flash timer. */
    this.hurtFlash = 0;
    /** Heart wobble timer, like vanilla's low-health shake. */
    this.heartBeat = 0;
  }

  /** Creates the dynamic glyph cache on demand. */
  #glyphCache() {
    if (!this.glyphs) this.glyphs = new DynamicGlyphCache(this.batch.gl);
    return this.glyphs;
  }

  /** Announces the newly selected item, like vanilla's slot toast. */
  showItemName(stack) {
    const def = stack?.def;
    this.itemToast = { text: def ? entryName(def.name, def.displayName) : '', time: def ? 2.2 : 0 };
  }

  update(dt, player) {
    if (this.itemToast.time > 0) this.itemToast.time -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt * 2;
    this.heartBeat += dt * (player.health <= 4 ? 9 : 0);
  }

  onDamaged() { this.hurtFlash = 1; }

  /* ---------------------------------------------------------------- */
  /* drawing                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * @param {object} ctx
   * @param {import('../player/player.js').Player} ctx.player
   * @param {boolean} ctx.showCrosshair
   */
  draw({ player, showCrosshair = true, underwater = false, chat = null, dt = 0 }) {
    const b = this.batch;
    const w = b.width;
    const h = b.height;
    const icons = this.textures.get('icons');
    const widgets = this.textures.get('widgets');

    // --- damage / underwater tint ------------------------------
    if (this.hurtFlash > 0) {
      b.rect(0, 0, w, h, 0xff0000, 0.32 * Math.min(1, this.hurtFlash));
    }
    if (underwater) {
      b.rect(0, 0, w, h, 0x1a4a72, 0.22);
    }

    // --- crosshair ---------------------------------------------
    if (showCrosshair) {
      // Vanilla inverts the crosshair against the scene; plain alpha is
      // close enough and avoids a second blend mode.
      b.sprite(icons, Math.floor(w / 2) - 8, Math.floor(h / 2) - 8, 16, 16,
        I.crosshair.x, I.crosshair.y, I.crosshair.w, I.crosshair.h, 0xffffff, 0.85);
    }

    if (player.isSpectator) { this.#drawChat(chat, dt); return; }

    // --- hotbar -------------------------------------------------
    const hotbarX = Math.floor((w - W.hotbar.w) / 2);
    const hotbarY = h - W.hotbar.h - 1;
    b.sprite(widgets, hotbarX, hotbarY, W.hotbar.w, W.hotbar.h,
      W.hotbar.x, W.hotbar.y, W.hotbar.w, W.hotbar.h);

    for (let i = 0; i < 9; i++) {
      const slot = player.inventory.get(i);
      if (slot.isEmpty) continue;
      this.drawItem(slot, hotbarX + 3 + i * 20, hotbarY + 3);
    }
    // selection frame last so it sits on top
    const sel = player.inventory.selected;
    b.sprite(widgets, hotbarX - 1 + sel * 20, hotbarY - 1, W.selection.w, W.selection.h,
      W.selection.x, W.selection.y, W.selection.w, W.selection.h);

    // --- survival bars ------------------------------------------
    if (player.takesDamage) {
      this.#drawHealth(player, hotbarX, hotbarY, icons);
      this.#drawHunger(player, hotbarX, hotbarY, icons);
      this.#drawArmour(player, hotbarX, hotbarY, icons);
      this.#drawBreath(player, hotbarX, hotbarY, icons);
    }
    this.#drawExperience(player, hotbarX, hotbarY, icons);

    // --- item name toast ---------------------------------------
    if (this.itemToast.time > 0 && this.itemToast.text) {
      const alpha = Math.min(1, this.itemToast.time / 0.6);
      this.drawText(this.itemToast.text, Math.floor(w / 2), hotbarY - 24,
        { align: 'center', alpha, color: 0xffffff });
    }

    this.#drawChat(chat, dt);
  }

  #drawHealth(player, hotbarX, hotbarY, icons) {
    const b = this.batch;
    const y = hotbarY - 20;
    const hearts = Math.ceil(MAX_HEALTH / 2);
    for (let i = 0; i < hearts; i++) {
      const x = hotbarX + i * 8;
      // Low health makes hearts jitter, as in vanilla.
      const jitter = player.health <= 4 ? Math.round(Math.sin(this.heartBeat + i) * 1) : 0;
      b.sprite(icons, x, y + jitter, 9, 9,
        I.heartBackground.x, I.heartBackground.y, 9, 9);
      const value = player.health - i * 2;
      if (value >= 2) {
        b.sprite(icons, x, y + jitter, 9, 9, I.heartFull.x, I.heartFull.y, 9, 9);
      } else if (value > 0) {
        b.sprite(icons, x, y + jitter, 9, 9, I.heartHalf.x, I.heartHalf.y, 9, 9);
      }
    }
  }

  #drawHunger(player, hotbarX, hotbarY, icons) {
    const b = this.batch;
    const y = hotbarY - 20;
    const total = Math.ceil(MAX_HUNGER / 2);
    for (let i = 0; i < total; i++) {
      // Hunger fills right-to-left from the right edge of the hotbar.
      const x = hotbarX + 182 - 9 - i * 8;
      b.sprite(icons, x, y, 9, 9, I.hungerBackground.x, I.hungerBackground.y, 9, 9);
      const value = player.hunger - i * 2;
      if (value >= 2) {
        b.sprite(icons, x, y, 9, 9, I.hungerFull.x, I.hungerFull.y, 9, 9);
      } else if (value > 0) {
        b.sprite(icons, x, y, 9, 9, I.hungerHalf.x, I.hungerHalf.y, 9, 9);
      }
    }
  }

  #drawArmour(player, hotbarX, hotbarY, icons) {
    const points = player.inventory.armourPoints();
    if (points <= 0) return;
    const b = this.batch;
    const y = hotbarY - 29;
    for (let i = 0; i < 10; i++) {
      const x = hotbarX + i * 8;
      b.sprite(icons, x, y, 9, 9, I.armourBackground.x, I.armourBackground.y, 9, 9);
      const value = points - i * 2;
      if (value >= 2) b.sprite(icons, x, y, 9, 9, I.armourFull.x, I.armourFull.y, 9, 9);
      else if (value > 0) b.sprite(icons, x, y, 9, 9, I.armourHalf.x, I.armourHalf.y, 9, 9);
    }
  }

  #drawBreath(player, hotbarX, hotbarY, icons) {
    if (player.air >= 300) return;
    const b = this.batch;
    const y = hotbarY - 29;
    const bubbles = Math.ceil((player.air / 300) * 10);
    for (let i = 0; i < 10; i++) {
      const x = hotbarX + 182 - 9 - i * 8;
      if (i < bubbles) b.sprite(icons, x, y, 9, 9, I.bubble.x, I.bubble.y, 9, 9);
      else if (i === bubbles) b.sprite(icons, x, y, 9, 9, I.bubblePop.x, I.bubblePop.y, 9, 9);
    }
  }

  #drawExperience(player, hotbarX, hotbarY, icons) {
    const b = this.batch;
    const y = hotbarY - 8;
    b.sprite(icons, hotbarX, y, 182, 5,
      I.xpBarBackground.x, I.xpBarBackground.y, 182, 5);
    const filled = Math.round(player.xpProgress * 182);
    if (filled > 0) {
      b.sprite(icons, hotbarX, y, filled, 5, I.xpBarFill.x, I.xpBarFill.y, filled, 5);
    }
    if (player.xpLevel > 0) {
      const text = String(player.xpLevel);
      const cx = Math.floor(hotbarX + 91);
      // Vanilla outlines the level number in black.
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        this.drawText(text, cx + dx, y - 8 + dy, { align: 'center', color: 0x000000, shadow: false });
      }
      this.drawText(text, cx, y - 8, { align: 'center', color: 0x80ff20, shadow: false });
    }
  }

  #drawChat(chat, dt) {
    if (!chat) return;
    chat.draw(this.batch, this, dt);
  }

  /* ---------------------------------------------------------------- */
  /* shared helpers used by every screen                             */
  /* ---------------------------------------------------------------- */

  /**
   * Draws an item icon plus its stack count and durability bar.
   * @param {import('../game/inventory.js').ItemStack} stack
   */
  drawItem(stack, x, y, size = 16) {
    if (!stack || stack.isEmpty) return;
    const uv = this.icons.uvFor(stack.id);
    if (uv) {
      this.batch.setTexture(this.icons.record);
      this.batch.quad(x, y, size, size, uv[0], uv[1], uv[2], uv[3]);
    }
    if (stack.count > 1) {
      this.drawText(String(stack.count), x + size + 1, y + size - 7,
        { align: 'right', color: 0xffffff });
    }
    const frac = stack.durabilityFraction;
    if (frac < 1) {
      const barW = size - 2;
      const filled = Math.max(1, Math.round(barW * frac));
      // Green -> red as the tool wears out.
      const hue = frac;
      const colour = ((Math.round((1 - hue) * 255) << 16) | (Math.round(hue * 255) << 8)) & 0xffffff;
      this.batch.rect(x + 1, y + size - 3, barW, 2, 0x000000, 1);
      this.batch.rect(x + 1, y + size - 3, filled, 1, colour, 1);
    }
  }

  /**
   * Draws text.
   *
   * Pure Latin-1 strings take the fast path straight through the vanilla
   * bitmap font. Anything containing other scripts is laid out character by
   * character so the dynamic glyph cache can supply the missing glyphs -
   * otherwise Chinese chat would advance the cursor and draw nothing.
   *
   * @param {object} [opts] see BitmapFont#layout
   */
  drawText(text, x, y, opts = {}) {
    const str = String(text ?? '');
    if (!NEEDS_DYNAMIC.test(str)) return this.#drawBitmapText(str, x, y, opts);
    return this.#drawMixedText(str, x, y, opts);
  }

  /** The vanilla bitmap-font path, unchanged. */
  #drawBitmapText(text, x, y, opts) {
    const layout = font.layout(text, x, y, opts);
    const record = this.textures.get('font');
    this.batch.setTexture(record);
    for (const q of layout.quads) {
      this.batch.quad(q.x, q.y, q.w, q.h, q.u0, q.v0, q.u1, q.v1, q.color, q.alpha);
    }
    return layout;
  }

  /**
   * Mixed-script layout: walks code points, keeping Latin-1 runs on the
   * bitmap sheet and pulling everything else from the glyph cache.
   * Honours §-codes, alignment, scale, alpha and the drop shadow.
   */
  #drawMixedText(text, x, y, opts) {
    const scale = opts.scale ?? 1;
    const alpha = opts.alpha ?? 1;
    const shadow = opts.shadow ?? true;
    const baseColour = opts.color ?? 0xffffff;
    const align = opts.align ?? 'left';

    const width = this.measure(text) * scale;
    let originX = x;
    if (align === 'center') originX = x - width / 2;
    else if (align === 'right') originX = x - width;

    // Shadow first so it sits behind every glyph, as vanilla does.
    const passes = shadow ? [true, false] : [false];
    for (const isShadow of passes) {
      let penX = originX + (isShadow ? scale : 0);
      const penY = y + (isShadow ? scale : 0);
      let colour = baseColour;

      for (let i = 0; i < text.length;) {
        const cp = text.codePointAt(i);
        const char = String.fromCodePoint(cp);
        i += char.length;

        // Colour / format codes consume no width.
        if (char === FORMAT_CHAR && i < text.length) {
          const code = text[i].toLowerCase();
          i += 1;
          const mapped = FORMAT_COLOURS[code];
          if (mapped !== undefined) colour = mapped;
          else if (code === 'r') colour = baseColour;
          continue;
        }
        if (char === '\n') {
          penX = originX + (isShadow ? scale : 0);
          continue;
        }

        const drawColour = isShadow ? shadowOf(colour) : colour;

        if (cp <= BITMAP_MAX_CODE_POINT) {
          const advance = font.charWidth(char);
          const layout = font.layout(char, penX, penY, {
            scale, color: drawColour, alpha, shadow: false,
          });
          this.batch.setTexture(this.textures.get('font'));
          for (const q of layout.quads) {
            this.batch.quad(q.x, q.y, q.w, q.h, q.u0, q.v0, q.u1, q.v1, q.color, q.alpha);
          }
          penX += advance * scale;
        } else {
          const cache = this.#glyphCache();
          const glyph = cache.glyphFor(cp);
          if (glyph) {
            this.batch.setTexture(cache.record);
            this.batch.quad(
              penX, penY, glyph.drawWidth * scale, cache.displayHeight * scale,
              glyph.u0, glyph.v0, glyph.u1, glyph.v1, drawColour, alpha,
            );
            penX += glyph.advance * scale;
          } else {
            penX += 6 * scale;
          }
        }
      }
    }
    return { quads: [], width, height: font.lineHeight * scale };
  }

  /**
   * Width of a string in GUI pixels, covering both glyph sources so
   * centring and tooltip boxes stay correct for any script.
   */
  measure(text, scale = 1) {
    const str = String(text ?? '');
    if (!NEEDS_DYNAMIC.test(str)) return font.measure(str) * scale;

    let width = 0;
    for (let i = 0; i < str.length;) {
      const cp = str.codePointAt(i);
      const char = String.fromCodePoint(cp);
      i += char.length;
      if (char === FORMAT_CHAR && i < str.length) { i += 1; continue; }
      if (char === '\n') continue;
      width += cp <= BITMAP_MAX_CODE_POINT
        ? font.charWidth(char)
        : this.#glyphCache().advanceFor(cp);
    }
    return width * scale;
  }

  /**
   * Diagnostic: compares `measure()` with the width the mixed-script draw
   * loop actually advances. The two must agree or centred text drifts.
   * Returns a short report; used by the headless interface probe.
   */
  widthProbe(text) {
    const str = String(text ?? '');
    const measured = this.measure(str);
    let pen = 0;
    const mismatches = [];
    for (let i = 0; i < str.length;) {
      const cp = str.codePointAt(i);
      const char = String.fromCodePoint(cp);
      i += char.length;
      if (char === FORMAT_CHAR && i < str.length) { i += 1; continue; }
      if (char === '\n') continue;
      if (cp <= BITMAP_MAX_CODE_POINT) {
        pen += font.charWidth(char);
      } else {
        const cache = this.#glyphCache();
        const glyph = cache.glyphFor(cp);
        const drawn = glyph ? glyph.advance : 6;
        const claimed = cache.advanceFor(cp);
        if (drawn !== claimed) mismatches.push(`${char}:${claimed}!=${drawn}`);
        pen += drawn;
      }
    }
    return `measured=${measured.toFixed(1)} drawn=${pen.toFixed(1)} `
      + `delta=${(pen - measured).toFixed(1)}`
      + (mismatches.length ? ` bad=[${mismatches.slice(0, 6).join(' ')}]` : '');
  }
}

/** Vanilla's 16 colour codes, as RGB ints. */
const FORMAT_COLOURS = {
  0: 0x000000, 1: 0x0000aa, 2: 0x00aa00, 3: 0x00aaaa,
  4: 0xaa0000, 5: 0xaa00aa, 6: 0xffaa00, 7: 0xaaaaaa,
  8: 0x555555, 9: 0x5555ff, a: 0x55ff55, b: 0x55ffff,
  c: 0xff5555, d: 0xff55ff, e: 0xffff55, f: 0xffffff,
};

/** Vanilla draws the drop shadow at 25% of the glyph colour. */
function shadowOf(colour) {
  const r = Math.floor(((colour >> 16) & 255) * 0.25);
  const g = Math.floor(((colour >> 8) & 255) * 0.25);
  const b = Math.floor((colour & 255) * 0.25);
  return (r << 16) | (g << 8) | b;
}
