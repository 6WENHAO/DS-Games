// ============================================================================
//  props.js —— 程序化生成精灵物件（带 alpha）
//  千禧年中国家庭 / 楼道 / 大堂的"道具组"
//  物件底边 = 世界坐标里的落地面；悬挂物（灯泡）从顶边开始画
// ============================================================================

import { pix, makeRng, mix, scaleColor, fbm } from './pixels.js';
import { P } from './palette.js';

const makers = new Map();
const dynamics = new Map();
const cache = new Map();

function def(name, w, h, fn, dyn) {
  makers.set(name, { w, h, fn });
  if (dyn) dynamics.set(name, dyn);
}

export function prop(name) {
  if (cache.has(name)) return cache.get(name);
  const m = makers.get(name);
  if (!m) {
    const p = pix(16, 16).fill('#ff00ff');
    cache.set(name, p);
    return p;
  }
  const p = pix(m.w, m.h);
  m.fn(p);
  cache.set(name, p);
  return p;
}

export function propNames() { return [...makers.keys()]; }

/** 每帧驱动会动的物件（电视雪花、风扇叶、蚊香烟…） */
export function animateProps(t) {
  for (const [name, fn] of dynamics) {
    if (cache.has(name)) fn(cache.get(name), t);
  }
}

// ---------------------------------------------------------------------------
//  小工具
// ---------------------------------------------------------------------------
function shadowUnder(p, cx, w, h = 3) {
  for (let i = 0; i < h; i++) {
    p.disc(cx, p.h - 1 - i, w * (1 - i / (h + 2)), 1.2, '#000', 0.22 - i * 0.05);
  }
}

function box3d(p, x, y, w, h, face, top, side) {
  p.rect(x, y, w, h, face);
  if (top) p.rect(x, y, w, 2, top);
  if (side) p.rect(x + w - 2, y, 2, h, side);
}

// ===========================================================================
//  一 · 家（中式梦核核心道具）
// ===========================================================================

// 老式彩色电视机（放在大理石贴面电视柜上）—— 屏幕会放雪花
def('tv_crt', 40, 42, (p) => {
  shadowUnder(p, 20, 17);
  // 电视柜（大理石贴面）
  p.rect(4, 30, 32, 10, '#cfc0a4');
  p.marble(4, 30, 32, 10, '#dccdb0', '#a8977a', 11, 0.8);
  p.rect(4, 30, 32, 1, '#f0e6d0', 0.7);
  p.rect(4, 39, 32, 1, '#000', 0.35);
  p.rect(7, 34, 12, 5, '#5f5544');           // 柜门缝/抽屉
  p.rect(21, 34, 12, 5, '#5f5544');
  // 机身（米黄塑料，年久发黄）
  p.rect(6, 4, 28, 26, '#d6cbae');
  p.vgrad(6, 4, 28, 26, '#e2d8bb', '#bcb094');
  p.frame(6, 4, 28, 26, '#8f8570', 1);
  // 屏幕（微凸，四角圆）
  p.rect(9, 7, 18, 15, '#1a1c18');
  p.rect(10, 8, 16, 13, '#0e100d');
  // 控制面板
  p.rect(28, 8, 5, 12, '#c2b898');
  p.disc(30, 11, 1.6, 1.6, '#8f8570');
  p.disc(30, 15, 1.6, 1.6, '#8f8570');
  p.rect(29, 18, 3, 1, '#8f8570');
  p.tiny(8, 24, '29', '#7d7460', 1, 0.8);
  // 商标条
  p.rect(9, 24, 10, 2, '#a89a7a', 0.6);
  // 天线
  p.line(14, 4, 8, -4, '#9a9488', 0.9);
  p.line(24, 4, 32, -6, '#9a9488', 0.9);
}, (p, t) => {
  // 雪花噪点（梦核：它自己就开了）
  const rng = makeRng(Math.floor(t * 24) * 7919 + 13);
  for (let y = 8; y < 21; y++) {
    for (let x = 10; x < 26; x++) {
      const v = rng();
      const band = Math.sin((y + t * 30) * 0.9) * 0.12;
      const l = Math.max(0, Math.min(1, v * 0.75 + band + 0.12));
      p.put(x, y, [l * 205 + 22, l * 208 + 24, l * 190 + 20]);
    }
  }
  // 滚动的横向失真条
  const bandY = 8 + Math.floor(((t * 7) % 1) * 13);
  p.rect(10, bandY, 16, 1, '#e8f2f0', 0.5);
  p.glow(10, 8, 16, 13, 0.75);
});

// 竹壳/铁皮热水瓶（红牡丹图案）—— 千禧年家庭的图腾
def('thermos', 16, 34, (p) => {
  shadowUnder(p, 8, 6);
  p.rect(4, 8, 8, 23, '#d9c48e');
  p.vgrad(4, 8, 8, 23, '#e8d6a4', '#b09c68');
  p.frame(4, 8, 8, 23, '#8f7c4e', 1);
  // 红花腰带
  p.rect(4, 15, 8, 7, '#b8342a');
  p.disc(8, 18, 2.2, 2.2, '#e8c968', 0.9);
  p.disc(7, 17, 1, 1, '#f4e2a8');
  // 提梁 + 塞子
  p.rect(5, 4, 6, 4, '#9a8f74');
  p.rect(6, 2, 4, 3, '#b8342a');
  p.line(4, 6, 2, 12, '#7d7460', 0.9);
  p.line(12, 6, 14, 12, '#7d7460', 0.9);
  p.rect(4, 30, 8, 2, '#7d6a44');
});

// 红色塑料凳（一坐就“咯”一声）
def('stool_red', 20, 20, (p) => {
  shadowUnder(p, 10, 8);
  p.rect(2, 4, 16, 4, '#c0392b');
  p.vgrad(2, 4, 16, 4, '#e0574a', '#9e2b20');
  p.rect(2, 4, 16, 1, '#ef8a7c', 0.7);
  p.rect(4, 8, 3, 10, '#a8291e');
  p.rect(13, 8, 3, 10, '#a8291e');
  p.rect(7, 8, 2, 9, '#8e2218', 0.8);
  p.rect(11, 8, 2, 9, '#8e2218', 0.8);
  p.rect(5, 12, 10, 2, '#9e2b20');
});

// 红木沙发 + 蕾丝盖布
def('sofa', 52, 30, (p) => {
  shadowUnder(p, 26, 22);
  p.wood(2, 10, 48, 18, P.redwood, P.redwoodDark, 21, false, 0.7);
  p.frame(2, 10, 48, 18, P.redwoodDark, 1);
  // 靠背
  p.wood(2, 4, 48, 8, scaleColor(P.redwood, 1.1), P.redwoodDark, 23, true, 0.6);
  p.rect(2, 4, 48, 1, '#a8654a', 0.7);
  // 坐垫（暖棕绒布）
  p.rect(5, 13, 20, 9, '#8a6a4a');
  p.rect(27, 13, 20, 9, '#8a6a4a');
  p.vgrad(5, 13, 20, 9, '#a07d58', '#6f5238');
  p.vgrad(27, 13, 20, 9, '#a07d58', '#6f5238');
  // 蕾丝盖布（靠背上垂下来的白布）
  p.rect(6, 3, 18, 4, P.lace, 0.92);
  for (let x = 6; x < 24; x += 3) p.rect(x, 7, 2, 2, P.lace, 0.8);
  p.rect(28, 3, 18, 4, P.lace, 0.92);
  for (let x = 28; x < 46; x += 3) p.rect(x, 7, 2, 2, P.lace, 0.8);
  // 扶手
  p.wood(0, 8, 5, 20, P.redwood, P.redwoodDark, 25, true, 0.6);
  p.wood(47, 8, 5, 20, P.redwood, P.redwoodDark, 27, true, 0.6);
  p.rect(2, 27, 3, 3, P.redwoodDark);
  p.rect(47, 27, 3, 3, P.redwoodDark);
});

// 折叠圆桌 + 桌布 + 一壶茶
def('table_round', 40, 26, (p) => {
  shadowUnder(p, 20, 17);
  // 桌布（暖黄格子）
  p.disc(20, 8, 18, 5, '#e6d2a8');
  p.rect(3, 8, 34, 13, '#e6d2a8');
  p.vgrad(3, 8, 34, 13, '#f0e0bc', '#c9b48a');
  for (let x = 3; x < 37; x += 6) p.vline(x, 8, 13, '#c08a5a', 0.35);
  for (let y = 9; y < 21; y += 5) p.hline(3, y, 34, '#c08a5a', 0.3);
  // 布下摆的波浪
  for (let x = 3; x < 37; x += 5) p.disc(x + 2, 21, 2.6, 1.6, '#d9c49a');
  // 桌上：茶壶 + 两个杯子
  p.disc(16, 5, 4, 3, '#cfd8d2');
  p.rect(12, 3, 8, 3, '#cfd8d2');
  p.line(20, 3, 23, 5, '#b0bab4', 0.9);
  p.disc(25, 6, 1.8, 1.4, '#e8e2cf');
  p.disc(29, 6, 1.8, 1.4, '#e8e2cf');
  // 腿
  p.rect(8, 21, 3, 5, '#7d6a4a');
  p.rect(29, 21, 3, 5, '#7d6a4a');
});

// 落地电风扇（叶片会转）
def('fan_stand', 26, 46, (p) => {
  shadowUnder(p, 13, 9);
  p.rect(11, 20, 4, 22, '#c2b898');
  p.disc(13, 43, 7, 2.4, '#a89e80');
  p.rect(6, 41, 14, 2, '#8f8570');
  // 网罩
  p.disc(13, 12, 11, 11, '#b0a888', 0.35);
  p.ring(13, 12, 11, 11, '#8f8570', 0.95);
  p.ring(13, 12, 8, 8, '#9a9278', 0.7);
  p.ring(13, 12, 5, 5, '#9a9278', 0.6);
  p.disc(13, 12, 2.4, 2.4, '#c2b898');
  p.tiny(9, 33, '3', '#8f8570', 1, 0.7);
}, (p, t) => {
  // 转动的叶片（在网罩里）
  for (let y = 2; y <= 22; y++) for (let x = 3; x <= 23; x++) {
    const dx = x - 13, dy = y - 12;
    if (dx * dx + dy * dy < 90) p.put(x, y, [0, 0, 0, 0]);
  }
  p.disc(13, 12, 10, 10, '#8d8674', 0.28);
  for (let b = 0; b < 3; b++) {
    const a = t * 11 + (b * Math.PI * 2) / 3;
    for (let r = 2; r < 10; r++) {
      const spread = 0.42 * (r / 10);
      for (let s = -spread; s <= spread; s += 0.08) {
        p.blend(13 + Math.cos(a + s) * r, 12 + Math.sin(a + s) * r, '#cfc8b0', 0.5);
      }
    }
  }
  p.disc(13, 12, 2.4, 2.4, '#c2b898');
  p.ring(13, 12, 11, 11, '#8f8570', 0.95);
  p.ring(13, 12, 8, 8, '#9a9278', 0.55);
  p.ring(13, 12, 5, 5, '#9a9278', 0.45);
});

// 绿植（绿萝 / 发财树）在陶盆里
def('plant', 26, 34, (p) => {
  shadowUnder(p, 13, 9);
  // 陶盆
  p.rect(7, 24, 12, 9, '#a86a48');
  p.vgrad(7, 24, 12, 9, '#c07f56', '#8a5238');
  p.rect(6, 23, 14, 3, '#b87a50');
  p.rect(6, 23, 14, 1, '#d99a70', 0.7);
  p.rect(8, 32, 10, 2, '#6f4230');
  // 土
  p.rect(8, 24, 10, 2, '#4a3a28');
  // 叶子
  const rng = makeRng(31);
  for (let i = 0; i < 16; i++) {
    const ang = -Math.PI / 2 + (rng() - 0.5) * 2.5;
    const len = 6 + rng() * 11;
    const x0 = 13 + (rng() - 0.5) * 5, y0 = 24;
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    const c = mix('#3f7a3a', '#7bb04a', rng());
    p.line(x0, y0, x1, y1, scaleColor(c, 0.8), 0.95);
    p.disc(x1, y1, 2.4, 1.8, c, 0.95);
    p.disc(x1 - 0.5, y1 - 0.5, 1.2, 0.9, scaleColor(c, 1.25), 0.7);
  }
});

// 二八大杠自行车（停在楼道里，天经地义）
def('bike', 44, 30, (p) => {
  shadowUnder(p, 22, 19);
  p.ring(10, 20, 8.5, 8.5, '#3a3a34', 0.95);
  p.ring(34, 20, 8.5, 8.5, '#3a3a34', 0.95);
  p.ring(10, 20, 5, 5, '#5f5a4e', 0.5);
  p.ring(34, 20, 5, 5, '#5f5a4e', 0.5);
  p.disc(10, 20, 1.4, 1.4, '#8f8878');
  p.disc(34, 20, 1.4, 1.4, '#8f8878');
  // 车架（黑色永久/飞鸽）
  p.line(10, 20, 22, 20, '#2e2e28');
  p.line(22, 20, 26, 9, '#2e2e28');
  p.line(26, 9, 34, 20, '#2e2e28');
  p.line(22, 20, 30, 10, '#2e2e28');
  p.line(14, 10, 22, 20, '#2e2e28');
  p.line(14, 10, 26, 9, '#2e2e28');
  // 车把 + 座
  p.rect(11, 7, 8, 2, '#2e2e28');
  p.rect(9, 6, 3, 2, '#4a4a42');
  p.rect(24, 6, 6, 3, '#2a2a24');
  // 脚蹬 + 链条
  p.disc(22, 20, 3, 3, '#4a4a42', 0.9);
  p.line(22, 20, 34, 20, '#5f5a4e', 0.6);
  // 后座（带弹簧夹）
  p.rect(31, 12, 10, 2, '#4a4a42');
});

// 鱼缸（灯亮着，鱼却不见了）
def('fishtank', 30, 30, (p) => {
  shadowUnder(p, 15, 12);
  p.wood(2, 20, 26, 9, P.cabYellow, P.cabYellowDark, 41, false, 0.5);
  p.rect(3, 3, 24, 18, '#3f6a72', 0.62);
  p.vgrad(3, 3, 24, 18, '#5f9aa0', '#2a4f56', 0.6);
  // 水草 + 砂石
  p.rect(3, 17, 24, 4, '#8a7a52', 0.9);
  for (let i = 0; i < 5; i++) p.line(7 + i * 4, 18, 7 + i * 4 + (i % 2 ? 2 : -2), 9, '#3f7a4a', 0.85);
  // 气泡
  for (const [x, y] of [[20, 14], [21, 10], [19, 7]]) p.disc(x, y, 1, 1, '#d9f0f2', 0.65);
  // 玻璃反光 + 顶灯
  p.line(4, 19, 24, 4, '#e2f4f6', 0.2);
  p.rect(2, 1, 26, 3, '#b0a888');
  p.rect(4, 3, 22, 1, '#fff2cf');
  p.glow(4, 3, 22, 2, 0.9);
  p.frame(3, 3, 24, 18, '#7d7460', 1);
});

// 按键电话（会自己响）
def('phone', 18, 14, (p) => {
  shadowUnder(p, 9, 7, 2);
  p.rect(2, 5, 14, 8, '#e0d6b8');
  p.vgrad(2, 5, 14, 8, '#efe6c8', '#c2b894');
  p.frame(2, 5, 14, 8, '#8f8570', 1);
  // 按键
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    p.rect(4 + c * 3, 7 + r * 2, 2, 1, '#8f8570');
  }
  // 听筒
  p.rect(1, 2, 16, 4, '#d6ccae');
  p.rect(1, 2, 4, 4, '#c2b894');
  p.rect(13, 2, 4, 4, '#c2b894');
  p.rect(1, 2, 16, 1, '#f4ecd2', 0.7);
  // 螺旋线
  for (let i = 0; i < 7; i++) p.disc(17, 6 + i * 1.1, 1.2, 0.7, '#a89e80', 0.85);
});

// 双卡录音机 / 收音机
def('radio', 26, 16, (p) => {
  shadowUnder(p, 13, 10, 2);
  p.rect(1, 3, 24, 12, '#2e2e28');
  p.vgrad(1, 3, 24, 12, '#464640', '#22221e');
  p.frame(1, 3, 24, 12, '#5f5f56', 1);
  p.disc(6, 9, 4, 4, '#1a1a16');
  p.ring(6, 9, 4, 4, '#6f6f64', 0.8);
  p.rect(11, 5, 10, 5, '#8f8878');
  p.rect(12, 6, 8, 3, '#3a3a34');
  p.rect(11, 11, 10, 2, '#5f5f56');
  p.rect(11, 11, 4, 2, '#c9a24a', 0.8);
  p.line(22, 3, 25, -6, '#9a9488', 0.9);
});

// 纸箱堆（搬家？还是从没拆过）
def('boxes', 34, 28, (p) => {
  shadowUnder(p, 17, 15);
  box3d(p, 2, 10, 18, 17, '#b08a58', '#c9a472', '#8a6a40');
  p.rect(2, 17, 18, 1, '#8a6a40', 0.6);
  p.rect(9, 10, 3, 17, '#c2a070', 0.5);
  box3d(p, 18, 4, 14, 23, '#a88254', '#c19c6a', '#7d5f38');
  p.rect(18, 13, 14, 1, '#7d5f38', 0.6);
  p.tiny(4, 20, '2000', '#6f5230', 1, 0.7);
  p.text(20, 6, '易碎', '#8e2218', { size: 7, seed: 3 });
});

// 吊灯泡（从顶上垂下来，会晃）
def('bulb', 14, 26, (p) => {
  p.vline(7, 0, 14, '#6f6858', 0.95);
  p.rect(5, 13, 4, 4, '#9a9278');
  p.disc(7, 20, 4.5, 5, '#fff0c4');
  p.disc(7, 19, 3, 3.4, '#fffbe8');
  p.disc(6, 18, 1.4, 1.4, '#ffffff');
  p.glow(2, 14, 11, 12, 1);
});

// 人影（背对着你的剪影）—— 走近就没了
def('figure', 22, 46, (p) => {
  const body = '#2a2630';
  p.disc(11, 7, 5, 5.5, body);              // 头
  p.rect(6, 12, 10, 3, body);               // 颈肩
  p.rect(4, 14, 14, 18, body);              // 上身
  p.rect(3, 15, 3, 15, body);               // 手臂
  p.rect(16, 15, 3, 15, body);
  p.rect(5, 31, 5, 14, body);               // 腿
  p.rect(12, 31, 5, 14, body);
  // 一点轮廓光（背后的窗）
  p.rect(4, 14, 1, 18, '#6a6478', 0.5);
  p.rect(17, 14, 1, 18, '#6a6478', 0.5);
  p.disc(11, 7, 5, 5.5, '#000', 0.001);
  p.rect(7, 3, 8, 2, '#1f1c26');            // 头发
  // 整体略透，像记忆里的人
  for (let i = 3; i < p.data.length; i += 4) p.data[i] *= 0.9;
});

// 蚊香（一缕烟）
def('mosquito_coil', 16, 12, (p) => {
  shadowUnder(p, 8, 5, 2);
  p.disc(8, 9, 6, 2.4, '#9a9278');
  p.ring(8, 9, 4.4, 1.9, '#4f7a3a', 0.9);
  p.ring(8, 9, 2.6, 1.2, '#4f7a3a', 0.85);
  p.disc(11, 9, 0.9, 0.7, '#e06a2a');
  p.glow(10, 8, 3, 3, 0.6);
}, (p, t) => {
  // 上升的烟
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
    const i = (y * 16 + x) * 4;
    p.data[i + 3] *= 0.55;
  }
  for (let i = 0; i < 9; i++) {
    const yy = 7 - i * 0.8;
    const xx = 11 + Math.sin(t * 1.6 + i * 0.7) * (1 + i * 0.35);
    p.blend(xx, yy, '#cfc8b8', 0.28 - i * 0.025);
  }
});

// 单门冰箱（嗡嗡响）
def('fridge', 30, 52, (p) => {
  shadowUnder(p, 15, 13);
  p.rect(2, 2, 26, 48, '#e2dcc8');
  p.vgrad(2, 2, 26, 48, '#efe9d4', '#c9c2ac');
  p.frame(2, 2, 26, 48, '#a89e80', 1);
  p.rect(2, 16, 26, 1, '#a89e80');       // 冷冻室分缝
  p.rect(23, 5, 3, 9, '#b0a888');        // 把手
  p.rect(23, 20, 3, 22, '#b0a888');
  p.rect(3, 3, 24, 1, '#fff8e2', 0.6);
  // 冰箱贴 + 蕾丝盖布 + 一瓶汽水
  p.rect(6, 22, 5, 6, '#c0392b', 0.85);
  p.rect(13, 24, 4, 4, '#3f7a9a', 0.85);
  p.rect(0, 0, 30, 3, P.lace, 0.9);
  p.rect(8, -1, 6, 4, '#4a7a3a', 0.9);
  p.tiny(6, 44, '195L', '#8f8570', 1, 0.6);
});

// 双缸洗衣机
def('washer', 30, 34, (p) => {
  shadowUnder(p, 15, 13);
  p.rect(2, 4, 26, 29, '#dcd6c0');
  p.vgrad(2, 4, 26, 29, '#e9e3cc', '#c2bca6');
  p.frame(2, 4, 26, 29, '#a89e80', 1);
  p.rect(2, 4, 26, 5, '#c9c2ac');
  p.disc(9, 15, 5.5, 5.5, '#b0a888');
  p.disc(9, 15, 4.2, 4.2, '#8a8474');
  p.disc(21, 15, 4.5, 4.5, '#b0a888');
  p.disc(21, 15, 3.4, 3.4, '#8a8474');
  p.disc(7, 6, 1.6, 1.6, '#5f5a4e');
  p.disc(13, 6, 1.6, 1.6, '#5f5a4e');
  p.rect(4, 26, 22, 5, '#c9c2ac');
  p.tiny(6, 27, '2100', '#8f8570', 1, 0.6);
});

// 钥匙（花盆下面那把）
def('key', 14, 8, (p) => {
  p.ring(4, 4, 3, 3, '#c9a24a');
  p.rect(6, 3, 7, 2, '#c9a24a');
  p.rect(10, 5, 1, 2, '#c9a24a');
  p.rect(12, 5, 1, 2, '#c9a24a');
  p.rect(6, 3, 7, 1, '#f0d68a', 0.8);
  p.glow(0, 0, 14, 8, 0.35);
});

// 塑料拖鞋（门口一双，永远等不到人回来）
def('slippers', 22, 12, (p) => {
  shadowUnder(p, 11, 9, 2);
  for (const ox of [0, 11]) {
    p.disc(ox + 5, 8, 4.5, 3, '#3f6a8a');
    p.disc(ox + 5, 6, 3.4, 2.2, '#5f8aa8');
    p.rect(ox + 2, 4, 6, 2, '#2e4f6a');
  }
});

// ===========================================================================
//  二 · 楼道 / 户外
// ===========================================================================

// 楼梯铁栏杆（一段）
def('railing', 32, 30, (p) => {
  p.rect(0, 26, 32, 4, '#6f6858');
  p.rect(0, 26, 32, 1, '#8f8878', 0.7);
  p.rect(0, 2, 32, 3, '#4a4a42');       // 扶手
  p.rect(0, 2, 32, 1, '#7d7a6e', 0.8);
  for (let x = 2; x < 32; x += 5) {
    p.rect(x, 5, 2, 21, '#55524a');
    p.rect(x, 5, 1, 21, '#6f6c62', 0.6);
  }
  p.rect(0, 5, 3, 21, '#4a4a42');
  p.rect(29, 5, 3, 21, '#4a4a42');
});

// 垃圾桶（铁皮，掉漆）
def('bin', 20, 24, (p) => {
  shadowUnder(p, 10, 8);
  p.rect(3, 5, 14, 18, '#6f7a68');
  p.vgrad(3, 5, 14, 18, '#8a9480', '#4f5a4a');
  p.rect(2, 3, 16, 3, '#5f6a5a');
  p.rect(2, 3, 16, 1, '#9aa494', 0.7);
  for (let y = 8; y < 22; y += 4) p.hline(3, y, 14, '#3f4a3a', 0.4);
  p.stain(8, 14, 5, '#8a5a30', 51, 0.5);
});

// 消防栓箱
def('hydrant', 22, 30, (p) => {
  shadowUnder(p, 11, 9, 2);
  p.rect(2, 2, 18, 26, '#b8342a');
  p.vgrad(2, 2, 18, 26, '#d04a3a', '#8e2218');
  p.frame(2, 2, 18, 26, '#6f1a12', 1);
  p.rect(5, 6, 12, 14, '#a02a20');
  p.frame(5, 6, 12, 14, '#6f1a12', 1);
  p.text(6, 21, '消火栓', '#f0e0c0', { size: 5, seed: 7 });
  p.disc(16, 13, 1.4, 1.4, '#e8c968');
});

// 晾衣绳上的衣服（天台，风里晃）
def('laundry', 30, 34, (p) => {
  p.rect(0, 1, 30, 1, '#9a9488', 0.9);
  // 一件白衬衫
  p.rect(3, 2, 11, 15, '#e9e6d8');
  p.rect(2, 4, 13, 3, '#e9e6d8');
  p.rect(6, 2, 5, 3, '#d9d6c8');
  // 一条蓝裤子
  p.rect(17, 2, 10, 20, '#4a6a8a');
  p.rect(17, 12, 4, 10, '#3f5c7a');
  p.rect(23, 12, 4, 10, '#3f5c7a');
  // 夹子
  p.rect(5, 0, 2, 3, '#c0392b');
  p.rect(12, 0, 2, 3, '#c9a24a');
  p.rect(20, 0, 2, 3, '#4a7a3a');
});

// 鱼骨电视天线（天台上的森林）
def('antenna', 26, 40, (p) => {
  p.vline(13, 0, 40, '#8f8878', 0.95);
  for (let i = 0; i < 6; i++) {
    const y = 3 + i * 5, half = 11 - i;
    p.hline(13 - half, y, half * 2, '#8f8878', 0.9);
  }
  p.rect(9, 36, 9, 4, '#6f6858');
  p.line(13, 6, 4, 38, '#7d7a6e', 0.5);
  p.line(13, 6, 22, 38, '#7d7a6e', 0.5);
});

// 屋顶水塔
def('water_tower', 40, 56, (p) => {
  shadowUnder(p, 20, 16);
  // 支架
  p.line(6, 54, 12, 26, '#7d7460'); p.line(34, 54, 28, 26, '#7d7460');
  p.line(12, 26, 12, 54, '#6f6858', 0.7); p.line(28, 26, 28, 54, '#6f6858', 0.7);
  p.line(8, 44, 32, 40, '#6f6858', 0.6); p.line(8, 40, 32, 44, '#6f6858', 0.6);
  // 罐体
  p.rect(6, 8, 28, 20, '#9a9080');
  p.vgrad(6, 8, 28, 20, '#b0a694', '#7d7362');
  p.disc(20, 8, 14, 4, '#a89e8c');
  p.disc(20, 28, 14, 4, '#6f6858');
  p.rect(6, 8, 28, 1, '#c2b8a4', 0.7);
  for (let y = 12; y < 28; y += 5) p.hline(6, y, 28, '#5f5a4e', 0.3);
  p.stain(24, 18, 8, '#8a5a30', 61, 0.45);
  // 顶盖 + 爬梯
  p.rect(16, 3, 8, 5, '#8a8070');
  for (let y = 30; y < 54; y += 4) p.hline(18, y, 5, '#6f6858', 0.8);
  p.vline(18, 28, 26, '#6f6858', 0.8); p.vline(22, 28, 26, '#6f6858', 0.8);
});

// ===========================================================================
//  三 · 千禧年大堂
// ===========================================================================

// 饮水机
def('water_cooler', 22, 44, (p) => {
  shadowUnder(p, 11, 9);
  p.rect(4, 14, 14, 28, '#e2dcc8');
  p.vgrad(4, 14, 14, 28, '#efe9d4', '#c2bca6');
  p.frame(4, 14, 14, 28, '#a89e80', 1);
  // 水桶
  p.rect(6, 2, 10, 12, '#8ec4d0', 0.75);
  p.disc(11, 2, 5, 2, '#a8d8e0', 0.8);
  p.rect(6, 10, 10, 4, '#7ab0bc', 0.8);
  p.rect(8, 13, 6, 3, '#5f8a94');
  // 龙头
  p.rect(8, 22, 2, 3, '#3f7a9a');
  p.rect(13, 22, 2, 3, '#b8342a');
  p.rect(6, 26, 10, 2, '#a89e80');
  p.glow(6, 2, 10, 12, 0.2);
});

// 大堂大型盆栽（苏铁 / 发财树）
def('plant_big', 40, 58, (p) => {
  shadowUnder(p, 20, 15);
  p.rect(11, 44, 18, 13, '#8a6a48');
  p.vgrad(11, 44, 18, 13, '#a88058', '#6f5238');
  p.rect(9, 42, 22, 4, '#9a7250');
  p.rect(9, 42, 22, 1, '#c09a70', 0.7);
  p.rect(12, 44, 16, 2, '#3f3428');
  const rng = makeRng(71);
  for (let i = 0; i < 26; i++) {
    const ang = -Math.PI / 2 + (rng() - 0.5) * 2.7;
    const len = 12 + rng() * 24;
    const x0 = 20 + (rng() - 0.5) * 7, y0 = 44;
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    const c = mix('#2e5f34', '#6aa044', rng());
    p.line(x0, y0, x1, y1, scaleColor(c, 0.75), 0.95);
    // 羽状小叶
    for (let k = 3; k < 10; k++) {
      const px = x0 + (x1 - x0) * (k / 10), py = y0 + (y1 - y0) * (k / 10);
      p.disc(px, py, 2.6, 1.7, c, 0.9);
    }
  }
});

// 立式指示牌（欢迎光临 / 请勿吸烟）
def('sign_stand', 26, 40, (p) => {
  shadowUnder(p, 13, 8);
  p.rect(11, 20, 4, 18, '#8f9498');
  p.rect(6, 37, 14, 3, '#7e868a');
  p.rect(2, 2, 22, 18, '#c2b894');
  p.frame(2, 2, 22, 18, '#8f8570', 1);
  p.rect(3, 3, 20, 16, '#e6dcc0');
  p.text(4, 5, '欢迎光临', '#8e2218', { size: 6, seed: 13 });
  p.text(4, 12, '内有监控', '#3f4a5a', { size: 5, seed: 17 });
});

// 红丝绒围栏柱（大堂的仪式感）
def('rope_post', 14, 40, (p) => {
  shadowUnder(p, 7, 6);
  p.rect(5, 6, 4, 31, '#c9a24a');
  p.vgrad(5, 6, 4, 31, '#e0bc6a', '#9a7a2e');
  p.disc(7, 5, 3.4, 3.4, '#e0bc6a');
  p.disc(6, 4, 1.4, 1.4, '#f4e2a8');
  p.disc(7, 38, 6, 2.4, '#8a6a2a');
  p.rect(0, 8, 5, 3, '#8e2218');
  p.rect(9, 8, 5, 3, '#8e2218');
});

// 大堂电子钟（永远 2000.01.01 00:00）
def('clock_digital', 40, 16, (p) => {
  p.rect(0, 0, 40, 16, '#22221e');
  p.frame(0, 0, 40, 16, '#5f5f56', 1);
  p.rect(2, 2, 36, 12, '#0e100d');
  p.tiny(4, 5, '2000-01-01', '#e0703a', 1);
  p.tiny(4, 10, '00:00:00', '#e0703a', 1);
  p.glow(2, 2, 36, 12, 0.8);
});

// 麻将桌（声音在，人不在）
def('mahjong', 40, 26, (p) => {
  shadowUnder(p, 20, 17);
  p.rect(3, 8, 34, 14, '#4a7a5a');
  p.vgrad(3, 8, 34, 14, '#5f9070', '#35594a');
  p.frame(3, 8, 34, 14, '#2e4a3a', 1);
  const rng = makeRng(81);
  for (let i = 0; i < 26; i++) {
    const x = 5 + rng() * 30, y = 10 + rng() * 10;
    p.rect(x, y, 3, 4, '#e9e6d2');
    p.rect(x, y, 3, 1, '#fffbe8', 0.8);
    p.rect(x + 1, y + 2, 1, 1, rng() > 0.5 ? '#3f6a8a' : '#8e2218', 0.9);
  }
  p.rect(6, 21, 3, 5, '#7d6a4a');
  p.rect(31, 21, 3, 5, '#7d6a4a');
  // 四把空椅子（示意）
  p.rect(0, 12, 3, 8, '#8a2b20', 0.9);
  p.rect(37, 12, 3, 8, '#8a2b20', 0.9);
});
