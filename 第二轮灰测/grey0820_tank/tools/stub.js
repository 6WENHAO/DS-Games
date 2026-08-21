/* =============================================================================
   tools/stub.js - shared browser stubs for the headless test harnesses:
   Canvas 2D, WebGL 1, canvas elements and a controllable fake clock.
   ========================================================================== */
'use strict';

function make2d(canvas) {
  const grad = { addColorStop() { } };
  const store = {
    canvas, globalAlpha: 1, lineWidth: 1, font: '10px sans-serif',
    textAlign: 'start', textBaseline: 'alphabetic', fillStyle: '#000',
    strokeStyle: '#000', shadowBlur: 0, shadowColor: '#000', lineCap: 'butt',
    lineJoin: 'miter', miterLimit: 10, globalCompositeOperation: 'source-over',
    filter: 'none', imageSmoothingEnabled: true
  };
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient' ||
        k === 'createConicGradient' || k === 'createPattern') return () => grad;
      if (k === 'measureText') return (s) => ({ width: (s ? String(s).length : 0) * 6, actualBoundingBoxAscent: 8 });
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      return () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

let constCounter = 0x1000;
function makeGL(canvas) {
  const store = {
    canvas,
    drawingBufferWidth: canvas.width, drawingBufferHeight: canvas.height,
    calls: { draws: 0, buffers: 0, textures: 0, programs: 0 }
  };
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string' && /^[A-Z][A-Z0-9_]*$/.test(k)) { t[k] = constCounter++; return t[k]; }
      switch (k) {
        case 'createShader': case 'createProgram': case 'createTexture':
        case 'createFramebuffer': case 'createRenderbuffer':
          return () => ({ id: ++t.calls.programs });
        case 'createBuffer': return () => ({ id: ++t.calls.buffers });
        case 'getShaderParameter': case 'getProgramParameter': return () => true;
        case 'getShaderInfoLog': case 'getProgramInfoLog': return () => '';
        case 'getAttribLocation': return (p, n) => ({ a_pos: 0, a_nrm: 1, a_uv: 2, a_col: 3 }[n] || 0);
        case 'getUniformLocation': return () => ({});
        case 'getExtension': return (n) => (n === 'OES_element_index_uint' ? {} : null);
        case 'getParameter': return () => 4096;
        case 'drawElements': case 'drawArrays': return () => { t.calls.draws++; };
        case 'texImage2D': return () => { t.calls.textures++; };
        case 'uniform3fv': case 'uniform1fv': case 'uniform4fv': case 'uniform2fv':
          return (loc, v) => {
            if (!v || v.length === undefined) throw new Error('uniform array expected an array, got ' + v);
            for (let i = 0; i < v.length; i++) {
              if (typeof v[i] !== 'number' || !isFinite(v[i])) throw new Error('uniform array element ' + i + ' is ' + v[i]);
            }
          };
        case 'uniformMatrix4fv': return (loc, tr, m) => {
          if (!m || m.length !== 16) throw new Error('uniformMatrix4fv expected 16 floats, got ' + (m && m.length));
          for (let i = 0; i < 16; i++) if (!isFinite(m[i])) throw new Error('matrix element ' + i + ' is not finite');
        };
        case 'uniformMatrix3fv': return (loc, tr, m) => {
          if (!m || m.length !== 9) throw new Error('uniformMatrix3fv expected 9 floats');
          for (let i = 0; i < 9; i++) if (!isFinite(m[i])) throw new Error('normal matrix element ' + i + ' is not finite');
        };
        case 'uniform1f': case 'uniform1i': return (loc, v) => {
          if (typeof v !== 'number' || !isFinite(v)) throw new Error('uniform1f got ' + v);
        };
        case 'uniform2f': case 'uniform3f': case 'uniform4f': return function () {
          for (let i = 1; i < arguments.length; i++) {
            if (typeof arguments[i] !== 'number' || !isFinite(arguments[i])) {
              throw new Error('uniformNf argument ' + i + ' is ' + arguments[i]);
            }
          }
        };
        default: return () => undefined;
      }
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function makeCanvas(w, h) {
  return {
    width: w || 300, height: h || 150, clientWidth: w || 300, clientHeight: h || 150,
    style: {}, tagName: 'CANVAS', id: '',
    getContext(kind) {
      if (kind === '2d') { this._2d = this._2d || make2d(this); return this._2d; }
      this._gl = this._gl || makeGL(this);
      return this._gl;
    },
    toDataURL() { return 'data:,'; },
    addEventListener() { }, removeEventListener() { },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; },
    appendChild() { }, requestPointerLock() { }
  };
}

module.exports = { make2d, makeGL, makeCanvas };
