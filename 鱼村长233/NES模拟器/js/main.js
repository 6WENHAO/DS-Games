/*
 * main.js —— UI 层：把模拟器核心接到浏览器
 *
 * 职责：
 *   画面：PPU 帧缓冲 → canvas（零拷贝共享 ImageData 内存）
 *   时序：requestAnimationFrame + 时间累加器，锁定 NTSC 的 60.0988 FPS
 *   声音：Web Audio ScriptProcessorNode 从 APU 环形缓冲拉取样本
 *   输入：键盘 + Gamepad API → 手柄移位寄存器
 *   其他：ROM 加载（文件选择/拖放）、电池存档持久化、截图、全屏
 */
"use strict";
(function () {
  const canvas = document.getElementById("screen");
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(256, 240);
  const screenWrap = document.getElementById("screenWrap");
  const dropHint = document.getElementById("dropHint");
  const romInput = document.getElementById("romInput");
  const btnPause = document.getElementById("btnPause");
  const btnReset = document.getElementById("btnReset");
  const btnShot = document.getElementById("btnShot");
  const btnFull = document.getElementById("btnFull");
  const volumeInput = document.getElementById("volume");
  const statusEl = document.getElementById("status");

  const nes = new NES();
  /*
   * 关键技巧：让 PPU 直接把像素写进 ImageData 的底层内存
   * （Uint32Array 视图，小端 ABGR），上屏只需一次 putImageData，无拷贝。
   */
  nes.ppu.framebuffer = new Uint32Array(imageData.data.buffer);
  nes.ppu.framebuffer.fill(0xFF000000);
  ctx.putImageData(imageData, 0, 0);

  /* 键位 → NES 按键序号（0-7 = A B Select Start 上 下 左 右） */
  const KEYMAP = {
    KeyX: 0, KeyK: 0,
    KeyZ: 1, KeyJ: 1,
    ShiftLeft: 2, ShiftRight: 2,
    Enter: 3,
    ArrowUp: 4, KeyW: 4,
    ArrowDown: 5, KeyS: 5,
    ArrowLeft: 6, KeyA: 6,
    ArrowRight: 7, KeyD: 7
  };

  /* 键盘与手柄各自独立记录，每帧合并，互不覆盖 */
  const keyState = new Uint8Array(8);
  const padState = new Uint8Array(8);

  const FRAME_MS = 1000 / 60.0988; // NTSC 帧率
  let romLoaded = false;
  let paused = false;
  let romName = "";
  let romHash = "";
  let accum = 0;
  let lastTs = 0;
  let fpsFrames = 0;
  let fpsLast = 0;
  let fpsVal = 0;

  let audioCtx = null;
  let scriptNode = null;
  let gainNode = null;

  /* 浏览器要求在用户手势中创建/恢复 AudioContext（选文件、按键都算） */
  function initAudio() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      nes.apu.setSampleRate(audioCtx.sampleRate);
      scriptNode = audioCtx.createScriptProcessor(2048, 0, 1);
      scriptNode.onaudioprocess = function (e) {
        nes.apu.readSamples(e.outputBuffer.getChannelData(0), paused || !romLoaded);
      };
      gainNode = audioCtx.createGain();
      applyVolume();
      scriptNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);
    } catch (e) {
      audioCtx = null;
    }
  }

  /* 平方曲线让滑块的听感更线性 */
  function applyVolume() {
    if (gainNode) {
      const v = volumeInput.value / 100;
      gainNode.gain.value = v * v;
    }
  }

  function updateStatus(msg, isError) {
    if (msg) {
      statusEl.textContent = msg;
      statusEl.classList.toggle("error", !!isError);
      return;
    }
    statusEl.classList.remove("error");
    if (!romLoaded) {
      statusEl.textContent = "未加载 ROM · 支持 Mapper 0 / 1 / 2 / 3 / 4 / 7 / 11 / 66";
      return;
    }
    const c = nes.cart;
    let text = romName + " · Mapper " + c.mapperNum +
      " · PRG " + (c.prg.length >> 10) + "KB / CHR " + (c.chr.length >> 10) + "KB";
    if (c.battery) text += " · 电池存档";
    text += " · " + fpsVal + " FPS";
    if (paused) text += " · 已暂停";
    statusEl.textContent = text;
  }

  function setButtonsEnabled(on) {
    btnPause.disabled = !on;
    btnReset.disabled = !on;
    btnShot.disabled = !on;
  }

  /* Uint8Array ↔ base64（localStorage 只能存字符串）；分块避免栈溢出 */
  function b64FromBytes(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 4096) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
    }
    return btoa(s);
  }

  function bytesFromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* 电池存档 = 卡带 $6000-$7FFF 的 PRG RAM，按 ROM 哈希分键存到 localStorage */
  function saveBattery() {
    if (!romLoaded || !nes.cart || !nes.cart.battery || !nes.mapper || !nes.mapper.ramDirty) return;
    try {
      localStorage.setItem("nes-save-" + romHash, b64FromBytes(nes.mapper.prgRam));
      nes.mapper.ramDirty = false;
    } catch (e) {}
  }

  function loadBattery() {
    if (!nes.cart.battery) return;
    try {
      const s = localStorage.getItem("nes-save-" + romHash);
      if (s) {
        const bytes = bytesFromB64(s);
        nes.mapper.prgRam.set(bytes.subarray(0, nes.mapper.prgRam.length));
      }
    } catch (e) {}
  }

  function loadROMFile(file) {
    const reader = new FileReader();
    reader.onload = function () {
      saveBattery(); // 换卡前先落盘旧游戏的进度
      try {
        const data = new Uint8Array(reader.result);
        nes.loadROM(data);
        romName = file.name.replace(/\.nes$/i, "");
        romHash = hashBytes(data);
        loadBattery();
        romLoaded = true;
        paused = false;
        accum = 0;
        btnPause.textContent = "暂停";
        setButtonsEnabled(true);
        dropHint.classList.add("hidden");
        initAudio();
        updateStatus();
      } catch (e) {
        updateStatus("加载失败: " + e.message, true);
      }
    };
    reader.onerror = function () {
      updateStatus("读取文件失败", true);
    };
    reader.readAsArrayBuffer(file);
  }

  function togglePause() {
    if (!romLoaded) return;
    paused = !paused;
    btnPause.textContent = paused ? "继续" : "暂停";
    updateStatus();
  }

  /* 每帧开始前把键盘和手柄（标准映射）的状态合并进 1P 手柄 */
  function pollInput() {
    padState.fill(0);
    if (navigator.getGamepads) {
      const pads = navigator.getGamepads();
      for (let g = 0; g < pads.length; g++) {
        const gp = pads[g];
        if (!gp || !gp.connected) continue;
        const b = gp.buttons;
        const ax = gp.axes;
        const pressed = i => !!(b[i] && b[i].pressed);
        if (pressed(0) || pressed(3)) padState[0] = 1;  // 下/上键位 → A
        if (pressed(1) || pressed(2)) padState[1] = 1;  // 右/左键位 → B
        if (pressed(8)) padState[2] = 1;                // Back/Share → Select
        if (pressed(9)) padState[3] = 1;                // Start/Options → Start
        if (pressed(12) || (ax.length > 1 && ax[1] < -0.5)) padState[4] = 1;
        if (pressed(13) || (ax.length > 1 && ax[1] > 0.5)) padState[5] = 1;
        if (pressed(14) || (ax.length > 0 && ax[0] < -0.5)) padState[6] = 1;
        if (pressed(15) || (ax.length > 0 && ax[0] > 0.5)) padState[7] = 1;
        break;
      }
    }
    for (let i = 0; i < 8; i++) {
      nes.controller1.buttons[i] = keyState[i] | padState[i];
    }
  }

  /*
   * 主循环：时间累加器保证平均帧率精确等于 NTSC 的 60.0988，
   * 与显示器刷新率（60/120/144Hz...）解耦；单次最多补 4 帧，
   * 防止切后台回来后"追帧雪崩"。
   */
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!romLoaded || paused) {
      lastTs = ts;
      return;
    }
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 250) dt = FRAME_MS;
    accum += dt;
    let ran = 0;
    while (accum >= FRAME_MS && ran < 4) {
      pollInput();
      nes.runFrame();
      accum -= FRAME_MS;
      ran++;
    }
    if (ran === 4) accum = 0;
    if (ran > 0) {
      ctx.putImageData(imageData, 0, 0);
      fpsFrames += ran;
    }
    if (ts - fpsLast >= 1000) {
      fpsVal = Math.round(fpsFrames * 1000 / (ts - fpsLast));
      fpsFrames = 0;
      fpsLast = ts;
      updateStatus();
    }
  }

  window.addEventListener("keydown", function (e) {
    if (e.code === "KeyP") {
      togglePause();
      e.preventDefault();
      return;
    }
    const btn = KEYMAP[e.code];
    if (btn !== undefined) {
      keyState[btn] = 1;
      e.preventDefault(); // 阻止方向键滚动页面
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    }
  });

  window.addEventListener("keyup", function (e) {
    const btn = KEYMAP[e.code];
    if (btn !== undefined) {
      keyState[btn] = 0;
      e.preventDefault();
    }
  });

  romInput.addEventListener("change", function () {
    if (romInput.files && romInput.files.length > 0) {
      loadROMFile(romInput.files[0]);
      romInput.value = ""; // 清空以便重复选择同一文件
    }
  });

  /* 拖放加载 ROM */
  ["dragover", "dragenter"].forEach(function (name) {
    window.addEventListener(name, function (e) {
      e.preventDefault();
      screenWrap.classList.add("dragging");
    });
  });

  ["dragleave", "dragend"].forEach(function (name) {
    window.addEventListener(name, function () {
      screenWrap.classList.remove("dragging");
    });
  });

  window.addEventListener("drop", function (e) {
    e.preventDefault();
    screenWrap.classList.remove("dragging");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      loadROMFile(e.dataTransfer.files[0]);
    }
  });

  btnPause.addEventListener("click", togglePause);

  btnReset.addEventListener("click", function () {
    if (!romLoaded) return;
    nes.reset();
    paused = false;
    btnPause.textContent = "暂停";
    updateStatus();
  });

  btnShot.addEventListener("click", function () {
    if (!romLoaded) return;
    const a = document.createElement("a");
    a.download = (romName || "nes") + ".png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  });

  btnFull.addEventListener("click", function () {
    if (screenWrap.requestFullscreen) screenWrap.requestFullscreen().catch(function () {});
  });

  volumeInput.addEventListener("input", applyVolume);

  /* 电池存档：每 3 秒检查一次是否有改动，页面关闭前强制保存 */
  setInterval(saveBattery, 3000);
  window.addEventListener("beforeunload", saveBattery);

  requestAnimationFrame(loop);
})();
