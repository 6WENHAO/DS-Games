import { M } from '../voxel/palette.js';

/* ---------------- 石狮 ---------------- */
export function stoneLion(world, { x, z, y = 0, face = -1 }) {
  world.box(x - 2, y, z - 2, x + 2, y + 1, z + 2, M.MARBLE_DARK);
  world.box(x - 2, y + 2, z - 2, x + 2, y + 2, z + 2, M.MARBLE);
  const b = y + 3;
  world.box(x - 1, b, z - 1, x + 1, b + 3, z + 1, M.STONE);          // 身
  for (const s of [-1, 1]) {                                         // 前腿
    world.box(x + s, b, z + face * 2, x + s, b + 2, z + face * 2, M.STONE);
  }
  world.box(x - 1, b + 2, z + face * 2, x + 1, b + 2, z + face * 2, M.STONE);
  world.box(x - 1, b + 4, z + face, x + 1, b + 5, z + face * 2, M.STONE);   // 头
  world.set(x - 1, b + 5, z + face * 2, M.STONE_DARK);
  world.set(x + 1, b + 5, z + face * 2, M.STONE_DARK);
  world.box(x - 1, b + 6, z + face, x + 1, b + 6, z + face, M.STONE_DARK);  // 鬃
  for (const s of [-1, 1]) world.box(x + s * 2, b + 4, z + face, x + s * 2, b + 5, z + face, M.STONE_DARK);
  world.box(x, b + 4, z - face * 2, x, b + 6, z - face * 2, M.STONE_DARK);  // 尾
}

/* ---------------- 华表 ---------------- */
export function huabiao(world, { x, z, y = 0, height = 16 }) {
  world.box(x - 2, y, z - 2, x + 2, y + 1, z + 2, M.MARBLE_DARK);
  world.box(x - 1, y + 2, z - 1, x + 1, y + 2, z + 1, M.MARBLE);
  world.box(x, y + 3, z, x, y + height, z, M.MARBLE);
  const cy = y + Math.round(height * 0.72);                          // 云板
  world.box(x - 3, cy, z, x + 3, cy, z, M.MARBLE_DARK);
  world.box(x - 2, cy + 1, z, x + 2, cy + 1, z, M.MARBLE);
  world.box(x - 3, y + height, z - 3, x + 3, y + height, z + 3, M.MARBLE_DARK); // 承露盘
  world.box(x - 1, y + height + 1, z - 1, x + 1, y + height + 1, z + 1, M.MARBLE);
  world.set(x, y + height + 2, z, M.GOLD);
}

/* ---------------- 松树 ---------------- */
export function pineTree(world, x, z, { y = 0, height = 10, r0 = 4 } = {}) {
  world.box(x, y, z, x, y + height - 1, z, M.TRUNK);
  let lv = 0;
  for (let r = r0; r >= 1; r--, lv++) {
    const ly = y + Math.round(height * 0.4) + lv * 2;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > r) continue;
        const k = (((dx * 7 + dz * 5 + lv * 3) % 3) + 3) % 3;
        const mat = k === 0 ? M.LEAF_DARK : M.LEAF;
        world.setIfEmpty(x + dx, ly, z + dz, mat);
        if (Math.abs(dx) + Math.abs(dz) <= r - 2) world.setIfEmpty(x + dx, ly + 1, z + dz, mat);
      }
  }
  world.setIfEmpty(x, y + height, z, M.LEAF_DARK);
}

/* ---------------- 阔叶树（槐 / 银杏） ---------------- */
export function broadTree(world, x, z, { y = 0, height = 9, r = 4, warm = false } = {}) {
  world.box(x, y, z, x, y + height - 1, z, M.TRUNK);
  world.set(x + 1, y + height - 3, z, M.TRUNK);
  world.set(x - 1, y + height - 4, z + 1, M.TRUNK);
  const cy = y + height + r - 3;
  for (let dy = -r; dy <= r; dy++) {
    const rr = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (let dx = -rr; dx <= rr; dx++)
      for (let dz = -rr; dz <= rr; dz++) {
        if (dx * dx + dz * dz > rr * rr + 1) continue;
        const k = (((dx * 5 + dz * 7 + dy * 11) % 4) + 4) % 4;
        const mat = warm ? (k === 0 ? M.LEAF_WARM : k === 1 ? M.LEAF : M.LEAF_WARM)
                         : (k === 0 ? M.LEAF_DARK : M.LEAF);
        world.setIfEmpty(x + dx, cy + dy, z + dz, mat);
      }
  }
}

/* ---------------- 铜鼎香炉 ---------------- */
export function censer(world, { x, z, y = 0 }) {
  world.box(x - 3, y, z - 3, x + 3, y + 1, z + 3, M.MARBLE_DARK);
  world.box(x - 2, y + 2, z - 2, x + 2, y + 2, z + 2, M.MARBLE);
  world.box(x - 2, y + 3, z - 2, x + 2, y + 6, z + 2, M.BRONZE);       // 炉身
  for (const s of [-1, 1]) {                                            // 双耳
    world.box(x + s * 3, y + 4, z, x + s * 3, y + 6, z, M.BRONZE);
  }
  world.box(x - 3, y + 7, z - 3, x + 3, y + 7, z + 3, M.BRONZE);       // 炉檐
  world.box(x - 1, y + 8, z - 1, x + 1, y + 8, z + 1, M.FLAME);        // 香火
  world.box(x - 2, y + 9, z - 2, x + 2, y + 9, z + 2, M.TILE_GREY);    // 小攒尖
  world.box(x - 1, y + 10, z - 1, x + 1, y + 10, z + 1, M.TILE_GREY_RIB);
  world.set(x, y + 11, z, M.GOLD);
}

/* ---------------- 假山 ---------------- */
export function rockery(world, { x, z, y = 0, r = 4, h = 7 }) {
  for (let dy = 0; dy < h; dy++) {
    const rr = Math.max(1, Math.round(r - dy * 0.55));
    for (let dx = -rr; dx <= rr; dx++)
      for (let dz = -rr; dz <= rr; dz++) {
        if (dx * dx + dz * dz > rr * rr) continue;
        const k = (((dx * 13 + dz * 7 + dy * 19) % 7) + 7) % 7;
        if (k === 0 && dy > 1) continue;                                // 孔洞
        world.setIfEmpty(x + dx, y + dy, z + dz, k < 3 ? M.STONE_DARK : M.STONE);
      }
  }
  world.setIfEmpty(x, y + h, z, M.MOSS);
}

/* ---------------- 水池（放生池） ---------------- */
export function pond(world, { x0, z0, x1, z1, y = 0 }) {
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (edge) {
        world.set(x, y, z, M.STONE);
        world.set(x, y + 1, z, M.MARBLE_DARK);                          // 池沿
      } else {
        world.set(x, y - 1, z, M.SOIL);
        world.set(x, y, z, M.WATER);
        const k = (((x * 7 + z * 11) % 9) + 9) % 9;
        if (k === 0) world.set(x, y + 1, z, M.LEAF);                    // 荷叶
      }
    }
}

/* ---------------- 体素云 ---------------- */
export function cloud(world, { x, y, z, w = 12, d = 7, h = 3 }) {
  world.box(x - w, y, z - d, x + w, y + h - 1, z + d, M.CLOUD);
  world.box(x - Math.round(w * 0.55), y + h, z - Math.round(d * 0.5),
            x + Math.round(w * 0.4), y + h, z + Math.round(d * 0.55), M.CLOUD);
  world.box(x - w - 3, y, z - Math.round(d * 0.5), x - w - 1, y + 1, z + Math.round(d * 0.4), M.CLOUD);
  world.box(x + w + 1, y + 1, z - Math.round(d * 0.4), x + w + 4, y + 2, z + Math.round(d * 0.5), M.CLOUD);
}

/* ---------------- 幡杆（经幡）---------------- */
export function bannerPole(world, { x, z, y = 0, height = 18 }) {
  world.box(x - 1, y, z - 1, x + 1, y + 1, z + 1, M.STONE);
  world.box(x, y + 2, z, x, y + height, z, M.WOOD_DARK);
  world.set(x, y + height + 1, z, M.GOLD);
  for (let i = 0; i < 6; i++) {
    world.set(x + 1, y + height - 2 - i, z, i % 2 === 0 ? M.LANTERN : M.GOLD);
  }
}
