# 剧情 / 任务 / 解谜 / 交互内容（模块 D）— 内容清单

本文档列出模块 D 实现的全部内容，供集成者与验收者核对。

## 文件与导出 API

| 文件 | 导出 | 说明 |
|---|---|---|
| `src/quest/quests.js` | `class QuestSystem` | 任务系统：`constructor(ctx)` `update(dt)` `accept(id,opts?)` `complete(id)` `advance(id)` `state` `get active()` `wantsNPC(id)` `hasAcceptNPC(id)` |
| `src/quest/story.js` | `MAIN_QUESTS` `speak(ctx,node)` `node(...)` | 主线 7 章数据 + 对话树 + 对话推进辅助 |
| `src/quest/sidequests.js` | `SIDE_QUESTS` `SIDE_NPC_NAMES` | 支线 6 个（含分支对话） |
| `src/quest/puzzles.js` | `class PuzzleSystem` | 解谜系统：`constructor(ctx)` `update(dt)` `forceSolve(id)` `get(id)` `puzzles` |
| `src/quest/worldobjects.js` | `class WorldObjects` + 共享构建器 | 宝箱/锚点/采集/可破坏物/营地/风场 + 几何·材质·交互构建器 |
| `src/quest/npcs.js` | `class NPCSystem` | NPC 放置与游荡：`constructor(ctx)` `update(dt)` `npcs` |
| `dev/quest.html` | — | 自测页（假 ctx + 桩 + 逻辑自测 29 项） |

## 主线剧情（7 章，复刻原神开场脉络）

| 章 | id | 章节名 | 步骤数 | 触发机制 | 奖励 |
|---|---|---|---|---|---|
| 1 | `main_1` | 序章·风起之时 | 4 | 自动（game:ready）；南风海岸醒来→救派蒙(交互)→对话→教学字幕 | 摩拉×1000 |
| 2 | `main_2` | 风起地的低语 | 3 | 到达风起地(region)→击杀3史莱姆(kill)→触摸巨树(interact) | 风之翼(`unlock:glider`) |
| 3 | `main_3` | 蒙德城 | 5 | 进城(region)→激活神像(interact)→与琴(npc)→与安柏(npc)→接受委托 | 地图解锁+传送 |
| 4 | `main_4` | 失落的手记 | 5 | 到废墟(region)→顺序方碑(puzzle)→开石门→取手记(interact)→清营地(kill) | 手记+摩拉×2000 |
| 5 | `main_5` | 雪山的低温 | 4 | 到雪山(region)→点3火盆(puzzle)→冰封方碑(puzzle)→遗迹守卫(kill) | 食谱+摩拉×3000 |
| 6 | `main_6` | 石门的试炼 | 2 | 到峡谷(region)→限时挑战(puzzle) | 宝箱+摩拉×5000 |
| 7 | `main_7` | 终章·风魔龙 | 5 | 回蒙德(region)→温迪(npc)→塞西莉亚湖(region)→决战(kill boss)→尾声(cinematic/credits) | 证明+摩拉×10000 |

- 每步均有 `text` + `done` 状态；触发条件覆盖 region / location / interact / npc / kill / puzzle / gather / auto。
- 奖励走 `ctx.ui?.toast`；事件 `quest:accepted / quest:step / quest:completed`。
- 支线接取与 NPC 对话统一走 `npc:talk`，NPCSystem 通过 `ctx.quests?.wantsNPC/hasAcceptNPC` 避免双重对话。

## 支线任务（6 个，含三态与分支）

| id | 名称 | 目标 | 接取 | 分支对话 |
|---|---|---|---|---|
| `side_1` | 失落的宠物 | 找 3 只走失的猫(interact) | 与玛格丽特对话 | 3 选项决定先找哪只猫 |
| `side_2` | 酿酒师的委托 | 采集 5 树莓(gather) | 与酿酒师对话 | — |
| `side_3` | 骑士团的巡查 | 清 2 丘丘人营地(kill×6) | 与凯亚对话 | 2 选项 |
| `side_4` | 诗人的灵感 | 3 风景点拍照(gather:photo) | 与温迪对话 | 2 选项→影响奖励 |
| `side_5` | 宝藏猎人的地图 | 挖 3 宝箱(interact) | 与宝藏猎人对话 | 2 选项→分账比例→影响奖励 |
| `side_6` | 雪山遇险 | 救冒险家(interact)→火堆(puzzle) | 进入雪山(region) | — |

接取/进行中/完成三态由 `QuestSystem.state[id].status`（available/active/done）维护。

## 谜题（7 类，共 8 个实例）

| 类型 | 实例 id | 位置 | 机制 |
|---|---|---|---|
| 元素方碑(顺序) | `ruins_monument` | 风龙废墟 | 按 风→火→冰 顺序用元素攻击点亮，20s 限时 |
| 元素方碑(解冻) | `snow_monument` | 龙脊雪山 | 3 座火碑，火元素点亮 |
| 火种点燃 | `snow_torch` | 龙脊雪山 | 火元素点燃 3 火盆（取暖） |
| 风场 | `windrise_glide` | 风起地 | 上升气流抬升玩家→浮空平台宝箱 |
| 仙灵引路 | `windrise_seelie` | 风起地 | 仙灵沿路径飞行，玩家靠近才继续，到底座完成 |
| 岩石阵/压力板 | `stonegate_plates` | 石门峡谷 | 推动 3 石块同时压 3 板 |
| 时限挑战 | `stonegate_trial` | 石门峡谷 | 60s 内击杀 6 只怪 |
| 顺序记忆 | `ruins_memory` | 风龙废墟 | 4 发光石按提示顺序点击 |

- 视觉状态：未激活/激活颜色、emissive 强度切换、粒子（`Points`）。
- 完成：`ctx.audio?.sfx('puzzle_solve')` + `ctx.fx3d?.burst` + 奖励宝箱 + `ctx.events.emit('puzzle:solved',{id})`。
- `PuzzleSystem.forceSolve(id)` 供测试/调试程序化完成。

## 世界对象数量

| 类型 | 数量 | 说明 |
|---|---|---|
| 宝箱 | **25** | 普通/精致/珍贵 3 档（几何+材质区分）；开箱动画（盖子旋转+金光柱+粒子+物品飞出） |
| 传送锚点 | **7** | 含七天神像；激活后 `waypoint:unlocked`，可 `player.teleport` |
| 采集点 | **48** | 树莓/甜甜花/薄荷/铁矿石/水晶矿 5 种，InstancedMesh 实例化；采集 `gather` 事件 |
| 可破坏物 | **20** | 木桶/木箱/岩石；受击碎成碎块 + 掉落 |
| 冒险家营地 | **3** | 帐篷+篝火+木箱 |
| 独立风场 | **2** | 攀爬/滑翔用（另有一个风场谜题） |
| NPC | **12**（≥8） | 琴/安柏/凯亚/温迪 + 8 名村民（含 3 位支线任务 NPC） |

## 集成者配合点

1. 构造顺序：**先** `ctx.ui / ctx.audio / ctx.fx3d / ctx.interact / ctx.characters / ctx.enemies / ctx.player / ctx.terrain / ctx.water`，**再** new 本模块的四个系统（否则几何仍在、但交互点会入队等待 `interact` 出现后自动补注册；UI/音频调用均已可选链容错）。
2. 把实例挂到 `ctx.quests / ctx.puzzles / ctx.worldObjects / ctx.npcs`（集成者实际采用 `ctx.worldObjects` 驼峰命名；NPCSystem 靠 `ctx.quests?.wantsNPC/hasAcceptNPC` 避免与任务对话重复）。
3. 每帧调用顺序建议：`QuestSystem.update → PuzzleSystem.update → WorldObjects.update → NPCSystem.update`（顺序不影响正确性）。
4. 主线**严格串行**：`game:ready` 只接取第一章（`requires === null`），之后每章全部 steps 完成并 `complete()` 后才由 `_finish` 链式 `accept` 下一章。`quests.active` 返回「当前进行中」列表（主线最多 1 个 + 已接支线）。
5. 依赖事件：`enemy:died`（含 `type`）、`combat:hit`（`info.origin`+`info.element`）、`gather`（`type`）、`npc:talk`（`id`）、`puzzle:solved`（`id`）、`player:region`（`{region}`）。请确保对应模块按契约 §3 事件表 emit。**region 触发只监听 `player:region` 事件，不做每帧坐标判定**（玩家必须真的进入过该区域）。
6. `npc:talk` 由 NPCSystem 在与 NPC 交互时 emit；本模块的任务对话也依赖它，因此 NPC 交互请统一走 NPCSystem，不要另起交互点。

## 已知限制

- NPC 模型：优先 `ctx.characters.createCharacter`，无该模块或返回空时回退为胶囊占位（已容错）。
- 谜题完成后的奖励宝箱复用「精致」档外观（程序化，无独立美术资产）。
- 雪山「严寒」为提示性机制（字幕+toast），真实持续掉血由玩法模块实现，本模块不接管 HP。
- 风场：`worldObjects.windFields` 每个对象含 `{x, z, radius, strength, top}`（`top = baseY + heightH`），抬升已交给集成者的 `environment`（13.5 m/s）处理，本模块只做粒子动画；`addWindField(x,y,z,radius,heightH,strength=13.5)` 可传自定义 `strength`。谜题风场（`windrise_glide`）自带抬升（13.5 m/s）。
- 对话分支在 `ctx.ui.dialogue.start` 缺失时仅 `console.log` 并 resolve 0（契约要求的容错）。
- 支线 `side_4` 的「拍照」以交互点触发（非监听键盘 P），如需按 P 拍照，集成者可在输入层 emit `gather {type:'photo'}`。
- 终章风魔龙：`ctx.enemies.spawn('boss_dvalin', …)` 返回 null（敌人模块未就绪）时，提示后延时 emit `enemy:died{type:'boss_dvalin'}` 直接判定通过，不卡剧情。
- 严寒（`ctx.environment`）：火盆谜题的 `p.torches[]`（`userData.lit === true`）与 `worldObjects.camps` 已按约定暴露，可被严寒系统当作热源。
