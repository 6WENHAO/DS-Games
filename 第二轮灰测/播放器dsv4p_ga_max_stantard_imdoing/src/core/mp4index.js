/*!
 * src/core/mp4index.js — 纯 JS 的 MP4 / MOV 采样表解析器（零依赖，自研）
 *
 * 目的：从容器里直接读出「每一帧的精确显示时间戳」，因此可以做到
 *   · 精确帧数（不靠猜）
 *   · 精确帧率（30000/1001 这种有理数帧率会被算成精确值）
 *   · 支持 VFR（可变帧率）视频：逐帧时间戳一一列出
 *   · 关键帧列表（时间轴上标出 I 帧，方便跳转/裁剪）
 *
 * 覆盖两种常见结构：
 *   1. 渐进式 MP4：moov -> trak -> mdia -> minf -> stbl -> stts/ctts/stss/stsz
 *   2. 分片 MP4 (fMP4)：moov(mvex) + 若干 moof -> traf -> tfhd/trun
 * 解析不了（例如 WebM/MKV）时返回 null，上层会自动退回「rVFC 帧率探测 + 恒定帧率」模型。
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});

  var MAX_MOOV_BYTES = 192 * 1024 * 1024; // 极端长片的 moov 也够用
  var MAX_TOPLEVEL_BOXES = 200000;        // fMP4 扫描上限，防止病态文件卡死

  /* ---------------- 读取抽象：Blob / ArrayBuffer 都能用 ---------------- */

  function BlobReader(blob) { this.size = blob.size; this._b = blob; }
  BlobReader.prototype.read = function (offset, length) {
    var end = Math.min(this.size, offset + length);
    if (offset >= this.size || length <= 0) return Promise.resolve(new ArrayBuffer(0));
    var slice = this._b.slice(offset, end);
    if (slice.arrayBuffer) return slice.arrayBuffer();
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(fr.error || new Error('read error')); };
      fr.readAsArrayBuffer(slice);
    });
  };

  function BufferReader(ab) {
    this._ab = ab.buffer instanceof ArrayBuffer && ab.byteLength !== undefined && !(ab instanceof ArrayBuffer)
      ? ab.buffer.slice(ab.byteOffset, ab.byteOffset + ab.byteLength)
      : ab;
    this.size = this._ab.byteLength;
  }
  BufferReader.prototype.read = function (offset, length) {
    var end = Math.min(this.size, offset + length);
    if (offset >= this.size || length <= 0) return Promise.resolve(new ArrayBuffer(0));
    return Promise.resolve(this._ab.slice(offset, end));
  };

  /* ---------------- 小工具 ---------------- */

  function typeOf(dv, pos) {
    return String.fromCharCode(dv.getUint8(pos), dv.getUint8(pos + 1), dv.getUint8(pos + 2), dv.getUint8(pos + 3));
  }
  function u64(dv, pos) {
    var hi = dv.getUint32(pos), lo = dv.getUint32(pos + 4);
    return hi * 4294967296 + lo;
  }

  /** 遍历 buffer 内 [start,end) 区间的 box，回调 (type, contentStart, contentEnd, headerSize) */
  function eachBox(dv, start, end, cb) {
    var p = start;
    while (p + 8 <= end) {
      var size = dv.getUint32(p);
      var type = typeOf(dv, p + 4);
      var header = 8;
      if (size === 1) {
        if (p + 16 > end) break;
        size = u64(dv, p + 8);
        header = 16;
      } else if (size === 0) {
        size = end - p;
      }
      if (size < header || p + size > end) {
        // 容忍轻微越界：截断到区间末尾
        size = end - p;
        if (size < header) break;
      }
      if (cb(type, p + header, p + size) === false) return;
      p += size;
    }
  }

  /** 在 buffer 内按路径查找第一个 box，path 形如 ['moov','mvhd'] */
  function findBox(dv, start, end, path, idx) {
    idx = idx || 0;
    var found = null;
    eachBox(dv, start, end, function (type, cs, ce) {
      if (found) return false;
      if (type === path[idx]) {
        if (idx === path.length - 1) { found = { start: cs, end: ce }; return false; }
        var deeper = findBox(dv, cs, ce, path, idx + 1);
        if (deeper) { found = deeper; return false; }
      }
    });
    return found;
  }

  /* ---------------- stbl 各表解析 ---------------- */

  function parseStts(dv, s, e) {
    var n = dv.getUint32(s + 4), out = [], p = s + 8;
    for (var i = 0; i < n && p + 8 <= e; i++, p += 8) {
      out.push([dv.getUint32(p), dv.getUint32(p + 4)]); // [count, delta]
    }
    return out;
  }

  function parseCtts(dv, s, e) {
    var version = dv.getUint8(s);
    var n = dv.getUint32(s + 4), out = [], p = s + 8;
    for (var i = 0; i < n && p + 8 <= e; i++, p += 8) {
      var cnt = dv.getUint32(p);
      var off = version === 1 ? dv.getInt32(p + 4) : dv.getUint32(p + 4);
      // version 0 理论上无符号，但实践中存在写成负数的文件，做一次修正
      if (version === 0 && off > 2147483647) off = off - 4294967296;
      out.push([cnt, off]);
    }
    return out;
  }

  function parseStss(dv, s, e) {
    var n = dv.getUint32(s + 4), out = new Int32Array(n), p = s + 8, k = 0;
    for (var i = 0; i < n && p + 4 <= e; i++, p += 4) out[k++] = dv.getUint32(p) - 1; // 转 0 起
    return k === n ? out : out.subarray(0, k);
  }

  function parseStsz(dv, s, e) {
    var uniform = dv.getUint32(s + 4);
    var count = dv.getUint32(s + 8);
    if (uniform !== 0) return { count: count, uniform: uniform, sizes: null };
    var sizes = new Uint32Array(count), p = s + 12, k = 0;
    for (var i = 0; i < count && p + 4 <= e; i++, p += 4) sizes[k++] = dv.getUint32(p);
    return { count: count, uniform: 0, sizes: sizes };
  }

  function parseElst(dv, s, e) {
    var version = dv.getUint8(s);
    var n = dv.getUint32(s + 4), p = s + 8, out = [];
    for (var i = 0; i < n; i++) {
      var dur, mt, rate;
      if (version === 1) {
        if (p + 20 > e) break;
        dur = u64(dv, p); mt = dv.getInt32(p + 8) * 4294967296 + dv.getUint32(p + 12);
        // media_time 为 int64：高 32 位为负时按补码处理
        if (dv.getInt32(p + 8) < 0) mt = -(4294967296 * (-dv.getInt32(p + 8)) - dv.getUint32(p + 12));
        rate = dv.getInt32(p + 16) / 65536;
        p += 20;
      } else {
        if (p + 12 > e) break;
        dur = dv.getUint32(p); mt = dv.getInt32(p + 4); rate = dv.getInt32(p + 8) / 65536;
        p += 12;
      }
      out.push({ duration: dur, mediaTime: mt, rate: rate });
    }
    return out;
  }

  function parseMdhd(dv, s) {
    var version = dv.getUint8(s);
    if (version === 1) return { timescale: dv.getUint32(s + 20), duration: u64(dv, s + 24) };
    return { timescale: dv.getUint32(s + 12), duration: dv.getUint32(s + 16) };
  }

  function parseMvhd(dv, s) {
    var version = dv.getUint8(s);
    if (version === 1) return { timescale: dv.getUint32(s + 20), duration: u64(dv, s + 24) };
    return { timescale: dv.getUint32(s + 12), duration: dv.getUint32(s + 16) };
  }

  /**
   * tkhd 字段偏移（相对 box 内容起点 s）：
   *   version/flags 4
   *   v0: creation 4, modification 4, track_ID 4, reserved 4, duration 4      -> track_ID @ s+12
   *   v1: creation 8, modification 8, track_ID 4, reserved 4, duration 8      -> track_ID @ s+20
   *   之后: reserved[2] 8, layer 2, alternate_group 2, volume 2, reserved 2,
   *         matrix[9] 36, width 4(16.16), height 4(16.16)
   *   => width @ s+76 (v0) / s+88 (v1)
   */
  function parseTkhd(dv, s, e) {
    var version = dv.getUint8(s);
    var trackIdOff = version === 1 ? s + 20 : s + 12;
    var wOff = version === 1 ? s + 88 : s + 76;
    var trackId = (trackIdOff + 4 <= e) ? dv.getUint32(trackIdOff) : 0;
    var width = 0, height = 0;
    if (wOff + 8 <= e) {
      width = dv.getUint32(wOff) / 65536;
      height = dv.getUint32(wOff + 4) / 65536;
    }
    return { trackId: trackId, width: width, height: height };
  }

  function parseHdlr(dv, s) { return typeOf(dv, s + 8); }

  function parseStsd(dv, s, e) {
    var out = { codec: '', width: 0, height: 0 };
    var p = s + 8; // version/flags + entry_count
    if (p + 8 <= e) {
      var size = dv.getUint32(p);
      out.codec = typeOf(dv, p + 4);
      if (p + 36 <= e) {
        out.width = dv.getUint16(p + 32);
        out.height = dv.getUint16(p + 34);
      }
      if (size <= 0) out.codec = out.codec || '';
    }
    return out;
  }

  /* ---------------- fMP4：moof/traf/trun ---------------- */

  function parseTfhd(dv, s) {
    var flags = dv.getUint32(s) & 0xffffff;
    var p = s + 4;
    var trackId = dv.getUint32(p); p += 4;
    var o = { trackId: trackId, defaultSampleDuration: 0, defaultSampleFlags: null };
    if (flags & 0x000001) p += 8;                 // base-data-offset
    if (flags & 0x000002) p += 4;                 // sample-description-index
    if (flags & 0x000008) { o.defaultSampleDuration = dv.getUint32(p); p += 4; }
    if (flags & 0x000010) p += 4;                 // default sample size
    if (flags & 0x000020) { o.defaultSampleFlags = dv.getUint32(p); p += 4; }
    return o;
  }

  function parseTrun(dv, s, e, tfhd) {
    var version = dv.getUint8(s);
    var flags = dv.getUint32(s) & 0xffffff;
    var count = dv.getUint32(s + 4);
    var p = s + 8;
    if (flags & 0x000001) p += 4;                 // data-offset
    var firstFlags = null;
    if (flags & 0x000004) { firstFlags = dv.getUint32(p); p += 4; }
    var hasDur = !!(flags & 0x000100), hasSize = !!(flags & 0x000200),
      hasFlags = !!(flags & 0x000400), hasCto = !!(flags & 0x000800);
    var samples = [];
    for (var i = 0; i < count && p <= e; i++) {
      var dur = tfhd.defaultSampleDuration, size = 0, sflags = (i === 0 && firstFlags != null) ? firstFlags : tfhd.defaultSampleFlags, cto = 0;
      if (hasDur) { dur = dv.getUint32(p); p += 4; }
      if (hasSize) { size = dv.getUint32(p); p += 4; }
      if (hasFlags) { sflags = dv.getUint32(p); p += 4; }
      if (hasCto) { cto = version === 0 ? dv.getUint32(p) : dv.getInt32(p); if (version === 0 && cto > 2147483647) cto -= 4294967296; p += 4; }
      var isSync = sflags == null ? true : ((sflags & 0x00010000) === 0); // sample_is_non_sync_sample
      samples.push({ dur: dur, size: size, cto: cto, key: isSync });
    }
    return samples;
  }

  /* ---------------- 主流程 ---------------- */

  /**
   * 解析结果对象
   * @typedef {Object} Mp4IndexResult
   * @property {Float64Array} times      每帧显示时间（秒，升序）
   * @property {Int32Array}   keyframes  关键帧在 times 中的下标（升序）
   * @property {number} frameCount
   * @property {number} fps              精确帧率（CFR 时为有理数精确值）
   * @property {boolean} vfr             是否可变帧率
   * @property {number} duration         视频轨时长（秒）
   * @property {number} timescale
   * @property {string} codec
   * @property {number} width
   * @property {number} height
   * @property {string} structure        'progressive' | 'fragmented'
   * @property {number} avgBitrate       估算码率（bit/s，未知为 0）
   */

  function buildFromSampleList(list, timescale, editOffset, emptyOffsetSec, meta) {
    // list: [{dts, cto, key, size}]（dts 为媒体时间基）
    var n = list.length;
    if (!n) return null;
    var recs = new Array(n);
    var totalBytes = 0;
    for (var i = 0; i < n; i++) {
      var it = list[i];
      totalBytes += it.size || 0;
      recs[i] = { t: (it.dts + it.cto - editOffset) / timescale + emptyOffsetSec, key: !!it.key, dur: it.dur };
    }
    recs.sort(function (a, b) { return a.t - b.t; });

    // 丢掉编辑列表裁掉的负时间帧（保留至少一帧）
    var startIdx = 0;
    while (startIdx < recs.length - 1 && recs[startIdx + 1].t <= 1e-9) startIdx++;
    if (recs[startIdx].t < 0) recs[startIdx].t = 0;
    recs = recs.slice(startIdx);

    var times = new Float64Array(recs.length);
    var keys = [];
    for (var j = 0; j < recs.length; j++) {
      times[j] = Math.max(0, recs[j].t);
      if (recs[j].key) keys.push(j);
    }

    // 帧率：优先用「原始时间基下的间隔集合」判断 CFR，可得到精确有理数帧率
    var rawDeltas = Object.create(null), rawCount = 0, uniqueRaw = 0;
    for (var k = 0; k + 1 < recs.length; k++) {
      var d = Math.round((recs[k + 1].t - recs[k].t) * timescale);
      if (d <= 0) continue;
      if (rawDeltas[d] === undefined) { rawDeltas[d] = 0; uniqueRaw++; }
      rawDeltas[d]++; rawCount++;
    }
    var fps = 0, vfr = false;
    if (rawCount === 0) {
      fps = meta && meta.fpsHint ? meta.fpsHint : 25;
      vfr = false;
    } else {
      // 众数间隔
      var bestD = 0, bestN = -1, keysD = Object.keys(rawDeltas);
      for (var q = 0; q < keysD.length; q++) {
        var dv2 = +keysD[q];
        if (rawDeltas[dv2] > bestN) { bestN = rawDeltas[dv2]; bestD = dv2; }
      }
      fps = timescale / bestD;
      // 众数占比不足 98% 视为 VFR
      vfr = (bestN / rawCount) < 0.98;
      if (vfr) {
        // VFR 下用平均帧率作为「名义帧率」
        var span = times[times.length - 1] - times[0];
        if (span > 0) fps = (times.length - 1) / span;
      }
    }

    var lastDur = recs[recs.length - 1].dur ? recs[recs.length - 1].dur / timescale : (1 / (fps || 25));
    var duration = times[times.length - 1] + lastDur;
    if (meta && meta.trackDuration > 0) duration = Math.max(duration, meta.trackDuration);

    return {
      times: times,
      keyframes: new Int32Array(keys),
      frameCount: times.length,
      fps: fps,
      vfr: vfr,
      duration: duration,
      timescale: timescale,
      codec: (meta && meta.codec) || '',
      width: (meta && meta.width) || 0,
      height: (meta && meta.height) || 0,
      codedWidth: (meta && meta.codedWidth) || (meta && meta.width) || 0,
      codedHeight: (meta && meta.codedHeight) || (meta && meta.height) || 0,
      structure: (meta && meta.structure) || 'progressive',
      avgBitrate: duration > 0 && totalBytes > 0 ? (totalBytes * 8) / duration : 0,
      editOffsetSec: editOffset / timescale
    };
  }

  function parseProgressiveTrack(dv, trakStart, trakEnd, mvhdTimescale) {
    var hdlr = findBox(dv, trakStart, trakEnd, ['mdia', 'hdlr']);
    if (!hdlr || parseHdlr(dv, hdlr.start) !== 'vide') return null;

    var mdhdBox = findBox(dv, trakStart, trakEnd, ['mdia', 'mdhd']);
    if (!mdhdBox) return null;
    var mdhd = parseMdhd(dv, mdhdBox.start);
    var timescale = mdhd.timescale || 1000;

    var tkhdBox = findBox(dv, trakStart, trakEnd, ['tkhd']);
    var tkhd = tkhdBox ? parseTkhd(dv, tkhdBox.start, tkhdBox.end) : { trackId: 1, width: 0, height: 0 };

    var stblPath = ['mdia', 'minf', 'stbl'];
    var sttsBox = findBox(dv, trakStart, trakEnd, stblPath.concat(['stts']));
    var cttsBox = findBox(dv, trakStart, trakEnd, stblPath.concat(['ctts']));
    var stssBox = findBox(dv, trakStart, trakEnd, stblPath.concat(['stss']));
    var stszBox = findBox(dv, trakStart, trakEnd, stblPath.concat(['stsz']));
    var stsdBox = findBox(dv, trakStart, trakEnd, stblPath.concat(['stsd']));
    var elstBox = findBox(dv, trakStart, trakEnd, ['edts', 'elst']);

    var stsd = stsdBox ? parseStsd(dv, stsdBox.start, stsdBox.end) : { codec: '', width: 0, height: 0 };
    if (!sttsBox) {
      return { fragmentedTrackId: tkhd.trackId, timescale: timescale, meta: metaOf(), empty: true };
    }
    var stts = parseStts(dv, sttsBox.start, sttsBox.end);
    var ctts = cttsBox ? parseCtts(dv, cttsBox.start, cttsBox.end) : null;
    var stss = stssBox ? parseStss(dv, stssBox.start, stssBox.end) : null;
    var stsz = stszBox ? parseStsz(dv, stszBox.start, stszBox.end) : null;

    // 展开 stts -> dts
    var list = [];
    var dts = 0;
    for (var i = 0; i < stts.length; i++) {
      var cnt = stts[i][0], delta = stts[i][1];
      for (var c = 0; c < cnt; c++) {
        list.push({ dts: dts, cto: 0, key: !stss, size: 0, dur: delta });
        dts += delta;
      }
    }
    if (!list.length) return { fragmentedTrackId: tkhd.trackId, timescale: timescale, meta: metaOf(), empty: true };

    // ctts 合成偏移
    if (ctts) {
      var idx = 0;
      for (var e = 0; e < ctts.length && idx < list.length; e++) {
        var n2 = ctts[e][0], off = ctts[e][1];
        for (var m = 0; m < n2 && idx < list.length; m++, idx++) list[idx].cto = off;
      }
    }
    // 关键帧
    if (stss) {
      for (var s2 = 0; s2 < stss.length; s2++) {
        var si = stss[s2];
        if (si >= 0 && si < list.length) list[si].key = true;
      }
    }
    // 样本大小
    if (stsz) {
      if (stsz.uniform) { for (var z = 0; z < list.length; z++) list[z].size = stsz.uniform; }
      else if (stsz.sizes) { for (var z2 = 0; z2 < list.length && z2 < stsz.sizes.length; z2++) list[z2].size = stsz.sizes[z2]; }
    }

    // 编辑列表
    var editOffset = 0, emptyOffsetSec = 0;
    if (elstBox) {
      var edits = parseElst(dv, elstBox.start, elstBox.end);
      for (var q = 0; q < edits.length; q++) {
        if (edits[q].mediaTime < 0) {
          emptyOffsetSec += edits[q].duration / (mvhdTimescale || timescale); // 空编辑 = 前置留白
        } else { editOffset = edits[q].mediaTime; break; }
      }
    }

    function metaOf() {
      return {
        codec: stsd.codec,
        // tkhd 是「显示尺寸」（可能带非方形像素），stsd 是编码尺寸；
        // 优先取 tkhd，但它不合理时退回 stsd。
        width: Math.round(tkhd.width >= 1 ? tkhd.width : stsd.width),
        height: Math.round(tkhd.height >= 1 ? tkhd.height : stsd.height),
        codedWidth: stsd.width,
        codedHeight: stsd.height,
        trackDuration: mdhd.duration ? mdhd.duration / timescale : 0,
        structure: 'progressive'
      };
    }

    return {
      result: buildFromSampleList(list, timescale, editOffset, emptyOffsetSec, metaOf()),
      trackId: tkhd.trackId,
      timescale: timescale,
      meta: metaOf()
    };
  }

  /** 扫描顶层 box，返回 [{type,start,end}]（start 为内容起点） */
  function scanTopLevel(reader) {
    var boxes = [];
    var pos = 0;
    function step() {
      if (pos + 8 > reader.size || boxes.length > MAX_TOPLEVEL_BOXES) return Promise.resolve(boxes);
      return reader.read(pos, 16).then(function (ab) {
        if (ab.byteLength < 8) return boxes;
        var dv = new DataView(ab);
        var size = dv.getUint32(0);
        var type = typeOf(dv, 4);
        var header = 8;
        if (size === 1) {
          if (ab.byteLength < 16) return boxes;
          size = u64(dv, 8); header = 16;
        } else if (size === 0) {
          size = reader.size - pos;
        }
        if (size < header) return boxes;
        boxes.push({ type: type, start: pos + header, end: pos + size, size: size });
        pos += size;
        return step();
      });
    }
    return step();
  }

  var Mp4Index = {};

  Mp4Index.BlobReader = BlobReader;
  Mp4Index.BufferReader = BufferReader;

  /** 低层入口：任意 reader */
  Mp4Index.parse = function (reader) {
    return scanTopLevel(reader).then(function (boxes) {
      var ftyp = null, moov = null, moofs = [];
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].type === 'ftyp') ftyp = boxes[i];
        else if (boxes[i].type === 'moov') moov = boxes[i];
        else if (boxes[i].type === 'moof') moofs.push(boxes[i]);
      }
      if (!moov) return null;
      var moovLen = moov.end - moov.start;
      if (moovLen <= 0 || moovLen > MAX_MOOV_BYTES) return null;

      return reader.read(moov.start, moovLen).then(function (ab) {
        var dv = new DataView(ab);
        var mvhdBox = findBox(dv, 0, ab.byteLength, ['mvhd']);
        var mvhd = mvhdBox ? parseMvhd(dv, mvhdBox.start) : { timescale: 1000, duration: 0 };

        // 找视频 trak
        var picked = null;
        eachBox(dv, 0, ab.byteLength, function (type, cs, ce) {
          if (type !== 'trak' || picked) return;
          var r = parseProgressiveTrack(dv, cs, ce, mvhd.timescale);
          if (r) picked = r;
        });
        if (!picked) return null;

        if (picked.result && picked.result.frameCount > 1) return picked.result;

        // 渐进式表为空 -> 尝试 fMP4
        if (!moofs.length) return picked.result || null;
        return parseFragments(reader, moofs, picked, mvhd);
      });
    }).catch(function (err) {
      if (global.console) console.warn('[dsv4p] MP4 索引解析失败，回退恒定帧率模型：', err && err.message);
      return null;
    });
  };

  function parseFragments(reader, moofs, track, mvhd) {
    var timescale = track.timescale || mvhd.timescale || 1000;
    var list = [];
    var i = 0;
    function next() {
      if (i >= moofs.length) return Promise.resolve();
      var box = moofs[i++];
      var len = box.end - box.start;
      if (len <= 0 || len > 64 * 1024 * 1024) return next();
      return reader.read(box.start, len).then(function (ab) {
        var dv = new DataView(ab);
        var baseTime = null;
        eachBox(dv, 0, ab.byteLength, function (type, cs, ce) {
          if (type !== 'traf') return;
          var tfhdBox = findBox(dv, cs, ce, ['tfhd']);
          if (!tfhdBox) return;
          var tfhd = parseTfhd(dv, tfhdBox.start);
          if (track.trackId && tfhd.trackId !== track.trackId && track.fragmentedTrackId !== tfhd.trackId) return;
          var tfdtBox = findBox(dv, cs, ce, ['tfdt']);
          if (tfdtBox) {
            var ver = dv.getUint8(tfdtBox.start);
            baseTime = ver === 1 ? u64(dv, tfdtBox.start + 4) : dv.getUint32(tfdtBox.start + 4);
          }
          var dts = baseTime != null ? baseTime : (list.length ? list[list.length - 1].dts + (list[list.length - 1].dur || 0) : 0);
          eachBox(dv, cs, ce, function (t2, s2, e2) {
            if (t2 !== 'trun') return;
            var samples = parseTrun(dv, s2, e2, tfhd);
            for (var k = 0; k < samples.length; k++) {
              var sp = samples[k];
              list.push({ dts: dts, cto: sp.cto, key: sp.key, size: sp.size, dur: sp.dur });
              dts += sp.dur || 0;
            }
          });
        });
        return next();
      });
    }
    return next().then(function () {
      if (!list.length) return null;
      var meta = track.meta || {};
      meta.structure = 'fragmented';
      return buildFromSampleList(list, timescale, 0, 0, meta);
    });
  }

  /** 浏览器入口：File / Blob */
  Mp4Index.fromBlob = function (blob) {
    if (!blob) return Promise.resolve(null);
    return Mp4Index.parse(new BlobReader(blob));
  };

  /** Node / 测试入口：ArrayBuffer 或 TypedArray */
  Mp4Index.fromArrayBuffer = function (ab) {
    if (!ab) return Promise.resolve(null);
    return Mp4Index.parse(new BufferReader(ab));
  };

  D.Mp4Index = Mp4Index;
  if (typeof module !== 'undefined' && module.exports) module.exports = Mp4Index;
})(typeof window !== 'undefined' ? window : globalThis);
