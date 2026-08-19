/* =====================================================================
   微体素地图 · 引擎核心：数学 / WebGL 封装 / 轨道相机
   经典脚本（非 module），可 file:// 直接打开
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX = root.VX || {};

  /* ----------------------------- 数学 ----------------------------- */
  var M = VX.M = {};

  M.mat4 = function () { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); };

  M.ident = function (o) {
    o[0]=1;o[1]=0;o[2]=0;o[3]=0; o[4]=0;o[5]=1;o[6]=0;o[7]=0;
    o[8]=0;o[9]=0;o[10]=1;o[11]=0; o[12]=0;o[13]=0;o[14]=0;o[15]=1; return o;
  };

  M.perspective = function (o, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o[0]=f/aspect;o[1]=0;o[2]=0;o[3]=0;
    o[4]=0;o[5]=f;o[6]=0;o[7]=0;
    o[8]=0;o[9]=0;o[10]=(far+near)*nf;o[11]=-1;
    o[12]=0;o[13]=0;o[14]=2*far*near*nf;o[15]=0;
    return o;
  };

  M.lookAt = function (o, eye, center, up) {
    var z0=eye[0]-center[0], z1=eye[1]-center[1], z2=eye[2]-center[2];
    var l = Math.hypot(z0,z1,z2) || 1; z0/=l; z1/=l; z2/=l;
    var x0=up[1]*z2-up[2]*z1, x1=up[2]*z0-up[0]*z2, x2=up[0]*z1-up[1]*z0;
    l = Math.hypot(x0,x1,x2);
    if (!l) { x0=1;x1=0;x2=0; } else { x0/=l;x1/=l;x2/=l; }
    var y0=z1*x2-z2*x1, y1=z2*x0-z0*x2, y2=z0*x1-z1*x0;
    o[0]=x0;o[1]=y0;o[2]=z0;o[3]=0;
    o[4]=x1;o[5]=y1;o[6]=z1;o[7]=0;
    o[8]=x2;o[9]=y2;o[10]=z2;o[11]=0;
    o[12]=-(x0*eye[0]+x1*eye[1]+x2*eye[2]);
    o[13]=-(y0*eye[0]+y1*eye[1]+y2*eye[2]);
    o[14]=-(z0*eye[0]+z1*eye[1]+z2*eye[2]);
    o[15]=1;
    return o;
  };

  M.mul = function (o, a, b) {
    var a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],
        a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    for (var i=0;i<4;i++){
      var b0=b[i*4],b1=b[i*4+1],b2=b[i*4+2],b3=b[i*4+3];
      o[i*4]  =b0*a00+b1*a10+b2*a20+b3*a30;
      o[i*4+1]=b0*a01+b1*a11+b2*a21+b3*a31;
      o[i*4+2]=b0*a02+b1*a12+b2*a22+b3*a32;
      o[i*4+3]=b0*a03+b1*a13+b2*a23+b3*a33;
    }
    return o;
  };

  M.norm3 = function (v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0]/l, v[1]/l, v[2]/l];
  };

  M.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  M.lerp = function (a, b, t) { return a + (b - a) * t; };
  M.smooth = function (t) { return t * t * (3 - 2 * t); };
  M.mix3 = function (a, b, t) {
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  };

  /** 视锥 6 平面（从 view-projection 提取，用于扇区剔除） */
  M.frustum = function (m) {
    var p = [];
    // 顺序: left,right,bottom,top,near,far  ax+by+cz+d=0
    p.push([m[3]+m[0], m[7]+m[4], m[11]+m[8], m[15]+m[12]]);
    p.push([m[3]-m[0], m[7]-m[4], m[11]-m[8], m[15]-m[12]]);
    p.push([m[3]+m[1], m[7]+m[5], m[11]+m[9], m[15]+m[13]]);
    p.push([m[3]-m[1], m[7]-m[5], m[11]-m[9], m[15]-m[13]]);
    p.push([m[3]+m[2], m[7]+m[6], m[11]+m[10], m[15]+m[14]]);
    p.push([m[3]-m[2], m[7]-m[6], m[11]-m[10], m[15]-m[14]]);
    for (var i=0;i<6;i++){
      var l = Math.hypot(p[i][0],p[i][1],p[i][2]) || 1;
      p[i][0]/=l; p[i][1]/=l; p[i][2]/=l; p[i][3]/=l;
    }
    return p;
  };

  /** AABB vs 视锥（保守：任一平面完全在外则剔除） */
  M.aabbOutside = function (planes, x0,y0,z0, x1,y1,z1) {
    for (var i=0;i<6;i++){
      var p = planes[i];
      var px = p[0] > 0 ? x1 : x0;
      var py = p[1] > 0 ? y1 : y0;
      var pz = p[2] > 0 ? z1 : z0;
      if (p[0]*px + p[1]*py + p[2]*pz + p[3] < 0) return true;
    }
    return false;
  };

  /** 确定性随机（mulberry32） */
  M.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /** 3D 整数 hash → [0,1)（全程保持 int32，避免溢出成 double 拖慢十倍） */
  M.hash3 = function (x, y, z) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0) + Math.imul(z | 0, 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  M.hash2 = function (x, y) { return M.hash3(x, y, 0x9E37); };

  /** 值噪声 + fbm（2D，供地形/散布使用） */
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var a = M.hash3(xi, yi, s), b = M.hash3(xi + 1, yi, s),
        c = M.hash3(xi, yi + 1, s), d = M.hash3(xi + 1, yi + 1, s);
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  M.vnoise = vnoise;
  M.fbm = function (x, y, oct, s) {
    var amp = 0.5, f = 1, sum = 0, norm = 0;
    for (var i = 0; i < oct; i++) { sum += amp * vnoise(x*f, y*f, s + i*7919); norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  };
  M.ridge = function (x, y, oct, s) {
    var amp = 0.5, f = 1, sum = 0, norm = 0;
    for (var i = 0; i < oct; i++) {
      var n = 1 - Math.abs(vnoise(x*f, y*f, s + i*6151) * 2 - 1);
      sum += amp * n * n; norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  };

  /**
   * 预计算噪声场 + 双线性采样。
   * 低频噪声按 step 体素采样一次，再插值 —— 大图整体噪声开销降一个数量级。
   * opt: { freq, oct, seed, step, ridge, ox, oz }
   */
  M.makeField = function (sx, sz, opt) {
    var step = opt.step || 4;
    var gw = Math.ceil(sx / step) + 2, gh = Math.ceil(sz / step) + 2;
    var d = new Float32Array(gw * gh);
    var fn = opt.ridge ? M.ridge : M.fbm;
    var freq = opt.freq, oct = opt.oct || 2, seed = opt.seed || 0;
    var ox = opt.ox || 0, oz = opt.oz || 0;
    for (var gz = 0; gz < gh; gz++) {
      var wz = gz * step * freq + oz;
      for (var gx = 0; gx < gw; gx++) {
        d[gz * gw + gx] = fn(gx * step * freq + ox, wz, oct, seed);
      }
    }
    return { d: d, gw: gw, gh: gh, step: step, inv: 1 / step };
  };

  M.field = function (F, x, z) {
    var fx = x * F.inv, fz = z * F.inv;
    var ix = fx | 0, iz = fz | 0;
    var tx = fx - ix, tz = fz - iz;
    var i0 = iz * F.gw + ix, d = F.d;
    var a = d[i0], b = d[i0 + 1], c = d[i0 + F.gw], e = d[i0 + F.gw + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + e) * tx * tz;
  };

  /* --------------------------- WebGL 封装 --------------------------- */
  var G = VX.G = {};

  G.create = function (canvas) {
    var opts = { antialias: false, alpha: false, depth: true, stencil: false,
                 powerPreference: 'high-performance', preserveDrawingBuffer: true };
    var gl = canvas.getContext('webgl2', opts);
    if (!gl) throw new Error('本浏览器不支持 WebGL2，请使用较新的 Chrome / Edge / Firefox 打开。');
    gl.__floatFB = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_float_blend');
    gl.getExtension('OES_texture_float_linear');
    return gl;
  };

  G.shader = function (gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(s);
      var lines = src.split('\n').map(function (l, i) { return (i + 1) + ': ' + l; }).join('\n');
      throw new Error('着色器编译失败: ' + log + '\n' + lines);
    }
    return s;
  };

  G.program = function (gl, vsSrc, fsSrc, name) {
    var p = gl.createProgram();
    gl.attachShader(p, G.shader(gl, gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, G.shader(gl, gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error('程序链接失败 (' + (name || '?') + '): ' + gl.getProgramInfoLog(p));
    // 缓存 uniform / attrib 位置
    p.u = {}; p.a = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), i, info;
    for (i = 0; i < n; i++) {
      info = gl.getActiveUniform(p, i);
      var nm = info.name.replace(/\[0\]$/, '');
      p.u[nm] = gl.getUniformLocation(p, info.name);
    }
    n = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (i = 0; i < n; i++) {
      info = gl.getActiveAttrib(p, i);
      p.a[info.name] = gl.getAttribLocation(p, info.name);
    }
    return p;
  };

  G.buffer = function (gl, target, data, usage) {
    var b = gl.createBuffer();
    gl.bindBuffer(target, b);
    gl.bufferData(target, data, usage || gl.STATIC_DRAW);
    return b;
  };

  G.tex2D = function (gl, w, h, internal, format, type, data, filter, wrap) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data || null);
    filter = filter || gl.NEAREST;
    wrap = wrap || gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    t.w = w; t.h = h;
    return t;
  };

  /** 渲染目标：color(+depth) */
  G.fbo = function (gl, w, h, hdr, withDepth) {
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    var internal = (hdr && gl.__floatFB) ? gl.RGBA16F : gl.RGBA8;
    var type = (hdr && gl.__floatFB) ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    var col = G.tex2D(gl, w, h, internal, gl.RGBA, type, null, gl.LINEAR);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, col, 0);
    var dep = null;
    if (withDepth) {
      dep = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, dep);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, dep);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb: f, color: col, depth: dep, w: w, h: h };
  };

  G.fullscreenVS =
    '#version 300 es\n' +
    'const vec2 P[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));\n' +
    'out vec2 vUV;\n' +
    'void main(){ vec2 p = P[gl_VertexID]; vUV = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }\n';

  /* --------------------------- 轨道相机 --------------------------- */
  /**
   * 轨道 + 平移 + 缩放 + 可选自由飞行。
   * 左键拖拽=旋转；右键/中键/Shift+左键=平移；滚轮=缩放（朝光标）；
   * 双击=聚焦；WASD/QE=飞行（自由模式）。
   */
  function Camera(canvas) {
    this.canvas = canvas;
    this.target = [640, 24, 640];
    this.dist = 900;
    this.yaw = -Math.PI / 2 + 0.0001;   // 面向 +Z（南）
    this.pitch = -0.62;
    this.fov = 46 * Math.PI / 180;
    this.near = 1.2; this.far = 6000;
    this.minDist = 12; this.maxDist = 2600;
    this.minPitch = -1.52; this.maxPitch = 0.42;

    this._t = { target: this.target.slice(), dist: this.dist, yaw: this.yaw, pitch: this.pitch };
    this.view = M.mat4(); this.proj = M.mat4(); this.viewProj = M.mat4();
    this.eye = [0, 0, 0];
    this.damp = 0.16;
    this.free = false;
    this.keys = {};
    this.dirty = true;
    this.anim = null;
    this._bind();
  }

  Camera.prototype._bind = function () {
    var self = this, cv = this.canvas, drag = null;

    function pos(e) {
      var r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }

    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    cv.addEventListener('pointerdown', function (e) {
      cv.setPointerCapture(e.pointerId);
      var pan = (e.button === 1 || e.button === 2 || e.shiftKey);
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, pan: pan };
      cv.style.cursor = pan ? 'move' : 'grabbing';
      self.anim = null;
    });

    window.addEventListener('pointerup', function (e) {
      if (drag && drag.id === e.pointerId) { drag = null; cv.style.cursor = 'grab'; }
    });

    window.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      var t = self._t;
      if (drag.pan) {
        // 屏幕平移 → 世界平移（沿相机右向量与前向量的水平投影）
        var k = (t.dist * 0.0016) * (2 * Math.tan(self.fov / 2));
        var cy = Math.cos(t.yaw), sy = Math.sin(t.yaw);
        t.target[0] -= (-sy * dx * k) + (cy * -dy * k);
        t.target[2] -= ( cy * dx * k) + (sy * -dy * k);
      } else {
        t.yaw += dx * 0.0055;
        t.pitch = M.clamp(t.pitch - dy * 0.0042, self.minPitch, self.maxPitch);
      }
      self.dirty = true;
    });

    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.anim = null;
      var t = self._t;
      var k = Math.pow(1.0016, e.deltaY);
      var nd = M.clamp(t.dist * k, self.minDist, self.maxDist);
      // 朝光标缩放：把光标射线与目标平面的交点作为锚
      var p = pos(e);
      var ax = (p[0] / cv.clientWidth) * 2 - 1, ay = 1 - (p[1] / cv.clientHeight) * 2;
      var ratio = 1 - nd / t.dist;
      var sp = self._screenToGround(ax, ay);
      if (sp) {
        t.target[0] += (sp[0] - t.target[0]) * ratio * 0.85;
        t.target[2] += (sp[2] - t.target[2]) * ratio * 0.85;
      }
      t.dist = nd;
      self.dirty = true;
    }, { passive: false });

    cv.addEventListener('dblclick', function (e) {
      var p = pos(e);
      var ax = (p[0] / cv.clientWidth) * 2 - 1, ay = 1 - (p[1] / cv.clientHeight) * 2;
      var sp = self._screenToGround(ax, ay);
      if (sp) self.flyTo({ target: [sp[0], self._t.target[1], sp[2]], dist: Math.max(self.minDist, self._t.dist * 0.45) }, 700);
    });

    window.addEventListener('keydown', function (e) {
      self.keys[e.code] = true;
      if (e.code === 'KeyF') { self.free = !self.free; }
    });
    window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
    cv.style.cursor = 'grab';
  };

  /** 屏幕 NDC → 与 y=target[1] 平面的交点 */
  Camera.prototype._screenToGround = function (ax, ay) {
    var t = this._t;
    var cp = Math.cos(t.pitch), sp = Math.sin(t.pitch);
    var fwd = [Math.cos(t.yaw) * cp, sp, Math.sin(t.yaw) * cp];
    var eye = [t.target[0] - fwd[0]*t.dist, t.target[1] - fwd[1]*t.dist, t.target[2] - fwd[2]*t.dist];
    var right = M.norm3([-Math.sin(t.yaw), 0, Math.cos(t.yaw)]);
    var up = M.norm3([fwd[1]*right[2]-fwd[2]*right[1], fwd[2]*right[0]-fwd[0]*right[2], fwd[0]*right[1]-fwd[1]*right[0]]);
    var aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    var th = Math.tan(this.fov / 2);
    var dir = M.norm3([
      fwd[0] + right[0]*ax*th*aspect + up[0]*ay*th,
      fwd[1] + right[1]*ax*th*aspect + up[1]*ay*th,
      fwd[2] + right[2]*ax*th*aspect + up[2]*ay*th]);
    if (Math.abs(dir[1]) < 1e-5) return null;
    var s = (t.target[1] - eye[1]) / dir[1];
    if (s < 0) return null;
    return [eye[0] + dir[0]*s, t.target[1], eye[2] + dir[2]*s];
  };

  Camera.prototype.flyTo = function (to, ms) {
    var from = { target: this._t.target.slice(), dist: this._t.dist, yaw: this._t.yaw, pitch: this._t.pitch };
    var t2 = { target: (to.target || from.target).slice(), dist: to.dist != null ? to.dist : from.dist,
               yaw: to.yaw != null ? to.yaw : from.yaw, pitch: to.pitch != null ? to.pitch : from.pitch };
    // 取最短角路径
    while (t2.yaw - from.yaw > Math.PI) t2.yaw -= Math.PI * 2;
    while (t2.yaw - from.yaw < -Math.PI) t2.yaw += Math.PI * 2;
    this.anim = { from: from, to: t2, t0: performance.now(), ms: ms || 900 };
  };

  Camera.prototype.update = function (dt) {
    var t = this._t;
    if (this.anim) {
      var k = M.clamp((performance.now() - this.anim.t0) / this.anim.ms, 0, 1);
      var e = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k+2, 3)/2;
      var a = this.anim.from, b = this.anim.to;
      t.target[0] = M.lerp(a.target[0], b.target[0], e);
      t.target[1] = M.lerp(a.target[1], b.target[1], e);
      t.target[2] = M.lerp(a.target[2], b.target[2], e);
      t.dist = M.lerp(a.dist, b.dist, e);
      t.yaw = M.lerp(a.yaw, b.yaw, e);
      t.pitch = M.lerp(a.pitch, b.pitch, e);
      if (k >= 1) this.anim = null;
      this.dirty = true;
    }

    // 键盘（自由飞行 / 平移）
    var K = this.keys, sp = (K.ShiftLeft ? 3.2 : 1) * t.dist * 0.9 * dt;
    var mvx = 0, mvz = 0, mvy = 0;
    if (K.KeyW || K.ArrowUp) mvz += 1;
    if (K.KeyS || K.ArrowDown) mvz -= 1;
    if (K.KeyA || K.ArrowLeft) mvx -= 1;
    if (K.KeyD || K.ArrowRight) mvx += 1;
    if (K.KeyQ || K.PageDown) mvy -= 1;
    if (K.KeyE || K.PageUp) mvy += 1;
    if (mvx || mvz || mvy) {
      var cy = Math.cos(t.yaw), sy = Math.sin(t.yaw);
      t.target[0] += (cy * mvz + -sy * mvx) * sp;
      t.target[2] += (sy * mvz + cy * mvx) * sp;
      t.target[1] = M.clamp(t.target[1] + mvy * sp, -160, 400);
      this.anim = null; this.dirty = true;
    }

    // 阻尼跟随
    var d = this.damp;
    this.target[0] += (t.target[0] - this.target[0]) * d;
    this.target[1] += (t.target[1] - this.target[1]) * d;
    this.target[2] += (t.target[2] - this.target[2]) * d;
    this.dist += (t.dist - this.dist) * d;
    this.yaw += (t.yaw - this.yaw) * d;
    this.pitch += (t.pitch - this.pitch) * d;

    var cp = Math.cos(this.pitch), spp = Math.sin(this.pitch);
    var fwd = [Math.cos(this.yaw) * cp, spp, Math.sin(this.yaw) * cp];
    this.fwd = fwd;
    this.eye[0] = this.target[0] - fwd[0] * this.dist;
    this.eye[1] = this.target[1] - fwd[1] * this.dist;
    this.eye[2] = this.target[2] - fwd[2] * this.dist;

    var aspect = this.canvas.width / Math.max(1, this.canvas.height);
    M.perspective(this.proj, this.fov, aspect, this.near, this.far);
    M.lookAt(this.view, this.eye, this.target, [0, 1, 0]);
    M.mul(this.viewProj, this.proj, this.view);
    this.planes = M.frustum(this.viewProj);
  };

  Camera.prototype.project = function (x, y, z, out) {
    var m = this.viewProj;
    var cx = m[0]*x + m[4]*y + m[8]*z + m[12];
    var cy = m[1]*x + m[5]*y + m[9]*z + m[13];
    var cw = m[3]*x + m[7]*y + m[11]*z + m[15];
    if (cw <= 0.001) return false;
    out[0] = (cx / cw * 0.5 + 0.5) * this.canvas.clientWidth;
    out[1] = (1 - (cy / cw * 0.5 + 0.5)) * this.canvas.clientHeight;
    out[2] = cw;
    return true;
  };

  VX.Camera = Camera;
})(window);
