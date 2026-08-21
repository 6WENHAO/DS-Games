/* ==========================================================================
 * tutorial.js — an in-game trainer that walks a new crewman through the tank.
 *
 * Every step validates against real simulator state, so the only way past a
 * step is to actually do it: throw the switch, crank the engine, open the
 * breech, arm the circuit, hit the target. The step also names the controls it
 * wants, and main.js pulses those hotspots inside the compartment (with an
 * edge arrow when they are out of view).
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.M;
  const tx = p => (global.L ? global.L.m(p[0], p[1]) : p[0]);

  /* every step: {id, title, text, hint, highlight[], station, skip(), done(), onEnter()} */
  function buildSteps() {
    return [
      {
        id: 'look',
        title: ['Welcome aboard', '欢迎登车'],
        text: ['You are sitting inside a real crew compartment. Hold the left mouse button and drag to look around.',
          '你正坐在一个真实的乘员舱里。按住鼠标左键拖动，环视四周。'],
        hint: ['Drag with the left mouse button', '按住鼠标左键拖动'],
        done: (g) => Math.abs(g.look.yaw) + Math.abs(g.look.pitch) > 0.28
      },
      {
        id: 'stations',
        title: ['Move around the crew', '在乘员之间移动'],
        text: ['Press 2 to slide into the gunner\'s seat. Each station sees and reaches different controls.',
          '按 2 进入炮长位置。每个乘员位置能看到、能摸到的东西都不一样。'],
        hint: ['Press 2', '按 2'],
        done: (g) => g.station === 'gunner'
      },
      {
        id: 'back-to-driver',
        title: ['Back to the driver', '回到驾驶员位置'],
        text: ['Press 1. Cold starting a tank is the driver\'s job, and nothing else works until the engine runs.',
          '按 1。冷车起动是驾驶员的活，发动机不转，其他一切都免谈。'],
        hint: ['Press 1', '按 1'],
        done: (g) => g.station === 'driver'
      },
      {
        id: 'master',
        title: ['Battery on', '接通蓄电池'],
        text: ['Click the red master battery switch (or press M). Without it the buses are dead: no starter, no lamps, no radio.',
          '点击红色的主蓄电池开关（或按 M）。不合上它，全车母线没电：起动机、灯光、电台都不工作。'],
        hint: ['Click the highlighted switch, or press M', '点击高亮的开关，或按 M'],
        highlight: ['master'], station: 'driver',
        done: (g, t) => t.sys.master
      },
      {
        id: 'fuel',
        title: ['Open the fuel cock', '打开燃油阀'],
        text: ['Turn the fuel shut-off cock (or press N). With it shut the engine will crank and cough, and never catch.',
          '打开燃油切断阀（或按 N）。阀门关着，发动机只会空转干咳，永远打不着。'],
        hint: ['Click the highlighted valve, or press N', '点击高亮的阀门，或按 N'],
        highlight: ['fuelcock'], station: 'driver',
        done: (g, t) => t.sys.fuelCock
      },
      {
        id: 'start',
        title: ['Crank it', '起动发动机'],
        text: ['Press the starter button (or press I) and listen. Watch the tachometer come alive.',
          '按下起动按钮（或按 I），听听声音。看着转速表活起来。'],
        hint: ['Click the starter, or press I', '点击起动按钮，或按 I'],
        highlight: ['starter', 'tach'], station: 'driver',
        done: (g, t) => t.sys.engineOn
      },
      {
        id: 'brake',
        title: ['Release the parking brake', '松开驻车制动'],
        text: ['Pull the parking brake lever off (or press P).',
          '把驻车制动手柄松开（或按 P）。'],
        hint: ['Click the brake lever, or press P', '点击制动手柄，或按 P'],
        highlight: ['parkbrake'], station: 'driver',
        done: (g, t) => !t.sys.parkBrake
      },
      {
        id: 'gear',
        title: ['Select a gear', '挂上档'],
        text: ['Shift into first with the gear lever (click it, or press Shift). Right click the lever to come back down.',
          '用变速杆挂上一档（点击它，或按 Shift）。右键点击手柄可以降档。'],
        hint: ['Click the gear lever, or press Shift', '点击变速杆，或按 Shift'],
        highlight: ['gear'], station: 'driver',
        done: (g, t) => t.sys.gear !== 0
      },
      {
        id: 'drive',
        title: ['Drive', '开动起来'],
        text: ['Hold W for throttle and steer with A and D. Move the tank 12 metres.',
          '按住 W 加油门，用 A 和 D 转向。把车开出 12 米。'],
        hint: ['W throttle · A / D steer · S brake', 'W 油门 · A / D 转向 · S 制动'],
        onEnter: (g, t) => { g.tutorial.mark = M.copy(t.pos); },
        done: (g, t) => g.tutorial.mark && M.dist(t.pos, g.tutorial.mark) > 12
      },
      {
        id: 'gunner',
        title: ["The gunner's seat", '炮长位置'],
        text: ['Press 2. Notice the compartment: the turret you are sitting in rotates around the driver below.',
          '按 2。注意这个战斗室：你所在的炮塔会绕着下面的驾驶员一起转动。'],
        hint: ['Press 2', '按 2'],
        done: (g) => g.station === 'gunner'
      },
      {
        id: 'breech',
        title: ['Open the breech', '打开炮闩'],
        text: ['The loader opens the breech before a round can go in. Click the breech lever, or press B.',
          '装填手要先打开炮闩才能推弹。点击炮闩手柄，或按 B。'],
        hint: ['Click the breech lever, or press B', '点击炮闩手柄，或按 B'],
        highlight: ['breech'],
        skip: (g, t) => t.spec.autoloader,
        done: (g, t) => t.sys.breechOpen || !!t.sys.loaded
      },
      {
        id: 'load',
        title: ['Load a round', '装填炮弹'],
        text: ['Ram a round home (or press G). Watch the brass in the racks: it really is the ammunition you are firing.',
          '把炮弹推入膛（或按 G）。注意弹架上的弹药：你打出去的就是它们。'],
        textAuto: ['Send the autoloader a round (or press G). The carousel under the floor does the lifting.',
          '让自动装弹机上弹（或按 G）。地板下的转盘会替你搬弹。'],
        hint: ['Click the rammer / autoloader, or press G', '点击推弹按钮 / 装弹机，或按 G'],
        highlight: ['ram', 'autoloader'],
        done: (g, t) => !!t.sys.loaded
      },
      {
        id: 'arm',
        title: ['Arm the firing circuit', '解除击发保险'],
        text: ['The trigger does nothing while the circuit is SAFE. Flip the safety (or press K).',
          '击发电路处于保险位时扳机毫无反应。打开保险开关（或按 K）。'],
        hint: ['Click the safety switch, or press K', '点击保险开关，或按 K'],
        highlight: ['safety'],
        done: (g, t) => !t.sys.safety
      },
      {
        id: 'sight',
        title: ['Eye to the sight', '眼睛贴上瞄准镜'],
        text: ['Click the gunner\'s sight (or press V) to look through the optic.',
          '点击炮长瞄准镜（或按 V），从光学镜里观察。'],
        hint: ['Click the sight, or press V', '点击瞄准镜，或按 V'],
        highlight: ['gunsight'],
        done: (g) => g.view === 'sight'
      },
      {
        id: 'range',
        title: ['Range to the target', '测定目标距离'],
        text: ['Lase the target with L. The aiming mark below the cross drops to the right super elevation.',
          '按 L 对目标激光测距。十字线下方的瞄准标记会自动落到正确的超高位置。'],
        textNoLrf: ['No rangefinder here: turn the range drum with [ and ] until the mark suits the target range.',
          '这辆车没有测距仪：用 [ 和 ] 转动表尺鼓轮，把瞄准标记调到目标距离上。'],
        hint: ['L to lase · [ ] range drum', 'L 激光测距 · [ ] 调整表尺'],
        highlight: ['lrf', 'rangedial'],
        onEnter: (g, t) => { g.tutorial.mark2 = t.sys.sight.range; },
        done: (g, t) => t.sys.sight.lased || t.sys.sight.range !== g.tutorial.mark2
      },
      {
        id: 'fire',
        title: ['Fire', '开火'],
        text: ['Traverse with Q and E, elevate with R and F, then press Space. The targets start 210 m up the range.',
          '用 Q / E 转动炮塔，R / F 调整俯仰，然后按空格。靶车从 210 米开始向北排开。'],
        hint: ['Q / E traverse · R / F elevate · Space fire', 'Q / E 转塔 · R / F 俯仰 · 空格击发'],
        onEnter: (g, t) => { g.tutorial.shots = t.sys.shots; },
        done: (g, t) => t.sys.shots > (g.tutorial.shots || 0)
      },
      {
        id: 'hit',
        title: ['Hit something', '打中目标'],
        text: ['Reload and keep correcting until a round strikes a target. Splash reports tell you short or over.',
          '重新装填并不断修正，直到命中靶车。落点提示会告诉你打远还是打近。'],
        hint: ['G load · Space fire · L lase', 'G 装填 · 空格击发 · L 测距'],
        onEnter: (g, t) => { g.tutorial.hits = t.sys.hits; },
        done: (g, t) => t.sys.hits > (g.tutorial.hits || 0)
      },
      {
        id: 'commander',
        title: ["The commander's cupola", '车长指挥塔'],
        text: ['Press 4, open the cupola hatch (H) and then press V until your head is out of the tank.',
          '按 4，打开指挥塔舱盖（H），然后按 V 直到把头探出车外。'],
        hint: ['4 commander · H hatch · V view', '4 车长 · H 舱盖 · V 切换视角'],
        highlight: ['hatch_commander'],
        done: (g, t) => g.view === 'unbutton' || (g.station === 'commander' && t.sys.hatches.commander > 0.5)
      },
      {
        id: 'done',
        title: ['Trained', '训练结束'],
        text: ['That is the whole loop: drive, load, lay, fire. Every other switch in here does something too — hover one to read what.  Tab returns to the garage to try another tank.',
          '整个循环就是这样：驾驶、装填、瞄准、击发。这里其他每个开关同样都有作用——把鼠标停上去就能看到说明。按 Tab 回到车库，换一辆坦克试试。'],
        hint: ['Tab garage · F1 help · F2 restart this tutorial', 'Tab 车库 · F1 帮助 · F2 重开教程'],
        done: () => false, final: true
      }
    ];
  }

  const Tutorial = {
    active: false,
    idx: 0,
    steps: [],
    flash: 0,
    mark: null,
    mark2: 0,
    shots: 0,
    hits: 0,
    pulse: 0,
    finished: false,

    seen() {
      try { return global.localStorage && global.localStorage.getItem('armour.tutorial') === 'done'; }
      catch (e) { return false; }
    },
    markSeen() {
      try { global.localStorage && global.localStorage.setItem('armour.tutorial', 'done'); } catch (e) { }
    },

    start(game) {
      this.steps = buildSteps();
      this.idx = 0;
      this.active = true;
      this.finished = false;
      this.flash = 0;
      game.tutorial = this;
      this.skipDisabled(game);
      this.enter(game);
    },
    stop(game) {
      this.active = false;
      this.markSeen();
    },
    /** drop steps that make no sense for this vehicle */
    skipDisabled(game) {
      const t = game.player;
      if (!t) return;
      this.steps = this.steps.filter(s => !(s.skip && s.skip(game, t)));
    },
    enter(game) {
      const s = this.current();
      if (!s) return;
      if (s.onEnter && game.player) s.onEnter(game, game.player);
      this.pulse = 0;
    },
    current() { return this.active ? this.steps[this.idx] : null; },
    next(game) {
      if (!this.active) return;
      if (this.idx >= this.steps.length - 1) { this.finished = true; this.stop(game); return; }
      this.idx++;
      this.flash = 0.9;
      this.enter(game);
      if (game.sfx) game.sfx.play('ready');
    },
    prev(game) {
      if (!this.active || this.idx === 0) return;
      this.idx--;
      this.enter(game);
    },

    update(game, dt) {
      if (!this.active) return;
      this.pulse += dt;
      if (this.flash > 0) this.flash -= dt;
      const s = this.current();
      const t = game.player;
      if (!s || !t || s.final) return;
      if (s.done(game, t)) this.next(game);
    },

    /** is this hotspot one the current step is asking for? */
    isHighlighted(hs) {
      if (!this.active || !hs) return false;
      const s = this.current();
      if (!s || !s.highlight) return false;
      return s.highlight.indexOf(hs.id) >= 0;
    },
    highlightIds() {
      const s = this.current();
      return (s && s.highlight) || null;
    },
    glow() { return 0.45 + 0.35 * Math.sin(this.pulse * 5); },

    /* ---- text for the panel, resolved in the active language ---- */
    title() { const s = this.current(); return s ? tx(s.title) : ''; },
    text(game) {
      const s = this.current();
      if (!s) return '';
      const t = game && game.player;
      if (s.id === 'load' && t && t.spec.autoloader && s.textAuto) return tx(s.textAuto);
      if (s.id === 'range' && t && !t.spec.optics.lrf && s.textNoLrf) return tx(s.textNoLrf);
      return tx(s.text);
    },
    hint() { const s = this.current(); return s && s.hint ? tx(s.hint) : ''; },
    progress() { return (this.idx + 1) + ' / ' + this.steps.length; },
    stepLabel() {
      return global.L && global.L.lang === 'zh'
        ? '第 ' + (this.idx + 1) + ' / ' + this.steps.length + ' 步'
        : 'Step ' + (this.idx + 1) + ' of ' + this.steps.length;
    }
  };

  global.Tutorial = Tutorial;
  if (typeof module !== 'undefined' && module.exports) module.exports = { Tutorial, buildSteps };
})(typeof window !== 'undefined' ? window : globalThis);
