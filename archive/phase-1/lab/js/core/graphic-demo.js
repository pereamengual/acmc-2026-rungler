// Graphics fixtures only. No oscillator, noise, register, filter or Rungler DSP.
// Coordinates are arbitrary normalized drawing units, never seconds/volts/Hz/dB.
export function graphicFrame(phase, amount = .5) {
  const gain = .15 + amount * .25;
  const scope = [], cv = [], spectrum = [], xy = [];
  for (let i = 0; i < 128; i++) {
    const x = i / 127;
    scope.push([x, .5 + gain * Math.sin(x * Math.PI * 4 + phase)]);
    xy.push([.5 + gain * Math.sin(x * Math.PI * 2 + phase), .5 + gain * Math.cos(x * Math.PI * 4)]);
  }
  for (let i = 0; i < 16; i++) {
    const y = .5 + gain * Math.sin(i * 1.7 + phase);
    cv.push([i / 16, y], [(i + 1) / 16, y]);
    spectrum.push([(i + .5) / 16, .2 + gain * (1 + Math.sin(i * .7 + phase))]);
  }
  return { scope, cv, spectrum, xy };
}
export class GraphicDemo {
  constructor(render) {
    this.render = render;
    this.enabled = false;
    this.phase = 0;
    this.amount = .5;
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.onVisibility = () => this.refresh();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.motion.addEventListener('change', this.onVisibility);
  }
  setEnabled(enabled) { this.enabled = enabled; this.refresh(); }
  setAmount(value) { this.amount = value; if (this.enabled) this.render(graphicFrame(this.phase, this.amount)); }
  refresh() {
    cancelAnimationFrame(this.raf);
    this.last = undefined;
    this.render(this.enabled ? graphicFrame(this.phase, this.amount) : null);
    if (this.enabled && !document.hidden && !this.motion.matches) this.raf = requestAnimationFrame(time => this.tick(time));
  }
  tick(time) {
    if (this.last === undefined || time - this.last >= 1000 / 24) {
      this.phase += .025;
      this.render(graphicFrame(this.phase, this.amount));
      this.last = time;
    }
    this.raf = requestAnimationFrame(time => this.tick(time));
  }
  dispose() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.motion.removeEventListener('change', this.onVisibility);
  }
}
