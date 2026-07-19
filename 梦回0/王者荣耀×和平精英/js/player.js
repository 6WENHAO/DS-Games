/* ================================================================
   荣耀精英 — 玩家控制
   键鼠 + 虚拟摇杆 + 鼠标点地移动/点敌追击 + 攻击范围圈 + 跟随镜头
   屏幕方位：上 = 世界+x，右 = 世界+z（蓝方基地位于屏幕左下，王者式）
   ================================================================ */
HE.Player = (function () {
  const P = {};
  let hero = null, camera = null;
  const keys = {};
  let joyVec = { x: 0, z: 0 }, joyActive = false;   // 世界坐标系分量
  let attackHeld = false;
  let shakeT = 0, shakeAmp = 0;
  let camPos = new THREE.Vector3();
  let moveOrder = null;             // {type:'move',x,z} | {type:'attack',target}
  let rangeRing = null, orderRing = null;
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const CAM_OFF = new THREE.Vector3(-23, 37, 0);
  const LOOK_OFF = new THREE.Vector3(7, 0, 0);

  P.init = function (h, cam) {
    hero = h; camera = cam;
    camPos.copy(hero.pos).add(CAM_OFF);
    moveOrder = null; attackHeld = false;
    makeRings();
    bindOnce();
  };
  P.hero = () => hero;

  /* ---------- 攻击范围圈 / 指令指示环 ---------- */
  function makeRings() {
    const scene = HE.Game.G.scene;
    rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(hero.range - 0.12, hero.range + 0.12, 64),
      new THREE.MeshBasicMaterial({ color: 0xf5c542, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    rangeRing.rotation.x = -Math.PI / 2;
    scene.add(rangeRing);
    orderRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 40),
      new THREE.MeshBasicMaterial({ color: 0x7fe8a8, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    orderRing.rotation.x = -Math.PI / 2;
    orderRing.visible = false;
    scene.add(orderRing);
  }
  function updateRings() {
    if (!rangeRing) return;
    const show = hero.alive && hero.dropping <= 0;
    rangeRing.visible = show;
    if (show) rangeRing.position.set(hero.x, 0.12, hero.z);
    if (moveOrder && show) {
      orderRing.visible = true;
      if (moveOrder.type === 'attack' && moveOrder.target && moveOrder.target.alive) {
        const t = moveOrder.target;
        const s = (t.radius + 0.7) * (1 + Math.sin(HE.Game.G.time * 8) * 0.08);
        orderRing.position.set(t.x, 0.14, t.z);
        orderRing.material.color.setHex(0xff5c5c);
        orderRing.scale.set(s, s, 1);
      } else {
        orderRing.position.set(moveOrder.x, 0.14, moveOrder.z);
        orderRing.material.color.setHex(0x7fe8a8);
        orderRing.scale.set(1, 1, 1);
      }
    } else orderRing.visible = false;
  }

  /* ---------- 输入绑定 ---------- */
  let bound = false;
  function bindOnce() {
    if (bound) return; bound = true;

    window.addEventListener('keydown', e => {
      if (!HE.Game.G || HE.Game.G.state !== 'play') return;
      const k = e.key.toLowerCase();
      keys[k] = true;
      if (k === '1' || k === 'q') hero.castSkill(0);
      if (k === '2') hero.castSkill(1);   // W 保留给移动
      if (k === '3' || k === 'e') hero.castSkill(2);
      if (k === 'f') hero.castFlash(inputDir());
      if (k === 'h') hero.castHeal();
      if (k === 'b') { moveOrder = null; hero.startRecall(); }
      if (k === 'c') HE.UI.toggleShop();
      if (k === 'm') HE.UI.toggleSound();
      if (k === 'tab') { e.preventDefault(); HE.UI.showStats(true); }
      if (k === ' ') { e.preventDefault(); attackHeld = true; }
    });
    window.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      keys[k] = false;
      if (k === 'tab') HE.UI.showStats(false);
      if (k === ' ') attackHeld = false;
    });

    // 鼠标点击：点地移动 / 点敌追击（左键或右键均可）
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', onCanvasClick);

    // 虚拟摇杆
    const joy = document.getElementById('joystick');
    const knob = document.getElementById('joy-knob');
    let joyId = null, cx = 0, cy = 0;
    const R = 62;
    joy.addEventListener('pointerdown', e => {
      joyId = e.pointerId; joy.setPointerCapture(joyId);
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      joyMove(e);
    });
    joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
    const joyEnd = e => {
      if (e.pointerId !== joyId) return;
      joyId = null; joyActive = false; joyVec.x = 0; joyVec.z = 0;
      knob.style.transform = 'translate(-50%,-50%)';
    };
    joy.addEventListener('pointerup', joyEnd);
    joy.addEventListener('pointercancel', joyEnd);
    function joyMove(e) {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      joyVec.x = -dy / R;   // 屏幕上 = 世界 +x
      joyVec.z = dx / R;    // 屏幕右 = 世界 +z
      joyActive = Math.hypot(joyVec.x, joyVec.z) > 0.15;
    }

    // 技能按钮
    document.querySelectorAll('.skill-btn').forEach(btn => {
      btn.addEventListener('pointerdown', () => {
        hero.castSkill(parseInt(btn.dataset.skill));
      });
    });
    document.getElementById('btn-attack').addEventListener('pointerdown', () => attackHeld = true);
    document.getElementById('btn-attack').addEventListener('pointerup', () => attackHeld = false);
    document.getElementById('btn-attack').addEventListener('pointerleave', () => attackHeld = false);
    document.getElementById('btn-flash').addEventListener('pointerdown', () => hero.castFlash(inputDir()));
    document.getElementById('btn-heal').addEventListener('pointerdown', () => hero.castHeal());
    document.getElementById('btn-recall').addEventListener('pointerdown', () => { moveOrder = null; hero.startRecall(); });
  }

  /* ---------- 点击指令 ---------- */
  function onCanvasClick(e) {
    if (!HE.Game.G || HE.Game.G.state !== 'play') return;
    if (!hero || !hero.alive || hero.dropping > 0) return;
    if (e.button !== 0 && e.button !== 2) return;
    raycaster.setFromCamera(
      new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
    const pt = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, pt)) return;
    // 优先判定敌方单位（含野怪/建筑）
    let best = null, bd = 1e9;
    for (const u of HE.Game.G.units) {
      if (!u.alive || u.untargetable || u.team === hero.team || u.kind === 'airdrop') continue;
      const d = Math.hypot(u.x - pt.x, u.z - pt.z);
      if (d < Math.max(2.0, u.radius + 1.1) && d < bd) { bd = d; best = u; }
    }
    if (best) {
      moveOrder = { type: 'attack', target: best };
      HE.FX.ring(new THREE.Vector3(best.x, 0, best.z), best.radius + 1.2, 0xff5c5c, 0.35);
      HE.Audio.sfx('ui_click', { vol: 0.4 });
    } else {
      const H = HE.CFG.MAP_HALF - 2;
      moveOrder = {
        type: 'move',
        x: Math.max(-H, Math.min(H, pt.x)),
        z: Math.max(-H, Math.min(H, pt.z)),
      };
      HE.FX.ring(new THREE.Vector3(moveOrder.x, 0, moveOrder.z), 1.4, 0x7fe8a8, 0.35);
    }
  }
  function executeOrder(dt) {
    if (moveOrder.type === 'move') {
      if (Math.hypot(moveOrder.x - hero.x, moveOrder.z - hero.z) < 0.5) { moveOrder = null; return; }
      hero.moveToward(moveOrder.x, moveOrder.z, dt);
      if (hero.recallT >= 0) hero.cancelRecall();
    } else {
      const t = moveOrder.target;
      if (!t || !t.alive) { moveOrder = null; return; }
      const reach = hero.range + (t.isBuilding ? t.radius : 0);
      if (hero.distTo(t) <= reach) {
        hero.tryBasicAttack(t, dt);
      } else {
        hero.moveToward(t.x, t.z, dt);
        if (hero.recallT >= 0) hero.cancelRecall();
      }
    }
  }

  function inputDir() {
    let x = 0, z = 0;
    if (keys['w'] || keys['arrowup']) x += 1;      // 屏幕上 = +x
    if (keys['s'] || keys['arrowdown']) x -= 1;
    if (keys['a'] || keys['arrowleft']) z -= 1;    // 屏幕左 = -z
    if (keys['d'] || keys['arrowright']) z += 1;
    if (joyActive) { x += joyVec.x; z += joyVec.z; }
    const v = new THREE.Vector3(x, 0, z);
    if (v.lengthSq() > 1) v.normalize();
    return v;
  }

  P.shake = function (amp, t) { shakeAmp = Math.max(shakeAmp, amp); shakeT = Math.max(shakeT, t || 0.3); };

  P.update = function (dt) {
    if (!hero) return;
    const Gm = HE.Game.G;
    if (!hero.alive) moveOrder = null;
    if (hero.alive && hero.dropping <= 0 && Gm.state === 'play') {
      const dir = inputDir();
      const movingInput = dir.lengthSq() > 0.02;
      if (movingInput) moveOrder = null;   // 手动操作优先，打断自动指令
      if (attackHeld) {
        // 攻击优先：站定射击最近目标
        const t = hero.autoTarget();
        if (t) hero.tryBasicAttack(t, dt);
        else if (movingInput) doMove(dir, dt);
      } else if (movingInput) {
        doMove(dir, dt);
      } else if (moveOrder) {
        executeOrder(dt);
      } else if (!hero.channel) {
        // 站立自动索敌（王者式站桩输出）
        const t = hero.autoTarget();
        if (t) hero.tryBasicAttack(t, dt);
      }
    }
    updateRings();
    // 镜头跟随
    const targetPos = hero.pos.clone().add(CAM_OFF);
    camPos.lerp(targetPos, Math.min(1, dt * 6));
    let sx = 0, sy = 0;
    if (shakeT > 0) {
      shakeT -= dt;
      sx = (Math.random() - 0.5) * shakeAmp;
      sy = (Math.random() - 0.5) * shakeAmp;
      if (shakeT <= 0) shakeAmp = 0;
    }
    camera.position.set(camPos.x, camPos.y + sy, camPos.z + sx);
    const look = hero.pos.clone().add(LOOK_OFF);
    camera.lookAt(look);
    // 声音收听位置
    HE.Audio.listener.x = hero.x; HE.Audio.listener.z = hero.z;
  };

  function doMove(dir, dt) {
    hero.moveToward(hero.x + dir.x * 5, hero.z + dir.z * 5, dt);
    if (hero.recallT >= 0) hero.cancelRecall();
  }

  return P;
})();
