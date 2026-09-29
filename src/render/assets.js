// Chargement des images et préparation des planches saisonnières.
//
// loadImages(SHEETS, { base })   → Promise<{ farm, town, extra }> (HTMLImageElement)
// buildSeasonSheets(images)      → { spring, summer, autumn, winter } : copies des planches où les
//                                   verts de l'herbe sont recoloriés selon la saison ; en hiver, les
//                                   dessus des objets (toits, clôtures, arbres…) reçoivent aussi une
//                                   couche de neige (« chapeaux » blancs sous le contour).
//
// Le recoloriage se fait une seule fois, au chargement, sur des canvas hors écran : le rendu reste
// au pixel près (aucun filtre en temps réel) et les contours sombres sont conservés.

/** Charge une image ; rejette avec un message clair si elle est introuvable. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image introuvable : ${src}`));
    img.src = src;
  });
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
  autumn: [[190, 172, 92], [212, 190, 110], [156, 132, 74]],
  winter: [[226, 234, 242], [250, 252, 255], [184, 200, 220]],
};

const SNOW_TOP = [250, 252, 255];
const SNOW_EDGE = [214, 226, 240];

function toCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return c;
}

function sameRGB(d, i, rgb) {
  return d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2];
}

function recolorGrass(canvas, palette) {
  const ctx = canvas.getContext('2d');
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
  const ctx = canvas.getContext('2d');
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

/**
 * Planches recoloriées pour chaque saison : { spring: {farm, town, extra}, summer: …, … }.
 * À utiliser pour le décor (sol, forêt, arbres, clôtures, bâtiments) ; les cultures, animaux et
 * objets se dessinent avec les planches d'origine.
 */
export function buildSeasonSheets(images) {
  const out = {};
  for (const season of Object.keys(SEASON_GRASS)) {
    const set = {};
    for (const [key, img] of Object.entries(images)) {
      const c = toCanvas(img);
      recolorGrass(c, SEASON_GRASS[season]);
      if (season === 'winter') addSnowCaps(c);
      set[key] = c;
    }
    out[season] = set;
  }
  return out;
}
