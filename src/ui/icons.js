// Icônes de l'interface : planche assets/sprites/ui/icons.png (générée par generate-icons.py)
// et sprites de l'atlas (cultures, animaux, bâtiments) convertis en petites images.

import { drawSprite, spriteSize } from '../render/atlas.js';
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
  return sprite(`crop.${cropId}.icon`, cls);
}

export function investmentIcon(id, cls = 'sprite--md') {
  return sprite(INVESTMENT_SPRITES[id] || 'sign', cls);
}
