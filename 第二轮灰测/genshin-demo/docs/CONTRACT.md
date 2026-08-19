# 提瓦特 Demo — 集成契约 v1（所有模块必读）

一个浏览器端「原神 like」开放世界 Demo。无构建步骤，纯原生 ESM，全部资源程序化生成。

## 0. 硬事实

| 项 | 值 |
|---|---|
| 工作区 | `D:\deepseek harness\7` |
| 游戏根 | `D:\deepseek harness\7\genshin-demo\` |
| 入口 | `index.html` → `src/main.js` |
| three.js | r169，已 vendored 到 `vendor/three/`，通过 importmap |
| 导入方式 | `import * as THREE from 'three'` / `import { Sky } from 'three/addons/objects/Sky.js'` |
| 静态服务器 | 已运行：<http://127.0.0.1:3099/>（根目录 = genshin-demo/） |
| 截图验证 | `node "D:\deepseek harness\7\tools\shot.mjs" <url> <out.png> [waitMs] [w] [h] [--actions=JSON]` |

### 绝对禁止
1. **联网 / npm install / 下载任何资源**。没有 .png/.jpg/.glb/.mp3 外部文件——纹理用 Canvas2D 程序化生成，几何体用代码生成，声音用 WebAudio 合成。
2. **修改不属于你的文件**（尤其 `src/main.js`、`src/core/*`、`src/gameplay/*`、`src/world/{heightfield,terrain,sky,water}.js`）。
3. `git` 操作、删除他人文件、改 `index.html`（需要新增标签就告诉集成者）。
4. 阻塞主线程 >8ms 的循环：重活拆进 `ctx.tasks.push(fn, priority)` 分帧执行。

### 必须
- 每个系统导出一个 class：`constructor(ctx)` + `update(dt)`（可选 `dispose()`）。集成者在 main.js 里 new 出来并逐帧调用。
- 所有相对导入用真实相对路径（`../core/utils.js`）。文件名区分大小写。
- 代码注释用中文或英文皆可，但**变量/函数名用英文**。
- 自测：写一个 `dev/<你的模块>.html` 独立页面（可以自己搭最小场景），用 shot.mjs 截图确认没有报错、视觉正确。**交付前必须至少截图看过一次**。

## 1. 共享 ctx（集成者提供，随时可读）

```js
ctx = {
  THREE, engine, renderer, scene, camera,   // three 对象
  quality,      // { pixelRatio, shadowMap, texSize, terrainDetail, grassDensity, reflections, msaa, godrays, bloom }
  tier,         // 'low' | 'med' | 'high'
  shotMode,     // true 时禁用开场动画、降低特效（截图/CI 用）
  input,        // Input：isDown(action)/justPressed(action)/moveAxis()/mouse{dx,dy,left,right,wheel}/locked
                // actions: forward back left right jump sprint skill burst interact lockon map party1..4 inventory quests photo pause walk
  events,       // Events：on(name,fn)/off/emit(name,payload)  —— 见 §5 事件表
  tasks,        // TaskQueue：push(fn, priority)  分帧执行重活
  rng,          // 全局确定性随机 () => [0,1)；自己的系统请用 makeRNG(seed) 建独立流
  time,         // { elapsed, dt }
  fx,           // 后处理 uniforms：uRadial/uHit/uElement/uFade/uFadeColor/uVignette/uSat/uExposure ... .value 可直接改
  shadowFocus,  // THREE.Vector3 阴影跟随点（集成者维护）
  paused,       // bool

  // ---- 由各模块注册（用之前判空 or 用可选链）----
  terrain,      // { heightAt(x,z), material, chunks }
  sky,          // { sunDir:V3, sun:DirectionalLight, timeOfDay:小时, dayFactor:0..1, setTimeOfDay(h) }
  water,        // { isUnder(y), depthAt(x,z), water }
  collision,    // §2.1
  interact,     // §2.2
  combat,       // §2.3
  fx3d,         // §2.4
  ui,           // §2.5
  audio,        // §2.6
  characters,   // §2.7
  enemies,      // §2.8
  player,       // §2.9
  quests, puzzles, vegetation, props,
}
```

世界查询（直接 import，纯函数，随处可用）：
```js
import { height, normalAt, slopeAt, moistureAt, surfaceAt, regionAt, findFlatSpot, WORLD, REGIONS } from '../world/heightfield.js';
height(x, z) // 地面高度（米）  WORLD.waterLevel === 0
```
世界尺度：4096×4096 米，陆地半径 1500 米，海平面 y=0，村庄高原在原点 (0,0) y≈23.5，湖在 (520,340)，雪山在 (-260,-1080)，石门峡谷 (980,-420)，风龙废墟 (-1080,-420)，南风海岸 (240,1180)。`REGIONS` 里有全部地标。

## 2. 模块 API 契约（跨模块调用点，签名不可改）

### 2.1 ctx.collision（集成者提供）
```js
ctx.collision.addCylinder(x, z, radius, y0, y1, opts?)   // 静态障碍（树/柱/建筑角）
ctx.collision.addBox(cx, cy, cz, hx, hy, hz, yaw, opts?)  // 静态盒
ctx.collision.resolve(pos /*V3, 原地修改*/, radius, height) // XZ 推出 + 台阶
ctx.collision.rayDown(x, z, fromY) // → { y, object } 命中最高的静态面（含地形）
```

### 2.2 ctx.interact（集成者提供）—— 世界交互点（F 键）
```js
const handle = ctx.interact.register({
  pos: THREE.Vector3, radius: 2.4, label: '调查', icon: 'talk'|'chest'|'pickup'|'waypoint'|'puzzle'|'climb',
  priority: 0, once: false,
  enabled: () => true,          // 可选
  onInteract: (ctx) => {},      // 按 F 触发
});
handle.remove(); handle.pos; handle.label = '...';
ctx.interact.nearest    // 当前高亮的交互点（UI 读它显示按键提示）
```

### 2.3 ctx.combat（集成者提供）
```js
// 元素：'physical'|'anemo'|'pyro'|'hydro'|'electro'|'cryo'|'geo'|'dendro'
ctx.combat.strike({
  origin: V3, dir: V3, shape: 'sphere'|'cone'|'box', radius: 2.2, angle: 100, halfExtents: V3,
  team: 'player'|'enemy', damage: 60, element: 'physical', poise: 20, knockback: 3.0,
  hitstop: 0.07, crit: false, source: any, once: true, onHit: (target, info) => {},
});
ctx.combat.damage(target, { amount, element, crit, poise, knockback, dir, source });
ctx.combat.heal(target, amount);
ctx.combat.reaction(target, element)   // → 反应名或 null（蒸发/融化/超载/感电/冻结/扩散/结晶）
```
**可受击目标契约**（敌人和玩家都必须满足）：
```js
{ root: THREE.Object3D, team: 'player'|'enemy', alive: true, hp, maxHp,
  hitRadius: 0.8, hitHeight: 1.8, poise: 40,
  takeDamage(info) {},        // info = { amount, element, crit, dir, source, reaction }
  center(out: V3): V3 }       // 受击中心点
```

### 2.4 ctx.fx3d（集成者提供）3D 特效
```js
ctx.fx3d.hitSpark(pos, colorHex, scale=1)
ctx.fx3d.slash(pos, quat, { radius=2, color, width=0.35, life=0.22, arc=2.2 })
ctx.fx3d.ring(pos, colorHex, radius=3, life=0.5)      // 地面冲击环
ctx.fx3d.burst(pos, element, scale=1)                  // 元素爆发
ctx.fx3d.dust(pos, count=8, colorHex?)
ctx.fx3d.damageNumber(pos, amount, { crit, element, heal })
ctx.fx3d.trail(object3D, { color, width, life })       // → handle.stop()
ctx.fx3d.beam(from, to, colorHex, life)
ctx.fx3d.shake(strength=1, time=0.25)                  // 相机震屏
```

### 2.5 ctx.ui（模块 E 提供；其他人只调用，且必须容错 `ctx.ui?.xxx`）
```js
ctx.ui.toast(text, { icon, ms })                       // 右上飘字（获得物品/解锁）
ctx.ui.subtitle(text, ms)                              // 底部字幕
ctx.ui.prompt(text, key)  / ctx.ui.hidePrompt()        // 交互按键提示
ctx.ui.hud.setHP(cur, max) / setStamina(cur, max) / setSkill(idx, cd, total)
ctx.ui.hud.setParty(list) / setActive(idx)             // list=[{name, element, hp, maxHp, icon}]
ctx.ui.hud.setBoss(name, hp, maxHp) / clearBoss()
ctx.ui.hud.setRegion(name)                             // 进入区域大字
ctx.ui.dialogue.start(node) → Promise<number>          // 见 §4 对话数据结构，resolve 选项索引
ctx.ui.quest.set(list)                                 // [{id,title,steps:[{text,done}],active}]
ctx.ui.quest.flash(text)                               // 任务更新提示
ctx.ui.map.toggle() / ctx.ui.map.isOpen
ctx.ui.intro.play() → Promise                          // 开场动画（集成者调用）
ctx.ui.fade(to, ms, color) → Promise                   // 黑场过渡
ctx.ui.cinematic(on)                                   // 黑边 + 隐藏 HUD
```

### 2.6 ctx.audio（模块 F 提供；调用方容错）
```js
ctx.audio.unlock()                                     // 首次用户输入时调用
ctx.audio.sfx(name, { pos:V3, vol=1, rate=1 })
// name: footstep_grass footstep_stone footstep_water swing1 swing2 swing3 hit_flesh hit_metal
//       crit slime_die chest_open ui_click ui_hover ui_confirm ui_cancel jump land glide_open
//       skill_anemo skill_pyro burst waypoint_unlock quest_accept quest_complete puzzle_solve
//       bow_charge bow_shot heal death enemy_alert dragon_roar wind_gust
ctx.audio.music(track, { fade=2 })                     // title field_day field_night town combat boss emotional windrise
ctx.audio.ambience(preset)                             // meadow forest lake snow cave night
ctx.audio.duckMusic(amount, time)
```

### 2.7 ctx.characters（模块 A 提供）
```js
import { createCharacter, CHARACTER_DEFS } from './char/characters.js';
const ch = createCharacter(ctx, 'lumine' /* def id */, { scale: 1 });
ch.root           // THREE.Group，脚底在 y=0
ch.height         // 米
ch.anim.play(clip, { fade=0.18, loop=true, speed=1, weight=1, layer=0 })
ch.anim.isPlaying(clip) / ch.anim.time / ch.anim.setSpeed(s)
ch.setLook(worldPos | null)        // 头部/眼睛注视
ch.setBlink(on) / ch.setExpression('normal'|'happy'|'angry'|'sad'|'surprised'|'closed')
ch.showWeapon(bool) / ch.weaponBone   // 武器挂点（THREE.Object3D）
ch.setOutline(bool)
ch.update(dt)     // 集成者会调用
ch.dispose()
```
**必须支持的 clip 名**（缺失时回退 idle，不许抛错）：
`idle idle_combat walk run sprint jump fall land glide climb climb_idle swim swim_idle
attack1 attack2 attack3 attack4 attack5 charge_loop charge_release plunge plunge_land
dash skill burst hit death sit talk wave point victory`

### 2.8 ctx.enemies（模块 C 提供）
```js
new EnemyManager(ctx)
mgr.spawn(type, pos, opts?) → enemy      // type: 'slime_water'|'slime_fire'|'slime_electro'|'hilichurl'|'hilichurl_archer'|'hilichurl_shield'|'mitachurl'|'ruinguard'|'whopperflower'|'boss_dvalin'
mgr.enemies                              // 活着的敌人数组（满足 §2.3 受击契约）
mgr.spawnCamp(type, center, count, radius)
mgr.update(dt)
mgr.aggroCount                            // >0 时集成者切战斗音乐
```

### 2.9 ctx.player（集成者提供，供任务/UI 读）
```js
ctx.player.root / .position / .velocity / .hp / .maxHp / .stamina / .grounded / .state
ctx.player.character                      // §2.7 的角色对象
ctx.player.teleport(x, z) / .setControlEnabled(bool) / .faceTo(v3)
ctx.player.party                          // [{id,name,element,hp,maxHp}]
```

## 3. 事件表（ctx.events）
```
game:ready                 —— 世界加载完成
player:move                { pos }         每帧节流
player:land                { pos, force }
player:region              { region }       进入新地标
player:damaged             { amount }
player:died
combat:hit                 { target, info }
enemy:died                 { enemy, type, pos }
enemy:aggro                { enemy }
interact:used              { handle }
quest:accepted/step/completed { quest }
puzzle:solved              { id }
chest:opened               { id, tier }
waypoint:unlocked          { id }
time:hour                  { hour }
ui:dialogueStart / ui:dialogueEnd
```

## 4. 对话数据结构（模块 D 生产，模块 E 消费）
```js
{ speaker: '琴', portrait: 'jean', element: 'anemo',
  lines: ['第一句…', '第二句…'],           // 逐句推进（点击/空格）
  choices: [ { text: '我愿意帮忙', next: nodeOrFn }, { text: '再考虑一下', next: null } ],
  onEnd: (ctx) => {}, cinematic: true }
```
`ctx.ui.dialogue.start(node)` 依次显示 lines，有 choices 时等待选择，resolve 选中索引（无 choices resolve 0）。

## 5. 美术方向（关键——这是 Demo 的门面）

**目标观感：原神式 NPR 卡通渲染 + 明亮通透的开放世界。**

- **角色/怪物**：`MeshToonMaterial` + `gradientMap`（用 `makeToonRamp()` 生成 2~3 阶硬边光照）。
  必须有：① 反转外壳描边（BackSide + 沿法线外扩 0.006~0.02，深色）② 菲涅尔边缘光（`onBeforeCompile` 注入，天空色）③ 头发/裙摆二次动力学。
  面部：Canvas2D 画的动漫脸贴图（大眼睛/高光/睫毛/眉毛/嘴），眼睛要有高光点；表情通过切换贴图区域实现。
- **调色**：草地饱和青绿；天空青蓝；蒙德建筑米白墙 + 蓝灰屋顶 + 金色装饰；风元素 `#74c8a8`，火 `#ff7a55`，水 `#4fc3f7`，雷 `#c88bfa`，冰 `#93e0ef`，岩 `#f0b93c`，草 `#9adb4a`。
- **UI**：原神式描金边浅色面板（`--paper:#f3ead6`，`--gold:#e8d5a8`，深墨字 `--ink:#3b3226`），圆角 + 细金线 + 四角装饰；中文字体栈见 ui.css。
- **光影**：已有 PBR 太阳 + PMREM 天空 IBL + PCF 软阴影 + 泛光 + 神光柱 + ACES + 暗角 + 颗粒。你的物体记得 `castShadow/receiveShadow`。

## 6. 性能预算
- 目标：中端 GPU 1080p 60fps。draw calls < 450，三角面 < 1.5M。
- 重复物体（草/树/石/敌人小怪）**必须** `InstancedMesh` 或共享 geometry+material。
- 纹理 ≤ 512²，程序化生成一次后复用（放模块级缓存）。
- 远处用 LOD / 距离剔除 / `frustumCulled`。粒子用 `Points` 或对象池，不要每帧 new 几何体。
- headless 软渲染很慢：截图用 `?q=low&shot=1`、640×360、waitMs≥8000。

## 7. 交付
完成后在回复里写：改了哪些文件、暴露的 API、已验证的截图路径、已知限制。**不要**改别人的文件；需要集成者配合的地方（例如 index.html 加标签、main.js 里调用顺序）明确写出来。
