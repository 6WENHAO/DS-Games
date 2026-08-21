/* ============================================================================
 * theater.js — 台海战区地理与设施数据库 (Theater Geography & Facilities)
 * ----------------------------------------------------------------------------
 * 坐标均为 WGS84 真实位置(公开资料整理，精度约 ±1-2 km)。
 * 机场跑道/机堡数、港口吞吐、滩头适宜度等为公开报道与地形分析的综合估值。
 * ==========================================================================*/
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};

  /* ---------------------------------------------------------------------
   * 一、机场 (AIRBASES)
   *   rw     : 跑道条数
   *   rwLen  : 主跑道长度 m
   *   has    : 加固机堡数 (Hardened Aircraft Shelter)
   *   cave   : 山洞机库容量 (佳山/石子山)
   *   cap    : 停机容量(架)
   *   hwy    : 战备道/公路跑道
   * ------------------------------------------------------------------- */
  var AIRBASES = [
    /* ===== 台军 ===== */
    { id: 'AB-HUALIEN', side: 'ROC', name: '花莲基地 (佳山)', lat: 24.023, lon: 121.618, rw: 1, rwLen: 2750, has: 12, cave: 200, cap: 60, wing: '第五战术混合联队', note: '佳山计划山洞机库，可容纳200架，抗弹道导弹打击' },
    { id: 'AB-ZHIHANG', side: 'ROC', name: '台东志航基地 (石子山)', lat: 22.755, lon: 121.102, rw: 1, rwLen: 3050, has: 10, cave: 80, cap: 50, wing: '第七战术战斗机联队', note: '东部纵深，山洞机库' },
    { id: 'AB-HSINCHU', side: 'ROC', name: '新竹基地', lat: 24.818, lon: 120.939, rw: 1, rwLen: 3660, has: 18, cave: 0, cap: 55, wing: '第二战术战斗机联队 (幻象2000)' },
    { id: 'AB-CCK', side: 'ROC', name: '清泉岗基地 (台中)', lat: 24.264, lon: 120.621, rw: 2, rwLen: 3660, has: 24, cave: 0, cap: 90, wing: '第三战术战斗机联队 (IDF)' },
    { id: 'AB-CHIAYI', side: 'ROC', name: '嘉义基地', lat: 23.462, lon: 120.393, rw: 1, rwLen: 3100, has: 20, cave: 0, cap: 60, wing: '第四战术战斗机联队 (F-16V)' },
    { id: 'AB-TAINAN', side: 'ROC', name: '台南基地', lat: 22.950, lon: 120.206, rw: 2, rwLen: 3050, has: 18, cave: 0, cap: 70, wing: '第一战术战斗机联队 (IDF)' },
    { id: 'AB-TAOYUAN', side: 'ROC', name: '桃园基地 / 桃园机场', lat: 25.077, lon: 121.232, rw: 3, rwLen: 3800, has: 6, cave: 0, cap: 100, wing: '疏散/民航双用，登陆重点争夺目标' },
    { id: 'AB-SONGSHAN', side: 'ROC', name: '台北松山基地', lat: 25.069, lon: 121.552, rw: 1, rwLen: 2605, has: 2, cave: 0, cap: 30, wing: '空军松指部/专机队，衡山指挥所出入口' },
    { id: 'AB-PINGTUNG', side: 'ROC', name: '屏东基地', lat: 22.700, lon: 120.462, rw: 2, rwLen: 3000, has: 8, cave: 0, cap: 55, wing: '第六混合联队 (C-130H/P-3C)' },
    { id: 'AB-GANGSHAN', side: 'ROC', name: '岡山基地 (高雄)', lat: 22.783, lon: 120.263, rw: 1, rwLen: 2750, has: 6, cave: 0, cap: 45, wing: '空军军官学校/后勤司令部' },
    { id: 'AB-MAKUNG', side: 'ROC', name: '马公基地 (澎湖)', lat: 23.569, lon: 119.628, rw: 1, rwLen: 3000, has: 8, cave: 0, cap: 30, wing: '天驹部队轮驻，第一线警戒' },
    { id: 'AB-LUODONG', side: 'ROC', name: '宜兰机场 (备降)', lat: 24.740, lon: 121.767, rw: 1, rwLen: 1800, has: 0, cave: 0, cap: 12 },
    { id: 'AB-KINMEN', side: 'ROC', name: '金门尚义机场', lat: 24.428, lon: 118.359, rw: 1, rwLen: 3000, has: 2, cave: 0, cap: 10, note: '距厦门仅约10km，开战即失能' },
    { id: 'HW-MINSYONG', side: 'ROC', name: '民雄战备道', lat: 23.550, lon: 120.440, rw: 1, rwLen: 2740, has: 0, cave: 0, cap: 8, hwy: 1 },
    { id: 'HW-HUATAN', side: 'ROC', name: '花坛战备道', lat: 24.048, lon: 120.545, rw: 1, rwLen: 2740, has: 0, cave: 0, cap: 8, hwy: 1 },
    { id: 'HW-MADOU', side: 'ROC', name: '麻豆战备道', lat: 23.190, lon: 120.240, rw: 1, rwLen: 2740, has: 0, cave: 0, cap: 8, hwy: 1 },
    { id: 'HW-RENDE', side: 'ROC', name: '仁德战备道', lat: 22.940, lon: 120.244, rw: 1, rwLen: 2740, has: 0, cave: 0, cap: 8, hwy: 1 },
    { id: 'HW-JIADONG', side: 'ROC', name: '佳冬战备道', lat: 22.428, lon: 120.545, rw: 1, rwLen: 2740, has: 0, cave: 0, cap: 8, hwy: 1 },

    /* ===== 解放军 ===== */
    { id: 'AB-LONGTIAN', side: 'PLA', name: '龙田机场 (福清)', lat: 25.620, lon: 119.570, rw: 1, rwLen: 2600, has: 14, cave: 0, cap: 48, wing: '前沿一线，距台湾本岛约170km' },
    { id: 'AB-HUIAN', side: 'PLA', name: '惠安机场', lat: 25.030, lon: 118.780, rw: 1, rwLen: 2600, has: 12, cave: 0, cap: 42 },
    { id: 'AB-ZHANGZHOU', side: 'PLA', name: '漳州机场', lat: 24.550, lon: 117.750, rw: 1, rwLen: 2600, has: 10, cave: 0, cap: 40 },
    { id: 'AB-JINJIANG', side: 'PLA', name: '晋江机场', lat: 24.795, lon: 118.590, rw: 1, rwLen: 2600, has: 8, cave: 0, cap: 40 },
    { id: 'AB-XIAMEN', side: 'PLA', name: '厦门高崎机场', lat: 24.544, lon: 118.128, rw: 2, rwLen: 3400, has: 4, cave: 0, cap: 60 },
    { id: 'AB-FUZHOU', side: 'PLA', name: '福州义序机场', lat: 26.000, lon: 119.300, rw: 1, rwLen: 2800, has: 12, cave: 0, cap: 45 },
    { id: 'AB-SHUIMEN', side: 'PLA', name: '水门机场 (宁德)', lat: 26.720, lon: 119.850, rw: 1, rwLen: 2400, has: 10, cave: 0, cap: 36 },
    { id: 'AB-LIANCHENG', side: 'PLA', name: '连城机场', lat: 25.680, lon: 116.750, rw: 1, rwLen: 2700, has: 14, cave: 0, cap: 48 },
    { id: 'AB-SHANTOU', side: 'PLA', name: '汕头机场', lat: 23.430, lon: 116.680, rw: 1, rwLen: 2800, has: 12, cave: 0, cap: 44 },
    { id: 'AB-XINGNING', side: 'PLA', name: '兴宁机场', lat: 24.150, lon: 115.780, rw: 1, rwLen: 2500, has: 10, cave: 0, cap: 36 },
    { id: 'AB-LUQIAO', side: 'PLA', name: '路桥机场 (台州)', lat: 28.560, lon: 121.430, rw: 1, rwLen: 2800, has: 14, cave: 0, cap: 48 },
    { id: 'AB-NINGBO', side: 'PLA', name: '宁波庄桥机场', lat: 29.940, lon: 121.550, rw: 1, rwLen: 2800, has: 12, cave: 0, cap: 50 },
    { id: 'AB-DAISHAN', side: 'PLA', name: '岱山机场 (舟山)', lat: 30.280, lon: 122.180, rw: 1, rwLen: 2600, has: 10, cave: 0, cap: 40 },
    { id: 'AB-QUZHOU', side: 'PLA', name: '衢州机场', lat: 28.970, lon: 118.900, rw: 1, rwLen: 2600, has: 12, cave: 0, cap: 44 },
    { id: 'AB-WUHU', side: 'PLA', name: '芜湖机场', lat: 31.390, lon: 118.410, rw: 1, rwLen: 3000, has: 20, cave: 0, cap: 60, wing: '空军第9旅 (歼-20A)' },
    { id: 'AB-ANQING', side: 'PLA', name: '安庆机场', lat: 30.580, lon: 117.030, rw: 1, rwLen: 2700, has: 14, cave: 0, cap: 48 },
    { id: 'AB-XIANGTANG', side: 'PLA', name: '南昌向塘机场', lat: 28.500, lon: 115.930, rw: 1, rwLen: 3000, has: 16, cave: 0, cap: 55 },
    { id: 'AB-ZHANGSHU', side: 'PLA', name: '樟树机场', lat: 28.060, lon: 115.550, rw: 1, rwLen: 2600, has: 12, cave: 0, cap: 44 },
    { id: 'AB-LEIYANG', side: 'PLA', name: '耒阳机场 (轰-6基地)', lat: 26.430, lon: 112.860, rw: 1, rwLen: 3200, has: 8, cave: 0, cap: 40, wing: '轰炸机部队' },
    { id: 'AB-GUIPING', side: 'PLA', name: '桂平机场 (轰-6J)', lat: 23.400, lon: 110.080, rw: 1, rwLen: 3000, has: 8, cave: 0, cap: 36, wing: '海航轰炸机团' },
    { id: 'AB-SUIXI', side: 'PLA', name: '遂溪机场 (苏-35)', lat: 21.130, lon: 110.150, rw: 1, rwLen: 3000, has: 14, cave: 0, cap: 46, wing: '空军第6旅 (Su-35S)' },

    /* ===== 美军/日本 (干预) ===== */
    { id: 'AB-KADENA', side: 'US', name: '嘉手纳空军基地 (冲绳)', lat: 26.356, lon: 127.768, rw: 2, rwLen: 3690, has: 15, cave: 0, cap: 120, note: '距台北约630km，在DF-16/DF-17射程内' },
    { id: 'AB-ANDERSEN', side: 'US', name: '安德森空军基地 (关岛)', lat: 13.584, lon: 144.930, rw: 2, rwLen: 3400, has: 0, cave: 0, cap: 150, note: '距台湾约2700km，DF-26主要目标' },
    { id: 'AB-NAHA', side: 'JP', name: '那霸基地 (航空自卫队)', lat: 26.196, lon: 127.646, rw: 1, rwLen: 3000, has: 8, cave: 0, cap: 60 },
    { id: 'AB-IWAKUNI', side: 'US', name: '岩国基地', lat: 34.144, lon: 132.236, rw: 1, rwLen: 2440, has: 4, cave: 0, cap: 80 }
  ];

  /* ---------------------------------------------------------------------
   * 二、军港与商港 (NAVAL BASES / PORTS)
   *   berth : 大型舰泊位数        lift : 日装卸能力(等效营)
   * ------------------------------------------------------------------- */
  var PORTS = [
    /* --- 台军军港 --- */
    { id: 'NB-ZUOYING', side: 'ROC', type: 'navy', name: '左营军港 (海军司令部)', lat: 22.617, lon: 120.264, berth: 20, lift: 3, note: '海军主基地/潜艇战队/舰指部' },
    { id: 'NB-SUAO', side: 'ROC', type: 'navy', name: '苏澳中正基地', lat: 24.593, lon: 121.865, berth: 10, lift: 2, note: '东岸，中央山脉屏护，舰艇疏泊要点' },
    { id: 'NB-KEELUNG', side: 'ROC', type: 'navy', name: '基隆军港', lat: 25.152, lon: 121.746, berth: 8, lift: 2 },
    { id: 'NB-MAGONG', side: 'ROC', type: 'navy', name: '马公军港 (澎湖)', lat: 23.564, lon: 119.567, berth: 6, lift: 1 },
    { id: 'NB-ANPING', side: 'ROC', type: 'navy', name: '安平军港', lat: 22.995, lon: 120.160, berth: 4, lift: 1 },
    { id: 'NB-LIAOLUO', side: 'ROC', type: 'navy', name: '金门料罗湾泊地', lat: 24.410, lon: 118.410, berth: 2, lift: 0.5 },
    /* --- 台湾商港(登陆战略目标) --- */
    { id: 'PT-KAOHSIUNG', side: 'ROC', type: 'commercial', name: '高雄港', lat: 22.615, lon: 120.283, berth: 40, lift: 8, objective: 1, note: '台湾最大港，夺取即可支撑重装卸载' },
    { id: 'PT-TAICHUNG', side: 'ROC', type: 'commercial', name: '台中港', lat: 24.287, lon: 120.520, berth: 30, lift: 7, objective: 1, note: '正对海峡中部，滚装卸载条件最好' },
    { id: 'PT-TAIPEI', side: 'ROC', type: 'commercial', name: '台北港 (八里)', lat: 25.163, lon: 121.372, berth: 16, lift: 5, objective: 1, note: '直通台北盆地，政治目标价值最高' },
    { id: 'PT-KEELUNG', side: 'ROC', type: 'commercial', name: '基隆港', lat: 25.147, lon: 121.745, berth: 18, lift: 4, objective: 1 },
    { id: 'PT-HUALIEN', side: 'ROC', type: 'commercial', name: '花莲港', lat: 23.977, lon: 121.617, berth: 10, lift: 2, objective: 1 },
    { id: 'PT-SUAO-C', side: 'ROC', type: 'commercial', name: '苏澳商港', lat: 24.588, lon: 121.867, berth: 8, lift: 2 },
    { id: 'PT-BUDAI', side: 'ROC', type: 'commercial', name: '布袋港', lat: 23.383, lon: 120.145, berth: 4, lift: 1.5, objective: 1 },
    { id: 'PT-MAILIAO', side: 'ROC', type: 'commercial', name: '麦寮工业港', lat: 23.795, lon: 120.187, berth: 12, lift: 3, objective: 1, note: '台塑六轻，兼具能源节点价值' },
    { id: 'PT-ANPING-C', side: 'ROC', type: 'commercial', name: '安平商港', lat: 23.000, lon: 120.150, berth: 6, lift: 1.5 },
    /* --- 解放军军港/上船港 --- */
    { id: 'NB-NINGBO', side: 'PLA', type: 'navy', name: '宁波北仑军港 (东海舰队)', lat: 29.870, lon: 121.860, berth: 24, lift: 6, note: '东海舰队主基地' },
    { id: 'NB-ZHOUSHAN', side: 'PLA', type: 'navy', name: '舟山定海基地', lat: 30.020, lon: 122.100, berth: 20, lift: 5 },
    { id: 'NB-XIANGSHAN', side: 'PLA', type: 'navy', name: '象山潜艇基地', lat: 29.480, lon: 121.850, berth: 12, lift: 3, sub: 1 },
    { id: 'NB-SANDUAO', side: 'PLA', type: 'navy', name: '三都澳潜艇基地 (宁德)', lat: 26.650, lon: 119.720, berth: 12, lift: 3, sub: 1 },
    { id: 'NB-MAWEI', side: 'PLA', type: 'navy', name: '福州马尾基地', lat: 26.020, lon: 119.450, berth: 10, lift: 4 },
    { id: 'NB-PINGTAN', side: 'PLA', type: 'navy', name: '平潭前沿泊地', lat: 25.500, lon: 119.790, berth: 14, lift: 6, embark: 1, note: '距新竹仅约130km，海峡最窄处' },
    { id: 'NB-WEITOU', side: 'PLA', type: 'navy', name: '围头湾登陆集结区', lat: 24.510, lon: 118.600, berth: 12, lift: 5, embark: 1 },
    { id: 'NB-XIAMEN', side: 'PLA', type: 'navy', name: '厦门军港', lat: 24.450, lon: 118.070, berth: 14, lift: 5, embark: 1 },
    { id: 'NB-DONGSHAN', side: 'PLA', type: 'navy', name: '东山岛基地', lat: 23.700, lon: 117.500, berth: 10, lift: 4, embark: 1, note: '两栖训练与出发地' },
    { id: 'NB-SHANTOU', side: 'PLA', type: 'navy', name: '汕头基地', lat: 23.350, lon: 116.700, berth: 10, lift: 4, embark: 1 },
    { id: 'NB-WENZHOU', side: 'PLA', type: 'navy', name: '温州泊地', lat: 27.980, lon: 120.780, berth: 8, lift: 4, embark: 1 },
    { id: 'PT-FUZHOU-C', side: 'PLA', type: 'commercial', name: '福州江阴港 (民船动员)', lat: 25.930, lon: 119.520, berth: 16, lift: 7, embark: 1 },
    { id: 'PT-QUANZHOU', side: 'PLA', type: 'commercial', name: '泉州港 (民船动员)', lat: 24.870, lon: 118.650, berth: 14, lift: 6, embark: 1 },
    { id: 'PT-MEIZHOUWAN', side: 'PLA', type: 'commercial', name: '湄洲湾港 (民船动员)', lat: 25.100, lon: 119.100, berth: 18, lift: 7, embark: 1 }
  ];

  /* ---------------------------------------------------------------------
   * 三、登陆滩头 (BEACHES)  —— 台湾西岸公认可登陆区域
   *   width  : 可用正面 km
   *   grade  : 综合适宜度 0-1 (含滩涂/坡度/潮差/离岸障碍)
   *   flat   : 潮间带宽度 km (西岸淤泥滩，重装卸载最大障碍)
   *   obj    : 上陸后主要作战目标
   * ------------------------------------------------------------------- */
  var BEACHES = [
    { id: 'BH-LINKOU', name: '林口—淡水海岸', lat: 25.163, lon: 121.318, width: 8, grade: 0.55, flat: 0.6, obj: '台北盆地/台北港', region: '北部', note: '直指首都，但防御最密集、水下障碍多' },
    { id: 'BH-GUANYIN', name: '桃园观音—永安', lat: 25.030, lon: 121.090, width: 14, grade: 0.7, flat: 0.9, obj: '桃园机场/北部工业区', region: '北部' },
    { id: 'BH-XIANGSHAN', name: '新竹香山', lat: 24.752, lon: 120.895, width: 10, grade: 0.5, flat: 2.4, obj: '新竹基地/科学园区', region: '北部', note: '香山湿地滩涂极宽，重装难上陸' },
    { id: 'BH-HOULONG', name: '苗栗后龙—通霄', lat: 24.610, lon: 120.735, width: 12, grade: 0.62, flat: 1.0, obj: '中部走廊', region: '中部' },
    { id: 'BH-DAJIA', name: '台中大甲—清水', lat: 24.350, lon: 120.545, width: 16, grade: 0.78, flat: 0.8, obj: '台中港/清泉岗基地', region: '中部', note: '与台中港相邻，PLA 首选主登陆方向' },
    { id: 'BH-XIANXI', name: '彰化伸港—线西', lat: 24.150, lon: 120.440, width: 12, grade: 0.6, flat: 1.8, obj: '彰化平原/台中侧翼', region: '中部' },
    { id: 'BH-FANGYUAN', name: '彰化芳苑—大城', lat: 23.900, lon: 120.300, width: 14, grade: 0.55, flat: 2.6, obj: '浊水溪北岸', region: '中部' },
    { id: 'BH-TAIXI', name: '云林台西—四湖', lat: 23.700, lon: 120.180, width: 14, grade: 0.6, flat: 2.2, obj: '麦寮港/云嘉平原', region: '中部' },
    { id: 'BH-BUDAI', name: '嘉义布袋—东石', lat: 23.383, lon: 120.130, width: 10, grade: 0.66, flat: 1.6, obj: '布袋港/嘉义基地', region: '南部' },
    { id: 'BH-JIANGJUN', name: '台南将军—七股', lat: 23.190, lon: 120.080, width: 12, grade: 0.68, flat: 1.4, obj: '台南基地/台南市区', region: '南部' },
    { id: 'BH-ANPING', name: '台南黄金海岸 (喜树)', lat: 22.940, lon: 120.170, width: 8, grade: 0.72, flat: 0.5, obj: '安平港/台南市区', region: '南部' },
    { id: 'BH-LINYUAN', name: '高雄林园—大寮', lat: 22.500, lon: 120.420, width: 9, grade: 0.7, flat: 0.4, obj: '高雄港南翼/大林炼油', region: '南部' },
    { id: 'BH-FANGLIAO', name: '屏东枋寮—加禄堂', lat: 22.360, lon: 120.580, width: 10, grade: 0.74, flat: 0.3, obj: '南回公路/枋山电缆站', region: '南部', note: '砾石滩坡度好，守军最薄弱' },
    { id: 'BH-WAIAO', name: '宜兰头城外澳—壮围', lat: 24.880, lon: 121.845, width: 7, grade: 0.6, flat: 0.3, obj: '兰阳平原—雪隧直取台北', region: '东部', note: '东岸罕见可登陆区，直通北宜' },
    { id: 'BH-QIXINGTAN', name: '花莲七星潭', lat: 24.035, lon: 121.630, width: 4, grade: 0.35, flat: 0.1, obj: '花莲港/佳山基地', region: '东部', note: '陡降砾石滩，仅适合特战/直升机突击' }
  ];

  /* ---------------------------------------------------------------------
   * 四、关键节点 (KEY SITES) —— C2、预警、能源、通信
   * ------------------------------------------------------------------- */
  var KEYSITES = [
    { id: 'KS-HENGSHAN', side: 'ROC', name: '衡山指挥所 (圆山)', lat: 25.045, lon: 121.518, kind: 'c2', value: 10, hp: 60, hard: 3, note: '战时最高指挥中枢，深层地下坑道' },
    { id: 'KS-MND', side: 'ROC', name: '国防部博爱营区 (大直)', lat: 25.079, lon: 121.552, kind: 'c2', value: 8, hp: 30, hard: 1.5 },
    { id: 'KS-LESHAN', side: 'ROC', name: '乐山长程预警雷达站', lat: 24.503, lon: 121.083, kind: 'radar', value: 10, hp: 26, hard: 1.2, note: '铺路爪雷达，2000km预警，PLA首波必打' },
    { id: 'KS-JIASHAN', side: 'ROC', name: '佳山基地洞库群', lat: 24.030, lon: 121.600, kind: 'shelter', value: 9, hp: 90, hard: 4 },
    { id: 'KS-SHIZISHAN', side: 'ROC', name: '石子山洞库 (台东)', lat: 22.790, lon: 121.100, kind: 'shelter', value: 8, hp: 80, hard: 4 },
    { id: 'KS-MAANSHAN', side: 'ROC', name: '核三厂 (马鞍山)', lat: 21.958, lon: 120.751, kind: 'power', value: 7, hp: 40, hard: 2 },
    { id: 'KS-HSINTA', side: 'ROC', name: '兴达电厂', lat: 22.850, lon: 120.190, kind: 'power', value: 6, hp: 25, hard: 1 },
    { id: 'KS-TAICHUNGPP', side: 'ROC', name: '台中火力发电厂', lat: 24.213, lon: 120.485, kind: 'power', value: 8, hp: 28, hard: 1, note: '全台最大电厂，占供电约20%' },
    { id: 'KS-DALIN', side: 'ROC', name: '大林炼油厂/油库', lat: 22.550, lon: 120.380, kind: 'fuel', value: 7, hp: 22, hard: 1 },
    { id: 'KS-FANGSHAN', side: 'ROC', name: '枋山海缆登陆站', lat: 22.310, lon: 120.650, kind: 'cable', value: 8, hp: 14, hard: 1, note: '国际海缆枢纽，切断即对外通信瘫痪' },
    { id: 'KS-TOUCHENG', side: 'ROC', name: '头城海缆登陆站', lat: 24.860, lon: 121.830, kind: 'cable', value: 7, hp: 14, hard: 1 },
    { id: 'KS-TSMC', side: 'ROC', name: '新竹科学园区 (晶圆产业)', lat: 24.783, lon: 121.000, kind: 'industry', value: 9, hp: 20, hard: 1, note: '政治经济价值极高，双方均避免直接摧毁' },
    { id: 'KS-CHIAYI-C2', side: 'ROC', name: '空军作战指挥部战管中心', lat: 24.955, lon: 121.230, kind: 'c2', value: 8, hp: 32, hard: 2 },

    { id: 'KS-PLA-ETC', side: 'PLA', name: '东部战区联合作战指挥中心 (南京)', lat: 32.060, lon: 118.790, kind: 'c2', value: 10, hp: 70, hard: 4 },
    { id: 'KS-PLA-FZ', side: 'PLA', name: '福州战役前指', lat: 26.080, lon: 119.300, kind: 'c2', value: 8, hp: 40, hard: 2.5 },
    { id: 'KS-PLA-RF61', side: 'PLA', name: '火箭军61基地 (黄山)', lat: 29.710, lon: 118.310, kind: 'c2', value: 9, hp: 45, hard: 3 },
    { id: 'KS-PLA-RADAR1', side: 'PLA', name: '福建大型相控阵预警雷达', lat: 25.900, lon: 119.400, kind: 'radar', value: 8, hp: 22, hard: 1.2 },
    { id: 'KS-PLA-RADAR2', side: 'PLA', name: '东山对海超视距雷达', lat: 23.720, lon: 117.480, kind: 'radar', value: 7, hp: 20, hard: 1.2 },
    { id: 'KS-PLA-EW1', side: 'PLA', name: '平潭电子对抗阵地', lat: 25.480, lon: 119.740, kind: 'ew', value: 7, hp: 16, hard: 1 },
    { id: 'KS-PLA-EW2', side: 'PLA', name: '南澳电子对抗阵地', lat: 23.430, lon: 117.100, kind: 'ew', value: 6, hp: 16, hard: 1 }
  ];

  /* ---------------------------------------------------------------------
   * 五、城市 (CITIES) —— 城市战/政治目标
   * ------------------------------------------------------------------- */
  var CITIES = [
    { name: '台北市', lat: 25.033, lon: 121.565, pop: 250, side: 'ROC', capital: 1, urban: 2.2, value: 30 },
    { name: '新北市', lat: 25.012, lon: 121.465, pop: 400, side: 'ROC', urban: 2.0, value: 16 },
    { name: '桃园市', lat: 24.993, lon: 121.301, pop: 230, side: 'ROC', urban: 1.7, value: 12 },
    { name: '台中市', lat: 24.147, lon: 120.674, pop: 280, side: 'ROC', urban: 1.8, value: 14 },
    { name: '台南市', lat: 22.999, lon: 120.227, pop: 186, side: 'ROC', urban: 1.6, value: 10 },
    { name: '高雄市', lat: 22.627, lon: 120.302, pop: 274, side: 'ROC', urban: 1.9, value: 16 },
    { name: '新竹市', lat: 24.804, lon: 120.972, pop: 45, side: 'ROC', urban: 1.4, value: 9 },
    { name: '嘉义市', lat: 23.480, lon: 120.449, pop: 26, side: 'ROC', urban: 1.3, value: 5 },
    { name: '彰化市', lat: 24.081, lon: 120.538, pop: 23, side: 'ROC', urban: 1.3, value: 4 },
    { name: '花莲市', lat: 23.977, lon: 121.604, pop: 10, side: 'ROC', urban: 1.2, value: 4 },
    { name: '宜兰市', lat: 24.757, lon: 121.753, pop: 9, side: 'ROC', urban: 1.2, value: 4 },
    { name: '台东市', lat: 22.756, lon: 121.144, pop: 10, side: 'ROC', urban: 1.1, value: 3 },
    { name: '马公市', lat: 23.566, lon: 119.566, pop: 6, side: 'ROC', urban: 1.1, value: 4 },
    { name: '金城 (金门)', lat: 24.433, lon: 118.317, pop: 4, side: 'ROC', urban: 1.1, value: 3 },
    { name: '南竿 (马祖)', lat: 26.152, lon: 119.949, pop: 1, side: 'ROC', urban: 1.0, value: 2 },
    { name: '福州', lat: 26.075, lon: 119.297, pop: 830, side: 'PLA', urban: 1.8, value: 12 },
    { name: '厦门', lat: 24.480, lon: 118.089, pop: 530, side: 'PLA', urban: 1.8, value: 12 },
    { name: '泉州', lat: 24.874, lon: 118.676, pop: 880, side: 'PLA', urban: 1.6, value: 8 },
    { name: '温州', lat: 27.994, lon: 120.699, pop: 960, side: 'PLA', urban: 1.6, value: 8 },
    { name: '宁波', lat: 29.868, lon: 121.550, pop: 960, side: 'PLA', urban: 1.7, value: 10 },
    { name: '汕头', lat: 23.354, lon: 116.682, pop: 550, side: 'PLA', urban: 1.5, value: 6 },
    { name: '平潭', lat: 25.503, lon: 119.791, pop: 40, side: 'PLA', urban: 1.2, value: 6 }
  ];

  /* ---------------------------------------------------------------------
   * 六、地面部队初始配置区 (ROC 战区/守备区)
   * ------------------------------------------------------------------- */
  var GROUND_ZONES = [
    { id: 'GZ-N', name: '第六军团 (北部战区)', side: 'ROC', lat: 24.95, lon: 121.30, r: 60, terrain: 'urban', note: '首都卫戍，重兵集团' },
    { id: 'GZ-C', name: '第十军团 (中部战区)', side: 'ROC', lat: 24.10, lon: 120.65, r: 70, terrain: 'plain' },
    { id: 'GZ-S', name: '第八军团 (南部战区)', side: 'ROC', lat: 22.85, lon: 120.35, r: 75, terrain: 'plain' },
    { id: 'GZ-E', name: '花东防卫指挥部', side: 'ROC', lat: 23.60, lon: 121.35, r: 80, terrain: 'mountain' },
    { id: 'GZ-PH', name: '澎湖防卫指挥部', side: 'ROC', lat: 23.57, lon: 119.60, r: 22, terrain: 'island' },
    { id: 'GZ-KM', name: '金门防卫指挥部', side: 'ROC', lat: 24.44, lon: 118.36, r: 16, terrain: 'island' },
    { id: 'GZ-MZ', name: '马祖防卫指挥部', side: 'ROC', lat: 26.16, lon: 119.95, r: 12, terrain: 'island' }
  ];

  /* ---------------------------------------------------------------------
   * 七、海峡/水道 & 封锁区
   * ------------------------------------------------------------------- */
  var CHANNELS = [
    { name: '台湾海峡中线', kind: 'line', pts: [[119.30, 26.60], [119.60, 25.60], [120.05, 24.70], [120.35, 24.00], [120.05, 23.20], [119.50, 22.40]] },
    { name: '澎湖水道', kind: 'zone', lat: 23.60, lon: 119.95, r: 35, depth: 70, note: '澎湖—台湾本岛间深槽，潜艇/舰艇通道' },
    { name: '台湾浅滩', kind: 'zone', lat: 22.90, lon: 118.00, r: 60, depth: 20, note: '水深仅10-30m，潜艇无法活动，布雷价值高' },
    { name: '巴士海峡', kind: 'zone', lat: 21.20, lon: 121.00, r: 90, depth: 3000, note: '南部咽喉，美军潜艇进出主通道' },
    { name: '与那国海峡', kind: 'zone', lat: 24.30, lon: 122.60, r: 45, depth: 1000, note: '台湾东北出口，距花莲仅约150km' },
    { name: '宫古海峡', kind: 'zone', lat: 25.10, lon: 125.20, r: 70, depth: 2000, note: '解放军舰队突破第一岛链主通道' },
    { name: '花东纵深海域', kind: 'zone', lat: 23.20, lon: 122.50, r: 100, depth: 4000, note: '深水区，双方潜艇主战场' }
  ];

  // 2024/2025 式"联合利剑"演习封控区 (演习-封锁剧本使用)
  var CLOSURE_ZONES = [
    { name: '封控区 A (基隆以北)', pts: [[121.6, 25.6], [122.6, 25.6], [122.6, 26.4], [121.6, 26.4]] },
    { name: '封控区 B (花莲以东)', pts: [[121.9, 23.4], [123.4, 23.4], [123.4, 24.4], [121.9, 24.4]] },
    { name: '封控区 C (高雄西南)', pts: [[119.4, 21.4], [120.6, 21.4], [120.6, 22.3], [119.4, 22.3]] },
    { name: '封控区 D (海峡中部)', pts: [[119.0, 23.6], [120.1, 23.6], [120.1, 24.5], [119.0, 24.5]] },
    { name: '封控区 E (澎湖西侧)', pts: [[118.4, 23.0], [119.3, 23.0], [119.3, 23.9], [118.4, 23.9]] },
    { name: '封控区 F (与那国以西)', pts: [[122.4, 24.4], [123.6, 24.4], [123.6, 25.3], [122.4, 25.3]] }
  ];

  /* ---------------------------------------------------------------------
   * 八、第一岛链外围岛屿(手绘近似多边形，用于战场态势完整性)
   * ------------------------------------------------------------------- */
  var ISLANDS_EXTRA = [
    { name: '与那国岛', poly: [[122.93, 24.44], [123.02, 24.46], [123.05, 24.45], [123.02, 24.42], [122.95, 24.41], [122.92, 24.43]] },
    { name: '石垣岛', poly: [[124.06, 24.34], [124.20, 24.45], [124.32, 24.50], [124.34, 24.44], [124.25, 24.37], [124.18, 24.31], [124.10, 24.29]] },
    { name: '宫古岛', poly: [[125.15, 24.72], [125.32, 24.75], [125.47, 24.83], [125.42, 24.90], [125.25, 24.88], [125.14, 24.80]] },
    { name: '冲绳本岛', poly: [[127.65, 26.09], [127.80, 26.20], [127.95, 26.44], [128.15, 26.65], [128.32, 26.85], [128.25, 26.95], [128.05, 26.75], [127.85, 26.50], [127.70, 26.30], [127.62, 26.15]] },
    { name: '巴丹群岛', poly: [[121.90, 20.35], [122.05, 20.42], [122.10, 20.52], [121.98, 20.55], [121.88, 20.46]] },
    { name: '兰屿', poly: [[121.50, 22.02], [121.60, 22.05], [121.62, 22.00], [121.55, 21.96], [121.49, 21.98]] },
    { name: '绿岛', poly: [[121.46, 22.63], [121.52, 22.68], [121.51, 22.63], [121.47, 22.61]] }
  ];

  /* ---------------------------------------------------------------------
   * 九、环境：季风/海况模型 (影响两栖、航空、导弹精度)
   * ------------------------------------------------------------------- */
  var SEASONS = {
    '3月下-4月 (春季窗口)': { sea: 2.6, vis: 0.75, wind: 14, amphib: 0.78, air: 0.85, note: '海况转好，雾季能见度差，历史推演首选窗口之一' },
    '5-6月 (梅雨)': { sea: 2.2, vis: 0.6, wind: 12, amphib: 0.8, air: 0.7, note: '海况尚可但低云雨幕影响航空与光电制导' },
    '7-8月 (台风季)': { sea: 3.2, vis: 0.85, wind: 20, amphib: 0.5, air: 0.75, note: '台风随机中断作战，两栖风险极高' },
    '9-10月 (秋季窗口)': { sea: 2.4, vis: 0.9, wind: 15, amphib: 0.82, air: 0.9, note: '公认最佳两栖窗口，海况与能见度兼顾' },
    '11-2月 (东北季风)': { sea: 4.2, vii: 0.8, vis: 0.8, wind: 26, amphib: 0.28, air: 0.65, note: '海峡6级以上大风常态，中小型登陆器材无法航渡' }
  };

  /* 工具：查表 */
  function byId(arr) { var m = {}; arr.forEach(function (o) { m[o.id] = o; }); return m; }

  TWG.THEATER = {
    AIRBASES: AIRBASES, PORTS: PORTS, BEACHES: BEACHES, KEYSITES: KEYSITES,
    CITIES: CITIES, GROUND_ZONES: GROUND_ZONES, CHANNELS: CHANNELS,
    CLOSURE_ZONES: CLOSURE_ZONES, ISLANDS_EXTRA: ISLANDS_EXTRA, SEASONS: SEASONS,
    idx: {
      airbase: byId(AIRBASES), port: byId(PORTS), beach: byId(BEACHES), keysite: byId(KEYSITES)
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
