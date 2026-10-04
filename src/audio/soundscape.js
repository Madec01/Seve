// Paysage sonore de la Vallée vivante (lot V4 « Les cigognes ») : PUR (ni DOM, ni horloge, ni Math.random).
// Conception : docs/VALLEE.md § 18.8 ; contrat : docs/ARCHITECTURE.md, « Plan audio technique (paquet AUDIO) ».
//
//   natureScape(facts, ctx)   faits du jeu (CORE : query.career.valleySounds()) → ce que la vallée fait entendre
//   farmBirdsFactor(facts)    facteur de la couche « birds » existante selon l'étape (× 0,25 → × 1)
//   phaseOf(dayProgress)      'dawn' | 'day' | 'dusk'
//   spatial(src, listener)    gain et panoramique d'un son placé dans la vue de la vallée
//   NATURE_SOURCES            les sons (couches continues et chants) : recette, saisons, phases, lieux
//
// Le moteur qui joue le paysage est src/audio/nature.js ; il ne décide de rien : tout se décide ici.
//
// soundFacts (CORE, une fois par jour) :
//   { on, stage: 0..8, installed: [speciesId], seen: [visitorId],
//     places: { brook, combe, poppies, millpond, bocage, oldOrchard },   // étape de chaque lieu (0 = rien)
//     farm: { pond, frogs, wildGrass, fallows, strips, hives, nest: 'pair' | 'chicks' | null },
//     flyover: null | 'storks' | 'cranes', complete }
// ctx : { where: 'farm' | 'view', season, weather, dayProgress (0..1), detail: 'full' | 'light' | 'off',
//         afterRain? (le jour qui suit une pluie), spots? ({ steeple: { x, y }, … } : places des visiteurs dans la vue) }

/** Facteur de la couche « birds » (fichier existant) selon l'étape de la vallée : elle « s'est tue » à l'étape 0. */
export const BIRDS_BY_STAGE = Object.freeze([0.25, 0.4, 0.55, 0.7, 0.85, 1, 1, 1, 1]);

/** Plafond de la somme des fréquences de chants (phrases par minute) : jamais une volière. */
export const RATE_CAP = Object.freeze({ farm: 12, view: 16 });
/** Voix ponctuelles de nature au plus en même temps (réglage « Complets » / « Légers »). */
export const MAX_VOICES = Object.freeze({ full: 12, light: 4 });
/** Écart minimal entre deux phrases du même chant (secondes). */
export const SAME_SONG_GAP = 4;

const ALL = Object.freeze({ spring: 1, summer: 1, autumn: 1, winter: 1 });
const P = (dawn, day, dusk) => Object.freeze({ dawn, day, dusk });

/**
 * Les sons de la vallée. Couches (`kind: 'layer'`) : niveau 0..1 décidé par natureScape ; chants (`kind: 'song'`) :
 * `rate` = phrases par minute de base, × saison × phase du jour.
 *   who      'installed' (habitant installé) | 'seen' (visiteur vu) | 'stage' (étape ≥ minStage) | 'layer'
 *   seasons  { saison: facteur } (absent = muet cette saison)
 *   phases   facteurs par phase du jour (aube, journée, soir)
 *   farm     s'entend à la ferme ; view : position dans la vue (px du monde 192 × 432), `spot` : place d'un visiteur
 *   snow     s'entend encore par temps de neige
 *   recipe   ce que fait la synthèse (src/audio/nature.js), pour la page de débogage et les relecteurs
 */
export const NATURE_SOURCES = Object.freeze({
  // ── Couches continues ─────────────────────────────────────────────────────────
  brook: {
    kind: 'layer', name: 'Murmure du ruisseau', seasons: ALL, snow: true,
    view: { x: 40, y0: 120, y1: 420 }, farm: true,
    recipe: 'bruit rose → passe-bande 900 Hz (Q 0,6) balayé ± 300 Hz par un LFO de 0,13 Hz ; gouttes : sinus 1,4–3 kHz de 25 ms glissés de + 30 %, 2 à 6 par seconde ; hiver : passe-bas 700 Hz, gouttes ÷ 3 ; ferme : lointain, passe-bas 900 Hz',
  },
  mill: {
    kind: 'layer', name: 'Roue du moulin', seasons: { spring: 1, summer: 1, autumn: 1 },
    view: { x: 96, y: 190 }, farm: false,
    recipe: 'grincement : dent de scie 85 Hz → passe-bande 420 Hz (Q 4), enveloppe de 0,45 s toutes les 2,4 s ; 3 éclaboussures (bruit passe-bande 2,2 kHz, 80 ms) par tour',
  },
  leaves: {
    kind: 'layer', name: 'Vent dans les feuilles', seasons: { spring: 1, summer: 1, autumn: 1 },
    view: { x: 48, y: 90 }, farm: true,
    recipe: 'bruit rose → passe-haut 1,2 kHz → passe-bas 5 kHz ; gain balancé par deux LFO (0,07 et 0,19 Hz) : des rafales',
  },
  crickets: {
    kind: 'layer', name: 'Grillons et sauterelles', seasons: { spring: 0.5, summer: 1 },
    phases: P(0.3, 1, 1), view: { x: 152, y: 196 }, farm: true,
    recipe: 'deux voix : sinus 4,2 et 5,1 kHz, battus par un carré de 28 Hz, en trains de 0,3 s (silences de 0,2 à 1 s)',
  },
  frogs: {
    kind: 'layer', name: 'Grenouilles', seasons: { spring: 1, summer: 1 },
    phases: P(0.6, 1, 2), view: { x: 48, y: 192 }, farm: true,
    recipe: 'croassement : sinus 380 Hz + 760 Hz (× 0,3), 4 à 6 pulsations de 15 ms espacées de 30 ms ; 0,5 à 2 croassements par seconde × niveau',
  },

  // ── Chants des habitants installés ────────────────────────────────────────────
  robin: {
    kind: 'song', who: 'installed', name: 'Rouge-gorge', rate: 1.5, seasons: ALL, phases: P(2, 1, 1.5),
    farm: true, view: { x: 112, y: 296 }, snow: true,
    recipe: 'cascade de 6 à 10 notes de 40 à 90 ms entre 2,5 et 6 kHz, qui descend, petits glissés (sinus)',
  },
  blackbird: {
    kind: 'song', who: 'installed', name: 'Merle noir', rate: 1, seasons: { winter: 0.4, spring: 1, summer: 1 },
    phases: P(2, 0.6, 2), farm: true, view: { x: 64, y: 304 },
    recipe: '5 à 7 notes flûtées de 120 à 250 ms entre 1,5 et 2,8 kHz, sinus + vibrato de 6 Hz (± 20 Hz), fin en petit gazouillis',
  },
  swallow: {
    kind: 'song', who: 'installed', name: 'Hirondelles', rate: 2, seasons: { spring: 1, summer: 1 },
    phases: P(0.6, 1, 0.5), farm: true, view: { x: 48, y: 192, need: ['millpond', 1] },
    recipe: 'série de 6 à 12 « tchirps » de 30 ms entre 3 et 6 kHz, glissés montants',
  },
  tawnyOwl: {
    kind: 'song', who: 'installed', name: 'Chouette hulotte', rate: 0.5, seasons: ALL, phases: P(0.3, 0, 2),
    farm: true, view: { x: 96, y: 262 }, snow: true,
    recipe: '« hou » (sinus 420 → 380 Hz, 0,5 s), silence de 1,2 s, puis « hou-hou-houuu » (3 notes, vibrato 5 Hz, la dernière d\'une seconde)',
  },
  jay: {
    kind: 'song', who: 'installed', name: 'Geai des chênes', rate: 0.4, seasons: { autumn: 1 }, phases: P(0.7, 1, 0.4),
    farm: true, view: { x: 128, y: 276 },
    recipe: 'cri rauque : bruit → passe-bande 1,8 kHz (Q 3) battu à 40 Hz, 0,3 s',
  },
  littleOwl: {
    kind: 'song', who: 'installed', name: 'Chouette chevêche', rate: 0.6, seasons: ALL, phases: P(0.3, 0, 2),
    farm: false, view: { x: 96, y: 340 }, snow: true,
    recipe: '« kiou » : sinus 1,6 → 1,1 kHz, 0,3 s, une à trois fois',
  },
  blackWoodpecker: {
    kind: 'song', who: 'installed', name: 'Pic noir', rate: 0.4, seasons: { winter: 0.5, spring: 1 }, phases: P(1.5, 0.8, 0.2),
    farm: false, view: { x: 40, y: 80 },
    recipe: 'tambour : 15 à 20 coups secs (bruit passe-bande 800 Hz, 3 ms) à 18 par seconde, de plus en plus doux',
  },
  skylark: {
    kind: 'song', who: 'installed', name: 'Alouette des champs', rate: 0.6, seasons: { spring: 1, summer: 1 }, phases: P(2, 1, 0.2),
    farm: false, view: { x: 152, y: 170 },
    recipe: 'trille de 8 à 15 s : notes de 30 à 60 ms entre 3 et 5 kHz, la hauteur monte lentement, le volume baisse (elle s\'éloigne)',
  },
  hoopoe: {
    kind: 'song', who: 'installed', name: 'Huppe fasciée', rate: 0.6, seasons: { summer: 1 }, phases: P(0.6, 1, 0.3),
    farm: false, view: { x: 152, y: 196 },
    recipe: '« oup-oup-oup » : trois sinus doux de 500 Hz, 80 ms, espacés de 120 ms',
  },
  kingfisher: {
    kind: 'song', who: 'installed', name: 'Martin-pêcheur', rate: 0.5, seasons: ALL, phases: P(0.8, 1, 0.5),
    farm: false, view: { x: 40, y: 260 },
    recipe: '« tiii » : sinus 3,5 kHz, 0,15 s, deux fois',
  },
  heron: {
    kind: 'song', who: 'installed', name: 'Héron cendré', rate: 0.15, seasons: ALL, phases: P(1, 1, 1),
    farm: false, view: { x: 48, y: 192 },
    recipe: '« fraank » : dent de scie 300 Hz → passe-bande 900 Hz, 0,4 s, grave et rare',
  },
  cuckoo: {
    kind: 'song', who: 'stage', minStage: 5, name: 'Coucou', rate: 0.3, seasons: { spring: 1 }, phases: P(2, 0.7, 0.2),
    farm: true, view: { x: 40, y: 60 },
    recipe: '« cou-cou » : sinus 650 puis 545 Hz (tierce mineure), 2 × 0,25 s, au loin',
  },

  // ── Chants des visiteurs vus ──────────────────────────────────────────────────
  whiteStork: {
    kind: 'song', who: 'seen', name: 'Cigognes', rate: 0.5, seasons: { spring: 1, summer: 1 }, phases: P(0.5, 1, 0.3),
    farm: true, view: { spot: 'steeple', x: 168, y: 40 },
    recipe: 'claquement de bec : clics de bruit passe-bande 1,5 kHz (4 ms) qui accélèrent de 8 à 14 par seconde puis ralentissent, 1,5 s',
  },
  crane: {
    kind: 'song', who: 'seen', name: 'Grues cendrées', rate: 0.4, seasons: { autumn: 1 }, phases: P(0.8, 1, 0.6),
    farm: true, view: { spot: 'crane', x: 152, y: 196 },
    recipe: 'trompettes : deux voix en dent de scie 560 et 590 Hz → passe-bande 1,1 kHz, vibrato 7 Hz, 0,5 s, en chœur décalé',
  },
  oriole: {
    kind: 'song', who: 'seen', name: 'Loriot d\'Europe', rate: 0.6, seasons: { summer: 1 }, phases: P(1.5, 0.8, 0.2),
    farm: true, view: { spot: 'oriole', x: 152, y: 96 },
    recipe: '« dudeli-o » : 4 notes sinus entre 1,2 et 2 kHz, 90 à 180 ms, glissés doux',
  },
  redDeer: {
    kind: 'song', who: 'seen', name: 'Brame du cerf', rate: 0.3, seasons: { autumn: 1 }, phases: P(0.5, 0.1, 2),
    farm: true, view: { spot: 'redDeer', x: 40, y: 90 },
    recipe: 'brame : dent de scie glissée de 140 à 90 Hz → passe-bas 600 Hz, 1,2 s, lointain',
  },
  beaver: {
    kind: 'song', who: 'seen', name: 'Castor', rate: 0.15, seasons: { spring: 1, summer: 1, autumn: 1 }, phases: P(0.3, 0.2, 2),
    farm: false, view: { spot: 'beaver', x: 50, y: 300 },
    recipe: '« plouf » de queue : bruit passe-bas 600 Hz + sinus 120 Hz, 0,2 s',
  },
});

export const LAYER_IDS = Object.freeze(Object.keys(NATURE_SOURCES).filter((id) => NATURE_SOURCES[id].kind === 'layer'));
export const SONG_IDS = Object.freeze(Object.keys(NATURE_SOURCES).filter((id) => NATURE_SOURCES[id].kind === 'song'));

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v) => (Number.isFinite(v) ? v : 0);

/** Phase du jour d'après l'avancée de la journée (0..1) : aube (premier quart), journée, soir (dernier quart). */
export function phaseOf(dayProgress) {
  const p = Number.isFinite(dayProgress) ? dayProgress : 0.5; // inconnu : la journée
  if (p < 0.25) return 'dawn';
  if (p >= 0.75) return 'dusk';
  return 'day';
}

/** Facteur de la couche « birds » existante (carrière avec la Vallée) : BIRDS_BY_STAGE[étape]. */
export function farmBirdsFactor(facts) {
  if (!facts || !facts.on) return 1;
  const s = clamp(Math.floor(num(facts.stage)), 0, BIRDS_BY_STAGE.length - 1);
  return BIRDS_BY_STAGE[s];
}

/**
 * Son placé dans la vue (px du monde) → { gain, pan } pour une écoute centrée en `listener.y`.
 * Plus fort quand le lieu est au milieu de l'écran, jamais à zéro (on entend toute la vallée, de loin) ;
 * panoramique doux (gauche : ruisseau ; droite : verger, prairie). Un ruban (y0..y1) compte au point le plus proche.
 */
export function spatial(src = {}, listener = {}) {
  const ly = num(listener.y);
  let sy = num(src.y);
  if (Number.isFinite(src.y0) && Number.isFinite(src.y1)) sy = clamp(ly, Math.min(src.y0, src.y1), Math.max(src.y0, src.y1));
  const dy = Math.abs(sy - ly);
  const gain = clamp(1 - dy / 220, 0.15, 1);
  const pan = clamp(((num(src.x) - 96) / 96) * 0.6, -0.6, 0.6);
  return { gain, pan };
}

const EMPTY_LAYERS = () => ({ brook: 0, mill: 0, leaves: 0, crickets: 0, frogs: 0 });

function silent(where, birdsFactor, detail) {
  return {
    on: false, where, detail, layers: EMPTY_LAYERS(), birds: [], birdsFactor, echo: false, maxVoices: 0,
    brook: null, phase: 'day',
  };
}

const has = (list, id) => Array.isArray(list) && list.includes(id);

/** Où le son s'entend-il à cet endroit (ferme ou vue) ? Renvoie la position dans la vue, true (ferme) ou null. */
function songPlace(id, src, facts, where, spots) {
  const places = facts.places || {};
  const farm = facts.farm || {};
  if (where === 'farm') {
    if (!src.farm) return null;
    if (id === 'whiteStork') return farm.nest || facts.flyover === 'storks' ? true : null;
    if (id === 'crane') return facts.flyover === 'cranes' ? true : null;
    return true;
  }
  const v = src.view;
  if (!v) return null;
  if (v.need && num(places[v.need[0]]) < v.need[1]) return null;
  const spot = v.spot && spots && spots[v.spot];
  if (spot && Number.isFinite(spot.x) && Number.isFinite(spot.y)) return { x: spot.x, y: spot.y };
  return { x: v.x, y: v.y };
}

/**
 * Ce que la vallée fait entendre ici et maintenant.
 * @returns {{ on, where, detail, phase, layers: { brook, mill, leaves, crickets, frogs }, birds: [{ id, rate, x?, y? }],
 *   birdsFactor, echo, maxVoices, brook: null | 'open' | 'frozen' | 'far' }}
 *   layers : niveaux 0..1 ; birds : chants possibles (phrases par minute, déjà multipliées par la saison, la phase, la
 *   météo, puis plafonnées) ; birdsFactor : × la couche « birds » existante ; brook : couleur du ruisseau.
 */
export function natureScape(facts, ctx = {}) {
  const where = ctx.where === 'view' ? 'view' : 'farm';
  const detail = ctx.detail === 'light' || ctx.detail === 'off' ? ctx.detail : 'full';
  if (!facts || !facts.on) return silent(where, 1, detail);
  // « Coupés » : l'ancien comportement exact (fichier « birds » seul, sans le facteur d'étape).
  if (detail === 'off') return silent(where, 1, detail);

  const season = ['spring', 'summer', 'autumn', 'winter'].includes(ctx.season) ? ctx.season : 'spring';
  const weather = ctx.weather || 'sunny';
  const rainy = weather === 'rain' || weather === 'storm';
  const snowy = weather === 'snow';
  const phase = phaseOf(ctx.dayProgress);
  const stage = clamp(Math.floor(num(facts.stage)), 0, 8);
  const places = facts.places || {};
  const farm = facts.farm || {};
  const layers = EMPTY_LAYERS();
  const winter = season === 'winter';

  // ── Couches ──
  let brookTone = null;
  if (where === 'view') {
    const ru = num(places.brook);
    if (ru >= 1) layers.brook = ru >= 3 ? 0.8 : ru >= 2 ? 0.6 : 0.3;
    if (ru >= 4 && !winter) layers.mill = 0.4;
    if (num(places.combe) >= 2 && !winter) layers.leaves = 0.25;
    const pop = num(places.poppies);
    if (pop >= 1) layers.crickets = Math.min(0.3, 0.2 + 0.05 * (pop - 1));
    if (num(places.millpond) >= 1) layers.frogs = 0.3;
    if (layers.brook) brookTone = winter ? 'frozen' : 'open';
  } else {
    if (stage >= 6) {
      layers.brook = 0.15;
      brookTone = 'far';
    }
    if (stage >= 5 && !winter) layers.leaves = 0.25;
    const wild = num(farm.wildGrass) + num(farm.fallows) + num(farm.strips);
    if (wild > 0) layers.crickets = Math.min(0.35, 0.2 + 0.03 * (wild - 1));
    if (farm.frogs) layers.frogs = 0.3;
  }
  if (winter && layers.brook && where === 'view') layers.brook *= 0.6; // gelé : plus doux
  // Saisons et phases des couches vivantes.
  const cr = NATURE_SOURCES.crickets;
  layers.crickets *= (cr.seasons[season] || 0) * cr.phases[phase];
  if (rainy || snowy) layers.crickets = 0;
  const fr = NATURE_SOURCES.frogs;
  let frogK = fr.seasons[season] ? fr.phases[phase] : 0;
  if (season === 'summer' && phase !== 'dusk') frogK = 0; // l'été : seulement le soir
  if (ctx.afterRain && !rainy) frogK *= 1.5;
  if (snowy) frogK = 0;
  layers.frogs = Math.min(1, layers.frogs * frogK);
  if (snowy) {
    layers.leaves = 0;
    layers.mill = 0;
  }
  for (const k of Object.keys(layers)) layers[k] = Math.round(clamp(layers[k], 0, 1) * 1000) / 1000;

  // ── Chants ──
  const birds = [];
  if (!rainy) {
    for (const id of SONG_IDS) {
      const src = NATURE_SOURCES[id];
      if (src.who === 'installed' && !has(facts.installed, id)) continue;
      if (src.who === 'seen' && !has(facts.seen, id)) continue;
      if (src.who === 'stage' && stage < src.minStage) continue;
      if (snowy && !src.snow) continue;
      let k = (src.seasons[season] || 0) * (src.phases[phase] ?? 1);
      // Les jours de passage, les grues et les cigognes en vol s'entendent davantage.
      if (where === 'farm' && id === 'crane' && facts.flyover === 'cranes') k = Math.max(k, 1) * 2;
      if (k <= 0) continue;
      const place = songPlace(id, src, facts, where, ctx.spots);
      if (!place) continue;
      const b = { id, rate: src.rate * k };
      if (place !== true) {
        b.x = place.x;
        b.y = place.y;
      }
      birds.push(b);
    }
  }
  // Plafond : la somme des fréquences ne dépasse jamais RATE_CAP (chacune chante un peu moins, au prorata).
  const total = birds.reduce((s, b) => s + b.rate, 0);
  const cap = RATE_CAP[where];
  const scale = total > cap ? cap / total : 1;
  for (const b of birds) b.rate = Math.round(b.rate * scale * 10000) / 10000;

  return {
    on: true,
    where,
    detail,
    phase,
    layers,
    birds,
    birdsFactor: farmBirdsFactor(facts),
    echo: detail === 'full' && where === 'view',
    maxVoices: MAX_VOICES[detail],
    brook: brookTone,
  };
}

/** Un fait factice complet (vallée complète, tous les habitants et visiteurs) : démo, débogage et tests. */
export function demoFacts(over = {}) {
  return {
    on: true,
    stage: 8,
    installed: ['robin', 'blackbird', 'swallow', 'tawnyOwl', 'jay', 'frog', 'littleOwl', 'blackWoodpecker', 'skylark', 'hoopoe', 'kingfisher', 'heron'],
    seen: ['whiteStork', 'crane', 'oriole', 'redDeer', 'beaver', 'glowworms'],
    places: { brook: 4, combe: 3, poppies: 3, millpond: 3, bocage: 3, oldOrchard: 3 },
    farm: { pond: true, frogs: true, wildGrass: 1, fallows: 1, strips: 2, hives: 2, nest: 'pair' },
    flyover: null,
    complete: true,
    ...over,
  };
}
