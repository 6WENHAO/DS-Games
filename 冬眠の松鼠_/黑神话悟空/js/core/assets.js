import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { audio } from './audio.js';

const MODEL_DIR = 'assets/models';
const ENV_DIR = 'assets/models/env';
const TEX_DIR = 'assets/textures';

export const MANIFEST = {
  characters: {
    hero: `${MODEL_DIR}/Barbarian.glb`,
    mage: `${MODEL_DIR}/Mage.glb`,
    skeletonMinion: `${MODEL_DIR}/Skeleton_Minion.glb`,
    skeletonRogue: `${MODEL_DIR}/Skeleton_Rogue.glb`,
    skeletonWarrior: `${MODEL_DIR}/Skeleton_Warrior.glb`,
    skeletonMage: `${MODEL_DIR}/Skeleton_Mage.glb`,
  },
  weapons: {
    skeletonBlade: `${MODEL_DIR}/weapons/Skeleton_Blade.gltf`,
    skeletonAxe: `${MODEL_DIR}/weapons/Skeleton_Axe.gltf`,
    skeletonStaff: `${MODEL_DIR}/weapons/Skeleton_Staff.gltf`,
  },
  props: [
    'pine', 'pine-crooked', 'pine-fall', 'pine-fall-crooked',
    'gravestone-bevel', 'gravestone-broken', 'gravestone-cross', 'gravestone-round',
    'gravestone-wide', 'gravestone-decorative', 'grave', 'grave-border',
    'cross', 'cross-wood', 'crypt', 'crypt-large',
    'pillar-obelisk', 'pillar-square', 'pillar-large', 'column-large', 'cross-column', 'border-pillar',
    'fence', 'fence-damaged', 'fence-gate', 'iron-fence', 'iron-fence-damaged',
    'lantern-candle', 'lantern-glass', 'fire-basket', 'lightpost-single',
    'stone-wall', 'stone-wall-damaged', 'stone-wall-column', 'stone-wall-curve',
    'rocks', 'rocks-tall', 'trunk', 'trunk-long',
    'coffin', 'coffin-old', 'urn-round', 'urn-square', 'debris', 'debris-wood',
    'altar-stone', 'altar-wood', 'candle', 'candle-multiple', 'road',
    'bench-damaged', 'shovel-dirt',
    'rock_largeA', 'rock_largeC', 'rock_largeE', 'rock_tallB', 'rock_tallD',
    'rock_smallA', 'rock_smallD', 'stump_old', 'stump_round',
    'grass', 'grass_large', 'grass_leafs',
    'statue_head', 'statue_ring', 'statue_obelisk', 'statue_column',
    'cliff_large_rock', 'cliff_block_rock', 'cliff_top_rock',
    'mushroom_red', 'mushroom_tan', 'plant_bush', 'plant_bushDetailed',
  ],
  textures: {
    groundColor: `${TEX_DIR}/Ground037_Color.jpg`,
    groundNormal: `${TEX_DIR}/Ground037_Normal.jpg`,
    groundRough: `${TEX_DIR}/Ground037_Roughness.jpg`,
    gravelColor: `${TEX_DIR}/Gravel022_Color.jpg`,
    gravelNormal: `${TEX_DIR}/Gravel022_Normal.jpg`,
    rockColor: `${TEX_DIR}/Rock030_Color.jpg`,
    rockNormal: `${TEX_DIR}/Rock030_Normal.jpg`,
    mossColor: `${TEX_DIR}/Moss002_Color.jpg`,
    barkColor: `${TEX_DIR}/Bark012_Color.jpg`,
    barkNormal: `${TEX_DIR}/Bark012_Normal.jpg`,
  },
  hdri: 'assets/hdri/sky_1k.hdr',
  audio: {
    swing1: 'assets/audio/swing1.ogg',
    swing2: 'assets/audio/swing2.ogg',
    swing3: 'assets/audio/swing3.ogg',
    hitBone1: 'assets/audio/hit_bone1.ogg',
    hitBone2: 'assets/audio/hit_bone2.ogg',
    hitBone3: 'assets/audio/hit_bone3.ogg',
    hitHeavy1: 'assets/audio/hit_heavy1.ogg',
    hitHeavy2: 'assets/audio/hit_heavy2.ogg',
    playerHurt: 'assets/audio/player_hurt.ogg',
    step1: 'assets/audio/step1.ogg',
    step2: 'assets/audio/step2.ogg',
    step3: 'assets/audio/step3.ogg',
    step4: 'assets/audio/step4.ogg',
    roll: 'assets/audio/roll.ogg',
    drink: 'assets/audio/drink.ogg',
    deathBell: 'assets/audio/death_bell.ogg',
    stun: 'assets/audio/stun.ogg',
    uiClick: 'assets/audio/ui_click.ogg',
    uiConfirm: 'assets/audio/ui_confirm.ogg',
    uiBack: 'assets/audio/ui_back.ogg',
    enemyDie: 'assets/audio/enemy_die.ogg',
    parry: 'assets/audio/parry.ogg',
  },
  music: {
    ambient: 'assets/audio/ambient_theme.mp3',
    boss: 'assets/audio/boss_theme.mp3',
  },
};

export class AssetLibrary {
  constructor() {
    this.gltf = new Map();      // key -> gltf (characters/weapons)
    this.props = new Map();     // name -> scene
    this.textures = new Map();
    this.envMap = null;
    this.progress = 0;
  }

  async loadAll(onProgress, { skipAudio = false } = {}) {
    const gltfLoader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();
    const rgbeLoader = new RGBELoader();

    const jobs = [];
    const charEntries = Object.entries(MANIFEST.characters);
    const weaponEntries = Object.entries(MANIFEST.weapons);
    const texEntries = Object.entries(MANIFEST.textures);
    const audioCount = skipAudio ? 0 : Object.keys(MANIFEST.audio).length;
    const total = charEntries.length + weaponEntries.length + MANIFEST.props.length +
      texEntries.length + 1 + audioCount;
    let done = 0;
    const tick = () => { done++; this.progress = done / total; onProgress?.(this.progress); };

    for (const [key, url] of [...charEntries, ...weaponEntries]) {
      jobs.push(gltfLoader.loadAsync(url).then((g) => { this.gltf.set(key, g); tick(); }));
    }
    for (const name of MANIFEST.props) {
      jobs.push(gltfLoader.loadAsync(`${ENV_DIR}/${name}.glb`).then((g) => {
        this.props.set(name, g.scene);
        tick();
      }).catch((e) => { console.warn('prop failed', name, e); tick(); }));
    }
    for (const [key, url] of texEntries) {
      jobs.push(texLoader.loadAsync(url).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        if (key.endsWith('Color')) t.colorSpace = THREE.SRGBColorSpace;
        this.textures.set(key, t);
        tick();
      }).catch((e) => { console.warn('tex failed', key, e); tick(); }));
    }
    jobs.push(rgbeLoader.loadAsync(MANIFEST.hdri).then((t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      this.envMap = t;
      tick();
    }).catch((e) => { console.warn('hdri failed', e); tick(); }));

    if (!skipAudio) {
      jobs.push(audio.loadBuffers(MANIFEST.audio, tick));
    }

    await Promise.all(jobs);
  }

  tex(key) { return this.textures.get(key); }
  prop(name) { return this.props.get(name); }
  char(key) { return this.gltf.get(key); }
}

export const assets = new AssetLibrary();
