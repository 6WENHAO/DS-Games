/**
 * 8 个演示步骤的叙事内容层。
 *
 * 顺序固定为：病毒整体结构 → 接近与附着 → 受体结合 → 切割与膜融合 → 基因组释放 →
 * 翻译与复制 → ERGIC 装配 → 胞吐释放。每步包含解说词、要点、高亮分子与深入阅读，
 * 并按科学准确性要求在相应步骤给出“误区纠正”。
 *
 * 数据来源边界：与 molecules.ts / references.ts 同源，数字以区间 + “约 / 估计”表述；
 * 时长仅用于自动播放节奏，不代表真实生物学时间（真实复制周期约 8–12 小时）。
 */

import type { InfectionStep } from './types'

export const STEPS: InfectionStep[] = [
  {
    id: 'virion-architecture',
    index: 1,
    title: '病毒整体结构',
    titleEn: 'Virion Architecture',
    subtitle: '认识病毒的零件与结构',
    durationSec: 24,
    narration:
      '这是一颗 SARS-CoV-2 病毒颗粒。外层是来自宿主细胞的脂质囊膜，上面镶嵌着刺突蛋白（S）、膜蛋白（M）与包膜蛋白（E）。囊膜内部，核衣壳蛋白（N）紧紧缠绕着一条正义单链 RNA 基因组——约 2.99 万个碱基的遗传蓝图。',
    bullets: [
      '刺突蛋白呈三聚体，形似皇冠',
      '囊膜来自宿主细胞的脂双层',
      'M、E、N 蛋白共同维持病毒体结构',
      '基因组是正义单链 RNA，不是 DNA',
    ],
    keyMolecules: ['spike', 'envelope', 'viral-rna', 'm-protein', 'n-protein'],
    deepRead: [
      {
        heading: '为什么叫“冠状病毒”',
        body: '刺突蛋白三聚体在囊膜表面形成类似日冕 / 皇冠的突起，电子显微镜下尤为明显，“corona”即拉丁语“皇冠”之意。每个病毒体表面约有 24–40 个刺突三聚体（Ke 2020、Yao 2020 的冷冻电镜数据），并非光滑球体。',
      },
      {
        heading: '一个病毒体里装了什么',
        body: '脂质囊膜内，N 蛋白与 +ssRNA 形成螺旋核糖核蛋白（RNP）。M 蛋白最丰富、跨膜三次，是结构的“骨架”；E 蛋白虽少，却具离子通道活性，参与成熟与释放。病毒体直径约 60–140 nm。',
      },
      {
        heading: '为什么刺突必须画出来',
        body: '刺突是识别与进入的决定性结构，也是疫苗和中和抗体的主要靶点。若把病毒画成光滑球体，就丢失了“钥匙”这一层最关键的信息。',
      },
    ],
    misconception: {
      wrong: '病毒体是一个光滑的圆球',
      right: '病毒体表面布满刺突三聚体，形状不规则，直径约 60–140 nm',
    },
  },
  {
    id: 'approach-attachment',
    index: 2,
    title: '接近与附着',
    titleEn: 'Approach & Attachment',
    subtitle: '病毒飘向并附着靶细胞',
    durationSec: 18,
    narration:
      '病毒随气流抵达呼吸道，穿过黏液层靠近气道上皮细胞。刺突蛋白的受体结合域（RBD）像钥匙一样，寻找细胞表面形似门锁的 ACE2 受体。只有 RBD 从“下”构象抬起、进入“上”构象，才能与 ACE2 对接。',
    bullets: [
      'RBD 需翻起才能暴露结合面',
      'ACE2 是细胞表面的主要门锁',
      'TMPRSS2 已就位，等待切割',
    ],
    keyMolecules: ['spike', 'ace2', 'tmprss2', 'host-membrane'],
    deepRead: [
      {
        heading: 'RBD 为什么时隐时现',
        body: '为避免被抗体过早识别，RBD 大部分时间藏在“下”构象，在“上 / 下”之间动态切换；结合 ACE2 时稳定为“上”构象，暴露出结合界面。',
      },
      {
        heading: 'ACE2 分布在哪些细胞',
        body: '气道纤毛细胞、肺泡 II 型细胞、肠上皮等都有 ACE2 表达，这解释了病毒为何主要攻击呼吸道与肺部。',
      },
    ],
  },
  {
    id: 'receptor-binding',
    index: 3,
    title: '受体结合',
    titleEn: 'Receptor Binding',
    subtitle: 'RBD 与 ACE2 特异性结合',
    durationSec: 20,
    narration:
      '刺突蛋白的 RBD 与 ACE2 精确对接，像钥匙插入锁孔。这一结合高度特异，决定了 SARS-CoV-2 的宿主范围与组织嗜性。结合之后，刺突构象发生变化，为下一步被蛋白酶切割做好准备。',
    bullets: [
      'RBD 与 ACE2 特异性结合',
      '结合是进入细胞的第一步',
      '结合诱发刺突构象变化',
    ],
    keyMolecules: ['rbd', 'ace2', 'spike', 'tmprss2'],
    deepRead: [
      {
        heading: '结合的分子细节',
        body: 'RBD 的受体结合基序（RBM）与 ACE2 肽酶结构域的 N 端相互作用，多个氢键与疏水接触形成紧密界面；这一界面也是多数中和抗体与疫苗设计的靶点。',
      },
      {
        heading: '为什么是 ACE2 而不是别的',
        body: 'SARS-CoV 与 SARS-CoV-2 都利用 ACE2 进入细胞，序列与结构上的匹配决定了病毒能感染哪些物种、哪些组织。',
      },
    ],
  },
  {
    id: 'priming-fusion',
    index: 4,
    title: '切割与膜融合',
    titleEn: 'Priming & Membrane Fusion',
    subtitle: '两次切割，驱动膜融合',
    durationSec: 22,
    narration:
      '在 TMPRSS2 高表达的气道上皮，病毒走质膜途径：TMPRSS2 在 S2′ 位点切割刺突，暴露融合肽。融合肽插入细胞膜，S2 的 HR1、HR2 折叠成六螺旋束，像拉链一样把两片膜拉近，最终形成融合孔，病毒膜与细胞膜融为一体。',
    bullets: [
      'TMPRSS2 在 S2′ 位点切割',
      '融合肽插入宿主细胞膜',
      '六螺旋束拉近两膜形成融合孔',
      '另有内体途径作为备选',
    ],
    keyMolecules: ['spike', 'tmprss2', 'fusion-pore', 'cathepsin-l'],
    deepRead: [
      {
        heading: '两次切割缺一不可',
        body: 'S1/S2 位点已在生产细胞中被 furin 预切割，S2′ 位点则由靶细胞表面 TMPRSS2 切割。两次切割都完成，融合机器才被解锁。',
      },
      {
        heading: '六螺旋束如何做功',
        body: 'S2 含两个七肽重复区 HR1 与 HR2。融合肽插入靶膜后，HR1 与 HR2 反平行折叠成稳定的六螺旋束，释放的能量把病毒膜与细胞膜拉近，直至脂双层融合。',
      },
      {
        heading: '两条进入路线',
        body: 'TMPRSS2 高表达的细胞在质膜直接融合；TMPRSS2 不足时，病毒经内吞进入，在酸化内体中被组织蛋白酶 L 激活后融合。本演示以质膜途径为主线。',
      },
    ],
    misconception: {
      wrong: '膜融合发生在细胞核膜上',
      right: '融合发生在细胞质膜（TMPRSS2 途径）或内体膜（组织蛋白酶 L 途径），与细胞核无关',
    },
  },
  {
    id: 'genome-release',
    index: 5,
    title: '基因组释放',
    titleEn: 'Genome Release / Uncoating',
    subtitle: '基因组 RNA 进入细胞质',
    durationSec: 18,
    narration:
      '融合孔扩大，病毒囊膜与细胞膜完全融合。正义单链 RNA 基因组连同 N 蛋白从病毒体中释放，直接进入细胞质。整个过程不经过细胞核——病毒的遗传信息此刻已经在“翻译工厂”门口排队。',
    bullets: [
      '融合孔扩大，囊膜融入细胞膜',
      'RNA 基因组释放到细胞质',
      '病毒 RNA 不进入细胞核',
      '脱衣壳后 RNA 可直接翻译',
    ],
    keyMolecules: ['viral-rna', 'fusion-pore', 'host-membrane', 'nucleus'],
    deepRead: [
      {
        heading: '脱衣壳释放的是什么',
        body: '进入细胞质的是与 N 蛋白结合的 +ssRNA（核糖核蛋白）。RNA 的 5′ 端带帽、3′ 端带 poly(A)，看起来像宿主 mRNA，可立即被核糖体识别。',
      },
      {
        heading: '为什么不进细胞核',
        body: '新冠病毒的整个复制周期都在细胞质完成，宿主细胞核只是背景对照。这与需要入核的病毒（如流感病毒）截然不同。',
      },
    ],
    misconception: {
      wrong: '病毒 RNA 要进入细胞核才能复制',
      right: 'SARS-CoV-2 的 RNA 全程在细胞质翻译与复制，从不进入细胞核',
    },
  },
  {
    id: 'translation-replication',
    index: 6,
    title: '翻译与复制',
    titleEn: 'Translation & Replication',
    subtitle: '从翻译到复制转录',
    durationSec: 24,
    narration:
      '核糖体直接翻译正义 RNA：先合成多聚蛋白 pp1a 与 pp1ab，后者靠一次“−1 核糖体移码”得到。多聚蛋白被病毒自己的蛋白酶切成 16 个非结构蛋白，其中 nsp12（RdRp）与 nsp7/nsp8 组成聚合酶核心。RdRp 先合成负义 RNA 中间体，再以其为模板大量复制正义 RNA，这一切都发生在双膜囊泡（DMV）内。',
    bullets: [
      '核糖体直接翻译 +ssRNA',
      'pp1a/pp1ab 经 −1 移码产生',
      'RdRp 合成 −RNA 再复制 +RNA',
      '复制在 DMV 内进行',
    ],
    keyMolecules: ['viral-rna', 'pp1ab', 'nsp12-rdrp', 'dmv', 'ribosome'],
    deepRead: [
      {
        heading: '移码与蛋白酶切割',
        body: 'ORF1a 翻译得到 pp1a；核糖体在滑移序列处发生 −1 移码后继续翻译 ORF1b，得到更长的 pp1ab。多聚蛋白随后被 PLpro（nsp3）与 3CLpro/Mpro（nsp5）切成 16 个 nsp。',
      },
      {
        heading: '复制转录复合体',
        body: 'nsp12（RdRp）与辅助因子 nsp7/nsp8 组成聚合酶核心，nsp13 解旋酶、nsp14 外切酶（具校对功能）等共同构成 RTC，在 DMV 内合成 RNA。',
      },
      {
        heading: '负义中间体与亚基因组',
        body: '复制必经 −RNA 中间体；转录则通过不连续转录产生一套嵌套的亚基因组 mRNA，翻译 S、E、M、N 及辅助蛋白。',
      },
    ],
    misconception: {
      wrong: '新冠病毒基因组是 DNA 双螺旋',
      right: '它是正义单链 RNA（+ssRNA），约 29.9 kb，不是 DNA，也不形成双螺旋',
    },
  },
  {
    id: 'assembly-ergic',
    index: 7,
    title: '新病毒装配',
    titleEn: 'Assembly at ERGIC',
    subtitle: '在 ERGIC 装配新病毒',
    durationSec: 20,
    narration:
      '新合成的 S、E、M 蛋白在内质网插膜，沿分泌通路到达 ERGIC。M 蛋白是装配的“总指挥”，它招募 N 蛋白包裹的 RNA 核衣壳，向 ERGIC 腔内出芽，形成新的病毒颗粒。',
    bullets: [
      '结构蛋白在 ER 合成插膜',
      'M 蛋白主导装配',
      'N–RNA 核衣壳出芽入 ERGIC 腔',
    ],
    keyMolecules: ['m-protein', 'ergic', 'n-protein', 'er', 'progeny-virion'],
    deepRead: [
      {
        heading: '装配如何组织',
        body: 'M 蛋白通过自身相互作用以及与 N、S、E 的相互作用，把膜与核衣壳整合起来；出芽后形成完整的囊膜病毒体。',
      },
      {
        heading: 'furin 的预切割在哪一步',
        body: '在生产者细胞中，S 蛋白经高尔基体运输时被 furin 在 S1/S2 位点预切割，使子代病毒“预激活”，更易感染下一细胞。',
      },
    ],
  },
  {
    id: 'egress-exocytosis',
    index: 8,
    title: '胞吐释放',
    titleEn: 'Egress by Exocytosis',
    subtitle: '子代病毒经胞吐释放',
    durationSec: 18,
    narration:
      '装配完成的子代病毒被包进分泌囊泡，沿微管运向细胞膜。近年证据显示，β 冠状病毒还会借助去酸化的溶酶体完成外排。囊泡与质膜融合，大量新病毒被释放，去感染更多细胞。一个感染细胞最终可释放约数百到上千个病毒体。',
    bullets: [
      '子代病毒装入分泌囊泡',
      '囊泡与质膜融合释放',
      '去酸化溶酶体途径为前沿证据',
      '一轮复制约 8–12 小时',
    ],
    keyMolecules: ['progeny-virion', 'secretory-vesicle', 'golgi', 'host-membrane'],
    deepRead: [
      {
        heading: '两条出胞路线',
        body: '经典模型认为子代病毒经分泌囊泡与质膜融合释放；Ghosh 2020 提出 β 冠状病毒也可经去酸化的溶酶体外排。本演示以分泌囊泡胞吐为主线，并在前沿说明中标注该替代路线的证据强度。',
      },
      {
        heading: '规模与时间',
        body: '一个感染细胞约释放 10²–10³ 个病毒体（估计值），完整复制周期约 8–12 小时。滴度曲线是评估传播与药物作用的重要指标。',
      },
    ],
    misconception: {
      wrong: '病毒撑破细胞一次性爆裂释放',
      right: '子代病毒主要通过胞吐持续释放，细胞可在一段时间内陆续产毒（细胞最终也可能死亡，但释放以出胞为主）',
    },
  },
]
