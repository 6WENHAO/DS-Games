/* =====================================================================
 * EventBus — 极简发布订阅（模块解耦）
 * ===================================================================== */

export class EventBus {
  constructor() { this.map = new Map(); }

  on(type, fn) {
    let arr = this.map.get(type);
    if (!arr) { arr = []; this.map.set(type, arr); }
    arr.push(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const un = this.on(type, (...a) => { un(); fn(...a); });
    return un;
  }

  off(type, fn) {
    const arr = this.map.get(type);
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }

  emit(type, ...args) {
    const arr = this.map.get(type);
    if (!arr || arr.length === 0) return;
    // 复制一份，允许回调中修改监听列表
    for (const fn of arr.slice()) {
      try { fn(...args); }
      catch (e) { console.error(`[EventBus] "${type}" 监听器异常:`, e); }
    }
  }

  clear(type) {
    if (type) this.map.delete(type); else this.map.clear();
  }
}

/** 全局事件总线（游戏内跨模块通信） */
export const bus = new EventBus();

/** 常用事件名，集中管理避免拼写错误 */
export const EV = Object.freeze({
  BLOCK_CHANGED: 'block:changed',
  BLOCK_BROKEN: 'block:broken',
  BLOCK_PLACED: 'block:placed',
  CHUNK_READY: 'chunk:ready',
  CHUNK_UNLOADED: 'chunk:unloaded',
  PLAYER_DAMAGE: 'player:damage',
  PLAYER_DIED: 'player:died',
  PLAYER_RESPAWN: 'player:respawn',
  PLAYER_MOVE: 'player:move',
  ITEM_PICKUP: 'item:pickup',
  HOTBAR_CHANGED: 'hotbar:changed',
  INVENTORY_CHANGED: 'inventory:changed',
  GAMEMODE_CHANGED: 'gamemode:changed',
  CHAT: 'chat:message',
  TOAST: 'ui:toast',
  SETTINGS_CHANGED: 'settings:changed',
  TIME_CHANGED: 'world:time',
  WEATHER_CHANGED: 'world:weather',
  SOUND: 'sound:play',
});
