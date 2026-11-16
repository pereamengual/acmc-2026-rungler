// CONDITIONS — "does this part do anything right now?"
//
// Used to hide controls that do nothing (core/parameters.js, `when`) and to draw faint the
// parts of a block diagram that are inactive (diagrams.js, `active`). A condition is:
//
//   { id, in: [values] }   a switch or selector has one of these values
//   { id, above: x }       a knob is above x          { id, below: x }   …or below x
//   [ a, b, … ]            all of them hold
//   { any: [ a, b, … ] }   at least one of them holds

export function holds(condition, valueOf) {
  if (!condition) return true;
  if (Array.isArray(condition)) return condition.every(c => holds(c, valueOf));
  if (condition.any) return condition.any.some(c => holds(c, valueOf));
  const value = valueOf(condition.id);
  if (condition.in) return condition.in.includes(value);
  if (condition.above !== undefined) return value > condition.above;
  if (condition.below !== undefined) return value < condition.below;
  return true;
}

// Every control id a condition looks at (to know when to check it again).
export function idsIn(condition) {
  if (!condition) return [];
  if (Array.isArray(condition)) return condition.flatMap(idsIn);
  if (condition.any) return condition.any.flatMap(idsIn);
  return [condition.id];
}
