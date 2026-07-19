'use strict';
/* ============================================================
   gfx.js — 图形合成器
   内部缓冲 400x240 → 输出 800x480 (2x文字清晰度)
   色彩量化 / 暗角 / 淡入出/闪白 / 震屏 / 幕布 / 滚动条
   ============================================================ */
var GFX = (function(){
  var out, octx;            // 输出 800x480
  var buf, bctx;            // 中间缓冲 400x240
  var _quantLUT = null;
  var _dither = null;       // Bayer 4x4 抖动矩阵 (预展开)
  var flashA=0, flashColor='#fff';
  var fadeA=0, fadeTarget=0, fadeSpeed=2;
  var shakeT=0, shakeAmp=0;
  var vign;
  /* 调色 — 跨淡入淡出 (暖调/夜调/血调) */
  var gradeA=null, gradeB=null, gradeVal=0;

  /* 滚动条(黑边) */
  var letterbox = 0;   // 0~1, 1=全开电影宽幅

  /* 虹膜 */
  var iris = 1;

  function init(canvas){
    out = canvas;
    out.width = G.RW*2; out.height = G.RH*2;
    octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.scale(2,2);
    buf = makeCanvas(G.RW, G.RH);
    bctx = buf.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    // 暗角 (舞台镜框已提供画框感, 保持很轻)
    vign = makeCanvas(G.RW, G.RH);
    var vctx = vign.getContext('2d');
    var g = vctx.createRadialGradient(G.RW/2,G.RH/2, G.RH*0.46, G.RW/2,G.RH/2, G.RW*0.72);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(1,'rgba(3,5,16,0.3)');
    vctx.fillStyle=g; vctx.fillRect(0,0,G.RW,G.RH);
    // 15bit LUT
    _quantLUT = new Uint8Array(256);
    for(var i=0;i<256;i++) _quantLUT[i] = ((i>>3)<<3) | (i>>5);
    // Bayer 4x4 有序抖动: 消灭灯光衰减的色带圈 (NDS味)
    var BM = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5];
    _dither = new Int8Array(16);
    for(var d2=0;d2<16;d2++) _dither[d2] = Math.round((BM[d2]/16 - 0.47) * 8);
  }

  function flash(color, a){ flashColor=color||'#fff'; flashA=(a===undefined)?1:a; }
  function shake(amp, dur){ shakeAmp=amp; shakeT=dur; }
  function fadeTo(v, speed){ fadeTarget=v; fadeSpeed=speed||2; }

  /* 调色 — 参数: {rm,gm,bm, ro,go,bo}  (乘数+偏置) */
  function setGrade(a,b,val){
    gradeA=a; gradeB=b; gradeVal=val||0;
  }
  function snapGrade(g){ gradeA=g; gradeB=null; gradeVal=1; }

  function setLetterbox(v){ letterbox = clamp01(v); }
  function setIris(v){ iris = clamp01(v); }

  function update(dt){
    if(flashA>0){ flashA-=dt*2.6; if(flashA<0)flashA=0; }
    if(shakeT>0){ shakeT-=dt; if(shakeT<0)shakeT=0; }
    if(fadeA!==fadeTarget){
      var d=fadeTarget-fadeA, step=fadeSpeed*dt;
      if(Math.abs(d)<=step) fadeA=fadeTarget;
      else fadeA += Math.sign(d)*step;
    }
    // 调色混合速度
    if(gradeB){
      var gd=1-gradeVal;
      if(gd<=0.03){ gradeVal=1; gradeA=gradeB; gradeB=null; }
      else gradeVal += dt*0.9;
    }
  }

  function compose(glCanvas){
    var t = performance.now()/1000;
    var ox=0, oy=0;
    if(shakeT>0){
      ox = (Math.random()-0.5)*2*shakeAmp;
      oy = (Math.random()-0.5)*2*shakeAmp;
    }
    bctx.clearRect(0,0,G.RW,G.RH);
    bctx.drawImage(glCanvas, ox, oy, G.RW, G.RH);

    // 色彩量化 + 有序抖动 (统一通道: 有无调色都走同一循环)
    var img = bctx.getImageData(0,0,G.RW,G.RH);
    var d = img.data, L=_quantLUT, DM=_dither;
    var rm=1,gm=1,bm=1,ro=0,go=0,bo=0;
    if(gradeA){
      rm=gradeA.rm||1; gm=gradeA.gm||1; bm=gradeA.bm||1;
      ro=gradeA.ro||0; go=gradeA.go||0; bo=gradeA.bo||0;
      if(gradeB){
        var gv=gradeVal;
        rm=lerp(rm,gradeB.rm||1,gv); gm=lerp(gm,gradeB.gm||1,gv); bm=lerp(bm,gradeB.bm||1,gv);
        ro=lerp(ro,gradeB.ro||0,gv); go=lerp(go,gradeB.go||0,gv); bo=lerp(bo,gradeB.bo||0,gv);
      }
    }
    var plain = (rm===1&&gm===1&&bm===1&&ro===0&&go===0&&bo===0);
    var p=0, W=G.RW, H=G.RH;
    for(var y=0;y<H;y++){
      var dr = (y&3)<<2;
      for(var x=0;x<W;x++){
        var o = DM[dr|(x&3)];
        var r,g2,b;
        if(plain){ r=d[p]+o; g2=d[p+1]+o; b=d[p+2]+o; }
        else {
          r=d[p]*rm+ro+o; g2=d[p+1]*gm+go+o; b=d[p+2]*bm+bo+o;
        }
        d[p]   = L[r<0?0:(r>255?255:r|0)];
        d[p+1] = L[g2<0?0:(g2>255?255:g2|0)];
        d[p+2] = L[b<0?0:(b>255?255:b|0)];
        p+=4;
      }
    }
    bctx.putImageData(img,0,0);

    octx.drawImage(buf, 0, 0, G.RW, G.RH);
    octx.drawImage(vign, 0, 0, G.RW, G.RH);

    // 滚动条(黑边)
    if(letterbox>0.01){
      var lbH = G.RH*0.12*letterbox;
      octx.fillStyle='#000';
      octx.fillRect(0,0,G.RW,lbH);
      octx.fillRect(0,G.RH-lbH,G.RW,lbH);
    }

    // 闪白
    if(flashA>0){
      octx.globalAlpha=flashA;
      octx.fillStyle=flashColor;
      octx.fillRect(0,0,G.RW,G.RH);
      octx.globalAlpha=1;
    }
    // 淡出
    if(fadeA>0){
      octx.globalAlpha=fadeA;
      octx.fillStyle='#010105';
      octx.fillRect(0,0,G.RW,G.RH);
      octx.globalAlpha=1;
    }
    // 虹膜 (径向闭合)
    if(iris<1){
      var irR = Math.max(16, G.RH*iris*0.95);
      var c = octx.createRadialGradient(G.RW/2,G.RH/2, irR, G.RW/2,G.RH/2, irR+14);
      c.addColorStop(0,'rgba(0,0,0,0)');
      c.addColorStop(1,'#000');
      octx.fillStyle=c;
      octx.fillRect(0,0,G.RW,G.RH);
    }
  }

  /* ---------- 在逻辑分辨率 400x240 上绘制字幕 ---------- */
  function drawSubtitle(text, opts){
    opts = opts||{};
    var ctx = octx;
    /* 先计算各行, 再决定框高 — 保证文字永远在框内 */
    var lines = [];
    if(opts.speaker)
      lines.push({t:opts.speaker+':', size:9, color:opts.color||'#f0d080', bold:true, font:FONT_SERIF, lh:12});
    if(text.fr)
      lines.push({t:text.fr, size:8, color:'#d0b868', font:FONT_SERIF, lh:11});
    lines.push({t:text.zh, size:10, color:'#f8edda', lh:13});
    var totalH = 8;
    for(var i=0;i<lines.length;i++) totalH += lines[i].lh;
    var yTop = G.RH - totalH - 3;
    /* 背景梯度条 */
    var grd = ctx.createLinearGradient(0, yTop-6, 0, G.RH);
    grd.addColorStop(0, 'rgba(2,2,8,0)');
    grd.addColorStop(0.3, 'rgba(2,2,8,0.82)');
    grd.addColorStop(1, 'rgba(2,2,8,0.94)');
    ctx.fillStyle=grd;
    ctx.fillRect(0, yTop-6, G.RW, totalH+9);
    var cx = G.RW/2;
    var y = yTop+4;
    for(var j=0;j<lines.length;j++){
      var ln = lines[j];
      txt(ctx, ln.t, cx, y, ln.size, ln.color, 'center', !!ln.bold, ln.font);
      y += ln.lh;
    }
  }

  /* ---------- 标题卡 ---------- */
  function drawCard(title, sub, alpha){
    var ctx = octx;
    var a = clamp01(alpha);
    ctx.globalAlpha = a;
    ctx.fillStyle='#030207';
    ctx.fillRect(0,0,G.RW,G.RH);
    // 装饰框
    ctx.strokeStyle='#846a3a';
    ctx.lineWidth=1;
    ctx.strokeRect(20, G.RH/2-44, G.RW-40, 88);
    ctx.strokeRect(23, G.RH/2-41, G.RW-46, 82);
    // 标题
    txtOutline(ctx, title, G.RW/2, G.RH/2-28, 18, '#e8c87a', '#2a0808', 'center', true, FONT_SERIF);
    if(sub){
      txt(ctx, sub, G.RW/2, G.RH/2-4, 10, '#b09aa4', 'center', false);
    }
    if(sub && sub.fr){
      txt(ctx, sub.fr, G.RW/2, G.RH/2+10, 8, '#7a6888', 'center', false, FONT_SERIF);
    }
    ctx.globalAlpha=1;
  }

  return {
    init:init, compose:compose, update:update,
    flash:flash, shake:shake, fadeTo:fadeTo,
    setFade:function(v){ fadeA=v; fadeTarget=v; },
    getFade:function(){ return fadeA; },
    setGrade:setGrade, snapGrade:snapGrade,
    setLetterbox:setLetterbox, setIris:setIris,
    drawSubtitle:drawSubtitle, drawCard:drawCard,
    ctx: function(){ return octx; }
  };
})();
