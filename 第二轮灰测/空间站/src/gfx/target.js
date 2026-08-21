/**
 * gfx/target.js —— 渲染目标（FBO）封装
 *
 * 支持多色附件（MRT）、深度纹理/渲染缓冲、按需重建尺寸。
 */

/** 常用附件格式描述 */
export const FMT = {
  RGBA16F: { internal: 'RGBA16F', format: 'RGBA', type: 'HALF_FLOAT' },
  RGBA8: { internal: 'RGBA8', format: 'RGBA', type: 'UNSIGNED_BYTE' },
  RG16F: { internal: 'RG16F', format: 'RG', type: 'HALF_FLOAT' },
  R8: { internal: 'R8', format: 'RED', type: 'UNSIGNED_BYTE' },
  R16F: { internal: 'R16F', format: 'RED', type: 'HALF_FLOAT' },
};

export class RenderTarget {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {object} o
   * @param {number} o.width @param {number} o.height
   * @param {Array<object>} [o.colors]   附件格式列表（FMT.*）
   * @param {boolean|'texture'} [o.depth] true=渲染缓冲，'texture'=深度纹理
   * @param {WebGLTexture} [o.sharedDepth] 复用另一个目标的深度纹理（预通道与主通道共享深度）
   * @param {boolean} [o.linear]         色附件是否线性过滤
   * @param {string} [o.name]
   */
  constructor(gl, { width, height, colors = [FMT.RGBA16F], depth = false, sharedDepth = null, linear = true, name = 'rt' }) {
    this.gl = gl;
    this.name = name;
    this.colorFormats = colors;
    this.depthMode = depth;
    this.sharedDepth = sharedDepth;
    this.linear = linear;
    this.width = 0; this.height = 0;
    /** @type {WebGLTexture[]} */
    this.textures = [];
    this.depthTexture = null;
    this.depthBuffer = null;
    this.fbo = gl.createFramebuffer();
    this.resize(width, height);
  }

  resize(width, height) {
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));
    if (width === this.width && height === this.height) return false;
    const gl = this.gl;
    this.width = width; this.height = height;

    // 释放旧资源
    for (const t of this.textures) gl.deleteTexture(t);
    this.textures = [];
    if (this.depthTexture) { gl.deleteTexture(this.depthTexture); this.depthTexture = null; }
    if (this.depthBuffer) { gl.deleteRenderbuffer(this.depthBuffer); this.depthBuffer = null; }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    const draws = [];
    this.colorFormats.forEach((f, i) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl[f.internal], width, height, 0, gl[f.format], gl[f.type], null);
      const filt = this.linear ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex, 0);
      this.textures.push(tex);
      draws.push(gl.COLOR_ATTACHMENT0 + i);
    });
    if (draws.length > 1) gl.drawBuffers(draws);

    if (this.sharedDepth) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.sharedDepth, 0);
    } else if (this.depthMode === 'texture') {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
      this.depthTexture = tex;
    } else if (this.depthMode) {
      const rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      this.depthBuffer = rb;
    }

    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) {
      console.error(`[RT:${this.name}] 帧缓冲不完整：0x${st.toString(16)}`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }

  /** 绑定并设置视口 */
  bind(attachments = null) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    if (attachments) gl.drawBuffers(attachments);
    gl.viewport(0, 0, this.width, this.height);
    return this;
  }

  get texture() { return this.textures[0]; }

  /** 源目标重建深度纹理后，重新挂接共享深度 */
  setSharedDepth(tex) {
    const gl = this.gl;
    this.sharedDepth = tex;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this;
  }

  dispose() {
    const gl = this.gl;
    for (const t of this.textures) gl.deleteTexture(t);
    if (this.depthTexture) gl.deleteTexture(this.depthTexture);
    if (this.depthBuffer) gl.deleteRenderbuffer(this.depthBuffer);
    gl.deleteFramebuffer(this.fbo);
  }
}

/** 阴影贴图：仅深度纹理，配置为比较采样（sampler2DShadow） */
export class ShadowMap {
  constructor(gl, size = 2048) {
    this.gl = gl;
    this.size = size;
    this.fbo = gl.createFramebuffer();
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.texture, 0);
    gl.drawBuffers([gl.NONE]);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) console.error(`[ShadowMap] 帧缓冲不完整：0x${st.toString(16)}`);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.size, this.size);
    return this;
  }

  dispose() {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteFramebuffer(this.fbo);
  }
}
