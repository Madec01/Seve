#!/usr/bin/env node
// Génère « hors-ligne.html » : le jeu entier dans un seul fichier, ouvrable
// par double-clic, sans serveur. Les modules ES sont enveloppés dans un
// micro-chargeur ; le CSS est intégré tel quel.
//
//   node tools/bundle.mjs
//
// Le code source reste la référence : ce fichier est un artefact de sortie.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const ENTRY = 'src/main.js';

function walk(dir) {
  let out = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out = out.concat(walk(rel));
    else if (name.endsWith('.js')) out.push(rel);
  }
  return out;
}

const IMPORT_RE = /^import\s*\{([\s\S]*?)\}\s*from\s*'([^']+)'\s*;?\s*$/gm;

function resolve(fromFile, spec) {
  return normalize(join(dirname(fromFile), spec)).split('\\').join('/');
}

function parseModule(rel) {
  const source = readFileSync(join(ROOT, rel), 'utf8');
  const deps = [];
  let body = source.replace(IMPORT_RE, (_, names, spec) => {
    const target = resolve(rel, spec);
    deps.push(target);
    const bindings = names.split(',').map((n) => n.trim()).filter(Boolean)
      .map((n) => {
        const m = n.match(/^(\w+)\s+as\s+(\w+)$/);
        return m ? `${m[1]}: ${m[2]}` : n;
      }).join(', ');
    return `const { ${bindings} } = __req(${JSON.stringify(target)});`;
  });

  const exported = [];
  body = body.replace(/^export\s+(const|let|function|class|async function)\s+([A-Za-z_$][\w$]*)/gm,
    (_, kind, name) => { exported.push(name); return `${kind} ${name}`; });

  if (/^export\s/m.test(body)) {
    throw new Error(`${rel} : forme d'export non gérée par le bundler\n` +
      body.split('\n').filter((l) => /^export\s/.test(l)).join('\n'));
  }

  return { rel, body, deps, exported };
}

const modules = new Map();
for (const rel of walk('src')) modules.set(rel, parseModule(rel));

// Tri topologique : une dépendance est toujours définie avant son utilisateur.
const order = [];
const seen = new Set();
const stack = new Set();
function visit(rel) {
  if (seen.has(rel)) return;
  if (stack.has(rel)) throw new Error(`dépendance circulaire sur ${rel}`);
  stack.add(rel);
  const mod = modules.get(rel);
  if (!mod) throw new Error(`module introuvable : ${rel}`);
  for (const d of mod.deps) visit(d);
  stack.delete(rel);
  seen.add(rel);
  order.push(rel);
}
visit(ENTRY);
for (const rel of modules.keys()) visit(rel);

const chunks = order.map((rel) => {
  const m = modules.get(rel);
  const tail = m.exported.map((n) => `  __x.${n} = ${n};`).join('\n');
  return `__mods[${JSON.stringify(rel)}] = function (__x) {\n${m.body}\n${tail}\n};`;
});

const runtime = `
(function () {
'use strict';
const __mods = Object.create(null);
const __cache = Object.create(null);
function __req(id) {
  if (__cache[id]) return __cache[id];
  const x = {};
  __cache[id] = x;
  __mods[id](x);
  return x;
}
${chunks.join('\n\n')}
__req(${JSON.stringify(ENTRY)});
})();`;

const css = readFileSync(join(ROOT, 'css/style.css'), 'utf8');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
  .replace(/<link rel="stylesheet"[^>]*>/, `<style>\n${css}\n</style>`)
  .replace(/<script type="module"[^>]*><\/script>/, `<script>\n${runtime}\n</script>`);

const out = join(ROOT, 'hors-ligne.html');
writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`hors-ligne.html écrit — ${modules.size} modules, ${kb} Ko`);
console.log(`ordre de chargement : ${order.length} fichiers, entrée ${ENTRY}`);
