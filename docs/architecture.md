# Architecture — the Rungler Lab (phase 2)

A browser lab for the ACMC 2026 workshop *From Noise to Chaos*: six stages of growing complexity, from noise to the Blippoo Box, played live with an AudioWorklet engine written in plain JavaScript. No framework, no dependency, no build step for the site.

The phase-1 interface architecture (RNBO adapter, simulated graphics, reports) is kept for reference in `archive/phase-1/`.

## The pages

| Page | What it is |
|:--|:--|
| `index.html` (+ `styles.css`, `app.js`) | Landing page in the order of use: 1 check the browser (capabilities + a soft test tone), 2 about the workshop (approach, the six stages, why an AudioWorklet, credits), 3 open the lab. |
| `lab/index.html` (+ `lab/lab.css`, `lab/js/`) | The laboratory. |

Both share the light/dark choice (`localStorage` key `rungler-theme`) and follow the system setting when nothing is saved.

## Data flow

```
 knobs, switches ──▶ ParameterStore ──▶ main.js ──▶ AudioOutput ──postMessage──▶ AudioWorklet
 (components/)       (core/store.js)    (page)      (audio/)                      (dsp/processor.js)
                                                                                        │
                                                                                   LabEngine
                                                                                   (dsp/lab-engine.js)
                                                                                        │
 monitors, indicators ◀── monitor frames (~30 per second, transferable buffers) ◀──────┘
```

- **Page → worklet:** `{type:'stage', stage, parameters}`, `{type:'parameter', id, value, glide}`, `{type:'monitors', enabled}`, `{type:'reset'}`, `{type:'dispose'}`.
- **Worklet → page:** monitor frames (`xy`, `cv`, `events`, `patterns`, `analysis`, `slowCV`, `clocks`, `clocksB`, `register`, `registerB`) and `{type:'fault'}` when a value became invalid and the engine restarted.
- **Audio chain:** worklet output 1 (after a DC blocker) → limiter → master level → headphones. Output 2 (the patch before the DC blocker) → analyser for the oscilloscope and spectrum.

## The engine (`lab/js/dsp/`)

`LabEngine` holds one patch per stage, glides knobs over ~20 ms, protects the output (DC blocker, invalid values → silence and restart) and collects what the monitors need. It has no Web Audio code, so it also runs in Node.

| Patch (`patches/`) | Stage |
|:--|:--|
| `stage-0a-noise.js` | 0a · noise source / filtered noise / noise → voice pitch |
| `stage-0b-sample-hold.js` | 0b · clocked sample & hold, quantizer |
| `stage-1-rungler.js` | 1 · register → XOR loop → feedback (three steps) |
| `stage-2-pwm.js` | 2 · comparator PWM |
| `stage-3-twin-peak.js` | 3 · comparator pulse → Twin Peak |
| `stage-4-blippoo.js` | 4 · two crossed Runglers → S&H → spread peaks (three steps) |

Modules (`modules/`): oscillator, noise, one-pole low-pass, sample & hold, shift register, DACs (4–2–1 and the Blippoo's 1–2–1), comparator, quantizer, DC blocker, the Rungler (stages 1–3), the Blippoo core (stage 4), the 3-pole resonant low-pass and the Twin Peak (fixed resonance 0.91, self-modulation from the second pole, exciter level 0.04, as in Hordijk 2009). Each file starts with an ASCII diagram.

## The page (`lab/js/`)

- `core/parameters.js` — declarative registry: stages, controls, units, ranges, `when` (visible only in some steps or modes), `group` (titled boxes such as *Sine Oscillator* or *Rungler Destinations*). Values are stored in physical units; components normalize at their boundary.
- `core/store.js`, `core/subscriptions.js` — the parameter store and isolated listeners. The store still carries a request/confirmation API from phase 1 (`setConfirmationContext`, `confirm`, `getConfirmed`); the lab does not use it.
- `core/conditions.js` — the small condition language (`{id, in}`, `{id, above}`, lists, `{any}`) used by `when` and by diagram parts (`active`, `shown`).
- `core/saved-settings.js` — knob values kept in this browser (`rungler-lab-settings-v2`); the master level and 0a's Listen are never kept.
- `notes.js` — what each stage and step shows (monitors, indicators, labels) and the "How to read this stage" notes.
- `diagrams.js` + `components/block-diagram.js` — block diagrams drawn from plain descriptions; each block links to its module; parts are faint when inactive and hidden before their step.
- `components/` — controls (knobs, switches, selectors, clock LEDs), monitors, the entropy & complexity indicators, theme.
- `analysis/` — permutation entropy and complexity, register period, the clock-by-clock event map of the Rungler, twin divergence. Stages 1 and 2 compute their indicators ahead from the Rungler state; the others measure the running engine.

## Offline build and mirrors

- `tools/build-offline.mjs <folder>` writes `offline.html` (landing page) and `lab/offline.html` (the whole lab: modules joined into one script, CSS and font inlined, the AudioWorklet engine passed as a `data:` URL). Both open with a double click, without network or server.
- Published copies: GitHub Pages (`main`), the mirror at `pedrotrotz.com/rungler/`, and the workshop USB stick.

## Tests

`npm test` runs the Node tests: DSP modules and patches (rendered offline), analysis, parameters, notes and saved settings. `npm run check` checks the syntax of every script.
