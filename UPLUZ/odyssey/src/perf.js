// ---------------------------------------------------------------------------
// Dynamic resolution + the numbers that decide whether this design ships.
//
// Scale RESOLUTION, never grass density: density changes pop visibly, whereas
// post-bloom and the paper grain hide a resolution drop almost completely.
// ---------------------------------------------------------------------------

export class Perf {
  constructor(renderer, composer, basePixelRatio) {
    this.renderer = renderer;
    this.composer = composer;
    this.basePR = basePixelRatio;
    this.scale = 1.0;
    this.samples = [];
    this.avg = 16.6;
    this.acc = 0;
    this.frames = 0;
    this.fps = 0;

    this.el = document.createElement('div');
    this.el.className = 'perf';
    document.body.appendChild(this.el);
    this.visible = true;

    addEventListener('keydown', (e) => {
      if (e.code === 'KeyP') {
        this.visible = !this.visible;
        this.el.style.display = this.visible ? 'block' : 'none';
      }
    });
  }

  applyScale() {
    // guard against a zero-size container (hidden pane, collapsed iframe):
    // a 0x0 drawing buffer renders black and reports no error
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
    this.renderer.setPixelRatio(this.basePR * this.scale);
    this.composer.setSize(w, h);
  }

  frame(dtMs, stats) {
    this.samples.push(dtMs);
    if (this.samples.length > 180) this.samples.shift();

    this.acc += dtMs;
    this.frames++;
    if (this.acc >= 250) {
      this.avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
      this.fps = 1000 / (this.acc / this.frames);
      this.acc = 0; this.frames = 0;

      // 3-second rolling average drives scale in [0.65, 1.0]
      if (this.samples.length > 120) {
        const prev = this.scale;
        if (this.avg > 20.0) this.scale = Math.max(0.65, this.scale - 0.05);
        else if (this.avg < 13.5) this.scale = Math.min(1.0, this.scale + 0.025);
        if (Math.abs(prev - this.scale) > 0.001) this.applyScale();
      }

      if (this.visible) this.render(stats);
    }
  }

  render(s) {
    const info = this.renderer.info.render;
    const budget = (v, max) => `<b class="${v > max ? 'bad' : 'ok'}">${v}</b>/${max}`;
    this.el.innerHTML = `
      <div class="row"><span>fps</span>${budget(Math.round(this.fps), 999)} <i>${this.avg.toFixed(1)} ms</i></div>
      <div class="row"><span>draw calls</span>${budget(info.calls, 350)}</div>
      <div class="row"><span>triangles</span>${budget((info.triangles / 1000 | 0), 1200)}k</div>
      <div class="row"><span>grass blades</span><b class="ok">${(s.blades / 1000).toFixed(0)}k</b> <i>${s.grassChunks} chunks</i></div>
      <div class="row"><span>terrain chunks</span><b class="ok">${s.terrainChunks}</b></div>
      <div class="row"><span>render scale</span><b class="${this.scale < 0.99 ? 'warn' : 'ok'}">${this.scale.toFixed(2)}</b></div>
      <div class="row"><span>heap</span><i>${s.heap}</i></div>
      <div class="hint">P — hide · WASD move · Space jump / hold to glide · E call</div>
    `;
  }
}
