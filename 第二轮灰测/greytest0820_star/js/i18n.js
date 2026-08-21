/* ==========================================================================
 * i18n.js — bilingual support (English / 简体中文).
 *
 *   L.s(str)     translate a literal that appears in the source (labels, spec
 *                text, status words). Unknown strings fall through unchanged.
 *   L.m(en, zh)  pick a message at the point it is generated, which is how
 *                anything with numbers interpolated into it stays translatable.
 *   L.set(lang)  switch language at runtime and notify listeners.
 * ==========================================================================*/
(function (global) {
  'use strict';

  const ZH = {
    /* ---------------- HUD chrome ---------------- */
    'DRIVETRAIN': '动力与传动',
    'ARMAMENT': '武器系统',
    'RANGE CONTROL': '靶场记录',
    'Master': '总电源',
    'Fuel cock': '燃油阀',
    'Engine': '发动机',
    'RPM': '转速',
    'Gear': '档位',
    'Speed': '车速',
    'Fuel': '燃油',
    'Brake': '驻车制动',
    'Gun': '火炮',
    'Breech': '炮闩',
    'Loaded': '已装填',
    'Selected': '选定弹种',
    'Circuit': '击发电路',
    'Traverse': '方向机',
    'Sight': '瞄准镜',
    'Range': '表尺距离',
    'Rounds fired': '发射弹数',
    'Hits': '命中',
    'Kills': '击毁',
    'Last range': '最近距离',
    'MG belt': '机枪弹链',

    /* ---------------- status words ---------------- */
    'ON': '开', 'OFF': '关', 'OPEN': '开', 'SHUT': '关闭', 'CLOSED': '关闭',
    'RUNNING': '运转中', 'CRANKING': '起动中', 'STOPPED': '已停车',
    'SET': '已拉起', 'EMPTY': '空膛', 'SAFE': '保险', 'ARMED': '已解除保险',
    'POWER': '电动', 'MANUAL': '手动', 'DAY': '白光', 'NIGHT': '微光', 'THERMAL': '热像',
    'N': '空档', 'R': '倒档',
    'centred': '回中', 'PULLED': '已拉到底', 'up': '抬起', 'braking': '制动中',
    'released': '已松开', 'charged': '压力正常', 'discharged': '已喷放',
    'stowed': '已收起', 'RIGGED': '已架设', 'LEFT': '左', 'RIGHT': '右',
    'live': '有压力', 'no hydraulics': '无液压', 'dogged shut': '已锁死',
    'door closed': '舱门关闭', 'DOOR OPEN': '舱门打开', 'hatch closed': '舱盖关闭',
    'armed': '待发', 'FIRE DETECTED': '检测到火情', 'off': '关闭',
    'RUNNING (silent watch)': '运转（静默值守）',
    'ENGAGED': '已接通', 'SCANNING': '独立搜索中', 'slaved to gun': '随动于火炮',
    'ONLINE  lead/drift solved': '在线：已解算提前量与偏流',
    'OFFLINE — manual holdoff': '离线：需手动提前量',
    'press': '按下', 'press to crank': '按下起动',
    'press to lase': '按下测距', 'click to look through': '点击以观察',
    'all round view': '环视观察', 'map': '地图', 'no fire': '无火情',
    'ok': '正常',

    /* ---------------- views / stations ---------------- */
    'INTERIOR': '车内', 'GUNNER SIGHT': '炮长镜', 'PERISCOPE': '潜望镜',
    'HEAD OUT': '探出舱盖', 'EXTERNAL': '车外',
    'Driver': '驾驶员', 'Gunner': '炮长', 'Loader': '装填手', 'Commander': '车长',
    'Driver-Mechanic': '驾驶技师',
    'DRIVER': '驾驶员', 'GUNNER': '炮长', 'LOADER': '装填手', 'COMMANDER': '车长',
    'AUTOLOADER': '自动装弹机',

    /* ---------------- crew roles ---------------- */
    'Drives the tank, watches the gauges.': '驾驶坦克，盯住各仪表。',
    'Lays the gun, fires on command.': '瞄准火炮，听令击发。',
    'Feeds the gun, calls "up!".': '给炮供弹，装好后喊“好！”。',
    'Finds targets, works the radio, runs the crew.': '搜索目标、操作电台、指挥全车。',
    'Fights the levers and the clutch.': '与操纵杆和离合器搏斗。',
    'Cramped left side of the turret.': '炮塔左侧，空间极其局促。',
    'Right of the gun, working blind and fast.': '火炮右侧，闭着眼也要装得快。',
    "Cupola on the left rear, doubles as gunner's boss.": '左后指挥塔，同时盯着炮长。',
    'Steering wheel, pre-selector gearbox, 57 tonnes.': '方向盘、预选变速箱、57 吨钢铁。',
    'Binocular sight, foot pedal hydraulic traverse.': '双目瞄准镜，脚踏液压方向机。',
    '88 mm rounds weigh 22 kg. Lift with the legs.': '88 毫米炮弹重 22 公斤，用腿发力。',
    'Cupola left rear, five vision slits.': '左后指挥塔，五个观察缝。',
    'Reclined on the centreline, tillers in both hands.': '半躺在中轴线上，双手各握一根操纵杆。',
    'Sosna-U thermal, 2E42 stabiliser, autoloader trigger.': '松树-U 热像、2E42 稳定器、自动装弹机按钮。',
    'Also the loader-of-last-resort if the carousel jams.': '转盘卡壳时，他就是备用装填手。',
    'Lying back on the centreline behind a T-bar.': '仰卧在中轴线上，握着 T 形操纵把。',
    'GPS thermal sight, ballistic computer, cadillacs.': 'GPS 热像镜、弹道计算机、双握把。',
    'Knee switch, blast doors, 22 kg of sabot at a time.': '膝控开关、防爆门，一次抱起 22 公斤脱壳弹。',
    'CITV hunter-killer, radios, and the whole picture.': 'CITV 猎歼视镜、电台，掌握全局。',

    /* ---------------- control labels ---------------- */
    'Master Battery Switch': '主蓄电池开关',
    'Fuel Shut-off Cock': '燃油切断阀',
    'Starter Button': '起动按钮',
    'Engine Stop': '停车按钮',
    'Gear Selector': '档位选择器',
    'Gear Lever (5 speed)': '变速杆（5 档）',
    'Gear Lever (4 speed, no synchro)': '变速杆（4 档，无同步器）',
    'Gear Lever (7 speed)': '变速杆（7 档）',
    'Maybach Olvar Pre-selector': '迈巴赫 Olvar 预选变速器',
    'Range Selector (D / N / R / PIVOT)': '档位选择（D / N / R / 中心转向）',
    'Parking Brake': '驻车制动',
    'Left Steering Tiller': '左操纵杆',
    'Right Steering Tiller': '右操纵杆',
    'Steering Wheel': '方向盘',
    'Steering Yoke (T-bar)': 'T 形操纵把',
    'Accelerator Pedal': '油门踏板',
    'Brake Pedal': '制动踏板',
    'Tachometer': '转速表',
    'Drehzahlmesser': '转速表',
    'Speedometer': '车速表',
    'Turbine RPM': '燃气轮机转速',
    'Turbine Temp': '燃气轮机温度',
    'Coolant': '冷却液',
    'Coolant Temperature': '冷却液温度',
    'Kühlwasser': '冷却水温',
    'Oil Pressure': '机油压力',
    'Öldruck': '机油压力',
    'Fuel (JP-8)': '燃油（JP-8）',
    'Compartment Lamp': '舱内照明灯',
    'Dome Lamp': '顶灯',
    'Innenlampe': '车内照明灯',
    'Headlamps': '前大灯',
    'Driving Lamp': '行车灯',
    'Driving Lamps': '行车灯',
    'Notek Lamp': 'Notek 行军灯',
    'Blackout Drive Lamps': '防空行车灯',
    'Fire Extinguisher': '灭火器',
    'Crew Intercom': '车内通话器',
    'Bilge Pump': '舱底排水泵',
    'Driver Display Unit': '驾驶员显示器',
    'Auxiliary Power Unit': '辅助动力装置',
    'PPO Automatic Fire Suppression': 'PPO 自动灭火系统',
    'OPVT Snorkel Prep': 'OPVT 潜渡通气管准备',
    "Driver's Periscope": '驾驶员潜望镜',
    'Driver Vision Block': '驾驶员观察镜',
    'Driver Vision Blocks': '驾驶员观察镜组',
    'TNPO-168 Vision Block': 'TNPO-168 观察镜',
    'Fahrersehklappe (visor)': '驾驶员观察窗',
    "Driver's Hatch": '驾驶员舱盖',
    'Driver Hatch': '驾驶员舱盖',
    'Loader Hatch': '装填手舱盖',
    "Loader's Hatch": '装填手舱盖',
    'Gunner Hatch': '炮长舱盖',
    'Cupola Hatch': '指挥塔舱盖',
    'Turret Escape Hatch': '炮塔逃生门',
    'Bow Machine Gun': '车体机枪',
    'Coaxial Machine Gun': '并列机枪',
    'Cupola Machine Gun': '指挥塔机枪',
    'M2 .50 cal on Cupola': '指挥塔 M2 12.7 毫米机枪',
    'M2 .50 cal (CROWS-less)': 'M2 12.7 毫米机枪（无遥控站）',
    'M240 on Loader Hatch': '装填手舱盖 M240 机枪',
    'NSVT 12.7 mm': 'NSVT 12.7 毫米机枪',
    'M55 Telescopic Sight': 'M55 望远式瞄准镜',
    'TSh-16 Telescopic Sight': 'TSh-16 望远式瞄准镜',
    'TZF 9b Binocular Sight': 'TZF 9b 双目瞄准镜',
    '1A40-4 / Sosna-U Sight': '1A40-4 / 松树-U 瞄准镜',
    'M1A2 GPS (Gunner Primary Sight)': 'M1A2 GPS 炮长主瞄镜',
    'M4 Gunner Periscope': 'M4 炮长潜望镜',
    'MK-4 Periscope': 'MK-4 潜望镜',
    'Cupola Vision Blocks': '指挥塔观察镜组',
    'Traverse Control Handle': '方向机操纵把（含击发扳机）',
    'Elevation Handwheel': '高低机手轮',
    'Manual Traverse Handwheel': '手动方向机手轮',
    'Hydraulic Traverse Pedal': '液压方向机脚踏板',
    "Gunner's Left Cadillac Grip": '炮长左握把',
    'Turret Power': '炮塔电源',
    'Traverse Mode': '方向机模式',
    'Firing Circuit Safety': '击发电路保险',
    'Range Drum': '表尺距离鼓轮',
    'Azimuth Indicator': '方位指示器',
    'Sight Magnification': '瞄准镜倍率',
    'Thermal / Night Channel': '热像 / 微光通道',
    'Laser Rangefinder': '激光测距仪',
    'Fire Control Computer': '火控计算机',
    'Gun Stabiliser': '火炮稳定器',
    'Breech Operating Lever': '炮闩操作手柄',
    'Ram Round Home': '推弹入膛',
    'Spent Case Bag': '弹壳收集袋',
    'Autoloader Control Panel': '自动装弹机控制面板',
    'Carousel Type Selector': '转盘弹种选择器',
    'Manual Carousel Reload': '手动补充转盘',
    'Knee Switch (open blast door)': '膝控开关（打开防爆门）',
    'AP Ammunition Rack': '穿甲弹弹架',
    'HE Ammunition Rack': '榴弹弹架',
    'HEAT Ammunition Rack': '破甲弹弹架',
    'SMOKE Ammunition Rack': '烟幕弹弹架',
    'APFSDS Ammunition Rack': '尾翼稳定脱壳穿甲弹弹架',
    'Radio Set': '电台',
    'SCR 508 Radio': 'SCR-508 电台',
    '9-RS Radio Set': '9-RS 电台',
    'Fu 5 Radio (operator)': 'Fu 5 电台（无线电员）',
    'Fu 5 Turret Repeater': 'Fu 5 炮塔转接盒',
    'R-168 Akveduk Radio': 'R-168 水渠电台',
    'SINCGARS + FBCB2': 'SINCGARS 电台 + FBCB2 战场系统',
    "Commander's Traverse Override": '车长超越操纵手柄',
    'Designate Target (hunter-killer)': '指定目标（猎歼）',
    'Smoke Grenade Launchers': '烟幕弹发射器',
    'Map Board': '地图板',
    'CITV Independent Thermal': 'CITV 独立热像仪',

    /* ---------------- hints on passive controls ---------------- */
    'A / D steer': 'A / D 转向',
    'W': 'W 加油门',
    'S': 'S 制动',
    'A / D steer, W / S throttle': 'A / D 转向，W / S 油门与制动',
    'Q / E traverse': 'Q / E 转动炮塔',
    'Q / E traverse, R / F elevate': 'Q / E 转动炮塔，R / F 调整俯仰',
    'R / F elevate': 'R / F 调整俯仰',
    'Q / E traverse, Space fire': 'Q / E 转动炮塔，空格击发',
    '[ / ] adjust range': '[ / ] 调整表尺距离',
    'click = up a gear, right click = down': '左键升档，右键降档',
    'click to operate': '点击操作',
    'left click / right click for the alternate action': '左键操作，右键为备用动作',

    /* ---------------- garage ---------------- */
    'ARMOUR': '装甲',
    'multi-tank simulator · walk-in crew compartments · every switch does something':
      '多车型坦克模拟器 · 可进入的乘员舱 · 每个开关都有作用',
    'DEPLOY TO THE RANGE': '开赴靶场',
    'Mouse drag orbits the preview · scroll to zoom': '拖动鼠标环视预览 · 滚轮缩放',
    'Top speed': '最大速度', 'Power': '功率', 'Gun calibre': '火炮口径',
    'Muzzle vel.': '初速', 'Reload': '装填时间', 'Hull armour': '车体装甲',
    'Turret armour': '炮塔装甲',
    'crew': '名乘员',
    'United States': '美国', 'Soviet Union': '苏联', 'Germany': '德国', 'Russia': '俄罗斯',
    'Medium Tank': '中型坦克', 'Heavy Tank': '重型坦克', 'Main Battle Tank': '主战坦克',
    'building tanks…': '正在建造坦克…',
    'Controls': '操作说明',
    'CLOSE': '关闭',
    'LANGUAGE': '语言',

    /* ---------------- tank descriptions ---------------- */
    'Reliable, roomy and mass produced. A wet stowage 75 mm gun tank with a five man crew, hydraulic turret traverse and the best crew ergonomics of its generation.':
      '可靠、宽敞、量产。湿式弹药储存的 75 毫米炮坦克，五名乘员，液压转塔，同代中人机工效最好的坦克。',
    'Sloped armour, a big diesel and a hard hitting 85 mm gun in a cramped three man turret. Fast, crude, and produced in enormous numbers.':
      '倾斜装甲、大排量柴油机，狭窄的三人炮塔里塞着一门凶猛的 85 毫米炮。快、糙、产量惊人。',
    'Overengineered, superbly optical and terrifyingly heavy. Excellent gun and armour, glacial hydraulic turret traverse and a hungry gasoline engine.':
      '过度设计、光学一流、重得可怕。火炮与装甲优秀，液压转塔慢如冰川，汽油机极其耗油。',
    'Low, cramped and dangerous. Three man crew with a carousel autoloader under the turret floor, Sosna-U thermal sight and Kontakt-5 explosive reactive armour.':
      '低矮、局促、危险。三名乘员，炮塔地板下是转盘式自动装弹机，配松树-U 热像镜与接触-5 爆炸反应装甲。',
    'Gas turbine powered, digitally sighted, and fast for 62 tonnes. Hunter killer optics, blow out ammunition doors and a fully stabilised 120 mm smoothbore.':
      '燃气轮机驱动、数字化瞄准，62 吨却跑得飞快。猎歼式观瞄、泄压弹药门，以及全稳定的 120 毫米滑膛炮。',

    /* ---------------- tank notes ---------------- */
    'Bow gunner position included': '含车体机枪手位置',
    'Hydraulic + manual traverse': '液压方向机 + 手动备份',
    'Wide, comfortable fighting compartment': '战斗室宽敞舒适',
    'Cramped turret: slow reload': '炮塔狭窄，装填缓慢',
    'Manual traverse handwheel is the backup': '手摇方向机作为备份',
    'Loader works from floor ammo bins': '装填手从地板弹舱取弹',
    'Foot pedal hydraulic traverse': '脚踏液压方向机',
    'Binocular TZF 9b sight': 'TZF 9b 双目瞄准镜',
    'Interleaved suspension, 57 tonnes': '交错负重轮，57 吨',
    '22 round carousel autoloader': '22 发转盘自动装弹机',
    'No loader: commander doubles up': '无装填手，由车长兼任',
    'Thermal sight + laser rangefinder': '热像瞄准镜 + 激光测距仪',
    'Fire control computer + laser rangefinder': '火控计算机 + 激光测距仪',
    'CITV gives the commander an independent thermal': 'CITV 让车长拥有独立热像仪',
    'Semi-ready ammo behind blast doors': '半待发弹药置于防爆门后',

    /* ---------------- shell types ---------------- */
    'AP': '穿甲弹', 'HE': '榴弹', 'HEAT': '破甲弹', 'SMOKE': '烟幕弹',
    'APFSDS': '尾翼稳定脱壳穿甲弹', 'MG': '机枪弹',

    /* ---------------- vehicle + gun designations ---------------- */
    'M4A3(75) Sherman': 'M4A3(75) 谢尔曼',
    'T-34-85': 'T-34-85',
    'Panzerkampfwagen VI Tiger I': '六号坦克 虎式',
    'T-72B3': 'T-72B3',
    'M1A2 SEP Abrams': 'M1A2 SEP 艾布拉姆斯',
    'Sherman': '谢尔曼', 'Tiger I': '虎式', 'M1A2': 'M1A2',
    '75 mm M3': '75 毫米 M3',
    '85 mm ZiS-S-53': '85 毫米 ZiS-S-53',
    '8.8 cm KwK 36 L/56': '8.8 厘米 KwK 36 L/56',
    '125 mm 2A46M-5': '125 毫米 2A46M-5',
    '120 mm M256 L/44': '120 毫米 M256 L/44'
  };

  const DICTS = { zh: ZH };

  const L = {
    lang: 'en',
    listeners: [],

    init() {
      let saved = null;
      try { saved = global.localStorage && global.localStorage.getItem('armour.lang'); } catch (e) { }
      if (saved && (saved === 'en' || saved === 'zh')) this.lang = saved;
      else {
        const nav = (global.navigator && (global.navigator.language || global.navigator.userLanguage)) || 'en';
        this.lang = /^zh/i.test(nav) ? 'zh' : 'en';
      }
      return this.lang;
    },

    set(lang) {
      if (lang !== 'en' && lang !== 'zh') return;
      if (lang === this.lang) return;
      this.lang = lang;
      try { global.localStorage && global.localStorage.setItem('armour.lang', lang); } catch (e) { }
      for (const fn of this.listeners) { try { fn(lang); } catch (e) { } }
    },
    toggle() { this.set(this.lang === 'en' ? 'zh' : 'en'); },
    on(fn) { this.listeners.push(fn); },

    /** translate a source literal; unknown strings pass through */
    s(str) {
      if (str === undefined || str === null) return str;
      if (this.lang === 'en') return str;
      const d = DICTS[this.lang];
      const hit = d && d[str];
      return hit === undefined ? str : hit;
    },
    /** pick a message in the active language at the moment it is built */
    m(en, zh) { return this.lang === 'zh' && zh !== undefined ? zh : en; },
    /** shell type name for display */
    shell(type) { return this.lang === 'zh' ? (ZH[type] || type) : type; },
    /** does the dictionary know this string? (used by the tests) */
    has(str) { const d = DICTS[this.lang]; return !!(d && d[str] !== undefined); },
    dict(lang) { return DICTS[lang || this.lang] || {}; }
  };

  L.init();
  global.L = L;
  if (typeof module !== 'undefined' && module.exports) module.exports = { L, ZH };
})(typeof window !== 'undefined' ? window : globalThis);
