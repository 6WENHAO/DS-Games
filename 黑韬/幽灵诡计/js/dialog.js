'use strict';
/* ============================================================
   dialog.js — 对话系统 (幽灵诡计式)
   打字机正文 / 头像上浮布局 / 少量分支选项
   全部渲染在底屏, 2x 分辨率下文字清晰
   ============================================================ */
var Dialog = (function(){
  var active = false;
  var mode = 'line';          // line | choice
  var cur = null;
  var typed = 0, typeTimer = 0, typeSpeed = 36; // 字/秒
  var onDone = null;

  var choices = [];
  var choiceCB = null;

  var log = [];

  var SPEAKERS = {
    hero:      { name:'你',      color:'#8fd8ff', portrait:'hero' },
    du:        { name:'渡',      color:'#c8b090', portrait:'self' },
    beacon:    { name:'老灯',    color:'#e8c15a', portrait:'beacon' },
    wei:       { name:'小卫',    color:'#7fd0a0', portrait:'wei' },
    killer:    { name:'???',     color:'#aab4d4', portrait:'killer' },
    grey:      { name:'灰面人',  color:'#aab4d4', portrait:'killer' },
    sailor:    { name:'老盐',    color:'#d4907a', portrait:'sailor' },
    bartender: { name:'酒保',    color:'#c8a878', portrait:'bartender' },
    cat:       { name:'阿煤',    color:'#ffd24a', portrait:'cat' },
    narr:      { name:'',        color:'#b8bccf', portrait:null }
  };

  /* ============ 播放一行 ============ */
  function say(speakerId, text, cb){
    var sp = SPEAKERS[speakerId] || SPEAKERS.narr;
    cur = { sid:speakerId, name:sp.name, color:sp.color, portrait:sp.portrait, text:text };
    typed = 0; typeTimer = 0;
    active = true; mode = 'line';
    onDone = cb || null;
    log.push({n:sp.name, t:text, c:sp.color});
    if(log.length>80) log.shift();
  }
  function line(speakerId, text){
    return function(next){ say(speakerId, text, next); };
  }

  /* ============ 选项 ============ */
  function ask(list, cb){
    choices = list.slice();
    mode = 'choice'; active = true;
    choiceCB = cb;
  }
  function choose(list){ // step 版本: 每项 {label, then:[steps]}
    return function(next){
      ask(list, function(c){
        if(c.then) Script.run(c.then, next); else next();
      });
    };
  }

  /* ============ 输入 ============ */
  function tap(x, y){
    if(!active) return false;
    if(mode==='line'){
      if(typed < cur.text.length){ typed = cur.text.length; return true; }
      var cb = onDone; active=false; cur=null; onDone=null;
      if(cb) cb();
      return true;
    }
    if(mode==='choice'){
      var lay = choiceLayout();
      for(var i=0;i<choices.length;i++){
        var r = lay[i];
        if(x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h){
          AudioSys.sfx.click();
          pickChoice(i);
          return true;
        }
      }
      return true;
    }
    return true;
  }
  function key(n){
    if(active && mode==='choice' && n>=0 && n<choices.length) pickChoice(n);
    else if(active) tap(-1,-1);
  }
  function pickChoice(i){
    var c = choices[i];
    var cb = choiceCB;
    choices=[]; choiceCB=null; active=false;
    if(cb) cb(c);
  }

  /* ============ 更新 ============ */
  function update(dt){
    if(!active || mode!=='line' || !cur) return;
    if(typed < cur.text.length){
      typeTimer += dt*typeSpeed;
      var add = Math.floor(typeTimer);
      if(add>0){
        typeTimer -= add;
        var before = typed;
        typed = Math.min(cur.text.length, typed+add);
        if(typed>before && (typed%2===0)) AudioSys.sfx.type();
      }
    }
  }

  /* ============ 渲染 (底屏 ctx, 256x192 逻辑坐标) ============ */
  function choiceLayout(){
    var n = choices.length;
    var h = 24, gap = 5;
    var totalH = n*h + (n-1)*gap;
    var y0 = G.RH - totalH - 12;
    var out=[];
    for(var i=0;i<n;i++) out.push({x:14, y:y0+i*(h+gap), w:G.RW-28, h:h});
    return out;
  }

  function draw(ctx){
    if(!active) return;
    var t = performance.now()/1000;
    if(mode==='line' && cur) drawLine(ctx, t);
    else if(mode==='choice') drawChoices(ctx, t);
  }

  function drawLine(ctx, t){
    var boxY = G.RH-62, boxH = 56;

    // 底框
    ctx.fillStyle = 'rgba(6,8,18,0.92)';
    rr(ctx, 4, boxY, G.RW-8, boxH, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(140,150,190,0.5)';
    ctx.lineWidth = 1;
    rr(ctx, 4.5, boxY+0.5, G.RW-9, boxH-1, 5); ctx.stroke();
    // 说话人颜色的顶部饰条
    if(cur.name){
      ctx.fillStyle = cur.color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(6, boxY+1.5, 42, 1);
      ctx.globalAlpha = 1;
    }

    // 头像 — 完全悬浮在对话框上方, 不与正文重叠
    if(cur.portrait){
      var p = Portraits.get(cur.portrait);
      if(p){
        var py = boxY - 58;
        ctx.fillStyle='rgba(6,8,18,0.92)';
        rr(ctx, 8, py, 52, 52, 4); ctx.fill();
        ctx.strokeStyle = '#3c4468';
        rr(ctx, 8.5, py+0.5, 51, 51, 4); ctx.stroke();
        var bob = Math.round(Math.sin(t*2.2)); // 轻微呼吸浮动(整数像素)
        ctx.drawImage(p, 10, py+2+bob);
      }
    }
    // 名牌 — 头像右侧, 悬于框沿
    if(cur.name){
      ctx.font='bold 10px '+FONT;
      var nw = ctx.measureText(cur.name).width;
      var nx = cur.portrait ? 64 : 10;
      ctx.fillStyle='rgba(6,8,18,0.96)';
      rr(ctx, nx, boxY-15, nw+16, 15, 3); ctx.fill();
      ctx.strokeStyle = cur.color;
      rr(ctx, nx+0.5, boxY-14.5, nw+15, 14, 3); ctx.stroke();
      txt(ctx, cur.name, nx+8, boxY-12, 10, cur.color, 'left', true);
    }

    // 正文 (打字机) — 全宽, 大字号
    var shown = cur.text.substring(0, typed);
    var lines = wrapCJK(shown, 21);
    for(var i=0;i<Math.min(lines.length,4);i++){
      txt(ctx, lines[i], 13, boxY+8+i*12.5, 10.5, '#eceef6');
    }
    // 续读箭头
    if(typed>=cur.text.length && Math.floor(t*2.5)%2===0){
      ctx.fillStyle='#e8c15a';
      ctx.beginPath();
      ctx.moveTo(G.RW-19, G.RH-13);
      ctx.lineTo(G.RW-10, G.RH-13);
      ctx.lineTo(G.RW-14.5, G.RH-7);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawChoices(ctx, t){
    ctx.fillStyle='rgba(4,6,14,0.6)';
    ctx.fillRect(0,0,G.RW,G.RH);
    var lay = choiceLayout();
    txt(ctx, '— 你的抉择 —', G.RW/2, lay[0].y-16, 9, '#a8b0cc', 'center');
    for(var i=0;i<choices.length;i++){
      var c = choices[i], r = lay[i];
      ctx.fillStyle = 'rgba(14,18,36,0.96)';
      rr(ctx, r.x, r.y, r.w, r.h, 4); ctx.fill();
      ctx.strokeStyle = '#5a6488'; ctx.lineWidth=1;
      rr(ctx, r.x+0.5, r.y+0.5, r.w-1, r.h-1, 4); ctx.stroke();
      ctx.fillStyle='#e8c15a';
      rr(ctx, r.x+4, r.y+4, 15, r.h-8, 2); ctx.fill();
      txt(ctx, ''+(i+1), r.x+11.5, r.y+7, 10, '#0c0e1a', 'center', true);
      txt(ctx, c.label, r.x+25, r.y+7, 10, '#e4e7f0');
    }
  }

  return {
    say:say, line:line, ask:ask, choose:choose,
    tap:tap, key:key, update:update, draw:draw,
    isActive: function(){ return active; },
    getLog: function(){ return log; }
  };
})();
