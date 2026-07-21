/*
 * apu.js —— APU（Audio Processing Unit）模拟
 *
 * APU 集成在 2A03 CPU 芯片内部，共 5 个声音通道：
 *   Pulse ×2  方波（旋律/和声），带音量包络、扫频、长度计数器
 *   Triangle  三角波（低音），带线性计数器 + 长度计数器双重门控
 *   Noise     噪声（打击乐），15 位线性反馈移位寄存器（LFSR）
 *   DMC       增量调制采样通道（语音/鼓点），直接从 CPU 内存读样本
 *
 * 模拟流程：
 *   1. APU.step(cycles) 与 CPU 严格同步，每个 CPU 周期推进各通道的分频器
 *   2. 帧计数器（Frame Counter）以约 240Hz 驱动包络/线性计数器（1/4 帧），
 *      以约 120Hz 驱动长度计数器/扫频（1/2 帧）
 *   3. 按 CPU主频/采样率 的比值抽取输出样本，经非线性混音进入环形缓冲
 *   4. main.js 的 Web Audio 回调从环形缓冲取样本送往声卡
 */
"use strict";

/* 长度计数器查表：写入通道寄存器 3 的高 5 位作为索引，决定音符持续时长 */
const LENGTH_TABLE = [
  10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14,
  12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30
];

/* 方波的 4 种占空比波形：12.5% / 25% / 50% / 75%（反相 25%） */
const DUTY_TABLE = [
  [0, 1, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 0, 0, 0],
  [1, 0, 0, 1, 1, 1, 1, 1]
];

/* 噪声通道 16 档周期（NTSC，单位：CPU 周期） */
const NOISE_PERIODS = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];

/* DMC 16 档播放速率（NTSC，单位：CPU 周期/位） */
const DMC_RATES = [428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54];

/* 三角波 32 步输出序列：15→0 再 0→15，天然是三角形 */
const TRIANGLE_SEQ = [
  15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
];

/*
 * 方波通道。输出频率 = CPU时钟 / (16 × (period+1))。
 * 包络（envelope）：可选的 15→0 自动音量衰减，loop 位控制循环。
 * 扫频（sweep）：周期性地把音高向上/向下滑（马里奥吃金币的"叮"声尾音）。
 */
class Pulse {
  constructor(channel) {
    this.channel = channel; // 1 或 2：两个通道的扫频取反行为差 1（见 sweepTarget）
    this.enabled = false;
    this.duty = 0;
    this.dutyPos = 0;
    this.lengthCounter = 0;
    this.lengthHalt = false;
    this.constantVolume = false;
    this.volume = 0;
    this.envStart = false;
    this.envDivider = 0;
    this.envVolume = 0;
    this.sweepEnabled = false;
    this.sweepPeriod = 0;
    this.sweepNegate = false;
    this.sweepShift = 0;
    this.sweepDivider = 0;
    this.sweepReload = false;
    this.timer = 0;
    this.timerPeriod = 0;
  }

  /* $4015 使能位清零时，长度计数器立即归零（通道静音） */
  setEnabled(on) {
    this.enabled = on;
    if (!on) this.lengthCounter = 0;
  }

  /* $4000/$4004：占空比 | 长度暂停(兼包络循环) | 恒定音量开关 | 音量/包络周期 */
  write0(v) {
    this.duty = v >> 6;
    this.lengthHalt = (v & 0x20) !== 0;
    this.constantVolume = (v & 0x10) !== 0;
    this.volume = v & 15;
  }

  /* $4001/$4005：扫频单元配置 */
  write1(v) {
    this.sweepEnabled = (v & 0x80) !== 0;
    this.sweepPeriod = (v >> 4) & 7;
    this.sweepNegate = (v & 8) !== 0;
    this.sweepShift = v & 7;
    this.sweepReload = true;
  }

  /* $4002/$4006：11 位周期的低 8 位 */
  write2(v) {
    this.timerPeriod = (this.timerPeriod & 0x700) | v;
  }

  /* $4003/$4007：周期高 3 位 + 装载长度计数器；写入会重置相位并重启包络 */
  write3(v) {
    this.timerPeriod = (this.timerPeriod & 0xFF) | ((v & 7) << 8);
    if (this.enabled) this.lengthCounter = LENGTH_TABLE[v >> 3];
    this.dutyPos = 0;
    this.envStart = true;
  }

  /* 方波定时器每 2 个 CPU 周期（1 个 APU 周期）时钟一次，推进 8 步占空比序列 */
  stepTimer() {
    if (this.timer === 0) {
      this.timer = this.timerPeriod;
      this.dutyPos = (this.dutyPos + 1) & 7;
    } else {
      this.timer--;
    }
  }

  /* 1/4 帧时钟：包络分频器走一步，音量从 15 递减，可循环 */
  stepEnvelope() {
    if (this.envStart) {
      this.envStart = false;
      this.envVolume = 15;
      this.envDivider = this.volume;
    } else if (this.envDivider === 0) {
      this.envDivider = this.volume;
      if (this.envVolume > 0) this.envVolume--;
      else if (this.lengthHalt) this.envVolume = 15;
    } else {
      this.envDivider--;
    }
  }

  /* 扫频目标周期 = 当前周期 ± (当前周期 >> shift)；
     通道 1 的取反是反码（多减 1），通道 2 是补码——硬件的历史差异 */
  sweepTarget() {
    const delta = this.timerPeriod >> this.sweepShift;
    if (this.sweepNegate) return this.timerPeriod - delta - (this.channel === 1 ? 1 : 0);
    return this.timerPeriod + delta;
  }

  /* 1/2 帧时钟：扫频分频器到期时应用目标周期 */
  stepSweep() {
    if (this.sweepDivider === 0 && this.sweepEnabled && this.sweepShift > 0) {
      const target = this.sweepTarget();
      if (this.timerPeriod >= 8 && target >= 0 && target <= 0x7FF) this.timerPeriod = target;
    }
    if (this.sweepDivider === 0 || this.sweepReload) {
      this.sweepDivider = this.sweepPeriod;
      this.sweepReload = false;
    } else {
      this.sweepDivider--;
    }
  }

  /* 1/2 帧时钟：长度计数器递减，到 0 静音（除非 halt） */
  stepLength() {
    if (!this.lengthHalt && this.lengthCounter > 0) this.lengthCounter--;
  }

  /* 当前瞬时输出（0-15）。静音条件：未使能 / 长度耗尽 / 周期过小(超声) / 扫频目标溢出 */
  output() {
    if (!this.enabled || this.lengthCounter === 0 || this.timerPeriod < 8) return 0;
    if (this.sweepTarget() > 0x7FF) return 0;
    if (!DUTY_TABLE[this.duty][this.dutyPos]) return 0;
    return this.constantVolume ? this.volume : this.envVolume;
  }
}

/*
 * 三角波通道。定时器每个 CPU 周期时钟一次（是方波的两倍分辨率），
 * 输出频率 = CPU时钟 / (32 × (period+1))。
 * 没有音量控制——要么放要么停，靠线性计数器实现短促的音头。
 */
class Triangle {
  constructor() {
    this.enabled = false;
    this.control = false; // 兼作长度计数器 halt 和线性计数器控制位
    this.lengthCounter = 0;
    this.linearCounter = 0;
    this.linearReload = 0;
    this.linearReloadFlag = false;
    this.timer = 0;
    this.timerPeriod = 0;
    this.seqPos = 0;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.lengthCounter = 0;
  }

  write0(v) {
    this.control = (v & 0x80) !== 0;
    this.linearReload = v & 0x7F;
  }

  write2(v) {
    this.timerPeriod = (this.timerPeriod & 0x700) | v;
  }

  write3(v) {
    this.timerPeriod = (this.timerPeriod & 0xFF) | ((v & 7) << 8);
    if (this.enabled) this.lengthCounter = LENGTH_TABLE[v >> 3];
    this.linearReloadFlag = true;
  }

  /* 两个计数器都非零才推进波形；period<2 时不推进（滤掉超声频率，防爆音） */
  stepTimer() {
    if (this.timer === 0) {
      this.timer = this.timerPeriod;
      if (this.lengthCounter > 0 && this.linearCounter > 0 && this.timerPeriod >= 2) {
        this.seqPos = (this.seqPos + 1) & 31;
      }
    } else {
      this.timer--;
    }
  }

  /* 1/4 帧时钟：线性计数器（比长度计数器更细粒度的门控） */
  stepLinear() {
    if (this.linearReloadFlag) this.linearCounter = this.linearReload;
    else if (this.linearCounter > 0) this.linearCounter--;
    if (!this.control) this.linearReloadFlag = false;
  }

  stepLength() {
    if (!this.control && this.lengthCounter > 0) this.lengthCounter--;
  }

  /* 停止时保持在当前台阶（而不是跳回 0），避免输出直流突变产生咔哒声 */
  output() {
    return TRIANGLE_SEQ[this.seqPos];
  }
}

/*
 * 噪声通道。核心是 15 位 LFSR 伪随机序列发生器：
 * 每次时钟 bit0 ^ bit1（或 mode=1 时 bit0 ^ bit6，产生周期性"金属"音色）
 * 作为反馈填入 bit14。输出取决于 bit0。
 */
class Noise {
  constructor() {
    this.enabled = false;
    this.lengthCounter = 0;
    this.lengthHalt = false;
    this.constantVolume = false;
    this.volume = 0;
    this.envStart = false;
    this.envDivider = 0;
    this.envVolume = 0;
    this.mode = false;
    this.timer = 0;
    this.timerPeriod = NOISE_PERIODS[0];
    this.lfsr = 1; // 上电不为 0（全 0 会让 LFSR 卡死）
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.lengthCounter = 0;
  }

  write0(v) {
    this.lengthHalt = (v & 0x20) !== 0;
    this.constantVolume = (v & 0x10) !== 0;
    this.volume = v & 15;
  }

  write2(v) {
    this.mode = (v & 0x80) !== 0;
    this.timerPeriod = NOISE_PERIODS[v & 15];
  }

  write3(v) {
    if (this.enabled) this.lengthCounter = LENGTH_TABLE[v >> 3];
    this.envStart = true;
  }

  stepTimer() {
    if (this.timer === 0) {
      this.timer = this.timerPeriod;
      const feedback = (this.lfsr & 1) ^ ((this.lfsr >> (this.mode ? 6 : 1)) & 1);
      this.lfsr = (this.lfsr >> 1) | (feedback << 14);
    } else {
      this.timer--;
    }
  }

  stepEnvelope() {
    if (this.envStart) {
      this.envStart = false;
      this.envVolume = 15;
      this.envDivider = this.volume;
    } else if (this.envDivider === 0) {
      this.envDivider = this.volume;
      if (this.envVolume > 0) this.envVolume--;
      else if (this.lengthHalt) this.envVolume = 15;
    } else {
      this.envDivider--;
    }
  }

  stepLength() {
    if (!this.lengthHalt && this.lengthCounter > 0) this.lengthCounter--;
  }

  output() {
    if (!this.enabled || this.lengthCounter === 0 || (this.lfsr & 1)) return 0;
    return this.constantVolume ? this.volume : this.envVolume;
  }
}

/*
 * DMC（Delta Modulation Channel）：1 位增量调制采样播放。
 * 样本存放在卡带 ROM（$C000 起，地址到 $FFFF 后回绕到 $8000），
 * 每个字节含 8 个 1 位增量：1 → 输出电平 +2，0 → -2（范围 0-127）。
 * 也可通过 $4011 直接写 7 位电平（很多游戏用它播 PCM 鼓点）。
 * 播完可循环或触发 IRQ（供游戏做音频驱动的定时）。
 */
class DMC {
  constructor(nes) {
    this.nes = nes; // 需要经总线从 CPU 地址空间读样本
    this.irqEnabled = false;
    this.loop = false;
    this.ratePeriod = DMC_RATES[0];
    this.timer = DMC_RATES[0];
    this.outputLevel = 0;
    this.sampleAddr = 0xC000;
    this.sampleLen = 1;
    this.curAddr = 0xC000;
    this.bytesRemaining = 0;
    this.shifter = 0;
    this.bitsRemaining = 8;
    this.silence = true;
    this.sampleBuffer = 0;
    this.bufferEmpty = true;
    this.irq = false;
  }

  write0(v) {
    this.irqEnabled = (v & 0x80) !== 0;
    this.loop = (v & 0x40) !== 0;
    this.ratePeriod = DMC_RATES[v & 15];
    if (!this.irqEnabled) this.irq = false;
  }

  write1(v) {
    this.outputLevel = v & 0x7F;
  }

  /* 样本地址寄存器：实际地址 = $C000 + 值×64 */
  write2(v) {
    this.sampleAddr = 0xC000 | (v << 6);
  }

  /* 样本长度寄存器：实际字节数 = 值×16 + 1 */
  write3(v) {
    this.sampleLen = (v << 4) | 1;
  }

  setEnabled(on) {
    if (on) {
      if (this.bytesRemaining === 0) {
        this.curAddr = this.sampleAddr;
        this.bytesRemaining = this.sampleLen;
      }
      this.fill();
    } else {
      this.bytesRemaining = 0;
    }
  }

  /* 样本缓冲空了就从内存取下一个字节（真机此时会偷 CPU 周期，这里省略） */
  fill() {
    if (this.bufferEmpty && this.bytesRemaining > 0) {
      this.sampleBuffer = this.nes.cpuRead(this.curAddr);
      this.bufferEmpty = false;
      this.curAddr = this.curAddr === 0xFFFF ? 0x8000 : this.curAddr + 1;
      this.bytesRemaining--;
      if (this.bytesRemaining === 0) {
        if (this.loop) {
          this.curAddr = this.sampleAddr;
          this.bytesRemaining = this.sampleLen;
        } else if (this.irqEnabled) {
          this.irq = true;
        }
      }
    }
  }

  stepTimer() {
    if (--this.timer <= 0) {
      this.timer = this.ratePeriod;
      if (!this.silence) {
        if (this.shifter & 1) {
          if (this.outputLevel <= 125) this.outputLevel += 2;
        } else if (this.outputLevel >= 2) {
          this.outputLevel -= 2;
        }
      }
      this.shifter >>= 1;
      if (--this.bitsRemaining <= 0) {
        this.bitsRemaining = 8;
        if (this.bufferEmpty) {
          this.silence = true;
        } else {
          this.silence = false;
          this.shifter = this.sampleBuffer;
          this.bufferEmpty = true;
          this.fill();
        }
      }
    }
  }
}

class APU {
  constructor(nes) {
    this.nes = nes;
    /* 单生产者/单消费者环形缓冲：模拟线程写入，音频回调读取 */
    this.buffer = new Float32Array(65536);
    this.bufW = 0;
    this.bufR = 0;
    this.lastSample = 0;
    this.sampleRate = 44100;
    this.cyclesPerSample = 1789773 / 44100;
    this.reset();
  }

  reset() {
    this.pulse1 = new Pulse(1);
    this.pulse2 = new Pulse(2);
    this.triangle = new Triangle();
    this.noise = new Noise();
    this.dmc = new DMC(this.nes);
    this.frameIRQ = false;
    this.frameMode = 0;     // 0 = 4 步模式（可产生 IRQ），1 = 5 步模式
    this.irqInhibit = false;
    this.frameCycle = 0;
    this.evenCycle = false;
    this.sampleTimer = 0;
    this.hpIn = 0;          // 高通滤波器状态
    this.hpOut = 0;
    this.bufW = 0;
    this.bufR = 0;
    this.lastSample = 0;
  }

  /* 采样率由实际创建的 AudioContext 决定（通常 44100/48000） */
  setSampleRate(rate) {
    this.sampleRate = rate;
    this.cyclesPerSample = 1789773 / rate;
  }

  writeRegister(addr, v) {
    switch (addr) {
      case 0x4000: this.pulse1.write0(v); break;
      case 0x4001: this.pulse1.write1(v); break;
      case 0x4002: this.pulse1.write2(v); break;
      case 0x4003: this.pulse1.write3(v); break;
      case 0x4004: this.pulse2.write0(v); break;
      case 0x4005: this.pulse2.write1(v); break;
      case 0x4006: this.pulse2.write2(v); break;
      case 0x4007: this.pulse2.write3(v); break;
      case 0x4008: this.triangle.write0(v); break;
      case 0x400A: this.triangle.write2(v); break;
      case 0x400B: this.triangle.write3(v); break;
      case 0x400C: this.noise.write0(v); break;
      case 0x400E: this.noise.write2(v); break;
      case 0x400F: this.noise.write3(v); break;
      case 0x4010: this.dmc.write0(v); break;
      case 0x4011: this.dmc.write1(v); break;
      case 0x4012: this.dmc.write2(v); break;
      case 0x4013: this.dmc.write3(v); break;
      case 0x4015:
        /* 通道使能总开关；写入还会清除 DMC IRQ */
        this.pulse1.setEnabled((v & 1) !== 0);
        this.pulse2.setEnabled((v & 2) !== 0);
        this.triangle.setEnabled((v & 4) !== 0);
        this.noise.setEnabled((v & 8) !== 0);
        this.dmc.setEnabled((v & 0x10) !== 0);
        this.dmc.irq = false;
        break;
      case 0x4017:
        /* 帧计数器配置：bit7 选模式，bit6 屏蔽帧 IRQ；
           切到 5 步模式会立即产生一次 1/4+1/2 帧时钟 */
        this.frameMode = (v >> 7) & 1;
        this.irqInhibit = (v & 0x40) !== 0;
        if (this.irqInhibit) this.frameIRQ = false;
        this.frameCycle = 0;
        if (this.frameMode) {
          this.clockQuarter();
          this.clockHalf();
        }
        break;
    }
  }

  /* $4015 读：各通道长度计数器状态 + IRQ 标志；读取会清除帧 IRQ */
  readStatus() {
    let r = 0;
    if (this.pulse1.lengthCounter > 0) r |= 1;
    if (this.pulse2.lengthCounter > 0) r |= 2;
    if (this.triangle.lengthCounter > 0) r |= 4;
    if (this.noise.lengthCounter > 0) r |= 8;
    if (this.dmc.bytesRemaining > 0) r |= 0x10;
    if (this.frameIRQ) r |= 0x40;
    if (this.dmc.irq) r |= 0x80;
    this.frameIRQ = false;
    return r;
  }

  /* 1/4 帧时钟（约 240Hz）：包络 + 三角波线性计数器 */
  clockQuarter() {
    this.pulse1.stepEnvelope();
    this.pulse2.stepEnvelope();
    this.triangle.stepLinear();
    this.noise.stepEnvelope();
  }

  /* 1/2 帧时钟（约 120Hz）：长度计数器 + 扫频 */
  clockHalf() {
    this.pulse1.stepLength();
    this.pulse1.stepSweep();
    this.pulse2.stepLength();
    this.pulse2.stepSweep();
    this.triangle.stepLength();
    this.noise.stepLength();
  }

  /*
   * 帧计数器序列（数值为 CPU 周期，NTSC）：
   *   4 步模式：7457 / 14913 / 22371 / 29829（末步可触发 IRQ），周期 29830
   *   5 步模式：7457 / 14913 / 22371 / 37281，周期 37282，无 IRQ
   */
  stepFrameCounter() {
    this.frameCycle++;
    if (this.frameMode === 0) {
      switch (this.frameCycle) {
        case 7457: this.clockQuarter(); break;
        case 14913: this.clockQuarter(); this.clockHalf(); break;
        case 22371: this.clockQuarter(); break;
        case 29829:
          this.clockQuarter();
          this.clockHalf();
          if (!this.irqInhibit) this.frameIRQ = true;
          break;
        case 29830: this.frameCycle = 0; break;
      }
    } else {
      switch (this.frameCycle) {
        case 7457: this.clockQuarter(); break;
        case 14913: this.clockQuarter(); this.clockHalf(); break;
        case 22371: this.clockQuarter(); break;
        case 37281: this.clockQuarter(); this.clockHalf(); break;
        case 37282: this.frameCycle = 0; break;
      }
    }
  }

  /* 与 CPU 同步推进：方波每 2 个 CPU 周期时钟一次，其余每周期一次 */
  step(cycles) {
    for (let i = 0; i < cycles; i++) {
      this.evenCycle = !this.evenCycle;
      if (this.evenCycle) {
        this.pulse1.stepTimer();
        this.pulse2.stepTimer();
      }
      this.triangle.stepTimer();
      this.noise.stepTimer();
      this.dmc.stepTimer();
      this.stepFrameCounter();
      /* 按比值抽样：cyclesPerSample ≈ 1789773/44100 ≈ 40.6 个 CPU 周期出一个样本 */
      this.sampleTimer++;
      if (this.sampleTimer >= this.cyclesPerSample) {
        this.sampleTimer -= this.cyclesPerSample;
        this.emitSample();
      }
    }
  }

  /*
   * 混音采用 NESdev 给出的非线性近似公式（真机是电阻网络混音，非线性）：
   *   pulse_out = 95.88 / (8128/(p1+p2) + 100)
   *   tnd_out   = 159.79 / (1/(t/8227 + n/12241 + d/22638) + 100)
   * 输出前经一阶高通滤波去除直流偏置（原始输出恒为正值）。
   */
  emitSample() {
    const p = this.pulse1.output() + this.pulse2.output();
    const pulseOut = p > 0 ? 95.88 / (8128 / p + 100) : 0;
    const tnd = this.triangle.output() / 8227 + this.noise.output() / 12241 + this.dmc.outputLevel / 22638;
    const tndOut = tnd > 0 ? 159.79 / (1 / tnd + 100) : 0;
    const x = pulseOut + tndOut;
    let s = x - this.hpIn + 0.9955 * this.hpOut;
    this.hpIn = x;
    this.hpOut = s;
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    if (this.bufW - this.bufR < 65536) {
      this.buffer[this.bufW & 65535] = s;
      this.bufW++;
    }
  }

  /* 音频回调：从环形缓冲取样本；缓冲欠载时让最后的样本指数衰减，避免爆音 */
  readSamples(out, muted) {
    for (let i = 0; i < out.length; i++) {
      if (!muted && this.bufR < this.bufW) {
        this.lastSample = this.buffer[this.bufR & 65535];
        this.bufR++;
      } else {
        this.lastSample *= 0.995;
      }
      out[i] = this.lastSample;
    }
  }
}
