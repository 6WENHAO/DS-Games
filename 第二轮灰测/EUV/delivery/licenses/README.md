# 第三方许可凭证归档索引

> 对应 `docs/05-资产清单与版权凭证.md`。
> 规格书 §1.3：「全程无侵权：音乐、音效、字体、模型、纹理均须原创或已获商业授权，并保留凭证。」

## 归档原则

1. 本项目**不使用任何第三方三维模型、纹理贴图、HDRI 环境贴图、音乐或音效素材**。
   所有此类资产均由代码程序化生成（详见下表「原创性说明」）。
2. 仅有的第三方依赖是**软件库与字体**，两者均为宽松开源许可，允许商业使用与再分发。
3. 每项第三方依赖归档：许可全文、版本号、获取渠道、获取日期。

---

## 一 · 本目录已归档凭证

| 文件 | 对象 | 许可 | 商业使用 | 说明 |
| --- | --- | --- | --- | --- |
| `three.js-r165-LICENSE-MIT.txt` | three.js r0.165.0 | MIT License（© 2010-2024 three.js authors） | 允许 | 渲染引擎。MIT 允许商业使用、修改、再分发，仅需保留版权声明 |
| `three.js-VERSION.txt` | three.js 版本锁定记录 | — | — | 版本号存证，确保交付工程可复现 |

> three.js 已 vendor 到 `vendor/three/`，未做任何修改；许可全文同时保留在 `vendor/three/LICENSE`。

---

## 二 · 需交付方补充归档的项（获取后放入本目录）

| 待归档文件名 | 对象 | 许可 | 获取渠道 | 备注 |
| --- | --- | --- | --- | --- |
| `SourceHanSans-OFL-1.1.txt` | 思源黑体 SC（Source Han Sans SC） | SIL Open Font License 1.1 | github.com/adobe-fonts/source-han-sans | 允许商业使用与嵌入；字幕与 HUD 中文主字体 |
| `NotoSansSC-OFL-1.1.txt` | Noto Sans SC | SIL Open Font License 1.1 | fonts.google.com/noto | 思源黑体的等价回退 |
| `JetBrainsMono-OFL-1.1.txt` | JetBrains Mono | SIL Open Font License 1.1 | jetbrains.com/lp/mono | HUD 数值等宽字体 |
| `ffmpeg-LICENSE.txt` | ffmpeg | LGPL 2.1+ / GPL 2+（取决于构建配置） | ffmpeg.org | **仅作为封装工具在本机运行，不嵌入交付物**，故不构成交付物的许可传染 |
| `python-PSF-LICENSE.txt` | Python 3 标准库 | PSF License | python.org | 仅用于本地服务器与构建脚本 |
| `<客户>-VI-授权书.pdf` | 企业 Logo 与 VI 规范 | 客户内部授权 | 客户提供 | 需客户书面确认可用于本片及衍生版本 |
| `<配音>-授权书.pdf` | 正式配音 | 商业授权 | 客户指定配音方 | 当前工程内音频为程序化原创；正式配音方案待客户确认 |

---

## 三 · 原创性说明（无需第三方凭证的资产）

| 资产类别 | 生成方式 | 源文件 |
| --- | --- | --- |
| 三维模型 | 全部由参数化几何函数程序化生成（曲面镜、椭球面片、分面镜、桁架、法兰、鳍片、腔体剖切） | `src/geom.js`、`src/stage.js` |
| 纹理贴图 | Canvas2D + 值噪声/FBM 程序化生成（拉丝粗糙度、机加工法线、芯片版图、硅片表面、HUD 网格、辉光精灵） | `src/materials.js` |
| 环境光照 | 程序化 equirectangular 画布经 PMREM 卷积生成，**非第三方 HDRI** | `src/materials.js` → `buildEnvironment()` |
| 音乐 | WebAudio 振荡器合成（三角波/锯齿波垫底、正弦亚低频、脉冲音序、和声进行） | `src/audio.js` → `scheduleMusic()` |
| 音效 | 程序化合成（噪声整形冲击、FM 铃声、频率上扫、气流带通噪声、等离子体不谐和泛音） | `src/audio.js` → `scheduleSFX()` |
| 混响脉冲 | 确定性伪随机噪声 + 指数衰减包络程序化生成，**非第三方 IR 采样** | `src/audio.js` → `makeImpulse()` |
| 芯片版图图形 | 程序化生成的 SRAM 阵列 / 标准单元行 / 曼哈顿布线 / 电源网格 / IO 环，**非任何真实产品版图** | `src/materials.js` → `chipLayout()` |

> 说明：芯片版图为示意性程序化图形，不涉及任何真实芯片的版图数据或商业秘密。

---

## 四 · 侵权风险自查

- [x] 未使用任何来源不明的三维模型
- [x] 未使用任何第三方纹理贴图或 HDRI
- [x] 未使用任何商用曲库音乐或音效包
- [x] 未使用任何未授权字体（全部 SIL OFL 或系统字体）
- [x] 未复制任何企业的真实机型 CAD 数据或版图数据
- [x] 参数取值仅使用公开数据；未公开项以示意值处理并标注
- [x] 第三方软件库许可已归档且允许商业使用
- [ ] 客户 VI 授权书（待客户提供）
- [ ] 正式配音授权书（待配音方案确认）
