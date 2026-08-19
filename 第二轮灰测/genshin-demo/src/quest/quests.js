// 任务系统（模块 D）。主线 + 支线统一驱动：触发条件、对话、奖励、事件。
// 契约：export class QuestSystem { constructor(ctx); update(dt); accept(id); complete(id); state; get active(); }
import { height } from '../world/heightfield.js';
import { speak } from './story.js';
import { MAIN_QUESTS } from './story.js';
import { SIDE_QUESTS } from './sidequests.js';

function enemyFamily(type) {
  if (!type) return 'unknown';
  if (type.startsWith('slime')) return 'slime';
  if (type.startsWith('hilichurl') || type === 'mitachurl') return 'hilichurl';
  if (type === 'ruinguard') return 'ruinguard';
  if (type === 'boss_dvalin') return 'boss_dvalin';
  return type;
}

// dev 场景地面在 y=0；真实世界用 height()
function groundY(ctx, x, z) { return ctx.dev ? 0 : height(x, z); }

export class QuestSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.defs = new Map();
    this.state = {};      // id -> { status, step, steps:[{text,done}] }
    this._q = new Map();  // id -> 运行时对象
    this._handles = [];   // 本系统注册的交互点（用于 dispose）
    this._listeners = [];

    for (const def of MAIN_QUESTS) this.register(def);
    for (const def of SIDE_QUESTS) this.register(def);

    this._wire();
  }

  register(def) {
    this.defs.set(def.id, def);
    this.state[def.id] = { status: 'available', step: 0, steps: def.steps.map(s => ({ text: s.text, done: false })) };
  }

  // ---- 状态查询 ----

  get active() {
    const out = [];
    for (const q of this._q.values()) if (q.status === 'active') {
      out.push({ id: q.id, title: q.def.title, steps: q.steps.map(s => ({ text: s.text, done: s.done })), active: true });
    }
    return out;
  }

  get(id) { return this._q.get(id) ?? null; }
  isActive(id) { return this._q.get(id)?.status === 'active'; }
  isDone(id) { return this._q.get(id)?.status === 'done'; }

  /** NPCSystem 查询：是否有支线正等着与这个 NPC 对话以接取。 */
  hasAcceptNPC(id) {
    for (const def of this.defs.values()) {
      if (def.autoAccept === 'npc:' + id && this.state[def.id]?.status === 'available') return true;
    }
    return false;
  }

  /** NPCSystem 查询：当前主线步骤是否想与这个 NPC 对话（此时 NPC 隐藏闲聊）。 */
  wantsNPC(id) {
    for (const q of this._q.values()) if (q.status === 'active') {
      const s = q.steps[q.step];
      if (s && !s.done && s.trigger?.type === 'npc' && s.trigger.id === id) return true;
    }
    return false;
  }

  // ---- 接取 / 完成 ----

  accept(id, opts = {}) {
    const def = this.defs.get(id);
    if (!def) return null;
    const existing = this._q.get(id);
    if (existing && existing.status !== 'done') return existing;

    const q = {
      id, def, status: 'active', step: 0, busy: false, timer: 0,
      steps: def.steps.map(s => ({
        text: s.text, done: false, trigger: s.trigger ? { ...s.trigger } : null,
        dialogue: s.dialogue, onEnter: s.onEnter, onDone: s.onDone, reward: s.reward,
      })),
      progress: { kills: {}, gathers: {}, puzzles: [], order: {}, bonus: !!opts.bonus, share: opts.share !== false },
      _spotHandles: [],
    };
    // 支线分支：猫咪寻找顺序
    if (id === 'side_1') {
      const first = opts.first || 'fish';
      const all = ['cat_fish', 'cat_sun', 'cat_roof'];
      const idx = { fish: 0, sun: 1, roof: 2 }[first] ?? 0;
      q.progress.order = { first: all[idx], second: all[(idx + 1) % 3], third: all[(idx + 2) % 3] };
    }
    this._q.set(id, q);
    this.state[id].status = 'active';
    this.state[id].step = 0;
    this._syncState(q);
    this.ctx.ui?.quest?.set?.(this.active);
    this.ctx.ui?.toast?.('接受任务：' + def.title);
    this.ctx.ui?.quest?.flash?.('新任务：' + def.title);
    this.ctx.audio?.sfx?.('quest_accept');
    this.ctx.events?.emit('quest:accepted', { quest: { id, title: def.title } });
    this._advanceTo(q, 0);
    return q;
  }

  /** 完成当前步骤（测试 / 调试也用它）。返回 Promise，便于 await。 */
  advance(id) {
    const q = this._q.get(id);
    if (!q || q.status !== 'active') return Promise.resolve();
    return this._completeStep(q, q.step);
  }

  /** 直接完成整个任务。 */
  complete(id) {
    const q = this._q.get(id);
    if (!q) return;
    q.status = 'done';
    for (const s of q.steps) s.done = true;
    this._clearSpotHandles(q);
    this._syncState(q);
    this._finish(q);
  }

  // ---- 内部：步骤推进 ----

  _advanceTo(q, index) {
    if (index >= q.steps.length) { this._finish(q); return; }
    q.step = index; q.timer = 0; q.busy = false;
    const s = q.steps[index];
    s.done = false;
    this._clearSpotHandles(q);
    this._setupSpotHandles(q, s);
    this._syncState(q);
    this.ctx.ui?.quest?.set?.(this.active);
    this.ctx.ui?.quest?.flash?.(s.text);
    this.ctx.events?.emit('quest:step', { quest: { id: q.id, title: q.def.title }, step: index, text: s.text });
    try { s.onEnter?.(this.ctx, q); } catch (e) { console.log('[quest] onEnter', e); }
    // auto 步骤：延时后完成（对话在完成时播放）
    if (s.trigger?.type === 'auto') { q.timer = (s.trigger.delay ?? 0) + 1e-6; }
  }

  _setupSpotHandles(q, s) {
    if (s.trigger?.type !== 'interact') return;
    const id = this._resolveToken(q, s.trigger.id);
    const spot = q.def.spots?.[id];
    if (!spot || !this.ctx.interact || this.ctx.dev) return;
    const handle = this._register(q, spot, () => this._completeStep(q, q.step));
    q._spotHandles.push(handle);
  }

  _clearSpotHandles(q) {
    for (const h of q._spotHandles) try { h?.remove?.(); } catch {}
    q._spotHandles.length = 0;
  }

  _register(q, spot, onInteract) {
    try {
      const pos = new this.ctx.THREE.Vector3(spot.x, groundY(this.ctx, spot.x, spot.z), spot.z);
      const handle = this.ctx.interact.register({
        pos, radius: 2.6, label: spot.label, icon: spot.icon || 'talk', once: false,
        onInteract: (ctx) => onInteract(ctx),
      });
      this._handles.push(handle);
      return handle;
    } catch (e) { console.log('[quest] register spot', e); return null; }
  }

  _resolveToken(q, id) {
    let out = String(id);
    if (q.progress.order) out = out.replace(/{first}|{second}|{third}/g, t => q.progress.order[t.slice(1, -1)] ?? t);
    return out;
  }

  _completeStep(q, index) {
    if (q.status !== 'active' || q.busy) return Promise.resolve();
    if (q.steps[index]?.done) return Promise.resolve();
    q.busy = true;
    const s = q.steps[index];
    s.done = true;
    return (async () => {
      try {
        if (s.dialogue) await speak(this.ctx, s.dialogue);
        if (s.reward) this.ctx.ui?.toast?.('获得 ' + s.reward);
        try { s.onDone?.(this.ctx, q); } catch (e) { console.log('[quest] onDone', e); }
        this._clearSpotHandles(q);
        this._syncState(q);
        this._advanceTo(q, index + 1);
      } catch (e) { console.log('[quest] completeStep', e); }
      finally { q.busy = false; }
    })();
  }

  _finish(q) {
    q.status = 'done';
    this.state[q.id].status = 'done';
    this._syncState(q);
    this.ctx.ui?.quest?.set?.(this.active);
    // 奖励（含分支奖励）
    let reward = q.def.reward || '';
    if (q.id === 'side_4' && q.progress.bonus) reward += ' + 摩拉 ×500';
    if (q.id === 'side_5' && q.progress.share) reward += ' + 摩拉 ×400';
    if (reward) this.ctx.ui?.toast?.('任务完成！获得 ' + reward);
    this.ctx.ui?.quest?.flash?.('任务完成：' + q.def.title);
    this.ctx.audio?.sfx?.('quest_complete');
    this.ctx.events?.emit('quest:completed', { quest: { id: q.id, title: q.def.title, reward } });
    // 主线：自动接取下一章
    for (const def of this.defs.values()) {
      if (def.requires === q.id && this.state[def.id]?.status === 'available') this.accept(def.id);
    }
  }

  _syncState(q) {
    const st = this.state[q.id];
    if (!st) return;
    st.status = q.status; st.step = q.step;
    st.steps = q.steps.map(s => ({ text: s.text, done: s.done }));
  }

  // ---- 事件驱动 ----

  _wire() {
    const ctx = this.ctx;
    const on = (n, f) => { const un = ctx.events?.on?.(n, f); if (un) this._listeners.push(un); };
    on('enemy:died', (p) => {
      const fam = enemyFamily(p?.type);
      for (const q of this._q.values()) if (q.status === 'active') q.progress.kills[fam] = (q.progress.kills[fam] ?? 0) + 1;
    });
    on('gather', (p) => {
      const item = p?.type ?? p?.item;
      if (!item) return;
      for (const q of this._q.values()) if (q.status === 'active') q.progress.gathers[item] = (q.progress.gathers[item] ?? 0) + 1;
    });
    on('puzzle:solved', (p) => {
      const id = p?.id;
      if (!id) return;
      for (const q of this._q.values()) if (q.status === 'active') q.progress.puzzles.push(id);
    });
    on('npc:talk', (p) => {
      this._onNPCTalk(p?.id);
    });
    on('player:region', (p) => {
      this._onRegion(p?.region);
    });
    on('game:ready', () => {
      // 严格串行：开局只接取第一章（requires === null），后续章节由 _finish 链式接取
      for (const def of this.defs.values()) {
        if (def.autoAccept === true && def.requires === null && this.state[def.id]?.status === 'available') this.accept(def.id);
      }
    });
  }

  _onNPCTalk(id) {
    // ① 接取支线（NPC 主动给任务）
    for (const def of this.defs.values()) {
      if (def.autoAccept === 'npc:' + id && this.state[def.id]?.status === 'available') {
        if (def.acceptDialogue) { speak(this.ctx, def.acceptDialogue); }
        else this.accept(def.id);
        return;
      }
    }
    // ② 推进主线/支线的 npc 步骤
    for (const q of this._q.values()) if (q.status === 'active' && !q.busy) {
      const s = q.steps[q.step];
      if (s && !s.done && s.trigger?.type === 'npc' && s.trigger.id === id) {
        this._completeStep(q, q.step);
        return;
      }
    }
  }

  _onRegion(region) {
    if (!region) return;
    // 支线：按区域自动接取
    for (const def of this.defs.values()) {
      if (def.autoAccept === 'region:' + region && this.state[def.id]?.status === 'available') {
        if (def.acceptDialogue) speak(this.ctx, def.acceptDialogue);
        this.accept(def.id);
      }
    }
    // 主线/支线：region 触发步骤 —— 必须玩家真的进入过该区域（player:region 事件）
    for (const q of this._q.values()) {
      if (q.status !== 'active' || q.busy) continue;
      const s = q.steps[q.step];
      if (s && !s.done && s.trigger?.type === 'region' && s.trigger.region === region) {
        this._completeStep(q, q.step);
      }
    }
  }

  // ---- 每帧 ----

  update(dt) {
    const ctx = this.ctx;
    for (const q of this._q.values()) {
      if (q.status !== 'active' || q.busy) continue;
      const s = q.steps[q.step];
      if (!s || s.done) continue;
      const t = s.trigger;
      if (!t) continue;
      switch (t.type) {
        case 'auto':
          q.timer -= dt;
          if (q.timer <= 0) this._completeStep(q, q.step);
          break;
        case 'location': {
          const p = ctx.player?.position;
          if (p && Math.hypot(p.x - t.x, p.z - t.z) < (t.r ?? 12)) this._completeStep(q, q.step);
          break;
        }
        case 'kill':
          if ((q.progress.kills[t.family] ?? 0) >= t.count) this._completeStep(q, q.step);
          break;
        case 'puzzle':
          if (q.progress.puzzles.includes(t.id)) this._completeStep(q, q.step);
          break;
        case 'gather':
          if ((q.progress.gathers[t.item] ?? 0) >= t.count) this._completeStep(q, q.step);
          break;
        default: break;
      }
    }
  }

  dispose() {
    for (const h of this._handles) try { h?.remove?.(); } catch {}
    this._handles.length = 0;
    for (const q of this._q.values()) this._clearSpotHandles(q);
    for (const un of this._listeners) try { un(); } catch {}
    this._listeners.length = 0;
  }
}


