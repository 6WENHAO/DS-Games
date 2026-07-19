'use strict';
/* ============================================================
   ui.js — 底屏 (触摸屏) 渲染
   画布 512x384, ctx.scale(2,2) → 逻辑坐标 256x192, 文字清晰
   标题 / 幽灵界HUD / 诡计按钮 / 倒计时 / 章节卡 / 结局
   ============================================================ */
var UI = (function(){
  var cvs, ctx;
  var W=G.RW, H=G.RH;
  var stars=[];

  function init(canvas){
    cvs = canvas;
    cvs.width = W*2; cvs.height = H*2;
    ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.scale(2,2);
    for(var i=0;i<40;i++)
      stars.push({x:Math.random()*W, y:Math.random()*H, s:Math.random()});
  }

  /* ============ 标题画面 ============ */
  function drawTitle(t){
    var g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#0a0c1e'); g.addColorStop(0.6,'#141034'); g.addColorStop(1,'#251c3e');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    for(var i=0;i<stars.length;i++){
      var s=stars[i];
      var tw = 0.3+Math.abs(Math.sin(t*1.5+s.s*7))*0.7;
      ctx.fillStyle='rgba(200,215,255,'+(tw*0.7)+')';
      ctx.fillRect(s.x, s.y*0.55, 1, 1);
    }
    ctx.strokeStyle='rgba(90,122,176,0.35)';
    ctx.lineWidth=1;
    for(var r=0;r<45;r++){
      var rx = ((r*67.7 + t*140)%(W+30))-15;
      var ry = ((r*97.3 + t*260)%(H+40))-20;
      ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx-2,ry+7); ctx.stroke();
    }
    ctx.fillStyle='#0c0a1c';
    ctx.fillRect(0,H-46,W,46);
    // 灯塔剪影
    ctx.fillStyle='#161226';
    ctx.beginPath();
    ctx.moveTo(206,H-46); ctx.lineTo(210,H-102); ctx.lineTo(222,H-102); ctx.lineTo(226,H-46);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(207,H-108,18,7);
    var sweep = Math.sin(t*0.7);
    ctx.save();
    ctx.globalAlpha = 0.15+Math.abs(sweep)*0.1;
    ctx.fillStyle='#ffe9a8';
    ctx.beginPath();
    ctx.moveTo(216,H-104);
    ctx.lineTo(216+sweep*160-40, H-46);
    ctx.lineTo(216+sweep*160+40, H-46);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle='#ffdf91';
    ctx.fillRect(213,H-104,6,4);

    // 蓝焰魂
    var fx=W/2, fy=52+Math.sin(t*2)*2.5;
    var fg=ctx.createRadialGradient(fx,fy,2,fx,fy,26);
    fg.addColorStop(0,'rgba(180,225,255,0.85)');
    fg.addColorStop(0.4,'rgba(80,140,220,0.4)');
    fg.addColorStop(1,'rgba(30,60,140,0)');
    ctx.fillStyle=fg;
    ctx.beginPath(); ctx.arc(fx,fy,26,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#8fd8ff';
    ctx.beginPath();
    ctx.moveTo(fx,fy-19);
    ctx.quadraticCurveTo(fx+10+Math.sin(t*4)*3, fy-4, fx+5, fy+7);
    ctx.quadraticCurveTo(fx+2, fy+13, fx, fy+14);
    ctx.quadraticCurveTo(fx-2, fy+13, fx-5, fy+7);
    ctx.quadraticCurveTo(fx-10-Math.sin(t*4)*3, fy-4, fx,fy-19);
    ctx.fill();
    ctx.fillStyle='#eaf6ff';
    ctx.beginPath(); ctx.ellipse(fx,fy+3,5,8,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1d3a72';
    ctx.fillRect(fx-3,fy,2,3); ctx.fillRect(fx+1,fy,2,3);

    txtOutline(ctx,'灰港安魂曲', W/2, 88, 24, '#f2e2c0', '#1a0f08', 'center', true);
    txt(ctx,'G R E Y   H A R B O U R   R E Q U I E M', W/2, 116, 7, '#a08a64', 'center');
    ctx.fillStyle='#5a4a7c'; ctx.fillRect(W/2-58,128,116,1);
    txt(ctx,'一夜之魂 · 死者的四分钟', W/2, 134, 9, '#8a7ba4','center');

    if(Math.floor(t*1.6)%2===0)
      txt(ctx,'▶ 触摸屏幕 开始', W/2, 158, 11, '#e8c15a','center',true);
    txt(ctx,'幽灵诡计式原创同人习作 · 非商用', W/2, 180, 7, '#4a4462','center');
  }

  /* ============ 章节卡 ============ */
  function drawCard(title, sub, t, a){
    ctx.fillStyle='#04050c'; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = a;
    ctx.strokeStyle='#8a6a3c'; ctx.lineWidth=1;
    ctx.strokeRect(14.5,24.5,W-29,H-49);
    ctx.strokeStyle='rgba(138,106,60,0.4)';
    ctx.strokeRect(18.5,28.5,W-37,H-57);
    ctx.fillStyle='#c8a35c';
    [[14,24],[W-15,24],[14,H-25],[W-15,H-25]].forEach(function(p){
      ctx.fillRect(p[0]-2,p[1]-2,5,5);
    });
    txt(ctx, sub, W/2, 62, 10, '#8a7ba4', 'center');
    txtOutline(ctx, title, W/2, 82, 19, '#f2e2c0', '#241505', 'center', true);
    ctx.fillStyle='#5fd3e8';
    ctx.fillRect(W/2-30, 112, 60, 1);
    var fy=130+Math.sin(t*3)*1.5;
    ctx.fillStyle='#8fd8ff';
    ctx.beginPath();
    ctx.moveTo(W/2, fy-7);
    ctx.quadraticCurveTo(W/2+5, fy, W/2+2, fy+4);
    ctx.quadraticCurveTo(W/2, fy+6, W/2-2, fy+4);
    ctx.quadraticCurveTo(W/2-5, fy, W/2, fy-7);
    ctx.fill();
    ctx.globalAlpha=1;
  }

  /* ============ 探索HUD ============ */
  function drawHud(st, t){
    ctx.clearRect(0,0,W,H);

    if(st.ghostOn){
      var g=ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'rgba(8,16,52,0.92)');
      g.addColorStop(1,'rgba(16,10,44,0.92)');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='rgba(90,140,255,0.14)';
      for(var y=0;y<H;y+=7){
        ctx.beginPath();
        for(var x=0;x<=W;x+=8){
          var yy=y+Math.sin(x*0.05+t*2+y*0.2)*2.2;
          if(x===0)ctx.moveTo(x,yy); else ctx.lineTo(x,yy);
        }
        ctx.stroke();
      }
      txtOutline(ctx,'幽 灵 界', W/2, 5, 10, '#9fc0ff', '#101838','center',true);
      // 幽灵界中提示压缩为顶部单行, 绝不遮挡核心
      if(st.hint){
        var short = st.hint.length>30 ? st.hint.substring(0,29)+'…' : st.hint;
        txtOutline(ctx, short, W/2, 18, 7, '#e0d0a2', '#141020','center');
      }else{
        txt(ctx,'点击发光核心跳跃 · 幽灵界中时间静止', W/2, 18, 7, '#7a8ec8','center');
      }
    } else {
      ctx.fillStyle='rgba(8,8,20,0.86)';
      ctx.fillRect(0,0,W,H);
      txtOutline(ctx,'现 实', W/2, 5, 10, '#d8b87a', '#231505','center',true);
      txt(ctx,'附身核心后可施展「诡计」· 蓝焰按钮进入幽灵界', W/2, 18, 7, '#8a7a5c','center');
    }

    if(st.ghostOn) drawGhostMap(st, t);

    if(st.timer!==null && st.timer!==undefined){
      drawTimer(st.timer, st.timerMax, t);
    }

    // 完整提示框只在现实模式显示 (幽灵界为免遮挡, 用顶部单行)
    if(st.hint && !st.ghostOn){
      var lines = wrapCJK(st.hint, 24);
      var hy = H-56-lines.length*11;
      ctx.fillStyle='rgba(4,6,14,0.85)';
      rr(ctx, 8, hy-5, W-16, lines.length*11+10, 3); ctx.fill();
      ctx.strokeStyle='rgba(232,193,90,0.4)';
      rr(ctx, 8.5, hy-4.5, W-17, lines.length*11+9, 3); ctx.stroke();
      for(var i=0;i<lines.length;i++)
        txt(ctx, lines[i], W/2, hy+i*11, 9, '#e0d0a2','center');
    }

    drawButtons(st, t);
  }

  function drawGhostMap(st, t){
    if(!st.cores) return;
    var soul = null;
    for(var i=0;i<st.cores.length;i++)
      if(st.cores[i].id===st.soulAt) soul=st.cores[i];
    if(soul){
      for(var j=0;j<st.cores.length;j++){
        var c=st.cores[j];
        if(c.id===st.soulAt || !c.reachable) continue;
        ctx.strokeStyle='rgba(120,180,255,'+(0.25+Math.sin(t*3+j)*0.1)+')';
        ctx.setLineDash([3,4]);
        ctx.beginPath();
        ctx.moveTo(soul.sx, soul.sy);
        ctx.lineTo(c.sx, c.sy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    for(var k=0;k<st.cores.length;k++){
      var core = st.cores[k];
      var isSoul = core.id===st.soulAt;
      var R = isSoul?9:(core.reachable?7:4);
      var pulse = 1+Math.sin(t*4+k*1.3)*0.15;
      var col = isSoul?'#8fd8ff':(core.reachable?'#ffb45a':'#5c5470');
      var gg = ctx.createRadialGradient(core.sx,core.sy,1,core.sx,core.sy,R*2*pulse);
      gg.addColorStop(0, col);
      gg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=0.5;
      ctx.fillStyle=gg;
      ctx.beginPath(); ctx.arc(core.sx,core.sy,R*2*pulse,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.arc(core.sx,core.sy,R*0.6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(core.sx-1,core.sy-1,R*0.22,0,Math.PI*2); ctx.fill();
      if(core.reachable||isSoul){
        txtOutline(ctx, core.name, core.sx, core.sy+R+2, 8,
          isSoul?'#c8e8ff':'#ffd8a0', '#0a0c18','center');
      }
      if(isSoul) txtOutline(ctx,'★', core.sx, core.sy-R-10, 8, '#8fd8ff','#0a0c18','center');
    }
  }

  function drawButtons(st, t){
    // 幽灵切换按钮 (右下)
    var bx=W-52, by=H-40, bw=44, bh=32;
    var on = st.ghostOn;
    ctx.fillStyle = on ? 'rgba(40,80,160,0.95)' : 'rgba(18,22,44,0.95)';
    rr(ctx,bx,by,bw,bh,5); ctx.fill();
    ctx.strokeStyle = on ? '#8fd8ff' : '#4a5480';
    ctx.lineWidth=1;
    rr(ctx,bx+0.5,by+0.5,bw-1,bh-1,5); ctx.stroke();
    var fy=by+12+Math.sin(t*5)*1;
    ctx.fillStyle= on ? '#eaf6ff':'#8fd8ff';
    ctx.beginPath();
    ctx.moveTo(bx+bw/2, fy-8);
    ctx.quadraticCurveTo(bx+bw/2+5, fy-1, bx+bw/2+2, fy+3);
    ctx.quadraticCurveTo(bx+bw/2, fy+5, bx+bw/2-2, fy+3);
    ctx.quadraticCurveTo(bx+bw/2-5, fy-1, bx+bw/2, fy-8);
    ctx.fill();
    txt(ctx, on?'回到现实':'幽灵界', bx+bw/2, by+19, 8, on?'#eaf6ff':'#9ab0d8','center',true);

    // 诡计按钮 (中下)
    if(st.canTrick && !st.ghostOn){
      var tx=W/2-44, ty=H-40, tw=88, th=32;
      var pulse=0.5+Math.sin(t*5)*0.3;
      ctx.fillStyle='rgba(140,44,52,0.96)';
      rr(ctx,tx,ty,tw,th,5); ctx.fill();
      ctx.strokeStyle='rgba(255,180,150,'+(0.4+pulse*0.5)+')';
      ctx.lineWidth=1.5;
      rr(ctx,tx+0.75,ty+0.75,tw-1.5,th-1.5,5); ctx.stroke();
      txtOutline(ctx,'诡 计', tx+tw/2, ty+4, 12, '#ffe2c8','#3c0c10','center', true);
      txt(ctx, st.trickName||'', tx+tw/2, ty+20, 8, '#f0b8a0','center');
    }
  }

  function drawTimer(sec, maxSec, t){
    var pct = clamp01(sec/maxSec);
    var warn = sec<8;
    var col = warn ? (Math.floor(t*4)%2?'#ff5a5a':'#ffb45a') : (pct<0.4?'#ffb45a':'#7fe8a0');
    var mm = Math.floor(sec/60), ss=Math.floor(sec%60);
    var str = mm+':'+ (ss<10?'0':'')+ss;
    ctx.fillStyle='rgba(4,6,14,0.85)';
    rr(ctx, W/2-40, 28, 80, 24, 4); ctx.fill();
    ctx.strokeStyle=col;
    rr(ctx, W/2-39.5, 28.5, 79, 23, 4); ctx.stroke();
    txt(ctx,'距离死亡', W/2, 30, 7, '#9a8a8a','center');
    txtOutline(ctx, str, W/2, 38, 12, col, '#140808','center', true);
    ctx.fillStyle='rgba(255,255,255,0.12)';
    ctx.fillRect(W/2-36, 54, 72, 2);
    ctx.fillStyle=col;
    ctx.fillRect(W/2-36, 54, 72*pct, 2);
  }

  /* ============ 结局画面 ============ */
  function drawEnd(t, stats){
    var g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#1a0f2e'); g.addColorStop(1,'#02030a');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    for(var i=0;i<26;i++){
      var px=(i*53.7)%W;
      var py=H-((t*14+i*29)%(H+20));
      ctx.fillStyle='rgba(143,216,255,'+(0.2+(i%4)*0.12)+')';
      ctx.fillRect(px, py, 1+(i%2), 1+(i%2));
    }
    var endName = stats.ending==='stay' ? '渡 火' : '归 潮';
    var endSub = stats.ending==='stay' ? 'THE SECOND LIGHT' : 'OUT WITH THE TIDE';
    txtOutline(ctx, endName, W/2, 28, 22, '#f2e2c0','#241505','center',true);
    txt(ctx, endSub, W/2, 54, 8, '#a08a64','center');
    ctx.fillStyle='#5fd3e8'; ctx.fillRect(W/2-40,68,80,1);

    txt(ctx,'命运回溯 '+stats.deaths+' 次', W/2, 82, 10, '#b8a8d8','center');
    var rank = stats.deaths===0?'完美之魂':(stats.deaths<3?'不屈之魂':'执着之魂');
    txt(ctx,'「'+rank+'」', W/2, 100, 13, '#e8c15a','center',true);
    txt(ctx,'雨停了。灰港的黎明属于每一个说过晚安的人。', W/2, 124, 9, '#9a90b4','center');

    if(Math.floor(t*1.6)%2===0)
      txt(ctx,'▶ 触摸屏幕 返回标题', W/2, 154, 10, '#8fd8ff','center');
    txt(ctx,'感谢游玩 · GREY HARBOUR REQUIEM', W/2, 178, 7, '#4a4462','center');
  }

  function clear(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#04050c'; ctx.fillRect(0,0,W,H);
  }

  return {
    init:init,
    drawTitle:drawTitle, drawCard:drawCard, drawHud:drawHud,
    drawEnd:drawEnd, clear:clear,
    ctx:function(){return ctx;}
  };
})();
