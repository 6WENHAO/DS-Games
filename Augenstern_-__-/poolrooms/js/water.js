/* ============================================================
   POOLROOMS · water.js
   物理感水面:平面反射RTT + 屏幕折射 + 深度吸收 + 岸边软边
   菲涅尔 / 太阳高光 / 双层滚动法线 / 顶点波
   ============================================================ */
(function () {
  'use strict';

  const WATER_VERT = `
    uniform float uTime;
    uniform mat4 uMirrorMatrix;
    attribute vec2 aUv;
    attribute float aDepth;
    varying vec3 vWorld;
    varying vec4 vMirror;
    varying vec3 vWaveN;
    varying float vDepth;
    varying vec2 vUvW;

    void waves(vec2 p, out float h, out vec2 grad){
      h = 0.0; grad = vec2(0.0);
      vec2 d1 = normalize(vec2(0.8, 0.6));
      vec2 d2 = normalize(vec2(-0.5, 0.9));
      vec2 d3 = normalize(vec2(0.95, -0.3));
      vec2 d4 = normalize(vec2(-0.7, -0.72));
      float a1=0.014, k1=6.2831/3.4, w1=1.15;
      float a2=0.011, k2=6.2831/1.9, w2=1.7;
      float a3=0.007, k3=6.2831/1.1, w3=2.6;
      float a4=0.016, k4=6.2831/5.7, w4=0.8;
      float p1 = dot(d1,p)*k1 + uTime*w1;
      float p2 = dot(d2,p)*k2 + uTime*w2;
      float p3 = dot(d3,p)*k3 + uTime*w3;
      float p4 = dot(d4,p)*k4 + uTime*w4;
      h = a1*sin(p1)+a2*sin(p2)+a3*sin(p3)+a4*sin(p4);
      grad = d1*(a1*k1*cos(p1)) + d2*(a2*k2*cos(p2)) + d3*(a3*k3*cos(p3)) + d4*(a4*k4*cos(p4));
    }

    void main(){
      vec3 pos = position;
      float h; vec2 g;
      waves(aUv, h, g);
      float deepAmp = 0.7 + 0.5*clamp(aDepth, 0.0, 1.5);
      pos.y += h * deepAmp;
      vWaveN = normalize(vec3(-g.x*deepAmp, 1.0, -g.y*deepAmp));
      vWorld = pos;
      vDepth = aDepth;
      vUvW = aUv;
      vec4 wp = vec4(pos, 1.0);
      vMirror = uMirrorMatrix * wp;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const WATER_FRAG = `
    precision highp float;
    uniform sampler2D tRefl;
    uniform sampler2D tScene;
    uniform sampler2D tDepth;
    uniform sampler2D tN1;
    uniform sampler2D tN2;
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uNear, uFar;
    uniform vec3 uCam;
    uniform vec3 uSunDir;
    uniform vec3 uSunCol;
    uniform vec3 uFogCol;
    uniform float uFogDen;
    varying vec3 vWorld;
    varying vec4 vMirror;
    varying vec3 vWaveN;
    varying float vDepth;
    varying vec2 vUvW;

    float linZ(float d){
      float z = d * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
    }

    void main(){
      vec2 suv = gl_FragCoord.xy / uRes;
      float fragDist = linZ(gl_FragCoord.z);
      float sceneD = linZ(texture2D(tDepth, suv).x);
      if (sceneD < fragDist - 0.05) discard;      // 被墙体遮挡

      /* --- 法线:顶点波 + 双层滚动细节 --- */
      vec3 n1 = texture2D(tN1, vUvW * 0.38 + vec2(uTime*0.021,  uTime*0.013)).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D(tN2, vUvW * 0.83 + vec2(-uTime*0.016, uTime*0.027)).xyz * 2.0 - 1.0;
      vec3 nD = normalize(vec3(n1.x + n2.x*0.65, 4.2, n1.y + n2.y*0.65));
      vec3 N = normalize(vWaveN + nD - vec3(0.0,1.0,0.0));
      float viewD = length(uCam - vWorld);
      N = normalize(mix(N, vec3(0.0,1.0,0.0), clamp(viewD/45.0, 0.0, 0.85)));

      vec3 V = normalize(uCam - vWorld);

      /* --- 水厚度(屏幕深度差) --- */
      float thick = max(sceneD - fragDist, 0.0);

      /* --- 折射 --- */
      float distAmp = clamp(thick*0.8, 0.15, 1.0) * (0.028 + 0.05/max(viewD,2.0));
      vec2 ruv = suv + N.xz * distAmp * vec2(uRes.y/uRes.x, 1.0) * 22.0 / max(viewD, 1.5);
      float rD = linZ(texture2D(tDepth, ruv).x);
      if (rD < fragDist) { ruv = suv; rD = sceneD; }
      vec3 refr = texture2D(tScene, ruv).rgb;
      float rThick = max(rD - fragDist, 0.0);

      /* --- 吸收 & 散射 --- */
      vec3 absorb = vec3(0.62, 0.20, 0.13) * 1.35;
      float path = rThick + vDepth * 0.8;
      vec3 trans = exp(-absorb * path);
      float deepF = clamp(vDepth / 2.2, 0.0, 1.0);
      vec3 scatter = mix(vec3(0.045, 0.135, 0.145), vec3(0.012, 0.055, 0.075), deepF);
      vec3 waterCol = refr * trans + scatter * (1.0 - exp(-path*0.9));

      /* --- 反射 --- */
      vec2 muv = vMirror.xy / vMirror.w;
      muv += N.xz * 0.06;
      vec3 refl = texture2D(tRefl, muv).rgb;

      /* --- 菲涅尔 --- */
      float ct = clamp(dot(N, V), 0.0, 1.0);
      float F = 0.02 + 0.98 * pow(1.0 - ct, 5.0);
      F = clamp(F, 0.0, 0.95);

      vec3 col = mix(waterCol, refl, F);

      /* --- 太阳镜面 --- */
      vec3 Hv = normalize(V + uSunDir);
      float spec = pow(max(dot(N, Hv), 0.0), 540.0);
      col += uSunCol * spec * 2.0;
      float spark = pow(max(dot(N, Hv), 0.0), 60.0);
      col += uSunCol * spark * 0.06;

      /* --- 雾 --- */
      float fogF = 1.0 - exp(-uFogDen * uFogDen * fragDist * fragDist);
      col = mix(col, uFogCol, fogF);

      float shore = smoothstep(0.0, 0.14, thick);
      gl_FragColor = vec4(col, shore);
    }
  `;

  PR.initWater = function (renderer, scene, camera) {
    const T = PR.tex;
    const mirrorSize = Math.min(1024, Math.floor(innerWidth * 0.5));
    const mirrorRT = new THREE.WebGLRenderTarget(mirrorSize, Math.floor(mirrorSize * innerHeight / innerWidth), {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat,
      type: PR.hdrType || THREE.UnsignedByteType
    });
    const mirrorCam = new THREE.PerspectiveCamera();
    const mirrorMatrix = new THREE.Matrix4();
    const biasMatrix = new THREE.Matrix4().set(
      0.5, 0, 0, 0.5,
      0, 0.5, 0, 0.5,
      0, 0, 0.5, 0.5,
      0, 0, 0, 1);
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(PR.WATER_Y - 0.02));

    const mat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uMirrorMatrix: { value: mirrorMatrix },
        tRefl: { value: mirrorRT.texture },
        tScene: { value: null },
        tDepth: { value: null },
        tN1: { value: T.waterN1 },
        tN2: { value: T.waterN2 },
        uRes: { value: new THREE.Vector2(innerWidth, innerHeight) },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uCam: { value: new THREE.Vector3() },
        uSunDir: { value: new THREE.Vector3(0.25, 1, 0.18).normalize() },
        uSunCol: { value: new THREE.Color(1.0, 0.93, 0.82) },
        uFogCol: { value: new THREE.Color(0x16262a) },
        uFogDen: { value: 0.022 }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor
    });
    PR.waterMat = mat;

    const v3a = new THREE.Vector3(), v3b = new THREE.Vector3(), v3c = new THREE.Vector3();

    PR.water = {
      mat, mirrorRT,
      resize() {
        const w = Math.min(1024, Math.floor(innerWidth * 0.5));
        mirrorRT.setSize(w, Math.floor(w * innerHeight / innerWidth));
        mat.uniforms.uRes.value.set(innerWidth * PR.renderScale, innerHeight * PR.renderScale);
      },
      update(t, camPos) {
        mat.uniforms.uTime.value = t;
        mat.uniforms.uCam.value.copy(camPos);
      },
      renderMirror() {
        const wy = PR.WATER_Y;
        if (camera.position.y < wy + 0.05) return;   // 视点过低跳过
        mirrorCam.copy(camera);
        v3a.copy(camera.position); v3a.y = 2 * wy - v3a.y;
        mirrorCam.position.copy(v3a);
        camera.getWorldDirection(v3b);
        v3c.copy(camera.position).add(v3b);
        v3c.y = 2 * wy - v3c.y;
        mirrorCam.up.set(0, 1, 0);
        mirrorCam.up.applyQuaternion(camera.quaternion);
        mirrorCam.up.y *= -1;
        mirrorCam.lookAt(v3c);
        mirrorCam.far = camera.far;
        mirrorCam.updateProjectionMatrix();
        mirrorCam.updateMatrixWorld();
        mirrorCam.layers.set(0);

        mirrorMatrix.copy(biasMatrix)
          .multiply(mirrorCam.projectionMatrix)
          .multiply(mirrorCam.matrixWorldInverse);

        renderer.clippingPlanes = [clipPlane];
        const oldRT = renderer.getRenderTarget();
        renderer.setRenderTarget(mirrorRT);
        renderer.clear();
        renderer.render(scene, mirrorCam);
        renderer.setRenderTarget(oldRT);
        renderer.clippingPlanes = [];
      },
      bindSceneBuffers(colorTex, depthTex) {
        mat.uniforms.tScene.value = colorTex;
        mat.uniforms.tDepth.value = depthTex;
      }
    };
    return PR.water;
  };

  /* ================= 体积光束 ================= */
  const SHAFT_VERT = `
    varying vec2 vUv;
    varying vec3 vW;
    void main(){
      vUv = uv;
      vW = (modelMatrix * vec4(position,1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;
  const SHAFT_FRAG = `
    precision highp float;
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vW;
    void main(){
      float edge = sin(vUv.x * 3.14159);
      edge = pow(edge, 1.6);
      float hFade = pow(1.0 - vUv.y, 1.5) * (0.25 + 0.75*smoothstep(0.0, 0.12, 1.0 - vUv.y));
      float n = sin(vW.x*0.8 + uTime*0.4) * sin(vW.z*0.9 - uTime*0.3) * 0.5 + 0.5;
      float d = length(vW - cameraPosition);
      float fogF = exp(-0.0011 * d * d);
      float a = edge * hFade * (0.55 + 0.45*n) * fogF;
      vec3 col = vec3(0.92, 0.97, 1.0);
      gl_FragColor = vec4(col * a * 0.34, 1.0);
    }
  `;
  let shaftMat = null;

  PR.makeShaft = function (hole, topY) {
    if (!shaftMat) {
      shaftMat = new THREE.ShaderMaterial({
        vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
        uniforms: { uTime: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      PR.shaftMat = shaftMat;
    }
    const sun = new THREE.Vector3(0.25, -1, 0.18).normalize();
    const drop = topY - 0.02;
    const off = new THREE.Vector3(sun.x / -sun.y * drop, -drop, sun.z / -sun.y * drop);
    const g = new THREE.BufferGeometry();
    const x0 = hole.x0, x1 = hole.x1, z0 = hole.z0, z1 = hole.z1, y = topY;
    const shrink = 0.75;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const bx0 = cx + (x0 - cx) * shrink + off.x, bx1 = cx + (x1 - cx) * shrink + off.x;
    const bz0 = cz + (z0 - cz) * shrink + off.z, bz1 = cz + (z1 - cz) * shrink + off.z;
    const by = y + off.y;
    const pos = [], uv = [], idx = [];
    function side(ax0, az0, ax1, az1, bxA, bzA, bxB, bzB) {
      const b = pos.length / 3;
      pos.push(ax0, y, az0, ax1, y, az1, bxB, by, bzB, bxA, by, bzA);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    side(x0, z0, x1, z0, bx0, bz0, bx1, bz0);
    side(x1, z0, x1, z1, bx1, bz0, bx1, bz1);
    side(x1, z1, x0, z1, bx1, bz1, bx0, bz1);
    side(x0, z1, x0, z0, bx0, bz1, bx0, bz0);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, shaftMat);
    mesh.layers.set(5);
    mesh.renderOrder = 8;
    return mesh;
  };

  /* ================= 尘埃粒子 ================= */
  const DUST_VERT = `
    uniform float uTime;
    attribute float aPhase;
    varying float vA;
    void main(){
      vec3 p = position;
      p.x += sin(uTime*0.21 + aPhase*6.28)*0.35;
      p.z += cos(uTime*0.17 + aPhase*5.1)*0.35;
      p.y += sin(uTime*0.1 + aPhase*9.4)*0.5;
      vec4 mv = modelViewMatrix * vec4(p,1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = 130.0 / max(-mv.z, 1.0) * (0.02 + 0.05*aPhase);
      float d = -mv.z;
      vA = (0.35 + 0.65 * sin(uTime*(0.4+aPhase) + aPhase*20.0)) * exp(-0.0011*d*d);
    }
  `;
  const DUST_FRAG = `
    precision highp float;
    uniform sampler2D tDot;
    varying float vA;
    void main(){
      vec4 t = texture2D(tDot, gl_PointCoord);
      gl_FragColor = vec4(vec3(1.0), t.a * abs(vA) * 0.35);
    }
  `;
  let dustMat = null;
  PR.makeDust = function (hole, topY) {
    if (!dustMat) {
      dustMat = new THREE.ShaderMaterial({
        vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
        uniforms: { uTime: { value: 0 }, tDot: { value: PR.tex.softDot } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      PR.dustMat = dustMat;
    }
    const n = 34;
    const pos = [], ph = [];
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      pos.push(
        hole.x0 + Math.random() * (hole.x1 - hole.x0),
        0.4 + t * (topY - 0.8),
        hole.z0 + Math.random() * (hole.z1 - hole.z0));
      ph.push(Math.random());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1));
    g.computeBoundingSphere();
    g.boundingSphere.radius += 2;
    const pts = new THREE.Points(g, dustMat);
    pts.layers.set(5);
    pts.renderOrder = 9;
    return pts;
  };
})();
