// ---------------------------------------------------------------------------
// Frame-cost breakdown for the ship-or-redesign gate.
//
// EXT_disjoint_timer_query is advertised by ANGLE/Metal but never resolves
// inside a single JS task, so we sync with a 1x1 readPixels on the DEFAULT
// framebuffer instead. That forces a full pipeline flush and wait — but only
// for work that actually ends up on screen, so we compare whole frames rather
// than trying to time an intermediate pass in isolation.
// ---------------------------------------------------------------------------

export function makeBench(ctx) {
  const { renderer, composer, scene, camera, grass, terrain, player, world, input } = ctx;
  const gl = renderer.getContext();
  const px = new Uint8Array(4);

  const sync = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  };
  const time = (fn, n) => {
    for (let i = 0; i < 5; i++) { fn(); sync(); }
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { fn(); sync(); }
    return +((performance.now() - t0) / n).toFixed(2);
  };

  return function bench(samples = 25) {
    // stand somewhere representative: mid-field, hills across the frame
    player.pos.set(140, 0, -210);
    player.pos.y = world.heightAt(140, -210);
    input.yaw = 0.35; input.pitch = -0.06;

    const w = renderer.domElement.width, h = renderer.domElement.height;
    const o = {
      size: `${w}x${h}`,
      mpix: +((w * h) / 1e6).toFixed(2),
      pixelRatio: +renderer.getPixelRatio().toFixed(2),
      blades: grass.bladeCount,
      grassChunks: grass.drawCount,
      terrainChunks: terrain.visibleCount,
      drawCalls: renderer.info.render.calls,
      tris_k: Math.round(renderer.info.render.triangles / 1000),
    };
    o.syncOverhead_ms = time(() => {}, 20);
    o.frame_ms = time(() => composer.render(0.016), samples);
    o.scene_ms = time(() => renderer.render(scene, camera), samples);
    grass.group.visible = false;
    const noGrass = time(() => renderer.render(scene, camera), samples);
    grass.group.visible = true;
    o.grass_ms = +(o.scene_ms - noGrass).toFixed(2);
    o.everythingElse_ms = noGrass;
    o.post_ms = +(o.frame_ms - o.scene_ms).toFixed(2);
    o.budget60 = o.frame_ms <= 12 ? 'PASS' : 'OVER';
    return o;
  };
}
