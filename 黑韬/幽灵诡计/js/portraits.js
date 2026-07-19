'use strict';
/* ============================================================
   portraits.js — 程序化像素头像 (24x24 网格 → 48x48)
   带自动描边的小型像素画引擎
   ============================================================ */
var Portraits = (function(){
  var SZ = 24, SC = 2;
  var cache = {};

  function Surf(){
    this.g = new Array(SZ*SZ);
    for(var i=0;i<SZ*SZ;i++) this.g[i]=null;
  }
  Surf.prototype = {
    set: function(x,y,c){
      x|=0; y|=0;
      if(x<0||y<0||x>=SZ||y>=SZ) return;
      this.g[y*SZ+x]=c;
    },
    get: function(x,y){
      if(x<0||y<0||x>=SZ||y>=SZ) return null;
      return this.g[y*SZ+x];
    },
    rect: function(x,y,w,h,c){
      for(var j=0;j<h;j++) for(var i=0;i<w;i++) this.set(x+i,y+j,c);
    },
    hline: function(x,y,w,c){ this.rect(x,y,w,1,c); },
    vline: function(x,y,h,c){ this.rect(x,y,1,h,c); },
    ellipse: function(cx,cy,rx,ry,c){
      for(var y=Math.floor(cy-ry);y<=cy+ry;y++)
        for(var x=Math.floor(cx-rx);x<=cx+rx;x++){
          var dx=(x-cx)/rx, dy=(y-cy)/ry;
          if(dx*dx+dy*dy<=1.02) this.set(x,y,c);
        }
    },
    ring: function(cx,cy,rx,ry,c){
      for(var y=Math.floor(cy-ry)-1;y<=cy+ry+1;y++)
        for(var x=Math.floor(cx-rx)-1;x<=cx+rx+1;x++){
          var dx=(x-cx)/rx, dy=(y-cy)/ry;
          var d=dx*dx+dy*dy;
          if(d<=1.05 && d>=0.55) this.set(x,y,c);
        }
    },
    outline: function(c){
      var copy=this.g.slice();
      for(var y=0;y<SZ;y++) for(var x=0;x<SZ;x++){
        if(copy[y*SZ+x]) continue;
        var n = (x>0&&copy[y*SZ+x-1]) || (x<SZ-1&&copy[y*SZ+x+1]) ||
                (y>0&&copy[(y-1)*SZ+x]) || (y<SZ-1&&copy[(y+1)*SZ+x]);
        if(n) this.g[y*SZ+x]=c;
      }
    },
    render: function(bg){
      var c = makeCanvas(SZ*SC, SZ*SC);
      var ctx = c.getContext('2d');
      if(bg){ ctx.fillStyle=bg; ctx.fillRect(0,0,SZ*SC,SZ*SC); }
      for(var y=0;y<SZ;y++) for(var x=0;x<SZ;x++){
        var col=this.g[y*SZ+x];
        if(!col) continue;
        ctx.fillStyle=col;
        ctx.fillRect(x*SC,y*SC,SC,SC);
      }
      return c;
    }
  };

  /* ---------- 具体头像 ---------- */

  function drawHero(){
    var s=new Surf();
    // 幽灵蓝焰 — 侦探之魂
    var W='#eaf6ff', C='#8fd8ff', B='#3f7fd0', D='#1d3a72';
    // 焰体
    s.ellipse(12,14,7,8,B);
    s.ellipse(12,15,5.6,6.5,C);
    // 焰尖(偏右飘)
    s.set(12,3,B); s.set(13,4,B); s.set(13,5,B); s.rect(12,5,2,2,B);
    s.rect(11,6,4,2,B); s.set(14,6,C);
    s.rect(11,8,5,2,C);
    // 侧焰
    s.set(5,12,B); s.set(4,11,B); s.set(19,13,B); s.set(20,12,B);
    // 内核
    s.ellipse(12,16,3.4,4.2,W);
    // 眼睛
    s.rect(9,13,2,3,D); s.rect(14,13,2,3,D);
    s.set(9,13,'#ffffff'); s.set(14,13,'#ffffff');
    // 领带残影(侦探的执念)
    s.rect(11,19,3,1,'#c33b4e'); s.set(12,20,'#c33b4e'); s.set(12,21,'#8f2537');
    s.outline('#0c1530');
    return s.render(null);
  }

  function faceBase(s, skin, skinShadow){
    // 通用脸型 (下巴 y~19)
    s.ellipse(12,12,7,7.6,skin);
    s.rect(5,10,15,6,skin);
    s.rect(7,17,11,3,skin);
    // 脖子与阴影
    s.rect(10,19,5,3,skin);
    s.hline(7,17,11,skinShadow);
  }

  function drawWei(){
    var s=new Surf();
    var SK='#f2c6a0', SS='#d9a37e', H='#2c2f3e', CAP='#2e4d54', CAPD='#1d353b', GOLD='#e8c15a';
    faceBase(s,SK,SS);
    // 短发
    s.rect(4,7,17,3,H);
    s.rect(4,9,3,7,H); s.rect(18,9,3,6,H);
    s.rect(5,6,15,2,H);
    // 制服帽
    s.rect(4,3,17,4,CAP);
    s.rect(3,6,19,2,CAPD);
    s.hline(3,7,19,CAPD);
    s.rect(10,5,5,2,CAPD);
    s.set(12,5,GOLD); s.set(12,6,GOLD); // 帽徽
    // 眼睛 (認真)
    s.rect(8,12,2,2,'#22242e'); s.rect(15,12,2,2,'#22242e');
    s.set(8,12,'#ffffff'); s.set(15,12,'#ffffff');
    s.hline(7,10,3,H); s.hline(14,10,3,H); // 眉
    // 鼻 嘴
    s.set(12,14,SS);
    s.hline(11,16,3,'#b06a56');
    // 衣领
    s.rect(6,20,13,4,CAP);
    s.rect(11,20,3,4,CAPD);
    s.set(7,21,GOLD);
    s.outline('#101018');
    return s.render(null);
  }

  function drawBeacon(){
    var s=new Surf();
    // 老航标灯 — 黄铜灯笼
    var BR='#c9973f', BD='#8a6226', GL='#ffe9a8', GC='#ffb347', DK='#4a3416';
    // 顶盖
    s.rect(8,2,9,2,BR); s.rect(10,1,5,1,BD);
    s.rect(6,4,13,2,BD);
    // 灯身玻璃
    s.rect(7,6,11,11,GL);
    s.rect(7,6,1,11,BD); s.rect(17,6,1,11,BD);
    // 玻璃高光
    s.vline(9,7,9,'#fff6d8');
    // 内焰之眼
    s.ellipse(12,11,3,3.6,GC);
    s.ellipse(12,12,1.6,2,'#ff7733');
    s.rect(11,10,1,2,DK); s.rect(14,10,1,2,DK); // 眼
    // 底座
    s.rect(6,17,13,2,BR);
    s.rect(8,19,9,2,BD);
    s.rect(10,21,5,2,DK);
    // 铆钉
    s.set(7,4,'#ffdf91'); s.set(17,4,'#ffdf91');
    s.set(7,17,'#ffdf91'); s.set(17,17,'#ffdf91');
    s.outline('#241708');
    return s.render(null);
  }

  function drawKiller(){
    var s=new Surf();
    var HAT='#23222b', HATD='#16151c', FACE='#8f93a8', SHADOW='#3a3c4c', EYE='#d8e5ff';
    // 宽檐帽
    s.rect(3,6,19,2,HAT);
    s.rect(6,2,13,4,HAT);
    s.hline(6,5,13,HATD);
    // 帽下阴影脸
    s.rect(7,8,11,7,SHADOW);
    s.rect(8,13,9,5,FACE);
    s.hline(8,13,9,SHADOW);
    // 苍白的眼
    s.rect(9,10,2,2,EYE); s.rect(14,10,2,2,EYE);
    s.set(10,11,'#5a708f'); s.set(15,11,'#5a708f');
    // 无表情的嘴
    s.hline(11,16,3,'#585d70');
    // 大衣高领
    s.rect(4,19,17,5,HAT);
    s.rect(6,18,4,2,HATD); s.rect(15,18,4,2,HATD);
    s.rect(11,19,3,5,HATD);
    s.outline('#0a0a12');
    return s.render(null);
  }

  function drawSailor(){
    var s=new Surf();
    var SK='#d9a078', SS='#b97f58', BE='#b9bcc4', CAP='#a8392e', CAPD='#7c241c';
    faceBase(s,SK,SS);
    // 红色毛线帽
    s.rect(4,3,17,5,CAP);
    s.hline(4,7,17,CAPD);
    s.hline(4,3,17,CAPD);
    // 灰白大胡子
    s.rect(6,15,13,6,BE);
    s.rect(8,20,9,2,BE);
    s.rect(10,15,5,2,SK); // 嘴周留出
    s.hline(10,17,5,'#8d909a');
    // 红鼻头 (酒)
    s.ellipse(12,13,1.6,1.4,'#cf6a52');
    // 醉眼
    s.rect(8,11,2,1,'#2a2a33'); s.rect(15,11,2,1,'#2a2a33');
    s.hline(7,9,3,'#8d909a'); s.hline(14,9,3,'#8d909a');
    // 毛衣
    s.rect(5,21,15,3,'#3d4b63');
    s.outline('#14100e');
    return s.render(null);
  }

  function drawBartender(){
    var s=new Surf();
    var SK='#e3b48c', SS='#c08f66', H='#4c3a2c', V='#2d2a3a';
    faceBase(s,SK,SS);
    // 后梳油头
    s.rect(4,4,17,4,H);
    s.rect(4,7,2,5,H); s.rect(19,7,2,5,H);
    s.hline(5,4,15,'#6a543f');
    // 疲惫的眼
    s.rect(8,12,2,1,'#2a2420'); s.rect(15,12,2,1,'#2a2420');
    s.hline(8,13,2,SS); s.hline(15,13,2,SS);
    // 八字胡
    s.hline(9,15,3,H); s.hline(13,15,3,H);
    s.hline(11,17,3,'#a06a4e');
    // 马甲和领结
    s.rect(5,20,15,4,V);
    s.rect(10,20,5,2,'#e8e3d8');
    s.rect(11,20,3,1,'#7c2430');
    s.outline('#120e0c');
    return s.render(null);
  }

  function drawSelf(){
    var s=new Surf();
    // 生前的你 — 疲惫的中年侦探
    var SK='#dcab84', SS='#b9855f', H='#5c5147', ST='#8a7a68';
    faceBase(s,SK,SS);
    // 乱发
    s.rect(4,4,17,4,H);
    s.rect(4,7,3,4,H); s.rect(18,7,3,4,H);
    s.set(6,3,H); s.set(10,3,H); s.set(15,3,H); s.set(19,4,H);
    // 眼袋深重的眼
    s.rect(8,12,2,2,'#33302c'); s.rect(15,12,2,2,'#33302c');
    s.hline(8,14,2,SS); s.hline(15,14,2,SS);
    s.hline(7,10,3,H); s.hline(14,10,3,H);
    // 胡茬
    for(var i=0;i<14;i++) s.set(7+(i*3)%12, 17+(i%3), ST);
    s.hline(10,16,4,'#96604a');
    // 松开的领带
    s.rect(6,20,13,4,'#3a4356');
    s.rect(11,20,3,2,'#c33b4e'); s.set(12,22,'#8f2537');
    s.outline('#15100c');
    return s.render(null);
  }

  /* ---------- 技能图标 ---------- */
  function drawLogic(){
    var s=new Surf();
    var C='#5fd3e8', D='#2a7f97', W='#eafcff';
    // 晶体 / 齿轮之眼
    s.ellipse(12,12,8,8,D);
    s.ellipse(12,12,6,6,C);
    // 齿
    s.rect(11,2,3,3,D); s.rect(11,19,3,3,D);
    s.rect(2,11,3,3,D); s.rect(19,11,3,3,D);
    s.rect(4,4,2,2,D); s.rect(18,4,2,2,D);
    s.rect(4,18,2,2,D); s.rect(18,18,2,2,D);
    // 眼
    s.ellipse(12,12,3,3,W);
    s.rect(11,11,2,2,'#0e2f3a');
    s.outline('#082028');
    return s.render(null);
  }
  function drawEmpathy(){
    var s=new Surf();
    var P='#f08bb1', D='#b04a76', W='#ffe3ef';
    // 有裂缝的心
    s.ellipse(8,9,4.4,4.4,P);
    s.ellipse(16,9,4.4,4.4,P);
    s.rect(4,9,17,4,P);
    for(var i=0;i<7;i++) s.hline(5+i, 13+i, 15-i*2, P);
    // 高光
    s.ellipse(8,8,1.6,1.6,W);
    // 裂缝
    s.set(12,7,D); s.set(12,8,D); s.set(11,9,D); s.set(12,10,D);
    s.set(11,11,D); s.set(12,12,D); s.set(12,13,D);
    s.outline('#4a1830');
    return s.render(null);
  }
  function drawBody(){
    var s=new Surf();
    var O='#f0925f', D='#b05a2e', W='#ffd9b8';
    // 握拳 + 一支烟
    s.rect(6,8,12,10,O);
    s.rect(5,10,2,6,O);
    for(var i=0;i<4;i++) s.vline(8+i*3, 8, 3, D);
    s.hline(6,13,12,D);
    s.rect(16,10,4,2,W); // 烟
    s.set(20,10,'#ff5533'); s.set(20,9,'#aab');
    s.set(21,8,'#889'); s.set(20,7,'#778');
    s.outline('#48200c');
    return s.render(null);
  }
  function drawDread(){
    var s=new Surf();
    var V='#b48bf0', D='#5c3a94', K='#1c0f38';
    // 深渊之眼 — 波纹中的竖瞳
    s.ellipse(12,12,9,6,D);
    s.ellipse(12,12,7,4.4,V);
    s.ellipse(12,12,4,3,'#e8dcff');
    s.rect(11,9,2,7,K);
    // 涟漪
    s.hline(2,19,5,D); s.hline(17,19,5,D);
    s.hline(4,21,4,V); s.hline(16,21,4,V);
    s.hline(3,4,4,D); s.hline(18,4,4,D);
    s.outline('#12082a');
    return s.render(null);
  }
  function drawWonder(){
    var s=new Surf();
    // 静波 — 苍白的驻波
    var W='#dff5ee', C='#8fd8c8', D='#3f8f80';
    for(var x=0;x<24;x++){
      var h = Math.round(6+10*Math.exp(-Math.pow((x-12)/5,2)));
      for(var y=23-h;y<24;y++){
        var c = y<23-h+2 ? W : (y<23-h+5 ? C : D);
        s.set(x,y,c);
      }
    }
    s.set(12,4,W); s.set(12,3,W); s.set(11,5,W); s.set(13,5,W);
    s.outline('#0e3a34');
    return s.render(null);
  }

  function drawCat(){
    var s=new Surf();
    var F='#3a3a44', D='#26262e', W='#e8e8f0', Y='#ffd24a';
    // 码头黑猫
    s.ellipse(12,14,7,6,F);
    s.rect(6,4,3,4,F); s.rect(16,4,3,4,F); // 耳
    s.set(7,5,'#a06a7a'); s.set(17,5,'#a06a7a');
    s.rect(6,7,13,8,F);
    // 眼
    s.rect(8,10,3,2,Y); s.rect(14,10,3,2,Y);
    s.set(9,10,D); s.set(15,10,D);
    // 鼻嘴
    s.set(12,13,'#a06a7a');
    s.hline(11,14,3,D);
    // 白胸
    s.rect(10,17,5,4,W);
    // 尾巴
    s.set(20,16,F); s.set(21,15,F); s.set(21,14,F); s.set(20,13,F);
    s.outline('#0c0c12');
    return s.render(null);
  }

  /* ---------- 注册表 ---------- */
  var makers = {
    hero: drawHero, wei: drawWei, beacon: drawBeacon, killer: drawKiller,
    sailor: drawSailor, bartender: drawBartender, self: drawSelf,
    cat: drawCat
  };

  function get(id){
    if(!cache[id] && makers[id]) cache[id]=makers[id]();
    return cache[id]||null;
  }

  return { get:get };
})();
