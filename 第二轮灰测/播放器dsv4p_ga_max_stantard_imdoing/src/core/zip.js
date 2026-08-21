/*!
 * src/core/zip.js — 极简 ZIP 打包器（仅 STORE 存储，无压缩，零依赖）
 * 用于「导出帧序列」：把一堆 PNG 打成一个 .zip 直接下载。
 * PNG 本身已是压缩数据，再做 deflate 收益极低，所以 STORE 是最合适的选择。
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes, seed) {
    var c = (seed === undefined ? 0xFFFFFFFF : seed) >>> 0;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(d) {
    d = d || new Date();
    var year = d.getFullYear();
    if (year < 1980) year = 1980;
    var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
    var date = (((year - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { time: time & 0xFFFF, date: date & 0xFFFF };
  }

  function utf8(str) {
    if (global.TextEncoder) return new TextEncoder().encode(str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  function W(len) {
    var b = new Uint8Array(len);
    var dv = new DataView(b.buffer);
    var p = 0;
    return {
      bytes: b,
      u16: function (v) { dv.setUint16(p, v, true); p += 2; return this; },
      u32: function (v) { dv.setUint32(p, v >>> 0, true); p += 4; return this; },
      raw: function (u8) { b.set(u8, p); p += u8.length; return this; }
    };
  }

  /**
   * ZipWriter：逐个 add() 后 blob() 拿到结果
   * @constructor
   */
  function ZipWriter() {
    this.entries = [];
    this.parts = [];
    this.offset = 0;
  }

  /**
   * @param {string} name 压缩包内路径（用 / 分隔）
   * @param {Uint8Array|ArrayBuffer} data
   * @param {Date} [date]
   */
  ZipWriter.prototype.add = function (name, data, date) {
    var bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    var nameBytes = utf8(name);
    var dt = dosDateTime(date);
    var crc = crc32(bytes);

    var head = W(30 + nameBytes.length);
    head.u32(0x04034b50).u16(20).u16(0x0800).u16(0)  // 0x0800: 文件名为 UTF-8
      .u16(dt.time).u16(dt.date)
      .u32(crc).u32(bytes.length).u32(bytes.length)
      .u16(nameBytes.length).u16(0).raw(nameBytes);

    this.parts.push(head.bytes, bytes);
    this.entries.push({
      name: nameBytes, crc: crc, size: bytes.length, offset: this.offset,
      time: dt.time, date: dt.date
    });
    this.offset += head.bytes.length + bytes.length;
    if (this.offset > 0xFFFFFFF0) throw new Error('ZIP 超过 4GB 上限，请减少导出帧数或降低分辨率');
    return this;
  };

  ZipWriter.prototype.blob = function () {
    var cdParts = [];
    var cdSize = 0;
    for (var i = 0; i < this.entries.length; i++) {
      var e = this.entries[i];
      var c = W(46 + e.name.length);
      c.u32(0x02014b50).u16(20).u16(20).u16(0x0800).u16(0)
        .u16(e.time).u16(e.date)
        .u32(e.crc).u32(e.size).u32(e.size)
        .u16(e.name.length).u16(0).u16(0)
        .u16(0).u16(0).u32(0)
        .u32(e.offset).raw(e.name);
      cdParts.push(c.bytes);
      cdSize += c.bytes.length;
    }
    var eocd = W(22);
    eocd.u32(0x06054b50).u16(0).u16(0)
      .u16(this.entries.length).u16(this.entries.length)
      .u32(cdSize).u32(this.offset).u16(0);

    return new Blob(this.parts.concat(cdParts, [eocd.bytes]), { type: 'application/zip' });
  };

  ZipWriter.prototype.count = function () { return this.entries.length; };
  ZipWriter.prototype.bytes = function () { return this.offset; };

  D.ZipWriter = ZipWriter;
  D.crc32 = crc32;
  if (typeof module !== 'undefined' && module.exports) module.exports = { ZipWriter: ZipWriter, crc32: crc32 };
})(typeof window !== 'undefined' ? window : globalThis);
