/**
 * ui/font.js
 * ------------------------------------------------------------------
 * Layout and metrics for the classic Minecraft bitmap font. The glyph sheet
 * is assets/textures/font/ascii.png: a 128x128 image holding a 16x16 grid of
 * 8x8 glyphs, where the glyph for code `c` lives at cell `(c & 15, c >> 4)`.
 * Glyphs are left-aligned in their cell and usually narrower than 8px, so the
 * font scans the sheet's alpha channel to compute per-character advances
 * (exactly like vanilla).
 *
 * This module never touches WebGL. It only produces geometry descriptions -
 * an array of quads with normalised UVs - that a caller's sprite batcher draws.
 */

export const GLYPH_SHEET_SIZE = 128;
export const GLYPH_CELL = 8;

/** Sentinel values stored in COLOR_CODES for the non-colour format codes. */
const RESET = -1;
const BOLD = -2;
const UNDERLINE = -3;
const ITALIC = -4;
const STRIKE = -5;

/** The default (unformatted) text colour. */
const DEFAULT_COLOR = 0xFFFFFF;

/**
 * Vanilla's 16 colour codes (§0-§9, §a-§f) plus the format codes §r reset,
 * §l bold, §n underline, §o italic and §m strike. Colour entries hold an RGB
 * int; format entries hold the negative sentinels above so they are easy to
 * tell apart from colours.
 * @type {Record<string, number>}
 */
export const COLOR_CODES = {
  '0': 0x000000, // black
  '1': 0x0000AA, // dark_blue
  '2': 0x00AA00, // dark_green
  '3': 0x00AAAA, // dark_aqua
  '4': 0xAA0000, // dark_red
  '5': 0xAA00AA, // dark_purple
  '6': 0xFFAA00, // gold
  '7': 0xAAAAAA, // gray
  '8': 0x555555, // dark_gray
  '9': 0x5555FF, // blue
  'a': 0x55FF55, // green
  'b': 0x55FFFF, // aqua
  'c': 0xFF5555, // red
  'd': 0xFF55FF, // light_purple
  'e': 0xFFFF55, // yellow
  'f': 0xFFFFFF, // white
  'r': RESET,
  'l': BOLD,
  'n': UNDERLINE,
  'o': ITALIC,
  'm': STRIKE,
};

/** Reverse map: colour int -> its § code character (used to re-emit state). */
const COLOR_CHAR = {};
for (const [ch, v] of Object.entries(COLOR_CODES)) {
  if (v >= 0) COLOR_CHAR[v] = ch;
}

/**
 * Builds the prefix string that re-establishes a colour/bold state at the
 * start of a wrapped line.
 * @param {number} color
 * @param {boolean} bold
 * @returns {string}
 */
function statePrefix(color, bold) {
  let p = '';
  if (bold) p += '\u00A7l';
  if (color !== DEFAULT_COLOR && COLOR_CHAR[color] !== undefined) p += '\u00A7' + COLOR_CHAR[color];
  return p;
}

/**
 * Scales a colour by 0.25 per channel (vanilla's drop-shadow colour).
 * @param {number} rgb 24-bit RGB int.
 * @returns {number}
 */
function shadowColor(rgb) {
  const r = (rgb >> 16) & 0xFF;
  const g = (rgb >> 8) & 0xFF;
  const b = rgb & 0xFF;
  return ((r >> 2) << 16) | ((g >> 2) << 8) | (b >> 2);
}

/**
 * Strips § formatting codes from a string.
 * @param {string} text
 * @returns {string}
 */
export function stripCodes(text) {
  return String(text).replace(/\u00A7[0-9a-frlnom]/gi, '');
}

export class BitmapFont {
  constructor() {
    /** @type {Uint8Array} Advance width per code point 0..255, in font pixels. */
    this.advances = new Uint8Array(256);
    this.buildFallback();
  }

  /**
   * Measures glyph advance widths from the loaded sheet by scanning each cell's
   * alpha channel for the right-most non-empty column.
   * @param {HTMLImageElement|ImageBitmap|HTMLCanvasElement} image the 128x128 ascii sheet.
   */
  buildFromImage(image) {
    try {
      const size = GLYPH_SHEET_SIZE;
      const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(size, size)
        : (() => {
            const c = document.createElement('canvas');
            c.width = size;
            c.height = size;
            return c;
          })();
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('2d context unavailable');
      ctx.drawImage(image, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      for (let c = 0; c < 256; c++) {
        const cellX = (c & 15) * GLYPH_CELL;
        const cellY = (c >> 4) * GLYPH_CELL;
        let rightmost = -1;
        for (let px = GLYPH_CELL - 1; px >= 0; px--) {
          let found = false;
          for (let py = 0; py < GLYPH_CELL; py++) {
            const idx = ((cellY + py) * size + (cellX + px)) * 4 + 3; // alpha byte
            if (data[idx] > 0) { found = true; break; }
          }
          if (found) { rightmost = px; break; }
        }
        // 5px-wide glyph advances 6px; empty cells (space etc.) advance 4.
        const advance = rightmost < 0 ? 4 : rightmost + 2;
        this.advances[c] = advance < 1 ? 1 : advance > 9 ? 9 : advance;
      }
    } catch (err) {
      this.buildFallback();
    }
  }

  /** Fallback when the sheet cannot be read: uniform 6px advances. */
  buildFallback() {
    this.advances.fill(6);
  }

  /**
   * Advance width in font pixels for one character (default 6 for unknown).
   * @param {string|number} ch a single character or its code point.
   * @returns {number}
   */
  charWidth(ch) {
    const c = typeof ch === 'string' ? ch.charCodeAt(0) : ch;
    if (c < 0 || c > 255) return 6;
    const w = this.advances[c];
    return w || 6;
  }

  /** @returns {number} Line height in font pixels (9). */
  get lineHeight() {
    return 9;
  }

  /**
   * Total advance width of a string in font pixels, honouring § colour codes.
   * For multi-line input (via \n) this returns the widest line.
   * @param {string} text
   * @returns {number}
   */
  measure(text) {
    let maxW = 0;
    for (const line of String(text).split('\n')) {
      maxW = Math.max(maxW, this._scan(line, DEFAULT_COLOR, false).width);
    }
    return maxW;
  }

  /**
   * Splits text into lines that fit `maxWidth` (word wrap, honouring colour
   * codes). A format state active at a wrap point is re-emitted at the start
   * of the next line so it renders correctly. Hard \n breaks are preserved.
   * @param {string} text
   * @param {number} maxWidth in font pixels.
   * @returns {string[]}
   */
  wrap(text, maxWidth) {
    const src = String(text);
    const lines = [];
    if (!(maxWidth > 0)) {
      for (const l of src.split('\n')) lines.push(l);
      return lines;
    }
    for (const l of src.split('\n')) this._wrapLine(l, maxWidth, lines);
    return lines;
  }

  /**
   * Lays a string out into draw commands.
   * @param {string} text
   * @param {number} x @param {number} y
   *   Anchor point in GUI pixels. `y` is the top of the first line. `x` is
   *   the left edge for 'left', the horizontal centre for 'center' and the
   *   right edge for 'right' - i.e. the same anchor semantics as Canvas2D's
   *   `textAlign`, which is what every call site expects.
   * @param {object} [opts]
   *   scale        default 1
   *   color        default 0xFFFFFF (RGB int)
   *   alpha        default 1
   *   shadow       default true (vanilla drop shadow offset (1,1) at 25% brightness)
   *   maxWidth     when set, wrap onto multiple lines
   *   align        'left' | 'center' | 'right' (default 'left')
   * @returns {{quads: Array<{x:number,y:number,w:number,h:number,u0:number,v0:number,u1:number,v1:number,color:number,alpha:number}>, width:number, height:number}}
   *   UVs are normalised 0..1 into the 128x128 sheet. Shadow quads come first
   *   so a single batch draws them behind the glyphs. width/height are the
   *   text block extent in the same (scaled, GUI) pixel space as x/y.
   */
  layout(text, x, y, opts = {}) {
    const scale = opts.scale ?? 1;
    const color = opts.color ?? DEFAULT_COLOR;
    const alpha = opts.alpha ?? 1;
    const shadow = opts.shadow ?? true;
    const maxWidth = opts.maxWidth;
    const align = opts.align ?? 'left';

    const lines = (maxWidth != null && maxWidth > 0)
      ? this.wrap(text, maxWidth)
      : String(text).split('\n');

    const lineWidths = lines.map((l) => this.measure(l));
    let maxLineWidth = 0;
    for (const w of lineWidths) if (w > maxLineWidth) maxLineWidth = w;

    const glyphs = [];
    const shadows = [];
    const cell = GLYPH_CELL;
    const sheet = GLYPH_SHEET_SIZE;
    const quadW = cell * scale;
    const quadH = cell * scale;
    const lineStep = this.lineHeight * scale;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lineY = y + li * lineStep;
      /*
       * `x` is an anchor, not a box edge. Centring each line on the anchor
       * is what callers mean by `align: 'center'`; the previous version
       * centred within a box whose width equalled the text itself, which
       * for single-line text cancelled out entirely and left the string
       * drawn from the anchor rightwards.
       */
      let penX = x;
      if (align === 'center') penX = x - (lineWidths[li] * scale) / 2;
      else if (align === 'right') penX = x - lineWidths[li] * scale;

      let curColor = color;
      let bold = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '\u00A7' && i + 1 < line.length) {
          const v = COLOR_CODES[line[i + 1].toLowerCase()];
          if (v !== undefined) {
            if (v >= 0) curColor = v;
            else if (v === RESET) { curColor = color; bold = false; }
            else if (v === BOLD) bold = true;
            // underline/italic/strike are recognised but not rendered here.
            i++;
            continue;
          }
        }
        const c = ch.charCodeAt(0);
        if (c > 255) { penX += 6 * scale; continue; } // not present in the sheet
        const u0 = ((c & 15) * cell) / sheet;
        const v0 = ((c >> 4) * cell) / sheet;
        const u1 = u0 + cell / sheet;
        const v1 = v0 + cell / sheet;
        const advance = (this.advances[c] + (bold ? 1 : 0)) * scale;

        if (shadow) {
          shadows.push({
            x: penX + scale, y: lineY + scale, w: quadW, h: quadH,
            u0, v0, u1, v1, color: shadowColor(curColor), alpha,
          });
        }
        glyphs.push({ x: penX, y: lineY, w: quadW, h: quadH, u0, v0, u1, v1, color: curColor, alpha });
        if (bold) {
          glyphs.push({ x: penX + scale, y: lineY, w: quadW, h: quadH, u0, v0, u1, v1, color: curColor, alpha });
        }
        penX += advance;
      }
    }

    return {
      quads: shadows.concat(glyphs),
      width: maxLineWidth * scale,
      height: lines.length * lineStep,
    };
  }

  /**
   * Scans a string, honouring § codes, returning its rendered width plus the
   * colour/bold state at the end. Only bold affects width.
   * @param {string} text
   * @param {number} color starting colour.
   * @param {boolean} bold starting bold flag.
   * @returns {{width:number, color:number, bold:boolean}}
   */
  _scan(text, color, bold) {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\u00A7' && i + 1 < text.length) {
        const v = COLOR_CODES[text[i + 1].toLowerCase()];
        if (v !== undefined) {
          if (v >= 0) color = v;
          else if (v === RESET) { color = DEFAULT_COLOR; bold = false; }
          else if (v === BOLD) bold = true;
          i++;
          continue;
        }
      }
      const c = text.charCodeAt(i);
      width += (c < 256 ? this.advances[c] : 6) + (bold ? 1 : 0);
    }
    return { width, color, bold };
  }

  /**
   * Wraps a single line (no \n) into lines of at most `maxWidth` font pixels.
   * @param {string} line
   * @param {number} maxWidth
   * @param {string[]} lines output array, appended to.
   */
  _wrapLine(line, maxWidth, lines) {
    if (line === '') { lines.push(''); return; }

    const words = line.split(' ');
    let color = DEFAULT_COLOR;
    let bold = false;
    let cur = '';
    let curWidth = 0;

    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];
      // '' marks a space (produced by consecutive spaces in the input).
      if (word === '') {
        if (cur !== '' && curWidth + this._spaceWidth(bold) <= maxWidth) {
          cur += ' ';
          curWidth += this._spaceWidth(bold);
        }
        continue;
      }

      const scan = this._scan(word, color, bold);

      if (cur === '') {
        if (scan.width > maxWidth) {
          // A single word wider than the line: split it by character.
          const parts = this._splitWord(word, maxWidth);
          for (let p = 0; p < parts.length - 1; p++) lines.push(parts[p]);
          const last = parts[parts.length - 1];
          cur = last;
          const s = this._scan(last, DEFAULT_COLOR, false);
          curWidth = s.width; color = s.color; bold = s.bold;
        } else {
          cur = word;
          curWidth = scan.width; color = scan.color; bold = scan.bold;
        }
      } else if (curWidth + this._spaceWidth(bold) + scan.width <= maxWidth) {
        cur += ' ' + word;
        curWidth += this._spaceWidth(bold) + scan.width;
        color = scan.color; bold = scan.bold;
      } else {
        // Word does not fit: wrap before it, re-establishing active state.
        lines.push(cur);
        const next = statePrefix(color, bold) + word;
        const s = this._scan(next, DEFAULT_COLOR, false);
        cur = next;
        curWidth = s.width; color = s.color; bold = s.bold;
      }
    }
    if (cur !== '') lines.push(cur);
  }

  /**
   * Splits a single word (which may contain § codes) into chunks fitting
   * `maxWidth`, re-emitting the active state at each break.
   * @param {string} word
   * @param {number} maxWidth
   * @returns {string[]}
   */
  _splitWord(word, maxWidth) {
    const parts = [];
    let color = DEFAULT_COLOR;
    let bold = false;
    let cur = '';
    let curWidth = 0;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (ch === '\u00A7' && i + 1 < word.length && COLOR_CODES[word[i + 1].toLowerCase()] !== undefined) {
        cur += ch + word[i + 1];
        const v = COLOR_CODES[word[i + 1].toLowerCase()];
        if (v >= 0) color = v;
        else if (v === RESET) { color = DEFAULT_COLOR; bold = false; }
        else if (v === BOLD) bold = true;
        i++;
        continue;
      }
      const c = ch.charCodeAt(0);
      const adv = (c < 256 ? this.advances[c] : 6) + (bold ? 1 : 0);
      if (cur !== '' && curWidth + adv > maxWidth) {
        parts.push(cur);
        cur = statePrefix(color, bold) + ch;
        curWidth = adv;
      } else {
        cur += ch;
        curWidth += adv;
      }
    }
    if (cur !== '') parts.push(cur);
    return parts;
  }

  /** @param {boolean} bold @returns {number} advance of the space character. */
  _spaceWidth(bold) {
    return this.charWidth(32) + (bold ? 1 : 0);
  }
}

/** Ready-to-use singleton the UI imports. Call buildFromImage() with the sheet. */
export const font = new BitmapFont();
