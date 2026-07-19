'use strict';
function addKillfeed(attacker,victim,isHead){
const kf=el('killfeed');
const div=document.createElement('div');
const an=attacker.isPlayer?'<span class="me">你</span>':`<span class="kf${attacker.team}">${attacker.name}</span>`;
const vn=victim.isPlayer?'<span class="me">你</span>':`<span class="kf${victim.team}">${victim.name}</span>`;
div.innerHTML=`${an} ${isHead?'☠':'✕'} ${vn}`;
kf.prepend(div);
while(kf.children.length>6) kf.lastChild.remove();
setTimeout(()=>{ div.style.opacity=0; setTimeout(()=>div.remove(),1000); },5200);
}
function addKillMsg(txt,team){
const m=el('msgC');
m.textContent=txt;
m.style.color=team===player.team?'#ffe08a':'#ff8a7a';
m.style.opacity=1;
clearTimeout(m._t);
m._t=setTimeout(()=>m.style.opacity=0,2400);
}
let scorePopT=null;
function showScorePop(txt){
const s=el('scorePop');
s.textContent=txt; s.style.opacity=1;
clearTimeout(scorePopT);
scorePopT=setTimeout(()=>s.style.opacity=0,1400);
}
function onPlayerKill(victim,isHead){
player.score+=isHead?125:100;
player.lifeKills=(player.lifeKills||0)+1;
showScorePop(isHead?'+125 爆头击杀':'+100 击杀');
const hm=el('hitmark');
hm.classList.add('kill');
hm.style.opacity=1;
setTimeout(()=>hm.style.opacity=0,320);
AudioSys.hitmarkSnd(true);
}
function onPlayerHit(sol,isHead){
const hm=el('hitmark');
hm.classList.remove('kill');
hm.style.opacity=1;
clearTimeout(hm._t);
hm._t=setTimeout(()=>hm.style.opacity=0,140);
AudioSys.hitmarkSnd(false);
}
function addDirHit(worldAng){
const rel=worldAng-player.yaw+Math.PI;
const d=document.createElement('div');
d.className='dirHit';
d.style.transform=`rotate(${-rel}rad)`;
el('dirHits').appendChild(d);
setTimeout(()=>d.remove(),900);
}
function updateScoreboard(){
const mk=(team,tb)=>{
const rows=[];
const list=combatants.filter(c=>c.team===team);
list.sort((a,b)=>(b.score||0)-(a.score||0));
for(const c of list){
rows.push(`<tr class="${c.isPlayer?'meRow':''}"><td>${c.isPlayer?'★ 你':c.name}</td><td>${c.kills||0}</td><td>${c.deaths||0}</td><td>${c.score||0}</td></tr>`);
}
el(tb).innerHTML=rows.join('');
};
mk(0,'sbL'); mk(1,'sbR');
}
const mmC=el('minimap').getContext('2d');
function drawMinimap(){
const S=190, half=S/2, range=90;
mmC.clearRect(0,0,S,S);
mmC.save();
mmC.beginPath(); mmC.arc(half,half,half-2,0,TAU); mmC.clip();
mmC.fillStyle='rgba(24,32,18,.9)'; mmC.fillRect(0,0,S,S);
const cx=player.alive?player.pos.x:0, cz=player.alive?player.pos.z:0;
const rot=player.alive?player.yaw:0;
const toMap=(x,z)=>{
let dx=x-cx, dz=z-cz;
const c=Math.cos(rot), s=Math.sin(rot);
const rx=dx*c-dz*s, rz=dx*s+dz*c;
return [half+rx/range*half, half+rz/range*half];
};
mmC.strokeStyle='rgba(150,130,90,.4)'; mmC.lineWidth=5;
if(CAMPAIGN.sineRoad){
mmC.beginPath();
for(let x=-155;x<=155;x+=10){
const [px,py]=toMap(x,3*Math.sin(x*0.02));
x===-155?mmC.moveTo(px,py):mmC.lineTo(px,py);
}
mmC.stroke();
}
for(const r of CAMPAIGN.roads){
mmC.beginPath();
const [ax,ay]=toMap(r[0],r[1]), [bx2,by2]=toMap(r[2],r[3]);
mmC.moveTo(ax,ay); mmC.lineTo(bx2,by2);
mmC.stroke();
}
for(const f of FLAGS){
const [px,py]=toMap(f.x,f.z);
mmC.beginPath(); mmC.arc(px,py,10,0,TAU);
mmC.fillStyle=f.owner===0?'rgba(90,140,220,.75)':f.owner===1?'rgba(220,110,90,.75)':'rgba(160,160,150,.6)';
mmC.fill();
if(f.capTeam!==-1&&f.cap>0.03){
mmC.beginPath(); mmC.arc(px,py,12,-HPI,-HPI+f.cap*TAU);
mmC.strokeStyle='#fff'; mmC.lineWidth=2; mmC.stroke();
}
mmC.fillStyle='#fff'; mmC.font='bold 11px sans-serif'; mmC.textAlign='center';
mmC.fillText(f.id,px,py+4);
}
for(const s of soldiers){
if(!s.alive||s.onVehicle) continue;
const [px,py]=toMap(s.pos.x,s.pos.z);
if(px<0||py<0||px>S||py>S) continue;
if(s.team===player.team){
mmC.fillStyle='#7dd87d';
mmC.beginPath(); mmC.arc(px,py,2.5,0,TAU); mmC.fill();
} else if(nowT-s.lastFiredT<2.5){
mmC.fillStyle='#ff5040';
mmC.beginPath(); mmC.arc(px,py,3,0,TAU); mmC.fill();
}
}
for(const n of nades){
const [px,py]=toMap(n.pos.x,n.pos.z);
mmC.fillStyle='#ffd050'; mmC.fillRect(px-1.5,py-1.5,3,3);
}
// 小队进攻标记
if(SQUAD.mode==='move'&&SQUAD.members.length){
const [px,py]=toMap(SQUAD.pos.x,SQUAD.pos.z);
mmC.fillStyle='#ffd75a';
mmC.beginPath(); mmC.moveTo(px,py+5); mmC.lineTo(px-4,py-3); mmC.lineTo(px+4,py-3); mmC.closePath(); mmC.fill();
}
for(const t of tanks){
if(!t.alive) continue;
const [px,py]=toMap(t.pos.x,t.pos.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
mmC.fillStyle=t.team===0?'#6da5e8':'#e87a68';
mmC.fillRect(px-4,py-4,8,8);
mmC.strokeStyle='#fff'; mmC.lineWidth=1; mmC.strokeRect(px-4,py-4,8,8);
}
for(const pl of planes){
if(!pl.alive) continue;
const [px,py]=toMap(pl.pos.x,pl.pos.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
mmC.save();
mmC.translate(px,py);
mmC.rotate(-(pl.yaw)+(player.alive?player.yaw:0)+Math.PI);
mmC.fillStyle=pl.team===0?'#9dc5f8':'#f8a898';
mmC.beginPath(); mmC.moveTo(0,-5); mmC.lineTo(4,4); mmC.lineTo(0,2); mmC.lineTo(-4,4); mmC.closePath(); mmC.fill();
mmC.restore();
}
if(player.alive){
mmC.save();
mmC.translate(half,half);
mmC.fillStyle='#fff';
mmC.beginPath(); mmC.moveTo(0,-6); mmC.lineTo(4,5); mmC.lineTo(-4,5); mmC.closePath(); mmC.fill();
mmC.restore();
}
mmC.restore();
mmC.strokeStyle='rgba(210,200,160,.4)'; mmC.lineWidth=1.5;
mmC.beginPath(); mmC.arc(half,half,half-2,0,TAU); mmC.stroke();
}
const cpC=el('compass').getContext('2d');
function drawCompass(){
const W=460,H=26;
cpC.clearRect(0,0,W,H);
cpC.fillStyle='rgba(0,0,0,.35)'; cpC.fillRect(0,0,W,H);
const yaw=player.alive?player.yaw:0;
cpC.font='12px sans-serif'; cpC.textAlign='center';
const marks=[[0,'北'],[HPI,'西'],[Math.PI,'南'],[-HPI,'东'],[Math.PI/4,'西北'],[-Math.PI/4,'东北'],[Math.PI*0.75,'西南'],[-Math.PI*0.75,'东南']];
for(const [a,label] of marks){
let rel=angDiff(yaw,a);
if(Math.abs(rel)>1.2) continue;
const x=W/2-rel/1.2*(W/2);
cpC.fillStyle='rgba(255,255,255,.75)';
cpC.fillText(label,x,17);
}
for(const f of FLAGS){
const a=Math.atan2(player.pos.x-f.x,player.pos.z-f.z);
let rel=angDiff(yaw,a);
if(Math.abs(rel)>1.2) continue;
const x=W/2-rel/1.2*(W/2);
cpC.fillStyle=f.owner===0?'#8fc1ff':f.owner===1?'#ff9c8a':'#ccc';
cpC.font='bold 13px sans-serif';
cpC.fillText(f.id,x,13);
cpC.fillRect(x-1,18,2,5);
cpC.font='12px sans-serif';
}
cpC.fillStyle='#ffd77a'; cpC.fillRect(W/2-1,2,2,6);
}
let hudSlowT=0;
function updateHUD(dt){
const w=player.curW;
if(player.onVehicle&&player.onVehicle.kind==='plane'){
const t=player.onVehicle;
const stallW=t.speed<t.def.spd[0]*0.85?' · <span style="color:#ff7a5a">失速!</span>':'';
el('wmode').innerHTML='机体 '+Math.max(0,Math.round(t.hp/t.maxHp*100))+'% · 速度 '+Math.round(t.speed*4)+' · 油门 '+Math.round((t.throttle??0.8)*100)+'%'+stallW;
el('magN').textContent=Math.round(t.speed*3.6)+'km/h';
el('magN').style.color='#eee';
el('resN').textContent='高度 '+Math.round(t.pos.y)+'m';
el('nadeN').textContent='A/D 压坡转向 · 鼠标拉杆 · 炸弹 ×'+t.bombs+' [右键/B]';
} else if(player.onVehicle&&player.onVehicle.kind==='apc'&&player.playerSeat>=0){
// 运兵车乘客: 显示手中武器(可车内射击)
const t=player.onVehicle;
if(w){
el('wname').textContent=w.def.name+' · 搭乘'+t.name;
el('wmode').textContent=w.def.mode;
el('magN').textContent=w.mag;
el('magN').style.color=w.mag<=w.def.mag*0.25?'#e8836a':'#eee';
el('resN').textContent='| '+w.reserve;
el('nadeN').textContent='车况 '+Math.max(0,Math.round(t.hp/t.maxHp*100))+'% · F 下车';
}
} else if(player.onVehicle&&player.onVehicle.kind==='apc'){
const t=player.onVehicle;
el('wname').textContent=t.name;
el('wmode').textContent='车况 '+Math.max(0,Math.round(t.hp/t.maxHp*100))+'%';
el('magN').textContent=Math.round(Math.abs(t.vel)*3.6*2.4)+'km/h';
el('magN').style.color='#eee';
el('resN').textContent='载员 '+(t.passengers.length+(t.playerSeat>=0?1:0))+'/'+(t.def.seats||6);
el('nadeN').textContent='WASD 驾驶 · 附近步兵自动上车 · F 下车';
} else if(player.onVehicle){
const t=player.onVehicle;
el('wname').textContent=t.name;
el('wmode').textContent='装甲 '+Math.max(0,Math.round(t.hp/t.maxHp*100))+'%';
el('magN').textContent=t.cannonCd<=0?'就绪':t.cannonCd.toFixed(1);
el('magN').style.color=t.cannonCd<=0?'#9fd89f':'#e0c080';
el('resN').textContent='';
el('nadeN').textContent='主炮[左键] · 机枪[右键] · 视角[F]';
} else if(player.onAT){
el('wname').textContent='57mm 反坦克炮';
el('wmode').textContent='穿甲弹';
el('magN').textContent=player.onAT.cd<=0?'就绪':player.onAT.cd.toFixed(1);
el('magN').style.color=player.onAT.cd<=0?'#9fd89f':'#e0c080';
el('resN').textContent=''; el('nadeN').textContent='';
} else if(player.onAA){
el('wname').textContent='防空炮';
el('wmode').textContent='高爆弹';
el('magN').textContent='∞';
el('magN').style.color='#eee';
el('resN').textContent=''; el('nadeN').textContent='';
} else if(w){
el('wname').textContent=player.onMG?'MG42 通用机枪':w.def.name;
el('wmode').textContent=player.onMG?'全自动':w.def.mode;
el('magN').textContent=player.onMG?'∞':w.mag;
el('resN').textContent=player.onMG?'':'/ '+w.reserve;
el('magN').style.color=(!player.onMG&&w.mag<=Math.max(2,w.def.mag*0.25))?'#ff7060':'#eee';
el('nadeN').textContent='手雷 ×'+player.nadeCount+' · 绷带[H] ×'+player.bandages+(player.cls===2?' · AT雷[3] ×'+player.atNades:'')+(CLASSES[player.cls].smoke?' · 烟雾[4] ×'+player.smokeCount:'')+(player.cls===4?' · 医疗箱[B] ×'+(player.medkitUsed?'0':'1'):'');
}
el('hpNum').textContent=Math.ceil(player.hp);
el('hpBar').style.width=player.hp+'%';
el('hpBar').style.background=player.hp>50?'#cfe0c0':(player.hp>25?'#e0c080':'#e07060');
el('stamBar').style.width=(player.stamina*100)+'%';
// 低频HUD(10Hz): 小地图/罗盘/票数/旗帜状态, 减少每帧DOM与Canvas开销
hudSlowT-=dt;
if(hudSlowT<=0){
hudSlowT=0.1;
{
const t0s=(!isFinite(tickets[0])||(GAMEMODE!=='conquest'&&DEF===0))?'∞':Math.ceil(tickets[0]);
const t1s=(!isFinite(tickets[1])||(GAMEMODE!=='conquest'&&DEF===1))?'∞':Math.ceil(tickets[1]);
let modeLine='';
if(GAMEMODE==='assault') modeLine=`<div style="font-size:11px;color:#ffd77a">攻防战 · 当前目标: ${FLAGS[Math.min(assaultIdx,FLAGS.length-1)].id} 点</div>`;
else if(GAMEMODE==='demolition') modeLine=`<div style="font-size:11px;color:#ffd77a">破袭战 · 剩余补给库: ${DEPOTS.filter(d=>!d.destroyed).length}/${DEPOTS.length}</div>`;
el('tickets').innerHTML=`<span class="tl">${TEAM_NAME[0]} ${t0s}</span> &nbsp;·&nbsp; <span class="tr">${t1s} ${TEAM_NAME[1]}</span>`+modeLine;
}
const mm=Math.floor(Math.max(0,matchTime)/60), ss2=Math.floor(Math.max(0,matchTime)%60);
el('timeTxt').textContent=`${mm}:${ss2<10?'0':''}${ss2}`;
FLAGS.forEach((f,i)=>{
const fi=el('fi'+f.id);
fi.className=(f.owner===0?'f0':f.owner===1?'f1':'')+(f.capTeam!==-1&&f.cap>0.03?' fc':'');
});
drawMinimap();
drawCompass();
// 小队HUD
const sqEl=el('squadHUD');
if(SQUAD.members.length&&player.deployed){
const alive=SQUAD.members.filter(s=>s.alive).length;
sqEl.style.display='block';
sqEl.innerHTML=`◆ 小队 <b>${alive}/${SQUAD.members.length}</b> · ${SQUAD.mode==='move'?'<b>进攻标记点</b>':'跟随中'}<br><span style="opacity:.65">[T] 标点进攻 · [Y] 跟随我</span>`;
} else sqEl.style.display='none';
}
let inFlag=null;
if(player.alive) for(const f of FLAGS){ if(Math.hypot(player.pos.x-f.x,player.pos.z-f.z)<f.r) inFlag=f; }
const cp2=el('capPanel');
if(inFlag&&(inFlag.capTeam!==-1&&inFlag.cap>0.02||inFlag.owner!==player.team)){
cp2.style.display='block';
el('capLetter').textContent=inFlag.id;
el('capBarFill').style.width=(inFlag.cap*100)+'%';
el('capBarFill').style.background=inFlag.capTeam===0?'#8fc1ff':'#ff9c8a';
el('capTxt').textContent=inFlag.capTeam===player.team?'正在占领…':(inFlag.capTeam===-1?(inFlag.owner===player.team?'我方控制':'站在旗点范围内占领'):'敌军正在占领!');
} else cp2.style.display='none';
dmgFlash=Math.max(0,dmgFlash-dt*2);
el('dmgOv').style.opacity=dmgFlash;
el('lowOv').style.opacity=player.alive&&player.hp<35?(1-player.hp/35)*0.85:0;
el('supOv').style.opacity=player.suppressV*0.7;
nadeWarnT-=dt;
el('nadeWarn').style.display=nadeWarnT>0?'block':'none';
if(!player.onAA) el('leadPip').style.display='none';
if(!(player.onVehicle&&player.onVehicle.kind==='tank')){ el('tankPip').style.display='none'; el('mgPip').style.display='none'; el('tankSight').style.display='none'; }
// 架枪状态指示
const bi=el('braceInd');
if(player.alive&&player.braced){ bi.style.display='block'; bi.className='on'; bi.textContent='▙ 已架枪'; }
else if(player.alive&&player.canBrace&&!player.prone&&!player.onVehicle){ bi.style.display='block'; bi.className=''; bi.textContent='[X] 架枪'; }
else bi.style.display='none';
const ch=el('crosshair');
if(player.alive&&!player.ads&&!player.onVehicle){
ch.style.display='block';
const gap=8+player.bloom*26+(Math.hypot(player.vel.x,player.vel.z)>1?6:0);
ch.style.setProperty('--gap',gap+'px');
} else if(player.alive&&player.ads&&WPN_DEFS[VM.key]?.atRifle&&!player.onVehicle){
// 反坦克枪侧偏机瞄: 保留小型准星充当侧置机械瞄具
ch.style.display='block';
ch.style.setProperty('--gap','5px');
} else if(player.alive&&player.ads&&!WPN_DEFS[VM.key]?.scoped){
ch.style.display='none';
} else ch.style.display='none';
}
let respawnCd=0, selectedSpawn=0;
