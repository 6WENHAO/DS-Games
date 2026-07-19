/* ============================================================
   STARFORGE - net.js
   局域网联机：WebSocket 中继（运行「启动联机主机.bat」即开服）
   直接输主机 IP 进房间；同步：世界种子/方块/机器/玩家位置
   ============================================================ */
'use strict';

const Net = (() => {
  const WS_PORT = 17889;
  let ws = null;
  let role = null;              // null | 'host' | 'guest'
  let myId = 0;                 // 服务器分配
  let connected = false;
  let applyingRemote = false;   // 应用远程操作时不回播
  let patched = false;
  let posTimer = 0;
  const remotes = new Map();    // id -> {group, ship, body, tag, planet, st, pos, tgt, yaw, tyaw, inScene, last}
  const pendingBlk = {};        // planetId -> [msg]
  const pendingMac = {};        // planetId -> [msg]

  // ---------- 连接 / 房间 ----------
  function defaultAddr(){
    return (location.protocol === 'http:' || location.protocol === 'https:') ? location.hostname : 'localhost';
  }
  function connect(addr){
    return new Promise((res, rej) => {
      disconnect();
      const url = 'ws://' + (addr || defaultAddr()) + ':' + WS_PORT;
      let settled = false;
      try { ws = new WebSocket(url); }
      catch(e){ return rej(new Error('地址无效')); }
      const to = setTimeout(() => {
        if (!settled){ settled = true; try { ws.close(); } catch(e){} rej(new Error('连接超时，请确认主机已运行「启动联机主机.bat」')); }
      }, 6000);
      ws.onmessage = e => {
        let m;
        try { m = JSON.parse(e.data); } catch(err){ return; }
        if (m.t === 'ws-id' && !connected){
          myId = m.id;
          connected = true;
          clearTimeout(to);
          ensurePatched();
          onStatus();
          if (!settled){ settled = true; res(myId); }
          return;
        }
        onMsg(m);
      };
      ws.onclose = () => {
        connected = false;
        role = null;
        clearRemotes();
        onStatus();
        if (!settled){ settled = true; clearTimeout(to); rej(new Error('连接被拒绝，请确认主机已运行「启动联机主机.bat」')); }
      };
      ws.onerror = () => {};
    });
  }
  async function hostRoom(addr){
    await connect(addr);
    role = 'host';
    onStatus();
  }
  async function joinRoom(addr){
    await connect(addr);
    role = 'guest';
    broadcast({ t: 'need-init', id: myId });
    onStatus();
  }
  function disconnect(){
    if (ws){ try { ws.onclose = null; ws.close(); } catch(e){} }
    ws = null;
    connected = false;
    role = null;
    clearRemotes();
  }
  function broadcast(msg){
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }
  function active(){ return connected; }
  function status(){
    if (!connected) return '未连接';
    const n = remotes.size;
    return (role === 'host' ? '主机' : '成员') + ' P' + myId + (n ? ` · 同行 ${n} 人` : ' · 等待队友…');
  }
  let onStatus = () => {};

  // ---------- 世界就绪 / 初始化包 ----------
  function gameReady(){
    return window.Game && (Game.state === 'planet' || Game.state === 'space' || Game.state === 'atmo' || Game.state === 'seated');
  }
  function buildInit(to){
    return {
      t: 'init', id: myId, to,
      seed: World.seed,
      planet: Game.currentPlanet,
      dayTime: Game.dayTime,
      creative: Game.creative,
      dropMult: Game.dropMult,
      galaxySeed: Space.getCurrentGalaxySeed(),
      mods: World.serialize().mods,
      machines: Factory.serialize(),
    };
  }
  // 主机世界就绪后（新游戏/读档完成）向所有成员广播
  function onWorldReady(){
    if (role === 'host' && connected) broadcast(buildInit());
  }

  // ---------- 消息处理 ----------
  function onMsg(m){
    switch (m.t){
      case 'need-init':
        if (role === 'host' && gameReady()) broadcast(buildInit(m.id));
        break;
      case 'init':
        if (role === 'guest' && (m.to === undefined || m.to === myId) && window.Game) Game.joinGame(m);
        break;
      case 'pos': onPos(m); break;
      case 'blk': onBlk(m); break;
      case 'mac': onMac(m); break;
      case 'left': removeRemote(m.id); onStatus(); break;
    }
  }
  function onBlk(m){
    if (m.id === myId) return;
    if (gameReady() && Game.currentPlanet === m.planet){
      applyingRemote = true;
      World.set(m.x, m.y, m.z, m.b);
      applyingRemote = false;
    } else {
      (pendingBlk[m.planet] = pendingBlk[m.planet] || []).push(m);
    }
  }
  function onMac(m){
    if (m.id === myId) return;
    if (gameReady() && Game.currentPlanet === m.planet){
      applyingRemote = true;
      if (m.op === 'add') Factory.place(m.x, m.y, m.z, m.bk, m.dir);
      else Factory.remove(m.x, m.y, m.z);
      applyingRemote = false;
    } else {
      (pendingMac[m.planet] = pendingMac[m.planet] || []).push(m);
    }
  }
  function drainPending(){
    if (!gameReady()) return;
    const pid = Game.currentPlanet;
    applyingRemote = true;
    if (pendingBlk[pid]){ for (const m of pendingBlk[pid]) World.set(m.x, m.y, m.z, m.b); delete pendingBlk[pid]; }
    if (pendingMac[pid]){
      for (const m of pendingMac[pid]){
        if (m.op === 'add') Factory.place(m.x, m.y, m.z, m.bk, m.dir);
        else Factory.remove(m.x, m.y, m.z);
      }
      delete pendingMac[pid];
    }
    applyingRemote = false;
  }

  // ---------- 本地操作钩子（广播方块/机器变更） ----------
  function ensurePatched(){
    if (patched) return;
    patched = true;
    const worldSet = World.set;
    World.set = function(x, y, z, id){
      worldSet(x, y, z, id);
      if (active() && !applyingRemote && gameReady())
        broadcast({ t: 'blk', id: myId, planet: Game.currentPlanet, x, y, z, b: id });
    };
    const facPlace = Factory.place;
    Factory.place = function(x, y, z, bk, dir){
      const r = facPlace(x, y, z, bk, dir);
      if (active() && !applyingRemote && gameReady())
        broadcast({ t: 'mac', id: myId, planet: Game.currentPlanet, op: 'add', x, y, z, bk, dir });
      return r;
    };
    const facRemove = Factory.remove;
    Factory.remove = function(x, y, z){
      const r = facRemove(x, y, z);
      if (active() && !applyingRemote && gameReady())
        broadcast({ t: 'mac', id: myId, planet: Game.currentPlanet, op: 'remove', x, y, z });
      return r;
    };
  }

  // ---------- 远程玩家化身 ----------
  function buildAvatar(id){
    const g = new THREE.Group();
    const suit = new THREE.MeshLambertMaterial({ color: 0x3fa8c9 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1d3a52 });
    const visor = new THREE.MeshLambertMaterial({ color: 0xffb347, emissive: 0x664411 });
    const B = (w, h, d, m, x, y, z) => { const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mm.position.set(x, y, z); g.add(mm); return mm; };
    B(0.5, 0.62, 0.3, suit, 0, 0.62, 0);        // 躯干
    B(0.42, 0.4, 0.4, suit, 0, 1.18, 0);        // 头盔
    B(0.3, 0.14, 0.02, visor, 0, 1.2, -0.21);   // 面罩
    B(0.16, 0.5, 0.2, dark, -0.14, 0.15, 0);    // 腿
    B(0.16, 0.5, 0.2, dark, 0.14, 0.15, 0);
    B(0.3, 0.4, 0.16, dark, 0, 0.72, 0.24);     // 喷气背包
    const body = g.children.slice();
    // 名牌
    const c = document.createElement('canvas'); c.width = 128; c.height = 32;
    const x = c.getContext('2d');
    x.font = 'bold 20px Consolas'; x.textAlign = 'center';
    x.fillStyle = '#35e0e8'; x.fillText('P' + id, 64, 22);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    tag.scale.set(2.4, 0.6, 1);
    tag.position.y = 1.8;
    g.add(tag);
    // 小飞船（大气/太空态显示）
    const ship = new THREE.Group();
    const hull = new THREE.MeshLambertMaterial({ color: 0x9ab6c9 });
    const S = (w, h, d, x2, y2, z2) => { const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hull); mm.position.set(x2, y2, z2); ship.add(mm); };
    S(1.4, 0.9, 3.6, 0, 0, 0); S(2.6, 0.16, 1.4, -1.9, 0, 0.7); S(2.6, 0.16, 1.4, 1.9, 0, 0.7);
    ship.visible = false;
    g.add(ship);
    return { group: g, ship, body, tag };
  }
  function ensureRemote(id){
    let r = remotes.get(id);
    if (!r){
      const a = buildAvatar(id);
      r = { ...a, planet: -1, st: '', pos: new THREE.Vector3(), tgt: new THREE.Vector3(), yaw: 0, tyaw: 0, inScene: null, last: 0 };
      remotes.set(id, r);
      onStatus();
    }
    return r;
  }
  function removeRemote(id){
    const r = remotes.get(id);
    if (r && r.inScene) r.inScene.remove(r.group);
    remotes.delete(id);
  }
  function clearRemotes(){
    for (const id of [...remotes.keys()]) removeRemote(id);
  }
  function onPos(m){
    if (m.id === myId) return;
    const r = ensureRemote(m.id);
    r.planet = m.planet;
    r.st = m.st;
    r.tgt.fromArray(m.p);
    r.tyaw = m.yaw;
    if (!r.last || performance.now() - r.last > 2000) r.pos.copy(r.tgt);   // 首包/久断直接落位
    r.last = performance.now();
  }

  // ---------- 每帧：发送本机位置 + 更新化身 ----------
  function myPosMsg(){
    const st = Game.state;
    let p, yaw;
    if (st === 'space'){ p = Space.shipState.pos.toArray(); yaw = Space.shipState.yaw; }
    else if (st === 'atmo' || st === 'atmoland' || st === 'seated' || st === 'launching'){ p = Game.shipPos.toArray(); yaw = Game.atmo.yaw; }
    else { p = Player.pos.toArray(); yaw = Player.yaw; }
    return { t: 'pos', id: myId, planet: Game.currentPlanet, st, p, yaw };
  }
  function tick(dt){
    if (!active() || !window.Game) return;
    drainPending();
    if (gameReady()){
      posTimer += dt;
      if (posTimer > 0.1){ posTimer = 0; broadcast(myPosMsg()); }
    }
    const now = performance.now();
    for (const [id, r] of remotes){
      // 场景归属：同星球地面态 → planetScene；太空态 → Space.scene
      const myState = Game.state;
      let scene = null, showShip = false;
      if ((myState === 'planet' || myState === 'seated' || myState === 'atmo' || myState === 'atmoland') && r.planet === Game.currentPlanet){
        if (r.st === 'planet' || r.st === 'seated') scene = Game.planetScene;
        else if (r.st === 'atmo' || r.st === 'atmoland' || r.st === 'launching'){ scene = Game.planetScene; showShip = true; }
      } else if (myState === 'space' && r.st === 'space'){
        scene = Space.scene; showShip = true;
      }
      if (r.inScene !== scene){
        if (r.inScene) r.inScene.remove(r.group);
        if (scene) scene.add(r.group);
        r.inScene = scene;
      }
      if (!scene) continue;
      r.ship.visible = showShip;
      r.body.forEach(o => { if (o !== r.tag) o.visible = !showShip; });
      r.pos.lerp(r.tgt, Math.min(1, dt * 8));
      let dy = r.tyaw - r.yaw;
      dy = ((dy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      r.yaw += dy * Math.min(1, dt * 8);
      r.group.position.copy(r.pos);
      if (r.st === 'planet' || r.st === 'seated') r.group.position.y -= 1.4;   // Player.pos 是眼睛高度
      r.group.rotation.y = r.yaw + Math.PI;
      // 超时：8秒无包隐藏
      r.group.visible = now - r.last <= 8000;
    }
  }
  // 供 HUD 标记使用：远程玩家列表（插值后的位置）
  function getRemotes(){
    const out = [];
    const now = performance.now();
    for (const [id, r] of remotes){
      if (now - r.last > 8000) continue;
      out.push({ id, planet: r.planet, st: r.st, pos: r.pos });
    }
    return out;
  }

  return {
    hostRoom, joinRoom, disconnect, tick, onWorldReady, getRemotes, defaultAddr,
    get role(){ return role; },
    get myId(){ return myId; },
    active, status,
    set statusChanged(fn){ onStatus = fn || (() => {}); },
  };
})();
window.Net = Net;
