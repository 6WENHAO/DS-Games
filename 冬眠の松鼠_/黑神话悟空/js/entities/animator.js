import * as THREE from 'three';

// Thin animation state machine over THREE.AnimationMixer.
export class Animator {
  constructor(root, clips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = new Map();
    this.current = null;
    this.currentName = '';
    this.onceCallbacks = new Map();
    for (const clip of clips) {
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.mixer.addEventListener('finished', (e) => {
      const cb = this.onceCallbacks.get(e.action);
      if (cb) {
        this.onceCallbacks.delete(e.action);
        cb();
      }
    });
  }

  has(name) { return this.actions.has(name); }

  duration(name) {
    const a = this.actions.get(name);
    return a ? a.getClip().duration : 0;
  }

  play(name, { fade = 0.18, once = false, speed = 1, onDone = null, clamp = false } = {}) {
    const action = this.actions.get(name);
    if (!action) { console.warn('missing anim', name); onDone?.(); return null; }
    if (this.current && this.current !== action) {
      this.current.fadeOut(fade);
    }
    action.reset();
    action.setEffectiveTimeScale(speed);
    action.setEffectiveWeight(1);
    action.fadeIn(fade);
    if (once) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = clamp;
      if (onDone) this.onceCallbacks.set(action, onDone);
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    action.play();
    this.current = action;
    this.currentName = name;
    return action;
  }

  // play only if not already the current looped animation
  ensure(name, opts = {}) {
    if (this.currentName === name) return this.current;
    return this.play(name, opts);
  }

  setSpeed(speed) {
    if (this.current) this.current.setEffectiveTimeScale(speed);
  }

  freeze(frozen) {
    this.mixer.timeScale = frozen ? 0 : 1;
  }

  update(dt) {
    this.mixer.update(dt);
  }
}
