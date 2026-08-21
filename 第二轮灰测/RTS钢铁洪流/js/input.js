/* ===================================================================
   input.js — 鼠标 / 键盘 → 命令

   模式（this.mode）：
     null          常规
     'place'       建筑落地（由 player.pendingBuild 驱动）
     'attackMove'  按 A 后等待点击目标点
     'sell'        出售：点己方建筑
     'repair'      修理：点己方建筑切换修理状态
     'super'       超级武器指定目标
   Esc 一律退回 null。
   =================================================================== */
(function () {
  'use strict';
  const R = window.R;
  const U = R.U, T = R.TILE;

  const DRAG_MIN = 6;           // 超过这个像素才算框选
  const EDGE = 14;              // 边缘滚屏触发宽度

  R.Input = class Input {
    constructor(game, renderer, ui) {
      this.g = game;
      this.r = renderer;
      this.ui = ui;
      this.cv = renderer.cv;

      this.mode = null;
      this.mouse = { x: 0, y: 0, inside: false, down: false, rdown: false, mdown: false };
      this.dragStart = null;
      this.panStart = null;
      this.lastClick = { t: -9, x: 0, y: 0 };
      this.keys = new Set();
      this.edgeScroll = true;
      this.scrollSpeed = 900;
      this.lastAlertIdx = 0;

      this.bind();
    }

    /* ================= 绑定 ================= */
    bind() {
      const cv = this.cv;
      const self = this;

      cv.addEventListener('contextmenu', (e) => e.preventDefault());

      cv.addEventListener('mousemove', (e) => {
        const r = cv.getBoundingClientRect();
        self.mouse.x = e.clientX - r.left;
        self.mouse.y = e.clientY - r.top;
        self.mouse.inside = true;
        self.onMove();
      });
      cv.addEventListener('mouseenter', () => { self.mouse.inside = true; });
      cv.addEventListener('mouseleave', () => {
        self.mouse.inside = false;
        self.r.hoverEntity = null;
      });

      cv.addEventListener('mousedown', (e) => {
        const r = cv.getBoundingClientRect();
        self.mouse.x = e.clientX - r.left;
        self.mouse.y = e.clientY - r.top;
        if (R.Audio && !R.Audio.ready) R.Audio.init();
        if (e.button === 0) self.onLeftDown(e);
        else if (e.button === 2) self.onRightDown(e);
        else if (e.button === 1) { e.preventDefault(); self.mouse.mdown = true; self.panStart = { mx: self.mouse.x, my: self.mouse.y, cx: self.r.cam.x, cy: self.r.cam.y }; }
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) self.onLeftUp(e);
        else if (e.button === 2) self.onRightUp(e);
        else if (e.button === 1) { self.mouse.mdown = false; self.panStart = null; }
      });

      cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const k = e.deltaY > 0 ? 0.88 : 1.136;
        self.r.setZoom(self.r.zoom * k, self.mouse.x, self.mouse.y);
      }, { passive: false });

      window.addEventListener('keydown', (e) => self.onKeyDown(e));
      window.addEventListener('keyup', (e) => { self.keys.delete(e.code); });
      window.addEventListener('blur', () => { self.keys.clear(); self.mouse.down = false; self.dragStart = null; });

      /* 小地图 */
      const mm = this.r.mm;
      if (mm) {
        const jump = (e, command) => {
          const rc = mm.getBoundingClientRect();
          const w = self.r.minimapToWorld(e.clientX - rc.left, e.clientY - rc.top);
          if (command) {
            const sel = self.ownSelection();
            if (sel.length) self.g.commandMove(sel, w.x, w.y, self.keys.has('KeyA'));
          } else {
            self.r.centerOn(w.x, w.y);
          }
        };
        mm.addEventListener('contextmenu', (e) => e.preventDefault());
        mm.addEventListener('mousedown', (e) => {
          if (R.Audio && !R.Audio.ready) R.Audio.init();
          if (e.button === 0) { self.mmDrag = true; jump(e, false); }
          else if (e.button === 2) jump(e, true);
        });
        mm.addEventListener('mousemove', (e) => { if (self.mmDrag) jump(e, false); });
        window.addEventListener('mouseup', () => { self.mmDrag = false; });
      }
    }

    /* ================= 辅助 ================= */
    world() { return this.r.screenToWorld(this.mouse.x, this.mouse.y); }
    cell() {
      const w = this.world();
      return { cx: Math.floor(w.x / T), cy: Math.floor(w.y / T) };
    }
    ownSelection() {
      return this.g.selection.filter((e) => !e.dead && e.owner === this.g.me && !e.isBuilding);
    }

    /** 拾取：优先单位（离光标最近），其次建筑 */
    pickAt(wx, wy) {
      const g = this.g, me = g.me;
      let best = null, bd = Infinity;
      const list = g.queryAll(wx, wy, 30);
      for (const e of list) {
        if (e.dead || e.isBuilding) continue;
        if (e.owner.team !== me.team && g.fogEnabled && !g.visibleTo(me, e.x, e.y)) continue;
        const yo = e.isAir ? -(e.alt || 26) : 0;
        const d = U.dist(wx, wy, e.x, e.y + yo);
        if (d <= e.rad + 5 && d < bd) { bd = d; best = e; }
      }
      if (best) return best;
      for (const b of g.buildings) {
        if (b.dead) continue;
        if (b.owner.team !== me.team && g.fogEnabled && !g.exploredBy(me, b.x, b.y)) continue;
        if (wx >= b.rect.x && wx <= b.rect.x + b.rect.w && wy >= b.rect.y && wy <= b.rect.y + b.rect.h) return b;
      }
      return null;
    }

    /* ================= 鼠标移动 ================= */
    onMove() {
      const w = this.world();
      this.r.cursorWorld = w;
      if (this.mouse.down && this.dragStart) {
        const dx = this.mouse.x - this.dragStart.x, dy = this.mouse.y - this.dragStart.y;
        if (Math.abs(dx) > DRAG_MIN || Math.abs(dy) > DRAG_MIN) {
          this.r.selBox = { x0: this.dragStart.x, y0: this.dragStart.y, x1: this.mouse.x, y1: this.mouse.y };
        }
      }
      if (this.panStart) {
        this.r.cam.x = this.panStart.cx - (this.mouse.x - this.panStart.mx) / this.r.zoom;
        this.r.cam.y = this.panStart.cy - (this.mouse.y - this.panStart.my) / this.r.zoom;
        this.r.clampCam();
      }
      // 建造预览跟随
      this.syncPlacement();
      // 悬停对象
      this.r.hoverEntity = this.mode ? null : this.pickAt(w.x, w.y);
      this.updateCursor();
    }

    syncPlacement() {
      const g = this.g, me = g.me;
      if (me.pendingBuild && this.mode !== 'super') {
        this.mode = 'place';
        const def = R.BUILDINGS[me.pendingBuild];
        const w = this.world();
        const cx = Math.round(w.x / T - def.size.w / 2);
        const cy = Math.round(w.y / T - def.size.h / 2);
        this.r.placeDef = def;
        this.r.placeCell = { cx, cy };
        this.r.placeValid = g.canPlace(me, def, cx, cy);
      } else if (this.mode === 'place') {
        this.mode = null;
        this.r.placeDef = null; this.r.placeCell = null;
      }
      this.r.superTargeting = (this.mode === 'super');
    }

    updateCursor() {
      const cv = this.cv;
      let c = 'default';
      if (this.mode === 'place') c = 'copy';
      else if (this.mode === 'attackMove') c = 'crosshair';
      else if (this.mode === 'sell') c = 'grab';
      else if (this.mode === 'repair') c = 'help';
      else if (this.mode === 'super') c = 'crosshair';
      else {
        const hv = this.r.hoverEntity;
        const sel = this.ownSelection();
        if (hv && sel.length && hv.owner.team !== this.g.me.team) c = 'crosshair';
        else if (hv) c = 'pointer';
      }
      if (cv.style.cursor !== c) cv.style.cursor = c;
    }

    /* ================= 左键 ================= */
    onLeftDown(e) {
      this.mouse.down = true;
      const g = this.g, me = g.me;
      const w = this.world();

      /* --- 建筑落地 --- */
      if (this.mode === 'place' && me.pendingBuild) {
        const def = R.BUILDINGS[me.pendingBuild];
        const cx = Math.round(w.x / T - def.size.w / 2);
        const cy = Math.round(w.y / T - def.size.h / 2);
        const ok = g.tryPlacePending(me, cx, cy);
        if (ok && !e.shiftKey) {
          // 墙可以连续铺
          if (!def.isWall) { this.mode = null; this.r.placeDef = null; }
        }
        return;
      }
      /* --- 超级武器 --- */
      if (this.mode === 'super') {
        g.fireIon(me, w.x, w.y);
        this.mode = null;
        this.r.superTargeting = false;
        return;
      }
      /* --- 出售 --- */
      if (this.mode === 'sell') {
        const t = this.pickAt(w.x, w.y);
        if (t && t.owner === me) { g.sell(t); }
        else if (R.Audio) R.Audio.ui('deny');
        if (!e.shiftKey) this.mode = null;
        return;
      }
      /* --- 修理 --- */
      if (this.mode === 'repair') {
        const t = this.pickAt(w.x, w.y);
        if (t && t.owner === me && t.isBuilding) {
          t.repairing = !t.repairing;
          if (R.Audio) R.Audio.ui(t.repairing ? 'click' : 'deny');
        } else if (R.Audio) R.Audio.ui('deny');
        if (!e.shiftKey) this.mode = null;
        return;
      }
      /* --- 攻击移动：按 A 后左键点地 --- */
      if (this.mode === 'attackMove') {
        const sel = this.ownSelection();
        if (sel.length) g.commandMove(sel, w.x, w.y, true);
        this.mode = null;
        return;
      }

      this.dragStart = { x: this.mouse.x, y: this.mouse.y, shift: e.shiftKey, ctrl: e.ctrlKey };
    }

    onLeftUp(e) {
      if (!this.mouse.down) return;
      this.mouse.down = false;
      const box = this.r.selBox;
      this.r.selBox = null;
      const g = this.g;
      if (!this.dragStart) return;

      if (box) {
        /* --- 框选 --- */
        const w0 = this.r.screenToWorld(Math.min(box.x0, box.x1), Math.min(box.y0, box.y1));
        const w1 = this.r.screenToWorld(Math.max(box.x0, box.x1), Math.max(box.y0, box.y1));
        const add = this.dragStart.shift;
        const picked = [];
        for (const u of g.units) {
          if (u.dead || u.owner !== g.me) continue;
          const yo = u.isAir ? -(u.alt || 26) : 0;
          if (u.x >= w0.x && u.x <= w1.x && u.y + yo >= w0.y && u.y + yo <= w1.y) picked.push(u);
        }
        // 有战斗单位时，框选忽略矿车（避免把矿车拖进战场，红警老手的肌肉记忆）
        const combat = picked.filter((u) => u.weapon || u.def.engineer);
        const final = combat.length ? combat : picked;
        this.setSelection(final, add);
        this.dragStart = null;
        return;
      }

      /* --- 单击 --- */
      const w = this.world();
      const now = U.now();
      const dbl = (now - this.lastClick.t < 320) &&
        U.dist(this.mouse.x, this.mouse.y, this.lastClick.x, this.lastClick.y) < 8;
      this.lastClick = { t: now, x: this.mouse.x, y: this.mouse.y };

      const hit = this.pickAt(w.x, w.y);
      if (!hit) {
        if (!this.dragStart.shift) this.setSelection([], false);
        this.dragStart = null;
        return;
      }
      if (dbl && hit.owner === g.me && !hit.isBuilding) {
        /* 双击：选中屏幕内所有同类型 */
        const v = this.r.viewRect();
        const same = g.units.filter((u) => !u.dead && u.owner === g.me && u.def.id === hit.def.id &&
          u.x >= v.x && u.x <= v.x + v.w && u.y >= v.y && u.y <= v.y + v.h);
        this.setSelection(same, this.dragStart.shift);
      } else if (hit.owner === g.me) {
        if (this.dragStart.shift) {
          // shift 点击：加入/移出
          const idx = g.selection.indexOf(hit);
          if (idx >= 0) { hit.selected = false; g.selection.splice(idx, 1); }
          else { hit.selected = true; g.selection.push(hit); }
          if (this.ui) this.ui.onSelectionChanged();
        } else {
          this.setSelection([hit], false);
        }
      } else {
        // 点敌人：只是查看（选中敌方单个用于查看信息）
        this.setSelection([hit], false);
      }
      this.dragStart = null;
    }

    setSelection(list, add) {
      const g = this.g;
      if (!add) {
        for (const e of g.selection) e.selected = false;
        g.selection.length = 0;
      }
      for (const e of list) {
        if (e.selected) continue;
        e.selected = true;
        g.selection.push(e);
      }
      if (g.selection.length && R.Audio) {
        const first = g.selection[0];
        if (first.owner === g.me) R.Audio.ui('select');
      }
      if (this.ui) this.ui.onSelectionChanged();
    }

    /* ================= 右键 ================= */
    onRightDown(e) {
      this.mouse.rdown = true;
      // 任何模式下右键 = 取消
      if (this.mode) {
        if (this.mode === 'place') {
          // 取消放置（建筑仍在待放置状态，可再从侧边栏点）
          this.mode = null; this.r.placeDef = null; this.r.placeCell = null;
          this.g.me.pendingBuildHold = true;
        }
        this.mode = null;
        this.r.superTargeting = false;
        if (R.Audio) R.Audio.ui('deny');
        return;
      }
      this.rightStart = { x: this.mouse.x, y: this.mouse.y, t: U.now() };
    }

    onRightUp(e) {
      if (!this.mouse.rdown) return;
      this.mouse.rdown = false;
      const st = this.rightStart;
      this.rightStart = null;
      if (!st) return;
      // 右键拖动 = 平移视角，不算命令
      if (U.dist(st.x, st.y, this.mouse.x, this.mouse.y) > DRAG_MIN) return;

      const g = this.g, me = g.me;
      const sel = this.ownSelection();
      if (!sel.length) { this.setSelection([], false); return; }
      const w = this.world();
      const hit = this.pickAt(w.x, w.y);

      /* --- 点到敌人：攻击 --- */
      if (hit && hit.owner.team !== me.team) {
        if (g.commandAttack(sel, hit)) return;
      }
      /* --- 点到己方建筑：工程师修理 / 矿车卸矿 / 载具进维修厂 --- */
      if (hit && hit.owner === me && hit.isBuilding) {
        let handled = false;
        const engineers = sel.filter((u) => u.def.engineer);
        if (engineers.length) {
          for (const u of engineers) u.orderCapture(hit);
          handled = true;
        }
        if (hit.def.id === 'refinery') {
          const harv = sel.filter((u) => u.def.harvester);
          for (const u of harv) {
            u.order = { type: R.ORDER.HARVEST };
            u.refinery = hit;
            u.harvState = u.cargo > 0 ? 'toRef' : 'seek';
            u.harvTimer = 0;
            handled = true;
          }
        }
        if (hit.def.repairPad) {
          const veh = sel.filter((u) => u.isVehicle);
          if (veh.length) { g.commandMove(veh, hit.x, hit.y); handled = true; }
        }
        if (handled) return;
        // 其它情况：走过去
        g.commandMove(sel, hit.x, hit.y + hit.rect.h * 0.5 + T);
        return;
      }
      /* --- 点到矿：矿车去采 --- */
      const c = { cx: Math.floor(w.x / T), cy: Math.floor(w.y / T) };
      if (g.map.oreAt(c.cx, c.cy) > 0.5) {
        const harv = sel.filter((u) => u.def.harvester);
        if (harv.length) {
          for (const u of harv) u.orderHarvest(c);
          if (R.Audio) R.Audio.ui('order');
          if (harv.length === sel.length) return;
        }
      }
      /* --- 普通移动 --- */
      g.commandMove(sel, w.x, w.y, this.keys.has('KeyA'));
    }

    /* ================= 键盘 ================= */
    onKeyDown(e) {
      const g = this.g, me = g.me;
      const code = e.code;
      this.keys.add(code);
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // 编队：Ctrl+数字 建队，数字 选队
      if (/^Digit[1-9]$/.test(code)) {
        const n = code.slice(5);
        if (e.ctrlKey) {
          const sel = this.ownSelection();
          g.groups[n] = sel.slice();
          g.notify(me, '编队 ' + n + ' 已设定（' + sel.length + '）', null);
          e.preventDefault();
        } else {
          const grp = (g.groups[n] || []).filter((u) => !u.dead);
          if (grp.length) {
            this.setSelection(grp, false);
            // 连按两次跳到编队位置
            if (this._lastGroup === n && U.now() - (this._lastGroupT || 0) < 400) {
              let cx = 0, cy = 0;
              for (const u of grp) { cx += u.x; cy += u.y; }
              this.r.centerOn(cx / grp.length, cy / grp.length);
            }
            this._lastGroup = n; this._lastGroupT = U.now();
          }
        }
        return;
      }

      switch (code) {
        case 'Escape':
          if (this.mode) {
            this.mode = null;
            this.r.placeDef = null; this.r.superTargeting = false;
          } else if (g.selection.length) this.setSelection([], false);
          else if (this.ui) this.ui.togglePause();
          break;

        case 'KeyA': {
          // 按住 A 时右键 = 攻击移动；单按 A 进入攻击移动点击模式
          if (this.ownSelection().length) { this.mode = 'attackMove'; this.updateCursor(); }
          break;
        }
        case 'KeyS': this.g.commandStop(this.ownSelection()); break;
        case 'KeyG': this.g.commandGuard(this.ownSelection()); break;
        case 'KeyD': {
          const sel = this.ownSelection();
          if (!g.commandDeploy(sel) && R.Audio) R.Audio.ui('deny');
          break;
        }
        case 'KeyX': for (const u of this.ownSelection()) u.scatter(); break;
        case 'KeyL': this.mode = this.mode === 'sell' ? null : 'sell'; break;
        case 'KeyR': this.mode = this.mode === 'repair' ? null : 'repair'; break;
        case 'KeyF': {
          // 定位下一个警报 / 己方基地
          if (g.alerts.length) {
            const a = g.alerts[g.alerts.length - 1];
            this.r.centerOn(a.x, a.y);
          } else {
            const cy = g.findConyard(me);
            if (cy) this.r.centerOn(cy.x, cy.y);
          }
          break;
        }
        case 'KeyH': {
          const cy = g.findConyard(me);
          if (cy) this.r.centerOn(cy.x, cy.y);
          break;
        }
        case 'KeyE': {
          // 循环选中所有闲置矿车
          const harv = me.units.filter((u) => !u.dead && u.def.harvester);
          if (harv.length) this.setSelection(harv, false);
          break;
        }
        case 'KeyQ': {
          // 超级武器
          const sw = g.superWeaponState(me);
          if (sw && sw.ready) { this.mode = 'super'; this.r.superTargeting = true; }
          else if (R.Audio) R.Audio.ui('deny');
          break;
        }
        case 'KeyZ': this.r.showGrid = !this.r.showGrid; break;
        case 'F3': e.preventDefault(); this.r.showDebug = !this.r.showDebug; break;
        case 'Space':
          e.preventDefault();
          if (this.ui) this.ui.togglePause();
          break;
        case 'Tab': {
          e.preventDefault();
          // 全选所有作战单位
          const army = me.units.filter((u) => !u.dead && !u.def.harvester);
          this.setSelection(army, false);
          break;
        }
        case 'Delete': {
          for (const u of this.ownSelection().slice()) g.sell(u);
          break;
        }
        case 'Equal': case 'NumpadAdd':
          this.r.setZoom(this.r.zoom * 1.15, this.r.w / 2, this.r.h / 2); break;
        case 'Minus': case 'NumpadSubtract':
          this.r.setZoom(this.r.zoom / 1.15, this.r.w / 2, this.r.h / 2); break;
        default: break;
      }
      // 侧边栏快捷键交给 ui.js
      if (this.ui && this.ui.onHotkey) this.ui.onHotkey(e);
    }

    /* ================= 每帧：摄像机滚动 ================= */
    update(dt) {
      const k = this.keys;
      const r = this.r;
      let dx = 0, dy = 0;
      if (k.has('ArrowLeft')) dx -= 1;
      if (k.has('ArrowRight')) dx += 1;
      if (k.has('ArrowUp')) dy -= 1;
      if (k.has('ArrowDown')) dy += 1;
      // WASD 只在没被当作命令键时用作滚屏 —— 这里用 Shift+WASD 避免冲突
      if (k.has('ShiftLeft') || k.has('ShiftRight')) {
        if (k.has('KeyA')) dx -= 1;
        if (k.has('KeyD')) dx += 1;
        if (k.has('KeyW')) dy -= 1;
        if (k.has('KeyS')) dy += 1;
      }
      if (this.edgeScroll && this.mouse.inside && !this.panStart) {
        if (this.mouse.x < EDGE) dx -= 1;
        else if (this.mouse.x > r.w - EDGE) dx += 1;
        if (this.mouse.y < EDGE) dy -= 1;
        else if (this.mouse.y > r.h - EDGE) dy += 1;
      }
      if (dx || dy) {
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const s = this.scrollSpeed * dt / r.zoom;
        r.cam.x += (dx / len) * s;
        r.cam.y += (dy / len) * s;
        r.clampCam();
      }
      this.syncPlacement();
    }
  };

})();
