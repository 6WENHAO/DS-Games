'use strict';
/* ============================================================
   audio.js — WebAudio 芯片音源: 音序器配乐 + 音效库
   ============================================================ */
var AudioSys = (function(){
  var ctx=null, master, musicGain, sfxGain, ghostFilter, ghostOn=false;
  var ready=false;
  var curTrack=null, seqTimer=null, stepIdx=0;

  function init(){
    if(ready) return;
    try{
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value=0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value=0.42; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value=0.6; sfxGain.connect(master);
      ghostFilter = ctx.createBiquadFilter();
      ghostFilter.type='lowpass'; ghostFilter.frequency.value=720; ghostFilter.Q.value=2;
      ready=true;
    }catch(e){}
  }
  function resume(){ if(ctx && ctx.state==='suspended') ctx.resume(); }

  function note(freq, dur, type, vol, dest, when, glideTo){
    if(!ready) return;
    var t = ctx.currentTime + (when||0);
    var o = ctx.createOscillator(); o.type = type||'square';
    o.frequency.setValueAtTime(freq, t);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t+dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol||0.08, t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(dest||sfxGain);
    o.start(t); o.stop(t+dur+0.05);
  }
  function noise(dur, vol, dest, when, hp){
    if(!ready) return;
    var t = ctx.currentTime + (when||0);
    var len = Math.max(1, Math.floor(ctx.sampleRate*dur));
    var buf = ctx.createBuffer(1,len,ctx.sampleRate);
    var d = buf.getChannelData(0);
    for(var i=0;i<len;i++) d[i]=Math.random()*2-1;
    var src=ctx.createBufferSource(); src.buffer=buf;
    var g=ctx.createGain();
    g.gain.setValueAtTime(vol||0.1,t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    var f=ctx.createBiquadFilter();
    f.type = hp?'highpass':'lowpass';
    f.frequency.value = hp||3000;
    src.connect(f); f.connect(g); g.connect(dest||sfxGain);
    src.start(t);
  }

  /* ---------- 音序器 ----------
     N = 音名转频率 */
  var SEMI = {C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
  function N(name){
    if(!name) return 0;
    var m = /^([A-G]#?)(-?\d)$/.exec(name);
    if(!m) return 0;
    return 440 * Math.pow(2,(SEMI[m[1]] - 9 + (parseInt(m[2],10)-4)*12)/12);
  }

  /* 每个 track: {bpm, bass[], lead[], pad[], perc[]} 16步循环
     '' = 休止 */
  var TRACKS = {
    /* 序章 / 案发地 — 阴郁华尔兹感 */
    grey: {
      bpm: 92,
      bass: ['A1','','','A1','','','E2','','A1','','','G1','','','E1',''],
      lead: ['','A3','C4','','E4','','D4','','','C4','','B3','','G3','','E3'],
      pad:  [['A2','C3','E3'],'','','','','','','',['F2','A2','C3'],'','','','','','',''],
      perc: ['k','','h','','s','','h','','k','','h','k','s','','h','h'],
      leadType:'triangle', leadVol:0.05, bassVol:0.07
    },
    /* 幽灵界 — 漂浮无重力 */
    ghost: {
      bpm: 70,
      bass: ['D2','','','','','','','','C2','','','','','','',''],
      lead: ['','D4','','F4','','A4','','G4','','','E4','','C4','','D4',''],
      pad:  [['D3','F3','A3'],'','','','','','','',['C3','E3','G3'],'','','','','','',''],
      perc: ['','','','','','','','','','','','','','','',''],
      leadType:'sine', leadVol:0.045, bassVol:0.05
    },
    /* 危机 / 倒计时 */
    tense: {
      bpm: 132,
      bass: ['C2','C2','','C2','','C2','D#2','','C2','C2','','C2','','G1','G#1',''],
      lead: ['','','G4','','','F4','','D#4','','','G4','','G#4','','G4','F4'],
      pad:  [['C3','D#3','G3'],'','','','','','','',['G#2','C3','D#3'],'','','','','','',''],
      perc: ['k','','h','k','s','','h','','k','k','h','','s','','h','s'],
      leadType:'square', leadVol:0.04, bassVol:0.08
    },
    /* 酒吧 — 破碎迪斯科 */
    disco: {
      bpm: 108,
      bass: ['E2','','E2','','G2','','A2','','E2','','E2','','D2','','B1',''],
      lead: ['','B3','','E4','','','F#4','G4','','','E4','','B3','','A3',''],
      pad:  [['E3','G3','B3'],'','','','','','','',['D3','F#3','A3'],'','','','','','',''],
      perc: ['k','h','h','k','s','h','h','h','k','h','k','h','s','h','h','h'],
      leadType:'sawtooth', leadVol:0.028, bassVol:0.075
    },
    /* 奇观 — 静波 */
    wonder: {
      bpm: 60,
      bass: ['F1','','','','','','','','C2','','','','','','',''],
      lead: ['','F4','A4','C5','','A4','','E5','','D5','','C5','','A4','G4',''],
      pad:  [['F2','A2','C3'],'','','','',['G2','A#2','D3'],'','',['A2','C3','E3'],'','','',['C3','E3','G3'],'','',''],
      perc: ['','','','','','','','','','','','','','','',''],
      leadType:'sine', leadVol:0.055, bassVol:0.045
    },
    /* 终章 / 安魂 */
    requiem: {
      bpm: 76,
      bass: ['A1','','','','F1','','','','G1','','','','A1','','E1',''],
      lead: ['','E4','','C4','','D4','','A3','','B3','','C4','','B3','A3',''],
      pad:  [['A2','C3','E3'],'','','',['F2','A2','C3'],'','','',['G2','B2','D3'],'','','',['A2','C3','E3'],'','',''],
      perc: ['','','','','','','','','','','','','','','',''],
      leadType:'triangle', leadVol:0.05, bassVol:0.06
    }
  };

  function perc(kind, when){
    if(kind==='k'){ note(90,0.1,'sine',0.11,musicGain,when,45); }
    else if(kind==='s'){ noise(0.09,0.05,musicGain,when,1800); }
    else if(kind==='h'){ noise(0.03,0.022,musicGain,when,7000); }
  }

  function playMusic(id){
    if(curTrack===id) return;
    stopMusic();
    var tr = TRACKS[id]; if(!tr || !ready){ curTrack=id; return; }
    curTrack=id; stepIdx=0;
    var stepDur = 60/tr.bpm/2;
    seqTimer = setInterval(function(){
      if(!ready) return;
      var s = stepIdx%16;
      var b = tr.bass[s]; if(b) note(N(b), stepDur*1.8, 'triangle', tr.bassVol, musicGain);
      var l = tr.lead[s]; if(l) note(N(l), stepDur*1.6, tr.leadType, tr.leadVol, musicGain);
      var p = tr.pad[s];
      if(p && p.length) for(var i=0;i<p.length;i++) note(N(p[i]), stepDur*7, 'sine', 0.022, musicGain);
      var pc = tr.perc[s]; if(pc) perc(pc, 0);
      stepIdx++;
    }, stepDur*1000);
  }
  function stopMusic(){
    if(seqTimer){ clearInterval(seqTimer); seqTimer=null; }
    curTrack=null;
  }

  function setGhostAudio(on){
    if(!ready || ghostOn===on) return;
    ghostOn=on;
    try{
      musicGain.disconnect(); sfxGain.disconnect();
      if(on){
        musicGain.connect(ghostFilter); sfxGain.connect(ghostFilter);
        ghostFilter.connect(master);
      }else{
        ghostFilter.disconnect();
        musicGain.connect(master); sfxGain.connect(master);
      }
    }catch(e){}
  }

  /* ---------- SFX ---------- */
  var S = {
    possess: function(){ note(220,0.12,'sine',0.07,null,0,880); note(660,0.18,'triangle',0.05,null,0.05,1320); },
    unpossess: function(){ note(880,0.15,'sine',0.06,null,0,220); },
    travel: function(){ note(330,0.08,'sine',0.05,null,0,660); note(660,0.1,'triangle',0.04,null,0.06,990); },
    hop: function(){ note(500,0.06,'square',0.035,null,0,700); },
    trick: function(){ note(784,0.06,'square',0.07); note(1175,0.08,'square',0.08,null,0.05); },
    denied: function(){ note(220,0.1,'square',0.06); note(196,0.15,'square',0.05,null,0.08); },
    click: function(){ note(1500,0.02,'square',0.04); },
    blip: function(){ note(2200,0.015,'square',0.028); },
    type: function(){ note(1800+Math.random()*600,0.012,'square',0.014); },
    bell: function(){ note(1568,0.25,'triangle',0.1); note(2093,0.35,'sine',0.06,null,0.02); },
    phone: function(){ for(var i=0;i<4;i++){ note(880,0.06,'square',0.05,null,i*0.09); note(660,0.06,'square',0.05,null,i*0.09+0.045);} },
    shot: function(){ noise(0.18,0.3,null,0,900); note(70,0.25,'sawtooth',0.22,null,0,40); },
    thunder: function(){ noise(1.2,0.1,null,0,300); note(45,0.8,'sawtooth',0.07,null,0,28); },
    crash: function(){ noise(0.5,0.28,null,0,700); note(50,0.4,'sawtooth',0.18,null,0,30); },
    drop: function(){ note(120,0.3,'triangle',0.14,null,0,50); noise(0.25,0.12,null,0.05,500); },
    splash: function(){ noise(0.4,0.12,null,0,1400); note(300,0.3,'sine',0.05,null,0,90); },
    creak: function(){ note(160,0.4,'sawtooth',0.03,null,0,120); },
    dead: function(){ note(220,0.5,'sawtooth',0.1,null,0,80); note(110,0.9,'sawtooth',0.08,null,0.3,40); },
    rewind: function(){ for(var i=0;i<14;i++) note(200+i*90,0.05,'square',0.035,null,i*0.07); note(80,1.4,'sawtooth',0.08,null,0,320); },
    win: function(){ note(523,0.12,'square',0.07); note(659,0.12,'square',0.07,null,0.11); note(784,0.14,'square',0.08,null,0.22); note(1047,0.3,'triangle',0.09,null,0.33); },
    fate: function(){ note(392,0.5,'triangle',0.09,null,0,196); note(196,0.8,'triangle',0.07,null,0.2); },
    dice: function(){ for(var i=0;i<6;i++) note(600+Math.random()*900,0.025,'square',0.035,null,i*0.05); },
    checkPass: function(){ note(587,0.1,'square',0.07); note(880,0.14,'square',0.08,null,0.09); note(1175,0.2,'triangle',0.08,null,0.18); },
    checkFail: function(){ note(311,0.12,'square',0.07); note(233,0.16,'square',0.06,null,0.1); note(155,0.3,'sawtooth',0.06,null,0.2); },
    thought: function(){ note(1047,0.1,'sine',0.05); note(1319,0.12,'sine',0.05,null,0.08); note(1568,0.25,'sine',0.06,null,0.16); },
    heart: function(){ note(55,0.1,'sine',0.14); note(50,0.12,'sine',0.12,null,0.16); },
    wave: function(){ note(90,2.2,'sine',0.06,null,0,45); noise(1.8,0.02,null,0,400); },
    door: function(){ note(140,0.15,'square',0.05,null,0,90); noise(0.08,0.05,null,0.03,600); },
    glass: function(){ for(var i=0;i<5;i++) note(2000+Math.random()*1800,0.08,'triangle',0.04,null,i*0.03); noise(0.12,0.09,null,0,4000); },
    swing: function(){ noise(0.12,0.04,null,0,2000); note(180,0.12,'sine',0.03,null,0,300); },
    cat: function(){ note(700,0.12,'sawtooth',0.035,null,0,1000); note(900,0.1,'sawtooth',0.03,null,0.12,600); },
    jukebox: function(){ // 点唱机: 响亮的老船歌片段 + 低音
      var mel=[392,494,587,784,659,587,494,587];
      for(var i=0;i<mel.length;i++) note(mel[i],0.18,'square',0.1,null,i*0.14);
      for(var j=0;j<4;j++) note(98,0.42,'triangle',0.1,null,j*0.28);
      noise(0.08,0.07,null,0,1800);
    },
    radioStatic: function(){ noise(0.35,0.05,null,0,2500); },

    /* ---- 演出强化音效 ---- */
    bellToll: function(){ // 青铜大钟·三连响 (基音+泛音列, 长衰减)
      for(var i=0;i<3;i++){
        var d=i*1.05;
        note(196,2.6,'sine',0.18,null,d);
        note(392,2.0,'triangle',0.1,null,d);
        note(588,1.4,'sine',0.055,null,d+0.01);
        note(784,0.9,'sine',0.035,null,d+0.02);
        note(988,0.5,'sine',0.02,null,d+0.03);
        noise(0.05,0.08,null,d,2200);
      }
    },
    sting: function(){ // 重要节点·戏剧重音
      note(110,0.6,'sawtooth',0.13,null,0,55);
      note(220,0.45,'square',0.08,null,0.02);
      note(440,0.3,'square',0.05,null,0.06);
      noise(0.18,0.12,null,0,500);
    },
    shock: function(){ // "!" 急促双音
      note(1245,0.07,'square',0.1);
      note(830,0.14,'square',0.1,null,0.07);
    },
    question: function(){ // "?" 上扬
      note(660,0.09,'square',0.06,null,0,880);
      note(990,0.14,'square',0.05,null,0.1,1320);
    },
    sweat: function(){ note(520,0.12,'sine',0.05,null,0,240); },
    anger: function(){ for(var i=0;i<3;i++) note(150+i*14,0.07,'sawtooth',0.08,null,i*0.07); },
    noteJingle: function(){ note(1047,0.09,'square',0.05); note(1319,0.16,'square',0.05,null,0.1); },
    riser: function(){ // 上升情绪 (揭示/奇观)
      for(var i=0;i<12;i++) note(196*Math.pow(2,i/12),0.14,'triangle',0.035,null,i*0.07);
    },
    thud: function(){ note(70,0.2,'sine',0.18,null,0,38); noise(0.09,0.09,null,0,320); },
    whoosh: function(){ noise(0.28,0.08,null,0,1300); note(240,0.22,'sine',0.04,null,0,90); },
    drip: function(){ note(1400,0.06,'sine',0.05,null,0,700); note(1100,0.08,'sine',0.04,null,0.16,520); }
  };

  return {
    init:init, resume:resume,
    playMusic:playMusic, stopMusic:stopMusic,
    setGhostAudio:setGhostAudio,
    sfx:S
  };
})();
