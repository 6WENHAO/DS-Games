'use strict';
/* ============================================================
   core.js — 全局 / 工具 / 调度器 / 脚本引擎
   逻辑分辨率 400x240 (宽幅NDS质感), 输出 2x = 800x480
   ============================================================ */

var G = {
  RW: 400, RH: 240,
  muted: false
};

/* ---------- math ---------- */
function clamp(v,l,h){ return v<l?l:(v>h?h:v); }
function clamp01(v){ return v<0?0:(v>1?1:v); }
function lerp(a,b,t){ return a+(b-a)*t; }
function easeOut(t){ return 1-(1-t)*(1-t); }
function easeIn(t){ return t*t; }
function easeInOut(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function easeOutBack(t){ var c=1.70158; return 1+ (c+1)*Math.pow(t-1,3) + c*Math.pow(t-1,2); }
function rand(a,b){ return a + Math.random()*(b-a); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

/* ---------- 调度器 ---------- */
var Sched = (function(){
  var timeouts=[], intervals=[];
  return {
    to: function(fn, ms){
      var id = setTimeout(function(){
        var i=timeouts.indexOf(id); if(i>=0)timeouts.splice(i,1);
        fn();
      }, ms);
      timeouts.push(id); return id;
    },
    iv: function(fn, ms){ var id=setInterval(fn,ms); intervals.push(id); return id; },
    clearIv: function(id){ clearInterval(id); var i=intervals.indexOf(id); if(i>=0)intervals.splice(i,1); },
    clearAll: function(){
      for(var i=0;i<timeouts.length;i++) clearTimeout(timeouts[i]);
      for(var j=0;j<intervals.length;j++) clearInterval(intervals[j]);
      timeouts=[]; intervals=[];
    }
  };
})();

/* ---------- 脚本引擎 ----------
   step = function(next){ ... next(); } */
var Script = {
  gen: 0,
  abort: function(){ Script.gen++; },
  run: function(steps, done){
    if(!steps || !steps.length){ if(done) done(); return; }
    var myGen = Script.gen, i = 0;
    function next(){
      if(myGen !== Script.gen) return;
      if(i >= steps.length){ if(done) done(); return; }
      var s = steps[i++];
      try{ s(next); }catch(e){ console.error('[script]',e); next(); }
    }
    next();
  }
};
function seq(){ var steps=Array.prototype.slice.call(arguments);
  return function(next){ Script.run(steps,next); }; }
function wait(sec){ return function(next){ Sched.to(next, sec*1000); }; }
function call(fn){ return function(next){ fn(); next(); }; }
function par(){ // 并行执行, 全部完成后继续
  var steps=Array.prototype.slice.call(arguments);
  return function(next){
    var n = steps.length;
    if(!n){ next(); return; }
    var myGen = Script.gen;
    steps.forEach(function(s){
      s(function(){ if(myGen!==Script.gen) return; if(--n===0) next(); });
    });
  };
}

/* ---------- canvas 工具 ---------- */
function makeCanvas(w,h){
  var c=document.createElement('canvas'); c.width=w; c.height=h;
  c.getContext('2d').imageSmoothingEnabled=false;
  return c;
}
var FONT = 'SimHei,"Microsoft YaHei",sans-serif';
var FONT_SERIF = 'Georgia,"Times New Roman",serif';
function txt(ctx, s, x, y, size, color, align, bold, font){
  ctx.font = (bold?'bold ':'') + size + 'px ' + (font||FONT);
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = align || 'left';
  ctx.fillText(s, Math.round(x), Math.round(y));
}
function txtOutline(ctx, s, x, y, size, color, outColor, align, bold, font){
  ctx.font = (bold?'bold ':'') + size + 'px ' + (font||FONT);
  ctx.textBaseline='top'; ctx.textAlign=align||'left';
  ctx.fillStyle=outColor;
  ctx.fillText(s, Math.round(x)+1, Math.round(y)+1);
  ctx.fillStyle=color;
  ctx.fillText(s, Math.round(x), Math.round(y));
}
