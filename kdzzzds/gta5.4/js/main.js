/* main.js — 引导:渲染器/日夜循环/主循环/调试截图(F9)/验收自检(?test=1) */
window.G = window.G || {};
(function () {
  const U = G.U;
  const M = {};
  G.MAIN = M;
  G.state = { time: 0, hour: 9.5, night01: 0 };
  const $ = id => document.getElementById(id);

  /* ---------- 日夜关键帧 ---------- */
  /* [hour, skyTop, skyHor, sunCol, sunInt, hemiInt, fogCol, fogDen, night01, exposure] */
  const DAYKEYS = [
    [0.0, 0x060a18, 0x0d1526, 0x8fa8d8, 0.05, 0.16, 0x070b16, 0.0046, 1, 0.9],
    [4.5, 0x060a18, 0x0d1526, 0x8fa8d8, 0.05, 0.16, 0x070b16, 0.0046, 1, 0.9],
    [6.0, 0x2d3f66, 0xc47a4a, 0xffb066, 0.55, 0.34, 0x4a3d42, 0.0036, 0.55, 1.0],
    [7.5, 0x5c8cc4, 0xd8c4a8, 0xffe0b0, 1.35, 0.62, 0x9aa8b8, 0.0022, 0.08, 1.05],
    [12.0, 0x3d7ac4, 0xbcd4e4, 0xfff2d8, 1.75, 0.78, 0xa8bccc, 0.0015, 0, 1.05],
    [16.5, 0x4a7cba, 0xc8d0d8, 0xffe8c0, 1.5, 0.68, 0xa0b0c0, 0.0019, 0, 1.05],
    [18.3, 0x35507d, 0xe8935c, 0xff9a4d, 0.85, 0.42, 0x8a6a58, 0.0030, 0.28, 1.0],
    [19.6, 0x141d3d, 0x7d4438, 0xd86a3d, 0.22, 0.24, 0x2c1f28, 0.0042, 0.82, 0.95],
    [21.0, 0x060a18, 0x0d1526, 0x8fa8d8, 0.05, 0.16, 0x070b16, 0.0046, 1, 0.9],
    [24.0, 0x060a18, 0x0d1526, 0x8fa8d8, 0.05, 0.16, 0x070b16, 0.0046, 1, 0.9]
  ];
  const cA = new THREE.Color(), cB = new THREE.Color();
  function lerpKey(h, idx) {
    let a = DAYKEYS[0], b = DAYKEYS[DAYKEYS.length - 1];
    for (let i = 0; i < DAYKEYS.length - 1; i++) {
      if (h >= DAYKEYS[i][0] && h <= DAYKEYS[i + 1][0]) { a = DAYKEYS[i]; b = DAYKEYS[i + 1]; break; }
    }
    const t = U.ilerp(a[0], b[0], h);
    if (idx >= 4 && idx !== 6) return U.lerp(a[idx], b[idx], t);
    cA.setHex(a[idx]); cB.setHex(b[idx]);
    return cA.lerp(cB, t);
  }

  M.boot = async function () {
    const test = U.qs.test === '1';
    const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: test });
    M.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    M.scene = scene;
    scene.fog = new THREE.FogExp2(0xa8bccc, 0.0016);
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);
    M.camera = camera;
    camera.position.set(0, 30, 60);

    /* 贴图生成(进度条) */
    const bar = $('loadBar'), lt = $('loadText');
    await G.TEX.build((p, label) => { bar.style.width = (p * 100).toFixed(0) + '%'; lt.textContent = '正在生成:' + label + ' …'; });
    G.TEX.applyAniso(renderer);
    lt.textContent = '正在铺设城市 …';
    await new Promise(r => setTimeout(r, 30));

    /* 光照 */
    M.sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
    M.sun.castShadow = true;
    M.sun.shadow.mapSize.set(2048, 2048);
    M.sun.shadow.camera.left = -95; M.sun.shadow.camera.right = 95;
    M.sun.shadow.camera.top = 95; M.sun.shadow.camera.bottom = -95;
    M.sun.shadow.camera.near = 10; M.sun.shadow.camera.far = 420;
    M.sun.shadow.bias = -0.0004;
    M.sun.shadow.normalBias = 0.03;
    M.sunTarget = new THREE.Object3D();
    scene.add(M.sunTarget);
    M.sun.target = M.sunTarget;
    scene.add(M.sun);
    M.hemi = new THREE.HemisphereLight(0xbdd0e4, 0x50483e, 0.7);
    scene.add(M.hemi);

    /* 世界 */
    G.CITY.build(scene);
    G.FX.initSky(scene);
    G.FX.initEnv(scene);
    G.FX.initBloom(renderer, Math.floor(innerWidth * renderer.getPixelRatio()), Math.floor(innerHeight * renderer.getPixelRatio()));
    G.FX.initParticles(scene);
    G.FX.initSkid(scene);
    G.FX.initWater(scene);
    G.FX.initGulls(scene);
    G.FX.initLightPool(scene);
    G.PLAYER.init(scene, camera);
    G.GAME.init(scene);

    window.addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      G.FX.resize(Math.floor(innerWidth * renderer.getPixelRatio()), Math.floor(innerHeight * renderer.getPixelRatio()));
    });
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyH') G.GAME.togglePanel('help');
      if (e.code === 'KeyM') G.GAME.togglePanel('map');
      if (e.code === 'Escape') G.GAME.togglePanel(null);
      if (e.code === 'KeyL') M.cycleTime();
      if (e.code === 'F9') { e.preventDefault(); M.debugShot(); }
      if (e.code === 'Backspace' && e.ctrlKey) { e.preventDefault(); localStorage.removeItem('neonharbor_v1'); location.reload(); }
    });

    /* 时间参数 */
    if (U.qs.time === 'night') G.state.hour = 21.7;
    else if (U.qs.time === 'dusk') G.state.hour = 18.6;
    else if (U.qs.time === 'dawn') G.state.hour = 6.2;
    else if (U.qs.time === 'day') G.state.hour = 12.5;

    /* 起始遮罩 */
    if (test) {
      $('overlay').style.display = 'none';
      G.GAME.save.tut = true;
      M.running = true;
      M.loop();
      setTimeout(() => M.runTests(), 900);
    } else {
      bar.style.width = '100%';
      lt.textContent = '完成!';
      $('loadBarWrap').style.display = 'none';
      lt.style.display = 'none';
      const btn = $('startBtn');
      btn.style.display = 'block';
      btn.addEventListener('click', () => {
        G.AUDIO.init(); G.AUDIO.resume();
        if (G.GAME.save.station >= 0) G.AUDIO.setStation(G.GAME.save.station);
        $('overlay').style.opacity = 0;
        setTimeout(() => $('overlay').style.display = 'none', 650);
        M.running = true;
        M.lastT = performance.now();
        M.loop();
      }, { once: true });
    }
  };

  /* ---------- 时间控制 ---------- */
  M.cycleTime = function () {
    const presets = [12.5, 18.4, 21.7, 6.1];
    let best = 0, bd = 99;
    for (let i = 0; i < presets.length; i++) {
      const d = Math.abs(presets[i] - G.state.hour);
      if (d < bd) { bd = d; best = i; }
    }
    M.setHourSmooth(presets[(best + 1) % presets.length]);
    const names = ['正午', '黄昏', '夜晚', '拂晓'];
    G.GAME.toast('时间快进 → ' + names[(best + 1) % presets.length]);
  };
  M.setHourSmooth = function (h) { M.hourTween = { from: G.state.hour, to: h, t: 0 }; };

  /* ---------- 主循环 ---------- */
  M.lastT = performance.now();
  let fpsN = 0, fpsT = 0;
  M.loop = function () {
    if (!M.running) return;
    requestAnimationFrame(M.loop);
    const nowT = performance.now();
    let dt = Math.min(0.05, (nowT - M.lastT) / 1000);
    M.lastT = nowT;
    const st = G.state;
    st.time += dt;
    /* 时间流逝:24h = 14 分钟 */
    if (M.hourTween) {
      M.hourTween.t += dt / 2.2;
      const k = U.smooth(Math.min(1, M.hourTween.t));
      let from = M.hourTween.from, to = M.hourTween.to;
      if (to < from) to += 24;
      st.hour = (from + (to - from) * k) % 24;
      if (M.hourTween.t >= 1) M.hourTween = null;
    } else {
      st.hour = (st.hour + dt * 24 / (14 * 60)) % 24;
    }
    M.applyDaylight();
    G.CITY.updateSignals(dt);
    G.CITY.setNight(st.night01, st.time);
    G.PLAYER.update(dt);
    G.GAME.update(dt);
    const pp = G.PLAYER.playerPos();
    G.FX.update(dt, M.camera.position, pp, st.night01);
    G.FX.updateLightPool(pp.x, pp.z, st.night01);
    G.AUDIO.update(dt);
    if (M.autoTick) M.autoTick();
    /* 阳光跟随玩家 */
    M.sunTarget.position.set(pp.x, 0, pp.z);
    M.sun.position.copy(pp).addScaledVector(M.sunDirV || new THREE.Vector3(0.5, 1, 0.3), 180);
    /* 海鸥叫 */
    if (Math.random() < dt * 0.15 && pp.z > 140) G.AUDIO.gull();
    G.FX.render(M.scene, M.camera, dt);
    /* FPS */
    fpsN++; fpsT += dt;
    if (fpsT > 0.5) {
      $('fps').textContent = Math.round(fpsN / fpsT) + ' FPS';
      fpsN = 0; fpsT = 0;
    }
  };

  M.applyDaylight = function () {
    const h = G.state.hour;
    const skyTop = lerpKey(h, 1), skyHor = lerpKey(h, 2).clone();
    const sunCol = lerpKey(h, 3).clone();
    const sunInt = lerpKey(h, 4), hemiInt = lerpKey(h, 5);
    const fogCol = lerpKey(h, 6).clone();
    const fogDen = lerpKey(h, 7);
    G.state.night01 = lerpKey(h, 8);
    M.renderer.toneMappingExposure = lerpKey(h, 9);
    /* 太阳方位 */
    const sunA = (h - 6) / 12 * Math.PI;       // 6 点升起 18 点落下
    const el = Math.sin(sunA), az = Math.cos(sunA);
    const sunDir = new THREE.Vector3(az * 0.68, Math.max(0.03, el), 0.42).normalize();
    const night = G.state.night01;
    const moonDir = new THREE.Vector3(-az * 0.6, Math.max(0.18, -el * 0.8 + 0.25), -0.5).normalize();
    const lightDir = night > 0.72 ? moonDir : sunDir;
    M.sunDirV = lightDir.clone();
    M.sun.color.copy(night > 0.72 ? new THREE.Color(0x9db8e8) : sunCol);
    M.sun.intensity = night > 0.72 ? 0.30 : Math.max(0.06, sunInt);
    M.hemi.intensity = hemiInt;
    M.hemi.color.copy(skyTop).lerp(new THREE.Color(0xffffff), 0.4);
    M.scene.fog.color.copy(fogCol);
    M.scene.fog.density = fogDen;
    /* 天空 */
    const sky = G.FX.sky;
    if (sky) {
      sky.material.uniforms.top.value.copy(skyTop);
      sky.material.uniforms.hor.value.copy(skyHor);
      sky.material.uniforms.sunDir.value.copy(sunDir);
      sky.material.uniforms.sunCol.value.copy(sunCol);
      sky.material.uniforms.glow.value = 0.35 + sunInt * 0.4;
    }
    if (G.FX.stars) G.FX.starMat.opacity = U.clamp((night - 0.55) * 2.2, 0, 0.9);
    if (G.FX.sun) {
      G.FX.sun.position.copy(M.camera.position).addScaledVector(sunDir, 700);
      G.FX.sun.material.opacity = U.clamp(1 - night * 1.4, 0, 1);
      G.FX.moon.position.copy(M.camera.position).addScaledVector(moonDir, 680);
      G.FX.moon.material.opacity = U.clamp((night - 0.4) * 1.8, 0, 1);
    }
    for (const c of G.FX.clouds || []) c.material.opacity = U.lerp(0.75, 0.12, night);
    G.FX.setEnvNight(night > 0.6);
    /* Bloom 强度日夜变化 */
    if (G.FX.compMat) G.FX.compMat.uniforms.strength.value = U.lerp(0.16, 0.42, night);
    if (G.FX.brightMat) G.FX.brightMat.uniforms.thr.value = U.lerp(0.8, 0.58, night);
  };

  /* ---------- F9 四视图截图 ---------- */
  M.debugShot = function () {
    const r = M.renderer;
    const focus = G.PLAYER.mode === 'drive' && G.PLAYER.veh ? G.PLAYER.veh.root : G.PLAYER.char.group;
    const bb = new THREE.Box3().setFromObject(focus);
    const c = bb.getCenter(new THREE.Vector3());
    const size = bb.getSize(new THREE.Vector3());
    const R = Math.max(size.x, size.y, size.z) * 0.85 + 0.6;
    const views = [
      [c.x, c.y, c.z + R * 2.4], [c.x + R * 2.4, c.y, c.z],
      [c.x, c.y + R * 2.8, c.z + 0.01], [c.x + R * 1.8, c.y + R * 1.3, c.z + R * 1.8]
    ];
    const W = r.domElement.width, H = r.domElement.height;
    r.setScissorTest(true);
    for (let i = 0; i < 4; i++) {
      const vx = (i % 2) * W / 2, vy = (1 - Math.floor(i / 2)) * H / 2;
      r.setViewport(vx, vy, W / 2, H / 2);
      r.setScissor(vx, vy, W / 2, H / 2);
      const cam = new THREE.OrthographicCamera(-R * 1.4 * (W / H), R * 1.4 * (W / H), R * 1.4, -R * 1.4, 0.1, 400);
      cam.position.set(views[i][0], views[i][1], views[i][2]);
      cam.lookAt(c);
      r.render(M.scene, cam);
    }
    r.setScissorTest(false);
    r.setViewport(0, 0, W, H);
    try {
      const a = document.createElement('a');
      a.download = 'neonharbor_4view_' + Date.now() + '.png';
      a.href = r.domElement.toDataURL('image/png');
      a.click();
      G.GAME.toast('已保存四视图截图(前/侧/顶/45°)');
    } catch (e) { G.GAME.toast('截图失败:' + e.message); }
  };

  /* ---------- 自检(?test=1) ---------- */
  M.runTests = function () {
    const out = [];
    const bad = [];
    const ok = (cond, label) => { out.push((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) bad.push(label); };
    try {
      ok(G.U.errors.length === 0, '零报错 (' + G.U.errors.join(';') + ')');
      const pot = v => (v & (v - 1)) === 0;
      let allPot = true;
      for (const t of G.TEX.all) { const img = t.image; if (img && img.width && (!pot(img.width) || !pot(img.height))) allPot = false; }
      ok(allPot, '贴图全部 2 的幂 (' + G.TEX.all.length + ' 张)');
      const hero = G.GAME.heroCar;
      const bb = new THREE.Box3().setFromObject(hero.root);
      const size = bb.getSize(new THREE.Vector3());
      ok(Math.abs(size.z - 4.7) < 0.35 && Math.abs(size.x - 1.8) < 0.35, '轿车尺寸 ' + size.z.toFixed(2) + '×' + size.x.toFixed(2));
      let wheelsOK = true;
      for (const w of hero.wheels) {
        const wb = new THREE.Box3().setFromObject(w.steerG);
        if (Math.abs(wb.min.y - hero.root.position.y) > 0.05) wheelsOK = false;
      }
      ok(wheelsOK, '四轮触地');
      const cb = new THREE.Box3().setFromObject(G.PLAYER.char.mesh);
      const cs = cb.getSize(new THREE.Vector3());
      ok(Math.abs(cs.y - 1.75) < 0.08, '角色身高 ' + cs.y.toFixed(2));
      ok(G.CITY.hash.boxes.length > 150, '碰撞体数量 ' + G.CITY.hash.boxes.length);
      const rt = G.CITY.route(G.CITY.spawn[0], G.CITY.spawn[1], 0, 258);
      ok(rt.length >= 3, 'GPS 路径 ' + rt.length + ' 点');
      /* 真实渲染统计 + 像素探针 */
      const camSave = { p: M.camera.position.clone(), q: M.camera.quaternion.clone() };
      if (G.state.night01 > 0.7) {
        M.camera.position.set(G.CITY.markers.hotel[0] - 26, 15, G.CITY.markers.hotel[1] + 38);
        M.camera.lookAt(G.CITY.markers.hotel[0] + 4, 24, G.CITY.markers.hotel[1] - 18);
        M.camera.updateMatrixWorld(true);
      }
      M.renderer.info.autoReset = false;
      M.renderer.info.reset();
      G.FX.render(M.scene, M.camera, 0.016);
      const info = M.renderer.info.render;
      ok(info.calls < 1300, 'DrawCalls ' + info.calls);
      ok(info.triangles < 1800000, '三角形 ' + info.triangles);
      M.renderer.info.autoReset = true;
      const gl = M.renderer.getContext();
      const W2 = gl.drawingBufferWidth, H2 = gl.drawingBufferHeight;
      const px = new Uint8Array(W2 * H2 * 4);
      gl.readPixels(0, 0, W2, H2, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0, black = 0, bright = 0, n = 0, sum2 = 0;
      for (let i = 0; i < px.length; i += 40) {
        const l = (px[i] + px[i + 1] + px[i + 2]) / 3;
        sum += l; sum2 += l * l; n++;
        if (l < 8) black++;
        if (l > 200) bright++;
      }
      const mean = sum / n, sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
      out.push(`PROBE mean=${mean.toFixed(1)} sd=${sd.toFixed(1)} black%=${(black / n * 100).toFixed(1)} bright%=${(bright / n * 100).toFixed(2)}`);
      ok(mean > 14 && mean < 235, '画面亮度正常');
      ok(sd > 12, '画面层次(方差 ' + sd.toFixed(1) + ')');
      if (G.state.night01 > 0.7) ok(bright / n > 0.001, '夜景发光体存在');
      ok(G.state.night01 != null, '昼夜系统');
      /* 多视角构图探针 */
      const R3 = G.CITY.roadAt(3);
      const vps = [
        ['街景', [R3 + 2, 2.0, R3 - 34], [R3, 3, R3], 25, 190],
        ['广场', [G.CITY.spawn[0] + 14, 8, G.CITY.spawn[1] + 16], [G.CITY.spawn[0] - 10, 2, G.CITY.spawn[1] - 20], 25, 200],
        ['码头', [-34, 7, 206], [0, 10, 247], 18, 200],
        ['俯瞰', [-140, 130, -140], [40, 0, 40], 30, 210]
      ];
      for (const [name, pos, look, lo, hi] of vps) {
        M.camera.position.set(pos[0], pos[1], pos[2]);
        M.camera.lookAt(look[0], look[1], look[2]);
        M.camera.updateMatrixWorld(true);
        G.FX.render(M.scene, M.camera, 0.016);
        gl.readPixels(0, 0, W2, H2, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let s2 = 0, ss = 0, nn = 0;
        for (let i = 0; i < px.length; i += 40) { const l = (px[i] + px[i + 1] + px[i + 2]) / 3; s2 += l; ss += l * l; nn++; }
        const m2 = s2 / nn, sd2 = Math.sqrt(Math.max(0, ss / nn - m2 * m2));
        out.push(`VIEW ${name} mean=${m2.toFixed(1)} sd=${sd2.toFixed(1)}`);
        const dayOk = G.state.night01 < 0.5 ? (m2 > lo && m2 < hi) : m2 > 6;
        ok(dayOk && sd2 > 14, '视角[' + name + ']有内容');
      }
      M.camera.position.copy(camSave.p);
      M.camera.quaternion.copy(camSave.q);
    } catch (e) {
      bad.push('EXC');
      out.push('EXC ' + e.message + (e.stack || '').split('\n')[1]);
    }
    const pre = document.createElement('pre');
    pre.id = 'testout';
    pre.style.cssText = 'position:fixed;left:6px;bottom:6px;color:#9f9;background:#000c;font:12px monospace;padding:6px;z-index:999;margin:0;';
    pre.textContent = out.join('\n');
    document.body.appendChild(pre);
    document.title = bad.length ? 'FAIL' : 'READY';
    /* 自动驾驶回归(?auto=drive,同步物理步进,不依赖渲染帧) */
    if (U.qs.auto === 'drive') {
      const hero = G.GAME.heroCar;
      const app = s => { pre.textContent += '\n' + s; };
      try {
        G.PLAYER.char.group.position.set(hero.sim.x + 2.6, 0.1, hero.sim.z + 0.5);
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
        app('afterE mode=' + G.PLAYER.mode);
        for (let i = 0; i < 44; i++) G.PLAYER.update(0.05);          // 进车动画 ~2.2s
        app('afterEnter mode=' + G.PLAYER.mode);
        G.PLAYER.keys.KeyW = true;
        for (let i = 0; i < 110; i++) { G.PLAYER.update(0.05); G.GAME.update(0.05); }
        const sp1 = G.PLAYER.speedKmh || 0;
        app('speed1=' + sp1.toFixed(1));
        G.PLAYER.keys.Space = true; G.PLAYER.keys.KeyA = true;
        for (let i = 0; i < 60; i++) G.PLAYER.update(0.05);
        const s = hero.sim;
        app('speed2=' + (G.PLAYER.speedKmh || 0).toFixed(1) + ' drift=' + G.PLAYER.driftScore.toFixed(0));
        app('pos=' + s.x.toFixed(1) + ',' + s.z.toFixed(1) + ' onIsland=' + !G.CITY.isWater(s.x, s.z));
        G.PLAYER.keys.KeyW = G.PLAYER.keys.Space = G.PLAYER.keys.KeyA = false;
        /* 下车回归 */
        for (let i = 0; i < 80; i++) G.PLAYER.update(0.05);
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
        for (let i = 0; i < 40; i++) G.PLAYER.update(0.05);
        app('afterExit mode=' + G.PLAYER.mode);
        const good = sp1 > 12 && G.PLAYER.mode === 'walk' && !isNaN(s.x) && !isNaN(s.vx) && !G.CITY.isWater(s.x, s.z) && G.U.errors.length === 0;
        app(good ? 'AUTO PASS' : 'AUTO FAIL errs=' + G.U.errors.join('|'));
        document.title = good && !bad.length ? 'READY' : 'FAIL';
      } catch (e) {
        app('AUTO EXC ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]);
        document.title = 'FAIL';
      }
    }
    /* 定点镜头(截图模式) */
    const shot = U.qs.shot;
    if (shot) {
      G.MAIN.hourTween = null;
      if (shot === 'city') { M.camera.position.set(-60, 46, 150); M.camera.lookAt(30, 10, 0); }
      if (shot === 'night' || shot === 'hotel') { M.camera.position.set(G.CITY.markers.hotel[0] - 30, 16, G.CITY.markers.hotel[1] + 42); M.camera.lookAt(G.CITY.markers.hotel[0] + 6, 22, G.CITY.markers.hotel[1] - 20); }
      if (shot === 'harbor') { M.camera.position.set(-80, 20, 180); M.camera.lookAt(0, 8, 252); }
      if (shot === 'street') { M.camera.position.set(G.CITY.roadAt(3) + 3, 2.2, G.CITY.roadAt(4) - 20); M.camera.lookAt(G.CITY.roadAt(3), 3, G.CITY.roadAt(3)); }
      M.camOverride = true;
      const p = M.camera.position.clone();
      const q = M.camera.quaternion.clone();
      const guard = () => { M.camera.position.copy(p); M.camera.quaternion.copy(q); requestAnimationFrame(guard); };
      requestAnimationFrame(guard);
    }
  };

  window.addEventListener('load', () => {
    M.boot().catch(e => {
      G.U.errors.push('boot:' + e.message);
      const el = $('verr');
      el.style.display = 'block';
      el.textContent = '启动失败: ' + e.message + '\n' + (e.stack || '');
      document.title = 'FAIL';
    });
  });
})();
