/**
 * 参考文献数据层。
 *
 * 只收录我高度确信真实存在、且被广泛引用的经典论文与综述。citation 仅写
 * “作者. 标题. 期刊 年份;卷(期):页.”形式的引文文本，绝不编造 DOI 或 URL；
 * 对不确定卷页的条目省略卷页，宁可少写也不造假。
 */

import type { Reference } from './types'

export const REFERENCES: Reference[] = [
  {
    label: 'Hoffmann 2020',
    citation:
      "Hoffmann M, Kleine-Weber H, Schroeder S, et al. SARS-CoV-2 cell entry depends on ACE2 and TMPRSS2 and is blocked by a clinically proven protease inhibitor. Cell 2020;181(2):271-280.e8.",
  },
  {
    label: 'Walls 2020',
    citation:
      "Walls AC, Park YJ, Tortorici MA, et al. Structure, function, and antigenicity of the SARS-CoV-2 spike glycoprotein. Cell 2020;181(2):281-292.e6.",
  },
  {
    label: 'Wrapp 2020',
    citation:
      "Wrapp D, Wang N, Corbett KS, et al. Cryo-EM structure of the 2019-nCoV spike in the prefusion conformation. Science 2020;367(6483):1260-1263.",
  },
  {
    label: 'Ke 2020',
    citation:
      "Ke Z, Oton J, Qu K, et al. Structures and distributions of SARS-CoV-2 spike proteins on intact virions. Nature 2020;588(7838):498-502.",
  },
  {
    label: 'Yao 2020',
    citation:
      "Yao H, Song Y, Chen Y, et al. Molecular architecture of the SARS-CoV-2 virus. Cell 2020;183(3):730-738.e13.",
  },
  {
    label: 'Klein 2020',
    citation:
      "Klein S, Cortese M, Winter SL, et al. SARS-CoV-2 structure and replication characterized by in situ cryo-electron tomography. Nat Commun 2020;11(1):5885.",
  },
  {
    label: "V'kovski 2021",
    citation:
      "V'kovski P, Kratzel A, Steiner S, et al. Coronavirus biology and replication: implications for SARS-CoV-2. Nat Rev Microbiol 2021;19(3):155-170.",
  },
  {
    label: 'Jackson 2022',
    citation:
      "Jackson CB, Farzan M, Chen B, et al. Mechanisms of SARS-CoV-2 entry into cells. Nat Rev Mol Cell Biol 2022;23(1):3-20.",
  },
  {
    label: 'Snijder 2020',
    citation:
      "Snijder EJ, Limpens RWAL, de Wilde AH, et al. A unifying structural and functional model of the coronavirus replication organelle: tracking down RNA synthesis. PLoS Biol 2020;18(6):e3000715.",
  },
  {
    label: 'Cortese 2020',
    citation:
      "Cortese M, Lee JY, Cerikan B, et al. Integrative imaging reveals SARS-CoV-2-induced reshaping of subcellular morphologies. Cell Host Microbe 2020;28(6):853-866.e5.",
  },
  {
    label: 'Wolff 2020',
    citation:
      "Wolff G, Limpens RWAL, Zevenhoven-Dobbe JC, et al. A molecular pore spans the double membrane of the coronavirus replication organelle. Science 2020;369(6509):1395-1398.",
  },
  {
    label: 'Ghosh 2020',
    citation:
      "Ghosh S, Dellibovi-Ragheb TA, Kerviel A, et al. β-Coronaviruses use lysosomes for egress instead of the biosynthetic secretory pathway. Cell 2020;183(6):1520-1535.e14.",
  },
  {
    label: 'Bar-On 2020',
    citation:
      "Bar-On YM, Flamholz A, Phillips R, et al. SARS-CoV-2 (COVID-19) by the numbers. eLife 2020;9:e57309.",
  },
  {
    label: 'Shang 2020',
    citation:
      "Shang J, Wan Y, Luo C, et al. Cell entry mechanisms of SARS-CoV-2. Proc Natl Acad Sci U S A 2020;117(21):11727-11734.",
  },
]
