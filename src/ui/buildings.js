// Ateliers (transformation) : fiche d'un atelier en feuille du bas et lignes de recette partagées
// avec l'onglet « Acheter ».
//
// Fiche (atelier possédé) : grand interrupteur « Transformer mes récoltes » / « Transformer le
// lait », rangée des places (produit + jours restants, place vide en pointillés), valeur en cours,
// « Vendre en l'état » (confirmation), recettes, amélioration. Atelier pas encore acheté : sa
// description, ses recettes, sa condition et le bouton d'achat.
//
// Exports : isProcessing(inv), recipesOf(game, inv), recipeLine(r, opts), buildingContent(app, id),
//           buildingSignature(game, id), processingOf(game, id), nextLevelLabel(inv)

import { getCrop } from '../data/crops.js';
import { getInvestment } from '../data/investments.js';
import { v3 } from './v3.js';
import { el, fmt, plural } from './dom.js';
import { icon, inputIcon, investmentIcon, productIcon } from './icons.js';

/** L'investissement est-il un atelier (transformation) ? */
export function isProcessing(inv) {
  return !!(inv && (inv.category === 'processing' || inv.effects?.processing || inv.processing));
}

/** État d'un atelier (query.processing), ou null (pas possédé, ou cœur v2). */
export function processingOf(game, id) {
  if (!game || typeof game.query.processing !== 'function') return null;
  try {
    return game.query.processing().find((b) => b.buildingId === id) || null;
  } catch {
    return null;
  }
}

/** Valeur brute de l'entrée d'une recette (prix de la récolte, ou revenu du jour de l'animal). */
function inputValue(input) {
  const c = getCrop(input);
  if (c) return c.sellPrice;
  const inv = getInvestment(input);
  if (inv?.income) return typeof inv.income === 'number' ? inv.income : inv.income.spring || 0;
  return null;
}

function inputName(input) {
  if (input === 'cow') return 'Lait de vache';
  if (input === 'goat') return 'Lait de chèvre';
  return getCrop(input)?.name || input;
}

/**
 * Recettes d'un atelier : celles de query.investments() (processing.recipes) si le cœur les
 * donne, sinon celles de src/data/products.js.
 * → [{ input, inputName, inputValue, productId, productName, days, value, active, minLevel, maxLevel }]
 */
export function recipesOf(game, inv) {
  const level = inv?.processing?.level ?? inv?.owned ?? 0;
  const list = inv?.processing?.recipes;
  const data = (v3.products?.PRODUCTS || []).filter((p) => p.building === inv?.id);
  if (Array.isArray(list) && list.length) {
    return list.map((r) => {
      const d = data.find((p) => p.id === r.productId) || {};
      return { ...r, inputName: r.inputName || inputName(r.input), inputValue: r.inputValue ?? inputValue(r.input), minLevel: d.minLevel, maxLevel: d.maxLevel };
    });
  }
  const lv = Math.max(1, level);
  return data.map((p) => ({
    input: p.input,
    inputName: inputName(p.input),
    inputValue: inputValue(p.input),
    productId: p.id,
    productName: p.name,
    days: p.days,
    value: p.value,
    minLevel: p.minLevel,
    maxLevel: p.maxLevel,
    active: (!p.minLevel || lv >= p.minLevel) && (!p.maxLevel || lv <= p.maxLevel),
  }));
}

/** « [fraise] 26 → [confiture] Confiture de fraises 46 · 2 j » */
export function recipeLine(r, { compact = false } = {}) {
  const cond = !r.active && r.minLevel ? `niveau ${r.minLevel}` : !r.active && r.maxLevel ? `jusqu'au niveau ${r.maxLevel}` : null;
  return el(
    `div.recipe${r.active === false ? '.is-off' : ''}`,
    el('span.recipe-in', inputIcon(r.input, 'sprite--sm'), r.inputValue != null ? el('b', fmt(r.inputValue)) : null),
    el('span.recipe-arrow', { 'aria-hidden': 'true' }, '→'),
    el('span.recipe-out', productIcon(r.productId, 'sprite--sm'), compact ? null : el('span.recipe-name', r.productName), el('b.pos', fmt(r.value))),
    el('span.recipe-days', `· ${r.days} j`),
    cond ? el('span.recipe-cond', `(${cond})`) : null,
  );
}

/** Libellé du niveau suivant d'un atelier (« +1 place », moulin niveau 3 : four à pain). */
export function nextLevelLabel(inv) {
  if (!inv || inv.nextCost === null || inv.nextCost === undefined) return null;
  if (!inv.owned) return 'Acheter';
  if (inv.id === 'mill' && inv.owned === 2) return 'Four à pain : du pain au lieu de la farine';
  return '+1 place';
}

function placesText(n) {
  return plural(n, 'place');
}

function sourceOf(inv) {
  return inv?.effects?.processing?.source || inv?.processing?.source || (inv?.id === 'dairy' ? 'animal' : 'harvest');
}

/** Tuile d'une place : produit + « 2 j » / « prêt à l'aube », ou place vide en pointillés. */
function placeTile(place, i) {
  if (!place) {
    return el('div.place.is-empty', { role: 'listitem', 'aria-label': `Place ${i + 1} : libre` }, el('span.place-empty', 'libre'));
  }
  const ready = place.daysLeft <= 1;
  const days = place.days || Math.max(place.daysLeft, 1);
  const done = Math.max(0, Math.min(1, 1 - (place.daysLeft - 1) / Math.max(1, days)));
  return el(
    `div.place${ready ? '.is-ready' : ''}`,
    { role: 'listitem', 'aria-label': `Place ${i + 1} : ${place.productName}, ${ready ? 'prêt à l\'aube' : `encore ${plural(place.daysLeft, 'jour')}`}` },
    productIcon(place.productId, 'sprite--md'),
    el('span.place-days', ready ? 'à l\'aube' : `${place.daysLeft} j`),
    el('span.place-bar', el('span.place-bar-fill', { style: { width: `${Math.round(done * 100)}%` } })),
  );
}

/**
 * Contenu de la fiche d'un atelier.
 * actions : { toggle(id), sellRaw(id), buy(id), shop(id) } (câblées par field.js)
 */
export function buildingContent(app, id, actions) {
  const game = app.game;
  const inv = game.query.investments().find((i) => i.id === id);
  if (!inv) return el('div.info-sheet', el('p', 'Atelier inconnu.'));
  const proc = processingOf(game, id);
  const source = sourceOf(inv);
  const recipes = recipesOf(game, inv);
  const maxed = inv.nextCost === null;
  const nodes = [];

  if (inv.owned && proc) {
    const on = !!proc.on;
    nodes.push(
      el(
        `button.proc-switch${on ? '.is-on' : ''}`,
        {
          type: 'button',
          role: 'switch',
          id: 'bld-switch',
          'aria-checked': on ? 'true' : 'false',
          onclick: () => actions.toggle(id, !on),
        },
        el('span.proc-switch-track', el('span.proc-switch-knob')),
        el(
          'span.proc-switch-text',
          el('span.proc-switch-label', source === 'animal' ? 'Transformer le lait' : 'Transformer mes récoltes'),
          el('span.proc-switch-state', on ? (source === 'animal' ? 'Allumé : le lait part à l\'atelier s\'il reste une place' : 'Allumé : les récoltes compatibles y partent s\'il reste une place') : 'Éteint : rien n\'entre, tout se vend comme d\'habitude'),
        ),
      ),
    );
    const places = proc.places || [];
    const used = places.filter(Boolean).length;
    nodes.push(el('div.places', { role: 'list', 'aria-label': 'Places de l\'atelier' }, places.map(placeTile)));
    nodes.push(
      el(
        'p.proc-summary',
        used
          ? [`En cours : ${plural(used, 'produit')}, valeur à la vente `, el('b.pos', fmt(proc.value)), used < places.length ? ` · ${plural(places.length - used, 'place libre', 'places libres')}` : ' · atelier plein']
          : `Aucun produit en cours · ${plural(places.length, 'place libre', 'places libres')}.`,
      ),
    );
    if (used) {
      nodes.push(
        el(
          'button.btn.btn--wide.btn--sellraw',
          { type: 'button', id: 'bld-sellraw', onclick: () => actions.sellRaw(id, proc) },
          icon('coin', 'sm'),
          `Vendre en l'état (+${fmt(proc.rawValue)})`,
        ),
      );
      nodes.push(el('p.sheet-hint', 'Vendus en l\'état, les produits rapportent le prix de la matière première. Utile avant un fermage.'));
    }
  } else {
    nodes.push(el('p.bld-desc', inv.description));
  }

  // Recettes
  nodes.push(
    el(
      'section.bld-recipes',
      el('h3.bld-title', source === 'animal' ? 'Recettes (lait du matin)' : 'Recettes (à la récolte)'),
      recipes.map((r) => recipeLine(r)),
    ),
  );

  // Faits : places, entretien, niveau
  const facts = [];
  const placesNow = inv.processing?.places ?? proc?.capacity ?? inv.effects?.processing?.places?.[Math.max(0, inv.owned - 1)];
  if (inv.owned) facts.push(el('span', icon('seed', 'xs'), `Niveau ${inv.owned}/${inv.max} · ${placesText(placesNow || 0)}`));
  else if (inv.effects?.processing?.places) facts.push(el('span', icon('seed', 'xs'), placesText(inv.effects.processing.places[0])));
  if (inv.upkeep) facts.push(el('span.neg', `Entretien −${fmt(inv.upkeep)} / jour`));
  if (facts.length) nodes.push(el('div.bld-facts', facts));

  if (!maxed && !inv.canBuy && inv.reason) nodes.push(el('p.card-reason', inv.reason));
  nodes.push(
    el(
      'div.sheet-actions',
      el('button.btn.btn--wide', { type: 'button', onclick: () => actions.shop(id) }, icon('coin', 'sm'), 'Tous les achats'),
      maxed
        ? null
        : el(
            `button.btn.btn--wide${inv.canBuy ? '.btn--red' : '.is-disabled'}`,
            { type: 'button', id: 'inv-buy', 'aria-disabled': inv.canBuy ? 'false' : 'true', onclick: () => actions.buy(id) },
            el('span.buy-label', nextLevelLabel(inv)),
            el('span.buy-cost', icon('coin', 'sm'), fmt(inv.nextCost)),
          ),
    ),
  );
  return el('div.info-sheet.bld-sheet', nodes);
}

/** Résumé de ce qu'affiche la fiche (reconstruite seulement s'il change). */
export function buildingSignature(game, id) {
  const inv = game.query.investments().find((i) => i.id === id);
  return JSON.stringify([inv, processingOf(game, id)]);
}

export { investmentIcon };
