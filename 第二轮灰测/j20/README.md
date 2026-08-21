# J-20「威龙」程序化三维模型

一个**双击即开、完全离线**的 WebGL 交互模型：`j20.html`（1.3 MB 单文件，内联了 three.js r160，
不请求任何外部资源）。机体几何、蒙皮贴图、军徽、天空环境全部由代码生成，仓库里没有任何 3D 模型文件。

## 打开方式

直接双击 `j20.html` 即可（因为脚本是内联的，不会撞上 `file://` 下 ES module 的 CORS 限制）。

* 左键拖拽环绕 / 滚轮推拉 / 右键平移
* 开关：起落架、弹舱（含 4×PL-15 + 2×PL-10）、加力燃烧、自动旋转、线框、飞行姿态
* 视角预设：三视·斜、正前、侧视、俯视、尾后、**腹视**、座舱、进气道
* URL 参数可直接进入指定构型，例如
  `j20.html?cam=belly&bay=1`、`j20.html?flight=1&ab=1&gear=0&cam=rear`、`j20.html?wire=1`

## 建模要点

| 部位 | 做法 |
| --- | --- |
| 机身 | 29 个横截面「超椭圆 + 棱线(chine)」放样；棱线顶点重复一次形成硬边，得到 J-20 标志性的边条与折线 |
| 主翼 / 鸭翼 / V 尾 / 腹鳍 | NACA 厚度分布的真实翼型曲面放样（前缘后掠 43.1°，切尖三角翼） |
| 全动鸭翼 | 几何平移到转轴原点 + pivot 定位，绕自身 1/4 弦转轴偏转（带 6° 下反） |
| V 尾 / 腹鳍 | 分别外倾 22° / 20°，全动式无独立方向舵 |
| DSI 进气道 | 后掠 D 形唇口环 + 向后内收并封底的内壁（形成深邃进气口）+ 椭球鼓包 |
| 蒙皮 | 2048×1024 程序化贴图：面板分缝、锯齿状口盖（隐身特征）、5200 颗铆钉、油污流痕 |
| 材质 | `MeshPhysicalMaterial` + clearcoat + iridescence，模拟 RAM 隐身涂层的偏光感 |
| 环境光 | 自写天空 shader → `PMREMGenerator` 烘成环境贴图，金属反射与天空一致 |
| 军徽 / 机号 | Canvas 绘制的低可视度八一军徽与「2011」机号，做成 decal 平面贴合翼面 |

尺寸对标真机：**全长 20.0 m · 翼展 12.88 m · 全高 4.49 m**（真机 20.4 / 12.88 / 4.45）。
107 个网格、10,532 三角面、73 个 draw call。

## 源码与构建

```
src/j20-geometry.js   几何构建层（刻意不写 import/export，见下）
src/app.js            场景 / 渲染 / 材质 / UI / 状态机
src/shell.html        页面外壳（CSS + UI 结构 + 注入点）
vendor/               three.js r160 与 OrbitControls（MIT）
build.mjs             拼装单文件 HTML（含整包语法门禁）
check.mjs             几何校验（node 内注入 three，不需要浏览器）
verify.mjs            端到端验证（无头 Edge 真跑 + 截图像素分析）
shots.mjs             生成预览图
```

```powershell
node build.mjs    # 生成 j20.html
node check.mjs    # 几何校验
node verify.mjs   # 端到端验证（需要 Edge/Chrome）
node shots.mjs    # 生成预览图
```

几何层不写 `import/export` 是刻意的：这样同一份源码既能被 `build.mjs` 直接内联进单文件 HTML，
也能在 node 里用 `new Function` 注入 three 的符号做几何校验，不需要打包器。

## 验证做了什么

因为我（生成这份代码的模型）**看不到图像**，所以全部靠可度量的断言：

**几何层（`check.mjs`）**：NaN / 退化三角形统计；全长、翼展、全高、前缘后掠角、翼尖坐标、
V 尾外倾方向、腹鳍朝向、轮胎触地高度逐项对标真机；用「取某方向极值顶点，检查其法线方向」
验证所有曲面法线朝外。*这一步抓到了机翼上下表面绕序反了 —— 不修的话机翼会被背面剔除成破洞。*

**端到端（`verify.mjs`）**：无头 Edge + SwiftShader 真实渲染，页面把
`data-render / data-meshes / data-tris / data-calls / data-progs / data-error` 写进 DOM 供抓取；
再用自写 PNG 解码器分析截图：分区亮度（天空/中部/地面）、颜色丰富度、
以及**两次截图差分**（`?noplane=1` 隐藏机体）精确得到机体占屏比例、包围盒与中心位置；
最后逐个构型（弹舱/起落架/加力/飞行/线框）真跑一遍，并在腹视下对比开/闭弹舱确认舱门真的动了。

这一步抓到的真实缺陷：

1. `three.module.js` 与 `OrbitControls.js` 都在顶层声明 `const _ray`，拼进同一模块作用域
   直接「Identifier already declared」→ 整个模块解析失败、页面全白。现在 OrbitControls 被包进
   独立作用域，并且 `build.mjs` 用 `new Function` 做整包语法门禁防止再犯（它随后又抓到了
   我的 `lerp` 与 three 顶层 `lerp` 撞名）。
2. 自定义 `ShaderMaterial` 不会自动接入 three 的输出链，天空的线性色值被直接写进 sRGB
   帧缓冲 → 画面偏暗。补上 `<tonemapping_fragment>` 与 `<colorspace_fragment>` 后天空亮度
   从 93 → 155。
3. 停机坪贴图基色又乘了一遍材质颜色，反射率只剩 3%（比木炭还黑，实测亮度 19.8）。
4. 贴图用 `Math.random()` 导致两次渲染纹理不同，差分被污染成近乎整屏；改为固定种子的
   确定性随机后差分收敛到 9.3%，顺带保证了渲染结果可复现。
