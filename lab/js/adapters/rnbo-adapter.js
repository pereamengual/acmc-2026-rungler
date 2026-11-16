import { STAGES, getParameter, clampValue, validateConfirmedValue } from '../core/parameters.js';
import { SafeListeners, reportDiagnostic } from '../core/subscriptions.js';
let connectionCounter = 0;
function cancelled() { return new DOMException('Adapter connection disposed or superseded', 'AbortError'); }
// Transport facade only. No audio supervisor or @rnbo/js device is implemented.
export class RNBOAdapter {
  #connection = null;
  #status = 'unavailable';
  #events;
  #diagnostic;
  #disposePromise = null;
  constructor({ onDiagnostic = () => {} } = {}) {
    this.#events = new SafeListeners(onDiagnostic);
    this.#diagnostic = onDiagnostic;
  }
  get status() { return this.#status; }
  get connectionId() { return this.#connection?.id ?? null; }
  #current(c) { return this.#connection === c && !c.closed && this.#status !== 'disposed'; }
  #statusEvent(status, c, extra = {}) {
    this.#status = status;
    this.#events.emit({ type: 'status', status, connectionId: c?.id ?? null, stageRevision: c?.revision ?? 0, ...extra });
  }
  async connect(port) {
    if (this.#status === 'disposed' || this.#connection) throw new Error('Adapter is disposed, connected or connecting/cleaning');
    const methods = ['initialize', 'setStage', 'setParameter', 'command', 'subscribeTelemetry', 'dispose'];
    if (port?.contractVersion !== 2 || methods.some(key => typeof port[key] !== 'function') ||
      (port.subscribeParameterChanges !== undefined && typeof port.subscribeParameterChanges !== 'function')) {
      throw new TypeError('Engine-neutral port v2 required');
    }
    const c = {
      id: `connection-${++connectionCounter}`, port, closed: false, abort: new AbortController(),
      revision: 0, request: 0, stageId: null, sequences: new Map(), unsubs: [],
      tail: Promise.resolve(), cleanup: null
    };
    this.#connection = c;
    const initialize = Promise.resolve().then(() => {
      if (!this.#current(c)) throw cancelled();
      return port.initialize(Object.freeze({ connectionId: c.id, signal: c.abort.signal }));
    });
    c.connectWork = (async () => {
      try {
        await initialize;
        if (!this.#current(c)) throw cancelled();
        this.#register(c, port.subscribeTelemetry(frame => this.#telemetry(c, frame)));
        if (!this.#current(c)) throw cancelled();
        if (port.subscribeParameterChanges) {
          this.#register(c, port.subscribeParameterChanges(frame => this.#confirmation(c, frame)));
        }
        if (!this.#current(c)) throw cancelled();
        this.#statusEvent('ready', c);
        if (!this.#current(c)) throw cancelled();
      } catch (error) {
        await this.#retire(c, error);
        throw error; // Cleanup/diagnostics must not replace the original failure.
      }
    })();
    this.#statusEvent('loading', c);
    return c.connectWork;
  }
  #register(c, unsubscribe) {
    if (typeof unsubscribe !== 'function') throw new TypeError('Subscription must return a cleanup function');
    c.unsubs.push(unsubscribe);
  }
  #telemetry(c, frame) {
    try {
      if (this.#current(c) && this.#status === 'ready' && frame?.stageRevision === c.revision) {
        this.#events.emit({ type: 'telemetry', connectionId: c.id, stageRevision: c.revision, payload: frame.payload });
      }
    } catch (error) { reportDiagnostic(this.#diagnostic, error, 'telemetry'); }
  }
  #confirmation(c, frame) {
    try {
      if (!this.#current(c) || this.#status !== 'ready' || frame?.stageRevision !== c.revision) return;
      const p = getParameter(frame.id);
      validateConfirmedValue(p, frame.value);
      if (c.stageId && !STAGES.find(s => s.id === c.stageId).parameters.some(item => item.id === frame.id)) throw new RangeError('Confirmation for another stage');
      if (!Number.isSafeInteger(frame.sequence) || frame.sequence < 0) throw new TypeError('Invalid confirmation sequence');
      if (frame.sequence <= (c.sequences.get(frame.id) ?? -1)) return;
      c.sequences.set(frame.id, frame.sequence);
      this.#events.emit({ type: 'parameter-confirmed', id: frame.id, value: frame.value,
        sequence: frame.sequence, connectionId: c.id, stageRevision: c.revision });
    } catch (error) { reportDiagnostic(this.#diagnostic, error, 'confirmation'); }
  }
  #context(c) {
    return Object.freeze({ connectionId: c.id, stageRevision: c.revision, requestId: ++c.request });
  }
  #readyConnection() {
    if (this.#status === 'disposed') throw new Error('Adapter disposed');
    return this.#status === 'ready' && this.#current(this.#connection) ? this.#connection : null;
  }
  #enqueue(c, context, operation) {
    const work = c.tail.then(async () => {
      if (!this.#current(c) || this.#status !== 'ready') throw cancelled();
      try { await operation(context); }
      catch (error) {
        if (this.#current(c)) await this.#retire(c, error);
        throw error;
      }
      if (!this.#current(c)) throw cancelled();
      return true; // Transport completion only, never an engine-value confirmation.
    });
    c.tail = work.catch(() => {});
    return work;
  }
  async setStage(id, values) {
    const stage = STAGES.find(stage => stage.id === id);
    if (!stage) throw new RangeError('Unknown stage ID');
    if (values === null || typeof values !== 'object') throw new TypeError('Stage snapshot required');
    const snapshot = Object.freeze(Object.fromEntries(stage.parameters.map(p => {
      if (!Object.hasOwn(values, p.id)) throw new RangeError(`Missing parameter ${p.id}`);
      return [p.id, clampValue(p, values[p.id])];
    })));
    const c = this.#readyConnection();
    if (!c) return false;
    c.revision++; c.stageId = id; c.sequences.clear();
    const context = this.#context(c);
    // Enqueue before notifying: a reentrant subscriber cannot jump ahead of this stage.
    const work = this.#enqueue(c, context, meta => c.port.setStage(id, snapshot, meta));
    this.#events.emit({ type: 'stage-requested', stageId: id, ...context });
    return work;
  }
  async setParameter(id, value) {
    const next = clampValue(getParameter(id), value);
    const c = this.#readyConnection();
    if (!c) return false;
    return this.#enqueue(c, this.#context(c), meta => c.port.setParameter(id, next, meta));
  }
  async command(name, value) {
    if (!['start', 'mute', 'masterLevel', 'panic'].includes(name)) throw new RangeError('Unknown engine command');
    if (name === 'mute' && typeof value !== 'boolean') throw new TypeError('Mute requires boolean');
    if (name === 'masterLevel' && (!Number.isFinite(value) || value < 0 || value > 1)) throw new RangeError('Master level requires 0…1');
    if ((name === 'start' || name === 'panic') && value !== undefined) throw new TypeError('Command takes no payload');
    const c = this.#readyConnection();
    if (!c) return false;
    return this.#enqueue(c, this.#context(c), meta => c.port.command(name, value, meta));
  }
  subscribe(listener) {
    if (this.#status === 'disposed') throw new Error('Adapter disposed');
    return this.#events.subscribe(listener);
  }
  #cleanup(c) {
    if (!c.cleanup) c.cleanup = Promise.resolve().then(async () => {
      const errors = [];
      try {
        for (const unsubscribe of c.unsubs.splice(0).reverse()) {
          try { await unsubscribe(); }
          catch (error) { errors.push(error); }
        }
      } finally {
        try { await c.port.dispose(); }
        catch (error) { errors.push(error); }
      }
      for (const error of errors) reportDiagnostic(this.#diagnostic, error, 'cleanup');
      return Object.freeze(errors);
    });
    return c.cleanup;
  }
  async #retire(c, error) {
    c.closed = true;
    c.abort.abort();
    const cleanupErrors = await this.#cleanup(c);
    if (this.#connection === c) {
      this.#connection = null;
      if (this.#status !== 'disposed') this.#statusEvent('error', c, { error, cleanupErrors });
    }
  }
  dispose() {
    if (this.#disposePromise) return this.#disposePromise;
    const c = this.#connection;
    // Cache the promise before notifying external observers (reentrancy-safe).
    this.#disposePromise = Promise.resolve().then(async () => {
      if (!c) return;
      try {
        await c.connectWork.catch(() => {});
        await c.tail;
        const errors = await this.#cleanup(c);
        if (errors.length) throw new AggregateError(errors, 'Adapter cleanup failed');
      } finally { if (this.#connection === c) this.#connection = null; }
    });
    if (c) { c.closed = true; c.abort.abort(); }
    this.#statusEvent('disposed', c);
    this.#events.clear();
    return this.#disposePromise;
  }
}
