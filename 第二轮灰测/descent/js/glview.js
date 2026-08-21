/* ============================================================
   glview.js — WebGL2 全屏光线步进：大气 / 体积云 / 星球表面 / 等离子鞘 / 水下
   ============================================================ */
(function (glob) {
  'use strict';

  const VS = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

  const FS = `#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uRight, uUp, uFwd;
uniform float uTanF;
uniform float uAlt;        // km（可为负：气态巨行星基准面以下）
uniform vec2  uPos;        // km 横向偏移
uniform vec3  uSunDir, uSunCol;
uniform vec3  uZen, uHor, uHaze, uAmb;
uniform float uAtmH;       // 标高 km
uniform float uR;          // 星球半径 km
uniform float uFogK;
uniform int   uSurf;       // 0海 1岩 2冰 3沙 4无 5熔岩
uniform vec3  uSurfCol;
uniform vec3  uLayB, uLayT, uLayC, uLayD;
uniform mat3  uLayCol;
uniform float uWind;
uniform float uQual;
uniform float uHeat;
uniform float uFlash;
uniform float uGlow;
uniform float uUnder;      // <0 空中，>=0 水下深度 km
uniform float uExp;
uniform float uAurora;
uniform float uWhite;
uniform float uWaveAmp;

const float PI = 3.14159265;
const float EXT = 6.0;     // 云消光系数

/* ---------- 噪声 ---------- */
float hash13(vec3 p){
  p = fract(p*0.3183099 + vec3(0.71,0.113,0.419));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f*f*(3.0-2.0*f);
  float a = mix(hash13(i+vec3(0.,0.,0.)), hash13(i+vec3(1.,0.,0.)), f.x);
  float b = mix(hash13(i+vec3(0.,1.,0.)), hash13(i+vec3(1.,1.,0.)), f.x);
  float c = mix(hash13(i+vec3(0.,0.,1.)), hash13(i+vec3(1.,0.,1.)), f.x);
  float d = mix(hash13(i+vec3(0.,1.,1.)), hash13(i+vec3(1.,1.,1.)), f.x);
  return mix(mix(a,b,f.y), mix(c,d,f.y), f.z);
}
float fbm3(vec3 p, int oct){
  float s = 0.0, a = 0.5;
  for(int i=0;i<5;i++){
    if(i>=oct) break;
    s += a*vnoise(p);
    p = p*2.03 + vec3(1.7,9.2,3.1);
    a *= 0.5;
  }
  return s;
}
float hg(float c, float g){
  float g2 = g*g;
  return (1.0-g2)/(4.0*PI*pow(max(1.0+g2-2.0*g*c, 1e-4), 1.5));
}
vec3 aces(vec3 x){
  return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0);
}

/* ---------- 球壳求交（用高度差避免大数相减掉精度） ---------- */
vec2 rayAlt(float Y, float dy){
  float b = (uR+uAlt)*dy;
  float c = (uAlt-Y)*(2.0*uR+uAlt+Y);
  float h = b*b - c;
  if(h < 0.0) return vec2(-1.0,-1.0);
  h = sqrt(h);
  return vec2(-b-h, -b+h);
}
/* 层壳 [Yb,Yt] 上最近的可见区间 */
vec2 shellRange(float Yb, float Yt, float dy){
  vec2 tt = rayAlt(Yt, dy);
  if(tt.y <= 0.0) return vec2(-1.0,-1.0);
  vec2 tb = rayAlt(Yb, dy);
  float t0 = max(tt.x, 0.0);
  float t1 = tt.y;
  if(tb.y > 0.0){
    if(tb.x > 0.0) t1 = min(t1, tb.x);
    else t0 = max(t0, tb.y);
  }
  if(t1 <= t0) return vec2(-1.0,-1.0);
  return vec2(t0, t1);
}
vec3 samplePt(vec3 rd, float t){
  float y = uAlt + rd.y*t - t*t/(2.0*uR);
  return vec3(uPos.x + rd.x*t, y, uPos.y + rd.z*t);
}
float airmass(float t, float dy){
  float H = uAtmH;
  float y0 = max(uAlt, 0.0);
  float y1 = max(uAlt + dy*t - t*t/(2.0*uR), 0.0);
  float d0 = exp(-y0/H), d1 = exp(-y1/H);
  if(abs(dy) < 0.06) return t*d0;
  return H*abs(d0-d1)/abs(dy);
}
float fogAmt(float t, float dy){
  return 1.0 - exp(-airmass(t,dy)*uFogK);
}

/* ---------- 星空 / 极光 ---------- */
vec3 starField(vec3 rd){
  vec3 s = rd*270.0;
  vec3 i = floor(s), f = fract(s)-0.5;
  float h = hash13(i);
  float br = smoothstep(0.9950, 1.0, h);
  if(br <= 0.0) return vec3(0.0);
  float tw = 0.7 + 0.3*sin(uTime*2.3 + h*300.0);
  vec3 tint = mix(vec3(0.72,0.83,1.0), vec3(1.0,0.87,0.72), hash13(i+vec3(7.3)));
  return tint*br*smoothstep(0.42,0.0,length(f))*7.0*tw;
}
vec3 milkyWay(vec3 rd){
  vec3 ax = normalize(vec3(0.42,0.30,-0.86));
  float d = 1.0 - abs(dot(rd, ax));
  float band = pow(clamp(d-0.72,0.0,1.0)/0.28, 2.0);
  float n = fbm3(rd*7.0, 4);
  return vec3(0.32,0.36,0.52)*band*n*0.16;
}
vec3 auroraTerm(vec3 rd){
  if(uAurora <= 0.0 || rd.y < -0.05) return vec3(0.0);
  vec2 pp = rd.xz/max(rd.y+0.30, 0.10);
  float n = fbm3(vec3(pp*0.5 + vec2(uTime*0.015, uTime*0.01), uTime*0.04), 3);
  float band = smoothstep(0.42,0.72,n)*smoothstep(-0.05,0.32,rd.y);
  vec3 c = mix(vec3(0.12,1.0,0.42), vec3(0.36,0.42,1.0), clamp(n*1.4,0.0,1.0));
  return c*band*0.42*uAurora;
}

/* ---------- 天空 ---------- */
vec3 skyDome(vec3 rd){
  float h = rd.y;
  if(h >= 0.0) return mix(uHor, uZen, pow(clamp(h,0.0,1.0), 0.62));
  return mix(uHor, uHaze, clamp(-h*2.4, 0.0, 1.0));
}
vec3 skyBG(vec3 rd){
  float dens = exp(-max(uAlt,0.0)/uAtmH);
  float graze = 1.0/max(abs(rd.y), 0.055);
  float air = clamp(dens*mix(1.0, graze, 0.85)*1.5, 0.0, 1.0);
  vec3 space = vec3(0.0006,0.0009,0.0020) + (starField(rd)+milkyWay(rd))*(1.0-air*0.9) + auroraTerm(rd)*(0.25+0.75*(1.0-air));
  vec3 sky = skyDome(rd);
  float mu = dot(rd, uSunDir);
  float disk = smoothstep(0.99960, 0.99982, mu);
  vec3 sunC = uSunCol*(disk*110.0 + pow(max(mu,0.0), 900.0)*16.0);
  vec3 glow = uSunCol*(pow(max(mu,0.0), 7.0)*0.20 + pow(max(mu,0.0),1.7)*0.035)*air;
  vec3 col = mix(space, sky, air) + sunC*(0.55+0.45*air) + glow;
  if(uSurf == 4){                       // 气态巨行星：下方是深渊
    float dn = smoothstep(0.02, -0.55, rd.y);
    col = mix(col, uHaze*0.18, dn*0.9);
  }
  return col;
}

/* ---------- 表面 ---------- */
vec3 surfaceColor(vec3 rd, float t){
  vec2 q = uPos + rd.xz*t;
  float fade = exp(-t*0.10);
  vec3 n = vec3(0.0,1.0,0.0);
  vec3 c;
  if(uSurf == 0){                       // 海 / 甲烷海
    float A = 0.020*uWaveAmp, B = 0.0022*uWaveAmp;
    float sw = fbm3(vec3(q*0.95, uTime*0.06), 3);
    float h0 = A*sw + B*fbm3(vec3(q*23.0, uTime*0.62), 3)*fade;
    float e = 0.006;
    float hx = A*fbm3(vec3((q+vec2(e,0.0))*0.95, uTime*0.06),3) + B*fbm3(vec3((q+vec2(e,0.0))*23.0, uTime*0.62),3)*fade;
    float hz = A*fbm3(vec3((q+vec2(0.0,e))*0.95, uTime*0.06),3) + B*fbm3(vec3((q+vec2(0.0,e))*23.0, uTime*0.62),3)*fade;
    n = normalize(vec3(-(hx-h0)/e, 1.0, -(hz-h0)/e));
    vec3 refl = skyBG(normalize(reflect(rd, n)));
    float fres = 0.02 + 0.98*pow(1.0-max(dot(-rd,n),0.0), 5.0);
    vec3 deep = uSurfCol*(uAmb*2.2 + uSunCol*max(dot(n,uSunDir),0.0)*0.14);
    c = mix(deep, refl, clamp(fres,0.0,1.0));
    vec3 hv = normalize(uSunDir - rd);
    c += uSunCol*pow(max(dot(n,hv),0.0), 420.0)*2.2;
    float foam = smoothstep(0.60,0.86, fbm3(vec3(q*10.0, uTime*0.34),3))*smoothstep(0.34,0.78,sw)*fade;
    c = mix(c, (0.35+uAmb*2.4+uSunCol*0.05)*0.9, foam*0.5);
  } else if(uSurf == 2){                // 冰原
    float r0 = fbm3(vec3(q*5.5, 2.7), 4);
    float e = 0.01;
    float rx = fbm3(vec3((q+vec2(e,0.0))*5.5, 2.7), 4);
    float rz = fbm3(vec3((q+vec2(0.0,e))*5.5, 2.7), 4);
    n = normalize(vec3(-(rx-r0)*0.9/e*0.02, 1.0, -(rz-r0)*0.9/e*0.02));
    float cre = smoothstep(0.08, 0.0, abs(fbm3(vec3(q*1.9, 8.1),3)-0.5));
    vec3 alb = mix(uSurfCol*(0.86+0.28*r0), vec3(0.03,0.10,0.20), cre*0.85);
    float sparkle = pow(max(dot(reflect(rd,n), uSunDir),0.0), 90.0)*fade;
    c = alb*(uAmb*1.5 + uSunCol*max(dot(n,uSunDir),0.0)*0.62) + uSunCol*sparkle*0.5;
  } else if(uSurf == 3){                // 沙丘
    float dn = sin(q.x*3.1 + fbm3(vec3(q*0.6,1.3),3)*7.0)*0.5+0.5;
    float rip = sin(q.x*70.0 + q.y*12.0 + dn*9.0)*0.5+0.5;
    n = normalize(vec3(cos(q.x*3.1)*0.30, 1.0, 0.05));
    vec3 alb = uSurfCol*(0.72+0.42*dn)*(1.0+0.12*rip*fade);
    c = alb*(uAmb*1.6 + uSunCol*max(dot(n,uSunDir),0.0)*0.55);
  } else if(uSurf == 5){                // 熔岩地壳
    float c1 = fbm3(vec3(q*2.4, uTime*0.015), 4);
    float rid = 1.0 - abs(c1*2.0-1.0);
    float crack = smoothstep(0.80, 0.995, rid);
    float lake = smoothstep(0.56, 0.74, fbm3(vec3(q*0.5, 3.3),3));
    float lava = clamp(max(crack, lake*0.9), 0.0, 1.0);
    vec3 alb = mix(vec3(0.022,0.018,0.017), uSurfCol, 0.30+0.70*c1);
    vec3 emis = mix(vec3(2.4,0.42,0.05), vec3(9.5,3.6,0.7), smoothstep(0.55,1.0,lava))*lava
              * (0.78+0.22*sin(uTime*2.1 + c1*30.0));
    c = alb*(uAmb*1.7 + uSunCol*0.30) + emis;
  } else {                              // 岩石
    vec3 alb = uSurfCol*(0.68+0.55*fbm3(vec3(q*2.8,5.5),4));
    c = alb*(uAmb*1.5 + uSunCol*0.55);
  }
  float fog = fogAmt(t, rd.y);
  vec3 fogCol = uHaze*(0.85 + 0.9*pow(max(dot(rd,uSunDir),0.0), 5.0));
  return mix(c, fogCol, fog);
}

/* ---------- 云 ---------- */
float layerDens(vec3 p, float base, float th, float cov, float wo, float detail){
  float h = (p.y - base)/th;
  if(h < 0.0 || h > 1.0) return 0.0;
  float shape = smoothstep(0.0,0.24,h)*smoothstep(1.0,0.52,h);
  float sc = 1.0/max(th, 0.30);
  vec3 qq = vec3(p.x + uWind*wo, p.y, p.z + uWind*wo*0.35)*vec3(sc*0.80, sc*0.95, sc*0.80);
  float n = fbm3(qq, 4);
  float d = n - (1.0-cov);
  if(d <= 0.0) return 0.0;
  d *= shape;
  if(detail > 0.5){
    float e2 = fbm3(qq*4.3 + vec3(21.3,7.7,3.9), 2);
    d = max(d - e2*0.26, 0.0);
  }
  return d*2.2;
}
void marchLayer(int i, vec3 rd, float tMax, inout float trans, inout vec3 acc){
  float base, th, cov, dens; vec3 tint;
  if(i == 0){ base=uLayB.x; th=uLayT.x; cov=uLayC.x; dens=uLayD.x; tint=uLayCol[0]; }
  else if(i == 1){ base=uLayB.y; th=uLayT.y; cov=uLayC.y; dens=uLayD.y; tint=uLayCol[1]; }
  else { base=uLayB.z; th=uLayT.z; cov=uLayC.z; dens=uLayD.z; tint=uLayCol[2]; }
  if(th <= 0.0 || dens <= 0.0 || trans < 0.02) return;
  float wo = 1.0 + float(i)*0.55;
  vec2 rg = shellRange(base, base+th, rd.y);
  if(rg.x < 0.0) return;
  float t0 = rg.x;
  float t1 = min(rg.y, tMax);
  if(t1 <= t0) return;
  float span = min(t1-t0, th*16.0 + 40.0);
  int steps = int(mix(14.0, 30.0, uQual));
  float dt = span/float(steps);
  float jit = hash13(vec3(gl_FragCoord.xy, floor(uTime*60.0)));
  float t = t0 + dt*jit;
  float phase = 0.30 + 3.2*hg(dot(rd,uSunDir), 0.72);
  for(int s=0;s<30;s++){
    if(s >= steps || trans < 0.02) break;
    vec3 p = samplePt(rd, t);
    float d = layerDens(p, base, th, cov, wo, uQual > 0.35 ? 1.0 : 0.0);
    if(d > 0.004){
      float d1 = layerDens(p + uSunDir*(th*0.07), base, th, cov, wo, 0.0);
      float d2 = layerDens(p + uSunDir*(th*0.24), base, th, cov, wo, 0.0);
      float tau = (d1*th*0.11 + d2*th*0.30)*dens*EXT;
      float sun = exp(-tau) + 0.34*exp(-tau*0.16);
      float hh = clamp((p.y-base)/th, 0.0, 1.0);
      float powder = 1.0 - exp(-d*7.0);
      vec3 lum = uSunCol*sun*phase*mix(1.0,powder,0.35)
               + uAmb*(0.55 + 0.75*hh)
               + uFlash*vec3(0.72,0.80,1.0)*3.0
               + uGlow*vec3(1.6,0.42,0.10)*exp(-max(p.y,0.0)*0.20);
      vec3 cc = tint*lum;
      float fg = fogAmt(t, rd.y);
      cc = mix(cc, uHaze*1.05, fg);
      float tr = exp(-d*dens*dt*EXT);
      acc += cc*(1.0-tr)*trans;
      trans *= tr;
    }
    t += dt;
  }
}
vec3 clouds(vec3 rd, vec3 bg, float tMax){
  vec2 r0 = shellRange(uLayB.x, uLayB.x+max(uLayT.x,0.0001), rd.y);
  vec2 r1 = shellRange(uLayB.y, uLayB.y+max(uLayT.y,0.0001), rd.y);
  vec2 r2 = shellRange(uLayB.z, uLayB.z+max(uLayT.z,0.0001), rd.y);
  float k0 = (r0.x < 0.0 || uLayT.x <= 0.0) ? 1e9 : r0.x;
  float k1 = (r1.x < 0.0 || uLayT.y <= 0.0) ? 1e9 : r1.x;
  float k2 = (r2.x < 0.0 || uLayT.z <= 0.0) ? 1e9 : r2.x;
  int i0, i1, i2;
  if(k0 <= k1 && k0 <= k2){ i0 = 0; if(k1 <= k2){ i1=1; i2=2; } else { i1=2; i2=1; } }
  else if(k1 <= k0 && k1 <= k2){ i0 = 1; if(k0 <= k2){ i1=0; i2=2; } else { i1=2; i2=0; } }
  else { i0 = 2; if(k0 <= k1){ i1=0; i2=1; } else { i1=1; i2=0; } }
  float trans = 1.0;
  vec3 acc = vec3(0.0);
  marchLayer(i0, rd, tMax, trans, acc);
  marchLayer(i1, rd, tMax, trans, acc);
  marchLayer(i2, rd, tMax, trans, acc);
  return bg*trans + acc;
}

/* ---------- 水下 ---------- */
vec3 underwater(vec3 rd){
  float dep = uUnder;
  vec3 deepC = vec3(0.0016,0.010,0.020);
  vec3 shal = uSurfCol*1.8 + vec3(0.01,0.07,0.10);
  float f = exp(-dep*7.0);
  vec3 water = mix(deepC, shal, f);
  float up = max(rd.y, 0.0);
  vec3 col = water*(0.30 + 2.2*pow(up,2.2)*f + 0.25*f);
  vec3 sdir = normalize(uSunDir + vec3(0.0,0.85,0.0));
  float sh = pow(max(dot(rd,sdir),0.0), 8.0);
  float caust = fbm3(vec3(rd.xz*9.0/max(rd.y,0.18) + vec2(uTime*0.10,0.0), uTime*0.22), 3);
  col += uSunCol*sh*f*(0.15+0.85*caust)*0.10;
  float sw = smoothstep(0.80, 0.965, rd.y);
  col += uSunCol*sw*f*0.035;
  float parts = smoothstep(0.86,1.0, fbm3(rd*60.0 + vec3(0.0,uTime*0.6,0.0), 2));
  col += vec3(0.6,0.72,0.78)*parts*0.05*(0.2+f);
  return col;
}

void main(){
  vec2 pp = (2.0*gl_FragCoord.xy - uRes)/uRes.y;
  if(uHeat > 0.02){                     // 热浪扰动
    pp += uHeat*0.0055*vec2(sin(uTime*9.3 + pp.y*38.0), cos(uTime*7.9 + pp.x*33.0));
  }
  vec3 rd = normalize(uFwd + uTanF*(pp.x*uRight + pp.y*uUp));
  vec3 col;
  if(uUnder >= 0.0){
    col = underwater(rd);
  } else {
    float tS = -1.0;
    if(uSurf != 4){
      vec2 ts = rayAlt(0.0, rd.y);
      if(ts.x > 0.0) tS = ts.x; else if(ts.y > 0.0) tS = ts.y;
    }
    col = (tS > 0.0) ? surfaceColor(rd, tS) : skyBG(rd);
    col = clouds(rd, col, tS > 0.0 ? tS : 6000.0);
    if(uHeat > 0.01){                   // 等离子鞘
      float below = pow(clamp(-rd.y, 0.0, 1.0), 1.7);
      float fl = 0.72 + 0.28*sin(uTime*21.0 + rd.x*26.0)*sin(uTime*16.0 + rd.z*19.0);
      vec3 pc = mix(vec3(2.8,0.62,0.10), vec3(6.2,4.4,3.2), clamp(uHeat*1.3-0.3, 0.0, 1.0));
      col += pc*uHeat*uHeat*(0.05 + 0.95*below)*fl*0.20;
    }
  }
  col *= uExp;
  col = aces(col);
  col = mix(col, vec3(1.0), clamp(uWhite,0.0,1.0));
  col = pow(max(col, 0.0), vec3(1.0/2.2));
  col += (hash13(vec3(gl_FragCoord.xy, floor(uTime*60.0)))-0.5)*0.012;
  fragColor = vec4(col, 1.0);
}
`;

  function compile(gl, type, src, log) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      log.push((type === gl.VERTEX_SHADER ? 'VS' : 'FS') + ': ' + gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  function GLView(canvas) {
    this.canvas = canvas;
    this.error = null;
    this.log = [];
    this.scale = 1.0;
    this.w = 1; this.h = 1;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
    if (!gl) { this.error = '此浏览器不支持 WebGL2'; return; }
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VS, this.log);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS, this.log);
    if (!vs || !fs) { this.error = '着色器编译失败：' + this.log.join(' | '); return; }
    const pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { this.error = '链接失败：' + gl.getProgramInfoLog(pr); return; }
    this.prog = pr;
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.U = {};
    const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(pr, i);
      this.U[info.name] = gl.getUniformLocation(pr, info.name);
    }
    this.debugInfo = (function () {
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'renderer 未知';
    })();
  }

  GLView.prototype.resize = function () {
    const gl = this.gl; if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(this.canvas.clientWidth * dpr * this.scale));
    const h = Math.max(2, Math.round(this.canvas.clientHeight * dpr * this.scale));
    if (w !== this.w || h !== this.h) {
      this.w = w; this.h = h;
      this.canvas.width = w; this.canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  GLView.prototype.render = function (s) {
    const gl = this.gl; if (!gl || this.error) return;
    this.resize();
    const U = this.U, uf = (k, v) => { if (U[k] !== undefined && U[k] !== null) gl.uniform1f(U[k], v); };
    const u2 = (k, a, b) => { if (U[k]) gl.uniform2f(U[k], a, b); };
    const u3 = (k, v) => { if (U[k]) gl.uniform3f(U[k], v[0], v[1], v[2]); };
    const ui = (k, v) => { if (U[k] !== undefined && U[k] !== null) gl.uniform1i(U[k], v); };
    u2('uRes', this.w, this.h);
    uf('uTime', s.time);
    u3('uRight', s.right); u3('uUp', s.up); u3('uFwd', s.fwd);
    uf('uTanF', s.tanF);
    uf('uAlt', s.altKm);
    u2('uPos', s.posKm[0], s.posKm[1]);
    u3('uSunDir', s.sunDir); u3('uSunCol', s.sunCol);
    u3('uZen', s.zen); u3('uHor', s.hor); u3('uHaze', s.haze); u3('uAmb', s.amb);
    uf('uAtmH', s.atmH); uf('uR', s.R); uf('uFogK', s.fogK);
    ui('uSurf', s.surf); u3('uSurfCol', s.surfCol);
    u3('uLayB', s.layB); u3('uLayT', s.layT); u3('uLayC', s.layC); u3('uLayD', s.layD);
    if (U['uLayCol']) gl.uniformMatrix3fv(U['uLayCol'], false, s.layCol);
    uf('uWind', s.wind); uf('uQual', s.qual); uf('uHeat', s.heat); uf('uFlash', s.flash);
    uf('uGlow', s.glow); uf('uUnder', s.under); uf('uExp', s.exposure);
    uf('uAurora', s.aurora); uf('uWhite', s.white); uf('uWaveAmp', s.waveAmp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  glob.GLView = GLView;
})(window);
