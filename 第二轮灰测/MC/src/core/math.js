/**
 * core/math.js
 * ------------------------------------------------------------------
 * Small, allocation-conscious math layer: 4x4 matrices (column-major,
 * WebGL order), 3-component vectors, a frustum for chunk culling and a
 * handful of scalar helpers.
 *
 * Everything writes into a caller-supplied `out` where practical so the
 * per-frame hot paths stay garbage-free.
 */

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const fract = (v) => v - Math.floor(v);
/** True modulo (result always has the sign of `m`). */
export const mod = (v, m) => ((v % m) + m) % m;
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
/** Frame-rate independent exponential approach. */
export const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));

/* ================================================================== */
/* vec3                                                               */
/* ================================================================== */

export const vec3 = {
  create: (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]),
  set(out, x, y, z) { out[0] = x; out[1] = y; out[2] = z; return out; },
  copy(out, a) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; },
  add(out, a, b) { out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2]; return out; },
  sub(out, a, b) { out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; return out; },
  scale(out, a, s) { out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s; return out; },
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  lengthSq: (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2],
  length: (a) => Math.hypot(a[0], a[1], a[2]),
  cross(out, a, b) {
    const ax = a[0]; const ay = a[1]; const az = a[2];
    const bx = b[0]; const by = b[1]; const bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
  },
  normalize(out, a) {
    const len = Math.hypot(a[0], a[1], a[2]);
    if (len < 1e-9) return vec3.set(out, 0, 0, 0);
    return vec3.scale(out, a, 1 / len);
  },
  lerp(out, a, b, t) {
    out[0] = lerp(a[0], b[0], t);
    out[1] = lerp(a[1], b[1], t);
    out[2] = lerp(a[2], b[2], t);
    return out;
  },
  distance: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
};

/* ================================================================== */
/* mat4 - column-major, m[col*4 + row]                                */
/* ================================================================== */

export const mat4 = {
  create() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },

  identity(out) {
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  },

  copy(out, a) { out.set(a); return out; },

  /** Right-handed perspective projection with a [-1,1] depth range. */
  perspective(out, fovYRad, aspect, near, far) {
    const f = 1 / Math.tan(fovYRad / 2);
    const nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
  },

  /** Orthographic projection (used by the 2D GUI pass). */
  ortho(out, left, right, bottom, top, near, far) {
    out.fill(0);
    out[0] = 2 / (right - left);
    out[5] = 2 / (top - bottom);
    out[10] = -2 / (far - near);
    out[12] = -(right + left) / (right - left);
    out[13] = -(top + bottom) / (top - bottom);
    out[14] = -(far + near) / (far - near);
    out[15] = 1;
    return out;
  },

  multiply(out, a, b) {
    const a00 = a[0]; const a01 = a[1]; const a02 = a[2]; const a03 = a[3];
    const a10 = a[4]; const a11 = a[5]; const a12 = a[6]; const a13 = a[7];
    const a20 = a[8]; const a21 = a[9]; const a22 = a[10]; const a23 = a[11];
    const a30 = a[12]; const a31 = a[13]; const a32 = a[14]; const a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4]; const b1 = b[i * 4 + 1]; const b2 = b[i * 4 + 2]; const b3 = b[i * 4 + 3];
      out[i * 4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
      out[i * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
      out[i * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
      out[i * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    }
    return out;
  },

  translate(out, a, x, y, z) {
    if (out !== a) out.set(a);
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    return out;
  },

  fromTranslation(out, x, y, z) {
    mat4.identity(out);
    out[12] = x; out[13] = y; out[14] = z;
    return out;
  },

  scaleBy(out, a, x, y, z) {
    for (let i = 0; i < 4; i++) {
      out[i] = a[i] * x;
      out[4 + i] = a[4 + i] * y;
      out[8 + i] = a[8 + i] * z;
      out[12 + i] = a[12 + i];
    }
    return out;
  },

  rotateX(out, a, rad) {
    const s = Math.sin(rad); const c = Math.cos(rad);
    const a10 = a[4]; const a11 = a[5]; const a12 = a[6]; const a13 = a[7];
    const a20 = a[8]; const a21 = a[9]; const a22 = a[10]; const a23 = a[11];
    if (out !== a) out.set(a);
    out[4] = a10 * c + a20 * s; out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s; out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s; out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s; out[11] = a23 * c - a13 * s;
    return out;
  },

  rotateY(out, a, rad) {
    const s = Math.sin(rad); const c = Math.cos(rad);
    const a00 = a[0]; const a01 = a[1]; const a02 = a[2]; const a03 = a[3];
    const a20 = a[8]; const a21 = a[9]; const a22 = a[10]; const a23 = a[11];
    if (out !== a) out.set(a);
    out[0] = a00 * c - a20 * s; out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s; out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c; out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c; out[11] = a03 * s + a23 * c;
    return out;
  },

  rotateZ(out, a, rad) {
    const s = Math.sin(rad); const c = Math.cos(rad);
    const a00 = a[0]; const a01 = a[1]; const a02 = a[2]; const a03 = a[3];
    const a10 = a[4]; const a11 = a[5]; const a12 = a[6]; const a13 = a[7];
    if (out !== a) out.set(a);
    out[0] = a00 * c + a10 * s; out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s; out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s; out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s; out[7] = a13 * c - a03 * s;
    return out;
  },

  /**
   * View matrix from an eye position and yaw/pitch in radians.
   *
   * Convention (Minecraft-like): yaw 0 looks toward -Z (north), positive
   * yaw turns right (clockwise seen from above), positive pitch looks
   * down.
   *
   * The basis is
   *   right   = ( cos y, 0,  sin y)
   *   forward = ( sin y cos p, -sin p, -cos y cos p)
   *   up      = right x forward = ( sin y sin p, cos p, -cos y sin p)
   */
  fromEulerView(out, eyeX, eyeY, eyeZ, yaw, pitch) {
    const cy = Math.cos(yaw); const sy = Math.sin(yaw);
    const cp = Math.cos(pitch); const sp = Math.sin(pitch);
    const rx = cy; const ry = 0; const rz = sy;
    const ux = sy * sp; const uy = cp; const uz = -cy * sp;
    const fx = sy * cp; const fy = -sp; const fz = -cy * cp;
    // view = transpose(rotation) * translate(-eye); rows are right, up, -forward
    out[0] = rx; out[4] = ry; out[8] = rz;
    out[1] = ux; out[5] = uy; out[9] = uz;
    out[2] = -fx; out[6] = -fy; out[10] = -fz;
    out[3] = 0; out[7] = 0; out[11] = 0;
    out[12] = -(rx * eyeX + ry * eyeY + rz * eyeZ);
    out[13] = -(ux * eyeX + uy * eyeY + uz * eyeZ);
    out[14] = (fx * eyeX + fy * eyeY + fz * eyeZ);
    out[15] = 1;
    return out;
  },

  /** Direction vector for yaw/pitch, matching `fromEulerView`. */
  eulerForward(out, yaw, pitch) {
    const cp = Math.cos(pitch);
    return vec3.set(out, Math.sin(yaw) * cp, -Math.sin(pitch), -Math.cos(yaw) * cp);
  },

  /** Right vector for a yaw, matching `fromEulerView`. */
  eulerRight(out, yaw) {
    return vec3.set(out, Math.cos(yaw), 0, Math.sin(yaw));
  },

  invert(out, a) {
    const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  },
};

/* ================================================================== */
/* frustum                                                            */
/* ================================================================== */

/**
 * Six-plane view frustum extracted from a view-projection matrix.
 * Planes are stored as [nx, ny, nz, d] with normals pointing inward.
 */
export class Frustum {
  constructor() {
    this.planes = new Float32Array(24);
  }

  /** Recomputes the planes from a combined view-projection matrix. */
  setFromMatrix(m) {
    const p = this.planes;
    const rows = [
      [m[0], m[4], m[8], m[12]],
      [m[1], m[5], m[9], m[13]],
      [m[2], m[6], m[10], m[14]],
      [m[3], m[7], m[11], m[15]],
    ];
    const set = (i, a, b, s) => {
      let x = rows[3][0] + s * rows[a][0];
      let y = rows[3][1] + s * rows[a][1];
      let z = rows[3][2] + s * rows[a][2];
      let w = rows[3][3] + s * rows[a][3];
      const len = Math.hypot(x, y, z) || 1;
      p[i * 4] = x / len; p[i * 4 + 1] = y / len; p[i * 4 + 2] = z / len; p[i * 4 + 3] = w / len;
      void b;
    };
    set(0, 0, 0, 1);  // left
    set(1, 0, 0, -1); // right
    set(2, 1, 0, 1);  // bottom
    set(3, 1, 0, -1); // top
    set(4, 2, 0, 1);  // near
    set(5, 2, 0, -1); // far
    return this;
  }

  /** Conservative AABB test: false only when the box is fully outside. */
  intersectsBox(minX, minY, minZ, maxX, maxY, maxZ) {
    const p = this.planes;
    for (let i = 0; i < 6; i++) {
      const nx = p[i * 4]; const ny = p[i * 4 + 1]; const nz = p[i * 4 + 2]; const d = p[i * 4 + 3];
      // Pick the box corner furthest along the plane normal.
      const x = nx >= 0 ? maxX : minX;
      const y = ny >= 0 ? maxY : minY;
      const z = nz >= 0 ? maxZ : minZ;
      if (nx * x + ny * y + nz * z + d < 0) return false;
    }
    return true;
  }
}

/* ================================================================== */
/* misc                                                              */
/* ================================================================== */

/** Axis-aligned box helper used by physics and entity bounds. */
export class AABB {
  constructor(minX = 0, minY = 0, minZ = 0, maxX = 0, maxY = 0, maxZ = 0) {
    this.minX = minX; this.minY = minY; this.minZ = minZ;
    this.maxX = maxX; this.maxY = maxY; this.maxZ = maxZ;
  }

  set(minX, minY, minZ, maxX, maxY, maxZ) {
    this.minX = minX; this.minY = minY; this.minZ = minZ;
    this.maxX = maxX; this.maxY = maxY; this.maxZ = maxZ;
    return this;
  }

  /** Centre-based box: width on X/Z, height upward from the feet. */
  setFromCentre(x, feetY, z, width, height) {
    const h = width / 2;
    return this.set(x - h, feetY, z - h, x + h, feetY + height, z + h);
  }

  expand(dx, dy, dz) {
    if (dx < 0) this.minX += dx; else this.maxX += dx;
    if (dy < 0) this.minY += dy; else this.maxY += dy;
    if (dz < 0) this.minZ += dz; else this.maxZ += dz;
    return this;
  }

  grow(d) {
    this.minX -= d; this.minY -= d; this.minZ -= d;
    this.maxX += d; this.maxY += d; this.maxZ += d;
    return this;
  }

  intersects(o) {
    return this.minX < o.maxX && this.maxX > o.minX
      && this.minY < o.maxY && this.maxY > o.minY
      && this.minZ < o.maxZ && this.maxZ > o.minZ;
  }
}
