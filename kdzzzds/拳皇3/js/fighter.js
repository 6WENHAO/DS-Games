(function(){
'use strict';
var KOF = window.KOF;

var MOTIONS = {
  qcf:[[2],[3],[6]], qcb:[[2],[1],[4]], dp:[[6],[2],[3]], rdp:[[4],[2],[1]],
  hcb:[[6],[2,3,1],[4]], hcf:[[4],[2,1,3],[6]], hcbf:[[6],[2,3,1],[4],[6]],
  qcfqcf:[[2],[3],[6],[2],[3],[6]], qcbqcb:[[2],[1],[4],[2],[1],[4]],
  qcbhcf:[[2],[1],[4],[2,1,3],[6]], hcbhcb:[[6],[2,3,1],[4],[6],[2,3,1],[4]]
};
var WINDOWS = { qcf:16, qcb:16, dp:22, rdp:22, hcb:26, hcf:26, hcbf:34, qcfqcf:36, qcbqcb:36, qcbhcf:40, hcbhcb:55 };

var GEN = {
  idle:   { frames:[{pose:'idleA',t:14},{pose:'idleB',t:14}], loop:true },
  walkF:  { frames:[{pose:'walk1',t:7},{pose:'walk2',t:7},{pose:'walk3',t:7},{pose:'walk4',t:7}], loop:true },
  walkB:  { frames:[{pose:'walk3',t:8},{pose:'walk2',t:8},{pose:'walk1',t:8},{pose:'walk4',t:8}], loop:true },
  run:    { frames:[{pose:'run1',t:5},{pose:'run2',t:5},{pose:'run3',t:5},{pose:'run2',t:5}], loop:true },
  crouch: { frames:[{pose:'crouch',t:20}], loop:true },
  crouchIn:{ frames:[{pose:'crouchIn',t:3}] },
  guardHi:{ frames:[{pose:'guardHi',t:10}], loop:true },
  guardLo:{ frames:[{pose:'guardLo',t:10}], loop:true },
  guardAir:{ frames:[{pose:'guardAir',t:10}], loop:true },
  hitHi:  { frames:[{pose:'hitHi',t:6},{pose:'hitHi2',t:20}] },
  hitGut: { frames:[{pose:'hitGut',t:26}] },
  hitLo:  { frames:[{pose:'hitLo',t:26}] },
  lying:  { frames:[{pose:'lieDown',t:40}] },
  getup:  { frames:[{pose:'getup1',t:8},{pose:'getup2',t:8}] },
  rollF:  { frames:[{pose:'rollA',t:8},{pose:'rollB',t:10},{pose:'rollA',t:8}] },
  rollB2: { frames:[{pose:'rollA',t:8},{pose:'rollB',t:10},{pose:'rollA',t:8}] },
  backdash:{ frames:[{pose:'backdash',t:16}] },
  landRec:{ frames:[{pose:'crouchIn',t:6}] },
  runStop:{ frames:[{pose:'crouchIn',t:5}] },
  maxflash:{ frames:[{pose:'chargePose',t:30}] },
  intro:  { frames:[{pose:'intro1',t:40},{pose:'idleA',t:20}] },
  dizzy:  { frames:[{pose:'dizzy',t:30}], loop:true }
};

function Fighter(chId, palIdx, ctrl, battle, slot){
  this.ch = KOF.Characters.get(chId);
  this.pal = palIdx;
  this.ctrl = ctrl;
  this.battle = battle;
  this.slot = slot;
  this.reset(120, 1);
}

Fighter.prototype.reset = function(x, facing){
  this.x = x; this.y = 0; this.vx = 0; this.vy = 0;
  this.facing = facing;
  this.hp = 100; this.maxHp = 100;
  this.meter = 0; this.stocks = 0; this.maxT = 0;
  this.state = 'idle';
  this.anim = GEN.idle; this.fi = 0; this.ft = 0;
  this.curMove = null; this.moveConnected = false; this.hitIds = {};
  this.hitstopT = 0; this.stunT = 0; this.invT = 0; this.invType = null;
  this.kd = null; this.techWin = 0;
  this.inbuf = []; this.chargeB = 0; this.chargeD = 0;
  this.airJumped = false; this.airAttacked = false; this.hopping = false; this.runJump = false;
  this.prejumpT = 0; this.prejumpDir = 5;
  this.hitFlash = 0; this.rekkaCount = 0;
  this.afterimages = [];
  this.throwVictim = null; this.thrownBy = null; this.grabSpec = null;
  this.introDone = false;
  this.lastRelDir = 5; this.guardPose = false;
  this.projCount = 0;
  this.juggleHP = 8;
  this.dead = false;
  this.instId = 0;
};

Fighter.prototype.enemy = function(){ return this.battle.other(this); };

Fighter.prototype.setAnim = function(a, state){
  this.anim = a; this.fi = 0; this.ft = 0;
  if(state) this.state = state;
  this.applyFrameFx();
};
Fighter.prototype.curFrame = function(){
  return this.anim.frames[Math.min(this.fi, this.anim.frames.length-1)];
};
Fighter.prototype.poseName = function(){
  var f = this.curFrame();
  return f ? f.pose : 'idleA';
};

Fighter.prototype.startMove = function(move, fromCancel){
  if(move.cost){ this.stocks -= move.cost; if(this.stocks<0){ this.stocks=0; } }
  this.curMove = move;
  this.moveConnected = false;
  this.hitIds = {};
  this.instId++;
  this.rekkaFrom = fromCancel==='rekka';
  this.setAnim(move, 'attack');
  if(move.type==='super' || move.type==='supergrab' || move.type==='hidden'){
    this.battle.superFlash(this);
  }
  if(this.y>0) this.airAttacked = true;
};

Fighter.prototype.applyFrameFx = function(){
  var f = this.curFrame();
  if(!f) return;
  if(f.vel){ this.vx = f.vel.x*this.facing; this.vy = f.vel.y||this.vy; if(f.vel.y>0) this.y = Math.max(this.y, 0.1); }
  if(f.addV){ this.vx += f.addV.x*this.facing; this.vy += (f.addV.y||0); }
  if(f.sfx) KOF.Audio.sfx(f.sfx);
  if(f.inv){ this.invT = f.t+2; this.invType = f.inv; }
  if(f.proj) this.battle.spawnProj(this, f.proj);
  if(f.fx) KOF.Effects.spawn(f.fx.kind, this.x + this.facing*f.fx.x, f.fx.y + this.y, {theme:f.fx.theme, scale:f.fx.scale||1, flip:this.facing, life:14});
  if(f.shake) this.battle.shake(f.shake);
  if(f.grabCheck) this.tryGrab();
};

Fighter.prototype.tryGrab = function(){
  var mv = this.curMove;
  if(!mv || !mv.grab) return;
  var e = this.enemy();
  if(!e || e.dead) return;
  var dx = Math.abs(e.x - this.x);
  var throwable = e.y===0 && ['idle','walkF','walkB','run','crouch','crouchIn','guardHi','guardLo','roll','landRec','runStop','attack'].indexOf(e.state)>=0 && e.stunT<=0;
  if(e.state==='attack' && mv.type!=='supergrab' && mv.grab.range<40) throwable = e.curMove && !e.curMove.air;
  if(e.invT>0 && e.invType==='full') throwable = false;
  if(dx <= mv.grab.range + 14 && throwable){
    this.battle.doThrow(this, e, mv.grab, mv.type==='supergrab');
  }
};

// ---- input helpers ----
Fighter.prototype.relDir = function(d){
  if(this.facing===1) return d;
  var map = {1:3,3:1,4:6,6:4,7:9,9:7};
  return map[d]||d;
};
Fighter.prototype.feedInput = function(inp, frame){
  var rd = this.relDir(inp.dir);
  this.lastRelDir = rd;
  if(inp.pressed && inp.pressed.AB) this.lastABf = frame;
  this.inbuf.push({d:rd, f:frame});
  if(this.inbuf.length>90) this.inbuf.shift();
  if(rd===4||rd===1||rd===7) this.chargeB++; else this.chargeB=0;
  if(rd===1||rd===2||rd===3) this.chargeD++; else this.chargeD=0;
};
Fighter.prototype.matchMotion = function(motion, frame){
  if(motion==='chargebf'){
    if(this.chargeBSaved>=38 && (this.lastRelDir===6||this.lastRelDir===9||this.lastRelDir===3)) return true;
    return false;
  }
  if(motion==='chargedu'){
    if(this.chargeDSaved>=38 && (this.lastRelDir===8||this.lastRelDir===7||this.lastRelDir===9)) return true;
    return false;
  }
  var pat = MOTIONS[motion];
  if(!pat) return false;
  var win = WINDOWS[motion]||20;
  var pi = pat.length-1;
  for(var i=this.inbuf.length-1;i>=0 && pi>=0;i--){
    var e = this.inbuf[i];
    if(frame - e.f > win) break;
    if(pat[pi].indexOf(e.d)>=0) pi--;
  }
  return pi<0;
};
Fighter.prototype.doubleTap = function(relDir, frame){
  var taps=0, prev=-1, sawNeutral=false;
  for(var i=this.inbuf.length-1;i>=0;i--){
    var e = this.inbuf[i];
    if(frame - e.f > 18) break;
    if(e.d!==prev){
      if(e.d===relDir){ if(taps===0 || sawNeutral) taps++; }
      else if(e.d===5) sawNeutral = taps>0;
      else if(taps>0) break;
      prev = e.d;
    }
  }
  return taps>=2;
};

// ---- main update ----
Fighter.prototype.update = function(frame){
  if(this.hitFlash>0) this.hitFlash--;
  if(this.hitstopT>0){ this.hitstopT--; return; }
  if(this.maxT>0){ this.maxT--; if(this.maxT===0){} }
  if(this.invT>0) this.invT--;

  var inp = this.ctrl ? this.ctrl.get(this, this.battle) : {dir:5,pressed:{},held:{}};
  this.lastInp = inp;
  this.feedInput(inp, frame);
  // save charge before actions consume
  this.chargeBSaved = Math.max(this.chargeBSaved||0, this.chargeB);
  this.chargeDSaved = Math.max(this.chargeDSaved||0, this.chargeD);
  if(this.chargeB===0 && this.lastRelDir!==6 && this.lastRelDir!==9 && this.lastRelDir!==3){ if(this.cbDecay===undefined)this.cbDecay=0; this.cbDecay++; if(this.cbDecay>8){this.chargeBSaved=0;this.cbDecay=0;} } else this.cbDecay=0;
  if(this.chargeD===0 && this.lastRelDir!==8 && this.lastRelDir!==7 && this.lastRelDir!==9){ if(this.cdDecay===undefined)this.cdDecay=0; this.cdDecay++; if(this.cdDecay>8){this.chargeDSaved=0;this.cdDecay=0;} } else this.cdDecay=0;

  var st = this.state;

  // physics for airborne states
  var airStates = ['air','hitair','knockdown','thrown'];
  if(airStates.indexOf(st)>=0 || (st==='attack' && this.y>0) || st==='backdash'){
    this.y += this.vy;
    this.x += this.vx;
    this.vy -= this.ch.stats.grav * (st==='hitair'||st==='knockdown' ? 1.05 : 1);
    if(this.y<=0){
      this.y=0;
      this.onLand(inp, frame);
      return;
    }
  } else if(st!=='attack' && st!=='thrown'){
    this.x += this.vx;
    this.vx *= 0.72;
    if(Math.abs(this.vx)<0.1) this.vx=0;
  }

  switch(st){
    case 'intro':
      this.stepAnim();
      if(this.animDone()){ this.state='idle'; this.setAnim(GEN.idle); this.introDone=true; }
      break;
    case 'win':
    case 'lose':
      this.stepAnim();
      break;
    case 'idle': case 'walkF': case 'walkB':
      this.groundActions(inp, frame, false);
      break;
    case 'run':
      this.x += this.ch.stats.run * this.facing;
      if(this.relDir(inp.dir)!==6 && this.relDir(inp.dir)!==9 && this.relDir(inp.dir)!==3){
        this.setAnim(GEN.runStop,'runStop'); break;
      }
      this.runActions(inp, frame);
      this.stepAnim();
      break;
    case 'runStop':
      this.stepAnim();
      if(this.animDone()){ this.state='idle'; this.setAnim(GEN.idle); }
      break;
    case 'crouchIn':
      this.stepAnim();
      if(this.animDone()){ this.state='crouch'; this.setAnim(GEN.crouch); }
      this.groundActions(inp, frame, true);
      break;
    case 'crouch':
      this.groundActions(inp, frame, true);
      break;
    case 'prejump':
      this.prejumpT--;
      if(this.relDir(inp.dir)>=7) this.prejumpHeld = true;
      if(this.prejumpT<=0){
        var full = this.prejumpHeld;
        var vy = full ? this.ch.stats.jumpVY : this.ch.stats.hopVY;
        var vx = 0;
        var pd = this.prejumpDir;
        if(pd===9) vx = this.ch.stats.jumpVX*(this.runJump?1.5:1);
        else if(pd===7) vx = -this.ch.stats.jumpVX;
        this.vy = vy; this.vx = vx*this.facing;
        this.y = 0.1;
        this.state='air'; this.setAnim({frames:[{pose:'jumpUp',t:99}]});
        KOF.Audio.sfx('jump');
      }
      break;
    case 'air':
      // air pose by vy
      var p = this.vy>2 ? 'jumpUp' : (this.vy<-2 ? 'jumpDn' : 'jumpTop');
      this.anim = {frames:[{pose:p,t:99}]};
      this.airActions(inp, frame);
      break;
    case 'attack':
      this.attackUpdate(inp, frame);
      break;
    case 'guardHi': case 'guardLo': case 'guardAir':
      this.stunT--;
      if(this.stunT<=0){
        if(st==='guardAir'){ this.state='air'; }
        else if(st==='guardLo'){ this.state='crouch'; this.setAnim(GEN.crouch); }
        else { this.state='idle'; this.setAnim(GEN.idle); }
      }
      break;
    case 'hitstun':
      this.stunT--;
      this.stepAnim();
      if(this.stunT<=0){ this.state='idle'; this.setAnim(GEN.idle); }
      break;
    case 'hitair': case 'knockdown':
      // tumbling in air; landing handled by physics above
      break;
    case 'lying':
      this.stunT--;
      if(this.stunT<=0){
        if(this.dead){ break; }
        this.state='getup'; this.setAnim(GEN.getup);
        this.invT = 18; this.invType='full';
      }
      break;
    case 'getup':
      this.stepAnim();
      if(this.animDone()){ this.state='idle'; this.setAnim(GEN.idle); }
      break;
    case 'roll':
      this.x += this.rollDir * 3.1 * this.facing;
      this.stepAnim();
      if(this.animDone()){ this.state='idle'; this.setAnim(GEN.idle); }
      break;
    case 'backdash':
      this.stepAnim();
      break;
    case 'landRec':
      this.stepAnim();
      if(this.animDone()){ this.state='idle'; this.setAnim(GEN.idle); }
      break;
    case 'maxflash':
      this.stepAnim();
      if(this.animDone()){ this.state='idle'; this.setAnim(GEN.idle); }
      break;
    case 'throwing':
      this.throwUpdate();
      break;
    case 'thrown':
      break;
    case 'dizzy':
      this.stunT--;
      this.stepAnim();
      if(this.stunT<=0){ this.state='idle'; this.setAnim(GEN.idle); }
      break;
  }

  // afterimage record
  if(this.maxT>0 || (this.curMove && (this.curMove.type==='super'||this.curMove.type==='hidden') && this.state==='attack')){
    this.afterimages.push({pose:this.poseName(), x:this.x, y:this.y, f:this.facing, a:0.5});
  } else if(this.afterimages.length){
    this.afterimages.push({pose:this.poseName(), x:this.x, y:this.y, f:this.facing, a:0.25});
  }
  while(this.afterimages.length>5) this.afterimages.shift();
  if(!(this.maxT>0) && !(this.curMove && this.state==='attack')) this.afterimages.shift();
};

Fighter.prototype.onLand = function(inp, frame){
  var st = this.state;
  this.vy = 0;
  if(st==='hitair' || st==='knockdown'){
    // tech (recovery roll)?
    if(this.kd!=='hard' && !this.dead && this.recentPress('AB', frame, 10)){
      KOF.Audio.sfx('tech');
      KOF.Effects.spawn('dust', this.x, 4, {life:12});
      this.state='roll'; this.rollDir = -1;
      this.setAnim(GEN.rollF);
      this.invT = 24; this.invType='full';
      this.vx = 0;
      return;
    }
    KOF.Audio.sfx('land');
    KOF.Effects.spawn('dust', this.x, 4, {life:12});
    this.battle.shake(2);
    this.state='lying'; this.setAnim(GEN.lying);
    this.stunT = this.dead ? 9999 : (this.kd==='hard' ? 34 : 24);
    this.vx = 0;
    return;
  }
  if(st==='attack'){
    var mv = this.curMove;
    if(mv && mv.landCancel){
      KOF.Audio.sfx('land');
      this.curMove=null;
      this.state='landRec';
      var lag = mv.landLag||6;
      this.setAnim({frames:[{pose:'crouchIn',t:lag}]});
      this.airAttacked=false;
      this.vx=0;
      return;
    }
    if(mv){
      // find land frame
      for(var i=this.fi+1;i<mv.frames.length;i++){
        if(mv.frames[i].land){ this.fi=i; this.ft=0; this.vx=0; this.applyFrameFx(); return; }
      }
      this.endMove();
      this.vx=0;
      return;
    }
  }
  if(st==='backdash'){
    this.state='landRec'; this.setAnim({frames:[{pose:'crouchIn',t:4}]});
    this.vx=0;
    return;
  }
  // normal jump landing
  KOF.Audio.sfx('land');
  this.airAttacked=false; this.vx=0;
  this.state='landRec'; this.setAnim({frames:[{pose:'crouchIn',t:4}]});
};

Fighter.prototype.recentPress = function(btn, frame, win){
  if(btn==='AB') return this.lastABf!==undefined && (frame - this.lastABf) <= win;
  return this.lastInp && this.lastInp.pressed[btn];
};

Fighter.prototype.stepAnim = function(){
  this.ft++;
  var f = this.curFrame();
  if(f && this.ft >= f.t){
    this.ft = 0;
    this.fi++;
    if(this.fi >= this.anim.frames.length){
      if(this.anim.loop) this.fi = 0;
      else this.fi = this.anim.frames.length-1;
    } else {
      this.applyFrameFx();
    }
  }
};
Fighter.prototype.animDone = function(){
  return !this.anim.loop && this.fi >= this.anim.frames.length-1 && this.ft >= this.curFrame().t-1;
};

Fighter.prototype.endMove = function(){
  this.curMove = null;
  if(this.y>0){ this.state='air'; this.setAnim({frames:[{pose:'jumpDn',t:99}]}); }
  else { this.state='idle'; this.setAnim(GEN.idle); }
};

// ---- actions from neutral ----
Fighter.prototype.groundActions = function(inp, frame, crouching){
  var rd = this.relDir(inp.dir);
  var P = inp.pressed;

  // MAX activation
  if((P.MAX || (P.LP&&P.LK&&P.HP)) && this.stocks>0 && this.maxT<=0){
    this.stocks--; this.maxT = 600;
    this.state='maxflash'; this.setAnim(GEN.maxflash);
    KOF.Audio.sfx('meterMax');
    KOF.Effects.spawn('aura', this.x, 45, {theme:this.ch.palettes[0].aura||'fire', life:30, loop:true, scale:1.2});
    this.battle.shake(4);
    this.battle.popup(this, 'MAX!');
    return;
  }
  // roll
  if(P.AB || (P.LP&&P.LK)){
    this.state='roll';
    this.rollDir = (rd===4||rd===1||rd===7) ? -1 : 1;
    this.setAnim(this.rollDir>0?GEN.rollF:GEN.rollB2);
    this.invT = 18; this.invType='strike';
    KOF.Audio.sfx('roll');
    return;
  }
  // attacks
  if(this.tryAttacks(inp, frame, crouching?'crouch':'stand')) return;

  // movement
  if(!crouching){
    if(rd>=7){ // jump
      this.state='prejump'; this.prejumpT=3; this.prejumpDir=rd; this.prejumpHeld=false; this.runJump=false;
      this.setAnim({frames:[{pose:'crouchIn',t:4}]});
      return;
    }
    if(rd===1||rd===2||rd===3){ this.state='crouchIn'; this.setAnim(GEN.crouchIn); return; }
    if(rd===6){
      if(this.doubleTap(6, frame)){ this.state='run'; this.setAnim(GEN.run); return; }
      if(this.state!=='walkF'){ this.state='walkF'; this.setAnim(GEN.walkF); }
      this.x += this.ch.stats.walk * this.facing;
      this.stepAnim();
      return;
    }
    if(rd===4){
      if(this.doubleTap(4, frame)){
        this.state='backdash'; this.setAnim(GEN.backdash);
        this.vx = -2.7*this.facing; this.vy = 2.6; this.y=0.1;
        this.invT=8; this.invType='strike';
        KOF.Audio.sfx('roll');
        return;
      }
      if(this.state!=='walkB'){ this.state='walkB'; this.setAnim(GEN.walkB); }
      this.x -= this.ch.stats.back * this.facing;
      this.stepAnim();
      return;
    }
    if(this.state!=='idle'){ this.state='idle'; this.setAnim(GEN.idle); }
    this.stepAnim();
  } else {
    if(rd>3){ // stand up
      this.state='idle'; this.setAnim(GEN.idle);
      return;
    }
    if(this.state==='crouch') this.stepAnim();
  }
};

Fighter.prototype.runActions = function(inp, frame){
  var P = inp.pressed;
  var rd = this.relDir(inp.dir);
  if(rd>=7){
    this.state='prejump'; this.prejumpT=3; this.prejumpDir=9; this.prejumpHeld=false; this.runJump=true;
    this.setAnim({frames:[{pose:'crouchIn',t:4}]});
    return;
  }
  if(P.AB || (P.LP&&P.LK)){
    this.state='roll'; this.rollDir=1;
    this.setAnim(GEN.rollF);
    this.invT=18; this.invType='strike';
    KOF.Audio.sfx('roll');
    return;
  }
  this.tryAttacks(inp, frame, 'stand');
};

Fighter.prototype.airActions = function(inp, frame){
  if(this.airAttacked) return;
  var P = inp.pressed;
  // air specials
  if(this.trySpecials(inp, frame, true)) return;
  var M = this.ch.moves;
  if(P.HP&&P.HK){ this.startMove(M.jCD); return; }
  if(P.HP){ this.startMove(M.jHP); return; }
  if(P.HK){ this.startMove(M.jHK); return; }
  if(P.LP){ this.startMove(M.jLP); return; }
  if(P.LK){ this.startMove(M.jLK); return; }
};

Fighter.prototype.trySpecials = function(inp, frame, airborne){
  var P = inp.pressed;
  var sp = this.ch.specials;
  var anyP = P.LP||P.HP, anyK = P.LK||P.HK;
  if(!anyP && !anyK) return false;
  for(var i=0;i<sp.length;i++){
    var s = sp[i];
    var btnHit = (s.btn==='P'&&anyP)||(s.btn==='K'&&anyK)||(P[s.btn]);
    if(!btnHit) continue;
    var mvId = s.move;
    var strength = 'L';
    if(s.btn==='P' && P.HP) strength='H';
    if(s.btn==='K' && P.HK) strength='H';
    if(s.moveL) mvId = strength==='H' ? s.moveH : s.moveL;
    if(airborne && s.airMove) mvId = s.airMove;
    var mv = this.ch.moves[mvId];
    if(!mv) continue;
    if(airborne && mv.air!=='only' && mv.air!==true) continue;
    if(!airborne && mv.air==='only') continue;
    if(mv.type==='super'||mv.type==='supergrab'){
      if(this.stocks < (mv.cost||1)) continue;
      if(mv.desperation && !(this.maxT>0 || this.hp<=30)) continue;
    }
    if(!this.matchMotion(s.motion, frame)) continue;
    if(s.motion==='chargebf') this.chargeBSaved=0;
    if(s.motion==='chargedu') this.chargeDSaved=0;
    this.startMove(mv);
    return true;
  }
  return false;
};

Fighter.prototype.tryAttacks = function(inp, frame, stance){
  var P = inp.pressed;
  var rd = this.relDir(inp.dir);
  var M = this.ch.moves;
  if(this.trySpecials(inp, frame, false)) return true;
  // throw
  if(P.HP && (rd===4||rd===6)){
    var e = this.enemy();
    if(e && e.y===0 && Math.abs(e.x-this.x)<44 && e.stunT<=0 && !e.dead && ['lying','getup','hitair','knockdown','thrown'].indexOf(e.state)<0 && !(e.invT>0 && e.invType==='full')){
      this.startMove(rd===4 ? M.throwB : M.throwF);
      return true;
    }
  }
  // CD
  if(P.HP&&P.HK){ this.startMove(M.CD); return true; }
  // command normal
  if(P.HK && rd===6 && this.ch.hasFHK && stance==='stand'){ this.startMove(M.fHK); return true; }
  var pre = stance==='crouch' ? 'c' : 's';
  if(P.HP){ this.startMove(M[pre+'HP']); return true; }
  if(P.HK){ this.startMove(M[pre+'HK']); return true; }
  if(P.LP){ this.startMove(M[pre+'LP']); return true; }
  if(P.LK){ this.startMove(M[pre+'LK']); return true; }
  return false;
};

// ---- attack state ----
Fighter.prototype.attackUpdate = function(inp, frame){
  var mv = this.curMove;
  if(!mv){ this.endMove(); return; }
  var f = this.curFrame();
  // dive kick special-case: keep falling
  if(f.diveLoop && this.y<=0){ /* handled by onLand */ }
  if(f.airGrav || f.diveLoop){
    // physics handled at top-level for y>0
  } else if(this.y===0 && !f.vel){
    this.vx *= 0.8;
    this.x += this.vx;
  } else if(this.y===0 && f.vel){
    this.x += this.vx;
  }
  // cancel windows
  if(f.cancel && this.moveConnected){
    var P = inp.pressed;
    if(this.trySpecials(inp, frame, this.y>0)) return;
    if(f.cancel==='all' || f.cancel==='chain'){
      var M = this.ch.moves;
      var pre = mv.crouch ? 'c':'s';
      if(P.LP && mv.id!==pre+'LP'){ this.startMove(M[pre+'LP'],'chain'); return; }
      if(P.LK && mv.id!==pre+'LK'){ this.startMove(M[pre+'LK'],'chain'); return; }
      // light -> heavy target chain
      if(P.HP){ this.startMove(M[pre+'HP'],'chain'); return; }
      if(P.HK){ this.startMove(M[pre+'HK'],'chain'); return; }
    }
  }
  // rekka followup
  if(f.rekkaWin && mv.rekkaNext && this.rekkaCount<3){
    if(this.matchMotion('qcb', frame) && (inp.pressed.LP||inp.pressed.HP)){
      this.rekkaCount++;
      this.startMove(this.ch.moves[mv.rekkaNext],'rekka');
      return;
    }
  }
  this.stepAnim();
  if(this.animDone()){
    this.rekkaCount = 0;
    if(mv.onEnd==='crouch'){ this.curMove=null; this.state='crouch'; this.setAnim(GEN.crouch); }
    else this.endMove();
  }
};

// ---- throws ----
Fighter.prototype.throwUpdate = function(){
  this.stepAnim();
  var seq = this.throwSeq;
  if(!seq) { this.endMove(); this.state='idle'; return; }
  seq.t++;
  var v = this.throwVictim;
  if(seq.t < seq.holdT){
    if(v){ v.x = this.x + this.facing*26; v.y = Math.max(6, 20 - Math.abs(seq.t-seq.holdT/2)); }
  } else if(!seq.released){
    seq.released = true;
    if(v){
      var back = seq.grab.back;
      var dir = back ? -this.facing : this.facing;
      v.thrownBy = null;
      v.state='knockdown'; v.kd='hard';
      v.setAnim({frames:[{pose:'flyBack',t:99}]});
      v.vx = dir*3.6; v.vy = 5.2; v.y = Math.max(v.y, 18);
      var dmg = seq.grab.dmg;
      this.battle.applyThrowDamage(this, v, dmg, seq.grab);
      if(seq.grab.pillar){
        KOF.Effects.spawn('pillar', v.x, 55, {theme:seq.grab.pillar, life:20, scale:1.2});
        KOF.Audio.sfx('fireHit');
      }
      if(seq.grab.superFx){
        KOF.Effects.spawn('bolt', v.x, 70, {theme:seq.grab.superFx, life:18, scale:1.4});
        this.battle.shake(8);
        KOF.Audio.sfx('explode');
      } else KOF.Audio.sfx('throwHit');
      this.battle.shake(4);
      if(back) { /* side switch happens naturally */ }
    }
  }
  if(this.animDone()){
    this.throwVictim=null; this.throwSeq=null;
    this.endMove();
  }
};

// ---- hurt/guard ----
Fighter.prototype.hurtboxes = function(){
  var st = this.state;
  if(st==='lying' || (st==='getup'&&this.fi===0)) return [];
  if(this.invT>0 && this.invType==='full') return [];
  var h;
  if(st==='crouch'||st==='crouchIn'||st==='guardLo'||st==='hitLo'|| (this.curMove&&this.curMove.crouch&&st==='attack'))
    h = [{x:0,y:28,w:32,h:56}];
  else if(this.y>0 || st==='hitair'||st==='knockdown')
    h = [{x:0,y:52,w:34,h:64}];
  else if(st==='roll')
    h = [{x:0,y:24,w:30,h:48}];
  else
    h = [{x:2,y:45,w:30,h:88}];
  if(this.invT>0 && this.invType==='upper') h = h.map(function(b){ return {x:b.x,y:b.y*0.4,w:b.w,h:b.h*0.45}; });
  if(this.invT>0 && this.invType==='strike') return [];
  return h;
};
Fighter.prototype.hitboxes = function(){
  if(this.state!=='attack' || !this.curMove) return [];
  var f = this.curFrame();
  if(!f || !f.hit) return [];
  var id = this.instId + ':' + this.fi;
  return [{hit:f.hit, id:id}];
};

Fighter.prototype.isBlocking = function(level){
  var rd = this.lastRelDir;
  var back = rd===4||rd===1||rd===7;
  if(!back) return false;
  if(this.y>0){
    return level!=='low';
  }
  var crouched = rd===1;
  var blockStates = ['idle','walkF','walkB','crouch','crouchIn','guardHi','guardLo','guardAir'];
  if(blockStates.indexOf(this.state)<0) return false;
  if(level==='low' && !crouched) return false;
  if(level==='oh' && crouched) return false;
  return true;
};

Fighter.prototype.setHitstun = function(frames, animKey){
  this.state='hitstun';
  this.stunT = frames;
  this.setAnim(GEN[animKey]||GEN.hitHi);
};

Fighter.prototype.launch = function(vy, vx){
  this.state='hitair';
  this.setAnim({frames:[{pose:'hitAir',t:99}]});
  this.vy = vy; this.vx = vx;
  this.y = Math.max(this.y, 0.5);
};

Fighter.prototype.knockdownFly = function(vx, vy, hard){
  this.state='knockdown';
  this.kd = hard?'hard':'soft';
  this.setAnim({frames:[{pose:'flyBack',t:99}]});
  this.vx = vx; this.vy = vy;
  this.y = Math.max(this.y, 0.5);
};

Fighter.prototype.setWin = function(){
  if(this.state==='win') return;
  this.state='win';
  this.curMove=null;
  var wp = this.ch.winPose||'winA';
  this.setAnim({frames:[{pose:'idleA',t:20},{pose:wp,t:120}]});
};
Fighter.prototype.setIntro = function(){
  this.state='intro';
  this.setAnim(GEN.intro);
};

// ---- draw ----
Fighter.prototype.draw = function(ctx, camX, groundY){
  var PP = KOF.Puppet;
  // afterimages
  for(var i=0;i<this.afterimages.length;i++){
    var ai = this.afterimages[i];
    var acv = PP.frame(this.ch, ai.pose, this.pal, false);
    if(acv){
      ctx.save();
      ctx.globalAlpha = 0.14 + i*0.05;
      ctx.translate(Math.round(ai.x - camX), Math.round(groundY - ai.y));
      ctx.scale(ai.f, 1);
      ctx.drawImage(acv, -PP.CX, -PP.GY);
      ctx.restore();
    }
  }
  // aura
  if(this.maxT>0){
    var afr = KOF.Effects.frame('aura', this.ch.palettes[this.pal] ? (this.ch.palettes[0].aura||'fire') : 'fire', Math.floor(this.battle.frame/4)%2);
    if(afr){
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(afr, Math.round(this.x-camX-afr.width/2), Math.round(groundY-this.y-88), afr.width, 92);
      ctx.restore();
    }
  }
  var flash = this.hitFlash>0 && (this.hitFlash%2===0);
  var cv = PP.frame(this.ch, this.poseName(), this.pal, flash);
  if(cv){
    ctx.save();
    ctx.translate(Math.round(this.x - camX), Math.round(groundY - this.y));
    ctx.scale(this.facing, 1);
    ctx.drawImage(cv, -PP.CX, -PP.GY);
    ctx.restore();
  }
  // shadow
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  var sw = Math.max(10, 26 - this.y*0.08);
  ctx.fillRect(Math.round(this.x-camX-sw/2), groundY-2, Math.round(sw), 4);
  ctx.restore();
};

KOF.Fighter = Fighter;
KOF.GEN_ANIMS = GEN;
})();
