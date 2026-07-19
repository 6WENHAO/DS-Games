'use strict';
const AudioSys = (() => {
let ctx=null, master=null, comp=null, noiseBuf=null;
let inited=false;
function init(){
if(inited) return; inited=true;
ctx = new (window.AudioContext||window.webkitAudioContext)();
comp = ctx.createDynamicsCompressor();
comp.threshold.value=-18; comp.ratio.value=6; comp.attack.value=0.002; comp.release.value=0.2;
master = ctx.createGain(); master.gain.value = SETTINGS.vol;
comp.connect(master); master.connect(ctx.destination);
const len = ctx.sampleRate*2;
noiseBuf = ctx.createBuffer(1,len,ctx.sampleRate);
const d = noiseBuf.getChannelData(0);
for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
startAmbient();
}
function setVol(v){ if(master) master.gain.value=v; }
function resume(){ if(ctx&&ctx.state==='suspended') ctx.resume(); }
function noiseSrc(){ const s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true; return s; }
function spatial(dist, maxD=180, pw=2){
const g = clamp(1-dist/maxD,0,1);
return { gain: pw===3?g*g*g:g*g, lp: lerp(600, 12000, g) };
}
function env(g, t0, peak, dec, sus=0.0001){
g.gain.setValueAtTime(0.0001,t0);
g.gain.linearRampToValueAtTime(peak, t0+0.004);
g.gain.exponentialRampToValueAtTime(Math.max(sus,0.0001), t0+dec);
}
let farWinT=0, farWinN=0;
function gunshot(type, dist=0, pan=0){
if(!inited) return; resume();
const t0=ctx.currentTime;
// 远处枪声限流: 100ms窗口最多4发, 防止远距离交火糊成一片
if(dist>70){
if(t0-farWinT>0.1){ farWinT=t0; farWinN=0; }
if(++farWinN>4) return;
}
const sp = spatial(dist, type==='sniper'?290:230, 3);
if(sp.gain<0.025) return;
// 玩家自己开枪音量增强
const selfB=dist<1.5?1.4:1;
const P = {
rifle:   { crack:2600, body:105, bd:0.075, v:0.82, tail:0.55 },
sniper:  { crack:2050, body:80,  bd:0.1,   v:1.0,  tail:0.78 },
smg:     { crack:3100, body:150, bd:0.05,  v:0.55, tail:0.32 },
pistol:  { crack:3400, body:185, bd:0.045, v:0.48, tail:0.26 },
mg:      { crack:2350, body:98,  bd:0.065, v:0.74, tail:0.5 },
}[type]||{crack:3000,body:140,bd:0.05,v:0.6,tail:0.35};
const panN = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
const out = ctx.createGain(); out.gain.value=1;
const lpO = ctx.createBiquadFilter(); lpO.type='lowpass'; lpO.frequency.value=sp.lp;
out.connect(lpO);
if(panN){ panN.pan.value=clamp(pan,-1,1); lpO.connect(panN); panN.connect(comp); } else lpO.connect(comp);
// 1) 枪口激波: 极短宽频噪声脆响
const n=noiseSrc();
const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=P.crack*rand(0.92,1.1); bp.Q.value=0.45;
const ng=ctx.createGain();
ng.gain.setValueAtTime(0.0001,t0);
ng.gain.linearRampToValueAtTime(P.v*sp.gain*selfB,t0+0.0015);
ng.gain.exponentialRampToValueAtTime(0.0001,t0+0.022);
n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t0); n.stop(t0+0.05);
// 1b) 高频瞬态"啪"层: 让近处枪声清脆不发闷
const hfProx=clamp(1-dist/90,0,1);
if(hfProx>0.05){
const nh=noiseSrc();
const hp2=ctx.createBiquadFilter(); hp2.type='highpass'; hp2.frequency.value=4200;
const gh2=ctx.createGain();
gh2.gain.setValueAtTime(0.0001,t0);
gh2.gain.linearRampToValueAtTime(P.v*0.62*hfProx*selfB,t0+0.001);
gh2.gain.exponentialRampToValueAtTime(0.0001,t0+0.012);
nh.connect(hp2); hp2.connect(gh2); gh2.connect(out); nh.start(t0); nh.stop(t0+0.03);
}
// 2) 低频炮口冲击波: 近距离才有体感
const prox=clamp(1-dist/50,0,1);
if(prox>0.03){
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(P.body,t0);
o.frequency.exponentialRampToValueAtTime(42,t0+P.bd*2);
const og=ctx.createGain(); env(og,t0,P.v*0.52*prox*selfB,P.bd*2);
o.connect(og); og.connect(out); o.start(t0); o.stop(t0+P.bd*2+0.05);
const n3=noiseSrc(); const lp3=ctx.createBiquadFilter(); lp3.type='lowpass'; lp3.frequency.value=430;
const g3=ctx.createGain(); env(g3,t0,P.v*0.35*prox*selfB,P.bd*1.5);
n3.connect(lp3); lp3.connect(g3); g3.connect(out); n3.start(t0); n3.stop(t0+P.bd*1.5+0.05);
}
// 3) 旷野回声: 双拍延时模拟山壁/林地混响, 距离越远延迟越长
const far=clamp(dist/230,0,1);
if(far>0.08){
const taps=[t0+0.06+far*0.14, t0+0.14+far*0.28];
const vols=[P.v*sp.gain*far*0.28, P.v*sp.gain*far*0.16];
for(let ti=0;ti<2;ti++){
const n2=noiseSrc();
const lp2=ctx.createBiquadFilter(); lp2.type='lowpass'; lp2.frequency.value=lerp(1200,280,far)*(1-ti*0.35);
const g2=ctx.createGain();
g2.gain.setValueAtTime(0.0001,taps[ti]);
g2.gain.linearRampToValueAtTime(vols[ti],taps[ti]+0.022);
g2.gain.exponentialRampToValueAtTime(0.0001,taps[ti]+P.tail*(0.4+far*0.7)*(1-ti*0.3));
n2.connect(lp2); lp2.connect(g2); g2.connect(out);
n2.start(taps[ti]); n2.stop(taps[ti]+P.tail*(0.4+far*0.7)*(1-ti*0.3)+0.1);
}
}
}
function explosion(dist=0){
if(!inited) return;
const t0=ctx.currentTime; const sp=spatial(dist,400); if(sp.gain<0.02) return;
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(70,t0); o.frequency.exponentialRampToValueAtTime(24,t0+1.1);
const og=ctx.createGain(); env(og,t0,1.5*sp.gain,1.1);
o.connect(og); og.connect(comp); o.start(t0); o.stop(t0+1.2);
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass';
lp.frequency.setValueAtTime(Math.min(sp.lp,5000),t0); lp.frequency.exponentialRampToValueAtTime(120,t0+1.3);
const ng=ctx.createGain(); env(ng,t0,1.3*sp.gain,1.3);
n.connect(lp); lp.connect(ng); ng.connect(comp); n.start(t0); n.stop(t0+1.4);
}
function click(freq=2200, vol=0.25, dur=0.03){
if(!inited) return;
const t0=ctx.currentTime;
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq; bp.Q.value=2.5;
const g=ctx.createGain(); env(g,t0,vol,dur+0.04);
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+dur+0.08);
}
function metalSlide(vol=0.2,dur=0.12,f0=900,f1=1600){
if(!inited) return;
const t0=ctx.currentTime;
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.5;
bp.frequency.setValueAtTime(f0,t0); bp.frequency.linearRampToValueAtTime(f1,t0+dur);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(vol,t0+dur*0.3);
g.gain.exponentialRampToValueAtTime(0.0001,t0+dur+0.03);
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+dur+0.06);
}
function ping(){
if(!inited) return;
const t0=ctx.currentTime;
[5200,7800].forEach((f,i)=>{
const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=f*rand(0.98,1.02);
const g=ctx.createGain(); env(g,t0,0.16/(i+1),0.5);
o.connect(g); g.connect(comp); o.start(t0); o.stop(t0+0.55);
});
}
function footstep(run=false, dist=0){
if(!inited) return;
const sp=spatial(dist,40); if(sp.gain<0.03) return;
const t0=ctx.currentTime;
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=run?500:380;
const g=ctx.createGain(); env(g,t0,(run?0.2:0.11)*sp.gain, 0.07);
n.connect(lp); lp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.12);
}
function whizz(){
if(!inited) return;
const t0=ctx.currentTime;
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=4;
bp.frequency.setValueAtTime(4200,t0); bp.frequency.exponentialRampToValueAtTime(900,t0+0.16);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(0.22,t0+0.03);
g.gain.exponentialRampToValueAtTime(0.0001,t0+0.17);
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.2);
}
function ricochet(dist){
if(!inited) return;
const sp=spatial(dist,80); if(sp.gain<0.03) return;
const t0=ctx.currentTime;
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(rand(2400,3600),t0);
o.frequency.exponentialRampToValueAtTime(rand(700,1100),t0+0.22);
const g=ctx.createGain(); env(g,t0,0.1*sp.gain,0.22);
o.connect(g); g.connect(comp); o.start(t0); o.stop(t0+0.25);
}
function hurt(){
if(!inited) return;
const t0=ctx.currentTime;
const o=ctx.createOscillator(); o.type='sawtooth';
o.frequency.setValueAtTime(220,t0); o.frequency.exponentialRampToValueAtTime(90,t0+0.15);
const g=ctx.createGain(); env(g,t0,0.2,0.15);
o.connect(g); g.connect(comp); o.start(t0); o.stop(t0+0.18);
}
function hitmarkSnd(kill){
if(!inited) return;
const t0=ctx.currentTime;
if(kill){
// 击杀确认: 低频重击 + 脆响 + 双音上行
const o1=ctx.createOscillator(); o1.type='sine';
o1.frequency.setValueAtTime(220,t0); o1.frequency.exponentialRampToValueAtTime(85,t0+0.13);
const g1=ctx.createGain(); env(g1,t0,0.55,0.14);
o1.connect(g1); g1.connect(comp); o1.start(t0); o1.stop(t0+0.17);
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=3400; bp.Q.value=1.4;
const gn=ctx.createGain(); env(gn,t0,0.3,0.045);
n.connect(bp); bp.connect(gn); gn.connect(comp); n.start(t0); n.stop(t0+0.08);
[[920,t0+0.03,0.34],[1380,t0+0.095,0.28]].forEach(([f,tt,v])=>{
const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=f;
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,tt);
g.gain.linearRampToValueAtTime(v,tt+0.012);
g.gain.exponentialRampToValueAtTime(0.0001,tt+0.24);
o.connect(g); g.connect(comp); o.start(tt); o.stop(tt+0.28);
});
} else {
const o=ctx.createOscillator(); o.type='square'; o.frequency.value=820;
const g=ctx.createGain(); env(g,t0,0.12,0.05);
o.connect(g); g.connect(comp); o.start(t0); o.stop(t0+0.09);
}
}
function mortarThunk(dist=0){
if(!inited) return;
const sp=spatial(dist,300); if(sp.gain<0.02) return;
const t0=ctx.currentTime;
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(165,t0); o.frequency.exponentialRampToValueAtTime(48,t0+0.18);
const g=ctx.createGain(); env(g,t0,0.85*sp.gain,0.2);
o.connect(g); g.connect(comp); o.start(t0); o.stop(t0+0.25);
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
const g2=ctx.createGain(); env(g2,t0,0.5*sp.gain,0.09);
n.connect(lp); lp.connect(g2); g2.connect(comp); n.start(t0); n.stop(t0+0.14);
}
function nadeBounce(dist){
if(!inited) return;
const sp=spatial(dist,60); if(sp.gain<0.05) return;
click(600,0.3*sp.gain,0.04);
}
function cannon(dist=0,pan=0){
if(!inited) return; resume();
const t0=ctx.currentTime;
const sp=spatial(dist,500); if(sp.gain<0.02) return;
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(85,t0); o.frequency.exponentialRampToValueAtTime(26,t0+0.7);
const og=ctx.createGain(); env(og,t0,1.6*sp.gain,0.7);
o.connect(og); og.connect(comp); o.start(t0); o.stop(t0+0.8);
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass';
lp.frequency.setValueAtTime(Math.min(sp.lp,3800),t0); lp.frequency.exponentialRampToValueAtTime(160,t0+0.9);
const ng=ctx.createGain(); env(ng,t0,1.2*sp.gain,0.9);
n.connect(lp); lp.connect(ng); ng.connect(comp); n.start(t0); n.stop(t0+1);
}
function flakPop(dist=0){
if(!inited) return;
const t0=ctx.currentTime;
const sp=spatial(dist,300); if(sp.gain<0.02) return;
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=Math.min(sp.lp,1500);
const g=ctx.createGain(); env(g,t0,0.55*sp.gain,0.35);
n.connect(lp); lp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.4);
}
function createEngine(kind){
const e={ nodes:null, kind };
e.update=(freq,vol)=>{
if(!inited){ return; }
if(!e.nodes){
const osc=ctx.createOscillator();
osc.type=kind==='plane'?'sawtooth':'triangle';
const osc2=ctx.createOscillator();
osc2.type='sawtooth'; osc2.detune.value=kind==='plane'?18:8;
const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=kind==='plane'?900:340;
const g=ctx.createGain(); g.gain.value=0;
osc.connect(lp); osc2.connect(lp); lp.connect(g); g.connect(comp);
osc.start(); osc2.start();
e.nodes={osc,osc2,g,lp};
}
const t0=ctx.currentTime;
e.nodes.osc.frequency.setTargetAtTime(freq,t0,0.12);
e.nodes.osc2.frequency.setTargetAtTime(freq*0.5,t0,0.12);
e.nodes.g.gain.setTargetAtTime(clamp(vol,0,0.4),t0,0.12);
};
e.stop=()=>{ if(e.nodes){ try{ e.nodes.g.gain.setTargetAtTime(0,ctx.currentTime,0.1); }catch(err){} } };
return e;
}
function startAmbient(){
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=280;
const g=ctx.createGain(); g.gain.value=0.052;
const lfo=ctx.createOscillator(); lfo.frequency.value=0.13;
const lg=ctx.createGain(); lg.gain.value=90;
lfo.connect(lg); lg.connect(lp.frequency);
n.connect(lp); lp.connect(g); g.connect(comp); n.start(); lfo.start();
// 雨声环境层
if(WEATHER==='rain'||WEATHER==='storm'){
const rn=noiseSrc();
const rl=ctx.createBiquadFilter(); rl.type='bandpass'; rl.frequency.value=1500; rl.Q.value=0.35;
const rg=ctx.createGain(); rg.gain.value=WEATHER==='storm'?0.08:0.055;
rn.connect(rl); rl.connect(rg); rg.connect(comp); rn.start();
}
// 远处机枪对射: 断续的闷响连射
setInterval(()=>{ if(Math.random()<0.45) distantMG(); }, 4600);
// 鸟鸣: 随机间隔的合成啁啾, 左右声道随机
setInterval(()=>{ if(Math.random()<0.55) bird(); }, 2400);
setTimeout(bird,1200);
}
function distantMG(){
if(!ctx) return;
const t0=ctx.currentTime;
const nCnt=randi(5,14), gap=rand(0.07,0.11);
const vol=rand(0.018,0.045);
const f=rand(400,700);
const panV=rand(-0.8,0.8);
const panN=ctx.createStereoPanner?ctx.createStereoPanner():null;
const bus=ctx.createGain(); bus.gain.value=1;
const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
bus.connect(lp);
if(panN){ panN.pan.value=panV; lp.connect(panN); panN.connect(comp); } else lp.connect(comp);
for(let i=0;i<nCnt;i++){
const t=t0+i*gap*rand(0.9,1.1);
const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=f*rand(0.9,1.1);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t);
g.gain.linearRampToValueAtTime(vol,t+0.006);
g.gain.exponentialRampToValueAtTime(0.0001,t+0.05);
o.connect(g); g.connect(bus); o.start(t); o.stop(t+0.08);
}
}
function bird(){
if(!ctx||THEME.birds===false) return;
const t0=ctx.currentTime;
const o=ctx.createOscillator(); o.type='sine';
const g=ctx.createGain(); g.gain.value=0;
let out=g;
if(ctx.createStereoPanner){
const pan=ctx.createStereoPanner();
pan.pan.value=rand(-0.85,0.85);
g.connect(pan); pan.connect(comp);
} else g.connect(comp);
o.connect(g);
const nCh=randi(2,5);
const dist=rand(0.4,1);
let t=t0+0.03;
for(let i=0;i<nCh;i++){
const f=rand(2300,3900);
o.frequency.setValueAtTime(f,t);
o.frequency.exponentialRampToValueAtTime(f*rand(1.12,1.42),t+rand(0.035,0.08));
if(Math.random()<0.4) o.frequency.exponentialRampToValueAtTime(f*rand(0.85,0.95),t+rand(0.09,0.13));
g.gain.setValueAtTime(0,t);
g.gain.linearRampToValueAtTime(rand(0.01,0.026)*dist,t+0.018);
g.gain.exponentialRampToValueAtTime(0.0001,t+rand(0.09,0.16));
t+=rand(0.11,0.28);
}
o.start(t0); o.stop(t+0.3);
}
return { init, gunshot, explosion, click, metalSlide, ping, footstep, whizz, ricochet, hurt, hitmarkSnd, nadeBounce, cannon, flakPop, createEngine, setVol, resume, mortarThunk };
})();
