// ============================================================
// ui.js — 像素风 UI：面板/按钮/HP框/文本框/菜单/选队/背包/换人/结算
// 全部使用统一调色板 + 12px 像素字体；按钮带像素边框与按压位移。
// ============================================================
'use strict';

// ---------- 布局常量 ----------
const UI_LAYOUT = {
  oppBox: { x: 6, y: 6, w: 178, h: 46 },
  msgBox: { x: 6, y: 184, w: 220, h: 50 },
  playerBox: { x: 232, y: 184, w: 189, h: 50 },
  actionMenu: { x: 232, y: 138, w: 189, h: 98 },
  movePanel: { x: 6, y: 138, w: 415, h: 98 },
  bagPanel: { x: 140, y: 48, w: 281, h: 138 },
  switchPanel: { x: 96, y: 44, w: 331, h: 150 },
  teamPanel: { x: 30, y: 26, w: 367, h: 200 },
  endPanel: { x: 114, y: 64, w: 199, h: 112 },
  confirmPanel: { x: 128, y: 84, w: 171, h: 68 },
};

// ---------- 基础组件 ----------
function drawPanel(ctx, x, y, w, h) {
  rect(ctx, x, y, w, h, 8);          // 奶油底
  rect(ctx, x, y, w, 1, 30);         // 顶高光
  rect(ctx, x, y, 1, h, 30);         // 左高光
  rect(ctx, x, y + h - 1, w, 1, 31); // 底暗
  rect(ctx, x + w - 1, y, 1, h, 31); // 右暗
  // 深色描边
  rect(ctx, x - 1, y - 1, w + 2, 1, 1);
  rect(ctx, x - 1, y - 1, 1, h + 2, 1);
  rect(ctx, x - 1, y + h, w + 2, 1, 1);
  rect(ctx, x + w, y - 1, 1, h + 2, 1);
}

function drawButton(ctx, x, y, w, h, label, opts) {
  opts = opts || {};
  const pressed = !!opts.pressed;
  const sel = !!opts.selected;
  const dis = !!opts.disabled;
  const ox = pressed ? 1 : 0, oy = pressed ? 1 : 0;
  const bx = x + ox, by = y + oy;
  const bg = dis ? 31 : pressed ? 9 : sel ? 9 : 8;
  rect(ctx, bx, by, w, h, bg);
  rect(ctx, bx, by, w, 1, dis ? 31 : 30);
  rect(ctx, bx, by, 1, h, dis ? 31 : 30);
  rect(ctx, bx, by + h - 1, w, 1, 1);
  rect(ctx, bx + w - 1, by, 1, h, 1);
  if (pressed) {
    rect(ctx, bx + 1, by + 1, w - 2, h - 2, 9);
  } else if (sel) {
    rect(ctx, bx + 1, by + 1, w - 2, h - 2, 9);
    // 选中框
    rect(ctx, bx + 1, by + 1, w - 2, 1, 20);
    rect(ctx, bx + 1, by + 1, 1, h - 2, 20);
    rect(ctx, bx + 1, by + h - 2, w - 2, 1, 20);
    rect(ctx, bx + w - 2, by + 1, 1, h - 2, 20);
  }
  if (label) {
    Fonts.draw(ctx, label, bx + w / 2, by + Math.floor((h - 12) / 2), dis ? 31 : 1, 12, { align: 'center' });
  }
}

function drawTypeChip(ctx, x, y, size, typeName) {
  const c = TYPE_COLOR[typeName] || [31, 1];
  rect(ctx, x, y, size, size, c[0]);
  rect(ctx, x, y, size, 1, 1);
  rect(ctx, x, y, 1, size, 1);
  rect(ctx, x, y + size - 1, size, 1, 1);
  rect(ctx, x + size - 1, y, 1, size, 1);
  Fonts.draw(ctx, typeName[0], x + size / 2, y + Math.floor((size - 12) / 2), c[1], 12, { align: 'center' });
}

function drawStatusChip(ctx, x, y, status) {
  const icon = UI.statusIcons[status];
  if (!icon) return;
  ctx.drawImage(icon, x, y);
}

function drawHPBar(ctx, x, y, w, h, ratio, label) {
  rect(ctx, x, y, w, h, 1);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, 2);
  const fillW = Math.max(0, Math.floor((w - 2) * Math.max(0, Math.min(1, ratio))));
  const col = ratio > 0.5 ? 16 : ratio > 0.2 ? 20 : 23;
  if (fillW > 0) {
    rect(ctx, x + 1, y + 1, fillW, h - 2, col);
    if (h >= 5) rect(ctx, x + 1, y + 1, fillW, 1, ratio > 0.5 ? 17 : ratio > 0.2 ? 21 : 24);
  }
  if (label) {
    Fonts.draw(ctx, label, x + 3, y - 2, 30, 12, { shadow: 1 });
  }
}

// ---------- 打字机文本框 ----------
const TextBox = {
  init() {
    this.lines = [];
    this.lineIdx = 0;
    this.charIdx = 0;
    this.timer = 0;
    this.hold = 0;
    this.done = false;
    this.visible = false;
  },
  show(msg, ctx) {
    this.visible = true;
    this.lines = Fonts.wrap(ctx, msg, UI_LAYOUT.msgBox.w - 16, 12);
    this.lineIdx = 0;
    this.charIdx = 0;
    this.timer = 0;
    this.hold = 0;
    this.done = false;
  },
  clear() {
    this.visible = false;
    this.done = true;
  },
  skip() {
    if (!this.done) {
      this.lineIdx = this.lines.length;
      this.charIdx = 0;
      this.done = true;
      return true;
    }
    return false;
  },
  update(dt) {
    if (!this.visible || this.done) return;
    this.timer += dt;
    while (this.timer >= 26 && !this.done) {
      this.timer -= 26;
      this.charIdx++;
      if (this.charIdx > this.lines[this.lineIdx].length) {
        this.charIdx = 0;
        this.lineIdx++;
        if (this.lineIdx >= this.lines.length) {
          this.done = true;
          this.lineIdx = this.lines.length - 1;
          this.charIdx = this.lines[this.lineIdx].length;
          break;
        }
      }
    }
  },
  draw(ctx, t) {
    if (!this.visible) return;
    const B = UI_LAYOUT.msgBox;
    drawPanel(ctx, B.x, B.y, B.w, B.h);
    // 下箭头提示（闪烁）
    if (this.done && Math.floor(t / 400) % 2 === 0) {
      const ax = B.x + B.w - 14, ay = B.y + B.h - 12;
      rect(ctx, ax - 3, ay - 4, 7, 1, 1);
      rect(ctx, ax - 2, ay - 3, 5, 1, 1);
      rect(ctx, ax - 1, ay - 2, 3, 1, 1);
      px(ctx, ax, ay - 1, 1);
    }
    for (let i = 0; i <= this.lineIdx && i < this.lines.length; i++) {
      let text = this.lines[i];
      if (i === this.lineIdx && !this.done) text = text.slice(0, this.charIdx);
      Fonts.draw(ctx, text, B.x + 8, B.y + 6 + i * 14, 1, 12);
    }
  },
};

// ---------- 各界面 ----------
const UI = {
  init() {
    this.statusIcons = {};
    for (const k in STATUS_ICONS) this.statusIcons[k] = bakeMap(STATUS_ICONS[k]);
    this.weatherIcons = {};
    for (const k in WEATHER_ICONS) {
      if (WEATHER_ICONS[k]) this.weatherIcons[k] = bakeMap(WEATHER_ICONS[k]);
    }
    TextBox.init();
  },

  // 对手信息框
  drawOppBox(ctx, battle) {
    const B = UI_LAYOUT.oppBox;
    const mon = battle.active[1];
    drawPanel(ctx, B.x, B.y, B.w, B.h);
    Fonts.draw(ctx, mon.name, B.x + 8, B.y + 7, 1, 12);
    Fonts.draw(ctx, 'Lv' + mon.level, B.x + B.w - 42, B.y + 7, 1, 12);
    drawHPBar(ctx, B.x + 8, B.y + 26, 104, 6, this.dispHP[1], null);
    if (mon.status) drawStatusChip(ctx, B.x + 128, B.y + 24, mon.status);
    // 异常状态文字
    if (mon.status) {
      Fonts.draw(ctx, mon.status, B.x + B.w - 54, B.y + 26, 1, 12, { align: 'right' });
    }
  },

  // 玩家信息框
  drawPlayerBox(ctx, battle) {
    const B = UI_LAYOUT.playerBox;
    const mon = battle.active[0];
    drawPanel(ctx, B.x, B.y, B.w, B.h);
    Fonts.draw(ctx, mon.name, B.x + 8, B.y + 6, 1, 12);
    Fonts.draw(ctx, 'Lv' + mon.level, B.x + B.w - 42, B.y + 6, 1, 12);
    drawHPBar(ctx, B.x + 8, B.y + 28, 108, 6, this.dispHP[0], null);
    const hpText = this.dispHPNum[0] + '/' + mon.stats.hp;
    Fonts.draw(ctx, hpText, B.x + B.w - 8, B.y + 28, 1, 12, { align: 'right' });
    if (mon.status) drawStatusChip(ctx, B.x + 124, B.y + 24, mon.status);
  },

  // 主菜单（战斗/换人/道具/认输）
  drawActionMenu(ctx, sel) {
    const M = UI_LAYOUT.actionMenu;
    const bw = 88, bh = 40, gap = 6;
    const items = [
      { x: M.x + gap, y: M.y + gap, label: '战斗' },
      { x: M.x + gap + bw + gap + 1, y: M.y + gap, label: '换人' },
      { x: M.x + gap, y: M.y + gap + bh + gap, label: '道具' },
      { x: M.x + gap + bw + gap + 1, y: M.y + gap + bh + gap, label: '认输' },
    ];
    for (let i = 0; i < 4; i++) {
      drawButton(ctx, items[i].x, items[i].y, bw, bh, items[i].label, {
        selected: sel === i,
        pressed: this.pressedIdx === i && this.pressSide === 'action',
        disabled: i === 1 && this.noSwitch(),
      });
    }
    this.actionRects = items.map((it) => ({ x: it.x, y: it.y, w: bw, h: bh, idx: items.indexOf(it) }));
  },

  // 招式面板（2×2）
  drawMovePanel(ctx, battle, sel, scouted) {
    const M = UI_LAYOUT.movePanel;
    const mon = battle.active[0];
    const bw = 200, bh = 40, gap = 6;
    const positions = [
      { x: M.x + gap, y: M.y + gap },
      { x: M.x + gap + bw + 2, y: M.y + gap },
      { x: M.x + gap, y: M.y + gap + bh + gap },
      { x: M.x + gap + bw + 2, y: M.y + gap + bh + gap },
    ];
    const foe = battle.active[1];
    this.moveRects = [];
    for (let i = 0; i < 4; i++) {
      const p = positions[i];
      const slot = mon.moves[i];
      const move = MOVES[slot.id];
      const disabled = slot.pp <= 0;
      drawButton(ctx, p.x, p.y, bw, bh, null, {
        selected: sel === i,
        pressed: this.pressedIdx === i && this.pressSide === 'move',
      });
      drawTypeChip(ctx, p.x + 5, p.y + 5, 14, move.type);
      Fonts.draw(ctx, move.name, p.x + 26, p.y + 6, disabled ? 31 : 1, 12);
      // 物/特/变
      const catTxt = move.cat === 'phys' ? '物' : move.cat === 'spec' ? '特' : '变';
      Fonts.draw(ctx, catTxt, p.x + bw - 26, p.y + 6, 31, 12, { align: 'center' });
      // 克制提示（已知对手属性后）
      if (scouted && move.cat !== 'status') {
        const eff = typeEffectiveness(move.type, foe.types);
        const tx = p.x + bw - 30, ty = p.y + 24;
        if (eff >= 2) {
          rect(ctx, tx - 3, ty, 7, 1, 23);
          rect(ctx, tx - 2, ty + 1, 5, 1, 23);
          rect(ctx, tx - 1, ty + 2, 3, 1, 23);
          px(ctx, tx, ty + 3, 23);
        } else if (eff > 0 && eff < 1) {
          rect(ctx, tx - 3, ty + 3, 7, 1, 26);
          rect(ctx, tx - 2, ty + 2, 5, 1, 26);
          rect(ctx, tx - 1, ty + 1, 3, 1, 26);
          px(ctx, tx, ty, 26);
        } else if (eff === 0) {
          rect(ctx, tx - 2, ty, 5, 3, 31);
          rect(ctx, tx - 3, ty + 1, 7, 1, 31);
        }
      }
      Fonts.draw(ctx, 'PP ' + slot.pp + '/' + slot.ppMax, p.x + bw - 66, p.y + 24, slot.pp <= 2 ? 23 : 1, 12, { align: 'right' });
      this.moveRects.push({ x: p.x, y: p.y, w: bw, h: bh, idx: i });
    }
    Fonts.draw(ctx, '选择招式', M.x + 8, M.y - 14, 30, 12, { shadow: 1 });
  },

  // 背包面板
  drawBagPanel(ctx, bag, sel) {
    const B = UI_LAYOUT.bagPanel;
    drawPanel(ctx, B.x, B.y, B.w, B.h);
    Fonts.draw(ctx, '背包', B.x + 10, B.y + 8, 1, 12);
    const keys = Object.keys(ITEMS);
    this.bagRects = [];
    keys.forEach((key, i) => {
      const item = ITEMS[key];
      const y = B.y + 30 + i * 34;
      const count = bag[key];
      drawButton(ctx, B.x + 10, y, B.w - 20, 28, null, {
        selected: sel === i,
        pressed: this.pressedIdx === i && this.pressSide === 'bag',
        disabled: count <= 0,
      });
      Fonts.draw(ctx, item.name, B.x + 20, y + 8, count <= 0 ? 31 : 1, 12);
      Fonts.draw(ctx, '×' + count, B.x + B.w - 40, y + 8, count <= 0 ? 31 : 23, 12, { align: 'right' });
      Fonts.draw(ctx, item.desc, B.x + 20, y + 20, 31, 12);
      this.bagRects.push({ x: B.x + 10, y, w: B.w - 20, h: 28, idx: i, key });
    });
    Fonts.draw(ctx, 'X 返回', B.x + B.w - 60, B.y + B.h - 16, 31, 12);
  },

  // 换人面板
  drawSwitchPanel(ctx, battle, sel, forced) {
    const B = UI_LAYOUT.switchPanel;
    drawPanel(ctx, B.x, B.y, B.w, B.h);
    Fonts.draw(ctx, forced ? '选择出场的精灵！' : '换人', B.x + 10, B.y + 8, 1, 12);
    this.switchRects = [];
    for (let i = 0; i < battle.playerTeam.length; i++) {
      const mon = battle.playerTeam[i];
      const y = B.y + 30 + i * 38;
      const isActive = mon === battle.active[0];
      const fainted = mon.curHP <= 0;
      drawButton(ctx, B.x + 10, y, B.w - 20, 32, null, {
        selected: sel === i,
        pressed: this.pressedIdx === i && this.pressSide === 'switch',
        disabled: fainted || isActive,
      });
      ctx.drawImage(SPRITES.icon[mon.id], B.x + 18, y + 6, 20, 20);
      Fonts.draw(ctx, mon.name, B.x + 46, y + 8, fainted ? 31 : 1, 12);
      Fonts.draw(ctx, 'Lv' + mon.level, B.x + B.w - 46, y + 8, 31, 12, { align: 'right' });
      drawHPBar(ctx, B.x + 46, y + 20, 90, 5, mon.curHP / mon.stats.hp, null);
      Fonts.draw(ctx, mon.curHP + '/' + mon.stats.hp, B.x + 150, y + 18, 31, 12, { align: 'right' });
      if (mon.status) drawStatusChip(ctx, B.x + 196, y + 14, mon.status);
      if (isActive) Fonts.draw(ctx, '出场中', B.x + B.w - 60, y + 18, 31, 12, { align: 'right' });
      else if (fainted) Fonts.draw(ctx, '已倒下', B.x + B.w - 60, y + 18, 23, 12, { align: 'right' });
      this.switchRects.push({ x: B.x + 10, y, w: B.w - 20, h: 32, idx: i });
    }
    Fonts.draw(ctx, forced ? '必须选择一只' : 'X 取消', B.x + B.w - 90, B.y + B.h - 16, 31, 12);
  },

  // 确认框
  drawConfirm(ctx, sel) {
    const B = UI_LAYOUT.confirmPanel;
    fillDither(ctx, 0, 0, VIEW_W, VIEW_H, 1, 7);
    drawPanel(ctx, B.x, B.y, B.w, B.h);
    Fonts.draw(ctx, '确认认输？', B.x + B.w / 2, B.y + 12, 1, 12, { align: 'center' });
    const bw = 62;
    const y = B.y + 34;
    drawButton(ctx, B.x + 14, y, bw, 22, '是', { selected: sel === 0 });
    drawButton(ctx, B.x + B.w - 14 - bw, y, bw, 22, '否', { selected: sel === 1 });
    this.confirmRects = [
      { x: B.x + 14, y, w: bw, h: 22, idx: 0 },
      { x: B.x + B.w - 14 - bw, y, w: bw, h: 22, idx: 1 },
    ];
  },

  // 队伍选择画面
  drawTeamSelect(ctx, chosen, sel, canStart, t) {
    fillDither(ctx, 0, 0, VIEW_W, VIEW_H, 1, 6);
    const P = UI_LAYOUT.teamPanel;
    drawPanel(ctx, P.x, P.y, P.w, P.h);
    Fonts.draw(ctx, 'POCKET ARENA', VIEW_W / 2, P.y + 10, 30, 16, { align: 'center', title: true, shadow: 1 });
    Fonts.draw(ctx, '像素竞技场 · 选择 3 只出战精灵', VIEW_W / 2, P.y + 34, 31, 12, { align: 'center' });
    const ids = Object.keys(SPECIES);
    this.teamRects = [];
    for (let i = 0; i < 6; i++) {
      const id = ids[i];
      const sp = SPECIES[id];
      const col = i % 3, row = Math.floor(i / 3);
      const x = P.x + 16 + col * 118;
      const y = P.y + 52 + row * 46;
      const picked = chosen.indexOf(id) >= 0;
      drawButton(ctx, x, y, 106, 42, null, { selected: sel === i, pressed: false });
      if (picked) {
        rect(ctx, x + 1, y + 1, 106, 1, 20);
        rect(ctx, x + 1, y + 1, 1, 42, 20);
        rect(ctx, x + 1, y + 41, 106, 1, 20);
        rect(ctx, x + 106, y + 1, 1, 42, 20);
      }
      ctx.drawImage(SPRITES.icon[id], x + 6, y + 6, 20, 20);
      Fonts.draw(ctx, sp.name, x + 32, y + 7, 1, 12);
      sp.types.forEach((typeName, ti) => {
        drawTypeChip(ctx, x + 32 + ti * 16, y + 24, 12, typeName);
      });
      if (picked) {
        // 已选标记（像素星）
        px(ctx, x + 96, y + 14, 20);
        px(ctx, x + 96, y + 15, 20);
        rect(ctx, x + 94, y + 13, 5, 1, 20);
      }
      this.teamRects.push({ x, y, w: 106, h: 42, idx: i, id });
    }
    Fonts.draw(ctx, '已选 ' + chosen.length + '/3', VIEW_W / 2, P.y + 146, 1, 12, { align: 'center' });
    const bx = VIEW_W / 2 - 70;
    drawButton(ctx, bx, P.y + P.h - 40, 140, 24, '开始对战', {
      selected: sel === 6,
      disabled: !canStart,
    });
    if (canStart && Math.floor(t / 500) % 2 === 0) {
      rect(ctx, bx + 2, P.y + P.h - 40 + 2, 136, 1, 20);
    }
    this.teamRects.push({ x: bx, y: P.y + P.h - 40, w: 140, h: 24, idx: 6, id: 'start' });
    Fonts.draw(ctx, '方向键/WASD 选择 · Z/回车 确认 · X 取消 · 鼠标可点', VIEW_W / 2, VIEW_H - 8, 31, 12, { align: 'center' });
    Fonts.draw(ctx, 'C:CRT  G:网格  N:噪点  M:静音  R:重置', VIEW_W / 2, VIEW_H - 22, 31, 12, { align: 'center' });
  },

  // 结束画面
  drawEnd(ctx, winner, turns) {
    fillDither(ctx, 0, 0, VIEW_W, VIEW_H, 1, 7);
    const B = UI_LAYOUT.endPanel;
    drawPanel(ctx, B.x, B.y, B.w, B.h);
    const title = winner === 'player' ? '胜利！' : '败北…';
    Fonts.draw(ctx, title, B.x + B.w / 2, B.y + 14, winner === 'player' ? 20 : 23, 16, { align: 'center', shadow: 1 });
    Fonts.draw(ctx, '共 ' + turns + ' 回合', B.x + B.w / 2, B.y + 44, 1, 12, { align: 'center' });
    drawButton(ctx, B.x + 40, B.y + 66, 119, 26, '重新开始', { selected: true });
    this.endRect = { x: B.x + 40, y: B.y + 66, w: 119, h: 26 };
    Fonts.draw(ctx, '按 R 键也可重置', B.x + B.w / 2, B.y + 100, 31, 12, { align: 'center' });
  },

  // 顶部状态：回合数 + 天气
  drawTopStatus(ctx, battle, t) {
    Fonts.draw(ctx, '回合 ' + battle.turn, 336, 8, 31, 12);
    const wk = battle.weather.kind;
    if (this.weatherIcons[wk]) {
      ctx.drawImage(this.weatherIcons[wk], 409, 6);
      if (battle.weather.turns > 0 && Math.floor(t / 700) % 2 === 0) {
        Fonts.draw(ctx, String(battle.weather.turns), 421, 8, 31, 12);
      }
    }
    if (battle.terrain.kind === '电气场地' && this.weatherIcons['电气场地']) {
      ctx.drawImage(this.weatherIcons['电气场地'], 397, 6);
      if (battle.terrain.turns > 0) Fonts.draw(ctx, String(battle.terrain.turns), 409, 8, 31, 12);
    }
  },

  // 鼠标光标
  drawCursor(ctx, mouse) {
    if (!mouse.active) return;
    ctx.drawImage(UI.cursorImg, mouse.x, mouse.y);
  },
};

UI.noSwitch = function () {
  const g = UI.game;
  if (!g || !g.battle) return true;
  const b = g.battle;
  return !b.playerTeam.some((m) => m.curHP > 0 && m !== b.active[0]);
};
