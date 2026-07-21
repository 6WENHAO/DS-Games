/*
 * controller.js —— 标准手柄模拟
 *
 * NES 手柄本质是一颗 8 位"并入串出"移位寄存器（4021 芯片）：
 *   1. 游戏向 $4016 写 1（strobe 拉高）：持续锁存当前 8 个按键状态
 *   2. 写 0：停止锁存，进入移位模式
 *   3. 之后每读一次 $4016（1P）/$4017（2P），依次移出一位：
 *      A → B → Select → Start → 上 → 下 → 左 → 右
 *   4. 8 位读完后继续读返回 1
 *
 * buttons[0..7] 与上述顺序一一对应，由 main.js 在每帧开始前
 * 根据键盘/手柄输入刷新。
 */
"use strict";
class Controller {
  constructor() {
    this.buttons = new Uint8Array(8);
    this.index = 0;  // 下一个要移出的位
    this.strobe = 0;
  }

  write(val) {
    this.strobe = val & 1;
    if (this.strobe) this.index = 0;
  }

  read() {
    let r = 1;
    if (this.index < 8) r = this.buttons[this.index];
    /* strobe 拉高期间反复读到的都是 A 键（index 不前进） */
    if (!this.strobe && this.index < 8) this.index++;
    return r;
  }
}
