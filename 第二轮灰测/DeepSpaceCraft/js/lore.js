/* DEEP SPACE CRAFT · lore.js —— 程序化命名与文案库（委派 D · 契约 §7）
 * 零依赖：不引用其他模块；DSC.Util 存在时借用其 pick/randInt，不存在则自带等价兜底。
 * 加载时零副作用：只做定义与数据表装配。所有带 rng 的函数同 rng 序列同结果。 */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});

  /* ===================================================== 内部工具 */
  var _hasUtil = !!(DSC.Util && typeof DSC.Util.pick === 'function');
  /* 未传 rng 时退化为 Math.random */
  function _rng(rng) { return typeof rng === 'function' ? rng : Math.random; }
  function _pick(rng, arr) {
    if (_hasUtil) return DSC.Util.pick(rng, arr);
    return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
  }
  function _int(rng, a, b) {
    if (_hasUtil) return DSC.Util.randInt(rng, a, b);
    return a + Math.floor(rng() * (b - a + 1));
  }
  function _cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* 内部去重环：同一 rng 实例下，同名生成器不连续产出重复名。
   * 状态按 rng 函数对象隔离（WeakMap），保证"同 rng 序列同结果"。 */
  var _useWeakMap = typeof WeakMap === 'function';
  var _lastByRng = _useWeakMap ? new WeakMap() : null;
  function _unique(rng, cat, gen) {
    if (!_lastByRng) return gen();
    var m = _lastByRng.get(rng) || {};
    var last = m[cat];
    var name = gen();
    var guard = 0;
    while (last !== undefined && name === last && guard < 60) { name = gen(); guard++; }
    m[cat] = name;
    _lastByRng.set(rng, m);
    return name;
  }

  /* ===================================================== 音节与词根 */
  var _STARTS = ['b', 'br', 'ch', 'd', 'dr', 'ek', 'el', 'er', 'f', 'fr', 'g', 'gl', 'gr', 'h', 'i', 'j', 'k', 'kh', 'l', 'm', 'n', 'o', 'p', 'ph', 'pr', 'qu', 'r', 'rh', 's', 'sh', 'sk', 'st', 't', 'th', 'tr', 'u', 'v', 'w', 'x', 'y', 'z', 'zh'];
  var _VOWELS = ['a', 'ae', 'ai', 'ao', 'e', 'ei', 'eo', 'i', 'ia', 'ie', 'io', 'o', 'oa', 'oe', 'oi', 'u', 'ua', 'ue', 'ui', 'uo', 'y'];
  var _TAILS = ['k', 'kh', 'l', 'm', 'n', 'r', 's', 'sh', 't', 'th', 'x', 'z', ''];
  var _GENUS_END = ['ia', 'us', 'is', 'a', 'um', 'es', 'ax', 'or', 'yx', 'on', 'ara', 'ida', 'ops'];
  var _FLORA_END = ['phyta', 'ella', 'opsis', 'anthera', 'ium', 'aria', 'osa', 'ica', 'um', 'is'];
  var _MIN_SUFFIX = ['ite', 'ium', 'yl', 'ine', 'ide', 'ite', 'ium', 'yl', 'ane', 'ese'];
  var _ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
  var _GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'];
  var _QUAL = ['Prime', 'Major', 'Minor', 'Secundus', 'Tertius', 'Ultima'];

  /* 辅音簇 + 元音 + 可省略尾缀，构成一个可念音节 */
  function _syllable(rng) {
    var s = _pick(rng, _STARTS) + _pick(rng, _VOWELS);
    if (rng() < 0.7) s += _pick(rng, _TAILS);
    return s;
  }
  /* 拼接 minSyl..maxSyl 个音节并首字母大写 */
  function _word(rng, minSyl, maxSyl) {
    var n = _int(rng, minSyl, maxSyl), s = '';
    for (var i = 0; i < n; i++) s += _syllable(rng);
    return _cap(s);
  }

  /* ===================================================== 命名生成器 */
  /* 行星名：词 + 罗马数字 / 希腊字母 / 序数词 / 编号 */
  function _planetName(rng) {
    var w = _word(rng, 2, 3);
    var r = rng();
    if (r < 0.4) return w + ' ' + _pick(rng, _ROMAN);
    if (r < 0.62) return w + ' ' + _pick(rng, _GREEK);
    if (r < 0.85) return w + ' ' + _pick(rng, _QUAL);
    return w + '-' + _int(rng, 2, 24);
  }
  /* 星系名：双词连字符 + 可选编号后缀 */
  function _systemName(rng) {
    var name = _word(rng, 2, 3) + '-' + _word(rng, 2, 3);
    if (rng() < 0.35) name += ' ' + _pick(rng, _ROMAN);
    return name;
  }
  /* 拉丁化双名法：属名（词根+属格尾）+ 种加词 */
  var _EPITHETS = ['Aeternum', 'Lucidus', 'Somnium', 'Obscurum', 'Virens', 'Caeruleus', 'Ferrum', 'Noctis', 'Aurora', 'Tenebris', 'Crystallis', 'Saxum', 'Umbra', 'Solaris', 'Lunae', 'Astrae', 'Igneus', 'Glacialis', 'Toxicus', 'Radiantia', 'Vacuus', 'Profundus', 'Silvaticus', 'Marinus', 'Voltanis', 'Stellaris', 'Chloris', 'Nivalis', 'Cineris'];
  var _FLORA_EPI = ['Lucidus', 'Foliatus', 'Nocturnis', 'Crystallis', 'Fungalis', 'Saxicola', 'Aquatica', 'Ignifer', 'Aureus', 'Veneficus', 'Glacialis', 'Radiata', 'Umbrae', 'Virens', 'Purpureus', 'Stellaris', 'Somnifer', 'Vitreus', 'Chloris', 'Nivalis'];

  /* ===================================================== 群系 */
  var _BIOMES = ['lush', 'toxic', 'frozen', 'desert', 'radioactive', 'exotic', 'barren', 'volcanic', 'ocean'];
  var _BIOME_INFO = {
    lush: { zh: '繁茂', en: 'LUSH', desc: '植被繁茂的宜居星球，空气湿润而温暖。', hazardName: '偶发雷暴', skyHint: '天穹是翡翠与琥珀的渐层，云层低垂，光线被叶片染绿。' },
    toxic: { zh: '剧毒', en: 'TOXIC', desc: '大气充满腐蚀性化合物，植被以真菌为主。', hazardName: '毒气大气', skyHint: '昏黄的毒雾贴着地面流动，天光惨淡如病。' },
    frozen: { zh: '冰封', en: 'FROZEN', desc: '被永冻层覆盖的寒冷世界。', hazardName: '极寒风暴', skyHint: '极光在铅灰的冰穹上缓缓漂移，日光苍白如霜。' },
    desert: { zh: '荒漠', en: 'DESERT', desc: '干旱少雨的沙质星球。', hazardName: '沙暴与酷热', skyHint: '烈日把地平线烤成白热，天空是一片烧灼的蓝。' },
    radioactive: { zh: '辐射', en: 'RADIOACTIVE', desc: '地表笼罩在高能辐射之中。', hazardName: '致命辐射', skyHint: '暗绿色的辐射雾在岩缝间渗涌，天空泛着病态的光。' },
    exotic: { zh: '奇境', en: 'EXOTIC', desc: '物理法则与常识相悖的奇异世界。', hazardName: '时空畸变', skyHint: '天空像被打翻的颜料，重力与光影都在撒谎。' },
    barren: { zh: '荒芜', en: 'BARREN', desc: '几乎没有生命的贫瘠岩地。', hazardName: '稀薄大气', skyHint: '灰褐的岩石伸向无云的天空，恒星像一枚冰冷的钉子。' },
    volcanic: { zh: '火山', en: 'VOLCANIC', desc: '熔岩与火山灰主导的炽热世界。', hazardName: '熔岩喷发', skyHint: '烟柱遮蔽了半个天空，地平线在暗红与漆黑之间燃烧。' },
    ocean: { zh: '海洋', en: 'OCEAN', desc: '被海洋覆盖的水世界。', hazardName: '风暴潮', skyHint: '水天一色，云层倒映在无边的海面上，像另一片天空。' }
  };
  var _BIOME_UNKNOWN = { zh: '未知', en: 'UNKNOWN', desc: '未记录的天体环境。', hazardName: '未知', skyHint: '天空尚未被描述。' };

  /* ===================================================== 天候池（按群系合理分配） */
  var _WEATHER = {
    lush: [
      { zh: '天晴', en: 'CLEAR', hazard: 0 },
      { zh: '薄云', en: 'THIN CLOUDS', hazard: 0 },
      { zh: '零星阵雨', en: 'SCATTERED SHOWERS', hazard: 0 },
      { zh: '湿润薄雾', en: 'HUMID HAZE', hazard: 0 },
      { zh: '暴雨', en: 'HEAVY RAIN', hazard: 1 },
      { zh: '雷暴', en: 'THUNDERSTORMS', hazard: 2 }
    ],
    toxic: [
      { zh: '暗沉阴天', en: 'DULL OVERCAST', hazard: 1 },
      { zh: '酸雾', en: 'ACID MIST', hazard: 2 },
      { zh: '腐蚀性阵雨', en: 'CORROSIVE SHOWERS', hazard: 2 },
      { zh: '毒气涌升', en: 'TOXIC SURGE', hazard: 3 },
      { zh: '酸雨', en: 'ACID RAIN', hazard: 2 }
    ],
    frozen: [
      { zh: '极寒晴朗', en: 'CRYSTAL CLEAR', hazard: 0 },
      { zh: '极光之夜', en: 'AURORA NIGHT', hazard: 0 },
      { zh: '冰晶飘落', en: 'ICE CRYSTALS', hazard: 0 },
      { zh: '低温雾', en: 'FREEZING FOG', hazard: 1 },
      { zh: '冻雨', en: 'FREEZING RAIN', hazard: 2 },
      { zh: '暴风雪', en: 'BLIZZARD', hazard: 3 }
    ],
    desert: [
      { zh: '干热风', en: 'DRY HOT WIND', hazard: 0 },
      { zh: '夜晚寒潮', en: 'NIGHT CHILL', hazard: 1 },
      { zh: '烈日当空', en: 'BLAZING SUN', hazard: 1 },
      { zh: '尘霾', en: 'DUST HAZE', hazard: 1 },
      { zh: '热浪', en: 'HEAT WAVE', hazard: 2 },
      { zh: '沙暴', en: 'SANDSTORM', hazard: 3 }
    ],
    radioactive: [
      { zh: '灰烬飘落', en: 'ASH FALL', hazard: 1 },
      { zh: '裂变微光', en: 'FISSION GLOW', hazard: 2 },
      { zh: '电离风暴', en: 'ION STORM', hazard: 3 },
      { zh: '辐射尘云', en: 'RADIATION DUST', hazard: 3 },
      { zh: '平静辐射', en: 'QUIET RADIATION', hazard: 2 }
    ],
    exotic: [
      { zh: '量子迷雾', en: 'QUANTUM MIST', hazard: 1 },
      { zh: '光谱畸变', en: 'SPECTRAL WARP', hazard: 2 },
      { zh: '回响静默', en: 'ECHO SILENCE', hazard: 1 },
      { zh: '时空涟漪', en: 'TIME RIPPLE', hazard: 2 },
      { zh: '重力异常', en: 'GRAVITY ANOMALY', hazard: 3 },
      { zh: '极性反转', en: 'POLAR FLIP', hazard: 3 }
    ],
    barren: [
      { zh: '稀薄大气', en: 'THIN AIR', hazard: 1 },
      { zh: '静电风暴', en: 'STATIC STORM', hazard: 1 },
      { zh: '陨尘暴', en: 'METEOR DUST', hazard: 2 },
      { zh: '真空平静', en: 'DEAD CALM', hazard: 1 },
      { zh: '无风荒芜', en: 'STILL VOID', hazard: 2 }
    ],
    volcanic: [
      { zh: '地震微动', en: 'TREMOR', hazard: 1 },
      { zh: '硫磺烟', en: 'SULFUR SMOKE', hazard: 2 },
      { zh: '炽热阵风', en: 'SCORCHING GUST', hazard: 2 },
      { zh: '火山灰', en: 'VOLCANIC ASH', hazard: 3 },
      { zh: '熔岩喷泉', en: 'LAVA FOUNTAIN', hazard: 3 }
    ],
    ocean: [
      { zh: '平静海面', en: 'GLASSY SEA', hazard: 0 },
      { zh: '雾海', en: 'SEA FOG', hazard: 0 },
      { zh: '洋流涌动', en: 'OCEAN CURRENT', hazard: 1 },
      { zh: '水下暗流', en: 'UNDERCURRENT', hazard: 1 },
      { zh: '风暴潮', en: 'STORM SURGE', hazard: 2 },
      { zh: '巨浪', en: 'MONSTER WAVES', hazard: 2 }
    ]
  };

  /* ===================================================== 哨兵 / 生物量 */
  var _SENTINELS = [
    { zh: '无', en: 'NONE', level: 0 },
    { zh: '低度', en: 'LOW', level: 1 },
    { zh: '中度', en: 'MODERATE', level: 2 },
    { zh: '高度', en: 'HIGH', level: 3 },
    { zh: '侵略性', en: 'AGGRESSIVE', level: 4 }
  ];
  var _LINES = [
    { zh: '无', en: 'NONE' },
    { zh: '寡少', en: 'SPARSE' },
    { zh: '中等', en: 'MODERATE' },
    { zh: '繁盛', en: 'ABUNDANT' },
    { zh: '丰饶', en: 'RICH' }
  ];

  /* ===================================================== 发现文案（每类 ≥12 句） */
  var _BLURBS = {
    planet: [
      '大气里飘着可呼吸的锈。',
      '潮汐锁定的世界里，永远只有一面的黎明。',
      '大陆架像一块被啃食过的饼干边缘。',
      '这颗星球的自转正在缓慢地停摆。',
      '海洋退去后，留下盐的沙漠与鲸的化石。',
      '夜半球的城市灯光，比恒星更亮。',
      '风暴在赤道线上排成整齐的队列。',
      '这里的重力比母星略轻，脚步因此变慢。',
      '卫星们沿着同一条轨道排队行进。',
      '火山灰覆盖了曾经肥沃的河谷。',
      '冰层之下，检测到规律的脉动。',
      '大气层薄得可以看见陨石烧尽的全过程。',
      '白昼持续四十小时，影子被拉得很长。',
      '环带由碎裂的旧卫星构成，仍在缓慢聚拢。'
    ],
    system: [
      '恒星正处在生命的黄昏，光芒温暖而疲惫。',
      '这个星系只有一颗行星，其余轨道空空如也。',
      '双星相互缠绕，像一对不肯分开的舞者。',
      '星云残骸里漂浮着古老的尘埃带。',
      '行星们排成一条近乎完美的直线。',
      '气态巨行星的轨道上，环带投下长长的影子。',
      '这里的恒星风吹得比想象中更急。',
      '星系边缘散落着被撕碎的小行星带。',
      '一颗流浪行星正以双曲线轨迹穿过此星系。',
      '恒星的光谱里藏着尚未命名的元素。',
      '轨道共振让三颗行星永远保持队形。',
      '这片星域安静得像是被谁按下了静音。',
      '白矮星的残骸仍在向外辐射余温。',
      '一颗气体巨星正缓缓吞食自己的卫星。'
    ],
    flora: [
      '植物向着夜半球生长，那里有微弱的光。',
      '藤蔓在无风的空气中自行盘绕。',
      '叶片的脉络里流动着淡蓝色的液体。',
      '这株植物的根系深过它露出地面的部分十倍。',
      '孢子随风飘散，在岩石裂缝里安家。',
      '花朵只在日蚀的瞬间开放。',
      '它的枝干会发出轻微的嗡鸣。',
      '光合作用在此地是奢侈，它靠硫化物为生。',
      '种子外皮硬得能承受再入大气层的温度。',
      '树冠层传来细微的沙沙声，尽管没有风。',
      '这种苔藓沿着磁力线生长。',
      '植物的年轮记录着恒星的耀斑周期。',
      '花瓣在黄昏时合拢，像在躲避什么。',
      '菌丝网络覆盖了整片平原的地下。'
    ],
    fauna: [
      '生物在沙地上留下六趾的足迹。',
      '一群迁徙者正沿着河床的方向行进。',
      '它的皮肤会随温度改变颜色。',
      '观察者侧身躲过，没有惊动它。',
      '这种生物只在夜间活动，眼睛大而明亮。',
      '它的叫声在峡谷里回荡了很远。',
      '生物样本显示其骨骼含有晶体成分。',
      '它在水中滑行，几乎没有扰动水波。',
      '幼崽紧紧跟在成年个体身后。',
      '这种生物会用尾部的发光器发出信号。',
      '它的前肢已经退化成用于攀爬的钩爪。',
      '体温显示它正处于短暂的休眠状态。',
      '群居个体之间保持着整齐的间距。',
      '它在进食时异常警觉，随时准备逃离。'
    ],
    mineral: [
      '矿石断面呈现不规则的同心环纹。',
      '晶体在暗处仍散发着冷光。',
      '这块矿物含有罕见的同位素组合。',
      '矿石边缘的氧化层像年轮一样分层。',
      '它能在常温下保持超导特性。',
      '矿物内部封存着远古大气的气泡。',
      '岩脉走向与当地的断层线完全一致。',
      '这种矿石在紫外线下呈现陌生的颜色。',
      '结晶体的对称性违反了常见晶系规律。',
      '矿石表面覆盖着一层细密的金属光泽。',
      '它的密度与体积完全不成正比。',
      '岩层中夹杂着被压扁的植物化石。',
      '矿脉深处的温度比地表高出许多。',
      '这块矿石的磁性会让罗盘轻微偏转。'
    ],
    monolith: [
      '石面上的纹路正在缓慢地改变。',
      '它比周围的岩石古老得多。',
      '靠近时，头盔里的无线电杂音变强了。',
      '方碑的边角没有任何风化痕迹。',
      '碑文以某种无人知晓的语言写成。',
      '它的基座与下方的岩层并非同一时代。',
      '石面温度恒定，与周围环境无关。',
      '投影出的星图与当前星域完全吻合。',
      '碑身上有一道干净的裂纹，像被刻意留下。',
      '它似乎在等待某个特定的访客。',
      '石质表面拒绝留下任何取样痕迹。',
      '扫描显示碑体内部存在空腔结构。',
      '方碑周围寸草不生，连微生物也没有。',
      '触摸它的瞬间，扫描仪闪过一行无法解析的代码。'
    ],
    crash: [
      '残骸以一道优美的弧线犁过地表。',
      '黑匣子的信号仍在微弱地闪烁。',
      '坠机点周围的土壤被烧成了玻璃。',
      '货舱里的物资大多完好，只有框架扭曲。',
      '驾驶舱的座椅上，安全带保持扣紧状态。',
      '残骸的金属在高温下变了色，像晚霞。',
      '燃料泄漏的痕迹指向来时的方向。',
      '逃生舱的弹射轨道清晰可见。',
      '船体编号已经无法辨认，被烧蚀殆尽。',
      '货物清单与实际货物数目不符。',
      '坠机现场没有发现任何乘员的痕迹。',
      '残骸内部的结构仍在轻微振动。',
      '一台终端机仍亮着，屏幕上是无人看管的日志。',
      '冲击坑的边缘呈现出均匀的辐射状裂纹。'
    ]
  };

  /* ===================================================== 开机自检日志 */
  var _STATUS = { OK: '[  OK  ]', WARN: '[ WARN ]', DONE: '[ DONE ]' };
  var _BOOT_HW = [
    { s: 'OK', n: 'EXOSUIT LIFE SUPPORT', z: '生命维持在线' },
    { s: 'OK', n: 'OXYGEN REGULATOR', z: '氧气调节器校准完毕' },
    { s: 'OK', n: 'SHIELD EMITTER', z: '护盾发生器功率稳定' },
    { s: 'OK', n: 'MULTI-TOOL', z: '多功能工具联机正常' },
    { s: 'OK', n: 'JETPACK THRUSTER', z: '喷射背包推进器待命' },
    { s: 'OK', n: 'HULL INTEGRITY', z: '船体结构完整度 100%' },
    { s: 'OK', n: 'POWER CELL', z: '动力电池电量充足' },
    { s: 'OK', n: 'NAV COMPUTER', z: '导航计算机初始化' },
    { s: 'OK', n: 'THERMAL REGULATOR', z: '温度调节模块正常' },
    { s: 'OK', n: 'GRAVITY STABILIZER', z: '重力稳定器已同步' },
    { s: 'OK', n: 'MEDICAL INTERFACE', z: '医疗接口无异常' }
  ];
  var _BOOT_SYS = [
    { s: 'OK', n: 'WARP DRIVE', z: '曲速引擎预热完成' },
    { s: 'OK', n: 'PULSE ENGINE', z: '脉冲引擎就绪' },
    { s: 'OK', n: 'LIFE SUPPORT AI', z: '生命维持 AI 上线' },
    { s: 'OK', n: 'SCANNER ARRAY', z: '扫描阵列校准完成' },
    { s: 'OK', n: 'DEFENSE GRID', z: '防御网格自检通过' },
    { s: 'OK', n: 'COMM RELAY', z: '通讯中继建立连接' },
    { s: 'OK', n: 'HOLO PROJECTOR', z: '全息投影模块正常' },
    { s: 'OK', n: 'INVENTORY SYSTEM', z: '背包索引重建完成' },
    { s: 'WARN', n: 'SENTINEL TRACE', z: '检测到未知信号源，已静默' }
  ];
  var _BOOT_STAR = [
    { s: 'OK', n: 'STAR CHART', z: '正在解析星图……' },
    { s: 'OK', n: 'VOXEL STREAM', z: '正在加载体素流……' },
    { s: 'OK', n: 'GALAXY COORDS', z: '正在同步星系坐标……' },
    { s: 'OK', n: 'ANCIENT BEACON', z: '正在解密古老信标……' },
    { s: 'DONE', n: 'SEQUENCE COMPLETE', z: '全部系统就绪，等待指令' }
  ];
  /* 点号填充到固定列宽，营造对齐感 */
  function _bootLine(status, name, zh) {
    var dots = '';
    var w = 30 - name.length;
    if (w < 1) w = 1;
    for (var i = 0; i < w; i++) dots += '.';
    return (_STATUS[status] || _STATUS.OK) + ' ' + name + dots + ' ' + zh;
  }
  /* 按段补齐到下限，保持段内顺序 */
  function _topUp(arr, picked, min) {
    var out = picked.slice();
    var seen = {};
    for (var i = 0; i < out.length; i++) seen[out[i].n] = true;
    for (var j = 0; j < arr.length && out.length < min; j++) {
      if (!seen[arr[j].n]) { seen[arr[j].n] = true; out.push(arr[j]); }
    }
    return out;
  }

  /* ===================================================== 箴言 / 方碑 / 飞船 AI */
  var _TIPS = [
    /* 玩法提示（12 条） */
    '按 C 发出扫描脉冲，发现周围的矿脉与生物。',
    '按住左键采矿，右键放置方块。',
    '氧气耗尽前请回到飞船或避难所。',
    '按 E 打开背包，把矿物精炼成合成材料。',
    '按 J 打开星系图，消耗曲速电池进行跃迁。',
    '按 F 上下飞船，飞船是移动的补给站。',
    '中键取样可记录生物与植物图鉴。',
    '按 Shift 疾跑，按 Ctrl 潜行。',
    '危险度满值时，护盾会优先消耗。',
    '挖到的钻石可以合成为更强的工具。',
    '按 F3 查看调试信息与坐标。',
    '夜间外出请携带光源方块。',
    '在精炼炉里，碳与铁氧尘可以合成钢材。',
    /* 氛围箴言（13 条） */
    '每颗星球都有自己的语法。',
    '星空是唯一不需要翻译的语言。',
    '孤独不是缺点，是引擎的燃料。',
    '在宇宙面前，所有匆忙都是徒劳。',
    '遗迹记得一切，除了自己的来历。',
    '文明终会熄灭，矿石不会。',
    '远方之所以是远方，正因为还没抵达。',
    '沉默是最古老的通信协议。',
    '恒星燃烧亿年，只为照亮一刻。',
    '每个坐标都曾是一个文明的地址。',
    '风把沙丘翻过面来，像在翻书。',
    '我们在寻找的，或许也在寻找我们。',
    '宇宙没有尽头，只有下一站。'
  ];
  var _MONOLITH = [
    '我们曾经也是星辰的孩子。',
    '时间在这里打了个结。',
    '记忆被刻进石头，因为记忆比石头更脆弱。',
    '第一个抵达者，不必是最后一个离开者。',
    '星图并非指引，而是遗嘱。',
    '他们数清了星星，却数不清自己。',
    '航道会记住每一位旅人。',
    '黑暗不是终点，是尚未点亮的灯。',
    '我们留下坐标，等待与你们相遇。',
    '文明的尽头，是一块安静的石头。',
    '别问我们去了哪里，问你们为何而来。',
    '每道纹路都是一次失败的重启。',
    '门已经打开，钥匙在你们手中。',
    '我们写下的，是你们将要读到的。',
    '光走了很久，才成为你们看到的星光。',
    '石头记得的，比我们记得的多。'
  ];
  var _SHIPLOG = [
    '检测到轨道碎片。建议降低推力。',
    '燃料储备低于百分之二十。',
    '附近存在未标注的信号源。',
    '护盾发生器进入待机模式。',
    '大气参数异常，建议减速进入。',
    '曲速核心温度正常。',
    '检测到轻微的结构应力。',
    '扫描到前方有小行星群。',
    '通讯信号衰减，正在切换中继。',
    '重力井边界已标记。',
    '自动驾驶已接管姿态控制。',
    '电池电量充足，续航约六小时。',
    '检测到飞船尾部的轻微泄漏。',
    '已更新星图数据。',
    '脉冲引擎燃料正在回收。',
    '建议补充氧气储备。',
    '前舱门已锁定，气压稳定。',
    '传感器发现异常质量物体。',
    '已自动调整航线规避。',
    '所有系统报告正常。',
    '极光干扰通讯，正在重新同步。',
    '货舱装载完成，重心已修正。'
  ];

  /* ===================================================== 资源 / 方块 / 字形 */
  var _RESOURCES = {
    carbon: { zh: '碳', en: 'CARBON', color: '#3a3a40', desc: '有机物与燃料的基础，烧成灰之前它是一切。' },
    ferrite: { zh: '铁氧尘', en: 'FERRITE DUST', color: '#8a7f70', desc: '从矿石中筛出的铁氧粉末，结构件的基本原料。' },
    sodium: { zh: '钠', en: 'SODIUM', color: '#ffd75e', desc: '在冷光中缓慢氧化，自带一点微弱的黄。' },
    oxygen: { zh: '氧气', en: 'OXYGEN', color: '#7ce7ff', desc: '生命维持的通货，比任何货币都硬。' },
    deuterium: { zh: '氘', en: 'DEUTERIUM', color: '#5ad9e8', desc: '重氢，曲速电池的燃料核心。' },
    gold: { zh: '黄金', en: 'GOLD', color: '#ffd24a', desc: '在宇宙的集市里，它依旧值钱。' },
    diamond: { zh: '活化钻石', en: 'ACTIVATED DIAMOND', color: '#4fe3ff', desc: '在压力与时间中结晶的碳，锋利且昂贵。' },
    indium: { zh: '铟', en: 'INDIUM', color: '#c86bff', desc: '紫色金属，高能回路的最爱。' },
    emeril: { zh: '艾米瑞尔', en: 'EMERIL', color: '#2dffb0', desc: '只在特定星系的岩层深处发光。' },
    chryson: { zh: '克赖森', en: 'CHRYSON', color: '#ffe98a', desc: '金色晶体，散热与装饰兼得。' },
    copper: { zh: '铜', en: 'COPPER', color: '#ff9b54', desc: '延展性极好，电路与镀层的首选。' },
    ice: { zh: '冰', en: 'ICE', color: '#8fb8ff', desc: '冻结的水，在缺水的世界里就是生命。' },
    salt: { zh: '盐', en: 'SALT', color: '#e8e4d8', desc: '海洋留给大地的吻痕。' }
  };
  /* SPEC §4 方块表：全部 51 个 key，一个不能少 */
  var _BLOCKS = {
    air: { zh: '空气', en: 'AIR' },
    stone: { zh: '石头', en: 'STONE' },
    grass: { zh: '草方块', en: 'GRASS BLOCK' },
    dirt: { zh: '泥土', en: 'DIRT' },
    cobblestone: { zh: '圆石', en: 'COBBLESTONE' },
    sand: { zh: '沙子', en: 'SAND' },
    sandstone: { zh: '砂岩', en: 'SANDSTONE' },
    gravel: { zh: '沙砾', en: 'GRAVEL' },
    log: { zh: '原木', en: 'LOG' },
    leaves: { zh: '树叶', en: 'LEAVES' },
    planks: { zh: '木板', en: 'PLANKS' },
    water: { zh: '水', en: 'WATER' },
    snow_block: { zh: '雪块', en: 'SNOW BLOCK' },
    ice: { zh: '冰', en: 'ICE' },
    bedrock: { zh: '基岩', en: 'BEDROCK' },
    coal_ore: { zh: '煤矿石', en: 'COAL ORE' },
    ferrite_ore: { zh: '铁氧矿石', en: 'FERRITE ORE' },
    gold_ore: { zh: '金矿石', en: 'GOLD ORE' },
    diamond_ore: { zh: '钻石矿石', en: 'DIAMOND ORE' },
    copper_ore: { zh: '铜矿石', en: 'COPPER ORE' },
    emeril_ore: { zh: '艾米瑞尔矿石', en: 'EMERIL ORE' },
    chryson: { zh: '克赖森晶体', en: 'CHRYSON' },
    indium: { zh: '铟晶体', en: 'INDIUM' },
    alien_grass: { zh: '异星草', en: 'ALIEN GRASS' },
    alien_dirt: { zh: '异星泥土', en: 'ALIEN DIRT' },
    basalt: { zh: '玄武岩', en: 'BASALT' },
    alien_log: { zh: '异星原木', en: 'ALIEN LOG' },
    alien_leaves: { zh: '异星树叶', en: 'ALIEN LEAVES' },
    fungal_cap: { zh: '真菌伞盖', en: 'FUNGAL CAP' },
    lumina: { zh: '光棱块', en: 'LUMINA' },
    crystal_block: { zh: '水晶块', en: 'CRYSTAL BLOCK' },
    glass: { zh: '玻璃', en: 'GLASS' },
    metal_plate: { zh: '金属板', en: 'METAL PLATE' },
    metal_panel: { zh: '金属面板', en: 'METAL PANEL' },
    tech_grate: { zh: '科技格栅', en: 'TECH GRATE' },
    glow_panel: { zh: '发光面板', en: 'GLOW PANEL' },
    hull_white: { zh: '白色船壳', en: 'HULL WHITE' },
    monolith: { zh: '方碑', en: 'MONOLITH' },
    obsidian: { zh: '黑曜石', en: 'OBSIDIAN' },
    magma: { zh: '岩浆', en: 'MAGMA' },
    carbon_block: { zh: '碳块', en: 'CARBON BLOCK' },
    sodium_block: { zh: '钠块', en: 'SODIUM BLOCK' },
    launch_pad: { zh: '发射台', en: 'LAUNCH PAD' },
    frost_stone: { zh: '霜石', en: 'FROST STONE' },
    red_sand: { zh: '红沙', en: 'RED SAND' },
    toxic_sludge: { zh: '毒泥', en: 'TOXIC SLUDGE' },
    star_bulb: { zh: '星灯花', en: 'STAR BULB' },
    salt_block: { zh: '盐块', en: 'SALT BLOCK' },
    ash_block: { zh: '灰烬块', en: 'ASH BLOCK' },
    coral_block: { zh: '珊瑚块', en: 'CORAL BLOCK' },
    alien_sand: { zh: '异星沙', en: 'ALIEN SAND' }
  };
  var _GLYPHS = ['◬', '⍟', '⌖', '⬢', '◈', '◭', '⊛', '⍜', '◶', '⬡', '⍉', '⌘', '◧', '⟁', '◇', '⍾', '⊕', '◲', '◉', '⍰', '⍣', '◫', '◔', '⍹'];

  /* ===================================================== 星系经济 / 恒星光谱 */
  var _ECON = [
    { zh: '采掘经济', en: 'MINING', color: '#ffa03c' },
    { zh: '贸易经济', en: 'TRADING', color: '#46e0ff' },
    { zh: '制造经济', en: 'MANUFACTURING', color: '#ffd24a' },
    { zh: '科技经济', en: 'TECHNOLOGY', color: '#7ce7ff' },
    { zh: '能源经济', en: 'POWER', color: '#ff6a00' },
    { zh: '研究经济', en: 'RESEARCH', color: '#b18cff' },
    { zh: '农业经济', en: 'AGRICULTURE', color: '#7cffb2' }
  ];
  /* 摩根-基南光谱型，颜色为真实恒星色近似 */
  var _STARCLASS = [
    { zh: '蓝超巨星', en: 'CLASS O', color: '#9bb0ff', w: 1 },
    { zh: '蓝白星', en: 'CLASS B', color: '#aabfff', w: 2 },
    { zh: '白星', en: 'CLASS A', color: '#cad7ff', w: 4 },
    { zh: '黄白星', en: 'CLASS F', color: '#f8f7ff', w: 6 },
    { zh: '黄星', en: 'CLASS G', color: '#fff4e8', w: 10 },
    { zh: '橙星', en: 'CLASS K', color: '#ffd2a1', w: 8 },
    { zh: '红星', en: 'CLASS M', color: '#ffcc6f', w: 7 }
  ];

  /* ===================================================== 对外 API（契约 §7） */
  var L = {
    BIOMES: _BIOMES,

    systemName: function (rng) {
      rng = _rng(rng);
      return _unique(rng, 'system', function () { return _systemName(rng); });
    },
    planetName: function (rng) {
      rng = _rng(rng);
      return _unique(rng, 'planet', function () { return _planetName(rng); });
    },
    speciesName: function (rng) {
      rng = _rng(rng);
      return _unique(rng, 'species', function () {
        return _word(rng, 2, 3) + _pick(rng, _GENUS_END) + ' ' + _pick(rng, _EPITHETS);
      });
    },
    floraName: function (rng) {
      rng = _rng(rng);
      return _unique(rng, 'flora', function () {
        return _word(rng, 2, 3) + _pick(rng, _FLORA_END) + ' ' + _pick(rng, _FLORA_EPI);
      });
    },
    mineralName: function (rng) {
      rng = _rng(rng);
      return _unique(rng, 'mineral', function () {
        return _word(rng, 1, 2) + _pick(rng, _MIN_SUFFIX);
      });
    },

    biomeLabel: function (biome) {
      var b = _BIOME_INFO[biome] || _BIOME_UNKNOWN;
      return { zh: b.zh, en: b.en, desc: b.desc, hazardName: b.hazardName, skyHint: b.skyHint };
    },

    weather: function (rng, biome) {
      rng = _rng(rng);
      var pool = _WEATHER[biome] || _WEATHER.lush;
      var e = _pick(rng, pool);
      return { zh: e.zh, en: e.en, hazard: e.hazard };
    },

    sentinels: function (rng) {
      rng = _rng(rng);
      var r = rng();
      var idx = r < 0.12 ? 0 : r < 0.42 ? 1 : r < 0.68 ? 2 : r < 0.88 ? 3 : 4;
      var s = _SENTINELS[idx];
      return { zh: s.zh, en: s.en, level: s.level };
    },

    floraLine: function (rng) {
      rng = _rng(rng);
      var r = rng();
      var idx = r < 0.08 ? 0 : r < 0.28 ? 1 : r < 0.64 ? 2 : r < 0.9 ? 3 : 4;
      var s = _LINES[idx];
      return { zh: s.zh, en: s.en };
    },
    faunaLine: function (rng) {
      rng = _rng(rng);
      var r = rng();
      var idx = r < 0.1 ? 0 : r < 0.32 ? 1 : r < 0.66 ? 2 : r < 0.9 ? 3 : 4;
      var s = _LINES[idx];
      return { zh: s.zh, en: s.en };
    },

    discoveryBlurb: function (rng, kind) {
      rng = _rng(rng);
      var pool = _BLURBS[kind] || _BLURBS.planet;
      return _pick(rng, pool);
    },

    bootLog: function () {
      var hw = [], sy = [], st = [], i;
      /* 硬件段：首行必现，其余按 0.72 概率抽取 */
      for (i = 0; i < _BOOT_HW.length; i++) if (i === 0 || Math.random() < 0.72) hw.push(_BOOT_HW[i]);
      /* 系统段 */
      for (i = 0; i < _BOOT_SYS.length; i++) if (i === 0 || Math.random() < 0.72) sy.push(_BOOT_SYS[i]);
      /* 星图段：星图解析 / 加载体素流 必现，置于末尾 */
      st.push(_BOOT_STAR[0], _BOOT_STAR[1]);
      for (i = 2; i < _BOOT_STAR.length; i++) if (Math.random() < 0.8) st.push(_BOOT_STAR[i]);
      /* 按段补齐下限（8+7+4=19 ≥ 18），保持硬件→系统→星图顺序 */
      hw = _topUp(_BOOT_HW, hw, 8);
      sy = _topUp(_BOOT_SYS, sy, 7);
      st = _topUp(_BOOT_STAR, st, 4);
      var lines = hw.concat(sy, st), out = [];
      for (i = 0; i < lines.length; i++) out.push(_bootLine(lines[i].s, lines[i].n, lines[i].z));
      return out;
    },

    tip: function () {
      return _pick(Math.random, _TIPS);
    },

    monolithText: function (rng) {
      rng = _rng(rng);
      return _pick(rng, _MONOLITH);
    },

    shipLog: function (rng) {
      rng = _rng(rng);
      return _pick(rng, _SHIPLOG);
    },

    resourceName: function (id) {
      var r = _RESOURCES[id];
      if (!r) return { zh: '未知资源', en: 'UNKNOWN', color: '#ffffff', desc: '未收录的样本。' };
      return { zh: r.zh, en: r.en, color: r.color, desc: r.desc };
    },

    blockName: function (key) {
      var b = _BLOCKS[key];
      if (!b) return { zh: '未知方块', en: 'UNKNOWN' };
      return { zh: b.zh, en: b.en };
    },

    glyphs: function () {
      return _GLYPHS.slice();
    },

    systemEconomy: function (rng) {
      rng = _rng(rng);
      var e = _pick(rng, _ECON);
      return { zh: e.zh, en: e.en, color: e.color };
    },

    starClass: function (rng) {
      rng = _rng(rng);
      var total = 0, i;
      for (i = 0; i < _STARCLASS.length; i++) total += _STARCLASS[i].w;
      var r = rng() * total, acc = 0;
      for (i = 0; i < _STARCLASS.length; i++) {
        acc += _STARCLASS[i].w;
        if (r < acc) break;
      }
      var s = _STARCLASS[Math.min(i, _STARCLASS.length - 1)];
      return { zh: s.zh, en: s.en, color: s.color };
    }
  };

  DSC.Lore = L;
})();
