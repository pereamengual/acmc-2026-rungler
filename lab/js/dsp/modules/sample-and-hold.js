// SAMPLE & HOLD
//
// On a trigger it takes a snapshot of its input and holds that value, unchanged, until the
// next trigger. Between triggers the input is ignored.
//
//   input ──▶ [ S&H ] ──▶ held value (a staircase)
//                ▲
//             trigger

export class SampleAndHold {
  constructor() {
    this.value = 0;
    this.previous = 0; // the value held before the last trigger
  }

  trigger(input) {
    this.previous = this.value;
    this.value = input;
  }

  reset() { this.value = 0; this.previous = 0; }
}
