# ice_cave_rt — 极地冰洞光线追踪渲染器

Rust + Vulkan(`ash`)计算着色器路径追踪器,用于渲染**极地冰洞截面**:外部刺眼天光穿过
厚度不同的半透明冰壁、冰柱与冰晶薄片,在洞内折出成束体积光柱;大冰块内部因次表面散射
透出幽蓝弥散光;洞壁覆霜雾。全部为**离线渐进式渲染**(headless),输出 PNG / HDR(PFM)
/ AOV / 折射链 CSV。

- 图形 API:Vulkan 1.1+ 计算队列,直接用 `ash` 手写(实例/设备/描述符/管线/内存/同步)
- 着色器:WGSL,由 `naga` 在**进程内**编译为 SPIR-V(无需 Vulkan SDK / glslc / shaderc / CMake)
- 依赖只有两个 crate:`ash` 与 `naga`;PNG 编码、PFM 读写、色调映射全部自己实现
- 单文件着色器包含两个 entry point:`cs_render`(渐进累积)与 `cs_probe`(折射链探针)
- **另有一个单文件 WebGPU 版**:`ice_cave.html`,双击即跑,**同一份 WGSL**

---

## 0. 一键启动(浏览器版)

```
双击  start.cmd           → 用默认浏览器打开 ice_cave.html
或双击 ice_cave.html      → 完全一样(不需要服务器、不需要联网)
若被策略拦住 file:// →  双击 serve.cmd (起 127.0.0.1:8765 再打开)
```

`ice_cave.html` 是**自包含单文件**(86 KB,内嵌 WGSL + JS,无任何外链资源),要求
Chrome / Edge 113+ 或 Firefox 141+。页面能做的事:

- 5 个机位预设、鼠标拖拽转向、滚轮/WASDQE 飞行(动一下就重新累积)
- 30 多个物理参数实时滑杆:太阳高度/方位、雾 σt / 反照率 / 各向异性、冰壁吸收与散射、
  冰块 σs、IOR、霜面粗糙度与法线扰动、色散、**日华/佛光/22° 冰晕权重与尺寸参数**、
  路径长度、SDF 步数、曝光锚点/局部混合/基底压缩/细节增益/bloom/降噪
- 视图切换:成片 / 体积内散射 AOV / 次表面 AOV / 折射界面数 AOV / 纯全局曝光
- **点击画面 = 折射链探针**:立刻打印该视线逐个冰面的入射方向、法线、两侧 IOR、
  折射方向、累计偏折角、Fresnel 反射率、累计光学厚度(和原生 `--probe` 同一份代码)
- 「冰晶动态」按钮:推进时间轴,冰晶飘落 + 翻滚 + 雾平流
- 保存 PNG;右上角「面板」可收起 UI

本机实测(Edge 151,Intel Iris Xe,headless 自动化跑的):
`480×270,11–12 µs/(像素·采样),约 1 s 累积 1 spp`,与原生 Vulkan 版同一量级。

WebGPU 版与原生版的**唯一**代码差异是 push constant:naga/Vulkan 用
`var<immediate>`(SPIR-V PushConstant),而 WebGPU 没有 push constant,所以同一个
32 字节结构体被绑成普通 uniform(`@group(0) @binding(4)`)。
这一步由 `python tools/build_html.py` 自动完成 —— 场景 SDF、介质、相函数、
两个 entry point 全部逐字节相同,不存在两份实现。

```powershell
python tools\build_html.py     # shaders/ice_cave.wgsl + web/template.html -> ice_cave.html
python tools\check_html.py     # JS 语法 + 三个 WGSL 模块的 WebGPU 校验 + 宿主/着色器一致性
node   tools\webgpu_smoketest.mjs --seconds 30   # 真·浏览器无头自检(见 §6)
```

---

## 1. 需求 → 实现 → 验收证据

| 技术要求 | 实现位置 | 做法 | 可验证输出 |
|---|---|---|---|
| ① 参与介质,洞内可见光柱 | `shaders/ice_cave.wgsl` `fog_sigma_t()` / `trace_path()` | 沿光线 **delta tracking**(空气,非均匀密度,全局 majorant 无偏)+ **ratio tracking**(阴影透射率) | `*_aov_volumetric.png/.pfm`;统计行 `aov volumetric in-scatter` |
| ② 次表面散射(冰块内幽蓝弥散) | `medium_of()` + `trace_path()` 的 homogeneous 分支 | 冰体内**暴力体积随机游走**(非 dipole/BSSRDF 近似),每个内部散射点做 NEE;吸收谱红高蓝低 → 多次散射后偏蓝 | `*_aov_subsurface.png/.pfm`;`preset block` |
| ③ 多次折射方向累积 | `trace_path()` 表面分支 + `probe_medium()` | 精确 Fresnel 反/折射,穿界后用 SDF 符号**探测新介质**(支持嵌套),方向逐界累积 | `*_aov_refractions.png`、`--probe X,Y` 生成的 `*_probe.csv` 与终端表格 |
| ④ 反射+透射混合、霜面法线扰动 | `fresnel_dielectric()`、`sample_ggx_normal()`、`frost_normal()` | GGX 扰动微面法线 + 精确介电 Fresnel 概率分流(反射/折射);霜面用高频噪声梯度做切向法线扰动 | `--rough` / `--frost-amp` 对比渲染 |
| ⑤ 局部/全局 HDR 曝光 | `src/post.rs` | Durand & Dorsey:log10 域 **双边滤波 base/detail 分解** + 基底压缩 + 细节增益,叠加 ACES(Hill 拟合)全局曲线、bloom、sRGB 编码 | 终端 `HDR p05/p50/p95/max`、`base span … dec`、`--regrade` 重新调色 |
| 加分:冰晶动态 | `map()` 冰晶片场 + `setup_globals()` | 晶格整体飘落 + 每胞哈希轴向翻滚(`--frames/--fps` 输出序列) | `--frames 24 --fps 12` |
| 加分:佛光衍射 | `phase_eval()` / `phase_pdf()` / `sample_phase()` | Airy 前向日华 + **背向佛光(antisolar glory)** + 22° 冰晶晕,三个**解析归一化**相函数瓣,按 RGB 尺寸参数分色;采样端用 4 瓣混合重要性采样(无偏) | `preset glory`、`--glory/--corona/--halo/--xsize` |

验收标准对应的数值证据(终端每帧打印,以下为本机实测,Intel Iris Xe):

| 镜头 | 分辨率/spp | 时间 | HDR p05 / p50 / p95 / max | p95/p05 | base 跨度 | 超白点 | 体积光柱 均值/点亮% | 次表面 均值/% | 折射界面数分布(每像素均值) |
|---|---|---|---|---|---|---|---|---|---|
| hero    | 960×540 /160 | 909 s | 0.0167 / 0.139 / 0.83 / 17.3 | 50× | 1.83 dec | 5.9% | 0.073 / 63.0% | 0.088 / 51.4% | 1:83.3% 2:15.6% 3:1.0% (max 4.00) |
| shafts  | 640×360 /80 | 150 s | 0.0087 / 0.157 / 1.76 / 16.4 | 203× | 1.93 dec | 11.1% | **0.222 / 65.0%** | 0.076 / 50.6% | 1:49.5% 2:17.6% **3:31.2%** 4:1.6% (max 4.68) |
| block   | 640×360 /80 | 355 s | 0.0342 / 0.190 / 1.11 / 12.9 | 33× | 1.85 dec | 11.8% | 0.073 / 61.4% | **0.173 / 66.7%** | 1:55.2% 2:42.2% 3:2.6% (max 3.53) |
| glory   | 640×360 /80 | 195 s | 0.0033 / 0.082 / 0.33 / 11.0 | 100× | 1.91 dec | 6.2% | 0.054 / 50.2% | 0.029 / 30.2% | 1:87.6% 2:12.0% 3:0.4% |
| section | 640×360 /80 | 86 s | 0.0795 / 0.976 / 6.33 / 15.5 | 80× | 1.85 dec | 16.5% | 0.208 / 46.3% | 0.048 / 43.0% | 0:25.8% 1:54.6% 2:18.4% 3:1.1% (max 4.79) |

> `hero` 一行是用最终代码(含 §7b 全部修正)重跑的;`shafts / block / glory / section`
> 四行测于修正 #1、#2 之前。这两项修正主要影响**"折射界面数"这一列**
> —— 修正前同一个界面在掠射角下会被计两次,所以旧行的界面数偏高一档;
> 其余各列的差异在噪声量级内。

- **洞内明显体积光柱**:`shafts` 镜头体积内散射均值 0.222、65% 像素被点亮;
  `*_aov_volumetric.pfm` 里能直接量出光柱位置(终端 ASCII 图上是一条从天窗贯到地面的亮带)
- **冰块幽蓝弥散**:`block` 镜头次表面通道均值 0.173、66.7% 像素有贡献;冰块核心显示亮度
  0.65、B/R = 1.21,而周围阴影侧 B/R = 1.57 —— 中心亮而偏白、边缘偏蓝,正是灯芯式弥散
- **多层冰面方向可追踪**:`shafts` 镜头有 **31.2% 的像素平均跨过 3 个介电界面**、1.6% 跨过 4 个
  (光柱先穿冰晶薄片再穿冰壁);`--probe X,Y` 逐界面输出
  入射方向 / 法线 / 两侧 IOR / 折射方向 / 与原始视线的累计偏折角 / Fresnel 反射率 /
  累计光学厚度。hero 中心偏下那条视线的实测链条(最终代码):

  ```
  probe pixel (470,300): 3 boundary events along the deterministic refracted branch
   #  material          kind     incident dir            normal                  refracted dir           dev   R      tau
   1  ice-wall(shell)   refract  ( 0.114,-0.029, 0.993)  ( 0.142, 0.709,-0.690)  ( 0.044,-0.239, 0.970)  12.8  0.026  0.000
   2  ice-wall(shell)   refract  ( 0.044,-0.239, 0.970)  ( 0.199,-0.000,-0.980)  ( 0.124,-0.313, 0.942)  16.6  0.018  6.204
   3  snow              opaque   ( 0.124,-0.313, 0.942)  ( 0.000, 1.000, 0.000)  -                        -     -     6.204
  ```
  即:进入冰壁偏折 12.8° → 在冰内走出 τ=6.20 的光学厚度 → 出射面再偏折到累计 16.6° →
  终止在雪面。同一条 CSV 里还能看到 Fresnel 反射率 2.6% / 1.8%(接近垂直入射)。
  浏览器版点一下画面就能得到同样的表。
- **外亮内暗层次分明**:hero 的 HDR 从 p05=0.017 到 max=17.3 跨越约 1000×;
  显示域 p05=0.045、p50=0.377、p95=0.816,1.04% 纯黑 + 0.03% 纯白 —— 洞口过曝、
  洞壁深处压到黑、洞内中间调保留细节;
  `section`(外→内截面)则是洞口一片死黑嵌在过曝雪原里

---

## 2. 构建与运行

### 2.1 本机(已配置好,免装全局 Rust)

工作区内已安装独立工具链(`../.toolchain`),并用 MSVC 链接器 + Windows SDK:

```powershell
# 构建
powershell -NoProfile -ExecutionPolicy Bypass -File build.ps1 build --release
# 运行(直接跑 exe 即可,不需要 MSVC 环境)
.\target\release\ice_cave_rt.exe --help
```

`build.ps1` 做三件事:把 `RUSTUP_HOME/CARGO_HOME` 指向 `../.toolchain`;注入
`link.exe`(HostX86\x64)与 `LIB`(ucrt/um x64);然后调用 cargo。
(本机 `cmd.exe` 下 `vcvars*.bat` 会超出 8191 字符命令行上限,所以只注入 rustc 真正需要的
三个变量。)

### 2.2 任何标准环境

只要有 Rust ≥ 1.75 与能用的链接器:

```bash
cargo build --release
./target/release/ice_cave_rt --preset hero --width 1280 --height 720 --spp 256 --out out/hero.png
```

运行期只需要一个可用的 **Vulkan 1.1 loader + 支持计算的设备**(不需要硬件光追扩展)。
`--list-gpus` 可枚举设备,`--gpu N` 指定。

### 2.3 一键出图 / 一键自检

```powershell
# 全部镜头(hero 960x540/160spp,其余 640x360/80spp)+ AOV + 折射链 + 冰晶动画
powershell -NoProfile -ExecutionPolicy Bypass -File render_all.ps1 -Anim
powershell -NoProfile -ExecutionPolicy Bypass -File render_all.ps1 -Quick   # 低分辨率快速版

# 端到端自检:相函数数值校验 → 设备枚举 → 渲染+AOV+探针 → 终端看图(约 1 分钟)
powershell -NoProfile -ExecutionPolicy Bypass -File verify.ps1
```

---

## 3. 命令行

`--help` 有完整列表,常用:

```
--preset hero|shafts|block|glory|section     预设机位
--width/--height/--spp/--out                 分辨率、采样数、输出
--hdr --aov                                  另存 .pfm 与 AOV(假彩 + 灰度 pfm)
--probe X,Y [--probe-max N]                  折射链探针 → csv + 终端表格
--frames N --fps F                           冰晶动态序列
--sun-el/--sun-az/--sun/--sky/--sun-radius   光照
--fog/--frost/--fog-albedo/--fog-g/--fog-height   参与介质
--wall-ss/--wall-sa/--block-ss/--ior/--rough/--frost-amp/--dispersion  冰的光学参数
--corona/--glory/--halo/--xsize              衍射瓣权重与尺寸参数
--exposure/--anchor/--local/--decades/--detail/--bloom/--sat  色调映射
--denoise F                                  蒙特卡洛颗粒抑制 0..1(默认 0.75)
--regrade FILE.pfm                           不重渲染,只重新调色/降噪
--print-params                               打印解析后的物理参数
--tile/--budget-ms                           分块与每次提交的 GPU 时间预算(TDR 安全)
```

---

## 4. 结构

```
ice_cave_rt/
├─ ice_cave.html         ★ 单文件 WebGPU 版(双击即跑,由 build_html.py 生成)
├─ start.cmd / serve.cmd   一键启动 / 本地 HTTP 兜底
├─ Cargo.toml            仅 ash + naga
├─ build.ps1             本机构建脚本(工具链 + MSVC 链接环境)
├─ render_all.ps1        批量出图(5 个镜头 + 动画)
├─ verify.ps1            端到端自检(数学校验 + 渲染 + 终端看图)
├─ shaders/ice_cave.wgsl 场景 SDF + 路径积分器 + 相函数 + 两个 entry point(两版共用)
├─ web/
│  ├─ template.html      WebGPU 宿主(JS)+ base/display 两个后处理 WGSL 模块
│  └─ ice_cave.*.wgsl    生成出来供 --validate-only 校验的三个模块
├─ src/
│  ├─ main.rs   CLI、分块渐进调度、回读、统计、AOV/探针输出
│  ├─ gpu.rs    Vulkan:实例/设备/队列/命令缓冲/host-visible 缓冲/描述符/两条计算管线/屏障
│  ├─ shader.rs naga:WGSL → SPIR-V(IMMEDIATES),以及 --validate-only 的 WebGPU 能力集校验
│  ├─ scene.rs  uniform 布局、物理默认值、机位预设、参数打印
│  ├─ post.rs   自适应双边降噪、自动曝光、bloom、双边 base/detail 局部色调映射、ACES、假彩色
│  └─ png.rs    PNG(zlib stored + CRC32/Adler32)、PFM 读写
└─ tools/
   ├─ build_html.py       生成单文件 HTML(唯一改动:push constant → uniform)
   ├─ check_html.py       HTML 静态自检(JS 语法 / WGSL 校验 / 宿主一致性)
   ├─ webgpu_smoketest.mjs 用 DevTools 协议在真浏览器里跑一遍并截图
   ├─ imgview.py          终端图像检视器(ASCII 亮度图/色相图/分区统计,PNG 与 PFM)
   └─ check_math.py       相函数/衍射公式的数值积分校验
```

数据流:`WGSL → naga → SPIR-V → vkCreateShaderModule → 两条 compute pipeline`;
`Params`(352 B uniform)+ `Push`(32 B immediate:tile 与采样区间)→
`accum`(RGBA32F 累积)、`aovbuf`(体积/次表面/折射数/首击距离)、`probebuf`(折射链记录)。
所有缓冲都是 `DEVICE_LOCAL|HOST_VISIBLE|HOST_COHERENT`(集显直接映射,无 staging 拷贝),
命令缓冲结尾带 `SHADER_WRITE → HOST_READ` 屏障。

**TDR 安全**:每次 `vkQueueSubmit` 只渲染一个 tile(默认 96×96)的若干 spp,主机侧根据
实测耗时自适应调整每次提交的 spp,使单次提交约 `--budget-ms`(默认 220 ms),
远低于 Windows 2 s 的 GPU 看门狗阈值;因此高 spp 长任务不会被驱动重置。

---

## 5. 物理与数值细节

### 5.1 场景表示
解析 SDF:洞腔为沿 z 蜿蜒的管道(`tube_center/tube_radius`,深处收窄到闭合 → 洞底全黑,
洞口外扩);冰壳 = `max(-f, f - thickness(p))`,厚度自洞口 0.42 m 渐变到深处 8 m ——
这正是"厚度不同的半透明冰壁";洞口用抖动平面切出不规则拱形;地面是解析平面(y=0,雪),
避免掠射 ray marching 的步数爆炸。

**天窗**:8 个"太阳对齐"缝隙 —— 长轴严格沿太阳方向的细长盒(0.2–0.7 m 宽),
因此阳光穿过冰壳时**不会被缝壁裁切**,进洞后是准直光柱而不是散开的扇形;
盒体只朝太阳一侧延伸(`c0 + sun·4.35`,半长 4.65),因此绝不会从洞腔另一侧穿出去。
A、C 两条缝被特意加宽(0.72 m / 0.60 m),并瞄准打在两块次表面散射冰块顶面上
(几何解:光行进方向 `-sun`,从缝底 y≈4.6 落到冰块顶面 y≈1.1 需 t=(4.6-1.1)/sinθ_sun)。
另有 2 个"冰桥"从缝中减去,把光柱切成斑驳段落。

太阳:高度角 42°、方位角偏离洞轴 35°。这两个数字很关键 ——
太阳如果接近洞轴,阳光会顺着 20 m 的洞筒一路照进来,把光柱冲淡成一片均匀雾光;
偏轴 35° 后进洞的直射光很快打到侧壁,**深处只由天窗光柱照明**。

Sphere tracing 用 0.62 步长系数;只有真正**过冲**(d<0)才做 6 次二分细化,
命中精度与速度兼顾。法线用 4 次采样的四面体差分。

### 5.2 参与介质(雾)
`fog_sigma_t(p)` = 基础雾 × (0.10 + 0.90·e^(−k·y)) + **贴壁霜雾** `exp(min(f,0)·2.2)`
(f 为洞腔 SDF,壁面处为 1,向内指数衰减),再乘随时间平流的正弦湍流。
高度项几乎不留常数底:雾必须**贴地贴壁**,否则沿 20 m 洞筒看过去光学厚度会到 3–6,
整个洞变成一个发光的奶白盒子,光柱就没了。默认 σt = 0.40/m(地面)+ 0.14/m(贴壁),
高度 e-folding 0.83 m。

- 距离采样:**delta tracking**,全局 majorant(主机按同一公式解析给出 `fog.w = fog_base + fog_frost`),
  真碰撞概率 σ(p)/σ̄,无偏;
- 阴影透射率:**ratio tracking**,`tr *= 1 - σ(p)/σ̄`,无偏;
- 雾的单次散射反照率 < 1(0.86,含尘/冰晶),这是让"光柱成束"而不是被多次散射糊成
  一个发光箱的关键。

### 5.3 冰内介质与次表面散射
冰体按材质给 (σs, σa, g)。均匀介质用**平均 σt 采样距离 + 逐通道谱权重**修正:

```
d ~ Exp(σ̄t),  σ̄t = mean(σt)
散射: β *= exp(-σt·d)·σs / (σ̄t·exp(-σ̄t·d))
穿透: β *= exp(-σt·t_hit) / exp(-σ̄t·t_hit)
```

无偏且在通道差异不大时方差很低。冰壳取"清澈冰":吸收主导且强烈偏红
(σa=(5.5,1.8,0.62)/m,σs=(0.68,0.80,0.92)/m)→ 单次散射反照率 (0.11,0.31,0.60),
厚度直接翻译成深蓝:0.42 m 薄斑透过率约 (0.08,0.26,0.34),而 4 m 冰壁只剩 1e-4 量级;
冰块取"含气泡冰":σs=(4.14,4.50,4.95)/m、σa=(0.30,0.07,0.022)/m →
单次散射反照率 (0.932,0.985,0.996),随机游走多次后红光被吃掉,
呈现**灯芯般幽蓝弥散透亮**(实测冰块核心区亮度 0.65、B/R 1.21,而周围阴影侧 B/R 1.57)。

轮盘赌上限设为 0.88:高反照率介质靠反照率本身永远不会终止游走,这个上限同时限制了
随机游走长度,且 1/q 重加权保持无偏。

### 5.4 阴影射线穿过介电界面
镜面折射无法做 NEE,所以对**阴影射线**采用工业界常用的"直线穿透 + 衰减"模型:
穿过每个介电界面乘 (1-Fresnel),每段冰内乘 Beer-Lambert `exp(-σt·L)`,
空气段用 ratio tracking;遇到不透明雪面返回 0;界面预算(默认 8)用尽则**返回 0**
(保守,不泄漏光)。这既让薄壁发光/厚壁转黑,也让冰块内部的每个散射点都能高效取到太阳光。

### 5.5 表面 BSDF
按 GGX 分布采样扰动微面法线 m(先叠加霜面噪声梯度扰动),再对 m 做**精确介电
Fresnel 概率分流**:`rnd() < F` 走反射,否则走折射(全内反射时退化为反射)。
穿界后用 `probe_medium(p + rd·ε)` 的 SDF 符号判定新介质,天然支持嵌套与冰-冰界面
(η=1,不偏折)。冰晶薄片额外做 **hero-wavelength 色散**:按 1/3 概率选 R/G/B 通道并
偏移 IOR(`--dispersion`),用 3×掩码补偿,得到彩色焦散。

### 5.6 相函数与衍射(佛光)
```
p(θ) = w_b·HG(g) + w_c·Airy(θ; x_λ) + w_g·Airy(π-θ; 0.3x_λ) + w_h·Ring(θ; 22°_λ)
```
- Airy 瓣解析归一化:`[2J1(u)/u]²·x²/(4π)`,`u = x·sinθ` —— 利用 `∫₀^∞ J1²(u)/u du = 1/2`,
  在小角近似下积分恰为 1;`J1` 用 Abramowitz & Stegun 9.4.4/9.4.6 多项式
- 三通道 `x_λ ∝ 1/λ`(620/545/460 nm → 0.742/0.876/1.043),因此日华与佛光**自然分色**
- 22° 晕:窄高斯环,归一化 `1/(2π·sinθ·σ·√π)`,红内蓝外(21.5°/22.0°/22.6°)
- 采样端用 **4 瓣混合**(HG(g)、HG(0.95)、HG(-0.90)、22° 高斯环)重要性采样,
  pdf 取混合 pdf,与 `phase_eval` 严格配对 → 尖锐瓣不产生 firefly,且估计无偏

`tools/check_math.py` 用数值积分独立校验了这一整套公式(与 J1 的积分定义对比、
各瓣在球面上的积分、混合 pdf 的归一性):

```
1) J1: worst |err| = 2.18e-08 over x in [1e-3, 55]
2) Airy 瓣前向半球积分: 0.9937 / 1.0014 / 0.9991 / 0.9993 / 1.0003  (x = 20…160)
3) 22° 晕三通道球面积分: 1.00000 / 1.00000 / 1.00000
4) HG: 积分 1.00000,<cosθ> 精确等于 g(g = 0, .5, .62, .82, .95, -.9)
5) 4 瓣混合 pdf 球面积分 = 1.00000
6) 完整相函数(绿通道)球面积分 = 0.9998   → 能量守恒
```

### 5.7 光源与 MIS
太阳为圆盘(`--sun-radius`,cone 采样,pdf = 1/(2π(1-cosθmax)));天空为解析梯度穹顶,
含小系数的日周光环(系数 5e-5:整个光环大约携带天穹一半的辐照度;更大的值会变成
一个巨大柔光箱,把光柱冲淡 —— 这是调试中实测到的主要"漏光"源)。
NEE 只对太阳做,天空由 BSDF/相函数采样命中;两者用**平衡启发式 MIS** 合并,
镜面顶点标记为 delta(权重 1),因此不会重复计数。

### 5.8 曝光(局部 + 全局)
1. 用**未曝光帧**的 log10 亮度做 1/4 分辨率**双边滤波**得到 base 层(空间 σ=5px、值域
   σ=0.45 dec,13×13→17×17 窗口),再双线性上采样;
2. 自动曝光 = `10^(anchor - p99.5(base))`:把"最亮的大面积区域"锚定到 10^anchor
   (默认 0.15),因此洞口/天空远超白点而过曝,小而极亮的太阳盘不会劫持曝光;
3. bloom:阈值亮部 6 级金字塔渐进上采样;
4. 局部算子:`L' = 10^((base-anchor)·comp + detail·gain + anchor)`,
   `comp = min(target_decades/span, 1)`;与全局结果按 `--local` 混合;
5. ACES(Stephen Hill 拟合 RRT+ODT)+ sRGB OETF。

`--regrade x.pfm` 可以在毫秒级重复第 1–5 步,不重新渲染。

### 5.9 蒙特卡洛颗粒抑制(`--denoise`,默认 0.75)
在**线性 HDR、曝光之前**跑一遍自适应交叉双边滤波:
1. 用 3×3 中值残差的 MAD×1.4826 估计本帧自身的颗粒尺度 σ_n(log 亮度域);
2. 值域权重取 σ_r = 1.6·strength·σ_n —— 必须不小于颗粒本身,否则滤波器会把自己的噪声
   当成边缘而什么都不做;本场景真实边缘跨 2 个数量级以上(>4.6 log),比颗粒高一个量级,
   因此不会被抹掉;
3. 空间核 σ=2.5、9×9 窗;三个通道共用同一组权重,因此彩色麻点也一起消掉;
4. 结果按 strength 与原图混合。

实测(hero,960×540/160spp):颗粒 p50 从 0.0667 降到 0.0431(−35%),
4×4 块级结构相关度仍为 0.998。`.pfm` 始终保存**未降噪**的原始累积,
所以任何时候都可以 `--regrade --denoise 0` 拿回原始颗粒。

---

## 6. 自检工作流

```powershell
# 1) 渲染 + AOV + HDR + 折射链
.\target\release\ice_cave_rt.exe --preset hero --width 640 --height 360 --spp 96 `
    --out out\hero.png --hdr --aov --probe 300,150

# 2) 终端里"看"图(ASCII 亮度图 + 色相图 + 分区统计)
python tools\imgview.py out\hero.png --cols 120 --rows 30 `
    --region 0.45,0.05,0.75,0.45 mouth --region 0.0,0.3,0.2,0.9 deep-wall

# 3) 只看体积光柱通道(线性 pfm,log 显示映射)
python tools\imgview.py out\hero_aov_volumetric.pfm

# 4) 相函数/衍射公式的数值自检(与积分定义、球面积分对比)
python tools\check_math.py

# 5) 浏览器版自检:静态 + 真·无头浏览器(会输出 out\web_shot.png)
python tools\check_html.py
node   tools\webgpu_smoketest.mjs --seconds 30
python tools\imgview.py out\web_shot.png --cols 104 --rows 24

# 6) 重新调色
.\target\release\ice_cave_rt.exe --regrade out\hero.pfm --out out\hero_bright.png --anchor 0.35
```

`webgpu_smoketest.mjs` 用 DevTools 协议启动无头 Edge/Chrome(**故意不加**
`--allow-file-access-from-files`,以模拟直接双击),导航到 `file:///…/ice_cave.html`,
渲染若干秒后:读回页面自己的状态行、**合成一次画面点击以触发折射链探针**、抓一张截图,
再断言「有累积 spp」且「探针有输出」。本机实测输出:

```
480×270   累计 18 spp   229 ms/帧 (5 tile)
曝光 1.11e+0   基底跨度 2.64 dec   压缩 0.59
11.2 µs/(像素·采样)   intel / gen-12lp
折射链探针 @ 像素 (225, 167) — 2 个界面事件
 1  ice-wall(shell)   refract  ( 0.028, 0.181, 0.983) → (-0.224, 0.571, 0.789)  偏折 29.2°  R=0.258
 2  ice-wall(shell)   refract  (-0.224, 0.571, 0.789) → (-0.103, 0.430, 0.897)  偏折 16.9°  R=0.025  τ=4.93
PASS: WebGPU rendered 18 spp and the refraction probe answered
```

`tools/imgview.py` 只依赖 numpy(PNG 用标准库 zlib 解),它输出:
亮度直方统计、ASCII 亮度图、色相图(B=强蓝/w=中性/y=偏暖)、任意矩形区域的
亮度与 B/R 比 —— 用于在没有图形界面的环境下判断构图与色彩。

---

## 7. 已知近似(均为显式的物理近似,不是未完成项)

1. 阴影射线不沿折射方向弯折(仅衰减)。这是生产渲染器的标准做法(否则透过冰壁的
   直接光需要焦散级别的采样量);因此透过冰壁的光"不发散",但厚度-亮度关系与颜色正确。
2. 界面预算(`--shadow-cap`,默认 8)与路径长度(`--bounces`,默认 28)有限;
   超限按"遮挡"处理(保守,不加亮)。
3. 单样本亮度上限 900(firefly clamp),仅在极端尖锐瓣命中时生效。
4. 洞外空气用解析均匀霾(`--haze`)近似空气透视,且**只对落在洞体积之外的那段光程生效**
   (否则会悄悄抬亮洞内暗部 —— 调试时实测这一项会把 p05 从 0.0004 抬到 0.021)。
5. 相函数按 RGB 三通道估计,不是全光谱渲染;色散只在冰晶薄片上做 hero-wavelength 采样。
6. SDF 使用 0.62 步长系数 + 过冲二分;界面判定的偏移量沿**法线**且随距离线性放大
   (`surf_offset(t) = 3 mm + 0.6 mm/m`),避免同一界面被判定两次;极远处 ~1 cm 级薄片
   仍可能被跳过,可用 `--steps` 提高。
7. bloom 是艺术化的眩光扩散(阈值 + 金字塔渐进上采样),不严格能量守恒。
8. WebGPU 版的局部色调映射用 1/8 分辨率单趟交叉双边 base 层(原生版是 1/4 分辨率
   + 更宽的窗口),降噪是 5×5 而不是 9×9 —— 都是为了每帧都能跑完,画面观感一致但
   数值不会与原生版逐像素相同。

## 7b. 本轮修正的已知问题

| # | 问题 | 修正 |
|---|---|---|
| 1 | 掠射角下 ~1.4 cm 的冰晶薄片会被步过,晶片场闪烁 | 命中 epsilon 系数 3.5e-4/m → 2.5e-4/m;薄片半厚 8–13 mm → 11–17 mm |
| 2 | 同一界面被判定两次:探针里出现 η=1、R=0 的重复行,折射界面计数虚高 | 介质探测与出射原点的偏移改为**沿法线**(掠射角下沿光线方向几乎不改变 SDF)且随距离线性放大 |
| 3 | `--save-every` 的中途预览没有走降噪,和最终帧不一致 | 预览同样走 `post::denoise` |
| 4 | Bessel J1 渐近分支少乘 √(2/π),日华/佛光的**环**振幅偏小 36% | 改为 A&S 9.4.6 原式 `f1·cos(θ1)/√x`,并用 `check_math.py` 与积分定义对比锁死 |
| 5 | (Web)未收敛时大量 0 值像素把 base 跨度拉到 5.8 dec,压缩过头、画面发灰 | base 下限改用 5% 分位,跨度夹在 [0.8, 3.0],曝光反馈加 0.6 阻尼 |
| 6 | (Web)AOV 假彩色的归一化误用了 bloom 通道 | 改为固定物理尺度(体积/次表面 0.8,折射计数 4.0)× 用户增益滑杆 |
| 7 | (Web)初始化失败时页面只显示"初始化…",看不出卡在哪一步 | 分步 boot 状态 + adapter 二次回退 + 控制台日志 + 明确的错误页(附 `edge://gpu` 排查指引) |
| 8 | (Web)默认每帧 GPU 预算固定 110 ms,收敛太慢 | 预算改成滑杆(默认 220 ms),按实测帧时自适应 tile 数;480×270 约 1 s/spp |
| 9 | 着色器注释里的一个反引号会破坏 HTML 里的 JS 模板字符串 | 去掉反引号,并在 `build_html.py` 里加断言,防止再犯 |

## 8. 性能参考(Intel Iris Xe 96EU,集显)

| 镜头/分辨率 | spp | 时间 |
|---|---|---|
| 256×144 | 16 | ≈ 9 s |
| 384×216(动画每帧) | 32 | ≈ 26 s |
| 640×360 section | 80 | 86 s |
| 640×360 shafts | 80 | 150 s |
| 640×360 glory(浓雾) | 80 | 195 s |
| 640×360 block(重次表面) | 80 | 355 s |
| 960×540 hero | 160 | 999 s |

约 8–20 µs / (像素·采样),次表面散射重的镜头最慢(每个内部散射点都要发一条跨界面的
阴影射线)。`--tile`/`--budget-ms` 不影响画质,只影响提交粒度。想更快可以降 `--steps`、
`--bounces`、`--shadow-cap`,或把 `--fog` 调小。

---

## 9. 调试纪要:四个把"光柱"冲掉的物理陷阱

这些都是实际测出来的,记录下来因为它们比代码本身更难重新发现:

1. **日周光环系数过大**。`sky_radiance` 里的 aureole 项系数原来是 1.6e-3,配合太阳辐亮度
   6e4,这个"光环"的辐照度居然是太阳本身的 3 倍多,而且铺开在 20° 视场里 ——
   等于给洞口架了一台巨大柔光箱,洞内被均匀照亮,光柱全没了。降到 5e-5 后光柱立刻回来。
   *诊断方法*:分别把 `--sun 0.0001` / `--sky 0.0001` 渲一遍,发现两者之和只有全图的 35%,
   剩下的 65% 必然来自与两者都相乘的项 —— 即 aureole。
2. **冰壳"奶白"化**。一开始把冰壳当高散射介质(σs=3.2/m),单次散射反照率 0.95,
   于是冰壁变成了雪一样的漫反射体,把光又反回洞里;真实冰川冰是**吸收主导**的,
   改成 σa=(5.5,1.8,0.62)/m、σs≈0.8/m 之后,厚度才真正翻译成"薄处发蓝光、厚处全黑"。
3. **阴影射线的直穿近似 + 冰壁光学厚度不足**。因为阴影射线是直穿衰减的,只要冰壁的
   光学厚度不够大,太阳就会"透过整面墙"照亮洞里的每一团雾,光柱被均匀雾光淹没。
   必须让典型壁厚的 τ 落在 4–10。
4. **空气透视被算到洞里**。均匀霾项原来按整段光程施加,洞内 20 m 的视线也被加了
   一层天空色 —— p05 从 0.0004 被抬到 0.021,暗部全灰。改成只对洞体积之外的光程生效。

另外两个数值坑:
- `naga` 30 里 WGSL 的 push constant 地址空间叫 `var<immediate>`(不是 `var<push_constant>`),
  并且需要在 validator 里打开 `Capabilities::IMMEDIATES`;
- Bessel J1 的渐近式(A&S 9.4.6)是 `J1 = f1·cos(θ1)/√x`,少乘/多乘一个 √(2/π) 会让
  日华/佛光的**环**振幅差 36%,而峰值几乎看不出来 —— 靠 `tools/check_math.py` 与积分定义
  对比才抓到。
