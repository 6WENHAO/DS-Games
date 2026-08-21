/*!
 * src/ui/panels.js — 顶栏 / 播放控制条 / 右侧面板（帧与循环、导出、视图检查）的全部接线
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util, W = D.W, TC = D.TC, h = U.h;

  function id(x) { return document.getElementById(x); }

  function Panels(app) {
    this.app = app;
    this.seqToken = null;
    this.els = {};
    this._cacheEyes();
    this._topbar();
    this._transport();
    this._frameTab();
    this._exportTab();
    this._viewTab();
    this._events();
    this.update(true);
  }

  Panels.prototype._cacheEyes = function () {
    var ids = ['btn-open', 'file-input', 'btn-demo', 'btn-url', 'media-name', 'media-badges',
      'btn-selftest', 'btn-help', 'btn-fullscreen', 'btn-help-close', 'btn-selftest-close',
      'btn-key-prev', 'btn-back-10', 'btn-back-1', 'btn-play', 'btn-fwd-1', 'btn-fwd-10', 'btn-key-next',
      'btn-reverse', 'btn-stopmotion', 'tc-input', 'tc-sub', 'frame-input', 'frame-sub',
      'rate-select', 'step-fps', 'fps-select', 'chk-mute', 'volume', 'split-mode', 'split-pos',
      'frame-readout', 'seek-input', 'btn-seek-go', 'seek-verify-hint',
      'btn-loop-in', 'btn-loop-out', 'btn-loop-clear', 'loop-in', 'loop-out', 'chk-loop',
      'loop-mode', 'loop-count', 'loop-readout', 'btn-loop-goto-in', 'btn-loop-goto-out',
      'cache-scale', 'btn-cache-build', 'btn-cache-clear', 'btn-cache-play', 'cache-fps',
      'cache-progress', 'cache-readout',
      'btn-marker-add', 'btn-marker-prev', 'btn-marker-next', 'btn-marker-clear', 'btn-marker-loop', 'marker-list',
      'chk-still-filtered', 'still-scale', 'btn-still',
      'seq-from', 'seq-to', 'seq-step', 'btn-seq-loop', 'chk-seq-filtered', 'btn-seq-export',
      'btn-seq-cancel', 'seq-progress', 'seq-readout',
      'rec-bitrate', 'chk-rec-audio', 'btn-rec', 'rec-readout',
      'btn-project-save', 'btn-project-load', 'project-input',
      'zoom-range', 'zoom-out', 'chk-nearest', 'chk-checker', 'grid-overlay', 'btn-view-reset',
      'chk-magnifier', 'pixel-readout', 'stats-readout', 'index-readout',
      'btn-tl-zoom-in', 'btn-tl-zoom-out', 'btn-tl-fit', 'tl-scale-label',
      'chk-tl-keyframes', 'chk-tl-cache', 'status-gl', 'status-perf'];
    var self = this;
    ids.forEach(function (k) { self.els[k] = id(k); });
  };

  /* ------------------------------------------------------------------ *
   * 顶栏
   * ------------------------------------------------------------------ */
  Panels.prototype._topbar = function () {
    var app = this.app, e = this.els;

    e['btn-open'].addEventListener('click', function () { e['file-input'].click(); });
    e['file-input'].addEventListener('change', function () {
      if (this.files && this.files[0]) app.openFile(this.files[0]);
      this.value = '';
    });
    e['btn-demo'].addEventListener('click', function () { app.openDemo(); });
    e['btn-url'].addEventListener('click', function () {
      var u = prompt('输入视频 URL（需允许跨域，否则无法用作滤镜纹理）：', '');
      if (u) app.openUrl(u.trim());
    });
    e['btn-help'].addEventListener('click', function () { app.showHelp(); });
    e['btn-help-close'].addEventListener('click', function () { W.closeModal('modal-help'); });
    e['btn-selftest'].addEventListener('click', function () { app.selfTest(); });
    e['btn-selftest-close'].addEventListener('click', function () { W.closeModal('modal-selftest'); });
    e['btn-fullscreen'].addEventListener('click', function () { app.toggleFullscreen(); });
    var blockerClose = id('blocker-close');
    if (blockerClose) blockerClose.addEventListener('click', function () { W.hideBlocker(); });
  };

  /* ------------------------------------------------------------------ *
   * 播放控制条
   * ------------------------------------------------------------------ */
  Panels.prototype._transport = function () {
    var app = this.app, eng = app.engine, e = this.els, self = this;

    e['btn-play'].addEventListener('click', function () { eng.toggle(); });
    e['btn-back-1'].addEventListener('click', function () { app.step(-1); });
    e['btn-fwd-1'].addEventListener('click', function () { app.step(1); });
    e['btn-back-10'].addEventListener('click', function () { app.step(-10); });
    e['btn-fwd-10'].addEventListener('click', function () { app.step(10); });
    e['btn-key-prev'].addEventListener('click', function () { eng.stepKeyframe(-1); });
    e['btn-key-next'].addEventListener('click', function () { eng.stepKeyframe(1); });

    e['btn-reverse'].addEventListener('click', function () {
      if (eng.stepped.active && eng.stepped.dir < 0) eng.stopStepped();
      else app.playStepped(-1);
    });
    e['btn-stopmotion'].addEventListener('click', function () {
      if (eng.stepped.active && eng.stepped.dir > 0) eng.stopStepped();
      else app.playStepped(1);
    });

    W.textField(e['tc-input'], function (v) {
      var det = TC.parseDetailed(v, eng.clock.nominalFps);
      if (!isFinite(det.seconds)) { app.toast('时间格式无法识别：' + v, 'error'); return; }
      if (det.kind === 'frame' || det.kind === 'smpte') app.gotoFrame(Math.round(det.frame));
      else app.gotoTime(det.seconds);
    });
    W.numberField(e['frame-input'], {
      min: 0, integer: true,
      onChange: function (v) { app.gotoFrame(v); }
    });

    e['rate-select'].addEventListener('change', function () { eng.setRate(parseFloat(this.value)); });
    W.numberField(e['step-fps'], {
      min: 0.25, max: 120,
      onChange: function (v) { eng.stepped.fps = v; if (eng.stepped.active) eng.startStepped(v, eng.stepped.dir); }
    });

    // 帧率选择
    var fpsSel = e['fps-select'];
    fpsSel.appendChild(h('option', { value: 'auto', text: '自动' }));
    TC.commonFps.forEach(function (f) {
      fpsSel.appendChild(h('option', { value: String(f), text: String(f) }));
    });
    fpsSel.addEventListener('change', function () {
      if (this.value === 'auto') {
        app.toast('已恢复自动帧率（重新加载媒体后完全生效）');
        return;
      }
      var f = parseFloat(this.value);
      eng.clock.overrideFps(f);
      if (eng.clock.mode === 'index') app.toast('索引模式下仅改变时间码显示的名义帧率', 'ok');
      app.refreshAll();
      app.requestRender();
    });

    e['chk-mute'].addEventListener('change', function () { eng.setMuted(this.checked); });
    e['volume'].addEventListener('input', function () { eng.setVolume(parseFloat(this.value)); });

    e['split-mode'].addEventListener('change', function () {
      app.pipeline.view.splitMode = parseFloat(this.value);
      app.requestRender();
    });
    e['split-pos'].addEventListener('input', function () {
      app.pipeline.view.split = parseFloat(this.value);
      if (app.pipeline.view.splitMode === 0) {
        app.pipeline.view.splitMode = 1;
        e['split-mode'].value = '1';
      }
      app.requestRender();
    });

    // 时间轴工具
    e['btn-tl-zoom-in'].addEventListener('click', function () { app.timeline.zoomAt(1 / 1.5, app.displayFrame()); });
    e['btn-tl-zoom-out'].addEventListener('click', function () { app.timeline.zoomAt(1.5, app.displayFrame()); });
    e['btn-tl-fit'].addEventListener('click', function () { app.timeline.fit(); });
    e['chk-tl-keyframes'].addEventListener('change', function () { app.timeline.showKeyframes = this.checked; });
    e['chk-tl-cache'].addEventListener('change', function () { app.timeline.showCache = this.checked; app.timeline.thumbs = this.checked; });
  };

  /* ------------------------------------------------------------------ *
   * 右侧：帧与循环
   * ------------------------------------------------------------------ */
  Panels.prototype._frameTab = function () {
    var app = this.app, eng = app.engine, e = this.els, self = this;

    W.textField(e['seek-input'], function (v) { e['btn-seek-go'].click(); });
    e['btn-seek-go'].addEventListener('click', function () {
      var v = e['seek-input'].value;
      var det = TC.parseDetailed(v, eng.clock.nominalFps);
      if (!isFinite(det.seconds)) { app.toast('无法识别：' + v, 'error'); return; }
      var p = (det.kind === 'frame' || det.kind === 'smpte')
        ? app.gotoFrame(Math.round(det.frame))
        : app.gotoTime(det.seconds);
      Promise.resolve(p).then(function (r) {
        if (r && r.tries != null) {
          e['seek-verify-hint'].textContent = '定位结果：帧 ' + r.frame +
            (r.exact ? '（一次命中' : '（校正 ' + r.tries + ' 次') + '，误差 ' +
            ((r.time - eng.clock.timeOfFrame(r.frame)) * 1000).toFixed(2) + ' ms）';
        }
      });
    });

    U.$$('[data-nudge]').forEach(function (btn) {
      btn.addEventListener('click', function () { app.step(parseInt(this.getAttribute('data-nudge'), 10)); });
    });

    e['btn-loop-in'].addEventListener('click', function () { app.setLoopIn(); });
    e['btn-loop-out'].addEventListener('click', function () { app.setLoopOut(); });
    e['btn-loop-clear'].addEventListener('click', function () { eng.clearLoop(); });
    W.numberField(e['loop-in'], { min: 0, integer: true, onChange: function (v) { eng.setLoop({ inFrame: v }); } });
    W.numberField(e['loop-out'], { min: 0, integer: true, onChange: function (v) { eng.setLoop({ outFrame: v }); } });
    e['chk-loop'].addEventListener('change', function () { eng.setLoop({ enabled: this.checked, resetWraps: true }); });
    e['loop-mode'].addEventListener('change', function () { eng.setLoop({ mode: this.value }); });
    W.numberField(e['loop-count'], { min: 0, integer: true, onChange: function (v) { eng.setLoop({ count: v, resetWraps: true }); } });
    e['btn-loop-goto-in'].addEventListener('click', function () { app.gotoFrame(eng.loop.inFrame); });
    e['btn-loop-goto-out'].addEventListener('click', function () { app.gotoFrame(eng.loop.outFrame); });
    U.$$('[data-loopnudge]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var parts = this.getAttribute('data-loopnudge').split(':');
        var d = parseInt(parts[1], 10);
        if (parts[0] === 'in') eng.setLoop({ inFrame: eng.loop.inFrame + d });
        else eng.setLoop({ outFrame: eng.loop.outFrame + d });
      });
    });

    /* 帧缓存 */
    e['btn-cache-build'].addEventListener('click', function () { app.buildCache(parseFloat(e['cache-scale'].value)); });
    e['btn-cache-clear'].addEventListener('click', function () {
      app.cachePlayer.stop(false);
      app.cache.clear();
      e['cache-progress'].style.width = '0%';
      self.update(true);
      app.requestRender();
    });
    e['btn-cache-play'].addEventListener('click', function () { app.toggleCachePlay(parseFloat(e['cache-fps'].value)); });
    W.numberField(e['cache-fps'], { min: 0.25, max: 120 });

    /* 标记 */
    e['btn-marker-add'].addEventListener('click', function () {
      var m = app.markers.toggle(app.displayFrame());
      app.toast(m ? ('已标记帧 ' + m.frame) : '已删除该帧标记');
    });
    e['btn-marker-prev'].addEventListener('click', function () {
      var m = app.markers.prev(app.displayFrame());
      if (m) app.gotoFrame(m.frame); else app.toast('前面没有标记');
    });
    e['btn-marker-next'].addEventListener('click', function () {
      var m = app.markers.next(app.displayFrame());
      if (m) app.gotoFrame(m.frame); else app.toast('后面没有标记');
    });
    e['btn-marker-clear'].addEventListener('click', function () { app.markers.clear(); });
    e['btn-marker-loop'].addEventListener('click', function () {
      var span = app.markers.spanAround(app.displayFrame());
      if (!span) { app.toast('至少需要一个标记', 'error'); return; }
      eng.setLoop({ inFrame: span.inFrame, outFrame: span.outFrame, enabled: true, resetWraps: true });
      app.toast('循环设为 ' + span.inFrame + ' → ' + span.outFrame, 'ok');
    });
    app.markers.on('change', function () { self.renderMarkers(); });
    this.renderMarkers();
  };

  Panels.prototype.renderMarkers = function () {
    var app = this.app, el = this.els['marker-list'];
    U.clear(el);
    var items = app.markers.items;
    if (!items.length) {
      el.appendChild(h('div.hint', { text: '还没有标记（M 键打点）。' }));
      return;
    }
    items.forEach(function (m) {
      var row = h('div.marker-item', [
        h('span.marker-dot', { style: { background: m.color } }),
        h('span.marker-frame.mono', { text: '#' + m.frame, title: TC.formatTime(app.engine.clock.timeOfFrame(m.frame), 3) }),
        h('input.marker-label.input', {
          value: m.label,
          onchange: function () { m.label = this.value.slice(0, 40); },
          onkeydown: function (ev) { ev.stopPropagation(); }
        }),
        h('button.marker-del.btn.btn-icon', {
          text: '✕', onclick: function (ev) { ev.stopPropagation(); app.markers.remove(m.frame); }
        })
      ]);
      row.addEventListener('click', function (ev) {
        if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'BUTTON') return;
        app.gotoFrame(m.frame);
      });
      el.appendChild(row);
    });
  };

  /* ------------------------------------------------------------------ *
   * 右侧：导出
   * ------------------------------------------------------------------ */
  Panels.prototype._exportTab = function () {
    var app = this.app, eng = app.engine, e = this.els, self = this;

    e['btn-still'].addEventListener('click', function () {
      if (!eng.ready) { app.toast('先加载视频', 'error'); return; }
      D.Stills.exportStill(app, {
        filtered: e['chk-still-filtered'].checked,
        scale: parseFloat(e['still-scale'].value)
      }).then(function (r) {
        app.toast('已导出 ' + r.name + '（' + r.width + '×' + r.height + '）', 'ok');
      }).catch(function (err) { app.toast('导出失败：' + err.message, 'error'); });
    });

    e['btn-seq-loop'].addEventListener('click', function () {
      e['seq-from'].value = eng.loop.inFrame;
      e['seq-to'].value = eng.loop.outFrame;
    });

    e['btn-seq-export'].addEventListener('click', function () {
      if (!eng.ready) { app.toast('先加载视频', 'error'); return; }
      var from = parseInt(e['seq-from'].value, 10) || 0;
      var to = parseInt(e['seq-to'].value, 10) || 0;
      var step = Math.max(1, parseInt(e['seq-step'].value, 10) || 1);
      var count = Math.floor(Math.abs(to - from) / step) + 1;
      if (count > 4000 && !confirm('将导出 ' + count + ' 帧，可能占用大量内存，继续？')) return;
      self.seqToken = { cancelled: false };
      e['btn-seq-cancel'].hidden = false;
      e['btn-seq-export'].disabled = true;
      D.Stills.exportSequence(app, {
        from: from, to: to, step: step,
        filtered: e['chk-seq-filtered'].checked,
        token: self.seqToken,
        onProgress: function (p) {
          e['seq-progress'].style.width = (p.done / p.total * 100).toFixed(1) + '%';
          e['seq-readout'].textContent = p.done + '/' + p.total + ' 帧  ' + U.bytes(p.bytes) +
            '  ' + (p.ms / p.done).toFixed(0) + ' ms/帧';
        }
      }).then(function (r) {
        e['seq-progress'].style.width = '0%';
        e['btn-seq-cancel'].hidden = true;
        e['btn-seq-export'].disabled = false;
        if (r.cancelled) { app.toast('已取消导出'); return; }
        e['seq-readout'].textContent = '完成：' + r.count + ' 帧，' + U.bytes(r.bytes) + '，' + (r.ms / 1000).toFixed(1) + ' 秒';
        app.toast('序列已导出：' + r.name, 'ok');
      }).catch(function (err) {
        e['btn-seq-cancel'].hidden = true;
        e['btn-seq-export'].disabled = false;
        app.toast('导出失败：' + err.message, 'error');
      });
    });

    e['btn-seq-cancel'].addEventListener('click', function () {
      if (self.seqToken) self.seqToken.cancelled = true;
    });

    e['btn-rec'].addEventListener('click', function () {
      if (!app.recorder) { app.toast('当前浏览器不支持录制', 'error'); return; }
      if (app.recorder.active) {
        app.recorder.stop().then(function (r) {
          if (!r) return;
          var ext = r.mime.indexOf('mp4') >= 0 ? '.mp4' : '.webm';
          U.download(r.blob, app.mediaBase() + '.filtered' + ext);
          e['btn-rec'].textContent = '开始录制';
          e['btn-rec'].classList.remove('is-active');
          e['rec-readout'].textContent = '完成：' + U.bytes(r.blob.size) + '，' + (r.ms / 1000).toFixed(1) + ' 秒（' + r.mime + '）';
          app.toast('录制已保存', 'ok');
        });
      } else {
        try {
          app.recorder.start({
            fps: Math.round(eng.clock.fps || 30),
            bitrate: parseInt(e['rec-bitrate'].value, 10),
            audioFrom: e['chk-rec-audio'].checked ? eng.video : null
          });
          e['btn-rec'].textContent = '停止录制';
          e['btn-rec'].classList.add('is-active');
          app.toast('开始录制画布输出', 'ok');
        } catch (err) {
          app.toast(err.message, 'error');
        }
      }
    });

    e['btn-project-save'].addEventListener('click', function () { app.saveProject(); });
    e['btn-project-load'].addEventListener('click', function () { e['project-input'].click(); });
    e['project-input'].addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try { app.loadProject(JSON.parse(fr.result)); }
        catch (err) { app.toast('工程文件解析失败：' + err.message, 'error'); }
      };
      fr.readAsText(f);
    });
  };

  /* ------------------------------------------------------------------ *
   * 右侧：视图 / 检查
   * ------------------------------------------------------------------ */
  Panels.prototype._viewTab = function () {
    var app = this.app, e = this.els, v = app.pipeline.view;

    U.$$('[data-fit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        v.fit = this.getAttribute('data-fit');
        v.zoom = 1;
        v.panX = 0; v.panY = 0;
        e['zoom-range'].value = 1;
        e['zoom-out'].textContent = '100%';
        app.requestRender();
      });
    });
    e['btn-view-reset'].addEventListener('click', function () {
      app.pipeline.fitToWindow();
      e['zoom-range'].value = 1;
      e['zoom-out'].textContent = '100%';
      app.requestRender();
    });
    e['zoom-range'].addEventListener('input', function () {
      v.zoom = parseFloat(this.value);
      e['zoom-out'].textContent = Math.round(v.zoom * 100) + '%';
      app.requestRender();
    });
    e['chk-nearest'].addEventListener('change', function () { v.nearest = this.checked; app.requestRender(); });
    e['chk-checker'].addEventListener('change', function () { v.checker = this.checked; app.requestRender(); });
    W.numberField(e['grid-overlay'], {
      min: 0, max: 128, integer: true,
      onChange: function (n) { v.gridOverlay = n; app.requestRender(); }
    });
    e['chk-magnifier'].addEventListener('change', function () {
      app.magnifierOn = this.checked;
      if (!this.checked) id('magnifier').hidden = true;
    });
  };

  /* ------------------------------------------------------------------ *
   * 事件订阅
   * ------------------------------------------------------------------ */
  Panels.prototype._events = function () {
    var app = this.app, eng = app.engine, self = this;
    eng.on('state', function () { self.update(); });
    eng.on('loopchange', function () { self.update(true); });
    eng.on('loop', function () { self.update(); });
    eng.on('clock', function () { self.update(true); });
    eng.on('load', function () { self.update(true); });
    app.cache.on('progress', function (p) {
      self.els['cache-progress'].style.width = (p.done / p.total * 100).toFixed(1) + '%';
      self.els['cache-readout'].textContent = '构建中 ' + p.done + '/' + p.total + '  ' + U.bytes(p.bytes);
    });
    app.cache.on('built', function () { self.update(true); });
    app.cache.on('cleared', function () { self.update(true); });
  };

  /* ------------------------------------------------------------------ *
   * 读数刷新
   * ------------------------------------------------------------------ */
  Panels.prototype.update = function (full) {
    var app = this.app, eng = app.engine, clock = eng.clock, e = this.els;
    var frame = app.displayFrame();
    var time = app.displayTime();

    // 播放按钮
    var playing = eng.playing || eng.stepped.active || app.cachePlayer.active;
    e['btn-play'].textContent = playing ? '❚❚' : '▶';
    e['btn-play'].classList.toggle('is-active', playing);
    e['btn-reverse'].classList.toggle('is-active', eng.stepped.active && eng.stepped.dir < 0);
    e['btn-stopmotion'].classList.toggle('is-active', eng.stepped.active && eng.stepped.dir > 0);
    e['btn-cache-play'].classList.toggle('is-active', app.cachePlayer.active);

    // 时间码
    if (document.activeElement !== e['tc-input']) {
      e['tc-input'].value = TC.formatTime(time, 3);
    }
    if (document.activeElement !== e['frame-input']) {
      e['frame-input'].value = frame;
    }
    e['tc-sub'].textContent = TC.frameToSmpte(frame, clock.nominalFps) + ' @' + clock.describe().fpsText;
    e['frame-sub'].textContent = '共 ' + clock.frameCount + ' 帧';

    // 当前帧读数
    var kf = clock.isKeyframe(frame);
    W.kv(e['frame-readout'], [
      ['帧号', frame + ' / ' + Math.max(0, clock.frameCount - 1)],
      ['时间', TC.formatTime(time, 3)],
      ['SMPTE', TC.frameToSmpte(frame, clock.nominalFps)],
      ['帧区间', TC.formatTime(clock.timeOfFrame(frame), 3) + ' → ' + TC.formatTime(clock.endOfFrame(frame), 3)],
      ['本帧时长', (clock.frameDuration(frame) * 1000).toFixed(3) + ' ms'],
      ['关键帧', kf == null ? '未知' : (kf ? '是 (I 帧)' : '否')],
      ['时间源', clock.source],
      ['播放状态', app.cachePlayer.active ? '缓存播放' : (eng.stepped.active ? ('逐帧 ' + (eng.stepped.dir > 0 ? '正放' : '倒放') + ' @' + eng.stepped.fps + 'fps') : (eng.playing ? '播放中 ' + eng.rate + '×' : '暂停'))]
    ]);

    // 循环
    var L = eng.loopInfo();
    if (document.activeElement !== e['loop-in']) e['loop-in'].value = L.inFrame;
    if (document.activeElement !== e['loop-out']) e['loop-out'].value = L.outFrame;
    e['chk-loop'].checked = L.enabled;
    e['loop-mode'].value = L.mode;
    e['loop-readout'].textContent = L.frames + ' 帧 / ' + L.seconds.toFixed(3) + ' 秒' +
      (L.wraps ? '  已循环 ' + L.wraps + ' 次' : '');

    // 缓存
    var ci = app.cache.info();
    e['cache-readout'].textContent = ci.count
      ? (ci.count + ' 帧已缓存  ' + ci.inFrame + '→' + ci.outFrame + '  ' + ci.width + '×' + ci.height + '  ' + U.bytes(ci.bytes))
      : '未构建缓存';
    e['btn-cache-play'].disabled = !ci.count;

    // 统计
    if (full || (this._t = (this._t || 0) + 1) % 6 === 0) {
      var st = app.pipeline.stats;
      W.kv(e['stats-readout'], [
        ['渲染帧率', app.renderFps.toFixed(1) + ' fps'],
        ['滤镜耗时', st.ms.toFixed(2) + ' ms'],
        ['pass 数', st.passes + '（' + st.filters + ' 个滤镜）'],
        ['处理分辨率', st.procW + '×' + st.procH],
        ['源分辨率', (eng.media ? eng.media.width + '×' + eng.media.height : '-')],
        ['丢帧', eng.dropped],
        ['解码耗时', eng.decodeMs ? eng.decodeMs.toFixed(2) + ' ms' : '-'],
        ['显存(RT)', U.bytes(app.gl.stats.bytes)],
        ['程序数', app.gl.stats.programs]
      ]);
      var idx = eng.media && eng.media.index;
      W.kv(e['index-readout'], idx ? [
        ['来源', '容器采样表'],
        ['结构', idx.structure === 'fragmented' ? '分片 MP4 (moof/trun)' : '渐进式 MP4 (stbl)'],
        ['编解码', idx.codec],
        ['时间基', idx.timescale],
        ['帧数', idx.frameCount],
        ['帧率', idx.vfr ? (idx.fps.toFixed(4) + ' (VFR 平均)') : idx.fps],
        ['关键帧', idx.keyframes.length],
        ['码率', idx.avgBitrate ? (idx.avgBitrate / 1000).toFixed(0) + ' kbps' : '-'],
        ['编辑偏移', (idx.editOffsetSec * 1000).toFixed(1) + ' ms']
      ] : [
        ['来源', clock.mode === 'index' ? '容器采样表' : '帧率推断'],
        ['说明', 'WebM/MKV 等容器不做采样表解析，使用 rVFC 观测帧率'],
        ['当前帧率', clock.describe().fpsText],
        ['置信度', (clock.confidence * 100).toFixed(0) + '%']
      ]);
      e['status-perf'].textContent = app.renderFps.toFixed(0) + ' fps · ' + st.ms.toFixed(1) + ' ms · ' + st.passes + ' pass';
      var tlSpan = app.timeline.viewB - app.timeline.viewA;
      e['tl-scale-label'].textContent = '视图 ' + Math.round(app.timeline.viewA) + '–' + Math.round(app.timeline.viewB) +
        '（' + Math.round(tlSpan + 1) + ' 帧）';
    }

    if (full) {
      e['rate-select'].value = String(eng.rate);
      e['chk-mute'].checked = eng.video.muted;
      e['volume'].value = eng.video.volume;
      e['seq-from'].value = e['seq-from'].value || 0;
      e['seq-to'].value = e['seq-to'].value || Math.max(0, Math.min(clock.frameCount - 1, 47));
      e['split-mode'].value = String(app.pipeline.view.splitMode);
      e['loop-count'].value = L.count;
    }
  };

  /** 像素检查器读数 */
  Panels.prototype.setPixelReadout = function (info) {
    if (!info) {
      W.kv(this.els['pixel-readout'], [['提示', '把鼠标移到画面上']]);
      return;
    }
    W.kv(this.els['pixel-readout'], [
      ['视频坐标', info.x + ', ' + info.y],
      ['RGB', info.r + ', ' + info.g + ', ' + info.b],
      ['HEX', info.hex],
      ['亮度', info.luma.toFixed(3)]
    ]);
  };

  D.Panels = Panels;
})(typeof window !== 'undefined' ? window : globalThis);
