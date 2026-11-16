# Why AudioWorklet? — draft for the theory section

**Status:** draft for the web app's theory section, not yet published. The Spanish working note, with sources and verification, lives in the TrotzVault note *🤖 Taller ACMC 2026 — por qué AudioWorklet y no RNBO*.

> Prototyped in gen~/RNBO; delivered as a readable, standards-only AudioWorklet so that participants can inspect, modify and preserve the instrument, and so that internal state can be visualised at audio rate.

## From prototype to publication

The instruments in this workshop were first sketched in Cycling '74 gen~ and exported to the browser with RNBO: a 2024 web chaosynth and a 2026 Blippoo-style patch with two oscillators, two Runglers, a comparator with sample & hold, and a resonator. gen~ is an excellent sketching environment. For the workshop itself, the same architectures are rewritten as plain JavaScript running in an AudioWorklet.

## Nine reasons

1. **Preservation.** An RNBO export is tied to a specific version of a vendor runtime. An AudioWorklet depends only on the W3C Web Audio API. Preserving Hordijk's ideas also means keeping the tools that carry them alive.
2. **Code as workshop material.** Participants can open the source, change one line (enable the XOR, remove a `tanh`) and hear the result, without installing anything or owning a licence. Each block of the diagram maps onto a few readable lines.
3. **Internal state at audio rate.** The XY phase-space view and the register display need the bits, the DAC value and the phases at every sample. The worklet can send its full state to the page at the resolution the visualisation needs.
4. **One model for research and teaching.** The JavaScript follows the same structure as the Python research prototype, so the two can be checked against each other with the same seed. In this workshop it is a didactic model, not a research result.
5. **Numerical decisions in plain sight.** Every limiter, saturation, one-sample delay or clock-edge interpolation is written out and can be discussed, rather than hidden inside generated code.
6. **Testable without sound.** The DSP runs in Node: samples can be rendered and checked automatically (period, DAC histogram, absence of NaN).
7. **Robust in the classroom.** A few small script files, no WebAssembly compilation and no runtime download. The whole lab fits in a zip for offline use.
8. **Consistent with *Resistance Music*.** The tool itself does not depend on a platform.
9. **A historical echo** *(to be confirmed in the sources before publication).* Hordijk explored ideas on the Nord Modular / G2 before moving them to another medium: sketch in a closed environment, publish in an open one.

## Not claimed

- That the AudioWorklet runs faster than the RNBO export. This will only be stated once both versions of the same Rungler have been measured in the same browser (CPU per render quantum, download size, load time).
- That anything here is impossible in gen~ or RNBO.
- Any licensing obstacle. RNBO-generated code is dual-licensed and may be published. The point is readability, not permission.
