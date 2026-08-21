import type { DisasterId, DisasterSpec } from '../disasters/types';

export interface HudCallbacks {
  onSelect: (id: DisasterId) => void;
  onRebuild: () => void;
  onSlow: (on: boolean) => void;
  onSound: (on: boolean) => void;
  onPower: (value: number) => void;
  onTilt: (value: number) => void;
}

export interface HudStats {
  voxels: number;
  debris: number;
  peds: number;
  fps: number;
}

const fmt = (n: number): string =>
  n >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString('en-US');

/** All 2D chrome: title, hint, counters and the bottom disaster toolbar. */
export class Hud {
  private root: HTMLDivElement;
  private hintEl: HTMLParagraphElement;
  private statVoxel: HTMLSpanElement;
  private statDebris: HTMLSpanElement;
  private statPed: HTMLSpanElement;
  private statFps: HTMLSpanElement;
  private fpsWrap: HTMLSpanElement;
  private toastEl: HTMLDivElement;
  private buttons = new Map<DisasterId, HTMLButtonElement>();
  private slowChip: HTMLButtonElement;
  private soundChip: HTMLButtonElement;
  private powerOut: HTMLOutputElement;
  private tiltOut: HTMLOutputElement;
  private toastTimer = 0;

  constructor(
    container: HTMLElement,
    specs: DisasterSpec[],
    private readonly cb: HudCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div id="brand" class="panel">
        <h1><span class="dot"></span>微缩灾难沙盘</h1>
      </div>
      <div id="stats" class="panel">
        <span>体素 <span class="v" id="s-vox">0</span></span><span class="sep">·</span>
        <span>碎片 <span class="v" id="s-deb">0</span></span><span class="sep">·</span>
        <span>行人 <span class="v" id="s-ped">0</span></span><span class="sep">·</span>
        <span class="fps" id="s-fpswrap">FPS <span class="v" id="s-fps">60</span></span>
      </div>
      <div id="hintline" class="panel"><p id="hint"></p></div>
      <div id="toast"></div>
      <div id="toolbar" class="panel">
        <div id="tools"></div>
        <div id="controls">
          <button class="chip" id="c-slow" type="button">🐢 慢镜头</button>
          <button class="chip on" id="c-sound" type="button">🔊 音效</button>
          <button class="chip danger" id="c-rebuild" type="button">🏗 重建城市</button>
          <label class="slider">威力
            <input type="range" id="c-power" min="35" max="220" value="100" />
            <output id="o-power">1.0×</output>
          </label>
          <label class="slider">移轴
            <input type="range" id="c-tilt" min="0" max="100" value="45" />
            <output id="o-tilt">45%</output>
          </label>
        </div>
      </div>`;
    container.appendChild(this.root);

    const q = <T extends HTMLElement>(id: string): T => {
      const el = this.root.querySelector<T>(`#${id}`);
      if (!el) throw new Error(`missing hud node ${id}`);
      return el;
    };

    this.hintEl = q<HTMLParagraphElement>('hint');
    this.statVoxel = q<HTMLSpanElement>('s-vox');
    this.statDebris = q<HTMLSpanElement>('s-deb');
    this.statPed = q<HTMLSpanElement>('s-ped');
    this.statFps = q<HTMLSpanElement>('s-fps');
    this.fpsWrap = q<HTMLSpanElement>('s-fpswrap');
    this.toastEl = q<HTMLDivElement>('toast');

    const tools = q<HTMLDivElement>('tools');
    for (const s of specs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tool';
      b.style.setProperty('--tint', s.css);
      b.innerHTML = `<span class="ico">${s.icon}</span><span class="lbl">${s.name}</span>`;
      b.addEventListener('click', () => this.cb.onSelect(s.id));
      tools.appendChild(b);
      this.buttons.set(s.id, b);
    }

    this.slowChip = q<HTMLButtonElement>('c-slow');
    this.soundChip = q<HTMLButtonElement>('c-sound');
    this.powerOut = q<HTMLOutputElement>('o-power');
    this.tiltOut = q<HTMLOutputElement>('o-tilt');

    this.slowChip.addEventListener('click', () => {
      const on = !this.slowChip.classList.contains('on');
      this.slowChip.classList.toggle('on', on);
      this.cb.onSlow(on);
    });
    this.soundChip.addEventListener('click', () => {
      const on = !this.soundChip.classList.contains('on');
      this.soundChip.classList.toggle('on', on);
      this.soundChip.innerHTML = on ? '🔊 音效' : '🔇 静音';
      this.cb.onSound(on);
    });
    q<HTMLButtonElement>('c-rebuild').addEventListener('click', () => this.cb.onRebuild());

    const power = q<HTMLInputElement>('c-power');
    power.addEventListener('input', () => {
      const v = Number(power.value) / 100;
      this.powerOut.textContent = `${v.toFixed(1)}×`;
      this.cb.onPower(v);
    });
    const tilt = q<HTMLInputElement>('c-tilt');
    tilt.addEventListener('input', () => {
      const v = Number(tilt.value);
      this.tiltOut.textContent = `${v.toFixed(0)}%`;
      this.cb.onTilt(v / 100);
    });
  }

  setHint(text: string): void {
    if (this.hintEl.textContent !== text) this.hintEl.innerHTML = text;
  }

  setStats(s: HudStats): void {
    this.statVoxel.textContent = fmt(s.voxels);
    this.statDebris.textContent = fmt(s.debris);
    this.statPed.textContent = fmt(s.peds);
    this.statFps.textContent = s.fps.toFixed(0);
    this.fpsWrap.classList.toggle('warn', s.fps < 40);
  }

  syncTools(armed: DisasterId | null, isRunning: (id: DisasterId) => boolean): void {
    for (const [id, b] of this.buttons) {
      b.classList.toggle('active', armed === id || isRunning(id));
      b.classList.toggle('running', isRunning(id));
    }
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = 2.2;
  }

  update(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
  }
}
