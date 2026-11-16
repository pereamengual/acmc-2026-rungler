# ACMC 2026 Rungler — project rules

These rules apply to the entire repository.

The ACMC 2026 Rungler project is an educational and topological exploration of nonlinear electronic instrument architectures inspired by Rob Hordijk. It does not aim to provide circuit-level emulation or exact reproduction of physical hardware. DSP implementations must preserve the relevant functional relationships, feedback paths, state transitions, and control dependencies. Scientific claims about dynamical behavior must be distinguished from illustrative visualizations and supported by appropriate evidence.

## Architecture
- Use semantic HTML, modern CSS and native ES modules. No UI frameworks, CDN or external UI libraries.
- Preserve the monochrome pedrotrotz.com design and the locally bundled Orbitron font.
- Keep `/lab/` separate from the landing page. Only add a lab link to the landing page unless explicitly authorized.
- Keep parameter definitions declarative, IDs stable and values in physical/declared units in the store; normalize only at the component boundary.
- UI components may depend on the parameter store contract, never RNBO or DSP internals.
- Isolate future `@rnbo/js` calls in an engine port behind `RNBOAdapter`; never import the runtime into components.
- Keep DSP outside the UI. No Rungler DSP, physical emulation or scientifically presented synthetic measurements in Phase 1.
- Every demo plot must say simulated, illustrative and no audio. Never silently substitute demo data for engine telemetry.
- Audio controls stay disabled until a real engine and its safety lifecycle are integrated and tested.
- Use native form semantics, visible focus, at least 44px touch targets and keyboard alternatives. Canvas needs a text alternative.
- Clean up subscriptions, animation frames and observers on teardown. Respect reduced motion and page visibility.
- Keep relative URLs compatible with GitHub Pages project paths. Do not change Pages configuration unnecessarily.

## Verification and delivery
- Run `npm test` (Node built-ins only), `npm run check` and `git diff --check`.
- Browser-check all six routes, parameter persistence, reset, demo on/off, disabled audio, console errors, keyboard and mobile layout.
- Check pointer/touch semantics; distinguish actual touch-device validation from emulated viewport or native-control inspection.
- Document changes to the UI/engine contract in `docs/architecture.md`; do not invent RNBO parameter mappings before inspecting an export.
- Do not publish secrets or private reference material; stage files explicitly.
- Do not commit, push or deploy Phase 1 until the user and ChatGPT have reviewed and authorized it.
