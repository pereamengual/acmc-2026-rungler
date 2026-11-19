// BLOCK DIAGRAM — draws a stage's signal flow as SVG, from a plain description
//
//   blocks: { id, label, file, x, y, w, h }      a box with its name and a link to its code
//   wires:  { type, points, label, at }          a line through `points`, ending in an arrow
//   junctions: [[x, y], …]                       optional dots where one signal splits in two
//   groups: { label, x, y, w, h }                optional frame around blocks that form one
//                                                instrument (e.g. the Rungler inside stage 2)
//
//   type 'audio'   solid line       audio-rate signals (oscillators, noise, filters, pulse)
//   type 'cv'      dashed line      control voltages (Rungler CV, pitch, cutoff)
//   type 'logic'   dotted line      clock and bits (square as data, clock edges, register cells)
//
//   active: { id, in }     optional, on blocks and wires: the part is drawn faint unless the
//                          selector or switch `id` has one of the values `in` — so the route
//                          you are listening to stands out and the rest stays visible but quiet.
//   active: { id, above }  the same for a knob: faint unless its value is above `above`
//                          (e.g. a Rungler → OSC path is faint while its depth is 0);
//   active: { id, below }  …or below `below`;
//   active: [ …, … ]       several conditions, all of which must hold;
//   active: { any: […] }   at least one of them (see core/conditions.js).
//   shown: { … }           optional, the same kind of condition: the part is not drawn at all
//                          unless it holds (e.g. the S&H of stage 4 before its step).
//
// The descriptions live in lab/js/diagrams.js. Positions are fixed by hand so that no text
// overlaps and every connection is drawn.

import { holds, idsIn } from '../core/conditions.js';

const SVG = 'http://www.w3.org/2000/svg';
const BLOCK_W = 136, BLOCK_H = 40;
const CODE_BASE = './js/dsp/';

function svg(tag, attributes = {}, text) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function arrowMarker(type) {
  // Fixed-size arrowheads (9 units), whatever the line thickness, so short wire ends stay visible.
  const marker = svg('marker', { id: `arrow-${type}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
  marker.append(svg('path', { d: 'M0 0 L10 5 L0 10 z', class: 'diagram-arrow' }));
  return marker;
}

const isActive = (part, valueOf) => holds(part.active, valueOf);
const quiet = (part, valueOf) => (isActive(part, valueOf) ? '' : ' is-inactive');

// The selectors, switches and knobs a diagram depends on.
export const diagramDependencies = diagram =>
  new Set([...(diagram?.blocks ?? []), ...(diagram?.wires ?? [])].flatMap(part => [...idsIn(part.active), ...idsIn(part.shown)]));

export function drawBlockDiagram(container, diagram, valueOf = () => null) {
  container.replaceChildren();
  if (!diagram) return;
  const root = svg('svg', { viewBox: `0 0 ${diagram.width} ${diagram.height}`, class: 'block-diagram', role: 'img', 'aria-label': diagram.description });
  const defs = svg('defs');
  for (const type of ['audio', 'cv', 'logic']) defs.append(arrowMarker(type));
  root.append(defs);

  // Groups first: a thin frame with its name in the top-left corner, behind everything.
  for (const group of diagram.groups ?? []) {
    root.append(svg('rect', { x: group.x, y: group.y, width: group.w, height: group.h, rx: 4, class: 'diagram-group' }));
    root.append(svg('text', { x: group.x + 8, y: group.y + 12, class: 'group-label' }, group.label));
  }

  // Wires first, so the blocks sit on top. A wide stroke in the background colour under each
  // wire makes crossings read as one line passing over another. Faint wires go first, so an
  // active wire is never cut by them.
  const shown = part => holds(part.shown, valueOf);
  const wires = diagram.wires.filter(shown).sort((a, b) => isActive(a, valueOf) - isActive(b, valueOf));
  for (const wire of wires) {
    const d = wire.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
    root.append(svg('path', { d, class: 'wire-halo' }));
    root.append(svg('path', { d, class: `wire wire-${wire.type}${quiet(wire, valueOf)}`, 'marker-end': `url(#arrow-${wire.type})` }));
  }

  for (const [cx, cy] of diagram.junctions ?? []) root.append(svg('circle', { cx, cy, r: 3.5, class: 'diagram-junction' }));

  for (const block of diagram.blocks.filter(shown)) {
    const w = block.w ?? BLOCK_W, h = block.h ?? BLOCK_H, cx = block.x + w / 2;
    const group = svg('g', { class: `diagram-block${quiet(block, valueOf)}` });
    group.append(svg('rect', { x: block.x, y: block.y, width: w, height: h, rx: 2 }));
    const labelY = block.file ? block.y + h / 2 - 3 : block.y + h / 2 + 4;
    group.append(svg('text', { x: cx, y: labelY, class: 'block-label' }, block.label));
    if (block.file) {
      const link = svg('a', { href: CODE_BASE + block.file, target: '_blank', rel: 'noopener' });
      link.append(svg('text', { x: cx, y: labelY + 13, class: 'block-link' }, `${block.file.split('/').pop()} ↗`));
      group.append(link);
    }
    root.append(group);
  }

  for (const wire of wires) {
    if (!wire.label) continue;
    root.append(svg('text', { x: wire.at[0], y: wire.at[1], class: `wire-label${quiet(wire, valueOf)}` }, wire.label));
  }
  container.append(root);
}
