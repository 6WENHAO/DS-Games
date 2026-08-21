/* =========================================================================
 * GREENFALL · mods/example-mod.js —— 拓展示范
 *
 * 这个文件演示了"自由拓展"的全部接口。它本身是一个真实可玩的小模组：
 *   · 新增 1 张贴图、1 个方块、3 个物品、3 条配方、1 个科技解锁
 *   · 新增 1 处定制地标 + 1 种程序化小据点
 *   · 扩展战利品表
 *   · 挂事件钩子（击杀、破坏方块、每日）
 *
 * 想关掉它：把 index.html 里这一行 <script src="mods/example-mod.js"></script> 删掉。
 * 想自己写：复制这个文件改名，然后在 index.html 里加一行 script 即可。
 * 注意：所有"注册"类调用必须发生在 GF.boot() 之前（也就是脚本加载阶段）。
 * ======================================================================= */
(function (GF) {
  'use strict';

  GF.registerMod({
    name: 'example-mod',
    version: '1.0.0',

    /* ---------------- 加载期：注册内容 ---------------- */
    setup(GF) {
      const B = GF.Blocks, I = GF.Items, R = GF.Recipes, A = GF.Atlas, L = GF.Landmarks;

      /* 1) 贴图：程序化画一张"苔绿信标"的面 */
      A.addTile('beacon_side', (P) => {
        P.bg('#2a3a2c');
        P.frame('#1a241c', 2);
        P.streaks('#7ad86a', 6, 0.45);
        for (let i = 0; i < 4; i++) P.px(6, 5 + i * 7, 20, 3, i % 2 ? '#4a8a3a' : '#8fe06a');
      });
      A.addTile('beacon_top', (P) => {
        P.bg('#1a241c');
        P.blobs('#8fe06a', 8, 2, 6, 0.8);
        P.px(13, 13, 6, 6, '#d8ffb0');
      });

      /* 2) 方块：苔绿信标 —— 会发光，可作为营地标记 */
      B.define('mod_beacon', {
        name: '苔绿信标',
        tex: { top: 'beacon_top', bottom: 'beacon_side', side: 'beacon_side' },
        hard: 3.0, tool: 'pry', tier: 1, light: 14, step: 'metal',
        drops: [B.drop('mod_beacon_item')],
        desc: '柔和的绿光。奇怪的是，游荡者似乎不喜欢它。',
      });

      /* 3) 物品 */
      I.define('mod_beacon_item', '苔绿信标', 'build', 4, 4,
        '插在地上就会亮。夜里能找到回家的路。', { place: 'mod_beacon' });
      I.define('mod_moss_bread', '苔藓面包', 'food', 0.35, 12,
        '难吃，但绝对不会坏。', { food: { cal: 26, water: 4, heal: 1 } });
      I.define('schem_mod_beacon', '图纸：生物荧光', 'key', 0.05, 1,
        '把荧光苔的冷光稳定下来。', { schematic: 'biolume' });

      /* 4) 科技解锁项 + 配方 */
      R.defineUnlock('biolume', '生物荧光');
      R.define('mod_beacon_item', 1,
        [['glow_moss_clump', 8], ['glass_item', 2], ['sheet_metal', 2], ['wire', 2]],
        'workbench', 12, { unlock: 'biolume' });
      R.define('mod_moss_bread', 2, [['flour', 2], ['moss', 6], ['water_clean_bottle', 1]],
        'fire', 14, { needItem: 'pan', fuel: 1 });
      R.define('glow_moss_clump', 3, [['moss', 4], ['spore_sample', 1]], 'chem', 18);

      /* 5) 战利品表扩展：所有工具箱都可能出这份图纸 */
      L.addLoot('tools', [{ item: 'schem_mod_beacon', w: 2, min: 1, max: 1 }]);

      /* 6) 定制地标：荧光菌环（用内置建造器拼） */
      L.addLandmark({
        key: 'mod_ring', name: '荧光菌环', x: -520, z: -140, r: 44,
        icon: '✹', noVeg: true,
        desc: '一圈发光的菌柱围着中央的信标。有人在这里活过很久。',
        build(b) {
          const gy = b.ground(b.x, b.z);
          // 环形菌柱
          for (let a = 0; a < 360; a += 12) {
            const px = b.x + Math.round(Math.cos(a * 0.01745) * 16);
            const pz = b.z + Math.round(Math.sin(a * 0.01745) * 16);
            const g2 = b.ground(px, pz);
            b.set(px, g2 + 1, pz, b.B.spore_stalk);
            if ((a / 12) % 3 === 0) b.set(px, g2 + 1, pz, b.B.glow_moss);
          }
          // 中央平台 + 信标 + 补给
          b.forXZ(b.x - 5, b.z - 5, b.x + 5, b.z + 5, (px, pz) => {
            b.set(px, gy, pz, b.B.cobblestone);
          });
          b.set(b.x, gy + 1, b.z, b.B.mod_beacon);
          b.set(b.x + 2, gy + 1, b.z, b.B.workbench);
          b.set(b.x - 2, gy + 1, b.z, b.B.chest);
          b.loot(b.x, gy + 1, b.z + 3, 'crate_supply', 'supply', ['schem_mod_beacon', 'glow_moss_clump']);
          b.loot(b.x + 3, gy + 1, b.z - 3, 'backpack_drop', 'survivor');
          GF.Landmarks.gen.camp(b, b.x + 8, b.z + 8, 5, { table: 'survivor' });
        },
      });

      /* 7) 程序化小据点：野外偶尔出现的"发光树桩" */
      L.addPOI({
        key: 'mod_glowstump', w: 7,
        build(b, x, z, rnd) {
          const gy = b.ground(x, z);
          b.part(x - 3, z - 3, x + 3, z + 3, () => {
            b.fill(x - 1, gy + 1, z - 1, x + 1, gy + 2, z + 1, b.B.log_dead);
            b.set(x, gy + 3, z, b.B.glow_moss);
            for (let i = 0; i < 5; i++) {
              const a = rnd() * 6.283;
              b.set(x + Math.round(Math.cos(a) * 2), gy + 1, z + Math.round(Math.sin(a) * 2), b.B.mushroom_brown);
            }
            if (rnd() < 0.45) b.loot(x + 2, gy + 1, z + 2, 'suitcase', 'survivor');
          });
        },
      });
    },

    /* ---------------- 运行期：挂钩子 ---------------- */
    ready(game, GF) {
      // 信标附近的僵尸会失去兴趣
      GF.bus.on('block:placed', (p) => {
        if (p.block.key !== 'mod_beacon') return;
        game.ui.toast('信标亮了起来。周围安静了一些。', 'good');
        for (const e of game.ents.list) {
          if (Math.hypot(e.x - p.x, e.z - p.z) < 14 && e.type.startsWith('zombie')) {
            e.state = 'idle'; e.alertT = 0;
          }
        }
      });

      // 击杀苔壳者掉落荧光苔团
      GF.bus.on('entity:die', (p) => {
        if (p.e.type === 'zombie_husk') {
          game.inv.add('glow_moss_clump', 1 + Math.floor(Math.random() * 2));
          game.ui.toast('苔壳里滚出一团荧光苔。');
        }
      });

      // 每 5 天给一句提示（示范"守护循环"式的周期逻辑）
      GF.bus.on('day:new', (d) => {
        if (d % 5 === 0) game.ui.toast('【模组】第 ' + d + ' 天了。信标要是还亮着，就说明你赢了一点。');
      });

      console.log('[example-mod] 已加载：方块 ' + GF.Blocks.count() + ' 物品 ' + GF.Items.count() + ' 配方 ' + GF.Recipes.count());
    },
  });
})(globalThis.GF = globalThis.GF || {});
