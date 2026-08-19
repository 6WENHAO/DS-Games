金门大桥电影级灾难模拟器 —— 怎么打开
=========================================

【最简单】双击  启动模拟器.bat   （或 start.bat）
脚本会自动：找一个空闲端口 → 起本地服务器 → 打开浏览器。
想关掉时，回到那个黑窗口按任意键即可停止服务器。

为什么不能直接双击 index.html？
本项目用的是 ES module + importmap，物理引擎 Rapier 是 WebAssembly。
浏览器对 file:// 协议下的模块有 CORS 限制，直接打开只会白屏。
所以必须走 http://（这正是 bat 帮你做的事）。

需要什么？
- 一个支持 WebGL2 的浏览器（推荐 Chrome / Edge）
- Node.js 或 Python 3 任意一个（bat 会自动挑）
  Node.js: https://nodejs.org/
- 第一次运行需要联网（three.js 和 Rapier 从 CDN 加载）

手动启动（不想用 bat 的话）
  cd ggb-disaster-sim
  node tools\static-server.mjs . 5173
  然后浏览器打开 http://127.0.0.1:5173/index.html

操作
  左键拖拽        旋转视角
  滚轮            无级缩放 10m ~ 3000m
  单击            设定镜头聚焦中心
  Shift + 单击    定点摧毁（巨兽冲击）
  1 2 3 4         强震 / 海啸 / 陨石 / 巨兽
  空格            暂停（世界静止，镜头仍可自由飞）
  句号 .          暂停时逐帧步进
  R / F           重置桥体 / 全景取景
  左侧面板        时间轴、风暴强度、时间缩放(0.02x~2x)、快照 A-B 对比

白屏怎么办？
  1) 按 F12 打开 Console 看报错
  2) 访问 chrome://gpu 确认硬件加速已开启
  3) 确认联网（CDN）
  4) 换 Chrome / Edge 试试

其他
  webgpu-ocean.html  —— 可选的 WebGPU / TSL 海面示例（需要浏览器支持 WebGPU）
  README.md          —— 完整技术文档：架构、着色器、性能策略、验证记录