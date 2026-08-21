/* ============================================================
   故宫色板：琉璃黄瓦 / 朱红宫墙 / 汉白玉 / 青绿彩画 / 金饰 …
   每项 = [r,g,b, emissive]
   ============================================================ */
'use strict';

const PALETTE = [];
const C = {};
/** def(名称, r,g,b, 自发光, 光泽度) */
function def(name, r, g, b, em = 0, gloss = 0.06) {
  const i = PALETTE.length + 1;         // 0 = 空
  PALETTE.push([r, g, b, em, gloss]);
  C[name] = i;
  return i;
}
const GLOSS_TILE = 0.62, GLOSS_GOLD = 0.75, GLOSS_STONE = 0.16, GLOSS_METAL = 0.45;

/* --- 琉璃瓦（黄）--- */
def('tileA', 232, 176, 38, 0, GLOSS_TILE);      // 瓦垄亮
def('tileB', 205, 148, 26, 0, GLOSS_TILE);      // 瓦垄暗
def('tileC', 246, 202, 74, 0, GLOSS_TILE);      // 高光垄（脊侧）
def('ridge', 168, 118, 22, 0, GLOSS_TILE);      // 正脊/垂脊
def('ridgeHi', 250, 214, 96, 0, GLOSS_GOLD);    // 脊上金饰
def('eaveEnd', 176, 126, 30, 0, GLOSS_TILE);    // 檐口瓦头
/* --- 绿琉璃 / 黑琉璃（文渊阁、皇子居所）--- */
def('tileGA', 46, 108, 66, 0, GLOSS_TILE);
def('tileGB', 32, 84, 52, 0, GLOSS_TILE);
def('tileKA', 48, 48, 56, 0, GLOSS_TILE);
def('tileKB', 34, 34, 42, 0, GLOSS_TILE);
/* --- 墙体 --- */
def('wallRed', 168, 58, 44, 0, 0.10);     // 宫墙朱红
def('wallRedD', 138, 44, 34);    // 阴面
def('wallRedL', 190, 74, 56);
def('cityWall', 150, 56, 42);    // 城墙（略深）
def('cityWallD', 122, 44, 34);
def('plaster', 214, 205, 186);   // 白灰墙
/* --- 汉白玉 / 石作 --- */
def('marble', 224, 219, 205, 0, GLOSS_STONE);
def('marbleD', 198, 192, 176, 0, GLOSS_STONE);
def('marbleS', 172, 166, 152, 0, GLOSS_STONE);   // 阴/缝
def('stone', 124, 119, 108);     // 台基条石
def('brickGray', 104, 99, 90); // 地砖
def('brickGrayD', 90, 86, 78);
def('brickDark', 84, 80, 73);
def('goldBrick', 122, 112, 96);  // 殿内金砖
/* --- 木作 / 彩画 --- */
def('columnRed', 158, 47, 35, 0, 0.22);   // 檐柱（油饰）
def('columnRedD', 128, 38, 28);
def('doorRed', 142, 42, 32, 0, 0.22);
def('doorWood', 122, 62, 36);
def('paintGreen', 42, 104, 76);  // 青绿彩画
def('paintBlue', 34, 78, 126);
def('paintWhite', 226, 220, 202);
def('gold', 214, 164, 40, 0, GLOSS_GOLD);
def('goldBright', 244, 206, 88, 0, GLOSS_GOLD);
def('windowPaper', 226, 214, 176);
def('latticeRed', 150, 46, 34);
def('beamDark', 78, 44, 30);
def('gableWood', 196, 168, 120);  // 山花
/* --- 金属 / 陈设 --- */
def('bronze', 108, 92, 56, 0, GLOSS_METAL);
def('bronzeD', 84, 70, 44, 0, GLOSS_METAL);
def('patina', 74, 104, 82, 0, GLOSS_METAL*0.6);
/* --- 自然 --- */
def('water', 52, 96, 112);
def('waterD', 36, 72, 88);
def('grass', 78, 108, 52);
def('grassD', 62, 88, 42);
def('pine', 44, 74, 46);
def('pineD', 32, 56, 36);
def('leaf', 82, 116, 54);
def('leafD', 62, 94, 44);
def('trunk', 88, 62, 40);
def('rock', 116, 110, 100);
def('rockD', 94, 90, 82);
def('soil', 138, 118, 88);
def('sand', 176, 160, 128);
def('snow', 240, 242, 246, 0, 0.30);
/* --- 其它 --- */
def('lantern', 220, 120, 70, 0.55);
def('glassDark', 60, 62, 70);
def('flagRed', 190, 40, 34);
def('bannerYellow', 226, 188, 60);
def('flowerRed', 196, 76, 78);
def('flowerPink', 214, 140, 150);

/* 地面材质表（供 Ground 使用） */
const GROUND_MATS = [
  null,
  { color: C.brickGray, name: '砖石广场' },       // 1
  { color: C.brickGrayD, name: '青砖甬路' },      // 2
  { color: C.soil, name: '素土' },                // 3
  { color: C.grass, name: '草地' },               // 4
  { color: C.water, water: true, name: '水面' },  // 5
  { color: C.marbleD, name: '白石台面' },         // 6
  { color: C.brickDark, name: '河底' },           // 7
  { color: C.sand, name: '沙石路' },              // 8
  { color: C.grassD, name: '林地' },              // 9
  { color: C.goldBrick, name: '金砖地面' },       // 10
  { color: C.stone, name: '石板路' },             // 11
];
const GM = { plaza: 1, path: 2, soil: 3, grass: 4, water: 5, stoneTop: 6, riverbed: 7, sand: 8, wood: 9, hall: 10, slab: 11 };

window.PALETTE = PALETTE; window.C = C; window.GROUND_MATS = GROUND_MATS; window.GM = GM;
