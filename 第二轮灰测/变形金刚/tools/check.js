/**
 * check.js —— 浏览器端自检（配合 tools/run-browser-check.ps1）
 * 复用真实入口 main.js 已初始化好的 window.__OPTIMUS__，
 * 手动推进若干帧、把每个功能开关都跑一遍，导出两态画面 base64，
 * 并把渲染结果降采样成 ASCII 剪影 + 配色分布，由 --dump-dom 带回宿主。
 */
import * as THREE from 'three';

const out = [];
const P = (s) => out.push(s);
const app = window.__OPTIMUS__;

const dom = (id) => document.getElementById(id);
const errText = () => (dom('err-msg')?.textContent || '').trim();

let shots = { robot: '', vehicle: '', night: '' };
const arts = [];

try {
  if (!app) throw new Error('window.__OPTIMUS__ 不存在：main.js 初始化失败');
  const { renderer, scene, camera, tf, rig, motion, anim, effects, env, gui, state } = app;

  const gl = renderer.getContext();
  P('WebGL   : ' + gl.getParameter(gl.VERSION));
  P('Renderer: ' + (gl.getExtension('WEBGL_debug_renderer_info')
    ? gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) : 'n/a'));
  P('零件 / 关节 : ' + rig.meshes.length + ' / ' + rig.jointCount);
  P('GUI 控件数  : ' + gui.controllersRecursive().length);
  P('材质数      : ' + app.M.all.length);

  /* 固定出图尺寸 */
  const W = 780, H = 470;
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();

  const step = (n, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) {
      tf.update(dt);
      const c = motion.update(dt);
      anim.update(dt, c);
      effects.update(dt, c);
      renderer.render(scene, camera);
    }
  };
  const shot = () => renderer.domElement.toDataURL('image/jpeg', 0.68);

  /* ---------- 把画面降采样成 ASCII：剪影 + 配色 ---------- */
  const GW = 62, GH = 34;
  const pix = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(renderer.domElement, 0, 0, w, h);
    return g.getImageData(0, 0, w, h).data;
  };
  const classify = (r, g, b) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 42) return '#';                       // 很暗：关节 / 轮胎
    if (mx - mn < 26) return mx > 168 ? 'W' : (mx > 92 ? 'S' : '#');  // 无彩：铬亮 / 银灰 / 暗部
    if (r === mx && r >= g + 20 && r >= b + 18) return 'R';           // 红装甲
    if (b === mx && b >= r + 16) return 'B';                          // 蓝装甲
    if (mx - mn < 60) return 'S';
    return r === mx ? 'Y' : 'C';                   // 暖色(灯) / 青色(能量·玻璃)
  };
  const asciiArt = (title) => {
    const colorData = pix(GW, GH);
    const hide = [env.ground, env.pad, env.props, env.grid, env.sky,
      effects.smoke.points, effects.sparks.points, effects.ring, effects.sweep, app.trailer];
    const vis = hide.map((o) => o && o.visible);
    hide.forEach((o) => { if (o) o.visible = false; });
    const oldBg = scene.background, oldFog = scene.fog;
    scene.background = new THREE.Color(0x000000);
    scene.fog = null;
    scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    renderer.render(scene, camera);
    const mask = pix(GW, GH);
    scene.overrideMaterial = null;
    scene.background = oldBg; scene.fog = oldFog;
    hide.forEach((o, i) => { if (o) o.visible = vis[i]; });
    renderer.render(scene, camera);

    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, cnt = 0;
    const rows = [];
    for (let y = 0; y < GH; y++) {
      let line = '';
      for (let x = 0; x < GW; x++) {
        const i = (y * GW + x) * 4;
        const on = mask[i] + mask[i + 1] + mask[i + 2] > 90;
        if (!on) { line += ' '; continue; }
        cnt++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        line += classify(colorData[i], colorData[i + 1], colorData[i + 2]);
      }
      rows.push(line.replace(/\s+$/, ''));
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const counts = {};
    for (const r of rows) for (const ch of r) if (ch !== ' ') counts[ch] = (counts[ch] || 0) + 1;
    const total = cnt || 1;
    const dist = Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${Math.round((v / total) * 100)}%`).join(' ');
    arts.push(`【${title}】剪影 ${w}×${h} 格  占屏 ${Math.round((cnt / (GW * GH)) * 100)}%  宽高比 ${(w / h).toFixed(2)}\n`
      + `配色 R红 B蓝 S银 W铬亮 #暗 Y灯 C能量 → ${dist}\n` + rows.join('\n'));
    return { w, h, ratio: w / h, counts, total };
  };

  /* ---- 机器人态 ---- */
  tf.setProgress(0);
  tf.applyPreset('stand', 0.001);
  step(14);
  const look = (p, t) => { camera.position.set(p[0], p[1], p[2]); camera.lookAt(t[0], t[1], t[2]); step(2); };
  look([0, 2.7, 9.0], [0, 2.6, 0]);
  const aRF = asciiArt('机器人态·正面');
  look([9.0, 2.7, 0.01], [0, 2.6, 0]);
  const aRS = asciiArt('机器人态·侧面');
  tf.applyPreset('hero', 0.001);
  step(12);
  look([8.6, 4.4, 10.2], [0, 2.4, 0]);
  P('机器人态渲染 OK  三角面=' + renderer.info.render.triangles);
  shots.robot = shot();

  /* ---- 变形中途 + 载具态 ---- */
  tf.applyPreset('stand', 0.001);
  step(8);
  tf.setProgress(0.5);
  step(4);
  P('变形中渲染 OK    三角面=' + renderer.info.render.triangles);
  tf.setProgress(1);
  step(10);
  look([7.5, 1.3, 0.01], [0, 1.15, -0.6]);
  const aVS = asciiArt('载具态·侧面');
  look([0, 1.5, 8.2], [0, 1.15, 0]);
  const aVF = asciiArt('载具态·正面');
  look([7.6, 3.2, 8.6], [0, 1.1, -0.6]);
  P('载具态渲染 OK    三角面=' + renderer.info.render.triangles);
  shots.vehicle = shot();

  /* ---- 形态判据 ---- */
  const T = (c, k) => (c.counts[k] || 0) / c.total;
  P(`剪影宽高比：机器人正面 ${aRF.ratio.toFixed(2)} / 侧面 ${aRS.ratio.toFixed(2)}` +
    ` ｜ 卡车侧面 ${aVS.ratio.toFixed(2)} / 正面 ${aVF.ratio.toFixed(2)}`);
  P((aRF.ratio < 0.95 ? '  ✓' : '  ✗') + ' 机器人正面应"竖长" (<0.95)');
  P((aVS.ratio > 1.55 ? '  ✓' : '  ✗') + ' 卡车侧面应"横长" (>1.55)');
  P((aVS.ratio / aRS.ratio > 1.8 ? '  ✓' : '  ✗') + ' 侧面轮廓变形前后差异显著 (>1.8×)');
  P((T(aRF, 'R') > 0.05 && T(aRF, 'B') > 0.05 ? '  ✓' : '  ✗') +
    ` 经典红蓝双色都在画面上 (红 ${(T(aRF, 'R') * 100).toFixed(0)}% / 蓝 ${(T(aRF, 'B') * 100).toFixed(0)}%)`);

  /* ---- 每个功能开关都跑一遍 ---- */
  const trials = [
    ['线框', () => { app.setWireframe(true); step(1); app.setWireframe(false); }],
    ['爆炸图', () => { app.setExplode(0.8); step(1); app.setExplode(0); }],
    ['关节坐标轴', () => { app.setJointAxes(true); step(1); app.setJointAxes(false); }],
    ['网格/展台/道具', () => { env.grid.visible = true; env.pad.visible = false; env.props.visible = false; step(1); env.pad.visible = true; env.props.visible = true; }],
    ['拖挂车', () => { app.setTrailer(true); step(2); }],
    ['车灯', () => { state.headlights = true; app.syncLights(); step(1); }],
    ['武器+开火', () => { state.weapon = true; rig.blaster.root.visible = true; effects.fire(); step(6); }],
    ['挥手', () => { anim.wave = true; step(6); anim.wave = false; }],
    ['驾驶(WASD)', () => { motion.keys.add('w'); motion.keys.add('a'); step(30); motion.keys.clear(); }],
    ['行走(机器人态)', () => { tf.setProgress(0); motion.keys.add('w'); step(30); motion.keys.clear(); }],
    ['预设姿势全套', () => { for (const id of ['stand', 'combat', 'salute', 'wave', 'kneel', 'point', 'tpose']) { tf.applyPreset(id, 0.001); step(3); } }],
    ['随机姿势', () => { tf.randomPose(1); step(2); }],
    ['镜像/复位', () => { tf.mirrorLR(true); step(1); tf.resetAll(); step(1); }],
    ['姿势JSON闭环', () => { tf.fromJSON(JSON.parse(JSON.stringify(tf.toJSON()))); step(1); }],
    ['缓动曲线全套', () => { for (const e of ['linear', 'cubic', 'quint', 'back', 'bounce', 'snap']) { tf.easing = e; tf.setProgress(0.42); step(2); } tf.easing = 'cubic'; }],
    ['错峰强度0/1', () => { tf.phaseSpread = 0; tf.setProgress(0.5); step(2); tf.phaseSpread = 1; step(1); }],
    ['相机预设全套', () => { for (const c of app.CAMERAS) { app.setCamera(c.id); step(2); } }],
    ['自动循环变形', () => { tf.auto = true; tf.autoHold = 0.05; step(90, 1 / 30); tf.auto = false; }],
    ['夜间模式', () => { app.state.night = true; env.setNight(true); app.syncLights(); tf.setProgress(1); step(8); }],
    ['截图API', () => { const d = renderer.domElement.toDataURL('image/png'); if (!d.startsWith('data:image/png')) throw new Error('toDataURL 异常'); }],
  ];
  for (const [name, fn] of trials) {
    try { fn(); P('  ✓ ' + name); } catch (e) { P('  ✗ ' + name + ' :: ' + e.message); }
  }

  /* 夜间载具态出图 */
  camera.position.set(6.4, 2.6, 9.4);
  camera.lookAt(0, 1.2, 0);
  step(3);
  shots.night = shot();

  P('三角面(夜间载具态)=' + renderer.info.render.triangles);
  P('drawCalls=' + renderer.info.render.calls + '  几何体=' + renderer.info.memory.geometries + '  贴图=' + renderer.info.memory.textures);
} catch (e) {
  P('FATAL: ' + e.message);
  P(String(e.stack).split('\n').slice(0, 6).join('\n'));
}

const err = errText();
P('页面错误捕获: ' + (err ? 'YES\n' + err.slice(0, 1200) : '无'));

const pre = document.createElement('pre');
pre.id = 'check-result';
pre.textContent = out.join('\n') + '\n\n' + arts.join('\n\n');
document.body.appendChild(pre);
for (const [k, v] of Object.entries(shots)) {
  const d = document.createElement('div');
  d.id = 'shot-' + k;
  d.textContent = v;
  d.style.display = 'none';
  document.body.appendChild(d);
}
document.title = 'CHECK:' + (err || out.some((l) => l.startsWith('FATAL') || l.includes(' ✗ ')) ? 'FAIL' : 'OK');
