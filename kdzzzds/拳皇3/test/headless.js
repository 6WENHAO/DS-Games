// Headless smoke test: stubs browser APIs, loads all game scripts, drives the state machine.
'use strict';
var fs = require('fs');
var path = require('path');

var failures = [];
function fail(msg){ failures.push(msg); console.error('FAIL: '+msg); }
function ok(msg){ console.log('OK: '+msg); }

// ---------- DOM/browser stubs ----------
function makeCtx(){
  var stub = {};
  var handler = {
    get: function(target, prop){
      if(prop in target) return target[prop];
      if(prop === 'canvas') return { width:480, height:270 };
      return function(){ return { addColorStop: function(){}, width:10 }; };
    },
    set: function(target, prop, value){ target[prop]=value; return true; }
  };
  return new Proxy(stub, handler);
}
function Canvas(){
  this.width = 300; this.height = 150;
  this.style = {};
}
Canvas.prototype.getContext = function(){ return makeCtx(); };

var pendingImages = [];
function Image(){
  var self = this;
  this._src = '';
  Object.defineProperty(this, 'src', {
    set: function(v){ self._src = v; pendingImages.push(self); },
    get: function(){ return self._src; }
  });
}
global.Image = Image;
function flushImages(){
  var batch = pendingImages.splice(0);
  batch.forEach(function(img){ if(img.onload) img.onload(); });
}

global.window = global;
global.document = {
  readyState: 'complete',
  createElement: function(tag){ return new Canvas(); },
  getElementById: function(id){ return new Canvas(); },
  addEventListener: function(){},
};
Object.defineProperty(global, 'navigator', { value: { getGamepads: function(){ return []; } }, configurable: true });
global.localStorage = {
  _d:{}, getItem:function(k){ return this._d[k]||null; },
  setItem:function(k,v){ this._d[k]=v; }, removeItem:function(k){ delete this._d[k]; }
};
global.requestAnimationFrame = function(cb){ /* manual stepping */ };
global.performance = { now: function(){ return Date.now(); } };
global.AudioContext = function(){
  this.currentTime = 0;
  this.sampleRate = 44100;
  this.state = 'running';
  this.destination = {};
  var node = function(){ return {
    connect:function(){}, start:function(){}, stop:function(){},
    frequency:{ value:0, setValueAtTime:function(){}, exponentialRampToValueAtTime:function(){} },
    gain:{ value:0, setValueAtTime:function(){}, exponentialRampToValueAtTime:function(){} },
    type:'', Q:{value:0}, buffer:null, loop:false
  };};
  this.createOscillator = node; this.createGain = node; this.createBiquadFilter = node;
  this.createBufferSource = node;
  this.createBuffer = function(){ return { getChannelData: function(){ return new Float32Array(10); } }; };
  this.resume = function(){};
};
global.speechSynthesis = { cancel:function(){}, speak:function(){} };
global.SpeechSynthesisUtterance = function(){};

// keyboard event capture
var keyHandlers = { keydown:[], keyup:[], blur:[], resize:[], mousedown:[] };
global.window.addEventListener = function(type, fn){ if(keyHandlers[type]) keyHandlers[type].push(fn); };
global.window.innerWidth = 1280; global.window.innerHeight = 720;
function pressKey(code){ keyHandlers.keydown.forEach(function(f){ f({code:code, repeat:false, preventDefault:function(){}}); }); }
function releaseKey(code){ keyHandlers.keyup.forEach(function(f){ f({code:code}); }); }

// ---------- load scripts ----------
var files = ['svg.js','pixelfont.js','audio.js','input.js','poses.js','puppet.js','effects.js','stages.js','characters.js','fighter.js','ai.js','battle.js','ui.js','main.js'];
files.forEach(function(f){
  var code = fs.readFileSync(path.join(__dirname,'..','js',f),'utf8');
  try{
    (0, eval)(code);
  }catch(e){
    fail('loading '+f+': '+e.message);
    process.exit(1);
  }
});
ok('all scripts loaded');

var KOF = global.KOF;
KOF.Main.boot();
flushImages();
ok('boot');

// run loading scene
for(var i=0;i<40;i++){ KOF.Main.step(); flushImages(); }
if(KOF.Game.scene !== KOF.Scenes.Title){
  // allow a few more frames
  for(var j=0;j<40;j++){ KOF.Main.step(); flushImages(); }
}
if(KOF.Game.scene === KOF.Scenes.Title) ok('reached title'); else fail('did not reach title, scene='+(KOF.Game.scene===KOF.Main.SceneLoading?'loading':'other'));

// ---------- test 1: EVE battle (AI vs AI) full match ----------
KOF.Game.set(KOF.Scenes.Battle, { ret:'eve', cfg:{
  mode:'eve', stage:'street',
  p1:{team:['yanlong','leihao','jifeng'], ctrl:{level:6}, level:6},
  p2:{team:['yueying','tiewu','xuanbing'], ctrl:{level:6}, level:6}
}});
flushImages();
var battle = KOF.Game.scene.battle;
if(!battle) fail('battle not created');
var maxFrames = 60*60*12; // 12 min cap
var f = 0;
var errored = null;
try{
  while(f<maxFrames && KOF.Game.scene===KOF.Scenes.Battle){
    KOF.Main.step();
    if(f%600===0) flushImages();
    f++;
  }
}catch(e){ errored = e; }
if(errored){ fail('EVE battle crashed at frame '+f+': '+errored.stack); }
else if(KOF.Game.scene===KOF.Scenes.EveReport){
  ok('EVE match completed in '+f+' frames; winner=AI-'+(KOF.Game.scene.res.winner+1));
  var m = KOF.Game.scene.res.metrics;
  ok('metrics: atk '+m[0].attacks+'/'+m[1].attacks+' hits '+m[0].hits+'/'+m[1].hits+' dmg '+Math.round(m[0].dmg)+'/'+Math.round(m[1].dmg)+' throws '+m[0].throwsDone+'/'+m[1].throwsDone+' supers '+m[0].supers+'/'+m[1].supers);
  ok('grade: '+KOF.Game.scene.stats.grade+' score '+KOF.Game.scene.stats.score);
  if(m[0].hits+m[1].hits < 10) fail('too few hits landed - AI not fighting?');
  if(m[0].attacks+m[1].attacks < 40) fail('too few attacks');
}else{
  fail('EVE match did not finish within cap; scene stuck. phase='+ (battle?battle.phase:'?') + ' teams idx '+battle.teams[0].idx+'/'+battle.teams[1].idx + ' frame '+battle.frame);
}

// ---------- test 2: EVE report navigation ----------
try{
  for(var r=0;r<10;r++) KOF.Main.step();
  ok('EVE report renders');
}catch(e){ fail('EVE report crashed: '+e.stack); }

// ---------- test 3: scripted human inputs in training ----------
KOF.Game.set(KOF.Scenes.Battle, { ret:'vs', cfg:{
  mode:'training', stage:'temple',
  p1:{team:['yanlong'], ctrl:'human'},
  p2:{team:['leihao'], ctrl:'dummy'}
}});
flushImages();
var tb = KOF.Game.scene.battle;
// wait for fight phase
var guard = 0;
try{
  while(tb.phase!=='fight' && guard++<600){ KOF.Main.step(); }
  if(tb.phase!=='fight') fail('training never reached fight phase');
  var p1 = tb.fighters[0];
  // walk forward
  pressKey('KeyD');
  for(var w=0;w<30;w++) KOF.Main.step();
  releaseKey('KeyD');
  if(p1.x<=330) fail('walk forward did not move fighter (x='+p1.x+')');
  else ok('walking works');
  // jab
  pressKey('KeyU');
  KOF.Main.step();
  releaseKey('KeyU');
  KOF.Main.step();
  if(p1.state==='attack' && p1.curMove && p1.curMove.id==='sLP') ok('normal attack works');
  else fail('jab failed: state='+p1.state+' move='+(p1.curMove&&p1.curMove.id));
  for(var w2=0;w2<30;w2++) KOF.Main.step();
  // QCF+P fireball
  pressKey('KeyS'); KOF.Main.step(); KOF.Main.step();
  pressKey('KeyD'); KOF.Main.step(); KOF.Main.step();
  releaseKey('KeyS'); KOF.Main.step();
  pressKey('KeyU'); KOF.Main.step();
  releaseKey('KeyU'); releaseKey('KeyD');
  KOF.Main.step();
  if(p1.state==='attack' && p1.curMove && (p1.curMove.id==='fireL'||p1.curMove.id==='fireH')) ok('QCF fireball motion works');
  else fail('fireball failed: state='+p1.state+' move='+(p1.curMove&&p1.curMove.id));
  var sawProj = false;
  for(var w3=0;w3<80;w3++){ KOF.Main.step(); if(tb.projectiles.length) sawProj=true; }
  if(sawProj) ok('projectile spawned'); else fail('no projectile spawned');
  // jump
  pressKey('KeyW');
  for(var w4=0;w4<8;w4++) KOF.Main.step();
  releaseKey('KeyW');
  var rose = false;
  for(var w5=0;w5<30;w5++){ KOF.Main.step(); if(p1.y>10) rose=true; }
  if(rose) ok('jump works'); else fail('jump failed');
  for(var w6=0;w6<60;w6++) KOF.Main.step();
  // super with meter
  p1.stocks = 2;
  function tapDirs(seq){
    seq.forEach(function(codes){
      codes.forEach(function(c){ pressKey(c); });
      KOF.Main.step(); KOF.Main.step();
      codes.forEach(function(c){ releaseKey(c); });
      KOF.Main.step();
    });
  }
  tapDirs([['KeyS'],['KeyS','KeyD'],['KeyD'],['KeyS'],['KeyS','KeyD'],['KeyD']]);
  pressKey('KeyI'); KOF.Main.step(); releaseKey('KeyI'); KOF.Main.step();
  if(p1.curMove && p1.curMove.id==='super1') ok('super (QCFx2+P) works');
  else fail('super failed: move='+(p1.curMove&&p1.curMove.id)+' state='+p1.state+' stocks='+p1.stocks);
  for(var w7=0;w7<200;w7++) KOF.Main.step();
  ok('training scenario done, dummy hp='+Math.round(tb.fighters[1].hp));
}catch(e){ fail('training test crashed: '+e.stack); }

// ---------- test 4: pause menu ----------
try{
  pressKey('Escape'); KOF.Main.step(); releaseKey('Escape');
  if(KOF.Game.scene.pause) ok('pause works'); else fail('pause failed');
  KOF.Main.step();
  pressKey('Escape'); KOF.Main.step(); releaseKey('Escape');
  KOF.Main.step();
  if(!KOF.Game.scene.pause) ok('unpause works'); else fail('unpause failed');
}catch(e){ fail('pause crashed: '+e.stack); }

// ---------- test 5: menu navigation ----------
try{
  KOF.Game.set(KOF.Scenes.Title, {});
  for(var t1=0;t1<5;t1++) KOF.Main.step();
  KOF.Game.set(KOF.Scenes.CharSel, {mode:'vscpu'});
  for(var t2=0;t2<5;t2++) KOF.Main.step();
  // pick 3 chars with LP presses
  for(var pk=0;pk<3;pk++){
    pressKey('KeyD'); KOF.Main.step(); releaseKey('KeyD'); KOF.Main.step();
    pressKey('KeyU'); KOF.Main.step(); releaseKey('KeyU'); KOF.Main.step();
  }
  for(var t3=0;t3<60;t3++){ KOF.Main.step(); flushImages(); }
  if(KOF.Game.scene===KOF.Scenes.VS || KOF.Game.scene===KOF.Scenes.Battle) ok('char select -> VS flow works');
  else fail('char select flow stuck');
  for(var t4=0;t4<130;t4++){ KOF.Main.step(); flushImages(); }
  if(KOF.Game.scene===KOF.Scenes.Battle) ok('VS screen -> battle works');
  else fail('vs->battle failed');
  // let the vs cpu match run a while
  var crashed = null;
  try{ for(var t5=0;t5<3000;t5++){ KOF.Main.step(); if(t5%600===0) flushImages(); } }catch(e){ crashed=e; }
  if(crashed) fail('vscpu battle crashed: '+crashed.stack);
  else ok('vscpu battle ran 3000 frames');
}catch(e){ fail('menu test crashed: '+e.stack); }

// ---------- test 6: arcade flow bootstrap ----------
try{
  KOF.Game.arcade = { stageIdx:0, team:['yanlong','jifeng','leihao'], wins:0 };
  KOF.Scenes.startArcadeBattle();
  for(var a1=0;a1<130;a1++){ KOF.Main.step(); flushImages(); }
  if(KOF.Game.scene===KOF.Scenes.Battle) ok('arcade battle starts');
  else fail('arcade battle failed to start');
  var crashed2=null;
  try{ for(var a2=0;a2<2000;a2++){ KOF.Main.step(); if(a2%600===0) flushImages(); } }catch(e){ crashed2=e; }
  if(crashed2) fail('arcade battle crashed: '+crashed2.stack); else ok('arcade battle stable');
}catch(e){ fail('arcade test crashed: '+e.stack); }

console.log('');
if(failures.length){ console.log('=== '+failures.length+' FAILURE(S) ==='); process.exit(1); }
console.log('=== ALL SMOKE TESTS PASSED ===');
process.exit(0);
