/* tex.js — SVG 写实贴图管线:字符串 SVG → Blob → Image → canvas → CanvasTexture(POT + mipmap)
   每种材质由分层 SVG 生成:albedo / height(→normal) / roughness / emissive */
window.G = window.G || {};
(function () {
  const U = G.U;
  const T = { t: {}, all: [] };
  G.TEX = T;

  /* ================= 管线核心 ================= */
  function svgCanvas(svg, w, h) {
    return new Promise((res, rej) => {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { const { cv, ctx } = U.makeCanvas(w, h); ctx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); res(cv); };
      img.onerror = () => rej(new Error('SVG 光栅化失败'));
      img.src = url;
    });
  }
  function mkTex(cv, o) {
    o = o || {};
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = o.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = o.nomip ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = !o.nomip;
    if (o.srgb !== false) t.encoding = THREE.sRGBEncoding;
    T.all.push(t);
    return t;
  }
  async function tex(svg, w, h, o) { return mkTex(await svgCanvas(svg, w, h), o); }
  T.applyAniso = function (renderer) {
    const a = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    for (const t of T.all) { t.anisotropy = a; t.needsUpdate = true; }
  };
  T.cloneTex = function (t, rx, ry, ox, oy) {
    const c = t.clone(); c.needsUpdate = true;
    c.repeat.set(rx, ry); if (ox != null) c.offset.set(ox, oy);
    T.all.push(c); return c;
  };

  /* 高度图 canvas → 法线贴图 canvas(wrap 采样保持无缝) */
  function normalFrom(cv, strength) {
    const w = cv.width, h = cv.height;
    const src = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const { cv: out, ctx } = U.makeCanvas(w, h);
    const dst = ctx.createImageData(w, h);
    const d = dst.data;
    const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = (H(x - 1, y) - H(x + 1, y)) * strength / 255;
      const ny = (H(x, y + 1) - H(x, y - 1)) * strength / 255;
      const l = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y * w + x) * 4;
      d[i] = (nx * l * 0.5 + 0.5) * 255; d[i + 1] = (ny * l * 0.5 + 0.5) * 255; d[i + 2] = l * 255; d[i + 3] = 255;
    }
    ctx.putImageData(dst, 0, 0);
    return out;
  }
  async function nrmTex(svg, w, h, strength) { return mkTex(normalFrom(await svgCanvas(svg, w, h), strength), { srgb: false }); }

  /* ================= SVG 片段工具 ================= */
  let fid = 0; const uid = () => 'q' + (fid++);
  const SW = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${inner}</svg>`;

  /* 噪声斑点层(多尺度做旧) */
  function N(w, h, o) {
    const id = uid();
    return `<filter id="${id}" x="0" y="0" width="100%" height="100%">
<feTurbulence type="${o.type || 'fractalNoise'}" baseFrequency="${o.bf}" numOctaves="${o.oct || 4}" seed="${o.seed || 1}" stitchTiles="stitch"/>
<feColorMatrix type="luminanceToAlpha"/>
<feComponentTransfer><feFuncA type="linear" slope="${o.slope == null ? 1.6 : o.slope}" intercept="${o.icpt == null ? -0.25 : o.icpt}"/></feComponentTransfer>
<feFlood flood-color="${o.color || '#000'}" result="fl"/><feComposite in="fl" in2="SourceAlpha" operator="in"/>
<feComposite in2="SourceGraphic" operator="over"/></filter>
<rect width="${w}" height="${h}" filter="url(#${id})" opacity="${o.op == null ? 0.2 : o.op}"/>`.replace(/\n/g, '');
  }
  /* 凹凸光照层:基色矩形 × feDiffuseLighting */
  function BUMP(w, h, o) {
    const id = uid();
    return `<filter id="${id}" x="0" y="0" width="100%" height="100%">
<feTurbulence type="${o.type || 'fractalNoise'}" baseFrequency="${o.bf}" numOctaves="${o.oct || 4}" seed="${o.seed || 3}" stitchTiles="stitch"/>
<feDiffuseLighting surfaceScale="${o.scale == null ? 2 : o.scale}" diffuseConstant="${o.dc == null ? 1.05 : o.dc}" lighting-color="#ffffff"><feDistantLight azimuth="${o.az == null ? 235 : o.az}" elevation="${o.el == null ? 55 : o.el}"/></feDiffuseLighting>
<feComposite operator="arithmetic" k1="1" k2="0" k3="0" k4="0" in2="SourceGraphic"/></filter>
<rect width="${w}" height="${h}" fill="${o.color}" filter="url(#${id})" opacity="${o.op == null ? 1 : o.op}"/>`.replace(/\n/g, '');
  }
  /* 高光泽层 */
  function SPEC(w, h, o) {
    const id = uid();
    return `<filter id="${id}" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="${o.bf}" numOctaves="${o.oct || 3}" seed="${o.seed || 9}" stitchTiles="stitch"/>
<feSpecularLighting surfaceScale="${o.scale || 2}" specularConstant="${o.sc || 0.7}" specularExponent="${o.se || 14}" lighting-color="#ffffff"><feDistantLight azimuth="${o.az || 225}" elevation="${o.el || 60}"/></feSpecularLighting></filter>
<rect width="${w}" height="${h}" filter="url(#${id})" opacity="${o.op == null ? 0.16 : o.op}"/>`.replace(/\n/g, '');
  }
  /* 扰动组(裂缝/污渍不规则边缘) */
  function DISP(inner, o) {
    const id = uid();
    return `<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%">
<feTurbulence type="turbulence" baseFrequency="${o.bf || 0.07}" numOctaves="${o.oct || 2}" seed="${o.seed || 5}"/>
<feDisplacementMap in="SourceGraphic" scale="${o.scale == null ? 12 : o.scale}" xChannelSelector="R" yChannelSelector="G"/></filter>
<g filter="url(#${id})">${inner}</g>`.replace(/\n/g, '');
  }
  /* 污渍斑块 */
  function STAINS(w, h, rng, o) {
    o = o || {};
    const n = o.n || 6, colors = o.colors || ['#1c1a17', '#26221c', '#141311'];
    let g = '', defs = '';
    for (let i = 0; i < n; i++) {
      const id = uid();
      const c = U.pick(rng, colors);
      defs += `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o.op0 == null ? 0.5 : o.op0}"/><stop offset="0.65" stop-color="${c}" stop-opacity="${(o.op0 == null ? 0.5 : o.op0) * 0.45}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
      const rx = U.rand(rng, o.minR || 14, o.maxR || 60);
      g += `<ellipse cx="${U.rand(rng, 0, w)}" cy="${U.rand(rng, 0, h)}" rx="${rx}" ry="${rx * U.rand(rng, 0.5, 1)}" fill="url(#${id})" transform="rotate(${U.rand(rng, 0, 360)} ${w / 2} ${h / 2})"/>`;
    }
    return `<defs>${defs}</defs>` + DISP(g, { bf: 0.02, scale: o.disp == null ? 26 : o.disp, seed: rng() * 99 | 0 });
  }
  /* 竖直流挂(雨渍/锈水) */
  function STREAKS(w, h, rng, o) {
    o = o || {};
    const id = uid();
    let g = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.color || '#211d18'}" stop-opacity="${o.op == null ? 0.4 : o.op}"/><stop offset="1" stop-color="${o.color || '#211d18'}" stop-opacity="0"/></linearGradient></defs>`;
    let r = '';
    for (let i = 0; i < (o.n || 12); i++) {
      const x = o.xs ? U.pick(rng, o.xs) + U.rand(rng, -3, 3) : U.rand(rng, 0, w);
      const y = o.y == null ? U.rand(rng, 0, h * 0.4) : o.y;
      r += `<rect x="${x}" y="${y}" width="${U.rand(rng, 1.5, o.maxW || 6)}" height="${U.rand(rng, o.minL || 20, o.maxL || h * 0.7)}" fill="url(#${id})"/>`;
    }
    return g + DISP(r, { bf: 0.05, scale: 5, seed: rng() * 99 | 0 });
  }
  /* 裂缝 */
  function CRACKS(w, h, rng, o) {
    o = o || {};
    let p = '';
    for (let i = 0; i < (o.n || 3); i++) {
      let x = U.rand(rng, w * 0.1, w * 0.9), y = U.rand(rng, h * 0.1, h * 0.9);
      let a = U.rand(rng, 0, U.TAU), d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
      const steps = U.randi(rng, 4, 9);
      for (let s = 0; s < steps; s++) {
        a += U.rand(rng, -0.7, 0.7);
        x += Math.cos(a) * U.rand(rng, 8, 26); y += Math.sin(a) * U.rand(rng, 8, 26);
        d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
        if (rng() < 0.3) {
          const a2 = a + U.rand(rng, 0.6, 1.6) * (rng() < .5 ? 1 : -1);
          d += ` M${x.toFixed(1)} ${y.toFixed(1)} l${(Math.cos(a2) * 14).toFixed(1)} ${(Math.sin(a2) * 14).toFixed(1)} M${x.toFixed(1)} ${y.toFixed(1)}`;
        }
      }
      p += `<path d="${d}" stroke="${o.color || '#0d0c0b'}" stroke-width="${o.w || 1.6}" fill="none" opacity="${o.op == null ? 0.55 : o.op}" stroke-linecap="round"/>`;
    }
    return DISP(p, { bf: 0.09, scale: 7, seed: rng() * 99 | 0 });
  }
  /* 边缘 AO */
  function EDGE(w, h, op) {
    const id = uid();
    return `<defs><radialGradient id="${id}" cx="0.5" cy="0.5" r="0.72"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${op == null ? 0.28 : op}"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#${id})"/>`;
  }
  function LG(id, x1, y1, x2, y2, stops) {
    return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` + stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] == null ? 1 : s[2]}"/>`).join('') + `</linearGradient>`;
  }
  const TXT = (x, y, size, fill, txt, o) => { o = o || {}; return `<text x="${x}" y="${y}" font-family="${o.font || "'Arial Black','Microsoft YaHei',sans-serif"}" font-size="${size}" font-weight="${o.fw || 900}" fill="${fill}" text-anchor="${o.anchor || 'middle'}" ${o.ls ? `letter-spacing="${o.ls}"` : ''} ${o.tr ? `transform="${o.tr}"` : ''} ${o.op ? `opacity="${o.op}"` : ''}>${txt}</text>`; };

  /* ================= 具体贴图 ================= */
  const B = {};   // builders

  /* ---- 沥青(基材,512 铺 4m) ---- */
  function asphaltBody(w, h, seed, extra) {
    const rng = U.rng(seed);
    return [
      BUMP(w, h, { color: '#2e2f31', bf: 0.4, oct: 5, seed: seed, scale: 1.5, dc: 1.15 }),
      N(w, h, { bf: 0.02, oct: 3, seed: seed + 1, color: '#0a0a0a', op: 0.25, slope: 1.1, icpt: -0.1 }),
      N(w, h, { bf: 0.6, oct: 2, seed: seed + 2, color: '#8f9296', op: 0.10, slope: 2.2, icpt: -0.75 }),
      N(w, h, { bf: 0.008, oct: 4, seed: seed + 3, color: '#3c3e41', op: 0.28, slope: 1.3, icpt: -0.2 }),
      STAINS(w, h, rng, { n: 5, colors: ['#141312', '#0e0d0c', '#1a1917'], minR: 20, maxR: 80, op0: 0.4 }),
      CRACKS(w, h, rng, { n: 3, w: 1.4, op: 0.4 }),
      extra || '',
      EDGE(w, h, 0.10)
    ].join('');
  }
  function asphaltHeight(w, h, seed) {
    const id = uid();
    return `<rect width="${w}" height="${h}" fill="#808080"/><filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="5" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.5,0 0 0 0 0.5,0 0 0 0 0.5,0.9 0 0 0 0"/></filter><rect width="${w}" height="${h}" filter="url(#${id})"/>`;
  }
  B.asphalt = async () => {
    const w = 512;
    T.t.asphalt = {
      map: await tex(SW(w, w, asphaltBody(w, w, 11)), w, w),
      nrm: await nrmTex(SW(w, w, asphaltHeight(w, w, 11)), w, w, 1.0)
    };
  };

  /* ---- 车行道(1024 = 12m 宽,V 向每 12m 重复) ---- */
  B.road = async () => {
    const w = 1024, m = w / 12; // px / m
    const rng = U.rng(77);
    const X = mm => (6 + mm) * m;
    const paintN = uid();
    const wearFilter = `<filter id="${paintN}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="4" seed="8"/><feColorMatrix type="luminanceToAlpha"/><feComponentTransfer><feFuncA type="linear" slope="-2.6" intercept="1.75"/></feComponentTransfer><feComposite in="SourceGraphic" operator="in"/></filter>`;
    let marks = `<g filter="url(#${paintN})">`;
    marks += `<rect x="${X(-5.75)}" y="0" width="${0.15 * m}" height="${w}" fill="#ded9cd"/>`;
    marks += `<rect x="${X(5.6)}" y="0" width="${0.15 * m}" height="${w}" fill="#ded9cd"/>`;
    marks += `<rect x="${X(-0.28)}" y="0" width="${0.13 * m}" height="${w}" fill="#c9a83f"/>`;
    marks += `<rect x="${X(0.15)}" y="0" width="${0.13 * m}" height="${w}" fill="#c9a83f"/>`;
    for (const lx of [-3, 3]) for (const dy of [0, 6]) marks += `<rect x="${X(lx) - 0.075 * m}" y="${(dy + 1.5) * m}" width="${0.15 * m}" height="${3 * m}" fill="#d8d4c8"/>`;
    marks += `</g>`;
    const wheelWear = ['-4.6', '-3.1', '-1.9', '-0.55', '0.55', '1.9', '3.1', '4.6'].map(x =>
      `<rect x="${X(parseFloat(x)) - 0.4 * m}" y="0" width="${0.8 * m}" height="${w}" fill="#232425" opacity="0.35"/>`).join('');
    const body = asphaltBody(w, w, 21, wheelWear + wearFilter + marks +
      STAINS(w, w, rng, { n: 8, colors: ['#111010', '#0c0b0a'], minR: 12, maxR: 40, op0: 0.5 }));
    T.t.road = {
      map: await tex(SW(w, w, body), w, w),
      nrm: await nrmTex(SW(w, w, asphaltHeight(w, w, 21)), w, w, 0.8)
    };
    /* 粗糙度:油渍/车辙更光滑 */
    const rgh = `<rect width="${w}" height="${w}" fill="#c8c8c8"/>` +
      ['-4.6', '-1.9', '1.9', '4.6'].map(x => `<rect x="${X(parseFloat(x)) - 0.5 * m}" y="0" width="${m}" height="${w}" fill="#9a9a9a"/>`).join('') +
      N(w, w, { bf: 0.05, oct: 3, seed: 4, color: '#707070', op: 0.5, slope: 1.2 });
    T.t.road.rgh = await tex(SW(w, w, rgh), w, w, { srgb: false });
  };

  /* ---- 交叉口 ---- */
  B.inter = async () => {
    const w = 512;
    T.t.inter = {
      map: await tex(SW(w, w, asphaltBody(w, w, 31, CRACKS(w, w, U.rng(3), { n: 4, w: 2, op: 0.35 }))), w, w),
      nrm: await nrmTex(SW(w, w, asphaltHeight(w, w, 31)), w, w, 0.9)
    };
  };

  /* ---- 斑马线贴花(alpha) ---- */
  B.cross = async () => {
    const w = 512, h = 256;
    const idw = uid();
    let bars = `<filter id="${idw}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="4" seed="17"/><feColorMatrix type="luminanceToAlpha"/><feComponentTransfer><feFuncA type="linear" slope="-3.2" intercept="2.0"/></feComponentTransfer><feComposite in="SourceGraphic" operator="in"/></filter><g filter="url(#${idw})">`;
    for (let i = 0; i < 8; i++) bars += `<rect x="${16 + i * 62}" y="16" width="34" height="${h - 32}" fill="#ddd8cb" rx="2"/>`;
    bars += '</g>';
    T.t.cross = { map: await tex(SW(w, h, bars), w, h) };
  };

  /* ---- 井盖 ---- */
  B.manhole = async () => {
    const w = 128, id = uid();
    let g = `<circle cx="64" cy="64" r="60" fill="#3a3b3c"/><circle cx="64" cy="64" r="60" fill="none" stroke="#222" stroke-width="5"/>`;
    for (let r = 12; r <= 48; r += 12) g += `<circle cx="64" cy="64" r="${r}" fill="none" stroke="#2a2b2c" stroke-width="3"/>`;
    for (let a = 0; a < 12; a++) g += `<line x1="64" y1="64" x2="${64 + Math.cos(a / 12 * U.TAU) * 56}" y2="${64 + Math.sin(a / 12 * U.TAU) * 56}" stroke="#2c2d2e" stroke-width="2.5"/>`;
    g += N(w, w, { bf: 0.3, oct: 3, seed: 5, color: '#6b5334', op: 0.35, slope: 1.8, icpt: -0.5 });
    g += `<circle cx="64" cy="64" r="62" fill="none" stroke="#141414" stroke-width="4" opacity="0.8"/>`;
    T.t.manhole = { map: await tex(SW(w, w, `<defs><clipPath id="${id}"><circle cx="64" cy="64" r="62"/></clipPath></defs><g clip-path="url(#${id})">${g}</g>`), w, w) };
  };

  /* ---- 人行道砖(512 = 3m,4 块板) ---- */
  B.sidewalk = async () => {
    const w = 512, rng = U.rng(55);
    const slab = 128;
    let g = `<rect width="${w}" height="${w}" fill="#5a5852"/>`;
    let hmap = `<rect width="${w}" height="${w}" fill="#3c3c3c"/>`;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const l = U.rand(rng, -8, 8) | 0;
      const c = `rgb(${138 + l},${134 + l},${125 + l})`;
      g += `<rect x="${x * slab + 2}" y="${y * slab + 2}" width="${slab - 4}" height="${slab - 4}" fill="${c}"/>`;
      const gid = uid();
      g += `<defs><radialGradient id="${gid}"><stop offset="0.5" stop-color="#fff" stop-opacity="0.05"/><stop offset="1" stop-color="#000" stop-opacity="0.14"/></radialGradient></defs><rect x="${x * slab + 2}" y="${y * slab + 2}" width="${slab - 4}" height="${slab - 4}" fill="url(#${gid})"/>`;
      hmap += `<rect x="${x * slab + 3}" y="${y * slab + 3}" width="${slab - 6}" height="${slab - 6}" fill="#c8c8c8" rx="3"/>`;
      if (rng() < 0.4) g += CRACKS(w, w, rng, { n: 1, w: 1.2, op: 0.4 });
    }
    g += N(w, w, { bf: 0.35, oct: 4, seed: 9, color: '#000', op: 0.14, slope: 1.4 });
    g += N(w, w, { bf: 0.02, oct: 3, seed: 10, color: '#26251f', op: 0.22, slope: 1.2 });
    g += STAINS(w, w, rng, { n: 6, colors: ['#242018', '#33291c', '#1a1712'], minR: 16, maxR: 56, op0: 0.35 });
    g += SPEC(w, w, { bf: 0.5, op: 0.07 });
    T.t.sidewalk = { map: await tex(SW(w, w, g), w, w), nrm: await nrmTex(SW(w, w, hmap), w, w, 1.4) };
  };

  /* ---- 混凝土 ---- */
  B.concrete = async () => {
    const w = 512, rng = U.rng(66);
    let g = `<rect width="${w}" height="${w}" fill="#8d8a82"/>`;
    g += BUMP(w, w, { color: '#8d8a82', bf: 0.05, oct: 5, seed: 12, scale: 1.2, op: 0.85 });
    for (let i = 1; i < 3; i++) g += `<line x1="0" y1="${i * 170}" x2="${w}" y2="${i * 170}" stroke="#6e6b64" stroke-width="2" opacity="0.7"/>`;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) g += `<circle cx="${50 + x * 100}" cy="${85 + y * 170}" r="5" fill="#6a675f"/><circle cx="${50 + x * 100}" cy="${85 + y * 170}" r="5" fill="none" stroke="#4c4a44" stroke-width="1.5" opacity="0.8"/>`;
    g += STREAKS(w, w, rng, { n: 10, color: '#3f3b33', op: 0.3, maxL: 300 });
    g += N(w, w, { bf: 0.4, oct: 3, seed: 13, color: '#fff', op: 0.05, slope: 2 });
    g += N(w, w, { bf: 0.015, oct: 4, seed: 14, color: '#4a463e', op: 0.2 });
    g += CRACKS(w, w, rng, { n: 2, w: 1.3, op: 0.45 });
    g += EDGE(w, w, 0.18);
    const hm = `<rect width="${w}" height="${w}" fill="#909090"/>` + N(w, w, { bf: 0.08, oct: 5, seed: 12, color: '#000', op: 0.5, slope: 1.2 }) + `<line x1="0" y1="170" x2="${w}" y2="170" stroke="#404040" stroke-width="3"/><line x1="0" y1="340" x2="${w}" y2="340" stroke="#404040" stroke-width="3"/>`;
    T.t.concrete = { map: await tex(SW(w, w, g), w, w), nrm: await nrmTex(SW(w, w, hm), w, w, 1.0) };
  };

  /* ---- 草地 / 碎石路 ---- */
  B.grass = async () => {
    const w = 512, rng = U.rng(88);
    let g = `<rect width="${w}" height="${w}" fill="#3f5a26"/>`;
    g += BUMP(w, w, { color: '#42602a', bf: 0.3, oct: 5, seed: 15, scale: 2.4, op: 0.9 });
    g += N(w, w, { bf: 0.5, oct: 2, seed: 16, color: '#6c8a3d', op: 0.30, slope: 2.2, icpt: -0.8 });
    g += N(w, w, { bf: 0.45, oct: 2, seed: 17, color: '#2a3d18', op: 0.35, slope: 2.0, icpt: -0.7 });
    g += N(w, w, { bf: 0.012, oct: 4, seed: 18, color: '#57531f', op: 0.30 });
    g += STAINS(w, w, rng, { n: 4, colors: ['#4d4423', '#374a20'], minR: 30, maxR: 90, op0: 0.4 });
    T.t.grass = { map: await tex(SW(w, w, g), w, w) };
    let p = `<rect width="256" height="256" fill="#8a7f6d"/>`;
    p += BUMP(256, 256, { color: '#8a7f6d', bf: 0.5, oct: 4, seed: 19, scale: 2 });
    p += N(256, 256, { bf: 0.7, oct: 2, seed: 20, color: '#fff', op: 0.12, slope: 2.4, icpt: -0.9 });
    p += N(256, 256, { bf: 0.03, oct: 3, seed: 21, color: '#5c5344', op: 0.3 });
    T.t.path = { map: await tex(SW(256, 256, p), 256, 256) };
  };

  /* ---- 砖墙(512 = 4m) ---- */
  function brickBody(w, seed, pal, mortar) {
    const rng = U.rng(seed);
    const bw = 64, bh = 26;
    let g = `<rect width="${w}" height="${w}" fill="${mortar}"/>`;
    let hm = `<rect width="${w}" height="${w}" fill="#484848"/>`;
    for (let row = 0; row * bh < w + bh; row++) {
      const off = (row % 2) * bw / 2;
      for (let col = -1; col * bw < w + bw; col++) {
        const x = col * bw + off, y = row * bh;
        const base = U.pick(rng, pal);
        const l = U.rand(rng, -14, 14) | 0;
        const c = `rgb(${U.clamp(base[0] + l, 0, 255)},${U.clamp(base[1] + l * 0.8, 0, 255)},${U.clamp(base[2] + l * 0.6, 0, 255)})`;
        g += `<rect x="${x + 2}" y="${y + 2}" width="${bw - 4}" height="${bh - 4}" fill="${c}" rx="1.5"/>`;
        if (rng() < 0.18) g += `<rect x="${x + 2}" y="${y + 2}" width="${bw - 4}" height="${bh - 4}" fill="#1e1712" opacity="${U.rand(rng, 0.08, 0.3)}" rx="1.5"/>`;
        hm += `<rect x="${x + 3}" y="${y + 3}" width="${bw - 6}" height="${bh - 6}" fill="#b8b8b8" rx="2"/>`;
      }
    }
    g += N(w, w, { bf: 0.3, oct: 4, seed: seed + 1, color: '#000', op: 0.16, slope: 1.5 });
    g += N(w, w, { bf: 0.04, oct: 4, seed: seed + 2, color: '#2b2018', op: 0.22 });
    g += SPEC(w, w, { bf: 0.35, op: 0.08 });
    g += STREAKS(w, w, rng, { n: 8, color: '#241c14', op: 0.25, maxL: 220 });
    g += EDGE(w, w, 0.14);
    return { g, hm };
  }
  B.brick = async () => {
    const w = 512;
    const a = brickBody(w, 101, [[126, 60, 48], [140, 72, 55], [112, 52, 44], [150, 82, 62]], '#9a938a');
    T.t.brickA = { map: await tex(SW(w, w, a.g), w, w), nrm: await nrmTex(SW(w, w, a.hm), w, w, 1.2) };
    const b = brickBody(w, 202, [[168, 142, 108], [180, 155, 118], [150, 126, 96], [190, 168, 130]], '#a49c8e');
    T.t.brickB = { map: await tex(SW(w, w, b.g), w, w), nrm: await nrmTex(SW(w, w, b.hm), w, w, 1.2) };
  };

  /* ---- 住宅立面砖墙 tile(512 = 6m宽 × 3m高/层,2 窗) ---- */
  function windowSVG(x, y, ww, wh, rng, opt) {
    opt = opt || {};
    const gid = uid();
    let s = `<defs>${LG(gid, 0, 0, 0, 1, [[0, '#2a3644'], [0.45, '#3c4d61'], [0.55, '#22303e'], [1, '#141d27']])}</defs>`;
    s += `<rect x="${x - 6}" y="${y - 6}" width="${ww + 12}" height="${wh + 12}" fill="${opt.frame || '#6f675a'}" rx="2"/>`;
    s += `<rect x="${x - 6}" y="${y - 6}" width="${ww + 12}" height="${wh + 12}" fill="none" stroke="#3d382f" stroke-width="2" rx="2"/>`;
    s += `<rect x="${x}" y="${y}" width="${ww}" height="${wh}" fill="url(#${gid})"/>`;
    const div = opt.div == null ? 2 : opt.div;
    for (let i = 1; i < div; i++) s += `<line x1="${x + ww * i / div}" y1="${y}" x2="${x + ww * i / div}" y2="${y + wh}" stroke="#20242a" stroke-width="3"/>`;
    s += `<line x1="${x}" y1="${y + wh * 0.5}" x2="${x + ww}" y2="${y + wh * 0.5}" stroke="#20242a" stroke-width="3"/>`;
    if (rng() < 0.5) { const bh = U.rand(rng, 0.15, 0.5); s += `<rect x="${x + 2}" y="${y + 2}" width="${ww - 4}" height="${wh * bh}" fill="#cfc4a8" opacity="0.8"/>`; for (let i = 1; i < 6; i++) s += `<line x1="${x + 2}" y1="${y + 2 + wh * bh * i / 6}" x2="${x + ww - 2}" y2="${y + 2 + wh * bh * i / 6}" stroke="#a89c80" stroke-width="1.5"/>`; }
    s += `<polygon points="${x},${y} ${x + ww * 0.45},${y} ${x},${y + wh * 0.6}" fill="#ffffff" opacity="0.10"/>`;
    s += `<rect x="${x - 10}" y="${y + wh + 6}" width="${ww + 20}" height="8" fill="#8b8478"/><rect x="${x - 10}" y="${y + wh + 12}" width="${ww + 20}" height="4" fill="#00000055"/>`;
    return s;
  }
  function acUnit(x, y, s, rng) {
    let g = `<rect x="${x}" y="${y}" width="${s}" height="${s * 0.68}" fill="#b7b3a8" rx="3"/><rect x="${x}" y="${y}" width="${s}" height="${s * 0.68}" fill="none" stroke="#5e5a50" stroke-width="2" rx="3"/>`;
    g += `<circle cx="${x + s * 0.32}" cy="${y + s * 0.34}" r="${s * 0.22}" fill="none" stroke="#6e6a60" stroke-width="3"/>`;
    for (let i = 1; i < 5; i++) g += `<line x1="${x + s * 0.62}" y1="${y + 6 + i * s * 0.1}" x2="${x + s - 4}" y2="${y + 6 + i * s * 0.1}" stroke="#6e6a60" stroke-width="2"/>`;
    g += `<rect x="${x - 4}" y="${y + s * 0.68}" width="${s + 8}" height="4" fill="#4a463e"/>`;
    g += STREAKS(512, 512, rng, { n: 2, color: '#4a3828', op: 0.35, xs: [x + s / 2], y: y + s * 0.68, maxL: 60, maxW: 4 });
    return g;
  }
  function facResSVG(w, seed, brickPal, mortar, emissive) {
    const rng = U.rng(seed);
    let g = '', windows = '';
    if (!emissive) {
      const bb = brickBody(w, seed, brickPal, mortar);
      g = bb.g;
      g += `<rect x="0" y="0" width="${w}" height="14" fill="#77706a"/><rect x="0" y="14" width="${w}" height="4" fill="#00000066"/>`;
    } else g = `<rect width="${w}" height="${w}" fill="#000"/>`;
    for (let i = 0; i < 2; i++) {
      const x = 70 + i * 256, y = 130, ww = 116, wh = 210;
      if (!emissive) {
        windows += windowSVG(x, y, ww, wh, rng);
        if (rng() < 0.4) windows += acUnit(x + U.rand(rng, -20, 60), y + wh + 26, 64, rng);
        windows += STREAKS(w, w, rng, { n: 3, color: '#241c14', op: 0.3, xs: [x - 8, x + ww + 8], y: y + wh + 20, maxL: 90, maxW: 4 });
      } else {
        const lit = rng() < 0.55;
        if (lit) {
          const warm = rng() < 0.75;
          const c = warm ? '#ffb46b' : '#cfe0ff';
          const gid = uid();
          windows += `<defs><radialGradient id="${gid}" cx="0.5" cy="0.42"><stop offset="0" stop-color="${c}"/><stop offset="0.75" stop-color="${c}" stop-opacity="0.75"/><stop offset="1" stop-color="${c}" stop-opacity="0.45"/></radialGradient></defs><rect x="${x}" y="${y}" width="116" height="210" fill="url(#${gid})" opacity="${U.rand(rng, 0.6, 1)}"/>`;
          windows += `<line x1="${x + 58}" y1="${y}" x2="${x + 58}" y2="${y + 210}" stroke="#000" stroke-width="4"/><line x1="${x}" y1="${y + 105}" x2="${x + 116}" y2="${y + 105}" stroke="#000" stroke-width="4"/>`;
        }
      }
    }
    return g + windows;
  }
  B.facRes = async () => {
    const w = 512;
    T.t.facRes = {
      map: await tex(SW(w, w, facResSVG(w, 301, [[126, 60, 48], [140, 72, 55], [112, 52, 44]], '#98918a', false)), w, w),
      ems: await tex(SW(w, w, facResSVG(w, 301, null, null, true)), w, w)
    };
    T.t.facRes2 = {
      map: await tex(SW(w, w, facResSVG(w, 302, [[168, 142, 108], [150, 126, 96], [186, 162, 124]], '#a49c8e', false)), w, w),
      ems: await tex(SW(w, w, facResSVG(w, 302, null, null, true)), w, w)
    };
  };

  /* ---- 办公楼横条窗立面 ---- */
  function facOffSVG(w, seed, emissive) {
    const rng = U.rng(seed);
    let g = emissive ? `<rect width="${w}" height="${w}" fill="#000"/>` : '';
    if (!emissive) {
      g += `<rect width="${w}" height="${w}" fill="#9d998f"/>`;
      g += BUMP(w, w, { color: '#9d998f', bf: 0.06, oct: 4, seed: seed, scale: 0.8, op: 0.85 });
      g += N(w, w, { bf: 0.02, oct: 4, seed: seed + 1, color: '#57534a', op: 0.22 });
      g += STREAKS(w, w, rng, { n: 14, color: '#3d3a33', op: 0.3, maxL: 160 });
    }
    const bandY = 150, bandH = 230;
    if (!emissive) {
      const gid = uid();
      g += `<defs>${LG(gid, 0, 0, 0, 1, [[0, '#46586b'], [0.4, '#607a91'], [0.6, '#39485a'], [1, '#1d2733']])}</defs>`;
      g += `<rect x="0" y="${bandY - 8}" width="${w}" height="${bandH + 16}" fill="#4d4a43"/>`;
      g += `<rect x="0" y="${bandY}" width="${w}" height="${bandH}" fill="url(#${gid})"/>`;
      for (let i = 0; i <= 8; i++) g += `<line x1="${i * w / 8}" y1="${bandY}" x2="${i * w / 8}" y2="${bandY + bandH}" stroke="#2b2f35" stroke-width="5"/>`;
      g += `<polygon points="0,${bandY} 180,${bandY} 40,${bandY + bandH}" fill="#fff" opacity="0.10"/>`;
      g += `<rect x="0" y="${bandY + bandH + 8}" width="${w}" height="5" fill="#00000055"/>`;
      g += EDGE(w, w, 0.12);
    } else {
      for (let i = 0; i < 8; i++) if (rng() < 0.45) {
        const c = rng() < 0.5 ? '#d7e6ff' : '#ffd9a0';
        g += `<rect x="${i * w / 8 + 5}" y="${bandY + 8}" width="${w / 8 - 10}" height="${bandH - 16}" fill="${c}" opacity="${U.rand(rng, 0.5, 0.95)}"/>`;
      }
    }
    return g;
  }
  B.facOff = async () => {
    const w = 512;
    T.t.facOff = { map: await tex(SW(w, w, facOffSVG(w, 401, false)), w, w), ems: await tex(SW(w, w, facOffSVG(w, 401, true)), w, w) };
  };

  /* ---- 玻璃幕墙 tile(512 = 8m × 4m,4 格) ---- */
  function facGlassSVG(w, seed, mode) {
    const rng = U.rng(seed);
    let g = '';
    if (mode === 'map') {
      const gid = uid(), gid2 = uid();
      g += `<defs>${LG(gid, 0, 0, 0, 1, [[0, '#7fa8c4'], [0.5, '#4c7291'], [1, '#274259']])}${LG(gid2, 0, 0, 1, 1, [[0, '#ffffff', 0.22], [0.5, '#ffffff', 0.02], [1, '#ffffff', 0.14]])}</defs>`;
      g += `<rect width="${w}" height="${w}" fill="#22282e"/>`;
      for (let x = 0; x < 4; x++) {
        const l = U.rand(rng, -12, 12) | 0;
        g += `<rect x="${x * 128 + 5}" y="8" width="118" height="${w - 16}" fill="url(#${gid})"/>`;
        g += `<rect x="${x * 128 + 5}" y="8" width="118" height="${w - 16}" fill="rgb(${128 + l},${140 + l},${150 + l})" opacity="0.12"/>`;
        g += `<rect x="${x * 128 + 5}" y="8" width="118" height="${w - 16}" fill="url(#${gid2})"/>`;
      }
      g += `<polygon points="0,${w} 200,0 330,0 60,${w}" fill="#ffffff" opacity="0.07"/>`;
      for (let x = 0; x <= 4; x++) g += `<rect x="${x * 128 - 3}" y="0" width="6" height="${w}" fill="#31363c"/><rect x="${x * 128 - 1}" y="0" width="2" height="${w}" fill="#565c63"/>`;
      g += `<rect x="0" y="0" width="${w}" height="7" fill="#31363c"/><rect x="0" y="${w - 7}" width="${w}" height="7" fill="#31363c"/>`;
      g += N(w, w, { bf: 0.015, oct: 3, seed: seed, color: '#0c141c', op: 0.12 });
      g += `<rect x="0" y="${w - 40}" width="${w}" height="40" fill="#141a1f" opacity="0.25"/>`;
    } else if (mode === 'ems') {
      g += `<rect width="${w}" height="${w}" fill="#000"/>`;
      for (let x = 0; x < 4; x++) if (rng() < 0.4) {
        const c = rng() < 0.6 ? '#d5e6ff' : '#ffe1b0';
        g += `<rect x="${x * 128 + 8}" y="12" width="112" height="${w - 24}" fill="${c}" opacity="${U.rand(rng, 0.45, 0.9)}"/>`;
      }
    } else {
      g += `<rect width="${w}" height="${w}" fill="#1e1e1e"/>`;
      for (let x = 0; x <= 4; x++) g += `<rect x="${x * 128 - 3}" y="0" width="6" height="${w}" fill="#7a7a7a"/>`;
      g += `<rect x="0" y="0" width="${w}" height="7" fill="#7a7a7a"/><rect x="0" y="${w - 7}" width="${w}" height="7" fill="#7a7a7a"/>`;
    }
    return g;
  }
  B.facGlass = async () => {
    const w = 512;
    T.t.facGlass = {
      map: await tex(SW(w, w, facGlassSVG(w, 501, 'map')), w, w),
      ems: await tex(SW(w, w, facGlassSVG(w, 501, 'ems')), w, w),
      rgh: await tex(SW(w, w, facGlassSVG(w, 501, 'rgh')), w, w, { srgb: false })
    };
  };

  /* ---- 沿街商铺立面(1024×256 = 16m × 4m,4 家店) ---- */
  function facShopSVG(w, h, seed, emissive) {
    const rng = U.rng(seed);
    const shops = [
      { name: '醉仙楼', c: '#c33', sign: '#f5e9c8' }, { name: 'OK便利店', c: '#0a7f4f', sign: '#eafff3' },
      { name: '夜猫电玩', c: '#5527aa', sign: '#efe6ff' }, { name: '红霓KTV', c: '#b3175e', sign: '#ffe6f0' },
      { name: '蓝湾酒吧', c: '#155f8f', sign: '#dff2ff' }, { name: '修车行', c: '#7a5a1d', sign: '#fff3d8' }
    ];
    let g = emissive ? `<rect width="${w}" height="${h}" fill="#000"/>` : `<rect width="${w}" height="${h}" fill="#4f4b45"/>`;
    if (!emissive) g += N(w, h, { bf: 0.05, oct: 4, seed: seed, color: '#2b2721', op: 0.3 });
    for (let i = 0; i < 4; i++) {
      const x = i * 256, sp = U.pick(rng, shops);
      const signY = 12, signH = 58;
      if (!emissive) {
        g += `<rect x="${x + 6}" y="${signY}" width="244" height="${signH}" fill="${sp.c}" rx="4"/>`;
        g += `<rect x="${x + 6}" y="${signY}" width="244" height="${signH}" fill="none" stroke="#00000088" stroke-width="3" rx="4"/>`;
        g += TXT(x + 128, signY + 42, 34, sp.sign, sp.name, { font: "'Microsoft YaHei','SimHei',sans-serif", ls: 4 });
        const shut = rng() < 0.22;
        if (shut) {
          g += `<rect x="${x + 14}" y="86" width="228" height="${h - 100}" fill="#7d7a72"/>`;
          for (let yy = 90; yy < h - 16; yy += 9) g += `<line x1="${x + 14}" y1="${yy}" x2="${x + 242}" y2="${yy}" stroke="#5f5c55" stroke-width="3"/>`;
          g += `<path d="M${x + 40} ${h - 60} q30 -34 60 0 t60 0" stroke="#c73a8e" stroke-width="7" fill="none" opacity="0.75"/>`;
          g += `<path d="M${x + 60} ${h - 46} q22 -22 44 0" stroke="#2ab6c9" stroke-width="5" fill="none" opacity="0.75"/>`;
        } else {
          const gid = uid();
          g += `<defs>${LG(gid, 0, 0, 0, 1, [[0, '#20262d'], [0.5, '#39424c'], [1, '#171b20']])}</defs>`;
          g += `<rect x="${x + 14}" y="86" width="228" height="${h - 100}" fill="url(#${gid})"/>`;
          for (let s = 0; s < 3; s++) g += `<rect x="${x + 26 + s * 74}" y="${112 + s * 6}" width="58" height="12" fill="#c9b98f" opacity="0.35"/><rect x="${x + 26 + s * 74}" y="${140 + s * 4}" width="58" height="12" fill="#8fa5c9" opacity="0.28"/>`;
          g += `<rect x="${x + 150}" y="100" width="76" height="${h - 116}" fill="#10141a" opacity="0.6"/><line x1="${x + 188}" y1="100" x2="${x + 188}" y2="${h - 16}" stroke="#3a4048" stroke-width="3"/>`;
          g += `<polygon points="${x + 14},${h - 100} ${x + 90},86 ${x + 140},86 ${x + 50},${h - 100}" fill="#fff" opacity="0.08"/>`;
        }
        g += `<rect x="${x + 6}" y="${h - 14}" width="244" height="14" fill="#37332e"/>`;
        g += STREAKS(w, h, rng, { n: 3, color: '#1f1b16', op: 0.35, xs: [x + 20, x + 236], y: signY + signH, maxL: 60, maxW: 5 });
      } else {
        g += `<rect x="${x + 10}" y="14" width="236" height="54" fill="${sp.c}" opacity="0.9"/>`;
        g += TXT(x + 128, 54, 34, '#ffffff', sp.name, { font: "'Microsoft YaHei','SimHei',sans-serif", ls: 4 });
        if (rng() < 0.7) g += `<rect x="${x + 16}" y="88" width="224" height="${h - 104}" fill="#ffd9a0" opacity="${U.rand(rng, 0.25, 0.6)}"/>`;
      }
    }
    return g;
  }
  B.facShop = async () => {
    const w = 1024, h = 256;
    T.t.facShop = { map: await tex(SW(w, h, facShopSVG(w, h, 601, false)), w, h), ems: await tex(SW(w, h, facShopSVG(w, h, 601, true)), w, h) };
    T.t.facShop2 = { map: await tex(SW(w, h, facShopSVG(w, h, 602, false)), w, h), ems: await tex(SW(w, h, facShopSVG(w, h, 602, true)), w, h) };
  };

  /* ---- 屋顶 ---- */
  B.roof = async () => {
    const w = 512, rng = U.rng(99);
    let g = `<rect width="${w}" height="${w}" fill="#4a4741"/>`;
    g += BUMP(w, w, { color: '#4a4741', bf: 0.5, oct: 4, seed: 22, scale: 1.2, op: 0.9 });
    g += N(w, w, { bf: 0.01, oct: 4, seed: 23, color: '#2c2a26', op: 0.3 });
    for (let i = 1; i < 4; i++) { g += `<line x1="0" y1="${i * 128}" x2="${w}" y2="${i * 128}" stroke="#3a3833" stroke-width="3" opacity="0.6"/>`; g += `<line x1="${i * 128}" y1="0" x2="${i * 128}" y2="${w}" stroke="#3a3833" stroke-width="3" opacity="0.5"/>`; }
    g += STAINS(w, w, rng, { n: 8, colors: ['#302d28', '#26231e', '#3d3121'], minR: 20, maxR: 70, op0: 0.45 });
    g += EDGE(w, w, 0.3);
    T.t.roof = { map: await tex(SW(w, w, g), w, w) };
  };

  /* ---- 集装箱(512:侧面 4 色) ---- */
  function contSVG(w, hue, seed, mode) {
    const rng = U.rng(seed);
    const rib = uid(), pat = uid();
    const base = `hsl(${hue},42%,38%)`, dark = `hsl(${hue},45%,26%)`;
    let g = `<defs>${LG(rib, 0, 0, 1, 0, [[0, '#000', 0.38], [0.12, '#fff', 0.20], [0.45, '#000', 0.02], [0.8, '#000', 0.25], [1, '#000', 0.45]])}<pattern id="${pat}" width="36" height="8" patternUnits="userSpaceOnUse"><rect width="36" height="8" fill="url(#${rib})"/></pattern></defs>`;
    if (mode === 'map') {
      g += `<rect width="${w}" height="${w}" fill="${base}"/>`;
      g += `<rect width="${w}" height="${w}" fill="url(#${pat})"/>`;
      g += `<rect x="0" y="0" width="14" height="${w}" fill="${dark}"/><rect x="${w - 14}" y="0" width="14" height="${w}" fill="${dark}"/>`;
      g += TXT(w * 0.3, 96, 44, '#e8e4da', 'HAILIAN', { op: 0.85, ls: 6 });
      g += TXT(w * 0.3, 140, 26, '#e8e4da', '海联货运 HLCU 731 442', { font: "'Microsoft YaHei',sans-serif", op: 0.7 });
      g += N(w, w, { bf: 0.02, oct: 4, seed: seed, color: '#000', op: 0.25 });
      g += N(w, w, { bf: 0.25, oct: 4, seed: seed + 1, color: '#7a4a20', op: 0.30, slope: 2.4, icpt: -1.05 });
      g += N(w, w, { bf: 0.07, oct: 4, seed: seed + 2, color: '#6b3a16', op: 0.38, slope: 2.6, icpt: -1.25 });
      g += `<rect x="0" y="${w - 60}" width="${w}" height="60" fill="#5e3617" opacity="0.4"/>`;
      g += STREAKS(w, w, rng, { n: 16, color: '#733e18', op: 0.5, maxL: 200 });
      g += STAINS(w, w, rng, { n: 5, colors: ['#3b2410', '#59331a'], minR: 20, maxR: 66, op0: 0.5 });
      g += EDGE(w, w, 0.22);
    } else if (mode === 'hm') {
      g += `<rect width="${w}" height="${w}" fill="#808080"/><rect width="${w}" height="${w}" fill="url(#${pat})"/>`;
    } else {
      g += `<rect width="${w}" height="${w}" fill="#b4b4b4"/>`;
      g += N(w, w, { bf: 0.07, oct: 4, seed: seed + 2, color: '#f2f2f2', op: 0.7, slope: 2.6, icpt: -1.25 });
      g += N(w, w, { bf: 0.25, oct: 4, seed: seed + 1, color: '#e8e8e8', op: 0.5, slope: 2.4, icpt: -1.05 });
    }
    return g;
  }
  B.cont = async () => {
    const w = 512, hues = [8, 200, 105, 28, 355];
    T.t.cont = [];
    for (let i = 0; i < 4; i++) {
      T.t.cont.push({
        map: await tex(SW(w, w, contSVG(w, hues[i], 700 + i, 'map')), w, w),
        nrm: await nrmTex(SW(w, w, contSVG(w, hues[i], 700 + i, 'hm')), w, w, 1.6),
        rgh: await tex(SW(w, w, contSVG(w, hues[i], 700 + i, 'rgh')), w, w, { srgb: false })
      });
    }
  };

  /* ---- 码头仓库 PIER 7(1024,地标) ---- */
  function whSVG(w, mode) {
    const rng = U.rng(801);
    const pat = uid(), rib = uid();
    let g = `<defs>${LG(rib, 0, 0, 0, 1, [[0, '#000', 0.3], [0.15, '#fff', 0.16], [0.5, '#000', 0.03], [1, '#000', 0.4]])}<pattern id="${pat}" width="10" height="26" patternUnits="userSpaceOnUse"><rect width="10" height="26" fill="url(#${rib})" transform="rotate(90 5 13)" /></pattern></defs>`;
    if (mode === 'map') {
      g += `<rect width="${w}" height="512" fill="#6d7d84"/>`;
      const pat2 = uid(), ribV = uid();
      g += `<defs>${LG(ribV, 0, 0, 1, 0, [[0, '#000', 0.35], [0.14, '#fff', 0.18], [0.5, '#000', 0.02], [0.86, '#000', 0.22], [1, '#000', 0.4]])}<pattern id="${pat2}" width="26" height="10" patternUnits="userSpaceOnUse"><rect width="26" height="10" fill="url(#${ribV})"/></pattern></defs>`;
      g += `<rect width="${w}" height="512" fill="url(#${pat2})"/>`;
      for (let i = 1; i < 8; i++) g += `<line x1="${i * 128}" y1="0" x2="${i * 128}" y2="512" stroke="#4d5a60" stroke-width="4" opacity="0.8"/>`;
      g += `<rect x="0" y="30" width="${w}" height="70" fill="#3c464c" opacity="0.85"/>`;
      for (let i = 0; i < 16; i++) g += `<rect x="${14 + i * 64}" y="38" width="50" height="54" fill="#87919b" opacity="${U.rand(rng, 0.5, 0.9)}"/><rect x="${14 + i * 64}" y="38" width="50" height="54" fill="none" stroke="#2c343a" stroke-width="3"/>`;
      g += TXT(w / 2, 260, 150, '#dad4c5', 'PIER 7', { op: 0.8, ls: 20 });
      g += TXT(w / 2, 330, 44, '#c9c2b2', '海 联 仓 储', { font: "'Microsoft YaHei',sans-serif", op: 0.65, ls: 30 });
      const er = uid();
      g += `<filter id="${er}"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="4" seed="31"/><feColorMatrix type="luminanceToAlpha"/><feComponentTransfer><feFuncA type="linear" slope="2.2" intercept="-0.6"/></feComponentTransfer><feFlood flood-color="#6d7d84"/><feComposite in2="SourceAlpha" operator="in"/></filter><rect x="140" y="120" width="760" height="230" filter="url(#${er})" opacity="0.5"/>`;
      g += N(w, 512, { bf: 0.15, oct: 4, seed: 32, color: '#733e18', op: 0.3, slope: 2.5, icpt: -1.15 });
      g += N(w, 512, { bf: 0.03, oct: 4, seed: 33, color: '#000', op: 0.25 });
      g += STREAKS(w, 512, rng, { n: 22, color: '#6b3a16', op: 0.45, maxL: 260 });
      g += `<rect x="0" y="440" width="${w}" height="72" fill="#4c463c" opacity="0.5"/>`;
      g += STAINS(w, 512, rng, { n: 8, colors: ['#3b2a14', '#2c2c28'], minR: 24, maxR: 80, op0: 0.45 });
    } else {
      g += `<rect width="${w}" height="512" fill="#000"/>`;
      for (let i = 0; i < 16; i++) if (rng() < 0.75) g += `<rect x="${14 + i * 64}" y="38" width="50" height="54" fill="#ffd9a0" opacity="${U.rand(rng, 0.5, 0.95)}"/>`;
    }
    return g;
  }
  B.wh = async () => {
    T.t.wh = { map: await tex(SW(1024, 512, whSVG(1024, 'map')), 1024, 512), ems: await tex(SW(1024, 512, whSVG(1024, 'ems')), 1024, 512) };
    /* PIER 7 霓虹板 */
    const pn = (glow) => {
      let n = `<rect width="512" height="128" fill="${glow ? '#000' : '#10161c'}"/>`;
      if (glow) { const f = uid(); n += `<filter id="${f}" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="7"/></filter><g filter="url(#${f})">${TXT(256, 92, 78, '#4fd8ff', 'PIER 7', { ls: 16 })}</g>`; }
      n += TXT(256, 92, 78, glow ? '#eafcff' : '#2a4a56', 'PIER 7', { ls: 16 });
      return n;
    };
    T.t.pierNeon = { map: await tex(SW(512, 128, pn(false)), 512, 128, { clamp: true }), ems: await tex(SW(512, 128, pn(true)), 512, 128, { clamp: true }) };
    const rng = U.rng(802);
    let r = `<rect width="512" height="512" fill="#5a656b"/>`;
    const rib = uid(), pat = uid();
    r += `<defs>${LG(rib, 0, 0, 1, 0, [[0, '#000', 0.3], [0.15, '#fff', 0.13], [0.5, '#000', 0.02], [1, '#000', 0.35]])}<pattern id="${pat}" width="24" height="10" patternUnits="userSpaceOnUse"><rect width="24" height="10" fill="url(#${rib})"/></pattern></defs><rect width="512" height="512" fill="url(#${pat})"/>`;
    r += N(512, 512, { bf: 0.1, oct: 4, seed: 34, color: '#6b3a16', op: 0.35, slope: 2.4, icpt: -1.1 });
    r += STAINS(512, 512, rng, { n: 6, colors: ['#3b2a14'], minR: 30, maxR: 90, op0: 0.4 });
    T.t.whRoof = { map: await tex(SW(512, 512, r), 512, 512) };
  };

  /* ---- VORTEX 酒店立面(1024,地标,24m宽 × 39m高) ---- */
  function hotelSVG(w, h, mode) {
    const rng = U.rng(901);
    const m = w / 24;
    let g = '';
    const floors = 11, f0 = h - 5 * m * (39 / 24) * 0.999;
    const fh = (h - (h - 34 * (h / 39))) / floors;
    if (mode === 'map') {
      const gid = uid();
      g += `<defs>${LG(gid, 0, 0, 0, 1, [[0, '#8a7f6f'], [1, '#6e6355']])}</defs><rect width="${w}" height="${h}" fill="url(#${gid})"/>`;
      g += N(w, h, { bf: 0.09, oct: 4, seed: 41, color: '#4c4438', op: 0.22 });
      const baseH = h * (5 / 39);
      g += `<rect x="0" y="${h - baseH}" width="${w}" height="${baseH}" fill="#7c6f5c"/>`;
      for (let i = 0; i < 5; i++) g += `<line x1="0" y1="${h - baseH + i * baseH / 5}" x2="${w}" y2="${h - baseH + i * baseH / 5}" stroke="#5c5142" stroke-width="3" opacity="0.7"/>`;
      const doorW = w * 0.22;
      g += `<rect x="${w / 2 - doorW / 2 - 14}" y="${h - baseH * 0.82}" width="${doorW + 28}" height="${baseH * 0.82}" fill="#3f382e"/>`;
      const dg = uid();
      g += `<defs>${LG(dg, 0, 0, 0, 1, [[0, '#5c6f80'], [1, '#26303a']])}</defs>`;
      g += `<rect x="${w / 2 - doorW / 2}" y="${h - baseH * 0.78}" width="${doorW}" height="${baseH * 0.78}" fill="url(#${dg})"/>`;
      g += `<line x1="${w / 2}" y1="${h - baseH * 0.78}" x2="${w / 2}" y2="${h}" stroke="#b89a55" stroke-width="5"/>`;
      g += `<rect x="${w / 2 - doorW / 2}" y="${h - baseH * 0.78}" width="${doorW}" height="${baseH * 0.78}" fill="none" stroke="#b89a55" stroke-width="4"/>`;
      for (const sx of [w * 0.14, w * 0.72]) {
        g += `<rect x="${sx}" y="${h - baseH * 0.72}" width="${w * 0.14}" height="${baseH * 0.5}" fill="#2c333c"/>`;
        g += `<rect x="${sx}" y="${h - baseH * 0.72}" width="${w * 0.14}" height="${baseH * 0.5}" fill="none" stroke="#6e6355" stroke-width="4"/>`;
        g += `<polygon points="${sx},${h - baseH * 0.72} ${sx + w * 0.07},${h - baseH * 0.72} ${sx},${h - baseH * 0.35}" fill="#fff" opacity="0.12"/>`;
      }
      const topY = h * (1.2 / 39);
      const upperH = h - baseH - topY;
      const ufh = upperH / floors;
      for (let f = 0; f < floors; f++) {
        const y = topY + f * ufh;
        g += `<rect x="0" y="${y + ufh - 6}" width="${w}" height="6" fill="#5c5244" opacity="0.8"/>`;
        for (let c = 0; c < 5; c++) {
          const x = w * 0.06 + c * w * 0.184;
          const ww = w * 0.128, wh2 = ufh * 0.62;
          g += windowSVG(x, y + ufh * 0.16, ww, wh2, rng, { frame: '#57503f', div: 2 });
          if (c >= 1 && c <= 3) {
            g += `<rect x="${x - 10}" y="${y + ufh * 0.16 + wh2 + 8}" width="${ww + 20}" height="10" fill="#6e6355"/>`;
            for (let b = 0; b < 7; b++) g += `<rect x="${x - 6 + b * (ww + 12) / 7}" y="${y + ufh * 0.16 + wh2 - 26}" width="4" height="36" fill="#4c4335" opacity="0.9"/>`;
          }
        }
        g += STREAKS(w, h, rng, { n: 2, color: '#3d352a', op: 0.22, y: y + ufh * 0.8, maxL: ufh * 0.9, maxW: 4 });
      }
      for (const nx of [w * 0.025, w * 0.955]) g += `<rect x="${nx}" y="${topY + ufh}" width="${w * 0.022}" height="${upperH * 0.8}" fill="#3a2f3f" rx="6"/>`;
      g += `<rect x="0" y="${topY - 6}" width="${w}" height="10" fill="#57503f"/>`;
      g += EDGE(w, h, 0.16);
    } else {
      g += `<rect width="${w}" height="${h}" fill="#000"/>`;
      const baseH = h * (5 / 39), topY = h * (1.2 / 39);
      const upperH = h - baseH - topY, ufh = upperH / floors;
      for (let f = 0; f < floors; f++) {
        const y = topY + f * ufh;
        for (let c = 0; c < 5; c++) {
          if (rng() < 0.62) {
            const x = w * 0.06 + c * w * 0.184;
            const warm = rng() < 0.85 ? '#ffbd75' : '#d8e6ff';
            g += `<rect x="${x}" y="${y + ufh * 0.16}" width="${w * 0.128}" height="${ufh * 0.62}" fill="${warm}" opacity="${U.rand(rng, 0.5, 1)}"/>`;
          }
        }
      }
      for (const nx of [w * 0.025, w * 0.955]) g += `<rect x="${nx}" y="${topY + ufh}" width="${w * 0.022}" height="${upperH * 0.8}" fill="#e34fd0" rx="6"/>`;
      const dg2 = uid();
      g += `<defs>${LG(dg2, 0, 0, 0, 1, [[0, '#ffe2b0', 0.9], [1, '#ffe2b0', 0.2]])}</defs>`;
      g += `<rect x="${w * 0.36}" y="${h - baseH * 0.8}" width="${w * 0.28}" height="${baseH * 0.8}" fill="url(#${dg2})"/>`;
    }
    return g;
  }
  B.hotel = async () => {
    const w = 1024, h = 1024;
    T.t.hotel = { map: await tex(SW(w, h, hotelSVG(w, h, 'map')), w, h), ems: await tex(SW(w, h, hotelSVG(w, h, 'ems')), w, h) };
    const rng = U.rng(902);
    let s = `<rect width="512" height="1024" fill="#7a6f5f"/>` + N(512, 1024, { bf: 0.08, oct: 4, seed: 43, color: '#4c4438', op: 0.25 });
    let se = `<rect width="512" height="1024" fill="#000"/>`;
    for (let f = 0; f < 11; f++) for (let c = 0; c < 3; c++) {
      const x = 60 + c * 150, y = 60 + f * 86;
      s += windowSVG(x, y, 70, 52, rng, { frame: '#57503f' });
      if (rng() < 0.4) se += `<rect x="${x}" y="${y}" width="70" height="52" fill="#ffbd75" opacity="${U.rand(rng, 0.4, 0.9)}"/>`;
    }
    s += STREAKS(512, 1024, rng, { n: 12, color: '#3d352a', op: 0.3, maxL: 300 });
    s += EDGE(512, 1024, 0.2);
    T.t.hotelSide = { map: await tex(SW(512, 1024, s), 512, 1024), ems: await tex(SW(512, 1024, se), 512, 1024) };
    /* 霓虹招牌 VORTEX(透明底,发光用) */
    const neon = (glow) => {
      let n = '';
      if (glow) { const f = uid(); n += `<filter id="${f}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="10"/></filter><g filter="url(#${f})">${TXT(256, 96, 86, '#ff4fd8', 'VORTEX', { ls: 8 })}</g>`; }
      n += TXT(256, 96, 86, glow ? '#ffd6f5' : '#3d2438', 'VORTEX', { ls: 8 });
      n += TXT(256, 152, 34, glow ? '#8fe8ff' : '#1d3038', '漩 涡 酒 店', { font: "'Microsoft YaHei',sans-serif", ls: 16 });
      return n;
    };
    T.t.neon = { map: await tex(SW(512, 256, neon(false)), 512, 256, { clamp: true }), ems: await tex(SW(512, 256, neon(true)), 512, 256, { clamp: true }) };
  };

  /* ---- AXIOM 玻璃塔(1024,地标) ---- */
  function towerSVG(w, h, mode) {
    const rng = U.rng(1001);
    const cols = 8, rows = 20;
    let g = '';
    if (mode === 'map') {
      const sky = uid();
      g += `<defs>${LG(sky, 0, 0, 0, 1, [[0, '#a8c8de'], [0.35, '#7099b8'], [0.7, '#3c5d7d'], [1, '#1d3048']])}</defs>`;
      g += `<rect width="${w}" height="${h}" fill="url(#${sky})"/>`;
      const cl = uid();
      g += `<filter id="${cl}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="4" seed="44"/><feColorMatrix type="luminanceToAlpha"/><feComponentTransfer><feFuncA type="linear" slope="1.8" intercept="-0.45"/></feComponentTransfer><feFlood flood-color="#e8f2fa"/><feComposite in2="SourceAlpha" operator="in"/></filter><rect x="0" y="0" width="${w}" height="${h * 0.5}" filter="url(#${cl})" opacity="0.5"/>`;
      g += `<polygon points="0,${h * 0.86} ${w * 0.55},0 ${w * 0.75},0 ${w * 0.2},${h}" fill="#ffffff" opacity="0.10"/>`;
      g += `<polygon points="${w * 0.3},${h} ${w * 0.9},0 ${w},0 ${w * 0.55},${h}" fill="#0c1622" opacity="0.18"/>`;
      for (let r = 0; r <= rows; r++) g += `<rect x="0" y="${r * h / rows - 2}" width="${w}" height="4" fill="#1b2733" opacity="0.85"/>`;
      for (let c = 0; c <= cols; c++) g += `<rect x="${c * w / cols - 2.5}" y="0" width="5" height="${h}" fill="#141e28" opacity="0.9"/>`;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (rng() < 0.12) g += `<rect x="${c * w / cols + 3}" y="${r * h / rows + 3}" width="${w / cols - 6}" height="${h / rows - 6}" fill="#0e1824" opacity="${U.rand(rng, 0.15, 0.4)}"/>`;
      g += `<rect x="0" y="0" width="${w}" height="${h * 0.045}" fill="#242c34"/>`;
      for (let i = 0; i < 40; i++) g += `<rect x="${i * w / 40 + 3}" y="6" width="${w / 40 - 6}" height="${h * 0.03}" fill="#161c22"/>`;
      g += N(w, h, { bf: 0.006, oct: 3, seed: 45, color: '#0a141e', op: 0.14 });
    } else if (mode === 'ems') {
      g += `<rect width="${w}" height="${h}" fill="#000"/>`;
      for (let r = 1; r < rows; r++) {
        const busy = rng() < 0.5;
        for (let c = 0; c < cols; c++) if (rng() < (busy ? 0.55 : 0.18)) {
          const cc = rng() < 0.75 ? '#cfe2ff' : '#ffe3b8';
          g += `<rect x="${c * w / cols + 4}" y="${r * h / rows + 4}" width="${w / cols - 8}" height="${h / rows - 8}" fill="${cc}" opacity="${U.rand(rng, 0.4, 0.95)}"/>`;
        }
      }
      g += `<rect x="${w * 0.30}" y="${h * 0.955}" width="${w * 0.4}" height="${h * 0.03}" fill="#9fdcff" opacity="0.9"/>`;
    } else {
      g += `<rect width="${w}" height="${h}" fill="#282828"/>`;
      for (let r = 0; r <= rows; r++) g += `<rect x="0" y="${r * h / rows - 2}" width="${w}" height="4" fill="#909090"/>`;
      for (let c = 0; c <= cols; c++) g += `<rect x="${c * w / cols - 2.5}" y="0" width="5" height="${h}" fill="#909090"/>`;
    }
    return g;
  }
  B.tower = async () => {
    const w = 1024, h = 1024;
    T.t.tower = {
      map: await tex(SW(w, h, towerSVG(w, h, 'map')), w, h),
      ems: await tex(SW(w, h, towerSVG(w, h, 'ems')), w, h),
      rgh: await tex(SW(w, h, towerSVG(w, h, 'rgh')), w, h, { srgb: false })
    };
    T.t.axiomLogo = { map: await tex(SW(512, 128, `<rect width="512" height="128" fill="#10161d"/>` + TXT(256, 92, 76, '#e8f4ff', 'AXIOM', { ls: 26 })), 512, 128, { clamp: true }) };
  };

  /* ---- OCTAN 加油站 ---- */
  B.gas = async () => {
    const rng = U.rng(1101);
    const w = 1024, h = 256;
    const mk = (ems) => {
      let g = ems ? `<rect width="${w}" height="${h}" fill="#000"/>` : `<rect width="${w}" height="${h}" fill="#e8e5dc"/>`;
      if (!ems) {
        g += N(w, h, { bf: 0.03, oct: 4, seed: 47, color: '#9a958a', op: 0.25 });
        g += `<rect x="0" y="150" width="${w}" height="46" fill="#c8342c"/><rect x="0" y="196" width="${w}" height="18" fill="#2b4f8e"/>`;
        g += STREAKS(w, h, rng, { n: 10, color: '#5c5850', op: 0.3, maxL: 80 });
      } else {
        g += `<rect x="0" y="150" width="${w}" height="46" fill="#ff5a50" opacity="0.75"/>`;
      }
      g += TXT(w / 2, 110, 92, ems ? '#ffffff' : '#20304a', 'OCTAN', { ls: 30 });
      if (ems) g += TXT(w / 2, 110, 92, '#bfe8ff', 'OCTAN', { ls: 30, op: 0.9 });
      return g;
    };
    T.t.canopy = { map: await tex(SW(w, h, mk(false)), w, h), ems: await tex(SW(w, h, mk(true)), w, h) };
    const pm = (ems) => {
      let g = ems ? `<rect width="256" height="256" fill="#000"/>` : `<rect width="256" height="256" fill="#d8d5cc"/>`;
      if (!ems) {
        g += `<rect x="0" y="0" width="256" height="40" fill="#c8342c"/>`;
        g += `<rect x="24" y="60" width="96" height="70" fill="#1d2b1e" rx="4"/>`;
        g += `<rect x="140" y="60" width="60" height="120" fill="#4a4740" rx="4"/><circle cx="170" cy="90" r="14" fill="#2c2a26"/>`;
        g += `<rect x="24" y="150" width="96" height="60" fill="#b8b4a8" rx="3"/>`;
        g += N(256, 256, { bf: 0.06, oct: 3, seed: 48, color: '#6b675c', op: 0.3 });
        g += STAINS(256, 256, rng, { n: 4, colors: ['#33291c'], minR: 10, maxR: 30, op0: 0.5 });
        g += TXT(72, 105, 22, '#7fe87f', '92', {});
      } else {
        g += `<rect x="24" y="60" width="96" height="70" fill="#4fe87f" opacity="0.85" rx="4"/>`;
      }
      return g;
    };
    T.t.pump = { map: await tex(SW(256, 256, pm(false)), 256, 256), ems: await tex(SW(256, 256, pm(true)), 256, 256) };
    const gs = (ems) => {
      let g = ems ? `<rect width="256" height="512" fill="#000"/>` : `<rect width="256" height="512" fill="#20304a"/>`;
      g += TXT(128, 100, 64, ems ? '#bfe8ff' : '#e8e5dc', 'OCTAN', {});
      const rows = [['92', '7.59'], ['95', '8.12'], ['98', '9.03']];
      rows.forEach((r2, i) => {
        const y = 190 + i * 90;
        if (!ems) g += `<rect x="24" y="${y - 52}" width="208" height="72" fill="#101a28" rx="6"/>`;
        g += TXT(70, y, 44, ems ? '#8fe8a0' : '#4fe87f', r2[0], {});
        g += TXT(170, y, 44, ems ? '#ffd9a0' : '#e8b45a', r2[1], {});
      });
      if (!ems) g += N(256, 512, { bf: 0.04, oct: 3, seed: 49, color: '#000', op: 0.3 });
      return g;
    };
    T.t.gasSign = { map: await tex(SW(256, 512, gs(false)), 256, 512, { clamp: true }), ems: await tex(SW(256, 512, gs(true)), 256, 512, { clamp: true }) };
  };

  /* ---- 竖招牌(256×512 ×4) ---- */
  B.signs = async () => {
    const defs = [
      { txt: '龍門麵館', c1: '#8f1d1d', neon: '#ff6b5a' }, { txt: '夜貓電玩', c1: '#2a1d5e', neon: '#7f8bff' },
      { txt: '紅霓KTV', c1: '#5e1d3f', neon: '#ff5ad8' }, { txt: '藍灣酒吧', c1: '#123a52', neon: '#4fd8ff' }
    ];
    T.t.signs = [];
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i], rng = U.rng(1200 + i);
      const mk = (ems) => {
        let g = ems ? `<rect width="256" height="512" fill="#000"/>` : `<rect width="256" height="512" fill="#22201d"/>`;
        if (!ems) {
          g += `<rect x="12" y="12" width="232" height="488" fill="${d.c1}" rx="10"/>`;
          g += `<rect x="12" y="12" width="232" height="488" fill="none" stroke="#0e0d0b" stroke-width="6" rx="10"/>`;
          g += N(256, 512, { bf: 0.05, oct: 4, seed: 50 + i, color: '#000', op: 0.35 });
          g += STREAKS(256, 512, rng, { n: 6, color: '#120f0c', op: 0.4, maxL: 120 });
        }
        const chars = d.txt.split('');
        chars.forEach((ch, k) => {
          const y = 96 + k * (400 / chars.length);
          if (ems) { const f = uid(); g += `<filter id="${f}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8"/></filter><g filter="url(#${f})">${TXT(128, y, 74, d.neon, ch, { font: "'Microsoft YaHei','SimHei',sans-serif" })}</g>`; }
          g += TXT(128, y, 74, ems ? '#ffffff' : '#d8d2c4', ch, { font: "'Microsoft YaHei','SimHei',sans-serif", op: ems ? 1 : 0.9 });
        });
        return g;
      };
      T.t.signs.push({ map: await tex(SW(256, 512, mk(false)), 256, 512, { clamp: true }), ems: await tex(SW(256, 512, mk(true)), 256, 512, { clamp: true }) });
    }
  };

  /* ---- 广告牌 ×3(1024×512) ---- */
  B.bill = async () => {
    const w = 1024, h = 512;
    T.t.bill = [];
    const ads = [];
    ads.push(() => {
      const g1 = uid();
      let g = `<defs>${LG(g1, 0, 0, 0, 1, [[0, '#d92b2b'], [1, '#7d1010']])}</defs><rect width="${w}" height="${h}" fill="url(#${g1})"/>`;
      for (let i = 0; i < 22; i++) g += `<polygon points="${w * 0.28},${h * 0.5} ${w * 0.28 + Math.cos(i / 22 * U.TAU) * w},${h * 0.5 + Math.sin(i / 22 * U.TAU) * w} ${w * 0.28 + Math.cos((i + 0.5) / 22 * U.TAU) * w},${h * 0.5 + Math.sin((i + 0.5) / 22 * U.TAU) * w}" fill="#ffffff" opacity="0.06"/>`;
      g += `<rect x="${w * 0.22}" y="${h * 0.18}" width="${w * 0.115}" height="${h * 0.62}" rx="28" fill="#3d1108"/>`;
      g += `<rect x="${w * 0.22}" y="${h * 0.18}" width="${w * 0.115}" height="${h * 0.62}" rx="28" fill="none" stroke="#00000055" stroke-width="5"/>`;
      g += `<rect x="${w * 0.235}" y="${h * 0.14}" width="${w * 0.085}" height="${h * 0.1}" rx="10" fill="#c8342c"/>`;
      g += `<polygon points="${w * 0.24},${h * 0.3} ${w * 0.31},${h * 0.34} ${w * 0.24},${h * 0.62}" fill="#ffffff" opacity="0.25"/>`;
      for (let i = 0; i < 30; i++) { const rr = U.rng(60 + i); g += `<circle cx="${w * 0.22 + rr() * w * 0.115}" cy="${h * 0.2 + rr() * h * 0.58}" r="${1 + rr() * 3}" fill="#fff" opacity="0.35"/>`; }
      g += TXT(w * 0.63, h * 0.42, 120, '#fff', 'NOVA可乐', { font: "'Arial Black','Microsoft YaHei',sans-serif" });
      g += TXT(w * 0.63, h * 0.62, 52, '#ffe1b0', '冰 爽 上 市', { font: "'Microsoft YaHei',sans-serif", ls: 18 });
      return g;
    });
    ads.push(() => {
      const g1 = uid();
      let g = `<defs>${LG(g1, 0, 0, 0, 1, [[0, '#1d0f3d'], [0.55, '#7d2a6e'], [0.75, '#e8743d'], [1, '#ffd270']])}</defs><rect width="${w}" height="${h}" fill="url(#${g1})"/>`;
      g += `<circle cx="${w / 2}" cy="${h * 0.72}" r="${h * 0.34}" fill="#ffde8f"/>`;
      for (let i = 0; i < 5; i++) g += `<rect x="${w / 2 - h * 0.36}" y="${h * 0.62 + i * 26}" width="${h * 0.72}" height="9" fill="#7d2a6e" opacity="0.8"/>`;
      for (let i = 0; i < 12; i++) g += `<line x1="${i * w / 12}" y1="${h}" x2="${w / 2}" y2="${h * 0.55}" stroke="#ff6bd8" stroke-width="2" opacity="0.5"/>`;
      for (let i = 1; i < 5; i++) g += `<line x1="0" y1="${h * 0.72 + i * i * 8}" x2="${w}" y2="${h * 0.72 + i * i * 8}" stroke="#ff6bd8" stroke-width="2" opacity="0.5"/>`;
      g += TXT(w / 2, h * 0.3, 110, '#8fe8ff', 'VAPOR 88.8', {});
      g += TXT(w / 2, h * 0.44, 44, '#ffd6f5', '合成器之夜 · 整夜放送', { font: "'Microsoft YaHei',sans-serif", ls: 8 });
      return g;
    });
    ads.push(() => {
      let g = `<rect width="${w}" height="${h}" fill="#0c1420"/>`;
      const rng = U.rng(71);
      for (let i = 0; i < 26; i++) {
        const bw = U.rand(rng, 30, 90), bh = U.rand(rng, 60, 240), x = U.rand(rng, 0, w - bw);
        g += `<rect x="${x}" y="${h - bh - 60}" width="${bw}" height="${bh}" fill="#101c2c"/>`;
        for (let k = 0; k < 8; k++) if (rng() < 0.4) g += `<rect x="${x + 4 + (k % 3) * bw / 3}" y="${h - bh - 52 + Math.floor(k / 3) * 30}" width="${bw / 4}" height="14" fill="${rng() < 0.5 ? '#ffd9a0' : '#8fd8ff'}" opacity="0.8"/>`;
      }
      g += `<circle cx="${w * 0.82}" cy="${h * 0.2}" r="52" fill="#f5edd8"/><circle cx="${w * 0.8}" cy="${h * 0.19}" r="50" fill="#0c1420" opacity="0.25"/>`;
      g += `<rect x="0" y="${h - 60}" width="${w}" height="60" fill="#050a12"/>`;
      g += TXT(w / 2, h * 0.42, 96, '#ff5ad8', '遇见霓虹', { font: "'Microsoft YaHei','SimHei',sans-serif", ls: 12 });
      g += TXT(w / 2, h * 0.58, 40, '#8fe8ff', '海市文旅 · NEON HARBOR TOURISM', { font: "'Microsoft YaHei',sans-serif" });
      return g;
    });
    for (let i = 0; i < 3; i++) {
      let g = ads[i]();
      g += N(w, h, { bf: 0.008, oct: 3, seed: 72 + i, color: '#000', op: 0.12 });
      g += EDGE(w, h, 0.2);
      T.t.bill.push({ map: await tex(SW(w, h, g), w, h, { clamp: true }) });
    }
  };

  /* ---- 树叶簇卡片 / 树皮 / 远景公告板 ---- */
  function leafCard(w, seed, kind, dry) {
    const rng = U.rng(seed);
    let g = '';
    const n = kind === 'palm' ? 9 : 66;
    for (let i = 0; i < n; i++) {
      const cx = w / 2 + U.rand(rng, -w * 0.32, w * 0.32), cy = w / 2 + U.rand(rng, -w * 0.3, w * 0.3);
      const edge = Math.hypot(cx - w / 2, cy - w / 2) / (w * 0.42);
      if (edge > 1) continue;
      const rot = U.rand(rng, 0, 360);
      if (kind === 'palm') {
        const len = w * 0.44, fr = uid();
        let fro = `<g transform="translate(${w / 2} ${w / 2}) rotate(${i * 40 + U.rand(rng, -12, 12)})">`;
        fro += `<path d="M0 0 Q ${len * 0.5} ${-len * 0.16} ${len} ${-len * 0.05}" stroke="${dry ? '#8a7a3d' : '#3d6b2a'}" stroke-width="5" fill="none"/>`;
        for (let k = 1; k < 14; k++) {
          const t = k / 14, px = len * t, py = -len * 0.16 * Math.sin(t * Math.PI);
          const bl = len * 0.16 * (1 - t * 0.5);
          fro += `<line x1="${px}" y1="${py}" x2="${px + bl * 0.35}" y2="${py - bl}" stroke="${dry ? '#9a8a4a' : '#4c7d33'}" stroke-width="3.5"/>`;
          fro += `<line x1="${px}" y1="${py}" x2="${px + bl * 0.45}" y2="${py + bl * 0.8}" stroke="${dry ? '#8a7a3d' : '#446e2c'}" stroke-width="3.5"/>`;
        }
        g += fro + '</g>';
        continue;
      }
      let base;
      if (dry) base = [150 + U.rand(rng, -20, 30), 105 + U.rand(rng, -25, 20), 45];
      else if (kind === 'ginkgo') base = [130 + U.rand(rng, -25, 25), 150 + U.rand(rng, -20, 20), 52];
      else base = [66 + U.rand(rng, -18, 22), 108 + U.rand(rng, -20, 24), 44 + U.rand(rng, -8, 12)];
      const c = `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`;
      const dk = `rgb(${base[0] * 0.55 | 0},${base[1] * 0.6 | 0},${base[2] * 0.5 | 0})`;
      const s = U.rand(rng, 9, 16) * (1 - edge * 0.35);
      if (kind === 'ginkgo') {
        g += `<g transform="translate(${cx} ${cy}) rotate(${rot})"><path d="M0 0 L${s * 0.8} ${-s} A ${s} ${s} 0 0 1 ${-s * 0.8} ${-s} Z" fill="${c}"/><line x1="0" y1="0" x2="0" y2="${-s}" stroke="${dk}" stroke-width="1"/></g>`;
      } else {
        g += `<g transform="translate(${cx} ${cy}) rotate(${rot})"><path d="M0 ${s} C ${s} ${s * 0.4} ${s * 0.9} ${-s * 0.5} 0 ${-s} C ${-s * 0.9} ${-s * 0.5} ${-s} ${s * 0.4} 0 ${s} Z" fill="${c}"/><line x1="0" y1="${s}" x2="0" y2="${-s * 0.8}" stroke="${dk}" stroke-width="1.2"/></g>`;
      }
    }
    return g;
  }
  B.leaves = async () => {
    const w = 256;
    T.t.leafA = { map: await tex(SW(w, w, leafCard(w, 2001, 'broad', false)), w, w, { clamp: true }) };
    T.t.leafAdry = { map: await tex(SW(w, w, leafCard(w, 2002, 'broad', true)), w, w, { clamp: true }) };
    T.t.leafB = { map: await tex(SW(w, w, leafCard(w, 2003, 'ginkgo', false)), w, w, { clamp: true }) };
    T.t.leafC = { map: await tex(SW(w, w, leafCard(w, 2004, 'palm', false)), w, w, { clamp: true }) };
    /* 树皮 */
    const rng = U.rng(2010);
    let bark = `<rect width="256" height="256" fill="#6b6152"/>`;
    bark += BUMP(256, 256, { color: '#6b6152', bf: '0.02 0.15', oct: 4, seed: 61, scale: 2.6 });
    for (let i = 0; i < 12; i++) { const x = U.rand(rng, 0, 256), y0 = U.rand(rng, 0, 100); bark += `<ellipse cx="${x}" cy="${y0 + 90}" rx="${U.rand(rng, 14, 30)}" ry="${U.rand(rng, 24, 50)}" fill="${U.pick(rng, ['#8f8570', '#a89b80', '#57503f', '#7d7461'])}" opacity="0.65"/>`; }
    bark += N(256, 256, { bf: '0.03 0.3', oct: 4, seed: 62, color: '#2c261d', op: 0.35 });
    let barkH = `<rect width="256" height="256" fill="#808080"/>` + N(256, 256, { bf: '0.02 0.2', oct: 5, seed: 61, color: '#000', op: 0.55, slope: 1.4 });
    T.t.bark = { map: await tex(SW(256, 256, bark), 256, 256), nrm: await nrmTex(SW(256, 256, barkH), 256, 256, 1.4) };
    let palm = `<rect width="256" height="256" fill="#8a7a5e"/>`;
    for (let y = 0; y < 256; y += 22) palm += `<rect x="0" y="${y}" width="256" height="10" fill="#6e6047" opacity="0.8"/><rect x="0" y="${y + 10}" width="256" height="3" fill="#4c4130"/>`;
    palm += N(256, 256, { bf: 0.1, oct: 3, seed: 63, color: '#3d3524', op: 0.3 });
    T.t.palmT = { map: await tex(SW(256, 256, palm), 256, 256) };
    /* 远景公告板(竖幅树像) */
    const bills = [['broad', '#4c7a34'], ['ginkgo', '#7d9438'], ['palm', '#4c7a34']];
    T.t.treeBill = [];
    for (let i = 0; i < 3; i++) {
      const kind = bills[i][0];
      let b = '';
      if (kind === 'palm') {
        b += `<rect x="118" y="220" width="16" height="290" fill="#8a7a5e" rx="6"/>`;
        for (let y = 230; y < 500; y += 26) b += `<rect x="118" y="${y}" width="16" height="6" fill="#5c5138"/>`;
        b += `<g transform="translate(128 220)">` + leafCard(256, 2020 + i, 'palm', false).replace(/translate\(128 128\)/g, 'translate(0 0)') + `</g>`;
      } else {
        b += `<rect x="120" y="260" width="14" height="250" fill="#6b6152"/>`;
        for (const [ox, oy, s] of [[-52, -40, 1], [46, -30, 0.9], [0, 10, 1.15], [-30, 40, 0.8], [30, 50, 0.75]]) {
          b += `<g transform="translate(${128 + ox} ${170 + oy}) scale(${s})" >` + leafCard(256, 2030 + i * 7 + ox, kind, false).replace(/translate\((\d+\.?\d*) (\d+\.?\d*)\)/g, (m, a, bb) => `translate(${a - 128} ${bb - 128})`) + `</g>`;
        }
      }
      T.t.treeBill.push({ map: await tex(SW(256, 512, b), 256, 512, { clamp: true }) });
    }
  };

  /* ---- 角色贴图 ---- */
  B.chars = async () => {
    const rng = U.rng(3001);
    /* 头部(车削 UV:u 环向缝在背后,v 沿轮廓) */
    const face = () => {
      let g = `<rect width="512" height="512" fill="#e2af88"/>`;
      g += N(512, 512, { bf: 0.08, oct: 4, seed: 81, color: '#b57d5c', op: 0.18 });
      g += N(512, 512, { bf: 0.4, oct: 2, seed: 82, color: '#fff', op: 0.05, slope: 2 });
      const hairC = '#2e2118', hiC = '#4a3826';
      g += `<rect x="0" y="0" width="512" height="150" fill="${hairC}"/>`;
      g += `<path d="M0 150 Q 80 130 128 150 L 128 200 Q 60 190 0 210 Z" fill="${hairC}"/>`;
      g += `<path d="M512 150 Q 432 130 384 150 L 384 200 Q 452 190 512 210 Z" fill="${hairC}"/>`;
      g += `<path d="M128 150 Q 200 118 256 128 Q 312 118 384 150 L 384 118 Q 256 84 128 118 Z" fill="${hairC}"/>`;
      for (let i = 0; i < 40; i++) { const x = U.rand(rng, 0, 512); g += `<line x1="${x}" y1="${U.rand(rng, 0, 60)}" x2="${x + U.rand(rng, -14, 14)}" y2="${U.rand(rng, 90, 150)}" stroke="${hiC}" stroke-width="1.5" opacity="0.5"/>`; }
      const eye = (cx) => {
        let e = `<ellipse cx="${cx}" cy="248" rx="26" ry="13" fill="#f2ece2"/>`;
        e += `<circle cx="${cx}" cy="249" r="10" fill="#5b3d20"/><circle cx="${cx}" cy="249" r="4.5" fill="#140d08"/><circle cx="${cx + 3}" cy="245" r="2.5" fill="#fff" opacity="0.9"/>`;
        e += `<path d="M${cx - 27} 244 Q ${cx} 230 ${cx + 27} 244" stroke="#8a5c3d" stroke-width="3" fill="none"/>`;
        e += `<path d="M${cx - 30} 226 Q ${cx} 212 ${cx + 30} 224" stroke="#332416" stroke-width="7" fill="none" stroke-linecap="round"/>`;
        return e;
      };
      g += eye(204); g += eye(308);
      g += `<path d="M256 250 L 250 298 Q 256 306 262 298 Z" fill="#c9906b" opacity="0.7"/>`;
      g += `<ellipse cx="250" cy="304" rx="4" ry="2.5" fill="#8a5c3d" opacity="0.8"/><ellipse cx="262" cy="304" rx="4" ry="2.5" fill="#8a5c3d" opacity="0.8"/>`;
      g += `<path d="M226 340 Q 256 352 286 340" stroke="#9a5c48" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      g += `<path d="M230 346 Q 256 360 282 346" stroke="#c9836b" stroke-width="3" fill="none" opacity="0.6"/>`;
      g += `<ellipse cx="180" cy="300" rx="22" ry="14" fill="#d89a72" opacity="0.35"/><ellipse cx="332" cy="300" rx="22" ry="14" fill="#d89a72" opacity="0.35"/>`;
      g += `<rect x="0" y="420" width="512" height="92" fill="#00000022"/>`;
      return g;
    };
    T.t.face = { map: await tex(SW(512, 512, face()), 512, 512) };
    /* 夹克(圆柱包裹:拉链在 u=0.5) */
    const jacket = () => {
      let g = `<rect width="512" height="512" fill="#3d4450"/>`;
      g += N(512, 512, { bf: 0.06, oct: 4, seed: 83, color: '#20242c', op: 0.4 });
      g += N(512, 512, { bf: 0.3, oct: 3, seed: 84, color: '#5c6675', op: 0.16, slope: 1.8 });
      g += SPEC(512, 512, { bf: 0.08, op: 0.1 });
      g += `<rect x="250" y="0" width="12" height="512" fill="#23262d"/>`;
      for (let y = 6; y < 512; y += 12) g += `<rect x="252" y="${y}" width="8" height="6" fill="#9aa2ae"/>`;
      g += `<circle cx="256" cy="470" r="7" fill="#9aa2ae"/><rect x="253" y="470" width="6" height="16" fill="#7d8590"/>`;
      g += `<rect x="0" y="0" width="512" height="34" fill="#2c313a"/>`;
      for (let x = 0; x < 512; x += 8) g += `<line x1="${x}" y1="0" x2="${x}" y2="34" stroke="#20242c" stroke-width="2"/>`;
      for (const px of [150, 362]) {
        g += `<line x1="${px - 40}" y1="150" x2="${px + 40}" y2="185" stroke="#23262d" stroke-width="6"/>`;
        g += `<line x1="${px - 40}" y1="150" x2="${px + 40}" y2="185" stroke="#9aa2ae" stroke-width="2" stroke-dasharray="4 3"/>`;
      }
      for (const sx of [80, 432]) g += `<line x1="${sx}" y1="0" x2="${sx}" y2="512" stroke="#2c313a" stroke-width="4"/>`;
      g += `<path d="M0 480 Q 128 460 256 480 Q 384 460 512 480 L 512 512 L 0 512 Z" fill="#2c313a"/>`;
      g += STAINS(512, 512, rng, { n: 3, colors: ['#1d2026'], minR: 20, maxR: 60, op0: 0.3 });
      return g;
    };
    T.t.jacket = { map: await tex(SW(512, 512, jacket()), 512, 512) };
    let arm = `<rect width="256" height="256" fill="#3d4450"/>` + N(256, 256, { bf: 0.1, oct: 4, seed: 85, color: '#20242c', op: 0.4 }) + N(256, 256, { bf: 0.4, oct: 2, seed: 86, color: '#5c6675', op: 0.14, slope: 2 });
    arm += `<rect x="0" y="230" width="256" height="26" fill="#2c313a"/>`;
    for (let x = 0; x < 256; x += 7) arm += `<line x1="${x}" y1="230" x2="${x}" y2="256" stroke="#20242c" stroke-width="1.5"/>`;
    for (let i = 0; i < 5; i++) arm += `<path d="M0 ${120 + i * 8} Q 128 ${112 + i * 8} 256 ${120 + i * 8}" stroke="#2b303a" stroke-width="2.5" fill="none" opacity="0.6"/>`;
    T.t.jacketArm = { map: await tex(SW(256, 256, arm), 256, 256) };
    /* 牛仔裤 */
    const jeans = () => {
      let g = `<rect width="512" height="512" fill="#33507a"/>`;
      const tw = uid();
      g += `<defs><pattern id="${tw}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#33507a"/><line x1="0" y1="0" x2="0" y2="6" stroke="#3d5c88" stroke-width="2"/></pattern></defs><rect width="512" height="512" fill="url(#${tw})" opacity="0.7"/>`;
      g += N(512, 512, { bf: 0.09, oct: 4, seed: 87, color: '#1d3252', op: 0.4 });
      g += N(512, 512, { bf: 0.5, oct: 2, seed: 88, color: '#7d9ac4', op: 0.10, slope: 2.2 });
      const kg = uid();
      g += `<defs><radialGradient id="${kg}"><stop offset="0" stop-color="#7d9ac4" stop-opacity="0.5"/><stop offset="1" stop-color="#7d9ac4" stop-opacity="0"/></radialGradient></defs>`;
      g += `<ellipse cx="256" cy="240" rx="110" ry="70" fill="url(#${kg})"/>`;
      for (let i = 0; i < 6; i++) g += `<path d="M${170 + i * 4} ${215 + i * 12} Q 256 ${205 + i * 12} ${342 - i * 4} ${215 + i * 12}" stroke="#26436e" stroke-width="3" fill="none" opacity="0.5"/>`;
      for (const sx of [4, 254]) {
        g += `<line x1="${sx}" y1="0" x2="${sx}" y2="512" stroke="#26436e" stroke-width="6"/>`;
        g += `<line x1="${sx + 5}" y1="0" x2="${sx + 5}" y2="512" stroke="#c9873d" stroke-width="2" stroke-dasharray="6 4"/>`;
      }
      g += `<rect x="0" y="484" width="512" height="28" fill="#26436e"/><line x1="0" y1="486" x2="512" y2="486" stroke="#c9873d" stroke-width="2" stroke-dasharray="6 4"/>`;
      g += STAINS(512, 512, rng, { n: 3, colors: ['#1d2c44'], minR: 24, maxR: 60, op0: 0.35 });
      return g;
    };
    T.t.jeans = { map: await tex(SW(512, 512, jeans()), 512, 512) };
    /* 鞋 */
    let sh = `<rect width="256" height="256" fill="#d8d4c8"/>`;
    sh += N(256, 256, { bf: 0.15, oct: 3, seed: 89, color: '#8a857a', op: 0.3 });
    sh += `<rect x="0" y="190" width="256" height="66" fill="#f2efe6"/><line x1="0" y1="190" x2="256" y2="190" stroke="#9a958a" stroke-width="3"/>`;
    for (let x = 6; x < 256; x += 16) sh += `<line x1="${x}" y1="216" x2="${x + 8}" y2="216" stroke="#b8b4a8" stroke-width="4"/>`;
    for (let i = 0; i < 4; i++) sh += `<line x1="${70 + i * 26}" y1="60" x2="${96 + i * 26}" y2="90" stroke="#4a4740" stroke-width="5"/><line x1="${96 + i * 26}" y1="60" x2="${70 + i * 26}" y2="90" stroke="#4a4740" stroke-width="5"/>`;
    sh += STAINS(256, 256, rng, { n: 4, colors: ['#6b675c'], minR: 10, maxR: 40, op0: 0.4 });
    T.t.shoes = { map: await tex(SW(256, 256, sh), 256, 256) };
    let sk = `<rect width="256" height="256" fill="#e2af88"/>` + N(256, 256, { bf: 0.1, oct: 4, seed: 90, color: '#b57d5c', op: 0.16 }) + N(256, 256, { bf: 0.5, oct: 2, seed: 91, color: '#fff', op: 0.05, slope: 2 });
    T.t.skin = { map: await tex(SW(256, 256, sk), 256, 256) };
  };

  /* ---- 车辆共用 ---- */
  B.car = async () => {
    const rng = U.rng(4001);
    /* 轮胎:v 沿剖面(胎圈→侧壁→胎面→侧壁→胎圈),u 环向 */
    const tire = () => {
      let g = `<rect width="256" height="256" fill="#17181a"/>`;
      g += `<rect x="0" y="86" width="256" height="84" fill="#101113"/>`;
      for (const y of [96, 122, 148]) g += `<rect x="0" y="${y}" width="256" height="7" fill="#08090a"/>`;
      for (let x = 0; x < 256; x += 14) { g += `<rect x="${x}" y="86" width="6" height="36" fill="#0b0c0d"/>`; g += `<rect x="${x + 7}" y="134" width="6" height="36" fill="#0b0c0d"/>`; }
      for (const y of [52, 196]) { for (let x = 0; x < 256; x += 8) g += `<line x1="${x}" y1="${y - 8}" x2="${x + 4}" y2="${y + 8}" stroke="#1f2124" stroke-width="1.5"/>`; }
      g += `<rect x="0" y="30" width="256" height="10" fill="#232527" opacity="0.8"/><rect x="0" y="216" width="256" height="10" fill="#232527" opacity="0.8"/>`;
      g += N(256, 256, { bf: 0.3, oct: 3, seed: 92, color: '#000', op: 0.3 });
      g += N(256, 256, { bf: 0.06, oct: 3, seed: 93, color: '#3d3f42', op: 0.18 });
      return g;
    };
    T.t.tire = { map: await tex(SW(256, 256, tire()), 256, 256) };
    /* 车牌 */
    let pl = `<rect width="256" height="128" fill="#1d4ed8" rx="10"/><rect x="6" y="6" width="244" height="116" fill="none" stroke="#e8f4ff" stroke-width="4" rx="8"/>`;
    pl += TXT(128, 86, 56, '#ffffff', '海A·GT777', { font: "'Arial Black','Microsoft YaHei',sans-serif" });
    pl += `<circle cx="24" cy="24" r="5" fill="#c8d8f8"/><circle cx="232" cy="24" r="5" fill="#c8d8f8"/>`;
    pl += N(256, 128, { bf: 0.1, oct: 3, seed: 94, color: '#0c2048', op: 0.2 });
    T.t.plate = { map: await tex(SW(256, 128, pl), 256, 128, { clamp: true }) };
    /* 仪表台 */
    const dash = (ems) => {
      let g = ems ? `<rect width="512" height="256" fill="#000"/>` : `<rect width="512" height="256" fill="#1d1f24"/>`;
      if (!ems) { g += N(512, 256, { bf: 0.2, oct: 3, seed: 95, color: '#000', op: 0.3 }); g += N(512, 256, { bf: 0.04, oct: 3, seed: 96, color: '#3a3d45', op: 0.2 }); }
      for (const cx of [140, 260]) {
        g += `<circle cx="${cx}" cy="110" r="64" fill="${ems ? '#0a1418' : '#0c0e12'}"/>`;
        g += `<circle cx="${cx}" cy="110" r="64" fill="none" stroke="${ems ? '#3ddce8' : '#2c3038'}" stroke-width="4"/>`;
        for (let a = 0; a < 12; a++) { const an = Math.PI * 0.75 + a / 11 * Math.PI * 1.5; g += `<line x1="${cx + Math.cos(an) * 52}" y1="${110 + Math.sin(an) * 52}" x2="${cx + Math.cos(an) * 60}" y2="${110 + Math.sin(an) * 60}" stroke="${ems ? '#7fe8f2' : '#5c636e'}" stroke-width="3"/>`; }
        g += `<line x1="${cx}" y1="110" x2="${cx - 30}" y2="${110 + 40}" stroke="${ems ? '#ff5a50' : '#8a2f2a'}" stroke-width="5" stroke-linecap="round"/>`;
      }
      if (!ems) { for (let i = 0; i < 8; i++) g += `<rect x="${360 + (i % 4) * 34}" y="${70 + Math.floor(i / 4) * 44}" width="26" height="32" fill="#26282e" rx="4"/>`; }
      else g += `<rect x="356" y="66" width="140" height="84" fill="#2a6b8f" opacity="0.5" rx="6"/>`;
      for (let x = 0; x < 512; x += 10) g += `<line x1="${x}" y1="212" x2="${x}" y2="256" stroke="${ems ? '#000' : '#15171b'}" stroke-width="5"/>`;
      return g;
    };
    T.t.dash = { map: await tex(SW(512, 256, dash(false)), 512, 256, { clamp: true }), ems: await tex(SW(512, 256, dash(true)), 512, 256, { clamp: true }) };
    /* 座椅皮革 */
    let st = `<rect width="256" height="256" fill="#26282e"/>`;
    st += N(256, 256, { bf: 0.25, oct: 4, seed: 97, color: '#0e0f12', op: 0.35 });
    for (let i = 0; i < 5; i++) { st += `<rect x="30" y="${26 + i * 44}" width="196" height="34" rx="16" fill="#2c2f36"/>`; st += `<rect x="30" y="${26 + i * 44}" width="196" height="34" rx="16" fill="none" stroke="#16181c" stroke-width="3"/>`; st += `<line x1="36" y1="${43 + i * 44}" x2="220" y2="${43 + i * 44}" stroke="#1a1c21" stroke-width="2" stroke-dasharray="4 3"/>`; }
    st += SPEC(256, 256, { bf: 0.2, op: 0.12 });
    T.t.seat = { map: await tex(SW(256, 256, st), 256, 256) };
    /* 包裹(任务道具) */
    let pk = `<rect width="256" height="256" fill="#a87f4f"/>`;
    pk += N(256, 256, { bf: 0.08, oct: 4, seed: 98, color: '#7d5c35', op: 0.35 });
    pk += `<rect x="108" y="0" width="40" height="256" fill="#c9b98f" opacity="0.9"/><rect x="0" y="108" width="256" height="40" fill="#c9b98f" opacity="0.9"/>`;
    pk += `<rect x="30" y="170" width="80" height="52" fill="#f2efe6"/>`;
    for (let i = 0; i < 8; i++) pk += `<rect x="${36 + i * 8}" y="176" width="${2 + (i % 3)}" height="20" fill="#1d1f24"/>`;
    pk += TXT(70, 214, 20, '#c0392b', '急件', { font: "'Microsoft YaHei',sans-serif" });
    T.t.pkg = { map: await tex(SW(256, 256, pk), 256, 256) };
  };

  /* ---- 特效精灵 ---- */
  B.fxTex = async () => {
    const g1 = uid();
    T.t.flare = { map: await tex(SW(256, 256, `<defs><radialGradient id="${g1}"><stop offset="0" stop-color="#fff"/><stop offset="0.25" stop-color="#fff" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="256" height="256" fill="url(#${g1})"/>`), 256, 256, { clamp: true, nomip: false }) };
    const g2 = uid(), df = uid();
    T.t.smoke = { map: await tex(SW(128, 128, `<defs><radialGradient id="${g2}"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="0.7" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><filter id="${df}"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="7"/><feDisplacementMap in="SourceGraphic" scale="26"/></filter><circle cx="64" cy="64" r="46" fill="url(#${g2})" filter="url(#${df})"/>`), 128, 128, { clamp: true }) };
    let sk = `<defs>${LG(uid(), 0, 0, 1, 0, [[0, '#000', 0], [0.2, '#000', 0.75], [0.8, '#000', 0.75], [1, '#000', 0]])}</defs>`;
    const skg = sk.match(/id="(q\d+)"/)[1];
    sk += `<rect x="0" y="8" width="256" height="20" fill="url(#${skg})"/><rect x="0" y="36" width="256" height="20" fill="url(#${skg})"/>`;
    sk += N(256, 64, { bf: 0.2, oct: 3, seed: 99, color: '#fff', op: 0.5, slope: 2.4, icpt: -1 });
    T.t.skid = { map: await tex(SW(256, 64, sk), 256, 64) };
    /* 云 */
    T.t.cloud = [];
    for (let i = 0; i < 2; i++) {
      const rng = U.rng(5001 + i), cf = uid(), cg = uid();
      let c = `<defs><radialGradient id="${cg}"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.8" stop-color="#f4f7fa" stop-opacity="0.55"/><stop offset="1" stop-color="#eef2f6" stop-opacity="0"/></radialGradient><filter id="${cf}" x="-20%" y="-40%" width="140%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="4" seed="${11 + i * 3}"/><feDisplacementMap in="SourceGraphic" scale="46"/></filter></defs><g filter="url(#${cf})">`;
      for (let k = 0; k < 9; k++) { const x = 80 + U.rand(rng, 0, 340), y = 90 + U.rand(rng, -26, 30), r = U.rand(rng, 34, 76); c += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.55}" fill="url(#${cg})"/>`; }
      c += `</g>`;
      T.t.cloud.push({ map: await tex(SW(512, 256, c), 512, 256, { clamp: true }) });
    }
    /* 月亮 */
    const mg = uid();
    let mo = `<defs><radialGradient id="${mg}"><stop offset="0" stop-color="#fdfbf2"/><stop offset="0.86" stop-color="#e8e4d2"/><stop offset="1" stop-color="#e8e4d2" stop-opacity="0"/></radialGradient></defs><circle cx="128" cy="128" r="110" fill="url(#${mg})"/>`;
    const mrng = U.rng(5100);
    for (let i = 0; i < 9; i++) { const r = U.rand(mrng, 8, 26), a = U.rand(mrng, 0, U.TAU), d = U.rand(mrng, 0, 80); mo += `<circle cx="${128 + Math.cos(a) * d}" cy="${128 + Math.sin(a) * d}" r="${r}" fill="#c9c4ae" opacity="0.5"/>`; }
    T.t.moon = { map: await tex(SW(256, 256, mo), 256, 256, { clamp: true }) };
    /* 海鸥(两帧) */
    let gl = `<g fill="#f4f6f8"><path d="M20 40 Q 50 6 64 34 Q 78 6 108 40 Q 78 26 64 44 Q 50 26 20 40 Z"/></g><g fill="#eceff2" transform="translate(128 0)"><path d="M20 30 Q 50 46 64 30 Q 78 46 108 30 Q 78 52 64 38 Q 50 52 20 30 Z"/></g>`;
    T.t.gull = { map: await tex(SW(256, 64, gl), 256, 64, { clamp: true }) };
    /* 水面法线 */
    const wn = `<rect width="512" height="512" fill="#808080"/>` + N(512, 512, { bf: 0.02, oct: 4, seed: 51, color: '#000', op: 0.5, slope: 1.2 }) + N(512, 512, { bf: 0.07, oct: 3, seed: 52, color: '#fff', op: 0.4, slope: 1.4 });
    T.t.waterN = { nrm: await nrmTex(SW(512, 512, wn), 512, 512, 2.2) };
  };

  /* ================= 构建全部 ================= */
  T.build = async function (cb) {
    const jobs = [
      ['沥青路面', B.asphalt], ['车行道标线', B.road], ['交叉路口', B.inter], ['斑马线', B.cross], ['井盖', B.manhole],
      ['人行道', B.sidewalk], ['混凝土', B.concrete], ['草地', B.grass], ['砖墙', B.brick],
      ['住宅立面', B.facRes], ['办公立面', B.facOff], ['玻璃幕墙', B.facGlass], ['沿街商铺', B.facShop], ['屋顶', B.roof],
      ['集装箱', B.cont], ['码头仓库', B.wh], ['漩涡酒店', B.hotel], ['AXIOM大厦', B.tower], ['加油站', B.gas],
      ['霓虹招牌', B.signs], ['广告牌', B.bill], ['树木植被', B.leaves], ['角色服装', B.chars], ['车辆内饰', B.car], ['特效贴图', B.fxTex]
    ];
    for (let i = 0; i < jobs.length; i++) {
      if (cb) cb(i / jobs.length, jobs[i][0]);
      await jobs[i][1]();
    }
    if (cb) cb(1, '完成');
  };
})();
