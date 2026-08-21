/* =========================================================================
 * sim.js — 核爆流体/粒子物理仿真（CPU，纯数值，可在 node 下无头运行自检）
 *
 * 物理骨架
 * ---------------------------------------------------------------------
 * ① 火球自相似膨胀期 (t < tDecouple)
 *      粒子位置被 Sedov 解「牵引」：p = C + dir·q·R_fb(t)，
 *      速度取解析导数，交接到自由动力学时连续。
 * ② 浮力热泡 (thermal) 常微分方程组 —— 决定蘑菇云上升与停滞高度
 *      dz/dt = w
 *      dRc/dt = α w                                （经典夹卷假设 α≈0.25）
 *      dw/dt  = g·Δθ/θ_env − w·(3αw/Rc)            （动量被夹卷空气稀释）
 *      dΔθ/dt = −Δθ·(3αw/Rc) − (dθ_env/dz)·w       （位温超出被稀释 + 环境层结）
 *   平流层里 dθ_env/dz 陡增 → Δθ 迅速归零 → 云自然在对流层顶铺开成砧状。
 * ③ 涡环诱导速度：把环面简化为子午面内一对镜像 Lamb–Oseen 涡
 *      v_θ = Γ/(2πs)·(1−exp(−s²/rc²))
 *   一对反向涡互相诱导即产生上升（等价于涡环自诱导），环内侧向上的射流
 *   自然把地面灰尘抽成「茎」。Γ 由涡环自诱导速度反解：Γ = 4πR·w/(ln(8R/a)−0.25)
 * ④ 激波致质点速度：Friedlander 波形 u = u₂(R)(1−φ)e^(−φ)，φ=(t−t_a)/t₊
 *   φ>1 自动给出负压相（回吸），这正是「余风」把尘土带向爆心并抽升的成因。
 * ⑤ 拖曳用指数松弛 v += (u_air − v)(1−e^(−dt/τ))：对任意 dt 无条件稳定，
 *   支持后期把时间步放大到秒级仍不炸。
 * ========================================================================= */
(function (root) {
  'use strict';
  var NK = root.NUKE = root.NUKE || {};
  var U = NK.util, P = NK.physics;

  var STRIDE = 12;
  var IX = 0, IY = 1, IZ = 2, IVX = 3, IVY = 4, IVZ = 5,
    IT = 6, IAGE = 7, ILIFE = 8, ISIZE = 9, ISEED = 10, IKIND = 11;

  var K_FIREBALL = 0, K_CAP = 1, K_STEM = 2, K_DUST = 3, K_DEBRIS = 4,
    K_SMOKE = 5, K_FIRE = 6;

  /* ---------------- 城市结构分类 ----------------
   * 抗力用「倒塌超压阈值」表达（psi），对标常用的建筑易损性分级：
   *   0 木/轻质（1945 年式民居）    3–5 psi 完全破坏（2 psi 重损、1 psi 轻损）
   *   1 砖石承重墙                  4–7
   *   2 钢筋混凝土多层              8–12
   *   3 钢框架高层                  10–16（但幕墙 2–3 psi 就被剥离）
   * 热辐射点燃阈值 (cal/cm²) 亦按材料给出。                        */
  var CLS = [
    { name: '木/轻质', dp: [3.0, 5.0], clad: 0.30, ign: 9, hmax: 14 },
    { name: '砖石', dp: [4.0, 7.0], clad: 0.40, ign: 14, hmax: 30 },
    { name: '钢混多层', dp: [8.0, 12.0], clad: 0.28, ign: 22, hmax: 70 },
    { name: '钢框架高层', dp: [10.0, 16.0], clad: 0.20, ign: 26, hmax: 320 }
  ];
  // 破坏状态
  var ST_OK = 0, ST_GLASS = 1, ST_CLAD = 2, ST_PARTIAL = 3, ST_COLLAPSE = 4, ST_SCOUR = 5;
  var ALPHA = 0.14;          // 夹卷系数（上升期；经典浮力热泡 0.2~0.3，
                             //   核爆云上升由初始环流主导，实测云盘半径主要来自
                             //   停滞后的水平铺展而非上升期夹卷，故取偏小值）
  var FHEAT = 0.70;          // 残余热能分额（能量分配：~50% 冲击波、35% 热辐射，
                             //   其中激波耗散最终又有相当部分回到火球区加热空气）
  var CAL_BUOY = 1.0;        // 浮力通量标定系数（见 README「标定」）
  var S_FEED = 0.35;         // 尘茎输运的边界层湿空气占夹卷量的比例 β
  var R_EVAP = 900;          // 凝结水蒸发折损尺度 (m)
  var FROUDE = 0.72;         // 中性侵入重力流的 Froude 数（铺展前沿速度）
  var W_STALL = 12.0;        // 铺展接管的上升速度尺度 (m/s)：w≪此值时以砧状铺展为主
                             //   （真实砧状顶在云仍缓慢上升时就已开始铺开）
  var Z_BL = 1200;           // 混合层顶（中性层结）
  var LCL = 800;             // 抬升凝结高度
  var CP = 1005;             // 定压比热
  var ADIABAT = P.K.G / CP;  // 干绝热率 ≈ 0.00976 K/m

  var Sim = NK.Sim = function (opts) {
    opts = opts || {};
    this.capacity = opts.capacity || 45000;
    this.noise = new U.NoiseField(48, 7771);
    this.seed = opts.seed || 20250820;
    this.rand = U.rng(this.seed);
    this._n3 = [0, 0, 0];
    this.configure(opts);
  };

  Sim.tune = function (k, v) {
    if (k === 'ALPHA') { ALPHA = v; }
    else if (k === 'CAL_BUOY') { CAL_BUOY = v; }
    else if (k === 'S_FEED') { S_FEED = v; }
    else if (k === 'R_EVAP') { R_EVAP = v; }
    else if (k === 'FHEAT') { FHEAT = v; }
    return { ALPHA: ALPHA, CAL_BUOY: CAL_BUOY, S_FEED: S_FEED, FHEAT: FHEAT, R_EVAP: R_EVAP };
  };

  Sim.KIND = {
    FIREBALL: K_FIREBALL, CAP: K_CAP, STEM: K_STEM, DUST: K_DUST,
    DEBRIS: K_DEBRIS, SMOKE: K_SMOKE, FIRE: K_FIRE
  };
  Sim.CLS = CLS;
  Sim.STATE = {
    OK: ST_OK, GLASS: ST_GLASS, CLAD: ST_CLAD,
    PARTIAL: ST_PARTIAL, COLLAPSE: ST_COLLAPSE, SCOUR: ST_SCOUR
  };
  Sim.STATE_NAME = ['完好', '玻璃破碎', '外墙剥离', '部分倒塌', '完全倒塌', '清扫至基础'];
  Sim.STRIDE = STRIDE;
  Sim.IDX = {
    X: IX, Y: IY, Z: IZ, VX: IVX, VY: IVY, VZ: IVZ,
    T: IT, AGE: IAGE, LIFE: ILIFE, SIZE: ISIZE, SEED: ISEED, KIND: IKIND
  };

  /** 重新设定参数（当量/爆高/湿度/风）并复位 */
  Sim.prototype.configure = function (opts) {
    var o = this.opts = this.opts || {};
    if (opts.W != null) { o.W = opts.W; }
    if (opts.hob != null) { o.hob = opts.hob; }
    if (opts.humidity != null) { o.humidity = opts.humidity; }
    if (opts.wind != null) { o.wind = opts.wind; }
    if (opts.shear != null) { o.shear = opts.shear; }
    if (opts.dirt != null) { o.dirt = opts.dirt; }
    if (opts.cityScale != null) { o.cityScale = opts.cityScale; }
    if (opts.era != null) { o.era = opts.era; }
    if (opts.fires != null) { o.fires = opts.fires; }
    if (o.W == null) { o.W = 20; }
    if (o.hob == null) { o.hob = 300; }
    if (o.humidity == null) { o.humidity = 0.6; }
    if (o.wind == null) { o.wind = 6; }         // 地面风速 m/s (+x)
    if (o.shear == null) { o.shear = 1.6; }     // 风切变 (m/s)/km
    if (o.dirt == null) { o.dirt = 1; }         // 地面耦合倍率
    if (o.cityScale == null) { o.cityScale = 1; }   // 城市规模倍率
    if (o.era == null) { o.era = 1; }               // 0=1945木构 1=混合 2=现代钢混
    if (o.fires == null) { o.fires = 1; }           // 火灾开关
    this.reset();
    return this;
  };

  Sim.prototype.reset = function () {
    var o = this.opts;
    // 随机数发生器一并复位 ⇒ 重放/时间轴回退可严格复现同一帧
    this.rand = U.rng(this.seed);
    var cap = this.capacity;
    if (!this.data || this.data.length !== cap * STRIDE) {
      this.data = new Float32Array(cap * STRIDE);
      this.alive = new Uint8Array(cap);
    } else {
      this.data.fill(0); this.alive.fill(0);
    }
    this.count = 0;      // 高水位（已用过的最大下标+1）
    this.freeList = [];
    this.liveCount = 0;
    // 分类计数必须一起清零：否则重放/改参数后配额检查会立刻判定超额，
    // 尘茎与尘幕将完全不再发射（曾经的真实 bug，由无头自检捕获）
    if (this._kc) { this._kc.fill(0); }
    this._fbRetired = false;

    // —— 火球是否接地：决定「脏」程度（尘柱/茎/落尘） ——
    var Rfb0 = P.fireballMaxR(o.W);
    var touch = U.clamp(1 - o.hob / (1.25 * Rfb0), 0, 1);
    // groundCoupling：火球是否真的舔到地面 —— 决定弹坑、玻璃化、放射性落尘
    this.groundCoupling = U.clamp(touch * o.dirt, 0, 1);
    // dustLift：激波沿地面扫过本身就会掀起尘土层，即使火球从未触地
    //   （空爆同样有明显的尘柱与尘茎，例如广岛照片中近地那层浓尘）
    this.dustLift = U.clamp((0.30 + 0.70 * touch) * o.dirt, 0, 1.5);
    // 地面反射对有效当量的放大：接地爆 ~1.8，高空爆 1.0
    var gf = 1 + 0.8 * this.groundCoupling;
    this.blast = new P.Blast(o.W, { groundFactor: gf, hob: o.hob });
    this.Rfb = this.blast.Rfb;
    this.t2max = P.t2Max(o.W);
    this.tDecouple = Math.max(6 * this.t2max, 0.25);
    this.tStab = P.stabilizeTime(o.W);
    this.craterR = P.craterR(o.W) * this.groundCoupling;
    this.craterD = P.craterD(o.W) * this.groundCoupling;

    // —— 热泡 ODE 初态 ——
    this.t = 0;
    var z0 = Math.max(o.hob, 0.35 * this.Rfb);
    this.cz = z0;                       // 云团中心高度
    this.cx = 0;                        // 云团中心（顺风漂移）
    this.Rc = this.Rfb;                 // 云团半径
    this.w = 0;                         // 上升速度
    this.thetaEnv0 = P.atmTheta(z0);
    this.F = 0; this.F0 = 1;            // 浮力通量 m^4/s^2，在 tDecouple 时刻注入
    this.dtheta = 0;                    // 位温超出（由 F 换算，仅用于显示/耦合）
    this.injected = false;
    this.cloudTop = z0 + this.Rfb;
    this.cloudBottom = Math.max(0, z0 - this.Rfb);
    this.gamma = 0;                     // 涡环环量
    this.Rring = 0.62 * this.Rc;
    this.Rdisk = this.Rfb;              // 砧状云盘半径（重力流铺展）
    this.Vstab = 0;                     // 停滞时刻云体积（铺展过程中守恒）
    this.Hdisk = 2 * this.Rfb;          // 云盘厚度（停滞时锁定后守恒）
    this.h0 = 0;                        // 锁定的云盘厚度
    this.wPeak = 0;                     // 上升速度峰值（停滞判据）
    this.dRdisk = 0;                    // 铺展前沿速度

    // 云轴历史（用于风切变造成的倾斜轴）
    this.axZ = [z0]; this.axX = [0];

    // 视觉/统计
    this.flash = 0;
    this.emitAccum = { stem: 0, dust: 0, cap: 0 };
    this.stats = { cloudTop: this.cloudTop, cloudR: this.Rc, live: 0 };

    this.sStrat = 1; this.cSpread = 1;
    this._calibrateStrat();
    this._initBuildings();
    this._spawnFireball();
    return this;
  };

  /* ---------------------------------------------------------------- 粒子池 */
  Sim.prototype._alloc = function () {
    if (this.freeList.length) { return this.freeList.pop(); }
    if (this.count < this.capacity) { return this.count++; }
    return -1;
  };
  Sim.prototype._kill = function (i) {
    if (!this.alive[i]) { return; }
    this.alive[i] = 0; this.liveCount--;
    if (this._kc) { this._kc[this.data[i * STRIDE + IKIND] | 0]--; }
    this.data[i * STRIDE + ILIFE] = 0;
    this.freeList.push(i);
  };
  Sim.prototype._spawn = function (kind, x, y, z, vx, vy, vz, T, size, life) {
    var i = this._alloc();
    if (i < 0) { return -1; }
    var d = this.data, b = i * STRIDE;
    d[b + IX] = x; d[b + IY] = y; d[b + IZ] = z;
    d[b + IVX] = vx; d[b + IVY] = vy; d[b + IVZ] = vz;
    d[b + IT] = T; d[b + IAGE] = 0; d[b + ILIFE] = life;
    d[b + ISIZE] = size; d[b + ISEED] = this.rand(); d[b + IKIND] = kind;
    this.alive[i] = 1; this.liveCount++;
    if (!this._kc) { this._kc = new Int32Array(8); }
    this._kc[kind]++;
    return i;
  };

  /** 火球初始装填：q=归一化半径，dir=单位方向，位置由 R_fb(t) 牵引 */
  Sim.prototype._spawnFireball = function () {
    var n = Math.floor(this.capacity * 0.32);
    var tmp = [0, 0, 0], rand = this.rand;
    var hob = this.opts.hob;
    this.fbList = new Int32Array(n);
    this.fbQ = new Float32Array(n);
    this.fbDir = new Float32Array(n * 3);
    var T0 = this.blast.fireballT(1e-5);
    for (var k = 0; k < n; k++) {
      var len = U.sampleBall(rand, tmp);
      var q = Math.pow(rand(), 0.42);        // 偏向外壳（发光壳层更亮）
      var inv = 1 / Math.max(len, 1e-6);
      var dx = tmp[0] * inv, dy = tmp[1] * inv, dz = tmp[2] * inv;
      var i = this._spawn(K_FIREBALL, 0, hob, 0, 0, 0, 0, T0,
        this.Rfb * (0.10 + 0.10 * rand()), 1e9);
      this.fbList[k] = i; this.fbQ[k] = q;
      this.fbDir[k * 3] = dx; this.fbDir[k * 3 + 1] = dy; this.fbDir[k * 3 + 2] = dz;
    }
    this.fbCount = n;
  };

  /* ---------------------------------------------------------------- 建筑（刚体倒塌） */
  /* ---------------------------------------------------------------- 城市生成 */
  /**
   * 街区路网式城市：主干网格 → 街区内「沿街周边式」排布 → 市中心塔楼群。
   * 结构分类按区位与高度决定（核心区钢框架高层、中环钢混、外围砖石/木构），
   * 「建造年代」整体平移这个分布 —— 同一当量下，1945 年式木构城市与现代钢混
   * 城市的毁伤半径能差两三倍，这是核武器效应里最显著的差异之一。
   */
  Sim.prototype._initBuildings = function () {
    var rand = this.rand, o = this.opts, bl = this.blast;
    var R5 = bl.radiusForPsi(5);
    // 真实城市不会因当量变大而变大：一座特大城市的半径也就 10–15 km。
    // 若按 3×R5 无上限外推，兆吨级会得到 30 km 半径、1 栋/km² 的荒谬密度
    // （真实城市约 10²–10³ 栋/km²），画面上根本看不到建筑。
    // 封顶后兆吨级的整座城市都落在毁伤圈内 —— 这正是事实。
    var Rcity = U.clamp(Math.min(3.0 * R5, 14000) * o.cityScale, 380, 22000);
    var gridAng = rand() * Math.PI * 0.5;
    // 街区尺度随城市规模缓慢增大（否则兆吨级会需要十万个街区）
    var street = (20 + rand() * 10) * U.clamp(Math.pow(Rcity / 2400, 0.35), 1, 3.2);
    var block = (86 + rand() * 66) * U.clamp(Math.pow(Rcity / 2400, 0.35), 1, 3.2);
    var step = block + street;
    // 街区数受 nb≤90 限制，必须保证网格能覆盖到整个城区半径，
    // 否则大当量下城区外圈会是一片空地（曾经的真实 bug）
    var nbMax = 90;
    if (step * nbMax < Rcity) {
      var kUp = Rcity / (step * nbMax);
      step *= kUp; block *= kUp; street *= kUp;
    }
    var hs = U.clamp(Math.pow(Rcity / 2400, 0.25), 0.85, 1.9);   // 层高尺度微调
    this.cityR = Rcity; this.cityGridAng = gridAng;
    this.cityStreet = street; this.cityBlock = block; this.cityStep = step;

    var ca = Math.cos(gridAng), sa = Math.sin(gridAng);
    var B = this.buildings = [];
    // 建筑上限随城区尺度放宽。实例化立方体很便宜（1 万栋 ≈ 3 万实例），
    // 而密度太低会让大城市在画面里「空得看不出是城市」：14 km 半径下
    // 6500 栋只有 8.7 栋/km²，相机前方 1.5 km 锥体内仅十余栋。
    var NMAX = Math.floor(U.clamp(3200 * o.cityScale * Math.pow(Rcity / 5300, 1.2),
      500, 11000));
    var nb = Math.min(Math.ceil(Rcity / step), nbMax);
    var eraShift = [-1.25, 0, 1.05][o.era | 0] || 0;
    var vis = { visibility: 20000 };

    function push(x, z, w, d, h, ang, cls, slender) {
      if (B.length >= NMAX) { return; }
      var c = CLS[cls];
      h = Math.min(h, c.hmax * (slender ? 3 : 1.6));
      // 细长结构（烟囱、铁塔、水塔）不适用建筑抗力：它们由动压弯折/倾覆，
      // 实测在 2–3 psi 就倒，是核爆现场最典型的「径向倒伏」标志物
      var dpR = slender ? [1.2, 3.0] : c.dp;
      B.push({
        x: x, z: z, r: Math.sqrt(x * x + z * z),
        w: w, d: d, h0: h, h: h, ang: ang, cls: cls, slender: slender ? 1 : 0,
        tierH: 0, tierW: 0, tierD: 0,
        seed: rand(),
        strength: dpR[0] + (dpR[1] - dpR[0]) * rand(),
        cladDp: c.clad * (dpR[0] + dpR[1]) * 0.5,
        shield: 1, load: 0, dpPsi: 0, qPsi: 0, fluence: 0, arrival: 0,
        state: ST_OK, glass: 0, clad: 0, char: 0,
        collapse: 0, collT: 1, collT0: 0, partFrac: 0, rubbleH: 0, lean: 0,
        topAng: 0, toppleVel: 0, toppling: 0, hit: 0,
        fireT: -1, burning: 0, emitAcc: 0, fireAcc: 0, dustAcc: 0
      });
    }

    /* —— 先收集候选街区并按半径排序 ——
     * 若直接双重循环从外角开始填，配额会在抵达市中心前耗尽（市中心反而空白）。
     * 排序后再用一个全局密度因子把总量压到 NMAX，可同时保证「核心必建」
     * 与「密度由内向外递减」。                                            */
    var blocks = [];
    for (var bi = -nb; bi <= nb; bi++) {
      for (var bj = -nb; bj <= nb; bj++) {
        var lx = bi * step, lz = bj * step;   // 与地面路网严格对齐
        var wx = lx * ca - lz * sa, wz = lx * sa + lz * ca;
        var r = Math.sqrt(wx * wx + wz * wz);
        if (r > Rcity) { continue; }
        var q = r / Rcity;
        if (rand() > 0.08 + 0.92 * U.smoothstep(1.05, 0.60, q)) { continue; }
        var core = U.smoothstep(0.32, 0.02, q);
        var nominal = core > 0.55 ? 1.6 : (q < 0.58 ? 5.0 : 6.0);
        blocks.push({ x: wx, z: wz, r: r, q: q, core: core, nom: nominal });
      }
    }
    blocks.sort(function (u, v) { return u.r - v.r; });
    var totNom = 0;
    for (var bk = 0; bk < blocks.length; bk++) { totNom += blocks[bk].nom; }
    var dens = U.clamp(NMAX / Math.max(totNom, 1), 0.03, 1);

    for (bk = 0; bk < blocks.length && B.length < NMAX; bk++) {
      var blk = blocks[bk];
      var bAng = gridAng + (rand() - 0.5) * 0.06;
      var want = blk.nom * dens;
      var cntB = Math.floor(want) + (rand() < (want - Math.floor(want)) ? 1 : 0);
      if (blk.core > 0.55) { cntB = Math.max(cntB, 1); }        // 核心区必建
      if (cntB < 1) { continue; }

      if (blk.core > 0.55 && rand() < 0.58) {
        /* —— 核心商务区：街区中央 1–2 座塔楼，带上部退台 —— */
        var nt = Math.min(cntB, rand() < 0.45 ? 2 : 1);
        for (var k = 0; k < nt; k++) {
          var tw = block * (nt === 1 ? 0.34 + rand() * 0.24 : 0.22 + rand() * 0.14);
          var td = tw * (0.7 + rand() * 0.6);
          var th = (55 + Math.pow(rand(), 1.7) * 210) * hs * (0.55 + 0.75 * blk.core);
          var cls = U.clamp(Math.round(2.7 + eraShift * 0.5 + (rand() - 0.5) * 0.8), 0, 3) | 0;
          var ox = (rand() - 0.5) * block * (nt === 1 ? 0.18 : 0.52);
          var oz = (rand() - 0.5) * block * 0.3;
          push(blk.x + ox * ca - oz * sa, blk.z + ox * sa + oz * ca, tw, td, th, bAng, cls, 0);
          var bb = B[B.length - 1];
          if (bb && bb.h0 > 85 * hs && rand() < 0.7) {
            bb.tierH = bb.h0 * (0.16 + rand() * 0.22);
            bb.tierW = tw * (0.48 + rand() * 0.28);
            bb.tierD = td * (0.48 + rand() * 0.28);
          }
        }
      } else {
        /* —— 中环/外围：沿街周边式排布（临街面朝道路，街区内部为院落）—— */
        var mid = blk.q < 0.58;
        for (var m = 0; m < cntB && B.length < NMAX; m++) {
          var e = (rand() * 4) | 0;
          var along = (rand() - 0.5) * 0.86;
          var wLen = block * (mid ? 0.16 + rand() * 0.20 : 0.13 + rand() * 0.17);
          var dep = block * (mid ? 0.15 + rand() * 0.12 : 0.12 + rand() * 0.1);
          var hh, cls2;
          if (mid) {
            // 越靠核心，中高层体量越高（CBD 的裙楼与中高层办公楼）
            hh = (13 + Math.pow(rand(), 1.9) * 44) * hs * (1 + 0.9 * blk.core);
            cls2 = U.clamp(Math.round(1.6 + eraShift + (rand() - 0.5) * 1.4), 0, 3) | 0;
          } else {
            hh = (5.5 + Math.pow(rand(), 2.1) * 13) * hs;
            cls2 = U.clamp(Math.round(0.8 + eraShift + (rand() - 0.5) * 1.2), 0, 3) | 0;
          }
          var inset = block * 0.5 - dep * 0.5;
          var px, pz, axis;
          if (e === 0) { px = along * block; pz = -inset; axis = 0; }
          else if (e === 1) { px = inset; pz = along * block; axis = 1; }
          else if (e === 2) { px = along * block; pz = inset; axis = 0; }
          else { px = -inset; pz = along * block; axis = 1; }
          var ww = axis === 0 ? wLen : dep, dd = axis === 0 ? dep : wLen;
          push(blk.x + px * ca - pz * sa, blk.z + px * sa + pz * ca, ww, dd, hh, bAng, cls2, 0);
        }
        // 工业区的烟囱/铁塔：细长结构，受载后整体倾覆而非坐塌
        if (blk.q > 0.12 && rand() < 0.05 && B.length < NMAX) {
          var sh = (26 + rand() * 62) * hs;
          push(blk.x + (rand() - 0.5) * block * 0.5, blk.z + (rand() - 0.5) * block * 0.5,
            sh / (7 + rand() * 4), sh / (7 + rand() * 4), sh, bAng, 1, 1);
        }
      }
    }

    /* —— 载荷、热剂量、迎风遮挡 —— */
    var order = [];
    for (var i2 = 0; i2 < B.length; i2++) { order.push(i2); }
    order.sort(function (u, v) { return B[u].r - B[v].r; });
    var SEC = 96, acc = new Float32Array(SEC), lastR = new Float32Array(SEC);
    for (var oi = 0; oi < order.length; oi++) {
      var b2 = B[order[oi]];
      var sec = ((Math.atan2(b2.z, b2.x) + Math.PI) / (2 * Math.PI) * SEC) | 0;
      if (sec >= SEC) { sec = SEC - 1; }
      // 绕射回填：遮挡效应随径向距离按 ~300 m 衰减
      var dR = Math.max(b2.r - lastR[sec], 0);
      acc[sec] *= Math.exp(-dR / 620);
      lastR[sec] = b2.r;
      b2.shield = U.clamp(Math.exp(-0.62 * acc[sec]), 0.45, 1);
      // 本建筑对后排的遮挡：迎风宽度占该半径处扇区弧长的比例 × 高度权重
      var arc = Math.max(2 * Math.PI * Math.max(b2.r, 1) / SEC, 1);
      var frontal = Math.max(b2.w, b2.d) / arc;
      acc[sec] += U.clamp(frontal, 0, 1.4) * (b2.h0 / (b2.h0 + 26));

      var slant = Math.sqrt(b2.r * b2.r + o.hob * o.hob);
      b2.arrival = bl.arrival(slant);
      // 注意：P.overpressureBar 的经验幂律本身就锚定在「空爆地面（马赫反射区）」
      // 的公开毁伤半径上，因此这里不再额外乘反射放大系数 —— 否则会重复计入，
      // 使建筑毁伤半径比 HUD 显示的 psi 环大 30% 以上（二者必须自洽）。
      var dpB = bl.dpBar(slant) * b2.shield;
      b2.dpPsi = P.barToPsi(dpB);
      b2.qPsi = P.barToPsi(P.dynamicPressureBar(dpB));
      // 有效载荷 = 超压（压碎）+ 动压（拖曳），细长/高耸结构对动压更敏感
      var slen = U.clamp(b2.h0 / Math.max(b2.w, b2.d) / 3, 0, 1.6);
      b2.load = b2.dpPsi + b2.qPsi * (0.7 + 0.8 * slen);
      b2.fluence = P.thermalFluence(slant, o.W, vis) * b2.shield;
    }
    this.cityStats = {
      total: B.length, intact: 0, glass: 0, clad: 0,
      partial: 0, collapse: 0, scour: 0, burning: 0, burnt: 0
    };
    return B;
  };

  /* ---------------------------------------------------------------- 云轴（含风切变倾斜） */
  /** 每帧重建一次云轴查找表：把每粒子 O(log n) 的二分查找降为 O(1) */
  Sim.prototype._buildAxisLUT = function () {
    var N = 96;
    var lut = this._axLUT || (this._axLUT = new Float32Array(N));
    var top = Math.max(this.cz * 1.25 + this.Rc, 100);
    this._axTop = top; this._axN = N;
    for (var i = 0; i < N; i++) { lut[i] = this.axisXAt(top * i / (N - 1)); }
  };
  Sim.prototype._axisFast = function (y) {
    var lut = this._axLUT;
    if (!lut) { return this.axisXAt(y); }
    var N = this._axN, u = y / this._axTop * (N - 1);
    if (u <= 0) { return lut[0]; }
    if (u >= N - 1) { return lut[N - 1]; }
    var i = u | 0, f = u - i;
    return lut[i] + (lut[i + 1] - lut[i]) * f;
  };
  Sim.prototype.axisXAt = function (y) {
    var az = this.axZ, ax = this.axX, n = az.length;
    if (n === 0) { return 0; }
    if (y <= az[0]) { return ax[0] * (y / Math.max(az[0], 1e-3)); }
    if (y >= az[n - 1]) { return ax[n - 1]; }
    var lo = 0, hi = n - 1, mid;
    while (hi - lo > 1) {
      mid = (lo + hi) >> 1;
      if (az[mid] <= y) { lo = mid; } else { hi = mid; }
    }
    var f = (y - az[lo]) / Math.max(az[hi] - az[lo], 1e-6);
    return ax[lo] + f * (ax[hi] - ax[lo]);
  };
  Sim.prototype.windAt = function (y) {
    return this.opts.wind + this.opts.shear * (y / 1000);
  };

  /* ---------------------------------------------------------------- 热泡 ODE */
  /* ------------------------------------------------------------ 热泡 ODE（可独立运行） */
  /**
   * 纯函数式的一步积分，粒子仿真与「标定预积分」共用同一套方程。
   * st: {z, Rc, w, F, t, cx}   pr: {W, hob, humidity, tStab, sStrat, wind, shear}
   */
  var thermalStep = NK.thermalStep = function (st, pr, h) {
    var z = Math.max(st.z, 1);
    var V = 4.18879 * st.Rc * st.Rc * st.Rc;
    var thEnv = P.atmThetaMixed(z, Z_BL);
    var N2 = P.bruntN2(z, Z_BL) * pr.sStrat;
    var dVdt = 4 * Math.PI * st.Rc * st.Rc * ALPHA * Math.abs(st.w);
    // 潜热源：① 侧向夹卷取当前高度水汽（随高度 e 折减）
    //          ② 尘茎把边界层湿空气送进云盖（占比 β，越过对流层顶后消失）
    //          η：干空气卷入造成凝结水再蒸发的折损
    var beta = S_FEED * U.smoothstep(15000, 9000, z);
    var dThL = (1 - beta) * P.latentDeltaTheta(z, pr.humidity, LCL) +
      beta * P.latentDeltaTheta(Z_BL + 200, pr.humidity, LCL);
    var eta = P.latentEfficiency(st.Rc, R_EVAP);
    var latent = P.K.G * eta * dThL * dVdt / thEnv;
    // 浮力通量：夹卷守恒、层结耗散、潜热补充
    st.F += (-N2 * V * st.w + latent) * h;
    if (st.F < -3 * st.F0) { st.F = -3 * st.F0; }
    var B = st.F / V;
    var mixRate = 3 * ALPHA * Math.abs(st.w) / Math.max(st.Rc, 1);
    var drag = 0.10 * st.w * Math.abs(st.w) / Math.max(st.Rc, 1);
    st.w += (B - st.w * mixRate - drag) * h;
    st.z += st.w * h;
    st.Rc += ALPHA * Math.abs(st.w) * h;

    /* ---- 停滞后的水平铺展：中性浮力层内的重力流侵入 ----
     * 云到中性层后不再上升，而是以重力流横向侵入并同时变扁。
     * 体积守恒 V=πR²h、前沿速度 dR/dt = Fr·N·h  ⇒  R ∝ t^(1/3)（经典侵入律）。
     * 这正是实测「云盘半径 ≈ 0.44×云顶」的物理来源，也是砧状云顶的成因。 */
    var spreadW = 1 / (1 + (st.w / W_STALL) * (st.w / W_STALL));
    if (st.Rdisk < st.Rc) { st.Rdisk = st.Rc; }
    if (st.w > st.wPeak) { st.wPeak = st.w; }
    // 云盘厚度 = 云团竖直尺度 (4/3)Rc。不需要「锁存」：Rc 的增长由 α|w|
    // 驱动，w→0 时自然饱和，于是厚度自动定格在停滞时刻的值。
    st.h0 = 1.3333 * st.Rc;
    if (spreadW > 0.01) {
      // 侵入前沿持续夹卷（γ≈1）⇒ V ∝ R² ⇒ 厚度守恒、半径随时间近似线性增长。
      // 真实砧状云正是「一边铺开一边维持厚度」，而不是摊成薄饼。
      var Nn = Math.sqrt(Math.max(P.bruntN2(z, Z_BL), 1e-8));
      st.dRdisk = Math.min(spreadW * FROUDE * pr.cSpread * Nn * st.h0, 140);
      st.Rdisk += st.dRdisk * h;
    } else { st.dRdisk = 0; }
    st.Vstab = Math.PI * st.Rdisk * st.Rdisk * st.h0;
    st.Hdisk = st.h0;
    if (st.z < 1) { st.z = 1; if (st.w < 0) { st.w = 0; } }
    st.t += h;
    if (!U.finite(st.z) || !U.finite(st.Rc) || !U.finite(st.w) || !U.finite(st.F)) {
      st.z = z; st.w = 0; st.F = st.F0 * 0.1;
    }
    return st;
  };

  /** 只跑 ODE（不带粒子）求可见云顶峰值 —— 用于标定与快速预测 */
  var thermalPeak = NK.thermalPeak = function (pr) {
    var st = {
      z: pr.z0, Rc: pr.Rc0, w: 0, t: 0, cx: 0,
      F: pr.F0, F0: pr.F0, Rdisk: pr.Rc0, Vstab: 0, Hdisk: 2 * pr.Rc0, dRdisk: 0, h0: 0, wPeak: 0
    };
    // 步数取 1400：标定只需 <1% 精度，拖动当量滑块时才不会卡
    var T = pr.tStab * 1.6, h = Math.max(T / 1400, 0.05), peak = 0, tPeak = 0;
    var Rd1 = 0;
    while (st.t < T) {
      thermalStep(st, pr, h);
      var vis = st.z + 1.1 * st.Rc;
      if (vis > peak) { peak = vis; tPeak = st.t; }
      if (st.t <= pr.tStab) { Rd1 = st.Rdisk; }
    }
    return { top: peak, t: tPeak, Rc: st.Rc, z: st.z, Rdisk: Rd1, RdiskEnd: st.Rdisk };
  };

  /**
   * 层结耗散标定：对 sStrat 做二分，使 ODE 预测的可见云顶等于经验曲线
   *   H ≈ 21.6·(W/Mt)^0.2 km
   * 只改这一个标量 —— 上升速率、过冲振荡、砧状铺开等全部动力学形状不变。
   * sStrat>1 表示纯物理解偏高，<1 表示偏低（兆吨级典型 0.2~0.5，
   * 反映不可压顶帽模型未含的湿中性深对流与气泡膨胀效应）。
   */
  var calCache = {};
  Sim.prototype._calibrateStrat = function () {
    var o = this.opts;
    var key = o.W + '|' + o.hob + '|' + o.humidity.toFixed(3);
    if (calCache[key]) {
      var c = calCache[key];
      this.sStrat = c.sStrat; this.cSpread = c.cSpread;
      this.rawTop = c.rawTop; this.predTop = c.predTop;
      this.predTime = c.predTime; this.predRdisk = c.predRdisk;
      return this.sStrat;
    }
    var pr = this._thermalParams(1);
    pr.cSpread = 1;
    var i, r, mid = 1;
    // ——（1）层结耗散系数 → 匹配云顶经验曲线 ——
    var tTop = P.cloudTopEmpirical(o.W);
    r = thermalPeak(pr);
    this.rawTop = r.top;
    this.rawRdisk = r.Rdisk;
    var lo = 0.004, hi = 12;
    for (i = 0; i < 32; i++) {
      mid = Math.sqrt(lo * hi);
      pr.sStrat = mid;
      r = thermalPeak(pr);
      if (r.top > tTop) { lo = mid; } else { hi = mid; }
      if (Math.abs(r.top / tTop - 1) < 2e-3) { break; }
    }
    this.sStrat = mid;
    // ——（2）铺展系数 → 匹配云盘半径经验曲线（该项不反馈进上升解，可独立标定）——
    var tRad = P.cloudRadiusEmpirical(o.W);
    var lo2 = 0.15, hi2 = 6, mid2 = 1;
    for (i = 0; i < 30; i++) {
      mid2 = Math.sqrt(lo2 * hi2);
      pr.cSpread = mid2;
      r = thermalPeak(pr);
      if (r.RdiskEnd > tRad) { hi2 = mid2; } else { lo2 = mid2; }
      if (Math.abs(r.RdiskEnd / tRad - 1) < 3e-3) { break; }
    }
    this.cSpread = mid2;
    this.predTop = r.top; this.predTime = r.t; this.predRdisk = r.RdiskEnd;
    calCache[key] = {
      sStrat: this.sStrat, cSpread: this.cSpread, rawTop: this.rawTop,
      predTop: this.predTop, predTime: this.predTime, predRdisk: this.predRdisk
    };
    return this.sStrat;
  };

  Sim.prototype._thermalParams = function (sStrat) {
    var o = this.opts;
    return {
      W: o.W, hob: o.hob, humidity: o.humidity,
      tStab: this.tStab, sStrat: sStrat == null ? this.sStrat : sStrat,
      cSpread: this.cSpread == null ? 1 : this.cSpread,
      z0: Math.max(o.hob, 0.35 * this.Rfb), Rc0: this.Rfb,
      F0: P.buoyancyFlux0(o.W, Math.max(o.hob, 0.35 * this.Rfb), FHEAT, CAL_BUOY)
    };
  };

  Sim.prototype._stepThermal = function (dt) {
    var o = this.opts;
    if (!this.injected && this.t >= this.tDecouple) {
      var pr0 = this._thermalParams();
      this.F = pr0.F0; this.F0 = pr0.F0;
      this.Rc = this.Rfb;
      this.w = 0;
      this.injected = true;
      this.satur = P.buoyancySaturated(o.W, this.cz, FHEAT);
    }
    if (!this.injected) { return; }

    var pr = this._thermalParams();
    var st = this._st || (this._st = {});
    st.z = this.cz; st.Rc = this.Rc; st.w = this.w; st.F = this.F;
    st.F0 = this.F0; st.t = this.t; st.cx = this.cx;
    st.Rdisk = this.Rdisk; st.Vstab = this.Vstab; st.Hdisk = this.Hdisk;
    st.dRdisk = this.dRdisk; st.h0 = this.h0; st.wPeak = this.wPeak;
    var sub = Math.min(10, Math.max(1, Math.ceil(dt / 0.4)));
    var h = dt / sub;
    for (var i = 0; i < sub; i++) {
      thermalStep(st, pr, h);
      this.cx += this.windAt(st.z) * h;      // 顺风漂移
    }
    this.cz = st.z; this.Rc = st.Rc; this.w = st.w; this.F = st.F;
    this.Rdisk = st.Rdisk; this.Vstab = st.Vstab; this.Hdisk = st.Hdisk;
    this.dRdisk = st.dRdisk; this.h0 = st.h0; this.wPeak = st.wPeak;

    // 供显示/粒子耦合用的位温超出
    var Vn = 4.18879 * this.Rc * this.Rc * this.Rc;
    this.dtheta = this.F * P.atmThetaMixed(this.cz, Z_BL) / (P.K.G * Vn);
    // 涡环几何 + 环量（由涡环自诱导速度公式反解）；铺展期环随云盘外扩
    this.Rring = 0.62 * Math.max(this.Rc, 0.86 * this.Rdisk);
    var a = 0.38 * this.Rc;
    var lg = Math.max(Math.log(8 * this.Rring / a) - 0.25, 0.5);
    this.gamma = 4 * Math.PI * this.Rring * Math.max(this.w, 0) / lg;
    // 云轴历史（风切变造成的倾斜轴）
    var az = this.axZ;
    if (this.cz > az[az.length - 1] + Math.max(this.Rc * 0.05, 20)) {
      az.push(this.cz); this.axX.push(this.cx);
      if (az.length > 600) { az.shift(); this.axX.shift(); }
    }
  };

  /* ---------------------------------------------------------------- 发射器 */
  Sim.prototype._emit = function (dt) {
    var o = this.opts, bl = this.blast, t = this.t, rand = this.rand;
    var acc = this.emitAccum;
    var Rg = this._groundShockR();

    /* (a) 地面涌浪 / 尘环：激波沿地面推进时不断掀起尘土 */
    if (this.dustLift > 0.02 && Rg > 0 && t < Math.max(150, 90 * this.t2max)) {
      var dpG = bl.dpBar(Math.max(Rg, this.Rfb * 0.3));
      var rate = 2600 * this.dustLift * U.smoothstep(0.05, 0.6, dpG) *
        U.clamp(this.capacity / 45000, 0.4, 2.5);
      acc.dust += rate * dt;
      var nD = Math.floor(acc.dust); acc.dust -= nD;
      var budget = Math.floor(this.capacity * 0.10);
      for (var i = 0; i < nD && i < 400; i++) {
        if (this.kindCount(K_DUST) > budget) { break; }
        var ang = rand() * Math.PI * 2;
        var rr = Rg * (0.55 + 0.5 * rand());
        // 扬尘高度受边界层/火球尺度限制 —— 若按 0.35·Rg（激波半径）取，
        // 兆吨级在百秒后会把尘土「发射」到十公里高空，完全失真
        var yy = Math.pow(rand(), 2.2) * Math.min(0.35 * Rg, 1.2 * this.Rfb) + 2;
        var u = P.particleVelocity(bl.dpBar(Math.max(rr, 1)), bl.cB) * 0.55;
        this._spawn(K_DUST,
          Math.cos(ang) * rr, yy, Math.sin(ang) * rr,
          Math.cos(ang) * u * 0.8, u * 0.25 + rand() * 8, Math.sin(ang) * u * 0.8,
          P.atmT(yy) + 40 * rand(),
          this.Rfb * (0.10 + 0.22 * rand()),
          260 + rand() * 700);
      }
    }

    /* (b) 尘茎：余风(负压相)把地面尘土沿轴抽向上升的云 */
    if (this.dustLift > 0.05 && this.injected && t < 1.7 * this.tStab) {
      // 发射率随时间缓慢衰减（余风逐渐减弱），而非早期就切断
      var rateS = 1150 * this.dustLift * U.clamp(this.capacity / 45000, 0.4, 2.5) *
        (0.22 + 0.78 * Math.exp(-t / (0.22 * this.tStab)));
      acc.stem += rateS * dt;
      var nS = Math.floor(acc.stem); acc.stem -= nS;
      var budgetS = Math.floor(this.capacity * 0.11);
      // 源分布沿整根柱体播种（越靠地面越密），而非只在地面生成：
      // 尘柱的物质来自爆后最初十几秒余风掀起并沿轴抬升的尘土，顶帽模型
      // 解析不了近地余风收敛的细节（那里的上升速度比线性拉伸估计大一个量级），
      // 因此把「源」按 1/(1+3y/H) 直接给定，之后的输运（拉伸、风切变、
      // 湍流扩散、沉降）全部由流场决定。
      // 播种上限要伸进云盖下缘（cz−0.35Rc），否则柱顶与盖底之间会留下空洞
      // ——「蘑菇」的茎与盖必须连通，这是形态的定义性特征。
      // 柱顶还受「余风把尘土抬上去需要时间」的限制：以 ~110 m/s 从地面长起，
      // 因此高空爆最初几秒尘柱确实短于云底（真实影像也是这样逐渐接上的）
      var grow = (t - this.tDecouple) * 110 + 0.3 * this.Rfb;
      var base = Math.max(Math.min(this.cz - 0.35 * this.Rc, grow), 0.3 * this.Rfb);
      var y0s = Math.max(0.02 * base, 3);
      // 尘柱半径主要由火球尺度决定，随云团半径增长得很弱：真实 20 kt 级
      // 尘柱直径只有几百米（远细于云盖），播种过宽会让蘑菇失去「细茎」特征
      var stemR = Math.max(0.42 * this.Rfb + 0.06 * this.Rc, 8);
      for (var j = 0; j < nS && j < 300; j++) {
        if (this.kindCount(K_STEM) > budgetS) { break; }
        var a2 = rand() * Math.PI * 2;
        // 高度按「对数均匀」分布：被线性速度场 u = w·y/cz 拉伸的柱体，
        // 其数密度 ∝ 1/y ⇒ 高度服从 log-uniform。原先用 u³ 会把上半段
        // 饿死（实测近轴计数 465 → 0），柱子在 60% 高度就断掉。
        var y2 = y0s * Math.pow(base / y0s, rand());
        var yf = U.clamp(y2 / Math.max(base, 1), 0, 1);
        // 顶部外张：真实尘柱在与云盖交汇处呈喇叭状展开
        var widen = 0.5 + 0.95 * Math.pow(yf, 1.7);
        var r2 = Math.sqrt(rand()) * stemR * widen;
        this._spawn(K_STEM,
          this.axisXAt(y2) + Math.cos(a2) * r2, y2, Math.sin(a2) * r2,
          0, 4 + 14 * rand(), 0,
          P.atmT(y2) + 90 * rand(),
          this.Rfb * (0.07 + 0.13 * rand()),
          // 寿命随播种高度增加：近地粗尘会沉降（数十秒），被抬到柱体上部的
          // 细尘则长期滞留。若一律给长寿命，配额会被赖在近地的粒子占满，
          // 新的高位播种无槽可用 ⇒ 柱体上半段变空、茎与盖脱开。
          this.tStab * (0.16 + 0.95 * yf) * (0.7 + 0.6 * rand()));
      }
    }

    /* (c) 夹卷：云团半径增长意味着卷入环境空气 —— 在环面上补充新粒子 */
    if (this.injected && this.w > 0.5) {
      var rateC = 46 * (ALPHA * this.w) * U.clamp(this.capacity / 45000, 0.4, 2.5) / Math.max(1, 1);
      acc.cap += rateC * dt;
      var nC = Math.floor(acc.cap); acc.cap -= nC;
      var budgetC = Math.floor(this.capacity * 0.26);
      for (var k = 0; k < nC && k < 400; k++) {
        if (this.kindCount(K_CAP) > budgetC) { break; }
        var th = rand() * Math.PI * 2, ph = rand() * Math.PI * 2;
        var Rr = this.Rring, ac = 0.42 * this.Rc;
        var rr2 = Rr + ac * Math.cos(ph) * (0.5 + rand() * 0.7);
        var yy2 = this.cz + ac * Math.sin(ph) * (0.5 + rand() * 0.7);
        var Tenv = P.atmT(Math.max(yy2, 0));
        this._spawn(K_CAP,
          this.cx + Math.cos(th) * rr2, Math.max(yy2, 5), Math.sin(th) * rr2,
          0, 0, 0,
          Tenv + 30 + 260 * rand(),
          this.Rc * (0.12 + 0.16 * rand()),
          1e9);
      }
    }
  };

  Sim.prototype.kindCount = function (kind) {
    if (!this._kc) { this._kc = new Int32Array(8); }
    return this._kc[kind] | 0;
  };
  /** 调试工具：从粒子池重建分类计数（正常路径由 _spawn/_kill 增量维护） */
  Sim.prototype._recount = function () {
    if (!this._kc) { this._kc = new Int32Array(8); }
    this._kc.fill(0);
    var d = this.data, al = this.alive, n = this.count;
    for (var i = 0; i < n; i++) {
      if (al[i]) { this._kc[d[i * STRIDE + IKIND] | 0]++; }
    }
  };

  /** 地面激波环半径（球面与地面相交） */
  Sim.prototype._groundShockR = function () {
    var R = this.blast.radius(this.t), h = this.opts.hob;
    if (R <= h) { return 0; }
    return Math.sqrt(R * R - h * h);
  };

  /* ---------------------------------------------------------------- 建筑更新 */
  /** 查询某地附近最高建筑（含废墟）——相机避免穿入/贴脸建筑用 */
  Sim.prototype.maxBuildingHeightNear = function (x, z, R) {
    var B = this.buildings, R2 = R * R, best = 0;
    for (var i = 0; i < B.length; i++) {
      var b = B[i];
      var dx = b.x - x, dz = b.z - z;
      if (dx * dx + dz * dz > R2) { continue; }
      var hh = Math.max(b.h + (b.tierH > 0 && b.collapse < 0.03 ? b.tierH : 0), b.rubbleH);
      if (hh > best) { best = hh; }
    }
    return best;
  };

  /* ---------------------------------------------------------------- 破坏与火灾 */
  /**
   * 渐进破坏状态机。判据用「超压 + 动压」的合成载荷与结构分类阈值比较：
   *   >0.22 psi   玻璃破碎
   *   >幕墙阈值    外墙/幕墙剥离，露出楼板与框架
   *   >0.62×抗力  部分倒塌（上部楼层坐塌，留残骸 + 废墟堆）
   *   >抗力       完全倒塌（整体坐塌成废墟，背爆心方向轻微倾斜）
   *   >3.2×抗力   清扫至基础（几乎荡平，仅留基础与薄层废墟）
   * 坍塌是重力驱动的：特征时间 T ≈ 1.6·√(2h/g)（自由落体量级 ×阻力修正），
   * 因此 100 m 高楼约 7 s 坐塌完，与实际拆除/倒塌录像量级一致。
   * 细长结构（烟囱、铁塔）改为绕底边整体倾覆。
   */
  Sim.prototype._stepBuildings = function (dt) {
    var B = this.buildings, t = this.t, rand = this.rand, o = this.opts;
    var cs = this.cityStats;
    var burnN = Math.max(cs.burning, 1);
    this._smokeRate = Math.min(1.5, this.capacity * 0.13 / (420 * burnN));
    this._fireRate = Math.min(3.0, this.capacity * 0.02 / (8 * burnN));
    cs.intact = 0; cs.glass = 0; cs.clad = 0; cs.partial = 0;
    cs.collapse = 0; cs.scour = 0; cs.burning = 0; cs.burnt = 0;
    var G = P.K.G;
    for (var i = 0; i < B.length; i++) {
      var b = B[i];

      /* —— 激波到达：一次性判定破坏等级 —— */
      if (!b.hit && t >= b.arrival) {
        b.hit = 1;
        var load = b.load, strg = b.strength;
        if (load > 3.2 * strg || load > 26) { b.state = ST_SCOUR; }
        else if (load > strg) { b.state = ST_COLLAPSE; }
        else if (load > 0.62 * strg) { b.state = ST_PARTIAL; }
        else if (load > b.cladDp) { b.state = ST_CLAD; }
        else if (load > 0.22) { b.state = ST_GLASS; }
        b.glass = U.clamp((load - 0.15) / 0.55, 0, 1);
        b.clad = U.clamp((load - b.cladDp) / Math.max(b.cladDp * 1.4, 0.2), 0, 1);
        var ign = CLS[b.cls].ign;
        b.char = U.clamp((b.fluence - ign * 0.30) / (ign * 1.1), 0, 1);
        b.collT = 1.6 * Math.sqrt(2 * Math.max(b.h0, 5) / G);
        b.collT0 = t + 0.12 + 0.3 * rand();
        b.partFrac = b.state === ST_PARTIAL ? (0.22 + 0.45 * rand())
          : (b.state >= ST_COLLAPSE ? 1 : 0);
        if (b.slender && b.state >= ST_PARTIAL) {
          b.toppling = 1; b.partFrac = 0;
          b.toppleVel = 0.30 * Math.sqrt(Math.max(b.qPsi, 0.1)) *
            (0.8 + 0.5 * rand()) / Math.sqrt(Math.max(b.h0, 4) / 25);
        }
        if (b.state >= ST_GLASS) { this._blastDebris(b); }
        /* —— 点燃：热剂量超过材料点燃阈值；强冲击波会扑灭初期火，
              但废墟随后复燃（这正是广岛火风暴的形成过程） —— */
        if (o.fires && b.fluence > CLS[b.cls].ign) {
          var blown = b.dpPsi > 4.5 && rand() < 0.55;
          if (!blown) { b.fireT = t + 8 + 70 * rand(); }
          else if (rand() < 0.45) { b.fireT = t + 130 + 260 * rand(); }
        }
      }

      /* —— 坍塌推进（重力驱动） —— */
      if (b.partFrac > 0 && b.collapse < 1 && t > b.collT0) {
        var p = U.clamp((t - b.collT0) / b.collT, 0, 1);
        b.collapse = p;
        var fr = b.partFrac * p * p * (3 - 2 * p);
        var sc = b.state === ST_SCOUR;
        b.h = b.h0 * (1 - fr * (sc ? 0.985 : 0.94));
        b.rubbleH = (sc ? 0.06 : 0.17) * b.h0 * fr;
        b.lean = (b.state >= ST_COLLAPSE ? 0.10 : 0.05) * fr;
        // 坍塌过程中持续喷出粉尘（体积越大越多）
        b.dustAcc += dt * (0.6 + b.w * b.d * 0.004);
        if (b.dustAcc > 1) { b.dustAcc = 0; this._collapseDust(b, p); }
      }

      /* —— 细长结构倾覆：绕底边转动，重力矩加速 —— */
      if (b.toppling && b.topAng < Math.PI * 0.5) {
        b.toppleVel += 1.2 * G / Math.max(b.h0, 6) * Math.sin(U.clamp(b.topAng, 0.05, 1.5)) * dt;
        b.topAng += b.toppleVel * dt;
        if (b.topAng >= Math.PI * 0.5) {
          b.topAng = Math.PI * 0.5; b.toppleVel = 0;
          this._collapseDust(b, 1);
        }
      }

      /* —— 火灾发展与浓烟 —— */
      if (b.fireT > 0 && t > b.fireT) {
        b.burning = U.clamp((t - b.fireT) / 60, 0, 1);
        if (o.fires) { this._fireSmoke(b, dt); }
      }

      /* —— 统计 —— */
      if (b.state === ST_OK) { cs.intact++; }
      else if (b.state === ST_GLASS) { cs.glass++; }
      else if (b.state === ST_CLAD) { cs.clad++; }
      else if (b.state === ST_PARTIAL) { cs.partial++; }
      else if (b.state === ST_COLLAPSE) { cs.collapse++; }
      else { cs.scour++; }
      if (b.burning > 0.02) { cs.burning++; }
      if (b.fireT > 0) { cs.burnt++; }
    }
  };

  /** 激波抵达瞬间：玻璃/碎屑被吹向下风侧（径向向外） */
  Sim.prototype._blastDebris = function (b) {
    var rand = this.rand;
    var n = 1 + Math.min(4, (b.load / 4) | 0);
    var len = Math.max(Math.sqrt(b.x * b.x + b.z * b.z), 1e-3);
    var nx = b.x / len, nz = b.z / len;
    for (var i = 0; i < n; i++) {
      if (this.kindCount(K_DEBRIS) > this.capacity * 0.04) { return; }
      var sp = 12 + Math.min(90, b.qPsi * 9) * (0.5 + rand());
      var jit = (rand() - 0.5) * 0.9;
      var cj = Math.cos(jit), sj = Math.sin(jit);
      this._spawn(K_DEBRIS,
        b.x + (rand() - 0.5) * b.w, b.h0 * (0.15 + rand() * 0.8), b.z + (rand() - 0.5) * b.d,
        (nx * cj - nz * sj) * sp, sp * (0.15 + rand() * 0.45), (nx * sj + nz * cj) * sp,
        P.atmT(b.h0) + 40, Math.max(b.h0 * (0.25 + rand() * 0.5), 3),
        18 + rand() * 40);
    }
  };

  /** 坍塌粉尘：沿地面向外翻滚的浓密尘云（混凝土粉尘），并抛出块体 */
  Sim.prototype._collapseDust = function (b, p) {
    var rand = this.rand;
    var len = Math.max(Math.sqrt(b.x * b.x + b.z * b.z), 1e-3);
    var nx = b.x / len, nz = b.z / len;
    var scale = Math.max(Math.sqrt(b.w * b.d), 4);
    var n = 1 + Math.min(3, (scale / 14) | 0);
    for (var i = 0; i < n; i++) {
      if (this.kindCount(K_DUST) > this.capacity * 0.07) { return; }
      var ang = rand() * Math.PI * 2;
      var sp = 6 + 16 * rand();
      // 略偏向背爆心方向（被余风继续推）
      var vx = Math.cos(ang) * sp + nx * 5, vz = Math.sin(ang) * sp + nz * 5;
      this._spawn(K_DUST,
        b.x + Math.cos(ang) * scale * 0.6, b.h0 * (0.05 + 0.35 * rand() * (1 - p * 0.6)) + 2,
        b.z + Math.sin(ang) * scale * 0.6,
        vx, 3 + 9 * rand(), vz,
        P.atmT(10) + 25, scale * (0.45 + rand() * 0.6),
        90 + rand() * 220);
    }
  };

  /** 火场浓烟：黑色烟柱（含底部火焰），受浮力上升、被风切变拉斜 */
  Sim.prototype._fireSmoke = function (b, dt) {
    var rand = this.rand;
    var vol = Math.max(Math.sqrt(b.w * b.d), 4);
    var sz = 0.5 + vol * 0.03;
    // 速率按「预算 / (寿命 × 燃烧栋数)」自适应：否则最先起火的少数几栋楼
    // 就把浓烟配额吃光，火风暴会只剩几根孤零零的烟柱
    // 用「概率发射」而非累加器：燃烧建筑很多时每栋楼的速率可低到
    // 1/1000 s⁻¹，累加器在整段动画里都攒不满 1，浓烟会几乎不生成
    // （建筑数从 5 千提到 1 万后立刻暴露：浓烟只剩 4 粒）。
    var pF = dt * b.burning * this._fireRate * sz;
    if (pF > 0 && (pF >= 1 || rand() < pF)) {
      if (this.kindCount(K_FIRE) < this.capacity * 0.02) {
        this._spawn(K_FIRE,
          b.x + (rand() - 0.5) * vol * 0.8, Math.max(b.rubbleH, 1.5) + rand() * vol * 0.45,
          b.z + (rand() - 0.5) * vol * 0.8,
          0, 4 + 8 * rand(), 0,
          1150 + 420 * rand(),                     // 火焰温度 → 黑体发光
          vol * (0.18 + rand() * 0.28),
          4 + rand() * 8);
      }
    }
    var pS = dt * b.burning * this._smokeRate * sz;
    if (!(pS >= 1 || rand() < pS)) { return; }
    if (this.kindCount(K_SMOKE) < this.capacity * 0.13) {
      var hTop = Math.max(b.h, b.rubbleH) + vol * 0.4;
      this._spawn(K_SMOKE,
        b.x + (rand() - 0.5) * vol, hTop * (0.5 + 0.6 * rand()) + 3,
        b.z + (rand() - 0.5) * vol,
        (rand() - 0.5) * 4, 6 + 12 * rand(), (rand() - 0.5) * 4,
        // 烟气比环境热得多 → 自身产生浮力抬升，形成烟柱
        P.atmT(10) + 260 + 320 * rand(),
        vol * (0.55 + rand() * 0.7),
        260 + rand() * 420);
    }
  };

  /* ---------------------------------------------------------------- 主步进 */
  /**
   * @param {number} dtPhys 物理时间步（秒）。内部自动分子步保证稳定。
   */
  Sim.prototype.step = function (dtPhys) {
    if (!(dtPhys > 0)) { return; }
    // 输运用「指数松弛」积分（对任意 dt 无条件稳定），因此这里的时间步只需
    // 保证不越过流场的特征长度即可；系数 0.6 是精度/帧率的折中（0.35 更精细，
    // 但晚期会把子步数翻倍）。
    var vScale = Math.max(50, this.Rc * 0.5);
    var dtMax = U.clamp(0.60 * Math.max(this.Rc, this.Rfb) / vScale, 0.004, 1.6);
    if (this.t < this.tDecouple) { dtMax = Math.min(dtMax, Math.max(this.t2max * 0.4, 0.004)); }
    var nsub = U.clamp(Math.ceil(dtPhys / dtMax), 1, 4);
    var h = dtPhys / nsub;
    for (var s = 0; s < nsub; s++) {
      this._stepThermal(h);
      this._emit(h);
      this._stepBuildings(h);
      // 时间先推进：_advect 内的激波半径/火球牵引都应取「步末」时刻，
      // 否则第一步会用 t=0 的解（火球半径 0、表观温度 7e4 K）驱动粒子
      this.t += h;
      this._advect(h);
    }
    this.flash = this.blast.relPower(this.t);
    this._diagnose();
  };

  /** 粒子输运 —— 热点循环，避免任何堆分配 */
  Sim.prototype._advect = function (dt) {
    var d = this.data, al = this.alive, n = this.count;
    var o = this.opts, bl = this.blast, t = this.t;
    var hob = o.hob;
    var G = P.K.G;

    // —— 本步的场参数（与粒子无关，预先算好） ——
    var Rs = bl.radius(t);                       // 激波半径
    var RsPrev = bl.radius(Math.max(t - dt, 1e-6));
    var fbR = bl.fireballR(t);
    var fbRp = bl.fireballR(Math.max(t - dt, 1e-6));
    var dRfb = (fbR - fbRp) / dt;
    var fbT = bl.fireballT(t);
    var inGrow = t < this.tDecouple;

    var gamma = this.gamma, Rring = this.Rring, cz = this.cz, cx = this.cx;
    var rcore = Math.max(0.34 * this.Rc, 1);
    var rcore2 = rcore * rcore;
    // 轴向「烟囱」补强：涡环内侧射流在远离涡核处衰减太快，补一项保证茎连贯
    var uTrans = Math.max(this.w - (Rring > 1 ? gamma / (4 * Math.PI * Rring) : 0), 0);
    var envR = Math.max(1.30 * this.Rc, 0.80 * this.Rdisk, 1);  // 环流作用半径
    var gammaK = gamma / (2 * Math.PI);
    var Rdisk = this.Rdisk, Hdisk = Math.max(this.Hdisk, 1), dRdisk = this.dRdisk;
    var chimR = Math.max(0.55 * this.Rfb + 0.12 * this.Rc, 1);
    var wCloud = Math.max(this.w, 0);
    // 近地无滑移边界层厚度：真实余风的边界层只有数十米量级，
    // 若按火球尺度取几百米，尘茎粒子恰好诞生在被压制的区间里而永远起不来
    var blScale = U.clamp(0.05 * this.Rfb, 25, 120);

    // 湍流：尺度随云长大（能量级串），幅度随速度
    var turbL = Math.max(0.30 * Math.max(this.Rc, this.Rfb), 8);
    var turbA = 0.55 * Math.pow(U.clamp(this.Rc / Math.max(this.Rfb, 1), 1, 40), 0.35);
    var nf = this.noise, n3 = this._n3;
    var tn = t * 0.06;
    // 亚格子湍流速度尺度：随云团自身的速度与尺度标定。若取固定值（如 5 m/s），
    // 小当量云团会被相对过强的扰动打散（云盖与尘茎宽度趋同，失去蘑菇形）。
    var turbBase = U.clamp(0.10 * Math.max(this.w, 3) + 0.0022 * this.Rc, 1.2, 26);
    var sizeCap = 0.24 * Math.max(this.Rc, this.Rfb);   // 单个烟团不得大于云团的 1/4

    // Friedlander 波形只在 φ=(t−t_a)/t₊ < 8 的壳层内非零。晚期激波半径达上百
    // 公里，若不剪枝则每个粒子都要做一次二分查找 + 两次 Math.pow，成为热点。
    var tpRef = P.positivePhase(Math.max(Rs * 0.5, 1), bl.Weff);
    var RwaveMin = bl.radius(Math.max(t - 9 * tpRef, 1e-6)) * 0.85;
    // 拖曳松弛因子与 dt 无关于粒子 ⇒ 每种类型只算一次 exp
    var fSmoke = 1 - Math.exp(-dt / 0.30);
    var fDust = 1 - Math.exp(-dt / 0.55);
    var fDebris = 1 - Math.exp(-dt / 2.2);
    var G_dt = G * dt;
    this._buildAxisLUT();

    var Rr2 = Rring * Rring, rMin = 0.30 * Rring, invCz = 1 / Math.max(cz, 1);
    var axialU = function (yy) {
      var dAx = cz - yy; if (dAx < rMin) { dAx = rMin; }
      var den = Rr2 + dAx * dAx;
      var ring = gamma * Rr2 / (2 * den * Math.sqrt(den));
      var st = yy * invCz; if (st > 1.05) { st = 1.05; } else if (st < 0) { st = 0; }
      var stretch = wCloud * st;
      var m = ring > stretch ? ring : stretch;
      var g = yy / blScale; if (g > 1) { g = 1; } else if (g < 0) { g = 0; }
      return m * g * g * (3 - 2 * g);
    };

    for (var i = 0; i < n; i++) {
      if (!al[i]) { continue; }
      var b = i * STRIDE;
      var kind = d[b + IKIND] | 0;
      var x = d[b + IX], y = d[b + IY], z = d[b + IZ];

      /* ---------- 火球牵引期：位置由自相似解规定 ---------- */
      if (kind === K_FIREBALL && inGrow) {
        continue; // 由 _driveFireball 统一处理
      }

      var age = d[b + IAGE] + dt;
      d[b + IAGE] = age;
      var life = d[b + ILIFE];
      if (life < 1e8 && age > life) { this._kill(i); continue; }

      /* ---------- 1. 局部空气速度 u ---------- */
      var ux = 0, uy = 0, uz = 0;

      // (1a) 激波致质点速度：Friedlander 波形（含负压相）
      var dxb = x, dyb = y - hob, dzb = z;
      var Rp = Math.sqrt(dxb * dxb + dyb * dyb + dzb * dzb);
      if (Rp > 1e-3 && Rp < 1.05 * Rs && Rp > RwaveMin) {
        var ta = bl.arrival(Rp);
        if (t > ta) {
          var tp = P.positivePhase(Rp, bl.Weff);
          var phi = (t - ta) / Math.max(tp, 1e-4);
          if (phi < 8) {
            var u2 = P.particleVelocity(bl.dpBar(Rp), bl.cB);
            var wave = (1 - phi) * Math.exp(-phi);
            var mag = u2 * wave;
            // 内部按 Sedov 剖面线性衰减到中心
            mag *= U.clamp(Rp / Math.max(Rs, 1), 0.15, 1);
            var invR = 1 / Rp;
            ux += dxb * invR * mag; uy += dyb * invR * mag; uz += dzb * invR * mag;
          }
        }
      }

      // (1b) 涡环诱导（子午面内镜像 Lamb–Oseen 涡对）
      if (gamma > 1) {
        var px = x - this._axisFast(y);
        var pr = Math.sqrt(px * px + z * z);
        var dirx = pr > 1e-4 ? px / pr : 1, dirz = pr > 1e-4 ? z / pr : 0;
        var dy2 = y - cz;
        // 到涡核（子午面内最近的那个）的距离 → 远场包络
        var dCore = Math.sqrt((Math.abs(pr) - Rring) * (Math.abs(pr) - Rring) + dy2 * dy2);
        var envQ = dCore / envR;
        var envW = envQ > 2.6 ? 0 : Math.exp(-envQ * envQ * envQ * 0.55);
        // 近侧涡核 (+Rring)：环量使 (r,y) 平面内绕核旋转（外翻上升）
        var s1r = pr - Rring, s1y = dy2;
        var s1 = s1r * s1r + s1y * s1y;
        // 二维涡对的远场衰减是 1/r，真实三维涡环是 ~1/r³。若不加窗，远处的
        // 尘茎/尘环粒子会被虚假的远场速度甩出去（表现为「倒蘑菇」）。
        // 这里用包络窗把环流限制在云团尺度内，恢复三维涡环的局部性。
        var wEnv = envW;
        var q1 = s1 / rcore2;
        var c1 = q1 > 7 ? 1 : 1 - Math.exp(-q1);
        var f1 = wEnv * gammaK * c1 / Math.max(s1, rcore2 * 0.05);
        // 远侧涡核 (−Rring)，环量反向
        var s2r = pr + Rring, s2y = dy2;
        var s2 = s2r * s2r + s2y * s2y;
        var q2 = s2 / rcore2;
        var c2 = q2 > 7 ? 1 : 1 - Math.exp(-q2);
        var f2 = wEnv * gammaK * c2 / Math.max(s2, rcore2 * 0.05);
        // 旋向：近侧涡核在子午面内顺时针（v = f·(s_y, −s_r)），于是
        //   轴线上 (s=(−R,0)) → 向上；核外侧 → 向下回流；
        //   核上方 → 向外铺开（砧状云顶）；核下方 → 向内收拢（喂养尘茎）。
        var vr1 = f1 * s1y, vy1 = -f1 * s1r;
        var vr2 = -f2 * s2y, vy2 = f2 * s2r;
        var vr = vr1 + vr2, vyy = vy1 + vy2;
        ux += dirx * vr; uz += dirz * vr; uy += vyy;

        // 涡环整体自平移：二维镜像涡对只给出 Γ/(4πR)，真实涡环还多一个
        // (ln(8R/a)−0.25) 因子，这里把差额作为云团包络内的均匀平移补上，
        // 使可见云团严格跟随热泡 ODE 的上升解。
        if (uTrans > 0.05) {
          var ddc = Math.sqrt(pr * pr + dy2 * dy2) / (1.55 * this.Rc);
          uy += uTrans * Math.exp(-ddc * ddc * ddc);
        }

        // (1c) 砧状云盘铺展：中性侵入的自相似速度场 u_r = Ṙ·(r/R)，
        //      并因体积守恒把云压扁（竖直方向向中面收缩）
        if (dRdisk > 0.02 && Rdisk > 1) {
          var dzn = (y - cz) / Hdisk;
          var wgtD = Math.exp(-dzn * dzn * 1.1) * U.smoothstep(1.30, 0.85, pr / Rdisk);
          if (wgtD > 0.002) {
            var urD = dRdisk * (pr / Rdisk) * wgtD;
            ux += dirx * urD; uz += dirz * urD;
            uy -= dzn * Hdisk * (dRdisk / Rdisk) * wgtD;
          }
        }

        // (1d) 尘茎：涡环在轴线上的精确诱导速度（Biot–Savart）
        //        u_z(d) = Γ·R²/(2(R²+d²)^{3/2}) ，d 为到环平面的轴向距离。
        //      近云底极快、近地面按 1/d³ 衰减 —— 于是尘柱被「拉伸」成
        //      下密上疏的真实形态；若用沿柱恒定的抽吸速度，粒子会一冲到顶，
        //      柱身中段变空（双峰分布）。
        //      用流函数 ψ = A·chimR²/2·(1−e^{−(r/chimR)²}) 保证无散度。
        if (y < cz * 1.02 && gamma > 1) {
          var pr2 = pr / chimR;
          var ex = pr2 > 3 ? 0 : Math.exp(-pr2 * pr2);
          // 两段叠加取 max（内联展开，避免每粒子创建闭包；(·)^1.5 用 x·√x）：
          //   ① 线性拉伸场 u = w·y/cz —— 连续性要求（地面 0、云底 w），
          //      把地面新掀起的尘土「拉」成一根连续柱体；
          //   ② 涡环近场轴向诱导 —— 在云底附近迅速把尘土吸入云盖。
          var A0 = axialU(y), Ap = axialU(y + 30), Am = axialU(y - 30);
          uy += A0 * ex;
          // u_r = -(1/r)·∂ψ/∂y
          var dA = (Ap - Am) / 60;
          var urc = -chimR * chimR * 0.5 * (1 - ex) / Math.max(pr, chimR * 0.15) * dA;
          ux += dirx * urc; uz += dirz * urc;
        }
      }

      // (1e) 环境风 + 切变
      ux += this.windAt(y);

      // (1f) 湍流（非零散度的加速度扰动，视觉上等价于亚格子涡）
      nf.sample(n3, x / turbL + tn, y / turbL - tn * 0.7, z / turbL + tn * 0.3);
      var szNow = d[b + ISIZE];
      var tScale = turbA * (turbBase + 0.05 * Math.abs(uy) + 0.04 * Math.sqrt(ux * ux + uz * uz));
      // 亚格子湍流只对小于自身尺度的涡有效：大烟团不再被高频扰动来回甩
      tScale *= U.clamp(turbL / Math.max(szNow * 2.6, 1), 0.22, 1.0);
      if (kind === K_STEM) { tScale *= 0.55; }   // 尘茎是相对有组织的上升流
      ux += n3[0] * tScale; uy += n3[1] * tScale * 1.15; uz += n3[2] * tScale;

      /* ---------- 2. 拖曳：指数松弛（无条件稳定） ---------- */
      var f = kind === K_DEBRIS ? fDebris : (kind === K_DUST ? fDust : fSmoke);
      var vx = d[b + IVX], vy = d[b + IVY], vz = d[b + IVZ];
      vx += (ux - vx) * f; vy += (uy - vy) * f; vz += (uz - vz) * f;

      /* ---------- 3. 浮力 / 重力 / 沉降 ---------- */
      var Tp = d[b + IT];
      var Tenv = P.atmT(Math.max(y, 0));
      if (kind === K_DEBRIS) {
        vy -= G_dt;                                    // 弹道
      } else {
        var buoy = G * (Tp - Tenv) / Math.max(Tenv, 1);
        buoy = U.clamp(buoy, -12, 140);
        vy += buoy * dt;
        if (kind === K_DUST || kind === K_STEM) {
          vy -= 0.9 * dt;                              // 尘粒沉降
        }
      }

      /* ---------- 4. 位置 ---------- */
      x += vx * dt; y += vy * dt; z += vz * dt;

      /* ---------- 5. 地面碰撞（简单弹跳 + 摩擦） ---------- */
      if (y < 1.5) {
        y = 1.5;
        if (vy < 0) { vy = kind === K_DEBRIS ? -vy * 0.28 : Math.abs(vy) * 0.12; }
        vx *= 0.86; vz *= 0.86;
      }

      /* ---------- 6. 温度：夹卷混合 + 绝热 ---------- */
      var sz = d[b + ISIZE];
      var tauMix;
      if (kind === K_SMOKE) {
        // 火场烟柱是羽流：夹卷速度 ~0.1·w，混合时标比尘粒长一两个量级。
        // 若沿用尘粒的快速混合，烟气 1 秒内就降到环境温度、失去浮力升不起来。
        tauMix = U.clamp(sz / (0.10 * Math.max(Math.abs(vy), 3)), 6, 300);
      } else if (kind === K_FIRE) {
        tauMix = 2.5;
      } else {
        tauMix = U.clamp(0.9 * sz / (0.35 * Math.max(30, Math.abs(vy) + 20)), 0.4, 90);
      }
      var fm = 1 - Math.exp(-dt / tauMix);
      Tp += (Tenv - Tp) * fm;
      Tp -= ADIABAT * (vy * dt) * 0.75;               // 上升绝热降温
      if (kind === K_FIREBALL) {
        // 脱离后仍与火球温标弱耦合一小段（辐射冷却主导）
        var wf = U.clamp(1 - (t - this.tDecouple) / (12 * this.t2max), 0, 1);
        Tp = Tp * (1 - wf) + fbT * wf;
      }
      if (!(Tp > 1)) { Tp = Tenv; }
      d[b + IT] = Tp;

      /* ---------- 7. 尺寸随夹卷增长：dr/dt ≈ α_p·v_turb（线性，而非指数） ---------- */
      if (kind !== K_DEBRIS) {
        var grow = 0.22 * (turbBase + 0.02 * Math.abs(vy));
        d[b + ISIZE] = Math.min(sz + grow * dt, sizeCap);
      }

      /* ---------- 8. NaN 兜底 ---------- */
      if (!U.finite(x) || !U.finite(y) || !U.finite(z) ||
        !U.finite(vx) || !U.finite(vy) || !U.finite(vz)) {
        this._kill(i); continue;
      }
      var spd2 = vx * vx + vy * vy + vz * vz, cap2 = 4e6;
      if (spd2 > cap2) { var sc = Math.sqrt(cap2 / spd2); vx *= sc; vy *= sc; vz *= sc; }
      d[b + IX] = x; d[b + IY] = y; d[b + IZ] = z;
      d[b + IVX] = vx; d[b + IVY] = vy; d[b + IVZ] = vz;
    }

    if (inGrow) { this._driveFireball(dt, fbR, dRfb, fbT); }
    else { this._retireFireball(); }
  };

  /** 火球牵引期：位置 = 中心 + dir·q·R_fb(t)，速度取解析导数 */
  Sim.prototype._driveFireball = function (dt, fbR, dRfb, fbT) {
    var d = this.data, al = this.alive;
    var list = this.fbList, q = this.fbQ, dir = this.fbDir, n = this.fbCount;
    var hob = this.opts.hob;
    var nf = this.noise, n3 = this._n3;
    var L = Math.max(fbR * 0.55, 4), tn = this.t * 1.2;
    for (var k = 0; k < n; k++) {
      var i = list[k]; if (i < 0 || !al[i]) { continue; }
      var b = i * STRIDE;
      if ((d[b + IKIND] | 0) !== K_FIREBALL) { continue; }
      var dx = dir[k * 3], dy = dir[k * 3 + 1], dz = dir[k * 3 + 2];
      var r = q[k] * fbR;
      // 火球表面不稳定性（Rayleigh–Taylor 触发的斑驳感）
      nf.sample(n3, dx * 3 + tn * 0.1, dy * 3, dz * 3);
      var wob = 1 + 0.16 * n3[0] * U.clamp(q[k], 0, 1);
      var x = dx * r * wob, y = hob + dy * r * wob, z = dz * r * wob;
      if (y < 2 && this.groundCoupling > 0.02) { y = 2; }   // 触地压扁
      d[b + IX] = x; d[b + IY] = y; d[b + IZ] = z;
      d[b + IVX] = dx * q[k] * dRfb; d[b + IVY] = dy * q[k] * dRfb; d[b + IVZ] = dz * q[k] * dRfb;
      d[b + IT] = fbT * (0.72 + 0.5 * (1 - q[k]));
      d[b + ISIZE] = Math.max(fbR * (0.13 + 0.09 * d[b + ISEED]), 1);
      d[b + IAGE] += dt;
      if (L > 0) { /* 保持 L 引用避免优化掉 */ }
    }
  };
  Sim.prototype._retireFireball = function () {
    if (this._fbRetired) { return; }
    this._fbRetired = true;
    var d = this.data, list = this.fbList, n = this.fbCount;
    for (var k = 0; k < n; k++) {
      var i = list[k]; if (i < 0) { continue; }
      d[i * STRIDE + IKIND] = K_FIREBALL; // 保留身份，但此后走自由动力学
    }
  };

  /* ---------------------------------------------------------------- 诊断量 */
  Sim.prototype._diagnose = function () {
    var d = this.data, al = this.alive, n = this.count;
    var top = 0, rmax = 0, live = 0, hot = 0;
    var sumY = 0, cnt = 0;
    // 用 98 分位近似「可见云顶」，避免个别飞散粒子拉高读数
    var hist = this._hist || (this._hist = new Int32Array(256));
    hist.fill(0);
    var Hmax = Math.max(this.cz * 2 + this.Rc * 3, 1000);
    for (var i = 0; i < n; i++) {
      if (!al[i]) { continue; }
      live++;
      var b = i * STRIDE, kind = d[b + IKIND] | 0;
      if (kind === K_DEBRIS) { continue; }
      var y = d[b + IY];
      var bin = U.clamp(Math.floor(y / Hmax * 255), 0, 255) | 0;
      hist[bin]++; cnt++;
      sumY += y;
      if (d[b + IT] > 1400) { hot++; }
      var rx = d[b + IX] - this.cx, rz = d[b + IZ];
      var rr = Math.sqrt(rx * rx + rz * rz);
      if (kind === K_CAP || kind === K_FIREBALL) { if (rr > rmax) { rmax = rr; } }
    }
    var target = cnt * 0.98, run = 0, topBin = 0;
    for (var j = 0; j < 256; j++) { run += hist[j]; if (run >= target) { topBin = j; break; } }
    top = (topBin + 1) / 256 * Hmax;
    this.cloudTop = top;
    this.stats.cloudTop = top;
    this.stats.cloudR = Math.max(rmax, this.Rc);
    this.stats.live = live;
    this.stats.hot = hot;
    this.stats.meanY = cnt ? sumY / cnt : 0;
  };

  /** 从 0 快进到时间 t（用于时间轴拖动回退） */
  Sim.prototype.seek = function (tTarget) {
    this.reset();
    var t = 0, guard = 0;
    while (t < tTarget && guard++ < 20000) {
      var dt = U.clamp(0.02 + t * 0.06, 0.002, 1.0);
      if (t + dt > tTarget) { dt = tTarget - t; }
      this.step(dt);
      t = this.t;
    }
    return this;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
