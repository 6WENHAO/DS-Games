/**
 * The garden plot's own coordinate frame.
 *
 * The plot is aligned to the puzzle camera, so the board reads as an upright
 * rectangle on screen and an arrow key moves the whale in exactly that
 * direction, while the terrain, road and treeline keep their own angle around
 * it. Terrain levelling, the kerb, the mown checker and every tile position are
 * all derived from this one frame.
 *
 * The basis comes straight from cameraRig.groundFrame(), which is derived from
 * the matrix the camera actually builds:
 *   axisU = screen right
 *   axisV = screen up (away from the camera along the ground)
 * Board coordinates are (u, v) in metres from the plot centre.
 */
import * as THREE from 'three';
import { LAWN, CAMERAS } from '../core/config.js';
import { groundFrame } from '../core/cameraRig.js';

const DEG = Math.PI / 180;
const frame = groundFrame(CAMERAS.play.yaw);

export const PLOT = {
  center: LAWN.center.clone(),
  axisU: frame.right.clone(),
  axisV: frame.depth.clone(),
  /**
   * Y rotation that maps a prop's local +X onto axisU and its local +Z towards
   * the camera, so a flat sign or a kerb block squares up with the board and
   * faces the viewer.
   */
  rotation: CAMERAS.play.yaw * DEG,
  tile: LAWN.tile,
  halfW: LAWN.halfW,
  halfD: LAWN.halfD,
  border: LAWN.border,
  height: LAWN.height,

  /** board (u,v) -> world */
  toWorld(u, v, out = new THREE.Vector3()) {
    out.set(
      this.center.x + this.axisU.x * u + this.axisV.x * v,
      this.height,
      this.center.z + this.axisU.z * u + this.axisV.z * v,
    );
    return out;
  },

  /** world (x,z) -> board (u,v) */
  toBoard(x, z, out = new THREE.Vector2()) {
    const dx = x - this.center.x;
    const dz = z - this.center.z;
    out.set(
      dx * this.axisU.x + dz * this.axisU.z,
      dx * this.axisV.x + dz * this.axisV.z,
    );
    return out;
  },

  /** Signed distance outside the plot rectangle: negative inside. */
  edgeDistance(x, z) {
    const b = this.toBoard(x, z, _tmp);
    return Math.max(Math.abs(b.x) - this.halfW, Math.abs(b.y) - this.halfD);
  },

  setHeight(y) {
    this.height = y;
    this.center.y = y;
  },
};

const _tmp = new THREE.Vector2();

/**
 * Grid index -> board offset. Grid x grows to screen right and grid y grows to
 * screen down, which is why v is negated.
 */
export function gridToBoard(gx, gy, width, height, tile = PLOT.tile) {
  return {
    u: (gx - (width - 1) * 0.5) * tile,
    v: -(gy - (height - 1) * 0.5) * tile,
  };
}
