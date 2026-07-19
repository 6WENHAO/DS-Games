'use strict';
/* ============================================================
   play.js — 《卡门》三幕剧本 (小剧场版)
   镜头原则: 观众席固定机位为主 — 全景/横移/中景,
   仅终幕刺杀等三处允许特写。幕布换景, 台侧上下场。
   ============================================================ */
var Play = (function(){
  var A = Actors, T = Theater, D = Director.D;

  /* ============================================================
     镜头语汇 (克制)
     master: 观众席全景(含台口) / pan: 顺表演区横移
     med: 中景(保留舞台上下文) / close: 特写(全剧≤3次)
     ============================================================ */
  var CAM = {
    master: function(dur){
      return {pos:[0,25,238], look:[0,17.5,-2], fov:28, dur:dur||2.5, drift:0.1};
    },
    pan: function(x, dur){
      x = clamp(x, -34, 34);
      return {pos:[x*0.7,24,196], look:[x,16,-4], fov:26, dur:dur||2.5, drift:0.1};
    },
    med: function(x, dur, y){
      x = clamp(x, -46, 46);
      return {pos:[x*0.85, 20, 118], look:[x, y||14, -8], fov:25, dur:dur||2, drift:0.1};
    },
    close: function(x, y, dur){
      return {pos:[x, y||11, 64], look:[x, (y||11)-0.5, -10], fov:22, dur:dur||1.2, drift:0.12};
    }
  };

  /* ============================================================
     选角
     ============================================================ */
  var props = {};
  function buildCast(){
    /* --- 卡门 (一/二幕: 火红裙) --- */
    A.makeActor('carmen', {
      skin:'#d89868', hair:'#1a1214', bun:true, hairLong:true,
      body:'#c02030', dress:{tiers:['#c02030','#a01828','#801020'], len:8.2},
      sash:'#e8b040', shoe:'#28141c',
      flower:'#e02540', earring:'#e8c050', lips:'#a01828',
      eye:'#241418', brow:'soft', scale:0.98
    });
    /* --- 卡门 (三幕: 黑金华服) --- */
    A.makeActor('carmen3', {
      skin:'#d89868', hair:'#1a1214', bun:true,
      hat:{type:'mantilla', color:'#141016'},
      body:'#241a20', dress:{tiers:['#2a2026','#241a20','#1c1418'], len:8.4},
      sash:'#c8a040', shoe:'#141016',
      flower:'#e02540', earring:'#e8c050', lips:'#a01828',
      eye:'#241418', brow:'soft', scale:0.98
    });
    /* --- 唐·何塞 (一/二幕: 龙骑兵军装) --- */
    A.makeActor('jose', {
      skin:'#e8b98c', hair:'#2c2018',
      coat:'#28457a', body:'#28457a', sash:'#c03028',
      epaulet:'#d8b050', buttons:'#e8c860',
      hat:{type:'kepi', color:'#1e3660', band:'#c03028'},
      pants:'#d8cfc0', boots:'#241c14', shoe:'#181008',
      eye:'#1a1410', brow:'soft'
    });
    /* --- 唐·何塞 (三幕: 落魄逃兵) --- */
    A.makeActor('jose3', {
      skin:'#d8a878', hair:'#2c2018',
      coat:'#4a3c30', body:'#5a4a3a',
      pants:'#38302a', shoe:'#181008',
      eye:'#1a1410', brow:'angry', beard:'#3a2c20'
    });
    /* --- 埃斯卡米略 (斗牛士华服) --- */
    A.makeActor('escamillo', {
      skin:'#e0a878', hair:'#181014',
      coat:'#d8b050', body:'#e8e0d0', sash:'#a02838',
      braid:'#f0d890', buttons:'#f0d890',
      hat:{type:'montera', color:'#181418'},
      pants:'#d8b050', boots:'#e8e0d0', shoe:'#181014',
      eye:'#181014', brow:'soft', scale:1.05
    });
    /* --- 祖尼加队长 --- */
    A.makeActor('zuniga', {
      skin:'#e0b088', hair:'#3a342c',
      coat:'#1e3050', body:'#1e3050', sash:'#c8a040',
      epaulet:'#e8c860', buttons:'#e8c860',
      hat:{type:'kepi', color:'#16243c', band:'#e8c860'},
      pants:'#c8bcae', boots:'#241c14',
      beard:'#4a4238', eye:'#181410', brow:'angry', scale:1.07
    });
    /* --- 烟厂女工 ×3 --- */
    A.makeActor('g1', {
      skin:'#e8bc94', hair:'#3c2418', bun:true, body:'#c88848',
      dress:{tiers:['#c88848','#b07838'], len:7.8}, sash:'#7a4028',
      earring:'#c8a060', lips:'#b04838', brow:'soft', scale:0.94
    });
    A.makeActor('g2', {
      skin:'#d8a878', hair:'#241812', hairLong:true, body:'#7a9858',
      dress:{tiers:['#7a9858','#688448'], len:7.8}, sash:'#e8d0a0',
      lips:'#b04838', brow:'soft', scale:0.92
    });
    A.makeActor('g3', {
      skin:'#e8c49c', hair:'#4a2c1a', bun:true, body:'#9878a8',
      dress:{tiers:['#9878a8','#886898'], len:7.8}, sash:'#d8c8e0',
      earring:'#c8a060', lips:'#b04838', brow:'soft', scale:0.96
    });
    /* --- 士兵 ×2 --- */
    A.makeActor('s1', {
      skin:'#e0ac80', hair:'#241c12', coat:'#2a4780', body:'#2a4780',
      buttons:'#c8a850', hat:{type:'kepi', color:'#203868', band:'#a83028'},
      pants:'#ccc2b2', boots:'#241c14', brow:'soft', scale:0.97
    });
    A.makeActor('s2', {
      skin:'#d8a070', hair:'#302418', coat:'#2a4780', body:'#2a4780',
      buttons:'#c8a850', hat:{type:'kepi', color:'#203868', band:'#a83028'},
      pants:'#ccc2b2', boots:'#241c14', brow:'soft', scale:1.0
    });
    /* --- 酒馆众人 --- */
    A.makeActor('frasquita', {
      skin:'#e8b88c', hair:'#5a2c18', hairLong:true, body:'#c86838',
      dress:{tiers:['#c86838','#b05828'], len:7.8}, sash:'#e8c050',
      earring:'#c8a060', lips:'#b04030', brow:'soft', scale:0.93
    });
    A.makeActor('mercedes', {
      skin:'#d8a074', hair:'#241a14', bun:true, body:'#4878a0',
      dress:{tiers:['#4878a0','#386890'], len:7.8}, sash:'#c8d8e0',
      earring:'#c8a060', lips:'#b04030', brow:'soft', scale:0.95
    });
    A.makeActor('pastia', {
      skin:'#e0aa7c', hair:'#5a5048', beard:'#6a6058',
      body:'#8a6a48', apron:'#d8ccb0',
      pants:'#4a3a2c', shoe:'#241c14', brow:'soft', scale:1.02
    });
    A.makeActor('guitarist', {
      skin:'#c88858', hair:'#181210',
      hat:{type:'bandana', color:'#a03030'},
      body:'#3a3430', sash:'#c8a040',
      pants:'#2c2620', shoe:'#181410', brow:'soft', scale:0.97
    });
    A.makeActor('p1', {
      skin:'#d8a878', hair:'#38281c', body:'#5a6a48',
      pants:'#3a342c', shoe:'#1c1610', brow:'soft', scale:0.99
    });
    A.makeActor('p2', {
      skin:'#e0b088', hair:'#241c14', hat:{type:'brim', color:'#6a5030'},
      body:'#7a5238', pants:'#443628', shoe:'#1c1610', brow:'soft', scale:1.01
    });

    /* 全员候场 (侧幕外) */
    for(var k in A.cast){
      A.cast[k].root.position.set(300, 0, -10);
      A.cast[k].root.visible = false;
    }

    /* --- 道具 --- */
    props.rose = A.makeRose();
    props.rose.visible = false;
    T.scene().add(props.rose);

    props.roseJose = A.makeRose();
    props.roseJose.visible = false;
    A.cast.jose.armR.grip.add(props.roseJose);
    props.roseJose.rotation.z = 1.4;

    props.tamb = A.makeTambourine();
    props.tamb.visible = false;
    A.cast.carmen.armL.grip.add(props.tamb);
    props.tamb.position.set(0,-0.8,0);

    props.guitar = A.makeGuitar();
    A.cast.guitarist.armL.grip.add(props.guitar);
    props.guitar.rotation.set(0.3,0,-1.15);
    props.guitar.position.set(1.4,0,1.4);

    props.cape = A.makeCape('#b02038');
    props.cape.visible = false;
    A.cast.escamillo.armR.grip.add(props.cape);

    props.knife = A.makeKnife();
    props.knife.visible = false;
    A.cast.jose3.armR.grip.add(props.knife);
    props.knife.rotation.z = Math.PI;
    props.knife.position.set(0,-0.6,0);

    props.rifle1 = A.makeRifle();
    A.cast.s1.armR.grip.add(props.rifle1);
    props.rifle1.rotation.x = -0.12;

    props.mug1 = A.makeMug(); props.mug1.position.set(-34.5, 9.3, -3); props.mug1.visible=false;
    Sets.roots.tavern.add(props.mug1);
    props.mug2 = A.makeMug(); props.mug2.position.set(-29.5, 9.3, -5.5); props.mug2.visible=false;
    Sets.roots.tavern.add(props.mug2);

    props.roseOld = A.makeRose();
    props.roseOld.visible = false;
    A.cast.jose3.armL.grip.add(props.roseOld);
    props.roseOld.rotation.z = -1.2;

    props.ring = new THREE.Mesh(new THREE.TorusGeometry(0.6,0.22,5,10), T.mat('#e8c860'));
    props.ring.visible = false;
    T.scene().add(props.ring);
  }

  /* ============================================================
     演出特技
     ============================================================ */
  function roseTossStep(fromActor, toX, toZ){
    return function(next){
      var c = A.actorOf(fromActor);
      var start = new THREE.Vector3();
      c.armR.hand.getWorldPosition(start);
      props.rose.position.copy(start);
      props.rose.visible = true;
      AudioSys.sfx.roseToss();
      var t=0, dur=1.05;
      var sx=start.x, sy=start.y, sz=start.z;
      T.animate(function(dt){
        t += dt/dur;
        var p = clamp01(t);
        props.rose.position.x = lerp(sx, toX, p);
        props.rose.position.z = lerp(sz, toZ, p);
        props.rose.position.y = lerp(sy, 0.8, p) + Math.sin(p*Math.PI)*9;
        props.rose.rotation.z = p*7;
        props.rose.rotation.x = p*3;
        if(p>=1){
          props.rose.rotation.set(1.4,0,0.6);
          AudioSys.sfx.sparkle();
          next(); return true;
        }
        return false;
      });
    };
  }
  function capeFlourish(done){
    var cape = props.cape;
    cape.visible = true;
    AudioSys.sfx.capeWhoosh();
    var t=0;
    T.animate(function(dt){
      t += dt;
      var cloth = cape.userData.cloth;
      var pos = cloth.geometry.attributes.position;
      var base = cape.userData.base;
      for(var v=0;v<pos.count;v++){
        var bx = base[v*3], by = base[v*3+1];
        pos.array[v*3+2] = Math.sin(bx*0.8 + t*9)*1.4*((-by+4)/8) * Math.max(0,1-t/2.2);
      }
      pos.needsUpdate = true;
      cape.rotation.z = Math.sin(t*2.6)*0.6*Math.max(0,1-t/2.2);
      if(t>2.2){ if(done)done(); return true; }
      return false;
    });
  }
  function ringThrowStep(){
    return function(next){
      var c = A.actorOf('carmen3');
      var start = new THREE.Vector3();
      c.armR.hand.getWorldPosition(start);
      props.ring.position.copy(start);
      props.ring.visible = true;
      AudioSys.sfx.ringThrow();
      var t=0, sx=start.x, sy=start.y, sz=start.z;
      var tx = sx-14;
      T.animate(function(dt){
        t += dt/0.8;
        var p = clamp01(t);
        props.ring.position.x = lerp(sx, tx, p);
        props.ring.position.z = lerp(sz, -8, p);
        var arc = Math.sin(p*Math.PI)*6;
        var bY = p>0.99 ? Math.abs(Math.sin((t-1)*14))*2*Math.max(0,1-(t-1)*2.4) : 0;
        props.ring.position.y = lerp(sy, 0.5, p) + arc + bY;
        props.ring.rotation.x = t*10; props.ring.rotation.y = t*6;
        if(t>=1.8){ props.ring.rotation.set(Math.PI/2,0,0); props.ring.position.y=0.5; next(); return true; }
        return false;
      });
    };
  }
  /* 群演依次从两侧涌入场门 */
  function crowdIntoGate(names, done){
    var remaining = names.length;
    names.forEach(function(n, i){
      Sched.to(function(){
        var a = A.actorOf(n);
        a.root.visible = true;
        A.walkTo(a, rand(-6,6), {speed:rand(13,17), z:-22, keepFace:true}, function(){
          T.tweenPos(a.root, [a.root.position.x*0.3, 0, -26.5], 0.8, easeIn, function(){
            a.root.visible = false;
            if(--remaining===0 && done) done();
          });
        });
      }, i*850+rand(0,400));
    });
  }

  /* ============================================================
     序幕 — 剧场仪式 (与节目单画面无缝衔接)
     ============================================================ */
  function prologue(){
    return [
      /* 观众入席般的极缓推近, 贯穿整个仪式 */
      D.shot({pos:[0,25,238], look:[0,17.5,-2], fov:28, dur:14, ease:'inout'}),
      wait(0.9),
      /* 三击 — 场灯渐暗 */
      D.sfx('threeKnocks'),
      D.mood({amb:0.2, hemi:0.1, key:0.1, foot:0.62}, 2.6),
      wait(2.8),
      D.sfx('tuning'),
      wait(2.6),
      D.card('C A R M E N', '歌剧《卡门》 · 乔治·比才 · 1875', 4.4),
      D.sfx('baton'),
      wait(0.6),
      D.music('overture', {fadeIn:2}),
      /* 舞台灯亮起, 大幕拉开 */
      D.mood({amb:0.72, ambColor:'#9a9088', hemi:0.4,
              key:0.95, keyColor:'#ffe8bc', keyPos:[30,90,130],
              rim:0.18, rimColor:'#88a0d8', foot:0.22, footColor:'#ffc890'}, 3.5),
      D.curtainOpen(3.6),
      wait(1.2)
    ];
  }

  /* ============================================================
     第一幕 — 哈巴涅拉
     ============================================================ */
  function act1(){
    return [
      D.stamp('第一幕 · 塞维利亚 — 烟草厂外 · 正午', 5),
      call(function(){
        var C = A.cast;
        /* 士兵 */
        C.s1.root.position.set(-52, 0, -14); C.s1.root.visible = true;
        A.setPose(C.s1, 'guard', true);
        C.s2.root.position.set(-40, 0, -18); C.s2.root.visible = true;
        A.setPose(C.s2, 'attention', true);
        /* 何塞: 长椅小坐 */
        C.jose.root.position.set(26, 0, -15); C.jose.root.visible = true;
        A.setPose(C.jose, 'sit', true);
        /* 女工闲逛 */
        C.g1.root.position.set(-8, 0, -4); C.g1.root.visible = true;
        C.g2.root.position.set(8, 0, -6); C.g2.root.visible = true;
        A.setPose(C.g2, 'lean', true);
        C.g3.root.position.set(-24, 0, -8); C.g3.root.visible = true;
        /* 路人从左侧幕穿场 */
        C.p2.root.position.set(-88, 0, -21); C.p2.root.visible = true;
      }),
      D.sfx('crowdMurmur'),
      wait(1.2),
      D.sfx('churchBell'),
      D.sub('narrator', '塞维利亚。阳光把石板晒得发烫。', '', 3.4),
      D.walkBg('p2', 88, {speed:8, keepFace:true}),
      D.walkBg('g3', -14, {speed:6}),
      D.sub('narrator', '龙骑兵下士唐·何塞，在岗位上想着家乡。', '', 3.8),
      /* 镜头顺表演区轻移向右 — 视线落到何塞 */
      D.shotWait(CAM.pan(22, 3.4)),
      D.emote('jose', 'dots'),
      wait(1.2),
      /* 工厂钟响 — 女工们聚拢到厂门 */
      D.sfx('factoryBell'),
      D.shotWait(CAM.pan(30, 2)),
      D.sub('girls', '休息钟响了——她来了，卡门西塔！', '', 3),
      call(function(){
        A.walkTo(A.cast.g1, 40, {speed:15, z:-12});
        A.walkTo(A.cast.g2, 50, {speed:14, z:-18});
        A.walkTo(A.cast.g3, 46, {speed:13, z:-10});
      }),
      wait(2.2),
      D.stopMusic(1.2),
      wait(1.2),

      /* ---- 卡门登场 ---- */
      D.music('habanera'),
      call(function(){
        var c = A.cast.carmen;
        c.root.position.set(54, 0, -24);
        c.root.visible = true;
        c.root.rotation.y = -Math.PI/2;
      }),
      D.sfx('doorCreak'),
      D.spot('A', {follow:A.cast.carmen, color:'#ffd8a0', intensity:1.1, angle:0.28, dur:1.2}),
      D.sub('chorus', '卡门！', 'Carmen!', 2),
      D.emote('g1','note'), D.emote('g2','heart'),
      /* 卡门款款走到台中: 先沿后巷绕过何塞的长椅, 再斜插到台前 */
      call(function(){
        var c = A.cast.carmen;
        var gait = {stride:0.9, bounce:0.8, arm:0.5, sway:1.2};
        A.walkTo(c, 34, {speed:11, z:-19, keepFace:true, gait:gait}, function(){
          A.walkTo(c, 0, {speed:11, z:-8, gait:gait});
        });
      }),
      D.shotWait(CAM.master(4.5)),
      wait(3.4),
      D.pose('carmen','sassHalf'),
      wait(0.8),

      /* ---- 哈巴涅拉咏叹调 (全景为主, 一次横移) ---- */
      call(function(){ A.habaneraDance(A.actorOf('carmen')); }),
      D.subBg('carmen', '爱情是一只不羁的鸟，', 'L\'amour est un oiseau rebelle', 4.6),
      wait(4.6),
      D.subBg('carmen', '谁也不能驯服它。', 'que nul ne peut apprivoiser', 4.4),
      D.shotWait(CAM.pan(-6, 4.4)),
      D.subBg('carmen', '威胁哀求都是枉然——它高兴才会来。', 'et c\'est bien en vain qu\'on l\'appelle', 5),
      D.emote('g3','note'),
      wait(5),
      call(function(){ A.spinOnce(A.actorOf('carmen'), 1.0, function(){
        A.habaneraDance(A.actorOf('carmen'));
      }); }),
      D.subBg('carmen', '爱情是吉普赛的孩子，从来不懂什么规矩。', 'L\'amour est enfant de Bohême', 5.4),
      D.shotWait(CAM.med(2, 4, 12)),
      wait(1.4),
      /* 逼近何塞 */
      D.subBg('carmen', '你不爱我？那我偏偏爱你。', 'Si tu ne m\'aimes pas, je t\'aime', 4.6),
      call(function(){
        A.stopDance(A.actorOf('carmen'));
        A.walkTo(A.actorOf('carmen'), 17, {speed:9, z:-11, gait:{stride:0.9,bounce:0.7,arm:0.4,sway:1.4}, keepFace:true});
      }),
      D.shotWait(CAM.med(22, 3.4, 12)),
      /* 何塞起身, 别过头去 */
      call(function(){
        var j = A.cast.jose;
        A.setPose(j, 'refuse');
        T.tweenPos(j.root, [26, 0, -13], 0.8, easeInOut);
      }),
      D.head('jose', -0.6, 0),
      D.emote('jose','sweat'),
      D.subBg('carmen', '我若爱上你——', 'Et si je t\'aime...', 3),
      D.pose('carmen','roseKiss'),
      wait(2.2),
      D.subBg('carmen', '你可要当心！', 'prends garde à toi !', 3),
      wait(1.4),

      /* ---- 掷花 (音乐骤停, 全场定格) ---- */
      D.pose('carmen','throwPose'),
      wait(0.35),
      roseTossStep('carmen', 29, -12),
      D.stopMusic(0.15),
      D.sfx('fateSoft'),
      D.spot('B', {follow:A.cast.jose, color:'#b0c4ff', intensity:1.0, angle:0.24, dur:0.5}),
      call(function(){ A.startle(A.actorOf('jose')); }),
      D.emote('jose','!'),
      wait(1.6),
      /* 女工哄笑, 涌回厂门; 卡门旋身回厂 */
      D.sfx('factoryBell'),
      D.music('habanera'),
      D.head('jose', 0, 0),
      call(function(){
        A.emote(A.actorOf('g1'),'note');
        A.walkTo(A.cast.g1, 52, {speed:16, z:-24, keepFace:true}, function(){ A.cast.g1.root.visible=false; });
        A.walkTo(A.cast.g2, 60, {speed:17, z:-20, keepFace:true}, function(){ A.cast.g2.root.visible=false; });
        A.walkTo(A.cast.g3, 56, {speed:15, z:-17, keepFace:true}, function(){ A.cast.g3.root.visible=false; });
      }),
      D.sub('girls', '哈哈哈——下士脸红啦！', '', 2.6),
      /* 卡门旋身回厂: 先走台前明线越过何塞, 再折向厂门 */
      call(function(){ A.spinOnce(A.actorOf('carmen'), 0.85, function(){
        var c = A.cast.carmen;
        var gait = {stride:1, bounce:0.9, arm:0.5, sway:1.3};
        A.walkTo(c, 36, {speed:14, z:-7, keepFace:true, gait:gait}, function(){
          A.walkTo(c, 54, {speed:14, z:-21, keepFace:true, gait:gait},
            function(){ c.root.visible=false; });
        });
      }); }),
      D.shotWait(CAM.master(3)),
      D.spot('A', {intensity:0, dur:1.5}),
      D.stopMusic(2.5),

      /* ---- 何塞与玫瑰 (黄昏灯光变化) ---- */
      D.sfx('windDusk'),
      call(function(){ Sets.tint('plaza', '#d09070', 6); }),
      D.mood({amb:0.5, ambColor:'#8a7080', key:0.6, keyColor:'#ffb478',
              rim:0.3, rimColor:'#6878c8', foot:0.3}, 5),
      wait(1),
      D.walk('jose', 27, {speed:8, pose:'idle'}),
      D.shotWait(CAM.med(26, 2.6, 10)),
      D.pose('jose','kneelDown'),
      wait(1.6),
      call(function(){
        props.rose.visible = false;
        props.roseJose.visible = true;
      }),
      D.sfx('sparkle'),
      D.pose('jose','kneel'),
      wait(1),
      D.sub('jose', '这朵花……', 'Cette fleur...', 2.6),
      D.spot('B', {follow:A.cast.jose, color:'#9ab0e8', intensity:1.2, angle:0.2, dur:2}),
      D.mood({amb:0.34, key:0.4, foot:0.24}, 3),
      D.pose('jose','grief'),
      D.sub('jose', '像一颗子弹，正中我的心口。', '', 3.6),
      D.sfx('fateSoft'),
      D.emote('jose','heart',{dur:1.8}),
      wait(1.2),
      D.subBg('narrator', '——他把花藏进了军装内袋。', '', 3.2),
      D.shotWait(CAM.master(3.6)),
      wait(1),

      /* 一幕落幕 */
      D.spot('B', {intensity:0, dur:1.2}),
      D.curtainClose(2.6),
      D.stopMusic(),
      wait(0.6)
    ];
  }

  /* ============================================================
     第二幕 — 吉普赛之歌 与 斗牛士
     ============================================================ */
  function act2(){
    return [
      /* 幕后换景 */
      call(function(){
        Sets.show('tavern');
        Sets.tint('plaza', '#ffffff', 0.1);
        Sets.tint('tavern', '#a89080', 0.1);   /* 内景画片压暗到夜色 */
        var C = A.cast;
        for(var k in C){ C[k].root.visible=false; C[k].root.rotation.y = 0; }
        /* 卡门站上大桌 */
        C.carmen.root.position.set(-4, 10.4, -10);
        C.carmen.root.visible = true;
        A.setPose(C.carmen, 'skirtHold', true);
        props.tamb.visible = true;
        /* 众人 */
        C.frasquita.root.position.set(-26, 0, -1); C.frasquita.root.visible=true;
        A.setPose(C.frasquita, 'sit', true);
        C.mercedes.root.position.set(-38, 0, -1); C.mercedes.root.visible=true;
        A.setPose(C.mercedes, 'sit', true);
        C.pastia.root.position.set(32, 0, -26); C.pastia.root.visible=true;
        A.setPose(C.pastia, 'lean', true);
        C.guitarist.root.position.set(8, 0, -4); C.guitarist.root.visible=true;
        A.setPose(C.guitarist, 'sit', true);
        C.p1.root.position.set(18, 0, -2); C.p1.root.visible=true;
        A.setPose(C.p1, 'sit', true);
        C.p2.root.position.set(26, 0, 0); C.p2.root.visible=true;
        A.setPose(C.p2, 'toast', true);
        props.mug1.visible = true; props.mug2.visible = true;
        T.shot(CAM.master(0));
        /* 酒馆夜光 */
        T.mood({amb:0.42, ambColor:'#7a6058', hemi:0.24,
                key:0.5, keyColor:'#ffc890', keyPos:[10,80,120],
                rim:0.2, rimColor:'#4858a8', foot:0.42, footColor:'#ff9850'}, 0.1);
      }),
      D.card('第 二 幕', '利利亚斯·帕斯蒂亚的酒馆 · 深夜', 4),
      D.curtainOpen(2.8),
      D.stamp('第二幕 · 帕斯蒂亚酒馆 · 深夜', 4.5),
      D.sfx('guitarStrumMinor'),
      wait(1.6),
      D.sfx('clink'),
      D.sub('narrator', '两个月后。走私贩的酒馆，烟雾与烛火。', '', 3.6),

      /* ---- 吉普赛之歌 (渐快之舞) ---- */
      D.music('gypsy'),
      D.spot('A', {follow:A.cast.carmen, color:'#ffc890', intensity:1.2, angle:0.32, ty:12, dur:1.5}),
      D.sub('carmen', '铃鼓响起来了——', 'Les tringles des sistres tintaient', 3),
      call(function(){
        var c = A.actorOf('carmen');
        var sp = 0.55;
        c._gypsySpeed = function(){ return sp; };
        var t=0;
        T.animate(function(dt){
          t+=dt;
          sp = lerp(0.55, 2.1, clamp01(t/68));
          if(!c._dance) return true;
          return false;
        });
        A.flamencoDance(c, c._gypsySpeed);
      }),
      D.subBg('carmen', '疯狂的节奏里，吉普赛女郎站了起来。', '', 4.2),
      wait(4.2),
      D.emote('frasquita','note'), D.emote('mercedes','note'),
      D.subBg('carmen', '嗒啦啦啦……烧起来吧，舞蹈与歌！', 'Tra la la la...', 4.2),
      /* 中景注视桌上之舞 */
      D.shotWait(CAM.med(-4, 4.4, 15)),
      call(function(){ A.emote(A.actorOf('p1'),'note'); }),
      D.subBg('chorus', '快些！再快些！', '', 3.2),
      wait(3.2),
      D.sfx('castanetRoll'),
      D.subBg('narrator', '火光跳上她的裙角，整间酒馆开始旋转——', '', 4),
      /* 回到全景看群像打拍子 */
      D.shotWait(CAM.master(4)),
      call(function(){
        A.setPose(A.cast.p1,'toast');
        A.emote(A.actorOf('p2'),'note');
      }),
      D.sfx('stomp'),
      D.shake(1, 0.14),
      D.sfx('castanetRoll'),
      D.shotWait(CAM.pan(-6, 3)),
      /* 高潮: 空中旋转跳下桌 */
      call(function(){
        var c = A.actorOf('carmen');
        A.stopDance(c, 'flamencoUp');
        Sched.to(function(){
          A.spinOnce(c, 0.7, function(){
            var t=0, sy=c.root.position.y;
            AudioSys.sfx.capeWhoosh();
            T.animate(function(dt){
              t+=dt/0.55;
              var p = clamp01(t);
              c.root.position.y = lerp(sy, 0, easeIn(p)) + Math.sin(p*Math.PI)*4;
              c.root.position.x = lerp(-4, -14, p);
              if(p>=1){
                AudioSys.sfx.stomp();
                GFX.shake(1.6, 0.22);
                A.setPose(c,'flamencoUp',true);
                return true;
              }
              return false;
            });
          });
        }, 700);
      }),
      wait(2.4),
      D.stopMusic(0.3),
      D.sfx('applause'),
      D.sfx('crowdCheer'),
      call(function(){ props.tamb.visible = false; }),
      call(function(){ A.crowdCheer([A.cast.frasquita, A.cast.mercedes, A.cast.p1], 2.2); }),
      D.emote('carmen','note'),
      D.pose('carmen','bow'),
      wait(2),
      D.pose('carmen','sassHalf'),

      /* ---- 斗牛士登场 ---- */
      D.sfx('doorBurst'),
      D.shotWait(CAM.pan(-26, 1.6)),
      D.sub('chorus', '看哪！是他！格拉纳达竞技场的英雄——', '', 3),
      D.music('toreador'),
      call(function(){
        var e = A.cast.escamillo;
        e.root.position.set(-56, 0, -20);
        e.root.visible = true;
        e.root.rotation.y = Math.PI/2;
        A.walkTo(e, -26, {speed:13, z:-10, gait:{stride:0.8, bounce:0.5, arm:0.3}, pose:'torero'});
      }),
      D.sub('chorus', '埃斯卡米略！', 'Escamillo !', 2.4),
      D.spot('B', {follow:A.cast.escamillo, color:'#ffe8b0', intensity:1.4, angle:0.3, dur:1}),
      call(function(){ capeFlourish(); }),
      D.emote('frasquita','heart'), D.emote('mercedes','heart'),
      wait(1.4),
      D.subBg('escamillo', '干杯！为你们，士兵与美人——', 'Votre toast, je peux vous le rendre', 4.4),
      D.pose('escamillo','toast'),
      wait(4.4),
      D.subBg('escamillo', '斗牛士，冲吧！斗牛士！', 'Toréador, en garde !', 4.2),
      D.pose('escamillo','torero'),
      call(function(){ capeFlourish(); }),
      D.sfx('ole'),
      call(function(){ A.crowdCheer([A.cast.p1, A.cast.p2, A.cast.frasquita], 2); }),
      D.subBg('chorus', '别忘了，一双黑眼睛正望着你，爱情在等你！', 'et songe bien... qu\'un oeil noir te regarde', 5),
      /* 全景: 满堂喝彩的群像 */
      D.shotWait(CAM.master(5)),
      /* 埃斯卡米略注意到卡门 */
      call(function(){ A.face(A.actorOf('escamillo'), 1, 0.5); }),
      D.walk('escamillo', -22, {speed:9, pose:'torero'}),
      D.sub('escamillo', '美人，告诉我你的名字？', '', 3),
      D.shotWait(CAM.med(-18, 3, 12)),
      D.sub('carmen', '卡门。——现在别缠着我。', '', 3.2),
      D.pose('carmen','refuse'),
      D.head('carmen', 0.5, 0),
      D.emote('escamillo','?'),
      wait(0.6),
      D.sub('escamillo', '好。那我等——等你爱上我的那一天。', '', 3.6),
      D.pose('escamillo','toreroBow'),
      wait(1.6),
      D.head('carmen', 0, 0),
      /* 举座随他离去 */
      call(function(){
        var C = A.cast;
        A.setPose(C.escamillo,'idle');
        A.walkTo(C.escamillo, -54, {speed:14, z:-19, keepFace:true}, function(){
          C.escamillo.root.visible=false;
          props.cape.visible = false;
        });
        Sched.to(function(){
          A.walkTo(C.p1, -52, {speed:15, z:-22, keepFace:true}, function(){ C.p1.root.visible=false; });
          A.walkTo(C.p2, -50, {speed:13, z:-17, keepFace:true}, function(){ C.p2.root.visible=false; });
          A.walkTo(C.frasquita, -52, {speed:14, z:-24, keepFace:true}, function(){ C.frasquita.root.visible=false; });
          A.walkTo(C.mercedes, -54, {speed:12, z:-20, keepFace:true}, function(){ C.mercedes.root.visible=false; });
        }, 800);
      }),
      D.shotWait(CAM.master(3.4)),
      D.stopMusic(3),
      D.spot('B', {intensity:0, dur:1.5}),
      wait(2.4),

      /* ---- 何塞来了 ---- */
      D.sfx('bugle'),
      D.sub('narrator', '远处，军营的号声。——而他来赴她的约。', '', 3.8),
      call(function(){
        var j = A.cast.jose;
        j.root.position.set(-56, 0, -20);
        j.root.visible = true;
        A.walkTo(j, -34, {speed:11, z:-10});
      }),
      D.sub('jose', '卡门！', '', 1.8),
      D.walkBg('carmen', -20, {speed:10, z:-8, gait:{stride:0.9,bounce:0.7,arm:0.4,sway:1.2}}),
      D.sub('carmen', '你来了。我为你一个人跳舞。', '', 3.4),
      /* 私舞: 烛光双人 — 中景一镜到底 */
      D.music('habanera'),
      D.musicVol(0.3, 1),
      D.mood({amb:0.3, key:0.34, foot:0.55, footColor:'#ff9850'}, 2),
      D.spot('A', {follow:A.cast.carmen, color:'#ffb888', intensity:1.15, angle:0.28, dur:1.2}),
      call(function(){ A.habaneraDance(A.actorOf('carmen')); }),
      D.shotWait(CAM.med(-27, 4, 12)),
      D.emote('jose','heart'),
      wait(4.4),
      /* 号声再起 — 何塞的挣扎 */
      D.sfx('bugle'),
      call(function(){ A.stopDance(A.actorOf('carmen'), 'sassHalf'); }),
      D.musicVol(0.14, 0.8),
      D.sub('jose', '归营号……我必须回去了。', '', 3.2),
      D.pose('jose','confront'),
      D.emote('carmen','anger'),
      D.stopMusic(1),
      D.sub('carmen', '回去？滚回你的军营吧，金丝雀！', '', 3.4),
      D.pose('carmen','sass'),
      /* 何塞掏出那朵干枯的玫瑰 */
      D.sub('jose', '你看——你掷给我的花，我留到今天。', 'La fleur que tu m\'avais jetée...', 4.4),
      D.pose('jose','plead'),
      D.sfx('fateSoft'),
      D.emote('carmen','!'),
      wait(1),
      D.sub('carmen', '那就别走。跟我去山里——去过自由的日子！', '', 4),
      D.pose('carmen','reachOne'),
      wait(0.8),

      /* ---- 祖尼加闯入 ---- */
      D.sfx('doorBurst'),
      D.shake(1.4, 0.18),
      D.shotWait(CAM.pan(-30, 1.2)),
      call(function(){
        var z = A.cast.zuniga;
        z.root.position.set(-56, 0, -20);
        z.root.visible = true;
        A.walkTo(z, -44, {speed:16, z:-12, pose:'confront'});
      }),
      D.sub('zuniga', '下士！你还敢逗留在这种地方？！', '', 3.2),
      D.emote('zuniga','anger'),
      D.sub('zuniga', '——立刻归队！这是命令！', '', 2.8),
      D.pose('jose','confront'),
      D.sub('jose', '不……我不走。', '', 2.6),
      D.emote('zuniga','!'),
      D.sfx('slap'),
      call(function(){
        var z = A.cast.zuniga, j = A.cast.jose;
        A.setPose(z, 'lunge');
        Sched.to(function(){
          A.setPose(j, 'stagger');
          GFX.shake(1.6, 0.22);
          AudioSys.sfx.stomp();
        }, 320);
        Sched.to(function(){
          A.setPose(j, 'lunge');
          A.setPose(z, 'shock');
          AudioSys.sfx.slap();
          GFX.flash('#fff', 0.28);
        }, 1100);
      }),
      wait(2),
      D.sfx('crowdGasp'),
      D.sub('narrator', '对长官拔刀相向——他再也回不了头了。', '', 3.6),
      call(function(){
        var z = A.cast.zuniga;
        A.setPose(z,'stagger');
        Sched.to(function(){
          A.walkTo(z, -54, {speed:17, z:-20, keepFace:true}, function(){ z.root.visible=false; });
        }, 500);
      }),
      D.sub('carmen', '哈哈！现在，你只能跟我们走了。', '', 3.4),
      D.pose('carmen','sassHalf'),
      D.emote('carmen','note'),
      D.sub('carmen', '看哪——山野、星空、还有自由！', 'Là-bas, là-bas dans la montagne...', 4),
      D.pose('carmen','flamencoL'),
      D.sub('jose', '卡门……我的命运拴在你身上了。', '', 3.6),
      D.pose('jose','plead'),
      D.sfx('fate'),
      /* 双人逃向门外夜色 */
      D.mood({amb:0.2, key:0.16, foot:0.32}, 2.4),
      call(function(){
        var c = A.cast.carmen, j = A.cast.jose;
        A.walkTo(c, -52, {speed:12, z:-19, keepFace:true}, function(){ c.root.visible=false; });
        Sched.to(function(){
          A.walkTo(j, -52, {speed:12, z:-22, keepFace:true}, function(){ j.root.visible=false; });
        }, 700);
      }),
      D.shotWait(CAM.master(3.4)),
      wait(0.8),
      D.spot('A', {intensity:0, dur:0.8}),
      D.curtainClose(2.6),
      D.stopMusic(),
      wait(0.6)
    ];
  }

  /* ============================================================
     第三幕 — 宿命
     ============================================================ */
  function act3(){
    return [
      call(function(){
        Sets.show('arena');
        var C = A.cast;
        for(var k in C){ C[k].root.visible=false; C[k].root.rotation.y=0; }
        T.shot(CAM.master(0));
        T.mood({amb:0.6, ambColor:'#a08068', hemi:0.34,
                key:0.8, keyColor:'#ffac60', keyPos:[-40,80,130],
                rim:0.3, rimColor:'#c05838', foot:0.26, footColor:'#ff9040'}, 0.1);
      }),
      D.card('第 三 幕', '斗牛场外 · 黄昏', 4),
      D.curtainOpen(2.8),
      D.stamp('第三幕 · 斗牛场外 · 黄昏', 4.5),
      D.music('arena', {fadeIn:1.5}),
      D.sfx('hoofBells'),
      D.sub('narrator', '数月之后。斗牛的日子，全塞维利亚都来了。', '', 3.8),
      /* 人潮从两侧涌入场门 (全景看调度) */
      call(function(){
        var names = ['g1','g2','g3','p1','p2','pastia','s1','s2'];
        names.forEach(function(n,i){
          var a = A.actorOf(n);
          a.root.position.set(i%2? -88-i*3 : 88+i*3, 0, -8-(i%3)*5);
        });
        crowdIntoGate(names);
      }),
      D.sfx('crowdCheer'),
      D.subBg('chorus', '来了！来了！斗牛士的队列来了！', '', 3.4),
      wait(4),

      /* ---- 埃斯卡米略 & 卡门的盛装亮相 ---- */
      D.sfx('fanfare'),
      call(function(){
        var e = A.cast.escamillo, c3 = A.cast.carmen3;
        e.root.position.set(-88, 0, -14); e.root.visible = true;
        c3.root.position.set(-96, 0, -12); c3.root.visible = true;
        props.cape.visible = true;
        A.walkTo(e, -12, {speed:12, z:-14, gait:{stride:0.8,bounce:0.4,arm:0.3}, pose:'torero'});
        Sched.to(function(){
          A.walkTo(c3, -26, {speed:11, z:-12, gait:{stride:0.9,bounce:0.7,arm:0.4,sway:1.2}, pose:'sassHalf'});
        }, 600);
      }),
      D.sfx('crowdCheer'),
      D.subBg('chorus', '埃斯卡米略万岁！', 'Vivat ! Vivat le Toréro !', 3),
      D.spot('A', {follow:A.cast.escamillo, color:'#ffe0a0', intensity:1.3, angle:0.3, dur:1}),
      D.spot('B', {follow:A.cast.carmen3, color:'#ffd0b0', intensity:1.0, angle:0.28, dur:1}),
      wait(3.2),
      call(function(){ capeFlourish(); }),
      D.sfx('ole'),
      D.shotWait(CAM.pan(-16, 3)),
      /* 临别对望 */
      D.sub('escamillo', '卡门，若你爱我——一会儿你将为我骄傲。', '', 4),
      call(function(){ A.face(A.actorOf('escamillo'), -1, 0.5); }),
      D.sub('carmen3', '去吧。我爱你，埃斯卡米略。', '', 3.4),
      wait(0.4),
      /* 斗牛士入场 */
      call(function(){
        var e = A.cast.escamillo;
        A.walkTo(e, 0, {speed:11, z:-20, keepFace:true}, function(){
          T.tweenPos(e.root, [0,0,-26], 0.8, easeIn, function(){
            e.root.visible = false;
            props.cape.visible = false;
          });
        });
      }),
      D.sfx('crowdRoar'),
      D.muffle(true, 900),
      D.shotWait(CAM.master(3)),
      D.spot('A', {intensity:0, dur:1}),

      /* ---- 人去楼空 · 宿命的预感 ---- */
      D.sfx('gateSlam'),
      D.sfx('windDusk'),
      call(function(){ Sets.tint('arena', '#c87878', 8); }),
      D.mood({amb:0.42, ambColor:'#907098', key:0.6, keyColor:'#ff8848',
              rim:0.26, rimColor:'#6838a0', foot:0.2}, 4),
      D.sub('narrator', '广场空了。只剩风，卷着场内的欢呼。', '', 4),
      /* 弗拉斯基塔跑来警告 */
      call(function(){
        var f = A.cast.frasquita;
        f.root.position.set(88, 0, -10); f.root.visible = true;
        A.walkTo(f, 6, {speed:16, z:-10, pose:'plead'});
      }),
      D.sub('frasquita', '卡门！他在这儿——何塞藏在人群里！', '', 3.6),
      D.emote('frasquita','!'),
      D.sub('frasquita', '快躲一躲吧，他的眼神不对……', '', 3.2),
      D.sub('carmen3', '我不是会发抖的人。让他来。', '', 3.6),
      D.pose('carmen3','sass'),
      call(function(){
        var f = A.cast.frasquita;
        A.walkTo(f, 88, {speed:15, keepFace:true}, function(){ f.root.visible=false; });
      }),
      D.sfx('fateSoft'),
      wait(1.2),

      /* ---- 何塞现身 (左侧幕阴影中走出) ---- */
      D.stopMusic(2),
      D.sfx('heartbeat'),
      D.mood({key:0.5, keyColor:'#ff7838', keyPos:[-120,50,90], amb:0.34}, 2),
      call(function(){
        var j3 = A.cast.jose3;
        j3.root.position.set(-88, 0, -14);
        j3.root.visible = true;
        A.walkTo(j3, -44, {speed:7, z:-12, pose:'confront'});
      }),
      D.shotWait(CAM.pan(-30, 2.4)),
      D.sfx('crowdGasp'),
      wait(2.2),
      D.sub('carmen3', '……是你。', '', 2.4),
      /* 终场二重唱 — 中景相持 */
      D.music('requiem', {fadeIn:2}),
      D.sub('jose', '卡门。我找了你很久。', '', 3),
      D.walk('jose3', -36, {speed:8, z:-12, pose:'plead'}),
      D.sub('jose', '跟我走。我们重新开始——我什么都可以抛下。', '', 4.2),
      D.shotWait(CAM.med(-26, 3.6, 12)),
      D.sub('carmen3', '不。一切都结束了。', '', 3.2),
      D.pose('carmen3','refuse'),
      D.face('carmen3', -1, 0.5),
      D.sub('jose', '我还留着你的花！我为你当了逃兵，我一无所有了！', '', 4.4),
      call(function(){ props.roseOld.visible = true; }),
      D.pose('jose3','grief'),
      D.emote('jose3','brokenHeart',{dur:2}),
      wait(0.6),
      D.sub('carmen3', '卡门生来自由——', 'Libre elle est née', 3.2),
      D.face('carmen3', 0, 0.4),
      D.sub('carmen3', '也将自由地死去。', 'et libre elle mourra !', 3.4),
      D.pose('carmen3','sass'),
      /* 场内欢呼 — 残忍的对位 */
      D.sfx('crowdRoar'),
      D.sfx('ole'),
      D.subBg('chorus', '(场内) 斗牛士！斗牛士！', '', 3),
      D.head('carmen3', 0.5, -0.1),
      D.emote('carmen3','note'),
      wait(0.6),
      D.sub('jose', '他在里面……你要去找他？！', '', 3),
      D.pose('jose3','confront'),
      D.emote('jose3','anger'),
      D.sub('carmen3', '是。我爱他！——让开！', '', 3),
      /* 掷还戒指 */
      D.sub('carmen3', '这戒指，是你从前给我的——拿回去！', '', 3.4),
      D.pose('carmen3','throwPose'),
      ringThrowStep(),
      D.sfx('fate'),
      D.shake(1.2, 0.3),
      wait(1.6),

      /* ---- 刺杀 (全剧唯一的特写段落) ---- */
      D.stopMusic(0.6),
      call(function(){ props.knife.visible = true; }),
      D.sfx('knifeGleam'),
      D.pose('jose3','knife'),
      D.shot(CAM.close(-32, 10, 0.9)),
      D.sfx('heartbeat'),
      wait(1.4),
      /* 卡门昂首向场门走去 — 退回中景 */
      D.shot(CAM.med(-14, 1.6, 11)),
      call(function(){
        A.walkTo(A.cast.carmen3, -4, {speed:9, z:-16, keepFace:true,
          gait:{stride:0.9, bounce:0.6, arm:0.4, sway:1}});
      }),
      wait(1.6),
      D.sfx('crowdRoar'),
      call(function(){
        var j3 = A.cast.jose3;
        A.walkTo(j3, -9, {speed:24, z:-14, keepFace:true, pose:'lunge'});
      }),
      wait(0.65),
      D.flash('#fff', 1),
      D.sfx('stabHit'),
      call(function(){
        /* 全灯瞬灭 + 血色纱幕从景片前亮起 → 纯红底上的黑色剪影 */
        var blood = Sets.fx.arena.bloodDrop;
        blood.visible = true;
        blood.material.opacity = 1;
        Sets.tint('arena', '#9a1424', 0.2);
        T.spot('A', {intensity:0, dur:0.1});
        T.spot('B', {intensity:0, dur:0.1});
        T.mood({amb:0.02, hemi:0, key:0, rim:0, foot:0.05}, 0.12);
        GFX.setGrade({rm:1.06, gm:0.82, bm:0.8}, null, 1);
        var c3 = A.cast.carmen3, j3 = A.cast.jose3;
        A.setPose(j3, 'lunge', true);
        A.setPose(c3, 'shock', true);
        j3.root.position.set(-11, 0, -14);
        c3.root.position.set(-4, 0, -14);
      }),
      D.shot(CAM.med(-7, 0, 11)),
      D.shake(2.4, 0.5),
      wait(2.8),

      /* ---- 挽歌 ---- */
      call(function(){
        Sets.tint('arena', '#503058', 6);
        /* 血幕缓缓隐去, 场景重新显形 */
        var blood = Sets.fx.arena.bloodDrop;
        var bt=0;
        T.animate(function(dt){
          bt += dt/4.5;
          if(bt>=1){ blood.material.opacity=0; blood.visible=false; return true; }
          blood.material.opacity = 1-easeInOut(bt);
          return false;
        });
        var c3 = A.cast.carmen3, j3 = A.cast.jose3;
        props.knife.visible = false;
        A.setPose(c3, 'lieSide');
        Sched.to(function(){ A.setPose(j3, 'cradle'); }, 900);
        Sched.to(function(){
          T.tweenPos(j3.root, [-7.5, 0, -14.5], 1.2, easeInOut);
        }, 900);
      }),
      D.mood({amb:0.2, ambColor:'#6a4858', key:0.24, keyColor:'#c85838',
              rim:0.2, rimColor:'#48387a', foot:0.12}, 3.5),
      D.music('requiem', {fadeIn:3}),
      D.spot('A', {follow:A.cast.carmen3, color:'#d8a0b0', intensity:1.0, angle:0.24, ty:4, dur:2}),
      D.sub('jose', '卡门……我的卡门……', '', 3.6),
      D.sfx('crowdGasp'),
      /* 人群从场内涌出, 远远围成半圈 */
      call(function(){
        var names=['g1','g2','p1','p2','frasquita'];
        names.forEach(function(n,i){
          var a = A.actorOf(n);
          a.root.position.set(rand(-5,5), 0, -24);
          a.root.visible = true;
          Sched.to(function(){
            A.walkTo(a, -28+i*10.5, {speed:11, z:-20, pose:'shock'});
          }, i*300);
        });
      }),
      D.shotWait(CAM.master(4.5)),
      D.sub('jose', '你们抓我吧——', 'Vous pouvez m\'arrêter...', 3.4),
      /* 特写之二: 怀抱 */
      D.shot(CAM.close(-6, 8, 2.2)),
      D.sub('jose', '是我杀了她。是我，杀了我深爱的卡门。', 'C\'est moi qui l\'ai tuée !', 5),
      D.emote('jose3','brokenHeart',{dur:2.6}),
      wait(1),
      /* 回到全景 — 舞台整体定格成一幅画, 大幕缓缓合拢 */
      D.shotWait(CAM.master(4)),
      D.subBg('narrator', '爱情是一只不羁的鸟……谁也不能驯服它。', '', 4.6),
      wait(2.6),
      D.curtainClose(4.5),
      wait(1.4),
      D.stopMusic(2),
      wait(1)
    ];
  }

  /* ============================================================
     谢幕
     ============================================================ */
  function curtainCall(){
    return [
      call(function(){
        Sets.show('plaza');
        Sets.tint('plaza', '#8890b8', 0.1);   /* 夜蓝天幕 */
        props.ring.visible = false;
        props.rose.visible = false;
        var C = A.cast;
        for(var k in C){ C[k].root.visible=false; C[k].root.rotation.y=0; }
        T.shot(CAM.master(0));
        T.mood({amb:0.44, ambColor:'#8a7898', hemi:0.24,
                key:0.66, keyColor:'#ffd8a0', keyPos:[0,80,130],
                rim:0.3, rimColor:'#6858c8', foot:0.6, footColor:'#ffc880'}, 0.1);
        GFX.snapGrade(null);
      }),
      D.curtainOpen(2.8),
      D.music('habanera', {fadeIn:1.5}),
      D.musicVol(0.32, 0.5),
      D.sfx('applauseLong'),
      D.stamp('谢幕', 3),
      /* 配角一排 — 目标位由中心向两侧展开:
         先上场者站中央, 后来者永远停在前人外侧, 不会穿身 */
      call(function(){
        var order = ['s1','pastia','guitarist','mercedes','zuniga','g3','frasquita','g2','g1','p1','p2','s2'];
        var targets = [-6, 6, -18, 18, -30, 30, -42, 42, -54, 54, -66, 66];
        order.forEach(function(n, i){
          Sched.to(function(){
            var a = A.actorOf(n);
            var tx = targets[i];
            a.root.position.set(tx<0? -92 : 92, 0, -18);
            a.root.visible = true;
            A.walkTo(a, tx, {speed:22, z:-18}, function(){
              A.setPose(a, 'bow');
              Sched.to(function(){ A.setPose(a, 'idle'); }, 1400);
            });
          }, i*420);
        });
      }),
      wait(7),
      /* 三主演 */
      D.sfx('applause'),
      call(function(){
        var e = A.cast.escamillo;
        e.root.position.set(92, 0, -6); e.root.visible = true;
        props.cape.visible = true;
        A.walkTo(e, 24, {speed:20, z:-6}, function(){
          A.setPose(e, 'toreroBow');
          AudioSys.sfx.ole();
          Sched.to(function(){ A.setPose(e, 'torero'); }, 1600);
        });
      }),
      wait(1.6),
      call(function(){
        var j = A.cast.jose;
        j.root.position.set(-92, 0, -6); j.root.visible = true;
        A.walkTo(j, -24, {speed:20, z:-6}, function(){
          A.setPose(j, 'bow');
          Sched.to(function(){ A.setPose(j, 'salute'); }, 1500);
        });
      }),
      wait(2),
      /* 卡门压轴 */
      D.sfx('bravo'),
      D.spot('A', {follow:A.cast.carmen, color:'#ffe0b0', intensity:1.6, angle:0.28, dur:0.8}),
      call(function(){
        var c = A.cast.carmen;
        c.root.position.set(-30, 0, -24); c.root.visible = true;
        props.tamb.visible = false;
        A.walkTo(c, 0, {speed:14, z:-2, gait:{stride:0.9,bounce:0.8,arm:0.5,sway:1.3}}, function(){
          A.setPose(c, 'bowDeep');
          Sched.to(function(){
            A.setPose(c, 'roseKiss');
          }, 1800);
        });
      }),
      D.shotWait(CAM.pan(0, 4)),
      wait(2.8),
      /* 掷花给观众! */
      D.pose('carmen','throwPose'),
      roseTossStep('carmen', 3, 13),
      D.emote('carmen','heart'),
      D.sfx('applauseLong'),
      call(function(){
        for(var k in A.cast){
          var a = A.cast[k];
          if(a.root.visible) A.setPose(a, 'bow');
        }
      }),
      D.shotWait(CAM.master(4)),
      wait(2.6),
      D.curtainClose(3),
      D.stopMusic(2.5),
      wait(1.4),
      D.credits([
        {t:'C A R M E N', h:true},
        {t:'三幕小剧场', h:false},
        {t:''},
        {t:'原作歌剧', h:true},
        {t:'乔治·比才 Georges Bizet (1875)'},
        {t:'原著小说 · 普罗斯佩·梅里美'},
        {t:''},
        {t:'选段', h:true},
        {t:'序曲 / 哈巴涅拉'},
        {t:'吉普赛之歌 / 斗牛士之歌'},
        {t:'终场二重唱'},
        {t:''},
        {t:'演出', h:true},
        {t:'卡门 —— 卡门西塔'},
        {t:'唐·何塞 —— 龙骑兵下士'},
        {t:'埃斯卡米略 —— 格拉纳达的斗牛士'},
        {t:'祖尼加 / 弗拉斯基塔 / 梅赛德斯'},
        {t:'塞维利亚的众人'},
        {t:''},
        {t:'芯片音源管弦乐团', h:true},
        {t:'方波 · 三角波 · 锯齿波 · 噪声'},
        {t:''},
        {t:'致敬 NDS 世代的掌上剧场', h:false},
        {t:''},
        {t:'谢谢观赏', h:true}
      ]),
      D.finCard(),
      wait(3)
    ];
  }

  /* ============================================================
     全剧
     ============================================================ */
  function fullShow(){
    var steps = [];
    steps = steps.concat(prologue(), act1(), act2(), act3(), curtainCall());
    return steps;
  }

  return { buildCast:buildCast, fullShow:fullShow, props:props };
})();
