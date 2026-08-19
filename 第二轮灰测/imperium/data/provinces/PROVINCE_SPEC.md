# 省份数据规范 (PROVINCE_SPEC)

本项目是一款 0–1600 年的大战略游戏（《十字军之王3》+《欧陆风云4》融合）。地图由**约 1900 个陆地省份**组成。
省份由**种子点（lat/lon）**定义：构建器会把全球 0.2° 陆地栅格按“**同一块陆地上的最短陆路距离**”分配给最近的种子，
再矢量化成多边形。因此你只需给出**位置 + 属性**，不需要画边界。

## 层级

`省份 province → 区域 area（约等于 CK3 公国 / EU4 地区）→ 大区 region（约等于 CK3 王国 / EU4 区域）→ 大陆 cont`

`cont` 取值：`europe | africa | wasia | easia | america | oceania`

## 文件格式

一个任务一个文件：`imperium/data/provinces/prov.<scope>.json`

```json
{
  "scope": "west_europe",
  "cultures": [
    {"id": "english", "zh": "英格兰人", "group": "west_germanic"},
    {"id": "briton",  "zh": "不列吞人", "group": "celtic"}
  ],
  "regions": [
    {"id": "england", "zh": "英格兰", "en": "England", "cont": "europe"}
  ],
  "areas": [
    {"id": "wessex", "zh": "威塞克斯", "en": "Wessex", "region": "england"}
  ],
  "provinces": [
    {
      "id": "london", "zh": "伦敦", "en": "London",
      "lat": 51.5, "lon": -0.1,
      "area": "wessex",
      "terrain": "farmland",
      "goods": "cloth",
      "size": 0.8,
      "port": true,
      "river": true,
      "dev": [[1, 4], [400, 3], [1100, 9], [1400, 14], [1600, 20]],
      "culture": [[1, "briton"], [500, "anglo_saxon"], [1150, "english"]],
      "religion": [[1, "celtic"], [340, "chalcedonian"], [450, "germanic"], [640, "chalcedonian"], [1054, "catholic"]]
    }
  ]
}
```

### 字段说明

| 字段 | 说明 |
|---|---|
| `id` | 全局唯一，小写 ASCII slug（`a-z0-9_`）。**易重名的地名必须加前缀**，如 `levant_tripoli` / `libya_tripoli`、`iberia_cordoba`。 |
| `zh` / `en` | 中文名与拉丁名。中文用该时期通行译名（如 `君士坦丁堡`、`长安`、`撒马尔罕`）。 |
| `lat` / `lon` | 种子点坐标，**必须落在陆地上**（校验器会检查）。取该省份中心城市或几何中心。 |
| `area` | 必须在本文件 `areas` 中声明。 |
| `terrain` / `goods` | 必须取自 `imperium/data/vocab.json` 的 `terrain` / `goods` 键。 |
| `size` | 相对面积权重 `0.5–4.0`。0.6=佛兰德/意大利式密集小省，1.0=普通，2.0=大草原/大森林，3.5=撒哈拉/西伯利亚/澳洲内陆巨省。它控制生长速度，越大占地越广。 |
| `port` | 是否沿海港口（内陆省为 false）。 |
| `river` | 是否临大河/大湖（影响补给与发展）。 |
| `dev` | `[[年, 发展度], ...]`，年份递增。发展度 ≈ EU4 总 development：3=蛮荒边地，6=一般农业区，10=富裕region，15=大城市腹地，20+=当世顶级都会（长安/君士坦丁堡/巴格达/开封/维查耶纳伽尔）。**必须体现史实兴衰**：如罗马 1 年=25、600 年=6、1500 年=12；巴格达 700 年=8、900 年=30、1300 年=8（蒙古屠城）。至少给 3 个时间点，建议 4–6 个。 |
| `culture` | `[[年, 文化id], ...]` 文化更替史。文化 id 若不在 vocab 中，须在本文件 `cultures` 里声明（含 `group`，取自 vocab 的 `cultureGroups`）。 |
| `religion` | `[[年, 宗教id], ...]` 宗教更替史，id **必须**取自 vocab 的 `religions`（不可新增）。年份要贴合史实（如埃及：kemetic → 250 chalcedonian → 451 miaphysite → 700 sunni；波斯：zoroastrian → 700 sunni → 1510 shia）。 |

时间线取值规则：引擎取 `年份 ≤ 当前年` 的最后一项；`dev` 在两点间线性插值。第一项年份应 ≤ 1（用 `0` 或 `1`）。

## 质量要求（这是史实项目，不要随手编）

1. **地理密度符合历史重要性**：意大利、希腊、黎凡特、两河、埃及、印度河—恒河、华北华南、江南、日本、法兰西、莱茵、低地、伊比利亚要密（省份小而多）；撒哈拉、阿拉伯内陆、西伯利亚、澳洲内陆、亚马逊、北美大平原要疏（省份大而少，`size` 3+）。
2. **种子点均匀**：同一 area 内的种子间距一般 ≥0.35°（密集区最小 0.25°），避免两点几乎重合导致某省只剩几个栅格。
3. **命名用历史名**：优先用该地区在 0–1600 年间的通行地名（`Constantinopolis`、`Chang'an`、`Ctesiphon`、`Tenochtitlan`、`Cusco`），而非现代名。
4. **area/region 划分**：一个 `area` 含 2–8 个省份；`region` 含 3–12 个 `area`，对应历史上的王国/大区（如 `england`、`bavaria`、`khorasan`、`jiangnan`、`deccan`、`anahuac`）。
5. **港口标注要准**：内陆省绝不能是 `port: true`；海岛与沿海城市必须是。

## 校验流程（必须收敛）

```
cd H:\Deepseek\0813h\grey0819ck\imperium
node tools/checkprov.mjs --files prov.west_europe.json --bbox -12,40,20,62 --out build/prov.west_europe.png
```

校验器会报告：schema 错误、id 重复、area/region/文化/宗教引用错误、**落在水里的种子**（含到最近陆地的距离）、
过近的种子对、dev/时间线错误，并输出预览图（黑点=种子，红点=落水种子）。
用 `read_image` 打开预览图，检查分布是否均匀合理。**必须做到 0 error**（warning 尽量清零）。

海岸线数据由其他代理并行生成；若 `data/geo/` 里还缺你区域的 `coast.*.json`，落水检查会被跳过并提示——
此时先完成数据，稍后再跑一次校验。

## 交付

- 只创建/修改你自己的 `imperium/data/provinces/prov.<scope>.json` 与 `imperium/build/*.png`。
- 不要修改 `tools/`、`data/vocab.json`、其他人的省份文件。
- 报告：省份数、area/region 数、0 error 的校验输出摘要、你新增的 culture id 列表、已知取舍。
