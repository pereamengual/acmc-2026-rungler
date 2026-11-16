import { STAGES, normalize } from './core/parameters.js';
import { ParameterStore } from './core/store.js';
import { RNBOAdapter } from './adapters/rnbo-adapter.js';
import { Knob, Toggle, Select, element } from './components/controls.js';
import { Oscilloscope, CVMonitor, SpectrumAnalyzer, XYPlot } from './components/plots.js';
import { GraphicDemo } from './core/graphic-demo.js';
const store = new ParameterStore({ onDiagnostic: reportEngineError });
const adapter = new RNBOAdapter({ onDiagnostic: reportEngineError });
const constructors = { knob: Knob, toggle: Toggle, select: Select };
const nav = document.querySelector('#stage-navigation');
const controlsNode = document.querySelector('#parameters');
const announcement = document.querySelector('#lab-announcement');
let controls = [], activeStage;
const plots = [new Oscilloscope(), new CVMonitor(), new SpectrumAnalyzer(), new XYPlot()];
document.querySelector('#plots').append(...plots.map(plot => plot.el));
const demo = new GraphicDemo(frame => plots.forEach(plot => plot.draw(frame)));
const demoInput = document.querySelector('#graphic-demo');
demoInput.addEventListener('change', () => {
  demo.setEnabled(demoInput.checked);
  document.querySelector('#demo-status').textContent = demoInput.checked
    ? 'Simulated graphic demo on · illustrative patterns · no audio or measurements.'
    : 'Demo off. Displays have no engine data.';
});
for (const stage of STAGES) {
  const link = element('a', 'stage-link'); link.href = `#stage=${stage.id}`;
  link.append(element('span', 'stage-number', stage.id), element('span', 'stage-nav-title', stage.title));
  nav.append(link);
}
function showStage() {
  if (activeStage && !location.hash.startsWith('#stage=')) return;
  const id = location.hash.startsWith('#stage=') ? location.hash.slice(7) : '0A';
  activeStage = STAGES.find(stage => stage.id === id) || STAGES[0];
  if (id !== activeStage.id) {
    history.replaceState(null, '', `#stage=${activeStage.id}`);
    announcement.textContent = 'Unknown stage. Showing stage 0A.';
  }
  announcement.textContent = `Stage ${activeStage.id}: ${activeStage.title}. Interface only; no audio.`;
  controls.forEach(control => control.dispose());
  controls = activeStage.parameters.map(p => new constructors[p.type](p, store));
  controlsNode.replaceChildren(...controls.map(control => control.el));
  document.querySelector('#stage-title').textContent = `${activeStage.id} / ${activeStage.title}`;
  document.querySelector('#stage-category').textContent = activeStage.category;
  document.querySelector('#stage-description').textContent = activeStage.description;
  document.title = `${activeStage.id} / ${activeStage.title} — The Rungler Lab`;
  for (const link of nav.children) {
    if (link.hash === `#stage=${activeStage.id}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const first = activeStage.parameters[0];
  demo.setAmount(normalize(first, store.get(first.id)));
  // No engine is connected in Phase 1. Future activation must await this handshake.
  adapter.setStage(activeStage.id, store.snapshot(activeStage.id)).catch(reportEngineError);
}
function reportEngineError() { announcement.textContent = 'Engine connection failed. Audio remains unavailable.'; }
// Prepared synchronization: only explicit, validated port events can confirm values.
// No port is connected in this phase; nothing fabricates engine acknowledgements.
const unsubscribeAdapter = adapter.subscribe(event => {
  if (event.type === 'status') {
    store.setConfirmationContext(event.status === 'ready'
      ? { connectionId: event.connectionId, stageRevision: event.stageRevision } : null);
  } else if (event.type === 'stage-requested') {
    store.setConfirmationContext(event);
  } else if (event.type === 'parameter-confirmed') {
    store.confirm(event);
  }
});
const unsubscribe = store.subscribe(({ id, value, source }) => {
  if (id === activeStage.parameters[0].id) demo.setAmount(normalize(activeStage.parameters[0], value));
  if (source !== 'engine') adapter.setParameter(id, value).catch(reportEngineError);
});
document.querySelector('#reset-stage').addEventListener('click', () => {
  store.reset(activeStage.id);
  announcement.textContent = `Stage ${activeStage.id} parameters reset to defaults.`;
});
window.addEventListener('hashchange', showStage);
showStage();
// BFCache pages retain their instance; only tear down when actually leaving.
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  window.removeEventListener('hashchange', showStage);
  unsubscribe(); unsubscribeAdapter(); store.setConfirmationContext(null); controls.forEach(control => control.dispose());
  plots.forEach(plot => plot.dispose()); demo.dispose(); adapter.dispose().catch(reportEngineError);
});
