/* ============================================================
   textures.js — procedural canvas textures (no external assets)
   Recreates the iconic Backrooms surfaces.
   ============================================================ */
(function () {
  const BR = (window.BR = window.BR || {});

  function makeCanvas(size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  }

  // deterministic-ish noise helpers
  function rnd(a) { return Math.random() * a; }

  function toTexture(canvas, repeat) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    return t;
  }

  // ---- 1. Yellow mono wallpaper (Level 0) ----
  function wallpaper() {
    const s = 512, c = makeCanvas(s), g = c.getContext("2d");
    // base mustard yellow
    g.fillStyle = "#c3b048";
    g.fillRect(0, 0, s, s);
    // subtle vertical tonal stripes (old wallpaper)
    for (let x = 0; x < s; x += 8) {
      const shade = 8 * Math.sin(x * 0.12);
      g.fillStyle = `rgba(${90 + shade},${80 + shade},20,0.10)`;
      g.fillRect(x, 0, 4, s);
    }
    // faint damask-ish repeating motif
    g.strokeStyle = "rgba(120,108,40,0.15)";
    g.lineWidth = 2;
    for (let y = 0; y < s; y += 64) {
      for (let x = 0; x < s; x += 64) {
        g.beginPath();
        g.arc(x + 32, y + 32, 14, 0, Math.PI * 2);
        g.stroke();
      }
    }
    // grain / noise
    const img = g.getImageData(0, 0, s, s), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.4;
    }
    g.putImageData(img, 0, 0);
    // damp darker patches near bottom (stains)
    for (let k = 0; k < 26; k++) {
      const x = rnd(s), y = s * 0.55 + rnd(s * 0.45), r = 20 + rnd(70);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(60,52,18,0.22)");
      grad.addColorStop(1, "rgba(60,52,18,0)");
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // baseboard line at bottom
    g.fillStyle = "rgba(40,36,14,0.5)";
    g.fillRect(0, s - 10, s, 10);
    return toTexture(c);
  }

  // ---- 2. Moist yellow carpet floor ----
  function carpet() {
    const s = 512, c = makeCanvas(s), g = c.getContext("2d");
    g.fillStyle = "#9a8c3a";
    g.fillRect(0, 0, s, s);
    // fibrous noise
    const img = g.getImageData(0, 0, s, s), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 60;
      d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.5;
    }
    g.putImageData(img, 0, 0);
    // directional fiber streaks
    g.globalAlpha = 0.06;
    for (let k = 0; k < 3000; k++) {
      g.strokeStyle = Math.random() > 0.5 ? "#c9bd6a" : "#584f1e";
      g.beginPath();
      const x = rnd(s), y = rnd(s);
      g.moveTo(x, y); g.lineTo(x + rnd(6) - 3, y + rnd(6));
      g.stroke();
    }
    g.globalAlpha = 1;
    // moist dark damp patches
    for (let k = 0; k < 14; k++) {
      const x = rnd(s), y = rnd(s), r = 30 + rnd(90);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(35,30,10,0.35)");
      grad.addColorStop(1, "rgba(35,30,10,0)");
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return toTexture(c);
  }

  // ---- 3. Ceiling acoustic tiles ----
  function ceiling() {
    const s = 512, c = makeCanvas(s), g = c.getContext("2d");
    g.fillStyle = "#c9c2a0";
    g.fillRect(0, 0, s, s);
    // speckle (acoustic dots)
    for (let k = 0; k < 9000; k++) {
      g.fillStyle = Math.random() > 0.5 ? "rgba(150,145,120,0.5)" : "rgba(220,215,190,0.5)";
      g.fillRect(rnd(s), rnd(s), 1.5, 1.5);
    }
    // tile grid lines (2x2 tiles per texture)
    g.strokeStyle = "rgba(70,66,50,0.55)";
    g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      g.beginPath(); g.moveTo(i * s / 2, 0); g.lineTo(i * s / 2, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * s / 2); g.lineTo(s, i * s / 2); g.stroke();
    }
    // yellowish water stains
    for (let k = 0; k < 6; k++) {
      const x = rnd(s), y = rnd(s), r = 20 + rnd(50);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(150,130,50,0.3)");
      grad.addColorStop(1, "rgba(150,130,50,0)");
      g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return toTexture(c);
  }

  // ---- 4. Fluorescent light panel (emissive) ----
  function lightPanel() {
    const s = 128, c = makeCanvas(s), g = c.getContext("2d");
    g.fillStyle = "#fffdf0"; g.fillRect(0, 0, s, s);
    g.strokeStyle = "rgba(180,180,150,0.5)"; g.lineWidth = 4;
    g.strokeRect(2, 2, s - 4, s - 4);
    // grid of light diffuser
    g.strokeStyle = "rgba(200,200,170,0.4)"; g.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      g.beginPath(); g.moveTo(i * s / 5, 0); g.lineTo(i * s / 5, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * s / 5); g.lineTo(s, i * s / 5); g.stroke();
    }
    return toTexture(c);
  }

  // ---- 5. Concrete (Level 1 parking garage) ----
  function concrete() {
    const s = 512, c = makeCanvas(s), g = c.getContext("2d");
    g.fillStyle = "#6f6f6a"; g.fillRect(0, 0, s, s);
    const img = g.getImageData(0, 0, s, s), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 40;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    for (let k = 0; k < 18; k++) {
      const x = rnd(s), y = rnd(s), r = 20 + rnd(60);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(30,30,28,0.25)");
      grad.addColorStop(1, "rgba(30,30,28,0)");
      g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // cracks
    g.strokeStyle = "rgba(20,20,18,0.5)"; g.lineWidth = 1;
    for (let k = 0; k < 8; k++) {
      g.beginPath();
      let x = rnd(s), y = rnd(s);
      g.moveTo(x, y);
      for (let j = 0; j < 8; j++) { x += rnd(40) - 20; y += rnd(40) - 20; g.lineTo(x, y); }
      g.stroke();
    }
    return toTexture(c);
  }

  // ---- 6. Smiler entity face ----
  function smilerFace() {
    const s = 256, c = makeCanvas(s), g = c.getContext("2d");
    g.clearRect(0, 0, s, s);
    // dark body blob
    const grad = g.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s / 2);
    grad.addColorStop(0, "rgba(6,8,6,1)");
    grad.addColorStop(0.7, "rgba(4,6,4,0.95)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
    // glowing eyes
    g.fillStyle = "#eef7c8";
    g.shadowColor = "#dfffa0"; g.shadowBlur = 24;
    g.beginPath(); g.ellipse(s * 0.36, s * 0.42, 12, 8, -0.3, 0, 7); g.fill();
    g.beginPath(); g.ellipse(s * 0.64, s * 0.42, 12, 8, 0.3, 0, 7); g.fill();
    // wide grin of many teeth
    g.strokeStyle = "#eef7c8"; g.lineWidth = 9; g.lineCap = "round";
    g.beginPath(); g.arc(s / 2, s * 0.5, s * 0.28, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.shadowBlur = 0;
    // teeth gaps
    g.strokeStyle = "rgba(4,6,4,1)"; g.lineWidth = 4;
    for (let i = 0; i <= 10; i++) {
      const a = (0.18 + i * 0.064) * Math.PI;
      const r1 = s * 0.24, r2 = s * 0.32;
      g.beginPath();
      g.moveTo(s / 2 + Math.cos(a) * r1, s * 0.5 + Math.sin(a) * r1);
      g.lineTo(s / 2 + Math.cos(a) * r2, s * 0.5 + Math.sin(a) * r2);
      g.stroke();
    }
    return toTexture(c);
  }

  // ---- 7. Radial glow sprite ----
  function glow(colorInner, colorOuter) {
    const s = 128, c = makeCanvas(s), g = c.getContext("2d");
    const grad = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    grad.addColorStop(0, colorInner || "rgba(255,255,255,0.9)");
    grad.addColorStop(0.4, colorOuter || "rgba(160,200,255,0.35)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    return toTexture(c);
  }

  BR.Textures = { wallpaper, carpet, ceiling, lightPanel, concrete, smilerFace, glow };
})();
