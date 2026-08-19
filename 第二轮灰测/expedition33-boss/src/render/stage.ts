import * as THREE from 'three';
import {
  createAmbientParticles, createArena, createBossModel, createCharacterModel, createFxLayer,
  createLighting, type BossModel, type CharacterModel,
} from './models';

export type CamState =
  | 'intro' | 'idle' | 'command' | 'skills' | 'target' | 'aim' | 'playerAction'
  | 'bossAttack' | 'counter' | 'phase' | 'victory' | 'defeat';

export interface CamOptions {
  focusId?: string;
  /** 玩家技能的机位序号（2～4 个预设） */
  shot?: number;
  targetId?: string;
}

/** 队伍浅弧形站位（镜头近侧），Boss 在对面 */
export const PARTY_SLOTS: Record<string, THREE.Vector3> = {
  sciel: new THREE.Vector3(-2.45, 0, 2.55),
  lune: new THREE.Vector3(0.05, 0, 3.35),
  maelle: new THREE.Vector3(2.5, 0, 2.5),
};
export const BOSS_POS = new THREE.Vector3(0, 0, -4.3);

interface CamTarget {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
  /** 平滑系数（越大越快） */
  speed: number;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly boss: BossModel;
  readonly chars: Record<string, CharacterModel> = {};
  readonly fx = createFxLayer();

  private arena = createArena();
  private particles = createAmbientParticles();
  private lighting: { update(t: number, dt: number): void; setPhase(p: number): void; dispose(): void };
  private fillAmbient!: THREE.AmbientLight;
  private fillLight!: THREE.DirectionalLight;
  private frontLight!: THREE.DirectionalLight;
  private t = 0;
  private camState: CamState = 'intro';
  private camOpts: CamOptions = {};
  private camTarget: CamTarget;
  private curPos = new THREE.Vector3();
  private curLook = new THREE.Vector3();
  private curFov = 42;
  private shakeAmt = 0;
  private shakeSeed = Math.random() * 100;
  private reduceShake = false;
  private lowPerf = false;
  private timeScale = 1;
  private orbitT = 0;
  /**
   * 注意：THREE.Object3D.lookAt 对普通对象使用的是「+Z 朝向目标」的约定，
   * 与相机的「-Z 朝向目标」相反。这里直接用 Matrix4.lookAt（相机约定）构造目标朝向，
   * 再对相机四元数做 slerp，避免镜头正好朝反方向。
   */
  private lookMatrix = new THREE.Matrix4();
  private lookQuat = new THREE.Quaternion();
  private readonly UP = new THREE.Vector3(0, 1, 0);
  private disposed = false;
  private lastW = 0;
  private lastH = 0;

  constructor(canvas: HTMLCanvasElement) {
    // ?probe=1 / ?debug=1 时保留绘制缓冲，供自动化验收做非空像素检查（正常游玩不开，避免额外拷贝开销）
    const probe = typeof location !== 'undefined'
      && (new URLSearchParams(location.search).has('probe') || new URLSearchParams(location.search).get('debug') === '1');
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: probe,
    });
    this.renderer.setClearColor(0x0a0807, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // ACES 会压暗中间调；提高曝光并补一层柔和正面光，保证 Boss / 角色不与背景糊成一片
    this.renderer.toneMappingExposure = 1.5;

    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 220);
    this.scene.add(this.arena.group);
    this.scene.add(this.particles.group);
    this.scene.add(this.fx.group);

    this.boss = createBossModel();
    this.boss.group.position.copy(BOSS_POS);
    this.scene.add(this.boss.group);

    for (const id of ['sciel', 'lune', 'maelle'] as const) {
      const spec = {
        sciel: { id, color: '#a97cff', rimColor: '#7f6bd8' },
        lune: { id, color: '#59c9f2', rimColor: '#4aa6e8' },
        maelle: { id, color: '#ff6f5e', rimColor: '#ffd479' },
      }[id];
      const m = createCharacterModel(spec as never);
      m.group.position.copy(PARTY_SLOTS[id]);
      m.group.lookAt(BOSS_POS.x, 0, BOSS_POS.z);
      this.scene.add(m.group);
      this.chars[id] = m;
    }
    this.lighting = createLighting(this.scene);
    // 正面柔光（补亮朝向镜头的一侧，不破坏后上方逆光的主光结构）
    this.fillAmbient = new THREE.AmbientLight(0xffeedd, 0.6);
    this.fillLight = new THREE.DirectionalLight(0xffe8cf, 0.95);
    this.fillLight.position.set(-1.5, 4.4, 9.5);
    this.fillLight.target.position.set(0, 1.3, -1.5);
    this.frontLight = new THREE.DirectionalLight(0xcfe0ff, 0.5);
    this.frontLight.position.set(4.5, 2.6, 7.5);
    this.frontLight.target.position.set(0, 1.6, -3.5);
    this.scene.add(this.fillAmbient, this.fillLight, this.fillLight.target, this.frontLight, this.frontLight.target);

    this.camTarget = this.computeTarget('intro', {});
    this.curPos.copy(this.camTarget.pos);
    this.curLook.copy(this.camTarget.look);
    this.curFov = this.camTarget.fov;
    this.applyCamera(1);
    this.resize();
  }

  size(): { w: number; h: number } {
    return { w: this.lastW, h: this.lastH };
  }

  resize(): void {
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    this.lastW = w;
    this.lastH = h;
    const dpr = this.lowPerf ? 1 : Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setLowPerf(v: boolean): void {
    this.lowPerf = v;
    this.particles.setIntensity(v ? 0.35 : 1);
    this.renderer.shadowMap.enabled = !v;
    this.resize();
  }

  setReduceShake(v: boolean): void {
    this.reduceShake = v;
  }

  setTimeScale(s: number): void {
    this.timeScale = s;
  }

  shake(strength: number): void {
    const s = this.reduceShake ? strength * 0.22 : strength;
    this.shakeAmt = Math.min(1.4, this.shakeAmt + s);
  }

  setPhase(phase: number): void {
    this.arena.setPhase(phase);
    this.boss.setPhase(phase);
    this.lighting.setPhase(phase);
    this.particles.setIntensity(this.lowPerf ? 0.35 : 0.8 + phase * 0.25);
  }

  setCam(state: CamState, opts: CamOptions = {}): void {
    if (state === this.camState && opts.shot === this.camOpts.shot && opts.focusId === this.camOpts.focusId
      && opts.targetId === this.camOpts.targetId) return;
    this.camState = state;
    this.camOpts = { ...opts };
    if (state === 'phase') this.orbitT = 0;
    this.camTarget = this.computeTarget(state, this.camOpts);
  }

  getCamState(): CamState {
    return this.camState;
  }

  private slotOf(id?: string): THREE.Vector3 {
    if (id && PARTY_SLOTS[id]) return PARTY_SLOTS[id];
    return new THREE.Vector3(0, 0, 2.9);
  }

  /** 舞台中心：队伍在 z≈+2.5~3.4，Boss 在 z=-4.3，机位统一放在半径 >= 5 的环上，避免队友贴脸遮挡 */
  private ring(angleDeg: number, radius: number, height: number): THREE.Vector3 {
    const a = (angleDeg * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(a) * radius, height, -0.6 + Math.cos(a) * radius);
  }

  private computeTarget(state: CamState, o: CamOptions): CamTarget {
    const focus = this.slotOf(o.focusId);
    const bossHead = BOSS_POS.clone().add(new THREE.Vector3(0, 2.3, 0));
    const bossChest = BOSS_POS.clone().add(new THREE.Vector3(0, 1.7, 0));
    const mid = new THREE.Vector3(0, 1.5, -0.9);
    // 当前角色所在的左右侧（-1 左 / 0 中 / +1 右）
    const side = focus.x > 0.8 ? 1 : focus.x < -0.8 ? -1 : 0;
    switch (state) {
      case 'intro':
        return { pos: this.ring(-62, 9.0, 1.6), look: bossChest, fov: 38, speed: 1.05 };
      case 'idle':
        // 当前角色身后 3/4 视角，三人与 Boss 同时在画面内
        return { pos: this.ring(-8 + side * 7, 9.3, 3.7), look: new THREE.Vector3(0, 1.45, -1.2), fov: 42, speed: 1.9 };
      case 'command':
        // 横移到当前角色腰部高度，Boss 保持在画面中心偏右
        return {
          pos: this.ring(-30 + side * 7, 8.3, 2.05),
          look: new THREE.Vector3(0.35, 1.4, -1.7),
          fov: 44, speed: 1.1,
        };
      case 'skills':
        // 肩后中景，技能面板沿视线方向倾斜
        return {
          pos: this.ring(-26 + side * 7, 7.5, 2.4),
          look: new THREE.Vector3(0.4, 1.5, -2.0),
          fov: 42, speed: 1.5,
        };
      case 'target':
        return { pos: this.ring(-9, 6.4, 2.7), look: bossHead, fov: 36, speed: 1.8 };
      case 'aim':
        return { pos: this.ring(-4, 5.3, 2.5), look: bossHead, fov: 34, speed: 2.3 };
      case 'playerAction': {
        const shot = (o.shot || 0) % 4;
        const shots: CamTarget[] = [
          { pos: this.ring(-46 + side * 4, 7.2, 1.75), look: new THREE.Vector3(0, 1.55, -2.4), fov: 40, speed: 2.5 },
          { pos: this.ring(40 + side * 3, 7.6, 2.3), look: new THREE.Vector3(0, 1.5, -2.6), fov: 38, speed: 2.5 },
          { pos: this.ring(-10, 6.3, 1.0), look: bossChest, fov: 44, speed: 2.3 },
          { pos: this.ring(22, 8.6, 4.1), look: new THREE.Vector3(0, 1.2, -2.2), fov: 39, speed: 2.2 },
        ];
        return shots[shot];
      }
      case 'bossAttack': {
        // 切到被攻击角色的侧前方：Boss 的手臂预备动作与接触点必须同时可见
        const victim = this.slotOf(o.targetId || o.focusId);
        const vSide = victim.x > 0.8 ? 1 : victim.x < -0.8 ? -1 : 0;
        return {
          pos: this.ring(-34 + vSide * 16, 7.2, 2.15),
          look: new THREE.Vector3(victim.x * 0.35, 1.2, -1.9),
          fov: 41, speed: 1.8,
        };
      }
      case 'counter': {
        const shot = (o.shot || 0) % 4;
        const who = this.slotOf(o.focusId);
        const wSide = who.x > 0.8 ? 1 : who.x < -0.8 ? -1 : 0;
        const shots: CamTarget[] = [
          { pos: this.ring(-40 + wSide * 10, 6.5, 1.55), look: new THREE.Vector3(who.x * 0.3, 1.45, -2.4), fov: 37, speed: 2.9 },
          { pos: this.ring(34 + wSide * 8, 6.7, 1.4), look: new THREE.Vector3(who.x * 0.2, 1.5, -2.6), fov: 36, speed: 2.9 },
          { pos: this.ring(-2, 5.6, 1.05), look: bossChest, fov: 42, speed: 2.7 },
          { pos: this.ring(-6, 9.2, 3.7), look: mid, fov: 44, speed: 1.4 },
        ];
        return shots[shot];
      }
      case 'phase':
        return { pos: this.ring(46, 6.6, 0.95), look: bossChest, fov: 45, speed: 1.0 };
      case 'victory':
        return { pos: this.ring(-26, 5.7, 1.05), look: bossChest, fov: 40, speed: 0.9 };
      case 'defeat':
        return { pos: this.ring(6, 8.8, 1.7), look: new THREE.Vector3(0, 0.7, 0.8), fov: 44, speed: 0.9 };
      default:
        return { pos: this.ring(0, 9.3, 3.6), look: mid, fov: 42, speed: 1.6 };
    }
  }

  private applyCamera(k: number): void {
    this.camera.position.copy(this.curPos);
    if (this.shakeAmt > 0.0005) {
      const s = this.shakeAmt;
      const n = (a: number) => Math.sin((this.t + this.shakeSeed) * a) * s;
      this.camera.position.x += n(58.3) * 0.075;
      this.camera.position.y += n(71.7) * 0.06;
      this.camera.position.z += n(43.1) * 0.05;
    }
    this.lookMatrix.lookAt(this.camera.position, this.curLook, this.UP);
    this.lookQuat.setFromRotationMatrix(this.lookMatrix);
    this.camera.quaternion.slerp(this.lookQuat, Math.min(1, Math.max(0.02, k)));
    this.camera.fov = this.curFov;
    this.camera.updateProjectionMatrix();
  }

  update(dtMs: number): void {
    if (this.disposed) return;
    const dt = Math.min(0.1, (dtMs / 1000) * this.timeScale);
    this.t += dt;
    if (this.camState === 'phase') {
      // 低机位环绕：半径与高度都有下限，绝不穿进 Boss 的披风与羽翼
      this.orbitT += dt;
      const a = 0.8 + this.orbitT * 1.05;
      const r = Math.max(5.4, 7.0 - this.orbitT * 0.55);
      this.camTarget.pos.set(Math.sin(a) * r, 0.9 + this.orbitT * 0.32, -0.6 + Math.cos(a) * r);
      this.camTarget.look.set(BOSS_POS.x, 1.75, BOSS_POS.z);
    }
    const k = 1 - Math.exp(-this.camTarget.speed * 3.1 * dt);
    this.curPos.lerp(this.camTarget.pos, k);
    this.curLook.lerp(this.camTarget.look, Math.min(1, k * 1.25));
    this.curFov += (this.camTarget.fov - this.curFov) * Math.min(1, k * 1.1);
    this.shakeAmt *= Math.exp(-6.4 * dt);
    this.applyCamera(Math.min(1, k * 1.35));

    this.arena.update(this.t, dt);
    this.particles.update(this.t, dt);
    this.boss.update(this.t, dt);
    for (const id of Object.keys(this.chars)) this.chars[id].update(this.t, dt);
    this.fx.update(this.t, dt);
    this.lighting.update(this.t, dt);
    this.renderer.render(this.scene, this.camera);
  }

  /** 世界坐标 -> 屏幕像素 */
  project(v: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const p = v.clone().project(this.camera);
    return {
      x: (p.x * 0.5 + 0.5) * this.lastW,
      y: (-p.y * 0.5 + 0.5) * this.lastH,
      visible: p.z < 1 && p.x > -1.35 && p.x < 1.35 && p.y > -1.4 && p.y < 1.4,
    };
  }

  anchorWorld(actorId: string, part: 'chest' | 'head' | 'weapon' = 'chest'): THREE.Vector3 {
    const out = new THREE.Vector3();
    if (actorId === 'boss') {
      const o = part === 'head' ? this.boss.anchors.head : this.boss.anchors.chest;
      o.getWorldPosition(out);
      return out;
    }
    const m = this.chars[actorId];
    if (!m) return out.set(0, 1.4, 0);
    const o = part === 'head' ? m.anchors.head : part === 'weapon' ? m.anchors.weaponTip : m.anchors.chest;
    o.getWorldPosition(out);
    return out;
  }

  weakPointWorld(id: 'gold_core' | 'violet_core'): THREE.Vector3 {
    const out = new THREE.Vector3();
    this.boss.anchors[id].getWorldPosition(out);
    return out;
  }

  /** 重开一局：只重建角色与 Boss，避免反复创建 WebGL 上下文 */
  resetActors(): void {
    this.boss.dispose();
    this.scene.remove(this.boss.group);
    const boss = createBossModel();
    boss.group.position.copy(BOSS_POS);
    this.scene.add(boss.group);
    (this as { boss: BossModel }).boss = boss;
    for (const id of Object.keys(this.chars)) {
      this.chars[id].dispose();
      this.scene.remove(this.chars[id].group);
      const spec = {
        sciel: { id, color: '#a97cff', rimColor: '#7f6bd8' },
        lune: { id, color: '#59c9f2', rimColor: '#4aa6e8' },
        maelle: { id, color: '#ff6f5e', rimColor: '#ffd479' },
      }[id as 'sciel' | 'lune' | 'maelle'];
      const m = createCharacterModel(spec as never);
      m.group.position.copy(PARTY_SLOTS[id]);
      m.group.lookAt(BOSS_POS.x, 0, BOSS_POS.z);
      this.scene.add(m.group);
      this.chars[id] = m;
    }
    this.setPhase(1);
    this.shakeAmt = 0;
    this.timeScale = 1;
    this.camState = 'intro';
    this.camOpts = {};
    this.camTarget = this.computeTarget('intro', {});
    this.curPos.copy(this.camTarget.pos);
    this.curLook.copy(this.camTarget.look);
    this.curFov = this.camTarget.fov;
    this.applyCamera(1);
  }

  dispose(): void {
    this.disposed = true;
    this.arena.dispose();
    this.particles.dispose();
    this.boss.dispose();
    for (const id of Object.keys(this.chars)) this.chars[id].dispose();
    this.fx.dispose();
    this.lighting.dispose();
    this.scene.remove(this.fillAmbient, this.fillLight, this.fillLight.target, this.frontLight, this.frontLight.target);
    this.fillLight.dispose();
    this.frontLight.dispose();
    this.fillAmbient.dispose();
    this.scene.clear();
    this.renderer.dispose();
  }
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  return new Stage(canvas);
}
