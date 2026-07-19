(function(){
'use strict';
var KOF = window.KOF = window.KOF || {};
var cache = {};
var pending = 0;

function raster(key, svgStr, w, h, cb){
  if(cache[key]){ if(cb) cb(cache[key].canvas); return cache[key].canvas; }
  var entry = { canvas:null, ready:false };
  cache[key] = entry;
  pending++;
  var img = new Image();
  img.onload = function(){
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    try{ ctx.drawImage(img, 0, 0, w, h); }catch(e){}
    entry.canvas = c; entry.ready = true;
    pending--;
    if(cb) cb(c);
  };
  img.onerror = function(){ pending--; entry.ready = true; entry.canvas = blank(w,h); if(cb) cb(entry.canvas); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  return null;
}

function blank(w,h){
  var c = document.createElement('canvas'); c.width=Math.max(1,w); c.height=Math.max(1,h); return c;
}

function get(key){
  var e = cache[key];
  return (e && e.ready) ? e.canvas : null;
}
function has(key){ return !!cache[key]; }
function busy(){ return pending > 0; }

function svgOpen(w,h,extra){
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" shape-rendering="crispEdges"'+(extra||'')+'>';
}
function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function q(v){ return Math.round(v*2)/2; }
function poly(pts, fill, stroke, sw){
  var s = '<polygon points="';
  for(var i=0;i<pts.length;i++){ s += q(pts[i][0])+','+q(pts[i][1])+' '; }
  s += '" fill="'+fill+'"';
  if(stroke) s += ' stroke="'+stroke+'" stroke-width="'+(sw||1)+'"';
  return s + '/>';
}
function rect(x,y,w,h,fill,extra){
  return '<rect x="'+q(x)+'" y="'+q(y)+'" width="'+q(w)+'" height="'+q(h)+'" fill="'+fill+'"'+(extra||'')+'/>';
}
function circle(cx,cy,r,fill,stroke,sw){
  var s = '<circle cx="'+q(cx)+'" cy="'+q(cy)+'" r="'+q(r)+'" fill="'+fill+'"';
  if(stroke) s += ' stroke="'+stroke+'" stroke-width="'+(sw||1)+'"';
  return s + '/>';
}
function line(x1,y1,x2,y2,color,w,cap){
  return '<line x1="'+q(x1)+'" y1="'+q(y1)+'" x2="'+q(x2)+'" y2="'+q(y2)+'" stroke="'+color+'" stroke-width="'+w+'" stroke-linecap="'+(cap||'round')+'"/>';
}
function path(d, fill, stroke, sw, cap){
  var s = '<path d="'+d+'" fill="'+(fill||'none')+'"';
  if(stroke) s += ' stroke="'+stroke+'" stroke-width="'+(sw||1)+'" stroke-linecap="'+(cap||'round')+'" stroke-linejoin="round"';
  return s + '/>';
}
function limb(ax,ay,bx,by,w,color,outline){
  var s = '';
  if(outline) s += line(ax,ay,bx,by,outline,w+2);
  s += line(ax,ay,bx,by,color,w);
  return s;
}
function text(x,y,str,size,fill,anchor,bold,family){
  return '<text x="'+q(x)+'" y="'+q(y)+'" font-size="'+size+'" fill="'+fill+'" text-anchor="'+(anchor||'start')+'"'+
    ' font-family="'+(family||'\'Microsoft YaHei\',\'SimHei\',monospace')+'"'+(bold===false?'':' font-weight="bold"')+'>'+esc(str)+'</text>';
}

KOF.SVG = { raster:raster, get:get, has:has, busy:busy, open:svgOpen, close:'</svg>', esc:esc,
  poly:poly, rect:rect, circle:circle, line:line, path:path, limb:limb, text:text, q:q, blank:blank };
})();
