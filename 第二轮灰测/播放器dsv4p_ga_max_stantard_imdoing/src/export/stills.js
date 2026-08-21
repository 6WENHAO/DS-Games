/*!
 * src/export/stills.js — 静帧 / 帧序列导出
 *  · 当前帧 PNG（可带滤镜、可整数倍最近邻放大）
 *  · 帧区间 PNG 序列打包成 ZIP（逐帧精确定位，命名含帧号与时间码）
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util;

  var S = {};

  function pad6(n) {
    var s = String(Math.max(0, Math.round(n)));
    while (s.length < 6) s = '0' + s;
    return s;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (b) {
          if (b) resolve(b); else reject(new Error('canvas.toBlob 返回空'));
        }, 'image/png');
      } else {
        try {
          var url = canvas.toDataURL('image/png');
          var bin = atob(url.split(',')[1]);
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: 'image/png' }));
        } catch (e) { reject(e); }
      }
    });
  }

  /** 整数倍最近邻放大（像素风截图专用） */
  function upscale(src, factor) {
    if (factor <= 1) return src;
    var cv = document.createElement('canvas');
    cv.width = src.width * factor;
    cv.height = src.height * factor;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, cv.width, cv.height);
    return cv;
  }

  /** 文件名：<片名>.f000123.00-00-04-100.png */
  S.frameFileName = function (base, frame, timeSec, fps) {
    var tc = D.TC.frameToSmpte(frame, fps || 25).replace(/[:;]/g, '-');
    return base + '.f' + pad6(frame) + '.' + tc + '.png';
  };

  /**
   * 导出当前帧
   * @param {object} app  见 src/main.js（需要 gl / pipeline / engine / renderToTarget / mediaBase）
   * @param {{filtered?:boolean, scale?:number}} opts
   */
  S.exportStill = function (app, opts) {
    opts = opts || {};
    var rt = app.renderToTarget({ bypass: opts.filtered === false });
    if (!rt) return Promise.reject(new Error('渲染失败，无法导出'));
    var canvas;
    try {
      canvas = app.gl.toCanvas(rt);
    } finally {
      app.gl.release(rt);
    }
    canvas = upscale(canvas, Math.max(1, Math.round(opts.scale || 1)));
    var frame = app.displayFrame();
    var name = S.frameFileName(app.mediaBase() + (opts.filtered === false ? '.orig' : ''), frame, app.engine.time, app.engine.clock.nominalFps);
    return canvasToBlob(canvas).then(function (blob) {
      U.download(blob, name);
      return { blob: blob, name: name, width: canvas.width, height: canvas.height };
    });
  };

  /**
   * 导出帧序列为 ZIP
   * @param {object} app
   * @param {{from:number,to:number,step?:number,filtered?:boolean,onProgress?:function,token?:object}} opts
   *        token.cancelled = true 可中断
   */
  S.exportSequence = function (app, opts) {
    opts = opts || {};
    var eng = app.engine;
    var clock = eng.clock;
    var step = Math.max(1, Math.round(opts.step || 1));
    var from = clock.clampFrame(Math.min(opts.from, opts.to));
    var to = clock.clampFrame(Math.max(opts.from, opts.to));
    var filtered = opts.filtered !== false;
    var token = opts.token || {};
    var zip = new D.ZipWriter();
    var base = app.mediaBase();
    var dir = base + '_frames/';
    var total = Math.floor((to - from) / step) + 1;
    var reuse = document.createElement('canvas');
    var wasPlaying = eng.playing || eng.stepped.active;
    var count = 0;
    var t0 = global.performance ? performance.now() : Date.now();

    eng.pause();

    function one(i) {
      if (token.cancelled) return Promise.resolve();
      if (i > to) return Promise.resolve();
      return app.gotoFrameForExport(i).then(function () {
        var rt = app.renderToTarget({ bypass: !filtered });
        if (!rt) throw new Error('渲染失败（第 ' + i + " 帧）");
        var cv;
        try { cv = app.gl.toCanvas(rt, reuse); }
        finally { app.gl.release(rt); }
        return canvasToBlob(cv);
      }).then(function (blob) {
        return blob.arrayBuffer();
      }).then(function (buf) {
        zip.add(dir + S.frameFileName(base, i, clock.timeOfFrame(i), clock.nominalFps), new Uint8Array(buf));
        count++;
        if (opts.onProgress) {
          opts.onProgress({
            done: count, total: total, frame: i,
            bytes: zip.bytes(),
            ms: (global.performance ? performance.now() : Date.now()) - t0
          });
        }
        return one(i + step);
      });
    }

    return one(from).then(function () {
      app.clearExportSource();
      if (!count) return { cancelled: true, count: 0 };
      // 附一份说明清单，方便别人拿到序列后知道来源
      var meta = [
        'dsv4p max stantard imdoing — 帧序列导出',
        '源文件: ' + (eng.media ? eng.media.name : '-'),
        '分辨率: ' + (eng.media ? eng.media.width + 'x' + eng.media.height : '-'),
        '帧率: ' + clock.fps + (clock.vfr ? ' (VFR 平均)' : '') + '  帧率来源: ' + clock.source,
        '帧区间: ' + from + ' .. ' + to + '  步长: ' + step,
        '带滤镜: ' + (filtered ? '是' : '否'),
        '滤镜链: ' + JSON.stringify(app.pipeline.serializeChain(), null, 2),
        '导出时间: ' + new Date().toISOString()
      ].join('\n');
      zip.add(dir + 'README.txt', new TextEncoder().encode(meta));
      var blob = zip.blob();
      var name = base + '.frames.' + from + '-' + to + (step > 1 ? '.step' + step : '') + '.zip';
      U.download(blob, name);
      if (wasPlaying) { /* 不自动恢复播放，避免导出后画面乱跑 */ }
      return {
        cancelled: !!token.cancelled, count: count, name: name,
        bytes: blob.size, ms: (global.performance ? performance.now() : Date.now()) - t0
      };
    }).catch(function (err) {
      app.clearExportSource();
      throw err;
    });
  };

  S.canvasToBlob = canvasToBlob;
  S.upscale = upscale;
  D.Stills = S;
})(typeof window !== 'undefined' ? window : globalThis);
