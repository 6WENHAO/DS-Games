// ==== 音效 ====
const SFX = 'assets/sfx';

const FILES = {
  draw: ['draw1.ogg', 'draw2.ogg', 'draw3.ogg'],
  play: ['play1.ogg', 'play2.ogg'],
  summon: ['summon1.ogg', 'summon2.ogg'],
  shuffle: ['shuffle.ogg'],
  fan: ['fan.ogg'],
  coin: ['coin.ogg'],
  attack: ['attack1.ogg', 'attack2.ogg'],
  attackBig: ['attack_big.ogg'],
  armorHit: ['armor_hit.ogg'],
  death: ['death.ogg'],
  shieldPop: ['shield_pop.ogg'],
  spell: ['spell.ogg'],
  spellBig: ['spell_big.ogg'],
  heroPower: ['heropower.ogg'],
  error: ['error.ogg'],
  click: ['click.ogg'],
  hover: ['hover.ogg'],
  turn: ['turn.ogg'],
  victory: ['victory.ogg'],
  defeat: ['defeat.ogg'],
};

const cache = new Map();

function get(url) {
  if (!cache.has(url)) {
    const a = new Audio(url);
    a.preload = 'auto';
    cache.set(url, a);
  }
  return cache.get(url);
}

export const sound = {
  muted: false,
  play(name, volume = 0.7) {
    if (this.muted) return;
    const files = FILES[name];
    if (!files) return;
    const f = files[Math.floor(Math.random() * files.length)];
    const a = get(`${SFX}/${f}`).cloneNode();
    a.volume = volume;
    a.play().catch(() => {});
  },
  preload() {
    for (const files of Object.values(FILES)) {
      for (const f of files) get(`${SFX}/${f}`);
    }
  },
};
