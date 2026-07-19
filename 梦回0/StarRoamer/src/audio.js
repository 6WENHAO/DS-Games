'use strict';
/* ================= audio.js — 全程序化 WebAudio：引擎/枪声/脚步/碰撞/UI/合成器电台 ================= */

const AudioSys={
  ctx:null,started:false,master:null,sfx:null,music:null,
  engines:{},station:0,stationNames:['OFF','星港之声 88.5','深空环境 101.2','合成浪潮 94.7'],
  radioNodes:null,radioTimer:null,volume:0.8,

  boot(){
    if(this.started)return;
    try{
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      if(this.ctx.resume)this.ctx.resume();
      this.master=this.ctx.createGain();this.master.gain.value=this.volume;
      this.master.connect(this.ctx.destination);
      this.sfx=this.ctx.createGain();this.sfx.gain.value=1;this.sfx.connect(this.master);
      this.music=this.ctx.createGain();this.music.gain.value=0.5;this.music.connect(this.master);
      this.mkShipEngine();this.mkRoverEngine();this.mkWind();
      this.started=true;
    }catch(e){console.warn('audio boot fail',e)}
  },
  setVol(v){this.volume=clamp(v,0,1);if(this.master)this.master.gain.value=this.volume},

  /* --- 连续声源 --- */
  mkShipEngine(){
    const c=this.ctx;
    const g=c.createGain();g.gain.value=0;g.connect(this.sfx);
    const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=400;f.connect(g);
    const o1=c.createOscillator();o1.type='sawtooth';o1.frequency.value=42;
    const o2=c.createOscillator();o2.type='sine';o2.frequency.value=84;
    const og1=c.createGain();og1.gain.value=0.5;const og2=c.createGain();og2.gain.value=0.6;
    o1.connect(og1);og1.connect(f);o2.connect(og2);og2.connect(f);
    const noise=this.noiseSrc();
    const nf=c.createBiquadFilter();nf.type='bandpass';nf.frequency.value=900;nf.Q.value=0.7;
    const ng=c.createGain();ng.gain.value=0.25;
    noise.connect(nf);nf.connect(ng);ng.connect(f);
    o1.start();o2.start();
    this.engines.ship={g,f,o1,o2,nf};
  },
  mkRoverEngine(){
    const c=this.ctx;
    const g=c.createGain();g.gain.value=0;g.connect(this.sfx);
    const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=300;f.connect(g);
    const o=c.createOscillator();o.type='square';o.frequency.value=30;
    const og=c.createGain();og.gain.value=0.4;o.connect(og);og.connect(f);
    o.start();
    this.engines.rover={g,f,o};
  },
  mkWind(){
    const c=this.ctx;
    const g=c.createGain();g.gain.value=0;g.connect(this.sfx);
    const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=300;f.Q.value=0.4;
    const n=this.noiseSrc();n.connect(f);f.connect(g);
    this.engines.wind={g,f};
  },
  noiseSrc(){
    const c=this.ctx;
    const len=c.sampleRate*2;
    if(!this._nbuf){
      this._nbuf=c.createBuffer(1,len,c.sampleRate);
      const d=this._nbuf.getChannelData(0);
      for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    }
    const src=c.createBufferSource();src.buffer=this._nbuf;src.loop=true;src.start();
    return src;
  },
  set(which,st){
    if(!this.started)return;
    const c=this.ctx,t=c.currentTime;
    /* WebAudio 对非有限值直接抛异常，且异常会中断主循环导致整帧不渲染（画面死住）。
       曾因 set('rover',{on:false}) 不带 rpm → NaN → 部署漫游车后每帧崩。入口一律兜底 */
    const rpm=Number.isFinite(st.rpm)?st.rpm:0;
    const amt=Number.isFinite(st.amt)?st.amt:0;
    if(which==='engine'){
      const e=this.engines.ship;
      const thr=rpm,on=st.on?1:0;
      e.g.gain.setTargetAtTime(on*(0.05+thr*0.16),t,0.09);
      e.o1.frequency.setTargetAtTime(38+thr*95+(st.od?70:0),t,0.12);
      e.o2.frequency.setTargetAtTime(76+thr*190+(st.od?140:0),t,0.12);
      e.f.frequency.setTargetAtTime(300+thr*1600+(st.boost?600:0),t,0.1);
    }else if(which==='rover'){
      const e=this.engines.rover;
      e.g.gain.setTargetAtTime(st.on?0.05+rpm*0.1:0,t,0.08);
      e.o.frequency.setTargetAtTime(26+rpm*130,t,0.08);
      e.f.frequency.setTargetAtTime(200+rpm*900,t,0.08);
    }else if(which==='wind'){
      const e=this.engines.wind;
      e.g.gain.setTargetAtTime(amt*0.14,t,0.2);
      e.f.frequency.setTargetAtTime(200+amt*700,t,0.2);
    }
  },

  /* --- 一次性音效 --- */
  blip(freq,dur,type,gain,slide){
    const c=this.ctx,t=c.currentTime;
    const o=c.createOscillator();o.type=type||'sine';o.frequency.value=freq;
    if(slide!==undefined)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);
    const g=c.createGain();g.gain.setValueAtTime(gain||0.2,t);
    g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    o.connect(g);g.connect(this.sfx);o.start(t);o.stop(t+dur+0.02);
  },
  noiseBurst(dur,fFrom,fTo,gain,type){
    const c=this.ctx,t=c.currentTime;
    const n=this.noiseSrc();
    const f=c.createBiquadFilter();f.type=type||'bandpass';f.Q.value=0.9;
    f.frequency.setValueAtTime(fFrom,t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30,fTo),t+dur);
    const g=c.createGain();g.gain.setValueAtTime(gain,t);
    g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    n.connect(f);f.connect(g);g.connect(this.sfx);
    setTimeout(()=>{try{n.stop()}catch(e){}},dur*1000+80);
  },
  metal(gain){
    const c=this.ctx,t=c.currentTime;
    [420,637,941,1350].forEach((fr,i)=>{
      const o=c.createOscillator();o.type='triangle';
      o.frequency.value=fr*(0.94+Math.random()*0.12);
      const g=c.createGain();g.gain.setValueAtTime((gain||0.12)/(i+1),t);
      g.gain.exponentialRampToValueAtTime(0.0006,t+0.4+i*0.06);
      o.connect(g);g.connect(this.sfx);o.start(t);o.stop(t+0.6);
    });
    this.noiseBurst(0.12,3000,500,0.14);
  },
  ev(name){
    if(!this.started)return;
    switch(name){
      case 'shot': this.noiseBurst(0.14,2600,300,0.3);this.blip(900,0.1,'square',0.12,220);break;
      case 'reload': this.blip(340,0.09,'square',0.09,180);this.noiseBurst(0.12,1800,500,0.08);break;
      case 'reloadDone': this.blip(520,0.06,'square',0.1,700);this.metal(0.05);break;
      case 'empty': this.blip(1200,0.04,'square',0.07,900);break;
      case 'laser': this.blip(1400,0.18,'sawtooth',0.1,300);this.noiseBurst(0.1,4000,900,0.08);break;
      case 'hit': this.blip(2200,0.06,'square',0.12,1400);break;
      case 'mined': this.blip(520,0.12,'sine',0.2,780);this.blip(780,0.2,'sine',0.16,1040);break;
      case 'step': this.noiseBurst(0.07,700+Math.random()*300,150,0.06,'lowpass');break;
      case 'jump': this.noiseBurst(0.12,500,180,0.08,'lowpass');break;
      case 'crash': this.metal(0.3);this.noiseBurst(0.4,900,80,0.4,'lowpass');break;
      case 'thud': this.metal(0.1);break;
      case 'land': this.noiseBurst(0.5,600,100,0.2,'lowpass');this.blip(220,0.3,'sine',0.1,110);break;
      case 'takeoff': this.noiseBurst(0.9,200,1400,0.25);break;
      case 'gear': this.blip(180,0.22,'square',0.07,90);this.metal(0.06);break;
      case 'warpCharge': this.blip(120,1.1,'sine',0.2,900);break;
      case 'warpGo': this.noiseBurst(1.2,300,4000,0.3);this.blip(200,1.4,'sawtooth',0.14,1600);break;
      case 'warpExit': this.noiseBurst(0.8,3000,200,0.3);this.blip(1200,0.6,'sine',0.16,180);break;
      case 'teleport': this.blip(600,0.4,'sine',0.2,2400);this.noiseBurst(0.4,1500,4000,0.15);break;
      case 'ui': this.blip(880,0.06,'sine',0.08);break;
      case 'radio': this.blip(660,0.08,'square',0.06,880);break;
      case 'growl': this.noiseBurst(0.5,90,45,0.3,'lowpass');this.blip(70,0.4,'sawtooth',0.2,40);break;
      case 'hurt': this.blip(220,0.15,'square',0.3,110);this.noiseBurst(0.12,800,300,0.2);break;
      case 'beastDie': this.blip(160,0.5,'sawtooth',0.28,30);this.noiseBurst(0.4,400,80,0.25);break;
    }
  },

  /* --- 程序化电台（3台可切） --- */
  cycleStation(){
    if(!this.started)return;
    this.station=(this.station+1)%4;
    this.stopRadio();
    if(this.station>0)this.startRadio(this.station);
    this.ev('radio');
    return this.stationNames[this.station];
  },
  stopRadio(){
    if(this.radioTimer){clearTimeout(this.radioTimer);this.radioTimer=null}
    if(this.radioNodes){for(const n of this.radioNodes){try{n.stop?n.stop():n.disconnect()}catch(e){}}this.radioNodes=null}
  },
  startRadio(st){
    const c=this.ctx;
    this.radioBeat=0;
    const bus=c.createGain();bus.gain.value=st===2?0.5:0.34;bus.connect(this.music);
    this.radioNodes=[bus];
    const scaleSets={
      1:[0,3,5,7,10],          // 小调五声 — 星港之声
      2:[0,2,7,9,11],          // 空灵 — 深空环境
      3:[0,2,4,7,9],           // 大调五声 — 合成浪潮
    };
    const roots={1:220,2:110,3:164.8};
    const bpms={1:96,2:40,3:118};
    const scale=scaleSets[st],root=roots[st],bpm=bpms[st];
    const beatLen=60/bpm;
    const rrng=mulberry32((Date.now()/60000|0)+st*77);
    const note=(fr,dur,type,vol,when,slideTo)=>{
      const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(fr,when);
      if(slideTo)o.frequency.exponentialRampToValueAtTime(slideTo,when+dur);
      const g=c.createGain();
      g.gain.setValueAtTime(0.0001,when);
      g.gain.exponentialRampToValueAtTime(vol,when+0.02);
      g.gain.exponentialRampToValueAtTime(0.0008,when+dur);
      o.connect(g);g.connect(bus);o.start(when);o.stop(when+dur+0.05);
    };
    const kick=(when)=>{
      const o=c.createOscillator();o.type='sine';
      o.frequency.setValueAtTime(120,when);o.frequency.exponentialRampToValueAtTime(38,when+0.12);
      const g=c.createGain();g.gain.setValueAtTime(0.5,when);g.gain.exponentialRampToValueAtTime(0.001,when+0.16);
      o.connect(g);g.connect(bus);o.start(when);o.stop(when+0.2);
    };
    const hat=(when,vol)=>{
      const n=this.noiseSrc();
      const f=c.createBiquadFilter();f.type='highpass';f.frequency.value=7000;
      const g=c.createGain();g.gain.setValueAtTime(vol,when);g.gain.exponentialRampToValueAtTime(0.0006,when+0.05);
      n.connect(f);f.connect(g);g.connect(bus);
      setTimeout(()=>{try{n.stop()}catch(e){}},(when-c.currentTime+0.2)*1000);
    };
    const deg=(d,oct)=>root*Math.pow(2,((scale[d%scale.length]+12*(oct||0))+12*Math.floor(d/scale.length))/12);
    const schedule=()=>{
      if(!this.radioNodes)return;
      const t0=c.currentTime+0.08;
      const bars=2,stepsPerBar=8;
      for(let b=0;b<bars*stepsPerBar;b++){
        const when=t0+b*beatLen/2;
        const beat=this.radioBeat+b;
        if(st===1){
          if(beat%4===0)kick(when);
          if(beat%4===2)hat(when,0.12);
          if(beat%2===0)note(deg((beat/2|0)%5,-1),beatLen*0.9,'triangle',0.16,when);
          if(rrng()<0.6)note(deg((rrng()*10)|0,1),beatLen*0.45,'square',0.045,when);
          if(beat%16===0)note(deg(0,0)*1.005,beatLen*7,'sawtooth',0.03,when);
        }else if(st===2){
          if(beat%8===0)note(deg((rrng()*5)|0,-1),beatLen*7.5,'sine',0.2,when,deg((rrng()*5)|0,-1));
          if(beat%8===4)note(deg((rrng()*5)|0,1),beatLen*6,'sine',0.07,when);
          if(rrng()<0.1)note(deg((rrng()*8)|0,2),beatLen*2,'triangle',0.03,when);
        }else{
          if(beat%2===0)kick(when);
          hat(when,beat%2?0.1:0.05);
          note(deg([0,0,3,4][((beat/8)|0)%4],-1),beatLen*0.42,'sawtooth',0.14,when);
          if(beat%2===1)note(deg((rrng()*10)|0,0),beatLen*0.4,'square',0.05,when);
          if(beat%32===0)note(deg(2,1),beatLen*14,'sawtooth',0.025,when);
        }
      }
      this.radioBeat+=bars*stepsPerBar;
      this.radioTimer=setTimeout(schedule,bars*stepsPerBar*beatLen/2*1000-160);
    };
    schedule();
  }
};