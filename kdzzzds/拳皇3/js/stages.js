(function(){
'use strict';
var KOF = window.KOF;
var S = KOF.SVG;
var W = 480, H = 270, GY = 230, WORLD = 800;

function lw(p){ return Math.ceil(W + (WORLD - W)*p); }

function crowdRow(w, y, n, cols, f, scale){
  var s='', step = w/n;
  scale = scale||1;
  for(var i=0;i<n;i++){
    var x = step*i + step/2 + ((i*13)%7)-3;
    var bob = ((i+f)%2===0)? 0 : -2*scale;
    var c = cols[i%cols.length];
    s += S.circle(x, y-9*scale+bob, 3.2*scale, '#e8c39a');
    s += S.rect(x-4*scale, y-6*scale+bob, 8*scale, 7*scale, c);
    if((i+f)%3===0) s += S.rect(x+3*scale, y-14*scale, 2, 6, c);
  }
  return s;
}

function bStreet(){
  var s1 = lw(0.1), s2 = lw(0.35), s3 = lw(0.7);
  // sky
  var sky = S.open(s1,H);
  sky += S.rect(0,0,s1,H,'#0d0d2b');
  sky += S.rect(0,0,s1,90,'#141438');
  for(var i=0;i<40;i++){ sky += S.rect((i*67)%s1, (i*31)%120, 1,1, i%3?'#8888c8':'#ffffff'); }
  sky += S.circle(s1*0.75, 42, 16, '#f5edc8'); sky += S.circle(s1*0.75-6, 38, 14, '#141438');
  sky += S.close;
  // far buildings
  var far = S.open(s2,H);
  var bx=0, hs=[70,110,85,130,95,120,75,105];
  for(var b=0;b<14;b++){
    var bw = 40+((b*17)%30), bh = hs[b%8];
    far += S.rect(bx, 200-bh, bw, bh+10, b%2?'#1a1a3e':'#20204a');
    for(var wy=0; wy<bh-14; wy+=12){
      for(var wx=4; wx<bw-6; wx+=9){
        if((b+wx+wy)%3!==0) far += S.rect(bx+wx, 200-bh+6+wy, 4, 6, (b*wx+wy)%5?'#ffd97a':'#3a3a66');
      }
    }
    bx += bw+2;
    if(bx>s2) break;
  }
  far += S.rect(0,205,s2,65,'#16163a');
  far += S.close;
  // mid: street w/ crowd + neon (2 frames)
  function mid(f){
    var m = S.open(s3,H);
    m += S.rect(0,150,s3,80,'#26264f');
    for(var p=0;p<s3;p+=110){
      m += S.rect(p+8, 118, 6, 96, '#101028');
      m += S.rect(p, 112, 46, 12, '#101028');
      m += S.rect(p+2, 114, 42, 8, f? '#ff4f9a':'#ff77b8');
      m += S.text(p+6, 122, 'BAR', 8, '#fff');
    }
    for(var p2=55;p2<s3;p2+=110){
      m += S.rect(p2, 128, 40, 10, '#101028');
      m += S.rect(p2+2, 130, 36, 6, f? '#4fd9ff':'#22aaff');
    }
    m += S.rect(0, 196, s3, 34, '#1c1c40');
    m += crowdRow(s3, 226, Math.floor(s3/16), ['#b03a48','#3a58b0','#3aa060','#a08030','#7a4fa0'], f, 1.1);
    m += S.rect(0, 226, s3, 6, '#15152f');
    m += S.close;
    return m;
  }
  // floor
  var fl = S.open(WORLD, H-GY+14);
  fl += S.rect(0,0,WORLD,54,'#3c3450');
  fl += S.rect(0,0,WORLD,4,'#575070');
  for(var t=0;t<WORLD;t+=40){ fl += S.rect(t, 4, 2, 50, '#2c2640'); fl += S.rect(t+20, 18, 36, 2, '#332c48'); }
  for(var g=0;g<WORLD;g+=160){ fl += S.rect(g+10, 30, 24, 3, '#4a4266'); }
  fl += S.close;
  return { sky:{svg:sky,w:s1,p:0.1,y:0}, far:{svg:far,w:s2,p:0.35,y:0}, mid:[{svg:mid(0),w:s3},{svg:mid(1),w:s3}], midP:0.7, floor:{svg:fl,w:WORLD,y:GY-14} };
}

function bHarbor(){
  var s1 = lw(0.1), s2 = lw(0.35), s3 = lw(0.7);
  var sky = S.open(s1,H);
  sky += S.rect(0,0,s1,H,'#2b1030');
  sky += S.rect(0,60,s1,50,'#6b2048');
  sky += S.rect(0,110,s1,40,'#b0485a');
  sky += S.rect(0,150,s1,40,'#e08050');
  sky += S.circle(s1*0.6, 148, 26, '#ffd97a');
  sky += S.rect(0,170,s1,100,'#3a2050');
  sky += S.close;
  var far = S.open(s2,H);
  far += S.rect(0,168,s2,40,'#241436');
  far += S.poly([[s2*0.1,168],[s2*0.2,120],[s2*0.32,168]],'#241436');
  far += S.poly([[s2*0.55,168],[s2*0.7,100],[s2*0.85,168]],'#1c0f2c');
  // ship silhouette
  far += S.poly([[s2*0.3,190],[s2*0.32,168],[s2*0.36,168],[s2*0.37,150],[s2*0.39,150],[s2*0.4,168],[s2*0.52,168],[s2*0.55,190]],'#160a20');
  far += S.rect(0,190,s2,80,'#1a1030');
  for(var i=0;i<s2;i+=13){ far += S.rect(i, 196+((i*7)%3), 8, 2, '#b0485a'); }
  far += S.close;
  function mid(f){
    var m = S.open(s3,H);
    m += S.rect(0,205,s3,30,'#241a38');
    for(var c=0;c<s3;c+=150){
      m += S.rect(c, 148, 90, 58, c%300?'#7a3038':'#305860');
      m += S.rect(c, 148, 90, 8, c%300?'#8f3c44':'#3c6c74');
      for(var l=0;l<5;l++) m += S.rect(c+6+l*17, 160, 3, 40, '#1a1226');
      m += S.text(c+22, 190, c%300? 'S-97':'DOCK', 10, '#ffd97a');
    }
    for(var g=0;g<s3;g+=200){
      m += S.poly([[g+120,205],[g+124,120],[g+128,205]], '#12101f');
      m += S.rect(g+96, 120, 60, 5, '#12101f');
      m += S.rect(g+148, 125, 3, 26+(f?4:0), '#12101f');
    }
    m += crowdRow(s3, 228, Math.floor(s3/22), ['#3a58b0','#b09030','#3aa090'], f, 1);
    if(f) m += S.poly([[s3*0.2,60],[s3*0.21,63],[s3*0.22,60],[s3*0.21,62]],'#fff');
    m += S.poly([[s3*0.6,50+(f?3:0)],[s3*0.61,53],[s3*0.62,50],[s3*0.61,52]],'#fff');
    m += S.close;
    return m;
  }
  var fl = S.open(WORLD, H-GY+14);
  fl += S.rect(0,0,WORLD,54,'#6a5638');
  fl += S.rect(0,0,WORLD,4,'#8a7350');
  for(var t=0;t<WORLD;t+=34){ fl += S.rect(t,4,2,50,'#57452c'); }
  for(var r=10;r<54;r+=16){ fl += S.rect(0,r,WORLD,2,'#5f4c31'); }
  fl += S.close;
  return { sky:{svg:sky,w:s1,p:0.1,y:0}, far:{svg:far,w:s2,p:0.35,y:0}, mid:[{svg:mid(0),w:s3},{svg:mid(1),w:s3}], midP:0.7, floor:{svg:fl,w:WORLD,y:GY-14} };
}

function bTemple(){
  var s1 = lw(0.1), s2 = lw(0.35), s3 = lw(0.7);
  var sky = S.open(s1,H);
  sky += S.rect(0,0,s1,H,'#284468');
  sky += S.rect(0,0,s1,80,'#1c3050');
  sky += S.circle(s1*0.25, 50, 18, '#e8e8f8');
  for(var i=0;i<30;i++) sky += S.rect((i*53)%s1,(i*29)%70,1,1,'#c8d8f0');
  sky += S.close;
  var far = S.open(s2,H);
  far += S.poly([[0,190],[s2*0.15,90],[s2*0.3,150],[s2*0.45,70],[s2*0.62,160],[s2*0.78,100],[s2,180],[s2,270],[0,270]],'#1a2c48');
  far += S.poly([[s2*0.4,70+22],[s2*0.45,70],[s2*0.5,70+24],[s2*0.47,70+20],[s2*0.43,70+22]],'#e8eef8');
  far += S.rect(0,190,s2,80,'#152438');
  far += S.close;
  function mid(f){
    var m = S.open(s3,H);
    m += S.rect(0,200,s3,30,'#20262e');
    // temple gate + pillars
    for(var g=0;g<s3;g+=260){
      m += S.rect(g+20, 90, 14, 120, '#8f2f2f');
      m += S.rect(g+150, 90, 14, 120, '#8f2f2f');
      m += S.rect(g+4, 78, 176, 14, '#a83838');
      m += S.rect(g+14, 66, 156, 10, '#8f2f2f');
      m += S.rect(g+80, 92, 24, 16, '#ffd97a');
      m += S.text(g+84, 104, '武', 12, '#8f2f2f');
    }
    // lanterns sway
    for(var l=0;l<s3;l+=130){
      var sway = f? 2:-2;
      m += S.rect(l+60+sway, 110, 10, 14, '#ff9a3c');
      m += S.rect(l+62+sway, 108, 6, 2, '#333');
      m += S.rect(l+64+sway, 124, 2, 4, '#ffd97a');
    }
    // trees
    for(var t2=0;t2<s3;t2+=180){
      m += S.rect(t2+110, 150, 8, 56, '#4a3626');
      m += S.circle(t2+114, 140, 22, f?'#d86878':'#e07888');
      m += S.circle(t2+100, 152, 14, '#c85868');
    }
    m += crowdRow(s3, 226, Math.floor(s3/20), ['#404a58','#5a4a3a','#6a3a3a'], f, 1);
    if(f){ for(var p=0;p<s3;p+=90) m += S.rect(p+(p%37), 130+(p%50), 3, 2, '#ffb8c8'); }
    else { for(var p2=0;p2<s3;p2+=90) m += S.rect(p2+20+(p2%31), 150+(p2%40), 3, 2, '#ffb8c8'); }
    m += S.close;
    return m;
  }
  var fl = S.open(WORLD, H-GY+14);
  fl += S.rect(0,0,WORLD,54,'#8a8578');
  fl += S.rect(0,0,WORLD,4,'#a8a294');
  for(var t=0;t<WORLD;t+=52){ fl += S.rect(t,4,2,50,'#6e6a5e'); fl += S.rect(t+26,20,2,34,'#78735f'); }
  for(var r=18;r<54;r+=18) fl += S.rect(0,r,WORLD,2,'#7c776a');
  fl += S.close;
  return { sky:{svg:sky,w:s1,p:0.1,y:0}, far:{svg:far,w:s2,p:0.35,y:0}, mid:[{svg:mid(0),w:s3},{svg:mid(1),w:s3}], midP:0.7, floor:{svg:fl,w:WORLD,y:GY-14} };
}

function bShrine(){
  var s1 = lw(0.1), s2 = lw(0.35), s3 = lw(0.7);
  var sky = S.open(s1,H);
  sky += S.rect(0,0,s1,H,'#1a0a24');
  sky += S.circle(s1*0.5, 60, 30, '#54184a');
  sky += S.circle(s1*0.5, 60, 22, '#7a2062');
  for(var i=0;i<26;i++) sky += S.rect((i*71)%s1,(i*37)%110,1,1,'#8858a8');
  sky += S.close;
  var far = S.open(s2,H);
  far += S.poly([[0,200],[s2*0.2,110],[s2*0.5,170],[s2*0.8,90],[s2,190],[s2,270],[0,270]],'#241030');
  far += S.rect(0,200,s2,70,'#1c0c28');
  far += S.close;
  function mid(f){
    var m = S.open(s3,H);
    m += S.rect(0,205,s3,26,'#241228');
    for(var g=0;g<s3;g+=240){
      m += S.rect(g+40, 70, 16, 140, '#3a1a3e');
      m += S.rect(g+170, 70, 16, 140, '#3a1a3e');
      m += S.rect(g+24, 58, 178, 16, '#4a2450');
      m += S.poly([[g+24,58],[g+113,40],[g+202,58]],'#301638');
    }
    for(var t=0;t<s3;t+=120){
      m += S.rect(t+16, 160, 6, 50, '#2a1230');
      var fh = f? 16:22;
      m += S.poly([[t+13,162],[t+19,162-fh],[t+25,162]], '#a84fd6');
      m += S.poly([[t+16,162],[t+19,162-fh*0.6],[t+22,162]], '#e0a8ff');
    }
    m += S.close;
    return m;
  }
  var fl = S.open(WORLD, H-GY+14);
  fl += S.rect(0,0,WORLD,54,'#2e2038');
  fl += S.rect(0,0,WORLD,4,'#443052');
  for(var t2=0;t2<WORLD;t2+=48){ fl += S.rect(t2,4,2,50,'#241830'); }
  for(var r=0;r<WORLD;r+=96){ fl += S.circle(r+40, 26, 10, 'none','#3c2a4c',2); }
  fl += S.close;
  return { sky:{svg:sky,w:s1,p:0.1,y:0}, far:{svg:far,w:s2,p:0.35,y:0}, mid:[{svg:mid(0),w:s3},{svg:mid(1),w:s3}], midP:0.7, floor:{svg:fl,w:WORLD,y:GY-14} };
}

var DEFS = {
  street: { name:'霓虹街区', music:'street', build:bStreet },
  harbor: { name:'落日码头', music:'harbor', build:bHarbor },
  temple: { name:'山门武场', music:'temple', build:bTemple },
  shrine: { name:'冥狱祭坛', music:'boss', build:bShrine }
};
var LIST = ['street','harbor','temple'];

function preload(id){
  var d = DEFS[id];
  if(!d || d.layers) return;
  var L = d.build();
  d.layers = {};
  S.raster('st:'+id+':sky', L.sky.svg, L.sky.w, H);
  S.raster('st:'+id+':far', L.far.svg, L.far.w, H);
  S.raster('st:'+id+':mid0', L.mid[0].svg, L.mid[0].w, H);
  S.raster('st:'+id+':mid1', L.mid[1].svg, L.mid[1].w, H);
  S.raster('st:'+id+':floor', L.floor.svg, L.floor.w, H-GY+14);
  d.meta = { midP:L.midP, floorY:L.floor.y, skyP:L.sky.p, farP:L.far.p };
}
function preloadAll(){ for(var id in DEFS) preload(id); }

function draw(ctx, id, camX, t){
  var d = DEFS[id];
  if(!d || !d.meta){ ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); return; }
  var sky = S.get('st:'+id+':sky'), far = S.get('st:'+id+':far');
  var mid = S.get('st:'+id+':mid'+(Math.floor(t/32)%2));
  var floor = S.get('st:'+id+':floor');
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
  if(sky) ctx.drawImage(sky, -Math.round(camX*d.meta.skyP), 0);
  if(far) ctx.drawImage(far, -Math.round(camX*d.meta.farP), 0);
  if(mid) ctx.drawImage(mid, -Math.round(camX*d.meta.midP), 0);
  if(floor) ctx.drawImage(floor, -Math.round(camX), d.meta.floorY);
}

KOF.Stages = { DEFS:DEFS, LIST:LIST, preload:preload, preloadAll:preloadAll, draw:draw, WORLD:WORLD, GY:GY };
})();
