(function(){
'use strict';
var KOF = window.KOF;
var S = KOF.SVG;

var THEMES = {
  fire:   ['#ff7b1c','#ffd23c','#fff6c8'],
  dark:   ['#7a2fd6','#c26bff','#f2dcff'],
  ice:    ['#3cc8ff','#a8ecff','#ffffff'],
  wind:   ['#4fd98a','#b8ffd2','#ffffff'],
  thunder:['#ffe23c','#fff9a8','#ffffff'],
  blue:   ['#3c7bff','#a8c8ff','#ffffff'],
  hit:    ['#ffd23c','#fff6c8','#ffffff'],
  guard:  ['#4fa8ff','#c8e4ff','#ffffff']
};

var DIMS = { spark:[40,40], orb:[36,28], pillar:[52,112], bolt:[34,120], wave:[40,30], ring:[72,72],
  dust:[28,18], boom:[56,56], shard:[44,40], aura:[60,90], beam:[60,36], slash:[48,44] };

function starPts(cx,cy,rO,rI,n,rot){
  var pts=[];
  for(var i=0;i<n*2;i++){
    var r = (i%2===0)?rO:rI;
    var a = rot + i*Math.PI/n;
    pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]);
  }
  return pts;
}

function gen(kind, theme, f){
  var T = THEMES[theme]||THEMES.fire;
  var d = DIMS[kind];
  var w=d[0], h=d[1];
  var cx=w/2, cy=h/2;
  var s = S.open(w,h);
  switch(kind){
    case 'spark':
      if(f===0){ s += S.poly(starPts(cx,cy,17,6,4,0.3), T[0]); s += S.poly(starPts(cx,cy,10,4,4,0.3), T[1]); s += S.circle(cx,cy,4,T[2]); }
      else if(f===1){ s += S.poly(starPts(cx,cy,19,5,6,0.8), T[1]); s += S.circle(cx,cy,5,T[2]); }
      else { s += S.poly(starPts(cx,cy,14,3,6,1.4), T[2]); }
      break;
    case 'slash':
      var a0 = f===0? -0.6 : -0.2;
      s += S.path('M 4 '+(h-6)+' Q '+(cx)+' '+(4+f*6)+' '+(w-4)+' '+(10+f*4)+' Q '+(cx+4)+' '+(14+f*6)+' 8 '+(h-4)+' Z', T[1]);
      s += S.path('M 8 '+(h-8)+' Q '+(cx)+' '+(10+f*6)+' '+(w-8)+' '+(13+f*4), null, T[2], 2);
      break;
    case 'orb':
      var r0 = f===0? 10:11;
      s += S.circle(cx+3,cy,r0+2,T[0]);
      s += S.poly([[cx+2,cy-r0],[2,cy-3+f*2],[8,cy],[1,cy+4-f*2],[cx+2,cy+r0]], T[0]);
      s += S.circle(cx+4,cy,r0-2,T[1]);
      s += S.circle(cx+6,cy,r0-6,T[2]);
      break;
    case 'pillar':
      var wob = f===0?0:5;
      s += S.poly([[cx-16,h],[cx-10-wob,h*0.55],[cx-13,h*0.3],[cx-4,h*0.12],[cx+2,h*0.02],[cx+8,h*0.25],[cx+13+wob,h*0.5],[cx+16,h]], T[0]);
      s += S.poly([[cx-9,h],[cx-5-wob,h*0.5],[cx,h*0.25],[cx+4+wob,h*0.55],[cx+9,h]], T[1]);
      s += S.poly([[cx-4,h],[cx,h*0.55],[cx+4,h]], T[2]);
      break;
    case 'bolt':
      var xo = f===0?0:6;
      s += S.path('M '+(cx+xo)+' 0 L '+(cx-8+xo)+' '+(h*0.3)+' L '+(cx+4+xo)+' '+(h*0.35)+' L '+(cx-10)+' '+(h*0.68)+' L '+(cx+2)+' '+(h*0.72)+' L '+(cx-6)+' '+h, null, T[0], 6);
      s += S.path('M '+(cx+xo)+' 0 L '+(cx-8+xo)+' '+(h*0.3)+' L '+(cx+4+xo)+' '+(h*0.35)+' L '+(cx-10)+' '+(h*0.68)+' L '+(cx+2)+' '+(h*0.72)+' L '+(cx-6)+' '+h, null, T[2], 2);
      break;
    case 'wave':
      s += S.path('M 4 '+(cy)+' Q '+(cx)+' '+(2+f*3)+' '+(w-4)+' '+(6+f*2)+' Q '+(cx+6)+' '+(cy)+' '+(w-4)+' '+(h-6-f*2)+' Q '+cx+' '+(h-2-f*3)+' 4 '+cy+' Z', T[0]);
      s += S.path('M 10 '+(cy)+' Q '+(cx)+' '+(7+f*3)+' '+(w-8)+' '+(10+f*2)+' Q '+(cx+4)+' '+(cy)+' '+(w-8)+' '+(h-10)+' Q '+cx+' '+(h-7)+' 10 '+cy+' Z', T[1]);
      break;
    case 'ring':
      var rr = 10+f*11;
      s += S.circle(cx,cy,rr, 'none', T[1], 5-f);
      s += S.circle(cx,cy,rr-4, 'none', T[2], 2);
      break;
    case 'dust':
      s += S.circle(6,h-5,4+f, T[2]==='#ffffff'?'#cfc5b4':T[2]);
      s += S.circle(cx,h-7,5+f, '#ded5c5');
      s += S.circle(w-7,h-5,4+f, '#cfc5b4');
      break;
    case 'boom':
      if(f===0){ s += S.circle(cx,cy,12,T[2]); s += S.circle(cx,cy,9,T[1]); }
      else if(f===1){ s += S.poly(starPts(cx,cy,24,10,7,0.4), T[0]); s += S.poly(starPts(cx,cy,16,7,7,0.4), T[1]); s += S.circle(cx,cy,7,T[2]); }
      else { s += S.poly(starPts(cx,cy,27,12,9,0.9), T[1]); s += S.circle(cx,cy,10,'none'); s += S.poly(starPts(cx,cy,14,5,7,0.2), T[2]); }
      break;
    case 'shard':
      s += S.poly([[4,h-2],[10,h*0.35],[14,h-6]], T[0], T[1], 1);
      s += S.poly([[16,h-2],[cx,2],[cx+8,h-4]], T[1], T[2], 1);
      s += S.poly([[w-14,h-2],[w-8,h*0.45],[w-3,h-4]], T[0], T[1], 1);
      break;
    case 'aura':
      var k = f===0?0:4;
      s += S.poly([[cx-22,h],[cx-16,h*0.5+k],[cx-8,h*0.25],[cx,h*0.05+k],[cx+8,h*0.22],[cx+16,h*0.5-k],[cx+22,h]], T[0]);
      s += S.poly([[cx-12,h],[cx-7,h*0.5],[cx,h*0.3+k],[cx+7,h*0.55],[cx+12,h]], T[1]);
      break;
    case 'beam':
      s += S.rect(0,cy-12+f*2,w,24-f*4, T[0]);
      s += S.rect(0,cy-7+f,w,14-f*2, T[1]);
      s += S.rect(0,cy-3,w,6, T[2]);
      break;
  }
  s += S.close;
  return s;
}

function fxFrame(kind, theme, f){
  var key = 'fx:'+kind+':'+theme+':'+f;
  var cv = S.get(key);
  if(cv) return cv;
  if(!S.has(key)){
    var d = DIMS[kind];
    S.raster(key, gen(kind,theme,f), d[0], d[1]);
  }
  return null;
}
function framesOf(kind){ return kind==='boom'?3:(kind==='spark'?3:2); }

function preload(){
  var kinds = ['spark','slash','orb','pillar','bolt','wave','ring','dust','boom','shard','aura','beam'];
  for(var t in THEMES){
    for(var i=0;i<kinds.length;i++){
      for(var f=0;f<framesOf(kinds[i]);f++) fxFrame(kinds[i], t, f);
    }
  }
}

var list = [];
function spawn(kind, x, y, opt){
  opt = opt||{};
  list.push({
    kind:kind, theme:opt.theme||'hit', x:x, y:y,
    vx:opt.vx||0, vy:opt.vy||0, grav:opt.grav||0,
    life:opt.life|| (framesOf(kind)*4), age:0, fps:opt.fps||4,
    flip:opt.flip||1, scale:opt.scale||1, alpha:(opt.alpha!==undefined?opt.alpha:1),
    rot:opt.rot||0, loop:!!opt.loop, rise:opt.rise||0
  });
}
function update(){
  for(var i=list.length-1;i>=0;i--){
    var e = list[i];
    e.age++;
    e.x += e.vx; e.y += e.vy + e.rise;
    e.vy -= e.grav;
    if(e.age >= e.life) list.splice(i,1);
  }
}
function draw(ctx, camX, groundY){
  for(var i=0;i<list.length;i++){
    var e = list[i];
    var nf = framesOf(e.kind);
    var fi = e.loop ? (Math.floor(e.age/e.fps)%nf) : Math.min(nf-1, Math.floor(e.age/e.fps));
    var cv = fxFrame(e.kind, e.theme, fi);
    if(!cv) continue;
    var w = cv.width*e.scale, h = cv.height*e.scale;
    ctx.save();
    ctx.globalAlpha = e.alpha * (e.loop?1:Math.max(0.15, 1 - e.age/e.life*0.7));
    ctx.translate(Math.round(e.x - camX), Math.round(groundY - e.y));
    if(e.flip<0) ctx.scale(-1,1);
    if(e.rot) ctx.rotate(e.rot);
    ctx.drawImage(cv, -w/2, -h/2, w, h);
    ctx.restore();
  }
}
function clear(){ list = []; }

KOF.Effects = { spawn:spawn, update:update, draw:draw, clear:clear, frame:fxFrame, framesOf:framesOf, preload:preload, THEMES:THEMES };
})();
