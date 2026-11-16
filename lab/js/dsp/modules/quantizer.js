// SCALE QUANTIZER
//
// Takes any pitch offset (in semitones, fractions allowed) and moves it to the nearest note
// of a scale, in any octave. This is the "grid" that domesticates a random or chaotic voltage
// into conventional melody.
//
//   pitch offset ──▶ [ nearest scale degree ] ──▶ quantized pitch offset

// Each scale lists the semitones it allows within one octave (0 = the root).
// From the coarsest grid to the finest: octaves only, a major scale, every semitone.
export const SCALES = Object.freeze({
  octaves: Object.freeze([0]),
  major: Object.freeze([0, 2, 4, 5, 7, 9, 11]),
  naturalMinor: Object.freeze([0, 2, 3, 5, 7, 8, 10]),
  dorian: Object.freeze([0, 2, 3, 5, 7, 9, 10]),
  chromatic: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
});

// The choices offered by the Scale selector (stages 0b and 1), from the coarsest grid to the
// finest. The selector shows the names; the patches use the degrees.
export const SCALE_CHOICES = Object.freeze([
  Object.freeze({ name: 'Octaves', degrees: SCALES.octaves }),
  Object.freeze({ name: 'Major', degrees: SCALES.major }),
  Object.freeze({ name: 'Chromatic', degrees: SCALES.chromatic })
]);

// degrees: one of the SCALES above.
export function quantize(semitones, degrees = SCALES.major) {
  const octave = Math.floor(semitones / 12);
  const withinOctave = semitones - octave * 12;
  let nearest = 0;
  for (const degree of degrees) {
    if (Math.abs(withinOctave - degree) < Math.abs(withinOctave - nearest)) nearest = degree;
  }
  if (Math.abs(withinOctave - 12) < Math.abs(withinOctave - nearest)) nearest = 12; // root of the next octave
  return octave * 12 + nearest;
}
