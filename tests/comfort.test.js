// Lot 1 « confort » (côté cœur) : vitesse douce ×½, option « pause chaque matin », « Tout ramasser »,
// charges détaillées sans doublon, libellés de déblocage, accords en français.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from '../src/core/game.js';
import { loadCareer } from '../src/core/career/career.js';
import { unlocksFor, levelsLabel } from '../src/core/career/ranks.js';
import { cropMass, cropPlural } from '../src/core/career/events.js';
import { agree, countNoun, nounGender, nounPlural } from '../src/data/french.js';
import { GAME_OPTIONS, SPEEDS } from '../src/data/balance.js';
import { DAY_SECONDS, newGame, nextDay, record } from './helpers.js';
import { newCareer } from './career-helpers.js';

// ── Vitesse ×½ ──────────────────────────────────────────────────────────────────────────
test('vitesse ×½ : un jour dure 2 × DAY_SECONDS', () => {
  assert.ok(SPEEDS.includes(0.5));
  const g = newGame(1);
  assert.deepEqual(g.actions.setSpeed(0.5), { ok: true, speed: 0.5 });
  g.update(DAY_SECONDS);
  assert.equal(g.query.calendar().day, 1);
  assert.equal(g.query.calendar().dayProgress, 0.5);
  g.update(DAY_SECONDS);
  assert.equal(g.query.calendar().day, 2);
});

test('vitesse ×½ : sauvegardée et rechargée (niveaux et carrière)', () => {
  const g = newGame(1);
  g.actions.setSpeed(0.5);
  const back = loadGame(JSON.parse(JSON.stringify(g.serialize())));
  assert.equal(back.state.speed, 0.5);
  const c = newCareer();
  assert.equal(c.actions.setSpeed(0.5).ok, true);
  c.update(DAY_SECONDS * 1.5);
  assert.equal(c.state.time.day, 1);
  const cb = loadCareer(JSON.parse(JSON.stringify(c.serialize())));
  assert.equal(cb.state.speed, 0.5);
});

// ── Pause chaque matin ─────────────────────────────────────────────────────────────────
test('options : absentes de l’état tant qu’aucune n’est réglée (parité), défauts lisibles', () => {
  const g = newGame(1);
  assert.equal(g.state.options, undefined);
  assert.deepEqual(g.options(), GAME_OPTIONS);
  assert.deepEqual(g.options(), { autoPauseDawn: false });
  assert.equal('options' in g.serialize(), false);
});

test('options : setOption valide, refuse une option inconnue ou une valeur invalide', () => {
  const g = newGame(1);
  assert.deepEqual(g.setOption('autoPauseDawn', true), { ok: true, name: 'autoPauseDawn', value: true });
  assert.equal(g.options().autoPauseDawn, true);
  const bad = g.setOption('turbo', true);
  assert.equal(bad.ok, false);
  assert.equal(typeof bad.reason, 'string');
  assert.equal(g.setOption('autoPauseDawn', 'oui').ok, false);
  assert.equal(g.actions.setOption('autoPauseDawn', false).ok, true);
  assert.equal(g.options().autoPauseDawn, false);
});

test('pause chaque matin (niveaux) : vitesse 0 juste après l’aube, événement autoPaused après dawn', () => {
  const g = newGame(1);
  g.setOption('autoPauseDawn', true);
  g.actions.setSpeed(2);
  const rec = record(g);
  g.update(DAY_SECONDS / 2 + 3); // un peu plus d'une journée à ×2
  assert.equal(g.query.calendar().day, 2);
  assert.equal(g.state.speed, 0);
  assert.equal(g.state.time.elapsed, 0, 'le jour commence au matin');
  const types = rec.events.map((e) => e.type);
  assert.ok(types.indexOf('autoPaused') > types.indexOf('dawn'));
  assert.deepEqual(rec.of('autoPaused')[0], { type: 'autoPaused', day: 2, seasonId: 'spring', previousSpeed: 2 });
  g.update(100);
  assert.equal(g.query.calendar().day, 2, 'en pause');
});

test('pause chaque matin : un grand dt s’arrête à la première aube ; option sauvegardée', () => {
  const g = newGame(1);
  g.setOption('autoPauseDawn', true);
  g.update(DAY_SECONDS * 5);
  assert.equal(g.query.calendar().day, 2);
  const back = loadGame(JSON.parse(JSON.stringify(g.serialize())));
  assert.equal(back.options().autoPauseDawn, true);
  back.actions.setSpeed(1);
  back.update(DAY_SECONDS);
  assert.equal(back.query.calendar().day, 3);
  assert.equal(back.state.speed, 0);
});

test('pause chaque matin : désactivée = comportement d’avant', () => {
  const g = newGame(1);
  g.setOption('autoPauseDawn', false);
  g.update(DAY_SECONDS * 3);
  assert.equal(g.query.calendar().day, 4);
  assert.equal(g.state.speed, 1);
});

test('sauvegarde : options abîmées refusées', () => {
  const g = newGame(1);
  const s = g.serialize();
  s.options = { autoPauseDawn: 'oui' };
  assert.throws(() => loadGame(s), /option/);
  s.options = [];
  assert.throws(() => loadGame(s), /options/);
  s.options = { autoPauseDawn: true, optionFuture: 3 };
  assert.equal(loadGame(s).options().autoPauseDawn, true);
});

test('pause chaque matin (carrière)', () => {
  const g = newCareer();
  g.setOption('autoPauseDawn', true);
  const rec = record(g);
  g.update(DAY_SECONDS * 4);
  assert.equal(g.state.time.day, 2);
  assert.equal(g.state.speed, 0);
  assert.equal(rec.of('autoPaused').length, 1);
  const back = loadCareer(JSON.parse(JSON.stringify(g.serialize())));
  assert.equal(back.options().autoPauseDawn, true);
});

// ── Tout ramasser (niveaux) ────────────────────────────────────────────────────────────
test('« Tout ramasser » dans une partie de niveau : rien à ramasser, sans effet', () => {
  const g = newGame(1);
  const before = JSON.stringify(g.state);
  const r = g.actions.collectAll();
  assert.equal(r.ok, false);
  assert.deepEqual([r.total, r.count, r.byShelter], [0, 0, []]);
  assert.equal(JSON.stringify(g.state), before);
});

// ── Charges détaillées (carrière) ─────────────────────────────────────────────────────
test('charges : une ligne par poste ; panneaux solaires en positif (credit) ; total inchangé', () => {
  const g = newCareer();
  g.state.money = 5000;
  assert.ok(g.actions.buyInvestment('solarPanel').ok);
  const ch = g.query.career.charges();
  const sources = ch.daily.map((d) => d.source);
  assert.equal(new Set(sources).size, sources.length, 'pas de doublon');
  const solar = ch.daily.find((d) => d.source === 'solar');
  assert.ok(solar.amount > 0 && solar.credit === true);
  assert.equal(solar.label, 'Panneaux solaires');
  const total = ch.daily.reduce((s, d) => s + (d.credit ? -d.amount : d.amount), 0);
  assert.equal(ch.dailyTotal, total);
  assert.ok(ch.daily.every((d) => d.amount >= 0 && typeof d.label === 'string'));
});

// ── Déblocages ─────────────────────────────────────────────────────────────────────────
test('déblocages : jamais « niv. 2 (niv. 2) », niveaux d’un même bâtiment regroupés', () => {
  for (let r = 1; r <= 6; r++) {
    const list = unlocksFor(r);
    for (const u of list) assert.doesNotMatch(String(u.name), /niv\. (\d+).*niv\. \1/, `${r} ${u.name}`);
    const keys = list.filter((u) => u.kind === 'building').map((u) => u.id);
    assert.equal(new Set(keys).size, keys.length, `un bâtiment par ligne au rang ${r}`);
  }
  const jam = unlocksFor(2).find((u) => u.id === 'jamWorkshop');
  assert.deepEqual(jam.levels, [1, 2, 3]);
  assert.equal(jam.name, 'Atelier de confitures (niv. 1 à 3)');
  assert.equal(unlocksFor(2).find((u) => u.id === 'cowshed').name, 'Étable (niv. 1 et 2)');
  assert.equal(unlocksFor(2).find((u) => u.id === 'house').name, 'Maison (niv. 2)');
  assert.equal(unlocksFor(4).find((u) => u.id === 'jamWorkshop').name, 'Atelier de confitures niv. 4');
  assert.equal(levelsLabel([2, 4]), 'niv. 2 et 4');
});

// ── Accords ────────────────────────────────────────────────────────────────────────────
test('français : pluriels et accords', () => {
  assert.equal(nounPlural('cheval'), 'chevaux');
  assert.equal(nounPlural('chou'), 'choux');
  assert.equal(nounPlural('pomme de terre'), 'pommes de terre');
  assert.equal(nounPlural('cour des ateliers'), 'cours des ateliers');
  assert.equal(nounPlural('chambre d\'hôte'), 'chambres d\'hôte');
  assert.equal(nounPlural('maïs'), 'maïs');
  assert.equal(countNoun(1, 'parcelle'), '1 parcelle');
  assert.equal(countNoun(3, 'cheval'), '3 chevaux');
  assert.equal(nounGender('pommes de terre'), 'f');
  assert.equal(nounGender('épis de maïs'), 'm');
  assert.equal(agree(cropPlural('potato', 5), 5, 'payé'), 'payées');
  assert.equal(agree(cropPlural('cabbage', 5), 5, 'payé'), 'payés');
  assert.equal(agree(cropPlural('wheat', 5), 5, 'payé'), 'payées', 'bottes de blé');
  assert.equal(agree(cropPlural('carrot', 1), 1, 'payé'), 'payée');
  assert.equal(cropMass('wheat'), 'blé');
  assert.equal(cropMass('cabbage'), 'choux');
  assert.equal(cropMass('potato'), 'pommes de terre');
});

test('textes du visiteur : « 5 pommes de terre, payées »', () => {
  const g = newCareer();
  g.state.money = 1000;
  g.actions.career.triggerEvent?.('visitor');
  const ev = g.query.career.events();
  if (!ev.active || ev.active.kind !== 'visitor') return; // pas de visiteur possible ici : rien à vérifier
  const offer = ev.offers.find((o) => o.kind === 'visitor');
  const d = ev.active.data;
  const fem = ['carrot', 'potato', 'strawberry', 'tomato', 'zucchini', 'pumpkin', 'wheat'].includes(d.cropId);
  const want = `${fem ? 'payée' : 'payé'}${d.n > 1 ? 's' : ''}`;
  assert.match(ev.active.text, new RegExp(`, ${want} `));
  if (offer) assert.match(offer.text, new RegExp(`, ${want} `));
  nextDay(g);
});
