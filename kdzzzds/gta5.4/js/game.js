/* game.js — 玩法层(1):任务链、GPS、小地图/大地图、HUD、教学、存档 */
window.G = window.G || {};
(function () {
  const U = G.U;
  const GM = {};
  G.GAME = GM;
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'neonharbor_v1';

  GM.save = { money: 0, done: [], tut: false, station: -1 };
  GM.load = function () {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) Object.assign(GM.save, s); } catch (e) { }
  };
  GM.store = function () {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(GM.save)); } catch (e) { }
  };

  /* ================= 任务定义 ================= */
  function missions() {
    const C = G.CITY;
    const R3 = C.roadAt(3);
    return [
      {
        id: 'm1', title: '热身 · 取车', reward: 200,
        start: [C.spawn[0], C.spawn[1] - 6],
        startText: '走进光圈接取任务',
        stages: [
          { pos: [R3 + 4.8, R3 + 26], r: 4.5, text: '去接你的猎鹰轿车(蓝色),按 E 上车', needCar: false, needEnterCar: true }
        ],
        doneText: '车到手了!城市任你逛'
      },
      {
        id: 'm2', title: '码头快件', reward: 650,
        start: [C.markers.gas[0], C.markers.gas[1]],
        startText: 'OCTAN 加油站有份急件要送',
        stages: [
          { pos: [C.markers.gas[0] + 6, C.markers.gas[1] + 4], r: 5, text: '在便利店门口取急件(开车进圈即可)' },
          { pos: [C.markers.pier[0], C.markers.pier[1]], r: 6, text: '90 秒内送到 PIER 7 仓库!', timer: 90 }
        ],
        doneText: '快件送达,码头的兄弟给你点赞'
      },
      {
        id: 'm3', title: '漂移小考', reward: 900,
        start: [150, 252],
        startText: '码头空地 · 漂移挑战',
        stages: [
          { pos: [150, 252], r: 999, text: '60 秒内漂移得分 1200(空格手刹+转向)', timer: 60, driftGoal: 1200 }
        ],
        doneText: '轮胎冒烟,技术过关!'
      },
      {
        id: 'm4', title: '霓虹夜巡', reward: 1400,
        start: [C.markers.hotel[0], C.markers.hotel[1]],
        startText: '入夜后的城市巡游(自动切到夜晚)',
        night: true,
        stages: [
          { pos: [C.roadAt(2), C.roadAt(2)], r: 7, text: '通过检查点 1/5', timer: 115 },
          { pos: [C.roadAt(5), C.roadAt(2)], r: 7, text: '通过检查点 2/5' },
          { pos: [C.roadAt(6), C.roadAt(4)], r: 7, text: '通过检查点 3/5' },
          { pos: [C.roadAt(3), C.roadAt(5)], r: 7, text: '通过检查点 4/5' },
          { pos: [C.markers.hotel[0], C.markers.hotel[1]], r: 7, text: '回到漩涡酒店 5/5' }
        ],
        doneText: '霓虹之夜,你就是主角'
      },
      {
        id: 'm5', title: '贵客到站', reward: 2000,
        start: [C.markers.axiom[0], C.markers.axiom[1]],
        startText: 'AXIOM 大厦的贵客要去酒店',
        stages: [
          { pos: [C.markers.axiom[0], C.markers.axiom[1] + 4], r: 5, text: '开车来接贵客(平稳!别撞!)', needVip: true },
          { pos: [G.CITY.hotelFront[0], G.CITY.hotelFront[1]], r: 6, text: '平稳送到漩涡酒店(碰撞≤3 次)', maxBump: 3 }
        ],
        doneText: '贵客十分满意 · 全部任务完成!'
      }
    ];
  }

  /* ================= 初始化 ================= */
  GM.init = function (sc) {
    GM.scene = sc;
    GM.load();
    GM.missions = missions();
    GM.mIndex = null; GM.stage = 0; GM.timer = 0; GM.bumps = 0; GM.driftBase = 0;
    GM.makeMarkers(sc);
    GM.buildMapCanvas();
    GM.spawnWorldCars();
    GM.initPeds(sc);
    GM.initTraffic();
    GM.tutInit();
    GM.money = GM.save.money;
    if (GM.save.station != null) G.AUDIO.station = GM.save.station;
    GM.updateMoneyHud();
    GM.route = null; GM.routeT = 0;
  };

  /* ---------------- 世界车辆 ---------------- */
  GM.spawnWorldCars = function () {
    for (const d of G.CITY.parkedDefs) {
      const v = G.VEH.build(d.type, { color: d.color, seed: (d.x * 7 + d.z * 13) | 0 });
      G.PLAYER.registerCar(v, d.x, d.z, d.heading);
      if (d.hero) GM.heroCar = v;
    }
  };

  /* ---------------- 任务标记 ---------------- */
  GM.makeMarkers = function (sc) {
    const cylG = new THREE.CylinderGeometry(2.6, 2.6, 1.1, 26, 1, true);
    GM.startMat = new THREE.MeshBasicMaterial({ color: 0xffd24f, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    GM.objMat = new THREE.MeshBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    GM.startMarker = new THREE.Mesh(cylG, GM.startMat);
    GM.objMarker = new THREE.Mesh(cylG, GM.objMat);
    const beamG = new THREE.CylinderGeometry(0.5, 0.9, 60, 12, 1, true);
    GM.beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    GM.startMarker.visible = GM.objMarker.visible = GM.beam.visible = false;
    sc.add(GM.startMarker, GM.objMarker, GM.beam);
  };

  GM.nextMissionIdx = function () {
    for (let i = 0; i < GM.missions.length; i++) if (!GM.save.done.includes(GM.missions[i].id)) return i;
    return null;
  };

  /* ---------------- 任务流程 ---------------- */
  function startMission(i) {
    const m = GM.missions[i];
    GM.mIndex = i; GM.stage = 0; GM.bumps = 0;
    GM.timer = m.stages[0].timer || 0;
    GM.driftBase = G.PLAYER.driftScore;
    if (m.night && G.state) G.MAIN.setHourSmooth(21.6);
    $('missionPanel').style.display = 'block';
    $('missionTitle').textContent = m.title;
    setStageText();
    GM.toast('任务开始:' + m.title);
    G.AUDIO.blip(720);
    if (m.stages[0].needVip) GM.spawnVip(m.stages[0].pos);
  }
  function setStageText() {
    const m = GM.missions[GM.mIndex];
    $('missionDesc').textContent = m.stages[GM.stage].text;
    $('missionTimer').style.display = GM.timer > 0 ? 'block' : 'none';
  }
  function failMission(why) {
    GM.toast('任务失败:' + why + '(回到起点光圈可重试)');
    G.AUDIO.blip(180);
    endMission(false);
  }
  function completeMission() {
    const m = GM.missions[GM.mIndex];
    if (!GM.save.done.includes(m.id)) GM.save.done.push(m.id);
    GM.money += m.reward;
    GM.save.money = GM.money;
    GM.store();
    GM.updateMoneyHud();
    G.AUDIO.cash();
    const el = $('missionDone');
    el.textContent = '任务完成 +¥' + m.reward;
    el.style.opacity = 1;
    el.style.transform = 'translate(-50%,-50%) scale(1)';
    setTimeout(() => { el.style.opacity = 0; el.style.transform = 'translate(-50%,-50%) scale(.9)'; }, 2200);
    GM.toast(m.doneText);
    if (m.id === 'm5') setTimeout(() => GM.showCredits(), 2600);
    endMission(true);
  }
  function endMission() {
    GM.mIndex = null;
    GM.route = null;
    $('missionPanel').style.display = 'none';
    if (GM.vip && GM.vipInCar) GM.dropVip();
  }

  GM.updateMissions = function (dt) {
    const P = G.PLAYER;
    const pp = P.playerPos();
    /* 待接任务:显示起点光圈 */
    const ni = GM.nextMissionIdx();
    if (GM.mIndex == null) {
      let idx = ni;
      if (idx == null) idx = GM.replayIdx == null ? null : GM.replayIdx;
      if (ni == null) {
        /* 全部完成:所有起点可重玩,选最近的 */
        let bd = 1e9;
        for (let k = 0; k < GM.missions.length; k++) {
          const m2 = GM.missions[k];
          const d2 = Math.hypot(m2.start[0] - pp.x, m2.start[1] - pp.z);
          if (d2 < bd) { bd = d2; idx = k; }
        }
      }
      if (idx != null) {
        const m = GM.missions[idx];
        GM.startMarker.visible = true;
        GM.startMarker.position.set(m.start[0], G.CITY.heightAt(m.start[0], m.start[1]) + 0.6, m.start[1]);
        GM.startMat.opacity = 0.3 + 0.18 * Math.sin(G.state.time * 3.2);
        const d = Math.hypot(m.start[0] - pp.x, m.start[1] - pp.z);
        if (d < 30) GM.prompt(m.title + ':' + m.startText);
        else GM.prompt(null);
        if (d < 3.4) startMission(idx);
        GM.gpsTarget = null;
      }
      GM.objMarker.visible = GM.beam.visible = false;
      return;
    }
    /* 进行中 */
    const m = GM.missions[GM.mIndex];
    const st = m.stages[GM.stage];
    GM.startMarker.visible = false;
    GM.objMarker.visible = GM.beam.visible = st.r < 100;
    GM.objMarker.position.set(st.pos[0], G.CITY.heightAt(st.pos[0], st.pos[1]) + 0.6, st.pos[1]);
    GM.beam.position.set(st.pos[0], 30, st.pos[1]);
    GM.objMat.opacity = 0.36 + 0.2 * Math.sin(G.state.time * 4);
    GM.gpsTarget = st.pos;
    if (GM.timer > 0) {
      GM.timer -= dt;
      const total = m.stages.find(s => s.timer) ? m.stages.find(s => s.timer).timer : 1;
      $('missionTimer').querySelector('i').style.width = U.clamp(GM.timer / total * 100, 0, 100) + '%';
      if (GM.timer <= 0) return failMission('超时');
    }
    if (st.driftGoal) {
      const got = Math.floor(G.PLAYER.driftScore - GM.driftBase);
      $('missionDesc').textContent = st.text + ' — 当前 ' + got;
      if (got >= st.driftGoal) return completeMission();
      return;
    }
    if (st.maxBump && GM.bumps > st.maxBump) return failMission('贵客被撞晕了');
    const d = Math.hypot(st.pos[0] - pp.x, st.pos[1] - pp.z);
    if (d < st.r) {
      if (st.needEnterCar) {
        if (G.PLAYER.mode === 'drive') advanceStage();
        return;
      }
      if (st.needVip) {
        if (G.PLAYER.mode === 'drive' && Math.hypot(G.PLAYER.veh.sim.vx, G.PLAYER.veh.sim.vz) < 2) {
          GM.pickVip();
          advanceStage();
        }
        return;
      }
      advanceStage();
    }
  };
  function advanceStage() {
    const m = GM.missions[GM.mIndex];
    GM.stage++;
    G.AUDIO.blip(980);
    if (GM.stage >= m.stages.length) return completeMission();
    const st = m.stages[GM.stage];
    if (st.timer) GM.timer = st.timer;
    setStageText();
  }
  GM.onEnterCar = function () { };
  GM.onDriveStart = function () { };
  GM.notifyBump = function () { if (GM.mIndex != null && GM.missions[GM.mIndex].stages[GM.stage].maxBump) { GM.bumps++; GM.toast('小心!碰撞 ' + GM.bumps + '/3'); } };

  /* ---------------- VIP ---------------- */
  GM.spawnVip = function (pos) {
    if (GM.vip) { GM.scene.remove(GM.vip.group); }
    GM.vip = G.CHAR.build({ tints: { jacket: 0xd8c9a8, jeans: 0x494949, skin: 0xffe2c4 } });
    GM.vip.group.position.set(pos[0], G.CITY.heightAt(pos[0], pos[1]), pos[1]);
    GM.vip.group.rotation.y = Math.PI;
    GM.scene.add(GM.vip.group);
    GM.vipInCar = false;
  };
  GM.pickVip = function () {
    if (!GM.vip || !G.PLAYER.veh) return;
    const v = G.PLAYER.veh;
    v.body.add(GM.vip.group);
    GM.vip.group.position.copy(v.seatR).add(new THREE.Vector3(0, -0.86, 0.05));
    GM.vip.group.rotation.set(0, 0, 0);
    GM.vip.enterSeat();
    GM.vipInCar = true;
    GM.toast('贵客已上车,注意平稳驾驶');
  };
  GM.dropVip = function () {
    if (!GM.vip) return;
    const wp = new THREE.Vector3();
    GM.vip.group.getWorldPosition(wp);
    GM.scene.add(GM.vip.group);
    GM.vip.group.position.set(wp.x + 1.5, G.CITY.heightAt(wp.x, wp.z), wp.z);
    GM.vip.stand();
    GM.vipInCar = false;
  };

  /* ================= 提示 / Toast / HUD ================= */
  let toastT = 0;
  GM.toast = function (txt, ms) {
    const el = $('toast');
    el.textContent = txt;
    el.style.opacity = 1;
    toastT = (ms || 2600) / 1000;
  };
  GM.prompt = function (txt) {
    const el = $('prompt');
    if (!txt) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.textContent = txt;
  };
  GM.radioToast = function (n) {
    const el = $('radioTag');
    el.textContent = n < 0 ? '📻 电台关闭' : '♪ ' + G.AUDIO.stations[n].name;
    el.style.opacity = 1;
    clearTimeout(GM._rt);
    GM._rt = setTimeout(() => el.style.opacity = 0, 2600);
    GM.save.station = n; GM.store();
  };
  GM.damageFlash = function (k) {
    $('damageVig').style.boxShadow = `inset 0 0 ${90 + k * 120}px rgba(255,40,40,${U.clamp(k, 0, 0.55)})`;
    clearTimeout(GM._dv);
    GM._dv = setTimeout(() => $('damageVig').style.boxShadow = 'inset 0 0 120px rgba(255,40,40,0)', 300);
    GM.notifyBump();
  };
  GM.updateMoneyHud = function () { $('money').textContent = '¥ ' + GM.money.toLocaleString(); };
  GM.showCredits = function () { $('credits').style.display = 'flex'; GM.fireworksT = 9; };

  GM.updateHud = function (dt) {
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
    const P = G.PLAYER;
    const drive = P.mode === 'drive' || P.mode === 'enter';
    $('speedo').style.display = drive ? 'block' : 'none';
    if (drive) $('speedVal').textContent = Math.round(P.speedKmh || 0);
    const h = G.state.hour;
    $('clock').textContent = String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor(h % 1 * 60)).padStart(2, '0');
    if (P.driftPop > 0 && P.driftScore > 30) {
      const el = $('driftPop');
      el.style.opacity = Math.min(1, P.driftPop);
      el.textContent = '漂移 ' + Math.floor(P.driftScore);
    } else $('driftPop').style.opacity = 0;
    /* 烟花 */
    if (GM.fireworksT > 0) {
      GM.fireworksT -= dt;
      if (Math.random() < dt * 3) {
        const hx = G.CITY.markers.hotel[0] + U.rand(Math.random, -20, 20);
        const hz = G.CITY.markers.hotel[1] + U.rand(Math.random, -20, 6);
        const hy = 45 + Math.random() * 18;
        const cols = [[1, .5, .2], [.4, .8, 1], [1, .3, .8], [.5, 1, .5]];
        const c2 = cols[(Math.random() * 4) | 0];
        for (let k = 0; k < 26; k++) {
          const a = Math.random() * U.TAU, e2 = Math.random() * Math.PI;
          const sp = 6 + Math.random() * 7;
          G.FX.sparkPS && sparkAt(hx, hy, hz, Math.sin(e2) * Math.cos(a) * sp, Math.cos(e2) * sp, Math.sin(e2) * Math.sin(a) * sp, c2);
        }
        G.AUDIO.crash(0.25);
      }
    }
  };
  function sparkAt(x, y, z, vx, vy, vz, c2) {
    const ps = G.FX.sparkPS;
    const p = ps.parts[ps.head];
    p.life = p.maxLife = 1.4;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.size = 0.7; p.grow = -0.25; p.r = c2[0]; p.g = c2[1]; p.b = c2[2]; p.a = 1;
    p.drag = 0.7; p.grav = 4;
    ps.head = (ps.head + 1) % ps.count;
  }

  /* ================= 小地图 ================= */
  const MAP = { x0: -270, z0: -270, x1: 270, z1: 300, size: 1024 };
  function w2m(x, z) { return [(x - MAP.x0) / (MAP.x1 - MAP.x0) * MAP.size, (z - MAP.z0) / (MAP.z1 - MAP.z0) * MAP.size]; }
  GM.buildMapCanvas = function () {
    const { cv, ctx } = U.makeCanvas(MAP.size, MAP.size);
    ctx.fillStyle = '#0b2333';
    ctx.fillRect(0, 0, MAP.size, MAP.size);
    const isl = [w2m(G.CITY.ISL.x0, G.CITY.ISL.z0), w2m(G.CITY.ISL.x1, G.CITY.ISL.z1)];
    ctx.fillStyle = '#242a30';
    ctx.fillRect(isl[0][0], isl[0][1], isl[1][0] - isl[0][0], isl[1][1] - isl[0][1]);
    /* 街区 */
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
      const z = G.CITY.ZONES[j][i];
      const [cx, cz] = G.CITY.blockCenter(i, j);
      const a2 = w2m(cx - 23, cz - 23), b = w2m(cx + 23, cz + 23);
      ctx.fillStyle = z === 'park' ? '#1d4029' : z === 'plaza' ? '#3d4148' : z === 'ind' ? '#33302a' : '#2e3339';
      ctx.fillRect(a2[0], a2[1], b[0] - a2[0], b[1] - a2[1]);
    }
    /* 道路 */
    ctx.strokeStyle = '#555d66';
    ctx.lineWidth = MAP.size / (MAP.x1 - MAP.x0) * 12;
    for (let i = 0; i < 8; i++) {
      const r = G.CITY.roadAt(i);
      let p1 = w2m(r, -230), p2 = w2m(r, 230);
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      p1 = w2m(-230, r); p2 = w2m(230, r);
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    }
    /* 码头 */
    const q1 = w2m(-236, 232), q2 = w2m(236, 274);
    ctx.fillStyle = '#3a3f45';
    ctx.fillRect(q1[0], q1[1], q2[0] - q1[0], q2[1] - q1[1]);
    /* 地标图钉 */
    const pins = [
      [G.CITY.markers.axiom, '#4fd8ff', 'A'],
      [G.CITY.markers.hotel, '#ff5ad8', 'V'],
      [G.CITY.markers.gas, '#ff8c42', '⛽'],
      [G.CITY.markers.pier, '#8fd8a0', 'P']
    ];
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    for (const [pos, c2, ch] of pins) {
      const p = w2m(pos[0], pos[1]);
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.arc(p[0], p[1], 14, 0, 7); ctx.fill();
      ctx.fillStyle = '#0c1016';
      ctx.fillText(ch, p[0], p[1] + 8);
    }
    GM.mapCv = cv;
  };
  GM.drawMinimap = function () {
    const cv = $('minimap');
    const ctx = cv.getContext('2d');
    const S = 400;
    const pp = G.PLAYER.playerPos();
    const scalePxPerM = MAP.size / (MAP.x1 - MAP.x0);
    const viewM = 200;
    const sw = viewM * scalePxPerM;
    const [px, pz] = w2m(pp.x, pp.z);
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(GM.mapCv, px - sw / 2, pz - sw / 2, sw, sw, 0, 0, S, S);
    const m2s = S / viewM;
    const toS = (wx, wz) => [(wx - pp.x) * m2s + S / 2, (wz - pp.z) * m2s + S / 2];
    /* GPS 路线 */
    if (GM.route && GM.route.length > 1) {
      ctx.strokeStyle = 'rgba(79,216,255,0.9)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const s0 = toS(GM.route[0][0], GM.route[0][1]);
      ctx.moveTo(s0[0], s0[1]);
      for (let i = 1; i < GM.route.length; i++) { const s = toS(GM.route[i][0], GM.route[i][1]); ctx.lineTo(s[0], s[1]); }
      ctx.stroke();
    }
    /* 任务点 */
    const tgt = GM.mIndex != null ? GM.missions[GM.mIndex].stages[GM.stage].pos : (GM.startMarker.visible ? [GM.startMarker.position.x, GM.startMarker.position.z] : null);
    if (tgt) {
      const s = toS(tgt[0], tgt[1]);
      const cl = U.clamp2 ? null : null;
      const sx = U.clamp(s[0], 16, S - 16), sy = U.clamp(s[1], 16, S - 16);
      ctx.fillStyle = GM.mIndex != null ? '#4fd8ff' : '#ffd24f';
      ctx.beginPath(); ctx.arc(sx, sy, 9, 0, 7); ctx.fill();
      ctx.strokeStyle = '#0c1016'; ctx.lineWidth = 2; ctx.stroke();
    }
    /* 车流小点 */
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const tv of GM.traffic || []) {
      const s = toS(tv.veh.sim.x, tv.veh.sim.z);
      if (s[0] > 0 && s[0] < S && s[1] > 0 && s[1] < S) { ctx.beginPath(); ctx.arc(s[0], s[1], 3, 0, 7); ctx.fill(); }
    }
    /* 玩家箭头 */
    ctx.save();
    ctx.translate(S / 2, S / 2);
    const hd = G.PLAYER.mode === 'drive' && G.PLAYER.veh ? G.PLAYER.veh.sim.h : G.PLAYER.heading;
    ctx.rotate(-hd + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(8, 10); ctx.lineTo(0, 5); ctx.lineTo(-8, 10);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    /* 北向 */
    ctx.fillStyle = '#9fd8ff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', S / 2, 30);
  };
  GM.drawBigmap = function () {
    const cv = $('bigmap');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 900, 900);
    ctx.drawImage(GM.mapCv, 0, 0, 900, 900);
    const sc = 900 / MAP.size;
    const pp = G.PLAYER.playerPos();
    if (GM.route) {
      ctx.strokeStyle = 'rgba(79,216,255,0.95)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      GM.route.forEach((r, i) => { const p = w2m(r[0], r[1]); i ? ctx.lineTo(p[0] * sc, p[1] * sc) : ctx.moveTo(p[0] * sc, p[1] * sc); });
      ctx.stroke();
    }
    const tgt = GM.mIndex != null ? GM.missions[GM.mIndex].stages[GM.stage].pos : null;
    if (tgt) { const p = w2m(tgt[0], tgt[1]); ctx.fillStyle = '#4fd8ff'; ctx.beginPath(); ctx.arc(p[0] * sc, p[1] * sc, 10, 0, 7); ctx.fill(); }
    const p = w2m(pp.x, pp.z);
    ctx.fillStyle = '#fff';
    ctx.save();
    ctx.translate(p[0] * sc, p[1] * sc);
    const hd = G.PLAYER.mode === 'drive' && G.PLAYER.veh ? G.PLAYER.veh.sim.h : G.PLAYER.heading;
    ctx.rotate(-hd + Math.PI);
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 9); ctx.lineTo(-7, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  /* ================= GPS ================= */
  GM.updateGps = function (dt) {
    GM.routeT -= dt;
    if (GM.routeT > 0) return;
    GM.routeT = 1.0;
    if (!GM.gpsTarget) {
      const ni = GM.mIndex == null && GM.startMarker.visible ? [GM.startMarker.position.x, GM.startMarker.position.z] : null;
      if (ni) { const pp = G.PLAYER.playerPos(); GM.route = G.CITY.route(pp.x, pp.z, ni[0], ni[1]); }
      else GM.route = null;
      return;
    }
    const pp = G.PLAYER.playerPos();
    GM.route = G.CITY.route(pp.x, pp.z, GM.gpsTarget[0], GM.gpsTarget[1]);
  };

  /* ================= 教学 ================= */
  GM.tutInit = function () {
    GM.tutSteps = [
      { txt: '欢迎来到霓虹海市!按住 <span class="k">W</span><span class="k">A</span><span class="k">S</span><span class="k">D</span> 走两步', cond: () => GM._moved > 2 },
      { txt: '很好!按住 <span class="k">Shift</span> 可以奔跑', cond: () => GM._ran > 1.2 },
      { txt: '按住<b>鼠标左键拖动</b>环顾四周,滚轮调整距离', cond: () => GM._dragged, timeout: 9 },
      { txt: '看到地上的<b style="color:#ffd24f">黄色光圈</b>了吗?走进去接第一个任务', cond: () => GM.mIndex != null, timeout: 45 },
      { txt: '驾驶:<span class="k">W</span> 油门 <span class="k">S</span> 刹车 <span class="k">A</span><span class="k">D</span> 转向', cond: () => G.PLAYER.mode === 'drive' && G.PLAYER.speedKmh > 25, need: () => G.PLAYER.mode === 'drive' },
      { txt: '高速时按住 <span class="k">空格</span> 手刹 + 转向 = 漂移!会有胎痕和轮烟', cond: () => G.PLAYER.driftScore > 40, timeout: 26, need: () => G.PLAYER.mode === 'drive' },
      { txt: '车里按 <span class="k">R</span> 听电台,<span class="k">M</span> 看大地图,<span class="k">H</span> 全部说明', cond: () => GM._pressedRMH, timeout: 12 },
      { txt: '跟着小地图的 <b style="color:#4fd8ff">GPS 青线</b>走,去完成任务赚钱吧!', cond: () => false, timeout: 7 }
    ];
    GM.tutIdx = GM.save.tut ? -1 : 0;
    GM.tutTimer = 0;
    GM._moved = 0; GM._ran = 0;
  };
  GM.tutUpdate = function (dt) {
    const el = $('tut');
    if (GM.tutIdx < 0 || GM.tutIdx >= GM.tutSteps.length) { el.style.opacity = 0; return; }
    const st = GM.tutSteps[GM.tutIdx];
    if (st.need && !st.need()) { el.style.opacity = 0; return; }
    el.style.opacity = 1;
    if (el._txt !== st.txt) { el.innerHTML = st.txt; el._txt = st.txt; }
    GM.tutTimer += dt;
    const P = G.PLAYER;
    if (P.mode === 'walk') {
      GM._moved += P.vel.length() * dt;
      if (P.keys.ShiftLeft && P.vel.length() > 3) GM._ran += dt;
    }
    if (st.cond() || (st.timeout && GM.tutTimer > st.timeout)) {
      GM.tutIdx++;
      GM.tutTimer = 0;
      G.AUDIO.blip(880);
      if (GM.tutIdx >= GM.tutSteps.length) { GM.save.tut = true; GM.store(); }
    }
  };
})();
