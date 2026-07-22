import * as THREE from 'three';
import { worldToScreen, formatTime, clamp } from '../core/utils.js';

const $ = (id) => document.getElementById(id);

/**
 * 战斗HUD：准星 / 装填环 / 车辆状态 / 弹种 / 小地图 / 世界标记 / 播报
 */
export class HUD {
  constructor() {
    this.root = $('hud');
    this.el = {
      timer: $('match-timer'),
      scoreA: document.querySelector('#score-team-a .fill'),
      scoreB: document.querySelector('#score-team-b .fill'),
      scoreAn: document.querySelector('#score-team-a .num'),
      scoreBn: document.querySelector('#score-team-b .num'),
      capBanner: $('cap-banner'),
      killFeed: $('kill-feed'),
      gunCross: $('crosshair-gun'),
      reloadArc: $('reload-arc'),
      reloadText: $('reload-text'),
      hitMarker: $('hit-marker'),
      hitResult: $('hit-result'),
      damageDir: $('damage-dir'),
      sniper: $('sniper-overlay'),
      zoomLabel: $('zoom-label'),
      vehicleName: $('vehicle-name'),
      hpFill: $('hp-fill'),
      modEngine: $('mod-engine'),
      modTrack: $('mod-track'),
      modGun: $('mod-gun'),
      modFire: $('mod-fire'),
      repairHint: $('repair-hint'),
      speed: $('speed-label'),
      shellList: $('shell-list'),
      minimap: $('minimap'),
      scoreToast: $('score-toast'),
      centerMsg: $('center-msg'),
      markerLayer: $('marker-layer'),
      scoreboard: $('scoreboard'),
      sbA: $('sb-a'),
      sbB: $('sb-b'),
      respawn: $('respawn-screen'),
      respawnTitle: $('respawn-title'),
      respawnInfo: $('respawn-info'),
    };
    this.mmCtx = this.el.minimap.getContext('2d');
    this.markers = new Map();
    this._hitTimer = 0;
    this._resultTimer = 0;
    this._centerTimer = 0;
    this._mmBg = null;
    this._milBuilt = false;
    this._sbAcc = 0;
  }

  bind(ctx, battle, player) {
    this.ctx = ctx;
    this.battle = battle;
    this.player = player;
    this.show();
    this.mmSize = 440;
    this.el.minimap.width = this.mmSize;
    this.el.minimap.height = this.mmSize;
    this._buildMinimapBG();
    this._buildShellList();
    if (!this._milBuilt) { this._buildMilMarks(); this._milBuilt = true; }
    this.el.killFeed.innerHTML = '';
    this.el.markerLayer.innerHTML = '';
    this.markers.clear();

    battle.cb.killFeed = (killer, victim, detonation) => this.addKillFeed(killer, victim, detonation);
    battle.cb.hitFeedback = (kind, results) => this.hitFeedback(kind, results);
    battle.cb.playerDamaged = (shooter) => this.damageDirection(shooter);
    battle.cb.toast = (text) => this.toast(text);
    battle.cb.centerMsg = (a, b) => this.centerMsg(a, b);
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  /* ============ 每帧更新 ============ */
  update(dt) {
    const battle = this.battle;
    const player = this.player;
    const tank = player.tank;
    const cam = this.ctx.engine.camera;

    // 票数与时间
    this.el.timer.textContent = formatTime(battle.time);
    this.el.scoreA.style.transform = `scaleX(${battle.tickets.A / 1000})`;
    this.el.scoreB.style.transform = `scaleX(${battle.tickets.B / 1000})`;
    this.el.scoreAn.textContent = Math.ceil(battle.tickets.A);
    this.el.scoreBn.textContent = Math.ceil(battle.tickets.B);

    // 据点横幅
    const capText = battle.cap.statusText;
    this.el.capBanner.classList.toggle('hidden', !capText);
    if (capText) this.el.capBanner.textContent = capText;

    // 准星（火炮落点投影）
    const sp = worldToScreen(player.gunHit.point, cam);
    const gc = this.el.gunCross;
    if (sp.visible && tank.alive) {
      gc.style.display = '';
      gc.style.transform = `translate(${sp.x - window.innerWidth / 2}px, ${sp.y - window.innerHeight / 2}px)`;
    } else {
      gc.style.display = 'none';
    }
    gc.classList.remove('pen-no', 'pen-maybe', 'blocked');
    const pc = player.aimInfo.penClass;
    if (player.gunHit.blocked || pc === 'ally') gc.classList.add('blocked');
    else if (pc === 'bad') gc.classList.add('pen-no');
    else if (pc === 'maybe') gc.classList.add('pen-maybe');

    // 装填环
    const prog = tank.reloadProgress;
    this.el.reloadArc.style.strokeDashoffset = `${251 * (1 - prog)}`;
    if (tank.reloadTimer > 0) {
      this.el.reloadText.textContent = tank.reloadTimer.toFixed(1) + 's';
    } else if (tank.ammo[tank.currentShell] <= 0) {
      this.el.reloadText.textContent = '弹药耗尽';
    } else {
      this.el.reloadText.textContent = '';
    }

    // 命中反馈计时
    if (this._hitTimer > 0) {
      this._hitTimer -= dt;
      if (this._hitTimer <= 0) this.el.hitMarker.classList.remove('show', 'kill');
    }
    if (this._resultTimer > 0) {
      this._resultTimer -= dt;
      if (this._resultTimer <= 0) this.el.hitResult.classList.remove('show');
    }
    if (this._centerTimer > 0) {
      this._centerTimer -= dt;
      if (this._centerTimer <= 0) this.el.centerMsg.classList.remove('show');
    }

    // 狙击镜
    this.el.sniper.classList.toggle('hidden', !player.scope);
    if (player.scope) this.el.zoomLabel.textContent = player.zoomLevels[player.zoomIndex].toFixed(1) + 'x';

    // 车辆状态
    this.el.vehicleName.textContent = `${tank.data.name} · ${tank.data.nation}`;
    const hpRatio = tank.hp / tank.data.hp;
    this.el.hpFill.style.width = (hpRatio * 100) + '%';
    this.el.hpFill.style.background = hpRatio > 0.55
      ? 'linear-gradient(90deg,#4f9e4f,#8fd18f)'
      : hpRatio > 0.25 ? 'linear-gradient(90deg,#b98a24,#ffce6b)' : 'linear-gradient(90deg,#a03030,#ff6b5b)';
    this._setMod(this.el.modEngine, tank.engineDamaged ? 'dmg' : '');
    this._setMod(this.el.modTrack, tank.trackBrokenTimer > 0 ? 'dead' : '');
    this._setMod(this.el.modGun, tank.gunDamagedTimer > 0 ? 'dmg' : '');
    this.el.modFire.classList.toggle('hidden', tank.fireTimer <= 0);
    if (tank.alive && tank.trackBrokenTimer > 0) {
      this.el.repairHint.classList.remove('hidden');
      this.el.repairHint.textContent = `🔧 修理履带中 ${tank.trackBrokenTimer.toFixed(1)}s`;
    } else if (tank.alive && tank.gunDamagedTimer > 0) {
      this.el.repairHint.classList.remove('hidden');
      this.el.repairHint.textContent = `🔧 修理火炮中 ${tank.gunDamagedTimer.toFixed(1)}s`;
    } else {
      this.el.repairHint.classList.add('hidden');
    }
    this.el.speed.textContent = Math.abs(tank.speed * 3.6).toFixed(0) + ' km/h';

    // 弹种
    this._updateShellList(tank);

    // 小地图 / 标记 / 计分板
    this._drawMinimap();
    this._updateMarkers(cam);
    const showSB = this.ctx.input.isDown('Tab');
    this.el.scoreboard.classList.toggle('hidden', !showSB);
    if (showSB) {
      this._sbAcc -= dt;
      if (this._sbAcc <= 0) { this._sbAcc = 0.5; this._buildScoreboard(); }
    } else this._sbAcc = 0;
  }

  _setMod(el, cls) {
    el.classList.remove('dmg', 'dead');
    if (cls) el.classList.add(cls);
  }

  /* ============ 弹种列表 ============ */
  _buildShellList() {
    const tank = this.player.tank;
    this.el.shellList.innerHTML = '';
    this._shellEls = {};
    let i = 1;
    for (const type of ['AP', 'HE']) {
      const s = tank.data.shells[type];
      const div = document.createElement('div');
      div.className = 'shell-item';
      div.innerHTML = `<span class="key">${i}</span><span class="nm">${s.name}</span><span class="cnt"></span>`;
      this.el.shellList.appendChild(div);
      this._shellEls[type] = div;
      i++;
    }
  }

  _updateShellList(tank) {
    for (const type of ['AP', 'HE']) {
      const el = this._shellEls?.[type];
      if (!el) continue;
      el.classList.toggle('active', tank.currentShell === type);
      el.classList.toggle('next', tank.nextShell === type && tank.nextShell !== tank.currentShell);
      el.querySelector('.cnt').textContent = tank.ammo[type];
    }
  }

  /* ============ 命中反馈 ============ */
  hitFeedback(kind, results) {
    const hm = this.el.hitMarker;
    hm.classList.remove('show', 'kill');
    void hm.offsetWidth; // 重启动画
    hm.classList.add('show');
    if (kind === 'kill') hm.classList.add('kill');
    this._hitTimer = 0.45;

    const texts = {
      pen: results?.detonation ? '击穿——弹药殉爆！' : `击穿！(${this._modName(results?.module)})`,
      nonpen: '未击穿',
      ricochet: '跳弹',
      track: '击毁履带',
      splash: '冲击波命中',
      kill: '目标摧毁！',
      ally: '友军！检查射界',
    };
    const t = texts[kind];
    if (t) {
      this.el.hitResult.textContent = t;
      this.el.hitResult.classList.add('show');
      this._resultTimer = 1.4;
    }
    if (kind === 'kill') this.ctx.audio.playUI('ui_confirm', 0.7);
  }

  _modName(m) {
    return { turret: '炮塔', hull: '车体', engine: '发动机', ammo: '弹药架', track: '履带' }[m] || '车体';
  }

  /* ============ 受击方向 ============ */
  damageDirection(shooter) {
    if (!shooter) return;
    const player = this.player;
    const dx = shooter.pos.x - player.tank.pos.x;
    const dz = shooter.pos.z - player.tank.pos.z;
    const worldAng = Math.atan2(dx, dz);
    const rel = worldAng - player.camYaw;
    const arc = document.createElement('div');
    arc.className = 'dmg-arc';
    arc.style.transform = `rotate(${(-rel * 180 / Math.PI)}deg)`;
    this.el.damageDir.appendChild(arc);
    setTimeout(() => arc.remove(), 1100);
    this.player.addShake(0.35);
  }

  /* ============ 播报 ============ */
  addKillFeed(killer, victim, detonation) {
    const div = document.createElement('div');
    div.className = 'feed-item' + (killer?.isPlayer ? ' me' : '');
    const kName = killer ? killer.name : '事故';
    const icon = detonation ? '💥' : '☠';
    const kCls = killer?.team === 'A' ? 'k' : 'v';
    const vCls = victim.team === 'A' ? 'k' : 'v';
    div.innerHTML = `<span class="${kCls}">${kName}</span><span class="w">${icon}</span><span class="${vCls}">${victim.name}</span>`;
    this.el.killFeed.prepend(div);
    while (this.el.killFeed.children.length > 6) this.el.killFeed.lastChild.remove();
    setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.6s'; }, 6000);
    setTimeout(() => div.remove(), 6800);
  }

  toast(text) {
    const div = document.createElement('div');
    div.className = 'toast-item';
    div.textContent = text;
    this.el.scoreToast.appendChild(div);
    setTimeout(() => div.remove(), 1650);
  }

  centerMsg(text, sub = '') {
    this.el.centerMsg.innerHTML = `${text}${sub ? `<span class="sub">${sub}</span>` : ''}`;
    this.el.centerMsg.classList.add('show');
    this._centerTimer = 3.2;
  }

  /* ============ 重生界面 ============ */
  showRespawn(killer, canRespawn, lives) {
    this.el.respawn.classList.remove('hidden');
    this.el.respawnTitle.textContent = killer ? `被 ${killer.name} 击毁` : '载具被击毁';
    this.el.respawnInfo.innerHTML = canRespawn
      ? `剩余重生次数：<b style="color:#ffce6b">${lives}</b><br>选择重返战场继续战斗`
      : '已无剩余载具<br>战斗将以旁观视角继续';
    $('btn-respawn').style.display = canRespawn ? '' : 'none';
  }
  hideRespawn() { this.el.respawn.classList.add('hidden'); }

  /* ============ 计分板 ============ */
  _buildScoreboard() {
    // 同名（重生）载具合并：存活优先，其次取战绩最高
    const byTeam = { A: new Map(), B: new Map() };
    for (const t of this.battle.tanks) {
      const m = byTeam[t.team];
      const prev = m.get(t.name);
      if (!prev) { m.set(t.name, t); continue; }
      if (t.alive && !prev.alive) m.set(t.name, t);
      else if (t.alive === prev.alive && t.kills * 100 + t.score > prev.kills * 100 + prev.score) m.set(t.name, t);
    }
    for (const team of ['A', 'B']) {
      const host = team === 'A' ? this.el.sbA : this.el.sbB;
      host.innerHTML = `<h3>${team === 'A' ? '联邦军' : '帝国军'}</h3>`;
      [...byTeam[team].values()]
        .sort((a, b) => (b.kills * 100 + b.score) - (a.kills * 100 + a.score))
        .forEach((t) => {
          const div = document.createElement('div');
          div.className = 'sb-row' + (t.isPlayer ? ' me' : '') + (t.alive ? '' : ' dead');
          div.innerHTML = `<span>${t.name}</span><span>${t.data.name}</span><span>☠${t.kills}</span>`;
          host.appendChild(div);
        });
    }
  }

  /* ============ 世界标记 ============ */
  _updateMarkers(cam) {
    const battle = this.battle;
    const layer = this.el.markerLayer;
    const used = new Set();
    const addMarker = (key, cls, html, pos, maxDist = 4000) => {
      const sp = worldToScreen(pos, cam);
      let m = this.markers.get(key);
      if (!sp.visible) { if (m) m.style.display = 'none'; used.add(key); return; }
      if (!m) {
        m = document.createElement('div');
        this.markers.set(key, m);
        layer.appendChild(m);
      }
      m.className = 'wmark ' + cls;
      m.innerHTML = html;
      m.style.display = '';
      m.style.left = sp.x + 'px';
      m.style.top = sp.y + 'px';
      used.add(key);
    };

    const playerTank = this.player.tank;
    const tmp = new THREE.Vector3();
    for (const t of battle.tanks) {
      if (!t.alive || t === playerTank) continue;
      tmp.set(t.pos.x, t.pos.y + 4.2, t.pos.z);
      const dist = t.pos.distanceTo(playerTank.pos);
      if (t.team === 'A') {
        addMarker('t' + t.uid, 'ally', `<div>${t.name}</div><div class="tri"></div>`, tmp);
      } else if (t.spotted) {
        addMarker('t' + t.uid, 'enemy', `<div>▼ ${t.data.name}</div><div class="dist">${(dist).toFixed(0)}m</div>`, tmp);
      }
    }
    // 据点
    const cap = battle.cap;
    tmp.set(cap.x, this.ctx.terrain.heightAt(cap.x, cap.z) + 14, cap.z);
    const capCol = cap.owner === 'A' ? '#8fd18f' : cap.owner === 'B' ? '#ff8080' : '#ffe9b0';
    addMarker('cap', 'cap', `<div style="color:${capCol}">⬤ A</div>`, tmp);

    for (const [key, m] of this.markers) {
      if (!used.has(key)) { m.remove(); this.markers.delete(key); }
    }
  }

  /* ============ 小地图 ============ */
  _buildMinimapBG() {
    const size = this.mmSize;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const terrain = this.ctx.terrain;
    const world = this.ctx.layout.worldSize;
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const wx = (x / size - 0.5) * world;
        const wz = (y / size - 0.5) * world;
        const h = terrain.heightAt(wx, wz);
        const n = terrain.normalAt(wx, wz);
        const light = clamp(0.55 + n.x * 0.35 + n.z * 0.2, 0.25, 1);
        const hNorm = clamp((h + 10) / 60, 0, 1);
        let r = 62 + hNorm * 70, gg = 86 + hNorm * 60, b = 44 + hNorm * 40;
        r *= light; gg *= light; b *= light;
        const i = (y * size + x) * 4;
        img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // 道路
    const toPx = (v) => (v / world + 0.5) * size;
    g.strokeStyle = 'rgba(150,125,90,0.9)';
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (const road of this.ctx.layout.roads) {
      g.beginPath();
      g.moveTo(toPx(road[0][0]), toPx(road[0][1]));
      for (let i = 1; i < road.length; i++) g.lineTo(toPx(road[i][0]), toPx(road[i][1]));
      g.stroke();
    }
    // 建筑
    g.fillStyle = 'rgba(210,210,215,0.8)';
    for (const sb of this.ctx.world.solidBoxes) {
      const cx = toPx((sb.box.min.x + sb.box.max.x) / 2);
      const cy = toPx((sb.box.min.z + sb.box.max.z) / 2);
      const w = Math.max(3, (sb.box.max.x - sb.box.min.x) / world * size);
      const h = Math.max(3, (sb.box.max.z - sb.box.min.z) / world * size);
      g.fillRect(cx - w / 2, cy - h / 2, w, h);
    }
    // 边界红区
    const border = toPx(-this.ctx.layout.playableHalf);
    g.strokeStyle = 'rgba(255,60,60,0.55)';
    g.lineWidth = 4;
    g.strokeRect(border, border, size - border * 2, size - border * 2);
    this._mmBg = c;
  }

  _drawMinimap() {
    const g = this.mmCtx;
    const size = this.mmSize;
    const world = this.ctx.layout.worldSize;
    const toPx = (v) => (v / world + 0.5) * size;
    // canvas 旋转角：使图形"尖端"指向世界朝向 heading（x→右, z→下）
    const mapAngle = (h) => Math.PI - h;
    g.clearRect(0, 0, size, size);
    if (this._mmBg) g.drawImage(this._mmBg, 0, 0);

    // 据点圈
    const cap = this.battle.cap;
    const capR = cap.r / world * size;
    g.beginPath();
    g.arc(toPx(cap.x), toPx(cap.z), capR, 0, Math.PI * 2);
    g.strokeStyle = cap.owner === 'A' ? '#57c957' : cap.owner === 'B' ? '#ff5b5b' : '#ffe9b0';
    g.lineWidth = 3;
    g.stroke();
    if (cap.progress !== 0) {
      g.beginPath();
      g.moveTo(toPx(cap.x), toPx(cap.z));
      const frac = Math.abs(cap.progress) / 100;
      g.arc(toPx(cap.x), toPx(cap.z), capR, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      g.closePath();
      g.fillStyle = cap.progress > 0 ? 'rgba(87,201,87,0.35)' : 'rgba(255,91,91,0.35)';
      g.fill();
    }
    g.fillStyle = '#ffe9b0';
    g.font = 'bold 20px sans-serif';
    g.textAlign = 'center';
    g.fillText('A', toPx(cap.x), toPx(cap.z) + 7);

    // 单位
    for (const t of this.battle.tanks) {
      if (!t.alive) continue;
      const x = toPx(t.pos.x), y = toPx(t.pos.z);
      if (t.isPlayer) continue;
      if (t.team === 'A') {
        g.fillStyle = '#57c957';
      } else {
        if (!t.spotted) continue;
        g.fillStyle = '#ff5b5b';
      }
      g.save();
      g.translate(x, y);
      g.rotate(mapAngle(t.heading));
      g.beginPath();
      g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(-6, 6);
      g.closePath();
      g.fill();
      g.restore();
    }
    // 玩家（含视野扇形）
    const p = this.player.tank;
    const px = toPx(p.pos.x), py = toPx(p.pos.z);
    g.save();
    g.translate(px, py);
    g.rotate(mapAngle(this.player.camYaw));
    const grad = g.createLinearGradient(0, 0, 0, -52);
    grad.addColorStop(0, 'rgba(255,255,255,0.28)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, 52, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
    g.closePath();
    g.fill();
    g.restore();
    g.save();
    g.translate(px, py);
    g.rotate(mapAngle(p.heading));
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -10); g.lineTo(7.2, 7.2); g.lineTo(-7.2, 7.2);
    g.closePath();
    g.fill();
    g.restore();
  }

  /* ============ 狙击镜刻度 ============ */
  _buildMilMarks() {
    const gEl = document.getElementById('mil-marks');
    let html = '';
    for (let i = 1; i <= 8; i++) {
      const off = i * 28;
      html += `<line x1="${500 - 8}" y1="${500 + off}" x2="${500 + 8}" y2="${500 + off}"/>`;
      html += `<line x1="${500 + off}" y1="${500 - 8}" x2="${500 + off}" y2="${500 + 8}"/>`;
      html += `<line x1="${500 - off}" y1="${500 - 8}" x2="${500 - off}" y2="${500 + 8}"/>`;
    }
    gEl.innerHTML = html;
  }
}
