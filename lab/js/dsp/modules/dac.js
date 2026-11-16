// 3-BIT DAC (digital-to-analogue converter)
//
// Reads the last three cells of the shift register and turns them into one voltage with
// eight possible steps. Cell 6 counts most, cell 8 least (weights 4, 2, 1), as in the
// research prototype rungler_prototipo.py.
//
//   [6] ×4 ─┐
//   [7] ×2 ─┼─▶ sum ÷ 7 ──▶ Rungler CV (0 … 1, eight steps)
//   [8] ×1 ─┘

export class ThreeBitDAC {
  convert(register) {
    const sum = 4 * register.cell(6) + 2 * register.cell(7) + 1 * register.cell(8);
    return sum / 7;
  }
}

// 3-BIT DAC OF THE BLIPPOO BOX (weights 1, 2, 1)
//
// The same three cells, but the middle one counts double and the outer two the same. The
// eight bit patterns collapse into five levels, symmetric around 0 V, and the middle levels
// can be reached in two ways each: with equally likely patterns the levels come out
// 1/8, 2/8, 2/8, 2/8, 1/8 — a rough bell curve that favours the centre.
//
//   [6] ×1 ─┐
//   [7] ×2 ─┼─▶ sum (0 … 4) ──▶ Rungler CV (−1 … +1, five steps: −1, −½, 0, +½, +1)
//   [8] ×1 ─┘
//
//   000 → −1 · 001, 100 → −½ · 010, 101 → 0 · 011, 110 → +½ · 111 → +1

export class CentredDAC {
  level(register) { return register.cell(6) + 2 * register.cell(7) + register.cell(8); } // 0 … 4
  convert(register) { return this.level(register) / 2 - 1; }
}
