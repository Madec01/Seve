// La Vallée vivante — lot V4 « Les cigognes » : lectures pures (légendes et cloches, Merveille, visiteurs rares, cigognes,
// étape 8, vallée complète, épilogue, cartes des vallées voisines, banc, forêt de la carte, décor de la ferme, extras de la
// vue, livre de la vallée, faits sonores), sans enregistrement d'extension et sans tirage. L'extension `valley`
// (src/core/career/valley.js) s'en sert pour son déroulé, ses actions et ses requêtes ; src/core/career/habitat.js pour
// l'étape 8 et le prochain indice. Règles : docs/VALLEE.md § 18 ; contrat : docs/ARCHITECTURE.md, « Vallée vivante —
// contrats du lot V4 » (écarts : « Écarts et précisions (livraison CORE V4) »).
//
// N'importe ni DOM ni horloge ; n'importe ni habitat.js ni valley.js (pas d'import circulaire). Aucun nombre aléatoire :
// tout ce qui varie vient des données, des jours absolus et de hashSeed (hachage pur).

import { DAY_SECONDS, SEASONS } from '../../data/balance.js';
import { ALL_SPECIES, ALL_VARIETIES, STAGES_ALL, agreeWith, stageSigns } from '../../data/career/valley.js';
import { PLACES, PLACES_BY_ID, PLACE_MAX, WILD_RULES } from '../../data/career/places.js';
import { ofFarm } from '../../data/career/heritage.js';
import {
  BENCH_LINES, BOOK_TEXTS, DRAWN_VISITORS, EPILOGUE, FOREST_STATES, HELENE_NOTES, LEGENDS, LEGENDS_BY_ID, LEGEND_RULES, POSTCARDS, POSTCARDS_BY_ID, SCENERY_RULES,
  STAGE_V4, STORIES_V4, STORIES_V4_BY_ID, STORK_RULES, STORKS_TEXTS, VISITORS, VISITORS_BY_ID,
} from '../../data/career/storks.js';
import { hashSeed } from '../rng.js';
import { weatherWaters } from '../weather.js';
import { isFixed, libraryLevelOf, placeStepOf, placesOn, speciesInPart, speciesInstalled, storksOn, valleyOf, varietyInPart, varietyName } from './heirlooms.js';
import { absDayOf, viewOpen, wildCells } from './places.js';
import { farmDisplayName, storiesInfo } from './heritage.js';

export { storksOn };

const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const SEASON_NAME = { spring: 'printemps', summer: 'été', autumn: 'automne', winter: 'hiver' };

// ── Temps ──────────────────────────────────────────────────────────────────────────────────

/** Année (1…) d'un jour absolu. */
export function yearOfAbs(state, abs) {
  return Math.floor((Math.max(1, abs) - 1) / (4 * state.career.seasonLength)) + 1;
}

/** Saison (0..3) d'un jour absolu. */
function seasonIndexOfAbs(state, abs) {
  return Math.floor((Math.max(1, abs) - 1) / state.career.seasonLength) % 4;
}

/** Premier jour absolu d'une année. */
function yearStartAbs(state, year) {
  return (year - 1) * 4 * state.career.seasonLength + 1;
}

function seasonId(state) {
  return SEASONS[state.time.seasonIndex];
}

/** « 1ᵉʳ jour du printemps », « 3ᵉ jour du printemps ». */
export function springDayText(n) {
  return `${n === 1 ? '1ᵉʳ' : `${n}ᵉ`} jour du printemps`;
}

function daysWord(n) {
  const d = Math.max(0, Math.ceil(n));
  return `${d} jour${d > 1 ? 's' : ''}`;
}

/** Avancée de la journée (0 matin … 1 soir). */
function dayProgress(state) {
  return Math.max(0, Math.min(1, (state.time.elapsed || 0) / DAY_SECONDS));
}

function fill(text, vars) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

/** « de la Ferme des Tilleuls » (règle ofFarm, nom actuel, jamais enregistré). */
function farmOfState(state) {
  return ofFarm(farmDisplayName(state));
}

function V(state) {
  return valleyOf(state);
}

// ── Les cigognes : jour, conditions ────────────────────────────────────────────────────────

/** Le jour des cigognes de cette carrière (2ᵉ, 3ᵉ ou 4ᵉ jour du printemps ; hachage de la graine). */
export function storkDay(state) {
  const span = STORK_RULES.dayMax - STORK_RULES.dayMin + 1;
  return Math.min(state.career.seasonLength, STORK_RULES.dayMin + (hashSeed(state.seed, 'storkDay') % span));
}

/** Est-ce aujourd'hui le jour des cigognes ? */
export function isStorkDay(state) {
  return state.time.seasonIndex === 0 && state.time.dayOfSeason === storkDay(state);
}

/** Nombre de haies posées sur la ferme. */
function hedgeCount(state) {
  return Object.values(V(state)?.nature || {}).filter((n) => n.kind === 'hedge').length;
}

/** État d'une condition d'un visiteur (ou des cigognes) : { kind, ok, have, n, text }. */
export function visitorNeedStatus(state, need) {
  const v = V(state);
  const abs = absDayOf(state);
  switch (need.kind) {
    case 'stage': {
      const st = STAGES_ALL[need.n];
      return { kind: 'stage', ok: (v?.stage || 0) >= need.n, have: v?.stage || 0, n: need.n, text: `${st ? st.name : 'La vallée'} (étape ${need.n})` };
    }
    case 'place': {
      const p = PLACES_BY_ID[need.id];
      const have = placeStepOf(state, need.id);
      const st = p.steps[need.step];
      let ok = have >= need.step;
      let text = st?.name || `${p.name} à l'étape ${need.step}`;
      if (need.sinceSeasons) {
        const at = v?.places?.[need.id]?.steps?.[need.step];
        const since = ok && Number.isInteger(at) ? abs - at : 0;
        const want = need.sinceSeasons * state.career.seasonLength;
        ok = ok && since >= want;
        text = `${text} depuis ${need.sinceSeasons} saisons`;
        return { kind: 'place', id: need.id, ok, have, n: need.step, text, since, want };
      }
      return { kind: 'place', id: need.id, ok, have, n: need.step, text };
    }
    case 'nature': {
      const have = hedgeCount(state);
      return { kind: 'nature', id: need.id, ok: have >= need.n, have, n: need.n, text: `${need.n} haies sur la ferme (${Math.min(have, need.n)} / ${need.n})` };
    }
    default:
      return { kind: need.kind, ok: false, have: 0, n: 0, text: '?' };
  }
}

/** Recette d'un visiteur : { items: [{ text, ok, … }], ok, inSeason }. */
export function visitorRecipe(state, id) {
  const x = VISITORS_BY_ID[id];
  if (!x) return null;
  const items = x.recipe.map((n) => visitorNeedStatus(state, n));
  return { items, ok: items.every((i) => i.ok), inSeason: x.seasons.includes(seasonId(state)) };
}

/** Conditions des cigognes remplies (étape 7, étang ≥ 2, prairie ≥ 2) ? */
export function storkNeedsOk(state) {
  return storksOn(state) && STORK_RULES.needs.every((n) => visitorNeedStatus(state, n).ok);
}

/** L'étape 8 peut-elle être atteinte (cigognes vues sur le clocher ; étape 7 déjà atteinte) ? */
export function stage8Ok(state) {
  const v = V(state);
  return storksOn(state) && !!v?.stork?.seenAt && (v.stage || 0) >= STAGE_V4.n - 1;
}

/** Vallée complète : les six lieux restaurés et les cigognes qui nichent sur la maison. */
export function valleyComplete(state) {
  const v = V(state);
  if (!storksOn(state) || !v?.stork?.farmSince) return false;
  return PLACES.every((p) => placeStepOf(state, p.id) >= PLACE_MAX[p.id]);
}

/** Fiche des cigognes : query.career.valley().stork. */
export function storkInfo(state) {
  const v = V(state);
  const s = v?.stork || {};
  const day = storkDay(state);
  const year = state.time.year;
  const cur = s.years?.[year] || null;
  const st = s.farmSince ? 'nest' : s.seenAt ? 'seen' : s.steepleAt ? 'steeple' : 'waiting';
  return {
    day, dayText: springDayText(day), state: st,
    needs: STORK_RULES.needs.map((n) => {
      const r = visitorNeedStatus(state, n);
      return { text: r.text, ok: r.ok };
    }),
    thisYear: cur ? { arrived: cur.arrived, chicks: cur.chicks || 0, left: cur.left ?? null } : null,
    years: Object.keys(s.years || {}).length,
    steepleAt: s.steepleAt ?? null, seenAt: s.seenAt ?? null, wheelAt: s.wheelAt ?? null, farmSince: s.farmSince ?? null,
    wheel: !!s.wheelAt,
  };
}

/** Le texte de ce qui manque aux cigognes (indice) ou du jour qui les ramène. */
export function storkNeedText(state) {
  const v = V(state);
  if (!storksOn(state) || v?.stork?.steepleAt) return null;
  const missing = STORK_RULES.needs.map((n) => ({ n, r: visitorNeedStatus(state, n) })).filter((x) => !x.r.ok);
  if (!missing.length) return fill(STORKS_TEXTS.storkNeedDay, { day: springDayText(storkDay(state)) });
  const m = missing[0];
  const words = m.n.kind === 'place'
    ? { millpond: 'l\'étang aura ses nénuphars', poppies: 'la prairie sera fleurie' }[m.n.id] || `${PLACES_BY_ID[m.n.id].name.toLowerCase()} sera à l'étape ${m.n.step}`
    : 'la vallée sera vivante (étape 7)';
  return fill(STORKS_TEXTS.storkNeed, { need: words });
}

// ── Légendes et cloches ────────────────────────────────────────────────────────────────────

/** Nom d'une légende (la Merveille porte le nom actuel de la ferme). */
export function legendName(state, id) {
  const x = LEGENDS_BY_ID[id];
  if (!x) return '';
  return x.nameFarm ? `${x.name} ${farmOfState(state)}` : x.name;
}

/** La Merveille : { n, need, crossSaved, lastYear, thisSummer }. */
export function marvelInfo(state) {
  const v = V(state);
  const m = v?.marvel || { gens: 0, lastYear: 0 };
  const need = LEGEND_RULES.marvel.gens;
  return {
    n: Math.min(need, m.gens || 0), need, crossSaved: isFixed(state, LEGEND_RULES.marvel.crossId), lastYear: m.lastYear || 0,
    thisSummer: (m.lastYear || 0) >= state.time.year,
    text: fill(STORKS_TEXTS.marvelRule, { n: Math.min(need, m.gens || 0), need }),
  };
}

/** La condition de réveil d'une légende est-elle remplie ? (une légende réveillée le reste.) */
export function legendWakeOk(state, id) {
  const x = LEGENDS_BY_ID[id];
  const v = V(state);
  if (!x || !storksOn(state) || !v) return false;
  const w = x.wake;
  if (w.kind === 'stage') return (v.stage || 0) >= w.n;
  if (w.kind === 'place') return placeStepOf(state, w.id) >= w.step;
  if (w.kind === 'generations') return (v.marvel?.gens || 0) >= LEGEND_RULES.marvel.gens;
  return false;
}

/** Une légende est-elle réveillée ? */
export function legendAwake(state, id) {
  return !!V(state)?.legends?.[id];
}

/** Cloche d'une légende : null (endormie) | { state: 'free' | 'growing' | 'ripe', daysLeft, progress, sownAt, readyAt, sprite }. */
export function clocheInfo(state, id) {
  const v = V(state);
  if (!legendAwake(state, id)) return null;
  const c = v.cloches?.[id] || null;
  if (!c) return { state: 'free', daysLeft: 0, progress: 0, sownAt: null, readyAt: null, sprite: 'legend.cloche' };
  const abs = absDayOf(state);
  const total = Math.max(1, c.readyAt - c.sownAt);
  const progress = c.ripe ? 1 : Math.max(0, Math.min(1, (abs - c.sownAt) / total));
  const daysLeft = c.ripe ? 0 : Math.max(0, c.readyAt - abs);
  const stage = c.ripe ? 2 : progress >= 0.5 ? 1 : 0;
  return { state: c.ripe ? 'ripe' : 'growing', daysLeft, progress: Math.round(progress * 100) / 100, sownAt: c.sownAt, readyAt: c.readyAt, sprite: `legend.${id}.${stage}`, stage };
}

/** Raison pour laquelle une légende ne se sème pas (null si elle se sème). */
export function sowLegendReason(state, id) {
  const v = V(state);
  if (!LEGENDS_BY_ID[id]) return STORKS_TEXTS.unknownLegend;
  if (!legendAwake(state, id)) return STORKS_TEXTS.asleep;
  if (libraryLevelOf(state) < LEGEND_RULES.needLibrary) return STORKS_TEXTS.needLibrary;
  const c = v.cloches?.[id];
  if (c && c.ripe) return STORKS_TEXTS.ripeFirst;
  if (c) return STORKS_TEXTS.growing;
  return null;
}

/** Ce qui réveillera une légende endormie (fiche). */
function wakeTextOf(state, x) {
  if (x.wake.kind === 'generations') {
    const m = marvelInfo(state);
    return m.crossSaved ? m.text : STORKS_TEXTS.marvelNeedCross;
  }
  return x.wakeText;
}

/** Les 4 légendes : [legendInfo] (ordre de LEGENDS). */
export function legendsInfo(state) {
  const v = V(state);
  const lib = libraryLevelOf(state) >= LEGEND_RULES.needLibrary;
  return LEGENDS.map((x) => {
    const e = v?.legends?.[x.id] || null;
    const awake = !!e;
    const reason = sowLegendReason(state, x.id);
    const name = legendName(state, x.id);
    return {
      id: x.id, name: awake || x.nameFarm ? name : '?', fullName: name, sub: x.sub, cropId: x.cropId, icon: x.icon, g: x.g, pl: !!x.pl, the: x.nameFarm ? name : x.the,
      state: awake ? 'awake' : 'asleep', wakeText: awake ? null : wakeTextOf(state, x),
      ...(x.wake.kind === 'generations' ? { gens: { n: marvelInfo(state).n, need: LEGEND_RULES.marvel.gens } } : {}),
      cloche: clocheInfo(state, x.id), canSow: !reason, sowReason: reason, harvests: e?.harvests || 0, anecdote: awake ? x.anecdote : null,
      needLibrary: !lib, waitsHome: awake && !lib ? fill(STORKS_TEXTS.waitsHome, { the: x.nameFarm ? name : x.the }) : null,
      awokeAt: e?.awokeAt ?? null, firstAt: e?.firstAt ?? null, label: x.label, growDays: x.growDays, story: x.story,
    };
  });
}

// ── Visiteurs rares ────────────────────────────────────────────────────────────────────────

const SEASONS_TEXT = (seasons) => {
  if (seasons.length === 4) return 'toute l\'année';
  if (seasons.length === 1) return SEASON_NAME[seasons[0]];
  return `${SEASON_NAME[seasons[0]]} → ${SEASON_NAME[seasons[seasons.length - 1]]}`;
};

/** Les 6 visiteurs : [visitorInfo] (ordre de VISITORS). */
export function visitorsInfo(state) {
  const v = V(state);
  const sid = seasonId(state);
  return VISITORS.map((x) => {
    const e = v?.visitors?.[x.id] || null;
    const r = visitorRecipe(state, x.id);
    const st = e ? e.state : 'unknown';
    const inSeason = x.seasons.includes(sid);
    return {
      id: x.id, name: x.name, the: x.the, g: x.g, pl: !!x.pl, icon: x.icon, seasons: [...x.seasons], seasonsText: SEASONS_TEXT(x.seasons), state: st, inSeason,
      recipe: r.items.map((i) => ({ text: i.text, ok: i.ok })), recipeOk: r.ok, where: x.whereText, whereKind: x.where, ...(x.placeId ? { placeId: x.placeId } : {}),
      spot: x.spot || null, spotId: e?.spotId || null, hint: st !== 'unknown' ? x.hint : null, hintIcon: x.hintIcon, anecdote: st === 'seen' ? x.anecdote : null,
      title: x.title, halt: x.halt, still: st === 'visible' && !inSeason ? x.still || null : null, seenAt: e?.at ?? null, drawn: x.drawn,
    };
  });
}

/** Visiteurs vus (identifiants, ordre des données). */
export function seenVisitors(state) {
  const v = V(state);
  return VISITORS.filter((x) => v?.visitors?.[x.id]?.state === 'seen').map((x) => x.id);
}

/** Emplacement de la ferme où l'on voit les vers luisants : une haie posée (hachage de la graine), sinon la haie de départ. */
export function glowSpot(state) {
  const hedges = Object.entries(V(state)?.nature || {}).filter(([, n]) => n.kind === 'hedge').map(([spotId]) => spotId);
  if (!hedges.length) return 'start.hedgeL';
  return hedges[hashSeed(state.seed, 'glowworms') % hedges.length];
}

/** Emplacement d'un visiteur (lieu de la vallée, 'steeple' ou une haie de la ferme). */
export function visitorSpot(state, id) {
  const x = VISITORS_BY_ID[id];
  if (!x) return null;
  if (x.spot === 'steeple') return 'steeple';
  if (x.spot === 'hedge') return glowSpot(state);
  return x.placeId;
}

// ── Épilogue, cartes, banc, Hélène ─────────────────────────────────────────────────────────

/** Les pages de l'épilogue ({ofFarm} remplacé). */
export function epiloguePages(state) {
  const of = farmOfState(state);
  return EPILOGUE.pages.map((p) => ({ vignette: p.vignette, lines: p.lines.map((l) => fill(l, { ofFarm: of })) }));
}

/** Le générique : { title, cards: [{ placeId, name, text }], total, end }. */
export function creditsInfo(state) {
  const v = V(state);
  const species = ALL_SPECIES.filter((s) => speciesInPart(state, s)).length;
  const varieties = ALL_VARIETIES.filter((x) => varietyInPart(state, x)).length;
  return {
    title: fill(EPILOGUE.credits.title, { ofFarm: farmOfState(state) }),
    cards: EPILOGUE.credits.places.map((id) => {
      const p = PLACES_BY_ID[id];
      return { placeId: id, name: p.name, text: p.steps[PLACE_MAX[id]].line };
    }),
    total: fill(EPILOGUE.credits.total, { species, varieties, places: PLACES.length, legends: LEGENDS.length }),
    end: [...EPILOGUE.credits.end],
    watched: !!v?.epilogue?.creditsAt,
  };
}

/** L'épilogue : { available, read, credits, availableAt, readAt, creditsAt }. */
export function epilogueInfo(state) {
  const e = V(state)?.epilogue || {};
  return { available: !!e.availableAt, read: !!e.readAt, credits: !!e.creditsAt, availableAt: e.availableAt ?? null, readAt: e.readAt ?? null, creditsAt: e.creditsAt ?? null };
}

/** Cartes des vallées voisines : { open, sent, got, left, canSend, reason }. */
export function postcardsInfo(state) {
  const v = V(state);
  const p = v?.postcards || { sent: null, got: [] };
  const abs = absDayOf(state);
  const open = !!v?.epilogue?.readAt;
  const left = POSTCARDS.length - p.got.length - (p.sent ? 1 : 0);
  let reason = null;
  if (!open) reason = STORKS_TEXTS.postcardNeedEpilogue;
  else if (p.sent) reason = STORKS_TEXTS.postcardInFlight;
  else if (left <= 0) reason = STORKS_TEXTS.postcardsDone;
  return {
    open,
    sent: p.sent ? { id: p.sent.id, valley: POSTCARDS_BY_ID[p.sent.id].valley, arrives: p.sent.arrives, daysLeft: Math.max(0, p.sent.arrives - abs) } : null,
    got: p.got.map((g) => {
      const c = POSTCARDS_BY_ID[g.id];
      return { id: g.id, n: c.n, valley: c.valley, signer: c.signer, text: c.text, vignette: c.vignette, read: !!g.read, at: g.at, year: yearOfAbs(state, g.at) };
    }),
    left: Math.max(0, left), canSend: !reason, reason, next: !reason ? POSTCARDS.find((c) => !p.got.some((g) => g.id === c.id))?.id || null : null,
  };
}

/** Prochaine carte à envoyer (ordre fixe) ou null. */
export function nextPostcard(state) {
  const p = V(state)?.postcards || { sent: null, got: [] };
  return POSTCARDS.find((c) => !p.got.some((g) => g.id === c.id) && p.sent?.id !== c.id) || null;
}

/** Phrase du banc (Joseph et Hélène) d'un jour : 4 par saison, hachage du jour. */
export function benchLine(state, abs = absDayOf(state)) {
  const sid = SEASONS[seasonIndexOfAbs(state, abs)];
  const list = BENCH_LINES[sid];
  return fill(list[hashSeed(abs, 'bench') % list.length], { day: springDayText(storkDay(state)) });
}

/** Phrase d'Hélène d'une année (livre) : hachage pur de la graine et de l'année. */
export function heleneNote(state, year) {
  return HELENE_NOTES[hashSeed(state.seed, `helene${year}`) % HELENE_NOTES.length];
}

// ── Forêt, décor de la ferme, vue ──────────────────────────────────────────────────────────

/** La forêt de la carte (0..3) : 0 avant l'étape 5, 1 aux étapes 5–6, 2 à l'étape 7 et 8, 3 vallée complète. */
export function forestState(state) {
  const v = V(state);
  if (!storksOn(state) || !v?.started) return 0;
  if (valleyComplete(state)) return 3;
  if (v.stage >= 7) return 2;
  if (v.stage >= 5) return 1;
  return 0;
}

/** État du nid sur la maison : null (pas de roue) | 'wheel' | 'pair' | 'chicks' | 'snow'. */
export function nestState(state) {
  const s = V(state)?.stork;
  if (!s?.wheelAt) return null;
  const sid = seasonId(state);
  const cur = s.years?.[state.time.year];
  if ((sid === 'spring' || sid === 'summer') && cur && cur.left === null) return cur.chicks > 0 ? 'chicks' : 'pair';
  if (sid === 'winter' && s.farmSince) return 'snow';
  return 'wheel';
}

const sceneryCache = new WeakMap();

/** Décor de la ferme du jour : query.career.valleyScenery() (calculé une fois par jour et par état). */
export function sceneryOf(state) {
  const v = V(state);
  if (!storksOn(state) || !v?.started) return null;
  const abs = absDayOf(state);
  const seen = seenVisitors(state);
  const sig = `${abs}|${v.stage}|${v.stork?.wheelAt}|${v.stork?.farmSince}|${seen.join(',')}|${JSON.stringify(v.stork?.years?.[state.time.year] || null)}|${v.rainedAt}|${state.weather?.today}`;
  const hit = sceneryCache.get(state);
  if (hit && hit.sig === sig) return hit.value;
  const sid = seasonId(state);
  const nest = nestState(state);
  const cur = v.stork?.years?.[state.time.year];
  let flyover = null;
  if (sid === 'autumn' && seen.includes('crane') && hashSeed(abs, 'cranes') % SCENERY_RULES.craneFlyEvery === 0) flyover = 'cranes';
  else if ((nest === 'pair' || nest === 'chicks') && hashSeed(abs, 'storkFly') % SCENERY_RULES.storkFlyEvery === 0) flyover = 'storks';
  const hasOrchard = state.career.lots.some((l) => l.type === 'orchard');
  const value = {
    forestState: forestState(state),
    nest: nest ? { state: nest, chicks: nest === 'chicks' ? cur.chicks : 0 } : null,
    flyover,
    glow: sid === 'summer' && seen.includes('glowworms'),
    deer: sid === 'autumn' && seen.includes('redDeer') && hashSeed(abs, 'deer') % SCENERY_RULES.deerEvery === 0,
    oriole: sid === 'summer' && seen.includes('oriole') && hasOrchard && hashSeed(abs, 'oriole') % SCENERY_RULES.orioleEvery === 0,
    rainbow: v.rainedAt === abs - 1 && !weatherWaters(state.weather?.today) && hashSeed(abs, 'rainbow') % SCENERY_RULES.rainbowEvery === 0,
  };
  sceneryCache.set(state, { sig, value });
  return value;
}

const VIEW_ANCHOR = { whiteStork: 'steeple', crane: 'crane', redDeer: 'redDeer', oriole: 'oriole', beaver: 'beaver', glowworms: 'glowView' };

/** Un récit, le chapitre 8 ou l'épilogue du V4 attend d'être lu (Joseph sur le banc). */
export function unreadV4(state) {
  const v = V(state);
  if (!storksOn(state) || !v) return null;
  const story = STORIES_V4.find((s) => v.stories?.available?.includes(s.id) && !v.stories.read.includes(s.id));
  if (story) return { type: 'story', id: story.id };
  if (v.stage >= STAGE_V4.n && !v.chapters?.read?.includes(STAGE_V4.n)) return { type: 'chapter', id: STAGE_V4.n };
  if (v.epilogue?.availableAt && !v.epilogue.readAt) return { type: 'epilogue', id: 'epilogue' };
  return null;
}

/** Champs du V4 de query.career.valleyView() (la vue est ouverte). */
export function viewExtras(state) {
  const v = V(state);
  const abs = absDayOf(state);
  const sid = seasonId(state);
  const visitors = [];
  let residents = 0;
  for (const x of VISITORS) {
    const e = v.visitors?.[x.id];
    if (!e) continue;
    if (x.id === 'whiteStork') {
      if (e.state === 'visible') visitors.push({ id: x.id, state: 'visible', anchor: VIEW_ANCHOR[x.id] });
      continue;
    }
    if (x.where === 'view') {
      if (e.state === 'hint' && e.since === abs) visitors.push({ id: x.id, state: 'hint', anchor: VIEW_ANCHOR[x.id], hintIcon: x.hintIcon });
      else if (e.state === 'visible') visitors.push({ id: x.id, state: 'visible', anchor: VIEW_ANCHOR[x.id] });
    }
  }
  for (const x of VISITORS) {
    if (residents >= 3 || x.id === 'whiteStork') continue;
    if (v.visitors?.[x.id]?.state !== 'seen' || !x.seasons.includes(sid)) continue;
    if (hashSeed(abs, `v4.${x.id}`) % SCENERY_RULES.residentEvery === 0) continue;
    residents += 1;
    visitors.push({ id: x.id, state: 'resident', anchor: VIEW_ANCHOR[x.id] });
  }
  const s = v.stork || {};
  const waiting = v.visitors?.whiteStork?.state === 'visible';
  const steepleSeason = (sid === 'spring' || sid === 'summer') && !!s.seenAt;
  const unread = unreadV4(state);
  const epi = v.epilogue || {};
  let joseph = false;
  if (epi.availableAt && !epi.readAt) joseph = 'epilogue';
  else if (unread) joseph = 'story';
  else if (epi.readAt) joseph = 'resident';
  return {
    visitors,
    steeple: { storks: waiting || steepleSeason ? 2 : 0, visible: !!s.steepleAt, waiting },
    beaverDam: v.visitors?.beaver?.state === 'seen',
    villageLights: dayProgress(state) >= 0.75,
    bench: { joseph, helene: !!epi.readAt, line: epi.readAt ? benchLine(state, abs) : null },
    complete: valleyComplete(state),
    canContemplate: !!epi.readAt,
  };
}

// ── Le livre de la vallée ──────────────────────────────────────────────────────────────────

/** Jours absolus de chaque signe de vie actuel (habitants, variétés, étapes de lieux, terres reprises), triés. */
export function datedSigns(state) {
  const v = V(state);
  if (!v) return [];
  const fallback = v.started?.abs || 1;
  const out = [];
  for (const s of ALL_SPECIES) if (speciesInstalled(state, s.id)) out.push(Number.isInteger(v.species[s.id]?.at) ? v.species[s.id].at : fallback);
  for (const x of ALL_VARIETIES) if (varietyInPart(state, x) && isFixed(state, x.id)) out.push(Number.isInteger(v.varieties[x.id]?.fixedAt) ? v.varieties[x.id].fixedAt : fallback);
  if (placesOn(state)) {
    for (const p of PLACES) {
      const e = v.places?.[p.id];
      for (let k = 1; k <= (e?.step || 0); k++) out.push(Number.isInteger(e.steps?.[k]) ? e.steps[k] : fallback);
    }
    const L = state.career.seasonLength;
    for (const c of Object.values(wildCells(state))) if (c.stage >= 2) out.push((v.wilds[c.cellId]?.at ?? fallback) + WILD_RULES.grownSeasons * L);
  }
  return out.sort((a, b) => a - b);
}

/** Signes de vie atteints à la fin d'un jour absolu (d'après les dates gardées). */
function signsAt(dates, abs) {
  let n = 0;
  for (const d of dates) if (d <= abs) n++;
  return n;
}

/**
 * Jour de chaque étape déjà atteinte, reconstruit pour une ancienne carrière : le premier jour où les signes de vie datés
 * atteignent le palier (et, étapes 6 et 7, où les lieux demandés y étaient) ; jamais avant l'étape d'avant. → { [n]: { abs, approx: true } }
 */
export function reconstructStageAt(state) {
  const v = V(state);
  if (!v?.started) return {};
  const dates = datedSigns(state);
  const start = v.started.abs;
  const out = { 0: { abs: start, approx: true } };
  const stepAt = (id, k) => v.places?.[id]?.steps?.[k] ?? start;
  for (let n = 1; n <= Math.min(v.stage, STAGE_V4.n); n++) {
    let d;
    if (n === STAGE_V4.n) d = v.stork?.seenAt ? v.stork.seenAt + 1 : out[n - 1].abs;
    else {
      const need = stageSigns(n, true, true) || 0;
      d = need > 0 ? dates[need - 1] ?? dates[dates.length - 1] ?? start : start;
      if (n === 6) d = Math.max(d, stepAt('brook', 2));
      if (n === 7) d = Math.max(d, ...PLACES.map((p) => stepAt(p.id, 2)));
    }
    out[n] = { abs: Math.max(d, out[n - 1].abs), approx: true };
  }
  return out;
}

/** Étape atteinte à la fin d'un jour absolu (d'après stageAt). */
function stageAtAbs(state, abs) {
  const v = V(state);
  let n = 0;
  let approx = false;
  for (const [k, e] of Object.entries(v.stageAt || {})) {
    const kk = Number(k);
    if (e && e.abs <= abs && kk > n) {
      n = kk;
      approx = !!e.approx;
    }
  }
  return { n: Math.min(n, v.stage), approx };
}

/** Le nom d'un habitant (« Le hérisson s'installe »). */
function beingLine(s) {
  return fill(s.pl ? BOOK_TEXTS.installedPl : BOOK_TEXTS.installed, { name: s.the || s.name });
}

/** Lignes d'une année du livre (au plus 6, les premières fois de l'année). */
function yearLines(state, year) {
  const v = V(state);
  const from = yearStartAbs(state, year);
  const to = yearStartAbs(state, year + 1) - 1;
  const inYear = (abs) => Number.isInteger(abs) && abs >= from && abs <= to;
  const groups = [];
  // Étape : la plus haute franchie cette année (une seule ligne ; le titre de la page dit déjà l'étape de fin d'année).
  for (let n = v.stage; n >= 1; n--) {
    if (!inYear(v.stageAt?.[n]?.abs)) continue;
    groups.push(fill(BOOK_TEXTS.stage, { n, name: STAGES_ALL[n].name }));
    break;
  }
  // Cigognes.
  const s = v.stork || {};
  if (inYear(s.steepleAt)) groups.push(BOOK_TEXTS.storkSteeple);
  const sy = s.years?.[year];
  if (sy) groups.push(fill(sy.chicks ? BOOK_TEXTS.storkYearChicks : BOOK_TEXTS.storkYear, { day: springDayText(seasonDayOf(state, sy.arrived)), chicks: fill(STORKS_TEXTS.chicksBook, { n: sy.chicks, x: sy.chicks > 1 ? 'x' : '' }) }));
  if (inYear(v.epilogue?.readAt)) groups.push(BOOK_TEXTS.epilogue);
  // Légendes, visiteurs.
  for (const x of LEGENDS) if (inYear(v.legends?.[x.id]?.awokeAt)) groups.push(fill(x.pl ? BOOK_TEXTS.legendPl : BOOK_TEXTS.legend, { name: legendName(state, x.id) }));
  for (const x of VISITORS) {
    if (x.id === 'whiteStork') continue;
    const e = v.visitors?.[x.id];
    if (e?.state === 'seen' && inYear(e.at)) groups.push(fill(BOOK_TEXTS.visitor, { name: x.the, s: x.pl ? (x.g === 'f' ? 'es' : 's') : x.g === 'f' ? 'e' : '' }));
  }
  // Lieux.
  for (const p of PLACES) {
    const e = v.places?.[p.id];
    for (let k = 1; k <= (e?.step || 0); k++) if (inYear(e.steps?.[k])) groups.push(fill(BOOK_TEXTS.place, { place: p.name, step: p.steps[k].name.charAt(0).toLowerCase() + p.steps[k].name.slice(1) }));
  }
  // Habitants, variétés.
  for (const sp of ALL_SPECIES) if (speciesInstalled(state, sp.id) && inYear(v.species[sp.id]?.at)) groups.push(beingLine(sp));
  for (const x of ALL_VARIETIES) {
    if (!varietyInPart(state, x) || !isFixed(state, x.id) || !inYear(v.varieties[x.id]?.fixedAt)) continue;
    groups.push(fill(x.g === 'm' ? BOOK_TEXTS.savedM : BOOK_TEXTS.saved, { name: varietyName(state, x) }));
  }
  for (const g of v.postcards?.got || []) if (inYear(g.at)) groups.push(fill(BOOK_TEXTS.postcard, { of: ofValley(POSTCARDS_BY_ID[g.id].valley) }));
  return groups.slice(0, 6);
}

/** Jour de la saison (1…) d'un jour absolu. */
function seasonDayOf(state, abs) {
  return ((Math.max(1, abs) - 1) % state.career.seasonLength) + 1;
}

/** « 3 cigogneaux », « 1 cigogneau ». */
export function chicksText(n) {
  return fill(STORKS_TEXTS.chicks, { n, x: n > 1 ? 'x' : '' });
}

/** « du Val-aux-Merles », « des Combes-Hautes », « de Saint-Aubin-des-Saules ». */
export function ofValley(name) {
  return ofFarm(name);
}

/** Les années du livre : [{ year, stage, stageName, vignette, approx, lines, helene }]. */
export function chronicle(state) {
  const v = V(state);
  if (!storksOn(state) || !v?.started) return [];
  const out = [];
  const heleneFrom = heleneYear(state);
  for (let year = v.started.year; year <= state.time.year; year++) {
    const end = year === state.time.year ? absDayOf(state) : yearStartAbs(state, year + 1) - 1;
    const st = year === state.time.year ? { n: v.stage, approx: !!v.stageAt?.[v.stage]?.approx } : stageAtAbs(state, end);
    out.push({
      year, stage: st.n, stageName: STAGES_ALL[st.n].name, vignette: `valley.stage.${st.n}`, approx: st.approx,
      lines: yearLines(state, year), helene: heleneFrom !== null && year >= heleneFrom ? heleneNote(state, year) : null,
    });
  }
  return out;
}

/** Année d'arrivée d'Hélène (premier habitant de la vallée installé) ou null. */
function heleneYear(state) {
  const v = V(state);
  if (!v?.stories?.available?.includes('helene')) return null;
  const ats = ALL_SPECIES.filter((s) => s.group === 'valley' && speciesInstalled(state, s.id)).map((s) => v.species[s.id]?.at).filter(Number.isInteger);
  return ats.length ? yearOfAbs(state, Math.min(...ats)) : v.started.year;
}

/** query.career.valleyBook() : tout le livre, reconstruit depuis l'état. */
export function bookOf(state) {
  const v = V(state);
  if (!storksOn(state) || !v?.started) return null;
  const dates = datedSigns(state);
  const years = chronicle(state);
  const total = ALL_SPECIES.filter((s) => speciesInPart(state, s)).length + ALL_VARIETIES.filter((x) => varietyInPart(state, x)).length + PLACES.reduce((a, p) => a + PLACE_MAX[p.id], 0) + WILD_RULES.total;
  const startYear = v.started.year;
  const fromEnd = Math.min(absDayOf(state), yearStartAbs(state, startYear + 1) - 1);
  const first = years[0];
  const seeds = [
    ...ALL_VARIETIES.filter((x) => varietyInPart(state, x)).map((x) => {
      const e = v.varieties[x.id];
      return { id: x.id, kind: 'variety', name: e ? varietyName(state, x) : '?', icon: x.icon, state: !e ? 'unknown' : e.fixedAt ? 'saved' : 'seeds', year: e?.fixedAt ? yearOfAbs(state, e.fixedAt) : null };
    }),
    ...LEGENDS.map((x) => {
      const e = v.legends?.[x.id];
      return { id: x.id, kind: 'legend', name: e ? legendName(state, x.id) : '?', icon: x.icon, state: e ? 'awake' : 'unknown', year: e ? yearOfAbs(state, e.awokeAt) : null, harvests: e?.harvests || 0 };
    }),
  ];
  const beings = [
    ...ALL_SPECIES.filter((s) => speciesInPart(state, s)).map((s) => {
      const e = v.species[s.id];
      const ok = speciesInstalled(state, s.id);
      return { id: s.id, kind: 'species', name: ok ? s.name : '?', icon: s.icon, state: ok ? 'installed' : 'unknown', year: ok && Number.isInteger(e?.at) ? yearOfAbs(state, e.at) : null };
    }),
    ...VISITORS.map((x) => {
      const e = v.visitors?.[x.id];
      const ok = e?.state === 'seen';
      return { id: x.id, kind: 'visitor', name: ok ? x.name : '?', icon: x.icon, state: ok ? 'seen' : 'unknown', year: ok ? yearOfAbs(state, e.at) : null };
    }),
  ];
  const places = PLACES.map((p) => {
    const step = placeStepOf(state, p.id);
    const at = v.places?.[p.id]?.steps?.[PLACE_MAX[p.id]];
    return { id: p.id, name: p.name, step, max: PLACE_MAX[p.id], stepName: step ? p.steps[step].name : null, vignette: `place.${p.id}.${step}`, restored: step >= PLACE_MAX[p.id], restoredYear: step >= PLACE_MAX[p.id] && Number.isInteger(at) ? yearOfAbs(state, at) : null };
  });
  const seen = seenVisitors(state);
  const d = storkDay(state);
  const calendar = VISITORS.filter((x) => seen.includes(x.id)).map((x) => ({ id: x.id, when: fill(x.calendar, { dayShort: `${d === 1 ? '1ᵉʳ' : `${d}ᵉ`} jour` }) }));
  const chapters = STAGES_ALL.filter((st) => st.n <= v.stage).map((st) => ({ kind: 'chapter', id: st.n, title: st.chapter.title, available: true, read: !!v.chapters?.read?.includes(st.n) }));
  const stories = storiesInfo(state).filter((s) => s.available).map((s) => ({ kind: s.epilogue ? 'epilogue' : 'story', id: s.id, title: s.title, available: true, read: s.read }));
  return {
    title: fill(BOOK_TEXTS.title, { ofFarm: farmOfState(state) }), farmName: farmDisplayName(state), since: startYear, sinceText: fill(BOOK_TEXTS.since, { year: startYear }),
    cover: { vignette: `valley.stage.${v.stage}`, stage: v.stage, signs: dates.length, total },
    beforeAfter: {
      from: { year: startYear, stage: first ? first.stage : 0, vignette: first ? first.vignette : 'valley.stage.0', signs: signsAt(dates, fromEnd) },
      to: { year: state.time.year, stage: v.stage, vignette: `valley.stage.${v.stage}`, signs: dates.length },
      text: fill(BOOK_TEXTS.signs, { from: signsAt(dates, fromEnd), to: dates.length }),
    },
    years, seeds, beings, places, calendar, stories: [...chapters, ...stories],
    postcards: postcardsInfo(state).got,
    epilogue: { read: !!v.epilogue?.readAt, credits: !!v.epilogue?.creditsAt },
  };
}

// ── Faits sonores ──────────────────────────────────────────────────────────────────────────

/** query.career.valleySounds() : faits du jeu pour le paysage sonore (forme figée au contrat, paquet AUDIO). */
export function soundFacts(state) {
  const v = V(state);
  if (!storksOn(state) || !v?.started) return null;
  const sc = sceneryOf(state);
  const wild = Object.values(wildCells(state));
  const nest = sc?.nest?.state === 'pair' || sc?.nest?.state === 'chicks' ? sc.nest.state : null;
  return {
    on: true,
    stage: v.stage,
    installed: ALL_SPECIES.filter((s) => speciesInstalled(state, s.id)).map((s) => s.id),
    seen: seenVisitors(state),
    places: Object.fromEntries(PLACES.map((p) => [p.id, placeStepOf(state, p.id)])),
    farm: {
      pond: state.career.lots.some((l) => l.type === 'pond'),
      frogs: speciesInstalled(state, 'frog'),
      wildGrass: wild.filter((c) => c.kind === 'grassland' && c.stage >= 1).length,
      fallows: state.plots.filter((p) => p && p.env && p.unlocked && p.fallow !== undefined && !p.cropId).length,
      strips: Object.values(v.nature || {}).filter((n) => n.kind === 'strip').length,
      hives: state.investments?.beehive || 0,
      nest,
    },
    flyover: sc?.flyover || null,
    complete: valleyComplete(state),
  };
}

/** L'accord d'un mot pour une légende ou un visiteur (« réveillé », « réveillés »). */
export function agreeV4(x, word) {
  return agreeWith({ g: x.g, pl: !!x.pl }, word);
}

export { capital, daysWord, fill, springDayText as storkDayText, FOREST_STATES, LEGENDS, VISITORS, DRAWN_VISITORS, POSTCARDS, STORIES_V4, STORIES_V4_BY_ID };
