/**
 * Localisation.
 *
 * One dictionary, two locales, and a DOM pass that fills every element carrying
 * a data-i18n attribute. Dynamic strings go through t(key, vars); level names,
 * hints and concepts are keyed by level id, with English read straight from
 * levels.js so the puzzle data stays the single source for it.
 *
 * The chosen locale is stored in localStorage and reflected on <html lang>,
 * which is what switches the CJK font stack in the stylesheet.
 */

export const LOCALES = ['zh', 'en'];
export const DEFAULT_LOCALE = 'zh';
const STORAGE_KEY = 'tallgrass.locale';

const DICT = {
  en: {
    'doc.title': 'Tallgrass — a 3D pixel-art meadow and ten crate puzzles',
    'doc.description': 'An instanced grass shader with stop-motion wind, cloud shadows and a stylised HDRI sky, plus ten crate puzzles pushed by a low-poly whale on a mown garden plot.',

    'lang.label': 'Language',

    'boot.eyebrow': '3D pixel art · instanced grass',
    'boot.note': 'Every blade is one instanced quad. The wind runs at 12 frames a second.',
    'boot.step.start': 'Starting up',
    'boot.step.sky': 'Reading the sky',
    'boot.step.ground': 'Raising the ground',
    'boot.step.trees': 'Planting the trees',
    'boot.step.stones': 'Setting the stones',
    'boot.step.meadow': 'Sowing the meadow',
    'boot.step.crate': 'Carving the crate',
    'boot.step.ready': 'Ready',
    'boot.step.error': 'The scene failed to build. The browser console has the detail.',

    'title.eyebrow': 'Stage one: the meadow shader  ·  Stage two: ten crate puzzles',
    'title.lede': 'Tens of thousands of billboard blades in a single draw call, bending on a 12 fps stop-motion wind. A whale pushes crates across a mown plot in the same meadow.',
    'title.cornerNote': 'The crate on the road rolls on a loop. Move the mouse across the meadow to part the grass.',
    'menu.label': 'Main menu',
    'menu.play': 'Play',
    'menu.play.meta': 'ten puzzles',
    'menu.levels': 'Puzzle list',
    'menu.levels.meta': 'pick any',
    'menu.lab': 'Shader lab',
    'menu.lab.meta': 'live controls',
    'menu.credits': 'Credits',
    'menu.credits.meta': 'assets & sources',

    'hud.index': 'Puzzle {n} of {total}',
    'hud.seated': 'Crates set',
    'hud.pushes': 'Pushes',
    'hud.moves': 'Moves',
    'hud.key.arrows': 'arrows',
    'hud.key.move': 'move',
    'hud.key.undo': 'undo',
    'hud.key.restart': 'restart',
    'hud.key.title': 'title',
    'hud.btn.undo': 'Undo',
    'hud.btn.restart': 'Restart',
    'hud.btn.levels': 'Puzzles',
    'hud.btn.title': 'Title',
    'hud.lock': 'A crate is wedged in a corner. Press Z to take the push back.',
    'hud.dir.up': 'move up',
    'hud.dir.down': 'move down',
    'hud.dir.left': 'move left',
    'hud.dir.right': 'move right',

    'solved.eyebrow': 'Plot planted',
    'solved.body': 'Every crate sits on its mark.',
    'solved.pushes': 'Pushes',
    'solved.moves': 'Moves',
    'solved.next': 'Next puzzle',
    'solved.nextLast': 'Back to the title',
    'solved.replay': 'Play again',
    'solved.levels': 'Puzzle list',

    'levels.title': 'Puzzle list',
    'levels.note': 'Ten original boards in the compact single-idea idiom. The push figure is the shortest solution the bundled solver found.',
    'levels.back': 'Back',
    'levels.card': 'Puzzle {n}',
    'levels.pushes': '{n} pushes',
    'levels.unrated': 'unrated',

    'lab.title': 'Shader lab',
    'lab.note': 'Every control writes straight into the shared uniform block that the grass, ground, foliage and prop shaders all read.',
    'lab.close': 'Close',
    'lab.stat.blades': 'Blades',
    'lab.stat.calls': 'Draw calls',
    'lab.stat.tris': 'Triangles',
    'lab.stat.res': 'Render',
    'lab.stat.fps': 'FPS',

    'lab.group.wind': 'Wind',
    'lab.group.blades': 'Blades',
    'lab.group.light': 'Light and sky',
    'lab.group.clouds': 'Clouds and fog',
    'lab.group.frame': 'Frame',

    'lab.wind-strength': 'Bend strength',
    'lab.wind-speed': 'Drift speed',
    'lab.wind-scale': 'Noise scale',
    'lab.wind-gust': 'Gust envelope',
    'lab.stop-fps': 'Stop-motion rate',
    'lab.stop-motion': 'Stop-motion clock',
    'lab.stop-motion.on': 'Stepped',
    'lab.stop-motion.off': 'Smooth',
    'lab.curve': 'Bend curve power',
    'lab.lean': 'Resting lean spread',
    'lab.yaw': 'Billboard yaw jitter',
    'lab.push': 'Push-away strength',
    'lab.push-r': 'Push radius scale',
    'lab.uvc': 'Flatten compensation',
    'lab.quality': 'Blade budget',
    'lab.toon-steps': 'Light steps',
    'lab.toon-soft': 'Transition band',
    'lab.sun-el': 'Sun elevation',
    'lab.ambient': 'Sky probe gain',
    'lab.cloud-cover': 'Cloud cover',
    'lab.cloud-dark': 'Shadow depth',
    'lab.cloud-speed': 'Cloud drift',
    'lab.fog': 'Fog density',
    'lab.fog-start': 'Fog onset',
    'lab.pixel': 'Pixel grid',
    'lab.pixel.on': 'Low-res',
    'lab.pixel.off': 'Native',
    'lab.palette': 'Palette steps',
    'lab.dither': 'Dither',
    'lab.exposure': 'Exposure',
    'lab.sat': 'Saturation',
    'lab.vig': 'Vignette',

    'credits.title': 'Credits and sources',
    'credits.back': 'Back',
    'credits.h.own': 'Written for this project',
    'credits.h.libs': 'Libraries and typefaces',
    'credits.h.ref': 'Technique reference',
    'credits.own.shaders': '<b>Grass, ground, foliage, sky and composite shaders</b> — GLSL written for this build.',
    'credits.own.hdri': '<b>Sky HDRI</b> — a stylised equirectangular radiance map generated at load time in <code>src/gfx/sky.js</code>: banded altitude gradient, sun disc and halo, three cloud decks. A photographic HDRI can be substituted, see the README.',
    'credits.own.atlases': '<b>Pixel-art atlases</b> — blade sprites, ground masks, crate faces and the goal ring are authored texel by texel in <code>src/gfx/textures.js</code>.',
    'credits.own.models': '<b>Trees, shrubs, stones, fence, signpost, bench, crates, whale</b> — generated from a low-poly kit in <code>src/world/geoBuilder.js</code>. No mesh is downloaded.',
    'credits.own.levels': '<b>Ten puzzle boards</b> — original designs, each verified solvable by <code>tools/verify-levels.mjs</code>.',
    'credits.libs.three': '<b>three.js r180</b> — MIT, via jsDelivr.',
    'credits.libs.fonts': '<b>Pixelify Sans</b> and <b>Karla</b> — SIL Open Font License, via Google Fonts.',
    'credits.ref.grass': "The shader feature set follows Dylearn's 3D pixel-art grass breakdown for Godot 4.3 — stop-motion wind, world-space bend, actor push, Y billboard, flatten compensation — ported to WebGL. Links are in the README.",
    'credits.ref.levels': 'The puzzle design idiom — compact boards teaching one idea at a time — follows the Microban tradition established by David W. Skinner.',

  },

  zh: {
    'doc.title': 'Tallgrass — 3D 像素草地与十道推箱关卡',
    'doc.description': '实例化草地着色器，带定格风、云影与风格化 HDRI 天空；一头低多边形鲸鱼在修剪过的园圃上推动十道推箱关卡。',

    'lang.label': '语言',

    'boot.eyebrow': '3D 像素画 · 实例化草地',
    'boot.note': '每一片草叶都是一个实例化面片，风以每秒 12 帧运行。',
    'boot.step.start': '正在启动',
    'boot.step.sky': '生成天空',
    'boot.step.ground': '抬起地形',
    'boot.step.trees': '种下树木',
    'boot.step.stones': '摆放石块',
    'boot.step.meadow': '播撒草地',
    'boot.step.crate': '雕刻木箱',
    'boot.step.ready': '就绪',
    'boot.step.error': '场景构建失败，详细信息在浏览器控制台。',

    'title.eyebrow': '第一阶段：草地着色器  ·  第二阶段：十道推箱关卡',
    'title.lede': '数万片看板草叶在一次绘制调用里完成，随每秒 12 帧的定格风摆动。同一片草地上，一头鲸鱼在修剪过的园圃里推动木箱。',
    'title.cornerNote': '路上的木箱循环滚动。把鼠标移过草地，草叶会向两侧分开。',
    'menu.label': '主菜单',
    'menu.play': '开始',
    'menu.play.meta': '十道关卡',
    'menu.levels': '关卡列表',
    'menu.levels.meta': '任选一关',
    'menu.lab': '着色器实验室',
    'menu.lab.meta': '实时调节',
    'menu.credits': '制作与来源',
    'menu.credits.meta': '素材与出处',

    'hud.index': '第 {n} 关 / 共 {total} 关',
    'hud.seated': '就位木箱',
    'hud.pushes': '推动次数',
    'hud.moves': '步数',
    'hud.key.arrows': '方向键',
    'hud.key.move': '移动',
    'hud.key.undo': '撤销',
    'hud.key.restart': '重来',
    'hud.key.title': '标题',
    'hud.btn.undo': '撤销',
    'hud.btn.restart': '重来',
    'hud.btn.levels': '关卡',
    'hud.btn.title': '标题',
    'hud.lock': '有一个木箱被顶进了角落。按 Z 撤回这次推动。',
    'hud.dir.up': '向上移动',
    'hud.dir.down': '向下移动',
    'hud.dir.left': '向左移动',
    'hud.dir.right': '向右移动',

    'solved.eyebrow': '园圃完成',
    'solved.body': '每个木箱都落在了自己的标记上。',
    'solved.pushes': '推动次数',
    'solved.moves': '步数',
    'solved.next': '下一关',
    'solved.nextLast': '返回标题',
    'solved.replay': '再来一次',
    'solved.levels': '关卡列表',

    'levels.title': '关卡列表',
    'levels.note': '十道原创关卡，沿用紧凑而每关只教一件事的路数。推动次数取自随项目附带的求解器找到的最短解。',
    'levels.back': '返回',
    'levels.card': '第 {n} 关',
    'levels.pushes': '{n} 次推动',
    'levels.unrated': '未评级',

    'lab.title': '着色器实验室',
    'lab.note': '每个控件都直接写入草地、地面、树木与道具着色器共用的 uniform 区块。',
    'lab.close': '关闭',
    'lab.stat.blades': '草叶数',
    'lab.stat.calls': '绘制调用',
    'lab.stat.tris': '三角面',
    'lab.stat.res': '渲染分辨率',
    'lab.stat.fps': '帧率',

    'lab.group.wind': '风',
    'lab.group.blades': '草叶',
    'lab.group.light': '光照与天空',
    'lab.group.clouds': '云与雾',
    'lab.group.frame': '画面',

    'lab.wind-strength': '弯折强度',
    'lab.wind-speed': '漂移速度',
    'lab.wind-scale': '噪波尺度',
    'lab.wind-gust': '阵风包络',
    'lab.stop-fps': '定格帧率',
    'lab.stop-motion': '定格时钟',
    'lab.stop-motion.on': '分帧',
    'lab.stop-motion.off': '连续',
    'lab.curve': '弯折曲率',
    'lab.lean': '静止倾斜幅度',
    'lab.yaw': '看板偏摆抖动',
    'lab.push': '推开强度',
    'lab.push-r': '推开半径',
    'lab.uvc': '压扁补偿',
    'lab.quality': '草叶预算',
    'lab.toon-steps': '光照阶数',
    'lab.toon-soft': '过渡带宽度',
    'lab.sun-el': '太阳高度',
    'lab.ambient': '天空探针增益',
    'lab.cloud-cover': '云量',
    'lab.cloud-dark': '阴影深度',
    'lab.cloud-speed': '云层漂移',
    'lab.fog': '雾浓度',
    'lab.fog-start': '雾起始距离',
    'lab.pixel': '像素网格',
    'lab.pixel.on': '低分辨率',
    'lab.pixel.off': '原生',
    'lab.palette': '调色阶数',
    'lab.dither': '抖动',
    'lab.exposure': '曝光',
    'lab.sat': '饱和度',
    'lab.vig': '暗角',

    'credits.title': '制作与来源',
    'credits.back': '返回',
    'credits.h.own': '为本项目编写',
    'credits.h.libs': '库与字体',
    'credits.h.ref': '技术参考',
    'credits.own.shaders': '<b>草地、地面、树木、天空与合成着色器</b> — 为本项目编写的 GLSL。',
    'credits.own.hdri': '<b>天空 HDRI</b> — 载入时由 <code>src/gfx/sky.js</code> 生成的风格化等距柱状辐照图：分阶高度渐变、太阳圆盘与光晕、三层云。也可换用摄影 HDRI，见 README。',
    'credits.own.atlases': '<b>像素图集</b> — 草叶精灵、地面遮罩、木箱贴面与目标环，都在 <code>src/gfx/textures.js</code> 中逐像素写出。',
    'credits.own.models': '<b>树木、灌木、石块、栅栏、路牌、长椅、木箱、鲸鱼</b> — 由 <code>src/world/geoBuilder.js</code> 的低多边形工具集生成，未下载任何模型文件。',
    'credits.own.levels': '<b>十道推箱关卡</b> — 原创设计，每一关的可解性都由 <code>tools/verify-levels.mjs</code> 验证。',
    'credits.libs.three': '<b>three.js r180</b> — MIT 许可，经 jsDelivr 引入。',
    'credits.libs.fonts': '<b>Pixelify Sans</b> 与 <b>Karla</b> — SIL 开放字体许可，经 Google Fonts 引入。',
    'credits.ref.grass': '着色器的功能清单沿用 Dylearn 在 Godot 4.3 中的 3D 像素草地拆解 — 定格风、世界空间弯折、角色推开、Y 轴看板、压扁补偿 — 并移植到 WebGL。链接见 README。',
    'credits.ref.levels': '关卡设计路数 — 紧凑棋盘、每关只教一件事 — 沿用 David W. Skinner 所确立的 Microban 传统。',

  },
};

/** Chinese text for the ten boards, keyed by level id. */
const LEVEL_TEXT = {
  zh: {
    'grove-01': { name: '初垄', concept: '基础推动', hint: '一个木箱，一个标记。走到木箱后面，把它推上标记。' },
    'grove-02': { name: '角落花床', concept: '角落标记', hint: '标记在角落。先把木箱推到左墙，再顺着墙往上推到标记。' },
    'grove-03': { name: '绕过树桩', concept: '转弯', hint: '树桩挡住了直线。把木箱推过树桩，从远侧往上，再沿顶行推回来。' },
    'grove-04': { name: '两畦', concept: '两个木箱', hint: '两个木箱，两个标记。让每个木箱去它同一侧的标记。' },
    'grove-05': { name: '两道闸口', concept: '走廊通道', hint: '篱墙上的每道闸口只有一格宽。把木箱对准闸口，再直着推过去。' },
    'grove-06': { name: '绕远路', concept: '避免贴墙锁死', hint: '贴着篱墙的木箱只能顺着这道墙滑动。把它往右、往下，再沿低行绕过小屋推回来。' },
    'grove-07': { name: '先送远标记', concept: '推动顺序', hint: '两个木箱共用一条通道和一列。先送去上方标记的那一个。' },
    'grove-08': { name: '堆肥间', concept: '窄间调位', hint: '堆肥间宽三格，口只有一格。把第二个木箱提前一行转向，给自己留下站脚的格子。' },
    'grove-09': { name: '一列三箱', concept: '三个木箱', hint: '三个木箱要从同一个缺口离开院子。先取最下面那个，再依次往上。' },
    'grove-10': { name: '整块园圃', concept: '窄地排序', hint: '四个木箱沿着同两列上行。先填最左边的标记，把角落的标记留到最后。' },
  },
};

let locale = DEFAULT_LOCALE;
const listeners = new Set();

/** A stored choice wins; otherwise the interface opens in Chinese. */
function detect() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LOCALES.includes(stored)) return stored;
  } catch (err) {
    // A blocked or absent localStorage leaves the default in place.
  }
  return DEFAULT_LOCALE;
}

export function getLocale() {
  return locale;
}

/** @param {(locale:string)=>void} fn */
export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLocale(next, { silent = false } = {}) {
  if (!LOCALES.includes(next)) return locale;
  locale = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (err) {
    // a read-only storage is not a reason to refuse the switch
  }
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  document.title = t('doc.title');
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', t('doc.description'));
  applyTo(document);
  if (!silent) for (const fn of listeners) fn(locale);
  return locale;
}

export function initLocale() {
  return setLocale(detect(), { silent: true });
}

/**
 * @param {string} key
 * @param {Record<string, string|number>} [vars] replaces {name} placeholders
 */
export function t(key, vars) {
  const table = DICT[locale] || DICT.en;
  let s = table[key];
  if (s === undefined) s = DICT.en[key];
  if (s === undefined) return key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, name) => (vars[name] !== undefined ? String(vars[name]) : m));
}

/**
 * Localised name, hint and concept for a level. English comes from the puzzle
 * data itself, so the two never drift apart.
 * @param {{id:string,name:string,hint:string,concept:string}} level
 */
export function levelText(level) {
  const table = LEVEL_TEXT[locale];
  const override = table && table[level.id];
  return {
    name: (override && override.name) || level.name,
    hint: (override && override.hint) || level.hint,
    concept: (override && override.concept) || level.concept,
  };
}

/** Fills every [data-i18n] and [data-i18n-html] node under root. */
export function applyTo(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    el.innerHTML = t(el.dataset.i18nHtml);
  }
  for (const el of root.querySelectorAll('[data-i18n-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  }
  for (const el of root.querySelectorAll('[data-lang]')) {
    el.setAttribute('aria-pressed', String(el.dataset.lang === locale));
  }
}

/** Every key in the dictionary, for the build audit. */
export function localeKeys(which) {
  return Object.keys(DICT[which] || {});
}

export const LEVEL_IDS_WITH_TEXT = Object.keys(LEVEL_TEXT.zh);
