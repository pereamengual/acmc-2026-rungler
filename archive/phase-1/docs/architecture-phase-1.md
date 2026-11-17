# Phase 1.2 — hardened interface and engine boundary

## Scope and baseline

The Git baseline is `bc15ecaeb50a831f3aa2756124d44720d77b4efd`. Phase 1, its audit and this hardening remain local/uncommitted. The landing-page implementation is unchanged by Phase 1.2. Pages still publishes the repository root on main; no publication occurred.

Native HTML/SVG controls use ES modules and a ParameterStore; an engine-neutral RNBOAdapter facade separates the controller from a future engine. No `@rnbo/js`, AudioContext, WASM or DSP engine is present. Canvas demos use separate drawing fixtures, never engine measurements. No external dependency or build step has been introduced.

## Parameters and requested/confirmed state

`core/parameters.js` defines the same 27 IDs in stages 0A, 0B, 1, 2, 3 and 4. Numeric min/max, initial, step, unit, scaling, selector options and topology have not changed. `getParameter(id)` requires a string and an own registry property. Non-finite/nonnumeric values are rejected before clamping. Requests retain min/max limiting, linear-step rounding and discrete 0/1 or selector-index semantics; log sliders normalize only at the component boundary.

`0A.rate` retains its ID/range and is now labeled **Noise bandwidth**. Its intended meaning is the cutoff frequency in Hz of a future low-pass filter applied to noise. No filter is implemented; order, response and cutoff convention remain to be specified. The label does not claim equivalent noise bandwidth (ENBW). The absence of an explicit sample-and-hold stage is distinct from absence of all memory: a digital noise source/PRNG and filter may have state.

ParameterStore API:

- `new ParameterStore({onDiagnostic} = {})`: optional isolated diagnostic observer.
- `get(id)`, `set(id,value,source='ui')`, `snapshot(stageId)`, `reset(stageId)`, `subscribe(listener)`: existing requested-value API. `get` and snapshots are requested values, not evidence of DSP application. Reset restores current-stage controls only, emits per changed value and is not atomic.
- `setConfirmationContext({connectionId,stageRevision} | null)`: selects valid provenance and clears confirmations when it changes.
- `confirm({id,value,connectionId,stageRevision,sequence})`: accepts only valid explicit values for the current context and newer per-parameter sequence numbers; returns false for stale context/order. Values outside domain/non-finite are rejected, not silently clamped. Knob confirmations retain actual precision instead of UI-step rounding; switches/selectors require integers.
- `getConfirmed(id)`: null until a valid explicit confirmation; otherwise a frozen record `{id,value,connectionId,stageRevision,sequence}`.
- `subscribeConfirmed(listener)`: separate `parameter-confirmed` / `confirmations-invalidated` events; returns cleanup.

Confirmation never rewrites a requested value and never emits a request. A request does not erase a previous observation: compare the two explicitly; an observation is not necessarily an acknowledgement of the latest individual request. Reset controls does not reset DSP or fabricate a new confirmation. Reload resets this in-memory session.

`main.js` prepares subscriptions from adapter status/stage-requested/parameter-confirmed events into the confirmation context/store. It still does not call connect; all confirmations remain absent in this phase. Readouts are explicitly REQUESTED UI VALUES. A real RNBO mapping, initial hydration and policy for exposing confirmed readouts remain future work.

## Isolated subscriptions

`core/subscriptions.js` validates callable listeners and returns idempotent unsubscribe functions. A snapshot of the listener set is notified synchronously; listeners removed before their turn are skipped, and additions wait for the next emission. Notifications are shallow-frozen. Synchronous exceptions and rejected returned promises are isolated and reported to the optional `onDiagnostic({error,phase})` observer. Failure of that observer is itself isolated; no recursive error-event loop occurs. Listeners cannot roll back store mutations or connection transitions by throwing. This is callback error containment, not protection from malicious or nonterminating listener code.

## RNBOAdapter: actual transport states and public API

Actual states: `unavailable`, `loading`, `ready`, `error`, `disposed`. **Ready means transport initialized only, never audio running, unmuted or safe.** No `ready-muted`, `running` or `suspended` audio state is declared by this implementation.

| API | Contract |
|---|---|
| `new RNBOAdapter({onDiagnostic}={})` | Isolated diagnostics; no engine/context creation. |
| `status` | Transport state only. |
| `connectionId` | Current attempt's identity or null; during dispose it can remain present until draining ends, while status is already terminal. |
| `connect(port)` | Requires own project port contractVersion 2. Resolves undefined after initialization and subscriptions, or rejects with original error. Rejects duplicate/concurrent connects and connects during cleanup. Retry allowed after failed connection fully retires, never after disposal. |
| `setStage(id,snapshot)` | Validate and copy the complete stage snapshot before enqueueing. Returns false offline/loading/error; otherwise FIFO operation, resolving true only for completed transport. Missing own fields rejected; extras ignored. |
| `setParameter(id,value)` | Own-ID validation, finite clamping/quantization, FIFO transport. Does not confirm a value. Valid registry IDs are not restricted to the selected stage; the concrete port must validate actual mappings. |
| `command(name,value?)` | FIFO: start/panic have no payload, mute requires boolean, masterLevel finite 0…1. No actual audio action exists. |
| `subscribe(listener)` | Isolated listener; cleanup function. Rejects registrations after disposal. |
| `dispose()` | Immediate terminal invalidation, cached shared Promise, cooperative abort, drain and cleanup. Repeated calls return the exact same promise, including its failure. |

Valid offline requests return false and are not queued. Invalid IDs/values reject even offline. After disposal valid operations reject; nothing is sent. No automatic reconnect or requested-state replay is implemented.

## Engine-neutral port v2 — preparatory, not RNBO's API

```
contractVersion: 2
initialize({ connectionId, signal })
setStage(stageId, frozenSnapshot, context)
setParameter(uiId, declaredValue, context)
command(name, valueOrUndefined, context)
subscribeTelemetry(callback) -> cleanup function
subscribeParameterChanges(callback) -> cleanup function  // optional capability
dispose()
```

Methods are awaited; subscription setup is synchronous, cleanup may return a promise. A port owns resources as soon as initialize is accepted and must release even partially initialized resources in dispose. It must honor initialization abort or eventually settle. Optional parameter subscription is not simulated when absent. v1 is rejected to avoid silently losing the new provenance/order semantics.

Operation context is frozen `{connectionId,stageRevision,requestId}`. Each new stage request increments stageRevision immediately, invalidating prior observations; requestId increases per accepted FIFO operation. These are project IDs, not RNBO parameter IDs or a DSP clock.

Port confirmation callback:

```
{ id: uiId, value: actualDeclaredValue, stageRevision, sequence }
```

The facade accepts confirmations only from the current live connection, current requested stage revision and selected stage's parameters. sequence is a safe nonnegative integer increasing per parameter within a revision. Invalid confirmations go to diagnostics; duplicates/old sequences and old revisions/connections are ignored. No successful Promise manufactures a confirmation.

Port telemetry callback envelope:

```
{ stageRevision, payload }
```

Only current ready connection/revision is forwarded; payload is still opaque. This is provenance gating, not implementation/validation of the five proposed scientific streams in `phase-1-contract-audit.md`.

Adapter events:

- `{type:'status',status,connectionId,stageRevision}`. Error status also carries original `error` and frozen `cleanupErrors`.
- `{type:'stage-requested',stageId,connectionId,stageRevision,requestId}`; not a stage-activated acknowledgement.
- `{type:'parameter-confirmed',id,value,connectionId,stageRevision,sequence}`.
- `{type:'telemetry',connectionId,stageRevision,payload}`.

## Ordering, rollback and disposal

1. Stage/parameter/command operations are accepted in call order in a per-connection FIFO. A later operation is not started until the preceding promise settles. Stage snapshots are captured at call time; input-object mutation cannot corrupt queued values. Reentrant stage-requested listeners cannot jump ahead of the request they observe.
2. Rapid stage changes all run in FIFO order; there is no coalescing. Their observations are accepted only for the latest requested revision. Transport completion is distinct from DSP application timing; no sample-accurate schedule exists yet.
3. A port operation failure closes the connection, aborts its signal, rolls back subscriptions and disposes the port. It rejects with the original error; queued work is cancelled with AbortError. Retry is allowed only after cleanup. Late callbacks from retired connections cannot affect a retry.
4. Dispose marks disposed synchronously, invalidates callback gates and aborts initialization. Work not yet started is cancelled with AbortError; an already invoked port operation cannot be undone, so its eventual successful result is suppressed as AbortError. Cleanup waits until initialization and in-flight work settle, avoiding concurrent port.dispose/set operations.
5. Cleanup runs all acquired unsubscribe functions in reverse order, then always attempts port.dispose via finally, once per connection. Cleanup failures are collected and diagnosed. Failed connect/write preserves the original exception. Explicit disposal rejects AggregateError for its cleanup failures; logical state is still disposed and references clear.
6. Disposal requested by a loading/ready subscriber cannot resurrect a connection. Failed subscription setup undoes earlier registrations. Subscription implementations must clean up their own partial registrations if they throw before returning a handle.

Limit: AbortSignal is cooperative. A port whose initialize or operation never settles can keep drain/dispose pending. No timeout is claimed. A real port needs abort/deadline/processor-termination design and tests before audio; forced racing of dispose against active port calls would break this ordering guarantee.

## Future audio supervisor — documented only

| Future state | Intended meaning |
|---|---|
| unavailable | No usable engine/capability. |
| loading | Loading/validating actual runtime/export. |
| ready-muted | Actual engine initialized with verified silent output. |
| running | Actual context/engine processing under verified output policy. |
| suspended | Actual context suspension acknowledged. |
| error | Failure with independently enforced silent output. |
| disposed | Terminal resource teardown. |

The facade's transport states must not be treated as this audio state machine. Global audio controls remain natively disabled. `command('panic')` currently follows the FIFO, has no priority bypass and is not an audio safety guarantee. Before audio, implement an independent host silence path, gain limits/smoothing, startup gesture, mute/panic semantics, DSP failure response, processor cancellation and real context lifecycle.

`resetDSPState` remains an independent future operation, not an accepted command today. Its phases/register/filter/PRNG reset and seed policy require model approval. No topology, DSP/filter or scientific result was implemented here. `0A.rate` now has an approved intended meaning, but remaining stage definitions/mappings and scientific telemetry still require review.

## Verification and review boundary

Run `npm test`, `npm run check`, `git diff --check`; serve via `npm run serve` for browser checks. Tests use fake transport ports only and cover inherited IDs, non-finite values, listener failures, rollback/release failures, FIFO, reentrancy, late callbacks, fast stages, explicit confirmations and unchanged controls. They do not validate RNBO interoperability, DSP behavior, audio safety or real device resource release.

See `phase-1-hardening-report.md` for results and outstanding work. `phase-1-contract-audit.md` is retained as the historical Phase 1.1 audit; its defect/API descriptions describe the pre-hardening code. No commit, push, deployment or RNBO installation is authorized by completion of hardening.
