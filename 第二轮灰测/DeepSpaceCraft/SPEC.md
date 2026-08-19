# DEEP SPACE CRAFT · 项目契约（所有模块必须遵守）

> 网页游戏：《我的世界》方块玩法 + 像素画风 × 《无人深空》星际飞行 / 大气层进入 / 扫描发现 / 橙蓝科技风 UI。
> **零依赖**：纯 WebGL2 + WebAudio + DOM。**file:// 双击 index.html 即玩**。

## 0. 铁律（违反即返工）

1. 禁止任何外部资源：不 `fetch`、不 `import`、不 XHR、不加载图片/音频/字体文件、不用 CDN。
   所有贴图 = canvas 程序化像素画；所有音效 = WebAudio 程序化合成；字体 = 系统字体栈。
2. 全部 JS 为 **classic script**（无 ESM），文件顶部 `(function(){ 'use strict'; ... })()` 包裹，
   产物挂到全局命名空间 `window.DSC`。禁止 `export` / `import` / `type="module"`。
3. UTF-8 中文注释与文案 OK（index.html 已声明 charset）。
4. 性能：目标 60fps @1080p。禁止每帧 new 大数组、禁止每帧字符串拼接构建 DOM。
5. 每个文件必须能被 `node --check` 通过（纯语法层面，不依赖浏览器 API 在加载期执行）。
   —— 即：**加载时只做定义，不做 DOM/GL/Audio 调用**；一切副作用放在 `init()` 里。

## 1. 美术圣经

### MC 侧（地表/方块）
- 贴图 **16×16**、硬边像素、无渐变、无抗锯齿；每种材质 3~5 级色阶 + 手工噪点/抖动。
- 采样 `NEAREST`、不生成 mipmap，保持"锐利马赛克"。
- 面明暗常量（在着色器里乘）：顶 1.0 / 南北 0.82 / 东西 0.68 / 底 0.52，再叠 4 角环境光遮蔽（AO）。
- 参考色（可微调，别偏离手感）：草顶 `#79C05A`，泥土 `#8B6849`，石 `#7E7E7E`，沙 `#DBCE9B`，
  原木侧 `#6B5333`，树叶 `#4F7F2B`，水 `#3E76E4`，雪 `#F2F5F7`，冰 `#8FB8FF`，钻石矿 `#5FE8E0`。

### NMS 侧（天空/星球/UI）
- 主强调色 **琥珀橙** `#FFA03C` → `#FF6A00`（危险/交互/曲速）；副色 **电青** `#46E0FF`（扫描/信息/护盾）。
- 面板：半透明深空蓝黑 `rgba(7,16,24,.80)`，1px 描边 `rgba(255,180,106,.35)`，只在四角画"括号"角标。
- 元素语言：六边形、细虚线弧、菱形 bullet、圆形径向"按住"进度环、等宽大写小字距文本、
  轻微扫描线 + 暗角 + 极淡色差。禁止圆角大按钮、禁止 Material 阴影。
- 星球：远景为球体（大气边缘散射光晕 + 昼夜终结线 + 云层 + 极冠）；接近时无缝过渡到方块地表。

## 2. 文件清单与加载顺序（index.html 里就是这个顺序）

```
css/ui.css
js/math.js      DSC.M4 / DSC.V3 / 工具数学        [已完成·契约见 §3]
js/gl.js        DSC.GL WebGL2 封装                [已完成·契约见 §3]
js/noise.js     DSC.Noise 噪声                    [核心]
js/textures.js  DSC.Textures 程序化贴图图集        [委派 B·契约 §5]
js/audio.js     DSC.Audio 程序化音频引擎           [委派 A·契约 §6]
js/lore.js      DSC.Lore 程序化命名/文案           [委派 D·契约 §7]
js/spacefx.js   DSC.SpaceFX 星空/星球/曲速渲染      [委派 E·契约 §8]
js/blocks.js    DSC.Blocks 方块注册表              [核心·契约 §4]
js/models.js    DSC.Models 飞船等 box 模型
js/world.js     DSC.World 区块/生成/网格/射线
js/render.js    DSC.Render 体素+天空+粒子
js/player.js    DSC.Player 物理/挖掘/放置/背包
js/space.js     DSC.Space 星系场景与飞行
js/transition.js DSC.Transition 大气层进入/离开序列
js/ui.js        DSC.UI HUD/菜单/通知
js/save.js      DSC.Save localStorage 存档
js/main.js      DSC.Game 状态机与主循环
```

## 3. 已有底座 API（委派模块只准用这些，别自己建 GL 状态）

```js
DSC.GL.init(canvas)                  // -> gl(WebGL2)；设置 DSC.GL.gl / .canvas / .W / .H / .dpr
DSC.GL.program(vsSrc, fsSrc, name)   // -> {prog, u:{uName:loc,...}, a:{aName:loc,...}, use()}
                                     //    u/a 由着色器源码自动反射，按变量名索引
DSC.GL.buffer(dataOrSize, target?, usage?)   // ARRAY_BUFFER 默认；DSC.GL.upload(buf,data,target?)
DSC.GL.vao(attribs, indexBuffer?)    // attribs: [{buffer,loc,size,type?,normalized?,stride,offset,divisor?}]
DSC.GL.texFromCanvas(canvas,{nearest=true,mips=false,flipY=false})
DSC.GL.texData(w,h,pixels|null,{internal,format,type,nearest,wrap,mips})
DSC.GL.fbo(w,h,{depth=true,float=false})    // -> {fb,color,depth,resize(w,h),bind()}
DSC.GL.screenVAO()                   // 全屏三角形 VAO（顶点 a_pos: vec2 clip space）
DSC.GL.bindFB(fboOrNull, w?, h?)     // null = 默认帧缓冲
DSC.GL.clear(r,g,b,a,depth=true)
DSC.GL.depth(enable, {write=true,func})
DSC.GL.blend(mode)                   // 'off' | 'alpha' | 'add' | 'premul'
DSC.GL.cull(mode)                    // 'off' | 'back' | 'front'
DSC.GL.setTex(unit, tex, target?)
DSC.GL.sphereMesh(subdiv)            // -> {vao,indexCount}  单位球，属性 a_pos(vec3) a_nrm(vec3) a_uv(vec2)
DSC.GL.boxMesh()                     // -> {vao,indexCount}  单位立方体 [-.5,.5]，a_pos a_nrm a_uv
DSC.GL.err(tag)                      // 调试用 getError
```

```js
DSC.M4.identity() perspective(fovyRad,aspect,near,far) ortho(l,r,b,t,n,f)
       lookAt(eye,center,up) mul(a,b,out?) mulVec(m,v4,out?) invert(m,out?)
       translate(m,v) scale(m,v) rotateX/rotateY/rotateZ(m,rad) transpose(m)
       fromQuatPos(q,p) normalFromMat4(m) -> mat3(Float32Array 9)
DSC.V3.add sub mul scale dot cross len norm lerp dist clone set copy zero
DSC.Q  fromAxisAngle mul normalize rotateVec slerp toMat4 lookRotation
DSC.Util.clamp(v,a,b) lerp(a,b,t) smoothstep(a,b,x) mod(a,b) sign
         randRange(rng,a,b) pick(rng,arr) fmtNum(n) fmtDist(m)
```

矩阵均为 `Float32Array(16)`，**列主序**（与 GLSL 一致），向量为 `[x,y,z]` 数组或 Float32Array(3)。
世界坐标：**Y 轴向上**，方块坐标为整数格；1 方块 = 1 单位 = 约 1 米。

## 4. 方块表（blocks.js 为唯一权威，贴图名必须与 §5 完全一致）

| id | key | tiles | 材质音 | 硬度 | 备注 |
|----|-----|-------|--------|------|------|
|0|air|—|—|—|不可选中|
|1|stone|stone|stone|1.5||
|2|grass|top:grass_top side:grass_side bottom:dirt|grass|0.6||
|3|dirt|dirt|dirt|0.5||
|4|cobblestone|cobblestone|stone|2.0||
|5|sand|sand|sand|0.5||
|6|sandstone|top/bottom:sandstone_top side:sandstone_side|stone|0.8||
|7|gravel|gravel|dirt|0.6||
|8|log|top/bottom:log_top side:log_side|wood|2.0||
|9|leaves|leaves|grass|0.3|不透明（MC "流畅"风）|
|10|planks|planks|wood|2.0||
|11|water|water|water|—|液体·半透明·可穿过|
|12|snow_block|top/bottom:snow_top side:snow_side|snow|0.4||
|13|ice|ice|snow|0.5|半透明|
|14|bedrock|bedrock|stone|∞|不可破坏|
|15|coal_ore|coal_ore|stone|3.0|掉落 碳|
|16|ferrite_ore|iron_ore|stone|3.0|掉落 铁氧尘|
|17|gold_ore|gold_ore|stone|3.0|掉落 黄金|
|18|diamond_ore|diamond_ore|crystal|3.5|掉落 活化钻石|
|19|copper_ore|copper_ore|stone|3.0|掉落 铜|
|20|emeril_ore|emeril_ore|crystal|3.2|掉落 艾米瑞尔|
|21|chryson|chryson_crystal|crystal|2.5|自发光 0.5|
|22|indium|indium_crystal|crystal|3.0|自发光 0.6|
|23|alien_grass|top:alien_grass_top side:alien_grass_side bottom:alien_dirt|grass|0.6||
|24|alien_dirt|alien_dirt|dirt|0.5||
|25|basalt|alien_stone|stone|1.8||
|26|alien_log|top/bottom:alien_log_top side:alien_log_side|wood|2.0||
|27|alien_leaves|alien_leaves|grass|0.3||
|28|fungal_cap|top:fungal_cap_top side:fungal_cap_side|grass|0.5|自发光 0.25|
|29|lumina|lumina_block|metal|1.5|自发光 1.0|
|30|crystal_block|crystal_block|crystal|1.2|半透明·自发光 0.7|
|31|glass|glass|glass|0.4|半透明|
|32|metal_plate|metal_plate|metal|2.5||
|33|metal_panel|metal_panel|metal|2.5||
|34|tech_grate|tech_grate|metal|2.2||
|35|glow_panel|glow_panel|metal|2.0|自发光 0.9|
|36|hull_white|hull_white|metal|2.5||
|37|monolith|monolith|stone|4.0|自发光 0.35|
|38|obsidian|obsidian|stone|4.0||
|39|magma|magma|stone|1.5|自发光 1.0·伤害|
|40|carbon_block|carbon_block|stone|1.5||
|41|sodium_block|sodium_block|crystal|1.0|自发光 0.8|
|42|launch_pad|launch_pad|metal|3.0||
|43|frost_stone|frost_stone|stone|1.6||
|44|red_sand|red_sand|sand|0.5||
|45|toxic_sludge|toxic_sludge|water|—|液体·自发光 0.4·伤害|
|46|star_bulb|star_bulb|grass|0.3|自发光 0.8|
|47|salt_block|salt_block|sand|0.6||
|48|ash_block|ash_block|sand|0.5||
|49|coral_block|coral_block|grass|0.8|自发光 0.3|
|50|alien_sand|alien_sand|sand|0.5||

材质音材质名（用于 `dig_*/break_*/place_*/step_*`）：
`stone dirt grass sand wood metal glass crystal snow water`

## 5. 委派 B —— `js/textures.js`（程序化像素贴图）

```js
DSC.Textures.build()   // 幂等；返回并缓存 atlas 对象
// -> { canvas, tileSize:16, cols:16, rows:16, index:{ tileName: tileIndex }, name(i), uv(tileName)->[u0,v0,u1,v1] }
DSC.Textures.icon(tileName, scale=4)   // -> dataURL(PNG)，NEAREST 放大，给 DOM 背包/热键栏用
DSC.Textures.starfieldTexture?          // 可选，不需要
```
- atlas 画布 **256×256**（16×16 格，每格 16×16 像素），`tileIndex = row*16 + col`。
- 必须实现的 tile 名（**57 个，一个不能少、不能改名**）：
```
stone cobblestone dirt grass_top grass_side sand sandstone_top sandstone_side gravel
log_top log_side leaves planks water snow_top snow_side ice bedrock
coal_ore iron_ore gold_ore diamond_ore copper_ore emeril_ore chryson_crystal indium_crystal
alien_grass_top alien_grass_side alien_dirt alien_stone alien_log_top alien_log_side alien_leaves
fungal_cap_top fungal_cap_side lumina_block crystal_block glass
metal_plate metal_panel tech_grate glow_panel hull_white monolith
obsidian magma carbon_block sodium_block launch_pad frost_stone red_sand toxic_sludge
star_bulb salt_block ash_block coral_block alien_sand
```
- 画法要求：像 MC 官方 16×16 —— 底色 + 2~4 档明暗噪点 + 少量特征（矿石斑块、木纹年轮、
  草皮顶部锯齿垂边、砖缝、金属铆钉与警示斜纹、水波纹、玻璃四边框 + 高光斜线）。
- 矿石类：石头底 + 矿物斑（每块 4~7 簇，带 1px 高光与 1px 暗边）。
- 科技类（metal_*/tech_grate/glow_panel/hull_white/launch_pad）：NMS 味 —— 面板分割线、
  螺钉、橙色警示条、青色发光缝；仍保持 16×16 硬边像素。
- 必须**确定性**（内置固定 seed 的伪随机，多次 build 结果一致）。
- 加载时不得触碰 DOM；`build()` 内部才创建 canvas。

## 6. 委派 A —— `js/audio.js`（程序化 WebAudio 引擎）

```js
DSC.Audio.init()                       // 用户手势后调用，创建 AudioContext（幂等）
DSC.Audio.ready                        // bool
DSC.Audio.play(name, opts)             // opts:{volume=1, rate=1(音高倍率), pan=0, delay=0}
DSC.Audio.loop(name, opts)             // -> {stop(fadeSec=.2), gain(v), rate(v)}；同名重复调用返回同一实例
DSC.Audio.stopLoop(name, fade=.2)
DSC.Audio.setMusic(scene)              // 'title'|'space'|'planet'|'cave'|'warp'|'none' 交叉淡入淡出
DSC.Audio.engine(throttle01, boost01)  // 飞船引擎连续合成（内部自管 loop）
DSC.Audio.wind(intensity01)            // 地表风声/大气摩擦强度
DSC.Audio.mining(on, material)         // 多功能工具采矿激光 loop（材质影响音色）
DSC.Audio.setVolumes({master,sfx,music})
DSC.Audio.suspend() / resume()
DSC.Audio.NAMES                        // 数组，暴露全部可用 SFX 名（自测脚本要用）
```
必须实现的 SFX 名（**缺一即失败**）：
```
dig_stone dig_dirt dig_grass dig_sand dig_wood dig_metal dig_glass dig_crystal dig_snow dig_water
break_stone break_dirt break_grass break_sand break_wood break_metal break_glass break_crystal break_snow
place_stone place_dirt place_grass place_sand place_wood place_metal place_glass place_crystal place_snow
step_stone step_dirt step_grass step_sand step_wood step_metal step_glass step_crystal step_snow step_water
jump land hurt heal splash swim drown
item_pickup item_craft item_refine inv_open inv_close
ui_hover ui_click ui_back ui_error ui_type ui_tab
scan_ping scan_sweep scan_return discovery upload units_gain milestone
ship_engine ship_start ship_boost ship_pulse ship_land ship_takeoff ship_hatch ship_alarm
warp_charge warp_jump warp_arrive atmos_burn atmos_boom thunder
ambient_space ambient_planet ambient_cave ambient_underwater rain
laser_hit terrain_edit portal glyph
```
（`ship_engine ambient_* atmos_burn rain laser_hit? ` 这些天生是 loop —— `loop()` 与 `play()` 都要能吃。）

音色方向：
- **MC 侧**：短、干、无混响拖尾。`dig_*` = 带包络的滤波噪声（石=带通 1.2k+咔哒，草=低通柔噪，
  沙=高通沙沙，木=中频敲击+一点谐振，玻璃=脆碎多颗粒，金属=金属谐振簇，晶体=铃音+噪声）。
  `break_*` = `dig_*` 的加强版（更长更碎，带 2~3 层颗粒）。`step_*` = `dig_*` 的 0.25 音量 + 低八度变体，
  每次随机 ±8% 音高（**必须随机化**，否则听着像机器人）。
- **NMS 侧**：合成器 blip、带谐振低通扫频、深沉 whoosh、上升琶音（discovery）、
  无线电静噪（upload/scan_return）、低频 pad（ambient_space）、
  `warp_jump` = 充能上扫 + 爆裂 + 长尾 whoosh；`atmos_burn` = 宽带噪声 + 缓慢滤波扫动 + 隆隆低频。
- **音乐**：`setMusic('planet')` 用极简三音钢琴式正弦琶音（MC 味，随机间隔 6~14s，
  混一点空间感）；`'space'` 用缓慢演进的 pad 和弦（NMS 味，2~3 个 detune 锯齿 + 低通 LFO）；
  `'title'` = 两者混合；`'warp'` = 节奏化脉冲。禁止刺耳、禁止削波（总线加 DynamicsCompressor + 限幅）。
- 所有 loop 必须 `stop()` 后彻底静音并断开节点，避免累积。

## 7. 委派 D —— `js/lore.js`（程序化命名与文案）

```js
DSC.Lore.systemName(rng)      // -> 'Ekthuar-Ojaesa' 风格（可念、外星感、2~3 音节 + 罗马数字/希腊后缀）
DSC.Lore.planetName(rng)      // -> 'Ojaesa VI' / 'Tyketh Prime'
DSC.Lore.speciesName(rng)     // 生物学名 'Procavia Aeternum'
DSC.Lore.floraName(rng)
DSC.Lore.mineralName(rng)
DSC.Lore.biomeLabel(biome)    // -> {zh:'茂盛', en:'LUSH', desc:'植被繁茂的宜居星球'}
DSC.Lore.weather(rng, biome)  // -> {zh:'零星阵雨', en:'SCATTERED SHOWERS', hazard:0..3}
DSC.Lore.sentinels(rng)       // -> {zh:'低度', en:'LOW', level:0..4}
DSC.Lore.faunaLine(rng)       // -> {zh:'寡少', en:'SPARSE'}
DSC.Lore.floraLine(rng)
DSC.Lore.discoveryBlurb(rng, kind)  // 发现时那句诗性短句（中文，NMS 味）
DSC.Lore.bootLog()            // 开场启动自检日志行数组（英文缩写 + 中文混排，>=14 行）
DSC.Lore.tip()                // 加载提示/太空箴言
DSC.Lore.monolithText(rng)    // 方碑外星文字对应的中文译句（神秘感）
DSC.Lore.shipLog(rng)         // 飞船 AI 播报短句
```
- 所有函数接受 `rng`（`DSC.Util.makeRng?` 不存在 —— 用传入的 `rng()` 返回 0..1 的函数；
  若未传则用 `Math.random`），必须纯函数式确定性（同 rng 序列同结果）。
- 语言风格：**中文为主 + 英文大写副标**（NMS 的 UI 就是这种双层感）。禁止中二，要冷峻科幻。
- biome 枚举固定：`lush toxic frozen desert radioactive exotic barren volcanic ocean`

## 8. 委派 E —— `js/spacefx.js`（星空 / 星球 / 曲速）

```js
DSC.SpaceFX.init()                       // 建 program/几何（须在 DSC.GL.init 之后调用）
DSC.SpaceFX.drawBackground(c)            // c:{viewProj, invViewProj, camPos, time, seed, nebulaA:[r,g,b], nebulaB:[r,g,b], starDensity, exposure, fade}
DSC.SpaceFX.drawStar(c, s)               // 恒星：s:{pos,radius,color,coronaScale}
DSC.SpaceFX.drawPlanet(c, p)             // p:{pos, radius, spin, seed, sunDir, palette:{low,mid,high,cloud,water,ice},
                                         //    atmoColor, atmoStrength, hasWater, hasClouds, hasRings, ringColor, cityLights}
DSC.SpaceFX.drawWarp(c, w)               // 曲速隧道 w:{progress01, dir, tint}
DSC.SpaceFX.drawDust(c, d)               // 太空尘埃/速度线 d:{camPos, velocity, throttle01}
```
- 背景：fragment 着色器按视线方向程序化生成 **星星（多层，含少量彩色亮星与十字星芒）+ 星云
  （fbm 分层，两色混合）+ 银河带**；必须随 `seed` 变化，且相机移动时星星不抖动（用方向而非屏幕坐标）。
- 星球：球体 + 程序化表面（fbm 大陆/海洋/极冠/山脉 + 昼夜终结线软过渡 + 夜面城市灯点缀 +
  云层第二层旋转 + 边缘大气散射光晕 outer glow）。远看必须"像 NMS 海报"。
- 允许在 `spacefx.js` 内部自建 program/VAO/texture，但只能通过 `DSC.GL.*` 创建，
  且**不得修改全局 GL 状态后不还原**（画完把 depth/blend/cull 还原成入口时的约定：depth on/write on, blend off, cull back）。
- 不得引用 `DSC.World` / `DSC.UI` / `DSC.Player`。

## 9. 委派 C —— `css/ui.css`（NMS 风 HUD 美术）

DOM 骨架见 `index.html`（**只准写 CSS，不准改 HTML 结构与 id**）。设计令牌：
```css
--amber:#ffa03c; --amber-hot:#ff6a00; --cyan:#46e0ff; --teal:#1de3c2;
--panel:rgba(7,16,24,.80); --panel-2:rgba(10,22,32,.92); --line:rgba(255,180,106,.35);
--line-cyan:rgba(70,224,255,.35); --text:#eaf6ff; --dim:#8fa8b8; --danger:#ff4d3d; --ok:#7cffb2;
--font-tech:"Bahnschrift","DIN Alternate","Segoe UI Semibold",system-ui,sans-serif;
--font-mono:"Consolas","JetBrains Mono",ui-monospace,monospace;
```
要点：全屏无滚动、`image-rendering:pixelated` 用于图标、六边形用 `clip-path`、
角标括号用伪元素、进度环用 `conic-gradient`、扫描线用 `repeating-linear-gradient` 叠加 + `mix-blend-mode`、
关键动效：`@keyframes` 打字光标、扫描脉冲、警报闪烁、面板入场（0.18s 上移+淡入+轻微横向拉伸）。
性能：动效只用 `transform/opacity`；`#hud` 内禁止 `filter:blur` 大面积使用。

## 10. 玩法与状态机（main.js）

状态：`boot → title → (planet | space | warp) ↔ inventory/galaxy/log/pause → death`

- **地表（planet）**：WASD 移动 / Shift 疾跑 / Space 跳 / Ctrl 潜行 / 左键 采矿激光（持续+进度）/
  右键 放置 / 中键 取样 / 1-9 + 滚轮 切槽 / E 背包 / C 扫描脉冲（NMS 波纹）/ F 上下飞船 /
  J 星系图 / L 发现日志 / F3 调试 / ESC 暂停。生命·护盾·氧气·危险度（NMS 四表），
  昼夜循环 + 生物群系危险伤害。挖矿掉落进背包，精炼台合成曲速电池。
- **太空（space）**：W/S 油门、鼠标 转向、Shift 脉冲引擎、A/D 侧滚、X 刹车、
  瞄准星球按住 W 俯冲 → **大气层进入过渡动画（约 4.5s）**：等离子火焰 + 相机抖动 +
  星空淡出/天空色渐入 + 云层掠过 + 地形流式生成 + HUD "ATMOSPHERIC ENTRY" 警告 + 音效渐变；
  着陆后行星信息卡打字机展开。起飞为反向序列。
- **曲速（warp）**：J 星系图选目标 → 消耗曲速电池 → 隧道动画 → 新星系（新种子/新星球）。
- 存档：`localStorage['dsc.save.v1']`，含玩家状态、背包、已发现星球命名、方块改动 diff（按区块稀疏存）。

## 11. DOM 交互约定（ui.js 与 ui.css 的唯一契约）

- `.hidden { display:none !important }`；`.screen` = 全屏覆盖层（100vw/100vh，居中内容）。
- **所有仪表/进度**：JS 只在容器上写 CSS 变量 `--v`（0..1）与状态类，CSS 负责画。
  例：`#v-health` / `#v-shield` / `#v-oxygen` / `#v-hazard` / `#sh-throttle` / `#sh-pulse` /
  `#sh-hull` / `#sh-shield` / `#mine-ring` / `#ip-ring` / `#ew-bar` / `#boot-bar` / `#pc-clock`。
  状态类：`.warn`（黄橙）`.crit`（红闪）`.full`（青亮）`.charging`（流动动画）。
- **显隐动效**：JS 只加/去 `.show`（`#discovery-banner` `#entry-warning` `#landing-prompt`
  `#interact-prompt` `#subtitle` `#toast` `#lock-hint`）与 `.play`（`#scan-pulse` 一次性扫描波纹动画）。
- **JS 生成的子元素结构**（CSS 必须为这些类写样式）：
  - 快捷栏 `#hotbar` → `<div class="slot"><img class="slot-ico"><b class="slot-n">1</b><span class="slot-c">64</span></div>`，选中态 `.slot.active`，空槽 `.slot.empty`。
  - 背包 `#inv-grid` → `<div class="inv-slot"><img class="is-ico"><span class="is-c"></span><b class="is-n"></b></div>`，`.inv-slot.sel`、`.inv-slot.empty`。
  - 配方 `#refiner-list` / `#craft-list` → `<div class="recipe"><span class="r-name"></span><span class="r-io"></span><button class="r-go"></button></div>`，`.recipe.disabled`。
  - 世界标记 `#markers` → `<div class="marker"><i class="m-ico"></i><span class="m-name"></span><span class="m-dist"></span></div>`，
    类型类 `.marker.planet|.ship|.poi|.station|.player`，越界 `.marker.edge`（JS 写 `left/top` 内联 px）。
  - 雷达 `#sh-radar-blips` → `<i class="blip"></i>`（内联 left/top，类 `.blip.planet|.ship|.star`）。
  - 罗盘 `#compass-strip` → `<span class="c-tick"><b>N</b></span>`（内联 `left:%`），`.c-tick.minor`。
  - 通知 `#notify-stack` → `<div class="notify"><b></b><span></span></div>`，`.notify.warn|.good|.bad`，
    进场动画 0.2s，JS 会在 4s 后加 `.out` 再移除。
  - 日志 `#log-list` → `<div class="log-item"><b></b><span></span><em></em></div>`。
  - 星系节点 `#galaxy-nodes` → `<div class="gnode"><i></i><span></span></div>`（内联 left/top），`.gnode.sel|.current|.visited`。
  - 俯仰梯 `#sh-ladder` → `<i class="rung"><b>10</b></i>`（内联 top/transform）。
- **全屏特效层** `#fx-*`：CSS 只定义外观（渐变/噪点/闪光），**不透明度由 JS 写 `style.opacity`**，
  初始 `opacity:0`，`pointer-events:none`，`#fx-fade` 为纯黑、`#fx-entry` 为橙红等离子径向、
  `#fx-warp` 为青白速度线、`#fx-damage` 为红色边缘、`#fx-flash` 为纯白。
- 图标 `<img>` 的 `src` 由 `DSC.Textures.icon()` 生成的 dataURL 填充，CSS 必须 `image-rendering:pixelated`。
