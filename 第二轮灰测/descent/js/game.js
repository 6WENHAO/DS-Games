/* ============================================================
   game.js — 状态机 / 输入 / 关卡生成 / HUD / 结算
   ============================================================ */
(function () {
  'use strict';

  const $ = u.$;
  const KEY = {};
  const S = {
    mode: 'menu',
    planet: null, st: null,
    yaw: 0, pitch: -1.05, roll: 0,
    fov: 76, tanF: 1,
    time: 0, wallT: 0, warp: 1,
    body: 0.45, bodyTarget: 0.45,
    turb: 0, stress: 0, gloc: 0, crack: 0, white: 0, flash: 0,
    beacons: [], hazards: [], got: 0, events: [],
    under: false, depth: 0, sinkV: 0, floatT: 0,
    endT: 0, ending: null, done: false,
    windOfs: 0, shakeY: 0, shakeP: 0,
    fps: 60, frames: 0, fpsT: 0, scale: 1, qual: 0.55,
    hudTick: 0, muted: false, lastMach: 0,
    nextBolt: 3, hazActive: null, hazTimer: 0,
    subT: 0, dpr: 1, freeze: false, diag: null,
    auto: false, turbo: 0, autoQueue: [], autoSx: 0, autoSz: 0, impactV: 0
  };

  let gl, fx, snd, glCanvas, fxCanvas;
  let best = {};

  /* ---------------- 启动 ---------------- */
  function boot() {
    glCanvas = $('#gl'); fxCanvas = $('#fx');
    gl = new GLView(glCanvas);
    fx = new FX(fxCanvas);
    snd = new SoundEngine();
    try { best = JSON.parse(localStorage.getItem('descent.best') || '{}'); } catch (e) { best = {}; }
    buildTape();
    buildMenu();
    bindInput();
    menuScene();
    const q = new URLSearchParams(location.search);
    if (q.get('diag')) setupDiag(q);
    else if (q.get('auto')) setupAuto(q);
    requestAnimationFrame(frame);
  }

  /* ---------------- 菜单 ---------------- */
  function buildMenu() {
    const grid = $('#planetGrid');
    grid.innerHTML = '';
    PLANETS.list.forEach((p, i) => {
      const vt = Math.sqrt(2 * Phys.M * p.g / (p.rho0 * 1.06));
      const vc = Math.sqrt(2 * Phys.M * p.g / (p.rho0 * Phys.CHUTE_CDA));
      if (p._pred === undefined) p._pred = Phys.simPath(p);
      const mins = p._pred.t / 60;
      const d = document.createElement('div');
      d.className = 'pcard';
      const b = best[p.id];
      d.innerHTML =
        '<div class="swatch" style="background:linear-gradient(160deg,' + p.accent[0] + ',' + p.accent[1] + ')"></div>' +
        (b ? '<div class="best">' + b.rank + '</div>' : '') +
        '<h3>' + p.name + '</h3><div class="sub">' + p.sub + ' · ' + p.gLabel + '</div>' +
        '<p>' + p.desc + '</p>' +
        '<div class="stats"><span>入口 <i>' + (p.startAlt / 1000).toFixed(0) + ' km</i></span>' +
        '<span>展开终速 <i>' + vt.toFixed(0) + ' m/s</i></span>' +
        '<span>伞下 <i>' + vc.toFixed(1) + ' m/s</i></span>' +
        '<span>全程 <i>≈' + (mins < 1 ? (mins * 60).toFixed(0) + ' 秒' : mins.toFixed(1) + ' 分') + '</i></span></div>' +
        '<div class="diff">' + p.diff + '</div>';
      d.addEventListener('click', () => { snd.init(); snd.uiClick(); startRun(p); });
      grid.appendChild(d);
    });
  }

  /* 菜单背景：一个活的星球场景 */
  function menuScene() {
    const p = PLANETS.byId('thalassa');
    S.planet = p;
    S.st = Phys.mk(p);
    S.st.alt = 9200; S.st.vy = -46; S.st.speed = 46;
    S.st.rho = u.density(9200, p.rho0, p.H);
    S.st.q = 0.5 * S.st.rho * 46 * 46;
    S.st.shellT = 250; S.st.heat = 0;
    S.pitch = -0.42; S.yaw = 0.6;
    S.beacons = []; S.hazards = [];   /* 清掉上一局残留的标记 */
    fx.setPlanet(p);
  }

  function buildTape() {
    const t = $('#tapeInner');
    t.innerHTML = '';
    for (let i = 0; i < 11; i++) t.appendChild(document.createElement('div'));
  }

  /* ---------------- 关卡生成 ---------------- */
  function buildLevel(p) {
    const pred = Phys.simPath(p);
    const path = pred.path;
    const at = alt => {
      let bestI = 0, bd = 1e18;
      for (let i = 0; i < path.length; i++) { const d = Math.abs(path[i].alt - alt); if (d < bd) { bd = d; bestI = i; } }
      return path[bestI] || { x: 0, z: 0, alt: alt };
    };
    const r = u.rng(1337 + p.id.length * 977 + Math.floor(p.g * 100));
    /* 信标 */
    S.beacons = [];
    const top = p.startAlt * 0.55;
    const bot = p.objective.type === 'depth' ? 14000 : Math.max(p.startAlt * 0.05, 600);
    for (let i = 0; i < p.beacons; i++) {
      const t = p.beacons > 1 ? i / (p.beacons - 1) : 0;
      const a = u.lerp(bot, top, Math.pow(1 - t, 1.55));
      const base = at(a);
      const ang = r() * 6.283, rad = 60 + r() * 190;
      S.beacons.push({ alt: a, x: base.x + Math.cos(ang) * rad, z: base.z + Math.sin(ang) * rad, got: false });
    }
    /* 危险区 */
    S.hazards = [];
    const H = p.hazard;
    for (let i = 0; i < H.count; i++) {
      const a = u.lerp(H.altLo * 1000, H.altHi * 1000, r());
      const base = at(a);
      const ang = r() * 6.283, rad = H.r * 0.55 + r() * (H.r * 1.3 + H.spread * 0.25);
      const band = H.type === 'shear' ? 900 : 1500;
      S.hazards.push({
        x: base.x + Math.cos(ang) * rad, z: base.z + Math.sin(ang) * rad,
        alt: a, a0: a - band, a1: a + band, r: H.r * (0.7 + r() * 0.6), type: H.type, str: H.str, hit: 0
      });
    }
    S.pred = pred;
  }

  /* ---------------- 开始 / 重置 ---------------- */
  function startRun(p) {
    S.planet = p;
    S.st = Phys.mk(p);
    S.yaw = 0; S.pitch = -1.0; S.roll = 0;
    S.body = 0.45; S.bodyTarget = 0.45;
    S.turb = 0; S.stress = 0; S.gloc = 0; S.crack = 0; S.white = 0; S.flash = 0;
    S.time = 0; S.warp = 1; S.got = 0; S.under = false; S.depth = 0; S.sinkV = 0; S.floatT = 0;
    S.ending = null; S.endT = 0; S.done = false; S.freeze = false; S.windOfs = 0;
    S.lastMach = S.st.mach; S.nextBolt = 2 + Math.random() * 3;
    S.events = p.events.map(e => ({ a: e.a * 1000, t: e.t, done: false }));
    S.autoLastLog = -1;
    buildLevel(p);
    fx.setPlanet(p);
    snd.init();
    snd.setAlarm(0);
    $('#menu').classList.add('hidden');
    $('#result').classList.add('hidden');
    $('#pause').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    $('#objVal').textContent = p.objective.label;
    $('#planetName').textContent = p.name;
    $('#planetSub').textContent = p.sub;
    S.mode = 'play';
    lock();
    say('<b>' + p.name + '</b> · ' + p.objective.label, 5);
  }

  function toMenu() {
    S.mode = 'menu';
    $('#menu').classList.remove('hidden');
    $('#hud').classList.add('hidden');
    $('#result').classList.add('hidden');
    $('#pause').classList.add('hidden');
    $('#clickToStart').classList.add('hidden');
    snd.setAlarm(0);
    if (document.pointerLockElement) document.exitPointerLock();
    menuScene();
    buildMenu();
  }

  /* ---------------- 输入 ---------------- */
  function lock() {
    if (glCanvas.requestPointerLock) {
      const pr = glCanvas.requestPointerLock();
      if (pr && pr.catch) pr.catch(() => { });
    }
  }
  function bindInput() {
    window.addEventListener('keydown', e => {
      if (e.repeat) { KEY[e.code] = true; return; }
      KEY[e.code] = true;
      if (e.code === 'Escape') {
        if (S.mode === 'play') { S.mode = 'pause'; $('#pause').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock(); }
        else if (S.mode === 'pause' || S.mode === 'result') toMenu();
      }
      if (e.code === 'KeyM') { S.muted = !S.muted; snd.setMute(S.muted); }
      if (S.mode === 'play') {
        if (e.code === 'Space') { e.preventDefault(); toggleChute(); }
        if (e.code === 'KeyT') cycleWarp();
        if (e.code === 'KeyR') startRun(S.planet);
      } else if (S.mode === 'result') {
        if (e.code === 'KeyR') startRun(S.planet);
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', e => { KEY[e.code] = false; });
    window.addEventListener('mousemove', e => {
      if (S.mode !== 'play') return;
      if (document.pointerLockElement !== glCanvas && !e.buttons) return;
      const sx = 0.0021, mx = e.movementX || 0, my = e.movementY || 0;
      S.yaw += mx * sx;   /* 鼠标右移 → 视角右转（此前写反） */
      S.pitch = u.clamp(S.pitch - my * sx, -1.553, 1.553);
    });
    window.addEventListener('mousedown', e => {
      if (S.mode === 'pause') { S.mode = 'play'; $('#pause').classList.add('hidden'); lock(); return; }
      if (S.mode === 'play' && document.pointerLockElement !== glCanvas) lock();
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === glCanvas;
      $('#clickToStart').classList.toggle('hidden', locked || S.mode !== 'play');
    });
    $('#btnRetry').addEventListener('click', () => { snd.uiClick(); startRun(S.planet); });
    $('#btnMenu').addEventListener('click', () => { snd.uiClick(); toMenu(); });
    window.addEventListener('blur', () => {
      if (S.mode === 'play' && !S.auto && !S.diag) { S.mode = 'pause'; $('#pause').classList.remove('hidden'); }
    });
  }

  function toggleChute() {
    const st = S.st, p = S.planet;
    if (st.chuteState === 0) {
      if (st.q > Phys.Q_DEPLOY) {
        st.chuteState = 3; snd.chuteTear(); fx.hit(0.5);
        st.hp = Math.max(0, st.hp - 12);
        say('<b>伞被撕裂了。</b>动压 ' + Math.round(st.q) + ' Pa —— 上限 ' + Phys.Q_DEPLOY + ' Pa。', 4.5);
        warnFlash();
      } else {
        st.chuteState = 1; st.chuteT = 0; snd.chuteCrack();
        say('伞已张开。', 2.5);
      }
    } else if (st.chuteState === 1 || st.chuteState === 2) {
      st.chuteState = 4; st.chute = 0; snd.chuteTear();
      say('已割伞。', 2);
    }
  }
  function warpAllowed() {
    const st = S.st;
    return st.heat < 0.06 && !S.hazActive && st.alt > 700 && st.chuteState !== 1;
  }
  function cycleWarp() {
    if (!warpAllowed()) { S.warp = 1; snd.beep(300, 0.08, 0.08); say('当前状态不能加速时间。', 1.6); return; }
    S.warp = S.warp === 1 ? 2 : S.warp === 2 ? 4 : S.warp === 4 ? 8 : 1;
    snd.beep(880 + S.warp * 40, 0.05, 0.09);
  }
  function warnFlash() { fx.hit(0.35); }

  /* ---------------- 字幕 ---------------- */
  function say(html, secs) {
    const el = $('#subtitle');
    el.innerHTML = html;
    el.classList.add('show');
    S.subT = secs || 3;
  }

  /* ---------------- 自动驾驶（无人值守回归测试） ---------------- */
  function autoInput(dt) {
    const st = S.st, p = S.planet;
    const vtSpread = Math.sqrt(2 * Phys.M * p.g / (p.rho0 * Phys.CD_SPREAD));
    const needChute = p.objective.type !== 'depth' && vtSpread > p.objective.safe * 0.9;
    const flare = needChute ? u.clamp(78 * vtSpread, 1800, 5600) : 600;
    let body = 1;
    if (st.shellT < 1400 && st.mach < 1.3 && st.alt > flare * 2.2) body = -0.85;
    if (st.shellT > 1750) body = 1;
    S.bodyTarget = body;
    S.body = u.lerp(S.body, body, 1 - Math.exp(-dt * 4));
    if (needChute && st.chuteState === 0 && st.alt < flare * 1.6 && st.q < Phys.Q_DEPLOY * 0.85) toggleChute();
    let bx = 0, bz = 0, found = false, bestC = 1e18;
    for (let i = 0; i < S.beacons.length; i++) {
      const b = S.beacons[i];
      if (b.got || b.alt > st.alt + 150) continue;
      const dh = Math.hypot(b.x - st.x, b.z - st.z);
      const cost = dh + 0.03 * Math.abs(st.alt - b.alt);
      if (cost < bestC) { bestC = cost; bx = b.x - st.x; bz = b.z - st.z; found = true; }
    }
    if (found) {
      const l = Math.hypot(bx, bz) || 1;
      S.autoSx = bx / l; S.autoSz = bz / l;
      S.yaw = Math.atan2(bx, bz);
    } else { S.autoSx = 0; S.autoSz = 0; }
    let hz = S.hazActive;
    if (!hz) {
      for (let i = 0; i < S.hazards.length; i++) {
        const h = S.hazards[i];
        if (h.alt < st.alt + 250 && h.alt > st.alt - 2600) {
          const d = Math.hypot(st.x - h.x, st.z - h.z);
          if (d < h.r * 1.9 + 400) { hz = h; break; }
        }
      }
    }
    if (hz) {
      const dx = st.x - hz.x, dz = st.z - hz.z, l = Math.hypot(dx, dz) || 1;
      S.autoSx = dx / l; S.autoSz = dz / l;
    }
  }

  function setupAuto(q) {
    const id = q.get('auto');
    S.auto = true;
    S.turbo = parseInt(q.get('turbo') || '0', 10) || 0;
    S.autoQueue = (id === 'all') ? PLANETS.list.slice() : [PLANETS.byId(id) || PLANETS.list[0]];
    $('#diag').classList.remove('hidden');
    $('#diag').textContent = 'AUTO turbo=' + S.turbo + ' queue=' + S.autoQueue.map(p => p.id).join(',');
    startRun(S.autoQueue.shift());
  }

  function autoReport(line) {
    const d = $('#diag');
    d.classList.remove('hidden');
    d.textContent += '\n' + line;
  }

  /* ---------------- 主循环 ---------------- */
  let last = 0;
  function frame(ts) {
    const raw = last ? (ts - last) / 1000 : 0.016;
    last = ts;
    const dt = u.clamp(raw, 0.0005, 0.05);
    S.frames++; S.fpsT += dt;
    if (S.fpsT > 0.5) { S.fps = S.frames / S.fpsT; S.frames = 0; S.fpsT = 0; autoQuality(); }

    if (S.mode === 'play') {
      if (S.auto && S.turbo) { for (let k = 0; k < S.turbo && S.mode === 'play'; k++) update(0.05); }
      else update(dt);
    }
    else if (S.mode === 'diag') { S.time = S.diag.t; }
    else if (S.mode === 'menu') { S.time += dt * 0.6; S.yaw += dt * 0.013; S.windOfs += dt * 0.004; }
    else { S.time += dt * 0.3; }
    /* 自动测试模式下大幅跳过渲染，以便快速跑完全程（仍每 25 帧渲染一次做冒烟测试） */
    S.frameNo = (S.frameNo || 0) + 1;
    if (!(S.auto && S.turbo) || S.frameNo % 25 === 0) render(dt);
    requestAnimationFrame(frame);
  }

  function autoQuality() {
    if (S.mode !== 'play') return;
    if (S.fps < 40 && S.scale > 0.5) { S.scale = Math.max(0.5, S.scale - 0.12); gl.scale = S.scale; S.qual = Math.max(0.15, S.qual - 0.15); }
    else if (S.fps > 57 && S.scale < 1) { S.scale = Math.min(1, S.scale + 0.05); gl.scale = S.scale; S.qual = Math.min(0.85, S.qual + 0.05); }
  }

  /* ---------------- 更新 ---------------- */
  function update(dt) {
    const p = S.planet, st = S.st;
    const sdt = dt * S.warp;
    S.time += sdt;
    S.subT -= dt;
    if (S.subT <= 0) $('#subtitle').classList.remove('show');

    if (S.freeze) {
      S.endT += dt;
      postEnd(dt);
      if (!(S.auto && S.turbo)) updateHUD(dt);
      return;
    }

    /* ---- 输入 ---- */
    let sf = 0, sr = 0;
    if (S.auto) {
      autoInput(dt);
    } else {
      const dive = KEY['ShiftLeft'] || KEY['ShiftRight'];
      if (KEY['KeyW']) S.bodyTarget -= dt * 1.5;
      if (KEY['KeyS']) S.bodyTarget += dt * 1.5;
      S.bodyTarget = u.clamp(S.bodyTarget, -1, 1);
      const target = dive ? -1 : S.bodyTarget;
      S.body = u.lerp(S.body, target, 1 - Math.exp(-dt * 4.5));
      if (KEY['KeyA'] || KEY['ArrowLeft']) sr -= 1;
      if (KEY['KeyD'] || KEY['ArrowRight']) sr += 1;
      if (KEY['ArrowUp']) sf += 1;
      if (KEY['ArrowDown']) sf -= 1;
      if (KEY['MouseL']) sf += 1;
    }
    const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
    let sx = S.auto ? S.autoSx : sr * cy + sf * sy;
    let sz = S.auto ? S.autoSz : -sr * sy + sf * cy;
    const sl = Math.hypot(sx, sz);
    if (sl > 1) { sx /= sl; sz /= sl; }

    /* ---- 物理子步 ---- */
    const n = Math.min(8, Math.max(1, Math.ceil(sdt / 0.018)));
    const h = sdt / n;
    const inp = { body: S.body, sx: sx, sz: sz };
    for (let i = 0; i < n; i++) {
      const prevAlt = st.alt;
      Phys.step(st, p, h, inp);
      checkBeacons(prevAlt, st);
      if (endCheck()) break;
    }
    S.windOfs += (Math.abs(st.windX) * 0.6 + 6) * sdt / 1000;

    /* ---- 危险区 ---- */
    hazardUpdate(dt);

    /* ---- 湍流 / 抖动 ---- */
    const qn = u.clamp(st.q / 3600, 0, 1.4);
    const inCloud = cloudFactor(st.alt);
    let turb = 0.14 * qn + 0.42 * inCloud * qn + (st.chute > 0 ? 0.20 * st.chute * qn : 0) + p.wind.gust / 60;
    if (S.hazActive) turb += 0.55 * S.hazActive.str;
    if (st.heat > 0.2) turb += 0.3 * st.heat;
    S.turb = u.clamp(u.lerp(S.turb, turb, 1 - Math.exp(-dt * 3)), 0, 1.2);
    const sh = S.turb * 0.030 + st.heat * 0.008;
    S.shakeY = u.fbm1(S.time * 7.3) * sh;
    S.shakeP = u.fbm1(S.time * 6.1 + 40) * sh;
    S.roll = u.lerp(S.roll, u.fbm1(S.time * 2.2 + 9) * S.turb * 0.28 + sr * 0.10, 1 - Math.exp(-dt * 3));

    /* ---- 压力 / 过载黑视 ---- */
    const stress = u.clamp(
      0.35 * u.inv(2, 9, st.gForce) + 0.4 * st.heat + 0.35 * (1 - st.hp / 100) +
      0.3 * u.inv(3000, 300, st.alt) * u.inv(20, 90, st.speed) + (S.hazActive ? 0.3 : 0), 0, 1);
    S.stress = u.lerp(S.stress, stress, 1 - Math.exp(-dt * 1.5));
    const glocT = u.clamp((st.gForce - 6.5) / 5, 0, 1);
    S.gloc = u.clamp(S.gloc + (glocT > 0 ? glocT * dt * 0.85 : -dt * 0.55), 0, 1);
    if (S.gloc > 0.55) { S.body = u.lerp(S.body, 0.1, dt); }   // 快黑视时失去精细控制

    /* ---- 雷电 ---- */
    if (p.lightning > 0) {
      S.nextBolt -= dt * (1 + (S.hazActive && S.hazActive.type === 'storm' ? 4 : 0)) * p.lightning;
      if (S.nextBolt <= 0) {
        S.nextBolt = 1.2 + Math.random() * (S.hazActive ? 2.5 : 9);
        const near = S.hazActive ? 0.1 + Math.random() * 0.3 : 0.45 + Math.random() * 0.55;
        const a = Math.random() * 6.283;
        fx.lightning([Math.cos(a) * 0.8, -0.3 - Math.random() * 0.4, Math.sin(a) * 0.8], 1 - near * 0.75);
        snd.thunder(near);
      }
    }

    /* ---- 音障 ---- */
    if (S.lastMach > 1 && st.mach <= 1 && st.rho > 0.002) snd.machBoom();
    S.lastMach = st.mach;

    /* ---- 告警 ---- */
    const crit = st.shellT > Phys.T_MAX || st.gForce > 8.5 || st.hp < 30 ||
      (st.alt < 1400 && st.chute === 0 && st.speed > p.objective.safe * 2.2 && p.objective.type !== 'depth');
    snd.setAlarm(crit ? 2 : (st.shellT > 1450 || st.hp < 60 || S.hazActive ? 1 : 0));

    /* ---- 事件字幕 ---- */
    for (let i = 0; i < S.events.length; i++) {
      const e = S.events[i];
      if (!e.done && st.alt <= e.a) { e.done = true; say(e.t, 5.5); }
    }

    /* ---- 时间加速自动解除 ---- */
    if (S.warp > 1 && !warpAllowed()) { S.warp = 1; snd.beep(320, 0.09, 0.09); }

    /* ---- 自动测试进度 ---- */
    if (S.auto) {
      const seg = Math.floor(st.time / 45);
      if (seg > (S.autoLastLog === undefined ? -1 : S.autoLastLog)) {
        S.autoLastLog = seg;
        autoReport('  .. ' + p.id + ' t=' + st.time.toFixed(0) + 's alt=' + (st.alt / 1000).toFixed(1) + 'km v=' + st.speed.toFixed(0) + ' T=' + Math.round(st.shellT) + ' hp=' + Math.round(st.hp) + ' chute=' + st.chuteState + ' bc=' + S.got);
      }
      if (st.time > 1800) { autoReport('  !! ' + p.id + ' TIMEOUT'); finish('breach'); }
    }

    /* ---- 声音 ---- */
    if (!(S.auto && S.turbo)) snd.update({
      q: st.q, speed: st.relSpeed, heat: st.heat, turb: u.clamp(S.turb, 0, 1),
      chute: st.chute, stress: S.stress, under: S.under, dead: !!S.ending, audio: p.audio
    }, dt);

    if (!(S.auto && S.turbo)) updateHUD(dt);
  }

  /* 高度处于云层内的程度 0..1 */
  function cloudFactor(altM) {
    const p = S.planet, a = altM / 1000;
    let f = 0;
    for (let i = 0; i < p.layers.length; i++) {
      const L = p.layers[i];
      if (L.thick <= 0) continue;
      if (a > L.base && a < L.base + L.thick) f = Math.max(f, Math.min(1, L.dens));
    }
    return f;
  }

  function checkBeacons(prevAlt, st) {
    for (let i = 0; i < S.beacons.length; i++) {
      const b = S.beacons[i];
      if (b.got) continue;
      if (prevAlt > b.alt && st.alt <= b.alt) {
        const dx = st.x - b.x, dz = st.z - b.z;
        if (Math.hypot(dx, dz) < 120) {
          b.got = true; S.got++; snd.beacon();
          say('信标 <b>' + S.got + '/' + S.beacons.length + '</b> 已采集', 1.4);
        }
      }
    }
  }

  function hazardUpdate(dt) {
    const st = S.st;
    let act = null, bestD = 1e18;
    for (let i = 0; i < S.hazards.length; i++) {
      const h = S.hazards[i];
      if (st.alt < h.a0 || st.alt > h.a1) continue;
      const d = Math.hypot(st.x - h.x, st.z - h.z);
      if (d < h.r && d < bestD) { bestD = d; act = h; }
    }
    const was = S.hazActive;
    S.hazActive = act;
    if (act && !was) {
      const names = { storm: '进入雷暴单体', thermal: '进入上升热柱', shear: '进入风切变', debris: '进入冰晶飑线', calm: '进入甲烷雨幕' };
      say('<b>' + (names[act.type] || '危险区') + '</b>', 3);
      snd.gust(0.9);
    }
    if (!act) return;
    const k = dt * act.str;
    act.cool = Math.max(0, (act.cool || 0) - dt);
    if (act.type === 'storm') {
      st.hp -= k * 0.25;
      if (act.cool <= 0 && Math.random() < dt * 0.05) {
        act.cool = 4 + Math.random() * 6;
        st.hp -= 5 + Math.random() * 7; fx.hit(0.7); snd.hit(1); snd.thunder(0.03);
        fx.lightning([0, -0.5, 0.5], 1.2);
        say('<b>雷击。</b>外壳过电。', 2.5);
      }
    } else if (act.type === 'thermal') {
      st.shellT += 420 * k;
      /* 上升热柱：给一个有上限的上升气流，绝不把人无限抬起来 */
      if (st.vy < 4) st.vy = Math.min(4, st.vy + 9 * k);
    } else if (act.type === 'shear') {
      /* 风切变：有限的横向冲击（约 1.2 G 量级） */
      st.vx += (act.x > st.x ? 1 : -1) * 12 * k;
      st.vz += (act.z > st.z ? -1 : 1) * 10 * k;
      if (act.cool <= 0) { act.cool = 2.5; snd.gust(0.7); }
    } else if (act.type === 'debris') {
      st.hp -= k * 0.5;
      if (Math.random() < dt * 1.6) { fx.hit(0.18); snd.hit(0.3); }
    } else {
      st.vy -= 2.5 * k;
    }
    if (st.hp < 0) st.hp = 0;
  }

  /* ---------------- 结束判定 ---------------- */
  function endCheck() {
    const st = S.st, p = S.planet;
    if (S.ending) return true;
    if (st.hp <= 0) { finish('breach'); return true; }
    if (p.objective.type === 'depth') {
      if (st.alt <= p.objective.target) { finish('uplink'); return true; }
      if (st.alt <= p.objective.crush) { finish('crush'); return true; }
      return false;
    }
    if (st.alt <= 0) {
      st.alt = 0;
      finish(p.objective.type === 'splash' ? 'splash' : 'ground');
      return true;
    }
    return false;
  }

  function finish(kind) {
    const st = S.st, p = S.planet;
    S.ending = kind; S.endT = 0;
    S.impactV = Math.abs(st.vy) + 0.35 * Math.hypot(st.vx, st.vz);
    snd.setAlarm(0);
    if (kind === 'splash') {
      S.under = true; S.depth = 0;
      S.sinkV = Math.min(Math.abs(st.vy) * 0.55, 42);
      snd.splash(st.speed);
      fx.hit(0.25);
      S.freeze = true;
      say(st.speed <= p.objective.safe ? '<b>入水。</b>浮力装置准备。' : '重着水 —— 撞击 ' + st.speed.toFixed(0) + ' m/s', 4);
    } else if (kind === 'ground') {
      snd.impact(st.speed);
      S.freeze = true;
      S.crack = u.clamp(st.speed / (p.objective.hurt * 1.6), 0, 1);
      say(st.speed <= p.objective.safe ? '<b>着陆。</b>' : '硬着陆 —— ' + st.speed.toFixed(0) + ' m/s', 4);
    } else if (kind === 'breach') {
      snd.breach(); S.freeze = true; S.white = 1;
      say('<b>隔热壳失效 · 座舱破裂</b>', 4);
    } else if (kind === 'crush') {
      snd.impact(30); S.freeze = true; S.crack = 1;
      say('<b>压力超限 · 结构压溃</b>', 4);
    } else if (kind === 'uplink') {
      snd.success(); S.freeze = true;
      say('<b>1 巴层达成。</b>高增益天线展开 —— 数据上行中……', 6);
    }
  }

  /* 结束后的收尾演出 */
  function postEnd(dt) {
    const p = S.planet, st = S.st;
    if (S.ending === 'splash') {
      S.depth += S.sinkV * dt;
      S.sinkV = Math.max(0, S.sinkV - (S.sinkV * 0.55 + 2.4) * dt);
      st.speed = S.sinkV;
      if (!(S.auto && S.turbo)) snd.update({ q: 40, speed: S.sinkV, heat: 0, turb: 0.1, chute: 0, stress: Math.max(0, S.stress - dt * 0.2), under: true, dead: false, audio: p.audio }, dt);
      if (S.sinkV < 0.6 && S.floatT === 0) { S.floatT = S.endT; say('<b>浮力装置展开。</b>你在一颗没有陆地的行星上漂着。', 6); snd.success(); }
      if (S.floatT && S.endT > S.floatT + 4) results();
    } else if (S.ending === 'uplink') {
      st.alt -= 30 * dt;
      if (S.endT > 6) results();
    } else {
      S.white = Math.max(0, S.white - dt * 0.35);
      if (!(S.auto && S.turbo)) snd.update({ q: 10, speed: 0, heat: 0, turb: 0, chute: 0, stress: Math.max(0, S.stress - dt * 0.3), under: false, dead: true, audio: p.audio }, dt);
      if (S.endT > 3.2) results();
    }
  }

  /* ---------------- 结算 ---------------- */
  function results() {
    if (S.done) return;
    S.done = true;
    const p = S.planet, st = S.st, o = p.objective;
    const v = S.impactV || 0;
    let ok = false, title = '', desc = '', rank = 'F';
    if (S.ending === 'breach') { title = '任务失败 · 隔热壳失效'; desc = '气动加热撕开了外壳。剩下的部分和大气一起消失了。'; }
    else if (S.ending === 'crush') { title = '任务失败 · 压溃'; desc = '在 ' + (Math.abs(st.alt) / 1000).toFixed(1) + ' 公里深处，压力赢了。'; }
    else if (S.ending === 'uplink') { ok = true; title = '任务完成 · 数据已上行'; desc = '你成为第一个亲手触到这颗行星 1 巴层的人。上行完成，气球正在升起。'; }
    else if (v <= o.safe) { ok = true; title = S.ending === 'splash' ? '任务完成 · 软着水' : '任务完成 · 软着陆'; desc = '教科书级的落地。膝盖还在。'; }
    else if (v <= o.hurt) { ok = true; title = '任务完成 · 硬着陆'; desc = '你活下来了，但医疗舱会有话要说。'; }
    else { title = '任务失败 · 撞击'; desc = (S.ending === 'splash' ? '水在这种速度下和混凝土没有区别。' : '地面在这种速度下不讲道理。'); }

    let score = 0;
    if (ok) {
      score = 600 + S.got * 220 + Math.round(st.hp * 6);
      if (o.type !== 'depth') score += Math.round(Math.max(0, o.safe - v) * 34);
      if (st.peakT > Phys.T_MAX) score -= Math.round((st.peakT - Phys.T_MAX) * 0.25);
      if (st.peakG > 9) score -= Math.round((st.peakG - 9) * 45);
      score = Math.max(0, score);
      rank = score >= 2600 ? 'S' : score >= 2100 ? 'A' : score >= 1600 ? 'B' : score >= 1100 ? 'C' : 'D';
    } else { score = S.got * 60; rank = 'F'; }

    const b = best[p.id];
    const order = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };
    if (!b || score > b.score) { best[p.id] = { rank: rank, score: score }; try { localStorage.setItem('descent.best', JSON.stringify(best)); } catch (e) { } }

    $('#resRank').textContent = rank;
    $('#resRank').style.color = ok ? (rank === 'S' ? '#9dffc8' : '#a9ecff') : '#ff8a6a';
    $('#resTitle').textContent = title;
    $('#resDesc').textContent = desc;
    const rows = [
      ['星球', p.name + ' · ' + p.sub],
      ['下落时间', st.time.toFixed(1) + ' s'],
      ['最大速度', Math.round(Math.max(v, S.planet.startVel)) + ' m/s'],
      ['峰值过载', st.peakG.toFixed(1) + ' G'],
      ['峰值壳温', Math.round(st.peakT) + ' K'],
      [o.type === 'depth' ? '终止高度' : '触地速度', o.type === 'depth' ? (st.alt / 1000).toFixed(2) + ' km' : v.toFixed(1) + ' m/s'],
      ['信标', S.got + ' / ' + S.beacons.length],
      ['结构完好度', Math.round(st.hp) + ' %'],
      ['总分', score]
    ];
    $('#resTable').innerHTML = rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('');
    $('#result').classList.remove('hidden');
    $('#hud').classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    S.mode = 'result';
    if (!ok) snd.fail();
    if (S.auto) {
      autoReport('AUTO ' + p.id + ' -> ' + rank + ' | ' + title + ' | ending=' + S.ending +
        ' | score=' + score + ' | beacons=' + S.got + '/' + S.beacons.length +
        ' | t=' + st.time.toFixed(0) + 's | peakG=' + st.peakG.toFixed(1) +
        ' | peakT=' + Math.round(st.peakT) + 'K | hp=' + Math.round(st.hp) + ' | vEval=' + v.toFixed(1));
      if (S.autoQueue.length) setTimeout(function () { startRun(S.autoQueue.shift()); }, 30);
      else autoReport('AUTO DONE');
    }
  }

  /* ---------------- HUD ---------------- */
  function updateHUD(dt) {
    S.hudTick += dt;
    if (S.hudTick < 0.05) return;
    S.hudTick = 0;
    const st = S.st, p = S.planet;
    const alt = Math.max(st.alt, p.objective.type === 'depth' ? -99999 : 0);
    const km = alt / 1000;
    $('#altVal').textContent = Math.abs(km) >= 10 ? km.toFixed(1) : Math.abs(km) >= 1 ? km.toFixed(2) : Math.round(alt);
    $('#altUnit').textContent = Math.abs(km) >= 1 ? 'km' : 'm';
    $('#spdVal').textContent = Math.round(st.speed);
    $('#machVal').textContent = st.mach.toFixed(2);
    $('#gVal').textContent = st.gForce.toFixed(1);
    $('#qVal').textContent = st.q < 1000 ? st.q.toFixed(0) + ' Pa' : (st.q / 1000).toFixed(1) + ' kPa';
    $('#rhoVal').textContent = st.rho < 0.01 ? st.rho.toExponential(1) : st.rho.toFixed(3);
    $('#tempVal').textContent = Math.round(st.shellT) + ' K';
    $('#hpVal').textContent = Math.round(st.hp) + '%';
    $('#spdBar').style.width = u.clamp(st.speed / 420, 0, 1) * 100 + '%';
    $('#gBar').style.width = u.clamp(st.gForce / 12, 0, 1) * 100 + '%';
    $('#tempBar').style.width = u.clamp((st.shellT - 200) / 2400, 0, 1) * 100 + '%';
    $('#hpBar').style.width = u.clamp(st.hp / 100, 0, 1) * 100 + '%';
    $('#beaconCount').textContent = '信标 ' + S.got + ' / ' + S.beacons.length;

    /* 高度带 */
    const stepM = alt > 30000 ? 5000 : alt > 8000 ? 1000 : alt > 2000 ? 500 : 100;
    const ticks = $('#tapeInner').children;
    const centre = Math.round(alt / stepM);
    for (let i = 0; i < ticks.length; i++) {
      const k = centre + (5 - i);
      const va = k * stepM;
      const y = 48 - (va - alt) / stepM * 9.6;
      ticks[i].style.top = y + 'px';
      ticks[i].textContent = va >= 1000 ? (va / 1000).toFixed(va % 1000 === 0 ? 0 : 1) + 'k' : va.toString();
      ticks[i].style.opacity = va < 0 ? 0.25 : 0.8;
    }

    /* 姿态 / 伞 */
    const bodyName = S.body < -0.55 ? '俯冲 · DIVE' : S.body < -0.1 ? '收拢 · TUCK' : S.body < 0.45 ? '中立 · NEUTRAL' : S.body < 0.85 ? '展开 · SPREAD' : '最大阻力 · FLARE';
    $('#bodyModeVal').textContent = bodyName;
    const cb = $('#chuteBox'), cv = $('#chuteVal');
    cb.className = st.chuteState === 2 || st.chuteState === 1 ? 'open' : st.chuteState === 3 ? 'torn' : 'stowed';
    cv.textContent = st.chuteState === 0 ? '伞：待命' : st.chuteState === 1 ? '伞：张开中 ' + Math.round(st.chute * 100) + '%'
      : st.chuteState === 2 ? '伞：已张开' : st.chuteState === 3 ? '伞：已损毁' : '伞：已割断';

    /* 阶段 */
    const cloudTop = (p.layers[0].base + p.layers[0].thick) * 1000;
    let phase = 'TROPOSPHERE 对流层';
    if (st.rho < 1e-6) phase = 'EXOSPHERE 外逸层';
    else if (st.heat > 0.15) phase = 'ENTRY 再入 · 等离子鞘';
    else if (st.mach > 1) phase = 'SUPERSONIC 超声速';
    else if (alt > cloudTop) phase = 'STRATOSPHERE 平流层';
    else if (cloudFactor(alt) > 0.2) phase = 'IN CLOUD 云中';
    if (alt < 1500 && p.objective.type !== 'depth') phase = 'FINAL 终末进场';
    if (S.under) phase = 'SUBMERGED 水下 ' + S.depth.toFixed(0) + ' m';
    $('#phaseTag').textContent = phase;
    const wt = $('#warpTag');
    wt.textContent = 'TIME ×' + S.warp; wt.classList.toggle('off', S.warp === 1);

    /* 告警 */
    const w = [];
    if (st.shellT > Phys.T_MAX) w.push(['red', '隔热壳过热 ' + Math.round(st.shellT) + 'K']);
    else if (st.shellT > 1450) w.push(['amber', '高温 ' + Math.round(st.shellT) + 'K']);
    if (st.gForce > 8.5) w.push(['red', '过载 ' + st.gForce.toFixed(1) + 'G']);
    else if (st.gForce > 5.5) w.push(['amber', '过载 ' + st.gForce.toFixed(1) + 'G']);
    if (st.hp < 30) w.push(['red', '结构损伤 ' + Math.round(st.hp) + '%']);
    else if (st.hp < 65) w.push(['amber', '外壳受损']);
    if (S.hazActive) {
      const nm = { storm: '雷暴单体', thermal: '上升热柱', shear: '风切变', debris: '冰晶飑线', calm: '甲烷雨幕' };
      w.push(['red', nm[S.hazActive.type] || '危险区']);
    }
    if (alt < 1600 && st.chuteState === 0 && p.objective.type !== 'depth' && st.speed > p.objective.safe * 2) w.push(['red', '开伞 · PULL']);
    if (p.objective.type === 'depth' && st.alt < 30000) w.push(['cyan', '接近 1 巴层']);
    const html = w.slice(0, 3).map(x => '<div class="warn ' + x[0] + '">' + x[1] + '</div>').join('');
    const ws = $('#warnStack');
    if (ws.innerHTML !== html) ws.innerHTML = html;
  }

  /* ---------------- 渲染 ---------------- */
  function camBasis() {
    const yaw = S.yaw + S.shakeY, pitch = u.clamp(S.pitch + S.shakeP, -1.56, 1.56);
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const fwd = [cp * sy, sp, cp * cy];
    let right = [cy, 0, -sy];
    let up = [
      fwd[1] * right[2] - fwd[2] * right[1],
      fwd[2] * right[0] - fwd[0] * right[2],
      fwd[0] * right[1] - fwd[1] * right[0]
    ];
    const r = S.roll, crl = Math.cos(r), srl = Math.sin(r);
    const r2 = [right[0] * crl + up[0] * srl, right[1] * crl + up[1] * srl, right[2] * crl + up[2] * srl];
    const u2 = [up[0] * crl - right[0] * srl, up[1] * crl - right[1] * srl, up[2] * crl - right[2] * srl];
    return { fwd: fwd, right: r2, up: u2 };
  }

  function render(dt) {
    const p = S.planet, st = S.st;
    if (!p || !st) { return; }
    const B = camBasis();
    const altKm = st.alt / 1000;
    const pal = PLANETS.palette(p, altKm);
    const fovT = S.fov + u.clamp(st.speed / 320, 0, 1) * 14 + st.heat * 4;
    S.tanF = Math.tan(fovT * Math.PI / 360);
    const layB = [p.layers[0].base, p.layers[1].base, p.layers[2].base];
    const layT = [p.layers[0].thick, p.layers[1].thick, p.layers[2].thick];
    const layC = [p.layers[0].cov, p.layers[1].cov, p.layers[2].cov];
    const layD = [p.layers[0].dens, p.layers[1].dens, p.layers[2].dens];
    const layCol = new Float32Array(9);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) layCol[i * 3 + k] = p.layers[i].col[k];
    let sunCol = p.sunCol, expo = pal.exp * (p.exposure === undefined ? 1 : p.exposure);
    if (S.diag) {           /* 诊断模式下可用 URL 覆盖曝光 / 阳光强度，便于快速调参 */
      if (S.diag.sunMul) sunCol = u.scale3(sunCol, S.diag.sunMul);
      if (S.diag.expMul) expo *= S.diag.expMul;
    }

    gl.render({
      time: S.time, right: B.right, up: B.up, fwd: B.fwd, tanF: S.tanF,
      altKm: altKm, posKm: [st.x / 1000, st.z / 1000],
      sunDir: p.sun, sunCol: sunCol,
      zen: pal.zen, hor: pal.hor, haze: pal.haze, amb: pal.amb,
      atmH: p.H, R: p.R, fogK: p.fogK * p.dust,
      surf: p.surf, surfCol: p.surfCol,
      layB: layB, layT: layT, layC: layC, layD: layD, layCol: layCol,
      wind: S.windOfs, qual: S.qual, heat: st.heat, flash: fx.flash * 0.8,
      glow: p.groundGlow * u.clamp(1 - st.alt / 26000, 0, 1),
      under: S.under ? S.depth / 1000 : -1,
      exposure: expo, aurora: p.aurora, white: S.white,
      waveAmp: p.surf === 0 ? (p.id === 'titanis' ? 0.55 : 1) : 1
    });

    /* FX 状态 */
    const marks = [], blips = [];
    const radarRange = u.clamp(st.alt * 1.1, 1200, 7000);
    for (let i = 0; i < S.beacons.length; i++) {
      const b = S.beacons[i];
      if (b.got) continue;
      const dy = b.alt - st.alt, dx = b.x - st.x, dz = b.z - st.z;
      if (dy < -600 || dy > 9000) continue;
      if (Math.hypot(dx, dz) < radarRange * 1.4) blips.push({ x: dx, z: dz, kind: 'beacon' });
      if (dy < 6000) marks.push({ dx: dx, dy: dy, dz: dz, kind: 'beacon' });
    }
    for (let i = 0; i < S.hazards.length; i++) {
      const h = S.hazards[i];
      if (st.alt < h.a0 - 2500 || st.alt > h.a1 + 2500) continue;
      const dx = h.x - st.x, dz = h.z - st.z;
      blips.push({ x: dx, z: dz, kind: 'haz', r: h.r, active: h === S.hazActive });
      const dy = h.alt - st.alt;
      if (dy < 0 && dy > -3000 && Math.hypot(dx, dz) < h.r * 2.4) marks.push({ dx: dx, dy: dy, dz: dz, kind: 'haz' });
    }

    fx.render({
      right: B.right, up: B.up, fwd: B.fwd, tanF: S.tanF,
      vx: st.vx, vy: S.under ? -S.sinkV : st.vy, vz: st.vz,
      speed: S.under ? S.sinkV : st.speed,
      heat: st.heat, turb: u.clamp(S.turb, 0, 1), under: S.under, depth: S.depth,
      alt: st.alt, rhoRel: u.clamp(st.rho / p.rho0, 0, 1), windX: st.windX, windZ: st.windZ,
      precip: p.precip, shellT: st.shellT, gloc: S.gloc, crack: S.crack,
      marks: marks, blips: blips, yaw: S.yaw, radarRange: radarRange
    }, dt);

    if (S.mode === 'diag') diagText();
  }

  /* ---------------- 诊断模式 ---------------- */
  function setupDiag(q) {
    const p = PLANETS.byId(q.get('planet') || 'thalassa') || PLANETS.list[0];
    S.planet = p;
    S.st = Phys.mk(p);
    const alt = parseFloat(q.get('alt') || '10') * 1000;
    S.st.alt = alt;
    S.st.vy = -parseFloat(q.get('v') || '80');
    S.st.speed = Math.abs(S.st.vy);
    S.st.rho = u.density(alt, p.rho0, p.H);
    S.st.q = 0.5 * S.st.rho * S.st.vy * S.st.vy;
    S.st.mach = Math.abs(S.st.vy) / p.cSound;
    S.st.shellT = parseFloat(q.get('T') || '260');
    S.st.heat = u.clamp((S.st.shellT - 620) / 1750, 0, 1);
    S.pitch = parseFloat(q.get('pitch') || '-40') * Math.PI / 180;
    S.yaw = parseFloat(q.get('yaw') || '0') * Math.PI / 180;
    S.under = q.get('under') === '1';
    S.depth = parseFloat(q.get('depth') || '20');
    S.qual = 0.8; S.scale = 1;
    S.diag = { t: parseFloat(q.get('t') || '12'), sunMul: parseFloat(q.get('sun') || '0') || 0, expMul: parseFloat(q.get('exp') || '0') || 0 };
    S.time = S.diag.t;
    buildLevel(p);
    fx.setPlanet(p);
    $('#menu').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    $('#planetName').textContent = p.name;
    $('#planetSub').textContent = p.sub;
    $('#objVal').textContent = p.objective.label;
    $('#diag').classList.remove('hidden');
    S.mode = 'diag';
    updateHUD(1);
  }
  function diagText() {
    const el = $('#diag');
    const st = S.st;
    el.textContent =
      'DIAG  ' + S.planet.id + '  alt=' + (st.alt / 1000).toFixed(1) + 'km  pitch=' + (S.pitch * 57.3).toFixed(0) + '°\n' +
      'webgl2: ' + (gl.gl ? 'OK' : 'FAIL') + '   shader: ' + (gl.error ? 'ERR ' + gl.error.slice(0, 300) : 'OK') + '\n' +
      'renderer: ' + (gl.debugInfo || '?') + '\n' +
      'res: ' + gl.w + 'x' + gl.h + '  fps: ' + S.fps.toFixed(0) + '  qual: ' + S.qual.toFixed(2) + '\n' +
      'rho=' + st.rho.toExponential(2) + '  q=' + st.q.toFixed(0) + '  mach=' + st.mach.toFixed(2) +
      '  T=' + st.shellT.toFixed(0) + 'K  heat=' + st.heat.toFixed(2) + '\n' +
      'beacons=' + S.beacons.length + ' hazards=' + S.hazards.length +
      '  predImpact=' + (S.pred ? S.pred.vImpact.toFixed(1) + 'm/s peakG=' + S.pred.peakG.toFixed(1) + ' peakT=' + S.pred.peakT.toFixed(0) + 'K t=' + S.pred.t.toFixed(0) + 's' : '-');
  }

  window.addEventListener('mousedown', e => { if (e.button === 0) KEY['MouseL'] = true; });
  window.addEventListener('mouseup', e => { if (e.button === 0) KEY['MouseL'] = false; });
  window.addEventListener('contextmenu', e => { if (S.mode === 'play') e.preventDefault(); });
  window.addEventListener('load', boot);
  window.__DESCENT = S;
})();
