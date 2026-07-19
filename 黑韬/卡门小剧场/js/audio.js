'use strict';
/* ============================================================
   audio.js — WebAudio 芯片管弦乐团
   前瞻式音序器(支持速度渐变/颤音/回声) + 《卡门》六首配乐 + 音效库
   ============================================================ */
var AudioSys = (function(){
  var ctx=null, master, musicBus, muffle, sfxGain, echoIn, ready=false;
  var muted=false;

  function init(){
    if(ready) return;
    try{
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value=0.55; master.connect(ctx.destination);
      muffle = ctx.createBiquadFilter();
      muffle.type='lowpass'; muffle.frequency.value=19000; muffle.Q.value=0.4;
      muffle.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value=0.5; musicBus.connect(muffle);
      sfxGain = ctx.createGain(); sfxGain.gain.value=0.62; sfxGain.connect(master);
      /* 剧场空间回声 */
      echoIn = ctx.createGain(); echoIn.gain.value=1;
      var dly = ctx.createDelay(1.2); dly.delayTime.value=0.27;
      var fb = ctx.createGain(); fb.gain.value=0.30;
      var lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2300;
      var wet = ctx.createGain(); wet.gain.value=0.16;
      echoIn.connect(dly); dly.connect(lp); lp.connect(fb); fb.connect(dly);
      lp.connect(wet); wet.connect(musicBus);
      ready=true;
    }catch(e){}
  }
  function resume(){ if(ctx && ctx.state==='suspended') ctx.resume(); }
  function setMuted(m){
    muted=m;
    if(master) master.gain.setTargetAtTime(m?0:0.55, ctx.currentTime, 0.05);
  }

  /* ---------- 基础音源 ---------- */
  function note(freq, dur, type, vol, dest, when, glideTo, vib){
    if(!ready || !freq) return;
    var t = ctx.currentTime + (when||0);
    var o = ctx.createOscillator(); o.type = type||'square';
    o.frequency.setValueAtTime(freq, t);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t+dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol||0.08, t+0.012);
    g.gain.setValueAtTime(vol||0.08, t+Math.max(0.012, dur*0.62));
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(dest||sfxGain);
    if(vib && dur>0.16){ /* 歌唱颤音 */
      var lfo = ctx.createOscillator(); lfo.type='sine'; lfo.frequency.value=5.3;
      var lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(freq*0.013, t+0.18);
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t+dur+0.05);
    }
    o.start(t); o.stop(t+dur+0.06);
  }
  function noise(dur, vol, dest, when, freq, hp){
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
    f.frequency.value = freq||3000;
    src.connect(f); f.connect(g); g.connect(dest||sfxGain);
    src.start(t);
  }

  /* ---------- 音名 ---------- */
  var SEMI = {C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
  function N(name){
    if(typeof name==='number') return name;
    if(!name || name==='r') return 0;
    var m = /^([A-G][#b]?)(-?\d)$/.exec(name);
    if(!m) return 0;
    return 440 * Math.pow(2,(SEMI[m[1]] - 9 + (parseInt(m[2],10)-4)*12)/12);
  }
  /* 音符序列移调(半音) → 频率数值序列 */
  function T(notes, st){
    var k = Math.pow(2, st/12), out=[];
    for(var i=0;i<notes.length;i++){
      var n=notes[i][0], d=notes[i][1];
      if(n==='r'||!n){ out.push(['r',d]); continue; }
      if(n instanceof Array){
        var ch=[]; for(var j=0;j<n.length;j++) ch.push(N(n[j])*k);
        out.push([ch,d]);
      } else out.push([N(n)*k, d]);
    }
    return out;
  }
  function rep(arr, times){
    var out=[];
    for(var i=0;i<times;i++) out=out.concat(arr);
    return out;
  }
  function srep(s, times){ var o=''; for(var i=0;i<times;i++)o+=s; return o; }

  /* ---------- 打击乐 ---------- */
  function perc(kind, when, vol){
    var v = vol||1;
    if(kind==='k'){ note(85,0.1,'sine',0.1*v,musicBus,when,42); }
    else if(kind==='s'){ noise(0.1,0.05*v,musicBus,when,1900); }
    else if(kind==='h'){ noise(0.03,0.02*v,musicBus,when,7000,true); }
    else if(kind==='c'){ /* 击掌 palmas */
      noise(0.045,0.075*v,musicBus,when,1500,true);
      noise(0.05,0.05*v,musicBus,(when||0)+0.025,1200,true);
    }
    else if(kind==='t'){ /* 铃鼓 */
      noise(0.06,0.04*v,musicBus,when,6300,true);
      note(4200,0.03,'square',0.014*v,musicBus,when);
      note(5600,0.04,'square',0.01*v,musicBus,(when||0)+0.02);
    }
    else if(kind==='x'){ /* 响板 */
      noise(0.022,0.05*v,musicBus,when,2600,true);
      note(2350,0.018,'square',0.03*v,musicBus,when);
    }
    else if(kind==='T'){ /* 定音鼓 D */
      note(73.4,0.5,'sine',0.14*v,musicBus,when,58);
      noise(0.06,0.03*v,musicBus,when,400);
    }
    else if(kind==='S'){ /* 镲 */
      noise(0.8,0.08*v,musicBus,when,5200,true);
      noise(0.4,0.05*v,musicBus,when,2600,true);
    }
  }

  /* ============================================================
     曲库 — 每轨: {wave, vol, vib, oct, notes:[[音名|频率|和弦, 16分步数],...]}
     ============================================================ */
  /* ---------- 哈巴涅拉低音型 (16分网格, 每小节8步) ----------
     核对版: D2(八分,断奏) 十六休止 A2(十六,连向) F3(八分) A2(八分) */
  var BD  = [['D2',2],['r',1],['A2',1],['F3',2],['A2',2]];   // Dm
  var BDj = [['D2',2],['r',1],['A2',1],['F#3',2],['A2',2]];  // D大调
  var BG  = [['G1',2],['r',1],['D2',1],['Bb2',2],['D2',2]];  // Gm
  var BA  = [['A1',2],['r',1],['E2',1],['C#3',2],['E2',2]];  // A7
  var cDm=['D3','F3','A3'], cA7=['A2','C#3','G3'], cDj=['D3','F#3','A3'],
      cG=['G2','B2','D3'], cGm=['G2','Bb2','D3'],
      cEm=['E3','G3','B3'], cB7=['B2','D#3','A3'],
      cF=['F3','A3','C4'], cC7=['C3','E3','Bb3'], cBb=['Bb2','D3','F3'];

  /* ---------- 哈巴涅拉声乐旋律 (核对版誊写, bars 4-12) ----------
     32分网格(track以双倍bpm运行): 八分=4步 十六分=2步
     三连音(八分×3占一拍)=3+3+2  三连音(十六×3占半拍)=1+1+2 */
  var HB4  = [['r',8],['D5',4],['C#5',4]];                                  /* L'a-mour */
  var HB5  = [['C5',3],['C5',3],['C5',2],['B4',4],['Bb4',4]];               /* est un oi-seau re- */
  var HB6  = [['A4',4],['A4',2],['A4',2],['G#4',4],['G4',4]];               /* bel-le Que nul ne */
  var HB7  = [['F4',1],['G4',1],['F4',2],['E4',2],['F4',2],['G4',4],['F4',4]]; /* peut(F-G-F) ap- pri-voi- */
  var HB8  = [['E4',4],['r',4],['D5',4],['C#5',4]];                         /* ser, — Et c'est */
  var HB10 = [['A4',2],['A4',2],['r',2],['A4',2],['G4',4],['F4',4]];        /* pel-le, s'il lui con- */
  var HB11 = [['E4',1],['F4',1],['E4',2],['D4',2],['E4',2],['F4',4],['E4',4]]; /* vient(E-F-E) de re-fu- */
  var HB12 = [['D4',8],['D5',4],['C#5',4]];                                 /* ser! Rien n'y */
  /* 段落: V1 = bars4-12, V2 = bars5-12(接bar12弱起) */
  var HB_V1 = HB4.concat(HB5, HB6, HB7, HB8, HB5, HB10, HB11, HB12);
  var HB_V2 = HB5.concat(HB6, HB7, HB8, HB5, HB10, HB11, HB12);
  var HB_TAG = [['C5',3],['C5',3],['C5',2],['B4',4],['Bb4',4],
                ['A4',8],['r',8]];
  /* 核对版低音固定音型 (32分网格, 断奏加缝隙) */
  var HB_OST = [['D2',3],['r',3],['A2',2],['F3',3],['r',1],['A2',3],['r',1]];

  /* 斗牛士副歌 (F大调) — 8小节主旋律 */
  var TORE_REFRAIN = [
    ['C5',6],['A4',2],['F4',4],['F4',4],
    ['G4',4],['A4',4],['Bb4',4],['A4',4],
    ['F4',12],['r',4],
    ['G4',6],['G4',2],['E4',4],['E4',4],
    ['F4',4],['G4',4],['A4',4],['G4',4],
    ['C5',12],['r',4],
    ['C5',6],['A4',2],['F4',4],['F4',4],
    ['Bb4',4],['A4',4],['G4',2],['C5',2],['F4',4]
  ];
  var TORE_P1 = [ /* 前四小节 (远处飘来用) */
    ['C5',6],['A4',2],['F4',4],['F4',4],
    ['G4',4],['A4',4],['Bb4',4],['A4',4],
    ['F4',12],['r',4],
    ['G4',6],['G4',2],['E4',4],['E4',4]
  ];
  function marchBass(rt, ft){ /* 一小节进行曲低音 */
    return [[rt,2],['r',2],[ft,2],['r',2],[rt,2],['r',2],[ft,2],['r',2]];
  }
  function stab(ch){ /* 一小节铜管和弦刺音(2、4拍) */
    return [['r',4],[ch,3],['r',1],['r',4],[ch,3],['r',1]];
  }
  function waltz(rt, ft, ot){ return [[rt,4],[ft,4],[ot,4]]; }
  function gpad(ch){ return [['r',4],[ch,3],['r',1],[ch,3],['r',1]]; }

  var SONGS = {
    /* ======== 序曲(标题) — 悬置的宿命 ======== */
    overture: {
      bpm: 76, loop:true,
      channels: [
        { wave:'square', vol:0.042, vib:true, notes:[
            ['r',16],
            ['D5',10],['r',2],['C#5',10],['r',2],
            ['Bb4',10],['r',2],['A4',16],['r',4],
            ['C5',1],['C5',1],['C5',2],['B4',2],['Bb4',2],
            ['A4',2],['A4',1],['A4',1],['G#4',2],['G4',2],['A4',8]
        ]},
        { wave:'triangle', vol:0.075, notes:
            rep(BD,4).concat(rep(BG,2), rep(BA,2), rep(BD,2), rep(BA,1), rep(BD,1)) },
        { wave:'sine', vol:0.02, notes:[
            [cDm,32],[cGm,16],[cA7,16],[cDm,32]
        ]}
      ],
      perc: srep('........',12)
    },

    /* ======== 哈巴涅拉 — 爱情是一只不羁的鸟 ========
       D小调 2/4 ♩=72 — 核对版誊写 (bars 4-12 逐音)
       32分网格: bpm=144, 每小节16步
       结构: 前奏2 | 主歌9 | 主歌'8(低八度应和) | 尾声2 = 21小节 */
    habanera: {
      bpm: 144, loop:true,
      channels: [
        /* 卡门的歌声 */
        { wave:'square', vol:0.052, vib:true, notes:
            [['r',32]].concat(HB_V1, HB_V2, HB_TAG) },
        /* 第二段低八度应和 */
        { wave:'square', vol:0.015, notes:
            [['r',32],['r',144]].concat(T(HB_V2,-12), [['r',32]]) },
        /* 大提琴固定音型: D2·A2-F3·A2, 每小节重复, 断奏有弹性 */
        { wave:'triangle', vol:0.082, notes: rep(HB_OST, 21) },
        /* 弦乐持续和声 (全段 Dm 持续低音之上) */
        { wave:'sine', vol:0.016, notes: rep([[cDm,16]], 21) }
      ],
      /* 响板点舞步 (32分网格), 第二段加铃鼓 */
      perc: srep('x.....x.x...x...',2) + srep('x.....x.x...x...',9) +
            srep('t.....x.x...x...',8) + srep('x...............',2)
    },

    /* ======== 吉普赛之歌 — 酒馆狂舞(渐快) ======== */
    gypsy: {
      bpm: 92, bpmEnd: 176, loop:true,
      channels: [
        { wave:'square', vol:0.05, vib:true, notes:[
            ['r',24],
            /* 主题A */
            ['E5',2],['r',1],['E5',2],['r',1],['E5',2],['D#5',2],['E5',2],
            ['F#5',2],['E5',2],['D#5',2],['E5',6],
            ['G5',2],['r',1],['G5',2],['r',1],['G5',2],['F#5',2],['G5',2],
            ['A5',2],['G5',2],['F#5',2],['G5',6],
            ['B4',2],['E5',2],['G5',2],['F#5',2],['E5',2],['D#5',2],
            ['E5',4],['B4',4],['G4',4],
            ['F#4',2],['G4',2],['A4',2],['B4',2],['C5',2],['D#5',2],
            ['E5',8],['r',4],
            /* 主题A' 装饰变奏 */
            ['E5',1],['F#5',1],['E5',1],['r',1],['E5',2],['r',1],['E5',1],['D#5',2],['E5',2],
            ['F#5',1],['G5',1],['F#5',1],['E5',1],['D#5',2],['E5',4],['B4',2],
            ['G5',1],['A5',1],['G5',1],['r',1],['G5',2],['r',1],['G5',1],['F#5',2],['G5',2],
            ['A5',1],['B5',1],['A5',1],['G5',1],['F#5',2],['G5',4],['E5',2],
            ['B4',2],['E5',2],['G5',2],['B5',2],['A5',2],['G5',2],
            ['F#5',2],['E5',2],['D#5',2],['E5',2],['F#5',2],['G5',2],
            ['A5',2],['G5',2],['F#5',2],['E5',2],['D#5',2],['F#5',2],
            ['E5',8],['r',4],
            /* 终段冲刺 */
            ['E5',2],['F#5',2],['G5',2],['A5',2],['B5',4],
            ['C6',2],['B5',2],['A5',2],['G5',2],['F#5',2],['D#5',2],
            ['E5',1],['B4',1],['G4',1],['E4',1],['G4',1],['B4',1],['E5',1],['G5',1],['B5',1],['G5',1],['E5',1],['B4',1],
            ['E5',12]
        ]},
        { wave:'triangle', vol:0.085, notes:
            rep(waltz('E2','B2','E3'),2).concat(
              rep(waltz('E2','B2','E3'),6), rep(waltz('B2','F#3','B2'),1), rep(waltz('E2','B2','E3'),1),
              rep(waltz('E2','B2','E3'),6), rep(waltz('B2','F#3','B2'),1), rep(waltz('E2','B2','E3'),1),
              rep(waltz('E2','B2','E3'),1), rep(waltz('B2','F#3','B2'),1), rep(waltz('E2','B2','E3'),1),
              [ ['E2',12] ]) },
        { wave:'square', vol:0.016, notes:
            rep(gpad(cEm),2).concat(
              rep(gpad(cEm),6), rep(gpad(cB7),1), rep(gpad(cEm),1),
              rep(gpad(cEm),6), rep(gpad(cB7),1), rep(gpad(cEm),1),
              rep(gpad(cEm),1), rep(gpad(cB7),1), rep(gpad(cEm),1),
              [ [cEm,12] ]) }
      ],
      perc: srep('t...t...t...',2) + srep('t...c...c...',8) +
            srep('t.x.c.x.c.x.',8) + srep('t.x.cxx.cxx.',3) + 'S...........'
    },

    /* ======== 斗牛士之歌 ======== */
    toreador: {
      bpm: 116, loop:true,
      channels: [
        { wave:'square', vol:0.055, vib:true, notes:[
            ['r',32],
            /* 主歌(小调昂首) */
            ['C4',4],['F4',4],['G4',4],['Ab4',4],
            ['G4',4],['F4',4],['E4',4],['G4',4],
            ['C5',4],['Bb4',4],['Ab4',4],['G4',4],
            ['F4',6],['E4',2],['C4',8]
        ].concat(TORE_REFRAIN)},
        /* 低八度铜管齐奏 */
        { wave:'sawtooth', vol:0.02, notes:
            [ ['F3',2],['r',2],['F3',2],['r',2],['C4',2],['r',2],['C4',2],['r',2],
              ['F3',2],['r',2],['F3',2],['r',2],['C4',2],['r',2],['C4',2],['r',2],
              ['r',64] ].concat(T(TORE_REFRAIN,-12)) },
        { wave:'triangle', vol:0.08, notes:
            marchBass('F2','C3').concat(
              marchBass('F2','C3'),
              marchBass('F2','C3'), marchBass('C2','G2'), marchBass('F2','C3'), marchBass('F2','C3'),
              marchBass('F2','C3'), marchBass('Bb1','F2'), marchBass('F2','C3'), marchBass('C2','G2'),
              marchBass('F2','C3'), marchBass('C2','G2'), marchBass('F2','C3'), marchBass('F2','C3')) },
        { wave:'square', vol:0.015, notes:
            stab(cF).concat(
              stab(cF),
              stab(cF), stab(cC7), stab(cF), stab(cF),
              stab(cF), stab(cBb), stab(cF), stab(cC7),
              stab(cF), stab(cC7), stab(cF), stab(cF)) }
      ],
      perc: 'k...s.s.k...s.ss' + 'k.h.s.h.k.h.s.hh' +
            srep('k.h.s.h.k.h.s.h.',4) +
            'S.h.s.h.k.h.s.h.' + srep('k.h.s.h.k.h.s.h.',6) + 'k.h.s.h.k.k.s.ss'
    },

    /* ======== 斗牛场外 — 远处的狂欢与宿命 ======== */
    arena: {
      bpm: 84, loop:true,
      channels: [
        /* 场内远远飘来的斗牛士之歌 */
        { wave:'square', vol:0.02, notes:
            [['r',64]].concat(TORE_P1, [['r',64]], TORE_P1) },
        /* 宿命动机 */
        { wave:'sawtooth', vol:0.028, vib:true, notes:[
            ['r',128],
            ['D4',12],['r',4],['C#4',12],['r',4],
            ['Bb3',12],['r',4],['A3',16]
        ]},
        { wave:'sine', vol:0.024, notes:[
            [['D2','A2'],64],[['D2','A2'],64],[['G2','D3'],64],[['D2','A2'],64]
        ]}
      ],
      perc: srep('T...............',8) + srep('T.......T.......',4) + srep('T...T...T...T...',4)
    },

    /* ======== 安魂 — 破碎的哈巴涅拉 ======== */
    requiem: {
      bpm: 56, loop:true,
      channels: [
        { wave:'triangle', vol:0.05, vib:true, notes:[
            ['r',16],
            ['D5',2],['C#5',2],['r',4],
            ['C5',1],['C5',1],['C5',2],['B4',2],['Bb4',2],
            ['A4',2],['A4',1],['A4',1],['G#4',2],['G4',2],
            ['r',8],
            ['F4',2],['E4',2],['F4',2],['E4',2],
            ['D4',8],['r',8],
            ['A4',10],['r',6],
            ['D4',8]
        ]},
        { wave:'triangle', vol:0.06, notes:
            rep(BD,4).concat(rep(BG,2), rep(BA,2), rep(BD,4)) },
        { wave:'sine', vol:0.02, notes:[
            [cDm,32],[cGm,16],[cA7,16],[cDm,32]
        ]}
      ],
      perc: srep('........',12)
    }
  };

  /* ============================================================
     前瞻音序器
     ============================================================ */
  var seq = { song:null, id:null, step:0, total:0, nextT:0, timer:null, passes:0 };

  function compile(def){
    var total = 0;
    var events = {};
    for(var c=0;c<def.channels.length;c++){
      var ch = def.channels[c];
      var pos = 0;
      for(var i=0;i<ch.notes.length;i++){
        var n = ch.notes[i][0], d = ch.notes[i][1];
        if(n && n!=='r'){
          if(!events[pos]) events[pos]=[];
          events[pos].push({ch:ch, n:n, d:d});
        }
        pos += d;
      }
      if(pos>total) total=pos;
    }
    if(def.perc && def.perc.length>total) total=def.perc.length;
    return { def:def, events:events, total:total };
  }
  var compiled = {};
  function getCompiled(id){
    if(!compiled[id]) compiled[id] = compile(SONGS[id]);
    return compiled[id];
  }

  function stepDur(def, step, total, passes){
    var bpm = def.bpm;
    if(def.bpmEnd){
      var p = passes>0 ? 1 : clamp01(step/total);
      bpm = lerp(def.bpm, def.bpmEnd, p);
    }
    return 60/bpm/4;
  }

  function scheduleStep(song, step, when){
    var evs = song.events[step];
    var sd = stepDur(song.def, step, song.total, seq.passes);
    if(evs){
      for(var i=0;i<evs.length;i++){
        var e = evs[i];
        var durS = sd*e.d*0.92;
        var vol = e.ch.vol;
        if(e.n instanceof Array){
          for(var j=0;j<e.n.length;j++)
            note(N(e.n[j]), durS, e.ch.wave, vol, musicBus, when, 0, false);
        } else {
          note(N(e.n), durS, e.ch.wave, vol, musicBus, when, 0, e.ch.vib);
          if(e.ch.vib && durS>0.3) /* 回声点缀 */
            note(N(e.n), durS*0.7, e.ch.wave, vol*0.5, echoIn, when, 0, false);
        }
      }
    }
    if(song.def.perc){
      var pc = song.def.perc[step % song.def.perc.length];
      if(pc && pc!=='.') perc(pc, when);
    }
  }

  function tick(){
    if(!seq.song || !ready) return;
    var LOOKAHEAD = 0.22;
    while(seq.nextT < ctx.currentTime + LOOKAHEAD){
      scheduleStep(seq.song, seq.step, seq.nextT - ctx.currentTime);
      seq.nextT += stepDur(seq.song.def, seq.step, seq.song.total, seq.passes);
      seq.step++;
      if(seq.step >= seq.song.total){
        if(seq.song.def.loop){ seq.step=0; seq.passes++; }
        else { stopMusic(); return; }
      }
    }
  }

  function playMusic(id, opts){
    opts = opts||{};
    if(seq.id===id) return;
    stopMusic();
    if(!ready || !SONGS[id]){ seq.id=id; return; }
    seq.song = getCompiled(id);
    seq.id = id; seq.step = 0; seq.passes = 0;
    seq.nextT = ctx.currentTime + 0.08;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    if(opts.fadeIn){
      musicBus.gain.setValueAtTime(0.001, ctx.currentTime);
      musicBus.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime+opts.fadeIn);
    } else musicBus.gain.setValueAtTime(0.5, ctx.currentTime);
    seq.timer = Sched.iv(tick, 40);
  }
  function stopMusic(fade){
    if(seq.timer){ Sched.clearIv(seq.timer); seq.timer=null; }
    if(fade && ready && seq.id){
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(0.001, ctx.currentTime, fade/3);
      Sched.to(function(){ if(ready) musicBus.gain.setValueAtTime(0.5, ctx.currentTime); }, fade*1000+80);
    }
    seq.song=null; seq.id=null;
  }
  function setMuffle(on, freq){
    if(!ready) return;
    muffle.frequency.setTargetAtTime(on?(freq||620):19000, ctx.currentTime, 0.4);
  }
  function musicVol(v, ramp){
    if(!ready) return;
    musicBus.gain.setTargetAtTime(v, ctx.currentTime, (ramp||0.5)/3);
  }

  /* ============================================================
     音效库
     ============================================================ */
  var S = {
    /* --- 剧场仪式 --- */
    threeKnocks: function(){ /* 开演三击 (法式剧场传统) */
      for(var i=0;i<3;i++){
        note(95,0.22,'sine',0.22,null,i*0.75,60);
        noise(0.12,0.16,null,i*0.75,500);
      }
    },
    tuning: function(){ /* 乐团调音 A */
      note(440,2.6,'sawtooth',0.02,null,0,0,true);
      note(440.9,2.4,'triangle',0.025,null,0.3);
      note(220,2.0,'sawtooth',0.012,null,0.5);
      note(659,1.5,'sine',0.01,null,0.9);
    },
    baton: function(){ /* 指挥棒轻叩谱架 ×2 */
      noise(0.03,0.09,null,0,2400,true);
      noise(0.03,0.09,null,0.22,2400,true);
    },
    curtainSwish: function(){
      noise(1.6,0.045,null,0,900);
      noise(1.2,0.03,null,0.3,1400);
    },
    /* --- 环境 --- */
    churchBell: function(){
      for(var i=0;i<2;i++){
        var d=i*1.4;
        note(261,2.8,'sine',0.13,null,d);
        note(523,2.0,'triangle',0.06,null,d+0.01);
        note(784,1.2,'sine',0.03,null,d+0.02);
        noise(0.04,0.05,null,d,2000);
      }
    },
    factoryBell: function(){
      for(var i=0;i<5;i++){
        note(1180,0.16,'square',0.055,null,i*0.21);
        note(1770,0.1,'sine',0.03,null,i*0.21+0.02);
      }
    },
    crowdMurmur: function(){
      noise(2.2,0.02,null,0,700);
      for(var i=0;i<7;i++)
        note(rand(180,340),rand(0.08,0.2),'sine',0.012,null,rand(0,1.8));
    },
    crowdCheer: function(){ /* 欢呼声浪 */
      noise(1.6,0.09,null,0,1100);
      noise(1.2,0.06,null,0.15,2400,true);
      for(var i=0;i<10;i++)
        note(rand(500,1100),rand(0.06,0.14),'square',0.012,null,rand(0,1.1));
    },
    crowdRoar: function(){ /* 场内闷响的巨吼 */
      noise(2.4,0.12,null,0,480);
      note(90,1.8,'sawtooth',0.04,null,0,70);
    },
    crowdGasp: function(){
      noise(0.7,0.06,null,0,900,true);
    },
    ole: function(){ /* 铜管刺音 + 人群应和 */
      note(N('F4'),0.18,'sawtooth',0.07);
      note(N('A4'),0.18,'sawtooth',0.06,null,0.01);
      note(N('C5'),0.3,'sawtooth',0.07,null,0.02);
      noise(0.5,0.06,null,0.1,1300);
    },
    applause: function(){
      for(var i=0;i<46;i++)
        noise(0.03,rand(0.02,0.05),null,rand(0,2.6),rand(1200,2600),true);
    },
    applauseLong: function(){
      for(var i=0;i<110;i++)
        noise(0.03,rand(0.02,0.055),null,rand(0,6.5),rand(1100,2800),true);
      noise(3,0.03,null,0.3,900);
    },
    bravo: function(){
      note(300,0.4,'sawtooth',0.02,null,0,220);
      note(360,0.35,'sawtooth',0.018,null,0.15,250);
      S.applause();
    },
    /* --- 演出动作 --- */
    fanfare: function(){ /* 号角 */
      var m=[N('F4'),N('F4'),N('C5'),N('F5')];
      for(var i=0;i<m.length;i++){
        note(m[i],i===3?0.5:0.16,'sawtooth',0.06,null,i*0.16);
        note(m[i]*2,i===3?0.4:0.12,'square',0.02,null,i*0.16);
      }
    },
    bugle: function(){ /* 归营号 (远) */
      var m=[N('G4'),N('C5'),N('E5'),N('C5'),N('G4'),N('C5')];
      for(var i=0;i<m.length;i++)
        note(m[i],0.16,'sawtooth',0.022,echoIn,i*0.19);
    },
    fate: function(){ /* 宿命动机刺音 */
      note(N('D5'),0.55,'sawtooth',0.075,null,0);
      note(N('C#5'),0.5,'sawtooth',0.07,null,0.5);
      note(N('Bb4'),0.5,'sawtooth',0.07,null,0.95);
      note(N('A4'),1.1,'sawtooth',0.08,null,1.4);
      note(N('D3'),2.4,'triangle',0.09,null,0);
      perc('T',0,1.4); perc('T',1.4,1.2);
    },
    fateSoft: function(){
      note(N('D4'),0.5,'triangle',0.05,echoIn,0);
      note(N('C#4'),0.45,'triangle',0.045,echoIn,0.45);
      note(N('Bb3'),0.45,'triangle',0.045,echoIn,0.85);
      note(N('A3'),1.0,'triangle',0.05,echoIn,1.25);
    },
    roseToss: function(){ /* 掷花: 上扬琶音+微光 */
      var m=[N('D5'),N('F5'),N('A5'),N('D6')];
      for(var i=0;i<4;i++) note(m[i],0.14,'triangle',0.05,null,i*0.06);
      note(N('F6'),0.5,'sine',0.035,null,0.26);
    },
    sparkle: function(){
      for(var i=0;i<5;i++)
        note(rand(1600,3200),0.08,'sine',0.025,null,i*0.05);
    },
    castanetRoll: function(){
      for(var i=0;i<9;i++){
        noise(0.02,0.045,null,i*0.045,2600,true);
        note(2350,0.016,'square',0.026,null,i*0.045);
      }
    },
    castanet: function(){
      noise(0.022,0.05,null,0,2600,true);
      note(2350,0.018,'square',0.03);
    },
    stomp: function(){
      note(75,0.14,'sine',0.16,null,0,45);
      noise(0.06,0.07,null,0,300);
    },
    guitarStrum: function(){
      var m=[N('E3'),N('B3'),N('E4'),N('G#4'),N('B4'),N('E5')];
      for(var i=0;i<m.length;i++)
        note(m[i],0.7,'triangle',0.035,null,i*0.024);
    },
    guitarStrumMinor: function(){
      var m=[N('E3'),N('B3'),N('E4'),N('G4'),N('B4'),N('E5')];
      for(var i=0;i<m.length;i++)
        note(m[i],0.8,'triangle',0.035,null,i*0.028);
    },
    clink: function(){
      note(1900,0.2,'triangle',0.05);
      note(2850,0.3,'sine',0.03,null,0.01);
    },
    doorBurst: function(){
      noise(0.15,0.14,null,0,600);
      note(110,0.2,'square',0.06,null,0,70);
    },
    doorCreak: function(){
      note(150,0.7,'sawtooth',0.025,null,0,210);
    },
    capeWhoosh: function(){
      noise(0.35,0.075,null,0,1500);
      note(220,0.3,'sine',0.03,null,0,110);
    },
    slap: function(){
      noise(0.05,0.14,null,0,1700,true);
    },
    ringThrow: function(){ /* 戒指落地弹跳 */
      note(3100,0.08,'sine',0.05,null,0);
      note(2600,0.06,'sine',0.04,null,0.16);
      note(2900,0.05,'sine',0.03,null,0.28);
      note(2400,0.04,'sine',0.02,null,0.37);
    },
    knifeGleam: function(){ /* 刀光 */
      note(2400,0.3,'sawtooth',0.03,null,0,3400);
      noise(0.15,0.04,null,0,5200,true);
    },
    stabHit: function(){ /* 刺击 — 一瞬静默后的重击 */
      noise(0.09,0.24,null,0,900);
      note(60,0.5,'sawtooth',0.18,null,0.01,35);
      note(N('D6'),1.4,'sine',0.04,null,0.05);
    },
    heartbeat: function(){
      note(52,0.11,'sine',0.15); note(48,0.13,'sine',0.12,null,0.18);
    },
    footsteps: function(n, gap){
      for(var i=0;i<(n||4);i++)
        noise(0.04,0.04,null,i*(gap||0.32),500);
    },
    hoofBells: function(){ /* 游行队伍: 马蹄+铃铛 */
      for(var i=0;i<8;i++){
        noise(0.03,0.05,null,i*0.18,800);
        if(i%2===0) note(2100,0.1,'sine',0.02,null,i*0.18);
      }
    },
    windDusk: function(){
      noise(2.6,0.028,null,0,600);
    },
    thunderStomp: function(){ /* 观众席跺脚 */
      for(var i=0;i<6;i++) note(70,0.12,'sine',0.1,null,i*0.24,45);
    },
    gateSlam: function(){
      noise(0.3,0.2,null,0,500);
      note(55,0.5,'sawtooth',0.14,null,0,32);
    },
    type: function(){ note(1800+Math.random()*500,0.012,'square',0.012); },
    click: function(){ note(1500,0.02,'square',0.03); }
  };

  return {
    init:init, resume:resume, setMuted:setMuted,
    playMusic:playMusic, stopMusic:stopMusic,
    setMuffle:setMuffle, musicVol:musicVol,
    curMusic:function(){ return seq.id; },
    sfx:S, N:N
  };
})();
