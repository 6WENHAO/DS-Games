# 微体素地图 · 建造 API 契约

> 站点内容模块必须严格按本契约编写。所有脚本都是**经典脚本**（非 ES module），
> 通过 `window.VX` 命名空间协作，可以用 `file://` 直接打开。

## 0. 文件骨架

```js
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, m = VX.m, LAY = VX.LAY, LIB = VX.LIB;

  VX.buildXXX = function (w) {      // w = VX.World 实例
    // ...建造代码...
  };
})(window);
```
把入口函数挂在 `VX.buildXXX` 上，`js/world/index.js` 会按顺序调用。

## 1. 坐标系与尺度

| 项 | 值 |
|---|---|
| 图版 | X ∈ [0,1280)，Z ∈ [0,1280)，Y ∈ [0,224) |
| 中心 | (640, 640) |
| 标准地面 | `VX.GROUND = 26`（`LAY.ground`） |
| 底座底 | y = 0（岛体外为虚空） |
| 方向 | −Z = 北，+Z = 南，−X = 西，+X = 东（同 Minecraft） |
| 层高模数 | `LIB.ST = 4` 体素 = 1 层 |
| 观感换算 | 1 体素 ≈ 2 个 MC 方块；30 方块宽的楼 → 约 16-20 体素宽 |

体量参考：小屋 8×8×8；多层楼 14×14×24；塔楼 18×18×40~72；地标塔 26×26×96。
街道宽度：主轴 15、次干 10、支路 7、巷 4。

**取地面高度**：`var y = w.tH(x, z) + 1;`（`tH` 返回列顶 y，虚空返回 −1）

## 2. 世界对象 `w` 的方法

### 体素写入
```
w.set(x,y,z,mat) / w.get(x,y,z) / w.setIf(x,y,z,mat)
w.fill(x0,y0,z0,x1,y1,z1,mat)          // = w.box，闭区间，实心（推荐：实心可省一半面）
w.fillAir(...)                          // 只填空气
w.shell(x0,y0,z0,x1,y1,z1,wall[,floor][,roof])   // 空心（仅在需要看见内部时用）
w.walls(x0,y0,z0,x1,y1,z1,mat)          // 四面墙
w.frame(x0,y0,z0,x1,y1,z1,mat)          // 12 条棱
w.corners(x0,y0,z0,x1,y1,z1,mat[,w])    // 四角柱
w.plate(x0,z0,x1,z1,y,mat)              // 水平板
w.pillar(x,z,y0,y1,mat)
w.cyl(cx,cz,r,y0,y1,mat[,{thick}])
w.disc(cx,cz,r,y,mat[,inner])
w.ring(cx,cz,r0,r1,y0,y1,mat)
w.sphere(cx,cy,cz,r,mat[,{yScale,thick,half}])
w.dome(cx,cz,baseY,r,skin,{yScale,rib,ribEvery,glass,thick})
w.cone(cx,cz,y0,y1,r0,r1,mat[,hollow])
w.line3(x0,y0,z0,x1,y1,z1,mat[,rad])
w.beam(x0,z0,x1,z1,y0,y1,width,mat)     // 水平粗梁
w.ramp(x0,z0,x1,z1,y0,y1,width,mat)
w.text(str,x,y,z,axis,mat,{scale,gap,back})   // 像素字，axis 'x'|'z'，只支持 A-Z 0-9 与 - . : / # + ! * > < = ( )
w.textWidth(str[,scale][,gap])
```

### 地形（列高图）
```
w.tH(x,z)                               // 列顶 y，−1 = 虚空
w.tM(x,z)                               // 表面材质 id
w.tSet(x,z,h,mat[,sideMat])
w.tRect(x0,z0,x1,z1,h,mat[,side])       // 矩形整平
w.tPaint(x0,z0,x1,z1,mat[,side])        // 只改材质
w.tDisc(cx,cz,r,h,mat[,side])
w.tPaintDisc(cx,cz,r,mat[,inner][,side])
w.tRoad(points,width,mat,{curb,lift,name})   // points = [[x,z],...]
w.tWater(x0,z0,x1,z1,level[,mat])
w.tWaterDisc(cx,cz,r,level[,mat])
w.tCrater(cx,cz,r,depth,edge[,mat])     // depth 负数=凹陷，正数=隆起
w.tSmooth(x0,z0,x1,z1,iter)
w.scatter(x0,z0,x1,z1,count,seed,cb)    // cb(x,z,rnd,i)，确定性
VX._flat(cx,cz,r,y,edge[,mat][,side])           // 圆形场地平整（terrain.js 提供）
VX._flatRect(x0,z0,x1,z1,y,edge[,mat][,side])   // 矩形场地平整
VX._grassPatch(cx,cz,r,seed[,dark])             // 噪声草地斑块
```

### 标注 / 光源
```
w.addLabel(text,x,y,z,kind,sub)   // kind: 'site' | 'poi' | 'minor'，会在界面上显示可开关标签
w.addLight(x,y,z,[r,g,b],rad,inten)   // 一般不用手写：发光材质会自动登记
```

## 3. 材质：`m('名字')`

拼错会立即抛错。常用清单（完整见 `js/palette.js`）：

- 自然：`grass grassDry grassDark grassNeon dirt dirtDark sand sandDark dune gravel stone stoneDark stoneLight mesaRock mesaBand mesaPale salt crackedMud bedrock moss snow ice ash`
- 铺装：`asphalt asphaltWorn asphaltCrack roadLine roadLineWarm roadNeon roadNeonPink pave paveDark paveWarm whiteTile marble brickPave grate hazard hazardDark redCarpet curb`
- 建筑：`whitePanel whitePanel2 concrete concreteDark concreteWarm concreteMossy steel steelDark girder darkMetal darkMetal2 rustMetal rustDeep copperRoof copperPatina goldTrim tileRoof woodWhite wood woodDark brickWhite quartzPillar obsidian`
- 玻璃：`glassClear glassCyan glassDark glassGreen glassDome glassRed glassGold glassBroken`
- 发光：`windowGold windowWarm windowCool windowDim lampWarm lampCool neonCyan neonMagenta neonPink neonRed neonGreen neonAmber neonBlue neonViolet neonWhite neonFlick neonFlickRed holoScreen holoPink holoGreen beamCyan beamWarm beamRed beamViolet`
- 能量：`magma magmaCore lava ember coreBlue coreRed starCore starShell throneRed`
- 生机：`fleshDark fleshDeep bioMech bioMechDark boneWhite boneOld veinRed chitin`
- 植被：`trunk trunkBirch trunkGiant leavesDark leaves leavesLight leavesCyan leavesGlow cherry cherryDeep flowerRed flowerPink flowerWhite shrub deadWood hedge crop cropRow`
- 水：`water waterDeep waterNeon`
- 机体：`mechaWhite mechaRed mechaBlue mechaPink mechaGrey mechaGreen mechaDark`
- 废墟：`rubble rubbleDark brickRuin signFaded tarp scorch wire`

**发光材质会自动成为光源并烘焙进 3D 霓虹体积**，因此霓虹用得越到位，夜景层次越好；
但不要成片铺满发光材质（会过曝），做成"线/条/点"最好看。

## 4. 构件库 `LIB`

```
LIB.perim(w,x0,z0,x1,z1,y,mat)                     // 矩形一圈
LIB.eave(w,x0,z0,x1,z1,y,out,mat)                  // 外挑檐口/雨棚
LIB.perimDots(w,x0,z0,x1,z1,y,step,mat[,phase])    // 周长点缀灯珠
LIB.facade(w,x0,z0,x1,z1,y0,y1,{body,win,mullion,belt,storyH,mulEvery,beltEvery,neon,neonEvery,cornerMat})
LIB.roofScape(w,x0,z0,x1,z1,y,kind,seed)           // kind 0花园 1设备 2天线 3停机坪
LIB.tower(w,x0,z0,x1,z1,y0,height,{body,win,mullion,belt,neon,neonEvery,trim,roof,roofDeck,edgeNeon,mulEvery})
LIB.setbackTower(w,cx,cz,half,y0,[[inset,stories],...],opt)   // 退台塔
LIB.podium(w,x0,z0,x1,z1,y0,stories,{body,glass,win,trim,canopy,strip,pillar,roof})
LIB.streetBlock(w,x0,z0,x1,z1,y0,seed,{body,minStory,maxStory})  // 裙房贴街+后退塔楼+全息广告
LIB.neonSign(w,x,y,z,axis,text,mat,{scale,dir,back,strip})
LIB.holoBoard(w,x,y,z,axis,width,height,mat[,dir])
LIB.antennaMast(w,x,z,y,h)
LIB.pipes(w,[[x,z],...],y,mat,{bracket})
LIB.vent(w,x,z,y,h,seed)
LIB.acUnits(w,x0,z0,x1,z1,y,seed)
LIB.streetLamp(w,x,z,y,kind)          // kind 'neon'|'double'|'tall'|其它=暖光
LIB.bench(w,x,z,y,dir)                 // dir 'x'|'z'
LIB.planter(w,x,z,y,r,seed)
LIB.tree(w,x,z,y,h,kind)               // 'broad'|'pine'|'birch'|'cherry'|'neon'|'dead'|'palm'|'giant'
LIB.roadDeco(w,points,halfW,y,{lampEvery,treeEvery,lamp,tree,curbNeon})   // y 传 null = 自动贴地
LIB.crosswalk(w,x0,z0,x1,z1,dir)
LIB.plaza(w,x0,z0,x1,z1,y,{pave,alt,curb,lampEvery,benches,planters})
LIB.gateArch(w,x,z,y,span,h,text,{axis,post,beam,neon})      // 牌坊门户
LIB.fenceWall(w,points,y,h,mat,{postEvery,post,cap,neon,gaps:[[x,z,r],...]})
LIB.skybridge(w,x0,z0,x1,z1,y,width,{deck,glass,truss})
LIB.viaduct(w,points,y,width,{deck,pier,rail,glow})          // 高架轨道桥
LIB.searchlight(w,x,z,y,h,[dx,dy,dz],mat)                    // 探照灯+光柱
LIB.lightPillar(w,x,z,y0,y1,r,mat)                           // 竖直光柱
LIB.ruinBuilding(w,x0,z0,x1,z1,y0,stories,seed,{body})       // 废墟楼（塌角/露筋/藤蔓/残存霓虹）
LIB.rubblePile(w,x,z,y,r,seed)
LIB.vehicle(w,x,z,y,dir,seed)
LIB.container(w,x,z,y,dir,mat)
LIB.wreck(w,x,z,y,len,dir,seed,{hull,dark,rad,tilt,thick})   // 通用残骸/坠机/舰段
LIB.bones(w,x,z,y,len,dir,seed,{bone,old,arch,rib})          // 叫龙骨架（脊椎+肋骨+头骨）
LIB.mecha(w,x,z,y,h,{main,accent})                           // FRANXX 机体立像
LIB.drillTower(w,x,z,y,h)
LIB.tank(w,x,z,y,r,h,{body,top})
LIB.stack(w,x,z,y,r,h)                                       // 烟囱
LIB.courtyard(w,x0,z0,x1,z1,y,{wall,h,gateSide,neon,pave1,pave2,postEvery})
LIB.fountain(w,x,z,y,r)
```

## 5. 工具 `M`
```
M.rng(seed)            // 确定性随机 → function(): [0,1)
M.hash3(x,y,z)         // [0,1)
M.fbm(x,y,oct,seed)    // 值噪声 fbm，输入建议乘 0.02~0.2
M.ridge(x,y,oct,seed)
M.clamp/lerp/smooth/mix3
```

## 6. 硬性规则

1. **确定性**：只能用 `M.rng(固定种子)` / `M.hash3` / `M.fbm`，禁止 `Math.random()`。
2. **面数预算**：全图总面数上限约 90 万。实心体块只产生外表面，所以**默认用 `w.fill` 实心**，
   仅在"要看到内部"（机库、鸟笼、王座厅）时才 `w.shell`。别做 1 体素厚的镂空大墙。
3. **不出界**：所有坐标必须落在 [0,1280) × [0,224) × [0,1280) 内，且不要超出自己站点的
   `LAY` 范围（会撞到别的站点）。
4. **贴地**：建筑必须坐在地形上——先 `VX._flatRect(...)` 整平场地，再 `var y = w.tH(x,z)+1;` 起建。
   建议在建筑外圈刷一圈 `pave`/`curb` 让建筑与地面自然衔接。
5. **屋顶不留空**：每栋楼顶都要 `LIB.roofScape` 或自定内容。
6. **加标注**：每个可辨识的地点调用一次 `w.addLabel(名字, x, y, z, kind)`。
7. 不要修改 `w.H` 之外的地形数组内部字段，不要重定义 `VX` 上已有的键。
