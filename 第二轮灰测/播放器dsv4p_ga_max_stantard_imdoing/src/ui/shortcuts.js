/*!
 * src/ui/shortcuts.js — 键盘快捷键与帮助面板
 * 设计原则：与常见剪辑软件对齐（J/K/L、I/O、逗号/句点逐帧、M 打标记）。
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util, W = D.W, h = U.h;

  function Shortcuts(app) {
    this.app = app;
    this.map = this._build(app);
    this._bind();
  }

  Shortcuts.prototype._build = function (app) {
    var eng = app.engine;
    return [
      { group: '播放' },
      { keys: ['Space', 'K'], desc: '播放 / 暂停', run: function () { eng.toggle(); } },
      { keys: ['J'], desc: '逐帧倒放（再按停止）', run: function () { if (eng.stepped.active && eng.stepped.dir < 0) eng.stopStepped(); else app.playStepped(-1); } },
      { keys: ['Shift', 'K'], desc: '定格动画正放（按步进帧率）', run: function () { if (eng.stepped.active && eng.stepped.dir > 0) eng.stopStepped(); else app.playStepped(1); } },
      { keys: ['C'], desc: '从帧缓存播放 / 停止', run: function () { app.toggleCachePlay(); } },
      { keys: ['Shift', 'C'], desc: '为当前循环区间构建帧缓存', run: function () { app.buildCache(); } },

      { group: '帧级定位' },
      { keys: ['←', ','], desc: '后退一帧', run: function () { app.step(-1); } },
      { keys: ['→', '.'], desc: '前进一帧', run: function () { app.step(1); } },
      { keys: ['Shift', '←'], desc: '上一个关键帧', run: function () { eng.stepKeyframe(-1); } },
      { keys: ['Shift', '→'], desc: '下一个关键帧', run: function () { eng.stepKeyframe(1); } },
      { keys: ['↑'], desc: '前进 1 秒', run: function () { app.gotoTime(app.displayTime() + 1); } },
      { keys: ['↓'], desc: '后退 1 秒', run: function () { app.gotoTime(app.displayTime() - 1); } },
      { keys: ['Shift', 'J'], desc: '后退 10 帧', run: function () { app.step(-10); } },
      { keys: ['Shift', 'L'], desc: '前进 10 帧', run: function () { app.step(10); } },
      { keys: ['Home'], desc: '第一帧', run: function () { app.gotoFrame(0); } },
      { keys: ['End'], desc: '最后一帧', run: function () { app.gotoFrame(eng.clock.frameCount - 1); } },
      { keys: ['T'], desc: '把焦点移到时间码输入框', run: function () { var el = document.getElementById('tc-input'); el.focus(); el.select(); } },

      { group: '循环与标记' },
      { keys: ['I'], desc: '以当前帧为循环入点', run: function () { app.setLoopIn(); } },
      { keys: ['O'], desc: '以当前帧为循环出点', run: function () { app.setLoopOut(); } },
      { keys: ['L'], desc: '启用 / 关闭循环', run: function () { eng.setLoop({ enabled: !eng.loop.enabled, resetWraps: true }); app.toast(eng.loop.enabled ? '循环开启' : '循环关闭'); } },
      { keys: ['Shift', 'P'], desc: '切换循环模式（正向/乒乓/单次）', run: function () {
        var modes = ['loop', 'pingpong', 'once'];
        var i = modes.indexOf(eng.loop.mode);
        var next = modes[(i + 1) % modes.length];
        eng.setLoop({ mode: next });
        app.toast('循环模式：' + ({ loop: '正向循环', pingpong: '乒乓往复', once: '播完停在出点' })[next]);
      } },
      { keys: ['M'], desc: '在当前帧打 / 删标记', run: function () { app.markers.toggle(app.displayFrame()); } },
      { keys: ['['], desc: '上一个标记', run: function () { var m = app.markers.prev(app.displayFrame()); if (m) app.gotoFrame(m.frame); } },
      { keys: [']'], desc: '下一个标记', run: function () { var m = app.markers.next(app.displayFrame()); if (m) app.gotoFrame(m.frame); } },

      { group: '滤镜与视图' },
      { keys: ['B'], desc: '全部滤镜旁通 / 恢复', run: function () { document.getElementById('btn-chain-bypass').click(); } },
      { keys: ['P'], desc: '循环切换对比模式（结果/左右/差异/原片）', run: function () {
        var v = app.pipeline.view;
        v.splitMode = (v.splitMode + 1) % 4;
        document.getElementById('split-mode').value = String(v.splitMode);
        app.toast('对比模式：' + ['仅滤镜结果', '左右对比', '差异图', '仅原片'][v.splitMode]);
        app.requestRender();
      } },
      { keys: ['N'], desc: '最近邻 / 平滑显示', run: function () {
        var v = app.pipeline.view;
        v.nearest = !v.nearest;
        document.getElementById('chk-nearest').checked = v.nearest;
        app.toast(v.nearest ? '最近邻显示（像素锐利）' : '双线性平滑显示');
        app.requestRender();
      } },
      { keys: ['G'], desc: '像素网格叠加开关', run: function () {
        var v = app.pipeline.view;
        v.gridOverlay = v.gridOverlay > 0 ? 0 : Math.max(2, Math.round(app.pipeline.grid));
        document.getElementById('grid-overlay').value = v.gridOverlay;
        app.requestRender();
      } },
      { keys: ['0'], desc: '视图复位 + 时间轴显示全部', run: function () { app.pipeline.fitToWindow(); app.timeline.fit(); app.requestRender(); } },
      { keys: ['+', '='], desc: '时间轴放大', run: function () { app.timeline.zoomAt(1 / 1.5, app.displayFrame()); } },
      { keys: ['-'], desc: '时间轴缩小', run: function () { app.timeline.zoomAt(1.5, app.displayFrame()); } },
      { keys: ['1', '…', '9'], desc: '套用第 N 个内置风格预设', run: null },

      { group: '导出与其他' },
      { keys: ['S'], desc: '导出当前帧 PNG', run: function () { document.getElementById('btn-still').click(); } },
      { keys: ['O'], desc: '（Ctrl+O）打开视频文件', run: null },
      { keys: ['F'], desc: '全屏', run: function () { app.toggleFullscreen(); } },
      { keys: ['?'], desc: '打开这个帮助', run: function () { app.showHelp(); } },
      { keys: ['Esc'], desc: '关闭弹窗 / 停止逐帧播放', run: function () { W.closeModal('modal-help'); W.closeModal('modal-selftest'); eng.stopStepped(); app.cachePlayer.stop(); } }
    ];
  };

  Shortcuts.prototype._bind = function () {
    var self = this, app = this.app, eng = app.engine;

    document.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        if (ev.key === 'Escape') t.blur();
        return;
      }
      var k = ev.key;
      var lower = k.length === 1 ? k.toLowerCase() : k;
      var shift = ev.shiftKey;
      var ctrl = ev.ctrlKey || ev.metaKey;

      if (ctrl && lower === 'o') { ev.preventDefault(); document.getElementById('file-input').click(); return; }
      if (ctrl && lower === 's') { ev.preventDefault(); app.saveProject(); return; }
      if (ctrl) return;

      var handled = true;
      switch (lower) {
        case ' ': eng.toggle(); break;
        case 'k': shift ? (eng.stepped.active && eng.stepped.dir > 0 ? eng.stopStepped() : app.playStepped(1)) : eng.toggle(); break;
        case 'j': shift ? app.step(-10) : (eng.stepped.active && eng.stepped.dir < 0 ? eng.stopStepped() : app.playStepped(-1)); break;
        case 'l': shift ? app.step(10) : (function () {
          eng.setLoop({ enabled: !eng.loop.enabled, resetWraps: true });
          app.toast(eng.loop.enabled ? '循环开启' : '循环关闭');
        })(); break;
        case 'arrowleft': shift ? eng.stepKeyframe(-1) : app.step(-1); break;
        case 'arrowright': shift ? eng.stepKeyframe(1) : app.step(1); break;
        case ',': app.step(-1); break;
        case '.': app.step(1); break;
        case 'arrowup': app.gotoTime(app.displayTime() + 1); break;
        case 'arrowdown': app.gotoTime(app.displayTime() - 1); break;
        case 'home': app.gotoFrame(0); break;
        case 'end': app.gotoFrame(eng.clock.frameCount - 1); break;
        case 'i': app.setLoopIn(); break;
        case 'o': app.setLoopOut(); break;
        case 'm': app.markers.toggle(app.displayFrame()); break;
        case '[': (function () { var m = app.markers.prev(app.displayFrame()); if (m) app.gotoFrame(m.frame); })(); break;
        case ']': (function () { var m = app.markers.next(app.displayFrame()); if (m) app.gotoFrame(m.frame); })(); break;
        case 'c': shift ? app.buildCache() : app.toggleCachePlay(); break;
        case 'b': document.getElementById('btn-chain-bypass').click(); break;
        case 'n': self._run('N'); break;
        case 'g': self._run('G'); break;
        case 'p': shift ? self._run('Shift+P') : self._run('P'); break;
        case 's': document.getElementById('btn-still').click(); break;
        case 'f': app.toggleFullscreen(); break;
        case 't': (function () { var el = document.getElementById('tc-input'); el.focus(); el.select(); })(); break;
        case '?': app.showHelp(); break;
        case 'escape': W.closeModal('modal-help'); W.closeModal('modal-selftest'); eng.stopStepped(); app.cachePlayer.stop(); break;
        case '0': app.pipeline.fitToWindow(); app.timeline.fit(); app.requestRender(); break;
        case '+': case '=': app.timeline.zoomAt(1 / 1.5, app.displayFrame()); break;
        case '-': app.timeline.zoomAt(1.5, app.displayFrame()); break;
        default:
          if (/^[1-9]$/.test(lower)) {
            var p = D.presets[parseInt(lower, 10) - 1];
            if (p) app.applyPreset(p.id);
          } else handled = false;
      }
      if (handled) ev.preventDefault();
    });
  };

  /** 执行帮助表里某条（按显示的组合键文本查找） */
  Shortcuts.prototype._run = function (label) {
    for (var i = 0; i < this.map.length; i++) {
      var it = this.map[i];
      if (!it.keys || !it.run) continue;
      if (it.keys.join('+') === label) { it.run(); return true; }
    }
    return false;
  };

  /** 渲染帮助内容 */
  Shortcuts.prototype.renderHelp = function (el) {
    U.clear(el);
    var wrap = h('div.keymap');
    this.map.forEach(function (it) {
      if (it.group) {
        wrap.appendChild(h('div.keymap-row', [h('strong', { text: it.group })]));
        return;
      }
      var keys = h('span');
      it.keys.forEach(function (k, i) {
        if (i) keys.appendChild(document.createTextNode(k === '…' ? ' ' : ' / '));
        keys.appendChild(h('span.key', { text: k }));
      });
      wrap.appendChild(h('div.keymap-row', [keys, h('span', { text: it.desc })]));
    });
    el.appendChild(wrap);

    el.appendChild(h('div.divider'));
    el.appendChild(h('div.hint', {
      html: '<strong>鼠标操作</strong><br>' +
        '· 时间轴：拖动＝定位，Shift+拖动＝框选循环区间，拖黄色手柄＝改入/出点，滚轮＝缩放，双击＝显示全部<br>' +
        '· 画面：滚轮＝以光标为中心缩放，拖动＝平移，双击＝适应窗口<br>' +
        '· 滤镜链：拖动条目改顺序，点标题栏折叠，参数值双击可直接输入数字<br>' +
        '<strong>精度说明</strong><br>' +
        '· MP4/MOV 会解析容器采样表，得到逐帧精确时间戳（支持 VFR 与 23.976 这类有理数帧率）<br>' +
        '· 每次帧定位都会校验落点，必要时自动微调重试，因此「第 N 帧」是可复现的<br>' +
        '· WebM/MKV 无采样表解析，帧率由 rVFC 观测推断，可在下方「帧率」里手动指定'
    }));
  };

  D.Shortcuts = Shortcuts;
})(typeof window !== 'undefined' ? window : globalThis);
