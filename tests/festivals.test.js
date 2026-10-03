// Lot 4 — C6 : fêtes participatives des niveaux (chasse aux œufs, soupe partagée, stand de la ferme, paniers de Noël).
// Règles : docs/GAME_DESIGN.md § 17.4 ; contrat : docs/ARCHITECTURE.md, « Lot 4 — contrats ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { FETE_REWARDS, FETES } from '../src/data/cozy.js';
import { CLIENTS_BY_ID } from '../src/data/variety.js';
import { nextDay, record, rich } from './helpers.js';

/** Partie Détente (lot 4 actif), 1er jour ensoleillé. */
function detente(levelId = 2, seed = 4, opts = {}) {
  const g = createGame({ levelId, seed, difficulty: 'detente', ...opts });
  g.state.weather.today = 'sunny';
  return g;
}

/** Va au jour `day` de l'année (journée commencée). */
function goTo(g, day, weather = 'sunny') {
  while (g.state.time.day < day && g.state.status === 'playing') nextDay(g, weather);
}

/** Note des cultures « produites cette année » (sans jouer les récoltes). */
function produced(g, crops = {}, extra = {}) {
  const y = g.state.cozy.year;
  Object.assign(y.produced.crops, crops);
  Object.assign(y.produced.products, extra.products || {});
  Object.assign(y.produced.animal, extra.animal || {});
  Object.assign(y.fine, extra.fine || {});
  Object.assign(y.gold, extra.gold || {});
  Object.assign(y.giants, extra.giants || {});
}

test('calendrier des niveaux : printemps j. 3 (sauf niveau 1), été j. 4, automne j. 2, hiver j. 4 ; veille annoncée', () => {
  const g = detente(2, 4);
  const ev = record(g);
  goTo(g, 28);
  const started = ev.of('feteStarted').map((e) => [e.fete.id, e.fete.engine]);
  assert.deepEqual(started, [['springFete', 'chasse'], ['villageFete', 'marmite'], ['harvestFestival', 'etal'], ['christmasMarket', 'paniers']]);
  const soon = ev.of('feteSoon').map((e) => e.id);
  assert.deepEqual(soon, ['springFete', 'villageFete', 'harvestFestival', 'christmasMarket']);
  assert.equal(ev.of('feteEnded').length, 4);
  // Niveau 1 : pas de fête au printemps (tutoriel) ; la première fête est en été.
  const t = detente(1, 4);
  const ev1 = record(t);
  goTo(t, 12);
  assert.deepEqual(ev1.of('feteStarted').map((e) => e.fete.id), ['villageFete']);
  assert.ok(FETES.find((f) => f.id === 'springFete').levels.every((id) => id >= 2));
});

test('Classique : aucune clé state.cozy, aucun événement du lot, aucune requête (sauf weather du contexte)', () => {
  const g = createGame({ levelId: 2, seed: 4, difficulty: 'classique' });
  const ev = record(g);
  goTo(g, 28);
  assert.equal('cozy' in g.state, false);
  assert.equal(g.state.rng.cozy, undefined);
  assert.equal(g.cozy, false);
  for (const t of ['feteSoon', 'feteStarted', 'feteEnded', 'winterFind', 'lanternsLit', 'feederBird', 'storyReady']) assert.equal(ev.of(t).length, 0, t);
  assert.equal(g.query.cozy(), null);
  assert.equal(g.query.fete(), null);
  assert.equal(g.query.winter(), null);
  assert.equal(g.query.lanterns(), null);
  assert.equal(g.actions.feteFind(0).ok, false);
  assert.equal(g.query.achievementContext().weather, g.state.weather.today);
  assert.equal(g.query.achievementContext().cozy, undefined);
  assert.equal(g.query.summary().cozy, undefined);
});

test('les autres flux aléatoires ne bougent pas : même météo et même marché, lot 4 actif ou non', () => {
  const on = detente(6, 9);
  const off = detente(6, 9, { cozy: false });
  const days = [];
  for (let d = 0; d < 27; d++) {
    days.push([on.state.weather.today, off.state.weather.today, JSON.stringify(on.state.market) === JSON.stringify(off.state.market)]);
    on.update(20);
    off.update(20);
  }
  for (const [a, b, m] of days) {
    assert.equal(a, b);
    assert.ok(m);
  }
  for (const k of ['weather', 'market', 'rot', 'quality', 'surprise', 'sky', 'orders', 'variety']) assert.equal(on.state.rng[k], off.state.rng[k], k);
});

test('chasse aux œufs : 8 œufs (un doré), trouvés par le joueur (2 / 6 pièces), le soir par Lili (1 / 3) ; 8 trouvés : feteDone + 1 écu', () => {
  const g = detente(2, 4);
  goTo(g, 3);
  const f = g.query.fete();
  assert.equal(f.engine, 'chasse');
  assert.equal(f.hidden.kind, 'egg');
  assert.equal(f.hidden.items.length, 8);
  assert.equal(f.hidden.items.filter((h) => h.gold).length, 1);
  assert.ok(f.hidden.items.every((h) => h.u >= 0 && h.u < 1 && h.found === null));
  const ev = record(g);
  const money = g.state.money;
  const gold = f.hidden.items.find((h) => h.gold).index;
  const normal = f.hidden.items.find((h) => !h.gold).index;
  const r1 = g.actions.feteFind(normal);
  assert.deepEqual([r1.ok, r1.gold, r1.amount, r1.found, r1.total], [true, false, FETE_REWARDS.chasse.found, 1, 8]);
  assert.equal(g.actions.feteFind(normal).reason, 'Déjà trouvé !');
  assert.equal(g.actions.feteFind(99).reason, 'Objet inconnu.');
  const r2 = g.actions.feteFind(gold);
  assert.equal(r2.amount, FETE_REWARDS.chasse.foundGold);
  assert.equal(g.state.money, money + 2 + 6);
  assert.equal(ev.of('feteFound').length, 2);
  // Le soir : les 6 restants trouvés par le village (1 pièce chacun).
  const before = g.state.money;
  nextDay(g);
  const ended = ev.of('feteEnded')[0];
  assert.deepEqual(ended.helped, { n: 6, amount: 6 });
  assert.match(ended.text, /Lili/);
  assert.ok(g.state.money >= before + 6 - 50); // (charges du jour)
  assert.equal(g.query.fete(), null, 'la fête est finie à l\'aube suivante');
  assert.equal(g.state.stats.year.cozyIncome, 14);
  // Tout trouver soi-même : feteDone avec 1 écu, tampon 🏅.
  const h = detente(3, 8);
  goTo(h, 3);
  const evh = record(h);
  for (const it of h.query.fete().hidden.items) h.actions.feteFind(it.index);
  const done = evh.of('feteDone')[0];
  assert.equal(done.ecus, FETE_REWARDS.chasse.allEcus);
  assert.equal(h.state.cozy.stats.eggsAll, 1);
  assert.equal(h.state.cozy.stats.best.eggHunt, 1);
  assert.equal(h.state.cozy.stats.fetes.eggHunt, 1);
});

test('chasse : 9 tirages du flux cozy, déterministe à graine égale', () => {
  const a = detente(4, 12);
  const b = detente(4, 12);
  goTo(a, 3);
  goTo(b, 3);
  assert.deepEqual(a.query.fete().hidden, b.query.fete().hidden);
  assert.equal(a.state.rng.cozy, b.state.rng.cozy);
});

test('soupe partagée : 1 louche toujours, 2 avec 2 légumes, 3 avec 3 dont un beau ; refus doux ; une seule soupe', () => {
  const g = detente(2, 4);
  goTo(g, 11);
  assert.equal(g.query.fete().engine, 'marmite');
  assert.equal(g.actions.cookSoup([{ kind: 'crop', id: 'carrot' }]).reason, 'Carotte : pas récoltée cette année.');
  produced(g, { carrot: 2, turnip: 1, wheat: 1, tomato: 1, strawberry: 1 });
  assert.equal(g.actions.cookSoup([{ kind: 'crop', id: 'strawberry' }]).reason, 'Fraise : pas dans cette soupe.');
  assert.equal(g.actions.cookSoup([]).reason, 'De 1 à 3 légumes différents.');
  assert.equal(g.actions.cookSoup([{ kind: 'crop', id: 'carrot' }, { kind: 'crop', id: 'carrot' }]).reason, 'De 1 à 3 légumes différents.');
  const choices = g.query.fete().choices.map((c) => c.id).sort();
  assert.deepEqual(choices, ['carrot', 'tomato', 'turnip', 'wheat'], 'les fruits ne vont pas dans la soupe');
  // Aperçu en direct : 3 légumes ordinaires → 2 louches (avec les surprises, il en faut un beau).
  const three = [{ kind: 'crop', id: 'carrot' }, { kind: 'crop', id: 'turnip' }, { kind: 'crop', id: 'wheat' }];
  assert.equal(g.query.fetePreview(three).ladles, 2);
  produced(g, {}, { fine: { wheat: 1 } });
  assert.equal(g.query.fetePreview(three).ladles, 3);
  const r = g.actions.cookSoup(three);
  assert.deepEqual([r.ok, r.ladles, r.amount, r.ecus], [true, 3, FETE_REWARDS.marmite.coins[2], 3]);
  assert.equal(g.actions.cookSoup(three).reason, 'Déjà goûtée : merci !');
  assert.equal(g.state.cozy.stats.ladles3, 1);
  // Pas venu : le soir, un bol gardé, aucune pièce.
  const h = detente(2, 4);
  goTo(h, 11);
  const ev = record(h);
  nextDay(h);
  assert.deepEqual(ev.of('feteEnded')[0].helped, { n: 0, amount: 0 });
  assert.match(ev.of('feteEnded')[0].text, /bol/);
});

test('stand de la ferme : 1 point par cagette, belle +1, dorée +2, géant +2, fait maison +1 ; rubans vert / bleu (8) / or (12)', () => {
  const g = detente(9, 4);
  goTo(g, 16);
  assert.equal(g.query.fete().engine, 'etal');
  produced(g, { carrot: 1, pumpkin: 1, strawberry: 1, apple: 1, tomato: 1 }, { products: { strawberryJam: 1 }, animal: { eggs: 2 }, gold: { pumpkin: 1, apple: 1 }, fine: { tomato: 1 }, giants: { pumpkin: 1 } });
  const items = [{ kind: 'crop', id: 'pumpkin' }, { kind: 'crop', id: 'apple' }, { kind: 'product', id: 'strawberryJam' }, { kind: 'crop', id: 'tomato' }, { kind: 'animal', id: 'eggs' }];
  const p = g.query.fetePreview(items);
  // citrouille 1 + 2 (dorée) + 2 (géant) = 5 ; pomme 1 + 2 = 3 ; confiture 1 + 1 = 2 ; tomate 1 + 1 = 2 ; œufs 1.
  assert.equal(p.score, 13);
  assert.equal(p.ribbon, 'gold');
  assert.equal(g.actions.presentStand([...items, { kind: 'crop', id: 'carrot' }]).reason, 'De 1 à 5 produits différents.');
  assert.equal(g.actions.presentStand([{ kind: 'crop', id: 'corn' }]).reason, 'Maïs : pas produit cette année.');
  const r = g.actions.presentStand(items);
  assert.deepEqual([r.score, r.ribbon, r.amount, r.ecus], [13, 'gold', FETE_REWARDS.etal.coins.gold, FETE_REWARDS.etal.ecus.gold]);
  assert.equal(g.actions.presentStand(items).reason, 'Déjà présenté : bravo !');
  assert.equal(g.state.cozy.stats.ribbons.gold, 1);
  assert.equal(g.state.cozy.stats.best.stand, 1);
  // 5 légumes ordinaires = 5 points : ruban vert.
  const h = detente(9, 5);
  goTo(h, 16);
  produced(h, { carrot: 1, turnip: 1, wheat: 1, cabbage: 1, potato: 1 });
  const v = h.actions.presentStand(['carrot', 'turnip', 'wheat', 'cabbage', 'potato'].map((id) => ({ kind: 'crop', id })));
  assert.deepEqual([v.score, v.ribbon, v.ecus], [5, 'green', 0]);
});

test('paniers de Noël : 3 villageois tirés (flux cozy), ♥ pour chaque produit aimé ; 3 + 3 par ♥ par panier ; un même produit une fois', () => {
  const g = detente(2, 4);
  goTo(g, 25);
  const f = g.query.fete();
  assert.equal(f.engine, 'paniers');
  assert.equal(f.villagers.length, 3);
  assert.equal(new Set(f.villagers.map((v) => v.clientId)).size, 3);
  const [a, b, c] = f.villagers.map((v) => v.clientId);
  const like = (id) => CLIENTS_BY_ID[id].favorites[0];
  produced(g, { [like(a)]: 1, [like(b)]: 1, [like(c)]: 1, cabbage: 1, turnip: 1, carrot: 1, wheat: 1 });
  const items = [like(a), like(b), like(c)];
  const baskets = items.map((id) => [{ kind: 'crop', id }]);
  if (new Set(items).size < 3) return; // deux villageois aiment la même culture : un autre test le couvre
  assert.equal(g.actions.giveBaskets([[{ kind: 'crop', id: items[0] }], [{ kind: 'crop', id: items[0] }], baskets[2]]).reason, 'Un même produit une seule fois.');
  assert.equal(g.actions.giveBaskets([[], baskets[1], baskets[2]]).reason, 'Un produit au moins dans chaque panier.');
  const r = g.actions.giveBaskets(baskets);
  assert.equal(r.hearts, 3);
  assert.deepEqual(r.perBasket, [1, 1, 1]);
  assert.equal(r.amount, 3 * FETE_REWARDS.paniers.perBasket + 3 * FETE_REWARDS.paniers.perHeart);
  assert.equal(r.ecus, 3);
  assert.equal(g.state.cozy.year.hearts, 3);
  assert.equal(g.actions.giveBaskets(baskets).reason, 'Déjà offerts : merci !');
});

test('pas de fête : refus ; fête un jour quelconque par le débogage (triggerCozy)', () => {
  const g = detente(4, 3);
  assert.equal(g.actions.cookSoup([{ kind: 'crop', id: 'carrot' }]).reason, 'Pas de soupe aujourd\'hui.');
  assert.equal(g.actions.feteFind(0).reason, 'Pas de chasse aujourd\'hui.');
  assert.equal(g.actions.buySeedPack('carrot').reason, 'La foire aux graines n\'est pas aujourd\'hui.');
  const r = g.actions.triggerCozy('fete', 'harvestFestival');
  assert.ok(r.ok);
  assert.equal(g.query.fete().engine, 'etal');
  assert.equal(g.actions.triggerCozy('fete', 'seedFair').ok, false, 'la foire aux graines est propre à la carrière');
  rich(g);
});

test('fêtes : pièces dans le bilan (cozyIncome, compté dans summary.net), voisinage des lanternes (+2 par fête jouée)', () => {
  const g = detente(2, 4);
  goTo(g, 3);
  const before = g.query.lanterns().criteria.find((c) => c.id === 'neighbours').value;
  g.actions.feteFind(g.query.fete().hidden.items[0].index);
  const after = g.query.lanterns().criteria.find((c) => c.id === 'neighbours').value;
  assert.equal(after, before + 2);
  const s = g.query.summary();
  assert.equal(s.cozyIncome, FETE_REWARDS.chasse.found + (g.query.fete().hidden.items[0].gold ? 4 : 0));
  assert.ok(s.cozy && s.cozy.year && s.cozy.stats);
});

test('résultats des fêtes pour l\'interface : phrase (text), cœurs par panier, détail du stand nommé ; accords des refus', () => {
  // Stand : texte du villageois et détail avec nom et icône dans query.fete().result.
  const g = detente(9, 4);
  goTo(g, 16);
  produced(g, { carrot: 1 }, { animal: { eggs: 1 } });
  assert.equal(g.actions.presentStand([{ kind: 'animal', id: 'eggs' }, { kind: 'crop', id: 'corn' }]).reason, 'Maïs : pas produit cette année.');
  assert.equal(g.actions.presentStand([{ kind: 'product', id: 'strawberryJam' }]).reason, 'Confiture de fraises : pas produite cette année.');
  const r = g.actions.presentStand([{ kind: 'crop', id: 'carrot' }, { kind: 'animal', id: 'eggs' }]);
  assert.equal(r.text, 'Les enfants ont adoré votre stand !');
  const res = g.query.fete().result;
  assert.equal(res.text, r.text);
  assert.deepEqual(res.detail.map((d) => [d.item.id, typeof d.item.name, d.points]), [['carrot', 'string', 1], ['eggs', 'string', 1]]);
  // Soupe : la phrase des villageois est gardée dans le résultat.
  const s = detente(2, 4);
  goTo(s, 11);
  produced(s, { carrot: 1, turnip: 1 });
  const sr = s.actions.cookSoup([{ kind: 'crop', id: 'carrot' }, { kind: 'crop', id: 'turnip' }]);
  assert.equal(s.query.fete().result.text, sr.text);
  assert.equal(sr.text, 'Un régal !');
  // Paniers : cœurs par panier et phrase dans le résultat.
  const p = detente(2, 4);
  goTo(p, 25);
  const f = p.query.fete();
  const like = (id) => CLIENTS_BY_ID[id].favorites[0];
  const ids = f.villagers.map((v) => like(v.clientId));
  produced(p, Object.fromEntries([...ids, 'cabbage', 'turnip', 'carrot'].map((id) => [id, 1])));
  const pool = [...new Set([...ids, 'cabbage', 'turnip', 'carrot'])].slice(0, 3);
  const pr = p.actions.giveBaskets(pool.map((id) => [{ kind: 'crop', id }]));
  assert.ok(pr.ok);
  assert.deepEqual(p.query.fete().result.perBasket, pr.perBasket);
  assert.equal(p.query.fete().result.text, pr.text);
  // Chasse des grenouilles (thème) : textes au féminin ; le soir, « les N dernières grenouilles ».
  const c = detente(4, 3);
  c.actions.triggerCozy('fete', 'springFete');
  c.state.cozy.fete.themeId = 'frogs';
  const rules = c.query.fete().rules.join(' ');
  assert.match(rules, /grenouilles cachées/);
  const ev = record(c);
  nextDay(c);
  assert.match(ev.of('feteEnded')[0].text, /les 8 dernières grenouilles/);
});

test('paniers de Noël : une ferme qui n\'a produit que 2 choses offre quand même 2 paniers (le 3ᵉ reste vide, sans reproche)', () => {
  const g = detente(2, 4);
  goTo(g, 25);
  assert.equal(g.actions.giveBaskets([[], [], []]).reason, 'Récoltez ou produisez quelque chose, et revenez faire les paniers !');
  produced(g, { carrot: 1, corn: 1 });
  assert.equal(g.actions.giveBaskets([[{ kind: 'crop', id: 'carrot' }], [], []]).reason, '2 paniers garnis au moins.');
  const r = g.actions.giveBaskets([[{ kind: 'crop', id: 'carrot' }], [{ kind: 'crop', id: 'corn' }], []]);
  assert.ok(r.ok);
  assert.equal(r.perBasket.length, 3);
  assert.equal(r.perBasket[2], 0);
  assert.equal(r.amount, 2 * FETE_REWARDS.paniers.perBasket + r.hearts * FETE_REWARDS.paniers.perHeart);
});
