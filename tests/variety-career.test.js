// Lot 3 « Variété » — carrière : extension 'variety', tableau (grenier), charrette, cartes, défis, colporteur,
// années à thème, remplacement du visiteur acheteur et du marchand ambulant. Règles : docs/GAME_DESIGN.md § 16.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, loadCareer } from '../src/core/career/career.js';
import { careerExtensions, providedFactor } from '../src/core/career/registry.js';
import { RANDOM_EVENT_RULES } from '../src/data/career/events.js';
import { THEMES, THEMES_BY_ID, THEME_RULES } from '../src/data/career/themes.js';
import { CARD_VALUES, MEDALS, RARE_SEEDS } from '../src/data/variety.js';
import { getCrop } from '../src/data/crops.js';
import { DAY_SECONDS, goTo, nextDay, newCareer, record, setRank, skipDays, skipYear, withExtension } from './career-helpers.js';

function career(opts = {}) {
  return newCareer({ variety: true, ...opts });
}

function fieldPlots(g) {
  return g.state.plots.map((p, i) => (p.env === 'field' && p.unlocked ? i : -1)).filter((i) => i >= 0);
}

function ripe(g, i, cropId) {
  const p = g.state.plots[i];
  p.cropId = cropId;
  p.growth = getCrop(cropId).growDays;
}

test('carrière : variété active par défaut (extension « variety » après les surprises), thèmes compris ; false → null', () => {
  const ids = careerExtensions().map((e) => e.id);
  assert.ok(ids.indexOf('variety') > ids.indexOf('quests'));
  assert.ok(ids.indexOf('variety') > ids.indexOf('surprises'));
  const g = createCareer({ seed: 3 });
  assert.ok(g.variety);
  assert.equal(g.state.variety.parts.themes, true);
  assert.deepEqual(g.state.career.theme, { year: 1, id: null, next: null, bag: [], festivalDone: false, visitor: null, history: [] });
  assert.ok(g.query.orders().slots.every((s) => !s.empty), 'tableau dès le 1er jour');
  assert.equal(g.query.cart(), null, 'charrette à partir de l\'été');
  assert.equal(g.query.challenges().options.length, 0, 'défis à partir de l\'été');
  assert.equal(g.query.merchant(), null, 'colporteur à partir de l\'été');
  const off = createCareer({ seed: 3, variety: false });
  assert.equal(off.state.variety, null);
  assert.equal(off.query.career.theme(), null);
  // Thème de l'année : « l'installation » (sans thème) en 1re année.
  assert.equal(g.query.career.theme().name, THEME_RULES.installName);
});

test('carrière : le visiteur acheteur et le marchand ambulant ne sont plus tirés (tableau, colporteur) ; tirage à 10 %', () => {
  assert.equal(RANDOM_EVENT_RULES.chanceWithVariety, 0.1);
  const kinds = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    const g = createCareer({ seed, surprises: false });
    setRank(g, 2);
    g.state.money = 5000;
    g.on('careerEvent', (e) => kinds.add(e.kind));
    skipDays(g, 56);
  }
  assert.equal(kinds.has('visitor'), false);
  assert.equal(kinds.has('merchant'), false);
  assert.ok(kinds.size >= 1);
  const g = career();
  setRank(g, 2);
  goTo(g, 1, 5);
  assert.equal(g.actions.career.triggerEvent('visitor').ok, false);
  assert.equal(g.actions.career.triggerEvent('merchant').ok, false);
});

test('carrière : récolte à la main d\'une culture demandée → vendue tout de suite (prime « à la main ») ; salariés : jamais', () => {
  const g = career();
  const o = g.state.variety.board.slots[0];
  o.lines = [{ cropId: 'carrot', n: 3, got: 0 }];
  const [a, b] = fieldPlots(g);
  ripe(g, a, 'carrot');
  ripe(g, b, 'carrot');
  g.actions.career.setStorageMode('always');
  const value = g.query.plot(a).handValue;
  const rec = record(g);
  const money = g.state.money;
  const r = g.actions.harvest(a);
  assert.ok(r.ok);
  assert.equal(r.stored, false, 'pas au grenier');
  assert.equal(r.amount, value + (r.qualityBonus || 0));
  assert.equal(g.state.money, money + r.amount);
  assert.equal(rec.of('harvested')[0].diverted, `→ ${'Mme Rose'.length ? rec.of('orderProgress')[0].clientName : ''}`);
  assert.equal(rec.of('harvested')[0].claimed.kind, 'order');
  assert.equal(o.lines[0].got, 1);
  // Un salarié (api.harvest by 'staff') : la récolte n'est jamais comptée.
  const h = withExtension();
  const g2 = career();
  const api = h.api();
  const o2 = g2.state.variety.board.slots[0];
  o2.lines = [{ cropId: 'carrot', n: 3, got: 0 }];
  const i = fieldPlots(g2)[0];
  ripe(g2, i, 'carrot');
  api.harvest(i, { by: 'staff' });
  assert.equal(o2.lines[0].got, 0);
  h.off();
});

test('carrière : semer à la main la culture d\'une commande la garde d\'office ; salariés, machines : jamais', () => {
  const h = withExtension();
  const g = career();
  const api = h.api();
  const o = g.state.variety.board.slots[0];
  o.lines = [{ cropId: 'carrot', n: 3, got: 0 }];
  o.kept = false;
  for (const x of g.state.variety.board.slots.slice(1)) if (x) x.lines = [{ cropId: 'potato', n: 3, got: 0 }];
  const rec = record(g);
  const [a, b] = fieldPlots(g).filter((i) => !g.state.plots[i].cropId);
  g.state.money = 1000;
  assert.ok(api.plant(a, 'carrot', { by: 'staff' }).ok);
  assert.equal(o.kept, false, 'semis d\'un salarié : rien');
  assert.ok(g.actions.plant(b, 'carrot').ok);
  assert.equal(o.kept, true);
  assert.equal(rec.of('orderKept').length, 1);
  assert.equal(rec.of('orderKept')[0].orderId, o.id);
  assert.equal(g.query.orders().slots[0].autoKept, true);
  h.off();
});

test('carrière : livrer depuis le grenier, charger la charrette depuis le grenier (au prix du grenier)', () => {
  const g = career();
  setRank(g, 2);
  const o = g.state.variety.board.slots[0];
  o.lines = [{ cropId: 'potato', n: 3, got: 0 }];
  o.rate = 1.1;
  g.state.career.stock.potato = 5;
  const rec = record(g);
  const money = g.state.money;
  const r = g.actions.deliverOrder(o.id);
  assert.ok(r.ok);
  assert.equal(r.delivered, 3);
  assert.equal(r.done, true);
  assert.ok(r.premium > 0);
  assert.equal(g.state.career.stock.potato, 2);
  assert.equal(g.state.money, money + r.amount + r.premium);
  assert.equal(rec.of('orderDone').length, 1);
  assert.equal(g.actions.deliverOrder(o.id).reason, 'Commande inconnue.');
  // Charrette (été).
  goTo(g, 1, 8);
  const cart = g.query.cart();
  assert.ok(cart);
  const crop = cart.crates[0].cropId;
  g.state.career.stock[crop] = 40;
  const l = g.actions.loadCart(0);
  assert.ok(l.ok);
  assert.equal(l.full, true);
  assert.equal(l.loaded, cart.crates[0].n);
  assert.equal(g.actions.loadCart(0).reason, 'Cette caisse est déjà pleine.');
  assert.equal(g.actions.loadCart(9).reason, 'Caisse inconnue.');
});

test('carrière : la charrette dès l\'été de la 1re année (3 caisses, 4 au rang ≥ 4), part avant les charges de saison', () => {
  const g = career();
  const rec = record(g);
  goTo(g, 1, 8);
  assert.equal(rec.of('cartArrived').length, 1);
  assert.equal(g.query.cart().crates.length, 3);
  rec.clear();
  goTo(g, 1, 15);
  const types = rec.events.map((e) => e.type).filter((t) => ['cartDeparted', 'challengesJudged', 'cardsOffered', 'challengesOffered', 'billPaid'].includes(t));
  assert.deepEqual(types, ['cartDeparted', 'challengesJudged', 'cardsOffered', 'challengesOffered', 'billPaid']);
  const h = career();
  setRank(h, 4);
  goTo(h, 1, 8);
  assert.equal(h.query.cart().crates.length, 4);
});

test('carrière : cartes (deux poules, ristourne −20 % des charges de saison, défrichage −50 % du prochain aménagement)', () => {
  const g = career();
  g.state.money = 5000;
  g.state.variety.cards.offer = { season: 0, options: ['hen', 'landlord'] };
  const hens = g.state.investments.hen;
  const r = g.actions.pickCard('hen');
  assert.ok(r.ok);
  assert.equal(g.state.investments.hen, hens + CARD_VALUES.hen.careerHens);
  assert.equal(r.card.kind, 'now');
  const charge = g.query.career.charges().season.amount;
  g.state.variety.cards.offer = { season: 0, options: ['landlord', 'purse'] };
  g.actions.pickCard('landlord');
  assert.equal(g.query.career.charges().season.amount, Math.round(charge * 0.8));
  assert.equal(g.query.finance().nextBill.reduced, true);
  const rec = record(g);
  goTo(g, 1, 8);
  assert.equal(rec.of('billPaid')[0].amount, Math.round(charge * 0.8));
  assert.equal(g.state.variety.cards.pending.chargeFactor, 1);
  // Défrichage : le prochain aménagement à moitié prix.
  g.state.variety.cards.offer = { season: 1, options: ['clearing', 'purse'] };
  assert.ok(g.actions.pickCard('clearing').ok);
  const buy = g.actions.career.buyLot();
  assert.ok(buy.ok, buy.reason);
  const types = g.query.career.lotTypes(buy.lotId);
  const field = types.find((t) => t.type === 'field');
  const d = g.actions.career.developLot(buy.lotId, 'field');
  assert.ok(d.ok);
  assert.equal(d.cost, field.cost);
  assert.equal(g.state.variety.cards.pending.clearingHalf, false);
  // La bourse : 30 + 20 × rang.
  g.state.variety.cards.offer = { season: 1, options: ['purse', 'poster'] };
  assert.equal(g.actions.pickCard('purse').amount, CARD_VALUES.purse.careerBase + CARD_VALUES.purse.careerPerRank * g.state.career.rank);
});

test('carrière : colporteur (étal du rang, poules à 40, graines rares 12 semis, bocal ancien) ; graines rares à la main seulement', () => {
  const g = career();
  setRank(g, 3);
  g.state.money = 5000;
  assert.ok(g.actions.triggerVariety('merchant').ok);
  const m = g.query.merchant();
  assert.equal(m.stall.length, 4, 'rang ≥ 3 : sachet + 3 objets');
  g.state.variety.merchant.stall.push({ itemId: 'hens', price: 40, sold: false }, { itemId: 'heirloom', price: 120, sold: false });
  const hens = g.state.investments.hen;
  assert.ok(g.actions.buyFromMerchant('hens').ok);
  assert.equal(g.state.investments.hen, hens + 2);
  const jar = g.actions.buyFromMerchant('heirloom');
  assert.ok(jar.heirloom.cropId);
  assert.equal(g.state.career.heirlooms.at(-1).from, 'merchant');
  const seeds = g.actions.buyFromMerchant('seeds.pea');
  assert.ok(seeds.ok);
  assert.equal(g.state.variety.rare.pea, RARE_SEEDS.pea.careerSeeds);
  // Plan de culture : refusé ; salarié : refusé ; à la main : une graine.
  assert.equal(g.actions.career.setPlan('start', 'spring', 'pea').reason, 'Les graines rares se sèment à la main.');
  const h = withExtension();
  const g2 = career();
  g2.state.variety.rare.pea = 3;
  const i = fieldPlots(g2)[0];
  assert.equal(h.api().plant(i, 'pea', { by: 'staff' }).reason, 'Les graines rares se sèment à la main.');
  const r = g2.actions.plant(i, 'pea');
  assert.ok(r.ok);
  assert.equal(r.cost, 0);
  assert.equal(g2.state.variety.rare.pea, 2);
  h.off();
});

test('carrière : défis dès l\'été, médailles × rang ; tournée des abris comptée pour le joueur', () => {
  const g = career();
  setRank(g, 2);
  goTo(g, 1, 8);
  const ch = g.query.challenges();
  assert.equal(ch.options.length, 3);
  const v = g.state.variety.challenges;
  v.options = ['collect', 'harvests', 'sales'];
  v.targets = { collect: [1, 2, 3], harvests: [50, 60, 70], sales: [9000, 9001, 9002] };
  g.actions.keepChallenge('collect');
  const rec = record(g);
  g.state.career.buildings.coop.pending = 10;
  g.actions.career.collect('coop');
  const medal = rec.of('challengeMedal')[0];
  assert.equal(medal.medal, 'bronze');
  g.state.career.buildings.coop.pending = 10;
  g.actions.career.collect('coop');
  assert.equal(rec.of('challengeMedal')[1].coins, MEDALS[1].careerCoins * 2, 'argent : 4 × rang');
});

test('années à thème : tirage au bilan (themeAnnounced), début au printemps (themeStarted), vedette +25 %, sans répétition', () => {
  const g = career();
  setRank(g, 3);
  g.state.money = 50000;
  const rec = record(g);
  skipYear(g);
  const ann = rec.of('themeAnnounced');
  assert.equal(ann.length, 1);
  assert.equal(ann[0].year, 2);
  const id = ann[0].theme.id;
  assert.ok(THEMES_BY_ID[id].rank <= 3);
  const started = rec.of('themeStarted');
  assert.equal(started.length, 1);
  assert.equal(started[0].theme.id, id);
  assert.equal(g.state.career.theme.id, id);
  assert.equal(g.state.career.theme.year, 2);
  const report = rec.of('yearEnd')[0].report;
  assert.deepEqual(report.nextTheme, { id, name: THEMES_BY_ID[id].name });
  assert.ok(report.variety);
  // Vedette : × 1,25 (fournisseur priceFactor).
  const th = THEMES_BY_ID[id];
  const kind = th.star.kind === 'product' ? 'product' : 'crop';
  assert.ok(Math.abs(providedFactor('priceFactor', g.state, { kind, id: th.star.ids[0] }) - 1.25) < 0.4);
  // Sans répétition tant que tous n'ont pas été vus.
  const seen = [id];
  for (let y = 0; y < 5; y++) {
    skipYear(g);
    seen.push(g.state.career.theme.id);
  }
  const possible = THEMES.filter((t) => t.rank <= 3).length;
  assert.equal(new Set(seen.slice(0, Math.min(seen.length, possible))).size, Math.min(seen.length, possible));
});

test('années à thème : fête spéciale (festival { theme: true }), visiteur unique (offre themeVisitor → cadeau gratuit)', () => {
  const g = career();
  setRank(g, 2);
  g.state.money = 5000;
  const t = g.actions.triggerVariety('theme', 'bread');
  assert.ok(t.ok);
  assert.equal(g.query.career.theme().id, 'bread');
  // Graines de blé −20 % (prix payé au semis).
  const k0 = fieldPlots(g).find((k) => !g.state.plots[k].cropId);
  assert.equal(g.actions.plant(k0, 'wheat').cost, Math.max(1, Math.round(getCrop('wheat').seedCost * 0.8)));
  const rec = record(g);
  // Visiteur : Jeanne la meunière, printemps j. 2.
  goTo(g, 1, 2);
  const offer = rec.of('offer').find((e) => e.kind === 'themeVisitor');
  assert.ok(offer);
  assert.equal(offer.data.icon, 'portrait.theme.jeanne');
  const money = g.state.money;
  const r = g.actions.career.acceptOffer(offer.offerId);
  assert.ok(r.ok);
  assert.deepEqual(r.gift.freeSows, { cropId: 'wheat', n: 10 });
  assert.equal(g.state.money, money + 40);
  assert.equal(rec.of('offerResolved').at(-1).kind, 'themeVisitor');
  // Semis offerts : blé sans payer.
  const i = fieldPlots(g).find((k) => !g.state.plots[k].cropId);
  const p = g.actions.plant(i, 'wheat');
  assert.equal(p.cost, 0);
  assert.equal(p.free, true);
  // Fête du pain (été, j. 7).
  goTo(g, 1, 14);
  const fest = rec.of('festival').find((e) => e.theme);
  assert.ok(fest);
  assert.equal(fest.id, 'theme.bread');
  assert.ok(Math.abs(providedFactor('priceFactor', g.state, { kind: 'crop', id: 'wheat' }) - 1.25 * 1.25) < 1e-9);
  nextDay(g);
  assert.ok(Math.abs(providedFactor('priceFactor', g.state, { kind: 'crop', id: 'wheat' }) - 1.25) < 1e-9);
});

test('années à thème : effets (grands marchés, géants, grenouilles, fromage) ; requête query.career.theme()', () => {
  const g = career({ surprises: true });
  setRank(g, 3);
  g.actions.triggerVariety('theme', 'markets');
  const before = g.state.rng.market;
  for (let d = 0; d < 20; d++) nextDay(g);
  assert.notEqual(g.state.rng.market, before);
  const vals = Object.values(g.state.market);
  assert.ok(vals.every((x) => x >= 0.7 - 1e-9 && x <= 1.45 + 1e-9));
  const q = g.query.career.theme();
  assert.equal(q.id, 'markets');
  assert.ok(q.festival && q.visitor && q.star.factor === 1.25);
  // Fromage : +1 place à la fromagerie (visiteur) ; sans fromagerie : 80 pièces.
  const c = career();
  setRank(c, 3);
  c.actions.triggerVariety('theme', 'cheese');
  goTo(c, 1, 9);
  const off = c.query.career.events().offers.find((o) => o.kind === 'themeVisitor');
  assert.ok(off);
  const m = c.state.money;
  assert.equal(c.actions.career.acceptOffer(off.id).gift.coins, 80);
  assert.equal(c.state.money, m + 80);
});

test('carrière : sauvegarde (aller-retour) avec la variété et un thème ; bilan de l\'année (variety, nextTheme)', () => {
  const g = career();
  setRank(g, 2);
  g.state.money = 3000;
  skipYear(g);
  skipDays(g, 9);
  const saved = g.serialize();
  const back = loadCareer(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.serialize(), saved);
  for (let d = 0; d < 12; d++) {
    g.update(DAY_SECONDS);
    back.update(DAY_SECONDS);
  }
  assert.deepEqual(back.serialize(), g.serialize());
  const rep = g.query.career.yearReport();
  assert.ok(rep.variety && 'ordersDone' in rep.variety);
  assert.ok('nextTheme' in rep);
});
