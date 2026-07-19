/* ============================================================
   POOLROOMS · main.js
   渲染器 / 环境IBL / 日光阴影 / 材质焦散注入 / 主循环 / 自适应
   ============================================================ */
(function () {
  'use strict';

  let renderer, scene, waterScene, camera, sun, post;
  let time = 0, last = 0;
  PR.renderScale = 1.0;

  const SUN_DIR = new THREE.Vector3(0.25, 1, 0.18).normalize(); // 指向太阳

  window.addEventListener('DOMContentLoaded', boot);

  function boot() {
    const cv = document.getElementById('cv');
    const isShot = location.search.indexOf('shot') >= 0;
    const dbgM = (location.search.match(/dbg=(\w+)/) || [])[1] || null;
    PR.dbg = dbgM;
    if (isShot) {
      const en = document.getElementById('enter');
      en.style.display = 'none';
      window.onerror = (m, s, l, c) => { console.error('[PR-ERR]', m, s, l, c); };
    }
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
    if (!renderer.capabilities.isWebGL2) {
      document.getElementById('enter').innerHTML = '<div class="t1">需要支持 WebGL2 的浏览器</div>';
      return;
    }
    renderer.setPixelRatio(1);
    renderer.outputEncoding = THREE.LinearEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.autoClear = false;

    /* 关键:显式激活浮点颜色缓冲扩展,否则 HDR FBO 不完整 */
    const gl = renderer.getContext();
    PR.hdrOK = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    gl.getExtension('EXT_float_blend');
    PR.hdrType = PR.hdrOK ? THREE.HalfFloatType : THREE.UnsignedByteType;
    if (location.search.indexOf('ldr') >= 0) { PR.hdrOK = false; PR.hdrType = THREE.UnsignedByteType; }
    PR.noDT = location.search.indexOf('nodt') >= 0;
    console.log('[poolrooms] HDR render targets:', PR.hdrOK ? 'HalfFloat' : 'LDR fallback', PR.noDT ? '(no depth texture)' : '');

    scene = new THREE.Scene();
    /* 注意:HDR 线性管线中雾色必须是线性值,过亮会把远处全部罩成白光 */
    scene.fog = new THREE.FogExp2(0x16262a, 0.022);
    scene.background = new THREE.Color(0x16262a);
    waterScene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 160);
    camera.layers.enable(0);
    camera.layers.enable(5);

    PR.buildTextures();
    buildEnvironment();
    buildLights();
    const mats = buildMaterials();
    PR.initWater(renderer, scene, camera);
    PR.world.init(scene, waterScene, mats);
    PR.world.update(8, 8);
    post = PR.initPost(renderer, scene, waterScene, camera);
    PR.player.init(camera);
    PR.setExposure = v => { post.grade.u.uExposure.value = v; };
    document.addEventListener('keydown', e => {
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        const u = post.grade.u.uExposure;
        u.value = Math.max(0.3, Math.min(2.5, u.value + (e.code === 'BracketRight' ? 0.05 : -0.05)));
        console.log('[poolrooms] exposure =', u.value.toFixed(2));
      }
    });

    onResize();
    window.addEventListener('resize', onResize);

    const enter = document.getElementById('enter');
    enter.addEventListener('click', () => {
      PR.audio.init();
      if (PR.audio.ctx && PR.audio.ctx.state === 'suspended') PR.audio.ctx.resume();
      cv.requestPointerLock && cv.requestPointerLock();
    });
    setTimeout(() => enter.classList.add('ready'), 400);

    requestAnimationFrame(loop);
  }

  /* ---------------- 环境 IBL(手工 CubeTexture,替代 r128 PMREM 爆值问题) ---------------- */
  function buildEnvironment() {
    const mkFace = fn => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      fn(g);
      return c;
    };
    const vGrad = (g, top, bottom) => {
      const gr = g.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, top);
      gr.addColorStop(1, bottom);
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    };
    const sideFace = () => mkFace(g => vGrad(g, '#7f9a9e', '#232c30'));
    const topFace = mkFace(g => {
      g.fillStyle = '#9fb8bc';
      g.fillRect(0, 0, 64, 64);
      const rad = g.createRadialGradient(40, 26, 2, 40, 26, 22);
      rad.addColorStop(0, '#fff2dd');
      rad.addColorStop(1, 'rgba(255,242,221,0)');
      g.fillStyle = rad;
      g.fillRect(0, 0, 64, 64);
    });
    const botFace = mkFace(g => vGrad(g, '#1e2628', '#161c1e'));
    const cube = new THREE.CubeTexture([sideFace(), sideFace(), topFace, botFace, sideFace(), sideFace()]);
    cube.needsUpdate = true;
    cube.encoding = THREE.sRGBEncoding;
    scene.environment = cube;
    scene.background = new THREE.Color(0x16262a);
  }

  /* ---------------- 灯光 ---------------- */
  function buildLights() {
    sun = new THREE.DirectionalLight(0xfff1dd, 2.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const S = 26;
    sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
    sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    scene.add(sun.target);
    const hemi = new THREE.HemisphereLight(0xcfe6ea, 0x3d4b4a, 0.22);
    PR._hemi = hemi;
    scene.add(hemi);
  }

  /* ---------------- 材质 + 焦散/宏观注入 ---------------- */
  function injectShader(mat, opts) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = PR.timeUniform;
      sh.uniforms.uWaterY = { value: PR.WATER_Y };
      sh.uniforms.uMacro = { value: PR.tex.macro };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPRW;\nvarying vec3 vPRN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPRW = (modelMatrix * vec4(transformed,1.0)).xyz;\nvPRN = normalize((modelMatrix * vec4(objectNormal,0.0)).xyz);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vPRW;
          varying vec3 vPRN;
          uniform float uTime;
          uniform float uWaterY;
          uniform sampler2D uMacro;
          vec2 prWarp(vec2 p, float t){
            return vec2(sin(p.y*1.7+t*0.9)+sin(p.y*3.3-t*0.6), sin(p.x*1.9-t*0.8)+sin(p.x*2.7+t*0.7));
          }
          float prCaustic(vec2 p, float t){
            vec2 q = p + 0.34*prWarp(p, t);
            vec2 r2 = q + 0.24*prWarp(q*1.63, t*1.27);
            float v = sin(r2.x*3.1)*sin(r2.y*3.3) + sin((r2.x+r2.y)*2.2+t*0.5);
            v = 1.0 - abs(v*0.5);
            return clamp(pow(max(v,0.0), 6.0)*1.7, 0.0, 3.0);
          }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          float prM = texture2D(uMacro, vPRW.xz*0.021).g;
          diffuseColor.rgb *= 0.90 + 0.20*prM;
          ${opts.wallAO ? 'diffuseColor.rgb *= mix(0.68, 1.0, smoothstep(0.02, 0.75, vPRW.y)) ;' : ''}`)
        .replace('#include <output_fragment>', `
          float prUnder = smoothstep(uWaterY+0.02, uWaterY-0.3, vPRW.y);
          if (prUnder > 0.001) {
            float ca = prCaustic(vPRW.xz*1.8, uTime*1.05);
            outgoingLight += diffuseColor.rgb * ca * prUnder * 0.4;
          }
          float prCeil = smoothstep(0.4, 0.85, -vPRN.y) * smoothstep(2.2, 3.2, vPRW.y);
          if (prCeil > 0.001) {
            float cs = prCaustic(vPRW.xz*0.45 + vec2(uTime*0.02, 0.0), uTime*0.6);
            outgoingLight += vec3(0.55, 0.8, 0.85) * cs * prCeil * 0.045;
          }
          #include <output_fragment>`);
    };
    mat.customProgramCacheKey = () => 'pr_' + (opts.wallAO ? 'w' : 'f');
  }

  function buildMaterials() {
    PR.timeUniform = { value: 0 };
    const T = PR.tex;
    const tile = new THREE.MeshStandardMaterial({
      map: T.tile.map, normalMap: T.tile.normalMap,
      roughnessMap: T.tile.roughnessMap, aoMap: T.tile.aoMap,
      roughness: 1.0, metalness: 0.0, envMapIntensity: 0.75,
      normalScale: new THREE.Vector2(0.75, 0.75)
    });
    injectShader(tile, { wallAO: true });
    const mosaic = new THREE.MeshStandardMaterial({
      map: T.mosaic.map, normalMap: T.mosaic.normalMap,
      roughnessMap: T.mosaic.roughnessMap, aoMap: T.mosaic.aoMap,
      roughness: 1.0, metalness: 0.0, envMapIntensity: 0.85,
      normalScale: new THREE.Vector2(0.6, 0.6)
    });
    injectShader(mosaic, { wallAO: false });
    const concrete = new THREE.MeshStandardMaterial({
      map: T.concrete.map, normalMap: T.concrete.normalMap,
      roughnessMap: T.concrete.roughnessMap,
      roughness: 1.0, metalness: 0.0, envMapIntensity: 0.4,
      normalScale: new THREE.Vector2(0.8, 0.8)
    });
    injectShader(concrete, { wallAO: false });
    const sky = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 2.9), fog: false });
    return { tile, mosaic, concrete, sky };
  }

  /* ---------------- 尺寸 / 自适应 ---------------- */
  function onResize() {
    const w = Math.floor(innerWidth * PR.renderScale);
    const h = Math.floor(innerHeight * PR.renderScale);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100vw';
    renderer.domElement.style.height = '100vh';
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    post.resize(w, h);
    PR.water.resize();
  }

  let fpsAcc = 0, fpsN = 0, fpsTimer = 0;
  function adapt(dt) {
    fpsAcc += dt; fpsN++; fpsTimer += dt;
    if (fpsTimer > 3) {
      const avg = fpsN / fpsAcc;
      fpsTimer = 0; fpsAcc = 0; fpsN = 0;
      if (avg < 47 && PR.renderScale > 0.7) {
        PR.renderScale = Math.max(0.7, PR.renderScale - 0.15);
        onResize();
      } else if (avg > 58 && PR.renderScale < 1.0) {
        PR.renderScale = Math.min(1.0, PR.renderScale + 0.15);
        onResize();
      }
    }
  }

  /* ---------------- 主循环 ---------------- */
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    time += dt;

    PR.timeUniform.value = time;
    if (PR.shaftMat) PR.shaftMat.uniforms.uTime.value = time;
    if (PR.dustMat) PR.dustMat.uniforms.uTime.value = time;

    PR.player.update(dt);
    const p = PR.player.pos;
    PR.world.update(p.x, p.z);

    /* 太阳跟随(纹素对齐减少闪烁) */
    const snap = 52 / 2048;
    const tx = Math.round(p.x / snap) * snap;
    const tz = Math.round(p.z / snap) * snap;
    sun.position.set(tx + SUN_DIR.x * 40, SUN_DIR.y * 40, tz + SUN_DIR.z * 40);
    sun.target.position.set(tx, 0, tz);

    PR.water.update(time, camera.position);
    camera.updateMatrixWorld();

    /* 调试直渲:绕过后处理 */
    if (PR.dbg === 'direct') {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x16262a, 1);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
      adapt(dt);
      return;
    }
    if (PR.dbg === 'A' || PR.dbg === 'B' || PR.dbg === 'C' || PR.dbg === 'D' || PR.dbg === 'G') post.debugStage = PR.dbg;

    if (PR.dbg !== 'nomirror') PR.water.renderMirror();
    post.render(time);

    /* 数值探针:?dump 时第3帧读回各阶段中心像素 */
    if (location.search.indexOf('dump') >= 0) {
      PR._fc = (PR._fc || 0) + 1;
      if (PR._fc <= 12) console.log('[PRDUMP] frame', PR._fc);
      if (PR._fc === 3) {
        const readRt = () => {
          const px = new Uint8Array(4 * 16);
          renderer.readRenderTargetPixels(post.rtD, (post.w >> 1) - 2, (post.h >> 1) - 2, 4, 4, px);
          const s = [0, 0, 0];
          for (let i = 0; i < 16; i++) { s[0] += px[i * 4]; s[1] += px[i * 4 + 1]; s[2] += px[i * 4 + 2]; }
          return ((s[0] / 16) | 0) + ',' + ((s[1] / 16) | 0) + ',' + ((s[2] / 16) | 0);
        };
        const rawDump = (label, tex) => {
          post.copy.u.tInput.value = tex;
          post._run(post.copy, post.rtD);
          console.log('[PRDUMP] raw', label, readRt());
        };
        const gradeDump = (label, tex) => {
          post.grade.u.tInput.value = tex;
          post._run(post.grade, post.rtD);
          console.log('[PRDUMP] graded', label, readRt());
        };
        rawDump('rtA', post.rtA.texture);
        rawDump('bloomA1', post.bloomA1.texture);
        rawDump('ssao', post.ssaoA.texture);
        gradeDump('rtA', post.rtA.texture);
        gradeDump('rtB', post.rtB.texture);
        gradeDump('rtC', post.rtC.texture);
        /* 探针2:干净重渲 rtA(排除镜面残留状态) */
        renderer.clippingPlanes = [];
        renderer.info.reset();
        renderer.setRenderTarget(post.rtA);
        renderer.setClearColor(0x16262a, 1);
        renderer.clear(true, true, false);
        renderer.render(scene, camera);
        console.log('[PRDUMP] info calls=', renderer.info.render.calls, 'tris=', renderer.info.render.triangles);
        gradeDump('rtA-clean', post.rtA.texture);
        /* 探针3:场景直接渲到字节目标 */
        renderer.setRenderTarget(post.rtD);
        renderer.setClearColor(0x16262a, 1);
        renderer.clear(true, true, false);
        renderer.render(scene, camera);
        console.log('[PRDUMP] sceneByte', readRt());
        /* 探针4:关闭 environment(PMREM)重渲 */
        const envBak = scene.environment;
        scene.environment = null;
        renderer.setRenderTarget(post.rtD);
        renderer.clear(true, true, false);
        renderer.render(scene, camera);
        console.log('[PRDUMP] noEnv', readRt());
        scene.environment = envBak;
        /* 探针5:材质替身基线 */
        scene.overrideMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
        renderer.setRenderTarget(post.rtD);
        renderer.clear(true, true, false);
        renderer.render(scene, camera);
        console.log('[PRDUMP] lambertGray', readRt());
        scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        renderer.setRenderTarget(post.rtD);
        renderer.clear(true, true, false);
        renderer.render(scene, camera);
        console.log('[PRDUMP] basicRed', readRt());
        scene.overrideMaterial = null;
        /* 探针6:关太阳/半球光,只留 env */
        sun.visible = false;
        if (PR._hemi) PR._hemi.visible = false;
        renderer.setRenderTarget(post.rtD);
        renderer.clear(true, true, false);
        renderer.render(scene, camera);
        console.log('[PRDUMP] envOnly', readRt());
        sun.visible = true;
        if (PR._hemi) PR._hemi.visible = true;
        console.log('[PRDUMP] exposure=', post.grade.u.uExposure.value, 'scale', PR.renderScale, 'cam', camera.position.y.toFixed(2));
      }
    }

    adapt(dt);
  }
})();
