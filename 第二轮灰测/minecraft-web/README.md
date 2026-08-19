# MineWeb — 网页版我的世界

一个尽可能还原《我的世界》观感的体素沙盒游戏，**纯手写 WebGL2 + 原生 ES 模块**：
零依赖、零构建、零图片资源 —— 所有贴图、音效、地形都在运行时程序化生成。

> 非官方作品，仅供技术学习与演示。

## 🚀 运行

```bash
# 需要 Node.js ≥ 18（仅用于静态服务器）
node tools/server.mjs 8899
# 打开 http://127.0.0.1:8899/
```

也可以直接用 `python -m http.server` / `npx serve` 等任意静态服务器，
或直接双击 `index.html`（少数浏览器会因 file:// 的模块限制无法运行，建议用服务器）。

## 🎮 操作

| 按键 | 功能 |
| --- | --- |
| `W A S D` | 移动 |
| `空格` | 跳跃 / 上浮（创造模式双击起飞） |
| `Shift` / `Ctrl` | 潜行 / 疾跑 |
| 鼠标左键 | 挖掘方块 / 攻击生物 |
| 鼠标右键 | 放置方块 / 使用 / 进食 |
| 鼠标中键 | 取色（快速获得目标方块） |
| `滚轮` / `1-9` | 切换快捷栏 |
| `E` | 物品栏 / 3×3 合成 / 配方书 / 熔炼 |
| `Q`（+Ctrl 全丢） | 丢弃物品 |
| `F` | 切换第一 / 第三人称视角 |
| `F3` | 调试信息面板 |
| `F11` | 全屏 |
| `T` / `/` | 聊天 / 命令 |
| `ESC` | 暂停 / 关闭界面 |

**命令**：`/help`、`/time set day|night`、`/gamemode creative|survival`、`/tp x y z`、
`/give 方块名 数量`、`/seed`、`/weather clear|rain|thunder`、`/fill 方块 半径`、
`/spawn 生物 数量`、`/killall`、`/clear`、`/save`、`/tick 倍率`、`/rd 2-16`、`/light` …

## ✨ 已实现的特性

- **地形**：噪声高度场 + 域扰动 + 大陆度整形；海洋 / 沙滩 / 平原 / 森林 / 白桦林 / 针叶林 /
  雪原 / 沙漠 / 热带草原 / 沼泽 / 丛林 / 恶地 / 山地 / 雪山 / 河流 15 种生物群系；
  蠕虫洞穴 + 大型溶洞、岩浆池、矿脉（煤/铁/铜/金/红石/青金石/钻石/绿宝石）、
  橡树 / 白桦 / 云杉 / 丛林 / 金合欢 / 沼泽橡树、甘蔗、睡莲、南瓜、蘑菇、
  村庄小屋与废墟建筑；世界类型：默认 / 放大化 / 超平坦 / 浮空岛 / 无尽之海
- **渲染**：WebGL2 纹理数组（220 层程序化 16×16 贴图）、区块三层渲染（不透明 / 镂空 / 半透明）、
  平滑光照 + 四角环境光遮蔽（AO）、水面波浪动画与岩浆流动动画、昼夜循环（天空色关键帧插值 +
  太阳月亮星辰）、云层、距离雾、水下蓝色雾、天气（雨 / 雷雨）、破坏裂纹动画、选择框
- **玩法**：生存 / 创造 / 旁观三种模式；20 点生命 + 饥饿 + 氧气；挖掘速度与工具等级挂钩、
  掉落物与经验、潜行防跌落、疾跑 FOV 拉伸、梯子与藤蔓攀爬、游泳与浮力、摔落伤害、
  3×3 合成（有序/无序 + 平移匹配）+ 配方书 + 熔炼（燃料消耗）、16 色羊毛与混凝土染色
- **实体**：猪 / 牛 / 羊 / 鸡 / 兔子 / 僵尸 / 骷髅 / 苦力怕 / 蜘蛛；漫游 AI、追击、跳跃越障、
  苦力怕爆炸（破坏地形 + 击飞）、僵尸骷髅白天自燃、掉落物拾取与合并
- **音效**：WebAudio 全合成 —— 不同材质的脚步声 / 挖掘 / 破坏 / 放置 / 受伤 / 拾取 /
  爆炸 / 水花，可选生成式环境音乐
- **界面**：MC 风格像素 UI、F3 调试面板（类原版信息布局）、聊天历史与命令补全（Tab）、
  创造模式分类物品栏、物品图标由贴图等轴测合成
- **存档**：localStorage 增量存档（只存种子 + 修改过的方块 + 玩家状态，KB 级）、自动存档

## 📁 项目结构

```
minecraft-web/
├─ index.html                # 页面骨架（HUD/菜单/物品栏 DOM）
├─ assets/
│  ├─ css/style.css          # 菜单/按钮/对话框样式
│  └─ css/ui.css             # HUD/物品栏/聊天样式
├─ src/
│  ├─ main.js                # 入口：启动、错误兜底、URL 参数、诊断
│  ├─ core/                  # 引擎核心
│  │  ├─ Constants.js        # 全局常量、六个面的几何表、枚举
│  │  ├─ EventBus.js         # 发布订阅总线
│  │  ├─ Settings.js         # 选项 schema + localStorage 持久化
│  │  ├─ Input.js            # 键鼠/指针锁定/滚轮统一输入
│  │  ├─ Loop.js             # 固定 20tps 逻辑刻 + 可变渲染帧
│  │  └─ Game.js             # 游戏状态机与渲染管线总控
│  ├─ math/                  # 数学库
│  │  ├─ MathUtils.js  Vec3.js  Mat4.js  AABB.js  Frustum.js
│  │  ├─ Random.js           # 可复现种子随机（mulberry32/hash）
│  │  └─ Noise.js            # Perlin/Simplex/分形/域扰动/细胞噪声
│  ├─ data/                  # 静态数据
│  │  ├─ blocks.js           # 方块注册表（90+ 方块）
│  │  ├─ textures.js         # 220 张贴图像素画法（纯代码绘制）
│  │  ├─ item_textures.js    # 工具/食物 ASCII 图案像素画
│  │  ├─ items.js            # 物品注册表
│  │  └─ recipes.js          # 合成表 + 匹配算法 + 熔炼表
│  ├─ render/                # 渲染层
│  │  ├─ GL.js               # WebGL2 上下文/程序/网格封装
│  │  ├─ Shaders.js          # 全部 GLSL ES 3.0 着色器
│  │  ├─ TextureAtlas.js     # TEXTURE_2D_ARRAY 图集 + 动画 + 2D 图标
│  │  ├─ TexturePainter.js   # 16×16 像素画工具
│  │  ├─ Renderer.js         # 区块网格调度与三层渲染
│  │  ├─ SkyRenderer.js      # 天空/天体/星空/云
│  │  ├─ Camera.js           # 相机 + 视锥 + 屏幕射线
│  │  └─ EntityRenderer.js   # 生物/掉落物/粒子/手持
│  ├─ world/                 # 世界层
│  │  ├─ Chunk.js            # 16×128×16 区块数据
│  │  ├─ World.js            # 区块管理/方块读写/流水线/随机刻
│  │  ├─ Generator.js        # 地形/洞穴/矿脉/树木/建筑生成
│  │  ├─ Biomes.js           # 15 种生物群系定义
│  │  ├─ Lighting.js         # 天光+方块光 BFS（增量更新）
│  │  └─ ChunkMesher.js      # 面剔除 + AO + 平滑光照网格化
│  ├─ entity/                # 实体层
│  │  ├─ Physics.js          # AABB 逐轴扫掠碰撞 + 台阶
│  │  ├─ Player.js           # 玩家：移动/游泳/飞行/生命/饥饿
│  │  ├─ MobModels.js        # 生物盒子模型
│  │  ├─ Mob.js              # AI/受伤/掉落/苦力怕爆炸
│  │  └─ EntityManager.js    # 生成/更新/掉落物
│  ├─ game/                  # 玩法系统
│  │  ├─ Raycast.js          # 体素 DDA 射线 + 实体射线
│  │  ├─ Interaction.js      # 挖掘/放置/攻击/使用
│  │  ├─ Inventory.js        # 背包/合成网格/耐久
│  │  ├─ Particles.js        # 粒子系统（碎屑/爆炸/雨雪）
│  │  ├─ Sound.js            # WebAudio 程序化音效
│  │  ├─ Storage.js          # localStorage 存档
│  │  └─ Diagnostics.js      # 自动化渲染诊断（?diag=N）
│  └─ ui/                    # 界面层
│     ├─ ItemIcons.js  HUD.js  DebugOverlay.js  Chat.js
│     ├─ InventoryUI.js  Menus.js
├─ tests/
│  ├─ selftest.js            # 60 项核心逻辑自检（Node/浏览器双端可跑）
│  └─ selftest.html          # 浏览器自检页
├─ tools/
│  ├─ server.mjs             # 零依赖静态服务器
│  ├─ run-tests.mjs          # Node 单元测试
│  └─ smoke.ps1              # 无头浏览器烟囱测试（自检+截图+渲染诊断）
├─ screenshots/              # 测试截图
└─ docs/                     # 预留文档
```

## 🔬 测试与自动化验证

```bash
node tools/run-tests.mjs                    # 60 项逻辑自检（数学/噪声/方块表/配方/生成/光照/网格/射线/物理/背包）
powershell -File tools/smoke.ps1            # 无头 Chrome：自检页 + 游戏内诊断 + 截图
```

游戏内诊断（`?autostart=1&seed=xxx&diag=3`）会回读帧缓冲并输出：
颜色分布、三角形数、网格覆盖率、帧率，以及逐帧亮度采样（**闪烁检测**）——
连续帧亮度跳变率 0% 即为画面稳定。

## 🖥️ 浏览器要求

需要 **WebGL2**：Chrome 56+ / Edge 79+ / Firefox 51+ / Safari 15+，并启用硬件加速。
虚拟机上可尝试 `--enable-unsafe-swiftshader` 软件渲染。

## 🔧 常见问题

- **黑屏**：确认 WebGL2 可用（打开 `tests/selftest.html` 查看）；无独显笔记本注意浏览器是否
  用错了显卡（NVIDIA 控制面板把 chrome.exe 设为高性能）。
- **卡顿**：选项 → 调低渲染距离 / 渲染分辨率 / 区块预算；或关闭云、粒子。
- **存档重置**：清空站点 localStorage（`mineweb.world.*` / `mineweb.settings.v1`）。

## 📝 技术要点

- 区块 16×128×16，纵向 8 个 section；顶点 28 字节（pos + uvw + face/AO/双光打包 int）
- 光照：天光逐列投射 + BFS 扩散；方块光发射源 BFS；增量更新用经典"移除-重填"双队列，
  并对直接暴露天空的格子做保护，避免把露天区域误清黑
- 网格：隐藏面剔除（同类/不透明邻接）、四角 AO（含对角线翻转消瑕疵）、三层渲染、
  全 section 共享一个四边形索引缓冲（每网格仅存顶点）
- 存档只保存"种子 + 修改过的方块 + 玩家状态"，读档时按种子重放世界并覆盖差异
- 音效全部由噪声 + 双二次滤波 + 包络实时合成，素材为零
