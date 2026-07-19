// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const dom = {
  game: $('game'),
  title: $('title-screen'),
  loading: $('loading'),
  fade: $('fade'),
  vhs: $('vhs-overlay'),
  hud: $('hud'),
  prompt: $('prompt'),
  taskList: $('task-list'),
  subtitle: $('subtitle'),
  crosshair: $('crosshair'),
  noteOverlay: $('note-overlay'),
  noteText: $('note-text'),
  pause: $('pause-screen'),
  jumpscare: $('jumpscare'),
  scareImg: $('scare-img'),
  ending: $('ending'),
  endingText: $('ending-text'),
  sanityFill: $('sanity-fill'),
  clock: $('clock'),
  batPct: $('batt-pct'),
  loadFill: $('load-fill'),
  startBtn: $('start-btn'),
  restart: $('restart'),
};

const NOTE_TEXTS = {
  note: `留  言
---
前辈：

请帮忙做一下深夜的盘点。
另外，仓库的库存也请
检查一下。

还有，最近附近有些奇怪的
传闻，请多加小心。

你见到那个女人了吗？
---
店长`,
  endnote: `—— 她还在
   看着你 ——`,
};

// ---------- jump-scare canvas image generation ----------
function genScareFace() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  // dark bg
  x.fillStyle = '#030103';
  x.fillRect(0, 0, 1024, 1024);

  // Face shape - pale, gaunt
  x.fillStyle = '#b8b4aa';
  x.beginPath();
  x.ellipse(512, 520, 200, 260, 0, 0, Math.PI * 2);
  x.fill();

  // eye sockets - dark sunken
  x.fillStyle = '#0e0a0a';
  x.beginPath(); x.ellipse(430, 440, 52, 46, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(594, 440, 52, 46, 0, 0, Math.PI * 2); x.fill();

  // eyes - staring wide, bloodshot
  x.fillStyle = '#fff';
  x.beginPath(); x.arc(435, 438, 34, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(589, 438, 34, 0, Math.PI * 2); x.fill();
  // irises - pinpointed
  x.fillStyle = '#1a0a0a';
  x.beginPath(); x.arc(438, 438, 14, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(592, 438, 14, 0, Math.PI * 2); x.fill();
  // red veins
  x.strokeStyle = '#8a2030'; x.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 36 + Math.random() * 16;
    x.beginPath(); x.moveTo(435 + Math.cos(a) * 34, 438 + Math.sin(a) * 34);
    x.lineTo(435 + Math.cos(a) * r, 438 + Math.sin(a) * r); x.stroke();
    x.beginPath(); x.moveTo(592 + Math.cos(a) * 34, 438 + Math.sin(a) * 34);
    x.lineTo(592 + Math.cos(a) * r, 438 + Math.sin(a) * r); x.stroke();
  }

  // nose
  x.fillStyle = '#a09890';
  x.beginPath(); x.moveTo(505, 470); x.lineTo(540, 540); x.lineTo(484, 540); x.fill();

  // mouth - wide, something wrong
  x.fillStyle = '#1a0a0a';
  x.beginPath(); x.ellipse(512, 630, 110, 44, 0, 0, Math.PI * 2); x.fill();
  // teeth
  x.fillStyle = '#ccc8bc';
  for (let i = 0; i < 8; i++) {
    x.fillRect(475 + i * 11, 610, 9, 22);
  }
  // blood from mouth
  x.fillStyle = '#8a1220';
  x.beginPath(); x.moveTo(440, 650); x.quadraticCurveTo(480, 680, 512, 720);
  x.quadraticCurveTo(560, 680, 584, 650); x.fill();
  // blood drips
  for (let i = 0; i < 8; i++) {
    x.beginPath(); x.arc(450 + Math.random() * 120, 640 + Math.random() * 80, 4 + Math.random() * 6, 0, Math.PI * 2);
    x.fill();
  }

  // hair - dark, long, messy
  x.fillStyle = '#05050a';
  x.beginPath(); x.arc(512, 380, 240, Math.PI * 1.08, Math.PI * 1.92); x.lineTo(700, 760);
  x.lineTo(340, 760); x.fill();

  // grain overlay
  for (let i = 0; i < 4000; i++) {
    x.fillStyle = `rgba(0,0,0,${Math.random()*0.3})`;
    x.fillRect(Math.random()*1024, Math.random()*1024, 2, 2);
  }

  dom.scareImg.src = c.toDataURL();
}

// ---------- Game Engine ----------
class MainGame {
  constructor() {
    this.state = 'title'; // title | intro | playing | jumpscare | ending
    this.currentTask = 0;
    this.tasks = [];
    this.notes = {};
    this.time = 0;
    this.gameTime = 3600 * 3; // 03:00:00
    this.scareTriggered = false;
    this.sanity = 100;
    this.scene = null; this.camera = null; this.renderer = null;
    this.postFX = null; this.audio = null; this.world = null;
    this.player = null; this.ghost = null;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 3.5;
    this.clock = new THREE.Clock(false);
    this.fpsFrames = 0;
  }

  async start() {
    try {
      dom.startBtn.disabled = true;
      dom.loading.classList.remove('hidden');

      // simulate progressive loading for vibe
      await new Promise(r => setTimeout(r, 600));
      dom.loadFill.style.width = '25%';
      this.audio = new AudioEngine();
      this.audio.init();
      await new Promise(r => setTimeout(r, 400));
      dom.loadFill.style.width = '55%';
      await this._setupThree();
      dom.loadFill.style.width = '80%';
      await new Promise(r => setTimeout(r, 300));
      dom.loadFill.style.width = '100%';

      genScareFace();

      // finalize
      await new Promise(r => setTimeout(r, 200));
      dom.loading.classList.add('hidden');
      dom.fade.style.opacity = '1';
      dom.title.classList.add('hidden');
      dom.vhs.classList.remove('hidden');
      dom.hud.classList.remove('hidden');

      this.audio.resume();
      this.audio.startAmbience();

      // start directly in playing, show intro subtitle
      this.state = 'playing';
      this._initGameLogic();

      // lights OFF at start (first task is to turn them on)
      this.world.setLightsOn(false);
      // flashlight on so player can see
      this.player.flashlight.intensity = 3;
      this.player.flashOn = true;

      this._requestLock();

      // fade in
      setTimeout(() => { dom.fade.style.opacity = '0'; }, 200);

      // intro subtitle
      this._showSubtitle('凌晨3点，安静的店内。\n夜班开始了。', 5000);

      this._startLoop();
    } catch (e) {
      console.error('Init error:', e);
      dom.loading.classList.add('hidden');
      dom.startBtn.disabled = false;
    }
  }

  async _setupThree() {
    this.renderer = new THREE.WebGLRenderer({ canvas: dom.game, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1); // intentionally chunky
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x080c10, 0.0003);
    this.camera = new THREE.PerspectiveCamera(73, window.innerWidth / window.innerHeight, 0.15, 40);
    this.camera.position.set(0, 1.62, 6.5);

    this.world = new World(this.scene);
    this.player = new Player(this.camera, this.world, this.audio);
    this.ghost = new Ghost(this.scene);
    // camera must be in the scene graph so the flashlight (its child) lights the world
    this.scene.add(this.camera);

    this.postFX = new PostFX(this.renderer, this.scene, this.camera);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.postFX.setSize(window.innerWidth, window.innerHeight);
    });

    // pointer lock
    document.addEventListener('click', () => {
      if (this.state === 'playing' || this.state === 'intro') this._requestLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.player.locked = document.pointerLockElement === this.renderer.domElement;
      if (!this.player.locked && this.state === 'playing') {
        dom.pause.classList.remove('hidden');
      } else {
        dom.pause.classList.add('hidden');
      }
    });
    this.player.pointerLockChange = () => {};
  }

  _requestLock() {
    if (document.pointerLockElement) return;
    try { this.renderer.domElement.requestPointerLock(); } catch (e) {}
  }

  _initGameLogic() {
    this.tasks = [
      { id: 'lights', jp: '打开店内的灯', en: 'Turn on the lights' },
      { id: 'timeclock', jp: '打卡上班', en: 'Clock in' },
      { id: 'stock', jp: '把到货的箱子上架', en: 'Stock the new inventory' },
      { id: 'fridge', jp: '检查冷藏柜', en: 'Check the refrigerators' },
      { id: 'backdoor', jp: '查看后面的仓库', en: 'Check the back room' },
      { id: 'exit', jp: '离开便利店', en: 'Leave the store' },
    ];
    this.currentTask = 0;
    this._renderTasks();

    // init tasks
    const ias = this.world.interactables;
    const byId = {};
    for (const i of ias) byId[i.id] = i;
    this.byId = byId;
    byId.exit.locked = true;       // locked until all done
    byId.backdoor.locked = true;   // locked until fridge done
    byId.lights_task = true;       // special: click any light controller

    // flag lights task
    this.tasks[0]._done = false;
  }

  _renderTasks() {
    dom.taskList.innerHTML = '';
    for (let i = 0; i < this.tasks.length; i++) {
      const t = this.tasks[i];
      const li = document.createElement('li');
      li.textContent = t.jp;
      if (t._done) li.classList.add('done');
      if (i === this.currentTask && !t._done) li.classList.add('active');
      dom.taskList.appendChild(li);
    }
  }

  _completeTask(idx) {
    if (idx >= this.tasks.length) return;
    const t = this.tasks[idx];
    if (t._done) return;
    t._done = true;
    this.audio.taskComplete();

    // side effects
    switch (t.id) {
      case 'lights':
        this.world.setLightsOn(true);
        this.audio.blip(660, 0.1, 0.08);
        // change light switch to green
        if (this.world.lightSwitchBut) {
          this.world.lightSwitchBut.material.color.setHex(0x33ff33);
          this.world.lightSwitchBut.material.emissive.setHex(0x22ff22);
        }
        break;
      case 'timeclock':
        this.world.clockLed.material.color.setHex(0x33ff33);
        this.world.clockLed.material.emissive.setHex(0x22ff22);
        break;
      case 'stock':
        // animate boxes vanishing
        for (const b of this.world.stockBoxes) {
          setTimeout(() => b.scale.set(0, 0, 0), this.world.stockBoxes.indexOf(b) * 250);
        }
        break;
      case 'fridge':
        this.byId.backdoor.locked = false;
        break;
      case 'backdoor':
        this.byId.exit.locked = false; // exit unlocked after back room
        break;
    }

    this.currentTask = idx + 1;
    this._renderTasks();
  }

  _tryInteract() {
    if (this.state !== 'playing') return;
    const origin = this.camera.position;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    let best = null, bestDist = Infinity;
    for (const ia of this.world.interactables) {
      if (ia.done) continue;
      const d = origin.distanceTo(ia.position);
      if (d > ia.radius) continue;
      // angle check (~30 deg)
      const to = new THREE.Vector3().subVectors(ia.position, origin).normalize();
      const dot = dir.dot(to);
      if (dot < 0.85) continue;
      if (d < bestDist) { bestDist = d; best = ia; }
    }

    if (!best) return;

    // special case: lights (first task)
    if (best.id === 'lights' && this.currentTask === 0) {
      this._completeTask(0);
      best.done = true;
      return;
    }
    if (best.id === 'timeclock' && this.currentTask === 1) {
      this._completeTask(1);
      best.done = true;
      return;
    }
    if (best.id === 'stock' && this.currentTask === 2) {
      this._completeTask(2);
      best.done = true;
      return;
    }
    if (best.id === 'fridge' && this.currentTask === 3) {
      this._completeTask(3);
      best.done = true;
      return;
    }
    if (best.id === 'backdoor' && this.currentTask === 4) {
      if (best.locked) return;
      this._completeTask(4);
      best.done = true;
      return;
    }
    if (best.id === 'exit' && this.currentTask === 5) {
      if (best.locked) return;
      this._triggerEnding();
      return;
    }
    if (best.id === 'note') {
      this._showNote('note');
      return;
    }
  }

  _showNote(key) {
    this.state = 'reading';
    dom.noteOverlay.classList.remove('hidden');
    dom.noteText.textContent = NOTE_TEXTS[key] || key;
    if (this.player.enabled) {
      this.player.enabled = false;
      document.exitPointerLock();
    }
  }

  _hideNote() {
    dom.noteOverlay.classList.add('hidden');
    this.state = 'playing';
    this._requestLock();
  }

  _triggerJumpscare() {
    if (this.scareTriggered) return;
    this.scareTriggered = true;
    this.state = 'jumpscare';
    document.exitPointerLock();
    this.player.enabled = false;

    this.audio.scare();
    dom.jumpscare.classList.remove('hidden');

    setTimeout(() => {
      dom.jumpscare.classList.add('hidden');
      dom.fade.style.opacity = '1';
      setTimeout(() => {
        dom.ending.classList.remove('hidden');
        dom.endingText.classList.add('show');
        dom.endingText.textContent = '深夜值班\n—— 完 ——';
        dom.vhs.classList.add('hidden');
        dom.hud.classList.add('hidden');
        dom.restart.classList.remove('hidden');
        this.state = 'ending';
      }, 1200);
    }, 800);
  }

  _triggerEnding() {
    this.player.enabled = false;
    document.exitPointerLock();
    dom.fade.style.opacity = '1';
    this.audio.drone(false);

    setTimeout(() => {
      dom.ending.classList.remove('hidden');
      dom.endingText.className = '';
      dom.endingText.textContent = '今晚辛苦了。\n明天见。';
      dom.endingText.classList.add('show');
      dom.restart.classList.remove('hidden');
      this.state = 'ending';
    }, 1500);
  }

  _updatePrompt() {
    if (this.state !== 'playing') { dom.prompt.classList.add('hidden'); return; }

    const origin = this.camera.position;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    let best = null, bestDist = Infinity;
    for (const ia of this.world.interactables) {
      if (ia.done) continue;
      const d = origin.distanceTo(ia.position);
      if (d > ia.radius) continue;
      const to = new THREE.Vector3().subVectors(ia.position, origin).normalize();
      const dot = dir.dot(to);
      if (dot < 0.85) continue;
      if (d < bestDist) { bestDist = d; best = ia; }
    }

    if (best) {
      const lockedIdx = this.tasks.findIndex(t => t.id === best.id && !t._done);
      const isCurrent = (lockedIdx === this.currentTask);
      // check if locked door
      if (best.locked) {
        dom.prompt.innerHTML = `<span class="key">E</span>${best.label} <span style="font-size:11px;color:#a44;">🔒已上锁</span>`;
      } else if (isCurrent && best.id !== 'note') {
        dom.prompt.innerHTML = `<span class="key">E</span>${best.label}`;
      } else if (best.id === 'note') {
        dom.prompt.innerHTML = `<span class="key">E</span>${best.label}`;
      } else if (lockedIdx > this.currentTask) {
        dom.prompt.innerHTML = `<span class="key">E</span>${best.label} <span style="font-size:11px;color:#a88;">(请先完成其他工作)</span>`;
      } else {
        dom.prompt.innerHTML = `<span class="key">E</span>${best.label}`;
      }
      dom.prompt.classList.remove('hidden');
      dom.crosshair.classList.add('active');
    } else {
      dom.prompt.classList.add('hidden');
      dom.crosshair.classList.remove('active');
    }
  }

  _startLoop() {
    const loop = () => {
      requestAnimationFrame(loop);
      const raw = this.clock.getDelta();
      if (raw <= 0) return;
      const dt = Math.min(raw, 0.1);
      this._update(dt);
    };
    this.clock.start();
    loop();
  }

  _update(dt) {
    this.time += dt;

    // game clock
    this.gameTime += dt * 210; // accelerated
    const h = Math.floor(this.gameTime / 3600) % 24;
    const m = Math.floor((this.gameTime % 3600) / 60);
    const s = Math.floor(this.gameTime % 60);
    dom.clock.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    dom.batPct.textContent = Math.max(0, 98 - Math.floor((this.gameTime - 10800) / 11)) + '%';

    // player update (only when locked & active)
    this.player.enabled = (this.state === 'playing') && this.player.locked;
    this.player.update(dt);

    // prompt
    this._updatePrompt();

    // ghost AI
    if (this.currentTask >= 2) this.ghost.setPhase(1);
    if (this.currentTask >= 4) this.ghost.setPhase(2);
    this.ghost.update(dt, this.player.pos);

    // horror events based on task progress
    this._horrorEvents(dt);

    // sanity drain near ghost
    if (this.ghost.visible) {
      const d = this.player.pos.distanceTo(this.ghost.group.position);
      this.sanity = Math.max(0, this.sanity - dt * (8 - Math.min(7, d)) * 3);
    } else {
      this.sanity = Math.min(100, this.sanity + dt * 4);
    }
    dom.sanityFill.style.width = this.sanity + '%';
    this.audio.setDread((100 - this.sanity) / 100);

    // post-FX tension
    this.postFX.setDistort(this.sanity < 40 ? (40 - this.sanity) * 0.0025 : 0);
    this.postFX.setGrain(0.10 + (100 - this.sanity) * 0.002);
    this.postFX.setDesat(0.25 + (100 - this.sanity) * 0.004);

    // check for ghost proximity jumpscare
    if (this.ghost.visible && this.player.pos.distanceTo(this.ghost.group.position) < 1.1 && this.state === 'playing') {
      this.ghost.triggerJumpscare();
      this._triggerJumpscare();
    }

    this.postFX.render(dt);
  }

  _horrorEvents(dt) {
    if (this.state !== 'playing') return;
    const task = this.currentTask;

    // flickering lights after task 2
    if (task >= 2 && Math.random() < dt * 0.06) {
      this.world.setLightsOn(false);
      this.audio.lightFlicker();
      setTimeout(() => this.world.setLightsOn(true, 0.3 + Math.random() * 0.7), 80 + Math.random() * 200);
    }

    // door chime randomly at night
    if (task >= 2 && Math.random() < dt * 0.015 && this.audio && Math.random() < 0.3) {
      this.audio.doorChime();
      this._showSubtitle('欢迎光临...', 2000);
    }

    // whisper audio
    if (task >= 3 && Math.random() < dt * 0.04) {
      this.audio.whisper();
      this._showSubtitle('救救我...', 2500);
    }

    // heartbeat when ghost visible
    if (this.ghost.visible && Math.random() < dt * 1.0) {
      this.audio.heartbeat();
    }

    // back door creak
    if (task >= 3 && Math.random() < dt * 0.012) {
      this.audio.doorCreak();
    }

    // animate doors
    if (task >= 3 && Math.random() < dt * 0.08) {
      const dl = this.world.doorL;
      const dr = this.world.doorR;
      if (dl) {
        const a = (Math.sin(this.time * 5 + Math.random()) * 0.15);
        dl.position.x = dl.userData.baseX + a;
        dr.position.x = dr.userData.baseX - a;
      }
    }
  }

  _showSubtitle(text, duration = 3000) {
    dom.subtitle.textContent = text;
    dom.subtitle.classList.remove('hidden');
    clearTimeout(this._subTimeout);
    this._subTimeout = setTimeout(() => dom.subtitle.classList.add('hidden'), duration);
  }

  // --- event handlers (called from main) ---
  onKeyDown(code) {
    if (code === 'KeyE') {
      if (this.state === 'reading') {
        this._hideNote();
      } else if (this.state === 'playing') {
        this._tryInteract();
      }
    }
    if (code === 'Escape') {
      // handled by pointerlockchange
    }
  }
}

// ---------- bootstrap ----------
const game = new MainGame();

dom.startBtn.addEventListener('click', () => game.start());

dom.restart.addEventListener('click', () => location.reload());

document.addEventListener('keydown', (e) => {
  game.onKeyDown(e.code);
});
