#!/usr/bin/env node
// Mesures du paysage sonore de la vallée (lot V4, paquet AUDIO) dans Chromium (Playwright), téléphone Pixel 7 émulé :
// coût CPU (rendu OfflineAudioContext : temps de calcul / durée du son), pic (< 0,5 voulu, aucun écrêtage), craquements
// aux transitions (saut d'échantillon maximal autour d'un changement, comparé au régime établi), analyse de chaque son
// (durée, pic, RMS, fréquence dominante, centre spectral, répartition par bandes) et du moteur en temps réel (voix,
// minuterie arrêtée en arrière-plan).
//
//   node tools/measure-nature.js            (Playwright installé : npm i -g playwright, ou NODE_PATH)
//   node tools/measure-nature.js --throttle 4   CPU ralenti × 4 (téléphone d'entrée de gamme)
//   node tools/measure-nature.js --json     sortie JSON brute
//
// Page mesurée : tools/nature-preview.html (window.natureLab).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { ROOT } from './build.js';

const args = process.argv.slice(2);
const throttle = Number(args[args.indexOf('--throttle') + 1]) || (args.includes('--throttle') ? 4 : 1);
const asJson = args.includes('--json');

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    const g = execSync('npm root -g').toString().trim();
    return require(join(g, 'playwright'));
  }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const { chromium, devices } = loadPlaywright();
const server = await serve();
const port = server.address().port;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ ...devices['Pixel 7'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
if (throttle > 1) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
}
await page.goto(`http://127.0.0.1:${port}/tools/nature-preview.html`);
await page.waitForFunction(() => window.natureLab && window.natureLab.ready);

const out = { device: 'Pixel 7 (émulé)', throttle, scenes: {}, sources: {}, tones: {}, transitions: {}, live: {} };

// 1. Scènes (coût CPU, pic, sons simultanés).
const SCENES = {
  'vue complète, printemps, aube, Complets': { ctx: { where: 'view', season: 'spring', dayProgress: 0.1 }, detail: 'full', listener: { y: 200, h: 180 } },
  'vue complète, été, soir, Complets': { ctx: { where: 'view', season: 'summer', dayProgress: 0.85 }, detail: 'full', listener: { y: 200, h: 180 } },
  'vue complète, été, soir, Légers': { ctx: { where: 'view', season: 'summer', dayProgress: 0.85 }, detail: 'light', listener: { y: 200, h: 180 } },
  'ferme complète, printemps, aube, Complets': { ctx: { where: 'farm', season: 'spring', dayProgress: 0.1 }, detail: 'full' },
  'ferme complète, été, soir, Légers': { ctx: { where: 'farm', season: 'summer', dayProgress: 0.85 }, detail: 'light' },
  'ferme, hiver, neige': { ctx: { where: 'farm', season: 'winter', weather: 'snow', dayProgress: 0.85 }, detail: 'full' },
  'PIRE CAS vue, été, soir, Complets, chants × 30': { ctx: { where: 'view', season: 'summer', dayProgress: 0.85 }, detail: 'full', listener: { y: 200, h: 180 }, stress: 30 },
  'PIRE CAS vue, été, soir, Légers, chants × 30': { ctx: { where: 'view', season: 'summer', dayProgress: 0.85 }, detail: 'light', listener: { y: 200, h: 180 }, stress: 30 },
};
for (const [name, s] of Object.entries(SCENES)) {
  out.scenes[name] = await page.evaluate((o) => window.natureLab.renderScene({ ...o, seconds: 30 }), s);
}

// 2. Chaque son seul (analyse spectrale et enveloppe).
const ids = await page.evaluate(() => [...window.natureLab.LAYER_IDS, ...window.natureLab.SONG_IDS]);
for (const id of ids) {
  const a = await page.evaluate((i) => window.natureLab.renderSource(i), id);
  delete a.env;
  out.sources[id] = a;
}
for (const name of ['clatter', 'legend']) {
  const a = await page.evaluate((n) => window.natureLab.renderTone(n), name);
  delete a.env;
  out.tones[name] = a;
}

// 3. Transitions : changement de phase, de lieu, défilement brusque, réglage, pluie, arrêt.
out.transitions = await page.evaluate(() =>
  window.natureLab.renderTransitions({
    ctx: { where: 'view', season: 'summer', dayProgress: 0.6 },
    seconds: 30,
    steps: [
      { at: 6, ctx: { dayProgress: 0.8 } },
      { at: 9, listener: { y: 40, h: 180 } },
      { at: 11, listener: { y: 400, h: 180 } },
      { at: 13, detail: 'light' },
      { at: 16, detail: 'full' },
      { at: 18, ctx: { where: 'farm' } },
      { at: 21, ctx: { weather: 'rain' } },
      { at: 24, ctx: { where: 'view', weather: 'sunny' } },
      { at: 28, stop: true },
    ],
  }),
);

// 4. Moteur en temps réel (AudioContext réel, minuterie de 250 ms) : voix, arrière-plan.
out.live = await page.evaluate(async () => {
  const { natureScape, demoFacts } = window.natureLab;
  const { createNature } = await import('../src/audio/nature.js');
  const ac = new AudioContext();
  await ac.resume();
  const g = ac.createGain();
  g.gain.value = 0;
  g.connect(ac.destination);
  const e = createNature(ac, g, { detail: 'full' });
  e.set({ ...natureScape(demoFacts(), { where: 'view', season: 'spring', dayProgress: 0.1 }), birds: natureScape(demoFacts(), { where: 'view', season: 'spring', dayProgress: 0.1 }).birds.map((b) => ({ ...b, rate: 120 })) });
  let peakVoices = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 6000) {
    await new Promise((r) => setTimeout(r, 100));
    peakVoices = Math.max(peakVoices, e.voices);
  }
  // Arrière-plan : la minuterie s'arrête (plus aucune phrase nouvelle).
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((r) => setTimeout(r, 6000)); // les phrases en cours finissent
  const hiddenVoices = e.voices;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
  let backVoices = 0;
  const tb = performance.now();
  while (performance.now() - tb < 4000) {
    await new Promise((r) => setTimeout(r, 100));
    backVoices = Math.max(backVoices, e.voices);
  }
  e.setDetail('light');
  let lightPeak = 0;
  const t1 = performance.now();
  while (performance.now() - t1 < 5000) {
    await new Promise((r) => setTimeout(r, 100));
    lightPeak = Math.max(lightPeak, e.voices);
  }
  e.stop();
  await new Promise((r) => setTimeout(r, 600));
  return { peakVoicesFull: peakVoices, voicesWhileHidden: hiddenVoices, voicesBack: backVoices, peakVoicesLight: lightPeak, layersAfterStop: e.layers };
});
out.errors = errors;

await browser.close();
server.close();

if (asJson) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`Sons de la vallée — ${out.device}, CPU × ${throttle}\n`);
  console.log('Scènes (30 s rendues hors ligne ; charge = temps de calcul / durée) :');
  for (const [n, s] of Object.entries(out.scenes)) {
    console.log(`  ${n.padEnd(50)} charge ${(s.load * 100).toFixed(1).padStart(5)} %  pic ${s.peak.toFixed(3)}  RMS ${s.rms.toFixed(3)}  voix ≤ ${s.voicesPeak} (moy. ${s.voicesMean})  chants ${s.birds}`);
  }
  console.log('\nSons seuls (pic, RMS, durée audible, fréquence dominante, centre spectral, bandes en %) :');
  for (const [id, a] of Object.entries({ ...out.sources, ...out.tones })) {
    console.log(`  ${id.padEnd(16)} pic ${a.peak.toFixed(3)}  RMS ${a.rms.toFixed(3)}  ${String(a.audible).padStart(5)} s  dom ${String(a.dominant).padStart(5)} Hz  centre ${String(a.centroid).padStart(5)} Hz  ${JSON.stringify(a.bands)}`);
  }
  const tr = out.transitions;
  console.log(`\nTransitions : saut max en régime établi ${tr.baseMaxDiff} (pic ${tr.basePeak}) ; pic global ${tr.peak} (à ${tr.peakAt} s) ; dernière seconde après stop ${tr.tail}`);
  for (const a of tr.around) console.log(`  t = ${String(a.at).padStart(2)} s  ${a.what.padEnd(10)} saut max ${a.maxDiff}  pic ${a.peak}`);
  const l = out.live;
  console.log(`\nTemps réel (AudioContext, minuterie 250 ms, tous les chants à 120 / min) : voix au plus ${l.peakVoicesFull} (Complets), ${l.peakVoicesLight} (Légers) ; arrière-plan : ${l.voicesWhileHidden} voix après 6 s (phrases en cours finies, aucune nouvelle) ; retour : jusqu'à ${l.voicesBack} ; couches après stop : ${l.layersAfterStop}`);
  if (errors.length) console.log(`\nErreurs de la page :\n  ${errors.join('\n  ')}`);
}
