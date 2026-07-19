'use strict';
/* ============================================================
   world.js — 三维世界
   低面数 + Toon 三阶渐变 + 固定侧视线性舞台(幽灵诡计式)
   场景A: 灰港七号码头(雨夜)  场景B: 「锚与钟」酒吧
   奇观: 静波 —— 海面停驻的巨浪
   ============================================================ */
var World = (function(){
  var renderer, scene, camera;
  var rw=G.RW, rh=G.RH;
  var objs={}, chars={};
  var rainDrops=[], rainOn=true;
  var lightning=0, lightningNext=18;
  var camX=0, camTargetX=0, camY=26, camTargetY=26, camZoom=1, camTargetZoom=1;
  var curScene='dock';
  var sceneRoots={};
  var wonderState=0;          // 0隐藏 1升起 2驻立 3崩落
  var wonderT=0;
  var animators=[];           // {update(dt) return true=done}

  /* ---------- toon 材质 ---------- */
  var _gradTex=null;
  function gradTex(){
    if(_gradTex) return _gradTex;
    var data = new Uint8Array([70,70,70, 160,160,160, 255,255,255]);
    _gradTex = new THREE.DataTexture(data, 3, 1, THREE.RGBFormat);
    _gradTex.minFilter=THREE.NearestFilter;
    _gradTex.magFilter=THREE.NearestFilter;
    _gradTex.needsUpdate=true;
    return _gradTex;
  }
  function mat(color){
    return new THREE.MeshToonMaterial({ color:new THREE.Color(color), gradientMap:gradTex() });
  }
  function flat(color, opts){
    var m = new THREE.MeshBasicMaterial({ color:new THREE.Color(color) });
    if(opts) for(var k in opts) m[k]=opts[k];
    return m;
  }
  function box(w,h,d,c){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(c)); }
  function cyl(rt,rb,h,seg,c){ return new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||6), mat(c)); }

  /* ============================================================
     初始化
     ============================================================ */
  function init(canvas){
    renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:false, alpha:false });
    renderer.setPixelRatio(1);
    renderer.setSize(rw, rh, false);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#131028');
    scene.fog = new THREE.Fog('#131028', 160, 420);

    camera = new THREE.PerspectiveCamera(26, rw/rh, 1, 900);
    camera.position.set(0, 26, 150);
    camera.lookAt(0, 16, 0);

    var amb = new THREE.AmbientLight('#4a5580', 0.85); scene.add(amb);
    var dir = new THREE.DirectionalLight('#b8c8ee', 0.75);
    dir.position.set(60, 110, 80); scene.add(dir);
    var moon = new THREE.PointLight('#7f94d8', 0.5, 400);
    moon.position.set(-90, 80, -40); scene.add(moon);
    objs.flashLight = new THREE.PointLight('#ffffff', 0, 500);
    objs.flashLight.position.set(0, 90, 30); scene.add(objs.flashLight);

    buildDock();
    buildBar();
    buildWonder();
    buildCharacters();
    showScene('dock');
  }

  /* ============================================================
     场景A: 灰港七号码头
     舞台: x -120..120, 地面 y0, 栈桥尽头(左) 灯塔(右)
     ============================================================ */
  function buildDock(){
    var root = new THREE.Group(); sceneRoots.dock = root; scene.add(root);

    // 码头地面 (木板)
    for(var i=0;i<40;i++){
      var plank = box(7.6, 1, 46, i%7===0 ? '#3a2c22' : (i%3===0?'#463528':'#41321f'));
      plank.position.set(-156+i*8, -0.5, -8);
      root.add(plank);
    }
    // 海面
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 700, 24, 10),
      new THREE.MeshToonMaterial({color:new THREE.Color('#16223e'), gradientMap:gradTex()}));
    sea.rotation.x = -Math.PI/2;
    sea.position.set(0, -6, -180);
    root.add(sea); objs.sea = sea;
    objs.seaBase = sea.geometry.attributes.position.array.slice();

    // 天幕 · 月亮
    var moonM = new THREE.Mesh(new THREE.CircleGeometry(11, 20), flat('#dfe6ff'));
    moonM.position.set(-95, 92, -290); root.add(moonM);
    var moonHalo = new THREE.Mesh(new THREE.CircleGeometry(17, 20), flat('#8fa0d8',{transparent:true,opacity:0.22}));
    moonHalo.position.set(-95, 92, -291); root.add(moonHalo);

    // 远景城市剪影(灰港)
    for(var b=0;b<14;b++){
      var bh = 18+((b*37)%42);
      var bld = new THREE.Mesh(new THREE.BoxGeometry(16+(b%4)*6, bh, 4), flat(b%2?'#191430':'#1e1838'));
      bld.position.set(-190+b*30, bh/2-4, -240);
      root.add(bld);
      // 零星窗光
      if(b%2===0){
        for(var w=0;w<3;w++){
          var win = new THREE.Mesh(new THREE.PlaneGeometry(2,2.6), flat(w%2?'#e8c15a':'#c86a4a'));
          win.position.set(-190+b*30-4+w*5, 8+((b*13+w*29)%(bh-12)), -237.9);
          root.add(win);
        }
      }
    }

    // ---- 灯塔 (右端 x=105) ----
    var lh = new THREE.Group();
    var lhBody = cyl(7, 10, 60, 10, '#8c3438'); lhBody.position.y=30; lh.add(lhBody);
    // 白色条纹
    for(var s=0;s<3;s++){
      var stripe = cyl(8.3-s*0.8, 8.8-s*0.8, 7, 10, '#d8d4c8');
      stripe.position.y = 12+s*17; lh.add(stripe);
    }
    var lhTop = cyl(5.5, 6.5, 8, 8, '#2a2436'); lhTop.position.y=64; lh.add(lhTop);
    var lampGlass = new THREE.Mesh(new THREE.CylinderGeometry(4.4,4.4,6,8), flat('#ffdf91'));
    lampGlass.position.y=63.4; lh.add(lampGlass);
    objs.lightGlass = lampGlass;
    var lhRoof = new THREE.Mesh(new THREE.ConeGeometry(7, 6, 8), mat('#3a2f4a'));
    lhRoof.position.y=71; lh.add(lhRoof);
    lh.position.set(105, 0, -18); root.add(lh);
    // 灯塔光束 — 锥顶(细端)固定在灯室, 绕灯室垂直轴旋转
    var beamG = new THREE.CylinderGeometry(1.6, 24, 150, 12, 1, true);
    beamG.translate(0, -75, 0);            // 细端移到原点(灯室)
    var beam = new THREE.Mesh(beamG, flat('#ffe9a8',{transparent:true,opacity:0.13,depthWrite:false,side:THREE.DoubleSide}));
    beam.rotation.z = Math.PI/2 + 0.06;    // 横置, 微微下压
    var beamPivot = new THREE.Group();
    beamPivot.position.set(105, 63, -18);  // 旋转轴心 = 灯室
    beamPivot.add(beam);
    root.add(beamPivot);
    objs.beam = beam; objs.beamPivot = beamPivot;

    // ---- 尸体: 你自己 (x=0 舞台中心) ----
    // 在 buildCharacters 中创建

    // 警戒线立柱
    for(var p=0;p<3;p++){
      var pole = cyl(0.5,0.7,6,6,'#c8b93a'); pole.position.set(-20+p*20, 3, 8); root.add(pole);
    }
    var tape = box(40, 1.2, 0.2, '#c8b93a'); tape.position.set(0, 5, 8);
    tape.rotation.z = 0.02; root.add(tape);
    var tape2 = box(40, 1.2, 0.2, '#c8b93a'); tape2.position.set(0, 3.4, 8);
    tape2.rotation.z=-0.015; root.add(tape2);

    // ---- 附身点道具 ----
    // 起重机吊臂+吊灯 (x=-30 上方)
    var craneBase = box(3,34,3,'#43405a'); craneBase.position.set(-52,17,-26); root.add(craneBase);
    var craneArm = box(56,2.4,2.4,'#514d6c'); craneArm.position.set(-28,34,-26); root.add(craneArm);
    var hookWire = box(0.5,10,0.5,'#222230'); hookWire.position.set(-6,28,-26); root.add(hookWire);
    var craneLamp = new THREE.Group();
    var lampShade = new THREE.Mesh(new THREE.ConeGeometry(3.4,3,8), mat('#3c465c')); craneLamp.add(lampShade);
    var lampBulb = new THREE.Mesh(new THREE.SphereGeometry(1.6,8,6), flat('#ffe9a8'));
    lampBulb.position.y=-1; craneLamp.add(lampBulb);
    craneLamp.position.set(-6,22,-26); root.add(craneLamp);
    objs.craneLamp = { grp:craneLamp, bulb:lampBulb, pos:new THREE.Vector3(-6,22,-16) };
    var lampCone = new THREE.Mesh(new THREE.CylinderGeometry(2,10,20,10,1,true),
        flat('#ffe9a8',{transparent:true,opacity:0.14,depthWrite:false}));
    lampCone.position.set(-6,12,-26); root.add(lampCone);
    objs.lampCone = lampCone;

    // 系缆桩 (x=-64)
    var bollard = new THREE.Group();
    var bolBody = cyl(2.6,3,5,10,'#3c3a48'); bolBody.position.y=2.5; bollard.add(bolBody);
    var bolCap = cyl(3.2,2.6,1.6,10,'#4c4a5c'); bolCap.position.y=5.4; bollard.add(bolCap);
    bollard.position.set(-64,0,-4); root.add(bollard);
    objs.bollard = { grp:bollard, pos:new THREE.Vector3(-64,4,-4) };
    // 缆绳
    var ropeCurve = [];
    for(var r=0;r<=10;r++){
      var rt=r/10;
      ropeCurve.push(new THREE.Vector3(-64+rt*-30, 5.5+Math.sin(rt*Math.PI)*-4, -6));
    }
    var rope = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropeCurve), 10, 0.5, 5),
      mat('#5c4c34'));
    root.add(rope); objs.rope = rope;

    // 渔船 (左端 x=-98, 泊在海上)
    var boat = new THREE.Group();
    var hull = box(30, 7, 12, '#35507c'); hull.position.y=1; boat.add(hull);
    var hullTrim = box(31, 1.4, 13, '#c8d0dc'); hullTrim.position.y=4.6; boat.add(hullTrim);
    var cabin = box(10, 8, 9, '#4a6488'); cabin.position.set(-6, 8, 0); boat.add(cabin);
    var cabinWin = new THREE.Mesh(new THREE.PlaneGeometry(6,3), flat('#ffdf91'));
    cabinWin.position.set(-6, 9, 4.6); boat.add(cabinWin);
    objs.boatWin = cabinWin;
    var mast = cyl(0.5,0.7,16,6,'#6a5a40'); mast.position.set(4,12,0); boat.add(mast);
    // 桅灯
    var mastLamp = new THREE.Mesh(new THREE.SphereGeometry(1.1,6,5), flat('#8fe8a0'));
    mastLamp.position.set(4, 20.5, 0); boat.add(mastLamp);
    objs.mastLamp = mastLamp;
    boat.position.set(-98, -4, -30);
    root.add(boat); objs.boat = { grp:boat, pos:new THREE.Vector3(-98,10,-30), baseY:-4 };

    // 起锚机手柄(船上) — 诡计点
    var winch = new THREE.Group();
    var winchBody = box(3,3,3,'#5a4838'); winchBody.position.y=1.5; winch.add(winchBody);
    var winchHandle = box(0.8, 5, 0.8, '#8a7452');
    winchHandle.position.set(0, 4.5, 0); winchHandle.rotation.z=0.5;
    winch.add(winchHandle);
    winch.position.set(6, 4.8, 0);
    objs.boat.grp.add(winch);
    objs.winch = { grp:winch, handle:winchHandle, pos:new THREE.Vector3(-92,12,-30) };

    // 集装箱堆 (互不重叠, 避免共面闪烁)
    var boxCols = ['#7c3a3a','#3a5a6c','#6c6134'];
    var contDefs = [ {x:46,y:5.5}, {x:71,y:5.5}, {x:52,y:16.6} ];
    for(var c=0;c<3;c++){
      var cont = box(24, 11, 12, boxCols[c]);
      cont.position.set(contDefs[c].x, contDefs[c].y, -22);
      root.add(cont);
      // 门缝线
      var seam = box(0.4, 9, 0.4, '#1c1826');
      seam.position.set(contDefs[c].x, contDefs[c].y, -15.9);
      root.add(seam);
    }

    // 油桶(集装箱顶) — 诡计点
    var drum = new THREE.Group();
    var drumBody = cyl(2.6,2.6,7,10,'#8c5a28'); drum.add(drumBody);
    var rib1 = new THREE.Mesh(new THREE.TorusGeometry(2.65,0.3,4,10), mat('#a06c34'));
    rib1.rotation.x=Math.PI/2; rib1.position.y=1.8; drum.add(rib1);
    var rib2 = rib1.clone(); rib2.position.y=-1.8; drum.add(rib2);
    drum.position.set(52, 25.7, -20);
    root.add(drum);
    objs.drum = { grp:drum, pos:new THREE.Vector3(52,26,-12), homePos:new THREE.Vector3(52,25.7,-20) };

    // 电话亭 (x=22)
    var booth = new THREE.Group();
    var boothFrame = box(7,16,7,'#28504c'); boothFrame.position.y=8; booth.add(boothFrame);
    var boothGlass = new THREE.Mesh(new THREE.PlaneGeometry(5,9), flat('#1c3450',{transparent:true,opacity:0.9}));
    boothGlass.position.set(0,9,3.6); booth.add(boothGlass);
    var boothTop = box(8,1.6,8,'#1c3c38'); boothTop.position.y=16.6; booth.add(boothTop);
    var phone = box(1.6,2.6,1,'#1a1a24'); phone.position.set(0,10,2.8); booth.add(phone);
    booth.position.set(22,0,-14); root.add(booth);
    objs.phoneA = { grp:booth, pos:new THREE.Vector3(22,9,-8) };

    // 灯塔基座的铁钟 (x=93) — 诡计点
    var bellFrame = new THREE.Group();
    var bfA = box(1.4,10,1.4,'#4a4436'); bfA.position.set(-3,5,0); bellFrame.add(bfA);
    var bfB = bfA.clone(); bfB.position.set(3,5,0); bellFrame.add(bfB);
    var bfTop = box(8,1.4,1.4,'#4a4436'); bfTop.position.y=10; bellFrame.add(bfTop);
    var bell = new THREE.Mesh(new THREE.ConeGeometry(2.6,4.4,10), mat('#b08c3c'));
    bell.position.y=7; bellFrame.add(bell);
    bellFrame.position.set(88,0,-10); root.add(bellFrame);
    objs.bell = { grp:bellFrame, bell:bell, pos:new THREE.Vector3(88,7,-4) };

    // 灯塔检修平台 (杀手立足点)
    var platform = box(12, 1.2, 8, '#3a3448');
    platform.position.set(94, 25, -20); root.add(platform);
    var platStrut = box(1.2, 25, 1.2, '#2c2838');
    platStrut.position.set(90, 12.5, -20); root.add(platStrut);
    var platStrut2 = platStrut.clone(); platStrut2.position.x = 98; root.add(platStrut2);
    var platRail = box(12, 0.6, 0.6, '#4a4460');
    platRail.position.set(94, 29, -16.4); root.add(platRail);

    // 木箱几个(掩体)
    var crate1 = box(9,9,9,'#5a4426'); crate1.position.set(-38,4.5,-14); root.add(crate1);
    var crate2 = box(7,7,7,'#66502e'); crate2.position.set(-31,3.5,-10); root.add(crate2);
    var crateX = box(8,1,8,'#3c2e1a'); crateX.position.set(-38,9.5,-14); root.add(crateX);

    // 证物箱 (第三章结尾由静波送还, 平时隐藏)
    var chest = new THREE.Group();
    var chestBody = box(7, 4.5, 5, '#4c3a20'); chestBody.position.y=2.25; chest.add(chestBody);
    var chestLid = box(7.4, 1.4, 5.4, '#5c4828'); chestLid.position.y=4.8; chest.add(chestLid);
    var chestBand = box(7.6, 0.8, 0.8, '#8a7452'); chestBand.position.set(0,2.4,2.6); chest.add(chestBand);
    var chestLock = box(1.4, 1.6, 0.6, '#b08c3c'); chestLock.position.set(0,2.6,2.8); chest.add(chestLock);
    chest.position.set(10, -8, -40); chest.visible=false;
    root.add(chest);
    objs.chest = { grp:chest };

    // 雨滴
    var rainG = new THREE.BoxGeometry(0.16, 4.2, 0.16);
    var rainM = flat('#5a7ab0',{transparent:true,opacity:0.4});
    for(var rd=0;rd<130;rd++){
      var dropM = new THREE.Mesh(rainG, rainM);
      dropM.position.set(rand(-170,170), rand(0,80), rand(-40,26));
      dropM.rotation.z = 0.06;
      root.add(dropM);
      rainDrops.push(dropM);
    }
  }

  /* ============================================================
     场景B: 「锚与钟」酒吧 (室内, x -70..70)
     ============================================================ */
  function buildBar(){
    var root = new THREE.Group(); sceneRoots.bar = root; scene.add(root);
    root.visible = false;

    // 地板
    for(var i=0;i<20;i++){
      var fl = box(8, 1, 60, i%2?'#33241c':'#3b2a20');
      fl.position.set(-76+i*8, -0.5, -6);
      root.add(fl);
    }
    // 后墙
    var wall = box(170, 46, 2, '#2e2434'); wall.position.set(0,23,-30); root.add(wall);
    var wainscot = box(170, 12, 1.6, '#241a28'); wainscot.position.set(0,6,-28.9); root.add(wainscot);
    // 天花与吊灯
    var ceil = box(170, 2, 60, '#1c1422'); ceil.position.set(0,45,-6); root.add(ceil);
    for(var l=0;l<3;l++){
      var wire = box(0.4, 8, 0.4, '#141018'); wire.position.set(-40+l*40, 40, -8); root.add(wire);
      var shade = new THREE.Mesh(new THREE.ConeGeometry(3.6, 3.2, 8), mat('#6c3428'));
      shade.position.set(-40+l*40, 35.6, -8); root.add(shade);
      var glow = new THREE.Mesh(new THREE.SphereGeometry(1.5,8,6), flat('#ffce7a'));
      glow.position.set(-40+l*40, 34.4, -8); root.add(glow);
      var cone = new THREE.Mesh(new THREE.CylinderGeometry(2,9,16,10,1,true),
        flat('#ffce7a',{transparent:true,opacity:0.1,depthWrite:false}));
      cone.position.set(-40+l*40, 26, -8); root.add(cone);
      if(l===1) objs.barLamp = { bulb:glow, cone:cone, pos:new THREE.Vector3(0,35,-2) };
      if(l===2) objs.barLamp2 = { bulb:glow, cone:cone, pos:new THREE.Vector3(40,35,-2) };
    }

    // 吧台 (x -10..40)
    var counter = box(52, 9, 8, '#4a3040'); counter.position.set(14,4.5,-6); root.add(counter);
    var counterTop = box(54, 1.6, 10, '#6a4a34'); counterTop.position.set(14,9.8,-6); root.add(counterTop);
    // 酒架
    var shelf = box(52, 20, 2, '#302038'); shelf.position.set(14,22,-27.5); root.add(shelf);
    var btlCols=['#3c7a58','#7a3c50','#c8a03c','#4a6a9c','#8c5a28'];
    for(var b=0;b<12;b++){
      var btl = cyl(0.9, 1.1, 4.5, 6, btlCols[b%5]);
      btl.position.set(-8+b*4, 17+(b%2)*7, -26.5);
      root.add(btl);
      var neck = cyl(0.35,0.4,1.6,6,btlCols[b%5]);
      neck.position.set(-8+b*4, 20+(b%2)*7, -26.5); root.add(neck);
    }

    // 点唱机 (x=-52) — 诡计点
    var juke = new THREE.Group();
    var jukeBody = box(11, 15, 7, '#7a2e3c'); jukeBody.position.y=7.5; juke.add(jukeBody);
    var jukeArch = new THREE.Mesh(new THREE.CylinderGeometry(5.5,5.5,7,12,1,false,0,Math.PI),
        mat('#8c3848'));
    jukeArch.rotation.z=Math.PI/2; jukeArch.rotation.y=Math.PI/2;
    jukeArch.position.y=15; juke.add(jukeArch);
    var jukeGlass = new THREE.Mesh(new THREE.CircleGeometry(3.6, 12, 0, Math.PI), flat('#ffb45a'));
    jukeGlass.position.set(0,15,3.6); juke.add(jukeGlass);
    objs.jukeGlass = jukeGlass;
    var jukeSlot = box(7,1,0.5,'#2c1018'); jukeSlot.position.set(0,9,3.6); juke.add(jukeSlot);
    juke.position.set(-52,0,-16); root.add(juke);
    objs.jukebox = { grp:juke, pos:new THREE.Vector3(-52,10,-8) };

    // 吊扇 (x=0 顶) — 诡计点
    var fan = new THREE.Group();
    var fanRod = cyl(0.4,0.4,5,6,'#241a20'); fanRod.position.y=2.5; fan.add(fanRod);
    var fanHub = cyl(1.2,1.2,1.2,8,'#3c3244'); fan.add(fanHub);
    var blades = new THREE.Group();
    for(var f=0;f<4;f++){
      var blade = box(9, 0.4, 2.2, '#54405c');
      blade.position.x = 5.5;
      var bg = new THREE.Group(); bg.rotation.y = f*Math.PI/2;
      bg.add(blade); blades.add(bg);
    }
    fan.add(blades);
    fan.position.set(-14, 41, -8); root.add(fan);
    objs.fan = { grp:fan, blades:blades, speed:0.8, pos:new THREE.Vector3(-14,40,-2) };

    // 老式座钟 (x=60) — 诡计点
    var clock = new THREE.Group();
    var clockBody = box(8, 26, 5, '#4c3220'); clockBody.position.y=13; clock.add(clockBody);
    var clockFace = new THREE.Mesh(new THREE.CircleGeometry(3, 12), flat('#e8dcc0'));
    clockFace.position.set(0,21,2.6); clock.add(clockFace);
    var handH = box(0.5, 2, 0.2, '#241810'); handH.position.set(0,21.6,2.8); clock.add(handH);
    var handM = box(0.4, 2.8, 0.2, '#241810'); handM.position.set(0.6,21.2,2.8); handM.rotation.z=-1; clock.add(handM);
    var pendWin = box(4.5, 12, 0.6, '#2a1c10'); pendWin.position.set(0,7,2.4); clock.add(pendWin);
    var pend = new THREE.Group();
    var pendRod = box(0.5, 9, 0.3, '#b08c3c'); pendRod.position.y=-4.5; pend.add(pendRod);
    var pendBob = new THREE.Mesh(new THREE.CircleGeometry(1.6, 10), flat('#d8ae4c'));
    pendBob.position.set(0,-9,0.2); pend.add(pendBob);
    pend.position.set(0,13,2.8); clock.add(pend);
    objs.clockPend = pend;
    clock.position.set(60,0,-24); root.add(clock);
    objs.barClock = { grp:clock, pos:new THREE.Vector3(60,14,-16) };

    // 酒杯(吧台上, 老盐的座位前) — 诡计点
    var glass = new THREE.Group();
    var gBody = cyl(1.1, 0.9, 2.6, 8, '#a8c8d8'); gBody.position.y=1.3; glass.add(gBody);
    var gLiquid = cyl(0.95, 0.8, 1.4, 8, '#c8862c'); gLiquid.position.y=1; glass.add(gLiquid);
    glass.position.set(18, 10.6, -4); root.add(glass);
    objs.glass = { grp:glass, pos:new THREE.Vector3(18,12,-1), homePos:new THREE.Vector3(18,10.6,-4) };

    // 墙上的舵轮 (装饰 + 幽灵跳点)
    var wheel = new THREE.Group();
    var wheelRim = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.7, 5, 10), mat('#6a4a2c'));
    wheel.add(wheelRim);
    for(var sp=0; sp<4; sp++){
      var spoke = box(0.8, 11, 0.8, '#7a5a38');
      spoke.rotation.z = sp*Math.PI/4;
      wheel.add(spoke);
    }
    var wheelHub = cyl(1.2, 1.2, 1.2, 8, '#54402c');
    wheelHub.rotation.x = Math.PI/2; wheel.add(wheelHub);
    wheel.position.set(-30, 22, -27.5);
    root.add(wheel);
    objs.wheel = { grp:wheel, pos:new THREE.Vector3(-30,22,-18) };

    // 窗户(可见雨)
    for(var wd=0;wd<2;wd++){
      var winF = box(14, 16, 1, '#241c2c'); winF.position.set(-66+wd*20, 22, -29); root.add(winF);
      var winG = new THREE.Mesh(new THREE.PlaneGeometry(11,13), flat('#101c34'));
      winG.position.set(-66+wd*20, 22, -28.4); root.add(winG);
      var winBar = box(0.8, 14, 0.5, '#241c2c'); winBar.position.set(-66+wd*20, 22, -28.2); root.add(winBar);
      var winBar2 = box(12, 0.8, 0.5, '#241c2c'); winBar2.position.set(-66+wd*20, 22, -28.2); root.add(winBar2);
    }

    // 高脚凳
    for(var st=0;st<4;st++){
      var stool = new THREE.Group();
      var stTop = cyl(2.4,2.4,1.2,8,'#6a3838'); stTop.position.y=7; stool.add(stTop);
      var stLeg = cyl(0.5,0.7,7,6,'#2c2028'); stLeg.position.y=3.2; stool.add(stLeg);
      stool.position.set(-2+st*11, 0, 2);
      root.add(stool);
    }
    // 散桌
    var table = new THREE.Group();
    var tbTop = cyl(5.5,5.5,1,10,'#5c4028'); tbTop.position.y=7.5; table.add(tbTop);
    var tbLeg = cyl(0.7,1,7,6,'#3a2818'); tbLeg.position.y=3.5; table.add(tbLeg);
    table.position.set(-32,0,4); root.add(table);
  }

  /* ============================================================
     奇观: 静波 — 海面上凝固的巨浪 (码头场景)
     ============================================================ */
  function buildWonder(){
    var root = new THREE.Group();
    sceneRoots.wonder = root;
    sceneRoots.dock.add(root);
    root.visible = false;

    // 巨浪主体: 半环面弧墙 — 不受雾影响 + 自发光, 保证广角下的可见度
    var waveGeo = new THREE.CylinderGeometry(60, 78, 90, 26, 4, true, Math.PI*0.15, Math.PI*0.7);
    var waveMat = new THREE.MeshToonMaterial({
      color:new THREE.Color('#3a8a96'), gradientMap:gradTex(),
      emissive:new THREE.Color('#123c46'),
      side:THREE.DoubleSide, transparent:true, opacity:0.94,
      fog:false
    });
    var wave = new THREE.Mesh(waveGeo, waveMat);
    wave.rotation.z = Math.PI/2;
    wave.rotation.y = Math.PI/2;
    wave.position.set(0, -40, -150);
    root.add(wave); objs.wave = wave;

    // 浪尖泡沫
    var foam = new THREE.Group();
    for(var i=0;i<16;i++){
      var fm = new THREE.Mesh(new THREE.SphereGeometry(3+Math.random()*4, 6, 5),
        flat('#d8efe8',{transparent:true,opacity:0.9,fog:false}));
      fm.position.set(-110+i*15, 52+Math.sin(i*1.7)*7, -128+Math.cos(i*2.3)*10);
      foam.add(fm);
    }
    root.add(foam); objs.foam = foam;

    // 悬滞的水珠 (静止在空中)
    var beads = new THREE.Group();
    for(var b=0;b<40;b++){
      var bd = new THREE.Mesh(new THREE.SphereGeometry(0.6+Math.random()*1.1, 5, 4),
        flat('#9fd8e0',{transparent:true,opacity:0.85,fog:false}));
      bd.position.set(rand(-120,120), rand(18,66), rand(-120,-60));
      bd.userData.phase = Math.random()*Math.PI*2;
      bd.userData.baseY = bd.position.y;
      beads.add(bd);
    }
    root.add(beads); objs.beads = beads;

    // 浪体内的幽光
    var waveGlow = new THREE.PointLight('#4fd8c8', 0, 320);
    waveGlow.position.set(0, 30, -110);
    root.add(waveGlow); objs.waveGlow = waveGlow;
  }

  /* ============================================================
     角色工厂 — 低面数积木人 + 关节组
     ============================================================ */
  function makeCharacter(def){
    var S = def.scale||1;
    var root = new THREE.Group();

    var hips = new THREE.Group(); hips.position.y = 8.4*S; root.add(hips);

    var torso = box(4.6*S, 6*S, 2.8*S, def.coat||def.body||'#3a4356');
    torso.position.y = 3*S; hips.add(torso);
    if(def.coat && def.body){
      var shirt = box(3.4*S, 3*S, 3*S, def.body);
      shirt.position.set(0, 3.6*S, 0.1*S); hips.add(shirt);
    }
    if(def.coatSkirt){
      var skirt = box(5*S, 3*S, 3.2*S, def.coat);
      skirt.position.y = -0.6*S; hips.add(skirt);
    }
    // 领带
    if(def.tie){
      var tie = box(1*S, 2.6*S, 0.3*S, def.tie);
      tie.position.set(0, 4*S, 1.6*S); hips.add(tie);
    }

    // 头
    var neck = new THREE.Group(); neck.position.y = 6.4*S; hips.add(neck);
    var head = box(3.4*S, 3.4*S, 3.2*S, def.skin||'#e8b98c');
    head.position.y = 1.8*S; neck.add(head);
    if(def.hair){
      var hair = box(3.8*S, 1.6*S, 3.6*S, def.hair);
      hair.position.y = 3.4*S; neck.add(hair);
      var hairB = box(3.8*S, 2.4*S, 1*S, def.hair);
      hairB.position.set(0, 2.4*S, -1.4*S); neck.add(hairB);
    }
    if(def.hat){
      var hatTop = box(3.6*S, 1.8*S, 3.4*S, def.hat);
      hatTop.position.y = 4.2*S; neck.add(hatTop);
      var brim = box(5.4*S, 0.5*S, 5*S, def.hat);
      brim.position.y = 3.4*S; neck.add(brim);
    }
    if(def.cap){ // 尖顶软帽
      var capB = box(3.7*S, 1.7*S, 3.5*S, def.cap);
      capB.position.y = 3.6*S; neck.add(capB);
      var capBrim = box(1.8*S, 0.4*S, 1.6*S, def.cap);
      capBrim.position.set(0, 3*S, 2.2*S); neck.add(capBrim);
    }
    if(def.beard){
      var beard = box(3*S, 1.6*S, 0.8*S, def.beard);
      beard.position.set(0, 0.6*S, 1.5*S); neck.add(beard);
    }
    // 眼睛(正面小黑块, 让角色有朝向感)
    var eyeL = box(0.5*S, 0.7*S, 0.2*S, def.eye||'#181820');
    eyeL.position.set(-0.8*S, 2*S, 1.7*S); neck.add(eyeL);
    var eyeR = eyeL.clone(); eyeR.position.x = 0.8*S; neck.add(eyeR);

    // 手臂 (肩关节)
    function arm(side){
      var g = new THREE.Group();
      g.position.set(side*2.8*S, 5.6*S, 0); hips.add(g);
      var upper = box(1.4*S, 3.4*S, 1.4*S, def.coat||def.body||'#3a4356');
      upper.position.y = -1.5*S; g.add(upper);
      var elbow = new THREE.Group(); elbow.position.y = -3.2*S; g.add(elbow);
      var fore = box(1.2*S, 3*S, 1.2*S, def.coat||def.body||'#3a4356');
      fore.position.y = -1.4*S; elbow.add(fore);
      var hand = box(1.3*S, 1.2*S, 1.3*S, def.skin||'#e8b98c');
      hand.position.y = -3*S; elbow.add(hand);
      return {shoulder:g, elbow:elbow, hand:hand};
    }
    var armL = arm(-1), armR = arm(1);

    // 腿 (髋关节)
    function leg(side){
      var g = new THREE.Group();
      g.position.set(side*1.2*S, 0, 0); hips.add(g);
      var thigh = box(1.7*S, 4*S, 1.9*S, def.pants||'#2a2c3c');
      thigh.position.y = -1.8*S; g.add(thigh);
      var knee = new THREE.Group(); knee.position.y = -3.8*S; g.add(knee);
      var shin = box(1.5*S, 3.6*S, 1.6*S, def.pants||'#2a2c3c');
      shin.position.y = -1.8*S; knee.add(shin);
      var foot = box(1.6*S, 1*S, 2.6*S, def.shoe||'#181822');
      foot.position.set(0, -3.9*S, 0.5*S); knee.add(foot);
      return {hip:g, knee:knee};
    }
    var legL = leg(-1), legR = leg(1);

    var chr = {
      root:root, hips:hips, neck:neck,
      armL:armL, armR:armR, legL:legL, legR:legR,
      S:S, walkPhase:0,
      pose:null, poseA:1, // 姿势插值
      baseHipY: 8.4*S,
      breathe:true
    };
    scene.add(root);
    return chr;
  }

  /* ---------- 姿势库 (关节角) ---------- */
  var POSES = {
    idle:     { alz:0.06, arz:-0.06, alx:0, arx:0, ael:-0.1, aer:-0.1,
                llx:0, lrx:0, kl:0, kr:0, hipDY:0, hipRX:0, hipRZ:0, neckRX:0 },
    kneel:    { alx:-0.6, arx:-0.9, ael:-0.7, aer:-1.1, llx:-1.5, lrx:-0.5, kl:2.1, kr:1.8,
                hipDY:-3.4, hipRX:0.25, hipRZ:0, neckRX:0.3 },
    lie:      { alx:0.3, arx:-2.6, ael:-0.2, aer:-0.3, llx:0.15, lrx:-0.2, kl:0.25, kr:0.1,
                hipDY:-6.4, hipRX:-1.45, hipRZ:0.08, neckRX:-0.2 },
    aim:      { alx:-1.1, arx:-1.5, ael:-0.5, aer:0, llx:0.1, lrx:-0.1, kl:0, kr:0,
                hipDY:0, hipRX:0, hipRZ:0, neckRX:0 },
    stagger:  { alx:-0.7, arx:0.5, ael:-0.9, aer:-0.3, llx:-0.4, lrx:0.5, kl:0.7, kr:0,
                hipDY:-1, hipRX:-0.2, hipRZ:0.15, neckRX:-0.25 },
    sitBar:   { alx:-0.9, arx:-0.9, ael:-1.3, aer:-1.3, llx:-1.5, lrx:-1.5, kl:1.5, kr:1.5,
                hipDY:-1.5, hipRX:0.08, hipRZ:0, neckRX:0.12 },
    lean:     { alx:0.2, arx:-1.3, ael:-0.15, aer:-1.2, llx:0.1, lrx:-0.25, kl:0, kr:0.3,
                hipDY:-0.5, hipRX:0.06, hipRZ:-0.12, neckRX:0.1 },
    point:    { alz:0.06, arx:-1.5, ael:-0.1, aer:0, llx:0, lrx:0, kl:0, kr:0,
                hipDY:0, hipRX:0, hipRZ:0, neckRX:0 },
    shock:    { alx:-2.5, arx:-2.5, ael:-0.4, aer:-0.4, llx:-0.15, lrx:0.15, kl:0.15, kr:0.15,
                hipDY:-0.6, hipRX:-0.12, hipRZ:0, neckRX:-0.3 },
    knockout: { alx:-0.4, arx:0.5, ael:-0.3, aer:-0.2, llx:0.4, lrx:-0.3, kl:0.3, kr:0.6,
                hipDY:-6.8, hipRX:-1.3, hipRZ:-0.35, neckRX:-0.35 },
    crouch:   { alx:-0.5, arx:-0.5, ael:-0.8, aer:-0.8, llx:-1.7, lrx:-1.6, kl:2.2, kr:2.1,
                hipDY:-4.6, hipRX:0.35, hipRZ:0, neckRX:0.2 },
    hatTip:   { alz:0.06, arx:-2.5, aer:-2.5, llx:0, lrx:0, kl:0, kr:0,
                hipDY:0, hipRX:0, hipRZ:0, neckRX:0.18 },
    salute:   { alz:0.06, arx:-2.3, aer:-2.4, llx:0, lrx:0, kl:0, kr:0,
                hipDY:0, hipRX:-0.04, hipRZ:0, neckRX:0 },
    read:     { alx:-1.1, arx:-1.1, ael:-1.4, aer:-1.4, llx:0, lrx:0, kl:0, kr:0,
                hipDY:0, hipRX:0.05, hipRZ:0, neckRX:0.35 },
    wonderGaze:{ alz:0.05, arz:-0.05, alx:-0.2, arx:-0.2, ael:-0.1, aer:-0.1,
                llx:0, lrx:0, kl:0, kr:0, hipDY:0, hipRX:-0.06, hipRZ:0, neckRX:-0.4 }
  };

  function setPose(chr, poseName, instant){
    chr.pose = POSES[poseName] ? poseName : 'idle';
    chr.poseA = instant ? 1 : 0;
  }
  function applyPose(chr, dt){
    if(!chr.pose) return;
    var p = POSES[chr.pose];
    if(chr.poseA<1) chr.poseA = Math.min(1, chr.poseA + dt*4.5);
    var a = easeInOut(chr.poseA)*0.22;
    function L(cur, tgt){ return lerp(cur, tgt, a); }
    chr.armL.shoulder.rotation.x = L(chr.armL.shoulder.rotation.x, p.alx||0);
    chr.armR.shoulder.rotation.x = L(chr.armR.shoulder.rotation.x, p.arx||0);
    chr.armL.shoulder.rotation.z = L(chr.armL.shoulder.rotation.z, p.alz||0);
    chr.armR.shoulder.rotation.z = L(chr.armR.shoulder.rotation.z, p.arz||0);
    chr.armL.elbow.rotation.x = L(chr.armL.elbow.rotation.x, p.ael||0);
    chr.armR.elbow.rotation.x = L(chr.armR.elbow.rotation.x, p.aer||0);
    chr.legL.hip.rotation.x = L(chr.legL.hip.rotation.x, p.llx||0);
    chr.legR.hip.rotation.x = L(chr.legR.hip.rotation.x, p.lrx||0);
    chr.legL.knee.rotation.x = L(chr.legL.knee.rotation.x, p.kl||0);
    chr.legR.knee.rotation.x = L(chr.legR.knee.rotation.x, p.kr||0);
    chr.hips.position.y = L(chr.hips.position.y, chr.baseHipY + (p.hipDY||0)*chr.S);
    chr.hips.rotation.x = L(chr.hips.rotation.x, p.hipRX||0);
    chr.hips.rotation.z = L(chr.hips.rotation.z, p.hipRZ||0);
    chr.neck.rotation.x = L(chr.neck.rotation.x, p.neckRX||0);
    // 呼吸
    if(chr.breathe && (chr.pose==='idle'||chr.pose==='lean'||chr.pose==='sitBar')){
      var br = Math.sin(performance.now()/1000*2 + chr.baseHipY)*0.02;
      chr.hips.scale.y = 1+br;
    }
  }

  function buildCharacters(){
    // 你的尸体 — 灰港码头, 舞台中央
    chars.corpse = makeCharacter({
      coat:'#4a4256', body:'#7a7488', skin:'#cbb193', hair:'#5c5147',
      pants:'#33303e', shoe:'#1c1a24', tie:'#a83a4c'
    });
    chars.corpse.root.position.set(0, 0.6, -6);
    chars.corpse.root.rotation.y = 0.5;
    setPose(chars.corpse, 'lie', true);
    chars.corpse.breathe=false;

    // 小卫 — 年轻警员
    chars.wei = makeCharacter({
      coat:'#2e4d54', body:'#3c6a74', skin:'#f2c6a0', hair:'#2c2f3e',
      cap:'#2e4d54', pants:'#243c44', shoe:'#141c20'
    });
    chars.wei.root.position.set(14, 0, -8);
    setPose(chars.wei, 'kneel', true);
    // 步态: 轻快小碎步, 手臂摆动大 — 年轻人的走法
    chars.wei.gait = { stride:1.4, bounce:1.25, arm:1.15 };

    // 灰面人 — 杀手
    chars.killer = makeCharacter({
      coat:'#23222b', body:'#2c2b36', skin:'#8f93a8', hat:'#191820',
      pants:'#1a1922', shoe:'#0e0d14', scale:1.06, eye:'#d8e5ff'
    });
    chars.killer.root.position.set(300, 0, -10);
    setPose(chars.killer, 'idle', true);
    chars.killer.root.visible = false;
    // 步态: 大步幅低起伏, 手几乎不摆 — 滑行般的压迫感
    chars.killer.gait = { stride:0.55, bounce:0.25, arm:0.25 };

    // 老海员
    chars.sailor = makeCharacter({
      coat:'#3d4b63', body:'#4c5a74', skin:'#d9a078', beard:'#b9bcc4',
      cap:'#a8392e', pants:'#2c3444', shoe:'#1a2028', scale:0.98
    });
    chars.sailor.root.position.set(300, 0, -4);
    chars.sailor.root.visible = false;
    // 步态: 醉醺醺的摇晃
    chars.sailor.gait = { stride:0.9, bounce:1.6, arm:0.8 };

    // 酒保
    chars.bartender = makeCharacter({
      coat:'#2d2a3a', body:'#e8e3d8', skin:'#e3b48c', hair:'#4c3a2c',
      pants:'#242030', shoe:'#16121c'
    });
    chars.bartender.root.position.set(300, 0, -14);
    chars.bartender.root.visible = false;

    // 码头猫
    var cat = new THREE.Group();
    var catBody = box(2.4, 1.8, 4, '#3a3a44'); catBody.position.y=1.6; cat.add(catBody);
    var catHead = box(2, 1.8, 1.8, '#3a3a44'); catHead.position.set(0, 2.8, 2.2); cat.add(catHead);
    var catEarL = new THREE.Mesh(new THREE.ConeGeometry(0.45,0.9,4), mat('#3a3a44'));
    catEarL.position.set(-0.6, 4, 2.2); cat.add(catEarL);
    var catEarR = catEarL.clone(); catEarR.position.x=0.6; cat.add(catEarR);
    var catEyeL = box(0.36,0.36,0.1,'#ffd24a'); catEyeL.position.set(-0.5,2.9,3.15); cat.add(catEyeL);
    var catEyeR = catEyeL.clone(); catEyeR.position.x=0.5; cat.add(catEyeR);
    var catChest = box(1.4,1,0.6,'#e8e8f0'); catChest.position.set(0,1.4,3.4); cat.add(catChest);
    var catTail = box(0.5, 2.6, 0.5, '#3a3a44');
    catTail.position.set(0, 2.6, -2.2); catTail.rotation.x = -0.7; cat.add(catTail);
    cat.position.set(-38, 10, -14);
    sceneRoots.dock.add(cat);
    chars.cat = { root:cat, tail:catTail, homePos:cat.position.clone() };

    // 你的灵魂火焰 — 3D中不渲染实体(由底屏表示), 但奇观时刻用一朵小蓝焰
    var soul = new THREE.Group();
    var flame = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.6, 7), flat('#8fd8ff',{transparent:true,opacity:0.85}));
    flame.position.y = 2; soul.add(flame);
    var flameCore = new THREE.Mesh(new THREE.SphereGeometry(0.9, 7, 5), flat('#eaf6ff'));
    flameCore.position.y=1.4; soul.add(flameCore);
    soul.visible = false;
    scene.add(soul);
    chars.soul = { root:soul, flame:flame };
  }

  /* ============================================================
     场景切换
     ============================================================ */
  function showScene(name){
    curScene = name;
    sceneRoots.dock.visible = (name==='dock');
    sceneRoots.bar.visible = (name==='bar');
    rainOn = (name==='dock');
    if(name==='bar'){
      scene.background.set('#1c1220');
      scene.fog.color.set('#1c1220');
      scene.fog.near=180; scene.fog.far=520;
      camY=24; camTargetY=24;
    }else{
      scene.background.set('#131028');
      scene.fog.color.set('#131028');
      scene.fog.near=160; scene.fog.far=420;
      camY=26; camTargetY=26;
    }
  }

  /* ============================================================
     动画协程 & 常用演出
     ============================================================ */
  function animate(fn){ animators.push({update:fn}); }

  /* 走路: 角色沿x移动到 targetX, done回调
     token机制: 新的行走指令会自动取代旧的, 不会互相打架
     keepFace: 到达后保持行进朝向(侧身), 不转回镜头
     步态由 chr.gait 决定 — 每个角色走路都有自己的性格 */
  function walkTo(chr, targetX, speed, done, keepFace){
    speed = speed||14;
    chr._wt = (chr._wt||0)+1;
    var token = chr._wt;
    chr.pose = null; // 走路时接管
    var g = chr.gait || {stride:1, bounce:1, arm:1};
    var dir = targetX > chr.root.position.x ? 1 : -1;
    chr.root.rotation.y = dir>0 ? Math.PI/2 : -Math.PI/2;
    animate(function(dt){
      if(chr._wt !== token) return true; // 被新指令取代
      var dx = targetX - chr.root.position.x;
      if(Math.abs(dx) < 1){
        if(!keepFace) chr.root.rotation.y = 0;
        chr.walkPhase = 0;
        setPose(chr, 'idle');
        if(done) done();
        return true;
      }
      chr.root.position.x += Math.sign(dx)*speed*dt;
      chr.walkPhase += dt*speed*0.75*g.stride;
      var sw = Math.sin(chr.walkPhase);
      var sw2 = Math.sin(chr.walkPhase+Math.PI);
      chr.legL.hip.rotation.x = sw*0.65;
      chr.legR.hip.rotation.x = sw2*0.65;
      chr.legL.knee.rotation.x = Math.max(0, -sw)*0.9;
      chr.legR.knee.rotation.x = Math.max(0, -sw2)*0.9;
      chr.armL.shoulder.rotation.x = sw2*0.45*g.arm;
      chr.armR.shoulder.rotation.x = sw*0.45*g.arm;
      chr.hips.position.y = chr.baseHipY + Math.abs(Math.cos(chr.walkPhase))*0.55*g.bounce;
      return false;
    });
  }
  /* 停止当前行走(保持所在位置) */
  function stopWalk(chr, pose){
    chr._wt = (chr._wt||0)+1;
    chr.root.rotation.y = 0;
    setPose(chr, pose||'idle');
  }

  /* 通用位移动画 */
  function tweenPos(obj, to, dur, ease, done){
    var from = obj.position.clone();
    var t = 0;
    animate(function(dt){
      t += dt/dur;
      if(t>=1){
        obj.position.copy(to);
        if(done) done();
        return true;
      }
      var e = (ease||easeInOut)(t);
      obj.position.lerpVectors(from, to, e);
      return false;
    });
  }

  /* ---------- 诡计演出 ---------- */
  function trickLampFlicker(done){ // 吊灯熄灭
    var n=0;
    var iv = Sched.iv(function(){
      n++;
      var on = n%2===0;
      objs.craneLamp.bulb.material.color.set(on?'#ffe9a8':'#332e20');
      objs.lampCone.material.opacity = on?0.14:0;
      if(n>5){
        Sched.clearIv(iv);
        objs.craneLamp.bulb.material.color.set('#332e20');
        objs.lampCone.material.opacity = 0;
        if(done) done();
      }
    }, 120);
  }
  function trickLampOn(){
    objs.craneLamp.bulb.material.color.set('#ffe9a8');
    objs.lampCone.material.opacity=0.14;
  }
  function trickBell(done){ // 铜钟摇晃 — 青铜三连响 + 声波涟漪
    var t=0;
    AudioSys.sfx.bellToll();
    function spawnRing(delay){
      Sched.to(function(){
        var ring = new THREE.Mesh(new THREE.RingGeometry(2, 2.7, 20),
          flat('#ffe9a8',{transparent:true,opacity:0.65,side:THREE.DoubleSide,depthWrite:false}));
        ring.position.set(88, 7, -4);
        sceneRoots.dock.add(ring);
        var rt=0;
        animate(function(dt){
          rt+=dt;
          var s = 1+rt*10;
          ring.scale.set(s,s,1);
          ring.material.opacity = 0.65*Math.max(0, 1-rt/1.1);
          if(rt>1.1){ sceneRoots.dock.remove(ring); return true; }
          return false;
        });
      }, delay*1000);
    }
    spawnRing(0); spawnRing(1.05); spawnRing(2.1);
    animate(function(dt){
      t+=dt;
      objs.bell.bell.rotation.z = Math.sin(t*11)*0.5*Math.max(0,1-t/3.4);
      if(t>3.5){ objs.bell.bell.rotation.z=0; if(done)done(); return true; }
      return false;
    });
  }
  function trickDrumDrop(done){ // 油桶滚落集装箱 — 向前(镜头侧)滚出边缘再坠落
    var drum = objs.drum.grp;
    var phase=0, vy=0, t=0, bounced=false;
    AudioSys.sfx.creak();
    animate(function(dt){
      t+=dt;
      if(phase===0){ // 滚向集装箱前缘 (x左移 + z向镜头)
        drum.position.x -= dt*9;
        drum.position.z += dt*7;
        drum.rotation.z += dt*4;
        if(drum.position.z >= -13 || drum.position.x < 44){ phase=1; vy=0; }
      } else if(phase===1){ // 坠落
        vy += dt*85;
        drum.position.y -= vy*dt;
        drum.position.x -= dt*4;
        drum.position.z = Math.min(-11, drum.position.z + dt*5);
        drum.rotation.z += dt*7;
        if(drum.position.y <= 3.5){
          drum.position.y = 3.5;
          if(!bounced){ // 落地反弹一下, 更有实感
            bounced = true; vy = -vy*0.3;
            AudioSys.sfx.crash();
            GFX.shake(3, 0.4);
            GFX.flash('#886644', 0.25);
          } else {
            phase=2; t=0;
          }
        }
      } else { // 落地滚动一小段停在杀手脚边
        drum.position.x -= dt*13*Math.max(0,1-t*1.4);
        drum.rotation.z += dt*5*Math.max(0,1-t*1.4);
        if(t>1){ if(done)done(); return true; }
      }
      return false;
    });
  }
  function trickWinch(done){ // 起锚机 → 缆绳绷断 → 渔船倾斜鸣笛
    var t=0;
    AudioSys.sfx.creak();
    animate(function(dt){
      t+=dt;
      objs.winch.handle.rotation.z += dt*7;
      if(t>0.9){
        objs.rope.visible=false;
        AudioSys.sfx.crash();
        var boat = objs.boat.grp;
        var t2=0;
        animate(function(dt2){
          t2+=dt2;
          boat.rotation.z = Math.sin(t2*2.4)*0.13*Math.max(0,1-t2/3);
          boat.position.x = -98 + t2*4;
          if(t2>3){ if(done)done(); return true; }
          return false;
        });
        return true;
      }
      return false;
    });
  }
  function trickPhoneRing(dur, done){
    AudioSys.sfx.phone();
    var t=0;
    var booth = objs.phoneA.grp;
    animate(function(dt){
      t+=dt;
      booth.rotation.z = Math.sin(t*40)*0.008;
      if(t>=(dur||1.6)){ booth.rotation.z=0; if(done)done(); return true; }
      return false;
    });
  }
  function trickJukebox(done){
    AudioSys.sfx.jukebox();
    var t=0;
    animate(function(dt){
      t+=dt;
      var f = Math.sin(t*9)>0;
      objs.jukeGlass.material.color.set(f?'#ffd24a':'#ff7a5a');
      if(t>2.4){ objs.jukeGlass.material.color.set('#ffb45a'); if(done)done(); return true; }
      return false;
    });
  }
  function trickFanSpin(done){
    var t=0;
    AudioSys.sfx.swing();
    animate(function(dt){
      t+=dt;
      objs.fan.speed = 0.8 + easeIn(Math.min(1,t/1.4))*22;
      if(t>1.6){ if(done)done(); return true; }
      return false;
    });
  }
  function trickFanStop(){
    var t=0;
    animate(function(dt){
      t+=dt;
      objs.fan.speed = lerp(objs.fan.speed, 0.8, dt*2);
      return t>2;
    });
  }
  function trickGlassSlide(done){ // 酒杯滑过吧台 → 冲出台沿摔碎
    var glass = objs.glass.grp;
    var t=0, phase=0, vy=0;
    AudioSys.sfx.swing();
    animate(function(dt){
      t+=dt;
      if(phase===0){
        glass.position.x += dt*34;
        glass.rotation.z = -0.05;
        if(glass.position.x > 42){ phase=1; vy=0; AudioSys.sfx.glass(); }
      } else if(phase===1){
        vy += dt*70;
        glass.position.y -= vy*dt;
        glass.position.x += dt*10;
        glass.rotation.z -= dt*7;
        if(glass.position.y <= 1){
          glass.visible=false;
          AudioSys.sfx.glass();
          GFX.shake(1.6, 0.2);
          phase=2; t=0;
        }
      } else {
        if(t>0.4){ if(done)done(); return true; }
      }
      return false;
    });
  }
  function trickClockChime(done){
    var t=0;
    AudioSys.sfx.bell();
    Sched.to(function(){AudioSys.sfx.bell();},500);
    Sched.to(function(){AudioSys.sfx.bell();},1000);
    animate(function(dt){
      t+=dt;
      objs.clockPend.rotation.z = Math.sin(t*10)*0.45*Math.max(0,1-t/2.4);
      if(t>2.4){ if(done)done(); return true; }
      return false;
    });
  }
  /* ============================================================
     表情气泡 (幽灵诡计式 情绪标记 + 提示音)
     ============================================================ */
  var emoteTexCache = {};
  function emoteTexture(type){
    if(emoteTexCache[type]) return emoteTexCache[type];
    var c = makeCanvas(32,32);
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    function glyph(ch, color){
      x.font = 'bold 26px Arial';
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
    else if(type==='sweat'){
      // 汗滴
      x.strokeStyle='#10202c'; x.lineWidth=3;
      x.fillStyle='#7fd0ff';
      x.beginPath();
      x.moveTo(16,4);
      x.quadraticCurveTo(25,17,16,26);
      x.quadraticCurveTo(7,17,16,4);
      x.closePath(); x.stroke(); x.fill();
      x.fillStyle='#d8f0ff';
      x.fillRect(12,14,3,5);
    }
    else if(type==='anger'){
      // 漫画怒筋 (十字弧)
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
  var EMOTE_SFX = { '!':'shock', '?':'question', 'sweat':'sweat',
                    'anger':'anger', 'note':'noteJingle', 'dots':'sweat' };
  function emote(chr, type, opts){
    opts = opts||{};
    var tex = emoteTexture(type);
    var m = new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false});
    var sp = new THREE.Sprite(m);
    sp.renderOrder = 999;
    var base = (chr && chr.root) ? chr.root.position : (chr || new THREE.Vector3());
    var yOff = opts.y !== undefined ? opts.y : ((chr && chr.S) ? 19.5*chr.S : 9);
    scene.add(sp);
    var fx = AudioSys.sfx[EMOTE_SFX[type]];
    if(fx) fx();
    var t=0, dur = opts.dur||1.25;
    animate(function(dt){
      t+=dt;
      var pop = t<0.16 ? easeOut(t/0.16)*1.15 : (t<0.3 ? 1.15-((t-0.16)/0.14)*0.15 : 1);
      var s = 7.5*pop;
      sp.scale.set(s,s,1);
      sp.position.set(base.x+2.5, base.y+yOff+Math.sin(t*5)*0.5, base.z+3);
      if(t>dur-0.22) m.opacity = Math.max(0,(dur-t)/0.22);
      if(t>=dur){ scene.remove(sp); m.dispose(); return true; }
      return false;
    });
  }

  /* ============================================================
     招牌动作库
     ============================================================ */
  /* 灰面人: 从高台跃下 — 大衣张开、蹲身落地、扶帽起身
     落点始终回到 z=-8 的表演主线, 不会扎进集装箱 */
  function killerLeap(toX, done){
    var k = chars.killer;
    var sx = k.root.position.x, sy = k.root.position.y, sz = k.root.position.z;
    setPose(k,'crouch');
    Sched.to(function(){
      AudioSys.sfx.whoosh();
      var t=0, dur=0.72;
      animate(function(dt){
        t+=dt;
        var p = clamp01(t/dur);
        k.root.position.x = lerp(sx, toX, p);
        k.root.position.z = lerp(sz, -8, p);
        k.root.position.y = lerp(sy, 0, easeIn(p)) + Math.sin(p*Math.PI)*5;
        k.hips.rotation.z = Math.sin(p*Math.PI)*0.3;   // 大衣摆动感
        k.neck.rotation.x = -0.2*Math.sin(p*Math.PI);
        if(p>=1){
          k.root.position.y = 0; k.root.position.z = -8;
          k.hips.rotation.z = 0;
          setPose(k,'crouch', true);
          AudioSys.sfx.thud(); GFX.shake(2.4, 0.28);
          Sched.to(function(){
            setPose(k,'hatTip');           // 标志动作: 慢慢扶正帽檐
            AudioSys.sfx.creak();
            Sched.to(function(){
              setPose(k,'idle');
              if(done) done();
            }, 800);
          }, 420);
          return true;
        }
        return false;
      });
    }, 380);
  }
  /* 猫: 助跑扑击 (落到目标高度上) */
  function catPounce(tx, ty, done){
    var cat = chars.cat.root;
    cat.visible = true;
    var sx = cat.position.x, sy = cat.position.y;
    AudioSys.sfx.cat();
    var t=0, dur=0.62;
    animate(function(dt){
      t+=dt;
      var p = clamp01(t/dur);
      cat.position.x = lerp(sx, tx, p);
      cat.position.y = lerp(sy, ty, p) + Math.sin(p*Math.PI)*7;
      cat.rotation.y = tx>sx ? Math.PI/2 : -Math.PI/2;
      cat.rotation.z = Math.sin(p*Math.PI)*-0.3;
      chars.cat.tail.rotation.x = -0.7 + Math.sin(t*20)*0.5;
      if(p>=1){
        cat.rotation.z = 0;
        AudioSys.sfx.thud();
        if(done) done(); return true;
      }
      return false;
    });
  }
  /* 通用: 受惊小跳 */
  function startle(chr, done){
    setPose(chr,'shock');
    var t=0, by=chr.root.position.y;
    animate(function(dt){
      t+=dt;
      chr.root.position.y = by + Math.max(0, Math.sin(clamp01(t/0.3)*Math.PI))*2.4;
      if(t>0.32){ chr.root.position.y=by; if(done)done(); return true; }
      return false;
    });
  }
  /* 老盐: 拍桌 */
  function sailorSlam(done){
    var s = chars.sailor;
    setPose(s,'lean');
    Sched.to(function(){
      AudioSys.sfx.thud(); GFX.shake(1.6, 0.18);
      setPose(s,'sitBar');
      if(done) done();
    }, 380);
  }

  function catStartled(done){ // 猫惊跳逃走
    var cat = chars.cat.root;
    AudioSys.sfx.cat();
    var t=0, sx=cat.position.x, sy=cat.position.y;
    animate(function(dt){
      t+=dt;
      cat.position.x = sx - t*46;
      cat.position.y = Math.max(0.5, sy + Math.sin(Math.min(1,t*1.2)*Math.PI)*9 - t*t*7);
      cat.rotation.y = -Math.PI/2;
      chars.cat.tail.rotation.x = -0.7+Math.sin(t*22)*0.5;
      if(t>1.8){ cat.visible=false; if(done)done(); return true; }
      return false;
    });
  }

  /* 猫在场景间移动 (第二章它跟进了酒吧) */
  function catToBar(x, z){
    var cat = chars.cat.root;
    if(cat.parent) cat.parent.remove(cat);
    sceneRoots.bar.add(cat);
    cat.visible = true;
    cat.position.set(x||-60, 0.5, z||2);
    cat.rotation.set(0, Math.PI/2, 0);
  }
  function catToDock(){
    var cat = chars.cat.root;
    if(cat.parent) cat.parent.remove(cat);
    sceneRoots.dock.add(cat);
    cat.visible = true;
    cat.position.copy(chars.cat.homePos);
    cat.rotation.set(0,0,0);
  }
  /* 猫小跑到目标x (轻快的碎步) */
  function catRunTo(targetX, done){
    var cat = chars.cat.root;
    var dir = targetX > cat.position.x ? 1 : -1;
    cat.rotation.y = dir>0 ? Math.PI/2 : -Math.PI/2;
    var t=0;
    animate(function(dt){
      t+=dt;
      cat.position.x += dir*26*dt;
      cat.position.y = 0.5 + Math.abs(Math.sin(t*14))*1.4;
      chars.cat.tail.rotation.x = -0.7+Math.sin(t*18)*0.4;
      if((dir>0 && cat.position.x>=targetX)||(dir<0 && cat.position.x<=targetX)){
        cat.position.y = 0.5;
        if(done)done(); return true;
      }
      return false;
    });
  }

  /* 证物箱从海里送还岸上 */
  function revealChest(done){
    var chest = objs.chest.grp;
    chest.visible = true;
    chest.position.set(10, -8, -46);
    AudioSys.sfx.splash();
    var t=0;
    animate(function(dt){
      t+=dt;
      var p = clamp01(t/2.4);
      var e = easeInOut(p);
      chest.position.y = lerp(-8, 0, e);
      chest.position.z = lerp(-46, -12, e);
      chest.rotation.y = e*0.8;
      if(p>=1){ AudioSys.sfx.drop(); if(done)done(); return true; }
      return false;
    });
  }

  /* ---------- 灰面人开枪 ---------- */
  function killerShoot(target, done){
    setPose(chars.killer, 'aim');
    Sched.to(function(){
      AudioSys.sfx.shot();
      GFX.flash('#fff', 0.9);
      GFX.shake(4, 0.35);
      objs.flashLight.intensity = 2.2;
      Sched.to(function(){ objs.flashLight.intensity=0; }, 90);
      if(target){
        setPose(target, 'stagger');
        Sched.to(function(){ setPose(target, 'knockout'); }, 380);
      }
      if(done) Sched.to(done, 900);
    }, 650);
  }

  /* ---------- 奇观控制 ---------- */
  function wonderRise(done){
    sceneRoots.wonder.visible = true;
    wonderState = 1; wonderT = 0;
    AudioSys.sfx.wave();
    var t=0;
    animate(function(dt){
      t += dt;
      var p = clamp01(t/6);
      var e = easeInOut(p);
      objs.wave.position.y = lerp(-95, -18, e);
      objs.waveGlow.intensity = e*2.3;
      objs.foam.position.y = lerp(-60, 0, e);
      objs.beads.position.y = lerp(-40, 0, e);
      if(t>1.4 && t<5) GFX.shake(1.2, 0.1);
      if(p>=1){ wonderState=2; if(done)done(); return true; }
      return false;
    });
  }
  function wonderFall(done){
    wonderState = 3;
    AudioSys.sfx.wave();
    AudioSys.sfx.splash();
    var t=0;
    animate(function(dt){
      t += dt;
      var p = clamp01(t/3.4);
      objs.wave.position.y = lerp(-18, -100, easeIn(p));
      objs.waveGlow.intensity = (1-p)*2.3;
      objs.foam.position.y = lerp(0,-70, easeIn(p));
      objs.beads.position.y = lerp(0,-50,easeIn(p));
      if(p>0.5 && p<0.7) GFX.shake(2.4, 0.1);
      if(p>=1){
        sceneRoots.wonder.visible=false; wonderState=0;
        if(done)done(); return true;
      }
      return false;
    });
  }

  /* ============================================================
     每帧更新
     ============================================================ */
  var seaT=0;
  function update(dt){
    dt = Math.min(dt, 0.05);
    var t = performance.now()/1000;

    // 动画协程
    for(var i=animators.length-1;i>=0;i--){
      var a = animators[i];
      var fin = false;
      try{ fin = a.update(dt); }catch(e){ fin=true; }
      if(fin) animators.splice(i,1);
    }

    // 姿势
    for(var k in chars){
      var chr = chars[k];
      if(chr && chr.pose) applyPose(chr, dt);
    }

    // 雨
    if(rainOn){
      // 奇观驻立时: 雨滴悬滞在半空(时间凝固的演出)
      var rainSpeed = (wonderState>=1) ? 1.6 : 95;
      var rainDrift = (wonderState>=1) ? 0 : 6;
      for(var r=0;r<rainDrops.length;r++){
        var drop = rainDrops[r];
        drop.position.y -= dt*rainSpeed;
        drop.position.x -= dt*rainDrift;
        if(wonderState>=1){
          // 悬滞微光
          drop.position.y += Math.sin(t*0.8 + r)*dt*0.8;
        }
        if(drop.position.y<0){
          drop.position.y = 78+Math.random()*8;
          drop.position.x = rand(-170,170);
        }
      }
      // 闪电
      lightningNext -= dt;
      if(lightningNext<=0){
        lightningNext = rand(26,52);
        lightning = 0.9;
        AudioSys.sfx.thunder();
      }
      if(lightning>0){
        lightning -= dt*2.4;
        var li = Math.max(0, lightning);
        scene.background.setRGB(0.075+li*0.35, 0.063+li*0.38, 0.157+li*0.45);
      }
    }

    // 海面波动 (奇观驻立时海面凝固)
    if(curScene==='dock' && objs.sea){
      var frozen = (wonderState===2);
      if(!frozen) seaT += dt;
      var pos = objs.sea.geometry.attributes.position;
      var base = objs.seaBase;
      for(var v=0;v<pos.count;v++){
        var bx = base[v*3], by = base[v*3+1];
        pos.array[v*3+2] = base[v*3+2] +
          Math.sin(bx*0.03+seaT*1.4)*1.6 + Math.cos(by*0.05+seaT*0.9)*1.2;
      }
      pos.needsUpdate = true;
      // 灯塔光束旋转 — 绕灯室轴心扫掠
      if(objs.beamPivot){
        objs.beamPivot.rotation.y += (objs.beamFast ? 0 : 1) * 0; // 由下方统一处理
        if(!objs.beamFast) objs.beamPivot.rotation.y = t*0.5;
        objs.beam.material.opacity = Math.max(
          0.1+Math.abs(Math.sin(t*0.5))*0.08, objs.beamBoost||0);
      }
      // 渔船起伏
      if(objs.boat && wonderState!==2){
        objs.boat.grp.position.y = objs.boat.baseY + Math.sin(t*0.9)*0.8;
        if(!animatingBoat()) objs.boat.grp.rotation.z = Math.sin(t*0.7)*0.03;
      }
    }

    // 酒吧吊扇
    if(curScene==='bar' && objs.fan){
      objs.fan.blades.rotation.y += dt*objs.fan.speed;
      objs.clockPend.rotation.z = Math.sin(t*2.2)*0.18 + objs.clockPend.rotation.z*0; // 摆钟常摆
    }

    // 奇观水珠悬滞微动
    if(wonderState===2 && objs.beads){
      var kids = objs.beads.children;
      for(var b2=0;b2<kids.length;b2++){
        var bd = kids[b2];
        bd.position.y = bd.userData.baseY + Math.sin(t*0.7+bd.userData.phase)*0.5;
      }
      objs.waveGlow.intensity = 2.0+Math.sin(t*1.3)*0.4;
    }

    // 灵魂火焰摇曳
    if(chars.soul && chars.soul.root.visible){
      chars.soul.flame.scale.y = 1+Math.sin(t*7)*0.15;
      chars.soul.root.rotation.y = t*0.8;
    }

    // 相机
    camX = lerp(camX, camTargetX, Math.min(1,dt*3.2));
    camY = lerp(camY, camTargetY, Math.min(1,dt*3.2));
    camZoom = lerp(camZoom, camTargetZoom, Math.min(1,dt*2.6));
    camera.position.set(camX, camY+6, 150/camZoom);
    camera.lookAt(camX, camY-6, 0);
  }
  function animatingBoat(){ return false; }

  function render(){ renderer.render(scene, camera); }

  /* 3D坐标 → 屏幕坐标 */
  function project(v3){
    var v = v3.clone().project(camera);
    return { x:(v.x*0.5+0.5)*rw, y:(-v.y*0.5+0.5)*rh, z:v.z };
  }

  function lookAt(x, y, zoom){
    camTargetX = clamp(x, -110, 110);
    if(y!==undefined && y!==null) camTargetY = y;
    if(zoom) camTargetZoom = zoom;
  }
  function snapCam(x,y,zoom){
    lookAt(x,y,zoom);
    camX=camTargetX; camY=camTargetY; camZoom=camTargetZoom;
  }

  /* ---------- 重置(回溯用) ---------- */
  function resetDock(){
    animators = [];
    // 灯
    trickLampOn();
    // 油桶
    objs.drum.grp.position.copy(objs.drum.homePos);
    objs.drum.grp.rotation.set(0,0,0);
    // 缆绳/渔船
    objs.rope.visible = true;
    objs.boat.grp.position.set(-98,-4,-30);
    objs.boat.grp.rotation.set(0,0,0);
    // 钟
    objs.bell.bell.rotation.z=0;
    // 证物箱
    objs.chest.grp.visible=false;
    // 猫
    catToDock();
    // 角色
    chars.corpse.root.visible = true;
    chars.corpse.root.position.set(0,0.6,-6);
    setPose(chars.corpse,'lie',true);
    chars.wei.root.visible = true;
    chars.wei.root.position.set(14,0,-8);
    chars.wei.root.rotation.y=0;
    setPose(chars.wei,'kneel',true);
    chars.killer.root.visible=false;
    chars.killer.root.position.set(300,0,-10);
    chars.killer.root.rotation.y=0;
    setPose(chars.killer,'idle',true);
    chars.sailor.root.visible=false;
    chars.bartender.root.visible=false;
    chars.soul.root.visible=false;
  }
  function resetBar(){
    animators = [];
    objs.glass.grp.position.copy(objs.glass.homePos);
    objs.glass.grp.rotation.set(0,0,0);
    objs.glass.grp.visible = true;
    objs.fan.speed = 0.8;
    chars.sailor.root.visible=true;
    chars.sailor.root.position.set(20,0,-2);
    chars.sailor.root.rotation.y=0;
    setPose(chars.sailor,'sitBar',true);
    chars.bartender.root.visible=true;
    chars.bartender.root.position.set(14,0,-16);
    chars.bartender.root.rotation.y=0;
    setPose(chars.bartender,'lean',true);
    chars.killer.root.visible=false;
    chars.killer.root.position.set(300,0,-4);
    chars.killer.root.rotation.y=0;
    setPose(chars.killer,'idle',true);
    chars.wei.root.visible=false;
    chars.corpse.root.visible=false;
    chars.soul.root.visible=false;
    chars.cat.root.visible=false;
  }

  return {
    init:init, update:update, render:render,
    project:project, lookAt:lookAt, snapCam:snapCam,
    showScene:showScene, curScene:function(){return curScene;},
    objs:objs, chars:chars,
    setPose:setPose, walkTo:walkTo, stopWalk:stopWalk, tweenPos:tweenPos, animate:animate,
    emote:emote, killerLeap:killerLeap, catPounce:catPounce,
    startle:startle, sailorSlam:sailorSlam,
    trickLampFlicker:trickLampFlicker, trickLampOn:trickLampOn,
    trickBell:trickBell, trickDrumDrop:trickDrumDrop, trickWinch:trickWinch,
    trickPhoneRing:trickPhoneRing, trickJukebox:trickJukebox,
    trickFanSpin:trickFanSpin, trickFanStop:trickFanStop,
    trickGlassSlide:trickGlassSlide, trickClockChime:trickClockChime,
    catStartled:catStartled, catToBar:catToBar, catToDock:catToDock,
    catRunTo:catRunTo, revealChest:revealChest,
    killerShoot:killerShoot,
    wonderRise:wonderRise, wonderFall:wonderFall,
    wonderState:function(){return wonderState;},
    resetDock:resetDock, resetBar:resetBar
  };
})();
