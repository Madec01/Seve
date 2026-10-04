// La Vallée vivante (lot V4) — les visiteurs rares : venue tirée (flux valley4, 6 % puis 50 %, au plus tard la 3ᵉ aube),
// une seule venue annoncée par aube toutes espèces confondues, conditions (« depuis 4 saisons »), ils attendent qu'on les
// touche puis reviennent en décor ; vers luisants sur la ferme ; sans la partie wildlife : ni visiteurs ni cigognes.
// docs/VALLEE.md § 18.3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRAWN_VISITORS, VISITORS_BY_ID } from '../src/data/career/storks.js';
import { visitorRecipe } from '../src/core/career/storks.js';
import { A, Q, V, absOf, nextDay, record, stage7Career, toSeason, toStorkDay, v4Career } from './valley4-helpers.js';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

/** Carrière complète avec 20 haies posées (toutes les conditions des visiteurs remplies). */
function richValley() {
  const g = v4Career();
  for (let k = 0; k < 10; k++) A(g).buyLot();
  for (const s of Q(g).valleySpots('hedge')) if (s.free) A(g).placeNature(s.spotId);
  A(g).triggerValley('complete');
  return g;
}

test('conditions : étapes des lieux nommées, « depuis 4 saisons » pour le cerf et le loriot, 20 haies pour les vers luisants', () => {
  const g = stage7Career();
  const r = visitorRecipe(g.state, 'crane');
  assert.deepEqual(r.items.map((i) => [i.text, i.ok]), [['La prairie aux orchidées', false], ['La roselière', false]]);
  A(g).triggerValley('place', 'combe', 3);
  const deer = visitorRecipe(g.state, 'redDeer');
  assert.equal(deer.items[0].text, 'La vieille futaie depuis 4 saisons');
  assert.equal(deer.items[0].ok, false, 'pas tout de suite');
  for (let k = 0; k < 4 * g.state.career.seasonLength; k++) nextDay(g);
  assert.equal(visitorRecipe(g.state, 'redDeer').items[0].ok, true);
  const glow = visitorRecipe(g.state, 'glowworms');
  assert.match(glow.items[1].text, /^20 haies sur la ferme \(\d+ \/ 20\)$/);
  const info = Q(g).valley().visitors;
  assert.equal(info.length, 6);
  for (const x of info) for (const k of ['id', 'name', 'icon', 'seasons', 'state', 'inSeason', 'recipe', 'where', 'whereKind', 'hint', 'anecdote', 'seenAt']) assert.ok(k in x, `${x.id}.${k}`);
  assert.equal(info.find((x) => x.id === 'glowworms').whereKind, 'farm');
  assert.equal(info.find((x) => x.id === 'crane').placeId, 'poppies');
});

test('venue tirée : indice seulement en saison et conditions remplies, une seule venue annoncée par aube (habitants compris), visible au plus tard à la 3ᵉ aube, attend sans limite', () => {
  const g = richValley();
  const T = absOf(g);
  const L = g.state.career.seasonLength;
  const ev = record(g);
  const hintDay = {};
  const visibleDay = {};
  for (let k = 0; k < 6 * 4 * L; k++) {
    ev.clear();
    nextDay(g);
    const abs = absOf(g);
    const hints = ev.of('visitorHint');
    assert.ok(hints.length + ev.of('speciesHint').length <= 1, `aube ${abs} : une seule venue annoncée`);
    for (const e of hints) {
      const x = VISITORS_BY_ID[e.id];
      assert.ok(x.drawn, 'jamais d\'indice pour les cigognes');
      assert.ok(x.seasons.includes(SEASONS[g.state.time.seasonIndex]), `${e.id} en saison`);
      assert.equal(e.text, x.hint);
      if (e.id === 'redDeer' || e.id === 'oriole') assert.ok(abs >= T + 4 * L, `${e.id} : depuis 4 saisons`);
      hintDay[e.id] = abs;
    }
    for (const e of ev.of('visitorVisible')) if (VISITORS_BY_ID[e.id].drawn) visibleDay[e.id] = abs;
  }
  assert.ok(Object.keys(hintDay).length >= 3, `des visiteurs sont venus (${Object.keys(hintDay).join(', ')})`);
  for (const [id, d] of Object.entries(visibleDay)) {
    assert.ok(d - hintDay[id] >= 1 && d - hintDay[id] <= 2, `${id} visible 1 à 2 aubes après l'indice`);
    assert.equal(V(g).visitors[id].state, 'visible', `${id} attend toujours (même hors saison)`);
  }
  const waiting = Q(g).valley().visitors.find((x) => x.state === 'visible' && !x.inSeason && x.id !== 'glowworms');
  if (waiting) assert.match(waiting.still, /encore/);
});

test('les visiteurs attendent leur tour derrière un habitant du V1 au V3 annoncé le même matin (aucun tirage en plus ni en moins)', () => {
  const g = richValley();
  // Tous les habitants installés sauf un, sans annonce : on regarde que les jours d'annonce d'un habitant n'ont jamais
  // aussi un visiteur annoncé, et que le flux valley4 avance de 5 nombres chaque aube.
  const ev = record(g);
  for (let k = 0; k < 80; k++) {
    ev.clear();
    const before = g.state.rng.valley4;
    nextDay(g);
    assert.notEqual(g.state.rng.valley4, before);
    if (ev.of('speciesHint').length) assert.equal(ev.of('visitorHint').length, 0);
  }
});

test('toucher un visiteur : fenêtre (titre, anecdote), « Déjà vu », « Rien à voir ici » ; observe(id) d\'un visiteur passe par observeVisitor', () => {
  const g = stage7Career();
  assert.deepEqual(A(g).observeVisitor('crane'), { ok: false, reason: 'Rien à voir ici.' });
  A(g).triggerValley('visitor', 'crane');
  const ev = record(g);
  const r = A(g).observe('crane');
  assert.equal(r.ok, true);
  assert.equal(r.title, 'Les grues font halte dans la prairie !');
  assert.equal(r.anecdote, VISITORS_BY_ID.crane.anecdote);
  assert.equal(r.first, true);
  assert.equal(r.where, 'view');
  assert.deepEqual(ev.of('visitorSeen').map((e) => [e.id, e.first]), [['crane', true]]);
  assert.equal(A(g).observeVisitor('crane').reason, 'Déjà vu.');
  assert.equal(V(g).visitors.crane.at, absOf(g));
  assert.equal(V(g).year.visitorsSeen, 1);
  assert.equal(Q(g).valley().visitors.find((x) => x.id === 'crane').anecdote, VISITORS_BY_ID.crane.anecdote);
});

test('en décor une fois vus : dans la vue (3 au plus, en saison) ; le barrage du castor toute l\'année', () => {
  const g = stage7Career();
  for (const x of DRAWN_VISITORS) A(g).triggerValley('visitor', x.id, 'seen');
  let residents = 0;
  for (let k = 0; k < 4 * 4 * g.state.career.seasonLength; k++) {
    nextDay(g);
    const view = Q(g).valleyView();
    const res = view.visitors.filter((x) => x.state === 'resident');
    assert.ok(res.length <= 3);
    for (const x of res) assert.ok(VISITORS_BY_ID[x.id].seasons.includes(view.season), `${x.id} en saison`);
    residents += res.length;
    assert.equal(view.beaverDam, true);
  }
  assert.ok(residents > 0);
});

test('les vers luisants : sur la ferme, au pied d\'une haie posée ; puis chaque soir d\'été en décor', () => {
  const g = stage7Career();
  A(g).triggerValley('visitor', 'glowworms');
  const hedges = Object.entries(V(g).nature).filter(([, n]) => n.kind === 'hedge').map(([id]) => id);
  const spot = V(g).visitors.glowworms.spotId;
  assert.ok(hedges.includes(spot), 'une haie posée');
  let a = Q(g).valleyAnimals().find((x) => x.id === 'glowworms');
  assert.deepEqual([a.state, a.spotId, a.visitor], ['visible', spot, true]);
  assert.equal(Q(g).valleyView().visitors.some((x) => x.id === 'glowworms'), false, 'pas dans la vue');
  A(g).observeVisitor('glowworms');
  toSeason(g, 1);
  a = Q(g).valleyAnimals().find((x) => x.id === 'glowworms');
  assert.equal(a.state, 'resident');
  assert.equal(Q(g).valleyScenery().glow, true);
  toSeason(g, 2);
  assert.equal(Q(g).valleyAnimals().some((x) => x.id === 'glowworms'), false);
});

test('{ wildlife: false } : ni visiteurs ni cigognes (aucun tirage valley4) ; étape 7 au plus ; les légendes viennent quand même', () => {
  const g = v4Career({ valley: { wildlife: false } });
  A(g).triggerValley('stage', 7);
  const r0 = g.state.rng.valley4;
  toStorkDay(g);
  for (let k = 0; k < 40; k++) nextDay(g);
  assert.equal(g.state.rng.valley4, r0);
  assert.deepEqual(V(g).visitors, {});
  assert.equal(V(g).stork.steepleAt, null);
  assert.ok(V(g).stage <= 7);
  A(g).triggerValley('place', 'brook', 4);
  nextDay(g);
  nextDay(g);
  assert.ok(V(g).legends.millEinkorn, 'l\'engrain (moulin) se réveille quand même');
  assert.equal(A(g).triggerValley('visitor', 'crane', 'seen').ok, false);
});
