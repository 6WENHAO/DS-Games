'use strict';
/* ============================================================
   sets.js — 小剧场舞台
   永久剧场外壳(台口镜框/侧幕/脚灯/包厢) + 三套换景
   每套布景 = 手绘天幕(画片) + 少量立体景片 — 剧场式而非实景式
   ============================================================ */
var Sets = (function(){
  var T = Theater;
  var roots = {};
  var fx = {};
  var cur = null;

  /* ---------- 手绘天幕工具 ---------- */
  function canvasTexture(w, h, painter){
    var c = makeCanvas(w, h);
    var x = c.getContext('2d');
    painter(x, w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }
  function backdropMesh(painter){
    var tex = canvasTexture(320, 128, painter);
    var m = new THREE.MeshBasicMaterial({map:tex});
    var p = new THREE.Mesh(new THREE.PlaneGeometry(156, 62), m);
    p.position.set(0, 31, -34);
    return p;
  }
  /* 帮手: 色带天空 */
  function skyBands(x, w, h, bands, horizon){
    var y0 = 0;
    for(var i=0;i<bands.length;i++){
      var y1 = Math.round(h*horizon*(i+1)/bands.length);
      x.fillStyle = bands[i];
      x.fillRect(0, y0, w, y1-y0);
      y0 = y1;
    }
  }
  /* 帮手: 噪点肌理 */
  function speckle(x, w, h, color, n, alpha){
    x.globalAlpha = alpha||0.18;
    x.fillStyle = color;
    for(var i=0;i<n;i++)
      x.fillRect((Math.random()*w)|0, (Math.random()*h)|0, 1, 1);
    x.globalAlpha = 1;
  }

  /* ============================================================
     剧场外壳 (常驻)
     台面: x -100..100, z -40..18, y=0
     台口: x ±79, 净高 50
     ============================================================ */
  function buildTheatre(){
    var root = new THREE.Group(); roots.theatre = root; T.scene().add(root);
    fx.theatre = {};

    /* ---- 舞台地板 (木板条) ---- */
    for(var i=0;i<25;i++){
      var plank = T.box(8.2, 1.2, 58, i%4===0 ? '#6a4c2e' : (i%2?'#755636':'#7e5c3a'));
      plank.position.set(-98.4+i*8.2, -0.6, -11);
      root.add(plank);
    }
    /* 台缘金线 */
    var edgeTrim = T.box(200, 0.5, 1.2, '#a8823e');
    edgeTrim.position.set(0, 0.1, 17.5); root.add(edgeTrim);

    /* ---- 台裙(舞台正面立板) + 乐池 ---- */
    var skirt = T.box(204, 15, 2.4, '#3a1c26');
    skirt.position.set(0, -7.5, 17.6); root.add(skirt);
    var skirtTrim = T.box(204, 1.4, 2.6, '#8a6a34');
    skirtTrim.position.set(0, -1.2, 17.7); root.add(skirtTrim);
    /* 台裙嵌板装饰 */
    for(var sp=0;sp<7;sp++){
      var panel = T.box(20, 9, 0.5, '#48242e');
      panel.position.set(-84+sp*28, -8, 18.9);
      root.add(panel);
    }
    /* 乐池暗面 */
    var pit = T.plane(300, 60, '#070509');
    pit.rotation.x = -Math.PI/2;
    pit.position.set(0, -15.8, 48); root.add(pit);

    /* ---- 脚灯排 (贝壳罩 + 暖光苗) ---- */
    fx.theatre.footGlows = [];
    for(var f=0;f<9;f++){
      var fxx = -64+f*16;
      var shell = new THREE.Mesh(
        new THREE.SphereGeometry(2.1, 8, 4, 0, Math.PI),
        T.mat('#2e2018'));
      shell.rotation.x = -Math.PI/2.2;
      shell.position.set(fxx, 0.9, 15.8);
      root.add(shell);
      var glow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 8),
        T.flat('#ffd9a0', {transparent:true, opacity:0.85}));
      glow.position.set(fxx, 1.5, 15.4);
      root.add(glow);
      fx.theatre.footGlows.push(glow);
    }

    /* ---- 主幕布 (3D 天鹅绒, 台口内侧, 可拉开) ---- */
    function curtainPanel(side){
      var g = new THREE.Group();
      for(var i=0;i<20;i++){
        var px = side<0 ? -82+i*4.15+2 : 2+i*4.15;
        var pleat = T.box(4.4, 56, 2.4, i%2 ? '#5c1628' : '#48101e');
        pleat.position.set(px, 28, (i%2)*0.5);
        pleat.userData = {bz:(i%2)*0.5, ph:i*0.8};
        g.add(pleat);
        var hi = T.box(1.7, 56, 2.6, i%2 ? '#722230' : '#6a1c2c');
        hi.position.set(px-1, 28, (i%2)*0.5+0.15);
        hi.userData = {bz:(i%2)*0.5+0.15, ph:i*0.8+0.4};
        g.add(hi);
      }
      /* 金穗底边 */
      var fringe = T.box(83, 1.6, 2.9, '#8a6a34');
      fringe.position.set(side<0 ? -40.5 : 42.5, 0.9, 0.6);
      g.add(fringe);
      g.position.set(0, 0, 5);
      return g;
    }
    var curtL = curtainPanel(-1), curtR = curtainPanel(1);
    root.add(curtL); root.add(curtR);
    fx.theatre.curtL = curtL; fx.theatre.curtR = curtR;
    fx.theatre.curtainV = 0;

    /* ---- 台口镜框 ---- */
    function column(cx){
      var g = new THREE.Group();
      var base = T.box(12, 5, 8, '#5c4020'); base.position.y = 2.5; g.add(base);
      var shaft = T.box(9, 46, 6, '#8a6a34'); shaft.position.y = 28; g.add(shaft);
      /* 凹槽线 */
      for(var l2=0;l2<2;l2++){
        var flute = T.box(1.2, 44, 6.4, '#6e5228');
        flute.position.set(-2.4+l2*4.8, 28, 0.1); g.add(flute);
      }
      var cap = T.box(12, 4, 8, '#a8823e'); cap.position.y = 53; g.add(cap);
      g.position.set(cx, 0, 13);
      return g;
    }
    root.add(column(-79));
    root.add(column(79));
    /* 门楣横梁 */
    var header = T.box(174, 10, 6, '#7a5a2c');
    header.position.set(0, 60, 13); root.add(header);
    var headerTrim = T.box(174, 2, 6.6, '#a8823e');
    headerTrim.position.set(0, 55.6, 13); root.add(headerTrim);
    /* 中央金徽 (竖琴形简化) */
    var crest = new THREE.Group();
    var crestBase = T.cyl(4.6, 4.6, 1.2, 12, '#a8823e');
    crestBase.rotation.x = Math.PI/2; crest.add(crestBase);
    var crestIn = T.cyl(3.4, 3.4, 1.4, 12, '#c8a050');
    crestIn.rotation.x = Math.PI/2; crest.add(crestIn);
    var lyre = T.box(1, 4.4, 1.6, '#6e5228'); crest.add(lyre);
    var lyre2 = T.box(3.6, 1, 1.6, '#6e5228'); lyre2.position.y=1; crest.add(lyre2);
    crest.position.set(0, 60, 16.4);
    root.add(crest);

    /* ---- 侧幕 (褶皱红绒 左右各一) ---- */
    function legs(cx){
      var g = new THREE.Group();
      for(var p2=0;p2<5;p2++){
        var pleat = T.box(2.6, 50, 3, p2%2 ? '#5c1628' : '#48101e');
        pleat.position.set(p2*2.5-5, 25, (p2%2)*0.8);
        g.add(pleat);
      }
      g.position.set(cx, 0, 4);
      return g;
    }
    root.add(legs(-71));
    root.add(legs(71));
    /* 顶檐幕 (横向褶皱, 上沿与门楣衔接) */
    var border = new THREE.Group();
    for(var b2=0;b2<26;b2++){
      var bh2 = 12+(b2%2)*2.6;
      var bp = T.box(5.6, bh2, 3, b2%2 ? '#5c1628' : '#48101e');
      bp.position.set(-70+b2*5.6, 58-bh2/2, 6);
      border.add(bp);
    }
    root.add(border);

    /* ---- 台口外的剧院暗墙 + 包厢 ---- */
    var wallL = T.plane(70, 160, '#160d14');
    wallL.position.set(-120, 40, 12.5); root.add(wallL);
    var wallR = wallL.clone(); wallR.position.x = 120; root.add(wallR);
    var wallTop = T.plane(300, 80, '#120b10');
    wallTop.position.set(0, 105, 12.5); root.add(wallTop);
    /* 包厢 (左右各一, 观众席的一角) */
    function boxSeat(cx){
      var g = new THREE.Group();
      var floor2 = T.box(22, 3, 14, '#2c1620'); floor2.position.y = -1; g.add(floor2);
      var front = new THREE.Mesh(
        new THREE.CylinderGeometry(9, 9, 7, 12, 1, true, -Math.PI/2, Math.PI),
        T.mat('#4a2432'));
      front.position.set(0, 3, 7); g.add(front);
      var rail = new THREE.Mesh(
        new THREE.TorusGeometry(9, 0.7, 5, 12, Math.PI),
        T.mat('#8a6a34'));
      rail.rotation.x = Math.PI/2;
      rail.position.set(0, 6.6, 7); g.add(rail);
      var backWall = T.box(22, 18, 2, '#1e1018'); backWall.position.set(0, 8, -6); g.add(backWall);
      g.position.set(cx, 16, 24);
      return g;
    }
    root.add(boxSeat(-88));
    root.add(boxSeat(88));

    /* ---- 后墙黑幕 (天幕后的兜底, 永不露黑洞) ---- */
    var backVoid = T.plane(240, 100, '#0c0810');
    backVoid.position.set(0, 40, -38); root.add(backVoid);
  }

  /* ============================================================
     天幕画片 ×3
     ============================================================ */
  function paintPlaza(x, w, h){
    /* 塞维利亚晴空 (色带) */
    skyBands(x, w, h, ['#8ec4ee','#a2ceee','#bcdaec','#e8ddb8'], 0.72);
    /* 太阳 */
    x.fillStyle='#fff4d0';
    x.beginPath(); x.arc(w*0.16, h*0.18, 11, 0, Math.PI*2); x.fill();
    x.fillStyle='rgba(255,240,190,0.4)';
    x.beginPath(); x.arc(w*0.16, h*0.18, 16, 0, Math.PI*2); x.fill();
    /* 远山淡影 */
    x.fillStyle='#c9d4d8';
    x.fillRect(0, h*0.66, w, h*0.06);
    /* 白墙街屋一排 */
    var hx = 0;
    var cols = ['#f2e8d4','#e8dcc4','#f6f0e0','#e2d4bc'];
    var rcols = ['#b05038','#a04830','#c05a40'];
    var bi = 0;
    while(hx < w){
      var bw = 18+((bi*29)%14);
      var bh = 14+((bi*17)%12);
      x.fillStyle = cols[bi%4];
      x.fillRect(hx, h*0.72-bh, bw, bh);
      x.fillStyle = rcols[bi%3];
      x.fillRect(hx-1, h*0.72-bh-3, bw+2, 4);
      /* 小窗 */
      x.fillStyle = '#5a4838';
      for(var wn=0;wn<Math.floor(bw/8);wn++)
        x.fillRect(hx+3+wn*8, h*0.72-bh+4, 3, 4);
      hx += bw+2;
      bi++;
    }
    /* 希拉尔达钟楼 (右) */
    x.fillStyle='#e2c898';
    x.fillRect(w*0.8, h*0.3, 16, h*0.42);
    x.fillStyle='#c8a870';
    x.fillRect(w*0.8-2, h*0.28, 20, 5);
    x.fillStyle='#d4b482';
    x.fillRect(w*0.8+2, h*0.2, 12, h*0.1);
    x.fillStyle='#6a4c2c';
    x.fillRect(w*0.8+5, h*0.22, 6, 7);
    x.fillStyle='#a88848';
    x.beginPath();
    x.moveTo(w*0.8+1, h*0.2); x.lineTo(w*0.8+8, h*0.13); x.lineTo(w*0.8+15, h*0.2);
    x.closePath(); x.fill();
    /* 钟楼长窗 */
    x.fillStyle='#7a5c34';
    for(var tw=0;tw<3;tw++) x.fillRect(w*0.8+3+tw*4.4, h*0.4, 2.6, 8);
    /* 橘树梢一列 */
    for(var tr=0;tr<9;tr++){
      var tx = 10+tr*36;
      x.fillStyle = tr%2 ? '#3a7034' : '#2e6029';
      x.beginPath(); x.arc(tx, h*0.71, 6, 0, Math.PI*2); x.fill();
      x.fillStyle = '#e8862c';
      x.fillRect(tx-2, h*0.69, 2, 2); x.fillRect(tx+2, h*0.72, 2, 2);
    }
    /* 地面暖沙 */
    x.fillStyle='#c8a068';
    x.fillRect(0, h*0.72, w, h*0.28);
    x.fillStyle='#b89058';
    for(var g2=0;g2<8;g2++) x.fillRect(0, h*0.74+g2*4, w, 1);
    speckle(x, w, h, '#8a6a40', 300, 0.12);
  }

  function paintTavern(x, w, h){
    /* 暖泥墙 */
    x.fillStyle='#5c4028'; x.fillRect(0,0,w,h);
    x.fillStyle='#523a24'; x.fillRect(0,0,w,h*0.1);
    /* 木梁 */
    x.fillStyle='#3a2814';
    x.fillRect(0, 0, w, 7);
    for(var bm=0;bm<5;bm++) x.fillRect(20+bm*64, 0, 8, h*0.34);
    /* 护墙板 */
    x.fillStyle='#48301a'; x.fillRect(0, h*0.72, w, h*0.28);
    x.fillStyle='#3a2412'; x.fillRect(0, h*0.72, w, 3);
    /* 窗(左): 夜空+月 */
    x.fillStyle='#2c1c10'; x.fillRect(w*0.1-3, h*0.2-3, 42, 40);
    x.fillStyle='#101830'; x.fillRect(w*0.1, h*0.2, 36, 34);
    x.fillStyle='#e8e8ff';
    x.beginPath(); x.arc(w*0.1+24, h*0.2+10, 5, 0, Math.PI*2); x.fill();
    x.fillStyle='#c8d0f0';
    x.fillRect(w*0.1+6, h*0.2+6, 1.6, 1.6); x.fillRect(w*0.1+12, h*0.2+20, 1.6, 1.6);
    x.fillStyle='#2c1c10';
    x.fillRect(w*0.1+16, h*0.2, 3, 34); x.fillRect(w*0.1, h*0.2+15, 36, 3);
    /* 酒架(中右): 层板+瓶群 */
    var bx = w*0.42, bw2 = w*0.3;
    x.fillStyle='#3a2814'; x.fillRect(bx-4, h*0.16, bw2+8, h*0.42);
    var btlCols=['#3c7a58','#7a3c50','#c8a03c','#4a6a9c','#8c5a28'];
    for(var s2=0;s2<3;s2++){
      var sy = h*0.22+s2*15;
      x.fillStyle='#241608'; x.fillRect(bx, sy+10, bw2, 3);
      for(var bb=0;bb<9;bb++){
        x.fillStyle=btlCols[(bb+s2)%5];
        x.fillRect(bx+4+bb*10, sy, 4, 10);
        x.fillRect(bx+5+bb*10, sy-3, 2, 3);
      }
    }
    /* 壁炉(右): 石拱+火膛 */
    var fxp = w*0.82;
    x.fillStyle='#6a5a48'; x.fillRect(fxp-6, h*0.3, 52, h*0.42);
    x.fillStyle='#54463a';
    for(var st2=0;st2<6;st2++)
      x.fillRect(fxp-4+(st2%2)*6, h*0.32+st2*8, 20-(st2%2)*8, 6);
    x.fillStyle='#180a04';
    x.fillRect(fxp+6, h*0.44, 26, h*0.28);
    x.fillStyle='#3a2814'; x.fillRect(fxp-8, h*0.28, 56, 5);
    /* 挂物: 辣椒串/蒜串/火腿 */
    for(var pp=0;pp<3;pp++){
      x.fillStyle='#c02818';
      for(var pc=0;pc<4;pc++) x.fillRect(w*0.36+pp*10, 12+pc*5, 3, 4);
    }
    x.fillStyle='#e8dcc8';
    for(var gc=0;gc<3;gc++) x.fillRect(w*0.32, 12+gc*4, 3.6, 3.6);
    x.fillStyle='#8a4030'; x.fillRect(w*0.27, 10, 8, 13);
    x.fillStyle='#e8d8c0'; x.fillRect(w*0.27+3, 6, 2, 5);
    /* 斗牛海报 */
    x.fillStyle='#c8a060'; x.fillRect(w*0.05, h*0.44, 16, 20);
    x.fillStyle='#8a2820'; x.fillRect(w*0.05+3, h*0.44+3, 10, 9);
    x.fillStyle='#3a2818'; x.fillRect(w*0.05+3, h*0.44+15, 10, 2);
    speckle(x, w, h, '#2c1c0e', 400, 0.14);
  }

  function paintArena(x, w, h){
    /* 黄昏色带 */
    skyBands(x, w, h, ['#3c2848','#6a3854','#a85048','#e08850','#f0b060'], 0.5);
    /* 低垂落日 */
    x.fillStyle='#ffb060';
    x.beginPath(); x.arc(w*0.72, h*0.42, 13, 0, Math.PI*2); x.fill();
    x.fillStyle='rgba(255,150,80,0.35)';
    x.beginPath(); x.arc(w*0.72, h*0.42, 19, 0, Math.PI*2); x.fill();
    /* 燕群 */
    x.fillStyle='#2c1830';
    [[0.2,0.16],[0.26,0.12],[0.33,0.2],[0.55,0.1],[0.6,0.15]].forEach(function(bd){
      x.fillRect(w*bd[0], h*bd[1], 3, 1);
      x.fillRect(w*bd[0]-2, h*bd[1]-1, 2, 1); x.fillRect(w*bd[0]+3, h*bd[1]-1, 2, 1);
    });
    /* 斗牛场弧墙 */
    x.fillStyle='#e0b878';
    x.fillRect(0, h*0.5, w, h*0.5);
    /* 弧感: 顶缘一条弧线 */
    x.fillStyle='#a03828';
    x.beginPath();
    x.moveTo(0, h*0.54);
    x.quadraticCurveTo(w/2, h*0.46, w, h*0.54);
    x.lineTo(w, h*0.58);
    x.quadraticCurveTo(w/2, h*0.5, 0, h*0.58);
    x.closePath(); x.fill();
    /* 顶层观众点点 */
    var crowdCols = ['#e8c050','#c04838','#3878b0','#e8e0d0','#3a9048','#d87828'];
    for(var cc=0;cc<130;cc++){
      x.fillStyle = crowdCols[cc%6];
      var ccx = Math.random()*w;
      var arcY = h*0.54 - Math.sin(ccx/w*Math.PI)*h*0.075;
      x.fillRect(ccx, arcY-4-Math.random()*3, 2, 2);
    }
    /* 拱窗列 */
    x.fillStyle='#6a4020';
    for(var aw=0;aw<8;aw++){
      var awx = 12+aw*40;
      var awy = h*0.62 - Math.sin((awx+10)/w*Math.PI)*h*0.05;
      x.fillRect(awx, awy, 12, 18);
      x.beginPath(); x.arc(awx+6, awy, 6, Math.PI, 0); x.fill();
    }
    /* 场旗 */
    x.fillStyle='#c04838';
    for(var fg=0;fg<5;fg++){
      var fgx = 30+fg*66;
      var fgy = h*0.5 - Math.sin(fgx/w*Math.PI)*h*0.075;
      x.fillStyle='#6a4830'; x.fillRect(fgx, fgy-14, 1.6, 14);
      x.fillStyle=fg%2?'#e8c050':'#c04838';
      x.fillRect(fgx+1.6, fgy-14, 7, 5);
    }
    /* 地面 */
    x.fillStyle='#c09058'; x.fillRect(0, h*0.84, w, h*0.16);
    x.fillStyle='#a87c48';
    for(var g3=0;g3<4;g3++) x.fillRect(0, h*0.86+g3*4, w, 1);
    speckle(x, w, h, '#8a6438', 260, 0.14);
  }

  /* ============================================================
     第一幕布景 — 塞维利亚广场
     ============================================================ */
  function buildPlaza(){
    var root = new THREE.Group(); roots.plaza = root; T.scene().add(root);
    fx.plaza = {};

    var bd = backdropMesh(paintPlaza);
    root.add(bd);
    fx.plaza.tintables = [bd.material];

    /* ---- 烟草厂景片 (右, 带厚度的舞台平片) ---- */
    var fac = new THREE.Group();
    var facWall = T.box(34, 34, 2.4, '#d8a868');
    facWall.position.y = 17; fac.add(facWall);
    var facTrim = T.box(35, 2.6, 3, '#a87840');
    facTrim.position.y = 33; fac.add(facTrim);
    var facBase = T.box(35, 3, 3, '#a87840');
    facBase.position.y = 1.5; fac.add(facBase);
    /* 大拱门 (练习门: 演员由此进出) */
    var arch = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 3, 14, 1, false, -Math.PI/2, Math.PI),
      T.mat('#7a5028'));
    arch.rotation.x = Math.PI/2;
    arch.position.set(0, 12, 1); fac.add(arch);
    var archIn = T.box(13.4, 12, 1.6, '#2a1a0c');
    archIn.position.set(0, 6, 0.8); fac.add(archIn);
    /* 高窗 */
    for(var fw=0;fw<2;fw++){
      var fWin = T.plane(5, 7, '#6a4c2c');
      fWin.position.set(-11+fw*22, 24, 1.4); fac.add(fWin);
      var sill = T.box(6.2, 1, 1.6, '#a87840');
      sill.position.set(-11+fw*22, 20, 1.5); fac.add(sill);
    }
    /* 厂牌 */
    var signTex = canvasTexture(96, 18, function(sx, sw, sh){
      sx.fillStyle='#4a2c16'; sx.fillRect(0,0,sw,sh);
      sx.font='bold 11px Georgia'; sx.textAlign='center'; sx.textBaseline='middle';
      sx.fillStyle='#e8c060'; sx.fillText('TABACOS', sw/2, sh/2+1);
    });
    var sign = new THREE.Mesh(new THREE.PlaneGeometry(17, 3.4),
      new THREE.MeshBasicMaterial({map:signTex}));
    sign.position.set(0, 29.5, 1.5); fac.add(sign);
    /* 侧边厚度可见 (景片感) */
    var facSide = T.box(2, 34, 2.8, '#b08850');
    facSide.position.set(-17.8, 17, 0); fac.add(facSide);
    fac.position.set(54, 0, -30);
    root.add(fac);

    /* ---- 岗亭 (左) ---- */
    var post = new THREE.Group();
    var postBody = T.box(8, 13, 7, '#3868a0');
    postBody.position.y = 6.5; post.add(postBody);
    for(var ps=0;ps<3;ps++){
      var stripe = T.box(8.4, 1.6, 7.4, '#e8e0cc');
      stripe.position.y = 3+ps*4; post.add(stripe);
    }
    var postRoof = T.cone(6.6, 4.4, 4, '#28405c');
    postRoof.position.y = 15.2; postRoof.rotation.y = Math.PI/4; post.add(postRoof);
    var postIn = T.box(5.4, 9.5, 1, '#141c2c');
    postIn.position.set(0, 5.5, 3.6); post.add(postIn);
    post.position.set(-56, 0, -22);
    root.add(post);
    /* 旗杆 */
    var flagpole = T.cyl(0.4, 0.5, 23, 6, '#8a7040');
    flagpole.position.set(-68, 11.5, -24); root.add(flagpole);
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(8, 5, 6, 1),
      new THREE.MeshToonMaterial({color:new THREE.Color('#c8322c'), gradientMap:T.gradTex(), side:THREE.DoubleSide}));
    flag.position.set(-63.5, 20, -24);
    root.add(flag);
    fx.plaza.flag = flag;
    fx.plaza.flagBase = flag.geometry.attributes.position.array.slice();
    var flagY = T.box(8.4, 1.2, 0.14, '#e8c040');
    flagY.position.set(-63.5, 20, -24.1); root.add(flagY);

    /* ---- 喷泉 (中左) ---- */
    var fountain = new THREE.Group();
    var fBase = T.cyl(7.5, 8.4, 2.2, 10, '#c8b088');
    fBase.position.y = 1.1; fountain.add(fBase);
    var fWater = T.cyl(6.4, 6.4, 1.5, 10, '#5090b8');
    fWater.position.y = 2; fountain.add(fWater);
    var fPillar = T.cyl(1.2, 1.6, 5, 8, '#b89868');
    fPillar.position.y = 4.4; fountain.add(fPillar);
    var fTop = T.cyl(3, 3.6, 1.2, 10, '#c8b088');
    fTop.position.y = 7.2; fountain.add(fTop);
    var fJet = T.cyl(0.45, 0.8, 3.4, 6, '#88c0e0');
    fJet.position.y = 9.4; fountain.add(fJet);
    fx.plaza.fountainJet = fJet;
    fountain.position.set(-26, 0, -18);
    root.add(fountain);

    /* ---- 长椅 (右中) ---- */
    var bench = new THREE.Group();
    var seat = T.box(13, 1, 4.4, '#8a6438');
    seat.position.y = 3.8; bench.add(seat);
    var back = T.box(13, 4, 0.9, '#8a6438');
    back.position.set(0, 6.4, -1.9); bench.add(back);
    for(var bl=0;bl<2;bl++){
      var bLeg = T.box(1, 3.8, 4, '#4a3420');
      bLeg.position.set(-5+bl*10, 1.9, 0); bench.add(bLeg);
    }
    bench.position.set(26, 0, -16);
    root.add(bench);

    /* ---- 盆栽橘子树 ×2 (剧场感十足的道具树) ---- */
    var potXs = [[-42,-20],[42,-26]];
    fx.plaza.trees = [];
    for(var tr=0;tr<2;tr++){
      var tree = new THREE.Group();
      var pot = T.cyl(3.4, 2.6, 3.4, 8, '#b06a3a');
      pot.position.y = 1.7; tree.add(pot);
      var potRim = T.cyl(3.7, 3.7, 0.9, 8, '#c87c48');
      potRim.position.y = 3.3; tree.add(potRim);
      var trunk = T.cyl(0.9, 1.2, 6, 6, '#6a4826');
      trunk.position.y = 6.4; tree.add(trunk);
      var crown = new THREE.Group();
      var crownCols = ['#3a7034','#2e6029','#44803c'];
      for(var cb=0;cb<4;cb++){
        var blob = T.sph(2.8+((cb*7)%2), crownCols[cb%3]);
        blob.position.set(((cb*13)%5)-2, 10.5+((cb*11)%4), ((cb*17)%4)-2);
        crown.add(blob);
      }
      for(var o=0;o<5;o++){
        var orange = T.sph(0.6, '#e8862c');
        orange.position.set(((o*23)%7)-3, 10+((o*13)%5), ((o*31)%4)-1.5);
        crown.add(orange);
      }
      tree.add(crown);
      tree.position.set(potXs[tr][0], 0, potXs[tr][1]);
      root.add(tree);
      fx.plaza.trees.push(crown);
    }

    /* 金色浮尘 */
    var motes = new THREE.Group();
    for(var mo=0;mo<20;mo++){
      var mote = new THREE.Mesh(new THREE.PlaneGeometry(0.55,0.55),
        T.flat('#ffe8a0',{transparent:true, opacity:rand(0.2,0.5)}));
      mote.position.set(rand(-64,64), rand(4,40), rand(-24,4));
      mote.userData = {p:Math.random()*Math.PI*2, sp:rand(0.2,0.7)};
      motes.add(mote);
    }
    root.add(motes); fx.plaza.motes = motes;
  }

  /* ============================================================
     第二幕布景 — 帕斯蒂亚酒馆
     ============================================================ */
  function buildTavern(){
    var root = new THREE.Group(); roots.tavern = root; T.scene().add(root);
    root.visible = false;
    fx.tavern = {};

    var bd = backdropMesh(paintTavern);
    root.add(bd);
    fx.tavern.tintables = [bd.material];

    /* ---- 火膛光 (对齐天幕上画的壁炉) ---- */
    var fire = T.plane(11, 8, '#ff8830', {transparent:true, opacity:0.9});
    fire.position.set(53, 5.5, -33.2);
    root.add(fire);
    fx.tavern.fire = fire;
    var fireCore = T.plane(6, 4.5, '#ffd060', {transparent:true, opacity:0.9});
    fireCore.position.set(53, 4.2, -33.1);
    root.add(fireCore);
    fx.tavern.fireCore = fireCore;
    var fireLight = new THREE.PointLight('#ff9040', 0.9, 85);
    fireLight.position.set(52, 9, -24); root.add(fireLight);
    fx.tavern.fireLight = fireLight;

    /* ---- 左门景片 (拱门, 演员进出) ---- */
    var door = new THREE.Group();
    var doorL = T.box(3.4, 20, 2.6, '#54381e');
    doorL.position.set(-7, 10, 0); door.add(doorL);
    var doorR = doorL.clone(); doorR.position.x = 7; door.add(doorR);
    var doorTop = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 2.6, 12, 1, false, -Math.PI/2, Math.PI),
      T.mat('#54381e'));
    doorTop.rotation.x = Math.PI/2;
    doorTop.position.set(0, 20, 0); door.add(doorTop);
    var doorIn = T.box(11.4, 19, 1.4, '#12080a');
    doorIn.position.set(0, 9.5, -0.4); door.add(doorIn);
    /* 门外一抹夜色月光 */
    var doorMoon = T.plane(2.6, 2.6, '#c8d0f0');
    doorMoon.geometry = new THREE.CircleGeometry(1.5, 10);
    doorMoon.position.set(2.4, 15, 0.4); door.add(doorMoon);
    door.position.set(-56, 0, -29);
    root.add(door);

    /* ---- 卡门的舞台桌 (中央) ---- */
    var danceTable = new THREE.Group();
    var dtTop = T.cyl(10.5, 10.5, 1.6, 12, '#7a5228');
    dtTop.position.y = 8.6; danceTable.add(dtTop);
    var dtTop2 = T.cyl(9.9, 9.9, 0.6, 12, '#8c6032');
    dtTop2.position.y = 9.7; danceTable.add(dtTop2);
    var dtLeg = T.cyl(1.4, 2, 8, 8, '#4a3018');
    dtLeg.position.y = 4; danceTable.add(dtLeg);
    var dtFoot = T.cyl(4.2, 4.8, 1.4, 10, '#3c2814');
    dtFoot.position.y = 0.7; danceTable.add(dtFoot);
    danceTable.position.set(-4, 0, -10);
    root.add(danceTable);

    /* ---- 吧台 (右) + 酒桶 ---- */
    var counter = T.box(26, 8.5, 7, '#5c3a24');
    counter.position.set(36, 4.25, -22); root.add(counter);
    var counterTop = T.box(28, 1.5, 9, '#7a5228');
    counterTop.position.set(36, 9.2, -22); root.add(counterTop);
    for(var bt=0;bt<2;bt++){
      var barrel = new THREE.Group();
      var bBody = T.cyl(3.2, 3.2, 7.4, 10, '#6a4626');
      bBody.position.y = 3.7; barrel.add(bBody);
      var bRib = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.28, 4, 10), T.mat('#3a2814'));
      bRib.rotation.x = Math.PI/2; bRib.position.y = 5.4; barrel.add(bRib);
      var bRib2 = bRib.clone(); bRib2.position.y = 2; barrel.add(bRib2);
      barrel.position.set(58+bt*1.5, 0, -20-bt*6);
      root.add(barrel);
    }

    /* ---- 小圆桌 + 凳 (左前) ---- */
    var table = new THREE.Group();
    var tTop = T.cyl(6, 6, 1.2, 10, '#6a4626');
    tTop.position.y = 7.4; table.add(tTop);
    var tLeg = T.cyl(0.8, 1.1, 7, 6, '#3c2814');
    tLeg.position.y = 3.5; table.add(tLeg);
    table.position.set(-32, 0, -4);
    root.add(table);
    var stoolPos = [[-26,-1],[-38,-1],[8,-4],[18,-2]];
    for(var st=0;st<4;st++){
      var stool = new THREE.Group();
      var sTop = T.cyl(2.2, 2.2, 1.2, 8, '#54381e');
      sTop.position.y = 4.6; stool.add(sTop);
      var sLeg = T.cyl(0.5, 0.7, 4.6, 6, '#2c1c10');
      sLeg.position.y = 2.2; stool.add(sLeg);
      stool.position.set(stoolPos[st][0], 0, stoolPos[st][1]);
      root.add(stool);
    }

    /* ---- 彩纸灯笼串 ×2 (节庆气氛) ---- */
    fx.tavern.lanternStr = [];
    var lantCols = ['#e85848','#e8c050','#58a868','#5888c8','#c868a8'];
    function lanternString(x1, x2, y0, z){
      var grp = new THREE.Group();
      for(var l=0;l<7;l++){
        var t2 = l/6;
        var lx = lerp(x1, x2, t2);
        var ly = y0 - Math.sin(t2*Math.PI)*4;
        var lant = new THREE.Group();
        var paper = T.sph(1.6, lantCols[l%5]);
        paper.scale.y = 1.25;
        paper.material = T.flat(lantCols[l%5]);
        lant.add(paper);
        var capT = T.cyl(0.7,0.7,0.5,6,'#3a2814'); capT.position.y=2.1; lant.add(capT);
        var capB = T.cyl(0.5,0.5,0.4,6,'#3a2814'); capB.position.y=-2.1; lant.add(capB);
        lant.position.set(lx, ly, z);
        lant.userData = {baseY:ly, ph:l*0.9};
        grp.add(lant);
      }
      root.add(grp);
      fx.tavern.lanternStr.push(grp);
    }
    lanternString(-62, -2, 40, -12);
    lanternString(2, 62, 40, -12);

    /* 烛台 (小桌上) */
    var candle = new THREE.Group();
    var cBody = T.cyl(0.4, 0.5, 2, 6, '#e8dcc0');
    cBody.position.y = 1; candle.add(cBody);
    var cFlame = T.cone(0.4, 1, 5, '#ffc040');
    cFlame.material = T.flat('#ffc040');
    cFlame.position.y = 2.6; candle.add(cFlame);
    fx.tavern.candleFlame = cFlame;
    candle.position.set(-34, 8, -5);
    root.add(candle);

    /* 火星 */
    var sparks = new THREE.Group();
    for(var sk=0;sk<8;sk++){
      var spark = new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.5),
        T.flat('#ffb050',{transparent:true, opacity:0.8}));
      spark.position.set(rand(48,58), rand(5,16), rand(-30,-26));
      spark.userData={p:Math.random()*Math.PI*2, sp:rand(2,4.5)};
      sparks.add(spark);
    }
    root.add(sparks); fx.tavern.sparks = sparks;
  }

  /* ============================================================
     第三幕布景 — 斗牛场外
     ============================================================ */
  function buildArena(){
    var root = new THREE.Group(); roots.arena = root; T.scene().add(root);
    root.visible = false;
    fx.arena = {};

    var bd = backdropMesh(paintArena);
    root.add(bd);
    fx.arena.tintables = [bd.material];

    /* ---- 场门景片 (中央, 演员进出) ---- */
    var gate = new THREE.Group();
    var gateL = T.box(5.6, 27, 6, '#c8a05c');
    gateL.position.set(-9.5, 13.5, 0); gate.add(gateL);
    var gateR = gateL.clone(); gateR.position.x = 9.5; gate.add(gateR);
    var gateTop = new THREE.Mesh(
      new THREE.CylinderGeometry(9.5, 9.5, 5.6, 14, 1, false, -Math.PI/2, Math.PI),
      T.mat('#c8a05c'));
    gateTop.rotation.x = Math.PI/2;
    gateTop.position.set(0, 27, 0); gate.add(gateTop);
    var gateIn = T.box(14, 26, 1.4, '#2a1408');
    gateIn.position.set(0, 13, -0.5); gate.add(gateIn);
    fx.arena.gateIn = gateIn;
    /* 门楣饰徽 */
    var crest = T.box(9, 5, 1.4, '#a03828');
    crest.position.set(0, 32.5, 1.4); gate.add(crest);
    var crestGold = T.box(5.4, 2.6, 1.6, '#e8c050');
    crestGold.position.set(0, 32.5, 1.5); gate.add(crestGold);
    /* 石阶 */
    var step = T.box(22, 1.4, 5, '#b89058');
    step.position.set(0, 0.7, 3.4); gate.add(step);
    gate.position.set(0, 0, -28);
    root.add(gate);

    /* ---- 木栅栏 (场门两侧, 斗牛场围栏味) ---- */
    for(var fc2=0;fc2<2;fc2++){
      var fence = new THREE.Group();
      for(var fp2=0;fp2<4;fp2++){
        var post2 = T.box(1.6, 8, 1.6, '#8a5c30');
        post2.position.set(fp2*6, 4, 0); fence.add(post2);
      }
      var rail1 = T.box(20, 1.4, 1.2, '#a87844');
      rail1.position.set(9, 6.4, 0); fence.add(rail1);
      var rail2 = T.box(20, 1.4, 1.2, '#a87844');
      rail2.position.set(9, 3, 0); fence.add(rail2);
      fence.position.set(fc2? 20 : -38, 0, -25);
      root.add(fence);
    }

    /* ---- 彩旗绳 ×2 ---- */
    fx.arena.bunting = [];
    var cols = ['#d84838','#e8c050','#3878b0','#3a9048','#d87828'];
    function buntingLine(x1,y1,x2,y2,z,n){
      var grp = new THREE.Group();
      for(var f2=0;f2<n;f2++){
        var t2 = f2/(n-1);
        var fx2 = lerp(x1,x2,t2);
        var fy = lerp(y1,y2,t2) - Math.sin(t2*Math.PI)*4.5;
        var flag2 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.8, 3), T.mat(cols[f2%5]));
        flag2.rotation.z = Math.PI;
        flag2.rotation.y = Math.PI/2;
        flag2.position.set(fx2, fy-1.3, z);
        flag2.userData = {baseY:fy-1.3, ph:f2*0.7};
        grp.add(flag2);
      }
      root.add(grp);
      fx.arena.bunting.push(grp);
    }
    buntingLine(-68, 40, -10, 33, -22, 10);
    buntingLine(10, 33, 68, 40, -22, 10);

    /* ---- 海报板 (左) ---- */
    function litPlane(w2, h2, c){
      return new THREE.Mesh(new THREE.PlaneGeometry(w2, h2), T.mat(c));
    }
    var postWall = new THREE.Group();
    var pwBody = T.box(20, 17, 2.4, '#c8a870');
    pwBody.position.y = 8.5; postWall.add(pwBody);
    var pwRoof = T.box(22, 1.6, 3.6, '#8a5c30');
    pwRoof.position.y = 17.6; postWall.add(pwRoof);
    var poster1 = litPlane(7, 10, '#d8c8a0');
    poster1.position.set(-4.5, 9.5, 1.4); postWall.add(poster1);
    var poster1Ink = litPlane(5.4, 4.6, '#a02828');
    poster1Ink.position.set(-4.5, 11, 1.5); postWall.add(poster1Ink);
    var poster1Txt = litPlane(5.4, 1.2, '#3a2818');
    poster1Txt.position.set(-4.5, 6.4, 1.5); postWall.add(poster1Txt);
    var poster2 = litPlane(7, 10, '#e0d0a8');
    poster2.position.set(4.5, 8.8, 1.4); poster2.rotation.z = -0.05; postWall.add(poster2);
    var poster2Ink = litPlane(4.8, 5.2, '#28486a');
    poster2Ink.position.set(4.5, 10, 1.5); postWall.add(poster2Ink);
    postWall.position.set(-52, 0, -24);
    root.add(postWall);

    /* ---- 卖花摊 (右) ---- */
    var stall = new THREE.Group();
    var stTop2 = T.box(13, 1, 7, '#8a5c30');
    stTop2.position.y = 5.6; stall.add(stTop2);
    for(var sl=0;sl<2;sl++){
      var sLeg2 = T.box(1, 5.6, 1, '#5a3c20');
      sLeg2.position.set(-5+sl*10, 2.8, 0); stall.add(sLeg2);
    }
    var awn = T.box(15, 0.8, 9, '#c04838');
    awn.position.y = 12; awn.rotation.z = 0.05; stall.add(awn);
    for(var ap=0;ap<2;ap++){
      var awnPole = T.cyl(0.3,0.3,6.4,5,'#5a3c20');
      awnPole.position.set(-5.8+ap*11.6, 8.8, 3); stall.add(awnPole);
    }
    var flowerCols = ['#d83048','#e8c040','#d87090','#e8e8e0'];
    for(var fl2=0;fl2<7;fl2++){
      var bloom2 = T.sph(0.85, flowerCols[fl2%4]);
      bloom2.position.set(-4.5+((fl2*29)%10), 6.6, -2+((fl2*17)%4));
      stall.add(bloom2);
    }
    stall.position.set(50, 0, -20);
    root.add(stall);

    /* 飘落花瓣 */
    var petals = new THREE.Group();
    for(var pt=0;pt<14;pt++){
      var petal = new THREE.Mesh(new THREE.PlaneGeometry(1,0.7),
        T.flat(pt%3?'#e86878':'#e8c050',{transparent:true, opacity:0.85, side:THREE.DoubleSide}));
      petal.position.set(rand(-66,66), rand(6,42), rand(-22,8));
      petal.userData = {p:Math.random()*Math.PI*2, sp:rand(0.5,1.3), fall:rand(1.2,2.4)};
      petals.add(petal);
    }
    root.add(petals); fx.arena.petals = petals;

    /* ---- 血色纱幕 (剪影时刻落在所有景片之前) ---- */
    var bloodTex = canvasTexture(16, 64, function(bx, bw, bh){
      var g = bx.createLinearGradient(0,0,0,bh);
      g.addColorStop(0, '#e02838');
      g.addColorStop(0.45, '#b01624');
      g.addColorStop(1, '#5c0812');
      bx.fillStyle = g; bx.fillRect(0,0,bw,bh);
    });
    var blood = new THREE.Mesh(new THREE.PlaneGeometry(176, 60),
      new THREE.MeshBasicMaterial({map:bloodTex, transparent:true, opacity:0}));
    blood.position.set(0, 30, -23);
    blood.visible = false;
    root.add(blood);
    fx.arena.bloodDrop = blood;
  }

  /* ============================================================
     切换 / 染色 / 更新
     ============================================================ */
  function show(name){
    cur = name;
    roots.plaza.visible = (name==='plaza');
    roots.tavern.visible = (name==='tavern');
    roots.arena.visible = (name==='arena');
    if(fx.tavern && fx.tavern.fireLight)
      fx.tavern.fireLight.intensity = (name==='tavern') ? 0.9 : 0;
  }

  /* ---- 3D 主幕布控制: 0=闭合 1=全开 ---- */
  var curtV = 0;
  var curtTween = null;
  function setCurtain(v, dur, done){
    var from = curtV; var t = 0;
    if(curtTween) curtTween.done = true;
    var obj = {done:false};
    curtTween = obj;
    if(Math.abs(from-v)>0.02) AudioSys.sfx.curtainSwish();
    Theater.animate(function(dt){
      if(obj.done) return true;
      t += dt/(dur||2.6);
      if(t>=1){ curtV=v; applyCurtain(); if(done) done(); curtTween=null; return true; }
      curtV = lerp(from, v, easeInOut(t));
      applyCurtain();
      return false;
    });
  }
  function snapCurtain(v){
    if(curtTween){ curtTween.done = true; curtTween = null; }
    curtV = v; applyCurtain();
  }
  function applyCurtain(){
    fx.theatre.curtL.position.x = -84*easeInOut(curtV);
    fx.theatre.curtR.position.x = 84*easeInOut(curtV);
  }
  function getCurtain(){ return curtV; }

  /* 天幕染色 (黄昏/血色/夜蓝) — 乘算画片颜色 */
  function tint(name, color, dur){
    var f = fx[name];
    if(!f || !f.tintables) return;
    var toC = new THREE.Color(color);
    f.tintables.forEach(function(m){
      var fromC = m.color.clone();
      var t=0;
      Theater.animate(function(dt){
        t += dt/(dur||2);
        if(t>=1){ m.color.copy(toC); return true; }
        m.color.copy(fromC).lerp(toC, easeInOut(t));
        return false;
      });
    });
  }

  function update(dt){
    var t = performance.now()/1000;
    /* 脚灯常燃微闪 */
    if(fx.theatre && fx.theatre.footGlows){
      for(var fg=0;fg<fx.theatre.footGlows.length;fg++){
        fx.theatre.footGlows[fg].material.opacity = 0.72+Math.sin(t*5+fg*1.9)*0.12;
      }
    }
    /* 幕布绒面微微呼吸 */
    if(fx.theatre && fx.theatre.curtL && curtV < 0.98){
      [fx.theatre.curtL, fx.theatre.curtR].forEach(function(panel, pi){
        for(var ci=0;ci<panel.children.length;ci++){
          var pl = panel.children[ci];
          if(pl.userData && pl.userData.bz!==undefined)
            pl.position.z = pl.userData.bz + Math.sin(t*0.9 + pl.userData.ph + pi*2)*0.22;
        }
      });
    }
    if(cur==='plaza' && fx.plaza){
      var flag = fx.plaza.flag;
      if(flag){
        var pos = flag.geometry.attributes.position;
        var base = fx.plaza.flagBase;
        for(var v=0;v<pos.count;v++){
          var bx = base[v*3];
          pos.array[v*3+2] = base[v*3+2] + Math.sin(bx*0.5+t*4)*0.6*((bx+4)/8);
        }
        pos.needsUpdate = true;
      }
      if(fx.plaza.motes){
        fx.plaza.motes.children.forEach(function(m){
          m.position.y += Math.sin(t*m.userData.sp+m.userData.p)*dt*1.5;
          m.position.x += Math.cos(t*0.4+m.userData.p)*dt*1.6;
          m.rotation.z = t*m.userData.sp;
        });
      }
      if(fx.plaza.fountainJet){
        fx.plaza.fountainJet.scale.y = 1+Math.sin(t*5)*0.14;
        fx.plaza.fountainJet.position.y = 9.4+Math.sin(t*5)*0.25;
      }
      fx.plaza.trees.forEach(function(cr,i){
        cr.rotation.z = Math.sin(t*0.8+i*2)*0.018;
      });
    }
    if(cur==='tavern' && fx.tavern){
      if(fx.tavern.fire){
        fx.tavern.fire.scale.y = 1+Math.sin(t*11)*0.16+Math.sin(t*23)*0.08;
        fx.tavern.fire.material.opacity = 0.72+Math.sin(t*17)*0.16;
        fx.tavern.fireCore.scale.x = 1+Math.sin(t*13)*0.2;
      }
      if(fx.tavern.fireLight && fx.tavern.fireLight.intensity>0){
        fx.tavern.fireLight.intensity = 0.82+Math.sin(t*13)*0.14+Math.sin(t*29)*0.07;
      }
      if(fx.tavern.candleFlame){
        fx.tavern.candleFlame.scale.y = 1+Math.sin(t*9)*0.25;
        fx.tavern.candleFlame.rotation.z = Math.sin(t*7)*0.12;
      }
      fx.tavern.lanternStr.forEach(function(grp, gi){
        grp.children.forEach(function(l, li){
          l.position.y = l.userData.baseY + Math.sin(t*1.6+l.userData.ph+gi)*0.5;
          l.rotation.z = Math.sin(t*1.2+l.userData.ph)*0.08;
        });
      });
      if(fx.tavern.sparks){
        fx.tavern.sparks.children.forEach(function(s){
          s.position.y += dt*s.userData.sp;
          s.material.opacity = 0.4+Math.sin(t*6+s.userData.p)*0.35;
          if(s.position.y>20){ s.position.y = 5; s.position.x = rand(48,58); }
        });
      }
    }
    if(cur==='arena' && fx.arena){
      fx.arena.bunting.forEach(function(grp){
        grp.children.forEach(function(f){
          f.position.y = f.userData.baseY + Math.sin(t*2.4+f.userData.ph)*0.45;
          f.rotation.x = Math.sin(t*3+f.userData.ph)*0.18;
        });
      });
      if(fx.arena.petals){
        fx.arena.petals.children.forEach(function(p){
          p.position.y -= dt*p.userData.fall;
          p.position.x += Math.sin(t*p.userData.sp+p.userData.p)*dt*2.2;
          p.rotation.x = t*p.userData.sp;
          p.rotation.z = t*p.userData.sp*0.7;
          if(p.position.y<0.5){ p.position.y = rand(32,44); p.position.x = rand(-66,66); }
        });
      }
    }
  }

  return {
    build: function(){ buildTheatre(); buildPlaza(); buildTavern(); buildArena(); },
    show:show, update:update, tint:tint,
    setCurtain:setCurtain, snapCurtain:snapCurtain, getCurtain:getCurtain,
    roots:roots, fx:fx,
    cur:function(){ return cur; }
  };
})();
