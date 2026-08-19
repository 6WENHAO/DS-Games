/* =====================================================================
 * sync.js —— 把机械内核的状态"投影"到 3D 变换上
 *
 * 这是整个项目的关键约定：
 *   本文件 **只读** machine 的状态，绝不写；也绝不做任何算术推演。
 *   每一个可动件的位姿都由 (a) 数位轮转角，(b) 曲柄相位，(c) 闩锁状态
 *   经真实齿数比 / 凸轮轮廓换算而来。
 *   因此"动画对不上计算"在结构上是不可能发生的：
 *   页面上读到的数字就是齿轮转角本身。
 * ===================================================================== */
(function (root) {
  'use strict';
  var DE = root.DE || (root.DE = {});
  var TAU = Math.PI * 2;

  function Sync(model, machine) {
    this.m = model; this.mach = machine;
    this.K = model.K;
    this.G = DE.geom;
    this.T = root.THREE;
    this.explode = 0;
    this.highlight = true;
  }

  Sync.prototype.update = function () {
    var m = this.m, mach = this.mach, K = this.K, G = this.G, T = this.T, M = DE.Machine;
    var nC = mach.nCols, nD = mach.nD;
    var t = mach.phaseTime();                       // 曲柄相位 (一相 = 一圈)
    var tS = (mach.crank / TAU / 2) % 1;            // 选相凸轮轴相位 (两相 = 一圈)
    var phase = mach.phaseIndex();
    var ops = mach.currentOps();
    var roles = mach.roles();

    /* ---------- 1. 曲柄 / 主轴 / 残齿轮 / 减速 ---------- */
    var crankA = mach.crank;
    m.shafts.crank.rotation.x = crankA;
    m.shafts.partialAdd.rotation.x = crankA;
    m.shafts.partialCarry.rotation.x = crankA;
    m.shafts.red1.rotation.x = crankA;
    m.shafts.red2.rotation.x = m.shafts.red2.userData.base - crankA / 2;

    /* ---------- 2. 加法链：残齿轮 -> A 轴 -> 端面齿轮 -> 驱动竖轴 ----------
     * 驱动竖轴转 2 圈 = 数位轮转 1 圈（10:20），与内核 addRot 完全对应。 */
    var addRot = M.profile.addRot(t);
    var shaftAdd = -2 * addRot;
    m.shafts.pinA.rotation.x = m.shafts.pinA.userData.base + shaftAdd;

    /* ---------- 3. 进位链：残齿轮 -> 惰轮 -> C 轴 -> 进位竖轴 ---------- */
    var carryRot = M.profile.carryRot(t);
    m.shafts.carryIdler.rotation.x = m.shafts.carryIdler.userData.base - (10 / 11) * carryRot;
    m.shafts.pinC.rotation.x = m.shafts.pinC.userData.base + carryRot;

    /* ---------- 4. 凸轮 / 从动件 / 摆杆 ---------- */
    for (var name in m.cams) {
      var cam = m.cams[name];
      var p = cam.onS ? tS : t;
      var lift = K.CAM_LIFT * cam.fn(p);
      cam.mesh.rotation.x = cam.onS ? (-crankA / 2) : crankA;
      cam.rod.position.y = cam.camY + K.CAM_BASE + lift + 0.475;
      cam.bail.position.y = cam.bailY0 + lift - K.CAM_LIFT;
      G.setRod(cam.link,
        new T.Vector3(cam.camX, cam.camY + K.CAM_BASE + lift + 0.95, cam.camZ),
        new T.Vector3(cam.camX, cam.bail.position.y, cam.bailZ));
      for (var r = 0; r < cam.rails.length; r++) cam.rails[r].position.y = cam.bail.position.y;
      cam.lift = lift;
    }

    /* ---------- 5. 数位轮（唯一的状态源） ---------- */
    for (var c = 0; c < nC; c++) {
      for (var k = 0; k < nD; k++) {
        m.wheels[c][k].group.rotation.y = mach.wheels[c][k].a;
      }
      if (this.highlight) {
        var mat = m.mats.col[c];
        if (roles[c] === 1) mat.emissive.setHex(0x4a2a00);       // 源列
        else if (roles[c] === 2) mat.emissive.setHex(0x002a3a);  // 目标列
        else mat.emissive.setHex(0x000000);
      } else {
        m.mats.col[c].emissive.setHex(0x000000);
      }
    }

    /* ---------- 6. 列间惰轮：上下两齿轮各自与自己那一侧的数位轮常啮合 ----------
     * 所以它们的转角完全由数位轮转角决定；离合套筒的落下与否
     * 决定了两个齿轮是否被强制同步 —— 这正是"加了多少"的物理原因。 */
    for (var g = 0; g < nC - 1; g++) {
      var gap = m.idlers[g];
      for (var k2 = 0; k2 < nD; k2++) {
        var it = gap.items[k2];
        var aL = mach.wheels[g][k2].a, aR = mach.wheels[g + 1][k2].a;
        it.gearL.rotation.y = it.gearL.userData.base - 2 * aL;
        it.gearR.rotation.y = it.gearR.userData.base - 2 * aR;
        // 找出本相里这一对是否在做加法，以及套筒是否已落下
        var open = false, isActive = false;
        for (var oi = 0; oi < ops.length; oi++) {
          if (ops[oi].gap === g) { isActive = true; open = mach.open[phase][oi][k2]; }
        }
        var upY = it.yMid + 0.06;
        it.sleeve.position.y = open ? upY - K.SLEEVE_TRAVEL : upY;
        it.sleeve.rotation.y = it.upper.rotation.y;
        // 闩锁：被源轮零位销撞开后让开
        it.latch.rotation.y = open ? 0.55 : 0;
        it.latch.visible = isActive;
      }
    }

    /* ---------- 7. 驱动竖轴 + 离合 ---------- */
    for (var c3 = 0; c3 < nC; c3++) {
      var dr = m.drive[c3];
      var engage = dr.cam.engage(tS);
      dr.crown.rotation.y = shaftAdd;
      dr.topPinion.rotation.x = shaftAdd;
      for (var k3 = 0; k3 < nD; k3++) {
        // 小齿轮与数位轮常啮合 => 转角由轮决定（未合离合时轴在其中空转）
        dr.pinions[k3].rotation.y = dr.pinions[k3].userData.base - 2 * mach.wheels[c3][k3].a;
        dr.sleeves[k3].position.y = m.wheelY(c3, k3) + K.DRIVE_SLEEVE_Y - K.CAM_LIFT * engage;
        dr.sleeves[k3].rotation.y = shaftAdd;
      }
    }

    /* ---------- 8. 进位机构：棘爪按螺旋位序扫过，警告杆决定是否伸出 ---------- */
    var slot = TAU / nD, dur = slot * 0.55;
    for (var c4 = 0; c4 < nC; c4++) {
      var cr = m.carry[c4];
      cr.crown.rotation.y = carryRot;
      cr.topPinion.rotation.x = carryRot;
      for (var pi = 0; pi < cr.pawls.length; pi++) {
        var pw = cr.pawls[pi];
        pw.group.rotation.y = carryRot + pw.offset;
        var warned = mach.wheels[c4][pw.k - 1].warn;
        pw.hinge.rotation.y = warned ? K.PAWL_OUT : K.PAWL_IN;
      }
      for (var li = 0; li < cr.levers.length; li++) {
        var lv = cr.levers[li];
        lv.rotation.y = lv.userData.base + (mach.wheels[c4][li].warn ? 0.42 : 0);
      }
      // 溢出铃：最高位进位丢失时被打响
      cr.bell.scale.setScalar(mach.overflow ? 1.15 : 1.0);
    }
    // 警告杆复位梳：做一次切向拨动
    var warnJab = M.profile.warnBail(t);
    for (var rw = 0; rw < m.cams.warn.rails.length; rw++) {
      m.cams.warn.rails[rw].rotation.y = 0.18 * warnJab;
    }

    /* ---------- 9. 锁定爪梳：径向进退（凸轮 -> 摇臂 -> 梳） ---------- */
    var lockOut = M.profile.lockOut(t);
    for (var c5 = 0; c5 < nC; c5++) {
      var lc = m.lock[c5];
      var back = K.LOCK_TRAVEL * lockOut;          // 退出量
      lc.comb.position.set(lc.x - lc.dx * back, 0, lc.z - lc.dz * back + this._ez(c5));
      var bailY = m.cams.lock.bail.position.y;
      lc.rocker.position.set(lc.comb.position.x, bailY + 0.25, lc.comb.position.z);
      lc.rocker.rotation.y = Math.atan2(lc.dx, lc.dz);
      lc.rocker.rotation.z = -0.5 * lockOut;
      var lk = m.cams.lock.links[c5];
      G.setRod(lk,
        new T.Vector3(lc.x, bailY, m.cams.lock.bailZ),
        new T.Vector3(lc.rocker.position.x, bailY + 0.25, lc.rocker.position.z));
    }

    /* ---------- 10. 分解视图（沿各自机构的径向外移，便于观察内部） ---------- */
    var ex = this.explode;
    for (var g3 = 0; g3 < nC - 1; g3++) {
      var gp = m.idlers[g3];
      var s = ex * 1.5;
      gp.shaft.position.z = gp.z + s;
      for (var k4 = 0; k4 < nD; k4++) {
        var it2 = gp.items[k4];
        it2.gearL.position.z = gp.z + s; it2.gearR.position.z = gp.z + s;
        it2.sleeve.position.z = gp.z + s; it2.latch.position.z = gp.z + s;
      }
      if (m.cams.transfer.rails[g3]) m.cams.transfer.rails[g3].position.z = gp.z + 0.35 + s;
    }
    for (var c6 = 0; c6 < nC; c6++) {
      var d2 = m.drive[c6], off = -ex * 1.5;
      d2.shaft.position.z = d2.z + off;
      d2.crown.position.z = d2.z + off;
      for (var k5 = 0; k5 < nD; k5++) {
        d2.pinions[k5].position.z = d2.z + off;
        d2.sleeves[k5].position.z = d2.z + off;
      }
      var c2 = m.carry[c6];
      c2.shaft.position.z = c2.z + off;
      c2.crown.position.z = c2.z + off;
      for (var p2 = 0; p2 < c2.pawls.length; p2++) c2.pawls[p2].group.position.z = c2.z + off;
    }
  };

  /* 分解视图里锁定爪梳的额外偏移 */
  Sync.prototype._ez = function () { return -this.explode * 1.0; };

  /* 图层显示控制 */
  Sync.prototype.setLayer = function (name, on) {
    if (this.m.groups[name]) this.m.groups[name].visible = on;
  };
  /* 只看某一列（-1 = 全部） */
  Sync.prototype.focusColumn = function (col) {
    var m = this.m, nC = this.mach.nCols;
    for (var c = 0; c < nC; c++) {
      var on = (col < 0 || col === c);
      for (var k = 0; k < this.mach.nD; k++) m.wheels[c][k].group.visible = on;
      m.drive[c].shaft.visible = on; m.drive[c].crown.visible = on;
      m.drive[c].pinions.forEach(function (p) { p.visible = on; });
      m.drive[c].sleeves.forEach(function (p) { p.visible = on; });
      m.carry[c].shaft.visible = on; m.carry[c].crown.visible = on;
      m.carry[c].pawls.forEach(function (p) { p.group.visible = on; });
      m.carry[c].levers.forEach(function (p) { p.visible = on; });
      m.lock[c].comb.visible = on;
    }
  };

  DE.Sync = Sync;
})(typeof window !== 'undefined' ? window : globalThis);
