// Mode Carrière — fiche d'un bâtiment à niveaux (maison, étal, serre, chambre d'hôte, abris) et fiche
// « Grenier et marché » (§ 4.2 : stock, cours du jour ▲▼, vente, mise en réserve).

import { el, fmt, plural } from '../dom.js';
import { icon, seasonIncomes } from '../icons.js';
import { getCrop } from '../../data/crops.js';
import { aboutSection, animalIcon, animalProductIcon, bar, buyButton, cBtn, cropIcon, marketChip, pips } from './util.js';
import { buildingCard, buyInv, effectsText } from './shop.js';

export function buildingContent(ui, id) {
  const { app, q, game } = ui;
  const b = q('building', null, id);
  if (!b) return el('p.sheet-empty', 'Bâtiment inconnu.');
  const parts = [];
  parts.push(
    el(
      'div.c-bld-head',
      el('span.c-bld-level', b.level > 0 ? `Niveau ${b.level} sur ${b.maxLevel}` : 'Pas encore construit'),
      b.level > 0 ? pips(b.level, b.maxLevel) : null,
    ),
  );
  // Ce que fait ce bâtiment : son rôle, l'effet du niveau actuel, tous les niveaux, des conseils.
  const kind = b.category === 'shelter' ? 'shelter' : b.category === 'workshop' ? 'workshop' : 'building';
  const about = b.role ? b : q('about', null, 'building', id);
  const aboutNode = aboutSection(about, { app, kind, key: id, level: b.level, levels: true });
  // Abri avec des produits à ramasser : le bouton « Ramasser » d'abord, l'explication juste après.
  const urgent = b.category === 'shelter' && ((b.pending || 0) > 0 || b.full);
  const aboutAt = parts.length;
  if (!aboutNode && b.level > 0 && b.effects) parts.push(el('p.c-bld-effects', effectsText(b.effects)));
  if (b.category === 'shelter' && b.animals) {
    const a = game.query.investments().find((x) => x.id === b.animals.id);
    const pending = b.pending || 0;
    parts.push(
      el(
        'section.c-sec',
        el('div.c-shelter', el('span.c-slot-icon', animalIcon(b.animals.id, 'sprite--card')), el('div.c-slot-main', el('b', `${b.animals.count} / ${b.animals.capacity} ${a?.name ? a.name.toLowerCase() : 'animaux'}${b.animals.count > 1 && a?.name && !/s$/.test(a.name) ? 's' : ''}`), bar(b.animals.count, b.animals.capacity), animalRole(ui, b, a) ? el('small.c-animal-role', animalRole(ui, b, a)) : null)),
        pending > 0 || b.full
          ? el(
              `div.c-collect${b.full ? '.is-full' : ''}`,
              animalProductIcon(b.animals.id, 'sprite--md'),
              el('span', b.full ? `Abri plein : ramassez vite (${fmt(pending)}) !` : `${fmt(pending)} pièces à ramasser${b.pendingDays ? ` (${plural(b.pendingDays, 'jour')})` : ''}`),
              cBtn(app, 'Ramasser', () => ui.act('collect', id), { id: 'c-collect', cls: 'btn--red', sound: null }),
            )
          : el('p.stats-note', 'Rien à ramasser pour l\'instant. La production s\'accumule 3 jours au plus : passez régulièrement !'),
        a
          ? el(
              'div.c-buy-animal',
              a.incomeBySeason && Object.values(a.incomeBySeason).some((v) => v > 0) ? el('div.card-stats', el('span.stat.stat--wide', el('span.stat-label', 'Par animal et par jour'), seasonIncomes(a.incomeBySeason, 1, game.query.calendar().seasonId))) : null,
              buyButton(app, { id: `c-buy-${a.id}`, label: `Acheter : ${a.name.toLowerCase()}`, cost: a.nextCost, can: a.canBuy, reason: a.reason, onClick: () => buyInv(ui, a.id) }),
              !a.canBuy && a.reason ? el('p.card-reason', a.reason) : null,
            )
          : null,
      ),
    );
  }
  if (aboutNode) parts.splice(urgent ? parts.length : aboutAt, 0, aboutNode);
  if (id === 'house') {
    const cands = q('candidates', null);
    parts.push(el('p.stats-note', b.effects?.staff ? `La maison loge jusqu'à ${plural(b.effects.staff, 'employé')}${cands ? ` (${cands.count} aujourd'hui)` : ''}.` : 'Améliorez la maison (rang 2) pour loger vos premiers employés.'));
  }
  if (id === 'roadsideStand' && b.level > 0) parts.push(el('p.stats-note', 'Les passants achètent un peu chaque jour (rien les jours d\'orage), et toutes vos ventes sont plus chères.'));
  if (b.category === 'workshop' && b.level > 0 && game.query.investments().some((x) => x.id === id)) parts.push(cBtn(app, 'Ouvrir l\'atelier (recettes, interrupteur)', () => app.field.openBuilding(id), { id: 'c-open-workshop', cls: 'btn--wide', sound: 'page' }));
  // Amélioration : ce que change le niveau suivant, juste au-dessus du bouton.
  if (b.level < b.maxLevel) {
    parts.push(el('section.c-sec.c-upgrade', el('h3.stats-title', b.level > 0 ? 'Niveau suivant' : 'Construire'), buildingCard(ui, b, { compact: false, lines: true })));
  } else parts.push(el('p.stats-note.is-ok', 'Niveau maximal atteint.'));
  return el('div.info-sheet.c-building', parts);
}

/** « Pond des œufs chaque jour » : le rôle de l'animal de l'abri (requête shelter().animalAbout, sinon about). */
function animalRole(ui, b, a) {
  if (a?.role) return a.role;
  const sh = (ui.q('shelters', []) || []).find((x) => x.buildingId === b.id);
  return sh?.animalAbout?.role || ui.q('about', null, 'animal', b.animals?.id)?.role || null;
}

const MODES = [
  { id: 'never', label: 'Jamais', sub: 'tout se vend' },
  { id: 'low', label: 'Cours bas', sub: 'garde si < ×1' },
  { id: 'always', label: 'Toujours', sub: 'tout au grenier' },
];

export function storageContent(ui) {
  const { app, q, game } = ui;
  const s = q('stock', null);
  const b = q('building', null, 'storage');
  const parts = [];
  if (!s || !b || b.level === 0) {
    parts.push(el('p', 'Sans grenier, chaque récolte se vend au cours du jour. Avec un grenier, gardez-les pour les vendre quand le cours monte (ou hors saison, ×1,25).'));
    if (b) parts.push(buildingCard(ui, b));
  } else {
    parts.push(
      el(
        'div.c-stock-head',
        el('span.c-stock-cap', el('b', `${fmt(s.used)} / ${fmt(s.capacity)}`), el('small', `unités · ${b.name}`)),
        bar(s.used, s.capacity, s.used >= s.capacity ? 'is-full' : ''),
      ),
    );
    parts.push(
      el(
        'div.c-seg3',
        { role: 'radiogroup', id: 'c-storage-mode', 'aria-label': 'Mise en réserve des récoltes' },
        MODES.map((m) =>
          el(
            `button.c-seg3-btn${s.mode === m.id ? '.is-on' : ''}`,
            { type: 'button', role: 'radio', id: `c-mode-${m.id}`, 'aria-checked': s.mode === m.id ? 'true' : 'false', onclick: () => {
              if (s.mode !== m.id) {
                app.audio.play('toggle');
                ui.act('setStorageMode', m.id);
              }
            } },
            el('b', m.label),
            el('small', m.sub),
          ),
        ),
      ),
    );
    parts.push(el('p.stats-note', s.mode === 'low' ? 'Une récolte part au grenier quand son cours est bas (sous ×1, hors saison compris). Grenier plein : elle se vend normalement.' : s.mode === 'always' ? 'Toutes les récoltes partent au grenier tant qu\'il reste de la place.' : 'Aucune récolte ne part au grenier.'));
    if (s.lines.length) {
      parts.push(
        el(
          'div.c-stock-list',
          s.lines.map((l) =>
            el(
              'div.c-stock-row',
              { id: `c-stock-${l.cropId}` },
              cropIcon(l.cropId, 'sprite--md'),
              el('div.c-stock-main', el('b', `${l.name} ×${l.n}`), el('small', marketChip(l.multiplier, { offSeason: l.offSeason }), ` · ${fmt(l.unitPrice)} l'unité`)),
              buyButton(app, { id: `c-sell-${l.cropId}`, label: 'Vendre', cost: l.total, can: game.state.status === 'playing', cls: 'btn--compact', onClick: () => ui.act('sellStock', l.cropId) }),
            ),
          ),
        ),
      );
      parts.push(el('div.sheet-actions', buyButton(app, { id: 'c-sell-all', label: 'Tout vendre', cost: s.value, can: true, onClick: () => ui.act('sellStock', null) })));
    } else parts.push(el('p.sheet-empty', 'Le grenier est vide.'));
    if (b.level < b.maxLevel) parts.push(el('section.c-sec', el('h3.stats-title', 'Agrandir'), buildingCard(ui, b, { compact: true })));
  }
  parts.push(marketSection(ui));
  return el('div.info-sheet.c-storage', parts);
}

/** Cours du jour de chaque culture débloquée (▲▼, hors saison, fête) et prix de vente estimé. */
export function marketSection(ui) {
  const { q, game } = ui;
  const market = q('market', {}) || {};
  const bonus = game.query.finance().priceBonus || 0;
  const factor = game.level.cropPriceFactor ?? 1;
  const rows = (game.level.crops || [])
    .map((id) => getCrop(id))
    .filter(Boolean)
    .map((c) => {
      const m = market[c.id] || { multiplier: game.state.market?.[c.id] ?? 1, offSeason: false, fair: 1 };
      const price = Math.round(c.sellPrice * factor * m.multiplier * (m.offSeason ? 1.25 : 1) * (1 + bonus) * (m.fair || 1));
      const tags = [m.offSeason ? 'hors saison ×1,25' : null, (m.fair || 1) > 1.001 ? 'jour de fête' : null].filter(Boolean).join(' · ');
      return el(`div.c-market-row${m.multiplier >= 1.05 || m.offSeason ? '.is-good' : m.multiplier <= 0.95 ? '.is-bad' : ''}`, cropIcon(c.id, 'sprite--sm'), el('span.c-market-name', el('span', c.name), tags ? el('small', tags) : null), marketChip(m.multiplier), el('b.c-market-price', `≈ ${fmt(price)}`));
    });
  return el(
    'section.c-sec',
    { id: 'c-market' },
    el('h3.stats-title', icon('coin', 'sm'), 'Cours du jour'),
    el('div.c-market-list', rows),
    el('p.stats-note', 'Le cours change chaque matin (entre ×0,8 et ×1,3) et revient vers ×1. Hors saison, une récolte vaut ×1,25.'),
  );
}
