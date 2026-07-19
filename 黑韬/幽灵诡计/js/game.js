'use strict';
/* ============================================================
   game.js — 状态机与玩法核心
   幽灵界跳跃 / 附身 / 诡计 / 死亡时间窗 / 命运回溯
   ============================================================ */
var Game = (function(){
  var state = 'title';   // title | card | play | window | fail | rewind | end
  var topCtx = null;
  var glCanvas = null;
  var lastTS = 0;

  var ghost = false;
  var ghostAllowed = false;
  var soulAt = 'corpse';
  var REACH = 46;

  var win = null;
  var travelFx = null;
  var waitTravelReq = null;
  var hint = '';
  var toast = '', toastT = 0;
  var fate = null;
  var card = null;
  var titleT = 0;

  /* ============ 核心 (附身点) ============ */
  var CORES = {
    dock: [
      { id:'corpse',    name:'尸体',     x:0,   y:6,  z:-6 },
      { id:'craneLamp', name:'吊灯',     x:-6,  y:22, z:-16 },
      { id:'crate',     name:'木箱',     x:-38, y:8,  z:-10 },
      { id:'bollard',   name:'系缆桩',   x:-64, y:5,  z:-4 },
      { id:'mastLamp',  name:'桅灯',     x:-94, y:17, z:-30 },
      { id:'winch',     name:'起锚机',   x:-90, y:11, z:-30 },
      { id:'phoneA',    name:'电话亭',   x:22,  y:10, z:-8 },
      { id:'drum',      name:'油桶',     x:55,  y:26, z:-14 },
      { id:'bell',      name:'铜钟',     x:88,  y:8,  z:-4 },
      { id:'platform',  name:'检修台',   x:94,  y:27, z:-20 },
      { id:'beacon',    name:'灯室',     x:105, y:60, z:-18 }
    ],
    bar: [
      { id:'glass',     name:'酒杯',     x:18,  y:12, z:-1 },
      { id:'barLamp',   name:'吊灯',     x:0,   y:35, z:-2 },
      { id:'barLamp2',  name:'吊灯',     x:40,  y:35, z:-2 },
      { id:'fan',       name:'吊扇',     x:-14, y:40, z:-2 },
      { id:'wheel',     name:'舵轮',     x:-30, y:22, z:-18 },
      { id:'jukebox',   name:'点唱机',   x:-52, y:10, z:-8 },
      { id:'barClock',  name:'老座钟',   x:60,  y:14, z:-16 }
    ]
  };
  function coreList(){ return CORES[World.curScene()] || CORES.dock; }
  function coreById(id){
    var l = coreList();
    for(var i=0;i<l.length;i++) if(l[i].id===id) return l[i];
    return null;
  }
  function corePos(c){ return new THREE.Vector3(c.x, c.y, c.z); }
  function coreReachable(c){
    if(c.id===soulAt) return false;
    var s = coreById(soulAt);
    if(!s) return false;
    var dx=c.x-s.x, dy=c.y-s.y, dz=c.z-s.z;
    return Math.sqrt(dx*dx+dy*dy+dz*dz) <= REACH;
  }

  /* ============ 初始化 ============ */
  function init(glc, topCanvas, botCanvas){
    glCanvas = glc;
    GFX.init(topCanvas);
    topCtx = GFX.ctx();
    UI.init(botCanvas);
    World.init(glCanvas);
    state = 'title';
    AudioSys.playMusic('grey');
  }

  /* ============ 幽灵切换 ============ */
  function camFollow(c){
    if(!c) return;
    // 奇观在场时: 保持广角构图, 灵魂跳到哪都能看见浪墙全貌
    if(World.curScene()==='dock' && World.wonderState() >= 1){
      var cx = clamp(c.x*0.45 + 12, -36, 66);
      World.lookAt(cx, 34, 0.55);
      return;
    }
    World.lookAt(c.x, clamp(c.y+4, 16, 58), ghost?0.82:1);
  }
  function goGhost(on){
    if(ghost===on) return;
    ghost = on;
    AudioSys.setGhostAudio(on);
    GFX.setMode(on?'ghost':'normal');
    AudioSys.sfx.possess();
    camFollow(coreById(soulAt));
  }
  function setSoul(id){
    soulAt = id;
    camFollow(coreById(id));
  }
  function travelTo(id){
    var from = coreById(soulAt), to = coreById(id);
    if(!from || !to) return;
    AudioSys.sfx.travel();
    // 时长随三维距离缩放 — 近核心轻轻一跃, 远核心长途飞行
    var d3 = corePos(from).distanceTo(corePos(to));
    travelFx = { fromId:from.id, toId:to.id, t:0,
                 dur: clamp(0.2 + d3/130, 0.28, 1.05) };
    setSoul(id);
    if(waitTravelReq && waitTravelReq.core===id){
      var next = waitTravelReq.next;
      waitTravelReq = null;
      Sched.to(next, 600);
    }
  }

  /* 灵魂飞行路径: 依据两点连线的法线方向拱起, 拱高随距离 */
  function travelPoint(s, fp, tp){
    var mx=(fp.x+tp.x)/2, my=(fp.y+tp.y)/2;
    var dx=tp.x-fp.x, dy=tp.y-fp.y;
    var len=Math.hypot(dx,dy)||1;
    var nx=-dy/len, ny=dx/len;
    if(ny>0){ nx=-nx; ny=-ny; }        // 拱向屏幕上方
    var arc = Math.min(20, len*0.2);
    var cx=mx+nx*arc, cy=my+ny*arc;
    var u=1-s;
    return { x:u*u*fp.x + 2*u*s*cx + s*s*tp.x,
             y:u*u*fp.y + 2*u*s*cy + s*s*tp.y };
  }
  function travelEndpoints(){
    var f = coreById(travelFx.fromId), t2 = coreById(travelFx.toId);
    if(!f || !t2) return null;
    return { fp:World.project(corePos(f)), tp:World.project(corePos(t2)) };
  }
  /* 火焰彗星: 头部亮焰 + 逐渐缩小的残影 + 飘散火星 */
  function drawSoulComet(ctx, et, ep, time){
    var head = travelPoint(et, ep.fp, ep.tp);
    // 残影 (沿路径向后取样)
    for(var i=7;i>=1;i--){
      var s = et - i*0.045;
      if(s<=0) continue;
      var p = travelPoint(s, ep.fp, ep.tp);
      var r = 4.6*(1-i/8.5);
      var a = 0.45*(1-i/8);
      ctx.fillStyle='rgba(120,190,255,'+a+')';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
    }
    // 火星
    for(var k=0;k<3;k++){
      var ss = et - rand(0.02,0.14);
      if(ss<=0) continue;
      var sp = travelPoint(ss, ep.fp, ep.tp);
      ctx.fillStyle='rgba(200,230,255,'+rand(0.3,0.7)+')';
      ctx.fillRect(sp.x+rand(-4,4), sp.y+rand(-4,4), 1.5, 1.5);
    }
    // 头部: 拉长的焰体朝向运动方向
    var ahead = travelPoint(Math.min(1, et+0.03), ep.fp, ep.tp);
    var ang = Math.atan2(ahead.y-head.y, ahead.x-head.x);
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(ang + Math.PI/2);
    var g = ctx.createRadialGradient(0,0,1,0,0,10);
    g.addColorStop(0,'rgba(235,248,255,0.95)');
    g.addColorStop(0.45,'rgba(140,205,255,0.55)');
    g.addColorStop(1,'rgba(60,110,220,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#bfe4ff';
    ctx.beginPath();
    ctx.moveTo(0,-9);                          // 焰尾拖向后方
    ctx.quadraticCurveTo(4.2, -1, 2.4, 3.6);
    ctx.quadraticCurveTo(0, 5.6, -2.4, 3.6);
    ctx.quadraticCurveTo(-4.2, -1, 0, -9);
    ctx.fill();
    ctx.fillStyle='#f2faff';
    ctx.beginPath(); ctx.ellipse(0, 1.2, 2.4, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  /* ============ 时间窗 ============ */
  /* opts: {time, startCore, setup(), tricks:[{core,label,hint,anim(done)}],
            success: fn -> steps[], fail(next)} */
  function ghostWindow(opts){
    return function(next){
      win = { o:opts, step:0, sec:opts.time||0, animating:false, next:next };
      if(opts.setup) opts.setup();
      setSoul(opts.startCore||'corpse');
      ghost = false; GFX.setMode('normal'); AudioSys.setGhostAudio(false);
      ghostAllowed = true;
      state = 'window';
      updateHint();
      if(opts.time){
        AudioSys.playMusic('tense');
        AudioSys.sfx.sting();   // 危机开场重音
      }
    };
  }
  function curTrick(){
    if(!win) return null;
    return win.o.tricks[win.step] || null;
  }
  function updateHint(){
    var t = curTrick();
    hint = t ? t.hint : '';
  }
  function canTrick(){
    if(state!=='window' || ghost || !win || win.animating) return false;
    if(Dialog.isActive()) return false;
    var t = curTrick();
    return !!(t && t.core===soulAt);
  }
  function doTrick(){
    if(!canTrick()) return;
    var t = curTrick();
    win.animating = true;
    hint = '';
    AudioSys.sfx.trick();
    t.anim(function(){
      if(!win) return;
      win.animating = false;
      win.step++;
      if(win.step >= win.o.tricks.length){
        var w = win; win = null;
        state = 'play';
        ghostAllowed = false;
        showFate('命运改变！','#8fd8ff');
        AudioSys.sfx.win();
        var steps = w.o.success ? w.o.success() : [];
        Sched.to(function(){ Script.run(steps, w.next); }, 900);
      } else {
        updateHint();
        AudioSys.sfx.checkPass();
      }
    });
  }

  function failWindow(){
    if(!win || state!=='window') return;
    state = 'fail';
    hint = '';
    G.deathCount++;
    var w = win;
    var doFail = w.o.fail || function(next){ next(); };
    doFail(function(){
      showFate('命运无法改变…','#ff5a5a');
      AudioSys.sfx.dead();
      Sched.to(function(){ startRewind(w); }, 1600);
    });
  }
  function startRewind(w){
    state = 'rewind';
    GFX.setMode('rewind');
    AudioSys.stopMusic();
    AudioSys.sfx.rewind();
    Sched.to(function(){
      GFX.setMode('normal');
      if(w.o.setup) w.o.setup();
      setSoul(w.o.startCore||'corpse');
      win = { o:w.o, step:0, sec:w.o.time||0, animating:false, next:w.next };
      ghost=false; AudioSys.setGhostAudio(false);
      state = 'window';
      updateHint();
      if(w.o.time) AudioSys.playMusic('tense');
      showToast('回到死亡之前 — 再试一次');
    }, 2300);
  }

  function ghostShut(){
    win = null; ghostAllowed = false;
    ghost = false; GFX.setMode('normal'); AudioSys.setGhostAudio(false);
  }

  /* ============ 剧情辅助 ============ */
  function showCardStep(title, sub){
    return function(next){
      state = 'card';
      card = { title:title, sub:sub||'', t:0, next:next };
    };
  }
  function waitTravel(coreId){
    return function(next){
      waitTravelReq = { core:coreId, next:next };
    };
  }
  function setGhostAllowed(v){ ghostAllowed = v; }
  function showFate(text,color){ fate={text:text,color:color,t:0}; AudioSys.sfx.fate(); }
  function showToast(t){ toast=t; toastT=0; }

  /* ============ 章节流转 ============ */
  function startChapter(key){
    var ch = Story.CHAPTERS[key];
    if(!ch) return;
    G.chapter = key;
    state = 'play';
    Script.run(ch.fn(), function(){
      var order = {0:1, 1:2, 2:3};
      if(order[key]!==undefined) startChapter(order[key]);
    });
  }
  function startGame(){
    Script.abort(); Sched.clearAll();
    G.deathCount=0; G.flags={}; G.ending=null;
    ghostShut();
    startChapter(0);
  }
  function cmdEnding(id){
    Script.abort(); Sched.clearAll();
    ghostShut();
    state='play';
    Script.run(Story.CHAPTERS[id].fn(), function(){});
  }
  function showEnd(){
    state = 'end';
    AudioSys.playMusic('requiem');
  }

  /* ============ 输入 ============ */
  function onBottomClick(x, y){
    AudioSys.resume();
    if(state==='title'){ AudioSys.sfx.click(); startGame(); return; }
    if(state==='end'){ location.reload(); return; }
    if(state==='card' || state==='rewind' || state==='fail') return;
    if(Dialog.isActive()){ Dialog.tap(x,y); return; }

    // 幽灵按钮
    if(x>=G.RW-52 && x<=G.RW-8 && y>=G.RH-40 && y<=G.RH-8){
      if(ghostAllowed) goGhost(!ghost);
      else AudioSys.sfx.denied();
      return;
    }
    // 诡计按钮
    if(canTrick() && x>=G.RW/2-44 && x<=G.RW/2+44 && y>=G.RH-40 && y<=G.RH-8){
      doTrick(); return;
    }
    // 幽灵界: 点核心跳跃
    if(ghost){
      var l = coreList();
      for(var i=0;i<l.length;i++){
        var c=l[i];
        if(!coreReachable(c)) continue;
        var p = World.project(corePos(c));
        if(Math.hypot(x-p.x, y-p.y) < 14){ travelTo(c.id); return; }
      }
    }
  }
  function onTopClick(x, y){
    AudioSys.resume();
    if(state==='title'){ startGame(); return; }
    if(state==='end'){ location.reload(); return; }
    if(Dialog.isActive()){ Dialog.tap(-1,-1); return; }
  }
  function onKey(k){
    AudioSys.resume();
    if(state==='title'){ startGame(); return; }
    if(state==='end'){ location.reload(); return; }
    if(k==='ghost'){ if(ghostAllowed && !Dialog.isActive()) goGhost(!ghost); }
    else if(k==='trick'){ doTrick(); }
    else if(k==='advance'){ if(Dialog.isActive()) Dialog.tap(-1,-1); }
    else if(typeof k==='number'){ Dialog.key(k); }
  }

  /* ============ 帧更新 ============ */
  function frameUpdate(ts){
    var dt = Math.min(0.05, (ts-lastTS)/1000 || 0.016);
    lastTS = ts;
    titleT += dt;

    Dialog.update(dt);
    GFX.update(dt);
    World.update(dt);

    if(state==='window' && win && win.o.time && !ghost && !win.animating && !Dialog.isActive()){
      win.sec -= dt;
      // 最后6秒: 心跳
      if(win.sec<=6 && win.sec>0 &&
         Math.floor(win.sec)!==Math.floor(win.sec+dt)) AudioSys.sfx.heart();
      if(win.sec<=0){ win.sec=0; failWindow(); }
    }
    if(state==='card' && card){
      card.t += dt;
      if(card.t>2.8){
        var n = card.next; card=null; state='play';
        if(n) n();
      }
    }
    if(fate){ fate.t+=dt; if(fate.t>2.6) fate=null; }
    if(toast){ toastT+=dt; if(toastT>2.6) toast=''; }
    if(travelFx){
      travelFx.t += dt/travelFx.dur;
      if(travelFx.t>=1) travelFx=null;
    }

    render();
  }

  /* ============ 渲染 ============ */
  function render(){
    World.render();
    GFX.compose(glCanvas);
    drawTopOverlay();

    if(state==='title'){ UI.drawTitle(titleT); return; }
    if(state==='end'){
      UI.drawEnd(titleT, {deaths:G.deathCount, ending:G.ending});
      return;
    }
    if(state==='card' && card){
      var a = card.t<0.5 ? card.t/0.5 : (card.t>2.3 ? (2.8-card.t)/0.5 : 1);
      UI.drawCard(card.title, card.sub, titleT, clamp01(a));
      return;
    }

    var coresView = null;
    if(ghost){
      coresView = [];
      var l = coreList();
      for(var c=0;c<l.length;c++){
        var core=l[c];
        var p = World.project(corePos(core));
        if(p.x<-20||p.x>G.RW+20) continue;
        coresView.push({ id:core.id, name:core.name,
          sx:clamp(p.x,10,G.RW-10), sy:clamp(p.y,28,G.RH-52),
          reachable: coreReachable(core) });
      }
    }
    UI.drawHud({
      ghostOn: ghost,
      cores: coresView,
      soulAt: soulAt,
      canTrick: canTrick(),
      trickName: curTrick() ? curTrick().label : '',
      timer: (state==='window' && win && win.o.time) ? win.sec : null,
      timerMax: (win && win.o.time) || 1,
      hint: (!Dialog.isActive()) ? (hint || (toast||null)) : null
    }, titleT);

    // 灵魂彗星 (底屏幽灵界)
    if(travelFx && ghost){
      var ep = travelEndpoints();
      if(ep) drawSoulComet(UI.ctx(), easeInOut(clamp01(travelFx.t)), ep, titleT);
    }

    Dialog.draw(UI.ctx());
  }

  function drawTopOverlay(){
    var t = performance.now()/1000;
    var ctx = topCtx;

    if(state==='title'){
      ctx.fillStyle='rgba(4,6,16,0.35)';
      ctx.fillRect(0,0,G.RW,G.RH);
      txtOutline(ctx,'灰港 · 七号码头', G.RW/2, G.RH-24, 10, '#c8b890','#100a04','center');
      return;
    }
    if(state==='card' && card){
      ctx.fillStyle='#04050c'; ctx.fillRect(0,0,G.RW,G.RH);
      var a = card.t<0.5 ? card.t/0.5 : (card.t>2.3 ? (2.8-card.t)/0.5 : 1);
      ctx.globalAlpha = clamp01(a);
      txtOutline(ctx, card.title, G.RW/2, G.RH/2-18, 16, '#f2e2c0','#241505','center', true);
      txt(ctx, card.sub, G.RW/2, G.RH/2+6, 9, '#8a7ba4','center');
      ctx.globalAlpha=1;
      return;
    }

    // 灵魂火苗(附身核心位置; 跳跃时沿轨迹飞行)
    if(state==='window' || state==='play'){
      if(travelFx){
        var ep2 = travelEndpoints();
        if(ep2){
          var hp = travelPoint(easeInOut(clamp01(travelFx.t)), ep2.fp, ep2.tp);
          drawWisp(ctx, hp.x, hp.y-4, t);
        }
      } else {
        var c = coreById(soulAt);
        if(c && !Dialog.isActive()){
          var p = World.project(corePos(c));
          if(p.x>-10 && p.x<G.RW+10 && p.y>-10 && p.y<G.RH+10){
            drawWisp(ctx, p.x, p.y-6, t);
          }
        }
      }
    }
    // 命运横幅
    if(fate){
      var fa = fate.t<0.3 ? fate.t/0.3 : (fate.t>2.1?(2.6-fate.t)/0.5:1);
      ctx.globalAlpha = clamp01(fa);
      ctx.fillStyle='rgba(2,4,10,0.78)';
      ctx.fillRect(0, G.RH/2-18, G.RW, 36);
      ctx.fillStyle=fate.color;
      ctx.fillRect(0, G.RH/2-18, G.RW, 2);
      ctx.fillRect(0, G.RH/2+16, G.RW, 2);
      txtOutline(ctx, fate.text, G.RW/2, G.RH/2-9, 15, fate.color, '#0a0510', 'center', true);
      ctx.globalAlpha=1;
    }
    // 窗口计时红边警示
    if(state==='window' && win && win.o.time && win.sec<6){
      var wa = 0.25+Math.sin(t*8)*0.2;
      ctx.strokeStyle='rgba(255,60,60,'+wa+')';
      ctx.lineWidth=3;
      ctx.strokeRect(1.5,1.5,G.RW-3,G.RH-3);
    }
  }

  function drawWisp(ctx, x, y, t){
    var bob = Math.sin(t*4)*1.6;
    y += bob;
    var g = ctx.createRadialGradient(x,y,1,x,y,11);
    g.addColorStop(0,'rgba(235,248,255,0.95)');
    g.addColorStop(0.4,'rgba(130,200,255,0.5)');
    g.addColorStop(1,'rgba(60,110,220,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#a8e0ff';
    ctx.beginPath();
    ctx.moveTo(x, y-8);
    ctx.quadraticCurveTo(x+4+Math.sin(t*6)*1.5, y-1, x+2, y+3);
    ctx.quadraticCurveTo(x, y+5, x-2, y+3);
    ctx.quadraticCurveTo(x-4-Math.sin(t*6)*1.5, y-1, x, y-8);
    ctx.fill();
    ctx.fillStyle='#eef8ff';
    ctx.beginPath(); ctx.ellipse(x, y, 2, 3.4, 0, 0, Math.PI*2); ctx.fill();
  }

  return {
    init:init, frameUpdate:frameUpdate,
    onBottomClick:onBottomClick, onTopClick:onTopClick, onKey:onKey,
    startGame:startGame, startChapter:startChapter,
    ghostWindow:ghostWindow, ghostShut:ghostShut,
    goGhost:goGhost, setSoul:setSoul, setGhostAllowed:setGhostAllowed,
    waitTravel:waitTravel, showCardStep:showCardStep,
    showFate:showFate, showToast:showToast,
    cmdEnding:cmdEnding, showEnd:showEnd,
    isGhost:function(){return ghost;}
  };
})();
