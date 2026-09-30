// Mode Carrière — quêtes et amitié de Joseph (CORE-C) : quête au début d'une saison (rang ≥ 2 ; rythme et délais :
// career-quest-pace.test.js), accepter, refuser, récoltes mises de côté, livraison du grenier, échéance,
// récompenses (argent, écus, ♥), paliers
// d'amitié (cadeaux, prêt × 2, prêt sans supplément, verger de Joseph, charrette), cœur du prêt remboursé et
// de la fête des récoltes, sauvegarde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, loadCareer, checkCareerState } from '../src/core/career/career.js';
import { getCrop } from '../src/data/crops.js';
import { LOT_PRICES } from '../src/data/career/lots.js';
import { JOSEPH_LINES, MAX_HEARTS, QUEST_TEMPLATES } from '../src/data/career/quests.js';
import { addHeart } from '../src/core/career/quests.js';
import { checkAchievements, defaultProgress } from '../src/core/progression.js';
import { goTo, newCareer, nextDay, record, setRank, skipYear, withExtension } from './career-helpers.js';

const L = 7;
const dayOf = (seasonIndex, d) => seasonIndex * L + d;

function ripen(g, i, cropId) {
  const p = g.state.plots[i];
  p.cropId = cropId;
  p.growth = getCrop(cropId).growDays;
}

/** Quête « crop » contrôlée (remplace la quête tirée). */
function forceCropQuest(g, cropId, n = 3) {
  const q = g.state.career.quest;
  const value = getCrop(cropId).sellPrice * 1.25 * n;
  Object.assign(q, { templateId: 'crop', type: 'crop', need: { type: 'crop', id: cropId, n }, progress: 0, accepted: false, value, what: cropId, text: 'test', reward: { money: Math.round(value * 1.5), ecus: 3, hearts: 1 } });
  return q;
}

/** Donne un accès à `api` (extension de test). */
function withApi(fn) {
  const ext = withExtension({});
  try {
    const g = newCareer();
    return fn(g, ext.api());
  } finally {
    ext.off();
  }
}

test('pas de quête au rang 1 ; au rang 2 une quête proposée au début d\'une saison', () => {
  const g = newCareer();
  const ev = record(g);
  goTo(g, 1, dayOf(1, 1));
  assert.equal(g.state.career.quest, null);
  assert.equal(g.query.career.quest(), null);
  setRank(g, 2);
  goTo(g, 1, dayOf(2, 1));
  const offered = ev.of('questOffered')[0];
  assert.ok(offered, 'quête proposée');
  const q = g.query.career.quest();
  assert.equal(q.accepted, false);
  assert.ok(q.daysLeft >= 2 * L, 'délai en acceptant aujourd\'hui : au moins 2 saisons');
  assert.equal(q.offerDaysLeft, 2 * L - 1, 'la proposition attend jusqu\'à la fin de la saison suivante');
  assert.ok(QUEST_TEMPLATES.some((t) => t.id === q.templateId));
  assert.ok(q.need.n >= 1);
  assert.ok(q.reward.money > 0);
  assert.equal(q.reward.ecus, 3);
  assert.equal(q.reward.hearts, 1);
  assert.ok(q.text.length > 10);
  assert.equal(offered.line, JOSEPH_LINES.questOffer);
});

test('accepter, récoltes mises de côté « → Joseph », récompense : 1,5 × valeur, 3 écus, +1 ♥, quêtes réussies', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 1));
  forceCropQuest(g, 'potato', 3);
  const ev = record(g);
  // Avant d'accepter : la récolte est vendue.
  ripen(g, 0, 'potato');
  assert.ok(g.actions.harvest(0).amount > 0);
  const acc = g.actions.career.acceptQuest();
  assert.ok(acc.ok);
  assert.equal(acc.line, JOSEPH_LINES.questAccepted.replace('{deadline}', acc.quest.deadline));
  assert.match(acc.line, /jusqu'à la fin de l'hiver/);
  assert.equal(g.actions.career.acceptQuest().ok, false);
  const money0 = g.state.money;
  for (let i = 0; i < 3; i++) {
    ripen(g, i, 'potato');
    assert.equal(g.actions.harvest(i).amount, 0);
  }
  assert.equal(ev.of('harvested').at(-1).diverted, '→ Joseph');
  const done = ev.of('questDone')[0];
  assert.ok(done);
  const reward = Math.round(16 * 1.25 * 3 * 1.5);
  assert.equal(done.amount, reward);
  assert.equal(done.ecus, 3);
  assert.equal(g.state.money - money0, reward);
  assert.equal(g.state.career.quest, null);
  assert.equal(g.state.career.joseph.hearts, 1);
  assert.equal(g.state.career.joseph.questsDone, 1);
  assert.equal(g.state.career.lifetime.questsDone, 1);
  assert.equal(ev.of('josephHeart')[0].hearts, 1);
  assert.equal(g.state.career.yearStats.incomeBy.quests, reward);
  // Objectif du rang 4 « Réussir 3 quêtes ».
  setRank(g, 3);
  assert.equal(g.query.career.summary().nextRank.objectives.find((o) => o.id === 'quests3').progress, 1);
  // Bilan de l'année : écus des quêtes à verser.
  const ev2 = record(g);
  skipYear(g);
  const rep = ev2.of('yearEnd')[0].report;
  assert.equal(rep.questEcus, 3);
  assert.equal(rep.joseph.questsDone, 1);
});

test('refuser : « Pas grave, une autre fois ! » ; rien d\'autre ne change', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 1));
  const money = g.state.money;
  const r = g.actions.career.declineQuest();
  assert.ok(r.ok);
  assert.equal(r.line, 'Pas grave, une autre fois !');
  assert.equal(g.state.career.quest, null);
  assert.equal(g.state.career.joseph.hearts, 0);
  assert.equal(g.state.money, money);
  assert.equal(g.actions.career.declineQuest().ok, false);
});

test('échéance : le soir du dernier jour du délai ; les récoltes mises de côté sont payées au prix normal ; aucune pénalité', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 1));
  forceCropQuest(g, 'potato', 5);
  g.actions.career.acceptQuest();
  ripen(g, 0, 'potato');
  g.actions.harvest(0);
  assert.equal(g.query.career.quest().progress, 1);
  const end = g.state.career.quest.endDay;
  assert.equal(end, 4 * L, 'fin de l\'hiver (au moins 2 saisons de jours)');
  const ev = record(g);
  goTo(g, 1, end);
  assert.equal(ev.of('questExpired').length, 0, 'encore valable le dernier jour');
  const hearts = g.state.career.joseph.hearts; // (+1 ♥ à la fête des récoltes : quête en cours)
  nextDay(g);
  const exp = ev.of('questExpired')[0];
  assert.ok(exp);
  assert.equal(exp.amount, Math.round(16 * 1.25));
  assert.equal(exp.line, JOSEPH_LINES.questExpired);
  assert.equal(g.state.career.joseph.hearts, hearts, 'Joseph reste ami : pas de cœur perdu');
});

test('livrer depuis le grenier', () => {
  const g = newCareer();
  setRank(g, 2);
  g.state.money = 5000;
  assert.ok(g.actions.career.upgradeBuilding('storage').ok);
  goTo(g, 1, dayOf(1, 1));
  forceCropQuest(g, 'tomato', 4);
  assert.equal(g.query.career.quest().canDeliver, false);
  g.state.career.stock = { tomato: 2, wheat: 3 };
  assert.equal(g.query.career.quest().canDeliver, true);
  let r = g.actions.career.deliverQuest();
  assert.ok(r.ok);
  assert.equal(r.delivered, 2);
  assert.equal(g.query.career.quest().accepted, true);
  assert.equal(g.query.career.quest().progress, 2);
  assert.deepEqual(g.state.career.stock, { wheat: 3 });
  assert.equal(g.actions.career.deliverQuest().ok, false);
  g.state.career.stock = { tomato: 5 };
  r = g.actions.career.deliverQuest();
  assert.equal(r.done, true);
  assert.deepEqual(g.state.career.stock, { tomato: 3 });
  assert.equal(g.state.career.joseph.questsDone, 1);
});

test('quête de produits : comptés à la vente (payés normalement) ; récompense = moitié de leur valeur', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 1));
  const q = g.state.career.quest;
  Object.assign(q, { templateId: 'product', type: 'product', need: { type: 'product', id: 'strawberryJam', n: 2 }, progress: 0, accepted: false, value: 92, reward: { money: 46, ecus: 3, hearts: 1 } });
  g.actions.career.acceptQuest();
  const ev = record(g);
  g.state.stats.year.productsSold.strawberryJam = (g.state.stats.year.productsSold.strawberryJam || 0) + 1;
  nextDay(g);
  assert.equal(g.query.career.quest().progress, 1);
  g.state.stats.year.productsSold.strawberryJam += 1;
  g.update(1);
  assert.equal(ev.of('questDone')[0].amount, 46);
});

test('paliers d\'amitié : 4 ♥ prêt × 2, 6 ♥ sans supplément, jamais plus de 10 ♥', () => {
  withApi((g, api) => {
    const base = g.level.neighbourLoan;
    for (let k = 0; k < 4; k++) addHeart(api, 'test');
    assert.equal(g.level.neighbourLoan.maxShare, base.maxShare * 2);
    assert.equal(g.level.neighbourLoan.minCover, base.minCover * 2);
    assert.equal(g.level.neighbourLoan.surcharge, base.surcharge);
    addHeart(api, 'test');
    addHeart(api, 'test');
    assert.equal(g.level.neighbourLoan.surcharge, 0);
    const j = g.query.career.joseph();
    assert.equal(j.hearts, 6);
    assert.equal(j.nextGift.hearts, 8);
    assert.deepEqual(j.tiers.filter((t) => t.reached).map((t) => t.id), ['gifts', 'loanDouble', 'loanFree']);
    for (let k = 0; k < 10; k++) addHeart(api, 'test');
    assert.equal(g.state.career.joseph.hearts, MAX_HEARTS);
  });
});

test('8 ♥ : « Le verger de Joseph » (terrain suivant à moitié prix, verger de 4 pommiers adultes, une fois)', () => {
  withApi((g, api) => {
    setRank(g, 2);
    g.state.money = 100000;
    const ev = record(g);
    for (let k = 0; k < 7; k++) addHeart(api, 'test');
    assert.equal(g.query.career.nextLot().price, LOT_PRICES[0]);
    addHeart(api, 'test');
    g.update(0.001); // émet les événements en attente
    const unlock = ev.of('josephHeart').at(-1).unlock;
    assert.equal(unlock.id, 'orchard');
    const next = g.query.career.nextLot();
    assert.equal(next.price, Math.round(LOT_PRICES[0] / 2));
    assert.equal(next.special.label, 'Le verger de Joseph');
    const money = g.state.money;
    const r = g.actions.career.buyLot();
    assert.ok(r.ok);
    assert.equal(r.lotType, 'orchard');
    assert.equal(money - g.state.money, Math.round(LOT_PRICES[0] / 2));
    const lot = g.state.career.lots.find((l) => l.id === r.lotId);
    assert.equal(lot.type, 'orchard');
    const plots = g.state.plots.filter((p) => p.lot === lot.id && p.env === 'orchard');
    assert.equal(plots.length, 9);
    const trees = plots.filter((p) => p.cropId === 'apple');
    assert.equal(trees.length, 4);
    assert.ok(trees.every((p) => p.growth >= getCrop('apple').growDays));
    assert.equal(g.state.career.joseph.orchardDone, true);
    assert.equal(g.query.career.nextLot().price, LOT_PRICES[1], 'une seule fois');
    assert.ok(ev.of('lotDeveloped').some((e) => e.gift === 'josephOrchard'));
    assert.equal(checkCareerState(g.serialize()), null);
  });
});

test('10 ♥ : la charrette de Joseph (+5 % sur les ventes), succès « Ami de Joseph »', () => {
  withApi((g, api) => {
    ripen(g, 0, 'potato');
    g.state.market.potato = 1;
    const before = g.query.plot(0).handValue;
    for (let k = 0; k < 10; k++) addHeart(api, 'test');
    const after = g.query.plot(0).handValue;
    assert.equal(after, Math.round(16 * 1.25 * 1.05 * 1.1));
    assert.ok(after > before);
    assert.equal(g.query.career.joseph().title, 'Ami de Joseph');
    const ctx = g.query.career.achievementContext();
    assert.equal(ctx.hearts, 10);
    assert.ok(checkAchievements(defaultProgress(), { career: ctx }).includes('josephFriend'));
  });
});

test('+1 ♥ quand un prêt de Joseph est remboursé en entier ; +1 ♥ à la fête des récoltes si une quête est en cours', () => {
  const g = newCareer();
  const ev = record(g);
  g.state.career.joseph.loansRepaid = 1;
  nextDay(g);
  assert.equal(g.state.career.joseph.hearts, 1);
  assert.equal(ev.of('josephHeart')[0].reason, 'loan');
  nextDay(g);
  assert.equal(g.state.career.joseph.hearts, 1, 'une seule fois par prêt');
  setRank(g, 2);
  goTo(g, 1, dayOf(2, 1));
  forceCropQuest(g, 'cabbage', 99);
  g.actions.career.acceptQuest();
  nextDay(g); // fête des récoltes
  assert.equal(g.state.career.joseph.hearts, 2);
  assert.equal(ev.of('josephHeart').at(-1).reason, 'festival');
  assert.equal(ev.of('josephHeart').at(-1).unlock.id, 'gifts');
});

test('sauvegarde en cours de quête : reprise identique ; quête abîmée refusée', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 1));
  forceCropQuest(g, 'potato', 3);
  g.actions.career.acceptQuest();
  ripen(g, 0, 'potato');
  g.actions.harvest(0);
  const saved = g.serialize();
  const g2 = loadCareer(saved);
  assert.deepEqual(g2.query.career.quest(), g.query.career.quest());
  for (const i of [1, 2]) {
    ripen(g2, i, 'potato');
    g2.actions.harvest(i);
  }
  assert.equal(g2.state.career.joseph.questsDone, 1);
  const bad = JSON.parse(JSON.stringify(saved));
  bad.career.quest.templateId = 'dragon';
  assert.throws(() => loadCareer(bad), /quête/);
});

test('déterminisme : même graine → mêmes quêtes', () => {
  const run = () => {
    const g = createCareer({ seed: 99 });
    setRank(g, 2);
    const ev = record(g);
    skipYear(g);
    skipYear(g);
    return ev.of('questOffered').map((e) => `${e.quest.templateId}:${e.quest.need.id}:${e.quest.need.n}`);
  };
  const a = run();
  assert.equal(a.length, 4, 'au plus une proposition toutes les deux saisons');
  assert.deepEqual(a, run());
});
