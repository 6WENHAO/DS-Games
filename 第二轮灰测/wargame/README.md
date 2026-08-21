# 抵抗之弧 2026 · 三维兵棋推演

一个**零依赖单文件**的网页兵棋（wargame）：三维六角沙盘 + 回合制推演，模拟 **2026 年 8 月 20 日**（数据基准日）
美国／以色列 与 伊朗及"抵抗之弧"（真主党、伊拉克什叶派民兵、胡塞、哈马斯）之间的对抗态势。
你可以执掌任一方，逐回合下达打击 / 防空 / 海上封锁 / 网络战 / 政治决策，与 AI 对手推演到停战、崩盘或全面战争。

## 开箱即用

```
双击打开 index.html          # 无需服务器、无需联网、无第三方库（纯 WebGL2 + 原生 JS）
```

```bash
npm run build          # 由 src/* 重新生成单文件 index.html
npm test               # 推演内核测试（含 400 局 AI 对局的稳定性/平衡性校验）
npm run tune           # 批量对局的结局分布与终局指标分布（调参观测）
npm run test:browser   # 无头 Chrome 端到端验收（渲染像素/标签投影/指令/结算/多回合/移动端）
```

## 一、态势基准：截至 2026-08-20 的公开报道

> 说明：以下信息来自公开新闻检索结果（标题与日期级别），用于构造推演初始态势；
> 本机无外网抓取能力，未逐篇核对全文，**不构成情报评估**。数值均为可玩性抽象。

| 方向 | 公开报道要点 | 信源 |
| --- | --- | --- |
| 总体 | 美以伊冲突已持续约半年（"伊朗战争 2026"逐日更新至 6 月已达第 97 天），双方仍在互射，地区面临重回全面战争风险 | [The Hindu](https://www.thehindu.com/news/international/iran-missile-attacks-on-israel/article71074231.ece)、[GlobalSecurity 第97天](https://www.globalsecurity.org/military/ops/iran-war-20260604.htm) |
| 停火 | 伊朗拒绝"临时停火"，要求"彻底结束战争"，并把终战与停止全线（含代理人战线）军事行动挂钩；伊方指以色列破坏停火安排 | [中国网 8-19](http://big5.china.com.cn/gate/big5/news.china.com.cn/2026-08/19/content_118655030.shtml)、[PressTV 8-20](https://www.presstv.co.uk/Detail/2026/08/20/774714/Why-Iran-links-any-war-ending-deal-to-ending-US-Israeli-aggression-across-all-fronts)、[Saudi Gazette](https://saudigazette.com.sa/article/663838/world/irans-foreign-minister-accuses-israel-of-sabotaging-ceasefire-deal-with-us) |
| 核问题 | IAEA 要求伊朗全面配合、开放设施并交出高浓铀；伊朗拒绝在最终协议前让核查人员进入被炸设施；谈判卡在"美方高浓铀接收机制" | [星島 6-10](https://www.singtaousa.com/2026/06/10/news/world/the-united-nations-nuclear-watchdog-urges-iran-to-fully-cooperate-with-inspections-and-requires-it-to-open-its-nuclear-facilities-and-hand-over-its-enriched-uranium-stockpile/)、[PressTV 6-24](https://www.presstv.co.uk/Detail/2026/06/24/771016/Iran-rules-out-immediate-IAEA-access-to-bombed-nuclear-sites-says-inspections-tied-to-final-deal)、[The New Arab](https://www.newarab.com/news/iran-refuses-allow-iaea-access-nuclear-facilities) |
| 导弹/拦截 | 美情报评估伊朗仍保有约 **70%** 导弹库存（伊方否认）；另有报道称美军为保卫以色列已消耗约 **一半** 拦截弹库存 | [The New Arab](https://www.newarab.com/news/us-intelligence-says-iran-retains-70-missile-arsenal)、[Kurdistan24](https://www.kurdistan24.net/en/story/912802/irans-fm-rejects-us-intelligence-assessment-on-missile-capabilities)、[Zee News](https://zeenews.india.com/world/us-depleted-half-of-pentagons-missile-interceptors-defending-israel-report-3049461.html) |
| 美军部署 | USS George Washington 已在中东展开行动（替换长期部署航母）；地区维持约 5 万军事人员；中央司令部否认推动新一轮打击 | [APA](https://en.apa.az/america/uss-george-washington-begins-operations-in-middle-east-521035)、[Ahram](https://english.ahram.org.eg/UI/Front/Inner.aspx?NewsContentID=574977)、[WION](https://www.wionews.com/photos/50-000-military-personnel-why-has-the-us-deployed-soldiers-in-the-middle-east-1768247608446)、[中評社](http://hk.crntt.tw/touch/detail.jsp?coluid=4&kindid=0&docid=107223994) |
| 黎巴嫩 | 黎以美三方框架把停火与真主党解武挂钩，真主党强调不放弃武装；8-08 罗马会谈在边界/战俘/解武上"有进展" | [Al Jazeera 6-27](https://www.aljazeera.com/amp/features/2026/6/27/israel-lebanon-deal-ties-ceasefire-to-hezbollah-disarmament-will-it-work)、[文匯報](https://www.wenweipo.com/a/202606/27/AP6a3fa268e4b0b49ad1c10b7a.html)、[CGTN 8-08](https://news.cgtn.com/news/2026-08-08/Lebanon-says-positive-progress-made-in-Rome-talks-with-Israel-1PqS9QGqnXa/p.html) |
| 伊拉克 | 政府推进民兵武装整合，部分亲伊民兵表示将交出武器；同时有报道称"伊斯兰阵线"仍在、民兵活动回升 | [央视 6-07](https://news.qq.com/rain/a/20260607A02SJX00)、[AP](https://apnews.com/article/iraq-iran-us-shiite-militia-asaib-ahl-alhaq-0f1747e05dc1384ab988da4d8eb74008)、[JPost](http://fr.jpost.com/middle-east/article-880091) |
| 两处咽喉 | 霍尔木兹航运持续受限、油价被推高，美军加强巡逻；也门方向 8-18 一港口遇袭致海上作业全面暂停，胡塞被指图谋曼德海峡沿岸 | [Sprague](https://www.spragueenergy.com/oil-prices-rally-as-us-iran-tensions-escalate-and-strait-of-hormuz-shipping-remains-restricted/)、[Indian Express](https://indianexpress.com/article/world/strait-of-hormuz-us-iran-shipping-kpler-data-trump-oil-prices-10840168/)、[sol 8-18](https://news.sol.com.cn/html/2026-08-18/A4C237D28726ACACD.shtml)、[Times of Israel](https://www.timesofisrael.com/houthis-planning-to-seize-vital-bab-el-mandeb-strait-yemen-government-warns/) |
| 降温线索 | 叙利亚过渡当局称正与以色列谈安全协议；加沙停火进入第二阶段路线图，哈马斯重申履约 | [Al Jazeera 7-26](https://www.aljazeera.com/amp/news/2026/7/26/president-ahmed-al-sharaa-syria-seeking-security-deal-with-israel)、[中国网 8-19](http://www.china.org.cn/2026-08/19/content_118654034.shtml) |

上述内容在应用内以「情报简报」弹窗呈现，每条都带可点击的原文链接。

## 二、推演怎么玩

**回合结构**：每回合 = 7 天，共 16 回合。`下达指令 → 结算（动画）→ 政治决策 → 判定`。
双方各 27 个作战单元（航空兵、战略轰炸、弹道导弹旅、无人机、防空反导、海军、地面、网络/特战），每单元每回合 1 条指令。

**可用指令**：精确打击、饱和齐射、压制防空(SEAD)、布雷封锁、护航扫雷、地面突袭、网络攻击、破袭暗杀、强化防空、抢修加固、补给整备、转场机动、待机隐蔽。

**四条核心机制**（都对应现实报道）：

1. **饱和齐射 vs 拦截弹存量** —— 齐射弹量 ×1.7、精度下降，但会成倍消耗对手拦截弹；拦截弹见底会传导为社会承受力与国内支持下滑（对应"美军拦截弹已消耗约一半"的报道）。
2. **深埋目标只能用钻地弹** —— 福尔多硬度 3，常规空袭伤害系数仅 0.18，只有具备 GBU-57 的 B-2 编队（全场仅 2 发弹药）能有效破坏。实测：B-2 单次均增伤 ≈13，常规空袭 ≈3.6。
3. **谈判上限被双方红线锁死** —— 谈判进度上限 = 45 +（蓝方"承诺停止深度打击" +20）+（红方"接受高浓铀移交机制" +20）+ …。两条红线都不让步，谈判永远到不了 80 的停战线，正对应公开报道里的"结构性僵局"。
4. **代理人有政治状态** —— 真主党处于"解武压力"（开火即损害黎巴嫩政治进程）、伊拉克民兵"整合中"（有 40% 概率拒绝执行）、哈马斯"停火中"（动用即打破停火、人道压力与谈判重挫）。

**升级阶梯**：0–9 级衡量"溢出为全面战争"的风险。日常互射不推高阶梯，只有斩首/首都、民用核电站、驻军基地重创、封锁海峡、油气终端等**质变动作**才会。第 10 级（全面战争）只能由显式政治决策「跨过门槛」触发 —— AI 永不主动选择，玩家可以，结局是双方皆负。

**胜负条件**（六种结局）：

| 结局 | 条件 |
| --- | --- |
| 蓝方军事胜利 | 核指数 ≤15 且 红方导弹存量 ≤30% |
| 蓝方施压胜利 | 伊朗政权凝聚力 ≤15 且 核指数 ≤40 |
| 蓝方政治胜利 | 谈判 ≥80 且 高浓铀移交机制生效且核指数 ≤45 |
| 红方军事胜利 | 核指数 ≥95（突破）或 以色列社会承受力 ≤25 |
| 红方政治胜利 | 美国国内支持 ≤30，或 油价 ≥135 且阿拉伯国家立场 ≤-25 |
| 停战和局 / 灾难 | 谈判 ≥80 且双方红线同时让步（停战协议）／ 有一方跨过全面战争门槛 |

回合用尽则按 13 项战略指标计分。

**操作**：左键拖动旋转视角，右键或 Shift 拖动平移，滚轮缩放；点击棋子或右侧兵力表选中单位 → 选指令 → 在目标列表或地图上点目标；「参谋部代拟」可一键为未下令单位拟定指令。

## 三、实现

```
index.html          构建产物：单文件应用（直接打开）
build.mjs           把 src/* 内联为单文件
src/scenario.js     情景数据：地图(12×15 六角格/148 格)、27 个要点、27 个作战单元、
                    13 项战略指标、16 张态势事件牌、双方各 8 张政治行动牌、情报简报与信源
src/engine.js       推演内核（纯逻辑，可在 Node 跑）：指令合法性、分层防空拦截判定、
                    伤害与政治传导、升级阶梯、谈判上限、事件牌、AI 规划、胜负判定
src/render3d.js     纯 WebGL2 三维沙盘：六角棱柱地形、要点标记、双方棋子、弹道抛物线、
                    拦截闪光、拾取与三维→屏幕投影
src/ui.js           指令面板、指标仪表盘、战报日志、结算动画编排、弹窗
tests/              内核测试 / 调参观测 / 渲染诊断 / 浏览器端验收 / PNG 分析
```

**AI**：按指标选择姿态（强攻/消耗/固守/谈判倾向），对每个 (单位 × 指令 × 目标) 组合打分贪心分配；
政治阶段按姿态选牌（谈判姿态会优先打出尚未使用的"红线让步"牌）。整局用固定种子的 mulberry32，可复盘。

## 四、验证结果

**内核**（`npm test`）：地图与要点几何自检（特拉维夫在德黑兰以西、霍尔木兹与阿巴斯港相邻等）、
指令合法性（防空单位不能主动打击、航母只能在海域机动、真主党射程覆盖特拉维夫但覆盖不到德黑兰）、
钻地弹机制、齐射消耗拦截弹、谈判上限随红线让步提升且不可突破、代理人破停火的政治代价、
**同种子完全可复盘**，以及 400 局 AI 对局：

```
400 局用时 ~0.6s，结局分布 {"blue":165,"red":147,"draw":88,"none":0}
判定类型 {"points":284,"blueMil":21,"blueCohesion":39,"deal":46,"redOil":10}
```

即双方胜率 ~41% / ~37%，和局 22%，出现 5 类不同结局，全部对局正常终止、指标无 NaN。

**浏览器端**（`npm run test:browser`，无头 Chrome + CDP，共 30 项断言全绿）：
WebGL2 无错误码；**148/148 个六角格真的被绘制**（readPixels 逐格采样）；
**按国别采样地形颜色验证地理着色**（海域偏蓝、伊朗偏暖红、海湾为浅荒漠色、区域间颜色可区分）；
53 个 HTML 标签全部正确投影在视口内；指令下达（B-2 → 福尔多）与地图拾取；
结算动画有像素级证据（与基线对比 3400+ 差异像素）；一回合双方 7 次打击/发射 62 枚/被拦 49 枚；
连续推进 10 回合无异常、日志 90 条；可切换红方下达饱和齐射；414×896 移动端布局不溢出；无 console 错误与未捕获异常。

开发中由这套验收查出并修复的真实缺陷：**六角棱柱顶面绕序反了**（顶面被背面剔除，只剩侧壁在渲染）、
**初始相机取景没有覆盖整幅地图**（红海/阿拉伯海在视野外）、以及三轮平衡问题
（升级阶梯瞬间爆表 → 改为质变驱动；拦截弹消耗过快；一方胜率 99% → 加入意志侵蚀上限、自然回复与合法性代价）。

## 五、免责声明

本项目是**推演/教学玩具**，不是预测工具，也不代表任何一方立场。
所有兵力、指标、概率与结局判定都是为了呈现"约束与取舍"（拦截弹够不够、钻地弹几发、
封锁海峡的经济反噬、代理人参战的政治代价、红线不让步就谈不成），而非对现实战力的评估。
