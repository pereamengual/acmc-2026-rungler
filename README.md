# The Rungler — ACMC 2026 Workshop

A public workshop preview and a separate laboratory (`/lab/`) inspired by Rob Hordijk's instrument architectures.

**Status (Phase 2, work in progress):** the landing page is a static preview. `/lab/` runs a plain-JavaScript AudioWorklet engine with six stages of growing complexity — 0a continuous noise, 0b clocked sample & hold, 1 the core Rungler (three steps), 2 PWM by comparator, 3 exciter and Twin Peak, 4 Blippoo Box architecture (three steps) — with live monitors, block diagrams and chaos/entropy indicators. These are didactic functional models of the block diagrams, not circuit emulations or hardware measurements. No RNBO export is used.

## Addresses

- Published landing page: https://pereamengual.github.io/acmc-2026-rungler/
- Repository: https://github.com/pereamengual/acmc-2026-rungler
- Local lab: http://127.0.0.1:8766/lab/
- Lab address once merged into `main`: https://pereamengual.github.io/acmc-2026-rungler/lab/

Phase 2 is developed on its own branch; GitHub Pages publishes the root of `main` (with `.nojekyll`), so the lab goes public only when that branch is merged.

## Local development and checks

Requires Node ≥20 for development only; no dependencies to install.

```sh
npm run serve
npm test
npm run check
```

Open the local lab URL and press START AUDIO (start with the level low; headphones recommended). Switch stages with the six tabs. Knobs work with mouse/touch (Shift for fine steps) or keyboard; double-click restores a knob's default. Knob values are kept in this browser between visits (never the master level); Reset stage restores the current stage.

## Structure

- `index.html`, `styles.css`, `app.js`: existing workshop preview and browser capability checker; only a lab link was added to the landing page.
- `fonts/`: local Orbitron font and SIL Open Font License (`OFL.txt`).
- `lab/`: independent semantic document, monochrome styles and native ES modules.
- `lab/js/dsp/`: the AudioWorklet engine — `modules/` (oscillator, shift register, DACs, comparator, filters, Rungler, Blippoo core…) and `patches/` (one file per stage).
- `lab/js/analysis/`: entropy/complexity, register period, event map and twin divergence.
- `lab/js/components/`: controls, monitors, indicators and block diagrams.
- `lab/js/core/`: declarative parameter registry, parameter store, conditions and saved settings.
- `lab/js/adapters/`: offline RNBO facade and future engine-port boundary.
- `tests/`: dependency-free Node tests.
- `tools/`: syntax checker and loopback-only preview server.
- `AGENTS.md`: project architecture, scientific scope and verification rules.
- [docs/architecture.md](docs/architecture.md): baseline, decisions, UI/engine contract and integration limits.

No CDN, external UI library, build system or runtime package is used. Access from University of Queensland networks still requires independent confirmation. Testing so far has used a Chromium-based browser; Firefox and Safari are still to be checked.
