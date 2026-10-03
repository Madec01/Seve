// La Vallée vivante (lot V2) — le troc de graines avec les 12 voisins : troc de la foire (dernier jour d'hiver), troc de
// saison (2ᵉ jour, Grainothèque, cercles ouverts par les niveaux 1 à 3, culture de saison préférée, Léon et le verger), une
// proposition à la fois qui attend sans limite, échange (♥ : 4 graines), refus, requêtes, indice, album.
// Contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V2 » ; règles : docs/VALLEE.md § 16.3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TROC } from '../src/data/career/heritage.js';
import { nextTrocClient, trocGifts } from '../src/core/career/heritage.js';
import { newLot } from './career-crew-helpers.js';
import { nextDay, record, setRank, startedCareer, toSeason } from './valley-helpers.js';

const A = (g) => g.actions.career;
const Q = (g) => g.query.career;

/** Avance jusqu'au jour `day` de la saison `seasonIndex` (aube passée). */
function toDay(g, seasonIndex, day) {
  let guard = 0;
  nextDay(g);
  while (!(g.state.time.seasonIndex === seasonIndex && g.state.time.dayOfSeason === day) && guard++ < 400) nextDay(g);
}

test('troc de la foire : dernier jour d\'hiver, dès une variété sauvée, sans Grainothèque, une fois par an, le prochain voisin de l\'ordre', () => {
  const g = startedCareer({}, 2);
  const ev = record(g);
  const L = g.state.career.seasonLength;
  // Aucune variété sauvée : pas de proposition.
  toDay(g, 3, L);
  assert.equal(g.state.career.valley.troc, null);
  assert.equal(ev.of('trocOffered').length, 0);
  A(g).triggerValley('fix', 'bouleDOr');
  toDay(g, 3, L);
  const t = g.state.career.valley.troc;
  assert.deepEqual([t.clientId, t.from], ['lili', 'fair']);
  const e = ev.of('trocOffered')[0];
  assert.deepEqual([e.clientId, e.clientName, e.varietyId, e.varietyName, e.from], ['lili', 'Lili', 'carotteViolette', 'Carotte violette', 'fair']);
  assert.equal(e.text, TROC.lines.lili.offer);
  assert.equal(g.state.career.valley.trocFairYear, g.state.time.year);
  // Le troc attend (sans limite) ; aucune autre proposition tant qu'il attend.
  for (let d = 0; d < 4 * L + 2; d++) nextDay(g);
  assert.equal(g.state.career.valley.troc.clientId, 'lili');
  assert.equal(ev.of('trocOffered').length, 1);
  // Fait : la foire suivante propose le prochain de l'ordre (même sans Grainothèque).
  assert.ok(A(g).swapSeeds('bouleDOr').ok);
  toDay(g, 3, L);
  assert.equal(g.state.career.valley.troc.clientId, 'fabre');
  assert.equal(g.state.career.valley.troc.from, 'fair');
});

test('troc de saison : 2ᵉ jour de chaque saison avec la Grainothèque ; cercles ouverts par les niveaux 1 à 3 ; une seule proposition à la fois', () => {
  const g = startedCareer({}, 5);
  const ev = record(g);
  A(g).triggerValley('fix', 'bouleDOr');
  // Sans Grainothèque : rien au 2ᵉ jour.
  toSeason(g, 1);
  nextDay(g);
  assert.equal(g.state.career.valley.troc, null);
  A(g).triggerValley('library', 1);
  toSeason(g, 2);
  assert.equal(g.state.career.valley.troc, null, '1ᵉʳ jour : pas encore');
  nextDay(g);
  assert.equal(g.state.time.dayOfSeason, 2);
  const first = g.state.career.valley.troc;
  assert.equal(first.from, 'season');
  assert.ok(['lili', 'fabre', 'garnier', 'morel'].includes(first.clientId), 'cercle 1');
  assert.equal(g.state.career.valley.trocSeason, (g.state.time.year - 1) * 4 + 2);
  // Les 4 du cercle 1 faits : rien de plus tant que le niveau 2 n'est pas là.
  for (const c of ['lili', 'fabre', 'garnier', 'morel']) if (!g.state.career.valley.swaps[c]) A(g).triggerValley('swap', c);
  assert.equal(g.state.career.valley.troc, null);
  toSeason(g, 3);
  nextDay(g);
  assert.equal(g.state.career.valley.troc, null, 'cercle 2 fermé');
  assert.equal(nextTrocClient(g.state, 'season'), null);
  A(g).triggerValley('library', 2);
  assert.ok(['paulo', 'chevalier', 'rose', 'odette'].includes(nextTrocClient(g.state, 'season').clientId));
  A(g).triggerValley('library', 3);
  assert.equal(nextTrocClient(g.state, 'fair').clientId, 'paulo', 'la foire : le prochain de l\'ordre');
  assert.ok(ev.of('trocOffered').length >= 1);
});

test('troc de saison : le premier voisin dont la culture se sème cette saison ou la suivante (toute l\'année avec une serre)', () => {
  const g = startedCareer({}, 5);
  A(g).triggerValley('fix', 'bouleDOr');
  A(g).triggerValley('library', 1);
  // Été : la carotte (printemps, automne) se sème la saison suivante → Lili ; la courgette (été) aussi, mais Lili est avant.
  g.state.time.seasonIndex = 1;
  assert.equal(nextTrocClient(g.state, 'season').clientId, 'lili');
  A(g).triggerValley('swap', 'lili');
  // Hiver : courgette (été) non, pomme de terre (printemps : saison suivante) oui → M. Garnier avant le père Fabre.
  g.state.time.seasonIndex = 3;
  assert.equal(nextTrocClient(g.state, 'season').clientId, 'garnier');
  // Avec une serre, tout se sème toute l'année : le premier de l'ordre.
  setRank(g, 6);
  newLot(g, 'greenhouse');
  assert.equal(nextTrocClient(g.state, 'season').clientId, 'fabre');
});

test('Léon attend un verger (foire et saison) ; la grille du troc dit « Il faut un verger »', () => {
  const g = startedCareer({}, 6);
  A(g).triggerValley('fix', 'bouleDOr');
  A(g).triggerValley('library', 3);
  for (const o of TROC.order) if (o.clientId !== 'leon') A(g).triggerValley('swap', o.clientId);
  assert.equal(nextTrocClient(g.state, 'fair'), null);
  assert.equal(nextTrocClient(g.state, 'season'), null);
  const leon = Q(g).valley().swaps.list.find((x) => x.clientId === 'leon');
  assert.equal(leon.locked, 'Il faut un verger');
  newLot(g, 'orchard');
  assert.equal(nextTrocClient(g.state, 'fair').clientId, 'leon');
  assert.equal(Q(g).valley().swaps.list.find((x) => x.clientId === 'leon').locked, null);
  // Léon donne des greffons.
  A(g).triggerValley('troc', 'leon');
  assert.equal(Q(g).valley().troc.unit, 'greffon');
  const r = A(g).swapSeeds('bouleDOr');
  assert.deepEqual([r.got.varietyId, r.got.unit], ['apiEtoile', 'greffon']);
  assert.equal(Q(g).valley().swaps.done, 12);
});

test('échange : 3 graines (♥ préférée : 4 et un petit mot), une fois par voisin, rien ne coûte ; refus', () => {
  const g = startedCareer({}, 3);
  const ev = record(g);
  const A0 = A(g);
  assert.equal(A0.swapSeeds('bouleDOr').reason, 'Aucun troc en attente.');
  A0.triggerValley('fix', 'bouleDOr');
  A0.triggerValley('troc', 'rose');
  assert.equal(A0.swapSeeds('nope').reason, 'Variété inconnue.');
  assert.equal(A0.swapSeeds('coeurDeBoeuf').reason, 'Cette variété n\'est pas encore sauvée.');
  assert.equal(A0.swapSeeds('veloursRouge').reason, 'Mme Rose a déjà cette variété : c\'est la sienne.');
  const money = g.state.money;
  const seedsBefore = { ...g.state.career.valley.seeds };
  const r = A0.swapSeeds('bouleDOr');
  assert.deepEqual([r.ok, r.clientId, r.given.varietyId, r.got.varietyId, r.got.seeds, r.fav], [true, 'rose', 'bouleDOr', 'veloursRouge', 3, false]);
  assert.equal(r.thanks, TROC.lines.rose.thanks);
  assert.equal(r.favLine, null);
  assert.equal(g.state.money, money, 'le troc ne coûte rien');
  assert.equal(g.state.career.valley.seeds.bouleDOr || 0, seedsBefore.bouleDOr || 0, 'aucune graine retirée');
  assert.equal(g.state.career.valley.seeds.veloursRouge, 3);
  assert.equal(g.state.career.valley.varieties.veloursRouge.from, 'swap');
  assert.deepEqual(g.state.career.valley.swaps.rose, { given: 'bouleDOr', got: 'veloursRouge', seeds: 3, fav: false, at: r ? g.state.career.valley.swaps.rose.at : 0 });
  assert.equal(g.state.career.valley.troc, null);
  assert.equal(ev.of('seedSwapped').length, 1);
  // ♥ : Mme Rose aime les fraises → la Reine des Vallées en rend 4.
  A0.triggerValley('fix', 'reineDesVallees');
  A0.triggerValley('troc', 'perrin');
  const gifts = trocGifts(g.state, 'perrin');
  assert.equal(gifts[0].varietyId, 'reineDesVallees', 'les préférées en tête');
  assert.ok(gifts[0].fav);
  const f = A0.swapSeeds('reineDesVallees');
  assert.deepEqual([f.fav, f.got.seeds], [true, 4]);
  assert.match(f.favLine, /Mlle Perrin adore les fraises : 4 graines au lieu de 3/);
  // Une croisée donnée : phrase spéciale avec le nom de la ferme.
  A0.triggerValley('cross', 'carrot');
  A0.triggerValley('fix', 'crossCarrot');
  A0.triggerValley('troc', 'maire');
  const c = A0.swapSeeds('crossCarrot');
  assert.match(c.thanks, /Une graine de la .* ! Je la planterai devant chez moi\./);
  // Une fois par voisin.
  assert.equal(A0.triggerValley('troc', 'rose').reason, 'Voisin inconnu ou troc déjà fait.');
});

test('requêtes : trocInfo (proposition, dons possibles ♥ en tête, graines rendues), grille des 12 voisins, indice « troc »', () => {
  const g = startedCareer({}, 3);
  A(g).triggerValley('fix', 'bouleDOr');
  A(g).triggerValley('fix', 'jauneDuDoubs');
  A(g).triggerValley('troc', 'lili');
  for (let n = 0; n <= 6; n++) A(g).readChapter(n);
  for (const s of g.state.career.valley.stories.available) A(g).readStory(s);
  const q = Q(g).valley();
  const t = q.troc;
  assert.deepEqual([t.clientId, t.clientName, t.clientTitle, t.portrait, t.varietyId, t.seeds, t.unit], ['lili', 'Lili', 'la petite voisine', 'portrait.client.lili', 'carotteViolette', 3, 'graine']);
  assert.equal(t.text, TROC.lines.lili.offer);
  assert.deepEqual(t.traits.map((x) => x.id), ['fine']);
  assert.deepEqual(t.gifts.map((x) => [x.varietyId, x.fav, x.seedsBack]), [['jauneDuDoubs', true, 4], ['bouleDOr', true, 4]]);
  assert.match(t.favText, /Lili adore/);
  assert.equal(q.swaps.total, 12);
  assert.equal(q.swaps.done, 0);
  assert.equal(q.swaps.list.find((x) => x.clientId === 'lili').waiting, true);
  assert.equal(q.swaps.list.find((x) => x.clientId === 'paulo').locked, 'Grainothèque niveau 2');
  assert.equal(q.hint.kind, 'troc');
  assert.deepEqual(q.hint.target, { type: 'troc', id: 'lili' });
  // { heritage: false } : aucun troc.
  const v1 = startedCareer({ valley: { heritage: false } }, 3);
  A(v1).triggerValley('fix', 'bouleDOr');
  toDay(v1, 3, v1.state.career.seasonLength);
  assert.equal(v1.state.career.valley.troc, null);
  assert.equal(Q(v1).valley().troc, undefined);
});

test('le troc ne touche pas au tableau du village : aucune place, aucun tirage du flux orders', () => {
  const run = (heritage) => {
    const g = startedCareer({ variety: true, valley: { heritage } }, 3);
    A(g).triggerValley('fix', 'bouleDOr');
    if (heritage) A(g).triggerValley('troc', 'lili');
    for (let d = 0; d < 6; d++) nextDay(g);
    return { orders: g.state.rng.orders, variety: g.state.rng.variety, board: JSON.stringify(g.state.variety?.board ?? null) };
  };
  const a = run(false);
  const b = run(true);
  assert.equal(b.orders, a.orders);
  assert.equal(b.variety, a.variety);
  assert.equal(b.board, a.board);
});
