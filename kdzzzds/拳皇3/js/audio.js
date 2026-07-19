(function(){
'use strict';
var KOF = window.KOF;
var ctx = null;
var masterGain = null, sfxGain = null, musGain = null;
var enabled = true;
var musicState = { name:null, timer:null, nextTime:0, step:0, track:null };

function init(){
  if(ctx) return true;
  try{
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return false;
    ctx = new AC();
    masterGain = ctx.createGain(); masterGain.gain.value = 0.7; masterGain.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(masterGain);
    musGain = ctx.createGain(); musGain.gain.value = 0.4; musGain.connect(masterGain);
  }catch(e){ return false; }
  return true;
}
function resume(){ if(ctx && ctx.state==='suspended'){ try{ctx.resume();}catch(e){} } }

function osc(type, freq, t0, dur, vol, dest, slideTo){
  var o = ctx.createOscillator(); var g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,slideTo), t0+dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0+dur);
  o.connect(g); g.connect(dest||sfxGain);
  o.start(t0); o.stop(t0+dur+0.02);
}
var noiseBuf = null;
function getNoise(){
  if(noiseBuf) return noiseBuf;
  var len = ctx.sampleRate * 0.5;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = noiseBuf.getChannelData(0);
  for(var i=0;i<len;i++) d[i] = Math.random()*2-1;
  return noiseBuf;
}
function noise(t0, dur, vol, freq, qv, dest){
  var src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
  var f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=freq||1200; f.Q.value=qv||1;
  var g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0+dur);
  src.connect(f); f.connect(g); g.connect(dest||sfxGain);
  src.start(t0); src.stop(t0+dur+0.02);
}

var SFX = {
  menuMove: function(t){ osc('square', 700, t, 0.05, 0.15); },
  menuSel:  function(t){ osc('square', 550, t, 0.06, 0.2); osc('square', 880, t+0.06, 0.1, 0.2); },
  menuBack: function(t){ osc('square', 500, t, 0.08, 0.15, null, 250); },
  whooshL:  function(t){ noise(t, 0.08, 0.25, 2500, 1.5); },
  whooshH:  function(t){ noise(t, 0.14, 0.35, 1500, 1.2); },
  hitL:     function(t){ noise(t, 0.07, 0.5, 900, 2); osc('sine', 180, t, 0.07, 0.5, null, 60); },
  hitM:     function(t){ noise(t, 0.1, 0.6, 700, 2); osc('sine', 150, t, 0.1, 0.6, null, 50); },
  hitH:     function(t){ noise(t, 0.16, 0.8, 500, 1.5); osc('sine', 120, t, 0.16, 0.8, null, 40); osc('square', 90, t, 0.1, 0.3, null, 40); },
  block:    function(t){ osc('square', 320, t, 0.06, 0.3, null, 200); noise(t, 0.05, 0.2, 3000, 3); },
  throwHit: function(t){ noise(t, 0.22, 0.8, 300, 1); osc('sine', 90, t, 0.25, 0.9, null, 35); },
  land:     function(t){ noise(t, 0.06, 0.25, 400, 1); },
  jump:     function(t){ osc('sine', 220, t, 0.1, 0.15, null, 440); },
  roll:     function(t){ noise(t, 0.15, 0.2, 800, 1); },
  fireball: function(t){ noise(t, 0.3, 0.35, 900, 1); osc('sawtooth', 200, t, 0.3, 0.2, null, 90); },
  fireHit:  function(t){ noise(t, 0.25, 0.7, 600, 1); osc('sawtooth', 150, t, 0.25, 0.4, null, 50); },
  ice:      function(t){ osc('triangle', 1400, t, 0.2, 0.3, null, 500); noise(t, 0.15, 0.25, 4000, 4); },
  thunder:  function(t){ noise(t, 0.28, 0.7, 1800, 0.6); osc('sawtooth', 100, t, 0.28, 0.4, null, 45); },
  wind:     function(t){ noise(t, 0.35, 0.4, 1100, 0.8); },
  charge:   function(t){ osc('sawtooth', 80, t, 0.4, 0.3, null, 300); noise(t, 0.4, 0.2, 500, 1); },
  superFlash: function(t){ osc('sawtooth', 60, t, 0.5, 0.5, null, 240); osc('square', 240, t+0.05, 0.4, 0.3, null, 480); },
  explode:  function(t){ noise(t, 0.5, 0.9, 300, 0.6); osc('sine', 70, t, 0.5, 0.8, null, 30); },
  ko:       function(t){ osc('sawtooth', 300, t, 0.7, 0.6, null, 50); noise(t, 0.6, 0.6, 400, 0.8); },
  round:    function(t){ osc('square', 440, t, 0.12, 0.3); osc('square', 660, t+0.14, 0.2, 0.3); },
  fight:    function(t){ osc('square', 523, t, 0.1, 0.35); osc('square', 659, t+0.1, 0.1, 0.35); osc('square', 880, t+0.2, 0.25, 0.4); },
  win:      function(t){ var n=[523,659,784,1046]; for(var i=0;i<4;i++) osc('square', n[i], t+i*0.13, 0.15, 0.3); },
  timeTick: function(t){ osc('square', 900, t, 0.05, 0.2); },
  counter:  function(t){ osc('square', 1100, t, 0.08, 0.3); osc('square', 1400, t+0.06, 0.1, 0.3); },
  meterMax: function(t){ osc('sawtooth', 200, t, 0.5, 0.4, null, 800); },
  tech:     function(t){ osc('triangle', 800, t, 0.1, 0.3, null, 1200); }
};

function sfx(name){
  if(!enabled || !init()) return;
  resume();
  var f = SFX[name];
  if(f){ try{ f(ctx.currentTime); }catch(e){} }
}

// ===== chiptune sequencer =====
// note helpers: midi -> freq
function mf(m){ return 440*Math.pow(2,(m-69)/12); }
// tracks: {bpm, steps(16th), bass:[], lead:[], drum:[]}  note=midi or 0=rest; drum: 1=kick 2=snare 3=hat
var TRACKS = {
  menu: { bpm:112,
    bass:[33,0,33,0, 36,0,33,0, 31,0,31,0, 33,0,38,36],
    lead:[57,0,60,64, 0,64,62,60, 0,55,0,57, 60,0,0,0],
    drum:[1,3,2,3, 1,3,2,3, 1,3,2,3, 1,3,2,2] },
  street: { bpm:132,
    bass:[31,31,0,31, 34,0,31,0, 29,29,0,29, 26,0,29,31],
    lead:[62,0,65,67, 70,67,65,62, 0,58,62,65, 67,65,62,0],
    drum:[1,0,3,0, 2,0,3,3, 1,0,3,0, 2,0,3,2] },
  harbor: { bpm:120,
    bass:[28,0,35,0, 33,0,28,0, 26,0,33,0, 31,0,28,0],
    lead:[64,62,60,0, 57,0,60,62, 64,0,67,64, 62,60,57,0],
    drum:[1,3,3,3, 2,3,1,3, 1,3,3,3, 2,3,2,3] },
  temple: { bpm:108,
    bass:[26,0,0,26, 29,0,26,0, 24,0,0,24, 31,0,29,26],
    lead:[50,0,53,55, 57,0,55,53, 50,0,48,50, 53,0,0,0],
    drum:[1,0,3,0, 2,0,3,0, 1,0,3,0, 2,3,3,3] },
  boss: { bpm:150,
    bass:[24,24,31,24, 23,23,30,23, 24,24,31,24, 26,26,27,27],
    lead:[72,0,71,72, 74,72,71,67, 72,0,74,75, 77,75,74,71],
    drum:[1,3,2,3, 1,3,2,3, 1,2,1,2, 2,2,2,2] },
  select: { bpm:140,
    bass:[33,0,33,33, 31,0,31,31, 29,0,29,29, 31,0,31,0],
    lead:[69,0,67,69, 0,72,71,67, 65,0,64,65, 67,0,0,0],
    drum:[1,3,2,3, 1,3,2,3, 1,3,2,3, 1,2,3,3] },
  victory: { bpm:120,
    bass:[36,0,36,0, 41,0,41,0, 43,0,43,0, 36,36,0,0],
    lead:[72,0,76,79, 77,0,74,77, 79,81,79,77, 76,0,72,0],
    drum:[1,3,2,3, 1,3,2,3, 1,3,2,3, 2,2,2,0] }
};

function scheduleStep(track, step, t){
  var i = step % 16;
  var b = track.bass[i], l = track.lead[i], d = track.drum[i];
  var stepDur = 60/track.bpm/4;
  if(b){ osc('triangle', mf(b), t, stepDur*0.9, 0.5, musGain); osc('square', mf(b), t, stepDur*0.5, 0.12, musGain); }
  if(l){ osc('square', mf(l), t, stepDur*0.85, 0.22, musGain); osc('square', mf(l)*1.005, t, stepDur*0.85, 0.1, musGain); }
  if(d===1){ osc('sine', 120, t, 0.1, 0.6, musGain, 45); }
  else if(d===2){ noise(t, 0.09, 0.35, 1800, 1, musGain); osc('sine', 200, t, 0.05, 0.3, musGain, 100); }
  else if(d===3){ noise(t, 0.03, 0.15, 7000, 3, musGain); }
}

function musicTick(){
  if(!musicState.track || !ctx) return;
  var ahead = 0.15;
  while(musicState.nextTime < ctx.currentTime + ahead){
    scheduleStep(musicState.track, musicState.step, Math.max(musicState.nextTime, ctx.currentTime));
    musicState.step++;
    musicState.nextTime += 60/musicState.track.bpm/4;
  }
}

function music(name){
  if(!enabled){ musicState.name = name; return; }
  if(!init()) return;
  resume();
  if(musicState.name === name && musicState.timer) return;
  stopMusic();
  var tr = TRACKS[name];
  if(!tr) return;
  musicState.name = name;
  musicState.track = tr;
  musicState.step = 0;
  musicState.nextTime = ctx.currentTime + 0.05;
  musicState.timer = setInterval(musicTick, 60);
}
function stopMusic(){
  if(musicState.timer){ clearInterval(musicState.timer); musicState.timer = null; }
  musicState.name = null; musicState.track = null;
}

function announce(text){
  try{
    if(window.speechSynthesis){
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 1.15; u.pitch = 0.6; u.volume = 0.8; u.lang='en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }catch(e){}
}

KOF.Audio = { init:init, resume:resume, sfx:sfx, music:music, stopMusic:stopMusic, announce:announce,
  setEnabled:function(v){ enabled=v; if(!v) stopMusic(); },
  isEnabled:function(){ return enabled; } };
})();
