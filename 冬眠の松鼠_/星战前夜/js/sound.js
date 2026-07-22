"use strict";
const Sound = {
  enabled: true,
  ctx: null,
  ensure(){
    if (!this.ctx){
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ this.enabled = false; }
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  env(gainVal, dur, type){
    const c = this.ctx, g = c.createGain();
    g.gain.setValueAtTime(gainVal, c.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + dur);
    g.connect(c.destination);
    return g;
  },
  osc(type, f0, f1, dur, vol){
    const c = this.ensure(); if (!c || !this.enabled) return;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(1,f1), c.currentTime + dur);
    o.connect(this.env(vol, dur));
    o.start(); o.stop(c.currentTime + dur);
  },
  noise(dur, vol, freq, q){
    const c = this.ensure(); if (!c || !this.enabled) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = freq || 1200; f.Q.value = q || .8;
    src.connect(f); f.connect(this.env(vol, dur));
    src.start();
  },
  play(name){
    if (!this.enabled) return;
    try {
      switch(name){
        case "laser":  this.osc("sawtooth", 900, 180, .18, .06); break;
        case "hybrid": this.osc("square", 240, 70, .14, .07); this.noise(.08,.04,3000); break;
        case "proj":   this.noise(.09, .09, 2500, 1.2); break;
        case "missile":this.noise(.5, .05, 900); this.osc("sine", 300, 90, .5, .03); break;
        case "miner":  this.osc("sine", 220, 260, .4, .03); break;
        case "lockon": this.osc("sine", 1150, 1150, .07, .05); setTimeout(()=>this.osc("sine",1500,1500,.09,.05), 90); break;
        case "locking":this.osc("sine", 850, 850, .05, .03); break;
        case "boom":   this.noise(.7, .22, 500, .5); this.osc("sine", 120, 30, .7, .12); break;
        case "boomBig":this.noise(1.2, .3, 350, .5); this.osc("sine", 90, 20, 1.2, .16); break;
        case "warp":   this.noise(1.4, .08, 400); this.osc("sine", 80, 700, 1.3, .05); break;
        case "warpOut":this.osc("sine", 600, 60, .8, .05); break;
        case "jump":   this.osc("sine", 200, 900, .9, .06); this.noise(.9, .06, 800); break;
        case "dock":   this.noise(.35, .12, 300); this.osc("sine", 100, 60, .4, .08); break;
        case "click":  this.osc("square", 2400, 2000, .02, .025); break;
        case "isk":    this.osc("sine", 1300, 1600, .08, .05); setTimeout(()=>this.osc("sine",1700,2000,.1,.05), 80); break;
        case "levelup":[660,880,1100].forEach((f,i)=>setTimeout(()=>this.osc("sine",f,f,.18,.06), i*140)); break;
        case "alert":  this.osc("square", 500, 400, .16, .05); setTimeout(()=>this.osc("square",500,400,.16,.05), 200); break;
        case "shield": this.osc("sine", 500, 800, .2, .03); break;
        case "repair": this.osc("sine", 350, 550, .25, .03); break;
      }
    } catch(e){}
  }
};

window.Sound = Sound;
