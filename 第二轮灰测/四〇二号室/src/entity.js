/* =============================================================================
 * entity.js — 异常人形实体
 *
 * 「它」：身高约 2.1m、头极小、手臂垂过膝、腿极长。动作以低帧率姿势切换
 * （PS1 时代僵硬感），只在玩家视线移开时移动。面部只有两个凹陷的黑洞。
 * ===========================================================================*/
(function () {
  'use strict';
  var HZ = window.HZ;

  /* 姿势表：每个姿势 = 各关节角度（弧度） */
  // 关节索引: 0头,1左臂,2右臂,3左肘,4右肘,5左腿,6右腿,7左膝,8右膝,9躯干前倾
  var POSES = {
    idle: [0.0, 0.06, -0.06, 0.15, 0.15, 0.0, 0.0, 0.06, 0.06, 0.04],
    idle2: [0.05, -0.04, 0.1, 0.3, 0.12, 0.02, -0.02, 0.1, 0.04, 0.06],
    creep: [-0.3, 0.25, -0.3, 0.9, 0.7, 0.28, -0.3, 0.75, 0.85, 0.35],
    creep2: [-0.25, -0.3, 0.2, 0.65, 0.95, -0.32, 0.3, 0.85, 0.7, 0.3],
    tilt: [0.55, 0.05, -0.05, 0.2, 0.2, 0.0, 0.0, 0.05, 0.05, 0.0],
    lunge: [-0.5, 0.9, 0.9, 1.5, 1.5, 0.5, -0.5, 1.2, 1.2, 0.7]
  };

  /* ============================ 低模人形模型 ============================ */

  function Humanoid(opts) {
    opts = opts || {};
    this.group = new THREE.Group();
    this.parts = {};
    this.pose = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.poseStep = 0;
    this.poseTimer = 0;
    this.poseRate = opts.poseRate || 6;   // 每秒姿势帧数（越低越僵硬）
    this.current = 'idle';

    var skin = new THREE.MeshLambertMaterial({ color: 0xb8b2a4 });
    var cloth = new THREE.MeshLambertMaterial({ color: 0x2e333a });
    var dark = new THREE.MeshLambertMaterial({ color: 0x16181c });

    var B = opts.scale || 1;

    function box(w, h, d, mat) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.castShadow = true;
      return m;
    }

    /* ---- 骨盆（根） ---- */
    var pelvis = box(0.16 * B, 0.18 * B, 0.1 * B, cloth);
    this.group.add(pelvis);
    this.parts.pelvis = pelvis;

    /* ---- 躯干：过分细长 ---- */
    var torso = box(0.15 * B, 0.62 * B, 0.11 * B, cloth);
    torso.position.y = (0.18 + 0.31) * B;
    pelvis.add(torso);
    this.parts.torso = torso;

    /* ---- 头：异常的小，脸部两个黑洞 ---- */
    var head = new THREE.Group();
    head.position.y = 0.34 * B;
    torso.add(head);
    var skull = box(0.13 * B, 0.15 * B, 0.13 * B, skin);
    skull.position.y = 0.08 * B;
    head.add(skull);
    var socketGeo = new THREE.SphereGeometry(0.016 * B, 6, 5);
    var eyeL = new THREE.Mesh(socketGeo, dark);
    eyeL.position.set(-0.03 * B, 0.09 * B, 0.065 * B);
    head.add(eyeL);
    var eyeR = new THREE.Mesh(socketGeo, dark);
    eyeR.position.set(0.03 * B, 0.09 * B, 0.065 * B);
    head.add(eyeR);
    // 嘴：一道更黑的缝
    var mouth = box(0.05 * B, 0.008 * B, 0.02 * B, dark);
    mouth.position.set(0, 0.05 * B, 0.066 * B);
    head.add(mouth);
    this.parts.head = head;
    this.eyes = [eyeL, eyeR];

    /* ---- 手臂：垂过膝 ---- */
    function makeArm(side) {
      var shoulder = new THREE.Group();
      shoulder.position.set(side * 0.1 * B, 0.56 * B, 0);
      torso.add(shoulder);
      var upper = box(0.05 * B, 0.42 * B, 0.055 * B, skin);
      upper.position.y = -0.21 * B;
      shoulder.add(upper);
      var elbow = new THREE.Group();
      elbow.position.y = -0.42 * B;
      shoulder.add(elbow);
      var fore = box(0.045 * B, 0.4 * B, 0.05 * B, skin);
      fore.position.y = -0.2 * B;
      elbow.add(fore);
      var hand = box(0.05 * B, 0.12 * B, 0.04 * B, skin);
      hand.position.y = -0.44 * B;
      elbow.add(hand);
      return shoulder;
    }
    this.parts.armL = makeArm(-1);
    this.parts.armR = makeArm(1);

    /* ---- 腿：异常长 ---- */
    function makeLeg(side) {
      var hip = new THREE.Group();
      hip.position.set(side * 0.06 * B, 0.0, 0);
      pelvis.add(hip);
      var thigh = box(0.07 * B, 0.55 * B, 0.08 * B, cloth);
      thigh.position.y = -0.275 * B;
      hip.add(thigh);
      var knee = new THREE.Group();
      knee.position.y = -0.55 * B;
      hip.add(knee);
      var shin = box(0.055 * B, 0.55 * B, 0.07 * B, skin);
      shin.position.y = -0.275 * B;
      knee.add(shin);
      var foot = box(0.06 * B, 0.05 * B, 0.16 * B, dark);
      foot.position.set(0, -0.58 * B, 0.03 * B);
      knee.add(foot);
      return hip;
    }
    this.parts.legL = makeLeg(-1);
    this.parts.legR = makeLeg(1);

    this.group.scale.setScalar(B);
    this.group.traverse(function (o) {
      if (o.isMesh) o.frustumCulled = false;
    });
  }

  Humanoid.prototype.setPose = function (name) {
    var p = POSES[name] || POSES.idle;
    this.pose = p.slice();
    this.current = name;
    var j = this.parts;
    j.head.rotation.x = p[0];
    j.armL.rotation.x = p[1]; j.armR.rotation.x = p[2];
    j.armL.rotation.z = 0.12; j.armR.rotation.z = -0.12;
    j.legL.rotation.x = p[5]; j.legR.rotation.x = p[6];
    j.torso.rotation.x = p[9];
    this._setElbow(p[3], p[4]);
    this._setKnee(p[7], p[8]);
  };

  Humanoid.prototype._setElbow = function (l, r) {
    // 肘关节组
    var elbowL = this.parts.armL.children[1], elbowR = this.parts.armR.children[1];
    if (elbowL) elbowL.rotation.x = -l;
    if (elbowR) elbowR.rotation.x = -r;
  };
  Humanoid.prototype._setKnee = function (l, r) {
    var kneeL = this.parts.legL.children[1], kneeR = this.parts.legR.children[1];
    if (kneeL) kneeL.rotation.x = l;
    if (kneeR) kneeR.rotation.x = r;
  };

  /* ============================ 怪物 AI ============================ */

  function Stalker(scene, opts) {
    opts = opts || {};
    this.scene = scene;
    this.body = new Humanoid({ scale: opts.scale || 1.06 });
    this.body.group.name = 'stalker';
    this.body.setPose('idle');
    scene.add(this.body.group);

    this.state = opts.state || 'stand';   // stand | approach | rush | vanish
    this.stateTime = 0;
    this.pos = opts.pos ? opts.pos.clone() : new THREE.Vector3(0, 0, -44);
    this.body.group.position.copy(this.pos);
    this.targetPos = this.pos.clone();
    this.speed = opts.speed || 0.85;
    this.stepDist = 0;
    this.stepTimer = 0;
    this.poseStep = 0;
    this.visible = opts.visible !== false;
    this.body.group.visible = this.visible;
    this.teleportable = true;
    this.jitter = opts.jitter !== undefined ? opts.jitter : 0.02;
    this.dread = 0;
  }

  Stalker.prototype.setVisible = function (v) {
    this.visible = v;
    this.body.group.visible = v;
  };

  Stalker.prototype.update = function (dt, time, ctx) {
    this.stateTime += dt;
    var playerPos = ctx.playerPos;
    var lookDir = ctx.lookDir;
    var camPos = ctx.camPos;

    // 与玩家距离 / 是否被直视 / 是否被光照
    var toPlayer = new THREE.Vector3().subVectors(playerPos, this.pos);
    toPlayer.y = 0;
    var dist = toPlayer.length();
    var dirToPlayer = toPlayer.normalize();
    var facing = dirToPlayer.dot(lookDir);          // >0.9 = 玩家正看着它
    var lit = ctx.flashOn && dist < ctx.flashRange;

    var freeze = (facing > 0.86 && lit) || (facing > 0.94 && dist < 12);

    if (this.state === 'stand') {
      // 轻微摇晃 + 偶尔歪头
      if (this.stateTime > 4.5) {
        this.body.setPose(Math.random() < 0.4 ? 'tilt' : 'idle2');
        this.stateTime = 0;
      }
      // 直视它一段时间 → 触发攻击欲望
      if (facing > 0.9 && dist < 16) {
        this.state = 'approach';
        this.stateTime = 0;
        this.speed = 0.75;
        HZ.bus.emit('subtitle', '……它在看着你。');
      }
    } else if (this.state === 'approach') {
      if (freeze) {
        // 被看时完全静止（哭泣天使规则）
      } else {
        // 移动：向玩家一步步行进，姿势低帧切换
        this.stepTimer += dt;
        if (this.stepTimer > 0.16) {
          this.stepTimer = 0;
          this.body.setPose(this.poseStep % 2 ? 'creep' : 'creep2');
          this.poseStep++;
        }
        var move = dirToPlayer.multiplyScalar(this.speed * dt * (freeze ? 0 : 1));
        this.pos.add(move);
        // 位置抖动：顶点抖动的"实体"放大版
        this.pos.x += (Math.random() - 0.5) * this.jitter;
        this.pos.z += (Math.random() - 0.5) * this.jitter;
        this.stepDist += move.length();
        if (this.stepDist > 0.9) {
          this.stepDist = 0;
          ctx.onStep(this.pos);
        }
      }
      if (dist < 1.1) {
        this.state = 'rush';
        this.stateTime = 0;
        HZ.bus.emit('subtitle', '近くに……（它就在你身后）');
      }
      // 玩家逃远 → 消失
      if (dist > 26) {
        this.vanish();
      }
    } else if (this.state === 'rush') {
      // 冲刺：朝向玩家快速逼近，3 秒后或抓到后消失
      var mv = dirToPlayer.multiplyScalar(2.6 * dt);
      this.pos.add(mv);
      this.body.setPose('lunge');
      if (dist < 0.75 || this.stateTime > 3) {
        if (dist < 0.75) ctx.onCatch();
        this.vanish();
      }
    }

    this.body.group.position.copy(this.pos);
    // 身体朝向玩家（缓慢）
    var targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
    var cur = this.body.group.rotation.y;
    var delta = HZ.wrapAngle(targetYaw - cur);
    this.body.group.rotation.y = cur + delta * Math.min(1, dt * (this.state === 'stand' ? 0.7 : 2.4));
  };

  Stalker.prototype.vanish = function () {
    this.state = 'stand';
    this.setVisible(false);
    this.stateTime = 0;
    HZ.bus.emit('stalkerVanish');
  };

  Stalker.prototype.teleport = function (pos, state) {
    this.pos.copy(pos);
    this.body.group.position.copy(pos);
    this.state = state || 'stand';
    this.setVisible(true);
    this.stateTime = 0;
  };

  /* ============================ 静立人偶 ============================ */

  // 房间里的"人偶"：跪坐姿态，玩家长时间注视会微微转头
  function Mannequin(scene, pos, opts) {
    opts = opts || {};
    this.body = new Humanoid({ scale: opts.scale || 0.82 });
    this.body.setPose('idle');
    // 改造成跪坐：腿折、躯干压低
    this.body.parts.legL.rotation.x = -1.25;
    this.body.parts.legR.rotation.x = -1.25;
    this.body.parts.legL.position.y = 0.12;
    this.body.parts.legR.position.y = 0.12;
    this.body.parts.pelvis.position.y = 0.16;
    this.body.group.position.copy(pos);
    this.body.group.name = 'mannequin';
    scene.add(this.body.group);
    this.watched = 0;
    this.state = opts.state || 'kneel';
    this.body.group.rotation.y = opts.ry || 0;
    this.stare = 0;
  }

  Mannequin.prototype.update = function (dt, time, ctx) {
    var toPlayer = new THREE.Vector3().subVectors(ctx.camPos, this.body.group.position);
    var dist = toPlayer.length();
    if (dist < 8) {
      // 被注视越久，越可能缓缓转头看你
      var facing = toPlayer.normalize().dot(ctx.lookDir);
      if (facing > 0.9 && dist < 6) this.watched += dt;
      else this.watched = Math.max(0, this.watched - dt * 2);
      if (this.watched > 2.2 && this.state === 'kneel') {
        this.state = 'turning';
        this.stare = 0;
        HZ.bus.emit('subtitle', '刚才……它动了吗？');
        HZ.bus.emit('stinger', 0.5);
      }
      if (this.state === 'turning') {
        this.stare += dt * 0.5;
        this.body.parts.head.rotation.y = Math.sin(this.stare * 2.4) * 0.5;
        this.body.parts.head.rotation.x = 0.1;
        if (this.stare > 1.6) {
          this.state = 'turned';
          this.body.parts.head.rotation.y = 0.5;
        }
      }
    }
  };

  HZ.Humanoid = Humanoid;
  HZ.Stalker = Stalker;
  HZ.Mannequin = Mannequin;
})();
