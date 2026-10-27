# The Rungler — ACMC 2026 Workshop

Public **placeholder / workshop preview** for an upcoming hands-on workshop on nonlinear modulation, feedback, and the instrument designs of Rob Hordijk.

**Status:** static preview only. It does **not** yet implement any sonic model, Rungler behavior, waveform display, CV visualization, or RNBO export. The on-page browser check inspects platform capabilities; it is not a test of workshop audio functionality.

## Intended public address

`https://pereamengual.github.io/acmc-2026-rungler/`

This address will only become available after the repository is created and GitHub Pages is enabled.

## Publish with GitHub Pages

1. Create a **public** GitHub repository named `acmc-2026-rungler` under `pereamengual`. Initialize it with **no** README or template files (the project already contains `README.md`).
2. Upload all files from this directory **at the root of the repository** (not in an enclosing `acmc-2026-rungler` subfolder). You can select the files in GitHub's **Add file → Upload files** page, or use GitHub Desktop.
3. In the repository, select **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
4. Choose **main** and **/(root)**, then **Save**.
5. Once deployment has completed, use the **Visit site** link under Settings → Pages and inspect the proposed URL.
6. Verify it from an independent connection (mobile data, a VPN exit location, and—ideally—a University of Queensland campus contact). Successful accessibility from one location does not guarantee campus access.

Reference: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Structure

- `index.html`: accessible English-language workshop landing page.
- `styles.css`: responsive monochrome design aligned with pedrotrotz.com, with locally hosted Orbitron typography and no CDNs, external libraries, or images.
- `app.js`: non-audio JavaScript browser capability check.
- `.nojekyll`: prevents processing this static site through Jekyll.

## Planned next phase — only after public accessibility is confirmed

Create a modular interface for stages 0A, 0B, 1, 2, 3, and 4 with accessible knobs/switches, CV displays, waveform views and phase-space views. Establish a common parameter and visualization schema and validate it with participants' browsers. The actual DSP will be authored in Max/gen~ and exported through RNBO/WebAssembly, with explicit verification of audio startup, browser platform support, CPU load, and latency.

Orbitron is bundled in `fonts/Orbitron.woff2` under the SIL Open Font License (see `fonts/OFL.txt`). No externally hosted scripts or fonts are required for this preview. The final WebAudio/RNBO version may have different requirements that must be tested separately.
