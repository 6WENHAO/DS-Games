// ============ 游戏主控制器 ============
const Game = (() => {
  let renderer, scene, camera;
  let rt = null, postScene = null, postCamera = null, postMat = null;
  let state = 'title';   // title | playing | note | caught | ending
  let clock = new THREE.Clock();
  let pointerLocked = false;
  let recTime = 0;
  let noteReturn = null;

  // PS1 低分辨率渲染
  const RENDER_W = 426, RENDER_H = 240;

  // ---------- 初始化 ----------
  function init() {
    const canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: !!window.__TEST__ });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;

    camera = new THREE.PerspectiveCamera(70, RENDER_W / RENDER_H, 0.05, 60);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a0e);
    scene.fog = new THREE.FogExp2(0x070b0f, 0.085);

    // 冷蓝绿环境光
    scene.add(new THREE.AmbientLight(0x36505a, 0.62));
    const moon = new THREE.DirectionalLight(0x4a6a78, 0.18);
    moon.position.set(3, 8, 2);
    scene.add(moon);

    World.init(scene);
    Player.init(camera, scene);
    Monster.build(scene);
    Events.placeTorchPickup();
    buildTorchPickupMesh();
    setupPost();
    bindEvents();
    animate();
  }

  // 手电筒拾取物模型
  function buildTorchPickupMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.26, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a8578 }));
    body.rotation.z = Math.PI / 2;
    const headM = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.08, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a564c }));
    headM.rotation.z = Math.PI / 2;
    headM.position.x = 0.16;
    g.add(body, headM);
    g.position.set(3.4, 0.92, -3);
    g.rotation.y = 0.7;
    scene.add(g);
    // 鞋柜
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.45),
      new THREE.MeshLambertMaterial({ map: Tex.get('doorWood', undefined, 361) }));
    shelf.position.set(3.5, 0.45, -3);
    scene.add(shelf);
    World.colliders.push({ minX: 2.9, maxX: 4.1, minZ: -3.3, maxZ: -2.7 });
    // 微弱高亮闪烁提醒
    const glow = new THREE.PointLight(0xa8c8b8, 0.25, 2, 2);
    glow.position.set(3.4, 1.1, -3);
    scene.add(glow);
    // 绑定到交互物上以便隐藏
    const it = World.interactables.find(i => i.label === '手电筒');
    if (it) {
      const orig = it.onUse;
      it.mesh = g;
      it.onUse = () => { g.visible = false; glow.intensity = 0; orig(); };
    }
  }

  // ---------- VHS 后处理 ----------
  function setupPost() {
    rt = new THREE.WebGLRenderTarget(RENDER_W, RENDER_H, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    });
    postScene = new THREE.Scene();
    postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rt.texture },
        uTime: { value: 0 },
        uFear: { value: 0 },
        uCaught: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uFear;
        uniform float uCaught;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 uv = vUv;
          // 轻微桶形畸变
          vec2 cc = uv - 0.5;
          uv = uv + cc * dot(cc, cc) * 0.12;

          // VHS 行抖动
          float jitter = (hash(vec2(floor(uv.y * 240.0), floor(uTime * 60.0))) - 0.5);
          uv.x += jitter * (0.0008 + uFear * 0.004 + uCaught * 0.03);

          // 色差
          float ca = 0.0012 + uFear * 0.003 + uCaught * 0.01;
          float rC = texture2D(tDiffuse, uv + vec2(ca, 0.0)).r;
          float gC = texture2D(tDiffuse, uv).g;
          float bC = texture2D(tDiffuse, uv - vec2(ca, 0.0)).b;
          vec3 col = vec3(rC, gC, bC);

          // 冷绿调色
          col = mix(col, col * vec3(0.82, 1.05, 0.96), 0.7);
          // 整体提亮
          col = col * 1.18 + 0.012;
          // 轻微 Bloom (亮部扩散近似)
          vec3 blur = texture2D(tDiffuse, uv + vec2(0.004, 0.0)).rgb
                    + texture2D(tDiffuse, uv - vec2(0.004, 0.0)).rgb
                    + texture2D(tDiffuse, uv + vec2(0.0, 0.006)).rgb
                    + texture2D(tDiffuse, uv - vec2(0.0, 0.006)).rgb;
          blur *= 0.25;
          col += max(blur - 0.55, 0.0) * 0.6;

          // 噪点
          float n = hash(uv * vec2(uTime * 91.0, uTime * 47.0));
          col += (n - 0.5) * (0.06 + uFear * 0.1 + uCaught * 0.4);

          // 扫描线
          float scan = sin(vUv.y * 240.0 * 3.14159) * 0.5 + 0.5;
          col *= 0.92 + scan * 0.08;

          // 暗角
          float vig = 1.0 - dot(cc, cc) * (1.1 + uFear * 1.2);
          col *= clamp(vig, 0.0, 1.0);

          // 恐惧时底部暗脉动
          col *= 1.0 - uFear * 0.18 * (0.5 + 0.5 * sin(uTime * 9.0));

          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
    postScene.add(quad);
  }

  // ---------- 开始 ----------
  async function startGame() {
    Sfx.init(); Sfx.resume();
    Sfx.uiSelect();
    // 立即黑屏, 再淡入
    const fadeEl = document.getElementById('fade-overlay');
    fadeEl.style.transition = 'none';
    fadeEl.style.opacity = 1;
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('hud').classList.remove('hidden');

    Player.spawn(0, 0, Math.PI);
    state = 'playing';
    Sfx.ambientLoop();
    Sfx.fluorescentBuzz();
    Events.start();
    await new Promise(r => setTimeout(r, 60));
    fade(false, 2600);
    requestPointerLock();
  }

  function fade(toBlack, ms = 1000, white = false) {
    const el = document.getElementById('fade-overlay');
    el.classList.toggle('white', white);
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity = toBlack ? 1 : 0;
    return new Promise(r => setTimeout(r, ms + 50));
  }

  // ---------- 纸条 ----------
  function showNote(text) {
    state = 'note';
    document.getElementById('note-text').textContent = text;
    document.getElementById('note-screen').classList.remove('hidden');
    document.exitPointerLock();
  }
  function closeNote() {
    state = 'playing';
    document.getElementById('note-screen').classList.add('hidden');
    Sfx.paperRustle();
    requestPointerLock();
  }

  // ---------- 被抓住 ----------
  async function onCaught() {
    if (state !== 'playing') return;
    state = 'caught';
    Sfx.caughtScream();
    Sfx.stopHeartbeat();
    postMat.uniforms.uCaught.value = 1;
    Player.frozen = true;
    await new Promise(r => setTimeout(r, 900));
    document.getElementById('caught-screen').classList.remove('hidden');
    document.exitPointerLock();
    Sfx.staticBurst(2, 0.3);
    await new Promise(r => setTimeout(r, 2600));
    // 重置到走廊起点 (保留进度)
    document.getElementById('caught-screen').classList.add('hidden');
    postMat.uniforms.uCaught.value = 0;
    Player.frozen = false;
    Player.fear = 0.5;
    Monster.vanish();
    if (Events.stage === 5) {
      // 追逐阶段: 重新出现在祭坛, 怪物重新追
      Player.spawn(12.5, -80, Math.PI);
      setTimeout(() => {
        Monster.appearAt(12.5, -86.5, 0);
        Monster.startChase(() => onCaught());
        Sfx.heartbeatLoop(1.8);
      }, 1500);
    } else {
      Player.spawn(0, -6, Math.PI);
      if (Events.stage === 4) {
        setTimeout(() => {
          Monster.appearAt(12.5, -50, 0);
          Monster.startStalk();
        }, 3000);
      }
    }
    state = 'playing';
    fade(false, 800);
    requestPointerLock();
  }

  // ---------- 逃脱结局 ----------
  async function onEscape() {
    if (state !== 'playing') return;
    state = 'ending';
    Monster.vanish();
    Sfx.stopHeartbeat();
    Sfx.bellToll();
    document.exitPointerLock();
    await fade(true, 1800, true);
    const el = document.getElementById('ending-screen');
    const txt = document.getElementById('ending-text');
    el.classList.remove('hidden');
    document.getElementById('fade-overlay').style.opacity = 0;
    const lines = '晨光刺眼。\n\n身后的公寓楼安静地立着，\n像什么都没有发生过。\n\n口袋里，\n有一枚冰凉的铜铃。\n\n— 深夜回廊 · 完 —';
    txt.textContent = '';
    for (const ch of lines) {
      txt.textContent += ch;
      await new Promise(r => setTimeout(r, ch === '\n' ? 120 : 90));
    }
    await new Promise(r => setTimeout(r, 3000));
    txt.textContent += '\n\n[ 刷新页面可重新进入 ]';
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    const canvas = renderer.domElement;
    document.addEventListener('pointerlockchange', () => {
      pointerLocked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('click', () => {
      if (state === 'playing' && !pointerLocked) requestPointerLock();
    });
    document.addEventListener('mousemove', e => {
      if (pointerLocked && state === 'playing') Player.onMouseMove(e.movementX, e.movementY);
    });
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyE' && !e.repeat) {
        if (state === 'note') { closeNote(); return; }
        if (state === 'playing') {
          const it = World.nearestInteract(
            new THREE.Vector3(Player.pos.x, 1.3, Player.pos.z), Player.lookDir());
          if (it) it.onUse();
        }
        return;
      }
      if (e.code === 'KeyF' && !e.repeat && state === 'playing') {
        Player.toggleTorch();
        return;
      }
      if (state === 'playing') Player.setKey(e.code, true);
    });
    document.addEventListener('keyup', e => Player.setKey(e.code, false));

    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-how').addEventListener('click', () => {
      Sfx.init(); Sfx.resume(); Sfx.uiSelect();
      document.getElementById('how-panel').classList.remove('hidden');
    });
    document.getElementById('btn-how-close').addEventListener('click', () => {
      Sfx.uiSelect();
      document.getElementById('how-panel').classList.add('hidden');
    });
  }

  function requestPointerLock() {
    if (state === 'playing') renderer.domElement.requestPointerLock();
  }

  // ---------- 交互提示 ----------
  function updateInteractTip() {
    const tip = document.getElementById('interact-tip');
    if (state !== 'playing') { tip.classList.add('hidden'); return; }
    const it = World.nearestInteract(
      new THREE.Vector3(Player.pos.x, 1.3, Player.pos.z), Player.lookDir());
    if (it) {
      document.getElementById('interact-label').textContent = it.label;
      tip.classList.remove('hidden');
    } else {
      tip.classList.add('hidden');
    }
  }

  // ---------- REC 计时 ----------
  function updateRec(dt) {
    recTime += dt;
    const h = (recTime / 3600) | 0, m = ((recTime / 60) | 0) % 60, s = (recTime | 0) % 60;
    const pad = n => (n < 10 ? '0' : '') + n;
    document.getElementById('rec-time').textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  // ---------- 主循环 ----------
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (state === 'playing' || state === 'caught') {
      if (state === 'playing') {
        Player.update(dt);
        Monster.update(dt, Player.pos, camera);
        Events.update(dt, Player.pos, camera);
        updateInteractTip();
        updateRec(dt);
      }
      World.update(dt, t, Player.pos);
    }

    // 渲染: 低分辨率 → VHS 后处理放大
    postMat.uniforms.uTime.value = t;
    postMat.uniforms.uFear.value = Player.fear;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }

  window.addEventListener('DOMContentLoaded', init);

  return {
    get state() { return state; },
    showNote, closeNote, onCaught, onEscape, requestPointerLock,
  };
})();
