// Zoom de la scène choisi par le joueur (pincement, boutons + / −) : calculs purs, sans DOM.
//
// Le rendu reste en pixel art net : le zoom « posé » est toujours un entier (pixels réels du canvas par
// pixel du monde) ; seul le pincement en cours passe par des valeurs fractionnaires (plus proche voisin,
// jamais de flou), puis la vue se pose sur l'entier le plus proche au lever des doigts.
//
//   zoomBounds({ base, bandW, bandH, worldW, worldH, career }) → { min, max, base }
//       base : zoom par défaut (calculé par la scène) ; min : « toute la ferme visible » si possible
//       (au moins ≈ 40 % du défaut en Niveaux, 50 % en Carrière : le monde y est immense) ; max : ≈ ×2,5.
//   clampZoom(z, b)                   borne z dans [min, max]
//   snapZoom(z, b)                    entier le plus proche, borné
//   stepZoom(z, dir, b)               entier suivant (+1) ou précédent (−1) à partir de z, borné
//   pinchZoom(z0, d0, d, b)           zoom pendant le pincement (écart des doigts d0 → d), borné avec un
//                                     léger dépassement élastique (5 %) qui revient au lever
//   anchorScroll(base, zoom, w, s)    défilement (px réels) qui met le point du monde w sous le point
//                                     d'écran s (px réels) : base + w × zoom − s
//   zoomRatio(z, base) / zoomFromRatio(r, b)   préférence enregistrée (rapport au zoom par défaut,
//                                     indépendant de l'écran) ↔ zoom entier borné ; null = défaut
//   staticRegion({ worldX0, worldX1, worldH, minZoom, devW, devH, bandCx }) → { x0, y0, w, h }
//       couche fixe (px du monde) qui couvre l'écran pour tout zoom ≥ minZoom et tout défilement :
//       elle ne dépend pas du zoom courant (pas de reconstruction pendant un pincement).

export const ZOOM_MAX_FACTOR = 2.5;
export const ZOOM_MIN_FACTOR = { levels: 0.4, career: 0.5 };
const RUBBER = 0.05;

export function zoomBounds({ base, bandW, bandH, worldW, worldH, career = false }) {
  const b = Math.max(1, Math.round(base) || 1);
  const fitAll = Math.floor(Math.min((bandW || 1) / Math.max(1, worldW || 1), (bandH || 1) / Math.max(1, worldH || 1)));
  const floor = Math.ceil(b * (career ? ZOOM_MIN_FACTOR.career : ZOOM_MIN_FACTOR.levels));
  const min = Math.max(1, Math.min(b, Math.max(fitAll, floor)));
  const max = Math.max(b + 1, Math.floor(b * ZOOM_MAX_FACTOR));
  return { min, max, base: b };
}

export function clampZoom(z, b) {
  const v = Number(z);
  if (!Number.isFinite(v)) return b.base;
  return Math.max(b.min, Math.min(b.max, v));
}

export function snapZoom(z, b) {
  return clampZoom(Math.round(clampZoom(z, b)), b);
}

export function stepZoom(z, dir, b) {
  const cur = clampZoom(z, b);
  const next = dir > 0 ? Math.floor(cur + 1e-6) + 1 : Math.ceil(cur - 1e-6) - 1;
  return clampZoom(next, b);
}

export function pinchZoom(z0, d0, d, b) {
  const raw = (Number(z0) || b.base) * (Math.max(1, d) / Math.max(1, d0));
  const lo = b.min * (1 - RUBBER);
  const hi = b.max * (1 + RUBBER);
  if (raw < b.min) return Math.max(lo, b.min - (b.min - raw) * 0.3);
  if (raw > b.max) return Math.min(hi, b.max + (raw - b.max) * 0.3);
  return raw;
}

export function anchorScroll(base, zoom, w, s) {
  return base + w * zoom - s;
}

export function zoomRatio(z, base) {
  if (z === null || z === undefined || !base) return null;
  const r = z / base;
  return Math.abs(r - 1) < 1e-6 ? null : Math.round(r * 1000) / 1000;
}

export function zoomFromRatio(r, b) {
  const v = Number(r);
  if (r === null || r === undefined || !Number.isFinite(v) || v <= 0) return null;
  const z = snapZoom(b.base * v, b);
  return z === b.base ? null : z;
}

export function staticRegion({ worldX0 = 0, worldX1, worldH, minZoom, devW, devH, bandCx }) {
  const zm = Math.max(0.5, (minZoom || 1) * (1 - RUBBER)); // dépassement élastique du pincement compris
  const cx = bandCx ?? devW / 2;
  const left = Math.ceil(Math.max(0, cx) / zm) + 32;
  const right = Math.ceil(Math.max(0, devW - cx) / zm) + 32;
  const vert = Math.ceil(devH / zm) + 32;
  const x0 = Math.floor(worldX0 - left);
  const y0 = -vert;
  return { x0, y0, w: Math.ceil(worldX1 + right) - x0, h: Math.ceil(worldH + vert) - y0 };
}
