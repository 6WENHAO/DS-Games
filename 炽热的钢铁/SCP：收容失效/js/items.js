window.SCP = window.SCP || {};
(function (S) {
  S.ITEMS = {
    keycard1: { name: '一级钥匙卡', level: 1 },
    keycard2: { name: '二级钥匙卡', level: 2 },
    keycard3: { name: '三级钥匙卡', level: 3 },
    keycard4: { name: '四级钥匙卡', level: 4 },
    keycard5: { name: '五级钥匙卡', level: 5 },
    gasmask: { name: '防毒面具', equip: true },
    snav: { name: 'S-NAV 导航仪', equip: true },
    radio: { name: '便携收音机', equip: true },
    battery: { name: '9V 电池' },
    firstaid: { name: '急救包', use: 'heal' },
    eyedrops: { name: '滴眼液', use: 'drops' },
    superdrops: { name: '浓缩滴眼液', use: 'superdrops' },
    scrap: { name: '金属废料' },
    doc_brief: { name: '文件：D级人员须知', doc: 'brief' },
    doc173: { name: '文件：SCP-173', doc: 'd173' },
    doc106: { name: '文件：SCP-106', doc: 'd106' },
    doc096: { name: '文件：SCP-096', doc: 'd096' },
    doc914: { name: '文件：SCP-914', doc: 'd914' },
    doc_pd: { name: '潦草的笔记', doc: 'pd' },
    doc_ez: { name: '文件：撤离通告', doc: 'ez' }
  };

  S.DOCS = {
    brief: {
      title: '橙色手册 · D级人员须知',
      body: 'D-9341：\n\n你已被分配至 Site-19 收容部门协助测试工作。\n\n1. 服从一切穿制服人员的指令。\n2. 未经许可不得离开指定区域。\n3. 测试期间发生的任何现象均属机密。\n4. 月度服务期满后你将被重新安置。\n\n—— 收容部门主管办公室'
    },
    d173: {
      title: '收容档案 #173 · 项目等级：Euclid',
      body: '[摘要 · 大量内容已编辑]\n\n项目为混凝土与钢筋构成的雕像状实体，表面残留喷漆痕迹。\n\n项目在无人直视时会以极高速度移动，并通过扭断颈椎杀害目标。与项目共处一室的人员必须保持至少一人的视线接触，且严禁同时眨眼。\n\n注意：收容室地面发现的红褐色混合物应定期清理。清洁工作须由三名以上D级人员共同进行。'
    },
    d106: {
      title: '收容档案 #106 · 项目等级：Keter',
      body: '[摘要 · 大量内容已编辑]\n\n项目外观为高度腐坏的年长人形，可穿过任何固体物质，接触过的表面会留下黑色腐蚀痕迹。\n\n项目会将猎物拖入其自有的"口袋维度"。极少数从中逃脱的对象描述：黑红色的走廊、不断变化的出口、以及持续的低语。若不幸落入其中——不要停下，去尝试每一扇门。\n\n收容措施依赖定期的诱饵程序。当前收容状态：失效。'
    },
    d096: {
      title: '收容档案 #096 · 项目等级：Euclid',
      body: '[摘要 · 大量内容已编辑]\n\n项目为体型消瘦的苍白人形，平时情绪温顺，长时间保持静坐或踱步。\n\n一旦任何人以任何方式看到项目的面部（包括照片与录像），项目将进入极端情绪状态，在数十秒的哀嚎后不惜一切代价追杀目视者。追击过程中项目可破坏一切障碍物。尚无已知方法在触发后存活。\n\n结论：不要看它的脸。'
    },
    d914: {
      title: '收容档案 #914 · 项目等级：Safe',
      body: '[摘要]\n\n项目为大型发条机械装置，含"输入"与"输出"两个隔间及一个五档旋钮：粗制 / 糙制 / 1:1 / 精制 / 极精制。\n\n放入物品并拉动拉杆后，项目会以未知方式"精炼"物品。"精制"档位常能将钥匙卡升级一个权限等级；"极精制"结果不可预测，可能产出更高级的物品，也可能产出无法辨认的残渣。\n\n严禁放入活体。上一次违规测试的记录已封存。'
    },
    pd: {
      title: '潦草的笔记（作者不明）',
      body: '如果你看到这张纸，说明我已经不在了。\n\n那个老东西把我拖进去过一次。里面是黑的，红的，墙会呼吸。到处都是门，大多数是骗局。\n\n我数过了——只有一扇门后面有光。别管身后的声音，跑。\n\n（纸张边缘有黑色腐蚀痕迹）'
    },
    ez: {
      title: '站点通告 · 紧急撤离程序',
      body: '致全体行政与研究人员：\n\n当站点进入全面封锁状态时，请按以下优先级撤离：\n\n1. 持四级以上权限者：经 B 大门顶层平台等待直升机撤离。\n2. 其余人员：于入口区集合点等待机动特遣队护送。\n\n注意：封锁期间所有检查点大门需要对应等级的钥匙卡。请随身携带您的证件。\n\n—— Site-19 安保指挥部'
    }
  };

  S.RECIPES = function (itemId, setting) {
    const lv = itemId.startsWith('keycard') ? parseInt(itemId.slice(7)) : 0;
    if (lv) {
      if (setting === 0) return 'scrap';
      if (setting === 1) return lv > 1 ? 'keycard' + (lv - 1) : 'scrap';
      if (setting === 2) return itemId;
      if (setting === 3) return 'keycard' + Math.min(5, lv + 1);
      if (setting === 4) {
        if (Math.random() < 0.3) return 'scrap';
        return 'keycard' + Math.min(5, lv + 2);
      }
    }
    if (itemId === 'eyedrops') {
      if (setting === 3) return 'eyedrops';
      if (setting === 4) return 'superdrops';
      if (setting <= 1) return 'scrap';
      return 'eyedrops';
    }
    if (itemId === 'battery') {
      if (setting === 4 && Math.random() < 0.5) return 'keycard1';
      if (setting <= 1) return 'scrap';
      return 'battery';
    }
    if (itemId === 'firstaid') {
      if (setting <= 1) return 'scrap';
      return 'firstaid';
    }
    if (itemId === 'scrap') {
      if (setting === 4 && Math.random() < 0.25) return 'battery';
      return 'scrap';
    }
    if (setting <= 1) return 'scrap';
    return itemId;
  };
  S.SETTING_NAMES = ['粗制', '糙制', '1:1', '精制', '极精制'];

  S.Inventory = function (game) {
    const inv = {
      slots: new Array(10).fill(null),
      equipped: { gasmask: false, snav: false, radio: 0 },
      add(id) {
        const i = inv.slots.findIndex(s => s === null);
        if (i < 0) return false;
        inv.slots[i] = id;
        return true;
      },
      remove(idx) {
        const id = inv.slots[idx];
        inv.slots[idx] = null;
        if (id === 'gasmask') inv.equipped.gasmask = false;
        if (id === 'snav') inv.equipped.snav = false;
        if (id === 'radio') inv.equipped.radio = 0;
        return id;
      },
      has(id) { return inv.slots.includes(id); },
      maxKeyLevel() {
        let m = 0;
        for (const s of inv.slots)
          if (s && s.startsWith('keycard')) m = Math.max(m, parseInt(s.slice(7)));
        return m;
      },
      count() { return inv.slots.filter(Boolean).length; }
    };
    return inv;
  };
})(window.SCP);
