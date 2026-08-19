/* DEEP SPACE CRAFT · main.js —— 输入 / 状态机 / 主循环 / 场景编排 */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});
  var GL = DSC.GL, M4 = DSC.M4, V3 = DSC.V3, U = DSC.Util;
  var A = function () { return DSC.Audio; };

  /* ================================================================ 输入 */
  var Input = {
    keys: {}, buttons: {}, mdx: 0, mdy: 0, wheel: 0, locked: false, sens: 1,
    _once: {},
    key: function (k) { return !!Input.keys[k]; },
    mouse: function (b) { return !!Input.buttons[b]; },
    clearMouse: function (b) { Input.buttons[b] = false; },
    pressed: function (k) { if (Input._once[k]) { Input._once[k] = false; return true; } return false; },
    init: function (canvas) {
      window.addEventListener('keydown', function (e) {
        var k = norm(e);
        if (!Input.keys[k]) Input._once[k] = true;
        Input.keys[k] = true;
        if (k === 'f3' || k === 'f5' || k === 'tab' || (k === ' ' && Input.locked)) e.preventDefault();
      });
      window.addEventListener('keyup', function (e) { Input.keys[norm(e)] = false; });
      window.addEventListener('blur', function () { Input.keys = {}; Input.buttons = {}; });
      canvas.addEventListener('mousedown', function (e) { Input.buttons[e.button] = true; });
      window.addEventListener('mouseup', function (e) { Input.buttons[e.button] = false; });
      window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      window.addEventListener('mousemove', function (e) {
        if (Input.locked) { Input.mdx += e.movementX || 0; Input.mdy += e.movementY || 0; }
      });
      window.addEventListener('wheel', function (e) { Input.wheel += Math.sign(e.deltaY); }, { passive: true });
      document.addEventListener('pointerlockchange', function () {
        Input.locked = (document.pointerLockElement === canvas);
        if (DSC.UI) DSC.UI.setLockHint(!Input.locked && (Game.state === 'planet' || Game.state === 'space') && !DSC.UI.screen);
      });
      function norm(e) {
        var k = e.key;
        if (k === undefined) return '';
        if (k === 'Shift') return 'shift';
        if (k === 'Control') return 'control';
        if (k === 'Alt') return 'alt';
        if (k === 'Escape') return 'escape';
        if (k === 'Tab') return 'tab';
        if (k === 'Enter') return 'enter';
        return k.length === 1 ? k.toLowerCase() : k.toLowerCase();
      }
    },
    lock: function (canvas) {
      if (Input.locked || !canvas.requestPointerLock) return;
      try {
        var p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(function () { /* 需要用户手势，忽略 */ });
      } catch (e) { /* 忽略 */ }
    },
    unlock: function () { if (document.exitPointerLock) document.exitPointerLock(); },
    endFrame: function () { Input.mdx = 0; Input.mdy = 0; Input.wheel = 0; Input._once = {}; }
  };

  /* ================================================================ 游戏 */
  var Game = {
    state: 'boot',
    canvas: null,
    galaxy: null, system: null, planet: null, preview: null,
    dayT: 0.32, time: 0, fps: 60, fov: 78,
    inShip: false, shipLocal: {
      pos: new Float32Array([0, 0, 0]), yaw: 0, pitch: 0, roll: 0,
      visible: false, gear: 1, engineGlow: 0
    },
    editsByPlanet: {}, discoveries: [], stats: { landings: 0, warps: 0, blocksMined: 0 },
    ambient: '', titleAngle: 0, _acc: 0, _frames: 0, _fpsT: 0,
    markers: [], holdT: 0,

    /* ---------------------------------------------------------- 启动 */
    boot: function () {
      var canvas = document.getElementById('game-canvas');
      Game.canvas = canvas;
      try {
        GL.init(canvas);
      } catch (e) {
        document.getElementById('fatal').classList.remove('hidden');
        document.getElementById('fatal').textContent = '你的浏览器不支持 WebGL2 / WebGL2 UNAVAILABLE\n\n' + e.message;
        return;
      }
      DSC.UI.init();
      Input.init(canvas);
      /* 全局错误捕获：任何未处理异常直接显示在 #fatal（也便于自动化自检读取） */
      window.addEventListener('error', function (ev) {
        if (Game._errored) return;
        Game._errored = true;
        DSC.UI.fatal('未捕获错误：' + (ev.message || ev.error) + '\n' + ((ev.error && ev.error.stack) || ''));
      });
      window.addEventListener('unhandledrejection', function (ev) {
        /* 指针锁定等 API 的 Promise 拒绝不应视为致命错误 */
        console.warn('[unhandledrejection]', ev.reason);
      });
      try {
        DSC.Render.init();
      } catch (e) {
        DSC.UI.fatal('渲染初始化失败：' + (e && e.message ? e.message : e) + '\n' + (e && e.stack ? e.stack : ''));
        return;
      }
      window.addEventListener('resize', function () {
        if (GL.resize()) DSC.Render.resize();
      });
      /* 标题界面背景：随机一个星系用于展示 */
      Game.preview = DSC.Universe.makeGalaxy('PREVIEW-' + ((Math.random() * 1e6) | 0), 8).systems[0];
      DSC.Space.galaxy = { systems: [Game.preview], current: 0 };
      DSC.Space.system = Game.preview;
      DSC.Space.updateOrbits(1200);
      DSC.Player.init([0, 60, 0], false);

      DSC.UI.hooks = {
        onNewGame: function (seed) { Game.newGame(seed); },
        onContinue: function () { Game.loadGame(); },
        onResume: function () { Game.closeMenus(); },
        onSave: function () {
          if (DSC.Save.write(Game)) { DSC.UI.toast('已保存 · SAVED'); A() && A().play('upload', { volume: 0.6 }); }
          else DSC.UI.toast('保存失败 · SAVE FAILED');
        },
        onQuit: function () { Game.toTitle(); },
        onRespawn: function () { Game.respawn(); },
        onWarp: function (idx) { Game.doWarp(idx); },
        onScanSystem: function () { Game.scanSystem(); }
      };
      DSC.UI.saveInfo(DSC.Save.info());
      DSC.UI.applySettings();
      Game.state = 'title';

      /* 调试直达（也方便截图自检）：
         ?auto=1&seed=XXX          直接开局（跳过点击启动）
         &scene=planet&p=0         直接降落到第 p 颗行星地表
         &scene=entry&p=1          直接播放大气层进入过渡动画
         &dbg=1                    显示调试读数 */
      Game.params = {};
      (location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
        if (!kv) return;
        var i = kv.indexOf('=');
        Game.params[i < 0 ? kv : kv.slice(0, i)] = i < 0 ? '1' : decodeURIComponent(kv.slice(i + 1));
      });
      if (Game.params.dbg) document.getElementById('debug-readout').classList.remove('hidden');
      if (Game.params.lowfx) {
        /* 低配/软件渲染自检用：降低特效开销 */
        if (DSC.SpaceFX) DSC.SpaceFX.quality = 0.3;
        DSC.Render.bloomOn = false;
        DSC.UI.settings.dist = 4;
      }

      if (Game.params.auto) {
        document.getElementById('boot-overlay').classList.add('hidden');
        try { Game.debugStart(Game.params); } catch (e) { DSC.UI.fatal('调试启动失败：' + e.message + '\n' + e.stack); }
      } else if (Game.params.selftest) {
        document.getElementById('boot-overlay').classList.add('hidden');
        try { Game.selfTest(); } catch (e) { DSC.UI.fatal('自检崩溃：' + e.message + '\n' + e.stack); }
        return;
      } else if (Game.params.audiotest) {
        document.getElementById('boot-overlay').classList.add('hidden');
        try { Game.audioTest(); } catch (e) { DSC.UI.fatal('音频自检崩溃：' + e.message + '\n' + e.stack); }
        return;
      } else {
        DSC.UI.boot(function () { DSC.UI.showScreen('title'); });
      }
      requestAnimationFrame(Game.frame);
    },

    /* ============================================================ 音频自检
       ?audiotest=1 —— 用 OfflineAudioContext 离线渲染：把全部 SFX 按时槽排开，
       逐个测量波形峰值/RMS，确定性地验证"每个音效真的发得出声"（不依赖真实时钟） */
    audioTest: function () {
      var lines = [], fails = 0;
      var A2 = DSC.Audio, NAMES = A2.NAMES || [];
      var out = document.getElementById('debug-readout');
      out.classList.remove('hidden');
      function log(s) { lines.push(s); }
      function fail(s) { lines.push('FAIL ' + s); fails++; }
      function pass(s) { lines.push('pass ' + s); }
      function flush(title) {
        out.textContent = 'AUDIOTEST ' + title + '\n' + lines.join('\n');
        document.title = 'AUDIOTEST ' + title;
      }

      var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Off) { fail('浏览器无 OfflineAudioContext'); flush('FAILED-1'); return; }
      if (!NAMES.length) { fail('Audio.NAMES 为空'); flush('FAILED-1'); return; }

      var SR = 22050, SLOT = 0.28, LEAD = 0.2;
      var total = LEAD + NAMES.length * SLOT + 1.2;
      var offctx = new Off(2, Math.ceil(SR * total), SR);
      /* 注入离线上下文：Audio.init 内部 new AudioContext() 会拿到它 */
      var RealAC = window.AudioContext, RealWK = window.webkitAudioContext;
      window.AudioContext = function () { return offctx; };
      window.webkitAudioContext = window.AudioContext;
      var initErr = null;
      try { A2.init(); } catch (e) { initErr = e; }
      window.AudioContext = RealAC; window.webkitAudioContext = RealWK;
      if (initErr) { fail('Audio.init 抛异常: ' + initErr.message); flush('FAILED-1'); return; }
      if (!A2.ready) fail('Audio.ready 未置位'); else pass('音频引擎初始化成功（离线 ' + SR + 'Hz / ' + total.toFixed(1) + 's）');
      A2.setVolumes({ master: 1, sfx: 1, music: 0 });

      /* 逐个排期（不同名字不触发 40ms 节流） */
      var playErr = 0;
      for (var i = 0; i < NAMES.length; i++) {
        try { A2.play(NAMES[i], { volume: 1, delay: LEAD + i * SLOT }); }
        catch (e2) { playErr++; log('  play(' + NAMES[i] + ') 抛异常: ' + e2.message); }
      }
      if (playErr) fail(playErr + ' 个音效调用抛异常'); else pass('全部 ' + NAMES.length + ' 个音效调用无异常');

      flush('RENDERING');
      var done = false, result = null;
      offctx.startRendering().then(function (buf) { result = buf; done = true; })
        .catch(function (e3) { result = e3; done = true; });

      /* 保持页面活跃直到渲染完成：每帧真实忙等一小段，
         这样无头虚拟时钟不会跳过真实时间，音频渲染线程才有机会推进 */
      var frames = 0;
      (function wait() {
        frames++;
        if (!done) {
          if (frames > 900) { fail('离线渲染超时（' + frames + ' 帧）'); flush('FAILED-' + fails); return; }
          var t0 = Date.now();
          while (Date.now() - t0 < 4) { /* 短忙等：让音频渲染线程拿到真实时间 */ }
          requestAnimationFrame(wait);
          return;
        }
        if (!result || !result.getChannelData) {
          fail('离线渲染失败: ' + (result && result.message ? result.message : result));
          flush('FAILED-' + fails); return;
        }
        /* ---- 逐时槽分析 ---- */
        var ch0 = result.getChannelData(0), ch1 = result.numberOfChannels > 1 ? result.getChannelData(1) : ch0;
        var silent = [], quiet = [], peaks = [], clip = 0, stereo = 0;
        for (var k = 0; k < NAMES.length; k++) {
          var s0 = Math.floor((LEAD + k * SLOT) * SR), s1 = Math.min(ch0.length, Math.floor((LEAD + (k + 1) * SLOT) * SR));
          var peak = 0, sum = 0, n = 0, dsum = 0;
          for (var s = s0; s < s1; s++) {
            var a = ch0[s], b = ch1[s];
            var m = Math.abs(a) > Math.abs(b) ? Math.abs(a) : Math.abs(b);
            if (m > peak) peak = m;
            sum += a * a; n++;
            dsum += Math.abs(a - b);
            if (m > 0.999) clip++;
          }
          var rms = Math.sqrt(sum / Math.max(1, n));
          peaks.push(peak);
          if (dsum / Math.max(1, n) > 0.002) stereo++;
          if (peak < 0.002) silent.push(NAMES[k]);
          else if (peak < 0.02) quiet.push(NAMES[k] + '(' + peak.toFixed(3) + ')');
          if (k < 6 || NAMES[k].indexOf('warp') === 0 || NAMES[k].indexOf('atmos') === 0)
            log('  ' + NAMES[k] + ': peak=' + peak.toFixed(3) + ' rms=' + rms.toFixed(4));
        }
        var maxPeak = Math.max.apply(null, peaks), avgPeak = peaks.reduce(function (x, y) { return x + y; }, 0) / peaks.length;
        log('总览: 音效数=' + NAMES.length + ' 平均峰值=' + avgPeak.toFixed(3) + ' 最大峰值=' + maxPeak.toFixed(3) +
          ' 削波样本=' + clip + ' 立体声差异音效=' + stereo);
        if (silent.length) fail('无声音效 ' + silent.length + ' 个: ' + silent.join(','));
        else pass('全部 ' + NAMES.length + ' 个音效均有实际波形输出');
        if (quiet.length) log('  偏轻(仍可听): ' + quiet.join(' '));
        if (maxPeak > 1.001) fail('存在削波（峰值 ' + maxPeak.toFixed(3) + ' > 1.0）');
        else pass('无削波，峰值上限 ' + maxPeak.toFixed(3) + '（限幅器生效）');
        if (avgPeak < 0.02) fail('整体过轻，平均峰值仅 ' + avgPeak.toFixed(3));
        else pass('整体音量健康');

        /* ---- loop / 音乐 / 连续参数接口的异常安全 ---- */
        var apiErr = [];
        try {
          var h = A2.loop('ship_engine', { volume: 0.5 });
          if (!h || typeof h.stop !== 'function' || typeof h.gain !== 'function') apiErr.push('loop handle 不完整');
          if (A2.loop('ship_engine') !== h) apiErr.push('同名 loop 未复用实例');
          h.gain(0.3); h.rate(1.2); h.stop(0.1);
          ['ambient_space', 'ambient_planet', 'ambient_cave', 'ambient_underwater', 'atmos_burn', 'rain'].forEach(function (nm) {
            var x = A2.loop(nm, { volume: 0.3 }); if (x) x.stop(0.05); A2.stopLoop(nm, 0.05);
          });
          ['title', 'space', 'planet', 'cave', 'warp', 'none'].forEach(function (sc) { A2.setMusic(sc); });
          A2.engine(0.7, 0.4); A2.engine(0, 0);
          A2.wind(0.6); A2.wind(0);
          A2.mining(true, 'stone'); A2.mining(true, 'metal'); A2.mining(false);
          A2.beep(660, 0.05, 'square');
          A2.setListener([0, 0, 0], [0, 0, -1]);
          A2.play('dig_stone', { pos: [3, 0, 0] });
          A2.play('dig_stone', { pos: [900, 0, 0] });   /* 超距应静默不报错 */
          A2.stopAll();
        } catch (e4) { apiErr.push(e4.message); }
        if (apiErr.length) fail('音频 API 异常: ' + apiErr.join(' | '));
        else pass('loop / 音乐六场景 / engine / wind / mining / 3D 声像 / stopAll 全部无异常');

        flush(fails ? 'FAILED-' + fails : 'ALL-PASS');
        console.log(out.textContent);
      })();
    },

    /* ============================================================ 渲染自检
       ?selftest=1 —— 手动推进若干帧并用 readPixels 统计画面，结果写入 #debug-readout
       与 document.title，便于无头浏览器纯文本校验（不需要看图） */
    selfTest: function () {
      var lines = [], fails = 0, gl = GL.gl;
      function log(s) { lines.push(s); }
      function fail(s) { lines.push('FAIL ' + s); fails++; }
      function pass(s) { lines.push('pass ' + s); }
      function stats() {
        var w = GL.W, h = GL.H, px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        var sum = 0, black = 0, cols = {}, detail = 0, dn = 0, i, r, g, b, l;
        for (i = 0; i < w * h; i++) {
          r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2];
          l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          sum += l; if (l < 6) black++;
          cols[((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)] = 1;
        }
        for (var y = 2; y < h - 3; y += 3) for (var x = 2; x < w - 3; x += 3) {
          var i0 = (y * w + x) * 4, i1 = (y * w + x + 2) * 4, i2 = ((y + 2) * w + x) * 4;
          detail += Math.abs(px[i0] - px[i1]) + Math.abs(px[i0 + 1] - px[i1 + 1]) +
            Math.abs(px[i0] - px[i2]) + Math.abs(px[i0 + 1] - px[i2 + 1]);
          dn++;
        }
        return {
          mean: +(sum / (w * h)).toFixed(1), black: +(black / (w * h) * 100).toFixed(1),
          colors: Object.keys(cols).length, detail: +(detail / dn / 4).toFixed(1)
        };
      }
      function step(n) { for (var i = 0; i < n; i++) { Game.update(1 / 60); Game.render(1 / 60); } }
      function judge(tag, s, minMean, maxMean, minDetail, minColors) {
        log(tag + ': mean=' + s.mean + ' black%=' + s.black + ' colors=' + s.colors + ' detail=' + s.detail);
        if (s.mean < minMean) fail(tag + ' 画面过暗/未渲染 (mean ' + s.mean + ' < ' + minMean + ')');
        else if (s.mean > maxMean) fail(tag + ' 画面过曝 (mean ' + s.mean + ' > ' + maxMean + ')');
        else if (s.detail < minDetail) fail(tag + ' 缺少细节/可能空白 (detail ' + s.detail + ' < ' + minDetail + ')');
        else if (s.colors < minColors) fail(tag + ' 颜色过少 (colors ' + s.colors + ')');
        else pass(tag + ' 渲染正常');
      }

      log('viewport ' + GL.W + 'x' + GL.H + ' hdr=' + (DSC.Render.sceneFB && DSC.Render.sceneFB.float ? 'RGBA16F' : 'RGBA8'));
      log('renderer ' + (function () {
        var d = gl.getExtension('WEBGL_debug_renderer_info');
        return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?';
      })());

      /* 致命面板守卫：任何阶段抛异常都会让 #fatal 显形，这里逐阶段核查 */
      var fatalEl = document.getElementById('fatal');
      function noFatal(stage) {
        if (!fatalEl.classList.contains('hidden')) {
          fail('阶段【' + stage + '】触发致命错误：' + (fatalEl.textContent || '').slice(0, 220).replace(/\s+/g, ' '));
          fatalEl.classList.add('hidden'); fatalEl.textContent = '';
          Game._errored = false;
          return false;
        }
        return true;
      }

      /* --- 0. 冷启动标题界面（玩家双击后看到的第一屏；不得依赖 newGame 先跑过） --- */
      Game.toTitle();
      step(3);
      if (noFatal('冷启动标题界面')) pass('冷启动标题界面无异常（未 init 太空也能渲染）');
      judge('title-cold', stats(), 4, 175, 1.2, 25);

      /* --- 1. 太空（含分层诊断，定位过曝来源） --- */
      Game.newGame('SELFTEST');
      step(3);
      var sp = stats();
      noFatal('太空场景');
      judge('space', sp, 6, 170, 2.5, 40);
      if (sp.mean > 170 || sp.colors < 40) {
        var SFX = DSC.SpaceFX;
        var orig = { bg: SFX.drawBackground, st: SFX.drawStar, pl: SFX.drawPlanet, du: SFX.drawDust, wp: SFX.drawWarp };
        var noop = function () { };
        var layers = [
          ['背景only', { st: 1, pl: 1, du: 1 }],
          ['背景+恒星', { pl: 1, du: 1 }],
          ['背景+星球', { st: 1, du: 1 }],
          ['背景+尘埃', { st: 1, pl: 1 }],
          ['无背景全其他', { bg: 1 }]
        ];
        for (var li = 0; li < layers.length; li++) {
          SFX.drawBackground = layers[li][1].bg ? noop : orig.bg;
          SFX.drawStar = layers[li][1].st ? noop : orig.st;
          SFX.drawPlanet = layers[li][1].pl ? noop : orig.pl;
          SFX.drawDust = layers[li][1].du ? noop : orig.du;
          step(2);
          var s2 = stats();
          log('  分层 ' + layers[li][0] + ': mean=' + s2.mean + ' colors=' + s2.colors + ' detail=' + s2.detail);
        }
        SFX.drawBackground = orig.bg; SFX.drawStar = orig.st; SFX.drawPlanet = orig.pl; SFX.drawDust = orig.du;
        /* 参数级诊断：只画背景，逐项把输入压到最小 */
        var S0 = Game.system, sh0 = DSC.Space.ship;
        log('  系统参数 seed=' + ((S0.seed % 4096) / 4096).toFixed(3) + ' starDensity=' + S0.starDensity.toFixed(2) +
          ' nebA=[' + S0.nebulaA.map(function (v) { return v.toFixed(2); }) + '] nebB=[' + S0.nebulaB.map(function (v) { return v.toFixed(2); }) + ']' +
          ' camR=' + Math.round(Math.sqrt(sh0.pos[0] * sh0.pos[0] + sh0.pos[1] * sh0.pos[1] + sh0.pos[2] * sh0.pos[2])));
        SFX.drawStar = noop; SFX.drawPlanet = noop; SFX.drawDust = noop;
        var variants = [
          ['原样', {}],
          ['星密度0', { starDensity: 0 }],
          ['星云黑', { nebulaA: [0, 0, 0], nebulaB: [0, 0, 0] }],
          ['曝光0.15', { exposure: 0.15 }],
          ['fade0', { fade: 0 }],
          ['seed0.5+密度0.3', { seed: 0.5, starDensity: 0.3 }]
        ];
        var Cm = DSC.Cam;
        for (var vi = 0; vi < variants.length; vi++) {
          var ov = variants[vi][1];
          DSC.Render.begin();
          Cm.near = 40; Cm.far = 4.0e6; Cm.update(GL.W / GL.H);
          var c0 = {
            viewProj: Cm.viewProj, invViewProj: Cm.invViewProj, camPos: Cm.pos, time: 1.0,
            seed: ov.seed === undefined ? (S0.seed % 4096) / 4096 : ov.seed,
            nebulaA: ov.nebulaA || S0.nebulaA, nebulaB: ov.nebulaB || S0.nebulaB,
            starDensity: ov.starDensity === undefined ? S0.starDensity : ov.starDensity,
            exposure: ov.exposure === undefined ? 1 : ov.exposure,
            fade: ov.fade === undefined ? 1 : ov.fade
          };
          orig.bg(c0);
          DSC.Render.end({ bloomAmt: 0, exposure: 1, vignette: 0 });
          var sv = stats();
          log('  参数 ' + variants[vi][0] + ': mean=' + sv.mean + ' colors=' + sv.colors + ' detail=' + sv.detail);
        }
        SFX.drawStar = orig.st; SFX.drawPlanet = orig.pl; SFX.drawDust = orig.du;

        /* 探针：直接读 GPU 端反投影出的视线方向，判断是不是 invViewProj 精度坍缩 */
        try {
          var pv = '#version 300 es\nlayout(location=0) in vec2 a_pos;\nuniform mat4 uInv;\nout vec4 vW;\n' +
            'void main(){ vW = uInv*vec4(a_pos,1.0,1.0); gl_Position = vec4(a_pos,0.0,1.0); }\n';
          var pf = '#version 300 es\nprecision highp float;\nin vec4 vW;\nuniform vec3 uCam;\nout vec4 o;\n' +
            'void main(){ vec3 rd = normalize(vW.xyz/vW.w - uCam); o = vec4(rd*0.5+0.5, 1.0); }\n';
          var probe = Game._probe || (Game._probe = GL.program(pv, pf, 'probe'));
          function probeRead(near, far) {
            var Cm2 = DSC.Cam;
            Cm2.near = near; Cm2.far = far; Cm2.update(GL.W / GL.H);
            GL.bindFB(null); GL.depth(false, { write: false }); GL.blend('off'); GL.cull('off');
            GL.clear(0, 0, 0, 1, true);
            probe.use();
            probe.set('uInv', Cm2.invViewProj).set('uCam', Cm2.pos);
            GL.drawScreen();
            var w = GL.W, h = GL.H, buf = new Uint8Array(16);
            var pts = [[2, 2], [w - 3, 2], [w >> 1, h >> 1], [w - 3, h - 3]], res = [];
            for (var pi2 = 0; pi2 < pts.length; pi2++) {
              gl.readPixels(pts[pi2][0], pts[pi2][1], 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
              res.push(buf[0] + ',' + buf[1] + ',' + buf[2]);
            }
            return res.join(' | ');
          }
          log('  探针 near=40 far=4e6 : ' + probeRead(40, 4.0e6));
          log('  探针 near=1  far=1000: ' + probeRead(1, 1000));
        } catch (pe) { log('  探针失败: ' + pe.message); }
        /* 关泛光再测，判断是否泛光导致 */
        DSC.Render.bloomOn = false; step(2);
        log('  无泛光: mean=' + stats().mean + ' colors=' + stats().colors);
        DSC.Render.bloomOn = true;
      }

      /* --- 2. 地表（三个不同群系） --- */
      for (var pi = 0; pi < Math.min(3, Game.system.planets.length); pi++) {
        var planet = Game.system.planets[pi];
        Game.prepareWorld(planet, 1024, 1024);
        var spot = DSC.World.findLandingSpot(1024, 1024);
        DSC.World.preload(spot[0], spot[2], 2);
        Game.shipLocal.pos[0] = spot[0] + 0.5; Game.shipLocal.pos[1] = spot[1]; Game.shipLocal.pos[2] = spot[2] + 0.5;
        Game.shipLocal.visible = true; Game.shipLocal.gear = 1; Game.shipLocal.yaw = 0.8;
        Game.enterPlanetScene(planet, spot, true);
        Game.inShip = false;
        DSC.Player.pos[0] = spot[0] + 3.5; DSC.Player.pos[2] = spot[2] + 3.5;
        DSC.Player.pos[1] = DSC.World.surfaceY(Math.floor(DSC.Player.pos[0]), Math.floor(DSC.Player.pos[2])) + 0.2;
        DSC.Player.yaw = 2.2; DSC.Player.pitch = -0.1;
        Game.dayT = 0.35;
        step(3);
        var st = stats();
        noFatal('地表 ' + planet.biome);
        judge('planet[' + pi + '/' + planet.biome + ']', st, 12, 205, 4, 55);
        log('   chunks=' + DSC.World.stats.chunks + ' draws=' + GL.stats.draws + ' quads=' + (DSC.World.stats.quads | 0) +
          ' surfaceY=' + DSC.World.surfaceY(Math.floor(DSC.Player.pos[0]), Math.floor(DSC.Player.pos[2])));
        if (DSC.World.stats.chunks < 9) fail('planet[' + pi + '] 区块太少');
        /* 夜间也测一次（自发光/星空） */
        if (pi === 0) {
          Game.dayT = 0.86; step(2);
          judge('planet[0]-night', stats(), 3, 140, 2, 30);
        }
      }

      /* --- 3. 挖掘 / 放置 / 掉落 --- */
      var P = DSC.Player, W = DSC.World;
      var tx = Math.floor(P.pos[0]), tz = Math.floor(P.pos[2]), ty = W.surfaceY(tx, tz) - 1;
      var before = W.blockAt(tx, ty, tz);
      if (!before) fail('挖掘测试：脚下没有方块');
      else {
        /* 裂纹渲染（MC destroy stage）：progress 0.45 时应该画出裂纹 */
        P.mine.x = tx; P.mine.y = ty; P.mine.z = tz; P.mine.id = before; P.mine.progress = 0.45; P.mine.valid = true;
        if (!DSC.Render.crackTex) fail('裂纹贴图未生成');
        else {
          DSC.Render.begin();
          DSC.Render.drawCrack(tx, ty, tz, 0.45);
          DSC.Render.end({ bloomAmt: 0 });
          pass('裂纹叠加渲染无异常（stage ' + Math.floor(0.45 * 10) + '）');
        }
        P.mine.progress = 0;
        P._breakBlock(tx, ty, tz, before);
        if (W.blockAt(tx, ty, tz) !== 0) fail('破坏方块未生效');
        else pass('破坏方块生效（' + DSC.Blocks.keyOf(before) + '）');
        if (!W.setBlock(tx, ty, tz, DSC.Blocks.ID.glow_panel)) fail('放置方块失败');
        else pass('放置方块生效 + 重建网格入队(' + W.meshQueue.length + ')');
        step(2);
        pass('改动后重新出图正常 detail=' + stats().detail);
      }

      /* --- 4. 大气层进入过渡 --- */
      Game.exitToSpace(Game.planet || Game.system.planets[0]);
      step(1);
      var target = Game.system.planets[1] || Game.system.planets[0];
      var sh = DSC.Space.ship;
      var d = target.radius * 1.3;
      sh.pos[0] = target.pos[0] + d * 0.4; sh.pos[1] = target.pos[1] + d * 0.4; sh.pos[2] = target.pos[2] + d * 0.7;
      DSC.Space.lookAtPoint(target.pos);
      sh.throttle = 1;
      Game.landOn(target);
      if (!DSC.Transition.isActive()) fail('大气层进入序列未启动');
      else {
        var phases = {}, fxEntryMax = 0, warnSeen = false, flashMax = 0;
        var feEl = document.getElementById('fx-entry'), fwEl = document.getElementById('fx-flash'),
          ewEl = document.getElementById('entry-warning');
        for (var f = 0; f < 600; f++) {
          Game.update(1 / 30);
          if (f % 25 === 0) Game.render(1 / 30);
          var v = DSC.Transition.visual();
          if (v) phases[v.phase] = (phases[v.phase] || 0) + 1;
          /* DOM 特效层是否真的可见（像素自检看不到 DOM 层） */
          var oe = parseFloat(getComputedStyle(feEl).opacity) || 0;
          if (oe > fxEntryMax) fxEntryMax = oe;
          var of2 = parseFloat(getComputedStyle(fwEl).opacity) || 0;
          if (of2 > flashMax) flashMax = of2;
          if (ewEl.classList.contains('show')) warnSeen = true;
          if (!DSC.Transition.isActive()) break;
        }
        log('DOM 特效：等离子峰值 opacity=' + fxEntryMax.toFixed(2) + ' 白光峰值=' + flashMax.toFixed(2) + ' 警告横幅=' + warnSeen);
        if (fxEntryMax < 0.2) fail('大气层等离子特效不可见（#fx-entry 峰值 ' + fxEntryMax.toFixed(2) + '）');
        else pass('等离子特效可见');
        if (flashMax < 0.3) fail('破云白光不可见（#fx-flash 峰值 ' + flashMax.toFixed(2) + '）');
        else pass('破云白光可见');
        if (!warnSeen) fail('ATMOSPHERIC ENTRY 警告横幅未出现'); else pass('进入大气层警告横幅出现');
        log('过渡阶段(帧@30fps): ' + JSON.stringify(phases));
        var need = ['dive', 'burn', 'flash', 'clouds', 'descent', 'settle'];
        var miss = need.filter(function (k) { return !phases[k]; });
        if (miss.length) fail('过渡缺少阶段: ' + miss.join(','));
        else pass('过渡六阶段全部走通');
        var totalSec = 0;
        for (var pk in phases) totalSec += phases[pk] / 30;
        log('过渡总时长 ≈ ' + totalSec.toFixed(1) + 's');
        if (totalSec > 11) fail('过渡过长（' + totalSec.toFixed(1) + 's > 11s）');
        if (DSC.Transition.isActive()) fail('过渡未在 20 秒内结束');
        else pass('过渡正常结束，state=' + Game.state);
        step(3);
        noFatal('着陆后');
        judge('after-landing', stats(), 10, 205, 3.5, 45);
        if (!Game.shipLocal.visible) fail('着陆后地表飞船不可见');
        else pass('着陆后飞船停在地表 y=' + Game.shipLocal.pos[1].toFixed(1));
      }

      /* --- 5. 起飞过渡 --- */
      Game.launch();
      if (!DSC.Transition.isActive()) log('note: 起飞需要推进剂，已按缺料处理');
      else {
        for (var f2 = 0; f2 < 240 && DSC.Transition.isActive(); f2++) {
          Game.update(1 / 30);
          if (f2 % 30 === 0) Game.render(1 / 30);
        }
        if (DSC.Transition.isActive()) fail('起飞序列未结束'); else pass('起飞序列完成，state=' + Game.state);
        step(2);
        noFatal('起飞后');
        judge('space-after-takeoff', stats(), 5, 170, 2, 35);
      }

      /* --- 6. 曲速 --- */
      DSC.Player.addItem('warp_cell', 1);
      var sysBefore = Game.system.name;
      Game.state = 'space';
      if (!DSC.Space.beginWarp(Game.galaxy.systems[3], null)) fail('曲速未能启动');
      else {
        for (var f3 = 0; f3 < 400 && DSC.Space.warp; f3++) { Game.update(1 / 30); if (f3 % 40 === 0) Game.render(1 / 30); }
        if (DSC.Space.warp) fail('曲速未结束');
        else pass('曲速完成：' + sysBefore + ' → ' + Game.system.name);
        step(2);
        noFatal('曲速抵达');
        judge('new-system', stats(), 5, 170, 2, 35);
      }

      /* --- 7. 存档往返 --- */
      var okW = DSC.Save.write(Game);
      var rd = DSC.Save.read();
      if (!okW || !rd) fail('存档写入/读取失败');
      else pass('存档往返正常（' + JSON.stringify(rd).length + ' 字节，' + rd.discoveries.length + ' 条发现）');

      /* --- 8. GL 错误 --- */
      var e = gl.getError();
      if (e) fail('GL 错误 0x' + e.toString(16)); else pass('无 GL 错误');
      log('draws/frame=' + GL.stats.draws + ' particles=' + DSC.Particles.n);

      /* --- 9. 天空中的兄弟星球（NMS 招牌视觉）是否真的可见 --- */
      try {
        var pl0 = Game.system.planets[0];
        Game.prepareWorld(pl0, 2048, 2048);
        var sp2 = DSC.World.findLandingSpot(2048, 2048);
        DSC.World.preload(sp2[0], sp2[2], 2);
        Game.enterPlanetScene(pl0, sp2, true);
        Game.inShip = false; Game.dayT = 0.62;
        DSC.Player.pitch = 0.55;   /* 抬头看天 */
        step(2);
        var withSky = stats();
        var bak = DSC.SpaceFX.drawPlanet;
        DSC.SpaceFX.drawPlanet = function () { };
        step(2);
        var noSky = stats();
        DSC.SpaceFX.drawPlanet = bak;
        log('抬头看天: 有兄弟星球 mean=' + withSky.mean + '/colors=' + withSky.colors +
          '  无 mean=' + noSky.mean + '/colors=' + noSky.colors);
        if (Math.abs(withSky.mean - noSky.mean) < 0.15 && withSky.colors === noSky.colors) fail('天空中的兄弟星球没有渲染出来');
        else pass('天空可见兄弟星球（画面差异 ' + Math.abs(withSky.mean - noSky.mean).toFixed(2) + '）');
      } catch (e2) { fail('天空星球检查异常: ' + e2.message); }

      /* --- 10. 标题界面（星球特写机位） --- */
      try {
        Game.toTitle();
        step(3);
        judge('title', stats(), 4, 175, 1.2, 30);
      } catch (e3) { fail('标题界面渲染异常: ' + e3.message); }

      /* --- 11. DOM/UI 层自检（CSS 与 ui.js 的契约，像素自检覆盖不到） --- */
      try {
        var cs = function (id) { return getComputedStyle(document.getElementById(id)); };
        var fxL = parseFloat(cs('fx-layer').opacity);
        if (!(fxL > 0.9)) fail('#fx-layer 容器 opacity=' + fxL + '（会让所有全屏特效永久不可见）');
        else pass('#fx-layer 容器透明度正确');
        if (cs('fx-layer').pointerEvents !== 'none') fail('#fx-layer 未穿透点击');
        else pass('#fx-layer 点击穿透');
        var vig = parseFloat(cs('fx-vignette').opacity);
        if (!(vig > 0.5)) fail('暗角未启用 (opacity ' + vig + ')'); else pass('暗角/扫描线层生效');
        if (cs('game-canvas').position !== 'fixed') fail('#game-canvas 布局异常');
        else pass('画布布局正确 ' + cs('game-canvas').position);
        if (parseFloat(cs('ui-root').opacity) < 0.9 || cs('ui-root').pointerEvents !== 'none')
          fail('#ui-root 层设置异常'); else pass('#ui-root 层设置正确');

        /* 快捷栏 / 背包 / 配方 / 星系图 / 日志 的 DOM 是否真的生成 */
        var slots = document.querySelectorAll('#hotbar .slot').length;
        if (slots !== 9) fail('快捷栏槽位数 ' + slots + ' ≠ 9'); else pass('快捷栏 9 槽已生成');
        DSC.UI.showScreen('inventory');
        var inv = document.querySelectorAll('#inv-grid .inv-slot').length;
        var rec = document.querySelectorAll('#refiner-list .recipe').length;
        var cft = document.querySelectorAll('#craft-list .recipe').length;
        if (inv !== DSC.Player.SLOTS) fail('背包槽位 ' + inv + ' ≠ ' + DSC.Player.SLOTS); else pass('背包 ' + inv + ' 槽已生成');
        if (rec !== DSC.Blocks.REFINER.length || cft !== DSC.Blocks.CRAFT.length)
          fail('配方行数不符 refiner=' + rec + ' craft=' + cft);
        else pass('精炼 ' + rec + ' 条 / 合成 ' + cft + ' 条配方已生成');
        var ico = document.querySelector('#inv-grid .inv-slot:not(.empty) .is-ico');
        if (ico && (ico.getAttribute('src') || '').indexOf('data:image/png') !== 0) fail('物品图标 dataURL 未生成');
        else pass('物品像素图标已生成');
        DSC.UI.showScreen('galaxy');
        var gn = document.querySelectorAll('#galaxy-nodes .gnode').length;
        if (gn !== Game.galaxy.systems.length) fail('星系图节点 ' + gn + ' ≠ ' + Game.galaxy.systems.length);
        else pass('星系图 ' + gn + ' 个星系节点 + 画布 ' + document.getElementById('galaxy-canvas').width + 'px');
        DSC.UI.showScreen('log');
        pass('发现日志条目 ' + document.querySelectorAll('#log-list .log-item').length);
        DSC.UI.showScreen(null);
        /* 通知与提示 */
        DSC.UI.notify('自检', '通知系统', 'good');
        DSC.UI.toast('自检 toast');
        DSC.UI.discovery('SELFTEST', '发现横幅');
        if (!document.querySelectorAll('#notify-stack .notify').length) fail('通知未插入 DOM');
        else if (!document.getElementById('discovery-banner').classList.contains('show')) fail('发现横幅未显示');
        else pass('通知 / toast / 发现横幅均正常');
      } catch (e4) { fail('DOM 自检异常: ' + e4.message); }

      var out = 'SELFTEST ' + (fails ? 'FAILED(' + fails + ')' : 'ALL-PASS') + '\n' + lines.join('\n');
      var dbg = document.getElementById('debug-readout');
      dbg.classList.remove('hidden');
      dbg.textContent = out;
      document.title = 'SELFTEST ' + (fails ? 'FAILED-' + fails : 'ALL-PASS');
      console.log(out);
      return out;
    },

    /* 调试直达 */
    debugStart: function (q) {
      Game.newGame(q.seed || 'DEBUG-CORE');
      var pi = Math.max(0, Math.min(Game.system.planets.length - 1, parseInt(q.p || '0', 10) || 0));
      var planet = Game.system.planets[pi];
      if (q.scene === 'planet') {
        Game.prepareWorld(planet, 512, 512);
        var spot = DSC.World.findLandingSpot(512, 512);
        DSC.World.preload(spot[0], spot[2], 4);
        Game.shipLocal.pos[0] = spot[0] + 0.5;
        Game.shipLocal.pos[1] = spot[1];
        Game.shipLocal.pos[2] = spot[2] + 0.5;
        Game.shipLocal.yaw = 0.7; Game.shipLocal.pitch = 0; Game.shipLocal.visible = true; Game.shipLocal.gear = 1;
        Game.enterPlanetScene(planet, spot, true);
        Game.inShip = false;
        DSC.Player.pos[0] = spot[0] + 4.5; DSC.Player.pos[2] = spot[2] + 4.5;
        DSC.Player.pos[1] = DSC.World.surfaceY(Math.floor(DSC.Player.pos[0]), Math.floor(DSC.Player.pos[2])) + 0.2;
        DSC.Player.yaw = 2.2; DSC.Player.pitch = -0.12;
        DSC.UI.planetCard(planet, false);
      } else if (q.scene === 'entry') {
        var sh = DSC.Space.ship;
        var d = planet.radius * 1.28;
        sh.pos[0] = planet.pos[0] + d * 0.4; sh.pos[1] = planet.pos[1] + d * 0.35; sh.pos[2] = planet.pos[2] + d * 0.72;
        DSC.Space.lookAtPoint(planet.pos);
        sh.throttle = 1;
        Game.landOn(planet);
      } else if (q.scene === 'title') {
        Game.toTitle();
      }
    },
    /* ---------------------------------------------------------- 开局 / 读档 */
    newGame: function (seedStr) {
      seedStr = (seedStr || DSC.UI.randSeed()).trim().toUpperCase();
      Game.galaxy = DSC.Universe.makeGalaxy(seedStr, 26);
      Game.galaxy.current = 0;
      Game.system = Game.galaxy.systems[0];
      Game.system.visited = true;
      Game.editsByPlanet = {};
      Game.discoveries = [];
      Game.stats = { landings: 0, warps: 0, blocksMined: 0 };
      Game.planet = null;
      Game.inShip = true;
      Game.shipLocal.visible = false;
      DSC.Player.init([0, 60, 0], false);
      DSC.Player.addItem('launch_fuel', 2);
      DSC.Player.addItem('warp_cell', 1);
      DSC.Space.init(Game.galaxy, Game.system, null);
      DSC.Space.ship.hull = 100; DSC.Space.ship.shield = 100;
      Game.state = 'space';
      DSC.UI.showScreen(null);
      DSC.UI.hideShipHud();
      A() && A().setMusic('space');
      A() && A().loop('ambient_space', { volume: 0.5 });
      Game.ambient = 'ambient_space';
      DSC.UI.systemArrival(Game.system);
      DSC.UI.subtitle('对准一颗星球，按住 W 与 Shift 俯冲进入大气层', 7);
      Input.lock(Game.canvas);
    },

    loadGame: function () {
      var d = DSC.Save.read();
      if (!d) { DSC.UI.toast('没有存档 · NO SAVE DATA'); A() && A().play('ui_error'); return; }
      Game.galaxy = DSC.Universe.makeGalaxy(d.seedStr, 26);
      DSC.Save.applyFlags(Game.galaxy, d.flags);
      Game.galaxy.current = d.current || 0;
      Game.system = Game.galaxy.systems[Game.galaxy.current];
      Game.editsByPlanet = d.edits || {};
      Game.discoveries = d.discoveries || [];
      Game.stats = d.stats || { landings: 0, warps: 0, blocksMined: 0 };
      Game.dayT = d.dayT === undefined ? 0.32 : d.dayT;
      DSC.Player.restore(d.player);
      DSC.Space.restore(d.ship);
      DSC.Space.init(Game.galaxy, Game.system, null);
      if (d.ship) DSC.Space.restore(d.ship);
      if (d.state === 'planet' && d.planetIndex >= 0) {
        var p = Game.system.planets[d.planetIndex];
        Game.prepareWorld(p, Math.round(d.player.pos[0]), Math.round(d.player.pos[2]));
        Game.enterPlanetScene(p, [d.player.pos[0], d.player.pos[1], d.player.pos[2]], true);
        Game.shipLocal.pos[0] = d.shipLocal[0]; Game.shipLocal.pos[1] = d.shipLocal[1];
        Game.shipLocal.pos[2] = d.shipLocal[2]; Game.shipLocal.yaw = d.shipLocal[3];
        Game.shipLocal.visible = true; Game.shipLocal.gear = 1;
        Game.inShip = !!d.inShip;
        DSC.Player.pos[0] = d.player.pos[0]; DSC.Player.pos[1] = d.player.pos[1]; DSC.Player.pos[2] = d.player.pos[2];
        Game.state = 'planet';
        DSC.UI.planetCard(p, false);
        DSC.UI.hideShipHud();
        A() && A().setMusic('planet');
      } else {
        Game.planet = null;
        Game.state = 'space';
        Game.inShip = true;
        A() && A().setMusic('space');
      }
      DSC.UI.showScreen(null);
      DSC.UI.toast('存档已载入 · SAVE LOADED');
      Input.lock(Game.canvas);
    },

    toTitle: function () {
      Game.state = 'title';
      Game.planet = null;
      DSC.World.dispose && DSC.World.dispose();
      DSC.Space.system = Game.preview;
      DSC.Space.galaxy = { systems: [Game.preview], current: 0 };
      DSC.UI.showScreen('title');
      DSC.UI.hideShipHud();
      DSC.UI.saveInfo(DSC.Save.info());
      Input.unlock();
      if (A()) { A().stopAll && A().stopAll(); A().setMusic('title'); A().engine(0, 0); A().wind(0); }
      Game.ambient = '';
    },

    /* ---------------------------------------------------------- 世界准备 */
    prepareWorld: function (planet, wx, wz) {
      var pk = 'p' + planet.seed;
      var edits = Game.editsByPlanet[pk] || (Game.editsByPlanet[pk] = {});
      DSC.World.dispose();
      DSC.World.init(planet, edits);
      DSC.World.renderDist = DSC.UI.settings.dist | 0;
      /* 先同步生成一小片，保证落点有地面 */
      DSC.World.preload(wx, wz, 2);
      Game.planet = planet;
    },
    streamWorld: function (wx, wz, dt) {
      DSC.World.update(wx, wz, Math.min(DSC.World.renderDist, 6), 9);
    },

    enterPlanetScene: function (planet, spot, silent) {
      Game.planet = planet;
      Game.dayT = silent ? Game.dayT : 0.3 + Math.random() * 0.12;
      DSC.World.preload(Math.round(spot[0]), Math.round(spot[2]), 2);
      var sy = DSC.World.surfaceY(Math.round(spot[0]), Math.round(spot[2]));
      DSC.Player.init([spot[0], Math.max(spot[1], sy) + 0.2, spot[2]], true);
      DSC.Player.yaw = Game.shipLocal.yaw + Math.PI;
      Game.inShip = true;
      Game.state = 'planet';
      DSC.UI.hideShipHud();
      if (!silent) {
        Game.stats.landings++;
        if (!planet.visited) {
          planet.visited = true; planet.discovered = true;
          var award = 3200 + ((planet.seed % 17) * 140);
          DSC.Player.units += award;
          Game.addDiscovery(planet.customName || planet.name, planet.labels.biome.zh + ' · ' + planet.labels.blurb, '星球 PLANET');
          setTimeout(function () {
            DSC.UI.discovery(planet.customName || planet.name, planet.labels.blurb);
            DSC.UI.notify('发现已上传', '+' + U.fmtNum(award) + ' 单位', 'good');
            A() && A().play('upload', { volume: 0.7 });
          }, 900);
        }
      }
    },

    exitToSpace: function (planet) {
      Game.state = 'space';
      Game.inShip = true;
      Game.shipLocal.visible = false;
      DSC.Space.init(Game.galaxy, Game.system, planet);
      DSC.World.dispose();
      Game.planet = null;
      if (A()) { A().stopLoop('ambient_planet', 1.2); A().stopLoop('ambient_cave', 0.6); A().stopLoop('ambient_underwater', 0.4); A().loop('ambient_space', { volume: 0.5 }); }
      Game.ambient = 'ambient_space';
    },

    addDiscovery: function (name, desc, kind) {
      Game.discoveries.push({ name: name, desc: desc, kind: kind, t: Date.now() });
      if (Game.discoveries.length > 200) Game.discoveries.shift();
    },

    /* ---------------------------------------------------------- 交互动作 */
    boardShip: function () {
      if (Game.inShip) return;
      Game.inShip = true;
      A() && A().play('ship_hatch', { volume: 0.8 });
      DSC.UI.subtitle('按 Space 起飞 · 按 F 离船', 4);
      if (A()) A().mining(false);
    },
    leaveShip: function () {
      if (!Game.inShip) return;
      Game.inShip = false;
      var sl = Game.shipLocal;
      var ox = Math.cos(sl.yaw) * 3.2, oz = -Math.sin(sl.yaw) * 3.2;
      var x = sl.pos[0] + ox, z = sl.pos[2] + oz;
      var y = DSC.World.surfaceY(Math.floor(x), Math.floor(z));
      DSC.Player.pos[0] = x; DSC.Player.pos[1] = y + 0.1; DSC.Player.pos[2] = z;
      DSC.Player.vel[1] = 0;
      DSC.Player.yaw = sl.yaw + Math.PI;
      A() && A().play('ship_hatch', { volume: 0.8 });
    },
    launch: function () {
      if (DSC.Transition.isActive()) return;
      if (!DSC.Player.removeItem('launch_fuel', 1)) {
        DSC.UI.notify('起飞失败', '需要 起飞推进剂 ×1（精炼碳 → 凝聚碳，再合成）', 'bad');
        A() && A().play('ui_error', { volume: 0.6 });
        return;
      }
      Game.state = 'transition';
      DSC.Transition.beginExit(Game.planet, function () {
        Game.state = 'space';
        DSC.UI.subtitle('已离开 ' + (Game.planet ? '' : '') + '大气层 · 星系图 J', 4);
      });
    },
    landOn: function (planet) {
      if (DSC.Transition.isActive()) return;
      Game.state = 'transition';
      DSC.Transition.beginEntry(planet, function () {
        Game.state = 'planet';
      });
    },
    doWarp: function (idx) {
      var G = Game.galaxy;
      if (idx < 0 || idx === G.current) { A() && A().play('ui_error'); return; }
      var target = G.systems[idx];
      if (Game.state !== 'space') { DSC.UI.toast('必须在太空中跳跃 · MUST BE IN SPACE'); A() && A().play('ui_error'); return; }
      if (DSC.Space.beginWarp(target, function () {
        Game.system = DSC.Space.system;
        Game.stats.warps++;
        DSC.UI.subtitle('抵达 ' + Game.system.name, 5);
      })) {
        Game.closeMenus();
        Game.state = 'space';
      }
    },
    scanSystem: function () {
      var s = Game.system;
      if (s.scanned) { DSC.UI.toast('本星系已扫描'); return; }
      s.scanned = true;
      var gain = 1200 + s.planets.length * 320;
      DSC.Player.units += gain;
      s.planets.forEach(function (p) { p.discovered = true; });
      Game.addDiscovery(s.name, '星系扫描：' + s.planets.length + ' 颗行星编入星图', '星系 SYSTEM');
      A() && A().play('upload', { volume: 0.8 });
      DSC.UI.notify('星系扫描完成', '+' + U.fmtNum(gain) + ' 单位', 'good');
      DSC.UI.refreshGalaxy();
    },
    respawn: function () {
      var P = DSC.Player;
      P.health = P.healthMax; P.shield = P.shieldMax; P.oxygen = P.oxygenMax; P.protection = P.protectionMax;
      P.dead = false;
      if (Game.state === 'planet' || Game.planet) {
        var sl = Game.shipLocal;
        var y = DSC.World.surfaceY(Math.floor(sl.pos[0]), Math.floor(sl.pos[2]));
        P.pos[0] = sl.pos[0] + 2.5; P.pos[1] = y + 0.2; P.pos[2] = sl.pos[2];
        P.vel[0] = P.vel[1] = P.vel[2] = 0;
        Game.inShip = false;
        Game.state = 'planet';
      } else Game.state = 'space';
      DSC.UI.showScreen(null);
      Input.lock(Game.canvas);
    },
    closeMenus: function () {
      DSC.UI.showScreen(null);
      if (Game.state === 'planet' || Game.state === 'space') Input.lock(Game.canvas);
    },

    /* ---------------------------------------------------------- 输入分发 */
    handleKeys: function () {
      var UIx = DSC.UI, P = DSC.Player;
      if (Input.pressed('escape')) {
        if (UIx.screen && UIx.screen !== 'pause') UIx.closeScreen();
        else if (UIx.screen === 'pause') Game.closeMenus();
        else if (Game.state === 'planet' || Game.state === 'space') { UIx.showScreen('pause'); Input.unlock(); }
      }
      if (Game.state === 'title' || Game.state === 'boot') return;

      if (Input.pressed('e')) {
        if (UIx.screen === 'inventory') UIx.closeScreen();
        else if (!UIx.screen) { UIx.showScreen('inventory'); Input.unlock(); }
      }
      if (Input.pressed('j')) {
        if (UIx.screen === 'galaxy') UIx.closeScreen();
        else if (!UIx.screen) {
          if (Game.state !== 'space') UIx.toast('需在太空中使用星系图 · SPACE ONLY');
          else { UIx.galaxySel = Game.galaxy.current; UIx.showScreen('galaxy'); Input.unlock(); }
        }
      }
      if (Input.pressed('l')) {
        if (UIx.screen === 'log') UIx.closeScreen();
        else if (!UIx.screen) { UIx.showScreen('log'); Input.unlock(); }
      }
      if (Input.pressed('f3')) {
        var d = document.getElementById('debug-readout');
        d.classList.toggle('hidden');
      }
      if (Input.pressed('f5')) { P.thirdPerson = !P.thirdPerson; }
      if (UIx.screen) return;

      /* 快捷栏 */
      for (var i = 1; i <= 9; i++) if (Input.pressed(String(i))) P.sel = i - 1;
      if (Input.wheel) {
        P.sel = (P.sel + (Input.wheel > 0 ? 1 : -1) + 9) % 9;
        A() && A().play('ui_hover', { volume: 0.25 });
      }

      if (Game.state === 'planet') {
        if (Input.pressed('c') && !Game.inShip) P.scan(Game.planet);
        if (Input.pressed('f')) {
          if (Game.inShip) Game.leaveShip();
          else {
            var d2 = Math.hypot(P.pos[0] - Game.shipLocal.pos[0], P.pos[1] - Game.shipLocal.pos[1], P.pos[2] - Game.shipLocal.pos[2]);
            if (d2 < 7.5) Game.boardShip();
            else DSC.UI.toast('靠近飞船才能登船');
          }
        }
        if (Input.pressed(' ') && Game.inShip) Game.launch();
      } else if (Game.state === 'space') {
        if (Input.pressed('f') && DSC.Space.nearPlanet) Game.landOn(DSC.Space.nearPlanet);
        if (Input.pressed('c')) {
          var t = DSC.Space.target;
          if (t && t.kind === 'planet') {
            if (!t.obj.discovered) {
              t.obj.discovered = true;
              var g = 900 + (t.obj.seed % 400);
              DSC.Player.units += g;
              Game.addDiscovery(t.obj.name, t.obj.labels.biome.zh + ' · 轨道扫描', '轨道扫描 ORBITAL');
              DSC.UI.notify('轨道扫描完成', t.obj.name + ' +' + U.fmtNum(g) + ' 单位', 'good');
              A() && A().play('upload', { volume: 0.7 });
            } else DSC.UI.toast('该星球已扫描');
            A() && A().play('scan_ping', { volume: 0.7 });
          } else A() && A().play('ui_error', { volume: 0.4 });
        }
      }
    },

    /* ---------------------------------------------------------- 更新 */
    update: function (dt) {
      Game.time += dt;
      Game.handleKeys();
      var UIx = DSC.UI, P = DSC.Player;
      var menuOpen = !!UIx.screen;
      Input.sens = UIx.settings.sens / 100;
      Game.fov = UIx.settings.fov;

      if (DSC.Transition.isActive()) {
        DSC.Transition.update(dt);
        DSC.Particles.update(dt);
        if (DSC.Space.warp) DSC.Space.updateWarp(dt);
        return;
      }

      if (Game.state === 'title') {
        Game.titleAngle += dt * 0.045;
        DSC.Space.time += dt;
        DSC.Space.updateOrbits(dt * 60);
        DSC.Particles.update(dt);
        return;
      }

      if (Game.state === 'space') {
        if (DSC.Space.warp) { DSC.Space.updateWarp(dt); }
        DSC.Space.update(dt, Input, !menuOpen && Input.locked && !DSC.Space.warp);
        DSC.Particles.update(dt);
        /* 自动进入大气层 */
        if (DSC.Space.entryReq && !DSC.Space.warp) Game.landOn(DSC.Space.entryReq);
        Game.updateAmbient(dt);
        return;
      }

      if (Game.state === 'planet') {
        /* 昼夜 */
        Game.dayT = (Game.dayT + dt / Game.planet.sky.dayLength) % 1;
        var allow = !menuOpen && Input.locked && !Game.inShip && !P.dead;
        if (!Game.inShip) {
          if (allow) {
            var sens = 0.0022 * Input.sens;
            P.yaw -= Input.mdx * sens;
            P.pitch = U.clamp(P.pitch - Input.mdy * sens, -1.55, 1.55);
          }
          DSC.Player.update(dt, Input, Game.planet, allow);
        } else {
          /* 座舱视角：自由环视 */
          if (!menuOpen && Input.locked) {
            var s2 = 0.0022 * Input.sens;
            P.yaw -= Input.mdx * s2;
            P.pitch = U.clamp(P.pitch - Input.mdy * s2, -1.2, 1.2);
          }
          if (A()) A().mining(false);
        }
        DSC.World.update(P.pos[0], P.pos[2], UIx.settings.dist | 0, 7);
        DSC.Particles.update(dt);
        Game.updateAmbient(dt);
        if (P.dead && Game.state === 'planet') {
          Game.state = 'planet';
          UIx.death(P.deadCause);
          Input.unlock();
        }
        return;
      }
    },

    updateAmbient: function (dt) {
      var P = DSC.Player, want = '', windI = 0;
      if (Game.state === 'space' || Game.state === 'transition') {
        want = 'ambient_space';
      } else if (Game.state === 'planet') {
        if (P.headInWater) want = 'ambient_underwater';
        else if (Game.underground()) want = 'ambient_cave';
        else want = 'ambient_planet';
        var w = Game.planet.labels.weather.hazard;
        windI = Game.inShip ? 0.12 : U.clamp(0.22 + w * 0.22, 0, 1);
        if (want === 'ambient_cave') windI *= 0.15;
      }
      if (want !== Game.ambient) {
        if (A()) {
          if (Game.ambient) A().stopLoop(Game.ambient, 0.8);
          if (want) A().loop(want, { volume: want === 'ambient_space' ? 0.5 : 0.42 });
          if (Game.state === 'planet') A().setMusic(want === 'ambient_cave' ? 'cave' : 'planet');
        }
        Game.ambient = want;
      }
      if (A()) A().wind(windI);
    },

    underground: function () {
      var P = DSC.Player, W = DSC.World, n = 0;
      var x = Math.floor(P.pos[0]), y = Math.floor(P.pos[1]) + 2, z = Math.floor(P.pos[2]);
      for (var i = 0; i < 26; i++) {
        var id = W.blockAt(x, y + i, z);
        if (id && DSC.Blocks.isOpaque(id)) n++;
      }
      return n > 5;
    },

    /* ---------------------------------------------------------- 渲染 */
    render: function (dt) {
      var R = DSC.Render, UIx = DSC.UI, P = DSC.Player, Cam = DSC.Cam;
      var vis = DSC.Transition.visual();
      var shake = 0, heat = 0;

      if (vis) {
        shake = UIx.settings.shake ? vis.shake : 0;
        heat = vis.heat;
        if (vis.inSpace) {
          Game.drawSpaceScene(dt, { starFade: vis.starFade, heat: heat, shake: shake, hideShip: false });
        } else {
          Game.drawPlanetScene(dt, { spaceBlend: vis.skyBlend, starFade: vis.starFade, heat: heat, shake: shake, cinematic: true });
        }
        return;
      }

      if (Game.state === 'title') { Game.drawTitle(dt); return; }
      if (Game.state === 'space') { Game.drawSpaceScene(dt, { starFade: 1, heat: 0, shake: 0 }); return; }
      if (Game.state === 'planet') { Game.drawPlanetScene(dt, { spaceBlend: 0, heat: 0, shake: P.hurtT * 0.02 }); return; }
      /* 兜底：黑屏 */
      R.begin(); R.end({});
    },

    drawTitle: function (dt) {
      var R = DSC.Render, Cam = DSC.Cam;
      var S = DSC.Space.system, p = S.planets[0];
      var d = p.radius * 3.1;
      var a = Game.titleAngle;
      Cam.pos[0] = p.pos[0] + Math.cos(a) * d;
      Cam.pos[1] = p.pos[1] + d * 0.28;
      Cam.pos[2] = p.pos[2] + Math.sin(a) * d;
      var dir = [p.pos[0] - Cam.pos[0], p.pos[1] - Cam.pos[1], p.pos[2] - Cam.pos[2]];
      var hl = Math.sqrt(dir[0] * dir[0] + dir[2] * dir[2]);
      Cam.yaw = Math.atan2(-dir[0], -dir[2]);
      Cam.pitch = Math.atan2(dir[1], hl);
      Cam.roll = 0;
      R.begin();
      DSC.Space.render(dt, { hideShip: true, fov: 58, starFade: 1 });
      R.end({ bloomAmt: 0.9, exposure: 1.05, vignette: 0.5, aberr: 0.8, time: Game.time });
    },

    drawSpaceScene: function (dt, o) {
      var R = DSC.Render, Cam = DSC.Cam;
      R.begin();
      if (o.shake) Cam.shakeAmt = o.shake;
      var keep = [Cam.pos[0], Cam.pos[1], Cam.pos[2]];
      if (o.shake) Cam.applyShake(o.shake * 2.2, Game.time);
      DSC.Space.render(dt, { hideShip: !!o.hideShip, fov: Game.fov, starFade: o.starFade === undefined ? 1 : o.starFade });
      Cam.pos[0] = keep[0]; Cam.pos[1] = keep[1]; Cam.pos[2] = keep[2];
      R.end({
        bloomAmt: 0.85, exposure: 1.02, vignette: 0.42,
        aberr: 0.7 + (DSC.Space.ship.pulse || 0) * 2.5,
        heat: o.heat || 0, desat: 0, time: Game.time
      });
    },

    drawPlanetScene: function (dt, o) {
      var R = DSC.Render, Cam = DSC.Cam, P = DSC.Player, W = DSC.World, E = R.env;
      var planet = Game.planet;
      if (!planet) { R.begin(); R.end({}); return; }
      R.setPlanetEnv(planet, Game.dayT, {});
      /* 太空混合（进入/离开大气层时天空过渡） */
      var sb = o.spaceBlend || 0;
      if (sb > 0) {
        E.skyTop = lerp3(E.skyTop, [0.004, 0.006, 0.016], sb);
        E.skyHorizon = lerp3(E.skyHorizon, [0.01, 0.014, 0.03], sb * 0.92);
        E.fogColor = lerp3(E.fogColor, [0.01, 0.012, 0.028], sb * 0.9);
        E.starFade = Math.max(E.starFade, sb);
        E.cloud *= (1 - sb * 0.55);
        E.fogDensity *= (1 - sb * 0.85);
        E.haze = 1 - sb * 0.7;
      }
      E.underwater = P.headInWater ? 1 : 0;

      /* 相机 */
      if (Game.inShip) {
        var sl = Game.shipLocal;
        var cy = Math.cos(sl.yaw), sy = Math.sin(sl.yaw);
        var fx = -sy, fz = -cy;
        Cam.pos[0] = sl.pos[0] + fx * (o.cinematic ? -10.5 : -0.2) + (o.cinematic ? 0 : 0);
        Cam.pos[1] = sl.pos[1] + (o.cinematic ? 4.2 : 1.55);
        Cam.pos[2] = sl.pos[2] + fz * (o.cinematic ? -10.5 : -0.2);
        if (o.cinematic) {
          /* 过渡期：电影机位盯着飞船 */
          var dx = sl.pos[0] - Cam.pos[0], dy = sl.pos[1] - Cam.pos[1], dz = sl.pos[2] - Cam.pos[2];
          var hl = Math.sqrt(dx * dx + dz * dz);
          Cam.yaw = Math.atan2(-dx, -dz);
          Cam.pitch = Math.atan2(dy, hl);
        } else { Cam.yaw = P.yaw; Cam.pitch = P.pitch; }
        Cam.roll = 0;
      } else {
        P.applyCamera(dt);
      }
      Cam.fov = Game.fov + (P.sprint ? 3.5 : 0);
      Cam.near = 0.08; Cam.far = 30 + (W.renderDist + 1) * 16;
      if (o.shake) Cam.applyShake(o.shake, Game.time);
      Cam.update(GL.W / GL.H);

      R.begin();
      R.drawSky(Game.time);
      Game.drawSkyBodies();
      Cam.near = 0.08; Cam.far = 30 + (W.renderDist + 1) * 16;
      Cam.update(GL.W / GL.H);
      R.drawChunks(Game.time);
      /* 地表飞船 */
      if (Game.shipLocal.visible) {
        var sl2 = Game.shipLocal;
        var m = M4.identity();
        M4.translate(m, [sl2.pos[0], sl2.pos[1] + 1.25 + (1 - sl2.gear) * 0.4, sl2.pos[2]], m);
        M4.rotateY(m, sl2.yaw, m);
        M4.rotateX(m, sl2.pitch, m);
        M4.rotateZ(m, -sl2.roll, m);
        M4.scale(m, [0.62, 0.62, 0.62], m);
        R.drawModel(DSC.Models.get('ship'), m, { glow: sl2.engineGlow || 0, ambient: [0.28, 0.32, 0.4] });
      }
      /* 选择框 */
      if (!Game.inShip && P.mine.valid && !DSC.UI.screen) {
        var h = W.raycast(P.eye(), Cam.fwd, 5.6);
        if (h.hit) {
          R.drawSelection(h.x, h.y, h.z, 1);
          /* 挖掘裂纹（MC 招牌） */
          if (P.mine.progress > 0.02 && h.x === P.mine.x && h.y === P.mine.y && h.z === P.mine.z) {
            R.drawCrack(h.x, h.y, h.z, P.mine.progress);
          }
        }
      }
      R.drawParticles();
      R.end({
        bloomAmt: 0.55 + (1 - R.env.day) * 0.35, exposure: 1.04,
        vignette: 0.32 + (P.headInWater ? 0.2 : 0),
        aberr: 0.5, heat: o.heat || 0,
        desat: P.health < 30 ? (1 - P.health / 30) * 0.55 : 0,
        time: Game.time
      });
    },

    /* 天空中的兄弟星球（NMS 招牌视觉）：
       先清深度，再用"远平面相机"渲染它们，最后恢复近平面相机交给地表渲染 ——
       顺序颠倒会让星球被近平面裁掉 */
    drawSkyBodies: function () {
      var SFX = DSC.SpaceFX, Cam = DSC.Cam, S = Game.system;
      if (!SFX || !SFX.drawPlanet || !S || !Game.planet) return;
      var gl = GL.gl;
      /* 1) 先按地表相机清深度（此后天空物件会被地形正确遮挡） */
      var near = Cam.near, far = Cam.far;
      gl.clear(gl.DEPTH_BUFFER_BIT);
      /* 2) 远平面相机渲染星球 */
      Cam.near = 4000; Cam.far = 4.0e6;
      Cam.update(GL.W / GL.H);
      var ctx = { viewProj: Cam.viewProj, invViewProj: Cam.invViewProj, camPos: Cam.pos, time: Game.time };
      GL.depth(false, { write: false });
      var sunAng = Game.dayT * Math.PI * 2;
      var sunDir = [Math.cos(sunAng), Math.sin(sunAng), 0.28];
      var shown = 0;
      for (var i = 0; i < S.planets.length && shown < 3; i++) {
        var p = S.planets[i];
        if (p === Game.planet) continue;
        shown++;
        /* 固定在天空的方位（按索引分布），随昼夜缓慢移动 */
        var ang = (i * 2.1) + Game.dayT * 0.7;
        var elev = 0.32 + 0.24 * Math.sin(i * 1.7);
        var dist = 260000;
        var pos = [
          Cam.pos[0] + Math.cos(ang) * dist * Math.cos(elev),
          Cam.pos[1] + Math.sin(elev) * dist,
          Cam.pos[2] + Math.sin(ang) * dist * Math.cos(elev)
        ];
        SFX.drawPlanet(ctx, {
          pos: pos, radius: dist * (0.075 + (p.radius / 3400) * 0.085), spin: Game.time * 0.004,
          seed: (p.seed % 8192) / 8192, sunDir: sunDir, palette: p.palette,
          atmoColor: p.atmoColor, atmoStrength: p.atmoStrength * 0.8,
          hasWater: p.hasWater, hasClouds: p.hasClouds, hasRings: p.hasRings,
          ringColor: p.ringColor, cityLights: p.cityLights, axialTilt: p.axialTilt
        });
      }
      GL.depth(true, { write: true });
      /* 3) 恢复地表相机（不再次清深度：星球已写入的深度留给地形做遮挡测试） */
      Cam.near = near; Cam.far = far;
      Cam.update(GL.W / GL.H);
    },

    /* ---------------------------------------------------------- HUD 数据 */
    updateHud: function (dt) {
      var UIx = DSC.UI, P = DSC.Player;
      if (Game.state === 'title' || Game.state === 'boot') return;
      Game.markers.length = 0;
      if (Game.state === 'planet') {
        UIx.hideShipHud();
        /* 飞船标记 */
        if (Game.shipLocal.visible && !Game.inShip) {
          var d = Math.hypot(P.pos[0] - Game.shipLocal.pos[0], P.pos[1] - Game.shipLocal.pos[1], P.pos[2] - Game.shipLocal.pos[2]);
          Game.markers.push({ pos: [Game.shipLocal.pos[0], Game.shipLocal.pos[1] + 4, Game.shipLocal.pos[2]], name: '星际飞船', dist: d, kind: 'ship' });
        }
        /* 扫描命中 */
        if (P.scanHits && P.scanT > 0) {
          for (var i = 0; i < P.scanHits.length && i < 14; i++) {
            var h = P.scanHits[i];
            var dd = Math.hypot(P.pos[0] - h.x, P.pos[1] - h.y, P.pos[2] - h.z);
            Game.markers.push({ pos: [h.x, h.y + 0.5, h.z], name: DSC.Blocks.itemName(h.k).zh, dist: dd, kind: 'poi' });
          }
        }
        /* 兴趣点（方碑） */
        if (DSC.World.poi) {
          for (var j = 0; j < DSC.World.poi.length; j++) {
            var q = DSC.World.poi[j];
            var d2 = Math.hypot(P.pos[0] - q.x, P.pos[1] - q.y, P.pos[2] - q.z);
            if (d2 < 120) Game.markers.push({ pos: [q.x, q.y + 8, q.z], name: '异星方碑', dist: d2, kind: 'station' });
          }
        }
        /* 登船提示 */
        if (!Game.inShip && Game.shipLocal.visible) {
          var dz = Math.hypot(P.pos[0] - Game.shipLocal.pos[0], P.pos[2] - Game.shipLocal.pos[2]);
          UIx.interact(dz < 7.5, 'F', '登船 BOARD', 0);
        } else if (Game.inShip) {
          UIx.interact(true, 'Space', '起飞 LAUNCH · F 离船', 0);
        } else UIx.interact(false);

        UIx.update(dt, {
          yaw: Game.inShip ? Game.shipLocal.yaw : P.yaw, dayT: Game.dayT, fps: Game.fps,
          planet: Game.planet, state: Game.state + (Game.inShip ? '/ship' : ''), markers: Game.markers
        });
      } else if (Game.state === 'space') {
        UIx.interact(false);
        var S = Game.system;
        for (var k = 0; k < S.planets.length; k++) {
          var p = S.planets[k];
          Game.markers.push({
            pos: p.pos, name: (p.customName || p.name) + (p.discovered ? '' : ' ?'),
            dist: V3.dist(DSC.Space.ship.pos, p.pos), kind: 'planet'
          });
        }
        Game.markers.push({ pos: S.station.pos, name: '空间站', dist: V3.dist(DSC.Space.ship.pos, S.station.pos), kind: 'station' });
        UIx.update(dt, {
          yaw: DSC.Space.ship.yaw, dayT: undefined, fps: Game.fps,
          planet: null, state: 'space', markers: Game.markers
        });
        UIx.updateShip(dt, { canLand: !!DSC.Space.nearPlanet, hint: DSC.Space.hint });
      } else if (Game.state === 'transition') {
        UIx.update(dt, { yaw: 0, fps: Game.fps, planet: Game.planet, state: 'transition', markers: [] });
      }
    },

    /* ---------------------------------------------------------- 主循环 */
    last: 0,
    _totalFrames: 0,
    frame: function (now) {
      var dt = Game.last ? Math.min(0.05, (now - Game.last) / 1000) : 0.016;
      Game.last = now;
      Game._frames++; Game._fpsT += dt;
      if (Game._fpsT > 0.5) { Game.fps = Game._frames / Game._fpsT; Game._frames = 0; Game._fpsT = 0; }

      try {
        Game.update(dt);
        Game.render(dt);
        Game.updateHud(dt);
      } catch (e) {
        console.error(e);
        if (!Game._errored) {
          Game._errored = true;
          DSC.UI.fatal((e && e.message ? e.message : String(e)) + '\n\n' + (e && e.stack ? e.stack : ''));
        }
      }
      Input.endFrame();
      /* 测试钩子：?frames=N 跑满 N 帧后停机（让无头浏览器能落幕并 dump DOM）；
         ?click=1 在第 10 帧派发一次合成点击，走通"开机自检 → 点击 → 标题界面"真实路径 */
      Game._totalFrames++;
      if (Game.params && Game.params.click && Game._totalFrames === 10) {
        try { window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch (e2) { }
      }
      if (Game.params && Game.params.frames && Game._totalFrames >= (+Game.params.frames)) {
        document.title = 'FRAMES-DONE ' + Game._totalFrames + ' state=' + Game.state +
          ' fatal=' + (document.getElementById('fatal').classList.contains('hidden') ? 'hidden' : 'SHOWN');
        return;
      }
      requestAnimationFrame(Game.frame);
    }
  };

  function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  DSC.Input = Input;
  DSC.Game = Game;

  /* 自动引导 */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Game.boot);
  else Game.boot();
})();
