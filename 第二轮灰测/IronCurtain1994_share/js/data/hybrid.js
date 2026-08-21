/* 铁幕1994 — 超限战 / 混合战争 数据层
 * strategic: 战役间的战略行动（消耗战略行动点 SP，效果带入之后所有战斗）
 * battleOps: 战场内的非常规作战指令（消耗召唤分值与指挥点 CP）
 * escalation: 升级阶梯与核/化武授权规则
 */
(function () {
  window.DATA_HYBRID = {
    domains: {
      ew: { name: '电子战', icon: '⚡', color: '#6fa8dc', desc: '干扰、压制、致盲。让对手的钢铁洪流失去眼睛与耳朵。' },
      info: { name: '信息战', icon: '📡', color: '#c9a227', desc: '广播、伪造、欺骗。在敌人开火之前先瓦解他开火的意愿。' },
      finance: { name: '金融战', icon: '💱', color: '#7fb069', desc: '汇率、油价、信贷。战争的燃料是钱，掐住钱就掐住了预备队。' },
      diplo: { name: '外交战', icon: '🕊', color: '#b0a8c9', desc: '联盟、中立、倒戈。多拉一个盟友，胜过多打一场胜仗。' },
      special: { name: '特种破袭', icon: '🔻', color: '#c8553d', desc: '桥梁、油库、指挥所、雷达站。用一个小组换掉一个师的进度。' },
      nuclear: { name: '核决心', icon: '☢', color: '#d9534f', desc: '政治资本换取战区核释放权。跨过去，就再也回不来。' }
    },

    /* ============ 战略层行动 ============ */
    strategic: [
      /* --- 电子战 --- */
      {
        id: 'st_ew1', domain: 'ew', tier: 1, name: '战役电子压制计划', cost: 2,
        desc: '把军属电子战营前推至第一梯队后方，全线压制敌方战术无线电网。',
        effects: { enemyApMod: -0, unlockOps: ['op_jam'], opsCostMult: 0.9 },
        text: '敌军营连级协同将出现延迟，解锁战场指令「通信干扰」。'
      },
      {
        id: 'st_ew2', domain: 'ew', tier: 2, name: '雷达致盲与反辐射猎杀', cost: 3, requires: ['st_ew1'],
        desc: '以反辐射导弹与地面干扰组配合，专门猎杀开机的搜索雷达。',
        effects: { unlockOps: ['op_radar_kill'], enemyAaAcc: -0.12 },
        text: '敌方中远程防空命中率 -12%，解锁战场指令「雷达压制」。'
      },
      {
        id: 'st_ew3', domain: 'ew', tier: 3, name: '导航拒止与数据链攻击', cost: 4, requires: ['st_ew2'],
        desc: '干扰卫星导航信号并注入虚假数据链信息，让敌人的炮弹落到自己头上。',
        effects: { unlockOps: ['op_cyber'], enemyArtyScatter: 1, enemyOpticsMod: -1 },
        text: '敌方间瞄火力散布 +1 格，观测 -1；解锁战场指令「数据链攻击」。'
      },
      /* --- 信息战 --- */
      {
        id: 'st_if1', domain: 'info', tier: 1, name: '前线心理战广播网', cost: 2,
        desc: '用敌方士兵的母语播报伤亡数字、家书与投降指引。',
        effects: { unlockOps: ['op_psyops'], enemyCohesion: -8 },
        text: '敌军初始凝聚力 -8，解锁战场指令「心理战广播」。'
      },
      {
        id: 'st_if2', domain: 'info', tier: 2, name: '伪造作战命令与电台欺骗', cost: 3, requires: ['st_if1'],
        desc: '以缴获密码本与模拟电台流量，向敌军下达一份足以以假乱真的假命令。',
        effects: { unlockOps: ['op_maskirovka'], enemyReserveDelay: 1 },
        text: '敌方预备队每场战斗延迟 1 回合投入，解锁战场指令「无线电欺骗」。'
      },
      {
        id: 'st_if3', domain: 'info', tier: 3, name: '国际舆论与厌战情绪工程', cost: 4, requires: ['st_if2'],
        desc: '把辐射区难民与阵亡通知送上对方国内电视网，逼迫其政治层收紧交战规则。',
        effects: { enemyIncomeMult: 0.88, enemyNukeResist: 2, doomsdayMod: -1 },
        text: '敌方每回合分值收入 -12%，且敌方核授权更难获批。'
      },
      /* --- 金融战 --- */
      {
        id: 'st_fn1', domain: 'finance', tier: 1, name: '汇率狙击与外汇挤兑', cost: 2,
        desc: '在苏黎世与香港同时抛售对方货币，制造军费结算危机。',
        effects: { enemyIncomeMult: 0.9 },
        text: '敌方每回合分值收入 -10%。'
      },
      {
        id: 'st_fn2', domain: 'finance', tier: 2, name: '油价操盘与能源禁运', cost: 3, requires: ['st_fn1'],
        desc: '联合中东产油国操纵原油期货，直接打击对方装甲部队的油料补给。',
        effects: { enemyIncomeMult: 0.88, enemyFuelMod: -2 },
        text: '敌方收入再 -12%，且敌方车辆机动里程下降。'
      },
      {
        id: 'st_fn3', domain: 'finance', tier: 3, name: '战时信贷与军工加速', cost: 4, requires: ['st_fn2'],
        desc: '以战争公债与强制征收撬动本方军工产能，缩短装备补充周期。',
        effects: { incomeMult: 1.18, availMod: 1 },
        text: '本方每回合收入 +18%，卡组内每张卡可用数量 +1。'
      },
      /* --- 外交战 --- */
      {
        id: 'st_dp1', domain: 'diplo', tier: 1, name: '中立国过境与港口协议', cost: 2,
        desc: '用粮食与石油换取中立国的铁路与港口通行权，缩短补给臂长。',
        effects: { deployBonus: 120, incomeMult: 1.06 },
        text: '每场战斗初始分值 +120，收入 +6%。'
      },
      {
        id: 'st_dp2', domain: 'diplo', tier: 2, name: '盟军增派与联合指挥', cost: 3, requires: ['st_dp1'],
        desc: '说服犹疑的盟国把本土师投入前线，代价是把指挥权分给一群委员会。',
        effects: { deckSlots: 3, allyCards: true },
        text: '卡组槽位 +3，解锁盟国专属部队。'
      },
      {
        id: 'st_dp3', domain: 'diplo', tier: 3, name: '策动倒戈与后方叛乱', cost: 5, requires: ['st_dp2'],
        desc: '在对方阵营内部点火：一个动摇的卫星国，等于对方少了一整个集团军。',
        effects: { enemyAvailMod: -1, enemyIncomeMult: 0.85, enemyCohesion: -6 },
        text: '敌方每卡可用数量 -1、收入 -15%、初始凝聚力 -6。'
      },
      /* --- 特种破袭 --- */
      {
        id: 'st_sp1', domain: 'special', tier: 1, name: '纵深桥梁与铁路破袭', cost: 2,
        desc: '把破坏组投到敌后 200 公里，专炸渡口、编组站与油罐车。',
        effects: { enemyReserveDelay: 1, unlockOps: ['op_sabotage'] },
        text: '敌方增援延迟，解锁战场指令「敌后破袭」。'
      },
      {
        id: 'st_sp2', domain: 'special', tier: 2, name: '雷达站与指挥所突袭', cost: 3, requires: ['st_sp1'],
        desc: '开战前夜清掉几座预警雷达和一个军指挥所，让第一波突击不被看见。',
        effects: { enemyStartLoss: 1, initialIntel: 1, enemyAaAcc: -0.08 },
        text: '战斗开始时敌方随机损失 1 支部队，你获得开局情报。'
      },
      {
        id: 'st_sp3', domain: 'special', tier: 3, name: '斩首行动与要员清除', cost: 5, requires: ['st_sp2'],
        desc: '目标清单上是集团军司令、核释放链上的军官，以及签署命令的那只手。',
        effects: { unlockOps: ['op_decap'], enemyCohesion: -10, enemyNukeResist: 1 },
        text: '解锁战场指令「斩首打击」，敌军凝聚力 -10。'
      },
      /* --- 核决心 --- */
      {
        id: 'st_nk1', domain: 'nuclear', tier: 1, name: '战区核作战预案更新', cost: 3,
        desc: '把核释放链条从最高统帅部下压到战区司令部，并完成三防训练。',
        effects: { nukeAuthBonus: 0.2, nbcTraining: true, doomsdayMod: 1 },
        text: '战场核授权申请成功率 +20%，本方部队获得三防训练；末日指数 +1。'
      },
      {
        id: 'st_nk2', domain: 'nuclear', tier: 2, name: '化学弹药前送授权', cost: 3,
        desc: '把持久性毒剂弹药从后方仓库前送到师属炮兵群——只是“以防万一”。',
        effects: { chemAuth: true, doomsdayMod: 1 },
        text: '所有战斗中解锁化学弹头炮击（无需再申请）；末日指数 +1。'
      },
      {
        id: 'st_nk3', domain: 'nuclear', tier: 3, name: '战区核释放预授权', cost: 6, requires: ['st_nk1'],
        desc: '一纸命令：战区司令可自行决定使用当量 20 千吨以下的核武器。',
        effects: { nukePreAuth: true, doomsdayMod: 2 },
        text: '所有战斗开局即拥有核授权，无需申请；末日指数 +2。'
      }
    ],

    /* ============ 战场内非常规指令 ============ */
    battleOps: [
      {
        id: 'op_jam', name: '通信干扰', domain: 'ew', cost: 70, cp: 1, radius: 2, duration: 2,
        desc: '压制目标区域内敌军战术电台：区域内敌军行动点 -1，无法呼叫间瞄火力。',
        effect: 'jam'
      },
      {
        id: 'op_radar_kill', name: '雷达压制', domain: 'ew', cost: 90, cp: 1, radius: 3, duration: 2,
        desc: '反辐射打击 + 干扰：区域内敌方防空与雷达单位无法开火，命中率大幅下降。',
        effect: 'radar'
      },
      {
        id: 'op_cyber', name: '数据链攻击', domain: 'ew', cost: 110, cp: 2, radius: 0, duration: 2,
        desc: '瘫痪敌方火力指挥系统：敌方已呼叫的支援打击延迟一回合，两回合内不能呼叫新支援。',
        effect: 'cyber'
      },
      {
        id: 'op_psyops', name: '心理战广播', domain: 'info', cost: 60, cp: 1, radius: 2, duration: 1,
        desc: '对区域内敌军实施喊话与广播：凝聚力 -22，征召兵有概率直接溃散。',
        effect: 'psyops'
      },
      {
        id: 'op_maskirovka', name: '无线电欺骗', domain: 'info', cost: 80, cp: 1, radius: 0, duration: 2,
        desc: '伪造调动电文：敌方 AI 判断错误方向，你本回合部署费用 -35%，敌方增援延迟。',
        effect: 'maskirovka'
      },
      {
        id: 'op_sigint', name: '电子侦察截获', domain: 'info', cost: 55, cp: 1, radius: 0, duration: 1,
        desc: '截获并测向敌方电台：揭示全场敌军位置一回合，并显示敌方剩余预备队。',
        effect: 'sigint'
      },
      {
        id: 'op_decoy', name: '假目标欺骗阵地', domain: 'info', cost: 45, cp: 1, radius: 1, duration: 3,
        desc: '在指定位置布设充气坦克与角反射器，吸引敌方侦察与炮火。',
        effect: 'decoy'
      },
      {
        id: 'op_sabotage', name: '敌后破袭', domain: 'special', cost: 95, cp: 1, radius: 0, duration: 1,
        desc: '破坏组袭击敌方补给节点：敌方下一回合收入减半，随机一支敌军弹药耗尽。',
        effect: 'sabotage'
      },
      {
        id: 'op_decap', name: '斩首打击', domain: 'special', cost: 130, cp: 2, radius: 1, duration: 1,
        desc: '清除敌方指挥单位：区域内敌方指挥/后勤单位遭重创，全场敌军凝聚力 -12。',
        effect: 'decap'
      },
      {
        id: 'op_finance_raid', name: '战时金融突袭', domain: 'finance', cost: 100, cp: 1, radius: 0, duration: 2,
        desc: '在结算日抛空对方货币：敌方两回合内收入 -40%，你获得 60 分值的“战争公债”。',
        effect: 'finance'
      },
      {
        id: 'op_truce_probe', name: '停火试探', domain: 'diplo', cost: 50, cp: 1, radius: 0, duration: 1,
        desc: '通过中立国递话试探停火：敌方本回合不会呼叫核/化学打击，升级阶梯 -1。',
        effect: 'truce'
      },
      {
        id: 'op_resolve', name: '下达作战决心', domain: 'nuclear', cost: 0, cp: 2, radius: 0, duration: 0,
        desc: '向战区司令部申请核释放权。需满足升级条件；成功后本场战斗解锁核打击，升级阶梯上升。',
        effect: 'resolve'
      }
    ],

    /* ============ 升级阶梯与授权 ============ */
    escalation: {
      max: 5,
      /* 满足任意一条即可申请核授权 */
      conditions: [
        { id: 'turn', text: '战斗已持续 6 个回合以上', weight: 0.10 },
        { id: 'losses', text: '本方损失达到投入兵力的 40%', weight: 0.20 },
        { id: 'objlost', text: '丢失了一个被要求死守的目标点', weight: 0.15 },
        { id: 'enemy_nbc', text: '敌方已首先使用核或化学武器', weight: 0.45 },
        { id: 'escalation', text: '战区升级阶梯已达到 2 级以上', weight: 0.15 },
        { id: 'breakthrough', text: '敌方装甲已突入我方纵深部署区', weight: 0.15 }
      ],
      baseChance: 0.18,
      cooldown: 3,
      /* 使用核武后的后果 */
      consequences: {
        escalationPerNuke: 1,
        enemyAuthChance: 0.85,   // 敌方随后获得核授权的概率
        radiationRadius: 3,
        doomsdayPerNuke: 1,
        vpPenalty: 12            // 国际压力：胜利分惩罚
      }
    }
  };
})();
