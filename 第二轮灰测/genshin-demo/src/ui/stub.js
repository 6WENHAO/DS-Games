// Fallback UI so gameplay never crashes when the real UI module is unavailable.
export function createUIStub(ctx) {
  const log = (...a) => console.log('[ui-stub]', ...a);
  return {
    stub: true,
    toast: (t) => log('toast', t),
    subtitle: (t) => log('subtitle', t),
    prompt: () => {}, hidePrompt: () => {},
    fade: () => Promise.resolve(), cinematic: () => {}, credits: () => {},
    hud: {
      setHP() {}, setStamina() {}, setSkill() {}, setParty() {}, setActive() {},
      setBoss() {}, clearBoss() {}, setRegion(n) { log('region', n); }, setLockOn() {},
      flashStamina() {}, show() {}, hide() {},
    },
    dialogue: { start: (node) => { log('dialogue', node?.speaker, node?.lines?.[0]); return Promise.resolve(0); } },
    quest: { set() {}, flash(t) { log('quest', t); } },
    map: { toggle() {}, isOpen: false },
    intro: {
      // Minimal but real title gate so the opening flythrough is always framed by something.
      play: () => new Promise(resolve => {
        if (ctx?.shotMode && !ctx?.forceIntro) return resolve();
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' +
          'justify-content:flex-end;padding-bottom:14vh;gap:16px;pointer-events:auto;' +
          'background:radial-gradient(ellipse at 50% 45%,transparent 30%,rgba(4,8,16,.55) 100%)';
        el.innerHTML = '<div style="font-size:58px;letter-spacing:.3em;color:#ffe9b8;' +
          'text-shadow:0 0 28px rgba(255,220,150,.6)">原&#8202;神</div>' +
          '<div style="font-size:11px;letter-spacing:.4em;color:#cfe0ff">GENSHIN-LIKE OPEN WORLD DEMO</div>' +
          '<div style="margin-top:22px;font-size:14px;letter-spacing:.25em;color:#fff;animation:bootslide 0s;' +
          'opacity:.9">点击任意位置进入游戏</div>';
        document.getElementById('ui-root').appendChild(el);
        const done = () => { el.remove(); removeEventListener('pointerdown', done); removeEventListener('keydown', done); resolve(); };
        addEventListener('pointerdown', done); addEventListener('keydown', done);
      }),
    },
    update() {},
  };
}
export function createAudioStub() {
  return { stub: true, unlock() {}, sfx() {}, music() {}, ambience() {}, duckMusic() {},
    setVolume() {}, setMusicVolume() {}, setSfxVolume() {}, update() {}, listener() {} };
}
