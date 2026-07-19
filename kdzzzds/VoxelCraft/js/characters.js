/* characters.js - 三角色：人类/大猩猩/小鸡，程序化模型 + 动作 */
const Characters = (function () {
  'use strict';

  const CHAR_LAYER = 1;  // 角色模型所在层（主相机排除，反射相机包括）

  /* ================================================================
   * 角色配置
   * ================================================================ */
  const CONFIG = {
    human: {
      name: '人类',
      halfWidth: 0.3,
      height: 1.8,
      eyeHeight: 1.62,
      speedMul: 1.0,
      scale: 1.0,
    },
    gorilla: {
      name: '大猩猩',
      halfWidth: 0.45,
      height: 1.6,
      eyeHeight: 1.4,
      speedMul: 0.85,
      scale: 1.3,
    },
    chicken: {
      name: '小鸡',
      halfWidth: 0.15,
      height: 0.65,
      eyeHeight: 0.5,
      speedMul: 0.7,
      scale: 0.35,
    },
  };
  const TYPES = ['human', 'gorilla', 'chicken'];

  /* ================================================================
   * 程序化模型构建
   * ================================================================ */

  function createHumanMesh() {
    const g = new THREE.Group();
    const skin = 0xf5d0a0;
    const cloth = 0x4466aa;
    const pants = 0x334466;

    // 躯干
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.7, 0.28), new THREE.MeshLambertMaterial({ color: cloth })
    );
    torso.position.y = 1.05;
    g.add(torso);

    // 头部
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.30, 0.30), new THREE.MeshLambertMaterial({ color: skin })
    );
    head.position.y = 1.55;
    g.add(head);

    // 腿部
    for (let side = -1; side <= 1; side += 2) {
      const upper = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.38, 0.16), new THREE.MeshLambertMaterial({ color: pants })
      );
      upper.position.set(side * 0.14, 0.55, 0);
      upper.name = 'legU_' + side;
      g.add(upper);

      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.36, 0.14), new THREE.MeshLambertMaterial({ color: 0x222233 })
      );
      lower.position.set(side * 0.14, 0.18, 0);
      lower.name = 'legL_' + side;
      g.add(lower);
    }

    // 手臂
    for (let side = -1; side <= 1; side += 2) {
      const upper = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.40, 0.14), new THREE.MeshLambertMaterial({ color: cloth })
      );
      upper.position.set(side * 0.36, 1.25, 0);
      upper.name = 'armU_' + side;
      g.add(upper);

      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.34, 0.12), new THREE.MeshLambertMaterial({ color: skin })
      );
      lower.position.set(side * 0.36, 0.88, 0);
      lower.name = 'armL_' + side;
      g.add(lower);
    }

    return g;
  }

  function createGorillaMesh() {
    const g = new THREE.Group();
    const fur = 0x3a2a1a;
    const face = 0x5a4a3a;

    // 躯干（宽大）
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.6, 0.4), new THREE.MeshLambertMaterial({ color: fur })
    );
    torso.position.y = 0.9;
    g.add(torso);

    // 头部
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.34, 0.30), new THREE.MeshLambertMaterial({ color: fur })
    );
    head.position.y = 1.35;
    g.add(head);
    const snout = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: face })
    );
    snout.position.set(0, 1.33, 0.18);
    g.add(snout);

    // 短腿
    for (let side = -1; side <= 1; side += 2) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.42, 0.20), new THREE.MeshLambertMaterial({ color: 0x2a1a0a })
      );
      leg.position.set(side * 0.22, 0.21, 0);
      leg.name = 'leg_' + side;
      g.add(leg);
    }

    // 长臂（拖地）
    for (let side = -1; side <= 1; side += 2) {
      const upper = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.50, 0.16), new THREE.MeshLambertMaterial({ color: fur })
      );
      upper.position.set(side * 0.52, 1.0, 0);
      upper.name = 'armU_' + side;
      g.add(upper);

      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.44, 0.14), new THREE.MeshLambertMaterial({ color: 0x2a1a0a })
      );
      lower.position.set(side * 0.52, 0.53, 0);
      lower.name = 'armL_' + side;
      g.add(lower);
    }

    return g;
  }

  function createChickenMesh() {
    const g = new THREE.Group();
    const bodyCol = 0xf5f0e0;
    const beakCol = 0xf0a030;
    const combCol = 0xe03030;

    // 身体（椭球）
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshLambertMaterial({ color: bodyCol })
    );
    body.scale.set(1, 1.2, 1.3);
    body.position.y = 0.26;
    g.add(body);

    // 头部
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 6, 6), new THREE.MeshLambertMaterial({ color: bodyCol })
    );
    head.position.set(0, 0.52, 0.08);
    g.add(head);

    // 喙
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.10, 4), new THREE.MeshLambertMaterial({ color: beakCol })
    );
    beak.position.set(0, 0.50, 0.20);
    beak.rotation.x = Math.PI / 2;
    g.add(beak);

    // 鸡冠
    const comb = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.08, 0.06), new THREE.MeshLambertMaterial({ color: combCol })
    );
    comb.position.set(0, 0.62, 0.06);
    g.add(comb);

    // 腿
    for (let side = -1; side <= 1; side += 2) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.16, 0.04), new THREE.MeshLambertMaterial({ color: beakCol })
      );
      leg.position.set(side * 0.08, 0.08, 0);
      leg.name = 'leg_' + side;
      g.add(leg);
    }

    // 尾羽
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.16, 0.08), new THREE.MeshLambertMaterial({ color: 0xe8e0c8 })
    );
    tail.position.set(0, 0.28, -0.18);
    tail.rotation.x = 0.5;
    g.add(tail);

    return g;
  }

  /* ================================================================
   * 程序化动画
   * ================================================================ */

  function animateHuman(mesh, t, moving) {
    const freq = moving ? 9 : 2.5;
    const amp = moving ? 0.5 : 0.05;

    for (let side = -1; side <= 1; side += 2) {
      const phase = side === 1 ? 0 : Math.PI;
      const a = Math.sin(t * freq + phase) * amp;

      const armU = mesh.getObjectByName('armU_' + side);
      const armL = mesh.getObjectByName('armL_' + side);
      const legU = mesh.getObjectByName('legU_' + side);
      const legL = mesh.getObjectByName('legL_' + side);

      if (armU) armU.rotation.x = a;
      if (armL) armL.rotation.x = a * 0.6;
      if (legU) legU.rotation.x = -a;
      if (legL) legL.rotation.x = moving ? (Math.max(0, -a * 1.2)) : 0;
    }
    // 身体微上下摆动
    mesh.position.y = moving ? Math.abs(Math.sin(t * freq)) * 0.03 : 0;
  }

  function animateGorilla(mesh, t, moving) {
    const freq = moving ? 7 : 1.8;
    const amp = moving ? 0.55 : 0.04;

    for (let side = -1; side <= 1; side += 2) {
      const phase = side === 1 ? 0 : Math.PI;
      const a = Math.sin(t * freq + phase) * amp;

      const armU = mesh.getObjectByName('armU_' + side);
      const armL = mesh.getObjectByName('armL_' + side);
      const leg = mesh.getObjectByName('leg_' + side);

      // 长臂前后摆动
      if (armU) armU.rotation.x = a;
      if (armL) armL.rotation.x = a * 0.5;
      // 腿短，摆动幅度小
      if (leg) leg.rotation.x = -a * 0.7;
    }
    // 身体左右摇摆（猩猩步态特征）
    mesh.rotation.z = Math.sin(t * freq * 0.5) * (moving ? 0.12 : 0.01);
    mesh.position.y = moving ? Math.abs(Math.sin(t * freq)) * 0.04 : 0;
  }

  function animateChicken(mesh, t, moving) {
    const freq = moving ? 11 : 3;
    const peckFreq = 2.5;
    const walkAmp = moving ? 0.3 : 0.04;
    const bobAmp = moving ? 0.06 : 0.01;

    for (let side = -1; side <= 1; side += 2) {
      const phase = side === 1 ? 0 : Math.PI;
      const a = Math.sin(t * freq + phase) * walkAmp;
      const leg = mesh.getObjectByName('leg_' + side);
      if (leg) leg.rotation.x = a;
    }

    // 身体弹跳
    mesh.position.y = Math.abs(Math.sin(t * freq)) * bobAmp;

    // 啄食动作（头部前倾）：周期性，与走路错开
    const peck = Math.sin(t * peckFreq);
    const head = mesh.children.find(c => c.geometry && c.geometry.type === 'SphereGeometry' && c.position.y > 0.45);
    if (head && peck > 0.7) {
      head.rotation.x = (peck - 0.7) * 1.5;
    } else if (head) {
      head.rotation.x *= 0.9;
    }
  }

  /* ================================================================
   * 构建 / 动画 映射表
   * ================================================================ */
  const builders = {
    human: createHumanMesh,
    gorilla: createGorillaMesh,
    chicken: createChickenMesh,
  };
  const animators = {
    human: animateHuman,
    gorilla: animateGorilla,
    chicken: animateChicken,
  };

  /* ================================================================
   * 对外 API
   * ================================================================ */
  return {
    CHAR_LAYER: CHAR_LAYER,
    TYPES: TYPES,
    CONFIG: CONFIG,

    /** 创建指定类型的角色模型 */
    createMesh: function (type) {
      const fn = builders[type];
      if (!fn) return null;
      const mesh = fn();
      mesh.scale.setScalar(CONFIG[type].scale);
      // 将整个角色模型放在指定 layer，供反射相机渲染
      mesh.traverse(function (c) { c.layers.set(CHAR_LAYER); });
      return mesh;
    },

    /** 给指定类型的角色模型施加动画 */
    animate: function (type, mesh, time, moving) {
      const fn = animators[type];
      if (!fn || !mesh) return;
      fn(mesh, time, moving);
    },

    /** 获取角色配置 */
    getConfig: function (type) { return CONFIG[type] || CONFIG.human; },
  };
})();
