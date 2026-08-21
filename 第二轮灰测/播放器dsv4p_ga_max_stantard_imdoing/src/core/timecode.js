/*!
 * src/core/timecode.js — 时间码解析与格式化（秒 / HH:MM:SS.mmm / SMPTE / 帧号）
 *
 * 支持的输入写法（parse）：
 *   12            -> 12 秒
 *   12.345        -> 12.345 秒
 *   1:23          -> 1 分 23 秒
 *   1:02:03       -> 1 时 2 分 3 秒
 *   1:02:03.456   -> 带毫秒
 *   01:02:03:12   -> SMPTE 非丢帧（末段是帧号，需要 fps）
 *   01:02:03;12   -> SMPTE 丢帧（29.97 / 59.94）
 *   #1234 / 1234f -> 帧号
 *   1500ms        -> 毫秒
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var TC = {};

  /** 工业界常见帧率，用于「吸附」自动探测结果 */
  TC.commonFps = [8, 10, 12, 12.5, 15, 16, 18, 20, 23.976, 24, 25, 29.97, 30, 47.952, 48, 50, 59.94, 60, 72, 90, 100, 119.88, 120, 144, 240];

  /** 把探测到的帧率吸附到常见帧率（相对误差 < tol 时吸附） */
  TC.snapFps = function (fps, tol) {
    if (!isFinite(fps) || fps <= 0) return fps;
    tol = tol == null ? 0.005 : tol;
    var best = fps, bestErr = Infinity;
    for (var i = 0; i < TC.commonFps.length; i++) {
      var c = TC.commonFps[i];
      var err = Math.abs(c - fps) / c;
      if (err < bestErr) { bestErr = err; best = c; }
    }
    return bestErr <= tol ? best : Math.round(fps * 1000) / 1000;
  };

  /** 该帧率是否使用丢帧时间码（29.97 / 59.94 / 119.88 系） */
  TC.isDropFrameRate = function (fps) {
    return Math.abs(fps - 29.97) < 0.02 || Math.abs(fps - 59.94) < 0.03 || Math.abs(fps - 119.88) < 0.06;
  };

  function pad(v, n) {
    var s = String(Math.floor(Math.abs(v)));
    while (s.length < n) s = '0' + s;
    return s;
  }

  /** 秒 -> HH:MM:SS.mmm（digits 可为 0/1/2/3，默认 3） */
  TC.formatTime = function (sec, digits) {
    if (sec == null || !isFinite(sec)) return '--:--:--.---';
    digits = digits == null ? 3 : digits;
    var sign = sec < 0 ? '-' : '';
    sec = Math.abs(sec);
    // 先按位数四舍五入，避免 59.9996 显示成 60.000
    var f = Math.pow(10, digits);
    var total = Math.round(sec * f) / f;
    var h = Math.floor(total / 3600);
    var m = Math.floor((total - h * 3600) / 60);
    var s = total - h * 3600 - m * 60;
    var si = Math.floor(s);
    var frac = digits > 0 ? '.' + pad(Math.round((s - si) * f), digits) : '';
    return sign + pad(h, 2) + ':' + pad(m, 2) + ':' + pad(si, 2) + frac;
  };

  /** 秒 -> 紧凑显示 M:SS.mm（时间轴刻度用） */
  TC.formatShort = function (sec, digits) {
    if (sec == null || !isFinite(sec)) return '--:--';
    digits = digits == null ? 2 : digits;
    var sign = sec < 0 ? '-' : '';
    sec = Math.abs(sec);
    var f = Math.pow(10, digits);
    var total = Math.round(sec * f) / f;
    var h = Math.floor(total / 3600);
    var m = Math.floor((total - h * 3600) / 60);
    var s = total - h * 3600 - m * 60;
    var si = Math.floor(s);
    var frac = digits > 0 ? '.' + pad(Math.round((s - si) * f), digits) : '';
    return sign + (h > 0 ? h + ':' + pad(m, 2) : String(m)) + ':' + pad(si, 2) + frac;
  };

  /**
   * 帧号 -> SMPTE 时间码
   * @param {number} frame 帧号（0 起）
   * @param {number} fps
   * @param {boolean} [drop] 是否丢帧时间码（默认按 fps 自动判断）
   */
  TC.frameToSmpte = function (frame, fps, drop) {
    if (!isFinite(frame) || !isFinite(fps) || fps <= 0) return '--:--:--:--';
    var nominal = Math.max(1, Math.round(fps));
    var useDrop = (drop == null) ? TC.isDropFrameRate(fps) : !!drop;
    var f = Math.max(0, Math.round(frame));
    if (useDrop) {
      var dropFrames = Math.round(fps * 0.0666666);           // 29.97 -> 2, 59.94 -> 4
      var framesPerMin = nominal * 60 - dropFrames;
      var framesPer10Min = nominal * 600 - dropFrames * 9;
      var d = Math.floor(f / framesPer10Min);
      var m = f % framesPer10Min;
      if (m > dropFrames) {
        f += dropFrames * 9 * d + dropFrames * Math.floor((m - dropFrames) / framesPerMin);
      } else {
        f += dropFrames * 9 * d;
      }
    }
    var ff = f % nominal;
    var totalSec = Math.floor(f / nominal);
    var ss = totalSec % 60;
    var mm = Math.floor(totalSec / 60) % 60;
    var hh = Math.floor(totalSec / 3600);
    return pad(hh, 2) + ':' + pad(mm, 2) + ':' + pad(ss, 2) + (useDrop ? ';' : ':') + pad(ff, 2);
  };

  /** SMPTE 时间码 -> 帧号（0 起）；解析失败返回 NaN */
  TC.smpteToFrame = function (str, fps) {
    var m = /^\s*(\d{1,3}):([0-5]?\d):([0-5]?\d)([;:])(\d{1,3})\s*$/.exec(String(str || ''));
    if (!m || !isFinite(fps) || fps <= 0) return NaN;
    var nominal = Math.max(1, Math.round(fps));
    var hh = +m[1], mm = +m[2], ss = +m[3], ff = +m[5];
    var useDrop = m[4] === ';';
    var frame = ((hh * 60 + mm) * 60 + ss) * nominal + ff;
    if (useDrop) {
      var dropFrames = Math.round(fps * 0.0666666);
      var totalMinutes = hh * 60 + mm;
      frame -= dropFrames * (totalMinutes - Math.floor(totalMinutes / 10));
    }
    return frame;
  };

  /**
   * 解析任意时间输入
   * @returns {{seconds:number, frame:number|null, kind:string}} kind: seconds|clock|smpte|frame|ms
   *          失败时 seconds 为 NaN
   */
  TC.parseDetailed = function (str, fps) {
    var s = String(str == null ? '' : str).trim();
    if (!s) return { seconds: NaN, frame: null, kind: 'empty' };
    var neg = false;
    if (s[0] === '+' ) s = s.slice(1);
    if (s[0] === '-') { neg = true; s = s.slice(1); }
    var out = null;

    // 帧号：#123 / 123f / f123 / 123帧
    var mf = /^(?:#|f)?(\d+(?:\.\d+)?)(?:f|帧)?$/i.exec(s);
    if (mf && (/^[#f]/i.test(s) || /(?:f|帧)$/i.test(s))) {
      var fr = parseFloat(mf[1]);
      var secF = (isFinite(fps) && fps > 0) ? fr / fps : NaN;
      out = { seconds: secF, frame: fr, kind: 'frame' };
    }
    // 毫秒：1500ms
    if (!out) {
      var mms = /^(\d+(?:\.\d+)?)\s*ms$/i.exec(s);
      if (mms) out = { seconds: parseFloat(mms[1]) / 1000, frame: null, kind: 'ms' };
    }
    // SMPTE：HH:MM:SS:FF 或 HH:MM:SS;FF
    if (!out) {
      var msm = /^(\d{1,3}):([0-5]?\d):([0-5]?\d)([;:])(\d{1,3})$/.exec(s);
      if (msm) {
        var frame = TC.smpteToFrame(s, fps);
        out = { seconds: (isFinite(fps) && fps > 0) ? frame / fps : NaN, frame: frame, kind: 'smpte' };
      }
    }
    // 时钟：[HH:]MM:SS[.mmm]
    if (!out) {
      var mc = /^(?:(\d{1,3}):)?(\d{1,3}):(\d{1,2}(?:\.\d+)?)$/.exec(s);
      if (mc) {
        var hh = mc[1] ? +mc[1] : 0;
        var mm = +mc[2];
        var ss = parseFloat(mc[3]);
        out = { seconds: hh * 3600 + mm * 60 + ss, frame: null, kind: 'clock' };
      }
    }
    // 纯秒数：12 / 12.345 / 12s
    if (!out) {
      var msec = /^(\d+(?:\.\d+)?)\s*s?$/i.exec(s);
      if (msec) out = { seconds: parseFloat(msec[1]), frame: null, kind: 'seconds' };
    }
    if (!out) return { seconds: NaN, frame: null, kind: 'invalid' };
    if (neg) {
      out.seconds = -out.seconds;
      if (out.frame != null) out.frame = -out.frame;
    }
    return out;
  };

  /** 解析为秒（失败 NaN） */
  TC.parse = function (str, fps) { return TC.parseDetailed(str, fps).seconds; };

  /** 人类可读的时长（用于 UI 副标题） */
  TC.formatDuration = function (sec) {
    if (!isFinite(sec)) return '—';
    if (sec < 60) return sec.toFixed(2) + 's';
    return TC.formatShort(sec, 1);
  };

  D.TC = TC;
  if (typeof module !== 'undefined' && module.exports) module.exports = TC;
})(typeof window !== 'undefined' ? window : globalThis);
