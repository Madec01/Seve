// Version publiée (tools/build.js) : index.html, dist/ et sw.js doivent correspondre aux sources.
// Si un test échoue ici : lancer « node tools/build.js » puis committer index.html, dev.html,
// dist/ et sw.js avec les sources.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, hash16, sourceFingerprint } from '../tools/build.js';

const readText = (p) => readFileSync(join(ROOT, p), 'utf8');
const info = JSON.parse(readText('dist/build.json'));
const HINT = 'lancer « node tools/build.js »';

test('dist/build.json : sources inchangées depuis la dernière construction', () => {
  const now = sourceFingerprint();
  const before = info.sources;
  const changed = Object.keys({ ...now, ...before }).filter((k) => now[k] !== before[k]).sort();
  assert.deepEqual(changed, [], `sources modifiées depuis la dernière construction (${HINT}) : ${changed.join(', ')}`);
});

test('index.html ne désigne que le paquet de cette version, présent et intact', () => {
  const html = readText('index.html');
  const m = /window\.__FERME_BUILD__ = (\{.*?\});<\/script>/.exec(html);
  assert.ok(m, 'configuration du chargeur absente de index.html');
  const cfg = JSON.parse(m[1]);
  assert.equal(cfg.id, info.id);
  assert.equal(cfg.js.src, info.js);
  assert.deepEqual(cfg.css, [info.css]);
  assert.match(cfg.js.src, /^dist\/game\.[0-9a-f]{10}\.js$/);
  assert.match(info.css, /^dist\/game\.[0-9a-f]{10}\.css$/);
  const js = readFileSync(join(ROOT, cfg.js.src));
  assert.equal(hash16(js), cfg.js.sha, `${cfg.js.src} ne correspond pas à index.html (${HINT})`);
  assert.equal(js.length, cfg.js.size);
  assert.ok(existsSync(join(ROOT, `${cfg.js.src}.map`)), 'carte des sources absente');
  assert.ok(html.includes(`href="${info.css}"`), 'feuille de style de la version absente de index.html');
  // Plus aucun module ni style non versionné dans la page publiée.
  assert.ok(!/(?:src|href)="(?:\.\/)?(?:src|css)\//.test(html) && !/type="module"/.test(html), 'index.html désigne encore des fichiers non versionnés');
});

test('sw.js : version et précache de cette construction', () => {
  const sw = readText('sw.js');
  assert.ok(sw.includes(`const VERSION = '${info.id}';`), `sw.js périmé (${HINT})`);
  const html = readFileSync(join(ROOT, 'index.html'));
  assert.ok(sw.includes(`["index.html", '${hash16(html)}'`), 'empreinte de index.html fausse dans sw.js');
  for (const p of [info.js, info.css]) {
    assert.ok(sw.includes(`["${p}", '${hash16(readFileSync(join(ROOT, p)))}'`), `${p} absent du précache ou empreinte fausse`);
  }
  assert.ok(!/\["src\//.test(sw) && !/\["css\//.test(sw), 'les sources non empaquetées ne doivent pas être précachées');
});

test('les paquets des versions gardées existent', () => {
  for (const h of info.history) for (const f of h.files) assert.ok(existsSync(join(ROOT, f)), `${f} manquant`);
});

test('reconstruction identique (esbuild installé)', async (t) => {
  let check;
  try {
    await import('esbuild');
    ({ check } = await import('../tools/build.js'));
  } catch {
    t.skip('esbuild absent (npm install) : reconstruction non vérifiée');
    return;
  }
  const problems = await check();
  assert.deepEqual(problems, [], `version publiée périmée (${HINT})`);
});
