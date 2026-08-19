import { el, clear, setText, setClass, ELEMENT_COLORS, ELEMENT_NAMES, TARGET_NAMES, STANCE_NAMES } from './dom';
import type { ActorState, BattleState, QueueEntry, StatusInstance } from '../engine/types';
import { STATUS_DEFS, describeStatus } from '../engine/data/statuses';
import { SKILL_BY_ID, effectiveApCost, skillsOf, stainColor, stainLabel } from '../engine/data/skills';
import { ITEM_DEFS } from '../engine/data/characters';
import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyConfig } from '../engine/data/difficulty';
import type { DifficultyId } from '../engine/types';

export interface UiHooks {
  onDifficulty(d: DifficultyId): void;
  onCommand(kind: 'attack' | 'skill' | 'aim' | 'item'): void;
  onSkill(skillId: string): void;
  onItem(itemId: string): void;
  onTarget(id: string): void;
  onBack(): void;
  onAimShot(weakPointId: string | null, sx: number, sy: number): void;
  onAimEnd(): void;
  onRestart(): void;
  onToDifficulty(): void;
  onTogglePause(): void;
  onToggleMute(): void;
  onVolume(v: number): void;
  onToggleShake(): void;
  onTogglePerf(): void;
  onExportLog(): void;
  onImportLog(text: string): void;
  onDebug(action: string, value?: string): void;
}

interface DamageNumber {
  el: HTMLElement;
  x: number; y: number; vx: number; vy: number; life: number; total: number;
}

interface QteRing {
  el: HTMLElement;
  ring: HTMLElement;
  at: number;
  lead: number;
  kind: 'skill' | 'defense' | 'counter';
  anchor: () => { x: number; y: number; visible: boolean };
  done: boolean;
  fade: number;
}

export class Ui {
  readonly root: HTMLElement;
  private hooks: UiHooks;

  private bossHud!: HTMLElement;
  private bossBar!: HTMLElement;
  private bossGhost!: HTMLElement;
  private bossName!: HTMLElement;
  private breakBar!: HTMLElement;
  private breakText!: HTMLElement;
  private bossStatus!: HTMLElement;
  private timeline!: HTMLElement;
  private party!: HTMLElement;
  private center!: HTMLElement;
  private moveSide!: HTMLElement;
  private moveName!: HTMLElement;
  private moveHint!: HTMLElement;
  private segProgress!: HTMLElement;
  private judgeEl!: HTMLElement;
  private commandEl!: HTMLElement;
  private skillsEl!: HTMLElement;
  private tooltip!: HTMLElement;
  private markerLayer!: HTMLElement;
  private dmgLayer!: HTMLElement;
  private qteLayer!: HTMLElement;
  private aimLayer!: HTMLElement;
  private reticle!: HTMLElement;
  private logEl!: HTMLElement;
  private screens!: HTMLElement;
  private debugEl!: HTMLElement;
  private settingsEl!: HTMLElement;
  private hudGroups: HTMLElement[] = [];
  private dimGroups: HTMLElement[] = [];

  private dmgPool: HTMLElement[] = [];
  private dmgActive: DamageNumber[] = [];
  private rings = new Map<string, QteRing>();
  private pcNodes: Record<string, Record<string, HTMLElement>> = {};
  private markerNodes = new Map<string, { el: HTMLElement; label: HTMLElement }>();
  private wpNodes = new Map<string, { el: HTMLElement; txt: HTMLElement }>();
  private aimExit: HTMLButtonElement | null = null;
  private judgeTimer = 0;
  private logLines = 0;
  private mouse = { x: 0, y: 0 };
  private lastCommandKey = '';
  private lastSkillKey = '';

  constructor(root: HTMLElement, hooks: UiHooks) {
    this.root = root;
    this.hooks = hooks;
    this.build();
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
  }

  // ------------------------------------------------------------ 构建
  private build(): void {
    clear(this.root);
    // Boss HUD
    const hud = el('div');
    hud.id = 'boss-hud';
    const barWrap = el('div');
    barWrap.id = 'boss-bar-wrap';
    this.bossGhost = el('div');
    this.bossGhost.id = 'boss-bar-ghost';
    this.bossBar = el('div');
    this.bossBar.id = 'boss-bar';
    barWrap.append(this.bossGhost, this.bossBar);
    for (const pct of [68, 32]) {
      const tick = el('div', 'phase-tick');
      tick.style.left = pct + '%';
      tick.append(el('span', undefined, pct + '%'));
      barWrap.append(tick);
    }
    this.bossName = el('div', undefined, '四手剑客');
    this.bossName.id = 'boss-name';
    const sub = el('div', undefined, 'THE FOUR-ARMED SWORDSMAN');
    sub.id = 'boss-sub';
    const breakWrap = el('div');
    breakWrap.id = 'break-wrap';
    const bl = el('div');
    bl.id = 'break-label';
    this.breakText = el('span', undefined, '0 / 100');
    bl.append(el('span', undefined, '破防槽'), this.breakText);
    const bbw = el('div');
    bbw.id = 'break-bar-wrap';
    this.breakBar = el('div');
    this.breakBar.id = 'break-bar';
    bbw.append(this.breakBar);
    breakWrap.append(bl, bbw);
    this.bossStatus = el('div');
    this.bossStatus.id = 'boss-status';
    hud.append(barWrap, this.bossName, sub, breakWrap, this.bossStatus);
    this.bossHud = hud;

    // 时间线
    this.timeline = el('div');
    this.timeline.id = 'timeline';
    const tlTitle = el('div', undefined, '行动顺序');
    tlTitle.id = 'timeline-title';
    this.timeline.append(tlTitle);

    // 队伍
    this.party = el('div');
    this.party.id = 'party';

    // 中央提示
    this.center = el('div');
    this.center.id = 'center';
    this.moveName = el('div');
    this.moveName.id = 'move-name';
    this.center.append(this.moveName);

    // 左侧：简化防御说明 + 当前段数（主提示仍在接触点附近的提示环上）
    this.moveSide = el('div');
    this.moveSide.id = 'move-side';
    const sideTitle = el('div', 'ms-title', '防御');
    this.moveHint = el('div');
    this.moveHint.id = 'move-hint';
    this.segProgress = el('div');
    this.segProgress.id = 'seg-progress';
    this.moveSide.append(sideTitle, this.moveHint, this.segProgress);

    this.judgeEl = el('div');
    this.judgeEl.id = 'judge';

    this.commandEl = el('div');
    this.commandEl.id = 'command';
    this.commandEl.classList.add('hidden');

    this.skillsEl = el('div');
    this.skillsEl.id = 'skills';
    this.skillsEl.classList.add('hidden');

    this.tooltip = el('div');
    this.tooltip.id = 'tooltip';
    this.tooltip.classList.add('hidden');

    this.markerLayer = el('div');
    this.markerLayer.id = 'marker-layer';
    this.dmgLayer = el('div');
    this.dmgLayer.id = 'dmg-layer';
    this.qteLayer = el('div');
    this.qteLayer.id = 'qte-layer';

    this.aimLayer = el('div');
    this.aimLayer.id = 'aim-layer';
    this.aimLayer.classList.add('hidden');
    this.reticle = el('div');
    this.reticle.id = 'reticle';
    this.reticle.append(el('div', 'r1'), el('div', 'r2'));
    this.aimLayer.append(this.reticle);

    this.logEl = el('div');
    this.logEl.id = 'log';

    this.settingsEl = el('div');
    this.settingsEl.id = 'settings';
    const mkMini = (label: string, fn: () => void, id?: string) => {
      const b = el('button', 'mini', label);
      if (id) b.id = id;
      b.addEventListener('click', fn);
      return b;
    };
    const vol = el('input');
    vol.id = 'volume';
    vol.type = 'range';
    vol.min = '0';
    vol.max = '100';
    vol.value = '60';
    vol.addEventListener('input', () => this.hooks.onVolume(Number(vol.value) / 100));
    this.settingsEl.append(
      mkMini('暂停 [P]', () => this.hooks.onTogglePause(), 'btn-pause'),
      mkMini('静音', () => this.hooks.onToggleMute(), 'btn-mute'),
      vol,
      mkMini('减少晃动', () => this.hooks.onToggleShake(), 'btn-shake'),
      mkMini('低性能', () => this.hooks.onTogglePerf(), 'btn-perf'),
    );

    this.screens = el('div');
    this.screens.id = 'screens';

    this.debugEl = el('div');
    this.debugEl.id = 'debug';
    this.debugEl.classList.add('hidden');

    // Boss 攻击时只淡出时间线与战斗日志；生命（Boss 条 / 队伍面板）与空格提示必须保持可读
    this.hudGroups = [this.timeline, this.logEl];
    this.dimGroups = [this.bossHud];
    this.root.append(
      this.bossHud, this.timeline, this.party, this.center, this.moveSide, this.judgeEl,
      this.commandEl, this.skillsEl, this.markerLayer, this.qteLayer, this.dmgLayer,
      this.aimLayer, this.logEl, this.settingsEl, this.tooltip, this.screens, this.debugEl,
    );
  }

  // ------------------------------------------------------------ 工具提示
  private bindTip(node: HTMLElement, html: string): void {
    node.addEventListener('mouseenter', () => {
      this.tooltip.innerHTML = html;
      this.tooltip.classList.remove('hidden');
      this.positionTip();
    });
    node.addEventListener('mousemove', () => this.positionTip());
    node.addEventListener('mouseleave', () => this.tooltip.classList.add('hidden'));
  }

  private positionTip(): void {
    const pad = 14;
    const w = this.tooltip.offsetWidth || 240;
    const h = this.tooltip.offsetHeight || 60;
    let x = this.mouse.x + pad;
    let y = this.mouse.y + pad;
    if (x + w > window.innerWidth - 8) x = this.mouse.x - w - pad;
    if (y + h > window.innerHeight - 8) y = this.mouse.y - h - pad;
    this.tooltip.style.left = Math.max(4, x) + 'px';
    this.tooltip.style.top = Math.max(4, y) + 'px';
  }

  hideTip(): void {
    this.tooltip.classList.add('hidden');
  }

  // ------------------------------------------------------------ 常驻 HUD
  private statusIcon(s: StatusInstance): HTMLElement {
    const def = STATUS_DEFS[s.id];
    const node = el('div', 'status-icon ' + def.kind, def.icon);
    if (s.stacks > 1) node.append(el('b', undefined, String(s.stacks)));
    const turnText = s.turns > 90 ? '直到清除' : s.turns + ' 回合';
    this.bindTip(node,
      '<b>' + def.name + '</b>（' + (def.stacking === 'stacks' ? s.stacks + ' 层 / ' : '') + turnText + '）<br>'
      + describeStatus(s) + '<br><i style="color:#9a8f7d">按'
      + (def.tickOn === 'self' ? '目标自身回合' : '施加者回合') + '计时</i>');
    return node;
  }

  syncBoss(st: BattleState): void {
    const boss = st.actors[st.bossId];
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    this.bossBar.style.transform = 'scaleX(' + ratio + ')';
    this.bossGhost.style.transform = 'scaleX(' + ratio + ')';
    setText(this.bossName, boss.name);
    this.breakBar.style.width = (boss.breakGauge / boss.breakMax) * 100 + '%';
    setText(this.breakText, Math.floor(boss.breakGauge) + ' / ' + boss.breakMax + (boss.broken ? '  破防！' : ''));
    setClass(this.bossHud, 'broken', boss.broken);
    const key = boss.statuses.map((s) => s.id + s.stacks + s.turns).join(',') + (boss.broken ? 'B' : '')
      + boss.weakPoints.map((w) => w.broken ? 1 : 0).join('');
    if (this.bossStatus.dataset.key !== key) {
      this.bossStatus.dataset.key = key;
      clear(this.bossStatus);
      if (boss.broken) {
        const n = el('div', 'status-icon debuff', '破');
        this.bindTip(n, '<b>破防</b><br>受到伤害 x1.25，并失去下一次排定行动。');
        this.bossStatus.append(n);
      }
      for (const s of boss.statuses) this.bossStatus.append(this.statusIcon(s));
      for (const w of boss.weakPoints) {
        if (!w.broken) continue;
        const n = el('div', 'status-icon buff', w.id === 'gold_core' ? '金' : '紫');
        this.bindTip(n, '<b>' + w.name + '已破坏</b><br>'
          + (w.id === 'gold_core' ? '着火附加能力失效 2 个 Boss 回合。' : '下一次倒逆持续时间 -1。'));
        this.bossStatus.append(n);
      }
    }
  }

  syncTimeline(entries: QueueEntry[], st: BattleState): void {
    const key = entries.map((e) => e.actorId + Math.round(e.at * 10) + (e.kind === 'extra' ? 'x' : '')).join('|') + '#' + st.currentActorId;
    if (this.timeline.dataset.key === key) return;
    this.timeline.dataset.key = key;
    clear(this.timeline);
    const title = el('div', undefined, '行动顺序');
    title.id = 'timeline-title';
    this.timeline.append(title);
    entries.slice(0, 8).forEach((e, i) => {
      const a = st.actors[e.actorId];
      if (!a) return;
      const row = el('div', 'tl-entry' + (i === 0 ? ' now' : '') + (a.kind === 'boss' ? ' boss' : ''));
      const face = el('div', 'tl-face', a.portrait);
      face.style.color = a.color;
      row.append(face);
      if (e.kind === 'extra') row.append(el('div', 'tl-tag', e.label || '插队'));
      this.bindTip(row, '<b>' + a.name + '</b><br>' + (e.kind === 'extra' ? '插入行动<br>' : '')
        + '排定时刻 ' + e.at.toFixed(1) + '<br>速度 ' + Math.round(a.speed));
      this.timeline.append(row);
    });
  }

  syncParty(st: BattleState): void {
    if (this.party.childElementCount !== st.partyOrder.length) {
      clear(this.party);
      this.pcNodes = {};
      for (const id of st.partyOrder) {
        const a = st.actors[id];
        const card = el('div', 'pc');
        const head = el('div', 'pc-head');
        const face = el('div', 'pc-face', a.portrait);
        face.style.color = a.color;
        const namebox = el('div');
        const name = el('div', 'pc-name', a.name);
        const role = el('div', 'pc-role', a.role);
        namebox.append(name, role);
        head.append(face, namebox);
        const hpwrap = el('div', 'pc-hpwrap');
        const hp = el('div', 'pc-hp');
        hpwrap.append(hp);
        const hptext = el('div', 'pc-hptext', '');
        const apRow = el('div', 'pc-row');
        const res = el('div', 'pc-res');
        const stat = el('div', 'pc-status');
        card.append(head, hpwrap, hptext, apRow, res, stat);
        this.party.append(card);
        this.pcNodes[id] = { card, hp, hptext, apRow, res, stat, face };
      }
    }
    for (const id of st.partyOrder) {
      const a = st.actors[id];
      const n = this.pcNodes[id];
      if (!n) continue;
      setClass(n.card, 'active', st.currentActorId === id);
      setClass(n.card, 'dead', !a.alive);
      const ratio = Math.max(0, a.hp / a.maxHp);
      n.hp.style.width = ratio * 100 + '%';
      setClass(n.hp, 'low', ratio < 0.35);
      setText(n.hptext, Math.ceil(a.hp) + ' / ' + a.maxHp);
      const apKey = a.ap + '/' + a.shield;
      if (n.apRow.dataset.key !== apKey) {
        n.apRow.dataset.key = apKey;
        clear(n.apRow);
        for (let i = 0; i < 9; i++) {
          const d = el('div', 'diamond' + (i < a.ap ? ' filled' : ''));
          n.apRow.append(d);
        }
        if (a.shield > 0) {
          const sw = el('div', 'pc-shield');
          for (let i = 0; i < a.shield; i++) sw.append(el('div', 'shield-pip'));
          this.bindTip(sw, '<b>护盾 ' + a.shield + ' 层</b><br>每层完全吸收一段命中，然后移除一层。完美格挡不消耗护盾。');
          n.apRow.append(sw);
        }
      }
      const resKey = this.resourceKey(a);
      if (n.res.dataset.key !== resKey) {
        n.res.dataset.key = resKey;
        clear(n.res);
        this.renderResource(a, n.res, st);
      }
      const stKey = a.statuses.map((s) => s.id + s.stacks + s.turns).join(',');
      if (n.stat.dataset.key !== stKey) {
        n.stat.dataset.key = stKey;
        clear(n.stat);
        for (const s of a.statuses) n.stat.append(this.statusIcon(s));
      }
    }
  }

  private resourceKey(a: ActorState): string {
    if (a.id === 'sciel') return 'f' + JSON.stringify(a.foretell) + a.phaseTag + a.twilightTurns;
    if (a.id === 'lune') return 's' + a.stains.join('');
    return 'st' + a.stance;
  }

  private renderResource(a: ActorState, node: HTMLElement, st: BattleState): void {
    if (a.id === 'sciel') {
      const tagName = a.phaseTag === 'sun' ? '旭日' : a.phaseTag === 'moon' ? '月相' : '薄暮';
      const tag = el('span', 'stance-tag' + (a.phaseTag === 'twilight' ? ' stance-virtuose' : ''), tagName);
      const f = a.foretell[st.bossId] || 0;
      const txt = el('span', undefined, '先见 ' + f);
      node.append(tag, txt);
      this.bindTip(node, a.phaseTag === 'sun'
        ? '<b>旭日</b><br>技能消耗先见时，每消耗 1 层，行动点 +1（每次技能最多 4 点）。'
        : a.phaseTag === 'moon'
          ? '<b>月相</b><br>消耗先见的技能每层额外 +10% 伤害（最多 10 层）。'
          : '<b>薄暮</b><br>伤害 +75%，施加的先见层数 x2，先见层数上限 x2。剩余 ' + a.twilightTurns + ' 个熙艾尔回合。');
      return;
    }
    if (a.id === 'lune') {
      for (let i = 0; i < a.maxStains; i++) {
        const s = a.stains[i];
        const d = el('div', 'stain');
        if (s) {
          d.style.background = stainColor(s);
          d.title = stainLabel(s);
        } else {
          d.style.background = 'transparent';
          d.style.borderColor = 'rgba(255,255,255,0.2)';
        }
        node.append(d);
      }
      this.bindTip(node, '<b>异色印记</b><br>当前：' + (a.stains.length ? a.stains.map(stainLabel).join(' / ') : '空')
        + '<br>从左到右填充，槽满时替换最早的一个。技能可生成或消费特定异色。');
      return;
    }
    const stance = a.stance;
    const cls = stance === 'offensive' ? ' stance-offensive' : stance === 'defensive' ? ' stance-defensive'
      : stance === 'virtuose' ? ' stance-virtuose' : '';
    node.append(el('span', 'stance-tag' + cls, STANCE_NAMES[stance]));
    this.bindTip(node, '<b>剑术姿态：' + STANCE_NAMES[stance] + '</b><br>'
      + (stance === 'offensive' ? '造成伤害 x1.50，所受伤害 x1.35。'
        : stance === 'defensive' ? '所受伤害 x0.50；每次格挡额外获得 1 AP（每套最多 2 点）。'
          : stance === 'virtuose' ? '造成伤害 x3.00；完成一个伤害技能后回到无姿态。'
            : '尚未进入任何姿态。'));
  }

  setHudFaded(faded: boolean): void {
    for (const g of this.hudGroups) setClass(g, 'faded', faded);
    for (const g of this.dimGroups) setClass(g, 'dimmed', faded);
  }

  // ------------------------------------------------------------ 中央 / 判定
  showMove(name: string, hint: string): void {
    setText(this.moveName, name);
    setText(this.moveHint, hint);
    this.center.classList.add('show');
    this.moveSide.classList.add('show');
  }

  hideMove(): void {
    this.center.classList.remove('show');
    this.moveSide.classList.remove('show');
    clear(this.segProgress);
    delete this.segProgress.dataset.key;
  }

  setSegments(grades: (string | undefined)[], total: number): void {
    const key = grades.join(',') + '/' + total;
    if (this.segProgress.dataset.key === key) return;
    this.segProgress.dataset.key = key;
    clear(this.segProgress);
    let done = 0;
    for (let i = 0; i < total; i++) {
      const g = grades[i];
      if (g) done += 1;
      this.segProgress.append(el('div', 'seg' + (g ? ' ' + g : '')));
    }
    this.segProgress.append(el('span', undefined, done + ' / ' + total));
  }

  popJudge(text: string, color: string): void {
    this.judgeEl.textContent = text;
    this.judgeEl.style.color = color;
    this.judgeEl.classList.remove('pop');
    void this.judgeEl.offsetWidth;
    this.judgeEl.classList.add('pop');
  }

  log(text: string, tone?: string): void {
    const line = el('div', tone || '', text);
    this.logEl.prepend(line);
    this.logLines += 1;
    while (this.logEl.childElementCount > 12) this.logEl.lastChild && this.logEl.removeChild(this.logEl.lastChild);
  }

  // ------------------------------------------------------------ 伤害数字
  damage(x: number, y: number, text: string, color: string, tag: string, size: number): void {
    let node = this.dmgPool.pop();
    if (!node) {
      node = el('div', 'dmg');
      this.dmgLayer.append(node);
    }
    node.style.display = 'block';
    node.style.color = color;
    node.style.fontSize = size + 'px';
    clear(node);
    node.append(document.createTextNode(text));
    if (tag) node.append(el('span', 'tag', tag));
    const stacked = this.dmgActive.filter((d) => Math.abs(d.x - x) < 60 && Math.abs(d.y - y) < 46).length;
    const item: DamageNumber = {
      el: node,
      x: x + (Math.random() - 0.5) * 34,
      y: y - stacked * 26,
      vx: (Math.random() - 0.5) * 26,
      vy: -78 - Math.random() * 26,
      life: 0,
      total: 1.0,
    };
    this.dmgActive.push(item);
  }

  private updateDamage(dt: number): void {
    for (let i = this.dmgActive.length - 1; i >= 0; i--) {
      const d = this.dmgActive[i];
      d.life += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 132 * dt;
      const p = d.life / d.total;
      d.el.style.transform = 'translate(' + Math.round(d.x) + 'px,' + Math.round(d.y) + 'px) scale('
        + (p < 0.16 ? 0.7 + p * 2.2 : 1.02 - p * 0.1).toFixed(3) + ')';
      d.el.style.opacity = String(p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3));
      if (d.life >= d.total) {
        d.el.style.display = 'none';
        this.dmgPool.push(d.el);
        this.dmgActive.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------ 空格提示环
  addRing(id: string, at: number, lead: number, kind: 'skill' | 'defense' | 'counter', jump: boolean,
    anchor: () => { x: number; y: number; visible: boolean }): void {
    if (this.rings.has(id)) return;
    const node = el('div', 'qte ' + kind + (jump ? ' jump' : ''));
    const ring = el('div', 'ring');
    const core = el('div', 'core');
    const key = el('div', 'key', jump ? 'SPACE 跳跃' : kind === 'counter' ? 'SPACE 反击' : 'SPACE');
    node.append(ring, core, key);
    this.qteLayer.append(node);
    this.rings.set(id, { el: node, ring, at, lead, kind, anchor, done: false, fade: 0 });
  }

  markRing(id: string, grade: string): void {
    const r = this.rings.get(id);
    if (!r) return;
    r.done = true;
    r.fade = 0;
    r.ring.style.borderColor = grade === 'perfect' ? '#fff3cf' : grade === 'good' || grade === 'block' ? '#ffffff' : '#ff5a3c';
    r.ring.style.boxShadow = grade === 'perfect' ? '0 0 26px #ffe4a8' : 'none';
  }

  clearRings(): void {
    for (const [, r] of this.rings) r.el.remove();
    this.rings.clear();
  }

  private updateRings(now: number, dt: number): void {
    for (const [id, r] of [...this.rings]) {
      const a = r.anchor();
      r.el.style.left = a.x + 'px';
      r.el.style.top = a.y + 'px';
      const remain = r.at - now;
      const p = Math.max(0, Math.min(1, remain / r.lead));
      const scale = r.done ? 1 + r.fade * 1.2 : 0.34 + p * 1.5;
      r.ring.style.transform = 'rotate(45deg) scale(' + scale.toFixed(3) + ')';
      r.el.style.opacity = String(r.done ? Math.max(0, 1 - r.fade * 3.4) : (a.visible ? Math.min(1, (1 - p) * 2.6 + 0.28) : 0.25));
      if (r.done) {
        r.fade += dt;
        if (r.fade > 0.36) {
          r.el.remove();
          this.rings.delete(id);
        }
      } else if (remain < -520) {
        r.el.remove();
        this.rings.delete(id);
      }
    }
  }

  // ------------------------------------------------------------ 指令菜单
  showCommand(st: BattleState, sx: number, sy: number): void {
    const actor = st.actors[st.currentActorId || ''];
    if (!actor) return;
    const key = actor.id + actor.ap + st.inventory.heal + st.inventory.energy + st.inventory.revive;
    this.commandEl.classList.remove('hidden');
    this.commandEl.style.left = Math.round(Math.max(24, Math.min(sx, window.innerWidth - 260))) + 'px';
    this.commandEl.style.top = Math.round(Math.max(120, Math.min(sy, window.innerHeight - 250))) + 'px';
    if (this.lastCommandKey === key) return;
    this.lastCommandKey = key;
    clear(this.commandEl);
    const items: { label: string; sub: string; kind: 'attack' | 'skill' | 'aim' | 'item'; disabled?: string }[] = [
      { label: '攻击', sub: '3 段连协 · 赚取行动点', kind: 'attack' },
      { label: '技能', sub: actor.name + ' · 6 项', kind: 'skill' },
      { label: '瞄准', sub: '击破弱点 · 每发 1 AP', kind: 'aim', disabled: actor.ap < 1 ? 'AP 不足' : undefined },
      { label: '道具', sub: '亮色 ' + (st.inventory.heal + st.inventory.energy + st.inventory.revive) + ' 个', kind: 'item',
        disabled: (st.inventory.heal + st.inventory.energy + st.inventory.revive) <= 0 ? '库存为空' : undefined },
    ];
    for (const it of items) {
      const b = el('button', 'cmd-btn');
      b.append(document.createTextNode(it.label), el('small', undefined, it.disabled ? it.disabled : it.sub));
      if (it.disabled) b.setAttribute('disabled', 'true');
      else b.addEventListener('click', () => this.hooks.onCommand(it.kind));
      this.commandEl.append(b);
    }
  }

  hideCommand(): void {
    this.commandEl.classList.add('hidden');
    this.lastCommandKey = '';
  }

  showSkills(st: BattleState, sx: number, sy: number, mode: 'skill' | 'item'): void {
    const actor = st.actors[st.currentActorId || ''];
    if (!actor) return;
    this.skillsEl.classList.remove('hidden');
    this.skillsEl.style.left = Math.round(Math.max(24, Math.min(sx, window.innerWidth - 400))) + 'px';
    this.skillsEl.style.top = Math.round(Math.max(96, Math.min(sy, window.innerHeight - 320))) + 'px';
    this.skillsEl.style.transform = 'skewY(-4deg) rotate(0.6deg)';
    const key = mode + actor.id + actor.ap + actor.stains.join('') + actor.stance + actor.phaseTag
      + st.inventory.heal + st.inventory.energy + st.inventory.revive;
    if (this.lastSkillKey === key) return;
    this.lastSkillKey = key;
    clear(this.skillsEl);
    const head = el('div');
    head.id = 'skills-head';
    const owner = el('div', undefined, actor.name + (mode === 'item' ? ' · 道具' : ' · 技能'));
    owner.id = 'skills-owner';
    const note = el('div');
    note.id = 'skills-note';
    note.textContent = this.professionNote(actor, st);
    head.append(owner, note);
    this.skillsEl.append(head);

    if (mode === 'item') {
      for (const item of ITEM_DEFS) {
        const count = (st.inventory as unknown as Record<string, number>)[item.id];
        const row = el('div', 'sk');
        const dot = el('div', 'sk-el');
        dot.style.background = '#8ddc7f';
        const box = el('div');
        box.append(el('div', 'sk-name', item.name), el('div', 'sk-desc', item.desc));
        row.append(dot, box, el('div', 'sk-target', TARGET_NAMES[item.target]), el('div', 'sk-ap', 'x' + count));
        if (count <= 0) row.setAttribute('disabled', 'true');
        else row.addEventListener('click', () => this.hooks.onItem(item.id));
        this.bindTip(row, '<b>' + item.name + '</b><br>' + item.longDesc);
        this.skillsEl.append(row);
      }
    } else {
      for (const sk of skillsOf(actor.id)) {
        const cost = effectiveApCost(sk, actor);
        const row = el('div', 'sk');
        const dot = el('div', 'sk-el');
        const elemKey = sk.element === 'weapon' ? actor.weaponElement : sk.element === 'dynamic' ? 'light' : sk.element;
        dot.style.background = ELEMENT_COLORS[elemKey] || '#e9e0d1';
        const box = el('div');
        box.append(el('div', 'sk-name', sk.name), el('div', 'sk-desc', sk.desc));
        const tgt = el('div', 'sk-target');
        tgt.append(document.createTextNode(TARGET_NAMES[sk.target] || sk.target));
        const elLabel = el('div', undefined, sk.element === 'weapon' ? '武器'
          : sk.element === 'dynamic' ? '动态' : ELEMENT_NAMES[sk.element]);
        elLabel.style.fontSize = '8px';
        tgt.append(elLabel);
        row.append(dot, box, tgt, el('div', 'sk-ap', String(cost)));
        const affordable = actor.ap >= cost;
        const needsDead = sk.target === 'deadAlly' && !st.partyOrder.some((id) => !st.actors[id].alive);
        if (!affordable || needsDead) {
          row.setAttribute('disabled', 'true');
          const why = !affordable ? 'AP 不足（需要 ' + cost + '，当前 ' + actor.ap + '）' : '没有倒下的队员';
          this.bindTip(row, '<b>' + sk.name + '</b> · ' + cost + ' AP<br>' + sk.longDesc
            + '<br><span style="color:#ff8f7a">' + why + '</span>');
        } else {
          row.addEventListener('click', () => this.hooks.onSkill(sk.id));
          this.bindTip(row, '<b>' + sk.name + '</b> · ' + cost + ' AP · '
            + (TARGET_NAMES[sk.target] || sk.target) + '<br>' + sk.longDesc
            + (sk.breakValue ? '<br>破防值 +' + sk.breakValue : '')
            + (sk.promptTimes.length ? '<br>连协提示 ' + sk.promptTimes.length + ' 次' : ''));
        }
        this.skillsEl.append(row);
      }
    }
    const foot = el('div');
    foot.id = 'skills-foot';
    foot.append(el('span', undefined, '右键 / Esc 返回'), el('span', undefined, '当前 AP ' + actor.ap + ' / 9'));
    this.skillsEl.append(foot);
  }

  private professionNote(actor: ActorState, st: BattleState): string {
    if (actor.id === 'sciel') {
      if (actor.phaseTag === 'sun') return '旭日：每消耗 1 层先见，行动点 +1';
      if (actor.phaseTag === 'moon') return '月相：消耗先见的技能每层伤害 +10%';
      return '薄暮：伤害 +75%，施加的先见层数 x2，先见层数上限 x2';
    }
    if (actor.id === 'lune') {
      return '异色 ' + actor.stains.length + '/4：' + (actor.stains.length ? actor.stains.map(stainLabel).join('·') : '空槽');
    }
    const s = actor.stance;
    if (s === 'offensive') return '攻：造成伤害 x1.50，所受伤害 x1.35';
    if (s === 'defensive') return '守：所受伤害 x0.50，格挡额外 +1 AP';
    if (s === 'virtuose') return '高手：造成伤害 +200%';
    return '无姿态：使用技能进入攻 / 守 / 高手';
  }

  hideSkills(): void {
    this.skillsEl.classList.add('hidden');
    this.lastSkillKey = '';
  }

  // ------------------------------------------------------------ 目标标记（节点复用，避免每帧重建导致点击失效）
  setMarkers(items: { id: string; x: number; y: number; label: string; enemy: boolean }[]): void {
    const ids = new Set(items.map((i) => i.id));
    for (const [id, n] of [...this.markerNodes]) {
      if (!ids.has(id)) {
        n.el.remove();
        this.markerNodes.delete(id);
      }
    }
    for (const it of items) {
      let n = this.markerNodes.get(it.id);
      if (!n) {
        const m = el('div', 'marker');
        const shape = el('div', it.enemy ? 'cross' : 'rhombus');
        const label = el('div', 'label', it.label);
        m.append(shape, label);
        m.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.hooks.onTarget(it.id);
        });
        this.markerLayer.append(m);
        n = { el: m, label };
        this.markerNodes.set(it.id, n);
      }
      n.el.style.left = Math.round(it.x) + 'px';
      n.el.style.top = Math.round(it.y) + 'px';
      if (n.label.textContent !== it.label) n.label.textContent = it.label;
    }
  }

  clearMarkers(): void {
    for (const [, n] of this.markerNodes) n.el.remove();
    this.markerNodes.clear();
  }

  // ------------------------------------------------------------ 瞄准
  setAim(active: boolean): void {
    setClass(this.aimLayer, 'hidden', !active);
  }

  updateAim(points: { id: string; x: number; y: number; name: string; broken: boolean }[], apLeft: number): void {
    this.reticle.style.left = this.mouse.x + 'px';
    this.reticle.style.top = this.mouse.y + 'px';
    for (const p of points) {
      let n = this.wpNodes.get(p.id);
      if (!n) {
        const w = el('div', 'weakpoint');
        const txt = el('div', 'txt', p.name);
        w.append(el('div', 'halo'), txt);
        w.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.hooks.onAimShot(p.id, this.mouse.x, this.mouse.y);
        });
        this.aimLayer.append(w);
        n = { el: w, txt };
        this.wpNodes.set(p.id, n);
      }
      n.el.style.left = Math.round(p.x) + 'px';
      n.el.style.top = Math.round(p.y) + 'px';
      setClass(n.el, 'broken', p.broken);
      const label = p.name + (p.broken ? '（已破坏）' : '');
      if (n.txt.textContent !== label) n.txt.textContent = label;
    }
    if (!this.aimExit) {
      const exit = el('button', 'mini aim-exit', '结束瞄准');
      exit.style.position = 'absolute';
      exit.style.right = '22px';
      exit.style.bottom = '160px';
      exit.style.pointerEvents = 'auto';
      exit.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.hooks.onAimEnd();
      });
      this.aimLayer.append(exit);
      this.aimExit = exit;
    }
    const t = '结束瞄准（剩余 ' + apLeft + ' AP）';
    if (this.aimExit.textContent !== t) this.aimExit.textContent = t;
  }

  bindAimSurface(handler: (x: number, y: number) => void): void {
    this.aimLayer.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      handler(ev.clientX, ev.clientY);
    });
    this.aimLayer.style.pointerEvents = 'auto';
  }

  // ------------------------------------------------------------ 全屏界面
  showDifficulty(current: DifficultyId): void {
    clear(this.screens);
    const s = el('div', 'screen');
    s.append(this.title('四手剑客', 'CLAIR OBSCUR 风格 · 远征队 Boss 战原型'));
    const list = el('div');
    list.id = 'difficulty-list';
    for (const id of DIFFICULTY_ORDER) {
      const cfg: DifficultyConfig = DIFFICULTIES[id];
      const card = el('div', 'diff-card' + (id === 'standard' ? ' rec' : ''));
      card.append(el('h2', undefined, cfg.name));
      const en = el('div', 'en', cfg.subtitle);
      card.append(en);
      const ul = el('ul');
      for (const b of cfg.blurb) ul.append(el('li', undefined, b));
      ul.append(el('li', undefined, 'Boss 生命 ' + cfg.bossHp.toLocaleString() + ' · 伤害 x' + cfg.bossDamageMul));
      card.append(ul);
      if (id === 'standard') card.append(el('div', 'rec-tag', '推荐 · 默认'));
      card.addEventListener('click', () => this.hooks.onDifficulty(id));
      list.append(card);
    }
    s.append(list);
    const tip = el('div', 'sub', '鼠标点击操作 · 空格完成所有实时判定 · 难度在战斗中不可切换');
    tip.style.marginTop = '24px';
    s.append(tip);
    this.screens.append(s);
    void current;
  }

  private title(main: string, sub: string): HTMLElement {
    const box = el('div');
    box.style.textAlign = 'center';
    box.append(el('h1', undefined, main), el('div', 'sub', sub));
    return box;
  }

  showPause(): void {
    clear(this.screens);
    const s = el('div', 'screen');
    s.id = 'pause-screen';
    s.append(this.title('暂停', '模拟时钟已冻结 · 按 P 或点击继续'));
    const actions = el('div', 'screen-actions');
    const cont = el('button', 'big-btn', '继续');
    cont.addEventListener('click', () => this.hooks.onTogglePause());
    const back = el('button', 'big-btn', '返回难度选择');
    back.addEventListener('click', () => this.hooks.onToDifficulty());
    actions.append(cont, back);
    s.append(actions);
    this.screens.append(s);
  }

  hideScreens(): void {
    clear(this.screens);
  }

  showResult(win: boolean, st: BattleState, seed: number): void {
    clear(this.screens);
    const s = el('div', 'screen');
    const panel = el('div');
    panel.id = 'result-panel';
    panel.append(el('h1', undefined, win ? '胜利' : '失败'));
    panel.append(el('div', 'sub', win ? 'VICTORY · 四手剑客已崩解' : 'DEFEAT · 远征队全员倒下'));
    const grid = el('div', 'res-grid');
    const stats = st.stats;
    const mm = Math.floor(stats.elapsedMs / 60000);
    const ss = Math.floor((stats.elapsedMs % 60000) / 1000);
    const timeText = mm + ':' + String(ss).padStart(2, '0');
    const dyn = el('div', 'res-block');
    dyn.append(el('h3', undefined, '本局战斗数据'));
    const promptTotal = stats.promptPerfect + stats.promptGood + stats.promptMiss;
    const rows: [string, string][] = [
      ['战斗用时', timeText],
      ['伤害总计', stats.totalDamage.toLocaleString()],
      ['最高单段伤害', stats.maxHit.toLocaleString()],
      ['所受伤害总计', stats.damageTaken.toLocaleString()],
      ['完美格挡 / 普通 / 失手', stats.perfectBlocks + ' / ' + stats.normalBlocks + ' / ' + stats.missedBlocks],
      ['最佳连续格挡', String(stats.bestBlockChain)],
      ['完整反击次数', String(stats.fullCounters)],
      ['技能连协命中率', promptTotal ? Math.round(((stats.promptPerfect + stats.promptGood) / promptTotal) * 100) + '%' : '—'],
      ['击破弱点', String(stats.weakPointsBroken)],
      ['治疗总计', stats.healing.toLocaleString()],
      ['难度', DIFFICULTIES[st.difficulty].name],
      ['随机种子', String(seed)],
    ];
    if (!win) {
      rows.unshift(['Boss 剩余生命', Math.round((st.actors[st.bossId].hp / st.actors[st.bossId].maxHp) * 100) + '%']);
    }
    for (const [k, v] of rows) {
      const r = el('div', 'res-row');
      r.append(el('span', undefined, k), el('span', undefined, v));
      dyn.append(r);
    }
    grid.append(dyn);

    const right = el('div', 'res-block');
    if (win) {
      right.append(el('h3', undefined, '战利品'));
      for (const [k, v] of [['经验', '27,560'], ['战利', '3,950'], ['剑客长刀', 'Lv.9'], ['连续攻击一', '武器技'], ['精良催化源色', 'x3']] as [string, string][]) {
        const r = el('div', 'res-row');
        r.append(el('span', undefined, k), el('span', undefined, v));
        right.append(r);
      }
      const lvTitle = el('h3', undefined, '远征队');
      lvTitle.style.marginTop = '12px';
      right.append(lvTitle);
      for (const id of st.partyOrder) {
        const a = st.actors[id];
        const row = el('div', 'res-lv');
        row.append(el('span', undefined, a.name + ' Lv.32'));
        const bar = el('div', 'bar');
        const i = el('i');
        i.style.width = '18%';
        bar.append(i);
        row.append(bar);
        const gain = el('span', undefined, '+9,186');
        row.append(gain);
        right.append(row);
        window.setTimeout(() => { i.style.width = '76%'; }, 260);
      }
    } else {
      right.append(el('h3', undefined, '战况'));
      for (const id of st.partyOrder) {
        const a = st.actors[id];
        const r = el('div', 'res-row');
        r.append(el('span', undefined, a.name), el('span', undefined, a.alive ? '存活' : '倒下'));
        right.append(r);
      }
      const tip = el('div', 'res-row');
      tip.append(el('span', undefined, '建议'), el('span', undefined, '逐段格挡，别用一次按键挡整套'));
      right.append(tip);
    }
    grid.append(right);
    panel.append(grid);

    const actions = el('div', 'screen-actions');
    const retry = el('button', 'big-btn', win ? '再次挑战' : '立即重试');
    retry.addEventListener('click', () => this.hooks.onRestart());
    const back = el('button', 'big-btn', '返回难度选择');
    back.addEventListener('click', () => this.hooks.onToDifficulty());
    const exp = el('button', 'big-btn', '导出战斗日志');
    exp.addEventListener('click', () => this.hooks.onExportLog());
    actions.append(retry, back, exp);
    panel.append(actions);
    s.append(panel);
    this.screens.append(s);
  }

  // ------------------------------------------------------------ 设置按钮状态
  setToggle(id: string, on: boolean, label: string): void {
    const b = this.root.querySelector('#' + id) as HTMLElement | null;
    if (!b) return;
    setClass(b, 'on', on);
    b.textContent = label;
  }

  // ------------------------------------------------------------ 调试面板
  enableDebug(): void {
    this.debugEl.classList.remove('hidden');
  }

  renderDebug(html: string, buttons: { label: string; action: string }[], logText: string): void {
    if (this.debugEl.classList.contains('hidden')) return;
    if (this.debugEl.dataset.built !== '1') {
      this.debugEl.dataset.built = '1';
      clear(this.debugEl);
      this.debugEl.append(el('h4', undefined, '调试面板 ?debug=1'));
      const info = el('div');
      info.id = 'dbg-info';
      this.debugEl.append(info, el('hr'));
      const btns = el('div');
      btns.id = 'dbg-btns';
      for (const b of buttons) {
        const node = el('button', undefined, b.label);
        node.addEventListener('click', () => this.hooks.onDebug(b.action));
        btns.append(node);
      }
      this.debugEl.append(btns, el('hr'));
      const ta = el('textarea');
      ta.id = 'dbg-log';
      ta.placeholder = '战斗日志 JSON（导出后可复制；粘贴后点重放）';
      const row = el('div');
      const exp = el('button', undefined, '导出日志');
      exp.addEventListener('click', () => this.hooks.onExportLog());
      const imp = el('button', undefined, '导入并重放');
      imp.addEventListener('click', () => this.hooks.onImportLog(ta.value));
      row.append(exp, imp);
      this.debugEl.append(ta, row);
    }
    const info = this.debugEl.querySelector('#dbg-info') as HTMLElement;
    if (info) info.innerHTML = html;
    const ta = this.debugEl.querySelector('#dbg-log') as HTMLTextAreaElement;
    if (ta && logText && document.activeElement !== ta) ta.value = logText;
  }

  // ------------------------------------------------------------ 每帧
  tick(now: number, dtMs: number): void {
    const dt = Math.min(0.1, dtMs / 1000);
    this.updateDamage(dt);
    this.updateRings(now, dt);
  }

  flashScreen(kind: 'hurt' | 'perfect'): void {
    const v = document.getElementById('vignette');
    if (!v) return;
    v.classList.add(kind);
    window.setTimeout(() => v.classList.remove(kind), kind === 'perfect' ? 180 : 260);
  }
}
