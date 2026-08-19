// ============================================================================
// Module F - procedural audio (CONTRACT 2.6).
//
//   const audio = createAudio(ctx);   // ctx.audio = audio
//   audio.unlock()                    // call on the first user gesture
//   audio.sfx(name, { pos, vol, rate })
//   audio.music(track, { fade })
//   audio.ambience(preset)
//   audio.duckMusic(amount, time)
//   audio.setVolume(v) / setMusicVolume(v) / setSfxVolume(v)
//   audio.update(dt) / audio.listener(camera)
//
// Nothing is audible (and nothing throws) until unlock() has run inside a user
// gesture, which is what the browser autoplay policy requires. Calls made
// before that are either ignored (one-shots) or remembered (music/ambience).
// ============================================================================
import { clamp, makeRNG } from '../core/utils.js';
import { buildBusses, analyseBuffer, EPS } from './synth.js';
import { MusicEngine, TRACKS, TRACK_NAMES, scheduleTrackOffline } from './music.js';
import { SFX_DEFS, SFX_NAMES, SFX_MIN_GAP, AMBIENCE_DEFS, AMBIENCE_NAMES, buildAmbience } from './sfx.js';

export { SFX_NAMES, TRACK_NAMES, AMBIENCE_NAMES };

const LOOK_AHEAD = 1.1;       // seconds of music scheduled in advance
const SCHED_MS = 25;          // scheduler interval

export class AudioSystem {
  constructor(ctx = {}) {
    this.ctx = ctx;
    this.ac = null;
    this.busses = null;
    this.music_ = null;
    this.unlocked = false;
    this.failed = null;

    this.currentTrack = null;
    this.currentAmbience = null;
    this.vol = { master: 1, music: 1, sfx: 1, amb: 1 };

    this._pendingTrack = null;
    this._pendingFade = 2;
    this._pendingAmb = null;
    this._ambLayers = [];
    this._ambNext = 0;
    this._last = new Map();          // per-name retrigger guard
    this._active = [];              // scheduled voice end times (budget)
    this._cam = null;
    this._lp = { x: 0, y: 0, z: 0 };
    this._rng = makeRNG(0xA1D10 >>> 0);
    this._timer = null;
    this._selfTestCache = null;
    this._shot = !!ctx.shotMode;
    this.maxVoices = this._shot ? 18 : 28;

    // Autoplay policy safety net: if the integrator forgets to call unlock(),
    // the first real gesture still starts audio.
    this._autoUnlock = () => { this.unlock(); };
    if (typeof window !== 'undefined' && window.addEventListener) {
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
        window.addEventListener(ev, this._autoUnlock, { once: true, passive: true });
      }
    }

    // keep the public surface safe to destructure
    for (const m of ['unlock', 'sfx', 'music', 'ambience', 'duckMusic', 'setVolume',
      'setMusicVolume', 'setSfxVolume', 'update', 'listener', 'stopAll', 'selfTest', 'dispose']) {
      this[m] = this[m].bind(this);
    }
  }

  // -------------------------------------------------------------------------
  // lifecycle
  // -------------------------------------------------------------------------
  /** Must run inside a user gesture. Idempotent, never throws. */
  unlock() {
    try {
      if (!this.ac) {
        const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
        if (!AC) { this.failed = 'no AudioContext'; return false; }
        this.ac = new AC({ latencyHint: 'interactive' });
        this.busses = buildBusses(this.ac, {
          analyser: true,
          master: 0.85 * this.vol.master,
          musicVolume: 0.6 * this.vol.music,
          sfxVolume: 0.95 * this.vol.sfx,
          ambVolume: 0.5 * this.vol.amb,
          revSeconds: this._shot ? 1.8 : 2.7,
          revDecay: 2.6,
        });
        this.music_ = new MusicEngine(this.ac, this.busses, { seed: 20240921 });
        if (typeof setInterval === 'function') {
          this._timer = setInterval(() => this._schedule(), SCHED_MS);
        }
      }
      if (this.ac.state === 'suspended' && this.ac.resume) {
        this.ac.resume().catch(() => { /* ignored: retried on the next gesture */ });
      }
      this.unlocked = true;
      if (this._pendingTrack) { const t = this._pendingTrack; this._pendingTrack = null; this.music(t, { fade: this._pendingFade }); }
      if (this._pendingAmb) { const a = this._pendingAmb; this._pendingAmb = null; this.ambience(a); }
      this._schedule();
      return true;
    } catch (e) {
      this.failed = String(e && e.message || e);
      console.warn('[audio] unlock failed:', this.failed);
      return false;
    }
  }

  get ready() { return !!this.ac; }
  get state() { return this.ac ? this.ac.state : 'closed'; }
  get analyser() { return this.busses ? this.busses.analyser : null; }
  get time() { return this.ac ? this.ac.currentTime : 0; }

  dispose() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (typeof window !== 'undefined' && window.removeEventListener) {
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(ev, this._autoUnlock);
    }
    try {
      for (const l of this._ambLayers) { l.fadeOut(this.ac.currentTime, 0.1); l.stop(this.ac.currentTime + 0.2); }
      this._ambLayers.length = 0;
      this.music_ && this.music_.dispose();
      this.ac && this.ac.close && this.ac.close();
    } catch (e) { /* noop */ }
    this.ac = null; this.busses = null; this.music_ = null; this.unlocked = false;
  }

  // -------------------------------------------------------------------------
  // scheduling
  // -------------------------------------------------------------------------
  _schedule() {
    if (!this.ac || this.ac.state !== 'running') return;
    const now = this.ac.currentTime;
    const until = now + LOOK_AHEAD;
    if (this.music_) this.music_.tick(until);
    // ambience random events (bird calls, drips, gusts...)
    let top = null;
    for (let i = this._ambLayers.length - 1; i >= 0; i--) {
      if (this._ambLayers[i].retireAt === undefined) { top = this._ambLayers[i]; break; }
    }
    if (top && top.event) {
      if (this._ambNext < now) this._ambNext = now + 0.2;
      let guard = 0;
      while (this._ambNext < until && guard++ < 8) {
        try { top.event(this._ambNext, this._rng); } catch (e) { /* noop */ }
        const r = top.rate || [2, 5];
        this._ambNext += r[0] + this._rng() * (r[1] - r[0]);
      }
    }
    // retire dead ambience layers (including the last one, so ambience(null)
    // really frees its oscillators)
    for (let i = this._ambLayers.length - 1; i >= 0; i--) {
      const l = this._ambLayers[i];
      if (l.retireAt !== undefined && now > l.retireAt) {
        l.stop(now + 0.05);
        try { l.gain.disconnect(); } catch (e) { /* noop */ }
        this._ambLayers.splice(i, 1);
      }
    }
  }

  update(dt) {
    if (!this.ac) return;
    // prune finished one-shots
    if (this._active.length) {
      const now = this.ac.currentTime;
      let w = 0;
      for (let i = 0; i < this._active.length; i++) if (this._active[i] > now) this._active[w++] = this._active[i];
      this._active.length = w;
    }
    const cam = this._cam || this.ctx.camera;
    if (cam) this._applyListener(cam);
    // safety net in case the interval timer is throttled by the browser
    this._schedule();
  }

  // -------------------------------------------------------------------------
  // 3D listener
  // -------------------------------------------------------------------------
  listener(camera) {
    if (camera) this._cam = camera;
    if (this.ac && camera) this._applyListener(camera);
  }

  _applyListener(camera) {
    const L = this.ac.listener;
    if (!L) return;
    const m = camera.matrixWorld;
    if (!m) return;
    if (camera.updateMatrixWorld) camera.updateMatrixWorld();
    const e = m.elements;
    const px = e[12], py = e[13], pz = e[14];
    const fx = -e[8], fy = -e[9], fz = -e[10];
    const ux = e[4], uy = e[5], uz = e[6];
    this._lp.x = px; this._lp.y = py; this._lp.z = pz;
    const t = this.ac.currentTime;
    if (L.positionX) {
      const k = 0.02;
      L.positionX.setTargetAtTime(px, t, k);
      L.positionY.setTargetAtTime(py, t, k);
      L.positionZ.setTargetAtTime(pz, t, k);
      L.forwardX.setTargetAtTime(fx, t, k);
      L.forwardY.setTargetAtTime(fy, t, k);
      L.forwardZ.setTargetAtTime(fz, t, k);
      L.upX.setTargetAtTime(ux, t, k);
      L.upY.setTargetAtTime(uy, t, k);
      L.upZ.setTargetAtTime(uz, t, k);
    } else if (L.setPosition) {
      L.setPosition(px, py, pz);
      L.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  _panner(pos) {
    const p = this.ac.createPanner();
    p.panningModel = 'equalpower';         // cheap: HRTF is far too costly for gameplay spam
    p.distanceModel = 'inverse';
    p.refDistance = 7;
    p.maxDistance = 320;
    p.rolloffFactor = 1.35;
    const x = pos.x ?? 0, y = pos.y ?? 0, z = pos.z ?? 0;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; }
    else if (p.setPosition) p.setPosition(x, y, z);
    p.connect(this.busses.sfx);
    return p;
  }

  // -------------------------------------------------------------------------
  // SFX
  // -------------------------------------------------------------------------
  sfx(name, opts = {}) {
    if (!this.ac || this.ac.state !== 'running') return false;
    const def = SFX_DEFS[name];
    if (!def) { console.warn('[audio] unknown sfx', name); return false; }
    const now = this.ac.currentTime;

    // Same-name rate limit (footstep spam, hit spam). Measured on the wall
    // clock, not on ac.currentTime: an audio sink that renders in large batches
    // (e.g. the headless null sink) advances currentTime in coarse jumps and
    // would let same-frame duplicates through.
    const gap = SFX_MIN_GAP[name] ?? 0.02;
    const wall = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const last = this._last.get(name) ?? -1e9;
    if (wall - last < gap) return false;

    // global voice budget
    if (this._active.length >= this.maxVoices) return false;

    let vol = clamp(opts.vol ?? 1, 0, 4);
    let dest = this.busses.sfx, panner = null;
    if (opts.pos) {
      const p = opts.pos;
      const dx = (p.x ?? 0) - this._lp.x, dy = (p.y ?? 0) - this._lp.y, dz = (p.z ?? 0) - this._lp.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 300 * 300) return false;                 // too far away to matter
      panner = this._panner(p);
      dest = panner;
    }
    const A = {
      ac: this.ac, dest, revIn: this.busses.reverbIn, delayIn: this.busses.delayIn,
      t0: now + 0.005, rate: clamp(opts.rate ?? 1, 0.25, 4) * (1 + (this._rng() - 0.5) * 0.04),
      vol, rng: this._rng,
    };
    let end = now + 0.3;
    try { end = def(A) || end; } catch (e) { console.error('[audio] sfx failed', name, e); return false; }
    this._last.set(name, wall);
    this._active.push(end);
    if (panner && typeof setTimeout === 'function') {
      setTimeout(() => { try { panner.disconnect(); } catch (e) { /* noop */ } }, (end - now + 0.4) * 1000);
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Music
  // -------------------------------------------------------------------------
  music(track, opts = {}) {
    const fade = opts.fade ?? 2;
    if (!track || track === 'none' || track === 'off') {
      this.currentTrack = null;
      this._pendingTrack = null;
      if (this.music_) this.music_.stop(fade);
      return true;
    }
    if (!TRACKS[track]) { console.warn('[audio] unknown track', track); return false; }
    if (!this.ac || this.ac.state !== 'running') {
      this._pendingTrack = track; this._pendingFade = fade;
      this.currentTrack = track;
      return false;
    }
    if (this.music_.current === track) return false;      // do not restart the same track
    this.music_.set(track, fade);
    this.currentTrack = track;
    this._schedule();
    return true;
  }

  duckMusic(amount = 0.5, time = 0.6) {
    if (!this.busses) return;
    const g = this.busses.musicDuck.gain;
    const t = this.ac.currentTime;
    const target = clamp(1 - amount, 0.02, 1);
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(EPS, g.value), t);
    g.linearRampToValueAtTime(target, t + 0.08);
    g.linearRampToValueAtTime(1, t + 0.08 + Math.max(0.05, time));
  }

  // -------------------------------------------------------------------------
  // Ambience
  // -------------------------------------------------------------------------
  ambience(preset, opts = {}) {
    const fade = opts.fade ?? 3;
    if (!this.ac || this.ac.state !== 'running') {
      this._pendingAmb = preset;
      this.currentAmbience = preset;
      return false;
    }
    if (this.currentAmbience === preset && this._ambLayers.length) return false;
    const now = this.ac.currentTime;
    for (const l of this._ambLayers) {
      l.fadeOut(now, fade);
      l.retireAt = now + fade + 0.4;
    }
    this.currentAmbience = preset || null;
    if (!preset || preset === 'none' || !AMBIENCE_DEFS[preset]) {
      if (preset && preset !== 'none') console.warn('[audio] unknown ambience', preset);
      return true;
    }
    const layer = buildAmbience(this.ac, preset, {
      dest: this.busses.amb, revIn: this.busses.reverbIn, delayIn: this.busses.delayIn, gain: 1,
    });
    layer.start(now + 0.02);
    layer.fadeIn(now + 0.02, fade);
    this._ambLayers.push(layer);
    this._ambNext = now + 0.6;
    while (this._ambLayers.length > 3) {
      const l = this._ambLayers.shift();
      l.stop(now + 0.05);
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Volumes
  // -------------------------------------------------------------------------
  _ramp(param, value) {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(Math.max(0, value), t + 0.08);
  }

  setVolume(v = 1) {
    this.vol.master = clamp(v, 0, 2);
    if (this.busses) this._ramp(this.busses.master.gain, 0.85 * this.vol.master);
  }

  setMusicVolume(v = 1) {
    this.vol.music = clamp(v, 0, 2);
    if (this.busses) this._ramp(this.busses.music.gain, 0.6 * this.vol.music);
  }

  setSfxVolume(v = 1) {
    this.vol.sfx = clamp(v, 0, 2);
    if (this.busses) this._ramp(this.busses.sfx.gain, 0.95 * this.vol.sfx);
  }

  setAmbienceVolume(v = 1) {
    this.vol.amb = clamp(v, 0, 2);
    if (this.busses) this._ramp(this.busses.amb.gain, 0.5 * this.vol.amb);
  }

  stopAll(fade = 0.3) {
    if (!this.ac) return;
    const now = this.ac.currentTime;
    if (this.music_) { this.music_.stop(fade); this.currentTrack = null; }
    for (const l of this._ambLayers) { l.fadeOut(now, fade); l.retireAt = now + fade + 0.3; }
    this.currentAmbience = null;
  }

  // -------------------------------------------------------------------------
  // Offline self-test: proves every sfx / track / ambience renders real audio.
  // -------------------------------------------------------------------------
  async selfTest(o = {}) {
    if (this._selfTestCache && !o.force) return this._selfTestCache;
    const res = await runSelfTest(o);
    this._selfTestCache = res;
    return res;
  }
}

/**
 * Render every sfx / track / ambience through an OfflineAudioContext and check
 * that the result is finite and non-silent. Works with no sound card and with
 * no user gesture, which is what makes it usable in headless CI.
 */
export async function runSelfTest(o = {}) {
  const OAC = (typeof window !== 'undefined') && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
  if (!OAC) return { ok: false, error: 'no OfflineAudioContext' };
  const rate = o.sampleRate ?? 22050;
  const sfxDur = o.sfxDur ?? 1.0;
  const musDur = o.musicDur ?? 3.0;
  const ambDur = o.ambDur ?? 1.6;
  const floor = o.floor ?? 1e-4;

  const out = { ok: true, rate, sfx: {}, music: {}, ambience: {}, fails: [], silent: [], nan: [] };

  const render = async (seconds, build) => {
    const ac = new OAC(2, Math.max(256, Math.floor(rate * seconds)), rate);
    // identical bus levels to the live graph, so the reported peak/rms is what
    // actually reaches the speakers (only the reverb tail is shortened for speed)
    const busses = buildBusses(ac, {
      analyser: false, master: 0.85, musicVolume: 0.6, sfxVolume: 0.95, ambVolume: 0.5,
      revSeconds: 1.0, revDecay: 2.4,
    });
    build(ac, busses);
    const buf = await ac.startRendering();
    return analyseBuffer(buf);
  };

  const record = (bucket, name, r) => {
    out[bucket][name] = { rms: +r.rms.toFixed(5), peak: +r.peak.toFixed(4) };
    if (r.bad > 0) { out.nan.push(name); out.ok = false; }
    if (!(r.rms > floor)) { out.silent.push(name); out.ok = false; }
  };

  const names = o.only ? [].concat(o.only) : SFX_NAMES;
  for (const name of names) {
    if (!SFX_DEFS[name]) continue;
    try {
      const r = await render(sfxDur, (ac, b) => {
        const rng = makeRNG(1234);
        SFX_DEFS[name]({
          ac, dest: b.sfx, revIn: b.reverbIn, delayIn: b.delayIn,
          t0: 0.01, rate: 1, vol: 1, rng,
        });
      });
      record('sfx', name, r);
    } catch (e) { out.fails.push(name + ': ' + (e && e.message || e)); out.ok = false; }
  }

  if (!o.only) {
    for (const name of TRACK_NAMES) {
      try {
        const r = await render(musDur, (ac, b) => { scheduleTrackOffline(ac, b, name, musDur); });
        record('music', name, r);
      } catch (e) { out.fails.push('music:' + name + ': ' + (e && e.message || e)); out.ok = false; }
    }
    for (const name of AMBIENCE_NAMES) {
      try {
        const r = await render(ambDur, (ac, b) => {
          const layer = buildAmbience(ac, name, { dest: b.amb, revIn: b.reverbIn, delayIn: b.delayIn, gain: 1 });
          layer.start(0);
          layer.fadeIn(0, 0.08);
          const rng = makeRNG(99);
          if (layer.event) for (const t of [0.15, 0.6, 1.0]) layer.event(t, rng);
        });
        record('ambience', name, r);
      } catch (e) { out.fails.push('amb:' + name + ': ' + (e && e.message || e)); out.ok = false; }
    }
  }

  out.counts = {
    sfx: Object.keys(out.sfx).length,
    music: Object.keys(out.music).length,
    ambience: Object.keys(out.ambience).length,
  };
  return out;
}

/** CONTRACT 2.6 entry point. */
export function createAudio(ctx) {
  return new AudioSystem(ctx);
}

export default createAudio;
