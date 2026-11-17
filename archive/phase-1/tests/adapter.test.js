import test from 'node:test';
import assert from 'node:assert/strict';
import { RNBOAdapter } from '../lab/js/adapters/rnbo-adapter.js';
import { ParameterStore } from '../lab/js/core/store.js';
import { STAGES } from '../lab/js/core/parameters.js';
import { fixture, deferred, turn } from './fake-port.js';
const snapshot = id => new ParameterStore().snapshot(id);

test('offline methods validate but do not claim a connected engine', async () => {
  const a = new RNBOAdapter();
  assert.equal(a.status, 'unavailable');
  assert.equal(await a.command('start'), false);
  assert.equal(await a.setParameter('0A.depth', .3), false);
  assert.equal(await a.setStage('0A', snapshot('0A')), false);
  await assert.rejects(a.connect({}), TypeError);
  await assert.rejects(a.connect({ ...fixture().port, contractVersion: 1 }), TypeError);
  assert.throws(() => a.subscribe(null), TypeError);
});

test('inherited/unknown IDs and non-finite or nonnumeric values never reach port', async () => {
  const a = new RNBOAdapter(), f = fixture(); await a.connect(f.port);
  for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'missing', 1, null, {}]) {
    await assert.rejects(a.setParameter(id, 1), RangeError);
  }
  for (const value of [NaN, Infinity, -Infinity, '1', true, undefined, null]) {
    await assert.rejects(a.setParameter('0A.depth', value), TypeError);
    await assert.rejects(a.setStage('0A', { ...snapshot('0A'), '0A.depth': value }), TypeError);
  }
  const inherited = Object.create(snapshot('0A'));
  await assert.rejects(a.setStage('0A', inherited), RangeError);
  await assert.rejects(a.setStage('wrong', {}), RangeError);
  await assert.rejects(a.command('masterLevel', NaN), RangeError);
  await assert.rejects(a.command('mute', 1), TypeError);
  await assert.rejects(a.command('start', 'anything'), TypeError);
  assert.equal(f.calls.filter(c => ['parameter', 'stage', 'command'].includes(c[0])).length, 0);
  await a.dispose();
});

test('clamping, discrete rounding and captured snapshots preserve control semantics', async () => {
  const a = new RNBOAdapter(), f = fixture(); await a.connect(f.port);
  const values = snapshot('0A'), pending = a.setStage('0A', values); values['0A.depth'] = NaN;
  await pending;
  assert.equal(f.calls.find(c => c[0] === 'stage')[2]['0A.depth'], 1);
  await a.setParameter('0A.depth', 5);
  assert.equal(f.calls.at(-1)[2], 3);
  await a.setParameter('0B.quantize', .6);
  assert.equal(f.calls.at(-1)[2], 1);
  await a.setParameter('0A.depth', .333);
  assert.equal(f.calls.at(-1)[2], .33);
  await a.dispose();
});

test('throwing and rejecting listeners cannot break connect or other subscribers', async () => {
  const diagnostics = [], a = new RNBOAdapter({ onDiagnostic: d => diagnostics.push(d) }), f = fixture(), seen = [];
  a.subscribe(() => { throw Error('sync observer'); });
  a.subscribe(async () => { throw Error('async observer'); });
  a.subscribe(event => seen.push(event.type));
  await a.connect(f.port); await turn();
  assert.equal(a.status, 'ready'); assert.equal(f.active.size, 2);
  assert.equal(f.calls.filter(c => c[0] === 'dispose').length, 0);
  assert.ok(diagnostics.length >= 4); assert.deepEqual(seen, ['status', 'status']);
  await a.dispose(); assert.equal(a.status, 'disposed');
});

test('initialization failure rolls back completely and preserves original cleanup error cause', async () => {
  const original = Error('initialize failed'), secondary = Error('release failed'), diagnostics = [];
  const a = new RNBOAdapter({ onDiagnostic: d => diagnostics.push(d) });
  const f = fixture({ async initialize() { throw original; }, async dispose() { throw secondary; } });
  await assert.rejects(a.connect(f.port), error => error === original);
  assert.equal(a.status, 'error'); assert.equal(a.connectionId, null);
  assert.ok(diagnostics.some(d => d.error === secondary));
  const next = fixture(); await a.connect(next.port);
  assert.equal(a.status, 'ready'); await a.dispose();
});

test('partial subscription failure unsubscribes acquired handles then disposes once', async () => {
  const original = Error('subscription failed'), f = fixture({ subscribeParameterChanges() { throw original; } });
  const a = new RNBOAdapter();
  await assert.rejects(a.connect(f.port), error => error === original);
  assert.equal(a.status, 'error'); assert.equal(a.connectionId, null); assert.equal(f.active.size, 0);
  assert.deepEqual(f.calls.slice(-2).map(c => c[0]), ['unsubscribe-telemetry', 'dispose']);
  const bad = fixture({ subscribeTelemetry() { return {}; } });
  await assert.rejects(a.connect(bad.port), TypeError);
  await a.dispose();
});

test('cleanup failure still runs every release, is terminal and has one shared rejection', async () => {
  const f = fixture(), unsubscribeError = Error('unsubscribe failed'), disposeError = Error('dispose failed');
  f.port.subscribeParameterChanges = () => () => { f.calls.push(['bad-unsubscribe']); throw unsubscribeError; };
  f.port.dispose = async () => { f.calls.push(['dispose']); throw disposeError; };
  const a = new RNBOAdapter(); await a.connect(f.port);
  const first = a.dispose(), second = a.dispose();
  assert.equal(first, second);
  await assert.rejects(first, error => error instanceof AggregateError && error.errors.includes(unsubscribeError) && error.errors.includes(disposeError));
  assert.equal(a.status, 'disposed'); assert.equal(a.connectionId, null); assert.equal(f.active.size, 0);
  assert.equal(f.calls.filter(c => c[0] === 'dispose').length, 1);
  assert.ok(f.calls.some(c => c[0] === 'unsubscribe-telemetry'));
  await assert.rejects(a.connect(fixture().port), /disposed/);
  await assert.rejects(a.setParameter('0A.depth', .2), /disposed/);
  await assert.rejects(a.setStage('0A', snapshot('0A')), /disposed/);
  await assert.rejects(a.command('panic'), /disposed/);
  assert.throws(() => a.subscribe(() => {}), /disposed/);
});

test('setStage, setParameter and commands execute FIFO without overlapping port calls', async () => {
  const gate = deferred(), started = deferred(), order = [];
  const f = fixture({
    async setStage(id, values, meta) { order.push(['stage-start', id, meta.requestId]); started.resolve(); await gate.promise; order.push(['stage-end', id]); },
    async setParameter(id, value, meta) { order.push(['parameter', id, meta.requestId]); },
    async command(name, value, meta) { order.push(['command', name, meta.requestId]); }
  });
  const a = new RNBOAdapter(); await a.connect(f.port);
  const stage = a.setStage('1', snapshot('1')), parameter = a.setParameter('1.osc1', 500), command = a.command('mute', true);
  await started.promise; assert.equal(order.length, 1);
  gate.resolve(); await Promise.all([stage, parameter, command]);
  assert.deepEqual(order.map(c => c[0]), ['stage-start', 'stage-end', 'parameter', 'command']);
  assert.deepEqual([order[0][2], order[2][2], order[3][2]], [1, 2, 3]);
  await a.dispose();
});

test('dispose invalidates immediately, cancels queued work and drains in-flight work before releasing', async () => {
  const gate = deferred(), started = deferred(), f = fixture();
  f.port.setStage = async () => { f.calls.push(['stage-start']); started.resolve(); await gate.promise; f.calls.push(['stage-end']); };
  const a = new RNBOAdapter(); await a.connect(f.port);
  const stage = a.setStage('1', snapshot('1')); const stageRejected = assert.rejects(stage, { name: 'AbortError' });
  const parameter = a.setParameter('1.osc1', 200); const parameterRejected = assert.rejects(parameter, { name: 'AbortError' });
  await started.promise; const cleanup = a.dispose();
  assert.equal(a.status, 'disposed'); assert.equal(f.calls.filter(c => c[0] === 'dispose').length, 0);
  await assert.rejects(a.command('start'), /disposed/);
  gate.resolve(); await Promise.all([stageRejected, parameterRejected, cleanup]);
  assert.ok(f.calls.findIndex(c => c[0] === 'stage-end') < f.calls.findIndex(c => c[0] === 'dispose'));
  assert.equal(f.calls.filter(c => c[0] === 'parameter').length, 0);
});

test('dispose during initialization aborts cooperatively and late resolution cannot make ready', async () => {
  const gate = deferred(), started = deferred(); let signal;
  const f = fixture({ async initialize(ctx) { signal = ctx.signal; started.resolve(); await gate.promise; } });
  const a = new RNBOAdapter(), statuses = []; a.subscribe(e => { if(e.type === 'status') statuses.push(e.status); });
  const connection = a.connect(f.port); const rejection = assert.rejects(connection, { name: 'AbortError' });
  await started.promise; await assert.rejects(a.connect(fixture().port), /connecting/);
  const cleanup = a.dispose(); assert.equal(signal.aborted, true);
  gate.resolve(); await Promise.all([rejection, cleanup]);
  assert.deepEqual(statuses, ['loading', 'disposed']); assert.equal(a.connectionId, null);
  assert.equal(f.calls.filter(c => c[0] === 'dispose').length, 1);
});

test('rapid stage changes keep FIFO snapshots but suppress old revisions and old callbacks', async () => {
  const a = new RNBOAdapter(), f = fixture(), events = []; a.subscribe(e => events.push(e)); await a.connect(f.port);
  await Promise.all(STAGES.map(s => a.setStage(s.id, snapshot(s.id))));
  const calls = f.calls.filter(c => c[0] === 'stage');
  assert.deepEqual(calls.map(c => c[1]), STAGES.map(s => s.id));
  assert.deepEqual(calls.map(c => c[3].stageRevision), [1,2,3,4,5,6]);
  f.emit('parameters', { id: '0A.depth', value: .8, sequence: 1, stageRevision: 1 });
  f.emit('telemetry', { stageRevision: 1, payload: 'old' });
  f.emit('parameters', { id: '4.rateA', value: .2, sequence: 1, stageRevision: 6 });
  assert.equal(events.filter(e => e.type === 'parameter-confirmed').length, 1);
  await a.dispose(); const length = events.length;
  f.emit('telemetry', { stageRevision: 6, payload: 'late' });
  f.emit('parameters', { id: '4.rateA', value: .5, sequence: 2, stageRevision: 6 });
  assert.equal(events.length, length);
});

test('operation failure retires connection; old deliveries cannot change a retry', async () => {
  const failure = Error('write failed'), f = fixture({ async setParameter() { throw failure; } });
  const a = new RNBOAdapter(), events = []; a.subscribe(e => events.push(e)); await a.connect(f.port);
  const oldId = a.connectionId;
  await assert.rejects(a.setParameter('0A.depth', .7), e => e === failure);
  assert.equal(a.status, 'error'); assert.equal(f.active.size, 0);
  const next = fixture(); await a.connect(next.port); assert.notEqual(a.connectionId, oldId);
  const length = events.length;
  f.emit('parameters', { id: '0A.depth', value: .9, sequence: 99, stageRevision: 0 });
  f.emit('telemetry', { stageRevision: 0, payload: 'obsolete instance' });
  assert.equal(events.length, length); assert.equal(a.status, 'ready');
  await a.dispose();
});

test('confirmations are explicit, validated, monotonic and separate from requested values', async () => {
  const diagnostics = [], a = new RNBOAdapter({ onDiagnostic: d => diagnostics.push(d) }), f = fixture(), store = new ParameterStore();
  a.subscribe(e => {
    if (e.type === 'status') store.setConfirmationContext(e.status === 'ready' ? e : null);
    if (e.type === 'stage-requested') store.setConfirmationContext(e);
    if (e.type === 'parameter-confirmed') store.confirm(e);
  });
  await a.connect(f.port); await a.setStage('0A', snapshot('0A'));
  store.set('0A.depth', .8); await a.setParameter('0A.depth', .8);
  assert.equal(store.getConfirmed('0A.depth'), null); // Promise resolution does not fabricate acknowledgement.
  f.emit('parameters', { id: '0A.depth', value: .795, sequence: 2, stageRevision: 1 });
  assert.equal(store.get('0A.depth'), .8); assert.equal(store.getConfirmed('0A.depth').value, .795);
  f.emit('parameters', { id: '0A.depth', value: .1, sequence: 1, stageRevision: 1 });
  for(const id of ['constructor','missing']) f.emit('parameters', { id, value: .5, sequence: 3, stageRevision: 1 });
  for(const value of [NaN,Infinity,4]) f.emit('parameters', { id: '0A.depth', value, sequence: 3, stageRevision: 1 });
  f.emit('parameters', { id: '0B.quantize', value: .5, sequence: 3, stageRevision: 1 });
  assert.equal(store.getConfirmed('0A.depth').value, .795); assert.equal(diagnostics.length, 6);
  await a.dispose(); assert.equal(store.getConfirmed('0A.depth'), null);
});

test('reentrant disposal from loading or ready observers cannot resurrect connection', async () => {
  for (const when of ['loading','ready']) {
    const a = new RNBOAdapter(), f = fixture(); let disposal;
    a.subscribe(e => { if(e.type === 'status' && e.status === when) disposal = a.dispose(); });
    await assert.rejects(a.connect(f.port), {name:'AbortError'});
    await disposal;
    assert.equal(a.status,'disposed'); assert.equal(a.connectionId,null);
    assert.equal(f.active.size,0); assert.equal(f.calls.filter(c=>c[0]==='dispose').length,1);
  }
});

test('reentrant stage subscribers cannot reorder an already accepted stage request', async () => {
  const a = new RNBOAdapter(), f = fixture(); await a.connect(f.port); let follow;
  a.subscribe(e => { if(e.type === 'stage-requested' && e.stageId === '0A') follow = a.setStage('0B',snapshot('0B')); });
  await a.setStage('0A',snapshot('0A')); await follow;
  assert.deepEqual(f.calls.filter(c=>c[0]==='stage').map(c=>c[1]),['0A','0B']);
  await a.dispose();
});

test('operation error remains original when port release also fails and queued work is cancelled', async () => {
  const original = Error('write failure'), cleanupError = Error('release failure');
  const a = new RNBOAdapter(), f = fixture({async setStage(){throw original;},async dispose(){throw cleanupError;}});
  await a.connect(f.port);
  const stage = a.setStage('0A',snapshot('0A'));
  const parameter = a.setParameter('0A.depth',.9);
  await Promise.all([assert.rejects(stage,e=>e===original),assert.rejects(parameter,{name:'AbortError'})]);
  assert.equal(a.status,'error'); assert.equal(a.connectionId,null); assert.equal(f.calls.filter(c=>c[0]==='parameter').length,0);
  await a.dispose();
});

test('retry cannot overlap failed-connection cleanup', async () => {
  const releasing = deferred(), gate = deferred(), original = Error('load failed');
  const f = fixture({async initialize(){throw original;},async dispose(){releasing.resolve();await gate.promise;}});
  const a = new RNBOAdapter(), pending = a.connect(f.port), rejection = assert.rejects(pending,e=>e===original);
  await releasing.promise;
  await assert.rejects(a.connect(fixture().port),/cleaning/);
  gate.resolve(); await rejection;
  const next = fixture(); await a.connect(next.port); assert.equal(a.status,'ready'); await a.dispose();
});

test('a retry triggered by error notification is not modified by old queued work', async () => {
  const failure = Error('old write failed'), old = fixture({async setStage(){throw failure;}}), next = fixture();
  const a = new RNBOAdapter(); let retry;
  a.subscribe(e => { if(e.type === 'status' && e.status === 'error') retry = a.connect(next.port); });
  await a.connect(old.port);
  const stage = a.setStage('0A',snapshot('0A')), parameter = a.setParameter('0A.depth',.8);
  await Promise.all([assert.rejects(stage,e=>e===failure),assert.rejects(parameter,{name:'AbortError'})]);
  await retry; assert.equal(a.status,'ready');
  assert.equal(old.calls.filter(c=>c[0]==='parameter').length,0);
  await a.setParameter('0A.depth',.4); assert.equal(next.calls.at(-1)[0],'parameter');
  await a.dispose();
});
