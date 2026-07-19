'use strict';
/* ============================================================
   actors.js — 演员工厂 / 姿势库 / 表演动作
   低面数积木人 + 戏服系统(裙装/军装/斗牛士华服) + 关节动画
   ============================================================ */
var Actors = (function(){
  var T = Theater;
  var cast = {};       // 名字 → actor
  var allActors = [];

  /* ============================================================
     演员工厂
     def: {
       skin, hair, hairLong, body(上衣), coat(外套), pants, shoe,
       dress:{tiers:[颜色], len}, sash(腰带色), epaulet(肩章色),
       hat:{type:'kepi'|'montera'|'brim'|'bandana'|'mantilla', color},
       flower(发花色), earring(耳环), tie, apron, beard,
       eye, scale, brow(眉型 'angry'|'soft')
     }
     ============================================================ */
  function makeActor(name, def){
    var S = def.scale||1;
    var root = new THREE.Group();

    var hips = new THREE.Group(); hips.position.y = 8.4*S; root.add(hips);

    /* --- 躯干 --- */
    var torso = T.box(4.6*S, 6*S, 2.8*S, def.coat||def.body||'#3a4356');
    torso.position.y = 3*S; hips.add(torso);
    if(def.coat && def.body){
      var shirt = T.box(3.4*S, 3.2*S, 3*S, def.body);
      shirt.position.set(0, 3.6*S, 0.1*S); hips.add(shirt);
    }
    if(def.sash){
      var sash = T.box(4.9*S, 1.5*S, 3.1*S, def.sash);
      sash.position.y = 0.4*S; hips.add(sash);
    }
    if(def.tie){
      var tie = T.box(1*S, 2.6*S, 0.3*S, def.tie);
      tie.position.set(0, 4*S, 1.6*S); hips.add(tie);
    }
    if(def.apron){
      var ap = T.box(4*S, 4.5*S, 0.4*S, def.apron);
      ap.position.set(0, 0.6*S, 1.6*S); hips.add(ap);
    }
    if(def.epaulet){
      var epL = T.box(1.8*S, 0.7*S, 2.2*S, def.epaulet);
      epL.position.set(-2.6*S, 5.7*S, 0); hips.add(epL);
      var epR = epL.clone(); epR.position.x = 2.6*S; hips.add(epR);
    }
    /* 胸前纽扣列 */
    if(def.buttons){
      for(var bi=0;bi<3;bi++){
        var btn = T.box(0.5*S,0.5*S,0.2*S, def.buttons);
        btn.position.set(0, 1.6*S+bi*1.6*S, 1.55*S); hips.add(btn);
      }
    }
    /* 斗牛士金饰 */
    if(def.braid){
      var brd = T.box(0.7*S, 5*S, 0.3*S, def.braid);
      brd.position.set(-1.9*S, 3*S, 1.5*S); hips.add(brd);
      var brd2 = brd.clone(); brd2.position.x = 1.9*S; hips.add(brd2);
    }

    /* --- 头部 --- */
    var neck = new THREE.Group(); neck.position.y = 6.4*S; hips.add(neck);
    var head = T.box(3.4*S, 3.4*S, 3.2*S, def.skin||'#e8b98c');
    head.position.y = 1.8*S; neck.add(head);
    if(def.hair){
      var hair = T.box(3.8*S, 1.6*S, 3.6*S, def.hair);
      hair.position.y = 3.4*S; neck.add(hair);
      var hairB = T.box(3.8*S, 2.4*S, 1*S, def.hair);
      hairB.position.set(0, 2.4*S, -1.4*S); neck.add(hairB);
    }
    if(def.hairLong){ /* 长发披落 */
      var hl = T.box(3.6*S, 4.6*S, 1*S, def.hair);
      hl.position.set(0, 0.4*S, -1.8*S); neck.add(hl);
    }
    if(def.bun){ /* 发髻 */
      var bun = T.sph(1.1*S, def.hair);
      bun.position.set(0, 3.6*S, -1.2*S); neck.add(bun);
    }
    var hatDef = def.hat;
    if(hatDef){
      if(hatDef.type==='kepi'){ /* 军帽 */
        var kp = T.cyl(1.9*S, 2.1*S, 1.6*S, 8, hatDef.color);
        kp.position.y = 4*S; neck.add(kp);
        var kpTop = T.cyl(2*S, 2*S, 0.4*S, 8, hatDef.band||hatDef.color);
        kpTop.position.y = 4.9*S; neck.add(kpTop);
        var kpBrim = T.box(2.4*S, 0.3*S, 1.4*S, '#1a1a20');
        kpBrim.position.set(0, 3.4*S, 2*S); neck.add(kpBrim);
      } else if(hatDef.type==='montera'){ /* 斗牛士帽 */
        var mt = T.box(3.9*S, 1.4*S, 3.5*S, hatDef.color);
        mt.position.y = 3.9*S; neck.add(mt);
        var mtL = T.sph(1*S, hatDef.color);
        mtL.position.set(-1.9*S, 3.8*S, 0); neck.add(mtL);
        var mtR = mtL.clone(); mtR.position.x = 1.9*S; neck.add(mtR);
      } else if(hatDef.type==='brim'){ /* 宽檐帽 */
        var bTop = T.cyl(1.8*S, 2*S, 1.6*S, 8, hatDef.color);
        bTop.position.y = 4.2*S; neck.add(bTop);
        var bBrim = T.cyl(3.4*S, 3.4*S, 0.34*S, 10, hatDef.color);
        bBrim.position.y = 3.5*S; neck.add(bBrim);
      } else if(hatDef.type==='bandana'){ /* 头巾 */
        var bd = T.box(3.7*S, 1.5*S, 3.5*S, hatDef.color);
        bd.position.y = 3.5*S; neck.add(bd);
        var bdKnot = T.box(1*S, 1*S, 1*S, hatDef.color);
        bdKnot.position.set(0, 3*S, -2*S); neck.add(bdKnot);
      } else if(hatDef.type==='mantilla'){ /* 蕾丝头纱 */
        var mtl = T.box(4*S, 1.2*S, 3.8*S, hatDef.color);
        mtl.position.y = 3.6*S; neck.add(mtl);
        var mtlB = T.box(4.2*S, 5*S, 0.7*S, hatDef.color);
        mtlB.position.set(0, 0.6*S, -2*S); neck.add(mtlB);
      }
    }
    if(def.flower){ /* 发间红花 */
      var fl = new THREE.Group();
      for(var fp=0;fp<4;fp++){
        var pet = T.sph(0.55*S, def.flower);
        pet.position.set(Math.cos(fp*Math.PI/2)*0.5*S, Math.sin(fp*Math.PI/2)*0.5*S, 0);
        fl.add(pet);
      }
      var flC = T.sph(0.4*S, '#ffd24a'); fl.add(flC);
      fl.position.set(1.7*S, 3.2*S, 1.2*S); neck.add(fl);
    }
    if(def.earring){
      var erL = T.box(0.35*S, 0.9*S, 0.35*S, def.earring);
      erL.position.set(-1.85*S, 1*S, 0.4*S); neck.add(erL);
      var erR = erL.clone(); erR.position.x = 1.85*S; neck.add(erR);
    }
    if(def.beard){
      var beard = T.box(3*S, 1.6*S, 0.8*S, def.beard);
      beard.position.set(0, 0.5*S, 1.5*S); neck.add(beard);
    }
    /* 眼睛 */
    var eyeL = T.box(0.5*S, 0.66*S, 0.2*S, def.eye||'#181820');
    eyeL.position.set(-0.8*S, 2*S, 1.7*S); neck.add(eyeL);
    var eyeR = eyeL.clone(); eyeR.position.x = 0.8*S; neck.add(eyeR);
    /* 眉 */
    if(def.brow==='angry'){
      var bwL = T.box(0.9*S, 0.24*S, 0.2*S, def.hair||'#241c14');
      bwL.position.set(-0.8*S, 2.6*S, 1.7*S); bwL.rotation.z = -0.35; neck.add(bwL);
      var bwR = bwL.clone(); bwR.position.x = 0.8*S; bwR.rotation.z = 0.35; neck.add(bwR);
    } else if(def.brow==='soft'){
      var bwL2 = T.box(0.9*S, 0.2*S, 0.2*S, def.hair||'#241c14');
      bwL2.position.set(-0.8*S, 2.7*S, 1.7*S); bwL2.rotation.z = 0.18; neck.add(bwL2);
      var bwR2 = bwL2.clone(); bwR2.position.x = 0.8*S; bwR2.rotation.z = -0.18; neck.add(bwR2);
    }
    /* 唇 (女性角色点缀) */
    if(def.lips){
      var lp = T.box(1*S, 0.36*S, 0.2*S, def.lips);
      lp.position.set(0, 0.9*S, 1.7*S); neck.add(lp);
    }

    /* --- 手臂 --- */
    function arm(side){
      var g = new THREE.Group();
      g.position.set(side*2.8*S, 5.6*S, 0); hips.add(g);
      var sleeve = def.sleeve||def.coat||def.body||'#3a4356';
      var upper = T.box(1.4*S, 3.4*S, 1.4*S, sleeve);
      upper.position.y = -1.5*S; g.add(upper);
      var elbow = new THREE.Group(); elbow.position.y = -3.2*S; g.add(elbow);
      var fore = T.box(1.2*S, 3*S, 1.2*S, def.foreArm||sleeve);
      fore.position.y = -1.4*S; elbow.add(fore);
      var hand = T.box(1.3*S, 1.2*S, 1.3*S, def.skin||'#e8b98c');
      hand.position.y = -3*S; elbow.add(hand);
      var grip = new THREE.Group(); grip.position.y = -3*S; elbow.add(grip);
      return {shoulder:g, elbow:elbow, hand:hand, grip:grip};
    }
    var armL = arm(-1), armR = arm(1);

    /* --- 下身: 裤装或裙装 --- */
    var legL=null, legR=null, skirt=null;
    if(def.dress){
      skirt = new THREE.Group();
      var tiers = def.dress.tiers || ['#a02030','#8a1828','#701020'];
      var topR = 2.6*S, len = def.dress.len||8.2;
      for(var i=0;i<tiers.length;i++){
        var p = i/(tiers.length-1||1);
        var r1 = lerp(topR, topR+2.6*S, i? (i-0.02)/tiers.length :0);
        var r2 = lerp(topR+1.2*S, topR+3.6*S, (i+1)/tiers.length);
        var th = (len*S)/tiers.length + 0.3*S;
        var tier = T.cyl(lerp(topR,topR+2.4*S,i/tiers.length), r2, th, 10, tiers[i]);
        tier.position.y = -len*S*(i+0.5)/tiers.length + 0.4*S;
        skirt.add(tier);
      }
      hips.add(skirt);
      /* 裙下鞋尖 */
      var toeL = T.box(1.3*S, 0.8*S, 2*S, def.shoe||'#28141c');
      toeL.position.set(-1.1*S, -7.9*S, 1*S); hips.add(toeL);
      var toeR = toeL.clone(); toeR.position.x = 1.1*S; hips.add(toeR);
    } else {
      function leg(side){
        var g = new THREE.Group();
        g.position.set(side*1.2*S, 0, 0); hips.add(g);
        var thigh = T.box(1.7*S, 4*S, 1.9*S, def.pants||'#2a2c3c');
        thigh.position.y = -1.8*S; g.add(thigh);
        var knee = new THREE.Group(); knee.position.y = -3.8*S; g.add(knee);
        var shin = T.box(1.5*S, 3.6*S, 1.6*S, def.boots||def.pants||'#2a2c3c');
        shin.position.y = -1.8*S; knee.add(shin);
        var foot = T.box(1.6*S, 1*S, 2.6*S, def.shoe||'#181822');
        foot.position.set(0, -3.9*S, 0.5*S); knee.add(foot);
        return {hip:g, knee:knee};
      }
      legL = leg(-1); legR = leg(1);
    }

    var actor = {
      name:name, root:root, hips:hips, neck:neck,
      armL:armL, armR:armR, legL:legL, legR:legR, skirt:skirt,
      S:S, walkPhase:0, pose:'idle', poseA:1,
      baseHipY: 8.4*S, breathe:true, headYaw:0, headTilt:0,
      dress: !!def.dress
    };
    T.scene().add(root);
    allActors.push(actor);
    if(name) cast[name] = actor;
    return actor;
  }

  /* ============================================================
     姿势库
     ============================================================ */
  var POSES = {
    idle:      { alz:0.06, arz:-0.06 },
    /* 卡门: 手叉腰 */
    sass:      { alz:0.9, arz:-0.9, ael:-1.3, aer:-1.3, hipRZ:0.06 },
    /* 卡门: 单手叉腰, 一手垂 */
    sassHalf:  { alz:0.06, arz:-0.9, aer:-1.3, hipRZ:-0.04 },
    /* 弗拉门戈: 双臂高举弧线 */
    flamencoUp:{ alx:-2.9, arx:-2.9, alz:0.5, arz:-0.5, ael:-0.5, aer:-0.5, hipRZ:0.08, neckRX:-0.15 },
    /* 弗拉门戈: 一臂上一臂平 */
    flamencoL: { alx:-2.9, alz:0.4, ael:-0.4, arx:-0.3, arz:-1.2, aer:-0.3, hipRZ:-0.1 },
    flamencoR: { arx:-2.9, arz:-0.4, aer:-0.4, alx:-0.3, alz:1.2, ael:-0.3, hipRZ:0.1 },
    /* 掷花: 手于唇边 */
    roseKiss:  { arx:-2.2, aer:-1.5, alz:0.5, ael:-0.6, neckRX:0.08 },
    /* 军姿 */
    attention: { alz:0.02, arz:-0.02 },
    salute:    { arx:-2.3, aer:-2.4, alz:0.02 },
    /* 守卫持枪(枪由道具) */
    guard:     { alx:-0.7, ael:-0.9, arx:-0.5, aer:-0.6 },
    /* 恳求/伸手 */
    plead:     { alx:-1.5, arx:-1.5, ael:-0.35, aer:-0.35, neckRX:0.12, hipRX:0.08 },
    reachOne:  { arx:-1.6, aer:-0.2, alz:0.2 },
    /* 拒绝: 转头抱臂 */
    refuse:    { alx:-1.05, arx:-1.05, ael:-1.45, aer:-1.45, neckRX:0.04 },
    /* 斗牛士亮相: 挺胸, 单臂展开 */
    torero:    { arx:-1.2, arz:-1.5, aer:-0.2, alz:0.7, ael:-1.1, hipRX:-0.07, neckRX:-0.1 },
    toreroBow: { arx:-0.6, arz:-1.6, alx:-0.6, alz:1.6, hipRX:0.5, neckRX:0.3 },
    /* 敬酒 */
    toast:     { arx:-1.9, aer:-0.9, alz:0.3 },
    /* 坐姿 */
    sit:       { llx:-1.5, lrx:-1.5, kl:1.5, kr:1.5, hipDY:-1.5, alx:-0.55, arx:-0.55, ael:-0.7, aer:-0.7 },
    sitSlump:  { llx:-1.4, lrx:-1.5, kl:1.6, kr:1.4, hipDY:-1.8, hipRX:0.2, alx:-0.3, arx:-0.9, aer:-1.5, neckRX:0.35 },
    /* 跪 */
    kneel:     { alx:-0.6, arx:-0.9, ael:-0.7, aer:-1.1, llx:-1.5, lrx:-0.5, kl:2.1, kr:1.8, hipDY:-3.4, hipRX:0.25, neckRX:0.3 },
    kneelDown: { alx:-0.9, arx:-0.9, ael:-1.2, aer:-1.2, llx:-1.5, lrx:-1.5, kl:2.2, kr:2.2, hipDY:-4.2, hipRX:0.4, neckRX:0.45 },
    /* 倒地 */
    lie:       { alx:0.3, arx:-2.6, ael:-0.2, aer:-0.3, llx:0.15, lrx:-0.2, kl:0.25, kr:0.1, hipDY:-6.4, hipRX:-1.45, hipRZ:0.08, neckRX:-0.2 },
    lieSide:   { alx:-0.8, arx:0.4, ael:-0.9, aer:-0.2, llx:0.3, lrx:-0.4, kl:0.5, kr:0.7, hipDY:-6.6, hipRX:-1.3, hipRZ:-0.5, neckRX:-0.1 },
    /* 持刀低伏 */
    knife:     { arx:-0.9, aer:-0.9, alx:-0.4, ael:-0.5, hipRX:0.14, neckRX:0.05 },
    lunge:     { arx:-1.7, aer:-0.1, alx:0.5, llx:-0.9, lrx:0.5, kl:1.2, hipDY:-1.6, hipRX:0.3 },
    /* 惊愕 */
    shock:     { alx:-2.5, arx:-2.5, ael:-0.4, aer:-0.4, llx:-0.15, lrx:0.15, kl:0.15, kr:0.15, hipDY:-0.6, hipRX:-0.12, neckRX:-0.3 },
    /* 踉跄 */
    stagger:   { alx:-0.7, arx:0.5, ael:-0.9, aer:-0.3, llx:-0.4, lrx:0.5, kl:0.7, hipDY:-1, hipRX:-0.2, hipRZ:0.15, neckRX:-0.25 },
    /* 掩面 */
    grief:     { alx:-2.1, arx:-2.1, ael:-1.9, aer:-1.9, hipRX:0.18, neckRX:0.4 },
    /* 环抱(尸体) */
    cradle:    { alx:-1.2, arx:-1.2, ael:-1.1, aer:-1.1, llx:-1.5, lrx:-1.5, kl:2.2, kr:2.2, hipDY:-4.4, hipRX:0.5, neckRX:0.55 },
    /* 谢幕鞠躬 */
    bow:       { hipRX:0.62, neckRX:0.2, alz:0.35, arz:-0.35, alx:0.2, arx:0.2 },
    bowDeep:   { hipRX:0.85, neckRX:0.3, arx:-0.5, arz:-1.4, alz:0.4 },
    /* 挽臂微倚 */
    lean:      { alx:0.2, arx:-1.3, ael:-0.15, aer:-1.2, hipRZ:-0.12, neckRX:0.1 },
    /* 争执逼近 */
    confront:  { alx:-0.9, arx:-1.3, ael:-0.5, aer:-0.3, hipRX:0.1, neckRX:-0.05 },
    /* 抛掷 */
    throwPose: { arx:-2.6, aer:-0.2, alz:0.3, hipRZ:-0.08 },
    /* 舞步定格: 裙摆手 */
    skirtHold: { alx:-0.5, alz:0.7, ael:-1.0, arx:-0.5, arz:-0.7, aer:-1.0 },
    /* 死亡拥抱前的对峙 */
    despair:   { alx:-1.3, arx:-1.3, ael:-0.9, aer:-0.9, hipRX:0.22, neckRX:0.5 }
  };

  function setPose(actor, poseName, instant){
    actor.pose = POSES[poseName] ? poseName : 'idle';
    actor.poseA = instant ? 1 : 0;
    if(instant) applyPose(actor, 10, true);
  }
  function applyPose(actor, dt, hard){
    if(!actor.pose) return;
    var p = POSES[actor.pose];
    if(actor.poseA<1) actor.poseA = Math.min(1, actor.poseA + dt*4);
    var a = hard ? 1 : easeInOut(actor.poseA)*Math.min(1, dt*7);
    function L(cur, tgt){ return lerp(cur, tgt, a); }
    actor.armL.shoulder.rotation.x = L(actor.armL.shoulder.rotation.x, p.alx||0);
    actor.armR.shoulder.rotation.x = L(actor.armR.shoulder.rotation.x, p.arx||0);
    actor.armL.shoulder.rotation.z = L(actor.armL.shoulder.rotation.z, p.alz||0);
    actor.armR.shoulder.rotation.z = L(actor.armR.shoulder.rotation.z, p.arz||0);
    actor.armL.elbow.rotation.x = L(actor.armL.elbow.rotation.x, p.ael||0);
    actor.armR.elbow.rotation.x = L(actor.armR.elbow.rotation.x, p.aer||0);
    if(actor.legL){
      actor.legL.hip.rotation.x = L(actor.legL.hip.rotation.x, p.llx||0);
      actor.legR.hip.rotation.x = L(actor.legR.hip.rotation.x, p.lrx||0);
      actor.legL.knee.rotation.x = L(actor.legL.knee.rotation.x, p.kl||0);
      actor.legR.knee.rotation.x = L(actor.legR.knee.rotation.x, p.kr||0);
    }
    actor.hips.position.y = L(actor.hips.position.y, actor.baseHipY + (p.hipDY||0)*actor.S);
    actor.hips.rotation.x = L(actor.hips.rotation.x, p.hipRX||0);
    actor.hips.rotation.z = L(actor.hips.rotation.z, p.hipRZ||0);
    actor.neck.rotation.x = L(actor.neck.rotation.x, (p.neckRX||0) + actor.headTilt);
    actor.neck.rotation.y = L(actor.neck.rotation.y, actor.headYaw);
    if(actor.breathe && (actor.pose==='idle'||actor.pose==='sass'||actor.pose==='sassHalf'||
       actor.pose==='attention'||actor.pose==='lean'||actor.pose==='sit')){
      var br = Math.sin(performance.now()/1000*2 + actor.baseHipY)*0.018;
      actor.hips.scale.y = 1+br;
    }
  }

  /* ============================================================
     行走 — 带步态个性
     ============================================================ */
  function walkTo(actor, targetX, opts, done){
    opts = opts||{};
    var speed = opts.speed||15;
    actor._wt = (actor._wt||0)+1;
    var token = actor._wt;
    actor.pose = null;
    var g = opts.gait || actor.gait || {stride:1, bounce:1, arm:1, sway:0};
    var dir = targetX > actor.root.position.x ? 1 : -1;
    actor.root.rotation.y = dir>0 ? Math.PI/2 : -Math.PI/2;
    var targetZ = opts.z;
    var startZ = actor.root.position.z;
    var startX = actor.root.position.x;
    var totalD = Math.abs(targetX-startX)||1;
    T.animate(function(dt){
      if(actor._wt !== token) return true;
      var dx = targetX - actor.root.position.x;
      if(Math.abs(dx) < 1.2){
        if(!opts.keepFace) actor.root.rotation.y = opts.face!==undefined ? opts.face : 0;
        actor.walkPhase = 0;
        actor.hips.rotation.z = 0;
        setPose(actor, opts.pose||'idle');
        if(done) done();
        return true;
      }
      actor.root.position.x += Math.sign(dx)*speed*dt;
      if(targetZ!==undefined){
        var prog = Math.abs(actor.root.position.x-startX)/totalD;
        actor.root.position.z = lerp(startZ, targetZ, prog);
      }
      actor.walkPhase += dt*speed*0.72*g.stride;
      var sw = Math.sin(actor.walkPhase);
      var sw2 = Math.sin(actor.walkPhase+Math.PI);
      if(actor.legL){
        actor.legL.hip.rotation.x = sw*0.62;
        actor.legR.hip.rotation.x = sw2*0.62;
        actor.legL.knee.rotation.x = Math.max(0,-sw)*0.9;
        actor.legR.knee.rotation.x = Math.max(0,-sw2)*0.9;
      }
      if(actor.skirt){ /* 裙摆摇曳 */
        actor.skirt.rotation.x = Math.sin(actor.walkPhase)*0.06;
        actor.skirt.rotation.z = Math.cos(actor.walkPhase*0.5)*0.08;
        actor.hips.rotation.z = Math.sin(actor.walkPhase*0.5)*0.055*(1+(g.sway||0));
      }
      actor.armL.shoulder.rotation.x = sw2*0.42*g.arm;
      actor.armR.shoulder.rotation.x = sw*0.42*g.arm;
      actor.hips.position.y = actor.baseHipY + Math.abs(Math.cos(actor.walkPhase))*0.5*g.bounce;
      return false;
    });
  }
  function stopWalk(actor, pose){
    actor._wt = (actor._wt||0)+1;
    setPose(actor, pose||'idle');
  }
  /* 面向: dir = 1右 -1左 0镜头 */
  function face(actor, dir, dur){
    var ty = dir===0 ? 0 : (dir>0 ? Math.PI/2 : -Math.PI/2);
    if(dir==='back') ty = Math.PI;
    var from = actor.root.rotation.y;
    /* 卷绕最短路径 */
    var d = ty-from;
    while(d>Math.PI) d-=Math.PI*2;
    while(d<-Math.PI) d+=Math.PI*2;
    var t=0;
    T.animate(function(dt){
      t += dt/(dur||0.4);
      if(t>=1){ actor.root.rotation.y=ty; return true; }
      actor.root.rotation.y = from + d*easeInOut(t);
      return false;
    });
  }
  function headTo(actor, yaw, tilt){
    actor.headYaw = yaw||0;
    actor.headTilt = tilt||0;
  }

  /* ============================================================
     表情气泡
     ============================================================ */
  var emoteTexCache = {};
  function emoteTexture(type){
    if(emoteTexCache[type]) return emoteTexCache[type];
    var c = makeCanvas(32,32);
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    function glyph(ch, color){
      x.font = 'bold 25px Arial';
      x.textAlign='center'; x.textBaseline='middle';
      x.lineWidth = 5; x.strokeStyle = '#10101c';
      x.strokeText(ch, 16, 18);
      x.fillStyle = color;
      x.fillText(ch, 16, 18);
    }
    if(type==='!'){ glyph('!', '#ff6a5a'); }
    else if(type==='?'){ glyph('?', '#7fc0ff'); }
    else if(type==='note'){ glyph('\u266A', '#ffd24a'); }
    else if(type==='dots'){ glyph('\u2026', '#d0d0e0'); }
    else if(type==='heart'){
      x.lineWidth=4; x.strokeStyle='#3a0a14';
      x.fillStyle='#ff4a6a';
      x.beginPath();
      x.moveTo(16,27);
      x.bezierCurveTo(2,16, 6,4, 16,11);
      x.bezierCurveTo(26,4, 30,16, 16,27);
      x.closePath(); x.stroke(); x.fill();
      x.fillStyle='#ff9ab2'; x.fillRect(10,10,3,3);
    }
    else if(type==='brokenHeart'){
      x.lineWidth=4; x.strokeStyle='#3a0a14';
      x.fillStyle='#b02a44';
      x.beginPath();
      x.moveTo(16,27);
      x.bezierCurveTo(2,16, 6,4, 16,11);
      x.bezierCurveTo(26,4, 30,16, 16,27);
      x.closePath(); x.stroke(); x.fill();
      x.strokeStyle='#2a0810'; x.lineWidth=2.5;
      x.beginPath();
      x.moveTo(16,9); x.lineTo(13,14); x.lineTo(17,18); x.lineTo(14,24);
      x.stroke();
    }
    else if(type==='anger'){
      x.strokeStyle='#ff5a5a'; x.lineWidth=4; x.lineCap='round';
      [[0,-1],[0,1],[-1,0],[1,0]].forEach(function(d){
        x.beginPath();
        x.arc(16+d[0]*9, 16+d[1]*9, 6,
          Math.atan2(d[1],d[0])-0.9, Math.atan2(d[1],d[0])+0.9);
        x.stroke();
      });
    }
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    emoteTexCache[type] = tex;
    return tex;
  }
  function emote(actor, type, opts){
    opts = opts||{};
    var tex = emoteTexture(type);
    var m = new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false});
    var sp = new THREE.Sprite(m);
    sp.renderOrder = 999;
    var base = actor.root.position;
    var yOff = opts.y !== undefined ? opts.y : 19.5*actor.S;
    T.scene().add(sp);
    var t=0, dur = opts.dur||1.3;
    T.animate(function(dt){
      t+=dt;
      var pop = t<0.16 ? easeOut(t/0.16)*1.15 : (t<0.3 ? 1.15-((t-0.16)/0.14)*0.15 : 1);
      var s = 7*pop;
      sp.scale.set(s,s,1);
      sp.position.set(base.x+2.5, base.y+yOff+Math.sin(t*5)*0.5, base.z+4);
      if(t>dur-0.22) m.opacity = Math.max(0,(dur-t)/0.22);
      if(t>=dur){ T.scene().remove(sp); m.dispose(); return true; }
      return false;
    });
  }

  /* ============================================================
     道具工厂
     ============================================================ */
  function makeRose(){
    var g = new THREE.Group();
    var stem = T.cyl(0.14, 0.14, 3.4, 5, '#2a6030');
    stem.position.y = -1.4; g.add(stem);
    var bloom = new THREE.Group();
    for(var i=0;i<5;i++){
      var pet = T.sph(0.52, i%2 ? '#c01830' : '#e02540');
      pet.position.set(Math.cos(i*Math.PI*2/5)*0.42, Math.sin(i*Math.PI*2/5)*0.42*0.5, (i%2)*0.16);
      bloom.add(pet);
    }
    var core = T.sph(0.42, '#8a0f20'); bloom.add(core);
    bloom.position.y = 0.4;
    g.add(bloom);
    var leaf = T.box(1, 0.16, 0.5, '#337038');
    leaf.position.set(0.4, -1.6, 0); leaf.rotation.z = -0.5; g.add(leaf);
    return g;
  }
  function makeKnife(){
    var g = new THREE.Group();
    var blade = T.box(0.34, 3.2, 0.12, '#c8d0e0');
    blade.position.y = 2.2; g.add(blade);
    var tip = T.cone(0.24, 0.8, 4, '#dde4f0');
    tip.position.y = 4.2; g.add(tip);
    var guard = T.box(1.1, 0.3, 0.34, '#6a5230');
    guard.position.y = 0.6; g.add(guard);
    var grip = T.cyl(0.24, 0.28, 1.2, 6, '#3a2a1a');
    grip.position.y = 0; g.add(grip);
    return g;
  }
  function makeFan(color){
    var g = new THREE.Group();
    for(var i=0;i<6;i++){
      var b = T.box(0.24, 3, 0.08, color||'#c8323c');
      b.position.y = 1.4;
      var w = new THREE.Group();
      w.rotation.z = -0.75 + i*0.3;
      w.add(b); g.add(w);
    }
    return g;
  }
  function makeGuitar(){
    var g = new THREE.Group();
    var body = T.cyl(2.4, 2.4, 0.9, 10, '#8a5a2c');
    body.rotation.x = Math.PI/2; g.add(body);
    var body2 = T.cyl(1.9, 1.9, 0.95, 10, '#8a5a2c');
    body2.rotation.x = Math.PI/2; body2.position.y = 2.4; g.add(body2);
    var hole = T.cyl(0.8, 0.8, 0.3, 8, '#2a180c');
    hole.rotation.x = Math.PI/2; hole.position.set(0,0.6,0.4); g.add(hole);
    var fret = T.box(0.7, 5.6, 0.5, '#4a2c14');
    fret.position.y = 5; g.add(fret);
    var headstock = T.box(1, 1.4, 0.6, '#3a2210');
    headstock.position.y = 8; g.add(headstock);
    return g;
  }
  function makeTambourine(){
    var g = new THREE.Group();
    var rim = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.28, 5, 12), T.mat('#a4762e'));
    g.add(rim);
    var skin = T.cyl(1.66, 1.66, 0.14, 12, '#e8d8b0');
    skin.rotation.x = Math.PI/2; g.add(skin);
    for(var i=0;i<5;i++){
      var jangle = T.box(0.4,0.5,0.08,'#d8c060');
      var a = i*Math.PI*2/5;
      jangle.position.set(Math.cos(a)*1.7, Math.sin(a)*1.7, 0);
      g.add(jangle);
    }
    return g;
  }
  function makeCape(color, back){
    /* 斗牛士披风 — 挂在手上的布片 */
    var g = new THREE.Group();
    var cloth = new THREE.Mesh(new THREE.PlaneGeometry(7, 8, 4, 4),
      new THREE.MeshToonMaterial({color:new THREE.Color(color||'#c0203a'),
        gradientMap:T.gradTex(), side:THREE.DoubleSide}));
    cloth.position.y = -4;
    g.add(cloth);
    g.userData.cloth = cloth;
    g.userData.base = cloth.geometry.attributes.position.array.slice();
    return g;
  }
  function makeMug(){
    var g = new THREE.Group();
    var cup = T.cyl(0.8, 0.65, 1.5, 8, '#b08040');
    g.add(cup);
    var foam = T.cyl(0.72, 0.72, 0.3, 8, '#f0e8d0');
    foam.position.y = 0.8; g.add(foam);
    return g;
  }
  function makeRifle(){
    var g = new THREE.Group();
    var barrel = T.cyl(0.18, 0.18, 7, 6, '#3a3a44');
    barrel.position.y = 1.8; g.add(barrel);
    var stock = T.box(0.6, 3.4, 0.9, '#5a3c22');
    stock.position.y = -2; g.add(stock);
    return g;
  }

  /* ============================================================
     组合动作 — 高级演出模块
     ============================================================ */

  /* 卡门哈巴涅拉舞: 持续摇曳直到 stop */
  function habaneraDance(actor){
    actor._dance = true;
    actor.pose = null;
    var t = 0;
    var phase = 0;   // 0-左臂舞 1-右臂舞 交替
    T.animate(function(dt){
      if(!actor._dance) return true;
      t += dt;
      var beat = t*1.7;
      /* 髋部8字摇 */
      actor.hips.rotation.z = Math.sin(beat)*0.12;
      actor.hips.rotation.y = Math.sin(beat*0.5)*0.22;
      actor.hips.position.y = actor.baseHipY + Math.abs(Math.sin(beat))*0.5;
      if(actor.skirt){
        actor.skirt.rotation.z = Math.sin(beat+0.6)*0.13;
        actor.skirt.rotation.x = Math.cos(beat*0.5)*0.06;
      }
      /* 手臂交替划弧 */
      var armT = (Math.sin(beat*0.5)+1)/2;
      actor.armL.shoulder.rotation.x = lerp(-0.3, -2.7, armT);
      actor.armL.shoulder.rotation.z = lerp(0.6, 0.35, armT);
      actor.armL.elbow.rotation.x = lerp(-0.9, -0.4, armT);
      actor.armR.shoulder.rotation.x = lerp(-2.7, -0.3, armT);
      actor.armR.shoulder.rotation.z = lerp(-0.35, -0.6, armT);
      actor.armR.elbow.rotation.x = lerp(-0.4, -0.9, armT);
      /* 头部媚态 */
      actor.neck.rotation.z = Math.sin(beat*0.5+1)*0.14;
      actor.neck.rotation.x = -0.06+Math.sin(beat*0.25)*0.06;
      return false;
    });
  }
  /* 狂热弗拉门戈(酒馆) — speed 会被外部逐渐调快 */
  function flamencoDance(actor, getSpeed){
    actor._dance = true;
    actor.pose = null;
    var t = 0;
    T.animate(function(dt){
      if(!actor._dance) return true;
      var sp = getSpeed ? getSpeed() : 1;
      t += dt*sp;
      var beat = t*2.4;
      actor.hips.rotation.y = Math.sin(beat*0.5)*0.5;
      actor.hips.rotation.z = Math.sin(beat)*0.1;
      actor.hips.position.y = actor.baseHipY + Math.abs(Math.sin(beat*1))*0.9;
      if(actor.skirt){
        actor.skirt.rotation.z = Math.sin(beat+0.5)*0.22;
        actor.skirt.rotation.x = Math.cos(beat*0.7)*0.1;
        actor.skirt.scale.x = 1+Math.abs(Math.sin(beat*0.5))*0.12;
        actor.skirt.scale.z = 1+Math.abs(Math.cos(beat*0.5))*0.12;
      }
      var armT = (Math.sin(beat*0.5)+1)/2;
      actor.armL.shoulder.rotation.x = lerp(-0.4, -2.9, armT);
      actor.armL.shoulder.rotation.z = 0.5;
      actor.armL.elbow.rotation.x = -0.5;
      actor.armR.shoulder.rotation.x = lerp(-2.9, -0.4, armT);
      actor.armR.shoulder.rotation.z = -0.5;
      actor.armR.elbow.rotation.x = -0.5;
      actor.neck.rotation.z = Math.sin(beat*0.5)*0.16;
      actor.root.rotation.y = Math.sin(beat*0.25)*0.7;
      return false;
    });
  }
  /* 旋转一周(裙摆飞扬) */
  function spinOnce(actor, dur, done){
    actor._dance = false;
    var t=0, from = actor.root.rotation.y;
    T.animate(function(dt){
      t += dt/(dur||0.9);
      if(t>=1){
        actor.root.rotation.y = from;
        if(actor.skirt){ actor.skirt.scale.set(1,1,1); }
        if(done)done(); return true;
      }
      actor.root.rotation.y = from + easeInOut(t)*Math.PI*2;
      if(actor.skirt){
        var fl = Math.sin(t*Math.PI);
        actor.skirt.scale.x = 1+fl*0.28;
        actor.skirt.scale.z = 1+fl*0.28;
      }
      actor.hips.position.y = actor.baseHipY + Math.sin(t*Math.PI)*1;
      return false;
    });
  }
  function stopDance(actor, pose){
    actor._dance = false;
    actor.hips.rotation.y = 0;
    actor.neck.rotation.z = 0;
    if(actor.skirt){ actor.skirt.scale.set(1,1,1); actor.skirt.rotation.set(0,0,0); }
    setPose(actor, pose||'idle');
  }
  /* 跺脚 */
  function stomp(actor, done){
    var t=0;
    AudioSys.sfx.stomp();
    T.animate(function(dt){
      t+=dt;
      actor.hips.position.y = actor.baseHipY - Math.sin(Math.min(1,t/0.2)*Math.PI)*1.2;
      if(t>0.22){ if(done)done(); return true; }
      return false;
    });
  }
  /* 受惊小跳 */
  function startle(actor, done){
    setPose(actor,'shock');
    var t=0, by=actor.root.position.y;
    T.animate(function(dt){
      t+=dt;
      actor.root.position.y = by + Math.max(0, Math.sin(clamp01(t/0.3)*Math.PI))*2.2;
      if(t>0.32){ actor.root.position.y=by; if(done)done(); return true; }
      return false;
    });
  }
  /* 醉步摇晃行走已可用 gait 表达; 人群欢腾跳跃 */
  function crowdCheer(actors, dur){
    actors.forEach(function(a, i){
      var t = -i*0.1;
      T.animate(function(dt){
        t+=dt;
        if(t<0) return false;
        if(t>dur){ a.root.position.y=0; return true; }
        a.root.position.y = Math.abs(Math.sin(t*6+i))*1.6;
        a.armL.shoulder.rotation.x = -2.6+Math.sin(t*6+i)*0.3;
        a.armR.shoulder.rotation.x = -2.6+Math.cos(t*6+i*2)*0.3;
        return false;
      });
    });
  }

  function actorOf(n){ return cast[n]; }

  return {
    makeActor:makeActor, cast:cast, actorOf:actorOf,
    setPose:setPose, applyPoses:function(dt){
      for(var i=0;i<allActors.length;i++){
        var a=allActors[i];
        if(a.pose) applyPose(a, dt);
      }
    },
    walkTo:walkTo, stopWalk:stopWalk, face:face, headTo:headTo,
    emote:emote,
    makeRose:makeRose, makeKnife:makeKnife, makeFan:makeFan,
    makeGuitar:makeGuitar, makeTambourine:makeTambourine,
    makeCape:makeCape, makeMug:makeMug, makeRifle:makeRifle,
    habaneraDance:habaneraDance, flamencoDance:flamencoDance,
    spinOnce:spinOnce, stopDance:stopDance, stomp:stomp,
    startle:startle, crowdCheer:crowdCheer,
    POSES:POSES
  };
})();
