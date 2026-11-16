# Phase 1 technical report — 2026-10-27

## Delivery state

Local implementation only. No commit, push or deployment was performed. HEAD remains `bc15ecaeb50a831f3aa2756124d44720d77b4efd`; the public site remains unchanged. Preview: http://127.0.0.1:8766/lab/ (start with `npm run serve` if needed).

## Implemented

- Independent `/lab/` document, six navigable stages and deep links, per-stage in-memory values and current-stage reset.
- Reusable Knob (SVG dial and native slider), Toggle, Select, NumericDisplay and four Canvas 2D classes: Oscilloscope, CVMonitor, SpectrumAnalyzer, XYPlot.
- Declarative, immutable schema with 27 provisional stage-qualified parameter IDs, ranges, units, defaults, steps and linear/log scaling.
- ParameterStore with validation, snapshots, reset and unsubscribe lifecycle.
- RNBOAdapter with an injected engine-neutral v1 port, disconnected behavior, validation, initialization failure handling and cleanup. No real RNBO runtime or export.
- Optional simulated graphics, off by default, clearly identified as illustrative and without audio or measurements. No Rungler/noise/filter/comparator DSP algorithms.
- Disabled START AUDIO, MUTE, MASTER LEVEL and PANIC controls with explanations.
- Monochrome palette and local Orbitron headings; system text for readable explanatory content. No external fonts/CDN, runtime packages or build step.
- Project-wide AGENTS.md including the requested educational/topological scope verbatim. Detailed UI/engine contract in architecture.md.

## Files

Modified:
- `index.html`: one additional link to `./lab/`; no other landing-page changes.
- `README.md`: current status, local usage, structure and review/publication boundary.

New:
- `AGENTS.md`, `package.json`.
- `lab/index.html`, `lab/lab.css`.
- `lab/js/main.js`.
- `lab/js/core/parameters.js`, `store.js`, `graphic-demo.js`.
- `lab/js/components/controls.js`, `plots.js`.
- `lab/js/adapters/rnbo-adapter.js`.
- `tests/parameters.test.js`, `tests/adapter.test.js`.
- `tools/check.mjs`, `tools/serve.mjs`.
- `docs/architecture.md`, `docs/phase-1-report.md`.

No existing landing CSS, capability checker, font, .nojekyll or Pages configuration was changed. No dependency install or lockfile was required.

## Checks performed

| Check | Result |
|---|---|
| `npm test` | 8/8 tests pass |
| `npm run check` | Syntax passes for 12 JS scripts/modules |
| `git diff --check` | Pass |
| Local HTTP resource check | 14 resources HTTP 200, bytes identical to disk; `/lab/` directory route HTTP 200 |
| Chrome navigation | All six stage links render the correct control surface |
| State | Changed knob/switch and selector values survive stage changes; Reset restores current-stage defaults |
| Keyboard | Home/End, ArrowRight on logarithmic range including minimum; Space on switch; native select interaction |
| Mouse | Native slider drag changes readout; direct SVG dial drag changes readout (0.1 → 10.7 Hz), subsequent ArrowRight changes it again (11.8 Hz) |
| Graphic demo | On/off status and all four drawing views verified; every view explicitly marked simulated |
| Audio controls | All four controls are natively disabled; no audio engine/context/runtime instantiated |
| Responsive | Desktop layout and 390×844 viewport inspected; all six stages without horizontal overflow |
| Console | No application errors; unrelated Zotero extension connection errors observed (`chrome-extension://…`) |
| Visual QA | Control surface, signal-boundary diagram and four illustrative canvases inspected; desktop/mobile captures retained outside the Git checkout |

## Limitations and explicit deferrals

- Touch uses Pointer Events with capture/cancellation for dials and native range/select/switch controls; 44px targets and mobile layout checked. Physical touch hardware was not available for validation. Safari/Firefox, assistive technology and real mobile browsers remain to be tested.
- Reduced-motion and hidden-page behavior are implemented by scheduler gating; OS preference toggling and background timing were not instrumented in this pass.
- Values persist only during the current page session. There is no preset/import/export format or storage migration.
- Parameter definitions and RNBO mappings require architectural review; values are proposals, not hardware claims.
- No engine port, RNBO export, WASM, real telemetry, audio startup, latency/CPU measurements or DSP validation exists. Adapter `ready` would mean initialized, not audible or safe.
- The future audio lifecycle must define stage-switch scheduling, command ordering/coalescing, gain limits, mute, panic and error recovery before enabling global controls.
- No claim is made about circuit fidelity, chaotic behavior, spectra, phase spaces or university-network access.

## Proposed next step

User and ChatGPT review the UI, provisional controls, stable ID registry and engine-port contract. After approval, first implement and test one concrete RNBO engine port using an inspected export and a reviewed mapping/telemetry schema. Enable audio only after startup, initial silence, gain/mute/panic and teardown are validated. Publishing/committing this phase requires explicit review authorization.
