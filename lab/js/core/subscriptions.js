// External callbacks cannot interrupt state transitions or other subscribers.
export function reportDiagnostic(callback, error, phase) {
  try { Promise.resolve(callback({ error, phase })).catch(() => {}); }
  catch { /* A diagnostic observer must not become another failure source. */ }
}
export class SafeListeners {
  #listeners = new Set();
  constructor(onDiagnostic = () => {}) {
    if (typeof onDiagnostic !== 'function') throw new TypeError('Diagnostic callback must be callable');
    this.onDiagnostic = onDiagnostic;
  }
  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Listener must be callable');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  emit(event) {
    const notification = Object.freeze({ ...event });
    for (const listener of [...this.#listeners]) {
      if (!this.#listeners.has(listener)) continue;
      try {
        Promise.resolve(listener(notification)).catch(error => reportDiagnostic(this.onDiagnostic, error, 'listener'));
      } catch (error) { reportDiagnostic(this.onDiagnostic, error, 'listener'); }
    }
  }
  clear() { this.#listeners.clear(); }
}
