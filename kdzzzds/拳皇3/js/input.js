(function(){
'use strict';
var KOF = window.KOF;

var DEFAULT_KEYS = [
  { up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD', LP:'KeyU', HP:'KeyI', LK:'KeyJ', HK:'KeyK', AB:'KeyO', CD:'KeyL', MAX:'KeyP', START:'Enter' },
  { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight', LP:'Numpad1', HP:'Numpad4', LK:'Numpad2', HK:'Numpad5', AB:'Numpad3', CD:'Numpad6', MAX:'Numpad0', START:'NumpadEnter' }
];
var BTN_NAMES = ['LP','HP','LK','HK','AB','CD','MAX','START'];
var keys = null;
try{
  var saved = localStorage.getItem('fs97_keys');
  keys = saved ? JSON.parse(saved) : null;
}catch(e){ keys = null; }
if(!keys || !keys[0] || !keys[1]) keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));

var down = {};       // code -> bool
var pressedRaw = {}; // code -> pressed this poll
var capture = null;  // rebind capture cb

window.addEventListener('keydown', function(e){
  if(e.repeat) return;
  if(capture){ e.preventDefault(); var cb = capture; capture = null; cb(e.code); return; }
  down[e.code] = true;
  pressedRaw[e.code] = true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].indexOf(e.code)>=0) e.preventDefault();
});
window.addEventListener('keyup', function(e){ down[e.code] = false; });
window.addEventListener('blur', function(){ down = {}; });

// player runtime state
function mkP(){ return { dir:5, held:{}, pressed:{}, released:{}, prevHeld:{}, buffer:[], chargeB:0, chargeD:0, lastDirs:[] }; }
var players = [ mkP(), mkP() ];

function padRead(idx){
  var pads = (navigator.getGamepads && navigator.getGamepads()) || [];
  var gp = pads[idx];
  if(!gp) return null;
  var ax = gp.axes[0]||0, ay = gp.axes[1]||0;
  var l = ax < -0.4, r = ax > 0.4, u = ay < -0.5, d = ay > 0.5;
  if(gp.buttons[12] && gp.buttons[12].pressed) u = true;
  if(gp.buttons[13] && gp.buttons[13].pressed) d = true;
  if(gp.buttons[14] && gp.buttons[14].pressed) l = true;
  if(gp.buttons[15] && gp.buttons[15].pressed) r = true;
  function b(i){ return !!(gp.buttons[i] && gp.buttons[i].pressed); }
  return { u:u, d:d, l:l, r:r,
    LP:b(2), HP:b(3), LK:b(0), HK:b(1), AB:b(4), CD:b(5), MAX:b(6)||b(7), START:b(9) };
}

function dirFrom(u,d,l,r){
  var x = (r?1:0)-(l?1:0);
  var y = (u?1:0)-(d?1:0);
  return 5 + x + y*3; // 1..9 numpad, 5 neutral
}

function update(){
  for(var p=0;p<2;p++){
    var P = players[p];
    var k = keys[p];
    var u = !!down[k.up], d = !!down[k.down], l = !!down[k.left], r = !!down[k.right];
    var st = { LP:!!down[k.LP], HP:!!down[k.HP], LK:!!down[k.LK], HK:!!down[k.HK], AB:!!down[k.AB], CD:!!down[k.CD], MAX:!!down[k.MAX], START:!!down[k.START] };
    var pad = padRead(p);
    if(pad){
      u=u||pad.u; d=d||pad.d; l=l||pad.l; r=r||pad.r;
      for(var i=0;i<BTN_NAMES.length;i++){ var n=BTN_NAMES[i]; st[n]=st[n]||pad[n]; }
    }
    // macros
    if(st.AB){ st.LP=st.LP; } // AB is roll macro handled by fighter
    P.dir = dirFrom(u,d,l,r);
    P.pressed = {}; P.released = {};
    for(var j=0;j<BTN_NAMES.length;j++){
      var b = BTN_NAMES[j];
      P.pressed[b] = st[b] && !P.prevHeld[b];
      P.released[b] = !st[b] && P.prevHeld[b];
    }
    P.held = st;
    P.prevHeld = st;
  }
  pressedRaw = {};
}

// external per-frame feed (from battle, facing-aware)
function feed(p, relDir, frame){
  var P = players[p];
  P.buffer.push({ d:relDir, f:frame });
  if(P.buffer.length > 90) P.buffer.shift();
  // charge tracking (relative: 4/1/7 = back; 1/2/3 = down)
  if(relDir===4||relDir===1||relDir===7) P.chargeB++; else P.chargeB=0;
  if(relDir===1||relDir===2||relDir===3) P.chargeD++; else P.chargeD=0;
}

var MOTIONS = {
  qcf:  [[2],[3],[6]],
  qcb:  [[2],[1],[4]],
  dp:   [[6],[2],[3]],
  rdp:  [[4],[2],[1]],
  hcb:  [[6],[2,3,1],[4]],
  hcf:  [[4],[2,1,3],[6]],
  hcbf: [[6],[2,3,1],[4],[6]],
  qcfqcf: [[2],[3],[6],[2],[3],[6]],
  qcbqcb: [[2],[1],[4],[2],[1],[4]],
  qcbhcf: [[2],[1],[4],[2,1,3],[6]],
  hcbhcb: [[6],[2,3,1],[4],[6],[2,3,1],[4]],
  fdf:  [[6],[2],[3]],
  dd:   [[2],[5,1,3],[2]]
};
var WINDOWS = { qcf:16, qcb:16, dp:20, rdp:20, hcb:24, hcf:24, hcbf:32, qcfqcf:34, qcbqcb:34, qcbhcf:36, hcbhcb:50, fdf:20, dd:20 };

// check if a motion completed within window ending at current frame
function matchMotion(p, motion, curFrame){
  var P = players[p];
  if(motion==='chargebf'){
    // need recent forward after >=40f of back charge
    return chargeMatch(P, 'B', 6, curFrame);
  }
  if(motion==='chargedu'){
    return chargeMatch(P, 'D', 8, curFrame);
  }
  var pat = MOTIONS[motion];
  if(!pat) return false;
  var win = WINDOWS[motion]||20;
  var buf = P.buffer;
  var pi = pat.length - 1;
  var lastF = curFrame;
  for(var i=buf.length-1;i>=0 && pi>=0;i--){
    var e = buf[i];
    if(curFrame - e.f > win) break;
    if(pat[pi].indexOf(e.d) >= 0){
      pi--;
      lastF = e.f;
    }
  }
  return pi < 0;
}
function chargeMatch(P, type, relDir, curFrame){
  // scan buffer: recent dir hit (within 8f) + accumulated charge before it
  var buf = P.buffer;
  var need = 40;
  var hitF = -1;
  for(var i=buf.length-1;i>=0;i--){
    var e = buf[i];
    if(curFrame - e.f > 10) break;
    var ok = (type==='B') ? (e.d===relDir||e.d===relDir+3||e.d===relDir-3) : (e.d===8||e.d===7||e.d===9);
    if(ok){ hitF = i; break; }
  }
  if(hitF < 0) return false;
  var charge = 0;
  for(var j=hitF-1;j>=0;j--){
    var d = buf[j].d;
    var isC = (type==='B') ? (d===4||d===1||d===7) : (d===1||d===2||d===3);
    if(isC) charge++;
    else if(charge>0 && (buf[hitF].f - buf[j].f) > charge + 8) break;
  }
  return charge >= need;
}

// tap detection: dir tapped twice (e.g. 66 run / 44 backdash)
function doubleTap(p, relDir, curFrame){
  var buf = players[p].buffer;
  var taps = 0, prev = -1;
  for(var i=buf.length-1;i>=0;i--){
    var e = buf[i];
    if(curFrame - e.f > 16) break;
    if(e.d !== prev){
      if(e.d === relDir) taps++;
      else if(e.d !== 5 && taps>0 && e.d!==relDir) break;
      prev = e.d;
    }
  }
  return taps >= 2;
}

function get(p){ return players[p]; }
function clearBuffer(p){ players[p].buffer = []; players[p].chargeB=0; players[p].chargeD=0; }

function setKey(p, name, code){
  keys[p][name] = code;
  try{ localStorage.setItem('fs97_keys', JSON.stringify(keys)); }catch(e){}
}
function getKeys(){ return keys; }
function resetKeys(){ keys = JSON.parse(JSON.stringify(DEFAULT_KEYS)); try{ localStorage.setItem('fs97_keys', JSON.stringify(keys)); }catch(e){} }
function beginCapture(cb){ capture = cb; }
function cancelCapture(){ capture = null; }
function keyLabel(code){
  if(!code) return '---';
  return code.replace('Key','').replace('Arrow','').replace('Numpad','NUM ').replace('Digit','');
}

KOF.Input = { update:update, get:get, feed:feed, matchMotion:matchMotion, doubleTap:doubleTap,
  clearBuffer:clearBuffer, setKey:setKey, getKeys:getKeys, resetKeys:resetKeys,
  beginCapture:beginCapture, cancelCapture:cancelCapture, keyLabel:keyLabel, BTN_NAMES:BTN_NAMES,
  isDown:function(code){ return !!down[code]; } };
})();
