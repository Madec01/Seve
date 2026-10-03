// Mode Carrière — rythme tranquille des quêtes et des commandes (retours de joueurs : « trop de quêtes en peu de
// temps », « une saison pour planter 10 patates, j'ai oublié d'appuyer sur pause, c'était déjà trop tard ») :
// une quête à la fois, au plus une proposition toutes les deux saisons, proposition sans compte à rebours, délai
// long qui commence à l'acceptation, rappels à 3 jours et à 1 jour, échec sans pénalité, taille selon le rang et la
// ferme, « demander un service » ; commandes de visiteurs plus rares, plus longues, une seule à la fois ; le temps
// ne passe pas quand le jeu est en pause.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, loadCareer, migrateCareer, checkCareerState } from '../src/core/career/career.js';
import { getCrop } from '../src/data/crops.js';
import { JOSEPH_LINES, QUEST_PACE, QUEST_TEMPLATES_BY_ID } from '../src/data/career/quests.js';
import { RANDOM_EVENT_RULES, VISITOR } from '../src/data/career/events.js';
import { questDeadline } from '../src/core/career/quests.js';
import { DAY_SECONDS, goTo, newCareer, nextDay, record, setRank, skipDays } from './career-helpers.js';

const L = 7;
const dayOf = (seasonIndex, d, len = L) => seasonIndex * len + d;

function forceCropQuest(g, cropId, n = 3) {
  const q = g.state.career.quest;
  const value = getCrop(cropId).sellPrice * 1.25 * n;
  Object.assign(q, { templateId: 'crop', type: 'crop', need: { type: 'crop', id: cropId, n }, progress: 0, accepted: false, value, what: cropId, text: 'test', reward: { money: Math.round(value * 1.5), ecus: 3, hearts: 1 } });
  return q;
}

test('rythme : au plus une proposition toutes les deux saisons, une seule quête à la fois', () => {
  const g = newCareer();
  setRank(g, 2);
  const ev = record(g);
  // Deux ans sans répondre : 4 propositions (été, hiver, été, hiver), chacune retirée gentiment.
  skipDays(g, 8 * L);
  const offers = ev.of('questOffered');
  assert.equal(offers.length, 4);
  const days = offers.map((e) => e.quest.id);
  assert.equal(new Set(days).size, 4);
  assert.equal(ev.of('questWithdrawn').length, 3 + (g.state.career.quest ? 0 : 1));
  assert.equal(ev.of('questExpired').length, 0, 'une proposition jamais acceptée n\'« échoue » pas');
  assert.equal(ev.of('questWithdrawn')[0].line, JOSEPH_LINES.questWithdrawn);
  // Jamais deux quêtes en même temps.
  assert.ok(!('quests' in g.state.career));
});

test('refuser ne fait pas revenir Joseph tout de suite (deux saisons entre deux propositions)', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 1));
  assert.ok(g.state.career.quest);
  assert.ok(g.actions.career.declineQuest().ok);
  const ev = record(g);
  goTo(g, 1, dayOf(2, 1));
  assert.equal(ev.of('questOffered').length, 0, 'pas à l\'automne');
  goTo(g, 1, dayOf(3, 1));
  assert.equal(ev.of('questOffered').length, 1, 'à l\'hiver');
  assert.equal(g.query.career.joseph().ask.nextOfferInSeasons, null, 'une quête est proposée');
});

test('proposition : aucun compte à rebours avant « Accepter » ; elle attend la fin de la saison suivante', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 1));
  const q0 = g.query.career.quest();
  assert.equal(q0.accepted, false);
  assert.equal(q0.offerDaysLeft, 2 * L - 1);
  assert.equal(q0.offerEndDay, 3 * L);
  const ev = record(g);
  goTo(g, 1, dayOf(2, L));
  assert.ok(g.state.career.quest, 'toujours là le dernier jour de l\'automne');
  // Accepter tard : le délai complet commence maintenant.
  const quest = g.state.career.quest;
  const acc = g.actions.career.acceptQuest();
  assert.ok(acc.ok);
  assert.ok(acc.quest.daysLeft >= QUEST_PACE.minSeasons * L);
  assert.equal(quest.acceptedDay, dayOf(2, L));
  nextDay(g);
  assert.equal(ev.of('questWithdrawn').length, 0);
  assert.ok(g.state.career.quest?.accepted);
});

test('délai à l\'acceptation : ≥ max(2 saisons, 3 × pousse + 2), jusqu\'au soir du dernier jour d\'une saison', () => {
  for (const len of [7, 10, 14]) {
    for (const [cropId, season] of [['potato', 0], ['wheat', 0], ['pumpkin', 1], ['cabbage', 2], ['turnip', 3]]) {
      for (const day of [1, len]) {
        const g = createCareer({ seed: 3, seasonLength: len });
        g.state.weather.today = 'sunny';
        setRank(g, 3);
        goTo(g, 1, dayOf(season, day, len));
        g.state.career.quest = null;
        g.state.career.joseph.askedDay = 0;
        assert.ok(g.actions.career.askQuest().ok);
        if (!g.state.career.quest) continue;
        forceCropQuest(g, cropId, 4);
        const today = g.state.time.day;
        const r = g.actions.career.acceptQuest();
        const end = g.state.career.quest.endDay;
        const grow = getCrop(cropId).growDays;
        assert.ok(end - today >= Math.max(2 * len, 3 * grow + 2), `${len} j, ${cropId}, jour ${day} : ${end - today} jours`);
        assert.equal(end % len, 0, 'le dernier jour d\'une saison');
        assert.equal(r.quest.daysLeft, end - today);
        assert.match(r.line, /jusqu'à la fin d/);
      }
    }
  }
});

test('le temps de jeu ne passe pas en pause : l\'échéance ne bouge pas', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 1));
  forceCropQuest(g, 'potato', 4);
  g.actions.career.acceptQuest();
  const before = g.query.career.quest();
  assert.ok(g.actions.setSpeed(0).ok);
  for (let k = 0; k < 100; k++) g.update(DAY_SECONDS);
  const after = g.query.career.quest();
  assert.equal(g.state.time.day, dayOf(1, 1));
  assert.equal(after.daysLeft, before.daysLeft);
  assert.equal(after.endDay, before.endDay);
  // Les commandes de visiteurs non plus.
  g.actions.setSpeed(1);
  g.state.career.events.lastKind = null;
  assert.ok(g.actions.career.triggerEvent('visitor').ok);
  const o = g.query.career.events().offers[0];
  g.actions.setSpeed(0);
  for (let k = 0; k < 50; k++) g.update(DAY_SECONDS);
  assert.equal(g.query.career.events().offers[0].daysLeft, o.daysLeft);
});

test('rappels à 3 jours et à 1 jour de l\'échéance, une fois chacun ; échec doux (rien de perdu, Joseph reste ami)', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 1));
  forceCropQuest(g, 'potato', 5);
  g.actions.career.acceptQuest();
  const end = g.state.career.quest.endDay;
  const ev = record(g);
  goTo(g, 1, end);
  const rem = ev.of('questReminder');
  assert.deepEqual(rem.map((e) => e.daysLeft), [3, 1]);
  assert.equal(rem[0].line, JOSEPH_LINES.questReminder3.replace('{what}', 'potato'));
  assert.equal(rem[1].line, JOSEPH_LINES.questReminder1.replace('{what}', 'potato'));
  assert.equal(rem[1].quest.daysLeft, 1);
  const money = g.state.money;
  const hearts = g.state.career.joseph.hearts;
  const done = g.state.career.joseph.questsDone;
  nextDay(g);
  const exp = ev.of('questExpired')[0];
  assert.ok(exp && exp.accepted);
  assert.equal(exp.amount, 0);
  assert.equal(exp.line, JOSEPH_LINES.questExpired);
  assert.ok(g.state.money >= money - 50, 'pas d\'amende (seulement les charges du jour)');
  assert.equal(g.state.career.joseph.hearts, hearts);
  assert.equal(g.state.career.joseph.questsDone, done);
  // Rappels jamais envoyés pour une quête déjà finie.
  assert.equal(ev.of('questReminder').length, 2);
});

test('taille des quêtes : petites au rang 2 (4 à 5 récoltes), plus grandes ensuite, plafonnées par la taille de la ferme', () => {
  const sizes = { 2: [], 6: [] };
  for (let seed = 1; seed <= 40; seed++) {
    for (const rank of [2, 6]) {
      const g = createCareer({ seed });
      setRank(g, rank);
      if (rank === 6) {
        // Une grande ferme : 5 champs de plus.
        g.state.money = 1e7;
        for (let k = 0; k < 5; k++) {
          const r = g.actions.career.buyLot();
          g.actions.career.developLot(r.lotId, 'field');
        }
      }
      g.state.career.joseph.askedDay = 0;
      g.actions.career.askQuest();
      const q = g.state.career.quest;
      if (q?.type === 'crop') sizes[rank].push(q.need.n);
    }
  }
  assert.ok(sizes[2].length > 5 && sizes[6].length > 5);
  assert.ok(sizes[2].every((n) => n >= 4 && n <= 6), `rang 2 : ${sizes[2]}`);
  assert.ok(sizes[6].every((n) => n >= 12), `rang 6 : ${sizes[6]}`);
  // Petite ferme au rang 6 : plafond (la moitié des 12 parcelles ouvertes).
  const g = createCareer({ seed: 5 });
  setRank(g, 6);
  let found = null;
  for (let k = 0; k < 40 && !found; k++) {
    g.state.career.quest = null;
    g.state.career.joseph.askedDay = 0;
    g.actions.career.askQuest();
    if (g.state.career.quest?.type === 'crop') found = g.state.career.quest;
  }
  assert.ok(found);
  assert.equal(found.need.n, 6);
  assert.equal(QUEST_TEMPLATES_BY_ID.crop.n.base, 4);
});

test('quête « culture » : une culture semable cette saison ET la suivante', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const season of [0, 1, 2, 3]) {
      const g = createCareer({ seed });
      g.state.weather.today = 'sunny';
      setRank(g, 3);
      goTo(g, 1, dayOf(season, 2));
      g.state.career.quest = null;
      g.state.career.joseph.askedDay = 0;
      g.actions.career.askQuest();
      const q = g.state.career.quest;
      if (q?.type !== 'crop') continue;
      const seasons = getCrop(q.need.id).seasons;
      const sids = ['spring', 'summer', 'autumn', 'winter'];
      assert.ok(seasons.includes(sids[season]) && seasons.includes(sids[(season + 1) % 4]), `${q.need.id} en ${sids[season]}`);
    }
  }
});

test('demander un service à Joseph (Carnet) : au rang 2, sans quête en cours, une fois par jour', () => {
  const g = newCareer();
  assert.match(g.actions.career.askQuest().reason, /Rang 2 requis/);
  assert.equal(g.query.career.joseph().ask.canAsk, false);
  setRank(g, 2);
  assert.equal(g.query.career.joseph().ask.canAsk, true);
  const ev = record(g);
  const r = g.actions.career.askQuest();
  assert.ok(r.ok);
  assert.equal(r.line, JOSEPH_LINES.questAsk);
  assert.ok(r.quest);
  assert.equal(ev.of('questOffered')[0].asked, true);
  assert.match(g.actions.career.askQuest().reason, /attend déjà/);
  g.actions.career.acceptQuest();
  assert.match(g.actions.career.askQuest().reason, /déjà en cours/);
  g.actions.career.declineQuest();
  assert.match(g.actions.career.askQuest().reason, /repassez demain/);
  assert.match(g.query.career.joseph().ask.reason, /repassez demain/);
  nextDay(g);
  assert.ok(g.actions.career.askQuest().ok);
});

test('commandes de visiteurs : 5 jours, une seule à la fois, cultures qu\'on peut avoir à temps ; tirage plus rare', () => {
  assert.equal(RANDOM_EVENT_RULES.chance, 0.15);
  assert.equal(VISITOR.days, 5);
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, 5);
  assert.ok(g.actions.career.triggerEvent('visitor').ok);
  const o = g.query.career.events().offers[0];
  assert.equal(o.daysLeft, 4, 'aujourd\'hui + 4 jours');
  const crop = getCrop(o.data.cropId);
  assert.ok(crop.growDays <= 4, `${crop.id} pousse en ${crop.growDays} jours`);
  assert.ok(o.n >= 2 && o.n <= 5);
  // Une seule commande à la fois (même si l'événement du jour est fini).
  g.state.career.events.active = null;
  g.state.career.events.lastKind = null;
  assert.equal(g.actions.career.triggerEvent('visitor').ok, false);
  // Saisons de 14 jours : 7 jours.
  const h = createCareer({ seed: 7, seasonLength: 14, variety: false });
  h.state.weather.today = 'sunny';
  goTo(h, 1, 5);
  assert.ok(h.actions.career.triggerEvent('visitor').ok);
  assert.equal(h.query.career.events().offers[0].daysLeft, 6);
});

test('au plus une quête et une commande ouvertes à la fois (une année de jeu, au hasard)', () => {
  for (const seed of [1, 2, 3]) {
    const g = createCareer({ seed });
    setRank(g, 3);
    let maxOpen = 0;
    for (let d = 0; d < 4 * L; d++) {
      nextDay(g);
      const quests = g.state.career.quest ? 1 : 0;
      const orders = g.state.career.events.offers.filter((o) => o.kind === 'visitor').length;
      assert.ok(orders <= 1);
      maxOpen = Math.max(maxOpen, quests + orders);
    }
    assert.ok(maxOpen <= 2);
  }
});

test('sauvegarde : quête proposée ou acceptée relue à l\'identique ; migration d\'une quête v1 (délai jamais raccourci)', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 3));
  forceCropQuest(g, 'potato', 4);
  const g2 = loadCareer(g.serialize());
  assert.deepEqual(g2.query.career.quest(), g.query.career.quest());
  g.actions.career.acceptQuest();
  const g3 = loadCareer(g.serialize());
  assert.deepEqual(g3.query.career.quest(), g.query.career.quest());
  // Ancienne version : quête acceptée qui finissait ce soir de fin de saison.
  const v1 = JSON.parse(JSON.stringify(g.serialize()));
  v1.career.version = 1;
  for (const l of v1.career.lots) {
    delete l.col;
    delete l.row;
  }
  const q = v1.career.quest;
  q.endDay = dayOf(1, L);
  delete q.offerEndDay;
  delete q.reminded;
  delete q.acceptedDay;
  delete v1.career.joseph.lastOfferSeason;
  const m = migrateCareer(v1);
  assert.equal(checkCareerState(m), null);
  assert.ok(m.career.quest.endDay >= dayOf(1, 3) + 2 * L, `échéance ${m.career.quest.endDay}`);
  assert.equal(m.career.joseph.lastOfferSeason, 1);
  const g4 = loadCareer(v1);
  assert.equal(g4.query.career.quest().accepted, true);
  // Pas encore acceptée : elle attend la fin de la saison suivante.
  const v1b = JSON.parse(JSON.stringify(v1));
  v1b.career.quest.accepted = false;
  const mb = migrateCareer(v1b);
  assert.equal(mb.career.quest.offerEndDay, 3 * L);
  assert.equal(questDeadline(g.state, g.state.career.quest) > 0, true);
});
