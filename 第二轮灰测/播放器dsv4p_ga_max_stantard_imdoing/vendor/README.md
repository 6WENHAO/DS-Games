# vendor/ — 依赖策略说明

**这个目录是空的，而且是故意空的。**

`dsv4p max stantard imdoing` 的运行时**没有任何第三方依赖**：

- 不加载任何 CDN 资源（没有 `<script src="https://...">`，没有 `@import`，没有网络字体）
- 没有 `node_modules`，`package.json` 的 `dependencies` 与 `devDependencies` 都是空的
- 不需要构建（没有打包器、没有转译器），源码即产物
- 因此把整个文件夹复制到 Linux 或 Windows 上都能直接使用，无需联网、无需安装

之所以保留 `vendor/` 这个目录，是为了明确一件事：**如果以后确实要引入第三方库，请把它的源码放在这里**
（连同许可证文件），并在下方表格登记，保持「文件夹自带全部依赖」这个性质不被破坏。请不要改成从 CDN 或
`node_modules` 加载。

## 第三方库 → 自研模块 对照表

下面这些事情通常会用现成的库解决，本项目全部自己实现了，实现位置一并列出，便于日后替换或对照：

| 常见做法 | 本项目的实现 | 位置 | 说明 |
| --- | --- | --- | --- |
| `mp4box.js` / `mux.js` 解析 MP4 | 自研 ISO-BMFF 解析器 | `src/core/mp4index.js` | `stts`/`ctts`/`stss`/`stsz`/`elst`/`mdhd`/`tkhd`/`stsd`，以及分片 MP4 的 `moof`/`traf`/`tfhd`/`trun`/`tfdt`；输出逐帧精确显示时间戳、关键帧下标、精确有理数帧率 |
| `jszip` / `fflate` 打包 | 自研 ZIP 写入器 | `src/core/zip.js` | STORE（不压缩）模式 + CRC32 + UTF-8 文件名标志位；PNG 本身已压缩，再 deflate 收益极低 |
| `three.js` / `regl` / `twgl` | 自研极简 WebGL 核心 | `src/gl/gl.js` | 上下文、程序缓存与友好报错、渲染目标池、按 sampler 自省绑定纹理、区域回读 |
| `glsl-canvas` 类滤镜框架 | 自研滤镜注册表 + 着色器注入 | `src/gl/shaderlib.js`、`src/gl/pipeline.js` | 参数表自动生成 uniform 声明与 UI 控件，多 pass、降采样 pass、像素网格联动 |
| `react` / `vue` / `lit` | 原生 DOM + 40 行 `h()` | `src/core/ns.js`、`src/ui/*` | 界面结构直接写在 `index.html` 里，动态部分用 `h()` 生成 |
| `dayjs` / `timecode` | 自研时间码模块 | `src/core/timecode.js` | SMPTE 丢帧/非丢帧、多种输入写法、帧率吸附 |
| `rvfc-polyfill` | 引擎内置降级路径 | `src/core/player.js` | 没有 `requestVideoFrameCallback` 时自动改用 `rAF + currentTime` |
| `http-server` / `serve` | 自研零依赖静态服务器 | `tools/serve.js`、`tools/serve.py` | 含 HTTP Range（206）——视频拖动定位必需；Node 与 Python 两份实现，覆盖两种机器 |
| `jest` / `vitest` | Node 内置测试运行器 | `tests/*.test.js` | `node:test` + `node:assert/strict` |
| `jsdom` + `headless-gl` | 自研最小 DOM 与 WebGL 桩 | `tools/smoke-dom.js` | 无浏览器环境下驱动真实启动与渲染路径，并校验 uniform 完整性 |
| `eslint` + `glslangValidator` | 自研针对性静态检查 | `tools/lint-shaders.js` | 只查这个项目真正会踩的坑：GLSL ES 1.00 禁用语法、未声明 uniform、整数字面量、循环上界、参数元数据 |

## 唯一的可选外部工具：ffmpeg

`tools/make-demo.sh`（生成演示片与测试样片）和 `tools/verify-mp4index.js`（拿 `ffprobe` 当地面真值校验解析器）
需要 ffmpeg。这两件事都属于**开发/验证流程**，播放器运行时完全不需要 ffmpeg，
`media/` 与 `tests/fixtures/` 里的成品文件已经随包提供。
