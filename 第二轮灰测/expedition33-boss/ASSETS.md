# 外部素材清单与许可

## 结论：**没有任何外部素材文件**

本项目不包含图片、模型、音频、视频或字体文件。仓库内只有源码（`.ts` / `.css` / `.html` / `.md` / `.mjs`）。
所有视听内容都在运行时程序化生成：

| 资源 | 生成方式 | 文件 |
|---|---|---|
| 场地（裂开的黑岩圆形地面、暗红反光裂缝、倾斜巨石、骨白花簇、颜料残片） | Three.js 程序化几何 + canvas 纹理 | `src/render/models.ts`、`src/render/textures.ts` |
| 四手剑客（四臂人形、面具、破损长袍、羽翼布片、金/紫双剑） | 嵌套 Object3D 骨架 + 关键帧插值 | `src/render/models.ts` |
| 熙艾尔 / 吕涅 / 玛埃尔 | 同上（各自武器与配色） | `src/render/models.ts` |
| 全部纹理（裂纹、布料、面具、墨迹 alpha、金属、剑光条、羽毛、花、噪声、渐变、圆环） | `CanvasRenderingContext2D` 运行时绘制 | `src/render/textures.ts` |
| 材质溶解 / 受击闪白 / 菲涅尔轮廓光 / 剑光脉冲 | 自写 GLSL，`onBeforeCompile` 注入 | `src/render/models.ts` |
| 粒子（黑色碎屑、画笔微粒、元素爆发、金色完美环） | `THREE.Points` + 加法混合面片 | `src/render/models.ts` |
| 32 种音效 + 环境风声 / 颜料滴落 | WebAudio 实时合成（OscillatorNode、噪声 AudioBuffer、BiquadFilter、DynamicsCompressor） | `src/audio/audio.ts` |
| 中文字体 | 只声明系统字体栈（微软雅黑 / 苹方 / 思源黑体 / 宋体等），不内嵌字体文件 | `src/styles.css` |
| favicon | 内联 SVG data URI | `index.html` |

## 代码依赖许可

| 包 | 版本 | 许可 | 用途 |
|---|---|---|---|
| three | ^0.185.1 | MIT | WebGL 渲染 |
| vite | ^6.0.0 | MIT | 开发服务器 / 构建（devDependency） |
| typescript | ^5.7.0 | Apache-2.0 | 类型检查（devDependency） |
| vitest | ^2.1.0 | MIT | 单元 / 集成测试（devDependency） |
| @types/three | ^0.185.0 | MIT | 类型定义（devDependency） |
| playwright-core | latest | Apache-2.0 | 无头浏览器验收（devDependency，仅 `npm run smoke` 需要） |

## 与原作的关系

《光与影：33 号远征队》(Clair Obscur: Expedition 33) 的商标、角色与美术版权归 Sandfall Interactive / Kepler Interactive 所有。
本项目是**玩法与观感的独立复刻原型**：只引用了角色名、技能名、招式名等玩法术语（写在数据文件里），
未提取、未打包、未分发原作的任何模型、贴图、动画、音频或视频资源，也不包含任何原作截图或录屏。
