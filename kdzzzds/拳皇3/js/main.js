(function(){
'use strict';
var KOF = window.KOF;
var W=480, H=270;

var Game = {
  scene: null,
  arcade: null,
  set: function(scene, args){
    this.scene = scene;
    if(scene.enter) scene.enter(args||{});
  }
};
KOF.Game = Game;

var canvas, ctx;
var booted = false;
var loadT = 0;
var loadPhase = 0;

function fitCanvas(){
  var ww = window.innerWidth, wh = window.innerHeight;
  var scale = Math.max(1, Math.floor(Math.min(ww/W, wh/H)));
  if(ww/W < 1 || wh/H < 1) scale = Math.min(ww/W, wh/H);
  var cw = Math.round(W*scale), chh = Math.round(H*scale);
  canvas.style.width = cw+'px';
  canvas.style.height = chh+'px';
  var sl = document.getElementById('scanlines');
  if(sl){
    sl.style.width = cw+'px';
    sl.style.height = chh+'px';
    sl.style.left = Math.round((ww-cw)/2)+'px';
    sl.style.top = Math.round((wh-chh)/2)+'px';
  }
}

function preloadAll(){
  KOF.Effects.preload();
  KOF.Stages.preloadAll();
  var ids = KOF.Characters.ROSTER.concat(['shenwei']);
  for(var i=0;i<ids.length;i++){
    var ch = KOF.Characters.get(ids[i]);
    KOF.Puppet.preload(ch, 0);
    KOF.Puppet.preload(ch, 1);
  }
}

var SceneLoading = {
  enter: function(){ this.t=0; },
  update: function(){
    this.t++;
    if(this.t===2) preloadAll();
    if(this.t>10 && !KOF.SVG.busy()){
      this.stable = (this.stable||0)+1;
      if(this.stable>12) Game.set(KOF.Scenes.Title, {});
    } else this.stable = 0;
  },
  draw: function(ctx){
    ctx.fillStyle='#08080e'; ctx.fillRect(0,0,W,H);
    KOF.Font.draw(ctx, 'FIGHTING SOUL 97', 240, 90, {scale:2, color:'#ffd23c', outline:'#602', align:'center'});
    KOF.Font.drawCJK(ctx, '正在生成 SVG 像素素材...', 240, 130, {size:11, color:'#c8c8e0', align:'center'});
    var dots = Math.floor(this.t/12)%4;
    var barw = 200;
    ctx.strokeStyle = '#404060';
    ctx.strokeRect(140.5, 160.5, barw, 10);
    ctx.fillStyle = '#3878e0';
    var prog = Math.min(1, this.t/120);
    if(!KOF.SVG.busy() && this.t>10) prog = 1;
    ctx.fillRect(142, 162, Math.round((barw-4)*prog), 7);
    KOF.Font.drawCJK(ctx, '首次加载约需数秒'+'.'.repeat(dots), 240, 185, {size:9, color:'#707090', align:'center'});
  }
};

var last = 0, acc = 0;
var STEP = 1000/60;
function loop(ts){
  requestAnimationFrame(loop);
  if(!last) last = ts;
  var dt = Math.min(100, ts-last);
  last = ts;
  acc += dt;
  var steps = 0;
  while(acc >= STEP && steps < 4){
    acc -= STEP;
    steps++;
    KOF.Input.update();
    if(Game.scene && Game.scene.update) Game.scene.update();
  }
  if(steps===4) acc = 0;
  if(Game.scene && Game.scene.draw){
    ctx.imageSmoothingEnabled = false;
    Game.scene.draw(ctx);
  }
}

function boot(){
  if(booted) return;
  booted = true;
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('keydown', function once(){
    KOF.Audio.init(); KOF.Audio.resume();
  });
  window.addEventListener('mousedown', function(){ KOF.Audio.init(); KOF.Audio.resume(); });
  Game.set(SceneLoading, {});
  requestAnimationFrame(loop);
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

KOF.Main = { boot:boot, SceneLoading:SceneLoading,
  // test hook: run one logic frame + draw
  step: function(){
    KOF.Input.update();
    if(Game.scene && Game.scene.update) Game.scene.update();
    if(Game.scene && Game.scene.draw && ctx) Game.scene.draw(ctx);
  },
  getCtx: function(){ return ctx; } };
})();
