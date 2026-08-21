# 科学依据与准确性说明

> 本文档供评审专家审阅，说明本 3D 交互演示的分子机制依据、刻意规避的常见错误、
> 可视化中的比例与时间夸张，以及两条进入途径的表述方式。
> 数据与参考文献与 `src/data/references.ts` 保持一致，全文不写任何 DOI / URL，
> 以免出现无法核验的链接。

---

## 一、感染机制分步说明（对应 8 个演示步骤）

### 第 1 步：病毒整体结构（Virion Architecture）

SARS-CoV-2 是**囊膜病毒**。病毒体直径约 **60–140 nm**，外层是源自宿主细胞膜的脂质
囊膜，镶嵌三种跨膜结构蛋白：

- **刺突蛋白（S）**：同源三聚体，是病毒最显眼的结构，负责识别受体并介导膜融合；
  每个病毒体约 **24–40 个**三聚体（冷冻电镜数据，Ke 2020；Yao 2020）。
- **膜蛋白（M）**：含量最丰富、三次跨膜，是结构的“骨架”与装配的组织者。
- **包膜蛋白（E）**：最小、含量少，具离子通道活性（viroporin），参与成熟与释放。

囊膜内，**核衣壳蛋白（N）** 与基因组 RNA 结合成螺旋核糖核蛋白（RNP）。基因组是
**正义单链 RNA（+ssRNA）**，约 **29.9 kb**（参考株 29,903 nt），5′ 端带帽、3′ 端带
poly(A)。

### 第 2 步：病毒接近细胞（Approach & Attachment）

病毒随气流抵达气道上皮，靠近靶细胞。刺突的 **受体结合域（RBD）** 在“下（隐藏）”
与“上（暴露）”构象之间动态切换，只有抬起进入“上”构象才能暴露结合面，与细胞表面的
**ACE2** 对接。

### 第 3 步：S 蛋白结合 ACE2（Receptor Binding）

RBD 的受体结合基序（RBM）与 ACE2 肽酶结构域 N 端形成由氢键、疏水接触维系的紧密界面。
这一结合高度特异，决定了病毒的宿主范围与组织嗜性，也是多数中和抗体与疫苗设计的靶点。
结合会诱发刺突构象变化，为后续切割做准备。

### 第 4 步：TMPRSS2 切割与膜融合（Priming & Membrane Fusion）

进入需要**两次蛋白酶切割**：

1. **S1/S2 位点**：已在**生产细胞**（被感染的细胞）中由高尔基体里的 **furin** 预切割，
   使子代病毒携带“预激活”的刺突。SARS-CoV-2 此处的多碱基切割位点是其高效传播的
   结构基础之一。
2. **S2′ 位点**：在**靶细胞**表面由 **TMPRSS2** 切割，暴露**融合肽**。

融合肽插入宿主细胞膜后，S2 亚基的 **HR1 与 HR2 反平行折叠成六螺旋束**，释放的能量把
病毒膜与宿主膜拉近，形成**融合孔**，完成膜融合。

### 第 5 步：病毒 RNA 释放（Genome Release / Uncoating）

融合孔扩大，囊膜融入细胞膜，+ssRNA 与 N 蛋白组成的核糖核蛋白被释放进**细胞质**。
RNA 两端结构仿若宿主 mRNA，可立即被核糖体识别翻译。**病毒 RNA 全程不进入细胞核。**

### 第 6 步：翻译与基因组复制（Translation & Replication）

1. 核糖体直接翻译 +ssRNA，先得到多聚蛋白 **pp1a**；在滑移序列处发生 **−1 核糖体移码**
   后继续翻译 ORF1b，得到更长的 **pp1ab**。
2. 多聚蛋白被 **PLpro（nsp3）与 3CLpro/Mpro（nsp5）** 切割成 **16 个非结构蛋白（nsp）**。
3. **nsp12（RdRp）** 与 **nsp7/nsp8** 组成聚合酶核心，与 nsp13 解旋酶、nsp14 校对外切酶
   等构成**复制转录复合体（RTC）**。
4. 复制发生在 **nsp3/nsp4/nsp6 诱导的双膜囊泡（DMV）** 内：先合成 **−RNA 中间体**，
   再以其为模板合成新的 +RNA。
5. 转录通过**不连续转录**产生一套**嵌套的亚基因组 mRNA**，翻译 S、E、M、N 及辅助蛋白。

### 第 7 步：新病毒在 ERGIC 装配（Assembly at ERGIC）

S、E、M 蛋白在内质网（ER）合成并插膜，经分泌通路运输到 **ERGIC**。**M 蛋白主导装配**，
招募 N–RNA 核衣壳向 ERGIC 腔出芽，形成新的囊膜病毒体。

### 第 8 步：胞吐释放子代病毒（Egress by Exocytosis）

装配完成的子代病毒被包进分泌囊泡，沿微管运向质膜，与质膜融合后释放。近年证据还提示
β 冠状病毒可经**去酸化的溶酶体**外排（Ghosh 2020），本演示以此作为“前沿说明”提及并标注
证据强度。一个感染细胞约释放 **10²–10³** 个病毒体（估计值），完整复制周期约 **8–12 小时**
（估计值）。

---

## 二、本项目刻意规避的常见错误

| 常见错误 | 本项目表述 |
| --- | --- |
| 病毒基因组是 DNA 双螺旋 | 基因组是**正义单链 RNA（+ssRNA）**，约 29.9 kb，不是 DNA |
| 病毒 RNA 进入细胞核复制 | 复制与转录**全程在细胞质**完成，细胞核仅作背景对照并标注“病毒不进入” |
| 病毒体是光滑球体 | 病毒体表面布满刺突三聚体，**刺突必须画出**，形状不规则 |
| 膜融合发生在细胞核膜 | 融合发生在**质膜**（TMPRSS2 途径）或**内体膜**（组织蛋白酶 L 途径） |
| 只有一次切割 | 进入需要 **S1/S2（furin 预切割）与 S2′（TMPRSS2 切割）两次切割** |
| 病毒直接“撑破”细胞爆裂释放 | 释放以**胞吐**为主，细胞在一段时间内持续产毒 |
| 病毒是“聪明”的生命体 | 使用“分子机器”“像钥匙插入锁”等类比，避免过度拟人化 |

---

## 三、可视化取舍与比例夸张说明

本演示面向科普与教学。**尺度约定：1 个世界单位 = 50 nm**（见 `src/three/palette.ts` 的
`SCALE` 常量，所有换算集中在那一处）。为让关键结构可辨识，对比例、数量与时间做了如下
取舍 —— 以下清单与代码实现逐条对应，未列出的部分均按真实相对尺度绘制：

**按真实相对尺度绘制的部分**

- **病毒体囊膜外半径 45 nm**（直径 90 nm，落在真实 60–140 nm 区间内）。
- **刺突三聚体高 25 nm、头部宽约 12.5 nm**（真实约 25 nm / 14 nm）。
- **每个病毒体 30 个刺突三聚体**，落在冷冻电镜观测到的 **24–40** 区间内 —— 刺突数量
  **没有**被简化，这一点由自动化自检逐帧核对（见下文第六节）。子代病毒每颗绘制 24 个
  （取区间下限，兼顾远景性能）。
- **ACE2 胞外区高 15 nm、TMPRSS2 胞外区高 13 nm**、**80S 核糖体直径 25 nm**、
  **双膜囊泡 DMV 直径 200 nm**（真实 200–350 nm）—— 均为真实尺度。

**被刻意放大的部分（放大系数写进代码常量，可核查）**

- **膜厚与磷脂尺寸放大 2 倍**：真实脂双层约 5 nm 厚、磷脂头部直径约 0.8 nm，
  严格按比例时在"能看清整个病毒体"的镜头下磷脂头部不足一个像素。因此统一乘以
  `MEMBRANE_EXAGGERATION = 2`，并**保持头部直径与膜厚约 1:6 的比例不变**，
  使"双分子层"的结构关系仍然正确。
- **RNA 链径放大约 2.5 倍**：真实 ssRNA 直径约 1 nm，画面中按 2.5 nm 绘制，
  否则在细胞质全景镜头里会细到看不见。链上的"念珠"起伏是核苷酸的示意，
  **不是**双螺旋。
- **膜表面受体密度是示意值**：画面在约 1.5 µm 见方的膜片上放置约 24 个 ACE2 与
  15 个 TMPRSS2，真实密度因细胞类型而异且通常更低/分布不均；此处只保留叙事所需数量。
- **细胞质中的分子数量被大幅简化**：真实细胞质高度拥挤（画面用密集漂浮颗粒示意），
  核糖体、nsp、囊泡等都只保留代表性个体。

**已知的示意性处理（重要，请评审注意）**

- **S2′ 切割的空间可达性**：在"病毒已结合 ACE2、刺突直立"的构型下，S2′ 位点距宿主膜
  约 20–25 nm，而 TMPRSS2 的催化结构域只在膜上约 12 nm 处，两者尚有约 10 nm 差距。
  真实体系依靠**刺突柄部三个柔性铰链的大幅摆动**（Turoňová 等的冷冻电子断层成像显示
  刺突可大角度倾倒）与膜的局部形变来完成接触。为让观众看清"切割"这一关键事件，
  本演示把 TMPRSS2 的**柔性茎（LDLRA–SRCR 连接区）画成可伸出的连接体**，
  让催化结构域主动接近 S2′ 位点。这是**示意性表达**，不代表真实的结构域伸缩幅度。
- **膜融合过程被放慢并加长**：真实融合在毫秒–秒级完成，画面按数秒展示"前发夹中间体
  → 六螺旋束折叠 → 半融合 → 融合孔"的顺序，以便逐步观察。
- **分子形态为程序化重建**：几何按已发表的尺寸、对称性与结构域组成生成，**不是**原子
  坐标级模型，不能用于结构分析。
- **时间被压缩**：真实复制周期约 **8–12 小时**，本演示以约 3 分钟的自动播放概括；
  `durationSec` 只是播放节奏参数，不代表生物学时间。

---

## 四、两条进入途径的说明

SARS-CoV-2 有两条进入途径，本演示**以质膜途径为主线**，并明确提及内体途径：

1. **质膜途径（主线）**：在 **TMPRSS2 高表达**的细胞（如气道上皮），病毒结合 ACE2 后，
   TMPRSS2 在细胞表面切割 S2′ 位点，直接在**质膜**上融合进入。
2. **内体途径（备选）**：当细胞表面 TMPRSS2 不足时，病毒经**受体介导内吞**进入，
   在**酸化内体**中被**组织蛋白酶 L** 激活，与**内体膜**融合进入。

关于氯喹 / 羟氯喹：这类药物可升高内体 pH、抑制依赖低 pH 的蛋白酶，**体外**能阻断内体
途径；但在 TMPRSS2 高表达的气道上皮中，质膜途径占主导，这被认为是这类药物**体内**效果
不佳的可能原因之一。本演示对此**谨慎表述**：明确区分“体外有效”与“体内效果存争议”，
不做出治疗性结论。

---

## 六、科学不变量的自动化核对

本项目把"不能画错的事"写成了**可执行的断言**，而不是只写在文档里。
因为场景中每个物体的状态都是播放头位置的纯函数，所以可以把整片时间轴（p 从 0 扫到 8，
共 160 个采样点）逐点回放并检查。运行方式：

```
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\acceptance.ps1
```

或直接在浏览器打开 `/?selftest=1` 查看逐项结果。当前核对项：

| 检查项 | 判定依据 |
| --- | --- |
| 几何数值健全 | 全场景无 NaN 位置 / 包围球 |
| 膜融合前病毒体完整留在细胞外 | 病毒体底面始终高于质膜外表面 |
| **病毒 RNA 全程不进入细胞核** | 核衣壳与全部 RNA 控制点到核心的距离 > 核半径 + 安全边界 |
| 脱衣壳后基因组位于细胞质一侧 | 基因组全部控制点在质膜以下 |
| 融合孔时序正确 | 切割前孔径为 0、第 5 步开启、随后闭合 |
| 刺突数量在观测区间内 | 24 ≤ 每病毒体刺突数 ≤ 40 |
| 基因组为单链单管 | 一条连续曲线；−义模板与子代 +RNA 各自独立成链 |
| 渲染预算 | 峰值三角形与绘制调用在预算内（保障帧率） |

配套的 `scripts/analyze-shot.mjs` 还会解码八个步骤的截图，统计画面亮度与
四种约定配色（刺突橙红 / ACE2 青蓝 / RNA 荧光绿 / TMPRSS2 紫）的像素占比，
把"配色语义有没有传达到"也变成可比对的数字。

---

## 五、参考文献列表

> 与 `src/data/references.ts` 一致，仅列被广泛引用的经典论文 / 综述，不写 DOI / URL。

1. Hoffmann M, Kleine-Weber H, Schroeder S, et al. SARS-CoV-2 cell entry depends on ACE2 and TMPRSS2 and is blocked by a clinically proven protease inhibitor. Cell 2020;181(2):271-280.e8.
2. Walls AC, Park YJ, Tortorici MA, et al. Structure, function, and antigenicity of the SARS-CoV-2 spike glycoprotein. Cell 2020;181(2):281-292.e6.
3. Wrapp D, Wang N, Corbett KS, et al. Cryo-EM structure of the 2019-nCoV spike in the prefusion conformation. Science 2020;367(6483):1260-1263.
4. Ke Z, Oton J, Qu K, et al. Structures and distributions of SARS-CoV-2 spike proteins on intact virions. Nature 2020;588(7838):498-502.
5. Yao H, Song Y, Chen Y, et al. Molecular architecture of the SARS-CoV-2 virus. Cell 2020;183(3):730-738.e13.
6. Klein S, Cortese M, Winter SL, et al. SARS-CoV-2 structure and replication characterized by in situ cryo-electron tomography. Nat Commun 2020;11(1):5885.
7. V'kovski P, Kratzel A, Steiner S, et al. Coronavirus biology and replication: implications for SARS-CoV-2. Nat Rev Microbiol 2021;19(3):155-170.
8. Jackson CB, Farzan M, Chen B, et al. Mechanisms of SARS-CoV-2 entry into cells. Nat Rev Mol Cell Biol 2022;23(1):3-20.
9. Snijder EJ, Limpens RWAL, de Wilde AH, et al. A unifying structural and functional model of the coronavirus replication organelle: tracking down RNA synthesis. PLoS Biol 2020;18(6):e3000715.
10. Cortese M, Lee JY, Cerikan B, et al. Integrative imaging reveals SARS-CoV-2-induced reshaping of subcellular morphologies. Cell Host Microbe 2020;28(6):853-866.e5.
11. Wolff G, Limpens RWAL, Zevenhoven-Dobbe JC, et al. A molecular pore spans the double membrane of the coronavirus replication organelle. Science 2020;369(6509):1395-1398.
12. Ghosh S, Dellibovi-Ragheb TA, Kerviel A, et al. β-Coronaviruses use lysosomes for egress instead of the biosynthetic secretory pathway. Cell 2020;183(6):1520-1535.e14.
13. Bar-On YM, Flamholz A, Phillips R, et al. SARS-CoV-2 (COVID-19) by the numbers. eLife 2020;9:e57309.
14. Shang J, Wan Y, Luo C, et al. Cell entry mechanisms of SARS-CoV-2. Proc Natl Acad Sci U S A 2020;117(21):11727-11734.

---

## 附：关键数字汇总（保守取值）

| 项目 | 数值 | 备注 |
| --- | --- | --- |
| 病毒体直径 | 约 60–140 nm | 区间取值 |
| 刺突高度 | 约 25 nm | 近似值 |
| 刺突三聚体数 | 约 24–40 个 / 病毒体 | 冷冻电镜数据 |
| 基因组长度 | 约 29.9 kb（29,903 nt） | 参考株 |
| 磷脂头部直径 | 约 0.8 nm | 画面中被放大 |
| 单细胞释放量 | 约 10²–10³ 个病毒体 | 估计值 |
| 复制周期 | 约 8–12 小时 | 估计值 |
