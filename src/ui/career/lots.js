// Mode Carrière — carte des terrains (§ 10.4), fiche d'un terrain (§ 10.5 : aménagement, plan de
// culture, machines, équipe, emplacements de bâtiments), choix d'un bâtiment à construire, plan de
// culture d'une saison.

import { el, fmt, plural } from '../dom.js';
import { icon } from '../icons.js';
import { season } from '../text.js';
import { getCrop } from '../../data/crops.js';
import {
  aboutSection, animalIcon, animalProductIcon, buildingIcon, buyButton, cBtn, cIcon, cropIcon, lotIcon, lotWhere, machineIcon, pips, portrait, roleLine,
  SEASON_ORDER, toggle, jobName,
} from './util.js';
import { buildingCard, effectsText } from './shop.js';

const TYPE_TEXT = {
  field: '16 parcelles labourées et ouvertes, clôture, place pour des arroseurs et 2 ruches.',
  meadow: '2 emplacements pour un abri d\'animaux ou la chambre d\'hôte.',
  orchard: '9 emplacements d\'arbres fruitiers (pommiers).',
  workshops: 'Pavés et 2 emplacements d\'atelier.',
  pond: 'Une mare pour les canards, et la pêche une fois par jour.',
  greenhouse: 'Serre vitrée : toutes les cultures en toute saison, sans gel.',
  wild: 'Herbe haute, souches et fleurs sauvages : on l\'aménagera plus tard.',
};

/** Résumé d'un terrain en une ligne (« Champ · 16 parcelles · arroseurs · Lucie »). */
export function lotSummary(ui, lot) {
  const parts = [lot.typeName || lot.type];
  if (lot.plots?.length) {
    const g = ui.game.state.plots;
    const growing = lot.plots.filter((i) => g[i]?.cropId).length;
    parts.push(`${plural(lot.plots.length, 'parcelle')}${growing ? ` (${growing} en culture)` : ''}`);
  }
  const bl = (lot.slots || []).filter(Boolean).map((s) => ui.q('building', null, s.buildingId)?.name).filter(Boolean);
  if (bl.length) parts.push(bl.join(', '));
  if (lot.id === 'home') {
    const b = ui.q('building', null, 'house');
    if (b) parts.push(b.name);
  }
  const m = (lot.machines || []).length;
  if (m) parts.push(plural(m, 'machine'));
  const names = (lot.staff || []).map((id) => ui.game.state.career.staff?.find((s) => s.id === id)?.name).filter(Boolean);
  if (names.length) parts.push(names.join(', '));
  return parts.join(' · ');
}

// ── Carte ───────────────────────────────────────────────────────────────────────
/** Nom court du type d'un terrain, pour une case de la carte (« Ateliers » plutôt que « Cour des ateliers »). */
const SHORT_TYPE = { field: 'Champ', meadow: 'Pré', orchard: 'Verger', workshops: 'Ateliers', pond: 'Mare', greenhouse: 'Serre', wild: 'Friche', yard: 'Basse-cour', home: 'Ferme' };

/**
 * Cases de la carte 2D : grid().cells (toute la grille), complétées par lots() (anciennes carrières : colonne 0
 * au-delà de la rangée 6). → { cols: [min, max], rows: [max … 0], at(col, row) → case }
 */
function mapCells(ui) {
  const { q } = ui;
  const grid = q('grid', null);
  const lots = q('lots', []) || [];
  const byKey = new Map();
  const key = (c, r) => `${c},${r}`;
  for (const c of grid?.cells || []) byKey.set(key(c.col, c.row), { ...c });
  for (const l of lots) {
    if (!Number.isInteger(l.col) || !Number.isInteger(l.row)) continue;
    if (l.fixed || ['home', 'start', 'yard'].includes(l.id)) continue;
    const k = key(l.col, l.row);
    const cur = byKey.get(k) || { col: l.col, row: l.row, id: l.id, name: l.name };
    cur.id = l.id;
    cur.name = l.name;
    cur.lot = l;
    cur.state = l.forSale ? (l.buyable ? 'buyable' : 'locked') : 'owned';
    cur.type = l.type;
    byKey.set(k, cur);
  }
  const home = byKey.get(key(0, 0)) || { col: 0, row: 0 };
  byKey.set(key(0, 0), { ...home, id: 'home', name: ui.q('summary', null)?.farmName || 'La ferme', state: 'home', type: 'home' });
  const bounds = grid?.bounds || { cols: [-2, 2], rows: [0, 6] };
  const shown = grid?.rows || [0, Math.max(1, ...lots.map((l) => l.row || 0))];
  const maxRow = Math.max(shown[1], Math.min(bounds.rows[1], shown[1] + 1), ...[...byKey.values()].filter((c) => c.state !== 'forest').map((c) => c.row));
  const cols = [Math.min(bounds.cols[0], grid?.cols?.[0] ?? 0), Math.max(bounds.cols[1], grid?.cols?.[1] ?? 0)];
  const rows = [];
  for (let r = maxRow; r >= 0; r--) rows.push(r);
  return { cols, rows, at: (c, r) => byKey.get(key(c, r)) || { col: c, row: r, id: null, state: 'forest' } };
}

/** Terrain regardé au centre de l'écran (id), pour « vous êtes ici ». */
export function lotInView(app) {
  const s = app.scene;
  try {
    const v = s?.viewRect?.();
    const b = v ? s.layout?.bandAt?.(v.y + v.h / 2, v.x + v.w / 2) : null;
    if (!b) return null;
    return ['start', 'yard', 'home'].includes(b.id) ? 'home' : b.id;
  } catch {
    return null;
  }
}

function cellLabel(c) {
  if (c.state === 'home') return 'Ferme';
  if (c.state === 'owned') return SHORT_TYPE[c.type] || c.lot?.typeName || 'Terrain';
  if (c.state === 'buyable') return c.lot?.price !== undefined ? fmt(c.lot.price) : 'À vendre';
  if (c.state === 'locked') return c.lot?.lockedByRank ? `Rang ${c.lot.lockedByRank}` : 'Fermé';
  return '';
}

function cellIcon(c) {
  if (c.state === 'home') return cIcon('house', 'sprite--sm', 'seed');
  if (c.state === 'owned') return lotIcon(c.type || 'wild', 'sprite--sm');
  if (c.state === 'buyable') return lotIcon('forSale', 'sprite--sm');
  if (c.state === 'locked') return icon('lock', 'sm');
  return null;
}

/** Toucher une case : le terrain à l'écran et sa fiche (ou sa feuille d'achat) ; forêt lointaine : un mot. */
function tapCell(ui, c) {
  const { app } = ui;
  if (c.state === 'forest' || !c.id) {
    app.audio.play('error', { volume: 0.5 });
    app.toasts.show({ kind: 'info', icon: 'lock', key: 'c-map-forest', text: `${c.name || 'Cette forêt'} : achetez d'abord un terrain qui la touche.`, duration: 2600 });
    return;
  }
  ui.open.lot(c.id);
}

export function mapContent(ui) {
  const { app, q } = ui;
  const lots = (q('lots', []) || []).slice();
  const canGo = typeof app.scene?.focusLot === 'function';
  const cells = mapCells(ui);
  const here = ui.mapHere ?? lotInView(app); // vue retenue à l'ouverture (la feuille couvre ensuite l'écran)
  const nCols = cells.cols[1] - cells.cols[0] + 1;
  const gridNode = el(
    'div.c-grid',
    { style: { gridTemplateColumns: `repeat(${nCols}, minmax(0, 1fr))` }, role: 'group', 'aria-label': 'Carte des terrains' },
    cells.rows.map((r) => {
      const out = [];
      for (let col = cells.cols[0]; col <= cells.cols[1]; col++) {
        const c = cells.at(col, r);
        const label = cellLabel(c);
        const isHere = here && c.id && (c.id === here || (c.state === 'home' && here === 'home'));
        out.push(
          el(
            `button.c-cell.is-${c.state}${c.type ? `.t-${c.type}` : ''}${isHere ? '.is-here' : ''}`,
            { type: 'button', id: c.id ? `c-cell-${c.id}` : null, 'aria-label': `${c.name || 'Forêt'}${label ? ` : ${label}` : ''}`, onclick: () => tapCell(ui, c) },
            cellIcon(c),
            label ? el('span.c-cell-label', label) : null,
          ),
        );
      }
      return out;
    }),
  );
  const sale = lots.filter((l) => l.forSale).sort((a, b) => Number(b.buyable) - Number(a.buyable) || a.price - b.price || Math.abs(a.col) - Math.abs(b.col) || a.row - b.row);
  const owned = lots.filter((l) => !l.forSale).sort((a, b) => (b.row ?? b.index) - (a.row ?? a.index) || (a.col ?? 0) - (b.col ?? 0));
  const saleRows = sale.map((lot) =>
    el(
      'article.c-map-row.is-forsale',
      { id: `c-map-${lot.id}` },
      el('button.c-map-open', { type: 'button', onclick: () => ui.open.lot(lot.id), 'aria-label': `Voir : ${lot.name}` }, el('span.c-map-icon', lot.buyable ? lotIcon('forSale', 'sprite--md') : icon('lock', 'md')), el('div.c-map-main', el('b', lot.name), el('small', lotWhere(lot)), el('small', lot.buyable ? `${fmt(lot.price)} pièces · +${fmt(lot.chargeIncrease ?? 0)} de charges par saison` : lot.lockedReason || lot.reason || 'Pas encore à vendre'))),
      lot.buyable ? buyButton(app, { id: `c-map-buy-${lot.id}`, label: 'Acheter', cost: lot.price, can: lot.canBuy, reason: lot.reason, cls: 'btn--compact', onClick: () => ui.buyLot(lot.id) }) : null,
    ),
  );
  const ownedRows = owned.map((lot) =>
    el(
      'article.c-map-row',
      { id: `c-map-${lot.id}` },
      el('button.c-map-open', { type: 'button', onclick: () => ui.open.lot(lot.id), 'aria-label': `Fiche : ${lot.name}` }, el('span.c-map-icon', lotIcon(lot.type, 'sprite--md')), el('div.c-map-main', el('b', lot.name), el('small', lotSummary(ui, lot)))),
      canGo ? cBtn(app, 'Aller', () => ui.showLot(lot.id), { id: `c-go-${lot.id}`, cls: 'btn--compact' }) : null,
    ),
  );
  const mm = ui.minimap;
  return el(
    'div.c-map',
    el('p.shop-intro', 'Votre ferme vue d\'en haut : la route en bas, la forêt tout autour. Touchez un terrain pour y aller et ouvrir sa fiche.'),
    gridNode,
    el(
      'div.c-legend',
      el('span.c-legend-item.is-owned', el('i'), 'À vous'),
      el('span.c-legend-item.is-buyable', el('i'), 'À vendre'),
      el('span.c-legend-item.is-locked', el('i'), 'Plus tard'),
      el('span.c-legend-item.is-forest', el('i'), 'Forêt'),
    ),
    mm ? toggle(app, { id: 'c-minimap-toggle', label: 'Mini-carte à l\'écran', sub: 'En bas à droite : touchez-la pour aller quelque part', on: !mm.hidden, onChange: (v) => {
      mm.setHidden(!v);
      ui.schedule();
    } }) : null,
    sale.length ? el('section.c-sec', el('h3.stats-title', lotIcon('forSale', 'sprite--sm'), `À vendre (${sale.length})`), el('div.c-map-list', saleRows)) : el('p.stats-note', 'Tous les terrains sont achetés : la ferme est complète !'),
    el('section.c-sec', el('h3.stats-title', cIcon('land', 'sprite--sm', 'seed'), `Vos terrains (${owned.length})`), el('div.c-map-list', ownedRows)),
  );
}

// ── Fiche d'un terrain ──────────────────────────────────────────────────────────
export function lotContent(ui, lotId) {
  const { q } = ui;
  const lot = q('lot', null, lotId);
  if (!lot) return el('p.sheet-empty', 'Ce terrain n\'existe plus.');
  if (lot.forSale) return forSaleContent(ui, lot);
  const parts = [el('p.c-lot-type', lotIcon(lot.type, 'sprite--sm'), el('span', lotSummary(ui, lot)))];
  // Ce que fait ce terrain (la friche, elle, se présente par le choix de son aménagement juste dessous).
  if (lot.type !== 'home' && lot.type !== 'wild') {
    const about = q('about', null, 'lotType', lot.type);
    const node = aboutSection(about, { kind: 'lotType', levels: false, key: lot.type });
    if (node) parts.push(node);
  }
  if (lot.type === 'wild') parts.push(developSection(ui, lot, false));
  else if (lot.type === 'home') parts.push(homeSection(ui));
  else {
    if (lot.plan) parts.push(planSection(ui, lot));
    if (lot.type === 'orchard') parts.push(orchardSection(ui, lot));
    if (lot.slots?.length) parts.push(slotsSection(ui, lot));
    if (lot.type === 'pond') parts.push(pondSection(ui, lot));
    if (lot.type === 'greenhouse') {
      const b = q('building', null, 'greenhouse');
      if (b) parts.push(el('section.c-sec', el('h3.stats-title', 'La serre'), buildingCard(ui, b)));
    }
    if (['field', 'orchard', 'greenhouse', 'meadow', 'yard', 'pond'].includes(lot.type)) parts.push(machinesSection(ui, lot));
    parts.push(staffSection(ui, lot));
    if (lot.index >= 3) parts.push(developSection(ui, lot, true));
  }
  return el('div.info-sheet.c-lot', parts);
}

function forSaleContent(ui, lot) {
  const { app } = ui;
  const why = lot.lockedReason || lot.reason;
  return el(
    'div.info-sheet.c-lot',
    el('p.c-lot-type', lotIcon('forSale', 'sprite--sm'), el('span', lotWhere(lot))),
    el('p', lot.buyable ? 'Un terrain en friche, à vendre. Une fois acheté, vous choisirez son aménagement (champ, pré, verger, mare…).' : 'Un terrain en friche au bord de votre ferme. Il ne sera à vendre que plus tard.'),
    lot.special ? el('p.stats-note.is-ok', `${lot.special} : ${fmt(lot.price)} au lieu de ${fmt(lot.basePrice ?? lot.price)}.`) : null,
    el('div.stats-line', el('span.stats-label', 'Prix'), el('b.stats-value', `${fmt(lot.price)} pièces`)),
    el('div.stats-line', el('span.stats-label', 'Charges de saison'), el('b.stats-value.neg', `+${fmt(lot.chargeIncrease ?? 0)} par saison`)),
    !lot.canBuy && why ? el('p.card-reason', why) : null,
    buyButton(app, { id: 'c-lot-buy', label: 'Acheter ce terrain', cost: lot.price, can: lot.canBuy, reason: why, onClick: () => ui.buyLot(lot.id) }),
    cBtn(app, [cIcon('map', 'sprite--sm', 'seed'), 'Voir tous les terrains (carte)'], () => ui.open.map(), { id: 'c-lot-map', cls: 'btn--wide.btn--small' }),
  );
}

/** Choix de l'aménagement (friche) ou « Réaménager » (terrain vide). */
function developSection(ui, lot, redevelop) {
  const { app, q } = ui;
  const types = (q('lotTypes', [], lot.id) || []).filter((t) => t.type !== 'wild' && t.type !== lot.type);
  const cards = types.map((t) =>
    el(
      `article.card.c-card.c-dev${t.canDevelop ? '' : '.is-locked'}`,
      { id: `c-dev-${t.type}` },
      el('div.card-icon', lotIcon(t.type, 'sprite--card')),
      el(
        'div.card-main',
        el('div.card-top', el('span.card-name', t.name), el('span.card-owned', t.max ? `${t.count}/${t.max}` : ''), t.phase === 'B' ? el('span.card-owned', 'bientôt') : null),
        el('div.card-desc', t.role || TYPE_TEXT[t.type] || ''),
        t.effectLines?.length ? el('div.card-desc.c-effect', t.effectLines.filter((x) => !/^Aménagement/.test(x)).join(' · ')) : null,
      ),
      el(
        'div.card-foot',
        buyButton(app, {
          id: `c-develop-${t.type}`,
          label: redevelop ? 'Réaménager' : 'Aménager',
          cost: t.cost,
          can: t.canDevelop,
          reason: t.reason,
          onClick: async () => {
            if (redevelop) {
              const ok = await app.dialogs.confirm({ title: 'Réaménager ?', text: `« ${lot.name} » deviendra : ${t.name.toLowerCase()} (${fmt(t.cost)} pièces). L'ancien aménagement n'est pas remboursé.`, ok: 'Réaménager' });
              if (!ok) return;
            }
            ui.act('developLot', lot.id, t.type);
          },
        }),
        !t.canDevelop && t.reason ? el('p.card-reason', t.reason) : null,
      ),
    ),
  );
  if (redevelop) {
    const empty = !(lot.plots || []).some((i) => ui.game.state.plots[i]?.cropId) && !(lot.slots || []).some(Boolean);
    return el(
      'details.c-redevelop',
      el('summary.c-redevelop-head', 'Réaménager ce terrain'),
      el('p.stats-note', empty ? 'Le terrain est vide : vous pouvez changer son aménagement.' : 'Videz d\'abord le terrain (cultures, bâtiments, animaux) pour changer son aménagement.'),
      empty ? cards : null,
    );
  }
  return el('section.c-sec', el('h3.stats-title', 'Choisir l\'aménagement'), el('p.stats-note', 'Vous pouvez aussi le laisser en friche et l\'aménager plus tard.'), el('div.c-dev-list', cards));
}

/** Bande de la maison : maison, grenier, étal (et raccourci vers le grenier). */
function homeSection(ui) {
  const { app, q } = ui;
  const list = (q('buildings', []) || []).filter((b) => ['house', 'storage', 'roadsideStand'].includes(b.id));
  const storage = list.find((b) => b.id === 'storage');
  return el(
    'section.c-sec',
    list.map((b) => buildingCard(ui, b)),
    storage?.level > 0 ? cBtn(app, [cIcon('storage', 'sprite--sm', 'coin'), 'Ouvrir le grenier (vendre le stock)'], () => ui.open.storage(), { id: 'c-open-storage', cls: 'btn--wide' }) : null,
  );
}

/** Plan de culture : 4 lignes (une par saison, ≥ 56 px). */
function planSection(ui, lot) {
  const cur = ui.game.query.calendar().seasonId;
  const rows = SEASON_ORDER.map((sid) => {
    const v = lot.plan?.[sid];
    const crop = v && v !== 'same' ? getCrop(v) : null;
    return el(
      `button.c-plan-row${sid === cur ? '.is-now' : ''}`,
      { type: 'button', id: `c-plan-${sid}`, onclick: () => ui.open.plan(lot.id, sid) },
      icon(sid, 'md'),
      el('span.c-plan-season', season(sid)),
      el('span.c-plan-value', crop ? [cropIcon(crop.id, 'sprite--sm'), el('span', crop.name)] : v === null ? el('span.mid', 'Rien') : el('span', 'Même culture')),
      el('span.c-row-go', '›'),
    );
  });
  return el(
    'section.c-sec',
    el('h3.stats-title', cIcon('plan', 'sprite--sm', 'seed'), 'Plan de culture'),
    el('p.stats-note', 'Ce que sèment le semoir et les jardiniers sur ce terrain. Vous, vous semez ce que vous voulez.'),
    el('div.c-plan', rows),
  );
}

function orchardSection(ui, lot) {
  const g = ui.game.state.plots;
  const trees = (lot.plots || []).filter((i) => g[i]?.cropId).length;
  return el('section.c-sec', el('h3.stats-title', 'Arbres'), el('p.stats-note', trees ? `${plural(trees, 'arbre')} sur ${lot.plots.length} emplacements. Touchez un emplacement vide dans la scène pour planter.` : `${plural(lot.plots.length, 'emplacement')} libres : touchez-en un dans la scène pour planter un pommier.`));
}

function pondSection(ui) {
  const { app } = ui;
  return el(
    'section.c-sec',
    el('h3.stats-title', cIcon('fishing', 'sprite--sm', 'water'), 'Pêche'),
    el('p.stats-note', 'Une fois par jour, touchez le ponton pour pêcher (5 à 40 pièces).'),
    cBtn(app, 'Pêcher', () => ui.act('fish'), { id: 'c-fish', cls: 'btn--wide' }),
  );
}

/** Emplacements d'un pré, de la basse-cour ou d'une cour des ateliers. */
function slotsSection(ui, lot) {
  const { app, q } = ui;
  const cards = (lot.slots || []).map((s, k) => {
    const side = k === 0 ? 'Emplacement gauche' : 'Emplacement droit';
    if (!s) {
      return el(
        'article.c-slot.is-empty',
        { id: `c-slot-${lot.id}-${k}` },
        el('span.c-slot-plus', '+'),
        el('div.c-slot-main', el('b', side), el('small', lot.type === 'workshops' ? 'Libre : un atelier peut s\'y construire.' : 'Libre : un abri ou la chambre d\'hôte.')),
        cBtn(app, 'Construire', () => ui.open.buildOptions(lot.id, k), { id: `c-slot-build-${lot.id}-${k}`, cls: 'btn--red.btn--compact' }),
      );
    }
    const b = q('building', null, s.buildingId);
    if (!b) return null;
    const shelter = b.category === 'shelter';
    const workshop = b.category === 'workshop';
    const pending = b.pending || 0;
    return el(
      'article.c-slot',
      { id: `c-slot-${lot.id}-${k}` },
      el('button.c-slot-open', { type: 'button', onclick: () => (workshop ? app.field.openBuilding(b.id) : ui.open.building(b.id)), 'aria-label': `Fiche : ${b.name}` }, el('span.c-slot-icon', buildingIcon(b.id, b.level, 'sprite--md')), el('div.c-slot-main', el('b', b.name), el('small', shelter && b.animals ? `${b.animals.count}/${b.animals.capacity} ${b.animals.count > 1 ? 'animaux' : 'animal'}${pending ? ` · ${fmt(pending)} à ramasser` : ''}` : effectsText(b.effects)))),
      shelter && pending > 0 ? cBtn(app, [animalProductIcon(b.animals?.id, 'sprite--sm'), `+${fmt(pending)}`], () => ui.act('collect', b.id), { id: `c-collect-${b.id}`, cls: 'btn--red.btn--compact', sound: null }) : pips(b.level, b.maxLevel),
    );
  });
  return el('section.c-sec', el('h3.stats-title', lot.type === 'workshops' ? 'Ateliers' : 'Abris et bâtiments'), el('div.c-slots', cards));
}

/** Machines du terrain : installées (interrupteur, amélioration) et à installer (places du catalogue). */
function machinesSection(ui, lot) {
  const { app, q } = ui;
  const all = q('machines', []) || [];
  const mine = all.filter((m) => m.lotId === lot.id);
  const offers = [];
  for (const m of q('machineCatalog', []) || []) {
    if (m.scope === 'farm') continue;
    for (const p of m.places || []) if (p.lotId === lot.id && !p.owned) offers.push({ m, p });
  }
  if (!mine.length && !offers.length) return null;
  const rows = mine.map((m) =>
    el(
      'div.c-machine',
      { id: `c-mach-${m.key}` },
      el('span.c-slot-icon', machineIcon(m.id, 'sprite--md')),
      el(
        'div.c-slot-main',
        el('b', `${m.name || m.id}${m.buildingId ? ` · ${ui.q('building', null, m.buildingId)?.name || ''}` : ''}`),
        el('small', [m.maxLevel > 1 ? `Niveau ${m.level}/${m.maxLevel}` : null, m.text || null].filter(Boolean).join(' · ') || ' '),
        m.role ? el('small.c-mach-role', m.role) : null,
        m.level < (m.maxLevel || 1) && m.nextEffectLines?.length ? el('small.c-mach-next', `Niveau ${m.level + 1} : ${m.nextEffectLines.join(' · ')}`) : null,
        m.on && !m.working && m.why ? el('small.warn', m.why) : null,
      ),
      toggle(app, { id: `c-mach-on-${m.key}`, label: m.on ? 'En marche' : 'Éteinte', on: !!m.on, onChange: (v) => ui.act('setMachine', m.id, m.buildingId || m.lotId, v) }),
      m.level < (m.maxLevel || 1) ? buyButton(app, { id: `c-mach-up-${m.key}`, label: 'Niveau 2', cost: m.nextCost, can: m.canUpgrade, reason: m.reason, cls: 'btn--compact', onClick: () => ui.act('upgradeMachine', m.id, m.buildingId || m.lotId) }) : null,
    ),
  );
  const buy = offers.map(({ m, p }) =>
    el(
      'div.c-mach-offer',
      m.role ? el('small.c-mach-role', m.role) : null,
      buyButton(app, { id: `c-mach-buy-${m.id}-${p.place}`, label: `Installer : ${m.name}${p.buildingId ? ` (${p.name})` : ''}`, cost: m.cost, can: p.canBuy, reason: p.reason, onClick: () => ui.act('buyMachine', m.id, p.place) }),
    ),
  );
  return el('section.c-sec', el('h3.stats-title', machineIcon('sprinklers', 'sprite--sm'), 'Machines'), rows, buy.length ? el('div.c-offers', buy) : null);
}

function staffSection(ui, lot) {
  const { app, q } = ui;
  const staff = (q('staff', []) || []).filter((s) => s.lotId === lot.id || (s.lotId === 'all' && jobFits(s.job, lot.type)));
  if (!ui.game.state.career.staff?.length && !(q('candidates', null)?.capacity > 0)) return null;
  return el(
    'section.c-sec',
    el('h3.stats-title', cIcon('staff', 'sprite--sm', 'harvest'), 'Équipe'),
    staff.length
      ? staff.map((s) => el('button.c-row', { type: 'button', onclick: () => ui.open.employee(s.id) }, portrait(s.look, 'sprite--md'), el('span.c-row-main', el('b', s.name), el('small', `${s.jobName || jobName(s.job, s.look?.gender === 'f')}${s.lotId === 'all' ? ' · tous les terrains' : ''}`)), el('span.c-row-go', '›')))
      : el('p.stats-note', 'Personne n\'est affecté ici.'),
    cBtn(app, 'Affecter quelqu\'un', () => ui.open.team(), { id: `c-assign-${lot.id}`, cls: 'btn--wide.btn--small' }),
  );
}

function jobFits(job, type) {
  if (job === 'gardener') return ['field', 'orchard', 'greenhouse'].includes(type);
  if (job === 'keeper') return ['meadow', 'yard', 'pond'].includes(type);
  return false;
}

// ── Construire sur un emplacement ───────────────────────────────────────────────
export function buildOptionsContent(ui, lotId, slot) {
  const { app, q } = ui;
  const lot = q('lot', null, lotId);
  if (!lot || lot.slots?.[slot]) return el('p.sheet-empty', 'Cet emplacement est déjà occupé.');
  const opts = q('buildOptions', [], lotId, slot) || [];
  const animalOf = { coop: 'hen', sheepfold: 'sheep', goatShed: 'goat', cowshed: 'cow', pigsty: 'pig', hutch: 'rabbit', stable: 'horse' };
  return el(
    'div.c-build-list',
    el('p.shop-intro', `${lot.name}, emplacement ${slot === 0 ? 'gauche' : 'droit'}. Un seul bâtiment de chaque sorte dans la ferme.`),
    opts.map((o) => {
      const b = q('building', null, o.buildingId);
      return el(
        `article.card.c-card${o.canBuild ? '' : '.is-locked'}`,
        { id: `c-opt-${o.buildingId}` },
        el('div.card-icon', animalOf[o.buildingId] ? animalIcon(animalOf[o.buildingId], 'sprite--card') : buildingIcon(o.buildingId, 1, 'sprite--card')),
        el('div.card-main', el('div.card-top', el('span.card-name', o.name), o.rank > ui.game.state.career.rank ? el('span.card-owned', `Rang ${o.rank}`) : null), roleLine(b?.role), b?.nextEffects ? el('div.card-desc', effectsText(b.nextEffects)) : null),
        el(
          'div.card-foot',
          buyButton(app, { id: `c-opt-build-${o.buildingId}`, label: 'Construire', cost: o.cost, can: o.canBuild, reason: o.reason, onClick: () => {
            const res = ui.act('build', lotId, slot, o.buildingId);
            if (res?.ok) ui.open.lot(lotId);
          } }),
          !o.canBuild && o.reason ? el('p.card-reason', o.reason) : null,
        ),
      );
    }),
  );
}

// ── Plan de culture d'une saison ─────────────────────────────────────────────────
export function planPickerContent(ui, lotId, seasonId) {
  const { app, q } = ui;
  const lot = q('lot', null, lotId);
  if (!lot?.plan) return el('p.sheet-empty', 'Ce terrain n\'a pas de plan de culture.');
  const cur = lot.plan[seasonId];
  const greenhouse = lot.type === 'greenhouse';
  const crops = (ui.game.level.crops || []).map((id) => getCrop(id)).filter((c) => c && c.kind !== 'tree' && (greenhouse || c.seasons.includes(seasonId)));
  const pick = (value) => {
    const res = ui.act('setPlan', lotId, seasonId, value);
    if (res?.ok) {
      app.audio.play('confirm', { volume: 0.6 });
      ui.open.lot(lotId);
    }
  };
  const row = (value, main, sub, iconNode, id) =>
    el(
      `button.seed-row.c-plan-pick${cur === value ? '.is-current' : ''}`,
      { type: 'button', id, onclick: () => pick(value), 'aria-pressed': cur === value ? 'true' : 'false' },
      el('span.seed-icon', iconNode),
      el('span.seed-main', el('span.seed-name', main), sub ? el('span.seed-facts', sub) : null),
      cur === value ? el('span.c-check', '✓') : null,
    );
  return el(
    'div.seed-picker',
    el('p.shop-intro', `${lot.name} · ${season(seasonId).toLowerCase()} : que doivent semer le semoir et les jardiniers ?`),
    el(
      'div.seed-list',
      row('same', 'Même culture', 'Replanter la dernière culture récoltée sur chaque parcelle', icon('seed', 'md'), 'c-plan-same'),
      row(null, 'Rien', 'Ne rien semer cette saison', icon('close', 'md'), 'c-plan-none'),
      crops.map((c) => row(c.id, c.name, [el('span', icon('calendar', 'xs'), plural(c.growDays, 'jour')), el('span', icon('seed', 'xs'), fmt(c.seedCost)), el('span', icon('coin', 'xs'), fmt(c.sellPrice))], cropIcon(c.id, 'sprite--seed'), `c-plan-${c.id}`)),
    ),
    el('p.sheet-hint', 'Sécurité : jamais de semis qui gèlerait avant d\'être mûr, ni sans argent pour la graine.'),
  );
}
