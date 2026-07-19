/* ============================================================
   STARFORGE - station.js
   空间站流程（独立自洽模块·重制版）：
   泊入动画 → 停机位 → E 下船站内行走 → 站员对话/交易终端 → W 离站动画
   设计原则：单一状态 'station'，主循环只调 Station.update()；
   相机/移动/交互/对话全部在本模块内完成，不依赖外部状态分发。
   ============================================================ */
'use strict';

const Station = (() => {
  let phase = null;            // 'dock' | 'drop' | 'parked' | 'walk' | 'lift' | 'leave'
  let t = 0;
  let curve = null;            // 泊入/离站飞行曲线
  let pad = null, padYaw = 0;
  let walk = null;             // {pos:Vector3, yaw, pitch, boardCd}
  let near = null;             // 'ship' | 'terminal' | {staff}
  let dlg = null;              // 站内对话 {name, lines, idx, chars}
  let orbitT = 0;
  let exitData = null;
  let onDocked = null;         // 泊入完成回调（main 挂接任务/音乐）
  let onBuyShip = null;        // 购船回调（main 执行信用点扣款/仓库流转），返回 true 表示成交
  let onGarage = null;         // 换船电脑回调（main 打开飞船仓库面板）
  let buyArm = null;           // 两步购买：{v, t} 二次确认窗口

  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const el = id => document.getElementById(id);

  // ---------- 进入检测（太空态每帧调用；接管则返回 true）----------
  let shieldWarnCd = 0;
  function tryBegin(){
    const dk = Space.getDock();
    if (!dk) return false;
    _v1.copy(Space.shipState.pos).sub(dk.origin);
    const inBay  = Math.abs(_v1.x) < 30 && _v1.y > 0 && _v1.y < 30 && _v1.z > -12 && _v1.z < 76;
    const inGate = Math.abs(_v1.x) < 12 && _v1.y > 3 && _v1.y < 17 && _v1.z > 82 && _v1.z < 100;
    if (!inBay && !inGate) return false;
    // 防护盾激活期间禁止泊入（门口引导光已变红警示）
    if (Space.stationShieldUp){
      shieldWarnCd -= 0.016;
      if (shieldWarnCd <= 0){
        shieldWarnCd = 2.5;
        UI.bigMessage('⛔ 泊入请求被拒绝', '空间站防护盾激活中——停止攻击 10 秒后恢复准入', 2200);
        Sound.play('uiError');
      }
      return false;
    }
    phase = 'dock'; t = 0;
    orbitT = 0; dlg = null; walk = null; near = null; exitData = null;
    // 泊入即收编输入焦点：任何残留聚焦的文本框都会吞掉键盘（WASD/E 全哑）——这里强制释放
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    pad = dk.padPos.clone(); padYaw = dk.padYaw;
    const p0 = Space.shipState.pos.clone();
    const over = pad.clone(); over.y += 7;
    curve = new THREE.CatmullRomCurve3(inBay
      ? [p0, dk.innerWait.clone(), over]
      : [p0, dk.slotCenter.clone().add(_v1.set(0, 1, 16)), dk.slotCenter.clone(), dk.innerWait.clone(), over]);
    curve.userData = { dur: inBay ? 2.2 : 4.2, shield: inBay };
    Space.stopSounds();
    UI.closeAll();
    Sound.play('dock');
    el('spaceHud').classList.add('hidden');
    return true;
  }

  // ---------- 键盘（main 转发，一次物理按压一次动作）----------
  function pressE(){
    if (phase === 'parked'){ disembark(); return; }
    if (phase !== 'walk') return;
    if (dlg){ advanceDlg(); return; }
    if (near === 'ship'){ board(); return; }
    if (near === 'terminal'){
      Sound.play('uiOpen');
      document.exitPointerLock && document.exitPointerLock();
      UI.openTrade();
      return;
    }
    if (near === 'garage'){   // 换船电脑（仅此处可更换飞船）
      Sound.play('uiOpen');
      if (onGarage) onGarage();
      return;
    }
    if (near && near.userData && near.userData.pilot){   // 访客驾驶员：对话 → 二次按 E 购船
      const v = near.userData.visitor;
      if (buyArm && buyArm.v === v && buyArm.t > 0){
        buyArm = null;
        if (onBuyShip && onBuyShip(v)) return;   // 成交（main 负责扣款与流转）
        return;
      }
      const u = v.userData;
      const C = Space.SHIP_CLASSES[u.cls];
      dlg = {
        name: near.userData.name,
        lines: [
          '看什么？哦——我这艘「' + (Space.SHIP_MODEL_NAMES[u.model] || u.model) + '」啊。',
          '等级 ' + u.cls + ' 级 · 武装「' + C.wName + '」 · 货仓 ' + C.slots + ' 格。',
          '出价 ' + u.price.toLocaleString() + ' 信用点，一口价。想要的话，再按一次 E 成交。',
        ],
        idx: 0, chars: 0,
      };
      el('dialogBox').classList.remove('hidden');
      Sound.play('uiOpen');
      buyArm = { v, t: 12 };
      const dk = Space.getDock();
      near.rotation.y = Math.atan2(near.position.x - walk.pos.x, near.position.z - walk.pos.z);
      near.rotation.x = 0;   // 收起玩手机的低头姿态
      return;
    }
    if (near && near.userData && near.userData.talks){   // 站员对话
      const sets = near.userData.talks;
      dlg = { name: near.userData.name, lines: sets[(Math.random() * sets.length) | 0], idx: 0, chars: 0 };
      el('dialogBox').classList.remove('hidden');
      Sound.play('uiOpen');
      // 站员转身面向玩家（模型前方 -Z）
      const dk = Space.getDock();
      near.userData.rot = Math.atan2(near.position.x + dk.origin.x - walk.pos.x, near.position.z + dk.origin.z - walk.pos.z);
    }
  }
  function pressW(){
    if (phase === 'parked') leave();
  }
  function mouse(mx, my){
    // 兼容入口（当前视角由 mousemove 的 planet 分支直接驱动 Player.yaw/pitch，此处仅保底）
    if (phase !== 'walk') return;
    Player.yaw -= mx * 0.0024;
    Player.pitch = THREE.MathUtils.clamp(Player.pitch - my * 0.0024, -1.55, 1.55);
  }

  // ---------- 下船 / 登船 / 离站 ----------
  // auto=true：泊入完成直接复活在站内（用户指定方案——不依赖 E 键链路）
  function disembark(auto){
    const dk = Space.getDock();
    const ship = Space.shipGroup;
    // 复活点：停机坪旁开阔走道（本地 (8,0,24)，离船 >12，任何判定圈之外）
    const sx = dk.origin.x + 8, sz = dk.origin.z + 24;
    const fy = dk.origin.y + Math.max(floorAt(dk, 8, 24), dk.bounds.floorY) + 1.7;
    walk = { pos: new THREE.Vector3(sx, fy, sz), boardCd: 0.6 };
    // 面朝大厅交易终端（第一眼就是大厅+站员，绝不会与停机位镜头混淆）
    Player.yaw = Math.atan2(-(dk.terminal.x - sx), -(dk.terminal.z - sz));
    Player.pitch = 0;
    phase = 'walk';
    Player.pos.copy(walk.pos);
    Sound.play('land');
    UI.bigMessage(auto ? '泊入完成 · 已在站内' : '已下船',
      '走近站员/交易终端按 E 交互 · 回到船边按 E 登船 · 登船后 W 起飞离站', 3600);
  }
  function board(){
    walk = null; dlg = null; closeDlgBox();
    Sound.loops.jet.stop();
    phase = 'parked'; orbitT = 0;
    Sound.play('openChest');
    UI.bigMessage('已登船', 'W 起飞离站 · E 再次下船', 2200);
  }
  function leave(){
    const dk = Space.getDock();
    const ship = Space.shipGroup;
    UI.closeAll(); closeDlgBox(); dlg = null; walk = null;
    Sound.loops.jet.stop();
    phase = 'lift'; t = 0;
    const liftTo = ship.position.clone(); liftTo.y += 7;
    curve = new THREE.CatmullRomCurve3([liftTo, dk.innerWait.clone(), dk.slotCenter.clone(), dk.exit.clone()]);
    Sound.play('takeoff');
    el('spaceHud').classList.remove('hidden');
  }

  // ---------- 站内对话（独立实现，与村民对话共用 DOM）----------
  function renderDlg(){
    const cur = dlg.lines[dlg.idx];
    el('dlgName').textContent = dlg.name;
    el('dlgText').textContent = cur.slice(0, dlg.chars | 0);
    el('dlgNext').style.visibility = (dlg.chars | 0) >= cur.length ? 'visible' : 'hidden';
  }
  function advanceDlg(){
    const cur = dlg.lines[dlg.idx];
    if ((dlg.chars | 0) < cur.length){ dlg.chars = cur.length; renderDlg(); return; }
    dlg.idx++;
    if (dlg.idx >= dlg.lines.length){ dlg = null; closeDlgBox(); return; }
    dlg.chars = 0; renderDlg();
  }
  function closeDlgBox(){ el('dialogBox').classList.add('hidden'); }

  // ---------- 地板高度（大厅平台 3 / 阶梯 1·2·3 / 停机坪 2 / 库底 0）----------
  function floorAt(dk, lx, lz){
    const B = dk.bounds;
    if (lz <= B.concourseZ) return B.concourseY;
    // 中央阶梯（|x|<10，z 4~10）：每 2 格深抬升 1 格，与阶梯建模一致
    if (Math.abs(lx) < 10){
      if (lz <= 6) return 3;
      if (lz <= 8) return 2;
      if (lz <= 10) return 1;
    }
    for (const pp of [[-20, 30], [20, 30], [-20, 52], [20, 52]]){
      const dx = lx - pp[0], dz = lz - pp[1];
      if (dx * dx + dz * dz < 81) return 2;
    }
    return B.floorY;
  }

  // ---------- 曲线飞行段通用：位置+机头朝向（模型前方 -Z）----------
  function flyAlong(k, dtSlerp){
    const ship = Space.shipGroup;
    curve.getPoint(k, ship.position);
    curve.getTangent(Math.min(0.999, Math.max(0.001, k)), _v1).normalize();
    _e.set(Math.asin(THREE.MathUtils.clamp(_v1.y, -1, 1)), Math.atan2(-_v1.x, -_v1.z), 0, 'YXZ');
    ship.quaternion.slerp(_q.setFromEuler(_e), Math.min(1, dtSlerp));
    Space.shipState.pos.copy(ship.position);
    Space.shipState.speed = 0;
  }
  function chaseCam(camera, dt){
    // 第三人称硬锁尾随：镜头固定在机尾后上方，随飞船姿态同步转动（进出站动画沉浸视角）
    const ship = Space.shipGroup;
    _v2.set(0, 3.4, 12).applyQuaternion(ship.quaternion);
    camera.position.copy(ship.position).add(_v2);
    camera.quaternion.copy(ship.quaternion);
    camera.fov = (window.Game && Game.baseFov) || 75;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  // ---------- 每帧主入口：返回 'exit' 表示已离站（main 交还太空态）----------
  function update(dt, camera, pointerLocked, input){
    const dk = Space.getDock();
    if (!dk || !phase){ phase = null; return 'exit'; }
    const ship = Space.shipGroup;
    // 行走视角：消费太空飞行同款输入管线的鼠标增量（无任何门禁——面板打开也允许转视角）
    if (phase === 'walk' && input){
      Player.yaw -= input.mouseDX * 0.0024;
      Player.pitch = THREE.MathUtils.clamp(Player.pitch - input.mouseDY * 0.0024, -1.55, 1.55);
    }

    if (phase === 'dock'){
      t += dt / curve.userData.dur;
      const k = Math.min(1, t);
      const e2 = k * k * (3 - 2 * k);
      flyAlong(e2, dt * 5);
      Sound.loops.engine.start();
      Sound.loops.engine.set('speed', 0.5 - e2 * 0.3);   // 进港收油门
      if (!curve.userData.shield && e2 > 0.42){ curve.userData.shield = true; Sound.play('scanHit'); }
      chaseCam(camera, dt);
      if (k >= 1){ phase = 'drop'; t = 0; }
    }
    else if (phase === 'drop'){
      t += dt / 1.4;
      const k = Math.min(1, t);
      const e2 = 1 - Math.pow(1 - k, 3);
      _v1.copy(pad); _v1.y += 7;
      ship.position.lerpVectors(_v1, pad, e2);
      _e.set(0, padYaw, 0, 'YXZ');
      ship.quaternion.slerp(_q.setFromEuler(_e), Math.min(1, dt * 4));
      Space.shipState.pos.copy(ship.position);
      Sound.loops.engine.start();
      Sound.loops.engine.set('speed', 0.22 - k * 0.16);   // 垂降怠速
      chaseCam(camera, dt);
      if (k >= 1){
        Sound.loops.engine.stop();
        Sound.play('landShip');
        if (onDocked) onDocked();
        // 泊停完成 → 停机位待命，按 E 下船（按用户要求恢复手动下船）
        phase = 'parked'; orbitT = 0;
        UI.bigMessage('泊入完成', 'E 下船走动 · W 起飞离站', 3000);
      }
    }
    else if (phase === 'parked'){
      orbitT += dt;
      const a = orbitT * 0.1;
      camera.position.set(
        ship.position.x + Math.sin(a) * 10,
        ship.position.y + 4 + Math.sin(orbitT * 1.2) * 0.15,
        ship.position.z + Math.cos(a) * 10);
      camera.lookAt(ship.position.x, ship.position.y + 1.5, ship.position.z);
      camera.updateProjectionMatrix();
      UI.setInteractHint(UI.anyPanelOpen() ? null : '[停机] <b>E</b> 下船 · <b>W</b> 起飞离站');
    }
    else if (phase === 'walk'){
      const w = walk;
      if (w.boardCd > 0) w.boardCd -= dt;
      const panelOpen = UI.anyPanelOpen();
      // NaN 自愈：任何来源的 NaN（视角/坐标）当帧清零重生——NaN 不报错却会永久冻结移动与视角
      if (!isFinite(Player.yaw)) Player.yaw = 0;
      if (!isFinite(Player.pitch)) Player.pitch = 0;
      if (!isFinite(w.pos.x) || !isFinite(w.pos.y) || !isFinite(w.pos.z)){
        const o0 = dk.origin;
        w.pos.set(o0.x + 8, o0.y + 1.7, o0.z + 24);
      }
      // 移动：无门禁——面板/指针状态都不允许冻结行走（文本框输入由 keydown 的 INPUT 检查天然隔离）
      {
        const yaw = Player.yaw;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // 前
        const rx = -fz, rz = fx;                          // 右
        let mx = 0, mz = 0;
        if (Player.keys['KeyW']){ mx += fx; mz += fz; }
        if (Player.keys['KeyS']){ mx -= fx; mz -= fz; }
        if (Player.keys['KeyD']){ mx += rx; mz += rz; }
        if (Player.keys['KeyA']){ mx -= rx; mz -= rz; }
        const ml = Math.hypot(mx, mz);
        if (ml > 0.001){
          const sp = (Player.keys['ShiftLeft'] ? 7 : 4.4) * dt / ml;
          w.pos.x += mx * sp;
          w.pos.z += mz * sp;
        }
      }
      // 边界 + 地板 + 喷气背包（Space 喷射，松开受重力，落地缓慢回充——与星球端手感一致）
      const B = dk.bounds, o = dk.origin;
      const lx = THREE.MathUtils.clamp(w.pos.x - o.x, -B.x, B.x);
      const lz = THREE.MathUtils.clamp(w.pos.z - o.z, B.zMin, B.zMax);
      w.pos.x = lx + o.x;
      w.pos.z = lz + o.z;
      const fy = o.y + floorAt(dk, lx, lz) + 1.7;
      if (w.vy === undefined) w.vy = 0;
      const jetting = Player.keys['Space'] && Player.stats.jet > 0;
      if (jetting){
        w.vy = Math.min(w.vy + 46 * dt, 8.5);
        Player.stats.jet = Math.max(0, Player.stats.jet - 22 * dt);
        Sound.loops.jet.start();
      } else {
        Sound.loops.jet.stop();
      }
      w.vy -= 20 * dt;                       // 重力
      w.pos.y += w.vy * dt;
      const ceil = o.y + 28;                 // 机库净空（顶板下缘留 2 格余量）
      if (w.pos.y > ceil){ w.pos.y = ceil; w.vy = Math.min(0, w.vy); }
      if (w.pos.y <= fy){                    // 触地（含上台阶自动落位：阶梯每级 1 格）
        w.pos.y = fy;
        w.vy = 0;
        Player.stats.jet = Math.min(Player.stats.jetMax || 100, Player.stats.jet + 16 * dt);
      }
      Player.pos.copy(w.pos);
      // 相机：显式四元数写法 + 强制矩阵刷新（绕开一切 Euler 回调/矩阵缓存类隐患）
      camera.matrixAutoUpdate = true;
      camera.position.set(w.pos.x, w.pos.y, w.pos.z);
      camera.quaternion.setFromEuler(_e.set(Player.pitch, Player.yaw, 0, 'YXZ'));
      camera.fov = (window.Game && Game.baseFov) || 75;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      // 最近交互目标（优先级：登船 > 换船电脑 > 交易终端 > 驾驶员 > 站员）
      near = null;
      if (w.pos.distanceTo(ship.position) < 7.5 && w.boardCd <= 0) near = 'ship';
      else if (dk.garage && w.pos.distanceTo(dk.garage) < 3.6) near = 'garage';
      else if (w.pos.distanceTo(dk.terminal) < 4.2) near = 'terminal';
      else {
        for (const p of dk.pilots){
          if (w.pos.distanceTo(p.position) < 3.4){ near = p; break; }
        }
        if (!near){
          for (const f of dk.staff){
            _v1.copy(f.position).add(o);
            if (w.pos.distanceTo(_v1) < 3.4){ near = f; break; }
          }
        }
      }
      // 两步购买窗口倒计时
      if (buyArm){
        buyArm.t -= dt;
        if (buyArm.t <= 0) buyArm = null;
      }
      // 对话推进 + 走远自动结束
      if (dlg){
        dlg.chars = Math.min(dlg.lines[dlg.idx].length, dlg.chars + dt * 26);
        renderDlg();
        if (near === null || typeof near === 'string'){ dlg = null; closeDlgBox(); }
      }
      // 提示
      if (panelOpen) UI.setInteractHint(null);
      else if (!pointerLocked) UI.setInteractHint('🖱 点击画面锁定视角 · W/A/S/D 走动');
      else if (dlg) UI.setInteractHint('<b>E</b> 继续对话');
      else if (near === 'ship') UI.setInteractHint('<b>E</b> 登船');
      else if (near === 'garage') UI.setInteractHint('<b>E</b> 舰船调度终端（更换飞船）');
      else if (near === 'terminal') UI.setInteractHint('<b>E</b> 交易终端');
      else if (near && near.userData && near.userData.pilot){
        const u = near.userData.visitor.userData;
        UI.setInteractHint(buyArm && buyArm.v === near.userData.visitor
          ? `<b>E</b> 确认购买 ${u.cls}级·${(Space.SHIP_MODEL_NAMES[u.model] || u.model)}（¥${u.price.toLocaleString()}）`
          : `<b>E</b> 与${near.userData.name}攀谈（${u.cls}级飞船）`);
      }
      else if (near) UI.setInteractHint(`<b>E</b> 与${near.userData.name}交谈`);
      else UI.setInteractHint('[步行] <b>W/A/S/D</b> 走动 · 大厅台阶通向交易终端');
    }
    else if (phase === 'lift'){
      t += dt / 1.1;
      const k = Math.min(1, t);
      _v1.copy(pad);
      _v2.copy(pad); _v2.y += 7;
      ship.position.lerpVectors(_v1, _v2, k * k * (3 - 2 * k));
      Space.shipState.pos.copy(ship.position);
      Sound.loops.engine.start();
      Sound.loops.engine.set('speed', 0.15 + k * 0.25);   // 拉起升功率
      chaseCam(camera, dt);
      if (k >= 1){ phase = 'leave'; t = 0; }
    }
    else if (phase === 'leave'){
      t += dt / 2.4;
      const k = Math.min(1, t);
      flyAlong(k * k, dt * 5);
      Sound.loops.engine.start();
      Sound.loops.engine.set('speed', 0.4 + k * 0.55);    // 冲出全油门（出站后由太空态无缝接管）
      chaseCam(camera, dt);
      if (k >= 1){
        // 出站交棒数据
        const eu = _e.setFromQuaternion(ship.quaternion, 'YXZ');
        exitData = { pos: ship.position.clone(), yaw: eu.y, pitch: eu.x };
        phase = null;
        Sound.play('reentry');
        UI.bigMessage('已离站', '祝旅途平安，旅行者', 2200);
        return 'exit';
      }
    }
    return 'stay';
  }

  return {
    tryBegin, update, pressE, pressW, mouse,
    get active(){ return phase !== null; },
    get phase(){ return phase; },
    get walking(){ return phase === 'walk'; },
    get exitData(){ return exitData; },
    set onDocked(fn){ onDocked = fn; },
    set onBuyShip(fn){ onBuyShip = fn; },
    set onGarage(fn){ onGarage = fn; },
    get dialogOpen(){ return !!dlg; },
    closeDialog(){ dlg = null; closeDlgBox(); },
  };
})();
window.Station = Station;
window.__V_STATION = 'v82';
