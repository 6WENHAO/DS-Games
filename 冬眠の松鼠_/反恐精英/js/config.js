// ============================================================
//  WEB STRIKE - configuration & data tables
//  Weapon values approximate CS:GO stats (damage, RPM, price,
//  magazine, armor penetration, recoil behaviour).
// ============================================================

export const TEAM = { CT: "CT", T: "T" };

// World scale: 1 world unit = 1 meter. CS:GO ~250 u/s run speed
// (u = inch) => ~6.35 m/s. We keep it snappy and arcade-faithful.
export const PHYS = {
  gravity: 20.0,
  jumpSpeed: 6.4,
  accelerate: 90,        // ground acceleration
  airAccelerate: 30,     // air acceleration (enables air-strafe)
  maxAirWishSpeed: 1.2,  // classic CS air cap
  friction: 8.0,
  stopSpeed: 1.5,
  crouchSpeedMul: 0.34,
  walkSpeedMul: 0.52,    // Shift walk
  eyeHeight: 1.62,
  crouchEyeHeight: 1.05,
  standHalfHeight: 0.9,
  crouchHalfHeight: 0.55,
  radius: 0.36,
  stepHeight: 0.34,
};

// Hitgroup damage multipliers (CS:GO)
export const HITGROUP = {
  head: 4.0,
  chest: 1.0,
  stomach: 1.25,
  arm: 1.0,
  leg: 0.75,
};

export const ARMOR = {
  kevlarPrice: 650,
  helmetPrice: 350,     // extra on top of kevlar in "kevlar+helmet" = 1000
  fullPrice: 1000,
};

// Economy
export const ECON = {
  start: 800,
  maxMoney: 16000,
  killReward: {          // default per weapon type
    rifle: 300, smg: 600, pistol: 300, sniper: 100,
    shotgun: 900, knife: 1500, hegrenade: 300, mg: 300, awp: 100,
  },
  winRound: 3250,
  loseBase: 1400,        // loss bonus base
  loseStep: 500,         // per consecutive loss
  loseMax: 3400,
  plantReward: 300,      // to planter
  defuseReward: 300,
  teamPlantWin: 3500,
  bombLossBonusT: 1500,  // T get money even if lose after planting? simplified
};

// Round timing (seconds)
export const TIMING = {
  buyTime: 20,
  freezeTime: 6,
  roundTime: 115,
  bombTimer: 40,
  plantTime: 3.2,
  defuseNoKit: 10,
  defuseKit: 5,
  postRound: 5,
};

export const MAX_SCORE = 16; // first to 16 (MR15-ish, arcade shortened)

// ------------------------------------------------------------
//  WEAPONS
//  dmg          : base body damage
//  rpm          : rounds per minute (fire rate)
//  mag / reserve: magazine / reserve ammo
//  reload       : reload time seconds
//  armorPen     : fraction of damage that ignores armor (0-1)
//  spread       : base inaccuracy (radians) when standing still
//  moveSpread   : added inaccuracy while moving
//  recoil       : {up, side, decay, magnitude} spray behaviour
//  falloff      : {start(m), factor} distance damage reduction
//  moveSpeed    : max move speed while holding (m/s)
//  auto         : automatic fire
//  penetration  : wallbang power
// ------------------------------------------------------------
export const WEAPONS = {
  // ---- Knife ----
  knife: {
    name: "Knife", cat: "melee", slot: 3, price: 0, dmg: 55, dmgBack: 180,
    rpm: 120, mag: Infinity, reserve: Infinity, reload: 0, armorPen: 0.85,
    range: 1.6, auto: false, moveSpeed: 6.4, killType: "knife",
    icon: "\u{1F5E1}",
  },

  // ---- Pistols ----
  glock: {
    name: "Glock-18", cat: "pistol", team: "T", slot: 2, price: 200, dmg: 30,
    rpm: 400, mag: 20, reserve: 120, reload: 2.2, armorPen: 0.47,
    spread: 0.006, moveSpread: 0.05, moveSpeed: 6.25, auto: false,
    recoil: { up: 1.4, side: 0.7, decay: 6, mag: 1.0 }, falloff: { start: 20, factor: 0.75 },
    hs: 4, killType: "pistol", icon: "\u{1F52B}",
  },
  usp: {
    name: "USP-S", cat: "pistol", team: "CT", slot: 2, price: 200, dmg: 35,
    rpm: 352, mag: 12, reserve: 24, reload: 2.2, armorPen: 0.505,
    spread: 0.004, moveSpread: 0.045, moveSpeed: 6.25, auto: false, silenced: true,
    recoil: { up: 1.6, side: 0.6, decay: 6, mag: 1.0 }, falloff: { start: 22, factor: 0.79 },
    hs: 4, killType: "pistol", icon: "\u{1F52B}",
  },
  p250: {
    name: "P250", cat: "pistol", slot: 2, price: 300, dmg: 38,
    rpm: 400, mag: 13, reserve: 26, reload: 2.2, armorPen: 0.644,
    spread: 0.005, moveSpread: 0.05, moveSpeed: 6.25, auto: false,
    recoil: { up: 1.7, side: 0.8, decay: 6, mag: 1.0 }, falloff: { start: 18, factor: 0.7 },
    hs: 4, killType: "pistol", icon: "\u{1F52B}",
  },
  deagle: {
    name: "Desert Eagle", cat: "pistol", slot: 2, price: 700, dmg: 63,
    rpm: 267, mag: 7, reserve: 35, reload: 2.2, armorPen: 0.934,
    spread: 0.006, moveSpread: 0.09, moveSpeed: 6.25, auto: false,
    recoil: { up: 3.2, side: 1.4, decay: 5, mag: 1.4 }, falloff: { start: 30, factor: 0.81 },
    hs: 4, killType: "pistol", icon: "\u{1F52B}",
  },
  fiveseven: {
    name: "Five-SeveN", cat: "pistol", team: "CT", slot: 2, price: 500, dmg: 32,
    rpm: 400, mag: 20, reserve: 100, reload: 2.7, armorPen: 0.964,
    spread: 0.005, moveSpread: 0.05, moveSpeed: 6.25, auto: false,
    recoil: { up: 1.6, side: 0.7, decay: 6, mag: 1.0 }, falloff: { start: 20, factor: 0.885 },
    hs: 4, killType: "pistol", icon: "\u{1F52B}",
  },
  tec9: {
    name: "Tec-9", cat: "pistol", team: "T", slot: 2, price: 500, dmg: 33,
    rpm: 500, mag: 18, reserve: 90, reload: 2.5, armorPen: 0.904,
    spread: 0.007, moveSpread: 0.06, moveSpeed: 6.25, auto: false,
    recoil: { up: 1.8, side: 1.1, decay: 5.5, mag: 1.0 }, falloff: { start: 18, factor: 0.81 },
    hs: 4, killType: "pistol", icon: "\u{1F52B}",
  },

  // ---- SMGs ----
  mp9: {
    name: "MP9", cat: "smg", team: "CT", slot: 1, price: 1250, dmg: 26,
    rpm: 857, mag: 30, reserve: 120, reload: 2.1, armorPen: 0.604,
    spread: 0.012, moveSpread: 0.03, moveSpeed: 6.5, auto: true,
    recoil: { up: 1.5, side: 1.2, decay: 9, mag: 1.0 }, falloff: { start: 15, factor: 0.75 },
    hs: 4, killType: "smg", icon: "\u{1F4A5}",
  },
  mac10: {
    name: "MAC-10", cat: "smg", team: "T", slot: 1, price: 1050, dmg: 29,
    rpm: 800, mag: 30, reserve: 100, reload: 2.5, armorPen: 0.645,
    spread: 0.014, moveSpread: 0.032, moveSpeed: 6.5, auto: true,
    recoil: { up: 1.6, side: 1.5, decay: 9, mag: 1.0 }, falloff: { start: 14, factor: 0.65 },
    hs: 4, killType: "smg", icon: "\u{1F4A5}",
  },
  mp7: {
    name: "MP7", cat: "smg", slot: 1, price: 1500, dmg: 30,
    rpm: 750, mag: 30, reserve: 120, reload: 2.5, armorPen: 0.625,
    spread: 0.011, moveSpread: 0.028, moveSpeed: 6.4, auto: true,
    recoil: { up: 1.6, side: 1.1, decay: 9, mag: 1.0 }, falloff: { start: 16, factor: 0.72 },
    hs: 4, killType: "smg", icon: "\u{1F4A5}",
  },
  ump: {
    name: "UMP-45", cat: "smg", slot: 1, price: 1200, dmg: 35,
    rpm: 666, mag: 25, reserve: 100, reload: 3.5, armorPen: 0.65,
    spread: 0.012, moveSpread: 0.03, moveSpeed: 6.3, auto: true,
    recoil: { up: 1.8, side: 1.0, decay: 8, mag: 1.0 }, falloff: { start: 14, factor: 0.6 },
    hs: 4, killType: "smg", icon: "\u{1F4A5}",
  },
  p90: {
    name: "P90", cat: "smg", slot: 1, price: 2350, dmg: 26,
    rpm: 857, mag: 50, reserve: 100, reload: 3.4, armorPen: 0.69,
    spread: 0.013, moveSpread: 0.03, moveSpeed: 6.3, auto: true,
    recoil: { up: 1.4, side: 1.3, decay: 9, mag: 1.0 }, falloff: { start: 15, factor: 0.72 },
    hs: 4, killType: "smg", icon: "\u{1F4A5}",
  },

  // ---- Rifles ----
  galil: {
    name: "Galil AR", cat: "rifle", team: "T", slot: 0, price: 1800, dmg: 30,
    rpm: 666, mag: 35, reserve: 90, reload: 3.0, armorPen: 0.775,
    spread: 0.009, moveSpread: 0.07, moveSpeed: 6.15, auto: true,
    recoil: { up: 2.1, side: 1.3, decay: 5.5, mag: 1.05 }, falloff: { start: 30, factor: 0.98 },
    hs: 4, killType: "rifle", icon: "\u{1F3AF}",
  },
  famas: {
    name: "FAMAS", cat: "rifle", team: "CT", slot: 0, price: 2050, dmg: 30,
    rpm: 666, mag: 25, reserve: 90, reload: 3.3, armorPen: 0.70,
    spread: 0.009, moveSpread: 0.07, moveSpeed: 6.15, auto: true,
    recoil: { up: 2.0, side: 1.2, decay: 5.5, mag: 1.0 }, falloff: { start: 30, factor: 0.98 },
    hs: 4, killType: "rifle", icon: "\u{1F3AF}",
  },
  ak47: {
    name: "AK-47", cat: "rifle", team: "T", slot: 0, price: 2700, dmg: 36,
    rpm: 600, mag: 30, reserve: 90, reload: 2.5, armorPen: 0.775,
    spread: 0.007, moveSpread: 0.08, moveSpeed: 6.05, auto: true,
    recoil: { up: 2.6, side: 1.6, decay: 5, mag: 1.15 }, falloff: { start: 30, factor: 0.98 },
    hs: 4, killType: "rifle", icon: "\u{1F3AF}",
  },
  m4a4: {
    name: "M4A4", cat: "rifle", team: "CT", slot: 0, price: 3100, dmg: 33,
    rpm: 666, mag: 30, reserve: 90, reload: 3.1, armorPen: 0.70,
    spread: 0.006, moveSpread: 0.075, moveSpeed: 6.05, auto: true,
    recoil: { up: 2.2, side: 1.2, decay: 5.5, mag: 1.0 }, falloff: { start: 30, factor: 0.99 },
    hs: 4, killType: "rifle", icon: "\u{1F3AF}",
  },
  m4a1s: {
    name: "M4A1-S", cat: "rifle", team: "CT", slot: 0, price: 2900, dmg: 38,
    rpm: 600, mag: 25, reserve: 75, reload: 3.1, armorPen: 0.70, silenced: true,
    spread: 0.005, moveSpread: 0.07, moveSpeed: 6.05, auto: true,
    recoil: { up: 2.0, side: 1.0, decay: 5.5, mag: 0.9 }, falloff: { start: 32, factor: 0.99 },
    hs: 4, killType: "rifle", icon: "\u{1F3AF}",
  },
  sg553: {
    name: "SG 553", cat: "rifle", team: "T", slot: 0, price: 3000, dmg: 30,
    rpm: 545, mag: 30, reserve: 90, reload: 3.0, armorPen: 1.0, scoped: true,
    spread: 0.006, moveSpread: 0.075, moveSpeed: 6.1, auto: true,
    recoil: { up: 2.3, side: 1.3, decay: 5.5, mag: 1.0 }, falloff: { start: 32, factor: 1.0 },
    hs: 4, killType: "rifle", icon: "\u{1F3AF}",
  },
  aug: {
    name: "AUG", cat: "rifle", team: "CT", slot: 0, price: 3300, dmg: 28,
    rpm: 600, mag: 30, reserve: 90, reload: 3.8, armorPen: 0.90, scoped: true,
    spread: 0.005, moveSpread: 0.07, moveSpeed: 6.1, auto: true,
    recoil: { up: 2.0, side: 1.1, decay: 5.5, mag: 0.95 }, falloff: { start: 32, factor: 1.0 },
    hs: 4, killType: "rifle", icon: "\u{1F3AF}",
  },

  // ---- Snipers ----
  ssg08: {
    name: "SSG 08", cat: "sniper", slot: 0, price: 1700, dmg: 88,
    rpm: 48, mag: 10, reserve: 90, reload: 3.7, armorPen: 0.85, sniper: true, zoom: [45, 25],
    spread: 0.02, aimSpread: 0.0002, moveSpread: 0.12, moveSpeed: 6.3, auto: false,
    recoil: { up: 4, side: 1, decay: 4, mag: 1 }, falloff: { start: 60, factor: 1.0 },
    hs: 4, killType: "sniper", icon: "\u{1F3AF}",
  },
  awp: {
    name: "AWP", cat: "sniper", slot: 0, price: 4750, dmg: 115,
    rpm: 41, mag: 10, reserve: 30, reload: 3.7, armorPen: 0.975, sniper: true, zoom: [40, 15],
    spread: 0.03, aimSpread: 0.0001, moveSpread: 0.16, moveSpeed: 5.35, auto: false,
    recoil: { up: 6, side: 1.5, decay: 3, mag: 1 }, falloff: { start: 80, factor: 1.0 },
    hs: 4, killType: "awp", icon: "\u{1F3AF}",
  },
  scar20: {
    name: "SCAR-20", cat: "sniper", team: "CT", slot: 0, price: 5000, dmg: 80,
    rpm: 240, mag: 20, reserve: 90, reload: 3.9, armorPen: 0.85, sniper: true, zoom: [40], auto: true,
    spread: 0.01, aimSpread: 0.0006, moveSpread: 0.12, moveSpeed: 5.9, auto: true,
    recoil: { up: 3.5, side: 1, decay: 4, mag: 1 }, falloff: { start: 50, factor: 1.0 },
    hs: 4, killType: "sniper", icon: "\u{1F3AF}",
  },
  g3sg1: {
    name: "G3SG1", cat: "sniper", team: "T", slot: 0, price: 5000, dmg: 80,
    rpm: 240, mag: 20, reserve: 90, reload: 4.7, armorPen: 0.85, sniper: true, zoom: [40], auto: true,
    spread: 0.01, aimSpread: 0.0006, moveSpread: 0.12, moveSpeed: 5.9, auto: true,
    recoil: { up: 3.5, side: 1, decay: 4, mag: 1 }, falloff: { start: 50, factor: 1.0 },
    hs: 4, killType: "sniper", icon: "\u{1F3AF}",
  },

  // ---- Heavy ----
  nova: {
    name: "Nova", cat: "heavy", slot: 0, price: 1050, dmg: 26, pellets: 9,
    rpm: 68, mag: 8, reserve: 32, reload: 0.5, armorPen: 0.5, shotgun: true,
    spread: 0.05, moveSpread: 0.04, moveSpeed: 6.4, auto: false,
    recoil: { up: 4, side: 1, decay: 5, mag: 1 }, falloff: { start: 8, factor: 0.4 },
    hs: 4, killType: "shotgun", icon: "\u{1F52B}",
  },
  xm1014: {
    name: "XM1014", cat: "heavy", slot: 0, price: 2000, dmg: 20, pellets: 6,
    rpm: 171, mag: 7, reserve: 32, reload: 0.5, armorPen: 0.8, shotgun: true,
    spread: 0.055, moveSpread: 0.045, moveSpeed: 6.4, auto: true,
    recoil: { up: 3.5, side: 1.2, decay: 6, mag: 1 }, falloff: { start: 8, factor: 0.4 },
    hs: 4, killType: "shotgun", icon: "\u{1F52B}",
  },
  m249: {
    name: "M249", cat: "heavy", slot: 0, price: 5200, dmg: 32,
    rpm: 750, mag: 100, reserve: 200, reload: 5.7, armorPen: 0.8,
    spread: 0.012, moveSpread: 0.09, moveSpeed: 5.85, auto: true,
    recoil: { up: 2.4, side: 1.6, decay: 6, mag: 1.1 }, falloff: { start: 30, factor: 0.97 },
    hs: 4, killType: "mg", icon: "\u{1F4A5}",
  },
  negev: {
    name: "Negev", cat: "heavy", slot: 0, price: 1700, dmg: 35,
    rpm: 800, mag: 150, reserve: 200, reload: 6.0, armorPen: 0.75,
    spread: 0.02, moveSpread: 0.1, moveSpeed: 5.85, auto: true,
    recoil: { up: 2.0, side: 2.0, decay: 7, mag: 1.2 }, falloff: { start: 30, factor: 0.95 },
    hs: 4, killType: "mg", icon: "\u{1F4A5}",
  },
};

// Grenades (thrown, separate handling)
export const GRENADES = {
  hegrenade: { name: "HE Grenade", price: 300, radius: 6, maxDmg: 98, icon: "\u{1F4A3}", type: "he" },
  flashbang: { name: "Flashbang", price: 200, radius: 8, icon: "\u{26A1}", type: "flash" },
  smoke: { name: "Smoke Grenade", price: 300, radius: 4, icon: "\u{1F4A8}", type: "smoke" },
  molotov: { name: "Molotov", price: 400, team: "T", radius: 3.5, dps: 20, icon: "\u{1F525}", type: "fire" },
  incgrenade: { name: "Incendiary", price: 600, team: "CT", radius: 3.5, dps: 20, icon: "\u{1F525}", type: "fire" },
  decoy: { name: "Decoy Grenade", price: 50, icon: "\u{1F3AD}", type: "decoy" },
};

// Buy menu categories
export const BUY_CATEGORIES = [
  { key: "1", id: "pistols", label: "Pistols", items: ["glock", "usp", "p250", "fiveseven", "tec9", "deagle"] },
  { key: "2", id: "smgs", label: "Mid-Tier", items: ["mac10", "mp9", "mp7", "ump", "p90"] },
  { key: "3", id: "rifles", label: "Rifles", items: ["galil", "famas", "ak47", "m4a4", "m4a1s", "sg553", "aug"] },
  { key: "4", id: "snipers", label: "Snipers", items: ["ssg08", "awp", "scar20", "g3sg1"] },
  { key: "5", id: "heavy", label: "Heavy", items: ["nova", "xm1014", "m249", "negev"] },
  { key: "6", id: "gear", label: "Gear", items: ["kevlar", "kevlarhelmet", "defuse"] },
  { key: "7", id: "grenades", label: "Grenades", items: ["hegrenade", "flashbang", "smoke", "molotov", "incgrenade", "decoy"] },
];

export const GEAR = {
  kevlar: { name: "Kevlar Vest", price: 650, icon: "\u{1F6E1}" },
  kevlarhelmet: { name: "Kevlar + Helmet", price: 1000, icon: "\u{1FA96}" },
  defuse: { name: "Defuse Kit", price: 400, team: "CT", icon: "\u{2702}" },
};

export const DIFFICULTY = {
  easy:   { reaction: 0.55, aimError: 0.05, accuracy: 0.55, aggression: 0.4, hp: 100 },
  normal: { reaction: 0.32, aimError: 0.028, accuracy: 0.72, aggression: 0.6, hp: 100 },
  hard:   { reaction: 0.18, aimError: 0.015, accuracy: 0.85, aggression: 0.75, hp: 100 },
  expert: { reaction: 0.10, aimError: 0.008, accuracy: 0.94, aggression: 0.9, hp: 100 },
};

export const BOT_NAMES = [
  "Cloud9", "Astralis", "NaVi", "FaZe", "Liquid", "Vitality", "G2", "Fnatic",
  "MOUZ", "NIP", "Heroic", "ENCE", "Spirit", "Cadian", "Zywoo", "s1mple",
  "device", "NiKo", "coldzera", "GeT_RiGhT", "olofmeister", "dev1ce", "KRIMZ",
];
