// Effets visuels : météo (pluie, orage, neige), feuilles d'automne, pétales et papillons,
// lucioles, brume de chaleur, lumière du jour, étalonnage des couleurs par saison et météo,
// textes flottants (« +12 » avec pièce), gerbes de pièces, gouttes, poussière, étincelles,
// cultures gelées ou pourries.
//
// Coordonnées :
//   - « monde »  : pixels de la scène (tuiles de 16 px), origine = coin haut-gauche du monde ;
//   - « vue »    : pixels du tampon de rendu (le monde + la bordure de forêt autour) ;
//   - « écran »  : pixels réels du canvas (après zoom entier).
// La scène (scene.js) appelle update/draw* au bon moment ; l'interface n'utilise que
// onEvent(type, payload, layout) et floatText(worldX, worldY, text, color).
// (Carrière) Réactions aux événements du mode Carrière (ramassage, grenier, truffes, pêche, naissances,
// passage de rang, arrosage des machines…) et shift(dx, dy) : le monde a grandi, tout ce qui est en
// coordonnées du monde se décale.
//
// Pas d'allocation par image : toutes les particules viennent de réserves préallouées.

import { TILE, SPRITES, drawSprite, productSprite } from './atlas.js';

const OUTLINE = '#3f2631';
const GOLD = '#ffe27a';

// ---------------------------------------------------------------------------
// Réserve d'objets réutilisables.
function makePool(size, init) {
  const items = new Array(size);
  for (let i = 0; i < size; i++) items[i] = { alive: false, ...init };
  let cursor = 0;
  return {
    items,
    spawn() {
      for (let k = 0; k < size; k++) {
        const p = items[cursor];
        cursor = (cursor + 1) % size;
        if (!p.alive) {
          p.alive = true;
          return p;
        }
      }
      // Réserve pleine : on recycle la plus ancienne position du curseur.
      const p = items[cursor];
      cursor = (cursor + 1) % size;
      p.alive = true;
      return p;
    },
    clear() {
      for (const p of items) p.alive = false;
    },
  };
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

// Petites images précalculées (pixel art).
function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx);
  return c;
}
function pix(ctx, color, pts) {
  ctx.fillStyle = color;
  for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i], pts[i + 1], 1, 1);
}

function buildSprites() {
  const rain = makeCanvas(3, 7, (c) => {
    pix(c, 'rgba(236,244,255,0.95)', [2, 0, 2, 1, 1, 2, 1, 3]);
    pix(c, 'rgba(170,200,240,0.8)', [1, 4, 0, 5, 0, 6]);
  });
  const rainHeavy = makeCanvas(4, 8, (c) => {
    pix(c, 'rgba(225,236,255,0.9)', [3, 0, 3, 1, 2, 2, 2, 3, 1, 4, 1, 5]);
    pix(c, 'rgba(225,236,255,0.55)', [0, 6, 0, 7]);
  });
  const splash = [
    makeCanvas(5, 3, (c) => pix(c, 'rgba(220,235,255,0.8)', [2, 1, 1, 2, 3, 2])),
    makeCanvas(5, 3, (c) => pix(c, 'rgba(220,235,255,0.6)', [0, 1, 4, 1, 1, 0, 3, 0])),
  ];
  const coin = [
    makeCanvas(5, 5, (c) => {
      pix(c, OUTLINE, [1, 0, 2, 0, 3, 0, 0, 1, 4, 1, 0, 2, 4, 2, 0, 3, 4, 3, 1, 4, 2, 4, 3, 4]);
      pix(c, '#fdbe53', [1, 1, 2, 1, 3, 1, 1, 2, 3, 2, 1, 3, 2, 3, 3, 3]);
      pix(c, '#fff3b0', [2, 2, 1, 1]);
    }),
    makeCanvas(5, 5, (c) => {
      pix(c, OUTLINE, [1, 0, 2, 0, 3, 0, 1, 1, 3, 1, 1, 2, 3, 2, 1, 3, 3, 3, 1, 4, 2, 4, 3, 4]);
      pix(c, '#e3862a', [2, 1, 2, 2, 2, 3]);
    }),
  ];
  const sparkle = [
    makeCanvas(5, 5, (c) => pix(c, '#ffffff', [2, 2])),
    makeCanvas(5, 5, (c) => { pix(c, '#fff3b0', [2, 1, 1, 2, 3, 2, 2, 3]); pix(c, '#ffffff', [2, 2]); }),
    makeCanvas(5, 5, (c) => { pix(c, '#ffe27a', [2, 0, 0, 2, 4, 2, 2, 4]); pix(c, '#fff3b0', [2, 1, 1, 2, 3, 2, 2, 3]); pix(c, '#ffffff', [2, 2]); }),
  ];
  const ice = [
    makeCanvas(5, 5, (c) => pix(c, '#e8f6ff', [2, 2])),
    makeCanvas(5, 5, (c) => { pix(c, '#bfe3ff', [2, 1, 1, 2, 3, 2, 2, 3]); pix(c, '#ffffff', [2, 2]); }),
    makeCanvas(5, 5, (c) => { pix(c, '#9ccfff', [0, 0, 4, 0, 0, 4, 4, 4]); pix(c, '#bfe3ff', [1, 1, 3, 1, 1, 3, 3, 3]); pix(c, '#ffffff', [2, 2]); }),
  ];
  // Ombre de nuage : amas de disques à bords nets (pas d'anticrénelage).
  const cloud = makeCanvas(96, 40, (c) => {
    const img = c.createImageData(96, 40);
    const blobs = [[26, 22, 16], [46, 16, 18], [66, 22, 15], [40, 26, 14], [58, 27, 13]];
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 96; x++) {
        let inside = false;
        for (const [bx, by, r] of blobs) {
          const dx = x - bx;
          const dy = (y - by) * 1.5;
          if (dx * dx + dy * dy <= r * r) { inside = true; break; }
        }
        if (inside) {
          const i = (y * 96 + x) * 4;
          img.data[i] = 40; img.data[i + 1] = 44; img.data[i + 2] = 70; img.data[i + 3] = 255;
        }
      }
    }
    c.putImageData(img, 0, 0);
  });
  return { rain, rainHeavy, splash, coin, sparkle, ice, cloud };
}

// ---------------------------------------------------------------------------
// Lumière : couleurs de multiplication (1 = neutre), combinées composante par composante.
const SEASON_GRADE = {
  spring: [1.0, 1.0, 0.98],
  summer: [1.0, 0.98, 0.92],
  autumn: [1.0, 0.94, 0.86],
  winter: [0.93, 0.96, 1.0],
};
const WEATHER_GRADE = {
  sunny: [1, 1, 1],
  cloudy: [0.9, 0.91, 0.95],
  rain: [0.8, 0.83, 0.9],
  storm: [0.68, 0.7, 0.82],
  heatwave: [1.0, 0.95, 0.84],
  snow: [0.9, 0.92, 0.98],
};
const DAWN = [1.0, 0.8, 0.86]; // rose
const DUSK = [1.0, 0.78, 0.6]; // orangé

function dayGrade(p, out) {
  // p : 0 = aube, 1 = fin de journée. Jamais sombre.
  let dawn = 0;
  let dusk = 0;
  if (p < 0.18) dawn = 1 - p / 0.18;
  if (p > 0.68) dusk = (p - 0.68) / 0.32;
  dawn *= dawn;
  for (let k = 0; k < 3; k++) {
    out[k] = 1 - (1 - DAWN[k]) * dawn * 0.9 - (1 - DUSK[k]) * dusk * 0.85;
  }
  return out;
}

const CONFETTI_COLORS = ['#e04a4a', '#fdbe53', '#5aa0e8', '#72c85a', '#ffffff', '#ff8fc0'];
const LEAF_COLORS = ['#e3862a', '#c8552f', '#fdbe53', '#b5462a'];
const PETAL_COLORS = ['#ffd3e2', '#ffffff', '#ffb3cc'];
const BUTTERFLY_COLORS = ['#fff3b0', '#ffffff', '#ffb3cc', '#9ccfff'];

/**
 * @param images  planches { farm, town, extra } (pour les pièces et cultures mortes)
 */
export function createEffects(images) {
  const S = buildSprites();

  // Réserves
  const rain = makePool(480, { x: 0, y: 0, vy: 0, groundY: 0, heavy: false });
  const splashes = makePool(80, { x: 0, y: 0, t: 0 });
  const flakes = makePool(400, { x: 0, y: 0, vy: 0, phase: 0, size: 1, drift: 0 });
  const leaves = makePool(40, { x: 0, y: 0, vy: 0, vx: 0, phase: 0, color: '', shape: 0 });
  const petals = makePool(40, { x: 0, y: 0, vy: 0, vx: 0, phase: 0, color: '' });
  const butterflies = makePool(10, { x: 0, y: 0, tx: 0, ty: 0, phase: 0, color: '', t: 0 });
  const fireflies = makePool(32, { x: 0, y: 0, phase: 0, speed: 0 });
  const parts = makePool(400, {
    kind: '', x: 0, y: 0, vx: 0, vy: 0, g: 0, t: 0, life: 1, delay: 0, color: '', floor: 0, frame: 0,
  });
  const texts = makePool(48, { x: 0, y: 0, text: '', color: '', t: 0, life: 1.8, delay: 0, icon: false, sprite: '' });
  const ghosts = makePool(48, { x: 0, y: 0, sprite: '', t: 0, life: 3, delay: 0, kind: '', scale: 1, set: null, h: 16 });
  // (v3) Icônes qui volent (récolte → atelier) ou qui sautent (produit prêt) : sprites 16 × 16.
  const flyers = makePool(32, { sprite: '', x0: 0, y0: 0, x1: 0, y1: 0, t: 0, life: 0.8, delay: 0, arc: 0, kind: '' });
  const clouds = makePool(10, { x: 0, y: 0, vx: 0 });

  const env = { season: 'spring', weather: 'sunny', dayProgress: 0.4, view: { x: 0, y: 0, w: 512, h: 320 } };
  let time = 0;
  let flash = 0; // éclair (0..1)
  let nextFlash = 3;
  // Mouvements réduits (option « Réduire les animations » / prefers-reduced-motion) : pas d'éclair blanc
  // (léger assombrissement à la place, jamais double), pas de brume de chaleur, pas de tremblement,
  // moitié moins de particules, textes flottants qui s'effacent presque sur place.
  let reduced = false;
  let skipToggle = false;
  const intensity = { rain: 0, snow: 0, leaves: 0, petals: 0, clouds: 0 };
  let primed = false;
  const grade = [1, 1, 1];
  const dayTmp = [1, 1, 1];

  // ── Émetteurs publics ────────────────────────────────────────────────────────────
  function floatText(wx, wy, text, color = GOLD, opts = {}) {
    const p = texts.spawn();
    p.x = wx;
    p.y = wy;
    p.text = String(text);
    p.color = color;
    p.t = 0;
    p.life = opts.life || 1.9;
    p.delay = opts.delay || 0;
    p.icon = opts.icon === undefined ? /^\+/.test(p.text) : !!opts.icon;
    p.sprite = opts.sprite || '';
    return p;
  }

  /** Icône qui vole d'un point à un autre en cloche (px du monde, coin haut-gauche du sprite). */
  function fly(sprite, x0, y0, x1, y1, opts = {}) {
    const f = flyers.spawn();
    f.sprite = sprite;
    f.x0 = x0; f.y0 = y0; f.x1 = x1; f.y1 = y1;
    f.t = 0;
    f.life = opts.life || 0.85;
    f.delay = opts.delay || 0;
    f.arc = opts.arc ?? 22;
    f.kind = opts.kind || 'fly';
    return f;
  }

  /** Produit prêt : l'icône saute au-dessus du bâtiment puis s'efface (px du monde, centre). */
  function popIcon(sprite, cx, cy, delay = 0) {
    fly(sprite, cx - 8, cy - 8, cx - 8, cy - 26, { life: 1.3, delay, arc: 0, kind: 'pop' });
  }

  /** Confettis (remise des prix du concours). */
  function confetti(rect, n = 40, delay = 0) {
    for (let i = 0; i < n; i++) {
      const c = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      particle('confetti', rect.x + rand(0, rect.w), rect.y + rand(-6, 6), rand(-30, 30), rand(-80, -30), 70, rand(1.8, 2.8), c, delay + rand(0, 0.4), rect.y + rect.h + rand(0, 12));
    }
  }

  /** Arbre arraché : il s'enfonce dans la terre (découpé net au ras du sol), poussière et feuilles. */
  function sinkTree(rect, sprite, set, k = 1) {
    const g = ghosts.spawn();
    g.x = rect.x;
    g.y = rect.y;
    g.scale = k;
    g.sprite = sprite;
    g.set = set || null;
    g.t = 0;
    g.life = 1.1;
    g.delay = 0;
    g.kind = 'sink';
    g.h = rect.h;
    dirt(rect.x + rect.w / 2, rect.y + rect.h * 0.7, 14 * k, k);
    leafBurst(rect.x + rect.w / 2, rect.y + rect.h * 0.3, 6 * k, k);
  }

  function particle(kind, x, y, vx, vy, g, life, color = '', delay = 0, floor = Infinity) {
    if (reduced && kind !== 'smoke') {
      // Une particule sur deux (alternance déterministe : le motif reste lisible).
      skipToggle = !skipToggle;
      if (skipToggle) return null;
    }
    const p = parts.spawn();
    p.kind = kind;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.g = g;
    p.t = 0; p.life = life; p.color = color; p.delay = delay; p.floor = floor;
    p.frame = Math.floor(Math.random() * 3);
    return p;
  }

  function coins(wx, wy, n = 6, delay = 0) {
    for (let i = 0; i < n; i++) {
      particle('coin', wx + rand(-3, 3), wy, rand(-28, 28), rand(-70, -45), 190, rand(0.8, 1.1), '', delay + i * 0.03, wy + rand(4, 10));
    }
  }

  // k : échelle des parcelles (1 en paysage, 2 en portrait) — les gerbes s'étalent d'autant.
  function droplets(wx, wy, n = 10, k = 1) {
    for (let i = 0; i < n; i++) {
      const x = wx + rand(-7, 7) * k;
      particle('drop', x, wy - rand(10, 18) * k, rand(-6, 6), rand(10, 40), 260, 0.9, i % 3 ? '#8fd0ff' : '#dff3ff', i * 0.025, wy + rand(-4, 6) * k);
    }
  }

  function dirt(wx, wy, n = 9, k = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      particle('dust', wx + Math.cos(a) * 2 * k, wy + Math.sin(a) * k, Math.cos(a) * rand(12, 26) * k, (Math.sin(a) * rand(6, 14) - 10) * k, 30, rand(0.35, 0.6), i % 2 ? '#cf8254' : '#eaa56c');
    }
  }

  function leafBurst(wx, wy, n = 5, k = 1) {
    for (let i = 0; i < n; i++) {
      particle('leaf', wx + rand(-4, 4) * k, wy, rand(-25, 25) * k, rand(-50, -25) * Math.sqrt(k), 120, rand(0.5, 0.8), i % 2 ? '#65a556' : '#84c669', 0, wy + rand(2, 8) * k);
    }
  }

  function sparkle(rect, n = 14, palette = 'gold', delay = 0) {
    const r = rect || { x: 0, y: 0, w: 16, h: 16 };
    for (let i = 0; i < n; i++) {
      particle(palette === 'ice' ? 'ice' : 'spark', r.x + rand(0, r.w), r.y + rand(0, r.h), rand(-4, 4), rand(-14, -4), 0, rand(0.7, 1.3), '', delay + rand(0, 0.6));
    }
  }

  function ghostCrop(rect, cropId, kind, delay = 0, k = 1) {
    if (!cropId) return;
    const g = ghosts.spawn();
    g.x = rect.x;
    g.y = rect.y;
    g.scale = k;
    g.sprite = `crop.${cropId}.dead`;
    g.t = 0;
    g.life = 3.2;
    g.delay = delay;
    g.kind = kind;
    g.set = null;
  }

  function flies(wx, wy) {
    for (let i = 0; i < 2; i++) particle('fly', wx, wy, 0, 0, 0, 2.6, OUTLINE, i * 0.4);
  }

  const contestDone = new Set();

  function flyToBuilding(info, from, layout, delay) {
    if (!info || !info.buildingId) return;
    const a = layout.investmentAnchor(info.buildingId, 1);
    const sprite = productSprite(info.productId);
    fly(sprite, from.x - 8, from.y - 12, a.x - 8, a.y + 14, { delay, life: 0.9, arc: 26 });
    sparkle({ x: a.x - 8, y: a.y + 8, w: 16, h: 12 }, 5, 'gold', delay + 0.85);
  }

  // ── Événements du jeu ────────────────────────────────────────────────────────────
  /**
   * Réaction visuelle à un événement du cœur de jeu.
   * @param type     'harvested' | 'watered' | 'planted' | 'purchased' | 'dawn' | 'frost' | 'rot' | 'plotUnlocked' | …
   * @param payload  données de l'événement (voir docs/ARCHITECTURE.md)
   * @param layout   objet renvoyé par createLayout (positions)
   */
  function onEvent(type, payload = {}, layout) {
    if (!layout) return;
    const k = layout.plotScale || 1;
    switch (type) {
      case 'harvested': {
        const c = layout.plotCenter(payload.plotIndex);
        if (!c) return;
        leafBurst(c.x, c.y, 5 * k, k);
        if (payload.processed) {
          // Part à l'atelier : pas de pièces, l'icône du produit s'envole (processingStarted).
          floatText(c.x, c.y - 10 * k, '→ atelier', '#fff3b0', { icon: false, life: 1.5 });
          if (!payload.processed._flown) flyToBuilding(payload.processed, c, layout, 0);
          break;
        }
        if (payload.stored) {
          // (Carrière) Mise en réserve au grenier : l'icône de la culture part vers le grenier.
          floatText(c.x, c.y - 10 * k, '→ grenier', '#fff3b0', { icon: false, life: 1.5 });
          const a = layout.investmentAnchor('storage', 1);
          const icon = `crop.${payload.cropId}.icon`;
          if (SPRITES[icon]) fly(icon, c.x - 8, c.y - 12, a.x - 8, a.y + 14, { life: 1.1, arc: 30 });
          break;
        }
        if (payload.diverted) {
          // (Carrière) Mise de côté pour un visiteur ou une quête.
          floatText(c.x, c.y - 10 * k, `→ ${payload.diverted.label || payload.divertLabel || 'commande'}`, '#fff3b0', { icon: false, life: 1.6 });
          break;
        }
        coins(c.x, c.y - 4 * k, 7 + (k - 1) * 3);
        if (payload.amount) floatText(c.x, c.y - 10 * k, `+${payload.amount}`, GOLD);
        break;
      }
      case 'processingStarted': {
        // Récolte : déjà traitée par « harvested » (processed). Lait : du pré à la fromagerie.
        if (payload.source === 'harvest' && payload.plotIndex !== undefined) break;
        const from = layout.investmentAnchor(payload.input === 'cow' ? 'cow' : 'goat', 1);
        flyToBuilding(payload, { x: from.x, y: from.y + 10 }, layout, 0.2 + (payload.placeIndex || 0) * 0.15);
        break;
      }
      case 'productSold': {
        const a = layout.investmentAnchor(payload.buildingId, 1);
        const d = 0.35 + (payload.placeIndex || 0) * 0.25;
        popIcon(productSprite(payload.productId), a.x, a.y + 10, d);
        if (payload.amount) floatText(a.x, a.y - 6, `+${payload.amount}`, GOLD, { delay: d + 0.15, icon: true });
        coins(a.x, a.y + 8, 3, d + 0.15);
        break;
      }
      case 'processingSoldRaw': {
        const a = layout.investmentAnchor(payload.buildingId, 1);
        if (payload.amount) floatText(a.x, a.y, `+${payload.amount}`, '#f3e9dc', { icon: true });
        coins(a.x, a.y + 8, Math.min(6, 2 + (payload.count || 1)));
        break;
      }
      case 'treeRemoved':
        // Le rendu (scene.js) connaît le sprite de l'arbre et appelle sinkTree().
        break;
      case 'contestProgress': {
        // Une seule fois par épreuve (l'événement repart à chaque changement de progression).
        if (!payload.done || contestDone.has(payload.goalId)) break;
        contestDone.add(payload.goalId);
        const f = layout.fieldRect;
        sparkle({ x: f.x, y: f.y, w: f.w, h: 16 }, 18, 'gold');
        floatText(f.x + f.w / 2, f.y + 6, 'Épreuve réussie !', '#fff3b0', { icon: false, life: 2.4 });
        break;
      }
      case 'contestAwarded': {
        const s = layout.sign || { x: layout.house.x, y: layout.house.y, w: 2 };
        const cx = (s.x + (s.w || 2) / 2) * TILE;
        const cy = s.y * TILE;
        confetti({ x: cx - 64, y: cy - 60, w: 128, h: 40 }, 60);
        if (payload.amount) {
          floatText(cx, cy - 8, `+${payload.amount}`, GOLD, { icon: true, life: 2.6 });
          coins(cx, cy, 10, 0.1);
        }
        break;
      }
      case 'watered': {
        const c = layout.plotCenter(payload.plotIndex);
        if (c) droplets(c.x, c.y + 2 * k, 10 * k, k);
        break;
      }
      case 'planted': {
        const c = layout.plotCenter(payload.plotIndex);
        if (c) dirt(c.x, c.y + 3 * k, 9 * k, k);
        break;
      }
      case 'plotUnlocked': {
        const r = layout.plotRect(payload.plotIndex);
        if (!r) return;
        dirt(r.x + r.w / 2, r.y + r.h * 0.62, 12 * k, k);
        sparkle(r, 10 * k);
        break;
      }
      case 'purchased': {
        const r = layout.investmentRect(payload.investmentId, payload.owned || 1);
        if (!r) return;
        sparkle(r, Math.min(48, 16 + Math.round((r.w * r.h) / 160)), 'gold', 0);
        sparkle({ x: r.x - 4, y: r.y - 6, w: r.w + 8, h: 8 }, 8, 'gold', 0.25);
        dirt(r.x + r.w / 2, r.y + r.h - 2, 14);
        break;
      }
      case 'dawn': {
        const incomes = payload.incomes || [];
        let i = 0;
        for (const inc of incomes) {
          if (!inc.amount) continue;
          if (inc.kind === 'processed') continue; // déjà montré par « productSold »
          const a = inc.kind === 'refund' && layout.house
            ? { x: (layout.house.x + layout.house.w / 2) * TILE, y: layout.house.y * TILE - 10 }
            : layout.investmentAnchor(inc.source, inc.owned || 1);
          const label = inc.kind === 'shearing' ? `+${inc.amount} tonte` : `+${inc.amount}`;
          floatText(a.x, a.y, label, GOLD, { delay: 0.35 + i * 0.3, icon: true });
          coins(a.x, a.y + 6, 3, 0.35 + i * 0.3);
          i++;
        }
        // Arroseurs automatiques : gouttes sur les parcelles arrosées ce matin.
        (payload.sprinkled || []).forEach((plotIndex, j) => {
          const c = layout.plotCenter(plotIndex);
          if (c) {
            for (let d = 0; d < 5 * k; d++) {
              particle('drop', c.x + rand(-7, 7) * k, c.y - rand(8, 14) * k, rand(-5, 5), rand(10, 30), 260, 0.8, d % 2 ? '#8fd0ff' : '#dff3ff', 0.1 + j * 0.04 + d * 0.03, c.y + rand(-3, 6) * k);
            }
          }
        });
        if (payload.charges > 0 && layout.house) {
          const h = layout.house;
          floatText((h.x + h.w / 2) * TILE, h.y * TILE - 2, `-${payload.charges}`, '#ff9a8a', { delay: 0.35 + i * 0.3, icon: true });
        }
        break;
      }
      case 'frost': {
        const lost = payload.lost || (payload.lostPlots || []).map((plotIndex) => ({ plotIndex, cropId: null }));
        lost.forEach((l, j) => {
          const r = layout.plotRect(l.plotIndex);
          if (!r) return;
          ghostCrop(r, l.cropId, 'frost', j * 0.05, k);
          sparkle(r, 6 * k, 'ice', j * 0.05);
        });
        break;
      }
      case 'rot': {
        const r = layout.plotRect(payload.plotIndex);
        if (!r) return;
        ghostCrop(r, payload.cropId, 'rot', 0, k);
        flies(r.x + r.w / 2, r.y + 4 * k);
        break;
      }
      // ── Mode Carrière (ces événements n'existent pas dans les niveaux) ──
      case 'collected': {
        const a = layout.investmentAnchor(payload.buildingId, 1);
        if (!payload.amount) break;
        coins(a.x, a.y + 6, Math.min(8, 3 + Math.round(payload.amount / 10)));
        floatText(a.x, a.y - 4, `+${payload.amount}`, GOLD, { icon: true });
        break;
      }
      case 'stockSold': {
        if (!payload.amount) break;
        const a = layout.investmentAnchor('storage', 1);
        coins(a.x, a.y + 10, Math.min(10, 3 + (payload.count || 1)));
        floatText(a.x, a.y - 2, `+${payload.amount}`, GOLD, { icon: true, life: 2.2 });
        break;
      }
      case 'truffleFound': {
        const a = layout.investmentAnchor('pig', 1);
        popIcon('product.truffle', a.x, a.y + 12);
        if (payload.amount) floatText(a.x, a.y - 6, `+${payload.amount}`, GOLD, { icon: true, delay: 0.3 });
        break;
      }
      case 'fishCaught': {
        const a = layout.investmentAnchor('duckPond', 1);
        const n = 1 + (Math.abs(String(payload.fishId || '').length) % 3);
        popIcon(SPRITES[`product.fish.${n}`] ? `product.fish.${n}` : 'product.fish.1', a.x, a.y + 30);
        droplets(a.x, a.y + 36, 12, 1);
        if (payload.amount) floatText(a.x, a.y + 10, `+${payload.amount}`, GOLD, { icon: true, delay: 0.3 });
        break;
      }
      case 'animalBorn': {
        const r = layout.investmentRect(payload.animalId, 99);
        if (!r) break;
        sparkle(r, 12, 'gold');
        floatText(r.x + r.w / 2, r.y + 8, `+${payload.count || 1}`, '#ffd6e8', { icon: false, life: 2 });
        break;
      }
      case 'rankUp': {
        const a = layout.investmentAnchor('house', 1);
        confetti({ x: a.x - 64, y: a.y - 50, w: 128, h: 40 }, 70);
        sparkle({ x: a.x - 40, y: a.y, w: 80, h: 40 }, 20, 'gold', 0.2);
        break;
      }
      case 'josephHeart': {
        const a = layout.investmentAnchor('house', 1);
        if (SPRITES['icon.career.heart']) popIcon('icon.career.heart', a.x + 30, a.y + 40, 0.6);
        break;
      }
      case 'crowChased': {
        const c = layout.plotCenter(payload.plotIndex);
        if (c) leafBurst(c.x, c.y, 4 * k, k);
        break;
      }
      case 'lotBought': {
        const r = layout.lotRect ? layout.lotRect(payload.lotId) : null;
        if (!r) break;
        dirt(r.x + r.w / 2, r.y + r.h / 2, 18, 2);
        leafBurst(r.x + r.w / 2, r.y + r.h / 2, 12, 2);
        if (payload.cost) floatText(r.x + r.w / 2, r.y + r.h / 2 - 10, `-${payload.cost}`, '#ff9a8a', { icon: true, life: 2.2 });
        break;
      }
      case 'machineWorked': {
        if (payload.kind !== 'water') break;
        (payload.plots || []).slice(0, 24).forEach((pl, j) => {
          const c = layout.plotCenter(typeof pl === 'number' ? pl : pl.index);
          if (!c) return;
          for (let d = 0; d < 3 * k; d++) {
            particle('drop', c.x + rand(-7, 7) * k, c.y - rand(8, 14) * k, rand(-5, 5), rand(10, 30), 260, 0.8, d % 2 ? '#8fd0ff' : '#dff3ff', 0.1 + j * 0.03 + d * 0.03, c.y + rand(-3, 6) * k);
          }
        });
        break;
      }
      default:
        break;
    }
  }

  // ── Météo (particules en coordonnées de la vue) ──────────────────────────────────
  function approach(cur, target, dt, speed = 0.8) {
    if (cur < target) return Math.min(target, cur + dt * speed);
    return Math.max(target, cur - dt * speed);
  }

  // Nombre voulu de particules, borné par la taille de la réserve : au-delà, spawn() recyclerait
  // chaque image des particules vivantes (pluie qui « saute », boucle coûteuse sur grand écran).
  function cap(pool, n) {
    return Math.min(pool.items.length, Math.round(n));
  }

  function countAlive(pool) {
    let n = 0;
    for (const p of pool.items) if (p.alive) n++;
    return n;
  }

  function updateWeather(dt) {
    const { season, weather, view } = env;
    const area = ((view.w * view.h) / (512 * 320)) * (reduced ? 0.5 : 1);
    const wantRain = weather === 'rain' ? 1 : weather === 'storm' ? 1.6 : 0;
    const wantSnow = season === 'winter' ? (weather === 'snow' ? 1 : 0.18) : 0;
    const wantLeaves = season === 'autumn' ? (weather === 'storm' || weather === 'rain' ? 0.6 : 1) : 0;
    const wantPetals = season === 'spring' && weather !== 'rain' && weather !== 'storm' ? 1 : 0;
    const wantClouds = weather === 'cloudy' ? 1 : weather === 'rain' || weather === 'storm' || weather === 'snow' ? 0.8 : 0.25;
    if (!primed) {
      // Première image (ou après clear) : la météo est déjà installée, sans montée progressive.
      intensity.rain = wantRain;
      intensity.snow = wantSnow;
      intensity.leaves = wantLeaves;
      intensity.petals = wantPetals;
      intensity.clouds = wantClouds;
    }
    intensity.rain = approach(intensity.rain, wantRain, dt, 0.7);
    intensity.snow = approach(intensity.snow, wantSnow, dt, 0.35);
    intensity.leaves = approach(intensity.leaves, wantLeaves, dt, 0.5);
    intensity.petals = approach(intensity.petals, wantPetals, dt, 0.5);
    intensity.clouds = approach(intensity.clouds, wantClouds, dt, 0.3);

    // Pluie
    const rainTarget = cap(rain, intensity.rain * 170 * area);
    let alive = countAlive(rain);
    const heavy = weather === 'storm';
    for (; alive < rainTarget; alive++) {
      const p = rain.spawn();
      p.x = rand(0, view.w + 60);
      p.y = rand(-30, view.h);
      p.vy = rand(210, 260) * (heavy ? 1.2 : 1);
      p.groundY = rand(Math.max(0, p.y + 8), view.h + 8);
      p.heavy = heavy;
    }
    let excess = alive - rainTarget;
    for (const p of rain.items) {
      if (!p.alive) continue;
      p.y += p.vy * dt;
      p.x -= p.vy * dt * (p.heavy ? 0.45 : 0.3);
      if (p.y >= p.groundY) {
        if (Math.random() < 0.5) {
          const s = splashes.spawn();
          s.x = Math.round(p.x) - 2;
          s.y = Math.round(p.groundY);
          s.t = 0;
        }
        if (excess > 0) {
          p.alive = false;
          excess--;
        } else {
          p.x = rand(0, view.w + 40);
          p.y = rand(-20, -4);
          p.groundY = rand(0, view.h);
          p.heavy = heavy;
        }
      }
    }
    for (const s of splashes.items) {
      if (!s.alive) continue;
      s.t += dt;
      if (s.t > 0.2) s.alive = false;
    }

    // Neige
    const snowTarget = cap(flakes, intensity.snow * 170 * area);
    alive = countAlive(flakes);
    for (; alive < snowTarget; alive++) {
      const p = flakes.spawn();
      p.x = rand(0, view.w);
      p.y = rand(-10, view.h);
      p.vy = rand(10, 22);
      p.phase = rand(0, 6.28);
      p.size = Math.random() < 0.25 ? 2 : 1;
      p.drift = rand(-4, 4);
    }
    excess = alive - snowTarget;
    for (const p of flakes.items) {
      if (!p.alive) continue;
      p.y += p.vy * dt;
      p.phase += dt * 1.6;
      p.x += (Math.sin(p.phase) * 8 + p.drift) * dt;
      if (p.y > view.h + 2) {
        if (excess > 0) { p.alive = false; excess--; } else { p.y = -2; p.x = rand(0, view.w); }
      }
    }

    // Feuilles d'automne
    const leafTarget = cap(leaves, intensity.leaves * 16 * area);
    alive = countAlive(leaves);
    for (; alive < leafTarget; alive++) {
      const p = leaves.spawn();
      p.x = rand(0, view.w);
      p.y = rand(-10, view.h);
      p.vy = rand(9, 16);
      p.vx = rand(4, 12);
      p.phase = rand(0, 6.28);
      p.color = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];
      p.shape = Math.floor(Math.random() * 3);
    }
    excess = alive - leafTarget;
    const wind = weather === 'storm' ? 3 : 1;
    for (const p of leaves.items) {
      if (!p.alive) continue;
      p.phase += dt * 2.2;
      p.y += p.vy * dt;
      p.x += (p.vx * wind + Math.sin(p.phase) * 14) * dt;
      if (p.y > view.h + 3 || p.x > view.w + 4) {
        if (excess > 0) { p.alive = false; excess--; } else { p.y = -3; p.x = rand(-20, view.w); }
      }
    }

    // Pétales de printemps
    const petalTarget = cap(petals, intensity.petals * 14 * area);
    alive = countAlive(petals);
    for (; alive < petalTarget; alive++) {
      const p = petals.spawn();
      p.x = rand(0, view.w);
      p.y = rand(-10, view.h);
      p.vy = rand(6, 11);
      p.vx = rand(3, 9);
      p.phase = rand(0, 6.28);
      p.color = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
    }
    excess = alive - petalTarget;
    for (const p of petals.items) {
      if (!p.alive) continue;
      p.phase += dt * 2.8;
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(p.phase) * 10) * dt;
      if (p.y > view.h + 2 || p.x > view.w + 2) {
        if (excess > 0) { p.alive = false; excess--; } else { p.y = -2; p.x = rand(-20, view.w); }
      }
    }

    // Papillons (printemps, été, beau temps, en journée)
    const bfTarget = (season === 'spring' || season === 'summer') && (weather === 'sunny' || weather === 'cloudy' || weather === 'heatwave') && env.dayProgress < 0.85 ? cap(butterflies, 4 * area) : 0;
    alive = countAlive(butterflies);
    for (; alive < bfTarget; alive++) {
      const p = butterflies.spawn();
      p.x = rand(0, view.w);
      p.y = rand(view.h * 0.2, view.h * 0.8);
      p.tx = p.x;
      p.ty = p.y;
      p.phase = rand(0, 6.28);
      p.t = 0;
      p.color = BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)];
    }
    excess = alive - bfTarget;
    for (const p of butterflies.items) {
      if (!p.alive) continue;
      if (excess > 0) { p.alive = false; excess--; continue; }
      p.t -= dt;
      if (p.t <= 0) {
        p.tx = Math.max(4, Math.min(view.w - 4, p.x + rand(-60, 60)));
        p.ty = Math.max(4, Math.min(view.h - 4, p.y + rand(-40, 40)));
        p.t = rand(1.5, 4);
      }
      p.phase += dt * 14;
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      p.x += dx * Math.min(1, dt * 0.8) + Math.sin(p.phase * 0.3) * dt * 6;
      p.y += dy * Math.min(1, dt * 0.8) + Math.sin(p.phase * 0.21) * dt * 10;
    }

    // Lucioles (fin de journée, été / fin de printemps, sans pluie)
    const ffTarget = (season === 'summer' || season === 'spring') && env.dayProgress > 0.78 && !(weather === 'rain' || weather === 'storm') ? cap(fireflies, 10 * area) : 0;
    alive = countAlive(fireflies);
    for (; alive < ffTarget; alive++) {
      const p = fireflies.spawn();
      p.x = rand(0, view.w);
      p.y = rand(view.h * 0.15, view.h * 0.9);
      p.phase = rand(0, 6.28);
      p.speed = rand(0.6, 1.4);
    }
    excess = alive - ffTarget;
    for (const p of fireflies.items) {
      if (!p.alive) continue;
      if (excess > 0) { p.alive = false; excess--; continue; }
      p.phase += dt * p.speed;
      p.x += Math.cos(p.phase * 1.3) * dt * 6;
      p.y += Math.sin(p.phase) * dt * 4;
    }

    // Ombres de nuages
    const cloudTarget = cap(clouds, intensity.clouds * 4 * area + 0.3);
    alive = countAlive(clouds);
    for (; alive < cloudTarget; alive++) {
      const p = clouds.spawn();
      p.x = alive === 0 && time < 0.1 ? rand(0, view.w) : rand(-view.w * 0.6, view.w);
      p.y = rand(-20, view.h - 20);
      p.vx = rand(4, 8);
      if (time > 0.1) p.x = -110 - rand(0, 80);
    }
    excess = alive - cloudTarget;
    for (const p of clouds.items) {
      if (!p.alive) continue;
      p.x += p.vx * dt * (weather === 'storm' ? 2.5 : 1);
      if (p.x > view.w + 10) {
        if (excess > 0) { p.alive = false; excess--; } else { p.x = -110; p.y = rand(-20, view.h - 20); }
      }
    }

    // Éclairs
    if (weather === 'storm') {
      nextFlash -= dt;
      if (nextFlash <= 0) {
        flash = 1;
        // Parfois un double éclair (jamais en mouvements réduits).
        nextFlash = !reduced && Math.random() < 0.3 ? 0.18 : rand(4, 9);
      }
    }
    flash = Math.max(0, flash - dt * (reduced ? 1.5 : 4)); // réduit : s'estompe lentement, sans à-coup
    primed = true;
  }

  function updateParts(dt) {
    for (const p of parts.items) {
      if (!p.alive) continue;
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.t += dt;
      if (p.t >= p.life) { p.alive = false; continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > p.floor && p.vy > 0) {
        p.y = p.floor;
        if (p.kind === 'coin') { p.vy *= -0.35; p.vx *= 0.6; } else { p.vy = 0; p.vx *= 0.5; }
      }
      if (p.kind === 'fly') {
        p.x += Math.cos(p.t * 9 + p.frame) * 0.6;
        p.y += Math.sin(p.t * 11 + p.frame * 2) * 0.5;
      }
    }
    for (const p of texts.items) {
      if (!p.alive) continue;
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.t += dt;
      if (p.t >= p.life) p.alive = false;
    }
    for (const g of ghosts.items) {
      if (!g.alive) continue;
      if (g.delay > 0) { g.delay -= dt; continue; }
      g.t += dt;
      if (g.t >= g.life) g.alive = false;
    }
    for (const f of flyers.items) {
      if (!f.alive) continue;
      if (f.delay > 0) { f.delay -= dt; continue; }
      f.t += dt;
      if (f.t >= f.life) f.alive = false;
    }
  }

  /**
   * Avance les effets. `state` = { season, weather, dayProgress, view: {x, y, w, h} }.
   */
  function update(dt, state) {
    if (state) {
      env.season = state.season || env.season;
      env.weather = state.weather || env.weather;
      env.dayProgress = state.dayProgress ?? env.dayProgress;
      if (state.view) env.view = state.view;
    }
    time += dt;
    updateWeather(dt);
    updateParts(dt);
  }

  // ── Dessin ──────────────────────────────────────────────────────────────────────
  /** Sous les objets (contexte translaté en coordonnées du monde) : cultures mortes, ombres. */
  function drawGround(ctx, sheets) {
    for (const g of ghosts.items) {
      if (!g.alive || g.delay > 0) continue;
      const fade = g.t < g.life - 1 ? 1 : Math.max(0, g.life - g.t);
      ctx.globalAlpha = fade;
      const k = g.scale || 1;
      if (g.kind === 'sink') {
        // L'arbre descend sous la ligne du sol : on découpe tout ce qui passe sous la parcelle.
        const u = Math.min(1, g.t / g.life);
        const depth = Math.round(u * u * g.h);
        const shake = !reduced && g.t < 0.25 ? (Math.floor(g.t * 40) % 2 ? k : -k) : 0;
        ctx.globalAlpha = u > 0.8 ? (1 - u) / 0.2 : 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(g.x - 4 * k, g.y - g.h, g.h + 8 * k, g.h * 2 - 2 * k);
        ctx.clip();
        drawSprite(ctx, g.set || sheets, g.sprite, g.x + shake, g.y - 2 * k + depth, k === 1 ? undefined : { scale: k });
        ctx.restore();
        continue;
      }
      let dy = 0;
      if (g.kind === 'rot' && g.t > 0.4) dy = Math.min(2, Math.floor((g.t - 0.4) * 2));
      drawSprite(ctx, sheets, g.sprite, g.x, g.y + (-2 + dy) * k, k === 1 ? undefined : { scale: k });
      if (g.kind === 'frost') {
        // givre : petits cristaux sur la plante
        ctx.fillStyle = '#e8f6ff';
        ctx.fillRect(g.x + 5 * k, g.y + 1 * k, k, k);
        ctx.fillRect(g.x + 10 * k, g.y + 4 * k, k, k);
        ctx.fillRect(g.x + 7 * k, g.y + 7 * k, k, k);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Particules du monde (contexte translaté) : pièces, gouttes, poussière, étincelles. */
  function drawWorld(ctx) {
    for (const p of parts.items) {
      if (!p.alive || p.delay > 0) continue;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const k = p.t / p.life;
      switch (p.kind) {
        case 'coin': {
          ctx.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
          const frame = Math.floor(p.t * 10 + p.frame) % 2;
          ctx.drawImage(S.coin[frame], x - 2, y - 2);
          break;
        }
        case 'drop':
          ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, 1, p.vy > 5 ? 2 : 1);
          break;
        case 'dust':
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, k < 0.5 ? 2 : 1, k < 0.5 ? 2 : 1);
          break;
        case 'leaf':
          ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, 2, 1);
          ctx.fillRect(x + 1, y + 1, 1, 1);
          break;
        case 'spark':
        case 'ice': {
          const frames = p.kind === 'ice' ? S.ice : S.sparkle;
          const f = k < 0.25 ? 0 : k < 0.5 ? 1 : k < 0.75 ? 2 : 1;
          ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
          ctx.drawImage(frames[f], x - 2, y - 2);
          break;
        }
        case 'confetti': {
          ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
          ctx.fillStyle = p.color;
          const flip = reduced ? p.frame % 2 === 0 : Math.sin(p.t * 14 + p.frame * 2) > 0;
          ctx.fillRect(x, y, flip ? 2 : 1, flip ? 1 : 2);
          if (p.vy > 0) p.vx *= 0.98;
          break;
        }
        case 'fly':
          ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(x + Math.round(Math.cos(p.t * 5 + p.frame) * 5), y + Math.round(Math.sin(p.t * 7 + p.frame) * 3), 1, 1);
          break;
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
    for (const f of flyers.items) {
      if (!f.alive || f.delay > 0) continue;
      const u = f.t / f.life;
      let x;
      let y;
      if (f.kind === 'pop') {
        const e = 1 - (1 - Math.min(1, u * 1.8)) ** 3;
        x = f.x0;
        y = f.y0 + (f.y1 - f.y0) * e;
        ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
      } else {
        const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) ** 2;
        x = f.x0 + (f.x1 - f.x0) * e;
        y = f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * u) * (reduced ? f.arc * 0.3 : f.arc);
        ctx.globalAlpha = u > 0.9 ? (1 - u) / 0.1 : 1;
      }
      drawSprite(ctx, images, f.sprite, Math.round(x), Math.round(y));
    }
    ctx.globalAlpha = 1;
  }

  /** Météo (contexte non translaté, coordonnées de la vue). */
  function drawWeather(ctx) {
    const { view } = env;
    // Ombres des nuages
    if (intensity.clouds > 0.01) {
      ctx.globalAlpha = 0.1 * Math.min(1, intensity.clouds + 0.2);
      for (const c of clouds.items) {
        if (c.alive) ctx.drawImage(S.cloud, Math.round(c.x), Math.round(c.y));
      }
      ctx.globalAlpha = 1;
    }
    // Pétales
    for (const p of petals.items) {
      if (!p.alive) continue;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.sin(p.phase) > 0 ? 2 : 1, 1);
    }
    // Feuilles
    for (const p of leaves.items) {
      if (!p.alive) continue;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      ctx.fillStyle = p.color;
      const flip = Math.sin(p.phase) > 0;
      if (p.shape === 0) { ctx.fillRect(x, y, 2, 1); ctx.fillRect(flip ? x + 1 : x, y + 1, 2, 1); } else if (p.shape === 1) { ctx.fillRect(x, y, 1, 2); ctx.fillRect(x + 1, flip ? y : y + 1, 1, 1); } else { ctx.fillRect(x, y, 2, 2); }
    }
    // Papillons
    for (const p of butterflies.items) {
      if (!p.alive) continue;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const open = Math.sin(p.phase) > 0;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x, y, 1, 2);
      ctx.fillStyle = p.color;
      if (open) { ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); } else { ctx.fillRect(x - 1, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1, 1, 2); }
    }
    // Lucioles
    for (const p of fireflies.items) {
      if (!p.alive) continue;
      const glow = 0.5 + 0.5 * Math.sin(p.phase * 3);
      if (glow < 0.25) continue;
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      ctx.globalAlpha = glow * 0.35;
      ctx.fillStyle = '#ffe27a';
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1);
      ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3);
    }
    ctx.globalAlpha = 1;
    // Pluie
    for (const s of splashes.items) {
      if (!s.alive) continue;
      ctx.drawImage(S.splash[s.t < 0.1 ? 0 : 1], s.x, s.y);
    }
    for (const p of rain.items) {
      if (!p.alive) continue;
      ctx.drawImage(p.heavy ? S.rainHeavy : S.rain, Math.round(p.x), Math.round(p.y));
    }
    // Neige
    ctx.fillStyle = '#ffffff';
    for (const p of flakes.items) {
      if (!p.alive) continue;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    void view;
  }

  /** Lumière du jour + étalonnage saison/météo + éclair (sur toute la vue). */
  function drawLight(ctx, w, h) {
    const sg = SEASON_GRADE[env.season] || SEASON_GRADE.spring;
    const wg = WEATHER_GRADE[env.weather] || WEATHER_GRADE.sunny;
    dayGrade(env.dayProgress, dayTmp);
    for (let k = 0; k < 3; k++) grade[k] = sg[k] * wg[k] * dayTmp[k];
    if (grade[0] < 0.995 || grade[1] < 0.995 || grade[2] < 0.995) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${Math.round(grade[0] * 255)},${Math.round(grade[1] * 255)},${Math.round(grade[2] * 255)})`;
      ctx.fillRect(0, 0, w, h);
    }
    // Lueur chaude (aube, soir, canicule) : 'soft-light' garde les contours.
    let glow = 0;
    const p = env.dayProgress;
    if (p < 0.18) glow = (1 - p / 0.18) * 0.18;
    if (p > 0.72) glow = ((p - 0.72) / 0.28) * 0.22;
    if (env.weather === 'heatwave') glow += 0.12;
    if (glow > 0.005) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = glow;
      ctx.fillStyle = p < 0.5 ? '#ff9ec0' : '#ffb060';
      if (env.weather === 'heatwave' && p >= 0.18 && p <= 0.72) ctx.fillStyle = '#ffd070';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    // Printemps : léger voile frais ; hiver : voile bleuté lumineux.
    if (env.season === 'spring' || env.season === 'winter') {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = env.season === 'spring' ? 0.08 : 0.1;
      ctx.fillStyle = env.season === 'spring' ? '#c8ffb0' : '#d0e4ff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    if (flash > 0.01) {
      if (reduced) {
        // Éclair « doux » : un léger voile sombre qui s'estompe (aucun blanc plein écran).
        ctx.globalAlpha = Math.min(1, flash) * 0.14;
        ctx.fillStyle = '#1c1830';
      } else {
        ctx.globalAlpha = flash * 0.55;
        ctx.fillStyle = '#ffffff';
      }
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Brume de chaleur (canicule) : décale de ±1 px des bandes horizontales du tampon.
   * @param ctx      contexte du tampon de vue
   * @param canvas   le tampon lui-même
   * @param scratch  canvas de travail de même taille
   */
  function postProcess(ctx, canvas, scratch) {
    if (env.weather !== 'heatwave' || reduced) return;
    const w = canvas.width;
    const h = canvas.height;
    const sctx = scratch.getContext('2d');
    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(canvas, 0, 0);
    const band = 3;
    for (let y = 0; y < h; y += band) {
      const s = Math.sin(y * 0.21 - time * 3.2) + Math.sin(y * 0.047 + time * 1.1) * 0.6;
      const off = s > 1.05 ? 1 : s < -1.05 ? -1 : 0;
      if (off !== 0) ctx.drawImage(scratch, 0, y, w, band, off, y, w, band);
    }
  }

  /**
   * Textes flottants, dessinés sur le canvas final (écran) pour rester nets.
   * @param toScreen  (wx, wy, out) → remplit out.x/out.y en pixels écran
   * @param zoom      zoom entier courant
   * @param dpr       densité de pixels (px réels par px CSS) : le texte fait au moins 18 px CSS
   */
  const tmpPt = { x: 0, y: 0 };
  function drawScreen(ctx, toScreen, zoom, sheets, dpr = 1) {
    let any = false;
    for (const p of texts.items) if (p.alive && p.delay <= 0) { any = true; break; }
    if (!any) return;
    const size = Math.max(Math.round(18 * dpr), Math.round(zoom * 8));
    ctx.font = `700 ${size}px "Ferme", "Trebuchet MS", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    const iconScale = Math.max(1, Math.round(size / 8) - 1);
    for (const p of texts.items) {
      if (!p.alive || p.delay > 0) continue;
      const k = p.t / p.life;
      const rise = (1 - (1 - Math.min(1, k * 1.6)) ** 3) * (reduced ? 3 : 14); // monte vite puis ralentit
      toScreen(p.x, p.y - rise, tmpPt);
      const alpha = k < 0.1 ? k / 0.1 : k > 0.7 ? (1 - k) / 0.3 : 1;
      const tw = Math.ceil(ctx.measureText(p.text).width);
      const iw = p.icon ? 10 * iconScale : 0;
      const total = tw + iw;
      // Centré sur son point d'ancrage, mais jamais coupé par un bord de l'écran.
      const x = Math.round(Math.max(size * 0.3, Math.min(ctx.canvas.width - total - size * 0.3, tmpPt.x - total / 2)));
      const y = Math.round(tmpPt.y);
      ctx.globalAlpha = alpha;
      if (p.icon && sheets) {
        // La pièce du pack occupe environ le centre 8 × 10 de sa tuile.
        drawSprite(ctx, sheets, p.sprite || 'coin', x - 4 * iconScale, y - 8 * iconScale, { scale: iconScale });
      }
      ctx.lineWidth = Math.max(3, Math.round(size / 7));
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText(p.text, x + iw, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x + iw, y);
    }
    ctx.globalAlpha = 1;
  }

  /** (Carrière) Le monde a grandi : décale tout ce qui est en coordonnées du monde. */
  function shift(dx, dy) {
    if (!dx && !dy) return;
    for (const p of parts.items) if (p.alive) { p.x += dx; p.y += dy; p.floor += dy; }
    for (const p of texts.items) if (p.alive) { p.x += dx; p.y += dy; }
    for (const g of ghosts.items) if (g.alive) { g.x += dx; g.y += dy; }
    for (const f of flyers.items) if (f.alive) { f.x0 += dx; f.x1 += dx; f.y0 += dy; f.y1 += dy; }
  }

  function clear() {
    for (const pool of [rain, splashes, flakes, leaves, petals, butterflies, fireflies, parts, texts, ghosts, clouds, flyers]) pool.clear();
    flash = 0;
    primed = false;
    contestDone.clear();
  }

  return {
    /** Mouvements réduits (voir plus haut). */
    setReducedMotion(on) {
      reduced = !!on;
      if (reduced) flash = Math.min(flash, 0.5);
    },
    get reducedMotion() {
      return reduced;
    },
    onEvent,
    floatText,
    fly,
    popIcon,
    confetti,
    sinkTree,
    coins,
    droplets,
    dirt,
    sparkle,
    update,
    drawGround,
    drawWorld,
    drawWeather,
    drawLight,
    postProcess,
    drawScreen,
    clear,
    shift,
    get env() {
      return env;
    },
    /** Particules vivantes par réserve (débogage, mesures de performance). */
    stats() {
      const out = {};
      for (const [k, pool] of Object.entries({ rain, splashes, flakes, leaves, petals, butterflies, fireflies, parts, texts, ghosts, clouds, flyers })) {
        out[k] = countAlive(pool);
      }
      return out;
    },
    /** Émet quelques gouttes (arroseurs automatiques). */
    spray(wx, wy) {
      particle('drop', wx + rand(-5, 5), wy - rand(4, 8), rand(-18, 18), rand(-30, -14), 160, 0.7, Math.random() < 0.5 ? '#8fd0ff' : '#dff3ff', 0, wy + rand(2, 8));
    },
    /** Bouffée de fumée de cheminée. */
    smoke(wx, wy) {
      particle('smoke', wx, wy, rand(2, 5), rand(-9, -6), -1, rand(2.2, 3), '', 0);
    },
    /** Fumées (dessinées avec les bâtiments). */
    drawSmoke(ctx) {
      for (const p of parts.items) {
        if (!p.alive || p.kind !== 'smoke' || p.delay > 0) continue;
        const k = p.t / p.life;
        ctx.globalAlpha = (1 - k) * 0.75;
        ctx.fillStyle = k < 0.3 ? '#f4f0f6' : '#d9d3df';
        const s = k < 0.25 ? 2 : k < 0.6 ? 3 : 4;
        ctx.fillRect(Math.round(p.x + Math.sin(p.t * 2 + p.frame) * 1.5), Math.round(p.y), s, s - 1);
      }
      ctx.globalAlpha = 1;
    },
  };
}
