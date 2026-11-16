import { STAGES, PARAMETERS, getParameter, clampValue, validateConfirmedValue } from './parameters.js';
import { SafeListeners } from './subscriptions.js';
export class ParameterStore {
  #values = new Map(Object.values(PARAMETERS).map(p => [p.id, p.initial]));
  #confirmed = new Map();
  #context = null;
  #listeners;
  #confirmedListeners;
  constructor({ onDiagnostic } = {}) {
    this.#listeners = new SafeListeners(onDiagnostic);
    this.#confirmedListeners = new SafeListeners(onDiagnostic);
  }
  get(id) { getParameter(id); return this.#values.get(id); }
  set(id, value, source = 'ui') {
    const next = clampValue(getParameter(id), value);
    if (next === this.get(id)) return;
    this.#values.set(id, next);
    this.#listeners.emit({ id, value: next, source });
  }
  snapshot(stageId) {
    const stage = STAGES.find(s => s.id === stageId);
    if (!stage) throw new RangeError('Unknown stage ID');
    return Object.fromEntries(stage.parameters.map(p => [p.id, this.get(p.id)]));
  }
  reset(stageId) {
    for (const id of Object.keys(this.snapshot(stageId))) this.set(id, PARAMETERS[id].initial, 'reset');
  }
  subscribe(listener) { return this.#listeners.subscribe(listener); }
  getConfirmed(id) { getParameter(id); return this.#confirmed.get(id) ?? null; }
  setConfirmationContext(context) {
    if (context !== null && (typeof context?.connectionId !== 'string' || !context.connectionId ||
      !Number.isSafeInteger(context.stageRevision) || context.stageRevision < 0)) throw new TypeError('Invalid confirmation context');
    if (this.#context?.connectionId === context?.connectionId && this.#context?.stageRevision === context?.stageRevision) return;
    this.#context = context === null ? null : Object.freeze({ connectionId: context.connectionId, stageRevision: context.stageRevision });
    this.#confirmed.clear();
    this.#confirmedListeners.emit({ type: 'confirmations-invalidated', context: this.#context });
  }
  confirm({ id, value, connectionId, stageRevision, sequence }) {
    validateConfirmedValue(getParameter(id), value);
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw new TypeError('Invalid confirmation sequence');
    if (!this.#context || connectionId !== this.#context.connectionId || stageRevision !== this.#context.stageRevision) return false;
    if (sequence <= (this.#confirmed.get(id)?.sequence ?? -1)) return false;
    const confirmed = Object.freeze({ id, value, connectionId, stageRevision, sequence });
    this.#confirmed.set(id, confirmed);
    this.#confirmedListeners.emit({ type: 'parameter-confirmed', ...confirmed });
    // Requested values deliberately remain unchanged; confirmation never echoes a request.
    return true;
  }
  subscribeConfirmed(listener) { return this.#confirmedListeners.subscribe(listener); }
}
