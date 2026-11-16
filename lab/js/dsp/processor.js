// AUDIO WORKLET PROCESSOR — the bridge between the browser's audio thread and the lab engine
//
//   page (knobs, stage) ──messages──▶ [ this processor ] ──▶ LabEngine ──▶ speakers
//                       ◀─monitors─── (about 30 frames per second)
//
// The browser calls process() for every block of 128 samples.

import { LabEngine } from './lab-engine.js';

class RunglerLabProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.engine = new LabEngine(sampleRate, 1);
    this.samplesPerMonitorFrame = Math.round(sampleRate / 30);
    this.samplesSinceMonitor = 0;
    this.monitorsOn = true;
    this.alive = true;
    this.port.onmessage = ({ data }) => this.receive(data);
  }

  receive(message) {
    switch (message?.type) {
      case 'stage': this.engine.setStage(message.stage, message.parameters); break;
      case 'parameter': this.engine.setParameter(message.id, message.value, message.glide); break;
      case 'reset': this.engine.reset(); break;
      case 'monitors': this.monitorsOn = Boolean(message.enabled); break;
      case 'dispose': this.alive = false; break;
    }
  }

  process(inputs, outputs) {
    const [left, right = left] = outputs[0];   // to the headphones (after the DC blocker)
    const raw = outputs[1]?.[0] ?? null;        // to the oscilloscope and spectrum (before it)
    if (!this.engine.process(left, right, left.length, raw)) {
      left.fill(0); right.fill(0); raw?.fill(0);
      this.port.postMessage({ type: 'fault' });
    }
    this.samplesSinceMonitor += left.length;
    if (this.monitorsOn && this.samplesSinceMonitor >= this.samplesPerMonitorFrame) {
      this.samplesSinceMonitor = 0;
      const frame = this.engine.snapshot();
      this.port.postMessage(frame, [frame.xy.buffer, frame.cv.buffer, frame.events.buffer, frame.patterns.buffer, frame.analysis.buffer, frame.slowCV.buffer]);
    }
    return this.alive;
  }
}

registerProcessor('rungler-lab', RunglerLabProcessor);
