/* =====================================================================
 * AABB — 轴对齐包围盒（玩家 / 生物 / 方块碰撞）
 * ===================================================================== */

export class AABB {
  constructor(minX = 0, minY = 0, minZ = 0, maxX = 0, maxY = 0, maxZ = 0) {
    this.minX = minX; this.minY = minY; this.minZ = minZ;
    this.maxX = maxX; this.maxY = maxY; this.maxZ = maxZ;
  }

  static fromCenter(cx, cy, cz, width, height, depth = width) {
    const hw = width / 2, hd = depth / 2;
    return new AABB(cx - hw, cy, cz - hd, cx + hw, cy + height, cz + hd);
  }

  static fromBlock(x, y, z) { return new AABB(x, y, z, x + 1, y + 1, z + 1); }

  set(minX, minY, minZ, maxX, maxY, maxZ) {
    this.minX = minX; this.minY = minY; this.minZ = minZ;
    this.maxX = maxX; this.maxY = maxY; this.maxZ = maxZ;
    return this;
  }

  copyFrom(o) {
    return this.set(o.minX, o.minY, o.minZ, o.maxX, o.maxY, o.maxZ);
  }

  clone() { return new AABB(this.minX, this.minY, this.minZ, this.maxX, this.maxY, this.maxZ); }

  /** 以脚部中心 (x,y,z) 重新定位一个 width×height 的实体盒 */
  setFromEntity(x, y, z, width, height) {
    const hw = width / 2;
    return this.set(x - hw, y, z - hw, x + hw, y + height, z + hw);
  }

  translate(dx, dy, dz) {
    this.minX += dx; this.maxX += dx;
    this.minY += dy; this.maxY += dy;
    this.minZ += dz; this.maxZ += dz;
    return this;
  }

  expand(dx, dy, dz) {
    if (dx < 0) this.minX += dx; else this.maxX += dx;
    if (dy < 0) this.minY += dy; else this.maxY += dy;
    if (dz < 0) this.minZ += dz; else this.maxZ += dz;
    return this;
  }

  grow(x, y = x, z = x) {
    this.minX -= x; this.maxX += x;
    this.minY -= y; this.maxY += y;
    this.minZ -= z; this.maxZ += z;
    return this;
  }

  intersects(o) {
    return this.minX < o.maxX && this.maxX > o.minX &&
           this.minY < o.maxY && this.maxY > o.minY &&
           this.minZ < o.maxZ && this.maxZ > o.minZ;
  }

  /** 带容差的相交（避免浮点抖动） */
  intersectsEps(o, eps = 1e-7) {
    return this.minX < o.maxX - eps && this.maxX > o.minX + eps &&
           this.minY < o.maxY - eps && this.maxY > o.minY + eps &&
           this.minZ < o.maxZ - eps && this.maxZ > o.minZ + eps;
  }

  containsPoint(x, y, z) {
    return x >= this.minX && x <= this.maxX &&
           y >= this.minY && y <= this.maxY &&
           z >= this.minZ && z <= this.maxZ;
  }

  get centerX() { return (this.minX + this.maxX) / 2; }
  get centerY() { return (this.minY + this.maxY) / 2; }
  get centerZ() { return (this.minZ + this.maxZ) / 2; }
  get sizeX() { return this.maxX - this.minX; }
  get sizeY() { return this.maxY - this.minY; }
  get sizeZ() { return this.maxZ - this.minZ; }

  /**
   * 沿 X 轴移动时，被 other 阻挡后允许的实际位移
   * （经典 Minecraft 逐轴 clip 算法）
   */
  clipX(o, dx) {
    if (this.maxY <= o.minY || this.minY >= o.maxY) return dx;
    if (this.maxZ <= o.minZ || this.minZ >= o.maxZ) return dx;
    if (dx > 0 && this.maxX <= o.minX) {
      const d = o.minX - this.maxX;
      if (d < dx) dx = d;
    } else if (dx < 0 && this.minX >= o.maxX) {
      const d = o.maxX - this.minX;
      if (d > dx) dx = d;
    }
    return dx;
  }

  clipY(o, dy) {
    if (this.maxX <= o.minX || this.minX >= o.maxX) return dy;
    if (this.maxZ <= o.minZ || this.minZ >= o.maxZ) return dy;
    if (dy > 0 && this.maxY <= o.minY) {
      const d = o.minY - this.maxY;
      if (d < dy) dy = d;
    } else if (dy < 0 && this.minY >= o.maxY) {
      const d = o.maxY - this.minY;
      if (d > dy) dy = d;
    }
    return dy;
  }

  clipZ(o, dz) {
    if (this.maxX <= o.minX || this.minX >= o.maxX) return dz;
    if (this.maxY <= o.minY || this.minY >= o.maxY) return dz;
    if (dz > 0 && this.maxZ <= o.minZ) {
      const d = o.minZ - this.maxZ;
      if (d < dz) dz = d;
    } else if (dz < 0 && this.minZ >= o.maxZ) {
      const d = o.maxZ - this.minZ;
      if (d > dz) dz = d;
    }
    return dz;
  }

  /** 射线与盒求交，返回 [tmin, tmax] 或 null */
  rayIntersect(ox, oy, oz, dx, dy, dz) {
    let tmin = -Infinity, tmax = Infinity;
    for (let axis = 0; axis < 3; axis++) {
      const o = axis === 0 ? ox : axis === 1 ? oy : oz;
      const d = axis === 0 ? dx : axis === 1 ? dy : dz;
      const lo = axis === 0 ? this.minX : axis === 1 ? this.minY : this.minZ;
      const hi = axis === 0 ? this.maxX : axis === 1 ? this.maxY : this.maxZ;
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) return null;
      } else {
        let t1 = (lo - o) / d, t2 = (hi - o) / d;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return null;
      }
    }
    return [tmin, tmax];
  }

  toString() {
    return `AABB[${this.minX.toFixed(2)},${this.minY.toFixed(2)},${this.minZ.toFixed(2)} → ${this.maxX.toFixed(2)},${this.maxY.toFixed(2)},${this.maxZ.toFixed(2)}]`;
  }
}
