var MH = window.MH || {};
(function(MH) {
  var ERRORS = [];
  var FPS_VALUES = [];
  var FPS_UPDATE_INTERVAL = 500;
  var _lastFpsUpdate = 0;
  var _frameCount = 0;
  var _currentFps = 0;

  window.addEventListener('error', function(e) {
    ERRORS.push('[JS] ' + e.message + ' @ ' + (e.filename||'?') + ':' + (e.lineno||0));
  });

  var _origError = console.error;
  console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    ERRORS.push('[CE] ' + args.join(' '));
    _origError.apply(console, args);
  };

  MH.getErrors = function() { return ERRORS; };
  MH.getErrorCount = function() { return ERRORS.length; };

  MH.getFps = function() { return _currentFps; };

  MH.tickFps = function(now) {
    _frameCount++;
    if (_lastFpsUpdate === 0) _lastFpsUpdate = now;
    var elapsed = now - _lastFpsUpdate;
    if (elapsed >= FPS_UPDATE_INTERVAL) {
      _currentFps = Math.round(_frameCount / (elapsed / 1000));
      _frameCount = 0;
      _lastFpsUpdate = now;
    }
    return _currentFps;
  };

  MH.statusTitle = function(fps) {
    var txt = 'STATUS ready=' + (window.__ready ? 1 : 0) +
              ' errors=' + ERRORS.length +
              ' fps=' + fps;
    var fpsEl = document.getElementById('fps');
    var stEl = document.getElementById('status');
    if (fpsEl) fpsEl.textContent = 'FPS ' + fps;
    if (stEl) stEl.textContent = txt;
    document.title = txt;
  };

  MH.rand = function(seed) {
    var s = seed || 1;
    return function() {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  };

  MH.lerp = function(a, b, t) { return a + (b - a) * t; };
  MH.clamp = function(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  MH.colliders = [];
  MH.solidMeshes = [];

  MH.aabbFromBox = function(box, mesh) {
    var min = new THREE.Vector3(), max = new THREE.Vector3();
    box.getSize(new THREE.Vector3();
    var pos = mesh ? mesh.position.clone() : new THREE.Vector3();
    var half = new THREE.Vector3().copy(box).multiplyScalar(0.5);
    min.copy(pos).sub(half);
    max.copy(pos).add(half);
    return { min: min, max: max };
  };

  MH.testCircleAABB = function(cx, cz, radius, aabb) {
    var closestX = MH.clamp(cx, aabb.min.x, aabb.max.x);
    var closestZ = MH.clamp(cz, aabb.min.z, aabb.max.z);
    var dx = cx - closestX;
    var dz = cz - closestZ;
    return (dx * dx + dz * dz) < (radius * radius);
  };

  MH.playerCollide = function(nx, nz, pyBot, pyTop) {
    var r = CONFIG.PLAYER.radius;
    for (var i = 0; i < MH.colliders.length; i++) {
      var c = MH.colliders[i];
      if (pyBot > c.max.y || pyTop < c.min.y) continue;
      if (MH.testCircleAABB(nx, nz, r, c)) {
        return true;
      }
    }
    return false;
  };

  MH.resolveCollision = function(px, pz, nx, nz, pyBot, pyTop) {
    var r = CONFIG.PLAYER.radius;
    var resolvedX = nx, resolvedZ = nz;
    // Try x-only, then z-only, then both
    if (!MH.playerCollide(px, nz, pyBot, pyTop)) {
      resolvedX = px;
      return { x: px, z: nz, moved: true };
    }
    if (!MH.playerCollide(nx, pz, pyBot, pyTop)) {
      resolvedZ = pz;
      return { x: nx, z: pz, moved: true };
    }
    // Push out from nearest collider
    var best = { x: px, z: pz };
    var bestDist = Infinity;
    for (var i = 0; i < MH.colliders.length; i++) {
      var c = MH.colliders[i];
      if (pyBot > c.max.y || pyTop < c.min.y) continue;
      var closestX = MH.clamp(nx, c.min.x, c.max.x);
      var closestZ = MH.clamp(nz, c.min.z, c.max.z);
      var dx = nx - closestX;
      var dz = nz - closestZ;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < r && dist < bestDist) {
        var len = Math.max(dist, 0.001);
        var pushX = nx + (dx / len) * (r - dist);
        var pushZ = nz + (dz / len) * (r - dist);
        bestDist = dist;
        best = { x: pushX, z: pushZ };
      }
    }
    return { x: best.x, z: best.z, moved: bestDist < Infinity };
  };
})(MH);
