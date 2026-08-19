/* DEEP SPACE CRAFT · render.js —— 体素渲染 / 程序化天空 / 粒子 / 盒模型 / 泛光后处理 */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});
  var GL = DSC.GL, M4 = DSC.M4, V3 = DSC.V3, U = DSC.Util;

  /* ================================================================ 相机 */
  var Cam = {
    pos: new Float32Array([0, 60, 0]),
    yaw: 0, pitch: 0, roll: 0,
    fov: 78, near: 0.08, far: 340,
    view: M4.identity(), proj: M4.identity(), viewProj: M4.identity(),
    invViewProj: M4.identity(),
    fwd: new Float32Array([0, 0, -1]), right: new Float32Array([1, 0, 0]), up: new Float32Array([0, 1, 0]),
    shake: 0, shakeT: 0,
    update: function (aspect) {
      /* 防 NaN 传染：任何非法相机参数都会让整帧变成 NaN（表现为纯白/纯黑画面） */
      if (!isFinite(Cam.pos[0]) || !isFinite(Cam.pos[1]) || !isFinite(Cam.pos[2])) {
        console.warn('[Cam] pos 非法，已重置', Cam.pos[0], Cam.pos[1], Cam.pos[2]);
        Cam.pos[0] = 0; Cam.pos[1] = 64; Cam.pos[2] = 0;
      }
      if (!isFinite(Cam.yaw)) Cam.yaw = 0;
      if (!isFinite(Cam.pitch)) Cam.pitch = 0;
      if (!isFinite(Cam.roll)) Cam.roll = 0;
      if (!isFinite(aspect) || aspect <= 0) aspect = 16 / 9;
      var cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch);
      var cy = Math.cos(Cam.yaw), sy = Math.sin(Cam.yaw);
      /* 前向：yaw=0 面向 -Z */
      Cam.fwd[0] = -sy * cp; Cam.fwd[1] = sp; Cam.fwd[2] = -cy * cp;
      V3.norm(Cam.fwd, Cam.fwd);
      var worldUp = [0, 1, 0];
      V3.cross(Cam.fwd, worldUp, Cam.right); V3.norm(Cam.right, Cam.right);
      V3.cross(Cam.right, Cam.fwd, Cam.up); V3.norm(Cam.up, Cam.up);
      /* 侧滚 */
      if (Math.abs(Cam.roll) > 1e-4) {
        var c = Math.cos(Cam.roll), s = Math.sin(Cam.roll);
        var r0 = Cam.right[0], r1 = Cam.right[1], r2 = Cam.right[2];
        var u0 = Cam.up[0], u1 = Cam.up[1], u2 = Cam.up[2];
        Cam.right[0] = r0 * c + u0 * s; Cam.right[1] = r1 * c + u1 * s; Cam.right[2] = r2 * c + u2 * s;
        Cam.up[0] = u0 * c - r0 * s; Cam.up[1] = u1 * c - r1 * s; Cam.up[2] = u2 * c - r2 * s;
      }
      var eye = Cam.pos, ctr = [eye[0] + Cam.fwd[0], eye[1] + Cam.fwd[1], eye[2] + Cam.fwd[2]];
      M4.lookAt(eye, ctr, Cam.up, Cam.view);
      M4.perspective(Cam.fov * Math.PI / 180, aspect, Cam.near, Cam.far, Cam.proj);
      M4.mul(Cam.proj, Cam.view, Cam.viewProj);
      M4.invert(Cam.viewProj, Cam.invViewProj);
    },
    /* 相机抖动（大气进入/受伤/引擎） */
    applyShake: function (amount, t) {
      if (amount <= 0) return;
      var s = amount;
      Cam.pos[0] += (Math.sin(t * 41.3) + Math.sin(t * 27.7)) * 0.5 * s;
      Cam.pos[1] += (Math.sin(t * 33.1) + Math.sin(t * 19.3)) * 0.5 * s;
      Cam.pos[2] += (Math.sin(t * 25.9) + Math.sin(t * 51.1)) * 0.5 * s;
    }
  };

  /* ================================================================ 着色器源 */
  var VS_CHUNK =
    '#version 300 es\n' +
    'layout(location=0) in vec3 a_pos;\n' +
    'layout(location=1) in float a_tile;\n' +
    'layout(location=2) in float a_shade;\n' +
    'layout(location=3) in float a_light;\n' +
    'layout(location=4) in float a_corner;\n' +
    'layout(location=5) in float a_face;\n' +
    'uniform mat4 u_viewProj; uniform vec3 u_chunkPos; uniform float u_time;\n' +
    'uniform float u_waterTile;\n' +
    'out vec2 v_uv; out float v_shade; out vec2 v_light; out vec3 v_world; out float v_face; out float v_tile;\n' +
    'void main(){\n' +
    '  vec3 p = a_pos + u_chunkPos;\n' +
    '  float isWater = step(abs(a_tile - u_waterTile), 0.5);\n' +
    '  float top = step(1.5, a_face) * step(a_face, 2.5);\n' +
    '  p.y -= isWater * (0.12 - 0.055*sin(p.x*0.7 + p.z*0.6 + u_time*1.7)) * top;\n' +
    '  vec2 cuv = vec2(mod(a_corner,2.0)==1.0?1.0:0.0, a_corner>=2.0?1.0:0.0);\n' +
    '  if(a_corner==2.0) cuv = vec2(1.0,1.0); else if(a_corner==3.0) cuv = vec2(0.0,1.0);\n' +
    '  float col = mod(a_tile, 16.0), row = floor(a_tile/16.0);\n' +
    '  vec2 t = clamp(cuv, 0.0018, 0.9982);\n' +
    '  v_uv = (vec2(col,row) + t) / 16.0;\n' +
    '  v_shade = a_shade;\n' +
    '  float sky = floor(a_light/16.0), blk = mod(a_light,16.0);\n' +
    '  v_light = vec2(sky/15.0, blk/15.0);\n' +
    '  v_world = p; v_face = a_face; v_tile = a_tile;\n' +
    '  gl_Position = u_viewProj * vec4(p,1.0);\n' +
    '}\n';

  var FS_CHUNK =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'in vec2 v_uv; in float v_shade; in vec2 v_light; in vec3 v_world; in float v_face; in float v_tile;\n' +
    'uniform sampler2D u_atlas;\n' +
    'uniform vec3 u_camPos, u_fogColor, u_sunColor, u_nightTint, u_sunDir;\n' +
    'uniform float u_day, u_fogDensity, u_fogStart, u_alpha, u_underwater, u_time, u_flash;\n' +
    'out vec4 fragColor;\n' +
    'void main(){\n' +
    '  vec4 tex = texture(u_atlas, v_uv);\n' +
    '  if(tex.a < 0.04) discard;\n' +
    '  float sky = v_light.x, blk = v_light.y;\n' +
    '  float skyL = sky * mix(0.085, 1.0, u_day);\n' +
    '  float lit = max(skyL, blk*1.06);\n' +
    '  vec3 lightCol = mix(u_nightTint, u_sunColor, clamp(u_day*1.15,0.0,1.0));\n' +
    /* 太阳方向对顶面加一点方向感 */
    '  float topBoost = (v_face > 1.5 && v_face < 2.5) ? 0.10*clamp(u_sunDir.y,0.0,1.0) : 0.0;\n' +
    '  vec3 col = tex.rgb * v_shade * (0.055 + 0.945*lit + topBoost) * lightCol;\n' +
    '  col += tex.rgb * blk * blk * 0.35;\n' +           /* 自发光块的辉光 */
    '  float d = length(v_world - u_camPos);\n' +
    '  float f = 1.0 - exp(-pow(max(0.0, d - u_fogStart) * u_fogDensity, 1.85));\n' +
    '  vec3 fogC = u_fogColor;\n' +
    '  if(u_underwater > 0.5){ fogC = vec3(0.06,0.22,0.42); f = 1.0 - exp(-d*0.055); col *= vec3(0.55,0.78,1.0); }\n' +
    '  col = mix(col, fogC, clamp(f, 0.0, 1.0));\n' +
    '  col += u_flash;\n' +
    '  fragColor = vec4(col, tex.a * u_alpha);\n' +
    '}\n';

  /* ---- 程序化天空（地表用）：渐变 + 太阳 + 云 + 夜空星 ---- */
  var VS_SCREEN =
    '#version 300 es\n' +
    'layout(location=0) in vec2 a_pos;\n' +
    'out vec2 v_ndc;\n' +
    'void main(){ v_ndc = a_pos; gl_Position = vec4(a_pos,0.0,1.0); }\n';

  var FS_SKY =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'in vec2 v_ndc;\n' +
    'uniform mat4 u_invViewProj;\n' +
    'uniform vec3 u_camPos, u_skyTop, u_skyHorizon, u_sunDir, u_sunColor, u_fogColor;\n' +
    'uniform float u_time, u_day, u_cloud, u_starFade, u_seed, u_haze;\n' +
    'out vec4 fragColor;\n' +
    'float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }\n' +
    'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);\n' +
    '  float a=h21(i), b=h21(i+vec2(1,0)), c=h21(i+vec2(0,1)), d=h21(i+vec2(1,1));\n' +
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }\n' +
    'float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=vnoise(p)*a; p*=2.03; a*=0.5;} return s; }\n' +
    'void main(){\n' +
    '  vec4 far = u_invViewProj * vec4(v_ndc, 1.0, 1.0);\n' +
    '  vec3 dir = normalize(far.xyz/far.w - u_camPos);\n' +
    '  float up = clamp(dir.y*0.5+0.5, 0.0, 1.0);\n' +
    '  float horiz = pow(1.0 - abs(dir.y), 3.0);\n' +
    '  vec3 col = mix(u_skyHorizon, u_skyTop, pow(clamp(dir.y,0.0,1.0), 0.55));\n' +
    /* 黄昏：太阳附近染色 */
    '  float sd = max(0.0, dot(dir, normalize(u_sunDir)));\n' +
    '  float dusk = (1.0 - clamp(abs(u_sunDir.y)*3.0,0.0,1.0));\n' +
    '  col = mix(col, u_sunColor*vec3(1.15,0.66,0.42), pow(sd, 3.0)*0.65*dusk);\n' +
    '  col = mix(col, u_sunColor, pow(sd, 260.0)*1.4);\n' +      /* 日面 */
    '  col += u_sunColor * pow(sd, 22.0) * 0.35;\n' +            /* 日晕 */
    /* 夜间：星空 */
    '  if(u_starFade > 0.01){\n' +
    '    vec3 sd3 = dir*vec3(120.0);\n' +
    '    vec2 g = floor(sd3.xz + sd3.y*0.37);\n' +
    '    float st = h21(g + u_seed);\n' +
    '    float star = smoothstep(0.9975, 1.0, st) * (0.6+0.4*sin(u_time*2.0+st*90.0));\n' +
    '    col += vec3(0.85,0.92,1.0) * star * u_starFade * clamp(dir.y*2.0,0.0,1.0) * 3.0;\n' +
    '  }\n' +
    /* 云层：两层不同速度的 fbm */
    '  if(u_cloud > 0.01 && dir.y > 0.005){\n' +
    '    vec2 cp = dir.xz / max(dir.y, 0.06);\n' +
    '    float c1 = fbm(cp*0.55 + vec2(u_time*0.006, u_time*0.004) + u_seed);\n' +
    '    float c2 = fbm(cp*1.30 - vec2(u_time*0.010, u_time*0.007));\n' +
    '    float cl = smoothstep(0.52, 0.86, c1*0.65 + c2*0.45);\n' +
    '    cl *= smoothstep(0.0, 0.22, dir.y);\n' +
    '    vec3 cc = mix(vec3(0.55,0.6,0.68), vec3(1.06,1.02,0.98), clamp(u_day*1.3,0.0,1.0));\n' +
    '    cc = mix(cc, u_sunColor*1.1, pow(sd,6.0)*0.6);\n' +
    '    col = mix(col, cc, cl*u_cloud);\n' +
    '  }\n' +
    /* 地平线雾霭 */
    '  col = mix(col, u_fogColor, horiz*0.55*u_haze);\n' +
    '  fragColor = vec4(col, 1.0);\n' +
    '}\n';

  /* ---- 破坏裂纹（MC 招牌的 10 级 destroy stage 叠加） ---- */
  var VS_CRACK =
    '#version 300 es\n' +
    'layout(location=0) in vec3 a_pos;\n' +
    'layout(location=2) in vec2 a_uv;\n' +
    'uniform mat4 u_viewProj; uniform vec3 u_pos; uniform float u_scale;\n' +
    'out vec2 v_uv;\n' +
    'void main(){ v_uv = a_uv; gl_Position = u_viewProj * vec4(a_pos*u_scale + u_pos, 1.0); }\n';
  var FS_CRACK =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'in vec2 v_uv; uniform sampler2D u_crack; uniform float u_stage;\n' +
    'out vec4 fragColor;\n' +
    'void main(){\n' +
    '  vec2 uv = vec2((clamp(v_uv.x,0.004,0.996) + u_stage)/10.0, clamp(v_uv.y,0.004,0.996));\n' +
    '  vec4 c = texture(u_crack, uv);\n' +
    '  if(c.a < 0.05) discard;\n' +
    '  fragColor = vec4(c.rgb, c.a*0.88);\n' +
    '}\n';

  /* ---- 选择框（MC 黑色描边） ---- */
  var VS_LINE =
    '#version 300 es\n' +
    'layout(location=0) in vec3 a_pos;\n' +
    'uniform mat4 u_viewProj; uniform vec3 u_offset; uniform float u_scale;\n' +
    'void main(){ gl_Position = u_viewProj * vec4(a_pos*u_scale + u_offset, 1.0); }\n';
  var FS_LINE =
    '#version 300 es\n' +
    'precision highp float; uniform vec4 u_color; out vec4 fragColor;\n' +
    'void main(){ fragColor = u_color; }\n';

  /* ---- 粒子（实例化 billboard） ---- */
  var VS_PART =
    '#version 300 es\n' +
    'layout(location=0) in vec2 a_quad;\n' +
    'layout(location=1) in vec3 i_pos;\n' +
    'layout(location=2) in vec4 i_col;\n' +
    'layout(location=3) in vec2 i_size;\n' +
    'uniform mat4 u_viewProj; uniform vec3 u_right, u_up, u_camPos;\n' +
    'out vec4 v_col; out vec2 v_uv; out float v_dist;\n' +
    'void main(){\n' +
    '  vec3 p = i_pos + u_right*(a_quad.x*i_size.x) + u_up*(a_quad.y*i_size.x);\n' +
    '  v_col = i_col; v_uv = a_quad*0.5+0.5; v_dist = length(p-u_camPos);\n' +
    '  gl_Position = u_viewProj * vec4(p,1.0);\n' +
    '}\n';
  var FS_PART =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'in vec4 v_col; in vec2 v_uv; in float v_dist;\n' +
    'uniform vec3 u_fogColor; uniform float u_fogDensity, u_soft;\n' +
    'out vec4 fragColor;\n' +
    'void main(){\n' +
    '  float d = length(v_uv-0.5)*2.0;\n' +
    '  float a = v_col.a * mix(1.0, smoothstep(1.0, 0.0, d), u_soft);\n' +
    '  if(a < 0.01) discard;\n' +
    '  float f = 1.0 - exp(-pow(v_dist*u_fogDensity, 1.8));\n' +
    '  vec3 c = mix(v_col.rgb, u_fogColor, clamp(f,0.0,0.85));\n' +
    '  fragColor = vec4(c, a);\n' +
    '}\n';

  /* ---- 盒模型（飞船等） ---- */
  var VS_MODEL =
    '#version 300 es\n' +
    'layout(location=0) in vec3 a_pos;\n' +
    'layout(location=1) in vec3 a_nrm;\n' +
    'layout(location=2) in vec3 a_col;\n' +
    'layout(location=3) in float a_emis;\n' +
    'uniform mat4 u_viewProj, u_model; uniform mat3 u_nmat;\n' +
    'out vec3 v_nrm; out vec3 v_col; out float v_emis; out vec3 v_world;\n' +
    'void main(){\n' +
    '  vec4 wp = u_model * vec4(a_pos,1.0);\n' +
    '  v_world = wp.xyz; v_nrm = normalize(u_nmat * a_nrm); v_col = a_col; v_emis = a_emis;\n' +
    '  gl_Position = u_viewProj * wp;\n' +
    '}\n';
  var FS_MODEL =
    '#version 300 es\n' +
    'precision highp float;\n' +
    'in vec3 v_nrm; in vec3 v_col; in float v_emis; in vec3 v_world;\n' +
    'uniform vec3 u_sunDir, u_sunColor, u_camPos, u_fogColor, u_ambient;\n' +
    'uniform float u_fogDensity, u_day, u_alpha, u_glow;\n' +
    'out vec4 fragColor;\n' +
    'void main(){\n' +
    '  vec3 n = normalize(v_nrm);\n' +
    '  float nl = max(0.0, dot(n, normalize(u_sunDir)));\n' +
    '  float rim = pow(1.0 - max(0.0, dot(n, normalize(u_camPos - v_world))), 3.0);\n' +
    '  vec3 col = v_col * (u_ambient + u_sunColor * nl * mix(0.35, 1.0, u_day));\n' +
    '  col += v_col * v_emis * (1.4 + 0.6*u_glow);\n' +
    '  col += vec3(0.35,0.62,0.9) * rim * 0.22;\n' +
    '  float d = length(v_world - u_camPos);\n' +
    '  float f = 1.0 - exp(-pow(d*u_fogDensity, 1.8));\n' +
    '  col = mix(col, u_fogColor, clamp(f,0.0,0.92));\n' +
    '  fragColor = vec4(col, u_alpha);\n' +
    '}\n';

  /* ---- 后处理：亮度提取 / 模糊 / 合成 ---- */
  var FS_BRIGHT =
    '#version 300 es\n' +
    'precision highp float; in vec2 v_ndc; uniform sampler2D u_tex; uniform float u_thresh;\n' +
    'out vec4 fragColor;\n' +
    'void main(){ vec2 uv = v_ndc*0.5+0.5; vec3 c = texture(u_tex, uv).rgb;\n' +
    '  float l = dot(c, vec3(0.2126,0.7152,0.0722));\n' +
    '  float k = smoothstep(u_thresh, u_thresh+0.55, l);\n' +
    '  fragColor = vec4(c*k, 1.0); }\n';
  var FS_BLUR =
    '#version 300 es\n' +
    'precision highp float; in vec2 v_ndc; uniform sampler2D u_tex; uniform vec2 u_dir;\n' +
    'out vec4 fragColor;\n' +
    'void main(){ vec2 uv = v_ndc*0.5+0.5; vec3 s = vec3(0.0);\n' +
    '  float w[5]; w[0]=0.227; w[1]=0.194; w[2]=0.121; w[3]=0.054; w[4]=0.016;\n' +
    '  s += texture(u_tex, uv).rgb * w[0];\n' +
    '  for(int i=1;i<5;i++){ vec2 o = u_dir*float(i)*1.35; s += texture(u_tex, uv+o).rgb*w[i]; s += texture(u_tex, uv-o).rgb*w[i]; }\n' +
    '  fragColor = vec4(s,1.0); }\n';
  var FS_COMPOSITE =
    '#version 300 es\n' +
    'precision highp float; in vec2 v_ndc;\n' +
    'uniform sampler2D u_scene, u_bloom;\n' +
    'uniform float u_bloomAmt, u_exposure, u_vignette, u_aberr, u_heat, u_time, u_desat;\n' +
    'out vec4 fragColor;\n' +
    'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }\n' +
    'void main(){\n' +
    '  vec2 uv = v_ndc*0.5+0.5;\n' +
    /* 大气进入热扰动 */
    '  vec2 wob = vec2(sin(uv.y*70.0+u_time*9.0), cos(uv.x*60.0+u_time*7.0)) * 0.0022 * u_heat;\n' +
    '  vec2 duv = uv + wob;\n' +
    '  vec2 off = (duv-0.5) * u_aberr * 0.004;\n' +
    '  vec3 c;\n' +
    '  c.r = texture(u_scene, duv+off).r; c.g = texture(u_scene, duv).g; c.b = texture(u_scene, duv-off).b;\n' +
    '  vec3 b = texture(u_bloom, duv).rgb;\n' +
    '  c += b * u_bloomAmt;\n' +
    '  c = aces(c * u_exposure);\n' +
    '  float g = dot(c, vec3(0.299,0.587,0.114));\n' +
    '  c = mix(c, vec3(g), u_desat);\n' +
    '  float r = length((uv-0.5)*vec2(1.06,1.0));\n' +
    '  c *= 1.0 - u_vignette*smoothstep(0.42, 0.92, r);\n' +
    '  fragColor = vec4(c, 1.0);\n' +
    '}\n';

  /* ================================================================ 粒子系统 */
  var MAXP = 3000;
  var Particles = {
    n: 0,
    px: new Float32Array(MAXP), py: new Float32Array(MAXP), pz: new Float32Array(MAXP),
    vx: new Float32Array(MAXP), vy: new Float32Array(MAXP), vz: new Float32Array(MAXP),
    life: new Float32Array(MAXP), maxLife: new Float32Array(MAXP),
    r: new Float32Array(MAXP), g: new Float32Array(MAXP), b: new Float32Array(MAXP),
    size: new Float32Array(MAXP), grav: new Float32Array(MAXP), drag: new Float32Array(MAXP),
    glow: new Uint8Array(MAXP),
    inst: new Float32Array(MAXP * 9),
    buf: null, vao: null,

    spawn: function (x, y, z, vx, vy, vz, col, size, life, o) {
      o = o || {};
      var i = Particles.n < MAXP ? Particles.n++ : (Math.random() * MAXP) | 0;
      Particles.px[i] = x; Particles.py[i] = y; Particles.pz[i] = z;
      Particles.vx[i] = vx; Particles.vy[i] = vy; Particles.vz[i] = vz;
      Particles.r[i] = col[0]; Particles.g[i] = col[1]; Particles.b[i] = col[2];
      Particles.size[i] = size; Particles.life[i] = life; Particles.maxLife[i] = life;
      Particles.grav[i] = o.grav === undefined ? -14 : o.grav;
      Particles.drag[i] = o.drag === undefined ? 0.6 : o.drag;
      Particles.glow[i] = o.glow ? 1 : 0;
      return i;
    },
    /* 方块破坏碎片 */
    burst: function (x, y, z, col, n, opt) {
      opt = opt || {};
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, e = Math.random() * 0.9;
        var sp = (opt.speed || 3.4) * (0.4 + Math.random() * 0.9);
        Particles.spawn(
          x + (Math.random() - 0.5) * 0.9, y + Math.random() * 0.9, z + (Math.random() - 0.5) * 0.9,
          Math.cos(a) * sp * e, (opt.up === undefined ? 3.2 : opt.up) * Math.random(), Math.sin(a) * sp * e,
          [col[0] * (0.75 + Math.random() * 0.5), col[1] * (0.75 + Math.random() * 0.5), col[2] * (0.75 + Math.random() * 0.5)],
          opt.size || (0.09 + Math.random() * 0.1), opt.life || (0.55 + Math.random() * 0.5),
          { grav: opt.grav === undefined ? -16 : opt.grav, glow: opt.glow, drag: opt.drag }
        );
      }
    },
    update: function (dt) {
      var i = 0;
      while (i < Particles.n) {
        Particles.life[i] -= dt;
        if (Particles.life[i] <= 0) {
          var last = --Particles.n;
          if (i !== last) {
            Particles.px[i] = Particles.px[last]; Particles.py[i] = Particles.py[last]; Particles.pz[i] = Particles.pz[last];
            Particles.vx[i] = Particles.vx[last]; Particles.vy[i] = Particles.vy[last]; Particles.vz[i] = Particles.vz[last];
            Particles.life[i] = Particles.life[last]; Particles.maxLife[i] = Particles.maxLife[last];
            Particles.r[i] = Particles.r[last]; Particles.g[i] = Particles.g[last]; Particles.b[i] = Particles.b[last];
            Particles.size[i] = Particles.size[last]; Particles.grav[i] = Particles.grav[last];
            Particles.drag[i] = Particles.drag[last]; Particles.glow[i] = Particles.glow[last];
          }
          continue;
        }
        var dr = Math.exp(-Particles.drag[i] * dt);
        Particles.vx[i] *= dr; Particles.vz[i] *= dr;
        Particles.vy[i] = Particles.vy[i] * dr + Particles.grav[i] * dt;
        Particles.px[i] += Particles.vx[i] * dt;
        Particles.py[i] += Particles.vy[i] * dt;
        Particles.pz[i] += Particles.vz[i] * dt;
        i++;
      }
    },
    clear: function () { Particles.n = 0; }
  };

  /* ================================================================ Render */
  var Render = {
    progChunk: null, progSky: null, progLine: null, progPart: null, progModel: null,
    progBright: null, progBlur: null, progComp: null,
    atlasTex: null, atlas: null, boxVAO: null, lineVAO: null,
    sceneFB: null, bloomA: null, bloomB: null,
    quality: 1, bloomOn: true,
    env: {
      fogColor: [0.72, 0.86, 0.95], skyTop: [0.16, 0.43, 0.84], skyHorizon: [0.66, 0.85, 0.94],
      sunColor: [1, 0.95, 0.85], nightTint: [0.30, 0.42, 0.72], sunDir: [0.4, 0.8, 0.3],
      day: 1, fogDensity: 0.0085, fogStart: 12, cloud: 0.75, starFade: 0, haze: 1, seed: 0.5,
      underwater: 0, flash: 0, heat: 0, desat: 0, exposure: 1.06, vignette: 0.34, aberr: 0.6, bloomAmt: 0.55
    },

    init: function () {
      var gl = GL.gl;
      Render.atlas = DSC.Textures.build();
      Render.atlasTex = GL.texFromCanvas(Render.atlas.canvas, { nearest: true, mips: false });
      DSC.Blocks.init(Render.atlas);

      Render.progChunk = GL.program(VS_CHUNK, FS_CHUNK, 'chunk');
      Render.progSky = GL.program(VS_SCREEN, FS_SKY, 'sky');
      Render.progLine = GL.program(VS_LINE, FS_LINE, 'line');
      Render.progPart = GL.program(VS_PART, FS_PART, 'part');
      Render.progModel = GL.program(VS_MODEL, FS_MODEL, 'model');
      Render.progBright = GL.program(VS_SCREEN, FS_BRIGHT, 'bright');
      Render.progBlur = GL.program(VS_SCREEN, FS_BLUR, 'blur');
      Render.progComp = GL.program(VS_SCREEN, FS_COMPOSITE, 'composite');
      Render.progCrack = GL.program(VS_CRACK, FS_CRACK, 'crack');
      GL.screenVAO(0);

      /* 破坏裂纹：把 10 张 16×16 裂纹拼成 160×16 条带，一次上传 */
      try {
        var cr = DSC.Textures.crackTextures();
        var strip = document.createElement('canvas');
        strip.width = 160; strip.height = 16;
        var sctx = strip.getContext('2d');
        sctx.imageSmoothingEnabled = false;
        for (var ci = 0; ci < cr.length; ci++) sctx.drawImage(cr[ci], ci * 16, 0);
        Render.crackTex = GL.texFromCanvas(strip, { nearest: true, mips: false });
        Render.boxMesh = GL.boxMesh();
      } catch (err) { console.warn('[render] 裂纹贴图不可用', err); Render.crackTex = null; }

      /* 线框立方体（选择框） */
      var e = 0.0022, a = -e, b = 1 + e;
      var L = [
        a, a, a, b, a, a, b, a, a, b, a, b, b, a, b, a, a, b, a, a, b, a, a, a,
        a, b, a, b, b, a, b, b, a, b, b, b, b, b, b, a, b, b, a, b, b, a, b, a,
        a, a, a, a, b, a, b, a, a, b, b, a, b, a, b, b, b, b, a, a, b, a, b, b
      ];
      var lb = GL.buffer(new Float32Array(L));
      Render.lineVAO = GL.vao([{ buffer: lb, loc: 0, size: 3 }]);
      Render.lineCount = L.length / 3;

      /* 粒子实例缓冲 */
      var quad = GL.buffer(new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]));
      Particles.buf = GL.buffer(Particles.inst, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
      Particles.vao = GL.vao([
        { buffer: quad, loc: 0, size: 2 },
        { buffer: Particles.buf, loc: 1, size: 3, stride: 36, offset: 0, divisor: 1 },
        { buffer: Particles.buf, loc: 2, size: 4, stride: 36, offset: 12, divisor: 1 },
        { buffer: Particles.buf, loc: 3, size: 2, stride: 36, offset: 28, divisor: 1 }
      ]);

      Render.resize();
      if (DSC.SpaceFX && DSC.SpaceFX.init) {
        try { DSC.SpaceFX.init(); } catch (err) { console.error('[SpaceFX init]', err); }
      }
      return Render;
    },

    resize: function () {
      var w = GL.W, h = GL.H;
      var bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
      if (!Render.sceneFB) {
        Render.sceneFB = GL.fbo(w, h, { depth: true, float: true, nearest: false });
        Render.bloomA = GL.fbo(bw, bh, { depth: false, nearest: false });
        Render.bloomB = GL.fbo(bw, bh, { depth: false, nearest: false });
      } else {
        Render.sceneFB.resize(w, h);
        Render.bloomA.resize(bw, bh);
        Render.bloomB.resize(bw, bh);
      }
    },

    /* 依据星球与时间设置环境（每帧） */
    setPlanetEnv: function (planet, dayT, opts) {
      var E = Render.env, sk = planet.sky;
      opts = opts || {};
      var ang = dayT * Math.PI * 2;
      var sun = [Math.cos(ang), Math.sin(ang), 0.28];
      var l = Math.sqrt(sun[0] * sun[0] + sun[1] * sun[1] + sun[2] * sun[2]);
      E.sunDir = [sun[0] / l, sun[1] / l, sun[2] / l];
      var day = U.clamp(E.sunDir[1] * 1.55 + 0.16, 0, 1);
      E.day = day;
      var night = 1 - day;
      E.skyTop = mixc(sk.top, [0.015, 0.02, 0.06], night * 0.94);
      E.skyHorizon = mixc(sk.horizon, [0.04, 0.05, 0.12], night * 0.86);
      E.fogColor = mixc(sk.fog, [0.03, 0.04, 0.09], night * 0.88);
      E.sunColor = mixc(sk.sun, [0.55, 0.62, 0.95], night * 0.7);
      E.nightTint = [0.26, 0.34, 0.62];
      E.starFade = U.clamp(1 - day * 2.4, 0, 1);
      E.cloud = planet.hasClouds ? 0.85 : 0.15;
      E.haze = 1;
      E.seed = (planet.seed % 1000) / 1000;
      E.fogDensity = 0.0034 * sk.fogDensity * (opts.fogMul || 1);
      E.fogStart = 16;
      return E;
    },
    setSpaceEnv: function () {
      var E = Render.env;
      E.fogDensity = 0; E.fogColor = [0, 0, 0]; E.day = 1; E.underwater = 0;
      E.sunColor = [1, 0.96, 0.9]; E.exposure = 1.0; E.vignette = 0.42;
      return E;
    },

    /* ---------------------------------------------------------- 帧起止 */
    begin: function () {
      GL.bindFB(Render.sceneFB);
      GL.resetState();
      GL.clear(0, 0, 0, 1, true);
      GL.stats.draws = 0; GL.stats.tris = 0;
    },

    end: function (o) {
      o = o || {};
      var gl = GL.gl, E = Render.env;
      /* 泛光 */
      if (Render.bloomOn && (o.bloom === undefined ? true : o.bloom)) {
        GL.depth(false, { write: false }); GL.blend('off'); GL.cull('off');
        GL.bindFB(Render.bloomA);
        Render.progBright.use();
        GL.setTex(0, Render.sceneFB.color);
        Render.progBright.seti('u_tex', 0).set('u_thresh', o.thresh === undefined ? 0.72 : o.thresh);
        GL.drawScreen();
        var px = 1 / Render.bloomA.w, py = 1 / Render.bloomA.h;
        for (var i = 0; i < 2; i++) {
          GL.bindFB(Render.bloomB);
          Render.progBlur.use(); GL.setTex(0, Render.bloomA.color);
          Render.progBlur.seti('u_tex', 0).set('u_dir', [px * (1 + i), 0]);
          GL.drawScreen();
          GL.bindFB(Render.bloomA);
          Render.progBlur.use(); GL.setTex(0, Render.bloomB.color);
          Render.progBlur.seti('u_tex', 0).set('u_dir', [0, py * (1 + i)]);
          GL.drawScreen();
        }
      }
      /* 合成到屏幕 */
      GL.bindFB(null);
      GL.depth(false, { write: false }); GL.blend('off'); GL.cull('off');
      Render.progComp.use();
      GL.setTex(0, Render.sceneFB.color);
      GL.setTex(1, Render.bloomA.color);
      Render.progComp.seti('u_scene', 0).seti('u_bloom', 1)
        .set('u_bloomAmt', (Render.bloomOn ? (o.bloomAmt === undefined ? E.bloomAmt : o.bloomAmt) : 0))
        .set('u_exposure', o.exposure === undefined ? E.exposure : o.exposure)
        .set('u_vignette', o.vignette === undefined ? E.vignette : o.vignette)
        .set('u_aberr', o.aberr === undefined ? E.aberr : o.aberr)
        .set('u_heat', o.heat === undefined ? E.heat : o.heat)
        .set('u_desat', o.desat === undefined ? E.desat : o.desat)
        .set('u_time', o.time || 0);
      GL.drawScreen();
      GL.resetState();
    },

    /* ---------------------------------------------------------- 天空 */
    drawSky: function (time) {
      var E = Render.env;
      GL.depth(false, { write: false }); GL.blend('off'); GL.cull('off');
      Render.progSky.use();
      Render.progSky
        .set('u_invViewProj', Cam.invViewProj)
        .set('u_camPos', Cam.pos)
        .set('u_skyTop', E.skyTop).set('u_skyHorizon', E.skyHorizon)
        .set('u_sunDir', E.sunDir).set('u_sunColor', E.sunColor).set('u_fogColor', E.fogColor)
        .set('u_time', time).set('u_day', E.day).set('u_cloud', E.cloud)
        .set('u_starFade', E.starFade).set('u_seed', E.seed).set('u_haze', E.haze);
      GL.drawScreen();
      GL.resetState();
    },

    /* ---------------------------------------------------------- 区块 */
    drawChunks: function (time) {
      var gl = GL.gl, W = DSC.World, E = Render.env;
      var p = Render.progChunk;
      p.use();
      GL.setTex(0, Render.atlasTex);
      p.seti('u_atlas', 0)
        .set('u_viewProj', Cam.viewProj).set('u_camPos', Cam.pos)
        .set('u_fogColor', E.fogColor).set('u_sunColor', E.sunColor)
        .set('u_nightTint', E.nightTint).set('u_sunDir', E.sunDir)
        .set('u_day', E.day).set('u_fogDensity', E.fogDensity).set('u_fogStart', E.fogStart)
        .set('u_alpha', 1).set('u_underwater', E.underwater).set('u_time', time)
        .set('u_flash', E.flash).set('u_waterTile', Render.atlas.index.water || 0);

      var ccx = Math.floor(Cam.pos[0] / 16), ccz = Math.floor(Cam.pos[2] / 16);
      var dist = W.renderDist + 1;
      var list = [], k, ch;
      for (k in W.chunks) {
        ch = W.chunks[k];
        if (!ch.mesh && !ch.waterMesh) continue;
        var dx = ch.cx - ccx, dz = ch.cz - ccz;
        if (Math.abs(dx) > dist || Math.abs(dz) > dist) continue;
        /* 简易视锥剔除：区块中心方向与视线夹角 */
        var wx = ch.cx * 16 + 8 - Cam.pos[0], wz = ch.cz * 16 + 8 - Cam.pos[2];
        var d2 = Math.sqrt(wx * wx + wz * wz);
        if (d2 > 24) {
          var dot = (wx * Cam.fwd[0] + wz * Cam.fwd[2]) / d2;
          if (dot < 0.35 - 12 / d2) continue;
        }
        list.push([d2, ch]);
      }
      list.sort(function (a, b) { return a[0] - b[0]; });
      GL.cull('back'); GL.depth(true, { write: true }); GL.blend('off');
      var i;
      for (i = 0; i < list.length; i++) {
        ch = list[i][1];
        if (!ch.mesh) continue;
        p.set('u_chunkPos', [ch.cx * 16, 0, ch.cz * 16]);
        gl.bindVertexArray(ch.mesh.vao);
        gl.drawElements(gl.TRIANGLES, ch.mesh.indexCount, gl.UNSIGNED_INT, 0);
        GL.stats.draws++;
      }
      /* 半透明（水/玻璃/冰）：由远到近，关闭深度写入 */
      GL.blend('alpha'); GL.depth(true, { write: false }); GL.cull('off');
      for (i = list.length - 1; i >= 0; i--) {
        ch = list[i][1];
        if (!ch.waterMesh) continue;
        p.set('u_chunkPos', [ch.cx * 16, 0, ch.cz * 16]);
        gl.bindVertexArray(ch.waterMesh.vao);
        gl.drawElements(gl.TRIANGLES, ch.waterMesh.indexCount, gl.UNSIGNED_INT, 0);
        GL.stats.draws++;
      }
      gl.bindVertexArray(null);
      GL.resetState();
    },

    /* ---------------------------------------------------------- 选择框 */
    drawSelection: function (x, y, z, alpha) {
      var gl = GL.gl;
      GL.depth(true, { write: false }); GL.blend('alpha'); GL.cull('off');
      Render.progLine.use();
      Render.progLine.set('u_viewProj', Cam.viewProj).set('u_offset', [x, y, z]).set('u_scale', 1)
        .set('u_color', [0, 0, 0, 0.55 * (alpha === undefined ? 1 : alpha)]);
      gl.bindVertexArray(Render.lineVAO);
      gl.drawArrays(gl.LINES, 0, Render.lineCount);
      /* 内层橙色高亮（NMS 味） */
      Render.progLine.set('u_offset', [x - 0.004, y - 0.004, z - 0.004]).set('u_scale', 1.008)
        .set('u_color', [1, 0.63, 0.24, 0.30 * (alpha === undefined ? 1 : alpha)]);
      gl.drawArrays(gl.LINES, 0, Render.lineCount);
      gl.bindVertexArray(null);
      GL.resetState();
    },

    /* ---------------------------------------------------------- 破坏裂纹 */
    drawCrack: function (x, y, z, progress) {
      if (!Render.crackTex || !Render.boxMesh || progress <= 0.02) return;
      var gl = GL.gl;
      var stage = Math.min(9, Math.floor(progress * 10));
      GL.depth(true, { write: false }); GL.blend('alpha'); GL.cull('back');
      Render.progCrack.use();
      GL.setTex(0, Render.crackTex);
      Render.progCrack.seti('u_crack', 0)
        .set('u_viewProj', Cam.viewProj)
        .set('u_pos', [x + 0.5, y + 0.5, z + 0.5])
        .set('u_scale', 1.006)
        .set('u_stage', stage);
      GL.draw(Render.boxMesh);
      GL.resetState();
    },

    /* ---------------------------------------------------------- 粒子 */
    drawParticles: function () {
      if (!Particles.n) return;
      var gl = GL.gl, E = Render.env, inst = Particles.inst;
      for (var i = 0; i < Particles.n; i++) {
        var o = i * 9, lf = Particles.life[i] / Particles.maxLife[i];
        inst[o] = Particles.px[i]; inst[o + 1] = Particles.py[i]; inst[o + 2] = Particles.pz[i];
        var boost = Particles.glow[i] ? 1.9 : 1;
        inst[o + 3] = Particles.r[i] * boost; inst[o + 4] = Particles.g[i] * boost; inst[o + 5] = Particles.b[i] * boost;
        inst[o + 6] = U.clamp(lf * 1.6, 0, 1);
        inst[o + 7] = Particles.size[i] * (0.55 + 0.45 * lf);
        inst[o + 8] = Particles.glow[i];
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, Particles.buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst, 0, Particles.n * 9);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      GL.depth(true, { write: false }); GL.blend('alpha'); GL.cull('off');
      Render.progPart.use();
      Render.progPart.set('u_viewProj', Cam.viewProj).set('u_right', Cam.right).set('u_up', Cam.up)
        .set('u_camPos', Cam.pos).set('u_fogColor', Render.env.fogColor)
        .set('u_fogDensity', Render.env.fogDensity).set('u_soft', 0.65);
      gl.bindVertexArray(Particles.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Particles.n);
      gl.bindVertexArray(null);
      GL.stats.draws++;
      GL.resetState();
    },

    /* ---------------------------------------------------------- 盒模型 */
    buildBoxModel: function (boxes) {
      var gl = GL.gl;
      var verts = [], idx = [], vn = 0;
      var F = [
        { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
        { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
        { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
        { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
        { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
        { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] }
      ];
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        var mn = b.min, mx = b.max, c = b.color, em = b.emis || 0;
        for (var f = 0; f < 6; f++) {
          var ff = F[f];
          for (var k = 0; k < 4; k++) {
            var v = ff.v[k];
            verts.push(
              mn[0] + (mx[0] - mn[0]) * v[0], mn[1] + (mx[1] - mn[1]) * v[1], mn[2] + (mx[2] - mn[2]) * v[2],
              ff.n[0], ff.n[1], ff.n[2], c[0], c[1], c[2], em
            );
          }
          idx.push(vn, vn + 1, vn + 2, vn, vn + 2, vn + 3); vn += 4;
        }
      }
      var vb = GL.buffer(new Float32Array(verts));
      var ib = GL.buffer(new Uint32Array(idx), gl.ELEMENT_ARRAY_BUFFER);
      var st = 10 * 4;
      var vao = GL.vao([
        { buffer: vb, loc: 0, size: 3, stride: st, offset: 0 },
        { buffer: vb, loc: 1, size: 3, stride: st, offset: 12 },
        { buffer: vb, loc: 2, size: 3, stride: st, offset: 24 },
        { buffer: vb, loc: 3, size: 1, stride: st, offset: 36 }
      ], ib);
      return { vao: vao, indexCount: idx.length, indexType: gl.UNSIGNED_INT };
    },

    drawModel: function (mesh, model, o) {
      if (!mesh) return;
      o = o || {};
      var gl = GL.gl, E = Render.env;
      GL.depth(true, { write: true }); GL.blend(o.alpha !== undefined && o.alpha < 1 ? 'alpha' : 'off'); GL.cull('back');
      Render.progModel.use();
      Render.progModel
        .set('u_viewProj', Cam.viewProj).set('u_model', model)
        .set('u_nmat', M4.normalFromMat4(model))
        .set('u_sunDir', o.sunDir || E.sunDir).set('u_sunColor', o.sunColor || E.sunColor)
        .set('u_camPos', Cam.pos).set('u_fogColor', E.fogColor).set('u_ambient', o.ambient || [0.32, 0.36, 0.44])
        .set('u_fogDensity', o.fogDensity === undefined ? E.fogDensity : o.fogDensity)
        .set('u_day', o.day === undefined ? E.day : o.day)
        .set('u_alpha', o.alpha === undefined ? 1 : o.alpha)
        .set('u_glow', o.glow || 0);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.indexCount, mesh.indexType || gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
      GL.stats.draws++;
      GL.resetState();
    }
  };

  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  DSC.Cam = Cam;
  DSC.Render = Render;
  DSC.Particles = Particles;
})();
