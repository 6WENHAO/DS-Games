/* ============================================================
 * 真·三國無雙 WEB —— 3D 模型工厂
 * 人物 / 兵卒 / 马匹 / 据点 / 地形 / 道具
 * ============================================================ */
'use strict';

var MODELS = (function () {

  var M = {};

  /* ---------------- 通用贴图 ---------------- */
  function canvasTex(size, draw) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    var t = new THREE.CanvasTexture(c);
    return t;
  }

  M.glowTex = canvasTex(64, function (g, s) {
    var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });

  M.shadowTex = canvasTex(64, function (g, s) {
    var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(0,0,0,0.45)');
    r.addColorStop(0.7, 'rgba(0,0,0,0.3)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });

  M.ringTex = canvasTex(128, function (g, s) {
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.lineWidth = 10;
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 8, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.lineWidth = 22;
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 14, 0, Math.PI * 2); g.stroke();
  });

  function lambert(color, opts) {
    var p = { color: color };
    if (opts) for (var k in opts) p[k] = opts[k];
    return new THREE.MeshLambertMaterial(p);
  }

  M.makeShadow = function (radius) {
    var geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
    var mat = new THREE.MeshBasicMaterial({
      map: M.shadowTex, transparent: true, depthWrite: false
    });
    var m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    m.renderOrder = 1;
    return m;
  };

  /* ---------------- 武器 ---------------- */
  M.makeWeapon = function (type) {
    var g = new THREE.Group();
    var metal = lambert(0xcfd6e0);
    var gold = lambert(0xd9b24a);
    var wood = lambert(0x6b4a2c);
    var darkwood = lambert(0x4a3320);
    var mesh;
    switch (type) {
      case 'sword': {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.03), metal);
        mesh.position.y = 0.62;
        g.add(mesh);
        var guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.07), gold);
        guard.position.y = 0.12; g.add(guard);
        var grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 6), darkwood);
        grip.position.y = -0.02; g.add(grip);
        break;
      }
      case 'spear': {
        var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 3.1, 6), wood);
        shaft.position.y = 1.15; g.add(shaft);
        var blade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 6), metal);
        blade.position.y = 2.95; g.add(blade);
        var tassel = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 6), lambert(0xcc3333));
        tassel.position.y = 2.6; tassel.rotation.x = Math.PI; g.add(tassel);
        break;
      }
      case 'glaive': {
        var shaft2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.7, 6), darkwood);
        shaft2.position.y = 1.0; g.add(shaft2);
        var shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(0.55, 0.25, 0.42, 0.95);
        shape.quadraticCurveTo(0.28, 0.6, 0, 0.9);
        shape.lineTo(0, 0);
        var bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
        var blade2 = new THREE.Mesh(bladeGeo, lambert(0xbcd0dd));
        blade2.position.set(0, 2.15, -0.015);
        g.add(blade2);
        var dragon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), gold);
        dragon.position.y = 2.18; g.add(dragon);
        break;
      }
      case 'pike': {
        var shaft3 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.0, 6), darkwood);
        shaft3.position.y = 1.1; g.add(shaft3);
        var s1 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), metal);
        s1.position.set(0.05, 2.85, 0); s1.rotation.z = -0.25; g.add(s1);
        var s2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), metal);
        s2.position.set(-0.05, 3.05, 0); s2.rotation.z = 0.25; g.add(s2);
        var s3 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 5), metal);
        s3.position.set(0, 3.28, 0); g.add(s3);
        break;
      }
      case 'bow': {
        var bow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 5, 10, Math.PI), wood);
        bow.rotation.z = Math.PI / 2;
        g.add(bow);
        break;
      }
      case 'staff': {
        var st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 6), lambert(0x8a6a3a));
        st.position.y = 0.9; g.add(st);
        var orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
          new THREE.MeshLambertMaterial({ color: 0x66ff88, emissive: 0x2a8844 }));
        orb.position.y = 2.2; g.add(orb);
        break;
      }
    }
    return g;
  };

  /* ---------------- 背旗（武将名旗） ---------------- */
  M.makeBackFlag = function (text, colorCss) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 5), lambert(0x554433));
    pole.position.y = 0.75;
    g.add(pole);
    var tex = canvasTex(128, function (ctx, s) {
      ctx.fillStyle = colorCss;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 6; ctx.strokeRect(3, 3, s - 6, s - 6);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 84px "KaiTi","STKaiti","Microsoft YaHei",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, s / 2, s / 2 + 4);
    });
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    flag.position.set(0.28, 1.2, 0);
    g.add(flag);
    return g;
  };

  /* ---------------- 头顶名牌 ---------------- */
  M.makeNameLabel = function (name, title, colorCss) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 80;
    var g = c.getContext('2d');
    g.textAlign = 'center';
    if (title) {
      g.font = '20px "Microsoft YaHei",sans-serif';
      g.fillStyle = 'rgba(255,220,120,0.95)';
      g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 4;
      g.strokeText(title, 128, 24);
      g.fillText(title, 128, 24);
    }
    g.font = 'bold 34px "Microsoft YaHei",sans-serif';
    g.fillStyle = colorCss;
    g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 5;
    g.strokeText(name, 128, 62);
    g.fillText(name, 128, 62);
    var tex = new THREE.CanvasTexture(c);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(3.2, 1.0, 1);
    sp.renderOrder = 5;
    return sp;
  };

  M.makeMiniHpBar = function () {
    var g = new THREE.Group();
    var bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x111111, depthTest: false, opacity: 0.7, transparent: true }));
    bg.scale.set(1.7, 0.13, 1); bg.renderOrder = 5;
    var fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3333, depthTest: false }));
    fg.center.set(0, 0.5);
    fg.position.x = -0.8;
    fg.scale.set(1.6, 0.09, 1); fg.renderOrder = 6;
    g.add(bg); g.add(fg);
    g.userData.fg = fg;
    return g;
  };

  /* ---------------- 人形模型 ----------------
   * cfg: { h:身高, cloth, skin, armor, helmet:'han'|'turban'|'hero'|'none',
   *        weapon, officer, plume, beard, cape, backFlagChar, backFlagColor }
   */
  M.makeHumanoid = function (cfg) {
    var h = cfg.h || 1.7;
    var s = h / 1.7;
    var root = new THREE.Group();
    var body = new THREE.Group();     // 躯干总组（受击缩放/倒地旋转用）
    root.add(body);

    var clothM = lambert(cfg.cloth);
    var skinM = lambert(cfg.skin || 0xd9a878);
    var armorM = lambert(cfg.armor || cfg.cloth);

    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 0.62 * s, 7), clothM);
    torso.position.y = 1.0 * s;
    body.add(torso);

    if (cfg.officer) {
      var chest = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.29 * s, 0.34 * s, 7), armorM);
      chest.position.y = 1.12 * s;
      body.add(chest);
      var padL = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 6, 5), armorM);
      padL.position.set(-0.3 * s, 1.28 * s, 0); body.add(padL);
      var padR = padL.clone(); padR.position.x = 0.3 * s; body.add(padR);
    }

    var belt = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.24 * s, 0.08 * s, 7),
      lambert(cfg.officer ? 0xd9b24a : 0x443322));
    belt.position.y = 0.72 * s;
    body.add(belt);

    // 头
    var headG = new THREE.Group();
    headG.position.y = 1.5 * s;
    body.add(headG);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 8, 6), skinM);
    headG.add(head);

    if (cfg.helmet === 'turban') {
      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.175 * s, 0.175 * s, 0.09 * s, 8), lambert(0xe8c832));
      band.position.y = 0.09 * s;
      headG.add(band);
      var knot = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 5, 4), lambert(0xe8c832));
      knot.position.set(0.16 * s, 0.1 * s, 0);
      headG.add(knot);
    } else if (cfg.helmet === 'han') {
      var helm = new THREE.Mesh(new THREE.ConeGeometry(0.19 * s, 0.22 * s, 8), armorM);
      helm.position.y = 0.13 * s;
      headG.add(helm);
    } else if (cfg.helmet === 'hero') {
      var helm2 = new THREE.Mesh(new THREE.ConeGeometry(0.19 * s, 0.26 * s, 8), lambert(0xcfd6e0));
      helm2.position.y = 0.13 * s;
      headG.add(helm2);
      if (cfg.plume) {
        var plume = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.42 * s, 5), lambert(cfg.plume));
        plume.position.y = 0.42 * s;
        headG.add(plume);
      }
    } else if (cfg.helmet === 'cap') {
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.18 * s, 0.16 * s, 7), lambert(cfg.capColor || 0x2a4a2a));
      cap.position.y = 0.14 * s;
      headG.add(cap);
    }

    if (cfg.beard) {
      var beard = new THREE.Mesh(new THREE.ConeGeometry(0.09 * s, cfg.beard * s, 6), lambert(0x1a1a1a));
      beard.rotation.x = Math.PI;
      beard.position.set(0, -0.14 * s - cfg.beard * s * 0.4, 0.1 * s);
      headG.add(beard);
    }

    // 手臂（肩部枢轴）
    function makeArm(side) {
      var pivot = new THREE.Group();
      pivot.position.set(0.3 * s * side, 1.32 * s, 0);
      var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.055 * s, 0.55 * s, 5), clothM);
      arm.position.y = -0.26 * s;
      pivot.add(arm);
      var hand = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 5, 4), skinM);
      hand.position.y = -0.55 * s;
      pivot.add(hand);
      body.add(pivot);
      return pivot;
    }
    var armL = makeArm(-1);
    var armR = makeArm(1);

    // 腿（髋部枢轴）
    function makeLeg(side) {
      var pivot = new THREE.Group();
      pivot.position.set(0.12 * s * side, 0.72 * s, 0);
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * s, 0.06 * s, 0.7 * s, 5),
        lambert(cfg.pants || 0x33302a));
      leg.position.y = -0.36 * s;
      pivot.add(leg);
      body.add(pivot);
      return pivot;
    }
    var legL = makeLeg(-1);
    var legR = makeLeg(1);

    // 武器（挂右手）
    var weaponG = null;
    if (cfg.weapon && cfg.weapon !== 'none') {
      weaponG = M.makeWeapon(cfg.weapon);
      weaponG.position.y = -0.55 * s;
      weaponG.scale.setScalar(s);
      armR.add(weaponG);
    }

    // 披风
    if (cfg.cape) {
      var cape = new THREE.Mesh(new THREE.PlaneGeometry(0.55 * s, 0.85 * s),
        new THREE.MeshLambertMaterial({ color: cfg.cape, side: THREE.DoubleSide }));
      cape.position.set(0, 1.05 * s, -0.28 * s);
      cape.rotation.x = 0.18;
      body.add(cape);
    }

    // 背旗
    if (cfg.backFlagChar) {
      var bf = M.makeBackFlag(cfg.backFlagChar, cfg.backFlagColor || '#a02020');
      bf.position.set(0, 0.9 * s, -0.3 * s);
      bf.scale.setScalar(s);
      body.add(bf);
    }

    root.add(M.makeShadow(0.55 * s));

    return {
      root: root, body: body, head: headG,
      armL: armL, armR: armR, legL: legL, legR: legR,
      weapon: weaponG, scale: s
    };
  };

  /* ---------------- 具体人物配置 ---------------- */
  M.makeSoldier = function (side, mobType) {
    var isHan = side === 1;
    var cfg = {
      h: 1.62 + Math.random() * 0.1,
      cloth: isHan ? 0x3a5b9e : 0x7a5c3a,
      armor: isHan ? 0x55688a : 0x6a5030,
      skin: 0xd9a878,
      pants: isHan ? 0x2a3a55 : 0x4a3a25,
      helmet: isHan ? 'han' : 'turban',
      weapon: mobType.weapon
    };
    if (mobType.captain) {
      cfg.h = 1.8;
      cfg.officer = true;
      cfg.cape = isHan ? 0x22448a : 0xb8952a;
    }
    return M.makeHumanoid(cfg);
  };

  M.makeOfficer = function (def) {
    var isHan = def.side === 1;
    var boss = !!def.boss;
    var cfg = {
      h: boss ? 2.0 : 1.88,
      officer: true,
      cloth: isHan ? 0x2a4a8a : (boss ? 0x8a7a20 : 0x7a5528),
      armor: isHan ? 0x8a97b5 : (boss ? 0xb8a030 : 0x8a6a35),
      helmet: def.sorcerer ? 'cap' : (isHan ? 'hero' : 'turban'),
      capColor: 0xb8a030,
      plume: isHan ? 0xdd4444 : 0xe8c832,
      weapon: def.sorcerer ? 'staff' : (boss ? 'glaive' : (Math.random() < 0.5 ? 'sword' : 'spear')),
      cape: boss ? 0xccaa22 : (isHan ? 0x22448a : 0x99771f),
      beard: def.name === '张角' ? 0.35 : 0,
      backFlagChar: def.name.charAt(0),
      backFlagColor: isHan ? '#20408a' : '#a08015'
    };
    return M.makeHumanoid(cfg);
  };

  M.makeHero = function (hero) {
    var cfg = {
      h: 1.9,
      officer: true,
      cloth: hero.color,
      armor: hero.subColor,
      helmet: 'hero',
      plume: hero.plume,
      weapon: hero.weaponType,
      cape: hero.color,
      pants: 0x2a2a30
    };
    if (hero.id === 'guanyu') { cfg.beard = 0.55; cfg.helmet = 'cap'; cfg.capColor = 0x1a5a35; }
    if (hero.id === 'zhangfei') { cfg.beard = 0.3; }
    return M.makeHumanoid(cfg);
  };

  /* ---------------- 马 ---------------- */
  M.makeHorse = function (color) {
    var g = new THREE.Group();
    var bodyM = lambert(color);
    var darkM = lambert(0x332211);

    var horse = new THREE.Group();
    g.add(horse);

    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.45, 8), bodyM);
    trunk.rotation.z = Math.PI / 2;
    trunk.rotation.y = Math.PI / 2;
    trunk.position.y = 1.05;
    horse.add(trunk);

    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.7, 6), bodyM);
    neck.position.set(0, 1.42, 0.72);
    neck.rotation.x = -0.7;
    horse.add(neck);

    var head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.55), bodyM);
    head.position.set(0, 1.68, 1.02);
    head.rotation.x = 0.35;
    horse.add(head);

    var mane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.5), darkM);
    mane.position.set(0, 1.6, 0.68);
    mane.rotation.x = -0.7;
    horse.add(mane);

    var tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.7, 5), darkM);
    tail.position.set(0, 1.05, -0.85);
    tail.rotation.x = 2.6;
    horse.add(tail);

    var saddle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.55), lambert(0x7a2a1a));
    saddle.position.set(0, 1.38, -0.05);
    horse.add(saddle);

    var legs = [];
    [[-0.2, 0.55], [0.2, 0.55], [-0.2, -0.55], [0.2, -0.55]].forEach(function (p) {
      var pivot = new THREE.Group();
      pivot.position.set(p[0], 0.95, p[1]);
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.95, 5), bodyM);
      leg.position.y = -0.48;
      pivot.add(leg);
      horse.add(pivot);
      legs.push(pivot);
    });

    g.add(M.makeShadow(0.9));
    return { root: g, body: horse, legs: legs };
  };

  /* ---------------- 据点 ---------------- */
  M.baseFlagTex = function (side) {
    return canvasTex(128, function (g, s) {
      g.fillStyle = side === 1 ? '#20408a' : '#b89015';
      g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 8;
      g.strokeRect(4, 4, s - 8, s - 8);
      g.fillStyle = '#fff';
      g.font = 'bold 88px "KaiTi","STKaiti","Microsoft YaHei",serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(side === 1 ? '漢' : '黃', s / 2, s / 2 + 6);
    });
  };

  M.makeBase = function (baseDef) {
    var g = new THREE.Group();
    var wallM = lambert(0x6a5a45);
    var size = baseDef.main ? 26 : 17;
    var hw = size / 2;

    // 栅栏墙（南北留门）
    function wallSeg(x, z, w, d) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), wallM);
      m.position.set(x, 1.1, z);
      g.add(m);
      return m;
    }
    var gateW = 5;
    wallSeg(-(hw + gateW) / 2 - gateW / 2 + gateW / 2, hw, hw - gateW / 2, 0.5); // 南墙左
    wallSeg((hw + gateW / 2) / 2 + gateW / 4, hw, hw - gateW / 2, 0.5);          // 南墙右
    wallSeg(-(hw / 2 + gateW / 4), -hw, hw - gateW / 2, 0.5);
    wallSeg((hw / 2 + gateW / 4), -hw, hw - gateW / 2, 0.5);
    wallSeg(-hw, 0, 0.5, size);
    wallSeg(hw, 0, 0.5, size);

    // 四角柱
    [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw]].forEach(function (p) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 3.4, 6), lambert(0x554433));
      post.position.set(p[0], 1.7, p[1]);
      g.add(post);
    });

    // 中央大旗
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 9, 6), lambert(0x554433));
    pole.position.y = 4.5;
    g.add(pole);
    var flagMat = new THREE.MeshLambertMaterial({ map: M.baseFlagTex(baseDef.side), side: THREE.DoubleSide });
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), flagMat);
    flag.position.set(1.7, 7.2, 0);
    g.add(flag);

    // 主阵营帐篷
    if (baseDef.main) {
      for (var i = -1; i <= 1; i++) {
        var tent = new THREE.Mesh(new THREE.ConeGeometry(3, 3.2, 4),
          lambert(baseDef.side === 1 ? 0x33507a : 0x8a7030));
        tent.position.set(i * 8, 1.6, baseDef.side === 1 ? 6 : -6);
        tent.rotation.y = Math.PI / 4;
        g.add(tent);
      }
    }

    g.position.set(baseDef.x, 0, baseDef.z);
    return { root: g, flagMat: flagMat, flag: flag };
  };

  /* ---------------- 罐子（可打碎出道具） ---------------- */
  M.makePot = function () {
    var g = new THREE.Group();
    var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.72, 8), lambert(0x9a7a55));
    pot.position.y = 0.36;
    g.add(pot);
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.12, 8), lambert(0x7a5c3f));
    rim.position.y = 0.72;
    g.add(rim);
    return g;
  };

  /* ---------------- 道具 ---------------- */
  M.makeItem = function (type) {
    var def = DATA.items[type];
    var g = new THREE.Group();
    var mesh;
    if (type === 'baozi' || type === 'bigbaozi') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(type === 'bigbaozi' ? 0.42 : 0.3, 8, 6), lambert(def.color));
      mesh.scale.y = 0.75;
    } else if (type === 'wine') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 0.55, 7), lambert(def.color));
      var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.2, 6), lambert(def.color));
      neck.position.y = 0.36;
      mesh.add(neck);
    } else {
      // 兵法书卷轴
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.62, 8), lambert(def.color));
      mesh.rotation.z = Math.PI / 2;
      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 8), lambert(0xffffff));
      band.rotation.z = 0;
      mesh.add(band);
    }
    mesh.position.y = 0.55;
    g.add(mesh);
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: M.glowTex, color: def.color, transparent: true, opacity: 0.55, depthWrite: false
    }));
    glow.scale.set(1.6, 1.6, 1);
    glow.position.y = 0.55;
    g.add(glow);
    g.userData.spin = mesh;
    return g;
  };

  /* ---------------- 箭矢 ---------------- */
  M.makeArrow = function () {
    var g = new THREE.Group();
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), lambert(0x8a6a3a));
    shaft.rotation.x = Math.PI / 2;
    g.add(shaft);
    var tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), lambert(0xcccccc));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.4;
    g.add(tip);
    return g;
  };

  /* ---------------- 地形 ---------------- */
  M.buildTerrain = function (scene, stage) {
    if (M._terrainBuilt) return;
    M._terrainBuilt = true;
    var size = stage.size;

    // 地面
    var groundTex = canvasTex(1024, function (g, s) {
      g.fillStyle = '#8a7f56';
      g.fillRect(0, 0, s, s);
      // 草地噪点
      for (var i = 0; i < 9000; i++) {
        var x = Math.random() * s, y = Math.random() * s;
        var v = Math.random();
        g.fillStyle = v < 0.5 ? 'rgba(110,120,60,0.25)' : (v < 0.8 ? 'rgba(140,125,80,0.25)' : 'rgba(90,85,55,0.3)');
        g.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 4);
      }
      // 主干道（南北）
      g.strokeStyle = 'rgba(165,145,105,0.75)';
      g.lineCap = 'round';
      g.lineWidth = 60;
      g.beginPath(); g.moveTo(s / 2, s * 0.05); g.quadraticCurveTo(s * 0.45, s / 2, s / 2, s * 0.95); g.stroke();
      g.lineWidth = 44;
      g.beginPath(); g.moveTo(s * 0.1, s * 0.52); g.quadraticCurveTo(s / 2, s * 0.42, s * 0.9, s * 0.52); g.stroke();
      g.beginPath(); g.moveTo(s * 0.22, s * 0.78); g.lineTo(s * 0.28, s * 0.28); g.stroke();
      g.beginPath(); g.moveTo(s * 0.78, s * 0.78); g.lineTo(s * 0.72, s * 0.28); g.stroke();
    });
    groundTex.wrapS = groundTex.wrapT = THREE.ClampToEdgeWrapping;
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({ map: groundTex })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // 场外延伸地面
    var outer = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 4, size * 4),
      lambert(0x6a6242)
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.05;
    scene.add(outer);

    // 周围群山
    var half = size / 2;
    for (var i = 0; i < 36; i++) {
      var ang = (i / 36) * Math.PI * 2;
      var dist = half + 30 + Math.random() * 60;
      var hgt = 30 + Math.random() * 45;
      var mnt = new THREE.Mesh(
        new THREE.ConeGeometry(25 + Math.random() * 30, hgt, 6),
        lambert(0x4a5a3d)
      );
      mnt.position.set(Math.cos(ang) * dist, hgt / 2 - 4, Math.sin(ang) * dist);
      scene.add(mnt);
    }

    // 边界矮墙
    var bWallM = lambert(0x5a4f3a);
    [[0, -half], [0, half]].forEach(function (p) {
      var w = new THREE.Mesh(new THREE.BoxGeometry(size, 3, 2), bWallM);
      w.position.set(p[0], 1.5, p[1]);
      scene.add(w);
    });
    [[-half, 0], [half, 0]].forEach(function (p) {
      var w = new THREE.Mesh(new THREE.BoxGeometry(2, 3, size), bWallM);
      w.position.set(p[0], 1.5, p[1]);
      scene.add(w);
    });

    // 树木与岩石（避开据点与中路）
    function clearOfBases(x, z) {
      if (Math.abs(x) < 14) return false;
      for (var j = 0; j < stage.bases.length; j++) {
        var b = stage.bases[j];
        var dx = x - b.x, dz = z - b.z;
        if (dx * dx + dz * dz < 625) return false;
      }
      return true;
    }
    var trunkM = lambert(0x5a3f28);
    var leafM = lambert(0x3d5a30);
    var leafM2 = lambert(0x4a6a35);
    for (var t = 0; t < 60; t++) {
      var x = (Math.random() - 0.5) * (size - 40);
      var z = (Math.random() - 0.5) * (size - 40);
      if (!clearOfBases(x, z)) continue;
      var tree = new THREE.Group();
      var th = 2.2 + Math.random() * 1.6;
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, th, 5), trunkM);
      trunk.position.y = th / 2;
      tree.add(trunk);
      var crown = new THREE.Mesh(new THREE.ConeGeometry(1.6 + Math.random(), 3 + Math.random() * 2, 6),
        Math.random() < 0.5 ? leafM : leafM2);
      crown.position.y = th + 1.4;
      tree.add(crown);
      tree.position.set(x, 0, z);
      tree.userData.solidR = 0.7;
      scene.add(tree);
    }
    var rockM = lambert(0x7a7568);
    for (var r = 0; r < 26; r++) {
      var rx = (Math.random() - 0.5) * (size - 40);
      var rz = (Math.random() - 0.5) * (size - 40);
      if (!clearOfBases(rx, rz)) continue;
      var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 1.1, 0), rockM);
      rock.position.set(rx, 0.5, rz);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      scene.add(rock);
    }

    // 路边旌旗
    for (var f = 0; f < 14; f++) {
      var fx = (f % 2 === 0 ? -9 : 9);
      var fz = -220 + f * 34;
      var side = fz > 0 ? 1 : 2;
      var fg = new THREE.Group();
      var fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.5, 5), lambert(0x554433));
      fpole.position.y = 2.25;
      fg.add(fpole);
      var fflag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6),
        new THREE.MeshLambertMaterial({ color: side === 1 ? 0x2a4a9a : 0xc8a020, side: THREE.DoubleSide }));
      fflag.position.set(0.58, 3.6, 0);
      fg.add(fflag);
      fg.position.set(fx, 0, fz);
      scene.add(fg);
    }
  };

  return M;
})();
