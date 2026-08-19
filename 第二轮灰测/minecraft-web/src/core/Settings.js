/* =====================================================================
 * Settings — 游戏选项（持久化到 localStorage，驱动选项界面）
 * ===================================================================== */
import { STORAGE } from './Constants.js';
import { bus, EV } from './EventBus.js';

/** 选项定义：既是默认值来源，也是选项界面的元数据 */
export const SCHEMA = [
  { key: 'renderDistance', label: '渲染距离', type: 'range', min: 2, max: 16, step: 1, def: 8,
    fmt: v => `${v} 区块`, desc: '越远越吃性能' },
  { key: 'fov', label: '视野 (FOV)', type: 'range', min: 40, max: 120, step: 1, def: 75, fmt: v => `${v}°` },
  { key: 'sensitivity', label: '鼠标灵敏度', type: 'range', min: 5, max: 200, step: 1, def: 100, fmt: v => `${v}%` },
  { key: 'maxFps', label: '最大帧率', type: 'range', min: 30, max: 260, step: 10, def: 260,
    fmt: v => (v >= 260 ? '不限制' : `${v} FPS`) },
  { key: 'guiScale', label: '界面缩放', type: 'range', min: 1, max: 3, step: 0.5, def: 1.5, fmt: v => `×${v}` },
  { key: 'brightness', label: '亮度', type: 'range', min: 0, max: 100, step: 1, def: 30, fmt: v => `${v}%` },

  { key: 'smoothLighting', label: '平滑光照', type: 'toggle', def: true, desc: '顶点插值 + 环境光遮蔽' },
  { key: 'fancyLeaves', label: '精细树叶', type: 'toggle', def: true, desc: '树叶透视，可见内部' },
  { key: 'fog', label: '距离雾', type: 'toggle', def: true },
  { key: 'clouds', label: '云', type: 'toggle', def: true },
  { key: 'particles', label: '粒子效果', type: 'toggle', def: true },
  { key: 'viewBobbing', label: '视角摇晃', type: 'toggle', def: true },
  { key: 'showHand', label: '显示手持物品', type: 'toggle', def: true },
  { key: 'entityShadows', label: '实体阴影', type: 'toggle', def: true },
  { key: 'weather', label: '天气', type: 'toggle', def: true },
  { key: 'mobs', label: '生成生物', type: 'toggle', def: true },
  { key: 'autoSave', label: '自动存档', type: 'toggle', def: true, desc: '每 30 秒保存到浏览器' },
  { key: 'invertY', label: '反转 Y 轴', type: 'toggle', def: false },
  { key: 'sound', label: '音效', type: 'toggle', def: true },
  { key: 'volume', label: '音量', type: 'range', min: 0, max: 100, step: 5, def: 60, fmt: v => `${v}%` },
  { key: 'music', label: '环境音乐', type: 'toggle', def: false },
  { key: 'resolutionScale', label: '渲染分辨率', type: 'range', min: 50, max: 100, step: 5, def: 100,
    fmt: v => `${v}%`, desc: '降低可显著提升帧率' },
  { key: 'chunkBudget', label: '每帧区块预算', type: 'range', min: 2, max: 20, step: 1, def: 10,
    fmt: v => `${v} ms`, desc: '生成/建网格的时间上限' },
];

const DEFAULTS = Object.fromEntries(SCHEMA.map(s => [s.key, s.def]));

class SettingsStore {
  constructor() {
    this.values = { ...DEFAULTS };
    this.load();
  }

  get(key) { return this.values[key]; }

  set(key, value) {
    if (this.values[key] === value) return;
    this.values[key] = value;
    this.save();
    bus.emit(EV.SETTINGS_CHANGED, key, value);
  }

  toggle(key) { this.set(key, !this.values[key]); return this.values[key]; }

  reset() {
    this.values = { ...DEFAULTS };
    this.save();
    bus.emit(EV.SETTINGS_CHANGED, '*', null);
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE.SETTINGS);
      if (!raw) return;
      const obj = JSON.parse(raw);
      for (const k of Object.keys(DEFAULTS)) {
        if (obj[k] !== undefined) this.values[k] = obj[k];
      }
    } catch (e) { console.warn('[Settings] 读取失败', e); }
  }

  save() {
    try { localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(this.values)); }
    catch (e) { /* 隐私模式忽略 */ }
  }

  /** 便捷派生值 */
  get sensitivityScalar() { return this.values.sensitivity / 100 * 0.0022; }
  get volumeScalar() { return this.values.sound ? this.values.volume / 100 : 0; }
}

export const settings = new SettingsStore();
export default settings;
