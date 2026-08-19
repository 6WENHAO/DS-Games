// ============================================================
// sprites.js — 精灵烘焙与逐帧动画数据
// 精灵地图由 tools/designer.js 程序化设计并导出为 maps.generated.js
// （全部为原创像素画，未使用任天堂官方素材）
// ============================================================
'use strict';

// MAPDATA 由 maps.generated.js 提供（浏览器为全局变量；Node 测试先注入）
const FIREFOX_F = MAPDATA.FIREFOX_F;
const SPROUTAUR_F = MAPDATA.SPROUTAUR_F;
const WAVETURTLE_F = MAPDATA.WAVETURTLE_F;
const VOLTMOUSE_F = MAPDATA.VOLTMOUSE_F;
const PSYKITTY_F = MAPDATA.PSYKITTY_F;
const ROCKRHINO_F = MAPDATA.ROCKRHINO_F;
const FIREFOX_B = MAPDATA.FIREFOX_B;
const SPROUTAUR_B = MAPDATA.SPROUTAUR_B;
const WAVETURTLE_B = MAPDATA.WAVETURTLE_B;
const VOLTMOUSE_B = MAPDATA.VOLTMOUSE_B;
const PSYKITTY_B = MAPDATA.PSYKITTY_B;
const ROCKRHINO_B = MAPDATA.ROCKRHINO_B;
const ICON_MAPS = {
  firefox: MAPDATA.ICON_firefox,
  sproutaur: MAPDATA.ICON_sproutaur,
  waveturtle: MAPDATA.ICON_waveturtle,
  voltmouse: MAPDATA.ICON_voltmouse,
  psykitty: MAPDATA.ICON_psykitty,
  rockrhino: MAPDATA.ICON_rockrhino,
};

// ---------- 小型杂项像素图（手绘，已验证）----------
const LEAF = { w: 5, h: 5, rows: ['..G..', '.GGG.', 'GGGGG', '.GGG.', '..G..'] };
const CURSOR = { w: 7, h: 9, rows: ['K1111..', 'KWW111.', 'KWWW11.', 'KWWWW1.', 'KWWW11.', 'K1WW1..', 'K11W1..', '.K..1..', '..K.1..'] };
const STATUS_ICONS = {
  '中毒': { w: 8, h: 8, rows: ['..SSS...', '.SSSSS..', '.SSSSSS.', '.SSSSSS.', '..SSSS..', '..SSSS..', '...SS...', '........'] },
  '剧毒': { w: 8, h: 8, rows: ['..SSS...', '.STSSS..', '.SSSSSS.', '.SSSSSS.', '..SSSS..', '.SSSSSS.', '..SSSS..', '...SS...'] },
  '烧伤': { w: 8, h: 8, rows: ['...NN...', '..NNNN..', '..NMMN..', '.NMMMMN.', '.NMMMMN.', '.NMMMN..', '..NNN...', '........'] },
  '麻痹': { w: 8, h: 8, rows: ['....K...', '...KK...', '..KKK...', '.KKKK...', '...KK...', '..KK....', '.KK.....', '........'] },
  '睡眠': { w: 8, h: 8, rows: ['..VVVV..', '.VVVVVV.', '.V..V..V', 'V..V...V', '..V.....', '.V......', '........', '........'] },
  '冰冻': { w: 8, h: 8, rows: ['...66...', '..66.66.', '.66.66..', '.66.66..', '.66.66..', '..66.66.', '...66...', '........'] },
  '混乱': { w: 8, h: 8, rows: ['..KKKK..', '.KK..KK.', 'K.....K.', '....TT..', '..TT....', '.TT.....', 'T....T..', '........'] },
};
const WEATHER_ICONS = {
  '大晴天': { w: 8, h: 8, rows: ['...KK...', '.K.K.K..', '..KKK...', '.KKKKK..', '..KKK...', '.K.K.K..', '...KK...', '........'] },
  '雨天': { w: 8, h: 8, rows: ['..PPP...', '.PPPPP..', '..PPP...', '........', '.P.P.P..', '.P.P.P..', '.P.P.P..', '........'] },
  '沙暴': { w: 8, h: 8, rows: ['........', '.AA.AA..', 'AA.AA.AA', '.AA.AA..', 'AA.AA.AA', '.AA.AA..', 'AA.AA.A.', '........'] },
  '电气场地': { w: 8, h: 8, rows: ['...K....', '..KK....', '.KKK....', 'KKKK....', '..KK....', '.KK.....', 'K.......', '........'] },
  '晴天': null,
};

// ---------- 烘焙 ----------
function bakeMap(map) {
  const c = document.createElement('canvas');
  c.width = map.w;
  c.height = map.h;
  const g = c.getContext('2d');
  for (let y = 0; y < map.h; y++) {
    const row = map.rows[y] || '';
    for (let x = 0; x < map.w; x++) {
      const ch = row[x];
      if (ch === undefined || ch === '.' || ch === ' ') continue;
      const code = ch.charCodeAt(0);
      const idx = code >= 48 && code <= 57 ? code - 48 : code - 65 + 10;
      if (idx < 0 || idx >= 32) continue;
      g.fillStyle = PAL[idx];
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

function bakeSilhouette(map) {
  const c = document.createElement('canvas');
  c.width = map.w;
  c.height = map.h;
  const g = c.getContext('2d');
  for (let y = 0; y < map.h; y++) {
    const row = map.rows[y] || '';
    for (let x = 0; x < map.w; x++) {
      const ch = row[x];
      if (ch === undefined || ch === '.' || ch === ' ') continue;
      const code = ch.charCodeAt(0);
      const idx = code >= 48 && code <= 57 ? code - 48 : code - 65 + 10;
      g.fillStyle = PAL[idx === 1 ? 1 : 30];
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

let SPRITES = null;

function bakeSprites() {
  if (SPRITES) return SPRITES;
  const front = {}, back = {}, icon = {}, white = {}, whiteBack = {};
  const F = { firefox: FIREFOX_F, sproutaur: SPROUTAUR_F, waveturtle: WAVETURTLE_F, voltmouse: VOLTMOUSE_F, psykitty: PSYKITTY_F, rockrhino: ROCKRHINO_F };
  const B = { firefox: FIREFOX_B, sproutaur: SPROUTAUR_B, waveturtle: WAVETURTLE_B, voltmouse: VOLTMOUSE_B, psykitty: PSYKITTY_B, rockrhino: ROCKRHINO_B };
  for (const id in F) {
    front[id] = bakeMap(F[id]);
    white[id] = bakeSilhouette(F[id]);
  }
  for (const id in B) {
    back[id] = bakeMap(B[id]);
    whiteBack[id] = bakeSilhouette(B[id]);
  }
  for (const id in ICON_MAPS) icon[id] = bakeMap(ICON_MAPS[id]);
  SPRITES = { front, back, icon, white, whiteBack };
  return SPRITES;
}

// 地图结构校验
function validateMaps() {
  const errs = [];
  const all = Object.assign({}, MAPDATA, { LEAF, CURSOR });
  for (const name in all) {
    const m = all[name];
    if (m.rows.length !== m.h) errs.push(name + ': rows=' + m.rows.length + ' != h=' + m.h);
    m.rows.forEach(function (row, i) {
      if (row.length !== m.w) errs.push(name + ': row ' + i + ' len=' + row.length + ' != w=' + m.w);
    });
    let count = 0;
    for (const row of m.rows) for (const ch of row) if (ch !== '.' && ch !== ' ') count++;
    if (count < 8) errs.push(name + ': 有效像素过少(' + count + ')');
  }
  return errs;
}

// 待机动画（4 帧 @ 8fps）：GBA 式上下弹跳
const IDLE_FRAMES = [
  { x: 0, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: -2 },
  { x: 0, y: -1 },
];
const IDLE_SHADOW_SCALE = [1, 0.94, 0.88, 0.94];

function idleFrame(t) {
  return IDLE_FRAMES[Math.floor(t / 125) % 4];
}
function idleShadowScale(t) {
  return IDLE_SHADOW_SCALE[Math.floor(t / 125) % 4];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { bakeMap, bakeSprites, bakeSilhouette, validateMaps, LEAF, CURSOR, STATUS_ICONS, WEATHER_ICONS, IDLE_FRAMES, IDLE_SHADOW_SCALE, idleFrame, idleShadowScale };
}
