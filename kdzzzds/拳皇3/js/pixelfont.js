(function(){
'use strict';
var KOF = window.KOF;
var S = KOF.SVG;

// 5x7 bitmap font, each glyph = array of 7 strings of 5 chars ('#'=pixel)
var G = {
'A':["01110","10001","10001","11111","10001","10001","10001"],
'B':["11110","10001","10001","11110","10001","10001","11110"],
'C':["01111","10000","10000","10000","10000","10000","01111"],
'D':["11110","10001","10001","10001","10001","10001","11110"],
'E':["11111","10000","10000","11110","10000","10000","11111"],
'F':["11111","10000","10000","11110","10000","10000","10000"],
'G':["01111","10000","10000","10111","10001","10001","01111"],
'H':["10001","10001","10001","11111","10001","10001","10001"],
'I':["11111","00100","00100","00100","00100","00100","11111"],
'J':["00111","00010","00010","00010","00010","10010","01100"],
'K':["10001","10010","10100","11000","10100","10010","10001"],
'L':["10000","10000","10000","10000","10000","10000","11111"],
'M':["10001","11011","10101","10101","10001","10001","10001"],
'N':["10001","11001","10101","10011","10001","10001","10001"],
'O':["01110","10001","10001","10001","10001","10001","01110"],
'P':["11110","10001","10001","11110","10000","10000","10000"],
'Q':["01110","10001","10001","10001","10101","10010","01101"],
'R':["11110","10001","10001","11110","10100","10010","10001"],
'S':["01111","10000","10000","01110","00001","00001","11110"],
'T':["11111","00100","00100","00100","00100","00100","00100"],
'U':["10001","10001","10001","10001","10001","10001","01110"],
'V':["10001","10001","10001","10001","10001","01010","00100"],
'W':["10001","10001","10001","10101","10101","11011","10001"],
'X':["10001","01010","00100","00100","00100","01010","10001"],
'Y':["10001","01010","00100","00100","00100","00100","00100"],
'Z':["11111","00001","00010","00100","01000","10000","11111"],
'0':["01110","10011","10101","10101","10101","11001","01110"],
'1':["00100","01100","00100","00100","00100","00100","01110"],
'2':["01110","10001","00001","00110","01000","10000","11111"],
'3':["11110","00001","00001","01110","00001","00001","11110"],
'4':["00010","00110","01010","10010","11111","00010","00010"],
'5':["11111","10000","11110","00001","00001","10001","01110"],
'6':["01110","10000","11110","10001","10001","10001","01110"],
'7':["11111","00001","00010","00100","01000","01000","01000"],
'8':["01110","10001","10001","01110","10001","10001","01110"],
'9':["01110","10001","10001","01111","00001","00001","01110"],
'.':["00000","00000","00000","00000","00000","00000","00100"],
',':["00000","00000","00000","00000","00000","00100","01000"],
'!':["00100","00100","00100","00100","00100","00000","00100"],
'?':["01110","10001","00001","00110","00100","00000","00100"],
':':["00000","00100","00000","00000","00000","00100","00000"],
'-':["00000","00000","00000","01110","00000","00000","00000"],
'+':["00000","00100","00100","11111","00100","00100","00000"],
'/':["00001","00010","00010","00100","01000","01000","10000"],
'>':["01000","00100","00010","00001","00010","00100","01000"],
'<':["00010","00100","01000","10000","01000","00100","00010"],
'(':["00010","00100","01000","01000","01000","00100","00010"],
')':["01000","00100","00010","00010","00010","00100","01000"],
'\'':["00100","00100","01000","00000","00000","00000","00000"],
'%':["11001","11010","00010","00100","01000","01011","10011"],
'*':["00000","10101","01110","11111","01110","10101","00000"],
'=':["00000","00000","11111","00000","11111","00000","00000"],
'"':["01010","01010","00000","00000","00000","00000","00000"],
'x':["00000","00000","10001","01010","00100","01010","10001"],
' ':["00000","00000","00000","00000","00000","00000","00000"]
};

function isAscii(str){
  for(var i=0;i<str.length;i++){ var c=str[i].toUpperCase(); if(!G[c] && str[i]!==' ') return false; }
  return true;
}

function glyphKey(ch,color,outline){ return 'g:'+ch+':'+color+':'+(outline||''); }

function buildGlyph(ch,color,outline){
  var g = G[ch.toUpperCase()] || G['?'];
  var pad = outline?1:0;
  var w = 5+pad*2, h = 7+pad*2;
  var s = S.open(w,h);
  var x,y;
  if(outline){
    for(y=0;y<7;y++)for(x=0;x<5;x++){ if(g[y][x]==='1'){
      s += S.rect(x+pad-1,y+pad,1,1,outline)+S.rect(x+pad+1,y+pad,1,1,outline)+S.rect(x+pad,y+pad-1,1,1,outline)+S.rect(x+pad,y+pad+1,1,1,outline);
    }}
  }
  for(y=0;y<7;y++)for(x=0;x<5;x++){ if(g[y][x]==='1') s += S.rect(x+pad,y+pad,1,1,color); }
  s += S.close;
  return { svg:s, w:w, h:h };
}

// draw ascii bitmap text on ctx; scale integer preferred
function draw(ctx, str, x, y, opt){
  opt = opt||{};
  var sc = opt.scale||1;
  var color = opt.color||'#fff';
  var outline = opt.outline||null;
  var spacing = (opt.spacing!==undefined?opt.spacing:1);
  str = String(str);
  var w = width(str, sc, spacing);
  var cx = x;
  if(opt.align==='center') cx = x - w/2;
  else if(opt.align==='right') cx = x - w;
  cx = Math.round(cx);
  var pad = outline?1:0;
  for(var i=0;i<str.length;i++){
    var ch = str[i];
    if(ch===' '){ cx += (3+spacing)*sc; continue; }
    var key = glyphKey(ch.toUpperCase(),color,outline);
    var cv = S.get(key);
    if(!cv){
      if(!S.has(key)){ var b = buildGlyph(ch,color,outline); S.raster(key, b.svg, b.w, b.h); }
    } else {
      ctx.drawImage(cv, cx - pad*sc, Math.round(y) - pad*sc, cv.width*sc, cv.height*sc);
    }
    cx += (5+spacing)*sc;
  }
  return w;
}
function width(str, sc, spacing){
  sc = sc||1; if(spacing===undefined) spacing=1;
  var w=0;
  for(var i=0;i<str.length;i++){ w += ((str[i]===' '?3:5)+spacing)*sc; }
  return Math.max(0,w-spacing*sc);
}

// CJK / mixed text via SVG <text>, cached per string
function drawCJK(ctx, str, x, y, opt){
  opt = opt||{};
  var size = opt.size||10;
  var color = opt.color||'#fff';
  var outline = opt.outline||null;
  var key = 'cjk:'+str+':'+size+':'+color+':'+(outline||'');
  var w = Math.ceil(str.length*size*1.1)+8, h = Math.ceil(size*1.5)+6;
  var cv = S.get(key);
  if(!cv){
    if(!S.has(key)){
      var s = S.open(w,h);
      if(outline){
        for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++){ if(dx||dy) s += S.text(4+dx, size+3+dy, str, size, outline); }
      }
      s += S.text(4, size+3, str, size, color);
      s += S.close;
      S.raster(key, s, w, h);
    }
    return 0;
  }
  var tw = measureCJK(str,size);
  var px = x;
  if(opt.align==='center') px = x - tw/2;
  else if(opt.align==='right') px = x - tw;
  ctx.drawImage(cv, Math.round(px)-4, Math.round(y)-3);
  return tw;
}
function measureCJK(str,size){
  var w=0;
  for(var i=0;i<str.length;i++){ w += (str.charCodeAt(i)>255? size : size*0.62); }
  return w;
}

// auto: ascii bitmap if possible else CJK
function auto(ctx, str, x, y, opt){
  opt = opt||{};
  if(isAscii(String(str))){
    var sc = Math.max(1, Math.round((opt.size||10)/8));
    return draw(ctx, String(str).toUpperCase(), x, y, {scale:sc, color:opt.color, outline:opt.outline, align:opt.align});
  }
  return drawCJK(ctx, str, x, y, opt);
}

KOF.Font = { draw:draw, width:width, drawCJK:drawCJK, measureCJK:measureCJK, auto:auto, isAscii:isAscii };
})();
