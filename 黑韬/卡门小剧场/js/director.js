'use strict';
/* ============================================================
   director.js — 导演层
   字幕 / 标题卡 / 场铭 / 幕布调度 / 谢幕字幕 + 演出DSL
   ============================================================ */
var Director = (function(){
  var A = Actors, T = Theater;

  /* 当前字幕 */
  var sub = null;      // {speaker,color,zh,fr,t,dur,fadeIn,fadeOut}
  var card = null;     // {title,sub,t,dur}
  var stamp = null;    // {text,t,dur} 场铭(左下角)
  var credits = null;  // {t, lines}
  var fin = null;      // {t}

  var VOICES = {
    carmen:    { name:'卡门',        color:'#ff7a94' },
    carmen3:   { name:'卡门',        color:'#ff7a94' },
    jose:      { name:'唐·何塞',    color:'#8ab4ff' },
    jose3:     { name:'唐·何塞',    color:'#8ab4ff' },
    escamillo: { name:'埃斯卡米略',  color:'#ffd24a' },
    zuniga:    { name:'祖尼加队长',  color:'#9ad0a8' },
    chorus:    { name:'众人',        color:'#d0c8e0' },
    girls:     { name:'烟厂女工们',  color:'#e8a8c8' },
    frasquita: { name:'弗拉斯基塔',  color:'#e8b070' },
    narrator:  { name:'',            color:'#c8b890' }
  };

  /* ============================================================
     黑边 / 淡入出 (2D覆盖幕布已由 Sets 3D 幕布取代)
     ============================================================ */
  var _lb = 0;
  function letterboxTo(v, dur){
    var t=0, f=_lb;
    T.animate(function(dt){
      t += dt/(dur||1.2);
      if(t>=1){ _lb=v; GFX.setLetterbox(v); return true; }
      _lb = lerp(f, v, easeInOut(t));
      GFX.setLetterbox(_lb);
      return false;
    });
  }

  /* ============================================================
     演出 DSL — 全部返回 script step
     ============================================================ */
  var D = {};

  /* --- 字幕: 阻塞至展示完毕 --- */
  D.sub = function(who, zh, fr, dur){
    return function(next){
      var v = VOICES[who]||VOICES.narrator;
      dur = dur || Math.max(2.2, 1.1 + zh.length*0.16);
      sub = { speaker:v.name, color:v.color, zh:zh, fr:fr||'', t:0, dur:dur };
      Sched.to(function(){ sub=null; next(); }, dur*1000);
    };
  };
  /* --- 字幕: 非阻塞(唱段时旁挂) --- */
  D.subBg = function(who, zh, fr, dur){
    return call(function(){
      var v = VOICES[who]||VOICES.narrator;
      dur = dur || Math.max(2.2, 1.1 + zh.length*0.16);
      sub = { speaker:v.name, color:v.color, zh:zh, fr:fr||'', t:0, dur:dur };
      Sched.to(function(){
        if(sub && sub.zh===zh) sub=null;
      }, dur*1000);
    });
  };

  /* --- 标题卡 --- */
  D.card = function(title, subText, dur){
    return function(next){
      card = { title:title, sub:subText||'', t:0, dur:dur||3.6 };
      Sched.to(function(){ card=null; next(); }, (dur||3.6)*1000);
    };
  };
  /* --- 场铭 (角落浮现) --- */
  D.stamp = function(text, dur){
    return call(function(){
      stamp = { text:text, t:0, dur:dur||4 };
      Sched.to(function(){ stamp=null; }, (dur||4)*1000);
    });
  };

  /* --- 幕布 --- */
  D.curtainOpen = function(dur){ return function(next){ Sets.setCurtain(1, dur||2.6, next); }; };
  D.curtainClose = function(dur){ return function(next){ Sets.setCurtain(0, dur||2.2, next); }; };

  /* --- 画面 --- */
  D.fade = function(v, speed){ return call(function(){ GFX.fadeTo(v, speed||1.2); }); };
  D.fadeWait = function(v, speed){
    return seq(D.fade(v,speed), wait(1/(speed||1.2)+0.1));
  };
  D.letterbox = function(v, dur){ return call(function(){ letterboxTo(v, dur); }); };
  D.iris = function(v, dur){
    return function(next){
      var f = _iris, t=0;
      T.animate(function(dt){
        t += dt/(dur||1.4);
        if(t>=1){ _iris=v; GFX.setIris(v); next(); return true; }
        _iris = lerp(f, v, easeInOut(t));
        GFX.setIris(_iris);
        return false;
      });
    };
  };
  var _iris = 1;
  D.flash = function(c,a){ return call(function(){ GFX.flash(c,a); }); };
  D.shake = function(amp,dur){ return call(function(){ GFX.shake(amp,dur); }); };
  D.grade = function(a,b){ return call(function(){ GFX.setGrade(a,b,0); }); };

  /* --- 摄影机 --- */
  D.shot = function(o){ return call(function(){ T.shot(o); }); };
  D.shotWait = function(o){
    return seq(call(function(){ T.shot(o); }), wait(o.dur||0));
  };

  /* --- 灯光 --- */
  D.mood = function(o, dur){ return call(function(){ T.mood(o, dur); }); };
  D.spot = function(which, o){ return call(function(){ T.spot(which, o); }); };

  /* --- 声音 --- */
  D.music = function(id, opts){ return call(function(){ AudioSys.playMusic(id, opts); }); };
  D.stopMusic = function(fade){ return call(function(){ AudioSys.stopMusic(fade); }); };
  D.musicVol = function(v, ramp){ return call(function(){ AudioSys.musicVol(v, ramp); }); };
  D.muffle = function(on, freq){ return call(function(){ AudioSys.setMuffle(on, freq); }); };
  D.sfx = function(name){ return call(function(){ if(AudioSys.sfx[name]) AudioSys.sfx[name](); }); };

  /* --- 表演 --- */
  D.pose = function(actorName, pose, instant){
    return call(function(){ A.setPose(A.actorOf(actorName), pose, instant); });
  };
  D.walk = function(actorName, x, opts){
    return function(next){ A.walkTo(A.actorOf(actorName), x, opts||{}, next); };
  };
  D.walkBg = function(actorName, x, opts){
    return call(function(){ A.walkTo(A.actorOf(actorName), x, opts||{}); });
  };
  D.face = function(actorName, dir, dur){
    return call(function(){ A.face(A.actorOf(actorName), dir, dur); });
  };
  D.head = function(actorName, yaw, tilt){
    return call(function(){ A.headTo(A.actorOf(actorName), yaw, tilt); });
  };
  D.emote = function(actorName, type, opts){
    return call(function(){ A.emote(A.actorOf(actorName), type, opts); });
  };
  D.move = function(actorName, to, dur, ease){
    return call(function(){ T.tweenPos(A.actorOf(actorName).root, to, dur, ease); });
  };
  D.moveWait = function(actorName, to, dur, ease){
    return function(next){ T.tweenPos(A.actorOf(actorName).root, to, dur, ease, next); };
  };
  D.put = function(actorName, x, y, z, faceDir){
    return call(function(){
      var a = A.actorOf(actorName);
      a.root.position.set(x,y,z);
      if(faceDir!==undefined)
        a.root.rotation.y = faceDir===0?0:(faceDir==='back'?Math.PI:(faceDir>0?Math.PI/2:-Math.PI/2));
    });
  };
  D.show = function(actorName, vis){
    return call(function(){ A.actorOf(actorName).root.visible = vis===undefined?true:vis; });
  };

  /* ============================================================
     谢幕
     ============================================================ */
  D.finCard = function(){
    return call(function(){ fin = {t:0}; });
  };
  D.credits = function(lines){
    return call(function(){ credits = {t:0, lines:lines}; });
  };

  /* ============================================================
     每帧绘制 (在 GFX.compose 之后)
     ============================================================ */
  function draw(dt){
    var ctx = GFX.ctx();
    if(sub){
      sub.t += dt;
      var a = sub.t<0.25 ? sub.t/0.25 : (sub.t>sub.dur-0.35 ? Math.max(0,(sub.dur-sub.t)/0.35) : 1);
      ctx.globalAlpha = clamp01(a);
      GFX.drawSubtitle({zh:sub.zh, fr:sub.fr}, {speaker:sub.speaker, color:sub.color});
      ctx.globalAlpha = 1;
    }
    if(card){
      card.t += dt;
      var ca = card.t<0.7 ? card.t/0.7 : (card.t>card.dur-0.7 ? Math.max(0,(card.dur-card.t)/0.7) : 1);
      GFX.drawCard(card.title, card.sub, ca);
    }
    if(stamp){
      stamp.t += dt;
      var sa = stamp.t<0.5 ? stamp.t/0.5 : (stamp.t>stamp.dur-0.5 ? Math.max(0,(stamp.dur-stamp.t)/0.5):1);
      ctx.globalAlpha = clamp01(sa);
      ctx.fillStyle='rgba(4,3,10,0.72)';
      var tw = stamp.text.length*10+18;
      ctx.fillRect(10, 12, tw, 17);
      ctx.fillStyle='#af8a4a';
      ctx.fillRect(10, 12, 2, 17);
      txt(ctx, stamp.text, 18, 16, 9, '#e8d8b0', 'left', false);
      ctx.globalAlpha = 1;
    }
    if(fin){
      fin.t += dt;
      var fa = clamp01(fin.t/2.4);
      ctx.globalAlpha = fa;
      txtOutline(ctx, 'F I N', G.RW/2, G.RH/2-30, 26, '#e8c87a', '#20060a', 'center', true, FONT_SERIF);
      txt(ctx, '卡门 — 全剧终', G.RW/2, G.RH/2+8, 10, '#a08898', 'center');
      if(fin.t>2){
        var ba = clamp01((fin.t-2)/1);
        ctx.globalAlpha = fa*ba*(0.6+Math.sin(fin.t*2.4)*0.4);
        txt(ctx, '— 点击落幕 · R 重新开演 —', G.RW/2, G.RH-30, 8, '#7a6888', 'center');
      }
      ctx.globalAlpha = 1;
    }
    if(credits){
      credits.t += dt;
      var y0 = G.RH - credits.t*12;
      for(var i=0;i<credits.lines.length;i++){
        var ln = credits.lines[i];
        var y = y0 + i*16;
        if(y<-20 || y>G.RH+10) continue;
        var alpha = 1;
        if(y<30) alpha = clamp01((y-6)/24);
        if(y>G.RH-40) alpha = clamp01((G.RH-10-y)/30);
        ctx.globalAlpha = clamp01(alpha);
        if(ln.h) txt(ctx, ln.t, G.RW/2, y, 10, '#e8c87a', 'center', true, FONT_SERIF);
        else txt(ctx, ln.t, G.RW/2, y, 8.5, '#c0b0c8', 'center');
        ctx.globalAlpha = 1;
      }
    }
  }

  function reset(){
    sub=null; card=null; stamp=null; credits=null; fin=null;
    _lb=0; GFX.setLetterbox(0);
    _iris=1; GFX.setIris(1);
  }

  return { D:D, draw:draw, reset:reset, VOICES:VOICES };
})();
