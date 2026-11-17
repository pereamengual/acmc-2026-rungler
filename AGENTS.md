# ACMC 2026 Rungler — project rules

These rules apply to the entire repository.

The ACMC 2026 Rungler project is an educational and topological exploration of nonlinear electronic instrument architectures inspired by Rob Hordijk. It does not aim to provide circuit-level emulation or exact reproduction of physical hardware. DSP implementations must preserve the relevant functional relationships, feedback paths, state transitions, and control dependencies. Scientific claims about dynamical behavior must be distinguished from illustrative visualizations and supported by appropriate evidence.

## Architecture
- Use semantic HTML, modern CSS and native ES modules. No UI frameworks, CDN, external libraries or build step for the site.
- Preserve the monochrome pedrotrotz.com design, the locally bundled Orbitron font (titles and labels) and the system font for reading text; keep the light/dark switch working on both pages.
- The landing page reads in the order of use: 1 check the browser and headphones, 2 about the workshop and credits, 3 open the lab. `/lab/` stays a separate page.
- The audio engine is plain JavaScript in an AudioWorklet (`lab/js/dsp/`): one file per module, each with an ASCII diagram in its header, legible to someone who knows synthesis but little code. It has no Web Audio code of its own, so it also runs in Node for tests.
- Keep parameter definitions declarative (`lab/js/core/parameters.js`), IDs stable and values in physical/declared units in the store; normalize only at the component boundary. UI components depend on the store, never on DSP internals.
- Show only what applies: controls, monitors, indicator readings, notes and diagram parts that do nothing in the current stage or step are hidden (or drawn faint when they depend on a knob at 0). Each stage adds one new element at a time.
- Monitors show live engine data, never substituted demo data. Monitors may read the patch before the DC blocker; the headphones always get the protected signal.
- Audio safety: nothing sounds before START AUDIO; levels fade in and out; a limiter catches peaks; PANIC silences at once; the master level is never saved.
- Name the oscillators by their role: OSC1 (DATA), OSC2 (CLOCK); in stage 4, OSC A and OSC B each clock their own Rungler and give data to the other.
- Block diagrams: no overlapping text, and never remove a real connection to tidy a drawing.
- Indicators are didactic readings of the model. Do not claim chaos from them ("structured but not periodic" is the wording).
- Publish only block diagrams of our own. No schematics, component values, BOMs or netlists from Hordijk's archive.
- Use native form semantics, visible focus, keyboard alternatives and touch targets of at least 44 px where possible. Canvas needs a text alternative.
- Clean up subscriptions, animation frames and observers on teardown. Respect reduced motion.
- Keep relative URLs compatible with GitHub Pages project paths and with the `pedrotrotz.com/rungler/` mirror.

## Verification and delivery
- Run `npm test` (Node built-ins only), `npm run check` and `git diff --check`.
- Browser-check the landing page and the six stages (and the steps of stages 1 and 4): START AUDIO, monitors, diagram, Reset stage, saved settings, light/dark, console errors, keyboard and mobile layout.
- Document changes to the engine or the UI contract in `docs/architecture.md`.
- Do not publish secrets or private reference material; stage files explicitly.
- Commit and push only when the user asks. The site is published from `main` (GitHub Pages).
- After a change to `main`, refresh the two other copies when the user asks: the mirror at `pedrotrotz.com/rungler/` (from `git archive`, uploaded with the vault's `web-publicar` tool) and the USB stick (`node tools/build-offline.mjs <folder>` builds `offline.html` and `lab/offline.html`, which open without a server).
- Earlier phase-1 material (RNBO adapter, simulated graphics, reports) lives in `archive/phase-1/` for reference only.
