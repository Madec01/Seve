// Catalogue « Les niveaux » de l'accompagnement : la contrainte de chaque niveau en une leçon, les ateliers, le
// pommier, les abeilles, les chèvres, le concours, quelques achats, et le menu principal (grange, décor, carrière,
// succès). docs/ACCOMPAGNEMENT.md § 7.2. Paquet LEÇONS lots. PUR : aucun accès au DOM ; tout passe par `ctx`.
// (Le cours du niveau 1, `levels.firstYear`, est dans basics.js.)
//
// Identifiants des anciens conseils repris tels quels (« déjà vu » reste vu) : processing, processingBought, tree,
// goat, pollination, contest, grange, decor.

import { perkList } from '../../../core/progression.js';

// ── Petits outils (purs) ─────────────────────────────────────────────────────────────────────

function safe(ctx, fn, fallback) {
  if (ctx && typeof ctx.safe === 'function') return ctx.safe(fn, fallback);
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
const levelId = (ctx) => (ctx?.mode === 'career' || ctx?.state?.mode === 'career' ? null : ctx?.state?.levelId ?? ctx?.level?.id ?? null);
const isLevel = (n) => (ctx) => levelId(ctx) === n;
const lvl = (ctx) => ctx?.level || safe(ctx, () => ctx.q.level(), null);
const invs = (ctx) => safe(ctx, () => ctx.q.investments(), []) || [];
const offered = (ctx, id) => (lvl(ctx)?.availableInvestments || []).includes(id) || invs(ctx).some((i) => i.id === id);
const isProcessing = (inv) => !!inv && (inv.category === 'processing' || !!inv.processing || Array.isArray(inv.recipes));
const plots = (ctx) => safe(ctx, () => ctx.q.plots(), []) || [];
const START = ['start', 'dawn'];
const sheetOpened = (...ids) => ({ on: 'sheetOpen', when: (ctx) => ids.includes(ctx.signal?.data?.id) });

/** Ce niveau a déjà été gagné ou commencé (progression) : sa leçon est sue. */
function levelKnownIn(ctx, id) {
  const l = ctx?.progress?.levels?.[id];
  return !!l && !!(l.completed || l.played || (l.bestMoney !== undefined && l.bestMoney !== null) || (l.stars || 0) > 0);
}
const levelsWon = (ctx) => Object.values(ctx?.progress?.levels || {}).filter((l) => l && l.completed).length;
const knownLevel = (id) => (ctx) => levelKnownIn(ctx, id);

/** Au menu principal (signal `menu` ou contexte d'interface). */
function onMainMenu(ctx) {
  const screen = ctx.signal?.name === 'menu' ? ctx.signal.data?.screen : ctx.ui?.menu;
  return screen === 'main' || screen === 'main-menu' || screen === true;
}

const UI = {
  shop: { ui: '#tab-shop', label: 'l\'onglet Acheter' },
  stats: { ui: '#tab-stats', label: 'l\'onglet Bilan' },
  money: { ui: '#hud-money', label: 'votre argent' },
  bill: { ui: '#hud-bill', label: 'le fermage' },
  date: { ui: '#hud-date', label: 'la date et la saison' },
  grange: { ui: '#menu-grange', label: 'la grange aux souvenirs' },
  field: { field: true, label: 'le champ' },
};

/** Leçon « début du niveau N » : une ou deux bulles de lecture. */
function levelStart(n, id, title, steps, extra = {}) {
  return {
    id,
    chapter: 'levels',
    title,
    modes: ['levels'],
    tier: 'E',
    priority: 72,
    trigger: { on: START, when: isLevel(n) },
    acquired: knownLevel(n),
    steps,
    ...extra,
  };
}

/** Grand écran à la souris (`ctx.ui.touch === false`) : « Cliquez » au lieu de « Touchez » (docs/ACCOMPAGNEMENT.md § 13). */
function mouseWords(list) {
  const adapt = (ctx, t) => (ctx?.ui?.touch === false && typeof t === 'string' ? t.replace(/Touchez/g, 'Cliquez').replace(/touchez/g, 'cliquez') : t);
  for (const l of list) {
    for (const s of l.steps || []) {
      const base = s.say;
      s.say = (ctx) => adapt(ctx, typeof base === 'function' ? base(ctx) : base);
    }
  }
  return list;
}

// ── Les leçons ───────────────────────────────────────────────────────────────────────────────

export const LESSONS = mouseWords([
  {
    id: 'levels.loan',
    chapter: 'money',
    title: 'Joseph vous dépanne',
    modes: ['levels'],
    tier: 'E',
    priority: 90,
    urgent: true, // danger réel : passe même pendant l'attente d'un cours (allowedDuringCourse)
    trigger: { on: ['dialogClose'], when: (ctx) => ctx.signal?.data?.id === 'neighbour-loan' },
    steps: [
      {
        id: 'share',
        say: () => 'Une part de vos ventes me rembourse toute seule.',
        face: 'content',
        target: () => UI.money,
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'repay',
        say: () => 'Touchez votre argent : vous pouvez aussi me rembourser là.',
        face: 'happy',
        target: () => UI.money,
        gesture: 'tap',
        done: { on: 'sheetOpen', button: 'Compris' },
      },
    ],
  },
  levelStart(2, 'levels.drought', 'L\'année de sécheresse', [
    {
      id: 'water',
      say: () => 'Cette année, arroser coûte 1 pièce par parcelle.',
      face: 'content',
      target: () => UI.money,
      gesture: 'look',
      done: { button: 'Suivant' },
    },
    {
      id: 'potato',
      say: () => 'La pomme de terre pousse sans eau. Pensez-y !',
      face: 'happy',
      target: (ctx) => (ctx.ui?.sheet === 'seeds' ? { ui: '#seed-potato', sheet: 'seeds', label: 'la pomme de terre' } : { ui: '#tab-shop', label: 'l\'onglet Acheter' }),
      gesture: 'look',
      done: { button: 'Compris' },
    },
  ]),
  levelStart(3, 'levels.rot', 'L\'année pluvieuse', [
    {
      id: 'rot',
      say: () => 'Pluie fréquente : une culture mûre peut pourrir. Récoltez vite !',
      face: 'content',
      target: () => UI.field,
      gesture: 'look',
      done: { button: 'Compris' },
    },
  ]),
  levelStart(4, 'levels.smallPlot', 'Le petit lopin', [
    {
      id: 'small',
      say: () => 'Seulement 6 parcelles : misez aussi sur les animaux.',
      face: 'content',
      target: () => UI.shop,
      gesture: 'look',
      done: { button: 'Compris' },
    },
  ]),
  levelStart(5, 'levels.longWinter', 'L\'hiver sans fin', [
    {
      id: 'winter',
      say: () => 'L\'hiver dure 14 jours : gardez des réserves pour le fermage.',
      face: 'content',
      target: () => UI.bill,
      gesture: 'look',
      done: { button: 'Compris' },
    },
  ]),
  levelStart(6, 'levels.market', 'Le marché fou', [
    {
      id: 'prices',
      say: () => 'Les prix changent chaque jour. Le cours du jour est écrit ici.',
      face: 'content',
      sheet: 'seeds',
      target: () => ({ ui: '.seed-row', sheet: 'seeds', label: 'le cours d\'une culture' }),
      gesture: 'look',
      done: { button: 'Compris' },
    },
  ], { trigger: { on: ['sheetOpen'], when: (ctx) => levelId(ctx) === 6 && ctx.signal?.data?.id === 'seeds' } }),
  levelStart(7, 'levels.credit', 'Le crédit', [
    {
      id: 'loan',
      say: () => 'Le 4e jour de chaque saison, la banque reprend 150 pièces.',
      face: 'content',
      target: () => UI.bill,
      gesture: 'look',
      done: { button: 'Compris' },
    },
  ]),
  levelStart(8, 'levels.fatigue', 'L\'année bio', [
    {
      id: 'rotate',
      say: () => 'Replanter la même culture donne 30 % de moins. Changez !',
      face: 'content',
      target: (ctx) => {
        const p = plots(ctx).find((x) => x.unlocked);
        return p ? { plot: p.index, label: 'une parcelle' } : UI.field;
      },
      gesture: 'look',
      done: { button: 'Compris' },
    },
  ]),
  {
    id: 'processing',
    chapter: 'levels',
    title: 'Les ateliers',
    modes: ['levels'],
    tier: 'E',
    priority: 70,
    trigger: { on: START, when: (ctx) => invs(ctx).some(isProcessing) },
    acquired: (ctx) => levelKnownIn(ctx, 9) || levelKnownIn(ctx, 10) || levelKnownIn(ctx, 12),
    steps: [
      {
        id: 'tab',
        say: () => 'Un atelier change vos récoltes en produits plus chers. Ouvrez « Acheter ».',
        face: 'content',
        target: () => UI.shop,
        gesture: 'tap',
        done: sheetOpened('shop'),
        buttons: ['later'],
      },
      {
        id: 'card',
        say: () => 'Le voici. Ses produits se vendent tout seuls, le matin.',
        face: 'happy',
        target: (ctx) => {
          const inv = invs(ctx).find(isProcessing);
          return { ui: `#card-${inv?.id || 'jamWorkshop'}`, sheet: 'shop', label: inv?.name || 'l\'atelier' };
        },
        gesture: 'look',
        sheet: 'shop',
        back: 'tab',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'processingBought',
    chapter: 'levels',
    title: 'Votre atelier',
    modes: ['levels'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['purchased'], when: (ctx) => isProcessing(invs(ctx).find((i) => i.id === ctx.ev?.investmentId)) && (ctx.ev?.owned ?? 1) === 1 },
    steps: [
      {
        id: 'open',
        say: () => 'Votre atelier est sur la ferme. Touchez-le pour voir sa fiche.',
        face: 'happy',
        target: (ctx) => {
          const inv = invs(ctx).find((i) => isProcessing(i) && (i.owned || 0) > 0);
          return { scene: { type: 'investment', id: inv?.id || 'jamWorkshop' }, label: inv?.name || 'l\'atelier' };
        },
        gesture: 'tap',
        done: sheetOpened('building'),
        skipIf: (ctx) => ctx.ui?.sheet === 'building',
        buttons: ['later'],
      },
      {
        id: 'switch',
        say: () => 'Interrupteur allumé : les récoltes y vont s\'il reste une place.',
        face: 'content',
        target: () => ({ ui: '#bld-switch', sheet: 'building', label: 'l\'interrupteur Transformer' }),
        gesture: 'look',
        sheet: 'building',
        back: 'open',
        done: { button: 'Suivant' },
      },
      {
        id: 'sell',
        say: () => 'Le produit se vend tout seul le matin.',
        face: 'happy',
        target: () => ({ ui: '#bld-switch', sheet: 'building', label: 'l\'atelier' }),
        gesture: 'look',
        sheet: 'building',
        back: 'open',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'tree',
    chapter: 'levels',
    title: 'Le pommier',
    modes: ['levels', 'career'],
    tier: 'U',
    priority: 40,
    trigger: {
      on: ['sheetOpen'],
      when: (ctx) => ctx.signal?.data?.id === 'seeds' && (safe(ctx, () => ctx.q.plantableCrops(), []) || []).some((c) => c.id === 'apple'),
    },
    acquired: (ctx) => (ctx?.progress?.lifetime?.cropsHarvested?.apple || 0) > 0,
    steps: [
      {
        id: 'apple',
        say: () => 'Le pommier reste toute l\'année : pas d\'eau, pas de gel.',
        face: 'content',
        sheet: 'seeds',
        target: () => ({ ui: '#seed-apple', sheet: 'seeds', label: 'le pommier' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  levelStart(10, 'pollination', 'Les abeilles', [
    {
      id: 'trees',
      say: () => 'Sans abeilles, les pommiers donnent moitié moins.',
      face: 'content',
      target: (ctx) => {
        const t = plots(ctx).filter((p) => p.kind === 'tree').map((p) => p.index).slice(0, 4);
        return t.length ? { plots: t, label: 'les 4 pommiers' } : UI.field;
      },
      gesture: 'look',
      done: { button: 'Suivant' },
    },
    {
      id: 'hive',
      say: () => 'Achetez une ruche, et ils donnent tout !',
      face: 'happy',
      target: () => UI.shop,
      gesture: 'look',
      done: { button: 'Compris' },
    },
  ], { trigger: { on: START, when: (ctx) => levelId(ctx) !== null && !!lvl(ctx)?.modifiers?.pollination } }),
  {
    id: 'goat',
    chapter: 'levels',
    title: 'Les chèvres',
    modes: ['levels'],
    tier: 'U',
    priority: 40,
    trigger: { on: START, when: (ctx) => levelId(ctx) !== null && offered(ctx, 'goat') },
    acquired: (ctx) => (ctx?.progress?.lifetime?.productsSold?.goatCheese || 0) + (ctx?.progress?.lifetime?.productsSold?.goatMilk || 0) > 0,
    steps: [
      {
        id: 'milk',
        say: () => 'La chèvre donne du lait chaque jour. Fromagerie : du fromage !',
        face: 'happy',
        target: () => UI.shop,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  levelStart(11, 'levels.mountain', 'La ferme de montagne', [
    {
      id: 'short',
      say: () => 'Été court, hiver long : pommes de terre et chèvres !',
      face: 'content',
      target: () => UI.date,
      gesture: 'look',
      done: { button: 'Compris' },
    },
  ]),
  levelStart(12, 'contest', 'Le concours', [
    {
      id: 'when',
      say: () => 'Concours le soir du jour 21 : 3 épreuves. Ouvrez le Bilan.',
      face: 'happy',
      target: () => UI.stats,
      gesture: 'tap',
      done: { on: 'sheetOpen', when: (ctx) => ctx.signal?.data?.id === 'stats', button: 'Suivant' },
    },
    {
      id: 'prize',
      say: () => 'Chaque épreuve rapporte 120 pièces.',
      face: 'proud',
      sheet: 'stats',
      target: () => ({ ui: '.contest-goal', sheet: 'stats', label: 'les épreuves du concours' }),
      gesture: 'look',
      back: 'when',
      done: { button: 'Compris' },
    },
  ], { trigger: { on: START, when: (ctx) => levelId(ctx) !== null && !!lvl(ctx)?.contest } }),
  {
    id: 'levels.sprinkler',
    chapter: 'levels',
    title: 'L\'arrosage automatique',
    modes: ['levels'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['purchased'], when: (ctx) => ctx.ev?.investmentId === 'sprinkler' },
    steps: [
      {
        id: 'auto',
        say: () => 'Il arrose tout seul, chaque matin.',
        face: 'happy',
        target: () => ({ scene: { type: 'investment', id: 'sprinkler' }, label: 'l\'arrosage automatique' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'levels.sheep',
    chapter: 'levels',
    title: 'Le mouton',
    modes: ['levels'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['purchased'], when: (ctx) => ctx.ev?.investmentId === 'sheep' && (ctx.ev?.owned ?? 1) === 1 },
    steps: [
      {
        id: 'wool',
        say: () => 'Le mouton se tond tout seul : 3 fois par an.',
        face: 'happy',
        target: () => ({ scene: { type: 'investment', id: 'sheep' }, label: 'l\'enclos des moutons' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'grange',
    chapter: 'levels',
    title: 'Vos étoiles',
    modes: ['levels', 'career'],
    tier: 'U',
    priority: 20,
    where: 'menu',
    trigger: { on: ['menu'], when: (ctx) => onMainMenu(ctx) && safe(ctx, () => perkList(ctx.progress).some((p) => p.canBuy), false) },
    steps: [
      {
        id: 'stars',
        say: () => 'Vos étoiles achètent des bonus, dans la grange.',
        face: 'happy',
        target: () => UI.grange,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'decor',
    chapter: 'levels',
    title: 'Vos écus',
    modes: ['levels', 'career'],
    tier: 'U',
    priority: 20,
    where: 'menu',
    // Une seule leçon du menu à la fois : les écus attendent que celle des étoiles soit vue (ancienne règle de main.js).
    trigger: { on: ['menu'], when: (ctx) => onMainMenu(ctx) && (ctx.progress?.ecus || 0) >= 10 && (ctx.seen?.('grange') || !safe(ctx, () => perkList(ctx.progress).some((p) => p.canBuy), false)) },
    steps: [
      {
        id: 'ecus',
        say: () => 'Vos écus décorent la ferme : Grange, puis Ma ferme.',
        face: 'happy',
        target: () => UI.grange,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'menu.career',
    chapter: 'levels',
    title: 'Une ferme à vous',
    modes: ['levels', 'career'],
    tier: 'U',
    priority: 20,
    where: 'menu',
    trigger: { on: ['menu'], when: (ctx) => onMainMenu(ctx) && levelsWon(ctx) >= 1 && !ctx.progress?.career?.started },
    acquired: (ctx) => !!ctx?.progress?.career?.started || !!ctx?.careerSave,
    steps: [
      {
        id: 'career',
        say: () => 'Envie d\'une ferme à vous, qui grandit ? C\'est ici.',
        face: 'happy',
        target: () => ({ ui: '#menu-career', label: 'Ma ferme' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'menu.achievements',
    chapter: 'levels',
    title: 'Vos succès',
    modes: ['levels', 'career'],
    tier: 'U',
    priority: 20,
    where: 'menu',
    trigger: { on: ['menu'], when: (ctx) => onMainMenu(ctx) && Object.keys(ctx.progress?.achievements || {}).length >= 1 },
    acquired: (ctx) => Object.keys(ctx?.progress?.achievements || {}).length >= 5,
    steps: [
      {
        id: 'grange',
        say: () => 'Vos succès sont rangés dans la grange, avec l\'album.',
        face: 'proud',
        target: () => UI.grange,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
]);

export const REMINDERS = [];
