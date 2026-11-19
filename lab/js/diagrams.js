// BLOCK DIAGRAMS OF EACH STAGE (drawn by components/block-diagram.js)
//
// Each block names a module and links to its code (paths are relative to lab/js/dsp/).
// Each wire lists the corners it passes through, left to right or as routed by hand:
//   audio = solid   ·   cv = dashed   ·   logic (clock, bits) = dotted
// Blocks are 136 × 40 unless a size is given. `active` (see components/block-diagram.js)
// draws a part faint while it does nothing: a switch off, a selector elsewhere, an amount at 0.

// Stage 1 is built in three steps (selector `1.step`): what each part needs to be active.
const FEEDBACK = { id: '1.step', in: [2] };
const XOR_ON = [{ id: '1.step', in: [1, 2] }, { id: '1.xor', in: [1] }];
// Stage 4 is built in three steps (selector `4.step`): the S&H arrives in step 2.
const SH_ON = { id: '4.step', in: [1, 2] };

export const DIAGRAMS = {
  '0A': {
    width: 920, height: 178,
    description: 'The Listen selector sends to the output, from top to bottom: the noise source itself; the noise through an audio-rate low-pass (cutoff = bandwidth × 100); or a sine voice whose pitch follows the noise through a sub-audio low-pass (a control voltage).',
    blocks: [
      { id: 'noise', label: 'NOISE', file: 'modules/noise.js', x: 20, y: 60, h: 102 },
      { id: 'audioLowpass', label: 'LOW-PASS (audio)', file: 'modules/lowpass.js', x: 440, y: 60, active: { id: '0A.listen', in: [1] } },
      { id: 'lowpass', label: 'LOW-PASS FILTER', file: 'modules/lowpass.js', x: 230, y: 122, active: { id: '0A.listen', in: [2] } },
      { id: 'voice', label: 'SINE VOICE', file: 'modules/oscillator.js', x: 440, y: 122, active: { id: '0A.listen', in: [2] } },
      { id: 'out', label: 'OUTPUT', file: 'lab-engine.js', x: 760, y: 60, h: 102 }
    ],
    wires: [
      { type: 'audio', points: [[88, 60], [88, 26], [828, 26], [828, 60]], label: 'Listen: noise source', at: [458, 19], active: { id: '0A.listen', in: [0] } },
      { type: 'audio', points: [[156, 80], [440, 80]], active: { id: '0A.listen', in: [1] } },
      { type: 'audio', points: [[576, 80], [760, 80]], label: 'Listen: filtered noise', at: [668, 73], active: { id: '0A.listen', in: [1] } },
      { type: 'audio', points: [[156, 142], [230, 142]], active: { id: '0A.listen', in: [2] } },
      { type: 'cv', points: [[366, 142], [440, 142]], label: 'pitch CV', at: [403, 135], active: [{ id: '0A.listen', in: [2] }, { id: '0A.depth', above: 0 }] },
      { type: 'audio', points: [[576, 142], [760, 142]], label: 'Listen: noise → voice pitch', at: [668, 135], active: { id: '0A.listen', in: [2] } }
    ]
  },

  '0B': {
    width: 920, height: 172,
    description: 'A clock triggers a sample and hold on noise; the held value, optionally quantized to a scale, sets the pitch of a sine voice.',
    blocks: [
      { id: 'noise', label: 'NOISE', file: 'modules/noise.js', x: 20, y: 30 },
      { id: 'clock', label: 'CLOCK', file: 'modules/oscillator.js', x: 20, y: 110 },
      { id: 'sh', label: 'SAMPLE & HOLD', file: 'modules/sample-and-hold.js', x: 210, y: 30 },
      { id: 'quantizer', label: 'QUANTIZER', file: 'modules/quantizer.js', x: 400, y: 30, active: { id: '0B.quantize', in: [1] } },
      { id: 'voice', label: 'SINE VOICE', file: 'modules/oscillator.js', x: 590, y: 30 },
      { id: 'out', label: 'OUTPUT', file: 'lab-engine.js', x: 780, y: 30 }
    ],
    wires: [
      { type: 'audio', points: [[156, 50], [210, 50]] },
      { type: 'logic', points: [[156, 130], [278, 130], [278, 70]], label: 'trigger', at: [217, 123] },
      { type: 'cv', points: [[346, 50], [400, 50]], label: 'held', at: [373, 43] },
      { type: 'cv', points: [[536, 50], [590, 50]], label: 'pitch', at: [563, 43] },
      { type: 'audio', points: [[726, 50], [780, 50]] }
    ]
  },

  // Stages 1–3 share one compact grid, after Pere's block diagram of the Blippoo Box: OSC1
  // (DATA) above the Rungler row, OSC2 (CLOCK) below it; the Rungler CV reaches OSC1 from above
  // and OSC2 from below. The Rungler is wired like Rungler B of stage 4 (clock from the
  // oscillator below, data from the one above). From stage 2 the comparator sits in the row of
  // OSC1: OSC1 triangle enters it from the left, OSC2 triangle from below.
  '1': {
    width: 1080, height: 226,
    description: 'Step 1: OSC1 (DATA) square enters an 8-bit shift register clocked by OSC2 (CLOCK); cells 6 to 8 feed a 3-bit DAC whose CV, through a quantizer, sets the pitch of a sine voice. Step 2 adds XOR with the last bit. Step 3 feeds the Rungler CV back to both oscillators.',
    blocks: [
      { id: 'osc1', label: 'OSC1 (DATA)', file: 'modules/oscillator.js', x: 40, y: 60 },
      { id: 'xor', label: 'XOR', file: 'modules/rungler.js', x: 270, y: 60, w: 80, active: XOR_ON },
      { id: 'register', label: '8-BIT REGISTER', file: 'modules/shift-register.js', x: 380, y: 60, w: 120 },
      { id: 'dac', label: '3-BIT DAC', file: 'modules/dac.js', x: 560, y: 60, w: 96 },
      { id: 'quantizer', label: 'QUANTIZER', file: 'modules/quantizer.js', x: 710, y: 60, w: 120, active: { id: '1.quantize', in: [1] } },
      { id: 'voice', label: 'SINE VOICE', file: 'modules/oscillator.js', x: 890, y: 60, w: 120 },
      { id: 'osc2', label: 'OSC2 (CLOCK)', file: 'modules/oscillator.js', x: 40, y: 140 }
    ],
    wires: [
      { type: 'logic', points: [[176, 80], [270, 80]], label: 'square (data)', at: [223, 73] },
      { type: 'logic', points: [[350, 80], [380, 80]] },
      { type: 'logic', points: [[470, 60], [470, 40], [310, 40], [310, 60]], label: 'last bit', at: [390, 36], active: XOR_ON },
      { type: 'logic', points: [[500, 80], [560, 80]], label: 'cells 6–8', at: [530, 73] },
      { type: 'logic', points: [[176, 160], [440, 160], [440, 100]], label: 'clock', at: [300, 154] },
      { type: 'cv', points: [[656, 80], [710, 80]], label: 'CV', at: [683, 73] },
      { type: 'cv', points: [[830, 80], [890, 80]], label: 'pitch', at: [860, 73] },
      { type: 'audio', points: [[1010, 80], [1040, 80]] },
      { type: 'cv', points: [[584, 60], [584, 20], [120, 20], [120, 60]], label: 'Rungler CV → OSC1', at: [350, 14], active: [FEEDBACK, { id: '1.depth1', above: 0 }] },
      { type: 'cv', points: [[584, 100], [584, 200], [120, 200], [120, 180]], label: 'Rungler CV → OSC2', at: [350, 214], active: [FEEDBACK, { id: '1.depth2', above: 0 }] }
    ]
  },

  '2': {
    width: 1080, height: 270,
    description: 'The Rungler of stage 1, unchanged: OSC1 (DATA) square into the Rungler (XOR with the last bit, 8-bit register clocked by OSC2 (CLOCK), 3-bit DAC), whose CV can move both oscillators. The new part: both triangles go to a comparator, whose output is a pulse-width-modulated wave.',
    groups: [
      { label: 'RUNGLER', x: 258, y: 52, w: 412, h: 84 }
    ],
    blocks: [
      { id: 'osc1', label: 'OSC1 (DATA)', file: 'modules/oscillator.js', x: 40, y: 86 },
      { id: 'xor', label: 'XOR', file: 'modules/rungler.js', x: 270, y: 86, w: 80 },
      { id: 'register', label: '8-BIT REGISTER', file: 'modules/shift-register.js', x: 380, y: 86, w: 120 },
      { id: 'dac', label: '3-BIT DAC', file: 'modules/dac.js', x: 560, y: 86, w: 96 },
      { id: 'osc2', label: 'OSC2 (CLOCK)', file: 'modules/oscillator.js', x: 40, y: 166 },
      { id: 'comparator', label: 'COMPARATOR', file: 'modules/comparator.js', x: 730, y: 86 }
    ],
    wires: [
      { type: 'logic', points: [[176, 106], [270, 106]], label: 'square (data)', at: [217, 99] },
      { type: 'logic', points: [[350, 106], [380, 106]] },
      { type: 'logic', points: [[470, 86], [470, 68], [330, 68], [330, 86]], label: 'last bit', at: [400, 64] },
      { type: 'logic', points: [[500, 106], [560, 106]], label: 'cells 6–8', at: [530, 99] },
      { type: 'logic', points: [[176, 176], [440, 176], [440, 126]], label: 'clock', at: [300, 170] },
      { type: 'cv', points: [[584, 86], [584, 36], [120, 36], [120, 86]], label: 'Rungler CV → OSC1', at: [350, 30], active: { id: '2.depth1', above: 0 } },
      { type: 'cv', points: [[584, 126], [584, 226], [120, 226], [120, 206]], label: 'Rungler CV → OSC2', at: [350, 220], active: { id: '2.depth2', above: 0 } },
      // the triangles go round the feedback: OSC1's over the top, OSC2's underneath
      { type: 'audio', points: [[70, 86], [70, 14], [798, 14], [798, 86]], label: 'OSC1 triangle', at: [710, 28] },
      { type: 'audio', points: [[70, 206], [70, 246], [798, 246], [798, 126]], label: 'OSC2 triangle', at: [400, 260] },
      { type: 'audio', points: [[866, 106], [1010, 106]], label: 'pulse', at: [910, 99] }
    ]
  },

  '3': {
    width: 1080, height: 270,
    description: 'OSC1 (DATA) and OSC2 (CLOCK) drive the Rungler (XOR, register, DAC); its CV can move both oscillators. The two triangles feed a comparator whose pulse excites the Twin Peak: two resonant 3-pole low-pass filters whose outputs are subtracted.',
    blocks: [
      { id: 'osc1', label: 'OSC1 (DATA)', file: 'modules/oscillator.js', x: 40, y: 86 },
      { id: 'rungler', label: 'RUNGLER', file: 'modules/rungler.js', x: 380, y: 86 },
      { id: 'osc2', label: 'OSC2 (CLOCK)', file: 'modules/oscillator.js', x: 40, y: 166 },
      { id: 'comparator', label: 'COMPARATOR', file: 'modules/comparator.js', x: 600, y: 86 },
      { id: 'twinPeak', label: 'TWIN PEAK', file: 'modules/twin-peak.js', x: 820, y: 81, w: 150, h: 50 }
    ],
    wires: [
      { type: 'logic', points: [[176, 106], [380, 106]], label: 'square (data)', at: [278, 99] },
      { type: 'logic', points: [[176, 176], [420, 176], [420, 126]], label: 'clock', at: [300, 170] },
      { type: 'cv', points: [[490, 86], [490, 36], [120, 36], [120, 86]], label: 'Rungler CV → OSC1', at: [300, 30], active: { id: '3.depth1', above: 0 } },
      { type: 'cv', points: [[490, 126], [490, 226], [120, 226], [120, 206]], label: 'Rungler CV → OSC2', at: [300, 220], active: { id: '3.depth2', above: 0 } },
      // the triangles go round the feedback: OSC1's over the top, OSC2's underneath
      { type: 'audio', points: [[70, 86], [70, 14], [668, 14], [668, 86]], label: 'OSC1 triangle', at: [580, 28] },
      { type: 'audio', points: [[70, 206], [70, 246], [668, 246], [668, 126]], label: 'OSC2 triangle', at: [400, 260] },
      { type: 'audio', points: [[736, 106], [820, 106]], label: 'pulse', at: [778, 99] },
      { type: 'audio', points: [[970, 106], [1000, 106]] }
    ]
  },

  // Stage 4, after Pere's block diagram, as two mirrored halves: OSC A and Rungler A above,
  // OSC B and Rungler B below, each Rungler in a short loop to its own oscillator. The only
  // crossing in the core is the X of the data lines — the cross-coupling itself. Parts of the
  // S&H appear only from their step (`shown`).
  '4': {
    width: 1080, height: 400,
    description: 'Each oscillator clocks its own Rungler and gives its square as data to the other Rungler (the X). Each Rungler moves the rate of its own oscillator and one peak of the Twin Peak. The two triangles feed a comparator, whose pulse excites the Twin Peak and, from step 2, triggers a sample & hold on its rising edge. The S&H samples the sum of the Runglers (R Mix) or the OSC B triangle (Tri B); its voltage moves both rates and, in step 3, spreads the two peaks apart.',
    groups: [
      { label: 'CHAOTIC CORE', x: 6, y: 6, w: 724, h: 388 }
    ],
    junctions: [[206, 96], [206, 296]],
    blocks: [
      { id: 'oscA', label: 'OSC A', file: 'modules/oscillator.js', x: 40, y: 86 },
      { id: 'runglerA', label: 'RUNGLER A', file: 'modules/blippoo-core.js', x: 300, y: 86 },
      { id: 'sum', label: 'Σ', x: 300, y: 174, w: 24, h: 24, shown: SH_ON, active: { id: '4.shSource', in: [0] } },
      { id: 'sh', label: 'S&H', file: 'modules/sample-and-hold.js', x: 370, y: 166, shown: SH_ON },
      { id: 'comparator', label: 'COMPARATOR', file: 'modules/comparator.js', x: 580, y: 166 },
      { id: 'runglerB', label: 'RUNGLER B', file: 'modules/blippoo-core.js', x: 300, y: 266 },
      { id: 'oscB', label: 'OSC B', file: 'modules/oscillator.js', x: 40, y: 266 },
      { id: 'twinPeak', label: 'TWIN PEAK', file: 'modules/twin-peak.js', x: 820, y: 161, w: 150, h: 50 }
    ],
    wires: [
      // each oscillator clocks its own Rungler and gives its square as data to the other: the X
      // One square leaves each oscillator and splits at the dot, so clock and data are seen to
      // be the same signal.
      { type: 'logic', points: [[176, 96], [300, 96]], label: 'clock', at: [250, 90] },
      { type: 'logic', points: [[176, 96], [206, 96], [272, 276], [300, 276]], label: 'data', at: [286, 270] },
      { type: 'logic', points: [[176, 296], [206, 296], [272, 116], [300, 116]], label: 'data', at: [286, 110] },
      { type: 'logic', points: [[176, 296], [300, 296]], label: 'clock', at: [250, 290] },
      // each Rungler moves its own oscillator (A from above, B from below)…
      { type: 'cv', points: [[400, 86], [400, 56], [120, 56], [120, 86]], label: 'Rungler A → Rate A', at: [260, 50], active: { id: '4.runglerToRateA', above: 0 } },
      { type: 'cv', points: [[400, 306], [400, 336], [120, 336], [120, 306]], label: 'Rungler B → Rate B', at: [260, 350], active: { id: '4.runglerToRateB', above: 0 } },
      // …and one peak
      { type: 'cv', points: [[436, 106], [895, 106], [895, 161]], label: 'Rungler A → Peak 1', at: [760, 99], active: { id: '4.runglerToPeak1', above: 0 } },
      { type: 'cv', points: [[436, 286], [930, 286], [930, 211]], label: 'Rungler B → Peak 2', at: [760, 279], active: { id: '4.runglerToPeak2', above: 0 } },
      // the triangles go round the outside to the comparator; its pulse excites the Twin Peak
      { type: 'audio', points: [[70, 86], [70, 30], [648, 30], [648, 166]], label: 'tri A', at: [540, 44] },
      { type: 'audio', points: [[70, 306], [70, 360], [648, 360], [648, 206]], label: 'tri B', at: [540, 354] },
      { type: 'audio', points: [[716, 186], [820, 186]], label: 'pulse', at: [768, 179] },
      { type: 'audio', points: [[970, 186], [1000, 186]] },
      // sample & hold (from step 2): R Mix (A + B) or Tri B, on the rising edge of the pulse
      { type: 'cv', points: [[312, 126], [312, 174]], shown: SH_ON, active: { id: '4.shSource', in: [0] } },
      { type: 'cv', points: [[312, 266], [312, 198]], shown: SH_ON, active: { id: '4.shSource', in: [0] } },
      { type: 'cv', points: [[324, 186], [370, 186]], label: 'R Mix', at: [347, 179], shown: SH_ON, active: { id: '4.shSource', in: [0] } },
      { type: 'audio', points: [[470, 360], [470, 206]], label: 'Tri B', at: [490, 320], shown: SH_ON, active: { id: '4.shSource', in: [1] } },
      { type: 'logic', points: [[580, 186], [506, 186]], label: 'rising edge', at: [543, 179], shown: SH_ON },
      // the S&H goes back to both rates round the bottom and left edges…
      { type: 'cv', points: [[450, 206], [450, 372], [16, 372], [16, 106], [40, 106]], label: 'S&H → Rate A / Rate B', at: [230, 386], shown: SH_ON, active: { id: '4.shToRateA', above: 0 } },
      { type: 'cv', points: [[450, 206], [450, 372], [16, 372], [16, 286], [40, 286]], shown: SH_ON, active: { id: '4.shToRateB', above: 0 } },
      // …and, in step 3, pushes the two peaks apart
      { type: 'cv', points: [[496, 206], [496, 246], [860, 246], [860, 211]], label: 'S&H spreads peaks', at: [760, 240], shown: { id: '4.step', in: [2] }, active: { id: '4.spread', above: 0 } }
    ]
  }
};
