(function(){
'use strict';
var KOF = window.KOF;

// frame helper
function F(pose, t, extra){
  var f = { pose:pose, t:t };
  if(extra) for(var k in extra) f[k]=extra[k];
  return f;
}
// hit helper
function HB(x,y,w,h,dmg,o){
  var hit = { x:x,y:y,w:w,h:h, dmg:dmg, hs:14, bs:10, push:2.2, stop:6, level:'mid',
    launch:0, kd:null, sfx:'hitL', spark:'spark', theme:'hit', chip:0, juggle:1 };
  if(o) for(var k in o) hit[k]=o[k];
  return hit;
}
function heavy(h){ h.hs=20; h.bs=14; h.stop=9; h.push=2.8; h.sfx='hitM'; return h; }

function mkNormals(c){
  c = c||{};
  var d = function(v,def){ return v!==undefined?v:def; };
  var M = {};
  M.sLP = { id:'sLP', type:'normal', frames:[
    F('jabWind',2,{sfx:'whooshL'}), F('jabA',3,{hit:HB(36,58,28,14,d(c.lp,4)),cancel:'all'}),
    F('jabA',2,{cancel:'all'}), F('jabWind',4) ]};
  M.sLK = { id:'sLK', type:'normal', frames:[
    F('hkickWind',3,{sfx:'whooshL'}), F('lkickA',4,{hit:HB(38,38,30,16,d(c.lk,5)),cancel:'all'}),
    F('lkickA',2,{cancel:'all'}), F('hkickWind',4) ]};
  M.sHP = { id:'sHP', type:'normal', frames:[
    F('straightWind',6,{sfx:'whooshH'}), F('straightA',4,{hit:heavy(HB(42,56,34,16,d(c.hp,9))),cancel:'special'}),
    F('straightA',3,{cancel:'special'}), F('straightWind',9) ]};
  M.sHK = { id:'sHK', type:'normal', frames:[
    F('hkickWind',7,{sfx:'whooshH'}), F('hkickA',5,{hit:heavy(HB(44,62,34,18,d(c.hk,10))),cancel:'special'}),
    F('hkickA',3), F('hkickWind',10) ]};
  M.cLP = { id:'cLP', type:'normal', crouch:true, frames:[
    F('crouch',2,{sfx:'whooshL'}), F('cJabA',3,{hit:HB(32,34,26,12,d(c.lp,4)),cancel:'all'}),
    F('cJabA',2,{cancel:'all'}), F('crouch',3) ]};
  M.cLK = { id:'cLK', type:'normal', crouch:true, frames:[
    F('crouch',2,{sfx:'whooshL'}), F('cKickA',3,{hit:HB(36,10,30,12,d(c.lk,4),{level:'low'}),cancel:'all'}),
    F('cKickA',2,{cancel:'all'}), F('crouch',3) ]};
  M.cHP = { id:'cHP', type:'normal', crouch:true, frames:[
    F('crouch',4,{sfx:'whooshH'}), F('cUpperA',5,{hit:heavy(HB(28,58,22,34,d(c.hp,9),{launch:6.2,kd:'soft'})),cancel:'special'}),
    F('cUpperA',4,{cancel:'special'}), F('crouch',9) ]};
  M.cHK = { id:'cHK', type:'normal', crouch:true, frames:[
    F('crouch',5,{sfx:'whooshH'}), F('sweepA',5,{hit:heavy(HB(40,8,38,12,d(c.hk,9),{level:'low',kd:'soft'})),cancel:'special'}),
    F('sweepA',4), F('crouch',11) ]};
  M.CD = { id:'CD', type:'normal', frames:[
    F('straightWind',9,{sfx:'whooshH'}), F('blowCD',6,{hit:heavy(HB(44,52,36,20,d(c.cd,11),{kd:'soft',push:5,stop:12,sfx:'hitH',knockback:5}))}),
    F('blowCD',4), F('straightWind',13) ]};
  M.jLP = { id:'jLP', type:'normal', air:true, landCancel:true, frames:[
    F('jumpP',3,{sfx:'whooshL'}), F('jumpP',9,{hit:HB(26,52,26,18,d(c.lp,5),{level:'oh'})}), F('jumpP',30) ]};
  M.jLK = { id:'jLK', type:'normal', air:true, landCancel:true, frames:[
    F('jumpLK',3,{sfx:'whooshL'}), F('jumpLK',10,{hit:HB(28,44,30,18,d(c.lk,5),{level:'oh'})}), F('jumpLK',30) ]};
  M.jHP = { id:'jHP', type:'normal', air:true, landCancel:true, frames:[
    F('jumpHP',5,{sfx:'whooshH'}), F('jumpHP',8,{hit:heavy(HB(28,48,30,22,d(c.hp,9),{level:'oh'}))}), F('jumpHP',30) ]};
  M.jHK = { id:'jHK', type:'normal', air:true, landCancel:true, frames:[
    F('jumpHK',5,{sfx:'whooshH'}), F('jumpHK',9,{hit:heavy(HB(24,42,36,20,d(c.hk,10),{level:'oh'}))}), F('jumpHK',30) ]};
  M.jCD = { id:'jCD', type:'normal', air:true, landCancel:true, frames:[
    F('jumpCD',6,{sfx:'whooshH'}), F('jumpCD',8,{hit:heavy(HB(30,50,34,22,d(c.cd,10),{level:'oh',kd:'soft',push:4.5,knockback:4}))}), F('jumpCD',30) ]};
  M.throwF = { id:'throwF', type:'throw', grab:{range:38,dmg:14,back:false}, frames:[
    F('grabReach',2,{grabCheck:true}), F('grabReach',10) ]};
  M.throwB = { id:'throwB', type:'throw', grab:{range:38,dmg:14,back:true}, frames:[
    F('grabReach',2,{grabCheck:true}), F('grabReach',10) ]};
  M.fHK = { id:'fHK', type:'command', frames:[
    F('hkickWind',9,{sfx:'whooshH'}), F('axeKick',5,{hit:heavy(HB(36,50,28,26,d(c.hk,9),{level:'oh',kd:'soft'}))}),
    F('axeKick',4), F('hkickWind',10) ]};
  return M;
}

function proj(o){
  var p = { kind:'orb', theme:'fire', x:38, y:52, vx:4, vy:0, w:24, h:18, dmg:8, hs:18, bs:14,
    push:2.5, stop:7, level:'mid', kd:null, launch:0, life:130, hits:1, hitEvery:8, delay:0,
    chip:1, sfx:'fireball', hitSfx:'fireHit', spark:'boom', juggle:1, beam:false, grav:0 };
  for(var k in o) p[k]=o[k];
  return p;
}

var CH = {};

// ================= 炎龙 YANLONG =================
CH.yanlong = {
  id:'yanlong', name:'炎龙', ename:'YANLONG', title:'燃焰之拳',
  style:{ h:88, bulk:1, hair:'spiky', top:'jacket', headband:true, gloves:true },
  palettes:[
    { skin:'#f0c090', hair:'#3a2818', top:'#e8e8f0', topD:'#b0b0c0', shirt:'#222', pants:'#28304a', shoe:'#c03030', accent:'#d02020', glove:'#c03030', aura:'fire' },
    { skin:'#f0c090', hair:'#3a2818', top:'#303038', topD:'#181820', shirt:'#a02020', pants:'#585868', shoe:'#902020', accent:'#e0a020', glove:'#e0a020', aura:'fire' }],
  stats:{ walk:1.6, back:1.25, run:3.4, hopVY:5.8, jumpVY:7.8, jumpVX:2.4, grav:0.42, def:1.0 },
  winPose:'winA', hasFHK:true,
  poseMods:{ idleA:{ls:34,le:104,rs:56,re:100,t:8}, idleB:{ls:36,le:108,rs:58,re:106,t:10,hy:39} },
  normals:{ lp:4, lk:5, hp:9, hk:10, cd:11 },
  buildMoves:function(M){
    M.fireL = { id:'fireL', type:'special', frames:[
      F('fbWind',7), F('fbThrow',4,{proj:proj({theme:'fire',vx:4,dmg:8}),sfx:'fireball'}), F('fbThrow',6), F('fbWind',12) ]};
    M.fireH = { id:'fireH', type:'special', frames:[
      F('fbWind',9), F('fbThrow',4,{proj:proj({theme:'fire',vx:5.6,dmg:9}),sfx:'fireball'}), F('fbThrow',6), F('fbWind',14) ]};
    M.dpL = { id:'dpL', type:'special', frames:[
      F('dpWind',4,{inv:'full'}), F('dpRise',3,{hit:HB(26,60,30,40,10,{launch:7,kd:'hard',sfx:'hitH',stop:10,theme:'fire',spark:'boom'}),vel:{x:1.2,y:7},sfx:'fireball',fx:{kind:'pillar',theme:'fire',x:14,y:40,scale:0.6}}),
      F('dpRise',20,{airGrav:true}), F('dpWind',10,{land:true}) ], onEnd:'idle' };
    M.dpH = { id:'dpH', type:'special', frames:[
      F('dpWind',5,{inv:'full'}), F('dpRise',3,{hit:HB(26,55,32,44,13,{launch:8.4,kd:'hard',sfx:'hitH',stop:11,theme:'fire',spark:'boom'}),vel:{x:1.6,y:8.6},sfx:'fireball',fx:{kind:'pillar',theme:'fire',x:14,y:40,scale:0.8}}),
      F('dpRise',26,{airGrav:true}), F('dpWind',14,{land:true}) ], onEnd:'idle' };
    M.spinL = { id:'spinL', type:'special', frames:[
      F('hkickWind',6,{sfx:'whooshH'}), F('spinKick',5,{hit:HB(40,54,32,20,7,{theme:'fire'}),vel:{x:3.2,y:0}}),
      F('lkickA',4,{vel:{x:2.4,y:0}}), F('spinKick',5,{hit:HB(40,54,32,20,6,{kd:'soft',push:3.5,theme:'fire'}),vel:{x:2.6,y:0}}), F('hkickWind',12) ]};
    M.spinH = { id:'spinH', type:'special', frames:[
      F('hkickWind',7,{sfx:'whooshH'}), F('spinKick',5,{hit:HB(40,54,32,20,7,{theme:'fire'}),vel:{x:3.6,y:0}}),
      F('lkickA',4,{vel:{x:2.8,y:0}}), F('spinKick',5,{hit:HB(40,54,32,20,7,{theme:'fire'}),vel:{x:3,y:0}}),
      F('lkickA',4,{vel:{x:2.6,y:0}}), F('spinKick',5,{hit:HB(40,56,32,22,7,{kd:'soft',push:4,launch:3,theme:'fire'}),vel:{x:2.8,y:0}}), F('hkickWind',14) ]};
    M.palm = { id:'palm', type:'special', frames:[
      F('fbWind',8), F('palmA',5,{hit:heavy(HB(36,54,30,26,9,{launch:6.8,kd:'soft',theme:'fire',spark:'boom',sfx:'fireHit'})),sfx:'fireball',fx:{kind:'boom',theme:'fire',x:40,y:54,scale:0.7}}),
      F('palmA',4), F('fbWind',13) ]};
    M.super1 = { id:'super1', type:'super', cost:1, frames:[
      F('fbWind',8,{inv:'full'}), 
      F('rekka1',4,{hit:HB(40,54,34,24,5,{theme:'fire',stop:8}),vel:{x:4,y:0},sfx:'fireball'}),
      F('rekka2',4,{hit:HB(40,54,34,24,5,{theme:'fire',stop:8}),vel:{x:4,y:0}}),
      F('rekka1',4,{hit:HB(40,54,34,24,5,{theme:'fire',stop:8}),vel:{x:4,y:0},sfx:'fireball'}),
      F('rekka2',4,{hit:HB(40,54,34,24,5,{theme:'fire',stop:8}),vel:{x:4,y:0}}),
      F('dpRise',4,{hit:HB(30,60,36,44,10,{launch:8.6,kd:'hard',sfx:'hitH',stop:14,theme:'fire',spark:'boom'}),vel:{x:1.5,y:7.5},sfx:'explode',fx:{kind:'pillar',theme:'fire',x:16,y:44,scale:1}}),
      F('dpRise',22,{airGrav:true}), F('dpWind',16,{land:true}) ], onEnd:'idle' };
    M.hidden = { id:'hidden', type:'super', cost:1, desperation:true, frames:[
      F('chargePose',12,{inv:'full',sfx:'charge',fx:{kind:'aura',theme:'fire',x:0,y:44,scale:1.2}}),
      F('fbThrow',6,{hit:HB(30,50,60,80,12,{theme:'fire',stop:12,sfx:'fireHit',spark:'boom'}),fx:{kind:'pillar',theme:'fire',x:30,y:52,scale:1.4},sfx:'explode',shake:6}),
      F('fbThrow',6,{hit:HB(55,50,70,90,12,{theme:'fire',stop:12,sfx:'fireHit',spark:'boom'}),fx:{kind:'pillar',theme:'fire',x:60,y:56,scale:1.7},sfx:'explode',shake:6}),
      F('fbThrow',8,{hit:HB(80,55,80,100,14,{theme:'fire',stop:14,kd:'hard',launch:8,sfx:'explode',spark:'boom'}),fx:{kind:'pillar',theme:'fire',x:90,y:60,scale:2},sfx:'explode',shake:8}),
      F('fbWind',24) ]};
  },
  specials:[
    { motion:'qcbhcf', btn:'P', move:'hidden', type:'hidden' },
    { motion:'qcfqcf', btn:'P', move:'super1', type:'super' },
    { motion:'dp', btn:'P', moveL:'dpL', moveH:'dpH' },
    { motion:'qcb', btn:'K', moveL:'spinL', moveH:'spinH' },
    { motion:'qcb', btn:'P', move:'palm' },
    { motion:'qcf', btn:'P', moveL:'fireL', moveH:'fireH' } ],
  movelist:[ ['炎弹','↓↘→ + 拳'], ['升龙炎','→↓↘ + 拳'], ['旋炎脚','↓↙← + 脚'], ['炎掌','↓↙← + 拳'], ['轰斧踢','→ + 重脚 (中段)'],
    ['超必杀 灭炎冲','↓↘→↓↘→ + 拳 (1气)'], ['隐藏 焚天灭世','↓↙←↙↓↘→ + 拳 (爆气/残血+1气)'] ],
  quotes:['烈火面前，一切皆为灰烬!','这就是燃烧的拳头!','还不够热!再来!'],
  ai:{ style:'rush', far:[['qcf','HP'],['qcf','LP']], mid:[['run','sHK'],['qcb','HK']], anti:[['dp','HP']],
    combos:[ [['n','cLK'],['n','cLP'],['qcb','LK']], [['j','HK'],['n','sHP'],['dp','HP']], [['n','cLK'],['n','cLK'],['qcf','LP']] ],
    superCombo:[ [['j','HK'],['n','sHP'],['qcfqcf','HP']] ] }
};

// ================= 月影 YUEYING =================
CH.yueying = {
  id:'yueying', name:'月影', ename:'YUEYING', title:'冥月之爪',
  style:{ h:90, bulk:0.92, hair:'side', top:'coat', gloves:false },
  palettes:[
    { skin:'#e8d0b8', hair:'#6a2030', top:'#38284a', topD:'#241832', shirt:'#ddd', pants:'#a02838', shoe:'#181820', accent:'#c26bff', glove:'#333', aura:'dark' },
    { skin:'#e8d0b8', hair:'#302040', top:'#701830', topD:'#500f22', shirt:'#ccc', pants:'#28203a', shoe:'#181820', accent:'#ff5f8a', glove:'#333', aura:'dark' }],
  stats:{ walk:1.7, back:1.3, run:3.6, hopVY:5.9, jumpVY:8, jumpVX:2.6, grav:0.44, def:1.0 },
  winPose:'winB', hasFHK:true,
  poseMods:{ idleA:{ls:12,le:20,rs:24,re:130,t:12,n:6}, idleB:{ls:14,le:24,rs:26,re:136,t:14,n:6,hy:39} },
  normals:{ lp:4, lk:5, hp:9, hk:10, cd:11 },
  buildMoves:function(M){
    M.fireL = { id:'fireL', type:'special', frames:[
      F('fbWind',8), F('grabSlam',4,{proj:proj({theme:'dark',vx:3.4,y:14,h:16,dmg:8}),sfx:'fireball'}), F('grabSlam',6), F('fbWind',13) ]};
    M.fireH = M.fireL;
    M.dpL = { id:'dpL', type:'special', frames:[
      F('dpWind',4,{inv:'upper'}), F('dpRise',3,{hit:HB(24,58,30,42,11,{launch:7.4,kd:'hard',sfx:'hitH',stop:10,theme:'dark',spark:'boom'}),vel:{x:1,y:7.4},sfx:'whooshH',fx:{kind:'slash',theme:'dark',x:16,y:60,scale:1}}),
      F('dpRise',22,{airGrav:true}), F('dpWind',12,{land:true}) ], onEnd:'idle' };
    M.dpH = M.dpL;
    M.rekka1 = { id:'rekka1', type:'special', rekkaNext:'rekka2', frames:[
      F('straightWind',6), F('rekka1',4,{hit:heavy(HB(40,54,32,22,6,{theme:'dark',spark:'slash'})),vel:{x:3.4,y:0},sfx:'whooshH'}),
      F('rekka1',3,{rekkaWin:true}), F('straightWind',9,{rekkaWin:true}) ]};
    M.rekka2 = { id:'rekka2', type:'special', rekkaNext:'rekka3', frames:[
      F('rekka1',5), F('rekka2',4,{hit:heavy(HB(40,52,32,22,6,{theme:'dark',spark:'slash'})),vel:{x:3.2,y:0},sfx:'whooshH'}),
      F('rekka2',3,{rekkaWin:true}), F('straightWind',10,{rekkaWin:true}) ]};
    M.rekka3 = { id:'rekka3', type:'special', frames:[
      F('rekka2',5), F('rekka3',5,{hit:heavy(HB(38,52,34,26,8,{kd:'hard',launch:5.5,theme:'dark',spark:'boom',sfx:'hitH',stop:11})),vel:{x:3,y:0},sfx:'fireball',fx:{kind:'boom',theme:'dark',x:40,y:52,scale:0.8}}),
      F('rekka3',4), F('straightWind',14) ]};
    M.cmdGrab = { id:'cmdGrab', type:'throw', grab:{range:44,dmg:18,back:false,pillar:'dark'}, frames:[
      F('grabReach',4,{grabCheck:true}), F('grabReach',16) ]};
    M.super1 = { id:'super1', type:'super', cost:1, frames:[
      F('teleFade',6,{inv:'full',vel:{x:7,y:0},sfx:'whooshH'}),
      F('rekka1',3,{hit:HB(38,54,34,26,4,{theme:'dark',stop:7,spark:'slash'}),vel:{x:4.4,y:0}}),
      F('rekka2',3,{hit:HB(38,54,34,26,4,{theme:'dark',stop:7,spark:'slash'}),vel:{x:4,y:0}}),
      F('rekka1',3,{hit:HB(38,54,34,26,4,{theme:'dark',stop:7,spark:'slash'}),vel:{x:3.6,y:0}}),
      F('rekka2',3,{hit:HB(38,54,34,26,4,{theme:'dark',stop:7,spark:'slash'}),vel:{x:3.2,y:0}}),
      F('rekka3',5,{hit:HB(36,54,38,50,12,{kd:'hard',launch:8,theme:'dark',stop:14,sfx:'explode',spark:'boom'}),fx:{kind:'pillar',theme:'dark',x:30,y:55,scale:1.3},sfx:'explode',shake:7}),
      F('rekka3',10), F('straightWind',16) ]};
    M.hidden = { id:'hidden', type:'super', cost:1, desperation:true, frames:[
      F('chargePose',10,{inv:'full',sfx:'charge',fx:{kind:'aura',theme:'dark',x:0,y:44,scale:1.2}}),
      F('teleFade',5,{inv:'full',vel:{x:8,y:0}}),
      F('rekka1',3,{hit:HB(38,54,36,30,5,{theme:'dark',stop:8,spark:'slash'}),vel:{x:4.6,y:0}}),
      F('rekka2',3,{hit:HB(38,54,36,30,5,{theme:'dark',stop:8,spark:'slash'}),vel:{x:4.2,y:0}}),
      F('rekka1',3,{hit:HB(38,54,36,30,5,{theme:'dark',stop:8,spark:'slash'}),vel:{x:3.8,y:0}}),
      F('rekka2',3,{hit:HB(38,54,36,30,5,{theme:'dark',stop:8,spark:'slash'}),vel:{x:3.4,y:0}}),
      F('rekka3',3,{hit:HB(38,54,36,30,5,{theme:'dark',stop:8,spark:'slash'}),vel:{x:3,y:0}}),
      F('grabLift',6,{hit:HB(34,56,40,60,14,{kd:'hard',launch:9,theme:'dark',stop:16,sfx:'explode',spark:'boom'}),fx:{kind:'pillar',theme:'dark',x:34,y:60,scale:1.8},sfx:'explode',shake:9}),
      F('grabLift',12), F('straightWind',18) ]};
  },
  specials:[
    { motion:'qcbhcf', btn:'P', move:'hidden', type:'hidden' },
    { motion:'qcfqcf', btn:'P', move:'super1', type:'super' },
    { motion:'hcb', btn:'K', move:'cmdGrab' },
    { motion:'dp', btn:'P', moveL:'dpL', moveH:'dpH' },
    { motion:'qcb', btn:'P', move:'rekka1' },
    { motion:'qcf', btn:'P', moveL:'fireL', moveH:'fireH' } ],
  movelist:[ ['影弹','↓↘→ + 拳 (地面波)'], ['夜爪升','→↓↘ + 拳'], ['影袭连','↓↙← + 拳 (可连按三次)'], ['缠魂阵','←↙↓↘→ + 脚 (近身投)'], ['轰月斩','→ + 重脚 (中段)'],
    ['超必杀 冥焰乱舞','↓↘→↓↘→ + 拳 (1气)'], ['隐藏 八重冥葬','↓↙←↙↓↘→ + 拳 (爆气/残血+1气)'] ],
  quotes:['月之影，噬灭一切。','哭喊吧，那是最好的伴奏。','无趣……就这种程度?'],
  ai:{ style:'tricky', far:[['qcf','LP'],['run','sHK']], mid:[['qcb','LP'],['n','fHK']], anti:[['dp','LP']],
    combos:[ [['n','cLK'],['n','cLP'],['qcb','LP'],['qcb','LP'],['qcb','LP']], [['j','HP'],['n','sHP'],['qcb','LP'],['qcb','LP'],['qcb','LP']], [['n','hcbK']] ],
    superCombo:[ [['j','HP'],['n','sHP'],['qcfqcf','HP']] ] }
};

// ================= 雷豪 LEIHAO =================
CH.leihao = {
  id:'leihao', name:'雷豪', ename:'LEIHAO', title:'轰雷巨熊',
  style:{ h:96, bulk:1.4, shoulder:1.3, hair:'buzz', top:'vest', gloves:false },
  palettes:[
    { skin:'#d8a070', hair:'#282018', top:'#2a5a38', topD:'#1a3a24', pants:'#4a4438', shoe:'#3a2a1a', accent:'#ffe23c', glove:'#333', aura:'thunder' },
    { skin:'#d8a070', hair:'#282018', top:'#5a2a2a', topD:'#3a1a1a', pants:'#38384a', shoe:'#3a2a1a', accent:'#4fd9ff', glove:'#333', aura:'thunder' }],
  stats:{ walk:1.3, back:1.0, run:2.9, hopVY:5.4, jumpVY:7.2, jumpVX:2.0, grav:0.44, def:0.88 },
  winPose:'winC', hasFHK:false,
  poseMods:{ idleA:{ls:48,le:55,rs:62,re:60,t:6}, idleB:{ls:50,le:60,rs:64,re:65,t:8,hy:39} },
  normals:{ lp:5, lk:6, hp:11, hk:12, cd:13 },
  buildMoves:function(M){
    M.cmdGrab = { id:'cmdGrab', type:'throw', grab:{range:46,dmg:22,back:false,slam:true}, frames:[
      F('grabReach',3,{grabCheck:true}), F('grabReach',18) ]};
    M.runGrab = { id:'runGrab', type:'throw', grab:{range:40,dmg:16,back:false,slam:true}, frames:[
      F('tackle',4,{vel:{x:5,y:0},sfx:'whooshH'}), F('tackle',4,{vel:{x:5,y:0},grabCheck:true}),
      F('tackle',4,{vel:{x:4,y:0},grabCheck:true}), F('tackle',14) ]};
    M.dpL = { id:'dpL', type:'special', frames:[
      F('dpWind',5,{inv:'upper'}), F('dpRise',4,{hit:HB(26,60,34,46,13,{launch:7.6,kd:'hard',sfx:'thunder',stop:11,theme:'thunder',spark:'boom'}),vel:{x:0.8,y:7},sfx:'thunder',fx:{kind:'bolt',theme:'thunder',x:16,y:60,scale:0.8}}),
      F('dpRise',22,{airGrav:true}), F('dpWind',14,{land:true}) ], onEnd:'idle' };
    M.dpH = M.dpL;
    M.lariat = { id:'lariat', type:'special', frames:[
      F('lariat1',6,{sfx:'thunder',fx:{kind:'bolt',theme:'thunder',x:0,y:70,scale:0.5}}),
      F('lariat1',5,{hit:heavy(HB(30,56,52,26,9,{theme:'thunder',sfx:'thunder',push:3.4})),sfx:'whooshH'}),
      F('lariat2',5,{hit:heavy(HB(30,56,52,26,8,{kd:'soft',push:4.2,theme:'thunder',sfx:'thunder'}))}),
      F('lariat1',12) ]};
    M.super1 = { id:'super1', type:'supergrab', cost:1, grab:{range:50,dmg:32,back:false,slam:true,superFx:'thunder'}, frames:[
      F('grabReach',3,{grabCheck:true,inv:'full'}), F('grabReach',22) ]};
    M.hidden = { id:'hidden', type:'super', cost:1, desperation:true, frames:[
      F('chargePose',12,{inv:'full',sfx:'charge',fx:{kind:'aura',theme:'thunder',x:0,y:44,scale:1.3}}),
      F('lariat1',5,{hit:HB(34,56,60,90,10,{theme:'thunder',stop:10,sfx:'thunder',spark:'boom'}),fx:{kind:'bolt',theme:'thunder',x:40,y:70,scale:1.2},sfx:'thunder',shake:5}),
      F('lariat2',5,{hit:HB(-34,56,60,90,10,{theme:'thunder',stop:10,sfx:'thunder',spark:'boom'}),fx:{kind:'bolt',theme:'thunder',x:-40,y:70,scale:1.2},sfx:'thunder',shake:5}),
      F('lariat1',6,{hit:HB(40,60,80,100,14,{kd:'hard',launch:8.5,theme:'thunder',stop:14,sfx:'explode',spark:'boom'}),fx:{kind:'bolt',theme:'thunder',x:60,y:80,scale:1.6},sfx:'explode',shake:8}),
      F('lariat1',14), F('chargePose',14) ]};
  },
  specials:[
    { motion:'qcfqcf', btn:'K', move:'hidden', type:'hidden' },
    { motion:'hcbhcb', btn:'P', move:'super1', type:'super' },
    { motion:'hcbf', btn:'P', move:'cmdGrab' },
    { motion:'hcf', btn:'K', move:'runGrab' },
    { motion:'dp', btn:'P', moveL:'dpL', moveH:'dpH' },
    { motion:'qcb', btn:'P', move:'lariat' } ],
  movelist:[ ['雷霆背摔','←↙↓↘→ + 拳 (近身投)'], ['电磁突进','←↓↘→…冲刺抓取 + 脚'], ['雷光拳','→↓↘ + 拳'], ['大回旋','↓↙← + 拳'],
    ['超必杀 天雷灭杀阵','←↙↓↘→x2 + 拳 (近身/1气)'], ['隐藏 万雷天引','↓↘→↓↘→ + 脚 (爆气/残血+1气)'] ],
  quotes:['雷霆一击，天崩地裂!','站起来，再让我摔一次!','肌肉才是真理!'],
  ai:{ style:'grapple', far:[['run','runK']], mid:[['hcf','LK'],['run','sHP']], anti:[['dp','HP'],['qcb','HP']],
    combos:[ [['n','cLK'],['n','cLP'],['hcbf','HP']], [['j','HP'],['n','sHP'],['qcb','HP']], [['n','hcbf_HP']] ],
    superCombo:[ [['j','HP'],['n','hcbhcb','HP']] ] }
};

// ================= 疾风 JIFENG =================
CH.jifeng = {
  id:'jifeng', name:'疾风', ename:'JIFENG', title:'旋风之舞',
  style:{ h:84, bulk:0.82, hair:'pony', top:'tank', female:true, gloves:true },
  palettes:[
    { skin:'#f4d4b0', hair:'#7a4820', top:'#d03858', topD:'#a02040', pants:'#283048', shoe:'#e8e8f0', accent:'#4fd98a', glove:'#f0f0f0', aura:'wind' },
    { skin:'#f4d4b0', hair:'#284888', top:'#3878d0', topD:'#204898', pants:'#402848', shoe:'#e8e8f0', accent:'#ffd23c', glove:'#f0f0f0', aura:'wind' }],
  stats:{ walk:1.85, back:1.4, run:3.9, hopVY:6.2, jumpVY:8.4, jumpVX:2.9, grav:0.46, def:1.08 },
  winPose:'winB', hasFHK:false,
  poseMods:{ idleA:{ls:38,le:118,rs:58,re:128,t:4,hy:41}, idleB:{ls:40,le:124,rs:62,re:132,t:6,hy:40} },
  normals:{ lp:4, lk:4, hp:8, hk:9, cd:10 },
  buildMoves:function(M){
    M.fireL = { id:'fireL', type:'special', frames:[
      F('fbWind',6), F('fbThrow',4,{proj:proj({kind:'wave',theme:'wind',vx:5,dmg:7,sfx:'wind'}),sfx:'wind'}), F('fbThrow',5), F('fbWind',11) ]};
    M.fireH = { id:'fireH', type:'special', frames:[
      F('fbWind',8), F('fbThrow',4,{proj:proj({kind:'wave',theme:'wind',vx:6.4,dmg:8,sfx:'wind'}),sfx:'wind'}), F('fbThrow',5), F('fbWind',12) ]};
    M.airFire = { id:'airFire', type:'special', air:'only', landCancel:true, frames:[
      F('fbWind',5), F('fbThrow',4,{proj:proj({kind:'wave',theme:'wind',vx:4.4,vy:-2.6,y:40,dmg:7,sfx:'wind'}),sfx:'wind'}), F('fbThrow',20) ]};
    M.flipL = { id:'flipL', type:'special', frames:[
      F('dpWind',4,{inv:'upper'}), F('flipKick1',4,{hit:heavy(HB(24,58,30,40,9,{launch:7,kd:'hard',theme:'wind',spark:'slash'})),vel:{x:1.6,y:7},sfx:'whooshH'}),
      F('flipKick2',5,{hit:heavy(HB(16,76,28,32,5,{launch:5,kd:'hard',theme:'wind',spark:'slash'})),airGrav:true}),
      F('flipKick2',18,{airGrav:true}), F('dpWind',10,{land:true}) ], onEnd:'idle' };
    M.flipH = M.flipL;
    M.slide = { id:'slide', type:'special', frames:[
      F('crouchIn',4), F('slideA',8,{hit:heavy(HB(38,10,40,14,8,{level:'low',kd:'soft',theme:'wind'})),vel:{x:4.6,y:0},sfx:'roll'}),
      F('slideA',5,{vel:{x:2,y:0}}), F('crouchIn',10) ]};
    M.dive = { id:'dive', type:'special', air:'only', landCancel:true, landLag:8, frames:[
      F('diveKick',3,{sfx:'whooshH'}), F('diveKick',40,{hit:HB(22,20,28,26,9,{level:'oh',kd:'soft',theme:'wind',sfx:'hitM',stop:9}),vel:{x:3.4,y:-6},diveLoop:true}) ]};
    M.super1 = { id:'super1', type:'super', cost:1, frames:[
      F('run1',5,{inv:'full',vel:{x:6,y:0}}),
      F('lkickA',3,{hit:HB(36,50,32,26,4,{theme:'wind',stop:7}),vel:{x:3.6,y:0},sfx:'whooshL'}),
      F('hkickA',3,{hit:HB(38,58,32,26,4,{theme:'wind',stop:7}),vel:{x:3.2,y:0}}),
      F('lkickA',3,{hit:HB(36,44,32,26,4,{theme:'wind',stop:7}),vel:{x:3,y:0},sfx:'whooshL'}),
      F('hkickA',3,{hit:HB(38,58,32,26,4,{theme:'wind',stop:7}),vel:{x:2.8,y:0}}),
      F('spinKick',3,{hit:HB(38,54,34,28,5,{theme:'wind',stop:8}),vel:{x:2.6,y:0}}),
      F('flipKick1',5,{hit:HB(28,60,34,44,10,{launch:8.8,kd:'hard',theme:'wind',stop:14,sfx:'hitH',spark:'boom'}),vel:{x:1.6,y:7.6},sfx:'explode',shake:6}),
      F('flipKick2',22,{airGrav:true}), F('dpWind',12,{land:true}) ], onEnd:'idle' };
    M.hidden = { id:'hidden', type:'super', cost:1, desperation:true, frames:[
      F('chargePose',10,{inv:'full',sfx:'charge',fx:{kind:'aura',theme:'wind',x:0,y:44,scale:1.2}}),
      F('spinKick',5,{hit:HB(30,55,50,90,8,{theme:'wind',stop:9,spark:'slash'}),proj:proj({kind:'pillar',theme:'wind',x:40,vx:2.2,y:50,w:44,h:100,dmg:6,hits:4,hitEvery:7,life:70,launch:3,kd:'soft',sfx:'wind',hitSfx:'hitM'}),sfx:'wind',shake:4}),
      F('spinKick',5,{hit:HB(30,55,50,90,8,{theme:'wind',stop:9,launch:7,kd:'hard',spark:'boom'})}),
      F('lariat2',12), F('fbWind',16) ]};
  },
  specials:[
    { motion:'qcbqcb', btn:'K', move:'hidden', type:'hidden' },
    { motion:'qcfqcf', btn:'P', move:'super1', type:'super' },
    { motion:'dp', btn:'K', moveL:'flipL', moveH:'flipH' },
    { motion:'qcf', btn:'K', move:'dive', airOnly:true },
    { motion:'qcb', btn:'K', move:'slide' },
    { motion:'qcf', btn:'P', moveL:'fireL', moveH:'fireH', airMove:'airFire' } ],
  movelist:[ ['风刃','↓↘→ + 拳 (可空中)'], ['燕返','→↓↘ + 脚'], ['疾风腿','↓↙← + 脚 (下段)'], ['飞燕落','空中 ↓↘→ + 脚'],
    ['超必杀 风神乱舞','↓↘→↓↘→ + 拳 (1气)'], ['隐藏 龙卷风暴','↓↙←↓↙← + 脚 (爆气/残血+1气)'] ],
  quotes:['风一样的速度，看清了吗?','舞步结束，你也倒下了。','追上我再说吧!'],
  ai:{ style:'speed', far:[['qcf','HP'],['jqcf','LK']], mid:[['qcb','LK'],['run','sLK']], anti:[['dp','LK']],
    combos:[ [['n','cLK'],['n','cLK'],['qcb','LK']], [['j','HK'],['n','sHP'],['dp','LK']], [['j','LK'],['n','cLP'],['qcf','LP']] ],
    superCombo:[ [['j','HK'],['n','sHP'],['qcfqcf','HP']] ] }
};

// ================= 铁武 TIEWU =================
CH.tiewu = {
  id:'tiewu', name:'铁武', ename:'TIEWU', title:'钢铁重炮',
  style:{ h:92, bulk:1.25, shoulder:1.15, hair:'buzz', top:'uniform', cap:true, gloves:true },
  palettes:[
    { skin:'#e0b088', hair:'#403020', top:'#4a5230', topD:'#323a20', shirt:'#8a8460', pants:'#3a4028', shoe:'#2a2418', accent:'#8a2020', glove:'#5a3a20', aura:'fire' },
    { skin:'#e0b088', hair:'#403020', top:'#38404e', topD:'#242a36', shirt:'#788088', pants:'#2c323e', shoe:'#1a1e26', accent:'#d0a030', glove:'#3a3a44', aura:'fire' }],
  stats:{ walk:1.4, back:1.1, run:3.0, hopVY:5.5, jumpVY:7.3, jumpVX:2.1, grav:0.43, def:0.92 },
  winPose:'winC', hasFHK:false,
  poseMods:{ idleA:{ls:48,le:120,rs:66,re:125,t:8}, idleB:{ls:50,le:126,rs:68,re:130,t:10,hy:39} },
  normals:{ lp:5, lk:5, hp:10, hk:11, cd:12 },
  buildMoves:function(M){
    M.dashL = { id:'dashL', type:'special', frames:[
      F('straightWind',6), F('tackle',3,{vel:{x:6.5,y:0},sfx:'whooshH'}),
      F('straightA',4,{hit:heavy(HB(42,54,36,20,11,{kd:'soft',push:4.5,sfx:'hitH',stop:11})),vel:{x:4,y:0}}),
      F('straightA',4), F('straightWind',12) ]};
    M.dashH = { id:'dashH', type:'special', frames:[
      F('straightWind',7), F('tackle',3,{vel:{x:7.5,y:0},sfx:'whooshH'}), F('tackle',3,{vel:{x:6,y:0}}),
      F('straightA',4,{hit:heavy(HB(42,54,38,22,13,{kd:'soft',push:5,sfx:'hitH',stop:12})),vel:{x:4,y:0}}),
      F('straightA',4), F('straightWind',14) ]};
    M.flashL = { id:'flashL', type:'special', frames:[
      F('dpWind',4,{inv:'full'}), F('kneeRise',4,{hit:heavy(HB(22,60,32,46,12,{launch:7.8,kd:'hard',sfx:'hitH',stop:11,spark:'boom'})),vel:{x:0.6,y:7.8},sfx:'whooshH'}),
      F('kneeRise',22,{airGrav:true}), F('dpWind',13,{land:true}) ], onEnd:'idle' };
    M.flashH = M.flashL;
    M.tackleK = { id:'tackleK', type:'special', frames:[
      F('straightWind',8), F('tackle',10,{hit:heavy(HB(34,50,34,30,10,{kd:'soft',push:6,chip:3,sfx:'hitH',stop:12,knockback:6})),vel:{x:5.5,y:0},sfx:'whooshH'}),
      F('tackle',5,{vel:{x:2,y:0}}), F('straightWind',14) ]};
    M.quake = { id:'quake', type:'special', frames:[
      F('grabLift',9,{sfx:'whooshH'}), F('grabSlam',5,{hit:heavy(HB(38,10,52,18,10,{level:'low',kd:'soft',stop:11,sfx:'hitH'})),fx:{kind:'ring',theme:'hit',x:36,y:8,scale:0.8},sfx:'explode',shake:5}),
      F('grabSlam',6), F('crouchIn',12) ]};
    M.super1 = { id:'super1', type:'super', cost:1, frames:[
      F('straightWind',7,{inv:'full'}),
      F('tackle',3,{vel:{x:6,y:0},sfx:'whooshH'}),
      F('straightA',3,{hit:HB(40,54,34,22,6,{stop:8}),vel:{x:3.5,y:0}}),
      F('jabA',3,{hit:HB(40,56,34,22,6,{stop:8}),vel:{x:3.2,y:0},sfx:'whooshL'}),
      F('straightA',3,{hit:HB(40,52,34,22,6,{stop:8}),vel:{x:3,y:0}}),
      F('jabA',3,{hit:HB(40,56,34,22,6,{stop:8}),vel:{x:2.8,y:0},sfx:'whooshL'}),
      F('upperHit',5,{hit:HB(30,60,36,46,12,{launch:8.6,kd:'hard',stop:14,sfx:'explode',spark:'boom'}),vel:{x:1,y:7},sfx:'explode',shake:7}),
      F('upperHit',20,{airGrav:true}), F('dpWind',14,{land:true}) ], onEnd:'idle' };
    M.hidden = { id:'hidden', type:'super', cost:1, desperation:true, frames:[
      F('chargePose',16,{inv:'full',sfx:'charge',fx:{kind:'aura',theme:'fire',x:0,y:44,scale:1.3}}),
      F('tackle',4,{vel:{x:7,y:0},sfx:'whooshH'}),
      F('straightA',6,{hit:heavy(HB(44,54,44,36,38,{kd:'hard',launch:7,stop:20,sfx:'explode',spark:'boom',push:7})),fx:{kind:'boom',theme:'fire',x:48,y:54,scale:1.5},sfx:'explode',shake:10}),
      F('straightA',10), F('straightWind',20) ]};
  },
  specials:[
    { motion:'qcfqcf', btn:'P', move:'hidden', type:'hidden' },
    { motion:'qcbhcf', btn:'P', move:'super1', type:'super' },
    { motion:'chargebf', btn:'P', moveL:'dashL', moveH:'dashH' },
    { motion:'chargedu', btn:'K', moveL:'flashL', moveH:'flashH' },
    { motion:'chargebf', btn:'K', move:'tackleK' },
    { motion:'qcb', btn:'P', move:'quake' } ],
  movelist:[ ['铁弹突','蓄← →+拳'], ['军刀脚','蓄↓ ↑+脚'], ['破甲炮','蓄← →+脚'], ['地裂拳','↓↙← + 拳 (下段)'],
    ['超必杀 弹幕轰击','↓↙←↙↓↘→ + 拳 (1气)'], ['隐藏 最终重炮','↓↘→↓↘→ + 拳 (爆气/残血+1气)'] ],
  quotes:['战场上没有第二次机会。','这一炮，替你上一课。','立正——解散!'],
  ai:{ style:'charge', far:[['chargebf','HP'],['run','sHP']], mid:[['chargebf','LK'],['qcb','LP']], anti:[['chargedu','HK']],
    combos:[ [['n','cLK'],['n','cLP'],['chargebf','LP']], [['j','HP'],['n','sHP'],['chargebf','HP']] ],
    superCombo:[ [['j','HP'],['n','qcbhcf','HP']] ] }
};

// ================= 玄冰 XUANBING =================
CH.xuanbing = {
  id:'xuanbing', name:'玄冰', ename:'XUANBING', title:'零度咏叹',
  style:{ h:90, bulk:0.9, hair:'long', top:'coat', gloves:false },
  palettes:[
    { skin:'#ecdcd0', hair:'#c8d8ee', top:'#3a4a7a', topD:'#263254', shirt:'#dde', pants:'#2a3050', shoe:'#20243c', accent:'#3cc8ff', glove:'#fff', aura:'ice' },
    { skin:'#ecdcd0', hair:'#e8e0f0', top:'#5a3a6a', topD:'#3c2648', shirt:'#dde', pants:'#40284a', shoe:'#2c1c34', accent:'#c26bff', glove:'#fff', aura:'ice' }],
  stats:{ walk:1.45, back:1.2, run:3.1, hopVY:5.6, jumpVY:7.5, jumpVX:2.2, grav:0.4, def:1.05 },
  winPose:'winB', hasFHK:false,
  poseMods:{ idleA:{ls:12,le:16,rs:34,re:112,t:2,n:-3}, idleB:{ls:14,le:20,rs:36,re:118,t:4,n:-3,hy:39} },
  normals:{ lp:4, lk:5, hp:9, hk:10, cd:11 },
  buildMoves:function(M){
    M.fireL = { id:'fireL', type:'special', frames:[
      F('fbWind',8), F('fbThrow',4,{proj:proj({theme:'ice',vx:2.6,dmg:9,hs:22,sfx:'ice',hitSfx:'ice'}),sfx:'ice'}), F('fbThrow',6), F('fbWind',13) ]};
    M.fireH = { id:'fireH', type:'special', frames:[
      F('fbWind',10), F('fbThrow',4,{proj:proj({theme:'ice',vx:3.5,dmg:10,hs:22,sfx:'ice',hitSfx:'ice'}),sfx:'ice'}), F('fbThrow',6), F('fbWind',15) ]};
    M.field = { id:'field', type:'special', frames:[
      F('fbWind',6), F('palmA',5,{hit:heavy(HB(28,50,34,60,10,{launch:7,kd:'soft',theme:'ice',sfx:'ice',spark:'shard'})),fx:{kind:'shard',theme:'ice',x:28,y:20,scale:1},sfx:'ice'}),
      F('palmA',6), F('fbWind',14) ]};
    M.teleF = { id:'teleF', type:'special', frames:[
      F('teleFade',4,{inv:'full',sfx:'ice'}), F('teleFade',10,{inv:'full',vel:{x:11,y:0}}), F('crouchIn',6) ]};
    M.teleB = { id:'teleB', type:'special', frames:[
      F('teleFade',4,{inv:'full',sfx:'ice'}), F('teleFade',10,{inv:'full',vel:{x:-11,y:0}}), F('crouchIn',6) ]};
    M.spikeL = { id:'spikeL', type:'special', frames:[
      F('fbWind',8), F('palmA',4,{proj:proj({kind:'shard',theme:'ice',x:64,vx:0,y:16,w:36,h:34,dmg:9,launch:6.5,kd:'soft',delay:8,life:34,sfx:'ice',hitSfx:'ice',spark:'shard'}),sfx:'ice'}),
      F('palmA',6), F('fbWind',13) ]};
    M.spikeH = { id:'spikeH', type:'special', frames:[
      F('fbWind',10), F('palmA',4,{proj:proj({kind:'shard',theme:'ice',x:118,vx:0,y:16,w:36,h:34,dmg:10,launch:6.5,kd:'soft',delay:10,life:34,sfx:'ice',hitSfx:'ice',spark:'shard'}),sfx:'ice'}),
      F('palmA',6), F('fbWind',15) ]};
    M.super1 = { id:'super1', type:'super', cost:1, frames:[
      F('fbWind',10,{inv:'full'}),
      F('beamPose',6,{proj:proj({kind:'beam',theme:'ice',beam:true,x:120,vx:0,y:52,w:210,h:30,dmg:6,hits:5,hitEvery:6,life:42,kd:'hard',launch:5,chip:2,sfx:'ice',hitSfx:'ice',spark:'shard'}),sfx:'superFlash',shake:5}),
      F('beamPose',36), F('fbWind',18) ]};
    M.hidden = { id:'hidden', type:'super', cost:1, desperation:true, frames:[
      F('chargePose',14,{inv:'full',sfx:'charge',fx:{kind:'aura',theme:'ice',x:0,y:44,scale:1.3}}),
      F('palmA',6,{hit:HB(20,50,70,100,10,{theme:'ice',stop:12,sfx:'ice',spark:'shard'}),fx:{kind:'shard',theme:'ice',x:30,y:24,scale:1.6},sfx:'ice',shake:5}),
      F('beamPose',6,{hit:HB(50,55,100,110,10,{theme:'ice',stop:12,sfx:'ice',spark:'shard'}),fx:{kind:'shard',theme:'ice',x:70,y:26,scale:2},sfx:'ice',shake:6}),
      F('beamPose',8,{hit:HB(30,55,120,110,14,{kd:'hard',launch:8,theme:'ice',stop:16,sfx:'explode',spark:'boom'}),fx:{kind:'pillar',theme:'ice',x:40,y:60,scale:1.6},sfx:'explode',shake:8}),
      F('fbWind',26) ]};
  },
  specials:[
    { motion:'qcbqcb', btn:'P', move:'hidden', type:'hidden' },
    { motion:'qcfqcf', btn:'P', move:'super1', type:'super' },
    { motion:'dp', btn:'K', moveL:'teleB', moveH:'teleF' },
    { motion:'qcf', btn:'K', moveL:'spikeL', moveH:'spikeH' },
    { motion:'qcb', btn:'P', move:'field' },
    { motion:'qcf', btn:'P', moveL:'fireL', moveH:'fireH' } ],
  movelist:[ ['冰晶弹','↓↘→ + 拳'], ['寒气场','↓↙← + 拳'], ['瞬影步','→↓↘ + 脚 (轻退/重进)'], ['冰锥突','↓↘→ + 脚 (轻近/重远)'],
    ['超必杀 极寒领域','↓↘→↓↘→ + 拳 (1气)'], ['隐藏 绝对零度','↓↙←↓↙← + 拳 (爆气/残血+1气)'] ],
  quotes:['寒冷，是最温柔的终结。','连时间都被冻结了。','安静地睡吧。'],
  ai:{ style:'zone', far:[['qcf','LP'],['qcf','HP'],['qcf','HK']], mid:[['qcf','LK'],['qcb','LP']], anti:[['qcb','LP']],
    combos:[ [['n','cLK'],['n','cLP'],['qcb','LP']], [['j','HP'],['n','sHP'],['qcf','LP']] ],
    superCombo:[ [['n','qcfqcf','HP']] ] }
};

// ================= 神威 SHENWEI (BOSS) =================
CH.shenwei = {
  id:'shenwei', name:'神威', ename:'SHENWEI', title:'灭世之主', boss:true,
  style:{ h:98, bulk:1.2, shoulder:1.2, hair:'slick', top:'coat', gloves:true },
  palettes:[
    { skin:'#d8c0b0', hair:'#e8e4da', top:'#6a1826', topD:'#48101a', shirt:'#201020', pants:'#2a1a2e', shoe:'#181018', accent:'#a84fd6', glove:'#fff', aura:'dark' },
    { skin:'#d8c0b0', hair:'#282838', top:'#20244a', topD:'#141632', shirt:'#101020', pants:'#1a1c34', shoe:'#101018', accent:'#4fd9ff', glove:'#fff', aura:'dark' }],
  stats:{ walk:1.5, back:1.2, run:3.3, hopVY:5.7, jumpVY:7.7, jumpVX:2.3, grav:0.42, def:0.75, dmgBoost:1.15 },
  winPose:'winC', hasFHK:true,
  poseMods:{ idleA:{ls:58,le:95,rs:62,re:100,t:0,n:2}, idleB:{ls:60,le:100,rs:64,re:104,t:2,n:2,hy:39} },
  normals:{ lp:5, lk:6, hp:11, hk:12, cd:13 },
  buildMoves:function(M){
    M.fireL = { id:'fireL', type:'special', frames:[
      F('fbWind',6), F('fbThrow',4,{proj:proj({theme:'dark',vx:5,dmg:11,w:30,h:22,sfx:'fireball'}),sfx:'fireball'}), F('fbThrow',5), F('fbWind',10) ]};
    M.fireH = { id:'fireH', type:'special', frames:[
      F('fbWind',7), F('fbThrow',4,{proj:proj({theme:'dark',vx:6.5,dmg:12,w:30,h:22,sfx:'fireball'}),sfx:'fireball'}), F('fbThrow',5), F('fbWind',11) ]};
    M.dpL = { id:'dpL', type:'special', frames:[
      F('dpWind',4,{inv:'full'}), F('dpRise',4,{hit:HB(28,58,34,46,15,{launch:8.4,kd:'hard',sfx:'hitH',stop:12,theme:'dark',spark:'boom'}),vel:{x:1.4,y:8.2},sfx:'fireball',fx:{kind:'pillar',theme:'dark',x:16,y:44,scale:0.9}}),
      F('dpRise',24,{airGrav:true}), F('dpWind',10,{land:true}) ], onEnd:'idle' };
    M.dpH = M.dpL;
    M.pillar = { id:'pillar', type:'special', frames:[
      F('fbWind',8), F('grabLift',5,{proj:proj({kind:'pillar',theme:'dark',x:72,vx:0,y:50,w:36,h:100,dmg:12,launch:7,kd:'soft',delay:9,life:30,sfx:'fireball',hitSfx:'fireHit'}),sfx:'fireball'}),
      F('grabLift',8), F('fbWind',12) ]};
    M.cmdGrab = { id:'cmdGrab', type:'throw', grab:{range:50,dmg:24,back:false,pillar:'dark'}, frames:[
      F('grabReach',3,{grabCheck:true}), F('grabReach',14) ]};
    M.super1 = { id:'super1', type:'super', cost:1, frames:[
      F('fbWind',10,{inv:'full'}),
      F('beamPose',6,{proj:proj({kind:'beam',theme:'dark',beam:true,x:125,vx:0,y:52,w:220,h:34,dmg:7,hits:5,hitEvery:6,life:44,kd:'hard',launch:6,chip:2,sfx:'fireball',hitSfx:'explode'}),sfx:'superFlash',shake:6}),
      F('beamPose',38), F('fbWind',16) ]};
    M.hidden = { id:'hidden', type:'super', cost:1, desperation:true, frames:[
      F('chargePose',14,{inv:'full',sfx:'charge',fx:{kind:'aura',theme:'dark',x:0,y:44,scale:1.4}}),
      F('grabLift',6,{proj:proj({kind:'pillar',theme:'dark',x:55,vx:0,y:50,w:40,h:104,dmg:13,launch:7,kd:'soft',delay:4,life:26,sfx:'explode',hitSfx:'explode'}),sfx:'explode',shake:6}),
      F('grabLift',6,{proj:proj({kind:'pillar',theme:'dark',x:115,vx:0,y:50,w:40,h:104,dmg:13,launch:7,kd:'soft',delay:4,life:26,sfx:'explode',hitSfx:'explode'})}),
      F('grabLift',8,{proj:proj({kind:'pillar',theme:'dark',x:175,vx:0,y:50,w:44,h:108,dmg:16,launch:8.5,kd:'hard',delay:4,life:26,sfx:'explode',hitSfx:'explode'}),shake:8}),
      F('fbWind',26) ]};
  },
  specials:[
    { motion:'qcbhcf', btn:'P', move:'hidden', type:'hidden' },
    { motion:'qcfqcf', btn:'P', move:'super1', type:'super' },
    { motion:'hcb', btn:'K', move:'cmdGrab' },
    { motion:'dp', btn:'P', moveL:'dpL', moveH:'dpH' },
    { motion:'qcb', btn:'P', move:'pillar' },
    { motion:'qcf', btn:'P', moveL:'fireL', moveH:'fireH' } ],
  movelist:[ ['灭魂波','↓↘→ + 拳'], ['魔升龙','→↓↘ + 拳'], ['暗炎柱','↓↙← + 拳'], ['冥引','←↙↓↘→ + 脚 (近身投)'],
    ['超必杀 灭世光炎','↓↘→↓↘→ + 拳 (1气)'], ['隐藏 天罚','↓↙←↙↓↘→ + 拳 (爆气/残血+1气)'] ],
  quotes:['凡人，跪伏于神威之下。','这个时代，由我终结。','蝼蚁的挣扎，毫无意义。'],
  ai:{ style:'boss', far:[['qcf','HP'],['qcb','HP']], mid:[['qcb','HP'],['n','fHK'],['hcb','HK']], anti:[['dp','HP']],
    combos:[ [['n','cLK'],['n','cLP'],['dp','HP']], [['j','HP'],['n','sHP'],['qcf','HP']], [['n','hcb','HK']] ],
    superCombo:[ [['n','qcfqcf','HP']] ] }
};

// build final move tables
for(var id in CH){
  var ch = CH[id];
  ch.moves = mkNormals(ch.normals);
  ch.buildMoves(ch.moves);
  for(var mid2 in ch.moves){ ch.moves[mid2].owner = id; }
}

var ROSTER = ['yanlong','yueying','leihao','jifeng','tiewu','xuanbing'];
var ARCADE_TEAMS = [
  ['jifeng','xuanbing','tiewu'],
  ['yueying','leihao','yanlong'],
  ['tiewu','yanlong','jifeng'],
  ['xuanbing','yueying','leihao'],
  ['yanlong','yueying','jifeng'],
  ['shenwei']
];

KOF.Characters = { CH:CH, ROSTER:ROSTER, ARCADE_TEAMS:ARCADE_TEAMS, get:function(id){ return CH[id]; } };
})();
