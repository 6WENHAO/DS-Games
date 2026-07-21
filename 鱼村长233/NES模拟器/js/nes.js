/*
 * nes.js —— 主机：总线仲裁 + 各部件粘合 + 主同步循环
 *
 * CPU 内存映射（本文件 cpuRead/cpuWrite 的分发依据）：
 *   ┌───────────────┬────────────────────────────────────────┐
 *   │ $0000-$07FF   │ 2KB 内置 RAM                            │
 *   │ $0800-$1FFF   │ 上述 RAM 的镜像（地址线未接满）           │
 *   │ $2000-$2007   │ PPU 寄存器                              │
 *   │ $2008-$3FFF   │ PPU 寄存器镜像（每 8 字节重复）           │
 *   │ $4000-$4013   │ APU 通道寄存器                          │
 *   │ $4014         │ OAM DMA                                │
 *   │ $4015         │ APU 状态/通道使能                        │
 *   │ $4016         │ 手柄 1（写=锁存两个手柄）                 │
 *   │ $4017         │ 读=手柄 2 / 写=APU 帧计数器              │
 *   │ $4020-$5FFF   │ 扩展区（少数卡带使用，这里返回 0）         │
 *   │ $6000-$7FFF   │ 卡带 PRG RAM（电池存档）                  │
 *   │ $8000-$FFFF   │ 卡带 PRG ROM（经 Mapper 银行切换）        │
 *   └───────────────┴────────────────────────────────────────┘
 */
"use strict";
class NES {
  constructor() {
    this.ram = new Uint8Array(0x800);
    this.cpu = new CPU(this);
    this.ppu = new PPU(this);
    this.apu = new APU(this);
    this.controller1 = new Controller();
    this.controller2 = new Controller();
    this.mapper = null;
    this.cart = null;
  }

  loadROM(data) {
    const cart = parseINES(data);
    const mapper = createMapper(cart); // 可能抛"不支持的 Mapper"，此时保持旧状态
    this.cart = cart;
    this.mapper = mapper;
    this.reset();
  }

  reset() {
    this.ram.fill(0);
    this.ppu.reset();
    this.apu.reset();
    /* CPU 复位要从 $FFFC 读复位向量，必须等 mapper 就位后进行 */
    if (this.mapper) this.cpu.reset();
  }

  /* IRQ 是电平触发、多源共享一根线：APU 帧计数器 / DMC / Mapper（MMC3） */
  irqAsserted() {
    return this.apu.frameIRQ || this.apu.dmc.irq || (this.mapper !== null && this.mapper.irqPending);
  }

  cpuRead(addr) {
    addr &= 0xFFFF;
    if (addr < 0x2000) return this.ram[addr & 0x7FF];
    if (addr < 0x4000) return this.ppu.readRegister(addr & 7);
    if (addr === 0x4015) return this.apu.readStatus();
    /* 手柄读取只有 bit0 有效，高位是总线残留（多数游戏期望 0x40） */
    if (addr === 0x4016) return (this.controller1.read() & 1) | 0x40;
    if (addr === 0x4017) return (this.controller2.read() & 1) | 0x40;
    if (addr < 0x4020) return 0;
    return this.mapper.readPrg(addr);
  }

  cpuWrite(addr, val) {
    addr &= 0xFFFF;
    val &= 0xFF;
    if (addr < 0x2000) {
      this.ram[addr & 0x7FF] = val;
      return;
    }
    if (addr < 0x4000) {
      this.ppu.writeRegister(addr & 7, val);
      return;
    }
    if (addr === 0x4014) {
      /*
       * OAM DMA：把 $XX00-$XXFF 整页 256 字节拷入 PPU 的精灵表。
       * 游戏通常在 NMI 里每帧做一次（逐字节写 $2004 太慢）。
       * 真机会让 CPU 停 513 个周期（奇数周期启动再 +1）。
       */
      const base = val << 8;
      const oam = this.ppu.oam;
      const oamAddr = this.ppu.oamAddr;
      for (let i = 0; i < 256; i++) {
        oam[(oamAddr + i) & 0xFF] = this.cpuRead((base + i) & 0xFFFF);
      }
      this.cpu.stall += 513 + (this.cpu.totalCycles & 1);
      return;
    }
    if (addr === 0x4016) {
      this.controller1.write(val);
      this.controller2.write(val);
      return;
    }
    if (addr <= 0x4017) {
      this.apu.writeRegister(addr, val);
      return;
    }
    if (addr < 0x4020) return;
    this.mapper.writePrg(addr, val);
  }

  /*
   * 运行一帧：全机同步的核心。
   * 以 CPU 指令为最小步长——执行一条指令得到周期数 n，
   * 然后让 PPU 前进 3n 个点、APU 前进 n 个周期（硬件固定比例 1:3）。
   * PPU 扫到 (241,1) 进入 VBlank 时置 frameComplete，本帧结束。
   */
  runFrame() {
    this.ppu.frameComplete = false;
    while (!this.ppu.frameComplete) {
      const cycles = this.cpu.step();
      let dots = cycles * 3;
      while (dots-- > 0) this.ppu.tick();
      this.apu.step(cycles);
    }
  }
}
