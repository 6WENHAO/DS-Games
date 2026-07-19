(function(){
'use strict';
var KOF = window.KOF;
var S = KOF.SVG;
var OUT = '#12101a';
var FW = 170, FH = 132, GY = 126, CX = 85;

function rad(a){ return a*Math.PI/180; }
function dd(a){ return [Math.sin(rad(a)), Math.cos(rad(a))]; } // down-based dir
function du(a){ return [Math.sin(rad(a)), -Math.cos(rad(a))]; } // up-based dir
function add(p,v,l){ return [p[0]+v[0]*l, p[1]+v[1]*l]; }

function getPose(ch, name){
  var base = (ch.customPoses && ch.customPoses[name]) || KOF.Poses[name];
  if(!base){ base = KOF.Poses.idleA; }
  var mod = ch.poseMods && ch.poseMods[name];
  if(!mod && !(ch.poseMods && ch.poseMods['*'])) return base;
  var r = {};
  for(var k in base) r[k] = base[k];
  var g = ch.poseMods && ch.poseMods['*'];
  if(g) for(var k2 in g) r[k2] = base[k2] + g[k2];
  if(mod) for(var k3 in mod) r[k3] = mod[k3];
  return r;
}

function render(ch, pose, pal, flash){
  var st = ch.style;
  var sc = (st.h||88)/88;
  var C = flash ? { skin:'#fff', hair:'#fff', top:'#fff', topD:'#eee', pants:'#fff', shoe:'#eee', accent:'#fff', glove:'#fff', shirt:'#fff' } : pal;
  var out = flash ? '#fff' : OUT;
  var bulk = st.bulk||1;
  var uLeg=22*sc, lLeg=20*sc, torso=26*sc, uArm=15*sc, lArm=14*sc, headR=8*sc, neck=3*sc, footL=8*sc;
  var wUL=8*bulk, wLL=6.5*bulk, wUA=6.5*bulk, wLA=5.5*bulk;
  var shoulderW = 11*sc*(st.female?0.8:1)*(st.shoulder||1);
  var hipW = 7.5*sc*(st.female?1.05:0.95);

  var hip = [CX + pose.hx*sc, GY - pose.hy*sc];
  var upT = du(pose.t);
  var chest = add(hip, upT, torso);
  var shp = add(hip, upT, torso-3*sc);
  var hc = add(chest, du(pose.t + pose.n), neck + headR*0.9);

  function arm(sA, eA, near){
    var sp = [shp[0] + (near?2:-2), shp[1]];
    var el = add(sp, dd(sA + pose.t), uArm);
    var hd = add(el, dd(sA + eA + pose.t), lArm);
    return { sp:sp, el:el, hd:hd };
  }
  function leg(hA, kA){
    var kn = add(hip, dd(hA), uLeg);
    var an = add(kn, dd(hA - kA), lLeg);
    return { kn:kn, an:an };
  }
  var farA = arm(pose.ls, pose.le, false);
  var nearA = arm(pose.rs, pose.re, true);
  var farL = leg(pose.lh, pose.lk);
  var nearL = leg(pose.rh, pose.rk);

  var sleeves = (st.top==='jacket'||st.top==='gi'||st.top==='coat'||st.top==='uniform');
  var armCol = sleeves ? C.top : C.skin;
  var fistCol = st.gloves ? C.glove : C.skin;

  var s = S.open(FW, FH);

  function drawArm(A, isNear){
    var str = '';
    str += S.limb(A.sp[0],A.sp[1],A.el[0],A.el[1], wUA, armCol, out);
    str += S.limb(A.el[0],A.el[1],A.hd[0],A.hd[1], wLA, sleeves?armCol:C.skin, out);
    str += S.circle(A.hd[0],A.hd[1],3.4*bulk, fistCol, out, 1);
    return str;
  }
  function drawLeg(L, footA){
    var str = '';
    str += S.limb(hip[0],hip[1],L.kn[0],L.kn[1], wUL, C.pants, out);
    str += S.limb(L.kn[0],L.kn[1],L.an[0],L.an[1], wLL, C.pants, out);
    var tip = add(L.an, dd(footA), footL);
    str += S.limb(L.an[0],L.an[1],tip[0],tip[1], 5*bulk, C.shoe, out);
    return str;
  }

  // far arm, far leg
  s += drawArm(farA,false);
  s += drawLeg(farL, pose.lf);

  // torso
  var perp = [ -upT[1], upT[0] ];
  var t1 = [chest[0]+perp[0]*shoulderW, chest[1]+perp[1]*shoulderW];
  var t2 = [chest[0]-perp[0]*shoulderW, chest[1]-perp[1]*shoulderW];
  var t3 = [hip[0]-perp[0]*hipW, hip[1]-perp[1]*hipW];
  var t4 = [hip[0]+perp[0]*hipW, hip[1]+perp[1]*hipW];
  s += S.poly([t1,t2,t3,t4], C.top, out, 1.5);
  if(st.top==='coat'){
    var c3=[hip[0]-perp[0]*(hipW+2), hip[1]-perp[1]*(hipW+2)+10*sc];
    var c4=[hip[0]+perp[0]*(hipW+2), hip[1]+perp[1]*(hipW+2)+10*sc];
    s += S.poly([t4,t3,c3,c4], C.top, out, 1.5);
    s += S.line(hip[0],hip[1]-2, hip[0], hip[1]+9*sc, C.topD, 1.5);
  }
  if(st.top==='jacket' || st.top==='uniform'){
    var mid = [(t1[0]+t2[0])/2,(t1[1]+t2[1])/2];
    s += S.poly([[mid[0]-3,mid[1]],[mid[0]+3,mid[1]],[hip[0]+2,hip[1]],[hip[0]-2,hip[1]]], C.shirt||'#ddd', null);
    s += S.line(mid[0]-3, mid[1], hip[0]-2, hip[1], C.topD, 1.5);
    s += S.line(mid[0]+3, mid[1], hip[0]+2, hip[1], C.topD, 1.5);
  }
  if(st.top==='gi'){
    var m2 = [(t1[0]+t2[0])/2,(t1[1]+t2[1])/2];
    s += S.line(m2[0]-2, m2[1]+1, hip[0], hip[1]-2, C.topD, 2);
  }
  if(st.top==='vest'){
    s += S.line((t1[0]+hip[0])/2, (t1[1]+hip[1])/2, (t2[0]+hip[0])/2, (t2[1]+hip[1])/2, C.topD, 1.5);
  }
  if(st.female){
    s += S.line(t1[0]*0.4+t4[0]*0.6, t1[1]*0.4+t4[1]*0.6, t2[0]*0.4+t3[0]*0.6, t2[1]*0.4+t3[1]*0.6, C.topD, 1.5);
  }
  // belt
  s += S.limb(t4[0],t4[1],t3[0],t3[1], 4, st.top==='gi'? C.accent : C.topD, null);

  // near leg
  s += drawLeg(nearL, pose.rf);

  // head
  s += S.circle(hc[0], hc[1], headR, C.skin, out, 1.5);
  s += hairSVG(st.hair, hc, headR, C, out);
  if(st.headband){
    s += S.limb(hc[0]-headR, hc[1]-headR*0.35, hc[0]+headR, hc[1]-headR*0.35, 3, C.accent, null);
    s += S.limb(hc[0]-headR, hc[1]-headR*0.3, hc[0]-headR-5, hc[1]+2, 2, C.accent, null);
  }
  if(st.cap){
    s += S.poly([[hc[0]-headR,hc[1]-headR*0.4],[hc[0]-headR*0.6,hc[1]-headR*1.25],[hc[0]+headR*0.7,hc[1]-headR*1.25],[hc[0]+headR,hc[1]-headR*0.4],[hc[0]+headR+4,hc[1]-headR*0.3]], C.accent, out, 1);
  }
  // face
  var fce = pose.face|0;
  s += S.rect(hc[0]+headR*0.35, hc[1]-headR*0.22, 2.5, fce===1?1.5:2.5, '#141420');
  s += S.line(hc[0]+headR*0.2, hc[1]-headR*0.5, hc[0]+headR*0.85, hc[1]-headR*0.45, '#141420', 1);
  if(fce===1) s += S.line(hc[0]+headR*0.3, hc[1]+headR*0.5, hc[0]+headR*0.8, hc[1]+headR*0.42, '#141420', 1.2);

  // near arm
  s += drawArm(nearA,true);

  s += S.close;
  return s;
}

function hairSVG(style, hc, r, C, out){
  var x=hc[0], y=hc[1], s='';
  switch(style){
    case 'spiky':
      s += S.poly([[x-r,y-r*0.2],[x-r*1.15,y-r*1.1],[x-r*0.5,y-r*0.85],[x-r*0.35,y-r*1.6],[x+r*0.15,y-r*0.9],[x+r*0.6,y-r*1.5],[x+r*0.8,y-r*0.7],[x+r,y-r*0.25],[x,y-r*0.45]], C.hair, out, 1);
      break;
    case 'wild':
      s += S.poly([[x-r*1.3,y+r*0.3],[x-r*1.5,y-r*0.8],[x-r*0.8,y-r*0.9],[x-r*0.6,y-r*1.8],[x,y-r],[x+r*0.5,y-r*1.7],[x+r*0.7,y-r*0.8],[x+r*1.15,y-r*0.6],[x+r*0.95,y-r*0.1],[x,y-r*0.4]], C.hair, out, 1);
      break;
    case 'flat':
      s += S.path('M '+(x-r)+' '+(y-r*0.2)+' Q '+x+' '+(y-r*1.7)+' '+(x+r)+' '+(y-r*0.25)+' L '+(x+r*0.75)+' '+(y-r*0.45)+' Q '+x+' '+(y-r*1.1)+' '+(x-r*0.6)+' '+(y-r*0.35)+' Z', C.hair, out, 1);
      break;
    case 'side':
      s += S.path('M '+(x-r)+' '+(y+r*0.15)+' Q '+(x-r*1.2)+' '+(y-r*1.2)+' '+x+' '+(y-r*1.35)+' Q '+(x+r*1.1)+' '+(y-r*1.3)+' '+(x+r*1.05)+' '+(y-r*0.1)+' L '+(x+r*0.55)+' '+(y-r*0.55)+' Q '+(x-r*0.2)+' '+(y-r*0.8)+' '+(x-r*0.55)+' '+(y-r*0.15)+' Z', C.hair, out, 1);
      break;
    case 'long':
      s += S.poly([[x-r*1.15,y+r*1.6],[x-r*1.25,y-r*0.5],[x-r*0.6,y-r*1.3],[x+r*0.5,y-r*1.3],[x+r*1.05,y-r*0.4],[x+r*0.85,y-r*0.5],[x+r*0.3,y-r*0.95],[x-r*0.5,y-r*0.85],[x-r*0.65,y+r*1.5]], C.hair, out, 1);
      break;
    case 'pony':
      s += S.path('M '+(x-r)+' '+(y-r*0.1)+' Q '+x+' '+(y-r*1.6)+' '+(x+r)+' '+(y-r*0.15)+' L '+(x+r*0.7)+' '+(y-r*0.4)+' Q '+x+' '+(y-r)+' '+(x-r*0.6)+' '+(y-r*0.3)+' Z', C.hair, out, 1);
      s += S.poly([[x-r*0.9,y-r*0.6],[x-r*1.9,y+r*0.9],[x-r*1.5,y+r*1.1],[x-r*0.6,y-r*0.2]], C.hair, out, 1);
      break;
    case 'buzz':
      s += S.path('M '+(x-r)+' '+(y-r*0.25)+' Q '+x+' '+(y-r*1.35)+' '+(x+r)+' '+(y-r*0.3)+' L '+(x+r*0.8)+' '+(y-r*0.35)+' Q '+x+' '+(y-r*1.05)+' '+(x-r*0.8)+' '+(y-r*0.4)+' Z', C.hair, out, 1);
      break;
    case 'bald': break;
    case 'slick':
      s += S.path('M '+(x-r)+' '+(y-r*0.15)+' Q '+(x-r*0.6)+' '+(y-r*1.5)+' '+(x+r*0.6)+' '+(y-r*1.3)+' Q '+(x+r*1.05)+' '+(y-r*0.9)+' '+(x+r*0.95)+' '+(y-r*0.35)+' L '+(x+r*0.6)+' '+(y-r*0.6)+' Q '+x+' '+(y-r)+' '+(x-r*0.6)+' '+(y-r*0.3)+' Z', C.hair, out, 1);
      break;
  }
  return s;
}

function frameKey(chId, poseName, palIdx, flash){ return 'pp:'+chId+':'+poseName+':'+palIdx+(flash?':F':''); }

function frame(ch, poseName, palIdx, flash){
  var key = frameKey(ch.id, poseName, palIdx, flash);
  var cv = S.get(key);
  if(cv) return cv;
  if(!S.has(key)){
    var svg = render(ch, getPose(ch, poseName), ch.palettes[palIdx]||ch.palettes[0], flash);
    S.raster(key, svg, FW, FH);
  }
  return null;
}

function portraitSVG(ch, palIdx, big){
  var pal = ch.palettes[palIdx]||ch.palettes[0];
  var st = ch.style;
  var w = big?48:26, h = big?48:26;
  var r = big?13:8;
  var x = w/2, y = big? h*0.48 : h*0.52;
  var s = S.open(w,h);
  s += S.rect(0,0,w,h, big? '#1a1a2e' : '#20203a');
  if(big){
    s += S.poly([[x-r*1.6,h],[x-r*1.2,y+r*0.9],[x,y+r*1.2],[x+r*1.2,y+r*0.9],[x+r*1.6,h]], pal.top, OUT, 1.5);
  }
  s += S.circle(x, y, r, pal.skin, OUT, 1.5);
  s += hairSVG(st.hair, [x,y], r, pal, OUT);
  if(st.headband) s += S.limb(x-r, y-r*0.35, x+r, y-r*0.35, big?4:3, pal.accent, null);
  if(st.cap) s += S.poly([[x-r,y-r*0.4],[x-r*0.6,y-r*1.25],[x+r*0.7,y-r*1.25],[x+r,y-r*0.4],[x+r+4,y-r*0.3]], pal.accent, OUT, 1);
  s += S.rect(x-r*0.45, y-r*0.15, big?3:2, big?3:2, '#141420');
  s += S.rect(x+r*0.25, y-r*0.15, big?3:2, big?3:2, '#141420');
  s += S.line(x-r*0.55, y-r*0.45, x-r*0.1, y-r*0.42, '#141420', 1);
  s += S.line(x+r*0.15, y-r*0.42, x+r*0.6, y-r*0.45, '#141420', 1);
  s += S.line(x-r*0.25, y+r*0.5, x+r*0.3, y+r*0.5, '#141420', 1);
  s += S.close;
  return { svg:s, w:w, h:h };
}
function portrait(ch, palIdx, big){
  var key = 'pt:'+ch.id+':'+palIdx+(big?':B':'');
  var cv = S.get(key);
  if(cv) return cv;
  if(!S.has(key)){
    var p = portraitSVG(ch, palIdx, big);
    S.raster(key, p.svg, p.w, p.h);
  }
  return null;
}

function preload(ch, palIdx){
  var names = {};
  for(var n in KOF.Poses) names[n]=1;
  if(ch.customPoses) for(var m in ch.customPoses) names[m]=1;
  for(var name in names) frame(ch, name, palIdx, false);
  portrait(ch, palIdx, false);
  portrait(ch, palIdx, true);
}

KOF.Puppet = { render:render, frame:frame, portrait:portrait, preload:preload, getPose:getPose,
  FW:FW, FH:FH, GY:GY, CX:CX };
})();
