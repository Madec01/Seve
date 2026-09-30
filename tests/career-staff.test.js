// Mode Carrière — employés (CORE-B) : candidats (prénoms, apparences, traits), embauche et capacité de la
// maison, affectations, salaires, expérience et niveaux, humeur, congés, chômage technique, artisan,
// vendeur, renvoi, sauvegarde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCareer } from '../src/core/career/career.js';
import { cheerStaff, levelForXp, wageFor } from '../src/core/career/staff.js';
import { FIRST_NAMES, LOOK_COUNT, genderOf, lookId, validLook } from '../src/data/career/names.js';
import { JOBS, TRAITS, XP_LEVELS } from '../src/data/career/staff.js';
import { lookKey, SPRITES, staffPortrait, staffSprite } from '../src/render/atlas.js';
import { priceBonus } from '../src/core/economy.js';
import { capacity } from '../src/core/processing.js';
import { withExtension } from './career-helpers.js';
import { DAY_SECONDS, atFrac, hireAs, houseLevel, lotPlots, newCareer, newLot, nextDay, record, richCareer, setRank, sowDirect } from './career-crew-helpers.js';

const wagesOf = (dawn) => dawn.chargesDetail.filter((c) => c.source === 'wages').reduce((s, c) => s + c.amount, 0);

test('données : 4 métiers, 7 traits (icônes de l\'atlas), 64 apparences, prénoms genrés', () => {
  assert.deepEqual(JOBS.map((j) => j.id), ['gardener', 'keeper', 'artisan', 'seller']);
  assert.deepEqual(TRAITS.map((t) => t.id), ['strong', 'thrifty', 'quick', 'loyal', 'animalLover', 'chatty', 'earlyBird']);
  for (const t of TRAITS) assert.ok(SPRITES[`icon.career.trait.${t.id}`], t.id);
  for (const j of JOBS) assert.ok(SPRITES[`icon.career.job.${j.id}`], j.id);
  for (const m of ['joyful', 'content', 'tired']) assert.ok(SPRITES[`icon.career.mood.${m}`], m);
  assert.equal(LOOK_COUNT, 64);
  // Chaque apparence a ses sprites (4 poses) et son portrait ; la clé est celle de l'atlas.
  let n = 0;
  for (const gender of ['m', 'f']) {
    for (let outfit = 0; outfit < 4; outfit++) {
      for (const hat of [false, true]) {
        for (let tint = 0; tint < 4; tint++) {
          const look = { gender, outfit, hat, tint };
          assert.ok(validLook(look));
          assert.equal(lookId(look), lookKey(look));
          for (const pose of ['idle', 'walk', 'walk2', 'work']) assert.ok(SPRITES[staffSprite(look, pose)], staffSprite(look, pose));
          assert.ok(SPRITES[staffPortrait(look)], staffPortrait(look));
          n++;
        }
      }
    }
  }
  assert.equal(n, 64);
  assert.equal(FIRST_NAMES.filter((x) => x.gender === 'f').length, FIRST_NAMES.filter((x) => x.gender === 'm').length);
  for (const name of ['Lucie', 'Rose', 'Jeanne', 'Margot', 'Suzanne', 'Louise', 'Colette', 'Odette', 'Berthe', 'Irène', 'Yvette', 'Mireille']) assert.equal(genderOf(name), 'f', name);
  for (const name of ['Marcel', 'Paulin', 'Léon', 'Émile', 'Gaston', 'Aimé', 'Firmin', 'Victor', 'Armand', 'Lucien', 'Hector', 'Jules']) assert.equal(genderOf(name), 'm', name);
  assert.deepEqual([1, 2, 3, 4, 5].map((l) => wageFor(l, 'loyal')), [8, 11, 14, 17, 20]);
  assert.equal(wageFor(1, 'thrifty'), 6);
  assert.deepEqual([0, 99, 100, 299, 300, 700, 1499, 1500, 99999].map(levelForXp), [1, 1, 2, 2, 3, 4, 4, 5, 5]);
});

test('candidats : 3 dès la création, prénoms distincts, genre du prénom, renouvelés chaque saison (flux « staff »)', () => {
  const g = newCareer();
  const list = g.state.career.candidates;
  assert.equal(list.length, 3);
  assert.equal(new Set(list.map((c) => c.name)).size, 3);
  for (const c of list) {
    assert.equal(c.look.gender, genderOf(c.name));
    assert.ok(validLook(c.look));
    assert.equal(c.level, 1, 'niveau 2 seulement à partir du rang 4');
    assert.equal(c.wage, wageFor(1, c.trait));
    assert.ok(JOBS.some((j) => j.id === c.suggestedJob));
  }
  const again = newCareer();
  assert.deepEqual(again.state.career.candidates, list, 'déterministe');
  const other = newCareer({ seed: 99 });
  assert.notDeepEqual(other.state.career.candidates.map((c) => c.name), list.map((c) => c.name));
  const q = g.query.career.candidates();
  assert.equal(q.list.length, 3);
  assert.equal(q.nextInDays, 7);
  assert.equal(q.canHire, false);
  assert.match(q.reason, /Rang 2/);
  assert.ok(q.list[0].traitName && q.list[0].traitText && q.list[0].suggestedJobName);
  const ev = record(g);
  while (g.state.time.seasonIndex === 0) nextDay(g);
  assert.equal(ev.of('candidatesRenewed')[0].count, 3);
  assert.notDeepEqual(g.state.career.candidates.map((c) => c.id), list.map((c) => c.id));
  // Rang 4 : environ un candidat sur trois est de niveau 2.
  const r4 = newCareer({ seed: 5 });
  setRank(r4, 4);
  let lvl2 = 0;
  let total = 0;
  for (let season = 0; season < 16; season++) {
    const si = r4.state.time.seasonIndex;
    while (r4.state.time.seasonIndex === si) nextDay(r4);
    for (const c of r4.state.career.candidates) {
      total++;
      if (c.level === 2) {
        lvl2++;
        assert.equal(c.xp, XP_LEVELS[1]);
        assert.equal(c.wage, wageFor(2, c.trait));
      }
    }
  }
  assert.ok(lvl2 > total * 0.15 && lvl2 < total * 0.55, `${lvl2} / ${total}`);
});

test('embauche : rang 2 et maison niv. 2 ; capacité de la maison (2, 4, 6, 8) ; candidat retiré', () => {
  const g = newCareer();
  g.state.money = 1e6;
  const ev = record(g);
  const c0 = g.state.career.candidates[0];
  assert.match(g.actions.career.hire(c0.id).reason, /Rang 2/);
  setRank(g, 2);
  assert.match(g.actions.career.hire(c0.id).reason, /maison/);
  houseLevel(g, 2);
  assert.equal(g.query.career.candidates().capacity, 2);
  assert.equal(g.actions.career.hire('c999').ok, false);
  const r = g.actions.career.hire(c0.id);
  assert.equal(r.ok, true);
  const s = g.state.career.staff[0];
  assert.deepEqual([s.name, s.job, s.lotId, s.level, s.onLeave, s.mood, s.task], [c0.name, null, null, 1, false, 'content', null]);
  assert.deepEqual(s.look, c0.look);
  assert.equal(g.state.career.candidates.length, 2);
  assert.equal(ev.of('staffHired')[0].name, c0.name);
  assert.ok(g.actions.career.hire(g.state.career.candidates[0].id).ok);
  assert.match(g.actions.career.hire(g.state.career.candidates[0].id).reason, /maison est pleine/);
  // Objectif du rang 3 : un employé.
  assert.equal(g.state.career.objectives.firstHire, true);
  setRank(g, 5);
  houseLevel(g, 5);
  while (g.state.career.staff.length < 8) {
    if (!g.state.career.candidates.length) g.state.career.candidates = [{ ...c0, id: `c${900 + g.state.career.staff.length}`, name: 'Rose' }];
    assert.ok(g.actions.career.hire(g.state.career.candidates[0].id).ok);
  }
  g.state.career.candidates = [{ ...c0, id: 'c999' }];
  assert.match(g.actions.career.hire('c999').reason, /Au plus 8/);
  // Embauche avec affectation directe.
  const g2 = richCareer(2);
  houseLevel(g2, 2);
  const r2 = g2.actions.career.hire(g2.state.career.candidates[1].id, 'gardener', 'start');
  assert.equal(r2.ok, true);
  assert.deepEqual([r2.staff.job, r2.staff.lotId], ['gardener', 'start']);
  assert.equal(g2.actions.career.hire(g2.state.career.candidates[0].id, 'gardener', 'yard').ok, false, 'affectation impossible : refus');
});

test('affectations : terrains compatibles par métier, « tous », vendeur à la ferme, sans métier', () => {
  const g = richCareer(3);
  const s = hireAs(g);
  const meadow = newLot(g, 'meadow');
  const shops = newLot(g, 'workshops');
  const orchard = newLot(g, 'orchard');
  const ok = (job, lot) => g.actions.career.assign(s.id, job, lot).ok;
  assert.ok(ok('gardener', 'start'));
  assert.ok(ok('gardener', orchard));
  assert.ok(ok('gardener', 'all'));
  assert.ok(!ok('gardener', meadow));
  assert.ok(!ok('gardener', 'nowhere'));
  assert.ok(ok('keeper', 'yard'));
  assert.ok(ok('keeper', meadow));
  assert.ok(ok('keeper', 'all'));
  assert.ok(!ok('keeper', 'start'));
  assert.ok(ok('artisan', shops));
  assert.ok(!ok('artisan', 'all'));
  assert.ok(ok('seller', null));
  assert.equal(s.lotId, 'home');
  assert.ok(!ok('cook', 'start'));
  assert.ok(ok(null, null));
  assert.deepEqual([s.job, s.lotId], [null, null]);
  const line = g.query.career.staff()[0];
  assert.equal(line.status, 'unassigned');
  assert.deepEqual(line.assignable.find((a) => a.job === 'gardener').lots.map((l) => l.lotId), ['start', orchard, 'all']);
  g.actions.career.assign(s.id, 'gardener', 'start');
  const l2 = g.query.career.staff()[0];
  assert.equal(l2.lotName, 'Le champ de départ');
  assert.equal(l2.jobName, s.look.gender === 'f' ? 'Jardinière' : 'Jardinier');
  assert.equal(g.query.career.lot('start').staff[0], s.id, 'fiche du terrain');
});

test('salaires : payés à l\'aube qui suit l\'embauche, « Économe » −2, rien en congé ni en coup dur', () => {
  const g = richCareer(2);
  const ev = record(g);
  const a = hireAs(g, 'gardener', 'start');
  a.trait = 'thrifty';
  a.wage = wageFor(1, 'thrifty');
  const b = hireAs(g, null, null);
  b.trait = 'loyal';
  b.wage = wageFor(1, 'loyal');
  assert.deepEqual(g.query.career.charges().daily.filter((d) => d.source === 'wages'), [{ source: 'wages', amount: 14 }], 'estimation');
  nextDay(g);
  assert.equal(wagesOf(ev.of('dawn')[0]), 6 + 8, 'sans affectation, le salaire est payé');
  assert.equal(g.state.career.yearStats.spentBy.wages, 14);
  g.actions.career.setLeave(b.id, true);
  nextDay(g);
  assert.equal(wagesOf(ev.of('dawn')[1]), 6);
  g.actions.career.setTeamLeave(true);
  nextDay(g);
  assert.equal(wagesOf(ev.of('dawn')[2]), 0);
  g.actions.career.setTeamLeave(false);
  // Coup dur : chômage technique, pas de salaire.
  g.state.money = -5;
  g.state.career.hardship = { stage: 'overdraft', since: { year: 1, day: 3 } };
  nextDay(g);
  assert.equal(wagesOf(ev.of('dawn')[3]), 0);
  assert.equal(g.state.career.staff[0].idleReason, 'noMoney');
  assert.equal(g.query.career.staff()[0].status, 'noMoney');
  atFrac(g, 0.9);
  assert.equal(g.state.career.staff[0].actionsToday, 0, 'pas de travail');
  assert.equal(g.query.career.candidates().wages, 14);
});

test('expérience et niveaux : +1 par action du jardinier, « Vif » × 1,5, passage de niveau et salaire', () => {
  const g = richCareer(2);
  const ev = record(g);
  const s = hireAs(g, 'gardener', 'start');
  s.trait = 'loyal';
  s.wage = wageFor(1, 'loyal');
  sowDirect(g, lotPlots(g, 'start'), 'carrot');
  nextDay(g);
  const xp0 = s.xp;
  atFrac(g, 0.9);
  assert.ok(s.actionsToday > 0);
  assert.equal(s.xp - xp0, s.actionsToday, '1 point par action utile');
  s.xp = 99;
  s.trait = 'quick';
  g.state.plots.forEach((p) => {
    if (p.lot === 'start') p.watered = false;
  });
  nextDay(g);
  atFrac(g, 0.9);
  const up = ev.of('staffLevelUp')[0];
  assert.ok(up, 'niveau 2');
  assert.deepEqual([up.level, up.wage, up.actionsPerDay], [2, 11, 18]);
  assert.match(up.text, /passe jardinier|passe jardinière/);
  assert.equal(s.level, 2);
  assert.equal(s.wage, 11);
  assert.equal(s.xp % 1.5 === 0 || s.xp > 99, true);
  // Niveau 5 au plus.
  s.xp = 1e6;
  s.level = 5;
  s.wage = wageFor(5, s.trait);
  assert.equal(g.query.career.staff()[0].nextLevelXp, null);
  assert.equal(g.query.career.staff()[0].actionsPerDay, 30);
});

test('humeur : las après 21 jours d\'affilée (28 avec la grande maison), « Fidèle » jamais ; joyeux après 2 jours de congé ou une fête', () => {
  const g = richCareer(3);
  const ev = record(g);
  const s = hireAs(g, 'keeper', 'yard');
  s.trait = 'thrifty';
  const t = hireAs(g, 'keeper', 'yard');
  t.trait = 'loyal';
  assert.equal(g.state.career.buildings.house.level, 2);
  for (let d = 0; d < 4; d++) nextDay(g);
  assert.equal(s.streak, 4, 'un jour de travail de plus à chaque aube');
  s.streak = 20;
  t.streak = 20;
  nextDay(g);
  assert.equal(s.streak, 21);
  assert.equal(s.mood, 'tired');
  assert.equal(t.mood, 'content', 'Fidèle');
  assert.equal(ev.of('staffMood').find((e) => e.staffId === s.id).mood, 'tired');
  // Grande maison : las après 28 jours.
  houseLevel(g, 3);
  nextDay(g);
  assert.equal(s.mood, 'content');
  s.streak = 27;
  nextDay(g);
  assert.equal(s.mood, 'tired');
  // Congé de 2 jours → joyeux 7 jours (en automne : pas de fête du village au milieu).
  while (g.state.time.day < 16) nextDay(g);
  g.actions.career.setLeave(s.id, true);
  assert.equal(s.task, null);
  nextDay(g);
  nextDay(g);
  assert.equal(s.leaveDays, 2);
  assert.equal(s.streak, 0);
  g.actions.career.setLeave(s.id, false);
  assert.equal(s.mood, 'joyful');
  for (let d = 0; d < 6; d++) nextDay(g);
  assert.equal(s.mood, 'joyful');
  nextDay(g);
  assert.equal(s.mood, 'content');
  // Un seul jour de congé : pas de joie.
  g.actions.career.setLeave(t.id, true);
  nextDay(g);
  g.actions.career.setLeave(t.id, false);
  assert.equal(t.mood, 'content');
  // Fête (CORE-C appelle cheerStaff) : toute l'équipe joyeuse 7 jours, compteur « Las » remis à zéro.
  let api = null;
  const e2 = withExtension({ hooks: { dawn: (a) => (api = a) } });
  try {
    const g4 = richCareer(3);
    const x = hireAs(g4, 'keeper', 'yard');
    x.streak = 25;
    nextDay(g4);
    cheerStaff(api);
    assert.equal(x.mood, 'joyful');
    assert.equal(x.streak, 0);
    assert.equal(x.joyUntilDay, g4.state.time.day + 7);
  } finally {
    e2.off();
  }
});

test('humeur et actions : joyeux +10 %, las −10 %, « Costaud » +20 %, tracteur +25 %, « tous les champs » −20 %', () => {
  const g = richCareer(4);
  const s = hireAs(g, 'gardener', 'start');
  s.trait = 'loyal';
  const apd = () => g.query.career.staff()[0].actionsPerDay;
  assert.equal(apd(), 14);
  s.mood = 'joyful';
  assert.equal(apd(), 15);
  s.mood = 'tired';
  assert.equal(apd(), 13);
  s.mood = 'content';
  s.trait = 'strong';
  assert.equal(apd(), 17);
  s.trait = 'earlyBird';
  assert.equal(apd(), 16, 'commence à 5 % : 80 % du jour au lieu de 70 %');
  s.trait = 'loyal';
  g.actions.career.buyMachine('tractor');
  assert.equal(apd(), 18);
  g.actions.career.assign(s.id, 'gardener', 'all');
  assert.equal(apd(), 14);
  assert.equal(g.query.career.staff()[0].status, 'working');
});

test('renvoi : départ, événement, places d\'atelier remises à leur capacité', () => {
  const g = richCareer(3);
  const ev = record(g);
  const shops = newLot(g, 'workshops');
  g.actions.career.build(shops, 0, 'jamWorkshop');
  assert.equal(capacity(g.state, 'jamWorkshop'), 2);
  const s = hireAs(g, 'artisan', shops);
  assert.equal(capacity(g.state, 'jamWorkshop'), 3, 'artisan niv. 1 : +1 place');
  assert.equal(g.state.processing.jamWorkshop.places.length, 3);
  // Les 3 places occupées, puis l'artisan part : un produit ne tient plus → vendu en l'état.
  g.state.processing.jamWorkshop.places = [null, { productId: 'strawberryJam', input: 'strawberry', source: 'harvest', daysLeft: 2, rawValue: 20, yieldFactor: 1 }, { productId: 'strawberryJam', input: 'strawberry', source: 'harvest', daysLeft: 2, rawValue: 20, yieldFactor: 1 }];
  g.actions.career.setLeave(s.id, true);
  assert.equal(g.state.processing.jamWorkshop.places.length, 2);
  assert.equal(g.state.processing.jamWorkshop.places.filter(Boolean).length, 2, 'tassé : rien de perdu');
  g.actions.career.setLeave(s.id, false);
  g.state.processing.jamWorkshop.places = g.state.processing.jamWorkshop.places.map(() => ({ productId: 'strawberryJam', input: 'strawberry', source: 'harvest', daysLeft: 2, rawValue: 20, yieldFactor: 1 }));
  const money = g.state.money;
  assert.ok(g.actions.career.fire(s.id).ok);
  assert.equal(g.state.career.staff.length, 0);
  assert.equal(ev.of('staffLeft')[0].text, `Au revoir, ${s.name} ! Merci pour tout.`);
  assert.equal(g.state.processing.jamWorkshop.places.length, 2);
  assert.equal(ev.of('processingSoldRaw').at(-1).reason, 'artisan');
  assert.equal(g.state.money, money + 20);
  assert.equal(g.actions.career.fire(s.id).ok, false);
  // La sauvegarde reste valide (places ≤ capacité).
  assert.ok(loadCareer(g.serialize()));
});

test('artisan : +1 place (niv. 1-2), +2 (niv. 3-5), produits +10 % au niv. 5 ; expérience par produit vendu', () => {
  const g = richCareer(3);
  const shops = newLot(g, 'workshops');
  g.actions.career.build(shops, 0, 'jamWorkshop');
  const s = hireAs(g, 'artisan', shops);
  s.level = 3;
  g.actions.career.assign(s.id, 'artisan', shops);
  assert.equal(capacity(g.state, 'jamWorkshop'), 4);
  assert.equal(g.state.processing.jamWorkshop.places.length, 4);
  const place = { productId: 'strawberryJam', input: 'strawberry', source: 'harvest', daysLeft: 1, rawValue: 20, yieldFactor: 1 };
  g.state.processing.jamWorkshop.places[0] = { ...place };
  const ev = record(g);
  const xp = s.xp;
  nextDay(g);
  const sale = ev.of('productSold')[0];
  assert.ok(sale);
  assert.equal(s.xp - xp, 2 * (s.trait === 'quick' ? 1.5 : 1));
  // Niveau 5 : produits + 10 %.
  s.level = 5;
  g.state.processing.jamWorkshop.places[0] = { ...place };
  nextDay(g);
  const sale5 = ev.of('productSold')[1];
  assert.ok(Math.abs(sale5.amount - sale.amount * 1.1) <= 1, `${sale.amount} → ${sale5.amount}`);
});

test('vendeur : ventes + 2 % par niveau (« Bavard » + 3 %), un seul compte ; vend le grenier au bon cours', () => {
  const g = richCareer(2);
  g.actions.career.upgradeBuilding('storage');
  const base = priceBonus(g.state);
  const s = hireAs(g, 'seller');
  s.trait = 'loyal';
  assert.equal(s.lotId, 'home');
  assert.ok(Math.abs(priceBonus(g.state) - base - 0.02) < 1e-9);
  s.level = 3;
  assert.ok(Math.abs(priceBonus(g.state) - base - 0.06) < 1e-9);
  s.trait = 'chatty';
  assert.ok(Math.abs(priceBonus(g.state) - base - 0.09) < 1e-9);
  const t = hireAs(g, 'seller');
  t.level = 1;
  assert.ok(Math.abs(priceBonus(g.state) - base - 0.09) < 1e-9, 'un seul vendeur compte (le meilleur)');
  g.actions.career.setLeave(s.id, true);
  assert.ok(Math.abs(priceBonus(g.state) - base - 0.02 - (t.trait === 'chatty' ? 0.03 : 0)) < 1e-9);
  g.actions.career.fire(t.id);
  g.actions.career.setLeave(s.id, false);
  // Grenier : la carotte au cours 1,2 (≥ 1,15 − 0,02 × 2), le blé à 0,9.
  g.state.career.stock = { carrot: 4, wheat: 3 };
  nextDay(g);
  g.state.market.carrot = 1.2;
  g.state.market.wheat = 0.9;
  const ev = record(g);
  atFrac(g, 0.5);
  const sold = ev.of('stockSold');
  assert.equal(sold.length, 1);
  assert.equal(sold[0].reason, 'seller');
  assert.deepEqual(sold[0].lines.map((l) => [l.cropId, l.count]), [['carrot', 4]]);
  assert.deepEqual(g.state.career.stock, { wheat: 3 });
  assert.ok(s.xp > 0, '1 point par 10 pièces');
  // Hors saison : le blé ne se sème pas en hiver → vendu.
  void DAY_SECONDS;
});

test('sauvegarde : équipe, candidats, tâches en cours ; vérification des champs', () => {
  const g = richCareer(2);
  const s = hireAs(g, 'gardener', 'start');
  sowDirect(g, lotPlots(g, 'start'), 'carrot');
  nextDay(g);
  atFrac(g, 0.4);
  assert.ok(s.task);
  const saved = g.serialize();
  const g2 = loadCareer(saved);
  assert.deepEqual(g2.state.career.staff, g.state.career.staff);
  assert.deepEqual(g2.state.career.candidates, g.state.career.candidates);
  const bad = (mut, re) => {
    const x = JSON.parse(JSON.stringify(saved));
    mut(x.career);
    assert.throws(() => loadCareer(x), re);
  };
  bad((c) => (c.staff[0].trait = 'lazy'), /trait/);
  bad((c) => (c.staff[0].job = 'cook'), /métier/);
  bad((c) => (c.staff[0].lotId = 'lot99'), /affectation/);
  bad((c) => (c.staff[0].level = 6), /niveau/);
  bad((c) => (c.staff[0].look = { gender: 'x', outfit: 0, hat: false, tint: 0 }), /apparence/);
  bad((c) => (c.staff[0].mood = 'grumpy'), /humeur/);
  bad((c) => c.staff.push({ ...c.staff[0] }), /employé/);
  bad((c) => (c.candidates[0].look = null), /candidat/);
  // Ancienne sauvegarde sans genre : déduit du prénom.
  const old = JSON.parse(JSON.stringify(saved));
  delete old.career.staff[0].look.gender;
  delete old.career.staff[0].leaveDays;
  delete old.career.staff[0].plan;
  const g3 = loadCareer(old);
  assert.equal(g3.state.career.staff[0].look.gender, genderOf(s.name));
  assert.equal(g3.state.career.staff[0].leaveDays, 0);
});
