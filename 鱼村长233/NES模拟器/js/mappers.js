/*
 * mappers.js —— 卡带 Mapper（存储映射器）模拟
 *
 * 为什么需要 Mapper？
 * CPU 分给卡带的地址窗口只有 32KB（$8000-$FFFF），PPU 分给图案数据的
 * 窗口只有 8KB（$0000-$1FFF）。大于这个容量的游戏必须在卡带上加一块
 * 逻辑电路，通过"写 ROM 地址"这种看似无意义的操作向电路发指令，
 * 把不同的 ROM 银行（bank）切换到窗口里——这就是 Mapper。
 * 不同厂商的方案互不兼容，模拟器需要逐个实现。
 *
 * Mapper 还常兼管命名表镜像，高级的（如 MMC3）还能产生扫描线 IRQ。
 *
 * 本文件实现：
 *   0  NROM   无切换（超级马里奥、大金刚）
 *   1  MMC1   串行移位寄存器（塞尔达传说、银河战士）
 *   2  UxROM  16KB PRG 切换（魂斗罗、洛克人）
 *   3  CNROM  8KB CHR 切换（高桥名人的冒险岛）
 *   4  MMC3   细粒度切换 + 扫描线 IRQ（超级马里奥 3、忍者龙剑传）
 *   7  AxROM  32KB PRG 切换 + 单屏镜像（吞食天地）
 *   11 Color Dreams / 66 GxROM 简单组合切换
 */
"use strict";

/*
 * 命名表镜像查找表。
 * PPU 有 4 个逻辑命名表（$2000/$2400/$2800/$2C00），但主机只有 2KB 显存
 * （放得下 2 个），到底哪两个逻辑表共用一块物理内存由卡带布线决定：
 *
 *   水平镜像 [0,0,1,1]：$2000=$2400、$2800=$2C00 → 适合纵向卷轴
 *   垂直镜像 [0,1,0,1]：$2000=$2800、$2400=$2C00 → 适合横向卷轴
 *   单屏     [0,0,0,0] / [1,1,1,1]：四个逻辑表全指向同一块
 *   四屏     [0,1,2,3]：卡带自带额外显存，四个表各自独立
 */
const NT_LUT = [
  [0, 0, 1, 1],
  [0, 1, 0, 1],
  [0, 0, 0, 0],
  [1, 1, 1, 1],
  [0, 1, 2, 3]
];

/* 基类同时就是 Mapper 0（NROM）：PRG 16KB 镜像或 32KB 直通，无任何切换 */
class Mapper {
  constructor(cart) {
    this.cart = cart;
    this.prg = cart.prg;
    this.chr = cart.chr;
    this.chrIsRam = cart.chrIsRam;
    this.prgRam = new Uint8Array(0x2000); // $6000-$7FFF 卡带 RAM（电池存档在这里）
    this.mirror = cart.mirror;            // 当前镜像方式（NT_LUT 的行号）
    this.irqPending = false;              // Mapper IRQ 线（MMC3 使用）
    this.ramDirty = false;                // PRG RAM 被写过 → main.js 定期持久化
  }

  /* 把 PPU 命名表地址（$2000-$2FFF）折叠成 4KB 物理显存内的偏移 */
  ntIndex(addr) {
    addr &= 0x0FFF;
    return NT_LUT[this.mirror][addr >> 10] * 0x400 + (addr & 0x3FF);
  }

  /* CPU 读卡带空间（$4020-$FFFF，实际游戏只用 $6000 以上） */
  readPrg(addr) {
    if (addr >= 0x8000) return this.prg[(addr - 0x8000) % this.prg.length];
    if (addr >= 0x6000) return this.prgRam[addr - 0x6000];
    return 0;
  }

  writePrg(addr, val) {
    if (addr >= 0x6000 && addr < 0x8000) {
      this.prgRam[addr - 0x6000] = val;
      this.ramDirty = true;
    }
  }

  /* PPU 读写图案表（$0000-$1FFF） */
  readChr(addr) {
    return this.chr[addr];
  }

  writeChr(addr, val) {
    if (this.chrIsRam) this.chr[addr] = val;
  }

  /* PPU 在每条渲染扫描线的第 260 点调用（供 MMC3 计数），其他 Mapper 无操作 */
  ppuScanline() {}
}

/*
 * Mapper 1 —— MMC1
 * 只有 1 根数据线可用，所以采用串行协议：向 $8000-$FFFF 连写 5 次，
 * 每次送 1 位（bit0，低位在先），第 5 次时根据地址落在哪个 8KB 区段
 * 决定写入哪个内部寄存器。写入 bit7=1 立即复位移位寄存器。
 *
 * control 寄存器（5 位）：
 *   bit0-1 镜像（0/1 单屏，2 垂直，3 水平）
 *   bit2-3 PRG 模式（0/1: 32KB 整切；2: 固定首银行切 $C000；3: 切 $8000 固定末银行）
 *   bit4   CHR 模式（0: 8KB 整切；1: 两个独立 4KB）
 */
class Mapper1 extends Mapper {
  constructor(cart) {
    super(cart);
    this.shift = 0x10;    // 哨兵位：它被移到 bit0 时表示凑齐 5 位
    this.control = 0x0C;  // 上电默认 PRG 模式 3（固定末银行，保证复位向量可见）
    this.chr0 = 0;
    this.chr1 = 0;
    this.prgBank = 0;
    this.applyMirror();
  }

  applyMirror() {
    const m = this.control & 3;
    this.mirror = m === 0 ? 2 : m === 1 ? 3 : m === 2 ? 1 : 0;
  }

  writePrg(addr, val) {
    if (addr < 0x8000) {
      super.writePrg(addr, val);
      return;
    }
    if (val & 0x80) {
      this.shift = 0x10;
      this.control |= 0x0C;
      return;
    }
    const complete = this.shift & 1; // 哨兵已到底 → 本次是第 5 位
    this.shift = (this.shift >> 1) | ((val & 1) << 4);
    if (complete) {
      const v = this.shift;
      this.shift = 0x10;
      switch ((addr >> 13) & 3) { // 地址 bit13-14 选择寄存器
        case 0:
          this.control = v;
          this.applyMirror();
          break;
        case 1:
          this.chr0 = v;
          break;
        case 2:
          this.chr1 = v;
          break;
        case 3:
          this.prgBank = v & 0x0F;
          break;
      }
    }
  }

  readPrg(addr) {
    if (addr < 0x6000) return 0;
    if (addr < 0x8000) return this.prgRam[addr - 0x6000];
    const a = addr - 0x8000;
    const mode = (this.control >> 2) & 3;
    const len = this.prg.length;
    if (mode < 2) return this.prg[((this.prgBank & 0x0E) * 0x4000 + a) % len];
    if (mode === 2) {
      if (a < 0x4000) return this.prg[a];
      return this.prg[(this.prgBank * 0x4000 + (a - 0x4000)) % len];
    }
    if (a < 0x4000) return this.prg[(this.prgBank * 0x4000 + a) % len];
    return this.prg[len - 0x4000 + (a - 0x4000)];
  }

  /* CHR 地址换算（读写共用）；CHR RAM 卡带（如塞尔达）也要走同样的银行逻辑 */
  chrAddr(addr) {
    if (this.control & 0x10) {
      if (addr < 0x1000) return (this.chr0 * 0x1000 + addr) % this.chr.length;
      return (this.chr1 * 0x1000 + (addr - 0x1000)) % this.chr.length;
    }
    return ((this.chr0 & 0x1E) * 0x1000 + addr) % this.chr.length;
  }

  readChr(addr) {
    return this.chr[this.chrAddr(addr)];
  }

  writeChr(addr, val) {
    if (this.chrIsRam) this.chr[this.chrAddr(addr)] = val;
  }
}

/*
 * Mapper 2 —— UxROM
 * 写 $8000-$FFFF 的值直接作为银行号：$8000-$BFFF 切换 16KB 银行，
 * $C000-$FFFF 永远固定为最后一个银行（放复位向量和公共代码）。
 * 图案数据用 CHR RAM，由程序自己搬运。
 */
class Mapper2 extends Mapper {
  constructor(cart) {
    super(cart);
    this.bank = 0;
    this.banks = Math.max(1, cart.prg.length >> 14);
  }

  writePrg(addr, val) {
    if (addr < 0x8000) {
      super.writePrg(addr, val);
      return;
    }
    this.bank = val % this.banks;
  }

  readPrg(addr) {
    if (addr < 0x6000) return 0;
    if (addr < 0x8000) return this.prgRam[addr - 0x6000];
    if (addr < 0xC000) return this.prg[this.bank * 0x4000 + (addr - 0x8000)];
    return this.prg[this.prg.length - 0x4000 + (addr - 0xC000)];
  }
}

/* Mapper 3 —— CNROM：PRG 固定，只切换 8KB CHR 银行 */
class Mapper3 extends Mapper {
  constructor(cart) {
    super(cart);
    this.bank = 0;
  }

  writePrg(addr, val) {
    if (addr < 0x8000) {
      super.writePrg(addr, val);
      return;
    }
    this.bank = val;
  }

  readChr(addr) {
    return this.chr[(this.bank * 0x2000 + addr) % this.chr.length];
  }

  writeChr(addr, val) {
    if (this.chrIsRam) this.chr[(this.bank * 0x2000 + addr) % this.chr.length] = val;
  }
}

/*
 * Mapper 4 —— MMC3，最流行的高级 Mapper。
 *
 * 银行粒度细：PRG 按 8KB、CHR 按 1KB/2KB 切换，8 个内部寄存器 R0-R7：
 *   R0/R1 = 2KB CHR，R2-R5 = 1KB CHR，R6/R7 = 8KB PRG
 * $8000 偶地址写"银行选择"（低 3 位选 R几，bit6 PRG 布局，bit7 CHR 布局），
 * 奇地址写银行号。为效率这里预计算好 prgOffsets/chrOffsets 偏移表。
 *
 * 扫描线 IRQ：内部计数器每条渲染扫描线递减（真机由 PPU 地址线 A12
 * 上升沿驱动，本模拟器用 PPU 第 260 点近似），减到 0 且使能时拉 IRQ。
 * 游戏用它做状态栏分屏（如超马 3 底部的道具栏）。
 */
class Mapper4 extends Mapper {
  constructor(cart) {
    super(cart);
    this.regs = [0, 2, 4, 5, 6, 7, 0, 1];
    this.bankSelect = 0;
    this.prgMode = 0;
    this.chrMode = 0;
    this.irqLatch = 0;
    this.irqCounter = 0;
    this.irqEnabled = false;
    this.irqReload = false;
    this.prgOffsets = new Int32Array(4); // $8000/$A000/$C000/$E000 四个 8KB 槽
    this.chrOffsets = new Int32Array(8); // 8 个 1KB 槽
    this.updateBanks();
  }

  updateBanks() {
    const n8 = Math.max(1, this.prg.length >> 13);
    const n1 = Math.max(1, this.chr.length >> 10);
    const r = this.regs;
    const p = this.prgOffsets;
    const c = this.chrOffsets;
    const pb = x => (((x % n8) + n8) % n8) * 0x2000;
    const cb = x => (((x % n1) + n1) % n1) * 0x400;
    /* PRG 两种布局：R6 在 $8000 或与"倒数第二银行"对调（bit6） */
    if (this.prgMode === 0) {
      p[0] = pb(r[6]);
      p[1] = pb(r[7]);
      p[2] = (n8 - 2) * 0x2000;
      p[3] = (n8 - 1) * 0x2000;
    } else {
      p[0] = (n8 - 2) * 0x2000;
      p[1] = pb(r[7]);
      p[2] = pb(r[6]);
      p[3] = (n8 - 1) * 0x2000;
    }
    /* CHR 布局：2KB 组和 1KB 组可整体对调（bit7）；2KB 银行号强制偶数对齐 */
    if (this.chrMode === 0) {
      c[0] = cb(r[0] & 0xFE);
      c[1] = cb(r[0] | 1);
      c[2] = cb(r[1] & 0xFE);
      c[3] = cb(r[1] | 1);
      c[4] = cb(r[2]);
      c[5] = cb(r[3]);
      c[6] = cb(r[4]);
      c[7] = cb(r[5]);
    } else {
      c[0] = cb(r[2]);
      c[1] = cb(r[3]);
      c[2] = cb(r[4]);
      c[3] = cb(r[5]);
      c[4] = cb(r[0] & 0xFE);
      c[5] = cb(r[0] | 1);
      c[6] = cb(r[1] & 0xFE);
      c[7] = cb(r[1] | 1);
    }
  }

  /* 4 对寄存器按 (地址区间, 奇偶) 区分：$8000/$A000/$C000/$E000 × 偶/奇 */
  writePrg(addr, val) {
    if (addr < 0x8000) {
      super.writePrg(addr, val);
      return;
    }
    const even = (addr & 1) === 0;
    if (addr < 0xA000) {
      if (even) {
        this.bankSelect = val & 7;
        this.prgMode = (val >> 6) & 1;
        this.chrMode = (val >> 7) & 1;
      } else {
        this.regs[this.bankSelect] = val;
      }
      this.updateBanks();
    } else if (addr < 0xC000) {
      /* $A000 偶：镜像切换（四屏卡带除外）；$A001：PRG RAM 保护（忽略） */
      if (even && this.cart.mirror !== 4) this.mirror = (val & 1) ? 0 : 1;
    } else if (addr < 0xE000) {
      /* $C000：IRQ 重装值；$C001：下次时钟时重新装载 */
      if (even) {
        this.irqLatch = val;
      } else {
        this.irqCounter = 0;
        this.irqReload = true;
      }
    } else {
      /* $E000：关 IRQ 并清挂起；$E001：开 IRQ */
      if (even) {
        this.irqEnabled = false;
        this.irqPending = false;
      } else {
        this.irqEnabled = true;
      }
    }
  }

  readPrg(addr) {
    if (addr < 0x6000) return 0;
    if (addr < 0x8000) return this.prgRam[addr - 0x6000];
    const a = addr - 0x8000;
    return this.prg[this.prgOffsets[a >> 13] + (a & 0x1FFF)];
  }

  readChr(addr) {
    return this.chr[this.chrOffsets[addr >> 10] + (addr & 0x3FF)];
  }

  writeChr(addr, val) {
    if (this.chrIsRam) this.chr[this.chrOffsets[addr >> 10] + (addr & 0x3FF)] = val;
  }

  /* 每条渲染扫描线调用一次：计数到 0 且使能 → 请求 IRQ */
  ppuScanline() {
    if (this.irqCounter === 0 || this.irqReload) {
      this.irqCounter = this.irqLatch;
      this.irqReload = false;
    } else {
      this.irqCounter--;
    }
    if (this.irqCounter === 0 && this.irqEnabled) this.irqPending = true;
  }
}

/*
 * Mapper 7 —— AxROM：32KB PRG 整体切换；bit4 选择单屏镜像用哪一页
 * （许多游戏靠它实现全屏无缝滚动 + 状态栏）
 */
class Mapper7 extends Mapper {
  constructor(cart) {
    super(cart);
    this.bank = 0;
    this.mirror = 2;
  }

  writePrg(addr, val) {
    if (addr < 0x8000) {
      super.writePrg(addr, val);
      return;
    }
    this.bank = val & 7;
    this.mirror = (val & 0x10) ? 3 : 2;
  }

  readPrg(addr) {
    if (addr < 0x6000) return 0;
    if (addr < 0x8000) return this.prgRam[addr - 0x6000];
    return this.prg[(this.bank * 0x8000 + (addr - 0x8000)) % this.prg.length];
  }
}

/* Mapper 11 —— Color Dreams：低 2 位切 32KB PRG，高 4 位切 8KB CHR */
class Mapper11 extends Mapper {
  constructor(cart) {
    super(cart);
    this.prgBank = 0;
    this.chrBank = 0;
  }

  writePrg(addr, val) {
    if (addr < 0x8000) {
      super.writePrg(addr, val);
      return;
    }
    this.prgBank = val & 3;
    this.chrBank = (val >> 4) & 15;
  }

  readPrg(addr) {
    if (addr < 0x6000) return 0;
    if (addr < 0x8000) return this.prgRam[addr - 0x6000];
    return this.prg[(this.prgBank * 0x8000 + (addr - 0x8000)) % this.prg.length];
  }

  readChr(addr) {
    return this.chr[(this.chrBank * 0x2000 + addr) % this.chr.length];
  }

  writeChr(addr, val) {
    if (this.chrIsRam) this.chr[(this.chrBank * 0x2000 + addr) % this.chr.length] = val;
  }
}

/* Mapper 66 —— GxROM：与 11 类似，只是位段相反（高 2 位 PRG，低 2 位 CHR） */
class Mapper66 extends Mapper {
  constructor(cart) {
    super(cart);
    this.prgBank = 0;
    this.chrBank = 0;
  }

  writePrg(addr, val) {
    if (addr < 0x8000) {
      super.writePrg(addr, val);
      return;
    }
    this.prgBank = (val >> 4) & 3;
    this.chrBank = val & 3;
  }

  readPrg(addr) {
    if (addr < 0x6000) return 0;
    if (addr < 0x8000) return this.prgRam[addr - 0x6000];
    return this.prg[(this.prgBank * 0x8000 + (addr - 0x8000)) % this.prg.length];
  }

  readChr(addr) {
    return this.chr[(this.chrBank * 0x2000 + addr) % this.chr.length];
  }

  writeChr(addr, val) {
    if (this.chrIsRam) this.chr[(this.chrBank * 0x2000 + addr) % this.chr.length] = val;
  }
}

function createMapper(cart) {
  switch (cart.mapperNum) {
    case 0: return new Mapper(cart);
    case 1: return new Mapper1(cart);
    case 2: return new Mapper2(cart);
    case 3: return new Mapper3(cart);
    case 4: return new Mapper4(cart);
    case 7: return new Mapper7(cart);
    case 11: return new Mapper11(cart);
    case 66: return new Mapper66(cart);
    default: throw new Error("不支持的 Mapper " + cart.mapperNum);
  }
}
