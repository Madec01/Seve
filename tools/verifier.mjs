#!/usr/bin/env node
// Vérification sans navigateur : chargement des modules, cohérence des données
// et simulation de gameplay. Suffisant pour attraper une régression de règles.
//
//   node tools/verifier.mjs

import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;

function test(name, fn) {
  try { fn(); pass++; console.log(`  ✔ ${name}`); }
  catch (err) { fail++; console.log(`  ✘ ${name}\n      ${err.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion échouée'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} attendu ${b}, obtenu ${a}`); }

// Le noyau touche à quelques globales du navigateur : on les stub.
globalThis.window = globalThis.window || { addEventListener() {} };
globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};

function walk(dir) {
  let out = [];
  for (const n of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out = out.concat(walk(rel));
    else if (n.endsWith('.js')) out.push(rel);
  }
  return out;
}

console.log('\nChargement des modules');
const domOnly = [];
for (const rel of walk('src')) {
  try { await import(pathToFileURL(join(ROOT, rel)).href); pass++; }
  catch (err) {
    if (err instanceof ReferenceError && /document|navigator|HTMLElement|performance/.test(err.message)) {
      domOnly.push(rel); pass++;
    } else { fail++; console.log(`  ✘ ${rel} : ${err.message}`); }
  }
}
console.log(`  ✔ ${walk('src').length} modules chargés (${domOnly.length} dépendent du DOM)`);

const scales = await import(pathToFileURL(join(ROOT, 'src/game/scales.js')).href);
const biomes = await import(pathToFileURL(join(ROOT, 'src/game/biomes.js')).href);
const plants = await import(pathToFileURL(join(ROOT, 'src/game/plants.js')).href);
const fieldMod = await import(pathToFileURL(join(ROOT, 'src/game/field.js')).href);
const reson = await import(pathToFileURL(join(ROOT, 'src/game/resonance.js')).href);
const prog = await import(pathToFileURL(join(ROOT, 'src/game/progression.js')).href);
const ach = await import(pathToFileURL(join(ROOT, 'src/game/achievements.js')).href);
const chal = await import(pathToFileURL(join(ROOT, 'src/game/challenges.js')).href);
const store = await import(pathToFileURL(join(ROOT, 'src/core/storage.js')).href);
const { Run } = await import(pathToFileURL(join(ROOT, 'src/game/run.js')).href);

console.log('\nDonnées');
test('chaque degré a une espèce et une couleur', () => {
  for (const d of scales.DEGREES) {
    assert(scales.DEGREE_INFO[d], `degré ${d} sans info`);
    assert(plants.SPECIES[d], `degré ${d} sans espèce`);
    assert(/^#[0-9a-f]{6}$/i.test(scales.DEGREE_INFO[d].color), `couleur invalide pour ${d}`);
  }
});
test('les accords sont triés du plus fort au plus faible', () => {
  const mults = scales.CHORDS.map((c) => c.mult);
  for (let i = 1; i < mults.length; i++) {
    assert(mults[i] <= mults[i - 1], `accord ${scales.CHORDS[i].id} mal classé`);
  }
});
test('chaque accord n’utilise que des degrés existants', () => {
  for (const c of scales.CHORDS) {
    for (const d of c.need) assert(scales.DEGREES.includes(d), `${c.id} demande ${d}`);
    assert(c.minSize <= c.need.length || c.minSize >= 2, `${c.id} : minSize incohérent`);
  }
});
test('reconnaissance d’accord : I+III+V donne un majeur', () => {
  const chord = scales.matchChord(new Set(['I', 'III', 'V']), 3);
  eq(chord && chord.id, 'majeur');
});
test('reconnaissance d’accord : les cinq degrés donnent le pentatonique', () => {
  const chord = scales.matchChord(new Set(scales.DEGREES), 5);
  eq(chord && chord.id, 'pentatonique');
});
test('reconnaissance d’accord : une seule plante ne fait pas d’accord', () => {
  eq(scales.matchChord(new Set(['I']), 1), null);
});
test('les biomes ont des coûts croissants et un pouls plausible', () => {
  let prev = -1;
  for (const id of biomes.BIOME_ORDER) {
    const b = biomes.BIOMES[id];
    assert(b.cost >= prev, `${id} moins cher que le précédent`);
    assert(b.bpm >= 60 && b.bpm <= 180, `${id} : pouls ${b.bpm} hors bornes`);
    assert(b.cols >= 7 && b.rows >= 5, `${id} : grille trop petite`);
    prev = b.cost;
  }
});
test('les identifiants de succès sont uniques', () => {
  const ids = ach.ACHIEVEMENTS.map((a) => a.id);
  eq(new Set(ids).size, ids.length, 'identifiants dupliqués');
});
test('la besace de départ permet de former au moins un accord', () => {
  // Invariant de conception : sans accord possible, la mécanique centrale du
  // jeu — et l'étape « accord » du tutoriel — sont hors d'atteinte.
  const start = new Set(store.emptySave(0).unlockedSeeds);
  const faisable = scales.CHORDS.filter((c) => c.need.every((d) => start.has(d)));
  assert(faisable.length > 0,
    `aucun accord formable avec ${[...start].join(', ')}`);
});
test('chaque graine achetable débloque au moins un accord de plus', () => {
  const save = store.emptySave(0);
  const owned = new Set(save.unlockedSeeds);
  const count = (set) => scales.CHORDS.filter((c) => c.need.every((d) => set.has(d))).length;
  let before = count(owned);
  for (const entry of prog.SEED_UNLOCKS) {
    owned.add(entry.key);
    const after = count(owned);
    assert(after > before, `${entry.key} n'ouvre aucun nouvel accord`);
    before = after;
  }
});
test('aucun succès ne lève d’exception sur une sauvegarde vierge', () => {
  const save = store.emptySave(0);
  const got = ach.checkAchievements(save);
  eq(got.length, 0, 'un succès se débloque tout seul :');
});

console.log('\nSimulation');
test('un champ se génère avec un centre cultivable', () => {
  const f = new fieldMod.Field(biomes.BIOMES.clairiere, 1234);
  eq(f.tiles.length, f.cols * f.rows);
  const mid = f.at(Math.floor(f.cols / 2), Math.floor(f.rows / 2));
  assert(f.isSowable(mid), 'la case centrale doit être semable');
});
test('une plante sème, pousse et mûrit', () => {
  const f = new fieldMod.Field(biomes.BIOMES.clairiere, 7);
  const t = f.tiles.find((x) => f.isSowable(x));
  const p = f.sow(t, 'II');
  assert(p, 'semis refusé');
  for (let i = 0; i < 60 * 30; i++) f.update(1 / 60, { chainMult: 1 });
  assert(t.plant === null || t.plant.ripe || t.plant.wilted, 'la plante n’a pas évolué');
});
test('la Cendre se propage au fil des pulsations', () => {
  const f = new fieldMod.Field(biomes.BIOMES.vallee, 99);
  const before = f.blightRatio();
  for (let i = 0; i < 200; i++) f.spreadBlight();
  assert(f.blightRatio() > before, 'la Cendre n’avance pas');
});
test('un accord majeur posé à la main est reconnu et récolté d’un bloc', () => {
  const run = new Run({ biomeId: 'clairiere', seed: 5, seeds: ['I', 'III', 'V'] });
  const f = run.field;
  const c = Math.floor(f.cols / 2), r = Math.floor(f.rows / 2);
  const cells = [[0, 0, 'I'], [1, 0, 'III'], [-1, 0, 'V']];
  for (const [dc, dr, deg] of cells) {
    const t = f.at(c + dc, r + dr);
    t.terrain = 'soil'; t.blight = 0; t.plant = null;
    const p = f.sow(t, deg);
    p.growth = 1; p.ripe = true;
  }
  const group = reson.groupAt(f, f.at(c, r));
  assert(group && group.chord, 'aucun accord détecté');
  eq(group.chord.id, 'majeur');
  const res = reson.harvestGroup(f, f.at(c, r), { chainMult: 2, just: true });
  eq(res.count, 3, 'toutes les plantes de l’accord doivent partir ensemble :');
  assert(res.sap > 0, 'récolte sans sève');
  for (const [dc, dr] of cells) assert(!f.at(c + dc, r + dr).plant, 'plante non récoltée');
});
test('l’onde d’un accord purifie autour d’elle', () => {
  const f = new fieldMod.Field(biomes.BIOMES.clairiere, 11);
  for (const t of f.tiles) t.blight = 1;
  const c = Math.floor(f.cols / 2), r = Math.floor(f.rows / 2);
  f.addWave(c, r, 3, 1);
  assert(f.at(c, r).blight < 1, 'la case centrale n’a pas été purifiée');
});
test('la partie se termine quand la Cendre dépasse le seuil', () => {
  const run = new Run({ biomeId: 'clairiere', seed: 3, seeds: ['I'] });
  run.start();
  for (const t of run.field.tiles) t.blight = 1;
  run.update(1 / 60, null);
  eq(run.state, 'etiolement');
});
test('les saisons s’enchaînent jusqu’à la floraison', () => {
  const run = new Run({ biomeId: 'clairiere', seed: 4, seeds: ['I'] });
  run.start();
  run.seasonSap = 99999;
  run.endSeason(); eq(run.season, 1);
  run.seasonSap = 99999;
  run.endSeason(); eq(run.season, 2);
  run.seasonSap = 99999;
  run.endSeason();
  eq(run.state, 'floraison');
});

console.log('\nProgression');
test('acheter une amélioration dépense la sève et monte le palier', () => {
  const save = store.emptySave(0);
  save.sap = 10000;
  const cost = prog.upgradeCost(save, 'paume');
  assert(prog.buyUpgrade(save, 'paume'), 'achat refusé');
  eq(save.sap, 10000 - cost);
  eq(prog.upgradeLevel(save, 'paume'), 1);
});
test('une amélioration au maximum ne se rachète pas', () => {
  const save = store.emptySave(0);
  save.sap = 1e9;
  const max = prog.UPGRADES.paume.max;
  for (let i = 0; i < max; i++) prog.buyUpgrade(save, 'paume');
  eq(prog.upgradeCost(save, 'paume'), null);
  assert(!prog.buyUpgrade(save, 'paume'), 'achat au-delà du maximum accepté');
});
test('sans sève, rien ne s’achète', () => {
  const save = store.emptySave(0);
  save.sap = 0;
  assert(!prog.buyUpgrade(save, 'paume'));
  assert(!prog.buySeed(save, 'V'));
  assert(!prog.buyBiome(save, 'marais'));
});
test('les bonus dérivés grandissent avec les paliers', () => {
  const a = store.emptySave(0);
  const b = store.emptySave(0);
  b.upgrades = { paume: 4, seve: 5, racines: 4 };
  const da = prog.derivedBonuses(a), db = prog.derivedBonuses(b);
  assert(db.reach > da.reach && db.sapMult > da.sapMult && db.growthMult > da.growthMult);
});
test('le défi du jour est déterministe', () => {
  const d1 = chal.todayChallenge(new Date('2026-09-04T10:00:00Z'));
  const d2 = chal.todayChallenge(new Date('2026-09-04T22:00:00Z'));
  eq(d1.id, d2.id);
  eq(d1.biome, d2.biome);
  eq(d1.modifiers.map((m) => m.id).join(), d2.modifiers.map((m) => m.id).join());
});
test('deux jours différents donnent deux défis différents', () => {
  const a = chal.todayChallenge(new Date('2026-09-04T10:00:00Z'));
  const b = chal.todayChallenge(new Date('2026-09-05T10:00:00Z'));
  assert(a.id !== b.id);
});
test('la sauvegarde fait l’aller-retour dans le stockage', () => {
  const save = store.emptySave(1);
  save.sap = 4242;
  save.echoes = ['e1', 'e2'];
  store.saveSlot(1, save);
  const back = store.loadSlot(1);
  eq(back.sap, 4242);
  eq(back.echoes.length, 2);
  store.deleteSlot(1);
  eq(store.loadSlot(1), null);
});

console.log(`\n${pass} vérifications passées, ${fail} en échec.\n`);
process.exit(fail ? 1 : 0);
