(function(){
'use strict';
var KOF = window.KOF;
var S = KOF.SVG;
var W = 480, H = 270, GY = 230, WORLD = 800;

function mkCtrl(spec, slot){
  if(spec==='human') return new KOF.AI.HumanController(slot);
  if(spec==='dummy') return new KOF.AI.DummyController('stand');
  return new KOF.AI.AIController(slot, spec && spec.level ? spec.level : 4);
}

function Battle(cfg){
  this.cfg = cfg;
  this.mode = cfg.mode||'vs';
  this.stage = cfg.stage||'street';
  this.teams = [
    { ids: cfg.p1.team.slice(), idx:0, ctrlSpec: cfg.p1.ctrl, level: cfg.p1.level||4, pal: cfg.p1.pal||0 },
    { ids: cfg.p2.team.slice(), idx:0, ctrlSpec: cfg.p2.ctrl, level: cfg.p2.level||4, pal: cfg.p2.pal||1 }
  ];
  if(this.teams[0].pal===this.teams[1].pal) this.teams[1].pal = 1-this.teams[0].pal;
  this.frame = 0;
  this.roundNo = 0;
  this.camX = 160;
  this.projectiles = [];
  this.popups = [];
  this.shakeT = 0; this.shakeA = 0;
  this.superFlashT = 0; this.superFlashOwner = null;
  this.combo = [0,0];
  this.comboTimer = [0,0];
  this.maxCombo = [0,0];
  this.comboShow = [0,0];
  this.comboDmg = [0,0];
  this.paused = false;
  this.slow = 0;
  this.result = null;
  this.training = this.mode==='training';
  this.eve = this.mode==='eve';
  this.dummyMode = 'stand';
  this.metrics = [ this.mkMetric(), this.mkMetric() ];
  this.inputHist = [];
  this.fighters = [null,null];
  this.startRound(true);
}

Battle.prototype.mkMetric = function(){
  return { dmg:0, hits:0, attacks:0, blocks:0, throwsDone:0, specials:0, supers:0, maxComboM:0, meterUsed:0, moveSet:{}, koTime:0 };
};

Battle.prototype.other = function(f){ return f===this.fighters[0]?this.fighters[1]:this.fighters[0]; };

Battle.prototype.startRound = function(first){
  this.roundNo++;
  var b = this;
  for(var i=0;i<2;i++){
    var t = this.teams[i];
    var chId = t.ids[t.idx];
    var carry = null;
    if(this.fighters[i] && !this.fighters[i].dead && this.fighters[i].ch.id===chId){
      carry = { hp:this.fighters[i].hp, stocks:this.fighters[i].stocks, meter:this.fighters[i].meter };
    }
    var ctrl = mkCtrl(t.ctrlSpec, i);
    if(this.training && i===1) { ctrl = new KOF.AI.DummyController(this.dummyMode); this.dummyCtrl = ctrl; }
    var f = new KOF.Fighter(chId, t.pal, ctrl, this, i);
    f.reset(i===0 ? 330 : 470, i===0 ? 1 : -1);
    if(carry){
      f.hp = Math.min(100, carry.hp + 18 + Math.floor(this.timeLeft!==undefined? (this.timeLeft*0.2):0));
      f.stocks = carry.stocks; f.meter = carry.meter;
    }
    if(this.training){ f.stocks = 3; }
    this.fighters[i] = f;
    KOF.Puppet.preload(f.ch, f.pal);
  }
  this.projectiles = [];
  KOF.Effects.clear();
  this.combo = [0,0]; this.comboTimer=[0,0]; this.comboShow=[0,0]; this.comboDmg=[0,0];
  this.timeLeft = this.training ? 99 : 60;
  this.timerFrames = 0;
  this.phase = 'intro';
  this.phaseT = first? 100 : 80;
  this.fighters[0].setIntro();
  this.fighters[1].setIntro();
  this.koT = 0;
  this.camX = 160;
};

Battle.prototype.superFlash = function(f){
  this.superFlashT = 42;
  this.superFlashOwner = f;
  KOF.Audio.sfx('superFlash');
  this.shake(3);
  var m = this.metrics[f.slot]; m.supers++;
};

Battle.prototype.shake = function(a){
  this.shakeT = Math.max(this.shakeT, 4 + a);
  this.shakeA = Math.max(this.shakeA, a);
};

Battle.prototype.popup = function(f, text){
  this.popups.push({ text:text, x:f? f.x : this.camX+240, y: f? 110 : 80, t:40, big:false });
};
Battle.prototype.bigText = function(text, t){
  this.popups.push({ text:text, x:this.camX+240, y:100, t:t||60, big:true, fixed:true });
};

Battle.prototype.spawnProj = function(f, spec){
  if(!spec.beam){
    var count = 0;
    for(var i=0;i<this.projectiles.length;i++) if(this.projectiles[i].owner===f && !this.projectiles[i].spec.beam) count++;
    if(count>=1) return;
  }
  this.projectiles.push({
    owner:f, spec:spec,
    x: f.x + f.facing*spec.x, y: spec.y + (f.y||0),
    vx: spec.vx*f.facing, vy: spec.vy||0,
    life: spec.life, delay: spec.delay||0,
    hitsLeft: spec.hits, hitCd:0, dead:false, age:0, facing:f.facing
  });
};

// =============== main step ===============
Battle.prototype.update = function(){
  if(this.paused) return;
  this.frame++;

  if(this.superFlashT>0){
    this.superFlashT--;
    if(this.superFlashT===20) KOF.Effects.spawn('ring', this.superFlashOwner.x, 50, {theme:'hit', life:14, scale:1.6});
    KOF.Effects.update();
    return;
  }
  if(this.slow>0 && (this.frame%2===0)){
    this.slow--;
    KOF.Effects.update();
    this.updatePopups();
    return;
  }
  if(this.slow>0) this.slow--;

  var f1 = this.fighters[0], f2 = this.fighters[1];

  if(this.phase==='intro'){
    this.phaseT--;
    f1.stepAnim(); f2.stepAnim();
    if(this.phaseT===50){ this.bigText('ROUND '+this.roundNo, 45); KOF.Audio.sfx('round'); KOF.Audio.announce('Round '+this.roundNo); }
    if(this.phaseT<=0){
      this.phase='fight';
      f1.state='idle'; f1.setAnim(KOF.GEN_ANIMS.idle);
      f2.state='idle'; f2.setAnim(KOF.GEN_ANIMS.idle);
      this.bigText('FIGHT!', 36);
      KOF.Audio.sfx('fight');
      KOF.Audio.announce('Fight');
    }
    this.updateCamera();
    this.updatePopups();
    KOF.Effects.update();
    return;
  }

  if(this.phase==='fight'){
    // timer
    if(!this.training){
      this.timerFrames++;
      if(this.timerFrames>=60){
        this.timerFrames=0; this.timeLeft--;
        if(this.timeLeft<=10 && this.timeLeft>0) KOF.Audio.sfx('timeTick');
        if(this.timeLeft<=0){ this.timeUp(); }
      }
    }
    // track attack starts for metrics
    for(var s=0;s<2;s++){
      var f = this.fighters[s];
      if(f.state==='attack' && f.curMove && f._lastInst!==f.instId){
        f._lastInst = f.instId;
        var m = this.metrics[s];
        m.attacks++;
        m.moveSet[f.curMove.id] = (m.moveSet[f.curMove.id]||0)+1;
        if(f.curMove.type==='special') m.specials++;
        if(f.curMove.cost) m.meterUsed += f.curMove.cost;
      }
    }
  }

  f1.update(this.frame);
  f2.update(this.frame);

  this.resolvePush();
  this.updateFacing();
  this.updateProjectiles();
  if(this.phase==='fight'){
    this.resolveHits();
  }
  this.clampFighters();
  this.updateCamera();
  this.updateMeters();
  this.updateCombo();
  this.updatePopups();
  KOF.Effects.update();
  if(this.shakeT>0) this.shakeT--;

  if(this.training) this.trainingRegen();

  if(this.phase==='ko' || this.phase==='timeup'){
    this.koT--;
    if(this.koT<=0) this.endRound();
  }
  if(this.phase==='roundEnd'){
    this.phaseT--;
    if(this.phaseT<=0) this.nextRoundOrEnd();
  }
  // input history for training
  if(this.training){
    var P = KOF.Input.get(0);
    var sym = this.inputSymbol(P);
    if(sym){
      var last = this.inputHist[this.inputHist.length-1];
      if(!last || last.s!==sym || this.frame-last.f>6) this.inputHist.push({s:sym, f:this.frame});
      if(this.inputHist.length>14) this.inputHist.shift();
    }
  }
};

Battle.prototype.inputSymbol = function(P){
  var arrows = {1:'↙',2:'↓',3:'↘',4:'←',6:'→',7:'↖',8:'↑',9:'↗'};
  var s = '';
  if(arrows[P.dir]) s += arrows[P.dir];
  var btns = ['LP','LK','HP','HK','AB','CD'];
  for(var i=0;i<btns.length;i++) if(P.pressed[btns[i]]) s += btns[i]+' ';
  return s.trim()||null;
};

Battle.prototype.trainingRegen = function(){
  var f1 = this.fighters[0], f2 = this.fighters[1];
  if(this.combo[0]===0 && this.combo[1]===0 && f2.state!=='hitstun' && f2.state!=='hitair' && f2.state!=='knockdown' && f2.state!=='lying'){
    if(f1.hp<100) f1.hp = Math.min(100, f1.hp+0.5);
    if(f2.hp<100) f2.hp = Math.min(100, f2.hp+0.5);
  }
  f1.stocks = Math.max(f1.stocks, 3);
  f2.stocks = 3;
  this.timeLeft = 99;
};

Battle.prototype.resolvePush = function(){
  var a = this.fighters[0], b = this.fighters[1];
  if(a.y===0 && b.y===0 && ['lying','getup','thrown','throwing'].indexOf(a.state)<0 && ['lying','getup','thrown','throwing'].indexOf(b.state)<0){
    var dx = b.x - a.x;
    var minD = 30;
    if(Math.abs(dx)<minD){
      var push = (minD - Math.abs(dx))/2;
      var dir = dx>=0?1:-1;
      a.x -= push*dir; b.x += push*dir;
    }
  }
};

Battle.prototype.updateFacing = function(){
  for(var i=0;i<2;i++){
    var f = this.fighters[i], e = this.other(f);
    var can = ['idle','walkF','walkB','crouch','crouchIn','run'].indexOf(f.state)>=0;
    if(can){
      var want = e.x>f.x?1:(e.x<f.x?-1:f.facing);
      if(want!==f.facing){
        f.facing = want;
        f.inbuf = []; f.chargeB=0;
      }
    }
  }
};

Battle.prototype.clampFighters = function(){
  for(var i=0;i<2;i++){
    var f = this.fighters[i];
    f.x = Math.max(40, Math.min(WORLD-40, f.x));
  }
  // corner push: if defender against wall while being pushed, move attacker
  var a=this.fighters[0], b=this.fighters[1];
  for(var j=0;j<2;j++){
    var d = this.fighters[j], at = this.other(d);
    if((d.x<=40||d.x>=WORLD-40) && (d.state==='hitstun'||d.state==='guardHi'||d.state==='guardLo') && Math.abs(d.x-at.x)<44 && at.y===0){
      at.x -= at.facing*2.4;
    }
  }
  // max separation
  var dx = Math.abs(a.x-b.x);
  if(dx>420){
    var mid = (a.x+b.x)/2;
    if(a.x<b.x){ a.x = mid-210; b.x = mid+210; }
    else { a.x = mid+210; b.x = mid-210; }
  }
};

Battle.prototype.updateCamera = function(){
  var a=this.fighters[0], b=this.fighters[1];
  var target = (a.x+b.x)/2 - W/2;
  target = Math.max(0, Math.min(WORLD-W, target));
  this.camX += (target-this.camX)*0.18;
};

Battle.prototype.updateMeters = function(){
  for(var i=0;i<2;i++){
    var f = this.fighters[i];
    while(f.meter>=100 && f.stocks<3){ f.meter-=100; f.stocks++; KOF.Audio.sfx('menuSel'); }
    if(f.stocks>=3) f.meter = Math.min(f.meter, 99);
  }
};

Battle.prototype.updateCombo = function(){
  for(var i=0;i<2;i++){
    var def = this.fighters[1-i];
    var inCombo = ['hitstun','hitair','knockdown','thrown'].indexOf(def.state)>=0 || def.hitstopT>0;
    if(!inCombo){
      if(this.combo[i]>1){ this.comboShow[i] = 90; this.maxCombo[i]=Math.max(this.maxCombo[i],this.combo[i]); this.metrics[i].maxComboM = Math.max(this.metrics[i].maxComboM, this.combo[i]); }
      this.combo[i]=0;
      if(this.comboShow[i]>0) this.comboShow[i]--; else this.comboDmg[i]=0;
    } else {
      this.comboShow[i]=0;
    }
  }
};

Battle.prototype.updatePopups = function(){
  for(var i=this.popups.length-1;i>=0;i--){
    var p = this.popups[i];
    p.t--;
    if(!p.fixed) p.y -= 0.4;
    if(p.t<=0) this.popups.splice(i,1);
  }
};

// =============== combat ===============
function rectsOverlap(r1, r2){
  return r1[0] < r2[0]+r2[2] && r2[0] < r1[0]+r1[2] && r1[1] < r2[1]+r2[3] && r2[1] < r1[1]+r1[3];
}
function boxW(f, b){
  var cx = f.x + f.facing*b.x;
  var cy = b.y + (b.abs? 0 : f.y);
  return [cx-b.w/2, cy-b.h/2, b.w, b.h];
}

Battle.prototype.resolveHits = function(){
  var events = [];
  for(var i=0;i<2;i++){
    var at = this.fighters[i], df = this.fighters[1-i];
    if(at.hitstopT>0) continue;
    var hbs = at.hitboxes();
    if(!hbs.length) continue;
    var hurt = df.hurtboxes();
    if(!hurt.length) continue;
    for(var h=0;h<hbs.length;h++){
      var hb = hbs[h];
      if(at.hitIds[hb.id]) continue;
      var hr = boxW(at, hb.hit);
      for(var u=0;u<hurt.length;u++){
        var ur = boxW(df, hurt[u]);
        if(rectsOverlap(hr, ur)){
          events.push({at:at, df:df, hit:hb.hit, id:hb.id});
          break;
        }
      }
    }
  }
  for(var e=0;e<events.length;e++) this.applyHit(events[e].at, events[e].df, events[e].hit, events[e].id, false);
};

Battle.prototype.applyHit = function(at, df, hit, id, isProj){
  if(!isProj) at.hitIds[id]=true;
  if(!isProj) at.moveConnected = true;
  var slot = at.slot;
  var m = this.metrics[slot];

  // blocked?
  if(df.isBlocking(hit.level) && !hit.unblockable){
    var chip = hit.chip|| (at.curMove && (at.curMove.type!=='normal') ? Math.ceil(hit.dmg*0.12) : 0);
    if(isProj) chip = hit.chip||1;
    df.hp -= chip;
    df.stunT = hit.bs;
    var crouched = df.lastRelDir===1;
    df.state = df.y>0?'guardAir':(crouched?'guardLo':'guardHi');
    df.setAnim(df.y>0?KOF.GEN_ANIMS.guardAir:(crouched?KOF.GEN_ANIMS.guardLo:KOF.GEN_ANIMS.guardHi));
    df.state = df.y>0?'guardAir':(crouched?'guardLo':'guardHi');
    df.vx = at.facing*hit.push*0.9;
    df.hitstopT = Math.max(2,hit.stop-3);
    at.hitstopT = Math.max(2,hit.stop-3);
    KOF.Audio.sfx('block');
    var gx = df.x - at.facing*8;
    KOF.Effects.spawn('spark', gx, hit.y*0.5+df.y+30, {theme:'guard', life:10});
    at.meter += hit.dmg*0.35;
    df.meter += 2;
    this.metrics[1-slot].blocks++;
    if(df.hp<=0){ df.hp=0; this.kill(at, df, hit); }
    return;
  }

  // counter?
  var counter = df.state==='attack' && !df.moveConnected;
  var scale = Math.max(0.3, 1 - 0.07*this.combo[slot]);
  var dmg = hit.dmg * scale * (df.ch.stats.def||1) * (at.maxT>0?1.2:1) * (at.ch.stats.dmgBoost||1) * (counter?1.25:1);
  dmg = Math.max(1, Math.round(dmg*10)/10);
  df.hp -= dmg;
  m.dmg += dmg; m.hits++;
  this.combo[slot]++;
  this.comboDmg[slot]+=dmg;
  at.meter += dmg*0.9;
  df.meter += dmg*0.5;
  df.hitFlash = 8;
  df.hitstopT = hit.stop;
  at.hitstopT = hit.stop;
  if(counter){ this.popup(df,'COUNTER!'); KOF.Audio.sfx('counter'); }
  KOF.Audio.sfx(hit.sfx||'hitL');
  var sx = df.x - at.facing*6;
  var sy = Math.min(hit.y + (df.y>0?df.y:0), 100);
  KOF.Effects.spawn(hit.spark||'spark', sx, sy, {theme:hit.theme||'hit', life:12, flip:at.facing});
  if(hit.stop>=9) this.shake(hit.stop>=12?4:2);

  var dead = df.hp<=0;
  if(dead){ df.hp=0; this.kill(at, df, hit); return; }

  var airborne = df.y>0 || df.state==='hitair' || df.state==='knockdown';
  if(airborne){
    // juggle
    df.launch(Math.max(3.4, (hit.launch||3.8)*0.8), at.facing*Math.max(1.4,hit.push*0.7));
    df.kd = hit.kd||'soft';
    if(!hit.kd) df.kd='soft';
  } else if(hit.launch){
    df.launch(hit.launch, at.facing*hit.push*0.6);
    df.kd = hit.kd||'soft';
  } else if(hit.kd){
    df.knockdownFly(at.facing*(hit.knockback||3), 4.6, hit.kd==='hard');
  } else {
    var animKey = 'hitHi';
    if(df.state==='crouch'||df.state==='crouchIn'||(df.curMove&&df.curMove.crouch)) animKey='hitLo';
    else if(hit.level==='low') animKey='hitLo';
    else if(hit.dmg>=8) animKey='hitGut';
    df.curMove=null;
    df.setHitstun(hit.hs + (counter?6:0), animKey);
    df.vx = at.facing*hit.push;
  }
};

Battle.prototype.kill = function(at, df, hit){
  df.dead = true;
  df.curMove = null;
  df.knockdownFly(at.facing*4.4, 6.4, true);
  this.phase='ko';
  this.koT = 110;
  this.slow = 40;
  this.bigText('K.O.', 80);
  KOF.Audio.sfx('ko');
  KOF.Audio.announce('K O');
  this.shake(8);
  this.metrics[at.slot].koTime = this.frame;
  var winner = at===this.fighters[0]||at===this.fighters[1] ? at : this.other(df);
};

Battle.prototype.applyThrowDamage = function(at, v, dmg, grab){
  var total = dmg * (v.ch.stats.def||1) * (at.maxT>0?1.2:1);
  v.hp -= total;
  at.meter += total*0.8;
  this.combo[at.slot] = 1;
  this.comboDmg[at.slot] = total;
  this.metrics[at.slot].dmg += total;
  this.metrics[at.slot].hits++;
  this.metrics[at.slot].throwsDone++;
  v.hitFlash = 8;
  if(v.hp<=0){ v.hp=0; this.kill(at, v, null); }
};

Battle.prototype.doThrow = function(at, v, grab, isSuper){
  at.state='throwing';
  at.throwSeq = { t:0, holdT:isSuper?26:16, grab:grab, released:false };
  at.throwVictim = v;
  at.setAnim({frames:[{pose:'grabLift',t:isSuper?18:10},{pose:'throwToss',t:14},{pose:'idleA',t:8}]});
  at.state='throwing';
  v.curMove=null;
  v.state='thrown';
  v.setAnim({frames:[{pose:'thrownHeld',t:99}]});
  v.facing = -at.facing;
  v.vx=0; v.vy=0;
  KOF.Audio.sfx('whooshH');
};

// =============== projectiles ===============
Battle.prototype.updateProjectiles = function(){
  for(var i=this.projectiles.length-1;i>=0;i--){
    var p = this.projectiles[i];
    if(p.owner.hitstopT>0 && p.spec.beam){ continue; }
    p.age++;
    if(p.delay>0){ p.delay--; continue; }
    p.x += p.vx; p.y += p.vy;
    if(p.spec.grav) p.vy -= p.spec.grav;
    p.life--;
    if(p.hitCd>0) p.hitCd--;
    if(p.life<=0 || p.x<-40 || p.x>WORLD+40 || p.y<0){
      this.projectiles.splice(i,1);
      continue;
    }
    // vs other projectiles
    if(!p.spec.beam){
      for(var j=this.projectiles.length-1;j>=0;j--){
        var q = this.projectiles[j];
        if(q===p || q.owner===p.owner || q.spec.beam || q.delay>0) continue;
        if(Math.abs(q.x-p.x)<(p.spec.w+q.spec.w)/2 && Math.abs(q.y-p.y)<(p.spec.h+q.spec.h)/2){
          KOF.Effects.spawn('boom', (p.x+q.x)/2, (p.y+q.y)/2, {theme:'hit', life:14});
          KOF.Audio.sfx('fireHit');
          p.dead = true; q.dead = true;
        }
      }
    }
    if(p.dead){ this.projectiles.splice(i,1); continue; }
    // vs fighters
    var df = this.other(p.owner);
    if(df && !df.dead && this.phase==='fight'){
      var hurt = df.hurtboxes();
      var pr = [p.x-p.spec.w/2, p.y-p.spec.h/2, p.spec.w, p.spec.h];
      for(var u=0;u<hurt.length;u++){
        var ur = boxW(df, hurt[u]);
        if(rectsOverlap(pr, ur) && p.hitCd<=0){
          var hit = {
            x:0,y:p.y,w:p.spec.w,h:p.spec.h, dmg:p.spec.dmg, hs:p.spec.hs, bs:p.spec.bs,
            push:p.spec.push, stop:p.spec.stop, level:p.spec.level, launch:p.spec.launch,
            kd:p.spec.kd, sfx:p.spec.hitSfx||'hitM', spark:p.spec.spark||'boom', theme:p.spec.theme,
            chip:p.spec.chip, juggle:1
          };
          var fakeAt = p.owner;
          var oldFacing = fakeAt.facing;
          fakeAt.facing = p.vx>0?1:(p.vx<0?-1:p.facing);
          this.applyHit(fakeAt, df, hit, 'proj', true);
          fakeAt.facing = oldFacing;
          fakeAt.hitstopT = 0;
          p.hitsLeft--;
          p.hitCd = p.spec.hitEvery||8;
          if(p.hitsLeft<=0){ this.projectiles.splice(i,1); }
          break;
        }
      }
    }
  }
};

Battle.prototype.drawProjectiles = function(ctx){
  for(var i=0;i<this.projectiles.length;i++){
    var p = this.projectiles[i];
    var fi = Math.floor(p.age/4)%KOF.Effects.framesOf(p.spec.kind);
    var cv = KOF.Effects.frame(p.spec.kind, p.spec.theme, fi);
    if(!cv) continue;
    ctx.save();
    var px = Math.round(p.x - this.camX), py = Math.round(GY - p.y);
    if(p.delay>0){
      ctx.globalAlpha = 0.4;
      var g = 1 - p.delay/ (p.spec.delay||10);
      ctx.translate(px, GY - (p.spec.kind==='pillar'||p.spec.kind==='shard'? 0 : p.y));
      ctx.scale(1, Math.max(0.1,g));
      ctx.drawImage(cv, -cv.width/2, -cv.height + (p.spec.kind==='orb'? cv.height/2:0));
    } else if(p.spec.beam){
      ctx.globalAlpha = 0.85 + 0.15*Math.sin(p.age*0.8);
      ctx.translate(px, py);
      if(p.facing<0) ctx.scale(-1,1);
      ctx.drawImage(cv, -p.spec.w/2, -p.spec.h/2, p.spec.w, p.spec.h);
    } else if(p.spec.kind==='pillar'||p.spec.kind==='shard'){
      ctx.translate(px, GY);
      ctx.drawImage(cv, -p.spec.w/2 - 4, -cv.height*(p.spec.h/cv.height), p.spec.w+8, p.spec.h);
    } else {
      ctx.translate(px, py);
      if(p.vx<0) ctx.scale(-1,1);
      ctx.drawImage(cv, -cv.width/2, -cv.height/2);
    }
    ctx.restore();
  }
};

// =============== round end / result ===============
Battle.prototype.timeUp = function(){
  this.phase='timeup';
  this.koT = 90;
  this.bigText('TIME UP', 70);
  KOF.Audio.sfx('ko');
  var a=this.fighters[0], b=this.fighters[1];
  if(a.hp===b.hp){ b.dead=true; }
  else if(a.hp>b.hp) b.dead = true;
  else a.dead = true;
};

Battle.prototype.endRound = function(){
  var a=this.fighters[0], b=this.fighters[1];
  var loser = a.dead? a : b;
  var winner = a.dead? b : a;
  if(a.dead && b.dead) { winner = b; loser = a; }
  winner.setWin();
  if(winner.hp>=100) this.bigText('PERFECT!', 60);
  this.phase='roundEnd';
  this.phaseT = 110;
  this.winnerSlot = winner.slot;
  KOF.Audio.sfx('win');
  if(!this.training){
    var lt = this.teams[loser.slot];
    lt.idx++;
  }
};

Battle.prototype.nextRoundOrEnd = function(){
  var lt0 = this.teams[0], lt1 = this.teams[1];
  if(this.training){ this.startRound(false); return; }
  if(lt0.idx >= lt0.ids.length || lt1.idx >= lt1.ids.length){
    if(this.result) return;
    this.result = {
      winner: lt0.idx>=lt0.ids.length ? 1 : 0,
      metrics: this.metrics,
      maxCombo: this.maxCombo,
      frames: this.frame
    };
    this.phase = 'matchEnd';
    if(this.cfg.onEnd) this.cfg.onEnd(this.result);
    return;
  }
  this.startRound(false);
};

// =============== drawing ===============
Battle.prototype.draw = function(ctx){
  var sx=0, sy=0;
  if(this.shakeT>0){
    sx = Math.round((Math.random()*2-1)*this.shakeA);
    sy = Math.round((Math.random()*2-1)*this.shakeA*0.6);
  }
  ctx.save();
  ctx.translate(sx, sy);
  KOF.Stages.draw(ctx, this.stage, this.camX, this.frame);

  var order = this.fighters[0].y>this.fighters[1].y ? [0,1] : [1,0];
  // draw further-back (non-active) first: use last-hit ordering simple
  this.fighters[order[0]].draw(ctx, this.camX, GY);
  this.fighters[order[1]].draw(ctx, this.camX, GY);
  this.drawProjectiles(ctx);
  KOF.Effects.draw(ctx, this.camX, GY);

  // super flash overlay
  if(this.superFlashT>0){
    ctx.fillStyle = 'rgba(0,0,24,0.62)';
    ctx.fillRect(-8,-8,W+16,H+16);
    if(this.superFlashOwner) this.superFlashOwner.draw(ctx, this.camX, GY);
  }
  ctx.restore();

  this.drawHUD(ctx);
  this.drawPopups(ctx);
  if(this.training) this.drawTraining(ctx);
  if(this.eve) this.drawEveOverlay(ctx);
};

Battle.prototype.hudBarFrame = function(){
  var key = 'hud:barframe';
  var cv = S.get(key);
  if(!cv && !S.has(key)){
    var s = S.open(184, 15);
    s += S.rect(0,0,184,15,'#10101c');
    s += S.rect(1,1,182,13,'#2a2a44');
    s += S.rect(2,2,180,11,'#0a0a12');
    s += S.poly([[0,0],[8,0],[0,8]],'#8a8ac0');
    s += S.close;
    S.raster(key, s, 184, 15);
  }
  return S.get(key);
};

Battle.prototype.drawHUD = function(ctx){
  var Font = KOF.Font;
  for(var i=0;i<2;i++){
    var f = this.fighters[i];
    var right = i===1;
    var bx = right? 264 : 32;
    // portrait
    var pt = KOF.Puppet.portrait(f.ch, f.pal, false);
    if(pt) ctx.drawImage(pt, right? 450:4, 4, 26, 26);
    ctx.strokeStyle = '#c8a030'; ctx.lineWidth=1;
    ctx.strokeRect(right? 450:4, 4, 26, 26);
    // bar frame
    var bf = this.hudBarFrame();
    if(bf) ctx.drawImage(bf, bx, 8);
    // hp fill
    var hpw = Math.max(0, Math.round(180 * f.hp/100));
    var hpColor = f.hp>30 ? '#f8d838' : '#e03030';
    ctx.fillStyle = '#701818';
    ctx.fillRect(bx+2, 10, 180, 9);
    if(hpw>0){
      ctx.fillStyle = hpColor;
      if(right) ctx.fillRect(bx+2+(180-hpw), 10, hpw, 9);
      else ctx.fillRect(bx+2, 10, hpw, 9);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      if(right) ctx.fillRect(bx+2+(180-hpw), 10, hpw, 2);
      else ctx.fillRect(bx+2, 10, hpw, 2);
    }
    // name
    Font.auto(ctx, f.ch.ename, right? bx+182: bx+2, 25, {color:'#fff', outline:'#101020', size:8, align: right?'right':'left'});
    // team pips
    var t = this.teams[i];
    for(var p2=0;p2<t.ids.length;p2++){
      var alive = p2 >= t.idx;
      var px = right? 440 - p2*10 : 32 + p2*10;
      ctx.fillStyle = alive? '#ffd23c' : '#443';
      ctx.fillRect(px, 33, 7, 4);
      ctx.strokeStyle = '#000'; ctx.strokeRect(px+0.5, 33.5, 7, 4);
    }
    // power gauge
    var gx = right? 318 : 10;
    ctx.fillStyle = '#10101c';
    ctx.fillRect(gx, 251, 152, 10);
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(gx+1, 252, 150, 8);
    var mw = Math.round(150 * Math.min(1, f.meter/100));
    if(f.stocks<3 && mw>0){
      ctx.fillStyle = '#3878e0';
      if(right) ctx.fillRect(gx+1+(150-mw), 252, mw, 8);
      else ctx.fillRect(gx+1, 252, mw, 8);
    }
    for(var st=0; st<f.stocks; st++){
      var sxp = right? 448 - st*16 : 14 + st*16;
      ctx.fillStyle = (this.frame%20<10)?'#ffd23c':'#ff9a1c';
      ctx.fillRect(sxp, 253, 12, 6);
      ctx.strokeStyle='#000'; ctx.strokeRect(sxp+0.5,253.5,12,6);
    }
    if(f.maxT>0){
      Font.draw(ctx, 'MAX', right? gx+120: gx+4, 242, {scale:1, color:(this.frame%10<5)?'#ff4040':'#ffd23c', outline:'#200'});
      ctx.strokeStyle = '#ff4040';
      ctx.strokeRect(gx+0.5, 250.5, 152, 11);
    }
    // combo counter
    if(this.combo[i]>1 || this.comboShow[i]>0){
      var cnum = this.combo[i]>1? this.combo[i] : this.maxCombo[i];
      if(cnum>1){
        var cx = right? 430 : 20;
        Font.draw(ctx, String(cnum), right? cx+20:cx, 62, {scale:3, color:'#ff4020', outline:'#fff', align:right?'right':'left'});
        Font.draw(ctx, 'HITS!', right? cx+20:cx, 86, {scale:1, color:'#ffd23c', outline:'#402', align:right?'right':'left'});
        if(this.comboDmg[i]>0 && (this.training||this.eve))
          Font.draw(ctx, 'DMG '+Math.round(this.comboDmg[i]), right? cx+20:cx, 96, {scale:1, color:'#fff', outline:'#204', align:right?'right':'left'});
      }
    }
  }
  // timer
  var tstr = this.training? '--' : String(Math.max(0,this.timeLeft));
  if(tstr.length<2) tstr = '0'+tstr;
  ctx.fillStyle = '#10101c';
  ctx.fillRect(222, 4, 36, 26);
  ctx.strokeStyle = '#c8a030'; ctx.strokeRect(222.5,4.5,36,25);
  KOF.Font.draw(ctx, tstr, 240, 8, {scale:2, color: this.timeLeft<=10? '#ff4040':'#fff', outline:'#000', align:'center'});
};

Battle.prototype.drawPopups = function(ctx){
  for(var i=0;i<this.popups.length;i++){
    var p = this.popups[i];
    var alpha = p.t<10 ? p.t/10 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    if(p.big){
      var scale = p.t> (p.big&&p.t>50? 50:44) ? 4 : 3;
      KOF.Font.draw(ctx, p.text, 240, 96, {scale:4, color:'#ffd23c', outline:'#801010', align:'center'});
    } else {
      var px = Math.round(p.x - this.camX);
      KOF.Font.draw(ctx, p.text, px, Math.round(p.y), {scale:1, color:'#ffd23c', outline:'#401', align:'center'});
    }
    ctx.restore();
  }
};

Battle.prototype.drawTraining = function(ctx){
  var Font = KOF.Font;
  Font.drawCJK(ctx, '训练模式  F1:假人切换['+this.dummyLabel()+']  F2:位置重置  ESC:菜单', 8, 236, {size:8, color:'#a8e8a8', outline:'#102010'});
  var xx = 8;
  for(var i=0;i<this.inputHist.length;i++){
    var e = this.inputHist[i];
    Font.drawCJK(ctx, e.s, xx, 222, {size:8, color:'#fff', outline:'#000'});
    xx += KOF.Font.measureCJK(e.s, 8)+6;
    if(xx>300) break;
  }
};
Battle.prototype.dummyLabel = function(){
  return {stand:'站立',crouch:'蹲下',jump:'跳跃',blockAll:'全防',cpu:'CPU'}[this.dummyMode]||this.dummyMode;
};
Battle.prototype.cycleDummy = function(){
  var modes = ['stand','crouch','jump','blockAll','cpu'];
  var idx = (modes.indexOf(this.dummyMode)+1)%modes.length;
  this.dummyMode = modes[idx];
  if(this.dummyMode==='cpu'){
    this.fighters[1].ctrl = new KOF.AI.AIController(1, 4);
  } else {
    this.fighters[1].ctrl = new KOF.AI.DummyController(this.dummyMode);
  }
};
Battle.prototype.resetPositions = function(){
  var f1=this.fighters[0], f2=this.fighters[1];
  f1.reset(330,1); f2.reset(470,-1);
  f1.stocks=3; f2.stocks=3;
  this.projectiles=[];
  KOF.Effects.clear();
  this.phase='fight';
};

Battle.prototype.drawEveOverlay = function(ctx){
  var Font = KOF.Font;
  ctx.fillStyle = 'rgba(0,0,10,0.55)';
  ctx.fillRect(150, 200, 180, 46);
  ctx.strokeStyle = '#3878e0'; ctx.strokeRect(150.5,200.5,180,46);
  Font.drawCJK(ctx, 'EVE 对抗质量监测', 240, 202, {size:8, color:'#7ac8ff', align:'center'});
  var m0=this.metrics[0], m1=this.metrics[1];
  var acc0 = m0.attacks? Math.round(100*m0.hits/m0.attacks):0;
  var acc1 = m1.attacks? Math.round(100*m1.hits/m1.attacks):0;
  Font.drawCJK(ctx, '出招 '+m0.attacks+' | 命中 '+acc0+'% | 伤害 '+Math.round(m0.dmg), 156, 214, {size:7, color:'#ffd8a0'});
  Font.drawCJK(ctx, '出招 '+m1.attacks+' | 命中 '+acc1+'% | 伤害 '+Math.round(m1.dmg), 156, 224, {size:7, color:'#a0c8ff'});
  Font.drawCJK(ctx, '连段 '+this.maxCombo[0]+' / '+this.maxCombo[1]+'  防御 '+m0.blocks+'/'+m1.blocks+'  超杀 '+m0.supers+'/'+m1.supers, 156, 234, {size:7, color:'#c8c8c8'});
};

KOF.Battle = Battle;
KOF.BATTLE_W = W; KOF.BATTLE_H = H; KOF.BATTLE_GY = GY;
})();
