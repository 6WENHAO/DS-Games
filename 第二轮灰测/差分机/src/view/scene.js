/* =====================================================================
 * scene.js —— 按真实机械尺寸装配整台差分机（全部几何由代码生成）
 *
 * 尺寸链（模数 m = 0.1；所有中心距 = 两轮节圆半径之和，故啮合不穿模）
 *   数位轮   20 齿  R = 1.00      一个数字 = 2 齿 = 36°
 *   小齿轮   10 齿  r = 0.50
 *   列间距   2.70   惰轮竖轴到左右两列轴心各 1.50 = R + r，位于前方 z = +0.654
 *   驱动竖轴 (0, -1.50)   与数位轮啮合（10:20 => 竖轴转 2 圈 = 数位轮转 1 圈）
 *   锁定梳   (1.20, -0.90)
 *   进位竖轴 (-1.30, -0.60)  棘爪伸出后钩住 R=0.70 的棘齿环
 *   相邻列高度错开 0.40 —— 这样惰轮竖轴上下两个齿轮各自只与一侧的数位轮啮合，
 *   彼此不会互相咬住（这是"常啮合 + 狗牙离合"方案能成立的关键）。
 *
 * 传动比（全部由齿数保证，动画不可能与计算脱节）：
 *   曲柄 M 转 90°  -> 加法残齿轮(80齿, m=0.05, 20齿分布在90°) -> A 轴小齿轮(10齿) 转 2 圈
 *                  -> 端面齿轮 1:1 -> 驱动竖轴转 2 圈 -> 数位轮正好转 1 圈
 *   曲柄 M 转 120° -> 进位残齿轮(30齿, 10齿分布在120°) -> 惰轮(11齿) -> C 轴(10齿) 转 1 圈
 *                  -> 端面齿轮 1:1 -> 进位竖轴转 1 圈 -> 螺旋棘爪按位序扫过一遍
 *   曲柄 M -2:1-> 选相凸轮轴 S（每两相一圈）-> 机械地决定本相由哪一半列做源
 * ===================================================================== */
(function (root) {
  'use strict';
  var DE = root.DE || (root.DE = {});
  var TAU = Math.PI * 2;

  var K = {
    MOD: 0.1,
    FIG_TEETH: 20, T_FIG: 0.22,
    PIN_TEETH: 10, T_PIN: 0.20,
    PITCH_Y: 0.95, STAGGER: 0.475, Y0: 0.62,
    COL_DX: 2.7,
    IDLER_DX: 1.35,
    DRIVE_Z: -1.5,                       // 方位 180°，半径 1.50（与数位轮啮合）
    LOCK_AZ: 150, LOCK_R: 1.50,          // 锁定爪（径向进入棘齿环齿隙）
    LOCK_TIP_R: 0.655,                   // 插入到位时爪尖到本列轴心的半径（落在齿隙中部）
    LOCK_TRAVEL: 0.10,
    CARRY_AZ: 225, CARRY_R: 1.35,        // 进位竖轴
    LEVER_AZ: 120, LEVER_R: 1.34, LEVER_ARM: 0.38, LEVER_Y: 0.30,
    BAND_R: 0.82, BAND_H: 0.26, BAND_Y: 0.55,
    RATCHET_ROOT: 0.60, RATCHET_TIP: 0.70, RATCHET_Y: 0.17, RATCHET_T: 0.08,
    PIN_ZERO_R: 0.96, PIN_ZERO_Y: 0.30, PIN_ZERO_H: 0.12,
    DRIVE_SLEEVE_Y: 0.55,
    CAM_BASE: 0.42, CAM_LIFT: 0.17,
    PAWL_HINGE: 0.30, PAWL_ARM: 0.42, PAWL_Y: 0.17,
    PAWL_OUT: 0.20, PAWL_IN: 1.15,      // 铰接角：伸出（钩住棘齿） / 收回（让开）
    ADD_TEETH: 80, ADD_MOD: 0.05,        // 加法残齿轮
    CAR_TEETH: 30, CAR_IDL: 11,          // 进位残齿轮 + 过渡惰轮
    SLEEVE_TRAVEL: 0.14
  };
  K.R_FIG = K.FIG_TEETH * K.MOD / 2;
  K.R_PIN = K.PIN_TEETH * K.MOD / 2;
  K.IDLER_DZ = Math.sqrt(Math.pow(K.R_FIG + K.R_PIN, 2) - K.IDLER_DX * K.IDLER_DX);
  K.LOCK = [K.LOCK_R * Math.sin(Math.PI * K.LOCK_AZ / 180), K.LOCK_R * Math.cos(Math.PI * K.LOCK_AZ / 180)];
  K.CARRY = [K.CARRY_R * Math.sin(Math.PI * K.CARRY_AZ / 180), K.CARRY_R * Math.cos(Math.PI * K.CARRY_AZ / 180)];

  function build(cfg) {
    var THREE = root.THREE, G = DE.geom, M = DE.Machine;
    var nC = cfg.nColumns, nD = cfg.nDigits;

    var model = {
      cfg: cfg, K: K, root: new THREE.Group(), groups: {},
      wheels: [], idlers: [], drive: [], carry: [], lock: [],
      cams: {}, shafts: {}, mats: {}
    };

    /* ---------------- 材质 ---------------- */
    var mats = model.mats;
    mats.brass = new THREE.MeshStandardMaterial({ color: 0xc2a15a, metalness: 0.82, roughness: 0.38 });
    mats.steel = new THREE.MeshStandardMaterial({ color: 0xa8b0ba, metalness: 0.88, roughness: 0.30 });
    mats.iron = new THREE.MeshStandardMaterial({ color: 0x4d545c, metalness: 0.55, roughness: 0.62 });
    mats.wood = new THREE.MeshStandardMaterial({ color: 0x5a4230, metalness: 0.08, roughness: 0.88 });
    mats.warn = new THREE.MeshStandardMaterial({ color: 0xd9502b, metalness: 0.35, roughness: 0.5 });
    mats.pawl = new THREE.MeshStandardMaterial({ color: 0xd8d0ae, metalness: 0.7, roughness: 0.4 });
    mats.band = new THREE.MeshStandardMaterial({ map: G.digitAtlas(), metalness: 0.05, roughness: 0.68 });
    mats.col = [];
    for (var ci = 0; ci < nC; ci++) mats.col.push(mats.brass.clone());

    ['frame', 'wheels', 'idlers', 'drive', 'carry', 'lock', 'trans'].forEach(function (n) {
      var gg = new THREE.Group(); gg.name = n; model.groups[n] = gg; model.root.add(gg);
    });

    /* ---------------- 共享几何 ---------------- */
    var pinGear = G.gearGeometry(K.PIN_TEETH, K.MOD, K.T_PIN, 0.09, 'y');
    var pinGearX = G.gearGeometry(K.PIN_TEETH, K.MOD, K.T_PIN, 0.09, 'x');
    var bandGeo = G.digitBandGeometry(K.BAND_R, K.BAND_H);
    /* 数位轮的各功能面分开建（不合并），既便于着色，也便于干涉检查逐件核对
     * 棘齿环同时承担两个功能：进位棘爪推它一齿；锁定爪径向插入齿隙定位。 */
    var figGearGeo = G.gearGeometry(K.FIG_TEETH, K.MOD, K.T_FIG, 0.16, 'y');
    var hubGeo = G.cyl(0.24, 0.74, 20);
    var ratchetGeo = G.ratchetRingGeometry(10, K.RATCHET_ROOT, K.RATCHET_TIP, K.RATCHET_T);
    var zeroPinGeo = G.box(0.1, K.PIN_ZERO_H, 0.13);
    var sleeveGeo = (function () {
      var items = [{ geometry: G.cyl(0.17, 0.13, 14), matrix: new THREE.Matrix4() }];
      for (var i = 0; i < 4; i++) {
        var a = i * TAU / 4;
        items.push({
          geometry: G.box(0.06, 0.17, 0.06),
          matrix: new THREE.Matrix4().makeTranslation(0.12 * Math.sin(a), -0.05, 0.12 * Math.cos(a))
        });
      }
      return G.mergeGeometries(items);
    })();
    var crownGeo = G.crownGearGeometry(10, K.R_PIN, 0.055, 0.16, 0.34, 0.1);
    var pawlArmGeo = G.mergeGeometries([
      { geometry: G.box(K.PAWL_ARM, 0.06, 0.05), matrix: new THREE.Matrix4().makeTranslation(K.PAWL_ARM / 2, 0, 0) },
      { geometry: G.box(0.1, 0.06, 0.13), matrix: new THREE.Matrix4().makeTranslation(K.PAWL_ARM, 0, 0.04) }
    ]);
    var leverGeo = G.mergeGeometries([
      { geometry: G.box(K.LEVER_ARM, 0.05, 0.06), matrix: new THREE.Matrix4().makeTranslation(K.LEVER_ARM / 2, 0, 0) },
      { geometry: G.box(0.07, 0.05, 0.14), matrix: new THREE.Matrix4().makeTranslation(K.LEVER_ARM, 0, 0.05) },
      { geometry: G.box(0.07, 0.11, 0.06), matrix: new THREE.Matrix4().makeTranslation(-0.03, 0.055, 0) }
    ]);

    var colX = function (c) { return c * K.COL_DX; };
    var wheelY = function (c, k) { return K.Y0 + k * K.PITCH_Y + (c % 2 ? K.STAGGER : 0); };
    var topY = K.Y0 + (nD - 1) * K.PITCH_Y + K.STAGGER + 0.95;
    model.topY = topY; model.wheelY = wheelY; model.colX = colX;
    model.width = (nC - 1) * K.COL_DX;

    /* =================================================================
     * 1. 数位轮列（轮空套在固定轴上，只能被齿轮/棘爪/定位销支配）
     * ================================================================= */
    for (var c = 0; c < nC; c++) {
      var colWheels = [];
      var axle = new THREE.Mesh(G.cyl(0.09, topY + 0.5, 12), mats.steel);
      axle.position.set(colX(c), (topY + 0.5) / 2 - 0.2, 0);
      model.groups.frame.add(axle);
      for (var k = 0; k < nD; k++) {
        var wg = new THREE.Group();
        wg.position.set(colX(c), wheelY(c, k), 0);
        var pieces = {};
        pieces.gear = new THREE.Mesh(figGearGeo, mats.col[c]);
        pieces.hub = new THREE.Mesh(hubGeo, mats.col[c]); pieces.hub.position.y = 0.25;
        pieces.ratchet = new THREE.Mesh(ratchetGeo, mats.steel); pieces.ratchet.position.y = K.RATCHET_Y;
        // 零位销：位于数字 0 的方位（局部 +Z），转过探测器时撞开传动闩 / 拨起警告杆
        pieces.pin = new THREE.Mesh(zeroPinGeo, mats.warn);
        pieces.pin.position.set(0, K.PIN_ZERO_Y, K.PIN_ZERO_R);
        pieces.band = new THREE.Mesh(bandGeo, mats.band);
        pieces.band.position.y = K.BAND_Y;
        Object.keys(pieces).forEach(function (nm) { wg.add(pieces[nm]); });
        model.groups.wheels.add(wg);
        colWheels.push({ group: wg, band: pieces.band, parts: pieces });
        // 读数窗口指针（机架上，正前方 +Z）
        var ptr = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.17, 4), mats.warn);
        ptr.rotation.x = -Math.PI / 2;
        ptr.position.set(colX(c), wheelY(c, k) + K.BAND_Y, K.BAND_R + 0.32);
        model.groups.frame.add(ptr);
      }
      model.wheels.push(colWheels);
    }

    /* =================================================================
     * 2. 列间惰轮组：上下两齿轮常啮合各自一侧的数位轮，
     *    中间狗牙离合套筒被闩锁托住；源轮零位销撞开闩锁后套筒落下，
     *    从此刻起源轮剩下的转角才被传给目标列 —— 传出的量恰好等于源轮读数。
     * ================================================================= */
    for (var g = 0; g < nC - 1; g++) {
      var ix = colX(g) + K.IDLER_DX, iz = K.IDLER_DZ;
      var arr = [];
      var ishaft = new THREE.Mesh(G.cyl(0.075, topY, 10), mats.steel);
      ishaft.position.set(ix, topY / 2 - 0.1, iz);
      model.groups.idlers.add(ishaft);
      for (var k2 = 0; k2 < nD; k2++) {
        var yL = wheelY(g, k2), yR = wheelY(g + 1, k2);
        var gearL = new THREE.Mesh(pinGear, mats.steel); gearL.position.set(ix, yL, iz);
        var gearR = new THREE.Mesh(pinGear, mats.steel); gearR.position.set(ix, yR, iz);
        // 平面 (u,v) = (x,-z)：mesh.rotation.y 即该平面内的逆时针转角
        var alphaL = Math.atan2(-iz, ix - colX(g));
        var alphaR = Math.atan2(-iz, ix - colX(g + 1));
        gearL.userData.base = G.meshBaseAngle(0, alphaL, K.FIG_TEETH, K.PIN_TEETH);
        gearR.userData.base = G.meshBaseAngle(0, alphaR, K.FIG_TEETH, K.PIN_TEETH);
        gearL.rotation.y = gearL.userData.base;
        gearR.rotation.y = gearR.userData.base;
        model.groups.idlers.add(gearL); model.groups.idlers.add(gearR);

        var upperIsR = yR > yL;
        var yMid = (yL + yR) / 2;
        var sleeve = new THREE.Mesh(sleeveGeo, mats.brass);
        sleeve.position.set(ix, yMid + 0.06, iz);
        model.groups.idlers.add(sleeve);

        /* 传动闩锁：不是示意件 —— 它有两根探爪，分别伸到左右两列
         * 数位轮"零位销"的高度与半径上。哪一列作源，就由那一列的零位销
         * 在转到零位的瞬间把闩锁撞开，套筒随即落下接通传动。 */
        var latch = new THREE.Group();
        latch.position.set(ix, yMid, iz);
        var probeLen = (K.R_FIG + K.R_PIN) - K.PIN_ZERO_R;      // 爪尖正好搭在零位销上
        [[colX(g), yL], [colX(g + 1), yR]].forEach(function (tgt) {
          var arm = new THREE.Group();
          // 平面 (u,v) = (x,-z)：rotation.y 即该平面内的逆时针角
          arm.rotation.y = Math.atan2(-(0) - (-iz), tgt[0] - ix);
          arm.position.y = tgt[1] + K.PIN_ZERO_Y - yMid;
          var pr = new THREE.Mesh(G.box(probeLen, 0.05, 0.06), mats.pawl);
          pr.position.x = probeLen / 2;
          arm.add(pr);
          var tip = new THREE.Mesh(G.box(0.07, 0.05, 0.11), mats.pawl);
          tip.position.x = probeLen;
          arm.add(tip);
          latch.add(arm);
        });
        var lhubH = Math.abs(yR - yL) + 0.18;
        var lhub = new THREE.Mesh(G.cyl(0.075, lhubH, 10), mats.pawl);
        lhub.position.y = 0;
        latch.add(lhub);
        model.groups.idlers.add(latch);

        arr.push({
          gearL: gearL, gearR: gearR, sleeve: sleeve, latch: latch,
          yMid: yMid, upperIsR: upperIsR,
          upper: upperIsR ? gearR : gearL, lower: upperIsR ? gearL : gearR
        });
      }
      model.idlers.push({ shaft: ishaft, x: ix, z: iz, items: arr });
    }

    /* =================================================================
     * 3. 每列驱动竖轴：小齿轮与数位轮常啮合，通过狗牙离合接到竖轴上
     * ================================================================= */
    for (var c3 = 0; c3 < nC; c3++) {
      var dx = colX(c3), dz = K.DRIVE_Z;
      var sh = new THREE.Mesh(G.cyl(0.085, topY + 0.35, 10), mats.steel);
      sh.position.set(dx, (topY + 0.35) / 2 - 0.1, dz);
      model.groups.drive.add(sh);
      var pins = [], sleeves = [];
      var alpha3 = Math.atan2(-dz, 0);
      for (var k3 = 0; k3 < nD; k3++) {
        var y3 = wheelY(c3, k3);
        var p = new THREE.Mesh(pinGear, mats.steel);
        p.position.set(dx, y3, dz);
        p.userData.base = G.meshBaseAngle(0, alpha3, K.FIG_TEETH, K.PIN_TEETH);
        p.rotation.y = p.userData.base;
        model.groups.drive.add(p); pins.push(p);
        var s3 = new THREE.Mesh(sleeveGeo, mats.brass);
        s3.position.set(dx, y3 + K.DRIVE_SLEEVE_Y, dz);
        model.groups.drive.add(s3); sleeves.push(s3);
      }
      var crown = new THREE.Mesh(crownGeo, mats.brass);
      crown.position.set(dx, topY + 0.06, dz);
      model.groups.drive.add(crown);
      model.drive.push({ shaft: sh, pinions: pins, sleeves: sleeves, crown: crown, x: dx, z: dz });
    }

    /* =================================================================
     * 4. 进位机构
     *    警告杆 k (k = 0..nD-2)：被数位轮 k 的零位销拨起并闩住
     *    棘爪   k (k = 1..nD-1)：被警告杆 k-1 释放后伸出，推动数位轮 k 一齿
     *    棘爪在进位轴上按位序螺旋排列 => 低位先动，级联进位在一圈内完成
     * ================================================================= */
    var slot = TAU / nD, dur = slot * 0.55;
    for (var c4 = 0; c4 < nC; c4++) {
      var cx = colX(c4) + K.CARRY[0], cz = K.CARRY[1];
      var sh4 = new THREE.Mesh(G.cyl(0.075, topY + 0.35, 10), mats.steel);
      sh4.position.set(cx, (topY + 0.35) / 2 - 0.1, cz);
      model.groups.carry.add(sh4);
      // 棘爪指向数位轮的方位角（平面 u,v = x,-z）
      var beta = Math.atan2(-(0) - (-cz), colX(c4) - cx);
      var pawls = [], levers = [];
      for (var k4 = 1; k4 < nD; k4++) {
        var pg = new THREE.Group();
        pg.position.set(cx, wheelY(c4, k4) + K.PAWL_Y, cz);
        var hinge = new THREE.Group();
        hinge.position.set(K.PAWL_HINGE, 0, 0);
        hinge.add(new THREE.Mesh(pawlArmGeo, mats.pawl));
        pg.add(hinge);
        model.groups.carry.add(pg);
        // 本棘爪对应的进位扇区（由警告杆 k-1 释放）
        pawls.push({ group: pg, hinge: hinge, k: k4, offset: beta - ((k4 - 1) * slot + dur / 2) });
      }
      for (var k5 = 0; k5 < nD - 1; k5++) {
        var lv = new THREE.Group();
        var pivA = Math.PI * K.LEVER_AZ / 180;
        var lux = K.LEVER_R * Math.sin(pivA), luz = K.LEVER_R * Math.cos(pivA);
        lv.position.set(colX(c4) + lux, wheelY(c4, k5) + K.LEVER_Y, luz);
        lv.userData.base = Math.atan2(-(0) - (-luz), (0) - lux);
        lv.rotation.y = lv.userData.base;
        lv.add(new THREE.Mesh(leverGeo, mats.pawl));
        model.groups.carry.add(lv);
        levers.push(lv);
      }
      var crown4 = new THREE.Mesh(crownGeo, mats.brass);
      crown4.position.set(cx, topY + 0.06, cz);
      model.groups.carry.add(crown4);
      // 最高位溢出铃（最高位轮零位销打铃 = 进位溢出）
      var bell = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10, 0, TAU, 0, Math.PI / 2), mats.brass);
      bell.rotation.x = Math.PI;
      bell.position.set(colX(c4) - 0.55, wheelY(c4, nD - 1) + 0.62, -0.95);
      model.groups.carry.add(bell);
      model.carry.push({ shaft: sh4, pawls: pawls, levers: levers, crown: crown4, bell: bell, x: cx, z: cz });
    }

    /* =================================================================
     * 5. 锁定爪梳：径向插入棘齿环齿隙（同时消除累积误差）
     *    整根梳沿自己的径向进退，由锁定凸轮经摇臂驱动。
     * ================================================================= */
    for (var c5 = 0; c5 < nC; c5++) {
      var lx = colX(c5) + K.LOCK[0], lz = K.LOCK[1];
      var dirA = Math.atan2(colX(c5) - lx, 0 - lz);       // 指向本列轴心
      // 爪尖插到棘齿齿隙中部（齿根 0.60 / 齿顶 0.70 之间）
      var tipFar = K.LOCK_R - K.LOCK_TIP_R;               // 爪尖外缘到梳轴的距离
      var reach = tipFar - 0.12;                          // 爪杆长度（端块 0.12 深）
      var items5 = [{ geometry: G.cyl(0.07, topY, 8), matrix: new THREE.Matrix4().makeTranslation(0, topY / 2 - 0.1, 0) }];
      for (var k6 = 0; k6 < nD; k6++) {
        var fy = wheelY(c5, k6) + K.RATCHET_Y;
        var m1 = new THREE.Matrix4().makeRotationY(dirA);
        m1.multiply(new THREE.Matrix4().makeTranslation(0, fy, reach / 2));
        items5.push({ geometry: G.box(0.09, 0.06, reach), matrix: m1 });
        var m2 = new THREE.Matrix4().makeRotationY(dirA);
        m2.multiply(new THREE.Matrix4().makeTranslation(0, fy, reach + 0.06));
        items5.push({ geometry: G.box(0.07, 0.06, 0.12), matrix: m2 });
      }
      var comb = new THREE.Mesh(G.mergeGeometries(items5), mats.pawl);
      comb.position.set(lx, 0, lz);
      model.groups.lock.add(comb);
      // 摇臂：把凸轮的竖直位移变成锁定爪的径向进退
      var rocker = new THREE.Mesh(G.box(0.5, 0.08, 0.1), mats.iron);
      model.groups.lock.add(rocker);
      model.lock.push({
        comb: comb, rocker: rocker, x: lx, z: lz,
        dx: Math.sin(dirA), dz: Math.cos(dirA)          // 径向单位矢量（指向轴心）
      });
    }

    /* =================================================================
     * 6. 传动系
     * ================================================================= */
    var yA = topY + 0.66, zA = K.DRIVE_Z, zC = K.CARRY[1];
    var Rpa = K.ADD_TEETH * K.ADD_MOD / 2;              // 2.0
    var rpa = K.PIN_TEETH * K.ADD_MOD / 2;              // 0.25
    var dzMA = -1.95;
    var dyMA = Math.sqrt(Math.pow(Rpa + rpa, 2) - dzMA * dzMA);
    var yM = yA + dyMA, zM = zA + dzMA;
    var xE1 = model.width + 1.75, xE2 = model.width + 2.45;
    model.shafts.yM = yM; model.shafts.zM = zM; model.shafts.yA = yA;

    model.groups.trans.add(mk(G.cyl(0.11, model.width + 5.4, 12, 'x'), mats.steel, model.width / 2 + 0.7, yM, zM));
    model.groups.trans.add(mk(G.cyl(0.1, model.width + 3.8, 12, 'x'), mats.steel, model.width / 2 + 0.5, yA, zA));
    model.groups.trans.add(mk(G.cyl(0.1, model.width + 4.4, 12, 'x'), mats.steel, model.width / 2 + 0.8, yA, zC));
    function mk(geo, mat, x, y, z) {
      var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m;
    }

    /* 顶部横轴的小齿轮 <-> 各竖轴顶端端面齿轮（1:1） */
    for (var c7 = 0; c7 < nC; c7++) {
      var pa = mk(pinGearX, mats.brass, colX(c7) + K.R_PIN, yA, zA);
      model.groups.trans.add(pa); model.drive[c7].topPinion = pa;
      var pc = mk(pinGearX, mats.brass, colX(c7) + K.CARRY[0] + K.R_PIN, yA, zC);
      model.groups.trans.add(pc); model.carry[c7].topPinion = pc;
    }

    /* 加法残齿轮（80 齿节圆，20 齿分布在 90° 弧上） */
    var alphaMA = Math.atan2(yA - yM, (-zA) - (-zM));
    var wAdd = M.windows.add;
    var partialAdd = mk(G.gearGeometry(K.ADD_TEETH, K.ADD_MOD, 0.22, 0.12, 'x',
      [norm(alphaMA - wAdd[1] * TAU - 0.03), norm(alphaMA - wAdd[0] * TAU + 0.03)]), mats.brass, xE1, yM, zM);
    model.groups.trans.add(partialAdd);
    var pinA = mk(G.gearGeometry(K.PIN_TEETH, K.ADD_MOD, 0.22, 0.07, 'x'), mats.brass, xE1, yA, zA);
    pinA.userData.base = G.meshBaseAngle(0, alphaMA, K.ADD_TEETH, K.PIN_TEETH);
    pinA.rotation.x = pinA.userData.base;
    model.groups.trans.add(pinA);
    model.shafts.partialAdd = partialAdd; model.shafts.pinA = pinA;

    /* 进位残齿轮（30 齿节圆，10 齿分布在 120° 弧上）+ 过渡惰轮 */
    var Rpc = K.CAR_TEETH * K.MOD / 2, Rci = K.CAR_IDL * K.MOD / 2;
    var pJ = G.twoLinkIK(new THREE.Vector3(0, yM, zM), new THREE.Vector3(0, yA, zC),
      Rpc + Rci, Rci + K.R_PIN, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), 1);
    var alphaMJ = Math.atan2(pJ.y - yM, (-pJ.z) - (-zM));
    var wCar = M.windows.carry;
    var partialCarry = mk(G.gearGeometry(K.CAR_TEETH, K.MOD, 0.22, 0.12, 'x',
      [norm(alphaMJ - wCar[1] * TAU - 0.03), norm(alphaMJ - wCar[0] * TAU + 0.03)]), mats.brass, xE2, yM, zM);
    model.groups.trans.add(partialCarry);
    var carryIdler = mk(G.gearGeometry(K.CAR_IDL, K.MOD, 0.2, 0.08, 'x'), mats.steel, xE2, pJ.y, pJ.z);
    carryIdler.userData.base = G.meshBaseAngle(0, alphaMJ, K.CAR_TEETH, K.CAR_IDL);
    carryIdler.rotation.x = carryIdler.userData.base;
    model.groups.trans.add(carryIdler);
    var alphaJC = Math.atan2(yA - pJ.y, (-zC) - (-pJ.z));
    var pinC = mk(pinGearX, mats.brass, xE2, yA, zC);
    pinC.userData.base = G.meshBaseAngle(carryIdler.userData.base, alphaJC, K.CAR_IDL, K.PIN_TEETH);
    pinC.rotation.x = pinC.userData.base;
    model.groups.trans.add(pinC);
    model.shafts.partialCarry = partialCarry;
    model.shafts.carryIdler = carryIdler; model.shafts.pinC = pinC;

    /* 2:1 减速 -> 选相凸轮轴 S */
    var Rr1 = 30 * 0.05 / 2, Rr2 = 60 * 0.05 / 2;
    var yS = yM + Rr1 + Rr2, zS = zM;
    var red1 = mk(G.gearGeometry(30, 0.05, 0.2, 0.11, 'x'), mats.brass, model.width + 3.25, yM, zM);
    var red2 = mk(G.gearGeometry(60, 0.05, 0.2, 0.12, 'x'), mats.brass, model.width + 3.25, yS, zS);
    red2.userData.base = G.meshBaseAngle(0, Math.PI / 2, 30, 60);
    red2.rotation.x = red2.userData.base;
    model.groups.trans.add(red1); model.groups.trans.add(red2);
    model.groups.trans.add(mk(G.cyl(0.1, model.width + 4.2, 12, 'x'), mats.steel, model.width / 2 + 0.9, yS, zS));
    model.shafts.red1 = red1; model.shafts.red2 = red2;
    model.shafts.yS = yS; model.shafts.zS = zS;

    /* 曲柄 */
    var crank = new THREE.Group();
    crank.position.set(model.width + 4.05, yM, zM);
    crank.add(mk(G.box(0.14, 1.15, 0.14), mats.iron, 0, 0.575, 0));
    crank.add(mk(G.cyl(0.11, 0.55, 12, 'x'), mats.wood, 0.32, 1.1, 0));
    crank.add(mk(G.cyl(0.2, 0.22, 14, 'x'), mats.iron, 0, 0, 0));
    model.groups.trans.add(crank);
    model.shafts.crank = crank;

    /* ---------------- 凸轮 + 从动件 + 摆杆 ---------------- */
    function addCam(name, fn, onS, camX, bailZ, dir) {
      var camY = onS ? yS : yM, camZ = onS ? zS : zM;
      var mesh = mk(G.camGeometry(fn, K.CAM_BASE, K.CAM_LIFT, 0.18, 'x', dir), mats.iron, camX, camY, camZ);
      var rod = mk(G.cyl(0.055, 0.95, 8), mats.steel, camX, camY + K.CAM_BASE + 0.475, camZ);
      var bailY0 = camY + K.CAM_BASE + 1.05;
      var bail = mk(G.box(model.width + 3.4, 0.1, 0.13), mats.iron, model.width / 2 - 0.3, bailY0, bailZ);
      var link = new THREE.Mesh(G.cyl(0.05, 1, 6), mats.steel);
      [mesh, rod, bail, link].forEach(function (o) { model.groups.trans.add(o); });
      var cam = {
        name: name, fn: fn, onS: !!onS, dir: dir, mesh: mesh, rod: rod, bail: bail, link: link,
        camX: camX, camY: camY, camZ: camZ, bailZ: bailZ, bailY0: bailY0, rails: [], links: []
      };
      model.cams[name] = cam;
      return cam;
    }
    /* 凸轮轮廓 = 1 - 机构位移，使"凸轮抬高 = 机件抬高"这一条链条处处一致：
     * 所有由摆杆驱动的机件行程幅度统一取 CAM_LIFT，profile=1 时在高位。 */
    function inv(f) { return function (t) { return 1 - f(t); }; }
    function selectorProfile(phaseWanted) {
      return function (tS) {
        var ph = tS < 0.5 ? 0 : 1;
        return ph === phaseWanted ? M.profile.driveClutch((tS % 0.5) * 2) : 0;
      };
    }
    var camLock = addCam('lock', inv(M.profile.lockOut), false, model.width + 0.25, K.LOCK[1], 1);
    var camTrans = addCam('transfer', inv(M.profile.transferBail), false, model.width + 0.8, K.IDLER_DZ + 0.35, 1);
    var camWarn = addCam('warn', M.profile.warnBail, false, model.width + 1.3, K.CARRY[1] - 0.45, 1);
    var camOdd = addCam('driveOdd', inv(selectorProfile(0)), true, model.width + 1.9, K.DRIVE_Z - 0.5, -1);
    var camEven = addCam('driveEven', inv(selectorProfile(1)), true, model.width + 2.6, K.DRIVE_Z - 0.8, -1);
    camOdd.engage = selectorProfile(0);
    camEven.engage = selectorProfile(1);

    function makeRail(x, z, forkYs, forkDir, forkLen, y0, mat) {
      var lo = Math.min.apply(null, forkYs) - 0.15;
      var items = [{ geometry: G.cyl(0.05, -lo + 0.1, 8), matrix: new THREE.Matrix4().makeTranslation(0, (lo + 0.1) / 2, 0) }];
      for (var i = 0; i < forkYs.length; i++) {
        var m = new THREE.Matrix4().makeRotationY(forkDir);
        m.multiply(new THREE.Matrix4().makeTranslation(0, forkYs[i], forkLen / 2));
        items.push({ geometry: G.box(0.26, 0.06, forkLen), matrix: m });
      }
      var mesh = new THREE.Mesh(G.mergeGeometries(items), mat);
      mesh.position.set(x, y0, z);
      return mesh;
    }
    // 传动套筒复位梳（每个惰轮竖轴一根）
    for (var g2 = 0; g2 < nC - 1; g2++) {
      var ys = [];
      for (var kk = 0; kk < nD; kk++) ys.push(model.idlers[g2].items[kk].yMid + 0.06 - camTrans.bailY0);
      var rail = makeRail(model.idlers[g2].x, model.idlers[g2].z + 0.35, ys, Math.PI, 0.35, camTrans.bailY0, mats.iron);
      model.groups.idlers.add(rail);
      camTrans.rails.push(rail);
    }
    // 驱动离合拨叉（奇/偶列各挂在一根摆杆上 = 机械选相）
    for (var c8 = 0; c8 < nC; c8++) {
      var cam8 = (c8 % 2) ? camOdd : camEven;
      var ys8 = [];
      for (var k8 = 0; k8 < nD; k8++) ys8.push(wheelY(c8, k8) + K.DRIVE_SLEEVE_Y - cam8.bailY0);
      var rail8 = makeRail(colX(c8), K.DRIVE_Z - (c8 % 2 ? 0.5 : 0.8), ys8, 0, (c8 % 2 ? 0.5 : 0.8), cam8.bailY0, mats.iron);
      model.groups.drive.add(rail8);
      cam8.rails.push(rail8);
      model.drive[c8].cam = cam8;
      model.drive[c8].rail = rail8;
    }
    // 锁定梳连杆
    for (var c9 = 0; c9 < nC; c9++) {
      var lk = new THREE.Mesh(G.cyl(0.045, 1, 6), mats.steel);
      model.groups.lock.add(lk);
      camLock.links.push(lk);
    }
    // 警告杆复位梳
    for (var c10 = 0; c10 < nC; c10++) {
      var ys10 = [];
      for (var k10 = 0; k10 < nD - 1; k10++) ys10.push(wheelY(c10, k10) + 0.16 - camWarn.bailY0);
      var rail10 = makeRail(colX(c10) - 0.45, K.CARRY[1] - 0.45, ys10, 0, 0.45, camWarn.bailY0, mats.iron);
      model.groups.carry.add(rail10);
      camWarn.rails.push(rail10);
    }

    /* =================================================================
     * 7. 机架
     * ================================================================= */
    var fd = 7.4;
    model.groups.frame.add(mk(G.box(model.width + 4.6, 0.36, fd + 1.2), mats.wood, model.width / 2, -0.38, -1.2));
    model.groups.frame.add(mk(G.box(model.width + 3.4, 0.16, fd), mats.iron, model.width / 2, topY, -1.2));
    [[-1.45, 1.55], [-1.45, -4.0], [model.width + 1.45, 1.55], [model.width + 1.45, -4.0]].forEach(function (p) {
      model.groups.frame.add(mk(G.box(0.22, topY + 0.2, 0.22), mats.iron, p[0], (topY + 0.2) / 2 - 0.2, p[1]));
    });
    [[yM, zM], [yA, zA], [yA, zC], [yS, zS]].forEach(function (p) {
      [-1.35, model.width + 4.55].forEach(function (x) {
        model.groups.trans.add(mk(G.box(0.26, 0.44, 0.32), mats.iron, x, p[0], p[1]));
      });
    });

    function norm(a) { return ((a % TAU) + TAU) % TAU; }

    model.root.position.set(-model.width / 2, -topY * 0.45, 0.6);
    return model;
  }

  DE.scene = { build: build, K: K };
})(typeof window !== 'undefined' ? window : globalThis);
