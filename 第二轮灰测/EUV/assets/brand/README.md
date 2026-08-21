# 企业 VI 接入位（Brand Assets Drop-in）

把客户的品牌资产放到本目录，即可在不改动任何渲染代码的前提下完成 VI 应用。

## 步骤

### 1 · 放入 Logo

```
assets/brand/logo.svg      推荐：矢量，任意分辨率清晰
assets/brand/logo.png      备选：建议 ≥ 1024 px 宽，透明背景
```

### 2 · 填写 `src/config.js` 的 `BRAND` 段

```js
export const BRAND = {
  nameZh: '客户企业中文名',
  nameEn: 'CLIENT COMPANY',
  titleZh: 'EUV 光刻原理',
  titleEn: 'How EUV Lithography Works',
  subtitleZh: '锡滴激光等离子体光源 · 全工艺链三维演示',
  subtitleEn: 'Tin-Droplet Laser-Produced-Plasma Source · Full Process Chain',
  taglineZh: '客户品牌标语',
  taglineEn: 'Client tagline',
  logoUrl: './assets/brand/logo.svg',    // ← 填入此处
  colors: {
    primary: '#3FA9F5',   // VI 主色：HUD 主线、进度条、参数卡描边
    accent:  '#7CE0FF',   // VI 强调色：示意角标、数值、刻度
    plasma:  '#FFF1C9',   // 等离子体白热（一般不随 VI 变）
    tin:     '#C9D2DC',   // 锡金属
    warn:    '#FF9F45',   // 红外/带外杂散光、示意值标记
    ink:     '#0A0E14',   // 底色
    paper:   '#EAF2FA',   // 正文文字
    grid:    '#1B2836',   // HUD 网格与分隔线
  },
  fontStack: '"客户指定中文字体","Source Han Sans SC",...',
  fontStackMono: '"客户指定等宽字体","JetBrains Mono",...',
};
```

### 3 · 生效范围（无需改其它代码）

| 元素 | 取用的 BRAND 字段 |
| --- | --- |
| 片头标题卡 | `titleZh` / `titleEn` / `subtitleZh` / `subtitleEn` / `colors.primary` / `colors.accent` |
| 片尾定版 | `nameZh` / `nameEn` / `taglineZh` / `taglineEn` |
| 全片常驻字标 | `nameZh` / `nameEn`（未提供 Logo 时为矢量字标回退） |
| 「示意 / Simulation」角标 | `colors.accent` |
| 参数标注卡 | `colors.primary`（公开值）/ `colors.warn`（示意值） |
| 章节进度条与步骤刻度 | `colors.primary` / `colors.accent` / `colors.grid` |
| 3D 锚定标签与引线 | `colors.accent` / `colors.paper` |
| 字幕文字与描边 | `colors.paper` / `fontStack` |
| EUV 光束与光路着色 | `colors.primary` / `colors.accent` |
| 播放器外壳 | `css/app.css` 顶部的 CSS 变量（与 BRAND 色板保持一致即可） |

### 4 · 改完必做

```bash
# 重跑校验，确认品牌配置完整性断言仍全绿（G 组）
open http://127.0.0.1:8777/test/verify.html

# 重新导出片头/片尾关键帧与封面图
open http://127.0.0.1:8777/tools/capture.html   → 静态资产
```

## 约束

- 字体必须为客户已获授权或开源许可（SIL OFL）字体，凭证归档到 `delivery/licenses/`。
- Logo 需客户书面确认可用于本片及全部衍生版本（含社媒横竖版），授权书归档到 `delivery/licenses/`。
- 若 VI 规定了 Logo 最小尺寸与安全边距，请在 `src/hud.js` 的 `drawBrand()` 中调整对应像素值
  （该函数已按 1080 高为基准做等比缩放，改一处即对 4K 与竖版同时生效）。
