/**
 * ui/i18n.js
 * ------------------------------------------------------------------
 * Interface translation.
 *
 * Two separate concerns live here:
 *
 *   `t(key, params)`   short interface strings (menus, buttons, chat)
 *   `blockName(name)` / `itemName(name)`
 *                      display names for the ~430 registry entries
 *
 * Registry entries keep their canonical English `name` (used by commands,
 * recipes and save files); only the *displayed* text is translated, so
 * `/give oak_planks` keeps working in any language.
 *
 * The locale is auto-detected from the browser and can be overridden in
 * the settings screen. Any missing key falls back to English rather than
 * showing a raw key, so a partial translation degrades gracefully.
 */

import {
  NAMES_ZH, BIOME_NAMES_ZH, MOB_NAMES_ZH, WEATHER_NAMES_ZH,
} from './names-zh.js';

/** Supported locales, in the order the settings screen cycles them. */
export const LOCALES = ['zh-CN', 'en'];

/** Human-readable locale names, shown in their own language. */
export const LOCALE_NAMES = { 'zh-CN': '简体中文', en: 'English' };

/* ------------------------------------------------------------------ */
/* interface strings                                                  */
/* ------------------------------------------------------------------ */

const EN = {
  // --- title screen ---
  'title.subtitle': 'a faithful browser voxel sandbox',
  'title.newWorld': 'Create New World',
  'title.continue': 'Continue Saved World',
  'title.noSave': 'No Saved World',
  'title.worldType': 'World Type: {type}',
  'title.seed': 'Seed: {seed}',
  'title.seedRandom': 'random',
  'title.settings': 'Settings',
  'title.hint': 'WASD move - Space jump - Mouse look - E inventory - F3 debug - F11 fullscreen',

  // --- world types ---
  'worldType.default': 'Default',
  'worldType.amplified': 'Amplified',
  'worldType.flat': 'Superflat',
  'worldType.islands': 'Islands',

  // --- pause menu ---
  'pause.title': 'Game Paused',
  'pause.resume': 'Back to Game',
  'pause.settings': 'Settings',
  'pause.save': 'Save World',
  'pause.mode': 'Game Mode: {mode}',
  'pause.quit': 'Quit to Title',

  // --- game modes ---
  'mode.survival': 'Survival',
  'mode.creative': 'Creative',
  'mode.spectator': 'Spectator',

  // --- settings ---
  'settings.title': 'Settings',
  'settings.done': 'Done',
  'settings.renderDistance': 'Render Distance',
  'settings.chunks': '{n} chunks',
  'settings.fov': 'Field of View',
  'settings.sensitivity': 'Mouse Sensitivity',
  'settings.brightness': 'Brightness',
  'settings.guiScale': 'GUI Scale',
  'settings.guiAuto': 'Auto',
  'settings.volume': 'Volume',
  'settings.clouds': 'Clouds',
  'settings.viewBobbing': 'View Bobbing',
  'settings.showFps': 'Show FPS',
  'settings.language': 'Language',
  'settings.on': 'ON',
  'settings.off': 'OFF',

  // --- containers ---
  'gui.crafting': 'Crafting',
  'gui.inventory': 'Inventory',
  'gui.creative': 'Creative Inventory',
  'gui.creativeCategory': 'Creative - {category}',
  'gui.creativeHint': 'scroll to browse - click to take - E to close',
  'gui.all': 'all',

  // --- item categories ---
  'category.building': 'Building',
  'category.decoration': 'Decoration',
  'category.redstone': 'Redstone',
  'category.transport': 'Transport',
  'category.food': 'Food',
  'category.tools': 'Tools',
  'category.combat': 'Combat',
  'category.materials': 'Materials',

  // --- death ---
  'death.title': 'You Died!',
  'death.score': 'Score: {score}',
  'death.respawn': 'Respawn',

  // --- chat / commands ---
  'chat.unknownCommand': 'Unknown command "{name}". Try /help',
  'chat.commandFailed': 'Command failed: {error}',
  'chat.commands': 'Commands:',
  'chat.saved': 'World saved',
  'chat.saveFailed': 'Save failed',
  'chat.generating': 'Generating world (seed {seed}, type {type})',
  'chat.loaded': 'Loaded world ({n} modified chunks)',
  'chat.noSave': 'No saved world found',
  'chat.modeSet': 'Game mode set to {mode}',
  'chat.unknownMode': 'Unknown mode "{mode}"',
  'chat.timeSet': 'Time set to {value}',
  'chat.timeAdded': 'Time advanced by {value}',
  'chat.unknownTime': 'Unknown time "{value}"',
  'chat.daylightOn': 'Daylight cycle resumed',
  'chat.daylightOff': 'Daylight cycle frozen',
  'chat.teleported': 'Teleported to {x}, {y}, {z}',
  'chat.gave': 'Gave {n} x {item}',
  'chat.gavePartial': 'Gave {n} x {item} ({left} did not fit)',
  'chat.unknownItem': 'Unknown item "{name}"',
  'chat.unknownBlock': 'Unknown block "{name}"',
  'chat.cleared': 'Inventory cleared',
  'chat.seedIs': 'Seed: {seed} (type: {type})',
  'chat.ouch': 'Ouch.',
  'chat.healed': 'Healed',
  'chat.weatherSet': 'Weather set to {kind}',
  'chat.unknownWeather': 'Unknown weather "{kind}"',
  'chat.filled': 'Filled {n} blocks with {block}',
  'chat.fillTooBig': 'Too many blocks ({n}, limit {limit})',
  'chat.fillUsage': 'Usage: /fill x1 y1 z1 x2 y2 z2 block',
  'chat.setBlock': 'Set {x} {y} {z} to {block}',
  'chat.atSpawn': 'Returned to spawn',
  'chat.summoned': 'Summoned {kind}',
  'chat.unknownMob': 'Unknown mob "{kind}"',
  'chat.rules': 'Rules: {list}',
  'chat.unknownRule': 'Unknown rule "{name}"',
  'chat.fullscreenUnsupported': 'Fullscreen is not supported by this browser.',
  'chat.fullscreenBlocked': 'The browser blocked fullscreen. Try clicking the page first.',
  'chat.fullscreenFailed': 'Fullscreen failed: {error}',
  'chat.screenshotSaved': 'Screenshot saved as {name}',
  'chat.screenshotFailed': 'Screenshot failed: {error}',
  'chat.internalError': 'Internal error: {error}',

  // --- command descriptions ---
  'cmd.help': 'list commands',
  'cmd.gamemode': 'change game mode',
  'cmd.time': 'change the time of day',
  'cmd.daylight': 'freeze or resume the day cycle',
  'cmd.tp': 'teleport',
  'cmd.give': 'add an item to the inventory',
  'cmd.clear': 'empty the inventory',
  'cmd.seed': 'show the world seed',
  'cmd.kill': 'die',
  'cmd.heal': 'restore health and hunger',
  'cmd.weather': 'change the weather',
  'cmd.fill': 'fill a region with a block',
  'cmd.setblock': 'place a single block',
  'cmd.spawn': 'return to the world spawn',
  'cmd.save': 'save the world',
  'cmd.summon': 'spawn a mob in front of you',
  'cmd.gamerule': 'inspect or set a game rule',

  // --- debug overlay ---
  'debug.targeted': 'Targeted Block',
  'debug.none': '(none)',
  'debug.facing': 'Facing',
  'debug.biome': 'Biome',
  'debug.time': 'Time',
  'debug.day': 'day',
  'debug.mode': 'Mode',
  'debug.flying': 'flying',
  'debug.airborne': 'airborne',
  'debug.standingOn': 'Standing on',
  'debug.entities': 'entities',
  'debug.particles': 'particles',
};

const ZH = {
  // --- title screen ---
  'title.subtitle': '浏览器里的体素沙盒',
  'title.newWorld': '创建新世界',
  'title.continue': '继续已保存的世界',
  'title.noSave': '没有存档',
  'title.worldType': '世界类型：{type}',
  'title.seed': '种子：{seed}',
  'title.seedRandom': '随机',
  'title.settings': '设置',
  'title.hint': 'WASD 移动 - 空格跳跃 - 鼠标转向 - E 背包 - F3 调试 - F11 全屏',

  // --- world types ---
  'worldType.default': '默认',
  'worldType.amplified': '放大化',
  'worldType.flat': '超平坦',
  'worldType.islands': '群岛',

  // --- pause menu ---
  'pause.title': '游戏已暂停',
  'pause.resume': '返回游戏',
  'pause.settings': '设置',
  'pause.save': '保存世界',
  'pause.mode': '游戏模式：{mode}',
  'pause.quit': '返回标题界面',

  // --- game modes ---
  'mode.survival': '生存',
  'mode.creative': '创造',
  'mode.spectator': '旁观',

  // --- settings ---
  'settings.title': '设置',
  'settings.done': '完成',
  'settings.renderDistance': '渲染距离',
  'settings.chunks': '{n} 区块',
  'settings.fov': '视野角度',
  'settings.sensitivity': '鼠标灵敏度',
  'settings.brightness': '亮度',
  'settings.guiScale': '界面缩放',
  'settings.guiAuto': '自动',
  'settings.volume': '音量',
  'settings.clouds': '云',
  'settings.viewBobbing': '视角摇晃',
  'settings.showFps': '显示帧率',
  'settings.language': '语言',
  'settings.on': '开',
  'settings.off': '关',

  // --- containers ---
  'gui.crafting': '合成',
  'gui.inventory': '物品栏',
  'gui.creative': '创造模式物品栏',
  'gui.creativeCategory': '创造 - {category}',
  'gui.creativeHint': '滚轮浏览 - 点击取出 - E 关闭',
  'gui.all': '全部',

  // --- item categories ---
  'category.building': '建筑方块',
  'category.decoration': '装饰方块',
  'category.redstone': '红石',
  'category.transport': '交通',
  'category.food': '食物',
  'category.tools': '工具',
  'category.combat': '战斗',
  'category.materials': '材料',

  // --- death ---
  'death.title': '你死了！',
  'death.score': '得分：{score}',
  'death.respawn': '重生',

  // --- chat / commands ---
  'chat.unknownCommand': '未知命令“{name}”。试试 /help',
  'chat.commandFailed': '命令执行失败：{error}',
  'chat.commands': '命令列表：',
  'chat.saved': '世界已保存',
  'chat.saveFailed': '保存失败',
  'chat.generating': '正在生成世界（种子 {seed}，类型 {type}）',
  'chat.loaded': '已载入世界（{n} 个已修改区块）',
  'chat.noSave': '找不到存档',
  'chat.modeSet': '游戏模式已设为 {mode}',
  'chat.unknownMode': '未知模式“{mode}”',
  'chat.timeSet': '时间已设为 {value}',
  'chat.timeAdded': '时间前进了 {value}',
  'chat.unknownTime': '未知时间“{value}”',
  'chat.daylightOn': '昼夜循环已恢复',
  'chat.daylightOff': '昼夜循环已冻结',
  'chat.teleported': '已传送到 {x}, {y}, {z}',
  'chat.gave': '给予了 {n} 个{item}',
  'chat.gavePartial': '给予了 {n} 个{item}（{left} 个放不下）',
  'chat.unknownItem': '未知物品“{name}”',
  'chat.unknownBlock': '未知方块“{name}”',
  'chat.cleared': '物品栏已清空',
  'chat.seedIs': '种子：{seed}（类型：{type}）',
  'chat.ouch': '疼。',
  'chat.healed': '已恢复',
  'chat.weatherSet': '天气已设为 {kind}',
  'chat.unknownWeather': '未知天气“{kind}”',
  'chat.filled': '已用{block}填充 {n} 个方块',
  'chat.fillTooBig': '方块太多（{n}，上限 {limit}）',
  'chat.fillUsage': '用法：/fill x1 y1 z1 x2 y2 z2 方块',
  'chat.setBlock': '已把 {x} {y} {z} 设为{block}',
  'chat.atSpawn': '已回到出生点',
  'chat.summoned': '已生成{kind}',
  'chat.unknownMob': '未知生物“{kind}”',
  'chat.rules': '游戏规则：{list}',
  'chat.unknownRule': '未知规则“{name}”',
  'chat.fullscreenUnsupported': '此浏览器不支持全屏。',
  'chat.fullscreenBlocked': '浏览器拦截了全屏请求，请先点击页面再试。',
  'chat.fullscreenFailed': '全屏失败：{error}',
  'chat.screenshotSaved': '截图已保存为 {name}',
  'chat.screenshotFailed': '截图失败：{error}',
  'chat.internalError': '内部错误：{error}',

  // --- command descriptions ---
  'cmd.help': '列出所有命令',
  'cmd.gamemode': '切换游戏模式',
  'cmd.time': '修改时间',
  'cmd.daylight': '冻结或恢复昼夜循环',
  'cmd.tp': '传送',
  'cmd.give': '获得物品',
  'cmd.clear': '清空物品栏',
  'cmd.seed': '显示世界种子',
  'cmd.kill': '自杀',
  'cmd.heal': '恢复生命与饱食度',
  'cmd.weather': '修改天气',
  'cmd.fill': '用方块填充一个区域',
  'cmd.setblock': '放置单个方块',
  'cmd.spawn': '回到世界出生点',
  'cmd.save': '保存世界',
  'cmd.summon': '在面前生成生物',
  'cmd.gamerule': '查看或设置游戏规则',

  // --- debug overlay ---
  'debug.targeted': '瞄准的方块',
  'debug.none': '（无）',
  'debug.facing': '朝向',
  'debug.biome': '生物群系',
  'debug.time': '时间',
  'debug.day': '第',
  'debug.mode': '模式',
  'debug.flying': '飞行中',
  'debug.airborne': '空中',
  'debug.standingOn': '脚下',
  'debug.entities': '实体',
  'debug.particles': '粒子',
};

const TABLES = { en: EN, 'zh-CN': ZH };

/* ------------------------------------------------------------------ */
/* locale state                                                       */
/* ------------------------------------------------------------------ */

/** Picks a starting locale from the browser's language list. */
function detectLocale() {
  const candidates = globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? 'en'];
  for (const tag of candidates) {
    if (!tag) continue;
    const lower = String(tag).toLowerCase();
    if (lower.startsWith('zh')) return 'zh-CN';
    if (lower.startsWith('en')) return 'en';
  }
  return 'zh-CN';
}

let locale = detectLocale();

export function getLocale() { return locale; }

/** @returns {boolean} whether the locale changed. */
export function setLocale(value) {
  if (!LOCALES.includes(value) || value === locale) return false;
  locale = value;
  return true;
}

/** Cycles to the next locale, for the settings button. */
export function nextLocale() {
  const index = LOCALES.indexOf(locale);
  locale = LOCALES[(index + 1) % LOCALES.length];
  return locale;
}

/**
 * Translates a key, substituting `{name}` placeholders.
 * Falls back to English, then to the key itself.
 */
export function t(key, params = null) {
  const table = TABLES[locale] ?? EN;
  let text = table[key] ?? EN[key] ?? key;
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (m, name) => (
      params[name] === undefined ? m : String(params[name])
    ));
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* registry display names                                             */
/* ------------------------------------------------------------------ */

/**
 * Title-cases a registry name as the English fallback:
 * `oak_planks` -> `Oak Planks`.
 */
function englishName(name) {
  return String(name).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Display name for a block or item registry key.
 *
 * The registry key itself is never translated - only what the player sees -
 * so commands, recipes and saves stay locale-independent.
 * @param {string} name registry name, e.g. 'oak_planks'
 * @param {string} [fallback] the registry's own displayName, if it has one
 */
export function entryName(name, fallback = null) {
  if (locale === 'zh-CN') {
    const zh = NAMES_ZH[name];
    if (zh) return zh;
  }
  return fallback ?? englishName(name);
}

/** Display name for a biome. */
export function biomeName(name, fallback = null) {
  if (locale === 'zh-CN' && BIOME_NAMES_ZH[name]) return BIOME_NAMES_ZH[name];
  return fallback ?? englishName(name);
}

/** Display name for a mob kind. */
export function mobName(kind) {
  if (locale === 'zh-CN' && MOB_NAMES_ZH[kind]) return MOB_NAMES_ZH[kind];
  return englishName(kind);
}

/** Display name for a weather kind. */
export function weatherName(kind) {
  if (locale === 'zh-CN' && WEATHER_NAMES_ZH[kind]) return WEATHER_NAMES_ZH[kind];
  return englishName(kind);
}

/** Localised game-mode label. */
export function modeName(mode) {
  return t(`mode.${mode}`);
}

/** Localised world-type label. */
export function worldTypeName(type) {
  return t(`worldType.${type}`);
}

/** Localised item-category label. */
export function categoryName(category) {
  return t(`category.${category}`);
}
