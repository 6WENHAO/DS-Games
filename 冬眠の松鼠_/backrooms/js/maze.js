/* ============================================================
   maze.js — procedural maze generation for Backrooms layouts
   Produces walls (for geometry + collision), open cells,
   and adjacency info for entity pathfinding.
   ============================================================ */
(function () {
  const BR = (window.BR = window.BR || {});

  // Recursive-backtracker maze with extra loops for the
  // disorienting, open Backrooms feel.
  function generate(cols, rows, opts) {
    opts = opts || {};
    const openness = opts.openness != null ? opts.openness : 0.32; // fraction of interior walls removed after carving
    const C = opts.cellSize || 7;
    const T = opts.wallThickness || 0.4;

    // vWalls[i][j]: vertical wall on WEST edge of cell (i,j). size (cols+1) x rows
    // hWalls[i][j]: horizontal wall on NORTH edge of cell (i,j). size cols x (rows+1)
    const vWalls = [];
    for (let i = 0; i <= cols; i++) { vWalls[i] = []; for (let j = 0; j < rows; j++) vWalls[i][j] = true; }
    const hWalls = [];
    for (let i = 0; i < cols; i++) { hWalls[i] = []; for (let j = 0; j <= rows; j++) hWalls[i][j] = true; }

    const visited = [];
    for (let i = 0; i < cols; i++) { visited[i] = []; for (let j = 0; j < rows; j++) visited[i][j] = false; }

    // iterative DFS carve
    const stack = [[0, 0]];
    visited[0][0] = true;
    while (stack.length) {
      const [ci, cj] = stack[stack.length - 1];
      const nb = [];
      if (ci > 0 && !visited[ci - 1][cj]) nb.push([ci - 1, cj, "W"]);
      if (ci < cols - 1 && !visited[ci + 1][cj]) nb.push([ci + 1, cj, "E"]);
      if (cj > 0 && !visited[ci][cj - 1]) nb.push([ci, cj - 1, "N"]);
      if (cj < rows - 1 && !visited[ci][cj + 1]) nb.push([ci, cj + 1, "S"]);
      if (!nb.length) { stack.pop(); continue; }
      const [ni, nj, dir] = nb[(Math.random() * nb.length) | 0];
      if (dir === "W") vWalls[ci][cj] = false;
      if (dir === "E") vWalls[ci + 1][cj] = false;
      if (dir === "N") hWalls[ci][cj] = false;
      if (dir === "S") hWalls[ci][cj + 1] = false;
      visited[ni][nj] = true;
      stack.push([ni, nj]);
    }

    // remove extra interior walls -> loops & openness
    for (let i = 1; i < cols; i++)
      for (let j = 0; j < rows; j++)
        if (vWalls[i][j] && Math.random() < openness) vWalls[i][j] = false;
    for (let i = 0; i < cols; i++)
      for (let j = 1; j < rows; j++)
        if (hWalls[i][j] && Math.random() < openness) hWalls[i][j] = false;

    // Build wall boxes (axis-aligned) for geometry + collision.
    // cell (i,j) center = (i*C, j*C). Cell spans +-C/2.
    const walls = []; // {minX,maxX,minZ,maxZ,cx,cz,horizontal}
    const half = C / 2;
    for (let i = 0; i <= cols; i++)
      for (let j = 0; j < rows; j++)
        if (vWalls[i][j]) {
          const x = (i - 0.5) * C;
          walls.push({
            minX: x - T / 2, maxX: x + T / 2,
            minZ: j * C - half, maxZ: j * C + half,
            cx: x, cz: j * C, horizontal: false
          });
        }
    for (let i = 0; i < cols; i++)
      for (let j = 0; j <= rows; j++)
        if (hWalls[i][j]) {
          const z = (j - 0.5) * C;
          walls.push({
            minX: i * C - half, maxX: i * C + half,
            minZ: z - T / 2, maxZ: z + T / 2,
            cx: i * C, cz: z, horizontal: true
          });
        }

    // pillars in some open cells (adds collision + confusion)
    const pillars = [];
    for (let i = 1; i < cols - 1; i++)
      for (let j = 1; j < rows - 1; j++) {
        // only place if cell is fairly open (few surrounding walls)
        const open = (!vWalls[i][j] ? 1 : 0) + (!vWalls[i + 1][j] ? 1 : 0) +
          (!hWalls[i][j] ? 1 : 0) + (!hWalls[i][j + 1] ? 1 : 0);
        if (open >= 3 && Math.random() < 0.06) {
          const pT = 0.9;
          const x = i * C, z = j * C;
          const w = { minX: x - pT / 2, maxX: x + pT / 2, minZ: z - pT / 2, maxZ: z + pT / 2, cx: x, cz: z, pillar: true };
          walls.push(w);
          pillars.push({ i, j, x, z });
        }
      }

    // spatial bins for fast collision lookup (keyed by cell index)
    const bins = new Map();
    function keyOf(i, j) { return i + "," + j; }
    for (const w of walls) {
      const bi = Math.round(w.cx / C), bj = Math.round(w.cz / C);
      const k = keyOf(bi, bj);
      if (!bins.has(k)) bins.set(k, []);
      bins.get(k).push(w);
    }

    function connected(i, j, i2, j2) {
      if (i2 === i + 1 && j2 === j) return !vWalls[i + 1][j];
      if (i2 === i - 1 && j2 === j) return !vWalls[i][j];
      if (j2 === j + 1 && i2 === i) return !hWalls[i][j + 1];
      if (j2 === j - 1 && i2 === i) return !hWalls[i][j];
      return false;
    }

    // BFS pathfinding between cells, returns array of [i,j] or null
    function findPath(si, sj, ti, tj) {
      if (si === ti && sj === tj) return [[si, sj]];
      const q = [[si, sj]];
      const prev = new Map();
      const skey = si + "_" + sj;
      prev.set(skey, null);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let head = 0;
      while (head < q.length) {
        const [ci, cj] = q[head++];
        for (const [dx, dy] of dirs) {
          const ni = ci + dx, nj = cj + dy;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          if (!connected(ci, cj, ni, nj)) continue;
          const nk = ni + "_" + nj;
          if (prev.has(nk)) continue;
          prev.set(nk, [ci, cj]);
          if (ni === ti && nj === tj) {
            // reconstruct
            const path = [[ni, nj]];
            let cur = [ci, cj];
            while (cur) { path.push(cur); cur = prev.get(cur[0] + "_" + cur[1]); }
            path.reverse();
            return path;
          }
          q.push([ni, nj]);
        }
      }
      return null;
    }

    // pick a random open cell far from a given cell (for exits / spawns)
    function randomCellFar(fi, fj, minDist) {
      let best = null, bestD = -1;
      for (let t = 0; t < 60; t++) {
        const i = 1 + ((Math.random() * (cols - 2)) | 0);
        const j = 1 + ((Math.random() * (rows - 2)) | 0);
        const d = Math.abs(i - fi) + Math.abs(j - fj);
        if (d > bestD) { bestD = d; best = [i, j]; }
        if (d >= minDist) return [i, j];
      }
      return best;
    }

    return {
      cols, rows, C, T,
      vWalls, hWalls, walls, pillars, bins,
      keyOf, connected, findPath, randomCellFar,
      cellToWorld(i, j) { return { x: i * C, z: j * C }; },
      worldToCell(x, z) { return { i: Math.round(x / C), j: Math.round(z / C) }; }
    };
  }

  // circle vs axis-aligned-box collision resolution against nearby walls
  function resolveCollision(px, pz, r, maze) {
    const C = maze.C;
    const bi = Math.round(px / C), bj = Math.round(pz / C);
    for (let iter = 0; iter < 2; iter++) {
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const arr = maze.bins.get(maze.keyOf(bi + di, bj + dj));
          if (!arr) continue;
          for (const b of arr) {
            const cx = Math.max(b.minX, Math.min(px, b.maxX));
            const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
            let dx = px - cx, dz = pz - cz;
            let d2 = dx * dx + dz * dz;
            if (d2 < r * r) {
              if (d2 > 1e-8) {
                const d = Math.sqrt(d2);
                const push = r - d;
                px += (dx / d) * push;
                pz += (dz / d) * push;
              } else {
                // center inside the box: push out along nearest face
                const toL = px - b.minX, toR = b.maxX - px;
                const toT = pz - b.minZ, toB = b.maxZ - pz;
                const m = Math.min(toL, toR, toT, toB);
                if (m === toL) px = b.minX - r;
                else if (m === toR) px = b.maxX + r;
                else if (m === toT) pz = b.minZ - r;
                else pz = b.maxZ + r;
              }
            }
          }
        }
    }
    return [px, pz];
  }

  // is a straight line between two points blocked by walls? (line of sight)
  function lineBlocked(x1, z1, x2, z2, maze) {
    const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / (maze.T));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      const bi = Math.round(x / maze.C), bj = Math.round(z / maze.C);
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const arr = maze.bins.get(maze.keyOf(bi + di, bj + dj));
          if (!arr) continue;
          for (const b of arr) {
            if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return true;
          }
        }
    }
    return false;
  }

  BR.generateMaze = generate;
  BR.resolveCollision = resolveCollision;
  BR.lineBlocked = lineBlocked;
})();
