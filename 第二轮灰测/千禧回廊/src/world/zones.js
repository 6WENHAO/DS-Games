// ============================================================================
//  zones.js —— 五个场景（用代码"砌墙"，比 ASCII 拼图可靠得多）
//    1 stair  单元楼道（水磨石·墨绿墙裙·声控灯·上不完的楼梯）
//    2 home   家（黄柜子·原木板材·暖色调·中式梦核）
//    3 lobby  千禧年大堂（彩色玻璃幕墙·大理石拼花·斗拱门洞·红横幅）
//    4 tower  尖塔（一圈窄窗，越上越高，核心里有一台电视）
//    5 roof   天台（不动的落日·天线森林·一万个声音）
//
//  尺度约定：一格 = 1 米；wallH = 层高（米）；精灵 hgt/base 也是米
//  天花板上的灯只放在带灯的那个字符格里（'!' ':' 'O' '1' '2' '3' '4' '5'）
// ============================================================================

import { grid, box, put } from './compile.js';
import { AMBIENCE } from '../gfx/palette.js';

// ---------------------------------------------------------------------------
//  1 · 楼道
// ---------------------------------------------------------------------------
const STAIR = {
  id: 'stair',
  name: '单元楼道',
  amb: AMBIENCE.stair,
  wallH: 2.75,
  spawn: { x: 6.6, y: 23.5, a: 0 },
  build() {
    const g = grid(27, 27, '#');

    // ——— 楼道（上层：三户人家 ）———
    box(g, 3, 7, 17, 9, '.');
    put(g, 10, 8, '!');                    // 声控灯就这一盏
    box(g, 3, 6, 17, 6, 'A');              // 北墙：贴满小广告
    put(g, 6, 6, 'D'); put(g, 11, 6, 'D'); put(g, 15, 6, 'D');  // 301 / 302 / 303
    box(g, 3, 10, 17, 10, 'K');            // 南墙：粉笔涂鸦
    put(g, 5, 10, 'M');                    // 电表箱
    put(g, 2, 8, 'W');                     // 楼道尽头的窗

    // ——— 楼梯平台 B（上）———
    box(g, 19, 6, 24, 10, '.');
    put(g, 21, 8, '!');
    put(g, 25, 8, 'W'); put(g, 25, 9, 'W');
    put(g, 18, 8, '#');                    // 通往楼道的口子，第三层才"长出来"
    box(g, 19, 11, 24, 11, '#');           // 把两段楼梯隔开，各自是一段"上不完的楼梯"

    // ——— 上行通道 B（走到顶 → 又回到平台 A）———
    box(g, 20, 2, 22, 5, '.');
    put(g, 21, 3, '!');

    // ——— 楼梯平台 A（下）———
    box(g, 19, 16, 24, 21, '.');
    put(g, 21, 18, '!');
    put(g, 25, 18, 'W'); put(g, 25, 19, 'W');

    // ——— 上行通道 A ———
    box(g, 20, 12, 22, 15, '.');
    put(g, 21, 13, '!');

    // ——— 单元门厅 ———
    box(g, 3, 22, 18, 24, ';');
    put(g, 9, 23, ':');                    // 门厅那盏灯
    box(g, 17, 20, 18, 21, ',');           // 通往楼梯间：两格宽，不留夹角
    put(g, 9, 25, 'X');                    // 单元门（推不开）
    put(g, 4, 21, 'A');

    return g.map((r) => r.join(''));
  },
  lights: [
    { id: 'l_hall', x: 9.5, y: 23.5, r: 9, color: '#ffe0a8', i: 1.2, on: false },
    { id: 'l_a', x: 21.5, y: 18.5, r: 8.5, color: '#ffe0a8', i: 1.15, on: false },
    { id: 'l_upa', x: 21.5, y: 13.5, r: 6.5, color: '#ffdca0', i: 1.0, on: false },
    { id: 'l_b', x: 21.5, y: 8.5, r: 8.5, color: '#ffe0a8', i: 1.15, on: false },
    { id: 'l_upb', x: 21.5, y: 3.5, r: 6.5, color: '#ffdca0', i: 1.0, on: false },
    { id: 'l_corr', x: 10.5, y: 8.5, r: 12, color: '#ffe4b0', i: 1.25, on: false },
    // 窗外的夕阳（常亮，跟声控灯形成冷暖对比）
    { id: 'l_win_w', x: 2.6, y: 8.5, r: 6, color: '#f0b070', i: 0.8, on: true },
    { id: 'l_win_a', x: 24.4, y: 18.5, r: 6, color: '#f0b070', i: 0.85, on: true },
    { id: 'l_win_b', x: 24.4, y: 8.5, r: 6, color: '#f0b070', i: 0.85, on: true },
  ],
  sprites: [
    { p: 'bike', x: 5.4, y: 23.2, hgt: 1.12, solid: 0.42 },
    { p: 'bin', x: 16.4, y: 23.5, hgt: 0.78, solid: 0.26 },
    { p: 'hydrant', x: 3.5, y: 22.6, hgt: 0.95, base: 0.55 },
    { p: 'boxes', x: 15.6, y: 8.6, hgt: 1.05, solid: 0.32 },
    { p: 'plant', x: 10.4, y: 7.35, hgt: 1.15, solid: 0.24 },
    { p: 'key', x: 10.4, y: 7.62, hgt: 0.13, base: 0.02, hidden: true, id: 'key', emit: 0.35 },
    { p: 'railing', x: 19.3, y: 17.5, hgt: 1.02 },
    { p: 'railing', x: 19.3, y: 19.5, hgt: 1.02 },
    { p: 'railing', x: 19.3, y: 7.5, hgt: 1.02 },
    { p: 'railing', x: 19.3, y: 9.5, hgt: 1.02 },
    { p: 'figure', x: 3.9, y: 8.5, hgt: 1.72, hidden: true, id: 'ghost1' },
    { p: 'bulb', x: 21.5, y: 13.5, hgt: 0.95, base: 1.8, sway: 0.022, emit: 0.9 },
    { p: 'slippers', x: 15.5, y: 7.2, hgt: 0.16 },
  ],
  interactables: [
    { id: 'door302', x: 11.5, y: 6.75, r: 1.35, label: '302', prio: 1.4 },
    { id: 'door301', x: 6.5, y: 6.75, r: 1.15, label: '301' },
    { id: 'door303', x: 15.5, y: 6.75, r: 1.15, label: '303' },
    { id: 'pot', x: 10.4, y: 7.45, r: 0.95, label: '花盆' },
    { id: 'meter', x: 5.5, y: 9.4, r: 1.15, label: '电表箱' },
    { id: 'gate', x: 9.5, y: 24.4, r: 1.25, label: '单元门' },
    { id: 'win_stair', x: 2.75, y: 8.5, r: 1.35, label: '楼道的窗' },
    { id: 'win_landing', x: 24.4, y: 18.5, r: 1.35, label: '楼梯间的窗' },
    { id: 'bike', x: 5.4, y: 23.0, r: 1.2, label: '自行车' },
  ],
  // 「上不完的楼梯」：走到通道顶端就被送回下一段的起点，层数 +1
  teleports: [
    { from: [21, 12], to: { x: 21.5, y: 10.4, a: -Math.PI / 2 }, kind: 'climb' },
    { from: [21, 2], to: { x: 21.5, y: 20.4, a: -Math.PI / 2 }, kind: 'climb' },
  ],
  checkOpen: [[18, 8, '.']],
};

// ---------------------------------------------------------------------------
//  2 · 家
// ---------------------------------------------------------------------------
const HOME = {
  id: 'home',
  name: '302',
  amb: AMBIENCE.home,
  wallH: 2.6,
  spawn: { x: 2.9, y: 13.3, a: -Math.PI / 2 },
  build() {
    const g = grid(24, 18, '#');

    // ——— 客厅 ———
    box(g, 5, 7, 12, 13, 'o');
    put(g, 8, 10, 'O');                    // 客厅吸顶灯
    box(g, 5, 6, 9, 6, 'Y');               // 北墙：一整面黄柜子
    put(g, 10, 6, 'f'); put(g, 11, 6, 'o'); put(g, 12, 6, 'f');  // 磨砂玻璃推拉门（半开）
    box(g, 5, 14, 12, 14, 'n');            // 南墙：原木色护墙板
    put(g, 4, 7, 'l');                     // 挂历
    put(g, 4, 8, 'p');                     // 中堂画
    put(g, 4, 9, 'G');                     // 玻璃柜
    put(g, 4, 10, 'h'); put(g, 4, 11, 'h'); put(g, 4, 13, 'h');
    box(g, 13, 7, 13, 13, 'h');            // 东墙
    put(g, 13, 11, 'o');                   // 通走廊的门洞

    // ——— 阳台 ———
    box(g, 9, 3, 13, 5, 'b');
    box(g, 9, 2, 13, 2, 'W');
    box(g, 8, 3, 8, 5, 'h');
    box(g, 14, 3, 14, 6, 'h');

    // ——— 玄关 ———
    box(g, 2, 11, 3, 13, 'o');
    put(g, 4, 12, 'o');
    put(g, 3, 14, 'D');                    // 入户门
    box(g, 1, 11, 1, 13, 'h');
    put(g, 2, 10, 'h'); put(g, 3, 10, 'h');
    put(g, 2, 14, 'h'); put(g, 4, 14, 'h');

    // ——— 走廊 ———
    box(g, 14, 7, 14, 13, 'o');
    put(g, 14, 10, 'O');
    put(g, 14, 14, 'h');
    box(g, 15, 7, 15, 9, 'h');
    put(g, 15, 8, 'o');                    // 卧室门洞
    box(g, 15, 10, 15, 13, 't');
    put(g, 15, 12, 'k');                   // 厨房门洞

    // ——— 卧室 ———
    box(g, 16, 4, 21, 8, 'o');
    put(g, 18, 6, 'O');
    box(g, 16, 3, 21, 3, 'h');
    box(g, 22, 4, 22, 8, 'h');
    put(g, 22, 5, 'R'); put(g, 22, 6, 'R'); // 镜子
    box(g, 16, 9, 20, 9, 'j');
    put(g, 21, 9, 'h');

    // ——— 厨房 ———
    box(g, 16, 10, 20, 13, 'k');
    put(g, 18, 11, '1');
    box(g, 16, 14, 20, 14, 't');
    box(g, 21, 10, 21, 13, 't');

    return g.map((r) => r.join(''));
  },
  lights: [
    { id: 'h_living', x: 8.5, y: 10.5, r: 9, color: '#ffe2b4', i: 1.05, on: true },
    { id: 'h_entry', x: 3, y: 12.2, r: 4.5, color: '#ffdca0', i: 0.62, on: true },
    { id: 'h_bed', x: 18.5, y: 6.5, r: 7, color: '#ffdca8', i: 0.85, on: true },
    { id: 'h_kitchen', x: 18, y: 11.5, r: 6.5, color: '#fff0d0', i: 0.9, on: true },
    { id: 'h_corr', x: 14.4, y: 10.5, r: 5, color: '#ffdca0', i: 0.6, on: true },
    { id: 'h_balcony', x: 11, y: 3.6, r: 8, color: '#ffc888', i: 1.05, on: true },
    { id: 'h_tv', x: 7.0, y: 8.0, r: 4.5, color: '#9ec4d8', i: 0, on: true },
  ],
  sprites: [
    { p: 'tv_crt', x: 7.0, y: 7.55, hgt: 1.5, id: 'tv', emit: 0, solid: 0.3 },
    { p: 'sofa', x: 9.2, y: 12.5, hgt: 0.95, solid: 0.45 },
    { p: 'table_round', x: 8.6, y: 10.3, hgt: 0.82, solid: 0.36 },
    { p: 'phone', x: 8.6, y: 9.95, hgt: 0.2, base: 0.78, id: 'phone' },
    { p: 'stool_red', x: 10.6, y: 10.8, hgt: 0.5 },
    { p: 'stool_red', x: 6.9, y: 11.2, hgt: 0.5, flip: true },
    { p: 'thermos', x: 6.1, y: 12.7, hgt: 0.42 },
    { p: 'fan_stand', x: 12.2, y: 8.4, hgt: 1.35, solid: 0.24 },
    { p: 'fishtank', x: 12.3, y: 12.5, hgt: 1.05, solid: 0.3, emit: 0.12 },
    { p: 'radio', x: 8.75, y: 7.6, hgt: 0.3, base: 0.86 },
    { p: 'mosquito_coil', x: 11.2, y: 12.7, hgt: 0.14 },
    { p: 'bulb', x: 3.0, y: 12.0, hgt: 0.95, base: 1.65, sway: 0.02, emit: 0.9 },
    { p: 'slippers', x: 3.3, y: 13.5, hgt: 0.16 },
    { p: 'boxes', x: 2.5, y: 11.5, hgt: 1.05, solid: 0.32 },
    { p: 'plant', x: 9.7, y: 4.0, hgt: 1.2, solid: 0.22 },
    { p: 'washer', x: 12.6, y: 4.3, hgt: 1.2, solid: 0.32 },
    { p: 'laundry', x: 11.2, y: 3.5, hgt: 1.25, base: 1.1, sway: 0.035, swaySpeed: 0.8 },
    { p: 'fridge', x: 19.6, y: 10.8, hgt: 1.85, solid: 0.34 },
    { p: 'mahjong', x: 18.6, y: 6.2, hgt: 0.85, solid: 0.4, id: 'mahjong' },
    { p: 'figure', x: 14.5, y: 9.3, hgt: 1.72, hidden: true, id: 'ghost2' },
    { p: 'bulb', x: 18.0, y: 11.5, hgt: 0.95, base: 1.62, sway: 0.014, emit: 0.85 },
  ],
  interactables: [
    { id: 'tv', x: 7.0, y: 8.25, r: 1.35, label: '电视机' },
    { id: 'calendar', x: 4.75, y: 7.5, r: 1.25, label: '挂历' },
    { id: 'picture', x: 4.75, y: 8.5, r: 1.25, label: '中堂画' },
    { id: 'cabinet', x: 7.0, y: 6.8, r: 1.6, label: '黄柜子' },
    { id: 'glasscab', x: 4.75, y: 9.5, r: 1.25, label: '玻璃柜' },
    { id: 'mirror', x: 21.4, y: 5.5, r: 1.5, label: '镜子' },
    { id: 'mahjong', x: 18.6, y: 6.9, r: 1.4, label: '麻将桌' },
    { id: 'stove', x: 18, y: 10.3, r: 1.6, label: '灶台' },
    { id: 'phone', x: 8.6, y: 10.5, r: 1.35, label: '电话' },
    { id: 'balcony', x: 11, y: 2.75, r: 1.7, label: '阳台的窗' },
    { id: 'homedoor', x: 3.0, y: 13.5, r: 1.25, label: '入户门', prio: 1.4 },
    { id: 'fishtank', x: 12.3, y: 11.85, r: 1.3, label: '鱼缸' },
  ],
};

// ---------------------------------------------------------------------------
//  3 · 千禧年大堂
// ---------------------------------------------------------------------------
const LOBBY = {
  id: 'lobby',
  name: '世纪大厦·大堂',
  amb: AMBIENCE.lobby,
  wallH: 4.8,
  spawn: { x: 14.5, y: 20.4, a: -Math.PI / 2 },
  build() {
    const g = grid(30, 24, '#');

    // ——— 中庭（玻璃采光顶）———
    box(g, 2, 6, 27, 21, '-');
    box(g, 13, 6, 16, 21, '=');            // 红地毯中轴

    // ——— 三面彩色玻璃幕墙 ———
    box(g, 2, 22, 27, 22, 'q');
    box(g, 1, 6, 1, 21, 'q');
    box(g, 28, 6, 28, 21, 'q');
    for (const x of [5, 9, 18, 24]) put(g, x, 22, 'Q');
    for (const y of [8, 13, 19]) { put(g, 1, y, 'Q'); put(g, 28, y, 'Q'); }

    // ——— 电梯厅（矿棉板吊顶 + 成排日光灯）———
    box(g, 8, 2, 21, 5, '_');
    put(g, 10, 3, '2'); put(g, 14, 3, '2'); put(g, 19, 3, '2');
    box(g, 8, 5, 21, 5, 'g');              // 斗拱门洞墙
    box(g, 13, 5, 16, 5, '3');             // 红地毯从斗拱门洞下穿过
    box(g, 8, 1, 21, 1, 'B');              // 红横幅
    box(g, 13, 1, 15, 1, 'E');             // 电梯
    box(g, 7, 2, 7, 5, 'g');
    box(g, 22, 2, 22, 5, 'g');
    box(g, 2, 5, 6, 5, 'm');
    box(g, 23, 5, 27, 5, 'm');

    // ——— 两块灯灭掉的角落（梦核）———
    box(g, 3, 18, 6, 21, '~');
    box(g, 23, 7, 26, 10, '~');

    return g.map((r) => r.join(''));
  },
  lights: [
    { id: 'lb_center', x: 14.5, y: 13, r: 18, color: '#ffe0b0', i: 0.5, on: true },
    { id: 'lb_ele', x: 14.5, y: 3, r: 9, color: '#fff0d0', i: 0.95, on: true },
    { id: 'lb_w', x: 3, y: 12, r: 8, color: '#e8c890', i: 0.35, on: true },
    { id: 'lb_e', x: 26, y: 16, r: 8, color: '#e8c890', i: 0.35, on: true },
    { id: 'lb_dusk1', x: 14.5, y: 21.4, r: 14, color: '#f0a860', i: 0.7, on: true },
    { id: 'lb_dusk2', x: 1.6, y: 13, r: 11, color: '#f0a860', i: 0.6, on: true },
    { id: 'lb_dusk3', x: 27.4, y: 13, r: 11, color: '#f0a860', i: 0.6, on: true },
  ],
  sprites: [
    { p: 'plant_big', x: 4.5, y: 7.5, hgt: 2.1, solid: 0.5 },
    { p: 'plant_big', x: 25.5, y: 7.5, hgt: 2.1, solid: 0.5 },
    { p: 'plant_big', x: 4.5, y: 19.5, hgt: 2.1, solid: 0.5 },
    { p: 'plant_big', x: 25.5, y: 19.5, hgt: 2.1, solid: 0.5 },
    { p: 'rope_post', x: 12.3, y: 9.5, hgt: 1.0 },
    { p: 'rope_post', x: 17.7, y: 9.5, hgt: 1.0 },
    { p: 'rope_post', x: 12.3, y: 15.5, hgt: 1.0 },
    { p: 'rope_post', x: 17.7, y: 15.5, hgt: 1.0 },
    { p: 'water_cooler', x: 23.5, y: 17.5, hgt: 1.3, solid: 0.28 },
    { p: 'sign_stand', x: 10.6, y: 18.5, hgt: 1.4, solid: 0.24 },
    { p: 'clock_digital', x: 18.6, y: 2.12, hgt: 0.6, base: 2.3, emit: 0.6, id: 'clock' },
    { p: 'bin', x: 8.4, y: 18.6, hgt: 0.78 },
    { p: 'bin', x: 21.5, y: 11.5, hgt: 0.78 },
    { p: 'plant', x: 8.5, y: 3.5, hgt: 1.2 },
    { p: 'plant', x: 20.5, y: 3.5, hgt: 1.2 },
    { p: 'stool_red', x: 7.5, y: 12.5, hgt: 0.5 },
    { p: 'figure', x: 14.5, y: 8.5, hgt: 1.72, hidden: true, id: 'ghost3' },
    { p: 'figure', x: 25.0, y: 9.0, hgt: 1.72, hidden: true, id: 'ghost4' },
  ],
  interactables: [
    { id: 'elevator', x: 14.5, y: 2.15, r: 1.7, label: '电梯', prio: 1.4 },
    { id: 'banner', x: 10.5, y: 2.15, r: 1.7, label: '横幅' },
    { id: 'curtainwall', x: 14.5, y: 21.4, r: 2.1, label: '玻璃幕墙' },
    { id: 'clock', x: 18.6, y: 2.6, r: 1.6, label: '电子钟' },
    { id: 'dougong', x: 10.5, y: 5.85, r: 1.5, label: '斗拱' },
    { id: 'carpet', x: 14.5, y: 13, r: 1.9, label: '红地毯' },
    { id: 'darkcorner', x: 4.5, y: 19.5, r: 2.0, label: '灭了灯的角落' },
  ],
};

// ---------------------------------------------------------------------------
//  4 · 尖塔
// ---------------------------------------------------------------------------
const TOWER = {
  id: 'tower',
  name: '塔',
  amb: AMBIENCE.tower,
  wallH: 3.3,
  spawn: { x: 2.5, y: 12.5, a: -Math.PI / 2 },
  build() {
    const g = grid(16, 16, 'T');
    box(g, 1, 1, 14, 14, '^');       // 一圈环廊
    put(g, 2, 2, '4'); put(g, 13, 2, '4'); put(g, 13, 13, '4'); put(g, 2, 13, '4');
    box(g, 5, 5, 10, 10, 'm');       // 中央核心（封着）
    return g.map((r) => r.join(''));
  },
  lights: [
    { id: 'tw_nw', x: 2.5, y: 2.5, r: 7, color: '#ffdca0', i: 0.75, on: true },
    { id: 'tw_ne', x: 13.5, y: 2.5, r: 7, color: '#ffdca0', i: 0.75, on: true },
    { id: 'tw_se', x: 13.5, y: 13.5, r: 7, color: '#ffdca0', i: 0.75, on: true },
    { id: 'tw_sw', x: 2.5, y: 13.5, r: 7, color: '#ffdca0', i: 0.75, on: true },
    { id: 'tw_core', x: 7.5, y: 7.5, r: 6, color: '#9ec4d8', i: 0, on: true },
  ],
  sprites: [
    { p: 'bulb', x: 7.5, y: 2.5, hgt: 0.95, base: 2.35, sway: 0.03, emit: 0.9 },
    { p: 'bulb', x: 7.5, y: 13.5, hgt: 0.95, base: 2.35, sway: 0.03, emit: 0.9 },
    { p: 'bulb', x: 2.5, y: 7.5, hgt: 0.95, base: 2.35, sway: 0.03, emit: 0.9 },
    { p: 'bulb', x: 13.5, y: 7.5, hgt: 0.95, base: 2.35, sway: 0.03, emit: 0.9 },
    { p: 'boxes', x: 13.4, y: 4.6, hgt: 1.05, solid: 0.3 },
    { p: 'bin', x: 2.6, y: 10.5, hgt: 0.78 },
    { p: 'thermos', x: 3.4, y: 3.4, hgt: 0.42 },
    { p: 'tv_crt', x: 7.5, y: 8.2, hgt: 1.5, id: 'lasttv', emit: 0.1, solid: 0.3 },
    { p: 'stool_red', x: 7.5, y: 6.5, hgt: 0.5 },
    { p: 'figure', x: 13.5, y: 11.5, hgt: 1.72, hidden: true, id: 'ghost5' },
  ],
  interactables: [
    { id: 'tower_win', x: 7.5, y: 1.45, r: 1.6, label: '窄窗' },
    { id: 'core', x: 7.5, y: 4.45, r: 1.5, label: '核心的墙' },
    { id: 'lasttv', x: 7.5, y: 9.0, r: 1.6, label: '电视机', prio: 1.4 },
  ],
  checkOpen: [
    [7, 5, '^'], [8, 5, '^'],
    [6, 6, '^'], [7, 6, '^'], [8, 6, '^'], [9, 6, '^'],
    [6, 7, '^'], [7, 7, '^'], [8, 7, '^'], [9, 7, '^'],
    [6, 8, '^'], [7, 8, '^'], [8, 8, '^'], [9, 8, '^'],
    [6, 9, '^'], [7, 9, '^'], [8, 9, '^'], [9, 9, '^'],
  ],
};

// ---------------------------------------------------------------------------
//  5 · 天台
// ---------------------------------------------------------------------------
const ROOF = {
  id: 'roof',
  name: '天台',
  amb: AMBIENCE.roof,
  wallH: 2.6,
  spawn: { x: 5.0, y: 18.2, a: -Math.PI / 2 },
  build() {
    const g = grid(26, 22, 'P');           // 'P' = 女儿墙，只有 1.15m 高
    box(g, 2, 2, 23, 19, '*');             // 屋面（露天）
    // 楼梯间小屋（你就是从这儿上来的）
    box(g, 2, 15, 8, 15, 'c');
    box(g, 2, 16, 2, 19, 'c');
    box(g, 8, 16, 8, 19, 'c');
    box(g, 3, 16, 7, 19, '`');
    put(g, 5, 17, '5');                    // 小屋里那盏灯
    put(g, 5, 15, '`');                    // 出屋的门洞
    // 电梯机房（实心水泥小方块，天台标配）
    box(g, 18, 3, 21, 5, 'c');
    return g.map((r) => r.join(''));
  },
  lights: [
    { id: 'rf_sun', x: 13, y: -8, r: 46, color: '#ffca86', i: 0.5, on: true },
    { id: 'rf_hut', x: 5, y: 17.5, r: 5.5, color: '#ffdca0', i: 0.55, on: true },
  ],
  sprites: [
    { p: 'water_tower', x: 19.5, y: 7.5, hgt: 4.6, solid: 0.85 },
    { p: 'antenna', x: 8.5, y: 5.5, hgt: 3.0 },
    { p: 'antenna', x: 11.5, y: 3.5, hgt: 3.4 },
    { p: 'antenna', x: 14.5, y: 6.5, hgt: 2.7 },
    { p: 'antenna', x: 5.5, y: 8.5, hgt: 3.2 },
    { p: 'antenna', x: 16.5, y: 11.5, hgt: 2.9 },
    { p: 'antenna', x: 21.5, y: 14.5, hgt: 3.1 },
    { p: 'antenna', x: 3.5, y: 12.5, hgt: 2.6 },
    { p: 'laundry', x: 9.5, y: 10.5, hgt: 1.3, base: 1.15, sway: 0.05, swaySpeed: 0.7 },
    { p: 'laundry', x: 11.5, y: 10.5, hgt: 1.3, base: 1.15, sway: 0.06, swaySpeed: 0.6, flip: true },
    { p: 'laundry', x: 13.5, y: 10.5, hgt: 1.3, base: 1.15, sway: 0.045, swaySpeed: 0.85 },
    { p: 'bin', x: 9.4, y: 17.5, hgt: 0.78 },
    { p: 'plant', x: 12.5, y: 17.5, hgt: 1.2 },
    { p: 'stool_red', x: 13.5, y: 3.2, hgt: 0.5, id: 'endstool' },
    { p: 'thermos', x: 14.3, y: 3.4, hgt: 0.42 },
    { p: 'bike', x: 6.5, y: 13.5, hgt: 1.12, solid: 0.4 },
    { p: 'boxes', x: 3.4, y: 17.4, hgt: 1.05, solid: 0.3 },
    { p: 'figure', x: 21.5, y: 17.5, hgt: 1.72, hidden: true, id: 'ghost6' },
  ],
  interactables: [
    { id: 'endstool', x: 13.5, y: 4.1, r: 1.6, label: '一把红塑料凳', prio: 1.4 },
    { id: 'parapet', x: 13.0, y: 2.3, r: 2.3, label: '女儿墙' },
    { id: 'tower_far', x: 19.5, y: 8.8, r: 1.9, label: '水塔' },
    { id: 'laundryline', x: 11.5, y: 11.4, r: 1.9, label: '晾衣绳' },
  ],
};

export const ZONE_DEFS = { stair: STAIR, home: HOME, lobby: LOBBY, tower: TOWER, roof: ROOF };
export const ZONE_ORDER = ['stair', 'home', 'lobby', 'tower', 'roof'];
