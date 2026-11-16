// CLOCK LED — a small light that follows the real clock of the engine
//
//   engine clock pulses (counted per monitor frame) ──▶ [ LED ]
//
//   slow clock (up to ~15 Hz)   one flash per pulse
//   fast clock                  steadily lit, as a hardware LED looks at that speed
//                               (a 60 Hz screen cannot show faster blinking honestly)

const FLASH_MS = 45;
const STEADY_ABOVE_HZ = 15;

export class ClockLed {
  constructor() {
    this.el = document.createElement('span');
    this.el.className = 'clock-led';
    this.el.setAttribute('aria-hidden', 'true');
    this.rate = 0;
    this.lastFrame = 0;
  }

  // pulses: clock pulses in this frame. Called once per engine monitor frame.
  update(pulses) {
    const now = performance.now();
    const seconds = this.lastFrame ? Math.min(0.2, (now - this.lastFrame) / 1000) : 1 / 30;
    this.lastFrame = now;
    this.rate += (pulses / seconds - this.rate) * 0.3; // smoothed pulses per second

    if (this.rate > STEADY_ABOVE_HZ) {
      this.el.classList.add('is-steady');
      return;
    }
    this.el.classList.remove('is-steady');
    if (pulses > 0) {
      this.el.classList.add('is-on');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.el.classList.remove('is-on'), FLASH_MS);
    }
  }

  off() {
    clearTimeout(this.timer);
    this.el.classList.remove('is-on', 'is-steady');
    this.rate = 0;
    this.lastFrame = 0;
  }
}
