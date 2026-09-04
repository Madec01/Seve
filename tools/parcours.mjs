#!/usr/bin/env node
// Parcours automatisé dans un vrai navigateur : titre → sauvegarde → Verger →
// Cycle → semis → accord → pause, sur écran PC puis téléphone en paysage.
// Échoue si la moindre erreur JavaScript est levée.
//
//   npx playwright install chromium   (une seule fois)
//   node tools/bundle.mjs && node tools/parcours.mjs
//
// Playwright est une dépendance de développement facultative : le jeu lui-même
// n'a besoin de rien.

import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let chromium;
// PLAYWRIGHT_MODULE permet de pointer une installation globale.
for (const spec of [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean)) {
  try { ({ chromium } = await import(spec)); break; } catch { /* on essaie le suivant */ }
}
if (!chromium) {
  console.error('Playwright est introuvable. Installe-le avec :\n'
    + '  npm i -D playwright && npx playwright install chromium\n'
    + 'ou pointe une installation globale : PLAYWRIGHT_MODULE=/chemin/playwright/index.mjs');
  process.exit(2);
}

const target = pathToFileURL(join(ROOT, 'hors-ligne.html')).href;
const errors = [];
const browser = await chromium.launch();

async function page(viewport, options = {}) {
  const p = await browser.newPage(Object.assign({ viewport }, options));
  p.on('pageerror', (e) => errors.push(`[${viewport.width}×${viewport.height}] ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
  await p.goto(target);
  await p.waitForTimeout(700);
  return p;
}

const steps = [];
function step(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  console.log(`  ${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
}

console.log('\nPC — 1280×720');
const pc = await page({ width: 1280, height: 720 });
step('le jeu démarre', await pc.evaluate(() => !!window.SEVE));

await pc.getByRole('button', { name: 'Jouer' }).click();
await pc.waitForTimeout(400);
step('écran des sauvegardes', await pc.locator('.slot-card').count() === 3);

await pc.getByRole('button', { name: 'Commencer' }).first().click();
await pc.waitForTimeout(600);
step('dialogue d’ouverture', await pc.locator('.dialogue:not(.hidden)').count() === 1);

for (let i = 0; i < 10; i++) { await pc.keyboard.press('Space'); await pc.waitForTimeout(160); }
await pc.waitForTimeout(400);
step('arrivée au Verger', await pc.evaluate(() => window.SEVE.state) === 'verger');

await pc.getByRole('button', { name: /Partir en Cycle/ }).click();
await pc.waitForTimeout(300);
await pc.getByRole('button', { name: 'Semer ici' }).first().click();
await pc.waitForTimeout(900);
for (let i = 0; i < 8; i++) { await pc.keyboard.press('Space'); await pc.waitForTimeout(140); }
step('partie lancée', await pc.evaluate(() => window.SEVE.state) === 'jeu');

for (const key of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) {
  await pc.keyboard.down(key); await pc.waitForTimeout(200); await pc.keyboard.up(key);
}
for (let i = 0; i < 5; i++) { await pc.keyboard.press('Space'); await pc.waitForTimeout(240); }
const semis = await pc.evaluate(() => window.SEVE.run.stats.seedsSown);
step('des graines ont été semées', semis > 0, `${semis} semis`);

await pc.keyboard.press('KeyT');
await pc.waitForTimeout(300);
step('Mode Test accessible', await pc.locator('.testmode:not(.hidden)').count() === 1);
await pc.getByRole('button', { name: 'Accord majeur', exact: true }).click();
await pc.waitForTimeout(250);
await pc.keyboard.press('KeyT');
await pc.waitForTimeout(150);
await pc.keyboard.press('Space');
await pc.waitForTimeout(600);
const apres = await pc.evaluate(() => ({ c: window.SEVE.run.stats.chords, s: window.SEVE.run.sap }));
step('un accord se forme et rapporte', apres.c > 0 && apres.s > 0, `${apres.c} accord, ${apres.s} sève`);

await pc.keyboard.press('Escape');
await pc.waitForTimeout(300);
step('pause', await pc.evaluate(() => window.SEVE.state) === 'pause');

const fps = await pc.evaluate(() => window.SEVE.loop.fps);
step('fluidité', fps >= 45, `${fps} i/s`);

console.log('\nTéléphone en paysage — 844×390');
const mob = await page({ width: 844, height: 390 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await mob.getByRole('button', { name: 'Défi du jour' }).click();
await mob.waitForTimeout(1100);
step('défi du jour jouable', await mob.evaluate(() => window.SEVE.state) === 'jeu');
step('boutons tactiles affichés', await mob.locator('.tbtn').count() === 3);
const debord = await mob.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
step('aucun débordement horizontal', !debord);

await browser.close();

const failed = steps.filter((s) => !s.ok).length;
if (errors.length) console.log('\nErreurs JavaScript :\n' + errors.map((e) => '  ' + e).join('\n'));
console.log(`\n${steps.length - failed}/${steps.length} étapes réussies, ${errors.length} erreur(s) JS.\n`);
process.exit(failed || errors.length ? 1 : 0);
