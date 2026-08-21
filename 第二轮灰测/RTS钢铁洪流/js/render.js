/* ===================================================================
   render.js — 全部绘制。只读 game 状态，绝不修改它。

   分层顺序（自下而上）：
     1 地形（分块缓存，只在地形变化时重画）
     2 矿脉（每帧按可视格画，因为储量一直在变）
     3 贴花（弹坑 / 残骸 / 尸体 / 废墟）
     4 建筑（含落成动画、受损版、炮塔）
     5 地面单位（按 y 排序，保证遮挡正确）
     6 空中单位（先画地面阴影，再画机身）
     7 投射物 + 粒子
     8 战争迷雾（低分辨率 canvas 放大 → 天然柔边）
     9 选择框 / 建造预览 / 血条 / HUD 叠加
    10 小地图

   R.Art 没就绪时全部走 fallback 几何图形，保证任何时候都能跑。
   =================================================================== */
(function () {
  'use strict';
  const R = window.R;
  const U = R.U, T = R.TILE;
  const CHUNK = 12;                 // 地形缓存分块边长（格）

  const TERRAIN_COLOR = ['#4a5a32', '#6e6142', '#5c5c5c', '#22405e', '#7a7458'];
  const MINIMAP_COLOR = ['#3f4d2b', '#5f5439', '#4e4e4e', '#1d3550', '#6a6550'];

  R.Renderer = class Renderer {
    constructor(game, canvas, minimap) {
      this.g = game;
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.mm = minimap || null;
      this.mctx = minimap ? minimap.getContext('2d') : null;

      this.cam = { x: 0, y: 0 };
      this.zoom = 1;
      this.minZoom = 0.55; this.maxZoom = 1.9;
      this.w = 0; this.h = 0;

      /* 地形分块缓存 */
      this.chunks = new Map();
      this.chunkDirty = new Set();

      /* 迷雾用的低分辨率画布 */
      this.fogCv = R.makeCanvas(game.map.w, game.map.h);
      this.fogCtx = this.fogCv.getContext('2d');
      this.fogImg = this.fogCtx ? this.fogCtx.createImageData(game.map.w, game.map.h) : null;
      this.fogT = 0;

      /* 小地图地形缓存 */
      this.mmTerrain = null;
      this.mmDirty = true;

      /* 建造预览状态（input.js 写入） */
      this.placeDef = null;
      this.placeCell = null;
      this.placeValid = false;
      this.superTargeting = false;

      /* 框选（input.js 写入） */
      this.selBox = null;

      this.showGrid = false;
      this.showDebug = false;
      /**
       * 只给无头自检用：置 true 时跳过建筑/单位/弹药/粒子的绘制。
       * 报告会渲染"有实体"与"无实体"两帧并做像素差分，
       * 从而直接量出"精灵到底有没有画出来"——这是没有眼睛时
       * 唯一硬碰硬的渲染验证手段。
       */
      this.hideEntities = false;
      this.hoverEntity = null;
      this.cursorWorld = { x: 0, y: 0 };

      this.frameMs = 0;
      this._fpsAcc = 0; this._fpsN = 0; this.fps = 0;

      game.onTerrainChanged = () => { this.chunks.clear(); this.mmDirty = true; };
      this.resize();
    }

    get art() { return (R.Art && R.Art.ready) ? R.Art : null; }

    resize() {
      const cv = this.cv;
      const dpr = Math.min(2, (window.devicePixelRatio || 1));
      const w = cv.clientWidth || 1280, h = cv.clientHeight || 720;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      this.dpr = dpr;
      this.w = w; this.h = h;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      if (this.mm) {
        const mw = this.mm.clientWidth || 200, mh = this.mm.clientHeight || 200;
        this.mm.width = Math.round(mw * dpr);
        this.mm.height = Math.round(mh * dpr);
        this.mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.mw = mw; this.mh = mh;
        this.mmDirty = true;
      }
      this.clampCam();
    }

    /* ================= 坐标换算 ================= */
    worldToScreen(x, y) {
      return { x: (x - this.cam.x) * this.zoom, y: (y - this.cam.y) * this.zoom };
    }
    screenToWorld(sx, sy) {
      return { x: sx / this.zoom + this.cam.x, y: sy / this.zoom + this.cam.y };
    }
    /** 可视世界矩形 */
    viewRect() {
      return { x: this.cam.x, y: this.cam.y, w: this.w / this.zoom, h: this.h / this.zoom };
    }
    centerOn(x, y) {
      this.cam.x = x - this.w / (2 * this.zoom);
      this.cam.y = y - this.h / (2 * this.zoom);
      this.clampCam();
    }
    clampCam() {
      const map = this.g.map;
      const vw = this.w / this.zoom, vh = this.h / this.zoom;
      const maxX = Math.max(0, map.pxW - vw), maxY = Math.max(0, map.pxH - vh);
      this.cam.x = U.clamp(this.cam.x, -T, maxX + T);
      this.cam.y = U.clamp(this.cam.y, -T, maxY + T);
      if (map.pxW < vw) this.cam.x = (map.pxW - vw) / 2;
      if (map.pxH < vh) this.cam.y = (map.pxH - vh) / 2;
    }
    setZoom(z, ax, ay) {
      const old = this.zoom;
      this.zoom = U.clamp(z, this.minZoom, this.maxZoom);
      if (this.zoom === old) return;
      // 以鼠标位置为锚点缩放
      if (ax !== undefined) {
        const wx = ax / old + this.cam.x, wy = ay / old + this.cam.y;
        this.cam.x = wx - ax / this.zoom;
        this.cam.y = wy - ay / this.zoom;
      }
      this.clampCam();
    }

    /* ================= 主绘制 ================= */
    render(dtReal) {
      const t0 = U.now();
      const g = this.g, ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;

      // 震屏
      let shx = 0, shy = 0;
      if (g.fx && g.fx.shake > 0) {
        const s = g.fx.shake;
        shx = (g.rnd() - 0.5) * s * 2;
        shy = (g.rnd() - 0.5) * s * 2;
      }

      ctx.save();
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.translate(shx, shy);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.cam.x, -this.cam.y);

      const view = this.viewRect();
      // 稍微外扩，避免边缘物体突然出现
      const pad = T * 3;
      const vx0 = view.x - pad, vy0 = view.y - pad;
      const vx1 = view.x + view.w + pad, vy1 = view.y + view.h + pad;
      this._vx0 = vx0; this._vy0 = vy0; this._vx1 = vx1; this._vy1 = vy1;

      this.drawTerrain(ctx, vx0, vy0, vx1, vy1);
      this.drawOre(ctx, vx0, vy0, vx1, vy1);
      if (this.showGrid) this.drawGrid(ctx, vx0, vy0, vx1, vy1);
      if (!this.hideEntities) {
        this.drawDecals(ctx, vx0, vy0, vx1, vy1);
        this.drawBuildings(ctx, vx0, vy0, vx1, vy1);
        this.drawGroundUnits(ctx, vx0, vy0, vx1, vy1);
        this.drawAirUnits(ctx, vx0, vy0, vx1, vy1);
        this.drawProjectiles(ctx);
        this.drawParticles(ctx);
      }
      this.drawPlacement(ctx);
      if (!this.hideEntities) this.drawSelectionMarks(ctx);
      this.drawFog(ctx, dtReal);
      if (!this.hideEntities) {
        this.drawBars(ctx, vx0, vy0, vx1, vy1);
        this.drawTexts(ctx);
      }
      ctx.restore();

      // 屏幕空间叠加
      this.drawScreenOverlay(ctx);
      this.drawMinimap();

      // 性能统计
      this.frameMs = U.now() - t0;
      this._fpsAcc += dtReal; this._fpsN++;
      if (this._fpsAcc >= 0.5) {
        this.fps = Math.round(this._fpsN / this._fpsAcc);
        this._fpsAcc = 0; this._fpsN = 0;
      }
    }

    /* ---------------- 地形（分块缓存） ---------------- */
    drawTerrain(ctx, vx0, vy0, vx1, vy1) {
      const map = this.g.map;
      const c0x = Math.max(0, Math.floor(vx0 / T / CHUNK));
      const c1x = Math.min(Math.ceil(map.w / CHUNK) - 1, Math.floor(vx1 / T / CHUNK));
      const c0y = Math.max(0, Math.floor(vy0 / T / CHUNK));
      const c1y = Math.min(Math.ceil(map.h / CHUNK) - 1, Math.floor(vy1 / T / CHUNK));
      for (let cy = c0y; cy <= c1y; cy++) {
        for (let cx = c0x; cx <= c1x; cx++) {
          const cv = this.getChunk(cx, cy);
          if (cv) ctx.drawImage(cv, cx * CHUNK * T, cy * CHUNK * T);
        }
      }
    }

    getChunk(cx, cy) {
      const key = cx + ',' + cy;
      let cv = this.chunks.get(key);
      if (cv) return cv;
      const map = this.g.map;
      const art = this.art;
      const px = CHUNK * T;
      cv = R.makeCanvas(px, px);
      const c = cv.getContext('2d');
      if (!c) return null;
      c.imageSmoothingEnabled = false;
      for (let y = 0; y < CHUNK; y++) {
        for (let x = 0; x < CHUNK; x++) {
          const tx = cx * CHUNK + x, ty = cy * CHUNK + y;
          if (!map.inBounds(tx, ty)) {
            c.fillStyle = '#0a0d0a';
            c.fillRect(x * T, y * T, T, T);
            continue;
          }
          const i = map.idx(tx, ty);
          const kind = map.terrain[i];
          if (art) {
            const name = ['grass', 'dirt', 'rock', 'water', 'shore'][kind];
            const img = art.tile(name, map.variant[i]);
            if (img) { c.drawImage(img, x * T, y * T); continue; }
          }
          // fallback：纯色 + 噪点
          c.fillStyle = TERRAIN_COLOR[kind];
          c.fillRect(x * T, y * T, T, T);
          const v = map.variant[i];
          c.fillStyle = 'rgba(0,0,0,0.07)';
          if (v & 1) c.fillRect(x * T + 3, y * T + 5, 6, 4);
          if (v & 2) c.fillRect(x * T + 13, y * T + 14, 5, 5);
          if (kind === 2) {
            c.fillStyle = 'rgba(255,255,255,0.10)';
            c.fillRect(x * T + 2, y * T + 2, T - 8, T - 10);
            c.fillStyle = 'rgba(0,0,0,0.35)';
            c.fillRect(x * T + T - 6, y * T + 6, 4, T - 8);
          }
        }
      }
      this.chunks.set(key, cv);
      // 缓存上限，防止大地图爆内存
      if (this.chunks.size > 260) {
        const first = this.chunks.keys().next().value;
        if (first !== key) this.chunks.delete(first);
      }
      return cv;
    }

    /* ---------------- 矿脉 ---------------- */
    drawOre(ctx, vx0, vy0, vx1, vy1) {
      const map = this.g.map;
      const art = this.art;
      const x0 = Math.max(0, Math.floor(vx0 / T)), x1 = Math.min(map.w - 1, Math.ceil(vx1 / T));
      const y0 = Math.max(0, Math.floor(vy0 / T)), y1 = Math.min(map.h - 1, Math.ceil(vy1 / T));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const lvl = map.oreLevel(x, y);
          if (lvl === 0) continue;
          if (art) {
            const img = art.ore(lvl);
            if (img) { ctx.drawImage(img, x * T, y * T); continue; }
          }
          const a = 0.25 + lvl * 0.18;
          ctx.fillStyle = 'rgba(226,178,58,' + a.toFixed(2) + ')';
          const inset = 4 - lvl;
          ctx.fillRect(x * T + inset, y * T + inset, T - inset * 2, T - inset * 2);
          ctx.fillStyle = 'rgba(255,226,140,' + (a * 0.7).toFixed(2) + ')';
          ctx.fillRect(x * T + 7, y * T + 6, 4, 4);
          ctx.fillRect(x * T + 13, y * T + 13, 3, 3);
        }
      }
    }

    drawGrid(ctx, vx0, vy0, vx1, vy1) {
      const map = this.g.map;
      ctx.strokeStyle = 'rgba(255,255,255,0.055)';
      ctx.lineWidth = 1 / this.zoom;
      ctx.beginPath();
      const x0 = Math.max(0, Math.floor(vx0 / T)), x1 = Math.min(map.w, Math.ceil(vx1 / T));
      const y0 = Math.max(0, Math.floor(vy0 / T)), y1 = Math.min(map.h, Math.ceil(vy1 / T));
      for (let x = x0; x <= x1; x++) { ctx.moveTo(x * T, y0 * T); ctx.lineTo(x * T, y1 * T); }
      for (let y = y0; y <= y1; y++) { ctx.moveTo(x0 * T, y * T); ctx.lineTo(x1 * T, y * T); }
      ctx.stroke();
    }

    /* ---------------- 贴花 ---------------- */
    drawDecals(ctx, vx0, vy0, vx1, vy1) {
      const fx = this.g.fx;
      if (!fx) return;
      const art = this.art;
      const D = R.FXTYPE;
      for (let i = 0; i < fx.decals.length; i++) {
        const d = fx.decals[i];
        if (d.x < vx0 || d.x > vx1 || d.y < vy0 || d.y > vy1) continue;
        switch (d.type) {
          case D.D_SCORCH:
            ctx.fillStyle = 'rgba(24,20,16,0.34)';
            ctx.beginPath();
            ctx.ellipse(d.x, d.y, d.size, d.size * 0.8, d.rot, 0, U.TAU);
            ctx.fill();
            break;
          case D.D_CRATER:
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, U.TAU); ctx.fill();
            break;
          case D.D_CORPSE:
            ctx.save();
            ctx.translate(d.x, d.y); ctx.rotate(d.rot);
            ctx.fillStyle = 'rgba(70,20,16,0.5)';
            ctx.beginPath(); ctx.ellipse(0, 0, d.size * 1.7, d.size * 1.15, 0, 0, U.TAU); ctx.fill();
            ctx.fillStyle = d.color || '#4a3a30';
            ctx.fillRect(-3, -2, 6, 4);
            ctx.restore();
            break;
          case D.D_WRECK: {
            ctx.save();
            ctx.translate(d.x, d.y); ctx.rotate(d.rot || 0);
            let img = null;
            if (art && d.art) img = art.wreck(d.art);
            if (img) ctx.drawImage(img, -img.width / 2, -img.height / 2);
            else {
              ctx.fillStyle = '#2a2622';
              ctx.fillRect(-9, -6, 18, 12);
              ctx.fillStyle = '#171512';
              ctx.fillRect(-6, -3, 8, 6);
            }
            ctx.restore();
            break;
          }
          case D.D_RUBBLE: {
            const w = d.w || 40, h = d.h || 40;
            ctx.fillStyle = 'rgba(30,26,22,0.5)';
            ctx.fillRect(d.x - w / 2, d.y - h / 2, w, h);
            ctx.fillStyle = 'rgba(96,88,78,0.55)';
            const rr = R.rng((d.x * 31 + d.y * 17) | 0);
            for (let k = 0; k < 9; k++) {
              const bw = 3 + rr() * 7, bh = 3 + rr() * 6;
              ctx.fillRect(d.x - w / 2 + rr() * (w - bw), d.y - h / 2 + rr() * (h - bh), bw, bh);
            }
            break;
          }
          default: break;
        }
      }
    }

    /* ---------------- 建筑 ---------------- */
    drawBuildings(ctx, vx0, vy0, vx1, vy1) {
      const g = this.g, art = this.art, me = g.me;
      const list = g.buildings;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (b.dead) continue;
        if (b.rect.x > vx1 || b.rect.y > vy1 ||
            b.rect.x + b.rect.w < vx0 || b.rect.y + b.rect.h < vy0) continue;
        // 迷雾：己方永远可见；敌方需要看见过
        const mine = b.owner.team === me.team;
        if (!mine && g.fogEnabled) {
          if (!g.exploredBy(me, b.x, b.y)) continue;
        }
        this.drawOneBuilding(ctx, b, art, mine);
      }
    }

    drawOneBuilding(ctx, b, art, mine) {
      const rise = b.riseT;
      ctx.save();
      // 落成动画：从地面"升起"（纵向压缩 + 半透明）
      if (rise < 1) {
        ctx.globalAlpha = 0.35 + rise * 0.65;
        ctx.translate(b.x, b.rect.y + b.rect.h);
        ctx.scale(1, 0.35 + rise * 0.65);
        ctx.translate(-b.x, -(b.rect.y + b.rect.h));
      }
      // 地面阴影
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.rect.x + 3, b.rect.y + 4, b.rect.w, b.rect.h);

      let img = null;
      if (art) {
        img = (b.hpFrac < 0.5 && art.buildingDamaged)
          ? art.buildingDamaged(b.def.art, b.faction)
          : art.building(b.def.art, b.faction);
      }
      if (img) {
        ctx.drawImage(img, b.rect.x, b.rect.y, b.rect.w, b.rect.h);
      } else {
        // fallback
        const col = b.owner ? b.owner.color : '#888';
        ctx.fillStyle = R.Col.scale(col, 0.42);
        ctx.fillRect(b.rect.x + 1, b.rect.y + 1, b.rect.w - 2, b.rect.h - 2);
        ctx.fillStyle = R.Col.scale(col, 0.75);
        ctx.fillRect(b.rect.x + 3, b.rect.y + 3, b.rect.w - 6, Math.max(3, b.rect.h * 0.3));
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.rect.x + 1.5, b.rect.y + 1.5, b.rect.w - 3, b.rect.h - 3);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(b.def.name.slice(0, 4), b.x, b.y + 3);
      }

      // 炮塔
      if (b.def.turret) {
        const dir = U.dir16(b.turretAngle);
        let timg = art ? art.turretSprite(b.def.art, b.faction, dir) : null;
        if (timg) ctx.drawImage(timg, b.x - timg.width / 2, b.y - timg.height / 2);
        else {
          ctx.save();
          ctx.translate(b.x, b.y); ctx.rotate(b.turretAngle);
          ctx.fillStyle = '#3a3a38';
          ctx.fillRect(0, -2, b.rad * 0.9 + 5, 4);
          ctx.beginPath(); ctx.arc(0, 0, 5, 0, U.TAU); ctx.fill();
          ctx.restore();
        }
      }

      // 断电闪烁提示
      if (mine && b.def.power < 0 && b.owner.lowPower) {
        const k = 0.35 + 0.35 * Math.sin(this.g.time * 6);
        ctx.fillStyle = 'rgba(255,90,60,' + (k * 0.28).toFixed(2) + ')';
        ctx.fillRect(b.rect.x, b.rect.y, b.rect.w, b.rect.h);
      }
      // 受击白闪
      if (b.hitFlash > 0) {
        ctx.globalAlpha = U.clamp01(b.hitFlash / 0.12) * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.rect.x, b.rect.y, b.rect.w, b.rect.h);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // 选中框
      if (b.selected) this.drawSelectRect(ctx, b);
      // 精炼厂上的矿车指示
      if (b.docked && !b.docked.dead) {
        ctx.fillStyle = 'rgba(226,178,58,0.85)';
        const d = b.dockPoint();
        ctx.fillRect(d.x - 5, d.y - 1, 10, 2);
      }
    }

    /* ---------------- 单位 ---------------- */
    visibleUnits(vx0, vy0, vx1, vy1, air) {
      const g = this.g, me = g.me;
      const out = [];
      const list = g.units;
      for (let i = 0; i < list.length; i++) {
        const u = list[i];
        if (u.dead) continue;
        if ((u.kind === 'air') !== !!air) continue;
        if (u.x < vx0 || u.x > vx1 || u.y < vy0 || u.y > vy1) continue;
        if (u.owner.team !== me.team && g.fogEnabled && !g.visibleTo(me, u.x, u.y)) continue;
        out.push(u);
      }
      out.sort((a, b) => a.y - b.y);
      return out;
    }

    drawGroundUnits(ctx, vx0, vy0, vx1, vy1) {
      const art = this.art;
      const list = this.visibleUnits(vx0, vy0, vx1, vy1, false);
      for (let i = 0; i < list.length; i++) this.drawOneUnit(ctx, list[i], art, 0);
    }

    drawAirUnits(ctx, vx0, vy0, vx1, vy1) {
      const art = this.art;
      const list = this.visibleUnits(vx0, vy0, vx1, vy1, true);
      // 先画阴影
      for (const u of list) {
        const alt = u.alt || 26;
        ctx.fillStyle = 'rgba(0,0,0,0.26)';
        ctx.beginPath();
        ctx.ellipse(u.x + alt * 0.45, u.y + alt * 0.7, u.rad * 0.8, u.rad * 0.5, 0, 0, U.TAU);
        ctx.fill();
      }
      for (const u of list) this.drawOneUnit(ctx, u, art, -(u.alt || 26));
    }

    drawOneUnit(ctx, u, art, yOff) {
      const bob = u.isAir ? Math.sin(u.hover) * 1.6 : 0;
      const px = u.x, py = u.y + (yOff || 0) + bob;

      // 地面阴影（步兵/载具的小影子）
      if (!u.isAir) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(px + 1.5, py + u.rad * 0.42, u.rad * 0.85, u.rad * 0.42, 0, 0, U.TAU);
        ctx.fill();
      }

      let img = null;
      if (art) {
        const dirN = u.isInfantry ? 8 : 16;
        const dir = u.isInfantry ? U.dir8(u.angle) : U.dir16(u.angle);
        const frame = u.isInfantry ? (u.moving ? (Math.floor(u.walkPhase) & 3) : 0) : 0;
        img = art.unit(u.def.art, u.faction, dir, frame);
      }
      if (img) {
        ctx.drawImage(img, px - img.width / 2, py - img.height / 2);
      } else {
        this.fallbackUnit(ctx, u, px, py);
      }

      // 炮塔
      if (u.turretTurn) {
        let timg = art ? art.turretSprite(u.def.art, u.faction, U.dir16(u.turretAngle)) : null;
        let ox = 0, oy = 0;
        if (art && art.turretOffset) {
          const o = art.turretOffset(u.def.art);
          if (o) { ox = o.x; oy = o.y; }
        }
        if (timg) ctx.drawImage(timg, px - timg.width / 2 + ox, py - timg.height / 2 + oy);
        else {
          ctx.save();
          ctx.translate(px, py); ctx.rotate(u.turretAngle);
          ctx.fillStyle = R.Col.scale(u.color, 0.5);
          ctx.beginPath(); ctx.arc(0, 0, u.rad * 0.52, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#2e2e2c';
          ctx.fillRect(0, -1.6, u.rad + 6, 3.2);
          ctx.restore();
        }
      }

      // 采矿车装载指示
      if (u.def.harvester && u.cargo > 0) {
        const f = U.clamp01(u.cargo / u.def.harvester.capacity);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(px - 9, py - u.rad - 6, 18, 3);
        ctx.fillStyle = '#e2b23a';
        ctx.fillRect(px - 9, py - u.rad - 6, 18 * f, 3);
      }
      // 老兵标记
      if (u.veteran > 0) {
        ctx.fillStyle = '#ffd75e';
        for (let k = 0; k < u.veteran; k++) {
          ctx.fillRect(px - 6 + k * 5, py + u.rad * 0.6, 3, 3);
        }
      }
      // 弹药耗尽
      if (u.isAir && u.ammo <= 0) {
        ctx.fillStyle = '#ff6a4a';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('补弹', px, py - u.rad - 8);
      }
      // 受击白闪
      if (u.hitFlash > 0) {
        ctx.globalAlpha = U.clamp01(u.hitFlash / 0.12) * 0.55;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px, py, u.rad * 0.95, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // 选中圈
      if (u.selected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4 / this.zoom;
        ctx.beginPath();
        ctx.ellipse(px, py + (u.isAir ? 0 : u.rad * 0.3), u.rad + 3, (u.rad + 3) * 0.66, 0, 0, U.TAU);
        ctx.stroke();
      }
    }

    fallbackUnit(ctx, u, px, py) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(u.angle);
      const col = u.color;
      if (u.isInfantry) {
        ctx.fillStyle = '#141210';
        ctx.beginPath(); ctx.arc(0, 0, u.rad, 0, U.TAU); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, u.rad - 1.6, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#e8ddc8';
        ctx.fillRect(-1, -1.5, 3, 3);
        ctx.fillStyle = '#26241f';
        ctx.fillRect(1, -1, u.rad + 2, 2);
      } else {
        const w = u.rad * 2, h = u.rad * 1.5;
        ctx.fillStyle = '#141210';
        ctx.fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
        ctx.fillStyle = R.Col.scale(col, 0.62);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = R.Col.scale(col, 1.05);
        ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.32);
        ctx.fillStyle = '#1a1815';
        ctx.fillRect(-w / 2, -h / 2, w, 2.2);
        ctx.fillRect(-w / 2, h / 2 - 2.2, w, 2.2);
      }
      ctx.restore();
    }

    /* ---------------- 投射物 ---------------- */
    drawProjectiles(ctx) {
      const list = this.g.projectiles;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p.dead) continue;
        if (p.x < this._vx0 || p.x > this._vx1 || p.y < this._vy0 || p.y > this._vy1) continue;
        const z = p.z || 0;
        const py = p.y - z;
        if (z > 2) {
          // 榴弹的地面阴影
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath(); ctx.ellipse(p.x, p.y, 3, 1.8, 0, 0, U.TAU); ctx.fill();
        }
        switch (p.kindName) {
          case 'bullet': break;   // 由曳光负责
          case 'shell':
            ctx.save();
            ctx.translate(p.x, py); ctx.rotate(p.angle);
            ctx.fillStyle = '#f2d79a';
            ctx.fillRect(-4, -1.4, 8, 2.8);
            ctx.restore();
            break;
          case 'arc':
            ctx.fillStyle = '#3a3632';
            ctx.beginPath(); ctx.arc(p.x, py, 3.4, 0, U.TAU); ctx.fill();
            ctx.fillStyle = '#8e867c';
            ctx.beginPath(); ctx.arc(p.x - 1, py - 1, 1.5, 0, U.TAU); ctx.fill();
            break;
          case 'rocket':
            ctx.save();
            ctx.translate(p.x, py); ctx.rotate(p.angle);
            ctx.fillStyle = '#d8d2c6';
            ctx.fillRect(-5, -1.6, 10, 3.2);
            ctx.fillStyle = '#ff9a3c';
            ctx.fillRect(-8, -1.2, 3.5, 2.4);
            ctx.restore();
            break;
          case 'flame':
            ctx.fillStyle = 'rgba(255,170,60,0.75)';
            ctx.beginPath(); ctx.arc(p.x, py, 4.5, 0, U.TAU); ctx.fill();
            break;
          default: break;
        }
      }
    }

    /* ---------------- 粒子 ---------------- */
    drawParticles(ctx) {
      const fx = this.g.fx;
      if (!fx) return;
      const P = R.FXTYPE;
      // 曳光
      const tr = fx.tracers;
      ctx.lineCap = 'round';
      for (let i = 0; i < tr.length; i++) {
        const t = tr[i];
        if (!t.live) continue;
        const k = 1 - t.t / t.life;
        ctx.globalAlpha = k;
        ctx.strokeStyle = t.color;
        ctx.lineWidth = t.w;
        ctx.beginPath();
        ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x1, t.y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const ps = fx.parts;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (!p.live) continue;
        const k = p.t / p.life;
        const alpha = U.clamp01((1 - k) * (p.fade === undefined ? 1 : (1 - k * (1 - p.fade) + p.fade * 0.0)));
        const a = U.clamp01(1 - k);
        const size = p.size + (p.grow || 0) * k;
        const py = p.y - (p.gz || 0);
        switch (p.type) {
          case P.P_SPARK:
            ctx.globalAlpha = a;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - size * 0.5, py - size * 0.5, size, size);
            break;
          case P.P_FIRE:
            ctx.globalAlpha = a * 0.92;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, py, size, 0, U.TAU); ctx.fill();
            break;
          case P.P_SMOKE:
            ctx.globalAlpha = a * 0.42;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, py, size, 0, U.TAU); ctx.fill();
            break;
          case P.P_DUST:
            ctx.globalAlpha = a * 0.3;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, py, size, 0, U.TAU); ctx.fill();
            break;
          case P.P_DEBRIS:
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(p.x, py); ctx.rotate(p.rot || 0);
            ctx.fillStyle = p.color;
            ctx.fillRect(-size * 0.5, -size * 0.5, size, size * 0.75);
            ctx.restore();
            break;
          case P.P_RING:
            ctx.globalAlpha = a * 0.55;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(0.6, 3 * (1 - k));
            ctx.beginPath(); ctx.arc(p.x, py, size, 0, U.TAU); ctx.stroke();
            break;
          case P.P_FLASH:
            ctx.globalAlpha = a * 0.95;
            ctx.fillStyle = p.color;
            if (p.rot) {
              ctx.save();
              ctx.translate(p.x, py); ctx.rotate(p.rot);
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(size * 2.1, -size * 0.55);
              ctx.lineTo(size * 2.6, 0);
              ctx.lineTo(size * 2.1, size * 0.55);
              ctx.closePath(); ctx.fill();
              ctx.restore();
            } else {
              ctx.beginPath(); ctx.arc(p.x, py, size, 0, U.TAU); ctx.fill();
            }
            break;
          default: break;
        }
      }
      ctx.globalAlpha = 1;
    }

    /* ---------------- 血条 ---------------- */
    drawBars(ctx, vx0, vy0, vx1, vy1) {
      const g = this.g, me = g.me;
      const zoomK = 1 / this.zoom;
      const drawBar = (e, w, yTop) => {
        const f = e.hpFrac;
        const h = Math.max(2.5, 3.2 * zoomK);
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(e.x - w / 2 - 1, yTop - 1, w + 2, h + 2);
        ctx.fillStyle = f > 0.6 ? '#4fd35f' : (f > 0.3 ? '#e8c53c' : '#e5482f');
        ctx.fillRect(e.x - w / 2, yTop, w * f, h);
      };
      for (const b of g.buildings) {
        if (b.dead) continue;
        if (b.def.noBar && !b.selected) continue;
        if (b.rect.x > vx1 || b.rect.y > vy1 || b.rect.x + b.rect.w < vx0 || b.rect.y + b.rect.h < vy0) continue;
        const mine = b.owner.team === me.team;
        if (!mine && g.fogEnabled && !g.exploredBy(me, b.x, b.y)) continue;
        if (b.selected || b.hpFrac < 0.999) drawBar(b, b.rect.w * 0.8, b.rect.y - 6 * zoomK);
      }
      for (const u of g.units) {
        if (u.dead) continue;
        if (u.x < vx0 || u.x > vx1 || u.y < vy0 || u.y > vy1) continue;
        if (u.owner.team !== me.team && g.fogEnabled && !g.visibleTo(me, u.x, u.y)) continue;
        if (u.selected || u.hpFrac < 0.999) {
          const yo = u.isAir ? -(u.alt || 26) : 0;
          drawBar(u, Math.max(14, u.rad * 2), u.y + yo - u.rad - 7 * zoomK);
        }
      }
    }

    drawTexts(ctx) {
      const fx = this.g.fx;
      if (!fx) return;
      ctx.textAlign = 'center';
      for (const t of fx.texts) {
        const a = U.clamp01(1 - t.t / t.life);
        ctx.globalAlpha = a;
        ctx.font = 'bold ' + t.size + 'px "Segoe UI", sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillText(t.str, t.x + 1, t.y + 1);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }

    /* ---------------- 选中标记 ---------------- */
    drawSelectRect(ctx, b) {
      const k = 1 / this.zoom;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * k;
      const r = b.rect, L = Math.min(r.w, r.h) * 0.32;
      const corners = [
        [r.x, r.y, 1, 1], [r.x + r.w, r.y, -1, 1],
        [r.x, r.y + r.h, 1, -1], [r.x + r.w, r.y + r.h, -1, -1],
      ];
      ctx.beginPath();
      for (const [cx, cy, sx, sy] of corners) {
        ctx.moveTo(cx, cy + sy * L); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * L, cy);
      }
      ctx.stroke();
    }

    drawSelectionMarks(ctx) {
      const g = this.g;
      // 选中单位的当前目标 / 路径提示
      for (const e of g.selection) {
        if (e.dead || e.isBuilding) continue;
        if (e.path && e.pathI < e.path.length) {
          ctx.strokeStyle = 'rgba(150,230,150,0.30)';
          ctx.lineWidth = 1.2 / this.zoom;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          for (let i = e.pathI; i < e.path.length; i++) ctx.lineTo(e.path[i].x, e.path[i].y);
          ctx.stroke();
          const last = e.path[e.path.length - 1];
          ctx.fillStyle = 'rgba(150,230,150,0.55)';
          ctx.fillRect(last.x - 2.5, last.y - 2.5, 5, 5);
        }
        if (e.target && !e.target.dead) {
          ctx.strokeStyle = 'rgba(240,90,70,0.55)';
          ctx.lineWidth = 1.2 / this.zoom;
          ctx.beginPath();
          ctx.arc(e.target.x, e.target.y, (e.target.rad || 12) + 4, 0, U.TAU);
          ctx.stroke();
        }
      }
      // 悬停高亮
      const hv = this.hoverEntity;
      if (hv && !hv.dead && !hv.selected) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1 / this.zoom;
        if (hv.isBuilding) ctx.strokeRect(hv.rect.x, hv.rect.y, hv.rect.w, hv.rect.h);
        else { ctx.beginPath(); ctx.arc(hv.x, hv.y, hv.rad + 3, 0, U.TAU); ctx.stroke(); }
      }
    }

    /* ---------------- 建造预览 ---------------- */
    drawPlacement(ctx) {
      const g = this.g;
      if (this.superTargeting) {
        const c = this.cursorWorld;
        const wpn = R.WEAPONS.ionBeam;
        ctx.strokeStyle = 'rgba(140,220,255,0.8)';
        ctx.lineWidth = 2 / this.zoom;
        ctx.beginPath(); ctx.arc(c.x, c.y, wpn.splash, 0, U.TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(140,220,255,0.35)';
        ctx.beginPath(); ctx.arc(c.x, c.y, wpn.splash * 0.55, 0, U.TAU); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(c.x - wpn.splash - 12, c.y); ctx.lineTo(c.x + wpn.splash + 12, c.y);
        ctx.moveTo(c.x, c.y - wpn.splash - 12); ctx.lineTo(c.x, c.y + wpn.splash + 12);
        ctx.stroke();
        return;
      }
      const def = this.placeDef;
      if (!def || !this.placeCell) return;
      const cx = this.placeCell.cx, cy = this.placeCell.cy;
      const map = g.map;

      // 建造范围（虚线圈住所有己方建筑的可建区域）
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = 'rgba(120,200,255,0.5)';
      ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
      ctx.lineWidth = 1 / this.zoom;
      const rr = R.RULES.buildRadius;
      for (const b of g.me.buildings) {
        if (b.dead || b.def.isWall) continue;
        ctx.strokeRect(
          (b.cx - rr) * T, (b.cy - rr) * T,
          (b.w + rr * 2) * T, (b.h + rr * 2) * T);
      }
      ctx.restore();

      // 逐格染色
      const w = def.size.w, h = def.size.h;
      for (let y = cy; y < cy + h; y++) {
        for (let x = cx; x < cx + w; x++) {
          const ok = map.canBuildAt(x, y);
          ctx.fillStyle = ok ? 'rgba(90,220,110,0.28)' : 'rgba(230,70,50,0.34)';
          ctx.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
        }
      }
      // 整体轮廓
      const valid = this.placeValid;
      ctx.strokeStyle = valid ? 'rgba(140,255,160,0.95)' : 'rgba(255,110,90,0.95)';
      ctx.lineWidth = 2 / this.zoom;
      ctx.strokeRect(cx * T, cy * T, w * T, h * T);
      // 半透明建筑预览
      const art = this.art;
      const img = art ? art.building(def.art, g.me.faction) : null;
      ctx.globalAlpha = 0.55;
      if (img) ctx.drawImage(img, cx * T, cy * T, w * T, h * T);
      ctx.globalAlpha = 1;

      // 防御建筑显示射程
      if (def.weapon) {
        const c = R.buildingCenter(def, cx, cy);
        ctx.strokeStyle = 'rgba(255,220,140,0.4)';
        ctx.lineWidth = 1 / this.zoom;
        ctx.beginPath(); ctx.arc(c.x, c.y, R.px(R.WEAPONS[def.weapon].range), 0, U.TAU); ctx.stroke();
      }
    }

    /* ---------------- 迷雾 ---------------- */
    drawFog(ctx, dt) {
      const g = this.g;
      if (!g.fogEnabled || !this.fogCtx || !this.fogImg) return;
      this.fogT -= dt;
      if (this.fogT <= 0) {
        this.fogT = 0.1;
        const fog = g.me.fog;
        const d = this.fogImg.data;
        for (let i = 0, j = 0; i < fog.length; i++, j += 4) {
          const v = fog[i];
          d[j] = 4; d[j + 1] = 6; d[j + 2] = 8;
          d[j + 3] = v === R.FOG.VIS ? 0 : (v === R.FOG.SEEN ? 128 : 255);
        }
        this.fogCtx.putImageData(this.fogImg, 0, 0);
      }
      const map = g.map;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      // 稍微外扩半格，避免放大后边缘露出硬边
      ctx.drawImage(this.fogCv, -T * 0.5, -T * 0.5, map.pxW + T, map.pxH + T);
      ctx.restore();
      ctx.imageSmoothingEnabled = false;
    }

    /* ---------------- 屏幕空间叠加 ---------------- */
    drawScreenOverlay(ctx) {
      const g = this.g;
      // 框选矩形
      if (this.selBox) {
        const b = this.selBox;
        const x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1);
        const w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0);
        ctx.fillStyle = 'rgba(120,220,140,0.12)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(150,255,170,0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      }
      // 全屏闪白（大爆炸 / 离子炮）
      if (g.fx && g.fx.flash > 0) {
        ctx.fillStyle = 'rgba(220,240,255,' + (g.fx.flash * 0.5).toFixed(3) + ')';
        ctx.fillRect(0, 0, this.w, this.h);
      }
      // 低电量红晕
      if (g.me.lowPower) {
        const k = 0.06 + 0.04 * Math.sin(g.time * 3);
        const grd = ctx.createLinearGradient(0, 0, 0, this.h);
        grd.addColorStop(0, 'rgba(255,60,40,' + k.toFixed(3) + ')');
        grd.addColorStop(0.4, 'rgba(255,60,40,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, this.w, this.h);
      }
      if (this.showDebug) this.drawDebug(ctx);
    }

    drawDebug(ctx) {
      const g = this.g;
      const lines = [
        'FPS ' + this.fps + '  帧耗时 ' + this.frameMs.toFixed(1) + 'ms',
        '单位 ' + g.units.length + '  建筑 ' + g.buildings.length + '  弹 ' + g.projectiles.length,
        '粒子 ' + (g.fx ? g.fx.countLive() : 0) + '  贴花 ' + (g.fx ? g.fx.decals.length : 0),
        '寻路队列 ' + g.pathQueue.size + '  完成 ' + g.pathQueue.stats.done + '  失败 ' + g.pathQueue.stats.fails,
        '缩放 ' + this.zoom.toFixed(2) + '  区块 ' + this.chunks.size,
        '游戏时间 ' + U.mmss(g.time),
      ];
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(8, 8, 250, lines.length * 14 + 8);
      ctx.fillStyle = '#9fe8a8';
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 14, 22 + i * 14);
    }

    /* ---------------- 小地图 ---------------- */
    buildMinimapTerrain() {
      const map = this.g.map;
      const cv = R.makeCanvas(map.w, map.h);
      const c = cv.getContext('2d');
      if (!c) return null;
      const img = c.createImageData(map.w, map.h);
      const d = img.data;
      for (let i = 0, j = 0; i < map.terrain.length; i++, j += 4) {
        const col = R.Col.parse(MINIMAP_COLOR[map.terrain[i]]);
        d[j] = col.r; d[j + 1] = col.g; d[j + 2] = col.b; d[j + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      this.mmTerrain = cv;
      this.mmDirty = false;
      return cv;
    }

    drawMinimap() {
      if (!this.mctx) return;
      const g = this.g, ctx = this.mctx, map = g.map;
      const W = this.mw, H = this.mh;
      ctx.clearRect(0, 0, W, H);
      // 保持等比
      const s = Math.min(W / map.w, H / map.h);
      const ox = (W - map.w * s) / 2, oy = (H - map.h * s) / 2;
      this.mmScale = s; this.mmOx = ox; this.mmOy = oy;

      const radar = g.me.hasRadar || !g.fogEnabled;

      ctx.fillStyle = '#0b0e0c';
      ctx.fillRect(0, 0, W, H);

      if (this.mmDirty || !this.mmTerrain) this.buildMinimapTerrain();
      if (this.mmTerrain) {
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = radar ? 1 : 0.35;
        ctx.drawImage(this.mmTerrain, ox, oy, map.w * s, map.h * s);
        ctx.globalAlpha = 1;
      }

      if (!radar) {
        // 没有雷达：只画一片噪声，提示需要雷达站
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(ox, oy, map.w * s, map.h * s);
        ctx.fillStyle = 'rgba(255,120,90,0.85)';
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('雷达离线', W / 2, H / 2 + 4);
        ctx.textAlign = 'left';
        return;
      }

      // 矿脉
      ctx.fillStyle = 'rgba(226,178,58,0.9)';
      const step = Math.max(1, Math.floor(1 / s));
      for (let y = 0; y < map.h; y += step) {
        for (let x = 0; x < map.w; x += step) {
          if (map.ore[map.idx(x, y)] > 4) ctx.fillRect(ox + x * s, oy + y * s, Math.max(1, s), Math.max(1, s));
        }
      }

      // 迷雾
      if (g.fogEnabled) {
        const fog = g.me.fog;
        ctx.fillStyle = 'rgba(4,6,8,0.86)';
        for (let y = 0; y < map.h; y++) {
          let runStart = -1;
          for (let x = 0; x <= map.w; x++) {
            const un = x < map.w && fog[y * map.w + x] === R.FOG.NONE;
            if (un && runStart < 0) runStart = x;
            else if (!un && runStart >= 0) {
              ctx.fillRect(ox + runStart * s, oy + y * s, (x - runStart) * s, Math.max(1, s));
              runStart = -1;
            }
          }
        }
        ctx.fillStyle = 'rgba(4,6,8,0.42)';
        for (let y = 0; y < map.h; y++) {
          let runStart = -1;
          for (let x = 0; x <= map.w; x++) {
            const un = x < map.w && fog[y * map.w + x] === R.FOG.SEEN;
            if (un && runStart < 0) runStart = x;
            else if (!un && runStart >= 0) {
              ctx.fillRect(ox + runStart * s, oy + y * s, (x - runStart) * s, Math.max(1, s));
              runStart = -1;
            }
          }
        }
      }

      // 建筑
      for (const b of g.buildings) {
        if (b.dead) continue;
        const mine = b.owner.team === g.me.team;
        if (!mine && g.fogEnabled && !g.exploredBy(g.me, b.x, b.y)) continue;
        ctx.fillStyle = b.owner.color;
        ctx.fillRect(ox + b.cx * s, oy + b.cy * s, Math.max(2, b.w * s), Math.max(2, b.h * s));
      }
      // 单位
      for (const u of g.units) {
        if (u.dead) continue;
        const mine = u.owner.team === g.me.team;
        if (!mine && g.fogEnabled && !g.visibleTo(g.me, u.x, u.y)) continue;
        ctx.fillStyle = mine ? (u.selected ? '#ffffff' : u.owner.color) : u.owner.color;
        const sz = Math.max(1.6, (u.isBuilding ? 3 : 2) * s * 0.9);
        ctx.fillRect(ox + (u.x / T) * s - sz / 2, oy + (u.y / T) * s - sz / 2, sz, sz);
      }
      // 警报点
      for (const a of g.alerts) {
        const k = 1 - a.t / a.life;
        ctx.strokeStyle = 'rgba(255,70,50,' + k.toFixed(2) + ')';
        ctx.lineWidth = 1.5;
        const r = 3 + (1 - k) * 9;
        ctx.beginPath();
        ctx.arc(ox + (a.x / T) * s, oy + (a.y / T) * s, r, 0, U.TAU);
        ctx.stroke();
      }
      // 视野框
      const v = this.viewRect();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        ox + (v.x / T) * s, oy + (v.y / T) * s,
        (v.w / T) * s, (v.h / T) * s);
    }

    /** 小地图坐标 → 世界坐标 */
    minimapToWorld(mx, my) {
      const s = this.mmScale || 1;
      return { x: (mx - (this.mmOx || 0)) / s * T, y: (my - (this.mmOy || 0)) / s * T };
    }
  };

})();
