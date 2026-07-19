/* ============================================================
   STARFORGE - space.js
   太空场景：飞船飞行 / 星球群 / 空间站 / 小行星带 / 脉冲引擎
   ============================================================ */
'use strict';

const Space = (() => {
  let scene = null, initialized = false;
  const SUN_POS = new THREE.Vector3(6000, 2400, 1800);   // 恒星方位（昼夜半球依据）
  const SUN_R = 450;                                      // 恒星半径（真实天体，可接近）
  let sunBody = null, sunHeatT = 0;
  const PLANET_DAY = 480;                                 // 与地面 DAY_LEN 同步（秒/自转周）
  let ship = null, shipGroup = null;
  let planets = [];          // {mesh, def, cloud}
  let station = null, stationRing = null, stationLights = [];
  let asteroids = [];
  let npcShips = [];   // 兼容遗留（已由访客舰队 visitors 取代）
  let starPoints = null, pulseLines = null;
  let lasers = [];
  let scanRing = null, scanRingT = 0, spaceMarkers = [];
  let scanFxQ = [];   // 扫描波前队列：波纹抵达天体瞬间触发全息罩/提示音/标记揭示
  const _shv = new THREE.Vector3();

  // 飞行状态
  const shipState = {
    pos: new THREE.Vector3(),
    yaw: 0, pitch: 0, roll: 0, camRoll: 0,
    speed: 0, boost: false, pulsing: false, pulseCharge: 0,
  };
  const MAX_SPEED = 46, BOOST_SPEED = 110, PULSE_SPEED = 900;

  // ---------- 恒星表面（程序化米粒组织：大尺度明暗 + 细粒噪声）----------
  let _sunSurfTex = null, _sunCoronaTex = null;
  function sunTextures(){
    if (!_sunSurfTex){
      const W = 256, H = 128;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d');
      const img = x.createImageData(W, H);
      const n = makeNoise(20770);
      for (let py = 0; py < H; py++){
        for (let px = 0; px < W; px++){
          const g = n.fbm2(px * 0.07, py * 0.1, 4) * 0.5 + 0.5;       // 米粒组织
          const w = n.fbm2(px * 0.018 + 40, py * 0.026, 3) * 0.5 + 0.5; // 大尺度对流明暗
          const t = 0.4 + g * 0.42 + w * 0.28;
          const i = (py * W + px) * 4;
          img.data[i] = 255;
          img.data[i + 1] = Math.min(255, 130 + t * 125) | 0;
          img.data[i + 2] = Math.min(255, 20 + t * 130) | 0;
          img.data[i + 3] = 255;
        }
      }
      x.putImageData(img, 0, 0);
      _sunSurfTex = new THREE.CanvasTexture(c);
      const c2 = document.createElement('canvas'); c2.width = 128; c2.height = 128;
      const x2 = c2.getContext('2d');
      const grd = x2.createRadialGradient(64, 64, 4, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,240,180,0.9)');
      grd.addColorStop(0.4, 'rgba(255,200,120,0.3)');
      grd.addColorStop(1, 'rgba(255,180,80,0)');
      x2.fillStyle = grd; x2.fillRect(0, 0, 128, 128);
      _sunCoronaTex = new THREE.CanvasTexture(c2);
    }
    return { surface: _sunSurfTex, corona: _sunCoronaTex };
  }

  // ---------- 像素星球贴图 ----------
  function planetTexture(biomeKey, seed){
    const b = BIOMES[biomeKey];
    const c = document.createElement('canvas');
    c.width = 64; c.height = 32;
    const ctx = c.getContext('2d');
    const rnd = mulberry32(seed);
    const base = new THREE.Color(b.tint);
    const alt = new THREE.Color(b.sky[0], b.sky[1], b.sky[2]);
    const noiseGen = makeNoise(seed);
    for (let y = 0; y < 32; y++){
      for (let x = 0; x < 64; x++){
        const n = noiseGen.fbm2(x * 0.14, y * 0.22, 4) * 0.5 + 0.5;
        let col;
        if (n < 0.42) col = alt.clone().multiplyScalar(0.75);            // 海洋/低地
        else {
          col = base.clone().multiplyScalar(0.7 + n * 0.5);
          if (rnd() < 0.04) col.multiplyScalar(1.3);
        }
        // 极冠
        if ((y < 3 || y > 28) && biomeKey !== 'volcanic') col.lerp(new THREE.Color(0xffffff), 0.55);
        ctx.fillStyle = '#' + col.getHexString();
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // 放大到高分辨率画布（供实际地形回绘：贴图贴合方块地形）
    const c2 = document.createElement('canvas');
    c2.width = 256; c2.height = 128;
    const ctx2 = c2.getContext('2d');
    ctx2.imageSmoothingEnabled = false;
    ctx2.drawImage(c, 0, 0, 256, 128);
    // 干净副本：保存「模拟渲染」原貌，地表精绘弄脏后离开星球时还原
    const c3 = document.createElement('canvas');
    c3.width = 256; c3.height = 128;
    const ctx3 = c3.getContext('2d');
    ctx3.drawImage(c2, 0, 0);
    // 原始像素贴图快照（永不修改）：远离星球时整球回退到最初的手绘风贴图
    const c4 = document.createElement('canvas');
    c4.width = 256; c4.height = 128;
    c4.getContext('2d').drawImage(c2, 0, 0);
    const t = new THREE.CanvasTexture(c2);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    return { tex: t, canvas: c2, ctx: ctx2, cleanCanvas: c3, cleanCtx: ctx3, origCanvas: c4 };
  }

  // 设置目标星球的表皮溶解（amt 0~1，dirWorld 为世界坐标方向；pid=-1 清除所有）
  function setSurfaceHole(pid, amt, dirWorld){
    let hit = false;
    for (const p of planets){
      if (!p.holeU) continue;
      if (p.def.id === pid && dirWorld){
        p.holeU.amt.value = amt;
        const ry = p.mesh.rotation.y;
        const c = Math.cos(ry), s = Math.sin(ry);
        // 世界方向 → 网格局部（绕 Y 轴 -ry）
        p.holeU.dir.value.set(c * dirWorld.x - s * dirWorld.z, dirWorld.y, s * dirWorld.x + c * dirWorld.z);
        // LOD 地形块同步下沉（与球面同一本地坐标系）
        lodHoleU.amt.value = amt;
        lodHoleU.dir.value.copy(p.holeU.dir.value);
        hit = true;
      } else {
        p.holeU.amt.value = 0;
      }
    }
    if (!hit) lodHoleU.amt.value = 0;
  }

  // ---------- 立方体球面 LOD（NMS 式：6 面各一棵四叉树，按相机距离递归细分）----------
  // 远距离：整球浮雕兜底（低模球体）；近距离：深层叶节点高分辨率地形块
  // 叶节点：方形面上生成网格 → 采样地形噪声高度 → Cube-to-Sphere 投影 → 裙边遮缝 + 背面/距离剔除
  const CUBE_FACES = [
    { n: [1, 0, 0], t: [0, 0, -1], b: [0, 1, 0] },
    { n: [-1, 0, 0], t: [0, 0, 1], b: [0, 1, 0] },
    { n: [0, 1, 0], t: [1, 0, 0], b: [0, 0, -1] },
    { n: [0, -1, 0], t: [1, 0, 0], b: [0, 0, 1] },
    { n: [0, 0, 1], t: [1, 0, 0], b: [0, 1, 0] },
    { n: [0, 0, -1], t: [-1, 0, 0], b: [0, 1, 0] },
  ];
  const LOD_MIN_DRAW = 3;
  // 星球区块（画面设置）：太空中看到的星球方块地形块 数量/精细度/构建速度/可见距离
  let LOD_MAX = 5, LOD_SUB = 2.4, LOD_FAR = 14, LOD_BUDGET = 6, LOD_GRID = 9, LOD_RANGE = 750;
  function setLodQuality(q){
    if (q === 'low'){ LOD_MAX = 4; LOD_SUB = 2.0; LOD_FAR = 10; LOD_BUDGET = 4; LOD_GRID = 7; LOD_RANGE = 550; }
    else if (q === 'high'){ LOD_MAX = 6; LOD_SUB = 2.8; LOD_FAR = 22; LOD_BUDGET = 9; LOD_GRID = 11; LOD_RANGE = 1200; }
    else if (q === 'ultra'){ LOD_MAX = 6; LOD_SUB = 3.4; LOD_FAR = 34; LOD_BUDGET = 14; LOD_GRID = 13; LOD_RANGE = 1800; }
    else { LOD_MAX = 5; LOD_SUB = 2.4; LOD_FAR = 14; LOD_BUDGET = 6; LOD_GRID = 9; LOD_RANGE = 750; }
    // 清空缓存按新参数重建
    for (const p of planets){
      if (p.lodTiles){
        for (const t of p.lodTiles.values()){ p.mesh.remove(t.mesh); t.mesh.geometry.dispose(); }
        p.lodTiles = null;
      }
    }
  }
  // 星球方块地形的激活距离（画质档位越高，越远就能看到 LOD 地形块）
  function lodRange(){ return LOD_RANGE; }
  // 体素皮肤覆盖区内 LOD 块沿径向下沉，避免模拟地形从方块地形中穿出
  // 下沉窗口（27°~33°）须完整收在皮肤全不透明区（~34°）内：
  // 皮肤边缘淡出圈下若还留着深坑，会形成一圈似透明的凹槽（东一块西一块）
  const lodHoleU = { amt: { value: 0 }, dir: { value: new THREE.Vector3(0, 1, 0) } };
  const lodMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  lodMat.onBeforeCompile = shader => {
    shader.uniforms.uHoleAmt = lodHoleU.amt;
    shader.uniforms.uHoleDir = lodHoleU.dir;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uHoleAmt;\nuniform vec3 uHoleDir;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= 1.0 - 0.15 * uHoleAmt * smoothstep(0.8387, 0.891, dot(normalize(position), uHoleDir));');
  };
  lodMat.customProgramCacheKey = () => 'lodhole';
  const _ld = new THREE.Vector3(), _lc = new THREE.Vector3(), _lcam = new THREE.Vector3();
  function cubeDir(f, u, v, out){
    const F = CUBE_FACES[f];
    return out.set(
      F.n[0] + u * F.t[0] + v * F.b[0],
      F.n[1] + u * F.t[1] + v * F.b[1],
      F.n[2] + u * F.t[2] + v * F.b[2]).normalize();
  }
  function buildLodTile(p, key, hSampler, cSampler){
    const parts = key.split(':');
    const f = +parts[0], l = +parts[1], i = +parts[2], j = +parts[3];
    const R = p.def.radius, s = R * 0.004;
    const step = 2 / (1 << l);
    const u0 = -1 + i * step, v0 = -1 + j * step;
    const G = LOD_GRID;
    const pos = new Float32Array(G * G * 3), col = new Float32Array(G * G * 3);
    const ind = [];
    for (let gy = 0; gy < G; gy++){
      for (let gx = 0; gx < G; gx++){
        const u = u0 + step * gx / (G - 1), v = v0 + step * gy / (G - 1);
        cubeDir(f, u, v, _ld);
        const lat = Math.asin(Math.max(-1, Math.min(1, _ld.y)));
        const lon = Math.atan2(_ld.z, _ld.x);
        const wx = lon / 0.004, wz = Math.max(-1.15, Math.min(1.15, lat)) / 0.004;
        const k = polarK(lat);   // 极区收敛到同纬度平均高/色，消除极点麻花
        let h = hSampler(wx, wz);
        if (k > 0){
          const hp = poleRef(p, p.lodSeed, lat > 0 ? 'hN' : 'hS', () => ringAvgH(hSampler, (lat > 0 ? 1 : -1) * POLAR_T0 / 0.004));
          h = h * (1 - k) + hp * k;
        }
        // 裙边：边界顶点沿径向下压，遮住相邻 LOD 级的接缝
        const skirt = (gx === 0 || gy === 0 || gx === G - 1 || gy === G - 1) ? 4 : 0;
        const r = R + (h - 16 - 0.5 - skirt) * s;
        const iV = (gy * G + gx) * 3;
        pos[iV] = _ld.x * r; pos[iV + 1] = _ld.y * r; pos[iV + 2] = _ld.z * r;
        const c = cSampler(wx, wz);
        const cap = k > 0 ? poleRef(p, p.lodSeed, lat > 0 ? 'rN' : 'rS', () => ringAvgRGB(cSampler, (lat > 0 ? 1 : -1) * POLAR_T0 / 0.004)) : c;
        col[iV] = (c[0] * (1 - k) + cap[0] * k) / 255;
        col[iV + 1] = (c[1] * (1 - k) + cap[1] * k) / 255;
        col[iV + 2] = (c[2] * (1 - k) + cap[2] * k) / 255;
        if (gx < G - 1 && gy < G - 1){
          const a = gy * G + gx, b2 = a + 1, c2 = a + G, d2 = c2 + 1;
          ind.push(a, c2, b2, b2, c2, d2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(ind);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return new THREE.Mesh(geo, lodMat);
  }
  function updateLOD(pid, hSampler, cSampler, seed, camPos){
    const p = planets.find(q => q.def.id === pid);
    if (!p) return;
    if (!p.lodTiles || p.lodSeed !== seed){
      if (p.lodTiles) for (const t of p.lodTiles.values()){ p.mesh.remove(t.mesh); t.mesh.geometry.dispose(); }
      p.lodTiles = new Map();
      p.lodSeed = seed;
    }
    const now = performance.now();
    const R = p.def.radius, rot = p.mesh.rotation.y;
    // 相机位置换算到星球本地（抵消自转），LOD 判定随自转正确
    _lcam.copy(camPos).sub(p.mesh.position);
    const camDist = Math.max(1, _lcam.length());
    const cr = Math.cos(-rot), sr = Math.sin(-rot);
    _lcam.set(cr * _lcam.x - sr * _lcam.z, _lcam.y, sr * _lcam.x + cr * _lcam.z);
    const want = new Set();
    const rec = (f, l, i, j) => {
      const step = 2 / (1 << l);
      cubeDir(f, -1 + (i + 0.5) * step, -1 + (j + 0.5) * step, _ld);
      const nodeSize = R * 2.0 / (1 << l);
      const dist = _lc.copy(_ld).multiplyScalar(R).distanceTo(_lcam);
      if (l < LOD_MAX && dist < nodeSize * LOD_SUB){
        rec(f, l + 1, i * 2, j * 2); rec(f, l + 1, i * 2 + 1, j * 2);
        rec(f, l + 1, i * 2, j * 2 + 1); rec(f, l + 1, i * 2 + 1, j * 2 + 1);
      } else if (l >= LOD_MIN_DRAW){
        if (_ld.dot(_lcam) / camDist < -0.05) return;   // 背面剔除
        if (dist > nodeSize * LOD_FAR) return;               // 远端由整球浮雕兜底
        want.add(f + ':' + l + ':' + i + ':' + j);
      }
    };
    for (let f = 0; f < 6; f++) rec(f, 0, 0, 0);
    const renderWant = new Set();
    let builds = 0;
    const missing = [];
    for (const key of want){
      let t = p.lodTiles.get(key);
      if (!t){
        if (builds >= LOD_BUDGET){ missing.push(key); continue; }   // 每帧构建限额（随画质档位变化）
        builds++;
        t = { mesh: buildLodTile(p, key, hSampler, cSampler), last: now };
        p.lodTiles.set(key, t);
        p.mesh.add(t.mesh);
      }
      t.mesh.visible = true;
      t.last = now;
      renderWant.add(key);
    }
    // 兜底：本帧没来得及构建的块 → 显示最近已建的祖先块（无祖先则顶已建子块），转视角不再东一块西一块
    for (const key of missing){
      const n = key.split(':');
      const f = +n[0], l = +n[1], i = +n[2], j = +n[3];
      let found = false;
      let al = l, ai = i, aj = j;
      while (al > 0){
        al--; ai >>= 1; aj >>= 1;
        const t = p.lodTiles.get(f + ':' + al + ':' + ai + ':' + aj);
        if (t){
          t.mesh.visible = true;
          t.last = now;
          renderWant.add(f + ':' + al + ':' + ai + ':' + aj);
          found = true;
          break;
        }
      }
      if (!found && l < LOD_MAX){
        for (let d = 0; d < 4; d++){
          const ckey = f + ':' + (l + 1) + ':' + (i * 2 + (d & 1)) + ':' + (j * 2 + (d >> 1));
          const t = p.lodTiles.get(ckey);
          if (t){ t.mesh.visible = true; t.last = now; renderWant.add(ckey); }
        }
      }
    }
    for (const [key, t] of p.lodTiles){
      if (!renderWant.has(key)){
        t.mesh.visible = false;
        if (now - t.last > 30000){ p.mesh.remove(t.mesh); t.mesh.geometry.dispose(); p.lodTiles.delete(key); }
      }
    }
  }

  // 整球浮雕位移：把体素地形高度烘焙到球体顶点上（逐行摊销），
  // 整颗星球呈现方块地形起伏，远观即是完整地形的模拟渲染
  // 极点处理：经度在极点收敛，逐点采样会拧成麻花——方块世界没有极地，
  // 极区向「钳制纬度圈的地形平均色/平均高」平滑收敛，与周围地形浑然一体
  const POLAR_T0 = 1.0, POLAR_T1 = 1.14;
  function polarK(lat){ return THREE.MathUtils.smoothstep(Math.abs(lat), POLAR_T0, POLAR_T1); }
  function poleRef(p, seed, key, calc){
    if (!p.poleCache || p.poleCache.seed !== seed) p.poleCache = { seed };
    if (p.poleCache[key] === undefined) p.poleCache[key] = calc();
    return p.poleCache[key];
  }
  function ringAvgH(hSampler, wz){
    let s = 0;
    for (let i = 0; i < 32; i++) s += hSampler((i / 32 * Math.PI * 2 - Math.PI) / 0.004, wz);
    return s / 32;
  }
  function ringAvgRGB(cSampler, wz){
    const a = [0, 0, 0];
    for (let i = 0; i < 32; i++){
      const c = cSampler((i / 32 * Math.PI * 2 - Math.PI) / 0.004, wz);
      a[0] += c[0]; a[1] += c[1]; a[2] += c[2];
    }
    return [a[0] / 32, a[1] / 32, a[2] / 32];
  }
  function parseCssColor(col){
    if (col[0] === '#') return [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
    const m = col.match(/([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/);
    return m ? [+m[1], +m[2], +m[3]] : [120, 120, 120];
  }
  function ringAvgCss(sampler, wz){
    const a = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < 32; i++){
      const c = sampler((i / 32 * Math.PI * 2 - Math.PI) / 0.004, wz);
      if (!c) continue;
      const r = parseCssColor(c);
      a[0] += r[0]; a[1] += r[1]; a[2] += r[2]; n++;
    }
    return n ? 'rgb(' + (a[0] / n | 0) + ',' + (a[1] / n | 0) + ',' + (a[2] / n | 0) + ')' : null;
  }
  const _dv = new THREE.Vector3();
  function displaceGlobe(pid, hSampler, seed, rowsPerCall){
    const p = planets.find(q => q.def.id === pid);
    if (!p) return;
    const geo = p.mesh.geometry;
    const posA = geo.attributes.position;
    const ROWS = 33, COLS = 65;                    // SphereGeometry(_, 64, 32) 顶点网格
    if (p.dispSeed !== seed){ p.dispSeed = seed; p.dispRow = 0; }
    if (p.dispRow >= ROWS) return;
    const R = p.def.radius, s = R * 0.004;
    const end = Math.min(ROWS, p.dispRow + (rowsPerCall || 5));
    for (let iy = p.dispRow; iy < end; iy++){
      for (let ix = 0; ix < COLS; ix++){
        const i = iy * COLS + ix;
        _dv.fromBufferAttribute(posA, i).normalize();
        const lat = Math.asin(Math.max(-1, Math.min(1, _dv.y)));
        const lon = Math.atan2(_dv.z, _dv.x);
        let h = hSampler(lon / 0.004, Math.max(-1.15, Math.min(1.15, lat)) / 0.004);
        const k = polarK(lat);
        if (k > 0){
          const hp = poleRef(p, seed, lat > 0 ? 'hN' : 'hS', () => ringAvgH(hSampler, (lat > 0 ? 1 : -1) * POLAR_T0 / 0.004));
          h = h * (1 - k) + hp * k;   // 极区收敛到同纬度平均高度，消除极点麻花
        }
        const r = R + (h - 16 - 1.5) * s;   // 下沉偏置：LOD 地形块与真实区块覆盖其上
        posA.setXYZ(i, _dv.x * r, _dv.y * r, _dv.z * r);
      }
    }
    p.dispRow = end;
    posA.needsUpdate = true;
    if (p.dispRow >= ROWS){
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      geo.boundingSphere.radius = R + 50 * s;
    }
  }

  // 整球回绘：用世界生成噪声把整颗星球的地形“模拟渲染”到球面贴图（逐行摊销）
  // 画到干净副本后逐行同步到显示贴图——地表精绘（paintSurfaceRegion）只弄脏显示贴图，可随时还原
  function paintGlobe(pid, sampler, seed, rowsPerCall){
    const p = planets.find(q => q.def.id === pid);
    if (!p || !p.texCtx) return;
    if (p.globeSeed !== seed){ p.globeSeed = seed; p.globeRow = 0; }
    const H = p.texCanvas.height, W = p.texCanvas.width;
    if (p.globeRow >= H) return;
    const ctx = p.cleanCtx;
    const startRow = p.globeRow;
    const end = Math.min(H, p.globeRow + (rowsPerCall || 4));
    for (let py = p.globeRow; py < end; py++){
      const latRaw = (0.5 - (py + 0.5) / H) * Math.PI;
      const lat = Math.max(-1.15, Math.min(1.15, latRaw));
      const z = lat / 0.004;
      for (let px = 0; px < W; px++){
        const lon = Math.PI - (px + 0.5) / W * (Math.PI * 2);
        const col = sampler(lon / 0.004, z);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(px, py, 1, 1);
      }
      // 极区覆盖为同纬度地形平均色：经度在极点收敛，直接采样会呈麻花状条纹
      const k = polarK(latRaw);
      if (k > 0){
        const pc = poleRef(p, seed, latRaw > 0 ? 'cN' : 'cS', () => ringAvgCss(sampler, (latRaw > 0 ? 1 : -1) * POLAR_T0 / 0.004));
        if (pc){
          ctx.globalAlpha = k;
          ctx.fillStyle = pc;
          ctx.fillRect(0, py, W, 1);
          ctx.globalAlpha = 1;
        }
      }
    }
    p.globeRow = end;
    p.texCtx.drawImage(p.cleanCanvas, 0, startRow, W, end - startRow, 0, startRow, W, end - startRow);
    p.tex.needsUpdate = true;
  }
  // 清除某星球的 LOD 地形块（越出激活范围/还原贴图时调用，避免残块挂在星球上）
  function clearLodTiles(pid){
    const p = planets.find(q => q.def.id === pid);
    if (!p || !p.lodTiles) return;
    for (const t of p.lodTiles.values()){ p.mesh.remove(t.mesh); t.mesh.geometry.dispose(); }
    p.lodTiles = null;
  }
  // 还原星球最初的手绘像素贴图与光滑球体：离开星球时调用，
  // 模拟渲染（整球回绘/浮雕位移/地表精绘）全部回退，下次接近时重新逐行绘制
  function restoreGlobe(pid){
    const p = planets.find(q => q.def.id === pid);
    if (!p || !p.origCanvas) return;
    clearLodTiles(pid);
    if (!p.surfDirty && p.globeSeed === undefined && p.dispSeed === undefined) return;
    p.texCtx.drawImage(p.origCanvas, 0, 0);
    p.cleanCtx.drawImage(p.origCanvas, 0, 0);
    p.surfDirty = false;
    p.globeSeed = undefined; p.globeRow = 0;
    p.tex.needsUpdate = true;
    // 浮雕位移回退为光滑球面
    if (p.dispSeed !== undefined){
      const geo = p.mesh.geometry;
      const posA = geo.attributes.position;
      const R = p.def.radius;
      for (let i = 0; i < posA.count; i++){
        _dv.fromBufferAttribute(posA, i).normalize();
        posA.setXYZ(i, _dv.x * R, _dv.y * R, _dv.z * R);
      }
      posA.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      p.dispSeed = undefined; p.dispRow = 0;
    }
  }

  // 用实际体素地表颜色回绘星球贴图（等距圆柱投影；sampler 未加载区域返回 null 跳过）
  // 区块对齐：整格贴合 16×16 区块边界，只画完整加载的区块——精绘边缘落在方块地形区块边上，不再东一块西一块
  // phase：0~3 只绘制 1/4 行，分帧摊销避免卡顿
  function paintSurfaceRegion(pid, cx, cz, radiusBlocks, sampler, phase){
    const p = planets.find(q => q.def.id === pid);
    if (!p || !p.texCtx) return;
    const W = p.texCanvas.width, H = p.texCanvas.height;
    const blocksPerTexel = (Math.PI * 2 / W) / 0.004;
    const tR = Math.ceil(radiusBlocks / blocksPerTexel);
    let lonC = cx * 0.004;
    lonC = ((lonC + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const latC = Math.max(-1.15, Math.min(1.15, cz * 0.004));
    // SphereGeometry UV：u = (π − lon)/2π, v = 0.5 − lat/π
    const pxC = Math.round((Math.PI - lonC) / (Math.PI * 2) * W);
    const pyC = Math.round((0.5 - latC / Math.PI) * H);
    const ctx = p.texCtx;
    ctx.globalAlpha = 1;
    // 区块加载缓存：本次调用内每个 16×16 区块只判定一次（区块内任一格未加载则整块跳过）
    const chunkOk = new Map();
    const chunkLoaded = (wx, wz) => {
      const k = (wx >> 4) + ':' + (wz >> 4);
      let v = chunkOk.get(k);
      if (v === undefined){
        v = !!sampler(((wx >> 4) << 4) + 8, ((wz >> 4) << 4) + 8);
        chunkOk.set(k, v);
      }
      return v;
    };
    for (let dy = -tR; dy <= tR; dy++){
      const py = pyC + dy;
      if (py < 0 || py >= H) continue;
      if (phase !== undefined && ((py % 4) + 4) % 4 !== phase) continue;
      const lat = (0.5 - (py + 0.5) / H) * Math.PI;
      if (Math.abs(lat) > POLAR_T0) continue;   // 保护极冠不被条纹回绘覆盖
      const z = lat / 0.004;
      const wz = Math.floor(z);
      for (let dx = -tR; dx <= tR; dx++){
        const px = ((pxC + dx) % W + W) % W;
        const lon = Math.PI - (px + 0.5) / W * (Math.PI * 2);
        const wx = Math.floor(lon / 0.004);
        if (!chunkLoaded(wx, wz)) continue;   // 只绘制完整区块，边缘对齐区块边界
        const col = sampler(lon / 0.004, z);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(px, py, 1, 1);
      }
    }
    p.surfDirty = true;
    p.tex.needsUpdate = true;
  }

  // ---------- 飞船模型（外部精模 CC0，缺失时回退体素风；model 参数支持换船）----------
  function buildShip(model){
    const g = new THREE.Group();
    const name = model || 'ship';
    const glb = window.ModelLib && ModelLib.get(name, name === 'ship' ? 5.2 : 7.0, { ground: false, yaw: name === 'ship' ? 0 : Math.PI });
    if (glb){
      g.add(glb);
    } else {
      const hull = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('metal') });
      const dark = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('metal_dark') });
      const glassM = new THREE.MeshLambertMaterial({ color: 0x66ddee, transparent: true, opacity: 0.7, emissive: 0x113344 });
      const accent = new THREE.MeshLambertMaterial({ color: 0xc9641a });
      const B2 = (w, h, d, m, x, y, z) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        mesh.position.set(x, y, z); g.add(mesh); return mesh;
      };
      // 机身（-z 朝前）
      B2(1.4, 0.9, 3.6, hull, 0, 0, 0);
      B2(1.0, 0.5, 1.4, dark, 0, 0.6, 0.4);
      B2(0.9, 0.62, 1.2, glassM, 0, 0.55, -0.9);             // 座舱
      B2(1.2, 0.3, 1.1, dark, 0, -0.35, -1.9);               // 船首
      B2(0.8, 0.42, 0.9, hull, 0, -0.1, -2.4);
      // 机翼
      B2(2.6, 0.16, 1.4, hull, -1.9, -0.1, 0.7);
      B2(2.6, 0.16, 1.4, hull, 1.9, -0.1, 0.7);
      B2(0.5, 0.5, 1.0, accent, -3.0, 0.05, 0.8);
      B2(0.5, 0.5, 1.0, accent, 3.0, 0.05, 0.8);
      // 引擎
      B2(0.55, 0.55, 0.9, dark, -0.55, -0.05, 1.9);
      B2(0.55, 0.55, 0.9, dark, 0.55, -0.05, 1.9);
      // 起落架
      B2(0.14, 0.5, 0.14, dark, -0.5, -0.7, -0.8);
      B2(0.14, 0.5, 0.14, dark, 0.5, -0.7, -0.8);
      B2(0.14, 0.5, 0.14, dark, 0, -0.7, 1.2);
    }
    // 引擎光斑 + 尾焰（飞行代码依赖 userData.engines/flames）
    const engineGlow = new THREE.MeshBasicMaterial({ color: 0x35b0ff });
    const E = (x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.12), engineGlow);
      m.position.set(x, -0.05, z); g.add(m); return m;
    };
    const e1 = E(-0.55, 2.4), e2 = E(0.55, 2.4);
    // 引擎喷焰（拉伸方块）
    const flame1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.7, depthWrite: false }));
    flame1.position.set(-0.55, -0.05, 3.3);
    g.add(flame1);
    const flame2 = flame1.clone(); flame2.position.x = 0.55; g.add(flame2);
    g.userData = { engines: [e1, e2], flames: [flame1, flame2] };
    return g;
  }

  // ---------- 远方星系贴图（曲速跃迁目标：太空可见的旋涡星系群，方向按种子确定）----------
  let galSprites = [], galSpritesReady = false;
  function galaxyCanvas(seed){
    const S = 128;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const x = c.getContext('2d');
    const rnd = mulberry32(seed >>> 0);
    const hue = rnd() * 360;
    const cx = S / 2, cy = S / 2;
    const core = x.createRadialGradient(cx, cy, 2, cx, cy, S * 0.46);
    core.addColorStop(0, `hsla(${hue},80%,88%,0.95)`);
    core.addColorStop(0.25, `hsla(${hue},70%,62%,0.5)`);
    core.addColorStop(1, 'hsla(0,0%,0%,0)');
    x.fillStyle = core;
    x.fillRect(0, 0, S, S);
    const arms = 2 + (rnd() * 2 | 0);
    for (let a = 0; a < arms; a++){
      const a0 = a / arms * Math.PI * 2 + rnd();
      for (let i = 0; i < 90; i++){
        const t = i / 90;
        const ang = a0 + t * 4.2;
        const r = 4 + t * S * 0.42;
        x.fillStyle = `hsla(${hue + t * 40},70%,${70 - t * 25}%,${0.5 * (1 - t)})`;
        x.fillRect(cx + Math.cos(ang) * r + (rnd() - 0.5) * 5, cy + Math.sin(ang) * r * 0.62 + (rnd() - 0.5) * 5, 1.6, 1.6);
      }
    }
    return c;
  }
  function setGalaxySprites(list){
    for (const g of galSprites) scene.remove(g.sprite);
    galSprites = [];
    for (const ent of list){
      const rnd = mulberry32(ent.seed >>> 0);
      const theta = rnd() * Math.PI * 2;
      const elev = (rnd() - 0.5) * 1.1;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(galaxyCanvas(ent.seed)),
        transparent: true, depthWrite: false, fog: false, opacity: 0.9,
      }));
      sp.position.set(
        Math.cos(elev) * Math.cos(theta) * 8200,
        Math.sin(elev) * 8200,
        Math.cos(elev) * Math.sin(theta) * 8200);
      sp.scale.setScalar(650 + rnd() * 550);
      sp.renderOrder = -2;
      scene.add(sp);
      galSprites.push({ seed: ent.seed, sprite: sp, origScale: sp.scale.clone(), origOpacity: sp.material.opacity, origColor: sp.material.color ? sp.material.color.clone() : null });
    }
    galSpritesReady = true;
  }
  function getGalaxySpritePos(seed){
    const g = galSprites.find(e => e.seed === seed);
    return g ? g.sprite.position : null;
  }
  // ---------- 空间站（NMS 式大型站）----------
  // 模型仅两种生成方式：① SVG 剖面 → 车削 Lathe（塔身/停机坪/雷达碗）
  //                    ② 声明式零件 JSON（每件：g 形状 / p 位置 / s 尺寸 / r 旋转 / m 材质 / sym 对称）
  // 所有位置与尺寸吸附 1 单位栅格；sym:1 的零件强制生成 x 镜像副本（左右对称）
  const SGRID = 1;
  const q1 = v => Math.round(v / SGRID) * SGRID;
  const STATION_MATS = () => ({
    hull:   new THREE.MeshLambertMaterial({ map: Tex.tileTexture('metal', 3, 3) }),
    dark:   new THREE.MeshLambertMaterial({ map: Tex.tileTexture('metal_dark', 3, 3) }),
    deck:   new THREE.MeshLambertMaterial({ color: 0x3a4148 }),
    accent: new THREE.MeshLambertMaterial({ color: 0xc9641a }),
    glowC:  new THREE.MeshBasicMaterial({ color: 0x35e0e8 }),
    glowA:  new THREE.MeshBasicMaterial({ color: 0xffb347 }),
    glowW:  new THREE.MeshBasicMaterial({ color: 0xdff4ff }),
    solar:  new THREE.MeshLambertMaterial({ color: 0x2a4a7a }),
    screen: new THREE.MeshBasicMaterial({ color: 0x0f4a52 }),
    shield: new THREE.MeshBasicMaterial({ color: 0x35b0ff, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  });
  // SVG 剖面（路径字符串 "x,y x,y ..."，x=半径 y=高度）→ 车削
  const LATHE_PROFILES = {
    tower: '0,-64 26,-58 38,-32 44,-2 44,26 32,50 16,64 0,70',
    pad:   '0,0 7,0 8,1 8,2 6,2 0,2',
    dish:  '0,0 3,1 9,4 10,6 0,5',
    ring:  '66,0 70,-4 74,0 70,4 66,0',
    tank:  '0,-8 5,-7 6,-3 6,3 5,7 0,8',
  };
  function latheFromProfile(name, seg){
    const pts = LATHE_PROFILES[name].split(' ').map(s => {
      const a = s.split(',');
      return new THREE.Vector2(q1(+a[0]), q1(+a[1]));
    });
    return new THREE.LatheGeometry(pts, seg || 20);
  }
  function buildParts(parts, mats, root){
    for (const d of parts){
      const make = mirror => {
        let geo;
        if (d.g === 'box') geo = new THREE.BoxGeometry(q1(d.s[0]), q1(d.s[1]), q1(d.s[2]));
        else if (d.g === 'cyl') geo = new THREE.CylinderGeometry(q1(d.s[0]) / 2, q1(d.s[0]) / 2, q1(d.s[1]), d.seg || 14);
        else if (d.g === 'lathe') geo = latheFromProfile(d.prof, d.seg);
        else return;
        const m = new THREE.Mesh(geo, mats[d.m] || mats.hull);
        m.position.set(q1(d.p[0]) * (mirror ? -1 : 1), q1(d.p[1]), q1(d.p[2]));
        if (d.r) m.rotation.set(d.r[0], d.r[1] * (mirror ? -1 : 1), d.r[2] * (mirror ? -1 : 1));
        root.add(m);
        return m;
      };
      d._m = make(false);
      if (d.sym) d._sm = make(true);   // 强制左右对称
    }
  }
  // ---- SVG 人形工作人员（与村民同管线：SVG → 挤出；制服配色按职务）----
  function staffSVG(c){
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 104">',
      `<path fill="${c.hair}" d="M15,4 Q24,-2 33,4 L34,10 L14,10 Z"/>`,
      `<path fill="${c.skin}" d="M15,6 Q24,2 33,6 L33,15 Q24,19 15,15 Z"/>`,
      `<path fill="${c.skin}" d="M21,15 L27,15 L27,20 L21,20 Z"/>`,
      '<path fill="#262a30" d="M15,6 Q24,2 33,6 L33,14 Q24,18 15,14 Z"/>',
      '<path fill="#20262e" d="M18.6,9.5 L21.4,9.5 L21.4,12.4 L18.6,12.4 Z"/>',
      '<path fill="#20262e" d="M26.6,9.5 L29.4,9.5 L29.4,12.4 L26.6,12.4 Z"/>',
      `<path fill="${c.suit}" d="M13,19 L35,19 Q38,20 38,26 L36,54 L12,54 L10,26 Q10,20 13,19 Z"/>`,
      `<path fill="${c.trim}" d="M22,19 L26,19 L26,54 L22,54 Z"/>`,
      `<path fill="${c.trim}" d="M12,30 L36,30 L36,33 L12,33 Z"/>`,
      `<path fill="${c.suit}" d="M7,21 L13,20 L12,47 L6,46 Z"/>`,
      `<path fill="${c.suit}" d="M35,20 L41,21 L42,46 L36,47 Z"/>`,
      `<path fill="${c.glove}" d="M6,46 L12,47 L11.5,53 L5.8,52 Z"/>`,
      `<path fill="${c.glove}" d="M36,47 L42,46 L42.2,52 L36.5,53 Z"/>`,
      `<path fill="${c.belt}" d="M12,54 L36,54 L36,58 L12,58 Z"/>`,
      `<path fill="${c.pants}" d="M13,58 L22.4,58 L21.4,93 L14,93 Z"/>`,
      `<path fill="${c.pants}" d="M25.6,58 L35,58 L34,93 L26.6,93 Z"/>`,
      `<path fill="${c.boots}" d="M13.4,93 L21.6,93 L22,100 L12.4,100 Z"/>`,
      `<path fill="${c.boots}" d="M26.4,93 L34.6,93 L35.6,100 L26,100 Z"/>`,
      '</svg>',
    ].join('');
  }
  function buildStaffFigure(c){
    const g = new THREE.Group();
    try {
      const data = new THREE.SVGLoader().parse(staffSVG(c));
      const mats = {};
      const wrap = new THREE.Group();
      for (const path of data.paths){
        const fill = path.userData.style.fill;
        const shapes = THREE.SVGLoader.createShapes(path);
        if (!shapes.length) continue;
        // 眼睛/后脑发盖为薄片：眼睛只在前脸(-Z)，发盖只在后脑(+Z)，其余居中
        const thin = fill === '#20262e' || fill === '#262a30';
        const depth = thin ? 2.5 : (fill === c.hair ? 13 : 12);
        const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 8 });
        const zOff = fill === '#20262e' ? -7.3 : (fill === '#262a30' ? 5.0 : -depth / 2);
        geo.translate(-24, 0, zOff);
        if (!mats[fill]) mats[fill] = fill === '#20262e'
          ? new THREE.MeshBasicMaterial({ color: 0x20262e })
          : new THREE.MeshLambertMaterial({ color: new THREE.Color(fill) });
        wrap.add(new THREE.Mesh(geo, mats[fill]));
      }
      const s = 0.0176;
      wrap.scale.set(s, -s, s);
      wrap.position.y = 100 * s;
      g.add(wrap);
    } catch(e){ console.warn('[staff svg]', e); }
    return g;
  }
  // 职务配色 + 站内岗位（本地坐标；模型前方 -Z，rot 为 rotation.y）
  const STAFF_DEFS = [
    { name: '贸易官·凯拉', pos: [0, 3, -7], rot: Math.PI, c: { hair: '#5a4632', skin: '#e8c49a', suit: '#b8722a', trim: '#ffd94d', glove: '#e8c49a', belt: '#7a4a1a', pants: '#4a3c30', boots: '#2e2620' },
      talks: [['欢迎来到轨道集市，旅行者。', '数据芯片今天行情不错，出手要趁早。'], ['铁锭又跌了……都怪隔壁星系倾销。', '想赚差价？低吸高抛，永远的真理。']] },
    { name: '站务长·奥登', pos: [-22, 3, -6], rot: Math.PI, c: { hair: '#3a3f4a', skin: '#d8b48a', suit: '#3e5a6e', trim: '#35e0e8', glove: '#2e3640', belt: '#22303a', pants: '#2e3a44', boots: '#1e262e', },
      talks: [['本站已运转四百二十个标准年。', '护盾从没漏过一艘船——包括你这艘。'], ['站里禁止开火，禁止乱丢矿渣。', '祝你停靠愉快。']] },
    { name: '领航员·絮', pos: [22, 3, -6], rot: Math.PI, c: { hair: '#7a5a8a', skin: '#e8d0b0', suit: '#4a4258', trim: '#b58aff', glove: '#e8d0b0', belt: '#32283e', pants: '#3a3248', boots: '#241e2e' },
      talks: [['星图上闪烁的地方都值得一去。', '按 V 打开星系图，曲率电池备足再跳。'], ['危险星球的遗迹里藏着先民科技。', '……也藏着别的东西。小心。']] },
    { name: '技师·布仁', pos: [12, 0, 40], rot: -Math.PI / 2, c: { hair: '#2e2620', skin: '#c89878', suit: '#6e6a2a', trim: '#ffb347', glove: '#3a362a', belt: '#4a4632', pants: '#3e3a2e', boots: '#26221a' },
      talks: [['你这引擎喷口积碳不轻啊。', '常去恒星附近晃悠可不是好习惯。'], ['停机坪缓冲垫刚换的新货。', '放心砸——呃，我是说，放心降落。']] },
    { name: '巡逻员·汀', pos: [-20, 0, 46], rot: 0.4, c: { hair: '#4a3018', skin: '#e8c49a', suit: '#5a3e3e', trim: '#ff6a5e', glove: '#2e2620', belt: '#3a2a2a', pants: '#443430', boots: '#2a221e' },
      talks: [['最近有海盗在小行星带出没。', '货舱值钱的话，护盾升级别省。'], ['站长说我走路带风。', '……那是巡逻岗的基本素养。']] },
  ];
  // 泊入几何（站本地坐标，入口朝 +Z）；世界坐标由 getDock() 换算
  const DOCK_L = {
    slot:      { c: [0, 10, 79], hx: 14, hy: 8 },          // 入口槽中心/半宽/半高
    trigger:   { min: [-12, 3, 82], max: [12, 17, 100] },  // 触发泊入的走廊
    innerWait: [0, 12, 44],
    pad:       { pos: [20, 3.2, 30], yaw: Math.PI },       // 玩家专属泊位（右前，永久保留空位）
    exit:      [0, 12, 150],
    terminal:  [0, 4, -3],
    bounds:    { x: 30, zMin: -12, zMax: 74, concourseZ: 4, floorY: 0, concourseY: 3 },
    pads:      [[-20, 2, 30], [20, 2, 30], [-20, 2, 52], [20, 2, 52]],   // 四座停机坪（扩建）
  };
  // 访客机位：玩家位 (20,30) 之外的三座（无论如何为玩家保留至少一个空位）
  const VIS_PADS = [[-20, 30], [-20, 52], [20, 52]];
  let stationStaff = [], stationShield = null, stationGuides = [], stationHolo = [], stationNav = [];
  // 站体防护盾（被玩家攻击时激活）：门口引导光变红、10 秒无攻击后解除
  let stationDome = null, stationGateMat = null, stationDefT = 0;
  let termCanvas = null, termCtx = null, termTex = null, termRows = null, termLast = 0;
  // 终端行情屏：CanvasTexture 滚动数据（品名/价格随机游走/涨跌箭头/底部走势线）
  const TERM_NAMES = { tritium: '氚', iron: '铁锭', carbon: '碳', circuit: '电路板', data: '数据芯片', gold: '金锭', gold_ore: '金矿石', uranium: '铀棒', warpcell: '曲率电池', oxygen: '氧', sodium: '钠' };
  function buildTerminalScreen(g){
    termCanvas = document.createElement('canvas');
    termCanvas.width = 256; termCanvas.height = 128;
    termCtx = termCanvas.getContext('2d');
    termTex = new THREE.CanvasTexture(termCanvas);
    termTex.magFilter = THREE.LinearFilter;
    const goods = (typeof TRADE_GOODS !== 'undefined' ? TRADE_GOODS : ['tritium', 'iron', 'carbon', 'circuit', 'data', 'gold']).slice(0, 7);
    termRows = goods.map((id, i) => ({ id, p: 40 + ((i * 37) % 60), d: 1 }));
    const scr = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 1), new THREE.MeshBasicMaterial({ map: termTex }));
    scr.position.set(0, 9, -4);
    g.add(scr);
    drawTerminal(0);
  }
  function drawTerminal(t){
    const c = termCtx, W = 256, H = 128;
    c.fillStyle = '#051418'; c.fillRect(0, 0, W, H);
    // 扫描线底纹
    c.fillStyle = 'rgba(53,224,232,0.05)';
    for (let y = ((t * 18) | 0) % 6; y < H; y += 6) c.fillRect(0, y, W, 1);
    // 标题栏
    c.fillStyle = '#0b2a30'; c.fillRect(0, 0, W, 18);
    c.fillStyle = '#35e0e8'; c.font = 'bold 11px monospace';
    c.fillText('◆ 银河交易网 GALNET-MKT', 6, 13);
    c.fillStyle = '#ffb347';
    c.fillText(('##' + ((t * 7 | 0) % 97)).padStart(4, '0'), 214, 13);
    // 行情行（随机游走 + 涨跌色）
    c.font = '10px monospace';
    for (let i = 0; i < termRows.length; i++){
      const r = termRows[i];
      const y = 32 + i * 12;
      c.fillStyle = '#9ad4dc';
      c.fillText(TERM_NAMES[r.id] || r.id, 8, y);
      c.fillStyle = r.d >= 0 ? '#7dff8a' : '#ff6a5e';
      c.fillText((r.d >= 0 ? '▲' : '▼') + r.p.toFixed(1), 64, y);
      // 迷你条形
      c.fillStyle = 'rgba(53,224,232,0.25)';
      c.fillRect(120, y - 7, Math.max(4, (r.p % 60)) * 1.8, 7);
    }
    // 底部走势线
    c.strokeStyle = '#35e0e8'; c.lineWidth = 1; c.beginPath();
    for (let x = 0; x < W; x += 4){
      const yy = 116 - Math.sin((x + t * 40) * 0.05) * 6 - Math.sin((x + t * 26) * 0.023) * 4;
      x === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
    }
    c.stroke();
    termTex.needsUpdate = true;
  }
  function buildStation(){
    const g = new THREE.Group();
    const M = STATION_MATS();
    stationStaff = []; stationGuides = []; stationHolo = []; stationNav = [];
    const P = [];
    // ===== 机库壳体（前墙四段拼出入口槽）=====
    P.push(
      { g: 'box', p: [0, -2, 31], s: [80, 4, 102], m: 'dark' },              // 库底
      { g: 'box', p: [0, 32, 31], s: [80, 4, 102], m: 'dark' },              // 库顶
      { g: 'box', p: [36, 15, 31], s: [8, 34, 102], m: 'hull', sym: 1 },     // 侧墙
      { g: 'box', p: [0, 15, -17], s: [80, 34, 6], m: 'hull' },              // 后墙
      { g: 'box', p: [0, 24, 79], s: [80, 12, 6], m: 'hull' },               // 前墙·上段
      { g: 'box', p: [0, 1, 79], s: [80, 2, 6], m: 'hull' },                 // 前墙·下段
      { g: 'box', p: [27, 10, 79], s: [26, 16, 6], m: 'hull', sym: 1 },      // 前墙·侧段
      // 入口发光框（gate:1 = 独立材质：护盾激活时变红闪烁）
      { g: 'box', p: [0, 19, 82], s: [32, 2, 2], m: 'glowC', gate: 1 },
      { g: 'box', p: [0, 1, 82], s: [32, 2, 2], m: 'glowC', gate: 1 },
      { g: 'box', p: [15, 10, 82], s: [2, 18, 2], m: 'glowC', sym: 1, gate: 1 },
      { g: 'box', p: [0, 26, 84], s: [24, 6, 2], m: 'screen' },              // 门楣站名屏
      // ===== 主塔（车削）+ 尖塔 + 侧翼（强制对称）=====
      // 塔身后移至 z=-72：半径 44 的塔壁不得侵入机库大厅（后墙外沿 z=-20）
      { g: 'lathe', prof: 'tower', p: [0, 4, -72], m: 'hull', seg: 20 },
      { g: 'cyl', p: [0, 88, -72], s: [2, 44], m: 'dark' },
      { g: 'box', p: [0, 112, -72], s: [3, 3, 3], m: 'glowA' },              // 塔顶信标
      { g: 'box', p: [46, 20, -72], s: [2, 12, 2], m: 'glowC', sym: 1 },     // 塔身灯带
      { g: 'box', p: [52, 12, 20], s: [16, 12, 72], m: 'hull', sym: 1 },     // 侧翼主体
      { g: 'box', p: [58, 26, 0], s: [4, 24, 28], m: 'dark', sym: 1 },       // 侧翼立鳍
      { g: 'box', p: [52, 12, -18], s: [8, 6, 4], m: 'glowA', sym: 1 },      // 翼尾引擎光
      { g: 'box', p: [52, 19, 40], s: [12, 2, 30], m: 'accent', sym: 1 },    // 翼面色带
      { g: 'box', p: [0, -12, 20], s: [24, 16, 60], m: 'dark' },             // 下龙骨
      // ===== 库内：吊顶灯带 / 侧窗 / 大屏 =====
      { g: 'box', p: [0, 29, 8], s: [56, 1, 2], m: 'glowW' },
      { g: 'box', p: [0, 29, 28], s: [56, 1, 2], m: 'glowW' },
      { g: 'box', p: [0, 29, 48], s: [56, 1, 2], m: 'glowW' },
      { g: 'box', p: [0, 29, 68], s: [56, 1, 2], m: 'glowW' },
      { g: 'box', p: [33, 18, 50], s: [2, 8, 20], m: 'screen', sym: 1 },     // 舷窗
      { g: 'box', p: [0, 16, -13], s: [40, 12, 1], m: 'screen' },            // 大厅主屏
      // ===== 宏伟配件：巨型环形桁架 / 太阳能翼阵 / 燃料罐组 / 通讯塔 / 塔脊光带 =====
      { g: 'lathe', prof: 'ring', p: [0, -20, -72], m: 'hull', seg: 40 },    // 环绕主塔的巨环（车削截面）
      { g: 'box', p: [74, -20, -72], s: [3, 3, 3], m: 'glowA', sym: 1, nav: 1 },   // 环际航灯
      { g: 'box', p: [0, -20, 2], s: [3, 3, 3], m: 'glowA', nav: 1 },
      { g: 'box', p: [0, -20, -146], s: [3, 3, 3], m: 'glowA', nav: 1 },
      { g: 'box', p: [37, -20, -109], s: [2, 2, 2], m: 'glowC', sym: 1, nav: 1 },
      { g: 'box', p: [37, -20, -35], s: [2, 2, 2], m: 'glowC', sym: 1, nav: 1 },
      { g: 'box', p: [52, -8, -72], s: [40, 2, 2], m: 'dark', sym: 1, r: [0, 0, 0.5] },  // 环-塔斜撑
      { g: 'box', p: [70, 12, -44], s: [32, 1, 20], m: 'solar', sym: 1 },    // 太阳能翼板
      { g: 'box', p: [70, 12, -44], s: [34, 2, 2], m: 'dark', sym: 1 },      // 翼板主梁
      { g: 'box', p: [70, 13, -44], s: [30, 1, 1], m: 'glowC', sym: 1 },     // 集电光缝
      { g: 'box', p: [56, 12, -30], s: [4, 2, 28], m: 'dark', sym: 1 },      // 翼板-侧翼连接臂
      { g: 'lathe', prof: 'tank', p: [26, -14, 60], m: 'accent', sym: 1, seg: 12 },  // 燃料罐
      { g: 'box', p: [26, -14, 60], s: [14, 2, 2], m: 'dark', sym: 1 },      // 罐箍
      { g: 'box', p: [26, -7, 60], s: [2, 6, 2], m: 'dark', sym: 1 },        // 罐-库底吊柱
      { g: 'box', p: [58, 40, 0], s: [1, 28, 1], m: 'dark', sym: 1 },        // 通讯天线
      { g: 'box', p: [58, 55, 0], s: [2, 2, 2], m: 'glowA', sym: 1, nav: 1 },// 天线航灯
      { g: 'box', p: [60, 12, 56], s: [2, 2, 2], m: 'glowA', sym: 1, nav: 1 },// 翼尖航灯
      { g: 'box', p: [0, 40, -33], s: [2, 52, 2], m: 'glowC' },              // 主塔正面光脊
      // ===== 大厅平台 + 台阶 + 栏杆 + 交易终端 =====
      { g: 'box', p: [0, 1, -4], s: [64, 4, 20], m: 'deck' },                // 平台（顶面 y=3）
      // 中央阶梯：三级踏步（每级升 1 深 2，与行走地板高度函数一致）——原单块斜坡太陡太高
      { g: 'box', p: [0, 0, 9], s: [20, 2, 2], m: 'deck' },                  // 第一级 顶面 y=1
      { g: 'box', p: [0, 1, 7], s: [20, 2, 2], m: 'deck' },                  // 第二级 顶面 y=2
      { g: 'box', p: [0, 2, 5], s: [20, 2, 2], m: 'deck' },                  // 第三级 顶面 y=3
      { g: 'box', p: [11, 1, 8], s: [2, 4, 6], m: 'accent', sym: 1 },        // 阶梯侧挡板
      { g: 'box', p: [20, 4, 5], s: [24, 1, 1], m: 'accent', sym: 1 },       // 栏杆
      { g: 'box', p: [10, 3, 5], s: [1, 3, 1], m: 'dark', sym: 1 },          // 栏杆柱
      { g: 'box', p: [31, 3, 5], s: [1, 3, 1], m: 'dark', sym: 1 },
      // ===== 交易终端（炫酷主机：曲面大屏滚动行情 + 侧翼屏 + 发光键盘台）=====
      { g: 'box', p: [0, 4, -3], s: [6, 2, 3], m: 'dark' },                  // 主机基座
      { g: 'box', p: [0, 5, -2], s: [10, 2, 2], m: 'deck' },                 // 操作台
      { g: 'box', p: [0, 6, -2], s: [8, 1, 1], m: 'glowC' },                 // 发光键盘条
      { g: 'box', p: [0, 9, -5], s: [12, 6, 1], m: 'dark' },                 // 大屏背板/边框
      { g: 'box', p: [7, 8, -4], s: [3, 4, 1], m: 'screen', sym: 1 },        // 侧翼副屏
      { g: 'box', p: [5, 12, -4], s: [1, 2, 1], m: 'accent', sym: 1 },       // 天线柱
      { g: 'box', p: [5, 13, -4], s: [1, 1, 1], m: 'glowA', sym: 1, nav: 1 },// 天线灯
      { g: 'box', p: [0, 4, -1], s: [6, 1, 1], m: 'glowA' },                 // 底部氛围灯
      { g: 'box', p: [22, 5, -8], s: [8, 6, 2], m: 'screen', sym: 1 },       // 侧信息屏
    );
    // 停机坪（车削）+ 光环 + 编号灯
    for (const pp of DOCK_L.pads){
      P.push(
        { g: 'lathe', prof: 'pad', p: [pp[0], 0, pp[2]], m: 'dark', seg: 18 },
        { g: 'cyl', p: [pp[0], 1, pp[2]], s: [17, 1], m: 'glowC', seg: 18 },
        { g: 'box', p: [pp[0], 1, pp[2] + 9], s: [2, 2, 1], m: 'glowA' },
      );
    }
    // 入口引导灯（成对，穿过护盾一路排到站外）
    for (let i = 0; i < 4; i++){
      P.push({ g: 'box', p: [10, 8, 92 + i * 14], s: [2, 2, 2], m: 'glowA', sym: 1 });
    }
    buildParts(P, M, g);
    // 引导灯/门楣/航灯收集（分组动效：引导灯序列跑动，航灯慢闪）
    stationGateMat = new THREE.MeshBasicMaterial({ color: 0x35e0e8 });   // 门口引导光独立材质（护盾时变红）
    for (const d of P){
      if (d.gate){
        if (d._m) d._m.material = stationGateMat;
        if (d._sm) d._sm.material = stationGateMat;
      }
      if (d.m === 'glowA' && d.p[2] >= 92){ stationGuides.push(d._m, d._sm); }
      else if (d.nav){ stationNav.push(d._m); if (d._sm) stationNav.push(d._sm); }
      if (d.m === 'screen'){ stationHolo.push(d._m); if (d._sm) stationHolo.push(d._sm); }
    }
    // 全站防护盾气泡（受击激活；加法混合能量壳）
    stationDome = new THREE.Mesh(
      new THREE.SphereGeometry(210, 32, 20),
      new THREE.MeshBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    stationDome.position.set(0, 20, -20);
    stationDome.renderOrder = 4;
    stationDome.visible = false;
    g.add(stationDome);
    // 入口能量护盾（可穿过）
    stationShield = new THREE.Mesh(new THREE.PlaneGeometry(28, 16), M.shield);
    stationShield.position.set(0, 10, 79);
    stationShield.renderOrder = 1;
    g.add(stationShield);
    // 雷达碗（车削，沿用 stationRing 自旋）
    const dish = new THREE.Mesh(latheFromProfile('dish', 14), M.dark);
    dish.rotation.z = 0.5;
    const dishRoot = new THREE.Group();
    dishRoot.position.set(0, 72, -72);
    dishRoot.add(dish);
    g.add(dishRoot);
    stationRing = dishRoot;
    // 交易终端行情大屏（滚动数据 CanvasTexture）
    buildTerminalScreen(g);
    // 换船电脑（SVG 建模，玩家停机坪旁）
    buildGarageKiosk(g);
    // 站内工作人员（SVG 人形，闲置动画在 tickStation）
    for (const sd of STAFF_DEFS){
      const fig = buildStaffFigure(sd.c);
      fig.scale.setScalar(1.05);   // 真人尺度（≈1.85m），与行走视角一致
      // 抬高 0.05：呼吸下沉动画的最低点恰好落在地面，脚底永不插进地板
      fig.position.set(sd.pos[0], sd.pos[1] + 0.05, sd.pos[2]);
      fig.rotation.y = sd.rot;
      fig.userData = { name: sd.name, talks: sd.talks, baseY: sd.pos[1] + 0.05, rot: sd.rot, ph: Math.random() * 6 };
      g.add(fig);
      stationStaff.push(fig);
    }
    // 库内主光源（暖白，让 Lambert 内壁不至于死黑）
    const bay = new THREE.PointLight(0xfff2dd, 0.75, 170);
    bay.position.set(0, 24, 24);
    g.add(bay);
    stationLights = [];
    return g;
  }
  // 站体伪3D肖像：把真实站体模型离屏渲染成贴图（从观察者的真实视角取景，含光照与投影阴影）
  // fromPos: 观察点（世界坐标数组）；upArr: 观察者天空上方向（对齐精灵滚转，出大气无缝衔接）
  function bakeStationPortrait(renderer, fromPos, upArr){
    init();
    if (!station || !renderer) return null;
    const S = 256;
    const rt = new THREE.WebGLRenderTarget(S, S, { format: THREE.RGBAFormat });
    const tmp = new THREE.Scene();
    const parent = station.parent;
    tmp.add(station);
    tmp.add(new THREE.AmbientLight(0x8899aa, 0.4));   // 压低环境光：让方向光塑形（立体感/暗部）
    const dl = new THREE.DirectionalLight(0xfff2d0, 1.35);
    const center = station.position.clone().add(_cv.set(0, 20, -20));
    dl.position.copy(SUN_POS).sub(station.position).normalize().multiplyScalar(500).add(center);
    dl.target.position.copy(center);
    tmp.add(dl);
    tmp.add(dl.target);
    // 真实投影阴影：临时启用阴影渲染（站体材质单独重编译，不波及主场景程序）
    const hadShadow = renderer.shadowMap.enabled;
    dl.castShadow = true;
    dl.shadow.mapSize.set(1024, 1024);
    dl.shadow.camera.left = -210; dl.shadow.camera.right = 210;
    dl.shadow.camera.top = 210; dl.shadow.camera.bottom = -210;
    dl.shadow.camera.near = 1; dl.shadow.camera.far = 1400;
    station.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
    if (!hadShadow){
      renderer.shadowMap.enabled = true;
      station.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = true; });
    }
    // 取景：从观察点看向站体；up 对齐观察者天空（精灵滚转与真实视角一致）
    const dir = station.position.clone().sub(_shv.set(fromPos[0], fromPos[1], fromPos[2])).normalize();
    const cam = new THREE.PerspectiveCamera(42, 1, 1, 4000);
    if (upArr) cam.up.set(upArr[0], upArr[1], upArr[2]);
    cam.position.copy(center).addScaledVector(dir, -460);
    cam.lookAt(center);
    const oldTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);   // 透明底（场景背景色由 scene.background 主导，此改动无副作用）
    renderer.clear();
    renderer.render(tmp, cam);
    const px = new Uint8Array(S * S * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
    renderer.setRenderTarget(oldTarget);
    if (!hadShadow){
      renderer.shadowMap.enabled = false;
      station.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = true; });
    }
    // 归还站体到太空场景
    tmp.remove(station);
    if (parent) parent.add(station);
    rt.dispose();
    // 像素 → 画布（WebGL 行序上下翻转）
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++){
      img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  // ---- 站体防护盾：受击激活 / 倒计时解除 / 门口引导光红蓝切换 ----
  const _shieldC = new THREE.Vector3();
  function stationShieldCenter(out){
    return out.copy(station.position).add(new THREE.Vector3(0, 20, -20));
  }
  function raiseStationShield(hitPos){
    const first = stationDefT <= 0;
    stationDefT = 10;   // 每次命中重置：停止攻击 10 秒后解除
    if (stationDome){
      stationDome.visible = true;
      if (first){
        Sound.play('alarm');
        if (window.UI) UI.bigMessage('⚠ 空间站防护盾激活', '停止攻击 10 秒后恢复准入', 3000);
      }
    }
    // 弹击护盾涟漪：命中点爆闪 + 扩散白芯
    if (hitPos){
      spawnFlash(hitPos, 0x88ccff, 6, 0.35);
      spawnFlash(hitPos, 0xffffff, 2.5, 0.18);
    }
  }
  function isStationShieldUp(){ return stationDefT > 0; }
  // 星球天空用：克隆整座站体模型（真实几何——由星球场景的阳光实时打光，
  // 未照到的面自然呈现暗部阴影；材质克隆并禁雾，透明度按距离朦胧）
  function cloneStationModel(k){
    init();
    if (!station) return null;
    const g = station.clone(true);
    g.position.set(0, 0, 0);
    const matCache = new Map();
    g.traverse(o => {
      if (o.isLight) o.visible = false;   // 库内点光源不得带入星球场景
      if (o.isMesh && o.material){
        if (!matCache.has(o.material)){
          const m = o.material.clone();
          m.fog = false;
          if (k !== undefined && k < 0.98){
            m.transparent = true;
            m.opacity = (m.opacity !== undefined ? m.opacity : 1) * (0.45 + 0.55 * k);
          }
          matCache.set(o.material, m);
        }
        o.material = matCache.get(o.material);
      }
    });
    return g;
  }
  // 泊入信息（世界坐标；站体不旋转，仅平移）
  function getDock(){
    if (!station) return null;
    const o = station.position;
    const W = a => new THREE.Vector3(a[0] + o.x, a[1] + o.y, a[2] + o.z);
    return {
      slotCenter: W(DOCK_L.slot.c), slotHx: DOCK_L.slot.hx, slotHy: DOCK_L.slot.hy,
      trigger: { min: W(DOCK_L.trigger.min), max: W(DOCK_L.trigger.max) },
      innerWait: W(DOCK_L.innerWait),
      padPos: W(DOCK_L.pad.pos), padYaw: DOCK_L.pad.yaw,
      exit: W(DOCK_L.exit),
      terminal: W(DOCK_L.terminal),
      garage: garageKiosk ? garageKiosk.position.clone().add(o) : null,   // 换船电脑（世界坐标）
      bounds: DOCK_L.bounds, origin: o,
      staff: stationStaff,
      pilots: stationPilots(),   // 停机坪上的访客驾驶员（可对话/购船）
    };
  }
  // 空间站实体碰撞（站体轴对齐不旋转：本地 AABB/圆柱/圆环近似，飞船按半径 3 的球处理）
  // 机库为空腔（六面板拼合，前墙留真入口槽）——舱内不是实心体，旧档在库内出生也不会被挤飞
  const STATION_COLS = [
    { t: 'box', min: [-40, -4, -20], max: [40, 0, 82] },           // 库底板
    { t: 'box', min: [-40, 30, -20], max: [40, 34, 82] },          // 库顶板
    { t: 'box', min: [32, 0, -20], max: [40, 30, 82], sym: 1 },    // 侧墙
    { t: 'box', min: [-40, 0, -20], max: [40, 30, -14] },          // 后墙
    { t: 'box', min: [-40, 18, 76], max: [40, 30, 82] },           // 前墙·上段
    { t: 'box', min: [-40, 0, 76], max: [40, 2, 82] },             // 前墙·下段
    { t: 'box', min: [14, 2, 76], max: [40, 18, 82], sym: 1 },     // 前墙·侧段（中央即入口槽）
    { t: 'box', min: [44, 6, -16], max: [60, 18, 56], sym: 1 },    // 侧翼
    { t: 'box', min: [-12, -20, -10], max: [12, -4, 50] },         // 下龙骨
    { t: 'box', min: [53, 11, -54], max: [87, 13, -34], sym: 1 },  // 太阳能翼板
    { t: 'box', min: [20, -22, 52], max: [32, -6, 68], sym: 1 },   // 燃料罐
    { t: 'cylY', c: [0, -72], r: 46, y0: -60, y1: 74 },            // 主塔
    { t: 'cylY', c: [0, -72], r: 3, y0: 66, y1: 112 },             // 尖塔
    { t: 'ringY', c: [0, -72], r: 70, tube: 6, y: -20 },           // 巨环桁架
  ];
  const SHIP_R = 3;
  const _cv = new THREE.Vector3();
  function collideBox(p, mnx, mny, mnz, mxx, mxy, mxz){
    const qx = Math.max(mnx, Math.min(p.x, mxx));
    const qy = Math.max(mny, Math.min(p.y, mxy));
    const qz = Math.max(mnz, Math.min(p.z, mxz));
    _cv.set(p.x - qx, p.y - qy, p.z - qz);
    const d2 = _cv.lengthSq();
    if (d2 >= SHIP_R * SHIP_R) return false;
    if (d2 > 1e-6){
      p.addScaledVector(_cv.normalize(), SHIP_R - Math.sqrt(d2));
    } else {
      // 球心在盒内：沿最小穿透轴弹出
      const pens = [p.x - mnx, mxx - p.x, p.y - mny, mxy - p.y, p.z - mnz, mxz - p.z];
      let mi = 0;
      for (let i = 1; i < 6; i++) if (pens[i] < pens[mi]) mi = i;
      const push = pens[mi] + SHIP_R;
      if (mi === 0) p.x -= push; else if (mi === 1) p.x += push;
      else if (mi === 2) p.y -= push; else if (mi === 3) p.y += push;
      else if (mi === 4) p.z -= push; else p.z += push;
    }
    return true;
  }
  function resolveStationCollision(pos){
    if (!station) return;
    // 跃迁超光速态不必处理实体碰撞（速度 32000 会把解算结果炸飞）
    if (window.Game && Game.state === 'warping') return;
    const o = station.position;
    const lx = pos.x - o.x, ly = pos.y - o.y, lz = pos.z - o.z;
    // 防护盾激活：整站气泡屏障（库内空腔除外——理论上到不了，兜底防挤穿）
    if (stationDefT > 0){
      const insideBay = Math.abs(lx) < 32 && ly > 0 && ly < 30 && lz > -14 && lz < 78;
      if (!insideBay){
        _cv.set(lx - 0, ly - 20, lz + 20);
        const d = _cv.length();
        if (d < 213 && d > 1e-4){
          _cv.multiplyScalar(213 / d);
          pos.set(o.x + 0 + _cv.x, o.y + 20 + _cv.y, o.z - 20 + _cv.z);
          shipState.speed = Math.min(shipState.speed, 10);
          return;
        }
      }
    }
    // 粗判：站体总包围球外直接跳过（巨环半径 76 + 余量）
    if (lx * lx + (ly - 20) * (ly - 20) + (lz + 30) * (lz + 30) > 260 * 260) return;
    _cv.set(lx, ly, lz);
    const p = _cv.clone();   // 本地坐标解算
    let hit = false;
    for (const c of STATION_COLS){
      if (c.t === 'box'){
        hit = collideBox(p, c.min[0], c.min[1], c.min[2], c.max[0], c.max[1], c.max[2]) || hit;
        if (c.sym) hit = collideBox(p, -c.max[0], c.min[1], c.min[2], -c.min[0], c.max[1], c.max[2]) || hit;
      } else if (c.t === 'cylY'){
        if (p.y > c.y0 - SHIP_R && p.y < c.y1 + SHIP_R){
          const dx = p.x - c.c[0], dz = p.z - c.c[1];
          const dr = Math.sqrt(dx * dx + dz * dz);
          if (dr < c.r + SHIP_R){
            if (p.y > c.y1 - 2){ p.y = c.y1 + SHIP_R; }
            else if (p.y < c.y0 + 2){ p.y = c.y0 - SHIP_R; }
            else if (dr > 1e-4){ const k = (c.r + SHIP_R) / dr; p.x = c.c[0] + dx * k; p.z = c.c[1] + dz * k; }
            else { p.x = c.c[0] + c.r + SHIP_R; }
            hit = true;
          }
        }
      } else if (c.t === 'ringY'){
        const dx = p.x - c.c[0], dz = p.z - c.c[1];
        const dr = Math.sqrt(dx * dx + dz * dz) - c.r;
        const dy = p.y - c.y;
        const d2 = dr * dr + dy * dy;
        const R2 = (c.tube + SHIP_R) * (c.tube + SHIP_R);
        if (d2 < R2 && d2 > 1e-6){
          const d = Math.sqrt(d2), k = (c.tube + SHIP_R) / d;
          const rr = c.r + dr * k;
          const drl = Math.max(1e-4, Math.sqrt(dx * dx + dz * dz));
          p.x = c.c[0] + dx / drl * rr;
          p.z = c.c[1] + dz / drl * rr;
          p.y = c.y + dy * k;
          hit = true;
        }
      }
    }
    if (hit){
      pos.set(p.x + o.x, p.y + o.y, p.z + o.z);
      shipState.speed = Math.min(shipState.speed, 14);   // 擦撞减速（不可穿站，泊入请走发光入口）
    }
  }
  // 站内动效：护盾涟漪 / 引导灯序列 / 屏幕闪烁 / 人员闲置呼吸（任何状态可调用）
  let _stT = 0;
  function tickStation(dt){
    if (!station) return;
    _stT += dt;
    tickVisitors(dt);   // 访客舰队：巡航/进港/停泊/离港（站内行走时也持续运转，可看到船进出）
    // 防护盾状态机：受击刷新倒计时 → 归零解除；门口引导光红蓝切换
    if (stationDefT > 0){
      stationDefT -= dt;
      if (stationDome){
        stationDome.material.opacity = Math.min(0.16, stationDome.material.opacity + dt * 0.5) * (0.85 + 0.15 * Math.sin(_stT * 6));
      }
      if (stationGateMat){
        // 红色警戒闪烁
        const bl = 0.55 + 0.45 * Math.sin(_stT * 9);
        stationGateMat.color.setRGB(1, 0.18 * bl, 0.12 * bl);
      }
      if (stationDefT <= 0){
        stationDefT = 0;
        if (stationDome){ stationDome.visible = false; stationDome.material.opacity = 0; }
        if (stationGateMat) stationGateMat.color.set(0x35e0e8);   // 恢复蓝色引导光
        Sound.play('scanHit');
        if (window.UI) UI.bigMessage('空间站防护盾解除', '准入已恢复', 2200);
      }
    }
    if (stationShield){
      stationShield.material.opacity = 0.2 + Math.sin(_stT * 2.2) * 0.05;
    }
    for (let i = 0; i < stationGuides.length; i++){
      const l = stationGuides[i];
      if (l) l.visible = ((_stT * 3 - (i >> 1)) % 4) > 0.6;
    }
    // 航灯慢闪（翼尖/天线/巨环节点，红绿灯塔感）
    for (let i = 0; i < stationNav.length; i++){
      const l = stationNav[i];
      if (l) l.visible = Math.sin(_stT * 2 + i * 1.3) > -0.2;
    }
    for (let i = 0; i < stationHolo.length; i++){
      stationHolo[i].material.color.setHSL(0.51, 0.7, 0.18 + 0.05 * Math.sin(_stT * 1.7 + i));
    }
    for (const f of stationStaff){
      f.position.y = f.userData.baseY + Math.sin(_stT * 1.6 + f.userData.ph) * 0.05;
      f.rotation.y = f.userData.rot + Math.sin(_stT * 0.5 + f.userData.ph) * 0.08;
    }
    // 停机坪驾驶员：玩手机微动 + 屏幕光闪烁
    for (const v of visitors){
      const fig = v.userData.pilotFig;
      if (!fig) continue;
      fig.position.y = fig.userData.baseY + Math.sin(_stT * 1.3 + fig.userData.ph) * 0.03;
      if (fig.userData.phone) fig.userData.phone.material.color.setHSL(0.55, 0.7, 0.6 + 0.25 * Math.sin(_stT * 7 + fig.userData.ph));
    }
    // 终端行情屏：4fps 刷新（滚动扫描线 + 价格随机游走）
    if (termCtx && _stT - termLast > 0.25){
      termLast = _stT;
      for (const r of termRows){
        const step = (Math.random() - 0.48) * 2.2;
        r.d = step;
        r.p = Math.max(5, Math.min(999, r.p + step));
      }
      drawTerminal(_stT);
    }
  }

  // ---------- 飞船等级体系（NMS 式 C/B/A/S）：级别决定武器与货仓 ----------
  const SHIP_CLASSES = {
    C: { w: 0.55, price: 45000,  weapon: 'pulse',   wName: '脉冲机炮', slots: 12, col: '#9aa6b2' },
    B: { w: 0.25, price: 140000, weapon: 'twin',    wName: '双联流火炮', slots: 16, col: '#35e0e8' },
    A: { w: 0.15, price: 350000, weapon: 'phase',   wName: '相位光矛', slots: 20, col: '#b58aff' },
    S: { w: 0.05, price: 900000, weapon: 'annihil', wName: '湮灭重炮', slots: 24, col: '#ffd94d' },
  };
  const SHIP_MODEL_NAMES = { ship_striker: '掠袭者', ship_dispatcher: '调度者', ship_insurgent: '叛徒', ship: '拓荒矿船' };
  function rollShipClass(rnd){
    const r = (rnd || Math.random)();
    let acc = 0;
    for (const k of ['C', 'B', 'A', 'S']){ acc += SHIP_CLASSES[k].w; if (r < acc) return k; }
    return 'C';
  }
  // ---------- 停机坪驾驶员（SVG 人形，站在机旁玩手机）----------
  const PILOT_PALETTES = [
    { hair: '#2e2620', skin: '#e8c49a', suit: '#4a5a6e', trim: '#35e0e8', glove: '#2e3640', belt: '#22303a', pants: '#33404c', boots: '#1e262e' },
    { hair: '#5a4632', skin: '#d8b48a', suit: '#6e4a2a', trim: '#ffb347', glove: '#3a2e22', belt: '#4a3a26', pants: '#4a3c30', boots: '#2e2620' },
    { hair: '#3a3f4a', skin: '#e8d0b0', suit: '#5a3e5e', trim: '#ff6a5e', glove: '#3a2e3c', belt: '#2e2430', pants: '#443648', boots: '#241e2e' },
  ];
  const PILOT_NAMES = ['游商·卡洛', '飞手·薇拉', '老练的走私客', '星途旅人·顿', '佣兵·赤羽', '货运队长·穆'];
  function spawnPilot(v){
    const pal = PILOT_PALETTES[(Math.random() * PILOT_PALETTES.length) | 0];
    const fig = buildStaffFigure(pal);
    fig.scale.setScalar(1.05);
    // 站位：机旁走道侧 3.5 格
    fig.position.copy(v.position);
    fig.position.x += v.position.x > station.position.x ? -3.5 : 3.5;
    fig.position.y = station.position.y + 2 + 0.05;   // 停机坪面
    fig.rotation.y = Math.PI + (Math.random() - 0.5) * 0.6;
    // 手机（发光小方块举在胸前）+ 低头玩手机姿态（整体微前倾）
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.03), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
    phone.position.set(0.16, 1.05, -0.28);
    fig.add(phone);
    fig.rotation.x = 0.09;
    fig.userData = {
      pilot: true, visitor: v, phone,
      name: PILOT_NAMES[(Math.random() * PILOT_NAMES.length) | 0],
      ph: Math.random() * 6,
      baseY: fig.position.y,
    };
    scene.add(fig);
    v.userData.pilotFig = fig;
    return fig;
  }
  function despawnPilot(v){
    if (v.userData.pilotFig){
      scene.remove(v.userData.pilotFig);
      v.userData.pilotFig = null;
    }
  }
  function stationPilots(){
    const out = [];
    for (const v of visitors) if (v.userData.pilotFig) out.push(v.userData.pilotFig);
    return out;
  }
  // ---------- 访客飞船舰队（Quaternius CC0 精模为主，程序化零件船兜底）----------
  const VISITOR_MODELS = ['ship_striker', 'ship_dispatcher', 'ship_insurgent', 'ship'];
  function buildVisitorShip(kind, tint){
    const g = new THREE.Group();
    // 优先外部精模：Quaternius Ultimate Spaceships（战舰级细节）/ Kenney 矿业船
    const name = VISITOR_MODELS[kind % VISITOR_MODELS.length];
    if (window.ModelLib && ModelLib.has(name)){
      const m = ModelLib.get(name, name === 'ship' ? 5.6 : 7.5, {
        ground: false,
        yaw: name === 'ship' ? 0 : Math.PI,          // Quaternius 船头朝 +Z，转正为 -Z
        tint: name === 'ship' ? tint : undefined,    // 精模自带涂装，不染色
      });
      if (m) g.add(m);
    }
    if (!g.children.length){
      const M = {
        hull: new THREE.MeshLambertMaterial({ color: 0x9aa6b2 }),
        dark: new THREE.MeshLambertMaterial({ color: 0x3a424c }),
        acc:  new THREE.MeshLambertMaterial({ color: tint }),
        glow: new THREE.MeshBasicMaterial({ color: 0x66ccff }),
        glas: new THREE.MeshBasicMaterial({ color: 0x9fe8ff }),
      };
      const P = [];
      if (kind === 1){
        // 猎鹰战机：箭簇机身 + 后掠翼 + 双引擎
        P.push(
          { g: 'box', p: [0, 0, 0], s: [1, 1, 4], m: 'hull' },
          { g: 'box', p: [0, 0, -2], s: [1, 1, 1], m: 'dark' },
          { g: 'box', p: [0, 1, 0], s: [1, 1, 1], m: 'glas' },
          { g: 'box', p: [2, 0, 1], s: [3, 1, 2], m: 'acc', sym: 1, r: [0, 0.35, 0] },
          { g: 'box', p: [1, 0, 2], s: [1, 1, 1], m: 'glow', sym: 1 },
        );
      } else if (kind === 2){
        // 重型货轮：驾驶舱 + 三节货舱 + 侧挂罐
        P.push(
          { g: 'box', p: [0, 0, -3], s: [2, 2, 2], m: 'hull' },
          { g: 'box', p: [0, 0, 0], s: [2, 2, 2], m: 'acc' },
          { g: 'box', p: [0, 0, 2], s: [2, 2, 2], m: 'hull' },
          { g: 'box', p: [0, 0, 4], s: [2, 2, 2], m: 'acc' },
          { g: 'cyl', p: [2, 0, 1], s: [1, 6], m: 'dark', sym: 1, r: [Math.PI / 2, 0, 0] },
          { g: 'box', p: [0, 0, 6], s: [1, 1, 1], m: 'glow' },
        );
      } else {
        // 穿梭艇：圆润机身 + 高垂尾 + 小翼
        P.push(
          { g: 'box', p: [0, 0, 0], s: [2, 1, 4], m: 'hull' },
          { g: 'box', p: [0, 1, 1], s: [1, 2, 2], m: 'acc' },
          { g: 'box', p: [0, 1, -1], s: [1, 1, 1], m: 'glas' },
          { g: 'box', p: [2, 0, 0], s: [1, 1, 2], m: 'acc', sym: 1 },
          { g: 'box', p: [1, 0, 2], s: [1, 1, 1], m: 'glow', sym: 1 },
        );
      }
      buildParts(P, M, g);
    }
    return g;
  }
  let visitors = [];
  let visPadOcc = [false, false, false];
  let hostiles = [];       // 敌方弹幕
  let visRespawn = [];     // 被击毁访客的补员倒计时
  let visitorTarget = 7;   // 期望舰队规模（画面设置可调 0~20）
  const VIS_HP = { C: 20, B: 34, A: 52, S: 80 };   // 船体强度（NMS 手感：C 级也要二十余发）
  const VIS_TINTS = [0xc9641a, 0x35b0ff, 0x7dff8a, 0xb58aff, 0xff6a5e, 0xffd94d];
  function spawnOneVisitor(rnd){
    const r = rnd || Math.random;
    const i = (r() * 1000) | 0;
    const kind = i % 4;
    const g = buildVisitorShip(kind, VIS_TINTS[i % VIS_TINTS.length]);
    g.position.set((r() - 0.5) * 3000, (r() - 0.5) * 500, (r() - 0.5) * 3000);
    const cls = rollShipClass(r);
    const model = VISITOR_MODELS[kind % VISITOR_MODELS.length];
    g.userData = {
      st: 'cruise', tgt: randCruiseTarget(r), speed: 16 + r() * 14, cd: 6 + r() * 24,
      pad: -1, path: null, pi: 0, wait: 0,
      cls, model,
      price: Math.round(SHIP_CLASSES[cls].price * (0.88 + r() * 0.28) / 100) * 100,
      pilotFig: null,
      hp: VIS_HP[cls], aggro: 0, fireCd: 1.5, ctgt: null, strafeT: 0,
    };
    scene.add(g);
    visitors.push(g);
    return g;
  }
  function spawnVisitors(){
    visitors = [];
    visPadOcc = [false, false, false];
    hostiles = [];
    visRespawn = [];
    const rnd = mulberry32(currentGalaxySeed ^ 0xF11E7);
    for (let i = 0; i < visitorTarget; i++) spawnOneVisitor(rnd);
  }
  // 画面设置：NPC 飞船数量（运行时增删——只裁撤巡航中的船，泊站/缠斗不打扰）
  function setVisitorCount(n){
    visitorTarget = Math.max(0, Math.min(20, n | 0));
    if (!initialized) return;
    while (visitors.length < visitorTarget) spawnOneVisitor();
    if (visitors.length > visitorTarget){
      for (let i = visitors.length - 1; i >= 0 && visitors.length > visitorTarget; i--){
        const v = visitors[i];
        if (v.userData.st === 'cruise'){
          scene.remove(v);
          visitors.splice(i, 1);
        }
      }
    }
  }
  function randCruiseTarget(rnd){
    const r = rnd || Math.random;
    if (planets.length && (r() < 0.5)){
      const p = planets[(r() * planets.length) | 0];
      return p.mesh.position.clone().add(new THREE.Vector3((r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2).normalize().multiplyScalar(p.def.radius + 220 + r() * 300));
    }
    return new THREE.Vector3((r() - 0.5) * 4200, (r() - 0.5) * 700, (r() - 0.5) * 4200);
  }
  const _vd = new THREE.Vector3(), _vq = new THREE.Quaternion(), _ve = new THREE.Euler(), _vf = new THREE.Vector3();
  // 访客引擎声：以飞船/玩家附近为听者做距离衰减（220 内可闻，越近越响）
  function visVol(pos, base){
    const d = pos.distanceTo(shipState.pos);
    const k = THREE.MathUtils.clamp(1 - d / 220, 0, 1);
    return k * k * (base || 1);
  }
  function visSnd(name, pos, base){
    const v = visVol(pos, base);
    if (v > 0.02) Sound.play(name, v);
  }
  function visMove(v, target, speed, dt, turn){
    _vd.copy(target).sub(v.position);
    const d = _vd.length();
    if (d < Math.max(2, speed * dt * 2)) return true;
    _vd.normalize();
    _ve.set(Math.asin(THREE.MathUtils.clamp(_vd.y, -1, 1)), Math.atan2(-_vd.x, -_vd.z), 0, 'YXZ');
    v.quaternion.slerp(_vq.setFromEuler(_ve), Math.min(1, dt * (turn || 2.2)));
    v.position.addScaledVector(_vd, Math.min(speed * dt, d));
    return false;
  }
  function stationPadWorld(i, y){
    const pp = VIS_PADS[i];
    return new THREE.Vector3(station.position.x + pp[0], station.position.y + (y === undefined ? 3 : y), station.position.z + pp[1]);
  }
  function tickVisitors(dt){
    if (!station) return;
    const o = station.position;
    for (const v of visitors){
      const u = v.userData;
      if (u.st === 'cruise'){
        if (visMove(v, u.tgt, u.speed, dt)) u.tgt = randCruiseTarget();
        u.cd -= dt;
        if (u.cd <= 0){
          u.cd = 18 + Math.random() * 30;
          // 随机泊站：领一个空访客机位（玩家专属位永不占用）
          const free = visPadOcc.findIndex(x => !x);
          if (free >= 0 && Math.random() < 0.6){
            visPadOcc[free] = true;
            u.pad = free;
            const padTop = stationPadWorld(free, 3);
            u.path = [
              new THREE.Vector3(o.x, o.y + 12, o.z + 170),
              new THREE.Vector3(o.x, o.y + 10, o.z + 79),
              new THREE.Vector3(o.x, o.y + 12, o.z + 44),
              padTop.clone().setY(padTop.y + 7),
              padTop,
            ];
            u.pi = 0;
            u.st = 'dockin';
          }
        }
      } else if (u.st === 'dockin'){
        const last = u.pi === u.path.length - 1;
        if (visMove(v, u.path[u.pi], last ? 7 : 24, dt, 3.5)){
          u.pi++;
          if (u.pi === 2) visSnd('visitorWhoosh', v.position, 1);        // 穿盾入库
          if (u.pi === u.path.length - 1) visSnd('visitorLand', v.position, 1);   // 开始垂降
          if (u.pi >= u.path.length){
            v.position.copy(u.path[u.path.length - 1]);
            u.st = 'parked';
            u.wait = 30 + Math.random() * 40;
            spawnPilot(v);   // 驾驶员下机，站在机旁玩手机
          }
        }
      } else if (u.st === 'parked'){
        // 停稳：机头缓转朝出口（+Z）
        v.quaternion.slerp(_vq.setFromEuler(_ve.set(0, Math.PI, 0, 'YXZ')), Math.min(1, dt * 2));
        u.wait -= dt;
        if (u.wait <= 0){
          despawnPilot(v);   // 驾驶员登机
          u.path = [
            v.position.clone().add(_vd.set(0, 7, 0)),
            new THREE.Vector3(o.x, o.y + 12, o.z + 44),
            new THREE.Vector3(o.x, o.y + 10, o.z + 79),
            new THREE.Vector3(o.x, o.y + 12, o.z + 190),
          ];
          u.pi = 0;
          u.st = 'dockout';
          visSnd('visitorLift', v.position, 1);                          // 引擎拉起
        }
      } else if (u.st === 'dockout'){
        if (visMove(v, u.path[u.pi], u.pi === 0 ? 8 : 26, dt, 3.5)){
          u.pi++;
          if (u.pi === 3) visSnd('visitorWhoosh', v.position, 0.8);      // 穿盾出库
          if (u.pi >= u.path.length){
            if (u.pad >= 0){ visPadOcc[u.pad] = false; u.pad = -1; }
            u.st = 'cruise';
            u.tgt = randCruiseTarget();
          }
        }
      } else if (u.st === 'combat'){
        // 玩家已泊入空间站：站方管制区内停火——敌意清空返回巡航（站内不再被骚扰）
        if (window.Game && Game.state === 'station'){
          u.st = 'cruise'; u.aggro = 0; u.tgt = randCruiseTarget();
          continue;
        }
        // 缠斗：绕玩家侧向机动 + 面向即开火（反击）
        u.aggro -= dt;
        if (u.aggro <= 0){ u.st = 'cruise'; u.tgt = randCruiseTarget(); continue; }
        u.strafeT -= dt;
        if (!u.ctgt || u.strafeT <= 0){
          u.strafeT = 2 + Math.random() * 1.6;
          u.ctgt = shipState.pos.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2
          ).normalize().multiplyScalar(55 + Math.random() * 90));
        }
        visMove(v, u.ctgt, u.speed + 16, dt, 3.4);
        u.fireCd -= dt;
        _vd.copy(shipState.pos).sub(v.position);
        const pd = _vd.length();
        _vd.normalize();
        _vf.set(0, 0, -1).applyQuaternion(v.quaternion);
        if (u.fireCd <= 0 && pd < 280 && _vf.dot(_vd) > 0.85){
          u.fireCd = 0.9 + Math.random() * 0.9;
          // 预判弹道 + 微散布，按本船等级武器开火
          _vd.x += (Math.random() - 0.5) * 0.05;
          _vd.y += (Math.random() - 0.5) * 0.05;
          _vd.z += (Math.random() - 0.5) * 0.05;
          _vd.normalize();
          fireBolt(v.position.clone().addScaledVector(_vd, 5), _vd, SHIP_CLASSES[u.cls].weapon, true);
          visSnd('enemyShoot', v.position, 1.2);   // 敌舰开火音（距离衰减）
        }
      }
    }
    // 敌方弹幕：命中玩家（扫掠判定防隧穿；太空中不致死，压到 1 HP 为止）
    for (let i = hostiles.length - 1; i >= 0; i--){
      const b = hostiles[i];
      b.userData.life -= dt;
      _lp.copy(b.position);
      b.position.addScaledVector(b.userData.dir, 420 * (b.userData.speedMul || 1) * dt);
      let kill = b.userData.life <= 0;
      // 玩家在站内受管制区庇护：敌方弹幕不再判定命中
      const safeDock = window.Game && Game.state === 'station';
      if (!kill && !safeDock && segHit(_lp, b.position, shipState.pos, 3.5)){
        const pdmg = b.userData.dmg;
        Sound.play('hullHit');       // 被击中：金属闷响+警示哔（原 shipDamage 音量过弱）
        Sound.play('shipDamage', 0.6);
        spawnFlash(b.position, 0xff6a4a, 3, 0.25);
        if (!(window.Game && Game.creative) && Player.stats.hp + Player.stats.shield > pdmg) Player.damage(pdmg);
        kill = true;
      }
      if (!kill && station && b.position.distanceToSquared(station.position) < 90 * 90) kill = true;   // 站体护盾拦截
      if (kill){ scene.remove(b); hostiles.splice(i, 1); }
    }
    // 击毁补员（尊重期望舰队规模）
    for (let i = visRespawn.length - 1; i >= 0; i--){
      visRespawn[i] -= dt;
      if (visRespawn[i] <= 0){
        visRespawn.splice(i, 1);
        if (visitors.length < visitorTarget) spawnOneVisitor();
      }
    }
    tickBoltFx(dt);
  }
  // 扫掠命中：本帧线段 prev→cur 与球(center,r) 相交判定（消除高速弹隧穿）
  const _segD = new THREE.Vector3(), _segC = new THREE.Vector3(), _lp = new THREE.Vector3();
  const _obbP0 = new THREE.Vector3(), _obbP1 = new THREE.Vector3(), _obbQ = new THREE.Quaternion();
  function segHit(prev, cur, center, r){
    _segD.copy(cur).sub(prev);
    _segC.copy(center).sub(prev);
    const len2 = _segD.lengthSq();
    const t = len2 > 1e-8 ? THREE.MathUtils.clamp(_segC.dot(_segD) / len2, 0, 1) : 0;
    _segC.addScaledVector(_segD, -t);   // center 到线段最近点的向量（复用 _segC）
    return _segC.lengthSq() < r * r;
  }
  // 线段 vs 轴对齐盒（船体本地空间）：slab 法
  function segAABB(p0, p1, hx, hy, hz){
    let t0 = 0, t1 = 1;
    const axes = [[p0.x, p1.x, hx], [p0.y, p1.y, hy], [p0.z, p1.z, hz]];
    for (const [a0, a1, h] of axes){
      const d = a1 - a0;
      if (Math.abs(d) < 1e-8){
        if (Math.abs(a0) > h) return false;
      } else {
        let ta = (-h - a0) / d, tb = (h - a0) / d;
        if (ta > tb){ const tmp = ta; ta = tb; tb = tmp; }
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) return false;
      }
    }
    return true;
  }
  // 可被攻击判定：巡航/缠斗恒可；进出港中的船在远离站盾(240+)时同样可截击
  function visAttackable(v){
    const u = v.userData;
    if (u.st === 'cruise' || u.st === 'combat') return true;
    if ((u.st === 'dockin' || u.st === 'dockout') && station &&
        v.position.distanceToSquared(station.position) > 240 * 240) return true;
    return false;
  }
  // 玩家弹命中访客船：真实朝向碰撞箱（模型包围盒+余量，随船体旋转）
  function hitVisitorCheck(prev, b){
    for (const v of visitors){
      const u = v.userData;
      if (!visAttackable(v)) continue;
      if (!u.he){   // 惰性缓存半长宽高（模型包围盒 × 1.2 + 1.2 余量）
        const box = new THREE.Box3().setFromObject(v);
        const size = new THREE.Vector3();
        box.getSize(size);
        u.he = { x: size.x * 0.6 + 1.2, y: size.y * 0.6 + 1.2, z: size.z * 0.6 + 1.2 };
      }
      // 粗筛（外接球）后转入船体本地空间做线段-盒判定
      const rr = Math.max(u.he.x, u.he.y, u.he.z) + 4;
      if (!segHit(prev, b.position, v.position, rr)) continue;
      _obbQ.copy(v.quaternion).invert();
      _obbP0.copy(prev).sub(v.position).applyQuaternion(_obbQ);
      _obbP1.copy(b.position).sub(v.position).applyQuaternion(_obbQ);
      if (segAABB(_obbP0, _obbP1, u.he.x, u.he.y, u.he.z)){
        u.hp -= (b.userData.dmg || 1);
        // 进出港途中被截击：放弃泊入流程转入缠斗（释放机位/航线）
        if (u.pad >= 0){ visPadOcc[u.pad] = false; u.pad = -1; }
        u.path = null;
        u.st = 'combat'; u.aggro = 25; u.ctgt = null;
        Sound.play('laserHit');
        spawnFlash(b.position, 0xffcc88, 2.6, 0.2);
        if (u.hp <= 0) destroyVisitor(v);
        return true;
      }
    }
    return false;
  }
  // 击毁与掠夺：按等级掉落珍贵货物 + 信用点
  const PIRATE_LOOT = {
    C: { cr: 800,   items: [['tritium', 6, 10]] },
    B: { cr: 2500,  items: [['tritium', 8, 14], ['circuit', 2, 4]] },
    A: { cr: 6000,  items: [['tritium', 10, 16], ['data', 3, 5], ['gold_ore', 2, 3]] },
    S: { cr: 15000, items: [['data', 5, 8], ['gold_ore', 3, 5], ['warpcell', 1, 1]] },
  };
  function destroyVisitor(v){
    const u = v.userData;
    Sound.play('explode');
    spawnFlash(v.position, 0xffaa55, 14, 0.6);
    spawnFlash(v.position, 0xffffff, 7, 0.35);
    const loot = PIRATE_LOOT[u.cls] || PIRATE_LOOT.C;
    let txt = [];
    for (const [id, a, bx] of loot.items){
      const n = a + ((Math.random() * (bx - a + 1)) | 0);
      // 战利品直入飞船货仓（背包满也不丢失；溢出自动转随身）
      const got = (window.Game && Game.addCargo) ? Game.addCargo(id, n) : Player.addItem(id, n, true);
      txt.push(`${TERM_NAMES[id] || id}×${n}${got < n ? '（部分丢弃：货仓已满）' : ''}`);
    }
    Player.credits += loot.cr;
    if (window.UI && UI.refreshHUD) UI.refreshHUD();   // 信用点即时刷新（不等背包交互）
    if (window.UI) UI.bigMessage(`☠ 击毁 ${u.cls} 级「${SHIP_MODEL_NAMES[u.model] || u.model}」`, `战利品入舱：${txt.join(' · ')} · 信用点 +${loot.cr.toLocaleString()}`, 4200);
    removeVisitorShip(v);
    visRespawn.push(35 + Math.random() * 30);   // 一段时间后星系补入新船
  }

  // ---------- 初始化场景 ----------
  // ---------- 体积云层（太空视角：星球外围缓慢流动的云壳）----------
  let cloudsOn = true;
  let _cloudShellTex = null;
  function cloudShellTexture(){
    if (_cloudShellTex) return _cloudShellTex;
    const W = 256, H = 128;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const img = x.createImageData(W, H);
    const n = makeNoise(90210);
    for (let py = 0; py < H; py++){
      for (let px = 0; px < W; px++){
        // 左右边界交叉淡化：经度方向无缝衔接
        const t = px / W;
        const v1 = n.fbm2(px * 0.05, py * 0.08, 4) * 0.5 + 0.5;
        const v2 = n.fbm2((px - W) * 0.05, py * 0.08, 4) * 0.5 + 0.5;
        const v = v1 * (1 - t) + v2 * t;
        const a = THREE.MathUtils.smoothstep(v, 0.52, 0.76);
        const i = (py * W + px) * 4;
        img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
        img.data[i + 3] = (a * 235) | 0;
      }
    }
    x.putImageData(img, 0, 0);
    _cloudShellTex = new THREE.CanvasTexture(c);
    return _cloudShellTex;
  }
  function setClouds(on){
    cloudsOn = on;
    if (!initialized) return;
    for (const p of planets){
      if (on && !p.cloudShell){
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(p.def.radius * 1.10, 32, 16),
          new THREE.MeshLambertMaterial({ map: cloudShellTexture(), transparent: true, depthWrite: false, opacity: 0.85 }));
        m.renderOrder = 1;   // 云壳晚于球体(-1)与体素皮肤(0)：不依赖不稳定的距离排序
        m.rotation.y = p.def.id * 1.7;
        p.mesh.add(m);
        p.cloudShell = m;
      }
      if (p.cloudShell) p.cloudShell.visible = on;
    }
  }

  // ---------- 逼真大气层（太空视角）：星球边缘大气散射辉光 + 晨昏线暖光 ----------
  let realAtmoOn = true;
  function setRealAtmo(on){
    realAtmoOn = on;
    if (!initialized) return;
    for (const p of planets){
      if (on && !p.atmoShell){
        const b = BIOMES[p.def.biome];
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uSunDir: { value: SUN_POS.clone().sub(p.mesh.position).normalize() },
            uCol: { value: new THREE.Color(b.sky[0], b.sky[1], b.sky[2]) },
          },
          vertexShader: [
            'varying vec3 vN; varying vec3 vW;',
            'void main(){',
            '  vN = normalize(mat3(modelMatrix) * normal);',
            '  vec4 w = modelMatrix * vec4(position, 1.0);',
            '  vW = w.xyz;',
            '  gl_Position = projectionMatrix * viewMatrix * w;',
            '}',
          ].join('\n'),
          fragmentShader: [
            'varying vec3 vN; varying vec3 vW;',
            'uniform vec3 uSunDir; uniform vec3 uCol;',
            'void main(){',
            '  vec3 V = normalize(cameraPosition - vW);',
            '  vec3 N = normalize(vN);',
            '  float rim = pow(1.0 - max(dot(V, N), 0.0), 3.0);',            // 边缘菲涅尔散射
            '  float day = clamp(dot(N, uSunDir) * 1.6 + 0.3, 0.0, 1.0);',   // 昼半球亮
            '  float tw = pow(1.0 - abs(dot(N, uSunDir)), 3.0);',            // 晨昏线
            '  vec3 col = uCol * rim * 1.5 * day + vec3(1.0, 0.45, 0.22) * rim * tw * day * 1.2;',
            '  gl_FragColor = vec4(col, min(1.0, rim * 1.7) * (day * 0.85 + 0.04));',
            '}',
          ].join('\n'),
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        // 1.22R：高于方块地形上限（山体≈1.15R、树冠≈1.19R）——体素皮肤边缘淡出像素
        // 也写深度，壳层若低于地形会被这些像素打出碎片状的透明缺口
        const shell = new THREE.Mesh(new THREE.SphereGeometry(p.def.radius * 1.22, 48, 24), mat);
        shell.renderOrder = 2;   // 大气散射最外层：晚于云壳绘制
        p.mesh.add(shell);
        p.atmoShell = shell;
      }
      if (p.atmoShell) p.atmoShell.visible = on;
      // 原简单光晕与逼真散射二选一，避免叠加浑浊
      const glow = p.mesh.children[0];
      if (glow) glow.visible = !on;
    }
  }

  function init(){
    if (initialized) return;
    initialized = true;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020308);

    scene.add(new THREE.AmbientLight(0x404860, 0.9));
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.2);
    sun.position.copy(SUN_POS).normalize().multiplyScalar(100);   // 照明方向与可见恒星一致
    scene.add(sun);

    // 恒星背景
    const starGeo = new THREE.BufferGeometry();
    const sp = [], sc = [];
    const rnd = mulberry32(777);
    for (let i = 0; i < 3000; i++){
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(9000);
      sp.push(v.x, v.y, v.z);
      const b = 0.5 + rnd() * 0.5;
      const tintR = rnd() < 0.1 ? 1.2 : 1;
      sc.push(b * tintR, b, b * (rnd() < 0.1 ? 1.3 : 1));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    starPoints = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 6, vertexColors: true, sizeAttenuation: false }));
    starPoints.material.size = 1.6;
    scene.add(starPoints);

    // 恒星（太阳）：真实存在的天体——程序化米粒组织表面、缓慢自转、可接近（高温危险）
    const sunTex = sunTextures();
    sunBody = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 48, 24), new THREE.MeshBasicMaterial({ map: sunTex.surface }));
    sunBody.position.copy(SUN_POS);
    scene.add(sunBody);
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex.corona, transparent: true, depthWrite: false }));
    sunGlow.scale.set(SUN_R * 8, SUN_R * 8, 1);
    sunGlow.position.copy(SUN_POS);
    scene.add(sunGlow);
    const sunCorona = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex.corona, transparent: true, depthWrite: false, opacity: 0.85 }));
    sunCorona.scale.set(SUN_R * 3.2, SUN_R * 3.2, 1);
    sunCorona.position.copy(SUN_POS);
    scene.add(sunCorona);

    // 星球群
    planets = [];
    const holoGeo = new THREE.SphereGeometry(1, 48, 24);   // 扫描全息罩共用单位球
    for (const pd of SYSTEM_PLANETS){
      const pt = planetTexture(pd.biome, 1000 + pd.id * 137);
      const mat = new THREE.MeshLambertMaterial({ map: pt.tex, transparent: true });
      // 表皮溶解：接近时球面贴图在登陆区域渐隐，由体素地形无缝接管（贴图“变成”方块）
      const holeU = { amt: { value: 0 }, dir: { value: new THREE.Vector3(0, 1, 0) } };
      mat.onBeforeCompile = shader => {
        shader.uniforms.uHoleAmt = holeU.amt;
        shader.uniforms.uHoleDir = holeU.dir;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vHolePos;\nuniform float uHoleAmt;\nuniform vec3 uHoleDir;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHolePos = position;\ntransformed *= 1.0 - 0.15 * uHoleAmt * smoothstep(0.8387, 0.891, dot(normalize(position), uHoleDir));');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vHolePos;\nuniform float uHoleAmt;\nuniform vec3 uHoleDir;')
          .replace('#include <fog_fragment>', '#include <fog_fragment>\n{\n  float hd = dot(normalize(vHolePos), uHoleDir);\n  gl_FragColor.a *= 1.0 - uHoleAmt * smoothstep(0.955, 0.99, hd);\n}');
      };
      mat.customProgramCacheKey = () => 'phole';
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(pd.radius, 64, 32), mat);
      // 透明排序定序：球体永远先于体素皮肤/云层等透明物绘制——
      // 皮肤区块以切平面锚点参与排序，某些经纬/自转下会被排到球体之前，
      // 半透明像素（边缘淡出/区块淡入）便与星空混合，星球看起来东一块西一块透明
      mesh.renderOrder = -1;
      mesh.position.set(...pd.pos);
      scene.add(mesh);
      // 大气光晕（1.23R：高于方块地形/树冠上限≈1.19R，避免被区块边缘像素的深度打碎；
      // 不写深度——纯叠加层，写深度会反过来裁掉云壳/扫描罩等后绘透明层）
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(pd.radius * 1.23, 14, 10),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(BIOMES[pd.biome].sky[0], BIOMES[pd.biome].sky[1], BIOMES[pd.biome].sky[2]), transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false })
      );
      mesh.add(atmo);
      atmo.renderOrder = 2;   // 光晕最外层：晚于球体(-1)与体素皮肤(0)绘制
      // 扫描全息罩（NMS 式）：扫描波抵达时，波前光环从命中点掠过整球，
      // 身后留下渐隐的经纬网格 + 边缘辉光；加法混合叠在星球本体上，平时隐藏
      const scanU = {
        uT: { value: 0 },
        uHit: { value: new THREE.Vector3(0, 1, 0) },
        uCol: { value: new THREE.Color(0x35e0e8) },
      };
      const scanShell = new THREE.Mesh(holoGeo, new THREE.ShaderMaterial({
        uniforms: scanU,
        vertexShader: [
          'varying vec3 vLp; varying vec3 vWp; varying vec3 vWn;',
          'void main(){',
          '  vLp = position;',
          '  vec4 w = modelMatrix * vec4(position, 1.0);',
          '  vWp = w.xyz;',
          '  vWn = normalize(mat3(modelMatrix) * position);',
          '  gl_Position = projectionMatrix * viewMatrix * w;',
          '}',
        ].join('\n'),
        fragmentShader: [
          'uniform float uT; uniform vec3 uHit; uniform vec3 uCol;',
          'varying vec3 vLp; varying vec3 vWp; varying vec3 vWn;',
          'void main(){',
          '  vec3 N = normalize(vLp);',
          '  float ang = acos(clamp(dot(N, uHit), -1.0, 1.0));',            // 距命中点的球面角
          '  float d = ang - uT * 3.6;',                                    // 波前推进：0 → 越过整球
          '  float band = exp(-d * d * 30.0);',                             // 主波前光环
          '  float echo = exp(-(d + 0.55) * (d + 0.55) * 46.0) * 0.45;',    // 尾随回波
          '  float swept = 1.0 - smoothstep(-0.3, 0.05, d);',                // 已掠过区域
          '  float lat = asin(clamp(N.y, -1.0, 1.0));',
          '  float lon = atan(N.z, N.x);',
          '  float grid = max(smoothstep(0.93, 1.0, abs(sin(lat * 22.0))), smoothstep(0.93, 1.0, abs(sin(lon * 16.0))));',
          '  vec3 V = normalize(cameraPosition - vWp);',
          '  float rim = pow(1.0 - abs(dot(V, normalize(vWn))), 2.4);',     // 菲涅尔轮廓辉光
          '  float fade = 1.0 - smoothstep(0.7, 1.0, uT);',                 // 扫完整体退场
          '  float a = band * 0.85 + echo + (grid * 0.3 + rim * 0.55) * swept * fade;',
          '  gl_FragColor = vec4(uCol * (band * 1.2 + echo + (grid * 0.75 + rim) * swept * fade), a);',
          '}',
        ].join('\n'),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      scanShell.scale.setScalar(pd.radius * 1.035);
      scanShell.visible = false;
      scanShell.renderOrder = 3;   // 全息罩最后绘制（球体-1/皮肤0/云壳1/大气2之上）
      mesh.add(scanShell);
      planets.push({ mesh, def: pd, tex: pt.tex, texCanvas: pt.canvas, texCtx: pt.ctx, cleanCanvas: pt.cleanCanvas, cleanCtx: pt.cleanCtx, origCanvas: pt.origCanvas, holeU, scanShell, scanU });
    }
    setClouds(cloudsOn);   // 体积云层（画面设置可开关）
    setRealAtmo(realAtmoOn);   // 逼真大气层（画面设置可开关）

    // 空间站
    station = buildStation();
    station.position.set(...STATION_POS);
    scene.add(station);

    // 小行星带
    asteroids = [];
    const astMat = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('gravel') });
    const rnd2 = mulberry32(4242);
    for (let i = 0; i < 90; i++){
      const cluster = new THREE.Group();
      const n = 2 + (rnd2() * 4) | 0;
      for (let k = 0; k < n; k++){
        const s = 2 + rnd2() * 5;
        const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), astMat);
        b.position.set((rnd2() - 0.5) * 8, (rnd2() - 0.5) * 8, (rnd2() - 0.5) * 8);
        b.rotation.set(rnd2() * 3, rnd2() * 3, rnd2() * 3);
        cluster.add(b);
      }
      const a = rnd2() * Math.PI * 2, dist = 500 + rnd2() * 2200;
      cluster.position.set(Math.cos(a) * dist, (rnd2() - 0.5) * 500, Math.sin(a) * dist);
      cluster.userData = { hp: 3, spin: new THREE.Vector3(rnd2() - 0.5, rnd2() - 0.5, rnd2() - 0.5).multiplyScalar(0.4) };
      scene.add(cluster);
      asteroids.push(cluster);
    }

    // 访客飞船舰队（多式样：精模/战机/货轮/穿梭艇，巡航⇄泊站）
    spawnVisitors();

    // 玩家飞船（型号随档案：换船后跨星系重建亦保持）
    shipGroup = buildShip(playerModelName);
    scene.add(shipGroup);

    // 脉冲星线（速度线）
    const plGeo = new THREE.BufferGeometry();
    const plPos = new Float32Array(200 * 6);
    plGeo.setAttribute('position', new THREE.BufferAttribute(plPos, 3));
    pulseLines = new THREE.LineSegments(plGeo, new THREE.LineBasicMaterial({ color: 0x8ac9ff, transparent: true, opacity: 0, depthWrite: false }));
    scene.add(pulseLines);

    // 太空扫描波纹
    scanRing = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x35e0e8, transparent: true, opacity: 0, wireframe: true, depthWrite: false })
    );
    scene.add(scanRing);

    // LOD 地形块材质预热桩（随场景一并编译着色器）
    const warmTile = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), lodMat);
    warmTile.position.set(0, -99999, 0);
    scene.add(warmTile);
  }

  // ---------- 进入太空（同星系保留场景，实现无缝衔接）----------
  function enter(fromPlanetId){
    init();     // 已初始化则为空操作
    shipState.pos.copy(new THREE.Vector3(...SYSTEM_PLANETS[fromPlanetId].pos));
    shipState.pos.y += SYSTEM_PLANETS[fromPlanetId].radius + 80;
    shipState.yaw = Math.random() * Math.PI * 2;
    shipState.pitch = 0;
    shipState.roll = 0;
    shipState.speed = 18;
  }
  function disposeScene(){
    if (scene){
      if (station) scene.remove(station);
      for (const p of planets) if (p.mesh) scene.remove(p.mesh);
      for (const a of asteroids) scene.remove(a);
      for (const n of npcShips) scene.remove(n);
      for (const v of visitors) scene.remove(v);
      scene.remove(shipGroup);
      if (pulseLines) scene.remove(pulseLines);
    }
    planets = []; asteroids = []; npcShips = [];
    visitors = []; visPadOcc = [false, false, false];
    hostiles = []; visRespawn = []; boltFx = [];
    station = null; stationRing = null; stationLights = [];
    stationStaff = []; stationShield = null; stationGuides = []; stationHolo = []; stationNav = [];
    stationDome = null; stationGateMat = null; stationDefT = 0;
    galSprites = []; galSpritesReady = false;
    termCanvas = null; termCtx = null; termTex = null; termRows = null;
    lasers = [];
    scanRing = null; spaceMarkers = []; scanRingT = 0;
    scanFxQ = [];
    initialized = false;
  }
  // 太空扫描（C 键）：扩张波前掠过天体的瞬间揭示标记——星球叠加 NMS 式全息扫描罩
  function spaceScan(){
    if (scanRingT > 0) return false;
    scanRingT = 3.0;
    Sound.play('scan');
    if (scanRing){
      scanRing.position.copy(shipState.pos);
      scanRing.material.opacity = 0.3;
      scanRing.scale.setScalar(1);
    }
    spaceMarkers = [];
    scanFxQ = [];
    const nowMs = performance.now();
    const until = nowMs + 120000;   // 标记 2 分钟后自动消散
    const WAVE = 1400;              // 波前速度：与可见扫描波纹同速，标记在波抵达时才浮现
    {
      const d = Math.max(0, (SUN_POS.distanceTo(shipState.pos) - SUN_R) / WAVE);
      spaceMarkers.push({ pos: SUN_POS.clone(), name: '恒星 · ☢ 高温危险', color: '#ffcf6a', ic: '☀', until, showAt: nowMs + d * 1000 });
    }
    for (const p of planets){
      const delay = Math.max(0, (p.mesh.position.distanceTo(shipState.pos) - p.def.radius) / WAVE);
      spaceMarkers.push({ pos: p.mesh.position.clone(), name: p.def.name + ' · ' + BIOMES[p.def.biome].name, color: '#' + new THREE.Color(BIOMES[p.def.biome].tint).getHexString(), ic: '◆', until, showAt: nowMs + delay * 1000 });
      scanFxQ.push({ p, delay, t: -1 });   // 波前到达 → 全息罩扫掠动画
    }
    if (station){
      const sd = station.position.distanceTo(shipState.pos) / WAVE;
      spaceMarkers.push({ pos: station.position.clone(), name: '轨道空间站', color: '#35e0e8', ic: '⬡', until, showAt: nowMs + sd * 1000 });
      scanFxQ.push({ p: null, delay: sd, t: -1 });   // 空间站：仅抵达提示音
    }
    // 附近小行星矿物（合理范围：1500u 内，最多 8 处）
    const nearAst = asteroids
      .filter(a => a.visible)
      .map(a => ({ a, d: a.position.distanceTo(shipState.pos) }))
      .filter(o => o.d < 1500)
      .sort((x, y) => x.d - y.d)
      .slice(0, 8);
    for (const o of nearAst){
      spaceMarkers.push({ pos: o.a.position.clone(), name: '含氚小行星', color: '#7fb8ff', ic: '◇', ast: o.a, until, showAt: nowMs + o.d / WAVE * 1000 });
    }
    return true;
  }
  function getSpaceMarkers(){ return spaceMarkers; }
  function tickSpaceScan(dt){
    if (scanRingT > 0){
      scanRingT = Math.max(0, scanRingT - dt);
      if (scanRing){
        const r = (3.0 - scanRingT) * 1400;
        scanRing.scale.setScalar(Math.max(1, r));
        scanRing.material.opacity = Math.max(0, scanRingT / 3.0 * 0.25);
      }
    }
    // 扫描波前：抵达天体 → 触发全息罩扫掠 + 提示音（波前寿命独立于可见波纹）
    for (let i = scanFxQ.length - 1; i >= 0; i--){
      const f = scanFxQ[i];
      if (f.t < 0){
        f.delay -= dt;
        if (f.delay > 0) continue;
        Sound.play('scanHit');
        if (!f.p){ scanFxQ.splice(i, 1); continue; }
        f.t = 0;
        f.p.scanShell.visible = true;
        // 罩半径按星球状态自适应：模拟渲染中（浮雕位移/LOD 地形块/体素皮肤，最高≈1.19R）
        // 会盖过 1.035R 的贴身罩——此时抬到 1.21R 罩在方块地形之上；远处光滑像素球保持贴身
        const simOn = f.p.dispSeed !== undefined || (f.p.lodTiles && f.p.lodTiles.size > 0);
        f.p.scanShell.scale.setScalar(f.p.def.radius * (simOn ? 1.21 : 1.035));
        // 命中方向（波来向）→ 星球本地坐标（抵消自转），扫掠从面向飞船的一侧开始
        const ry = f.p.mesh.rotation.y, c = Math.cos(ry), s = Math.sin(ry);
        _shv.copy(shipState.pos).sub(f.p.mesh.position).normalize();
        f.p.scanU.uHit.value.set(c * _shv.x - s * _shv.z, _shv.y, s * _shv.x + c * _shv.z);
      } else {
        f.t += dt / 2.4;   // 扫掠动画时长
        f.p.scanU.uT.value = Math.min(1, f.t);
        if (f.t >= 1){
          f.p.scanShell.visible = false;
          scanFxQ.splice(i, 1);
        }
      }
    }
  }

  // 重建星系（曲速跃迁）
  let currentGalaxySeed = HOME_GALAXY_SEED;
  function getCurrentGalaxySeed(){ return currentGalaxySeed; }
  function restoreGalaxy(seed){
    currentGalaxySeed = seed;
    if (seed !== HOME_GALAXY_SEED) setGalaxy(generateGalaxy(seed));
    else resetGalaxy();
    disposeScene();
  }
  async function warpGalaxy(newSeed){
    currentGalaxySeed = newSeed;
    let gal;
    if (newSeed === HOME_GALAXY_SEED){
      // 回到起源星系：恢复固定布局（而非随机生成）
      resetGalaxy();
      const rnd = mulberry32(newSeed);
      const market = {};
      for (const g of TRADE_GOODS) market[g] = 0.75 + rnd() * 0.5;
      gal = { planets: SYSTEM_PLANETS, station: STATION_POS, market, seed: newSeed, name: galaxyName(newSeed) };
    } else {
      gal = generateGalaxy(newSeed);
      setGalaxy(gal);
    }
    disposeScene();
    init();
    // 定位到第一个行星附近
    shipState.pos.copy(new THREE.Vector3(...SYSTEM_PLANETS[0].pos));
    shipState.pos.y += SYSTEM_PLANETS[0].radius + 85;
    shipState.yaw = Math.random() * Math.PI * 2;
    shipState.pitch = 0;
    shipState.roll = 0;
    shipState.speed = 20;
    await new Promise(r => setTimeout(r, 100));
    return gal;
  }

  // ---- 换船电脑（SVG 剖面建模 → 挤出：机库停机坪旁的舰船调度终端）----
  const GARAGE_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96">',
    '<path fill="#3a424c" d="M20,96 L44,96 L40,58 L24,58 Z"/>',                 // 底座立柱
    '<path fill="#2e353e" d="M14,96 L50,96 L50,90 L14,90 Z"/>',                // 底盘
    '<path fill="#4a545e" d="M8,14 L56,14 L60,54 L4,54 Z"/>',                  // 主机背板
    '<path fill="#0f4a52" d="M12,18 L52,18 L55,50 L9,50 Z"/>',                 // 大屏
    '<path fill="#35e0e8" d="M12,30 L52,30 L52.6,33 L12.6,33 Z"/>',            // 屏内光带
    '<path fill="#c9641a" d="M24,54 L40,54 L42,62 L22,62 Z"/>',                // 操控台斜面
    '<path fill="#ffb347" d="M2,6 L12,6 L12,14 L2,14 Z"/>',                    // 状态灯左
    '<path fill="#35e0e8" d="M52,6 L62,6 L62,14 L52,14 Z"/>',                  // 状态灯右
    '</svg>',
  ].join('');
  let garageKiosk = null;
  function buildGarageKiosk(g){
    garageKiosk = new THREE.Group();
    try {
      const data = new THREE.SVGLoader().parse(GARAGE_SVG);
      const wrap = new THREE.Group();
      for (const path of data.paths){
        const fill = path.userData.style.fill;
        const shapes = THREE.SVGLoader.createShapes(path);
        if (!shapes.length) continue;
        const glowing = fill === '#35e0e8' || fill === '#ffb347' || fill === '#0f4a52';
        const geo = new THREE.ExtrudeGeometry(shapes, { depth: glowing ? 5 : 8, bevelEnabled: false, curveSegments: 6 });
        geo.translate(-32, 0, glowing ? -1 : -4);
        wrap.add(new THREE.Mesh(geo, glowing
          ? new THREE.MeshBasicMaterial({ color: new THREE.Color(fill) })
          : new THREE.MeshLambertMaterial({ color: new THREE.Color(fill) })));
      }
      const s = 0.034;   // 全高约 3.2
      wrap.scale.set(s, -s, s);
      wrap.position.y = 96 * s;
      garageKiosk.add(wrap);
    } catch(e){ console.warn('[garage svg]', e); }
    garageKiosk.position.set(28, 0, 22);              // 玩家停机坪旁（本地坐标）
    garageKiosk.rotation.y = -Math.PI / 2;            // 屏幕面向走道（-X 方向）
    g.add(garageKiosk);
  }
  // 出售访客船：船与驾驶员即刻消失，机位释放（购船流程由 main 调用）
  function removeVisitorShip(v){
    despawnPilot(v);
    if (v.userData.pad >= 0){ visPadOcc[v.userData.pad] = false; v.userData.pad = -1; }
    scene.remove(v);
    const i = visitors.indexOf(v);
    if (i >= 0) visitors.splice(i, 1);
  }
  // 玩家换船：重建太空侧船体模型（引擎光斑/喷焰节点同步重挂）；型号记忆跨星系重建保持
  let playerModelName = 'ship';
  function setShipModel(model){
    playerModelName = model || 'ship';
    if (!shipGroup) return;
    const pos = shipGroup.position.clone();
    const quat = shipGroup.quaternion.clone();
    scene.remove(shipGroup);
    shipGroup = buildShip(playerModelName);
    shipGroup.position.copy(pos);
    shipGroup.quaternion.copy(quat);
    scene.add(shipGroup);
  }
  // ---------- 射击（武器随飞船等级：NMS 式 C/B/A/S 各具弹种特效）----------
  // 弹种设计：C 脉冲机炮=橙红光斑弹；B 双联流火=青色双光刃；A 相位光矛=紫色超长穿刺束；
  //           S 湮灭重炮=金白巨球+日冕光晕。全部加法混合十字光刃结构 + 枪口闪光 + 命中火花
  const BOLT_SPECS = {
    pulse:   { c: 0xff8a3a, w: 0.55, l: 7,  halo: 0,   dmg: 1, spd: 1 },
    twin:    { c: 0x35e0e8, w: 0.36, l: 10, halo: 0,   dmg: 1, spd: 1.15 },
    phase:   { c: 0xb58aff, w: 0.3,  l: 20, halo: 0,   dmg: 2, spd: 1.9 },
    annihil: { c: 0xffd94d, w: 1.5,  l: 6,  halo: 5.5, dmg: 4, spd: 1.05 },
  };
  let boltFx = [];   // 枪口闪光/命中火花（短命精灵）
  function makeBoltMesh(wpn){
    const spec = BOLT_SPECS[wpn] || BOLT_SPECS.pulse;
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: spec.c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.l), mat);
    blade.rotation.x = -Math.PI / 2;   // 展平到 XZ，长度沿 Z（飞行轴）
    g.add(blade);
    const wrap = new THREE.Group();    // 第二刃绕飞行轴转 90°成十字
    const blade2 = blade.clone();
    wrap.add(blade2);
    wrap.rotation.z = Math.PI / 2;
    g.add(wrap);
    if (spec.halo > 0){
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTextures().corona, color: spec.c, transparent: true, depthWrite: false, opacity: 0.9 }));
      halo.scale.set(spec.halo, spec.halo, 1);
      g.add(halo);
    }
    return g;
  }
  function spawnFlash(pos, color, size, life){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTextures().corona, color, transparent: true, depthWrite: false, opacity: 0.95 }));
    s.position.copy(pos);
    s.scale.set(size, size, 1);
    s.userData = { life, life0: life };
    scene.add(s);
    boltFx.push(s);
  }
  function tickBoltFx(dt){
    for (let i = boltFx.length - 1; i >= 0; i--){
      const s = boltFx[i];
      s.userData.life -= dt;
      const k = Math.max(0, s.userData.life / s.userData.life0);
      s.material.opacity = k;
      s.scale.multiplyScalar(1 + dt * 6);
      if (s.userData.life <= 0){ scene.remove(s); boltFx.splice(i, 1); }
    }
  }
  function fireBolt(fromPos, dir, wpn, hostile){
    const spec = BOLT_SPECS[wpn] || BOLT_SPECS.pulse;
    const bolt = makeBoltMesh(wpn);
    bolt.position.copy(fromPos);
    // 朝向：-Z 对齐飞行方向
    _ve.set(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)), Math.atan2(-dir.x, -dir.z), 0, 'YXZ');
    bolt.quaternion.setFromEuler(_ve);
    bolt.userData = { dir: dir.clone(), life: 2.2, dmg: spec.dmg, speedMul: spec.spd, hostile: !!hostile, wpn };
    scene.add(bolt);
    (hostile ? hostiles : lasers).push(bolt);
    spawnFlash(fromPos, spec.c, hostile ? 1.6 : 2.2, 0.12);   // 枪口闪光
  }
  function shoot(camera){
    Sound.play('shoot');
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    // 弹道汇聚：所有弹向「准星视线 300u 处」收束——消除第三人称镜头与炮口的视差脱靶
    const aimPoint = camera.position.clone().addScaledVector(dir, 300);
    const wpn = shipState.weapon || 'pulse';
    const muzzle = shipState.pos.clone().addScaledVector(dir, 8);
    const fireAt = (from) => {
      const bdir = aimPoint.clone().sub(from).normalize();
      fireBolt(from, bdir, wpn);
    };
    if (wpn === 'twin'){
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      fireAt(muzzle.clone().addScaledVector(right, -0.9));
      fireAt(muzzle.clone().addScaledVector(right, 0.9));
    } else {
      fireAt(muzzle);
    }
  }

  // ---------- 更新 ----------
  // 星球自转（与地面昼夜同步：480秒/周）——任何状态下持续推进，真实自转系统
  function tickRotation(dt){
    for (const p of planets){
      p.mesh.rotation.y += dt * (Math.PI * 2 / PLANET_DAY);
      if (p.cloudShell) p.cloudShell.rotation.y += dt * 0.006;   // 云层相对星球缓慢漂移
    }
  }
  // 直接设定飞船姿态：完整姿态（含滚转）零跳变移交——
  // 滚转存入真实滚转 roll（太空没有地平线，不自动回正也不旋转扶正，与 A/D 滚转同权；
  // 视角/模型与大气侧完全一致，出大气层不再转圈）
  function setAttitude(yaw, pitch, roll){
    shipState.yaw = yaw;
    shipState.pitch = THREE.MathUtils.clamp(pitch, -1.55, 1.55);
    shipState.roll = roll || 0;
    shipState.camRoll = 0;
    if (shipGroup) shipGroup.quaternion.setFromEuler(new THREE.Euler(shipState.pitch, shipState.yaw, shipState.roll, 'YXZ'));
  }
  const _fwd = new THREE.Vector3();
  const _camRollQ = new THREE.Quaternion(), _zAxis = new THREE.Vector3(0, 0, 1);
  const _qAtt = new THREE.Quaternion(), _qDlt = new THREE.Quaternion(), _eAtt = new THREE.Euler();
  let visBank = 0;   // 鼠标转向侧倾（纯视觉，不改变航向姿态）
  function update(dt, camera, input){
    // 姿态：NMS 式——鼠标俯仰/偏航作用于机体本地轴，A/D 绕前进轴真实滚转（太空不自动回正）
    const dRoll = (input.rollLeft ? -1.7 : input.rollRight ? 1.7 : 0) * dt;
    _qAtt.setFromEuler(_eAtt.set(shipState.pitch, shipState.yaw, shipState.roll, 'YXZ'));
    _qAtt.multiply(_qDlt.setFromEuler(_eAtt.set(input.mouseDY * -0.0022, input.mouseDX * -0.0022, dRoll, 'YXZ'))).normalize();
    _eAtt.setFromQuaternion(_qAtt, 'YXZ');
    shipState.pitch = _eAtt.x; shipState.yaw = _eAtt.y; shipState.roll = _eAtt.z;
    visBank += (input.mouseDX * -0.045 - visBank) * Math.min(1, dt * 5);

    // 速度
    let target = 0;
    const maxS = input.boost ? BOOST_SPEED : MAX_SPEED;
    if (input.thrust) target = maxS;
    if (input.brake) target = 4;
    if (!input.thrust && !input.brake) target = Math.min(shipState.speed, maxS);

    // 脉冲引擎
    if (input.pulse && Player.countItem('tritium') > 0){
      shipState.pulseCharge = Math.min(1, shipState.pulseCharge + dt * 0.8);
      if (shipState.pulseCharge >= 1){
        if (!shipState.pulsing){ shipState.pulsing = true; Sound.play('pulseStart'); Sound.loops.pulse.start(); }
        target = PULSE_SPEED;
        shipState.tritiumDrain = (shipState.tritiumDrain || 0) + dt;
        if (shipState.tritiumDrain > 0.7){ shipState.tritiumDrain = 0; Player.removeItem('tritium', 1); }
      }
    } else {
      if (shipState.pulsing){ shipState.pulsing = false; Sound.play('pulseEnd'); Sound.loops.pulse.stop(); }
      shipState.pulseCharge = Math.max(0, shipState.pulseCharge - dt * 2);
    }
    shipState.speed += (target - shipState.speed) * Math.min(1, dt * (shipState.pulsing ? 1.2 : 2.5));

    // 移动
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(shipState.pitch, shipState.yaw, 0, 'YXZ'));
    _fwd.set(0, 0, -1).applyQuaternion(q);
    shipState.pos.addScaledVector(_fwd, shipState.speed * dt);
    if (dt > 0) resolveStationCollision(shipState.pos);   // 空间站实体碰撞（不可穿站）

    // 恒星：真实天体——表面不可穿越，高温区持续损伤
    if (dt > 0){
      if (sunBody) sunBody.rotation.y += dt * 0.008;
      const sunD = shipState.pos.distanceTo(SUN_POS);
      if (sunD < SUN_R + 40){
        _fwd.copy(shipState.pos).sub(SUN_POS);
        if (_fwd.lengthSq() < 1) _fwd.set(0, 1, 0); else _fwd.normalize();
        shipState.pos.copy(SUN_POS).addScaledVector(_fwd, SUN_R + 40);
        shipState.speed = Math.min(shipState.speed, 24);
      }
      if (sunD < SUN_R * 2.2){
        sunHeatT += dt;
        if (sunHeatT > 0.6){
          sunHeatT = 0;
          // 太空中不致死：烧到 1 HP 为止（避免舱内死亡逻辑错乱）
          if (!(window.Game && Game.creative) && Player.stats.hp + Player.stats.shield > 1) Player.damage(1);
          if (window.UI) UI.bigMessage('⚠ 恒星高温', '船体过热，立即远离！', 900);
        }
      } else sunHeatT = 0;
    }

    // 飞船姿态与相机（第三人称追尾）：模型与相机整体携带换系滚转微调
    shipGroup.position.copy(shipState.pos);
    const shipQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(shipState.pitch, shipState.yaw, shipState.roll, 'YXZ'));
    if (Math.abs(visBank) > 0.0004) shipQ.multiply(_camRollQ.setFromAxisAngle(_zAxis, visBank));
    if (shipState.camRoll && Math.abs(shipState.camRoll) > 0.0008){
      shipQ.multiply(_camRollQ.setFromAxisAngle(_zAxis, shipState.camRoll));
      // 极缓慢配平；玩家转向时加速（被动作掩盖）
      shipState.camRoll -= shipState.camRoll * Math.min(1, dt * (0.08 + Math.min(0.7, Math.abs(input.mouseDX) * 0.02)));
    } else {
      shipState.camRoll = 0;
    }
    shipGroup.quaternion.slerp(shipQ, Math.min(1, dt * 8));

    const camOff = new THREE.Vector3(0, 3.2, 11).applyQuaternion(shipQ);
    camera.position.copy(shipState.pos).add(camOff);
    camera.quaternion.copy(shipQ);
    // FOV 随速度（基准取画面设置）
    const targetFov = ((window.Game && Game.baseFov) || 75) - 5 + (shipState.speed / PULSE_SPEED) * 40 + (input.boost ? 6 : 0);
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();

    if (dt > 0){
      Sound.loops.engine.start();
      Sound.loops.engine.set('speed', Math.min(1, shipState.speed / BOOST_SPEED));
    }

    // 引擎喷焰
    const flames = shipGroup.userData.flames;
    const flameScale = 0.4 + shipState.speed / MAX_SPEED * 0.8 + (shipState.pulsing ? 2 : 0);
    flames.forEach(f => { f.scale.z = flameScale * (0.9 + Math.random() * 0.2); f.material.opacity = 0.4 + Math.min(0.5, shipState.speed / 100); });

    // 空间站旋转/灯光
    if (stationRing) stationRing.rotation.y += dt * 0.06;
    stationLights.forEach((l, i) => { l.visible = Math.sin(performance.now() * 0.004 + i * 2) > -0.3; });
    tickStation(dt);   // 护盾/引导灯/屏幕/人员 动效

    // 云壳随接近渐隐：靠近后模拟渲染贴图/方块地形接管，云层贴图叠在其上很出戏——
    // 600u 外完整云貌，380u 内完全隐去（早于体素皮肤 340u 激活），远离时自动恢复
    for (const p of planets){
      if (!p.cloudShell) continue;
      const cd = shipState.pos.distanceTo(p.mesh.position) - p.def.radius;
      const ck = THREE.MathUtils.clamp((cd - 380) / 220, 0, 1);
      p.cloudShell.material.opacity = 0.85 * ck;
      p.cloudShell.visible = cloudsOn && ck > 0.01;
    }

    // 小行星
    for (const a of asteroids){
      if (!a.visible) continue;
      a.rotation.x += a.userData.spin.x * dt;
      a.rotation.y += a.userData.spin.y * dt;
    }
    // 访客舰队在 tickStation 中推进（太空态与站内态都持续运转）
    // 激光（弹速/伤害随武器等级；全部扫掠判定防隧穿；命中优先级：飞船 > 小行星 > 站盾）
    for (let i = lasers.length - 1; i >= 0; i--){
      const b = lasers[i];
      b.userData.life -= dt;
      _lp.copy(b.position);
      b.position.addScaledVector(b.userData.dir, 500 * (b.userData.speedMul || 1) * dt);
      if (b.userData.life <= 0){ scene.remove(b); lasers.splice(i, 1); continue; }
      // NMS 式辅助瞄准（软制导）：弹道锥内最近的访客船会吸附弹道——大幅提升命中率
      {
        let steer = null, bestDot = 0.96, bestD = 1e9;
        for (const v of visitors){
          if (!visAttackable(v)) continue;
          _segC.copy(v.position).sub(b.position);
          const d = _segC.length();
          if (d < 2 || d > 520) continue;
          _segC.multiplyScalar(1 / d);
          const dp = _segC.dot(b.userData.dir);
          if (dp > bestDot && d < bestD){ bestD = d; steer = v; }
        }
        if (steer){
          _segC.copy(steer.position).sub(b.position).normalize();
          b.userData.dir.lerp(_segC, Math.min(1, dt * 8)).normalize();
          _ve.set(Math.asin(THREE.MathUtils.clamp(b.userData.dir.y, -1, 1)), Math.atan2(-b.userData.dir.x, -b.userData.dir.z), 0, 'YXZ');
          b.quaternion.setFromEuler(_ve);
        }
      }
      // 命中访客船（对方转入缠斗反击）——优先于站盾，站域内空战不受干扰
      if (hitVisitorCheck(_lp, b)){ scene.remove(b); lasers.splice(i, 1); continue; }
      // 命中小行星（扫掠）
      let consumed = false;
      for (const a of asteroids){
        if (!a.visible) continue;
        if (segHit(_lp, b.position, a.position, 10)){
          a.userData.hp -= (b.userData.dmg || 1);
          Sound.play('laserHit');
          scene.remove(b); lasers.splice(i, 1);
          consumed = true;
          if (a.userData.hp <= 0){
            a.visible = false;
            Sound.play('explode');
            const n = 4 + (Math.random() * 5) | 0;
            Player.addItem('tritium', n);
            if (Math.random() < 0.25) Player.addItem('gold_ore', 1 + (Math.random() * 2 | 0));
          }
          break;
        }
      }
      if (consumed) continue;
      // 命中空间站（未命中任何目标的弹着才会激活/刷新护盾）：
      // 盾未开时按站体实域(150)判定，弹着贴着结构爆闪；盾开启时按气泡界(213)拦截
      if (station){
        stationShieldCenter(_shieldC);
        if (segHit(_lp, b.position, _shieldC, stationDefT > 0 ? 213 : 150)){
          raiseStationShield(b.position);
          scene.remove(b); lasers.splice(i, 1);
          continue;
        }
      }
    }
    // 脉冲速度线
    if (shipState.speed > 150){
      pulseLines.material.opacity = Math.min(0.8, (shipState.speed - 150) / 400);
      const posAttr = pulseLines.geometry.attributes.position;
      for (let i = 0; i < 200; i++){
        const off = new THREE.Vector3((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 70, (Math.random() - 0.5) * 120);
        const p0 = shipState.pos.clone().add(off).addScaledVector(_fwd, 60 + Math.random() * 100);
        const p1 = p0.clone().addScaledVector(_fwd, -6 - shipState.speed * 0.03);
        posAttr.setXYZ(i * 2, p0.x, p0.y, p0.z);
        posAttr.setXYZ(i * 2 + 1, p1.x, p1.y, p1.z);
      }
      posAttr.needsUpdate = true;
    } else pulseLines.material.opacity = 0;
  }

  // ---------- 目标检测 ----------
  function nearestTarget(){
    let best = null;
    for (const p of planets){
      const d = shipState.pos.distanceTo(p.mesh.position) - p.def.radius;
      if (d < 220) best = { type: 'planet', def: p.def, dist: d };
    }
    const ds = shipState.pos.distanceTo(station.position);
    if (ds < 160) best = { type: 'station', dist: ds };
    return best;
  }
  function aheadInfo(camera){
    // 准星指向的天体信息（访客船优先：可锁定查看等级/血量/价值）
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    let bestV = null, bestD = 1e9;
    for (const v of visitors){
      if (!visAttackable(v)) continue;
      const u = v.userData;
      const to = v.position.clone().sub(shipState.pos);
      const d = to.length();
      if (d > 700) continue;
      to.normalize();
      if (to.dot(dir) > 0.985 && d < bestD){ bestD = d; bestV = v; }
    }
    if (bestV){
      const u = bestV.userData;
      return { type: 'ship', cls: u.cls, hp: Math.max(0, u.hp), hpMax: VIS_HP[u.cls], model: u.model, price: u.price, dist: bestD, hostile: u.st === 'combat' };
    }
    for (const p of planets){
      const to = p.mesh.position.clone().sub(shipState.pos);
      const dist = to.length();
      to.normalize();
      if (to.dot(dir) > 0.995 - p.def.radius / dist * 0.5){
        return { type: 'planet', def: p.def, dist: Math.max(0, dist - p.def.radius) };
      }
    }
    const toS = station.position.clone().sub(shipState.pos);
    const dS = toS.length(); toS.normalize();
    if (toS.dot(dir) > 0.996) return { type: 'station', dist: dS };
    return null;
  }

  function stopSounds(){
    Sound.loops.engine.stop();
    Sound.loops.pulse.stop();
  }

  return { init, enter, update, tickRotation, setAttitude, shoot, nearestTarget, aheadInfo, stopSounds,
    warpGalaxy, restoreGalaxy, spaceScan, getSpaceMarkers, tickSpaceScan, getCurrentGalaxySeed,
    paintSurfaceRegion, setSurfaceHole, paintGlobe, displaceGlobe, updateLOD, restoreGlobe, clearLodTiles,
    SUN_POS, PLANET_DAY, SUN_R, sunTextures, setLodQuality, lodRange, setClouds, setRealAtmo,
    getDock, tickStation, bakeStationPortrait, removeVisitorShip, setShipModel, setVisitorCount, cloneStationModel,
    SHIP_CLASSES, SHIP_MODEL_NAMES,
    get stationShieldUp(){ return isStationShieldUp(); },
    hostileShips(){ return visitors.filter(v => v.userData.st === 'combat'); },
    setGalaxySprites, getGalaxySpritePos, galaxyCanvas,
    get galaxySpritesReady(){ return galSpritesReady; },
    _galaxySprites(){ return galSprites; },   // 跃迁动画内需读写贴图缩放/透明度
    _pulseLines(){ return pulseLines; },       // 跃迁星流线复用（速度 >150 自动生成）
    get scene(){ init(); return scene; }, shipState,
    get shipGroup(){ return shipGroup; },
    get station(){ return station; }, get planets(){ return planets; } };
})();
window.Space = Space;
window.__V_SPACE = 'v82';
