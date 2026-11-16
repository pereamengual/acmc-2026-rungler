import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : /\.(js|mjs)$/.test(path) ? [path] : [];
  });
}
const files = ['app.js', ...walk('lab/js'), ...walk('tests'), ...walk('tools')];
for (const path of files) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
}
console.log(`Syntax OK: ${files.length} JavaScript modules/scripts`);
