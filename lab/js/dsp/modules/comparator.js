// COMPARATOR
//
// Two inputs, one output. The output is high (+1) while the input is above the reference
// and low (−1) otherwise. Comparing two moving waves gives a pulse whose width keeps
// changing: pulse-width modulation (PWM).
//
//   input ─────▶ ┌─────┐
//                │  >  │──▶ pulse (+1 / −1)
//   reference ─▶ └─────┘

export function compare(input, reference) {
  return input > reference ? 1 : -1;
}
