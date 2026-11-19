// THE RUNGLER LABORATORY — page controller
//
//   stage links ───┐
//   panel controls ┼──▶ PARAMETER STORE ──▶ AUDIO OUTPUT (AudioWorklet engine) ──▶ headphones
//   audio buttons ─┘                               │
//                                                  └──▶ MONITORS (scope, spectrum, CV, XY, events, register)

import { STAGES, getParameter } from './core/parameters.js';
import { ParameterStore } from './core/store.js';
import { restoreSaved, keepSaved } from './core/saved-settings.js';
import { Knob, Toggle, Select, element } from './components/controls.js';
import { Oscilloscope, Spectrum, CVHistory, XYPlot, EventMap, RegisterView } from './components/monitors.js';
import { Indicators } from './components/indicators.js';
import { AudioOutput } from './audio/audio-output.js';
import { setupThemeSwitch } from './components/theme.js';
import { drawBlockDiagram, diagramDependencies } from './components/block-diagram.js';
import { DIAGRAMS } from './diagrams.js';
import { stageView } from './notes.js';
import { holds, idsIn } from './core/conditions.js';

const $ = selector => document.querySelector(selector);
// Stage names on screen: 0a and 0b in lower case (in the title font 0B reads like 08).
// The internal ids (0A, 0B, used in links and parameter names) stay as they are.
const shown = stageId => stageId.toLowerCase();
const store = new ParameterStore();
restoreSaved(store);   // the knobs as you left them in this browser
keepSaved(store);
const controlTypes = { knob: Knob, toggle: Toggle, select: Select };
let activeStage, controls = [], latestFrame = null, freshFrame = false, currentView = { xy: {}, freshWhen: [] };

// ── Monitors ──
const scope = new Oscilloscope(), spectrum = new Spectrum(), cvHistory = new CVHistory();
const xy = new XYPlot(), eventMap = new EventMap(), register = new RegisterView();
// The indicators read the knobs of a stage by their short names ({ osc1: 183, … }).
const controlsOf = stageId => Object.fromEntries(
  STAGES.find(s => s.id === stageId).parameters.map(p => [p.id.slice(p.id.indexOf('.') + 1), store.get(p.id)]));
const indicators = new Indicators(controlsOf);
const monitors = [scope, spectrum, cvHistory, xy, eventMap, register];
$('#indicators').append(indicators.el);
$('#plots').append(...monitors.map(m => m.el));

// ── Audio output ──
const audio = new AudioOutput({
  onMonitor(frame) {
    if (frame.stage !== activeStage.id) return;
    cvHistory.push(frame.slowCV);
    // A clock knob's LED blinks with its oscillator (led: 'B' = OSC B of stage 4).
    for (const control of controls) control.led?.update(control.parameter.led === 'B' ? frame.clocksB : frame.clocks);
    eventMap.add(frame.events);
    indicators.add(frame);
    latestFrame = frame; freshFrame = true;
  },
  onState(state, detail) { showAudioState(state, detail); }
});

const startButton = $('#audio-start'), muteButton = $('#audio-mute'), panicButton = $('#audio-panic');
const levelInput = $('#master-level'), levelOutput = $('#master-level-value');

startButton.addEventListener('click', () => {
  if (audio.state === 'running') audio.stop();
  else audio.start(activeStage.id, stageParameters(activeStage));
});
muteButton.addEventListener('click', () => {
  const muted = muteButton.getAttribute('aria-pressed') !== 'true';
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.textContent = muted ? 'UNMUTE' : 'MUTE';
  audio.setMuted(muted);
});
panicButton.addEventListener('click', () => {
  audio.panic();
  levelInput.value = '0';
  levelInput.dispatchEvent(new Event('input'));
  announce('Panic: level set to zero and the patch restarted.');
});
levelInput.addEventListener('input', () => {
  const position = Number(levelInput.value);
  audio.setLevel(position);
  levelOutput.value = position === 0 ? '0 · silent' : `${Math.round(20 * Math.log10(position * position))} dB`;
});
levelInput.dispatchEvent(new Event('input'));

const STATE_TEXT = {
  stopped: ['ENGINE READY', 'Audio stopped', 'Nothing sounds until you press START AUDIO. Start with the level low.'],
  starting: ['ENGINE STARTING', 'Loading the AudioWorklet', 'Starting the audio engine…'],
  running: ['ENGINE RUNNING', 'AudioWorklet · live', ''],
  suspended: ['ENGINE PAUSED', 'Press START AUDIO again', 'The browser paused audio. Press START AUDIO to resume.'],
  error: ['ENGINE ERROR', 'See the message below', 'The audio engine could not start.']
};

function showAudioState(state, detail = '') {
  const running = state === 'running';
  const [chip, chipDetail, status] = STATE_TEXT[state];
  startButton.dataset.state = state;  // lab.css: filled and pulsing until the audio runs
  startButton.textContent = running ? 'STOP AUDIO' : state === 'starting' ? 'STARTING…' : 'START AUDIO';
  startButton.disabled = state === 'starting' || (state === 'error' && !audio.supported);
  muteButton.disabled = panicButton.disabled = !running;
  $('#engine-chip').replaceChildren(chip, element('br'), element('span', '', chipDetail));
  $('#audio-status').textContent = detail || status;
  monitors.forEach(m => m.setLive(running));
  if (!running) controls.forEach(control => control.led?.off());
  indicators.setLive(running);
  if (!running) monitors.forEach(m => m.message(state === 'error' ? 'Engine error.' : 'Press START AUDIO to see the engine.'));
}

// ── Stages ──
const nav = $('#stage-navigation');
for (const stage of STAGES) {
  const link = element('a', 'stage-link');
  link.href = `#stage=${stage.id}`;
  link.append(element('span', 'stage-number', shown(stage.id)), element('span', 'stage-nav-title', stage.title));
  nav.append(link);
}

function stageParameters(stage) {
  return stage.parameters.map(p => ({ id: p.id, value: store.get(p.id), glide: p.type === 'knob' }));
}

// Controls in a row with the same `group` (core/parameters.js) go into one titled box, which
// spans as many grid columns as it has controls.
let groups = [];
function arrangeInGroups(list) {
  const nodes = [];
  groups = [];
  for (const control of list) {
    const name = control.parameter.group;
    const last = groups.at(-1);
    if (name && last?.name === name && nodes.at(-1) === last.el) {
      last.members.push(control); last.body.append(control.el);
    } else if (name) {
      const el = document.createElement('div'), title = document.createElement('div'), body = document.createElement('div');
      el.className = 'control-group'; title.className = 'control-group-title'; body.className = 'control-group-body';
      title.textContent = name;
      el.setAttribute('role', 'group'); el.setAttribute('aria-label', name);
      el.append(title, body); body.append(control.el);
      groups.push({ name, el, body, members: [control] });
      nodes.push(el);
    } else nodes.push(control.el);
  }
  return nodes;
}

function showStage() {
  const id = location.hash.startsWith('#stage=') ? location.hash.slice(7) : '0A';
  activeStage = STAGES.find(stage => stage.id === id) || STAGES[0];

  controls.forEach(control => control.dispose());
  controls = activeStage.parameters.map(p => new controlTypes[p.type](p, store));
  $('#parameters').replaceChildren(...arrangeInGroups(controls));

  $('#stage-title').textContent = `${shown(activeStage.id)} / ${activeStage.title}`;
  $('#stage-category').textContent = activeStage.category;
  $('#stage-description').textContent = activeStage.description;
  $('#stage-engine-note').textContent = activeStage.implemented ? '' : 'No engine for this stage yet: it is silent.';
  document.title = `${shown(activeStage.id)} / ${activeStage.title} — The Rungler Lab`;
  for (const link of nav.children) {
    if (link.hash === `#stage=${activeStage.id}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  showOnlyWhatApplies(activeStage.id);

  const diagram = DIAGRAMS[activeStage.id];
  drawBlockDiagram($('#block-diagram'), diagram, id => store.get(id));
  $('#block-diagram').hidden = !diagram;
  $('#diagram-empty').hidden = Boolean(diagram);
  $('#diagram-stage').textContent = `· stage ${shown(activeStage.id)}`;

  [cvHistory, xy, eventMap, indicators].forEach(m => m.reset());
  latestFrame = null;
  audio.sendStage(activeStage.id, stageParameters(activeStage));
  announce(`Stage ${shown(activeStage.id)}: ${activeStage.title}.`);
}

store.subscribe(({ id, value }) => {
  audio.sendParameter(id, value, getParameter(id).type === 'knob');
  indicators.reset(); // a new setting is a new system: start the indicators again
  // A switch or selector changes the picture: start the accumulating views again.
  if (getParameter(id).type !== 'knob') { eventMap.reset(); xy.reset(); }
  else if (currentView.freshWhen.includes(id)) eventMap.reset();
  if (viewDependencies(activeStage).has(id)) { showOnlyWhatApplies(activeStage.id); xy.reset(); }
  if (diagramDependencies(DIAGRAMS[activeStage.id]).has(id)) {
    drawBlockDiagram($('#block-diagram'), DIAGRAMS[activeStage.id], key => store.get(key)); // highlight the route you hear
  }
});

// Reset stage: back to the defaults — those of the current step, if the stage has steps
// (the step itself is kept).
$('#reset-stage').addEventListener('click', () => {
  const presets = activeStage.stepDefaults;
  const step = presets ? store.get(presets.by) : null;
  store.reset(activeStage.id);
  if (presets) {
    store.set(presets.by, step);
    for (const [id, value] of Object.entries(presets[step] ?? {})) store.set(id, value);
  }
  announce(`Stage ${shown(activeStage.id)} controls reset to defaults.`);
});

function announce(text) { $('#lab-announcement').textContent = text; }

// Each stage shows only the monitors, indicator readings and notes that mean something there.
function showOnlyWhatApplies(stageId) {
  // Controls: hide those that do nothing with the current switches and selectors.
  for (const control of controls) control.el.hidden = !holds(control.parameter.visibleWhen, id => store.get(id));
  for (const group of groups) {
    const shown = group.members.filter(control => !control.el.hidden).length;
    group.el.hidden = shown === 0;
    group.el.style.setProperty('--span', Math.max(1, shown)); // as wide as its visible controls
  }

  // Monitors, indicator readings and notes: only what this stage (and mode) is about.
  const view = stageView(stageId, id => store.get(id));
  currentView = view;
  let visible = 0;
  for (const monitor of monitors) {
    monitor.el.hidden = !view.monitors.includes(monitor.key);
    if (!monitor.el.hidden) visible++;
  }
  $('#plots').style.setProperty('--columns', visible <= 5 ? Math.max(visible, 1) : visible === 6 ? 3 : 4);
  $('.monitors').hidden = visible === 0;
  $('.indicators-panel').hidden = view.indicators.length === 0;
  indicators.show(view.indicators);
  eventMap.setLimit(view.eventLimit);
  cvHistory.caption(view.cvLabel);

  $('#about-indicators').hidden = view.topics.length === 0;
  $('#stage-notes').replaceChildren(...view.topics.map(({ title, text }) => {
    const topic = element('details');
    topic.append(element('summary', '', title), element('p', '', text));
    return topic;
  }));
}

// The ids of the switches and selectors that change what is on screen in a stage.
function viewDependencies(stage) {
  const ids = new Set(stage.parameters.flatMap(p => idsIn(p.visibleWhen)));
  const mode = stageView(stage.id, id => store.get(id)).dependsOn;
  if (mode) ids.add(mode);
  return ids;
}

// ── Drawing loop: only while audio runs and the page is visible ──
function draw() {
  if (audio.state === 'running' && !document.hidden) {
    scope.draw(audio.analyser);
    spectrum.draw(audio.analyser);
    if (freshFrame && latestFrame && !activeStage.implemented) {
      [cvHistory, xy, eventMap, register].forEach(m => m.message('No engine for this stage yet.'));
      freshFrame = false;
    } else if (freshFrame && latestFrame) {
      cvHistory.draw(); xy.draw(latestFrame, currentView.xy); eventMap.draw(latestFrame.stage, currentView.eventLabel); register.draw(latestFrame);
      indicators.update();
      freshFrame = false;
    }
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
document.addEventListener('visibilitychange', () => audio.setMonitors(!document.hidden));

window.addEventListener('hashchange', showStage);
showStage();
setupThemeSwitch($('#theme-toggle'), () => {
  xy.reset();               // repaint the fading XY trace on the new background
  indicators.drawPlane();   // and the indicators' plane
  if (audio.state !== 'running') monitors.forEach(m => m.message('Press START AUDIO to see the engine.'));
});
showAudioState(audio.supported ? 'stopped' : 'error',
  audio.supported ? '' : 'This browser has no AudioWorklet support. Try a current Chrome, Firefox, Safari or Edge.');
window.addEventListener('pagehide', event => { if (!event.persisted) audio.dispose(); });
