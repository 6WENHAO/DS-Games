/**
 * 术语表数据层。
 *
 * 覆盖本演示涉及的分子病毒学关键概念，按中文名拼音 / 逻辑分组排序，
 * 每条 1–3 句、面向高中以上非专业读者，并尽量关联可点击跳转的分子 id。
 *
 * 数据来源边界：定义基于教材共识与 references.ts 所列综述，避免争议性表述；
 * 对仍在研究中的结论（如出胞替代路线）在正文中标注证据强度。
 */

import type { GlossaryEntry } from './types'

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: '囊膜病毒',
    termEn: 'Enveloped virus',
    definition:
      '外层包有脂质囊膜（来自宿主细胞膜）的病毒。囊膜对去污剂、酒精等脂溶剂敏感，因此含醇手消毒剂能快速灭活 SARS-CoV-2。',
    related: ['envelope'],
  },
  {
    term: '正义单链 RNA（+ssRNA）',
    termEn: 'Positive-sense single-stranded RNA',
    definition:
      '一条可直接被核糖体翻译成蛋白质的 RNA，其序列方向与 mRNA 相同。SARS-CoV-2 基因组即为此类，长约 29.9 kb，5′ 端带帽、3′ 端带 poly(A)。',
    related: ['viral-rna'],
  },
  {
    term: '刺突蛋白三聚体',
    termEn: 'Spike trimer',
    definition:
      '由三条相同刺突蛋白单体组成的三聚体，突出于病毒囊膜表面，形似皇冠。每个单体分 S1（负责结合受体）与 S2（负责膜融合）两个亚基。',
    related: ['spike'],
  },
  {
    term: '受体结合域（RBD）',
    termEn: 'Receptor-binding domain',
    definition:
      '刺突蛋白 S1 亚基上直接与宿主 ACE2 结合的结构域，是多数中和抗体与疫苗的靶点。',
    related: ['rbd', 'spike'],
  },
  {
    term: '构象“上 / 下”状态',
    termEn: '“Up / down” conformation',
    definition:
      '指 RBD 的两种空间状态：藏于刺突内的“下”构象与抬起的“上”构象。只有“上”构象能暴露结合面、与 ACE2 对接。',
    related: ['rbd', 'spike'],
  },
  {
    term: 'ACE2',
    termEn: 'Angiotensin-converting enzyme 2',
    definition:
      '宿主细胞表面的受体蛋白，是 SARS-CoV-2 刺突 RBD 的直接结合对象。它在气道、肺泡、肠道等上皮表达，决定病毒的主要侵入门户。',
    related: ['ace2'],
  },
  {
    term: 'TMPRSS2',
    termEn: 'Transmembrane serine protease 2',
    definition:
      '宿主细胞表面的丝氨酸蛋白酶。病毒结合 ACE2 后，它在刺突 S2′ 位点切割，暴露融合肽、触发质膜融合，是气道上皮等细胞中病毒进入的主路径。',
    related: ['tmprss2'],
  },
  {
    term: '弗林蛋白酶（furin）',
    termEn: 'Furin',
    definition:
      '宿主高尔基体中的蛋白酶。在“生产细胞”中于刺突 S1/S2 位点预切割 S 蛋白，使子代病毒携带“预激活”的刺突，从而增强感染力。',
    related: ['furin'],
  },
  {
    term: '组织蛋白酶 L',
    termEn: 'Cathepsin L',
    definition:
      '内体 / 溶酶体中的半胱氨酸蛋白酶。当病毒经内吞进入、TMPRSS2 不足时，它在酸化内体中激活刺突，介导内体途径的膜融合。',
    related: ['cathepsin-l', 'endosome'],
  },
  {
    term: 'S1/S2 与 S2′ 切割位点',
    termEn: 'S1/S2 and S2′ cleavage sites',
    definition:
      '刺突蛋白上的两处蛋白酶切位点。S1/S2 位点被 furin 在生产细胞中预切割；S2′ 位点被靶细胞表面的 TMPRSS2（或内体中的组织蛋白酶 L）切割，两次切割都完成才能解锁融合。',
    related: ['spike', 'furin', 'tmprss2'],
  },
  {
    term: '融合肽',
    termEn: 'Fusion peptide',
    definition:
      '刺突 S2 亚基上的一段疏水序列，在 S2′ 位点切割后暴露，插入宿主细胞膜，是启动膜融合的关键。',
    related: ['spike', 'fusion-pore'],
  },
  {
    term: '六螺旋束',
    termEn: 'Six-helix bundle',
    definition:
      '由 S2 的 HR1 与 HR2 反平行折叠形成的稳定结构，把病毒膜与细胞膜拉近，为膜融合提供能量，是 I 类病毒融合蛋白的通用机制。',
    related: ['spike', 'fusion-pore'],
  },
  {
    term: '膜融合',
    termEn: 'Membrane fusion',
    definition:
      '两层脂膜合并成一层的过程。病毒借此把自身囊膜与宿主细胞膜（质膜或内体膜）融合，把基因组释放进细胞质。',
    related: ['fusion-pore', 'host-membrane', 'spike'],
  },
  {
    term: '内体途径',
    termEn: 'Endosomal pathway',
    definition:
      '病毒经受体介导内吞进入细胞、在酸化内体中被组织蛋白酶 L 激活并融合的进入方式，是 TMPRSS2 低表达细胞中的备选路线。',
    related: ['endosome', 'cathepsin-l'],
  },
  {
    term: '脱衣壳',
    termEn: 'Uncoating',
    definition:
      '病毒基因组从衣壳 / 囊膜中释放出来的过程。对 SARS-CoV-2 而言，即膜融合后 +ssRNA–核糖核蛋白进入细胞质。',
    related: ['viral-rna', 'fusion-pore'],
  },
  {
    term: '核糖体',
    termEn: 'Ribosome',
    definition:
      '细胞质中的蛋白质合成机器。它识别病毒 RNA 的 5′ 帽，直接翻译 +ssRNA，病毒借此“劫持”宿主翻译系统。',
    related: ['ribosome'],
  },
  {
    term: '多聚蛋白 pp1a / pp1ab',
    termEn: 'Polyprotein pp1a / pp1ab',
    definition:
      '基因组 ORF1a / ORF1ab 的翻译产物，是所有复制酶的前体。pp1ab 需经 −1 核糖体移码产生，再被病毒蛋白酶切成 16 个 nsp。',
    related: ['pp1ab'],
  },
  {
    term: '非结构蛋白（nsp）',
    termEn: 'Non-structural protein',
    definition:
      '由多聚蛋白切割产生的 nsp1–nsp16，不进入病毒颗粒，而是承担复制、转录、膜重塑等功能，是抗病毒药物的重要靶点。',
    related: ['pp1ab'],
  },
  {
    term: 'RdRp（nsp12）',
    termEn: 'RNA-dependent RNA polymerase',
    definition:
      '非结构蛋白 nsp12，是复制病毒 RNA 的核心酶，与 nsp7/nsp8 组成聚合酶核心，负责合成 −RNA 中间体与新的 +RNA。',
    related: ['nsp12-rdrp'],
  },
  {
    term: '复制转录复合体（RTC）',
    termEn: 'Replication–transcription complex',
    definition:
      '以 RdRp 为核心、含解旋酶 nsp13、校对外切酶 nsp14 等多种蛋白的机器，在双膜囊泡内完成病毒 RNA 的复制与转录。',
    related: ['nsp12-rdrp', 'dmv'],
  },
  {
    term: '双膜囊泡（DMV）',
    termEn: 'Double-membrane vesicle',
    definition:
      '由 nsp3/nsp4/nsp6 诱导、源于内质网膜的双层膜囊泡，是病毒 RNA 合成的隔离“隔间”，可保护复制中间体免受宿主免疫识别。',
    related: ['dmv', 'er'],
  },
  {
    term: '亚基因组 mRNA',
    termEn: 'Subgenomic mRNA',
    definition:
      '通过不连续转录产生的一套 mRNA，3′ 端相同、5′ 端共享前导序列，分别翻译 S、E、M、N 及辅助蛋白。',
    related: ['sgrna'],
  },
  {
    term: '不连续转录',
    termEn: 'Discontinuous transcription',
    definition:
      '冠状病毒特有的转录方式：聚合酶在转录调控序列（TRS）处“跳转”，把前导序列与下游编码序列连接，生成嵌套的亚基因组 mRNA。',
    related: ['sgrna', 'minus-rna'],
  },
  {
    term: 'ERGIC',
    termEn: 'ER–Golgi intermediate compartment',
    definition:
      '内质网与高尔基体之间的膜区室，是冠状病毒新病毒颗粒出芽装配的主要场所。',
    related: ['ergic'],
  },
  {
    term: '胞吐',
    termEn: 'Exocytosis',
    definition:
      '细胞把包在囊泡内的物质与质膜融合、释放到胞外的过程。子代病毒即经分泌囊泡胞吐释放；近年证据还提示存在去酸化溶酶体外排路线。',
    related: ['secretory-vesicle', 'progeny-virion'],
  },
  {
    term: '滴度与复制周期',
    termEn: 'Titer and replication cycle',
    definition:
      '滴度指单位体积中具感染性病毒颗粒的数量。SARS-CoV-2 的完整复制周期约 8–12 小时（估计值），一个感染细胞约释放 10²–10³ 个病毒体。',
    related: ['progeny-virion'],
  },
]
