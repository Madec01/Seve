// Mode Carrière — bâtiments à niveaux (maison, grenier / silo, étal, serre, abris, chambre d'hôte, ateliers),
// animaux et aménagements, grenier et ventes, serre en hiver, rangs, objectifs et déblocages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCrop } from '../src/data/crops.js';
import { RANKS } from '../src/data/career/ranks.js';
import { patrimony } from '../src/core/career/ranks.js';
import { newCareer, nextDay, record, setRank, skipDays, goTo } from './career-helpers.js';

function rich(g, money = 1e6) {
  g.state.money = money;
}

test('maison : 5 niveaux, prix et rangs du § 4.1, capacité d\'employés 0 / 2 / 4 / 6 / 8', () => {
  const g = newCareer();
  const ev = record(g);
  rich(g);
  const house = () => g.query.career.building('house');
  assert.equal(house().level, 1);
  assert.equal(house().effects.staff, 0);
  assert.match(g.actions.career.upgradeBuilding('house').reason, /Rang 2 requis/);
  const costs = [];
  const staff = [];
  for (const rank of [2, 3, 4, 5]) {
    setRank(g, rank);
    const r = g.actions.career.upgradeBuilding('house');
    assert.ok(r.ok, `niveau ${rank}`);
    costs.push(r.cost);
    staff.push(g.query.career.building('house').effects.staff);
  }
  assert.deepEqual(costs, [500, 1500, 4000, 10000]);
  assert.deepEqual(staff, [2, 4, 6, 8]);
  assert.equal(house().name, 'Manoir');
  assert.equal(house().canUpgrade, false);
  assert.equal(g.actions.career.upgradeBuilding('house').reason, 'Niveau maximal atteint.');
  assert.equal(ev.of('buildingUpgraded').length, 4);
  assert.equal(g.query.career.candidates().capacity, 8);
  assert.equal(g.state.career.paid.buildings, 16000);
});

test('grenier → silo → grand silo (30 / 100 / 250) ; étal → boutique (+20 % / +30 %)', () => {
  const g = newCareer();
  const ev = record(g);
  rich(g);
  assert.match(g.actions.career.upgradeBuilding('storage').reason, /Rang 2 requis/);
  setRank(g, 2);
  assert.equal(g.actions.career.upgradeBuilding('storage').cost, 400);
  assert.equal(ev.of('buildingBuilt')[0].buildingId, 'storage');
  assert.equal(g.query.career.stock().capacity, 30);
  assert.match(g.actions.career.upgradeBuilding('storage').reason, /Rang 4 requis/);
  setRank(g, 5);
  assert.equal(g.actions.career.upgradeBuilding('storage').cost, 1500);
  assert.equal(g.query.career.stock().capacity, 100);
  assert.equal(g.actions.career.upgradeBuilding('storage').cost, 4000);
  assert.equal(g.query.career.stock().capacity, 250);
  // Étal
  assert.equal(g.actions.career.upgradeBuilding('roadsideStand').cost, 180);
  assert.equal(g.query.career.building('roadsideStand').effects.priceBonus, 0.2);
  assert.equal(g.actions.career.upgradeBuilding('roadsideStand').cost, 600);
  assert.equal(g.query.career.building('roadsideStand').effects.priceBonus, 0.3);
  assert.equal(g.query.finance().priceBonus, 0.3);
});

test('étal : revenu des passants 4 / 8 / 4 / 2 × niveau, rien les jours d\'orage', () => {
  const g = newCareer();
  const ev = record(g);
  rich(g);
  g.actions.career.upgradeBuilding('roadsideStand');
  nextDay(g);
  assert.deepEqual(ev.of('dawn')[0].incomes.find((i) => i.source === 'roadsideStand'), { source: 'roadsideStand', amount: 4, owned: 1, kind: 'passersby', key: 'passersby' });
  ev.clear();
  nextDay(g, 'storm');
  assert.equal(ev.of('dawn')[0].incomes.find((i) => i.source === 'roadsideStand'), undefined);
  setRank(g, 4);
  g.actions.career.upgradeBuilding('roadsideStand');
  goTo(g, 1, 9);
  ev.clear();
  nextDay(g);
  assert.equal(ev.of('dawn')[0].incomes.find((i) => i.source === 'roadsideStand').amount, 16, 'été, boutique × 2');
});

test('abris : construits sur un pré, capacité par niveau, animaux au prix base + pas × possédés', () => {
  const g = newCareer();
  rich(g);
  // Poulailler offert (basse-cour), 4 places : 2 poules offertes + 2 achetées.
  assert.equal(g.actions.buyInvestment('hen').cost, 30);
  assert.equal(g.actions.buyInvestment('hen').cost, 30);
  assert.equal(g.actions.buyInvestment('hen').reason, 'Le poulailler est plein : améliorez-le.');
  assert.equal(g.actions.career.upgradeBuilding('coop').ok, false, 'niveau 2 : rang 2');
  setRank(g, 2);
  assert.equal(g.actions.career.upgradeBuilding('coop').cost, 150);
  assert.equal(g.query.career.building('coop').animals.capacity, 8);
  // Chèvres : il faut une chèvrerie (pré ou basse-cour).
  assert.equal(g.actions.buyInvestment('goat').reason, 'Il faut d\'abord une chèvrerie.');
  assert.equal(g.actions.career.build('yard', 0, 'goatShed').reason, 'Cet emplacement est déjà occupé.');
  assert.equal(g.actions.career.build('start', 0, 'goatShed').ok, false);
  assert.ok(g.actions.career.build('yard', 1, 'goatShed').ok);
  assert.deepEqual([80, 85, 90].map(() => g.actions.buyInvestment('goat').cost), [80, 85, 90]);
  assert.equal(g.actions.buyInvestment('goat').reason, 'La chèvrerie est pleine : améliorez-la.');
  // Un seul bâtiment de chaque type ; étable : rang 2 ; porcherie : rang 3.
  g.actions.career.buyLot();
  g.actions.career.developLot('lot3', 'meadow');
  assert.match(g.actions.career.build('lot3', 0, 'goatShed').reason, /un seul par ferme/);
  assert.ok(g.actions.career.build('lot3', 0, 'cowshed').ok);
  assert.match(g.actions.career.build('lot3', 1, 'pigsty').reason, /Rang 3 requis/);
  assert.match(g.actions.career.build('lot3', 1, 'jamWorkshop').reason, /cour des ateliers/);
  const opts = g.query.career.buildOptions('lot3', 1);
  assert.ok(opts.some((o) => o.buildingId === 'sheepfold' && o.canBuild));
  assert.ok(opts.some((o) => o.buildingId === 'pigsty' && !o.canBuild));
  assert.equal(g.actions.buyInvestment('cow').cost, 150);
  assert.equal(g.actions.buyInvestment('cow').cost, 160);
  assert.equal(g.query.career.building('cowshed').animals.count, 2);
  // Rang d'un animal.
  assert.match(g.actions.buyInvestment('pig').reason, /Rang 3 requis/);
  // Liste de l'onglet Acheter : verrouillés visibles.
  const invs = g.query.investments();
  const pig = invs.find((i) => i.id === 'pig');
  assert.equal(pig.lockedByRank, 3);
  assert.equal(invs.find((i) => i.id === 'cow').shelter.id, 'cowshed');
});

test('ruches (2 / 4 / 6, 2 par champ, +5 % de pousse chacune) et panneaux solaires', () => {
  const g = newCareer();
  rich(g);
  assert.equal(g.actions.buyInvestment('beehive').cost, 60);
  assert.equal(g.actions.buyInvestment('beehive').cost, 80);
  assert.match(g.actions.buyInvestment('beehive').reason, /Au plus 2 par champ|Au plus 2/);
  setRank(g, 2);
  assert.match(g.actions.buyInvestment('beehive').reason, /par champ/);
  g.actions.career.buyLot();
  g.actions.career.developLot('lot3', 'field');
  assert.equal(g.actions.buyInvestment('beehive').cost, 100);
  assert.equal(g.actions.buyInvestment('beehive').cost, 120);
  assert.equal(g.actions.buyInvestment('beehive').ok, false);
  // Pousse : +5 % par ruche hors hiver ; miel 5 par jour et par ruche.
  g.actions.plant(0, 'wheat');
  g.actions.water(0);
  const ev = record(g);
  nextDay(g);
  assert.ok(Math.abs(g.state.plots[0].growth - 1.2) < 1e-9);
  assert.equal(ev.of('dawn')[0].incomes.find((i) => i.source === 'beehive').amount, 20);
  // Panneaux : −5 chacun, jamais sous 0.
  const s = newCareer();
  rich(s);
  assert.deepEqual([1, 2, 3, 4].map(() => s.actions.buyInvestment('solarPanel').cost), [80, 100, 150, 200]);
  assert.equal(s.actions.buyInvestment('solarPanel').ok, false);
  assert.equal(s.query.career.charges().dailyTotal, 0);
});

test('chambre d\'hôte : sur un pré, revenu 20 / 34 / 20 / 8 × niveau (1 ; 1,5 ; 2,2), entretien 2 / 3 / 4', () => {
  const g = newCareer();
  rich(g);
  setRank(g, 3);
  assert.equal(g.actions.career.build('yard', 1, 'guestHouse').cost, 300);
  const ev = record(g);
  nextDay(g);
  const d = ev.of('dawn')[0];
  assert.equal(d.incomes.find((i) => i.source === 'guestHouse').amount, 20);
  assert.deepEqual(d.chargesDetail, [{ source: 'farm', amount: 2 }, { source: 'upkeep', amount: 2 }]);
  assert.equal(g.actions.career.upgradeBuilding('guestHouse').cost, 800);
  ev.clear();
  nextDay(g);
  assert.equal(ev.of('dawn')[0].incomes.find((i) => i.source === 'guestHouse').amount, 30);
});

test('ateliers : sur une cour des ateliers, 5 niveaux, places 2 / 3 / 4 / 5 / 6, transformation v3', () => {
  const g = newCareer();
  rich(g);
  setRank(g, 2);
  g.actions.career.buyLot();
  g.actions.career.developLot('lot3', 'workshops');
  assert.equal(g.actions.buyInvestment('jamWorkshop').ok, false);
  assert.equal(g.actions.career.build('lot3', 0, 'jamWorkshop').cost, 90);
  assert.equal(g.state.investments.jamWorkshop, 1);
  assert.equal(g.state.processing.jamWorkshop.places.length, 2);
  assert.match(g.actions.career.build('lot3', 1, 'mill').reason, /Rang 3 requis/);
  const costs = [];
  for (const rank of [2, 2, 4, 5]) {
    setRank(g, rank);
    costs.push(g.actions.career.upgradeBuilding('jamWorkshop').cost);
  }
  assert.deepEqual(costs, [120, 160, 320, 640]);
  assert.equal(g.state.investments.jamWorkshop, 5);
  assert.equal(g.state.processing.jamWorkshop.places.length, 6);
  // Une fraise part à l'atelier, vendue en confiture à l'aube (2 aubes).
  g.actions.plant(0, 'strawberry');
  g.state.plots[0].growth = 4;
  const r = g.actions.harvest(0);
  assert.equal(r.amount, 0);
  assert.equal(r.processed.buildingId, 'jamWorkshop');
  const ev = record(g);
  skipDays(g, 2);
  const sold = ev.of('productSold')[0];
  assert.equal(sold.productId, 'strawberryJam');
  assert.equal(sold.amount, 46);
  assert.equal(g.state.career.lifetime.productsSold, 1);
  assert.equal(g.state.career.yearStats.incomeBy.products, 46);
  // Réaménager une cour des ateliers occupée : refusé.
  assert.match(g.actions.career.developLot('lot3', 'meadow').reason, /Videz/);
});

test('grenier : mise en réserve (jamais / cours bas / toujours), plein → vendu, vente au cours du jour', () => {
  const g = newCareer();
  const ev = record(g);
  rich(g);
  setRank(g, 2);
  g.actions.career.upgradeBuilding('storage');
  const ripe = (i, crop) => {
    g.state.plots[i].cropId = crop;
    g.state.plots[i].growth = getCrop(crop).growDays;
  };
  // Cours bas (< 1, de saison) : mise en réserve par défaut.
  g.state.market.carrot = 0.9;
  ripe(0, 'carrot');
  assert.equal(g.query.plot(0).storeTarget, true);
  let r = g.actions.harvest(0);
  assert.deepEqual([r.amount, r.stored], [0, true]);
  assert.deepEqual(ev.of('stored')[0], { type: 'stored', cropId: 'carrot', n: 1, plotIndex: 0 });
  g.state.market.carrot = 1.1;
  ripe(1, 'carrot');
  assert.ok(g.actions.harvest(1).amount > 0, 'cours haut : vendue');
  assert.ok(g.actions.career.setStorageMode('always').ok);
  ripe(2, 'carrot');
  assert.equal(g.actions.harvest(2).stored, true);
  assert.ok(g.actions.career.setStorageMode('never').ok);
  g.state.market.carrot = 0.8;
  ripe(3, 'carrot');
  assert.equal(g.actions.harvest(3).stored, false);
  assert.equal(g.actions.career.setStorageMode('parfois').ok, false);
  assert.deepEqual(g.state.career.stock, { carrot: 2 });
  // Plein : vendu normalement.
  g.actions.career.setStorageMode('always');
  g.state.career.stock = { carrot: 30 };
  ripe(4, 'carrot');
  assert.equal(g.actions.harvest(4).stored, false);
  // Vente : prix du jour (Détente × 1,25, cours, hors saison, étal), sans le bonus « à la main ».
  g.state.career.stock = { carrot: 4, wheat: 3 };
  g.state.market.carrot = 1.2;
  const info = g.query.career.stock();
  assert.equal(info.used, 7);
  assert.equal(info.lines.find((l) => l.cropId === 'carrot').unitPrice, Math.round(10 * 1.25 * 1.2));
  ev.clear();
  const before = g.state.money;
  r = g.actions.career.sellStock('carrot', 3);
  assert.deepEqual(r, { ok: true, amount: 15 * 3, count: 3 });
  assert.equal(g.state.money, before + 45);
  assert.equal(ev.of('stockSold')[0].reason, 'player');
  r = g.actions.career.sellStock();
  assert.equal(r.count, 4);
  assert.deepEqual(g.state.career.stock, {});
  assert.equal(g.actions.career.sellStock().ok, false);
  assert.equal(g.state.career.yearStats.incomeBy.stock, r.amount + 45);
  // Hors saison (× 1,25) : du blé vendu en hiver.
  g.state.career.stock = { wheat: 1 };
  g.state.time = { ...g.state.time, seasonIndex: 3, dayOfSeason: 1, day: 22 };
  g.state.market.wheat = 1;
  assert.equal(g.actions.career.sellStock('wheat').amount, Math.round(16 * 1.25 * 1.25));
});

test('serre : 4 puis 8 parcelles, toutes les cultures en toute saison, ni gel ni pluie ; hiver × 0,5 (chauffée × 1,1)', () => {
  const g = newCareer();
  rich(g);
  setRank(g, 3);
  g.actions.career.buyLot();
  const r = g.actions.career.developLot('lot3', 'greenhouse');
  assert.equal(r.cost, 800);
  assert.equal(r.plots.length, 4);
  assert.equal(g.state.career.buildings.greenhouse.level, 1);
  assert.equal(g.actions.career.upgradeBuilding('greenhouse').cost, 1200);
  assert.equal(g.query.career.lot('lot3').plots.length, 8);
  const gh = g.query.career.lot('lot3').plots;
  // Hiver : tomate plantée dans la serre (hors saison), pas dans le champ.
  goTo(g, 1, 22);
  assert.equal(g.query.calendar().seasonId, 'winter');
  assert.ok(g.query.plantableCrops(gh[0]).some((o) => o.id === 'tomato'));
  assert.ok(!g.query.plantableCrops(gh[0]).some((o) => o.id === 'apple'));
  assert.equal(g.actions.plant(0, 'tomato').ok, false);
  assert.ok(g.actions.plant(gh[0], 'tomato').ok);
  assert.equal(g.query.plot(gh[0]).willFreeze, false);
  // La pluie n'arrose pas la serre.
  nextDay(g, 'rain');
  assert.equal(g.state.plots[gh[0]].watered, false);
  assert.equal(g.query.plot(gh[0]).action, 'water');
  g.actions.water(gh[0]);
  nextDay(g, 'rain');
  assert.equal(g.state.plots[gh[0]].growth, 0.75 * 0.5 + 0.5, 'hiver : × 0,5 (un jour sans arrosage : 0,75 × 0,5 ; arrosé : 0,5)');
  // Tomate de serre en hiver : hors saison × 1,25.
  g.state.plots[gh[0]].growth = 5;
  g.state.market.tomato = 1;
  const h = g.actions.harvest(gh[0]);
  assert.equal(h.amount, Math.round(38 * 1.25 * 1.25 * 1.1));
  assert.ok(g.query.career.achievementContext().cropsInSeason.includes('tomato@winter'));
  // Serre chauffée : × 1,1 et chauffage 3 par jour d'hiver.
  setRank(g, 4);
  assert.equal(g.actions.career.upgradeBuilding('greenhouse').cost, 3000);
  g.actions.plant(gh[1], 'carrot');
  g.actions.water(gh[1]);
  const ev = record(g);
  nextDay(g);
  assert.ok(Math.abs(g.state.plots[gh[1]].growth - 1.1) < 1e-9);
  assert.ok(ev.of('dawn')[0].chargesDetail.some((c) => c.source === 'heating' && c.amount === 3));
  // Gel du 1er jour d'hiver : la serre est épargnée.
  const f = newCareer();
  rich(f);
  setRank(f, 3);
  f.actions.career.buyLot();
  const p = f.actions.career.developLot('lot3', 'greenhouse').plots;
  goTo(f, 1, 21);
  f.actions.plant(p[0], 'tomato');
  f.actions.plant(0, 'carrot');
  nextDay(f);
  assert.equal(f.state.plots[p[0]].cropId, 'tomato');
  assert.equal(f.state.plots[0].cropId, null);
});

test('rangs : seuils (× durée), deux objectifs, déblocages, jamais de retour en arrière', () => {
  assert.deepEqual(RANKS.map((r) => r.patrimony), [0, 1200, 4000, 12000, 30000, 70000]);
  const g = newCareer();
  const ev = record(g);
  g.state.money = 5000;
  nextDay(g);
  assert.equal(g.state.career.rank, 1, 'patrimoine suffisant, objectifs non remplis');
  const next = g.query.career.summary().nextRank;
  assert.deepEqual(next.objectives.map((o) => [o.id, o.done, o.target]), [['firstLot', false, 1], ['harvests', false, 80]]);
  g.state.career.lifetime.harvests = 80;
  assert.ok(g.actions.career.buyLot().ok);
  const up = ev.of('rankUp');
  assert.equal(up.length, 1, 'vérifié après l\'achat');
  assert.deepEqual([up[0].rank, up[0].name, up[0].title, up[0].ecus], [2, 'Ferme familiale', 'Fermier', 40]);
  const kinds = new Set(up[0].unlocks.map((u) => u.kind));
  for (const k of ['crop', 'lotType', 'building', 'lots', 'animal', 'machine', 'feature']) assert.ok(kinds.has(k), k);
  assert.ok(g.level.crops.includes('apple'));
  assert.equal(g.query.career.nextLot().canBuy, true, 'jusqu\'à 3 terrains');
  // Patrimoine = argent + terrains + ½ (aménagements, bâtiments, animaux) − dette.
  const before = patrimony(g.state);
  g.actions.career.developLot('lot3', 'meadow');
  assert.equal(patrimony(g.state), before - 120 + 60);
  // Rang 3 : il faut un employé (lot CORE-B) et 20 produits.
  g.state.money = 1e6;
  nextDay(g);
  assert.equal(g.state.career.rank, 2);
  g.state.career.lifetime.productsSold = 20;
  g.state.career.staff.push({ id: 's1', level: 1 });
  nextDay(g);
  assert.equal(g.state.career.rank, 3);
  // Plusieurs rangs d'un coup si tout est rempli.
  g.state.career.objectives = { ...g.state.career.objectives, plots48: true, quests3: true, staff5: true, species6: true };
  nextDay(g);
  assert.equal(g.state.career.rank, 5);
  assert.deepEqual(ev.of('rankUp').map((e) => e.rank), [2, 3, 4, 5]);
  // Le patrimoine baisse : le rang reste.
  g.state.money = 0;
  nextDay(g);
  assert.equal(g.state.career.rank, 5);
  assert.equal(g.query.career.summary().nextRank.rank, 6);
  // Seuils × 10 / 7.
  const l = newCareer({ seasonLength: 10 });
  assert.equal(l.query.career.summary().nextRank.patrimony, Math.round(1200 * 10 / 7));
});

test('objectifs remplis gardés (rang 4 : 48 parcelles cultivables comptées)', () => {
  const g = newCareer();
  rich(g);
  setRank(g, 3);
  for (let k = 0; k < 3; k++) {
    g.actions.career.buyLot();
    g.actions.career.developLot(`lot${3 + k}`, 'field');
  }
  // 12 (départ) + 48 = 60 parcelles ouvertes.
  nextDay(g);
  assert.equal(g.state.career.objectives.plots48, true);
  const obj = g.query.career.summary().nextRank.objectives.find((o) => o.id === 'plots48');
  assert.deepEqual([obj.done, obj.progress, obj.target], [true, 48, 48]);
});
