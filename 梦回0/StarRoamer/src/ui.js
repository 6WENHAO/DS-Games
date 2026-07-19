'use strict';
/* ================= ui.js — HUD / 小地图 / 星图 / 帮助 / 打击反馈 ================= */

const UI={
  mapOpen:false,mapView:'galaxy',mapSys:0,mapZoom:1,helpOpen:false,craftOpen:false,titleOpen:false,
  mapPanX:0,mapPanY:0,_panDown:false,_dragging:false,_downX:0,_downY:0,
  init(){
    const root=document.createElement('div');root.id='ui';
    root.innerHTML=`
<style>
#ui{position:fixed;inset:0;pointer-events:none;font-family:'Segoe UI',Consolas,sans-serif;color:#cfe8ff;user-select:none}
#ui .pane{background:rgba(8,14,22,0.62);border:1px solid rgba(90,160,220,0.35);border-radius:6px;backdrop-filter:blur(2px)}
#topbar{position:absolute;top:10px;left:50%;transform:translateX(-50%);padding:6px 18px;text-align:center;font-size:13px;letter-spacing:1px}
#topbar b{color:#ffd27a;font-size:15px}
#stat{position:absolute;left:14px;bottom:14px;padding:10px 14px;font-size:13px;min-width:190px}
#stat .big{font-size:26px;color:#7af0ff;font-weight:600}
#stat .bar{height:5px;background:#123;border-radius:3px;margin:4px 0 8px 0;overflow:hidden}
#stat .bar i{display:block;height:100%;background:linear-gradient(90deg,#35a0e0,#7af0ff);border-radius:3px}
#stat .hull i{background:linear-gradient(90deg,#e05a35,#ffb03a)}
#minimapBox{position:absolute;right:14px;bottom:14px;padding:8px;text-align:center}
#minimap{border-radius:50%;border:1px solid rgba(90,160,220,0.5)}
#radioLine{font-size:11px;color:#8fd0b8;margin-top:5px}
#coords{position:absolute;top:10px;right:14px;padding:6px 10px;font-size:11px;text-align:right;color:#8ab0d0}
#msg{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);font-size:17px;color:#ffe9b0;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .3s}
#crosshair{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:0}
#crosshair .dot{width:4px;height:4px;background:#7af0ff;border-radius:50%;margin:auto;box-shadow:0 0 6px #35a0e0}
#crosshair .ring{position:absolute;left:50%;top:50%;width:26px;height:26px;border:1px solid rgba(122,240,255,0.5);border-radius:50%;transform:translate(-50%,-50%)}
#hitmark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(45deg);width:18px;height:18px;opacity:0}
#hitmark:before,#hitmark:after{content:'';position:absolute;background:#ffd27a}
#hitmark:before{left:8px;top:0;width:2px;height:18px}
#hitmark:after{left:0;top:8px;width:18px;height:2px}
#tgtMark{position:absolute;width:34px;height:34px;border:2px solid #ffb03a;border-radius:4px;transform:translate(-50%,-50%) rotate(45deg);display:none}
#tgtLabel{position:absolute;font-size:11px;color:#ffb03a;transform:translate(-50%,-260%);white-space:nowrap}
#vignette{position:absolute;inset:0;box-shadow:inset 0 0 180px rgba(0,0,0,0.55);pointer-events:none}
#dmg{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(255,30,10,0.5));opacity:0}
#flash{position:absolute;inset:0;background:#dff4ff;opacity:0}
#help{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(860px,92vw);max-height:86vh;overflow:auto;padding:22px 30px;font-size:13px;display:none;pointer-events:auto}
#help h2{color:#7af0ff;margin:2px 0 10px 0;font-size:20px}
#help h3{color:#ffd27a;margin:14px 0 4px 0;font-size:15px}
#help td{padding:2px 14px 2px 0;vertical-align:top}
#help kbd{background:#1a2e42;border:1px solid #35608a;border-radius:4px;padding:1px 7px;font-family:Consolas;color:#aee2ff}
#craft{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(720px,92vw);max-height:82vh;overflow:auto;padding:20px 26px;font-size:13px;display:none;pointer-events:auto;z-index:70}
#craft h2{color:#7af0ff;margin:2px 0 12px 0;font-size:19px}
#craft td{padding:5px 10px 5px 0;vertical-align:middle;border-bottom:1px solid rgba(90,160,220,0.15)}
#craft .cbtn{background:#1a3e58;border:1px solid #35a0e0;border-radius:4px;color:#aee2ff;padding:3px 14px;cursor:pointer;font-size:13px}
#craft .cbtn:hover{background:#2a5e82}
#map{position:absolute;inset:0;background:rgba(4,8,14,0.93);display:none;pointer-events:auto;z-index:80}
#mapCv{position:absolute;inset:0}
#mapInfo{position:absolute;right:20px;top:60px;width:270px;padding:14px 18px;font-size:13px;display:none}
#mapInfo h3{color:#ffd27a;margin:0 0 6px 0}
#mapTitle{position:absolute;left:24px;top:16px;font-size:18px;color:#7af0ff}
#mapHint{position:absolute;left:24px;bottom:16px;font-size:12px;color:#8ab0d0}
#interact{position:absolute;left:50%;top:58%;transform:translateX(-50%);font-size:14px;color:#aee2ff;text-shadow:0 1px 4px #000;display:none}
#chud{position:absolute;inset:0;display:none;font-family:Consolas,'Segoe UI',monospace;color:#7de8ff;text-shadow:0 0 8px rgba(53,160,224,0.7)}
#chud .cnr{position:absolute;width:64px;height:64px;border-color:rgba(125,232,255,0.5);border-style:solid;border-width:0}
#chudTL{left:12%;top:15%;border-left-width:2px;border-top-width:2px}
#chudTR{right:12%;top:15%;border-right-width:2px;border-top-width:2px}
#chudBL{left:12%;bottom:17%;border-left-width:2px;border-bottom-width:2px}
#chudBR{right:12%;bottom:17%;border-right-width:2px;border-bottom-width:2px}
#chudRet{position:absolute;left:50%;top:50%;width:44px;height:44px;transform:translate(-50%,-50%) rotate(45deg);border:1px solid rgba(125,232,255,0.75)}
#chudRet:before{content:'';position:absolute;left:50%;top:50%;width:6px;height:6px;background:#aef2ff;transform:translate(-50%,-50%);box-shadow:0 0 9px #35c8ff}
#chudL{position:absolute;left:13%;top:50%;transform:translateY(-50%);font-size:13px}
#chudR{position:absolute;right:13%;top:50%;transform:translateY(-50%);text-align:right;font-size:13px}
#chud .big{font-size:30px;color:#aef2ff;font-weight:600;letter-spacing:1px}
#chud .lbl{font-size:10px;color:#4f9cc4;letter-spacing:2px;margin-top:6px}
#chud .vbar{width:112px;height:4px;background:rgba(20,50,70,0.8);margin:4px 0 2px}
#chudR .vbar{margin-left:auto}
#chud .vbar i{display:block;height:100%;background:linear-gradient(90deg,#2288bb,#7de8ff)}
#chudTgt{position:absolute;left:50%;top:20%;transform:translateX(-50%);font-size:12px;color:#ffd27a;letter-spacing:1px;white-space:nowrap}
#chudFlags{position:absolute;left:50%;bottom:19%;transform:translateX(-50%);font-size:12px;letter-spacing:2px;white-space:nowrap}
#chudFlags span{margin:0 7px;padding:2px 9px;border:1px solid rgba(125,232,255,0.3)}
#chudFlags .on{color:#ffe9b0;border-color:#ffd27a;text-shadow:0 0 8px #b8862a}
#chudFlags .off{color:#2f5a72;text-shadow:none}
#chudScan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(120,220,255,0.028) 0 1px,transparent 1px 4px)}
#title{position:absolute;inset:0;z-index:120;pointer-events:auto;display:none;opacity:0;transition:opacity 1.2s;font-family:'Segoe UI',sans-serif;background:linear-gradient(100deg,rgba(2,4,8,0.97) 0%,rgba(2,4,8,0.9) 42%,rgba(2,4,8,0.3) 100%)}
#title.on{opacity:1}
#titleBox{position:absolute;left:9%;top:28%}
#titleBox h1{margin:0;font-size:70px;font-weight:200;letter-spacing:18px;color:#f2f6fa}
#titleBox .zh{font-size:20px;letter-spacing:16px;color:#c8d4e0;margin-top:8px}
#titleBox .rule{width:340px;height:3px;background:#d8552a;margin-top:20px}
#titleMenu{position:absolute;left:9%;bottom:14%}
#titleMenu .mi{display:block;background:none;border:none;border-left:3px solid transparent;color:#e8eef4;font-size:20px;letter-spacing:6px;padding:10px 0;cursor:pointer;text-align:left;transition:padding .18s,border-color .18s,color .18s;font-family:inherit}
#titleMenu .mi:hover{padding-left:16px;border-left:3px solid #d8552a;color:#fff}
#titleConfirm{display:none;color:#ffb03a;font-size:15px;letter-spacing:2px;padding:8px 0}
#titleConfirm button{background:#1a3e58;border:1px solid #d8552a;color:#ffd9c0;padding:4px 16px;margin-right:10px;cursor:pointer;letter-spacing:3px}
#titleMeta{position:absolute;right:3%;bottom:4%;text-align:right;color:#5a7288;font-size:12px;letter-spacing:2px;line-height:1.8}
#help{z-index:130}
</style>
<div id="vignette"></div><div id="dmg"></div><div id="flash"></div>
<div id="topbar" class="pane"><span id="locLine">--</span></div>
<div id="coords" class="pane">--</div>
<div id="stat" class="pane">
  <div>速度 <span class="big" id="spd">0</span> m/s</div>
  <div class="bar"><i id="thrBar" style="width:0%"></i></div>
  <div>船体 <span id="hullTxt">100</span>%</div>
  <div class="bar hull"><i id="hullBar" style="width:100%"></i></div>
  <div id="hpRow" style="display:none"><div>生命 <span id="hpTxt">100</span></div>
  <div class="bar"><i id="hpBar" style="width:100%;background:linear-gradient(90deg,#2a9a4a,#7aff8a)"></i></div></div>
  <div id="modeTxt" style="color:#ffd27a">--</div>
  <div id="ammoLine" style="margin-top:2px;font-size:12px;color:#aee2ff;display:none">弹药 <span id="ammo">12/12</span> ｜ R 换弹</div>
  <div style="margin-top:4px;font-size:12px;color:#8fd0b8">信用点 <span id="credits">0</span> ｜ 医疗包 <span id="ore">0</span>/5 (Q用 C合成)</div>
  <div id="bagLine" style="margin-top:2px;font-size:12px;color:#c8a2ff"></div>
</div>
<div id="minimapBox" class="pane"><canvas id="minimap" width="170" height="170"></canvas><div id="radioLine">电台: OFF (B切换)</div></div>
<div id="msg"></div>
<div id="crosshair"><div class="ring"></div><div class="dot"></div></div>
<div id="chud">
  <div id="chudScan"></div>
  <div class="cnr" id="chudTL"></div><div class="cnr" id="chudTR"></div>
  <div class="cnr" id="chudBL"></div><div class="cnr" id="chudBR"></div>
  <div id="chudRet"></div>
  <div id="chudTgt">--</div>
  <div id="chudL">
    <div class="lbl">SPEED · 速度 m/s</div><div class="big" id="chSpd">0</div>
    <div class="lbl">THRUST · 油门</div><div class="vbar"><i id="chThr"></i></div>
  </div>
  <div id="chudR">
    <div class="lbl">ALTITUDE · 高度</div><div class="big" id="chAlt">--</div>
    <div class="lbl">HULL · 船体</div><div class="vbar"><i id="chHull" style="background:linear-gradient(90deg,#bb5522,#ffb03a)"></i></div>
  </div>
  <div id="chudFlags"><span id="fGear">GEAR</span><span id="fBoost">BOOST</span><span id="fOD">超巡</span><span id="fLand">LANDED</span></div>
</div>
<div id="hitmark"></div>
<div id="tgtMark"><div id="tgtLabel"></div></div>
<div id="interact"></div>
<div id="title">
  <div id="titleBox"><h1>STAR ROAMER</h1><div class="zh">星 际 漫 游</div><div class="rule"></div></div>
  <div id="titleMenu">
    <button class="mi" id="tContinue">继续游戏</button>
    <button class="mi" id="tNew">新的旅程</button>
    <div id="titleConfirm">将清除现有存档，确定重新开始？ <button id="tYes">确定</button><button id="tNo">取消</button></div>
    <button class="mi" id="tHelp">操作说明</button>
  </div>
  <div id="titleMeta"></div>
</div>
<div id="help" class="pane"></div>
<div id="craft" class="pane"><h2>合成 / 升级工作台 <span style="font-size:12px;color:#8ab0d0">（C 或 Esc 关闭）</span></h2><div id="craftBody"></div></div>
<div id="map"><canvas id="mapCv"></canvas>
  <div id="mapTitle">银河星图</div>
  <div id="mapInfo" class="pane"></div>
  <div id="mapLegend" class="pane" style="position:absolute;left:24px;bottom:44px;padding:7px 14px;font-size:12px">
    <span style="color:#ffd27a">◉ ⌂ 殖民星球</span> ｜ <span style="color:#5a9ac0">● 非殖民</span> ｜ <span style="color:#8fd0b8">绿名 = 已探索</span> ｜ <span style="color:#ffb03a">◎ 当前目标</span>
  </div>
  <div id="mapHint">左键点选目标 ｜ 按住左键拖动平移 ｜ 滚轮缩放 ｜ 右键/空白 返回 ｜ J 迁跃 ｜ T 传送 ｜ M/Esc 关闭</div>
</div>`;
    document.body.appendChild(root);
    this.$=id=>document.getElementById(id);
    this.buildHelp();
    const cv=this.$('mapCv');
    /* 长按左键拖动平移；短按(位移<6px)视为点选 */
    cv.addEventListener('mousedown',e=>{
      if(e.button!==0)return;
      this._panDown=true;this._dragging=false;
      this._downX=e.clientX;this._downY=e.clientY;
    });
    cv.addEventListener('mousemove',e=>{
      if(!this._panDown)return;
      if(!this._dragging&&Math.hypot(e.clientX-this._downX,e.clientY-this._downY)>6)this._dragging=true;
      if(this._dragging){this.mapPanX+=e.movementX;this.mapPanY+=e.movementY}
    });
    addEventListener('mouseup',e=>{
      if(e.button!==0||!this._panDown)return;
      if(!this._dragging&&this.mapOpen)this.mapClick(e);
      this._panDown=false;this._dragging=false;
    });
    cv.addEventListener('contextmenu',e=>{e.preventDefault();if(this.mapView==='system'){this.mapView='galaxy';this.mapPanX=this.mapPanY=0;AudioSys.ev('ui')}});
  },
  buildHelp(){
    this.$('help').innerHTML=`
<h2>星际漫游 · Star Roamer — 操作与玩法</h2>
<div style="color:#8ab0d0">1000 颗程序化星球 ｜ 直接飞行抵达 ｜ 无缝起降 ｜ 迁跃与传送</div>
<h3>通用</h3><table>
<tr><td><kbd>H</kbd></td><td>打开/关闭本帮助</td><td><kbd>M</kbd></td><td>银河星图（选择迁跃/传送目标）</td></tr>
<tr><td><kbd>J</kbd></td><td>迁跃至目标（曲率引擎，需在船上）</td><td><kbd>T</kbd></td><td>传送：船上→目标轨道 ｜ 步行→回船旁</td></tr>
<tr><td><kbd>B</kbd></td><td>切换电台（3个合成器频道）</td><td><kbd>-</kbd> / <kbd>=</kbd></td><td>音量减/加</td></tr>
<tr><td><kbd>N</kbd></td><td>时间加速（日夜快进）</td><td><kbd>1</kbd>/<kbd>2</kbd></td><td>座舱/第三人称切换 ｜ 镜头档位</td></tr>
<tr><td>鼠标滚轮</td><td>调节镜头距离（飞船/漫游车）</td><td><kbd>Esc</kbd></td><td>释放鼠标 / 关闭面板</td></tr>
<tr><td>点击画面</td><td>锁定鼠标进入操控</td><td></td><td></td></tr></table>
<h3>飞船（太空/大气内通用，无缝）</h3><table>
<tr><td>鼠标</td><td>俯仰/偏航（跟随鼠标方向）</td><td><kbd>Q</kbd>/<kbd>E</kbd></td><td>左/右滚转</td></tr>
<tr><td><kbd>W</kbd>/<kbd>S</kbd></td><td>油门加/减（S可倒车）</td><td><kbd>A</kbd>/<kbd>D</kbd></td><td>左右平移</td></tr>
<tr><td><kbd>R</kbd>/<kbd>F</kbd></td><td>上升/下降推进器</td><td><kbd>Shift</kbd></td><td>加力（4倍速）</td></tr>
<tr><td><kbd>Space</kbd>按住</td><td>超巡引擎（26倍速，锁定姿态）</td><td><kbd>X</kbd></td><td>刹停</td></tr>
<tr><td><kbd>G</kbd></td><td>起落架收/放</td><td></td><td></td></tr>
<tr><td colspan="4" style="color:#8fd0b8">着陆：放下起落架，低空减速至 6m/s 以下贴地即自动着陆。低空有悬停辅助与自动扶正。</td></tr></table>
<h3>着陆后 / 步行</h3><table>
<tr><td><kbd>F</kbd></td><td>下船/上船、上下漫游车（就近交互）</td><td><kbd>V</kbd></td><td>部署/收回漫游车（船旁）</td></tr>
<tr><td><kbd>WASD</kbd></td><td>移动</td><td><kbd>Shift</kbd></td><td>奔跑</td></tr>
<tr><td><kbd>Space</kbd></td><td>跳跃</td><td>左键</td><td>射击/采矿（弹匣999发）</td></tr>
<tr><td><kbd>R</kbd></td><td>换弹</td><td></td><td>打空自动换弹</td></tr>
<tr><td><kbd>C</kbd></td><td>合成/升级工作台（随时可开）</td><td><kbd>Q</kbd></td><td>使用医疗包 +50 生命</td></tr></table>
<h3>资源与合成</h3>
<div style="margin:2px 0 6px 0">射击矿石/草药即可采集入背包。C 键工作台消耗资源+信用点升级：枪械伤害/射速/采集效率/生命上限/船体上限/超巡速度；3 草药可合成 1 个医疗包。</div>
<table>
<tr><td>草药</td><td>温带/森林/海洋</td><td>铁矿石</td><td>岩石/沙漠/苔原（灰岩+锈脉）</td></tr>
<tr><td>铝矿·银矿</td><td>岩石/苔原/沙漠（亮金属板）</td><td>水晶</td><td>冰封/岩石/剧毒</td></tr>
<tr><td>黄金</td><td>沙漠/熔岩（金脉）</td><td>钻石</td><td>冰封（蓝白晶锥·稀有）</td></tr>
<tr><td>铀矿</td><td>剧毒/熔岩（绿色发光·稀有）</td><td></td><td></td></tr></table>
<h3>野兽</h3>
<div>野外有外星野兽巡游（剧毒/熔岩/岩石星球更多），靠近 25m 会被追击近战。被击倒会传送回飞船旁并扣 10% 信用点。击杀掉落信用点与资源。殖民地周围 380m 是安全区，上车/上船即脱战。</div>
<h3>漫游车</h3><table>
<tr><td><kbd>W</kbd>/<kbd>S</kbd></td><td>前进/倒车</td><td><kbd>A</kbd>/<kbd>D</kbd></td><td>左/右转向</td></tr>
<tr><td>鼠标</td><td>环视镜头（不影响行驶方向）</td><td>滚轮</td><td>镜头距离</td></tr>
<tr><td><kbd>Shift</kbd></td><td>加速档</td><td><kbd>Space</kbd></td><td>手刹 ｜ <kbd>F</kbd> 下车</td></tr></table>
<h3>星图（M）</h3><table>
<tr><td>左键点选</td><td>选择星系/目标星球</td><td>按住左键拖动</td><td>平移视图看画面外星球</td></tr>
<tr><td>滚轮</td><td>缩放</td><td>金色 ⌂</td><td>殖民星球标记</td></tr></table>
<h3>玩法目标</h3>
<div>· 探索 1000 颗星球：每颗首次着陆奖励信用点；生态（森林/海洋/沙漠/冰原/剧毒/熔岩/气态…）各不相同<br>
· 寻找生态奇观：参天巨树、天然石拱、远古方尖碑、巨型水晶、活火山、荒原石阵……<br>
· 采矿赚钱：射击岩石/发光水晶获得矿石与信用点；殖民地星球有起降坪、街道与霓虹建筑群<br>
· 昼夜与天气光照实时变化；夜晚殖民地窗灯与路灯自动点亮<br>
· 进度自动保存（位置/信用点/矿石/目标）</div>
<div style="margin-top:12px;color:#8ab0d0">按 <kbd>H</kbd> 关闭</div>`;
  },

  toggleHelp(){this.helpOpen=!this.helpOpen;this.$('help').style.display=this.helpOpen?'block':'none';AudioSys.ev('ui')},
  toggleCraft(force){
    this.craftOpen=force!==undefined?force:!this.craftOpen;
    this.$('craft').style.display=this.craftOpen?'block':'none';
    if(this.craftOpen){
      this.renderCraft();
      document.exitPointerLock&&document.exitPointerLock();
    }
    AudioSys.ev('ui');
  },
  buy(key){upBuy(key);this.renderCraft()},
  showTitle(){
    this.titleOpen=true;
    const el=this.$('title');
    const hasSave=!!localStorage.getItem(SAVE_KEY);
    this.$('tContinue').style.display=hasSave?'block':'none';
    this.$('tNew').textContent=hasSave?'新的旅程':'开始游戏';
    const bt=(document.querySelector('#lockHint span')||{}).textContent||'';
    this.$('titleMeta').innerHTML=bt+'<br>1000 颗星球等待探索';
    this.$('tContinue').onclick=()=>this.closeTitle();
    this.$('tNew').onclick=()=>{
      if(!localStorage.getItem(SAVE_KEY)){this.closeTitle();return}
      this.$('titleConfirm').style.display='block';
    };
    this.$('tYes').onclick=()=>{localStorage.removeItem(SAVE_KEY);Game._noSave=true;location.href=location.pathname};
    this.$('tNo').onclick=()=>{this.$('titleConfirm').style.display='none'};
    this.$('tHelp').onclick=()=>this.toggleHelp();
    document.getElementById('lockHint').style.display='none';
    el.style.display='block';
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('on')));
  },
  closeTitle(){
    this.titleOpen=false;
    const el=this.$('title');
    el.classList.remove('on');
    setTimeout(()=>{el.style.display='none'},1300);
    document.getElementById('lockHint').style.display=Input.locked?'none':'flex';
    AudioSys.ev('ui');
  },
  buyMed(){craftMedkit();this.renderCraft()},
  renderCraft(){
    const rows=Object.entries(UP_DEF).map(([k,u])=>{
      const lv=Game.up[k];
      if(lv>=u.max)return `<tr><td><b>${u.name}</b></td><td>Lv${lv}/${u.max}</td><td>${u.eff}</td><td colspan="2" style="color:#8fd0b8">已满级</td></tr>`;
      const c=u.cost(lv);
      const need=Object.entries(c.res).map(([r,n])=>{
        const ok=(Game.res[r]||0)>=n;
        return `<span style="color:${ok?'#8fd0b8':'#e06a5a'}">${RES_DEF[r].name}×${n}</span>`;
      }).join(' ');
      const crOk=Game.credits>=c.cr;
      return `<tr><td><b>${u.name}</b></td><td>Lv${lv}/${u.max}</td><td>${u.eff}</td>
        <td>${need} <span style="color:${crOk?'#8fd0b8':'#e06a5a'}">${c.cr}cr</span></td>
        <td><button class="cbtn" onclick="UI.buy('${k}')">升级</button></td></tr>`;
    }).join('');
    const herbOk=(Game.res.herb||0)>=3;
    const med=`<tr><td><b>医疗包</b></td><td>${Game.medkits}/5</td><td>Q使用 +50HP</td>
      <td><span style="color:${herbOk?'#8fd0b8':'#e06a5a'}">草药×3</span></td>
      <td><button class="cbtn" onclick="UI.buyMed()">合成</button></td></tr>`;
    const bag=Object.entries(Game.res).map(([k,v])=>RES_DEF[k].name+'×'+v).join('　');
    this.$('craftBody').innerHTML=`<table style="width:100%">${rows}${med}</table>
      <div style="margin-top:12px;color:#8ab0d0;font-size:12px">背包：${bag}　｜　信用点 ${Game.credits}</div>`;
  },
  toggleMap(force){
    this.mapOpen=force!==undefined?force:!this.mapOpen;
    this.$('map').style.display=this.mapOpen?'block':'none';
    if(this.mapOpen){
      const st=Planets.nearestStar(Ship.pos.x,Ship.pos.y,Ship.pos.z);
      this.mapSys=st.id;this.mapView='system';this.mapZoom=1;
      this.mapPanX=this.mapPanY=0;
      document.exitPointerLock&&document.exitPointerLock();
    }
    AudioSys.ev('ui');
  },
  mapClick(e){
    if(e.button===2)return;
    const cv=this.$('mapCv'),r=cv.getBoundingClientRect();
    const mx=e.clientX-r.left,my=e.clientY-r.top;
    if(this.mapView==='galaxy'){
      let best=null,bd=22;
      for(const s of GALAXY.systems){
        const p=this.galProj(s.x,s.z);
        const d=Math.hypot(p.x-mx,p.y-my);
        if(d<bd){bd=d;best=s}
      }
      if(best){this.mapSys=best.id;this.mapView='system';this.mapPanX=this.mapPanY=0;AudioSys.ev('ui')}
    }else{
      const sys=GALAXY.systems[this.mapSys];
      let best=null,bd=26;
      for(const pl of sys.planets){
        const p=this.sysProj(pl,sys);
        const d=Math.hypot(p.x-mx,p.y-my);
        if(d<bd){bd=d;best=pl}
      }
      if(best){Travel.setTarget(best);AudioSys.ev('ui')}
      else{this.mapView='galaxy';this.mapPanX=this.mapPanY=0}
    }
  },
  galProj(x,z){
    const cv=this.$('mapCv');
    const sc=Math.min(cv.width,cv.height)/900000*this.mapZoom;
    return {x:cv.width/2+this.mapPanX+(x-Ship.pos.x)*sc,y:cv.height/2+this.mapPanY+(z-Ship.pos.z)*sc};
  },
  sysProj(pl,sys){
    const cv=this.$('mapCv');
    const maxR=sys.planets[sys.planets.length-1].idx*1+1;
    const sc=Math.min(cv.width,cv.height)*0.42/(5200+sys.planets.length*7000)*this.mapZoom;
    return {x:cv.width/2+this.mapPanX+(pl.x-sys.x)*sc,y:cv.height/2+this.mapPanY+(pl.z-sys.z)*sc};
  },
  drawMap(){
    const cv=this.$('mapCv');
    if(cv.width!==innerWidth)cv.width=innerWidth;
    if(cv.height!==innerHeight)cv.height=innerHeight;
    const g=cv.getContext('2d');
    g.clearRect(0,0,cv.width,cv.height);
    const info=this.$('mapInfo');
    if(this.mapView==='galaxy'){
      this.$('mapTitle').textContent='银河星图 — '+GALAXY.systems.length+' 星系 / 1000 星球（含殖民地的星系带金色标记）';
      info.style.display='none';
      for(const s of GALAXY.systems){
        const p=this.galProj(s.x,s.z);
        if(p.x<-30||p.y<-30||p.x>cv.width+30||p.y>cv.height+30)continue;
        if(s._hasCity===undefined)s._hasCity=s.planets.some(pl=>pl.city);
        g.fillStyle='#'+new THREE.Color(s.color).getHexString();
        g.beginPath();g.arc(p.x,p.y,3.2,0,7);g.fill();
        if(s._hasCity){
          g.strokeStyle='#ffd27a';g.lineWidth=1.2;
          g.beginPath();g.arc(p.x,p.y,5.8,0,7);g.stroke();
          g.fillStyle='#ffd27a';g.font='10px sans-serif';g.fillText('⌂',p.x+7,p.y-5);
        }
        if(this.mapZoom>2.2){g.fillStyle='#6a90b0';g.font='10px Consolas';g.fillText(s.name,p.x+6,p.y+9)}
      }
      const cur=Planets.nearestStar(Ship.pos.x,Ship.pos.y,Ship.pos.z);
      const cp=this.galProj(cur.x,cur.z);
      g.strokeStyle='#7af0ff';g.lineWidth=1.5;
      g.beginPath();g.arc(cp.x,cp.y,9,0,7);g.stroke();
      g.fillStyle='#7af0ff';g.font='11px sans-serif';g.fillText('当前位置',cp.x+12,cp.y-8);
      if(Travel.target){
        const ts=GALAXY.systems[Travel.target.sys];
        const tp=this.galProj(ts.x,ts.z);
        g.strokeStyle='#ffb03a';
        g.beginPath();g.arc(tp.x,tp.y,12,0,7);g.stroke();
      }
    }else{
      const sys=GALAXY.systems[this.mapSys];
      this.$('mapTitle').textContent='星系: '+sys.name+' — '+sys.planets.length+' 颗星球（左键选择目标，空白处返回）';
      const c0={x:cv.width/2+this.mapPanX,y:cv.height/2+this.mapPanY};
      g.fillStyle='#'+new THREE.Color(sys.color).getHexString();
      g.beginPath();g.arc(c0.x,c0.y,10,0,7);g.fill();
      g.strokeStyle='rgba(90,140,190,0.25)';g.lineWidth=1;
      for(const pl of sys.planets){
        const p=this.sysProj(pl,sys);
        const orbR=Math.hypot(p.x-c0.x,p.y-c0.y);
        g.beginPath();g.arc(c0.x,c0.y,orbR,0,7);g.stroke();
      }
      for(const pl of sys.planets){
        const p=this.sysProj(pl,sys);
        const col=new THREE.Color(pl.td.cols[1]);
        g.fillStyle='#'+col.getHexString();
        g.beginPath();g.arc(p.x,p.y,6.5,0,7);g.fill();
        if(pl.rings){g.strokeStyle='#b0a890';g.beginPath();g.ellipse(p.x,p.y,11,4,0.5,0,7);g.stroke()}
        if(pl.city){
          g.strokeStyle='#ffd27a';g.lineWidth=1.8;
          g.beginPath();g.arc(p.x,p.y,9.5,0,7);g.stroke();g.lineWidth=1;
          g.fillStyle='#ffd27a';g.font='12px sans-serif';g.fillText('⌂',p.x-3.5,p.y-13);
        }
        g.fillStyle=pl.city?'#ffd27a':Game.visited[pl.id]?'#8fd0b8':'#5a7a95';g.font='11px sans-serif';
        g.fillText(pl.name+(pl.city?' ⌂'+pl.cityName:''),p.x+12,p.y+4);
        if(Travel.target===pl){
          g.strokeStyle='#ffb03a';g.lineWidth=2;
          g.beginPath();g.arc(p.x,p.y,13,0,7);g.stroke();g.lineWidth=1;
        }
      }
      const t=Travel.target;
      if(t){
        info.style.display='block';
        const dx=t.x-Ship.pos.x,dy=t.y-Ship.pos.y,dz=t.z-Ship.pos.z;
        const dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
        const tn={lava:'熔岩',desert:'沙漠',rock:'岩石',temperate:'温带',forest:'森林',ocean:'海洋',tundra:'苔原',ice:'冰封',toxic:'剧毒',gas:'气态'}[t.type];
        info.innerHTML=`<h3>${t.name}</h3>
类型: ${tn} ｜ 半径: ${t.radius|0} m<br>重力: ${t.grav.toFixed(1)} m/s² ｜ 大气层: ${t.atmo|0} m<br>
${t.city?'⌂ 殖民地: '+t.cityName+'<br>':''}${t.rings?'◎ 行星环<br>':''}
${Game.visited[t.id]?'✓ 已探索':'未探索（首次着陆有奖励）'}<br>距离: ${dist>1e6?(dist/1e6).toFixed(2)+' Mm':(dist/1000).toFixed(1)+' km'}<br>
<span style="color:#ffd27a">J 迁跃 ｜ T 传送</span>`;
      }else info.style.display='none';
    }
  },

  hitmark(){const h=this.$('hitmark');h.style.transition='none';h.style.opacity=1;requestAnimationFrame(()=>{h.style.transition='opacity .3s';h.style.opacity=0})},

  drawMinimap(){
    const cv=this.$('minimap'),g=cv.getContext('2d');
    const W=cv.width,H=cv.height,cx=W/2,cy=H/2;
    g.clearRect(0,0,W,H);
    g.save();g.beginPath();g.arc(cx,cy,W/2-1,0,7);g.clip();
    g.fillStyle='rgba(8,18,30,0.85)';g.fillRect(0,0,W,H);
    const mode=Game.mode;
    if(mode==='ship'&&Planets.curAlt>2000||!Planets.current){
      const st=Planets.curStar;if(!st){g.restore();return}
      const range=Math.max(30000,st.planets.length*11000);
      const sc=(W/2-8)/range;
      const b=Ship.basis();
      const fwd2=Math.atan2(b.f.x,b.f.z);
      const rot=a=>({x:Math.sin(a),y:Math.cos(a)});
      const put=(wx,wz,col,r)=>{
        const dx=wx-Ship.pos.x,dz=wz-Ship.pos.z;
        const a=Math.atan2(dx,dz)-fwd2;
        const d=Math.min(Math.hypot(dx,dz)*sc,W/2-6);
        g.fillStyle=col;g.beginPath();g.arc(cx+Math.sin(a)*d,cy-Math.cos(a)*d,r,0,7);g.fill();
      };
      put(st.x,st.z,'#ffd27a',5);
      for(const pl of st.planets)put(pl.x,pl.z,Travel.target===pl?'#ffb03a':'#5a9ac0',3);
    }else{
      const pl=Planets.current;
      const range=420,sc=(W/2-8)/range;
      const me=mode==='rover'?Rover.pos:mode==='foot'?Player.pos:Ship.pos;
      const yaw=mode==='rover'?Rover.yaw:mode==='foot'?Player.yaw:0;
      let fr,up2;
      if(mode==='foot'){fr=Player.frame;up2=Player.up}
      else if(mode==='rover'){fr=Rover.frame;up2=Rover.up}
      else{_v1.set(me.x-pl.x,me.y-pl.y,me.z-pl.z).normalize();up2=_v1.clone();fr={east:new THREE.Vector3(),north:new THREE.Vector3()};tangentFrame(up2,fr)}
      const put=(w,col,r,shape)=>{
        const dx=w.x-me.x,dy=w.y-me.y,dz=w.z-me.z;
        const lx=dx*fr.east.x+dy*fr.east.y+dz*fr.east.z;
        const lz=dx*fr.north.x+dy*fr.north.y+dz*fr.north.z;
        const a=Math.atan2(lx,lz)-yaw;
        const d=Math.min(Math.hypot(lx,lz)*sc,W/2-6);
        const px=cx+Math.sin(a)*d,py=cy-Math.cos(a)*d;
        g.fillStyle=col;
        if(shape==='sq')g.fillRect(px-r,py-r,r*2,r*2);
        else{g.beginPath();g.arc(px,py,r,0,7);g.fill()}
      };
      for(const mn of Planets.mineables)if(!mn.dead)put(mn.world,'#c8a2ff',2);
      for(const en of Enemies.list)if(en.state!=='dead')put(en.pos,'#ff5a4a',2.5);
      if(pl.city&&pl.cityDir){put(cityPadWorld(pl),'#ffd27a',4,'sq')}
      put(Ship.pos,'#7af0ff',4,'sq');
      if(Rover.deployed)put(Rover.pos,'#8fd0b8',3,'sq');
    }
    g.fillStyle='#e8f4ff';
    g.beginPath();g.moveTo(cx,cy-6);g.lineTo(cx-4,cy+5);g.lineTo(cx+4,cy+5);g.closePath();g.fill();
    g.restore();
    g.strokeStyle='rgba(122,200,255,0.5)';g.beginPath();g.arc(cx,cy,W/2-1,0,7);g.stroke();
    g.fillStyle='#8ab0d0';g.font='9px sans-serif';g.fillText('N',cx-3,10);
  },

  update(dt,camera){
    const spd=Game.mode==='rover'?Math.abs(Rover.vel):Ship.speed;
    this.$('spd').textContent=spd<10?spd.toFixed(1):spd|0;
    this.$('thrBar').style.width=(clamp(Math.abs(Ship.throttle),0,1)*100)+'%';
    this.$('hullTxt').textContent=Game.hull|0;
    this.$('hullBar').style.width=(Game.hull/Game.hullMax*100)+'%';
    const hpShow=Game.mode==='foot'||Game.mode==='rover';
    this.$('hpRow').style.display=hpShow?'block':'none';
    if(hpShow){
      this.$('hpTxt').textContent=(Game.hp|0)+'/'+Game.hpMax;
      this.$('hpBar').style.width=Math.max(0,Game.hp/Game.hpMax*100)+'%';
    }
    this.$('credits').textContent=Game.credits;
    this.$('ore').textContent=Game.medkits;
    const bag=Object.entries(Game.res).filter(([k,v])=>v>0).map(([k,v])=>RES_DEF[k].name+'×'+v).join(' ');
    this.$('bagLine').textContent=bag||'背包空 · 射击矿石/草药采集';
    const modeNames={ship:'飞行',landed:'已着陆',foot:'步行',rover:'漫游车'};
    let modeLine=modeNames[Game.mode];
    if(Game.mode==='ship'){
      modeLine+=Ship.od?' · 超巡':Ship.boost?' · 加力':'';
      modeLine+=Ship.gear?' · 起落架↓':'';
    }
    if(Game.warp)modeLine=Game.warp.t<Game.warp.charge?'迁跃充能 '+((Game.warp.t/Game.warp.charge*100)|0)+'%':'迁跃中…';
    this.$('modeTxt').textContent=modeLine;
    /* 弹药 */
    const al=this.$('ammoLine');
    if(Game.mode==='foot'){
      al.style.display='block';
      this.$('ammo').textContent=Weapons.reloadT>0?'换弹中…':Weapons.mag+'/'+Weapons.magSize;
    }else al.style.display='none';
    /* 座舱 HUD（1键第一人称） */
    const fp=(Game.mode==='ship'||Game.mode==='landed')&&Cam.firstPerson;
    const ch=this.$('chud');
    if((ch.style.display==='block')!==fp){
      ch.style.display=fp?'block':'none';
      this.$('crosshair').style.display=fp?'none':'';
    }
    if(fp){
      this.$('chSpd').textContent=Ship.speed<1000?(Ship.speed|0):(Ship.speed/1000).toFixed(2)+'k';
      this.$('chThr').style.width=(clamp(Math.abs(Ship.throttle),0,1)*100).toFixed(0)+'%';
      this.$('chAlt').textContent=Ship.alt<1e8?(Ship.alt<10000?(Ship.alt|0)+'m':(Ship.alt/1000).toFixed(1)+'km'):'--';
      this.$('chHull').style.width=Game.hull+'%';
      const t=Travel.target;
      let ts='目标: 无 ｜ M 打开星图选择';
      if(t){
        const d=Math.sqrt((t.x-Ship.pos.x)**2+(t.y-Ship.pos.y)**2+(t.z-Ship.pos.z)**2);
        ts='目标: '+t.name+' · '+(d>1e6?(d/1e6).toFixed(2)+' Mm':(d/1000).toFixed(0)+' km')+' ｜ J 迁跃 · T 传送';
      }
      this.$('chudTgt').textContent=ts;
      this.$('fGear').className=Ship.gear?'on':'off';
      this.$('fBoost').className=Ship.boost?'on':'off';
      this.$('fOD').className=Ship.od?'on':'off';
      this.$('fLand').className=Game.mode==='landed'?'on':'off';
    }
    const pl=Planets.current;
    const st=Planets.curStar;
    let loc='深空';
    if(st)loc='<span style="color:#8ab0d0">'+st.name+' 星系</span>';
    if(pl){
      const tn={lava:'熔岩',desert:'沙漠',rock:'岩石',temperate:'温带',forest:'森林',ocean:'海洋',tundra:'苔原',ice:'冰封',toxic:'剧毒',gas:'气态'}[pl.type];
      loc+=' ｜ <b>'+pl.name+'</b> ('+tn+(pl.city?'·殖民地':'')+')';
      if(Game.mode==='ship')loc+=' ｜ 高度 '+(Ship.alt<10000?(Ship.alt|0)+' m':(Ship.alt/1000).toFixed(1)+' km');
    }
    if(Travel.target){
      const t=Travel.target;
      const d=Math.sqrt((t.x-Ship.pos.x)**2+(t.y-Ship.pos.y)**2+(t.z-Ship.pos.z)**2);
      loc+=' ｜ <span style="color:#ffb03a">目标 '+t.name+' '+(d>1e6?(d/1e6).toFixed(2)+' Mm':(d/1000).toFixed(0)+' km')+'</span>';
    }
    this.$('locLine').innerHTML=loc;
    this.$('coords').innerHTML='X '+(Ship.pos.x/1000).toFixed(1)+'k｜Y '+(Ship.pos.y/1000).toFixed(1)+'k｜Z '+(Ship.pos.z/1000).toFixed(1)+'k<br>'+
      'FPS '+(Game.fps|0)+' ｜ 已探索 '+Object.keys(Game.visited).length+'/1000';
    /* 消息 */
    if(Game.msgT>0){Game.msgT-=dt;this.$('msg').textContent=Game.msg;this.$('msg').style.opacity=Game.msgT>0.4?1:Game.msgT/0.4}
    else this.$('msg').style.opacity=0;
    /* 反馈 */
    Game.dmgFlash=Math.max(0,Game.dmgFlash-dt*1.6);
    this.$('dmg').style.opacity=Game.dmgFlash*0.9+(Game.hull<30?0.25+Math.sin(performance.now()*0.006)*0.1:0);
    Game.tp=Math.max(0,Game.tp-dt*2.4);
    this.$('flash').style.opacity=Game.tp*0.85;
    if(Game.hitFlash>0){this.hitmark();Game.hitFlash=0}
    /* 目标屏幕标记 */
    const tm=this.$('tgtMark');
    if(Travel.target&&!this.mapOpen){
      const t=Travel.target;
      _v1.set(t.x-ORIGIN.x,t.y-ORIGIN.y,t.z-ORIGIN.z).project(camera);
      if(_v1.z<1&&Math.abs(_v1.x)<1.1&&Math.abs(_v1.y)<1.1){
        tm.style.display='block';
        tm.style.left=((_v1.x*0.5+0.5)*innerWidth)+'px';
        tm.style.top=((-_v1.y*0.5+0.5)*innerHeight)+'px';
        this.$('tgtLabel').textContent=Travel.target.name;
      }else tm.style.display='none';
    }else tm.style.display='none';
    /* 交互提示 */
    const it=this.$('interact');
    let hint='';
    if(Game.mode==='foot'){
      const dShip=Math.sqrt((Ship.pos.x-Player.pos.x)**2+(Ship.pos.y-Player.pos.y)**2+(Ship.pos.z-Player.pos.z)**2);
      const dRover=Rover.deployed?Math.sqrt((Rover.pos.x-Player.pos.x)**2+(Rover.pos.y-Player.pos.y)**2+(Rover.pos.z-Player.pos.z)**2):1e9;
      if(dRover<5)hint='F 驾驶漫游车';
      else if(dShip<8)hint='F 登上飞船'+(Rover.deployed?'':' ｜ V 部署漫游车');
      const mn=Planets.mineAt(Player.pos,4);
      if(mn)hint+=(hint?' ｜ ':'')+'左键射击采矿';
    }else if(Game.mode==='landed')hint='F 下船 ｜ W 起飞';
    else if(Game.mode==='rover')hint='F 下车';
    it.style.display=hint?'block':'none';it.textContent=hint;
    this.drawMinimap();
    if(this.mapOpen)this.drawMap();
    /* 地图/帮助开放时隐藏中央UI件，避免遮挡 */
    const hu=UI.mapOpen||UI.helpOpen;
    this.$('crosshair').style.display=hu?'none':(Game.mode==='foot'||Game.mode==='ship'&&!Ship.landed)?'block':'none';
    this.$('msg').style.opacity=hu?'0':this.$('msg').style.opacity;
    this.$('interact').style.display=hu?'none':this.$('interact').style.display;
    this.$('topbar').style.display=hu?'none':'block';
    this.$('coords').style.display=hu?'none':'block';
  }
};