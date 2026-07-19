/* ============================================================
   POOLROOMS · post.js
   HDR 后处理管线:
   场景(HDR+Depth) → 水面合成 → SSR(湿地面反射) → Bloom
   → ACES 色调映射/暗角/色差/颗粒 → FXAA → 屏幕
   ============================================================ */
(function () {
  'use strict';

  const FS_VERT = `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;

  const COPY_FRAG = `
    precision highp float;
    uniform sampler2D tInput;
    varying vec2 vUv;
    void main(){ gl_FragColor = texture2D(tInput, vUv); }
  `;

  /* ---------------- SSR:仅对近水平表面(湿地面) ---------------- */
  const SSR_FRAG = `
    precision highp float;
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform mat4 uProj;
    uniform mat4 uInvProj;
    uniform vec3 uUpView;
    uniform vec2 uRes;
    varying vec2 vUv;

    vec3 viewPos(vec2 uv){
      float d = texture2D(tDepth, uv).x;
      vec4 ndc = vec4(uv*2.0-1.0, d*2.0-1.0, 1.0);
      vec4 v = uInvProj * ndc;
      return v.xyz / v.w;
    }

    void main(){
      vec4 base = texture2D(tColor, vUv);
      float d0 = texture2D(tDepth, vUv).x;
      if (d0 >= 0.9999) { gl_FragColor = base; return; }
      // 水面像素(alpha<1)跳过
      float sceneMask = smoothstep(0.55, 0.95, base.a);
      if (sceneMask <= 0.01) { gl_FragColor = base; return; }

      vec3 P = viewPos(vUv);
      vec3 dx = dFdx(P), dy = dFdy(P);
      vec3 N = normalize(cross(dx, dy));
      if (!(dot(N, N) < 3.5)) { gl_FragColor = base; return; }   // NaN/Inf 防护
      if (dot(N, -normalize(P)) < 0.0) N = -N;
      float upDot = dot(N, uUpView);
      /* 地面强反射;墙面(垂直)中等湿感反射;朝下面(天花)剔除 */
      float floorW = smoothstep(0.86, 0.96, upDot);
      float vertW = (1.0 - smoothstep(0.3, 0.55, abs(upDot))) * 0.55;
      float ceilKill = smoothstep(-0.6, -0.28, upDot);
      float mask = max(floorW, vertW) * ceilKill * sceneMask;
      if (!(mask > 0.01)) { gl_FragColor = base; return; }

      vec3 V = normalize(P);
      vec3 R = normalize(reflect(V, N));
      float maxDist = 14.0;
      float t = 0.12;
      vec2 hitUV = vec2(-1.0);
      float prevT = 0.0;
      for (int i = 0; i < 26; i++) {
        vec3 sp = P + R * t;
        vec4 clip = uProj * vec4(sp, 1.0);
        vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
        if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) break;
        vec3 vs = viewPos(suv);
        float diff = vs.z - sp.z;      // 正:场景表面在光线前方(更近)
        if (diff > 0.015 && diff < 1.2) {
          // 二分细化
          float lo = prevT, hi = t;
          for (int j = 0; j < 4; j++) {
            float mid = (lo + hi) * 0.5;
            vec3 mp = P + R * mid;
            vec4 mc = uProj * vec4(mp, 1.0);
            vec2 muv = mc.xy / mc.w * 0.5 + 0.5;
            float md = viewPos(muv).z - mp.z;
            if (md > 0.015) hi = mid; else lo = mid;
          }
          vec3 fp = P + R * hi;
          vec4 fc = uProj * vec4(fp, 1.0);
          hitUV = fc.xy / fc.w * 0.5 + 0.5;
          t = hi;
          break;
        }
        prevT = t;
        t *= 1.32;
        if (t > maxDist) break;
      }
      if (hitUV.x < 0.0) { gl_FragColor = base; return; }

      vec2 px = 1.6 / uRes;
      vec3 refl = texture2D(tColor, hitUV).rgb * 0.4
                + texture2D(tColor, hitUV + vec2(px.x, 0.0)).rgb * 0.15
                + texture2D(tColor, hitUV - vec2(px.x, 0.0)).rgb * 0.15
                + texture2D(tColor, hitUV + vec2(0.0, px.y)).rgb * 0.15
                + texture2D(tColor, hitUV - vec2(0.0, px.y)).rgb * 0.15;

      vec2 eDist = min(hitUV, 1.0 - hitUV);
      float edgeFade = smoothstep(0.0, 0.12, min(eDist.x, eDist.y));
      float distFade = 1.0 - clamp(t / maxDist, 0.0, 1.0);
      float ct = clamp(dot(-V, N), 0.0, 1.0);
      float fres = 0.28 + 0.6 * pow(1.0 - ct, 3.0);
      float k = mask * edgeFade * distFade * fres * 0.55;
      refl = min(refl, vec3(8.0));
      if (!(k > 0.0 && k < 1.0)) { gl_FragColor = base; return; }
      gl_FragColor = vec4(base.rgb * (1.0 - k * 0.35) + refl * k, base.a);
    }
  `;

  /* ---------------- SSAO(半分辨率,深度重建法线) ---------------- */
  const SSAO_FRAG = `
    precision highp float;
    uniform sampler2D tDepth;
    uniform mat4 uInvProj;
    uniform vec2 uRes;
    varying vec2 vUv;
    vec3 viewPos(vec2 uv){
      float d = texture2D(tDepth, uv).x;
      vec4 n = vec4(uv*2.0-1.0, d*2.0-1.0, 1.0);
      vec4 v = uInvProj * n;
      return v.xyz / v.w;
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      float d0 = texture2D(tDepth, vUv).x;
      if (d0 >= 0.9999) { gl_FragColor = vec4(1.0); return; }
      vec3 P = viewPos(vUv);
      vec3 N = normalize(cross(dFdx(P), dFdy(P)));
      if (!(dot(N, N) < 3.5)) { gl_FragColor = vec4(1.0); return; }
      if (dot(N, -normalize(P)) < 0.0) N = -N;
      float ang = hash(vUv * uRes) * 6.2831;
      float occ = 0.0;
      const int S = 12;
      float radius = 0.6;
      for (int i = 0; i < S; i++) {
        float fi = float(i);
        float a = ang + fi * 2.3999632;
        float rr = (fi + 1.0) / float(S);
        rr = rr * rr * radius;
        vec2 off = vec2(cos(a), sin(a)) * rr * 1.25 / max(-P.z, 0.6);
        off.x *= uRes.y / uRes.x;
        vec2 suv = vUv + off;
        if (suv.x <= 0.001 || suv.x >= 0.999 || suv.y <= 0.001 || suv.y >= 0.999) continue;
        vec3 Ps = viewPos(suv);
        vec3 dv = Ps - P;
        float dist = length(dv);
        float nd = dot(N, dv / max(dist, 1e-4));
        float rangeF = smoothstep(radius * 2.2, radius * 0.4, dist);
        occ += clamp(nd - 0.08, 0.0, 1.0) * rangeF;
      }
      float ao = 1.0 - (occ / float(S)) * 1.75;
      ao = clamp(ao, 0.0, 1.0);
      ao = pow(ao, 1.5);
      gl_FragColor = vec4(vec3(ao), 1.0);
    }
  `;

  /* ---------------- Bloom ---------------- */
  const BRIGHT_FRAG = `
    precision highp float;
    uniform sampler2D tInput;
    uniform vec2 uTh;
    varying vec2 vUv;
    void main(){
      vec3 c = min(texture2D(tInput, vUv).rgb, vec3(6.0));
      if (c.r != c.r || c.g != c.g || c.b != c.b) c = vec3(0.0);   // NaN 清洗
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float w = smoothstep(uTh.x, uTh.y, l);
      gl_FragColor = vec4(c * w, 1.0);
    }
  `;
  const BLUR_FRAG = `
    precision highp float;
    uniform sampler2D tInput;
    uniform vec2 uDir;
    varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tInput, vUv).rgb * 0.227;
      c += texture2D(tInput, vUv + uDir * 1.384).rgb * 0.316;
      c += texture2D(tInput, vUv - uDir * 1.384).rgb * 0.316;
      c += texture2D(tInput, vUv + uDir * 3.230).rgb * 0.0702;
      c += texture2D(tInput, vUv - uDir * 3.230).rgb * 0.0702;
      gl_FragColor = vec4(c, 1.0);
    }
  `;

  /* ---------------- 色调映射 / 分级 ---------------- */
  const GRADE_FRAG = `
    precision highp float;
    uniform sampler2D tInput;
    uniform sampler2D tBloom1;
    uniform sampler2D tBloom2;
    uniform sampler2D tAO;
    uniform float uTime;
    uniform float uExposure;
    uniform float uAOStr;
    uniform vec2 uRes;
    varying vec2 vUv;

    vec3 aces(vec3 x){
      const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
      return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
    }
    float hash12(vec2 p){
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main(){
      vec2 uv = vUv;
      vec2 cc = uv - 0.5;
      float r2 = dot(cc, cc);
      float ca = 0.0016 * r2 * 4.0;
      vec3 col;
      col.r = texture2D(tInput, uv + cc * ca).r;
      col.g = texture2D(tInput, uv).g;
      col.b = texture2D(tInput, uv - cc * ca).b;

      col += texture2D(tBloom1, uv).rgb * 0.35 + texture2D(tBloom2, uv).rgb * 0.3;
      if (col.r != col.r || col.g != col.g || col.b != col.b) col = vec3(0.03, 0.07, 0.08);

      float ao = texture2D(tAO, uv).r;
      col *= mix(1.0, ao, uAOStr);

      col *= uExposure;
      col = aces(col);
      col = pow(col, vec3(1.0 / 2.2));

      col = mix(col, col * vec3(0.985, 1.005, 1.03), 0.5);
      col = (col - 0.5) * 1.03 + 0.5;

      float vig = 1.0 - smoothstep(0.35, 1.15, sqrt(r2) * 1.35);
      col *= 0.72 + 0.28 * vig;

      float g = (hash12(uv * uRes + fract(uTime) * 731.0) - 0.5) * 0.028;
      col += g;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* ---------------- FXAA(简化 3.11) ---------------- */
  const FXAA_FRAG = `
    precision highp float;
    uniform sampler2D tInput;
    uniform vec2 uRes;
    varying vec2 vUv;
    void main(){
      vec2 px = 1.0 / uRes;
      vec3 cM = texture2D(tInput, vUv).rgb;
      vec3 cNW = texture2D(tInput, vUv + px * vec2(-1.0, -1.0)).rgb;
      vec3 cNE = texture2D(tInput, vUv + px * vec2( 1.0, -1.0)).rgb;
      vec3 cSW = texture2D(tInput, vUv + px * vec2(-1.0,  1.0)).rgb;
      vec3 cSE = texture2D(tInput, vUv + px * vec2( 1.0,  1.0)).rgb;
      vec3 lw = vec3(0.299, 0.587, 0.114);
      float lM = dot(cM, lw), lNW = dot(cNW, lw), lNE = dot(cNE, lw), lSW = dot(cSW, lw), lSE = dot(cSE, lw);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
      float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
      dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * px;
      vec3 rgbA = 0.5 * (texture2D(tInput, vUv + dir * (1.0/3.0 - 0.5)).rgb + texture2D(tInput, vUv + dir * (2.0/3.0 - 0.5)).rgb);
      vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tInput, vUv + dir * -0.5).rgb + texture2D(tInput, vUv + dir * 0.5).rgb);
      float lB = dot(rgbB, lw);
      gl_FragColor = vec4((lB < lMin || lB > lMax) ? rgbA : rgbB, 1.0);
    }
  `;

  PR.initPost = function (renderer, scene, waterScene, camera) {
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    function pass(frag, uniforms) {
      const m = new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthWrite: false, depthTest: false });
      const mesh = new THREE.Mesh(quadGeo, m);
      const sc = new THREE.Scene();
      sc.add(mesh);
      return { scene: sc, mat: m, u: uniforms };
    }
    function makeRT(w, h, opts) {
      return new THREE.WebGLRenderTarget(w, h, Object.assign({
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, type: PR.hdrType || THREE.UnsignedByteType, depthBuffer: false
      }, opts || {}));
    }

    const P = {
      rtA: null, rtB: null, rtC: null, rtD: null,
      bloomA1: null, bloomA2: null, bloomB1: null, bloomB2: null,
      w: 0, h: 0,

      copy: pass(COPY_FRAG, { tInput: { value: null } }),
      ssr: pass(SSR_FRAG, {
        tColor: { value: null }, tDepth: { value: null },
        uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() },
        uUpView: { value: new THREE.Vector3() }, uRes: { value: new THREE.Vector2() }
      }),
      ssao: pass(SSAO_FRAG, {
        tDepth: { value: null },
        uInvProj: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2() }
      }),
      bright: pass(BRIGHT_FRAG, {
        tInput: { value: null },
        uTh: { value: PR.hdrOK ? new THREE.Vector2(1.25, 2.4) : new THREE.Vector2(0.82, 1.0) }
      }),
      blur: pass(BLUR_FRAG, { tInput: { value: null }, uDir: { value: new THREE.Vector2() } }),
      grade: pass(GRADE_FRAG, {
        tInput: { value: null }, tBloom1: { value: null }, tBloom2: { value: null }, tAO: { value: null },
        uTime: { value: 0 }, uExposure: { value: 1.05 }, uAOStr: { value: 0.72 }, uRes: { value: new THREE.Vector2() }
      }),
      fxaa: pass(FXAA_FRAG, { tInput: { value: null }, uRes: { value: new THREE.Vector2() } }),

      resize(w, h) {
        this.w = w; this.h = h;
        ['rtA', 'rtB', 'rtC'].forEach(k => { if (this[k]) this[k].dispose(); });
        this.rtA = new THREE.WebGLRenderTarget(w, h, {
          minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat, type: PR.hdrType || THREE.UnsignedByteType, depthBuffer: true
        });
        if (!PR.noDT) {
          const depthTex = new THREE.DepthTexture(w, h);
          depthTex.type = THREE.UnsignedIntType;
          this.rtA.depthTexture = depthTex;
        }
        this.rtB = makeRT(w, h); this.rtC = makeRT(w, h);
        if (this.rtD) this.rtD.dispose();
        this.rtD = makeRT(w, h, { type: THREE.UnsignedByteType });
        const bw = Math.max(64, w >> 1), bh = Math.max(64, h >> 1);
        const bw2 = Math.max(32, w >> 2), bh2 = Math.max(32, h >> 2);
        ['bloomA1', 'bloomA2', 'bloomB1', 'bloomB2'].forEach(k => { if (this[k]) this[k].dispose(); });
        this.bloomA1 = makeRT(bw, bh); this.bloomA2 = makeRT(bw, bh);
        this.bloomB1 = makeRT(bw2, bh2); this.bloomB2 = makeRT(bw2, bh2);
        ['ssaoA', 'ssaoB'].forEach(k => { if (this[k]) this[k].dispose(); });
        this.ssaoA = makeRT(bw, bh, { type: THREE.UnsignedByteType });
        this.ssaoB = makeRT(bw, bh, { type: THREE.UnsignedByteType });
        this.ssao.u.uRes.value.set(w, h);
        this.ssr.u.uRes.value.set(w, h);
        this.grade.u.uRes.value.set(w, h);
        this.fxaa.u.uRes.value.set(w, h);
      },

      _run(p, rt) {
        renderer.setRenderTarget(rt);
        renderer.render(p.scene, quadCam);
      },

      debugStage: null,
      _debugOut(tex) {
        this.copy.u.tInput.value = tex;
        this._run(this.copy, null);
      },

      render(time) {
        const r = renderer;
        // 1. 场景 → A (含深度)
        r.setRenderTarget(this.rtA);
        r.setClearColor(0x16262a, 1);
        r.clear(true, true, false);
        r.render(scene, camera);
        if (this.debugStage === 'A') { this._debugOut(this.rtA.texture); return; }

        // 2. A 拷贝 → B,再叠加水面(读 A 的颜色与深度)
        this.copy.u.tInput.value = this.rtA.texture;
        this._run(this.copy, this.rtB);
        PR.water.bindSceneBuffers(this.rtA.texture, this.rtA.depthTexture);
        r.setRenderTarget(this.rtB);
        r.render(waterScene, camera);
        if (this.debugStage === 'B') { this._debugOut(this.rtB.texture); return; }

        // 3. SSR → C
        this.ssr.u.tColor.value = this.rtB.texture;
        this.ssr.u.tDepth.value = this.rtA.depthTexture;
        this.ssr.u.uProj.value.copy(camera.projectionMatrix);
        this.ssr.u.uInvProj.value.copy(camera.projectionMatrixInverse);
        this.ssr.u.uUpView.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
        this._run(this.ssr, this.rtC);
        if (this.debugStage === 'C') { this._debugOut(this.rtC.texture); return; }

        // 4. Bloom
        this.bright.u.tInput.value = this.rtC.texture;
        this._run(this.bright, this.bloomA1);
        this.blur.u.tInput.value = this.bloomA1.texture;
        this.blur.u.uDir.value.set(1 / this.bloomA1.width, 0);
        this._run(this.blur, this.bloomA2);
        this.blur.u.tInput.value = this.bloomA2.texture;
        this.blur.u.uDir.value.set(0, 1 / this.bloomA1.height);
        this._run(this.blur, this.bloomA1);
        this.copy.u.tInput.value = this.bloomA1.texture;
        this._run(this.copy, this.bloomB1);
        this.blur.u.tInput.value = this.bloomB1.texture;
        this.blur.u.uDir.value.set(1 / this.bloomB1.width, 0);
        this._run(this.blur, this.bloomB2);
        this.blur.u.tInput.value = this.bloomB2.texture;
        this.blur.u.uDir.value.set(0, 1 / this.bloomB1.height);
        this._run(this.blur, this.bloomB1);

        // 4.5 SSAO(半分辨率 + 模糊)
        this.ssao.u.tDepth.value = this.rtA.depthTexture;
        this.ssao.u.uInvProj.value.copy(camera.projectionMatrixInverse);
        this._run(this.ssao, this.ssaoA);
        this.blur.u.tInput.value = this.ssaoA.texture;
        this.blur.u.uDir.value.set(1 / this.ssaoA.width, 0);
        this._run(this.blur, this.ssaoB);
        this.blur.u.tInput.value = this.ssaoB.texture;
        this.blur.u.uDir.value.set(0, 1 / this.ssaoA.height);
        this._run(this.blur, this.ssaoA);

        // 5. 分级 → D
        this.grade.u.tInput.value = this.rtC.texture;
        this.grade.u.tBloom1.value = this.bloomA1.texture;
        this.grade.u.tBloom2.value = this.bloomB1.texture;
        this.grade.u.tAO.value = this.ssaoA.texture;
        this.grade.u.uTime.value = time;
        if (this.debugStage === 'G') { this._run(this.grade, null); return; }
        this._run(this.grade, this.rtD);
        if (this.debugStage === 'D') { this._debugOut(this.rtD.texture); return; }

        // 6. FXAA → 屏幕
        this.fxaa.u.tInput.value = this.rtD.texture;
        this._run(this.fxaa, null);
      }
    };
    return P;
  };
})();
