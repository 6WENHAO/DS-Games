// ============ 物品与背包系统 ============
const Items = (() => {
  const DEFS = {
    carbon:      { name: '碳', desc: '从植物生命中提取的基础燃料元素，可为采矿光束与生命维持系统供能。', max: 250, color: '#6a6a6a' },
    ferrite:     { name: '铁尘', desc: '从岩石地形中开采的常见金属尘埃，是建造与修复的基础材料。', max: 250, color: '#b0855a' },
    magferrite:  { name: '磁化铁氧体', desc: '经地质活动磁化的稀有铁矿物，用于高级科技组件的修复。', max: 250, color: '#e0913a' },
    copper:      { name: '铜', desc: '闪耀着微光的恒星金属，可用于制造彩色科技组件。', max: 250, color: '#3fc9a0' },
    sodium:      { name: '钠', desc: '荧光黄色植物中富含的活性元素，可为危险防护装置充能。', max: 250, color: '#ffd040' },
    dihydrogen:  { name: '二氢', desc: '结晶态的氢元素，遍布宇宙。是制造星舰燃料的关键原料。', max: 250, color: '#4fa8e8' },
    oxygen:      { name: '氧', desc: '生命维持系统的关键补给。可从红色产氧植物中收集。', max: 250, color: '#ff5a4a' },
    cobalt:      { name: '钴', desc: '在洞穴深处结晶的蓝色金属，蕴含离子能量。', max: 250, color: '#5a7aff' },
    metalplate:  { name: '金属镀层', desc: '由铁尘锻造的装甲板，星舰修复的必需品。', max: 10, color: '#9aa5ad', craft: true },
    dihygel:     { name: '二氢凝胶', desc: '高度浓缩的二氢燃料胶体，用于星舰起飞推进器。', max: 10, color: '#4fa8e8', craft: true },
    nanotube:    { name: '碳纳米管', desc: '由纯碳编织的微观结构，多功能工具与引擎修复用。', max: 10, color: '#888888', craft: true },
    terrain:     { name: '地形方块', desc: '地形操纵器生成的标准建材，右键放置。', max: 250, color: '#6a7a82' },
  };

  const RECIPES = [
    { out: 'metalplate', n: 1, req: [['ferrite', 30]] },
    { out: 'dihygel', n: 1, req: [['dihydrogen', 40]] },
    { out: 'nanotube', n: 1, req: [['carbon', 50]] },
    { out: 'terrain', n: 20, req: [['ferrite', 10]] },
  ];

  const SLOTS = 18;
  let inv = []; // { id, n }
  let creative = false;

  function reset() { inv = []; creative = false; }

  function setCreative(on) {
    creative = on;
    if (on) {
      inv = [];
      Object.keys(DEFS).forEach(id => inv.push({ id, n: DEFS[id].max }));
    }
  }

  function count(id) {
    if (creative) return 9999;
    return inv.reduce((s, it) => s + (it && it.id === id ? it.n : 0), 0);
  }

  function add(id, n) {
    if (creative) return n;
    const def = DEFS[id];
    let remaining = n;
    // 填充现有堆叠
    for (const it of inv) {
      if (it && it.id === id && it.n < def.max) {
        const take = Math.min(remaining, def.max - it.n);
        it.n += take; remaining -= take;
        if (!remaining) break;
      }
    }
    // 新槽位
    while (remaining > 0) {
      if (inv.filter(Boolean).length >= SLOTS) return n - remaining; // 满了
      const take = Math.min(remaining, def.max);
      let placed = false;
      for (let i = 0; i < SLOTS; i++) {
        if (!inv[i]) { inv[i] = { id, n: take }; placed = true; break; }
      }
      if (!placed) { inv.push({ id, n: take }); }
      remaining -= take;
    }
    return n;
  }

  function remove(id, n) {
    if (creative) return true;
    if (count(id) < n) return false;
    let remaining = n;
    for (let i = inv.length - 1; i >= 0; i--) {
      const it = inv[i];
      if (it && it.id === id) {
        const take = Math.min(remaining, it.n);
        it.n -= take; remaining -= take;
        if (it.n <= 0) inv[i] = null;
        if (!remaining) break;
      }
    }
    return true;
  }

  function canCraft(recipe) {
    return recipe.req.every(([id, n]) => count(id) >= n);
  }

  function craft(recipe) {
    if (!canCraft(recipe)) return false;
    recipe.req.forEach(([id, n]) => remove(id, n));
    add(recipe.out, recipe.n);
    return true;
  }

  return { DEFS, RECIPES, SLOTS, reset, count, add, remove, canCraft, craft, setCreative,
    get creative() { return creative; }, get inv() { return inv; } };
})();
