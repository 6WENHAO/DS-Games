'use strict';
/* ============================================================
   gfx.js — 顶屏合成器
   3D画面: 256x192 粗颗粒像素 + 15bit色阶 (保持NDS质感)
   输出画布: 512x384, 文字覆盖层以2x分辨率绘制 → 字体清晰
   ============================================================ */
var GFX = (function(){
  var out, octx;              // 输出 512x384 (逻辑坐标仍为 256x192)
  var buf, bctx;              // 中间缓冲 256x192 (低分辨率处理层)
  var mode = 'normal';        // normal | ghost | rewind | wonder
  var modeT = 0;
  var flashA = 0, flashColor = '#fff';
  var shakeT = 0, shakeAmp = 0;
  var fadeA = 0, fadeTarget = 0, fadeSpeed = 2;
  var vign;
  var _quantLUT = null;

  function init(canvas){
    out = canvas;
    out.width = G.RW*2; out.height = G.RH*2;
    octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.scale(2,2);                 // 之后全部按 256x192 逻辑坐标绘制
    buf = makeCanvas(G.RW, G.RH);
    bctx = buf.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    // 暗角贴图 (低分辨率即可)
    vign = makeCanvas(G.RW, G.RH);
    var vctx = vign.getContext('2d');
    var g = vctx.createRadialGradient(G.RW/2,G.RH/2, G.RH*0.42, G.RW/2,G.RH/2, G.RW*0.72);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(1,'rgba(4,6,20,0.45)');
    vctx.fillStyle=g; vctx.fillRect(0,0,G.RW,G.RH);
    // 量化查找表 (8bit→5bit 视觉近似)
    _quantLUT = new Uint8Array(256);
    for(var i=0;i<256;i++) _quantLUT[i] = ((i>>3)<<3) | (i>>5);
  }

  function setMode(m){ if(mode!==m){ mode=m; modeT=0; } }
  function flash(color, a){ flashColor=color||'#fff'; flashA=(a===undefined)?1:a; }
  function shake(amp, dur){ shakeAmp=amp; shakeT=dur; }
  function fadeTo(v, speed){ fadeTarget=v; fadeSpeed=speed||2; }
  function setFade(v){ fadeA=v; fadeTarget=v; }

  function update(dt){
    modeT += dt;
    if(flashA>0){ flashA -= dt*2.5; if(flashA<0)flashA=0; }
    if(shakeT>0){ shakeT -= dt; if(shakeT<0)shakeT=0; }
    if(fadeA!==fadeTarget){
      var d = fadeTarget-fadeA;
      var step = fadeSpeed*dt;
      if(Math.abs(d)<=step) fadeA=fadeTarget;
      else fadeA += Math.sign(d)*step;
    }
  }

  /* 每帧: 把 world 的 GL canvas 合成到顶屏 */
  function compose(glCanvas){
    var t = performance.now()/1000;
    var ox=0, oy=0;
    if(shakeT>0){
      ox = (Math.random()-0.5)*2*shakeAmp;
      oy = (Math.random()-0.5)*2*shakeAmp;
    }

    bctx.clearRect(0,0,G.RW,G.RH);

    if(mode==='ghost'){
      // 幽灵界: 水平波纹逐行错位
      var amp = Math.min(1, modeT*3) * 2.2;
      var band = 4;
      for(var y=0; y<G.RH; y+=band){
        var off = Math.sin(y*0.055 + t*1.8)*amp + Math.sin(y*0.21 - t*3.1)*amp*0.4;
        bctx.drawImage(glCanvas, 0,y,G.RW,band, ox+off, oy+y, G.RW, band);
      }
    } else if(mode==='rewind'){
      for(var y2=0; y2<G.RH; y2+=3){
        var off2 = Math.sin(y2*0.3+t*30)*6 + (Math.random()-0.5)*8;
        bctx.drawImage(glCanvas, 0,y2,G.RW,3, off2, y2, G.RW, 3);
      }
    } else if(mode==='wonder'){
      var amp3 = 1.2;
      for(var y3=0; y3<G.RH; y3+=6){
        var off3 = Math.sin(y3*0.03 + t*0.8)*amp3;
        bctx.drawImage(glCanvas, 0,y3,G.RW,6, ox+off3, oy+y3, G.RW, 6);
      }
    } else {
      bctx.drawImage(glCanvas, ox, oy, G.RW, G.RH);
    }

    // 色彩处理 (低分辨率层)
    var img = bctx.getImageData(0,0,G.RW,G.RH);
    var d = img.data, L=_quantLUT;
    if(mode==='ghost'){
      for(var i=0;i<d.length;i+=4){
        var r=d[i],g=d[i+1],b=d[i+2];
        var lum=(r*0.3+g*0.5+b*0.2);
        d[i]   = L[clamp((lum*0.35+r*0.15)|0,0,255)];
        d[i+1] = L[clamp((lum*0.55+g*0.3)|0,0,255)];
        d[i+2] = L[clamp((lum*0.5+b*0.6+30)|0,0,255)];
      }
    } else if(mode==='rewind'){
      for(var i2=0;i2<d.length;i2+=4){
        var v=(d[i2]*0.32+d[i2+1]*0.45+d[i2+2]*0.23)|0;
        if(Math.random()<0.05) v=255-v;
        d[i2]=L[clamp(v+40,0,255)]; d[i2+1]=L[v]; d[i2+2]=L[clamp(v+70,0,255)];
      }
    } else {
      for(var i3=0;i3<d.length;i3+=4){
        d[i3]=L[d[i3]]; d[i3+1]=L[d[i3+1]]; d[i3+2]=L[d[i3+2]];
      }
    }
    bctx.putImageData(img,0,0);

    // → 输出: 低分辨率层拉伸 2x (最近邻, 保持像素块)
    octx.drawImage(buf, 0, 0, G.RW, G.RH);
    octx.drawImage(vign, 0, 0, G.RW, G.RH);

    // 幽灵界辉光边缘
    if(mode==='ghost'){
      octx.strokeStyle='rgba(110,170,255,'+(0.25+Math.sin(t*2)*0.1)+')';
      octx.lineWidth=2;
      octx.strokeRect(1,1,G.RW-2,G.RH-2);
    }
    if(mode==='rewind'){
      octx.fillStyle='rgba(200,220,255,0.15)';
      for(var n=0;n<6;n++){
        var ny=Math.random()*G.RH;
        octx.fillRect(0,ny,G.RW,1+Math.random()*2);
      }
      txtOutline(octx,'◀◀ 倒带中', G.RW-8, 8, 10, '#bfe0ff', '#102040', 'right', true);
    }

    if(flashA>0){
      octx.globalAlpha = flashA;
      octx.fillStyle = flashColor;
      octx.fillRect(0,0,G.RW,G.RH);
      octx.globalAlpha = 1;
    }
    if(fadeA>0){
      octx.globalAlpha = fadeA;
      octx.fillStyle = '#02030a';
      octx.fillRect(0,0,G.RW,G.RH);
      octx.globalAlpha = 1;
    }
  }

  return {
    init:init, compose:compose, update:update,
    setMode:setMode, getMode:function(){return mode;},
    flash:flash, shake:shake,
    fadeTo:fadeTo, setFade:setFade,
    getFade:function(){return fadeA;},
    ctx: function(){ return octx; }
  };
})();
