/* character.js — 人形角色:标准骨架 + 连续蒙皮(平滑权重过渡) + 全代码程序动画
   1.75m / 7.5 头身;骨骼层级符合解剖;步行相位与位移严格同步(杜绝滑步) */
window.G = window.G || {};
(function () {
  const U = G.U;
  const C = {};
  G.CHAR = C;

  /* 骨骼定义:name, parent, 世界绑定位置 */
  const BONES = [
    ['hips', null, [0, 0.980, 0]],
    ['spine', 'hips', [0, 1.080, 0]],
    ['chest', 'spine', [0, 1.300, 0]],
    ['neck', 'chest', [0, 1.480, 0]],
    ['head', 'neck', [0, 1.560, 0]],
    ['shL', 'chest', [0.185, 1.435, 0]],
    ['uarmL', 'shL', [0.240, 1.420, 0]],
    ['farmL', 'uarmL', [0.250, 1.115, 0]],
    ['handL', 'farmL', [0.255, 0.845, 0]],
    ['shR', 'chest', [-0.185, 1.435, 0]],
    ['uarmR', 'shR', [-0.240, 1.420, 0]],
    ['farmR', 'uarmR', [-0.250, 1.115, 0]],
    ['handR', 'farmR', [-0.255, 0.845, 0]],
    ['thighL', 'hips', [0.100, 0.945, 0]],
    ['shinL', 'thighL', [0.100, 0.500, 0]],
    ['footL', 'shinL', [0.100, 0.070, 0]],
    ['toeL', 'footL', [0.100, 0.015, 0.130]],
    ['thighR', 'hips', [-0.100, 0.945, 0]],
    ['shinR', 'thighR', [-0.100, 0.500, 0]],
    ['footR', 'shinR', [-0.100, 0.070, 0]],
    ['toeR', 'footR', [-0.100, 0.015, 0.130]]
  ];
  const BI = {}; BONES.forEach((b, i) => BI[b[0]] = i);

  /* 几何朝向工具:胶囊沿 from→to */
  function orientGeo(geo, from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
    geo.translate(from.x, from.y, from.z);
    return len;
  }
  /* 给几何写蒙皮权重:fn(worldPos) → [b0,w0,b1,w1] */
  function skinGeo(geo, fn) {
    const pos = geo.attributes.position;
    const n = pos.count;
    const si = new Float32Array(n * 4), sw = new Float32Array(n * 4);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i);
      const r = fn(v);
      si[i * 4] = r[0]; sw[i * 4] = r[1];
      si[i * 4 + 1] = r[2] == null ? 0 : r[2]; sw[i * 4 + 1] = r[3] == null ? 0 : r[3];
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(si), 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    return geo;
  }
  const blend2 = (a, b, t) => { t = U.clamp(t, 0, 1); t = U.smooth(t); return [a, 1 - t, b, t]; };

  /* ================= 构建角色 ================= */
  C.build = function (opt) {
    opt = opt || {};
    const t = G.TEX.t;
    const tints = opt.tints || {};
    const mats = [
      new THREE.MeshStandardMaterial({ map: t.jacket.map, roughness: 0.82, color: tints.jacket || 0xffffff, skinning: true }),            // 0 躯干
      new THREE.MeshStandardMaterial({ map: t.face.map, roughness: 0.62, color: tints.skin || 0xffffff, skinning: true }),                 // 1 头颈
      new THREE.MeshStandardMaterial({ map: t.jacketArm.map, roughness: 0.82, color: tints.jacket || 0xffffff, skinning: true }),          // 2 手臂
      new THREE.MeshStandardMaterial({ map: t.skin.map, roughness: 0.6, color: tints.skin || 0xffffff, skinning: true }),                  // 3 手
      new THREE.MeshStandardMaterial({ map: t.jeans.map, roughness: 0.9, color: tints.jeans || 0xffffff, skinning: true }),                // 4 腿
      new THREE.MeshStandardMaterial({ map: t.shoes.map, roughness: 0.85, color: tints.shoes || 0xffffff, skinning: true })                // 5 鞋
    ];

    const items = [];
    /* --- 躯干(车削,连续权重 hips→spine→chest) --- */
    const torsoProfile = [
      [0.001, 0.800], [0.132, 0.802], [0.152, 0.860], [0.158, 0.920], [0.146, 0.985],
      [0.128, 1.060], [0.132, 1.140], [0.150, 1.230], [0.163, 1.330], [0.158, 1.400], [0.120, 1.445], [0.055, 1.468], [0.001, 1.470]
    ];
    const torso = new THREE.LatheGeometry(torsoProfile.map(p => new THREE.Vector2(p[0], p[1])), 14);
    torso.rotateY(Math.PI / 2);
    torso.scale(1, 1, 0.68);
    skinGeo(torso, v => {
      if (v.y < 0.96) return [BI.hips, 1];
      if (v.y < 1.13) return blend2(BI.hips, BI.spine, (v.y - 0.96) / 0.17);
      if (v.y < 1.27) return blend2(BI.spine, BI.chest, (v.y - 1.13) / 0.14);
      return [BI.chest, 1];
    });
    items.push({ geo: torso, mi: 0 });

    /* --- 颈+头(车削,面部贴图) --- */
    const headProfile = [
      [0.001, 1.440], [0.066, 1.442], [0.058, 1.500], [0.062, 1.535], [0.078, 1.555],
      [0.092, 1.590], [0.101, 1.630], [0.103, 1.665], [0.096, 1.706], [0.075, 1.733], [0.040, 1.748], [0.001, 1.752]
    ];
    const head = new THREE.LatheGeometry(headProfile.map(p => new THREE.Vector2(p[0], p[1])), 16);
    head.rotateY(Math.PI / 2);
    head.scale(1, 1, 0.95);
    head.translate(0, 0, 0.008);
    skinGeo(head, v => {
      if (v.y < 1.475) return blend2(BI.chest, BI.neck, (v.y - 1.44) / 0.035);
      if (v.y < 1.545) return blend2(BI.neck, BI.head, (v.y - 1.475) / 0.07);
      return [BI.head, 1];
    });
    items.push({ geo: head, mi: 1 });
    const nose = new THREE.SphereGeometry(0.016, 8, 6);
    nose.scale(0.85, 1.1, 1.15);
    nose.translate(0, 1.600, 0.100);
    skinGeo(nose, () => [BI.head, 1]);
    items.push({ geo: nose, mi: 3 });
    /* 耳朵 */
    for (const sx of [1, -1]) {
      const ear = new THREE.SphereGeometry(0.02, 6, 5);
      ear.scale(0.5, 1.15, 0.9);
      ear.translate(sx * 0.098, 1.612, 0.005);
      skinGeo(ear, () => [BI.head, 1]);
      items.push({ geo: ear, mi: 3 });
    }

    /* --- 手臂(腕→肩连续胶囊,肘部平滑过渡) --- */
    for (const S of ['L', 'R']) {
      const sgn = S === 'L' ? 1 : -1;
      const wrist = U.v3(sgn * 0.255, 0.845, 0), shoulder = U.v3(sgn * 0.240, 1.420, 0);
      const armLen = wrist.distanceTo(shoulder);
      const arm = U.capsule(0.041, 0.056, armLen, 11, 3);
      const seg = 14;
      { /* 细分中段以获得平滑肘部 */ }
      orientGeo(arm, wrist, shoulder);
      const tE = (1.115 - 0.845) / (1.420 - 0.845);
      skinGeo(arm, v => {
        const tt = (v.y - 0.845) / (1.420 - 0.845);
        if (tt > tE + 0.11) return [BI['uarm' + S], 1];
        if (tt < tE - 0.11) return [BI['farm' + S], 1];
        return blend2(BI['farm' + S], BI['uarm' + S], (tt - (tE - 0.11)) / 0.22);
      });
      items.push({ geo: arm, mi: 2 });
      /* 肩三角肌 */
      const delt = new THREE.SphereGeometry(0.072, 10, 8);
      delt.scale(1.12, 0.94, 0.9);
      delt.translate(sgn * 0.215, 1.418, 0);
      skinGeo(delt, v => blend2(BI.chest, BI['uarm' + S], 0.62));
      items.push({ geo: delt, mi: 2 });
      /* 手掌 + 拇指 */
      const hand = U.capsule(0.030, 0.040, 0.185, 8, 3);
      orientGeo(hand, U.v3(sgn * 0.258, 0.665, 0.012), U.v3(sgn * 0.255, 0.850, 0));
      hand.scale(1, 1, 1); // 保持
      skinGeo(hand, () => [BI['hand' + S], 1]);
      items.push({ geo: hand, mi: 3 });
      const thumb = U.capsule(0.013, 0.016, 0.062, 6, 2);
      orientGeo(thumb, U.v3(sgn * 0.230, 0.760, 0.045), U.v3(sgn * 0.248, 0.815, 0.012));
      skinGeo(thumb, () => [BI['hand' + S], 1]);
      items.push({ geo: thumb, mi: 3 });
    }
    /* 手掌压扁(在世界方向 x 上) */
    /* --- 腿(踝→髋连续胶囊,膝部平滑过渡) --- */
    for (const S of ['L', 'R']) {
      const sgn = S === 'L' ? 1 : -1;
      const ankle = U.v3(sgn * 0.100, 0.070, 0), hip = U.v3(sgn * 0.100, 0.945, 0);
      const leg = U.capsule(0.050, 0.090, ankle.distanceTo(hip), 12, 3);
      orientGeo(leg, ankle, hip);
      const tK = (0.500 - 0.070) / (0.945 - 0.070);
      skinGeo(leg, v => {
        const tt = (v.y - 0.070) / (0.945 - 0.070);
        if (tt > tK + 0.09) return [BI['thigh' + S], 1];
        if (tt < tK - 0.09) return [BI['shin' + S], 1];
        return blend2(BI['shin' + S], BI['thigh' + S], (tt - (tK - 0.09)) / 0.18);
      });
      items.push({ geo: leg, mi: 4 });
      /* 鞋:压扁胶囊 + 鞋底 */
      const shoe = U.capsule(0.052, 0.058, 0.255, 9, 3);
      orientGeo(shoe, U.v3(sgn * 0.100, 0.052, -0.065), U.v3(sgn * 0.100, 0.058, 0.190));
      shoe.scale(1, 1, 1);
      /* 竖直压扁 */
      { const p = shoe.attributes.position; const v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); p.setY(i, 0.052 + (v.y - 0.052) * 0.62); } shoe.computeVertexNormals(); }
      skinGeo(shoe, v => v.z > 0.10 ? blend2(BI['foot' + S], BI['toe' + S], (v.z - 0.10) / 0.09) : [BI['foot' + S], 1]);
      items.push({ geo: shoe, mi: 5 });
      const sole = new THREE.BoxGeometry(0.105, 0.028, 0.27);
      sole.translate(sgn * 0.100, 0.016, 0.055);
      skinGeo(sole, v => v.z > 0.10 ? blend2(BI['foot' + S], BI['toe' + S], (v.z - 0.10) / 0.09) : [BI['foot' + S], 1]);
      items.push({ geo: sole, mi: 5 });
    }

    /* 合并 + 分组 */
    const geo = U.mergeGrouped(items);
    geo.computeVertexNormals();

    /* 骨架 */
    const bones = [], boneMap = {};
    for (const [name, parent, p] of BONES) {
      const b = new THREE.Bone();
      b.name = name;
      if (parent) {
        const pp = BONES[BI[parent]][2];
        b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
        boneMap[parent].add(b);
      } else b.position.set(p[0], p[1], p[2]);
      bones.push(b); boneMap[name] = b;
    }
    const mesh = new THREE.SkinnedMesh(geo, mats);
    mesh.add(boneMap.hips);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.castShadow = true; mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    geo.attributes.skinWeight.needsUpdate = true;

    const group = new THREE.Group();
    group.add(mesh);

    /* ================= 动画状态机 ================= */
    const ch = {
      group, mesh, bones: boneMap, mats, headSize: 0.235,
      mode: 'stand',            // stand | seat | enter | exit
      phase: Math.random() * U.TAU, speed: 0, turn: 0,
      moveBlend: 0, runBlend: 0, tGlobal: Math.random() * 100,
      seatBlend: 0, aim: 0, stepParity: 0, onStep: null
    };
    const Q = {}; for (const b of bones) Q[b.name] = new THREE.Euler();
    const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3();

    ch.setMove = function (speed, turn) { ch.speed = speed; ch.turn = turn || 0; };

    function setE(name, x, y, z) { Q[name].set(x || 0, y || 0, z || 0); }
    function addE(name, x, y, z) { Q[name].x += x || 0; Q[name].y += y || 0; Q[name].z += z || 0; }

    /* 站立/行走/奔跑姿态 */
    function locomotion(dt) {
      const sp = ch.speed;
      ch.moveBlend = U.damp(ch.moveBlend, U.clamp(sp / 1.2, 0, 1), 10, dt);
      ch.runBlend = U.damp(ch.runBlend, U.ilerp(2.4, 5.2, sp), 8, dt);
      const mv = ch.moveBlend, run = ch.runBlend;
      const cycle = U.lerp(1.45, 2.30, run);           // 一个完整周期的位移(m)
      if (sp > 0.05) {
        const prev = ch.phase;
        ch.phase = (ch.phase + sp / cycle * U.TAU * dt) % U.TAU;
        const pp = prev % Math.PI, np = ch.phase % Math.PI;
        if (np < pp && ch.onStep && sp > 0.4) { ch.stepParity ^= 1; ch.onStep(run); }
      }
      const ph = ch.phase, tg = ch.tGlobal;
      const A = U.lerp(0.52, 0.86, run) * mv;
      const Aarm = U.lerp(0.38, 0.85, run) * mv;
      /* 骨盆 & 躯干 */
      const bobBase = U.lerp(0, U.lerp(-0.025, -0.045, run), mv);
      const bob = U.lerp(0, U.lerp(0.030, 0.056, run), mv) * Math.cos(2 * ph);
      boneMap.hips.position.y = 0.98 + bobBase + bob + Math.sin(tg * 1.55) * 0.004 * (1 - mv);
      setE('hips', 0, 0.11 * Math.sin(ph) * mv * (1 + run * 0.5), 0.055 * Math.cos(ph) * mv + Math.sin(tg * 0.31) * 0.028 * (1 - mv));
      setE('spine', 0.02 * Math.sin(2 * ph) * mv, -0.05 * Math.sin(ph) * mv, 0);
      setE('chest',
        U.lerp(0.02, 0.24, run) * mv + 0.028 * Math.sin(tg * 1.55) * (1 - mv * 0.5) + 0.03 * Math.sin(2 * ph) * mv,
        -0.13 * Math.sin(ph) * mv * (1 + run * 0.4),
        -ch.turn * 0.06 * mv);
      setE('neck', 0.05 * mv * run, 0, 0);
      setE('head',
        -U.lerp(0.0, 0.12, run) * mv + 0.02 * Math.sin(tg * 0.4) * (1 - mv),
        0.10 * Math.sin(ph) * mv * 0.5 + (Math.sin(tg * 0.37) * 0.07 + Math.sin(tg * 0.23) * 0.05) * (1 - mv),
        0);
      /* 腿:骨骼指向 -Y ⇒ rx<0 = 前摆;膝弯曲 shin.rx>0(永不反关节) */
      for (const S of ['L', 'R']) {
        const o = S === 'L' ? 0 : Math.PI;
        const p = ph + o;
        const fwd = Math.sin(p);                            // 1 = 前摆最大
        const thigh = -A * fwd;
        const swingW = Math.max(0, Math.cos(p));            // 摆动相(脚离地)
        const stanceW = Math.max(0, -Math.cos(p));          // 支撑相
        const knee = U.lerp(0.55, 1.35, run) * Math.pow(Math.max(0, Math.cos(p) * 0.5 + 0.5), 1.3) * mv * (0.35 + 0.65 * swingW) + 0.12 * mv * stanceW;
        let foot = -(thigh + knee) * 0.62 * stanceW + swingW * (0.30 - 0.48 * Math.max(0, fwd)) * mv;
        setE('thigh' + S, thigh - 0.04 * mv, 0, (S === 'L' ? 1 : -1) * 0.02);
        setE('shin' + S, knee, 0, 0);
        setE('foot' + S, U.clamp(foot, -0.55, 0.55), 0, 0);
        setE('toe' + S, stanceW > 0.7 ? U.clamp((thigh + knee) * 0.4, 0, 0.5) : 0, 0, 0);
      }
      /* 手臂(与同侧腿反相;肘弯曲 rx<0 = 小臂前收) */
      for (const S of ['L', 'R']) {
        const o = S === 'L' ? 0 : Math.PI;
        const p = ph + o;
        const swing = Aarm * Math.sin(p);                   // >0 手臂后摆
        setE('sh' + S, 0, 0, (S === 'L' ? 1 : -1) * (0.02 + 0.02 * Math.sin(tg * 1.55) * (1 - mv)));
        setE('uarm' + S,
          swing + U.lerp(0.06, -0.12, run * mv),
          0,
          (S === 'L' ? 1 : -1) * (0.085 + run * 0.07));
        setE('farm' + S, -(U.lerp(0.14, 0.30, mv) + U.lerp(0, 0.65, run) + Math.max(0, -Math.sin(p)) * 0.32 * mv), 0, 0);
        setE('hand' + S, -0.06, 0, (S === 'L' ? 1 : -1) * 0.04);
      }
    }

    /* 坐姿 + 方向盘(双手解析 IK) */
    function seated(dt, ctx) {
      boneMap.hips.position.y = 0.98;
      setE('hips', -0.12, 0, 0);
      setE('spine', 0.10, 0, 0);
      setE('chest', 0.10, 0, 0);
      setE('neck', -0.04, 0, 0);
      setE('head', -0.02 + (ctx && ctx.headTurn ? 0 : 0), (ctx && ctx.headTurn) || 0, 0);
      for (const S of ['L', 'R']) {
        const sg = S === 'L' ? 1 : -1;
        setE('thigh' + S, -1.38, sg * 0.03, sg * 0.10);
        setE('shin' + S, 1.24, 0, 0);
        setE('foot' + S, S === 'R' ? 0.18 : 0.10, 0, 0);
        setE('toe' + S, 0, 0, 0);
      }
      applyEulers(1);
      /* IK 双手到方向盘 */
      if (ctx && ctx.wheelPos) {
        group.updateMatrixWorld(true);
        const steer = ctx.steer || 0;
        const R = ctx.wheelR || 0.19;
        const qW = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.42 - Math.PI / 2 * 0, 0, 0));
        const qTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.42, 0, 0));
        for (const S of ['L', 'R']) {
          const sg = S === 'L' ? 1 : -1;
          const baseA = S === 'L' ? Math.PI * 0.78 : Math.PI * 0.22;
          const a = baseA + steer * 1.1;
          tmpV.set(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, 0).applyQuaternion(qTilt);
          tmpV.add(ctx.wheelPos);       // 角色本地空间目标
          solveArm(S, tmpV, dt);
        }
      }
    }

    /* 两骨解析 IK(角色本地空间) */
    const aLen = 0.3057, bLen = 0.2705 + 0.05;
    function solveArm(S, target, dt) {
      const sg = S === 'L' ? 1 : -1;
      const uarm = boneMap['uarm' + S], farm = boneMap['farm' + S], hand = boneMap['hand' + S];
      uarm.getWorldPosition(tmpV2);
      group.worldToLocal(tmpV2);                        // 肩(本地)
      tmpV3.subVectors(target, tmpV2);
      let d = U.clamp(tmpV3.length(), 0.12, aLen + bLen - 0.01);
      const dir = tmpV3.normalize();
      const cosA = U.clamp((aLen * aLen + d * d - bLen * bLen) / (2 * aLen * d), -1, 1);
      const angA = Math.acos(cosA);
      const cosE = U.clamp((aLen * aLen + bLen * bLen - d * d) / (2 * aLen * bLen), -1, 1);
      const elbow = Math.PI - Math.acos(cosE);
      /* 弯曲平面:肘部向外下 */
      const pole = tmpV.set(sg * 0.85, -0.45, -0.25).normalize();
      const n = new THREE.Vector3().crossVectors(dir, pole).normalize();
      if (n.lengthSq() < 0.01) n.set(0, 0, sg);
      const upperDir = dir.clone().applyAxisAngle(n, angA);
      /* uarm 世界四元数:骨骼 -Y 轴对准 upperDir */
      const qWorld = tmpQ.setFromUnitVectors(new THREE.Vector3(0, -1, 0), upperDir);
      /* 转换到 shL 本地 */
      const parent = uarm.parent;
      parent.getWorldQuaternion(tmpQ2);
      const gq = group.getWorldQuaternion(new THREE.Quaternion());
      /* 目标在角色本地空间 → 世界:先转世界 */
      const qWorldFull = gq.clone().multiply(qWorld);
      uarm.quaternion.copy(tmpQ2.invert().multiply(qWorldFull));
      /* 肘屈曲方向自动纠偏:取误差更小的一侧 */
      const flex = Math.PI - Math.acos(cosE);
      let bestQ = null, bestErr = 1e9;
      for (const s of [-1, 1]) {
        farm.quaternion.setFromEuler(new THREE.Euler(s * flex, 0, 0));
        group.updateMatrixWorld(true);
        hand.getWorldPosition(tmpV);
        group.worldToLocal(tmpV);
        const err = tmpV.distanceTo(target);
        if (err < bestErr) { bestErr = err; bestQ = farm.quaternion.clone(); }
      }
      farm.quaternion.copy(bestQ);
      hand.quaternion.setFromEuler(new THREE.Euler(-0.35, sg * -0.15, sg * 0.12));
    }

    function applyEulers(w) {
      for (const b of bones) {
        tmpQ.setFromEuler(Q[b.name]);
        if (w >= 1) b.quaternion.copy(tmpQ);
        else b.quaternion.slerp(tmpQ, w);
      }
    }

    /* 进出车过渡姿态(t: 0 站立 → 1 坐姿) */
    function enterPose(t) {
      const k = U.smooth(t);
      const duck = Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.35;
      boneMap.hips.position.y = 0.98 - 0.05 * k;
      setE('hips', -0.12 * k - duck * 0.3, 0, 0);
      setE('spine', 0.10 * k + duck * 0.25, 0, 0);
      setE('chest', 0.10 * k + duck * 0.35, 0, 0);
      setE('neck', -0.04 * k, 0, 0);
      setE('head', -0.02 * k - duck * 0.2, 0, 0);
      for (const S of ['L', 'R']) {
        const sg = S === 'L' ? 1 : -1;
        const lead = S === 'L' ? Math.min(1, t * 1.6) : Math.max(0, (t - 0.3) * 1.5);
        setE('thigh' + S, -1.38 * U.smooth(lead), sg * 0.03, sg * 0.10 * k);
        setE('shin' + S, 1.24 * U.smooth(lead), 0, 0);
        setE('foot' + S, 0.14 * U.smooth(lead), 0, 0);
      }
      for (const S of ['L', 'R']) {
        const sg = S === 'L' ? 1 : -1;
        setE('sh' + S, 0, 0, sg * 0.02);
        setE('uarm' + S, -0.5 * k - duck * 0.4, 0, sg * 0.12);
        setE('farm' + S, -(0.4 + 0.5 * k), 0, 0);
        setE('hand' + S, -0.05, 0, 0);
      }
      applyEulers(1);
    }

    ch.update = function (dt, ctx) {
      ch.tGlobal += dt;
      ctx = ctx || {};
      if (ch.mode === 'stand') {
        locomotion(dt);
        applyEulers(1);
      } else if (ch.mode === 'seat') {
        ch.seatBlend = U.damp(ch.seatBlend, 1, 8, dt);
        seated(dt, ctx);
      } else if (ch.mode === 'enter') {
        enterPose(ctx.t == null ? 1 : ctx.t);
      } else if (ch.mode === 'exit') {
        enterPose(1 - (ctx.t == null ? 0 : ctx.t));
      }
    };
    ch.enterSeat = function () { ch.mode = 'seat'; };
    ch.stand = function () { ch.mode = 'stand'; ch.seatBlend = 0; };
    return ch;
  };
})();
