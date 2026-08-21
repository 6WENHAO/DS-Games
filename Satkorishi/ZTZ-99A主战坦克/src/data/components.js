/**
 * 组件目录 —— 右侧面板的数据源
 *
 * 每个条目：
 *   id      唯一标识
 *   name    中文名
 *   pids    精确匹配的零件标识（mesh.userData.pid）
 *   prefix  前缀匹配（用于"某一族"零件，如 'hull.'）
 *   desc    说明
 *   specs   [[标签, 数值], ...]
 *   view    { az, el, pad } 相机视角：az 方位角(度, 0=车头正前, 90=车右侧),
 *           el 俯仰角(度, 正=俯视), pad 距离系数（相对目标包围球半径）
 *   internal true 表示内部件 —— 选中时自动开启剖切/透视
 *
 * 数据说明：ZTZ-99A 的公开资料参数在此如实标注；装甲厚度、防护当量、
 * 具体弹药性能等未公开数据不作数值声明，只做结构与外形关系示意。
 */

export const DISCLAIMER =
  '本模型依据公开资料还原 ZTZ-99A 的外形与总体结构关系。装甲厚度、防护当量、火控参数等未公开数据不作数值声明；内部布局按"横置动力包 + 转盘式自动装弹机"这一同源方案做工程合理化推演，仅供结构演示与教学使用。';

export const GENERAL_SPECS = [
  ['乘员', '3 人（车长 / 炮长 / 驾驶员）'],
  ['战斗全重', '约 58 t'],
  ['车长（含炮向前）', '约 11.0 m'],
  ['车体长', '7.5 m'],
  ['车宽（含裙板）', '3.4 m'],
  ['车高（至炮塔顶）', '2.33 m'],
  ['离地间隙', '0.47 m'],
  ['主武器', '125 mm 滑膛炮 + 转盘式自动装弹机'],
  ['辅助武器', '7.62 mm 并列机枪、12.7 mm 高射机枪'],
  ['发动机', '1500 马力级涡轮增压柴油机（横置）'],
  ['单位功率', '约 26 hp/t'],
  ['传动', '液力机械综合传动 + 两侧减速器'],
  ['悬挂', '扭杆弹簧 + 液压减振器（6 对负重轮）'],
  ['最大公路速度', '约 70 km/h'],
  ['行动装置', '前置诱导轮 / 后置主动轮 / 3 托带轮'],
];

export const CATEGORIES = [
  /* ============================================================ */
  {
    id: 'overview',
    name: '总体总览',
    icon: '◈',
    items: [
      {
        id: 'all',
        name: '全车总览',
        prefix: [''],
        highlight: false,
        desc: '99A 式主战坦克整车。低矮车体 + 楔形焊接炮塔 + 后置横置动力包的经典三段式总体布置：前部驾驶舱、中部战斗舱、后部动力舱。',
        specs: GENERAL_SPECS,
        view: { az: 38, el: 18, pad: 1.28 },
      },
      {
        id: 'sil-front',
        name: '正面投影',
        prefix: [''],
        highlight: false,
        desc: '正面观察：首上甲板大倾角 + 炮塔正面楔形附加装甲构成主要防护方向；正面投影面积被刻意压到最小。',
        view: { az: 0, el: 2, pad: 1.5 },
      },
      {
        id: 'sil-side',
        name: '侧面投影',
        prefix: [''],
        highlight: false,
        desc: '侧面观察：可看清 6 对负重轮 + 3 托带轮的行动装置节奏，以及车体/炮塔的高度关系。',
        view: { az: 90, el: 4, pad: 1.42 },
      },
      {
        id: 'sil-top',
        name: '俯视布置',
        prefix: [''],
        highlight: false,
        desc: '俯视观察：顶甲板上的舱口、观瞄设备、通风百叶与散热窗的分区关系。',
        view: { az: 20, el: 78, pad: 1.35 },
      },
      {
        id: 'hull-body',
        name: '车体（整体）',
        prefix: ['hull.'],
        desc: '焊接结构车体。首上甲板以约 20° 的极小仰角向后延伸，首下甲板与之形成箭形前端；两侧翼舱在履带上方形成储油/储物空间。',
        specs: [
          ['结构', '轧制/复合装甲焊接'],
          ['首上甲板倾角', '与水平约 20°'],
          ['车体长', '7.5 m'],
          ['主舱宽', '2.24 m'],
        ],
        view: { az: 55, el: 16, pad: 1.3 },
      },
      {
        id: 'turret-body',
        name: '炮塔（整体）',
        prefix: ['turret.'],
        desc: '焊接楔形炮塔。正面两侧各一块大倾角楔形附加装甲块，中间为火炮开口；尾舱容纳抛壳与通信设备，尾栏架挂载随车物资。',
        specs: [
          ['结构', '焊接炮塔 + 附加装甲块'],
          ['座圈直径', 'Φ2.12 m'],
          ['回转', '360° 全周电液/全电驱动'],
          ['顶部高度', '2.33 m（地面起算）'],
        ],
        view: { az: 42, el: 22, pad: 1.55 },
      },
    ],
  },

  /* ============================================================ */
  {
    id: 'armor',
    name: '装甲与防护',
    icon: '🛡',
    items: [
      {
        id: 'glacis',
        name: '首上甲板',
        pids: ['hull.glacis'],
        desc: '车体首上甲板。大倾角设计使等效厚度与跳弹概率同时提高，是全车最主要的受弹面。表面焊有拖车环、牵引钩与附加装甲安装座。',
        specs: [
          ['倾角', '与水平约 20°'],
          ['作用', '主受弹面 / 承载附加装甲'],
        ],
        view: { az: 20, el: 26, pad: 2.0 },
      },
      {
        id: 'era-front',
        name: '首上附加装甲',
        pids: ['hull.era.front'],
        desc: '首上甲板上排布的方形附加装甲组件（爆炸反应装甲/复合装甲块）。逐块可更换，战损后可现场替换。防护数值未公开，此处仅还原外形与排布。',
        specs: [
          ['形式', '模块化附加装甲块'],
          ['排布', '矩阵式贴装于首上甲板'],
        ],
        view: { az: 12, el: 30, pad: 2.2 },
      },
      {
        id: 'era-side',
        name: '侧裙附加装甲',
        pids: ['hull.era.side', 'hull.skirt'],
        desc: '车体两侧前段的重型裙板与附加装甲块，覆盖前 3 对负重轮区域，用于抵御侧向破甲威胁；后段改为轻质柔性裙板以减重。',
        specs: [
          ['覆盖范围', '前段重型 + 后段柔性'],
          ['目的', '保护侧面薄弱区 / 抑制破甲弹'],
        ],
        view: { az: 78, el: 12, pad: 1.7 },
      },
      {
        id: 'turret-wedge',
        name: '炮塔楔形附加装甲',
        pids: ['turret.armor.wedge'],
        desc: '炮塔正面左右两块大倾角楔形装甲块，是 99A 最显著的外形特征。楔形使入射弹道与法线夹角增大，并在主装甲前形成间隙式防护空间。',
        specs: [
          ['形式', '楔形附加装甲（间隙布置）'],
          ['位置', '炮塔正面左右两侧'],
        ],
        view: { az: 26, el: 20, pad: 2.1 },
      },
      {
        id: 'turret-shell',
        name: '炮塔壳体',
        pids: ['turret.shell', 'turret.armor.side', 'turret.aperture'],
        desc: '焊接炮塔本体，含侧壁、尾壁与顶甲板。火炮开口两侧为耳轴座，顶部开有炮长/车长舱口与观瞄设备安装孔。',
        view: { az: 130, el: 26, pad: 1.9 },
      },
      {
        id: 'hull-lower',
        name: '首下甲板与车底',
        pids: ['hull.lower'],
        desc: '首下甲板与车底板。车底做防雷加强，前端可加挂推土/扫雷装置的安装点。',
        view: { az: 8, el: -12, pad: 2.1 },
      },
      {
        id: 'hull-deck',
        name: '顶甲板与百叶窗',
        pids: ['hull.deck'],
        desc: '车体顶甲板。后段为动力舱盖，散热与进排气百叶窗按"进气在前、排气在后"布置，兼顾红外特征抑制。',
        view: { az: 200, el: 62, pad: 1.85 },
      },
      {
        id: 'hull-rear',
        name: '尾甲板',
        pids: ['hull.rear'],
        desc: '尾甲板。中部为动力舱检修门，两侧为拖曳环与备用履带板挂点；左侧为排气口。',
        view: { az: 180, el: 14, pad: 1.9 },
      },
      {
        id: 'hull-ring',
        name: '座圈防护环',
        pids: ['hull.ring', 'turret.ring'],
        desc: '炮塔座圈与其防护环。座圈是车体与炮塔的唯一机械/电气接口，防护环用于挡住座圈缝隙、防止弹片卡入。',
        specs: [['直径', 'Φ2.12 m']],
        view: { az: 60, el: 40, pad: 2.4 },
      },
      {
        id: 'vent',
        name: '炮塔通风与三防',
        pids: ['turret.vent', 'aux.nbc'],
        desc: '炮塔顶部通风装置与三防（超压滤毒）系统。战斗时向舱内送入过滤空气并维持超压，阻止毒剂与放射性尘埃进入。',
        view: { az: 150, el: 44, pad: 2.6 },
      },
    ],
  },

  /* ============================================================ */
  {
    id: 'armament',
    name: '武器系统',
    icon: '✹',
    items: [
      {
        id: 'barrel',
        name: '125 mm 滑膛炮身管',
        pids: ['gun.barrel', 'gun.bore', 'gun.thermalSleeve'],
        desc: '125 mm 高膛压滑膛炮身管。身管外覆分段式轻合金热护套，用以减小日照与射击热造成的弯曲（热变形直接影响首发命中）。可发射尾翼稳定脱壳穿甲弹、破甲弹、榴弹与炮射导弹。',
        specs: [
          ['口径', '125 mm 滑膛'],
          ['身管长（耳轴至炮口）', '约 5.9 m'],
          ['热护套', '分段式，减小热弯曲'],
          ['弹种', '穿甲弹 / 破甲弹 / 榴弹 / 炮射导弹'],
        ],
        view: { az: 62, el: 8, pad: 1.35 },
      },
      {
        id: 'fume',
        name: '抽烟装置',
        pids: ['gun.fumeExtractor'],
        desc: '身管中段的抽烟装置（抽气装置）。利用膛内余压在开闩瞬间把火药气体抽向炮口方向，防止有害气体涌入战斗舱。',
        view: { az: 70, el: 14, pad: 4.2 },
      },
      {
        id: 'muzzle',
        name: '炮口段',
        pids: ['gun.muzzle'],
        desc: '炮口段，含炮口部加强环与炮口校正基准。滑膛炮无膛线，靠尾翼稳定弹丸。',
        view: { az: 58, el: 10, pad: 5.0 },
      },
      {
        id: 'breech',
        name: '炮闩与炮尾',
        pids: ['gun.breech'],
        desc: '炮尾与半自动立楔式炮闩。闩体由装弹机联动机构控制开闭，完成输弹—闭锁—击发—抽壳循环。',
        specs: [
          ['闩型', '立楔式半自动'],
          ['循环', '开闩 → 输弹 → 闭锁 → 击发 → 抽壳'],
        ],
        internal: true,
        view: { az: 148, el: 16, pad: 3.0 },
      },
      {
        id: 'recoil',
        name: '后坐装置',
        pids: ['gun.recoilBrake', 'gun.recuperator', 'gun.cradle', 'gun.trunnion'],
        desc: '摇架、液压制退机与气液式复进机。制退机把后坐动能转成液体节流热耗散，复进机储能并把火炮推回原位；后坐行程约 0.3 m。',
        specs: [
          ['制退机', '液压节流式（左）'],
          ['复进机', '气液式（右）'],
          ['后坐行程', '约 0.30 m'],
        ],
        internal: true,
        view: { az: 118, el: 18, pad: 2.6 },
      },
      {
        id: 'mantlet',
        name: '火炮防盾',
        pids: ['gun.mantlet'],
        desc: '火炮开口处的防盾与炮口防尘罩。随火炮俯仰运动，封闭炮塔正面最薄弱的开口。',
        view: { az: 22, el: 12, pad: 3.0 },
      },
      {
        id: 'elev',
        name: '高低机（俯仰驱动）',
        pids: ['gun.elevActuator'],
        desc: '电液/全电高低机，驱动火炮俯仰并与稳定器闭环，行进间保持火线稳定。',
        specs: [
          ['俯仰范围', '−6° ～ +14°'],
          ['稳定', '双向稳定（俯仰 + 方向）'],
        ],
        internal: true,
        view: { az: 132, el: 22, pad: 3.0 },
      },
      {
        id: 'coax',
        name: '7.62 mm 并列机枪',
        pids: ['weapon.coax'],
        desc: '与主炮同轴的并列机枪，由炮长通过火控系统射击，用于压制软目标。',
        specs: [['口径', '7.62 mm']],
        view: { az: 34, el: 14, pad: 3.6 },
      },
      {
        id: 'aamg',
        name: '12.7 mm 高射机枪',
        pids: ['weapon.aamg'],
        desc: '车长舱口处的 12.7 mm 高射机枪及枪架。可对低空目标与轻装甲目标射击，枪架具备方向与俯仰运动自由度。',
        specs: [
          ['口径', '12.7 mm'],
          ['位置', '车长舱口右后'],
        ],
        view: { az: 122, el: 30, pad: 3.0 },
      },
      {
        id: 'smoke',
        name: '烟幕弹发射器',
        pids: ['weapon.smoke'],
        desc: '炮塔两侧的烟幕弹发射装置。可齐射形成遮蔽幕，遮断可见光与部分红外观瞄，并配合激光告警自动响应。',
        specs: [
          ['布置', '炮塔两侧各一组'],
          ['用途', '光电遮蔽 / 脱离接触'],
        ],
        view: { az: 116, el: 26, pad: 2.9 },
      },
    ],
  },

  /* ============================================================ */
  {
    id: 'loader',
    name: '装弹与弹药',
    icon: '⛃',
    items: [
      {
        id: 'carousel',
        name: '转盘式自动装弹机',
        pids: ['loader.carousel', 'loader.drive'],
        desc: '座圈下方的水平转盘，22 个弹仓沿圆周径向布置，弹丸在内、药筒在外。转盘随炮塔一同回转，选弹时电机把目标弹仓转到炮尾后方的提弹位置。三人车组即由此实现。',
        specs: [
          ['待发弹', '22 发'],
          ['布置', '座圈下水平转盘，径向弹仓'],
          ['随动', '与炮塔同步回转'],
        ],
        internal: true,
        view: { az: 40, el: 26, pad: 2.1 },
      },
      {
        id: 'ammo',
        name: '待发弹（弹丸 + 药筒）',
        pids: ['loader.ammo'],
        desc: '分装式弹药：弹丸与半可燃药筒分开存放、分两次输送。图示为尾翼稳定脱壳穿甲弹外形示意。',
        specs: [
          ['形式', '分装式（弹丸 + 药筒）'],
          ['数量', '22 发待发'],
        ],
        internal: true,
        view: { az: 20, el: 34, pad: 2.0 },
      },
      {
        id: 'lifter',
        name: '提弹机',
        pids: ['loader.lifter'],
        desc: '把弹丸/药筒从转盘平面提升到炮尾轴线高度的升降托盘机构，沿两根导轨垂直运动。',
        internal: true,
        view: { az: 160, el: 20, pad: 2.6 },
      },
      {
        id: 'rammer',
        name: '推弹机',
        pids: ['loader.rammer'],
        desc: '炮尾后方的链式/液压推弹机。先推弹丸入膛，再推药筒，然后闩体闭锁。整个装填循环约数秒。',
        specs: [['顺序', '弹丸 → 药筒 → 闭锁']],
        internal: true,
        view: { az: 172, el: 16, pad: 2.8 },
      },
      {
        id: 'eject',
        name: '抛壳机构',
        pids: ['loader.eject'],
        desc: '射击后残余药筒底托由抽筒机构退出，经导槽从炮塔后上部的抛壳窗抛出车外，避免在舱内堆积。',
        internal: true,
        view: { az: 186, el: 34, pad: 2.8 },
      },
      {
        id: 'reserve',
        name: '车内备弹',
        pids: ['loader.reserveAmmo'],
        desc: '转盘之外的车内备弹架。待发弹打完后由乘员手工补充到转盘，全车携弹量约 40 发级别。',
        specs: [['全车携弹', '约 40 发（含 22 发待发）']],
        internal: true,
        view: { az: 96, el: 24, pad: 2.4 },
      },
    ],
  },

  /* ============================================================ */
  {
    id: 'fcs',
    name: '火控与观瞄',
    icon: '◎',
    items: [
      {
        id: 'gunner-sight',
        name: '炮长稳像式瞄准镜',
        pids: ['fcs.gunnerSight'],
        desc: '炮长上反稳像式主瞄准镜，集成昼间通道、热像通道与激光测距。"稳像"指瞄准线由陀螺稳定，与火炮解耦——炮长只需保持瞄准，火炮由火控自动追随。',
        specs: [
          ['形式', '上反稳像式（昼/热/测距三合一）'],
          ['稳定', '瞄准线独立陀螺稳定'],
        ],
        view: { az: 44, el: 34, pad: 3.2 },
      },
      {
        id: 'pano-sight',
        name: '车长周视稳像镜',
        pids: ['fcs.panoSight'],
        desc: '车长独立周视稳像瞄准镜（含热像）。可 360° 独立搜索，实现"猎—歼"作战：车长发现目标后一键指派，炮塔自动转向该方位交由炮长射击。',
        specs: [
          ['形式', '独立周视稳像 + 热像'],
          ['能力', '猎—歼（Hunter-Killer）'],
        ],
        view: { az: 92, el: 40, pad: 3.0 },
      },
      {
        id: 'laser',
        name: '激光测距/告警',
        pids: ['fcs.laser', 'fcs.lwr'],
        desc: '激光测距通道为火控解算提供距离；炮塔四周的激光告警接收器探测敌方测距/照射激光的方向，自动提示并可联动烟幕。',
        view: { az: 60, el: 32, pad: 3.0 },
      },
      {
        id: 'wind',
        name: '横风与气象传感器',
        pids: ['fcs.wind'],
        desc: '炮塔尾部的横风传感器。横风、药温、耳轴倾斜、身管磨损等参数一并送入火控计算机，用于弹道修正。',
        specs: [['修正量', '横风 / 药温 / 倾斜 / 磨损']],
        view: { az: 196, el: 34, pad: 3.2 },
      },
      {
        id: 'fc-computer',
        name: '火控计算机',
        pids: ['fcs.computer', 'fcs.stabilizer'],
        desc: '数字式火控计算机与双向稳定器控制盒。综合测距、传感器与目标角速度解算提前量，输出火炮随动指令，实现行进间对运动目标射击。',
        internal: true,
        view: { az: 320, el: 26, pad: 2.6 },
      },
      {
        id: 'comm',
        name: '通信与数据链',
        pids: ['fcs.radio', 'fcs.antenna'],
        desc: '车载电台与数据链终端，配合车际信息系统实现战场态势共享与目标指示分发。',
        internal: true,
        view: { az: 210, el: 30, pad: 2.6 },
      },
    ],
  },

  /* ============================================================ */
  {
    id: 'power',
    name: '动力与传动',
    icon: '⚙',
    items: [
      {
        id: 'engine',
        name: '横置 V12 涡轮增压柴油机',
        pids: ['power.engine', 'power.intake', 'power.exhaustManifold'],
        desc: '1500 马力级水冷涡轮增压柴油机，曲轴横置（沿车宽方向）。横置布局把动力舱纵向长度压到最短，为战斗舱与转盘装弹机让出空间，代价是必须用两侧减速器分别驱动主动轮。',
        specs: [
          ['功率', '1500 马力级'],
          ['形式', 'V12 水冷涡轮增压柴油机'],
          ['布置', '曲轴横置、后置动力舱'],
          ['单位功率', '约 26 hp/t'],
        ],
        internal: true,
        view: { az: 214, el: 28, pad: 2.0 },
      },
      {
        id: 'turbo',
        name: '涡轮增压器',
        pids: ['power.turbo'],
        desc: '两端各一台废气涡轮增压器，利用排气能量提高进气密度，是高功率密度的关键。',
        internal: true,
        view: { az: 240, el: 24, pad: 3.0 },
      },
      {
        id: 'airfilter',
        name: '空气滤清器',
        pids: ['power.airFilter'],
        desc: '两级空气滤清器。高原与沙尘环境下的进气清洁度直接决定发动机寿命。',
        internal: true,
        view: { az: 200, el: 30, pad: 3.0 },
      },
      {
        id: 'cooling',
        name: '散热与冷却风扇',
        pids: ['power.radiator', 'power.fan', 'power.coolant'],
        desc: '两组水散热器与立轴冷却风扇，冷却空气经顶甲板百叶进入、加热后排出。散热窗面积与红外特征之间需要折中。',
        internal: true,
        view: { az: 232, el: 42, pad: 2.3 },
      },
      {
        id: 'exhaust',
        name: '排气系统',
        pids: ['power.exhaust'],
        desc: '左侧后部排气口。排气与冷却空气混合后降温排出，可减小红外特征；必要时喷入柴油形成热烟幕。',
        view: { az: 250, el: 20, pad: 2.6 },
      },
      {
        id: 'trans',
        name: '液力机械综合传动',
        pids: ['power.transmission', 'power.torqueConv'],
        desc: '两侧液力机械综合传动装置：液力变矩器 + 行星变速 + 转向机构一体化。差速转向使原地中心转向成为可能。',
        specs: [
          ['形式', '液力机械综合传动（双侧）'],
          ['转向', '差速转向 / 可原地转向'],
        ],
        internal: true,
        view: { az: 206, el: 24, pad: 2.2 },
      },
      {
        id: 'final',
        name: '侧减速器',
        pids: ['power.finalDrive'],
        desc: '最终传动（侧减速器）。行星减速后输出到主动轮，是履带牵引力的最后一级放大。',
        view: { az: 214, el: 14, pad: 2.6 },
      },
      {
        id: 'fuel',
        name: '燃油系统',
        pids: ['power.fuelTank', 'hull.fueldrum'],
        desc: '车内翼舱油箱与前部油箱，车尾可挂两只附加油桶以增大行程；附加油桶战斗前可抛弃。',
        specs: [['附加油桶', '车尾 2 只，可抛弃']],
        internal: true,
        view: { az: 96, el: 30, pad: 2.0 },
      },
      {
        id: 'electric',
        name: '电气与蓄电池',
        pids: ['power.battery', 'power.electric', 'power.apu'],
        desc: '蓄电池组、配电箱与辅助动力装置 APU。APU 使坦克在主机不工作时仍可保持观瞄、通信与火控供电（静默监视）。',
        internal: true,
        view: { az: 300, el: 26, pad: 2.4 },
      },
      {
        id: 'bulkhead',
        name: '动力舱隔板',
        pids: ['power.bulkhead'],
        desc: '战斗舱与动力舱之间的防火隔板，隔绝噪声、高温与火灾蔓延。',
        internal: true,
        view: { az: 262, el: 22, pad: 2.6 },
      },
    ],
  },

  /* ============================================================ */
  {
    id: 'running',
    name: '行动装置',
    icon: '⚉',
    items: [
      {
        id: 'roadwheel',
        name: '负重轮',
        pids: ['run.roadwheel'],
        desc: '每侧 6 对双轮缘负重轮，轮缘外包实心胶带以降低噪声与冲击。两轮缘之间的空隙正是履带导向齿的通道。',
        specs: [
          ['数量', '每侧 6 对（双轮缘）'],
          ['直径', 'Φ0.75 m'],
          ['胶带', '实心橡胶'],
        ],
        view: { az: 86, el: 6, pad: 1.7 },
      },
      {
        id: 'suspension',
        name: '扭杆悬挂与平衡肘',
        pids: ['run.suspension', 'run.torsionBar'],
        desc: '横置扭杆弹簧 + 平衡肘。扭杆横贯车底、以扭转变形储能，占用高度极小，是低矮车体的前提条件；左右扭杆交错布置。',
        specs: [
          ['形式', '横置扭杆弹簧'],
          ['布置', '左右交错，横贯车底'],
        ],
        internal: true,
        view: { az: 70, el: -10, pad: 1.9 },
      },
      {
        id: 'damper',
        name: '液压减振器',
        pids: ['run.damper'],
        desc: '第 1、2、6 位负重轮加装液压减振器，抑制越野时的车体俯仰振荡——首末轮位振幅最大，故优先加装。',
        specs: [['安装位', '第 1、2、6 位负重轮']],
        internal: true,
        view: { az: 80, el: 8, pad: 2.4 },
      },
      {
        id: 'idler',
        name: '诱导轮与张紧机构',
        pids: ['run.idler', 'run.tensioner'],
        desc: '前置诱导轮，通过曲臂与调节螺杆改变轮心位置来调整履带张紧度。张紧度过松易脱带、过紧则功耗与磨损增大。',
        specs: [
          ['位置', '车体前部'],
          ['调节', '曲臂 + 螺杆式张紧'],
        ],
        view: { az: 52, el: 8, pad: 2.4 },
      },
      {
        id: 'sprocket',
        name: '主动轮',
        pids: ['run.sprocket'],
        desc: '后置主动轮（双齿圈 14 齿）。齿与履带销啮合传递牵引力；后置主动轮使传动轴不必穿过战斗舱。',
        specs: [
          ['齿数', '14 齿 × 2 齿圈'],
          ['位置', '车体后部'],
        ],
        view: { az: 210, el: 10, pad: 2.4 },
      },
      {
        id: 'roller',
        name: '托带轮',
        pids: ['run.roller'],
        desc: '每侧 3 个托带轮，托住上支段履带、减小上支段的抖动与下垂。',
        specs: [['数量', '每侧 3 个']],
        view: { az: 88, el: 18, pad: 2.2 },
      },
      {
        id: 'track',
        name: '履带',
        pids: ['run.track'],
        desc: '双销式挂胶履带板。宽 578 mm，节距 164 mm；板面有橡胶衬垫、内侧有中央导向齿。履带包绕路径由各轮的公切线决定——本模型用"圆集合凸包"求解，因此贴合关系与真实绷紧状态一致。',
        specs: [
          ['履带宽', '578 mm'],
          ['节距', '164 mm'],
          ['形式', '双销挂胶、中央导向齿'],
        ],
        view: { az: 96, el: 12, pad: 1.6 },
      },
    ],
  },

  /* ============================================================ */
  {
    id: 'crew',
    name: '乘员与舱室',
    icon: '☺',
    items: [
      {
        id: 'driver',
        name: '驾驶员工位',
        pids: ['crew.driver.body', 'hull.driver'],
        desc: '驾驶员位于车体前部左侧，采用大角度后倾半躺姿态——这是低矮车体的必然结果：顶甲板到座椅面只有约 0.66 m。前方为潜望镜，夜间换装微光/热像通道。',
        specs: [
          ['位置', '车体前部左侧'],
          ['姿态', '大角度后倾半躺'],
          ['观察', '3 具潜望镜（中间可换夜视）'],
        ],
        internal: true,
        view: { az: 34, el: 30, pad: 2.4 },
      },
      {
        id: 'gunner',
        name: '炮长工位',
        pids: ['crew.gunner.body', 'crew.gunner.station', 'crew.gunner.hatch'],
        desc: '炮长位于炮塔左侧，正前方为稳像式瞄准镜目镜、双手操纵台与火控显示器。工位随炮塔回转。',
        internal: true,
        view: { az: 316, el: 30, pad: 2.3 },
      },
      {
        id: 'commander',
        name: '车长工位',
        pids: ['crew.commander.body', 'crew.commander.station', 'crew.commander.hatch'],
        desc: '车长位于炮塔右侧，配周视镜、指挥终端与态势屏，可超越炮长直接射击（超越机）。',
        internal: true,
        view: { az: 44, el: 30, pad: 2.3 },
      },
      {
        id: 'basket-floor',
        name: '炮塔吊篮',
        pids: ['crew.floor'],
        desc: '随炮塔回转的吊篮地板与围壁。乘员与炮塔一同旋转，脚下不再是相对运动的车体地板。',
        internal: true,
        view: { az: 120, el: 34, pad: 2.2 },
      },
      {
        id: 'aux',
        name: '灭火抑爆与照明',
        pids: ['aux.fireSupp', 'aux.light'],
        desc: '灭火抑爆瓶与舱内照明。抑爆系统在毫秒级探测到火焰后喷洒抑爆剂，抑制油气爆燃。',
        internal: true,
        view: { az: 280, el: 28, pad: 2.4 },
      },
    ],
  },

  /* ============================================================ */
  {
    id: 'stowage',
    name: '随车装备',
    icon: '⚒',
    items: [
      {
        id: 'tools',
        name: '车外工具与备件',
        pids: ['hull.tools', 'hull.gunlock'],
        desc: '车外携带的自救工具、备用履带板与身管行军固定器（行军时把炮管锁在车体上以保护耳轴与高低机）。',
        view: { az: 150, el: 26, pad: 2.2 },
      },
      {
        id: 'lights',
        name: '灯具与信号',
        pids: ['hull.lights'],
        desc: '前大灯、红外/微光灯与尾部信号灯。灯具带防护栅，夜间可切换为隐蔽照明模式。',
        view: { az: 24, el: 16, pad: 2.6 },
      },
      {
        id: 'stow-turret',
        name: '炮塔尾栏与物资',
        pids: ['turret.stowage', 'turret.basket'],
        desc: '炮塔尾部栅栏筐，装载乘员个人装备、伪装网与备件；同时对尾部形成轻量的间隙屏蔽。',
        view: { az: 190, el: 28, pad: 2.2 },
      },
      {
        id: 'fender',
        name: '挡泥板与裙板',
        pids: ['hull.fender', 'hull.sponson'],
        desc: '前后挡泥板与翼舱外壁，抑制行进时的泥水飞溅并保护上支段履带。',
        view: { az: 70, el: 20, pad: 2.0 },
      },
      {
        id: 'markings',
        name: '车号与标识',
        pids: ['turret.markings'],
        desc: '车体/炮塔上的部队标识与车号。切换涂装方案时会随主色一起变化。',
        view: { az: 108, el: 22, pad: 3.0 },
      },
    ],
  },
];

/** 扁平索引：id → item（附 category 引用） */
export const ITEMS = (() => {
  const map = new Map();
  for (const cat of CATEGORIES) {
    for (const it of cat.items) {
      map.set(it.id, { ...it, categoryId: cat.id, categoryName: cat.name });
    }
  }
  return map;
})();

/** 统计目录条目数 */
export const ITEM_COUNT = ITEMS.size;
