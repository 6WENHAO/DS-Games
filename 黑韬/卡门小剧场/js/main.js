'use strict';
/* ============================================================
   main.js — 启动 / 主循环 / 输入
   开屏即渲染剧场实景(合拢的大幕+脚灯), 节目单浮于其上
   点击后无缝进入开演仪式
   ============================================================ */
(function(){
  var glCanvas, outCanvas;
  var lastTS = 0;
  var started = false;
  var showDone = false;

  function boot(){
    glCanvas = document.getElementById('glCanvas');
    outCanvas = document.getElementById('outCanvas');

    GFX.init(outCanvas);
    Theater.init(glCanvas);
    Sets.build();
    Sets.show('plaza');
    Sets.snapCurtain(0);
    Play.buildCast();

    /* 开演前的剧场: 场灯半明, 脚灯暖光舔着合拢的大幕 */
    Theater.shot({pos:[0,26,250], look:[0,17.5,-2], fov:28, dur:0});
    Theater.mood({amb:0.4, ambColor:'#7a6a72', hemi:0.22,
                  key:0.24, keyColor:'#c8a080', keyPos:[30,90,130],
                  rim:0.1, foot:0.55, footColor:'#ffc890'}, 0.1);
    GFX.setFade(0);

    fitStage();
    window.addEventListener('resize', fitStage);

    var bootEl = document.getElementById('boot');
    bootEl.addEventListener('click', function(){
      if(started) return;
      started = true;
      AudioSys.init();
      AudioSys.resume();
      bootEl.classList.add('gone');
      Sched.to(startShow, 900);
    });

    document.addEventListener('keydown', function(e){
      var k = e.key.toLowerCase();
      if(k==='m'){
        G.muted = !G.muted;
        AudioSys.setMuted(G.muted);
      } else if(k==='r'){
        location.reload();
      }
    });
    outCanvas.parentElement.addEventListener('click', function(){
      AudioSys.resume();
      if(showDone) location.reload();
    });

    requestAnimationFrame(loop);
  }

  /* 自适应缩放 (保持 5:3, 整数倍优先) */
  function fitStage(){
    var wrap = document.getElementById('stageWrap');
    var availW = window.innerWidth - 40;
    var availH = window.innerHeight - 40;
    var scale = Math.min(availW/800, availH/480);
    if(scale > 1){ scale = Math.floor(scale*2)/2; }
    if(scale <= 0) scale = 1;
    wrap.style.transform = 'scale('+scale+')';
    wrap.style.transformOrigin = 'center center';
  }

  function startShow(){
    Script.run(Play.fullShow(), function(){
      showDone = true;
    });
  }

  function loop(ts){
    var dt = Math.min(0.05, (ts-lastTS)/1000 || 0.016);
    lastTS = ts;

    Theater.update(dt);
    Sets.update(dt);
    Actors.applyPoses(dt);
    GFX.update(dt);

    Theater.render();
    GFX.compose(glCanvas);
    Director.draw(dt);

    requestAnimationFrame(loop);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
