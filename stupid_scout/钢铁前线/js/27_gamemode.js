'use strict';
function updateFlags(dt){
let owned=[0,0];
for(const f of FLAGS){
// 攻防: 只有当前目标点可占; 破袭/征服: 双方均可正常占点(破袭占点提供前线出生点)
const capAllowed=GAMEMODE!=='assault'||FLAGS.indexOf(f)===assaultIdx;
let c0=0,c1=0;
for(const c of combatants){
if(!c.alive||c.onVehicle) continue;
if(Math.hypot(c.pos.x-f.x,c.pos.z-f.z)<f.r&&Math.abs(c.pos.y-f.gy)<7){
if(c.team===0)c0++; else c1++;
}
}
for(const t of tanks){
if(!t.alive) continue;
if(Math.hypot(t.pos.x-f.x,t.pos.z-f.z)<f.r){
if(t.team===0)c0++; else c1++;
}
}
f.present=[c0,c1];
let attacker=-1;
if(c0>0&&c1===0) attacker=0;
else if(c1>0&&c0===0) attacker=1;
if(GAMEMODE==='assault'&&attacker===DEF) attacker=-1;
if(capAllowed&&attacker>=0&&attacker!==f.owner){
const n=attacker===0?c0:c1;
const rate=(0.07+0.035*Math.min(n,3))*(f.owner===-1?1.35:1);
if(f.capTeam!==attacker){
f.cap-=rate*dt*1.6;
if(f.cap<=0){ f.cap=0; f.capTeam=attacker; }
} else {
f.cap+=rate*dt;
if(f.cap>=1){
f.cap=0;
const oldOwner=f.owner;
f.owner=attacker; f.capTeam=-1;
drawFlagTex(f);
addKillMsg(`${TEAM_NAME[attacker]} 占领了 ${f.id} 点`,attacker);
for(const c of combatants){
if(c.alive&&c.team===attacker&&Math.hypot(c.pos.x-f.x,c.pos.z-f.z)<f.r){
c.score=(c.score||0)+150;
if(c.isPlayer) showScorePop('+150 占领 '+f.id+' 点');
}
}
if(GAMEMODE==='assault'&&attacker===ATK){
assaultIdx++;
if(assaultIdx>=FLAGS.length){ endMatch(ATK); }
else{
addKillMsg('下一目标: '+FLAGS[assaultIdx].id+' 点',ATK);
tickets[ATK]=Math.min(tickets[ATK]+40,999);
}
}
}
}
} else {
f.cap-=dt*0.06;
if(f.cap<=0){ f.cap=0; f.capTeam=-1; }
}
if(f.owner>=0) owned[f.owner]++;
f.flagMesh.position.y=dampF(f.flagMesh.position.y,f.owner!==-1?f.poleTop-f.cap*2:f.gy+3.2+f.cap*2.4,4,dt);
f.flagMesh.rotation.y=Math.sin(nowT*1.6+f.x)*0.22;
f.flagMesh.scale.x=1+Math.sin(nowT*5+f.z)*0.06;
}
if(!matchOver){
// 破袭模式: 检测补给库摧毁
if(GAMEMODE==='demolition'){
let left=0;
for(const d of DEPOTS){
if(!d.destroyed&&d.g&&d.g.dead){
d.destroyed=true;
addKillMsg('补给库 '+d.id+' 被摧毁!',ATK);
tickets[ATK]=Math.min(tickets[ATK]+35,999);
}
if(!d.destroyed) left++;
}
if(left===0){ endMatch(ATK); return; }
}
if(GAMEMODE==='conquest'){
const d=owned[0]-owned[1];
if(d>0) tickets[1]=Math.max(0,tickets[1]-dt*d*0.10);
else if(d<0) tickets[0]=Math.max(0,tickets[0]-dt*(-d)*0.10);
}
matchTime-=dt;
if(tickets[0]<=0||tickets[1]<=0||matchTime<=0){
endMatch();
}
}
}
function endMatch(forceWinner){
matchOver=true;
const winner=forceWinner!==undefined?forceWinner:(tickets[0]===tickets[1]?-1:(tickets[0]>tickets[1]?0:1));
document.exitPointerLock&&document.exitPointerLock();
setTimeout(()=>{
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
const end=document.getElementById('end');
end.classList.remove('hidden');
const title=document.getElementById('endTitle');
if(winner===player.team){ title.textContent='胜  利'; title.className='win'; }
else if(winner===-1){ title.textContent='平  局'; title.className='win'; }
else { title.textContent='战  败'; title.className='lose'; }
document.getElementById('endStats').innerHTML=
`${TEAM_NAME[0]} 剩余兵力 <b>${fmtTickets(tickets[0])}</b> · ${TEAM_NAME[1]} 剩余兵力 <b>${fmtTickets(tickets[1])}</b><br>`+
`你的战绩：<b>${player.kills}</b> 击杀 / <b>${player.deaths}</b> 阵亡 · 得分 <b>${player.score}</b>`;
},900);
}
function fmtTickets(v){ return isFinite(v)?String(Math.ceil(v)):'∞'; }
const el=id=>document.getElementById(id);
