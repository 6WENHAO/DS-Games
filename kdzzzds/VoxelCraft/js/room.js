/* room.js - 室内房间结构（配置数据驱动，batch stamp） */
const RoomBuilder = (function () {
  'use strict';

  const ID = {
    AIR: 0,
    W_PLANKS: 29,     // 杉木木板
    WALL_BRICK: 44,    // 红砖块
    FLOOR: 31,         // 樱花木板
    CEILING: 61,       // 白玉块
    GLASS: 63,         // 玻璃
    BOOKSHELF: 49,
    CRAFT: 50,
    FURNACE: 51,
    GLOWSTONE: 48,
    MOSSY: 46,
    CHEST: 52,
    PRISMARINE: 62,
    WOOL_WHITE: 64,
    WOOL_RED: 78,
    WOOL_GRAY: 72,
    FLOWER_RED: 81,
    FLOWER_BLUE: 83,
    TALLGRASS: 80,
    STONE: 3,
    COBBLE: 4,
    BRICK: 44,
    PLANKS_FIR: 29,
    PLANKS_CHERRY: 31,
    TERRA_0: 37,
    HAY: 58,
    TNT: 53,
    SPONGE: 54,
    QUARTZ: 61,
    MELON: 56,
    PUMPKIN: 55,
  };

  /* ================================================================
   * 房间布局配置
   * 坐标系：原点 (ox, oy, oz) 为房间西北角，oy = 地板层 Y
   * X 向东，Z 向南，Y 向上
   * 墙壁厚 1，地板在 oy，天花板在 oy+sizeY+1
   * 内部空气：oy+1 .. oy+sizeY
   * ================================================================ */
  const ROOM_CONFIG = {
    sizeX: 14,         // 东西宽（含墙壁）
    sizeZ: 10,         // 南北深（含墙壁）
    sizeY: 6,          // 墙高（不含地板/天花板层）

    /* 全幅落地玻璃墙：无框，从地到顶 */
    windowWall: {
      wall: 'south',     // 哪面墙是玻璃镜面
    },

    /* 开放出入口：无门无缝 */
    doorway: {
      wall: 'north',     // 出入口所在墙
      width: 3,          // 开口宽度
      xOffset: 5,        // 从西侧墙起点偏移（0=sx/2-width/2 大致居中）
      height: 3,         // 开口高度（自地板以上格数）
    },

    /* 墙壁材质 */
    wallMaterial: ID.QUARTZ,

    floor: {
      material: ID.PLANKS_CHERRY,
      rug: { xRange: [4, 9], zRange: [3, 6], material: ID.WOOL_RED }
    },

    ceiling: {
      material: ID.QUARTZ,
      lights: [
        { x: 3, z: 3 },
        { x: 10, z: 3 },
        { x: 3, z: 6 },
        { x: 10, z: 6 },
      ]
    },

    /* 家具（避开北墙 X=5~7 出入口） */
    furniture: [
      { type: 'fireplace', x: 2, z: 1, facing: 'north' },
      { type: 'table', x: 7, z: 4 },
      { type: 'bookshelf_wall', x: 1, z: 3, height: 3, wall: 'west' },
      { type: 'bookshelf_wall', x: 1, z: 5, height: 3, wall: 'west' },
      { type: 'single_block', x: 12, z: 2, block: ID.CRAFT, yOff: 1 },
      { type: 'single_block', x: 12, z: 3, block: ID.CHEST, yOff: 1 },
      { type: 'potted_plant', x: 3, z: 8, plant: ID.FLOWER_BLUE },
      { type: 'potted_plant', x: 11, z: 8, plant: ID.FLOWER_RED },
      { type: 'single_block', x: 12, z: 6, block: ID.FURNACE, yOff: 1 },
      { type: 'sofa', x: 12, z: 4 },
    ]
  };

  /* ================================================================
   * 构建：先收集全部方块坐标到数组，最后 batch stamp
   * ================================================================ */
  function buildRoom(world, ox, oy, oz) {
    const C = ROOM_CONFIG;
    const sx = C.sizeX, sy = C.sizeY, sz = C.sizeZ;
    const blocks = [];

    function set(x, y, z, id) { blocks.push({ x: x, y: y, z: z, id: id }); }

    /* ---- 1. 清空房间包围盒（移除原有地形/植被） ---- */
    for (let x = ox; x <= ox + sx; x++)
      for (let z = oz; z <= oz + sz; z++)
        for (let y = oy + 1; y <= oy + sy + 5; y++)
          set(x, y, z, ID.AIR);

    /* ---- 2. 地板 ---- */
    for (let x = ox; x <= ox + sx; x++)
      for (let z = oz; z <= oz + sz; z++)
        set(x, oy, z, C.floor.material);
    // 地毯
    const rug = C.floor.rug;
    for (let x = ox + rug.xRange[0]; x <= ox + rug.xRange[1]; x++)
      for (let z = oz + rug.zRange[0]; z <= oz + rug.zRange[1]; z++)
        set(x, oy, z, rug.material);

    /* ---- 3. 墙壁 ---- */
    const doorX0 = Math.max(1, C.doorway.xOffset || Math.floor((sx - C.doorway.width) / 2));
    const doorX1 = doorX0 + C.doorway.width;
    const wallMat = C.wallMaterial;

    for (let wy = 1; wy <= sy; wy++) {
      // 北墙（含出入口）
      if (C.doorway.wall === 'north') {
        for (let x = 0; x <= sx; x++) {
          if (x >= doorX0 && x < doorX1 && wy <= C.doorway.height) continue;
          set(ox + x, oy + wy, oz, wallMat);
        }
      } else {
        for (let x = 0; x <= sx; x++) set(ox + x, oy + wy, oz, wallMat);
      }
      // 南墙（玻璃或实体）
      for (let x = 0; x <= sx; x++) {
        set(ox + x, oy + wy, oz + sz,
          C.windowWall.wall === 'south' ? ID.GLASS : wallMat);
      }
      // 西墙
      for (let z = 1; z < sz; z++) set(ox, oy + wy, oz + z, wallMat);
      // 东墙
      for (let z = 1; z < sz; z++) set(ox + sx, oy + wy, oz + z, wallMat);

      // 东/西墙替代：如果 door/window 在其他墙
      if (C.doorway.wall === 'west') {
        for (let z = 1; z < sz; z++) {
          set(ox, oy + wy, oz + z, (z >= doorX0 && z < doorX1 && wy <= C.doorway.height) ? ID.AIR : wallMat);
        }
      }
      if (C.doorway.wall === 'east') {
        for (let z = 1; z < sz; z++) {
          set(ox + sx, oy + wy, oz + z, (z >= doorX0 && z < doorX1 && wy <= C.doorway.height) ? ID.AIR : wallMat);
        }
      }
      if (C.windowWall.wall === 'west') {
        for (let z = 0; z <= sz; z++) set(ox, oy + wy, oz + z, ID.GLASS);
      }
      if (C.windowWall.wall === 'east') {
        for (let z = 0; z <= sz; z++) set(ox + sx, oy + wy, oz + z, ID.GLASS);
      }
    }

    /* ---- 4. 天花板 ---- */
    for (let x = ox; x <= ox + sx; x++)
      for (let z = oz; z <= oz + sz; z++)
        set(x, oy + sy + 1, z, C.ceiling.material);
    // 天花板灯
    C.ceiling.lights.forEach(function (l) {
      set(ox + l.x, oy + sy + 1, oz + l.z, ID.GLOWSTONE);
    });

    /* ---- 5. 家具 ---- */
    C.furniture.forEach(function (f) {
      switch (f.type) {
        case 'fireplace':
          buildFireplace(ox, oy, oz, f.x, f.z, f.facing, set);
          break;
        case 'table':
          buildTable(ox, oy, oz, f.x, f.z, set);
          break;
        case 'bookshelf_wall':
          buildBookshelfWall(ox, oy, oz, f.x, f.z, f.height, f.wall, set);
          break;
        case 'potted_plant':
          set(ox + f.x, oy + 1, oz + f.z, ID.TERRA_0);
          set(ox + f.x, oy + 2, oz + f.z, f.plant);
          break;
        case 'sofa':
          buildSofa(ox, oy, oz, f.x, f.z, set);
          break;
        case 'single_block':
          set(ox + f.x, oy + (f.yOff || 1), oz + f.z, f.block);
          break;
      }
    });

    /* ---- 6. Batch stamp ---- */
    world.stampBlocks(blocks);
    return blocks.length;
  }

  /* ---- 家具构建器 ---- */
  function buildFireplace(ox, oy, oz, fx, fz, facing, set) {
    const bx = ox + fx, bz = oz + fz;
    set(bx - 1, oy + 1, bz, ID.BRICK); set(bx, oy + 1, bz, ID.BRICK); set(bx + 1, oy + 1, bz, ID.BRICK);
    set(bx - 1, oy + 2, bz, ID.BRICK); set(bx, oy + 2, bz, ID.BRICK); set(bx + 1, oy + 2, bz, ID.BRICK);
    set(bx, oy + 3, bz, ID.BRICK); set(bx - 1, oy + 3, bz, ID.MOSSY); set(bx + 1, oy + 3, bz, ID.MOSSY);
    set(bx, oy + 4, bz, ID.BRICK); set(bx - 1, oy + 4, bz, ID.STONE); set(bx + 1, oy + 4, bz, ID.STONE);
    set(bx, oy + 1, bz + 1, ID.GLOWSTONE);
  }

  function buildTable(ox, oy, oz, tx, tz, set) {
    const bx = ox + tx, bz = oz + tz;
    set(bx - 1, oy + 1, bz - 1, ID.PLANKS_FIR);
    set(bx + 1, oy + 1, bz - 1, ID.PLANKS_FIR);
    set(bx - 1, oy + 1, bz + 1, ID.PLANKS_FIR);
    set(bx + 1, oy + 1, bz + 1, ID.PLANKS_FIR);
    for (let x = bx - 1; x <= bx + 1; x++)
      for (let z = bz - 1; z <= bz + 1; z++)
        set(x, oy + 2, z, ID.PLANKS_CHERRY);
  }

  function buildBookshelfWall(ox, oy, oz, sx, sz, h, wall, set) {
    let bx, bz;
    if (wall === 'west') { bx = ox + 1; bz = oz + sz; }
    else if (wall === 'east') { bx = ox + ROOM_CONFIG.sizeX - 1; bz = oz + sz; }
    else { bx = ox + sx; bz = oz + sz; }
    for (let dy = 1; dy <= h; dy++) set(bx, oy + dy, bz, ID.BOOKSHELF);
  }

  function buildSofa(ox, oy, oz, sx, sz, set) {
    const bx = ox + sx, bz = oz + sz;
    set(bx, oy + 1, bz, ID.WOOL_RED);
    set(bx, oy + 1, bz + 1, ID.WOOL_RED);
    set(bx + 1, oy + 1, bz, ID.PLANKS_CHERRY);
    set(bx + 1, oy + 1, bz + 1, ID.PLANKS_CHERRY);
  }

  return {
    ID: ID,
    ROOM_CONFIG: ROOM_CONFIG,
    buildRoom: buildRoom,
  };
})();
