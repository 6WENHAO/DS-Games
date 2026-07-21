/*
 * ppu.js —— PPU（Picture Processing Unit，2C02 图形芯片）模拟
 *
 * PPU 与 CPU 并行运行：1 个 CPU 周期 = 3 个 PPU 点（dot）。
 * 一帧（NTSC）= 262 条扫描线 × 每线 341 点：
 *   扫描线 0-239   可见区域，输出 256×240 像素
 *   扫描线 240     后渲染线（空闲）
 *   扫描线 241     第 1 点置 VBlank 标志，若允许则向 CPU 发 NMI
 *   扫描线 242-260 VBlank（游戏在此期间安全地更新显存）
 *   扫描线 261     预渲染线，清除 VBlank/sprite0/溢出标志，为下一帧做准备
 *
 * 图形数据的三层结构：
 *   Pattern Table 图案表（$0000-$1FFF，位于卡带 CHR）：每个 8×8 图块占 16 字节，
 *     分为两个"位平面"，两位组合出 0-3 号颜色（0 = 透明）
 *   Nametable 命名表（$2000-$2FFF，主机 2KB 显存 + 镜像）：32×30 个图块索引，
 *     尾部 64 字节是属性表，每 2 位为一个 16×16 像素区域选择 4 组背景调色板之一
 *   Palette 调色板（$3F00-$3F1F）：背景/精灵各 4 组×3 色 + 公共背景色，
 *     存的是 64 色主调色板（NES_PALETTE）的索引
 *
 * 本实现采用"扫描线级"渲染：在每条可见扫描线的第 1 个点一次性渲染整行
 * 256 像素（renderScanline），同时仍按精确点位模拟关键时序事件——
 * v 寄存器的水平/垂直复制、sprite 0 hit 的触发点、MMC3 的扫描线计数——
 * 以兼顾速度与兼容性（绝大多数游戏的分屏/滚动效果都依赖这些时序）。
 */
"use strict";

/* 2C02 的 64 色主调色板（RGB 近似值）。NES 输出的不是 RGB，而是这张表的索引 */
const NES_PALETTE = [
  0x545454, 0x001E74, 0x081090, 0x300088, 0x440064, 0x5C0030, 0x540400, 0x3C1800,
  0x202A00, 0x083A00, 0x004000, 0x003C00, 0x00323C, 0x000000, 0x000000, 0x000000,
  0x989698, 0x084CC4, 0x3032EC, 0x5C1EE4, 0x8814B0, 0xA01464, 0x982220, 0x783C00,
  0x545A00, 0x287200, 0x087C00, 0x007628, 0x006678, 0x000000, 0x000000, 0x000000,
  0xECEEEC, 0x4C9AEC, 0x787CEC, 0xB062EC, 0xE454EC, 0xEC58B4, 0xEC6A64, 0xD48820,
  0xA0AA00, 0x74C400, 0x4CD020, 0x38CC6C, 0x38B4CC, 0x3C3C3C, 0x000000, 0x000000,
  0xECEEEC, 0xA8CCEC, 0xBCBCEC, 0xD4B2EC, 0xECAEEC, 0xECAED4, 0xECB4B0, 0xE4C490,
  0xCCD278, 0xB4DE78, 0xA8E290, 0x98E2B4, 0xA0D6E4, 0xA0A2A0, 0x000000, 0x000000
];

/* 预转换为小端 ABGR（canvas ImageData 的内存布局），渲染时直接写 32 位整数 */
const NES_COLORS = new Uint32Array(64);
for (let i = 0; i < 64; i++) {
  const c = NES_PALETTE[i];
  NES_COLORS[i] = 0xFF000000 | ((c & 0xFF) << 16) | (c & 0xFF00) | ((c >> 16) & 0xFF);
}

class PPU {
  constructor(nes) {
    this.nes = nes;
    this.vram = new Uint8Array(0x1000);        // 命名表显存（2KB，预留 4KB 支持四屏卡带）
    this.palette = new Uint8Array(32);         // 调色板 RAM
    this.oam = new Uint8Array(256);            // 精灵属性表：64 个精灵 × 4 字节
    this.framebuffer = new Uint32Array(256 * 240); // 输出帧缓冲（main.js 会替换为共享内存）
    this.lineBuf = new Uint8Array(272);        // 一行背景的调色板索引（33 块 × 8 像素）
    this.bgLine = new Uint8Array(256);         // 本行背景像素是否不透明（供精灵优先级/sprite0 判断）
    this.spriteDrawn = new Uint8Array(256);    // 本行每个像素是否已被更高优先级精灵占用
    this.reset();
  }

  reset() {
    this.ctrl = 0;       // $2000：NMI 使能、精灵尺寸、图案表选择、地址增量等
    this.mask = 0;       // $2001：背景/精灵显示开关、左 8 像素裁剪、灰度
    this.status = 0;     // $2002：VBlank / sprite 0 hit / 精灵溢出
    this.oamAddr = 0;    // $2003
    /*
     * loopy 寄存器——PPU 滚动的核心（15 位）：
     *   v = 当前显存地址，渲染时其位域为  yyy NN YYYYY XXXXX
     *       （fineY 3位 | 命名表 2位 | coarseY 5位 | coarseX 5位）
     *   t = 暂存地址（游戏写 $2005/$2006 先改 t，在恰当时机复制进 v）
     *   x = fine X（块内水平偏移 0-7）
     *   w = 双写锁存（$2005/$2006 都需要写两次，共用这一个开关）
     */
    this.v = 0;
    this.t = 0;
    this.x = 0;
    this.w = 0;
    this.readBuffer = 0; // $2007 的读缓冲（PPU 读取有一拍延迟）
    this.openBus = 0;    // PPU 总线残留值（读写寄存器的副产物）
    this.scanline = 261;
    this.cycle = 0;
    this.frameCount = 0;
    this.frameComplete = false;
    this.sprite0HitCycle = -1; // 本行 sprite 0 hit 应在哪个点触发
    this.vram.fill(0);
    this.palette.fill(0);
    this.oam.fill(0);
    this.framebuffer.fill(0xFF000000);
  }

  /* CPU 读 $2000-$2007（经 nes.js 按 addr&7 分发） */
  readRegister(reg) {
    switch (reg) {
      case 2: {
        /* $2002：高 3 位是状态，低 5 位是总线残留。
           读取的副作用：清 VBlank 标志、复位 w 锁存（游戏靠它同步双写） */
        const r = (this.status & 0xE0) | (this.openBus & 0x1F);
        this.status &= 0x7F;
        this.w = 0;
        return r;
      }
      case 4:
        return this.oam[this.oamAddr];
      case 7: {
        /*
         * $2007 显存数据口。非调色板地址的读取带一拍缓冲：
         * 本次返回上次缓冲的值，同时把当前地址的数据填入缓冲。
         * 调色板地址直接返回，但缓冲会填入其"下方"镜像的命名表数据。
         */
        const addr = this.v & 0x3FFF;
        let val;
        if (addr >= 0x3F00) {
          val = this.paletteRead(addr);
          this.readBuffer = this.ppuRead(addr - 0x1000);
        } else {
          val = this.readBuffer;
          this.readBuffer = this.ppuRead(addr);
        }
        /* 每次访问后 v 自增 1（横向）或 32（纵向，跳一行图块），由 ctrl bit2 决定 */
        this.v = (this.v + ((this.ctrl & 4) ? 32 : 1)) & 0x7FFF;
        return val;
      }
      default:
        return this.openBus;
    }
  }

  writeRegister(reg, val) {
    this.openBus = val;
    switch (reg) {
      case 0: {
        /* $2000 控制寄存器。低 2 位是命名表选择，写入 t 的 bit10-11 */
        const prev = this.ctrl;
        this.ctrl = val;
        this.t = (this.t & 0x73FF) | ((val & 3) << 10);
        /* 若在 VBlank 期间（标志仍置位）打开 NMI 使能，立即补发一次 NMI */
        if (!(prev & 0x80) && (val & 0x80) && (this.status & 0x80)) {
          this.nes.cpu.nmiPending = true;
        }
        break;
      }
      case 1:
        this.mask = val;
        break;
      case 3:
        this.oamAddr = val;
        break;
      case 4:
        this.oam[this.oamAddr] = val;
        this.oamAddr = (this.oamAddr + 1) & 0xFF;
        break;
      case 5:
        /* $2005 滚动寄存器：第一次写 X 滚动，第二次写 Y 滚动 */
        if (this.w === 0) {
          this.t = (this.t & 0x7FE0) | (val >> 3); // coarseX = 高 5 位
          this.x = val & 7;                        // fineX  = 低 3 位
          this.w = 1;
        } else {
          /* Y 的高 5 位进 coarseY（bit5-9），低 3 位进 fineY（bit12-14） */
          this.t = (this.t & 0x0C1F) | ((val & 7) << 12) | ((val & 0xF8) << 2);
          this.w = 0;
        }
        break;
      case 6:
        /* $2006 显存地址：第一次写高 6 位，第二次写低 8 位并整体复制 t→v */
        if (this.w === 0) {
          this.t = (this.t & 0x00FF) | ((val & 0x3F) << 8);
          this.w = 1;
        } else {
          this.t = (this.t & 0x7F00) | val;
          this.v = this.t;
          this.w = 0;
        }
        break;
      case 7:
        this.ppuWrite(this.v & 0x3FFF, val);
        this.v = (this.v + ((this.ctrl & 4) ? 32 : 1)) & 0x7FFF;
        break;
    }
  }

  /*
   * PPU 地址空间（14 位，$0000-$3FFF）：
   *   $0000-$1FFF 图案表 → 卡带 CHR（可能被 Mapper 切换银行）
   *   $2000-$2FFF 命名表 → 2KB 显存，经 Mapper 决定的镜像方式折叠
   *   $3F00-$3FFF 调色板（内部 32 字节，独立于显存）
   */
  ppuRead(addr) {
    addr &= 0x3FFF;
    if (addr < 0x2000) return this.nes.mapper.readChr(addr);
    if (addr < 0x3F00) return this.vram[this.nes.mapper.ntIndex(addr)];
    return this.paletteRead(addr);
  }

  ppuWrite(addr, val) {
    addr &= 0x3FFF;
    if (addr < 0x2000) this.nes.mapper.writeChr(addr, val);
    else if (addr < 0x3F00) this.vram[this.nes.mapper.ntIndex(addr)] = val;
    else this.paletteWrite(addr, val);
  }

  /* $3F10/$3F14/$3F18/$3F1C 是 $3F00/04/08/0C 的镜像（精灵组的"透明色"槽位） */
  paletteRead(addr) {
    addr &= 0x1F;
    if (addr >= 0x10 && (addr & 3) === 0) addr -= 0x10;
    return this.palette[addr];
  }

  paletteWrite(addr, val) {
    addr &= 0x1F;
    if (addr >= 0x10 && (addr & 3) === 0) addr -= 0x10;
    this.palette[addr] = val & 0x3F;
  }

  /* 调色板索引 → 屏幕颜色；mask bit0 是灰度模式（钳制到灰阶列） */
  colorOf(idx) {
    if (idx >= 0x10 && (idx & 3) === 0) idx -= 0x10;
    return NES_COLORS[this.palette[idx] & ((this.mask & 1) ? 0x30 : 0x3F)];
  }

  /*
   * 渲染期间 v 的垂直推进（硬件在每条扫描线第 256 点执行）：
   * fineY 0-7 递增；溢出时 coarseY 递增；coarseY 到 29（30 行图块的末尾）
   * 时归零并切换垂直命名表；到 31 则只归零（属性表区域的怪癖行为）。
   */
  incrementY() {
    let v = this.v;
    if ((v & 0x7000) !== 0x7000) {
      v += 0x1000;
    } else {
      v &= 0x0FFF;
      let y = (v & 0x03E0) >> 5;
      if (y === 29) {
        y = 0;
        v ^= 0x0800;
      } else if (y === 31) {
        y = 0;
      } else {
        y++;
      }
      v = (v & 0x7C1F) | (y << 5);
    }
    this.v = v;
  }

  /* 第 257 点：把 t 的水平位（coarseX + 水平命名表）复制进 v，行首回到左边缘 */
  copyX() {
    this.v = (this.v & 0x7BE0) | (this.t & 0x041F);
  }

  /* 预渲染线第 280-304 点：把 t 的垂直位复制进 v，一帧从顶部开始 */
  copyY() {
    this.v = (this.v & 0x041F) | (this.t & 0x7BE0);
  }

  /* 推进一个 PPU 点：只在关键点位触发事件，渲染本身按行批量完成 */
  tick() {
    const sl = this.scanline;
    const cy = this.cycle;
    const rendering = (this.mask & 0x18) !== 0; // 背景或精灵至少开一个才算"渲染中"
    if (sl < 240) {
      if (cy === 1) this.renderScanline(sl);
      else if (cy === this.sprite0HitCycle) {
        /* 行渲染时算出了 sprite 0 命中的像素位置，此刻才真正置位标志——
           游戏会在扫描线中途轮询 $2002 等待它，用来做分屏滚动 */
        this.status |= 0x40;
        this.sprite0HitCycle = -1;
      }
      if (rendering) {
        if (cy === 256) this.incrementY();
        else if (cy === 257) this.copyX();
        else if (cy === 260) this.nes.mapper.ppuScanline(); // MMC3 扫描线计数器时钟
      }
    } else if (sl === 241) {
      if (cy === 1) {
        /* 进入 VBlank：置标志、通知主循环一帧完成、按需触发 NMI */
        this.status |= 0x80;
        this.frameComplete = true;
        if (this.ctrl & 0x80) this.nes.cpu.nmiPending = true;
      }
    } else if (sl === 261) {
      if (cy === 1) {
        this.status &= 0x1F; // 清 VBlank、sprite 0 hit、精灵溢出
        this.sprite0HitCycle = -1;
      }
      if (rendering) {
        if (cy === 256) this.incrementY();
        else if (cy === 257) this.copyX();
        else if (cy === 260) this.nes.mapper.ppuScanline();
        else if (cy === 280) this.copyY();
        /* 奇数帧跳过预渲染线的最后一个点（NTSC 硬件行为） */
        else if (cy === 339 && (this.frameCount & 1)) this.cycle = 340;
      }
    }
    this.cycle++;
    if (this.cycle > 340) {
      this.cycle = 0;
      this.scanline++;
      if (this.scanline > 261) {
        this.scanline = 0;
        this.frameCount++;
      }
    }
  }

  /* 渲染一整条可见扫描线（256 像素）到帧缓冲 */
  renderScanline(sl) {
    const fb = this.framebuffer;
    const row = sl << 8;
    const bgOn = (this.mask & 0x08) !== 0;
    const spOn = (this.mask & 0x10) !== 0;
    const bgLine = this.bgLine;
    const mapper = this.nes.mapper;
    this.sprite0HitCycle = -1;

    if (bgOn) {
      /*
       * 背景：因为 fineX 滚动会让首尾图块只露出一部分，
       * 一行需要取 33 个图块（264 像素），最后按 fineX 偏移截取 256 像素。
       * 对每个图块：
       *   1. 用 v 的低 12 位从命名表取图块编号
       *   2. 从属性表取该 16×16 区域的调色板高 2 位
       *      （一个属性字节管 32×32 像素，内部按象限各用 2 位）
       *   3. 用图块号 × 16 + fineY 从图案表取两个位平面
       *   4. 两平面逐位组合出 8 个像素的 0-3 号色
       */
      let v = this.v;
      const fineX = this.x;
      const bgTable = (this.ctrl & 0x10) ? 0x1000 : 0;
      const buf = this.lineBuf;
      const vram = this.vram;
      let pos = 0;
      for (let tile = 0; tile < 33; tile++) {
        const fineY = (v >> 12) & 7;
        const nt = vram[mapper.ntIndex(0x2000 | (v & 0x0FFF))];
        /* 属性表地址公式：0x23C0 | 命名表 | (coarseY/4)*8 | coarseX/4 */
        const at = vram[mapper.ntIndex(0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 7))];
        /* 在属性字节内选择象限：coarseY bit1 → 上下，coarseX bit1 → 左右 */
        const shift = ((v >> 4) & 4) | (v & 2);
        const palHigh = ((at >> shift) & 3) << 2;
        const pa = bgTable + (nt << 4) + fineY;
        const lo = mapper.readChr(pa);
        const hi = mapper.readChr(pa + 8);
        for (let b = 7; b >= 0; b--) {
          const p = ((lo >> b) & 1) | (((hi >> b) & 1) << 1);
          buf[pos++] = p ? (palHigh | p) : 0; // 0 号色统一映射到公共背景色
        }
        /* coarseX 递增；越过第 31 列时回绕并切换水平命名表 */
        if ((v & 0x1F) === 31) v = (v & 0x7FE0) ^ 0x0400;
        else v++;
      }
      const maskLeft = !(this.mask & 2); // 左 8 像素背景裁剪位
      for (let i = 0; i < 256; i++) {
        let pi = buf[i + fineX];
        if (maskLeft && i < 8) pi = 0;
        bgLine[i] = pi;
        fb[row + i] = this.colorOf(pi);
      }
    } else {
      bgLine.fill(0);
      /* 渲染关闭时显示公共背景色；若 v 恰好指向调色板区，
         则显示对应颜色（真机的"背景调色板 hack"，少数演示程序使用） */
      let backdropIdx = 0;
      if (!spOn && (this.v & 0x3F00) === 0x3F00) backdropIdx = this.v & 0x1F;
      const backdrop = this.colorOf(backdropIdx);
      for (let i = 0; i < 256; i++) fb[row + i] = backdrop;
    }

    if (spOn) {
      /*
       * 精灵：OAM 中每个精灵 4 字节：
       *   [0] Y 坐标（实际显示位置 = Y+1，硬件如此）
       *   [1] 图块号（8×16 模式下 bit0 选图案表，其余位是成对的图块号）
       *   [2] 属性：调色板低 2 位 | bit5 优先级(1=背景后) | bit6 水平翻转 | bit7 垂直翻转
       *   [3] X 坐标
       * 硬件限制：每条扫描线最多显示 8 个精灵，超出置溢出标志；
       * 编号小的精灵优先获得像素（即便它设置为"背景后"也会占住这个位置）。
       */
      const drawn = this.spriteDrawn;
      drawn.fill(0);
      const h = (this.ctrl & 0x20) ? 16 : 8;
      const oam = this.oam;
      const maskLeftSp = !(this.mask & 4);
      let count = 0;
      for (let n = 0; n < 64; n++) {
        const oy = oam[n << 2];
        const row0 = sl - (oy + 1);
        if (row0 < 0 || row0 >= h) continue;
        count++;
        if (count > 8) {
          this.status |= 0x20;
          break;
        }
        const tile = oam[(n << 2) | 1];
        const attr = oam[(n << 2) | 2];
        const ox = oam[(n << 2) | 3];
        let r = (attr & 0x80) ? (h - 1 - row0) : row0; // 垂直翻转
        let pa;
        if (h === 16) {
          /* 8×16 精灵：占用相邻两个图块，下半块 = 图块号 | 1 */
          let t2 = tile & 0xFE;
          if (r > 7) {
            t2 |= 1;
            r &= 7;
          }
          pa = ((tile & 1) << 12) | (t2 << 4) | r;
        } else {
          pa = ((this.ctrl & 8) ? 0x1000 : 0) | (tile << 4) | r;
        }
        const lo = mapper.readChr(pa);
        const hi = mapper.readChr(pa + 8);
        const palHigh = 0x10 | ((attr & 3) << 2); // 精灵调色板从 $3F10 开始
        const behind = (attr & 0x20) !== 0;
        const flipH = (attr & 0x40) !== 0;
        for (let i = 0; i < 8; i++) {
          const xPos = ox + i;
          if (xPos >= 256) break;
          if (maskLeftSp && xPos < 8) continue;
          const bit = flipH ? i : 7 - i;
          const p = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
          if (!p) continue; // 0 号色 = 透明
          /*
           * sprite 0 hit：0 号精灵的不透明像素与背景不透明像素首次重叠。
           * 记下发生位置对应的点（x+2），由 tick() 在时间轴上精确置位。
           * x=255 处硬件不产生 hit。
           */
          if (n === 0 && bgOn && bgLine[xPos] && xPos < 255 &&
            this.sprite0HitCycle < 0 && !(this.status & 0x40)) {
            this.sprite0HitCycle = xPos + 2;
          }
          if (drawn[xPos]) continue; // 已被更小编号的精灵占用
          drawn[xPos] = 1;
          /* "背景后"的精灵只在背景透明处可见 */
          if (!(behind && bgLine[xPos])) fb[row + xPos] = this.colorOf(palHigh | p);
        }
      }
    }
  }
}
