/* ================================================================
   荣耀精英 — 入口：屏幕流程（启动→大厅→匹配→选英雄→加载→对局→结算）
   渲染循环 / 设置
   ================================================================ */
HE.Main = (function () {
  const M = {};
  const $ = id => document.getElementById(id);
  let renderer, camera, scene;
  let lastT = 0, rafId = 0;
  let selectedHero = null, confirmed = false;
  let selTimer = 60, selInterval = null;
  let previewRenderer = null, previewScene = null, previewCam = null, previewModel = null, previewRaf = 0;
  let shadowsOn = true;

  /* ---------------- 屏幕切换 ---------------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  /* ---------------- 大厅动态背景（运输机/伞兵/山脉/探照灯） ---------------- */
  const MenuBG = (function () {
    let cv, g, W = 0, H = 0, started = false;
    let ridges = [], clouds = [], dust = [], troopers = [];
    let plane = null, planeT = 2.0, t = 0, lastT = 0;

    function mkRidge(y, amp, seg) {
      const pts = [];
      for (let i = 0; i <= seg; i++) pts.push(y + (Math.random() - 0.5) * amp);
      return pts;
    }
    function reset() {
      W = cv.width = innerWidth; H = cv.height = innerHeight;
      ridges = [
        { pts: mkRidge(0.60, 0.10, 15), col: '#182430' },
        { pts: mkRidge(0.72, 0.11, 11), col: '#101a24' },
        { pts: mkRidge(0.85, 0.09, 8),  col: '#0a1016' },
      ];
      clouds = []; dust = []; troopers = [];
      for (let i = 0; i < 6; i++) clouds.push({ x: Math.random() * 1.2 - 0.1, y: 0.06 + Math.random() * 0.3, r: 60 + Math.random() * 130, v: 0.005 + Math.random() * 0.01, o: 0.035 + Math.random() * 0.05 });
      for (let i = 0; i < 46; i++) dust.push({ x: Math.random(), y: Math.random(), v: 0.012 + Math.random() * 0.028, r: 0.6 + Math.random() * 1.5, p: Math.random() * 7 });
    }
    function beam(px, base, sway, speed, col) {
      const a = base + Math.sin(t * speed) * sway;
      g.save(); g.translate(px, H + 10); g.rotate(a);
      const grad = g.createLinearGradient(0, 0, 0, -H * 1.35);
      grad.addColorStop(0, col); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-H * 0.055, -H * 1.35); g.lineTo(H * 0.055, -H * 1.35); g.closePath(); g.fill();
      g.restore();
    }
    function drawRidge(r) {
      g.fillStyle = r.col;
      g.beginPath(); g.moveTo(0, H);
      const n = r.pts.length - 1;
      for (let i = 0; i <= n; i++) g.lineTo(i / n * W, r.pts[i] * H);
      g.lineTo(W, H); g.closePath(); g.fill();
    }
    function drawPlane(p) {
      g.save(); g.translate(p.x, p.y); g.scale(p.s, p.s);
      g.fillStyle = 'rgba(10,16,24,.92)';
      g.beginPath();                                        // 机身
      g.moveTo(-40, 0); g.quadraticCurveTo(-48, -8, -30, -9);
      g.lineTo(28, -7); g.quadraticCurveTo(46, -4, 44, 0);
      g.lineTo(-40, 4); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-2, -6); g.lineTo(-26, 14); g.lineTo(-13, 14); g.lineTo(9, -6); g.closePath(); g.fill();   // 主翼
      g.beginPath(); g.moveTo(-34, -8); g.lineTo(-44, -21); g.lineTo(-38, -21); g.lineTo(-28, -8); g.closePath(); g.fill(); // 尾翼
      if (Math.sin(t * 9) > 0.35) { g.fillStyle = '#ff5c5c'; g.beginPath(); g.arc(-42, -19, 2.2, 0, 7); g.fill(); }
      g.restore();
    }
    function drawTrooper(tr) {
      const x = tr.x * W + Math.sin(tr.sway + t * 1.5) * 14, y = tr.y * H;
      g.fillStyle = 'rgba(12,18,26,.85)'; g.strokeStyle = 'rgba(12,18,26,.85)'; g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, 12, Math.PI, 0); g.closePath(); g.fill();     // 伞衣
      g.beginPath(); g.moveTo(x - 11, y); g.lineTo(x, y + 14); g.moveTo(x + 11, y); g.lineTo(x, y + 14); g.stroke();
      g.beginPath(); g.arc(x, y + 17, 2.8, 0, 7); g.fill();                    // 伞兵
    }
    function frame(now) {
      requestAnimationFrame(frame);
      if (!$('screen-menu').classList.contains('active')) { lastT = now; return; }
      const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
      lastT = now; t += dt;
      g.clearRect(0, 0, W, H);
      // 探照灯
      beam(W * 0.15, -0.32, 0.24, 0.20, 'rgba(245,197,66,.10)');
      beam(W * 0.87, 0.30, 0.28, 0.16, 'rgba(126,200,255,.08)');
      // 云
      clouds.forEach(c => {
        c.x += c.v * dt;
        if (c.x > 1.25) c.x = -0.25;
        g.fillStyle = `rgba(220,230,240,${c.o})`;
        g.beginPath(); g.ellipse(c.x * W, c.y * H, c.r, c.r * 0.32, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(c.x * W + c.r * 0.4, c.y * H - c.r * 0.12, c.r * 0.6, c.r * 0.22, 0, 0, 7); g.fill();
      });
      drawRidge(ridges[0]);
      // 运输机 + 伞兵（穿行于远山与中山之间）
      planeT -= dt;
      if (!plane && planeT <= 0) {
        plane = { x: -90, y: H * (0.14 + Math.random() * 0.14), s: 0.75 + Math.random() * 0.5, v: 95 + Math.random() * 45, drops: 3, dropT: 0.9 };
      }
      if (plane) {
        plane.x += plane.v * dt;
        plane.dropT -= dt;
        if (plane.drops > 0 && plane.dropT <= 0 && plane.x > W * 0.22 && plane.x < W * 0.8) {
          plane.drops--; plane.dropT = 1.1;
          troopers.push({ x: plane.x / W, y: plane.y / H + 0.02, v: 0.028 + Math.random() * 0.012, sway: Math.random() * 7 });
        }
        drawPlane(plane);
        if (plane.x > W + 100) { plane = null; planeT = 5 + Math.random() * 7; }
      }
      for (let i = troopers.length - 1; i >= 0; i--) {
        const tr = troopers[i];
        tr.y += tr.v * dt;
        if (tr.y > 0.68) { troopers.splice(i, 1); continue; }
        drawTrooper(tr);
      }
      drawRidge(ridges[1]);
      drawRidge(ridges[2]);
      // 金色浮尘
      dust.forEach(d => {
        d.y -= d.v * dt;
        if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
        const tw = 0.10 + (Math.sin(t * 2 + d.p) * 0.5 + 0.5) * 0.28;
        g.fillStyle = `rgba(245,197,66,${tw})`;
        g.beginPath(); g.arc(d.x * W, d.y * H, d.r, 0, 7); g.fill();
      });
    }
    return {
      start() {
        if (started) return; started = true;
        cv = $('menu-canvas'); g = cv.getContext('2d');
        reset();
        window.addEventListener('resize', reset);
        requestAnimationFrame(frame);
      },
    };
  })();

  /* ---------------- 启动 ---------------- */
  function boot() {
    renderer = new THREE.WebGLRenderer({ canvas: $('game-canvas'), antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.5, 700);
    window.addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });

    // 假加载进度
    let p = 0;
    const fill = $('boot-fill'), txt = $('boot-text');
    const msgs = ['正在加载战场资源…', '正在部署防御工事…', '正在空投军需物资…', '战场准备完毕'];
    const iv = setInterval(() => {
      p += 4 + Math.random() * 9;
      if (p >= 100) {
        p = 100; clearInterval(iv);
        txt.textContent = msgs[3];
        $('btn-enter').classList.remove('hidden');
      } else txt.textContent = msgs[Math.min(2, (p / 34) | 0)];
      fill.style.width = p + '%';
    }, 120);

    $('btn-enter').onclick = () => {
      HE.Audio.init();
      HE.Audio.afterInit();
      HE.Audio.sfx('ui_confirm');
      HE.Audio.music('menu');
      show('screen-menu');
    };
    MenuBG.start();
    bindMenu();
    bindSettings();
    bindResult();
  }

  /* ---------------- 大厅 / 匹配 ---------------- */
  let matchIv = null;
  function bindMenu() {
    $('btn-match').onclick = () => {
      HE.Audio.sfx('ui_confirm');
      $('match-overlay').classList.remove('hidden');
      let t = 0;
      $('match-status').textContent = '正在匹配队友…';
      matchIv = setInterval(() => {
        t++;
        $('match-timer').textContent = `00:${String(t).padStart(2, '0')}`;
        if (t === 2) $('match-status').textContent = '已找到 4 名队友';
        if (t === 3) $('match-status').textContent = '正在匹配对手…';
        if (t >= 4) {
          clearInterval(matchIv);
          $('match-status').textContent = '匹配成功！';
          HE.Audio.sfx('ui_confirm');
          setTimeout(() => {
            $('match-overlay').classList.add('hidden');
            enterSelect();
          }, 700);
        }
      }, 1000);
    };
    $('btn-cancel-match').onclick = () => {
      clearInterval(matchIv);
      $('match-overlay').classList.add('hidden');
      HE.Audio.sfx('ui_click');
    };
    $('btn-settings').onclick = () => $('settings-modal').classList.remove('hidden');
  }

  /* ---------------- 英雄选择 ---------------- */
  function enterSelect() {
    show('screen-select');
    confirmed = false;
    selectedHero = null;
    $('btn-confirm').disabled = true;
    $('btn-confirm').textContent = '确 认';
    buildTeamPanel();
    buildHeroGrid();
    startPreview();
    pickHero(HE.HEROES[1]); // 默认高亮 孤狼
    // 倒计时
    selTimer = 60;
    $('sel-timer-num').textContent = selTimer;
    clearInterval(selInterval);
    selInterval = setInterval(() => {
      selTimer--;
      $('sel-timer-num').textContent = selTimer;
      $('sel-timer-ring').style.strokeDashoffset = 107 * (1 - selTimer / 60);
      if (selTimer <= 0) { clearInterval(selInterval); if (!confirmed) confirmPick(); }
    }, 1000);
    // AI 队友依次选人
    const slots = [...document.querySelectorAll('#team-panel .tp-slot')].slice(1);
    HE.BOT_NAMES.blue.forEach((name, i) => {
      setTimeout(() => {
        if (!$('screen-select').classList.contains('active')) return;
        const slot = slots[i];
        if (slot) {
          slot.classList.add('picked');
          slot.querySelector('.tp-pick').textContent = '已选择英雄';
          slot.querySelector('.tp-ava').textContent = '✓';
          HE.Audio.sfx('ui_click', { vol: 0.5 });
        }
      }, 1500 + i * 1400);
    });
    $('btn-confirm').onclick = confirmPick;
  }
  function buildTeamPanel() {
    const panel = $('team-panel');
    panel.innerHTML = '';
    const names = ['特种兵·指挥官', ...HE.BOT_NAMES.blue];
    names.forEach((n, i) => {
      const d = document.createElement('div');
      d.className = 'tp-slot' + (i === 0 ? ' me' : '');
      d.innerHTML = `<div class="tp-ava">${i === 0 ? '我' : '?'}</div>
        <div><div class="tp-name">${n}</div><div class="tp-pick">${i === 0 ? '选择你的英雄' : '正在选择…'}</div></div>`;
      panel.appendChild(d);
    });
  }
  function buildHeroGrid() {
    const grid = $('hero-grid');
    grid.innerHTML = '';
    HE.HEROES.forEach(h => {
      const c = '#' + h.accent.toString(16).padStart(6, '0');
      const d = document.createElement('div');
      d.className = 'hero-card';
      d.innerHTML = `<div class="hc-face" style="background:linear-gradient(160deg,${c}44,#0d1118);color:${c};border:1px solid ${c}66">${h.face}</div>
        <div class="hc-name">${h.name}</div><div class="hc-role">${h.role}</div>`;
      d.onclick = () => { pickHero(h); HE.Audio.sfx('ui_click'); };
      d.dataset.id = h.id;
      grid.appendChild(d);
    });
  }
  function pickHero(h) {
    if (confirmed) return;
    selectedHero = h;
    document.querySelectorAll('.hero-card').forEach(c => c.classList.toggle('selected', c.dataset.id === h.id));
    $('btn-confirm').disabled = false;
    $('d-role').textContent = h.role;
    $('d-name').textContent = h.name + ' · ' + h.title;
    $('d-weapon').textContent = '武器：' + h.weapon;
    $('d-diff-stars').textContent = '★'.repeat(h.difficulty) + '☆'.repeat(5 - h.difficulty);
    $('d-skills').innerHTML = h.skills.map(s =>
      `<div class="d-skill"><b>${s.icon}</b><div><b style="color:#e8e6e0">${s.name}</b>　${s.desc}</div></div>`).join('');
    updatePreviewModel(h);
    // 我的槽位显示
    const mySlot = document.querySelector('#team-panel .tp-slot.me');
    if (mySlot) {
      mySlot.querySelector('.tp-pick').textContent = h.name + ' · ' + h.role;
      mySlot.querySelector('.tp-ava').textContent = h.face;
    }
  }
  function confirmPick() {
    if (!selectedHero || confirmed) return;
    confirmed = true;
    clearInterval(selInterval);
    HE.Audio.sfx('select_lock');
    $('btn-confirm').textContent = '已 锁 定';
    $('btn-confirm').disabled = true;
    setTimeout(() => { stopPreview(); enterLoading(); }, 900);
  }

  /* ---------------- 3D 预览 ---------------- */
  function startPreview() {
    const cv = $('preview-canvas');
    if (!previewRenderer) {
      previewRenderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
      previewCam = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    }
    const rect = cv.getBoundingClientRect();
    previewRenderer.setSize(rect.width || 340, 220, false);
    previewCam.aspect = (rect.width || 340) / 220;
    previewCam.updateProjectionMatrix();
    previewScene = new THREE.Scene();
    previewScene.add(new THREE.HemisphereLight(0xcfe0ec, 0x3a3f35, 1.0));
    const key = new THREE.DirectionalLight(0xfff1d8, 1.2);
    key.position.set(3, 5, 4);
    previewScene.add(key);
    const rim = new THREE.DirectionalLight(0xf5c542, 0.7);
    rim.position.set(-3, 3, -4);
    previewScene.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.14, 24),
      new THREE.MeshLambertMaterial({ color: 0x1c242e }));
    disc.position.y = -0.05;
    previewScene.add(disc);
    previewCam.position.set(0, 2.2, 5.6);
    previewCam.lookAt(0, 1.5, 0);
    const loop = () => {
      previewRaf = requestAnimationFrame(loop);
      if (previewModel) previewModel.rotation.y += 0.012;
      previewRenderer.render(previewScene, previewCam);
    };
    loop();
  }
  function updatePreviewModel(h) {
    if (!previewScene) return;
    if (previewModel) previewScene.remove(previewModel);
    previewModel = HE.Entities.buildSoldier(h, 'blue', 1.05);
    previewModel.traverse(o => { o.castShadow = false; });
    previewScene.add(previewModel);
  }
  function stopPreview() {
    cancelAnimationFrame(previewRaf);
    previewModel = null; previewScene = null;
  }

  /* ---------------- 对局加载页 ---------------- */
  function enterLoading() {
    show('screen-loading');
    const mkCard = (name, heroDef, i) => {
      const c = '#' + heroDef.accent.toString(16).padStart(6, '0');
      return `<div class="lt-card" style="animation-delay:${i * 0.12}s">
        <div class="lt-face" style="background:linear-gradient(160deg,${c}44,#0d1118);color:${c}">${heroDef.face}</div>
        <div class="lt-info"><b>${heroDef.name}</b><em>${name}</em></div></div>`;
    };
    const others = HE.HEROES.filter(h => h.id !== selectedHero.id);
    $('lt-blue').innerHTML = mkCard('特种兵·指挥官', selectedHero, 0) +
      others.map((h, i) => mkCard(HE.BOT_NAMES.blue[i], h, i + 1)).join('');
    $('lt-red').innerHTML = HE.HEROES.map((h, i) => mkCard(HE.BOT_NAMES.red[i], h, i)).join('');
    // 进度 + 提示轮换
    let p = 0, tipIdx = (Math.random() * HE.TIPS.length) | 0;
    $('lp-tip').textContent = HE.TIPS[tipIdx];
    const tipIv = setInterval(() => {
      tipIdx = (tipIdx + 1) % HE.TIPS.length;
      $('lp-tip').textContent = HE.TIPS[tipIdx];
    }, 1600);
    const iv = setInterval(() => {
      p += 6 + Math.random() * 10;
      $('lp-fill').style.width = Math.min(100, p) + '%';
      if (p >= 100) {
        clearInterval(iv); clearInterval(tipIv);
        setTimeout(startBattle, 400);
      }
    }, 150);
  }

  /* ---------------- 开战 ---------------- */
  function startBattle() {
    scene = new THREE.Scene();
    HE.Game.startMatch(scene, camera, selectedHero.id);
    HE.Player.init(HE.Game.G.player, camera);
    HE.UI.init(HE.Game.G.player, camera);
    HE.UI.refreshInventory();
    show('hud');
    lastT = performance.now();
    cancelAnimationFrame(rafId);
    gameLoop(lastT);
  }

  function gameLoop(now) {
    rafId = requestAnimationFrame(gameLoop);
    let dt = (now - lastT) / 1000;
    lastT = now;
    dt = Math.min(dt, 0.05);
    if (!HE.Game.G) return;
    HE.Game.update(dt);
    HE.Player.update(dt);
    HE.World.tick(dt);
    HE.FX.update(dt);
    if (HE.Game.G.state !== 'menu') HE.UI.update(dt);
    renderer.render(scene, camera);
  }

  /* ---------------- 结算 ---------------- */
  M.showResult = function (win) {
    const G = HE.Game.G;
    const p = G.player;
    $('result-title').textContent = win ? '胜 利' : '失 败';
    $('result-title').className = `result-title ${win ? 'win' : 'lose'}`;
    $('result-slogan').textContent = win ? '大吉大利，今晚吃鸡！' : '不要气馁，重整旗鼓再战！';
    $('r-face').textContent = p.heroDef.face;
    $('r-hero-name').textContent = p.heroDef.name + ' · ' + p.heroDef.title;
    $('r-player-name').textContent = p.name;
    $('r-kda').textContent = `${p.kda.k}/${p.kda.d}/${p.kda.a}`;
    $('r-gold').textContent = Math.floor(p.gold);
    $('r-dmg').textContent = Math.floor(p.dmgDealt);
    $('r-cs').textContent = p.cs;
    // MVP：我方评分最高者
    const score = h => h.kda.k * 3 + h.kda.a * 1.5 + h.cs * 0.1 + h.dmgDealt * 0.002 - h.kda.d;
    const best = G.heroes.filter(h => h.team === G.playerTeam).sort((a, b) => score(b) - score(a))[0];
    $('r-mvp').classList.toggle('hidden', best !== p);
    show('screen-result');
    HE.Audio.music('menu');
  };

  function bindResult() {
    $('btn-again').onclick = () => {
      HE.Audio.sfx('ui_confirm');
      cleanupMatch();
      enterSelect();
    };
    $('btn-lobby').onclick = () => {
      HE.Audio.sfx('ui_click');
      cleanupMatch();
      show('screen-menu');
    };
  }
  function cleanupMatch() {
    cancelAnimationFrame(rafId);
    HE.UI.cleanup();
    HE.Game.G = null;
    scene = null;
    renderer.renderLists.dispose();
  }

  /* ---------------- 设置 ---------------- */
  function bindSettings() {
    $('set-close').onclick = () => $('settings-modal').classList.add('hidden');
    $('vol-master').oninput = e => HE.Audio.setVol('master', e.target.value / 100);
    $('vol-sfx').oninput = e => HE.Audio.setVol('sfx', e.target.value / 100);
    $('vol-music').oninput = e => HE.Audio.setVol('music', e.target.value / 100);
    $('voice-on').onchange = e => HE.Audio.setVoice(e.target.checked);
    $('shadow-on').onchange = e => {
      shadowsOn = e.target.checked;
      renderer.shadowMap.enabled = shadowsOn;
      if (HE.World.sun) HE.World.sun.castShadow = shadowsOn;
      if (scene) scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    };
  }

  window.addEventListener('DOMContentLoaded', boot);
  return M;
})();
