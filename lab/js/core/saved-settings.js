// SAVED SETTINGS — the knobs survive a reload
//
//   knobs ──▶ parameter store ──▶ saved in this browser (every change, after a short pause)
//                    ▲
//   reload ──────────┘ restored at start
//
// Only this browser remembers (localStorage); nothing is sent anywhere. The master level is
// never saved: the page always starts quiet, for the sake of headphones. A parameter marked
// `remember: false` (0a Listen) always opens at its starting value.
//
// The page no longer has buttons for them, but a stage can still be turned into a short text
// and back (settingsText, applySettingsText: handy in tests and for a bug report from the
// console), and forgetSaved() removes what this browser remembers.

import { STAGES, PARAMETERS } from './parameters.js';

const KEY = 'rungler-lab-settings-v2'; // v2: stage 1 became three steps
const SAVE_AFTER_MS = 300;
const THEME_KEY = 'rungler-theme'; // set by components/theme.js
let forgotten = false;           // after Forget, stop saving until the next change

// Put back the values saved in this browser. Unknown or invalid values are skipped.
export function restoreSaved(store) {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return; }
  const values = Object.entries(saved?.values ?? {}).filter(([id]) => PARAMETERS[id]?.remember !== false);
  applyValues(store, Object.fromEntries(values));
}

// Save every change, a moment after the last one. Returns the cleanup function.
export function keepSaved(store) {
  let timer;
  return store.subscribe(() => {
    forgotten = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (forgotten) return;
      const values = Object.fromEntries(Object.keys(PARAMETERS).filter(id => PARAMETERS[id].remember !== false).map(id => [id, store.get(id)]));
      try { localStorage.setItem(KEY, JSON.stringify({ values })); } catch { /* private mode: not saved */ }
    }, SAVE_AFTER_MS);
  });
}

// Remove everything this lab keeps in the browser.
export function forgetSaved() {
  forgotten = true;
  try { localStorage.removeItem(KEY); localStorage.removeItem(THEME_KEY); } catch { /* nothing stored */ }
}

// The current stage and its values, as readable text.
export function settingsText(store, stageId) {
  const stage = STAGES.find(s => s.id === stageId);
  return JSON.stringify({
    lab: 'The Rungler Lab',
    stage: stageId,
    title: stage.title,
    copied: new Date().toISOString(),
    values: store.snapshot(stageId)
  }, null, 2);
}

// Load a text made by settingsText. Returns the stage id, or throws a readable error.
export function applySettingsText(store, text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This is not a settings text from the lab.'); }
  if (!STAGES.some(s => s.id === data?.stage) || typeof data.values !== 'object') {
    throw new Error('This text has no stage or no values.');
  }
  applyValues(store, data.values);
  return data.stage;
}

function applyValues(store, values) {
  if (!values || typeof values !== 'object') return;
  for (const [id, value] of Object.entries(values)) {
    if (!Object.hasOwn(PARAMETERS, id) || typeof value !== 'number') continue;
    try { store.set(id, value, 'restore'); } catch { /* out of date or invalid: keep the default */ }
  }
}
