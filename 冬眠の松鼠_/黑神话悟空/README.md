# 行者 · 白骨岭

一款运行在浏览器中的 3D 动作 RPG，向国产动作游戏致敬的**原创同人习作**。题材取自公有领域古典小说《西游记》：你将扮演一位持棍行者，穿过雾气弥漫的白骨岭墓地，斩除破土而出的骷髅妖兵，最终挑战妖王「白骨夫人」。

> 本项目不含任何商业游戏的美术、文本、音频素材；全部资源来自 CC0 / CC-BY 公共素材库，代码基于 three.js 编写。

## 运行方式

需要通过本地 HTTP 服务器运行（浏览器安全策略限制，双击 index.html 无法加载模型）。

方式一（推荐）：双击 `start.bat`（需要安装 Python 或 Node.js 其一）。

方式二（手动）：

```bash
# 任选其一，在项目根目录执行
python -m http.server 8093
npx http-server -p 8093
```

然后浏览器打开 `http://localhost:8093`。建议使用 Chrome / Edge，独显环境体验最佳。

## 操作

| 按键 | 功能 |
| --- | --- |
| W A S D | 移动 |
| 鼠标 | 视角（点击画面锁定鼠标，Esc 释放） |
| 左键 | 轻棍 · 四段连击（命中积攒棍势） |
| 右键按住→松开 | 重棍 · 蓄力，耗尽棍势追加大伤 |
| 空格 | 翻滚（带无敌帧，消耗体力） |
| Shift | 疾跑 |
| E | 定身术（禁锢目标数秒，冷却 16 秒） |
| Q | 分身术（毫毛化影，召 2 幻身协战引仇恨，冷却 30 秒） |
| F | 金刚躯（5 秒霸体减伤 75%，可在连招中瞬发，冷却 20 秒） |
| X | 奥义 · 法天象地（斩灭 18 米内所有妖邪，Boss 亦不能免，冷却 45 秒） |
| V | 秘术 · 地爆天星（引力聚陨：吸敌与碎石上天聚成巨岩，坠地爆发，冷却 35 秒） |
| K | 秘术 · 异次元黑洞（撕开虚空吞噬周围敌人，吸入即抹消，Boss 拉得慢但同样难逃，冷却 40 秒） |
| R | 饮葫芦回血（每命 4 口） |
| Tab / 鼠标中键 | 锁定 / 解除锁定目标 |
| Esc | 暂停 |

## 玩法提示

- 白骨岭的骷髅会在你靠近时破土而出，注意脚下坟茔。
- 骷髅方士会远程施放骨焰弹，优先处理。
- 走到山道尽头的石殿场地即触发 Boss 战；白骨夫人半血后进入第二阶段（更快、范围骨爆、瞬身背刺）。
- 阵亡后在土地庙复活，道中妖兵与 Boss 会复位。

## 工程结构（模块化）

```
index.html            入口 / UI 骨架 / importmap
css/style.css         全部界面样式
js/
  config.js           数值与世界配置（调参入口）
  main.js             游戏状态机 + 主循环
  core/               引擎层：assets 资源清单与加载、input、audio、utils、materials(细节贴图注入)
  world/              世界层：terrain(噪声地形+四重贴图混合)、environment(HDRI/光照/雾)、scatter(场景摆设)、world(组合/碰撞)
  entities/           实体层：animator(动画状态机)、player、enemy(4类骷髅AI)、boss(双阶段AI)
  combat/             战斗层：combat(判定/锁定/投射物/震屏)、camera(第三人称+锁定)、effects(程序化粒子)
  ui/                 界面层：hud、screens(加载/标题/死亡/胜利/暂停)
  vendor/             three.js 及官方 addons（本地化，无需外网）
assets/               模型 / 贴图 / HDRI / 音频 / 图标（全部 CC0 或 CC-BY）
tools/                开发辅助脚本（资源校验、无头截图测试等，可删除）
downloads/            素材下载缓存（可删除以瘦身）
```

## 素材致谢（Credits）

| 类型 | 来源 | 许可 |
| --- | --- | --- |
| 角色/武器模型 | [KayKit Character Packs](https://kaylousberg.itch.io/)（Kay Lousberg） | CC0 |
| 场景模型 | [Kenney Graveyard Kit / Nature Kit](https://kenney.nl/assets) | CC0 |
| PBR 贴图 | [ambientCG](https://ambientcg.com)（Ground037 / Rock030 / Gravel022 / Moss002 / Bark012, 1K） | CC0 |
| 天空 HDRI | [Poly Haven](https://polyhaven.com)（kloofendal_misty_morning_puresky） | CC0 |
| 音效 | [Kenney Audio Packs](https://kenney.nl/assets)（Impact / Interface / RPG Audio） | CC0 |
| 音乐 | [OpenGameArt](https://opengameart.org)：cynicmusic《Mysterious Ambience》、Ove Melaa《Heavy Concept A》 | CC0 |
| 图标 | [Game-icons.net](https://game-icons.net)（Lorc、Delapouite 等） | CC BY 3.0 |
| 引擎 | [three.js](https://threejs.org) r160 | MIT |

《西游记》为明代吴承恩所著古典小说，属公有领域。本作角色「白骨夫人」等形象基于该公版题材自行设计。
