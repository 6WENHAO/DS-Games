/**
 * 分子 / 结构词条数据层。
 *
 * 覆盖 types.ts 中 MoleculeId 联合类型的全部 26 个 id，按“病毒结构 → 宿主表面 →
 * 胞内复制机器 → 细胞器与出胞”分组。每条包含面向高中以上非专业读者的定位、
 * 功能说明与深入阅读段落。
 *
 * 数据来源边界：基于 Hoffmann 2020、Walls 2020、Wrapp 2020、Ke 2020、Yao 2020、
 * V'kovski 2021、Jackson 2022、Snijder 2020、Cortese 2020、Ghosh 2020 等已发表
 * 文献与教材共识整理；数字优先给区间并标注“约 / 估计”。本文件不含任何三维坐标、
 * 颜色或动画参数，仅通过 id 与 src/three/palette.ts、src/scene/choreography.ts 关联。
 */

import type { Molecule, MoleculeId } from './types'

export const MOLECULES: Record<MoleculeId, Molecule> = {
  // —— 病毒结构 ——
  spike: {
    id: 'spike',
    name: '刺突蛋白',
    nameEn: 'Spike glycoprotein',
    abbr: 'S 蛋白',
    category: 'viral-structure',
    origin: 'virus',
    tagline: '开启细胞之门的三聚体钥匙',
    role: '位于囊膜表面的同源三聚体，是病毒最显眼的结构。每个单体分为 S1 与 S2 两个亚基，S1 顶端负责识别受体，S2 负责把病毒膜与细胞膜拉近融合。它是中和抗体与疫苗设计的主要靶点。',
    detail: [
      'S 蛋白由三条相同的多肽链组成三聚体，参考株全长约 1,273 个氨基酸。S1 亚基含 N 端结构域（NTD）与受体结合域（RBD），S2 亚基含融合肽、七肽重复区 HR1/HR2 与跨膜区。',
      '每个病毒体表面约有 24–40 个刺突三聚体（冷冻电镜数据），它们并非均匀排列，使病毒体在电镜下呈“皇冠”状而非光滑球体。',
      'S 蛋白在被蛋白酶切割后进入“预激活”状态，一旦 RBD 结合 ACE2 并完成 S2′ 切割，融合机器即被解锁。',
    ],
    facts: [
      { label: '结构', value: '同源三聚体，单体分 S1 / S2 亚基' },
      { label: '单体链长', value: '约 1,273 个氨基酸（参考株全长）' },
      { label: '每病毒体数量', value: '约 24–40 个三聚体' },
      { label: '功能', value: '识别 ACE2 并介导膜融合' },
    ],
    appearsIn: [1, 2, 3, 4, 5, 8],
  },

  rbd: {
    id: 'rbd',
    name: '受体结合域',
    nameEn: 'Receptor-binding domain',
    abbr: 'RBD',
    category: 'viral-structure',
    origin: 'virus',
    tagline: '刺突顶端识别 ACE2 的接头',
    role: '位于 S1 亚基，是刺突蛋白直接结合宿主 ACE2 的结构域。它在“下（隐藏）”与“上（暴露）”两种构象之间动态切换，只有抬起进入“上”构象时才能与 ACE2 对接。多数中和抗体正是靶向这个域。',
    detail: [
      'RBD 通过其受体结合基序（RBM）与 ACE2 的肽酶结构域 N 端结合，形成由氢键、疏水接触等维系的紧密界面。',
      '为避免被抗体过早识别，RBD 大部分时间藏在“下”构象，结合 ACE2 时稳定为“上”构象——这一构象开关是疫苗与单克隆抗体设计的核心考量。',
    ],
    facts: [
      { label: '所属', value: 'S1 亚基' },
      { label: '结合对象', value: '宿主 ACE2' },
      { label: '构象', value: '“上 / 下”动态切换' },
    ],
    appearsIn: [1, 2, 3, 4],
  },

  envelope: {
    id: 'envelope',
    name: '囊膜',
    nameEn: 'Envelope（lipid envelope）',
    category: 'viral-structure',
    origin: 'virus',
    tagline: '包裹病毒粒子的脂质外膜',
    role: '病毒最外层的脂双层，源自宿主细胞膜，嵌有 S、M、E 三种跨膜蛋白。它赋予病毒体球形外形，并参与进入（膜融合）与释放（出芽）两个关键环节。',
    detail: [
      '囊膜本质上是病毒在装配时从宿主膜“借”来的脂双层，因此对去污剂、酒精等脂溶剂敏感，这也是含醇手消毒剂能快速灭活囊膜病毒的原因之一。',
      '病毒体直径约 60–140 nm，囊膜表面密集分布刺突，并非光滑球体。',
    ],
    facts: [
      { label: '组成', value: '源自宿主膜的脂双层' },
      { label: '镶嵌蛋白', value: 'S、M、E 三种跨膜蛋白' },
      { label: '直径', value: '约 60–140 nm' },
    ],
    appearsIn: [1, 2, 4, 5, 8],
  },

  'm-protein': {
    id: 'm-protein',
    name: '膜蛋白',
    nameEn: 'Membrane protein',
    abbr: 'M 蛋白',
    category: 'viral-structure',
    origin: 'virus',
    tagline: '含量最多的病毒结构蛋白',
    role: '三种跨膜结构蛋白中含量最丰富的一种，跨膜三次。它是病毒体的“骨架”，决定病毒体的形状，并作为装配的组织者，把 N 蛋白–RNA 核衣壳招募到出芽位点。',
    detail: [
      'M 蛋白通过自身寡聚化以及与 N、S、E 蛋白的相互作用，协调膜弯曲与核衣壳包裹，是装配环节的主导者。',
      '在亚基因组 mRNA 中，M 的翻译效率高、表达量大，这与其“最丰富结构蛋白”的地位一致。',
    ],
    facts: [
      { label: '含量', value: '最丰富的结构蛋白' },
      { label: '拓扑', value: '三次跨膜' },
      { label: '功能', value: '主导装配、维持形态' },
    ],
    appearsIn: [1, 6, 7, 8],
  },

  'e-protein': {
    id: 'e-protein',
    name: '包膜蛋白',
    nameEn: 'Envelope protein',
    abbr: 'E 蛋白',
    category: 'viral-structure',
    origin: 'virus',
    tagline: '最小的结构蛋白，具离子通道活性',
    role: '最小的结构蛋白，含量少但作用关键。它是一种离子通道蛋白（viroporin），参与病毒体的装配、成熟与出芽，影响子代病毒的形态与释放效率。',
    detail: [
      'E 蛋白在病毒体中拷贝数很低，但具成孔活性，可改变膜的通透性；实验上缺失或破坏 E 蛋白会显著削弱病毒的装配与释放。',
      '因其在出胞环节的作用，E 蛋白也是抗病毒药物研究关注的对象之一。',
    ],
    facts: [
      { label: '大小', value: '最小的结构蛋白' },
      { label: '活性', value: '离子通道（viroporin）' },
      { label: '功能', value: '参与装配、成熟与出芽' },
    ],
    appearsIn: [1, 6, 7, 8],
  },

  'n-protein': {
    id: 'n-protein',
    name: '核衣壳蛋白',
    nameEn: 'Nucleocapsid protein',
    abbr: 'N 蛋白',
    category: 'viral-structure',
    origin: 'virus',
    tagline: '缠绕并稳定病毒 RNA 的线轴',
    role: '结合基因组 RNA，将其包裹成螺旋状的核糖核蛋白（RNP），既保护 RNA 又参与复制转录的调控。装配时它把 RNA 招募进新病毒体，是含量较高的结构蛋白之一。',
    detail: [
      'N 蛋白与 +ssRNA 结合形成长螺旋 RNP，像“线轴”一样把 29.9 kb 的基因组整齐收纳进病毒体。',
      '除结构作用外，N 蛋白还参与复制转录复合体的调控，并与 M 蛋白相互作用，把核衣壳导向出芽位点。',
    ],
    facts: [
      { label: '结合对象', value: '基因组 +ssRNA' },
      { label: '形成', value: '螺旋核糖核蛋白（RNP）' },
      { label: '功能', value: '保护 RNA、参与装配' },
    ],
    appearsIn: [1, 6, 7, 8],
  },

  'viral-rna': {
    id: 'viral-rna',
    name: '病毒 RNA 基因组',
    nameEn: 'Viral genomic RNA',
    abbr: 'gRNA',
    category: 'viral-genome',
    origin: 'virus',
    tagline: '正义单链 RNA，可直接翻译',
    role: '病毒的遗传蓝图，是一条正义单链 RNA（+ssRNA），约 29.9 kb。其 5′ 端带帽、3′ 端带 poly(A)，进入细胞质后可被核糖体直接翻译，随后又作为复制的模板。',
    detail: [
      '参考株基因组约 29,903 个核苷酸，两端结构与宿主 mRNA 相似，因此能“伪装”成宿主信使被翻译机器识别。',
      '基因组 5′ 端编码复制酶多聚蛋白（ORF1a/ORF1ab），下游编码 S、E、M、N 等结构蛋白及若干辅助蛋白。',
      '需要强调：它是单链 RNA，不是 DNA，也不形成双螺旋；整个复制周期都在细胞质中完成，从不进入细胞核。',
    ],
    facts: [
      { label: '类型', value: '正义单链 RNA（+ssRNA）' },
      { label: '长度', value: '约 29.9 kb（参考株 29,903 nt）' },
      { label: '末端', value: '5′ 帽、3′ poly(A)' },
      { label: '复制位置', value: '细胞质，不进入细胞核' },
    ],
    appearsIn: [1, 5, 6, 7],
  },

  // —— 宿主细胞表面 ——
  'host-membrane': {
    id: 'host-membrane',
    name: '宿主细胞膜',
    nameEn: 'Host plasma membrane',
    abbr: '质膜',
    category: 'host-organelle',
    origin: 'host',
    tagline: '分隔细胞内外的脂质边界',
    role: '细胞的磷脂双层边界，表面镶嵌着 ACE2、TMPRSS2 等蛋白。它是病毒附着的平台，也是质膜融合途径中两膜对接、形成融合孔的现场。',
    detail: [
      '细胞膜主要由磷脂双层构成，磷脂头部直径约 0.8 nm，远比病毒体小；在本演示中膜成分被显著放大以便辨识。',
      '膜上受体的密度与分布影响病毒附着的概率，气道纤毛细胞、肺泡 II 型细胞等表达 ACE2 的细胞是主要靶点。',
    ],
    facts: [
      { label: '组成', value: '磷脂双层' },
      { label: '镶嵌蛋白', value: 'ACE2、TMPRSS2 等' },
      { label: '磷脂头部', value: '约 0.8 nm（画面中放大）' },
    ],
    appearsIn: [2, 3, 4, 5],
  },

  ace2: {
    id: 'ace2',
    name: '血管紧张素转化酶 2',
    nameEn: 'Angiotensin-converting enzyme 2',
    abbr: 'ACE2',
    category: 'host-receptor',
    origin: 'host',
    tagline: '病毒进入细胞的门锁受体',
    role: '宿主细胞表面的受体蛋白，是刺突 RBD 的直接结合对象。它在气道、肺泡、肠道等多种上皮表达，决定了病毒的主要侵入门户。正常生理上它参与调节血压与氨基酸代谢。',
    detail: [
      'ACE2 为单次跨膜蛋白，胞外是肽酶结构域；RBD 与之结合的界面已被高分辨率结构解析（Walls 2020、Wrapp 2020 等）。',
      'SARS-CoV-2 与其前身 SARS-CoV 都利用 ACE2 进入细胞，这一受体偏好是理解病毒宿主范围与组织嗜性的关键。',
    ],
    facts: [
      { label: '类型', value: '单次跨膜受体' },
      { label: '结合对象', value: '刺突 RBD' },
      { label: '表达部位', value: '气道、肺泡、肠道等上皮' },
    ],
    appearsIn: [2, 3, 4],
  },

  tmprss2: {
    id: 'tmprss2',
    name: '跨膜丝氨酸蛋白酶 2',
    nameEn: 'Transmembrane serine protease 2',
    abbr: 'TMPRSS2',
    category: 'host-protease',
    origin: 'host',
    tagline: '质膜途径的切割剪刀',
    role: '宿主细胞表面的丝氨酸蛋白酶。病毒结合 ACE2 后，它在刺突 S2′ 位点切割，暴露融合肽、触发膜融合，是气道上皮等 TMPRSS2 高表达细胞中病毒进入的主路径。',
    detail: [
      'TMPRSS2 属于 II 型跨膜丝氨酸蛋白酶，在呼吸道、消化道等上皮表达；抑制其活性能阻断质膜途径的进入（Hoffmann 2020）。',
      '它切割的是 S2′ 位点，与生产细胞中 furin 切割的 S1/S2 位点不同——两次切割分别发生在不同的时空与细胞。',
    ],
    facts: [
      { label: '类型', value: 'II 型跨膜丝氨酸蛋白酶' },
      { label: '切割位点', value: 'S2′ 位点' },
      { label: '角色', value: '质膜融合途径的关键酶' },
    ],
    appearsIn: [2, 3, 4],
  },

  furin: {
    id: 'furin',
    name: '弗林蛋白酶',
    nameEn: 'Furin',
    abbr: 'furin',
    category: 'host-protease',
    origin: 'host',
    tagline: '生产细胞里的预切割酶',
    role: '宿主高尔基体反式网络中的蛋白酶。在“生产细胞”（被感染的细胞）中，它在刺突 S1/S2 位点预切割 S 蛋白，使子代病毒携带“预激活”的刺突，从而更容易感染下一个细胞。',
    detail: [
      'SARS-CoV-2 的 S1/S2 交界处是一个多碱基（polybasic）切割位点，可被 furin 高效识别；这一特征被认为是其传播能力强的原因之一。',
      '注意区分：furin 的预切割发生在生产细胞中，而靶细胞表面的 TMPRSS2 切割发生在进入那一刻的 S2′ 位点。',
    ],
    facts: [
      { label: '切割位点', value: 'S1/S2 位点' },
      { label: '作用地点', value: '生产细胞（高尔基体）' },
      { label: '意义', value: '预激活刺突，提升感染力' },
    ],
    appearsIn: [1, 7],
  },

  'cathepsin-l': {
    id: 'cathepsin-l',
    name: '组织蛋白酶 L',
    nameEn: 'Cathepsin L',
    abbr: 'CTSL',
    category: 'host-protease',
    origin: 'host',
    tagline: '内体途径的备用剪刀',
    role: '内体 / 溶酶体中的半胱氨酸蛋白酶。当病毒经受体介导内吞进入、而细胞表面 TMPRSS2 不足时，它在酸化内体中激活刺突，介导内体膜融合——即“内体途径”。',
    detail: [
      '内体途径是进入的备选路线：组织蛋白酶 L 在酸性环境下切割刺突，触发融合。',
      '氯喹、羟氯喹等可升高内体 pH、抑制此类蛋白酶，体外能阻断内体途径；但在 TMPRSS2 高表达的气道上皮，质膜途径占主导，这被认为是这类药物体内效果不佳的可能原因之一（需谨慎表述，临床证据尚存争议）。',
    ],
    facts: [
      { label: '类型', value: '半胱氨酸蛋白酶' },
      { label: '作用地点', value: '酸化内体' },
      { label: '角色', value: '内体途径关键酶' },
    ],
    appearsIn: [3, 4],
  },

  endosome: {
    id: 'endosome',
    name: '内体',
    nameEn: 'Endosome',
    category: 'host-organelle',
    origin: 'host',
    tagline: '内吞形成的酸化囊泡',
    role: '受体介导内吞后形成的膜性囊泡，内部随质子泵活动逐渐酸化。内体途径中，病毒在此被组织蛋白酶 L 激活，刺突驱动病毒膜与内体膜融合，把基因组释放进细胞质。',
    detail: [
      '内体从早期到晚期逐步成熟并酸化，为依赖低 pH 的蛋白酶（如组织蛋白酶 L）提供激活条件。',
      '本演示以质膜途径为主线，内体仅在讲解“两条进入路线”时作为对照出现。',
    ],
    facts: [
      { label: '来源', value: '受体介导内吞' },
      { label: '特点', value: '内部逐渐酸化' },
      { label: '角色', value: '内体途径的融合地点' },
    ],
    appearsIn: [3, 4],
  },

  'fusion-pore': {
    id: 'fusion-pore',
    name: '融合孔',
    nameEn: 'Fusion pore',
    category: 'process',
    origin: 'host',
    tagline: '两膜融合形成的通道',
    role: '病毒膜与宿主膜融合后形成的瞬时孔道，是病毒基因组进入细胞质的“门”。它由刺突 S2 的融合机制驱动，把病毒内部与细胞质连通。',
    detail: [
      '融合孔的形成是膜融合的终点事件：融合肽插入靶膜、六螺旋束折叠拉近两膜，先形成半融合中间体，再打开脂质孔道。',
      '孔道一旦形成即可扩大，囊膜融入细胞膜，随后核衣壳与 RNA 被释放进细胞质。',
    ],
    facts: [
      { label: '形成', value: '两膜融合的瞬时孔道' },
      { label: '驱动', value: 'S2 六螺旋束折叠' },
      { label: '作用', value: 'RNA 进入细胞质的通道' },
    ],
    appearsIn: [4, 5],
  },

  // —— 胞内复制机器 ——
  ribosome: {
    id: 'ribosome',
    name: '核糖体',
    nameEn: 'Ribosome',
    category: 'host-machinery',
    origin: 'host',
    tagline: '细胞质中的翻译工厂',
    role: '宿主细胞的蛋白质合成机器。它识别病毒 RNA 的 5′ 帽，直接把 +ssRNA 翻译成多聚蛋白与结构蛋白——病毒正是劫持这套机器来复制自身。',
    detail: [
      '真核细胞质核糖体为 80S 复合物，能识别 5′ 帽并沿 RNA 移动翻译；病毒基因组两端结构仿若宿主 mRNA，因此可被“误认”并高效翻译。',
      '核糖体翻译出的第一条大产物是复制酶多聚蛋白 pp1a/pp1ab，这是整个复制级联的起点。',
    ],
    facts: [
      { label: '类型', value: '80S 真核核糖体' },
      { label: '识别', value: '5′ 帽结构' },
      { label: '产出', value: '多聚蛋白、结构蛋白' },
    ],
    appearsIn: [6, 7],
  },

  pp1ab: {
    id: 'pp1ab',
    name: '多聚蛋白 pp1a / pp1ab',
    nameEn: 'Polyprotein pp1a / pp1ab',
    abbr: 'pp1a/pp1ab',
    category: 'viral-enzyme',
    origin: 'virus',
    tagline: '复制酶的前体多聚蛋白',
    role: '基因组 ORF1a 与 ORF1ab 的翻译产物，是所有复制酶的前体。pp1ab 需经一次 −1 核糖体移码才得以完整翻译，随后被病毒自身的蛋白酶切成 16 个非结构蛋白（nsp）。',
    detail: [
      'ORF1a 翻译得到 pp1a；核糖体在一个“滑移序列”处发生 −1 移码后继续翻译 ORF1b，得到更长的 pp1ab，从而改变下游阅读框。',
      '多聚蛋白随后被 PLpro（nsp3）与 3CLpro/Mpro（nsp5）顺式与反式切割，释放出 nsp1–nsp16。',
    ],
    facts: [
      { label: '编码区', value: 'ORF1a / ORF1ab' },
      { label: '关键机制', value: '−1 核糖体移码' },
      { label: '切割产物', value: '16 个非结构蛋白' },
      { label: '切割酶', value: 'PLpro（nsp3）、3CLpro/Mpro（nsp5）' },
    ],
    appearsIn: [6],
  },

  'nsp12-rdrp': {
    id: 'nsp12-rdrp',
    name: 'RNA 依赖的 RNA 聚合酶',
    nameEn: 'RNA-dependent RNA polymerase',
    abbr: 'RdRp（nsp12）',
    category: 'viral-enzyme',
    origin: 'virus',
    tagline: '复制病毒 RNA 的核心酶',
    role: '非结构蛋白 nsp12，是复制病毒 RNA 的核心酶。它与辅助因子 nsp7/nsp8 组成聚合酶核心，与 nsp13 解旋酶、nsp14 校对外切酶等共同构成复制转录复合体（RTC）。',
    detail: [
      'RdRp 以病毒 +RNA 为模板先合成 −RNA 中间体，再以 −RNA 为模板大量合成新的 +RNA，用于包装进子代病毒。',
      'nsp14 具有 3′→5′ 校对外切酶活性，使这种 RNA 病毒拥有罕见的“校对”能力，维持约 30 kb 基因组的稳定性；这也与部分核苷类似物药物的作用机制相关。',
    ],
    facts: [
      { label: '身份', value: '非结构蛋白 nsp12' },
      { label: '搭档', value: 'nsp7 / nsp8' },
      { label: '所属', value: '复制转录复合体（RTC）' },
    ],
    appearsIn: [6],
  },

  'minus-rna': {
    id: 'minus-rna',
    name: '负义 RNA 中间体',
    nameEn: 'Negative-sense RNA intermediate',
    abbr: '−RNA',
    category: 'viral-genome',
    origin: 'virus',
    tagline: '基因组复制的负义模板',
    role: '正义 RNA 病毒复制必经的中间产物。RdRp 先把 +RNA 转录成 −RNA，再以 −RNA 为模板合成大量 +RNA，供装配子代病毒与继续翻译使用。',
    detail: [
      '−RNA 与 +RNA 互补，本身不被翻译，只作为复制的“反模板”。',
      '复制发生在双膜囊泡（DMV）内，把 −RNA 与双链 RNA 等复制中间体同宿主免疫监视隔离开。',
    ],
    facts: [
      { label: '性质', value: '复制中间体' },
      { label: '功能', value: '合成 +RNA 的模板' },
      { label: '位置', value: 'DMV 内' },
    ],
    appearsIn: [6],
  },

  sgrna: {
    id: 'sgrna',
    name: '亚基因组 mRNA',
    nameEn: 'Subgenomic mRNA',
    abbr: 'sgRNA',
    category: 'viral-genome',
    origin: 'virus',
    tagline: '一套嵌套的亚基因组转录本',
    role: '通过不连续转录产生的一套 mRNA，3′ 端彼此相同、5′ 端共享同一前导序列。它们分别翻译 S、E、M、N 结构蛋白及若干辅助蛋白。',
    detail: [
      '亚基因组 mRNA 呈“嵌套”结构：所有转录本共用 3′ 端，但各自携带不同的 5′ 编码序列，从而翻译不同蛋白。',
      '不连续转录是冠状病毒的标志性机制，由转录调控序列（TRS）引导聚合酶“跳转”完成。',
    ],
    facts: [
      { label: '生成', value: '不连续转录' },
      { label: '结构', value: '3′ 端一致、嵌套排列' },
      { label: '翻译产物', value: 'S、E、M、N 及辅助蛋白' },
    ],
    appearsIn: [6, 7],
  },

  dmv: {
    id: 'dmv',
    name: '双膜囊泡',
    nameEn: 'Double-membrane vesicle',
    abbr: 'DMV',
    category: 'process',
    origin: 'virus',
    tagline: '病毒复制的双膜隔间',
    role: '由 nsp3/nsp4/nsp6 诱导、源于宿主内质网膜的复制细胞器。RNA 合成在 DMV 内部进行，把复制中间体与宿主免疫系统隔开，是病毒复制的“隔间”。',
    detail: [
      'DMV 是冠状病毒复制细胞器（replication organelle）的核心结构，与内质网相连，形成复杂的膜网络（Snijder 2020、Cortese 2020）。',
      'DMV 双膜上存在分子孔道，可供新合成的 RNA 与原料进出（Wolff 2020）。',
    ],
    facts: [
      { label: '诱导蛋白', value: 'nsp3 / nsp4 / nsp6' },
      { label: '膜来源', value: '宿主内质网' },
      { label: '功能', value: 'RNA 合成的隔离隔间' },
    ],
    appearsIn: [6],
  },

  // —— 细胞器与出胞 ——
  er: {
    id: 'er',
    name: '内质网',
    nameEn: 'Endoplasmic reticulum',
    abbr: 'ER',
    category: 'host-organelle',
    origin: 'host',
    tagline: '结构蛋白合成与插膜之地',
    role: 'S、E、M 等跨膜结构蛋白在粗面内质网的膜结合核糖体上合成并插入膜。DMV 也源于 ER 膜，因此 ER 是复制与装配共同的枢纽。',
    detail: [
      '带信号肽的病毒结构蛋白被导向 ER 膜，边翻译边插入脂双层，为后续运输与装配做准备。',
      '冠状病毒诱导 ER 膜重塑形成 DMV 与卷曲膜等结构，说明其与 ER 的密切关系。',
    ],
    facts: [
      { label: '功能', value: '结构蛋白合成与插膜' },
      { label: '关联', value: 'DMV 的膜来源' },
    ],
    appearsIn: [6, 7],
  },

  ergic: {
    id: 'ergic',
    name: '内质网-高尔基体中间区室',
    nameEn: 'ER–Golgi intermediate compartment',
    abbr: 'ERGIC',
    category: 'host-organelle',
    origin: 'host',
    tagline: '新病毒出芽装配的车间',
    role: '介于内质网与高尔基体之间的膜区室，是冠状病毒装配的主要场所。S/E/M 蛋白在此汇集，M 蛋白主导出芽，N–RNA 核衣壳出芽进入 ERGIC 腔，形成新病毒体。',
    detail: [
      'ERGIC 的膜组成与内环境适合 M 蛋白寡聚化与出芽，被认为是 SARS-CoV-2 等冠状病毒的“装配车间”。',
      '出芽完成后，子代病毒体位于 ERGIC 腔内，随后经分泌通路向外运输。',
    ],
    facts: [
      { label: '角色', value: '新病毒装配场所' },
      { label: '主导蛋白', value: 'M 蛋白' },
      { label: '过程', value: '核衣壳出芽入腔' },
    ],
    appearsIn: [7],
  },

  golgi: {
    id: 'golgi',
    name: '高尔基体',
    nameEn: 'Golgi apparatus',
    category: 'host-organelle',
    origin: 'host',
    tagline: '蛋白质加工分选的邮局',
    role: '对新合成的病毒蛋白进行糖基化等修饰与分选。S 蛋白在此被 furin 预切割，装配完成的子代病毒也经高尔基体 / 分泌通路向外运输。',
    detail: [
      '高尔基体反式网络是 furin 富集的部位，S 蛋白运输途中在此完成 S1/S2 位点切割。',
      '它同时也是分泌囊泡分选与出芽的关键枢纽，连接装配与出胞。',
    ],
    facts: [
      { label: '功能', value: '糖基化修饰与分选' },
      { label: '关联', value: 'furin 预切割、分泌通路' },
    ],
    appearsIn: [7, 8],
  },

  nucleus: {
    id: 'nucleus',
    name: '细胞核',
    nameEn: 'Nucleus',
    category: 'host-organelle',
    origin: 'host',
    tagline: '病毒的禁地，永不进入',
    role: '宿主遗传信息（DNA）的所在地。本演示画出它仅作为空间背景与对照，并明确标注：SARS-CoV-2 的 RNA 全程在细胞质翻译与复制，从不进入细胞核。',
    detail: [
      '与流感病毒等需要入核的 RNA 病毒不同，冠状病毒自带完整的 RNA 合成机器，复制、转录都在细胞质完成。',
      '把细胞核画入场景，是为了帮观众建立空间感，并纠正“病毒要进核”的常见误解。',
    ],
    facts: [
      { label: '内容', value: '宿主 DNA' },
      { label: '与病毒关系', value: '病毒不进入' },
      { label: '画面角色', value: '背景与对照' },
    ],
    appearsIn: [5, 6],
  },

  'secretory-vesicle': {
    id: 'secretory-vesicle',
    name: '分泌囊泡',
    nameEn: 'Secretory vesicle',
    category: 'host-organelle',
    origin: 'host',
    tagline: '载子代病毒外运的包裹',
    role: '包载装配完成的子代病毒、沿微管运向细胞膜的囊泡。它与质膜融合后，把病毒释放到细胞外，是经典胞吐出胞路线的运输载体。',
    detail: [
      '囊泡运输依赖细胞骨架（微管）与马达蛋白，把病毒体从胞内运到细胞边缘。',
      '近年证据还提示 β 冠状病毒可经去酸化的溶酶体外排，本演示以分泌囊泡胞吐为主线，另在前沿说明中提及该替代路线。',
    ],
    facts: [
      { label: '功能', value: '运输子代病毒' },
      { label: '路径', value: '沿微管 → 质膜' },
      { label: '终点', value: '与质膜融合释放' },
    ],
    appearsIn: [8],
  },

  'progeny-virion': {
    id: 'progeny-virion',
    name: '子代病毒',
    nameEn: 'Progeny virion',
    category: 'viral-structure',
    origin: 'virus',
    tagline: '装配完成即将释放的新病毒',
    role: '在 ERGIC 装配成熟的完整病毒体，结构与最初的入侵病毒一致。经胞吐释放后感染新的细胞，完成一轮复制周期。',
    detail: [
      '子代病毒已具备完整囊膜、刺突与核衣壳，并在生产细胞中被 furin 预切割刺突，处于“预激活”状态。',
      '一个感染细胞最终约释放 10²–10³ 个病毒体（估计值），完整复制周期约 8–12 小时。',
    ],
    facts: [
      { label: '状态', value: '完整、预激活' },
      { label: '释放方式', value: '胞吐' },
      { label: '周期', value: '一轮约 8–12 小时（估计）' },
    ],
    appearsIn: [7, 8],
  },
}
