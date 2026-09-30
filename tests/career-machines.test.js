// Mode Carrière — machines (CORE-B) : catalogue, achat et rang, arroseurs, semoir (plan, cheval / tracteur),
// moissonneuse (rang par rang), cueilleuse, collecteur, tracteur, château d'eau, convoyeur, interrupteur,
// carburant et entretien, coup dur, vente de secours, sauvegarde en plein passage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCareer } from '../src/core/career/career.js';
import { MACHINES } from '../src/data/career/machines.js';
import { SPRITES } from '../src/render/atlas.js';
import { DAY_SECONDS, atFrac, lotPlots, newCareer, newLot, nextDay, record, richCareer, snapshot, sowDirect } from './career-crew-helpers.js';

const fuelOf = (ev) => ev.of('dawn').map((d) => d.chargesDetail.filter((c) => c.source === 'fuel').reduce((s, c) => s + c.amount, 0));
const upkeepOf = (dawn) => dawn.chargesDetail.filter((c) => c.source === 'upkeep').reduce((s, c) => s + c.amount, 0);

test('catalogue : 8 machines, icônes de l\'atlas, rangs, emplacements compatibles', () => {
  assert.deepEqual(MACHINES.map((m) => m.id), ['sprinklers', 'seeder', 'harvester', 'fruitPicker', 'collector', 'tractor', 'waterTower', 'conveyor']);
  for (const m of MACHINES) assert.ok(SPRITES[`icon.career.machine.${m.id}`], m.id);
  const g = newCareer();
  const cat = g.query.career.machineCatalog();
  const sp = cat.find((m) => m.id === 'sprinklers');
  assert.equal(sp.canBuy, false);
  assert.equal(sp.lockedByRank, 2);
  assert.match(sp.reason, /Rang 2/);
  assert.deepEqual(sp.places.map((p) => p.lotId), ['start']);
  g.state.money = 1e5;
  g.state.career.rank = 2;
  g.refreshLevel();
  assert.equal(g.query.career.machineCatalog().find((m) => m.id === 'sprinklers').canBuy, true);
  assert.equal(g.query.career.machineCatalog().find((m) => m.id === 'seeder').lockedByRank, 3);
  assert.deepEqual(g.query.career.machineCatalog().find((m) => m.id === 'collector').places.map((p) => p.buildingId), ['coop']);
});

test('achat : rang, terrain compatible, une par terrain, argent ; patrimoine et vente de secours (journal)', () => {
  const g = newCareer();
  const ev = record(g);
  assert.match(g.actions.career.buyMachine('sprinklers', 'start').reason, /Rang 2/);
  g.state.career.rank = 2;
  g.refreshLevel();
  g.state.money = 100;
  assert.match(g.actions.career.buyMachine('sprinklers', 'start').reason, /Pas assez/);
  g.state.money = 1000;
  assert.match(g.actions.career.buyMachine('sprinklers', 'yard').reason, /champ/);
  assert.match(g.actions.career.buyMachine('sprinklers').reason, /terrain/);
  assert.equal(g.actions.career.buyMachine('nope', 'start').ok, false);
  const r = g.actions.career.buyMachine('sprinklers', 'start');
  assert.deepEqual(r, { ok: true, key: 'sprinklers@start', cost: 150, level: 1 });
  assert.equal(g.state.money, 850);
  assert.match(g.actions.career.buyMachine('sprinklers', 'start').reason, /Déjà/);
  const m = g.state.career.machines['sprinklers@start'];
  assert.deepEqual([m.id, m.lotId, m.level, m.on], ['sprinklers', 'start', 1, true]);
  assert.equal(g.state.career.paid.machines, 150);
  assert.deepEqual(g.state.career.assetLog.at(-1), { kind: 'machine', id: 'sprinklers', key: 'sprinklers@start', price: 150, year: 1, day: 1 });
  assert.equal(g.state.career.yearStats.spentBy.machines, 150);
  const b = ev.of('machineBought')[0];
  assert.deepEqual([b.key, b.id, b.lotId, b.level, b.on, b.cost], ['sprinklers@start', 'sprinklers', 'start', 1, true, 150]);
  // Amélioration : même clé dans le journal (vendue avec sa machine).
  const up = g.actions.career.upgradeMachine('sprinklers', 'start');
  assert.deepEqual(up, { ok: true, key: 'sprinklers@start', level: 2, cost: 250 });
  assert.equal(g.actions.career.upgradeMachine('sprinklers@start').reason, 'Niveau maximal atteint.');
  assert.equal(g.state.career.assetLog.filter((e) => e.key === 'sprinklers@start').length, 2);
  assert.equal(ev.of('machineUpgraded')[0].level, 2);
  assert.equal(g.query.career.summary().patrimony, Math.round(g.state.money + 400 / 2));
  const line = g.query.career.machines()[0];
  assert.deepEqual([line.key, line.level, line.maxLevel, line.working, line.fuel, line.upkeep], ['sprinklers@start', 2, 2, true, 0, 1]);
  assert.equal(g.query.career.lot('start').machines[0], 'sprinklers@start', 'fiche du terrain');
});

test('arroseurs : niv. 1 → les 8 premières cases à l\'aube, niv. 2 → tout le terrain ; entretien 1 même éteints', () => {
  const g = richCareer(2);
  const plots = lotPlots(g, 'start');
  sowDirect(g, plots, 'carrot');
  g.actions.career.buyMachine('sprinklers', 'start');
  const ev = record(g);
  nextDay(g);
  const watered = plots.filter((i) => g.state.plots[i].watered);
  assert.deepEqual(watered, plots.filter((i) => g.state.plots[i].cell < 8));
  assert.equal(ev.of('dawn')[0].sprinkled.length, 8);
  const w = ev.of('machineWorked')[0];
  assert.deepEqual([w.key, w.kind, w.plots.length, w.fuel], ['sprinklers@start', 'water', 8, 0]);
  assert.deepEqual(g.query.career.machines()[0].coverage, plots.filter((i) => g.state.plots[i].cell < 8));
  g.actions.career.upgradeMachine('sprinklers', 'start');
  nextDay(g);
  assert.equal(plots.filter((i) => g.state.plots[i].watered).length, 12, 'les 12 parcelles ouvertes');
  assert.equal(upkeepOf(ev.of('dawn')[1]), 1);
  g.actions.career.setMachine('sprinklers', 'start', false);
  assert.equal(ev.of('machineToggled')[0].on, false);
  nextDay(g);
  assert.equal(plots.filter((i) => g.state.plots[i].watered).length, 0, 'éteints : rien');
  assert.equal(upkeepOf(ev.of('dawn')[2]), 1, 'l\'entretien reste');
  // La pluie arrose déjà : les arroseurs n'ont rien à faire, sans erreur.
  g.actions.career.setMachine('sprinklers@start', true);
  nextDay(g, 'rain');
  assert.equal(ev.of('dawn')[3].sprinkled.length, 0);
});

test('semoir : cheval ou tracteur ; 8 semis à l\'aube suivant le plan ; carburant 2 le lendemain', () => {
  const g = richCareer(3);
  const plots = lotPlots(g, 'start');
  assert.ok(g.actions.career.buyMachine('seeder', 'start').ok);
  let line = g.query.career.machines()[0];
  assert.equal(line.working, false);
  assert.match(line.why, /cheval ou le tracteur/);
  const ev = record(g);
  nextDay(g);
  assert.ok(plots.every((i) => !g.state.plots[i].cropId), 'sans cheval : rien');
  // Un cheval (écurie sur un pré).
  const meadow = newLot(g, 'meadow');
  g.actions.career.build(meadow, 0, 'stable');
  g.actions.buyInvestment('horse');
  g.actions.career.setPlan('start', 'spring', 'carrot');
  line = g.query.career.machines()[0];
  assert.deepEqual([line.working, line.puller, line.capacity], [true, 'horse', 8]);
  const money = g.state.money;
  // Aujourd'hui (l'aube est passée sans cheval) : le passage de 35 % sème 8 parcelles.
  atFrac(g, 0.34);
  assert.ok(plots.every((i) => !g.state.plots[i].cropId));
  atFrac(g, 0.6);
  const sown = plots.filter((i) => g.state.plots[i].cropId);
  assert.equal(sown.length, 8, 'niv. 1 : 8 semis par jour');
  assert.ok(sown.every((i) => g.state.plots[i].cropId === 'carrot'));
  const w = ev.of('machineWorked').find((e) => e.kind === 'sow');
  assert.equal(w.startAt, 0.35 * DAY_SECONDS);
  assert.equal(w.puller, 'horse');
  assert.ok(ev.of('planted').every((p) => p.by === 'machine'));
  assert.ok(g.state.money < money, 'graines achetées');
  // Aube suivante : 1er passage (les 4 dernières), carburant de la veille (2 ; cheval : pas de tracteur).
  nextDay(g);
  assert.equal(plots.filter((i) => g.state.plots[i].cropId).length, 12);
  assert.equal(ev.of('machineWorked').filter((e) => e.kind === 'sow').at(-1).dawn, true);
  assert.equal(fuelOf(ev).at(-1), 2);
  nextDay(g);
  assert.equal(fuelOf(ev).at(-1), 2, 'semé à l\'aube d\'hier : carburant payé aujourd\'hui');
  nextDay(g);
  assert.equal(fuelOf(ev).at(-1), 0, 'rien semé hier');
  // Plan « Rien » : le semoir ne sème pas.
  for (const i of plots) g.state.plots[i].cropId = null;
  g.actions.career.setPlan('start', 'spring', null);
  nextDay(g);
  atFrac(g, 0.9);
  assert.ok(plots.every((i) => !g.state.plots[i].cropId));
});

test('semoir « même culture » : la dernière récoltée, sinon la plus rentable sûre ; jamais de semis qui gèle', () => {
  const g = richCareer(4);
  g.actions.career.buyMachine('tractor');
  g.actions.career.buyMachine('seeder', 'start');
  g.actions.career.upgradeMachine('seeder', 'start');
  const plots = lotPlots(g, 'start');
  g.state.plots[plots[0]].lastHarvested = 'potato';
  nextDay(g);
  assert.equal(g.state.plots[plots[0]].cropId, 'potato');
  assert.ok(plots.every((i) => g.state.plots[i].cropId), 'niv. 2 + tracteur : tout le terrain');
  // Fin d'automne : une culture longue gèlerait avant d'être mûre.
  const g2 = richCareer(4);
  g2.actions.career.buyMachine('tractor');
  g2.actions.career.buyMachine('seeder', 'start');
  g2.actions.career.upgradeMachine('seeder', 'start');
  g2.actions.career.setPlan('start', 'autumn', 'pumpkin');
  while (g2.state.time.day < 20) nextDay(g2);
  for (const i of lotPlots(g2, 'start')) Object.assign(g2.state.plots[i], { cropId: null, growth: 0 });
  nextDay(g2);
  const crops = lotPlots(g2, 'start').map((i) => g2.state.plots[i].cropId);
  assert.ok(crops.every((c) => c !== 'pumpkin'), 'citrouille : gèlerait');
  assert.ok(crops.every((c) => c === null || ['turnip', 'cabbage', 'carrot', 'wheat', 'potato', 'strawberry', 'tomato', 'corn', 'sunflower', 'zucchini'].includes(c)));
});

test('moissonneuse : passe à 30 % rang par rang (chaque parcelle à son heure), prix normal, carburant 3', () => {
  const g = richCareer(3);
  const meadow = newLot(g, 'meadow');
  g.actions.career.build(meadow, 0, 'stable');
  g.actions.buyInvestment('horse');
  g.actions.career.buyMachine('harvester', 'start');
  g.actions.career.setPlan('start', 'spring', null);
  const plots = lotPlots(g, 'start');
  sowDirect(g, plots, 'carrot', { mature: true });
  const ev = record(g);
  atFrac(g, 0.299);
  assert.equal(ev.of('harvested').length, 0);
  atFrac(g, 0.3);
  const w = ev.of('machineWorked')[0];
  assert.deepEqual([w.kind, w.plots.length, w.puller, w.fuel], ['harvest', 8, 'horse', 3]);
  assert.equal(w.startAt, 0.3 * DAY_SECONDS);
  // Rang par rang, en serpentin : 1er rang de gauche à droite, 2e de droite à gauche.
  const cells = w.plots.map((p) => g.state.plots[p.index].cell);
  assert.deepEqual(cells, [0, 1, 2, 3, 7, 6, 5, 4]);
  assert.ok(w.plots.every((p, k) => k === 0 || p.at > w.plots[k - 1].at));
  assert.equal(g.query.career.machineWork().length, 1, 'passage en cours');
  atFrac(g, (w.plots[2].at + 0.01) / DAY_SECONDS);
  assert.equal(ev.of('harvested').length, 3, 'trois parcelles traitées');
  atFrac(g, 0.9);
  const h = ev.of('harvested');
  assert.equal(h.length, 8, 'niv. 1 : 8 récoltes par jour');
  assert.ok(h.every((e) => e.by === 'machine' && !e.handPicked));
  assert.equal(ev.of('machineRunDone')[0].count, 8);
  assert.equal(g.query.career.machineWork().length, 0);
  nextDay(g);
  assert.equal(fuelOf(ev).at(-1), 3);
  assert.equal(g.state.career.lifetime.handPicked, 0);
});

test('cueilleuse : cueille tous les fruits mûrs du verger à 30 %, sans jamais toucher aux arbres', () => {
  const g = richCareer(3);
  const orchard = newLot(g, 'orchard');
  const trees = lotPlots(g, orchard);
  for (const i of trees.slice(0, 3)) {
    const p = g.state.plots[i];
    Object.assign(p, { cropId: 'apple', growth: 99, fruit: 99 });
  }
  g.state.time.seasonIndex = 1; // été : les pommes mûrissent
  g.state.time.day = 8;
  g.state.time.dayOfSeason = 1;
  g.actions.career.buyMachine('fruitPicker', orchard);
  const ev = record(g);
  atFrac(g, 0.8);
  const picked = ev.of('harvested');
  assert.equal(picked.length, 3);
  assert.ok(picked.every((e) => e.tree && e.by === 'machine'));
  assert.ok(trees.slice(0, 3).every((i) => g.state.plots[i].cropId === 'apple'), 'les arbres restent');
});

test('collecteur : ramasse son abri à 40 % et 80 % du jour', () => {
  const g = richCareer(3);
  g.actions.career.buyMachine('collector', 'yard');
  assert.ok(g.state.career.machines['collector@coop']);
  assert.equal(g.state.career.machines['collector@coop'].buildingId, 'coop');
  const ev = record(g);
  nextDay(g);
  atFrac(g, 0.39);
  assert.equal(g.state.career.buildings.coop.pending, 4);
  atFrac(g, 0.4);
  assert.equal(g.state.career.buildings.coop.pending, 0);
  const c = ev.of('collected')[0];
  assert.deepEqual([c.by, c.amount, c.key], ['collector', 4, 'collector@coop']);
  assert.equal(ev.of('machineWorked').find((e) => e.kind === 'collect').buildingId, 'coop');
  assert.match(g.actions.career.buyMachine('collector', 'coop').reason, /Déjà/);
  assert.match(g.actions.career.buyMachine('collector', 'start').reason, /abri/);
});

test('tracteur : machines niv. 2, fallback niv. 1 avec un cheval, carburant 4 les jours où il tire', () => {
  const g = richCareer(4);
  g.actions.career.buyMachine('harvester', 'start');
  g.actions.career.upgradeMachine('harvester', 'start');
  g.actions.career.setPlan('start', 'spring', null);
  const plots = lotPlots(g, 'start');
  let line = g.query.career.machines()[0];
  assert.equal(line.working, false, 'niv. 2 sans tracteur ni cheval');
  assert.match(g.actions.career.buyMachine('tractor').ok ? 'ok' : 'ko', /ok/);
  assert.match(g.actions.career.buyMachine('tractor').reason, /déjà/);
  line = g.query.career.machines().find((m) => m.id === 'harvester');
  assert.deepEqual([line.working, line.effectiveLevel, line.puller, line.capacity], [true, 2, 'tractor', null]);
  sowDirect(g, plots, 'carrot', { mature: true });
  const ev = record(g);
  atFrac(g, 0.9);
  assert.equal(ev.of('harvested').length, 12, 'tout le terrain');
  nextDay(g);
  assert.equal(fuelOf(ev).at(-1), 3 + 4, 'moissonneuse + tracteur');
  nextDay(g);
  assert.equal(fuelOf(ev).at(-1), 0, 'rien récolté hier : pas de carburant');
  // Tracteur éteint : un cheval la tire au niveau 1.
  g.actions.career.setMachine('tractor', false);
  line = g.query.career.machines().find((m) => m.id === 'harvester');
  assert.equal(line.working, false);
  const meadow = newLot(g, 'meadow');
  g.actions.career.build(meadow, 0, 'stable');
  g.actions.buyInvestment('horse');
  line = g.query.career.machines().find((m) => m.id === 'harvester');
  assert.deepEqual([line.effectiveLevel, line.puller, line.capacity], [1, 'horse', 8]);
});

test('coup dur : les machines à carburant s\'arrêtent, les arroseurs continuent', () => {
  const g = richCareer(3);
  const meadow = newLot(g, 'meadow');
  g.actions.career.build(meadow, 0, 'stable');
  g.actions.buyInvestment('horse');
  g.actions.career.buyMachine('harvester', 'start');
  g.actions.career.buyMachine('sprinklers', 'start');
  g.actions.career.setPlan('start', 'spring', null);
  const plots = lotPlots(g, 'start');
  sowDirect(g, plots.slice(0, 4), 'carrot', { mature: true });
  sowDirect(g, plots.slice(4), 'carrot');
  g.state.money = -10;
  g.state.career.hardship = { stage: 'overdraft', since: { year: 1, day: 1 } };
  const ev = record(g);
  nextDay(g);
  atFrac(g, 0.9);
  assert.equal(ev.of('harvested').length, 0);
  assert.match(g.query.career.machines().find((m) => m.id === 'harvester').why, /passe difficile/);
  assert.ok(plots.slice(4).some((i) => g.state.plots[i].watered), 'arroseurs : sans carburant, ils continuent');
});

test('château d\'eau : arroseurs sans entretien, serre arrosée chaque aube ; convoyeur : ateliers remplis depuis le grenier', () => {
  const g = richCareer(5);
  g.actions.career.buyMachine('sprinklers', 'start');
  const gh = newLot(g, 'greenhouse');
  const ghPlots = lotPlots(g, gh);
  sowDirect(g, ghPlots, 'tomato');
  const ev = record(g);
  nextDay(g);
  assert.equal(upkeepOf(ev.of('dawn')[0]), 1);
  g.actions.career.buyMachine('waterTower');
  nextDay(g);
  assert.equal(upkeepOf(ev.of('dawn')[1]), 0, 'arroseurs sans entretien');
  assert.ok(ghPlots.every((i) => g.state.plots[i].watered), 'serre arrosée');
  // Convoyeur : confitures (fraises) depuis le grenier.
  const yard = newLot(g, 'workshops');
  g.actions.career.build(yard, 0, 'jamWorkshop');
  g.actions.career.upgradeBuilding('storage');
  g.state.career.stock = { strawberry: 5, carrot: 3 };
  g.actions.career.buyMachine('conveyor');
  nextDay(g);
  assert.equal(g.state.career.stock.strawberry, 3, '2 places libres remplies');
  assert.equal(g.state.career.stock.carrot, 3, 'la carotte ne se transforme pas');
  assert.ok(ev.of('processingStarted').some((e) => e.source === 'conveyor'));
  assert.equal(upkeepOf(ev.of('dawn').at(-1)), 2, 'entretien : atelier de confitures 1 + convoyeur 1');
});

test('vente de secours : les machines partent après les animaux, à 50 % du prix payé (améliorations comprises)', () => {
  const g = richCareer(2);
  g.actions.career.buyMachine('sprinklers', 'start');
  g.actions.career.upgradeMachine('sprinklers', 'start');
  g.actions.buyInvestment('hen');
  const ev = record(g);
  while (g.state.time.day < 7) nextDay(g);
  g.state.money = -1000;
  nextDay(g);
  const rescue = ev.of('rescueSale')[0];
  assert.ok(rescue);
  assert.deepEqual(rescue.sold.map((s) => [s.kind, s.id, s.amount]), [['animal', 'hen', 15], ['machine', 'sprinklers', 200]]);
  assert.equal(g.state.career.machines['sprinklers@start'], undefined);
  assert.equal(g.state.career.paid.machines, 0);
  // La partie continue sans erreur (plus de machine).
  nextDay(g);
  assert.deepEqual(g.query.career.machines(), []);
});

test('sauvegarde en plein passage : reprise identique à la partie continue', () => {
  const make = () => {
    const g = richCareer(4);
    g.actions.career.buyMachine('tractor');
    g.actions.career.buyMachine('harvester', 'start');
    g.actions.career.upgradeMachine('harvester', 'start');
    g.actions.career.buyMachine('seeder', 'start');
    g.actions.career.buyMachine('sprinklers', 'start');
    g.actions.career.setPlan('start', 'spring', 'carrot');
    sowDirect(g, lotPlots(g, 'start'), 'carrot', { mature: true });
    return g;
  };
  const a = make();
  atFrac(a, 0.33);
  assert.equal(a.query.career.machineWork().length, 1, 'passage en cours');
  const b = loadCareer(a.serialize());
  for (let d = 0; d < 6; d++) {
    atFrac(a, 1);
    atFrac(b, 1);
    // Une journée par petits morceaux d'un côté, d'un bloc de l'autre.
    for (let k = 0; k < 40; k++) a.update(DAY_SECONDS / 40);
    b.update(DAY_SECONDS);
  }
  assert.deepEqual(snapshot(b), snapshot(a));
});

test('vérification : machine inconnue, clé incohérente, niveau hors limites → sauvegarde refusée', () => {
  const g = richCareer(2);
  g.actions.career.buyMachine('sprinklers', 'start');
  const s1 = g.serialize();
  s1.career.machines['sprinklers@start'].level = 3;
  assert.throws(() => loadCareer(s1), /niveau de la machine/);
  const s2 = g.serialize();
  s2.career.machines['sprinklers@yard'] = s2.career.machines['sprinklers@start'];
  assert.throws(() => loadCareer(s2), /clé de la machine/);
  const s3 = g.serialize();
  s3.career.machines.robot = { id: 'robot', lotId: 'home', level: 1, on: true, workedDay: 0 };
  assert.throws(() => loadCareer(s3), /machine robot/);
  assert.ok(loadCareer(g.serialize()));
});
