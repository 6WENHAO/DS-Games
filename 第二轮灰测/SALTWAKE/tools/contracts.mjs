/**
 * Integration contract check.
 *
 * The HUD and the audio engine are consumed through narrow interfaces from
 * several modules. A method name that drifts, or a sound key that was never
 * defined, is invisible to a syntax check and to the shader audit but throws or
 * silently does nothing at runtime. This walks the call sites in the source and
 * confirms every one of them resolves against the module that has to answer it.
 *
 * Exported so tools/smoke.mjs can run it as part of the audit.
 */
import fs from 'node:fs/promises';

const GAME_FILES = [
  '../src/main.js',
  '../src/game/player.js',
  '../src/game/weapons.js',
  '../src/game/enemies.js',
  '../src/game/fx.js',
  '../src/game/sanity.js',
  '../src/game/director.js',
];

/** Strips comments so prose in a doc block is never mistaken for a call site. */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export async function checkContracts({ check, base }) {
  const read = async (rel) => code(await fs.readFile(new URL(rel, base), 'utf8'));
  const sources = await Promise.all(GAME_FILES.map(read));
  const all = sources.join('\n');

  /* ---------------- HUD ---------------- */
  const hudSrc = await read('../src/game/hud.js');
  // Public methods declared on the class.
  const hudMethods = new Set(
    [...hudSrc.matchAll(/^\s{2}([a-zA-Z_]\w*)\s*\(/gm)].map((m) => m[1]),
  );
  hudMethods.delete('constructor');
  const hudCalls = new Set([...all.matchAll(/\bhud\.([a-zA-Z_]\w*)\s*\(/g)].map((m) => m[1]));
  const hudMissing = [...hudCalls].filter((m) => !hudMethods.has(m));
  check('every hud.* call resolves to a HUD method', hudMissing.length === 0,
    hudMissing.length ? `missing ${hudMissing.join(', ')}` : `${hudCalls.size} distinct calls against ${hudMethods.size} methods`);

  /* ---------------- audio ---------------- */
  const audioSrc = await fs.readFile(new URL('../src/core/audio.js', base), 'utf8');
  const namesBlock = /SOUND_NAMES\s*=\s*(?:Object\.freeze\()?\[([\s\S]*?)\]/.exec(audioSrc);
  check('SOUND_NAMES is declared as a literal list', !!namesBlock);
  const soundNames = new Set(
    namesBlock ? [...namesBlock[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] || m[2]) : [],
  );
  check('the sound table is populated', soundNames.size >= 40, `${soundNames.size} sounds`);

  // Literal sound keys passed to play() or loop().
  const played = new Set();
  for (const m of all.matchAll(/\b(?:audio|this\.ctx\.audio|ctx\.audio)\.(?:play|loop)\(\s*'([^']+)'/g)) played.add(m[1]);
  // Keys reached through the enemy and weapon tables in config.
  const configSrc = await fs.readFile(new URL('../src/core/config.js', base), 'utf8');
  for (const m of configSrc.matchAll(/(?:sound|reloadSound|emptySound|chargeSound|windSound|igniteSound)\s*:\s*'([^']+)'/g)) played.add(m[1]);
  for (const m of configSrc.matchAll(/(?:alert|attack|hurt|die)\s*:\s*'([^']+)'/g)) played.add(m[1]);

  const soundMissing = [...played].filter((s) => !soundNames.has(s));
  check('every sound the game requests exists in the engine', soundMissing.length === 0,
    soundMissing.length ? `missing ${soundMissing.join(', ')}` : `${played.size} distinct keys requested`);

  const audioMethods = new Set(
    [...audioSrc.matchAll(/^\s{2}(?:async\s+)?([a-zA-Z_]\w*)\s*\(/gm)].map((m) => m[1]),
  );
  audioMethods.delete('constructor');
  const audioCalls = new Set([...all.matchAll(/\b(?:audio|this\.ctx\.audio|ctx\.audio)\.([a-zA-Z_]\w*)\s*\(/g)].map((m) => m[1]));
  const audioMissing = [...audioCalls].filter((m) => !audioMethods.has(m));
  check('every audio.* call resolves to an engine method', audioMissing.length === 0,
    audioMissing.length ? `missing ${audioMissing.join(', ')}` : `${audioCalls.size} distinct calls`);

  /* ---------------- loop handle ---------------- */
  // weapons.js keeps a loop handle and calls stop/setPosition on it.
  check('the loop handle exposes the methods the flamethrower uses',
    /stop\s*\(/.test(audioSrc) && /setPosition\s*\(/.test(audioSrc) && /setVolume\s*\(/.test(audioSrc));

  /* ---------------- tile names ---------------- */
  const texSrc = await fs.readFile(new URL('../src/gfx/textures.js', base), 'utf8');
  // Match only WORLD_TILES entries, so a sprite name cannot pass as a tile.
  const tileNames = new Set([...texSrc.matchAll(/\{\s*name:\s*'([^']+)',\s*paint:\s*\(px\)/g)].map((m) => m[1]));
  const levelSrc = await fs.readFile(new URL('../src/world/levelData.js', base), 'utf8');
  const referenced = new Set();
  for (const m of levelSrc.matchAll(/(?:floor|ceil|wall|trim|door):\s*'([^']+)'/g)) referenced.add(m[1]);
  for (const m of levelSrc.matchAll(/tile:\s*'([^']+)'/g)) referenced.add(m[1]);
  const tileMissing = [...referenced].filter((t) => !tileNames.has(t));
  check('every tile the level names exists in the atlas', tileMissing.length === 0,
    tileMissing.length ? `missing ${tileMissing.join(', ')}` : `${referenced.size} of ${tileNames.size} tiles used`);

  /* ---------------- presentation stage ---------------- */
  /* The HUD is authored at a fixed 320x200 and its gauges must stay circular, so
   * hud.css pins it to a centred 16:10 rectangle. The 3D view has to occupy the
   * identical rectangle or the two layers drift apart: on a 1920x1080 screen a
   * full-viewport view would leave the HUD inset 96px on each side. This checks
   * the two rules still agree. */
  const shellCss = await fs.readFile(new URL('../styles/shell.css', base), 'utf8');
  const hudCss = await fs.readFile(new URL('../styles/hud.css', base), 'utf8');
  const sizingOf = (css, selector) => {
    const block = new RegExp(`${selector.replace(/[.#>]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(css);
    if (!block) return null;
    const body = block[1];
    const width = /width:\s*([^;]+);/.exec(body);
    const ratio = /aspect-ratio:\s*([^;]+);/.exec(body);
    return {
      width: width ? width[1].trim() : null,
      ratio: ratio ? ratio[1].replace(/\s+/g, '') : null,
    };
  };
  const view = sizingOf(shellCss, '#view');
  const hudMount = sizingOf(hudCss, '.saltwake-hud');
  check('the 3D view declares a stage size', !!view && !!view.width && !!view.ratio,
    view ? `${view.width} at ${view.ratio}` : 'no #view rule');
  check('the HUD declares a stage size', !!hudMount && !!hudMount.width && !!hudMount.ratio,
    hudMount ? `${hudMount.width} at ${hudMount.ratio}` : 'no .saltwake-hud rule');
  if (view && hudMount) {
    check('the view and the HUD occupy the same stage',
      view.width === hudMount.width && view.ratio === hudMount.ratio,
      `view ${view.width}/${view.ratio} against hud ${hudMount.width}/${hudMount.ratio}`);
    // A 16:10 stage is what makes a 200-line buffer come out at exactly 320x200.
    const [rw, rh] = hudMount.ratio.split('/').map(Number);
    check('the stage aspect yields a 320x200 buffer at the classic height',
      Math.round(200 * (rw / rh)) === 320, `${rw}:${rh} gives ${Math.round(200 * (rw / rh))}x200`);
  }

  /* ---------------- startup reachability ---------------- */
  /* The pause card covers the whole viewport at a higher stacking level than the
   * canvas, so a click listener bound to the canvas alone can never fire and the
   * player is stranded on a text screen. These two checks encode that lesson. */
  const mainSrc = await read('../src/main.js');
  const bindsCanvasOnly = /canvas\.addEventListener\(\s*'click'/.test(mainSrc)
    && !/document\.addEventListener\(\s*'click'/.test(mainSrc);
  check('the click that starts the game is not bound to the covered canvas',
    !bindsCanvasOnly,
    /document\.addEventListener\(\s*'click'/.test(mainSrc)
      ? 'bound on document, so it fires through the pause card'
      : 'no document-level click listener found');
  check('a keyboard route into the game exists',
    /'Enter'|'Space'/.test(mainSrc), 'Enter or Space also takes the lamp');
  check('the simulation starts paused',
    /paused:\s*true/.test(mainSrc), 'nothing simulates behind the pause card');
  check('boot failures surface the real error on the page',
    /err\.message/.test(mainSrc), 'the player can report what broke');

  const shell = await fs.readFile(new URL('../styles/shell.css', base), 'utf8');
  const pauseBlock = /\.card--pause \{([^}]*)\}/.exec(shell);
  check('the pause card declares its own background', !!pauseBlock);
  if (pauseBlock) {
    // An opaque fallback colour behind the wash would hide the frame entirely.
    const opaque = /#[0-9a-fA-F]{3,8}\s*[;,)]/.test(pauseBlock[1]);
    check('the pause card lets the town show through', !opaque,
      opaque ? 'an opaque colour is still present' : 'rgba layers only');
  }

  /* ---------------- sprite names ---------------- */
  const spriteNames = new Set([...texSrc.matchAll(/\{\s*name:\s*'([^']+)',\s*paint:\s*sprite/g)].map((m) => m[1]));
  const fxSrc = await read('../src/game/fx.js');
  const sanitySrc = await read('../src/game/sanity.js');
  const spriteRefs = new Set();
  for (const src of [fxSrc, sanitySrc]) {
    for (const m of src.matchAll(/addSprite\(\s*'([^']+)'/g)) spriteRefs.add(m[1]);
    for (const m of src.matchAll(/emit\(\s*'([^']+)'/g)) spriteRefs.add(m[1]);
    for (const m of src.matchAll(/SPRITE_IDS\.([a-zA-Z_]\w*)/g)) spriteRefs.add(m[1]);
  }
  const spriteMissing = [...spriteRefs].filter((s) => !spriteNames.has(s));
  check('every sprite the game draws exists in the atlas', spriteMissing.length === 0,
    spriteMissing.length ? `missing ${spriteMissing.join(', ')}` : `${spriteRefs.size} sprites referenced`);
}
