import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, PARAMETERS, normalize, denormalize, clampValue, formatValue, decimalsOf, defaultValue } from '../lab/js/core/parameters.js';
import { ParameterStore } from '../lab/js/core/store.js';
test('six stages have unique stable IDs and valid defaults/scales', () => {
  assert.deepEqual(STAGES.map(s => s.id), ['0A','0B','1','2','3','4']);
  const ids=STAGES.flatMap(s=>s.parameters.map(p=>p.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const p of Object.values(PARAMETERS)) {
    assert.equal(clampValue(p,p.initial),p.initial);
    assert.ok(p.min < p.max && p.step > 0);
    if (p.scale === 'log') assert.ok(p.min > 0);
    assert.equal(denormalize(p,0),p.min); assert.equal(denormalize(p,1),p.max);
    assert.ok(Math.abs(denormalize(p,normalize(p,p.initial))-p.initial) <= p.step);
  }
});
test('log slider midpoint is geometric and invalid input is rejected', () => {
  const p=PARAMETERS['1.osc1'];
  assert.ok(Math.abs(denormalize(p,.5)-Math.sqrt(p.min*p.max)) <= p.step);
  assert.throws(()=>clampValue(p,NaN),TypeError);
  assert.equal(clampValue(p,1e9),p.max);
  assert.equal(clampValue(PARAMETERS['1.step'],.6),1);
});
test('store persists independent stages, clamps, resets and cleans subscriptions', () => {
  const store=new ParameterStore(), events=[];
  const off=store.subscribe(event=>events.push(event));
  store.set('1.osc1',330); store.set('0A.depth',5);
  assert.equal(store.snapshot('1')['1.osc1'],330);
  assert.equal(store.get('0A.depth'),3);
  store.reset('0A');
  assert.equal(store.get('0A.depth'),1); assert.equal(store.get('1.osc1'),330);
  const length=events.length; store.set('0A.depth',1); assert.equal(events.length,length);
  assert.equal(events.at(-1).source,'reset');
  off(); store.set('1.osc1',400); assert.equal(events.length,length);
  assert.throws(()=>store.set('missing',0),RangeError);
  assert.throws(()=>store.snapshot('missing'),RangeError);
  assert.throws(()=>store.set('1.osc1',Infinity),TypeError);
});
test('store rejects inherited IDs and all non-finite/nonnumeric requests without mutation', () => {
  const store = new ParameterStore(), before = store.snapshot('0A'), events = [];
  store.subscribe(event => events.push(event));
  for (const id of ['constructor','__proto__','toString','hasOwnProperty','missing',null,1,{}]) {
    assert.throws(() => store.get(id), RangeError);
    assert.throws(() => store.set(id, 1), RangeError);
    assert.throws(() => store.getConfirmed(id), RangeError);
  }
  for (const value of [NaN,Infinity,-Infinity,'1',true,null,undefined]) {
    assert.throws(() => store.set('0A.depth', value), TypeError);
    assert.throws(() => normalize(PARAMETERS['0A.depth'], value), TypeError);
    assert.throws(() => denormalize(PARAMETERS['0A.depth'], value), TypeError);
  }
  assert.deepEqual(store.snapshot('0A'),before); assert.equal(events.length,0);
});

test('store isolates synchronous and async subscriber failures and invalid diagnostic observers', async () => {
  const diagnostics = [], store = new ParameterStore({ onDiagnostic: d => diagnostics.push(d) }), values = [];
  store.subscribe(() => { throw Error('sync'); });
  store.subscribe(async () => { throw Error('async'); });
  const off = store.subscribe(event => values.push(event.value));
  store.set('0A.depth',.8); await new Promise(resolve => setImmediate(resolve));
  assert.equal(store.get('0A.depth'),.8); assert.deepEqual(values,[.8]); assert.equal(diagnostics.length,2);
  off(); off(); store.reset('0A'); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(values,[.8]); assert.equal(store.get('0A.depth'),1);
  assert.throws(() => store.subscribe(null),TypeError);
  const badReporter = new ParameterStore({onDiagnostic: async () => {throw Error('reporter');}});
  badReporter.subscribe(() => {throw Error('listener');}); badReporter.set('0A.depth',.2);
  await new Promise(resolve => setImmediate(resolve));
});

test('confirmed values have explicit provenance, no request echo, and invalidate by context', () => {
  const store = new ParameterStore(), requests = [], confirmations = [];
  store.subscribe(e => requests.push(e)); store.subscribeConfirmed(e => confirmations.push(e));
  assert.equal(store.getConfirmed('0A.depth'),null);
  store.setConfirmationContext({connectionId:'test-1',stageRevision:1});
  const message = {id:'0A.depth',value:.503,connectionId:'test-1',stageRevision:1,sequence:1};
  assert.equal(store.confirm(message),true);
  assert.equal(store.get('0A.depth'),1); assert.equal(store.getConfirmed('0A.depth').value,.503);
  assert.equal(requests.length,0); assert.equal(store.confirm(message),false);
  assert.equal(store.confirm({...message,connectionId:'old',sequence:9}),false);
  assert.throws(() => store.confirm({...message,id:'constructor'}),RangeError);
  assert.throws(() => store.confirm({...message,value:NaN}),TypeError);
  assert.throws(() => store.confirm({...message,value:4}),RangeError);
  assert.throws(() => store.confirm({...message,id:'0B.quantize',value:.5}),RangeError);
  store.set('0A.depth',.7); store.reset('0A');
  assert.equal(store.getConfirmed('0A.depth').value,.503); // Reset controls is not resetDSPState.
  store.setConfirmationContext({connectionId:'test-1',stageRevision:2});
  assert.equal(store.getConfirmed('0A.depth'),null); assert.equal(store.confirm(message),false);
  store.setConfirmationContext(null); assert.equal(store.confirm({...message,stageRevision:2}),false);
  assert.equal(confirmations.filter(e => e.type === 'parameter-confirmed').length,1);
});

test('0A bandwidth is the low-pass cutoff of the noise and stages declare whether they sound', () => {
  const p = PARAMETERS['0A.bandwidth'];
  assert.equal(p.label,'Noise bandwidth');
  assert.deepEqual([p.min,p.max,p.initial,p.unit,p.scale,p.step],[.05,30,1,'Hz','log',.01]);
  assert.doesNotMatch(STAGES[0].description,/No clock, no register/);
  assert.deepEqual(STAGES.filter(s => s.implemented).map(s => s.id),['0A','0B','1','2','3','4']);
});

test('knob values show every decimal of their resolution, and fine steps land exactly', () => {
  assert.deepEqual([decimalsOf(.01), decimalsOf(.1), decimalsOf(1)], [2, 1, 0]);
  const clock = PARAMETERS['0B.clock'];
  assert.equal(formatValue(clock, 8), '8.00 Hz');
  assert.equal(clampValue(clock, 7.99 + clock.step), 8);          // one fine step up from 7.99
  assert.equal(formatValue(PARAMETERS['1.osc1'], 183), '183.0 Hz');
  const bandwidth = PARAMETERS['0A.bandwidth'];
  assert.equal(formatValue(bandwidth, 100, 100), '100 Hz');      // shown ×100 while filtered noise plays
});

test('step defaults use real controls of their stage, inside their range, and drive defaultValue', () => {
  for (const stage of STAGES.filter(s => s.stepDefaults)) {
    const { by, ...steps } = stage.stepDefaults;
    for (const values of Object.values(steps)) for (const [id, value] of Object.entries(values)) {
      const p = stage.parameters.find(q => q.id === id);
      assert.ok(p, `${id} is not a control of stage ${stage.id}`);
      assert.equal(clampValue(p, value), value, `${id} = ${value} is outside its range or resolution`);
    }
  }
  const osc2 = PARAMETERS['1.osc2'];   // stage 1 shares one set of defaults across its steps
  for (const step of [0, 1, 2]) assert.equal(defaultValue(osc2, id => (id === '1.step' ? step : null)), osc2.initial);
});
