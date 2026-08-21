/**
 * 体素太空空间站 —— 环境音模块（ambience）
 * 纯 Web Audio API 程序化合成，不加载音频文件、零第三方依赖，原生 ES module。
 * 用法：import { createAmbience } from './ambience.js';
 *      button.addEventListener('click', async () => { await amb.enable(); }); // 需用户手势
 * 设计目标：「空间站内部」沉浸感——低频引擎轰鸣、金属壳体谐振、
 *           通风气流呼吸、偶发遥测滴答，叠加轻微混响统一声学空间。
 */

'use strict';

const NOISE_SECONDS = 2.5; // 循环噪声 buffer 时长（≥2s，避免可辨周期）
const IR_SECONDS = 1.8;    // 卷积混响脉冲响应时长
const WET_LEVEL = 0.22;    // 混响湿信号比例

/** 将任意值钳制到 [0, 1]。 @param {*} v @returns {number} */
function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** 生成双声道白噪声 buffer（共享循环噪声源）。 */
function createNoiseBuffer(ctx, seconds) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** 生成指数衰减噪声脉冲响应（立体声，供 ConvolverNode 做简易混响）。 */
function createImpulseResponse(ctx, seconds) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3); // 指数衰减包络
    }
  }
  return buffer;
}

/**
 * @typedef {Object} Ambience
 * @property {boolean} supported 浏览器是否支持 Web Audio。
 * @property {() => Promise<boolean>} enable 懒初始化并渐入播放（需用户手势，幂等）。
 * @property {() => void} disable 渐出 0.6s 后挂起，保留图结构以便再次 enable。
 * @property {boolean} enabled 是否启用（只读）。
 * @property {(v: number) => void} setMasterVolume 设置总音量 0..1，平滑过渡。
 * @property {(v: number) => void} setIntensity 设置厚重强度 0..1（低频层音量+低通截止）。
 * @property {() => void} click UI 点击音：约 40ms 高频衰减脉冲。
 * @property {() => void} select 选中舱段音：880Hz→1320Hz 上行琶音，带混响尾。
 * @property {(dir: number) => void} whoosh 扫频：dir=1 上扫（展开），dir=-1 下扫（收拢）。
 * @property {() => void} dispose 断开并关闭 AudioContext，释放资源。
 */

/** 创建环境音控制器。工厂不创建 AudioContext，由用户手势触发的 enable() 懒初始化。 @returns {Ambience} */
export function createAmbience() {
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  const supported = Boolean(AC);

  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {Object|null} 保存持续音源与总线节点，供 enable/disable 复用。 */
  let graph = null;
  let telemetryTimer = null;
  let suspendTimer = null;
  let disposed = false;
  let _enabled = false;
  let masterVolume = 0.6; // 缓存目标值，允许 enable 前调用 setter
  let intensity = 0;

  /* ------------------------------ 内部工具 ------------------------------ */

  /** 音频图是否可用且上下文正在运行。 */
  function ready() {
    return supported && ctx !== null && graph !== null && _enabled && ctx.state === 'running';
  }

  /** 平滑改变 AudioParam：先取消旧调度，再从当前值 setTargetAtTime 过渡，避免爆音。 */
  function rampParam(param, value, now, timeConstant) {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.setTargetAtTime(value, now, timeConstant);
  }

  /** 把缓存的 intensity 应用到低频引擎层（音量 + 低通截止）。 */
  function applyIntensity() {
    if (!graph) return;
    const tc = 0.12; // setTargetAtTime 时间常数，约 0.4s 完成过渡
    rampParam(graph.engine.gain.gain, 0.28 + 0.42 * intensity, ctx.currentTime, tc);
    rampParam(graph.engine.filter.frequency, 180 + 120 * intensity, ctx.currentTime, tc);
  }

  /* ------------------------------ 音频图构建 ------------------------------ */

  /** 构建完整音频图（仅 enable 首次调用时执行一次）。 */
  function buildGraph() {
    const g = {};
    // 总线：master 起播前静音，enable 时渐入
    g.masterGain = ctx.createGain();
    g.masterGain.gain.value = 0;
    g.busGain = ctx.createGain();
    g.busGain.gain.value = 1.0;
    // 温和总线压缩，避免多层叠加破音
    g.compressor = ctx.createDynamicsCompressor();
    g.compressor.threshold.value = -18;
    g.compressor.ratio.value = 3;
    g.compressor.knee.value = 12;
    g.compressor.attack.value = 0.005;
    g.compressor.release.value = 0.25;
    // 简易卷积混响（程序化脉冲响应），与干信号并联
    g.convolver = ctx.createConvolver();
    g.convolver.buffer = createImpulseResponse(ctx, IR_SECONDS);
    g.dryGain = ctx.createGain();
    g.dryGain.gain.value = 1 - WET_LEVEL;
    g.wetGain = ctx.createGain();
    g.wetGain.gain.value = WET_LEVEL;
    // 共享循环噪声源：壳体共鸣与通风气流共用
    g.noiseBuffer = createNoiseBuffer(ctx, NOISE_SECONDS);
    g.noiseSource = ctx.createBufferSource();
    g.noiseSource.buffer = g.noiseBuffer;
    g.noiseSource.loop = true;

    // 1) 低频引擎床：两个失谐振荡器 → lowpass → gain
    g.engine = {};
    g.engine.osc1 = ctx.createOscillator();
    g.engine.osc1.type = 'sawtooth';
    g.engine.osc1.frequency.value = 48;
    g.engine.osc2 = ctx.createOscillator();
    g.engine.osc2.type = 'triangle';
    g.engine.osc2.frequency.value = 48.6; // 与 48Hz 产生约 0.6Hz 缓慢拍频
    g.engine.filter = ctx.createBiquadFilter();
    g.engine.filter.type = 'lowpass';
    g.engine.filter.frequency.value = 180;
    g.engine.filter.Q.value = 0.5;
    g.engine.gain = ctx.createGain();
    g.engine.gain.gain.value = 0.28;
    g.engine.osc1.connect(g.engine.filter);
    g.engine.osc2.connect(g.engine.filter);
    g.engine.filter.connect(g.engine.gain);
    g.engine.gain.connect(g.busGain);

    // 2) 金属壳体共鸣：噪声经 3 个并联 bandpass，音量极低
    g.shell = { filters: [], gains: [], sum: ctx.createGain() };
    g.shell.sum.gain.value = 1.0;
    [220, 430, 930].forEach((freq) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 8;
      const level = ctx.createGain();
      level.gain.value = 0.035; // 极轻，仅作空间质感
      g.noiseSource.connect(bp);
      bp.connect(level);
      level.connect(g.shell.sum);
      g.shell.filters.push(bp);
      g.shell.gains.push(level);
    });
    g.shell.sum.connect(g.busGain);

    // 3) 通风气流：噪声经 highpass+lowpass，由 LFO 缓慢调制音量（呼吸感）
    g.vent = {};
    g.vent.hp = ctx.createBiquadFilter();
    g.vent.hp.type = 'highpass';
    g.vent.hp.frequency.value = 600;
    g.vent.lp = ctx.createBiquadFilter();
    g.vent.lp.type = 'lowpass';
    g.vent.lp.frequency.value = 4000;
    g.vent.gain = ctx.createGain();
    g.vent.gain.gain.value = 0.045;
    g.vent.lfo = ctx.createOscillator();
    g.vent.lfo.type = 'sine';
    g.vent.lfo.frequency.value = 0.08; // 0.05–0.12Hz
    g.vent.lfoGain = ctx.createGain();
    g.vent.lfoGain.gain.value = 0.02; // 围绕 0.045 做 ±0.02 缓慢起伏
    g.noiseSource.connect(g.vent.hp);
    g.vent.hp.connect(g.vent.lp);
    g.vent.lp.connect(g.vent.gain);
    g.vent.gain.connect(g.busGain);
    g.vent.lfo.connect(g.vent.lfoGain);
    g.vent.lfoGain.connect(g.vent.gain.gain);

    // 总线接线：bus → compressor → dry/wet 并联 → master → destination
    g.busGain.connect(g.compressor);
    g.compressor.connect(g.dryGain);
    g.compressor.connect(g.convolver);
    g.convolver.connect(g.wetGain);
    g.dryGain.connect(g.masterGain);
    g.wetGain.connect(g.masterGain);
    g.masterGain.connect(ctx.destination);

    g.noiseSource.start();
    g.engine.osc1.start();
    g.engine.osc2.start();
    g.vent.lfo.start();
    return g;
  }

  /* ------------------------------ 遥测滴答 ------------------------------ */

  /** 播放一次极轻的短促正弦滴答（随机频率、随机声道偏移）。 */
  function playTelemetryTick() {
    if (!ready()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800 + Math.random() * 800, now); // 1800–2600Hz
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.06, now + 0.004);  // 极轻
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.03); // 约 30ms 衰减
    const panner = (typeof ctx.createStereoPanner === 'function') ? ctx.createStereoPanner() : null;
    osc.connect(env);
    if (panner) {
      panner.pan.value = Math.random() * 2 - 1;
      env.connect(panner);
      panner.connect(graph.busGain);
    } else {
      env.connect(graph.busGain);
    }
    osc.start(now);
    osc.stop(now + 0.04);
    osc.onended = () => { osc.disconnect(); env.disconnect(); if (panner) panner.disconnect(); };
  }

  /** 随机间隔 4–11s 递归调度下一次滴答。 */
  function scheduleNextTick() {
    if (disposed || !_enabled || !graph) return;
    telemetryTimer = setTimeout(() => {
      telemetryTimer = null;
      if (disposed || !_enabled) return;
      playTelemetryTick();
      scheduleNextTick();
    }, 4000 + Math.random() * 7000);
  }

  /* ------------------------------ 公开 API ------------------------------ */

  return {
    supported,

    /** 懒初始化并开始播放（必须由用户手势调用）。 @returns {Promise<boolean>} */
    async enable() {
      if (disposed || !supported) return false;
      if (_enabled && ctx) { // 已启用：幂等，仅确保运行态
        try { await ctx.resume(); } catch { /* 忽略 */ }
        return true;
      }
      if (!ctx) { // 首次同步创建上下文与图（运行于手势内，满足自动播放策略）
        try {
          ctx = new AC();
          graph = buildGraph();
        } catch {
          ctx = null;
          graph = null;
          return false;
        }
      }
      try {
        await ctx.resume();
      } catch {
        return false;
      }
      _enabled = true;
      clearTimeout(suspendTimer);
      suspendTimer = null;
      const now = ctx.currentTime; // 渐入 2s
      graph.masterGain.gain.cancelScheduledValues(now);
      graph.masterGain.gain.setValueAtTime(graph.masterGain.gain.value, now);
      graph.masterGain.gain.linearRampToValueAtTime(masterVolume, now + 2.0);
      applyIntensity(); // 同步缓存的厚重强度
      clearTimeout(telemetryTimer);
      scheduleNextTick();
      return true;
    },

    /** 渐出 0.6s 后挂起，保留图结构。 @returns {void} */
    disable() {
      if (!_enabled || !graph) return;
      _enabled = false;
      clearTimeout(telemetryTimer);
      telemetryTimer = null;
      const now = ctx.currentTime;
      graph.masterGain.gain.cancelScheduledValues(now);
      graph.masterGain.gain.setValueAtTime(graph.masterGain.gain.value, now);
      graph.masterGain.gain.linearRampToValueAtTime(0, now + 0.6);
      clearTimeout(suspendTimer);
      suspendTimer = setTimeout(() => {
        suspendTimer = null;
        if (!_enabled && ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
      }, 650);
    },

    /** 是否启用（只读）。 */
    get enabled() {
      return _enabled;
    },

    /** 设置总音量 0..1，平滑过渡。 @param {number} v @returns {void} */
    setMasterVolume(v) {
      masterVolume = clamp01(v);
      if (graph) rampParam(graph.masterGain.gain, masterVolume, ctx.currentTime, 0.12);
    },

    /** 设置厚重强度 0..1。 @param {number} v @returns {void} */
    setIntensity(v) {
      intensity = clamp01(v);
      applyIntensity();
    },

    /** UI 点击音：约 40ms 高频衰减脉冲。 @returns {void} */
    click() {
      if (!ready()) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200, now);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.connect(env);
      env.connect(graph.busGain);
      osc.start(now);
      osc.stop(now + 0.05);
      osc.onended = () => { osc.disconnect(); env.disconnect(); };
    },

    /** 选中舱段音：880Hz→1320Hz 小上行琶音，带混响尾。 @returns {void} */
    select() {
      if (!ready()) return;
      const now = ctx.currentTime;
      [{ freq: 880, pan: -0.35, at: 0 }, { freq: 1320, pan: 0.35, at: 0.09 }]
        .forEach((note) => {
          const t = now + note.at;
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(note.freq, t);
          const env = ctx.createGain();
          env.gain.setValueAtTime(0.0001, t);
          env.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
          env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); // 尾音交由混响延展
          const panner = (typeof ctx.createStereoPanner === 'function') ? ctx.createStereoPanner() : null;
          osc.connect(env);
          if (panner) {
            panner.pan.value = note.pan;
            env.connect(panner);
            panner.connect(graph.busGain);
          } else {
            env.connect(graph.busGain);
          }
          osc.start(t);
          osc.stop(t + 0.25);
          osc.onended = () => { osc.disconnect(); env.disconnect(); if (panner) panner.disconnect(); };
        });
    },

    /** 装配/爆炸视图扫频：滤波白噪声约 0.9s。 @param {number} dir @returns {void} */
    whoosh(dir = 1) {
      if (!ready()) return;
      const now = ctx.currentTime;
      const up = Number(dir) >= 0;
      const src = ctx.createBufferSource();
      src.buffer = graph.noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(1.2, now);
      filter.frequency.setValueAtTime(up ? 240 : 2400, now);
      filter.frequency.exponentialRampToValueAtTime(up ? 2400 : 240, now + 0.9);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.22, now + 0.06);
      env.gain.setValueAtTime(0.22, now + 0.6); // 平台段
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      src.connect(filter);
      filter.connect(env);
      env.connect(graph.busGain);
      src.start(now);
      src.stop(now + 0.95);
      src.onended = () => { src.disconnect(); filter.disconnect(); env.disconnect(); };
    },

    /** 停止持续音源、断开并关闭 AudioContext。 @returns {void} */
    dispose() {
      if (disposed) return;
      disposed = true;
      _enabled = false;
      clearTimeout(telemetryTimer);
      clearTimeout(suspendTimer);
      telemetryTimer = null;
      suspendTimer = null;
      if (!ctx) return;
      const g = graph;
      if (g) {
        try { g.noiseSource.stop(); } catch { /* 忽略 */ }
        try { g.engine.osc1.stop(); } catch { /* 忽略 */ }
        try { g.engine.osc2.stop(); } catch { /* 忽略 */ }
        try { g.vent.lfo.stop(); } catch { /* 忽略 */ }
      }
      try { ctx.close().catch(() => {}); } catch { /* 忽略 */ }
      graph = null;
      ctx = null;
    },
  };
}
