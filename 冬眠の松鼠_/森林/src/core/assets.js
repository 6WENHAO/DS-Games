import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 统一资源管理：纹理 / glTF 模型 / 音频缓冲
class AssetManager {
  constructor() {
    this.texLoader = new THREE.TextureLoader();
    this.gltfLoader = new GLTFLoader();
    this.audioCtx = null;
    this.textures = new Map();
    this.models = new Map();
    this.sounds = new Map();
    this.progress = { done: 0, total: 0 };
    this.onProgress = null;
  }

  _tick() {
    this.progress.done++;
    if (this.onProgress) this.onProgress(this.progress.done, this.progress.total);
  }

  loadTexture(key, url, opts = {}) {
    this.progress.total++;
    return new Promise((resolve, reject) => {
      this.texLoader.load(url, (tex) => {
        if (opts.srgb) tex.colorSpace = THREE.SRGBColorSpace;
        if (opts.repeat) {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        }
        tex.anisotropy = 8;
        this.textures.set(key, tex);
        this._tick();
        resolve(tex);
      }, undefined, (err) => { console.error('texture fail', url, err); this._tick(); resolve(null); });
    });
  }

  loadModel(key, url) {
    this.progress.total++;
    return new Promise((resolve) => {
      this.gltfLoader.load(url, (gltf) => {
        this.models.set(key, gltf);
        this._tick();
        resolve(gltf);
      }, undefined, (err) => { console.error('model fail', url, err); this._tick(); resolve(null); });
    });
  }

  loadSound(key, url) {
    this.progress.total++;
    return fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        this.sounds.set(key, buf); // 延迟解码（AudioContext 需用户手势后创建）
        this._tick();
      })
      .catch((e) => { console.error('sound fail', url, e); this._tick(); });
  }

  tex(key) { return this.textures.get(key); }
  model(key) { return this.models.get(key); }

  // 提取 glTF 场景，开启阴影
  cloneModelScene(key, { castShadow = true, receiveShadow = false } = {}) {
    const gltf = this.models.get(key);
    if (!gltf) return null;
    const scene = gltf.scene.clone(true);
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = castShadow;
        o.receiveShadow = receiveShadow;
      }
    });
    return scene;
  }
}

export const Assets = new AssetManager();

export async function loadAllAssets() {
  const A = Assets;
  const T = 'assets/textures';
  const M = 'assets/models';
  const S = 'assets/sounds';

  const jobs = [];

  // ---- 地形 PBR 纹理 ----
  const terr = [
    ['grass', `${T}/Grass004/Grass004_1K-JPG`],
    ['dirt', `${T}/Ground037/Ground037_1K-JPG`],
    ['rock', `${T}/Rock035/Rock035_1K-JPG`],
    ['sand', `${T}/Ground054/Ground054_1K-JPG`],
  ];
  for (const [key, base] of terr) {
    jobs.push(A.loadTexture(`${key}_col`, `${base}_Color.jpg`, { srgb: true, repeat: true }));
    jobs.push(A.loadTexture(`${key}_nrm`, `${base}_NormalGL.jpg`, { repeat: true }));
  }

  // ---- 树皮 / 树叶 / 木板 ----
  jobs.push(A.loadTexture('bark_col', `${T}/Bark012/Bark012_1K-JPG_Color.jpg`, { srgb: true, repeat: true }));
  jobs.push(A.loadTexture('bark_nrm', `${T}/Bark012/Bark012_1K-JPG_NormalGL.jpg`, { repeat: true }));
  jobs.push(A.loadTexture('bark_rgh', `${T}/Bark012/Bark012_1K-JPG_Roughness.jpg`, { repeat: true }));
  jobs.push(A.loadTexture('leaf_col', `${T}/LeafSet024/LeafSet024_1K-PNG_Color.png`, { srgb: true }));
  jobs.push(A.loadTexture('leaf_opa', `${T}/LeafSet024/LeafSet024_1K-PNG_Opacity.png`, {}));
  jobs.push(A.loadTexture('leaf_nrm', `${T}/LeafSet024/LeafSet024_1K-PNG_NormalGL.png`, {}));
  jobs.push(A.loadTexture('planks_col', `${T}/Planks037A/Planks037A_1K-JPG_Color.jpg`, { srgb: true, repeat: true }));
  jobs.push(A.loadTexture('planks_nrm', `${T}/Planks037A/Planks037A_1K-JPG_NormalGL.jpg`, { repeat: true }));
  jobs.push(A.loadTexture('waternormals', `${T}/waternormals.jpg`, { repeat: true }));

  // ---- Poly Haven 模型 ----
  const models = [
    ['boulder', `${M}/boulder_01/boulder_01_1k.gltf`],
    ['moss_rocks', `${M}/rock_moss_set_01/rock_moss_set_01_1k.gltf`],
    ['fern', `${M}/fern_02/fern_02_1k.gltf`],
    ['shrub', `${M}/shrub_01/shrub_01_1k.gltf`],
    ['grass_tuft', `${M}/grass_medium_01/grass_medium_01_1k.gltf`],
    ['stump', `${M}/tree_stump_01/tree_stump_01_1k.gltf`],
    ['dead_trunk', `${M}/dead_tree_trunk/dead_tree_trunk_1k.gltf`],
    ['hatchet', `${M}/hatchet/hatchet_1k.gltf`],
    ['machete', `${M}/machete/machete_1k.gltf`],
    ['fire_pit', `${M}/stone_fire_pit/stone_fire_pit_1k.gltf`],
    ['apple', `${M}/food_apple_01/food_apple_01_1k.gltf`],
    ['crate', `${M}/old_military_crate/old_military_crate_1k.gltf`],
    ['suitcase', `${M}/vintage_suitcase/vintage_suitcase_1k.gltf`],
    ['medkit', `${M}/medical_box/medical_box_1k.gltf`],
  ];
  for (const [key, url] of models) jobs.push(A.loadModel(key, url));

  // ---- Kenney 低模（建筑构件补充） ----
  jobs.push(A.loadModel('k_tent', `${M}/survival-kit/Models/GLB format/tent.glb`));
  jobs.push(A.loadModel('k_bedroll', `${M}/survival-kit/Models/GLB format/bedroll.glb`));

  // ---- 音效 ----
  const sounds = [
    ['step_grass_0', `${S}/impact/Audio/footstep_grass_000.ogg`],
    ['step_grass_1', `${S}/impact/Audio/footstep_grass_001.ogg`],
    ['step_grass_2', `${S}/impact/Audio/footstep_grass_002.ogg`],
    ['step_grass_3', `${S}/impact/Audio/footstep_grass_003.ogg`],
    ['step_snow_0', `${S}/impact/Audio/footstep_snow_000.ogg`],
    ['step_snow_1', `${S}/impact/Audio/footstep_snow_001.ogg`],
    ['step_wood_0', `${S}/impact/Audio/footstep_wood_000.ogg`],
    ['step_wood_1', `${S}/impact/Audio/footstep_wood_001.ogg`],
    ['chop', `${S}/rpg/Audio/chop.ogg`],
    ['knife_1', `${S}/rpg/Audio/knifeSlice.ogg`],
    ['knife_2', `${S}/rpg/Audio/knifeSlice2.ogg`],
    ['draw_knife', `${S}/rpg/Audio/drawKnife1.ogg`],
    ['cloth_1', `${S}/rpg/Audio/cloth1.ogg`],
    ['cloth_2', `${S}/rpg/Audio/cloth2.ogg`],
    ['creak', `${S}/rpg/Audio/creak1.ogg`],
    ['metal_click', `${S}/rpg/Audio/metalClick.ogg`],
    ['handle_leather', `${S}/rpg/Audio/handleSmallLeather.ogg`],
    ['book_open', `${S}/rpg/Audio/bookOpen.ogg`],
    ['book_close', `${S}/rpg/Audio/bookClose.ogg`],
    ['book_flip', `${S}/rpg/Audio/bookFlip2.ogg`],
    ['ui_click', `${S}/ui/Audio/click_002.ogg`],
    ['ui_confirm', `${S}/ui/Audio/confirmation_001.ogg`],
    ['ui_error', `${S}/ui/Audio/error_004.ogg`],
    ['impact_soft', `${S}/impact/Audio/impactSoft_medium_000.ogg`],
    ['impact_soft_2', `${S}/impact/Audio/impactSoft_medium_002.ogg`],
    ['impact_punch', `${S}/impact/Audio/impactPunch_medium_000.ogg`],
    ['impact_wood', `${S}/impact/Audio/impactWood_medium_000.ogg`],
    ['impact_wood_2', `${S}/impact/Audio/impactWood_medium_002.ogg`],
  ];
  for (const [key, url] of sounds) jobs.push(A.loadSound(key, url));

  await Promise.all(jobs);
}
