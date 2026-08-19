# 零件模块开发契约（Module Contract）

> 本项目：Three.js（r169，本地 vendor，无构建步骤，原生 ES Module + importmap）
> 目标：四冲程直列四缸增压柴油机 高精度 3D 交互仿真
> **单位：1 three.js unit = 1 mm**，全部按真实尺寸建模。

## 坐标系

| 轴 | 含义 |
| --- | --- |
| +X | 曲轴轴线；**−X = 发动机前端（正时齿轮室/水泵/风扇）**，**+X = 后端（飞轮）** |
| +Y | 竖直向上，**Y = 0 为曲轴回转中心线**，缸体上平面 Y = 330，缸盖顶面 Y = 434，气门室罩顶 Y = 486 |
| +Z | **排气侧**；−Z = 进气侧（也是下置凸轮轴 / 挺柱 / 推杆所在侧，Z = −100） |

- 4 个缸心 X 坐标：`CYL_X = [-195, -65, 65, 195]`（缸心距 130）
- 缸体外形：X ∈ [−350, 350]，Z ∈ [−130, 130]；油底壳法兰 Y = −55，油底壳底 Y ≈ −203
- 缸盖：X ∈ [−350, 350]，Z ∈ [−122, 122]，Y ∈ [330, 434]
- 飞轮壳：X ≈ 355…451，外径 500

## 模块接口

每个系统一个文件 `src/parts/<sys>.js`：

```js
import * as THREE from 'three';
import * as U from '../core/util.js';

export function build(world) {
  const { P, K, mats } = world;          // 参数表 / 运动学 / 材质库
  const g = world.group('fuel');         // 你的图层组（见下）

  const m = U.mesh(geo, mats.chrome, [x, y, z]);
  g.add(m);

  world.reg(m, 'fuel.hpPump', {
    state: (st) => `柱塞泵油中 · ${st.rpm.toFixed(0)} r/min`,   // 悬浮卡「当前运动状态」
    explode: [0, 0, -180],                                     // 拆解方向（可省略）
  });

  world.addUpdater((st) => { m.rotation.x = ...; });            // 每帧动画
}
```

**图层 key**（`world.group(key)`）：`housing` `crankTrain` `valvetrain` `timing` `fuel` `lube` `cooling` `air` `fasteners` `fluidVol` `flow`
- 结构件放自己系统的图层；螺栓/密封圈/垫片放 `fasteners`；半透明「油道/水套/气道示意腔」放 `fluidVol`。

## 每帧状态对象 st

```js
st = {
  crankAngle,   // 曲轴转角 0..720（一个完整四冲程循环）
  crankTotal,   // 累计转角（度，单调增，适合驱动连续旋转的附件）
  rpm,          // 600..2600
  load,         // 负荷 0..1
  dt,           // 帧间隔 秒
  running,      // 是否运转
  op: {         // 工况模型
    coolantTemp, oilTemp, oilPressure /*MPa*/, boost /*MPa 表压*/,
    torque /*Nm*/, power /*kW*/, egt /*℃*/, turboRpm, thermostatOpen /*0..1*/,
  },
  cyl: [ { n /*1..4*/, x /*缸心X*/, cycle /*循环角0..720*/, stroke /*{key,cn,en}*/,
           pistonY /*活塞顶面Y*/, intakeLift, exhaustLift /*mm*/, pressure /*bar*/ } ] // 4 个
}
```

`st.cyl[i].stroke.key` ∈ `power|exhaust|intake|compression`；点火顺序 1-3-4-2。

## 材质库（`world.mats`，全部 MeshStandardMaterial，PBR）

`castIron` `castIronHead` `castIronDark` `steelSheet` `alumCast` `alumMachined` `forgedSteel`
`nodularIron` `nitridedSteel` `hardChrome` `pistonAlloy` `pistonBowl` `ringSteel` `bearingAlloy`
`bushBronze` `springSteel` `valveSteel` `valveFace` `gearSteel` `chrome` `turbineAlloy` `copper`
`brass` `filterPaper` `paintedBlack` `paintedRed` `rubber` `silicone` `gasketMat` `gasketPaper`
`boltSteel` `coolantVol` `oilVol` `intakeVol` `exhaustVol` `glass`

- 标记为 housing 的材质（castIron*/steelSheet/alumCast/alumMachined）会自动参与「透视/剖切」模式，**外壳类零件必须用这些材质**，内部零件用其它材质。
- `coolantVol/oilVol/intakeVol/exhaustVol` 用于半透明流道示意体。

## 几何工具（`src/core/util.js`，请优先复用）

`lathe(profile[[r,y]...], seg)` `tubeShell(od,id,h)` `disc(od,h,id)` `cyl(dia,h,seg,dia2)`
`cylX(dia,len)` `tubeX(od,id,len)` `cylZ(dia,len)` `roundBox(w,h,d,r)`
`extrudePoly(points,t,{holes,bevel})` `polarExtrude(rFn,t,steps)` `gearGeometry(z,m,t,bore)`
`circlePts(r,n,cx,cy)` `hexBolt(across,headH,shankDia,shankLen)` `oring(centerDia,cordDia)`
`coilSpring(od,wire,coils,len)` `pipeFromPoints(points,od,radial,tension)→{geo,curve}`
`mesh(geo,mat,pos,rot,name)` `merge(geoList)` `instances(geo,mat,transforms)` `lerp/clamp/smoothstep`

`extrudePoly`/`polarExtrude`/`gearGeometry` 生成的截面在 XY 平面、沿 Z 方向厚度居中。
需要「厚度沿 X」的板件（如轴承座、齿轮盘垂直于曲轴）：`geo.rotateY(-Math.PI/2)`（此时截面点的 x → 世界 z，y → 世界 y）。

## 信息卡数据

同时创建 `src/data/info.<sys>.js`：

```js
export const info = {
  'fuel.hpPump': {
    cn: '直列高压油泵', en: 'In-line High-Pressure Injection Pump',
    qty: 1, system: '燃油系统',
    material: '泵体 ZL104 铸铝 / 柱塞偶件 GCr15 轴承钢',
    process: '精密磨削 + 研配，配合间隙 1~2 μm；泵体压铸后时效处理',
    func: '由凸轮轴齿轮驱动，按点火顺序 1-3-4-2 定时、定量地把柴油加压到 120 MPa 送往喷油器…',
    specs: [['柱塞直径', 'φ10 mm'], ['最高喷射压力', '120 MPa'], ['驱动转速', '曲轴转速 ×0.5']],
  },
  // …本系统每一个已注册 id 都必须有一条
};
```

字段：`cn/en` 名称中英，`qty` 数量，`system` 所属系统，`material` 材料，`process` 制造工艺，
`func` 在本柴油机中的作用（1~3 句，专业、准确），`specs` 关键设计参数数组（3~6 条）。

## 硬性要求

1. 只创建/修改你负责的两个文件，**不要改动 `src/core/*`、`src/main.js`、`index.html` 或别人的文件**。
2. 不使用任何外部资源（贴图/HDR/CDN/CSG 库）；只用 three.js 内置几何 + util.js。
3. 三角面预算：整个系统 ≤ 120k 三角面。小件用低分段（seg 12~24），重复件用 `U.instances`。
4. 每个可见零件都要 `world.reg(...)` 注册唯一 id（前缀 = 你的系统名），并在 info 文件里有对应条目；
   `state` 回调要输出**随工况变化的动态文字**（如「节温器全开 · 大循环」「涡轮 96 000 r/min」）。
5. 动画只能通过 `world.addUpdater` 修改自己创建的对象，禁止读写全局变量。
6. 完成后执行 `node --check src/parts/<sys>.js && node --check src/data/info.<sys>.js` 确认无语法错误。
7. 尺寸要和主机匹配（见坐标系表），避免与其它系统的既有空间冲突（各系统的占位区见下）。

## 空间分区（避免互相穿插）

| 系统 | 允许占用空间 |
| --- | --- |
| 燃油 fuel | 高压油泵：Z ≈ −168±60、Y ≈ 150…260、X ∈ [−170, 170]；燃油滤清器：X ≈ −230、Z ≈ −190、Y ≈ 250…440；喷油器：各缸 X = 缸心、Z = +34、Y = 330…500（穿过缸盖）；高压油管：从泵顶 Y ≈ 250 绕到缸盖 Y ≈ 470 |
| 润滑 lube | 机油泵：X ≈ −300、Y ≈ −120（油底壳内）；集滤器/吸油管：Y ≈ −180；机油滤清器：X ≈ 150、Z ≈ +170、Y ≈ 60…270（横置或竖置）；机油冷却器：X ≈ −60、Z ≈ +160、Y ≈ 0…100；主油道示意腔：Y = 118、Z = 72 沿 X 贯通 |
| 冷却 cooling | 水泵：X ≈ −400、Y ≈ 190、Z ≈ 0；节温器壳：X ≈ −330、Y ≈ 430；散热器：X ≈ −640，Y ∈ [60, 530]，Z ∈ [−210, 210]；风扇：X ≈ −520；水管：X ∈ [−640, −330]；缸体水套示意腔：缸筒外 φ118→φ138 |
| 进排气 air | 进气管：Z ≈ −150（Y ≈ 350…420）；排气管：Z ≈ +150（Y ≈ 350…420）；涡轮增压器：X ≈ 330、Y ≈ 300、Z ≈ 232；中冷器：X ≈ −560、Y ≈ 330、Z ∈ [−200, 200]；空滤/管路可走 X ∈ [−560, 340] 的 Z > 150 或 Z < −150 外侧 |

> 缸体/缸盖/曲轴/活塞/配气机构/正时齿轮由主开发者实现，不要重复建模。
