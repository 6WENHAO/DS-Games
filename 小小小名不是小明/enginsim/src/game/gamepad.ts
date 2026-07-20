export interface PadFrame {
  connected: boolean;
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
  camToggle: boolean;
  reset: boolean;
  vizToggle: boolean;
}

const DEADZONE = 0.12;

export class GamepadInput {
  private prevButtons: boolean[] = [];

  poll(): PadFrame {
    const frame: PadFrame = {
      connected: false, steer: 0, throttle: 0, brake: 0,
      handbrake: false, camToggle: false, reset: false, vizToggle: false
    };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp: Gamepad | null = null;
    for (const p of pads) {
      if (p && p.connected) { gp = p; break; }
    }
    if (!gp) {
      this.prevButtons = [];
      return frame;
    }
    frame.connected = true;

    let x = gp.axes[0] ?? 0;
    if (Math.abs(x) < DEADZONE) x = 0;
    else x = Math.sign(x) * (Math.abs(x) - DEADZONE) / (1 - DEADZONE);
    frame.steer = x * Math.abs(x) * 0.65 + x * 0.35;

    frame.throttle = gp.buttons[7]?.value ?? 0;
    frame.brake = gp.buttons[6]?.value ?? 0;
    frame.handbrake = gp.buttons[0]?.pressed ?? false;

    const edge = (i: number): boolean => {
      const now = gp!.buttons[i]?.pressed ?? false;
      const was = this.prevButtons[i] ?? false;
      this.prevButtons[i] = now;
      return now && !was;
    };
    frame.camToggle = edge(3);
    frame.reset = edge(2);
    frame.vizToggle = edge(8);
    this.prevButtons[0] = gp.buttons[0]?.pressed ?? false;

    return frame;
  }
}
