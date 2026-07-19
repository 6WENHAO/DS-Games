'use strict';
/* ============================================================
   core.js — 全局状态 / 工具 / 调度器 / 脚本引擎
   ============================================================ */

var G = {
  RW: 256, RH: 192,   // 逻辑分辨率(3D与坐标系)
  chapter: 0,
  deathCount: 0,
  flags: {},
  ending: null
};

/* ---------- math ---------- */
function clamp(v,l,h){ return v<l?l:(v>h?h:v); }
function clamp01(v){ return v<0?0:(v>1?1:v); }
function lerp(a,b,t){ return a+(b-a)*t; }
function easeOut(t){ return 1-(1-t)*(1-t); }
function easeIn(t){ return t*t; }
function easeInOut(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function rand(a,b){ return a + Math.random()*(b-a); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

/* ---------- 调度器(可全清, 供回溯/重开使用) ---------- */
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
   step = function(next){ ... next(); }
   Script.run(steps, done) 顺序执行。世代号防止回溯后旧脚本残留。 */
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
function flag(k,v){ return call(function(){ G.flags[k] = (v===undefined?true:v); }); }

/* ---------- canvas 工具 ---------- */
function makeCanvas(w,h){
  var c=document.createElement('canvas'); c.width=w; c.height=h;
  c.getContext('2d').imageSmoothingEnabled=false;
  return c;
}
function rr(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}
var FONT = 'SimHei,"Microsoft YaHei",sans-serif';
function txt(ctx, s, x, y, size, color, align, bold){
  ctx.font = (bold?'bold ':'') + size + 'px ' + FONT;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = align || 'left';
  ctx.fillText(s, Math.round(x), Math.round(y));
}
function txtOutline(ctx, s, x, y, size, color, outColor, align, bold){
  ctx.font = (bold?'bold ':'') + size + 'px ' + FONT;
  ctx.textBaseline='top'; ctx.textAlign=align||'left';
  ctx.fillStyle=outColor;
  ctx.fillText(s, Math.round(x)+1, Math.round(y)+1);
  ctx.fillStyle=color;
  ctx.fillText(s, Math.round(x), Math.round(y));
}
function wrapCJK(text, charsPerLine){
  var lines=[], cur='', w=0;
  for(var i=0;i<text.length;i++){
    var ch=text[i];
    if(ch==='\n'){ lines.push(cur); cur=''; w=0; continue; }
    var cw = ch.charCodeAt(0)>255 ? 1 : 0.55;
    cur+=ch; w+=cw;
    if(w>=charsPerLine){ lines.push(cur); cur=''; w=0; }
  }
  if(cur) lines.push(cur);
  return lines;
}
