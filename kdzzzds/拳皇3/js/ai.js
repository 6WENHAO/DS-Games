(function(){
'use strict';
var KOF = window.KOF;

var MOT = {
  qcf:[2,3,6], qcb:[2,1,4], dp:[6,5,2,3], rdp:[4,5,2,1],
  hcb:[6,3,2,1,4], hcf:[4,1,2,3,6], hcbf:[6,3,2,1,4,6],
  qcfqcf:[2,3,6,2,3,6], qcbqcb:[2,1,4,2,1,4],
  qcbhcf:[2,1,4,1,2,3,6], hcbhcb:[6,3,2,1,4,6,3,2,1,4]
};

function motionScript(motion, btn){
  var s = [];
  if(motion==='chargebf'){
    s.push({d:1,h:46});
    s.push({d:6,b:btn,h:3});
    return s;
  }
  if(motion==='chargedu'){
    s.push({d:1,h:46});
    s.push({d:8,b:btn,h:3});
    return s;
  }
  var seq = MOT[motion];
  if(!seq) return [{b:btn,h:3}];
  for(var i=0;i<seq.length;i++){
    s.push({d:seq[i], h:3, b:(i===seq.length-1)?btn:null});
  }
  return s;
}

function normalScript(arg){
  if(arg==='fHK') return [{d:6,b:'HK',h:3}];
  if(arg && arg.indexOf('_')>0){
    var parts = arg.split('_');
    return motionScript(parts[0], parts[1]);
  }
  if(arg && arg[0]==='c') return [{d:1,b:arg.slice(1),h:3},{d:1,h:4}];
  if(arg && arg[0]==='s') return [{b:arg.slice(1),h:3},{h:4}];
  return [{b:arg,h:3}];
}

function parseStep(step){
  var tag = step[0];
  if(tag==='n'){
    if(step.length===3 && (MOT[step[1]]||step[1]==='chargebf'||step[1]==='chargedu')) return motionScript(step[1], step[2]);
    return normalScript(step[1]);
  }
  if(tag==='j'){
    return [{d:9,h:4},{d:5,h:12},{b:step[1],h:3},{h:26}];
  }
  if(tag==='jqcf'){
    return [{d:9,h:4},{d:5,h:8},{d:2,h:2},{d:3,h:2},{d:6,b:step[1],h:3},{h:26}];
  }
  if(tag==='run'){
    var s = [{d:6,h:3},{d:5,h:2},{d:6,h:16}];
    if(step[1]==='runK') return motionScript('hcf','LK');
    if(step[1]) s = s.concat(normalScript(step[1]));
    return s;
  }
  if(MOT[tag]||tag==='chargebf'||tag==='chargedu') return motionScript(tag, step[1]);
  return [{h:6}];
}

function buildCombo(combo){
  var s = [];
  for(var i=0;i<combo.length;i++){
    s = s.concat(parseStep(combo[i]));
    s.push({h:2});
  }
  return s;
}

function AIController(slot, level){
  this.slot = slot;
  this.level = Math.max(1, Math.min(8, level||4));
  this.script = null; this.si = 0; this.st = 0;
  this.cool = 0;
  this.holdDir = 5;
  this.holdT = 0;
  this.guarding = false;
  this.actions = 0;
  this.rng = Math.random;
}

AIController.prototype.queue = function(steps){
  this.script = steps; this.si = 0; this.st = 0;
  this.actions++;
};

AIController.prototype.get = function(f, battle){
  var out = { dir:5, pressed:{}, held:{} };
  if(battle.phase!=='fight'){ return out; }
  var e = f.enemy();
  if(!e || e.dead){ return out; }
  var L = this.level;

  // tech roll on landing
  if((f.state==='hitair'||f.state==='knockdown') && f.kd!=='hard' && f.y<14 && f.vy<0){
    if(this.rng() < 0.1*L){ out.pressed.AB = true; return out; }
  }

  // scripted sequence
  if(this.script){
    var step = this.script[this.si];
    if(step){
      if(step.d) out.dir = this.abs(step.d, f);
      if(step.b && this.st===0){ out.pressed[step.b]=true; out.held[step.b]=true; }
      this.st++;
      if(this.st>=step.h){ this.st=0; this.si++; }
      if(this.si>=this.script.length) this.script=null;
      return out;
    }
    this.script=null;
  }

  var dist = Math.abs(e.x - f.x);
  var actionable = ['idle','walkF','walkB','crouch','run'].indexOf(f.state)>=0;

  // defense: enemy attacking and close
  var danger = (e.state==='attack' && dist < 130) || this.projIncoming(f, battle);
  if(danger && actionable){
    var low = e.curMove && this.moveHitsLow(e.curMove);
    if(this.rng() < 0.18 + 0.09*L){
      this.guarding = true; this.holdT = 14 + L*2;
    }
    if(this.rng() < 0.02*L && f.ch.ai.anti && dist<70){
      this.queue(buildCombo([f.ch.ai.anti[0]]));
      return this.get(f, battle);
    }
    if(this.guarding){
      out.dir = this.abs(low || this.rng()<0.5 ? 1 : 4, f);
      this.holdT--;
      if(this.holdT<=0) this.guarding=false;
      return out;
    }
  }
  if(this.guarding){
    out.dir = this.abs(this.rng()<0.5?1:4, f);
    this.holdT--;
    if(this.holdT<=0) this.guarding=false;
    return out;
  }

  if(this.cool>0){
    this.cool--;
    // drift while cooling
    if(this.holdDir!==5) out.dir = this.abs(this.holdDir, f);
    return out;
  }
  if(!actionable) return out;

  var ai = f.ch.ai;
  var r = this.rng();

  // anti-air: enemy airborne approaching
  if(e.y>20 && dist<120 && ((e.x-f.x)*f.facing)>0){
    if(r < 0.12 + 0.1*L){
      this.queue(buildCombo([ai.anti[Math.floor(this.rng()*ai.anti.length)]]));
      return this.get(f, battle);
    }
  }
  // enemy lying: approach for meaty
  if(e.state==='lying'||e.state==='getup'){
    this.holdDir = 6; this.cool = 8;
    return this.get(f, battle);
  }

  // super attempt
  if(f.stocks>0 && (r < 0.02*L) && dist<170 && ai.superCombo){
    this.queue(buildCombo(ai.superCombo[Math.floor(this.rng()*ai.superCombo.length)]));
    return this.get(f, battle);
  }
  // MAX activation when strong position
  if(f.stocks>1 && f.maxT<=0 && f.hp<55 && r<0.01*L){
    out.pressed.MAX = true;
    this.cool = 10;
    return out;
  }

  if(dist > 190){
    if(r < 0.45){
      this.queue(buildCombo([ai.far[Math.floor(this.rng()*ai.far.length)]]));
    } else if(r < 0.8){
      this.holdDir = 6; this.cool = 18 + Math.floor(this.rng()*14);
    } else {
      this.queue([{d:9,h:4},{h:28}]);
    }
  } else if(dist > 95){
    if(r < 0.3){
      this.queue(buildCombo([ai.mid[Math.floor(this.rng()*ai.mid.length)]]));
    } else if(r < 0.55){
      this.queue(buildCombo([ai.combos[Math.floor(this.rng()*ai.combos.length)]]));
    } else if(r < 0.75){
      this.holdDir = 6; this.cool = 12;
    } else if(r < 0.85){
      this.holdDir = 4; this.cool = 10;
    } else {
      this.queue([{d:9,h:4},{d:5,h:10},{b:'HK',h:3},{h:24}]);
    }
  } else {
    if(r < 0.14 + 0.03*L && f.stocks>0 && ai.superCombo){
      this.queue(buildCombo(ai.superCombo[0]));
    } else if(r < 0.6){
      this.queue(buildCombo(ai.combos[Math.floor(this.rng()*ai.combos.length)]));
    } else if(r < 0.7){
      this.queue([{d:6,b:'HP',h:3}]); // throw attempt
    } else if(r < 0.8){
      this.queue([{d:1,b:'LK',h:3},{d:1,h:3},{d:1,b:'LP',h:3}]);
    } else if(r < 0.9){
      this.holdDir = 4; this.cool = 9;
    } else {
      this.queue([{b:'AB',h:3},{h:16}]); // roll
    }
  }
  this.cool = Math.max(this.cool, Math.max(3, 13 - L));
  return this.get(f, battle);
};

AIController.prototype.abs = function(rel, f){
  if(f.facing===1) return rel;
  var map = {1:3,3:1,4:6,6:4,7:9,9:7};
  return map[rel]||rel;
};
AIController.prototype.projIncoming = function(f, battle){
  var ps = battle.projectiles;
  for(var i=0;i<ps.length;i++){
    var p = ps[i];
    if(p.owner!==f && Math.abs(p.x-f.x)<130 && ((p.x<f.x&&p.vx>0)||(p.x>f.x&&p.vx<0))) return true;
  }
  return false;
};
AIController.prototype.moveHitsLow = function(mv){
  for(var i=0;i<mv.frames.length;i++){
    var h = mv.frames[i].hit;
    if(h && h.level==='low') return true;
  }
  return false;
};

// dummy controller for training
function DummyController(mode){
  this.mode = mode||'stand'; // stand|crouch|jump|blockAll|cpu
}
DummyController.prototype.get = function(f, battle){
  var out = {dir:5,pressed:{},held:{}};
  var e = f.enemy();
  switch(this.mode){
    case 'crouch': out.dir = 2; break;
    case 'jump': if(f.y===0 && f.state!=='prejump') out.dir = 8; break;
    case 'blockAll':
      if(e && (e.state==='attack' || battle.projectiles.length)){
        var low = e.curMove && e.curMove.frames.some(function(fr){ return fr.hit && fr.hit.level==='low'; });
        out.dir = (f.facing===1) ? (low?1:4) : (low?3:6);
      }
      break;
  }
  return out;
};

function HumanController(slot){ this.slot = slot; }
HumanController.prototype.get = function(){
  var P = KOF.Input.get(this.slot);
  return { dir:P.dir, pressed:P.pressed, held:P.held };
};

KOF.AI = { AIController:AIController, DummyController:DummyController, HumanController:HumanController, buildCombo:buildCombo, motionScript:motionScript };
})();
