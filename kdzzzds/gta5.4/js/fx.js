/* fx.js — 视觉特效:天空穹顶/星空/日月、程序环境立方体、轻量自研 Bloom、
   粒子系统(Points)、GPU 衰减胎痕、动态水面、海鸥、灯光池 */
window.G = window.G || {};
(function () {
  const U = G.U;
  const FX = {};
  G.FX = FX;

  /* ================= 天空 ================= */
  FX.initSky = function (scene) {
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x3a76c4) },
        hor: { value: new THREE.Color(0xcfe0ea) },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunCol: { value: new THREE.Color(0xfff2d0) },
        glow: { value: 0.8 }
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vDir; uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float glow;
        void main(){
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 c = mix(hor, top, pow(h, 0.62));
          float s = pow(max(dot(vDir, sunDir), 0.0), 24.0);
          c += sunCol * s * glow;
          float band = pow(1.0 - abs(vDir.y), 6.0) * 0.25 * glow;
          c += sunCol * band * max(dot(normalize(vec3(vDir.x,0.,vDir.z)), normalize(vec3(sunDir.x,0.,sunDir.z)))*0.5+0.5, 0.0);
          gl_FragColor = vec4(c, 1.0);
        }`
    });
    FX.sky = new THREE.Mesh(new THREE.SphereGeometry(760, 28, 14), skyMat);
    FX.sky.frustumCulled = false;
    scene.add(FX.sky);
    /* 星空 */
    const rng = U.rng(777);
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = U.rand(rng, 0, U.TAU), e = Math.acos(U.rand(rng, 0.03, 1));
      const r = 740;
      pos[i * 3] = Math.cos(a) * Math.sin(e) * r;
      pos[i * 3 + 1] = Math.cos(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.sin(e) * r;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    FX.starMat = new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    FX.stars = new THREE.Points(sg, FX.starMat);
    FX.stars.frustumCulled = false;
    scene.add(FX.stars);
    /* 日 / 月 */
    const t = G.TEX.t;
    FX.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.flare.map, color: 0xffe8b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    FX.sun.scale.set(130, 130, 1);
    scene.add(FX.sun);
    FX.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.moon.map, color: 0xf4f2e0, transparent: true, depthWrite: false, fog: false }));
    FX.moon.scale.set(52, 52, 1);
    scene.add(FX.moon);
    /* 云 */
    FX.clouds = [];
    const crng = U.rng(31);
    for (let i = 0; i < 11; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.cloud[i % 2].map, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
      const s = U.rand(crng, 90, 190);
      sp.scale.set(s, s * 0.42, 1);
      sp.position.set(U.rand(crng, -500, 500), U.rand(crng, 130, 210), U.rand(crng, -500, 500));
      sp.userData.v = U.rand(crng, 0.9, 2.2);
      scene.add(sp);
      FX.clouds.push(sp);
    }
  };

  /* ================= 程序环境立方体 ================= */
  function envCube(topC, horC, botC, warm) {
    const faces = [];
    for (let f = 0; f < 6; f++) {
      const { cv, ctx } = U.makeCanvas(32, 32);
      let g;
      if (f === 2) { g = ctx.createLinearGradient(0, 0, 0, 32); g.addColorStop(0, topC); g.addColorStop(1, topC); }
      else if (f === 3) { g = ctx.createLinearGradient(0, 0, 0, 32); g.addColorStop(0, botC); g.addColorStop(1, botC); }
      else { g = ctx.createLinearGradient(0, 0, 0, 32); g.addColorStop(0, topC); g.addColorStop(0.55, horC); g.addColorStop(0.62, warm || horC); g.addColorStop(0.7, botC); g.addColorStop(1, botC); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
      faces.push(cv);
    }
    const cube = new THREE.CubeTexture(faces);
    cube.needsUpdate = true;
    cube.encoding = THREE.sRGBEncoding;
    return cube;
  }
  FX.initEnv = function (scene) {
    FX.envDay = envCube('#7fb2e0', '#c8d8e4', '#3c3f43');
    FX.envNight = envCube('#0a1020', '#1d2c44', '#0c0d10', '#c96a3d');
    scene.environment = FX.envDay;
    FX._envNightOn = false;
    FX.setEnvNight = function (on) {
      if (on === FX._envNightOn) return;
      FX._envNightOn = on;
      scene.environment = on ? FX.envNight : FX.envDay;
    };
  };

  /* ================= 自研 Bloom ================= */
  FX.initBloom = function (renderer, w, h) {
    FX.renderer = renderer;
    const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false };
    const useMS = renderer.capabilities.isWebGL2;
    FX.rtScene = useMS ? new THREE.WebGLMultisampleRenderTarget(w, h, rtOpts) : new THREE.WebGLRenderTarget(w, h, rtOpts);
    if (FX.rtScene.samples !== undefined) FX.rtScene.samples = 4;
    FX.rtScene.texture.encoding = THREE.sRGBEncoding;
    const bw = Math.max(64, w >> 2), bh = Math.max(64, h >> 2);
    FX.rtA = new THREE.WebGLRenderTarget(bw, bh, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    FX.rtB = new THREE.WebGLRenderTarget(bw, bh, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    FX.quadScene = new THREE.Scene();
    FX.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    FX.brightMat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, thr: { value: 0.72 } },
      vertexShader: vs,
      fragmentShader: 'varying vec2 vUv; uniform sampler2D tex; uniform float thr; void main(){ vec3 c = texture2D(tex, vUv).rgb; float l = dot(c, vec3(0.299,0.587,0.114)); float m = smoothstep(thr, thr+0.32, l); gl_FragColor = vec4(c*m, 1.0); }'
    });
    FX.blurMat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, res: { value: new THREE.Vector2(bw, bh) } },
      vertexShader: vs,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tex; uniform vec2 dir; uniform vec2 res;
        void main(){ vec2 px = dir / res; vec3 s = texture2D(tex, vUv).rgb * 0.227;
        s += (texture2D(tex, vUv + px*1.384).rgb + texture2D(tex, vUv - px*1.384).rgb) * 0.316;
        s += (texture2D(tex, vUv + px*3.230).rgb + texture2D(tex, vUv - px*3.230).rgb) * 0.070;
        gl_FragColor = vec4(s, 1.0); }`
    });
    FX.compMat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, bloom: { value: null }, strength: { value: 0.3 }, vig: { value: 0.32 }, grain: { value: 0.030 }, time: { value: 0 } },
      vertexShader: vs,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tex; uniform sampler2D bloom; uniform float strength; uniform float vig; uniform float grain; uniform float time;
        float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
        void main(){
          vec3 c = texture2D(tex, vUv).rgb + texture2D(bloom, vUv).rgb * strength;
          vec2 d = vUv - 0.5;
          c *= 1.0 - dot(d, d) * vig * 2.2;
          c += (rnd(vUv) - 0.5) * grain;
          gl_FragColor = vec4(c, 1.0);
        }`
    });
    FX.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), FX.compMat);
    FX.quad.frustumCulled = false;
    FX.quadScene.add(FX.quad);
  };
  FX.resize = function (w, h) {
    if (!FX.rtScene) return;
    FX.rtScene.setSize(w, h);
    FX.rtA.setSize(Math.max(64, w >> 2), Math.max(64, h >> 2));
    FX.rtB.setSize(Math.max(64, w >> 2), Math.max(64, h >> 2));
    FX.blurMat.uniforms.res.value.set(Math.max(64, w >> 2), Math.max(64, h >> 2));
  };
  FX.render = function (scene, camera, dt) {
    const r = FX.renderer;
    r.setRenderTarget(FX.rtScene);
    r.render(scene, camera);
    FX.quad.material = FX.brightMat;
    FX.brightMat.uniforms.tex.value = FX.rtScene.texture;
    r.setRenderTarget(FX.rtA); r.render(FX.quadScene, FX.quadCam);
    for (let i = 0; i < 2; i++) {
      FX.quad.material = FX.blurMat;
      FX.blurMat.uniforms.tex.value = FX.rtA.texture; FX.blurMat.uniforms.dir.value.set(1, 0);
      r.setRenderTarget(FX.rtB); r.render(FX.quadScene, FX.quadCam);
      FX.blurMat.uniforms.tex.value = FX.rtB.texture; FX.blurMat.uniforms.dir.value.set(0, 1);
      r.setRenderTarget(FX.rtA); r.render(FX.quadScene, FX.quadCam);
    }
    FX.quad.material = FX.compMat;
    FX.compMat.uniforms.tex.value = FX.rtScene.texture;
    FX.compMat.uniforms.bloom.value = FX.rtA.texture;
    FX.compMat.uniforms.time.value = (FX.compMat.uniforms.time.value + (dt || 0.016)) % 10;
    r.setRenderTarget(null);
    r.render(FX.quadScene, FX.quadCam);
  };

  /* ================= 粒子系统 ================= */
  function makePS(tex, count, additive) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), extra = new Float32Array(count * 2); // size, alpha
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aExtra', new THREE.BufferAttribute(extra, 2));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec3 aCol; attribute vec2 aExtra; varying vec3 vCol; varying float vA;
        void main(){ vCol = aCol; vA = aExtra.y; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aExtra.x * (240.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vCol; varying float vA;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(t.rgb * vCol, t.a * vA); if (gl_FragColor.a < 0.01) discard; }`
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    const parts = [];
    for (let i = 0; i < count; i++) parts.push({ life: 0 });
    return { pts, parts, pos, col, extra, count, head: 0 };
  }
  FX.initParticles = function (scene) {
    const t = G.TEX.t;
    FX.smokePS = makePS(t.smoke.map, 260, false);
    FX.sparkPS = makePS(t.flare.map, 90, true);
    scene.add(FX.smokePS.pts, FX.sparkPS.pts);
  };
  function emit(ps, x, y, z, vx, vy, vz, size, grow, life, r, g2, b, a, drag, grav) {
    const p = ps.parts[ps.head];
    p.life = life; p.maxLife = life;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.size = size; p.grow = grow; p.r = r; p.g = g2; p.b = b; p.a = a;
    p.drag = drag == null ? 1.5 : drag; p.grav = grav == null ? 0 : grav;
    ps.head = (ps.head + 1) % ps.count;
  }
  FX.smoke = (x, y, z, vx, vy, vz, size, life, gray, a) => emit(FX.smokePS, x, y, z, vx, vy, vz, size || 1.4, 1.8, life || 1.2, gray, gray, gray, a == null ? 0.4 : a, 1.6, 0.4);
  FX.dust = (x, y, z, vx, vy, vz) => emit(FX.smokePS, x, y, z, vx, vy, vz, 1.1, 1.5, 0.9, 0.62, 0.58, 0.5, 0.35, 2, 0.2);
  FX.splash = (x, y, z) => { for (let i = 0; i < 12; i++) { const a = Math.random() * U.TAU; emit(FX.smokePS, x, y, z, Math.cos(a) * 3, 4 + Math.random() * 3, Math.sin(a) * 3, 0.9, 1.2, 1.0, 0.75, 0.85, 0.92, 0.6, 1.2, -9); } };
  FX.spark = (x, y, z, n) => { for (let i = 0; i < (n || 6); i++) { const a = Math.random() * U.TAU; emit(FX.sparkPS, x, y, z, Math.cos(a) * U.rand(Math.random, 2, 7), Math.random() * 4, Math.sin(a) * U.rand(Math.random, 2, 7), 0.5, -0.2, 0.4, 1, 0.8, 0.35, 1, 0.5, -14); } };
  FX.steam = (x, y, z) => emit(FX.smokePS, x, y, z, U.rand(Math.random, -0.3, 0.3), 1.5, U.rand(Math.random, -0.3, 0.3), 1.2, 1.4, 2.4, 0.85, 0.85, 0.88, 0.24, 1, -0.3);
  function stepPS(ps, dt) {
    for (let i = 0; i < ps.count; i++) {
      const p = ps.parts[i];
      if (p.life > 0) {
        p.life -= dt;
        const dr = Math.exp(-p.drag * dt);
        p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05 && p.grav > 0) { p.y = 0.05; p.vy = 0; }
        p.size += p.grow * dt;
        const k = Math.max(0, p.life / p.maxLife);
        ps.pos[i * 3] = p.x; ps.pos[i * 3 + 1] = p.y; ps.pos[i * 3 + 2] = p.z;
        ps.col[i * 3] = p.r; ps.col[i * 3 + 1] = p.g; ps.col[i * 3 + 2] = p.b;
        ps.extra[i * 2] = p.size; ps.extra[i * 2 + 1] = p.a * k;
      } else ps.extra[i * 2 + 1] = 0;
    }
    ps.pts.geometry.attributes.position.needsUpdate = true;
    ps.pts.geometry.attributes.aCol.needsUpdate = true;
    ps.pts.geometry.attributes.aExtra.needsUpdate = true;
  }

  /* ================= 胎痕(GPU 时间衰减) ================= */
  FX.initSkid = function (scene) {
    const MAX = 640;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 4 * 3), uv = new Float32Array(MAX * 4 * 2), birth = new Float32Array(MAX * 4), alpha = new Float32Array(MAX * 4);
    const idx = new Uint16Array(MAX * 6);
    for (let i = 0; i < MAX; i++) {
      idx[i * 6] = i * 4; idx[i * 6 + 1] = i * 4 + 1; idx[i * 6 + 2] = i * 4 + 2;
      idx[i * 6 + 3] = i * 4; idx[i * 6 + 4] = i * 4 + 2; idx[i * 6 + 5] = i * 4 + 3;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(birth, 1));
    geo.setAttribute('aA', new THREE.BufferAttribute(alpha, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    FX.skidMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: G.TEX.t.skid.map }, time: { value: 0 } },
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3,
      vertexShader: 'attribute float aBirth; attribute float aA; varying vec2 vUv; varying float vA; uniform float time; void main(){ vUv = uv; vA = aA * clamp(1.0 - (time - aBirth) / 30.0, 0.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D map; varying vec2 vUv; varying float vA; void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(0.02, 0.02, 0.025, t.a * vA); if (gl_FragColor.a < 0.01) discard; }'
    });
    FX.skidMesh = new THREE.Mesh(geo, FX.skidMat);
    FX.skidMesh.frustumCulled = false;
    scene.add(FX.skidMesh);
    FX.skidHead = 0; FX.skidMax = MAX; FX.skidTime = 0;
    FX.lastSkid = {};
  };
  /* 从上一点连到当前点,strength 0..1 */
  FX.skid = function (id, x, y, z, strength) {
    const last = FX.lastSkid[id];
    FX.lastSkid[id] = { x, z, t: FX.skidTime };
    if (!last || FX.skidTime - last.t > 0.3) return;
    const dx = x - last.x, dz = z - last.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.06 || len > 3) return;
    const nx = -dz / len * 0.13, nz = dx / len * 0.13;
    const i = FX.skidHead;
    FX.skidHead = (FX.skidHead + 1) % FX.skidMax;
    const g = FX.skidMesh.geometry;
    const P = g.attributes.position.array, UV2 = g.attributes.uv.array, B = g.attributes.aBirth.array, A = g.attributes.aA.array;
    const y2 = y + 0.015;
    const verts = [[last.x + nx, y2, last.z + nz], [last.x - nx, y2, last.z - nz], [x - nx, y2, z - nz], [x + nx, y2, z + nz]];
    const uvs = [[0, 0], [0, 1], [1, 1], [1, 0]];
    for (let k = 0; k < 4; k++) {
      P[(i * 4 + k) * 3] = verts[k][0]; P[(i * 4 + k) * 3 + 1] = verts[k][1]; P[(i * 4 + k) * 3 + 2] = verts[k][2];
      UV2[(i * 4 + k) * 2] = uvs[k][0]; UV2[(i * 4 + k) * 2 + 1] = uvs[k][1];
      B[i * 4 + k] = FX.skidTime; A[i * 4 + k] = U.clamp(strength, 0, 1) * 0.9;
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
    g.attributes.aBirth.needsUpdate = true;
    g.attributes.aA.needsUpdate = true;
  };

  /* ================= 水面 / 海鸥 / 灯光池 ================= */
  FX.initWater = function (scene) {
    const t = G.TEX.t;
    FX.waterN = G.TEX.cloneTex(t.waterN.nrm, 60, 60);
    FX.waterN.encoding = THREE.LinearEncoding;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x14323e, roughness: 0.14, metalness: 0.35,
      normalMap: FX.waterN, normalScale: new THREE.Vector2(0.55, 0.55)
    });
    FX.waterMat = mat;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1700, 1700), mat);
    w.rotation.x = -Math.PI / 2;
    w.position.y = -1.05;
    w.receiveShadow = false;
    scene.add(w);
    /* 喷泉水盘 */
    if (G.CITY.fountain) {
      const f = G.CITY.fountain;
      const fm = new THREE.Mesh(new THREE.CircleGeometry(f.r, 20), new THREE.MeshStandardMaterial({ color: 0x1d4a5c, roughness: 0.1, metalness: 0.3, normalMap: G.TEX.cloneTex(t.waterN.nrm, 3, 3) }));
      fm.rotation.x = -Math.PI / 2;
      fm.position.set(f.x, f.y - 0.28, f.z);
      scene.add(fm);
      FX.fountainMesh = fm;
    }
  };
  FX.initGulls = function (scene) {
    FX.gulls = [];
    const t = G.TEX.t;
    for (let i = 0; i < 5; i++) {
      const m = new THREE.SpriteMaterial({ map: G.TEX.cloneTex(t.gull.map, 0.5, 1), transparent: true, depthWrite: false });
      const sp = new THREE.Sprite(m);
      sp.scale.set(1.6, 0.42, 1);
      sp.userData = { a: Math.random() * U.TAU, r: 18 + i * 7, h: 14 + i * 3, v: 0.25 + Math.random() * 0.2, cx: 30 - i * 30, cz: 250, flap: Math.random() * 10 };
      scene.add(sp);
      FX.gulls.push(sp);
    }
  };
  FX.initLightPool = function (scene) {
    FX.plights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xffd9a0, 0, 24, 2);
      scene.add(l);
      FX.plights.push(l);
    }
    /* 红色示宽灯 */
    FX.beacons = [];
    const spots = [];
    if (G.CITY.beacon) spots.push(G.CITY.beacon.clone());
    spots.push(new THREE.Vector3(60, 22.6, 246));
    spots.push(new THREE.Vector3(-150, 15.3, 245), new THREE.Vector3(120, 15.3, 243));
    for (const p of spots) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.TEX.t.flare.map, color: 0xff2a20, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      sp.scale.set(2.2, 2.2, 1);
      sp.position.copy(p);
      scene.add(sp);
      FX.beacons.push(sp);
    }
  };
  FX.updateLightPool = function (px, pz, night) {
    if (!G.CITY.lampPos) return;
    const lamps = G.CITY.lampPos;
    if (!FX._lampSorted || FX._lampT > 0.5) {
      FX._lampT = 0;
      FX._nearest = lamps.slice().sort((a, b) => ((a.x - px) ** 2 + (a.z - pz) ** 2) - ((b.x - px) ** 2 + (b.z - pz) ** 2)).slice(0, 6);
      FX._lampSorted = true;
    }
    for (let i = 0; i < 6; i++) {
      const l = FX.plights[i], lp = FX._nearest && FX._nearest[i];
      if (lp) { l.position.set(lp.x, lp.y, lp.z); l.intensity = 1.5 * night; }
      else l.intensity = 0;
    }
  };

  FX.update = function (dt, camPos, playerPos, night) {
    FX.skidTime += dt;
    if (FX.skidMat) FX.skidMat.uniforms.time.value = FX.skidTime;
    stepPS(FX.smokePS, dt);
    stepPS(FX.sparkPS, dt);
    /* 天体跟随镜头(视差无穷远) */
    if (FX.sky) FX.sky.position.copy(camPos);
    if (FX.stars) FX.stars.position.copy(camPos);
    /* 云漂移 */
    for (const c of FX.clouds || []) {
      c.position.x += c.userData.v * dt;
      if (c.position.x > 560) c.position.x = -560;
    }
    /* 海鸥 */
    FX._lampT = (FX._lampT || 0) + dt;
    for (const g2 of FX.gulls || []) {
      const u2 = g2.userData;
      u2.a += u2.v * dt;
      u2.flap += dt * 9;
      g2.position.set(u2.cx + Math.cos(u2.a) * u2.r, u2.h + Math.sin(u2.a * 2.3) * 1.5, u2.cz + Math.sin(u2.a) * u2.r * 0.6);
      g2.material.map.offset.x = (Math.sin(u2.flap) > 0) ? 0 : 0.5;
    }
    /* 水面流动 */
    if (FX.waterN) { FX.waterN.offset.x += dt * 0.006; FX.waterN.offset.y += dt * 0.0045; }
    /* 示宽灯脉动 */
    if (FX.beacons) {
      const b = (Math.sin(FX.skidTime * 2.4) * 0.5 + 0.5);
      for (const sp of FX.beacons) sp.material.opacity = (0.25 + 0.75 * b) * night;
    }
    /* 喷泉粒子 */
    const f = G.CITY.fountain;
    if (f && camPos.distanceTo(new THREE.Vector3(f.x, 0, f.z)) < 70) {
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * U.TAU;
        emit(FX.smokePS, f.x + Math.cos(a) * 0.3, f.y + 0.7, f.z + Math.sin(a) * 0.3,
          Math.cos(a) * U.rand(Math.random, 0.2, 1.1), U.rand(Math.random, 2.6, 3.8), Math.sin(a) * U.rand(Math.random, 0.2, 1.1),
          0.5, 0.7, 1.1, 0.8, 0.88, 0.95, 0.5, 0.4, 9.8);
      }
    }
    /* 仓库屋顶蒸汽 */
    if (Math.random() < dt * 2.2 && camPos.z > 140) FX.steam(-18, 15.4, 252);
  };
})();
