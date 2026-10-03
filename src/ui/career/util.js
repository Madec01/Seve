// Mode Carrière — petits outils d'interface partagés (icônes, boutons d'achat, barres, sections
// repliables, textes). Aucun accès au cœur ici : seulement de la mise en forme.

import { el, fmt, plural } from '../dom.js';
import { icon, spriteAny, investmentIcon, cropIcon } from '../icons.js';
import { josephPortrait, playerSprite, staffPortrait } from '../../render/atlas.js';

// ── Icônes ────────────────────────────────────────────────────────────────────────
/** Icône d'interface de la carrière (planche career : icon.career.<name>), sinon une icône de secours. */
export function cIcon(name, cls = 'sprite--sm', fallback = 'info') {
  return spriteAny([`icon.career.${name}`], cls, fallback);
}

/** Blason d'un rang (1 à 6). */
export function rankIcon(rank, cls = 'sprite--md') {
  return spriteAny([`icon.career.rank.${rank}`], cls, 'star');
}

const LOT_SPRITES = {
  field: ['crop.wheat.icon', 'crop.carrot.icon'],
  meadow: ['animal.sheep', 'animal.cow'],
  orchard: ['tree.apple.icon', 'crop.apple.icon'],
  workshops: ['building.jamworkshop', 'building.shed'],
  pond: ['animal.duck', 'icon.career.fishing'],
  greenhouse: ['icon.career.greenhouse', 'building.greenhouse.1'],
  wild: ['icon.career.land', 'land.stump'],
  home: ['icon.career.house', 'building.house.1'],
  yard: ['animal.chicken'],
  forSale: ['land.sale.sign', 'icon.career.land'],
};
/** Icône d'un type de terrain (friche, champ, pré…). */
export function lotIcon(type, cls = 'sprite--md') {
  return spriteAny(LOT_SPRITES[type] || ['icon.career.land'], cls, 'seed');
}

/** Icône d'un bâtiment à niveaux (sprite du niveau, sinon niveau 1, sinon icône voisine). */
export function buildingIcon(id, level = 1, cls = 'sprite--md') {
  const lv = Math.max(1, level || 1);
  const names = [`building.${id}.${lv}`, `building.${id}.1`];
  if (id === 'roadsideStand') names.unshift(lv >= 2 ? `building.roadsideStand.${lv}` : 'stall.cart', 'stall.cart');
  if (id === 'guestHouse') names.push('building.cottage.red');
  if (id === 'storage') names.push('icon.career.storage');
  if (id === 'house') names.push('icon.career.house', 'building.house');
  if (['jamWorkshop', 'dairy', 'mill', 'cannery', 'spinningMill'].includes(id)) return investmentIcon(id, cls);
  return spriteAny(names, cls, 'coin');
}

const ANIMAL_SPRITES = {
  hen: ['animal.chicken'],
  rabbit: ['animal.rabbit.white', 'animal.rabbit'],
  duck: ['animal.duck'],
  goat: ['animal.goat'],
  cow: ['animal.cow'],
  sheep: ['animal.sheep'],
  pig: ['animal.pig'],
  horse: ['animal.horse'],
};
export function animalIcon(id, cls = 'sprite--md') {
  return spriteAny(ANIMAL_SPRITES[id] || [`animal.${id}`], cls, 'harvest');
}

const PRODUCT_OF_ANIMAL = { hen: 'product.eggs', duck: 'product.duckEgg', rabbit: 'product.angora', pig: 'product.truffle', cow: 'product.milk', goat: 'product.milk.goat', sheep: 'product.yarn', horse: 'product.ride' };
/** Produit d'un animal (bulle de ramassage). */
export function animalProductIcon(animalId, cls = 'sprite--sm') {
  return spriteAny([PRODUCT_OF_ANIMAL[animalId], 'product.eggs'].filter(Boolean), cls, 'harvest');
}

export function machineIcon(id, cls = 'sprite--md') {
  return spriteAny([`icon.career.machine.${id}`, `machine.${id}`, id === 'tractor' ? 'machine.tractor.r' : null].filter(Boolean), cls, 'coin');
}

/** Portrait d'un employé (32 × 32). */
export function portrait(look, cls = 'sprite--md') {
  let name = null;
  try {
    name = staffPortrait(look || {});
  } catch {
    name = null;
  }
  return spriteAny([name, 'farmer'].filter(Boolean), cls, 'info');
}

/** Portrait de Joseph : 'content' | 'happy' | 'proud' | 'surprised'. */
export function joseph(expr = 'content', cls = 'sprite--md') {
  let name = null;
  try {
    name = josephPortrait(expr);
  } catch {
    name = null;
  }
  return spriteAny([name, 'portrait.joseph', 'npc.joseph', 'farmer'].filter(Boolean), cls, 'info');
}

/** Aperçu du personnage du joueur (fermier ou fermière, tenue). */
export function farmerPreview(outfit, female, cls = 'sprite--card') {
  let name = null;
  try {
    name = playerSprite(outfit || 'outfit.classic', { female: !!female });
  } catch {
    name = null;
  }
  return spriteAny([name, 'farmer'].filter(Boolean), cls, 'info');
}

export { cropIcon, icon };

// ── Textes ────────────────────────────────────────────────────────────────────────
export const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];

export const JOB_NAMES = {
  gardener: ['Jardinier', 'Jardinière'],
  keeper: ['Soigneur', 'Soigneuse'],
  artisan: ['Artisan', 'Artisane'],
  seller: ['Vendeur', 'Vendeuse'],
};
export const JOB_TEXT = {
  gardener: 'Récolte, arrose et sème sur son terrain.',
  keeper: 'Ramasse les produits des abris, 3 fois par jour.',
  artisan: 'Ajoute des places aux ateliers de sa cour.',
  seller: 'Vend le stock du grenier au bon cours.',
};
/** Nom du métier accordé (look.gender === 'f' → féminin). */
export function jobName(job, female = false) {
  const n = JOB_NAMES[job];
  if (!n) return 'Sans affectation';
  return female ? n[1] : n[0];
}

export const MOOD_NAMES = { joyful: 'Joyeux', content: 'Content', tired: 'Las' };
export const MOOD_NAMES_F = { joyful: 'Joyeuse', content: 'Contente', tired: 'Lasse' };

/** Sources du bilan de l'année (clés de yearStats). */
export const INCOME_LABELS = {
  crops: 'Récoltes',
  products: 'Produits transformés',
  animals: 'Animaux',
  passersby: 'Passants de l\'étal',
  guests: 'Chambre d\'hôte',
  stock: 'Stock vendu',
  honey: 'Miel',
  visitors: 'Visiteurs et fêtes',
  quests: 'Quêtes de Joseph',
  contest: 'Comice',
  rescue: 'Vente de secours',
  tourists: 'Touristes',
  rides: 'Balades à cheval',
  truffle: 'Truffes',
  // (Lot 3 / lot 4) Commandes du tableau, charrette ; fêtes participatives et hiver vivant.
  orders: 'Commandes du village',
  cart: 'La charrette',
  fetes: 'Fêtes du village',
  winter: 'Trouvailles d\'hiver',
  other: 'Autres',
};
export const SPENT_LABELS = {
  seeds: 'Graines',
  charges: 'Charges quotidiennes',
  wages: 'Salaires',
  fuel: 'Carburant',
  heating: 'Chauffage de la serre',
  seasonCharges: 'Charges de saison',
  lots: 'Terrains',
  develop: 'Aménagements et parcelles',
  buildings: 'Bâtiments',
  machines: 'Machines',
  animals: 'Animaux',
  items: 'Ruches et panneaux',
  water: 'Arrosage',
  other: 'Autres',
};
export const CHARGE_LABELS = {
  farm: 'Charges de la ferme',
  upkeep: 'Entretien (animaux, bâtiments)',
  wages: 'Salaires',
  fuel: 'Carburant',
  heating: 'Chauffage de la serre',
  solar: 'Panneaux solaires',
  neighbour: 'Part de Joseph',
  other: 'Autres',
};

/** « le Haut-Champ » : nom d'un terrain en minuscule initiale (dans une phrase). */
export function lotPhrase(name) {
  if (!name) return 'ce terrain';
  return /^(Le|La|Les|L')\b/.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}

// ── Éléments ──────────────────────────────────────────────────────────────────────
/** Pastilles de niveau (● ● ○). */
export function pips(level, max, cls = '') {
  return el(`span.c-pips${cls ? `.${cls}` : ''}`, { 'aria-label': `Niveau ${level} sur ${max}` }, Array.from({ length: max }, (_, i) => el(`span.pip${i < level ? '.is-on' : ''}`)));
}

/** Barre de progression (value / max). */
export function bar(value, max, cls = '') {
  const k = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return el(`span.c-bar${cls ? `.${cls}` : ''}`, el('span.c-bar-fill', { style: { width: `${Math.round(k * 100)}%` } }));
}

/** Ligne « libellé · valeur » (même style que le bilan). */
export function line(label, value, cls = '') {
  if (value === '0') cls = 'mid';
  return el('div.stats-line', el('span.stats-label', label), el(`b.stats-value${cls ? `.${cls}` : ''}`, value));
}

/**
 * Bouton d'achat : libellé + prix. Grisé s'il est impossible, mais toujours touchable : il explique
 * alors pourquoi (message), sans rien faire d'autre.
 */
export function buyButton(app, { id, label, cost = null, can = true, reason = null, onClick, cls = '' }) {
  const b = el(
    `button.btn.btn--buy${can ? '.btn--red' : '.is-disabled'}${cls ? `.${cls}` : ''}`,
    {
      type: 'button',
      id,
      'aria-disabled': can ? 'false' : 'true',
      onclick: () => {
        if (!can) {
          app.audio.play('error');
          if (reason) app.toasts.show({ kind: 'error', text: reason });
          return;
        }
        onClick?.(b);
      },
    },
    el('span.buy-label', label),
    cost !== null && cost !== undefined ? el('span.buy-cost', icon('coin', 'sm'), fmt(cost)) : null,
  );
  return b;
}

/** Bouton simple de la carrière (secondaire par défaut). */
export function cBtn(app, label, onClick, { id, cls = '', sound = 'click' } = {}) {
  return el(
    `button.btn${cls ? `.${cls}` : ''}`,
    {
      type: 'button',
      id,
      onclick: (e) => {
        if (sound) app.audio.play(sound, { volume: 0.7 });
        onClick?.(e);
      },
    },
    label,
  );
}

/** Interrupteur (rôle switch, ≥ 48 px). */
export function toggle(app, { id, label, sub = null, on, onChange }) {
  return el(
    `button.opt-toggle.c-toggle${on ? '.is-on' : ''}`,
    {
      type: 'button',
      role: 'switch',
      id,
      'aria-checked': on ? 'true' : 'false',
      onclick: () => {
        app.audio.play('toggle');
        onChange?.(!on);
      },
    },
    el('span.checkbox'),
    el('span.opt-label', sub ? [el('b', label), el('small', sub)] : label),
  );
}

// Sections repliables (état gardé pour toute la session d'interface).
const openSections = new Map();

/**
 * Section repliable (en-tête ≥ 48 px) : `key` mémorise l'état ; `open` = état par défaut.
 * @param opts { key, title, icon, badge (texte court), open, content: () => nœuds }
 */
export function foldSection(app, { key, title, iconNode = null, badge = null, open = false, content, id }) {
  const isOpen = openSections.has(key) ? openSections.get(key) : open;
  const body = el('div.fold-body');
  if (isOpen) body.append(...[content()].flat(Infinity).filter(Boolean));
  const sec = el(`section.fold${isOpen ? '.is-open' : ''}`, { id: id || `fold-${key}` });
  const head = el(
    'button.fold-head',
    {
      type: 'button',
      'aria-expanded': isOpen ? 'true' : 'false',
      onclick: () => {
        const now = !sec.classList.contains('is-open');
        openSections.set(key, now);
        app.audio.play('page', { volume: 0.6 });
        sec.classList.toggle('is-open', now);
        head.setAttribute('aria-expanded', now ? 'true' : 'false');
        body.replaceChildren(...(now ? [content()].flat(Infinity).filter(Boolean) : []));
      },
    },
    iconNode ? el('span.fold-icon', iconNode) : null,
    el('span.fold-title', title),
    badge ? el('span.fold-badge', badge) : null,
    el('span.fold-chevron', { 'aria-hidden': 'true' }),
  );
  sec.append(head, body);
  return sec;
}
export function setSectionOpen(key, on) {
  openSections.set(key, !!on);
}

/** Bulle de Joseph (portrait + texte). */
export function josephSays(text, expr = 'content', name = 'Joseph, votre voisin') {
  return el('div.loan-head.c-joseph', el('span.loan-avatar.c-joseph-face', joseph(expr, 'sprite--card')), el('div.loan-speech', el('div.tuto-name', name), el('p.loan-quote', text)));
}

/** « dans 3 jours » / « demain » / « aujourd'hui ». */
export function inDays(n) {
  if (n === null || n === undefined) return '';
  if (n <= 0) return 'aujourd\'hui';
  if (n === 1) return 'demain';
  return `dans ${plural(n, 'jour')}`;
}

/** Cours du marché : « ▲ ×1,2 » (classe pos/neg/mid). */
export function marketChip(mult, { offSeason = false, fair = 1 } = {}) {
  const m = Number(mult) || 1;
  const up = m >= 1.05;
  const down = m <= 0.95;
  return el(
    `span.c-market${up ? '.is-up' : down ? '.is-down' : ''}`,
    up ? spriteAny(['icon.career.market.up'], 'sprite--xs', 'star') : down ? spriteAny(['icon.career.market.down'], 'sprite--xs', 'info') : null,
    `×${m.toFixed(2).replace('.', ',').replace(/0$/, '')}`,
    offSeason ? el('small.c-offseason', 'hors saison') : null,
    fair > 1.001 ? el('small.c-fair', 'fête') : null,
  );
}

export function capitalize(t) {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// ── « Ce que fait ce bâtiment » (retour d'un joueur : chaque fiche explique son rôle) ────────────────
const ABOUT_TITLES = {
  building: 'Ce que fait ce bâtiment',
  shelter: 'Ce que fait cet abri',
  workshop: 'Ce que fait cet atelier',
  machine: 'Ce que fait cette machine',
  animal: 'Ce que fait cet animal',
  item: 'À quoi ça sert',
  lotType: 'Ce que fait ce terrain',
};

/** Liste de lignes d'effet (« Loge jusqu'à 4 poules »). */
export function aboutList(lines, cls = '') {
  return el(`ul.c-about-lines${cls ? `.${cls}` : ''}`, (lines || []).map((l) => el('li', l)));
}

/** Bloc « Au niveau suivant » (au-dessus du bouton d'amélioration). */
export function nextLines(lines, title = 'Au niveau suivant') {
  if (!lines?.length) return null;
  return el('div.c-about-next', el('small.c-about-label', title), aboutList(lines, 'is-next'));
}

/** Tous les niveaux (section repliable, état retenu) : niveau, nom, prix, rang, lignes. */
export function levelsFold(app, key, levels, current = 0) {
  if (!levels || levels.length < 2) return null;
  return foldSection(app, {
    key: `about-levels-${key}`,
    id: `c-levels-${key}`,
    title: `Tous les niveaux (${levels.length})`,
    content: () =>
      el(
        'ol.c-levels',
        levels.map((l) =>
          el(
            `li.c-level${l.level === current ? '.is-current' : ''}${l.level < current ? '.is-done' : ''}`,
            el(
              'div.c-level-top',
              el('b', `${l.level}. ${l.name || `Niveau ${l.level}`}`),
              el('small', [l.cost ? `${fmt(l.cost)} pièces` : 'offert', l.rank > 1 ? `rang ${l.rank}` : null, l.level === current ? 'actuel' : null].filter(Boolean).join(' · ')),
            ),
            aboutList(l.lines),
          ),
        ),
      ),
  });
}

/**
 * Section « Ce que fait ce bâtiment » en haut d'une fiche.
 * about : { role, tips, effectLines, nextEffectLines, levelLines | levels } (requêtes du cœur, descriptions.js)
 * opts : { app, kind ('building' | 'shelter' | 'machine' | 'animal' | 'item' | 'lotType' | 'workshop'), key, level
 *          (0 = pas encore construit), title, levels (false : pas de liste des niveaux), next (true : lignes du niveau
 *          suivant ici, sinon à côté du bouton d'amélioration), tips (true) }
 */
export function aboutSection(about, opts = {}) {
  if (!about || (!about.role && !about.effectLines?.length)) return null;
  const level = opts.level ?? about.level ?? 1;
  const lines = about.effectLines || [];
  const levels = about.levelLines || about.levels || [];
  const tips = opts.tips === false ? [] : about.tips || [];
  const multi = levels.length > 1;
  const label = level > 0 ? (multi ? `Maintenant (niveau ${level})` : 'En bref') : multi ? 'Au niveau 1' : 'En bref';
  return el(
    'section.c-about',
    { id: opts.id || null },
    el('h3.stats-title', icon('info', 'sm'), opts.title || ABOUT_TITLES[opts.kind] || ABOUT_TITLES.building),
    about.role ? el('p.c-about-role', about.role) : null,
    lines.length ? el('div.c-about-now', el('small.c-about-label', label), aboutList(lines)) : null,
    opts.next ? nextLines(about.nextEffectLines) : null,
    opts.app && opts.levels !== false && multi ? levelsFold(opts.app, opts.key || opts.kind || 'x', levels, level) : null,
    tips.length ? el('div.c-about-tips', tips.map((t) => el('p.c-about-tip', el('b', 'Conseil'), ` : ${t}`))) : null,
  );
}

/** Une phrase courte « à quoi ça sert » pour une carte (catalogue Acheter). */
export function roleLine(role) {
  return role ? el('div.card-desc.c-role', role) : null;
}

// ── Position d'un terrain sur la carte 2D ─────────────────────────────────────────────────────────────
/** « Au-dessus de la ferme », « À gauche de la basse-cour », « En haut à droite »… (col, row du cœur). */
export function lotWhere(lot) {
  const col = Number(lot?.col) || 0;
  const row = Number(lot?.row) || 0;
  if (lot?.fixed || ['home', 'start', 'yard'].includes(lot?.id)) return 'La ferme de départ';
  const side = col < 0 ? 'à gauche' : 'à droite';
  const far = Math.abs(col) >= 2 ? ' (tout au bord)' : '';
  if (col === 0) return row <= 1 ? 'Juste au-dessus de la ferme' : `Au-dessus de la ferme, rangée ${row}`;
  if (row === 0) return `${capitalize(side)} de la basse-cour${far}`;
  return `En haut ${side}, rangée ${row}${far}`;
}
