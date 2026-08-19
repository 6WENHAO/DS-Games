export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function setClass(node: HTMLElement, cls: string, on: boolean): void {
  node.classList.toggle(cls, on);
}

export const ELEMENT_COLORS: Record<string, string> = {
  physical: '#e9e0d1',
  fire: '#ff6a3c',
  ice: '#7fd4f0',
  lightning: '#ffe04b',
  earth: '#8ddc7f',
  light: '#fff3cf',
  dark: '#b483ff',
};

export const ELEMENT_NAMES: Record<string, string> = {
  physical: '物理', fire: '火', ice: '冰', lightning: '雷', earth: '土', light: '光', dark: '暗',
};

export const TARGET_NAMES: Record<string, string> = {
  enemy: '单体', enemyAll: '敌方全体', ally: '单个友方', allyAll: '全体友方',
  deadAlly: '倒下的友方', self: '自身', field: '全场光环',
};

export const STANCE_NAMES: Record<string, string> = {
  none: '无姿态', offensive: '攻', defensive: '守', virtuose: '高手',
};
