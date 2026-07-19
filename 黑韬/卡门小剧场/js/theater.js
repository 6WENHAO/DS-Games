'use strict';
/* ============================================================
   theater.js — 舞台总管
   渲染器 / 电影化摄影机 / 剧场灯光组 / 动画协程 / 材质工厂
   ============================================================ */
var Theater = (function(){
  var renderer, scene, camera;
  var rw=G.RW, rh=G.RH;
  var animators=[];
  var _gradTex=null;

  /* ---------- 摄影机状态 ---------- */
  var cam = {
    pos: new THREE.Vector3(0, 25, 238),
    look: new THREE.Vector3(0, 17.5, -2),
    fov: 28,
    // 目标
    tPos: new THREE.Vector3(0, 25, 238),
    tLook: new THREE.Vector3(0, 17.5, -2),
    tFov: 28,
    dur: 0, t: 1, ease: easeInOut,
    fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3(), fromFov: 26,
    drift: 0.1,           // 观众席视角: 几乎稳定
    driftSeed: Math.random()*100
  };

  /* ---------- 灯光组 ---------- */
  var lights = {};

  function gradTex(){
    if(_gradTex) return _gradTex;
    var data = new Uint8Array([80,80,80, 168,168,168, 255,255,255]);
    _gradTex = new THREE.DataTexture(data, 3, 1, THREE.RGBFormat);
    _gradTex.minFilter=THREE.NearestFilter;
    _gradTex.magFilter=THREE.NearestFilter;
    _gradTex.needsUpdate=true;
    return _gradTex;
  }
  function mat(color, emissive){
    var m = new THREE.MeshToonMaterial({ color:new THREE.Color(color), gradientMap:gradTex() });
    if(emissive) m.emissive = new THREE.Color(emissive);
    return m;
  }
  function flat(color, opts){
    var m = new THREE.MeshBasicMaterial({ color:new THREE.Color(color) });
    if(opts) for(var k in opts) m[k]=opts[k];
    return m;
  }
  function box(w,h,d,c){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(c)); }
  function cyl(rt,rb,h,seg,c){ return new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||8), mat(c)); }
  function cone(r,h,seg,c){ return new THREE.Mesh(new THREE.ConeGeometry(r,h,seg||8), mat(c)); }
  function sph(r,c,ws,hs){ return new THREE.Mesh(new THREE.SphereGeometry(r,ws||8,hs||6), mat(c)); }
  function plane(w,h,c,opts){ return new THREE.Mesh(new THREE.PlaneGeometry(w,h), flat(c,opts)); }

  function init(canvas){
    renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:false, alpha:false });
    renderer.setPixelRatio(1);
    renderer.setSize(rw, rh, false);

    /* 剧场黑盒: 无雾, 恒定的观众席暗色 */
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0710');

    camera = new THREE.PerspectiveCamera(26, rw/rh, 1, 1200);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);

    /* ---- 克制的舞台灯光组 (平光为主, 无距离衰减色带) ---- */
    lights.amb = new THREE.AmbientLight('#8a8090', 0.72);
    scene.add(lights.amb);
    lights.hemi = new THREE.HemisphereLight('#9a90a8', '#38302e', 0.34);
    scene.add(lights.hemi);
    /* 正面顶排洗光 (方向光 = 均匀无衰减) */
    lights.key = new THREE.DirectionalLight('#ffeed0', 0.72);
    lights.key.position.set(30, 90, 130);
    scene.add(lights.key);
    /* 侧逆光 (轮廓) */
    lights.rim = new THREE.DirectionalLight('#8088c8', 0.22);
    lights.rim.position.set(-70, 50, -40);
    scene.add(lights.rim);
    /* 脚灯 (舞台前缘一排的柔和仰光, 唯一的点光) */
    lights.foot = new THREE.PointLight('#ffc890', 0.24, 190);
    lights.foot.position.set(0, 3, 40);
    scene.add(lights.foot);

    /* 追光灯 ×2 (克制强度 + 可见光柱道具) */
    function makeSpot(color){
      var sp = new THREE.SpotLight(color, 0, 300, 0.3, 0.7, 1.0);
      sp.position.set(0, 105, 95);
      var tgt = new THREE.Object3D();
      scene.add(tgt);
      sp.target = tgt;
      scene.add(sp);
      /* 可见光柱 (细长半透明锥, 从台口顶垂到台面) */
      var beamLen = 78;
      var beamGeo = new THREE.CylinderGeometry(1.6, 8.5, beamLen, 10, 1, true);
      beamGeo.translate(0, -beamLen/2, 0);
      var beamMat = flat(color, {transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide});
      var beam = new THREE.Mesh(beamGeo, beamMat);
      scene.add(beam);
      /* 台面光池 */
      var pool = new THREE.Mesh(new THREE.CircleGeometry(8.5, 14),
        flat(color, {transparent:true, opacity:0, depthWrite:false}));
      pool.rotation.x = -Math.PI/2;
      scene.add(pool);
      return { light:sp, target:tgt, follow:null, ty:0,
               beam:beam, pool:pool, beamA:0, beamTarget:0 };
    }
    lights.spotA = makeSpot('#ffeecc');
    lights.spotB = makeSpot('#ffd8e0');
  }

  /* ============================================================
     摄影机 DSL
     shot({pos, look, fov, dur, ease, cut}) — dur=0 直切
     ============================================================ */
  function shot(o){
    if(o.pos){ cam.fromPos.copy(cam.pos); cam.tPos.set(o.pos[0],o.pos[1],o.pos[2]); }
    else { cam.fromPos.copy(cam.pos); cam.tPos.copy(cam.pos); }
    if(o.look){ cam.fromLook.copy(cam.look); cam.tLook.set(o.look[0],o.look[1],o.look[2]); }
    else { cam.fromLook.copy(cam.look); cam.tLook.copy(cam.look); }
    cam.fromFov = cam.fov;
    cam.tFov = o.fov || cam.fov;
    cam.dur = o.dur||0;
    cam.ease = o.ease==='linear' ? function(x){return x;}
             : o.ease==='in' ? easeIn
             : o.ease==='out' ? easeOut : easeInOut;
    if(!cam.dur){
      cam.pos.copy(cam.tPos); cam.look.copy(cam.tLook); cam.fov=cam.tFov;
      cam.t=1;
    } else cam.t=0;
    if(o.drift!==undefined) cam.drift = o.drift;
  }

  /* ============================================================
     灯光 DSL
     ============================================================ */
  function tweenLight(light, prop, to, dur){
    var from = light[prop];
    if(prop==='color'){
      var fc = light.color.clone(), tc = new THREE.Color(to);
      var t=0;
      animate(function(dt){
        t += dt/(dur||1);
        if(t>=1){ light.color.copy(tc); return true; }
        light.color.copy(fc).lerp(tc, easeInOut(t));
        return false;
      });
    } else {
      var t2=0, f=from;
      animate(function(dt){
        t2 += dt/(dur||1);
        if(t2>=1){ light[prop]=to; return true; }
        light[prop] = lerp(f, to, easeInOut(t2));
        return false;
      });
    }
  }
  /* 环境预设: 一次调度多个灯 */
  function mood(o, dur){
    dur = dur||1.5;
    if(o.amb!==undefined) tweenLight(lights.amb,'intensity',o.amb,dur);
    if(o.ambColor) tweenLight(lights.amb,'color',o.ambColor,dur);
    if(o.hemi!==undefined) tweenLight(lights.hemi,'intensity',o.hemi,dur);
    if(o.key!==undefined) tweenLight(lights.key,'intensity',o.key,dur);
    if(o.keyColor) tweenLight(lights.key,'color',o.keyColor,dur);
    if(o.rim!==undefined) tweenLight(lights.rim,'intensity',o.rim,dur);
    if(o.rimColor) tweenLight(lights.rim,'color',o.rimColor,dur);
    if(o.foot!==undefined) tweenLight(lights.foot,'intensity',o.foot,dur);
    if(o.footColor) tweenLight(lights.foot,'color',o.footColor,dur);
    if(o.keyPos) lights.key.position.set(o.keyPos[0],o.keyPos[1],o.keyPos[2]);
  }

  /* 追光: spot('A', {follow, color, intensity, angle, beam}) */
  function spot(which, o){
    var s = which==='B' ? lights.spotB : lights.spotA;
    if(o.follow!==undefined) s.follow = o.follow;
    if(o.pos) s.light.position.set(o.pos[0],o.pos[1],o.pos[2]);
    if(o.color){
      tweenLight(s.light,'color',o.color, o.dur||0.8);
      s.beam.material.color.set(o.color);
      s.pool.material.color.set(o.color);
    }
    if(o.intensity!==undefined){
      tweenLight(s.light,'intensity',o.intensity, o.dur||0.8);
      /* 光柱可见度默认随灯 (除非显式关) */
      s.beamTarget = (o.beam===false) ? 0 : Math.min(0.16, o.intensity*0.13);
    }
    if(o.angle!==undefined) s.light.angle = o.angle;
    if(o.penumbra!==undefined) s.light.penumbra = o.penumbra;
    if(o.at) s.target.position.set(o.at[0],o.at[1],o.at[2]);
    if(o.ty!==undefined) s.ty = o.ty;
  }

  /* ============================================================
     动画协程
     ============================================================ */
  function animate(fn){ animators.push({update:fn}); }
  function clearAnimators(){ animators=[]; }

  function tweenPos(obj, to, dur, ease, done){
    var from = obj.position.clone();
    var tv = (to instanceof THREE.Vector3) ? to : new THREE.Vector3(to[0],to[1],to[2]);
    var t=0;
    animate(function(dt){
      t += dt/dur;
      if(t>=1){ obj.position.copy(tv); if(done)done(); return true; }
      obj.position.lerpVectors(from, tv, (ease||easeInOut)(t));
      return false;
    });
  }
  function tweenRot(obj, to, dur, done){
    var from = {x:obj.rotation.x, y:obj.rotation.y, z:obj.rotation.z};
    var t=0;
    animate(function(dt){
      t += dt/dur;
      if(t>=1){
        obj.rotation.set(to[0],to[1],to[2]);
        if(done)done(); return true;
      }
      var e = easeInOut(t);
      obj.rotation.set(lerp(from.x,to[0],e), lerp(from.y,to[1],e), lerp(from.z,to[2],e));
      return false;
    });
  }

  /* ============================================================
     帧更新
     ============================================================ */
  function update(dt){
    dt = Math.min(dt, 0.05);
    var t = performance.now()/1000;

    for(var i=animators.length-1;i>=0;i--){
      var fin=false;
      try{ fin = animators[i].update(dt); }catch(e){ console.error('[anim]',e); fin=true; }
      if(fin) animators.splice(i,1);
    }

    // 摄影机插值
    if(cam.t<1){
      cam.t = Math.min(1, cam.t + dt/cam.dur);
      var e = cam.ease(cam.t);
      cam.pos.lerpVectors(cam.fromPos, cam.tPos, e);
      cam.look.lerpVectors(cam.fromLook, cam.tLook, e);
      cam.fov = lerp(cam.fromFov, cam.tFov, e);
    }
    // 手持呼吸
    var ds = cam.driftSeed;
    var dx = Math.sin(t*0.42+ds)*cam.drift + Math.sin(t*0.9+ds*2)*cam.drift*0.4;
    var dy = Math.cos(t*0.36+ds)*cam.drift*0.6;
    camera.position.set(cam.pos.x+dx, cam.pos.y+dy, cam.pos.z);
    camera.lookAt(cam.look.x+dx*0.4, cam.look.y+dy*0.4, cam.look.z);
    if(Math.abs(camera.fov-cam.fov)>0.01){
      camera.fov = cam.fov; camera.updateProjectionMatrix();
    }

    // 追光跟随 + 可见光柱
    [lights.spotA, lights.spotB].forEach(function(s){
      var tp = s.target.position;
      if(s.follow && s.follow.root){
        var p = s.follow.root.position;
        tp.set(p.x, p.y + (s.ty||9), p.z);
        s.light.position.set(p.x*0.4, 105, 95);
      }
      /* 光柱透明度渐变 */
      s.beamA = lerp(s.beamA, s.beamTarget, Math.min(1, dt*3));
      var vis = s.beamA > 0.004;
      s.beam.visible = vis;
      s.pool.visible = vis;
      if(vis){
        s.beam.material.opacity = s.beamA;
        s.pool.material.opacity = s.beamA*1.15;
        /* 锚点: 台口上方, 锥体指向目标脚下 */
        var ax = tp.x*0.35, ay = 55, az = 8;
        s.beam.position.set(ax, ay, az);
        var dir = new THREE.Vector3(tp.x-ax, 1.5-ay, (tp.z-2)-az).normalize();
        s.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0), dir);
        s.pool.position.set(tp.x, 0.25, tp.z-2);
      }
    });
  }

  function render(){ renderer.render(scene, camera); }

  function project(v3){
    var v = v3.clone().project(camera);
    return { x:(v.x*0.5+0.5)*rw, y:(-v.y*0.5+0.5)*rh, z:v.z };
  }

  return {
    init:init, update:update, render:render, project:project,
    scene:function(){return scene;},
    camera:function(){return camera;},
    lights:lights,
    shot:shot, mood:mood, spot:spot,
    animate:animate, clearAnimators:clearAnimators,
    tweenPos:tweenPos, tweenRot:tweenRot,
    mat:mat, flat:flat, box:box, cyl:cyl, cone:cone, sph:sph, plane:plane,
    gradTex:gradTex
  };
})();
