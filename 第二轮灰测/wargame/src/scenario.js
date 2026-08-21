/* ============================================================================
 * scenario.js —— 「抵抗之弧 2026」兵棋推演 · 情景数据集
 *
 * 数据基准日：2026-08-20（美以伊冲突第 175 天前后）
 * 所有态势设定均来自公开报道（见 SOURCES / BRIEFING），数值为推演用的量化抽象，
 * 不代表任何情报评估；标注「估」的条目为公开报道无确切数字时的推演取值。
 * ==========================================================================*/
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SCENARIO = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ 信源 */
  const SOURCES = [
    { id: 'fm-endwar', label: '伊朗外长：寻求"结束战争"而非"临时停火"（2026-08-19）', url: 'http://big5.china.com.cn/gate/big5/news.china.com.cn/2026-08/19/content_118655030.shtml' },
    { id: 'presstv-integrated', label: 'PressTV：伊朗把结束战争与"停止全线侵略"挂钩（2026-08-20）', url: 'https://www.presstv.co.uk/Detail/2026/08/20/774714/Why-Iran-links-any-war-ending-deal-to-ending-US-Israeli-aggression-across-all-fronts' },
    { id: 'hindu-trade', label: 'The Hindu：以伊互射，地区面临重回全面战争风险', url: 'https://www.thehindu.com/news/international/iran-missile-attacks-on-israel/article71074231.ece' },
    { id: 'gs-day97', label: 'GlobalSecurity：伊朗战争 2026 第 97 天（高浓铀移交机制的结构性僵局）', url: 'https://www.globalsecurity.org/military/ops/iran-war-20260604.htm' },
    { id: 'gs-day91', label: 'GlobalSecurity：第 91 天（格罗西 5-10 披露 60% 铀库存）', url: 'https://www.globalsecurity.org/military/ops/iran-war-20260529.htm' },
    { id: 'iaea-demand', label: '星島：IAEA 要求伊朗全面配合、开放设施并交出高浓铀（2026-06-10）', url: 'https://www.singtaousa.com/2026/06/10/news/world/the-united-nations-nuclear-watchdog-urges-iran-to-fully-cooperate-with-inspections-and-requires-it-to-open-its-nuclear-facilities-and-hand-over-its-enriched-uranium-stockpile/' },
    { id: 'iaea-refuse', label: 'PressTV：伊朗拒绝立即让 IAEA 进入被炸设施，核查与最终协议挂钩（2026-06-24）', url: 'https://www.presstv.co.uk/Detail/2026/06/24/771016/Iran-rules-out-immediate-IAEA-access-to-bombed-nuclear-sites-says-inspections-tied-to-final-deal' },
    { id: 'missile70', label: 'The New Arab：美情报评估伊朗仍保有约 70% 导弹库存', url: 'https://www.newarab.com/news/us-intelligence-says-iran-retains-70-missile-arsenal' },
    { id: 'missile-reject', label: 'Kurdistan24：伊朗外长否认美方对其导弹能力的评估', url: 'https://www.kurdistan24.net/en/story/912802/irans-fm-rejects-us-intelligence-assessment-on-missile-capabilities' },
    { id: 'interceptors', label: 'Zee News：报道称美军为保卫以色列消耗了约一半拦截弹库存', url: 'https://zeenews.india.com/world/us-depleted-half-of-pentagons-missile-interceptors-defending-israel-report-3049461.html' },
    { id: 'cvn-gw', label: 'APA：USS George Washington 开始在中东行动', url: 'https://en.apa.az/america/uss-george-washington-begins-operations-in-middle-east-521035' },
    { id: 'cvn-relief', label: 'Ahram：新航母抵中东替换长期部署舰艇', url: 'https://english.ahram.org.eg/UI/Front/Inner.aspx?NewsContentID=574977' },
    { id: 'us50k', label: 'WION：美国在中东部署约 5 万军事人员', url: 'https://www.wionews.com/photos/50-000-military-personnel-why-has-the-us-deployed-soldiers-in-the-middle-east-1768247608446' },
    { id: 'lb-frame', label: 'Al Jazeera：黎以协议把停火与真主党解除武装挂钩（2026-06-27）', url: 'https://www.aljazeera.com/amp/features/2026/6/27/israel-lebanon-deal-ties-ceasefire-to-hezbollah-disarmament-will-it-work' },
    { id: 'lb-refuse', label: '文匯報：黎以美三方框架协议，真主党强调不放弃武装（2026-06-27）', url: 'https://www.wenweipo.com/a/202606/27/AP6a3fa268e4b0b49ad1c10b7a.html' },
    { id: 'lb-rome', label: 'CGTN：罗马会谈在边界、战俘与真主党解武问题上取得进展（2026-08-08）', url: 'https://news.cgtn.com/news/2026-08-08/Lebanon-says-positive-progress-made-in-Rome-talks-with-Israel-1PqS9QGqnXa/p.html' },
    { id: 'iq-handover', label: 'AP：伊拉克亲伊民兵表示将开始向政府交出武器', url: 'https://apnews.com/article/iraq-iran-us-shiite-militia-asaib-ahl-alhaq-0f1747e05dc1384ab988da4d8eb74008' },
    { id: 'iq-integrate', label: '央视：冲突百日外溢，伊拉克推进民兵武装整合（2026-06-07）', url: 'https://news.qq.com/rain/a/20260607A02SJX00' },
    { id: 'iq-surge', label: 'JPost：伊朗"伊斯兰阵线"仍在，伊拉克民兵活动上升', url: 'http://fr.jpost.com/middle-east/article-880091' },
    { id: 'ye-port', label: '也门一港口遭袭，商业与海上作业全面暂停（2026-08-18）', url: 'https://news.sol.com.cn/html/2026-08-18/A4C237D28726ACACD.shtml' },
    { id: 'ye-mandab', label: 'Times of Israel：也门政府警告胡塞计划夺取曼德海峡沿岸', url: 'https://www.timesofisrael.com/houthis-planning-to-seize-vital-bab-el-mandeb-strait-yemen-government-warns/' },
    { id: 'oil-hormuz', label: 'Sprague：霍尔木兹航运受限、美伊紧张推高油价', url: 'https://www.spragueenergy.com/oil-prices-rally-as-us-iran-tensions-escalate-and-strait-of-hormuz-shipping-remains-restricted/' },
    { id: 'hormuz-data', label: 'Indian Express：航运数据显示美军加强巡逻下的霍尔木兹态势', url: 'https://indianexpress.com/article/world/strait-of-hormuz-us-iran-shipping-kpler-data-trump-oil-prices-10840168/' },
    { id: 'sy-deal', label: 'Al Jazeera：叙利亚过渡领导人称正与以色列谈安全协议（2026-07-26）', url: 'https://www.aljazeera.com/amp/news/2026/7/26/president-ahmed-al-sharaa-syria-seeking-security-deal-with-israel' },
    { id: 'gz-phase2', label: '哈马斯重申履行加沙停火第二阶段路线图（2026-08-19）', url: 'http://www.china.org.cn/2026-08/19/content_118654034.shtml' },
    { id: 'centcom-deny', label: '中評社：美军中央司令部否认推动对伊朗新一轮军事打击', url: 'http://hk.crntt.tw/touch/detail.jsp?coluid=4&kindid=0&docid=107223994' },
    { id: 'fm-sabotage', label: 'Saudi Gazette：伊朗外长指以色列破坏与美停火安排', url: 'https://saudigazette.com.sa/article/663838/world/irans-foreign-minister-accuses-israel-of-sabotaging-ceasefire-deal-with-us' }
  ];
  const SRC = id => SOURCES.find(s => s.id === id);

  /* -------------------------------------------------------------- 情报简报 */
  const BRIEFING = [
    {
      title: '总体态势：打而不停、停而不和',
      text: '美以与伊朗自 2026 年 2 月末开战，已逾 170 天。双方仍在互射导弹与无人机，地区随时可能重回全面战争；' +
        '伊朗公开拒绝"临时停火"，要求"彻底结束战争"，并把任何终战安排与停止全线（含代理人战线）军事行动挂钩。',
      src: ['hindu-trade', 'fm-endwar', 'presstv-integrated']
    },
    {
      title: '核问题：结构性僵局',
      text: 'IAEA 要求伊朗全面配合核查、开放设施并移交高浓铀库存；伊朗则拒绝在最终协议前让核查人员进入被炸设施。' +
        '公开报道显示，谈判卡在"美方设计的高浓铀接收机制"与伊朗要求之间。',
      src: ['iaea-demand', 'iaea-refuse', 'gs-day97', 'gs-day91']
    },
    {
      title: '军事平衡：导弹存量 vs 拦截弹存量',
      text: '美方情报评估伊朗仍保有约 70% 导弹库存（伊朗外长否认该评估）；另一侧，有报道称美军为保卫以色列已消耗约一半拦截弹库存。' +
        '本推演据此设置"饱和齐射消耗拦截弹"的核心机制：红方拼消耗，蓝方拼窗口。',
      src: ['missile70', 'missile-reject', 'interceptors']
    },
    {
      title: '美军部署：两支航母打击群 + 约 5 万人',
      text: 'USS George Washington 已在中东展开行动，替换长期部署的航母；美军在地区维持约 5 万军事人员规模。' +
        '中央司令部否认正在推动对伊朗的新一轮打击。',
      src: ['cvn-gw', 'cvn-relief', 'us50k', 'centcom-deny']
    },
    {
      title: '黎巴嫩：解武换停火的框架',
      text: '黎以美三方框架协议把停火与真主党解除武装挂钩，真主党强调不放弃武装；2026-08-08 罗马会谈在边界、战俘与解武议题上"有进展"。' +
        '推演中真主党处于"解武压力"状态：投入作战会重创黎巴嫩政治进程，也会招致以军全面打击。',
      src: ['lb-frame', 'lb-refuse', 'lb-rome']
    },
    {
      title: '伊拉克：整合与反弹并行',
      text: '伊拉克政府推进民兵武装整合，部分亲伊民兵表示将交出武器；同时有报道指"伊斯兰阵线"仍在、民兵活动回升。' +
        '推演中伊拉克民兵有"整合/激活"两态，激活可打击美军基地但会加速伊拉克政治反弹。',
      src: ['iq-integrate', 'iq-handover', 'iq-surge']
    },
    {
      title: '两处咽喉：霍尔木兹与曼德',
      text: '霍尔木兹航运持续受限、油价被推高，美军加强巡逻；也门方向，胡塞被指计划夺取曼德海峡沿岸，8-18 一处也门港口遭袭后商业与海上作业全面暂停。',
      src: ['oil-hormuz', 'hormuz-data', 'ye-mandab', 'ye-port']
    },
    {
      title: '两条降温线索',
      text: '叙利亚过渡当局正与以色列谈安全协议；加沙停火进入第二阶段路线图，哈马斯重申履约。' +
        '这两条线索在推演中体现为"外交降温"事件：会削弱红方战线联动，也会降低升级阶梯。',
      src: ['sy-deal', 'gz-phase2']
    }
  ];

  /* ------------------------------------------------------------------ 地图
   * 奇数行右移半格（odd-r offset）。每格两字符：地形 + 归属
   *   地形 . 海  d 沙漠  p 平原  m 山地  u 城市  s 海峡   -- 图外
   *   归属 M 地中海 C 里海 G 波斯湾 R 红海/亚丁湾 A 阿拉伯海
   *        T 土耳其 I 伊朗 Q 伊拉克 S 叙利亚 L 黎巴嫩 Z 以色列/巴勒斯坦
   *        J 约旦 E 埃及 K 科威特 U 海湾阿拉伯国家 O 阿曼 Y 也门
   * ------------------------------------------------------------------ */
  const MAP_ROWS = [
    '-- -- mT mT mT mT mT mI mI .C .C -- -- -- --',
    '.M .M mL pS dS dS mQ mI uI mI mI pI -- -- --',
    '.M uL uS dS dS dQ uQ mQ mI uI mI mI pI -- --',
    '.M uZ pZ dS dJ dQ dQ uQ mI uI mI mI dI pI --',
    '.M uZ dZ dJ dU dQ uQ dK .G mI uI dI dI dI --',
    '.M dZ dJ dU dU dU dU .G .G .G sG uI dI dI .A',
    '.R dE dU dU dU dU dU .G .G .G .G dO dO .A .A',
    '.R dE dU dU dU dU dU dU .G dO dO dO .A .A --',
    '.R .R dU dU dU dU dU dU dU dO dO .A .A -- --',
    '.R .R dU dU mY uY dY dY dO .A .A -- -- -- --',
    'sR .R uY mY mY dY dY dY .A .A -- -- -- -- --',
    '.R .R .R uY dY dY .A .A -- -- -- -- -- -- --'
  ];
  const TERRAIN = {
    '.': { id: 'sea', name: '海域', h: 0.06, move: 1, cover: 0 },
    's': { id: 'strait', name: '海峡', h: 0.06, move: 1, cover: 0 },
    'd': { id: 'desert', name: '荒漠', h: 0.30, move: 1, cover: 0.05 },
    'p': { id: 'plain', name: '平原', h: 0.38, move: 1, cover: 0.08 },
    'm': { id: 'mountain', name: '山地', h: 0.86, move: 2, cover: 0.22 },
    'u': { id: 'urban', name: '城区', h: 0.52, move: 1, cover: 0.18 }
  };
  const NATION = {
    M: { name: '地中海', color: '#1b3f6b', sea: 1 }, C: { name: '里海', color: '#1b3f6b', sea: 1 },
    G: { name: '波斯湾', color: '#17537a', sea: 1 }, R: { name: '红海/亚丁湾', color: '#17537a', sea: 1 },
    A: { name: '阿拉伯海', color: '#14456b', sea: 1 },
    T: { name: '土耳其', color: '#5b6472' }, I: { name: '伊朗', color: '#7d2f3a' },
    Q: { name: '伊拉克', color: '#8a6a3a' }, S: { name: '叙利亚', color: '#6d5a46' },
    L: { name: '黎巴嫩', color: '#7a4b52' }, Z: { name: '以色列/巴勒斯坦', color: '#2f5f8a' },
    J: { name: '约旦', color: '#6f6a52' }, E: { name: '埃及', color: '#6a6350' },
    K: { name: '科威特', color: '#7a7052' }, U: { name: '海湾阿拉伯国家', color: '#7c7458' },
    O: { name: '阿曼/阿联酋', color: '#75705a' }, Y: { name: '也门', color: '#7b5540' }
  };

  /* ------------------------------------------------------------------ 要点 */
  // kind: capital 首都 / nuke 核设施 / base 军事基地 / port 港口 / strait 海峡 / city 城市 / oil 油气
  const SITES = [
    { id: 'tehran', name: '德黑兰', kind: 'capital', side: 'red', c: 9, r: 2, hard: 1, value: 10, tag: '政权中枢' },
    { id: 'tabriz', name: '大不里士', kind: 'city', side: 'red', c: 8, r: 1, hard: 0, value: 4 },
    { id: 'fordow', name: '福尔多浓缩厂', kind: 'nuke', side: 'red', c: 8, r: 3, hard: 3, value: 12, tag: '深埋山体·需钻地弹', dmg: 55 },
    { id: 'isfahan', name: '伊斯法罕核设施群', kind: 'nuke', side: 'red', c: 9, r: 3, hard: 2, value: 9, dmg: 60 },
    { id: 'natanz', name: '纳坦兹浓缩厂', kind: 'nuke', side: 'red', c: 9, r: 4, hard: 2, value: 10, dmg: 65 },
    { id: 'bushehr', name: '布什尔核电站', kind: 'nuke', side: 'red', c: 10, r: 4, hard: 1, value: 6, tag: '民用堆·打击代价高', dmg: 5 },
    { id: 'bandar', name: '阿巴斯港', kind: 'port', side: 'red', c: 11, r: 5, hard: 1, value: 8, tag: '伊朗海军/反舰基地' },
    { id: 'hormuz', name: '霍尔木兹海峡', kind: 'strait', side: 'neutral', c: 10, r: 5, hard: 0, value: 14, tag: '全球能源咽喉' },
    { id: 'kharg', name: '哈尔克岛油终端', kind: 'oil', side: 'red', c: 9, r: 5, hard: 1, value: 9 },
    { id: 'baghdad', name: '巴格达', kind: 'capital', side: 'neutral', c: 6, r: 2, hard: 1, value: 6 },
    { id: 'asad', name: '阿萨德空军基地', kind: 'base', side: 'blue', c: 5, r: 3, hard: 2, value: 7, tag: '驻伊美军' },
    { id: 'erbil', name: '埃尔比勒', kind: 'base', side: 'blue', c: 6, r: 1, hard: 1, value: 5, tag: '驻伊美军' },
    { id: 'basra', name: '巴士拉', kind: 'city', side: 'neutral', c: 6, r: 4, hard: 0, value: 5 },
    { id: 'damascus', name: '大马士革', kind: 'capital', side: 'neutral', c: 2, r: 2, hard: 1, value: 5, tag: '过渡当局·与以谈安全协议' },
    { id: 'beirut', name: '贝鲁特', kind: 'capital', side: 'neutral', c: 1, r: 2, hard: 1, value: 6 },
    { id: 'beqaa', name: '贝卡谷地', kind: 'base', side: 'red', c: 2, r: 1, hard: 2, value: 7, tag: '真主党纵深' },
    { id: 'telaviv', name: '特拉维夫', kind: 'city', side: 'blue', c: 1, r: 4, hard: 1, value: 11, tag: '人口/经济中心' },
    { id: 'haifa', name: '海法', kind: 'port', side: 'blue', c: 1, r: 3, hard: 1, value: 9, tag: '港口/炼化' },
    { id: 'nevatim', name: '内瓦提姆基地', kind: 'base', side: 'blue', c: 2, r: 4, hard: 2, value: 9, tag: 'F-35I 主基地' },
    { id: 'gaza', name: '加沙', kind: 'city', side: 'neutral', c: 1, r: 5, hard: 1, value: 4, tag: '停火第二阶段' },
    { id: 'udeid', name: '乌代德基地', kind: 'base', side: 'blue', c: 6, r: 6, hard: 2, value: 10, tag: '美中央司令部前沿' },
    { id: 'bahrain', name: '巴林（第五舰队）', kind: 'base', side: 'blue', c: 6, r: 5, hard: 1, value: 8 },
    { id: 'dhahran', name: '达兰油区', kind: 'oil', side: 'neutral', c: 5, r: 5, hard: 1, value: 10, tag: '沙特出口枢纽' },
    { id: 'sanaa', name: '萨那', kind: 'capital', side: 'red', c: 5, r: 9, hard: 1, value: 5 },
    { id: 'hodeidah', name: '荷台达港', kind: 'port', side: 'red', c: 2, r: 10, hard: 1, value: 7, tag: '胡塞海上行动枢纽' },
    { id: 'aden', name: '亚丁', kind: 'port', side: 'neutral', c: 3, r: 11, hard: 0, value: 5 },
    { id: 'mandab', name: '曼德海峡', kind: 'strait', side: 'neutral', c: 0, r: 10, hard: 0, value: 11, tag: '第二咽喉' }
  ];

  /* ------------------------------------------------------------------ 兵力
   * type: air 航空兵 / bmb 战略轰炸 / msl 弹道导弹 / uav 无人机 / ad 防空反导
   *       nav 海军 / grd 地面 / cyb 网络与特战
   * atk 单发威力 / shots 每次出动弹量 / acc 命中系数 / ad 防空强度 / rng 射程(格)
   * bunker=1 具备钻地打击能力；hyper=1 高超音速/难拦截；stealth 隐身修正
   * status: ready / pressure(解武压力) / integrating(整合中) / ceasefire(停火中)
   * ------------------------------------------------------------------ */
  const UNITS = [
    // ---------------- 蓝方：以色列 ----------------
    { id: 'il-af1', name: '以空军第一联队(F-35I)', short: 'F-35I', side: 'blue', actor: 'IL', type: 'air', c: 2, r: 4, hp: 92, atk: 16, shots: 4, acc: 0.88, stealth: 0.30, rng: 7, ammo: 6, ad: 0 },
    { id: 'il-af2', name: '以空军第二联队(F-15I/16I)', short: 'F-15I', side: 'blue', actor: 'IL', type: 'air', c: 1, r: 3, hp: 88, atk: 13, shots: 5, acc: 0.82, stealth: 0.10, rng: 6, ammo: 7, ad: 0 },
    { id: 'il-sof', name: '以军特战/情报网络', short: 'SOF', side: 'blue', actor: 'IL', type: 'cyb', c: 2, r: 4, hp: 70, atk: 9, shots: 1, acc: 0.62, rng: 9, ammo: 4, ad: 0, sab: 1 },
    { id: 'il-arrow', name: '箭-2/3 反导系统', short: 'Arrow', side: 'blue', actor: 'IL', type: 'ad', c: 1, r: 4, hp: 84, atk: 0, shots: 0, acc: 0, rng: 4, ammo: 0, ad: 34 },
    { id: 'il-ds', name: '大卫投石索', short: 'D-Sling', side: 'blue', actor: 'IL', type: 'ad', c: 1, r: 3, hp: 80, atk: 0, shots: 0, acc: 0, rng: 3, ammo: 0, ad: 26 },
    { id: 'il-idome', name: '铁穹弹群', short: 'I-Dome', side: 'blue', actor: 'IL', type: 'ad', c: 2, r: 4, hp: 86, atk: 0, shots: 0, acc: 0, rng: 2, ammo: 0, ad: 20 },
    { id: 'il-north', name: '以军北部军', short: '北部军', side: 'blue', actor: 'IL', type: 'grd', c: 2, r: 3, hp: 90, atk: 11, shots: 2, acc: 0.7, rng: 2, ammo: 9, ad: 4 },
    // ---------------- 蓝方：美军 ----------------
    { id: 'us-cvn1', name: 'CSG-1「乔治·华盛顿」号', short: 'CVN-73', side: 'blue', actor: 'US', type: 'nav', c: 12, r: 7, hp: 96, atk: 14, shots: 5, acc: 0.85, rng: 6, ammo: 8, ad: 22, note: '新抵战区' },
    { id: 'us-cvn2', name: 'CSG-2（待轮换航母）', short: 'CSG-2', side: 'blue', actor: 'US', type: 'nav', c: 9, r: 7, hp: 78, atk: 12, shots: 4, acc: 0.8, rng: 6, ammo: 5, ad: 18, note: '长期部署疲劳' },
    { id: 'us-379', name: '美空军第379远征联队', short: '379EW', side: 'blue', actor: 'US', type: 'air', c: 6, r: 6, hp: 90, atk: 14, shots: 5, acc: 0.84, stealth: 0.08, rng: 6, ammo: 7, ad: 0 },
    { id: 'us-bomb', name: 'B-2/B-52 全球打击编队', short: 'B-2', side: 'blue', actor: 'US', type: 'bmb', c: 13, r: 8, hp: 95, atk: 30, shots: 2, acc: 0.9, stealth: 0.35, rng: 12, ammo: 2, ad: 0, bunker: 1, note: 'GBU-57 钻地弹·极稀缺' },
    { id: 'us-pat', name: '爱国者/萨德群', short: 'PAC/THAAD', side: 'blue', actor: 'US', type: 'ad', c: 6, r: 6, hp: 88, atk: 0, shots: 0, acc: 0, rng: 4, ammo: 0, ad: 30 },
    { id: 'us-cyb', name: '美网络与太空司令部', short: 'CYBER', side: 'blue', actor: 'US', type: 'cyb', c: 6, r: 6, hp: 92, atk: 7, shots: 1, acc: 0.7, rng: 12, ammo: 5, ad: 0, sab: 1 },
    // ---------------- 红方：伊朗 ----------------
    { id: 'ir-msl1', name: '航空航天军导弹旅群(西)', short: '导弹旅A', side: 'red', actor: 'IR', type: 'msl', c: 7, r: 2, hp: 82, atk: 15, shots: 7, acc: 0.6, rng: 8, ammo: 7, ad: 4 },
    { id: 'ir-msl2', name: '「法塔赫」高超音速旅', short: '法塔赫', side: 'red', actor: 'IR', type: 'msl', c: 10, r: 3, hp: 74, atk: 19, shots: 4, acc: 0.7, rng: 9, ammo: 4, ad: 4, hyper: 1 },
    { id: 'ir-uav', name: '无人机司令部(见证者-136/238)', short: 'UAV群', side: 'red', actor: 'IR', type: 'uav', c: 9, r: 4, hp: 86, atk: 8, shots: 9, acc: 0.5, rng: 9, ammo: 9, ad: 2 },
    { id: 'ir-ad', name: '伊朗防空司令部(残余)', short: '巴瓦尔-373', side: 'red', actor: 'IR', type: 'ad', c: 9, r: 2, hp: 46, atk: 0, shots: 0, acc: 0, rng: 4, ammo: 0, ad: 21, note: '前期打击后重建中' },
    { id: 'ir-eng', name: '核设施工程与防护部队', short: '工程旅', side: 'red', actor: 'IR', type: 'grd', c: 9, r: 3, hp: 80, atk: 3, shots: 1, acc: 0.5, rng: 1, ammo: 9, ad: 6, repair: 1 },
    { id: 'ir-navy', name: '革命卫队海军(快艇/水雷/岸舰)', short: 'IRGC-N', side: 'red', actor: 'IR', type: 'nav', c: 11, r: 5, hp: 72, atk: 11, shots: 5, acc: 0.55, rng: 3, ammo: 7, ad: 8, mine: 1 },
    { id: 'ir-cyb', name: '伊朗网络战部队', short: 'CYB-IR', side: 'red', actor: 'IR', type: 'cyb', c: 9, r: 2, hp: 76, atk: 6, shots: 1, acc: 0.6, rng: 12, ammo: 5, ad: 0, sab: 1 },
    // ---------------- 红方：代理人网络 ----------------
    { id: 'hz-rkt', name: '真主党火箭军(受创)', short: 'HZ火箭', side: 'red', actor: 'HZ', type: 'msl', c: 2, r: 1, hp: 52, atk: 10, shots: 6, acc: 0.45, rng: 3, ammo: 5, ad: 3, status: 'pressure', note: '解武框架下受政治约束' },
    { id: 'hz-radwan', name: '真主党拉德万部队', short: '拉德万', side: 'red', actor: 'HZ', type: 'grd', c: 2, r: 2, hp: 58, atk: 9, shots: 2, acc: 0.6, rng: 2, ammo: 6, ad: 3, status: 'pressure' },
    { id: 'iq-kh', name: '伊拉克·卡塔布真主党', short: 'KH', side: 'red', actor: 'IQ', type: 'msl', c: 5, r: 2, hp: 66, atk: 9, shots: 5, acc: 0.5, rng: 4, ammo: 6, ad: 2, status: 'integrating' },
    { id: 'iq-aah', name: '伊拉克·真理旅', short: 'AAH', side: 'red', actor: 'IQ', type: 'grd', c: 6, r: 3, hp: 60, atk: 8, shots: 3, acc: 0.55, rng: 3, ammo: 5, ad: 2, status: 'integrating', note: '公开表示将交出部分武器' },
    { id: 'hu-msl', name: '胡塞导弹/无人机部队', short: '胡塞导弹', side: 'red', actor: 'HU', type: 'msl', c: 5, r: 9, hp: 78, atk: 10, shots: 6, acc: 0.45, rng: 8, ammo: 7, ad: 3 },
    { id: 'hu-nav', name: '胡塞海上袭击队(反舰/水雷)', short: '胡塞海上', side: 'red', actor: 'HU', type: 'nav', c: 2, r: 10, hp: 70, atk: 10, shots: 4, acc: 0.5, rng: 3, ammo: 6, ad: 2, mine: 1 },
    { id: 'hm-gaza', name: '哈马斯残余(停火中)', short: '哈马斯', side: 'red', actor: 'HM', type: 'grd', c: 1, r: 5, hp: 34, atk: 5, shots: 2, acc: 0.4, rng: 1, ammo: 3, ad: 1, status: 'ceasefire' }
  ];

  /* ------------------------------------------------------------- 初始指标 */
  const METERS = {
    esc: 6,             // 升级阶梯 0-10（6 = 高强度交火但未全面战争）
    heu: 62,            // 伊朗高浓铀/浓缩能力指数（0-100，95+ 视为突破）
    hormuz: 55,         // 霍尔木兹通航率 %（公开报道：持续受限）
    mandab: 48,         // 曼德海峡通航率 %（也门港口遇袭后作业暂停）
    oil: 104,           // 布伦特油价 美元/桶（由通航率推导）
    intercept: 50,      // 蓝方拦截弹库存 %（报道称已消耗约一半）
    usWill: 58,         // 美国国内支持 %
    irCohesion: 54,     // 伊朗政权凝聚力 %
    arabTilt: 12,       // 阿拉伯国家立场 -100 亲伊 … +100 亲美以
    talks: 24,          // 停火谈判进度 %
    civ: 38,            // 人道/民用损失压力 %
    ilMorale: 62,       // 以色列社会承受力 %
    redMissiles: 70     // 红方导弹存量 %（美情报评估 ≈70%）
  };

  /* ------------------------------------------------------------ 随机事件牌
   * when(state) 返回是否可抽；apply(state, api) 施加效果并返回描述
   * ------------------------------------------------------------ */
  const EVENTS = [
    {
      id: 'rome-talks', title: '罗马间接会谈取得进展', src: 'lb-rome', weight: 3,
      when: s => s.meters.esc <= 8,
      apply: (s, a) => { a.meter('talks', +7); a.meter('esc', -1); return '黎以在边界、战俘与解武议题上取得进展，谈判轨道升温。'; }
    },
    {
      id: 'hz-refuse', title: '真主党重申不放弃武装', src: 'lb-refuse', weight: 3,
      when: () => true,
      apply: (s, a) => { a.meter('talks', -5); a.status('hz-rkt', 'ready'); a.status('hz-radwan', 'ready'); return '真主党拒绝解除武装，黎巴嫩战线政治约束松动（HZ 可自由投入作战）。'; }
    },
    {
      id: 'iq-handover', title: '伊拉克民兵开始移交武器', src: 'iq-handover', weight: 3,
      when: () => true,
      apply: (s, a) => { a.meter('arabTilt', +6); a.damageUnit('iq-aah', 14); a.status('iq-aah', 'integrating'); return '真理旅向政府移交部分武器，伊拉克战线红方战力下降。'; }
    },
    {
      id: 'iq-surge', title: '伊拉克民兵活动回升', src: 'iq-surge', weight: 3,
      when: () => true,
      apply: (s, a) => { a.status('iq-kh', 'ready'); a.status('iq-aah', 'ready'); a.meter('esc', +1); return '亲伊民兵重新活跃，驻伊美军基地威胁上升。'; }
    },
    {
      id: 'ye-port', title: '也门港口遇袭 · 海上作业暂停', src: 'ye-port', weight: 3,
      when: () => true,
      apply: (s, a) => { a.meter('mandab', -12); a.meter('oil', +4); return '也门一处港口遭袭，商业与海上作业全面暂停，曼德海峡通航进一步恶化。'; }
    },
    {
      id: 'iaea-demand', title: 'IAEA 要求全面核查与移交高浓铀', src: 'iaea-demand', weight: 3,
      when: () => true,
      apply: (s, a) => { a.meter('talks', +4); a.meter('irCohesion', -3); return '国际压力上升：要求伊朗开放设施并交出高浓铀库存。'; }
    },
    {
      id: 'iaea-refuse', title: '伊朗拒绝核查人员进入被炸设施', src: 'iaea-refuse', weight: 3,
      when: () => true,
      apply: (s, a) => { a.meter('talks', -6); a.meter('arabTilt', +3); return '伊朗坚持核查与最终协议挂钩，谈判轨道受挫。'; }
    },
    {
      id: 'interceptor-report', title: '拦截弹库存告急的报道曝光', src: 'interceptors', weight: 2,
      when: s => s.meters.intercept < 55,
      apply: (s, a) => { a.meter('usWill', -5); a.meter('ilMorale', -4); return '媒体披露拦截弹消耗过半，防御可持续性引发国内质疑。'; }
    },
    {
      id: 'cvn-arrive', title: '新航母打击群抵达战区', src: 'cvn-gw', weight: 2,
      when: () => true,
      apply: (s, a) => { a.healUnit('us-cvn1', 8); a.ammo('us-cvn1', +2); a.meter('esc', +1); return '航母轮换到位，蓝方海上打击能力恢复。'; }
    },
    {
      id: 'centcom-deny', title: '中央司令部否认将扩大打击', src: 'centcom-deny', weight: 2,
      when: () => true,
      apply: (s, a) => { a.meter('esc', -1); a.meter('talks', +3); return '美军公开否认推动新一轮打击，紧张略有缓解。'; }
    },
    {
      id: 'syria-deal', title: '叙以安全协议谈判推进', src: 'sy-deal', weight: 2,
      when: () => true,
      apply: (s, a) => { a.meter('esc', -1); a.meter('arabTilt', +5); a.meter('talks', +3); return '叙利亚过渡当局与以色列谈安全协议，红方北部战线联动被削弱。'; }
    },
    {
      id: 'gaza-phase2', title: '加沙停火第二阶段推进', src: 'gz-phase2', weight: 2,
      when: () => true,
      apply: (s, a) => { a.status('hm-gaza', 'ceasefire'); a.meter('civ', -5); a.meter('talks', +4); return '加沙停火第二阶段路线图推进，人道压力缓解。'; }
    },
    {
      id: 'hormuz-patrol', title: '美军加强霍尔木兹护航巡逻', src: 'hormuz-data', weight: 3,
      when: () => true,
      apply: (s, a) => { a.meter('hormuz', +9); a.meter('esc', +1); return '护航与扫雷行动使霍尔木兹通航率回升，但双方海上接触风险上升。'; }
    },
    {
      id: 'oil-spike', title: '油价跳涨冲击全球市场', src: 'oil-hormuz', weight: 3,
      when: s => s.meters.hormuz < 60,
      apply: (s, a) => { a.meter('oil', +8); a.meter('usWill', -4); a.meter('arabTilt', -4); return '航运受限推动油价跳涨，美方国内与阿拉伯国家均感压力。'; }
    },
    {
      id: 'fm-endwar', title: '伊朗坚持"彻底结束战争"', src: 'fm-endwar', weight: 3,
      when: () => true,
      apply: (s, a) => { a.meter('irCohesion', +4); a.meter('talks', -3); return '伊朗拒绝临时停火，要求全线终战，短期谈判空间收窄。'; }
    },
    {
      id: 'sabotage-claim', title: '伊朗指以色列破坏停火安排', src: 'fm-sabotage', weight: 2,
      when: () => true,
      apply: (s, a) => { a.meter('talks', -4); a.meter('esc', +1); return '互相指责破坏停火，谈判互信下降。'; }
    }
  ];

  /* ---------------------------------------------------------- 政治行动牌 */
  const POLITICS = {
    blue: [
      { id: 'b-pressure', name: '加压：扩大制裁与外交孤立', desc: '削弱伊朗凝聚力，但拉低谈判进度', apply: (s, a) => { a.meter('irCohesion', -6); a.meter('talks', -3); a.meter('arabTilt', +2); } },
      { id: 'b-offer', name: '提出临时停火方案', desc: '推动谈判；伊朗要求"彻底结束战争"，效果受限', apply: (s, a) => { a.meter('talks', s.flags.blueHalt ? +12 : +5); a.meter('esc', -1); } },
      { id: 'b-halt', name: '承诺暂停深度打击（两回合）', desc: '解锁谈判上限，但两回合内禁用战略轰炸与深度打击', apply: (s, a) => { a.flag('blueHalt', 2); a.meter('talks', +8); a.meter('esc', -2); a.meter('ilMorale', -3); } },
      { id: 'b-reinforce', name: '增派拦截弹与防空资产', desc: '拦截弹库存 +18%，升级阶梯 +1', apply: (s, a) => { a.meter('intercept', +18); a.meter('esc', +1); } },
      { id: 'b-escort', name: '组织海湾护航与扫雷', desc: '霍尔木兹通航 +12%，海上摩擦风险上升', apply: (s, a) => { a.meter('hormuz', +12); a.meter('esc', +1); } },
      { id: 'b-lebanon', name: '施压黎巴嫩政府推进解武', desc: '真主党转入解武压力状态，谈判 +4', apply: (s, a) => { a.status('hz-rkt', 'pressure'); a.status('hz-radwan', 'pressure'); a.meter('talks', +4); a.meter('arabTilt', +3); } },
      { id: 'b-deep', name: '授权深度打击（下回合威力 +25%）', desc: '升级阶梯 +2，谈判 -6', apply: (s, a) => { a.flag('blueSurge', 1); a.meter('esc', +2); a.meter('talks', -6); } },
      { id: 'b-total', name: '⚠ 跨过门槛：转入全面战争', desc: '仅在升级阶梯 9 时可选 —— 立即触发灾难结局判定', need: s => s.meters.esc >= 9, apply: (s, a) => { a.flag('totalWar', 99); } }
    ],
    red: [
      { id: 'r-endwar', name: '坚持"彻底结束战争"立场', desc: '凝聚力 +6，谈判 -4', apply: (s, a) => { a.meter('irCohesion', +6); a.meter('talks', -4); } },
      { id: 'r-heu', name: '接受高浓铀移交机制（有条件）', desc: '解锁谈判上限；核指数增长归零', apply: (s, a) => { a.flag('redHeuDeal', 99); a.meter('talks', +10); a.meter('irCohesion', -5); } },
      { id: 'r-hormuz', name: '威胁封锁霍尔木兹', desc: '通航 -14%，油价上行，升级 +1', apply: (s, a) => { a.meter('hormuz', -14); a.meter('esc', +1); a.meter('arabTilt', -5); } },
      { id: 'r-iraq', name: '激活伊拉克民兵战线', desc: 'KH/AAH 转为可用，升级 +1，阿拉伯立场 -4', apply: (s, a) => { a.status('iq-kh', 'ready'); a.status('iq-aah', 'ready'); a.meter('esc', +1); a.meter('arabTilt', -4); } },
      { id: 'r-mandab', name: '扩大曼德海峡海上行动', desc: '曼德通航 -12%，油价 +5，阿拉伯立场 -3', apply: (s, a) => { a.meter('mandab', -12); a.meter('oil', +5); a.meter('arabTilt', -3); } },
      { id: 'r-resupply', name: '导弹产能动员与分散储备', desc: '红方导弹存量 +14%，凝聚力 -2', apply: (s, a) => { a.meter('redMissiles', +14); a.meter('irCohesion', -2); } },
      { id: 'r-iaea', name: '有限恢复 IAEA 核查', desc: '谈判 +7、阿拉伯立场 +4，凝聚力 -4', apply: (s, a) => { a.meter('talks', +7); a.meter('arabTilt', +4); a.meter('irCohesion', -4); } },
      { id: 'r-total', name: '⚠ 跨过门槛：全面战争总动员', desc: '仅在升级阶梯 9 时可选 —— 立即触发灾难结局判定', need: s => s.meters.esc >= 9, apply: (s, a) => { a.flag('totalWar', 99); } }
    ]
  };

  /* --------------------------------------------------------------- 目标值 */
  const VICTORY_TEXT = {
    blueMil: '蓝方军事目标：核指数 ≤ 15 且 红方导弹存量 ≤ 30%',
    bluePol: '蓝方政治目标：谈判 ≥ 80 且 高浓铀移交机制生效（核指数 ≤ 45）',
    redPol: '红方政治目标：美国国内支持 ≤ 30% 或（油价 ≥ 135 且 阿拉伯立场 ≤ -25）',
    redMil: '红方军事目标：核指数 ≥ 95（突破）或 以色列社会承受力 ≤ 25%',
    draw: '停战和局：谈判 ≥ 80 且 双方红线同时满足（蓝方停止深度打击 + 红方接受移交机制）',
    doom: '灾难结局：有一方跨过全面战争门槛（升级阶梯 9 时的显式决策），双方皆负'
  };

  return {
    meta: {
      name: '抵抗之弧 2026 · 兵棋推演',
      dateISO: '2026-08-20', warDay: 175, turnDays: 7, maxTurns: 16,
      note: '数据基准日 2026-08-20；态势取自公开报道，数值为推演抽象'
    },
    SOURCES, SRC, BRIEFING, MAP_ROWS, TERRAIN, NATION, SITES, UNITS, METERS, EVENTS, POLITICS, VICTORY_TEXT
  };
});
