/* weapons.js — 40 把武器数据 + 14 种开火原型 */
(function (K) {
  'use strict';
  var M = K.M, FX = K.FX, S = K.Snd;
  var RCOL = ['#b8c0d0', '#8ad06a', '#6ab0ff', '#c06aff', '#ffc23a'];
  var RNAME = ['普通', '优良', '稀有', '史诗', '传说'];
  var ELEM = {
    fire: { col: '#ff7a2a', col2: '#ffd66a', name: '火' },
    ice: { col: '#6ad4ff', col2: '#d8f4ff', name: '冰' },
    poison: { col: '#7ad04a', col2: '#d0ff9a', name: '毒' },
    shock: { col: '#7fb0ff', col2: '#eaffff', name: '电' },
    void: { col: '#b06aff', col2: '#e6d0ff', name: '虚空' }
  };
  function W(o) {
    o.rarity = o.rarity || 1;
    o.dmg = o.dmg || 6; o.rate = o.rate || 14; o.n = o.n || 1; o.spread = o.spread || 0;
    o.speed = o.speed || 11; o.life = o.life || 60; o.size = o.size || 4;
    o.pierce = o.pierce || 0; o.knock = o.knock === undefined ? 2.4 : o.knock;
    o.energy = o.energy || 0; o.crit = o.crit || 0; o.style = o.style || 'bullet';
    o.cat = o.cat || 'pistol'; o.shape = o.shape || 'pistol';
    o.col = o.col || { a: '#5a6272', b: RCOL[o.rarity - 1] };
    o.bcol = o.bcol || (o.elem ? ELEM[o.elem].col2 : '#ffe9a8');
    o.sfx = o.sfx || 'pistol'; o.shake = o.shake === undefined ? 1.5 : o.shake;
    o.recoil = o.recoil === undefined ? 1 : o.recoil;
    return o;
  }
  var LIST = [
    /* ---------- 手枪 ---------- */
    W({ id: 'p1', name: '新手手枪', cat: 'pistol', shape: 'pistol', rarity: 1, dmg: 7, rate: 13, speed: 12, desc: '可靠的老伙计' }),
    W({ id: 'p2', name: '沙漠之鹰', cat: 'pistol', shape: 'pistol', rarity: 3, dmg: 19, rate: 26, speed: 15, knock: 5, size: 5, shake: 3, sfx: 'sniper', col: { a: '#8a7a4a', b: '#ffd15c' }, desc: '一枪一个，后坐力惊人' }),
    W({ id: 'p3', name: '双管手枪', cat: 'pistol', shape: 'pistol', rarity: 2, dmg: 6, rate: 16, n: 2, spread: .13, desc: '同时打出两发' }),
    W({ id: 'p4', name: '幸运左轮', cat: 'pistol', shape: 'pistol', rarity: 3, dmg: 21, rate: 30, crit: 18, speed: 14, sfx: 'rifle', desc: '暴击率极高的转轮枪' }),
    W({ id: 'p5', name: '毒液手枪', cat: 'pistol', shape: 'pistol', rarity: 2, dmg: 6, rate: 12, elem: 'poison', desc: '子弹附带毒素' }),
    /* ---------- 冲锋枪 / 步枪 ---------- */
    W({ id: 'r1', name: '冲锋枪', cat: 'rifle', shape: 'smg', rarity: 2, dmg: 4.6, rate: 5, auto: 1, spread: .11, speed: 13, knock: 1.2, sfx: 'smg', shake: .8, recoil: .5, desc: '弹雨压制' }),
    W({ id: 'r2', name: '突击步枪', cat: 'rifle', shape: 'rifle', rarity: 3, dmg: 8, rate: 8, auto: 1, spread: .06, speed: 15, sfx: 'rifle', desc: '稳定的全自动步枪' }),
    W({ id: 'r3', name: '三连发步枪', cat: 'rifle', shape: 'rifle', rarity: 3, dmg: 9, rate: 26, burst: { n: 3, gap: 4 }, spread: .04, speed: 16, sfx: 'rifle', desc: '一次三点射' }),
    W({ id: 'r4', name: '重机枪', cat: 'rifle', shape: 'rifle', rarity: 4, dmg: 5.4, rate: 3, auto: 1, spread: .17, speed: 14, knock: 1, sfx: 'smg', shake: .7, recoil: .4, col: { a: '#4a4e5c', b: '#c06aff' }, desc: '子弹如同泼水' }),
    W({ id: 'r5', name: '钉枪', cat: 'rifle', shape: 'smg', rarity: 2, dmg: 5.5, rate: 6, auto: 1, pierce: 1, speed: 17, size: 3, sfx: 'smg', desc: '钉子可穿透一个目标' }),
    W({ id: 'r6', name: '烈焰步枪', cat: 'rifle', shape: 'rifle', rarity: 4, dmg: 7, rate: 7, auto: 1, elem: 'fire', speed: 15, sfx: 'rifle', col: { a: '#6a3a2a', b: '#ff7a2a' }, desc: '点燃一切的燃烧弹' }),
    /* ---------- 霰弹枪 ---------- */
    W({ id: 's1', name: '霰弹枪', cat: 'shotgun', shape: 'shotgun', rarity: 2, dmg: 4.6, rate: 30, n: 6, spread: .5, speed: 12, life: 34, knock: 4, style: 'pellet', sfx: 'shotgun', shake: 4, recoil: 3, desc: '近距离撕碎一切' }),
    W({ id: 's2', name: '双管霰弹', cat: 'shotgun', shape: 'shotgun', rarity: 3, dmg: 5, rate: 44, n: 10, spread: .72, speed: 12, life: 32, knock: 6, style: 'pellet', sfx: 'shotgun', shake: 6, recoil: 5, col: { a: '#6a4a2a', b: '#6ab0ff' }, desc: '两管齐发，后坐力巨大' }),
    W({ id: 's3', name: '自动霰弹', cat: 'shotgun', shape: 'shotgun', rarity: 4, dmg: 4, rate: 17, n: 5, spread: .44, speed: 13, life: 34, knock: 3, style: 'pellet', auto: 1, sfx: 'shotgun', shake: 3, recoil: 2, col: { a: '#3a4a5a', b: '#c06aff' }, desc: '按住不放的霰弹雨' }),
    W({ id: 's4', name: '寒冰霰弹', cat: 'shotgun', shape: 'shotgun', rarity: 4, dmg: 4.4, rate: 32, n: 7, spread: .55, speed: 12, life: 32, elem: 'ice', style: 'pellet', sfx: 'shotgun', shake: 4, recoil: 3, col: { a: '#3a5a6a', b: '#6ad4ff' }, desc: '冻结成群的敌人' }),
    /* ---------- 狙击 ---------- */
    W({ id: 'k1', name: '狙击枪', cat: 'sniper', shape: 'sniper', rarity: 3, dmg: 42, rate: 52, speed: 24, pierce: 3, size: 5, knock: 6, sfx: 'sniper', shake: 5, recoil: 4, desc: '穿透多个敌人的精准射击' }),
    W({ id: 'k2', name: '电磁轨道炮', cat: 'sniper', shape: 'sniper', rarity: 5, dmg: 62, rate: 62, speed: 34, pierce: 99, size: 7, knock: 8, elem: 'shock', energy: 3, sfx: 'sniper', shake: 8, recoil: 6, col: { a: '#2a3a5a', b: '#ffc23a' }, desc: '贯穿整条走廊' }),
    W({ id: 'k3', name: '猎人弩炮', cat: 'sniper', shape: 'sniper', rarity: 4, dmg: 34, rate: 40, speed: 22, pierce: 2, crit: 12, size: 5, sfx: 'sniper', shake: 4, recoil: 3, desc: '高暴击的重弩' }),
    /* ---------- 能量 ---------- */
    W({ id: 'e1', name: '激光手枪', cat: 'energy', shape: 'laser', rarity: 2, dmg: 8, rate: 10, speed: 20, style: 'laserBolt', energy: 1, size: 4, sfx: 'laser', bcol: '#9adfff', desc: '消耗能量的高速光弹' }),
    W({ id: 'e2', name: '激光炮', cat: 'energy', shape: 'laser', rarity: 4, dmg: 3.4, rate: 3, style: 'beam', energy: .34, auto: 1, sfx: 'beam', bcol: '#7fffe0', shake: .6, recoil: .3, col: { a: '#2a4a4a', b: '#7fffe0' }, desc: '持续照射的连续光束' }),
    W({ id: 'e3', name: '等离子步枪', cat: 'energy', shape: 'laser', rarity: 4, dmg: 15, rate: 16, speed: 12, style: 'orb', size: 8, energy: 1.4, explode: { r: 56, dmg: 12 }, sfx: 'laser', bcol: '#b06aff', col: { a: '#3a2a5a', b: '#c06aff' }, desc: '爆裂的等离子球' }),
    W({ id: 'e4', name: '光棱枪', cat: 'energy', shape: 'laser', rarity: 3, dmg: 7, rate: 14, n: 3, spread: .34, speed: 15, style: 'laserBolt', bounce: 3, energy: 1, sfx: 'laser', bcol: '#ffd15c', desc: '光弹会在墙壁间弹射' }),
    W({ id: 'e5', name: '虚空射线', cat: 'energy', shape: 'laser', rarity: 5, dmg: 4.6, rate: 3, style: 'beam', elem: 'void', energy: .5, auto: 1, sfx: 'beam', bcol: '#c06aff', col: { a: '#2a1a3a', b: '#ffc23a' }, desc: '无视护甲的虚空之光' }),
    /* ---------- 爆炸 ---------- */
    W({ id: 'x1', name: '火箭筒', cat: 'launcher', shape: 'launcher', rarity: 4, dmg: 26, rate: 54, speed: 8, style: 'rocket', size: 7, explode: { r: 96, dmg: 44 }, knock: 7, sfx: 'rocket', shake: 5, recoil: 4, bcol: '#ff9a2e', col: { a: '#3a5a3a', b: '#c06aff' }, desc: '大范围爆炸伤害' }),
    W({ id: 'x2', name: '榴弹发射器', cat: 'launcher', shape: 'launcher', rarity: 3, dmg: 14, rate: 38, speed: 9, style: 'grenade', size: 6, life: 55, explode: { r: 78, dmg: 30 }, sfx: 'rocket', shake: 3, recoil: 2.5, bcol: '#8ad06a', desc: '抛物线榴弹，落地爆炸' }),
    W({ id: 'x3', name: '集束火箭', cat: 'launcher', shape: 'launcher', rarity: 5, dmg: 16, rate: 60, n: 3, spread: .3, speed: 8, style: 'rocket', size: 6, explode: { r: 70, dmg: 26 }, homing: .045, sfx: 'rocket', shake: 6, recoil: 4, bcol: '#ffc23a', col: { a: '#5a3a2a', b: '#ffc23a' }, desc: '三发追踪火箭齐射' }),
    W({ id: 'x4', name: '手雷发射器', cat: 'launcher', shape: 'cannon', rarity: 4, dmg: 12, rate: 20, speed: 10, style: 'grenade', size: 5, life: 40, auto: 1, explode: { r: 62, dmg: 22 }, sfx: 'rocket', shake: 2.6, recoil: 2, bcol: '#ffd15c', desc: '连发榴弹机枪' }),
    /* ---------- 弓 ---------- */
    W({ id: 'b1', name: '短弓', cat: 'bow', shape: 'bow', rarity: 1, dmg: 11, rate: 20, speed: 18, style: 'arrow', pierce: 1, charge: 2.2, sfx: 'bow', col: { a: '#8a6a3a', b: '#d8c090' }, desc: '蓄力可提升伤害' }),
    W({ id: 'b2', name: '十字弩', cat: 'bow', shape: 'bow', rarity: 3, dmg: 22, rate: 26, speed: 21, style: 'arrow', pierce: 2, sfx: 'bow', col: { a: '#5a4a3a', b: '#6ab0ff' }, desc: '强力穿透弩箭' }),
    W({ id: 'b3', name: '三叉猎弓', cat: 'bow', shape: 'bow', rarity: 4, dmg: 12, rate: 24, n: 3, spread: .22, speed: 18, style: 'arrow', pierce: 1, charge: 1.8, sfx: 'bow', col: { a: '#3a5a3a', b: '#c06aff' }, desc: '三箭齐发，可蓄力' }),
    W({ id: 'b4', name: '烈焰之弓', cat: 'bow', shape: 'bow', rarity: 5, dmg: 20, rate: 22, speed: 19, style: 'arrow', pierce: 2, elem: 'fire', charge: 2, explode: { r: 48, dmg: 14 }, sfx: 'bow', col: { a: '#6a2a2a', b: '#ffc23a' }, desc: '燃烧箭矢，命中小范围爆燃' }),
    /* ---------- 法杖 ---------- */
    W({ id: 'm1', name: '火球法杖', cat: 'staff', shape: 'staff', rarity: 2, dmg: 14, rate: 24, speed: 9, style: 'orb', size: 9, elem: 'fire', energy: 1.2, explode: { r: 52, dmg: 12 }, sfx: 'magic', col: { a: '#6a4a2a', b: '#ff7a2a' }, desc: '经典火球术' }),
    W({ id: 'm2', name: '寒冰法杖', cat: 'staff', shape: 'staff', rarity: 3, dmg: 9, rate: 13, speed: 13, style: 'orb', size: 7, elem: 'ice', pierce: 1, energy: .8, sfx: 'magic', col: { a: '#3a5a6a', b: '#6ad4ff' }, desc: '冰锥减速敌人' }),
    W({ id: 'm3', name: '闪电法杖', cat: 'staff', shape: 'staff', rarity: 4, dmg: 11, rate: 20, style: 'chain', chainN: 4, chainRange: 190, elem: 'shock', energy: 1.6, sfx: 'tesla', col: { a: '#3a3a6a', b: '#7fb0ff' }, desc: '闪电在敌群中连锁跳跃' }),
    W({ id: 'm4', name: '腐毒法杖', cat: 'staff', shape: 'staff', rarity: 3, dmg: 8, rate: 22, speed: 8, style: 'grenade', size: 8, elem: 'poison', life: 44, pool: { r: 62, dmg: 4, life: 180 }, energy: 1, sfx: 'magic', col: { a: '#3a5a2a', b: '#7ad04a' }, desc: '留下持续伤害的毒池' }),
    W({ id: 'm5', name: '黑洞法杖', cat: 'staff', shape: 'orb', rarity: 5, dmg: 6, rate: 70, speed: 5, style: 'blackhole', size: 12, elem: 'void', energy: 4, life: 150, sfx: 'magic', col: { a: '#2a1a3a', b: '#ffc23a' }, desc: '吸附并撕碎周围敌人' }),
    W({ id: 'm6', name: '奥术连珠', cat: 'staff', shape: 'orb', rarity: 4, dmg: 6, rate: 6, auto: 1, speed: 14, style: 'orb', size: 5, homing: .06, energy: .5, sfx: 'magic', col: { a: '#3a2a5a', b: '#c06aff' }, desc: '自动追踪的奥术飞弹' }),
    /* ---------- 近战 ---------- */
    W({ id: 'w1', name: '铁剑', cat: 'melee', shape: 'sword', rarity: 1, dmg: 15, rate: 22, style: 'melee', arc: { r0: 6, r1: 52, half: 1.05, frames: 9 }, knock: 4, sfx: 'swing', shake: 1.6, desc: '挥砍范围内所有敌人' }),
    W({ id: 'w2', name: '巨剑', cat: 'melee', shape: 'greatsword', rarity: 3, dmg: 32, rate: 34, style: 'melee', arc: { r0: 6, r1: 68, half: 1.35, frames: 12 }, knock: 7, sfx: 'heavy', shake: 4, col: { a: '#5a5a6a', b: '#6ab0ff' }, desc: '大范围重击' }),
    W({ id: 'w3', name: '长矛', cat: 'melee', shape: 'spear', rarity: 2, dmg: 20, rate: 24, style: 'melee', arc: { r0: 10, r1: 82, half: .34, frames: 8 }, knock: 5, sfx: 'swing', shake: 2, desc: '刺出很远的直线攻击' }),
    W({ id: 'w4', name: '战锤', cat: 'melee', shape: 'hammer', rarity: 4, dmg: 40, rate: 42, style: 'melee', arc: { r0: 6, r1: 58, half: 1.2, frames: 14 }, knock: 10, shock: { r: 96, dmg: 16 }, sfx: 'heavy', shake: 7, col: { a: '#4a4a5a', b: '#c06aff' }, desc: '砸地产生冲击波' }),
    W({ id: 'w5', name: '双匕首', cat: 'melee', shape: 'dagger', rarity: 2, dmg: 9, rate: 9, style: 'melee', arc: { r0: 4, r1: 40, half: .8, frames: 6 }, crit: 22, knock: 2, sfx: 'swing', shake: 1, desc: '极快的连击与高暴击' }),
    W({ id: 'w6', name: '雷神之锤', cat: 'melee', shape: 'hammer', rarity: 5, dmg: 44, rate: 40, style: 'melee', arc: { r0: 6, r1: 62, half: 1.25, frames: 14 }, knock: 11, elem: 'shock', shock: { r: 110, dmg: 22 }, chainN: 3, chainRange: 150, sfx: 'heavy', shake: 8, col: { a: '#3a4a6a', b: '#ffc23a' }, desc: '雷击 + 冲击波 + 连锁闪电' }),
    /* ---------- 投掷 / 特殊 ---------- */
    W({ id: 't1', name: '手里剑', cat: 'throw', shape: 'shuriken', rarity: 2, dmg: 8, rate: 11, n: 2, spread: .18, speed: 13, style: 'shuriken', pierce: 2, life: 50, sfx: 'throwx', col: { a: '#4a4a5a', b: '#8ad06a' }, desc: '穿透两名敌人的飞镖' }),
    W({ id: 't2', name: '回旋镖', cat: 'throw', shape: 'shuriken', rarity: 3, dmg: 16, rate: 30, speed: 12, style: 'boomerang', pierce: 99, life: 90, sfx: 'throwx', col: { a: '#8a6a3a', b: '#6ab0ff' }, desc: '飞出去还会飞回来' }),
    W({ id: 't3', name: '特斯拉线圈', cat: 'special', shape: 'tesla', rarity: 5, dmg: 5, rate: 5, style: 'chain', chainN: 3, chainRange: 165, elem: 'shock', energy: .4, auto: 1, sfx: 'tesla', shake: .8, recoil: .2, col: { a: '#2a3a5a', b: '#ffc23a' }, desc: '持续放电，自动连锁' }),
    W({ id: 't4', name: '火焰喷射器', cat: 'special', shape: 'flamer', rarity: 4, dmg: 2.6, rate: 2, style: 'flame', elem: 'fire', speed: 7, life: 18, auto: 1, spread: .28, n: 2, energy: .22, sfx: 'flame', shake: .5, recoil: .2, col: { a: '#5a3a2a', b: '#c06aff' }, desc: '喷出持续燃烧的火舌' }),
    W({ id: 't5', name: '追踪导弹', cat: 'special', shape: 'launcher', rarity: 5, dmg: 13, rate: 26, n: 2, spread: .5, speed: 7, style: 'rocket', size: 5, homing: .075, explode: { r: 62, dmg: 20 }, sfx: 'rocket', shake: 3, recoil: 1.6, bcol: '#ff9a2e', col: { a: '#3a3a4a', b: '#ffc23a' }, desc: '锁定敌人的双联导弹' }),
    W({ id: 't6', name: '圣光十字', cat: 'special', shape: 'orb', rarity: 5, dmg: 11, rate: 18, n: 4, spread: 6.283, speed: 12, style: 'orb', size: 6, pierce: 2, energy: 1.2, sfx: 'magic', bcol: '#fff0a0', col: { a: '#8a7a3a', b: '#ffc23a' }, desc: '四方向圣光弹幕' })
  ];
  var BY = {};
  for (var i = 0; i < LIST.length; i++) BY[LIST[i].id] = LIST[i];

  function dps(w) {
    var mult = w.style === 'melee' ? 1 : (w.n || 1);
    var per = w.dmg * mult * (w.burst ? w.burst.n : 1);
    return per / (w.rate / 60);
  }
  /* 掉落：楼层越深越可能出高稀有度 */
  function roll(R, floor, luck) {
    var wts = [];
    for (var r = 1; r <= 5; r++) {
      var base = [55, 26, 13, 5, 1.4][r - 1];
      var bias = 1 + (floor - 1) * .1 * (r - 1) + (luck || 0) * .06 * (r - 1);
      wts.push({ r: r, w: base * bias });
    }
    var pick = R.weighted(wts).r;
    var pool = LIST.filter(function (w) { return w.rarity === pick; });
    if (!pool.length) pool = LIST;
    return R.pick(pool);
  }
  function rollFrom(R, cats, floor, luck) {
    var w = roll(R, floor, luck), tries = 0;
    while (cats && cats.indexOf(w.cat) < 0 && tries++ < 40) w = roll(R, floor, luck);
    return w;
  }

  /* ---------------- 开火 ---------------- */
  function muzzlePos(p, aim, w) {
    var d = w.style === 'melee' ? 14 : 20;
    return { x: p.x + Math.cos(aim) * d, y: p.y + Math.sin(aim) * d - 2 };
  }
  function canFire(p, w) {
    if (p.fireCd > 0) return false;
    if (w.energy && p.energy < w.energy) return false;
    return true;
  }
  /* 主开火：返回是否成功 */
  function fire(p, w, aim, mods) {
    if (!canFire(p, w)) {
      if (w.energy && p.energy < w.energy && p.noEnergyT <= 0) { S.play('no', .5); p.noEnergyT = 30; FX.text(p.x, p.y - 34, '能量不足', { col: '#9adfff', size: 12, life: 30 }); }
      return false;
    }
    mods = mods || p.mods;
    var rate = w.rate / (mods.rateMul || 1);
    p.fireCd = Math.max(1, Math.round(rate));
    if (w.energy) p.energy = Math.max(0, p.energy - w.energy);
    if (w.burst) { p.burst = { left: w.burst.n, gap: w.burst.gap, t: 0, w: w, aim: aim }; shot(p, w, aim, mods); return true; }
    shot(p, w, aim, mods);
    return true;
  }
  /* 单次射击（burst 会多次调用） */
  function shot(p, w, aim, mods) {
    mods = mods || p.mods;
    var m = muzzlePos(p, aim, w), i, a, spd, dmgMul = (mods.dmgMul || 1) * (p.charge ? 1 : 1);
    var extra = (w.style === 'melee' || w.style === 'beam' || w.style === 'chain') ? 0 : (mods.extraBullets || 0);
    var n = (w.n || 1) + extra;
    var chargeK = 1;
    if (w.charge && p.chargeT > 0) chargeK = 1 + Math.min(1, p.chargeT / 45) * (w.charge - 1);
    p.chargeT = 0;
    var dmg = w.dmg * dmgMul * chargeK;
    var crit = (mods.crit || 0) + (w.crit || 0);
    var kn = w.knock * (mods.knockMul || 1);
    var elem = w.elem || mods.forceElem || null;

    S.play(w.sfx, .9, .02);
    FX.shake(w.shake * (mods.shakeMul === undefined ? 1 : mods.shakeMul), 10, aim + Math.PI);
    p.recoil = Math.min(9, w.recoil * 2.4);
    p.recoilA = aim;
    p.fireFlash = 4;

    switch (w.style) {
      case 'melee': {
        var arc = w.arc || { r0: 6, r1: 50, half: 1, frames: 9 };
        K.B.swing({ owner: p, team: 0, x: p.x, y: p.y, ang: aim, r0: arc.r0, r1: arc.r1 * (mods.rangeMul || 1),
          half: arc.half, frames: arc.frames, dmg: dmg, knock: kn, elem: elem, crit: crit, col: w.col.b,
          shape: w.shape, shock: w.shock, chainN: w.chainN, chainRange: w.chainRange });
        break;
      }
      case 'beam': {
        K.B.beam(p, w, aim, dmg, crit, elem, mods);
        break;
      }
      case 'chain': {
        FX.muzzle(m.x, m.y, aim, 10, w.bcol);
        K.B.chainFrom(m.x, m.y, p, dmg, w.chainN || 3, w.chainRange || 170, 0, crit, elem, w.bcol);
        break;
      }
      case 'blackhole': {
        K.B.spawn({ x: m.x, y: m.y, vx: Math.cos(aim) * w.speed, vy: Math.sin(aim) * w.speed, r: w.size,
          dmg: dmg, team: 0, style: 'blackhole', col: w.bcol, life: w.life, elem: elem, crit: crit, owner: p,
          knock: 0, pierce: 99, size: w.size });
        break;
      }
      default: {
        for (i = 0; i < n; i++) {
          var sp = w.spread;
          if (n === 1) a = aim + M.rnd(-sp, sp) * .35;
          else if (sp >= 6) a = aim + i * (M.TAU / n);
          else a = aim + (n === 1 ? 0 : (i / (n - 1) - .5) * sp * 2) + M.rnd(-.03, .03);
          spd = w.speed * M.rnd(.94, 1.06) * (w.style === 'pellet' ? M.rnd(.85, 1.12) : 1);
          K.B.spawn({
            x: m.x, y: m.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            r: w.size * (w.style === 'pellet' ? .7 : 1) * chargeK, size: w.size * chargeK,
            dmg: dmg, team: 0, style: w.style, col: w.bcol, life: w.life, elem: elem, crit: crit,
            pierce: (w.pierce || 0) + (mods.pierce || 0), knock: kn, owner: p, rot: a,
            explode: w.explode || (mods.explodeBullets ? { r: 44, dmg: dmg * .5 } : null),
            homing: w.homing || mods.homing || 0, bounce: (w.bounce || 0) + (mods.bounce || 0),
            pool: w.pool, gravity: w.style === 'grenade' ? 1 : 0, spin: w.style === 'shuriken' ? .5 : 0,
            ret: w.style === 'boomerang' ? 1 : 0
          });
        }
        FX.muzzle(m.x, m.y, aim, w.style === 'pellet' ? 18 : 13, w.bcol);
        if (w.cat === 'pistol' || w.cat === 'rifle' || w.cat === 'shotgun' || w.cat === 'sniper') FX.shell(m.x, m.y, aim);
        break;
      }
    }
    FX.light(m.x, m.y, 90, w.bcol, 6);
  }
  K.W = { LIST: LIST, BY: BY, RCOL: RCOL, RNAME: RNAME, ELEM: ELEM, W: W,
    dps: dps, roll: roll, rollFrom: rollFrom, fire: fire, shot: shot, canFire: canFire, muzzlePos: muzzlePos };
})(window.K);
