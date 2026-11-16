// PANEL CONTROLS — knobs, switches and selectors
//
//   KNOB      drag up or right to raise, down or left to lower; double-click: default value.
//             Hold Shift while dragging for fine adjustment: the value moves by exactly one
//             step of its resolution (e.g. 0.01 Hz) every 4 pixels, so 8.00 Hz is easy to set.
//             Keyboard: Tab to it; arrows = 1 % of the travel, Shift + arrow = one fine step,
//             Page Up/Down = 10 %, Home/End = limits.
//             A knob that sets a clock (parameter.led) has a small LED beside its value,
//             lit by the engine's real clock pulses.
//             Minimum and maximum sit at the two ends of the arc; the value is in the box.
//             A knob may show its value in another unit when another control asks for it
//             (parameter.display: { by, factors }): e.g. 0A's bandwidth shows the audio
//             filter's real cutoff (× 100) while you listen to the filtered noise.
//   SWITCH    click or Space.
//   SELECTOR  the browser's own menu.
//
// Every control reads and writes the parameter store; none of them talks to the engine.

import { normalize, denormalize, formatValue, defaultValue } from '../core/parameters.js';
import { ClockLed } from './clock-led.js';

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Short form for the ends of a knob: 2000 Hz → 2k Hz, 0.05 → 0.05.
function compact(parameter, value) {
  const number = Math.abs(value) >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : `${Number(value.toFixed(2))}`;
  return parameter.unit ? `${number} ${parameter.unit}` : number;
}

class Control {
  constructor(parameter, store, className) {
    this.parameter = parameter;
    this.store = store;
    this.el = element('div', `parameter-control ${className}`);
    this.labelId = `label-${parameter.id.replace('.', '-')}`;
    this.inputId = `param-${parameter.id.replace('.', '-')}`;
  }
  // Keep the control in step with the store, whoever changes the value.
  follow(update) {
    this.unsubscribe = this.store.subscribe(({ id, value }) => { if (id === this.parameter.id) update(value); });
    update(this.store.get(this.parameter.id));
  }
  dispose() { this.unsubscribe?.(); this.el.remove(); }
}

const ARC = 270; // degrees of travel, from lower left (min) to lower right (max)

export class Knob extends Control {
  constructor(parameter, store) {
    super(parameter, store, 'knob-control');
    const p = parameter;
    const label = element('span', 'parameter-label', p.label);
    label.id = this.labelId;

    // The knob face is the slider itself (role="slider"), so it works with keyboard and screen readers.
    const face = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    face.setAttribute('viewBox', '0 0 100 100');
    face.setAttribute('class', 'knob-face');
    face.setAttribute('role', 'slider');
    face.setAttribute('tabindex', '0');
    face.setAttribute('aria-labelledby', this.labelId);
    face.id = this.inputId;
    // Static trusted markup: track, value arc, cap and pointer.
    face.innerHTML = '<path class="knob-track" d="M21.7 78.3 A40 40 0 1 1 78.3 78.3"/>' +
      '<path class="knob-arc" d="M21.7 78.3 A40 40 0 1 1 78.3 78.3" pathLength="100"/>' +
      '<circle class="knob-cap" cx="50" cy="50" r="27"/><line class="knob-pointer" x1="50" y1="50" x2="50" y2="27"/>';
    const arc = face.querySelector('.knob-arc'), pointer = face.querySelector('.knob-pointer');

    const minText = element('span', 'knob-min'), maxText = element('span', 'knob-max');
    const body = element('div', 'knob-body');
    body.append(face, minText, maxText);
    const display = element('output', 'value-box');
    display.setAttribute('aria-hidden', 'true');
    const valueRow = element('div', 'value-row');
    valueRow.append(display);
    if (p.led) { this.led = new ClockLed(); valueRow.prepend(this.led.el); }
    this.el.append(label, body, valueRow);

    const set = value => store.set(p.id, value);
    const position = () => normalize(p, store.get(p.id));

    // Drag: 180 px of movement cover the whole travel. With Shift held, every 4 px move the
    // value by exactly one step of its resolution. Pressing or releasing Shift mid-drag
    // continues from the current value, so nothing jumps.
    const PIXELS_FOR_FULL_TRAVEL = 180, PIXELS_PER_FINE_STEP = 4;
    let drag = null;
    face.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      face.focus({ preventScroll: true });
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
        fine: event.shiftKey, anchorPixels: 0, anchorValue: store.get(p.id) };
      face.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    face.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const pixels = event.clientX - drag.x + drag.y - event.clientY;
      if (event.shiftKey !== drag.fine) {
        drag.fine = event.shiftKey; drag.anchorPixels = pixels; drag.anchorValue = store.get(p.id);
      }
      const moved = pixels - drag.anchorPixels;
      if (drag.fine) set(drag.anchorValue + Math.round(moved / PIXELS_PER_FINE_STEP) * p.step);
      else set(denormalize(p, normalize(p, drag.anchorValue) + moved / PIXELS_FOR_FULL_TRAVEL));
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) face.addEventListener(type, () => { drag = null; });
    face.addEventListener('dblclick', () => set(defaultValue(p, id => store.get(id))));
    label.addEventListener('click', () => face.focus());

    face.addEventListener('keydown', event => {
      const directions = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 1, PageDown: -1 };
      let next;
      if (event.key === 'Home') next = p.min;
      else if (event.key === 'End') next = p.max;
      else if (directions[event.key]) {
        const current = store.get(p.id), direction = directions[event.key];
        if (event.shiftKey && !event.key.startsWith('Page')) next = current + direction * p.step; // one fine step
        else {
          next = denormalize(p, position() + direction * (event.key.startsWith('Page') ? 0.1 : 0.01));
          if (next === current) next = current + direction * p.step;
        }
      } else return;
      event.preventDefault();
      set(next);
    });

    // What is shown = stored value × factor (1 unless another control says otherwise).
    const factor = () => (p.display ? p.display.factors[store.get(p.display.by)] ?? 1 : 1);
    const show = value => {
      const f = factor(), n = normalize(p, value);
      arc.style.strokeDasharray = `${n * 100} 100`;
      pointer.setAttribute('transform', `rotate(${-ARC / 2 + n * ARC} 50 50)`);
      minText.textContent = compact(p, p.min * f);
      maxText.textContent = compact(p, p.max * f);
      face.setAttribute('aria-valuemin', String(p.min * f));
      face.setAttribute('aria-valuemax', String(p.max * f));
      face.setAttribute('aria-valuenow', String(value * f));
      face.setAttribute('aria-valuetext', formatValue(p, value * f, f));
      display.value = formatValue(p, value * f, f);
    };
    this.follow(show);
    if (p.display) {
      this.unfollowDisplay = store.subscribe(({ id }) => { if (id === p.display.by) show(store.get(p.id)); });
    }
  }

  dispose() { this.unfollowDisplay?.(); this.led?.off(); super.dispose(); }
}

export class Toggle extends Control {
  constructor(parameter, store) {
    super(parameter, store, 'toggle-control');
    const label = element('label', 'parameter-label', parameter.label);
    label.htmlFor = this.inputId;
    const input = element('input', 'toggle-input');
    input.type = 'checkbox';
    input.id = this.inputId;
    input.setAttribute('role', 'switch');
    const state = element('span', 'value-box');
    state.setAttribute('aria-hidden', 'true');
    input.addEventListener('change', () => store.set(parameter.id, Number(input.checked)));
    this.el.append(label, input, state);
    this.follow(value => { input.checked = Boolean(value); state.textContent = value ? 'ON' : 'OFF'; });
  }
}

// SELECTOR: every choice visible at once, the chosen one lit (radio buttons underneath,
// so arrow keys move between choices).
export class Select extends Control {
  constructor(parameter, store) {
    super(parameter, store, 'select-control');
    const group = element('fieldset', 'choice-group');
    group.append(element('legend', 'parameter-label', parameter.label));
    const inputs = parameter.options.map((name, i) => {
      const choice = element('label', 'choice');
      const input = element('input');
      input.type = 'radio';
      input.name = this.inputId;
      input.value = String(i);
      input.addEventListener('change', () => { if (input.checked) store.set(parameter.id, i); });
      choice.append(input, element('span', '', name));
      group.append(choice);
      return input;
    });
    this.el.append(group);
    this.follow(value => inputs.forEach((input, i) => { input.checked = i === value; }));
  }
}
