/* items.js - 创造模式物品注册（染色系列算一种，总数 ≥ 80） */
const ITEMS = (function () {
  'use strict';
  let G = null;
  const list = [];
  const byKey = {};

  function blockItem(id, cat, series, iconTile) {
    const b = G.BLOCKS[id];
    const tileIdx = iconTile !== undefined ? iconTile : b.t[1];
    const tileName = G.TILE_LIST[tileIdx];
    const it = {
      key: 'b' + id, name: b.n, block: id, cat: cat, series: series || null,
      icon: function () { return TEXGEN.tileIcon(tileName); }
    };
    list.push(it); byKey[it.key] = it;
  }
  function toolItem(kind, mat, name) {
    const it = {
      key: 'tool_' + kind + '_' + mat, name: name, block: 0, cat: '工具', series: null,
      icon: function () { return TEXGEN.toolIcon(kind, mat); }
    };
    list.push(it); byKey[it.key] = it;
  }
  function miscItem(key, name, cat, place) {
    const it = {
      key: key, name: name, block: place || 0, cat: cat, series: null,
      icon: function () { return TEXGEN.itemIcon(key); }
    };
    list.push(it); byKey[it.key] = it;
  }

  return {
    init: function (g) {
      G = g;
      /* 自然 */
      blockItem(1, '自然'); blockItem(2, '自然'); blockItem(3, '自然'); blockItem(5, '自然');
      blockItem(6, '自然'); blockItem(8, '自然'); blockItem(9, '自然'); blockItem(10, '自然');
      blockItem(59, '自然'); blockItem(60, '自然');
      blockItem(25, '自然'); blockItem(26, '自然'); blockItem(27, '自然'); blockItem(28, '自然');
      blockItem(33, '自然'); blockItem(34, '自然'); blockItem(35, '自然'); blockItem(36, '自然');
      /* 新树种：橡/桦/金合欢/丛林/枫 原木+树叶；红杉/巨橡/榕树巨树 */
      blockItem(89, '自然'); blockItem(91, '自然'); blockItem(92, '自然'); blockItem(94, '自然');
      blockItem(95, '自然'); blockItem(97, '自然'); blockItem(98, '自然'); blockItem(100, '自然');
      blockItem(101, '自然'); blockItem(103, '自然');
      blockItem(104, '自然'); blockItem(105, '自然'); blockItem(106, '自然'); blockItem(107, '自然');
      blockItem(108, '自然'); blockItem(109, '自然');
      blockItem(57, '自然'); blockItem(55, '自然'); blockItem(56, '自然'); blockItem(58, '自然');
      blockItem(54, '自然');
      blockItem(80, '自然'); blockItem(81, '自然'); blockItem(82, '自然'); blockItem(83, '自然');
      blockItem(84, '自然'); blockItem(85, '自然'); blockItem(86, '自然');
      blockItem(87, '自然'); blockItem(88, '自然');
      /* 建筑 */
      blockItem(4, '建筑'); blockItem(7, '建筑'); blockItem(29, '建筑'); blockItem(30, '建筑');
      blockItem(31, '建筑'); blockItem(32, '建筑');
      blockItem(90, '建筑'); blockItem(93, '建筑'); blockItem(96, '建筑'); blockItem(99, '建筑'); blockItem(102, '建筑');
      blockItem(44, '建筑'); blockItem(45, '建筑');
      blockItem(46, '建筑'); blockItem(47, '建筑'); blockItem(61, '建筑'); blockItem(62, '建筑');
      blockItem(63, '建筑'); blockItem(49, '建筑'); blockItem(50, '建筑'); blockItem(51, '建筑');
      blockItem(52, '建筑'); blockItem(53, '建筑'); blockItem(48, '建筑'); blockItem(12, '建筑');
      /* 矿物 */
      for (let id = 13; id <= 24; id++) blockItem(id, '矿物');
      /* 装饰（染色系列） */
      for (let i = 0; i < 16; i++) blockItem(64 + i, '装饰', '羊毛');
      for (let i = 0; i < 6; i++) blockItem(37 + i, '装饰', '陶纹岩');
      blockItem(43, '装饰', '陶纹岩');
      /* 工具 5×5 */
      const mats = [['wood', '木'], ['stone', '石'], ['iron', '铁'], ['gold', '金'], ['diamond', '钻石']];
      const kinds = [['sword', '剑'], ['pickaxe', '镐'], ['axe', '斧'], ['shovel', '锹'], ['hoe', '锄']];
      for (let m = 0; m < 5; m++) for (let k = 0; k < 5; k++)
        toolItem(kinds[k][0], mats[m][0], mats[m][1] + kinds[k][1]);
      /* 食物 */
      miscItem('apple', '苹果', '食物'); miscItem('gapple', '金苹果', '食物');
      miscItem('bread', '面包', '食物'); miscItem('cookie', '曲奇', '食物');
      miscItem('melon_slice', '西瓜片', '食物'); miscItem('carrot', '胡萝卜', '食物');
      miscItem('potato', '土豆', '食物'); miscItem('potato_baked', '烤土豆', '食物');
      miscItem('fish', '生鱼', '食物'); miscItem('fish_cooked', '烤鱼', '食物');
      miscItem('meat_raw', '生肉', '食物'); miscItem('meat_cooked', '烤肉', '食物');
      /* 杂项 */
      miscItem('stick', '木棍', '杂项'); miscItem('coal_item', '煤炭', '杂项');
      miscItem('iron_ingot', '铁锭', '杂项'); miscItem('gold_ingot', '金锭', '杂项');
      miscItem('diamond_gem', '钻石', '杂项'); miscItem('emerald_gem', '翠玉', '杂项');
      miscItem('ruby_gem', '红晶', '杂项'); miscItem('lazul_gem', '青金石', '杂项');
      miscItem('string', '线', '杂项'); miscItem('feather', '羽毛', '杂项');
      miscItem('leather', '皮革', '杂项'); miscItem('paper', '纸', '杂项');
      miscItem('book', '书', '杂项'); miscItem('bone', '骨头', '杂项');
      miscItem('arrow', '箭', '杂项'); miscItem('bow', '弓', '杂项');
      miscItem('bucket', '铁桶', '杂项'); miscItem('bucket_water', '水桶', '杂项', 11);
      miscItem('shears', '剪刀', '杂项'); miscItem('clock_item', '时钟', '杂项');
      miscItem('compass_item', '罗盘', '杂项');
    },
    all: function () { return list; },
    get: function (key) { return byKey[key]; },
    categories: function () { return ['自然', '建筑', '矿物', '装饰', '工具', '食物', '杂项']; },
    // 染色系列算一种
    kindCount: function () {
      const seen = {};
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        if (it.series) { if (!seen[it.series]) { seen[it.series] = 1; n++; } }
        else n++;
      }
      return n;
    }
  };
})();
