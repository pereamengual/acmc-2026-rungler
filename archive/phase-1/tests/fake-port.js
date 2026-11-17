// Test transport only; no DSP, Web Audio or RNBO implementation.
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export const turn = () => new Promise(resolve => setImmediate(resolve));
export function fixture(overrides = {}) {
  const calls = [], callbacks = {}, active = new Set();
  const subscribe = (kind, listener) => {
    callbacks[kind] = listener; active.add(kind);
    return () => { calls.push([`unsubscribe-${kind}`]); active.delete(kind); };
  };
  const port = {
    contractVersion: 2,
    async initialize(context) { calls.push(['initialize', context]); },
    async setStage(...args) { calls.push(['stage', ...args]); },
    async setParameter(...args) { calls.push(['parameter', ...args]); },
    async command(...args) { calls.push(['command', ...args]); },
    subscribeTelemetry(fn) { return subscribe('telemetry', fn); },
    subscribeParameterChanges(fn) { return subscribe('parameters', fn); },
    async dispose() { calls.push(['dispose']); },
    ...overrides
  };
  // Keep old callbacks intentionally: tests can simulate deliveries after unsubscribe.
  return { port, calls, active, callbacks, emit: (kind, frame) => callbacks[kind]?.(frame) };
}
