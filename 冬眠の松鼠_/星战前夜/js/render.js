"use strict";
const Render = {
  cv:null, cx:null, W:0, H:0,
  zoom: .01,
  stars: [],
  t: 0,

  init(cv){
    this.cv = cv; this.cx = cv.getContext("2d");
    this.resize();
    window.addEventListener("resize", ()=>this.resize());
    this.stars = [];
    for (let i=0;i<3;i++){
      const layer = [];
      for (let j=0;j<130;j++) layer.push([Math.random(), Math.random(), Math.random()*.9+.25]);
      this.stars.push(layer);
    }
  },
  resize(){
    this.W = this.cv.width = window.innerWidth;
    this.H = this.cv.height = window.innerHeight;
  },
  w2s(x,y){
    return [ (x - G.me.x)*this.zoom + this.W/2, (y - G.me.y)*this.zoom + this.H/2 ];
  },
  s2w(sx,sy){
    return [ (sx - this.W/2)/this.zoom + G.me.x, (sy - this.H/2)/this.zoom + G.me.y ];
  },

  pick(mx,my){
    if (!G.space) return null;
    let best = null, bd = 16;
    for (const e of G.space.ents){
      const [sx,sy] = this.w2s(e.x,e.y);
      if (sx < -30 || sy < -30 || sx > this.W+30 || sy > this.H+30) continue;
      let d = hypot(mx-sx, my-sy);
      if (e.kind === "planet" || e.kind === "sun") d -= Math.min(40, (e.r||0)*this.zoom);
      if (d < bd){ bd = d; best = e; }
    }
    return best;
  },

  draw(dt){
    const cx = this.cx, W = this.W, H = this.H;
    this.t += dt;
    cx.fillStyle = "#020409";
    cx.fillRect(0,0,W,H);
    if (!G.space || !G.me) return;
    const me = G.me;
    const warping = me.warp && me.warp.phase === "warp";

    for (let i=0;i<3;i++){
      const p = (i+1)*.000003;
      cx.fillStyle = ["#3a4a58","#5d7280","#9db4c4"][i];
      for (const s of this.stars[i]){
        let sx = (s[0]*W - me.x*p) % W; if (sx < 0) sx += W;
        let sy = (s[1]*H - me.y*p) % H; if (sy < 0) sy += H;
        if (warping){
          const dx = me.vx, dy = me.vy, l = hypot(dx,dy)||1;
          cx.globalAlpha = .5;
          cx.strokeStyle = cx.fillStyle;
          cx.beginPath(); cx.moveTo(sx,sy);
          cx.lineTo(sx - dx/l*(30+i*30), sy - dy/l*(30+i*30));
          cx.stroke();
          cx.globalAlpha = 1;
        } else {
          cx.fillRect(sx, sy, s[2], s[2]);
        }
      }
    }

    for (const e of G.space.ents){
      const [sx,sy] = this.w2s(e.x,e.y);
      if (e.kind === "sun"){
        const r = Math.max(26, e.r*this.zoom);
        if (sx>-r-W && sy>-r-H && sx<2*W+r && sy<2*H+r){
          const g = cx.createRadialGradient(sx,sy,0,sx,sy,r*3);
          g.addColorStop(0,"rgba(255,240,200,.9)");
          g.addColorStop(.25,"rgba(255,210,140,.35)");
          g.addColorStop(1,"rgba(255,190,90,0)");
          cx.fillStyle = g;
          cx.beginPath(); cx.arc(sx,sy,r*3,0,7); cx.fill();
          cx.fillStyle = "#fff3d8";
          cx.beginPath(); cx.arc(sx,sy,r,0,7); cx.fill();
        }
        continue;
      }
      if (e.kind === "planet"){
        const r = Math.max(3, e.r*this.zoom);
        if (sx>-r && sy>-r && sx<W+r && sy<H+r){
          cx.fillStyle = e.color;
          cx.beginPath(); cx.arc(sx,sy,Math.min(r, 600),0,7); cx.fill();
          cx.fillStyle = "rgba(0,0,0,.45)";
          cx.beginPath(); cx.arc(sx + Math.min(r,600)*.35, sy - Math.min(r,600)*.2, Math.min(r,600)*.95, 0, 7); cx.fill();
          this.label(sx, sy - Math.min(r,600) - 8, e.name, "#5d7280");
        }
        continue;
      }
      if (sx < -60 || sy < -60 || sx > W+60 || sy > H+60) continue;
      switch(e.kind){
        case "belt":
          cx.strokeStyle = "#6b8494";
          cx.beginPath(); cx.arc(sx,sy,4,0,7); cx.stroke();
          cx.beginPath(); cx.arc(sx,sy,1.2,0,7); cx.stroke();
          this.label(sx, sy-10, e.name, "#54707e");
          break;
        case "roid": {
          const r = clamp((e.r||600)*this.zoom, 1.5, 22);
          cx.fillStyle = "#7a726a";
          cx.save(); cx.translate(sx,sy); cx.rotate(e.id);
          cx.beginPath();
          cx.moveTo(-r,-r*.4); cx.lineTo(-r*.2,-r); cx.lineTo(r*.8,-r*.6); cx.lineTo(r,r*.3); cx.lineTo(.1*r,r); cx.lineTo(-r*.7,r*.6);
          cx.closePath(); cx.fill();
          cx.restore();
          break;
        }
        case "station":
          cx.strokeStyle = "#7fd0a0";
          cx.strokeRect(sx-5, sy-5, 10, 10);
          cx.beginPath(); cx.moveTo(sx-9,sy); cx.lineTo(sx-5,sy); cx.moveTo(sx+5,sy); cx.lineTo(sx+9,sy); cx.stroke();
          this.label(sx, sy-12, e.name, "#6ba184");
          break;
        case "gate":
          cx.strokeStyle = "#8fb8cc";
          cx.save(); cx.translate(sx,sy); cx.rotate(Math.PI/4);
          cx.strokeRect(-4.5,-4.5,9,9);
          cx.restore();
          cx.fillStyle = "#8fb8cc";
          cx.beginPath(); cx.arc(sx,sy,1.5,0,7); cx.fill();
          this.label(sx, sy-12, e.name, "#6d8fa1");
          break;
        case "npc": {
          cx.strokeStyle = e.aggro ? "#ff5f5f" : "#d96a6a";
          cx.beginPath();
          cx.moveTo(sx-5,sy); cx.lineTo(sx+5,sy);
          cx.moveTo(sx,sy-5); cx.lineTo(sx,sy+5);
          cx.stroke();
          if (e.aggro && Math.floor(this.t*2)%2===0){
            cx.strokeStyle = "rgba(255,95,95,.5)";
            cx.beginPath(); cx.arc(sx,sy,8,0,7); cx.stroke();
          }
          break;
        }
        case "wreck":
          cx.strokeStyle = e.loot && e.loot.length ? "#c9b46a" : "#6d7a83";
          cx.beginPath();
          cx.moveTo(sx-4,sy+4); cx.lineTo(sx,sy-5); cx.lineTo(sx+4,sy+4); cx.closePath();
          cx.stroke();
          break;
        case "beacon":
          cx.strokeStyle = "#e0b95e";
          cx.beginPath(); cx.arc(sx,sy,5,0,7); cx.stroke();
          cx.beginPath(); cx.arc(sx,sy,1.4,0,7); cx.stroke();
          this.label(sx, sy-12, e.name, "#b09248");
          break;
      }
      if (G.sel === e.id){
        cx.strokeStyle = "#e8f4fb";
        const s2 = 9;
        cx.beginPath();
        [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([qx,qy])=>{
          cx.moveTo(sx+qx*s2, sy+qy*s2-qy*4); cx.lineTo(sx+qx*s2, sy+qy*s2); cx.lineTo(sx+qx*s2-qx*4, sy+qy*s2);
        });
        cx.stroke();
        this.label(sx, sy+16, e.name + " — " + fmtDist(G.distTo(e)), "#c9d4da");
      }
      const lock = G.lockOf ? G.lockOf(e.id) : null;
      if (lock){
        cx.strokeStyle = lock.done ? (G.me.activeTarget===e.id ? "#ffd76a" : "#ff8f8f") : "rgba(255,255,255,.5)";
        cx.beginPath();
        if (lock.done) cx.arc(sx,sy,11,0,7);
        else cx.arc(sx,sy,11, this.t*4, this.t*4 + Math.PI*1.2);
        cx.stroke();
      }
    }

    for (const f of G.space.fx){
      if (f.kind === "beam"){
        let bx = f.bx, by = f.by;
        if (f.follow){ const t2 = G.entById(f.tid); if (t2){ bx=t2.x; by=t2.y; } }
        const [ax,ay] = this.w2s(f.ax,f.ay);
        const [x2,y2] = this.w2s(bx,by);
        cx.strokeStyle = f.color;
        cx.globalAlpha = clamp(f.t*4, 0, 1);
        cx.beginPath(); cx.moveTo(ax,ay); cx.lineTo(x2,y2); cx.stroke();
        cx.globalAlpha = 1;
      } else if (f.kind === "minebeam"){
        const t2 = G.entById(f.tid);
        if (t2){
          const [ax,ay] = this.w2s(G.me.x,G.me.y);
          const [x2,y2] = this.w2s(t2.x,t2.y);
          cx.strokeStyle = f.color;
          cx.globalAlpha = .35 + .3*Math.sin(this.t*8);
          cx.lineWidth = 2;
          cx.beginPath(); cx.moveTo(ax,ay); cx.lineTo(x2,y2); cx.stroke();
          cx.lineWidth = 1; cx.globalAlpha = 1;
        }
      } else if (f.kind === "boom"){
        const [sx,sy] = this.w2s(f.x,f.y);
        const prog = 1 - f.t/(f.t0 || (f.t0=f.t));
        const r = Math.max(4, f.r*this.zoom) * (0.3 + prog);
        cx.strokeStyle = "rgba(255,180,90," + (1-prog) + ")";
        cx.beginPath(); cx.arc(sx,sy,r,0,7); cx.stroke();
        cx.fillStyle = "rgba(255,120,50," + (1-prog)*.5 + ")";
        cx.beginPath(); cx.arc(sx,sy,r*.6,0,7); cx.fill();
      } else if (f.kind === "missile"){
        const [sx,sy] = this.w2s(f.x,f.y);
        cx.fillStyle = "#ffd6a0";
        cx.beginPath(); cx.arc(sx,sy,2,0,7); cx.fill();
      }
    }

    this.drawShip();
    if (warping) this.drawWarpOverlay();
  },

  drawShip(){
    const cx = this.cx, me = G.me;
    const [sx,sy] = this.w2s(me.x,me.y);
    const a = Math.atan2(me.dir[1], me.dir[0]);
    const pod = G.state.ship.typeId === "capsule";
    cx.save();
    cx.translate(sx,sy); cx.rotate(a);
    const v = hypot(me.vx,me.vy);
    if (v > 20 && !pod){
      cx.strokeStyle = "rgba(140,190,255,.55)";
      cx.beginPath(); cx.moveTo(-9,0); cx.lineTo(-9 - clamp(v/G.getMaxSpeed(),0,1)*16 - Math.random()*4, 0); cx.stroke();
    }
    if (pod){
      cx.fillStyle = "#b8ccd8";
      cx.beginPath(); cx.ellipse(0,0,5,3.4,0,0,7); cx.fill();
    } else {
      cx.fillStyle = "#dfeaf2";
      cx.strokeStyle = "#8fb8cc";
      cx.beginPath();
      cx.moveTo(10,0); cx.lineTo(-7,-6); cx.lineTo(-4,0); cx.lineTo(-7,6);
      cx.closePath(); cx.fill(); cx.stroke();
    }
    cx.restore();
  },

  drawWarpOverlay(){
    const cx = this.cx, me = G.me, W=this.W, H=this.H;
    const a = Math.atan2(me.vy, me.vx);
    cx.save();
    cx.translate(W/2,H/2); cx.rotate(a);
    cx.strokeStyle = "rgba(120,190,255,.25)";
    for (let i=0;i<26;i++){
      const yy = (Math.sin(i*3.7 + 1) * .5 + ((i*97 + Math.floor(this.t*90)*31) % 100)/100 - .5) * H * 1.2;
      const xx = ((i*173 + this.t*2600) % (W*1.6)) - W*.8;
      cx.globalAlpha = .1 + (i%5)*.06;
      cx.beginPath(); cx.moveTo(-xx, yy); cx.lineTo(-xx - 80 - (i%7)*40, yy); cx.stroke();
    }
    cx.restore();
    cx.globalAlpha = 1;
    cx.fillStyle = "rgba(150,200,255,.9)";
    cx.font = "13px Segoe UI";
    cx.textAlign = "center";
    const spd = hypot(me.vx,me.vy)/DATA.AU;
    cx.fillText(`跃迁中 — ${me.warp.label}（${spd.toFixed(1)} AU/s）`, W/2, H/2 - 60);
  },

  label(sx, sy, text, color){
    const cx = this.cx;
    cx.font = "10px Segoe UI";
    cx.textAlign = "center";
    cx.fillStyle = color;
    cx.fillText(text, sx, sy);
  },
};

window.Render = Render;
