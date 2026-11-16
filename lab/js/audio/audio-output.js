// AUDIO OUTPUT — the browser side of the sound
//
//   ┌─────────────────────────┐ out 1 (DC-blocked)  ┌─────────┐   ┌──────────────┐
//   │ AudioWorklet            │────────────────────▶│ LIMITER │──▶│ MASTER LEVEL │──▶ headphones
//   │ (lab engine, processor) │                     └─────────┘   └──────────────┘
//   └────────────┬────────────┘
//                └── out 2 (raw) ──▶ ANALYSER (oscilloscope and spectrum: the patch exactly as it
//                                    is, before the DC blocker; sees the signal even when muted)
//
// Safety: nothing sounds until START is pressed; the level always fades in and out;
// the limiter catches peaks; PANIC cuts the level at once and restarts the patch.

const LIMITER = { threshold: -6, knee: 0, ratio: 20, attack: 0.002, release: 0.15 };
const FADE_SECONDS = 0.05;

export class AudioOutput {
  constructor({ onMonitor = () => {}, onState = () => {} } = {}) {
    this.onMonitor = onMonitor;
    this.onState = onState;
    this.state = 'stopped';
    this.level = 0.5;
    this.muted = false;
  }

  get supported() {
    return typeof AudioContext !== 'undefined' && typeof AudioWorkletNode !== 'undefined';
  }

  setState(state, detail) {
    this.state = state;
    this.onState(state, detail);
  }

  async build() {
    const context = new AudioContext({ latencyHint: 'interactive' });
    await context.audioWorklet.addModule(new URL('../dsp/processor.js', import.meta.url));

    const engine = new AudioWorkletNode(context, 'rungler-lab', {
      numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [2, 1]
    });
    const limiter = context.createDynamicsCompressor();
    for (const [name, value] of Object.entries(LIMITER)) limiter[name].value = value;
    const master = context.createGain();
    master.gain.value = 0;
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.7;

    engine.connect(limiter, 0).connect(master).connect(context.destination);
    engine.connect(analyser, 1);

    engine.port.onmessage = ({ data }) => {
      if (data.type === 'monitor') this.onMonitor(data);
      else if (data.type === 'fault') this.onState(this.state, 'The engine produced an invalid value and restarted.');
    };
    context.addEventListener('statechange', () => {
      if (context.state === 'interrupted' || (context.state === 'suspended' && this.state === 'running')) this.setState('suspended');
    });
    Object.assign(this, { context, engine, limiter, master, analyser });
  }

  async start(stage, parameters) {
    if (!this.supported) { this.setState('error', 'This browser has no AudioWorklet support.'); return; }
    try {
      this.setState('starting');
      if (!this.context) await this.build();
      await this.context.resume();
      this.sendStage(stage, parameters);
      this.applyLevel();
      this.setState('running');
    } catch (error) {
      this.setState('error', error.message);
    }
  }

  async stop() {
    if (!this.context) return;
    this.fadeTo(0);
    await new Promise(resolve => setTimeout(resolve, FADE_SECONDS * 4000));
    await this.context.suspend();
    this.setState('stopped');
  }

  // Slider position (0 … 1) to gain: squared, so the low end of the slider is gentle.
  setLevel(position) { this.level = position; this.applyLevel(); }
  setMuted(muted) { this.muted = muted; this.applyLevel(); }
  applyLevel() { this.fadeTo(this.muted ? 0 : this.level * this.level); }

  fadeTo(gain) {
    if (!this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(gain, now, FADE_SECONDS);
  }

  panic() {
    if (!this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0, now);
    this.engine.port.postMessage({ type: 'reset' });
  }

  sendStage(stage, parameters) {
    this.engine?.port.postMessage({ type: 'stage', stage, parameters });
  }

  sendParameter(id, value, glide) {
    this.engine?.port.postMessage({ type: 'parameter', id, value, glide });
  }

  setMonitors(enabled) {
    this.engine?.port.postMessage({ type: 'monitors', enabled });
  }

  async dispose() {
    this.engine?.port.postMessage({ type: 'dispose' });
    await this.context?.close();
  }
}
