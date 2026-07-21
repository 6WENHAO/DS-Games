/*
 * cpu.js —— 6502 CPU 模拟
 *
 * NES 的 CPU 是 Ricoh 2A03（NTSC 主频 1.789773 MHz），内部是一颗去掉了
 * 十进制模式的 MOS 6502 核心。6502 是 8 位 CPU，16 位地址总线（64KB 地址空间）。
 *
 * 寄存器：
 *   A     累加器（算术/逻辑运算的主角）
 *   X / Y 变址寄存器（用于变址寻址、计数）
 *   SP    栈指针，栈固定位于 $0100-$01FF，向下增长
 *   PC    程序计数器
 *   P     状态标志位：N(负) V(溢出) U(恒1) B(Break) D(十进制，NES 中无效) I(IRQ屏蔽) Z(零) C(进位)
 *
 * 模拟方式：查表解码。OP_TABLE 共 256 项，每项记录
 *   { fn: 执行函数, mode: 寻址方式, cycles: 基础周期, page: 跨页是否 +1 周期 }。
 * step() 执行一条完整指令并返回消耗的 CPU 周期数——这个返回值是全机同步的
 * 基准：主机(nes.js)用它推动 PPU（×3 个点）和 APU（×1 个周期）。
 * 周期计数的准确性直接决定游戏速度与各种光栅效果是否正确。
 */
"use strict";

/*
 * 13 种寻址方式（Addressing Mode）：
 *   M_IMP 隐含（操作数在指令里，如 CLC）      M_ACC 累加器（如 ASL A）
 *   M_IMM 立即数 #$xx                        M_ZP  零页 $xx（第 0 页，省 1 字节且更快）
 *   M_ZPX/M_ZPY 零页变址（在零页内回绕）      M_ABS 绝对 $xxxx
 *   M_ABX/M_ABY 绝对变址 $xxxx+X/Y           M_IND 间接（仅 JMP 使用）
 *   M_IZX 先变址后间接 ($xx,X)               M_IZY 先间接后变址 ($xx),Y
 *   M_REL 相对（仅分支指令，带符号 8 位偏移）
 */
const M_IMP = 0, M_ACC = 1, M_IMM = 2, M_ZP = 3, M_ZPX = 4, M_ZPY = 5,
  M_ABS = 6, M_ABX = 7, M_ABY = 8, M_IND = 9, M_IZX = 10, M_IZY = 11, M_REL = 12;

const OP_TABLE = new Array(256);

class CPU {
  constructor(nes) {
    this.nes = nes;
    this.a = 0;
    this.x = 0;
    this.y = 0;
    this.sp = 0xFD;
    this.pc = 0;
    /* 状态标志拆成独立字段存储（比合成一个字节再拆快得多） */
    this.c = 0;
    this.z = 0;
    this.i = 1;
    this.d = 0;
    this.v = 0;
    this.n = 0;
    this.nmiPending = false;   // PPU 进入 VBlank 时置位，下一条指令前响应
    this.stall = 0;            // OAM DMA 等造成的 CPU 停顿周期
    this.totalCycles = 0;
    this.extraCycles = 0;      // 当前指令的额外周期（跨页/分支命中）
  }

  /* 上电/复位：从复位向量 $FFFC 读取程序入口地址 */
  reset() {
    this.sp = 0xFD;
    this.i = 1;
    this.pc = this.read16(0xFFFC);
    this.nmiPending = false;
    this.stall = 0;
    this.totalCycles = 0;
  }

  /* 所有访存都走主机总线，由 nes.js 按内存映射分发到 RAM/PPU/APU/卡带 */
  read(addr) {
    return this.nes.cpuRead(addr);
  }

  write(addr, val) {
    this.nes.cpuWrite(addr, val);
  }

  /* 6502 是小端：低字节在前 */
  read16(addr) {
    return this.read(addr) | (this.read((addr + 1) & 0xFFFF) << 8);
  }

  /* 栈操作：栈页固定在 $0100-$01FF */
  push(val) {
    this.write(0x100 | this.sp, val & 0xFF);
    this.sp = (this.sp - 1) & 0xFF;
  }

  pull() {
    this.sp = (this.sp + 1) & 0xFF;
    return this.read(0x100 | this.sp);
  }

  push16(val) {
    this.push(val >> 8);
    this.push(val);
  }

  pull16() {
    const lo = this.pull();
    return lo | (this.pull() << 8);
  }

  /*
   * 合成状态字节。B 标志只存在于压入栈的副本中：
   * PHP/BRK 压栈时 B=1，IRQ/NMI 压栈时 B=0，bit5 恒为 1。
   */
  getP(brk) {
    return this.c | (this.z << 1) | (this.i << 2) | (this.d << 3) |
      (brk ? 0x30 : 0x20) | (this.v << 6) | (this.n << 7);
  }

  setP(val) {
    this.c = val & 1;
    this.z = (val >> 1) & 1;
    this.i = (val >> 2) & 1;
    this.d = (val >> 3) & 1;
    this.v = (val >> 6) & 1;
    this.n = (val >> 7) & 1;
  }

  /* 大多数指令都会根据结果更新 Z（结果为 0）和 N（结果 bit7） */
  setZN(val) {
    this.z = val === 0 ? 1 : 0;
    this.n = (val >> 7) & 1;
  }

  /* 分支命中：+1 周期；目标地址跨页：再 +1 周期 */
  branch(addr) {
    this.extraCycles += ((addr ^ this.pc) & 0xFF00) ? 2 : 1;
    this.pc = addr;
  }

  /* 中断响应：压入 PC 和状态字节，置 I 屏蔽后续 IRQ，跳到中断向量 */
  interrupt(vector) {
    this.push16(this.pc);
    this.push(this.getP(false));
    this.i = 1;
    this.pc = this.read16(vector);
  }

  /*
   * 执行一条指令，返回消耗的周期数。
   * 检查顺序：DMA 停顿 → NMI（不可屏蔽，向量 $FFFA）→ IRQ（受 I 屏蔽，向量 $FFFE）→ 取指执行。
   */
  step() {
    if (this.stall > 0) {
      const s = this.stall;
      this.stall = 0;
      this.totalCycles += s;
      return s;
    }
    if (this.nmiPending) {
      this.nmiPending = false;
      this.interrupt(0xFFFA);
      this.totalCycles += 7;
      return 7;
    }
    if (!this.i && this.nes.irqAsserted()) {
      this.interrupt(0xFFFE);
      this.totalCycles += 7;
      return 7;
    }
    const op = this.read(this.pc);
    this.pc = (this.pc + 1) & 0xFFFF;
    const inst = OP_TABLE[op];
    this.extraCycles = 0;
    /* 第一步：按寻址方式解析出操作数的有效地址 addr */
    let addr = 0;
    switch (inst.mode) {
      case M_IMM:
        /* 立即数：操作数就是 PC 指向的下一个字节，地址即当前 PC */
        addr = this.pc;
        this.pc = (this.pc + 1) & 0xFFFF;
        break;
      case M_ZP:
        addr = this.read(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;
        break;
      case M_ZPX:
        /* 零页变址在零页内回绕（& 0xFF），不会进位到第 1 页 */
        addr = (this.read(this.pc) + this.x) & 0xFF;
        this.pc = (this.pc + 1) & 0xFFFF;
        break;
      case M_ZPY:
        addr = (this.read(this.pc) + this.y) & 0xFF;
        this.pc = (this.pc + 1) & 0xFFFF;
        break;
      case M_ABS:
        addr = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xFFFF;
        break;
      case M_ABX: {
        /* 变址结果跨过 256 字节页边界时，读类指令要多花 1 个周期 */
        const base = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xFFFF;
        addr = (base + this.x) & 0xFFFF;
        if (inst.page && ((base ^ addr) & 0xFF00)) this.extraCycles = 1;
        break;
      }
      case M_ABY: {
        const base = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xFFFF;
        addr = (base + this.y) & 0xFFFF;
        if (inst.page && ((base ^ addr) & 0xFF00)) this.extraCycles = 1;
        break;
      }
      case M_IND: {
        /*
         * JMP ($xxxx) 复刻 6502 的著名硬件 bug：
         * 当指针低字节为 $FF 时，高字节并不从下一页读取，
         * 而是回绕到同一页的开头（如 ($02FF) 读 $02FF 和 $0200）。
         */
        const ptr = this.read16(this.pc);
        this.pc = (this.pc + 2) & 0xFFFF;
        addr = this.read(ptr) | (this.read((ptr & 0xFF00) | ((ptr + 1) & 0xFF)) << 8);
        break;
      }
      case M_IZX: {
        /* ($xx,X)：零页地址先加 X，再从零页读出 16 位有效地址 */
        const zp = (this.read(this.pc) + this.x) & 0xFF;
        this.pc = (this.pc + 1) & 0xFFFF;
        addr = this.read(zp) | (this.read((zp + 1) & 0xFF) << 8);
        break;
      }
      case M_IZY: {
        /* ($xx),Y：先从零页读出 16 位基址，再加 Y；跨页 +1 周期 */
        const zp = this.read(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;
        const base = this.read(zp) | (this.read((zp + 1) & 0xFF) << 8);
        addr = (base + this.y) & 0xFFFF;
        if (inst.page && ((base ^ addr) & 0xFF00)) this.extraCycles = 1;
        break;
      }
      case M_REL: {
        /* 分支偏移是带符号 8 位数，相对于分支指令之后的 PC */
        let off = this.read(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;
        if (off & 0x80) off -= 256;
        addr = (this.pc + off) & 0xFFFF;
        break;
      }
    }
    /* 第二步：执行指令语义 */
    inst.fn.call(this, addr, inst.mode);
    const cycles = inst.cycles + this.extraCycles;
    this.totalCycles += cycles;
    return cycles;
  }

  /*
   * 加法核心（ADC/SBC 共用）。
   * 溢出标志 V 的含义：两个同号数相加得到异号结果（有符号溢出）。
   * 判断式：两操作数符号相同(~(a^m) bit7) 且 结果与 a 符号不同((a^r) bit7)。
   */
  adcVal(m) {
    const r = this.a + m + this.c;
    this.v = (~(this.a ^ m) & (this.a ^ r) & 0x80) ? 1 : 0;
    this.c = r > 0xFF ? 1 : 0;
    this.a = r & 0xFF;
    this.setZN(this.a);
  }

  /* 比较：reg - m，只更新标志不写回。C = 无借位（reg >= m） */
  cmpVal(reg, m) {
    this.c = reg >= m ? 1 : 0;
    this.setZN((reg - m) & 0xFF);
  }

  op_adc(a) { this.adcVal(this.read(a)); }
  /* SBC 即 A - M - (1-C)，数学上等价于 A + ~M + C，直接复用加法 */
  op_sbc(a) { this.adcVal(this.read(a) ^ 0xFF); }
  op_and(a) { this.a &= this.read(a); this.setZN(this.a); }
  op_ora(a) { this.a |= this.read(a); this.setZN(this.a); }
  op_eor(a) { this.a ^= this.read(a); this.setZN(this.a); }
  op_lda(a) { this.a = this.read(a); this.setZN(this.a); }
  op_ldx(a) { this.x = this.read(a); this.setZN(this.x); }
  op_ldy(a) { this.y = this.read(a); this.setZN(this.y); }
  op_sta(a) { this.write(a, this.a); }
  op_stx(a) { this.write(a, this.x); }
  op_sty(a) { this.write(a, this.y); }
  op_tax() { this.x = this.a; this.setZN(this.x); }
  op_tay() { this.y = this.a; this.setZN(this.y); }
  op_txa() { this.a = this.x; this.setZN(this.a); }
  op_tya() { this.a = this.y; this.setZN(this.a); }
  op_tsx() { this.x = this.sp; this.setZN(this.x); }
  op_txs() { this.sp = this.x; }
  op_inx() { this.x = (this.x + 1) & 0xFF; this.setZN(this.x); }
  op_iny() { this.y = (this.y + 1) & 0xFF; this.setZN(this.y); }
  op_dex() { this.x = (this.x - 1) & 0xFF; this.setZN(this.x); }
  op_dey() { this.y = (this.y - 1) & 0xFF; this.setZN(this.y); }
  op_inc(a) { const m = (this.read(a) + 1) & 0xFF; this.write(a, m); this.setZN(m); }
  op_dec(a) { const m = (this.read(a) - 1) & 0xFF; this.write(a, m); this.setZN(m); }

  /* 移位指令要区分累加器模式（ASL A）和内存模式（读-改-写） */
  op_asl(a, mode) {
    if (mode === M_ACC) {
      this.c = this.a >> 7;
      this.a = (this.a << 1) & 0xFF;
      this.setZN(this.a);
    } else {
      let m = this.read(a);
      this.c = m >> 7;
      m = (m << 1) & 0xFF;
      this.write(a, m);
      this.setZN(m);
    }
  }

  op_lsr(a, mode) {
    if (mode === M_ACC) {
      this.c = this.a & 1;
      this.a >>= 1;
      this.setZN(this.a);
    } else {
      let m = this.read(a);
      this.c = m & 1;
      m >>= 1;
      this.write(a, m);
      this.setZN(m);
    }
  }

  /* 循环移位：旧的进位从另一端补入 */
  op_rol(a, mode) {
    if (mode === M_ACC) {
      const c = this.a >> 7;
      this.a = ((this.a << 1) | this.c) & 0xFF;
      this.c = c;
      this.setZN(this.a);
    } else {
      let m = this.read(a);
      const c = m >> 7;
      m = ((m << 1) | this.c) & 0xFF;
      this.c = c;
      this.write(a, m);
      this.setZN(m);
    }
  }

  op_ror(a, mode) {
    if (mode === M_ACC) {
      const c = this.a & 1;
      this.a = (this.a >> 1) | (this.c << 7);
      this.c = c;
      this.setZN(this.a);
    } else {
      let m = this.read(a);
      const c = m & 1;
      m = (m >> 1) | (this.c << 7);
      this.c = c;
      this.write(a, m);
      this.setZN(m);
    }
  }

  op_cmp(a) { this.cmpVal(this.a, this.read(a)); }
  op_cpx(a) { this.cmpVal(this.x, this.read(a)); }
  op_cpy(a) { this.cmpVal(this.y, this.read(a)); }

  /* BIT：Z = A&M 是否为 0，N/V 直接取内存的 bit7/bit6（常用于轮询 PPU 状态） */
  op_bit(a) {
    const m = this.read(a);
    this.z = (this.a & m) === 0 ? 1 : 0;
    this.v = (m >> 6) & 1;
    this.n = (m >> 7) & 1;
  }

  op_jmp(a) { this.pc = a; }
  /* JSR 压入的是返回地址减 1，RTS 弹出后会 +1，这是 6502 的约定 */
  op_jsr(a) { this.push16((this.pc - 1) & 0xFFFF); this.pc = a; }
  op_rts() { this.pc = (this.pull16() + 1) & 0xFFFF; }
  op_rti() { this.setP(this.pull()); this.pc = this.pull16(); }

  /* BRK 是 2 字节指令（第二字节被跳过），压栈后经 IRQ 向量进入处理程序 */
  op_brk() {
    this.pc = (this.pc + 1) & 0xFFFF;
    this.push16(this.pc);
    this.push(this.getP(true));
    this.i = 1;
    this.pc = this.read16(0xFFFE);
  }

  op_pha() { this.push(this.a); }
  op_php() { this.push(this.getP(true)); }
  op_pla() { this.a = this.pull(); this.setZN(this.a); }
  op_plp() { this.setP(this.pull()); }
  op_clc() { this.c = 0; }
  op_sec() { this.c = 1; }
  op_cli() { this.i = 0; }
  op_sei() { this.i = 1; }
  op_cld() { this.d = 0; }
  op_sed() { this.d = 1; }
  op_clv() { this.v = 0; }
  op_bcc(a) { if (!this.c) this.branch(a); }
  op_bcs(a) { if (this.c) this.branch(a); }
  op_bne(a) { if (!this.z) this.branch(a); }
  op_beq(a) { if (this.z) this.branch(a); }
  op_bpl(a) { if (!this.n) this.branch(a); }
  op_bmi(a) { if (this.n) this.branch(a); }
  op_bvc(a) { if (!this.v) this.branch(a); }
  op_bvs(a) { if (this.v) this.branch(a); }
  op_nop() {}

  /*
   * 以下是"非官方指令"（未在官方文档中，但硬件上真实存在的组合行为）。
   * 不少游戏和测试 ROM 会用到，实现它们能显著提升兼容性：
   *   LAX = LDA + LDX          SAX = 存 A&X
   *   DCP = DEC + CMP          ISB = INC + SBC
   *   SLO = ASL + ORA          RLA = ROL + AND
   *   SRE = LSR + EOR          RRA = ROR + ADC
   */
  op_lax(a) { this.a = this.x = this.read(a); this.setZN(this.a); }
  op_sax(a) { this.write(a, this.a & this.x); }
  op_dcp(a) { const m = (this.read(a) - 1) & 0xFF; this.write(a, m); this.cmpVal(this.a, m); }
  op_isb(a) { const m = (this.read(a) + 1) & 0xFF; this.write(a, m); this.adcVal(m ^ 0xFF); }

  op_slo(a) {
    let m = this.read(a);
    this.c = m >> 7;
    m = (m << 1) & 0xFF;
    this.write(a, m);
    this.a |= m;
    this.setZN(this.a);
  }

  op_rla(a) {
    let m = this.read(a);
    const c = m >> 7;
    m = ((m << 1) | this.c) & 0xFF;
    this.c = c;
    this.write(a, m);
    this.a &= m;
    this.setZN(this.a);
  }

  op_sre(a) {
    let m = this.read(a);
    this.c = m & 1;
    m >>= 1;
    this.write(a, m);
    this.a ^= m;
    this.setZN(this.a);
  }

  op_rra(a) {
    let m = this.read(a);
    const c = m & 1;
    m = (m >> 1) | (this.c << 7);
    this.c = c;
    this.write(a, m);
    this.adcVal(m);
  }

  op_anc(a) { this.a &= this.read(a); this.setZN(this.a); this.c = this.n; }
  op_alr(a) { this.a &= this.read(a); this.c = this.a & 1; this.a >>= 1; this.setZN(this.a); }

  op_arr(a) {
    this.a = ((this.a & this.read(a)) >> 1) | (this.c << 7);
    this.setZN(this.a);
    this.c = (this.a >> 6) & 1;
    this.v = ((this.a >> 6) ^ (this.a >> 5)) & 1;
  }

  op_axs(a) {
    const m = this.read(a);
    const t = (this.a & this.x) - m;
    this.c = t >= 0 ? 1 : 0;
    this.x = t & 0xFF;
    this.setZN(this.x);
  }
}

/*
 * 构建 256 项操作码表。
 * def(操作码, 指令名, 寻址方式, 基础周期, 跨页是否+1)
 * 周期数来自 6502 官方文档；写类指令（STA 等）跨页不加周期，
 * 读-改-写指令（ASL/INC 等）使用固定的较长周期。
 */
(function buildOpTable() {
  function def(op, name, mode, cycles, page) {
    OP_TABLE[op] = { fn: CPU.prototype["op_" + name], mode, cycles, page: page || 0 };
  }

  /* ---- 官方指令（151 条）---- */
  def(0x00, "brk", M_IMP, 7); def(0x01, "ora", M_IZX, 6); def(0x05, "ora", M_ZP, 3); def(0x06, "asl", M_ZP, 5);
  def(0x08, "php", M_IMP, 3); def(0x09, "ora", M_IMM, 2); def(0x0A, "asl", M_ACC, 2); def(0x0D, "ora", M_ABS, 4);
  def(0x0E, "asl", M_ABS, 6); def(0x10, "bpl", M_REL, 2); def(0x11, "ora", M_IZY, 5, 1); def(0x15, "ora", M_ZPX, 4);
  def(0x16, "asl", M_ZPX, 6); def(0x18, "clc", M_IMP, 2); def(0x19, "ora", M_ABY, 4, 1); def(0x1D, "ora", M_ABX, 4, 1);
  def(0x1E, "asl", M_ABX, 7); def(0x20, "jsr", M_ABS, 6); def(0x21, "and", M_IZX, 6); def(0x24, "bit", M_ZP, 3);
  def(0x25, "and", M_ZP, 3); def(0x26, "rol", M_ZP, 5); def(0x28, "plp", M_IMP, 4); def(0x29, "and", M_IMM, 2);
  def(0x2A, "rol", M_ACC, 2); def(0x2C, "bit", M_ABS, 4); def(0x2D, "and", M_ABS, 4); def(0x2E, "rol", M_ABS, 6);
  def(0x30, "bmi", M_REL, 2); def(0x31, "and", M_IZY, 5, 1); def(0x35, "and", M_ZPX, 4); def(0x36, "rol", M_ZPX, 6);
  def(0x38, "sec", M_IMP, 2); def(0x39, "and", M_ABY, 4, 1); def(0x3D, "and", M_ABX, 4, 1); def(0x3E, "rol", M_ABX, 7);
  def(0x40, "rti", M_IMP, 6); def(0x41, "eor", M_IZX, 6); def(0x45, "eor", M_ZP, 3); def(0x46, "lsr", M_ZP, 5);
  def(0x48, "pha", M_IMP, 3); def(0x49, "eor", M_IMM, 2); def(0x4A, "lsr", M_ACC, 2); def(0x4C, "jmp", M_ABS, 3);
  def(0x4D, "eor", M_ABS, 4); def(0x4E, "lsr", M_ABS, 6); def(0x50, "bvc", M_REL, 2); def(0x51, "eor", M_IZY, 5, 1);
  def(0x55, "eor", M_ZPX, 4); def(0x56, "lsr", M_ZPX, 6); def(0x58, "cli", M_IMP, 2); def(0x59, "eor", M_ABY, 4, 1);
  def(0x5D, "eor", M_ABX, 4, 1); def(0x5E, "lsr", M_ABX, 7); def(0x60, "rts", M_IMP, 6); def(0x61, "adc", M_IZX, 6);
  def(0x65, "adc", M_ZP, 3); def(0x66, "ror", M_ZP, 5); def(0x68, "pla", M_IMP, 4); def(0x69, "adc", M_IMM, 2);
  def(0x6A, "ror", M_ACC, 2); def(0x6C, "jmp", M_IND, 5); def(0x6D, "adc", M_ABS, 4); def(0x6E, "ror", M_ABS, 6);
  def(0x70, "bvs", M_REL, 2); def(0x71, "adc", M_IZY, 5, 1); def(0x75, "adc", M_ZPX, 4); def(0x76, "ror", M_ZPX, 6);
  def(0x78, "sei", M_IMP, 2); def(0x79, "adc", M_ABY, 4, 1); def(0x7D, "adc", M_ABX, 4, 1); def(0x7E, "ror", M_ABX, 7);
  def(0x81, "sta", M_IZX, 6); def(0x84, "sty", M_ZP, 3); def(0x85, "sta", M_ZP, 3); def(0x86, "stx", M_ZP, 3);
  def(0x88, "dey", M_IMP, 2); def(0x8A, "txa", M_IMP, 2); def(0x8C, "sty", M_ABS, 4); def(0x8D, "sta", M_ABS, 4);
  def(0x8E, "stx", M_ABS, 4); def(0x90, "bcc", M_REL, 2); def(0x91, "sta", M_IZY, 6); def(0x94, "sty", M_ZPX, 4);
  def(0x95, "sta", M_ZPX, 4); def(0x96, "stx", M_ZPY, 4); def(0x98, "tya", M_IMP, 2); def(0x99, "sta", M_ABY, 5);
  def(0x9A, "txs", M_IMP, 2); def(0x9D, "sta", M_ABX, 5); def(0xA0, "ldy", M_IMM, 2); def(0xA1, "lda", M_IZX, 6);
  def(0xA2, "ldx", M_IMM, 2); def(0xA4, "ldy", M_ZP, 3); def(0xA5, "lda", M_ZP, 3); def(0xA6, "ldx", M_ZP, 3);
  def(0xA8, "tay", M_IMP, 2); def(0xA9, "lda", M_IMM, 2); def(0xAA, "tax", M_IMP, 2); def(0xAC, "ldy", M_ABS, 4);
  def(0xAD, "lda", M_ABS, 4); def(0xAE, "ldx", M_ABS, 4); def(0xB0, "bcs", M_REL, 2); def(0xB1, "lda", M_IZY, 5, 1);
  def(0xB4, "ldy", M_ZPX, 4); def(0xB5, "lda", M_ZPX, 4); def(0xB6, "ldx", M_ZPY, 4); def(0xB8, "clv", M_IMP, 2);
  def(0xB9, "lda", M_ABY, 4, 1); def(0xBA, "tsx", M_IMP, 2); def(0xBC, "ldy", M_ABX, 4, 1); def(0xBD, "lda", M_ABX, 4, 1);
  def(0xBE, "ldx", M_ABY, 4, 1); def(0xC0, "cpy", M_IMM, 2); def(0xC1, "cmp", M_IZX, 6); def(0xC4, "cpy", M_ZP, 3);
  def(0xC5, "cmp", M_ZP, 3); def(0xC6, "dec", M_ZP, 5); def(0xC8, "iny", M_IMP, 2); def(0xC9, "cmp", M_IMM, 2);
  def(0xCA, "dex", M_IMP, 2); def(0xCC, "cpy", M_ABS, 4); def(0xCD, "cmp", M_ABS, 4); def(0xCE, "dec", M_ABS, 6);
  def(0xD0, "bne", M_REL, 2); def(0xD1, "cmp", M_IZY, 5, 1); def(0xD5, "cmp", M_ZPX, 4); def(0xD6, "dec", M_ZPX, 6);
  def(0xD8, "cld", M_IMP, 2); def(0xD9, "cmp", M_ABY, 4, 1); def(0xDD, "cmp", M_ABX, 4, 1); def(0xDE, "dec", M_ABX, 7);
  def(0xE0, "cpx", M_IMM, 2); def(0xE1, "sbc", M_IZX, 6); def(0xE4, "cpx", M_ZP, 3); def(0xE5, "sbc", M_ZP, 3);
  def(0xE6, "inc", M_ZP, 5); def(0xE8, "inx", M_IMP, 2); def(0xE9, "sbc", M_IMM, 2); def(0xEA, "nop", M_IMP, 2);
  def(0xEC, "cpx", M_ABS, 4); def(0xED, "sbc", M_ABS, 4); def(0xEE, "inc", M_ABS, 6); def(0xF0, "beq", M_REL, 2);
  def(0xF1, "sbc", M_IZY, 5, 1); def(0xF5, "sbc", M_ZPX, 4); def(0xF6, "inc", M_ZPX, 6); def(0xF8, "sed", M_IMP, 2);
  def(0xF9, "sbc", M_ABY, 4, 1); def(0xFD, "sbc", M_ABX, 4, 1); def(0xFE, "inc", M_ABX, 7);

  /* ---- 非官方 NOP（消耗操作数但什么都不做）---- */
  [0x1A, 0x3A, 0x5A, 0x7A, 0xDA, 0xFA].forEach(op => def(op, "nop", M_IMP, 2));
  [0x80, 0x82, 0x89, 0xC2, 0xE2].forEach(op => def(op, "nop", M_IMM, 2));
  [0x04, 0x44, 0x64].forEach(op => def(op, "nop", M_ZP, 3));
  [0x14, 0x34, 0x54, 0x74, 0xD4, 0xF4].forEach(op => def(op, "nop", M_ZPX, 4));
  def(0x0C, "nop", M_ABS, 4);
  [0x1C, 0x3C, 0x5C, 0x7C, 0xDC, 0xFC].forEach(op => def(op, "nop", M_ABX, 4, 1));

  /* ---- 常用非官方指令 ---- */
  def(0xA3, "lax", M_IZX, 6); def(0xA7, "lax", M_ZP, 3); def(0xAF, "lax", M_ABS, 4);
  def(0xB3, "lax", M_IZY, 5, 1); def(0xB7, "lax", M_ZPY, 4); def(0xBF, "lax", M_ABY, 4, 1);
  def(0x83, "sax", M_IZX, 6); def(0x87, "sax", M_ZP, 3); def(0x8F, "sax", M_ABS, 4); def(0x97, "sax", M_ZPY, 4);
  def(0xEB, "sbc", M_IMM, 2);
  def(0xC3, "dcp", M_IZX, 8); def(0xC7, "dcp", M_ZP, 5); def(0xCF, "dcp", M_ABS, 6); def(0xD3, "dcp", M_IZY, 8);
  def(0xD7, "dcp", M_ZPX, 6); def(0xDB, "dcp", M_ABY, 7); def(0xDF, "dcp", M_ABX, 7);
  def(0xE3, "isb", M_IZX, 8); def(0xE7, "isb", M_ZP, 5); def(0xEF, "isb", M_ABS, 6); def(0xF3, "isb", M_IZY, 8);
  def(0xF7, "isb", M_ZPX, 6); def(0xFB, "isb", M_ABY, 7); def(0xFF, "isb", M_ABX, 7);
  def(0x03, "slo", M_IZX, 8); def(0x07, "slo", M_ZP, 5); def(0x0F, "slo", M_ABS, 6); def(0x13, "slo", M_IZY, 8);
  def(0x17, "slo", M_ZPX, 6); def(0x1B, "slo", M_ABY, 7); def(0x1F, "slo", M_ABX, 7);
  def(0x23, "rla", M_IZX, 8); def(0x27, "rla", M_ZP, 5); def(0x2F, "rla", M_ABS, 6); def(0x33, "rla", M_IZY, 8);
  def(0x37, "rla", M_ZPX, 6); def(0x3B, "rla", M_ABY, 7); def(0x3F, "rla", M_ABX, 7);
  def(0x43, "sre", M_IZX, 8); def(0x47, "sre", M_ZP, 5); def(0x4F, "sre", M_ABS, 6); def(0x53, "sre", M_IZY, 8);
  def(0x57, "sre", M_ZPX, 6); def(0x5B, "sre", M_ABY, 7); def(0x5F, "sre", M_ABX, 7);
  def(0x63, "rra", M_IZX, 8); def(0x67, "rra", M_ZP, 5); def(0x6F, "rra", M_ABS, 6); def(0x73, "rra", M_IZY, 8);
  def(0x77, "rra", M_ZPX, 6); def(0x7B, "rra", M_ABY, 7); def(0x7F, "rra", M_ABX, 7);
  def(0x0B, "anc", M_IMM, 2); def(0x2B, "anc", M_IMM, 2); def(0x4B, "alr", M_IMM, 2);
  def(0x6B, "arr", M_IMM, 2); def(0xCB, "axs", M_IMM, 2);
  def(0x9C, "nop", M_ABX, 5); def(0x9E, "nop", M_ABY, 5); def(0x9F, "nop", M_ABY, 5);
  def(0x93, "nop", M_IZY, 6); def(0x9B, "nop", M_ABY, 5); def(0xBB, "nop", M_ABY, 4, 1);
  def(0x8B, "nop", M_IMM, 2);

  /* 其余未定义的操作码（KIL/JAM 等）一律当作 NOP，避免运行到时卡死 */
  for (let i = 0; i < 256; i++) {
    if (!OP_TABLE[i]) def(i, "nop", M_IMP, 2);
    if (typeof OP_TABLE[i].fn !== "function") throw new Error("invalid opcode entry " + i);
  }
})();
