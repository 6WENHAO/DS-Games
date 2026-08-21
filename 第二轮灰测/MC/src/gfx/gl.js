/**
 * gfx/gl.js
 * ------------------------------------------------------------------
 * WebGL2 context creation, capability probing and a few tiny state
 * helpers. Everything else in gfx/ assumes a WebGL2 context.
 */

/** Thrown when the browser cannot give us a usable WebGL2 context. */
export class GLUnsupportedError extends Error {}

/**
 * Creates a WebGL2 rendering context tuned for a voxel game.
 * @param {HTMLCanvasElement} canvas
 * @param {{antialias?: boolean, powerPreference?: string}} [opts]
 */
export function createContext(canvas, opts = {}) {
  const attribs = {
    alpha: false,
    depth: true,
    stencil: false,
    antialias: opts.antialias ?? false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: opts.powerPreference ?? 'high-performance',
    desynchronized: false,
    failIfMajorPerformanceCaveat: false,
  };

  const gl = canvas.getContext('webgl2', attribs);
  if (!gl) {
    throw new GLUnsupportedError(
      'WebGL2 is not available in this browser. '
      + 'Try a recent Chrome, Edge, Firefox or Safari, and make sure hardware '
      + 'acceleration is enabled.',
    );
  }
  return gl;
}

/** Collects the limits and extensions the renderer cares about. */
export function probeCapabilities(gl) {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
    ?? gl.getExtension('MOZ_EXT_texture_filter_anisotropic')
    ?? gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');

  return {
    vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
    renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
    version: gl.getParameter(gl.VERSION),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxArrayLayers: gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS),
    maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
    maxSamples: gl.getParameter(gl.MAX_SAMPLES),
    aniso: aniso
      ? { ext: aniso, max: gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) }
      : null,
    floatBlend: !!gl.getExtension('EXT_float_blend'),
    // Software rasterisers (SwiftShader/llvmpipe) need lighter defaults.
    software: /swiftshader|software|llvmpipe|basic render/i.test(
      debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '',
    ),
  };
}

/**
 * Resizes the drawing buffer to match the CSS size times `scale`.
 * Returns true when the size changed (so callers can rebuild projections).
 */
export function resizeToDisplay(gl, canvas, scale = 1) {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2) * scale;
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  const w = Math.max(1, Math.floor(cssW * dpr));
  const h = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  gl.viewport(0, 0, w, h);
  return true;
}

/** Creates and fills a buffer in one call. */
export function createBuffer(gl, target, data, usage = gl.STATIC_DRAW) {
  const buf = gl.createBuffer();
  gl.bindBuffer(target, buf);
  if (data) gl.bufferData(target, data, usage);
  return buf;
}

/**
 * Builds the shared quad index buffer.
 *
 * Every quad in a chunk mesh is emitted as 4 vertices, so the index
 * pattern (0,1,2, 0,2,3, 4,5,6, 4,6,7, ...) is identical for every mesh.
 * One immutable buffer therefore serves all chunks, which saves both
 * memory and per-chunk upload time.
 */
export function createSharedQuadIndexBuffer(gl, maxQuads) {
  const indices = new Uint32Array(maxQuads * 6);
  for (let q = 0, i = 0, v = 0; q < maxQuads; q++, i += 6, v += 4) {
    indices[i] = v;
    indices[i + 1] = v + 1;
    indices[i + 2] = v + 2;
    indices[i + 3] = v;
    indices[i + 4] = v + 2;
    indices[i + 5] = v + 3;
  }
  const buf = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  return { buffer: buf, maxQuads };
}

/** Convenience wrapper for the common depth+colour clear. */
export function clear(gl, r, g, b, a = 1) {
  gl.clearColor(r, g, b, a);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}
