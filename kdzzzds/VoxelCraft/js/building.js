/* building.js - 建筑结构定义与生成（配置驱动） */
const Building = (function () {
  'use strict';

  /* ---------- 方块 ID 别名 ---------- */
  const AIR = 0, DIRT = 2, STONE = 3, PLANKS_CHERRY = 31, BOOKSHELF = 49,
    CRAFT_TABLE = 50, GLOWSTONE = 48, QUARTZ = 61, GLASS = 63,
    WOOL_RED = 78, WOOL_DGRAY = 72, TALLGRASS = 80, FLOWER_YELLOW = 82;

  /* ================================================================
   * 配置：玻璃工作室 (Modern Glass Studio)
   * - 落地玻璃墙（北墙）= Phase 2 镜像面
   * - 南侧开放出入口，无缝连通外部世界
   * - 内部家具：书架墙、中央工作台、沙发、盆栽、天窗灯
   * ================================================================ */
  const STUDIO = {
    name: 'glass_studio',
    iw: 10,        // 室内净宽 X（东西）
    id: 8,         // 室内净深 Z（南北）
    ih: 4,         // 室内净高（地板到天花板之间的空气）

    floorId: PLANKS_CHERRY,
    wallId: QUARTZ,
    glassId: GLASS,
    ceilingId: QUARTZ,
    lightId: GLOWSTONE,

    /* 哪面墙是落地玻璃（镜像面）：north / east / south / west */
    mirrorWall: 'north',

    /* 出入口：哪面墙 + 开口宽度 + 从墙角偏移 */
    entrance: {
      wall: 'south',
      width: 3,
      offset: 4
    },

    /* 家具配置 */
    furniture: {

      /* 西墙书架墙：靠西墙、纵深 2 格、高 3 格、从 Z=2 到 Z=6 */
      bookshelfWall: {
        enabled: true,
        wall: 'west',
        depth: 2,
        height: 3,
        zStart: 2,
        zEnd: 6,
        blockId: BOOKSHELF
      },

      /* 中央工作台：3×2、靠东偏中 */
      workbench: {
        enabled: true,
        xStart: 4, xEnd: 7,   // 4,5,6 = 3 格宽
        zStart: 3, zEnd: 5,   // 3,4 = 2 格深
        blockId: CRAFT_TABLE
      },

      /* 东墙沙发：座位 + 靠背，羊毛 */
      sofa: {
        enabled: true,
        wall: 'east',
        zStart: 2, zEnd: 5,   // 3 格长
        seatId: WOOL_RED,
        backId: WOOL_DGRAY
      },

      /* 东北角盆栽 */
      plant: {
        enabled: true,
        x: 8, z: 7,           // 室内坐标（靠东北角）
        potId: DIRT,
        plantId: FLOWER_YELLOW
      },

      /* 天花板灯 */
      ceilingLights: {
        enabled: true,
        /* 在格子 (3,3), (3,6), (7,3), (7,6) 四个位置嵌入天花板 */
        positions: [
          { x: 3, z: 3 },
          { x: 3, z: 6 },
          { x: 7, z: 3 },
          { x: 7, z: 6 }
        ]
      }
    }
  };

  /* ================================================================
   * 核心生成器
   * ================================================================
   * 坐标约定：
   *   bx, by, bz = 建筑世界原点（西南角、地面高度）
   *   建筑地板层在 by+1，墙从 by+2 开始，天花板在 by+7
   *   室内 X: 1..iw, 室内 Z: 1..id
   *   室内 Y: 2..ih+1  （相对 by）
   */

  function generateBlocks(cfg, bx, by, bz) {
    const blocks = [];   // [{x, y, z, id}]
    const iw = cfg.iw, id = cfg.id, ih = cfg.ih;

    /* 总的墙体外边界 */
    const ww = iw + 1;   // 外墙最大 X（含墙厚 1）
    const wd = id + 1;   // 外墙最大 Z（含墙厚 1）
    const flY = by + 1;  // 地板层 Y
    const clY = by + 1 + ih + 1;  // 天花板层 Y（地板 + 空气层 + 天花板）

    function set(x, y, z, id) {
      blocks.push({ x: x, y: y, z: z, id: id });
    }

    /* ---- 地板 ---- */
    for (let x = 1; x <= iw; x++)
      for (let z = 1; z <= id; z++)
        set(bx + x, flY, bz + z, cfg.floorId);

    /* ---- 墙 ---- */
    for (let y = flY + 1; y < clY; y++) {
      /* 北墙 */
      for (let x = 1; x <= iw; x++) {
        if (cfg.mirrorWall === 'north') set(bx + x, y, bz + wd, cfg.glassId);
        else set(bx + x, y, bz + wd, cfg.wallId);
      }
      /* 南墙（含出入口缺口） */
      for (let x = 1; x <= iw; x++) {
        if (cfg.entrance.wall === 'south') {
          const off = cfg.entrance.offset;
          if (x >= off && x < off + cfg.entrance.width) continue; // 缺口
        }
        set(bx + x, y, bz + 1, cfg.wallId);
      }
      /* 东墙 */
      for (let z = 1; z <= id; z++) {
        if (cfg.mirrorWall === 'east') set(bx + ww, y, bz + z, cfg.glassId);
        else set(bx + ww, y, bz + z, cfg.wallId);
      }
      /* 西墙 */
      for (let z = 1; z <= id; z++) {
        if (cfg.mirrorWall === 'west') set(bx + 1, y, bz + z, cfg.glassId);
        else set(bx + 1, y, bz + z, cfg.wallId);
      }
    }

    /* ---- 天花板 ---- */
    for (let x = 0; x <= ww; x++)
      for (let z = 0; z <= wd; z++)
        set(bx + x, clY, bz + z, cfg.ceilingId);

    /* ---- 天花板灯 ---- */
    const lights = cfg.furniture.ceilingLights;
    if (lights && lights.enabled) {
      for (let i = 0; i < lights.positions.length; i++) {
        const p = lights.positions[i];
        set(bx + p.x, clY, bz + p.z, cfg.lightId);
      }
    }

    /* ---- 家具 ---- */
    addFurniture(cfg, bx, by, bz, flY, set);

    return blocks;
  }

  function addFurniture(cfg, bx, by, bz, flY, set) {
    const iw = cfg.iw, id = cfg.id;

    /* 书架墙 */
    const bw = cfg.furniture.bookshelfWall;
    if (bw && bw.enabled) {
      let wallX;
      if (bw.wall === 'west') wallX = 1;
      else if (bw.wall === 'east') wallX = iw + 1 - bw.depth;
      else wallX = 1;
      for (let row = 0; row < bw.depth; row++) {
        for (let z = bw.zStart; z <= bw.zEnd; z++) {
          for (let y = 0; y < bw.height; y++) {
            set(bx + wallX + row, flY + 1 + y, bz + z, bw.blockId);
          }
        }
      }
    }

    /* 中央工作台 */
    const wb = cfg.furniture.workbench;
    if (wb && wb.enabled) {
      for (let x = wb.xStart; x < wb.xEnd; x++)
        for (let z = wb.zStart; z < wb.zEnd; z++)
          set(bx + x, flY + 1, bz + z, wb.blockId);
    }

    /* 沙发 */
    const sofa = cfg.furniture.sofa;
    if (sofa && sofa.enabled) {
      let seatX, backX;
      if (sofa.wall === 'east') { seatX = iw; backX = iw + 1; }
      else if (sofa.wall === 'west') { seatX = 2; backX = 1; }
      else { seatX = iw; backX = iw + 1; }
      for (let z = sofa.zStart; z <= sofa.zEnd; z++) {
        set(bx + seatX, flY + 1, bz + z, sofa.seatId);
        set(bx + backX, flY + 1, bz + z, sofa.backId);
      }
    }

    /* 盆栽 */
    const plant = cfg.furniture.plant;
    if (plant && plant.enabled) {
      set(bx + plant.x, flY + 1, bz + plant.z, plant.potId);
      set(bx + plant.x, flY + 2, bz + plant.z, plant.plantId);
    }
  }

  /* ================================================================
   * 对外 API
   * ================================================================ */
  return {
    STUDIO: STUDIO,

    /**
     * 根据配置生成方块列表
     * @returns [{x, y, z, id}]
     */
    generate: function (cfg, bx, by, bz) {
      return generateBlocks(cfg, bx, by, bz);
    }
  };
})();
