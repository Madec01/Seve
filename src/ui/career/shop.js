// Mode Carrière — onglet « Acheter » (docs/CARRIERE.md § 10.3) : sections repliables (en-têtes ≥ 48 px)
// Terrains · Bâtiments · Animaux · Machines · Ateliers · Aménagements. Un élément verrouillé reste
// visible, grisé, avec « Rang N ».

import { el, fmt, plural } from '../dom.js';
import { icon, seasonIncomes, spriteAny } from '../icons.js';
import { animalIcon, buildingIcon, buyButton, cBtn, cIcon, foldSection, lotIcon, machineIcon, pips, lotPhrase, lotWhere, nextLines, roleLine } from './util.js';

const WORKSHOP_IDS = ['jamWorkshop', 'dairy', 'mill', 'cannery', 'spinningMill'];

/** Effets d'un niveau de bâtiment, en français court. */
export function effectsText(e = {}) {
  const out = [];
  if (e.staff !== undefined) out.push(e.staff ? `${plural(e.staff, 'employé')} au plus` : 'Pas d\'employé');
  if (e.tiredDays && e.staff) out.push(`las après ${e.tiredDays} jours`);
  if (e.yearEcus) out.push(`+${e.yearEcus} écus au bilan`);
  if (e.capacity) out.push(`stock : ${plural(e.capacity, 'unité')}`);
  if (e.plots) out.push(`${plural(e.plots, 'parcelle')}`);
  if (e.winterGrowth !== undefined && e.plots) out.push(e.winterGrowth >= 1 ? 'pousse normale en hiver' : 'pousse ×½ en hiver');
  if (e.heating) out.push(`chauffage ${e.heating} / jour d'hiver`);
  if (e.priceBonus) out.push(`ventes +${Math.round(e.priceBonus * 100)} %`);
  if (e.passersby && e.passersby > 1) out.push(`passants ×${e.passersby}`);
  if (e.incomeFactor && e.incomeFactor !== 1) out.push(`revenus ×${String(e.incomeFactor).replace('.', ',')}`);
  if (e.animals) out.push(`${plural(e.animals, 'animal', 'animaux')} au plus`);
  if (e.places) out.push(`${plural(e.places, 'place')}`);
  return out.join(' · ');
}

/**
 * Carte d'un bâtiment à niveaux (Acheter, fiches de terrain).
 * opts : { compact (sans le niveau suivant), lines (fiche du bâtiment : les lignes du niveau suivant au-dessus du
 *          bouton, sans rappeler le rôle déjà écrit en haut de la fiche) }
 */
export function buildingCard(ui, b, { compact = false, lines = false } = {}) {
  const { app } = ui;
  const maxed = b.level >= b.maxLevel;
  const built = b.level > 0;
  const label = built ? (maxed ? 'Niveau max' : `Niveau ${b.level + 1}`) : 'Construire';
  const nextTitle = `${built ? 'Niveau suivant' : 'Niveau 1'}${b.nextName ? ` : ${b.nextName}` : ''}`;
  return el(
    `article.card.c-card${built ? '.is-owned' : ''}${maxed ? '.is-maxed' : ''}`,
    { id: `c-bld-${b.id}` },
    el('div.card-icon', buildingIcon(b.id, Math.max(1, b.level), 'sprite--card')),
    el(
      'div.card-main',
      el('div.card-top', el('span.card-name', b.name), built ? pips(b.level, b.maxLevel) : el('span.card-owned', 'à construire')),
      !lines ? roleLine(b.role) : null,
      built && b.effects && !lines ? el('div.card-desc', effectsText(b.effects)) : null,
      !maxed && lines && b.nextEffectLines?.length ? nextLines(b.nextEffectLines, nextTitle) : null,
      !maxed && b.nextName && !compact && !(lines && (b.nextEffectLines?.length || !built)) ? el('div.card-desc.c-next', `${built ? 'Ensuite' : 'Niveau 1'} : ${b.nextName}${b.nextEffects ? ` · ${effectsText(b.nextEffects)}` : ''}`) : null,
    ),
    maxed
      ? null
      : el(
          'div.card-foot',
          buyButton(app, { id: `c-up-${b.id}`, label, cost: b.nextCost, can: b.canUpgrade, reason: b.reason, onClick: () => ui.act('upgradeBuilding', b.id) }),
          !b.canUpgrade && b.reason ? el('p.card-reason', b.reason) : null,
        ),
  );
}

export function shopContent(ui) {
  const { app, q, game } = ui;
  const cq = game.query.career;
  const next = q('nextLot', null);
  const lots = q('lots', []) || [];
  const buildings = q('buildings', []) || [];
  const invs = game.query.investments();
  const animals = invs.filter((i) => i.category === 'animal');
  const items = invs.filter((i) => i.category !== 'animal');
  const catalog = q('machineCatalog', []) || [];
  const machines = q('machines', []) || [];
  const money = game.state.money;

  // ── Terrains ──
  const lotSection = foldSection(app, {
    key: 'shop-lots',
    id: 'c-shop-lots',
    title: 'Terrains',
    iconNode: cIcon('land', 'sprite--sm', 'seed'),
    badge: lots.some((l) => l.forSale && l.canBuy) ? 'à vendre' : null,
    open: true,
    content: () => [
      next ? lotSaleCard(ui, next, { main: true }) : el('p.sheet-empty', 'Tous les terrains sont achetés : la ferme est complète !'),
      otherSales(ui, lots, next),
      unbuiltLots(ui, lots),
      cBtn(app, [cIcon('map', 'sprite--sm', 'seed'), 'Voir la carte des terrains'], () => ui.open.map(), { id: 'c-shop-map', cls: 'btn--wide' }),
    ],
  });

  // ── Bâtiments (maison, grenier, étal, serre, chambre d'hôte…) ──
  const mainBuildings = buildings.filter((b) => b.category !== 'shelter' && b.category !== 'workshop');
  const bldSection = foldSection(app, {
    key: 'shop-buildings',
    title: 'Bâtiments',
    iconNode: cIcon('house', 'sprite--sm', 'coin'),
    badge: mainBuildings.some((b) => b.canUpgrade) ? 'possible' : null,
    content: () => [
      el('p.shop-intro', 'La maison loge les employés, le grenier garde les récoltes pour les vendre au bon moment, l\'étal fait vendre plus cher.'),
      mainBuildings.map((b) => buildingCard(ui, b)),
    ],
  });

  // ── Animaux (par abri) ──
  const animalSection = foldSection(app, {
    key: 'shop-animals',
    title: 'Animaux',
    iconNode: animalIcon('hen', 'sprite--sm'),
    content: () => [
      el('p.shop-intro', 'Chaque espèce vit dans son abri, construit dans un pré (ou la basse-cour). Touchez l\'abri pour ramasser ses produits.'),
      animals.map((a) => animalCard(ui, a, buildings)),
    ],
  });

  // ── Machines ──
  const machineSection = foldSection(app, {
    key: 'shop-machines',
    title: 'Machines',
    iconNode: machineIcon('sprinklers', 'sprite--sm'),
    content: () =>
      catalog.length
        ? [el('p.shop-intro', 'Les machines travaillent seules sur leur terrain. Elles coûtent un peu de carburant les jours où elles travaillent.'), catalog.map((m) => machineCard(ui, m, machines))]
        : [el('p.sheet-empty', 'Les machines arrivent bientôt : arroseurs dès le rang 2, puis semoir, moissonneuse et tracteur.')],
  });

  // ── Ateliers ──
  const workshops = buildings.filter((b) => b.category === 'workshop');
  const workshopRows = WORKSHOP_IDS.map((id) => workshops.find((b) => b.id === id) || safeBuilding(cq, id)).filter(Boolean);
  const courts = lots.filter((l) => l.type === 'workshops');
  const workshopSection = foldSection(app, {
    key: 'shop-workshops',
    title: 'Ateliers',
    iconNode: buildingIcon('jamWorkshop', 1, 'sprite--sm'),
    content: () => [
      el('p.shop-intro', courts.length ? 'Les ateliers se construisent dans une cour des ateliers. Ils transforment vos récoltes en produits plus chers.' : 'Aménagez un terrain en « Cour des ateliers » (rang 2) pour y construire des ateliers.'),
      workshopRows.map((b) => (b.level > 0 ? workshopCard(ui, b) : buildSlotCard(ui, b, courts, money))),
    ],
  });

  // ── Aménagements (ruches, panneaux solaires) ──
  const itemSection = foldSection(app, {
    key: 'shop-items',
    title: 'Aménagements',
    iconNode: cIcon('patrimony', 'sprite--sm', 'coin'),
    content: () => items.map((i) => itemCard(ui, i)),
  });

  return el('div.c-shop', lotSection, bldSection, animalSection, machineSection, workshopSection, itemSection);
}

/** Carte d'un terrain à vendre : nom, place sur la carte, prix, charges, « Acheter » (ce terrain-là) et « Voir ». */
export function lotSaleCard(ui, lot, { main = false } = {}) {
  const { app } = ui;
  const locked = !lot.buyable && !lot.canBuy;
  const why = lot.lockedReason || lot.reason;
  return el(
    `article.card.c-card.c-lot-card${locked ? '.is-locked' : ''}`,
    { id: `c-sale-${lot.id}` },
    el('div.card-icon', lotIcon('forSale', 'sprite--card')),
    el(
      'div.card-main',
      el('div.card-top', el('span.card-name', lot.name), lot.special ? el('span.card-owned.is-some', 'offre spéciale') : lot.lockedByRank ? el('span.card-owned', `Rang ${lot.lockedByRank}`) : null),
      el('div.card-desc.c-where', lotWhere(lot)),
      el('div.card-desc', `En friche : vous choisirez son aménagement (champ, pré, verger…). Charges de saison : +${fmt(lot.chargeIncrease ?? 0)} par saison.`),
    ),
    el(
      'div.card-foot',
      buyButton(app, { id: main ? 'c-shop-lot' : `c-shop-buy-${lot.id}`, label: 'Acheter ce terrain', cost: lot.price, can: lot.canBuy, reason: why, onClick: () => ui.buyLot(lot.id) }),
      !lot.canBuy && why ? el('p.card-reason', why) : null,
      typeof app.scene?.focusLot === 'function' ? cBtn(app, 'Voir sur la ferme', () => ui.showLot(lot.id), { id: `c-shop-see-${lot.id}`, cls: 'btn--wide.btn--small' }) : null,
    ),
  );
}

/** Les autres terrains de la lisière (à gauche, à droite, au-dessus) : achetables d'abord, puis verrouillés. */
function otherSales(ui, lots, next) {
  const rest = lots.filter((l) => l.forSale && l.id !== next?.id).sort((a, b) => Number(b.buyable) - Number(a.buyable) || a.price - b.price || Math.abs(a.col) - Math.abs(b.col) || a.row - b.row);
  if (!rest.length) return null;
  const { app } = ui;
  const row = (l) =>
    el(
      'article.c-map-row.is-forsale',
      { id: `c-sale-${l.id}` },
      el('button.c-map-open', { type: 'button', onclick: () => ui.open.lot(l.id), 'aria-label': `Voir : ${l.name}` }, el('span.c-map-icon', l.buyable ? lotIcon('forSale', 'sprite--md') : icon('lock', 'md')), el('div.c-map-main', el('b', l.name), el('small', lotWhere(l)), l.buyable ? null : el('small', l.lockedReason || l.reason || 'Plus tard'))),
      l.buyable ? buyButton(app, { id: `c-shop-buy-${l.id}`, label: 'Acheter', cost: l.price, can: l.canBuy, reason: l.reason, cls: 'btn--compact', onClick: () => ui.buyLot(l.id) }) : null,
    );
  return el('div.c-sales', el('h3.stats-title', `Autres terrains à vendre (${rest.length})`), el('div.c-map-list', rest.map(row)));
}

function safeBuilding(cq, id) {
  try {
    return typeof cq.building === 'function' ? cq.building(id) : null;
  } catch {
    return null;
  }
}

/** Terrains achetés mais encore en friche : à aménager. */
function unbuiltLots(ui, lots) {
  const wild = lots.filter((l) => l.bought && l.type === 'wild');
  if (!wild.length) return null;
  return el(
    'div.c-wild-list',
    wild.map((l) =>
      el(
        'button.c-row',
        { type: 'button', id: `c-shop-develop-${l.id}`, onclick: () => ui.open.lot(l.id) },
        lotIcon('wild', 'sprite--md'),
        el('span.c-row-main', el('b', l.name), el('small', 'En friche : touchez pour l\'aménager')),
        el('span.c-row-go', '›'),
      ),
    ),
  );
}

function animalCard(ui, a, buildings) {
  const { app } = ui;
  const sh = a.shelter;
  const shelter = sh ? buildings.find((b) => b.id === sh.id) : null;
  const locked = a.lockedByRank;
  const perDay = Object.values(a.incomeBySeason || {}).some((v) => v > 0);
  const maxed = sh && sh.built && a.owned >= a.max;
  return el(
    `article.card.c-card${a.owned ? '.is-owned' : ''}${locked ? '.is-locked' : ''}`,
    { id: `c-animal-${a.id}` },
    el('div.card-icon', animalIcon(a.id, 'sprite--card')),
    el(
      'div.card-main',
      el('div.card-top', el('span.card-name', a.name), el('span.card-owned', sh?.built ? `${a.owned}/${a.max}` : locked ? `Rang ${locked}` : 'pas d\'abri')),
      a.role ? roleLine(a.role) : el('div.card-desc', a.description || ''),
      el(
        'div.card-stats',
        perDay ? el('span.stat.stat--wide', el('span.stat-label', 'Par jour'), seasonIncomes(a.incomeBySeason, 1, ui.game.query.calendar().seasonId)) : null,
        a.effects?.shearing ? el('span.stat', el('span.stat-label', 'Tonte'), el('b.pos', `+${fmt(a.effects.shearing)}`)) : null,
        a.upkeep ? el('span.stat', el('span.stat-label', 'Entretien'), el('b.neg', `−${a.upkeep} / jour`)) : null,
        sh ? el('span.stat', el('span.stat-label', 'Abri'), el('b', sh.built ? `${sh.name} niv. ${sh.level}` : sh.name)) : null,
        a.collect ? el('span.stat', el('span.stat-label', 'Produits'), el('b', 'à ramasser')) : null,
      ),
    ),
    el(
      'div.card-foot',
      maxed && shelter && shelter.level < shelter.maxLevel
        ? buyButton(app, { id: `c-up-${sh.id}`, label: `Agrandir : ${shelter.nextName || 'niveau suivant'}`, cost: shelter.nextCost, can: shelter.canUpgrade, reason: shelter.reason, onClick: () => ui.act('upgradeBuilding', sh.id) })
        : buyButton(app, { id: `c-buy-${a.id}`, label: a.owned ? `Encore ${a.id === 'hen' ? 'une' : 'un'}` : 'Acheter', cost: a.nextCost, can: a.canBuy, reason: a.reason, onClick: () => buyInv(ui, a.id) }),
      !a.canBuy && a.reason && !maxed ? el('p.card-reason', a.reason) : null,
      sh && !sh.built && !locked ? cBtn(app, 'Construire un abri (fiche d\'un pré)', () => ui.open.map(), { cls: 'btn--wide.btn--small' }) : null,
    ),
  );
}

export function buyInv(ui, id) {
  const res = ui.app.buyInvestment(id);
  ui.schedule();
  return res;
}

function itemCard(ui, i) {
  const { app } = ui;
  const maxed = i.nextCost === null;
  const e = i.effects || {};
  return el(
    `article.card.c-card${i.owned ? '.is-owned' : ''}${maxed ? '.is-maxed' : ''}`,
    { id: `c-item-${i.id}` },
    el('div.card-icon', itemIcon(i.id)),
    el(
      'div.card-main',
      el('div.card-top', el('span.card-name', i.name), el('span.card-owned', `${i.owned}/${i.max}`)),
      i.role ? roleLine(i.role) : el('div.card-desc', i.description || ''),
      el(
        'div.card-stats',
        Object.values(i.incomeBySeason || {}).some((v) => v > 0) ? el('span.stat.stat--wide', el('span.stat-label', 'Par jour'), seasonIncomes(i.incomeBySeason, 1, ui.game.query.calendar().seasonId)) : null,
        e.growthBonus ? el('span.stat', el('span.stat-label', 'Pousse'), el('b.pos', `+${Math.round(e.growthBonus * 100)} %`)) : null,
        e.chargeReduction ? el('span.stat', el('span.stat-label', 'Charges'), el('b.pos', `−${e.chargeReduction} / jour`)) : null,
      ),
    ),
    maxed
      ? null
      : el(
          'div.card-foot',
          buyButton(app, { id: `c-buy-${i.id}`, label: i.owned ? 'Encore un' : 'Acheter', cost: i.nextCost, can: i.canBuy, reason: i.reason, onClick: () => buyInv(ui, i.id) }),
          !i.canBuy && i.reason ? el('p.card-reason', i.reason) : null,
        ),
  );
}

function itemIcon(id) {
  return spriteAny(id === 'beehive' ? ['beehive'] : ['solar.panel'], 'sprite--card', id === 'beehive' ? 'star' : 'sunny');
}

function workshopCard(ui, b) {
  const { app } = ui;
  const card = buildingCard(ui, b);
  const open = cBtn(app, 'Ouvrir l\'atelier', () => app.field.openBuilding(b.id), { id: `c-open-${b.id}`, cls: 'btn--wide.btn--small', sound: 'page' }); // fiche de l'atelier (ou de la carrière)
  card.querySelector('.card-foot')?.prepend(open);
  if (!card.querySelector('.card-foot')) card.append(el('div.card-foot', open));
  return card;
}

/** Atelier pas encore construit : choix de la cour (emplacement libre). */
function buildSlotCard(ui, b, courts, money) {
  const { app } = ui;
  const free = [];
  for (const l of courts) (l.slots || []).forEach((s, k) => {
    if (!s) free.push({ lot: l, slot: k });
  });
  const opts = free.length ? ui.q('buildOptions', [], free[0].lot.id, free[0].slot) : [];
  const opt = opts.find((o) => o.buildingId === b.id);
  const reason = opt ? opt.reason : courts.length ? 'Plus d\'emplacement libre : aménagez une autre cour des ateliers.' : b.nextRank > ui.game.state.career.rank ? `Rang ${b.nextRank} requis.` : 'Il faut une cour des ateliers.';
  const can = !!opt?.canBuild;
  return el(
    `article.card.c-card${b.nextRank > ui.game.state.career.rank ? '.is-locked' : ''}`,
    { id: `c-bld-${b.id}` },
    el('div.card-icon', buildingIcon(b.id, 1, 'sprite--card')),
    el('div.card-main', el('div.card-top', el('span.card-name', b.name), el('span.card-owned', b.nextRank > ui.game.state.career.rank ? `Rang ${b.nextRank}` : 'à construire')), roleLine(b.role), b.nextEffects ? el('div.card-desc', effectsText(b.nextEffects)) : null),
    el(
      'div.card-foot',
      buyButton(app, {
        id: `c-build-${b.id}`,
        label: free.length ? `Construire (${lotPhrase(free[0].lot.name)})` : 'Construire',
        cost: b.nextCost ?? opt?.cost,
        can: can && money >= (opt?.cost ?? 0),
        reason,
        onClick: () => ui.act('build', free[0].lot.id, free[0].slot, b.id),
      }),
      !can && reason ? el('p.card-reason', reason) : null,
    ),
  );
}

/** Carte d'une machine du catalogue : installée où, « Installer sur… » (places du lot CORE-B). */
function machineCard(ui, m, machines) {
  const { app } = ui;
  const mine = machines.filter((x) => x.id === m.id);
  const locked = m.lockedByRank || (m.rank && m.rank > ui.game.state.career.rank ? m.rank : null);
  const places = (m.places || []).filter((p) => !p.owned);
  const where = mine.map((x) => x.lotName || x.name).filter(Boolean);
  return el(
    `article.card.c-card${mine.length ? '.is-owned' : ''}${locked ? '.is-locked' : ''}`,
    { id: `c-machine-${m.id}` },
    el('div.card-icon', machineIcon(m.id, 'sprite--card')),
    el(
      'div.card-main',
      el('div.card-top', el('span.card-name', m.name), el('span.card-owned', locked ? `Rang ${locked}` : mine.length ? (m.scope === 'farm' ? 'installé' : `${mine.length} installé${mine.length > 1 ? 's' : ''}`) : m.scope === 'farm' ? 'pour la ferme' : m.scope === 'shelter' ? 'par abri' : 'par terrain')),
      m.role ? roleLine(m.role) : m.description ? el('div.card-desc', m.description) : null,
      el(
        'div.card-stats',
        el('span.stat', el('span.stat-label', 'Prix'), el('b', fmt(m.cost))),
        m.fuel ? el('span.stat', el('span.stat-label', 'Carburant'), el('b.neg', `${m.fuel} / jour de travail`)) : null,
        m.upkeep ? el('span.stat', el('span.stat-label', 'Entretien'), el('b.neg', `−${m.upkeep} / jour`)) : null,
        m.levels?.[0]?.requires ? el('span.stat', el('span.stat-label', 'Il faut'), el('b', requiresText(m.levels[0].requires))) : null,
        where.length && m.scope !== 'farm' ? el('span.stat.stat--wide', el('span.stat-label', 'Sur'), el('b', where.join(', '))) : null,
      ),
    ),
    el(
      'div.card-foot',
      places.length
        ? places.map((p) => buyButton(app, { id: `c-mbuy-${m.id}-${p.place || 'farm'}`, label: m.scope === 'farm' ? 'Acheter' : `Installer : ${p.name}`, cost: m.cost, can: p.canBuy, reason: p.reason, onClick: () => ui.act('buyMachine', m.id, p.place) }))
        : el('p.card-reason', m.reason || (mine.length ? 'Déjà installée partout où c\'est possible.' : 'Aucun emplacement compatible pour l\'instant.')),
      places.length && !places.some((p) => p.canBuy) && m.reason ? el('p.card-reason', m.reason) : null,
    ),
  );
}

/** « cheval ou tracteur » : ce qu'il faut pour qu'une machine travaille. */
export function requiresText(r) {
  if (!r) return '';
  if (Array.isArray(r)) return r.map(requiresText).join(' ou ');
  return { puller: 'un cheval ou le tracteur', horse: 'un cheval', tractor: 'le tracteur' }[r] || String(r);
}
