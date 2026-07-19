// ============ 怪物: "住民" — 低模人形 ============
const Monster = (() => {
  let group = null, scene = null;
  let parts = {};
  let state = 'hidden';   // hidden | standing | stalking | chasing | vanishing
  let animT = 0;
  let targetPos = new THREE.Vector3();
  let speed = 0;
  let groanTimer = 0;
  let visibleTimer = 0;
  let onCaught = null;

  // 不安谷比例: 手臂过长, 头略小且前倾, 躯干瘦长
  function build(sc) {
    scene = sc;
    group = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ map: Tex.get('monsterSkin') });
    const cloth = new THREE.MeshLambertMaterial({ color: 0x2e2c2a });

    // 躯干 (瘦长)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.24), cloth);
    torso.position.y = 1.22;
    group.add(torso);
    parts.torso = torso;

    // 头 (略小, 前倾)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.26),
      new THREE.MeshLambertMaterial({ map: Tex.get('monsterFace') }));
    head.position.set(0, 1.82, 0.06);
    head.rotation.x = 0.28;
    group.add(head);
    parts.head = head;

    // 长发遮蔽感 (头顶黑罩)
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x0c0c0e }));
    hair.position.set(0, 1.9, -0.02);
    group.add(hair);

    // 手臂 (过长, 垂到膝下)
    [-1, 1].forEach(side => {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.27, 1.58, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.05, 0.11), skin);
      arm.position.y = -0.52;
      armPivot.add(arm);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.12), skin);
      hand.position.y = -1.12;
      armPivot.add(hand);
      armPivot.rotation.z = side * 0.08;
      group.add(armPivot);
      parts['arm' + side] = armPivot;
    });

    // 腿
    [-1, 1].forEach(side => {
      const legPivot = new THREE.Group();
      legPivot.position.set(side * 0.12, 0.82, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.82, 0.15), cloth);
      leg.position.y = -0.41;
      legPivot.add(leg);
      group.add(legPivot);
      parts['leg' + side] = legPivot;
    });

    group.visible = false;
    scene.add(group);
  }

  // ---------- 出现/消失 ----------
  function appearAt(x, z, facing = 0) {
    group.position.set(x, 0, z);
    group.rotation.y = facing;
    group.visible = true;
    state = 'standing';
    animT = 0;
    visibleTimer = 0;
  }

  function vanish() {
    state = 'hidden';
    group.visible = false;
    Sfx.stopHeartbeat();
  }

  // 瞬间消失 (玩家转头时)
  function vanishIfUnseen(camera) {
    if (state !== 'standing') return false;
    if (!isInView(camera)) {
      vanish();
      return true;
    }
    return false;
  }

  function isInView(camera) {
    const v = group.position.clone();
    v.y = 1.4;
    v.project(camera);
    return v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
  }

  // ---------- 追逐 ----------
  function startChase(caughtCb) {
    state = 'chasing';
    onCaught = caughtCb;
    speed = 0;
    Sfx.heartbeatLoop(1.6);
    Sfx.monsterGroan();
    groanTimer = 2.5;
  }

  function startStalk() {
    state = 'stalking';
    speed = 0;
    Sfx.heartbeatLoop(1);
  }

  // ---------- 更新 ----------
  function update(dt, playerPos, camera) {
    if (state === 'hidden') return;
    animT += dt;
    visibleTimer += dt;

    const toPlayer = playerPos.clone().sub(group.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    if (state === 'standing') {
      // 站立不动, 轻微摇晃 — 凝视玩家
      group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      parts.torso.rotation.z = Math.sin(animT * 0.9) * 0.03;
      parts.head.rotation.z = Math.sin(animT * 0.7) * 0.05;
      return;
    }

    if (state === 'stalking' || state === 'chasing') {
      const maxSpd = state === 'chasing' ? 2.35 : 1.0;
      speed = Math.min(maxSpd, speed + dt * 0.8);
      if (dist > 0.6) {
        toPlayer.normalize();
        const nx = group.position.x + toPlayer.x * speed * dt;
        const nz = group.position.z + toPlayer.z * speed * dt;
        // 怪物无视小型障碍 (穿过杂物增加不安), 但不穿墙
        if (!World.collides(nx, group.position.z, 0.2)) group.position.x = nx;
        if (!World.collides(group.position.x, nz, 0.2)) group.position.z = nz;
      }
      group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

      // 僵硬步行动画: 关节以正弦硬切换
      const step = Math.sin(animT * (state === 'chasing' ? 7 : 4));
      const stiff = Math.sign(step) * Math.pow(Math.abs(step), 0.4);
      parts['leg-1'].rotation.x = stiff * 0.5;
      parts['leg1'].rotation.x = -stiff * 0.5;
      parts['arm-1'].rotation.x = -stiff * 0.32;
      parts['arm1'].rotation.x = stiff * 0.32;
      // 躯干抽搐
      parts.torso.rotation.z = Math.sin(animT * 13) * 0.02 + stiff * 0.05;
      parts.head.rotation.z = Math.sin(animT * 9.7) * 0.08;
      parts.head.rotation.x = 0.28 + Math.sin(animT * 5.3) * 0.06;

      // 声音
      groanTimer -= dt;
      if (groanTimer <= 0) {
        Sfx.monsterGroan();
        groanTimer = 3 + Math.random() * 3;
      }

      // 抓住判定
      if (dist < 0.75 && onCaught) {
        const cb = onCaught;
        onCaught = null;
        vanish();
        cb();
      }
    }
  }

  return {
    build, appearAt, vanish, vanishIfUnseen, startChase, startStalk, update, isInView,
    get state() { return state; },
    get position() { return group ? group.position : new THREE.Vector3(); },
    get visible() { return group ? group.visible : false; },
  };
})();
