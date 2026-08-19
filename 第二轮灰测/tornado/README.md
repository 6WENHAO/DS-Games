# TORNADO · 写实体积龙卷风 · 三场景实时演示

纯 WebGL2 / three.js（无美术资源，全部程序化生成）的实时龙卷风场景演示。
三个场景 —— **大海 / 沙漠 / 平原** —— 共用同一套光影、同一个龙卷风控制器与同一套物理风场：
你在参数面板里改的每一个数值，都会同时改变**看到的漏斗**和**吹翻船只、掀掉屋顶的力**。

```
双击 start.bat          （或者： node serve.mjs  然后打开 http://127.0.0.1:8181/ ）
```

> ES Module 必须通过 http 协议加载，直接双击 index.html（file://）浏览器会拒绝加载模块。
> `serve.mjs` 是零依赖的 Node 静态服务器，只需要 Node 18+。

---

## 1. 亮点一览

| 能力 | 实现要点 | 文件 |
|---|---|---|
| 体积龙卷风 | 世界空间光线步进的密度场：Rankine 涡旋角速度 + 湍流侵蚀 + 细丝卷须 + 多涡旋 + 地面尘裙 + 云底盘；朝阳二次步进自阴影、双叶 HG 相函数、粉末效应；采样场景深度做逐像素遮挡；半分辨率 + 深度双边上采样 | `src/tornado/TornadoVolume.js` |
| 一套物理风场 | Rankine 组合涡 v_t、近地径向辐合 v_r、涡壁上升气流 v_z；动压 q=½ρv² 驱动破坏判定 | `src/tornado/Tornado.js` |
| 高质量水面 | ① 解析 Gerstner 涌浪（CPU/GPU 同一份波列数据，逐点严格一致）② GPU FFT 频谱短波（Phillips + 方向扩散 + Hermite 对称 + 迭代 Cooley–Tukey）③ CPU 二维波动方程涟漪，被龙卷风压强坑驱动 ④ 涡旋抬升水柱/环形凹陷/切向牵引 | `src/water/*` |
| 船只被掀翻 | 多点浮力提供复原力矩 + 水线以上受风形心提供倾覆力矩 + 惯量张量四元数积分；不是动画，是真的翻 | `src/core/MiniPhysics.js` |
| 建筑逐件破坏 | 建筑=零件表（盒/柱/楔 + 材质 + 强度）；动压超阈值→脱落成刚体；脱落会削弱上方零件→连锁倒塌 | `src/world/Destructible.js`, `src/world/BuildingKit.js` |
| 统一光影 | 唯一一套：太阳方向光（纹素对齐自适应阴影框）+ 半球光 + 天空穹顶烘焙 PMREM 环境光 + 共享指数高度雾/空气透视（注入到所有内置材质与自定义着色器）+ 闪电 | `src/core/Lighting.js`, `src/core/Sky.js` |
| LOD | 放射状相机中心网格（地形/海面顶点密度随距离指数下降）；建筑零件按 detail 分级隐藏；道具按空间网格合批 + 距离剔除；植被环绕实例化 | `src/world/RadialGrid.js`, `src/world/PropField.js` |
| 植被 | 环绕实例化"无限草原"，采样地形高度图贴地、采样破坏图被连根拔起、Rankine 风场压平倒伏 | `src/world/Vegetation.js` |

---

## 2. 操作

| 输入 | 作用 |
|---|---|
| 拖拽 / 滚轮 | 环视 / 缩放 |
| `1` `2` `3` | 大海 / 沙漠 / 平原 |
| `C` | 镜头模式：自由环视 → 追踪涡心 → 电影运镜 → 地面视角 |
| `空格` 或「召唤打击」 | 让龙卷风扑向最近的完整建筑（海上则扑向最近的船） |
| `R` 或「重建场景」 | 修复所有被摧毁的建筑/道具/翻掉的船 |
| `H` | 显示/隐藏参数面板 |
| `P` | 暂停 |

---

## 3. 参数面板

7 组、60+ 个实时参数（改动立即生效，无需重载）：

* **龙卷风·形态** — 涡柱高度、底部半径、顶部展开、漏斗曲率、空心程度、涡壁厚度、倾斜与方位、摆动、多涡旋数量
* **龙卷风·动态** — 旋转速度（决定 V_max，同时决定视觉转速与破坏力）、差动旋转、上升气流、湍流强度/尺度、移动速度、路径半径、移动模式
* **龙卷风·渲染** — 烟尘浓度、亮度、环境光吸收、前向散射 g、凝结白核、地面尘裙、尘裙高度、碎片数量、光线步数、半分辨率开关
* **龙卷风·破坏力** — 吸力、抬升力、结构破坏阈值、自动破坏开关
* **水面** — 风速、风向、浪高倍率、浪尖锐度、波浪基尺度、泡沫、次表面透光、反射强度、涡吸水柱、物理涟漪耦合、水雾飞沫
* **统一光影** — 太阳高度/方位、大气浑浊度、风暴云量、云底压暗、雾、曝光、泛光、阴影、时间流速
* **画质/LOD** — 渲染倍率、LOD 距离倍率、场景物件密度、海面 FFT 分辨率、阴影分辨率

预设：`EF1 细绳涡` / `EF3 经典漏斗` / `EF5 楔形巨兽` / `多涡旋撕裂` / `水龙卷海上`。

---

## 4. 渲染管线

```
scene ──► sceneRT (RGBA16F, MSAA4, + DepthTexture)
            │
            ├─► 体积龙卷风 raymarch（半分辨率，读深度做遮挡）─► volRT
            │        │
            │        └─► 深度双边上采样合成 ────────────────► compRT
            │
            ├─► 阈值降采样 + 分离高斯 ×5 ─────────────────► bloom
            │
            └─► 合成 + 曝光 + ACES + 分级 + 暗角 + 颗粒 + FXAA ─► 屏幕
```

体积必须放在场景之后、并且读取场景深度：这样建筑能挡住涡柱，涡柱也能挡住建筑，
而且是逐像素正确的体积合成（碎片飞进漏斗里会被前面的烟尘一层层遮住）。

## 5. 水面为什么能"物理"

浮力需要在 CPU 上知道任意一点的水面高度，而 FFT 结果在 GPU 上。做法是分频：

* **长波（涌浪）** 用解析 Gerstner。波列（方向/振幅/波数/角频率）在 JS 里按 JONSWAP 形状生成一次，
  **同一份数组**上传给顶点着色器，`GerstnerSwell.height()` 与 GLSL `swellDisplace()` 是同一个公式。
  → 船体吃水、纵横摇与看到的浪严格一致。
* **短波（细节）** 用 GPU FFT（Phillips 频谱 + 短波抑制 + 长波高通，避免与涌浪叠加导致浪高翻倍）。
  只影响法线/泡沫/尖浪视觉，对船体运动影响可忽略。
* **龙卷风耦合** 用 CPU 二维波动方程 `∂²h/∂t² = c²∇²h − 2γ∂h/∂t + F`，
  驱动项来自 Rankine 涡的压强亏损 `Δp = ½ρ_air·v_θ²` 换算的平衡水位 —— 移动的低压坑会自然辐射出尾迹波。
  网格在 CPU 上，所以浮力查询和渲染读的是同一份数据。

## 6. 目录

```
tornado/
├── index.html            页面骨架 + importmap + 早期错误收集
├── serve.mjs             零依赖静态服务器
├── start.bat             一键启动（起服务 + 开浏览器）
├── tools/cdp.mjs         无头自检/截图探针（CDP，零依赖）
├── vendor/               three r185 + 少量 addons（离线可用）
└── src/
    ├── main.js           装配与主循环
    ├── core/             Engine 管线 / Lighting 统一光影 / Sky / Params / GlslLib / MiniPhysics / Noise
    ├── tornado/          Tornado 控制器 / TornadoVolume 体积着色器 / Debris 两级碎片
    ├── water/            Ocean 水面 / Gerstner 涌浪 / OceanFFT 频谱 / RippleSim 波动方程
    ├── world/            Terrain 地形 / RadialGrid / Vegetation / BuildingKit / Destructible / PropField / MeshMerge
    ├── scenes/           SceneBase / LandScene / OceanScene / DesertScene / PlainScene + props/
    └── ui/               Panel 参数面板 / style.css
```

## 7. 自检与出图

```powershell
# 无头自检（真实 WebGL2，检查着色器编译、帧、风场、物理、破坏等）
node tools/cdp.mjs "http://127.0.0.1:8181/index.html?scene=plain&selftest=1&frames=40&noui=1"

# 出图（不跑自检，渲染 N 帧后截图）
$env:FRAMES=30; node tools/cdp.mjs "http://127.0.0.1:8181/index.html?scene=ocean&noui=1&cam=ground" "_shots/a.png"
```

常用 URL 参数：`scene=` `selftest=1` `frames=N` `noui=1` `cam=orbit|chase|cinema|ground`
`camDist=` `fixedDt=` `perf=1`（固定体积步数，关闭性能自适应）`lowend=1`，
以及**任何参数键**（例如 `t_steps=96&t_density=1.8&q_fft=256&l_sunElev=6`）。

## 8. 性能

默认在中端独显上以 1080p 目标 60fps：体积默认半分辨率 + 76 步；帧率掉到 34 以下时自动
下调体积步数（不改用户参数）。若需要更高画质：关闭「半分辨率体积」、把「光线步数」拉到 120+、
FFT 调到 512。若太卡：降低「渲染倍率」「场景物件密度」，或把阴影分辨率调到 1024。

当前统计（1080p 参考量级）：draw call 海上 ≈ 80、沙漠 ≈ 170、平原 ≈ 180；
建筑零件平原 1600 件 / 沙漠 850 件，全部可独立脱落。
