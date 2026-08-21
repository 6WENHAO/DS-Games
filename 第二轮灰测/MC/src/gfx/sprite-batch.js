/**
 * gfx/sprite-batch.js
 * ------------------------------------------------------------------
 * Immediate-mode 2D quad batcher for the HUD and in-canvas screens.
 *
 * Everything the interface draws - vanilla GUI sprites, bitmap-font
 * glyphs, inventory icons, coloured panels - is a textured axis-aligned
 * quad, so one dynamic vertex buffer plus "flush when the texture
 * changes" keeps the whole interface down to a handful of draw calls.
 *
 * Coordinates are "GUI pixels": the projection is rebuilt on resize so
 * one GUI pixel maps to an integer number of device pixels, which is
 * what keeps the pixel art crisp at any window size.
 */

import { buildProgram } from './program.js';
import { guiVertexShader, guiFragmentShader, GUI_VERTEX_STRIDE } from './shaders/gui.js';
import { mat4 } from '../core/math.js';

const MAX_QUADS = 8192;

export class SpriteBatch {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, {
      name: 'gui', vertex: guiVertexShader, fragment: guiFragmentShader,
    });

    this.capacity = MAX_QUADS;
    this.buffer = new ArrayBuffer(this.capacity * 4 * GUI_VERTEX_STRIDE);
    this.f32 = new Float32Array(this.buffer);
    this.u8 = new Uint8Array(this.buffer);
    this.quadCount = 0;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.buffer.byteLength, gl.DYNAMIC_DRAW);
    const S = GUI_VERTEX_STRIDE;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, S, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, S, 16);

    // Shared quad index buffer (0,1,2, 0,2,3 per quad).
    const indices = new Uint16Array(MAX_QUADS * 6);
    for (let q = 0, i = 0, v = 0; q < MAX_QUADS; q++, i += 6, v += 4) {
      indices[i] = v; indices[i + 1] = v + 1; indices[i + 2] = v + 2;
      indices[i + 3] = v; indices[i + 4] = v + 2; indices[i + 5] = v + 3;
    }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    this.projection = mat4.create();
    this.width = 1;
    this.height = 1;
    this.scale = 1;
    /** @type {WebGLTexture|null} */
    this.currentTexture = null;
    this.stats = { drawCalls: 0, quads: 0 };
  }

  /**
   * Recomputes the GUI projection.
   * @param {number} pixelWidth  drawing buffer width
   * @param {number} pixelHeight drawing buffer height
   * @param {number} guiScale    integer GUI scale (vanilla's 1..4), 0 = auto
   */
  resize(pixelWidth, pixelHeight, guiScale = 0) {
    let scale = guiScale;
    if (!scale) {
      // Vanilla auto scale: as large as fits while keeping >=320x240 units.
      scale = 1;
      while (scale < 5 && pixelWidth / (scale + 1) >= 320 && pixelHeight / (scale + 1) >= 240) scale++;
    }
    this.scale = scale;
    this.width = Math.ceil(pixelWidth / scale);
    this.height = Math.ceil(pixelHeight / scale);
    mat4.ortho(this.projection, 0, this.width, this.height, 0, -1, 1);
  }

  /** Begins a GUI pass: alpha blending, no depth. */
  begin() {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.program.use().mat4('uProj', this.projection);
    this.currentTexture = null;
    this.quadCount = 0;
    this.stats.drawCalls = 0;
    this.stats.quads = 0;
  }

  /** Ends the GUI pass and restores 3D state. */
  end() {
    this.flush();
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
  }

  /** Selects the texture for subsequent quads, flushing if it changes. */
  setTexture(record) {
    const tex = record?.texture ?? null;
    if (tex === this.currentTexture) return;
    this.flush();
    this.currentTexture = tex;
  }

  /** Uploads and draws whatever is buffered. */
  flush() {
    if (this.quadCount === 0 || !this.currentTexture) { this.quadCount = 0; return; }
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Uint8Array(this.buffer, 0, this.quadCount * 4 * GUI_VERTEX_STRIDE));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.currentTexture);
    this.program.int('uTex', 0);
    gl.drawElements(gl.TRIANGLES, this.quadCount * 6, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
    this.stats.drawCalls++;
    this.stats.quads += this.quadCount;
    this.quadCount = 0;
  }

  /**
   * Adds one textured quad.
   * @param {number} x @param {number} y top-left in GUI pixels
   * @param {number} w @param {number} h size in GUI pixels
   * @param {number} u0 @param {number} v0 @param {number} u1 @param {number} v1 normalised UVs
   * @param {number} [colour] 0xRRGGBB multiplier
   * @param {number} [alpha] 0..1
   */
  quad(x, y, w, h, u0, v0, u1, v1, colour = 0xffffff, alpha = 1) {
    if (this.quadCount >= this.capacity) this.flush();
    const r = (colour >> 16) & 255;
    const g = (colour >> 8) & 255;
    const b = colour & 255;
    const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
    const base = this.quadCount * 4;
    const stride = GUI_VERTEX_STRIDE / 4;   // floats per vertex

    const write = (i, px, py, u, v) => {
      const f = (base + i) * stride;
      this.f32[f] = px;
      this.f32[f + 1] = py;
      this.f32[f + 2] = u;
      this.f32[f + 3] = v;
      const o = (base + i) * GUI_VERTEX_STRIDE + 16;
      this.u8[o] = r; this.u8[o + 1] = g; this.u8[o + 2] = b; this.u8[o + 3] = a;
    };
    write(0, x, y, u0, v0);
    write(1, x + w, y, u1, v0);
    write(2, x + w, y + h, u1, v1);
    write(3, x, y + h, u0, v1);
    this.quadCount++;
  }

  /**
   * Draws a region of a sprite sheet, addressed in source pixels - the
   * way vanilla's GUI atlases are laid out.
   */
  sprite(record, x, y, w, h, sx, sy, sw = w, sh = h, colour = 0xffffff, alpha = 1) {
    if (!record) return;
    this.setTexture(record);
    const iw = 1 / record.width;
    const ih = 1 / record.height;
    this.quad(x, y, w, h, sx * iw, sy * ih, (sx + sw) * iw, (sy + sh) * ih, colour, alpha);
  }

  /** Solid colour rectangle. */
  rect(x, y, w, h, colour, alpha = 1) {
    this.setTexture(this.whiteRecord);
    this.quad(x, y, w, h, 0, 0, 1, 1, colour, alpha);
  }

  /** Vertical gradient rectangle (two stacked quads is enough visually). */
  gradientRect(x, y, w, h, topColour, bottomColour, alpha = 1) {
    this.rect(x, y, w, h / 2, topColour, alpha);
    this.rect(x, y + h / 2, w, h - h / 2, bottomColour, alpha);
  }

  /** One-pixel outline. */
  outline(x, y, w, h, colour, alpha = 1, thickness = 1) {
    this.rect(x, y, w, thickness, colour, alpha);
    this.rect(x, y + h - thickness, w, thickness, colour, alpha);
    this.rect(x, y + thickness, thickness, h - thickness * 2, colour, alpha);
    this.rect(x + w - thickness, y + thickness, thickness, h - thickness * 2, colour, alpha);
  }

  /** The 1x1 white texture used by rect(); injected by the renderer. */
  setWhite(record) { this.whiteRecord = record; }

  dispose() {
    const gl = this.gl;
    this.program.dispose();
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.vbo);
    gl.deleteBuffer(this.ibo);
  }
}
