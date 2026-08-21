# 滤镜参考（自动生成）

> 本文件由 `node tools/gen-docs.js` 从 `src/gl/filters/*.js` 的注册表生成，请勿手改。

当前共 **27** 个滤镜、**25** 个风格预设、**17** 套调色板。

滤镜链自上而下执行，上一个的输出就是下一个的输入。`混合(mix)` 参数为 0 时该滤镜等于不生效，
因此任何滤镜都可以无损地淡入淡出。带「跟随网格」的参数会自动沿用上游 `像素化` 的格子尺寸。

## 目录

- **调色**：[一级调色 Grade](#grade)、[双色调 Duotone](#duotone)、[色相偏移 Hue Shift](#hueshift)
- **影调**：[伪彩色 False Color](#falsecolor)、[胶片颗粒 Film Grain](#filmgrain)、[漂白旁路 Bleach Bypass](#bleachbypass)
- **自定义**：[自定义着色器 Custom GLSL](#custom)
- **光学 / 显示**：[显像管 CRT](#crt)、[高斯模糊 Blur](#blur)、[辉光 Bloom](#bloom)、[锐化 Sharpen](#sharpen)
- **故障**：[磁带录像 VHS](#vhs)、[数字故障 Glitch](#glitch)
- **像素风**：[像素化 Pixelate](#pixelate)、[调色板量化 Palette](#palette)、[色阶压缩 Posterize](#posterize)、[单色抖动 1-bit](#dither1bit)、[字符画 ASCII](#ascii)、[像素描边 Pixel Outline](#pixeloutline)
- **印刷**：[半调网点 Halftone](#halftone)
- **网格 / 屏幕**：[LCD像素格 LCD Grid](#lcdgrid)、[六边形马赛克 Hex Mosaic](#hexmosaic)
- **线稿**：[墨水描边 Edge Ink](#edgeink)、[交叉排线 Crosshatch](#crosshatch)
- **绘画**：[铅笔素描 Sketch](#sketch)、[油画桑原 Oil / Kuwahara](#oilkuwahara)、[水彩 Watercolor](#watercolor)

## 调色

### <a id="grade"></a>一级调色 Grade  `grade`

曝光、对比度、饱和度、伽马、色温与色调的基础校正。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `exposure` 曝光 Exposure | float | -3 ~ 3（步进 0.05，stops） | 0 |
| `contrast` 对比度 Contrast | float | -1 ~ 1（步进 0.01） | 0 |
| `saturation` 饱和度 Saturation | float | -1 ~ 1（步进 0.01） | 0 |
| `gamma` 伽马 Gamma | float | 0.2 ~ 3（步进 0.01） | 1 |
| `temp` 色温 Temp | float | -1 ~ 1（步进 0.01） | 0 |
| `tint` 色调 Tint | float | -1 ~ 1（步进 0.01） | 0 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="duotone"></a>双色调 Duotone  `duotone`

将亮度映射到两种颜色之间并带中点偏移。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `dark` 暗部 Dark | color | #rrggbb | #0a0a1e |
| `light` 亮部 Light | color | #rrggbb | #f2e6c8 |
| `bias` 中点偏移 Bias | float | -0.5 ~ 0.5（步进 0.01） | 0 |
| `contrast` 对比度 Contrast | float | -1 ~ 1（步进 0.01） | 0 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="hueshift"></a>色相偏移 Hue Shift  `hueshift`

HSV 色相旋转、自然饱和度与选择性色相窗口增强。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `hue` 色相 Hue | float | -0.5 ~ 0.5（步进 0.01） | 0 |
| `vibrance` 自然饱和 Vibrance | float | -1 ~ 1（步进 0.01） | 0 |
| `huecenter` 目标色相 Center | float | 0 ~ 1（步进 0.01） | 0 |
| `huewidth` 窗口宽度 Width | float | 0 ~ 0.5（步进 0.01） | 0.15 |
| `hueboost` 窗口增益 Boost | float | 0 ~ 2（步进 0.01） | 0.5 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

## 影调

### <a id="falsecolor"></a>伪彩色 False Color  `falsecolor`

按亮度映射到热成像/红外/青品三段色带。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `style` 风格 Style | enum | 0=热成像 Thermal / 1=红外绿 IR Scope / 2=青品 Cyan-Magenta | 0 |
| `gain` 增益 Gain | float | 0.5 ~ 4（步进 0.05） | 1 |
| `offset` 偏移 Offset | float | -0.5 ~ 0.5（步进 0.01） | 0 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="filmgrain"></a>胶片颗粒 Film Grain  `filmgrain`

暗角、动画胶片颗粒与褪色黑位。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `grain` 颗粒 Grain | float | 0 ~ 1（步进 0.01） | 0.3 |
| `grainsize` 颗粒尺寸 Size | float | 0.5 ~ 4（步进 0.05） | 1 |
| `vignette` 暗角 Vignette | float | 0 ~ 1（步进 0.01） | 0.3 |
| `vigsoft` 暗角柔和 Soft | float | 0 ~ 0.5（步进 0.01） | 0.1 |
| `fade` 褪色黑位 Fade | float | 0 ~ 1（步进 0.01） | 0.1 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="bleachbypass"></a>漂白旁路 Bleach Bypass  `bleachbypass`

高光去饱和、对比度挤压与亮度柔光叠加的交叉冲印效果。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `strength` 强度 Strength | float | 0 ~ 1（步进 0.01） | 0.6 |
| `contrast` 对比度 Contrast | float | 0 ~ 2（步进 0.01） | 0.6 |
| `warmth` 暖色 Warmth | float | 0 ~ 1（步进 0.01） | 0.15 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

## 自定义

### <a id="custom"></a>自定义着色器 Custom GLSL  `custom`

在面板里直接编写 GLSL（ES 1.00）并即时编译，编译错误会显示带行号的报错。

特性：源码可在界面里实时编辑

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `p1` 参数 1 | float | 0 ~ 2（步进 0.01） | 0.5 |
| `p2` 参数 2 | float | 0 ~ 2（步进 0.01） | 0.4 |
| `p3` 参数 3 | float | 0 ~ 8（步进 0.05） | 2 |
| `p4` 参数 4 | float | 0 ~ 1（步进 0.01） | 0.35 |
| `c1` 颜色 1 | color | #rrggbb | #5cc8ff |
| `c2` 颜色 2 | color | #rrggbb | #ff77a8 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

## 光学 / 显示

### <a id="crt"></a>显像管 CRT  `crt`

模拟 CRT 扫描线、荫罩与桶形畸变。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `scan` 扫描线 Scanlines | float | 0 ~ 1（步进 0.01） | 0.5 |
| `mask` 荫罩 Mask | enum | 0=关 Off / 1=栅格 Grille / 2=槽孔 Slot | 1 |
| `curve` 桶形畸变 Curvature | float | 0 ~ 0.5（步进 0.005） | 0.08 |
| `glow` 辉光 Glow | float | 0 ~ 1（步进 0.01） | 0.15 |
| `vignette` 暗角 Vignette | float | 0 ~ 1（步进 0.01） | 0.4 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="blur"></a>高斯模糊 Blur  `blur`

可分离的 9 抽头高斯模糊（水平+垂直两遍）。

特性：2 个 pass

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `radius` 半径 Radius | float | 0 ~ 4（步进 0.05） | 1 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="bloom"></a>辉光 Bloom  `bloom`

阈值提取高光后模糊并与原图叠加。

特性：3 个 pass；含降采样 pass

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `threshold` 阈值 Threshold | float | 0 ~ 1（步进 0.01） | 0.7 |
| `intensity` 强度 Intensity | float | 0 ~ 2（步进 0.01） | 0.8 |
| `radius` 半径 Radius | float | 0 ~ 4（步进 0.05） | 1 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="sharpen"></a>锐化 Sharpen  `sharpen`

反锐化掩模增强细节并钳制过冲。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `amount` 强度 Amount | float | 0 ~ 2（步进 0.01） | 0.6 |
| `radius` 半径 Radius | float | 0 ~ 4（步进 0.05） | 1 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

## 故障

### <a id="vhs"></a>磁带录像 VHS  `vhs`

模拟 VHS 色偏、行抖动、噪带与拖影。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `chroma` 色偏 Chroma | float | 0 ~ 1（步进 0.01） | 0.35 |
| `jitter` 行抖动 Jitter | float | 0 ~ 1（步进 0.01） | 0.4 |
| `noise` 噪点 Noise | float | 0 ~ 1（步进 0.01） | 0.3 |
| `ghost` 拖影 Ghost | float | 0 ~ 1（步进 0.01） | 0.25 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="glitch"></a>数字故障 Glitch  `glitch`

模拟数字视频的块位移、通道分离与整行损坏。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `amount` 强度 Amount | float | 0 ~ 1（步进 0.01） | 0.4 |
| `slices` 切片数 Slices | float | 1 ~ 64（步进 1） | 24 |
| `rgbsplit` 通道分离 RGB Split | float | 0 ~ 1（步进 0.01） | 0.5 |
| `blocks` 块量化 Blocks | float | 1 ~ 64（步进 1） | 4 |
| `mix` 混合 Mix | float | 0 ~ 1（步进 0.01） | 1 |

## 像素风

### <a id="pixelate"></a>像素化 Pixelate  `pixelate`

把画面重采样成方块/圆点/菱形网格；下游滤镜会自动沿用这个网格尺寸。

特性：会把「cell」作为像素网格传给下游

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `cell` 像素块 | float | 1 ~ 96（步进 1，px） | 8 |
| `aspect` 纵横比 | float | 0.25 ~ 4（步进 0.05） | 1 |
| `shape` 形状 | enum | 0=方块 / 1=圆点 / 2=菱形 | 0 |
| `sample` 取样 | enum | 0=中心点（硬） / 1=区块平均（干净） | 1 |
| `gap` 网格缝隙 | float | 0 ~ 0.6（步进 0.01） | 0 |
| `bg` 缝隙颜色 | color | #rrggbb | #000000 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="palette"></a>调色板量化 Palette  `palette`

把颜色映射到 Game Boy / PICO-8 / C64 等调色板，可选有序抖动，抖动图案自动对齐像素网格。

特性：使用当前调色板

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `dither` 抖动 | enum | 0=关 / 1=Bayer 8×8 / 2=棋盘 / 3=随机噪点 | 1 |
| `amount` 抖动强度 | float | 0 ~ 1.5（步进 0.01） | 0.5 |
| `scale` 图案尺寸 | float | 0 ~ 32（步进 1，0=跟随网格） | 0 |
| `gamma` 匹配 Gamma | float | 0.4 ~ 2.4（步进 0.05） | 1 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="posterize"></a>色阶压缩 Posterize  `posterize`

按通道压缩色阶（等价于降低位深），可配抖动来抵消色带。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `levels` 每通道色阶 | float | 2 ~ 32（步进 1） | 5 |
| `dither` 抖动 | enum | 0=关 / 1=Bayer 8×8 / 2=噪点 | 1 |
| `amount` 抖动强度 | float | 0 ~ 1.5（步进 0.01） | 0.6 |
| `scale` 图案尺寸 | float | 0 ~ 32（步进 1，0=跟随网格） | 0 |
| `gamma` Gamma | float | 0.4 ~ 2.4（步进 0.05） | 1 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="dither1bit"></a>单色抖动 1-bit  `dither1bit`

只保留两种颜色，用有序/随机/线条图案表现灰阶，典型「Mac Plus / 电子墨水」质感。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `pattern` 图案 | enum | 0=Bayer 8×8 / 1=随机噪点 / 2=横线 / 3=斜线 / 4=棋盘 | 0 |
| `scale` 图案尺寸 | float | 0 ~ 32（步进 1，0=跟随网格） | 0 |
| `bias` 明暗偏移 | float | -0.5 ~ 0.5（步进 0.01） | 0 |
| `contrast` 对比度 | float | 0.2 ~ 4（步进 0.05） | 1.15 |
| `dark` 暗色 | color | #rrggbb | #12131a |
| `light` 亮色 | color | #rrggbb | #eef2f7 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="ascii"></a>字符画 ASCII  `ascii`

按单元平均亮度挑选字形（字符集可在右侧「资源」里切换），支持保留原色。

特性：使用当前字符集

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `cell` 字符格 | float | 4 ~ 48（步进 1，px） | 12 |
| `contrast` 对比度 | float | 0.3 ~ 3（步进 0.05） | 1.25 |
| `color` 取色 | enum | 0=单色墨水 / 1=保留原色 / 2=原色描边 | 0 |
| `invert` 反相 | bool | 开 / 关 | false |
| `ink` 墨色 | color | #rrggbb | #8affc1 |
| `bg` 底色 | color | #rrggbb | #080a10 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="pixeloutline"></a>像素描边 Pixel Outline  `pixeloutline`

在像素网格上做色差检测并勾一格粗的轮廓线，配合像素化使用效果最好。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `cell` 网格 | float | 0 ~ 48（步进 1，0=跟随网格） | 0 |
| `threshold` 阈值 | float | 0.01 ~ 1（步进 0.01） | 0.18 |
| `mode` 模式 | enum | 0=描边叠加 / 1=仅线条 / 2=内暗外亮 | 0 |
| `line` 线色 | color | #rrggbb | #0a0a12 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

## 印刷

### <a id="halftone"></a>半调网点 Halftone  `halftone`

模拟印刷网点，可调网点大小与角度。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `cell` 网点间距 | float | 2 ~ 40（步进 0.5，px） | 8 |
| `angle` 网屏角度 | float | 0 ~ 180（步进 1，°） | 45 |
| `mode` 模式 | enum | 0=单色 / 1=彩色 CMY | 0 |
| `ink` 墨色 | color | #rrggbb | #101014 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

## 网格 / 屏幕

### <a id="lcdgrid"></a>LCD像素格 LCD Grid  `lcdgrid`

叠加液晶RGB子像素条纹与扫描线网格。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `cell` 格子大小 | float | 2 ~ 40（步进 0.5，px） | 8 |
| `contrast` 条纹对比 | float | 0 ~ 1（步进 0.01） | 0.7 |
| `gap` 间隙暗度 | float | 0 ~ 1（步进 0.01） | 0.6 |
| `scan` 扫描线 | float | 0 ~ 1（步进 0.01） | 0.25 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="hexmosaic"></a>六边形马赛克 Hex Mosaic  `hexmosaic`

六边形晶格马赛克，用最近中心算法采样。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `cell` 格子大小 | float | 2 ~ 40（步进 0.5，px） | 12 |
| `gap` 间隙 | float | 0 ~ 1（步进 0.01） | 0.12 |
| `round` 圆形色块 | bool | 开 / 关 | false |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

## 线稿

### <a id="edgeink"></a>墨水描边 Edge Ink  `edgeink`

Sobel边缘检测转为墨水描边线条。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `strength` 强度 | float | 0 ~ 1（步进 0.01） | 1 |
| `threshold` 阈值 | float | 0 ~ 1（步进 0.01） | 0.35 |
| `thickness` 描边粗细 | float | 0 ~ 1（步进 0.01） | 0.3 |
| `mode` 模式 | enum | 0=墨线叠加 / 1=白纸墨线 / 2=黑底白线 | 0 |
| `line` 线条颜色 | color | #rrggbb | #101018 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="crosshatch"></a>交叉排线 Crosshatch  `crosshatch`

按亮度阈值分层叠加四个方向的排线。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `spacing` 线间距 | float | 2 ~ 30（步进 0.5，px） | 7 |
| `thickness` 线宽 | float | 0.02 ~ 0.45（步进 0.01） | 0.35 |
| `contrast` 对比度 | float | 0 ~ 1（步进 0.01） | 0.6 |
| `ink` 墨色 | color | #rrggbb | #101018 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

## 绘画

### <a id="sketch"></a>铅笔素描 Sketch  `sketch`

铅笔素描：亮度反转叠加边缘与纸张颗粒。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `detail` 细节 | float | 0 ~ 1（步进 0.01） | 0.6 |
| `darkness` 深浅 | float | 0 ~ 1（步进 0.01） | 0.6 |
| `grain` 颗粒 | float | 0 ~ 1（步进 0.01） | 0.5 |
| `paper` 纸色 | color | #rrggbb | #f4efe6 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="oilkuwahara"></a>油画桑原 Oil / Kuwahara  `oilkuwahara`

桑原油画笔触，四象限方差加权取色。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `radius` 半径缩放 | float | 0 ~ 1（步进 0.01） | 0.4 |
| `sharp` 锐度/强度 | float | 0 ~ 1（步进 0.01） | 0.6 |
| `sat` 饱和度 | float | 0 ~ 1（步进 0.01） | 0.3 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

### <a id="watercolor"></a>水彩 Watercolor  `watercolor`

水彩：亮度分层量化并晕染出纸张渗色。

| 参数 | 类型 | 范围 / 选项 | 默认 |
| --- | --- | --- | --- |
| `bands` 色带数 | float | 2 ~ 10（步进 1） | 5 |
| `bleed` 晕染 | float | 0 ~ 1（步进 0.01） | 0.4 |
| `edge` 边缘 | float | 0 ~ 1（步进 0.01） | 0.5 |
| `sat` 饱和度 | float | 0 ~ 1（步进 0.01） | 0.2 |
| `mix` 混合 | float | 0 ~ 1（步进 0.01） | 1 |

## 风格预设

| 预设 | 说明 | 滤镜链 | 调色板 / 字符集 |
| --- | --- | --- | --- |
| 像素 8-bit | 像素块 + PICO-8 调色板 + 有序抖动 | 一级调色 → 像素化 → 调色板量化 | 调色板:pico8 |
| 大像素 + 描边 | 粗像素块、像素级描边，游戏素材感 | 像素化 → 调色板量化 → 像素描边 | 调色板:gruvbox |
| Game Boy DMG | 四阶绿 + 小像素块 + 抖动 | 一级调色 → 像素化 → 调色板量化 | 调色板:gb-dmg |
| 掌机 LCD | GB Pocket 灰阶 + LCD 像素格纹 | 像素化 → 调色板量化 → LCD像素格 | 调色板:gb-pocket |
| 红白机 NES | NES 常用配色 + 8px 网格 | 一级调色 → 像素化 → 调色板量化 | 调色板:nes |
| Commodore 64 | C64 16 色 + 宽像素（模拟 320×200） | 像素化 → 调色板量化 | 调色板:c64 |
| CGA / DOS | CGA 16 色 + 强抖动 | 一级调色 → 像素化 → 调色板量化 | 调色板:cga |
| 单色抖动 1-bit | Bayer 抖动的黑白点阵，电子墨水感 | 一级调色 → 像素化 → 单色抖动 | — |
| 报纸印刷 | 单色半调网点 + 微微偏黄 | 一级调色 → 半调网点 | — |
| 漫画分镜 | 墨线 + 色阶压缩 + 彩色网点 | 一级调色 → 色阶压缩 → 半调网点 → 墨水描边 | — |
| 终端字符画 | ASCII 字形 + 绿色磷光 | 一级调色 → 字符画 → 辉光 | 字符集:ascii |
| 彩色字符画 | 方块字形 + 保留原色 | 字符画 | 字符集:blocks |
| 街机 CRT | 像素 + 荫罩 + 桶形畸变 + 辉光 | 像素化 → 调色板量化 → 辉光 → 显像管 | 调色板:pico8 |
| VHS 1987 | 色度偏移、抖动扫描、磁带噪点 | 一级调色 → 磁带录像 → 胶片颗粒 | — |
| 故障艺术 | 块位移 + RGB 分离 + 磁带噪 | 数字故障 → 磁带录像 | — |
| 黑白电影 | 去色 + 高对比 + 颗粒暗角 | 一级调色 → 胶片颗粒 → 锐化 | — |
| 热成像 | 亮度映射到热力色带 + 辉光 | 高斯模糊 → 伪彩色 → 辉光 | — |
| 夜视仪 | 绿色红外 + 噪点 + 暗角 | 伪彩色 → 胶片颗粒 → 显像管 | — |
| 霓虹赛博 | 边缘发光 + 色相加强 + 辉光 | 一级调色 → 色相偏移 → 墨水描边 → 辉光 | — |
| 水彩 | 色带 + 纸张渗色 + 淡边缘 | 水彩 → 一级调色 | — |
| 油画 | 桑原滤波笔触 + 提饱和 | 油画桑原 → 锐化 | — |
| 铅笔素描 | 纸张纹理 + 交叉排线 | 铅笔素描 → 交叉排线 | — |
| 六边形马赛克 | 蜂巢网格 + 色阶压缩 | 六边形马赛克 → 色阶压缩 | — |
| 图文电视 | 8 色 + 粗像素块 + 扫描线 | 像素化 → 调色板量化 → 显像管 | 调色板:teletext |
| 琥珀终端 | 单色琥珀 + 点阵 + 荫罩 | 像素化 → 调色板量化 → 辉光 | 调色板:amber |

## 调色板

| id | 名称 | 色数 |
| --- | --- | --- |
| `none` | 不限制（原色） | — |
| `mono` | 黑白 1-bit | 2 |
| `mono-ink` | 墨蓝 1-bit | 2 |
| `gb-dmg` | Game Boy DMG | 4 |
| `gb-pocket` | GB Pocket 灰阶 | 4 |
| `pico8` | PICO-8 (16) | 16 |
| `nes` | NES 常用 (16) | 16 |
| `c64` | Commodore 64 | 16 |
| `cga` | CGA 16 色 | 16 |
| `zx` | ZX Spectrum | 15 |
| `teletext` | 图文电视 8 色 | 8 |
| `amber` | 琥珀单色终端 | 5 |
| `green-crt` | 绿色单色终端 | 5 |
| `sepia` | 棕褐 6 阶 | 6 |
| `gruvbox` | Gruvbox 16 | 16 |
| `vaporwave` | 蒸汽波 8 | 8 |
| `custom` | 自定义… | 2 |

## 自定义滤镜可用的 GLSL 接口

写自定义着色器（或新增滤镜文件）时，引擎会自动注入下列内容，**不要重复声明**：

```glsl

precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uStageIn;
uniform sampler2D uSrc;
uniform sampler2D uBayer;
uniform sampler2D uNoise;
uniform sampler2D uGlyph;
uniform vec2  uSize;
uniform vec2  uTexel;
uniform vec2  uSrcSize;
uniform float uTime;
uniform float uFrame;
uniform float uRandom;
uniform float uGrid;
uniform float uGlyphCount;
uniform float uPaletteCount;
uniform vec3  uPalette[32];
```

可直接调用的公共函数：

```glsl
float sat(float x){ … }
vec3 sat3(vec3 c){ … }
float luma(vec3 c){ … }
float bayer8(vec2 px){ … }
vec4 noise4(vec2 px){ … }
float hash12(vec2 p){ … }
float hash11(float x){ … }
vec3 rgb2hsv(vec3 c){ … }
vec3 hsv2rgb(vec3 c){ … }
vec3 palettize(vec3 c){ … }
mat2 rot2(float a){ … }
vec3 softLight(vec3 a, vec3 b){ … }
```

限制（GLSL ES 1.00 / WebGL1 兼容）：不能用位运算与 `%`，`for` 循环上界必须是常量，
uniform 数组只能用循环变量索引，浮点字面量必须带小数点。写完用 `node tools/lint-shaders.js` 自查。
