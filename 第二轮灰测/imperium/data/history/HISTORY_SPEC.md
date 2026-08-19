# 历史书签数据规范 (HISTORY_SPEC)

为 0–1600 年大战略游戏撰写**史实政权数据**。每个时代书签必须覆盖全球 **200+ 个政权**（文明/部落/城邦/国家）。
你的任务是**一个地理区域 × 全部 12 个书签**。

## 书签年份

`1, 200, 400, 600, 800, 1000, 1100, 1200, 1300, 1400, 1500, 1600`（公元年）

## 文件格式

按「区域 + 年份」分文件，便于并行：`imperium/data/history/hist.<scope>.<year>.json`

```json
{
  "scope": "europe_west",
  "year": 400,
  "polities": [
    {
      "tag": "WRE",
      "zh": "西罗马帝国", "en": "Western Roman Empire",
      "gov": "imperial", "rank": 5,
      "cap": "roma", "religion": "chalcedonian", "culture": "roman",
      "tech_group": "mediterranean", "adm": 9, "dip": 8, "mil": 10,
      "color": "#a83232",
      "own": ["gaul", "hispania", "italia", "africa_north"],
      "ownProv": ["britannia_londinium"],
      "vassal": ["FRA", "BUR"], "tributary": [],
      "desc": "西部帝国，日耳曼诸族正在边境积聚。"
    }
  ],
  "characters": [
    {"id": "WRE.honorius", "tag": "WRE", "name": "霍诺留", "dyn": "狄奥多西王朝",
     "born": 384, "role": "ruler", "traits": ["craven", "arbitrary"]},
    {"id": "WRE.stilicho", "tag": "WRE", "name": "斯提里科", "dyn": "—",
     "born": 359, "role": "heir", "traits": ["brilliant_strategist", "just"]}
  ]
}
```

## 字段说明（polity）

| 字段 | 说明 |
|---|---|
| `tag` | 全局唯一，大写 ASCII（2–4 字母，可用数字）。易混淆的加后缀：如 `BYZ`（拜占庭）、`BOL`（玻利瓦尔不适用）。同文明跨书签**必须沿用同一 tag**（如罗马帝国 `ROM` 在 1 年与 400 年同 tag）。 |
| `zh` / `en` | 中文名 / 拉丁名。用史学通行译名（`东罗马帝国/拜占庭帝国`、`法兰克王国`、`塞尔柱帝国`、`室町幕府`、`阿兹特克帝国`）。 |
| `gov` | 取自 `data/vocab.json` 的 `governments`（不可新增）。 |
| `rank` | 1–5（领/郡/公/王/帝），对应规模与头衔。 |
| `cap` | 首都省份 id（必须存在于 `data/provinces/*.json`）。 |
| `religion` / `culture` | 州府层面主流宗教/文化 id。宗教必须取自 vocab `religions`；文化取自 vocab 或省份文件 `cultures`。 |
| `tech_group` | 取自 vocab `techGroups`。 |
| `adm`/`dip`/`mil` | 行政/外交/军事科技 0–32。**必须贴合下表的史实轨道**（引擎用同一张表约束进度）。 |

### 科技史实轨道（引擎 `TECH_CURVES`，锚点年份 0/400/800/1000/1200/1400/1600）

| 科技组 | 0 | 400 | 800 | 1000 | 1200 | 1400 | 1600 |
|---|---|---|---|---|---|---|---|
| `mediterranean` 地中海古典 | 8 | 8 | 7 | 7 | 8 | 10 | 13 |
| `western` 西欧 | 3 | 4 | 5 | 7 | 10 | 14 | 22 |
| `eastern_orthodox` 东正教圈 | 7 | 8 | 8 | 8 | 9 | 12 | 16 |
| `muslim` 伊斯兰圈 | 4 | 5 | 8 | 9 | 11 | 14 | 18 |
| `chinese` 东亚 | 5 | 6 | 8 | 10 | 12 | 15 | 20 |
| `indian` 印度 | 4 | 5 | 6 | 7 | 9 | 12 | 16 |
| `steppe` 草原游牧 | 2 | 3 | 4 | 5 | 7 | 8 | 11 |
| `african` 撒哈拉以南 | 2 | 2 | 3 | 4 | 5 | 6 | 8 |
| `mesoamerican` 中美洲 | 1 | 2 | 2 | 3 | 4 | 5 | 7 |
| `andean` 安第斯 | 1 | 2 | 2 | 3 | 4 | 5 | 7 |
| `north_american` 北美 | 1 | 1 | 2 | 2 | 2 | 3 | 4 |
| `oceanic` 大洋洲 | 0 | 1 | 1 | 1 | 2 | 2 | 3 |
| `siberian` 北亚 | 1 | 1 | 2 | 2 | 3 | 3 | 4 |

写数据时：取该书签年份在表中的插值作为基准，再按国力微调 **±2**（强国如唐、阿拔斯、拜占庭、宋、奥斯曼、明可 +1~+2；衰弱或边缘政权 −1~−2）。
三项之间也应有差异（如威尼斯 `dip` 高、蒙古 `mil` 高、宋 `adm` 高）。
| `color` | 可选，`#rrggbb`。缺省时由合并器按 tag 自动分配稳定颜色。 |
| `own` | 拥有的**区域(region)** id 列表（region 已含其下全部 area→省份）。 |
| `ownArea` | 拥有的**部分 area** id 列表（不整 region 时用）。 |
| `ownProv` | 个别省份 id（微调边界、飞地、单城邦）。 |
| `vassal` / `tributary` | 附庸/朝贡国 tag 列表（必须在同一书签内存在）。 |
| `suzerain` | 可选，本政权的宗主 tag（与 vassal 互指）。 |
| `desc` | 一句话（≤30 字）背景。 |
| `island` | 可选，完全在岛上的政权标 `true`（供校验岛不落水用，可省略）。 |

**疆域表达**：优先用 `own`（整 region）。跨 region 的用 `ownArea`；碎片用 `ownProv`。
三者合并求并集。例：400 年西罗马 `own:["italia","hispania","gaul","britannia_south"], ownArea:["africa_proconsularis"], ownProv:["danube_pannonia"]`。

## 字段说明（character）

| 字段 | 说明 |
|---|---|
| `id` | `tag.name` 全局唯一。 |
| `name` / `dyn` | 中文名 / 王朝名（可用「—」表示无）。 |
| `born` | 出生年（公元）。引擎据此算年龄；书签年早于 born 的角色会被跳过。 |
| `role` | `ruler`（统治者，每政权至多一个）/ `heir`（继承人）/ `consort`（配偶）/ `courtier`。 |
| `traits` | 0–4 个特质 id（见下表）。 |

每个政权**必须给 ruler**（有史可考的真名优先；无考据的可用该文化的典型名，如「第 N 代酋长」可写民族风格名）。
heir/consort 尽力而为，ruler 必填。

## 特质（traits，id 固定）

`brilliant_strategist 天才统帅` `tough_soldier 猛将` `skilled_tactician 良将` `craven 怯懦`
`genius 天才` `quick 聪慧` `slow 愚钝` `shrewd 精明` `just 公正` `arbitrary 专断`
`brave 勇敢` `cruel 残暴` `kind 仁厚` `greedy 贪婪` `charitable 慷慨` `diligent 勤勉`
`lazy 怠惰` `proud 骄傲` `humble 谦逊` `zealous 狂热` `cynical 犬儒` `temperate 节制`
`gluttonous 饕餮` `deceitful 狡诈` `honest 诚实` `ambitious 野心勃勃` `content 知足`
`paranoid 多疑` `trusting 轻信` `lustful 好色` `chaste 贞洁` `scholar 学者`
`poet 诗人` `theologian 神学家` `administrator 能臣` `architect 营造家` `diplomat 外交家`
`steward 理财家` `duelist 决斗者` `drunkard 酒徒` `lunatic 癫狂` `possessed 附魔`
`berserker 狂战士` `pious 虔诚` `erudite 博学` `gregarious 合群` `shy 孤僻`

## 数量与史实要求

- **每书签、全球合计 ≥ 200 政权**（含部落/城邦/汗国/王国/帝国/神权国/共和城邦）。你的区域贡献配额见任务。
- 同一区域在 12 个书签间的政权应体现真实兴衰更替：罗马兴衰、日耳曼诸王国建立、伊斯兰扩张、法兰克/拜占庭、塞尔柱/蒙古、黑死病、文艺复兴、大航海、宗教改革、明清更替、帖木儿/奥斯曼/萨法维/莫卧儿、日本南北朝/战国/江户、东南亚诸王国、非洲诸帝国、美洲三大文明、大洋洲部落联盟。
- **科技/发展/疆域要符合史实**：别把 800 年的法兰克画成 1600 年的法国疆域；别让阿兹特克有 1600 年的欧式科技。

## 校验

```
cd H:\Deepseek\0813h\grey0819ck\imperium
node tools/checkhist.mjs --scope europe_west
node tools/buildbookmarks.mjs          # 合并全部区域 → web/data/mapdata.json 的 bookmarks 段
```

`checkhist.mjs` 检查：schema、tag 跨书签一致性、cap/own/ownArea/ownProv 引用存在、vassal/suzerain 存在性、
religion/culture/gov/tech_group 合法、每个政权有 ruler、每书签政权数统计。**必须 0 error**。
`buildbookmarks.mjs` 会报告每书签的全球政权总数——用于确认 ≥200。

## 交付

- 只创建 `imperium/data/history/hist.<scope>.<year>.json`（你的 scope 与年份）与 `imperium/build/*.png`（如需）。
- 报告：每书签政权数、校验输出、史实取舍说明。
