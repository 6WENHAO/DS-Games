/*!
 * src/export/recorder.js — 用 MediaRecorder 录制画布输出为 WebM
 * 录的是「最终渲染结果」，所以滤镜、循环、倒放、变速都会被原样录进去。
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});

  var CANDIDATES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=h264',
    'video/mp4'
  ];

  function pickMime() {
    if (!global.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    for (var i = 0; i < CANDIDATES.length; i++) {
      if (MediaRecorder.isTypeSupported(CANDIDATES[i])) return CANDIDATES[i];
    }
    return '';
  }

  function Recorder(canvas) {
    D.Emitter.call(this);
    this.canvas = canvas;
    this.rec = null;
    this.chunks = [];
    this.stream = null;
    this.mime = '';
    this.startedAt = 0;
    this.active = false;
  }
  Recorder.prototype = Object.create(D.Emitter.prototype);
  Recorder.prototype.constructor = Recorder;

  Recorder.supported = function () {
    return !!(global.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
  };

  /**
   * @param {{fps?:number, bitrate?:number, audioFrom?:HTMLVideoElement}} opts
   */
  Recorder.prototype.start = function (opts) {
    opts = opts || {};
    if (this.active) return false;
    if (!Recorder.supported()) throw new Error('当前浏览器不支持 MediaRecorder / captureStream');

    var fps = Math.max(1, Math.min(120, opts.fps || 30));
    this.stream = this.canvas.captureStream(fps);
    this.audioAdded = false;

    if (opts.audioFrom) {
      try {
        var v = opts.audioFrom;
        var vs = v.captureStream ? v.captureStream() : (v.mozCaptureStream ? v.mozCaptureStream() : null);
        if (vs) {
          var tracks = vs.getAudioTracks();
          for (var i = 0; i < tracks.length; i++) {
            this.stream.addTrack(tracks[i]);
            this.audioAdded = true;
          }
        }
      } catch (e) {
        this.emit('warn', { message: '音轨捕获失败（将只录画面）：' + (e && e.message) });
      }
    }

    this.mime = pickMime();
    var cfg = { videoBitsPerSecond: opts.bitrate || 8000000 };
    if (this.mime) cfg.mimeType = this.mime;

    this.chunks = [];
    this.rec = new MediaRecorder(this.stream, cfg);
    var self = this;
    this.rec.ondataavailable = function (ev) {
      if (ev.data && ev.data.size) self.chunks.push(ev.data);
    };
    this.rec.onerror = function (ev) {
      self.emit('error', { message: '录制出错：' + (ev.error && ev.error.name) });
    };
    this.rec.start(250);
    this.active = true;
    this.startedAt = global.performance ? performance.now() : Date.now();
    this.emit('start', { mime: this.mime, fps: fps, audio: this.audioAdded });
    return true;
  };

  /** @returns {Promise<{blob:Blob, mime:string, ms:number}>} */
  Recorder.prototype.stop = function () {
    var self = this;
    if (!this.active || !this.rec) return Promise.resolve(null);
    return new Promise(function (resolve) {
      self.rec.onstop = function () {
        var ms = (global.performance ? performance.now() : Date.now()) - self.startedAt;
        var type = self.mime ? self.mime.split(';')[0] : 'video/webm';
        var blob = new Blob(self.chunks, { type: type });
        self.chunks = [];
        self.active = false;
        try {
          var tracks = self.stream.getTracks();
          for (var i = 0; i < tracks.length; i++) tracks[i].stop();
        } catch (e) {}
        self.stream = null;
        self.rec = null;
        self.emit('stop', { bytes: blob.size, ms: ms });
        resolve({ blob: blob, mime: type, ms: ms });
      };
      try { self.rec.stop(); } catch (e) { resolve(null); }
    });
  };

  Recorder.prototype.elapsed = function () {
    if (!this.active) return 0;
    return (global.performance ? performance.now() : Date.now()) - this.startedAt;
  };

  Recorder.prototype.bytes = function () {
    var n = 0;
    for (var i = 0; i < this.chunks.length; i++) n += this.chunks[i].size;
    return n;
  };

  Recorder.pickMime = pickMime;
  D.Recorder = Recorder;
})(typeof window !== 'undefined' ? window : globalThis);
