/* =========================================================================
 * GREENFALL · structures.js —— 定制地标 · 程序化 POI · 战利品表
 *
 * 32 处手工坐标地标 + 无限程序化小据点。
 * 所有建造器都是"位置纯函数"：同一世界坐标无论由哪个区块生成，结果一致。
 * ======================================================================= */
(function (GF) {
  'use strict';

  const U = GF.util;
  const CH = 16, SEA = GF.SEA;
  const ID = () => GF.Blocks.ID;

  /* =================================================== 战利品表 */
  const T = (rolls, entries) => ({ rolls, entries });
  const e = (item, w, min, max) => ({ item, w, min: min || 1, max: max || min || 1 });

  const tables = {
    /* 民居 */
    civilian: T([1, 3], [
      e('cloth_scrap', 10, 1, 3), e('plastic', 8, 1, 3), e('paper', 6, 1, 4), e('scrap_metal', 6, 1, 2),
      e('can_beans', 5), e('can_peach', 4), e('crackers', 4), e('bottle_empty', 5, 1, 2),
      e('matches', 3), e('lighter', 2), e('rag_bandage', 4, 1, 2), e('painkiller', 3, 1, 2),
      e('shirt_worn', 3), e('pants_jeans', 3), e('boots_sneaker', 2), e('cap_cloth', 2),
      e('book', 3), e('trinket_photo', 3), e('coin_stash', 3), e('watch_broken', 2),
      e('knife_hunting', 1), e('screwdriver', 2), e('sewing_kit', 2), e('candle_none', 0),
    ]),
    /* 厨房冰箱 */
    fridge: T([1, 3], [
      e('can_beans', 8), e('can_meat', 6), e('can_peach', 6), e('can_soup', 5), e('milk_powder', 4),
      e('water_bottled', 8, 1, 2), e('soda', 6, 1, 2), e('chocolate', 4), e('honey', 2),
      e('meat_raw', 3), e('egg', 4, 1, 3), e('cabbage', 3), e('carrot', 3, 1, 2), e('salt', 4, 1, 2),
      e('can_dogfood', 4), e('booze', 2),
    ]),
    /* 商店货架 */
    store: T([2, 4], [
      e('crackers', 8, 1, 2), e('chips', 8), e('energy_bar', 6, 1, 2), e('chocolate', 6),
      e('water_bottled', 8, 1, 3), e('soda', 7, 1, 2), e('energy_drink', 4), e('can_beans', 6),
      e('salt', 4), e('soap', 4), e('matches', 4), e('battery', 4, 1, 2), e('plastic', 6, 2, 4),
      e('bandage_sterile', 3, 1, 2), e('flashlight', 2), e('rope', 2), e('bucket_empty', 2),
      e('seed_carrot', 3), e('seed_tomato', 3),
    ]),
    register: T([1, 2], [
      e('coin_stash', 10, 1, 3), e('paper', 6, 1, 3), e('lighter', 4), e('matches', 4), e('keycard_blue', 2),
    ]),
    vending: T([1, 3], [
      e('soda', 12, 1, 2), e('chips', 10), e('chocolate', 8), e('energy_drink', 5), e('water_bottled', 7),
      e('crackers', 6), e('coin_stash', 4),
    ]),
    /* 办公 / 学校 */
    office: T([1, 3], [
      e('paper', 12, 2, 5), e('book', 6), e('electronics', 4), e('battery', 4), e('screws', 6, 2, 6),
      e('keycard_blue', 3), e('lighter', 3), e('coffee', 3), e('scissors_none', 0), e('screwdriver', 3),
      e('note_1', 1), e('note_2', 1), e('note_3', 1), e('schem_water', 1), e('schem_farm', 1),
    ]),
    /* 医疗 */
    medical: T([2, 4], [
      e('bandage_sterile', 10, 1, 3), e('antiseptic', 8, 1, 2), e('painkiller', 8, 1, 3),
      e('antibiotics', 4), e('antipyretic', 6, 1, 2), e('vitamin', 6, 1, 3), e('suture_kit', 4),
      e('splint', 3), e('tourniquet', 4), e('alcohol', 5), e('adrenaline', 2), e('serum_green', 1),
      e('mask_filter', 4, 1, 2), e('respirator', 2), e('schem_chem', 1), e('cloth', 5, 1, 3),
    ]),
    /* 军械 */
    ammo: T([2, 4], [
      e('ammo_9mm', 12, 6, 18), e('ammo_shell', 8, 3, 8), e('ammo_762', 6, 3, 10), e('ammo_357', 5, 4, 10),
      e('gunpowder', 6, 2, 5), e('pistol_9mm', 3), e('shotgun_pump', 2), e('rifle_hunting', 1),
      e('smg_9mm', 1), e('revolver_357', 2), e('grenade_frag', 2), e('smoke_bomb', 3),
      e('suppressor', 1), e('scope_optic', 1), e('schem_gun', 2), e('helmet_riot', 2), e('vest_kevlar', 1),
      e('dogtag', 5), e('keycard_yellow', 2),
    ]),
    /* 工具箱 */
    tools: T([2, 3], [
      e('nails', 10, 8, 24), e('screws', 8, 6, 20), e('wire', 8, 2, 6), e('scrap_metal', 8, 2, 5),
      e('hammer_claw', 5), e('crowbar', 4), e('saw_hand', 4), e('wirecutter', 3), e('pliers', 4),
      e('screwdriver', 6), e('whetstone', 3), e('repair_kit', 4, 1, 2), e('gear', 4, 1, 3),
      e('spring', 3, 1, 2), e('duct_none', 0), e('rope', 4), e('flashlight', 3), e('battery', 5, 1, 2),
      e('schem_steel', 1), e('schem_power', 1),
    ]),
    /* 补给箱 */
    supply: T([2, 4], [
      e('can_beans', 10, 1, 3), e('can_meat', 8, 1, 2), e('water_bottled', 10, 1, 3), e('jerky', 6, 1, 3),
      e('bandage_sterile', 6, 1, 2), e('antibiotics', 3), e('matches', 5), e('rope', 4),
      e('cloth', 6, 1, 3), e('battery', 5), e('flashlight', 3), e('canteen', 3), e('pot', 2),
      e('backpack_hiking', 2), e('jacket_canvas', 3), e('boots_work', 3), e('gloves_work', 4),
      e('axe_iron', 2), e('pick_iron', 2), e('knife_hunting', 3),
    ]),
    /* 储物柜 */
    locker: T([1, 3], [
      e('shirt_worn', 6), e('pants_cargo', 5), e('jacket_canvas', 4), e('boots_work', 4),
      e('gloves_work', 5), e('cap_cloth', 4), e('helmet_bike', 3), e('backpack_small', 4),
      e('cloth_scrap', 8, 2, 4), e('soap', 4), e('lighter', 3), e('paper', 5, 1, 3),
      e('energy_bar', 4), e('water_bottled', 5), e('note_4', 1), e('note_5', 1),
    ]),
    /* 遗弃背包 */
    survivor: T([2, 4], [
      e('jerky', 6, 1, 2), e('water_clean_bottle', 6), e('rag_bandage', 6, 1, 3), e('painkiller', 4),
      e('matches', 4), e('cord', 6, 2, 5), e('knife_flint', 4), e('axe_stone', 3), e('map_fragment', 5),
      e('note_6', 2), e('note_7', 2), e('note_8', 2), e('compass', 2), e('flashlight', 2),
      e('ammo_9mm', 4, 3, 9), e('berries', 5, 2, 5), e('serum_green', 1),
    ]),
    /* 保险柜 */
    safe: T([2, 3], [
      e('keycard_red', 4), e('keycard_yellow', 3), e('coin_stash', 8, 2, 6), e('pistol_9mm', 4),
      e('ammo_9mm', 6, 10, 25), e('gps', 2), e('binoculars', 3), e('schem_armor', 3), e('schem_radio', 2),
      e('research_notes', 2), e('lab_sample', 1), e('vaccine_proto', 1), e('adrenaline', 3),
    ]),
    /* 种子柜 */
    seeds: T([2, 4], [
      e('seed_wheat', 10, 2, 6), e('seed_corn', 9, 2, 5), e('seed_potato', 9, 2, 5), e('seed_carrot', 8, 2, 6),
      e('seed_tomato', 8, 2, 5), e('seed_pumpkin', 6, 1, 3), e('seed_bean', 7, 2, 5), e('seed_cabbage', 7, 2, 5),
      e('fertilizer', 6, 1, 3), e('sapling_oak', 4, 1, 2), e('sapling_pine', 4, 1, 2), e('schem_farm', 2),
      e('scythe', 2), e('bucket_empty', 3),
    ]),
    /* 实验室 */
    lab: T([2, 4], [
      e('lab_sample', 5), e('research_notes', 5), e('spore_sample', 8, 1, 4), e('serum_green', 4),
      e('vaccine_proto', 2), e('alcohol', 6, 1, 3), e('glass_item', 6, 1, 3), e('electronics', 6, 1, 3),
      e('antibiotics', 5, 1, 2), e('gasmask', 3), e('mask_filter', 6, 1, 3), e('schem_chem', 3),
      e('note_9', 2), e('note_10', 2), e('note_11', 2), e('geiger', 2),
    ]),
    /* 车库 / 修车 */
    garage: T([2, 3], [
      e('car_part', 6, 1, 2), e('scrap_metal', 10, 3, 7), e('sheet_metal', 6, 1, 3), e('rubber', 8, 1, 4),
      e('wire', 6, 2, 5), e('fuel_can', 3), e('diesel_jug', 4), e('alcohol', 4), e('tar', 3, 1, 2),
      e('crowbar', 4), e('hammer_claw', 4), e('gear', 5, 1, 3), e('battery', 5), e('schem_power', 2),
    ]),
  };
  // 清掉占位条目（w=0）
  for (const k of Object.keys(tables)) tables[k].entries = tables[k].entries.filter((x) => x.w > 0);

  function roll(tableKey, rnd, extraRolls) {
    const t = tables[tableKey];
    if (!t) return [];
    const n = t.rolls[0] + Math.floor(rnd() * (t.rolls[1] - t.rolls[0] + 1)) + (extraRolls || 0);
    const out = [];
    for (let i = 0; i < n; i++) {
      const pick = U.weightedPick(t.entries, rnd);
      if (!pick) continue;
      const cnt = pick.min + Math.floor(rnd() * (pick.max - pick.min + 1));
      const ex = out.find((o) => o.item === pick.item);
      if (ex) ex.n += cnt; else out.push({ item: pick.item, n: cnt });
    }
    return out;
  }
  GF.Loot = { tables, roll };

  /* ============================================ 材质（带风化 / 苔化） */
  function mat(kind, wx, wy, wz, moss) {
    const B = ID();
    const h = U.hash3(wx, wy, wz, 0x51ed);
    const m = moss === undefined ? 0.25 : moss;
    switch (kind) {
      case 'plaster': return h < 0.12 ? B.plaster_broken : (h < 0.30 ? B.wallpaper : B.plaster);
      case 'brick': return h < m ? B.brick_mossy : B.brick;
      case 'concrete': return h < m ? B.concrete_mossy : (h < m + 0.22 ? B.concrete_cracked : B.concrete);
      case 'rebar': return h < m * 0.6 ? B.concrete_mossy : B.rebar_concrete;
      case 'cinder': return h < m * 0.8 ? B.concrete_mossy : B.cinderblock;
      case 'metal': return h < 0.34 ? B.rusty_metal : B.metal_panel;
      case 'wood': return h < 0.14 ? B.plaster_broken : B.planks;
      case 'tile': return h < m + 0.25 ? B.tile_dirty : B.tile_white;
      case 'glass': return h < 0.34 ? B.glass_broken : (h < 0.7 ? B.glass_dirty : B.glass);
      // 幕墙玻璃：大量破损 + 污浊 + 淡绿镀膜（写字楼的味道）
      case 'curtain': return h < 0.32 ? B.glass_broken : (h < 0.56 ? B.glass_dirty
        : (h < 0.86 ? B.glass_pane_green : B.glass));
      case 'floorw': return h < 0.10 ? B.rubble : B.plank_floor;
      case 'floorc': return h < 0.12 ? B.rubble : B.concrete;
      case 'roof': return h < 0.16 ? B.air : B.shingles;
      case 'roofm': return h < 0.14 ? B.air : B.sheet_roof;
      default: return B.concrete;
    }
  }

  /* ==================================================== 建造器封装 */
  function makeB(wg, cx, cz, api, L) {
    const X0 = cx * CH, Z0 = cz * CH, X1 = X0 + CH - 1, Z1 = Z0 + CH - 1;
    const B = ID();
    const b = {
      B, api, L, wg, X0, Z0, X1, Z1,
      x: L ? L.x : 0, z: L ? L.z : 0, y: L ? L.baseY : SEA + 4,
      hit(x0, z0, x1, z1) { return !(x1 < X0 || x0 > X1 || z1 < Z0 || z0 > Z1); },
      part(x0, z0, x1, z1, fn) { if (this.hit(x0, z0, x1, z1)) fn(); },
      set(x, y, z, id) { api.setW(x, y, z, id); },
      get(x, y, z) { return api.getW(x, y, z); },
      ground(x, z) { return api.groundAt(x, z); },
      rnd(salt) { return U.rngAt(this.x + (salt || 0) * 7919, this.z - (salt || 0) * 104729, wg.seed); },
      hash(x, z, s) { return U.hash2(x, z, (s || 0) ^ wg.seed); },

      /** 遍历一块水平区域，自动裁剪到当前区块（性能关键） */
      forXZ(x0, z0, x1, z1, fn) {
        const ax0 = Math.max(Math.min(x0, x1), X0), ax1 = Math.min(Math.max(x0, x1), X1);
        const az0 = Math.max(Math.min(z0, z1), Z0), az1 = Math.min(Math.max(z0, z1), Z1);
        for (let x = ax0; x <= ax1; x++) for (let z = az0; z <= az1; z++) fn(x, z);
      },

      fill(x0, y0, z0, x1, y1, z1, id) {
        const ax0 = Math.max(Math.min(x0, x1), X0), ax1 = Math.min(Math.max(x0, x1), X1);
        const az0 = Math.max(Math.min(z0, z1), Z0), az1 = Math.min(Math.max(z0, z1), Z1);
        if (ax1 < ax0 || az1 < az0) return;
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
          for (let z = az0; z <= az1; z++) for (let x = ax0; x <= ax1; x++) api.setW(x, y, z, id);
      },
      fillMat(x0, y0, z0, x1, y1, z1, kind, moss) {
        const ax0 = Math.max(Math.min(x0, x1), X0), ax1 = Math.min(Math.max(x0, x1), X1);
        const az0 = Math.max(Math.min(z0, z1), Z0), az1 = Math.min(Math.max(z0, z1), Z1);
        if (ax1 < ax0 || az1 < az0) return;
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
          for (let z = az0; z <= az1; z++) for (let x = ax0; x <= ax1; x++) {
            const id = mat(kind, x, y, z, moss);
            if (id !== 0) api.setW(x, y, z, id);
          }
      },
      // 空心盒（四壁）
      walls(x0, y0, z0, x1, y1, z1, kind, moss) {
        this.fillMat(x0, y0, z0, x1, y1, z0, kind, moss);
        this.fillMat(x0, y0, z1, x1, y1, z1, kind, moss);
        this.fillMat(x0, y0, z0, x0, y1, z1, kind, moss);
        this.fillMat(x1, y0, z0, x1, y1, z1, kind, moss);
      },
      clearBox(x0, y0, z0, x1, y1, z1) { this.fill(x0, y0, z0, x1, y1, z1, 0); },
      // 战利品容器
      loot(x, y, z, blockKey, table, guarantee) {
        api.setW(x, y, z, B[blockKey]);
        if (api.inChunk(x, z) && api.meta) {
          api.meta.containers.push({ x, y, z, table, guarantee: guarantee || null });
        }
      },
      light(x, y, z, id) { api.setW(x, y, z, id); },
      // 随机散落：在矩形内按概率放东西
      scatter(x0, z0, x1, z1, y, prob, idsFn, salt) {
        this.forXZ(x0, z0, x1, z1, (x, z) => {
          if (U.hash2(x, z, (salt || 0) ^ 0x2b3c) < prob) {
            const id = idsFn(x, z);
            if (id) api.setW(x, y, z, id);
          }
        });
      },
      // 藤蔓 / 苔藓覆盖：给一栋楼的外墙挂上绿植
      overgrow(x0, y0, z0, x1, y1, z1, density) {
        this.forXZ(x0 - 1, z0 - 1, x1 + 1, z1 + 1, (x, z) => {
          const onEdge = (x === x0 - 1 || x === x1 + 1 || z === z0 - 1 || z === z1 + 1);
          if (!onEdge) return;
          for (let y = y0; y <= y1; y++) {
            if (api.getW(x, y, z) !== 0) continue;
            const t = 1 - (y - y0) / Math.max(1, y1 - y0);
            if (U.hash3(x, y, z, 0x7ee1) < density * (0.35 + t * 0.9)) {
              api.setW(x, y, z, U.hash3(x, y, z, 3) < 0.2 ? B.thick_vine : B.vine);
            }
          }
        });
      },
    };
    return b;
  }

  /* ============================================== 通用建筑生成器 */

  /** 独立住宅：石膏/砖墙 + 木地板 + 坡屋顶 + 室内家具与战利品 */
  function genHouse(b, x, z, w, d, floors, o) {
    o = o || {};
    const B = b.B, y0 = o.y != null ? o.y : b.ground(x + (w >> 1), z + (d >> 1));
    const wallKind = o.wall || 'plaster', fh = o.fh || 4;
    const x1 = x + w - 1, z1 = z + d - 1;
    const moss = 0.30;
    b.part(x - 1, z - 1, x1 + 1, z1 + 1, () => {
      // 地基
      b.fillMat(x, y0 - 2, z, x1, y0 - 1, z1, 'concrete', 0.1);
      for (let f = 0; f < floors; f++) {
        const fy = y0 + f * fh;
        b.fillMat(x, fy, z, x1, fy, z1, f === 0 ? 'floorw' : 'floorw');
        b.clearBox(x + 1, fy + 1, z + 1, x1 - 1, fy + fh - 1, z1 - 1);
        b.walls(x, fy + 1, z, x1, fy + fh - 1, z1, wallKind, moss);
        // 窗
        for (let wx2 = x + 2; wx2 < x1 - 1; wx2 += 3) {
          b.set(wx2, fy + 2, z, mat('glass', wx2, fy + 2, z));
          b.set(wx2, fy + 3, z, mat('glass', wx2, fy + 3, z));
          b.set(wx2, fy + 2, z1, mat('glass', wx2, fy + 2, z1));
          b.set(wx2, fy + 3, z1, mat('glass', wx2, fy + 3, z1));
        }
        for (let wz2 = z + 2; wz2 < z1 - 1; wz2 += 3) {
          b.set(x, fy + 2, wz2, mat('glass', x, fy + 2, wz2));
          b.set(x1, fy + 2, wz2, mat('glass', x1, fy + 2, wz2));
        }
        // 楼梯（简易：梯子）
        if (floors > 1) { for (let k = 1; k < fh + 1; k++) b.set(x + 1, fy + k, z + 1, B.ladder); if (f < floors - 1) b.set(x + 1, fy + fh, z + 1, 0); }
        // 室内
        const rk = U.hash2(x + f * 13, z, 0x1a2b);
        b.part(x + 1, z + 1, x1 - 1, z1 - 1, () => {
          const iy = fy + 1;
          if (rk < 0.34) { // 卧室
            b.fill(x + 2, iy, z + 2, x + 3, iy, z + 4, B.bed_old);
            b.loot(x1 - 2, iy, z + 2, 'locker', 'locker');
            b.loot(x1 - 2, iy, z1 - 2, 'suitcase', 'civilian');
          } else if (rk < 0.62) { // 厨房
            b.loot(x + 2, iy, z1 - 2, 'fridge', 'fridge');
            b.fill(x + 3, iy, z1 - 2, x + 5, iy, z1 - 2, B.workbench);
            b.loot(x1 - 2, iy, z + 2, 'cabinet', 'civilian');
          } else { // 起居
            b.fill(x + 2, iy, z + 2, x + 4, iy, z + 2, B.bookshelf);
            b.loot(x1 - 2, iy, z1 - 2, 'suitcase', 'civilian');
            b.set(x + 3, iy, z1 - 3, B.carpet_old);
          }
          // 破损与苔化
          b.scatter(x + 1, z + 1, x1 - 1, z1 - 1, iy, 0.06, () => B.rubble, 11);
          b.scatter(x + 1, z + 1, x1 - 1, z1 - 1, iy, 0.05, () => B.moss_carpet, 12);
        });
      }
      // 屋顶
      const ry = y0 + floors * fh;
      if (o.flat) {
        b.fillMat(x, ry, z, x1, ry, z1, 'roofm');
      } else {
        const half = Math.ceil(Math.min(w, d) / 2);
        for (let k = 0; k < half; k++) {
          b.fillMat(x + k, ry + k, z + k, x1 - k, ry + k, z1 - k, 'roof');
        }
      }
      // 门
      b.set(x + (w >> 1), y0 + 1, z, B.door_wood_open);
      b.set(x + (w >> 1), y0 + 2, z, 0);
      b.overgrow(x, y0 + 1, z, x1, ry, z1, o.vine == null ? 0.5 : o.vine);
    });
  }

  /** 多层混凝土楼（城区 / 写字楼 / 公共建筑） */
  function genTower(b, x, z, w, d, floors, o) {
    o = o || {};
    const B = b.B, fh = o.fh || 4;
    const y0 = o.y != null ? o.y : b.ground(x + (w >> 1), z + (d >> 1));
    const x1 = x + w - 1, z1 = z + d - 1;
    const kind = o.wall || 'concrete';
    b.part(x - 1, z - 1, x1 + 1, z1 + 1, () => {
      b.fillMat(x, y0 - 3, z, x1, y0 - 1, z1, 'concrete', 0.05);
      for (let f = 0; f < floors; f++) {
        const fy = y0 + f * fh;
        // 楼板（顶层可能塌了）
        const collapse = U.hash2(x, z + f * 31, 0x3d4e) < (o.ruin || 0.14);
        b.fillMat(x, fy, z, x1, fy, z1, collapse ? 'floorc' : 'floorc');
        if (collapse) b.scatter(x + 1, z + 1, x1 - 1, z1 - 1, fy, 0.4, () => 0, f + 3);
        b.clearBox(x + 1, fy + 1, z + 1, x1 - 1, fy + fh - 1, z1 - 1);
        b.walls(x, fy + 1, z, x1, fy + fh - 1, z1, kind, 0.35 - f * 0.04);
        // 带状窗
        for (let wx2 = x + 1; wx2 <= x1 - 1; wx2++) {
          if ((wx2 - x) % 4 === 0) continue;
          b.set(wx2, fy + 2, z, mat('glass', wx2, fy + 2, z));
          b.set(wx2, fy + 3, z, mat('glass', wx2, fy + 3, z));
          b.set(wx2, fy + 2, z1, mat('glass', wx2, fy + 2, z1));
          b.set(wx2, fy + 3, z1, mat('glass', wx2, fy + 3, z1));
        }
        for (let wz2 = z + 1; wz2 <= z1 - 1; wz2++) {
          if ((wz2 - z) % 4 === 0) continue;
          b.set(x, fy + 2, wz2, mat('glass', x, fy + 2, wz2));
          b.set(x1, fy + 2, wz2, mat('glass', x1, fy + 2, wz2));
        }
        // 电梯井 / 楼梯
        b.fill(x + 2, fy, z + 2, x + 3, fy, z + 3, 0);
        for (let k = 1; k <= fh; k++) b.set(x + 2, fy + k, z + 2, B.ladder);
        // 隔断与家具
        b.part(x + 1, z + 1, x1 - 1, z1 - 1, () => {
          const iy = fy + 1;
          const rk = U.hash2(x + f, z, 0x5511);
          for (let wz2 = z + 4; wz2 < z1 - 2; wz2 += 5) b.fillMat(x + 1, iy, wz2, x1 - 1, iy + 2, wz2, 'plaster', 0.2);
          for (let wz2 = z + 4; wz2 < z1 - 2; wz2 += 5) b.set(x + 4, iy, wz2, 0), b.set(x + 4, iy + 1, wz2, 0);
          if (rk < 0.4) { b.loot(x1 - 2, iy, z + 3, 'cabinet', 'office'); b.loot(x1 - 3, iy, z + 3, 'cabinet', 'office'); }
          else if (rk < 0.7) { b.loot(x1 - 2, iy, z1 - 3, 'locker', 'locker'); b.loot(x + 5, iy, z1 - 3, 'suitcase', 'civilian'); }
          else { b.loot(x + 6, iy, z + 4, 'shelf_store', 'store'); }
          b.scatter(x + 1, z + 1, x1 - 1, z1 - 1, iy, 0.08, () => B.rubble, f + 21);
          b.scatter(x + 1, z + 1, x1 - 1, z1 - 1, iy, 0.05, (px, pz) => (U.hash2(px, pz, 9) < 0.5 ? B.moss_carpet : B.trash_pile), f + 22);
          if (f === 0) { b.set(x + (w >> 1), iy, z, B.door_metal_open); b.set(x + (w >> 1), iy + 1, z, 0); }
        });
      }
      const ry = y0 + floors * fh;
      b.fillMat(x, ry, z, x1, ry, z1, 'roofm');
      b.scatter(x + 1, z + 1, x1 - 1, z1 - 1, ry + 1, 0.05, () => B.moss_carpet, 33);
      b.overgrow(x, y0 + 1, z, x1, ry, z1, o.vine == null ? 0.75 : o.vine);
    });
  }

  /** 大跨仓库 / 谷仓 / 厂房 */
  function genHall(b, x, z, w, d, hh, o) {
    o = o || {};
    const B = b.B, y0 = o.y != null ? o.y : b.ground(x + (w >> 1), z + (d >> 1));
    const x1 = x + w - 1, z1 = z + d - 1;
    b.part(x - 1, z - 1, x1 + 1, z1 + 1, () => {
      b.fillMat(x, y0 - 1, z, x1, y0, z1, o.floor || 'floorc');
      b.clearBox(x + 1, y0 + 1, z + 1, x1 - 1, y0 + hh, z1 - 1);
      b.walls(x, y0 + 1, z, x1, y0 + hh, z1, o.wall || 'metal', 0.3);
      // 立柱
      for (let px = x + 4; px < x1 - 2; px += 6) for (let pz = z + 4; pz < z1 - 2; pz += 6)
        b.fill(px, y0 + 1, pz, px, y0 + hh, pz, B.beam);
      // 桁架屋顶（部分塌陷）
      for (let px = x; px <= x1; px++) for (let pz = z; pz <= z1; pz++) {
        const id = mat('roofm', px, y0 + hh + 1, pz);
        if (id) b.set(px, y0 + hh + 1, pz, id);
      }
      // 大门
      b.fill(x + (w >> 1) - 2, y0 + 1, z, x + (w >> 1) + 2, y0 + 3, z, 0);
      // 内部
      b.part(x + 1, z + 1, x1 - 1, z1 - 1, () => {
        const iy = y0 + 1;
        for (let i = 0; i < 10; i++) {
          const px = x + 2 + Math.floor(U.hash2(x + i, z, 71) * (w - 4));
          const pz = z + 2 + Math.floor(U.hash2(z + i, x, 73) * (d - 4));
          const t = U.hash2(px, pz, 77);
          if (t < 0.3) b.loot(px, iy, pz, 'crate_supply', o.table || 'supply');
          else if (t < 0.5) b.loot(px, iy, pz, 'shelf_store', 'store');
          else if (t < 0.62) b.loot(px, iy, pz, 'toolbox', 'tools');
          else if (t < 0.72) b.fill(px, iy, pz, px + 1, iy + 1, pz + 1, B.hay_bale);
          else if (t < 0.85) b.fill(px, iy, pz, px, iy + 1, pz, B.tire_stack);
        }
        b.scatter(x + 1, z + 1, x1 - 1, z1 - 1, iy, 0.06, () => B.rubble, 41);
        b.scatter(x + 1, z + 1, x1 - 1, z1 - 1, iy, 0.06, () => B.moss_carpet, 42);
      });
      b.overgrow(x, y0 + 1, z, x1, y0 + hh, z1, 0.6);
    });
  }

  /* ==================================================================
   * 破败高楼：玻璃幕墙 + 核心筒 + 塌层剪切 + 屋顶设施 + 全面绿植侵蚀
   * 这是"绿蚀都市"的主角。floors 会按世界高度自动收敛。
   * ================================================================ */
  function genHighrise(b, x, z, w, d, floors, o) {
    o = o || {};
    const B = b.B, fh = o.fh || 4;
    const y0 = o.y != null ? o.y : b.ground(x + (w >> 1), z + (d >> 1));
    const nf = Math.max(2, Math.min(floors, Math.floor((GF.HEIGHT - 7 - y0) / fh)));
    const x1 = x + w - 1, z1 = z + d - 1;
    const top = y0 + nf * fh;                       // 屋顶板高度
    const H = (a, s) => U.hash2(x + a, z + s, 0x71c3);   // 该楼固定的随机数

    // 被剪掉一角的楼（暴露楼板断面），非常有末世感
    const shear = H(1, 1) < 0.42;
    const shFrom = Math.max(2, nf - 1 - Math.floor(H(2, 2) * Math.max(1, nf - 2)));
    const shSide = Math.floor(H(3, 3) * 4);
    const shDepth = 3 + Math.floor(H(4, 4) * Math.max(2, Math.min(w, d) - 4));
    const sheared = (px, pz, f) => {
      if (!shear || f < shFrom) return false;
      if (shSide === 0) return px <= x + shDepth;
      if (shSide === 1) return px >= x1 - shDepth;
      if (shSide === 2) return pz <= z + shDepth;
      return pz >= z1 - shDepth;
    };

    // 核心筒（电梯 / 楼梯）位置
    const coreX = x + 2 + Math.floor(H(5, 5) * Math.max(1, w - 6));
    const coreZ = z + 2 + Math.floor(H(6, 6) * Math.max(1, d - 6));

    b.part(x - 3, z - 3, x1 + 3, z1 + 3, () => {
      /* ---- 地基 + 裙房台阶（顺着地形补齐，避免半悬空） ---- */
      b.forXZ(x - 1, z - 1, x1 + 1, z1 + 1, (px, pz) => {
        const gy = b.ground(px, pz);
        const from = Math.min(gy - 1, y0 - 4);
        for (let wy = from; wy <= y0 - 1; wy++) b.set(px, wy, pz, mat('concrete', px, wy, pz, 0.06));
      });
      b.fillMat(x - 1, y0, z - 1, x1 + 1, y0, z1 + 1, 'concrete', 0.35);

      /* ---- 逐层 ---- */
      for (let f = 0; f < nf; f++) {
        const fy = y0 + f * fh;
        const mossAmt = U.clamp(0.55 - f * 0.07, 0.04, 0.55);   // 越低越苔化
        const ruin = U.clamp(0.05 + f * 0.035, 0, 0.5);          // 越高越破

        // 楼板（局部塌陷）
        b.forXZ(x, z, x1, z1, (px, pz) => {
          if (sheared(px, pz, f)) {
            // 剪切区：只留下断面钢筋
            if (U.hash3(px, fy, pz, 0x4411) < 0.10) b.set(px, fy, pz, B.rebar_concrete);
            return;
          }
          const hole = U.hash3(px, fy, pz, 0x22aa) < ruin * 0.45;
          b.set(px, fy, pz, hole ? 0 : mat('floorc', px, fy, pz, mossAmt * 0.6));
        });
        // 层内清空
        b.forXZ(x, z, x1, z1, (px, pz) => {
          for (let dy = 1; dy < fh; dy++) if (!sheared(px, pz, f)) b.set(px, fy + dy, pz, 0);
        });

        /* ---- 幕墙：角柱 + 竖向柱距 + 玻璃 + 窗下墙 ---- */
        // along = 沿该面墙前进的距离，柱子按 along 取模；早先误用了两个方向取模，
        // 导致整面墙都被判成柱子（玻璃一块都不会生成）。
        const ring = (px, pz, along) => {
          if (sheared(px, pz, f)) return;
          const isCorner = (px === x || px === x1) && (pz === z || pz === z1);
          const pier = isCorner || (along % 5 === 0);
          for (let dy = 1; dy < fh; dy++) {
            const wy = fy + dy;
            if (pier) {
              b.set(px, wy, pz, mat(dy === 1 ? 'rebar' : 'concrete', px, wy, pz, mossAmt));
            } else if (dy === 1) {
              b.set(px, wy, pz, mat('concrete', px, wy, pz, mossAmt));   // 窗下墙
            } else {
              // 高层玻璃更容易整片脱落
              if (U.hash3(px, wy, pz, 0x9a3) < ruin * 0.7) b.set(px, wy, pz, 0);
              else b.set(px, wy, pz, mat('curtain', px, wy, pz));
            }
          }
        };
        for (let px = x; px <= x1; px++) { ring(px, z, px - x); ring(px, z1, px - x); }
        for (let pz = z + 1; pz <= z1 - 1; pz++) { ring(x, pz, pz - z); ring(x1, pz, pz - z); }

        /* ---- 核心筒与爬升 ---- */
        if (!sheared(coreX, coreZ, f)) {
          for (let dy = 0; dy <= fh; dy++) {
            b.set(coreX, fy + dy, coreZ, B.ladder);
            b.set(coreX + 1, fy + dy, coreZ, 0);
          }
          for (let dy = 1; dy < fh; dy++) {
            b.set(coreX - 1, fy + dy, coreZ, mat('cinder', coreX - 1, fy + dy, coreZ, mossAmt));
            b.set(coreX, fy + dy, coreZ - 1, mat('cinder', coreX, fy + dy, coreZ - 1, mossAmt));
          }
        }

        /* ---- 室内：隔断、家具、战利品（层数越高越少人搜过） ---- */
        const iy = fy + 1;
        b.forXZ(x + 1, z + 1, x1 - 1, z1 - 1, (px, pz) => {
          if (sheared(px, pz, f)) return;
          // 核心筒（爬梯及其出入口）绝不能被隔断或家具堵住
          if (pz === coreZ && (px === coreX || px === coreX + 1)) return;
          if (px === coreX && (pz === coreZ - 1 || pz === coreZ + 1)) return;
          if (b.get(px, iy - 1, pz) === 0) return;             // 楼板塌了就不放东西
          const t = U.hash3(px, f, pz, 0x3d17);
          // 轻钢隔断
          if ((pz - z) % 6 === 0 && (px - x) % 7 !== 0 && t < 0.75) {
            b.set(px, iy, pz, mat('plaster', px, iy, pz, mossAmt * 0.5));
            b.set(px, iy + 1, pz, mat('plaster', px, iy + 1, pz, mossAmt * 0.5));
            return;
          }
          if (t > 0.988) b.loot(px, iy, pz, 'cabinet', 'office');
          else if (t > 0.980) b.loot(px, iy, pz, 'locker', 'locker');
          else if (t > 0.974) b.loot(px, iy, pz, 'suitcase', 'civilian');
          else if (t > 0.970) b.set(px, iy, pz, B.bookshelf);
          else if (t > 0.964) b.set(px, iy, pz, B.trash_pile);
          else if (t > 0.955) b.set(px, iy, pz, B.rubble);
          // 绿植侵蚀室内
          else if (t < 0.010 + mossAmt * 0.05) b.set(px, iy, pz, B.moss_carpet);
          else if (t < 0.014 + mossAmt * 0.05) b.set(px, iy, pz, B.fern);
          else if (t < 0.016) b.set(px, iy, pz, B.glow_moss);
        });
        // 顶棚垂下的藤蔓
        b.forXZ(x + 1, z + 1, x1 - 1, z1 - 1, (px, pz) => {
          if (sheared(px, pz, f)) return;
          if (U.hash3(px, f, pz, 0x77e2) > 0.05 + mossAmt * 0.12) return;
          for (let dy = fh - 1; dy >= 1; dy--) {
            if (b.get(px, fy + dy, pz) !== 0) break;
            b.set(px, fy + dy, pz, B.vine);
          }
        });
      }

      /* ---- 屋顶 ---- */
      b.forXZ(x, z, x1, z1, (px, pz) => {
        if (sheared(px, pz, nf - 1)) return;
        b.set(px, top, pz, U.hash3(px, top, pz, 0x51) < 0.08 ? 0 : mat('floorc', px, top, pz, 0.12));
      });
      // 女儿墙
      for (let px = x; px <= x1; px++) {
        for (const pz of [z, z1]) for (let dy = 1; dy <= 2; dy++)
          if (!sheared(px, pz, nf - 1) && U.hash3(px, dy, pz, 0x62) > 0.12)
            b.set(px, top + dy, pz, mat('concrete', px, top + dy, pz, 0.2));
      }
      for (let pz = z; pz <= z1; pz++) {
        for (const px of [x, x1]) for (let dy = 1; dy <= 2; dy++)
          if (!sheared(px, pz, nf - 1) && U.hash3(px, dy, pz, 0x63) > 0.12)
            b.set(px, top + dy, pz, mat('concrete', px, top + dy, pz, 0.2));
      }
      // 楼梯出屋面小屋
      b.fillMat(coreX - 1, top + 1, coreZ - 1, coreX + 1, top + 3, coreZ + 1, 'cinder', 0.25);
      b.fill(coreX, top + 1, coreZ, coreX, top + 3, coreZ, 0);
      b.set(coreX, top + 1, coreZ - 1, B.door_metal_open);
      for (let dy = 0; dy <= 3; dy++) b.set(coreX, top + dy, coreZ, B.ladder);
      b.fillMat(coreX - 1, top + 4, coreZ - 1, coreX + 1, top + 4, coreZ + 1, 'roofm');

      // 水箱 / 空调机组 / 天线 / 屋顶花园
      const rk = H(7, 7);
      const rx = x + 1 + Math.floor(H(8, 8) * Math.max(1, w - 5));
      const rz = z + 1 + Math.floor(H(9, 9) * Math.max(1, d - 5));
      if (rk < 0.45) {                                   // 水箱
        b.fill(rx, top + 1, rz, rx + 2, top + 4, rz + 2, B.rusty_metal);
        b.fill(rx + 1, top + 4, rz + 1, rx + 1, top + 4, rz + 1, B.water_dirty);
        b.loot(rx + 3, top + 1, rz, 'toolbox', 'tools');
      } else if (rk < 0.72) {                            // 空调机组
        for (let i = 0; i < 3; i++) {
          b.fill(rx, top + 1, rz + i * 3, rx + 1, top + 2, rz + i * 3 + 1, B.metal_panel);
          b.set(rx, top + 3, rz + i * 3, B.metal_grate);
        }
      } else {                                           // 桅杆 + 航空障碍灯
        for (let dy = 1; dy <= 7; dy++) b.set(rx, top + dy, rz, B.rusty_metal);
        b.set(rx, top + 8, rz, B.lamp_off);
      }
      // 屋顶花园：泥土、草、小树 —— "楼顶长出了树"
      if (H(10, 10) < 0.72) {
        const gx = x + 1, gz = z + 1;
        b.forXZ(gx, gz, x1 - 1, z1 - 1, (px, pz) => {
          if (sheared(px, pz, nf - 1)) return;
          if (b.get(px, top, pz) === 0) return;
          const t = U.hash2(px, pz, 0x8a5f);
          if (t < 0.34) { b.set(px, top, pz, B.rich_soil); b.set(px, top + 1, pz, B.grass_tall); }
          else if (t < 0.44) { b.set(px, top, pz, B.moss_ground); b.set(px, top + 1, pz, B.moss_carpet); }
          else if (t < 0.47) b.set(px, top + 1, pz, B.bush_berry);
          else if (t < 0.485) b.set(px, top + 1, pz, B.fern);
        });
        // 两三棵小树扎在屋顶
        const nTrees = 1 + Math.floor(H(11, 11) * 3);
        for (let i = 0; i < nTrees; i++) {
          const tx = x + 2 + Math.floor(U.hash2(x + i * 7, z, 0x9b) * Math.max(1, w - 4));
          const tz = z + 2 + Math.floor(U.hash2(z + i * 11, x, 0x9c) * Math.max(1, d - 4));
          if (sheared(tx, tz, nf - 1)) continue;
          if (top + 8 > GF.HEIGHT - 3) continue;
          const rnd = U.rngAt(tx, tz, b.wg.seed ^ 0x1234);
          try {
            b.wg._treeBroad(tx, top + 1, tz, rnd,
              (sx, sy, sz, id) => b.set(sx, sy, sz, id),
              B.log_oak, B.leaves_oak, 3, 5, B);
          } catch (e) { /* 屋顶太窄就算了
*/ }
        }
      }

      /* ---- 绿植侵蚀外立面 ---- */
      // 1) 角部巨藤，从地面爬到 60~85% 高度
      const climbTo = y0 + Math.floor(nf * fh * (0.6 + H(12, 12) * 0.25));
      for (const [cx2, cz2] of [[x, z], [x1, z], [x, z1], [x1, z1]]) {
        for (const [ox, oz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const px = cx2 + ox, pz = cz2 + oz;
          for (let wy = y0 + 1; wy <= climbTo; wy++) {
            if (b.get(px, wy, pz) !== 0) continue;
            if (U.hash3(px, wy, pz, 0xc10b) < 0.62) {
              b.set(px, wy, pz, U.hash3(px, wy, pz, 7) < 0.35 ? B.thick_vine : B.vine);
            }
          }
        }
      }
      // 2) 窗洞垂藤（越低越密：底层近乎绿幕，顶层只有零星几缕）
      b.overgrow(x, y0 + 1, z, x1, top, z1, o.vine == null ? 0.5 : o.vine);
      // 3) 底部瓦砾裙与野草
      b.forXZ(x - 3, z - 3, x1 + 3, z1 + 3, (px, pz) => {
        if (px >= x && px <= x1 && pz >= z && pz <= z1) return;
        const gy = b.ground(px, pz);
        const t = U.hash2(px, pz, 0xd3d3);
        if (t < 0.20) b.set(px, gy + 1, pz, B.rubble);
        else if (t < 0.46) b.set(px, gy + 1, pz, B.grass_tall);
        else if (t < 0.52) b.set(px, gy + 1, pz, B.moss_carpet);
        else if (t < 0.545) b.set(px, gy + 1, pz, B.glass_broken);
        else if (t < 0.56) b.set(px, gy + 1, pz, B.trash_pile);
      });

      /* ---- 底层大堂：破碎的入口 + 高价值一点的战利品 ---- */
      const doorX = x + (w >> 1);
      b.fill(doorX - 1, y0 + 1, z, doorX + 1, y0 + 3, z, 0);
      b.set(doorX, y0 + 1, z, B.glass_broken);
      b.loot(x + 2, y0 + 1, z + 2, 'cash_register', 'register');
      b.loot(x1 - 2, y0 + 1, z + 2, 'shelf_store', 'store');
      // 顶层的保险柜（爬上去的奖励）
      if (H(13, 13) < 0.55) {
        b.loot(coreX + 1, top - fh + 1, coreZ + 1, 'safe', 'safe');
      }
    });
    return { top, floors: nf };
  }

  /** 城市街网：沥青车道 + 混凝土人行道 + 路灯 + 行道树 + 车骸 */
  function genStreetGrid(b, cx, cz, cols, rows, blockW, streetW) {
    const B = b.B;
    const halfW = (cols * blockW + (cols + 1) * streetW) / 2;
    const halfD = (rows * blockW + (rows + 1) * streetW) / 2;
    const x0 = cx - Math.floor(halfW), z0 = cz - Math.floor(halfD);
    const x1 = x0 + cols * blockW + (cols + 1) * streetW - 1;
    const z1 = z0 + rows * blockW + (rows + 1) * streetW - 1;
    const period = blockW + streetW;

    b.part(x0, z0, x1, z1, () => {
      b.forXZ(x0, z0, x1, z1, (px, pz) => {
        const lx = (px - x0) % period, lz = (pz - z0) % period;
        const inStreetX = lx < streetW, inStreetZ = lz < streetW;
        if (!inStreetX && !inStreetZ) return;                 // 街区内部交给建筑
        const gy = b.ground(px, pz);
        const edge = (inStreetX && (lx === 0 || lx === streetW - 1)) ||
          (inStreetZ && (lz === 0 || lz === streetW - 1));
        const center = (inStreetX && lx === (streetW >> 1)) || (inStreetZ && lz === (streetW >> 1));
        const t = U.hash2(px, pz, 0x51a7);
        if (edge) {
          // 人行道：混凝土 + 裂缝里的草
          b.set(px, gy, pz, t < 0.16 ? B.concrete_cracked : (t < 0.24 ? B.concrete_mossy : B.concrete));
          if (t > 0.90) b.set(px, gy + 1, pz, B.grass_tall);
          else if (t > 0.86) b.set(px, gy + 1, pz, B.moss_carpet);
          else if (t > 0.845) b.set(px, gy + 1, pz, B.trash_pile);
        } else {
          b.set(px, gy, pz, center ? B.road_line : (t < 0.14 ? B.concrete_cracked : B.asphalt));
          if (t > 0.955) b.set(px, gy + 1, pz, B.grass_tall);   // 从沥青缝里长出来
          else if (t > 0.948) b.set(px, gy + 1, pz, B.rubble);
        }
        for (let dy = 1; dy <= 3; dy++) if (b.get(px, gy + dy, pz) !== 0 && !edge) b.set(px, gy + dy, pz, 0);
      });

      // 路灯 / 行道树 / 车骸
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const sx = x0 + i * period + (streetW >> 1);
          const sz = z0 + j * period + (streetW >> 1);
          if (sx < b.X0 - 24 || sx > b.X1 + 24 || sz < b.Z0 - 24 || sz > b.Z1 + 24) continue;
          // 沿街摆设
          for (let k = 4; k < period - 2; k += 7) {
            for (const [ax, az] of [[sx + k, sz - (streetW >> 1) - 1], [sx - (streetW >> 1) - 1, sz + k]]) {
              const t = U.hash2(ax, az, 0x2c8f);
              const gy = b.ground(ax, az);
              if (t < 0.34) {                                    // 路灯
                for (let dy = 1; dy <= 4; dy++) b.set(ax, gy + dy, az, B.rusty_metal);
                b.set(ax, gy + 5, az, B.lamp_off);
              } else if (t < 0.72) {                             // 行道树（花坛里长疯了）
                b.set(ax, gy, az, B.rich_soil);
                const rnd = U.rngAt(ax, az, b.wg.seed ^ 0x77);
                try {
                  b.wg._treeBroad(ax, gy + 1, az, rnd, (px2, py2, pz2, id) => b.set(px2, py2, pz2, id),
                    B.log_oak, B.leaves_oak, 4, 7, B);
                } catch (e) { /* noop */ }
              } else if (t < 0.84) {
                b.set(ax, gy + 1, az, B.planter);
                b.set(ax, gy + 2, az, B.fern);
              }
            }
          }
          if (U.hash2(sx, sz, 0x3311) < 0.55) genCarWreck(b, sx - 2, sz + 3);
          if (U.hash2(sz, sx, 0x3312) < 0.45) genCarWreck(b, sx + 4, sz - 1);
        }
      }
    });
    return { x0, z0, x1, z1, period, streetW, blockW };
  }

  /** 在街网的某个街区里塞建筑（1 栋塔楼或 2~3 栋小楼） */
  function genCityBlockFill(b, bx, bz, blockW, salt) {
    const t = U.hash2(bx, bz, 0x6f21 ^ salt);
    const inset = 1;
    const x = bx + inset, z = bz + inset, w = blockW - inset * 2, d = blockW - inset * 2;
    if (t < 0.46) {
      // 一栋占满街区的塔楼
      const floors = 5 + Math.floor(U.hash2(bx, bz, 0x91) * 9);
      genHighrise(b, x, z, w, d, floors, {});
    } else if (t < 0.72) {
      // 两栋窄塔
      const half = (w - 3) >> 1;
      genHighrise(b, x, z, half, d, 4 + Math.floor(U.hash2(bx, bz, 0x92) * 8), {});
      genHighrise(b, x + half + 3, z, w - half - 3, d, 4 + Math.floor(U.hash2(bz, bx, 0x93) * 8), {});
    } else if (t < 0.86) {
      // 裙房 + 塔楼
      genHall(b, x, z, w, Math.max(8, d - 8), 6, { wall: 'concrete', table: 'store', floor: 'tile' });
      genHighrise(b, x + 2, z + d - 10, w - 4, 10, 6 + Math.floor(U.hash2(bx, bz, 0x94) * 6), {});
    } else {
      // 塌成废墟的街区：只剩底层与野化的空地
      const B = b.B;
      b.part(x, z, x + w, z + d, () => {
        b.fillMat(x, b.ground(x + (w >> 1), z + (d >> 1)), z, x + w - 1, b.ground(x + (w >> 1), z + (d >> 1)), z + d - 1, 'floorc');
        b.forXZ(x, z, x + w - 1, z + d - 1, (px, pz) => {
          const gy = b.ground(px, pz);
          const h2 = U.hash2(px, pz, 0x4d21);
          if (h2 < 0.10) for (let dy = 1; dy <= 1 + Math.floor(h2 * 30); dy++)
            b.set(px, gy + dy, pz, mat('rebar', px, gy + dy, pz, 0.5));
          else if (h2 < 0.30) b.set(px, gy + 1, pz, B.rubble);
          else if (h2 < 0.62) b.set(px, gy + 1, pz, B.grass_tall);
          else if (h2 < 0.70) b.set(px, gy + 1, pz, B.moss_carpet);
          else if (h2 < 0.73) b.set(px, gy + 1, pz, B.bush_berry);
        });
        for (let i = 0; i < 4; i++) {
          const tx = x + 2 + Math.floor(U.hash2(x + i, z, 0x51) * (w - 4));
          const tz = z + 2 + Math.floor(U.hash2(z + i, x, 0x52) * (d - 4));
          const rnd = U.rngAt(tx, tz, b.wg.seed ^ 0x99);
          try {
            b.wg._treeBroad(tx, b.ground(tx, tz) + 1, tz, rnd,
              (px2, py2, pz2, id) => b.set(px2, py2, pz2, id), B.log_oak, B.leaves_oak, 5, 9, B);
          } catch (e) { /* noop */ }
        }
        b.loot(x + (w >> 1), b.ground(x + (w >> 1), z + (d >> 1)) + 1, z + (d >> 1), 'backpack_drop', 'survivor');
      });
    }
  }

  /** 道路（含标线与两侧路缘、随机车辆残骸） */
  function genRoad(b, x0, z0, x1, z1, width, salt) {
    const B = b.B;
    const horiz = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const hw = width >> 1;
    const ax0 = Math.min(x0, x1), ax1 = Math.max(x0, x1);
    const az0 = Math.min(z0, z1), az1 = Math.max(z0, z1);
    const bx0 = horiz ? ax0 : ax0 - hw, bx1 = horiz ? ax1 : ax1 + hw;
    const bz0 = horiz ? az0 - hw : az0, bz1 = horiz ? az1 + hw : az1;
    b.part(bx0, bz0, bx1, bz1, () => {
      b.forXZ(bx0, bz0, bx1, bz1, (x, z) => {
        const gy = b.ground(x, z);
        const center = horiz ? Math.abs(z - (az0 + az1) / 2) < 0.6 : Math.abs(x - (ax0 + ax1) / 2) < 0.6;
        const cracked = U.hash2(x, z, salt || 0x99) < 0.12;
        b.set(x, gy, z, center ? B.road_line : (cracked ? B.concrete_cracked : B.asphalt));
        b.set(x, gy + 1, z, 0);
        b.set(x, gy + 2, z, 0);
        // 路面裂缝里长出的草
        if (U.hash2(x, z, 0x4b1) < 0.05) b.set(x, gy + 1, z, B.grass_tall);
        if (U.hash2(x, z, 0x4b2) < 0.012) b.set(x, gy + 1, z, B.trash_pile);
      });
      // 车辆残骸
      for (let t = 0; t <= Math.max(ax1 - ax0, az1 - az0); t += 9) {
        const cxp = horiz ? ax0 + t : ax0 + (U.hash2(t, 1, 5) < 0.5 ? -1 : 1);
        const czp = horiz ? az0 + (U.hash2(t, 2, 5) < 0.5 ? -1 : 1) : az0 + t;
        if (cxp < b.X0 - 6 || cxp > b.X1 + 6 || czp < b.Z0 - 6 || czp > b.Z1 + 6) continue;
        if (U.hash2(cxp, czp, 0x7c1) < 0.45) genCarWreck(b, cxp, czp);
      }
    });
  }

  function genCarWreck(b, x, z) {
    const B = b.B, gy = b.ground(x, z);
    const horiz = U.hash2(x, z, 3) < 0.5;
    const w = horiz ? 4 : 2, d = horiz ? 2 : 4;
    b.part(x - 1, z - 1, x + w, z + d, () => {
      b.fill(x, gy + 1, z, x + w - 1, gy + 1, z + d - 1, B.wreck_metal);
      b.set(x + (w >> 1), gy + 2, z + (d >> 1), B.wreck_metal);
      if (U.hash2(x, z, 11) < 0.4) b.set(x, gy + 2, z, B.glass_broken);
      if (U.hash2(x, z, 12) < 0.3) b.loot(x + w - 1, gy + 2, z + d - 1, 'suitcase', 'garage');
      if (U.hash2(x, z, 13) < 0.5) b.set(x + 1, gy + 1, z + d, B.tire_stack);
      // 车里长出来的植物
      if (U.hash2(x, z, 14) < 0.5) b.set(x + (w >> 1), gy + 2, z, B.grass_tall);
    });
  }

  /** 帐篷营地 */
  function genCamp(b, x, z, r, o) {
    o = o || {};
    const B = b.B;
    b.part(x - r - 1, z - r - 1, x + r + 1, z + r + 1, () => {
      const gy = b.ground(x, z);
      b.set(x, gy + 1, z, B.campfire);
      for (let i = 0; i < 4; i++) {
        const a = i * 1.571 + 0.5, px = x + Math.round(Math.cos(a) * (r - 1)), pz = z + Math.round(Math.sin(a) * (r - 1));
        if (U.hash2(px, pz, 21) < (o.tents == null ? 0.7 : o.tents)) {
          const gy2 = b.ground(px, pz);
          b.fill(px - 1, gy2 + 1, pz - 1, px + 1, gy2 + 2, pz + 1, B.tarp);
          b.fill(px, gy2 + 1, pz, px, gy2 + 2, pz, 0);
          b.set(px, gy2 + 1, pz, B.bed_old);
          if (U.hash2(px, pz, 22) < 0.6) b.loot(px + 1, gy2 + 1, pz, 'backpack_drop', 'survivor');
        }
      }
      for (let i = 0; i < 6; i++) {
        const px = x + Math.round((U.hash2(x + i, z, 31) - 0.5) * r * 2);
        const pz = z + Math.round((U.hash2(z + i, x, 32) - 0.5) * r * 2);
        const gy2 = b.ground(px, pz);
        const t = U.hash2(px, pz, 33);
        if (t < 0.25) b.loot(px, gy2 + 1, pz, 'crate_supply', o.table || 'supply');
        else if (t < 0.4) b.loot(px, gy2 + 1, pz, 'backpack_drop', 'survivor');
        else if (t < 0.5) b.set(px, gy2 + 1, pz, B.drying_rack);
        else if (t < 0.58) b.set(px, gy2 + 1, pz, B.workbench);
        else if (t < 0.64) b.set(px, gy2 + 1, pz, B.chest);
      }
    });
  }

  /** 铁塔（水塔 / 电波塔 / 风机） */
  function genTowerFrame(b, x, z, h, o) {
    o = o || {};
    const B = b.B, gy = b.ground(x, z);
    b.part(x - 4, z - 4, x + 4, z + 4, () => {
      for (let i = 0; i < h; i++) {
        const inset = Math.floor(i / h * 2);
        const r = 3 - inset;
        b.set(x - r, gy + 1 + i, z - r, B.rusty_metal);
        b.set(x + r, gy + 1 + i, z - r, B.rusty_metal);
        b.set(x - r, gy + 1 + i, z + r, B.rusty_metal);
        b.set(x + r, gy + 1 + i, z + r, B.rusty_metal);
        if (i % 3 === 0) {
          for (let k = -r; k <= r; k++) {
            b.set(x + k, gy + 1 + i, z - r, B.metal_grate);
            b.set(x + k, gy + 1 + i, z + r, B.metal_grate);
            b.set(x - r, gy + 1 + i, z + k, B.metal_grate);
            b.set(x + r, gy + 1 + i, z + k, B.metal_grate);
          }
        }
        b.set(x, gy + 1 + i, z, B.ladder);
      }
      const ty = gy + 1 + h;
      if (o.tank) {                                  // 水塔罐体
        for (let dy = 0; dy < 5; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
          if (dx * dx + dz * dz > 16) continue;
          const shell = dx * dx + dz * dz > 9 || dy === 0 || dy === 4;
          b.set(x + dx, ty + dy, z + dz, shell ? B.metal_panel : (dy < 3 ? B.water : 0));
        }
        b.loot(x, ty + 1, z + 3, 'toolbox', 'tools');
      } else {                                       // 平台
        b.fill(x - 3, ty, z - 3, x + 3, ty, z + 3, B.metal_grate);
        b.fill(x - 1, ty, z - 1, x + 1, ty, z + 1, 0);
        if (o.platformLoot) b.loot(x + 2, ty + 1, z + 2, o.platformLoot[0], o.platformLoot[1], o.platformLoot[2]);
        if (o.mast) for (let i = 0; i < o.mast; i++) b.set(x, ty + 1 + i, z, B.rusty_metal);
        if (o.lamp) b.set(x, ty + 1 + (o.mast || 0), z, B.lamp_on);
      }
      b.overgrow(x - 3, gy + 1, z - 3, x + 3, gy + Math.min(h, 12), z + 3, 0.9);
    });
  }

  /** 地下掩体/地铁：挖出走廊与房间 */
  function genUnderground(b, x, z, w, d, depth, o) {
    o = o || {};
    const B = b.B;
    const gy = b.ground(x + (w >> 1), z + (d >> 1));
    const fy = Math.max(8, gy - depth);
    const x1 = x + w - 1, z1 = z + d - 1;
    b.part(x - 1, z - 1, x1 + 1, z1 + 1, () => {
      b.fillMat(x, fy - 1, z, x1, fy - 1, z1, 'tile', 0.4);
      b.clearBox(x, fy, z, x1, fy + (o.h || 4), z1);
      b.walls(x - 1, fy, z - 1, x1 + 1, fy + (o.h || 4) + 1, z1 + 1, o.wall || 'concrete', 0.3);
      b.fillMat(x - 1, fy + (o.h || 4) + 1, z - 1, x1 + 1, fy + (o.h || 4) + 1, z1 + 1, 'concrete', 0.15);
      // 竖井入口
      if (o.shaft !== false) {
        const sx = o.shaftX != null ? o.shaftX : x + 2, sz = o.shaftZ != null ? o.shaftZ : z + 2;
        b.fill(sx, fy, sz, sx, gy + 1, sz, 0);
        for (let y = fy; y <= gy + 1; y++) b.set(sx, y, sz, B.ladder);
        b.fill(sx - 1, gy + 1, sz - 1, sx + 1, gy + 2, sz + 1, B.concrete);
        b.fill(sx, gy + 1, sz, sx, gy + 2, sz, 0);
        for (let y = fy; y <= gy + 1; y++) b.set(sx, y, sz, B.ladder);
      }
      // 灯与陈设
      b.part(x, z, x1, z1, () => {
        for (let px = x + 3; px < x1; px += 6) for (let pz = z + 3; pz < z1; pz += 6) {
          if (U.hash2(px, pz, 51) < 0.4) b.set(px, fy + (o.h || 4), pz, B.lamp_off);
        }
        for (let i = 0; i < (o.crates || 8); i++) {
          const px = x + 1 + Math.floor(U.hash2(x + i, z, 61) * (w - 2));
          const pz = z + 1 + Math.floor(U.hash2(z + i, x, 62) * (d - 2));
          const t = U.hash2(px, pz, 63);
          const tab = o.table || 'supply';
          if (t < 0.34) b.loot(px, fy, pz, 'crate_supply', tab);
          else if (t < 0.52) b.loot(px, fy, pz, 'locker', 'locker');
          else if (t < 0.66) b.loot(px, fy, pz, 'medbox', 'medical');
          else if (t < 0.76) b.loot(px, fy, pz, 'ammo_case', 'ammo');
          else if (t < 0.84) b.set(px, fy, pz, B.bed_old);
          else b.loot(px, fy, pz, 'cabinet', 'office');
        }
        b.scatter(x, z, x1, z1, fy, 0.05, () => B.rubble, 71);
        b.scatter(x, z, x1, z1, fy, 0.04, () => B.glow_moss, 72);
        b.scatter(x, z, x1, z1, fy, 0.03, () => B.fungal_wall, 73);
      });
      return fy;
    });
    return fy;
  }

  /** 农田（成片作物 + 灌溉沟） */
  function genField(b, x, z, w, d, cropKey) {
    const B = b.B;
    b.part(x, z, x + w, z + d, () => {
      for (let px = x; px < x + w; px++) for (let pz = z; pz < z + d; pz++) {
        const gy = b.ground(px, pz);
        const row = (pz - z) % 5;
        if (row === 4) { b.set(px, gy, pz, B.farmland_wet); b.set(px, gy + 1, pz, B.water); continue; }
        b.set(px, gy, pz, B.farmland);
        const h = U.hash2(px, pz, 0x1f2f);
        if (h < 0.55) {
          const stage = h < 0.2 ? 3 : (h < 0.35 ? 2 : 1);
          b.set(px, gy + 1, pz, B[cropKey + '_' + stage]);
        } else if (h < 0.72) b.set(px, gy + 1, pz, B.grass_tall);
      }
    });
  }

  /* ================================================= 地标定义表 */
  // 每个地标：坐标固定，flat 区域会整平地形，build() 在相交区块被调用
  const L = [];
  const add = (o) => { L.push(Object.assign({ r: 40, biome: null, noVeg: false, icon: '◆', tier: 1 }, o)); };

  add({
    key: 'camp0', name: '起点营地', x: 8, z: 8, r: 26, icon: '⛺', tier: 0,
    desc: '你醒来的地方。有人在这里等过你，但没等到。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      genCamp(b, b.x, b.z, 7, { table: 'supply', tents: 1 });
      // 营地旁的碎石滩：开局的燧石来源（徒手可刨）
      b.part(b.x - 14, b.z + 4, b.x + 6, b.z + 16, () => {
        b.forXZ(b.x - 13, b.z + 5, b.x + 5, b.z + 15, (px, pz) => {
          const d = Math.hypot(px - (b.x - 4), pz - (b.z + 10));
          if (d > 6.5) return;
          const g2 = b.ground(px, pz);
          if (U.hash2(px, pz, 0x0c0f) < 0.72) {
            b.set(px, g2, pz, B.gravel);
            b.set(px, g2 + 1, pz, 0);
            if (U.hash2(pz, px, 0x0c10) < 0.16) b.set(px, g2 + 1, pz, B.cobblestone);
          }
        });
      });
      b.part(b.x - 8, b.z - 8, b.x + 8, b.z + 8, () => {
        b.loot(b.x + 3, gy + 1, b.z + 1, 'crate_supply', 'supply', ['water_clean_bottle', 'cord', 'can_empty', 'note_1', 'map_paper']);
        b.set(b.x - 2, gy + 1, b.z + 2, B.workbench);
        b.set(b.x + 1, b.ground(b.x + 1, b.z - 3) + 1, b.z - 3, B.sign_post);
        b.loot(b.x - 3, b.ground(b.x - 3, b.z - 2) + 1, b.z - 2, 'backpack_drop', 'survivor', ['note_2']);
        // 几丛高草：纤维来源
        for (let i = 0; i < 22; i++) {
          const px = b.x - 6 + Math.floor(U.hash2(i, 3, 0x51) * 13);
          const pz = b.z - 6 + Math.floor(U.hash2(i, 4, 0x52) * 13);
          const g2 = b.ground(px, pz);
          if (b.get(px, g2 + 1, pz) === 0) b.set(px, g2 + 1, pz, U.hash2(px, pz, 9) < 0.2 ? B.bush_berry : B.grass_tall);
        }
      });
    },
  });

  add({
    key: 'cbd', name: '新港中央商务区', x: 620, z: 420, r: 92, blend: 64, flatY: 38,
    biome: 'suburb', noVeg: true, icon: '🏙', tier: 3,
    desc: '十几栋玻璃幕墙的空壳。藤蔓从三十米高的窗洞里垂下来，屋顶上长出了树。',
    build(b) {
      const B = b.B;
      const g = genStreetGrid(b, b.x, b.z, 3, 3, 44, 9);
      const blockAt = (i, j) => ({
        x: g.x0 + g.streetW + i * g.period,
        z: g.z0 + g.streetW + j * g.period,
      });
      // 八个街区塞楼，中间留作广场
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        if (i === 1 && j === 1) continue;
        const p = blockAt(i, j);
        genCityBlockFill(b, p.x, p.z, g.blockW, i * 7 + j * 13);
      }

      /* ---- 中央广场：干涸的水池、疯长的花坛、幸存者留下的痕迹 ---- */
      const pl = blockAt(1, 1);
      const px0 = pl.x, pz0 = pl.z, px1 = pl.x + g.blockW - 1, pz1 = pl.z + g.blockW - 1;
      const py = b.y;
      b.part(px0 - 1, pz0 - 1, px1 + 1, pz1 + 1, () => {
        b.forXZ(px0, pz0, px1, pz1, (x2, z2) => {
          const t = U.hash2(x2, z2, 0x1b7c);
          b.set(x2, py, z2, t < 0.42 ? B.tile_dirty : (t < 0.62 ? B.tile_white : B.concrete_mossy));
          for (let dy = 1; dy <= 4; dy++) b.set(x2, py + dy, z2, 0);
          if (t > 0.965) b.set(x2, py + 1, z2, B.grass_tall);
          else if (t > 0.95) b.set(x2, py + 1, z2, B.moss_carpet);
          else if (t > 0.945) b.set(x2, py + 1, z2, B.rubble);
        });
        // 水池
        const fx = (px0 + px1) >> 1, fz = (pz0 + pz1) >> 1;
        for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
          const d = Math.hypot(dx, dz);
          if (d > 5.4) continue;
          if (d > 4.4) { b.set(fx + dx, py + 1, fz + dz, B.cobblestone); continue; }
          b.set(fx + dx, py, fz + dz, B.tile_dirty);
          if (d < 3.6 && U.hash2(fx + dx, fz + dz, 3) < 0.7) b.set(fx + dx, py, fz + dz, B.water_dirty);
          if (U.hash2(fx + dx, fz + dz, 5) < 0.16) b.set(fx + dx, py + 1, fz + dz, B.reeds);
        }
        // 花坛长成了小树林
        for (const [ox, oz] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) {
          const bx = fx + ox, bz = fz + oz;
          for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
            const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
            b.set(bx + dx, py + 1, bz + dz, edge ? B.cobblestone : B.rich_soil);
            if (!edge && U.hash2(bx + dx, bz + dz, 7) < 0.5) b.set(bx + dx, py + 2, bz + dz, B.grass_tall);
          }
          const rnd = U.rngAt(bx, bz, b.wg.seed ^ 0x4242);
          try {
            b.wg._treeBroad(bx, py + 2, bz, rnd, (a, c, d2, id) => b.set(a, c, d2, id),
              B.log_oak, B.leaves_oak, 5, 8, B);
          } catch (e) { /* noop */ }
        }
        // 幸存者营地遗迹 + 奖励
        b.set(fx - 9, py + 1, fz + 8, B.campfire);
        b.set(fx - 11, py + 1, fz + 8, B.workbench);
        b.loot(fx - 10, py + 1, fz + 10, 'crate_supply', 'supply', ['binoculars']);
        b.loot(fx + 9, py + 1, fz - 9, 'safe', 'safe', ['schem_armor', 'keycard_blue']);
        b.loot(fx + 11, py + 1, fz + 9, 'medbox', 'medical');
        b.set(fx, py + 1, fz - 8, B.sign_post);
        for (let i = 0; i < 5; i++) genCarWreck(b, fx - 14 + i * 7, fz + 15);
      });

      /* ---- 空中连廊（塌了一半，是通往对面楼的捷径） ---- */
      const sb = blockAt(0, 1);
      const bY = b.y + 6 * 4 + 1;                     // 第 7 层高度
      const bx0 = sb.x + g.blockW, bx1 = sb.x + g.blockW + g.streetW - 1;
      const bz = sb.z + (g.blockW >> 1);
      b.part(bx0 - 2, bz - 3, bx1 + 2, bz + 3, () => {
        for (let x2 = bx0 - 1; x2 <= bx1 + 1; x2++) {
          const gone = U.hash2(x2, bz, 0x5b7) < 0.22;    // 中段塌落
          for (let dz = -1; dz <= 1; dz++) {
            if (!gone) b.set(x2, bY, bz + dz, dz === 0 ? B.metal_grate : B.planks);
          }
          if (!gone) {
            b.set(x2, bY + 1, bz - 2, B.chainlink);
            b.set(x2, bY + 1, bz + 2, B.chainlink);
            b.set(x2, bY + 2, bz - 2, mat('curtain', x2, bY + 2, bz - 2));
            b.set(x2, bY + 2, bz + 2, mat('curtain', x2, bY + 2, bz + 2));
            b.set(x2, bY + 3, bz, B.sheet_roof);
          }
          // 连廊底下垂藤
          if (U.hash2(x2, bz, 0x5b8) < 0.5) {
            for (let dy = 1; dy <= 3 + Math.floor(U.hash2(x2, 2, 9) * 6); dy++) {
              if (b.get(x2, bY - dy, bz) === 0) b.set(x2, bY - dy, bz, B.vine);
            }
          }
        }
        b.loot(bx0 + 1, bY + 1, bz, 'suitcase', 'civilian');
      });
    },
  });

  add({
    key: 'mossgate', name: '苔痕镇', x: 152, z: -96, r: 96, biome: 'suburb', noVeg: true, icon: '🏘', tier: 1,
    desc: '一条主街，十几栋房子，全部被藤蔓接管。',
    build(b) {
      const cx0 = b.x, cz0 = b.z;
      genRoad(b, cx0 - 80, cz0, cx0 + 80, cz0, 7, 1);
      genRoad(b, cx0, cz0 - 60, cx0, cz0 + 60, 5, 2);
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? 1 : -1;
        const px = cx0 - 70 + i * 10;
        const pz = cz0 + side * (9 + (i % 3) * 3);
        genHouse(b, px, side > 0 ? pz : pz - 9, 9, 9, 1 + (i % 2), { vine: 0.6 });
      }
      // 小超市 + 加油站雨棚
      genHall(b, cx0 + 18, cz0 - 30, 18, 14, 5, { wall: 'cinder', table: 'store' });
      genHouse(b, cx0 - 34, cz0 - 26, 11, 9, 1, { wall: 'brick', flat: true });
      // 镇中心水井与公告板
      b.part(cx0 - 6, cz0 - 6, cx0 + 6, cz0 + 6, () => {
        const gy = b.ground(cx0 + 3, cz0 + 4);
        b.fill(cx0 + 2, gy, cz0 + 3, cx0 + 4, gy, cz0 + 5, b.B.cobblestone);
        b.fill(cx0 + 3, gy - 4, cz0 + 4, cx0 + 3, gy, cz0 + 4, b.B.water_dirty);
        b.set(cx0 - 3, gy + 1, cz0 + 3, b.B.sign_post);
        b.loot(cx0 - 4, gy + 1, cz0 + 4, 'cash_register', 'register', ['keycard_blue']);
      });
    },
  });

  add({
    key: 'mall', name: '灰谷购物中心', x: -280, z: 160, r: 90, biome: 'suburb', noVeg: true, icon: '🏬', tier: 2,
    desc: '停车场变成了草原，卷帘门后面还有存货。',
    build(b) {
      genHall(b, b.x - 24, b.z - 18, 48, 36, 8, { wall: 'concrete', table: 'store', floor: 'tile' });
      // 停车场
      b.part(b.x - 40, b.z + 20, b.x + 40, b.z + 46, () => {
        b.forXZ(b.x - 40, b.z + 20, b.x + 40, b.z + 46, (px, pz) => {
          const gy = b.ground(px, pz);
          b.set(px, gy, pz, U.hash2(px, pz, 8) < 0.1 ? b.B.concrete_cracked : b.B.asphalt);
          if (U.hash2(px, pz, 9) < 0.06) b.set(px, gy + 1, pz, b.B.grass_tall);
        });
        for (let i = 0; i < 12; i++) {
          const px = b.x - 36 + i * 6, pz = b.z + 24 + (i % 3) * 8;
          if (U.hash2(px, pz, 10) < 0.55) genCarWreck(b, px, pz);
        }
      });
      // 内部店铺与货架阵列
      b.part(b.x - 22, b.z - 16, b.x + 22, b.z + 16, () => {
        const gy = b.ground(b.x, b.z) + 1;
        for (let px = b.x - 20; px <= b.x + 20; px += 4) for (let pz = b.z - 14; pz <= b.z + 14; pz += 5) {
          const t = U.hash2(px, pz, 0x3311);
          if (t < 0.5) b.loot(px, gy, pz, 'shelf_store', 'store');
          else if (t < 0.62) b.loot(px, gy, pz, 'vending', 'vending');
          else if (t < 0.7) b.loot(px, gy, pz, 'cash_register', 'register');
          else if (t < 0.76) b.loot(px, gy, pz, 'medbox', 'medical');
        }
        b.loot(b.x, gy, b.z, 'safe', 'safe', ['schem_armor']);
      });
    },
  });

  add({
    key: 'hospital', name: '圣马可医院', x: 356, z: 268, r: 80, biome: 'suburb', noVeg: true, icon: '🏥', tier: 3,
    desc: '走廊尽头的红门需要红色钥匙卡。地下停尸间还亮着一盏灯。',
    build(b) {
      genTower(b, b.x - 16, b.z - 12, 32, 24, 4, { wall: 'concrete', ruin: 0.1, vine: 0.8 });
      // 医疗层专属战利品
      b.part(b.x - 15, b.z - 11, b.x + 15, b.z + 11, () => {
        const gy = b.ground(b.x, b.z);
        for (let f = 0; f < 4; f++) {
          const fy = gy + f * 4 + 1;
          for (let px = b.x - 13; px <= b.x + 13; px += 5) for (let pz = b.z - 9; pz <= b.z + 9; pz += 6) {
            const t = U.hash2(px + f * 7, pz, 0x9a11);
            if (t < 0.34) b.loot(px, fy, pz, 'medbox', 'medical');
            else if (t < 0.5) b.set(px, fy, pz, b.B.bed_old);
            else if (t < 0.6) b.loot(px, fy, pz, 'locker', 'locker');
            else if (t < 0.68) b.loot(px, fy, pz, 'cabinet', 'office');
          }
        }
        // 上锁的院长办公室 + 红卡保险柜
        b.fill(b.x + 8, gy + 9, b.z + 4, b.x + 13, gy + 12, b.z + 9, 0);
        b.set(b.x + 8, gy + 9, b.z + 6, b.B.door_locked);
        b.loot(b.x + 12, gy + 9, b.z + 8, 'safe', 'safe', ['keycard_red', 'schem_chem']);
      });
      // 地下停尸间
      genUnderground(b, b.x - 8, b.z + 16, 16, 12, 9, { table: 'medical', crates: 10, wall: 'tile' });
    },
  });

  add({
    key: 'school', name: '第七中学', x: -430, z: -330, r: 80, biome: 'suburb', noVeg: true, icon: '🏫', tier: 2,
    desc: '操场长满了草。物理实验室里有台还没被拆的发射机。',
    build(b) {
      genTower(b, b.x - 20, b.z - 8, 40, 16, 2, { wall: 'brick', vine: 0.7, ruin: 0.08 });
      genHall(b, b.x - 12, b.z + 14, 24, 16, 7, { wall: 'cinder', table: 'locker' });
      // 操场
      b.part(b.x - 26, b.z + 34, b.x + 26, b.z + 60, () => {
        b.forXZ(b.x - 26, b.z + 34, b.x + 26, b.z + 60, (px, pz) => {
          const gy = b.ground(px, pz);
          b.set(px, gy, pz, b.B.grass);
          if (U.hash2(px, pz, 0x77) < 0.3) b.set(px, gy + 1, pz, b.B.grass_tall);
        });
      });
      b.part(b.x - 19, b.z - 7, b.x + 19, b.z + 7, () => {
        const gy = b.ground(b.x, b.z) + 1;
        for (let px = b.x - 17; px <= b.x + 17; px += 4) {
          b.loot(px, gy, b.z - 5, 'locker', 'locker');
          b.loot(px, gy + 4, b.z + 5, 'cabinet', 'office');
        }
        b.loot(b.x + 14, gy + 4, b.z - 4, 'toolbox', 'tools', ['radio_part_tube', 'note_3']);
        b.set(b.x, gy, b.z, b.B.bookshelf);
      });
    },
  });

  add({
    key: 'metro', name: '中央车站', x: 72, z: 436, r: 90, biome: 'suburb', noVeg: true, icon: '🚇', tier: 2,
    desc: '站厅塌了一半，隧道通向黑暗。带光源。',
    build(b) {
      genTower(b, b.x - 18, b.z - 14, 36, 28, 2, { wall: 'concrete', ruin: 0.3, vine: 0.9 });
      const fy = genUnderground(b, b.x - 14, b.z - 8, 28, 16, 12, { table: 'supply', crates: 12, h: 5 });
      // 隧道：向东西各延伸 90 格
      b.part(b.x - 110, b.z - 4, b.x + 110, b.z + 4, () => {
        const px0 = Math.max(b.x - 110, b.X0), px1 = Math.min(b.x + 110, b.X1);
        for (let px = px0; px <= px1; px++) {
          const yy = Math.max(8, b.ground(px, b.z) - 12);
          for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 4; dy++) {
            const wall = (Math.abs(dz) === 2 || dy === 0 || dy === 4);
            b.set(px, yy + dy, b.z + dz, wall ? mat('concrete', px, yy + dy, b.z + dz, 0.4) : 0);
          }
          b.set(px, yy + 1, b.z, U.hash2(px, 0, 3) < 0.5 ? b.B.rusty_metal : 0);
          if (px % 12 === 0) b.set(px, yy + 4, b.z, b.B.lamp_off);
          if (U.hash2(px, 7, 8) < 0.04) b.loot(px, yy + 1, b.z + 1, 'crate_supply', 'supply');
          if (U.hash2(px, 8, 9) < 0.03) b.loot(px, yy + 1, b.z - 1, 'backpack_drop', 'survivor');
          if (U.hash2(px, 9, 10) < 0.05) b.set(px, yy + 1, b.z + 1, b.B.glow_moss);
        }
      });
      b.part(b.x - 14, b.z - 8, b.x + 14, b.z + 8, () => {
        b.loot(b.x, fy, b.z, 'cash_register', 'register', ['keycard_blue', 'map_fragment']);
      });
    },
  });

  add({
    key: 'checkpoint', name: '南区检查站', x: -160, z: 540, r: 60, noVeg: true, icon: '🚧', tier: 2,
    desc: '沙袋、铁丝网、还有没人收走的弹药箱。',
    build(b) {
      const B = b.B;
      genRoad(b, b.x - 60, b.z, b.x + 60, b.z, 7, 4);
      b.part(b.x - 20, b.z - 14, b.x + 20, b.z + 14, () => {
        const gy = b.ground(b.x, b.z);
        // 沙袋掩体
        for (let px = b.x - 14; px <= b.x + 14; px++) {
          if (Math.abs(px - b.x) < 3) continue;
          for (let dy = 1; dy <= 2; dy++) { b.set(px, gy + dy, b.z - 6, B.sandbag); b.set(px, gy + dy, b.z + 6, B.sandbag); }
        }
        for (let pz = b.z - 6; pz <= b.z + 6; pz++) {
          if (Math.abs(pz - b.z) < 3) continue;
          b.set(b.x - 14, gy + 1, pz, B.chainlink); b.set(b.x + 14, gy + 1, pz, B.chainlink);
          b.set(b.x - 14, gy + 2, pz, B.barbed_wire); b.set(b.x + 14, gy + 2, pz, B.barbed_wire);
        }
        genHouse(b, b.x + 6, b.z + 8, 7, 7, 1, { wall: 'metal', flat: true, vine: 0.2 });
        b.loot(b.x - 8, gy + 1, b.z + 3, 'ammo_case', 'ammo');
        b.loot(b.x - 6, gy + 1, b.z + 3, 'crate_supply', 'supply');
        b.loot(b.x + 4, gy + 1, b.z - 3, 'medbox', 'medical');
        genCarWreck(b, b.x - 2, b.z - 2);
      });
    },
  });

  add({
    key: 'outpost', name: '三号军事哨所', x: 716, z: -556, r: 90, noVeg: true, icon: '🎖', tier: 4,
    desc: '围墙内还留着重装备。黄色钥匙卡就在军械库里。',
    build(b) {
      const B = b.B;
      const gy = b.ground(b.x, b.z);
      // 围墙
      b.part(b.x - 34, b.z - 34, b.x + 34, b.z + 34, () => {
        for (let px = b.x - 32; px <= b.x + 32; px++) {
          for (let dy = 1; dy <= 4; dy++) {
            b.set(px, gy + dy, b.z - 32, mat('concrete', px, gy + dy, b.z - 32, 0.3));
            b.set(px, gy + dy, b.z + 32, mat('concrete', px, gy + dy, b.z + 32, 0.3));
          }
        }
        for (let pz = b.z - 32; pz <= b.z + 32; pz++) {
          for (let dy = 1; dy <= 4; dy++) {
            b.set(b.x - 32, gy + dy, pz, mat('concrete', b.x - 32, gy + dy, pz, 0.3));
            b.set(b.x + 32, gy + dy, pz, mat('concrete', b.x + 32, gy + dy, pz, 0.3));
          }
        }
        b.fill(b.x - 2, gy + 1, b.z - 32, b.x + 2, gy + 4, b.z - 32, 0);   // 大门
        b.fill(b.x - 2, gy + 1, b.z - 32, b.x + 2, gy + 3, b.z - 32, B.chainlink);
      });
      genHall(b, b.x - 22, b.z - 20, 20, 16, 6, { wall: 'metal', table: 'ammo' });      // 军械库
      genHouse(b, b.x + 6, b.z - 18, 12, 12, 2, { wall: 'cinder', flat: true, vine: 0.2 }); // 营房
      genHall(b, b.x - 10, b.z + 6, 24, 14, 7, { wall: 'metal', table: 'garage' });      // 车库
      genTowerFrame(b, b.x + 24, b.z + 24, 14, { platformLoot: ['ammo_case', 'ammo', ['radio_part_ant']], mast: 3, lamp: true });
      b.part(b.x - 22, b.z - 20, b.x + 2, b.z - 4, () => {
        const iy = b.ground(b.x - 12, b.z - 12) + 1;
        b.loot(b.x - 20, iy, b.z - 18, 'safe', 'safe', ['keycard_yellow', 'schem_gun']);
        for (let i = 0; i < 6; i++) b.loot(b.x - 18 + i * 3, iy, b.z - 14, 'ammo_case', 'ammo');
        for (let i = 0; i < 4; i++) b.loot(b.x - 18 + i * 4, iy, b.z - 8, 'locker', 'locker');
      });
    },
  });

  add({
    key: 'greenhouse', name: '穹顶温室', x: -636, z: 392, r: 70, noVeg: true, icon: '🌱', tier: 2,
    desc: '玻璃穹顶下面，植物赢得彻底。种子和农业图纸都在这里。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      const R = 22;
      b.part(b.x - R - 2, b.z - R - 2, b.x + R + 2, b.z + R + 2, () => {
        // 基座
        b.forXZ(b.x - R, b.z - R, b.x + R, b.z + R, (px, pz) => {
          const d = Math.hypot(px - b.x, pz - b.z);
          if (d > R) return;
          b.set(px, gy, pz, d > R - 2 ? B.concrete : B.rich_soil);
        });
        // 穹顶（半球壳）
        for (let dy = 1; dy <= R; dy++) {
          const rr = Math.sqrt(Math.max(0, R * R - dy * dy * 1.15));
          for (let a = 0; a < 360; a += 3) {
            const px = b.x + Math.round(Math.cos(a * 0.01745) * rr);
            const pz = b.z + Math.round(Math.sin(a * 0.01745) * rr);
            const broken = U.hash3(px, gy + dy, pz, 0x2a) < 0.18;
            b.set(px, gy + dy, pz, broken ? 0 : (dy % 5 === 0 ? B.rusty_metal : B.glass_pane_green));
          }
        }
        // 内部苗床
        for (let px = b.x - R + 4; px <= b.x + R - 4; px += 3) for (let pz = b.z - R + 4; pz <= b.z + R - 4; pz += 4) {
          if (Math.hypot(px - b.x, pz - b.z) > R - 4) continue;
          b.set(px, gy + 1, pz, B.planter);
          const t = U.hash2(px, pz, 0x5f5f);
          const crops = ['crop_tomato', 'crop_corn', 'crop_cabbage', 'crop_bean', 'crop_carrot'];
          b.set(px, gy + 2, pz, B[crops[Math.floor(t * crops.length)] + '_' + (t < 0.4 ? 3 : 2)]);
          if (U.hash2(pz, px, 0x11) < 0.14) b.set(px + 1, gy + 1, pz + 1, B.thick_vine);
        }
        b.loot(b.x, gy + 1, b.z, 'crate_seed', 'seeds', ['schem_farm', 'scythe']);
        b.loot(b.x + 5, gy + 1, b.z + 3, 'crate_seed', 'seeds');
        b.loot(b.x - 5, gy + 1, b.z - 3, 'toolbox', 'tools');
        b.set(b.x + 2, gy + 1, b.z - 2, B.water_collector);
        b.set(b.x - 2, gy + 1, b.z + 2, B.chem_bench);
      });
    },
  });

  add({
    key: 'watertower', name: '旧水塔', x: 212, z: 196, r: 30, icon: '🗼', tier: 1,
    desc: '塔顶还有半罐水，也是极好的瞭望点。',
    build(b) { genTowerFrame(b, b.x, b.z, 16, { tank: true }); },
  });

  add({
    key: 'gasstation', name: '路口加油站', x: -96, z: 252, r: 40, noVeg: true, icon: '⛽', tier: 1,
    desc: '油罐还有余量。别在这里点火。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      genRoad(b, b.x - 50, b.z + 14, b.x + 50, b.z + 14, 7, 6);
      genHouse(b, b.x - 4, b.z - 8, 10, 8, 1, { wall: 'brick', flat: true, vine: 0.35 });
      b.part(b.x - 14, b.z - 4, b.x + 16, b.z + 12, () => {
        // 雨棚
        b.fill(b.x - 12, gy + 5, b.z + 2, b.x + 12, gy + 5, b.z + 10, B.sheet_roof);
        for (const px of [b.x - 11, b.x + 11]) for (const pz of [b.z + 3, b.z + 9]) b.fill(px, gy + 1, pz, px, gy + 4, pz, B.metal_panel);
        // 加油机
        for (let i = 0; i < 3; i++) {
          const px = b.x - 8 + i * 8;
          b.fill(px, gy + 1, b.z + 6, px, gy + 2, b.z + 6, B.metal_panel);
          if (U.hash2(px, i, 4) < 0.6) b.loot(px + 1, gy + 1, b.z + 6, 'toolbox', 'garage');
        }
        b.loot(b.x, gy + 1, b.z - 6, 'cash_register', 'register');
        b.loot(b.x + 3, gy + 1, b.z - 6, 'shelf_store', 'store');
        b.loot(b.x - 3, gy + 1, b.z - 6, 'fridge', 'fridge');
        // 油罐
        b.fill(b.x + 14, gy + 1, b.z + 2, b.x + 16, gy + 3, b.z + 8, B.rusty_metal);
        b.loot(b.x + 15, gy + 4, b.z + 5, 'crate_supply', 'garage', ['fuel_can']);
      });
    },
  });

  add({
    key: 'church', name: '圣殿废墟', x: 436, z: -172, r: 50, noVeg: true, icon: '⛪', tier: 1,
    desc: '有人在长椅上留下了很多张纸。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      genHouse(b, b.x - 8, b.z - 16, 17, 32, 1, { wall: 'brick', fh: 9, flat: false, vine: 0.8 });
      b.part(b.x - 8, b.z - 16, b.x + 10, b.z + 16, () => {
        for (let pz = b.z - 12; pz <= b.z + 10; pz += 3) {
          b.fill(b.x - 5, gy + 1, pz, b.x - 2, gy + 1, pz, B.bookshelf);
          b.fill(b.x + 3, gy + 1, pz, b.x + 6, gy + 1, pz, B.bookshelf);
        }
        b.set(b.x, gy + 1, b.z + 13, B.workbench);
        b.loot(b.x + 1, gy + 1, b.z + 13, 'suitcase', 'civilian', ['note_4']);
        b.loot(b.x - 1, gy + 1, b.z + 13, 'medbox', 'medical');
        // 钟塔
        for (let dy = 1; dy <= 18; dy++) {
          b.walls(b.x - 2, gy + dy, b.z - 16, b.x + 2, gy + dy, b.z - 12, 'brick', 0.4);
          b.set(b.x, gy + dy, b.z - 14, B.ladder);
        }
        b.set(b.x, gy + 19, b.z - 14, B.lamp_off);
      });
    },
  });

  add({
    key: 'farmstead', name: '柳溪农庄', x: -352, z: -540, r: 90, biome: 'farmland', noVeg: true, icon: '🌾', tier: 1,
    desc: '谷仓、田垄和一台还能拆零件的拖拉机。',
    build(b) {
      genHouse(b, b.x - 6, b.z - 24, 13, 11, 2, { wall: 'plaster', vine: 0.5 });
      genHall(b, b.x + 12, b.z - 10, 22, 18, 9, { wall: 'wood', table: 'seeds', floor: 'floorw' });
      genField(b, b.x - 40, b.z + 6, 34, 26, 'crop_wheat');
      genField(b, b.x + 4, b.z + 14, 26, 20, 'crop_corn');
      b.part(b.x - 10, b.z - 30, b.x + 36, b.z + 8, () => {
        const gy = b.ground(b.x, b.z);
        genCarWreck(b, b.x + 2, b.z - 2);
        b.loot(b.x + 20, gy + 1, b.z - 2, 'crate_seed', 'seeds', ['schem_farm']);
        b.loot(b.x + 24, gy + 1, b.z - 4, 'toolbox', 'tools');
        for (let i = 0; i < 4; i++) b.fill(b.x + 14 + i * 3, gy + 1, b.z + 2, b.x + 15 + i * 3, gy + 2, b.z + 3, b.B.hay_bale);
        b.set(b.x - 2, gy + 1, b.z - 12, b.B.water_collector);
        b.set(b.x - 4, gy + 1, b.z - 12, b.B.drying_rack);
      });
    },
  });

  add({
    key: 'windfarm', name: '风力发电场', x: 872, z: 312, r: 110, icon: '🌀', tier: 3,
    desc: '六座风机，其中一座的机舱里有稳压模块。',
    build(b) {
      for (let i = 0; i < 6; i++) {
        const px = b.x + (i % 3) * 34 - 34, pz = b.z + Math.floor(i / 3) * 40 - 20;
        genTowerFrame(b, px, pz, 22 + (i % 3) * 4, {
          mast: 2, lamp: i === 2,
          platformLoot: i === 4 ? ['toolbox', 'tools', ['radio_part_gen', 'schem_power']] : ['toolbox', 'tools', null],
        });
      }
      genHouse(b, b.x - 8, b.z + 30, 10, 8, 1, { wall: 'metal', flat: true, vine: 0.3 });
      b.part(b.x - 8, b.z + 30, b.x + 4, b.z + 40, () => {
        const gy = b.ground(b.x, b.z + 34) + 1;
        b.set(b.x - 5, gy, b.z + 33, b.B.generator);
        b.set(b.x - 3, gy, b.z + 33, b.B.solar_panel);
        b.loot(b.x - 1, gy, b.z + 33, 'toolbox', 'tools');
      });
    },
  });

  add({
    key: 'radiotower', name: '长风电波塔', x: 1140, z: -896, r: 80, noVeg: true, icon: '📡', tier: 5,
    desc: '主线终点：修好它，把信号发出去。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      genTowerFrame(b, b.x, b.z, 46, { mast: 6, lamp: true, platformLoot: ['ammo_case', 'ammo', null] });
      genHouse(b, b.x - 12, b.z + 6, 13, 11, 1, { wall: 'concrete', flat: true, vine: 0.4 });
      b.part(b.x - 12, b.z + 6, b.x + 2, b.z + 18, () => {
        const iy = b.ground(b.x - 6, b.z + 11) + 1;
        b.set(b.x - 6, iy, b.z + 8, B.radio_console);
        b.set(b.x - 8, iy, b.z + 8, B.generator);
        b.set(b.x - 4, iy, b.z + 8, B.chem_bench);
        b.loot(b.x - 10, iy, b.z + 14, 'safe', 'safe', ['schem_radio', 'note_14']);
        b.loot(b.x - 6, iy, b.z + 14, 'ammo_case', 'ammo');
        b.loot(b.x - 3, iy, b.z + 14, 'medbox', 'medical');
        b.set(b.x - 6, iy, b.z + 12, B.bed_old);
        b.set(b.x - 8, iy, b.z + 12, B.chest);
      });
      // 防御工事
      b.part(b.x - 20, b.z - 20, b.x + 20, b.z + 24, () => {
        for (let a = 0; a < 360; a += 6) {
          const px = b.x + Math.round(Math.cos(a * 0.01745) * 18), pz = b.z + Math.round(Math.sin(a * 0.01745) * 18);
          const g2 = b.ground(px, pz);
          b.set(px, g2 + 1, pz, B.sandbag);
          if (U.hash2(px, pz, 6) < 0.5) b.set(px, g2 + 2, pz, B.barbed_wire);
        }
      });
    },
  });

  add({
    key: 'quarry', name: '北岭采石场', x: -896, z: -176, r: 90, noVeg: true, icon: '⛏', tier: 2,
    desc: '露天矿坑，矿脉裸露，也很容易掉下去。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      b.part(b.x - 40, b.z - 40, b.x + 40, b.z + 40, () => {
        b.forXZ(b.x - 38, b.z - 38, b.x + 38, b.z + 38, (px, pz) => {
          const d = Math.hypot(px - b.x, pz - b.z);
          if (d > 36) return;
          const depth = Math.round((1 - d / 36) * 22);
          for (let dy = 0; dy < depth; dy++) b.set(px, gy - dy, pz, 0);
          const fy = gy - depth;
          b.set(px, fy, pz, U.hash2(px, pz, 12) < 0.2 ? B.gravel : B.stone);
          // 台阶上暴露的矿脉
          const t = U.hash2(px, pz, 0x77aa);
          if (t < 0.03) b.set(px, fy, pz, B.iron_ore);
          else if (t < 0.05) b.set(px, fy, pz, B.coal_ore);
          else if (t < 0.06) b.set(px, fy, pz, B.copper_ore);
        });
      });
      genHall(b, b.x + 40, b.z - 8, 18, 14, 6, { wall: 'metal', table: 'tools' });
      b.part(b.x + 40, b.z - 8, b.x + 58, b.z + 8, () => {
        const g2 = b.ground(b.x + 48, b.z) + 1;
        b.loot(b.x + 44, g2, b.z - 4, 'toolbox', 'tools', ['pick_iron', 'schem_steel']);
        b.set(b.x + 50, g2, b.z, b.B.forge);
        b.set(b.x + 52, g2, b.z, b.B.furnace);
      });
    },
  });

  add({
    key: 'sawmill', name: '西河锯木厂', x: -1064, z: 472, r: 70, noVeg: true, icon: '🪵', tier: 2,
    desc: '堆场里的原木还能用，锯台也许还能修。',
    build(b) {
      genHall(b, b.x - 14, b.z - 12, 28, 22, 8, { wall: 'wood', table: 'tools', floor: 'floorw' });
      b.part(b.x - 30, b.z - 16, b.x + 20, b.z + 20, () => {
        const gy = b.ground(b.x, b.z) + 1;
        for (let i = 0; i < 8; i++) {
          const px = b.x - 28 + (i % 4) * 4, pz = b.z + 14 + Math.floor(i / 4) * 4;
          const g2 = b.ground(px, pz);
          b.fill(px, g2 + 1, pz, px + 2, g2 + 2, pz + 1, b.B.log_oak);
        }
        b.loot(b.x - 8, gy, b.z - 8, 'toolbox', 'tools', ['saw_hand', 'axe_iron']);
        b.set(b.x, gy, b.z, b.B.workbench);
        b.set(b.x + 2, gy, b.z, b.B.workbench);
        b.set(b.x - 4, gy, b.z + 4, b.B.drying_rack);
      });
    },
  });

  add({
    key: 'sunken', name: '沉没村落', x: 536, z: 716, r: 80, noVeg: true, icon: '🌊', tier: 2,
    desc: '水位上升了三米。屋顶成了小岛。',
    build(b) {
      for (let i = 0; i < 9; i++) {
        const px = b.x - 30 + (i % 3) * 24, pz = b.z - 30 + Math.floor(i / 3) * 24;
        genHouse(b, px, pz, 9, 9, 1, { y: SEA - 2, vine: 0.9, wall: 'plaster' });
      }
      b.part(b.x - 36, b.z - 36, b.x + 36, b.z + 36, () => {
        b.forXZ(b.x - 36, b.z - 36, b.x + 36, b.z + 36, (px, pz) => {
          for (let y = SEA - 6; y <= SEA; y++) if (b.get(px, y, pz) === 0) b.set(px, y, pz, b.B.water_dirty);
          if (U.hash2(px, pz, 0x88) < 0.03) b.set(px, SEA + 1, pz, b.B.reeds);
        });
        b.loot(b.x, SEA + 3, b.z, 'crate_supply', 'supply', ['note_5']);
      });
    },
  });

  add({
    key: 'interchange', name: '断裂立交', x: -48, z: -664, r: 90, noVeg: true, icon: '🛣', tier: 1,
    desc: '两条高速在这里断成悬崖，桥墩上缠满巨藤。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      const deck = gy + 12;
      b.part(b.x - 60, b.z - 60, b.x + 60, b.z + 60, () => {
        // 东西高架
        for (let px = Math.max(b.x - 60, b.X0 - 1); px <= Math.min(b.x + 60, b.X1 + 1); px++) {
          const gap = Math.abs(px - b.x) > 12 && Math.abs(px - b.x) < 20;
          if (gap) continue;
          for (let pz = b.z - 4; pz <= b.z + 4; pz++) {
            b.set(px, deck, pz, Math.abs(pz - b.z) < 1 ? B.road_line : B.asphalt);
            if (Math.abs(pz - b.z) === 4) b.set(px, deck + 1, pz, B.concrete_cracked);
          }
          if (px % 14 === 0) for (let dy = 1; dy < 12; dy++) b.fill(px - 1, gy + dy, b.z - 1, px + 1, gy + dy, b.z + 1, mat('rebar', px, gy + dy, b.z, 0.4));
          if (U.hash2(px, 3, 9) < 0.1) genCarWreck(b, px, b.z - 2);
        }
        // 南北高架（低一层）
        for (let pz = Math.max(b.z - 60, b.Z0 - 1); pz <= Math.min(b.z + 60, b.Z1 + 1); pz++) {
          const gap = Math.abs(pz - b.z) > 8 && Math.abs(pz - b.z) < 14;
          if (gap) continue;
          for (let px = b.x - 4; px <= b.x + 4; px++) b.set(px, gy + 6, pz, Math.abs(px - b.x) < 1 ? B.road_line : B.asphalt);
          if (pz % 14 === 0) for (let dy = 1; dy < 6; dy++) b.fill(b.x - 1, gy + dy, pz - 1, b.x + 1, gy + dy, pz + 1, mat('rebar', b.x, gy + dy, pz, 0.4));
        }
        // 桥墩藤蔓
        for (let i = 0; i < 60; i++) {
          const px = b.x - 40 + Math.floor(U.hash2(i, 1, 3) * 80), pz = b.z - 40 + Math.floor(U.hash2(i, 2, 4) * 80);
          for (let dy = 0; dy < 8; dy++) if (b.get(px, deck - 1 - dy, pz) === 0) b.set(px, deck - 1 - dy, pz, B.thick_vine);
        }
        b.loot(b.x + 22, deck + 1, b.z, 'backpack_drop', 'survivor', ['note_6']);
      });
    },
  });

  add({
    key: 'crash', name: '坠机现场', x: 996, z: 836, r: 60, noVeg: true, icon: '✈', tier: 3,
    desc: '一条犁开森林的焦痕，尽头是断裂的机身。',
    build(b) {
      const B = b.B;
      b.part(b.x - 50, b.z - 20, b.x + 30, b.z + 20, () => {
        // 犁痕
        for (let i = 0; i < 70; i++) {
          const px = b.x - 50 + i, pz = b.z + Math.round(Math.sin(i * 0.12) * 4);
          for (let dz = -4; dz <= 4; dz++) {
            const g2 = b.ground(px, pz + dz);
            b.set(px, g2, pz + dz, U.hash2(px, pz + dz, 2) < 0.4 ? B.ash : B.dirt);
            b.set(px, g2 + 1, pz + dz, 0);
            if (U.hash2(px, pz + dz, 5) < 0.08) b.set(px, g2 + 1, pz + dz, B.bush_dead);
            if (U.hash2(px, pz + dz, 6) < 0.04) b.set(px, g2 + 1, pz + dz, B.scrap_pile === undefined ? B.rubble : B.rubble);
          }
        }
        // 机身
        const gy = b.ground(b.x + 14, b.z);
        for (let i = 0; i < 22; i++) {
          const px = b.x + 4 + i;
          const r = 3;
          for (let dy = 0; dy <= r * 2; dy++) for (let dz = -r; dz <= r; dz++) {
            const d = Math.hypot(dy - r, dz);
            if (d > r) continue;
            const shell = d > r - 1;
            const hole = U.hash3(px, dy, dz, 7) < 0.18;
            b.set(px, gy + 1 + dy, b.z + dz, shell ? (hole ? 0 : B.metal_panel) : 0);
          }
          if (i % 5 === 0) b.set(px, gy + 2, b.z, B.metal_grate);
        }
        // 机翼
        for (let i = 0; i < 14; i++) { b.set(b.x + 12 + (i >> 1), gy + 2, b.z - 4 - i, B.rusty_metal); b.set(b.x + 12 + (i >> 1), gy + 2, b.z + 4 + i, B.rusty_metal); }
        for (let i = 0; i < 5; i++) b.loot(b.x + 6 + i * 3, gy + 2, b.z + (i % 2 ? 1 : -1), 'crate_supply', i === 2 ? 'ammo' : 'supply', i === 2 ? ['schem_gun'] : null);
        b.loot(b.x + 20, gy + 2, b.z, 'safe', 'safe', ['gps']);
      });
    },
  });

  add({
    key: 'bunker', name: '地下掩体 D-9', x: -1256, z: -912, r: 60, noVeg: true, icon: '🚪', tier: 5,
    desc: '厚重的铁门需要黄色钥匙卡。里面有关于绿蚀的答案。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      // 地面入口堡
      b.part(b.x - 8, b.z - 8, b.x + 8, b.z + 8, () => {
        b.fillMat(b.x - 6, gy + 1, b.z - 6, b.x + 6, gy + 4, b.z + 6, 'rebar', 0.3);
        b.clearBox(b.x - 5, gy + 1, b.z - 5, b.x + 5, gy + 3, b.z + 5);
        b.fillMat(b.x - 6, gy + 5, b.z - 6, b.x + 6, gy + 5, b.z + 6, 'rebar', 0.2);
        b.set(b.x, gy + 1, b.z - 6, B.door_locked);
        b.set(b.x, gy + 2, b.z - 6, B.door_locked);
        b.loot(b.x + 4, gy + 1, b.z + 4, 'locker', 'locker');
      });
      const fy = genUnderground(b, b.x - 12, b.z - 10, 24, 20, 16, {
        table: 'lab', crates: 14, h: 5, wall: 'metal', shaftX: b.x, shaftZ: b.z,
      });
      b.part(b.x - 12, b.z - 10, b.x + 12, b.z + 10, () => {
        b.loot(b.x - 9, fy, b.z - 7, 'safe', 'safe', ['research_notes', 'note_12']);
        b.loot(b.x + 9, fy, b.z + 7, 'safe', 'safe', ['vaccine_proto', 'note_13']);
        b.set(b.x, fy, b.z + 6, B.chem_bench);
        b.set(b.x + 2, fy, b.z + 6, B.chem_bench);
        b.set(b.x - 2, fy, b.z + 6, B.generator);
        for (let i = 0; i < 5; i++) b.loot(b.x - 8 + i * 4, fy, b.z, 'medbox', 'medical');
        b.set(b.x - 6, fy, b.z - 4, B.bed_old);
        b.set(b.x - 4, fy, b.z - 4, B.bed_old);
        b.set(b.x, fy + 4, b.z, B.lamp_on);
      });
      // 深层第二区（需要打通）
      genUnderground(b, b.x - 10, b.z + 16, 20, 14, 24, { table: 'lab', crates: 10, h: 5, wall: 'metal', shaft: false });
    },
  });

  add({
    key: 'research', name: '研究站 GV-2', x: 1336, z: 536, r: 70, noVeg: true, icon: '🧪', tier: 4,
    desc: '绿蚀是从这里流出去的。低温样本管还在。',
    build(b) {
      const B = b.B;
      genTower(b, b.x - 14, b.z - 10, 28, 20, 3, { wall: 'metal', ruin: 0.08, vine: 0.5 });
      b.part(b.x - 14, b.z - 10, b.x + 14, b.z + 10, () => {
        const gy = b.ground(b.x, b.z);
        for (let f = 0; f < 3; f++) {
          const fy = gy + f * 4 + 1;
          for (let px = b.x - 11; px <= b.x + 11; px += 4) for (let pz = b.z - 7; pz <= b.z + 7; pz += 5) {
            const t = U.hash2(px + f * 5, pz, 0xa1a1);
            if (t < 0.4) b.loot(px, fy, pz, 'cabinet', 'lab');
            else if (t < 0.55) b.set(px, fy, pz, B.chem_bench);
            else if (t < 0.65) b.loot(px, fy, pz, 'medbox', 'medical');
          }
        }
        b.loot(b.x, gy + 9, b.z, 'safe', 'safe', ['lab_sample', 'radio_part_board', 'note_9']);
        // 培养舱：菌毯与孢子
        for (let px = b.x - 6; px <= b.x + 6; px++) for (let pz = b.z - 4; pz <= b.z + 4; pz++) {
          if (U.hash2(px, pz, 0xb2) < 0.35) b.set(px, gy + 1, pz, B.fungal_wall);
          if (U.hash2(px, pz, 0xb3) < 0.14) b.set(px, gy + 2, pz, B.spore_stalk);
        }
      });
      genUnderground(b, b.x - 8, b.z + 14, 16, 12, 10, { table: 'lab', crates: 10, wall: 'tile' });
    },
  });

  add({
    key: 'lighthouse', name: '断崖灯塔', x: -1512, z: 1096, r: 50, noVeg: true, icon: '🗼', tier: 2,
    desc: '灯还能亮，如果你能给它供电。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      b.part(b.x - 8, b.z - 8, b.x + 8, b.z + 8, () => {
        for (let dy = 1; dy <= 30; dy++) {
          const r = dy < 26 ? 4 - Math.floor(dy / 12) : 3;
          for (let a = 0; a < 360; a += 8) {
            const px = b.x + Math.round(Math.cos(a * 0.01745) * r), pz = b.z + Math.round(Math.sin(a * 0.01745) * r);
            b.set(px, gy + dy, pz, dy % 6 < 3 ? B.plaster : B.brick);
          }
          b.set(b.x, gy + dy, b.z, B.ladder);
        }
        b.fill(b.x - 3, gy + 31, b.z - 3, b.x + 3, gy + 31, b.z + 3, B.metal_grate);
        b.fill(b.x - 2, gy + 32, b.z - 2, b.x + 2, gy + 34, b.z + 2, B.glass);
        b.set(b.x, gy + 33, b.z, B.lamp_on);
        b.loot(b.x + 2, gy + 31, b.z + 2, 'toolbox', 'tools', ['schem_power']);
        genHouse(b, b.x + 6, b.z + 6, 9, 8, 1, { wall: 'plaster', vine: 0.6 });
      });
    },
  });

  add({
    key: 'junkyard', name: '汽车墓场', x: 652, z: -272, r: 80, noVeg: true, icon: '🚗', tier: 2,
    desc: '几百辆车叠成小山。零件天堂。',
    build(b) {
      const B = b.B;
      b.part(b.x - 40, b.z - 40, b.x + 40, b.z + 40, () => {
        for (let i = 0; i < 90; i++) {
          const px = b.x - 36 + Math.floor(U.hash2(i, 1, 11) * 72);
          const pz = b.z - 36 + Math.floor(U.hash2(i, 2, 12) * 72);
          const stack = 1 + Math.floor(U.hash2(px, pz, 13) * 3);
          for (let s = 0; s < stack; s++) {
            const g2 = b.ground(px, pz) + 1 + s * 2;
            b.fill(px, g2, pz, px + 3, g2 + 1, pz + 1, B.wreck_metal);
            if (U.hash2(px + s, pz, 14) < 0.25) b.loot(px + 1, g2 + 2, pz, 'suitcase', 'garage');
          }
        }
        for (let i = 0; i < 24; i++) {
          const px = b.x - 36 + i * 3;
          const g2 = b.ground(px, b.z - 38);
          b.set(px, g2 + 1, b.z - 38, B.chainlink); b.set(px, g2 + 2, b.z - 38, B.chainlink);
        }
      });
      genHall(b, b.x + 42, b.z - 8, 16, 14, 6, { wall: 'metal', table: 'garage' });
      b.part(b.x + 42, b.z - 8, b.x + 58, b.z + 6, () => {
        const g2 = b.ground(b.x + 50, b.z) + 1;
        b.loot(b.x + 46, g2, b.z - 4, 'toolbox', 'garage', ['radio_part_tube', 'crowbar']);
        b.set(b.x + 50, g2, b.z, b.B.forge);
        b.loot(b.x + 52, g2, b.z + 2, 'crate_supply', 'garage');
      });
    },
  });

  add({
    key: 'prison', name: '橡岭监狱', x: -716, z: 916, r: 90, noVeg: true, icon: '🔒', tier: 3,
    desc: '高墙现在保护的是里面的补给，不是外面的人。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      b.part(b.x - 34, b.z - 34, b.x + 34, b.z + 34, () => {
        for (let px = b.x - 32; px <= b.x + 32; px++) for (const pz of [b.z - 32, b.z + 32])
          for (let dy = 1; dy <= 6; dy++) b.set(px, gy + dy, pz, mat('concrete', px, gy + dy, pz, 0.35));
        for (let pz = b.z - 32; pz <= b.z + 32; pz++) for (const px of [b.x - 32, b.x + 32])
          for (let dy = 1; dy <= 6; dy++) b.set(px, gy + dy, pz, mat('concrete', px, gy + dy, pz, 0.35));
        b.fill(b.x - 2, gy + 1, b.z - 32, b.x + 2, gy + 4, b.z - 32, 0);
      });
      genTower(b, b.x - 20, b.z - 12, 40, 24, 2, { wall: 'cinder', ruin: 0.1, vine: 0.5 });
      b.part(b.x - 20, b.z - 12, b.x + 20, b.z + 12, () => {
        // 牢房
        for (let px = b.x - 18; px <= b.x + 16; px += 5) for (const pz of [b.z - 9, b.z + 6]) {
          b.fill(px, gy + 1, pz, px, gy + 3, pz + 3, B.chainlink);
          b.set(px, gy + 1, pz + 1, 0);
          b.set(px + 2, gy + 1, pz + 2, B.bed_old);
          if (U.hash2(px, pz, 0xc1) < 0.4) b.loot(px + 3, gy + 1, pz + 1, 'locker', 'locker');
        }
        b.loot(b.x, gy + 5, b.z, 'ammo_case', 'ammo', ['schem_armor']);
        b.loot(b.x + 6, gy + 1, b.z, 'medbox', 'medical');
        b.loot(b.x - 6, gy + 1, b.z, 'crate_supply', 'supply');
      });
      genTowerFrame(b, b.x + 30, b.z - 30, 12, { platformLoot: ['ammo_case', 'ammo', null] });
    },
  });

  add({
    key: 'nest', name: '孢母巢', x: 316, z: -1016, r: 80, biome: 'blight', noVeg: true, icon: '☣', tier: 4,
    desc: '空气是绿色的。戴面具，别停留。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      b.part(b.x - 40, b.z - 40, b.x + 40, b.z + 40, () => {
        b.forXZ(b.x - 38, b.z - 38, b.x + 38, b.z + 38, (px, pz) => {
          const d = Math.hypot(px - b.x, pz - b.z);
          if (d > 36) return;
          const g2 = b.ground(px, pz);
          b.set(px, g2, pz, B.blight_soil);
          const t = U.hash2(px, pz, 0xd1);
          if (d < 12) {
            if (t < 0.45) b.set(px, g2 + 1, pz, B.fungal_wall);
            if (t > 0.8) b.set(px, g2 + 2, pz, B.spore_stalk);
          } else {
            if (t < 0.12) b.set(px, g2 + 1, pz, B.spore_stalk);
            else if (t < 0.2) b.set(px, g2 + 1, pz, B.mushroom_toxic);
            else if (t < 0.26) b.set(px, g2 + 1, pz, B.bush_dead);
          }
        });
        // 巢体：菌柱穹丘
        for (let dy = 1; dy <= 16; dy++) {
          const rr = Math.max(1, 11 - dy * 0.65);
          for (let a = 0; a < 360; a += 6) {
            const px = b.x + Math.round(Math.cos(a * 0.01745) * rr), pz = b.z + Math.round(Math.sin(a * 0.01745) * rr);
            b.set(px, gy + dy, pz, U.hash3(px, dy, pz, 0xd2) < 0.2 ? B.spore_stalk : B.fungal_wall);
          }
        }
        b.loot(b.x, gy + 1, b.z, 'crate_supply', 'lab', ['serum_green', 'spore_sample', 'note_10']);
        b.loot(b.x + 6, gy + 1, b.z + 6, 'backpack_drop', 'survivor', ['gasmask']);
      });
    },
  });

  add({
    key: 'survivorcamp', name: '幸存者哨站遗址', x: -208, z: -196, r: 50, noVeg: true, icon: '🏕', tier: 1,
    desc: '木墙、了望塔、和一封没送出去的信。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      b.part(b.x - 18, b.z - 18, b.x + 18, b.z + 18, () => {
        for (let px = b.x - 16; px <= b.x + 16; px++) for (const pz of [b.z - 16, b.z + 16])
          for (let dy = 1; dy <= 3; dy++) b.set(px, gy + dy, pz, B.planks);
        for (let pz = b.z - 16; pz <= b.z + 16; pz++) for (const px of [b.x - 16, b.x + 16])
          for (let dy = 1; dy <= 3; dy++) b.set(px, gy + dy, pz, B.planks);
        b.fill(b.x - 1, gy + 1, b.z - 16, b.x + 1, gy + 3, b.z - 16, 0);
      });
      genCamp(b, b.x, b.z + 4, 8, { table: 'survivor' });
      genHouse(b, b.x - 12, b.z - 12, 9, 8, 1, { wall: 'wood', flat: true, vine: 0.3 });
      genTowerFrame(b, b.x + 12, b.z - 12, 10, { platformLoot: ['crate_supply', 'survivor', ['note_7', 'binoculars']] });
      b.part(b.x - 12, b.z - 12, b.x - 2, b.z - 2, () => {
        const iy = b.ground(b.x - 8, b.z - 8) + 1;
        b.set(b.x - 10, iy, b.z - 10, B.workbench);
        b.set(b.x - 8, iy, b.z - 10, B.furnace);
        b.set(b.x - 6, iy, b.z - 10, B.chest);
        b.loot(b.x - 10, iy, b.z - 6, 'crate_supply', 'supply', ['note_8']);
      });
    },
  });

  add({
    key: 'dam', name: '灰水大坝', x: 916, z: 108, r: 90, noVeg: true, icon: '🏗', tier: 3,
    desc: '混凝土巨物横跨峡谷，机房里还有发电设备。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      b.part(b.x - 8, b.z - 50, b.x + 8, b.z + 50, () => {
        for (let pz = Math.max(b.z - 48, b.Z0); pz <= Math.min(b.z + 48, b.Z1); pz++) {
          for (let dy = -14; dy <= 10; dy++) for (let dx = -6; dx <= 6; dx++) {
            const taper = Math.abs(dx) <= 6 - Math.floor((dy + 14) / 6);
            if (!taper) continue;
            b.set(b.x + dx, gy + dy, pz, mat('rebar', b.x + dx, gy + dy, pz, 0.2));
          }
          b.set(b.x, gy + 11, pz, B.road_line);
          for (let dx = -5; dx <= 5; dx++) if (dx) b.set(b.x + dx, gy + 11, pz, B.asphalt);
          if (pz % 8 === 0) { b.set(b.x - 6, gy + 12, pz, B.metal_grate); b.set(b.x + 6, gy + 12, pz, B.metal_grate); }
        }
      });
      genUnderground(b, b.x - 4, b.z - 8, 10, 16, 10, { table: 'garage', crates: 8, wall: 'concrete', h: 5 });
      b.part(b.x - 4, b.z - 8, b.x + 6, b.z + 8, () => {
        const fy = Math.max(8, b.ground(b.x, b.z) - 10);
        b.set(b.x, fy, b.z, B.generator);
        b.set(b.x + 2, fy, b.z, B.generator);
        b.loot(b.x - 2, fy, b.z + 4, 'toolbox', 'tools', ['schem_power', 'radio_part_board']);
      });
    },
  });

  add({
    key: 'trainyard', name: '编组站', x: -520, z: 620, r: 80, noVeg: true, icon: '🚆', tier: 2,
    desc: '一列货运车厢里塞满了没送出去的物资。',
    build(b) {
      const B = b.B;
      b.part(b.x - 50, b.z - 20, b.x + 50, b.z + 20, () => {
        for (let t = 0; t < 3; t++) {
          const pz = b.z - 8 + t * 8;
          for (let px = Math.max(b.x - 48, b.X0); px <= Math.min(b.x + 48, b.X1); px++) {
            const g2 = b.ground(px, pz);
            b.set(px, g2, pz, B.gravel);
            b.set(px, g2 + 1, pz - 1, B.rusty_metal);
            b.set(px, g2 + 1, pz + 1, B.rusty_metal);
          }
          // 车厢
          for (let c = 0; c < 5; c++) {
            const cx0 = b.x - 44 + c * 20;
            if (U.hash2(cx0, pz, 0xe1) > 0.7) continue;
            const g2 = b.ground(cx0, pz) + 1;
            for (let px = cx0; px < cx0 + 14; px++) for (let dy = 0; dy < 5; dy++) for (let dz = -2; dz <= 2; dz++) {
              const shell = dy === 0 || dy === 4 || Math.abs(dz) === 2 || px === cx0 || px === cx0 + 13;
              const hole = U.hash3(px, dy, dz, 0xe2) < 0.1;
              b.set(px, g2 + dy, pz + dz, shell ? (hole ? 0 : B.metal_panel) : 0);
            }
            for (let i = 0; i < 4; i++) {
              const t2 = U.hash2(cx0 + i, pz, 0xe3);
              b.loot(cx0 + 2 + i * 3, g2 + 1, pz, 'crate_supply', t2 < 0.3 ? 'ammo' : (t2 < 0.6 ? 'supply' : 'store'));
            }
          }
        }
      });
      genHall(b, b.x - 12, b.z + 14, 24, 14, 7, { wall: 'metal', table: 'tools' });
    },
  });

  add({
    key: 'observatory', name: '山顶观测站', x: 1420, z: -420, r: 60, noVeg: true, icon: '🔭', tier: 3,
    desc: '视野极佳。夜里能看到远处城市的火光。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      b.part(b.x - 14, b.z - 14, b.x + 14, b.z + 14, () => {
        for (let dy = 1; dy <= 8; dy++) for (let a = 0; a < 360; a += 5) {
          const r = 9;
          const px = b.x + Math.round(Math.cos(a * 0.01745) * r), pz = b.z + Math.round(Math.sin(a * 0.01745) * r);
          b.set(px, gy + dy, pz, mat('concrete', px, gy + dy, pz, 0.25));
        }
        b.fill(b.x - 8, gy, b.z - 8, b.x + 8, gy, b.z + 8, B.tile_dirty);
        // 穹顶
        for (let dy = 9; dy <= 15; dy++) {
          const rr = Math.sqrt(Math.max(0, 81 - (dy - 9) * (dy - 9) * 1.6));
          for (let a = 0; a < 360; a += 5) {
            const px = b.x + Math.round(Math.cos(a * 0.01745) * rr), pz = b.z + Math.round(Math.sin(a * 0.01745) * rr);
            b.set(px, gy + dy, pz, U.hash3(px, dy, pz, 0xf1) < 0.15 ? 0 : B.metal_panel);
          }
        }
        b.set(b.x, gy + 1, b.z, B.radio_console);
        b.loot(b.x + 4, gy + 1, b.z, 'safe', 'safe', ['binoculars', 'schem_radio', 'note_11']);
        b.loot(b.x - 4, gy + 1, b.z, 'cabinet', 'lab');
        b.set(b.x, gy + 1, b.z + 5, B.ladder);
        b.set(b.x + 2, gy + 1, b.z + 4, B.bed_old);
      });
    },
  });

  add({
    key: 'vinebridge', name: '藤桥峡谷', x: 480, z: 60, r: 70, noVeg: false, icon: '🌉', tier: 1,
    desc: '峡谷之间只有一条被巨藤缠住的旧吊桥。',
    build(b) {
      const B = b.B, gy = b.ground(b.x, b.z);
      b.part(b.x - 40, b.z - 8, b.x + 40, b.z + 8, () => {
        // 峡谷
        b.forXZ(b.x - 40, b.z - 8, b.x + 40, b.z + 8, (px, pz) => {
          const d = Math.abs(pz - b.z);
          if (d > 6) return;
          const depth = Math.round((1 - d / 6) * 24);
          for (let dy = 0; dy < depth; dy++) b.set(px, gy - dy, pz, 0);
          if (depth > 12) b.set(px, gy - depth, pz, B.water);
        });
        // 吊桥
        for (let px = Math.max(b.x - 40, b.X0); px <= Math.min(b.x + 40, b.X1); px++) {
          const sag = Math.round(Math.sin((px - b.x + 40) / 80 * Math.PI) * -2);
          for (let dz = -1; dz <= 1; dz++) b.set(px, gy + sag, b.z + dz, B.planks);
          if (px % 4 === 0) { b.set(px, gy + sag + 1, b.z - 2, B.rope === undefined ? B.fence_wood : B.fence_wood); b.set(px, gy + sag + 1, b.z + 2, B.fence_wood); }
          if (U.hash2(px, 1, 0xa) < 0.3) b.set(px, gy + sag - 1, b.z + (U.hash2(px, 2, 0xb) < 0.5 ? 1 : -1), B.thick_vine);
        }
        b.loot(b.x, gy + 1, b.z + 4, 'backpack_drop', 'survivor');
      });
    },
  });

  /* --------------------------------------- 地标索引与几何辅助 */
  L.forEach((l, i) => {
    l.index = i;
    l.x = l.x | 0; l.z = l.z | 0;
    l.baseY = null;
  });

  function baseYOf(wg, l) {
    if (l.baseY != null) return l.baseY;
    let s = 0, n = 0;
    for (const [dx, dz] of [[0, 0], [-8, 0], [8, 0], [0, -8], [0, 8], [-14, -14], [14, 14]]) {
      s += wg.rawHeight(l.x + dx, l.z + dz); n++;
    }
    let y = Math.round(s / n);
    y = Math.max(SEA + 2, Math.min(GF.HEIGHT - 34, y));
    if (l.key === 'sunken') y = SEA - 2;
    // flatY：强制基准高度（高楼群需要留出足够的竖向空间）
    if (l.flatY != null) y = l.flatY;
    l.baseY = y;
    return y;
  }

  function inRect(l, wx, wz, pad) {
    const p = pad || 0;
    return wx >= l.x - l.r - p && wx <= l.x + l.r + p && wz >= l.z - l.r - p && wz <= l.z + l.r + p;
  }

  /* 粗网格空间索引：把 O(地标数) 的逐列查询降到 O(1) */
  const GRID_CELL = 128;
  const grid = new Map();
  const gkey = (a, b) => a + ',' + b;
  for (const l of L) {
    const pad = l.r + Math.max(40, (l.blend || 26) + 16);
    const c0x = Math.floor((l.x - pad) / GRID_CELL), c1x = Math.floor((l.x + pad) / GRID_CELL);
    const c0z = Math.floor((l.z - pad) / GRID_CELL), c1z = Math.floor((l.z + pad) / GRID_CELL);
    for (let a = c0x; a <= c1x; a++) for (let c = c0z; c <= c1z; c++) {
      const k = gkey(a, c);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(l);
    }
  }
  const EMPTY = [];
  function nearList(wx, wz) {
    return grid.get(gkey(Math.floor(wx / GRID_CELL), Math.floor(wz / GRID_CELL))) || EMPTY;
  }

  /* --------------------------------------- 程序化 POI（无限内容） */
  const POI_CELL = 176;
  const POI_TYPES = [
    { key: 'cabin', w: 12, build: (b, x, z, rnd) => genHouse(b, x, z, 8 + Math.floor(rnd() * 3), 8, 1, { wall: 'wood', vine: 0.7 }) },
    { key: 'camp', w: 14, build: (b, x, z, rnd) => genCamp(b, x, z, 6, { table: 'survivor' }) },
    { key: 'bus', w: 10, build: (b, x, z, rnd) => { const B = b.B, gy = b.ground(x, z); b.part(x - 2, z - 2, x + 14, z + 5, () => { for (let i = 0; i < 12; i++) for (let dy = 0; dy < 4; dy++) for (let dz = 0; dz < 4; dz++) { const shell = dy === 0 || dy === 3 || dz === 0 || dz === 3 || i === 0 || i === 11; b.set(x + i, gy + 1 + dy, z + dz, shell ? (U.hash3(x + i, dy, z + dz, 4) < 0.16 ? 0 : (dy === 2 ? B.glass_broken : B.metal_panel)) : 0); } b.loot(x + 3, gy + 2, z + 1, 'suitcase', 'civilian'); b.loot(x + 8, gy + 2, z + 2, 'backpack_drop', 'survivor'); }); } },
    { key: 'shack', w: 12, build: (b, x, z, rnd) => genHouse(b, x, z, 6, 6, 1, { wall: 'metal', flat: true, vine: 0.5 }) },
    { key: 'graves', w: 8, build: (b, x, z, rnd) => { const B = b.B; b.part(x - 8, z - 8, x + 8, z + 8, () => { for (let i = 0; i < 14; i++) { const px = x + Math.floor((U.hash2(x + i, z, 21) - 0.5) * 14), pz = z + Math.floor((U.hash2(z + i, x, 22) - 0.5) * 14); const g2 = b.ground(px, pz); b.set(px, g2 + 1, pz, B.cobblestone); if (U.hash2(px, pz, 23) < 0.3) b.set(px, g2 + 2, pz, B.bone_pile); } b.loot(x, b.ground(x, z) + 1, z, 'suitcase', 'civilian'); }); } },
    { key: 'airdrop', w: 6, build: (b, x, z, rnd) => { const B = b.B, gy = b.ground(x, z); b.part(x - 4, z - 4, x + 4, z + 4, () => { b.fill(x - 3, gy + 1, z - 3, x + 3, gy + 1, z + 3, B.tarp); b.loot(x, gy + 1, z, 'crate_supply', 'supply'); b.loot(x + 1, gy + 1, z + 1, 'ammo_case', 'ammo'); }); } },
    { key: 'convoy', w: 9, build: (b, x, z, rnd) => { for (let i = 0; i < 4; i++) genCarWreck(b, x + i * 6, z + (i % 2) * 3); b.part(x - 2, z - 2, x + 26, z + 8, () => { b.loot(x + 12, b.ground(x + 12, z) + 1, z + 1, 'crate_supply', 'ammo'); }); } },
    { key: 'hunter', w: 8, build: (b, x, z, rnd) => { const B = b.B, gy = b.ground(x, z); b.part(x - 3, z - 3, x + 5, z + 5, () => { for (let dy = 1; dy <= 6; dy++) { b.set(x, gy + dy, z, B.beam); b.set(x + 3, gy + dy, z, B.beam); b.set(x, gy + dy, z + 3, B.beam); b.set(x + 3, gy + dy, z + 3, B.beam); } b.fill(x, gy + 7, z, x + 3, gy + 7, z + 3, B.planks); b.walls(x, gy + 8, z, x + 3, gy + 9, z + 3, 'wood', 0.2); b.set(x + 1, gy + 8, z, 0); for (let dy = 1; dy <= 7; dy++) b.set(x + 1, gy + dy, z + 1, B.ladder); b.loot(x + 2, gy + 8, z + 2, 'crate_supply', 'survivor'); }); } },
    { key: 'nest_small', w: 5, build: (b, x, z, rnd) => { const B = b.B; b.part(x - 8, z - 8, x + 8, z + 8, () => { for (let px = x - 7; px <= x + 7; px++) for (let pz = z - 7; pz <= z + 7; pz++) { if (Math.hypot(px - x, pz - z) > 7) continue; const g2 = b.ground(px, pz); b.set(px, g2, pz, B.blight_soil); const t = U.hash2(px, pz, 0x31); if (t < 0.2) b.set(px, g2 + 1, pz, B.spore_stalk); else if (t < 0.3) b.set(px, g2 + 1, pz, B.fungal_wall); } b.loot(x, b.ground(x, z) + 1, z, 'backpack_drop', 'lab'); }); } },
    { key: 'ruin', w: 12, build: (b, x, z, rnd) => { const B = b.B, gy = b.ground(x, z); b.part(x - 2, z - 2, x + 12, z + 12, () => { b.fillMat(x, gy, z, x + 10, gy, z + 10, 'floorc'); for (let i = 0; i <= 10; i++) { if (U.hash2(x + i, z, 41) < 0.6) for (let dy = 1; dy <= 1 + Math.floor(U.hash2(x + i, z, 42) * 3); dy++) b.set(x + i, gy + dy, z, mat('brick', x + i, gy + dy, z, 0.5)); if (U.hash2(x, z + i, 43) < 0.6) for (let dy = 1; dy <= 1 + Math.floor(U.hash2(x, z + i, 44) * 3); dy++) b.set(x, gy + dy, z + i, mat('brick', x, gy + dy, z + i, 0.5)); } b.scatter(x, z, x + 10, z + 10, gy + 1, 0.25, () => (U.hash2(x, z, 45) < 0.5 ? B.rubble : B.moss_carpet), 46); b.loot(x + 5, gy + 1, z + 5, 'suitcase', 'civilian'); }); } },
    { key: 'well', w: 7, build: (b, x, z, rnd) => { const B = b.B, gy = b.ground(x, z); b.part(x - 3, z - 3, x + 3, z + 3, () => { for (let a = 0; a < 360; a += 30) { const px = x + Math.round(Math.cos(a * 0.01745) * 2), pz = z + Math.round(Math.sin(a * 0.01745) * 2); b.set(px, gy + 1, pz, B.cobblestone); } b.fill(x, gy - 6, z, x, gy, z, B.water); b.set(x - 2, gy + 2, z, B.beam); b.set(x + 2, gy + 2, z, B.beam); }); } },
    { key: 'fieldwild', w: 8, build: (b, x, z, rnd) => genField(b, x, z, 14, 12, ['crop_wheat', 'crop_corn', 'crop_potato'][Math.floor(rnd() * 3)]) },
    // 野外孤零零立着的一栋高楼 —— 把"绿蚀都市"的气质撒到全世界
    {
      key: 'lonetower', w: 5, build: (b, x, z, rnd) => {
        const w = 9 + Math.floor(rnd() * 5), d = 9 + Math.floor(rnd() * 5);
        genHighrise(b, x, z, w, d, 4 + Math.floor(rnd() * 7), {});
        // 楼前一小段断头路
        genRoad(b, x - 24, z + d + 3, x + w + 6, z + d + 3, 5, 0x7a);
      },
    },
    // 三四栋楼挤在一起的小街区
    {
      key: 'blockcluster', w: 4, build: (b, x, z, rnd) => {
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
          if (rnd() < 0.25) continue;
          genHighrise(b, x + i * 16, z + j * 16, 12, 12, 3 + Math.floor(rnd() * 6), {});
        }
        genRoad(b, x - 6, z + 13, x + 30, z + 13, 5, 0x7b);
      },
    },
  ];

  function poiAt(wg, cellX, cellZ) {
    const rnd = U.rngAt(cellX, cellZ, wg.seed ^ 0x50b1);
    if (rnd() > 0.62) return null;                       // 不是每个格子都有
    const x = cellX * POI_CELL + Math.floor(rnd() * POI_CELL);
    const z = cellZ * POI_CELL + Math.floor(rnd() * POI_CELL);
    // 排除地标区域与水下
    for (const l of L) if (inRect(l, x, z, 24)) return null;
    const gy = wg.rawHeight(x, z);
    if (gy < SEA + 2) return null;
    const type = U.weightedPick(POI_TYPES, rnd);
    return { x, z, type, rnd };
  }

  /* ------------------------------------------------------- 公共 API */
  GF.Landmarks = {
    list: L,
    POI_TYPES,
    baseYOf,

    /** 地形整平：地标footprint内把高度插值到 baseY */
    flatten(wg, wx, wz, y) {
      const near = nearList(wx, wz);
      for (let i = 0; i < near.length; i++) {
        const l = near[i];
        const bl = l.blend || 26;                  // 过渡带宽度（大型城区需要更缓的坡）
        if (!inRect(l, wx, wz, bl)) continue;
        if (l.key === 'quarry' || l.key === 'vinebridge') continue;   // 这两个自己挖地形
        const by = baseYOf(wg, l);
        const dx = Math.abs(wx - l.x) - l.r, dz = Math.abs(wz - l.z) - l.r;
        const d = Math.max(dx, dz);
        const t = d <= 0 ? 1 : U.clamp(1 - d / bl, 0, 1);
        y = U.lerp(y, by, U.smoothstep(t));
      }
      return y;
    },

    /** 该坐标属于哪个地标区（用于生物群系覆盖） */
    zoneAt(wx, wz) {
      const near = nearList(wx, wz);
      for (let i = 0; i < near.length; i++) if (inRect(near[i], wx, wz, 0)) return near[i];
      return null;
    },

    /** 是否禁止自然植被（建筑区） */
    noVeg(wx, wz) {
      const near = nearList(wx, wz);
      for (let i = 0; i < near.length; i++) {
        const l = near[i];
        if (l.noVeg && inRect(l, wx, wz, -4)) return true;
      }
      return false;
    },

    /** 生成本区块内的所有结构 */
    buildChunk(wg, cx, cz, api) {
      const X0 = cx * CH, Z0 = cz * CH, X1 = X0 + CH - 1, Z1 = Z0 + CH - 1;
      // 1) 地标
      const cand = new Set();
      for (const [dx, dz] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
        for (const l of nearList(X0 + dx * GRID_CELL, Z0 + dz * GRID_CELL)) cand.add(l);
      }
      for (const l of cand) {
        const pad = l.r + 60;
        if (X1 < l.x - pad || X0 > l.x + pad || Z1 < l.z - pad || Z0 > l.z + pad) continue;
        baseYOf(wg, l);
        const b = makeB(wg, cx, cz, api, l);
        try { l.build(b); } catch (err) { console.warn('landmark fail', l.key, err); }
      }
      // 2) 程序化 POI（扫描邻近 cell）
      const c0x = Math.floor((X0 - 40) / POI_CELL), c1x = Math.floor((X1 + 40) / POI_CELL);
      const c0z = Math.floor((Z0 - 40) / POI_CELL), c1z = Math.floor((Z1 + 40) / POI_CELL);
      for (let cxx = c0x; cxx <= c1x; cxx++) for (let czz = c0z; czz <= c1z; czz++) {
        const p = poiAt(wg, cxx, czz);
        if (!p) continue;
        if (X1 < p.x - 40 || X0 > p.x + 40 || Z1 < p.z - 40 || Z0 > p.z + 40) continue;
        const b = makeB(wg, cx, cz, api, { x: p.x, z: p.z, baseY: wg.heightAt(p.x, p.z), key: 'poi_' + p.type.key });
        try { p.type.build(b, p.x, p.z, U.rngAt(p.x, p.z, wg.seed)); }
        catch (err) { console.warn('poi fail', p.type.key, err); }
      }
    },

    /** 最近地标（用于 HUD 提示） */
    nearest(wx, wz) {
      let best = null, bd = 1e9;
      for (const l of L) {
        const d = Math.hypot(l.x - wx, l.z - wz);
        if (d < bd) { bd = d; best = l; }
      }
      return { l: best, d: bd };
    },

    /* ---------------- MOD 接口 ---------------- */
    /** 注册一处自定义地标。o = {key,name,x,z,r,icon,desc,biome,noVeg,build(b)} */
    addLandmark(o) {
      add(o);
      const l = L[L.length - 1];
      l.index = L.length - 1; l.x |= 0; l.z |= 0; l.baseY = null;
      const pad = l.r + Math.max(40, (l.blend || 26) + 16);
      const c0x = Math.floor((l.x - pad) / GRID_CELL), c1x = Math.floor((l.x + pad) / GRID_CELL);
      const c0z = Math.floor((l.z - pad) / GRID_CELL), c1z = Math.floor((l.z + pad) / GRID_CELL);
      for (let a = c0x; a <= c1x; a++) for (let c = c0z; c <= c1z; c++) {
        const k = gkey(a, c);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(l);
      }
      return l;
    },
    /** 注册一种程序化小据点。o = {key, w:权重, build(b,x,z,rnd)} */
    addPOI(o) { POI_TYPES.push(o); return o; },
    /** 注册/扩展战利品表 */
    addLoot(table, entries, rolls) {
      if (!tables[table]) tables[table] = { rolls: rolls || [1, 3], entries: [] };
      for (const e2 of entries) tables[table].entries.push(e2);
      return tables[table];
    },
    /** 通用建造器（供自定义地标复用） */
    gen: {
      house: genHouse, tower: genTower, hall: genHall, road: genRoad, car: genCarWreck,
      camp: genCamp, towerFrame: genTowerFrame, underground: genUnderground, field: genField,
      highrise: genHighrise, streetGrid: genStreetGrid, cityBlock: genCityBlockFill, mat,
    },
  };
})(globalThis.GF = globalThis.GF || {});
