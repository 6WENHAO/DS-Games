(function(){
'use strict';
var KOF = window.KOF;
var S = KOF.SVG;
var Font = KOF.Font;
var W=480, H=270;

// ---------- helpers ----------
function Nav(){
  this.prevDir = [5,5];
  this.repeat = [0,0];
}
Nav.prototype.poll = function(slot){
  var P = KOF.Input.get(slot);
  var d = P.dir;
  var out = { up:false, down:false, left:false, right:false,
    ok: P.pressed.LP || P.pressed.START, back: P.pressed.LK, alt: P.pressed.HP, start: P.pressed.START };
  var prev = this.prevDir[slot];
  var moved = d!==prev;
  if(moved){ this.repeat[slot]=0; }
  else { this.repeat[slot]++; }
  var rep = this.repeat[slot]>14 && (this.repeat[slot]%6===0);
  if((moved||rep)){
    if(d===8||d===7||d===9) out.up = d===8||rep&&d===8;
    if(d===8) out.up = true;
    if(d===2) out.down = true;
    if(d===4||d===1) out.left = true;
    if(d===6||d===3) out.right = true;
  }
  this.prevDir[slot] = d;
  return out;
};

function bgKey(name){ return 'ui:'+name; }
function menuBg(name, hue){
  var key = bgKey(name);
  var cv = S.get(key);
  if(!cv && !S.has(key)){
    var s = S.open(W,H);
    s += S.rect(0,0,W,H,'#0a0a18');
    for(var i=0;i<14;i++){
      s += S.rect(0, 20*i, W, 1, i%2? '#12122a':'#161632');
    }
    for(var j=0;j<10;j++){
      s += S.poly([[48*j,H],[48*j+24,0],[48*j+26,0],[48*j+2,H]], 'rgba(40,40,90,0.25)');
    }
    s += S.rect(0,0,W,40,'#0e0e20');
    s += S.rect(0,H-30,W,30,'#0e0e20');
    s += S.rect(0,40,W,2, hue||'#c8a030');
    s += S.rect(0,H-32,W,2, hue||'#c8a030');
    s += S.close;
    S.raster(key, s, W, H);
  }
  return S.get(key);
}
function logo(){
  var key = 'ui:logo';
  var cv = S.get(key);
  if(!cv && !S.has(key)){
    var s = S.open(360,110);
    s += S.poly([[6,86],[354,86],[344,96],[16,96]], '#8a1c1c');
    for(var dx=-2;dx<=2;dx++)for(var dy=-2;dy<=2;dy++){ if(dx||dy) s += S.text(178+dx, 58+dy, '格斗之魂', 44, '#4a0d0d', 'middle'); }
    s += S.text(178, 58, '格斗之魂', 44, '#ffd23c', 'middle');
    s += S.text(178, 56, '格斗之魂', 44, '#fff2a8', 'middle');
    for(var dx2=-2;dx2<=2;dx2++)for(var dy2=-2;dy2<=2;dy2++){ if(dx2||dy2) s += S.text(312+dx2, 100+dy2, "'97", 34, '#40080a'); }
    s += S.text(312, 100, "'97", 34, '#ff3030');
    s += S.text(178, 80, 'FIGHTING SOUL', 13, '#c8c8e8', 'middle');
    s += S.close;
    S.raster(key, s, 360, 110);
  }
  return S.get(key);
}
function drawCursorBox(ctx, x, y, w, h, t){
  var blink = (t%30)<20;
  ctx.strokeStyle = blink? '#ffd23c':'#ff8020';
  ctx.lineWidth = 2;
  ctx.strokeRect(x+0.5,y+0.5,w,h);
}

// ============ TITLE ============
var SceneTitle = {
  enter: function(){
    this.t=0; this.sel=0; this.nav = new Nav();
    this.items = ['街机模式','双人对战','人机对战','训练模式','EVE 观战','按键设置'];
    KOF.Audio.music('menu');
  },
  update: function(){
    this.t++;
    var n = this.nav.poll(0);
    var n2 = this.nav.poll(1);
    if(n.up||n2.up){ this.sel=(this.sel+this.items.length-1)%this.items.length; KOF.Audio.sfx('menuMove'); }
    if(n.down||n2.down){ this.sel=(this.sel+1)%this.items.length; KOF.Audio.sfx('menuMove'); }
    if(n.ok||n2.ok){
      KOF.Audio.sfx('menuSel');
      switch(this.sel){
        case 0: KOF.Game.set(SceneCharSel, {mode:'arcade'}); break;
        case 1: KOF.Game.set(SceneCharSel, {mode:'vs'}); break;
        case 2: KOF.Game.set(SceneCharSel, {mode:'vscpu'}); break;
        case 3: KOF.Game.set(SceneCharSel, {mode:'training'}); break;
        case 4: KOF.Game.set(SceneEveSetup, {}); break;
        case 5: KOF.Game.set(SceneKeys, {}); break;
      }
    }
  },
  draw: function(ctx){
    var bg = menuBg('title');
    if(bg) ctx.drawImage(bg,0,0);
    var lg = logo();
    if(lg) ctx.drawImage(lg, 60, 18 + Math.sin(this.t*0.03)*2);
    for(var i=0;i<this.items.length;i++){
      var y = 138+i*18;
      var seld = i===this.sel;
      Font.drawCJK(ctx, this.items[i], 240, y, {size:12, color: seld?'#ffd23c':'#9090b0', outline: seld?'#602000':'#101018', align:'center'});
      if(seld){
        Font.drawCJK(ctx, '▶', 168, y, {size:12, color:'#ff8020'});
      }
    }
    Font.draw(ctx, 'ALL ART 100% SVG - 1997 STYLE ARCADE FIGHTER', 240, 250, {scale:1, color:'#606080', align:'center'});
    Font.drawCJK(ctx, 'P1: WASD移动 U/I拳 J/K脚 O闪避 L重击 P爆气 | 回车确认', 240, 232, {size:8, color:'#8888a8', align:'center'});
  }
};

// ============ CHARACTER SELECT ============
var SceneCharSel = {
  enter: function(args){
    this.mode = args.mode;
    this.t=0; this.nav = new Nav();
    this.roster = KOF.Characters.ROSTER.concat(['shenwei']);
    this.teamSize = this.mode==='training' ? 1 : 3;
    this.cursor = [0, 1];
    this.picks = [[],[]];
    this.phase = 0; // 0: p1 picking, 1: p2 picking (if human), 2: done
    this.p2human = this.mode==='vs';
    KOF.Audio.music('select');
  },
  activeSlot: function(){ return this.phase===1 ? 1 : 0; },
  update: function(){
    this.t++;
    if(this.phase===2){
      this.doneT--;
      if(this.doneT<=0) this.launch();
      return;
    }
    var slot = this.activeSlot();
    var n = this.nav.poll(slot);
    var cols = 4;
    if(n.left){ this.cursor[slot]=(this.cursor[slot]+this.roster.length-1)%this.roster.length; KOF.Audio.sfx('menuMove'); }
    if(n.right){ this.cursor[slot]=(this.cursor[slot]+1)%this.roster.length; KOF.Audio.sfx('menuMove'); }
    if(n.up){ this.cursor[slot]=(this.cursor[slot]+this.roster.length-cols)%this.roster.length; KOF.Audio.sfx('menuMove'); }
    if(n.down){ this.cursor[slot]=(this.cursor[slot]+cols)%this.roster.length; KOF.Audio.sfx('menuMove'); }
    if(n.back && this.picks[slot].length>0){ this.picks[slot].pop(); KOF.Audio.sfx('menuBack'); }
    else if(n.back && this.phase===0){ KOF.Game.set(SceneTitle,{}); KOF.Audio.sfx('menuBack'); return; }
    if(n.ok){
      var id = this.roster[this.cursor[slot]];
      if(this.picks[slot].indexOf(id)<0){
        this.picks[slot].push(id);
        KOF.Audio.sfx('menuSel');
        if(this.picks[slot].length>=this.teamSize){
          if(this.phase===0 && this.p2human){ this.phase=1; }
          else { this.finishPicks(); }
        }
      }
    }
  },
  finishPicks: function(){
    // fill AI team
    if(!this.p2human && this.mode!=='training'){
      var pool = KOF.Characters.ROSTER.slice();
      this.picks[1]=[];
      while(this.picks[1].length<this.teamSize){
        var id = pool.splice(Math.floor(Math.random()*pool.length),1)[0];
        this.picks[1].push(id);
      }
    }
    if(this.mode==='training' && this.picks[1].length===0){
      this.picks[1]=[ this.roster[this.cursor[0]]==='yanlong'?'yueying':'yanlong' ];
    }
    this.phase=2; this.doneT=40;
  },
  launch: function(){
    var stage = KOF.Stages.LIST[Math.floor(Math.random()*KOF.Stages.LIST.length)];
    if(this.mode==='arcade'){
      KOF.Game.arcade = { stageIdx:0, team:this.picks[0].slice(), wins:0 };
      startArcadeBattle();
    } else if(this.mode==='training'){
      KOF.Game.set(SceneBattle, { cfg:{
        mode:'training', stage:stage,
        p1:{team:this.picks[0], ctrl:'human'},
        p2:{team:this.picks[1], ctrl:'dummy'}
      }});
    } else {
      KOF.Game.set(SceneVS, { cfg:{
        mode:'vs', stage:stage,
        p1:{team:this.picks[0], ctrl:'human'},
        p2:{team:this.picks[1], ctrl: this.p2human?'human':{level:5}}
      }, ret:'vs'});
    }
  },
  draw: function(ctx){
    var bg = menuBg('charsel','#3878e0');
    if(bg) ctx.drawImage(bg,0,0);
    Font.drawCJK(ctx, this.mode==='arcade'?'街机模式 - 选择你的队伍':(this.mode==='training'?'训练模式 - 选择角色':'选择队伍'), 240, 12, {size:13, color:'#ffd23c', outline:'#402', align:'center'});
    var cols = 4;
    var gx = 128, gy = 48, cw = 56, chh = 56;
    for(var i=0;i<this.roster.length;i++){
      var id = this.roster[i];
      var ch = KOF.Characters.get(id);
      var x = gx + (i%cols)*cw, y = gy + Math.floor(i/cols)*chh;
      ctx.fillStyle = '#181830';
      ctx.fillRect(x,y,48,48);
      var pt = KOF.Puppet.portrait(ch, 0, true);
      if(pt) ctx.drawImage(pt, x, y);
      ctx.strokeStyle = '#404060'; ctx.strokeRect(x+0.5,y+0.5,48,48);
      if(ch.boss) Font.draw(ctx,'BOSS',x+24,y+40,{scale:1,color:'#ff4040',outline:'#000',align:'center'});
      Font.drawCJK(ctx, ch.name, x+24, y+49, {size:9, color:'#c8c8e0', align:'center'});
      for(var s2=0;s2<2;s2++){
        if(this.picks[s2].indexOf(id)>=0){
          ctx.fillStyle = s2===0? 'rgba(224,64,64,0.35)':'rgba(64,96,224,0.35)';
          ctx.fillRect(x,y,48,48);
          Font.draw(ctx, String(this.picks[s2].indexOf(id)+1), x+(s2===0?6:38), y+6, {scale:1, color:'#fff', outline:'#000'});
        }
      }
    }
    if(this.phase!==2){
      var slot = this.activeSlot();
      var c = this.cursor[slot];
      var cx = gx+(c%cols)*cw, cy = gy+Math.floor(c/cols)*chh;
      drawCursorBox(ctx, cx-2, cy-2, 52, 52, this.t);
      Font.drawCJK(ctx, (slot===0?'P1':'P2')+' 选择中 ('+(this.picks[slot].length+1)+'/'+this.teamSize+')  轻拳:确认  轻脚:撤销', 240, 240, {size:9, color: slot===0?'#ff9a7a':'#7ab0ff', align:'center'});
      var hov = KOF.Characters.get(this.roster[c]);
      Font.drawCJK(ctx, hov.name+' · '+hov.title, 240, 224, {size:10, color:'#ffd23c', align:'center'});
    } else {
      Font.drawCJK(ctx, '准备完毕!', 240, 236, {size:12, color:'#ffd23c', align:'center'});
    }
    // team lists
    for(var s3=0;s3<2;s3++){
      var lx = s3===0? 16 : 400;
      Font.draw(ctx, s3===0?'P1':(this.p2human?'P2':'CPU'), lx+24, 44, {scale:1, color:s3===0?'#ff6a4a':'#4a8aff', align:'center'});
      for(var p=0;p<this.picks[s3].length;p++){
        var pch = KOF.Characters.get(this.picks[s3][p]);
        var pt2 = KOF.Puppet.portrait(pch, s3, false);
        if(pt2) ctx.drawImage(pt2, lx+11, 56+p*32, 26, 26);
        ctx.strokeStyle='#666'; ctx.strokeRect(lx+11.5, 56.5+p*32, 26, 26);
      }
    }
  }
};

// ============ VS SCREEN ============
var SceneVS = {
  enter: function(args){
    this.cfg = args.cfg;
    this.ret = args.ret;
    this.t = 0;
    KOF.Audio.stopMusic();
    KOF.Audio.sfx('menuSel');
  },
  update: function(){
    this.t++;
    if(this.t>110 || (this.t>30 && (KOF.Input.get(0).pressed.LP||KOF.Input.get(0).pressed.START))){
      KOF.Game.set(SceneBattle, {cfg:this.cfg, ret:this.ret});
    }
  },
  draw: function(ctx){
    ctx.fillStyle='#0a0a14'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#181828';
    ctx.fillRect(0,0,W,H/2-2);
    ctx.fillStyle='#281818';
    ctx.fillRect(0,H/2+2,W,H/2);
    var t1 = this.cfg.p1.team, t2 = this.cfg.p2.team;
    for(var i=0;i<t1.length;i++){
      var ch = KOF.Characters.get(t1[i]);
      var pt = KOF.Puppet.portrait(ch,0,true);
      var x = 40+i*70 - Math.max(0,(30-this.t))*4;
      if(pt) ctx.drawImage(pt, x, 40, 56, 56);
      ctx.strokeStyle='#e04040'; ctx.strokeRect(x+0.5,40.5,56,56);
      Font.drawCJK(ctx, ch.name, x+28, 100, {size:10, color:'#ffb0a0', align:'center'});
    }
    for(var j=0;j<t2.length;j++){
      var ch2 = KOF.Characters.get(t2[j]);
      var pt2 = KOF.Puppet.portrait(ch2,1,true);
      var x2 = W-96-j*70 + Math.max(0,(30-this.t))*4;
      if(pt2) ctx.drawImage(pt2, x2, 160, 56, 56);
      ctx.strokeStyle='#4060e0'; ctx.strokeRect(x2+0.5,160.5,56,56);
      Font.drawCJK(ctx, ch2.name, x2+28, 220, {size:10, color:'#a0b8ff', align:'center'});
    }
    var sc = this.t<20? 6-(this.t/4) : 2;
    Font.draw(ctx, 'VS', 240, 118, {scale:Math.max(2,Math.round(sc)), color:'#ffd23c', outline:'#801010', align:'center'});
    var stName = KOF.Stages.DEFS[this.cfg.stage] ? KOF.Stages.DEFS[this.cfg.stage].name : '';
    Font.drawCJK(ctx, '战场: '+stName, 240, 246, {size:10, color:'#c8c8c8', align:'center'});
  }
};

// ============ BATTLE ============
var SceneBattle = {
  enter: function(args){
    var self = this;
    this.ret = args.ret || 'vs';
    this.cfg = args.cfg;
    this.done = false;
    this.pause = false;
    this.pauseSel = 0;
    this.showMoves = false;
    this.nav = new Nav();
    this.prevEsc = false; this.prevF1=false; this.prevF2=false;
    var cfg = {};
    for(var k in args.cfg) cfg[k]=args.cfg[k];
    cfg.onEnd = function(result){
      self.done = true;
      self.result = result;
      self.endT = 30;
    };
    this.battle = new KOF.Battle(cfg);
    var st = KOF.Stages.DEFS[this.battle.stage];
    KOF.Audio.music(st ? st.music : 'street');
  },
  update: function(){
    var esc = KOF.Input.isDown('Escape');
    var startP = KOF.Input.get(0).pressed.START || KOF.Input.get(1).pressed.START;
    if((esc&&!this.prevEsc) || (startP && !this.pause && this.battle.phase==='fight')){
      this.pause = !this.pause;
      this.battle.paused = this.pause;
      this.pauseSel = 0;
      this.showMoves = false;
      KOF.Audio.sfx('menuSel');
    }
    this.prevEsc = esc;
    if(this.battle.training){
      var f1 = KOF.Input.isDown('F1'), f2 = KOF.Input.isDown('F2');
      if(f1&&!this.prevF1) this.battle.cycleDummy();
      if(f2&&!this.prevF2) this.battle.resetPositions();
      this.prevF1=f1; this.prevF2=f2;
    }
    if(this.pause){
      this.pauseMenu();
      return;
    }
    this.battle.update();
    if(this.done){
      this.endT--;
      if(this.endT<=0){
        this.finish();
      }
    }
  },
  pauseMenu: function(){
    var n = this.nav.poll(0);
    var n2 = this.nav.poll(1);
    if(this.showMoves){
      if(n.ok||n.back||n2.ok||n2.back){ this.showMoves=false; KOF.Audio.sfx('menuBack'); }
      return;
    }
    var items = this.pauseItems();
    if(n.up||n2.up){ this.pauseSel=(this.pauseSel+items.length-1)%items.length; KOF.Audio.sfx('menuMove'); }
    if(n.down||n2.down){ this.pauseSel=(this.pauseSel+1)%items.length; KOF.Audio.sfx('menuMove'); }
    if(n.ok||n2.ok){
      KOF.Audio.sfx('menuSel');
      var act = items[this.pauseSel][1];
      if(act==='resume'){ this.pause=false; this.battle.paused=false; }
      else if(act==='moves'){ this.showMoves=true; }
      else if(act==='restart'){ KOF.Game.set(SceneBattle, {cfg:this.cfg, ret:this.ret}); }
      else if(act==='resel'){
        if(this.cfg.mode==='eve') KOF.Game.set(SceneEveSetup, {});
        else KOF.Game.set(SceneCharSel, {mode: this.cfg.mode==='training'?'training':(this.cfg.mode==='vs'&&this.cfg.p2.ctrl==='human'?'vs':(this.ret==='arcade'?'arcade':'vscpu'))});
      }
      else if(act==='keys'){ KOF.Game.set(SceneKeys, {back:{scene:SceneBattle,args:{cfg:this.cfg,ret:this.ret}}}); }
      else if(act==='quit'){ KOF.Audio.stopMusic(); KOF.Game.set(SceneTitle,{}); }
    }
  },
  pauseItems: function(){
    return [['继续战斗','resume'],['出招表','moves'],['重新开始','restart'],['重选角色','resel'],['按键设置','keys'],['返回主菜单','quit']];
  },
  finish: function(){
    var res = this.result;
    if(this.cfg.mode==='eve'){
      KOF.Game.set(SceneEveReport, {result:res, battle:this.battle, cfg:this.cfg});
      return;
    }
    if(this.ret==='arcade'){
      if(res.winner===0){
        KOF.Game.arcade.stageIdx++;
        KOF.Game.arcade.wins++;
        if(KOF.Game.arcade.stageIdx >= KOF.Characters.ARCADE_TEAMS.length){
          KOF.Game.set(SceneEnding, {});
        } else {
          KOF.Game.set(SceneResults, {result:res, battle:this.battle, mode:'arcadeWin'});
        }
      } else {
        KOF.Game.set(SceneContinue, {});
      }
      return;
    }
    KOF.Game.set(SceneResults, {result:res, battle:this.battle, mode:'vs', cfg:this.cfg});
  },
  draw: function(ctx){
    this.battle.draw(ctx);
    if(this.pause){
      ctx.fillStyle='rgba(0,0,12,0.72)';
      ctx.fillRect(0,0,W,H);
      if(this.showMoves){ this.drawMoves(ctx); return; }
      Font.drawCJK(ctx, '暂停', 240, 48, {size:16, color:'#ffd23c', align:'center'});
      var items = this.pauseItems();
      for(var i=0;i<items.length;i++){
        var seld = i===this.pauseSel;
        Font.drawCJK(ctx, items[i][0], 240, 84+i*20, {size:11, color:seld?'#ffd23c':'#9090b0', align:'center'});
        if(seld) Font.drawCJK(ctx,'▶', 178, 84+i*20, {size:11, color:'#ff8020'});
      }
    }
  },
  drawMoves: function(ctx){
    for(var s=0;s<2;s++){
      var f = this.battle.fighters[s];
      var x = s===0? 16 : 248;
      Font.drawCJK(ctx, (s===0?'P1 ':'P2 ')+f.ch.name+' 出招表', x, 20, {size:11, color:'#ffd23c'});
      var ml = f.ch.movelist;
      for(var i=0;i<ml.length;i++){
        Font.drawCJK(ctx, ml[i][0], x, 42+i*22, {size:9, color:'#ff9a5a'});
        Font.drawCJK(ctx, ml[i][1], x, 53+i*22, {size:8, color:'#b0b0d0'});
      }
    }
    Font.drawCJK(ctx, '通用: 前前=跑 后后=后闪 O/轻拳+轻脚=闪避 L/重拳+重脚=重击吹飞 P=爆气(1气) 倒地按O受身', 240, 226, {size:8, color:'#88c888', align:'center'});
    Font.drawCJK(ctx, '按任意确认键返回', 240, 244, {size:9, color:'#c8c8c8', align:'center'});
  }
};

function startArcadeBattle(){
  var a = KOF.Game.arcade;
  var stages = ['street','harbor','temple','street','harbor','shrine'];
  var enemyTeam = KOF.Characters.ARCADE_TEAMS[a.stageIdx].slice();
  var level = Math.min(8, 3 + a.stageIdx);
  var cfg = {
    mode:'vs', stage: stages[a.stageIdx % stages.length],
    p1:{ team:a.team, ctrl:'human' },
    p2:{ team:enemyTeam, ctrl:{level:level}, level:level }
  };
  KOF.Game.set(SceneVS, {cfg:cfg, ret:'arcade'});
}

// ============ RESULTS ============
var SceneResults = {
  enter: function(args){
    this.res = args.result;
    this.battle = args.battle;
    this.mode = args.mode;
    this.cfg = args.cfg;
    this.t=0; this.nav = new Nav(); this.sel=0;
    var wteam = this.battle.teams[this.res.winner];
    var wid = wteam.ids[Math.min(wteam.idx, wteam.ids.length-1)];
    this.wch = KOF.Characters.get(wid);
    this.quote = this.wch.quotes[Math.floor(Math.random()*this.wch.quotes.length)];
    KOF.Audio.music('victory');
  },
  update: function(){
    this.t++;
    if(this.mode==='arcadeWin'){
      if(this.t>90 && (KOF.Input.get(0).pressed.LP||KOF.Input.get(0).pressed.START)){
        KOF.Audio.sfx('menuSel');
        startArcadeBattle();
      }
      return;
    }
    var n = this.nav.poll(0), n2 = this.nav.poll(1);
    var items = 3;
    if(n.up||n2.up){ this.sel=(this.sel+items-1)%items; KOF.Audio.sfx('menuMove'); }
    if(n.down||n2.down){ this.sel=(this.sel+1)%items; KOF.Audio.sfx('menuMove'); }
    if(n.ok||n2.ok){
      KOF.Audio.sfx('menuSel');
      if(this.sel===0){ KOF.Game.set(SceneVS,{cfg:this.cfg, ret:'vs'}); }
      else if(this.sel===1){ KOF.Game.set(SceneCharSel,{mode: this.cfg.p2.ctrl==='human'?'vs':'vscpu'}); }
      else { KOF.Audio.stopMusic(); KOF.Game.set(SceneTitle,{}); }
    }
  },
  draw: function(ctx){
    var bg = menuBg('results','#e04040');
    if(bg) ctx.drawImage(bg,0,0);
    Font.drawCJK(ctx, (this.res.winner===0?'P1':'P2')+' 获胜!', 240, 16, {size:15, color:'#ffd23c', align:'center'});
    var pt = KOF.Puppet.portrait(this.wch, this.res.winner, true);
    if(pt) ctx.drawImage(pt, 60, 60, 96, 96);
    ctx.strokeStyle='#ffd23c'; ctx.strokeRect(60.5,60.5,96,96);
    Font.drawCJK(ctx, this.wch.name+' · '+this.wch.title, 108, 164, {size:11, color:'#ff9a5a', align:'center'});
    Font.drawCJK(ctx, '"'+this.quote+'"', 300, 90, {size:11, color:'#e8e8ff', align:'center'});
    var m = this.res.metrics;
    Font.drawCJK(ctx, '最大连段  P1: '+this.res.maxCombo[0]+'  P2: '+this.res.maxCombo[1], 300, 120, {size:9, color:'#b0b0d0', align:'center'});
    Font.drawCJK(ctx, '总伤害  P1: '+Math.round(m[0].dmg)+'  P2: '+Math.round(m[1].dmg), 300, 134, {size:9, color:'#b0b0d0', align:'center'});
    if(this.mode==='arcadeWin'){
      Font.drawCJK(ctx, '按 确认 进入下一场 ('+(KOF.Game.arcade.stageIdx+1)+'/'+KOF.Characters.ARCADE_TEAMS.length+')', 240, 220, {size:11, color:(this.t%40<25)?'#ffd23c':'#a08020', align:'center'});
    } else {
      var items = ['再战一场','重选角色','返回主菜单'];
      for(var i=0;i<items.length;i++){
        var seld = i===this.sel;
        Font.drawCJK(ctx, items[i], 240, 190+i*18, {size:10, color:seld?'#ffd23c':'#9090b0', align:'center'});
        if(seld) Font.drawCJK(ctx,'▶',186,190+i*18,{size:10,color:'#ff8020'});
      }
    }
  }
};

// ============ CONTINUE ============
var SceneContinue = {
  enter: function(){ this.t = 60*10; KOF.Audio.stopMusic(); },
  update: function(){
    this.t--;
    if(KOF.Input.get(0).pressed.LP||KOF.Input.get(0).pressed.START){
      KOF.Audio.sfx('menuSel');
      startArcadeBattle();
      return;
    }
    if(this.t<=0){ KOF.Game.set(SceneGameOver,{}); }
  },
  draw: function(ctx){
    ctx.fillStyle='#08080e'; ctx.fillRect(0,0,W,H);
    Font.draw(ctx,'CONTINUE?',240,70,{scale:4,color:'#ff4040',outline:'#400',align:'center'});
    var sec = Math.ceil(this.t/60);
    Font.draw(ctx,String(sec),240,120,{scale:6,color:'#ffd23c',outline:'#802',align:'center'});
    Font.drawCJK(ctx,'按 确认 投入硬币继续挑战',240,200,{size:11,color:(this.t%30<20)?'#fff':'#888',align:'center'});
  }
};
var SceneGameOver = {
  enter: function(){ this.t=140; },
  update: function(){ this.t--; if(this.t<=0||KOF.Input.get(0).pressed.LP) KOF.Game.set(SceneTitle,{}); },
  draw: function(ctx){
    ctx.fillStyle='#08080e'; ctx.fillRect(0,0,W,H);
    Font.draw(ctx,'GAME OVER',240,120,{scale:4,color:'#c02020',outline:'#300',align:'center'});
  }
};

// ============ ENDING ============
var SceneEnding = {
  enter: function(){ this.t=0; KOF.Audio.music('victory'); },
  update: function(){
    this.t++;
    if(this.t>600 || (this.t>120 && KOF.Input.get(0).pressed.START)) { KOF.Audio.stopMusic(); KOF.Game.set(SceneTitle,{}); }
  },
  draw: function(ctx){
    ctx.fillStyle='#0a0a16'; ctx.fillRect(0,0,W,H);
    var lines = [
      '祝贺!', '', '你击败了灭世之主 神威', '拳魂大赛 \'97 冠军诞生!',
      '', '你的队伍用拳与魂', '守护了这座城市的荣耀', '',
      '- FIGHTING SOUL \'97 -', '', '全部美术: 程序生成 SVG', '音乐音效: WebAudio 合成',
      '', '感谢游玩!', '', '按 开始键 返回标题'
    ];
    var off = H - this.t*0.5;
    for(var i=0;i<lines.length;i++){
      var y = off + i*22;
      if(y>-20 && y<H+20) Font.drawCJK(ctx, lines[i], 240, y, {size:12, color: i===0?'#ffd23c':'#d0d0e8', align:'center'});
    }
    var a = KOF.Game.arcade;
    Font.drawCJK(ctx,'通关战绩: '+ (a?a.wins:0) +' 连胜', 240, 252, {size:9, color:'#808098', align:'center'});
  }
};

// ============ EVE SETUP ============
var SceneEveSetup = {
  enter: function(){
    this.nav = new Nav();
    this.sel = 0;
    this.lv = [5,5];
    this.t = 0;
    KOF.Audio.music('select');
  },
  update: function(){
    this.t++;
    var n = this.nav.poll(0);
    var rows = 4;
    if(n.up){ this.sel=(this.sel+rows-1)%rows; KOF.Audio.sfx('menuMove'); }
    if(n.down){ this.sel=(this.sel+1)%rows; KOF.Audio.sfx('menuMove'); }
    if(this.sel<2 && (n.left||n.right)){
      this.lv[this.sel] += n.right?1:-1;
      this.lv[this.sel] = Math.max(1, Math.min(8, this.lv[this.sel]));
      KOF.Audio.sfx('menuMove');
    }
    if(n.back){ KOF.Game.set(SceneTitle,{}); KOF.Audio.sfx('menuBack'); return; }
    if(n.ok && this.sel===2){ this.start(); }
    if(n.ok && this.sel===3){ KOF.Game.set(SceneTitle,{}); }
  },
  start: function(){
    var pool = KOF.Characters.ROSTER.slice();
    function pick3(){
      var t=[]; var p = pool.slice();
      for(var i=0;i<3;i++) t.push(p.splice(Math.floor(Math.random()*p.length),1)[0]);
      return t;
    }
    var stage = KOF.Stages.LIST[Math.floor(Math.random()*KOF.Stages.LIST.length)];
    KOF.Audio.sfx('menuSel');
    KOF.Game.set(SceneBattle, { ret:'eve', cfg:{
      mode:'eve', stage:stage,
      p1:{team:pick3(), ctrl:{level:this.lv[0]}, level:this.lv[0]},
      p2:{team:pick3(), ctrl:{level:this.lv[1]}, level:this.lv[1]}
    }});
  },
  draw: function(ctx){
    var bg = menuBg('eve','#38c880');
    if(bg) ctx.drawImage(bg,0,0);
    Font.drawCJK(ctx,'EVE 观战模式 - 人机对抗人机',240,20,{size:14,color:'#7aff9a',align:'center'});
    Font.drawCJK(ctx,'AI互搏并实时监测对抗质量: 命中率/连段/防御/超杀',240,44,{size:9,color:'#88a888',align:'center'});
    var rows = [ 'AI-1 难度:  '+'◆'.repeat(this.lv[0])+'◇'.repeat(8-this.lv[0]),
                 'AI-2 难度:  '+'◆'.repeat(this.lv[1])+'◇'.repeat(8-this.lv[1]),
                 '开始观战 (随机双方队伍)', '返回' ];
    for(var i=0;i<rows.length;i++){
      var seld = i===this.sel;
      Font.drawCJK(ctx, rows[i], 240, 90+i*26, {size:11, color:seld?'#ffd23c':'#9090b0', align:'center'});
      if(seld) Font.drawCJK(ctx,'▶',110,90+i*26,{size:11,color:'#ff8020'});
    }
    Font.drawCJK(ctx,'左右调整难度  确认开始',240,230,{size:9,color:'#888',align:'center'});
  }
};

// ============ EVE REPORT ============
var SceneEveReport = {
  enter: function(args){
    this.res = args.result;
    this.cfg = args.cfg;
    this.battle = args.battle;
    this.nav = new Nav();
    this.sel = 0;
    var m = this.res.metrics;
    var mins = Math.max(0.5, this.res.frames/3600);
    var apm = Math.round((m[0].attacks+m[1].attacks)/mins);
    var acc = [0,1].map(function(i){ return m[i].attacks? m[i].hits/m[i].attacks : 0; });
    var variety = Object.keys(m[0].moveSet).length + Object.keys(m[1].moveSet).length;
    var comboDepth = (this.res.maxCombo[0]+this.res.maxCombo[1])/2;
    var balance = 1 - Math.abs(m[0].dmg-m[1].dmg)/Math.max(1,(m[0].dmg+m[1].dmg));
    var score = Math.min(100, Math.round(
      Math.min(40, apm*0.5) + Math.min(20, (acc[0]+acc[1])*25) + Math.min(15, variety*0.8) +
      Math.min(15, comboDepth*3) + balance*10 ));
    this.stats = {apm:apm, acc:acc, variety:variety, comboDepth:comboDepth, balance:balance, score:score,
      grade: score>=80?'S':(score>=65?'A':(score>=45?'B':'C'))};
    KOF.Audio.music('victory');
  },
  update: function(){
    var n = this.nav.poll(0);
    if(n.up){ this.sel=(this.sel+2)%3; KOF.Audio.sfx('menuMove'); }
    if(n.down){ this.sel=(this.sel+1)%3; KOF.Audio.sfx('menuMove'); }
    if(n.ok){
      KOF.Audio.sfx('menuSel');
      if(this.sel===0){ SceneEveSetup.lv = [this.cfg.p1.level, this.cfg.p2.level]; SceneEveSetup.start.call({lv:[this.cfg.p1.level,this.cfg.p2.level]}); }
      else if(this.sel===1){ KOF.Game.set(SceneEveSetup,{}); }
      else { KOF.Audio.stopMusic(); KOF.Game.set(SceneTitle,{}); }
    }
  },
  draw: function(ctx){
    var bg = menuBg('evereport','#38c880');
    if(bg) ctx.drawImage(bg,0,0);
    var m = this.res.metrics, st = this.stats;
    Font.drawCJK(ctx,'EVE 对抗质量报告',240,14,{size:14,color:'#7aff9a',align:'center'});
    Font.draw(ctx, st.grade, 415, 60, {scale:6, color: st.grade==='S'?'#ffd23c':(st.grade==='A'?'#7aff9a':'#c8c8c8'), outline:'#204020', align:'center'});
    Font.drawCJK(ctx,'综合评分 '+st.score+' / 100', 400, 110, {size:10, color:'#fff', align:'center'});
    Font.drawCJK(ctx,'胜者: AI-'+(this.res.winner+1), 400, 128, {size:10, color:'#ffd23c', align:'center'});
    var rows = [
      ['指标','AI-1','AI-2'],
      ['出招次数', m[0].attacks, m[1].attacks],
      ['命中数', m[0].hits, m[1].hits],
      ['命中率', Math.round(st.acc[0]*100)+'%', Math.round(st.acc[1]*100)+'%'],
      ['总伤害', Math.round(m[0].dmg), Math.round(m[1].dmg)],
      ['最大连段', this.res.maxCombo[0], this.res.maxCombo[1]],
      ['防御次数', m[0].blocks, m[1].blocks],
      ['投技', m[0].throwsDone, m[1].throwsDone],
      ['超必杀', m[0].supers, m[1].supers],
      ['招式种类', Object.keys(m[0].moveSet).length, Object.keys(m[1].moveSet).length]
    ];
    for(var i=0;i<rows.length;i++){
      var y = 40+i*16;
      var col = i===0?'#88a8ff':'#d0d0e0';
      Font.drawCJK(ctx, String(rows[i][0]), 40, y, {size:9, color:col});
      Font.drawCJK(ctx, String(rows[i][1]), 170, y, {size:9, color:'#ffb090', align:'center'});
      Font.drawCJK(ctx, String(rows[i][2]), 240, y, {size:9, color:'#90b8ff', align:'center'});
    }
    Font.drawCJK(ctx,'节奏 '+st.apm+' 招/分  平衡度 '+Math.round(st.balance*100)+'%', 240, 206, {size:9, color:'#a8c8a8', align:'center'});
    var items = ['再来一场','调整设置','返回主菜单'];
    for(var j=0;j<items.length;j++){
      var seld = j===this.sel;
      Font.drawCJK(ctx, items[j], 380, 150+j*18, {size:10, color:seld?'#ffd23c':'#9090b0', align:'center'});
      if(seld) Font.drawCJK(ctx,'▶',330,150+j*18,{size:10,color:'#ff8020'});
    }
  }
};

// ============ KEY CONFIG ============
var SceneKeys = {
  enter: function(args){
    this.back = args.back;
    this.nav = new Nav();
    this.row = 0; this.col = 0;
    this.waiting = false;
    this.actions = [['up','上'],['down','下'],['left','左'],['right','右'],['LP','轻拳'],['HP','重拳'],['LK','轻脚'],['HK','重脚'],['AB','闪避'],['CD','重击'],['MAX','爆气'],['START','开始']];
  },
  update: function(){
    if(this.waiting) return;
    var n = this.nav.poll(0);
    var rows = this.actions.length+2;
    if(n.up){ this.row=(this.row+rows-1)%rows; KOF.Audio.sfx('menuMove'); }
    if(n.down){ this.row=(this.row+1)%rows; KOF.Audio.sfx('menuMove'); }
    if(n.left||n.right){ this.col=1-this.col; KOF.Audio.sfx('menuMove'); }
    if(n.back){ this.leave(); return; }
    if(n.ok){
      if(this.row===this.actions.length){ KOF.Input.resetKeys(); KOF.Audio.sfx('menuSel'); return; }
      if(this.row===this.actions.length+1){ this.leave(); return; }
      var self = this;
      this.waiting = true;
      KOF.Audio.sfx('menuSel');
      KOF.Input.beginCapture(function(code){
        KOF.Input.setKey(self.col, self.actions[self.row][0], code);
        self.waiting = false;
      });
    }
  },
  leave: function(){
    KOF.Audio.sfx('menuBack');
    if(this.back) KOF.Game.set(this.back.scene, this.back.args);
    else KOF.Game.set(SceneTitle,{});
  },
  draw: function(ctx){
    var bg = menuBg('keys','#8060e0');
    if(bg) ctx.drawImage(bg,0,0);
    Font.drawCJK(ctx,'按键设置',240,14,{size:14,color:'#c8a8ff',align:'center'});
    var keys = KOF.Input.getKeys();
    Font.drawCJK(ctx,'P1',210,44,{size:10,color:'#ff9a7a',align:'center'});
    Font.drawCJK(ctx,'P2',330,44,{size:10,color:'#7ab0ff',align:'center'});
    for(var i=0;i<this.actions.length;i++){
      var y = 58+i*14;
      Font.drawCJK(ctx, this.actions[i][1], 120, y, {size:9, color:'#c8c8e0', align:'center'});
      for(var c=0;c<2;c++){
        var x = c===0?210:330;
        var seld = this.row===i && this.col===c;
        var label = KOF.Input.keyLabel(keys[c][this.actions[i][0]]);
        if(seld && this.waiting) label = '按任意键...';
        Font.drawCJK(ctx, label, x, y, {size:9, color:seld?'#ffd23c':'#8888a8', align:'center'});
      }
    }
    var extra = ['恢复默认','返回'];
    for(var j=0;j<2;j++){
      var selr = this.row===this.actions.length+j;
      Font.drawCJK(ctx, extra[j], 240, 232+j*14, {size:10, color:selr?'#ffd23c':'#9090b0', align:'center'});
    }
  }
};

KOF.Scenes = {
  Title:SceneTitle, CharSel:SceneCharSel, VS:SceneVS, Battle:SceneBattle,
  Results:SceneResults, Continue:SceneContinue, GameOver:SceneGameOver,
  Ending:SceneEnding, EveSetup:SceneEveSetup, EveReport:SceneEveReport, Keys:SceneKeys,
  startArcadeBattle: startArcadeBattle
};
})();
