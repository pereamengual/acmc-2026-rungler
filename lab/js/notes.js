// WHAT EACH STAGE SHOWS, AND HOW TO READ IT
//
// The workshop climbs through models of growing complexity, so each stage — and each mode
// inside a stage — shows only what the concept being tried needs. Anything that does nothing
// there is hidden: controls (see `when` in core/parameters.js), monitors, indicator readings
// and the notes below.
//
//   monitors     which views are on screen: scope, spectrum, cv, xy, events, register
//   indicators   which readings: entropy, period, twin
//   modes        optional: different views for each value of one selector ({ by, 0: …, 1: … })
//   xy           optional: { axes: [x, y], style: 'dots' } for the XY monitor
//   eventLimit   optional: how many events the event map keeps (default 3000)
//   eventLabel   optional: what the event map's axes show, when it changes with the mode
//   cvLabel      optional: what the CV history shows, if not the default
//   freshWhen    optional: knobs that change the picture of the event map, so it starts again
//                when they move (switches and selectors always start it again; other knobs,
//                such as a clock rate, only change how fast the dots arrive, not where)
//   topics       { about, title, text }: a note appears only if what it is `about` is on
//                screen ('stage' = always; or a monitor / indicator key; `modes` limits it)

const ENTROPY = 'Every four consecutive values are reduced to their order (low, high, middle…): 24 possible orders. H = how evenly the orders are used (0 regular, 1 noise-like). C = high only for structure without repetition. On the plane: regular bottom left, noise bottom right; higher up in between, structured but not periodic. That region is compatible with chaos, but the indicator alone does not prove it.';

export const STAGE_NOTES = {
  '0A': {
    modes: {
      by: '0A.listen',
      0: { monitors: ['scope', 'spectrum', 'xy'], indicators: [],
        xy: { axes: ['noise now', 'one sample earlier'], style: 'dots' } },
      1: { monitors: ['scope', 'spectrum', 'xy'], indicators: [],
        xy: { axes: ['filtered noise now', 'one sample earlier'], style: 'dots' } },
      2: { monitors: ['scope', 'spectrum', 'cv', 'xy'], indicators: ['entropy'],
        xy: { axes: ['pitch CV now', '25 ms earlier (±1 = ±3 oct)'], style: 'dots' },
           cvLabel: 'Pitch CV sent to the voice · last 4 s · ±1 = ±3 octaves' }
    },
    topics: [
      { about: 'spectrum', modes: [0], title: 'Spectrum: white noise',
        text: 'Every frequency equally loud: the spectrum is roughly flat from 20 Hz to 20 kHz. This is the raw material of the whole workshop: no memory, no structure.' },
      { about: 'spectrum', modes: [1], title: 'Spectrum: what the filter does',
        text: 'The low-pass filter lets the low frequencies through and attenuates the rest: the spectrum falls above the cutoff. Turn the bandwidth knob and watch the bend move. Less bandwidth sounds darker and slower — and a slower noise is what the next mode uses as a control voltage.' },
      { about: 'xy', modes: [0], title: 'XY: each value against the one before',
        text: 'One dot per sample: x = the noise now, y = the noise one sample earlier. White noise fills the square: any value can follow any other. That is what "no memory" looks like.' },
      { about: 'xy', modes: [1], title: 'XY: the filter gives the noise a fading memory',
        text: 'Same view, after the filter. Each output value is a weighted average of the recent past, so it stays close to the one before and the dots gather around the diagonal (where "now" equals "a moment ago"). The filter remembers no particular value: it blends the recent past and gradually forgets it. Turn the bandwidth down and the band narrows towards a line: the slower the filter, the longer it takes to forget. A short memory is not a structure: in the long run the filtered noise is still unpredictable.' },
      { about: 'xy', modes: [2], title: 'XY: the control voltage, 25 ms apart',
        text: 'The pitch CV, as the oscillator receives it (after Pitch CV amount), against itself 25 ms earlier (one sample apart it would be a perfect line). Turn the amount down and the cloud shrinks towards the centre; at 0 it is a dot. Low bandwidth: a thin diagonal, the voltage barely moves in 25 ms. High bandwidth: the cloud opens towards the square of white noise. This is the first of three kinds of memory in the workshop: here a fading one (the filter blends the past); in stage 0b an exact memory of one value, held until the next clock and then dropped; in the Rungler (stage 1) an exact memory of eight bits that feeds back into the system.' },
      { about: 'cv', title: 'CV history',
        text: 'The last four seconds of the control voltage that moves the pitch, as the oscillator receives it: the filtered noise × Pitch CV amount (full height = ±3 octaves). The amount knob makes it wider or flatter; at 0 the line is flat and the pitch stays on the centre. The bandwidth is now far below hearing (0.05–30 Hz): the filtered noise is no longer a sound but a slow, wandering voltage.' },
      { about: 'entropy', title: 'Entropy and complexity',
        text: `${ENTROPY} Here the pitch CV sent to the voice (after Pitch CV amount) is read 32 times per bandwidth cycle and values half a cycle apart are compared. The point lands bottom right: this is the reference for "noise" in every later stage. With the amount at 0 the voice receives a steady voltage, a pure tone, and the point goes to the regular corner. It appears after a few seconds (100 windows of four values are needed).` }
    ]
  },

  '0B': {
    monitors: ['scope', 'spectrum', 'cv', 'events'],
    cvLabel: 'Pitch CV sent to the voice · last 4 s · ±1 = ±3 octaves',
    freshWhen: ['0B.depth'], // the amount sets how wide the picture is; clock and centre do not move the dots
    indicators: ['entropy'],
    topics: [
      { about: 'events', title: 'Event map: each held value against the next',
        text: 'One dot per clock: x = the pitch at step n, y = the pitch at step n + 1, both as the voice receives them, measured from the centre pitch (left and bottom edges: 3 octaves below it; right and top: 3 octaves above). Pitch CV amount sets how far the pitch can wander: at 3 octaves the dots reach the edges, at 1 they stay in the middle third, at 0 they collapse into the centre — a single note. Moving the centre transposes every note alike, so the dots stay where they are — like a melody played in another key keeps its shape. With the quantizer off, the dots fill the square evenly: each step is unrelated to the last. Switch the quantizer on and the dots snap to a grid — the same randomness, domesticated. Compare the three grids, from coarsest to finest: Octaves (only three pitches with an amount of one octave), Major (the seven notes of a scale), Chromatic (every semitone).' },
      { about: 'cv', title: 'CV history',
        text: 'The pitch staircase of the last four seconds, as the voice receives it: after Pitch CV amount and the quantizer (full height = ±3 octaves).' },
      { about: 'entropy', title: 'Entropy and complexity',
        text: `${ENTROPY} Here one held value per clock is used, so a faster clock fills it sooner (100 windows are needed). Expect the noise corner, bottom right.` }
    ]
  },

  '1': {
    cvLabel: 'Pitch CV sent to the voice · last 4 s · ±1 = ±3 octaves',
    freshWhen: ['1.range'], // the amount sets how wide the picture is
    modes: {
      by: '1.step',
      0: { monitors: ['scope', 'spectrum', 'cv', 'events', 'register'], indicators: ['entropy'] },
      1: { monitors: ['scope', 'spectrum', 'cv', 'events', 'register'], indicators: ['entropy', 'period'] },
      2: { monitors: ['scope', 'spectrum', 'cv', 'xy', 'events', 'register'], indicators: ['entropy', 'period', 'twin'] }
    },
    topics: [
      { about: 'stage', modes: [0], title: 'From 0b to the Rungler',
        text: 'Same chain as 0b — a clock, a memory, a quantizer, the same sine voice — but the noise is now the square wave of OSC1 (DATA), and the sample & hold is an 8-bit shift register clocked by OSC2 (CLOCK). At each clock the register stores one bit (is OSC1 high or low?) and shifts the others along; its last three bits, read by a 3-bit DAC, set the pitch. The memory is no longer one value: it is eight bits, of which you hear three.' },
      { about: 'cv', title: 'CV history',
        text: 'The pitch CV of the last four seconds, as the voice receives it: the Rungler CV × Pitch CV amount, then the quantizer (full height = ±3 octaves, as in 0a and 0b). At most eight levels, one per DAC value; at amount 0 the line is flat and the voice stays on the centre pitch.' },
      { about: 'events', modes: [0], title: 'Event map: compare with 0b',
        text: 'Each pitch against the next, as in 0b. There the dots filled the square evenly; here they sit on a grid of at most eight levels (the DAC), and only some jumps occur, chosen by the ratio between OSC1 and OSC2. Change one oscillator slowly and watch which jumps appear. The quantizer works exactly as in 0b.' },
      { about: 'register', title: 'Shift register',
        text: 'Cells 1 to 8. A new bit enters cell 1 at every clock; cells 6, 7 and 8 form the 3-bit DAC (weights 4, 2, 1), the pitch you hear.' },
      { about: 'period', modes: [1], title: 'Loop: the register reads itself',
        text: 'With XOR on, the new bit is OSC1\'s square XORed with the bit falling out of cell 8: the register now listens to its own past. Patterns appear and often repeat — the register period shows how many clocks a cycle lasts. Switch XOR off and on to compare.' },
      { about: 'twin', modes: [2], title: 'Feedback: the loop is closed',
        text: 'Now the Rungler CV also moves OSC1 (Rungler → OSC1) and OSC2 (Rungler → OSC2): the voltage made from the bits changes the oscillators that make the next bits. Raise the depths from 0 slowly: cycles stretch, break and the behaviour turns irregular — heard through the same voice.' },
      { about: 'xy', modes: [2], title: 'XY: OSC1 against OSC2',
        text: 'The two triangles against each other (a Lissajous figure). A simple frequency ratio draws a closed figure; with feedback the Rungler keeps changing both pitches, so the figure keeps reshaping itself.' },
      { about: 'entropy', title: 'Entropy and complexity',
        text: `${ENTROPY} Here the value is the voice pitch at each clock, as in 0b. It is computed instantly from the Rungler state: between two clock edges nothing changes but the phases, so the Rungler can be computed from edge to edge in one step, θ(n+1) = θ(n) + f1/f2 (mod 1), and the next 600 clocks take milliseconds.` },
      { about: 'period', title: 'Register period',
        text: 'The shortest number of clocks after which the bit sequence repeats exactly (at least three times). "None" means no repetition in the next 600 clocks.' },
      { about: 'twin', modes: [2], title: 'Twin divergence',
        text: 'A copy of the Rungler starts from the same state with OSC1 moved on by ε = 0.005 of a cycle. The value is how many clocks pass, typically (median of 31 starts), before their registers differ. Between clock edges the copies stay exactly ε apart; they only separate when one reads OSC1 on the other side of its square edge — which is why we count clocks instead of computing a Lyapunov exponent. Without feedback the twins never separate.' }
    ]
  },

  '2': {
    monitors: ['scope', 'spectrum', 'cv', 'xy', 'events', 'register'],
    eventLimit: 1000,
    indicators: ['entropy', 'period', 'twin'],
    topics: [
      { about: 'xy', title: 'XY: OSC1 against OSC2',
        text: 'The two triangles against each other, as in stage 1, step 3. The comparator reads this picture: the pulse is high whenever the trace is below the diagonal (OSC1 above OSC2). The more time the trace spends on one side, the wider the pulse.' },
      { about: 'events', title: 'Event map: OSC1 phase at clock n → n + 1',
        text: 'Where OSC1 (DATA) was at this clock edge (x) and at the next (y). With both depths at 0 the dots lie on one diagonal (it wraps around the edges, because the phase does): a plain rotation. With feedback they split into up to eight parallel diagonals, one per DAC value — the Rungler is a rotation that changes its step with its own output.' },
      { about: 'entropy', title: 'Entropy, period, twins',
        text: 'As in stage 1, step 3, computed instantly from the Rungler state — here the entropy reads the OSC1 phase at each clock edge. They describe the Rungler that draws the pulse, not the pulse itself.' }
    ]
  },

  '3': {
    monitors: ['scope', 'spectrum', 'cv', 'xy', 'events', 'register'],
    indicators: ['entropy'],
    topics: [
      { about: 'xy', title: 'XY: filter 1 against filter 2',
        text: 'The second-pole outputs of the two filters, shown ×30 (inside the filters the pings are small). Each ping draws a figure that shrinks towards the centre as it dies away; the self-modulation bends it.' },
      { about: 'events', title: 'Event map: peak-to-peak return map',
        text: 'Each peak of filter 1 (x) against the next peak (y). A ping that dies away draws a line of dots towards the bottom-left corner (each peak a little lower than the one before); a regular rhythm repeats the same line; an irregular one spreads it into a cloud.' },
      { about: 'register', title: 'Shift register and CV',
        text: 'The Rungler whose oscillators make the pulse that excites the filters.' },
      { about: 'entropy', title: 'Entropy and complexity',
        text: `${ENTROPY} Here the value is the amplitude of each peak of filter 1, collected live (100 windows are needed). Rungler → OSC1 and OSC2 at 0 keep it near the regular corner; raise them and watch it move.` }
    ]
  },

  '4': {
    modes: {
      by: '4.step',
      0: { monitors: ['scope', 'spectrum', 'cv', 'xy', 'events', 'register'], indicators: ['entropy'],
           eventLabel: 'Rungler A level at clock n → n+1 (five levels, 0 … 4)',
           cvLabel: 'Rungler A, before the destination knobs · last 4 s · −1 … +1' },
      1: { monitors: ['scope', 'spectrum', 'cv', 'xy', 'events', 'register'], indicators: ['entropy'],
           eventLabel: 'S&H value at trigger n → n+1 (−1 … +1)',
           cvLabel: 'S&H output, before the destination knobs · last 4 s · −1 … +1' },
      2: { monitors: ['scope', 'spectrum', 'cv', 'xy', 'events', 'register'], indicators: ['entropy'],
           eventLabel: 'S&H value at trigger n → n+1 (−1 … +1)',
           cvLabel: 'S&H output, before the destination knobs · last 4 s · −1 … +1' }
    },
    topics: [
      { about: 'stage', modes: [0], title: 'From stage 3 to the Blippoo Box: two Runglers',
        text: 'The resonator of stage 3 stays as it was. The core now has two Runglers, and the roles of the oscillators are crossed: OSC A clocks Rungler A and gives its square as data to Rungler B; OSC B clocks Rungler B and gives data to Rungler A. Each oscillator is the CLOCK of one Rungler and the DATA of the other. Each Rungler moves the rate of its own clock (Rungler A → Rate A, Rungler B → Rate B) and one peak of the resonator (A → Peak 1, B → Peak 2).' },
      { about: 'register', modes: [0, 1, 2], title: 'Two registers, a different DAC',
        text: 'Each register works as in stages 1–3 (8 bits, XOR of the new bit with cell 8), but its DAC weighs cells 6, 7 and 8 as 1, 2, 1 instead of 4, 2, 1. The eight patterns collapse into five levels, symmetric around 0 V; the three middle levels can each be reached in two ways, so the voltage spends most of its time near the centre (1/8, 2/8, 2/8, 2/8, 1/8 if all patterns were equally likely).' },
      { about: 'events', modes: [0], title: 'Event map: Rungler A, level n → n + 1',
        text: 'Rungler A at each of its clocks (x) against the next one (y). Five levels give a 5 × 5 grid, but not every jump is possible: the window moves one cell at a time, so from level 0 the next can only be 0 or 1, from 4 only 3 or 4. The empty squares are jumps the register cannot make.' },
      { about: 'xy', title: 'XY: OSC A against OSC B',
        text: 'The two triangles that the comparator compares, as in stage 2. Raise Rungler → Rate and the figure starts to reshape itself.' },
      { about: 'stage', modes: [1, 2], title: 'Sample & hold: the time-warp',
        text: 'At each rising edge of the comparator pulse, a sample & hold takes a snapshot — the same memory as in 0b, now clocked by the instrument itself. Its source is either the sum of the two Runglers (R Mix: nine levels, jagged and erratic) or the triangle of OSC B (Tri B: smoother, it breathes). S&H → Rate A / Rate B send the held voltage back to the oscillators: the tempo stretches and shrinks with each snapshot.' },
      { about: 'events', modes: [1, 2], title: 'Event map: S&H value n → n + 1',
        text: 'Each held value (x) against the next (y), as in stage 0b. With R Mix the dots fall on a grid of nine levels; with Tri B they spread along a curve, because the triangle is smooth.' },
      { about: 'stage', modes: [2], title: 'Spread peaks: the voice talks',
        text: 'The held voltage now also moves the two peaks of the resonator in opposite directions: one up, the other down. Each snapshot opens or closes the band between them — the formant changes, and the pings start to talk.' },
      { about: 'cv', title: 'CV history',
        text: 'Step 1: the voltage of Rungler A, five levels. From step 2: the S&H output, the voltage that warps both rates.' },
      { about: 'entropy', title: 'Entropy and complexity',
        text: `${ENTROPY} Here the values are those of the event map — Rungler A in step 1, the S&H from step 2 — collected live (100 windows are needed).` }
    ]
  }
};

// What is on screen for a stage, given the current value of its mode selector (if any).
export function stageView(stageId, valueOf) {
  const notes = STAGE_NOTES[stageId];
  const mode = notes.modes ? valueOf(notes.modes.by) : null;
  const view = notes.modes ? notes.modes[mode] : notes;
  const onScreen = new Set(['stage', ...view.monitors, ...view.indicators]);
  const topics = notes.topics.filter(topic => onScreen.has(topic.about) && (!topic.modes || topic.modes.includes(mode)));
  return {
    monitors: view.monitors, indicators: view.indicators, xy: view.xy ?? {}, topics,
    freshWhen: notes.freshWhen ?? [], eventLimit: view.eventLimit ?? notes.eventLimit ?? 3000,
    eventLabel: view.eventLabel, cvLabel: view.cvLabel ?? notes.cvLabel,
    dependsOn: notes.modes?.by ?? null
  };
}
