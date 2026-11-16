// 8-BIT SHIFT REGISTER (like the CMOS chip in the Rungler)
//
// Eight memory cells in a row. On every clock pulse each bit moves one cell to the right,
// the new data bit enters cell 1 and the bit in cell 8 falls off the end.
//
//   data ──▶ [1][2][3][4][5][6][7][8] ──▶ (lost, or fed back through XOR)
//              ▲
//            clock
//
// Cells are numbered 1 … 8 here, as on a panel or a schematic.

export class ShiftRegister {
  constructor(length = 8) {
    this.length = length;
    this.cells = new Array(length).fill(0);
  }

  clock(dataBit) {
    for (let cell = this.length - 1; cell > 0; cell--) this.cells[cell] = this.cells[cell - 1];
    this.cells[0] = dataBit ? 1 : 0;
  }

  cell(number) { return this.cells[number - 1]; } // number: 1 … length
  get lastBit() { return this.cells[this.length - 1]; }

  // The whole register as one number (cell 1 = lowest bit), for the display.
  get pattern() {
    return this.cells.reduce((value, bit, index) => value | (bit << index), 0);
  }

  reset() { this.cells.fill(0); }
}
