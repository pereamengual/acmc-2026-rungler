// The "what each stage shows" table must cover every stage, and every note must explain
// something that can be on screen in that stage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../lab/js/core/parameters.js';
import { STAGE_NOTES, stageView } from '../lab/js/notes.js';

const MONITORS = ['scope', 'spectrum', 'cv', 'xy', 'events', 'register'];
const INDICATORS = ['entropy', 'period', 'twin'];

test('every stage has its notes, and every view key is a real monitor or indicator', () => {
  for (const stage of STAGES) {
    const notes = STAGE_NOTES[stage.id];
    assert.ok(notes, `stage ${stage.id} has no notes`);
    const views = notes.modes
      ? Object.entries(notes.modes).filter(([key]) => key !== 'by').map(([, view]) => view)
      : [notes];
    const onScreen = new Set(['stage']);
    for (const view of views) {
      view.monitors.forEach(m => { assert.ok(MONITORS.includes(m), `${stage.id}: unknown monitor ${m}`); onScreen.add(m); });
      view.indicators.forEach(i => { assert.ok(INDICATORS.includes(i), `${stage.id}: unknown indicator ${i}`); onScreen.add(i); });
    }
    for (const topic of notes.topics) assert.ok(onScreen.has(topic.about), `${stage.id}: note "${topic.title}" explains nothing on screen`);
    const titles = notes.topics.map(t => t.title);
    assert.equal(new Set(titles).size, titles.length, `${stage.id}: repeated note titles`);
    assert.ok(stageView(stage.id, id => stage.parameters.find(p => p.id === id)?.initial));
  }
});
