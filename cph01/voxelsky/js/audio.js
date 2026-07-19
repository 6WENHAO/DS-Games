import{clamp}from"./util.js";

export class AudioEngine{
  constructor(){
    this.ok=false;
    this.sfxVol=0.8;
    this.musicVol=0.55;
    this.voiceOn=true;
    this.loops={};
    this.musicTimer=null;
    this.musicMode=null;
    this._lastStep=0;
    this._lastHazBeep=0;
  }
  init(){
    if(this.ok)return;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    this.ctx=new AC();
    const c=this.ctx;
    this.master=c.createDynamicsCompressor();
    this.master.threshold.value=-14;
    this.master.knee.value=22;
    this.master.ratio.value=8;
    this.master.connect(c.destination);
    this.sfx=c.createGain();this.sfx.gain.value=this.sfxVol;this.sfx.connect(this.master);
    this.music=c.createGain();this.music.gain.value=this.musicVol;this.music.connect(this.master);
    this.verb=c.createConvolver();
    this.verb.buffer=this._impulse(2.8,2.4);
    this.verbGain=c.createGain();this.verbGain.gain.value=0.35;
    this.verb.connect(this.verbGain);this.verbGain.connect(this.master);
    this.musicVerb=c.createConvolver();
    this.musicVerb.buffer=this._impulse(5.5,3.2);
    this.musicVerbGain=c.createGain();this.musicVerbGain.gain.value=0.8;
    this.musicVerb.connect(this.musicVerbGain);this.musicVerbGain.connect(this.music);
    this.noiseBuf=this._noiseBuffer(2);
    this.ok=true;
  }
  resume(){if(this.ok&&this.ctx.state==="suspended")this.ctx.resume();}
  setSfxVol(v){this.sfxVol=v;if(this.ok)this.sfx.gain.setTargetAtTime(v,this.ctx.currentTime,0.05);}
  setMusicVol(v){this.musicVol=v;if(this.ok)this.music.gain.setTargetAtTime(v,this.ctx.currentTime,0.05);}
  _impulse(dur,decay){
    const c=this.ctx,rate=c.sampleRate,len=Math.floor(rate*dur);
    const buf=c.createBuffer(2,len,rate);
    for(let ch=0;ch<2;ch++){
      const d=buf.getChannelData(ch);
      for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
    }
    return buf;
  }
  _noiseBuffer(dur){
    const c=this.ctx,len=Math.floor(c.sampleRate*dur);
    const buf=c.createBuffer(1,len,c.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    return buf;
  }
  _noise(){
    const s=this.ctx.createBufferSource();
    s.buffer=this.noiseBuf;s.loop=true;
    s.start();
    return s;
  }
  _env(gain,t,a,peak,d,sustain=0,r=0.08){
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001,t);
    gain.gain.linearRampToValueAtTime(peak,t+a);
    gain.gain.exponentialRampToValueAtTime(Math.max(sustain,0.0001),t+a+d);
    if(sustain<=0)gain.gain.linearRampToValueAtTime(0,t+a+d+r);
  }
  _osc(type,freq){
    const o=this.ctx.createOscillator();
    o.type=type;o.frequency.value=freq;
    return o;
  }
  _tone({type="sine",f0=440,f1=null,dur=0.15,a=0.005,peak=0.3,slideT=null,verb=0,filter=null,pan=0}){
    if(!this.ok)return;
    const c=this.ctx,t=c.currentTime;
    const o=this._osc(type,f0);
    if(f1!=null)o.frequency.exponentialRampToValueAtTime(Math.max(f1,1),t+(slideT||dur));
    const g=c.createGain();
    this._env(g,t,a,peak,dur);
    let node=o;
    if(filter){
      const fl=c.createBiquadFilter();
      fl.type=filter.type||"lowpass";fl.frequency.value=filter.f;fl.Q.value=filter.q||1;
      node.connect(fl);node=fl;
    }
    node.connect(g);
    let out=g;
    if(pan&&c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=pan;g.connect(p);out=p;}
    out.connect(this.sfx);
    if(verb>0){const vg=c.createGain();vg.gain.value=verb;out.connect(vg);vg.connect(this.verb);}
    o.start(t);o.stop(t+dur+0.6);
  }
  _burst({dur=0.15,peak=0.3,f=1200,q=1,type="bandpass",f1=null,a=0.002,verb=0}){
    if(!this.ok)return;
    const c=this.ctx,t=c.currentTime;
    const n=this._noise();
    const fl=c.createBiquadFilter();
    fl.type=type;fl.frequency.value=f;fl.Q.value=q;
    if(f1!=null)fl.frequency.exponentialRampToValueAtTime(Math.max(f1,10),t+dur);
    const g=c.createGain();
    this._env(g,t,a,peak,dur);
    n.connect(fl);fl.connect(g);g.connect(this.sfx);
    if(verb>0){const vg=c.createGain();vg.gain.value=verb;g.connect(vg);vg.connect(this.verb);}
    n.stop(t+dur+0.6);
  }

  uiMove(){this._tone({type:"sine",f0:880,dur:0.05,peak:0.12});}
  uiConfirm(){this._tone({type:"sine",f0:660,f1:990,dur:0.1,peak:0.18,verb:0.2});this._tone({type:"sine",f0:1320,dur:0.14,a:0.04,peak:0.1,verb:0.3});}
  uiOpen(){this._burst({dur:0.18,f:600,f1:2400,q:2,peak:0.1});this._tone({type:"sine",f0:520,f1:780,dur:0.12,peak:0.14});}
  uiClose(){this._burst({dur:0.16,f:2000,f1:500,q:2,peak:0.09});this._tone({type:"sine",f0:700,f1:460,dur:0.11,peak:0.13});}
  uiError(){this._tone({type:"square",f0:220,dur:0.09,peak:0.1});this._tone({type:"square",f0:180,dur:0.14,peak:0.1,a:0.09});}
  notify(){
    if(!this.ok)return;
    const t=this.ctx.currentTime;
    [[720,0],[960,0.12]].forEach(([f,dt])=>{
      const o=this._osc("sine",f),g=this.ctx.createGain();
      this._env(g,t+dt,0.005,0.2,0.35);
      o.connect(g);g.connect(this.sfx);
      const vg=this.ctx.createGain();vg.gain.value=0.5;g.connect(vg);vg.connect(this.verb);
      o.start(t+dt);o.stop(t+dt+0.8);
    });
  }
  missionDone(){
    if(!this.ok)return;
    const t=this.ctx.currentTime;
    [523.25,659.25,783.99,1046.5].forEach((f,i)=>{
      const o=this._osc("triangle",f),g=this.ctx.createGain();
      this._env(g,t+i*0.09,0.01,0.22,0.5);
      o.connect(g);g.connect(this.sfx);
      const vg=this.ctx.createGain();vg.gain.value=0.6;g.connect(vg);vg.connect(this.verb);
      o.start(t+i*0.09);o.stop(t+i*0.09+1);
    });
  }
  discovery(){
    if(!this.ok)return;
    const t=this.ctx.currentTime;
    [659.25,830.6,987.77].forEach((f,i)=>{
      const o=this._osc("sine",f),g=this.ctx.createGain();
      this._env(g,t+i*0.13,0.02,0.2,0.7);
      o.connect(g);g.connect(this.sfx);
      const vg=this.ctx.createGain();vg.gain.value=0.7;g.connect(vg);vg.connect(this.verb);
      o.start(t+i*0.13);o.stop(t+i*0.13+1.4);
    });
  }
  units(){
    this._tone({type:"sine",f0:1245,dur:0.07,peak:0.12});
    this._tone({type:"sine",f0:1661,dur:0.12,peak:0.1,a:0.06,verb:0.3});
  }
  pickup(n=1){
    const base=740+Math.min(n,40)*6;
    this._tone({type:"sine",f0:base,f1:base*1.35,dur:0.07,peak:0.16});
    this._tone({type:"sine",f0:base*1.5,dur:0.09,a:0.05,peak:0.09});
  }
  craft(){
    this._burst({dur:0.22,f:900,f1:2600,q:3,peak:0.12});
    this._tone({type:"triangle",f0:440,f1:880,dur:0.28,peak:0.16,verb:0.4});
    this._tone({type:"sine",f0:1760,dur:0.3,a:0.14,peak:0.08,verb:0.5});
  }
  blockBreak(mat="stone"){
    const m={stone:[420,3,0.3],dirt:[300,1,0.22],wood:[520,2,0.26],crystal:[1600,6,0.3],metal:[800,5,0.3],plant:[900,1.5,0.18],sand:[260,0.8,0.2],ice:[1200,4,0.26]}[mat]||[420,3,0.28];
    this._burst({dur:0.16,f:m[0],f1:m[0]*0.4,q:m[1],peak:m[2]});
    this._burst({dur:0.07,f:m[0]*2.4,q:1,peak:m[2]*0.5});
    if(mat==="crystal"||mat==="ice")this._tone({type:"sine",f0:m[0]*1.5,f1:m[0]*2.2,dur:0.14,peak:0.1});
  }
  blockPlace(){
    this._burst({dur:0.09,f:340,f1:180,q:1.4,peak:0.26});
    this._tone({type:"sine",f0:190,f1:120,dur:0.09,peak:0.18});
  }
  footstep(mat="dirt"){
    if(!this.ok)return;
    const now=performance.now();
    if(now-this._lastStep<180)return;
    this._lastStep=now;
    const m={dirt:[320,0.09],stone:[520,0.07],sand:[240,0.11],snow:[200,0.12],metal:[700,0.07],grass:[300,0.1]}[mat]||[320,0.09];
    this._burst({dur:m[1],f:m[0]*(0.9+Math.random()*0.25),q:0.9,peak:0.07+Math.random()*0.03,type:"lowpass"});
  }
  jump(){this._burst({dur:0.1,f:500,f1:900,q:1,peak:0.06});}
  land(v=1){
    const p=clamp(0.1+v*0.05,0.1,0.4);
    this._burst({dur:0.14,f:300,f1:120,q:1,peak:p,type:"lowpass"});
  }
  damage(){
    this._burst({dur:0.2,f:500,f1:150,q:1.5,peak:0.35});
    this._tone({type:"sawtooth",f0:160,f1:80,dur:0.22,peak:0.2,filter:{type:"lowpass",f:600}});
  }
  hazardBeep(sev=1){
    const now=performance.now();
    if(now-this._lastHazBeep<(sev>1?900:2000))return;
    this._lastHazBeep=now;
    this._tone({type:"square",f0:sev>1?980:760,dur:0.08,peak:0.09,filter:{type:"lowpass",f:2400}});
    this._tone({type:"square",f0:sev>1?980:760,dur:0.08,peak:0.09,a:0.14,filter:{type:"lowpass",f:2400}});
  }
  scanPulse(){
    if(!this.ok)return;
    const c=this.ctx,t=c.currentTime;
    const o=this._osc("sine",340);
    o.frequency.exponentialRampToValueAtTime(1500,t+1.1);
    const g=c.createGain();
    this._env(g,t,0.03,0.16,1.1);
    o.connect(g);g.connect(this.sfx);
    const vg=c.createGain();vg.gain.value=0.7;g.connect(vg);vg.connect(this.verb);
    o.start(t);o.stop(t+1.6);
    this._burst({dur:1.0,f:800,f1:3400,q:6,peak:0.05});
  }
  visorTick(){this._tone({type:"sine",f0:1180,dur:0.04,peak:0.07});}
  scanDone(){
    this._tone({type:"sine",f0:880,f1:1320,dur:0.12,peak:0.16,verb:0.3});
    this._tone({type:"sine",f0:1760,dur:0.22,a:0.1,peak:0.12,verb:0.5});
  }
  interactTick(){this._tone({type:"sine",f0:620,dur:0.045,peak:0.07});}
  interactDone(){this.uiConfirm();}
  takeoff(){
    this._burst({dur:1.6,f:120,f1:900,q:0.8,peak:0.5,type:"lowpass",a:0.05,verb:0.4});
    this._tone({type:"sawtooth",f0:60,f1:220,dur:1.4,peak:0.22,filter:{type:"lowpass",f:500}});
  }
  landingGear(){
    this._tone({type:"square",f0:180,f1:120,dur:0.4,peak:0.07,filter:{type:"lowpass",f:800}});
    setTimeout(()=>this._burst({dur:0.12,f:400,f1:150,q:2,peak:0.2}),380);
  }
  touchdown(){
    this._burst({dur:0.3,f:200,f1:70,q:1,peak:0.4,type:"lowpass"});
    this._burst({dur:0.5,f:600,f1:200,q:1,peak:0.12});
  }
  boost(){
    this._burst({dur:0.7,f:300,f1:2200,q:1.2,peak:0.22,a:0.04});
  }
  pulseCharge(){
    this._tone({type:"sawtooth",f0:80,f1:640,dur:1.15,peak:0.14,filter:{type:"lowpass",f:1800},verb:0.4});
    this._burst({dur:1.15,f:400,f1:4000,q:3,peak:0.1,a:0.1});
  }
  pulseDrop(){
    this._tone({type:"sawtooth",f0:520,f1:70,dur:0.8,peak:0.2,filter:{type:"lowpass",f:1400},verb:0.5});
    this._burst({dur:0.9,f:3000,f1:200,q:2,peak:0.18});
  }
  warpHit(){
    this._burst({dur:0.4,f:1200,f1:300,q:1,peak:0.3,verb:0.6});
    this._tone({type:"sine",f0:220,f1:55,dur:0.7,peak:0.3});
  }
  shoot(){
    this._tone({type:"square",f0:1400,f1:300,dur:0.13,peak:0.15,filter:{type:"lowpass",f:3000}});
    this._burst({dur:0.1,f:2400,f1:600,q:2,peak:0.1});
  }
  explosion(big=false){
    this._burst({dur:big?1:0.5,f:400,f1:60,q:0.7,peak:big?0.5:0.34,type:"lowpass",verb:0.5});
    this._burst({dur:0.25,f:2000,f1:300,q:1,peak:0.15});
  }
  asteroidCrack(){
    this._burst({dur:0.3,f:700,f1:150,q:2,peak:0.3});
    this._tone({type:"sine",f0:300,f1:90,dur:0.3,peak:0.2});
  }
  creatureCall(seed=0.5,dist=1){
    if(!this.ok)return;
    const c=this.ctx,t=c.currentTime;
    const f=220+seed*660;
    const o=this._osc("sine",f);
    const mod=this._osc("sine",f*(1.5+seed*2));
    const mg=c.createGain();mg.gain.value=f*(0.4+seed);
    mod.connect(mg);mg.connect(o.frequency);
    const g=c.createGain();
    const vol=clamp(0.14/Math.max(dist*0.08,1),0.015,0.14);
    this._env(g,t,0.03,vol,0.35);
    o.connect(g);g.connect(this.sfx);
    const vg=c.createGain();vg.gain.value=0.8;g.connect(vg);vg.connect(this.verb);
    o.start(t);mod.start(t);
    o.stop(t+0.8);mod.stop(t+0.8);
    if(seed>0.6)setTimeout(()=>{if(this.ok)this._tone({type:"sine",f0:f*1.25,f1:f*0.9,dur:0.25,peak:vol*0.8,verb:0.5});},300);
  }

  startBeam(){
    if(!this.ok||this.loops.beam)return;
    const c=this.ctx;
    const o1=this._osc("sawtooth",92);
    const o2=this._osc("sawtooth",92.7);
    const lfo=this._osc("sine",13);
    const lg=c.createGain();lg.gain.value=260;
    lfo.connect(lg);
    const fl=c.createBiquadFilter();fl.type="bandpass";fl.frequency.value=760;fl.Q.value=2.4;
    lg.connect(fl.frequency);
    const n=this._noise();
    const nf=c.createBiquadFilter();nf.type="highpass";nf.frequency.value=3600;
    const ng=c.createGain();ng.gain.value=0.05;
    n.connect(nf);nf.connect(ng);
    const g=c.createGain();g.gain.value=0.0001;
    g.gain.setTargetAtTime(0.16,c.currentTime,0.05);
    o1.connect(fl);o2.connect(fl);fl.connect(g);ng.connect(g);
    g.connect(this.sfx);
    o1.start();o2.start();lfo.start();
    this.loops.beam={nodes:[o1,o2,lfo,n],gain:g};
  }
  stopBeam(){
    const l=this.loops.beam;
    if(!l)return;
    l.gain.gain.setTargetAtTime(0.0001,this.ctx.currentTime,0.05);
    setTimeout(()=>l.nodes.forEach(x=>{try{x.stop();}catch(e){}}),300);
    this.loops.beam=null;
  }
  overheat(){
    this.stopBeam();
    this._tone({type:"sawtooth",f0:600,f1:120,dur:0.7,peak:0.16,filter:{type:"lowpass",f:1300}});
    this._burst({dur:0.9,f:5000,f1:1400,q:1,peak:0.1});
  }
  startJetpack(){
    if(!this.ok||this.loops.jet)return;
    const c=this.ctx;
    const n=this._noise();
    const fl=c.createBiquadFilter();fl.type="bandpass";fl.frequency.value=900;fl.Q.value=0.7;
    const o=this._osc("sawtooth",70);
    const og=c.createGain();og.gain.value=0.35;
    o.connect(og);
    const g=c.createGain();g.gain.value=0.0001;
    g.gain.setTargetAtTime(0.2,c.currentTime,0.06);
    n.connect(fl);fl.connect(g);og.connect(g);
    g.connect(this.sfx);
    o.start();
    this.loops.jet={nodes:[n,o],gain:g};
  }
  stopJetpack(){
    const l=this.loops.jet;
    if(!l)return;
    l.gain.gain.setTargetAtTime(0.0001,this.ctx.currentTime,0.08);
    setTimeout(()=>l.nodes.forEach(x=>{try{x.stop();}catch(e){}}),400);
    this.loops.jet=null;
  }
  startWind(){
    if(!this.ok||this.loops.wind)return;
    const c=this.ctx;
    const n=this._noise();
    const fl=c.createBiquadFilter();fl.type="lowpass";fl.frequency.value=380;fl.Q.value=0.4;
    const lfo=this._osc("sine",0.13);
    const lg=c.createGain();lg.gain.value=180;
    lfo.connect(lg);lg.connect(fl.frequency);
    const g=c.createGain();g.gain.value=0.0001;
    n.connect(fl);fl.connect(g);g.connect(this.sfx);
    lfo.start();
    this.loops.wind={nodes:[n,lfo],gain:g,target:0};
  }
  setWind(v){
    if(!this.loops.wind)this.startWind();
    if(!this.loops.wind)return;
    this.loops.wind.gain.gain.setTargetAtTime(clamp(v,0,0.3),this.ctx.currentTime,0.8);
  }
  stopWind(){
    const l=this.loops.wind;
    if(!l)return;
    l.gain.gain.setTargetAtTime(0.0001,this.ctx.currentTime,0.6);
    setTimeout(()=>l.nodes.forEach(x=>{try{x.stop();}catch(e){}}),1600);
    this.loops.wind=null;
  }
  startSpaceAmbient(){
    if(!this.ok||this.loops.space)return;
    const c=this.ctx;
    const o1=this._osc("sine",55);
    const o2=this._osc("sine",55.35);
    const o3=this._osc("triangle",110.2);
    const og3=c.createGain();og3.gain.value=0.14;
    o3.connect(og3);
    const fl=c.createBiquadFilter();fl.type="lowpass";fl.frequency.value=240;
    const g=c.createGain();g.gain.value=0.0001;
    g.gain.setTargetAtTime(0.07,c.currentTime,2);
    o1.connect(fl);o2.connect(fl);og3.connect(fl);fl.connect(g);g.connect(this.sfx);
    const vg=c.createGain();vg.gain.value=0.6;g.connect(vg);vg.connect(this.verb);
    o1.start();o2.start();o3.start();
    this.loops.space={nodes:[o1,o2,o3],gain:g};
  }
  stopSpaceAmbient(){
    const l=this.loops.space;
    if(!l)return;
    l.gain.gain.setTargetAtTime(0.0001,this.ctx.currentTime,1);
    setTimeout(()=>l.nodes.forEach(x=>{try{x.stop();}catch(e){}}),2500);
    this.loops.space=null;
  }
  startShip(){
    if(!this.ok||this.loops.ship)return;
    const c=this.ctx;
    const o1=this._osc("sawtooth",48);
    const o2=this._osc("sawtooth",48.6);
    const o3=this._osc("triangle",96);
    const n=this._noise();
    const nf=c.createBiquadFilter();nf.type="bandpass";nf.frequency.value=1400;nf.Q.value=0.6;
    const ng=c.createGain();ng.gain.value=0.12;
    n.connect(nf);nf.connect(ng);
    const fl=c.createBiquadFilter();fl.type="lowpass";fl.frequency.value=320;fl.Q.value=0.8;
    const og3=c.createGain();og3.gain.value=0.4;
    o3.connect(og3);
    const g=c.createGain();g.gain.value=0.0001;
    o1.connect(fl);o2.connect(fl);og3.connect(fl);ng.connect(fl);
    fl.connect(g);g.connect(this.sfx);
    o1.start();o2.start();o3.start();
    this.loops.ship={nodes:[o1,o2,o3,n],gain:g,o1,o2,o3,fl};
  }
  setShip(throttle,boost=0){
    const l=this.loops.ship;
    if(!l)return;
    const t=this.ctx.currentTime;
    const base=48+throttle*46+boost*36;
    l.o1.frequency.setTargetAtTime(base,t,0.2);
    l.o2.frequency.setTargetAtTime(base*1.012,t,0.2);
    l.o3.frequency.setTargetAtTime(base*2,t,0.2);
    l.fl.frequency.setTargetAtTime(320+throttle*900+boost*1400,t,0.25);
    l.gain.gain.setTargetAtTime(0.05+throttle*0.14+boost*0.08,t,0.15);
  }
  stopShip(){
    const l=this.loops.ship;
    if(!l)return;
    l.gain.gain.setTargetAtTime(0.0001,this.ctx.currentTime,0.4);
    setTimeout(()=>l.nodes.forEach(x=>{try{x.stop();}catch(e){}}),1200);
    this.loops.ship=null;
  }
  startPulse(){
    if(!this.ok||this.loops.pulse)return;
    const c=this.ctx;
    const n=this._noise();
    const fl=c.createBiquadFilter();fl.type="bandpass";fl.frequency.value=500;fl.Q.value=1.2;
    const lfo=this._osc("sine",6);
    const lg=c.createGain();lg.gain.value=300;
    lfo.connect(lg);lg.connect(fl.frequency);
    const o=this._osc("sawtooth",38);
    const og=c.createGain();og.gain.value=0.5;
    o.connect(og);
    const g=c.createGain();g.gain.value=0.0001;
    g.gain.setTargetAtTime(0.24,c.currentTime,0.4);
    n.connect(fl);fl.connect(g);og.connect(g);g.connect(this.sfx);
    o.start();lfo.start();
    this.loops.pulse={nodes:[n,o,lfo],gain:g};
  }
  stopPulse(){
    const l=this.loops.pulse;
    if(!l)return;
    l.gain.gain.setTargetAtTime(0.0001,this.ctx.currentTime,0.2);
    setTimeout(()=>l.nodes.forEach(x=>{try{x.stop();}catch(e){}}),800);
    this.loops.pulse=null;
  }
  startEntry(){
    if(!this.ok||this.loops.entry)return;
    const c=this.ctx;
    const n=this._noise();
    const fl=c.createBiquadFilter();fl.type="lowpass";fl.frequency.value=180;
    const g=c.createGain();g.gain.value=0.0001;
    n.connect(fl);fl.connect(g);g.connect(this.sfx);
    this.loops.entry={nodes:[n],gain:g,fl};
  }
  setEntry(v){
    const l=this.loops.entry;
    if(!l)return;
    const t=this.ctx.currentTime;
    l.gain.gain.setTargetAtTime(clamp(v,0,1)*0.5,t,0.15);
    l.fl.frequency.setTargetAtTime(180+v*1600,t,0.2);
  }
  stopEntry(){
    const l=this.loops.entry;
    if(!l)return;
    l.gain.gain.setTargetAtTime(0.0001,this.ctx.currentTime,0.3);
    setTimeout(()=>l.nodes.forEach(x=>{try{x.stop();}catch(e){}}),1000);
    this.loops.entry=null;
  }
  stopAllLoops(){
    this.stopBeam();this.stopJetpack();this.stopWind();this.stopSpaceAmbient();
    this.stopShip();this.stopPulse();this.stopEntry();
  }

  speak(text){
    if(!this.voiceOn||!window.speechSynthesis)return;
    try{
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang="zh-CN";u.rate=1.02;u.pitch=0.65;u.volume=clamp(this.sfxVol,0,1);
      const vs=speechSynthesis.getVoices();
      const v=vs.find(x=>x.lang&&x.lang.startsWith("zh"));
      if(v)u.voice=v;
      speechSynthesis.speak(u);
    }catch(e){}
  }

  startMusic(mode){
    if(!this.ok)return;
    if(this.musicMode===mode)return;
    this.stopMusic();
    this.musicMode=mode;
    const scales={
      title:[146.83,174.61,220,261.63,293.66,349.23,440],
      planet:[130.81,164.81,196,246.94,261.63,329.63,392],
      space:[110,130.81,164.81,196,220,261.63,329.63],
      danger:[103.83,123.47,155.56,185,207.65,246.94]
    };
    const scale=scales[mode]||scales.planet;
    const chordGap=mode==="space"?9000:7000;
    let step=0;
    const padChord=()=>{
      if(!this.ok||this.musicMode!==mode)return;
      const c=this.ctx,t=c.currentTime;
      const root=scale[step%scale.length];
      const tones=[root,root*1.5,root*2,root*(step%2?2.4:2.5)];
      step+=Math.floor(Math.random()*2)+1;
      tones.forEach((f,i)=>{
        const o=this._osc(i<2?"sine":"triangle",f*(1+(Math.random()-0.5)*0.003));
        const g=c.createGain();
        const peak=(i===0?0.09:0.05)*(mode==="space"?0.8:1);
        g.gain.setValueAtTime(0.0001,t);
        g.gain.linearRampToValueAtTime(peak,t+2.6);
        g.gain.setValueAtTime(peak,t+chordGap/1000-2.2);
        g.gain.linearRampToValueAtTime(0.0001,t+chordGap/1000+1.8);
        const fl=c.createBiquadFilter();fl.type="lowpass";fl.frequency.value=900+Math.random()*600;
        o.connect(fl);fl.connect(g);
        g.connect(this.music);
        const vg=c.createGain();vg.gain.value=0.9;g.connect(vg);vg.connect(this.musicVerb);
        o.start(t);o.stop(t+chordGap/1000+3);
      });
    };
    const pluck=()=>{
      if(!this.ok||this.musicMode!==mode)return;
      if(Math.random()<(mode==="space"?0.4:0.55)){
        const c=this.ctx,t=c.currentTime;
        const f=scale[Math.floor(Math.random()*scale.length)]*(Math.random()<0.5?2:4);
        const o=this._osc("triangle",f);
        const g=c.createGain();
        this._env(g,t,0.01,0.055,1.6);
        const fl=c.createBiquadFilter();fl.type="lowpass";fl.frequency.value=2200;
        o.connect(fl);fl.connect(g);g.connect(this.music);
        const vg=c.createGain();vg.gain.value=1.2;g.connect(vg);vg.connect(this.musicVerb);
        o.start(t);o.stop(t+2.4);
      }
    };
    padChord();
    this.musicTimer=setInterval(padChord,chordGap);
    this.pluckTimer=setInterval(pluck,mode==="title"?2400:3200);
  }
  stopMusic(){
    this.musicMode=null;
    if(this.musicTimer){clearInterval(this.musicTimer);this.musicTimer=null;}
    if(this.pluckTimer){clearInterval(this.pluckTimer);this.pluckTimer=null;}
  }
}
