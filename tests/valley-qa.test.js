// La Vallée vivante (lot V1) — corrections de l'intégration : accords des textes (genre des variétés et des habitants),
// « rien ne se perd » (la graine d'une planche d'essai perdue revient), réaménagement d'un terrain en jachère.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VARIETIES, VARIETIES_BY_ID, SPECIES, SPECIES_BY_ID, agreeWith, savedText } from '../src/data/career/valley.js';
import { seasonsWhen } from '../src/core/career/habitat.js';
import { loadCareer } from '../src/core/career/career.js';
import { startedCareer, emptyPlots, ripen, nextDay, record, toSeason } from './valley-helpers.js';

test('accords : « Navet Boule d\'or est sauvé ! », « Tomate Cœur de bœuf est sauvée ! » ; chaque variété et habitant a son genre', () => {
  assert.equal(savedText(VARIETIES_BY_ID.bouleDOr), 'Navet Boule d\'or est sauvé !');
  assert.equal(savedText(VARIETIES_BY_ID.coeurDeBoeuf), 'Tomate Cœur de bœuf est sauvée !');
  assert.equal(savedText(VARIETIES_BY_ID.vitelotte), 'Vitelotte est sauvée !');
  assert.equal(savedText(VARIETIES_BY_ID.grandRouxBasque), 'Maïs grand roux basque est sauvé !');
  for (const x of VARIETIES) assert.ok(x.g === 'm' || x.g === 'f', x.id);
  const masc = VARIETIES.filter((x) => x.g === 'm').map((x) => x.id).sort();
  assert.deepEqual(masc, ['bouleDOr', 'grandRouxBasque', 'milanDePontoise', 'rougeDeBordeaux', 'soleilDOr']);
  for (const s of SPECIES) {
    assert.ok((s.g === 'm' || s.g === 'f') && typeof s.pl === 'boolean' && /^(Le |La |Les |L')/.test(s.the), s.id);
  }
  assert.equal(agreeWith(SPECIES_BY_ID.ladybird, 'installé'), 'installées');
  assert.equal(agreeWith(SPECIES_BY_ID.bumblebee, 'installé'), 'installés');
  assert.equal(agreeWith(SPECIES_BY_ID.tawnyOwl, 'installé'), 'installée');
  assert.equal(agreeWith(SPECIES_BY_ID.hedgehog, 'installé'), 'installé');
  assert.equal(seasonsWhen(['spring', 'summer', 'autumn']), 'du printemps à l\'automne');
  assert.equal(seasonsWhen(['summer']), 'en été');
  assert.equal(seasonsWhen(['spring', 'summer']), 'au printemps et en été');
  assert.equal(seasonsWhen(['spring', 'summer', 'autumn', 'winter']), 'toute l\'année');
});

test('accords : événement de fixation, indice « mûr », bête qui attend (article, pluriel)', () => {
  const g = startedCareer();
  const A = g.actions.career;
  const ev = record(g);
  // Planche d'essai mûre d'une variété masculine (le navet de la boîte, au printemps).
  A.readChapter(0);
  const [i] = emptyPlots(g);
  assert.ok(A.sowHeirloom(i, 'bouleDOr').ok);
  ripen(g, i);
  const h = g.query.career.valley().hint;
  assert.equal(h.kind, 'trial');
  assert.equal(h.text, 'Navet Boule d\'or est mûr : récoltez-le à la main (+ 2 graines).');
  A.triggerValley('fix', 'bouleDOr');
  assert.equal(ev.of('heirloomFixed')[0].text, 'Navet Boule d\'or est sauvé !');
  A.triggerValley('visible', 'ladybird');
  const hint = g.query.career.valley().hint;
  assert.equal(hint.kind, 'observe');
  assert.match(hint.text, /^Les coccinelles vous attendent /);
  const s = g.query.career.valley().species.find((x) => x.id === 'ladybird');
  assert.equal(s.the, 'Les coccinelles');
  assert.equal(s.pl, true);
  assert.equal(s.g, 'f');
  A.observe('ladybird');
  assert.equal(A.observe('ladybird').reason, 'Déjà installées.');
});

test('rien ne se perd : une planche d\'essai gelée ou pourrie rend sa graine ; une variété sauvée, rien', () => {
  const g = startedCareer();
  toSeason(g, 2); // automne : la citrouille se sème encore (elle gèle au 1er jour d'hiver)
  const A = g.actions.career;
  const v = g.state.career.valley;
  v.seeds.rougeVifDEtampes = 1;
  const [i, j] = emptyPlots(g);
  assert.ok(A.sowHeirloom(i, 'rougeVifDEtampes').ok);
  assert.equal(v.seeds.rougeVifDEtampes || 0, 0);
  // Une variété sauvée sur une autre parcelle : rien ne revient (ses graines s'achètent).
  A.triggerValley('fix', 'rondeDeNice');
  v.seeds.rondeDeNice = 0;
  g.state.plots[j].cropId = 'zucchini';
  g.state.plots[j].variety = 'rondeDeNice';
  g.state.plots[j].growth = 0;
  while (!(g.state.time.seasonIndex === 3 && g.state.time.dayOfSeason === 1)) nextDay(g);
  assert.equal(g.state.plots[i].cropId, null, 'la citrouille a gelé');
  assert.equal(v.seeds.rougeVifDEtampes, 1, 'sa graine est revenue dans la boîte');
  assert.equal(v.seeds.rondeDeNice || 0, 0);
  assert.equal(loadCareer(g.serialize()).state.career.valley.seeds.rougeVifDEtampes, 1);
});

test('réaménager un terrain avec une jachère fleurie : la jachère s\'arrête, la sauvegarde reste valide', () => {
  const g = startedCareer({}, 3);
  const A = g.actions.career;
  const lot = A.buyLot();
  assert.ok(A.developLot(lot.lotId, 'field').ok);
  const [k] = emptyPlots(g, lot.lotId);
  assert.ok(A.sowFallow(k).ok);
  assert.ok(A.developLot(lot.lotId, 'meadow').ok);
  assert.equal(g.state.plots[k].fallow, undefined);
  assert.doesNotThrow(() => loadCareer(g.serialize()));
  assert.ok(A.developLot(lot.lotId, 'field').ok);
  assert.doesNotThrow(() => loadCareer(g.serialize()));
});

test('messages et feuilles : sur une feuille ouverte, les messages attendent (sauf refus et système) ; à la fermeture, les plus récents', async () => {
  const { holdsOnSheet, pickHeld, HOLD_MAX_AGE, MAX_VISIBLE } = await import('../src/ui/toasts.js');
  assert.equal(holdsOnSheet({ kind: 'info' }, 'info'), true);
  assert.equal(holdsOnSheet({ kind: 'achievement', onClick() {} }, 'important'), true);
  assert.equal(holdsOnSheet({ kind: 'error', log: false }, 'always'), false);
  assert.equal(holdsOnSheet({ kind: 'error' }, 'important'), false);
  assert.equal(holdsOnSheet({ kind: 'info', keepTouch: true }, 'always'), false);
  const now = 100000;
  const held = [
    { o: { text: 'vieux' }, at: now - HOLD_MAX_AGE - 1 },
    { o: { text: 'a' }, at: now - 5000 },
    { o: { text: 'b', onClick() {} }, at: now - 4000 },
    { o: { text: 'c' }, at: now - 3000 },
  ];
  const r = pickHeld(held, now);
  assert.equal(r.show.length, MAX_VISIBLE);
  assert.deepEqual(r.show.map((h) => h.o.text), ['b', 'c'], 'celui qui propose une action d\'abord, puis le plus récent (dans l\'ordre d\'arrivée)');
  assert.equal(r.rest, 1, 'le plus vieux (trop ancien) ne compte plus ; « a » est signalé par la pastille');
});
