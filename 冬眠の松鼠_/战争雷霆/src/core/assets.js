import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/**
 * 资源清单与加载器（带进度回调）
 */
const MODELS = {
  tank_desert: 'assets/models/tanks/tank_desert.glb',
  tank_olive: 'assets/models/tanks/tank_olive.glb',
  tank_green: 'assets/models/tanks/tank_green.glb',
  tank_red: 'assets/models/tanks/tank_red.glb',
  wreck_tank: 'assets/models/props/wreck_tank.glb',
  pine_a: 'assets/models/props/pine_a.glb',
  pine_b: 'assets/models/props/pine_b.glb',
  pine_c: 'assets/models/props/pine_c.glb',
  rock_b: 'assets/models/props/rock_b.glb',
  rock_large: 'assets/models/props/rock_large.glb',
  rocks_a: 'assets/models/props/rocks_a.glb',
  bush: 'assets/models/props/bush.glb',
  hedge: 'assets/models/props/hedge.glb',
  barrel_a: 'assets/models/props/barrel_a.glb',
  barrel_explode: 'assets/models/props/barrel_explode.glb',
  sack_trench: 'assets/models/props/sack_trench.glb',
  bags: 'assets/models/props/bags.glb',
  guard_tower: 'assets/models/props/guard_tower.glb',
  watch_tower: 'assets/models/props/watch_tower.glb',
  barn: 'assets/models/props/barn.glb',
  big_barn: 'assets/models/props/big_barn.glb',
  windmill: 'assets/models/props/windmill.glb',
  fence_a: 'assets/models/props/fence_a.glb',
  wooden_wall: 'assets/models/props/wooden_wall.glb',
  house_a: 'assets/models/props/house_a.glb',
  house_b: 'assets/models/props/house_b.glb',
  house_long: 'assets/models/props/house_long.glb',
  big_building: 'assets/models/props/big_building.glb',
};

const TERRAIN_TEX = ['grass', 'grass2', 'dirt', 'rock', 'gravel'];

const PARTICLES = [
  'smoke_01', 'smoke_02', 'smoke_03', 'smoke_04', 'smoke_05', 'smoke_06', 'smoke_07', 'smoke_08',
  'fire_01', 'fire_02', 'flame_01', 'flame_03', 'flame_05',
  'muzzle_01', 'muzzle_02', 'muzzle_03', 'muzzle_05',
  'dirt_01', 'dirt_02', 'dirt_03',
  'scorch_01', 'scorch_02',
  'trace_01', 'trace_02', 'trace_06',
  'spark_01', 'spark_04', 'flare_01', 'light_01', 'circle_05', 'twirl_02', 'star_07',
];

const AUDIO = {
  cannon: 'assets/audio/cannon_fire.ogg',
  explosion: 'assets/audio/explosion.wav',
  explosion_big: 'assets/audio/explosion_synth.flac',
  explosion_far: 'assets/audio/explosion_distant.wav',
  explosion_chunky: 'assets/audio/explosion_chunky.mp3',
  engine0: 'assets/audio/engine_loop_0.wav',
  engine1: 'assets/audio/engine_loop_1.wav',
  metal_heavy0: 'assets/audio/impactMetal_heavy_000.ogg',
  metal_heavy1: 'assets/audio/impactMetal_heavy_001.ogg',
  metal_heavy2: 'assets/audio/impactMetal_heavy_002.ogg',
  metal_med0: 'assets/audio/impactMetal_medium_000.ogg',
  metal_med1: 'assets/audio/impactMetal_medium_001.ogg',
  ricochet: 'assets/audio/metal_clink1.wav',
  clang: 'assets/audio/metal_bong1.wav',
  thud: 'assets/audio/metal_thud2.wav',
  ui_click: 'assets/audio/ui_click.ogg',
  ui_click2: 'assets/audio/ui_click2.ogg',
  ui_confirm: 'assets/audio/ui_confirm.ogg',
};

export class Assets {
  constructor() {
    this.models = {};
    this.terrain = {};
    this.particles = {};
    this.audio = {};
    this.envMap = null;
    this.skyTexture = null;
  }

  async loadAll(renderer, audioCtx, onProgress) {
    const gltfLoader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();
    const rgbeLoader = new RGBELoader();

    const tasks = [];
    let done = 0;
    const total =
      Object.keys(MODELS).length +
      TERRAIN_TEX.length * 3 +
      PARTICLES.length +
      Object.keys(AUDIO).length + 1;

    const step = (label) => {
      done++;
      if (onProgress) onProgress(done / total, label);
    };

    // HDR 环境
    tasks.push(
      rgbeLoader.loadAsync('assets/env/sky.hdr').then((tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        this.skyTexture = tex;
        const pmrem = new THREE.PMREMGenerator(renderer);
        this.envMap = pmrem.fromEquirectangular(tex).texture;
        pmrem.dispose();
        step('天空环境');
      })
    );

    // 模型
    for (const [key, url] of Object.entries(MODELS)) {
      tasks.push(
        gltfLoader.loadAsync(url).then((g) => {
          this.models[key] = g;
          step(`模型 ${key}`);
        })
      );
    }

    // 地形纹理
    for (const name of TERRAIN_TEX) {
      this.terrain[name] = {};
      for (const part of ['color', 'normal', 'rough']) {
        tasks.push(
          texLoader.loadAsync(`assets/textures/terrain/${name}/${part}.jpg`).then((t) => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.anisotropy = 8;
            if (part === 'color') t.colorSpace = THREE.SRGBColorSpace;
            this.terrain[name][part] = t;
            step(`地表纹理 ${name}`);
          })
        );
      }
    }

    // 粒子贴图
    for (const p of PARTICLES) {
      tasks.push(
        texLoader.loadAsync(`assets/textures/particles/${p}.png`).then((t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          this.particles[p] = t;
          step(`特效 ${p}`);
        })
      );
    }

    // 音频
    for (const [key, url] of Object.entries(AUDIO)) {
      tasks.push(
        fetch(url)
          .then((r) => r.arrayBuffer())
          .then((buf) => audioCtx.decodeAudioData(buf))
          .then((ab) => {
            this.audio[key] = ab;
            step(`音效 ${key}`);
          })
          .catch(() => { step(`音效 ${key} (失败)`); })
      );
    }

    await Promise.all(tasks);
  }
}
