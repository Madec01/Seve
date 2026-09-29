// Chargement des images et préparation des planches saisonnières.
//
// loadImages(SHEETS, { base })   → Promise<{ farm, town, extra }> (HTMLImageElement)
// buildSeasonSheets(images)      → { spring, summer, autumn, winter } : copies des planches où les
//                                   verts de l'herbe sont recoloriés selon la saison ; en hiver, les
//                                   dessus des objets (toits, clôtures, arbres…) reçoivent aussi une
//                                   couche de neige (« chapeaux » blancs sous le contour).
//
// Les adresses passent par assetUrl() (src/version.js) : « ?v=<empreinte> » dans le jeu empaqueté.
//
// Le recoloriage se fait une seule fois, au chargement, sur des canvas hors écran : le rendu reste
// au pixel près (aucun filtre en temps réel) et les contours sombres sont conservés.

import { assetUrl } from '../version.js';

/**
 * Charge une image ; en cas d'échec (réseau instable), jusqu'à `retries` nouveaux essais espacés,
 * en contournant les caches (« r=n » dans l'adresse). Rejette avec un message clair à la fin.
 */
export function loadImage(src, retries = 2) {
  const url = assetUrl(src);
  const attempt = (n) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image introuvable : ${src}`));
    img.src = n ? `${url}${url.includes('?') ? '&' : '?'}r=${n}` : url;
  });
  const run = (n) => attempt(n).catch((err) => {
    if (n >= retries) throw err;
    return new Promise((r) => setTimeout(r, 600 * (n + 1))).then(() => run(n + 1));
  });
  return run(0);
}

/**
 * Charge toutes les planches d'un dictionnaire { clé: chemin }.
 * @param sheets  ex. SHEETS de atlas.js
 * @param opts    { base = '' } préfixe des chemins (ex. '../' depuis tools/)
 */
export async function loadImages(sheets, opts = {}) {
  const base = opts.base || '';
  const entries = await Promise.all(
    Object.entries(sheets).map(async ([key, path]) => [key, await loadImage(base + path)]),
  );
  return Object.fromEntries(entries);
}

// ---------------------------------------------------------------------------
// Palette : les trois verts de l'herbe Kenney (base, clair, sombre).
const GRASS = [
  [132, 198, 105],
  [139, 216, 125],
  [101, 165, 86],
];
const OUTLINE = [63, 38, 49];

// Remplacement par saison (même ordre que GRASS).
export const SEASON_GRASS = {
  spring: [[128, 202, 104], [150, 222, 124], [96, 168, 86]],
  summer: [[156, 198, 92], [178, 214, 110], [122, 164, 76]],
  autumn: [[198, 172, 84], [220, 192, 102], [162, 132, 66]],
  winter: [[226, 234, 242], [250, 252, 255], [184, 200, 220]],
};

const SNOW_TOP = [250, 252, 255];
const SNOW_EDGE = [214, 226, 240];

function toCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return c;
}

// Copie dans un canvas « normal » (accéléré) : les canvas willReadFrequently restent en mémoire
// centrale, ce qui ralentirait leur dessin à chaque image.
function finalize(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

function sameRGB(d, i, rgb) {
  return d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2];
}

function recolorGrass(canvas, palette) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    for (let k = 0; k < GRASS.length; k++) {
      if (sameRGB(d, i, GRASS[k])) {
        d[i] = palette[k][0];
        d[i + 1] = palette[k][1];
        d[i + 2] = palette[k][2];
        break;
      }
    }
  }
  ctx.putImageData(data, 0, 0);
}

/**
 * Neige sur les dessus : pour chaque colonne de chaque tuile de 16 px, à chaque passage
 * « transparent → contour → remplissage », les 2 premiers pixels de remplissage deviennent blancs.
 * Les tuiles opaques (sol) ne sont pas touchées : aucun passage depuis le transparent.
 */
function addSnowCaps(canvas, tile = 16) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const idx = (x, y) => (y * w + x) * 4;
  for (let ty = 0; ty < h; ty += tile) {
    for (let x = 0; x < w; x++) {
      let prevTransparent = true; // le haut de la tuile compte comme du vide
      let y = ty;
      while (y < ty + tile) {
        const i = idx(x, y);
        const transparent = d[i + 3] === 0;
        if (!transparent && prevTransparent && sameRGB(d, i, OUTLINE)) {
          // saute le contour
          let yy = y;
          while (yy < ty + tile && d[idx(x, yy) + 3] !== 0 && sameRGB(d, idx(x, yy), OUTLINE)) yy++;
          let painted = 0;
          while (yy < ty + tile && painted < 2) {
            const j = idx(x, yy);
            if (d[j + 3] === 0 || sameRGB(d, j, OUTLINE)) break;
            const c = painted === 0 ? SNOW_TOP : SNOW_EDGE;
            d[j] = c[0];
            d[j + 1] = c[1];
            d[j + 2] = c[2];
            painted++;
            yy++;
          }
          y = yy;
          prevTransparent = false;
          continue;
        }
        prevTransparent = transparent;
        y++;
      }
    }
  }
  ctx.putImageData(data, 0, 0);
}

// Hiver : toits enneigés. Couleurs remplacées tuile par tuile (les murs partagent certaines
// couleurs avec les toits d'ardoise, d'où la restriction aux tuiles de toiture).
const SNOW_ROOFS = [
  {
    sheet: 'town', // ardoise
    tiles: [[0, 4], [1, 4], [2, 4], [0, 5], [1, 5], [2, 5], [3, 5]],
    map: [[[90, 105, 136], [168, 184, 212]], [[139, 155, 180], [222, 232, 244]], [[192, 203, 220], [250, 252, 255]]],
  },
  {
    sheet: 'town', // tuiles rouges (chambre d'hôte, cabane du poulailler)
    tiles: [[4, 4], [5, 4], [6, 4], [4, 5], [5, 5], [6, 5], [7, 5]],
    map: [[[195, 75, 53], [214, 170, 176]], [[242, 132, 98], [232, 236, 246]], [[252, 188, 143], [252, 252, 255]]],
  },
  {
    sheet: 'farm', // toit vert de la grange
    tiles: [[10, 6], [9, 7], [10, 7], [11, 7], [9, 8], [10, 8], [11, 8], [9, 9], [10, 9], [11, 9], [9, 10], [11, 10]],
    map: [[[78, 151, 76], [200, 214, 234]], [[132, 198, 105], [236, 242, 252]], [[198, 229, 141], [255, 255, 255]]],
  },
];

function snowRoofs(canvas, sheet, tile = 16) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  for (const roof of SNOW_ROOFS) {
    if (roof.sheet !== sheet) continue;
    for (const [tx, ty] of roof.tiles) {
      const data = ctx.getImageData(tx * tile, ty * tile, tile, tile);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        for (const [from, to] of roof.map) {
          if (sameRGB(d, i, from)) {
            d[i] = to[0];
            d[i + 1] = to[1];
            d[i + 2] = to[2];
            break;
          }
        }
      }
      ctx.putImageData(data, tx * tile, ty * tile);
    }
  }
}

/**
 * Planches recoloriées pour chaque saison : { spring: {farm, town, extra}, summer: …, … }.
 * À utiliser pour le décor (sol, forêt, arbres, clôtures, bâtiments) ; les cultures, animaux et
 * objets se dessinent avec les planches d'origine.
 */
const seasonCache = new WeakMap();

/** Planches recolorées par saison (calculées une fois par jeu d'images : la scène peut être recréée). */
export function buildSeasonSheets(images) {
  if (seasonCache.has(images)) return seasonCache.get(images);
  const out = {};
  for (const season of Object.keys(SEASON_GRASS)) {
    const set = {};
    for (const [key, img] of Object.entries(images)) {
      const c = toCanvas(img);
      if (season === 'winter') snowRoofs(c, key);
      recolorGrass(c, SEASON_GRASS[season]);
      if (season === 'winter') addSnowCaps(c);
      set[key] = finalize(c);
    }
    out[season] = set;
  }
  seasonCache.set(images, out);
  return out;
}
