// Icônes de l'interface : planche assets/sprites/ui/icons.png (générée par generate-icons.py)
// et sprites de l'atlas (cultures, animaux, bâtiments) convertis en petites images.

import { decorSprite, drawSprite, outfitSprite, productSprite, spriteSize, SPRITES } from '../render/atlas.js';
import { el } from './dom.js';

const POS = {
  sunny: [0, 0], cloudy: [1, 0], rain: [2, 0], storm: [3, 0], heatwave: [4, 0], snow: [5, 0],
  spring: [0, 1], summer: [1, 1], autumn: [2, 1], winter: [3, 1], star: [4, 1], 'star-empty': [5, 1],
  pause: [0, 2], play: [1, 2], fast: [2, 2], faster: [3, 2], menu: [4, 2], close: [5, 2], sound: [6, 2], mute: [7, 2],
  coin: [0, 3], bill: [1, 3], calendar: [2, 3], lock: [3, 3], water: [4, 3], harvest: [5, 3], seed: [6, 3], info: [7, 3],
};

/**
 * Icône de la planche : <span class="ico ico--md">.
 * @param size 'sm' (16 px × échelle ½) | 'md' (défaut) | 'lg' | 'xl'
 */
export function icon(name, size = 'md', extraClass = '') {
  const p = POS[name] || POS.info;
  const node = el(`span.ico.ico--${size}`, { 'aria-hidden': 'true' });
  if (extraClass) node.className += ` ${extraClass}`;
  node.style.setProperty('--ix', p[0]);
  node.style.setProperty('--iy', p[1]);
  return node;
}

/** Change l'icône affichée par un <span class="ico">. */
export function setIcon(node, name) {
  const p = POS[name] || POS.info;
  node.style.setProperty('--ix', p[0]);
  node.style.setProperty('--iy', p[1]);
}

// ── Sprites de l'atlas ──────────────────────────────────────────────────────────────
let images = null;
const cache = new Map();

export function initSprites(imgs) {
  images = imgs;
}

/** URL (data:) d'un sprite de l'atlas, dessiné à l'échelle 1. */
export function spriteURL(name, opts = {}) {
  const key = `${name}|${opts.flipX ? 1 : 0}`;
  if (cache.has(key)) return cache.get(key);
  if (!images) return '';
  let url = '';
  try {
    const { w, h } = spriteSize(name);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawSprite(ctx, images, name, 0, 0, { flipX: !!opts.flipX });
    url = c.toDataURL('image/png');
  } catch {
    url = '';
  }
  cache.set(key, url);
  return url;
}

/**
 * <img class="sprite"> d'un sprite de l'atlas. La taille à l'écran se règle en CSS
 * (classes sprite--sm / --md / --lg) ou par `scale` (multiple de la taille d'origine × --u).
 */
export function sprite(name, cls = 'sprite--md', opts = {}) {
  const img = el(`img.sprite.${cls}`, { src: spriteURL(name, opts), alt: '', draggable: 'false' });
  try {
    const { w, h } = spriteSize(name);
    img.style.setProperty('--sw', w);
    img.style.setProperty('--sh', h);
  } catch {
    /* sprite inconnu */
  }
  return img;
}

// Sprites représentatifs des investissements et des cultures.
export const INVESTMENT_SPRITES = {
  goat: 'animal.goat',
  jamWorkshop: 'building.jamworkshop',
  dairy: 'building.dairy',
  mill: 'building.windmill',
  chickenCoop: 'animal.chicken',
  beehive: 'beehive',
  roadsideStand: 'stall.cart',
  cow: 'animal.cow',
  sheep: 'animal.sheep',
  sprinkler: 'sprinkler',
  solarPanel: 'solar.panel',
  guestHouse: 'building.cottage.red',
};

export function cropIcon(cropId, cls = 'sprite--md') {
  return spriteAny([`crop.${cropId}.icon`, `tree.${cropId}.icon`, `crop.${cropId}.4`], cls, 'seed');
}

export function investmentIcon(id, cls = 'sprite--md') {
  const fallback = { goat: ['animal.sheep'], jamWorkshop: ['product.jam', 'product.strawberryJam', 'building.shed'], dairy: ['product.cheese', 'product.cowCheese', 'building.shed'], mill: ['product.flour', 'sack.wheat', 'building.shed'] }[id] || [];
  return spriteAny([INVESTMENT_SPRITES[id], ...fallback, 'sign'], cls, 'coin');
}

// ── Sprites v3 (noms encore susceptibles de bouger : on essaie plusieurs noms) ─────
/** Le sprite existe-t-il dans l'atlas (planche chargée) ? */
export function hasSprite(name) {
  return !!name && Object.prototype.hasOwnProperty.call(SPRITES, name) && (!images || !SPRITES[name].sheet || !!images[SPRITES[name].sheet] || !!SPRITES[name].layers);
}

/**
 * Premier sprite connu d'une liste de noms ; sinon, une icône de la planche de l'interface
 * (`fallbackIcon`), pour que l'interface reste lisible même sans le dessin attendu.
 */
export function spriteAny(names, cls = 'sprite--md', fallbackIcon = 'info', opts = {}) {
  for (const n of names) if (hasSprite(n)) return sprite(n, cls, opts);
  const size = /--(xs|sm)\b/.test(cls) ? 'sm' : /--(card|deco|avatar|hero|lg)\b/.test(cls) ? 'lg' : 'md';
  return icon(fallbackIcon, size, `ico--fallback ${cls.replace(/sprite--/g, 'ico-as-')}`);
}

/** Icône d'un produit transformé (confiture, jus, fromage, farine, pain) : nom donné par l'atlas. */
export function productIcon(productId, cls = 'sprite--md') {
  const name = productSprite(productId);
  const img = spriteAny([name, 'product.flour' === name ? 'sack.wheat' : null].filter(Boolean), cls, 'harvest');
  // Fromage de chèvre : même meule que le fromage de vache, teintée.
  if (productId === 'goatCheese' && name === productSprite('cowCheese')) img.classList.add('is-goat-tint');
  return img;
}

/** Icône de l'entrée d'une recette : culture (récolte) ou animal (lait). */
export function inputIcon(input, cls = 'sprite--sm') {
  if (input === 'cow' || input === 'goat') return spriteAny([`product.milk.${input}`, input === 'cow' ? 'milk.bottle' : 'product.milk.goat', INVESTMENT_SPRITES[input]], cls, 'harvest');
  return cropIcon(input, cls);
}

const PERK_SPRITES = {
  almanac: ['perk.book'],
  startPurse: ['perk.coin'],
  goodSeeds: ['perk.seeds'],
  goodNeighbor: ['perk.barn'],
  greenThumb: ['perk.clover', 'perk.wateringcan'],
  haggler: ['perk.coin'],
  surveyor: ['perk.compost'],
  frugal: ['perk.coin'],
  grandmaRecipes: ['perk.book', 'product.jam'],
  famousStand: ['perk.basket', 'stall.cart'],
  artisan: ['product.jam', 'perk.barn'],
  orchardist: ['tree.apple.icon', 'crop.apple.icon'],
  frostInsurance: ['perk.wateringcan'],
  seedMerchant: ['perk.seeds'],
};
const PERK_FALLBACK = { almanac: 'sunny', startPurse: 'coin', goodNeighbor: 'bill', frugal: 'coin', frostInsurance: 'winter', haggler: 'coin' };

export function perkIcon(perkId, cls = 'sprite--md') {
  return spriteAny([`icon.perk.${perkId}`, `perk.${perkId}`, ...(PERK_SPRITES[perkId] || [])], cls, PERK_FALLBACK[perkId] || 'star');
}

/** Icône d'un succès ; `done` = faux : version grisée (classe CSS). */
export function achievementIcon(achId, done = true, cls = 'sprite--md', stars = 0) {
  const metal = stars ? 'gold' : 'silver';
  const img = spriteAny([`icon.ach.${achId}`, `icon.trophy.${metal}`, 'icon.trophy.gold', 'icon.medal'], cls, 'star');
  if (!done) img.classList.add('is-locked-icon');
  return img;
}

/** Petite pièce d'écu (monnaie décorative). */
export function ecuIcon(cls = 'sprite--sm') {
  return spriteAny(['icon.ecu'], cls, 'coin');
}

/** Icône d'un objet de personnalisation (décor, allée, clôture, tenue) : noms donnés par l'atlas. */
export function cosmeticIcon(item, cls = 'sprite--md') {
  const id = typeof item === 'string' ? item : item?.id;
  if (!id) return icon('info', 'md');
  if (id.startsWith('outfit.')) return outfitIcon(id, cls);
  const fb = id.startsWith('flowers') ? 'spring' : id.startsWith('path') ? 'seed' : 'star';
  // Allées et clôtures : aperçus « decor.path.* » / « decor.fence.* » de l'atlas ; objets : decorSprite.
  return spriteAny([decorSprite(id), `decor.${id}`].filter(Boolean), cls, fb);
}

/** Aperçu d'une tenue du fermier (outfitSprite de l'atlas). */
export function outfitIcon(outfitId, cls = 'sprite--md') {
  return spriteAny([outfitSprite(outfitId), 'farmer'], cls, 'star');
}

/**
 * Revenu quotidien saison par saison : quatre petites icônes de saison suivies du montant
 * (la saison en cours est mise en valeur). `bySeason` = revenu par unité, `units` = nombre d'unités.
 */
export function seasonIncomes(bySeason = {}, units = 1, currentSeason = null) {
  return el(
    'span.season-incomes',
    ['spring', 'summer', 'autumn', 'winter'].map((s) => {
      const v = (bySeason[s] || 0) * units;
      return el(`span.si${s === currentSeason ? '.is-now' : ''}${v ? '' : '.is-zero'}`, icon(s, 'xs'), v ? `+${v}` : '0');
    }),
  );
}
