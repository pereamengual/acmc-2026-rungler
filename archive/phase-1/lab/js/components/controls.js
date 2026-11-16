import { normalize, denormalize, formatValue } from '../core/parameters.js';
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export class NumericDisplay {
  constructor(parameter, value) {
    this.parameter = parameter;
    this.el = element('output', 'numeric-display');
    this.update(value);
  }
  update(value) { this.el.value = formatValue(this.parameter, value); }
}
class Control {
  constructor(parameter, store) {
    this.parameter = parameter;
    this.store = store;
    this.el = element('div', 'parameter-control');
    this.label = element('label', 'parameter-label', parameter.label);
    this.label.htmlFor = `param-${parameter.id}`;
    this.display = new NumericDisplay(parameter, store.get(parameter.id));
    this.display.el.htmlFor = this.label.htmlFor;
    this.el.append(this.label);
  }
  bind(input, update) {
    input.id = this.label.htmlFor;
    input.name = this.parameter.id;
    this.input = input;
    this.el.append(input, this.display.el);
    this.unsubscribe = this.store.subscribe(({ id, value }) => {
      if (id === this.parameter.id) { update(value); this.display.update(value); }
    });
    update(this.store.get(this.parameter.id));
  }
  dispose() { this.unsubscribe?.(); this.el.remove(); }
}
export class Knob extends Control {
  constructor(parameter, store) {
    super(parameter, store);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('knob-face');
    // Static trusted markup; parameter labels/values are assigned as text only.
    svg.innerHTML = '<path d="M22 78 A40 40 0 1 1 78 78" fill="none" stroke="#555" stroke-width="2"/><circle cx="50" cy="50" r="29" fill="#080808" stroke="#aaa"/><line x1="50" y1="50" x2="50" y2="27" stroke="white" stroke-width="2"/>';
    const indicator = svg.querySelector('line');
    this.el.append(svg);
    const input = element('input', 'knob-range');
    input.type = 'range'; input.min = '0'; input.max = '1000'; input.step = '1';
    input.addEventListener('input', () => store.set(parameter.id, denormalize(parameter, Number(input.value) / 1000)));
    let gesture;
    svg.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      input.focus({ preventScroll: true });
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, value: normalize(parameter, store.get(parameter.id)) };
      svg.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    svg.addEventListener('pointermove', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const delta = (event.clientX - gesture.x + gesture.y - event.clientY) / 180;
      store.set(parameter.id, denormalize(parameter, gesture.value + delta));
    });
    const endGesture = () => { gesture = null; };
    svg.addEventListener('pointerup', endGesture);
    svg.addEventListener('pointercancel', endGesture);
    svg.addEventListener('lostpointercapture', endGesture);
    // Pointer/touch use the native range; explicit keys avoid dead zones after log quantization.
    input.addEventListener('keydown', event => {
      const directions = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 1, PageDown: -1 };
      const current = store.get(parameter.id);
      let next;
      if (event.key === 'Home') next = parameter.min;
      else if (event.key === 'End') next = parameter.max;
      else if (directions[event.key]) {
        const direction = directions[event.key];
        const step = event.key.startsWith('Page') || event.shiftKey ? .1 : .01;
        next = denormalize(parameter, normalize(parameter, current) + direction * step);
        if (next === current) next = current + direction * parameter.step;
      } else return;
      event.preventDefault();
      store.set(parameter.id, next);
    });
    this.bind(input, value => {
      const n = normalize(parameter, value);
      input.value = String(Math.round(n * 1000));
      input.setAttribute('aria-valuetext', formatValue(parameter, value));
      indicator.setAttribute('transform', `rotate(${-135 + n * 270} 50 50)`);
    });
    const range = element('span', 'parameter-range', `${formatValue(parameter, parameter.min)} — ${formatValue(parameter, parameter.max)}`);
    this.el.append(range);
  }
}
export class Toggle extends Control {
  constructor(parameter, store) {
    super(parameter, store);
    const input = element('input', 'toggle-input');
    input.type = 'checkbox'; input.setAttribute('role', 'switch');
    input.addEventListener('change', () => store.set(parameter.id, Number(input.checked)));
    this.bind(input, value => { input.checked = Boolean(value); });
  }
}
export class Select extends Control {
  constructor(parameter, store) {
    super(parameter, store);
    const input = element('select', 'parameter-select');
    parameter.options.forEach((name, i) => {
      const option = element('option', '', name); option.value = String(i); input.append(option);
    });
    input.addEventListener('change', () => store.set(parameter.id, Number(input.value)));
    this.bind(input, value => { input.value = String(value); });
  }
}
