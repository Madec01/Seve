// Catalogue de l'accompagnement — les premiers pas (deux modes) : leçons basics.*, cours `levels.firstYear` (tutoriel du
// niveau 1) et `career.firstSteps` (début de carrière, 6 carottes mûres), rappels de base (harvest, water, sow,
// money.low, order). PUR : aucun accès au DOM. Format : docs/ARCHITECTURE.md, « Accompagnement — contrats ».
// Textes FALC (docs/ACCOMPAGNEMENT.md § 3 point 4) : ≤ 90 caractères par étape, ≤ 12 mots par phrase.

import { experienced, veteran, careerKnown } from '../acquired.js';

// ── Petits outils (lecture seule de ctx) ─────────────────────────────────────────────────────────
const plotsOf = (ctx) => ctx.safe(() => ctx.q.plots(), []) || [];
const byAction = (ctx, a) => plotsOf(ctx).filter((p) => p.action === a);
const isCareer = (ctx) => ctx.mode === 'career';
/** Le joueur, pas l'équipe ni une machine (niveaux : toujours le joueur). */
const byPlayer = (ev) => !ev || !ev.by || ev.by === 'player';
const tap = (ctx) => (ctx.ui?.touch === false ? 'Cliquez' : 'Touchez');
const raining = (ctx) => ['rain', 'storm'].includes(ctx.state?.weather?.today);
const shopTab = (ctx) => (isCareer(ctx) ? '#tab-buy' : '#tab-shop');
const shopSheet = (ctx) => (isCareer(ctx) ? 'c-shop' : 'shop');

/** Parcelle vide la plus utile à montrer : 1ʳᵉ rangée ouverte, au centre (carrière : champ de départ). */
function emptyPlot(ctx) {
  const open = byAction(ctx, 'plant');
  if (!open.length) return null;
  const cols = ctx.level?.gridCols || 4;
  const mid = (cols - 1) / 2;
  const sorted = open.slice().sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || Math.abs((a.col ?? 0) - mid) - Math.abs((b.col ?? 0) - mid) || a.index - b.index);
  if (isCareer(ctx)) {
    const start = sorted.filter((p) => ctx.state.plots[p.index]?.lot === 'start');
    return (start[0] || sorted[0]).index;
  }
  return sorted[0].index;
}

/** Chemin d'un glissé : parcelles de l'action, dans l'ordre du champ (6 au plus). */
function pathOf(ctx, action, max = 6) {
  return byAction(ctx, action)
    .sort((a, b) => a.index - b.index)
    .slice(0, max)
    .map((p) => p.index);
}

const plotTarget = (i, label) => (i === null || i === undefined ? null : { plot: i, label });
const swipeTarget = (list, label) => (list.length ? (list.length === 1 ? { plot: list[0], label } : { plots: list, label }) : null);

function firstAffordableSeed(ctx) {
  const crops = ctx.safe(() => ctx.q.plantableCrops(), []) || [];
  if (crops.some((c) => c.id === 'carrot' && c.canAfford)) return 'carrot';
  return crops.find((c) => c.canAfford && !c.willFreeze && c.kind !== 'tree')?.id || crops[0]?.id || 'carrot';
}

/** Prochain fermage / charges (niveaux : finance().nextBill ; carrière : projection de la barre du haut). */
const billAmount = (ctx) => ctx.bill?.amount ?? ctx.safe(() => ctx.q.finance().nextBill.amount, 0) ?? 0;

/** Investissement utile et abordable en gardant le prochain fermage (ou les charges). */
function usefulBuy(ctx) {
  const invs = ctx.safe(() => ctx.q.investments(), []) || [];
  const money = ctx.state?.money ?? 0;
  const keep = billAmount(ctx);
  const order = isCareer(ctx) ? ['hen', 'beehive', 'solar'] : ['chickenCoop', 'beehive', 'sheep', 'goat', 'sprinkler'];
  for (const id of order) {
    const inv = invs.find((i) => i.id === id);
    if (inv && inv.canBuy && money - inv.nextCost >= keep) return inv;
  }
  return null;
}
const buyCardSelector = (ctx, id) => (isCareer(ctx) ? `#c-buy-${id}` : `#card-${id} .card-buttons .btn:not(.btn--view)`);

// Poulailler du niveau 1 : seulement si, après l'achat, il reste de quoi payer le fermage (règle de l'ancien tutoriel).
const coopCost = (ctx) => ctx.safe(() => ctx.q.investments().find((i) => i.id === 'chickenCoop')?.nextCost, 70) ?? 70;
const coopTarget = (ctx) => coopCost(ctx) + billAmount(ctx);
const coopReady = (ctx) => (ctx.state?.money ?? 0) >= coopTarget(ctx);

const coopPending = (ctx) => ctx.state?.career?.buildings?.coop?.pending || 0;
const henPrice = (ctx) => ctx.safe(() => ctx.q.investments().find((i) => i.id === 'hen')?.nextCost, 30) ?? 30;
const henCanBuy = (ctx) => !!ctx.safe(() => ctx.q.investments().find((i) => i.id === 'hen')?.canBuy, false);

const anyMature = (ctx) => byAction(ctx, 'harvest').length > 0;
const plantedThisYear = (ctx) => (ctx.state?.stats?.year?.cropsPlanted || 0) > 0;
const shelterGoods = (ctx) => Object.entries(ctx.state?.career?.buildings || {}).filter(([, b]) => (b?.pending || 0) > 0).map(([id]) => id);

// ── Les leçons des premiers pas (§ 7.1) ───────────────────────────────────────────────────────────
const basicsLessons = [
  {
    id: 'basics.harvest',
    chapter: 'basics',
    title: 'Récolter en glissant',
    tier: 'E',
    trigger: { on: ['dawn'], when: (ctx) => anyMature(ctx) && (ctx.day?.abs ?? 0) >= 2 },
    stillRelevant: anyMature,
    acquired: experienced,
    steps: [
      {
        id: 'swipe',
        say: 'Elle est mûre ! Glissez le doigt dessus pour récolter.',
        target: (ctx) => swipeTarget(pathOf(ctx, 'harvest'), 'les cultures mûres'),
        gesture: 'swipe',
        done: { on: 'harvested', when: (ctx) => byPlayer(ctx.ev) },
        skipIf: (ctx) => !anyMature(ctx),
        idle: 'Quand une culture est mûre, glissez dessus.',
      },
      {
        id: 'paid',
        say: 'C\'est payé tout de suite : regardez votre argent.',
        face: 'happy',
        target: { ui: '#hud-money', label: 'votre argent' },
        gesture: 'look',
        done: { button: 'Super !' },
      },
    ],
  },
  {
    id: 'basics.sow',
    chapter: 'basics',
    title: 'Semer',
    tier: 'E',
    trigger: { on: ['dawn'], when: (ctx) => (ctx.day?.abs ?? 0) >= 2 && !plantedThisYear(ctx) && byAction(ctx, 'plant').length >= 1 },
    stillRelevant: (ctx) => byAction(ctx, 'plant').length >= 1,
    acquired: experienced,
    steps: [
      {
        id: 'tap',
        say: (ctx) => `${tap(ctx)} une parcelle vide.`,
        target: (ctx) => plotTarget(emptyPlot(ctx), 'une parcelle vide'),
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => ctx.signal?.data?.id === 'seeds' },
        skipIf: (ctx) => !byAction(ctx, 'plant').length,
      },
      {
        id: 'pick',
        say: 'Choisissez une graine : sa durée et son gain sont écrits.',
        sheet: 'seeds',
        target: (ctx) => ({ ui: `#seed-${firstAffordableSeed(ctx)}`, sheet: 'seeds', label: 'la graine conseillée' }),
        gesture: 'tap',
        done: { on: 'planted', when: (ctx) => byPlayer(ctx.ev) },
        back: 'tap',
      },
    ],
  },
  {
    id: 'basics.water',
    chapter: 'basics',
    title: 'Arroser',
    tier: 'E',
    trigger: { when: (ctx) => (ctx.day?.dayProgress ?? 0) >= 0.5 && byAction(ctx, 'water').length >= 1 && !raining(ctx) },
    stillRelevant: (ctx) => byAction(ctx, 'water').length >= 1,
    acquired: experienced,
    steps: [
      {
        id: 'swipe',
        say: 'Glissez sur ce qui est semé pour arroser.',
        target: (ctx) => swipeTarget(pathOf(ctx, 'water'), 'les cultures à arroser'),
        gesture: 'swipe',
        done: { on: 'watered', when: (ctx) => byPlayer(ctx.ev) },
        skipIf: (ctx) => !byAction(ctx, 'water').length,
        idle: 'Quand une culture a soif, glissez dessus.',
      },
      {
        id: 'drop',
        say: 'La goutte veut dire : à arroser. Chaque matin !',
        target: { field: true, label: 'le champ' },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'basics.time',
    chapter: 'money',
    title: 'Le temps',
    tier: 'E',
    trigger: { on: ['dawn'], when: (ctx) => (ctx.day?.abs ?? 0) >= 2 && !ctx.ui?.speedTouched },
    acquired: experienced,
    steps: [
      {
        id: 'speed',
        say: (ctx) => `${tap(ctx)} ici pour aller plus vite. Appui long : pause.`,
        target: { ui: '#hud-speed', label: 'le bouton de vitesse' },
        gesture: 'tap',
        pause: false,
        done: { on: ['speed', 'dawn'] },
      },
    ],
  },
  {
    id: 'basics.bill',
    chapter: 'money',
    title: 'Le fermage',
    tier: 'E',
    modes: ['levels'],
    trigger: { on: ['start'], when: (ctx) => ctx.mode === 'levels' && !ctx.courseActive },
    acquired: experienced,
    steps: [
      {
        id: 'when',
        say: 'Le dernier soir de la saison, on paie le fermage.',
        target: { ui: '#hud-bill', label: 'le fermage' },
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'sign',
        say: '✓ : payé d\'avance. ! : récoltez encore. ✗ : attention.',
        target: { ui: '#hud-bill', label: 'le signe du fermage' },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'basics.buy',
    chapter: 'money',
    title: 'Acheter',
    tier: 'E',
    trigger: { on: ['harvested', 'dawn'], when: (ctx) => !!usefulBuy(ctx) && !ctx.courseActive },
    stillRelevant: (ctx) => !!usefulBuy(ctx),
    acquired: experienced,
    steps: [
      {
        id: 'tab',
        say: 'Les animaux rapportent chaque matin. Ouvrez « Acheter ».',
        target: (ctx) => ({ ui: shopTab(ctx), label: 'l\'onglet Acheter' }),
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => ctx.signal?.data?.id === shopSheet(ctx) },
        buttons: ['later'],
      },
      {
        id: 'card',
        say: 'Touchez « Acheter » sur cette carte.',
        sheet: shopSheet,
        enter: (ctx, kit) => {
          const inv = usefulBuy(ctx);
          if (!inv) return;
          if (isCareer(ctx)) kit.openSection(inv.id === 'hen' ? 'shop-animals' : 'shop-items');
          else kit.focusInvestment(inv.id);
        },
        target: (ctx) => {
          const inv = usefulBuy(ctx);
          return inv ? { ui: buyCardSelector(ctx, inv.id), sheet: shopSheet(ctx), label: 'la carte conseillée' } : null;
        },
        gesture: 'tap',
        done: { on: 'purchased' },
        back: 'tab',
        buttons: ['later'],
      },
    ],
  },
  {
    id: 'basics.todo',
    chapter: 'basics',
    title: 'La ligne « À faire »',
    tier: 'E',
    trigger: { when: (ctx) => !!ctx.ui?.todoItem && !ctx.courseActive },
    acquired: veteran,
    steps: [
      {
        id: 'line',
        say: (ctx) => `En bas, je note la chose la plus utile. ${tap(ctx)}-la !`,
        target: { ui: '#todo-main', label: 'la ligne À faire' },
        gesture: 'tap',
        done: { on: 'todoGo', button: 'Compris' },
      },
    ],
  },
  {
    id: 'basics.longPress',
    chapter: 'basics',
    title: 'Appui long : la fiche',
    tier: 'U',
    trigger: { on: ['dawn'], when: (ctx) => (ctx.day?.abs ?? 0) >= 3 && !ctx.courseActive },
    acquired: veteran,
    steps: [
      {
        id: 'press',
        say: 'Appui long sur une parcelle ou un bâtiment : sa fiche.',
        target: (ctx) => plotTarget(plotsOf(ctx).find((p) => p.cropId)?.index ?? emptyPlot(ctx) ?? 0, 'une parcelle'),
        gesture: 'press',
        done: { on: 'longPress', button: 'Compris' },
      },
    ],
  },
  {
    id: 'basics.sowAll',
    chapter: 'basics',
    title: 'Semer partout',
    tier: 'U',
    where: 'sheet:seeds',
    trigger: { on: ['sheetOpen'], when: (ctx) => ctx.signal?.data?.id === 'seeds' && byAction(ctx, 'plant').length >= 4 && (ctx.seen('basics.sow') || ctx.seen('levels.firstYear') || ctx.seen('career.firstSteps')) },
    acquired: veteran,
    steps: [
      {
        id: 'toggle',
        say: '« Semer partout » remplit tout le champ d\'un coup.',
        sheet: 'seeds',
        target: { ui: '#seed-all', sheet: 'seeds', label: 'Semer partout' },
        gesture: 'tap',
        done: { on: 'sowAll', button: 'Compris' },
      },
    ],
  },
  {
    id: 'basics.zoom',
    chapter: 'basics',
    title: 'Voir toute la ferme',
    tier: 'U',
    modes: ['career'],
    trigger: { on: ['lotBought'] },
    acquired: (actx) => (actx?.careerSave?.year || 0) >= 2,
    steps: [
      {
        id: 'pinch',
        say: 'Pincez avec deux doigts pour voir toute la ferme.',
        target: { center: true, label: 'la ferme' },
        gesture: 'pinch',
        done: { on: 'zoom', button: 'Compris' },
      },
      {
        id: 'buttons',
        say: 'Ou touchez + et − au bord de l\'écran.',
        target: { ui: '#zoom-controls', label: 'les boutons de zoom' },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'basics.messages',
    chapter: 'basics',
    title: 'Les nouvelles',
    tier: 'U',
    trigger: { when: (ctx) => (ctx.ui?.unread || 0) >= 3 && !ctx.courseActive },
    acquired: veteran,
    steps: [
      {
        id: 'bell',
        say: 'Les nouvelles attendent ici, sous la cloche.',
        target: { ui: '#todo-bell', label: 'la cloche des messages' },
        gesture: 'tap',
        done: { on: 'messagesOpen', button: 'Compris' },
      },
    ],
  },
  {
    id: 'basics.weather',
    chapter: 'money',
    title: 'La pluie',
    tier: 'U',
    trigger: { on: ['dawn'], when: (ctx) => ['rain', 'storm'].includes(ctx.state?.weather?.tomorrow) && !ctx.courseActive },
    acquired: veteran,
    steps: [
      {
        id: 'rain',
        say: 'Demain, il pleut : la pluie arrosera pour vous.',
        target: { ui: '#hud-weather', label: 'la météo' },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'basics.frost',
    chapter: 'money',
    title: 'Le gel',
    tier: 'E',
    priority: 90,
    urgent: true, // danger réel : passe même pendant l'attente d'un cours (allowedDuringCourse)
    trigger: { on: ['seasonWarning'], when: (ctx) => !!ctx.ev?.frost },
    acquired: (actx) => veteran(actx),
    steps: [
      {
        id: 'field',
        say: 'L\'hiver arrive dans 2 jours : le gel tue les cultures fragiles.',
        target: { field: true, label: 'le champ' },
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'hardy',
        say: (ctx) => (ctx.mode === 'levels' ? 'Récoltez avant. Le fermage d\'hiver est le plus cher.' : 'Récoltez avant. Navet et chou tiennent le froid.'),
        target: { ui: '#hud-bill', label: 'le fermage' },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'basics.carnet',
    chapter: 'basics',
    title: 'Le carnet de Joseph',
    tier: 'E',
    trigger: { on: ['lessonEnd'], when: (ctx) => !ctx.courseActive },
    steps: [
      {
        id: 'carnet',
        say: 'Tout ce que je vous montre est dans mon carnet.',
        target: (ctx) => ({ ui: isCareer(ctx) ? '#tab-journal' : '#tab-menu', label: isCareer(ctx) ? 'l\'onglet Carnet' : 'l\'onglet Menu' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    // Ancien conseil « Tout ramasser » (même identifiant : déjà vu = vu), rangé dans les premiers pas.
    id: 'career.collectAll',
    chapter: 'basics',
    title: 'Tout ramasser',
    tier: 'U',
    modes: ['career'],
    trigger: { on: ['dawn', 'collected'], when: (ctx) => shelterGoods(ctx).length >= 2 && !ctx.courseActive },
    stillRelevant: (ctx) => shelterGoods(ctx).length >= 2,
    acquired: veteran,
    steps: [
      {
        id: 'button',
        say: 'Plusieurs abris attendent : « Tout ramasser » les vide d\'un coup.',
        target: { ui: '#todo-collect', label: 'Tout ramasser' },
        gesture: 'tap',
        done: { on: 'collected', button: 'Compris' },
      },
      {
        id: 'swipe',
        say: 'Ou glissez le doigt d\'un abri à l\'autre.',
        target: (ctx) => {
          const g = shelterGoods(ctx);
          return g.length ? { scene: { type: 'shelter', buildingId: g[0] }, label: 'un abri' } : { field: true, label: 'la ferme' };
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
];

// ── Cours du niveau 1 (§ 6) ───────────────────────────────────────────────────────────────────────
const firstYear = {
  id: 'levels.firstYear',
  chapter: 'levels',
  title: 'Votre première année',
  course: true,
  resume: 'tutorial',
  modes: ['levels'],
  trigger: { on: ['start'], when: (ctx) => ctx.mode === 'levels' && !!ctx.level?.tutorial && !ctx.resumed },
  acquired: (actx) => !!actx?.tutorialDone,
  lessons: ['basics.sow', 'basics.water', 'basics.time', 'basics.harvest', 'basics.bill', 'basics.buy', 'basics.todo', 'basics.longPress'],
  steps: [
    {
      id: 'welcome',
      say: 'Un an pour faire vivre la ferme ! Je vous montre ?',
      face: 'happy',
      target: null,
      done: { button: 'C\'est parti !' },
      buttons: ['know'],
    },
    {
      id: 'sowTap',
      say: (ctx) => `${tap(ctx)} une parcelle vide.`,
      target: (ctx) => plotTarget(ctx.mem.plot ?? (ctx.mem.plot = emptyPlot(ctx)), 'une parcelle vide'),
      gesture: 'tap',
      done: { on: 'sheetOpen', when: (ctx) => ctx.signal?.data?.id === 'seeds' },
      skipIf: (ctx) => plantedThisYear(ctx),
    },
    {
      id: 'sowPick',
      say: 'Prenez la carotte : pas chère, mûre en 2 jours.',
      sheet: 'seeds',
      target: { ui: '#seed-carrot', sheet: 'seeds', label: 'la carotte' },
      gesture: 'tap',
      done: {
        on: 'planted',
        when: (ctx) => {
          ctx.mem.plot = ctx.ev.plotIndex;
          return true;
        },
      },
      skipIf: (ctx) => plantedThisYear(ctx),
      back: 'sowTap',
      lesson: 'basics.sow',
    },
    {
      id: 'water',
      say: 'Glissez sur la carotte pour l\'arroser. Chaque matin !',
      target: (ctx) => swipeTarget(pathOf(ctx, 'water'), 'la carotte à arroser'),
      gesture: 'swipe',
      done: { on: 'watered' },
      skipIf: (ctx) => !byAction(ctx, 'water').length,
      skipNote: (ctx) => (raining(ctx) ? 'Il pleut : la pluie arrose pour vous !' : null),
      lesson: 'basics.water',
    },
    {
      id: 'time',
      say: (ctx) => `${tap(ctx)} ici pour aller plus vite. Appui long : pause.`,
      target: { ui: '#hud-speed', label: 'le bouton de vitesse' },
      gesture: 'tap',
      pause: false,
      done: { on: ['speed', 'dawn'], when: (ctx) => ctx.ev?.type === 'dawn' || (ctx.signal?.data?.speed || 0) >= 2 },
      lesson: 'basics.time',
    },
    {
      id: 'wait',
      say: (ctx) => (byAction(ctx, 'water').length ? 'Nouveau jour : arrosez la carotte.' : 'Arrosez chaque matin, puis récoltez.'),
      target: (ctx) => plotTarget(ctx.mem.plot ?? plotsOf(ctx).find((p) => p.cropId)?.index, 'la carotte'),
      gesture: 'look',
      pill: true,
      pause: false,
      done: { state: anyMature },
      skipIf: (ctx) => anyMature(ctx) || !plotsOf(ctx).some((p) => p.cropId),
    },
    {
      id: 'harvest',
      say: 'Elle est mûre ! Glissez dessus pour la récolter.',
      face: 'happy',
      target: (ctx) => swipeTarget(pathOf(ctx, 'harvest'), 'les cultures mûres'),
      gesture: 'swipe',
      done: { on: 'harvested' },
      skipIf: (ctx) => !anyMature(ctx),
      lesson: 'basics.harvest',
    },
    {
      id: 'bill',
      say: 'Le dernier soir, on paie le fermage : le loyer de la ferme.',
      target: { ui: '#hud-bill', label: 'le fermage' },
      gesture: 'look',
      done: { button: 'Suivant' },
    },
    {
      id: 'billSign',
      say: (ctx) => (ctx.state?.neighbourLoan ? '✓ : c\'est payé d\'avance. ! : récoltez encore. Sinon, je vous aide.' : '✓ : c\'est payé d\'avance. ! : récoltez encore.'),
      target: { ui: '#hud-bill', label: 'le signe du fermage' },
      gesture: 'look',
      done: { button: 'Compris' },
      lesson: 'basics.bill',
    },
    {
      id: 'coopTab',
      say: 'Un poulailler rapporte chaque matin. Ouvrez « Acheter ».',
      wait: { until: coopReady, say: (ctx) => `Récoltez jusqu'à ${coopTarget(ctx)} pièces, puis achetez un poulailler.` },
      target: { ui: '#tab-shop', label: 'l\'onglet Acheter' },
      gesture: 'tap',
      pause: false,
      done: { on: 'sheetOpen', when: (ctx) => ctx.signal?.data?.id === 'shop' },
      skipIf: (ctx) => (ctx.state?.investments?.chickenCoop || 0) > 0,
      buttons: ['later'],
      laterTo: 'todo',
    },
    {
      id: 'coopBuy',
      say: (ctx) => `${tap(ctx)} « Acheter » !`,
      sheet: 'shop',
      enter: (ctx, kit) => kit.focusInvestment('chickenCoop'),
      target: { ui: '#card-chickenCoop .card-buttons .btn:not(.btn--view)', sheet: 'shop', label: 'le bouton Acheter du poulailler' },
      gesture: 'tap',
      pause: false,
      done: { on: 'purchased' },
      skipIf: (ctx) => (ctx.state?.investments?.chickenCoop || 0) > 0,
      back: 'coopTab',
      buttons: ['later'],
      laterTo: 'todo',
      lesson: 'basics.buy',
    },
    {
      id: 'todo',
      say: 'En bas, je note la chose la plus utile.',
      enter: (ctx, kit) => kit.closeSheet?.(),
      target: { ui: '#todo-main', label: 'la ligne À faire' },
      gesture: 'look',
      done: { button: 'Compris' },
      lesson: 'basics.todo',
    },
    {
      id: 'end',
      say: 'À vous ! Appui long sur une parcelle : sa fiche. Tout est dans mon carnet.',
      face: 'proud',
      target: (ctx) => plotTarget(plotsOf(ctx).find((p) => p.cropId)?.index ?? emptyPlot(ctx) ?? 0, 'une parcelle'),
      gesture: 'press',
      done: { button: 'Merci !' },
      lesson: 'basics.longPress',
    },
  ],
};

// ── Cours de début de carrière (§ 5) ──────────────────────────────────────────────────────────────
const firstSteps = {
  id: 'career.firstSteps',
  chapter: 'career',
  title: 'Les premiers pas de la ferme',
  course: true,
  resume: 'firstSteps',
  modes: ['career'],
  trigger: { on: ['start'], when: (ctx) => ctx.mode === 'career' && !!ctx.firstSteps },
  acquired: careerKnown,
  lessons: ['basics.harvest', 'basics.sow', 'basics.water', 'basics.time', 'career.collect', 'basics.buy', 'basics.carnet'],
  steps: [
    {
      id: 'harvest',
      say: 'Bienvenue ! Vos carottes sont mûres. Glissez le doigt dessus.',
      face: 'happy',
      target: (ctx) => swipeTarget(pathOf(ctx, 'harvest'), 'la rangée de carottes mûres'),
      gesture: 'swipe',
      done: {
        on: 'harvested',
        when: (ctx) => {
          if (!byPlayer(ctx.ev)) return false;
          ctx.mem.earned = (ctx.mem.earned || 0) + (ctx.ev.amount || 0);
          ctx.mem.harvests = (ctx.mem.harvests || 0) + 1;
          return true;
        },
      },
      settle: 400, // un glissé envoie plusieurs récoltes : l'étape attend la fin du geste
      skipIf: (ctx) => !anyMature(ctx),
      buttons: ['know'],
      lesson: 'basics.harvest',
    },
    {
      id: 'harvestSwipe',
      say: 'Sans lever le doigt, tout vient d\'un coup !',
      target: (ctx) => swipeTarget(pathOf(ctx, 'harvest'), 'les carottes qui restent'),
      gesture: 'swipe',
      done: {
        on: 'harvested',
        when: (ctx) => {
          if (!byPlayer(ctx.ev)) return false;
          ctx.mem.earned = (ctx.mem.earned || 0) + (ctx.ev.amount || 0);
          ctx.mem.more = (ctx.mem.more || 0) + 1;
          return ctx.mem.more >= 2 || !anyMature(ctx);
        },
        state: (ctx) => !anyMature(ctx),
      },
      settle: 400,
      skipIf: (ctx) => !anyMature(ctx) || ctx.expert,
    },
    {
      id: 'paid',
      say: (ctx) => `+${Math.round(ctx.mem.earned || 45)} ! Chaque récolte est payée tout de suite.`,
      face: 'happy',
      target: { ui: '#hud-money', label: 'votre argent' },
      gesture: 'look',
      done: { button: 'Super !' },
      skipIf: (ctx) => ctx.expert,
    },
    {
      id: 'sowTap',
      say: (ctx) => `${tap(ctx)} une parcelle vide pour semer.`,
      target: (ctx) => plotTarget(emptyPlot(ctx), 'une parcelle vide'),
      gesture: 'tap',
      done: { on: 'sheetOpen', when: (ctx) => ctx.signal?.data?.id === 'seeds' },
      skipIf: (ctx) => ctx.expert || plantedThisYear(ctx) || !byAction(ctx, 'plant').length,
    },
    {
      id: 'sowPick',
      say: 'Prenez la carotte : mûre en 2 jours.',
      sheet: 'seeds',
      target: { ui: '#seed-carrot', sheet: 'seeds', label: 'la carotte' },
      gesture: 'tap',
      done: { on: 'planted', when: (ctx) => byPlayer(ctx.ev) },
      skipIf: (ctx) => ctx.expert || plantedThisYear(ctx),
      back: 'sowTap',
      lesson: 'basics.sow',
    },
    {
      id: 'water',
      say: 'Glissez sur ce qui est semé pour l\'arroser.',
      target: (ctx) => swipeTarget(pathOf(ctx, 'water'), 'les parcelles semées'),
      gesture: 'swipe',
      done: { on: 'watered', when: (ctx) => byPlayer(ctx.ev) },
      skipIf: (ctx) => ctx.expert || !byAction(ctx, 'water').length,
      skipNote: (ctx) => (!ctx.expert && raining(ctx) ? 'Il pleut : la pluie arrose pour vous !' : null),
      lesson: 'basics.water',
    },
    {
      id: 'time',
      say: (ctx) => `Le temps avance tout seul. ${tap(ctx)} ici pour aller plus vite.`,
      target: { ui: '#hud-speed', label: 'le bouton de vitesse' },
      gesture: 'tap',
      pause: false,
      done: { on: ['speed', 'dawn'], when: (ctx) => ctx.ev?.type === 'dawn' || (ctx.signal?.data?.speed || 0) >= 2 },
      skipIf: (ctx) => ctx.expert,
      lesson: 'basics.time',
    },
    {
      id: 'eggs',
      say: (ctx) => `Bonjour ! Les poules ont pondu. ${tap(ctx)} le poulailler.`,
      face: 'happy',
      wait: { until: (ctx) => coopPending(ctx) > 0, say: 'Demain matin : les œufs !' },
      target: { scene: { type: 'shelter', buildingId: 'coop' }, label: 'le poulailler' },
      gesture: 'tap',
      done: { on: 'collected', when: (ctx) => byPlayer(ctx.ev) },
      skipIf: (ctx) => !ctx.state?.career?.buildings?.coop,
      lesson: 'career.collect',
    },
    {
      id: 'buyTab',
      say: 'Une poule de plus ? Ouvrez « Acheter ».',
      target: { ui: '#tab-buy', label: 'l\'onglet Acheter' },
      gesture: 'tap',
      done: { on: 'sheetOpen', when: (ctx) => ctx.signal?.data?.id === 'c-shop' },
      skipIf: (ctx) => !henCanBuy(ctx),
      buttons: ['later'],
      laterTo: 'end',
    },
    {
      id: 'buyHen',
      say: (ctx) => `${tap(ctx)} « Acheter » sous la poule : ${henPrice(ctx)} pièces.`,
      sheet: 'c-shop',
      enter: (ctx, kit) => kit.openSection('shop-animals'),
      target: { ui: '#c-buy-hen', sheet: 'c-shop', label: 'la poule' },
      gesture: 'tap',
      done: { on: 'purchased', when: (ctx) => ctx.ev?.investmentId === 'hen' },
      skipIf: (ctx) => !henCanBuy(ctx),
      back: 'buyTab',
      lesson: 'basics.buy',
    },
    {
      id: 'end',
      say: 'Bravo ! Le reste, je vous le montre en chemin. Tout est dans mon carnet.',
      enter: (ctx, kit) => kit.closeSheet?.(),
      face: 'proud',
      target: { ui: '#tab-journal', label: 'l\'onglet Carnet' },
      gesture: 'look',
      done: { button: 'Merci, Joseph !' },
      lesson: 'basics.carnet',
    },
  ],
};

export const LESSONS = [firstYear, firstSteps, ...basicsLessons];

// ── Rappels de base (§ 8.4) ──────────────────────────────────────────────────────────────────────
function lowMoneyText(ctx) {
  const p = ctx.bill;
  if (!p || p.state === 'ok' || !(p.daysLeft >= 1 && p.daysLeft <= 3)) return null;
  if (p.state === 'warn' && (p.projected ?? 0) - (p.amount ?? 0) > 15) return null; // les récoltes prévues suffiront
  const mature = byAction(ctx, 'harvest').length;
  const empty = byAction(ctx, 'plant').length;
  let text;
  if (mature) text = 'Des cultures sont mûres : récoltez-les, c\'est payé tout de suite.';
  else if (empty) text = 'Des parcelles sont vides : semez des cultures rapides.';
  else text = 'Arrosez vos cultures : elles seront mûres plus tôt.';
  if (p.state === 'loan') text += ' Et je peux vous avancer le reste.';
  return text;
}

export const REMINDERS = [
  {
    id: 'harvest',
    chapter: 'basics',
    title: 'Récoltes mûres',
    example: 'Vos récoltes sont mûres, quand vous voulez.',
    when: (ctx) => (byAction(ctx, 'harvest').filter((p) => !p.waiting).length >= 3 ? { text: 'Vos récoltes sont mûres, quand vous voulez.' } : null),
    wait: 1,
    todo: 'harvest',
  },
  {
    id: 'water',
    chapter: 'basics',
    title: 'Arrosage',
    example: 'Un peu d\'eau ? Elles pousseront plus vite.',
    when: (ctx) => (byAction(ctx, 'water').length >= 3 && (ctx.day?.dayProgress ?? 0) > 0.5 && !raining(ctx) ? { text: 'Un peu d\'eau ? Elles pousseront plus vite.' } : null),
    wait: 0,
    todo: 'water',
  },
  {
    id: 'sow',
    chapter: 'basics',
    title: 'Parcelles vides',
    example: 'Des parcelles se reposent. On sème ?',
    when: (ctx) => {
      if (byAction(ctx, 'plant').length < 4) return null;
      const crops = ctx.safe(() => ctx.q.plantableCrops(), []) || [];
      return crops.some((c) => c.canAfford && !c.willFreeze && c.kind !== 'tree') ? { text: 'Des parcelles se reposent. On sème ?' } : null;
    },
    wait: 2,
    todo: 'plant',
  },
  {
    id: 'money.low',
    chapter: 'money',
    title: 'Fermage et charges',
    example: 'Des cultures sont mûres : récoltez-les, c\'est payé tout de suite.',
    when: (ctx) => {
      const text = lowMoneyText(ctx);
      return text ? { text } : null;
    },
    wait: 0,
    oncePerSeason: true,
    safety: true,
    todo: 'rent',
  },
  {
    id: 'order',
    chapter: 'village',
    title: 'Commandes prêtes',
    example: 'La commande de Lili est prête à livrer.',
    when: (ctx) => {
      const v = ctx.safe(() => ctx.q.variety?.(), null);
      const slots = (v?.board?.slots || []).filter((s) => s && !s.empty && s.canDeliver);
      return slots.length ? { text: `La commande de ${slots[0].clientName || 'votre voisin'} est prête à livrer.` } : null;
    },
    wait: 1,
    todo: 'v-deliver',
  },
];
