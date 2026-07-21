/*
 * cartridge.js —— iNES（.nes）文件解析
 *
 * iNES 是 NES ROM 的事实标准封装格式，布局：
 *   ┌──────────────┬──────────────────────────────────────────┐
 *   │ 偏移          │ 内容                                     │
 *   ├──────────────┼──────────────────────────────────────────┤
 *   │ 0-3          │ 魔数 "NES\x1A"                            │
 *   │ 4            │ PRG ROM 大小（16KB 为单位）                │
 *   │ 5            │ CHR ROM 大小（8KB 为单位，0 = 卡带用 CHR RAM）│
 *   │ 6  flags6    │ bit0 镜像(0水平/1垂直) bit1 电池 SRAM      │
 *   │              │ bit2 trainer bit3 四屏  bit4-7 mapper 低4位│
 *   │ 7  flags7    │ bit4-7 mapper 高 4 位                     │
 *   │ 8-15         │ 扩展字段（iNES 2.0 使用，这里忽略）         │
 *   │ 16...        │ [可选 512 字节 trainer] PRG ROM，CHR ROM   │
 *   └──────────────┴──────────────────────────────────────────┘
 */
"use strict";

/* 安全切片：文件被截断时补零，避免越界产生 undefined */
function readSlice(data, offset, length) {
  const out = new Uint8Array(length);
  if (offset < data.length) {
    out.set(data.subarray(offset, Math.min(data.length, offset + length)));
  }
  return out;
}

function parseINES(data) {
  if (data.length < 16 || data[0] !== 0x4E || data[1] !== 0x45 || data[2] !== 0x53 || data[3] !== 0x1A) {
    throw new Error("不是有效的 iNES 文件");
  }
  const prgBanks = data[4];
  const chrBanks = data[5];
  const flags6 = data[6];
  const flags7 = data[7];
  if (prgBanks === 0) throw new Error("ROM 不包含 PRG 数据");
  let mapperNum = flags6 >> 4;
  /* 兼容老抓包工具（如 "DiskDude!"）污染字节 7-15 的 ROM：
     若 12-15 字节不全为零，则忽略 flags7 提供的 mapper 高 4 位 */
  if (!(data[12] | data[13] | data[14] | data[15])) mapperNum |= flags7 & 0xF0;
  /* 镜像方式编码见 mappers.js 的 NT_LUT：0水平 1垂直 4四屏 */
  const mirror = (flags6 & 8) ? 4 : ((flags6 & 1) ? 1 : 0);
  const battery = (flags6 & 2) !== 0;
  const offset = 16 + ((flags6 & 4) ? 512 : 0); // 跳过 trainer
  const prgSize = prgBanks * 0x4000;
  const chrSize = chrBanks * 0x2000;
  const prg = readSlice(data, offset, prgSize);
  const chrIsRam = chrSize === 0;
  /* CHR 大小为 0 表示卡带装的是 8KB CHR RAM（图案数据由程序运行时写入） */
  const chr = chrIsRam ? new Uint8Array(0x2000) : readSlice(data, offset + prgSize, chrSize);
  return { prg, chr, chrIsRam, mapperNum, mirror, battery, prgBanks, chrBanks };
}

/* djb2 哈希，用作电池存档的 localStorage 键（区分不同 ROM） */
function hashBytes(data) {
  let h = 5381;
  for (let i = 0; i < data.length; i++) {
    h = ((h << 5) + h + data[i]) >>> 0;
  }
  return h.toString(16) + "-" + data.length.toString(16);
}
