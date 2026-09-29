#!/usr/bin/env node
// Génère la liste de préchargement du service worker (sw.js) : tous les fichiers du jeu, avec une
// empreinte de contenu (SHA-256 tronqué) par fichier et une version globale.
//
//   node tools/build-sw-manifest.js           réécrit le bloc PRECACHE de sw.js
//   node tools/build-sw-manifest.js --check   vérifie que sw.js est à jour (code de sortie 1 sinon)
//   node tools/build-sw-manifest.js --list    affiche la liste sans rien écrire
//
// À relancer après CHAQUE modification d'un fichier du jeu (HTML, CSS, JS, images, sons, police,
// manifeste) avant de publier : c'est le changement de sw.js qui déclenche, chez les joueurs,
// le message « Nouvelle version disponible — Recharger ». Un fichier oublié ne serait pas
// disponible hors ligne ; un fichier modifié sans relancer le script resterait à l'ancienne
// version chez les joueurs qui ont déjà le jeu en cache.
//
// Exclus : dossiers et fichiers cachés (.git, .claude, .nojekyll…), tools/, tests/, docs/,
// scratch/, node_modules/, assets/screenshots/ (captures du manifeste), *.md, *.py, *.txt,
// et sw.js lui-même.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SW = join(ROOT, 'sw.js');

const EXCLUDED_DIRS = new Set(['tools', 'tests', 'docs', 'scratch', 'node_modules', 'assets/screenshots']);
const EXCLUDED_EXT = new Set(['.md', '.py', '.txt', '.pyc', '.map', '.log']);
const EXCLUDED_FILES = new Set(['sw.js', 'package.json', 'package-lock.json']);

function walk(dir, out) {
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const abs = join(dir, name);
    const rel = relative(ROOT, abs).split(sep).join('/');
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (!EXCLUDED_DIRS.has(rel)) walk(abs, out);
    } else if (st.isFile()) {
      if (EXCLUDED_FILES.has(rel) || EXCLUDED_EXT.has(extname(name).toLowerCase())) continue;
      out.push({ rel, abs, size: st.size });
    }
  }
  return out;
}

// Même calcul que dans sw.js (vérification à l'installation) : 16 premiers caractères hexadécimaux du SHA-256.
const hashOf = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

const files = walk(ROOT, []);
const entries = files.map((f) => [f.rel, hashOf(readFileSync(f.abs)), f.size]);
const version = hashOf(entries.map((e) => `${e[0]}:${e[1]}`).join('\n')).slice(0, 12);
const total = entries.reduce((s, e) => s + e[2], 0);

const block = [
  '// <precache> — bloc généré par tools/build-sw-manifest.js : ne pas modifier à la main',
  `const VERSION = '${version}';`,
  `// ${entries.length} fichiers, ${(total / 1048576).toFixed(1)} Mo`,
  'const PRECACHE = [',
  ...entries.map(([rel, h, size]) => `  [${JSON.stringify(rel)}, '${h}', ${size}],`),
  '];',
  '// </precache>',
].join('\n');

const mode = process.argv[2];
if (mode === '--list') {
  for (const [rel, h, size] of entries) console.log(`${h}  ${String(size).padStart(9)}  ${rel}`);
  console.log(`version ${version} — ${entries.length} fichiers, ${(total / 1048576).toFixed(1)} Mo`);
  process.exit(0);
}

const src = readFileSync(SW, 'utf8');
const re = /\/\/ <precache>[\s\S]*?\/\/ <\/precache>/;
if (!re.test(src)) {
  console.error('sw.js : bloc « // <precache> … // </precache> » introuvable.');
  process.exit(2);
}
const next = src.replace(re, block);

if (mode === '--check') {
  if (next !== src) {
    console.error('sw.js n’est pas à jour : lancer « node tools/build-sw-manifest.js ».');
    process.exit(1);
  }
  console.log(`sw.js à jour (version ${version}, ${entries.length} fichiers).`);
  process.exit(0);
}

if (next !== src) writeFileSync(SW, next);
console.log(`sw.js ${next !== src ? 'mis à jour' : 'déjà à jour'} : version ${version}, ${entries.length} fichiers, ${(total / 1048576).toFixed(1)} Mo.`);
