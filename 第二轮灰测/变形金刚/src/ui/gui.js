/**
 * gui.js —— lil-gui 控制台：变形、姿势、逐关节参数、驾驶、外观、相机、特效
 * 关节滑杆直接读写 transformer 的姿势表（机器人态 r0/p0 或 载具态 r1/p1），
 * 因此"调参数"和"看动画"用的是同一份数据，永不脱钩。
 */
import GUI from 'lil-gui';
import { EASINGS } from '../rig/transformer.js';
import { PRESETS } from '../rig/poses.js';
import { applyPalette } from '../model/materials.js';

const GROUPS = [
  ['head', '头 · 颈'],
  ['torso', '躯干 · 车身覆盖件'],
  ['armL', '左臂 · 排气管'],
  ['armR', '右臂 · 排气管'],
  ['legL', '左腿 · 后轮'],
  ['legR', '右腿 · 后轮'],
  ['chassis', '底盘 · 前轮 · 前脸'],
];

const pairName = (n) => {
  const m = /^(.*?)(L|R)(\d?)$/.exec(n);
  if (!m) return null;
  return m[1] + (m[2] === 'L' ? 'R' : 'L') + m[3];
};

export function buildGUI(app) {
  const { tf, anim, motion, effects, env, M, hud, rig } = app;
  const gui = new GUI({ title: 'OPTIMUS RIG · 控制台' });
  const state = app.state;
  const refresh = () => gui.controllersRecursive().forEach((c) => c.updateDisplay());
  app.refreshGUI = refresh;

  /* ================= 变形 ================= */
  const fT = gui.addFolder('① 变形控制');
  const tProxy = {
    get 变形进度() { return tf.progress; },
    set 变形进度(v) { tf.setProgress(v); },
  };
  fT.add(tProxy, '变形进度', 0, 1, 0.001).listen();
  fT.add({ f: () => { tf.setTarget(1); hud.toast('变形 → 卡车形态'); } }, 'f').name('▶ 变成卡车 (T)');
  fT.add({ f: () => { tf.setTarget(0); hud.toast('变形 → 机器人形态'); } }, 'f').name('◀ 变回机器人 (T)');
  fT.add(tf, 'speed', 0.08, 3, 0.01).name('变形速度');
  fT.add(tf, 'easing', Object.keys(EASINGS)).name('缓动曲线');
  fT.add(tf, 'phaseSpread', 0, 1, 0.01).name('分段错峰强度');
  fT.add(tf, 'flourish', 0, 2, 0.01).name('腾空/抖动特效');
  fT.add(tf, 'auto').name('循环自动演示 (空格)').listen();
  fT.add(tf, 'autoHold', 0.2, 5, 0.1).name('循环停顿(秒)');

  /* ================= 姿势 ================= */
  const fP = gui.addFolder('② 姿势与动作');
  const poseState = { preset: 'stand' };
  const presetMap = {};
  PRESETS.forEach((p) => { presetMap[p.name] = p.id; });
  fP.add(poseState, 'preset', presetMap).name('预设姿势').onChange((id) => {
    const p = tf.applyPreset(id, 0.55);
    hud.toast('姿势：' + p.name);
    if (tf.progress > 0.02) tf.setTarget(0);
  });
  fP.add({ f: () => { tf.randomPose(1); refresh(); hud.toast('随机姿势'); } }, 'f').name('🎲 随机姿势');
  fP.add({ f: () => { tf.mirrorLR(true); refresh(); hud.toast('左臂/左腿 → 镜像到右侧'); } }, 'f').name('⇄ 左侧镜像到右侧');
  fP.add({ f: () => { tf.resetAll(); poseState.preset = 'stand'; refresh(); hud.toast('已复位全部关节'); } }, 'f')
    .name('↺ 复位全部关节');
  fP.add(anim, 'idle').name('待机呼吸动画');
  fP.add(anim, 'idleAmt', 0, 2, 0.01).name('待机幅度');
  fP.add(anim, 'wave').name('挥手 (Q)').listen();
  fP.add(anim, 'headTrack').name('头部环视');
  fP.add(anim, 'blink').name('眼睛闪烁');
  fP.add(anim, 'engineShake').name('发动机抖动');
  fP.add({ f: () => app.copyPose() }, 'f').name('⧉ 导出姿势JSON(复制)');
  fP.add({ f: () => app.downloadPose() }, 'f').name('⭳ 导出姿势JSON(下载)');
  fP.add({ f: () => app.importPose() }, 'f').name('⭱ 导入姿势JSON');
  fP.close();

  /* ================= 关节参数 ================= */
  const fJ = gui.addFolder('③ 关节参数（' + tf.slots.length + ' 个关节）');
  const jState = { target: 0, mirror: false };
  fJ.add(jState, 'target', { '机器人态 (progress=0)': 0, '载具态 (progress=1)': 1 })
    .name('编辑目标形态').onChange((v) => {
      tf.setProgress(Number(v) ? 1 : 0);
      refresh();
      hud.toast(Number(v) ? '正在编辑：载具态' : '正在编辑：机器人态');
    });
  fJ.add(jState, 'mirror').name('左右联动镜像');
  fJ.add({ f: () => { GROUPS.forEach(([g]) => groupFolders[g]?.close()); } }, 'f').name('折叠全部分组');

  const groupFolders = {};
  for (const [g, title] of GROUPS) {
    const gf = fJ.addFolder(title);
    gf.close();
    groupFolders[g] = gf;
  }

  const applyMirror = (slot, key, idx, val) => {
    if (!jState.mirror) return;
    const pn = pairName(slot.name);
    const other = pn && tf.map[pn];
    if (!other) return;
    const isRot = key[0] === 'r';
    const flip = isRot ? (idx === 0 ? 1 : -1) : (idx === 0 ? -1 : 1);
    other[key][idx] = val * flip;
  };

  for (const slot of tf.slots) {
    const gf = groupFolders[slot.group] || fJ;
    const jf = gf.addFolder(slot.label);
    jf.close();
    const proxy = {};
    const axes = ['X', 'Y', 'Z'];
    axes.forEach((ax, i) => {
      Object.defineProperty(proxy, '旋转' + ax, {
        get: () => (jState.target ? slot.r1 : slot.r0)[i],
        set: (v) => {
          const key = jState.target ? 'r1' : 'r0';
          slot[key][i] = v;
          applyMirror(slot, key, i, v);
          tf.apply();
        },
      });
      Object.defineProperty(proxy, '位移' + ax, {
        get: () => (jState.target ? slot.p1 : slot.p0)[i],
        set: (v) => {
          const key = jState.target ? 'p1' : 'p0';
          slot[key][i] = v;
          applyMirror(slot, key, i, v);
          tf.apply();
        },
      });
    });
    Object.defineProperty(proxy, '缩放', {
      get: () => (jState.target ? slot.s1 : slot.s0),
      set: (v) => { if (jState.target) slot.s1 = v; else slot.s0 = v; tf.apply(); },
    });
    Object.defineProperty(proxy, '握拳', {
      get: () => (jState.target ? slot.g1 : slot.g0),
      set: (v) => { if (jState.target) slot.g1 = v; else slot.g0 = v; tf.apply(); },
    });
    Object.defineProperty(proxy, '变形起点', {
      get: () => slot.phase[0],
      set: (v) => { slot.phase[0] = Math.min(v, slot.phase[1] - 0.01); tf.apply(); },
    });
    Object.defineProperty(proxy, '变形终点', {
      get: () => slot.phase[1],
      set: (v) => { slot.phase[1] = Math.max(v, slot.phase[0] + 0.01); tf.apply(); },
    });

    axes.forEach((ax) => jf.add(proxy, '旋转' + ax, -180, 180, 0.5).name('旋转 ' + ax + '°').listen());
    axes.forEach((ax) => jf.add(proxy, '位移' + ax, -3.5, 3.5, 0.01).name('位移 ' + ax).listen());
    if (slot.hasGrip) jf.add(proxy, '握拳', 0, 1, 0.01).listen();
    jf.add(proxy, '缩放', 0.4, 1.8, 0.01).listen();
    jf.add(proxy, '变形起点', 0, 0.99, 0.01).listen();
    jf.add(proxy, '变形终点', 0.01, 1, 0.01).listen();
    jf.add({ f: () => { tf.resetJoint(slot.name, jState.target); refresh(); } }, 'f').name('↺ 复位该关节');
  }
  fJ.close();

  /* ================= 驾驶与行走 ================= */
  const fM = gui.addFolder('④ 驾驶 / 行走');
  fM.add(motion, 'enabled').name('键盘控制 (WASD)');
  fM.add(motion, 'maxDrive', 2, 40, 0.5).name('卡车极速(单位/秒)');
  fM.add(motion, 'maxWalk', 0.5, 8, 0.1).name('行走速度');
  fM.add(motion, 'accelRate', 1, 30, 0.5).name('加速度');
  fM.add(motion, 'brakeRate', 2, 40, 0.5).name('刹车力');
  fM.add(motion, 'steerMax', 0.05, 1.0, 0.01).name('前轮最大转角(rad)');
  fM.add(motion, 'wheelBase', 0.6, 5, 0.05).name('轴距');
  fM.add(motion, 'turnRate', 0.2, 5, 0.05).name('行走转向速率');
  fM.add(motion, 'boost', 1, 4, 0.05).name('Shift 加速倍率');
  fM.add(state, 'follow').name('跟随镜头 (V)').listen();
  fM.add(state, 'chase').name('追尾视角').listen();
  fM.add(state, 'trailer').name('挂上拖车').listen().onChange((v) => app.setTrailer(v));
  fM.add({ f: () => { motion.snapTrailer(); hud.toast('拖车已归位'); } }, 'f').name('拖车归位');
  fM.add({ f: () => { motion.reset(); hud.toast('机体已归位'); } }, 'f').name('↺ 机体归位 (R)');
  fM.close();

  /* ================= 外观 ================= */
  const fA = gui.addFolder('⑤ 外观 / 材质');
  const colors = {
    '主装甲红': 'red', '次装甲蓝': 'blue', '银灰结构': 'metal',
    '镀铬件': 'chrome', '关节暗部': 'dark', '风挡玻璃': 'glass',
    '能量光': 'glow', '车灯': 'lamp',
  };
  const colorProxy = {};
  for (const [label, key] of Object.entries(colors)) {
    colorProxy[label] = M.palette[key];
    fA.addColor(colorProxy, label).onChange((v) => applyPalette(M, key, v));
  }
  const matState = { metalness: 0.58, roughness: 0.34, glass: 0.42, emblem: true };
  fA.add(matState, 'metalness', 0, 1, 0.01).name('车漆金属度').onChange((v) => M.paint.forEach((m) => (m.metalness = v)));
  fA.add(matState, 'roughness', 0, 1, 0.01).name('车漆粗糙度').onChange((v) => M.paint.forEach((m) => (m.roughness = v)));
  fA.add(matState, 'glass', 0, 1, 0.01).name('玻璃透明度').onChange((v) => { M.glass.opacity = v; });
  fA.add(state, 'wireframe').name('线框模式').listen().onChange((v) => app.setWireframe(v));
  fA.add(state, 'explode', 0, 1.6, 0.01).name('爆炸视图 (X)').listen().onChange((v) => app.setExplode(v));
  fA.add(state, 'axes').name('显示关节坐标轴 (J)').listen().onChange((v) => app.setJointAxes(v));
  fA.add(state, 'shadows').name('阴影').listen().onChange((v) => env.setShadows(v));
  fA.add(state, 'grid').name('参考网格 (G)').listen().onChange((v) => { env.grid.visible = v; });
  fA.add(state, 'pad').name('展台贴花').listen().onChange((v) => { env.pad.visible = v; });
  fA.add(state, 'props').name('场景道具').listen().onChange((v) => { env.props.visible = v; });
  fA.add(state, 'night').name('夜间模式 (N)').listen().onChange((v) => { env.setNight(v); app.syncLights(); });
  fA.add(state, 'headlights').name('车灯 (L)').listen().onChange(() => app.syncLights());
  fA.add({ get 雾浓度() { return app.scene.fog.density; }, set 雾浓度(v) { app.scene.fog.density = v; } },
    '雾浓度', 0, 0.03, 0.0005);
  fA.close();

  /* ================= 相机 ================= */
  const fC = gui.addFolder('⑥ 相机');
  const camMap = {};
  app.CAMERAS.forEach((c) => { camMap[c.name] = c.id; });
  const camState = { preset: app.CAMERAS[0].id };
  fC.add(camState, 'preset', camMap).name('机位预设 (C)').listen().onChange((id) => app.setCamera(id));
  app.onCameraPreset = (id) => { camState.preset = id; };
  fC.add(app.camera, 'fov', 20, 90, 1).name('视野 FOV').onChange(() => app.camera.updateProjectionMatrix());
  fC.add(app.controls, 'autoRotate').name('自动环绕').listen();
  fC.add(app.controls, 'autoRotateSpeed', -6, 6, 0.1).name('环绕速度');
  fC.add({ f: () => app.screenshot() }, 'f').name('📷 截图 PNG (P)');
  fC.close();

  /* ================= 特效 ================= */
  const fX = gui.addFolder('⑦ 武器与特效');
  fX.add(state, 'weapon').name('装备离子炮 (E)').listen().onChange((v) => { rig.blaster.root.visible = v; });
  fX.add({ f: () => { if (!effects.fire()) hud.toast('先装备离子炮（E）'); } }, 'f').name('🔥 开火 (F)');
  fX.add(effects, 'enableSmoke').name('排气烟雾');
  fX.add(effects, 'enableSparks').name('变形火花');
  fX.add({ f: () => { effects.burst(2); hud.toast('轰！'); } }, 'f').name('💨 排气轰鸣');
  fX.close();

  /* ================= 说明 ================= */
  const fI = gui.addFolder('⑧ 说明');
  const info = {
    '模型': '程序化装配：无外部模型文件',
    '关节': `${tf.slots.length} 个（含 6 轮 + 10 指）`,
    '比例': '1 单位 ≈ 1.7 m｜机体≈8.5m｜卡车≈7m',
    '变形': '每关节独立时间窗口，错峰联动',
  };
  for (const k of Object.keys(info)) fI.add(info, k).disable();
  fI.close();

  return gui;
}
