// checks all asset URLs referenced by the manifest against the local server
const base = 'http://localhost:8093/';
const MODEL_DIR = 'assets/models';
const ENV_DIR = 'assets/models/env';
const TEX_DIR = 'assets/textures';
const fs = require('fs');

const src = fs.readFileSync('js/core/assets.js', 'utf8');
const propsMatch = src.match(/props:\s*\[([\s\S]*?)\]/);
const props = [...propsMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

const urls = [];
for (const n of ['Barbarian', 'Mage', 'Skeleton_Minion', 'Skeleton_Rogue', 'Skeleton_Warrior', 'Skeleton_Mage']) urls.push(`${MODEL_DIR}/${n}.glb`);
for (const n of ['Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Staff']) { urls.push(`${MODEL_DIR}/weapons/${n}.gltf`); urls.push(`${MODEL_DIR}/weapons/${n}.bin`); }
urls.push(`${MODEL_DIR}/weapons/skeleton_texture.png`);
for (const p of props) urls.push(`${ENV_DIR}/${p}.glb`);
for (const t of ['Ground037_Color', 'Ground037_Normal', 'Ground037_Roughness', 'Gravel022_Color', 'Gravel022_Normal', 'Rock030_Color', 'Rock030_Normal', 'Moss002_Color', 'Bark012_Color', 'Bark012_Normal']) urls.push(`${TEX_DIR}/${t}.jpg`);
urls.push('assets/hdri/sky_1k.hdr');
const audioSrc = src.match(/audio:\s*\{([\s\S]*?)\}/)[1];
for (const m of audioSrc.matchAll(/'(assets\/audio\/[^']+)'/g)) urls.push(m[1]);
urls.push('assets/audio/ambient_theme.mp3', 'assets/audio/boss_theme.mp3');

(async () => {
  let fail = 0;
  for (const u of urls) {
    try {
      const res = await fetch(base + u, { method: 'HEAD' });
      if (!res.ok) { console.log('MISS', res.status, u); fail++; }
    } catch (e) { console.log('ERR ', u, e.message); fail++; }
  }
  console.log(fail === 0 ? `ALL OK (${urls.length} files)` : `${fail} FAILURES of ${urls.length}`);
})();
