#!/usr/bin/env node
// Construit la version publiée du jeu : UN fichier JavaScript et UN fichier CSS à empreinte de
// contenu, la page index.html qui les désigne, la page de développement dev.html et la liste de
// préchargement du service worker (sw.js).
//
//   node tools/build.js           construit (à lancer avant CHAQUE commit qui touche le jeu)
//   node tools/build.js --check   vérifie que tout est à jour (code de sortie 1 sinon), sans rien écrire
//
// Pourquoi : GitHub Pages sert chaque fichier avec « Cache-Control: max-age=600 ». Avec ~50 modules
// et feuilles de style aux noms fixes, un téléphone qui recharge juste après une mise en ligne
// reçoit la nouvelle page mais garde d'anciens modules ou styles dans son cache HTTP : le jeu
// mélange deux versions et ne démarre pas. Ici, le nom de chaque fichier change avec son contenu :
// une page ne peut désigner que des fichiers de SA version.
//
// Étapes :
//   1. empreinte (SHA-256, 16 caractères hexadécimaux) de chaque ressource de assets/ ;
//   2. src/main.js et tous ses modules → dist/game.<empreinte>.js (esbuild, IIFE, Chrome 90+,
//      minifié, carte des sources dist/game.<empreinte>.js.map) ; la table des empreintes des
//      ressources y est écrite (globalThis.__FERME_ASSETS__, lue par src/version.js) : images et
//      sons sont demandés avec « ?v=<empreinte> » ;
//   2 bis. src/intro/player.js et ses modules → dist/intro.<empreinte>.js (petit paquet de l'intro « MG studios »,
//      téléchargé en parallèle du jeu par le portillon src/intro/gate.js ; même table des empreintes) ;
//   3. css/fonts.css + css/style.css + css/guidance.css + css/lot2.css + css/variety.css + css/cozy.css + css/valley.css + css/coach.css + css/intro.css → dist/game.<empreinte>.css (url() réécrites en ../assets/…?v=…) ;
//   4. src/index.template.html → index.html (paquet) et dev.html (modules de src/, pour déboguer),
//      avec le portillon de l'intro src/intro/gate.js et le chargeur src/loader.js recopiés dans la page ;
//   5. bloc PRECACHE de sw.js (fichiers de cette version, empreintes, « core » ou « lazy ») ;
//   6. dist/build.json : version, fichiers, empreintes des sources (pour tests/build.test.js).
//
// Les paquets des 5 dernières versions restent dans dist/ : une page index.html encore en cache
// (navigateur, CDN) quelques minutes après une mise en ligne trouve toujours SES fichiers.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP_BUILDS = 5;

// Ressources servies (et versionnées) : tout assets/ sauf les captures du manifeste et les
// fichiers de travail (scripts de génération, licences, police source).
const ASSET_EXCLUDED_DIRS = new Set(['assets/screenshots']);
const ASSET_EXCLUDED_EXT = new Set(['.md', '.py', '.txt', '.pyc', '.map', '.log', '.ttf', '.otf', '.xcf', '.aseprite']);
const CSS_FILES = ['css/fonts.css', 'css/style.css', 'css/guidance.css', 'css/lot2.css', 'css/variety.css', 'css/cozy.css', 'css/valley.css', 'css/coach.css', 'css/intro.css'];
const TEMPLATE = 'src/index.template.html';
const LOADER = 'src/loader.js';
const INTRO_GATE = 'src/intro/gate.js';
const INTRO_ENTRY = 'src/intro/player.js';
const ENTRY = 'src/main.js';
const TARGET = ['chrome90', 'edge90', 'firefox90', 'safari15'];

/** Même calcul que dans sw.js et src/loader.js : 16 premiers caractères hexadécimaux du SHA-256. */
export const hash16 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);
const toPosix = (p) => p.split(sep).join('/');
const rel = (abs) => toPosix(relative(ROOT, abs));
const read = (p) => readFileSync(join(ROOT, p));

function walk(dir, filter, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (filter.dir(rel(abs))) walk(abs, filter, out);
    } else if (st.isFile() && filter.file(rel(abs))) out.push(rel(abs));
  }
  return out;
}

/** Ressources du jeu : [{ path, hash, size }], triées. */
export function collectAssets() {
  const files = walk(join(ROOT, 'assets'), {
    dir: (r) => !ASSET_EXCLUDED_DIRS.has(r),
    file: (r) => !ASSET_EXCLUDED_EXT.has(extname(r).toLowerCase()),
  });
  return files.map((path) => {
    const buf = read(path);
    return { path, hash: hash16(buf), size: buf.length };
  });
}

/** Fichiers sources dont dépend la version publiée : { chemin: empreinte }. */
export function sourceFingerprint() {
  const files = [
    ...walk(join(ROOT, 'src'), { dir: () => true, file: () => true }),
    ...CSS_FILES,
    ...collectAssets().map((a) => a.path),
    'manifest.webmanifest',
    'tools/build.js',
    'package-lock.json',
  ];
  const out = {};
  for (const f of [...new Set(files)].sort()) if (existsSync(join(ROOT, f))) out[f] = hash16(read(f));
  return out;
}

/** Réécrit les url() d'une feuille de style (située dans css/) pour dist/ : ../assets/…?v=… */
function rewriteCssUrls(css, fromDir, versions) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, q, url) => {
    if (/^(data:|https?:|#)/.test(url)) return whole;
    const clean = url.split(/[?#]/)[0];
    const path = posix.normalize(posix.join(fromDir, clean));
    const v = versions[path];
    if (!v) throw new Error(`${fromDir}/… : ressource introuvable dans url(${url})`);
    return `url('../${path}?v=${v}')`;
  });
}

function fontPreloads(versions, dev) {
  const css = read('css/fonts.css').toString('utf8');
  const fonts = [...css.matchAll(/url\(\s*['"]?([^'")]+\.woff2)['"]?\s*\)/g)].map((m) => posix.normalize(posix.join('css', m[1])));
  return [...new Set(fonts)]
    .map((p) => `  <link rel="preload" href="${dev ? p : `${p}?v=${versions[p]}`}" as="font" type="font/woff2" crossorigin>`)
    .join('\n');
}

const cssLink = (href) =>
  `  <link rel="stylesheet" href="${href}" data-boot-css="${href}" onload="__bootCss(this,true)" onerror="__bootCss(this,false)">`;

function renderPage({ dev, config, versions }) {
  const template = read(TEMPLATE).toString('utf8');
  const loader = read(LOADER).toString('utf8').trim();
  if (/<\/script/i.test(loader)) throw new Error(`${LOADER} ne doit pas contenir « </script »`);
  const gate = read(INTRO_GATE).toString('utf8').trim();
  if (/<\/script/i.test(gate)) throw new Error(`${INTRO_GATE} ne doit pas contenir « </script »`);
  const boot = [
    `  <script>window.__FERME_BUILD__ = ${JSON.stringify(config)};</script>`,
    `  <script>\n${gate}\n  </script>`,
    `  <script>\n${loader}\n  </script>`,
  ].join('\n');
  const styles = (dev ? CSS_FILES : config.css).map(cssLink).join('\n');
  const generated = dev
    ? 'Fichier généré par tools/build.js depuis src/index.template.html (ne pas modifier à la main). MODE DÉVELOPPEMENT : modules de src/ et styles de css/ non empaquetés, sans service worker.'
    : 'Fichier généré par tools/build.js depuis src/index.template.html (ne pas modifier à la main).';
  let html = template
    .replace('{{GENERATED}}', generated)
    .replace('{{PRELOAD}}', fontPreloads(versions, dev))
    .replace('{{BOOT}}', () => boot)
    .replace('{{STYLES}}', styles);
  if (dev) html = html.replace('<title>Une année à la ferme</title>', '<title>Une année à la ferme (développement)</title>');
  if (/\{\{[A-Z]+\}\}/.test(html)) throw new Error(`${TEMPLATE} : marqueur non remplacé`);
  return html;
}

function precacheBlock(id, entries) {
  const total = entries.reduce((s, e) => s + e[2], 0);
  const core = entries.filter((e) => e[3] === 'core');
  const coreSize = core.reduce((s, e) => s + e[2], 0);
  return [
    '// <precache> — bloc généré par tools/build.js : ne pas modifier à la main',
    `const VERSION = '${id}';`,
    `// ${entries.length} fichiers, ${(total / 1048576).toFixed(1)} Mo ; installés d'emblée (core) : ${core.length} fichiers, ${(coreSize / 1048576).toFixed(2)} Mo`,
    'const PRECACHE = [',
    ...entries.map(([p, h, size, kind]) => `  [${JSON.stringify(p)}, '${h}', ${size}, '${kind}'],`),
    '];',
    '// </precache>',
  ].join('\n');
}

/**
 * Calcule toute la version publiée, sans rien écrire. Renvoie { id, files: Map(chemin → contenu),
 * remove: [chemins de dist/ à supprimer] }.
 */
export async function build() {
  let esbuild;
  try {
    esbuild = await import('esbuild');
  } catch {
    throw new Error('esbuild est introuvable : lancer « npm install » (dépendance de développement, voir package.json).');
  }

  const assets = collectAssets();
  const versions = Object.fromEntries(assets.map((a) => [a.path, a.hash.slice(0, 10)]));

  // ── JavaScript ──
  const js = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: [ENTRY],
    bundle: true,
    format: 'iife',
    target: TARGET,
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    sourcemap: 'external',
    sourcesContent: false, // la carte renvoie vers ../src/*.js, publiés aussi : dépôt plus léger
    outfile: 'dist/game.js',
    write: false,
    logLevel: 'silent',
    banner: { js: '"use strict";' },
    define: { 'globalThis.__FERME_ASSETS__': JSON.stringify(versions) },
  });
  const jsOut = js.outputFiles.find((f) => f.path.endsWith('.js'));
  const mapOut = js.outputFiles.find((f) => f.path.endsWith('.js.map'));
  const code = jsOut.text.replace(/\n?\/\/# sourceMappingURL=.*\n?$/, '').trimEnd();
  const jsHash = hash16(code).slice(0, 10);
  const jsName = `dist/game.${jsHash}.js`;
  const jsFinal = `${code}\n//# sourceMappingURL=game.${jsHash}.js.map\n`;
  const map = JSON.parse(mapOut.text);
  map.file = `game.${jsHash}.js`;
  const mapFinal = JSON.stringify(map);

  // ── Intro « MG studios » (petit paquet à part : il doit pouvoir se jouer avant que le jeu soit arrivé) ──
  const intro = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: [INTRO_ENTRY],
    bundle: true,
    format: 'iife',
    target: TARGET,
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    sourcemap: 'external',
    sourcesContent: false,
    outfile: 'dist/intro.js',
    write: false,
    logLevel: 'silent',
    banner: { js: '"use strict";' },
    define: { 'globalThis.__FERME_ASSETS__': JSON.stringify(versions) },
  });
  const introOut = intro.outputFiles.find((f) => f.path.endsWith('.js'));
  const introMapOut = intro.outputFiles.find((f) => f.path.endsWith('.js.map'));
  const introCode = introOut.text.replace(/\n?\/\/# sourceMappingURL=.*\n?$/, '').trimEnd();
  const introHash = hash16(introCode).slice(0, 10);
  const introName = `dist/intro.${introHash}.js`;
  const introFinal = `${introCode}\n//# sourceMappingURL=intro.${introHash}.js.map\n`;
  const introMap = JSON.parse(introMapOut.text);
  introMap.file = `intro.${introHash}.js`;
  const introMapFinal = JSON.stringify(introMap);

  // ── CSS ──
  const cssSource = CSS_FILES.map((f) => `/* ${f} */\n${rewriteCssUrls(read(f).toString('utf8'), posix.dirname(f), versions)}`).join('\n');
  const css = await esbuild.transform(cssSource, { loader: 'css', minify: true, target: TARGET, charset: 'utf8', legalComments: 'none', logLevel: 'silent' });
  const cssFinal = css.code;
  const cssName = `dist/game.${hash16(cssFinal).slice(0, 10)}.css`;

  // ── Version ──
  const manifestHash = hash16(read('manifest.webmanifest'));
  const id = hash16([
    `js:${hash16(jsFinal)}`,
    `css:${hash16(cssFinal)}`,
    `manifest:${manifestHash}`,
    `template:${hash16(read(TEMPLATE))}`,
    `loader:${hash16(read(LOADER))}`,
    `intro:${hash16(introFinal)}`,
    `gate:${hash16(read(INTRO_GATE))}`,
    `sw:${hash16(read('sw.js').toString('utf8').replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, ''))}`,
    ...assets.map((a) => `${a.path}:${a.hash}`),
  ].join('\n')).slice(0, 12);

  // ── Pages ──
  const config = { id, js: { src: jsName, sha: hash16(jsFinal), size: Buffer.byteLength(jsFinal) }, css: [cssName], intro: { src: introName } };
  const indexHtml = renderPage({ dev: false, config, versions });
  const devHtml = renderPage({ dev: true, config: { id: 'dev', dev: true, module: ENTRY, intro: { module: INTRO_ENTRY } }, versions });

  // ── Service worker ──
  const entries = [
    ['index.html', hash16(indexHtml), Buffer.byteLength(indexHtml), 'core'],
    ['manifest.webmanifest', manifestHash, read('manifest.webmanifest').length, 'core'],
    [jsName, hash16(jsFinal), Buffer.byteLength(jsFinal), 'core'],
    [cssName, hash16(cssFinal), Buffer.byteLength(cssFinal), 'core'],
    [introName, hash16(introFinal), Buffer.byteLength(introFinal), 'core'],
    // sons « lazy » (rangés au premier usage), sauf les cris de l'intro : joués dès l'ouverture, même hors ligne
    ...assets.map((a) => [a.path, a.hash, a.size, a.path.startsWith('assets/audio/') && !a.path.startsWith('assets/audio/intro/') ? 'lazy' : 'core']),
  ];
  const swSrc = read('sw.js').toString('utf8');
  const blockRe = /\/\/ <precache>[\s\S]*?\/\/ <\/precache>/;
  if (!blockRe.test(swSrc)) throw new Error('sw.js : bloc « // <precache> … // </precache> » introuvable.');
  const swFinal = swSrc.replace(blockRe, () => precacheBlock(id, entries));

  // ── dist/build.json et ménage des anciennes versions ──
  const ownFiles = [jsName, `${jsName}.map`, cssName, introName, `${introName}.map`];
  let previous = { history: [] };
  try { previous = JSON.parse(read('dist/build.json').toString('utf8')); } catch { /* première construction */ }
  const history = [{ id, files: ownFiles }, ...(previous.history || []).filter((h) => h.id !== id)].slice(0, KEEP_BUILDS);
  const keep = new Set(['dist/build.json', ...history.flatMap((h) => h.files)]);
  const remove = walk(join(ROOT, 'dist'), { dir: () => true, file: (r) => !keep.has(r) });
  const buildJson = `${JSON.stringify({
    id,
    note: 'Généré par tools/build.js : ne pas modifier à la main.',
    js: jsName,
    css: cssName,
    intro: introName,
    esbuild: esbuild.version,
    sources: sourceFingerprint(),
    history,
  }, null, 2)}\n`;

  const files = new Map([
    [jsName, jsFinal],
    [`${jsName}.map`, mapFinal],
    [cssName, cssFinal],
    [introName, introFinal],
    [`${introName}.map`, introMapFinal],
    ['index.html', indexHtml],
    ['dev.html', devHtml],
    ['sw.js', swFinal],
    ['dist/build.json', buildJson],
  ]);
  // Les fichiers des versions précédentes gardées doivent exister (sinon : pas de vérification possible).
  return { id, files, remove, entries, config };
}

/** Compare la construction au contenu du disque. Renvoie la liste des différences (vide = à jour). */
export async function check() {
  const { files, remove } = await build();
  const problems = [];
  for (const [path, content] of files) {
    const abs = join(ROOT, path);
    if (!existsSync(abs)) problems.push(`${path} : manquant`);
    else if (readFileSync(abs, 'utf8') !== content) problems.push(`${path} : périmé`);
  }
  for (const path of remove) problems.push(`${path} : fichier en trop dans dist/`);
  return problems;
}

async function main() {
  const mode = process.argv[2];
  if (mode === '--check') {
    const problems = await check();
    if (problems.length) {
      console.error(`Version publiée périmée — lancer « node tools/build.js » :\n  ${problems.join('\n  ')}`);
      process.exit(1);
    }
    console.log('Version publiée à jour (index.html, dev.html, dist/, sw.js).');
    return;
  }
  const { id, files, remove, entries, config } = await build();
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  let changed = 0;
  for (const [path, content] of files) {
    const abs = join(ROOT, path);
    if (existsSync(abs) && readFileSync(abs, 'utf8') === content) continue;
    writeFileSync(abs, content);
    changed += 1;
    console.log(`  écrit   ${path}`);
  }
  for (const path of remove) {
    unlinkSync(join(ROOT, path));
    console.log(`  retiré  ${path}`);
  }
  const core = entries.filter((e) => e[3] === 'core');
  console.log(`Version ${id} : ${config.js.src} (${(config.js.size / 1024).toFixed(0)} Ko), ${config.css[0]}, `
    + `${entries.length} fichiers hors ligne (${core.length} installés d'emblée, ${(core.reduce((s, e) => s + e[2], 0) / 1048576).toFixed(2)} Mo). `
    + `${changed ? `${changed} fichier(s) écrit(s).` : 'Rien à changer.'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(2);
  });
}
