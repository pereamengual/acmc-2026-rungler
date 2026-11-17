// OFFLINE BUILD — the landing page and the lab as HTML files that open with a double click
// (plan B for the workshop: a USB stick, no network, no server, nothing to install).
//
//   index.html, styles.css, app.js ──────▶ <out>/offline.html      (landing page, everything inside)
//   lab/index.html, lab/lab.css, lab/js/** ▶ <out>/lab/offline.html  (the lab, everything inside)
//   fonts/*.woff2 ─────────────────────── (inside both)
//
// The two link to each other: the landing page's "Open the laboratory" opens lab/offline.html,
// and the lab's title goes back to offline.html.
//
// Why: opened as a file (file://), browsers refuse to load ES modules and the AudioWorklet
// from separate files. So the modules are joined into one ordinary script, and the audio
// engine (processor.js and what it imports) travels inside the page as text and is handed to
// the AudioWorklet as an in-memory "blob" URL. The CSS and the Orbitron font go inside too.
//
// The bundler is deliberately tiny and only understands the import/export forms this project
// uses: `import { a, b as c } from './x.js';` and `export class|function|const …`. It stops
// with an error if it meets anything else, or a circular import.
//
// Usage:  node tools/build-offline.mjs <output folder>
//         (the output folder gets offline.html and lab/offline.html; copy the rest of the site
//          next to them, so the diagram's links to the code still work)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2];
if (!out) { console.error('Usage: node tools/build-offline.mjs <output folder>'); process.exit(1); }

// ── A minimal module bundler ──
function bundle(entry, replacements = []) {
  const order = [], modules = new Map(), visiting = new Set();
  const visit = file => {
    if (modules.has(file)) return;
    if (visiting.has(file)) throw new Error(`Circular import at ${relative(ROOT, file)}`);
    visiting.add(file);
    let code = readFileSync(file, 'utf8');
    for (const [from, to] of replacements) if (code.includes(from)) code = code.replace(from, to);
    const exportsList = [];
    // imports → reads from the module registry
    code = code.replace(/import\s*\{([^}]*)\}\s*from\s*'([^']+)';/g, (_, names, path) => {
      const target = resolve(dirname(file), path);
      visit(target);
      const fields = names.split(',').map(n => n.trim()).filter(Boolean).map(n => n.replace(/\s+as\s+/, ': '));
      return `const { ${fields.join(', ')} } = __require(${JSON.stringify(relative(ROOT, target))});`;
    });
    if (/^\s*import\b/m.test(code) || /\bimport\s*\(/.test(code) || /import\.meta/.test(code)) {
      throw new Error(`Unsupported import form in ${relative(ROOT, file)}`);
    }
    // exports → plain declarations, collected and handed over at the end of the module
    code = code.replace(/^export (async function\*?|function\*?|class|const|let) ([A-Za-z_$][\w$]*)(.*)$/gm, (line, kind, name, rest) => {
      exportsList.push(name);
      if (kind === 'const' || kind === 'let') {
        for (const more of rest.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=(?![=>])/g)) exportsList.push(more[1]);
      }
      return line.replace(/^export /, '');
    });
    if (/^export\b/m.test(code)) throw new Error(`Unsupported export form in ${relative(ROOT, file)}`);
    visiting.delete(file);
    modules.set(file, { code, exportsList });
    order.push(file);
  };
  visit(resolve(ROOT, entry));
  const parts = order.map(file => {
    const { code, exportsList } = modules.get(file);
    return `__define(${JSON.stringify(relative(ROOT, file))}, function (__exports) {\n${code}\nObject.assign(__exports, { ${exportsList.join(', ')} });\n});`;
  });
  return `(function () {
'use strict';
const __factories = {}, __cache = {};
function __define(id, factory) { __factories[id] = factory; }
function __require(id) {
  if (!__cache[id]) { __cache[id] = {}; __factories[id](__cache[id]); }
  return __cache[id];
}
${parts.join('\n\n')}
__require(${JSON.stringify(relative(ROOT, order.at(-1)))});
})();`;
}

// ── 1. The audio engine (runs inside the AudioWorklet) ──
const worklet = bundle('lab/js/dsp/processor.js');

// ── 2. The page: the engine travels inside as text and becomes a blob URL ──
const workletLoader = JSON.stringify('data:text/javascript;base64,' + Buffer.from(worklet).toString('base64'));
const page = bundle('lab/js/main.js', [
  ["new URL('../dsp/processor.js', import.meta.url)", workletLoader]
]);

// ── 3. The CSS with the font inside ──
const font = readFileSync(resolve(ROOT, 'fonts/Orbitron.woff2')).toString('base64');
const css = readFileSync(resolve(ROOT, 'lab/lab.css'), 'utf8')
  .replace("url('../fonts/Orbitron.woff2')", `url(data:font/woff2;base64,${font})`);

// ── 4. One HTML file ──
const safe = text => text.replace(/<\/(script|style)/gi, '<\\/$1');
let html = readFileSync(resolve(ROOT, 'lab/index.html'), 'utf8');
const swap = (from, to) => { if (!html.includes(from)) throw new Error(`index.html: not found: ${from}`); html = html.replace(from, to); };
swap('  <link rel="preload" href="../fonts/Orbitron.woff2" as="font" type="font/woff2" crossorigin>\n', '');
swap('<link rel="stylesheet" href="./lab.css">', `<style>\n${safe(css)}\n</style>`);
swap('  <script type="module" src="./js/main.js"></script>\n', '');
swap('</body>', `<script>\n${safe(page)}\n</script>\n</body>`);
swap('<title>The Rungler / Laboratory — ACMC 2026</title>', '<title>The Rungler / Laboratory (offline) — ACMC 2026</title>');
swap('<a class="brand" href="../">', '<a class="brand" href="../offline.html">');
swap('Return to the <a href="../">', 'Return to the <a href="../offline.html">');

mkdirSync(resolve(out, 'lab'), { recursive: true });
writeFileSync(resolve(out, 'lab/offline.html'), html);
console.log(`lab/offline.html: ${(html.length / 1024).toFixed(0)} KB → ${resolve(out, 'lab/offline.html')}`);

// ── 5. The landing page, also in one file (its script is an ordinary one, nothing to bundle) ──
const landingCss = readFileSync(resolve(ROOT, 'styles.css'), 'utf8')
  .replace("url('./fonts/Orbitron.woff2')", `url(data:font/woff2;base64,${font})`);
const landingJs = readFileSync(resolve(ROOT, 'app.js'), 'utf8');
let landing = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const swapLanding = (from, to) => { if (!landing.includes(from)) throw new Error(`index.html: not found: ${from}`); landing = landing.replace(from, to); };
swapLanding('  <link rel="preload" href="./fonts/Orbitron.woff2" as="font" type="font/woff2" crossorigin>\n', '');
swapLanding('<link rel="stylesheet" href="./styles.css">', `<style>\n${safe(landingCss)}\n</style>`);
swapLanding('  <script src="./app.js" defer></script>\n', '');
swapLanding('</body>', `<script>\n${safe(landingJs)}\n</script>\n</body>`);
swapLanding('href="./lab/">Open the laboratory', 'href="./lab/offline.html">Open the laboratory');
swapLanding('<a class="brand" href="./"', '<a class="brand" href="./offline.html"');
swapLanding(/<p class="fine-print">If this address does not load[^\n]*<\/p>/.exec(landing)?.[0] ?? 'missing fine print',
  '<p class="fine-print">This is the offline copy (USB stick): it works without network or server. Online: <a href="https://pereamengual.github.io/acmc-2026-rungler/lab/">pereamengual.github.io/acmc-2026-rungler/lab</a> or <a href="https://pedrotrotz.com/rungler/lab/">pedrotrotz.com/rungler/lab</a>.</p>');
writeFileSync(resolve(out, 'offline.html'), landing);
console.log(`offline.html: ${(landing.length / 1024).toFixed(0)} KB → ${resolve(out, 'offline.html')}`);
