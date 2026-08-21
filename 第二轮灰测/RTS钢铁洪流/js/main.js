/* ===================================================================
   main.js — 启动、生命周期、主循环

   URL 调试参数（无头截图与联调用）：
     ?dev=1                跳过标题直接开局
     &seed=12345           固定地图种子
     &size=small|medium|large
     &diff=easy|normal|hard
     &faction=guard|steel
     &fog=0                关闭战争迷雾
     &fast=90              开局先以固定步长模拟 90 秒（截"打起来"的图）
     &spawn=1              在双方之间刷一批部队，方便截战斗画面
     &zoom=0.8             初始缩放
     &debug=1              打开性能叠层
     &grid=1               显示网格
   例：index.html?dev=1&fast=120&spawn=1&debug=1
   =================================================================== */
(function () {
  'use strict';
  const R = window.R;
  const U = R.U;

  const App = R.App = {
    ui: null, game: null, renderer: null, input: null,
    running: false,
    lastT: 0,
    rafId: 0,
    errors: [],

    /**
     * 把异常显示在页面上。
     * 无头截图环境下拿不到 devtools 控制台，把错误画到 DOM 里是唯一
     * 能"看见"它的办法（配合 msedge --dump-dom 可直接读出文本）。
     */
    fatal(where, e) {
      const msg = where + ': ' + (e && e.stack ? e.stack : String(e));
      this.errors.push(msg);
      console.error(msg);
      let box = document.getElementById('errbox');
      if (!box) {
        box = document.createElement('div');
        box.id = 'errbox';
        box.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:999;' +
          'background:#3a0d08;color:#ffd0c4;font:12px/1.5 Consolas,monospace;' +
          'padding:8px 12px;white-space:pre-wrap;max-height:60%;overflow:auto;' +
          'border-bottom:2px solid #e5533a';
        document.body.appendChild(box);
      }
      box.textContent += '【' + msg + '】\n';
    },

    /* ---------------- 启动 ---------------- */
    boot() {
      window.addEventListener('error', (ev) => {
        App.fatal('window.onerror', ev.error || ev.message);
      });
      window.addEventListener('unhandledrejection', (ev) => {
        App.fatal('unhandledrejection', ev.reason);
      });
      // 1. 生成美术资源（失败也要能继续跑，渲染器有 fallback）
      try {
        if (R.Art && R.Art.init) R.Art.init();
      } catch (e) {
        console.warn('美术模块初始化失败，使用几何图形兜底：', e);
      }

      // 2. 界面
      this.ui = new R.UI();

      // 3. 载入遮罩收起
      const ld = document.getElementById('loading');
      if (ld) ld.classList.add('hidden');

      // 4. 解析调试参数
      const q = new URLSearchParams(location.search);
      this.q = q;
      const setup = this.ui.setup;
      if (q.get('faction')) setup.faction = q.get('faction');
      if (q.get('diff')) setup.difficulty = q.get('diff');
      if (q.get('size')) setup.mapSize = q.get('size');
      if (q.get('fog') === '0') setup.fog = false;
      this.ui.buildSetupOptions();

      if (q.get('dev')) {
        this.start(setup);
      } else {
        // 支持 #screen=help / #screen=tech 直接打开某个界面（无头截图用）
        const m = /screen=([a-z]+)/.exec(location.hash || '');
        if (m) {
          this.ui.prevScreen = 'scr-title';
          this.ui.showScreen('scr-' + m[1]);
        } else {
          this.ui.showScreen('scr-title');
        }
      }

      window.addEventListener('resize', () => {
        if (this.renderer) this.renderer.resize();
      });

      // 首次交互解锁音频
      const unlock = () => {
        if (R.Audio) R.Audio.init();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
    },

    /* ---------------- 开局 ---------------- */
    start(setup) {
      try {
        this._start(setup);
      } catch (e) {
        this.fatal('App.start', e);
      }
    },

    _start(setup) {
      this.stopLoop();
      const q = this.q || new URLSearchParams('');
      const seed = q.get('seed') ? (parseInt(q.get('seed'), 10) | 0) : ((Math.random() * 1e9) | 0);

      const game = new R.Game({
        seed,
        mapSize: setup.mapSize,
        playerFaction: setup.faction,
        difficulty: setup.difficulty,
        fog: setup.fog,
      });
      this.game = game;

      const canvas = document.getElementById('game');
      const minimap = document.getElementById('minimap');
      const renderer = new R.Renderer(game, canvas, minimap);
      this.renderer = renderer;
      renderer.resize();
      renderer.centerOn(game.startFocus.x, game.startFocus.y);
      if (q.get('zoom')) renderer.setZoom(parseFloat(q.get('zoom')));
      if (q.get('debug')) renderer.showDebug = true;
      if (q.get('grid')) renderer.showGrid = true;

      const input = new R.Input(game, renderer, this.ui);
      this.input = input;
      this.ui.attach(game, renderer, input);
      this.ui.hideScreens();

      /* --- 托管：让 AI 替玩家打（观战 / 截图 / 平衡性验证用） --- */
      if (q.get('auto') && R.AI) {
        game.me.ai = new R.AI(game, game.me, q.get('auto') === '1' ? setup.difficulty : q.get('auto'));
        game.autoPlay = true;
      }

      /* --- 调试：预热模拟 --- */
      const fast = parseFloat(q.get('fast') || '0');
      if (fast > 0) this.simulate(fast);
      if (q.get('spawn')) this.devSpawn();
      if (q.get('sel')) {
        // 选中全部己方单位，用来检查选中圈 / 底部信息栏 / 路径线
        const list = game.me.units.filter((u) => !u.dead);
        for (const u of list) u.selected = true;
        game.selection = list.slice();
        this.ui.onSelectionChanged();
      }
      if (q.get('place')) {
        // 走真实的"待放置"流程（而不是直接改渲染器字段），
        // 这样连 input.syncPlacement / UI 模式提示一起被验证到。
        // 必须先摘掉托管 AI —— 否则它会在第一帧就替我们把建筑放下去。
        game.me.ai = null;
        const def = R.BUILDINGS[q.get('place')];
        const cyb = game.findConyard(game.me);
        if (def && cyb) {
          game.me.queues.structure.push({ id: def.id, def, progress: 1, paid: def.cost, ready: true, held: false });
          game.me.pendingBuild = def.id;
          // 无头环境没有真实鼠标，把虚拟光标放到屏幕中心
          input.mouse.x = renderer.w / 2;
          input.mouse.y = renderer.h / 2;
          input.mouse.inside = true;
          input.syncPlacement();
        }
      }
      if (q.get('ion')) {
        // 直接给一座充能完毕的离子炮，用来检查超武 UI 与瞄准框。
        // 注意：必须先摘掉托管 AI —— 否则它会在第一帧就把离子炮打出去，
        // 全屏白闪会把截图糊成一片白。
        game.me.ai = null;
        const cyb = game.findConyard(game.me);
        if (cyb) {
          for (let r = 3; r <= 10; r++) {
            let done = false;
            for (let dy = -r; dy <= r && !done; dy++) {
              for (let dx = -r; dx <= r && !done; dx++) {
                if (game.canPlace(game.me, R.BUILDINGS.ion, cyb.cx + dx, cyb.cy + dy)) {
                  const b = game.placeBuilding(game.me, 'ion', cyb.cx + dx, cyb.cy + dy, true);
                  if (b) { b.chargeReady = true; b.charge = R.BUILDINGS.ion.superWeapon.charge; b.riseT = 1; }
                  done = true;
                }
              }
            }
            if (done) break;
          }
        }
        if (q.get('ion') === 'aim') {
          input.mouse.x = renderer.w / 2;
          input.mouse.y = renderer.h / 2;
          input.mouse.inside = true;
          input.mode = 'super';
          renderer.superTargeting = true;
          renderer.cursorWorld = renderer.screenToWorld(renderer.w / 2, renderer.h / 2);
        }
      }
      if (q.get('tab')) { this.ui.tab = q.get('tab'); this.ui.buildCards(); }
      if (q.get('report')) {
        this.reportEvery = Math.max(1, parseInt(q.get('report'), 10) || 20);
        this.frames = 0;
      }
      if (q.get('audioinit') && R.Audio) {
        // 无头环境没有用户手势，浏览器不允许自动建 AudioContext。
        // 配合 --autoplay-policy=no-user-gesture-required 用这个参数
        // 才能验证"音频在真实游戏页面里确实初始化并发得出声"。
        R.Audio.init();
        const v = renderer.viewRect();
        R.Audio.update(0.016, v.x + v.w / 2, v.y + v.h / 2, renderer.zoom);
        // 主动触发一批声音，供报告统计活跃源数
        for (const k in R.WEAPONS) {
          const s = R.WEAPONS[k].sfx;
          if (s) R.Audio.play(s, v.x + v.w / 2, v.y + v.h / 2);
        }
        R.Audio.ui('click');
        R.Audio.vo('unitReady');
      }

      // 把视角对到玩家基地（预热后基地可能扩大了）。
      // devSpawn 已经把镜头对准了中场混战，这时不要再抢回来。
      if (!q.get('spawn')) {
        const cy = game.findConyard(game.me);
        if (cy) renderer.centerOn(cy.x, cy.y);
      }

      this.startLoop();
    },

    toTitle() {
      this.stopLoop();
      this.game = null; this.renderer = null; this.input = null;
      this.ui.g = null;
      this.ui.showScreen('scr-title');
    },

    /* ---------------- 调试工具 ---------------- */
    /** 以固定步长快速推进游戏（不渲染），用来截"中期战况"的图 */
    simulate(seconds) {
      const g = this.game;
      const step = 1 / 20;
      const n = Math.min(20000, Math.floor(seconds / step));
      const t0 = U.now();
      for (let i = 0; i < n; i++) {
        g.update(step);
        if (g.over) break;
      }
      console.log('[dev] 预热模拟 ' + seconds + 's（' + n + ' 步）耗时 ' +
        (U.now() - t0).toFixed(0) + 'ms，游戏内时间 ' + U.mmss(g.time));
    },

    /** 在两基地之间刷一批对峙部队 */
    devSpawn() {
      const g = this.game;
      const a = g.players[0], b = g.players[1];
      const mid = {
        x: (g.map.starts[0].cx + g.map.starts[1].cx) * 0.5 * R.TILE,
        y: (g.map.starts[0].cy + g.map.starts[1].cy) * 0.5 * R.TILE,
      };
      const T = R.TILE;
      const mkA = ['rifleman', 'rifleman', 'rocketeer', 'lightTank',
        a.faction === 'guard' ? 'grizzly' : 'rhino', 'artillery', 'flakTrack'];
      const mkB = ['rifleman', 'rocketeer', 'rocketeer', 'lightTank',
        b.faction === 'guard' ? 'grizzly' : 'rhino', 'apoc', 'scout'];
      for (let i = 0; i < mkA.length; i++) {
        const u = g.spawnUnit(a, mkA[i], mid.x - T * 5 + (i % 3) * T * 1.4, mid.y + Math.floor(i / 3) * T * 1.4);
        if (u) u.orderMove(mid.x + T * 4, mid.y, { attackMove: true });
      }
      for (let i = 0; i < mkB.length; i++) {
        const u = g.spawnUnit(b, mkB[i], mid.x + T * 5 + (i % 3) * T * 1.4, mid.y + Math.floor(i / 3) * T * 1.4);
        if (u) u.orderMove(mid.x - T * 4, mid.y, { attackMove: true });
      }
      // 让它们打起来
      for (let i = 0; i < 90; i++) g.update(1 / 30);
      this.renderer.centerOn(mid.x, mid.y);
    },

    /* ---------------- 主循环 ---------------- */
    startLoop() {
      this.running = true;
      this.lastT = U.now();
      const tick = () => {
        if (!this.running) return;
        this.rafId = requestAnimationFrame(tick);
        this.frame();
      };
      this.rafId = requestAnimationFrame(tick);
    },
    stopLoop() {
      this.running = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    },

    frame() {
      try {
        this._frame();
      } catch (e) {
        this.stopLoop();
        this.fatal('主循环', e);
      }
    },

    _frame() {
      const now = U.now();
      let dt = (now - this.lastT) / 1000;
      this.lastT = now;
      // 切标签页回来时 dt 会很大，钳住避免一帧模拟几秒
      if (!isFinite(dt) || dt < 0) dt = 0;
      dt = Math.min(dt, 0.1);

      const g = this.game, r = this.renderer, inp = this.input, ui = this.ui;
      if (!g || !r) return;

      if (!g.paused && !g.over) {
        g.update(dt);
      } else if (g.fx) {
        // 暂停时也让粒子收尾，避免爆炸僵在半空
        g.fx.update(Math.min(dt, 0.033) * 0.35);
      }

      inp.update(dt);
      ui.update(dt);

      if (!ui.shakeOn && g.fx) { g.fx.shake = 0; g.fx.shakeT = 0; }

      // 音频监听点跟随摄像机中心
      if (R.Audio && R.Audio.ready) {
        const v = r.viewRect();
        R.Audio.update(dt, v.x + v.w / 2, v.y + v.h / 2, r.zoom);
      }

      r.render(dt);

      // 无头自检：第 1 帧就先写一份（保证一定拿得到），之后定期刷新
      if (this.reportEvery > 0) {
        this.frames = (this.frames || 0) + 1;
        if (this.frames === 1 || this.frames % this.reportEvery === 0) this.writeReport();
      }
    },

    /* ==================================================================
       无头自检报告
       截图我看不到，所以让页面把"画面到底画出了什么"量化成文本塞进 DOM，
       外部再用 msedge --dump-dom 读出来断言。这是无眼睛环境下唯一
       靠得住的渲染验证手段。
       ================================================================== */
    writeReport() {
      const lines = [];
      const put = (k, v) => lines.push(k + '=' + v);
      try {
        const g = this.game, r = this.renderer;
        put('ERRORS', this.errors.length);
        if (this.errors.length) put('ERR_FIRST', this.errors[0].slice(0, 400).replace(/\s+/g, ' '));
        put('FRAMES', this.frames || 0);
        put('ART_READY', !!(R.Art && R.Art.ready));
        put('AUDIO_READY', !!(R.Audio && R.Audio.ready));
        if (R.Audio) {
          put('AUDIO_VOICES', R.Audio.activeVoices === undefined ? -1 : R.Audio.activeVoices);
          put('AUDIO_CTX_STATE', (R.Audio.ctx && R.Audio.ctx.state) || 'none');
          // 逻辑层用到的每个武器音效名都必须有实现，否则开火会静音
          if (R.Audio.has) {
            let missing = [];
            for (const k in R.WEAPONS) {
              const s = R.WEAPONS[k].sfx;
              if (s && !R.Audio.has(s)) missing.push(k + ':' + s);
            }
            put('AUDIO_MISSING_SFX', missing.length ? missing.join(',') : 'none');
          }
        }
        put('GAME_TIME', g.time.toFixed(1));
        put('GAME_OVER', !!g.over);
        put('FPS', r.fps);
        put('FRAME_MS', r.frameMs.toFixed(2));
        put('ZOOM', r.zoom.toFixed(2));
        put('CHUNKS', r.chunks.size);
        put('UNITS', g.units.length);
        put('BUILDINGS', g.buildings.length);
        put('PROJECTILES', g.projectiles.length);
        put('PARTICLES', g.fx ? g.fx.countLive() : 0);
        put('DECALS', g.fx ? g.fx.decals.length : 0);
        for (let i = 0; i < g.players.length; i++) {
          const p = g.players[i];
          put('P' + i + '_B', p.buildings.length);
          put('P' + i + '_U', p.units.length);
          put('P' + i + '_CREDITS', Math.round(p.credits));
          put('P' + i + '_HARVESTED', Math.round(p.stats.harvested));
          put('P' + i + '_KILLS', p.stats.kills);
          put('P' + i + '_POWER', Math.round(p.powerMade) + '/' + Math.round(p.powerUsed));
          put('P' + i + '_COLOR', p.color);
        }
        // 侧边栏 DOM 是否真的生成了按钮
        const cards = document.querySelectorAll('#buildlist .bcard');
        put('UI_CARDS', cards.length);
        put('UI_TABS', document.querySelectorAll('#tabs .tab').length);
        put('UI_CREDITS_TEXT', (document.getElementById('credits') || {}).textContent || '');
        put('UI_SEL_VISIBLE', !document.getElementById('selbar').classList.contains('hidden'));
        put('UI_MODEHINT', (document.getElementById('modehint') || {}).textContent || '');
        // 图标是否真的画进了卡片（检查 canvas 元素数量）
        put('UI_CARD_ICONS', document.querySelectorAll('#buildlist .bcard-icon canvas').length);

        /* ---- 画面像素统计（战场区域，排除侧边栏） ----
           重要：先把屏幕震动清零并重渲染一帧再取样。
           render() 每帧会用随机偏移实现震屏，如果不关掉，
           两次渲染之间整幅画面会平移几个像素，
           下面的"实体差分"会把整屏都算成差异（实测虚高到 57%）。 */
        const cv = r.cv, ctx = r.ctx;
        const dpr = r.dpr || 1;
        const savedShake = g.fx ? g.fx.shake : 0;
        const savedShakeT = g.fx ? g.fx.shakeT : 0;
        if (g.fx) { g.fx.shake = 0; g.fx.shakeT = 0; }
        r.render(1 / 60);
        const px = ctx.getImageData(0, 0, cv.width, cv.height);
        const d = px.data;
        const seen = new Set();
        let sum = 0, black = 0, n = 0;
        let pColor = 0, eColor = 0, oreLike = 0;
        const pc = R.Col.parse(g.players[0].color);
        const ec = R.Col.parse(g.players[1].color);
        const near = (a, b, c, t, tol) => Math.abs(a - t.r) < tol && Math.abs(b - t.g) < tol && Math.abs(c - t.b) < tol;
        const step = 2;
        for (let y = 0; y < cv.height; y += step) {
          for (let x = 0; x < cv.width; x += step) {
            const i = (y * cv.width + x) * 4;
            const rr = d[i], gg = d[i + 1], bb = d[i + 2];
            n++;
            const lum = (rr * 299 + gg * 587 + bb * 114) / 1000;
            sum += lum;
            // 迷雾遮罩是 rgb(4,6,8)，阈值必须略高于它才能统计到
            if (rr < 12 && gg < 12 && bb < 12) black++;
            seen.add(((rr >> 3) << 10) | ((gg >> 3) << 5) | (bb >> 3));
            if (near(rr, gg, bb, pc, 46)) pColor++;
            if (near(rr, gg, bb, ec, 46)) eColor++;
            // 矿脉的琥珀色
            if (rr > 150 && gg > 110 && gg < 210 && bb < 110) oreLike++;
          }
        }
        put('PIX_SAMPLES', n);
        put('PIX_COLORS', seen.size);
        put('PIX_MEAN_LUM', (sum / n).toFixed(2));
        put('PIX_BLACK_PCT', (black / n * 100).toFixed(2));
        put('PIX_P0_COLOR_PCT', (pColor / n * 100).toFixed(3));
        put('PIX_P1_COLOR_PCT', (eColor / n * 100).toFixed(3));
        put('PIX_ORE_PCT', (oreLike / n * 100).toFixed(3));
        put('CANVAS_W', cv.width);
        put('CANVAS_H', cv.height);
        put('DPR', dpr);

        /* ---- 视野内实体计数 ---- */
        const vr = r.viewRect();
        let onScreenU = 0, onScreenB = 0;
        for (const u of g.units) {
          if (u.dead) continue;
          if (u.x >= vr.x && u.x <= vr.x + vr.w && u.y >= vr.y && u.y <= vr.y + vr.h) onScreenU++;
        }
        for (const b of g.buildings) {
          if (b.dead) continue;
          if (b.x >= vr.x && b.x <= vr.x + vr.w && b.y >= vr.y && b.y <= vr.y + vr.h) onScreenB++;
        }
        put('ON_SCREEN_UNITS', onScreenU);
        put('ON_SCREEN_BUILDINGS', onScreenB);

        /* ---- 实体像素差分：把实体层关掉再渲染一帧，与正常帧比较 ----
           差异像素比例 = 建筑/单位/弹药/粒子真正画出来的面积。
           这是"精灵有没有画出来"最硬的判据，不依赖颜色匹配。 */
        r.hideEntities = true;
        r.render(1 / 60);
        const px2 = ctx.getImageData(0, 0, cv.width, cv.height).data;
        r.hideEntities = false;
        let diff = 0, dn = 0;
        for (let y = 0; y < cv.height; y += step) {
          for (let x = 0; x < cv.width; x += step) {
            const i = (y * cv.width + x) * 4;
            dn++;
            const dr = Math.abs(d[i] - px2[i]) + Math.abs(d[i + 1] - px2[i + 1]) + Math.abs(d[i + 2] - px2[i + 2]);
            if (dr > 18) diff++;
          }
        }
        put('PIX_ENTITY_DIFF_PCT', (diff / dn * 100).toFixed(3));
        // 恢复震屏状态并重画，别把调试用的静止帧留在屏幕上
        if (g.fx) { g.fx.shake = savedShake; g.fx.shakeT = savedShakeT; }
        r.render(1 / 60);

        /* ---- 小地图也检查一遍 ---- */
        if (r.mctx) {
          const m = r.mctx.getImageData(0, 0, r.mm.width, r.mm.height).data;
          const mseen = new Set();
          let msum = 0, mn = 0;
          for (let i = 0; i < m.length; i += 4 * 2) {
            mn++; msum += (m[i] + m[i + 1] + m[i + 2]) / 3;
            mseen.add(((m[i] >> 3) << 10) | ((m[i + 1] >> 3) << 5) | (m[i + 2] >> 3));
          }
          put('MM_COLORS', mseen.size);
          put('MM_MEAN', (msum / mn).toFixed(2));
        }

        /* ---- 渲染性能基准：连续渲染 N 帧取均值 ----
           无头模式下 rAF 只会触发一次，拿不到真实 FPS，
           所以这里同步跑一批 render() 来量渲染成本。
           同时也顺手跑一批 game.update()，估算逻辑成本。 */
        const bench = parseInt((this.q && this.q.get('bench')) || '0', 10);
        if (bench > 0) {
          const t1 = U.now();
          for (let i = 0; i < bench; i++) r.render(1 / 60);
          const renderMs = (U.now() - t1) / bench;
          const t2 = U.now();
          for (let i = 0; i < bench; i++) g.update(1 / 60);
          const updateMs = (U.now() - t2) / bench;
          put('BENCH_N', bench);
          put('BENCH_RENDER_MS', renderMs.toFixed(3));
          put('BENCH_UPDATE_MS', updateMs.toFixed(3));
          put('BENCH_TOTAL_MS', (renderMs + updateMs).toFixed(3));
          put('BENCH_EST_FPS', Math.round(1000 / Math.max(0.01, renderMs + updateMs)));
        }
        put('OK', 1);
      } catch (e) {
        put('REPORT_ERROR', (e && e.stack ? e.stack : String(e)).slice(0, 400).replace(/\s+/g, ' '));
      }
      let pre = document.getElementById('report');
      if (!pre) {
        pre = document.createElement('pre');
        pre.id = 'report';
        // display:none —— 不影响截图，但 --dump-dom 依然能读到
        pre.style.display = 'none';
        document.body.appendChild(pre);
      }
      pre.textContent = lines.join('\n');
    },
  };

  /* ---------------- 入口 ---------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.boot());
  } else {
    App.boot();
  }

})();
