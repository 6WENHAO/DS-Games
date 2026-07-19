/* ============================================================
 * BLOCKROOMS - blocks.js
 * 方块 / 物品 / 合成配方定义
 * ============================================================ */
(function () {
  'use strict';
  const B = {};
  window.BRBlocks = B;

  /* ---------------- 方块 ID ---------------- */
  B.AIR = 0;
  B.WALL = 1;        // 黄色壁纸墙
  B.STUD = 2;        // 破墙露木
  B.CARPET = 3;      // 地毯
  B.WETCARPET = 4;   // 潮湿地毯
  B.CEIL = 5;        // 吊顶
  B.LIGHT = 6;       // 荧光灯
  B.MOLD = 7;        // 霉斑墙
  B.OLDWOOD = 8;     // 旧木
  B.PLANKS = 9;      // 木板
  B.CRAFT = 10;      // 工作台
  B.CONCRETE = 11;   // 混凝土墙
  B.PILLAR = 12;     // 柱子
  B.FLOOR1 = 13;     // L1 地面
  B.STRIPE = 14;     // L1 划线地面
  B.CEIL1 = 15;      // L1 顶
  B.PIPE = 16;       // 管道墙（掉金属管）
  B.CRATE = 17;      // 板条箱
  B.EXIT_B = 18;     // 出口门下
  B.EXIT_T = 19;     // 出口门上
  B.SIGN_N = 20; B.SIGN_E = 21; B.SIGN_S = 22; B.SIGN_W = 23;
  B.LAMP = 24;       // 灯笼（光源）
  B.GLITCH = 25;     // 故障方块（noclip）

  /* ---------------- 方块属性 ----------------
   * hard: 徒手秒数; tool: 有效工具类别; mat: 音效材质;
   * drop: 物品 id (或函数); light: 发光强度; solid; unbreakable;
   * tiles: {top,bottom,side} 或 函数(x,y,z)->tiles
   */
  const D = {};
  B.defs = D;
  D[B.AIR] = { name: '空气', solid: false, transparent: true };
  D[B.WALL] = {
    name: '壁纸墙', hard: 1.6, tool: 'pick', mat: 'cloth', drop: 'wall', solid: true,
    tiles: (x, y, z) => {
      const r = B.hash(x, y * 7 + z * 13, 3);
      const t = r < 0.72 ? 'wallpaper0' : (r < 0.88 ? 'wallpaper1' : 'wallpaper2');
      return { top: t, bottom: t, side: t };
    }
  };
  D[B.STUD] = { name: '破损的墙', hard: 2.0, tool: 'pick', mat: 'wood', drop: 'old_wood', solid: true, tiles: { top: 'wallpaper0', bottom: 'wallpaper0', side: 'stud' } };
  D[B.CARPET] = { name: '潮湿的地毯', hard: 1.0, tool: 'pick', mat: 'cloth', drop: 'carpet', solid: true, tiles: { top: 'carpet0', bottom: 'carpet0', side: 'carpet0' } };
  D[B.WETCARPET] = { name: '浸水的地毯', hard: 1.0, tool: 'pick', mat: 'cloth', drop: 'carpet', solid: true, tiles: { top: 'carpet1', bottom: 'carpet1', side: 'carpet1' } };
  D[B.CEIL] = { name: '吊顶板', hard: 1.2, tool: 'pick', mat: 'stone', drop: 'ceiling', solid: true, tiles: { top: 'ceiling', bottom: 'ceiling', side: 'ceiling' } };
  D[B.LIGHT] = { name: '荧光灯', hard: 0.8, tool: 'pick', mat: 'glass', drop: 'light_tube', solid: true, light: 1.0, fullbright: true, tiles: { top: 'ceiling', bottom: 'light', side: 'ceiling' } };
  D[B.MOLD] = { name: '霉菌墙', hard: 0.9, tool: 'pick', mat: 'cloth', drop: null, solid: true, tiles: { top: 'mold', bottom: 'mold', side: 'mold' } };
  D[B.OLDWOOD] = { name: '旧木头', hard: 2.4, tool: 'axe_pick', mat: 'wood', drop: 'old_wood', solid: true, tiles: { top: 'old_wood', bottom: 'old_wood', side: 'old_wood' } };
  D[B.PLANKS] = { name: '木板', hard: 2.4, tool: 'axe_pick', mat: 'wood', drop: 'planks', solid: true, tiles: { top: 'planks', bottom: 'planks', side: 'planks' } };
  D[B.CRAFT] = { name: '工作台', hard: 2.4, tool: 'axe_pick', mat: 'wood', drop: 'craft', solid: true, interact: 'craft', tiles: { top: 'craft_top', bottom: 'planks', side: 'craft_side' } };
  D[B.CONCRETE] = { name: '混凝土', hard: 12, tool: 'pick', mat: 'stone', drop: 'concrete', needTool: true, solid: true, tiles: { top: 'concrete', bottom: 'concrete', side: 'concrete' } };
  D[B.PILLAR] = { name: '承重柱', hard: 15, tool: 'pick', mat: 'stone', drop: 'concrete', needTool: true, solid: true, tiles: { top: 'concrete', bottom: 'concrete', side: 'pillar' } };
  D[B.FLOOR1] = { name: '水泥地面', hard: 12, tool: 'pick', mat: 'stone', drop: 'concrete', needTool: true, solid: true, tiles: { top: 'floor1', bottom: 'floor1', side: 'floor1' } };
  D[B.STRIPE] = { name: '停车线', hard: 12, tool: 'pick', mat: 'stone', drop: 'concrete', needTool: true, solid: true, tiles: { top: 'floor1b', bottom: 'floor1', side: 'floor1' } };
  D[B.CEIL1] = { name: '管线吊顶', hard: 12, tool: 'pick', mat: 'stone', drop: 'concrete', needTool: true, solid: true, tiles: { top: 'ceiling1', bottom: 'ceiling1', side: 'ceiling1' } };
  D[B.PIPE] = { name: '管道', hard: 3.5, tool: 'pick', mat: 'stone', drop: 'metal_pipe', solid: true, tiles: { top: 'concrete', bottom: 'concrete', side: 'pipe' } };
  D[B.CRATE] = { name: '板条箱', hard: 1.4, tool: 'axe_pick', mat: 'wood', drop: 'LOOT', solid: true, tiles: { top: 'crate_top', bottom: 'crate_top', side: 'crate_side' } };
  D[B.EXIT_B] = { name: '出口大门', unbreakable: true, solid: true, mat: 'stone', interact: 'exit', light: 0.25, tiles: { top: 'concrete', bottom: 'concrete', side: 'exit_bottom' } };
  D[B.EXIT_T] = { name: '出口大门', unbreakable: true, solid: true, mat: 'stone', interact: 'exit', light: 0.6, fullbright: true, tiles: { top: 'concrete', bottom: 'concrete', side: 'exit_top' } };
  D[B.SIGN_N] = { name: '出口指示牌', hard: 4, tool: 'pick', mat: 'stone', drop: null, solid: true, fullbright: true, light: 0.25, tiles: { top: 'concrete', bottom: 'concrete', side: 'sign_n' } };
  D[B.SIGN_E] = Object.assign({}, D[B.SIGN_N], { tiles: { top: 'concrete', bottom: 'concrete', side: 'sign_e' } });
  D[B.SIGN_S] = Object.assign({}, D[B.SIGN_N], { tiles: { top: 'concrete', bottom: 'concrete', side: 'sign_s' } });
  D[B.SIGN_W] = Object.assign({}, D[B.SIGN_N], { tiles: { top: 'concrete', bottom: 'concrete', side: 'sign_w' } });
  D[B.LAMP] = { name: '油灯箱', hard: 1.0, tool: 'axe_pick', mat: 'wood', drop: 'lamp', solid: true, light: 0.95, fullbright: true, tiles: { top: 'lamp_top', bottom: 'lamp_top', side: 'lamp_side' } };
  D[B.GLITCH] = { name: '现实故障', unbreakable: true, solid: false, glitch: true, light: 0.35, tiles: { top: 'glitch0', bottom: 'glitch0', side: 'glitch0' } };

  B.hash = function (x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 144269504)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  /* ---------------- 物品 ----------------
   * block: 放置的方块 id; tool: {type, speed, dmg}; use: 使用行为; stack
   */
  const I = {};
  B.items = I;
  I.wall = { name: '壁纸块', block: B.WALL, stack: 64 };
  I.carpet = { name: '地毯块', block: B.CARPET, stack: 64 };
  I.ceiling = { name: '吊顶板', block: B.CEIL, stack: 64 };
  I.old_wood = { name: '旧木头', block: B.OLDWOOD, stack: 64, desc: '墙体内的干燥木料' };
  I.planks = { name: '木板', block: B.PLANKS, stack: 64 };
  I.craft = { name: '工作台', block: B.CRAFT, stack: 64, desc: '右键打开进行合成' };
  I.concrete = { name: '混凝土块', block: B.CONCRETE, stack: 64 };
  I.crate = { name: '板条箱', block: B.CRATE, stack: 64 };
  I.lamp = { name: '油灯箱', block: B.LAMP, stack: 64, desc: '放置后照亮黑暗' };
  I.stick = { name: '木棍', stack: 64 };
  I.light_tube = { name: '灯管', stack: 64, desc: '还在发着微光' };
  I.metal_pipe = { name: '金属管', stack: 64, desc: '沉重、冰冷' };
  I.battery = { name: '电池', stack: 64, desc: '手电筒的能源' };
  I.almond = { name: '杏仁水', stack: 16, use: 'drink', desc: '后室流浪者的圣水 +40理智' };
  I.bandage = { name: '绷带', stack: 16, use: 'heal', desc: '恢复 3♥' };
  I.wood_pick = { name: '木镐', stack: 1, tool: { type: 'pick', speed: 3.4, dmg: 3 } };
  I.wood_sword = { name: '木剑', stack: 1, tool: { type: 'sword', speed: 1.2, dmg: 5 } };
  I.pipe_pick = { name: '钢管镐', stack: 1, tool: { type: 'pick', speed: 7.5, dmg: 4 } };
  I.pipe_blade = { name: '钢管刀', stack: 1, tool: { type: 'sword', speed: 1.4, dmg: 8 } };
  I.flashlight = { name: '手电筒', stack: 1, use: 'flashlight', desc: '右键 或 F 开关' };

  /* ---------------- 板条箱战利品 ---------------- */
  B.crateLoot = function (rand) {
    const table = [
      ['almond', 1, 0.25],
      ['battery', 1, 0.2],
      ['bandage', 1, 0.18],
      ['light_tube', 1, 0.1],
      ['metal_pipe', 2, 0.12],
      ['planks', 3, 0.15]
    ];
    const drops = [];
    let r = rand();
    let acc = 0;
    for (const [id, n, p] of table) {
      acc += p;
      if (r < acc) { drops.push({ id, n: 1 + Math.floor(rand() * n) }); break; }
    }
    if (rand() < 0.35) drops.push({ id: 'planks', n: 1 });
    if (!drops.length) drops.push({ id: 'planks', n: 2 });
    return drops;
  };

  /* ---------------- 合成配方 ---------------- */
  B.recipes = [
    { id: 'planks', out: { id: 'planks', n: 4 }, cost: [['old_wood', 1]], table: false, tip: '基础建材' },
    { id: 'stick', out: { id: 'stick', n: 4 }, cost: [['planks', 2]], table: false, tip: '工具的柄' },
    { id: 'craft', out: { id: 'craft', n: 1 }, cost: [['planks', 4]], table: false, tip: '解锁更多配方' },
    { id: 'wood_pick', out: { id: 'wood_pick', n: 1 }, cost: [['planks', 3], ['stick', 2]], table: true, tip: '更快拆墙，可开采混凝土' },
    { id: 'wood_sword', out: { id: 'wood_sword', n: 1 }, cost: [['planks', 2], ['stick', 1]], table: true, tip: '防身武器' },
    { id: 'lamp', out: { id: 'lamp', n: 1 }, cost: [['stick', 2], ['light_tube', 1], ['planks', 1]], table: true, tip: '可放置光源，驱散黑暗' },
    { id: 'pipe_pick', out: { id: 'pipe_pick', n: 1 }, cost: [['metal_pipe', 3], ['stick', 2]], table: true, tip: '轻松粉碎混凝土' },
    { id: 'pipe_blade', out: { id: 'pipe_blade', n: 1 }, cost: [['metal_pipe', 2], ['stick', 1]], table: true, tip: '锋利的近战武器' },
    { id: 'flashlight', out: { id: 'flashlight', n: 1 }, cost: [['metal_pipe', 1], ['battery', 1], ['light_tube', 1]], table: true, tip: '照亮 Level 1 · 逼退微笑者' }
  ];

  /* ---------------- 破坏时间计算 ---------------- */
  B.breakTime = function (blockId, itemId) {
    const def = D[blockId];
    if (!def || def.unbreakable) return Infinity;
    let speed = 1;
    const it = itemId ? I[itemId] : null;
    if (it && it.tool) {
      const tt = it.tool.type;
      const need = def.tool || '';
      if (need === tt || (need === 'axe_pick' && (tt === 'pick' || tt === 'axe')) || need === 'pick' && tt === 'pick')
        speed = it.tool.speed;
      else speed = 1;
    }
    if (def.needTool && speed <= 1) return def.hard * 5; // 徒手挖混凝土极慢
    return def.hard / speed;
  };
  B.attackDamage = function (itemId) {
    const it = itemId ? I[itemId] : null;
    return (it && it.tool) ? it.tool.dmg : 1;
  };
})();
