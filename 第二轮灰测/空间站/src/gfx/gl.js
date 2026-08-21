/**
 * gfx/gl.js —— WebGL2 上下文与能力探测
 */

/**
 * @typedef {Object} GLCaps
 * @property {boolean} colorBufferFloat  是否可渲染到 16F/32F 目标
 * @property {boolean} floatLinear       浮点纹理是否支持线性过滤（Bloom 需要）
 * @property {number}  maxTextureSize
 * @property {number}  maxSamples
 * @property {number}  anisoMax
 * @property {string}  renderer
 * @property {string}  vendor
 */

/**
 * 创建 WebGL2 上下文。
 *
 * 不同平台（无头浏览器、虚拟机、老旧集显、被策略限制的环境）对上下文属性的支持
 * 差异很大，因此按「理想 → 保守 → 最简 → 默认」四档逐级降级，并记录每一档的
 * 失败原因，便于在真正不支持时给出可诊断的报错而非一句笼统的"不支持 WebGL2"。
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{gl:WebGL2RenderingContext, caps:GLCaps, attempts:string[]}}
 */
export function createContext(canvas) {
  const base = {
    alpha: false,
    depth: true,
    stencil: false,
    antialias: false,          // 自研 FXAA，关闭默认 MSAA 以省带宽
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
  };
  const variants = [
    { ...base, powerPreference: 'high-performance', desynchronized: false },
    base,
    { antialias: false },
    undefined,
  ];

  /** @type {WebGL2RenderingContext|null} */
  let gl = null;
  const attempts = [];
  for (const attrs of variants) {
    const label = attrs ? JSON.stringify(attrs) : '默认属性';
    try {
      gl = /** @type {any} */ (canvas.getContext('webgl2', attrs));
    } catch (err) {
      gl = null;
      attempts.push(`${label} → 抛出 ${(err && err.message) || err}`);
      continue;
    }
    if (gl) { attempts.push(`${label} → 成功`); break; }
    attempts.push(`${label} → 返回 null`);
  }
  if (!gl) throw new Error('无法创建 WebGL2 上下文：\n' + attempts.join('\n'));

  const ext = (n) => gl.getExtension(n);
  const cbFloat = !!(ext('EXT_color_buffer_float') || ext('EXT_color_buffer_half_float'));
  const fLinear = !!ext('OES_texture_float_linear');
  const aniso = ext('EXT_texture_filter_anisotropic');
  const dbgInfo = ext('WEBGL_debug_renderer_info');

  const caps = {
    colorBufferFloat: cbFloat,
    floatLinear: fLinear,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxSamples: gl.getParameter(gl.MAX_SAMPLES),
    anisoMax: aniso ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1,
    anisoExt: aniso,
    renderer: dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    vendor: dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
  };

  return { gl, caps, attempts };
}

/** 全屏三角形（覆盖 NDC，比全屏四边形省一个顶点与一次插值） */
export function createFullscreenTriangle(gl) {
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return {
    vao,
    draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); },
    dispose() { gl.deleteBuffer(vbo); gl.deleteVertexArray(vao); },
  };
}

/** 开发期检查：把 GL 错误码翻译成可读信息 */
export function checkError(gl, tag = '') {
  const e = gl.getError();
  if (e === gl.NO_ERROR) return;
  const names = {
    [gl.INVALID_ENUM]: 'INVALID_ENUM',
    [gl.INVALID_VALUE]: 'INVALID_VALUE',
    [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
    [gl.INVALID_FRAMEBUFFER_OPERATION]: 'INVALID_FRAMEBUFFER_OPERATION',
    [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
    [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL',
  };
  console.error(`[GL] ${tag} → ${names[e] || e}`);
}
