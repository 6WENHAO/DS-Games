let seq = 1;
export function nextId() { return seq++; }

export function createHero(side, heroDef) {
  return {
    id: nextId(),
    kind: 'hero',
    side,
    name: heroDef.name,
    icon: heroDef.icon,
    tint: heroDef.tint,
    hp: 30, maxHp: 30, armor: 0,
    atk: 0, tempAtk: 0, attacksThisTurn: 0,
    power: heroDef.power,
    powerUsed: false,
  };
}

export function createPlayer(side, heroDef, deckCardIds) {
  return {
    side,
    hero: createHero(side, heroDef),
    deck: deckCardIds.slice(),
    hand: [],
    board: [],
    mana: 0, maxMana: 0,
    fatigue: 0,
  };
}

export function createMinion(side, card) {
  return {
    id: nextId(),
    kind: 'minion',
    side,
    cardId: card.id,
    name: card.name,
    icon: card.icon,
    tint: card.tint,
    atk: card.atk,
    hp: card.hp, maxHp: card.hp,
    taunt: !!(card.keywords || []).includes('taunt'),
    charge: !!(card.keywords || []).includes('charge'),
    divineShield: !!(card.keywords || []).includes('divineShield'),
    deathrattle: card.deathrattle || null,
    sleeping: true,
    attacksThisTurn: 0,
  };
}
