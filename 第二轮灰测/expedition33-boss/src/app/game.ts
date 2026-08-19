import * as THREE from 'three';
import { BattleEngine, type BattleLogFile } from '../engine/battle';
import { replayFromLog, parseLog } from '../engine/replay';
import { DIFFICULTIES } from '../engine/data/difficulty';
import { SKILL_BY_ID } from '../engine/data/skills';
import { BOSS_MOVE_BY_ID } from '../engine/data/boss';
import { createStage, type CamState, type Stage } from '../render/stage';
import { createAudioEngine, type AudioEngine, type SfxName } from '../audio/audio';
import { Ui } from '../ui/ui';
import { ELEMENT_COLORS } from '../ui/dom';
import type { DifficultyId, ElementId, EngineEvent } from '../engine/types';

const ATTACK_KIND: Record<string, 'combo' | 'sweep' | 'thrust' | 'array' | 'charge' | 'execution' | 'storm'> = {
  four_arm_combo: 'combo',
  sweeping_slash: 'sweep',
  swift_thrust: 'thrust',
  inverted_array: 'array',
  blade_charge: 'charge',
  twin_execution: 'execution',
  blood_storm: 'storm',
};

const ELEMENT_SFX: Record<string, SfxName> = {
  physical: 'hit_physical', fire: 'hit_fire', ice: 'hit_ice', lightning: 'hit_lightning',
  earth: 'hit_earth', light: 'hit_light', dark: 'hit_dark',
};

export class Game {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private stage: Stage;
  private ui: Ui;
  private audio: AudioEngine;
  /** 公开给自动化验收与调试（window.__GAME__.engine） */
  engine: BattleEngine | null = null;
  private difficulty: DifficultyId = 'standard';
  private seed = 0;
  private raf = 0;
  private lastPerf = 0;
  private paused = false;
  private autoPaused = false;
  private timeScale = 1;
  private hitstopUntil = 0;
  private uiLayer: 'none' | 'skills' | 'items' = 'none';
  private struckEvents = new Set<string>();
  private ringIds = new Set<string>();
  private mouse = { x: 0, y: 0 };
  private muted = false;
  private reduceShake = false;
  private lowPerf = false;
  private debug = false;
  private resultShown = false;
  private lastLog: BattleLogFile | null = null;
  private listeners: (() => void)[] = [];
  /** 自动化验收用：在指定模拟时刻精确按下空格（等价于两帧之间真实按键） */
  private pendingPresses: number[] = [];
  private fpsAccum = 0;
  private fpsFrames = 0;
  private qualityChecked = false;

  constructor(container: HTMLElement, canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.container = container;
    this.canvas = canvas;
    this.stage = createStage(canvas);
    this.audio = createAudioEngine();
    this.debug = new URLSearchParams(location.search).get('debug') === '1';
    this.ui = new Ui(uiRoot, {
      onDifficulty: (d) => this.startBattle(d),
      onCommand: (kind) => this.onCommand(kind),
      onSkill: (id) => this.onSkill(id),
      onItem: (id) => this.onItem(id),
      onTarget: (id) => this.onTarget(id),
      onBack: () => this.onBack(),
      onAimShot: (wp) => this.onAimShot(wp),
      onAimEnd: () => this.engine && this.engine.exitAim(),
      onRestart: () => this.startBattle(this.difficulty),
      onToDifficulty: () => this.toDifficulty(),
      onTogglePause: () => this.togglePause(),
      onToggleMute: () => this.toggleMute(),
      onVolume: (v) => { this.audio.setMasterVolume(v); this.audio.setMuted(false); this.muted = false; this.ui.setToggle('btn-mute', false, '静音'); },
      onToggleShake: () => this.toggleShake(),
      onTogglePerf: () => this.togglePerf(),
      onExportLog: () => this.exportLog(),
      onImportLog: (t) => this.importLog(t),
      onDebug: (a) => this.onDebugAction(a),
    });
    if (this.debug) this.ui.enableDebug();
    this.ui.bindAimSurface((x, y) => {
      if (!this.engine || this.engine.state.fsm !== 'AIM') return;
      this.onAimShot(null);   // 空白处 = 躯干命中（少量物理伤害，每发 1 AP）
      void x; void y;
    });
    this.bindGlobal();
    this.ui.showDifficulty(this.difficulty);
    this.lastPerf = performance.now();
    this.loop(this.lastPerf);
  }

  // ------------------------------------------------------------ 全局输入
  private bindGlobal(): void {
    const onResize = () => this.stage.resize();
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.code === 'Space') {
        ev.preventDefault();
        if (ev.repeat) return;            // 忽略长按自动重复
        this.pressSpace();
        return;
      }
      if (ev.code === 'Escape') {
        ev.preventDefault();
        this.onBack();
        return;
      }
      if (ev.code === 'KeyP') {
        this.togglePause();
      }
    };
    const onContext = (ev: MouseEvent) => {
      ev.preventDefault();
      this.onBack();
    };
    const onMove = (ev: MouseEvent) => {
      this.mouse.x = ev.clientX;
      this.mouse.y = ev.clientY;
    };
    const onBlur = () => {
      if (!this.paused && this.engine) {
        this.autoPaused = true;
        this.paused = true;
        this.audio.suspend();
        if (this.engine) this.engine.setPaused(true);
      }
    };
    const onFocus = () => {
      if (this.autoPaused) {
        this.autoPaused = false;
        this.paused = false;
        this.lastPerf = performance.now();
        this.audio.resume();
        if (this.engine) this.engine.setPaused(false);
      }
    };
    const onVis = () => { if (document.hidden) onBlur(); else onFocus(); };
    const onFirstClick = () => { void this.audio.unlock(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('contextmenu', onContext);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointerdown', onFirstClick, { once: true });
    this.listeners.push(
      () => window.removeEventListener('resize', onResize),
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('contextmenu', onContext),
      () => window.removeEventListener('mousemove', onMove),
      () => window.removeEventListener('blur', onBlur),
      () => window.removeEventListener('focus', onFocus),
      () => document.removeEventListener('visibilitychange', onVis),
    );
  }

  /** 自动化验收接口：把一次空格按下排到给定模拟时刻 */
  queueTestPress(atSimTime: number): void {
    this.pendingPresses.push(atSimTime);
    this.pendingPresses.sort((a, b) => a - b);
    if (this.pendingPresses.length > 64) this.pendingPresses.length = 64;
  }

  private pressSpace(): void {
    if (!this.engine || this.paused) return;
    const perf = performance.now();
    const dt = (perf - this.lastPerf) * this.timeScale;
    this.lastPerf = perf;
    this.engine.advance(dt);
    this.engine.pressSpace();
    this.consumeEvents();
  }

  // ------------------------------------------------------------ 生命周期
  startBattle(d: DifficultyId, seed?: number): void {
    this.difficulty = d;
    if (this.engine) this.engine.dispose();
    this.stage.resetActors();
    this.struckEvents.clear();
    this.ringIds.clear();
    this.ui.clearRings();
    this.ui.clearMarkers();
    this.ui.hideSkills();
    this.ui.hideCommand();
    this.ui.hideMove();
    this.ui.hideScreens();
    this.ui.setAim(false);
    this.ui.setHudFaded(false);
    this.uiLayer = 'none';
    this.resultShown = false;
    this.timeScale = 1;
    this.paused = false;
    this.autoPaused = false;
    this.hitstopUntil = 0;
    this.pendingPresses = [];
    this.seed = seed === undefined ? (Math.floor(Math.random() * 0xfffffff) >>> 0) : seed;
    this.engine = new BattleEngine({ difficulty: d, seed: this.seed });
    this.engine.start();
    this.audio.setPhase(1);
    this.audio.startAmbient();
    void this.audio.unlock();
    this.lastPerf = performance.now();
    this.consumeEvents();
  }

  toDifficulty(): void {
    if (this.engine) this.engine.dispose();
    this.engine = null;
    this.ui.clearRings();
    this.ui.clearMarkers();
    this.ui.hideSkills();
    this.ui.hideCommand();
    this.ui.hideMove();
    this.ui.setAim(false);
    this.ui.setHudFaded(false);
    this.audio.stopAmbient();
    this.paused = false;
    this.ui.showDifficulty(this.difficulty);
  }

  private togglePause(): void {
    if (!this.engine || this.engine.state.outcome !== 'none') return;
    this.paused = !this.paused;
    this.engine.setPaused(this.paused);
    if (this.paused) {
      this.audio.suspend();
      this.ui.showPause();
    } else {
      this.audio.resume();
      this.ui.hideScreens();
      this.lastPerf = performance.now();
    }
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    this.ui.setToggle('btn-mute', this.muted, this.muted ? '已静音' : '静音');
  }

  private toggleShake(): void {
    this.reduceShake = !this.reduceShake;
    this.stage.setReduceShake(this.reduceShake);
    this.ui.setToggle('btn-shake', this.reduceShake, this.reduceShake ? '晃动已减弱' : '减少晃动');
  }

  private togglePerf(): void {
    this.lowPerf = !this.lowPerf;
    this.stage.setLowPerf(this.lowPerf);
    this.ui.setToggle('btn-perf', this.lowPerf, this.lowPerf ? '低性能开' : '低性能');
  }

  // ------------------------------------------------------------ 指令
  private onCommand(kind: 'attack' | 'skill' | 'aim' | 'item'): void {
    if (!this.engine) return;
    this.audio.play('ui_click');
    if (kind === 'skill') {
      this.uiLayer = 'skills';
      return;
    }
    if (kind === 'item') {
      this.uiLayer = 'items';
      return;
    }
    this.uiLayer = 'none';
    this.engine.chooseCommand(kind);
    this.consumeEvents();
  }

  private onSkill(id: string): void {
    if (!this.engine) return;
    if (!this.engine.chooseSkill(id)) {
      this.audio.play('ui_denied');
      return;
    }
    this.audio.play('ui_click');
    this.uiLayer = 'none';
    this.consumeEvents();
  }

  private onItem(id: string): void {
    if (!this.engine) return;
    if (!this.engine.chooseItem(id)) {
      this.audio.play('ui_denied');
      return;
    }
    this.audio.play('ui_click');
    this.uiLayer = 'none';
    this.consumeEvents();
  }

  private onTarget(id: string): void {
    if (!this.engine) return;
    const st = this.engine.state;
    const inverted = st.actors[id] && st.actors[id].statuses.some((s) => s.id === 'inverted');
    const pending = st.pending;
    const healing = pending && ((pending.kind === 'item' && pending.itemId === 'heal')
      || (pending.kind === 'skill' && pending.skillId === 'typhoon'));
    if (inverted && healing && DIFFICULTIES[st.difficulty].invertedConfirm) {
      this.audio.play('inverted_warn');
      if (!window.confirm('目标处于倒逆状态：治疗会转为等量伤害，可能致死。确定继续？')) return;
    }
    this.audio.play('ui_click');
    this.engine.chooseTarget(id);
    this.consumeEvents();
  }

  private onBack(): void {
    if (!this.engine) return;
    if (this.uiLayer !== 'none') {
      this.uiLayer = 'none';
      this.audio.play('ui_back');
      return;
    }
    if (this.engine.back()) this.audio.play('ui_back');
    this.consumeEvents();
  }

  private onAimShot(weakPointId: string | null): void {
    if (!this.engine) return;
    this.engine.aimShot(weakPointId);
    this.audio.play(weakPointId ? 'weakpoint_break' : 'aim_shot', { gain: weakPointId ? 1 : 0.7 });
    this.consumeEvents();
  }

  // ------------------------------------------------------------ 主循环
  private loop = (perf: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const dtReal = Math.min(120, Math.max(0, perf - this.lastPerf));
    this.lastPerf = perf;
    if (this.engine && !this.paused) {
      // 命中停顿按"与本帧重叠的真实毫秒数"折算，而不是整帧降速 ——
      // 否则低帧率下一次 60ms 的停顿会吃掉一整帧的模拟时间。
      const stopOverlap = Math.max(0, Math.min(dtReal, this.hitstopUntil - (perf - dtReal)));
      const normalMs = dtReal - stopOverlap;
      let remaining = normalMs * this.timeScale + stopOverlap * 0.06;
      // 把排队的"精确时刻按键"插进这一帧的推进过程中（与真实按键路径一致）
      let guard = 0;
      while (this.pendingPresses.length > 0 && guard++ < 24
        && this.pendingPresses[0] <= this.engine.state.now + remaining) {
        const at = this.pendingPresses.shift() as number;
        const stepTo = Math.max(0, at - this.engine.state.now);
        this.engine.advance(stepTo);
        remaining = Math.max(0, remaining - stepTo);
        this.engine.pressSpace();
        this.consumeEvents();
      }
      this.engine.advance(remaining);
      this.consumeEvents();
    }
    if (this.engine) {
      this.syncCamera();
      this.syncUi();
      this.ui.tick(this.engine.state.now, dtReal);
      this.checkQuality(dtReal);
    }
    this.stage.update(dtReal);
  };

  /** 自适应画质：开局 2.5 秒内若帧率明显低于 60，自动开启低性能模式（只影响视觉，不改变逻辑时序） */
  private checkQuality(dtReal: number): void {
    if (this.qualityChecked || this.paused || dtReal <= 0) return;
    this.fpsAccum += dtReal;
    this.fpsFrames += 1;
    if (this.fpsAccum < 2500) return;
    this.qualityChecked = true;
    const fps = this.fpsFrames / (this.fpsAccum / 1000);
    if (fps < 28 && !this.lowPerf) {
      this.lowPerf = true;
      this.stage.setLowPerf(true);
      this.ui.setToggle('btn-perf', true, '低性能(自动)');
      this.ui.log('检测到帧率 ' + fps.toFixed(1) + ' —— 已自动开启低性能模式（仅减少粒子/阴影，不改变判定时序）', 'warn');
    }
  }

  // ------------------------------------------------------------ 事件消化
  private consumeEvents(): void {
    if (!this.engine) return;
    const events = this.engine.drain();
    for (const ev of events) this.handleEvent(ev);
  }

  private screenOf(actorId: string, part: 'chest' | 'head' | 'weapon' = 'chest'): { x: number; y: number; visible: boolean } {
    return this.stage.project(this.stage.anchorWorld(actorId, part));
  }

  private handleEvent(ev: EngineEvent): void {
    const st = this.engine!.state;
    switch (ev.type) {
      case 'log':
        this.ui.log(ev.payload.text, ev.payload.tone);
        break;
      case 'turnStart':
        this.struckEvents.clear();
        for (const id of st.partyOrder) this.stage.chars[id].setActive(id === ev.payload.actorId);
        break;
      case 'actionStart': {
        const a = ev.payload.action;
        if (a.kind !== 'boss') {
          const model = this.stage.chars[a.actorId];
          const skill = a.skillId ? SKILL_BY_ID[a.skillId] : null;
          const kind = a.kind === 'item' ? 'item'
            : a.kind === 'counter' ? 'counter'
              : skill && skill.kind !== 'attack' ? 'cast'
                : a.actorId === 'lune' ? 'cast' : 'slash';
          if (model) model.playAttack(kind, Math.max(600, a.endsAt - a.startedAt));
        }
        break;
      }
      case 'bossTelegraph': {
        const move = BOSS_MOVE_BY_ID[ev.payload.moveId];
        const dur = move ? (move.impactTimes[move.impactTimes.length - 1] + move.tail) * 1000 : 2500;
        this.stage.boss.playAttack(ATTACK_KIND[ev.payload.moveId] || 'combo', dur);
        this.ui.showMove(ev.payload.name, ev.payload.hint);
        this.audio.play('boss_telegraph');
        if (ev.payload.moveId === 'blood_storm') this.audio.play('boss_roar');
        this.ui.setHudFaded(true);
        break;
      }
      case 'actionEnd':
        this.ui.hideMove();
        this.ui.setHudFaded(false);
        this.timeScale = 1;
        this.stage.setTimeScale(1);
        this.audio.setTimeScale(1);
        break;
      case 'promptOpen': {
        const actorId = st.action ? st.action.actorId : st.currentActorId || 'maelle';
        const lead = Math.max(DIFFICULTIES[st.difficulty].telegraphLead, DIFFICULTIES[st.difficulty].skillGood);
        this.ui.addRing(ev.payload.eventId, ev.payload.at, lead, 'skill', false,
          () => this.screenOf(actorId, 'weapon'));
        this.audio.play('prompt_rise');
        break;
      }
      case 'promptJudged': {
        this.ui.markRing(ev.payload.eventId, ev.payload.grade);
        const g = ev.payload.grade;
        this.ui.popJudge(g === 'perfect' ? 'PERFECT' : g === 'good' ? 'GOOD' : 'MISS',
          g === 'perfect' ? '#ffe4a8' : g === 'good' ? '#e9e0d1' : '#ff6a4a');
        this.audio.play(g === 'perfect' ? 'perfect_block' : g === 'good' ? 'normal_block' : 'block_fail',
          { gain: g === 'perfect' ? 0.85 : 0.6 });
        if (g === 'perfect') this.hitstopUntil = performance.now() + 55;
        break;
      }
      case 'defenseOpen': {
        const victim = ev.payload.targetId || st.partyOrder[0];
        const lead = DIFFICULTIES[st.difficulty].telegraphLead + DIFFICULTIES[st.difficulty].blockOuter;
        this.ui.addRing(ev.payload.eventId, ev.payload.at, lead, 'defense', ev.payload.jump,
          () => this.screenOf(victim, 'chest'));
        break;
      }
      case 'defenseJudged': {
        this.ui.markRing(ev.payload.eventId, ev.payload.grade);
        const g = ev.payload.grade;
        if (g === 'perfect') {
          this.ui.popJudge('完美格挡', '#ffe4a8');
          this.audio.play('perfect_block');
          this.hitstopUntil = performance.now() + 62;
          this.ui.flashScreen('perfect');
          const p = this.stage.anchorWorld(ev.payload.targetId || st.partyOrder[0], 'chest');
          this.stage.fx.perfectRing(p);
        } else if (g === 'block') {
          this.ui.popJudge('格挡', '#e9e0d1');
          this.audio.play('normal_block');
          this.stage.shake(0.35);
        } else {
          this.ui.popJudge('失手', '#ff5a3c');
          this.audio.play('block_fail');
          this.ui.flashScreen('hurt');
          this.stage.shake(0.7);
        }
        break;
      }
      case 'counterOpen': {
        this.timeScale = 0.9;
        this.stage.setTimeScale(0.92);
        this.audio.setTimeScale(0.9);
        this.audio.play('counter_start');
        this.ui.popJudge('完美格挡', '#ffe4a8');
        this.ui.addRing('counter', ev.payload.opensAt + 200, 520, 'counter', false, () => {
          const s = this.screenOf(st.bossId, 'chest');
          return { x: s.x, y: s.y + 40, visible: true };
        });
        break;
      }
      case 'counterJudged':
        this.ui.markRing('counter', ev.payload.grade === 'perfect' ? 'perfect' : 'block');
        break;
      case 'counterPerformed':
        this.audio.play('counter_hit');
        for (const id of ev.payload.actorIds) {
          const m = this.stage.chars[id];
          if (m) m.playAttack('counter', 900);
        }
        break;
      case 'hit': {
        this.showHit(ev);
        break;
      }
      case 'heal': {
        const s = this.screenOf(ev.payload.targetId, 'head');
        const amt = ev.payload.amount;
        if (amt > 0) {
          this.ui.damage(s.x, s.y, '+' + amt, '#8ef0c0', '治疗', 22);
          this.audio.play('heal');
        } else if (amt < 0) {
          this.ui.damage(s.x, s.y, String(-amt), '#ff6a4a', '倒逆反伤', 24);
          this.audio.play('inverted_warn');
        }
        break;
      }
      case 'statusChange':
        if (ev.payload.statusId === 'inverted' && !ev.payload.removed) this.audio.play('inverted_warn');
        break;
      case 'breakChange':
        if (ev.payload.broken) {
          this.audio.play('break_gauge');
          this.stage.shake(0.8);
          this.ui.popJudge('破防', '#ffd479');
        }
        break;
      case 'shieldChange':
        if (ev.payload.delta < 0) this.audio.play('shield_break', { gain: 0.5 });
        break;
      case 'weakPointBroken':
        this.stage.boss.breakWeakPoint(ev.payload.id as 'gold_core' | 'violet_core');
        this.audio.play('weakpoint_break');
        this.stage.shake(0.5);
        break;
      case 'death':
        if (ev.payload.actorId === st.bossId) {
          this.audio.play('boss_roar');
        } else {
          this.stage.chars[ev.payload.actorId].setDead(true);
          this.audio.play('death');
        }
        break;
      case 'revive':
        this.stage.chars[ev.payload.actorId].setDead(false);
        this.audio.play('revive');
        break;
      case 'phaseChange':
        this.stage.setPhase(ev.payload.phase);
        this.audio.setPhase(ev.payload.phase);
        this.audio.play('phase_shift');
        this.stage.shake(0.6);
        break;
      case 'spam':
        this.audio.play('ui_denied', { gain: 0.4 });
        break;
      case 'victory':
        this.audio.play('victory');
        window.setTimeout(() => {
          if (this.engine && this.engine.state.outcome === 'victory' && !this.resultShown) {
            this.resultShown = true;
            this.ui.showResult(true, this.engine.state, this.seed);
          }
        }, 2600);
        break;
      case 'defeat':
        this.audio.play('defeat');
        window.setTimeout(() => {
          if (this.engine && this.engine.state.outcome === 'defeat' && !this.resultShown) {
            this.resultShown = true;
            this.ui.showResult(false, this.engine.state, this.seed);
          }
        }, 1600);
        break;
      default:
        break;
    }
  }

  private showHit(ev: Extract<EngineEvent, { type: 'hit' }>): void {
    const p = ev.payload;
    const st = this.engine!.state;
    const isBossTarget = p.targetId === st.bossId;
    const s = this.screenOf(p.targetId, isBossTarget ? 'chest' : 'head');
    const world = this.stage.anchorWorld(p.targetId, 'chest');
    const color = p.absorbed ? '#cfe4ff'
      : p.grade === 'perfect' ? '#ffe4a8'
        : p.weakness ? '#ffd479'
          : p.resist ? '#9c948a'
            : ELEMENT_COLORS[p.element] || '#e9e0d1';
    if (p.grade === 'perfect') {
      // 完美格挡 0 伤害：不显示数字，由判定文字与金环表达
    } else if (p.shielded || p.absorbed) {
      this.ui.damage(s.x, s.y, '护盾', color, '完全吸收', 18);
    } else {
      const tag = p.crit ? '暴击' : p.weakness ? '弱点' : p.resist ? '抗性' : '';
      const size = p.crit ? 32 : p.damage >= 2000 ? 29 : 24;
      this.ui.damage(s.x, s.y, String(p.damage), color, tag, size);
    }
    if (!p.absorbed && p.damage > 0) {
      this.stage.fx.burst(world, p.element as ElementId, p.crit ? 1.5 : 1);
      if (isBossTarget) this.stage.boss.hitFlash(Math.min(1, 0.4 + p.damage / 3000));
      else this.stage.chars[p.targetId] && this.stage.chars[p.targetId].hitFlash(0.8);
      this.stage.shake(Math.min(0.9, 0.14 + p.damage / 4200));
      this.audio.play(ELEMENT_SFX[p.element] || 'hit_physical', { gain: 0.55 });
      if (p.crit) this.audio.play('crit', { gain: 0.6 });
      else if (p.weakness) this.audio.play('weakness', { gain: 0.5 });
      if (!isBossTarget) this.ui.flashScreen('hurt');
    }
    if (p.overkill && isBossTarget) this.stage.shake(1.2);
  }

  // ------------------------------------------------------------ 镜头
  private syncCamera(): void {
    const st = this.engine!.state;
    const cur = st.currentActorId || 'maelle';
    let state: CamState = 'idle';
    let opts: { focusId?: string; shot?: number; targetId?: string } = { focusId: cur };
    switch (st.fsm) {
      case 'INTRO': state = 'intro'; break;
      case 'COMMAND':
        state = this.uiLayer === 'none' ? 'command' : 'skills';
        break;
      case 'TARGET_SELECT': state = 'target'; break;
      case 'AIM': state = 'aim'; break;
      case 'PLAYER_ACTION':
      case 'SKILL_PROMPTS': {
        state = 'playerAction';
        const a = st.action;
        const resolved = a ? a.events.filter((e) => e.type === 'hit' && e.resolved).length : 0;
        opts = { focusId: cur, shot: resolved % 4 };
        break;
      }
      case 'BOSS_TELEGRAPH':
      case 'DEFENSE_SEQUENCE': {
        state = 'bossAttack';
        const a = st.action;
        const victim = a && a.targetIds[0] ? a.targetIds[0] : cur;
        opts = { focusId: victim, targetId: victim };
        break;
      }
      case 'COUNTER_WINDOW': {
        state = 'counter';
        const a = st.action;
        const idx = a ? a.events.filter((e) => e.type === 'counterHit' && e.resolved).length : 0;
        const actorIds = st.partyOrder.filter((id) => st.actors[id].alive);
        opts = { focusId: actorIds[Math.min(idx, actorIds.length - 1)] || cur, shot: idx };
        break;
      }
      case 'PHASE_TRANSITION': state = 'phase'; break;
      case 'VICTORY': state = 'victory'; break;
      case 'DEFEAT': state = 'defeat'; break;
      default: state = 'idle'; break;
    }
    this.stage.setCam(state, opts);
  }

  // ------------------------------------------------------------ UI 同步
  private syncUi(): void {
    const engine = this.engine!;
    const st = engine.state;
    this.ui.syncBoss(st);
    this.ui.syncParty(st);
    this.ui.syncTimeline(engine.previewQueue(8), st);

    // Boss 招式的视觉命中（按预定时间触发挥剑与特效）
    const a = st.action;
    if (a && a.kind === 'boss') {
      for (const e of a.events) {
        if (e.type !== 'defenseHit' || this.struckEvents.has(e.id)) continue;
        if (st.now >= e.at) {
          this.struckEvents.add(e.id);
          this.stage.boss.strike(e.index);
          const victim = (e.targetIds && e.targetIds[0]) || st.partyOrder[0];
          this.stage.fx.burst(this.stage.anchorWorld(victim, 'chest'), (e.element || 'physical') as ElementId, 0.9);
          this.stage.shake(0.24);
        }
      }
      const grades = a.events.filter((e) => e.type === 'defenseHit').sort((x, y) => x.at - y.at).map((e) => e.grade as string | undefined);
      this.ui.setSegments(grades, st.chainDefensibleCount);
    }
    if (st.fsm === 'VICTORY') {
      this.stage.boss.dissolve(Math.min(1, (st.now - (st.stats.startedAt + st.stats.elapsedMs)) / 1400 + 0.25));
    }

    // 指令菜单
    if (st.fsm === 'COMMAND' && this.uiLayer === 'none') {
      const s = this.screenOf(st.currentActorId || 'maelle', 'chest');
      // 角色靠右时把菜单放到其左侧，避免浮动菜单压住角色本体
      const right = s.x > window.innerWidth * 0.54;
      this.ui.showCommand(st, right ? s.x - 208 : s.x + 54, s.y - 76);
      this.ui.hideSkills();
    } else if (st.fsm === 'COMMAND' && this.uiLayer !== 'none') {
      this.ui.hideCommand();
      const s = this.screenOf(st.currentActorId || 'maelle', 'head');
      const rightS = s.x > window.innerWidth * 0.5;
      this.ui.showSkills(st, rightS ? Math.max(20, s.x - 372) : s.x + 62, s.y - 46, this.uiLayer === 'items' ? 'item' : 'skill');
    } else {
      this.ui.hideCommand();
      this.ui.hideSkills();
      if (this.uiLayer !== 'none') this.uiLayer = 'none';
    }

    // 目标标记
    if (st.fsm === 'TARGET_SELECT') {
      const targets = engine.legalTargets();
      this.ui.setMarkers(targets.map((id) => {
        const s = this.screenOf(id, id === st.bossId ? 'chest' : 'head');
        const actor = st.actors[id];
        return { id, x: s.x, y: s.y, label: actor.name, enemy: actor.kind === 'boss' };
      }));
    } else {
      this.ui.clearMarkers();
    }

    // 瞄准
    if (st.fsm === 'AIM') {
      this.ui.setAim(true);
      const boss = st.actors[st.bossId];
      const actor = st.actors[st.currentActorId || 'maelle'];
      this.ui.updateAim(boss.weakPoints.map((w) => {
        const p = this.stage.project(this.stage.weakPointWorld(w.id as 'gold_core' | 'violet_core'));
        return { id: w.id, x: p.x, y: p.y, name: w.name + ' ' + w.durability + '/' + w.maxDurability, broken: w.broken };
      }), actor.ap);
    } else {
      this.ui.setAim(false);
    }

    if (this.debug) this.renderDebug();
  }

  private renderDebug(): void {
    const engine = this.engine!;
    const st = engine.state;
    const cfg = DIFFICULTIES[st.difficulty];
    const nextDef = st.action ? st.action.events.filter((e) => e.type === 'defenseHit' && !e.resolved).sort((a, b) => a.at - b.at)[0] : null;
    const nextPrompt = st.action ? st.action.events.filter((e) => e.type === 'prompt' && !e.resolved).sort((a, b) => a.at - b.at)[0] : null;
    const rows: string[] = [
      kv('FSM', st.fsm),
      kv('难度 / 种子', cfg.name + ' / ' + st.seed),
      kv('模拟时钟', Math.round(st.now) + 'ms'),
      kv('阶段', String(st.phase) + (st.pendingPhase ? ' -> ' + st.pendingPhase : '')),
      kv('当前行动', st.currentActorId || '-'),
      kv('Boss HP', Math.round(st.actors.boss.hp) + ' / ' + st.actors.boss.maxHp),
      kv('破防槽', Math.round(st.actors.boss.breakGauge) + (st.actors.boss.broken ? ' 破防' : '')),
      kv('招式', (st.bossMoveName || '-') + (st.bossMoveVariant ? '(' + st.bossMoveVariant + ')' : '')),
      kv('段数', st.chainResolvedCount + '/' + st.chainDefensibleCount + ' perfect=' + st.chainPerfectCount),
      kv('下一命中', nextDef ? Math.round(nextDef.at - st.now) + 'ms' : nextPrompt ? Math.round(nextPrompt.at - st.now) + 'ms(提示)' : '-'),
      kv('格挡窗口', '±' + cfg.blockPerfect + ' / ±' + cfg.blockOuter),
      kv('技能窗口', '±' + cfg.skillPerfect + ' / ±' + cfg.skillGood),
      kv('最近 delta', (st.lastDefenseDelta !== null ? Math.round(st.lastDefenseDelta) + 'ms(格挡)' : '') + ' '
        + (st.lastPromptDelta !== null ? Math.round(st.lastPromptDelta) + 'ms(连协)' : '')),
      kv('反击窗口', st.counterWindow ? Math.round(st.counterWindow.opensAt) + '~' + Math.round(st.counterWindow.closesAt) + (st.counterResolved ? ' 已用' : '') : '-'),
      kv('队列', engine.previewQueue(6).map((q) => q.actorId.slice(0, 2) + (q.kind === 'extra' ? '*' : '') + q.at.toFixed(0)).join(' ')),
      kv('RNG 调用', String(engine.rng.calls)),
    ];
    this.ui.renderDebug(rows.join(''), [
      { label: 'Boss -10%', action: 'dmg10' },
      { label: 'Boss -50%', action: 'dmg50' },
      { label: '全员 +9AP', action: 'ap' },
      { label: '治疗全队', action: 'heal' },
      { label: '跳阶段二', action: 'phase2' },
      { label: '跳阶段三', action: 'phase3' },
      { label: '四臂连击', action: 'move_four_arm_combo' },
      { label: '迅敏突刺', action: 'move_swift_thrust' },
      { label: '全体斩击', action: 'move_sweeping_slash' },
      { label: '倒逆剑阵', action: 'move_inverted_array' },
      { label: '双刃处刑', action: 'move_twin_execution' },
      { label: '腥风血雨', action: 'move_blood_storm' },
      { label: '刀锋蓄势', action: 'move_blade_charge' },
    ], this.lastLog ? JSON.stringify(this.lastLog).slice(0, 4000) : '');
  }

  private onDebugAction(action: string): void {
    const engine = this.engine;
    if (!engine) return;
    const boss = engine.state.actors.boss;
    if (action === 'dmg10') engine.debugDamageBoss(Math.floor(boss.maxHp * 0.1));
    else if (action === 'dmg50') engine.debugDamageBoss(Math.floor(boss.maxHp * 0.5));
    else if (action === 'ap') engine.debugGiveAp();
    else if (action === 'heal') {
      for (const id of engine.state.partyOrder) engine.healActor(id, 9999, 'debug');
    } else if (action === 'phase2') engine.debugSetBossHpRatio(0.67);
    else if (action === 'phase3') engine.debugSetBossHpRatio(0.31);
    else if (action.startsWith('move_')) engine.debugForceMove(action.slice(5));
    this.consumeEvents();
  }

  private exportLog(): void {
    if (!this.engine) return;
    this.lastLog = this.engine.exportLog();
    const text = JSON.stringify(this.lastLog);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'battle-' + this.lastLog.seed + '.json';
    a.click();
    URL.revokeObjectURL(url);
    this.ui.log('战斗日志已导出（' + this.lastLog.inputs.length + ' 条输入）', 'perfect');
  }

  private importLog(text: string): void {
    try {
      const log = parseLog(text);
      const replayed = replayFromLog(log);
      const s = replayed.state.stats;
      this.ui.log('重放完成：' + replayed.state.outcome + ' 伤害 ' + s.totalDamage
        + ' 最高 ' + s.maxHit + ' 完美格挡 ' + s.perfectBlocks, 'perfect');
      if (this.engine) this.engine.dispose();
      this.engine = replayed;
      this.difficulty = log.difficulty;
      this.seed = log.seed;
      this.resultShown = false;
      this.stage.resetActors();
      this.stage.setPhase(replayed.state.phase);
      this.consumeEvents();
      if (replayed.state.outcome !== 'none') {
        this.resultShown = true;
        this.ui.showResult(replayed.state.outcome === 'victory', replayed.state, log.seed);
      }
    } catch (e) {
      this.ui.log('导入失败：' + (e as Error).message, 'warn');
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    for (const off of this.listeners) off();
    this.listeners = [];
    if (this.engine) this.engine.dispose();
    this.engine = null;
    this.audio.dispose();
    this.stage.dispose();
    void this.container;
    void this.canvas;
    void THREE;
  }
}

function kv(k: string, v: string): string {
  return '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>';
}
