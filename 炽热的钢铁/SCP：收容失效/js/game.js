window.SCP = window.SCP || {};
(function (S) {
  const $ = (id) => document.getElementById(id);
  const A = S.audio;

  const DEATHS = {
    d173: { title: '你死了', body: '事件记录 #173-BR-09\n\n回收人员在走廊中发现 D-9341，颈椎完全断裂，死亡时间与最近一次监控盲区吻合。\n\n结论：与 SCP-173 共处时，请保持注视。不要眨眼。' },
    d096: { title: '你死了', body: '事件记录 #096-KL-22\n\n现场残骸无法通过常规手段辨认，DNA 比对确认为 D-9341。\n\n附注：调阅监控确认，对象曾直视 SCP-096 的面部。后续无需继续调查。' },
    dpd: { title: '你消失了', body: '事件记录 #106-PD-\u2588\u2588\n\nD-9341 的生命体征于 \u2588\u2588:\u2588\u2588 从站点内网消失，最后位置无法确定。\n\n口袋维度中没有救援。' },
    dtesla: { title: '你死了', body: '事件记录 #EZ-TG-04\n\n检查点 B 特斯拉门放电记录显示一次 480kV 峰值放电。\n\n医疗报告：心搏骤停，全身三度电灼伤。下次听到充能声时，请退后。' },
    dgas: { title: '你死了', body: '事件记录 #LCZ-VNT-11\n\nD-9341 因吸入高浓度消毒剂蒸汽窒息死亡。\n\n附注：仓储间内明明有一只防毒面具。' },
    dconsole: { title: '你死了', body: '[数据删除]' }
  };

  const G = {
    state: 'menu', area: 'facility',
    dead: false, uiOpen: 0, pointerLocked: false,
    keys: {}, sens: 0.0024, volume: 0.8,
    blink: 1, blinking: false, blinkTimer: 0, noDrain: 0, blinkCount: 0,
    stamina: 1, hp: 100,
    player: { x: 0, z: 0, yaw: 0, pitch: 0 },
    lookDir: { x: 0, z: -1 },
    time: 0, breach: false, lightsOut: 0,
    doorsOpened: 0, msgQ: [],
    s914: { setting: 2, item: null, busy: 0 },
    loops: {}, events: [], introSteps: [], introLock173: true,
    pd: null, worn: { gasmask: false },
    consoleOpen: false, god: false, noclip: false, noclipSpeed: 12,
    notarget: false, infStamina: false, superman: false, wire: false,
    showFps: false, debugHud: false, fogOverride: null
  };
  S.game = G;

  function fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  G.msg = function (text, color) {
    const el = document.createElement('div');
    el.className = 'msg';
    if (color) el.style.borderLeftColor = color;
    el.textContent = text;
    $('msgs').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .6s'; }, 2600);
    setTimeout(() => el.remove(), 3300);
  };
  let subTimer = null;
  G.subtitle = function (text, dur) {
    $('subtitle').textContent = text;
    clearTimeout(subTimer);
    subTimer = setTimeout(() => { $('subtitle').textContent = ''; }, dur || 4500);
  };
  G.announce = function (en, zh) {
    A.alarmPing();
    setTimeout(() => A.speak(en), 300);
    G.subtitle('【广播】' + zh, 6000);
  };

  function setFog(area) {
    if (area === 'pd') {
      G.scene.fog.color.setHex(0x150404);
      G.scene.fog.near = 1; G.scene.fog.far = 19;
      G.renderer.setClearColor(0x150404);
      G.hemi.color.setHex(0x663333); G.hemi.groundColor.setHex(0x140505);
      G.hemi.intensity = 0.5;
    } else if (area === 'outside') {
      G.scene.fog.color.setHex(0x04060c);
      G.scene.fog.near = 10; G.scene.fog.far = 220;
      G.renderer.setClearColor(0x04060c);
      G.hemi.color.setHex(0x223048); G.hemi.groundColor.setHex(0x0a0c10);
      G.hemi.intensity = 0.55;
    } else {
      G.scene.fog.color.setHex(0x000000);
      G.scene.fog.near = 2; G.scene.fog.far = 27;
      G.renderer.setClearColor(0x000000);
      G.hemi.color.setHex(0x9aa5b5); G.hemi.groundColor.setHex(0x20232a);
      G.hemi.intensity = G.lightsOut > 0 ? 0.07 : 0.6;
    }
    if (G.fogOverride) {
      G.scene.fog.near = G.fogOverride[0];
      G.scene.fog.far = G.fogOverride[1];
    }
  }

  G.init = function (seed) {
    G.seed = seed;
    G.rng = S.makeRng(seed + ':run');
    const canvas = $('c');
    G.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    G.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    G.renderer.setSize(innerWidth, innerHeight);
    G.scene = new THREE.Scene();
    G.scene.fog = new THREE.Fog(0x000000, 2, 27);
    G.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 400);
    G.camera.rotation.order = 'YXZ';
    G.hemi = new THREE.HemisphereLight(0x9aa5b5, 0x20232a, 0.6);
    G.scene.add(G.hemi);
    G.plight = new THREE.PointLight(0xffe6c8, 0.65, 13);
    G.scene.add(G.plight);
    G.TEX = S.buildTextures();
    G.ICONS = S.buildIcons();
    G.layout = S.genLayout(seed);
    G.world = S.buildWorld(G);
    G.inv = S.Inventory(G);
    G.npcs = S.createNpcs(G);

    const sp = G.world.spawn.chamber;
    G.player.x = sp.x; G.player.z = sp.z;
    G.player.yaw = 0; G.player.pitch = 0;

    A.init();
    A.setVolume(G.volume);
    G.loops.amb = A.makeAmbience();
    G.loops.amb.set(0.16, 1);
    G.npcs.p173.scrape = A.makeScrape();
    G.npcs.p096.sob = A.makeSob();
    G.loops.gas = A.makeGasHiss();

    setFog('facility');
    setupIntro();
    G.state = 'play';
    G.time = 0;
    $('hud').classList.remove('hidden');
    $('fade').style.opacity = '0';
    updateZoneTag(true);
  };

  function setupIntro() {
    const N = G.npcs, W = G.world;
    const c173 = W.spawn.p173;
    G.introSteps = [
      { t: 1.5, fn: () => G.announce('D-nine-three-four-one. Routine cleaning procedure will begin shortly. Enter the containment chamber and stand by.', 'D-9341，例行清洁程序即将开始，进入收容间待命。') },
      { t: 6.5, fn: () => G.subtitle('D-8912：“……它刚才是不是动了？”') },
      { t: 10, fn: () => { A.flicker(); G.subtitle('（灯光闪烁，门控系统发出刺耳的蜂鸣）'); } },
      { t: 12, fn: () => blackout(1.2, () => { N.p173.x = c173.x; N.p173.z = c173.z + 1.6; }) },
      { t: 15.5, fn: () => G.announce('Warning. Chamber door control failure detected.', '警告：收容间门控系统故障。') },
      { t: 18, fn: () => blackout(1.6, () => { N.p173.x = G.player.x - 1.2; N.p173.z = G.player.z - 1.4; N.killDClass(0); }) },
      { t: 20.5, fn: () => G.subtitle('D-7810：“天哪——别眨眼！谁都别眨眼！！”') },
      { t: 23, fn: () => blackout(2.0, () => { N.p173.x = G.player.x + 1.3; N.p173.z = G.player.z - 1.2; N.killDClass(1); }) },
      {
        t: 25.5, fn: () => {
          const door = G.layout.get(4, 0).doors.n;
          door.locked = false;
          G.setDoor(door, true, true);
          G.announce('Attention all personnel. Multiple containment failures in progress. Full site lockdown is now in effect.', '全体人员注意：多个收容单元失效，站点进入全面封锁。');
          G.breach = true;
          G.introLock173 = false;
          G.npcs.p173.active = true;
          G.loops.alarm = A.makeAlarm();
          G.loops.alarm.set(0.1, 0.5);
          setTimeout(() => { if (G.loops.alarm) { G.loops.alarm.stop(); G.loops.alarm = null; } }, 22000);
          G.msg('收容失效。逃出去。', '#c33');
          scheduleAmbientEvents();
        }
      }
    ];
  }

  function scheduleAmbientEvents() {
    G.events.push({ t: G.time + G.rng.range(60, 110), type: 'blackout' });
    G.events.push({ t: G.time + G.rng.range(70, 120), type: 'radioChatter' });
  }
  const CHATTER = [
    ['Security escort teams, report status to central.', '安保护送小队，向中央报告状态。'],
    ['SCP-173 movement reported in Light Containment. Maintain visual contact at all times.', '轻收容区报告 SCP-173 活动，保持视线接触。'],
    ['All surviving personnel, proceed to the nearest evacuation point.', '所有幸存人员前往最近的撤离点。'],
    ['Reminder: checkpoint doors require valid clearance during lockdown.', '提醒：封锁期间检查点大门需要有效权限。'],
    ['Gate B upper platform is designated evacuation zone LZ-B.', 'B 大门顶层平台被指定为撤离区 LZ-B。']
  ];

  function blackout(dur, fn) {
    G.lightsOut = Math.max(G.lightsOut, dur);
    A.flicker();
    G.world.mats.lightPanel.color.setHex(0x14161a);
    G.hemi.intensity = 0.07;
    G.plight.intensity = 0.18;
    if (fn) setTimeout(fn, 120);
  }

  const _frMat = new THREE.Matrix4();
  const _frustum = new THREE.Frustum();
  const _sph173 = new THREE.Sphere(new THREE.Vector3(), 1);
  G.canSee173 = function () {
    const p = G.npcs.p173;
    if (G.dead || G.area !== 'facility') return false;
    if (G.blinking) return false;
    const dx = p.x - G.player.x, dz = p.z - G.player.z;
    const d = Math.hypot(dx, dz);
    if (d > 26) return false;
    G.camera.updateMatrixWorld();
    _frMat.multiplyMatrices(G.camera.projectionMatrix, G.camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_frMat);
    _sph173.center.set(p.x, 0.95, p.z);
    _sph173.radius = 1.0;
    return _frustum.intersectsSphere(_sph173);
  };

  G.setDoor = function (door, open, silent) {
    if (door.broken) return;
    door.open = open;
    A.doorMove(door.big);
    if (door.checkpoint && open) {
      setTimeout(() => {
        if (door.open && !door.broken) {
          door.open = false;
          A.doorMove(true);
        }
      }, 7000);
    }
  };
  G.tryDoor = function (door) {
    if (door.broken) { A.beepDeny(); return; }
    if (door.locked) { A.beepDeny(); G.msg('门控失效'); return; }
    if (!door.open && door.level > 0) {
      const have = G.inv.maxKeyLevel();
      if (have >= door.level) {
        A.beepOk();
        G.setDoor(door, true);
        G.doorsOpened++;
      } else {
        A.beepDeny();
        G.msg('需要 ' + door.level + ' 级钥匙卡', '#c9a13b');
      }
    } else {
      G.setDoor(door, !door.open);
      if (door.open) G.doorsOpened++;
    }
  };

  G.use914 = function (part) {
    const s = G.s914;
    if (part === 'knob') {
      s.setting = (s.setting + 1) % 5;
      A.uiClick();
      G.msg('SCP-914 旋钮：' + S.SETTING_NAMES[s.setting]);
      return;
    }
    if (part === 'intake') {
      if (s.item) {
        if (G.inv.add(s.item)) { G.msg('取回：' + S.ITEMS[s.item].name); s.item = null; A.pickup(); }
        else G.msg('背包已满');
        return;
      }
      openPickModal();
      return;
    }
    if (part === 'lever') {
      if (s.busy > 0) return;
      if (!s.item) { A.doorThud(); G.msg('输入舱是空的'); return; }
      s.busy = 3.5;
      A.rumble(3.2, 0.3);
      A.burst({ f0: 900, f1: 300, q: 3, vol: 0.15, dur: 3.0, type: 'bandpass' });
      const src = s.item, setting = s.setting;
      s.item = null;
      setTimeout(() => {
        if (G.state !== 'play') return;
        const result = S.RECIPES(src, setting);
        const out = G.world.spawn.m914.output;
        G.world.addPickup(result, out.x, 1.15, out.z);
        A.beepOk();
        G.msg('SCP-914 输出：' + S.ITEMS[result].name, '#7fbf6a');
      }, 3500);
    }
  };

  function openPickModal() {
    const list = $('pickList');
    list.innerHTML = '';
    let any = false;
    G.inv.slots.forEach((id, idx) => {
      if (!id) return;
      any = true;
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = S.ITEMS[id].name;
      b.onclick = () => {
        G.inv.remove(idx);
        G.s914.item = id;
        closeOverlay('pick');
        G.msg('已放入：' + S.ITEMS[id].name);
        A.pickup();
      };
      list.appendChild(b);
    });
    if (!any) { G.msg('没有可放入的物品'); return; }
    openOverlay('pick');
  }

  function openOverlay(id) {
    $(id).classList.remove('hidden');
    G.uiOpen++;
    document.exitPointerLock && document.exitPointerLock();
  }
  function closeOverlay(id) {
    $(id).classList.add('hidden');
    G.uiOpen = Math.max(0, G.uiOpen - 1);
    if (G.state === 'play' && G.uiOpen === 0) lockPointer();
  }
  function lockPointer() {
    const c = $('c');
    if (c.requestPointerLock) c.requestPointerLock();
  }

  function renderInv() {
    const grid = $('invGrid');
    grid.innerHTML = '';
    G.inv.slots.forEach((id, idx) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      if (id) {
        const eq = (id === 'gasmask' && G.worn.gasmask) || (id === 'snav' && G.inv.equipped.snav) || (id === 'radio' && G.inv.equipped.radio > 0);
        if (eq) slot.classList.add('equipped');
        const img = document.createElement('img');
        img.src = G.ICONS[id] || G.ICONS['doc'];
        slot.appendChild(img);
        const nm = document.createElement('div');
        nm.className = 'nm';
        nm.textContent = S.ITEMS[id].name + (id === 'radio' && G.inv.equipped.radio ? ' · CH' + G.inv.equipped.radio : '');
        slot.appendChild(nm);
        if (eq) {
          const eqd = document.createElement('div');
          eqd.className = 'eq'; eqd.textContent = '●';
          slot.appendChild(eqd);
        }
        slot.onclick = () => useItem(idx);
        slot.oncontextmenu = (e) => { e.preventDefault(); dropItem(idx); };
      }
      grid.appendChild(slot);
    });
  }

  function useItem(idx) {
    const id = G.inv.slots[idx];
    if (!id) return;
    const def = S.ITEMS[id];
    A.uiClick();
    if (def.doc) {
      $('docTitle').textContent = S.DOCS[def.doc].title;
      $('docBody').textContent = S.DOCS[def.doc].body;
      closeOverlay('inv');
      openOverlay('reader');
      return;
    }
    if (id === 'gasmask') {
      G.worn.gasmask = !G.worn.gasmask;
      $('maskVg').style.opacity = G.worn.gasmask ? '1' : '0';
      G.msg(G.worn.gasmask ? '已戴上防毒面具' : '已摘下防毒面具');
    } else if (id === 'snav') {
      G.inv.equipped.snav = !G.inv.equipped.snav;
      $('minimap').classList.toggle('hidden', !G.inv.equipped.snav);
      G.msg(G.inv.equipped.snav ? 'S-NAV 已开启' : 'S-NAV 已关闭');
    } else if (id === 'radio') {
      G.inv.equipped.radio = (G.inv.equipped.radio + 1) % 3;
      if (G.loops.radio) { G.loops.radio.stop(); G.loops.radio = null; }
      if (G.inv.equipped.radio === 1) { G.loops.radio = A.makeRadioMusic(); G.loops.radio.set(0.18, 0.5); G.msg('收音机：频道1 · 音乐'); }
      else if (G.inv.equipped.radio === 2) { G.loops.radio = A.makeStatic(); G.loops.radio.set(0.1, 0.5); G.msg('收音机：频道2 · 静噪'); }
      else G.msg('收音机：关闭');
    } else if (id === 'firstaid') {
      G.healOverTime = 55;
      G.inv.remove(idx);
      G.msg('使用急救包……', '#7fbf6a');
    } else if (id === 'eyedrops') {
      G.noDrain = 14;
      G.blink = 1;
      G.inv.remove(idx);
      G.msg('使用滴眼液：14秒内无需眨眼', '#7db4e8');
    } else if (id === 'superdrops') {
      G.noDrain = 35;
      G.blink = 1;
      G.inv.remove(idx);
      G.msg('浓缩滴眼液：35秒内无需眨眼', '#e87db4');
    } else if (id.startsWith('keycard')) {
      G.msg(def.name + '：接近门禁自动验证');
    } else {
      G.msg(def.name);
    }
    renderInv();
  }
  function dropItem(idx) {
    const id = G.inv.remove(idx);
    if (!id) return;
    const fx = G.player.x + G.lookDir.x * 1.1;
    const fz = G.player.z + G.lookDir.z * 1.1;
    G.world.addPickup(id, fx, 0.5, fz);
    A.doorThud();
    renderInv();
  }

  G.damage = function (v, cause) {
    if (G.dead || G.god) return;
    G.hp -= v;
    $('damageVg').style.opacity = String(S.clamp(1 - G.hp / 130, 0.15, 0.95));
    setTimeout(() => { if (!G.dead) $('damageVg').style.opacity = String(S.clamp(0.85 - G.hp / 130, 0, 0.8)); }, 300);
    if (G.hp <= 0) G.die(cause || 'dgas');
  };
  G.kill173 = function () {
    if (G.god || G.notarget) return;
    A.neckSnap();
    G.die('d173');
  };
  G.kill096 = function () {
    if (G.god || G.notarget) return;
    A.doorBreak();
    G.die('d096');
  };
  G.die = function (cause) {
    if (G.dead) return;
    G.dead = true;
    G.state = 'dead';
    stopAllLoops();
    A.stopSpeak();
    A.sting();
    const d = DEATHS[cause] || DEATHS.d173;
    document.querySelector('.deathTitle').textContent = d.title;
    $('deathBody').textContent = d.body + '\n\n存活时间 ' + fmtTime(G.time) + ' · 眨眼 ' + G.blinkCount + ' 次 · 种子 ' + G.seed;
    document.exitPointerLock && document.exitPointerLock();
    setTimeout(() => $('death').classList.remove('hidden'), 700);
    $('fade').style.opacity = '0.35';
  };
  function stopAllLoops() {
    for (const k in G.loops) {
      if (G.loops[k]) { G.loops[k].stop(); G.loops[k] = null; }
    }
    const n = G.npcs;
    if (n) {
      if (n.p173.scrape) { n.p173.scrape.stop(); n.p173.scrape = null; }
      if (n.p096.sob) { n.p096.sob.stop(); n.p096.sob = null; }
      if (n.p096.scream) { n.p096.scream.stop(); n.p096.scream = null; }
    }
  }

  G.toPocketDimension = function () {
    if (G.god || G.dead) return;
    A.pdMoan();
    $('fade').style.opacity = '1';
    G.subtitle('冰冷的手抓住了你。世界向下塌陷——');
    setTimeout(() => {
      G.area = 'pd';
      G.pd = { correct: Math.floor(G.rng.next() * 8), wrong: 0 };
      const c = G.world.pd.center;
      G.player.x = c.x; G.player.z = c.z;
      G.player.yaw = G.rng.range(0, 6.28);
      setFog('pd');
      G.loops.pdDrone = A.makePdDrone();
      G.loops.pdDrone.set(0.3, 1);
      G.damage(10, 'dpd');
      $('fade').style.opacity = '0';
      G.msg('口袋维度 — 找到正确的出口', '#c33');
    }, 900);
  };
  function exitPocketDimension() {
    $('fade').style.opacity = '1';
    if (G.loops.pdDrone) { G.loops.pdDrone.stop(); G.loops.pdDrone = null; }
    setTimeout(() => {
      G.area = 'facility';
      const visited = [];
      for (const cell of G.layout.cells.values())
        if (cell.visited && !cell.special && cell.zone !== 'CPA' && cell.zone !== 'CPB') visited.push(cell);
      const cell = visited.length ? visited[Math.floor(G.rng.next() * visited.length)] : G.layout.get(4, 1);
      G.player.x = S.worldX(cell.c);
      G.player.z = S.worldZ(cell.r);
      setFog('facility');
      $('fade').style.opacity = '0';
      G.subtitle('你从黑暗中跌了出来，浑身沾满腐蚀性的黏液。');
      G.msg('逃出了口袋维度', '#7fbf6a');
    }, 900);
  }

  G.startEnding = function () {
    if (G.state !== 'play') return;
    G.state = 'elevator';
    A.elevator();
    $('fade').style.opacity = '1';
    G.subtitle('电梯上行…… 地面的风声越来越近。');
    setTimeout(() => {
      G.area = 'outside';
      const o = G.world.outside;
      G.player.x = o.x; G.player.z = o.z + 7;
      G.player.yaw = 0;
      setFog('outside');
      G.state = 'play';
      $('fade').style.opacity = '0';
      G.announce('Evacuation transport inbound to platform LZ-B. All cleared personnel stand by.', '撤离运输机正接近 LZ-B 平台，已获许可人员请待命。');
    }, 4200);
  };
  function finishEnding() {
    G.state = 'ending';
    stopAllLoops();
    document.exitPointerLock && document.exitPointerLock();
    $('endTitle').textContent = '逃离 — B 大门';
    $('endBody').textContent =
      '探照灯从头顶扫过，将你钉在停机坪中央。扩音器里的声音在风里几乎听不清——放下武器，跪下，双手抱头。\n\n' +
      '你照做了。对一个 D 级人员来说，被机动特遣队按在地上，是今晚发生过的最温柔的事。\n\n' +
      '在你身后，Site-19 的警报还在闪。收容失效仍未结束——但那已经不是你的问题了。\n\n' +
      '—— 存活时间 ' + fmtTime(G.time) + ' · 眨眼 ' + G.blinkCount + ' 次 · 开门 ' + G.doorsOpened + ' 次 · 种子 ' + G.seed;
    $('ending').classList.remove('hidden');
    $('fade').style.opacity = '0.3';
  }

  function doBlink(dur) {
    if (G.blinking) return;
    G.blinking = true;
    G.blinkCount++;
    document.body.classList.add('blink');
    G.blinkTimer = dur;
  }

  function updateBlink(dt) {
    if (G.blinking) {
      G.blinkTimer -= dt;
      if (G.blinkTimer <= 0) {
        G.blinking = false;
        document.body.classList.remove('blink');
        G.blink = 1;
      }
      return;
    }
    if (G.noDrain > 0) {
      G.noDrain -= dt;
      G.blink = 1;
    } else {
      G.blink -= dt / 9.5;
      if (G.blink <= 0) doBlink(0.4);
    }
  }

  function updatePlayer(dt) {
    const p = G.player;
    let mx = 0, mz = 0;
    if (G.keys['KeyW']) mz -= 1;
    if (G.keys['KeyS']) mz += 1;
    if (G.keys['KeyA']) mx -= 1;
    if (G.keys['KeyD']) mx += 1;
    const moving = (mx || mz);
    let sprint = false;
    if ((G.keys['ShiftLeft'] || G.keys['ShiftRight']) && moving && G.stamina > 0.02) {
      sprint = true;
      G.stamina = Math.max(0, G.stamina - dt / 7);
    } else {
      G.stamina = Math.min(1, G.stamina + dt / 11);
    }
    if (G.infStamina || G.superman) G.stamina = 1;
    let spd = sprint ? 6.6 : 3.5;
    if (G.superman) spd *= 4;
    if (G.noclip) spd = G.noclipSpeed * (sprint ? 2 : 1);
    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
      const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
      const wx = mx * cos + mz * sin;
      const wz = mz * cos - mx * sin;
      let nx = p.x + wx * spd * dt;
      let nz = p.z + wz * spd * dt;
      const res = G.noclip ? { x: nx, z: nz } : S.resolveCircle(nx, nz, 0.36, G.world.collidersNear(nx, nz, G.area));
      p.x = res.x; p.z = res.z;
      G.stepT = (G.stepT || 0) - spd * dt;
      if (G.stepT <= 0) {
        G.stepT = 2.4;
        const cell = G.layout.get(S.colOf(p.x), S.rowOf(p.z));
        A.footstep(sprint, cell ? cell.zone : 'LCZ');
      }
      G.bobT = (G.bobT || 0) + dt * (sprint ? 11 : 7);
    }
    G.lookDir.x = -Math.sin(p.yaw);
    G.lookDir.z = -Math.cos(p.yaw);
    const bobY = Math.sin(G.bobT || 0) * (moving ? 0.045 : 0);
    G.camera.position.set(p.x, 1.62 + bobY, p.z);
    G.camera.rotation.y = p.yaw;
    G.camera.rotation.x = p.pitch;
    G.plight.position.set(p.x, 2.2, p.z);

    if (G.area === 'facility') {
      const ck = S.key(S.colOf(p.x), S.rowOf(p.z));
      if (G.lastCellKey !== ck) {
        G.lastCellKey = ck;
        const cell = G.layout.get(S.colOf(p.x), S.rowOf(p.z));
        if (cell) {
          cell.visited = true;
          updateZoneTag();
        }
      }
    }
  }

  function updateZoneTag(force) {
    const cell = G.layout.get(S.colOf(G.player.x), S.rowOf(G.player.z));
    if (!cell) return;
    if (force || G.lastZone !== cell.zone) {
      G.lastZone = cell.zone;
      $('zoneTag').textContent = S.zoneLabel[cell.zone] || '';
    }
  }

  let hintTarget = null;
  function updateInteract() {
    hintTarget = null;
    let best = null, bestD = 99;
    const p = G.player;
    for (const it of G.world.interact) {
      const d = S.dist2d(p.x, p.z, it.x, it.z);
      if (d > (it.r || 2)) continue;
      const dx = (it.x - p.x) / (d || 1), dz = (it.z - p.z) / (d || 1);
      const dot = dx * G.lookDir.x + dz * G.lookDir.z;
      if (d > 0.6 && dot < 0.55) continue;
      if (d < bestD) { bestD = d; best = { type: 'obj', it }; }
    }
    for (const pk of G.world.pickups) {
      if (pk.taken) continue;
      const d = S.dist2d(p.x, p.z, pk.x, pk.z);
      if (d > 2.0 || d > bestD) continue;
      const dx = (pk.x - p.x) / (d || 1), dz = (pk.z - p.z) / (d || 1);
      const dot = dx * G.lookDir.x + dz * G.lookDir.z;
      if (d > 0.6 && dot < 0.5) continue;
      bestD = d; best = { type: 'pickup', pk };
    }
    if (best) {
      hintTarget = best;
      $('hint').classList.remove('hidden');
      $('hint').textContent = best.type === 'pickup' ? '[E] 拾取 ' + S.ITEMS[best.pk.id].name : best.it.hint();
    } else {
      $('hint').classList.add('hidden');
    }
  }
  function doInteract() {
    if (!hintTarget) return;
    if (hintTarget.type === 'pickup') {
      const pk = hintTarget.pk;
      if (G.inv.add(pk.id)) {
        pk.taken = true;
        pk.sprite.visible = false;
        A.pickup();
        G.msg('拾取：' + S.ITEMS[pk.id].name);
        if (pk.id === 'snav') { G.inv.equipped.snav = true; $('minimap').classList.remove('hidden'); }
      } else {
        G.msg('背包已满', '#c9a13b');
      }
    } else {
      hintTarget.it.action();
    }
  }

  function updateDoors(dt) {
    for (const door of G.layout.doors) {
      const target = (door.open || door.broken) ? 1 : 0;
      if (Math.abs(door.amount - target) < 0.001) continue;
      const spd = door.big ? 0.9 : 1.7;
      door.amount = S.clamp(door.amount + (target > door.amount ? 1 : -1) * spd * dt, 0, 1);
      G.world.updateDoor(door);
    }
  }

  function updateTesla(dt) {
    const T = G.world.tesla;
    if (!T || G.area !== 'facility') return;
    T.t -= dt;
    const p = G.player;
    const inLane = Math.abs(p.x - T.x) < 1.9;
    const nearZ = Math.abs(p.z - T.z);
    if (T.state === 'idle') {
      if (inLane && nearZ < 2.4) {
        T.state = 'charge'; T.t = 0.42;
        A.teslaCharge();
      }
    } else if (T.state === 'charge') {
      if (T.t <= 0) {
        T.state = 'zap'; T.t = 0.4;
        T.hit = false;
        A.zap();
        T.sparkMat.opacity = 1;
        const pos = T.sparks.geometry.attributes.position;
        for (let i = 0; i < 30; i++) {
          const x1 = T.x - 1.2 + Math.random() * 2.4;
          const y1 = 0.2 + Math.random() * 3.2;
          pos.setXYZ(i * 2, x1, y1, T.z + (Math.random() - 0.5) * 0.5);
          pos.setXYZ(i * 2 + 1, x1 + (Math.random() - 0.5) * 0.8, y1 + (Math.random() - 0.5) * 1.2, T.z + (Math.random() - 0.5) * 0.5);
        }
        pos.needsUpdate = true;
        $('flash').style.opacity = '0.5';
        setTimeout(() => $('flash').style.opacity = '0', 120);
      }
    } else if (T.state === 'zap') {
      if (inLane && nearZ < 1.1 && !G.dead && !T.hit) {
        T.hit = true;
        G.damage(70, 'dtesla');
        if (!G.dead) G.msg('特斯拉门放电！', '#c33');
      }
      if (T.t <= 0) {
        T.state = 'cool'; T.t = 1.4;
        T.sparkMat.opacity = 0;
      }
    } else if (T.state === 'cool') {
      if (T.t <= 0) T.state = 'idle';
    }
  }

  function updateGas(dt) {
    if (G.area !== 'facility') { $('gasVg').style.opacity = '0'; if (G.loops.gas) G.loops.gas.set(0, 0.3); return; }
    const cellK = S.key(S.colOf(G.player.x), S.rowOf(G.player.z));
    let nearGas = 99;
    for (const k of G.world.gasCells) {
      const [c, r] = k.split(',').map(Number);
      const d = S.dist2d(G.player.x, G.player.z, S.worldX(c), S.worldZ(r));
      nearGas = Math.min(nearGas, d);
    }
    if (G.loops.gas) G.loops.gas.set(S.clamp(0.4 - nearGas / 30, 0, 0.25), 0.3);
    const inGas = G.world.gasCells.has(cellK);
    if (inGas && !G.worn.gasmask) {
      G.damage(6.5 * dt, 'dgas');
      $('gasVg').style.opacity = '1';
    } else {
      $('gasVg').style.opacity = '0';
    }
    if (G.world.gasSprites) {
      for (const gs of G.world.gasSprites) {
        gs.t += dt;
        gs.sp.position.y = 1.4 + Math.sin(gs.t * 0.7) * 0.8;
        gs.sp.material.opacity = 0.22 + Math.sin(gs.t * 1.3) * 0.12;
      }
    }
  }

  function updatePd() {
    if (G.area !== 'pd' || !G.pd) return;
    const exits = G.world.pd.exits;
    for (const ex of exits) {
      if (S.dist2d(G.player.x, G.player.z, ex.x, ex.z) < 1.4) {
        if (ex.i === G.pd.correct) {
          exitPocketDimension();
          G.pd = null;
          return;
        } else {
          G.pd.wrong++;
          G.pd.correct = Math.floor(G.rng.next() * 8);
          A.pdMoan();
          $('flash').style.opacity = '0.25';
          setTimeout(() => $('flash').style.opacity = '0', 150);
          G.damage(14, 'dpd');
          const c = G.world.pd.center;
          G.player.x = c.x; G.player.z = c.z;
          G.player.yaw = G.rng.range(0, 6.28);
          if (!G.dead) G.subtitle('错误的门。墙壁发出湿润的笑声。');
          return;
        }
      }
    }
  }

  function updateOutside() {
    if (G.area !== 'outside') return;
    const pad = G.world.outside.pad;
    if (S.dist2d(G.player.x, G.player.z, pad.x, pad.z) < 3.2) finishEnding();
  }

  function updateEvents(dt) {
    if (G.lightsOut > 0) {
      G.lightsOut -= dt;
      if (G.lightsOut <= 0) {
        G.world.mats.lightPanel.color.setHex(0xd8e2ea);
        if (G.area === 'facility') G.hemi.intensity = 0.6;
        G.plight.intensity = 0.65;
        A.flicker();
      }
    }
    for (const step of G.introSteps) {
      if (!step.done && G.time >= step.t) {
        step.done = true;
        step.fn();
      }
    }
    for (const ev of G.events) {
      if (ev.done || G.time < ev.t) continue;
      ev.done = true;
      if (ev.type === 'blackout' && G.area === 'facility') {
        blackout(G.rng.range(4, 8));
        G.subtitle('（区域供电中断）');
        G.events.push({ t: G.time + G.rng.range(75, 140), type: 'blackout' });
      } else if (ev.type === 'blackout') {
        G.events.push({ t: G.time + 30, type: 'blackout' });
      }
      if (ev.type === 'radioChatter') {
        const line = CHATTER[Math.floor(G.rng.next() * CHATTER.length)];
        G.announce(line[0], line[1]);
        G.events.push({ t: G.time + G.rng.range(90, 150), type: 'radioChatter' });
      }
    }
    if (G.s914.busy > 0) G.s914.busy -= dt;
    if (G.healOverTime && G.healOverTime > 0) {
      const heal = Math.min(G.healOverTime, 12 * dt);
      G.hp = Math.min(100, G.hp + heal);
      G.healOverTime -= heal;
      $('damageVg').style.opacity = String(S.clamp(0.85 - G.hp / 130, 0, 0.8));
    }
  }

  function updatePickups(dt) {
    for (const pk of G.world.pickups) {
      if (pk.taken) continue;
      pk.t += dt;
      pk.sprite.position.y = pk.y0 + Math.sin(pk.t * 2.2) * 0.06;
    }
  }

  function updateHud() {
    $('blinkFill').style.width = (G.blink * 100).toFixed(1) + '%';
    $('stamFill').style.width = (G.stamina * 100).toFixed(1) + '%';
    $('hpBox').textContent = '生命 ' + Math.max(0, Math.ceil(G.hp)) + '%';
  }

  const ZONE_COLORS = { LCZ: '#7d7660', HCZ: '#3d444d', EZ: '#4d5a68', CPA: '#666', CPB: '#666', GATE: '#3f7d4a' };
  function drawMinimap() {
    if (!G.inv.equipped.snav || G.area !== 'facility') return;
    const cv = $('minimap');
    const x = cv.getContext('2d');
    x.fillStyle = 'rgba(4,8,5,.95)';
    x.fillRect(0, 0, 168, 168);
    const pc = S.colOf(G.player.x), pr = S.rowOf(G.player.z);
    const sz = 13;
    for (const cell of G.layout.cells.values()) {
      if (!cell.visited) continue;
      const dx = cell.c - pc, dr = cell.r - pr;
      const mx = 84 + dx * sz - sz / 2;
      const my = 84 + dr * sz - sz / 2;
      if (mx < -sz || my < -sz || mx > 168 || my > 168) continue;
      x.fillStyle = ZONE_COLORS[cell.zone] || '#555';
      x.fillRect(mx + 1, my + 1, sz - 2, sz - 2);
      for (const d in S.DIRS) {
        if (!cell.open[d]) continue;
        x.fillStyle = '#2a2f28';
        if (d === 'n') x.fillRect(mx + 4, my - 1, sz - 8, 2);
        if (d === 's') x.fillRect(mx + 4, my + sz - 1, sz - 8, 2);
        if (d === 'e') x.fillRect(mx + sz - 1, my + 4, 2, sz - 8);
        if (d === 'w') x.fillRect(mx - 1, my + 4, 2, sz - 8);
      }
      if (cell.special) {
        x.fillStyle = '#c9de9a';
        x.font = '9px monospace';
        const mark = { chamber173: '173', room914: '914', storage: 'S', office2: 'O', medbay: '+', gasCorridor: '☣', server: 'SV', chamber106: '106', armory: 'A', corridor096: '!', office4: 'O4', medbay2: '+', lobby: 'L', checkpoint: 'CP', gateB: 'B' }[cell.special.type] || '';
        x.fillText(mark, mx + 2, my + 9);
      }
    }
    x.save();
    x.translate(84, 84);
    x.rotate(-G.player.yaw);
    x.fillStyle = '#ffd98a';
    x.beginPath();
    x.moveTo(0, -5); x.lineTo(4, 4); x.lineTo(-4, 4);
    x.closePath(); x.fill();
    x.restore();
    x.strokeStyle = '#333';
    x.strokeRect(0, 0, 168, 168);
    x.fillStyle = '#7f8a95';
    x.font = '10px monospace';
    x.fillText('S-NAV', 6, 160);
  }

  let last = 0, mapTick = 0;
  function tick(dt) {
    G.time += dt;
    updateBlink(dt);
    if (G.state === 'play') {
      updatePlayer(dt);
      updateInteract();
      updateDoors(dt);
      updateEvents(dt);
      updateTesla(dt);
      updateGas(dt);
      updatePd();
      updateOutside();
      updatePickups(dt);
      G.npcs.update173(dt);
      G.npcs.update106(dt);
      G.npcs.update096(dt);
    }
    updateHud();
    mapTick -= dt;
    if (mapTick <= 0) { mapTick = 0.3; drawMinimap(); }
  }
  G._tick = function (dt) { if (G.state !== 'menu' && !G.dead) tick(dt || 0.0167); };
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000 || 0.016));
    last = now;
    if (G.state === 'menu') return;
    const paused = (G.uiOpen > 0) || (!G.pointerLocked && G.state === 'play' && G.time > 1 && !G.consoleOpen);
    if ((G.state === 'play' || G.state === 'elevator') && !paused && !G.dead) {
      tick(dt);
    }
    if (G.renderer) G.renderer.render(G.scene, G.camera);
    updateFpsHud(dt);
  }

  function updateFpsHud(dt) {
    if (!G.showFps && !G.debugHud) return;
    G._fpsN = (G._fpsN || 0) + 1;
    G._fpsA = (G._fpsA || 0) + dt;
    if (G._fpsA >= 0.25) {
      G._fps = Math.round(G._fpsN / G._fpsA);
      G._fpsN = 0; G._fpsA = 0;
      let s = 'FPS: ' + G._fps;
      if (G.debugHud) {
        const p = G.player;
        s += '\nPOS: ' + p.x.toFixed(2) + ', ' + p.z.toFixed(2) +
          '\nCELL: ' + S.colOf(p.x) + ', ' + S.rowOf(p.z) + '  AREA: ' + G.area +
          '\nSTATE: ' + G.state + '  TIME: ' + G.time.toFixed(1);
        const n = G.npcs;
        if (n) {
          s += '\n173: ' + n.p173.x.toFixed(1) + ', ' + n.p173.z.toFixed(1) +
            ' d=' + S.dist2d(n.p173.x, n.p173.z, p.x, p.z).toFixed(1) +
            ' active=' + n.p173.active +
            '\n106: ' + n.p106.state + '  096: ' + n.p096.state;
        }
        s += '\nGOD=' + (G.god ? 1 : 0) + ' NOCLIP=' + (G.noclip ? 1 : 0) +
          ' NOTARGET=' + (G.notarget ? 1 : 0) + ' WIRE=' + (G.wire ? 1 : 0);
      }
      $('fpsHud').textContent = s;
    }
  }

  function bindInput() {
    addEventListener('keydown', (e) => {
      if (G.state === 'menu') return;
      if (e.code === 'F3') { e.preventDefault(); G.toggleConsole(); return; }
      if (G.consoleOpen) {
        if (e.code === 'Escape') G.toggleConsole();
        return;
      }
      G.keys[e.code] = true;
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!$('inv').classList.contains('hidden')) closeOverlay('inv');
        else if (G.uiOpen === 0 && G.state === 'play' && !G.dead) { renderInv(); openOverlay('inv'); }
      }
      if (e.code === 'Space' && G.state === 'play' && G.uiOpen === 0 && !G.dead) {
        e.preventDefault();
        if (!G.blinking) doBlink(0.32);
      }
      if (e.code === 'KeyE' && G.state === 'play' && G.uiOpen === 0 && !G.dead) doInteract();
      if (e.code === 'Escape') { }
    });
    addEventListener('keyup', (e) => { G.keys[e.code] = false; });
    addEventListener('blur', () => { G.keys = {}; });
    addEventListener('mousemove', (e) => {
      if (!G.pointerLocked || G.state !== 'play' || G.uiOpen > 0) return;
      G.player.yaw -= e.movementX * G.sens;
      G.player.pitch = S.clamp(G.player.pitch - e.movementY * G.sens, -1.45, 1.45);
    });
    document.addEventListener('pointerlockchange', () => {
      G.pointerLocked = (document.pointerLockElement === $('c'));
      if (!G.pointerLocked && G.state === 'play' && G.uiOpen === 0 && !G.dead && !G.consoleOpen && G.time > 1) {
        $('pauseSeed').textContent = '种子：' + G.seed + (G.keter ? ' · KETER' : '') + ' · 已存活 ' + fmtTime(G.time);
        $('pause').classList.remove('hidden');
        G.uiOpen++;
      }
      A.resume();
    });
    $('c').addEventListener('click', () => {
      if (G.state === 'play' && G.uiOpen === 0 && !G.pointerLocked && !G.consoleOpen) lockPointer();
    });
    addEventListener('resize', () => {
      if (!G.renderer) return;
      G.renderer.setSize(innerWidth, innerHeight);
      G.camera.aspect = innerWidth / innerHeight;
      G.camera.updateProjectionMatrix();
    });
    addEventListener('contextmenu', (e) => {
      if (G.state !== 'menu') e.preventDefault();
    });
  }

  const CON = { hist: [], hi: -1 };
  const C_HELP = '#00ffff', C_WARN = '#ff9600', C_ERR = '#ff3232', C_OK = '#00ff00', C_CMD = '#e8e850';

  function conMsg(txt, color) {
    const log = $('conLog');
    const div = document.createElement('div');
    div.textContent = txt;
    if (color) div.style.color = color;
    log.appendChild(div);
    while (log.childElementCount > 1000) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  G.toggleConsole = function () {
    if (G.state === 'menu') return;
    G.consoleOpen = !G.consoleOpen;
    $('console').classList.toggle('hidden', !G.consoleOpen);
    if (G.consoleOpen) {
      G.keys = {};
      document.exitPointerLock && document.exitPointerLock();
      setTimeout(() => $('conInput').focus(), 30);
    } else {
      $('conInput').blur();
      if (G.state === 'play' && G.uiOpen === 0 && !G.dead) lockPointer();
    }
  };

  function parseToggle(arg, cur) {
    if (arg === 'on' || arg === '1' || arg === 'true') return true;
    if (arg === 'off' || arg === '0' || arg === 'false') return false;
    return !cur;
  }

  function applyWireframe() {
    G.scene.traverse((o) => {
      const m = o.material;
      if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach((mm) => { if ('wireframe' in mm) mm.wireframe = G.wire; });
    });
  }

  const ROOM_ALIASES = {
    '173': 'chamber173', 'start': 'chamber173', 'chamber': 'chamber173', 'scp-173': 'chamber173',
    '914': 'room914', 'scp-914': 'room914', 'room914': 'room914',
    '106': 'chamber106', 'scp-106': 'chamber106', 'coffin': 'chamber106', '895': 'chamber106', 'scp-895': 'chamber106',
    '096': 'corridor096', 'scp-096': 'corridor096',
    'gateb': 'gateB', 'exit1': 'gateB', 'exit': 'gateB',
    'storage': 'storage', 'office': 'office2', 'offices': 'office2', 'office2': 'office2',
    'office4': 'office4', 'medbay': 'medbay', 'medbay2': 'medbay2',
    'server': 'server', 'servers': 'server', 'armory': 'armory',
    'gas': 'gasCorridor', 'gascorridor': 'gasCorridor', 'lobby': 'lobby',
    'checkpointa': 'cpA', 'cpa': 'cpA', 'checkpointb': 'cpB', 'cpb': 'cpB'
  };

  function conTeleport(arg) {
    if (G.area !== 'facility') { conMsg('Teleporting is only possible inside the facility.', C_WARN); return; }
    const t = ROOM_ALIASES[arg];
    if (!t) { conMsg('Room not found.', C_WARN); return; }
    let target = null;
    for (const cell of G.layout.cells.values()) {
      if (!cell.special) continue;
      if (t === 'cpA' && cell.special.type === 'checkpoint' && cell.special.label === 'A') target = cell;
      else if (t === 'cpB' && cell.special.type === 'checkpoint' && cell.special.label === 'B') target = cell;
      else if (cell.special.type === t) target = cell;
      if (target) break;
    }
    if (!target) { conMsg('Room not found.', C_WARN); return; }
    G.player.x = S.worldX(target.c);
    G.player.z = S.worldZ(target.r);
    target.visited = true;
    conMsg('Teleported to ' + arg + ' (' + target.c + ', ' + target.r + ').');
  }

  function conSpawnItem(arg) {
    let id = null;
    if (S.ITEMS[arg]) id = arg;
    else {
      for (const k in S.ITEMS) {
        if (S.ITEMS[k].name.toLowerCase().includes(arg)) { id = k; break; }
      }
    }
    if (!id) { conMsg('Item not found.', C_WARN); return; }
    if (G.inv.add(id)) {
      renderInv();
      conMsg(S.ITEMS[id].name + ' (' + id + ') spawned.');
    } else conMsg('Inventory is full.', C_WARN);
  }

  function conHelp(arg) {
    switch (arg) {
      case '': case '1':
        conMsg('LIST OF COMMANDS - PAGE 1/3', C_HELP);
        conMsg('******************************', C_HELP);
        conMsg('- asd', C_HELP);
        conMsg('- status', C_HELP);
        conMsg('- ending', C_HELP);
        conMsg('- noclipspeed [value]', C_HELP);
        conMsg('- noclip [on/off]', C_HELP);
        conMsg('- injure [value 0-5]', C_HELP);
        conMsg('- heal', C_HELP);
        conMsg('- teleport [room name]', C_HELP);
        conMsg('- tele [x] [z]', C_HELP);
        conMsg('- spawnitem [item name]', C_HELP);
        conMsg('- wireframe [on/off]', C_HELP);
        conMsg('- 173speed [value]', C_HELP);
        conMsg('- 106speed [value]', C_HELP);
        conMsg('- 173state / 106state / 096state', C_HELP);
        conMsg('******************************', C_HELP);
        conMsg('Use "help 2/3" to find more commands.', C_HELP);
        conMsg('******************************', C_HELP);
        break;
      case '2':
        conMsg('LIST OF COMMANDS - PAGE 2/3', C_HELP);
        conMsg('******************************', C_HELP);
        conMsg('- spawn [173/106/096]', C_HELP);
        conMsg('- reset096', C_HELP);
        conMsg('- disable173 / enable173', C_HELP);
        conMsg('- disable106 / enable106', C_HELP);
        conMsg('- teleport173 / teleport106', C_HELP);
        conMsg('- sanic', C_HELP);
        conMsg('- godmode [on/off]', C_HELP);
        conMsg('- revive', C_HELP);
        conMsg('- showfps', C_HELP);
        conMsg('- debughud [on/off]', C_HELP);
        conMsg('- camerafog [near] [far]', C_HELP);
        conMsg('- gamma [value]', C_HELP);
        conMsg('- infinitestamina [on/off]', C_HELP);
        conMsg('- asd2', C_HELP);
        conMsg('******************************', C_HELP);
        break;
      case '3':
        conMsg('LIST OF COMMANDS - PAGE 3/3', C_HELP);
        conMsg('******************************', C_HELP);
        conMsg('- notarget [on/off]', C_HELP);
        conMsg('- unlockexits', C_HELP);
        conMsg('- kill', C_HELP);
        conMsg('- stopsound', C_HELP);
        conMsg('- seed', C_HELP);
        conMsg('******************************', C_HELP);
        break;
      case 'asd':
        conMsg('HELP - asd', C_HELP);
        conMsg('Activates godmode, noclip, wireframe and', C_HELP);
        conMsg('sets fog distance to 20 near, 30 far.', C_HELP);
        break;
      case 'noclip': case 'fly':
        conMsg('HELP - noclip', C_HELP);
        conMsg('Toggles noclip, unless a valid parameter', C_HELP);
        conMsg('is specified (on/off).', C_HELP);
        conMsg('Allows the player to move in any direction while', C_HELP);
        conMsg('bypassing collision.', C_HELP);
        break;
      case 'godmode': case 'god':
        conMsg('HELP - godmode', C_HELP);
        conMsg('Toggles godmode, unless a valid parameter', C_HELP);
        conMsg('is specified (on/off).', C_HELP);
        conMsg('Prevents player death under normal circumstances.', C_HELP);
        break;
      case 'teleport':
        conMsg('HELP - teleport', C_HELP);
        conMsg('Teleports the player to the specified room.', C_HELP);
        conMsg('Valid rooms: start / 914 / storage / office / medbay /', C_HELP);
        conMsg('gas / server / 106 / armory / 096 / office4 / medbay2 /', C_HELP);
        conMsg('lobby / checkpointa / checkpointb / gateb', C_HELP);
        break;
      case 'spawnitem':
        conMsg('HELP - spawnitem', C_HELP);
        conMsg('Spawns an item in the inventory.', C_HELP);
        conMsg('Valid ids: ' + Object.keys(S.ITEMS).join(' / '), C_HELP);
        break;
      case 'spawn':
        conMsg('HELP - spawn', C_HELP);
        conMsg('Moves/activates an SCP at the player\'s location.', C_HELP);
        conMsg('Valid parameters are: 173 / 106 / 096', C_HELP);
        break;
      case 'revive': case 'undead': case 'resurrect':
        conMsg('HELP - revive', C_HELP);
        conMsg('Revives the player after death.', C_HELP);
        break;
      case 'notarget':
        conMsg('HELP - notarget', C_HELP);
        conMsg('Toggles notarget. NPCs will ignore the player.', C_HELP);
        break;
      default:
        conMsg('There is no help available for that command.', C_WARN);
    }
  }

  function conStatus() {
    const p = G.player, N = G.npcs;
    conMsg('******************************', C_OK);
    conMsg('Status:', C_OK);
    conMsg('Coordinates: ' + p.x.toFixed(2) + ', ' + p.z.toFixed(2), C_OK);
    conMsg('Cell: ' + S.colOf(p.x) + ', ' + S.rowOf(p.z) + '  Area: ' + G.area, C_OK);
    conMsg('Rotation: yaw ' + (p.yaw * 180 / Math.PI).toFixed(1) + ', pitch ' + (p.pitch * 180 / Math.PI).toFixed(1), C_OK);
    conMsg('HP: ' + Math.ceil(G.hp) + '  Stamina: ' + (G.stamina * 100).toFixed(0) + '%  Blink: ' + (G.blink * 100).toFixed(0) + '%', C_OK);
    conMsg('Seed: ' + G.seed + '  Difficulty: ' + (G.keter ? 'KETER' : 'STANDARD'), C_OK);
    conMsg('Survived: ' + fmtTime(G.time) + '  Blinks: ' + G.blinkCount + '  Doors opened: ' + G.doorsOpened, C_OK);
    conMsg('Godmode: ' + G.god + '  Noclip: ' + G.noclip + '  Notarget: ' + G.notarget + '  InfStamina: ' + G.infStamina, C_OK);
    conMsg('173 dist: ' + S.dist2d(p.x, p.z, N.p173.x, N.p173.z).toFixed(1) + '  106: ' + N.p106.state + '  096: ' + N.p096.state, C_OK);
    conMsg('******************************', C_OK);
  }

  function conRevive() {
    if (!G.dead) { conMsg('You are not dead.', C_WARN); return; }
    $('death').classList.add('hidden');
    G.dead = false;
    G.state = 'play';
    G.hp = 100;
    G.god = false;
    G.noclip = false;
    G.blink = 1;
    $('fade').style.opacity = '0';
    $('damageVg').style.opacity = '0';
    if (!G.loops.amb) { G.loops.amb = A.makeAmbience(); G.loops.amb.set(0.16, 1); }
    if (!G.npcs.p173.scrape) G.npcs.p173.scrape = A.makeScrape();
    if (!G.npcs.p096.sob) G.npcs.p096.sob = A.makeSob();
    if (!G.loops.gas) G.loops.gas = A.makeGasHiss();
    conMsg('Revived.');
  }

  function execCmd(raw) {
    conMsg('> ' + raw, C_CMD);
    const parts = raw.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').toLowerCase();
    const N = G.npcs;
    switch (cmd) {
      case 'help': conHelp(arg); break;
      case 'asd':
        G.god = true; G.noclip = true;
        G.wire = true; applyWireframe();
        G.fogOverride = [20, 30];
        G.scene.fog.near = 20; G.scene.fog.far = 30;
        conMsg('GODMODE ON'); conMsg('NOCLIP ON'); conMsg('WIREFRAME ON');
        break;
      case 'asd2':
        G.god = true; G.infStamina = true;
        N.p173.active = false; N.p173.mesh.visible = false;
        N.p106.state = 'gone'; N.p106.mesh.visible = false; N.p106.nextEvent = Infinity; N.p106.t = 0;
        conMsg('GODMODE ON'); conMsg('INFINITE STAMINA ON');
        conMsg('SCP-173 disabled.'); conMsg('SCP-106 disabled.');
        break;
      case 'status': conStatus(); break;
      case 'godmode': case 'god':
        G.god = parseToggle(arg, G.god);
        conMsg(G.god ? 'GODMODE ON' : 'GODMODE OFF');
        break;
      case 'noclip': case 'fly':
        G.noclip = parseToggle(arg, G.noclip);
        conMsg(G.noclip ? 'NOCLIP ON' : 'NOCLIP OFF');
        break;
      case 'noclipspeed': {
        const v = parseFloat(arg);
        if (isNaN(v) || v <= 0) conMsg('Invalid value.', C_WARN);
        else { G.noclipSpeed = S.clamp(v, 0.5, 60); conMsg('Noclip speed set to ' + G.noclipSpeed); }
        break;
      }
      case 'wireframe':
        G.wire = parseToggle(arg, G.wire);
        applyWireframe();
        conMsg(G.wire ? 'WIREFRAME ON' : 'WIREFRAME OFF');
        break;
      case 'notarget':
        G.notarget = parseToggle(arg, G.notarget);
        conMsg(G.notarget ? 'NOTARGET ON' : 'NOTARGET OFF');
        break;
      case 'infinitestamina': case 'infstam':
        G.infStamina = parseToggle(arg, G.infStamina);
        conMsg(G.infStamina ? 'INFINITE STAMINA ON' : 'INFINITE STAMINA OFF');
        break;
      case 'sanic':
        G.superman = !G.superman;
        conMsg(G.superman ? 'GOTTA GO FAST' : 'WHOA SLOW DOWN');
        break;
      case 'showfps':
        G.showFps = !G.showFps;
        $('fpsHud').style.display = (G.showFps || G.debugHud) ? 'block' : 'none';
        conMsg('ShowFPS: ' + (G.showFps ? '1' : '0'));
        break;
      case 'debughud':
        G.debugHud = parseToggle(arg, G.debugHud);
        $('fpsHud').style.display = (G.showFps || G.debugHud) ? 'block' : 'none';
        conMsg(G.debugHud ? 'Debug Mode On' : 'Debug Mode Off');
        break;
      case 'camerafog': {
        const a = parseFloat(parts[1]), b = parseFloat(parts[2]);
        if (isNaN(a) || isNaN(b) || b <= a) { conMsg('Usage: camerafog [near] [far]', C_WARN); break; }
        G.fogOverride = [a, b];
        G.scene.fog.near = a; G.scene.fog.far = b;
        conMsg('Near set to: ' + a + ', far set to: ' + b);
        break;
      }
      case 'gamma': {
        const v = parseFloat(arg);
        if (isNaN(v)) { conMsg('Invalid value.', C_WARN); break; }
        const g = S.clamp(v, 0.2, 3);
        $('c').style.filter = (g === 1) ? '' : 'brightness(' + g + ')';
        conMsg('Gamma set to ' + g);
        break;
      }
      case 'heal':
        G.hp = 100;
        $('damageVg').style.opacity = '0';
        conMsg('Healed.');
        break;
      case 'injure': {
        const v = parseFloat(arg);
        if (isNaN(v)) { conMsg('Invalid value.', C_WARN); break; }
        G.hp = S.clamp(100 - v * 20, 1, 100);
        $('damageVg').style.opacity = String(S.clamp(1 - G.hp / 130, 0, 0.95));
        conMsg('Injuries set to ' + v);
        break;
      }
      case 'teleport': conTeleport(arg); break;
      case 'tele': {
        const x = parseFloat(parts[1]), z = parseFloat(parts[2]);
        if (isNaN(x) || isNaN(z)) { conMsg('Usage: tele [x] [z]', C_WARN); break; }
        G.player.x = x; G.player.z = z;
        conMsg('Teleported to coordinates (X|Z): ' + x + '|' + z);
        break;
      }
      case 'spawnitem': conSpawnItem(arg); break;
      case 'spawn':
        if (arg === '173') {
          N.p173.x = G.player.x + G.lookDir.x * 3;
          N.p173.z = G.player.z + G.lookDir.z * 3;
          N.p173.active = true; N.p173.mesh.visible = true; N.p173.path = null;
          G.introLock173 = false;
          conMsg('SCP-173 spawned.');
        } else if (arg === '106') {
          N.p106.nextEvent = 0; N.p106.t = 1; N.p106.state = 'gone';
          conMsg('SCP-106 spawned.');
        } else if (arg === '096') {
          N.p096.x = G.player.x + G.lookDir.x * 5;
          N.p096.z = G.player.z + G.lookDir.z * 5;
          conMsg('SCP-096 spawned.');
        } else conMsg('Invalid NPC type. (173 / 106 / 096)', C_WARN);
        break;
      case 'teleport173':
        N.p173.x = G.player.x + G.lookDir.x * 2;
        N.p173.z = G.player.z + G.lookDir.z * 2;
        N.p173.path = null;
        conMsg('SCP-173 teleported to the player.');
        break;
      case 'teleport106':
        N.p106.nextEvent = 0; N.p106.t = 1;
        if (N.p106.state !== 'chase' && N.p106.state !== 'rising') N.p106.state = 'gone';
        conMsg('SCP-106 is coming.');
        break;
      case 'disable173':
        N.p173.active = false; N.p173.mesh.visible = false;
        conMsg('SCP-173 disabled.');
        break;
      case 'enable173':
        N.p173.active = true; N.p173.mesh.visible = true;
        G.introLock173 = false;
        conMsg('SCP-173 enabled.');
        break;
      case 'disable106':
        N.p106.state = 'gone'; N.p106.mesh.visible = false;
        N.p106.nextEvent = Infinity; N.p106.t = 0;
        conMsg('SCP-106 disabled.');
        break;
      case 'enable106':
        N.p106.nextEvent = G.rng.range(5, 15); N.p106.t = 0;
        conMsg('SCP-106 enabled.');
        break;
      case 'reset096':
        N.p096.state = 'idle'; N.p096.t = 0; N.p096.stun = 0; N.p096.seen = 0; N.p096.path = null;
        if (N.p096.scream) { N.p096.scream.stop(); N.p096.scream = null; }
        N.p096.mesh.scale.y = 0.62;
        N.p096.mesh.rotation.x = 0.5;
        conMsg('SCP-096 reset.');
        break;
      case '173speed': {
        const v = parseFloat(arg);
        if (isNaN(v)) { conMsg('Invalid value.', C_WARN); break; }
        N.p173.speed = S.clamp(v, 0, 100);
        conMsg("173's speed set to " + N.p173.speed);
        break;
      }
      case '106speed': {
        const v = parseFloat(arg);
        if (isNaN(v)) { conMsg('Invalid value.', C_WARN); break; }
        N.p106.speed = S.clamp(v, 0, 100);
        conMsg("106's speed set to " + N.p106.speed);
        break;
      }
      case '173state':
        conMsg('SCP-173', C_OK);
        conMsg('Position: ' + N.p173.x.toFixed(2) + ', ' + N.p173.z.toFixed(2), C_OK);
        conMsg('Active: ' + N.p173.active + '  Speed: ' + N.p173.speed + '  Moving: ' + !!N.p173.moving, C_OK);
        conMsg('Distance to player: ' + S.dist2d(N.p173.x, N.p173.z, G.player.x, G.player.z).toFixed(2), C_OK);
        break;
      case '106state':
        conMsg('SCP-106', C_OK);
        conMsg('Position: ' + N.p106.x.toFixed(2) + ', ' + N.p106.z.toFixed(2), C_OK);
        conMsg('State: ' + N.p106.state + '  Next event: ' + (isFinite(N.p106.nextEvent) ? (N.p106.nextEvent - N.p106.t).toFixed(0) + 's' : 'never'), C_OK);
        break;
      case '096state':
        conMsg('SCP-096', C_OK);
        conMsg('Position: ' + N.p096.x.toFixed(2) + ', ' + N.p096.z.toFixed(2), C_OK);
        conMsg('State: ' + N.p096.state, C_OK);
        break;
      case 'revive': case 'undead': case 'resurrect': conRevive(); break;
      case 'kill': case 'suicide': {
        if (G.dead) { conMsg('You are already dead.', C_WARN); break; }
        const bodies = [
          '[数据删除]',
          'EXCP_ACCESS_VIOLATION',
          '事件记录 #\u2588\u2588\u2588\u2588\n\nD-9341 被发现死于 [已编辑] 区域。尸体无任何外伤，死因不明。\n\n尸体已送检。'
        ];
        DEATHS.dconsole.body = bodies[Math.floor(Math.random() * bodies.length)];
        G.die('dconsole');
        break;
      }
      case 'ending':
        if (G.state === 'play') { G.toggleConsole(); G.startEnding(); }
        else conMsg('Not available now.', C_WARN);
        break;
      case 'unlockexits': {
        const gate = G.layout.get(4, 23);
        const door = gate && gate.doors.s;
        if (door) {
          door.locked = false; door.level = 0;
          conMsg('Gate B is now unlocked.');
        } else conMsg('Gate B door not found.', C_ERR);
        break;
      }
      case 'stopsound': case 'stfu':
        A.stopSpeak();
        if (G.loops.alarm) { G.loops.alarm.stop(); G.loops.alarm = null; }
        conMsg('Stopped all sounds.');
        break;
      case 'seed':
        conMsg('Seed: ' + G.seed + (G.keter ? ' (KETER)' : ''));
        break;
      case 'jorge':
        conMsg('JORGE HAS BEEN EXPECTING YOU.');
        break;
      case 'spawnpumpkin': case 'pumpkin':
        conMsg('What pumpkin?');
        break;
      case 'weed': case '420': case 'scp-420-j':
        conMsg('Generates dank memes.');
        break;
      case 'omgwtfbbq':
        conMsg('BBQ MODE NOT IMPLEMENTED.', C_WARN);
        break;
      default:
        conMsg('Command not found.', C_ERR);
    }
  }

  function bindConsole() {
    const input = $('conInput');
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        const v = input.value.trim();
        input.value = '';
        if (v) {
          CON.hist.unshift(v);
          if (CON.hist.length > 100) CON.hist.pop();
          CON.hi = -1;
          execCmd(v);
        }
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (CON.hist.length) {
          CON.hi = Math.min(CON.hi + 1, CON.hist.length - 1);
          input.value = CON.hist[CON.hi];
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (CON.hi > 0) { CON.hi--; input.value = CON.hist[CON.hi]; }
        else { CON.hi = -1; input.value = ''; }
      } else if (e.code === 'F3' || e.code === 'Escape') {
        e.preventDefault();
        G.toggleConsole();
      } else if (e.code === 'Tab') {
        e.preventDefault();
      }
    });
    input.addEventListener('keyup', (e) => e.stopPropagation());
    $('console').addEventListener('click', () => {
      if (G.consoleOpen && !String(getSelection())) input.focus();
    });
    conMsg('SCP - Containment Breach WEB Console', C_HELP);
    conMsg('Type "help" for a list of commands.', C_HELP);
  }

  function bindUi() {
    const urlParams = new URLSearchParams(location.search);
    const seedFromUrl = urlParams.get('seed');
    if (seedFromUrl) $('seedInput').value = seedFromUrl;
    if (urlParams.get('diff') === 'keter') $('diffInput').value = 'keter';
    $('startBtn').onclick = () => {
      let seed = $('seedInput').value.trim();
      if (!seed) seed = Math.random().toString(36).slice(2, 8).toUpperCase();
      G.keter = $('diffInput').value === 'keter';
      $('menu').classList.add('hidden');
      $('loading').classList.remove('hidden');
      setTimeout(() => {
        G.init(seed);
        $('loading').classList.add('hidden');
        lockPointer();
      }, 60);
    };
    const syncSens = (v) => { G.sens = v * 0.0003; $('sensInput').value = v; $('sensInput2').value = v; };
    const syncVol = (v) => { G.volume = v / 100; A.setVolume(G.volume); $('volInput').value = v; $('volInput2').value = v; };
    $('sensInput').oninput = (e) => syncSens(+e.target.value);
    $('sensInput2').oninput = (e) => syncSens(+e.target.value);
    $('volInput').oninput = (e) => syncVol(+e.target.value);
    $('volInput2').oninput = (e) => syncVol(+e.target.value);
    syncSens(8);
    $('resumeBtn').onclick = () => closeOverlay('pause');
    const sameMapUrl = () => { location.search = '?seed=' + encodeURIComponent(G.seed) + (G.keter ? '&diff=keter' : ''); };
    $('restartBtn').onclick = sameMapUrl;
    $('newMapBtn').onclick = () => { location.search = G.keter ? '?diff=keter' : ''; };
    $('retryBtn').onclick = sameMapUrl;
    $('retryNewBtn').onclick = () => { location.search = G.keter ? '?diff=keter' : ''; };
    $('endMenuBtn').onclick = () => { location.search = G.keter ? '?diff=keter' : ''; };
    $('docClose').onclick = () => closeOverlay('reader');
    $('pickCancel').onclick = () => closeOverlay('pick');
    if (window.speechSynthesis) speechSynthesis.getVoices();
  }

  addEventListener('DOMContentLoaded', () => {
    bindUi();
    bindInput();
    bindConsole();
    requestAnimationFrame(frame);
    setTimeout(() => { if (G.state === 'menu') $('fade').style.opacity = '0'; }, 120);
  });
})(window.SCP);
