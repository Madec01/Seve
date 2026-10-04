// Catalogue des lots 2 à 4 de l'accompagnement (docs/ACCOMPAGNEMENT.md §§ 7.4 à 7.6) : surprises (qualité, géants,
// surprises de l'aube, cueillette, météos spéciales, vœu), le village (tableau, cadeau, défis, charrette, Basile,
// graines rares, années à thème), fêtes, hiver et album ; rappels des lots (§ 8.4 : cart, cards, challenges, merchant,
// fete, winter, veillee, album). Paquet LEÇONS lots. PUR : aucun accès au DOM ; tout passe par `ctx`.
//
// Rien ne se déclenche sans la partie du jeu concernée (state.surprises, state.variety, state.cozy) : en Classique
// (sans ces lots), aucune de ces leçons ni aucun de ces rappels.
//
// Identifiants des anciens conseils repris tels quels (« déjà vu » reste vu) : variety.board, variety.cart,
// variety.cards, variety.challenges, variety.merchant, variety.rare, career.theme, cozy.album, cozy.fete, cozy.winter,
// cozy.lanterns, cozy.helpers, cozy.seedFair.

import { albumOverview } from '../../../core/album.js';

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
const q = (ctx, name, fallback = null, ...args) => safe(ctx, () => (typeof ctx.q?.[name] === 'function' ? ctx.q[name](...args) : undefined), fallback);
const S = (ctx) => ctx?.state || {};
const isPlayer = (ctx) => !ctx.ev?.by || ctx.ev.by === 'player';
const sheetOpened = (...ids) => ({ on: 'sheetOpen', when: (ctx) => ids.includes(ctx.signal?.data?.id) });
const plots = (ctx) => q(ctx, 'plots', []) || [];
const dayProgress = (ctx) => ctx.day?.dayProgress ?? S(ctx).time?.dayProgress ?? 0;
const absDay = (ctx) => ctx?.day?.abs ?? S(ctx).time?.day ?? 0;

const surprisesOn = (ctx) => !!S(ctx).surprises;
const varietyOn = (ctx) => !!S(ctx).variety;
const cozyOn = (ctx) => !!S(ctx).cozy;

/** Progression (lecture) : album, compteurs. Le contexte de déduction (`actx`) a aussi `progress`. */
const album = (ctx) => ctx?.progress?.album || {};
const albumFound = (ctx) => Object.keys(album(ctx).found || {});
const albumHas = (ctx, re) => albumFound(ctx).some((k) => re.test(k));
const albumStamp = (ctx, stamp) => JSON.stringify(album(ctx).stamps || {}).includes(`"${stamp}"`);
const lifetime = (ctx) => ctx?.progress?.lifetime || {};
function claimable(ctx) {
  return safe(ctx, () => albumOverview(ctx.progress)?.claimable || 0, 0) || 0;
}

const UI = {
  bell: { ui: '#todo-bell', label: 'la cloche des messages' },
  todo: { ui: '#todo-main', label: 'la ligne « À faire »' },
  weather: { ui: '#hud-weather', label: 'la météo du jour' },
  menu: { ui: '#tab-menu', label: 'l\'onglet Menu' },
  journal: { ui: '#tab-journal', label: 'l\'onglet Carnet' },
  field: { field: true, label: 'le champ' },
};

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

// ── Lot 2 : surprises ────────────────────────────────────────────────────────────────────────

const giantPlot = (ctx) => plots(ctx).find((p) => p.giant && p.giant.isAnchor && p.action === 'harvest') || plots(ctx).find((p) => p.giant) || null;
const foragePlots = (ctx) => plots(ctx).filter((p) => p.forage && !p.cropId).map((p) => p.index);

const surpriseLessons = [
  {
    id: 'surprise.quality',
    chapter: 'surprises',
    title: 'Belles et dorées',
    tier: 'U',
    priority: 40,
    trigger: { on: ['harvested'], when: (ctx) => surprisesOn(ctx) && isPlayer(ctx) && ['fine', 'gold'].includes(ctx.ev?.quality) },
    acquired: (ctx) => albumStamp(ctx, 'gold') || Object.keys(S(ctx).surprises?.stats?.fine || {}).length > 1,
    steps: [
      {
        id: 'fine',
        say: () => 'Une belle récolte ! Arrosez bien : il y en aura plus.',
        face: 'happy',
        target: (ctx) => (Number.isInteger(ctx.ev?.plotIndex) ? { plot: ctx.ev.plotIndex, label: 'la parcelle récoltée' } : UI.field),
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'chances',
        say: () => 'Appui long sur une culture : sa fiche montre vos chances.',
        face: 'content',
        target: (ctx) => {
          const p = plots(ctx).find((x) => x.cropId && x.kind === 'crop');
          return p ? { plot: p.index, label: 'une culture' } : UI.field;
        },
        gesture: 'press',
        done: { on: 'sheetShown', when: (ctx) => ctx.signal?.data?.by === 'press', button: 'Compris' },
      },
    ],
  },
  {
    id: 'surprise.giant',
    chapter: 'surprises',
    title: 'Un légume géant',
    tier: 'E',
    priority: 70,
    trigger: { on: ['giant'], when: surprisesOn },
    stillRelevant: (ctx) => !!giantPlot(ctx),
    acquired: (ctx) => albumStamp(ctx, 'giant'),
    steps: [
      {
        id: 'harvest',
        say: () => 'Un légume géant ! Il vaut gros. Récoltez-le à la main.',
        face: 'happy',
        target: (ctx) => {
          const p = giantPlot(ctx);
          return p ? { plot: p.giant?.anchor ?? p.index, label: 'le légume géant' } : UI.field;
        },
        gesture: 'tap',
        done: { on: 'giantHarvested', when: isPlayer },
        skipIf: (ctx) => !giantPlot(ctx),
        buttons: ['later'],
      },
    ],
  },
  {
    id: 'surprise.dawn',
    chapter: 'surprises',
    title: 'Les surprises du matin',
    tier: 'U',
    priority: 40,
    trigger: { on: ['surprise'], when: (ctx) => surprisesOn(ctx) && ctx.ev?.kind !== 'ring' },
    acquired: (ctx) => albumHas(ctx, /\.(fairy|chest|fox|hedgehog|owl)$/),
    steps: [
      {
        id: 'news',
        say: () => 'Une surprise ce matin ! Elles sont rares, et toujours bonnes.',
        face: 'happy',
        target: () => UI.bell,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'surprise.forage',
    chapter: 'surprises',
    title: 'La cueillette',
    tier: 'E',
    priority: 70,
    trigger: { on: ['forage'], when: (ctx) => surprisesOn(ctx) && foragePlots(ctx).length > 0 },
    stillRelevant: (ctx) => foragePlots(ctx).length > 0,
    acquired: (ctx) => albumHas(ctx, /\.(ring|mushroom|mushrooms|fog)$/) || (S(ctx).surprises?.stats?.forage || 0) > 0,
    steps: [
      {
        id: 'pick',
        say: () => 'Des champignons ! Touchez-les pour les cueillir.',
        face: 'happy',
        target: (ctx) => {
          const list = foragePlots(ctx);
          return list.length ? { plot: list[0], label: 'les champignons' } : UI.field;
        },
        gesture: 'tap',
        done: { on: 'foragePicked', when: isPlayer },
        skipIf: (ctx) => !foragePlots(ctx).length,
      },
    ],
  },
  {
    id: 'weather.special',
    chapter: 'surprises',
    title: 'Les temps spéciaux',
    tier: 'U',
    priority: 40,
    trigger: { on: ['specialWeather'], when: (ctx) => surprisesOn(ctx) && !['goldenhour', 'shootingstar'].includes(ctx.ev?.id) },
    acquired: (ctx) => albumHas(ctx, /^sky\.(warmrain|fog|rainbow)$/),
    steps: [
      {
        id: 'sky',
        say: () => 'Un temps spécial aujourd\'hui ! Touchez la météo : son effet est écrit.',
        face: 'happy',
        target: () => UI.weather,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'weather.golden',
    chapter: 'surprises',
    title: 'L\'heure dorée',
    tier: 'U',
    priority: 40,
    trigger: { on: ['specialWeather'], when: (ctx) => surprisesOn(ctx) && ctx.ev?.id === 'goldenhour' },
    acquired: (ctx) => albumHas(ctx, /^sky\.goldenhour$/),
    steps: [
      {
        id: 'gold',
        say: () => 'Heure dorée : tout se vend 20 % plus cher aujourd\'hui.',
        face: 'happy',
        target: () => UI.weather,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'weather.wish',
    chapter: 'surprises',
    title: 'Le vœu',
    tier: 'E',
    priority: 70,
    where: 'dialog:wish',
    trigger: { on: ['dialogOpen'], when: (ctx) => surprisesOn(ctx) && ctx.signal?.data?.id === 'wish' },
    acquired: (ctx) => albumHas(ctx, /\.(wish|shootingstar)$/) || (S(ctx).surprises?.stats?.wishes || 0) > 0,
    steps: [
      {
        id: 'pick',
        say: () => 'Des étoiles filantes cette nuit ! Choisissez un vœu.',
        face: 'happy',
        target: () => ({ ui: '.wish-choices button', label: 'les vœux' }),
        gesture: 'look',
        done: { on: 'wishGranted', button: 'Compris' },
      },
    ],
  },
];

// ── Lot 3 : le village ───────────────────────────────────────────────────────────────────────

const orders = (ctx) => (q(ctx, 'orders', null)?.slots || []).filter((o) => o && !o.empty && o.id);
const cardsOffer = (ctx) => q(ctx, 'cards', null)?.offer || null;
const challengesOpen = (ctx) => {
  const ch = q(ctx, 'challenges', null);
  if (!ch) return null;
  if (ch.next?.options?.length && !(ch.next.kept || []).length) return ch.next;
  if (ch.options?.length && !(ch.kept || []).length) return ch;
  return null;
};
const cart = (ctx) => q(ctx, 'cart', null);
const merchant = (ctx) => q(ctx, 'merchant', null);
const themeVisitor = (ctx) => (safe(ctx, () => ctx.q.career.events().offers, []) || []).find((o) => o.kind === 'themeVisitor' && !o.accepted) || null;

const villageLessons = [
  {
    id: 'variety.board',
    chapter: 'village',
    title: 'Le tableau du village',
    tier: 'E',
    priority: 70,
    trigger: { on: ['ordersRenewed', 'dawn'], when: (ctx) => varietyOn(ctx) && orders(ctx).length > 0 },
    stillRelevant: (ctx) => orders(ctx).length > 0,
    acquired: (ctx) => (lifetime(ctx).variety?.orders || 0) > 0,
    steps: [
      {
        id: 'board',
        say: () => 'Le tableau du village : des voisins demandent des récoltes. Touchez-le !',
        face: 'happy',
        target: () => ({ scene: { type: 'villageBoard' }, label: 'le tableau du village' }),
        gesture: 'tap',
        done: sheetOpened('v-board'),
        skipIf: (ctx) => ctx.ui?.sheet === 'v-board',
        buttons: ['later'],
      },
      {
        id: 'keep',
        say: () => 'Gardez une commande avec la punaise. Refuser ne coûte rien.',
        face: 'content',
        target: (ctx) => {
          const o = orders(ctx)[0];
          return { ui: o ? `#v-keep-${o.id}` : '#v-reroll', sheet: 'v-board', label: 'la punaise d\'une commande' };
        },
        gesture: 'look',
        sheet: 'v-board',
        back: 'board',
        done: { button: 'Compris' },
      },
    ],
    reminders: ['order'],
  },
  {
    id: 'variety.cards',
    chapter: 'village',
    title: 'Le cadeau de la saison',
    tier: 'E',
    priority: 70,
    where: 'dialog',
    trigger: { on: ['dialogOpen', 'sheetOpen'], when: (ctx) => varietyOn(ctx) && !!cardsOffer(ctx) && ['season-end', 'v-season', 'v-cards'].includes(ctx.signal?.data?.id) },
    stillRelevant: (ctx) => !!cardsOffer(ctx),
    acquired: (ctx) => (S(ctx).variety?.cards?.active || []).length > 0,
    steps: [
      {
        id: 'pick',
        say: () => 'Deux cadeaux : gardez celui qui vous plaît. Rien ne presse.',
        face: 'happy',
        target: () => ({ ui: '.v-cards', label: 'les deux cartes' }),
        gesture: 'look',
        done: { on: 'cardPicked', button: 'Compris' },
        buttons: ['later'],
      },
    ],
    reminders: ['cards'],
  },
  {
    id: 'variety.challenges',
    chapter: 'village',
    title: 'Les défis de la saison',
    tier: 'U',
    priority: 40,
    where: 'dialog',
    trigger: { on: ['dialogOpen', 'sheetOpen'], when: (ctx) => varietyOn(ctx) && !!challengesOpen(ctx) && ['season-end', 'v-season', 'v-challenges'].includes(ctx.signal?.data?.id) },
    acquired: (ctx) => Object.values(lifetime(ctx).variety?.medals || {}).some((n) => n > 0),
    steps: [
      {
        id: 'keep',
        say: () => 'Gardez un ou deux défis : chaque palier donne une médaille.',
        face: 'content',
        target: () => ({ ui: '.v-challenges', label: 'les défis' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
    reminders: ['challenges'],
  },
  {
    id: 'variety.cart',
    chapter: 'village',
    title: 'La charrette du marché',
    tier: 'E',
    priority: 70,
    trigger: { on: ['cartArrived', 'dawn'], when: (ctx) => varietyOn(ctx) && !!cart(ctx) },
    stillRelevant: (ctx) => !!cart(ctx),
    acquired: (ctx) => (lifetime(ctx).variety?.cartsFull || 0) > 0 || albumHas(ctx, /\.cart$/),
    steps: [
      {
        id: 'cart',
        say: () => 'La charrette veut des caisses de récoltes, d\'ici la fin de saison.',
        face: 'happy',
        target: () => ({ scene: { type: 'cart' }, label: 'la charrette du marché' }),
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => ctx.signal?.data?.id === 'v-cart', button: 'Suivant' },
      },
      {
        id: 'half',
        say: () => 'Même à moitié pleine, elle paie.',
        face: 'content',
        target: (ctx) => (ctx.ui?.sheet === 'v-cart' ? { ui: '#v-crate-0', sheet: 'v-cart', label: 'une caisse' } : { scene: { type: 'cart' }, label: 'la charrette' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
    reminders: ['cart'],
  },
  {
    id: 'variety.merchant',
    chapter: 'village',
    title: 'Basile le colporteur',
    tier: 'U',
    priority: 40,
    trigger: { on: ['merchantArrived', 'dawn'], when: (ctx) => varietyOn(ctx) && !!merchant(ctx)?.here },
    stillRelevant: (ctx) => !!merchant(ctx)?.here,
    acquired: (ctx) => albumHas(ctx, /\.basile$/),
    steps: [
      {
        id: 'stall',
        say: () => 'Basile passe 2 jours : graines rares et petits trésors.',
        face: 'happy',
        target: () => ({ scene: { type: 'merchant' }, label: 'la roulotte de Basile' }),
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => ctx.signal?.data?.id === 'v-merchant', button: 'Compris' },
      },
    ],
    reminders: ['merchant'],
  },
  {
    id: 'variety.rare',
    chapter: 'village',
    title: 'Les graines rares',
    tier: 'U',
    priority: 40,
    trigger: {
      on: ['merchantBought', 'planted'],
      when: (ctx) => varietyOn(ctx) && ((ctx.ev?.type === 'merchantBought' && String(ctx.ev?.itemId || '').startsWith('seeds.')) || (ctx.ev?.type === 'planted' && !!ctx.ev?.rare)),
    },
    acquired: (ctx) => Object.keys(lifetime(ctx).variety?.rare || {}).length > 0,
    steps: [
      {
        id: 'seeds',
        say: () => 'Un sachet rare : chaque semis prend une graine, gratuitement.',
        face: 'happy',
        target: (ctx) => {
          const p = plots(ctx).find((x) => x.action === 'plant');
          return p ? { plot: p.index, label: 'une parcelle vide' } : UI.field;
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.theme',
    chapter: 'village',
    title: 'L\'année à thème',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['themeStarted'], when: varietyOn },
    acquired: (ctx) => (S(ctx).mode === 'career' ? (S(ctx).time?.year || 1) : (ctx?.careerSave?.year || 0)) >= 3,
    steps: [
      {
        id: 'theme',
        say: () => 'Cette année a son thème : une vedette mieux payée, une fête.',
        face: 'happy',
        target: () => UI.journal,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.themeVisitor',
    chapter: 'village',
    title: 'Le visiteur de l\'année',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['offer'], when: (ctx) => varietyOn(ctx) && ctx.ev?.kind === 'themeVisitor' },
    stillRelevant: (ctx) => !!themeVisitor(ctx),
    acquired: (ctx) => albumStamp(ctx, 'visitor'),
    steps: [
      {
        id: 'gift',
        say: () => 'Un visiteur unique ! Il apporte un cadeau. Touchez-le.',
        face: 'happy',
        target: (ctx) => {
          const o = themeVisitor(ctx);
          return o ? { scene: { type: 'themeVisitor' }, label: 'le visiteur de l\'année' } : UI.todo;
        },
        gesture: 'tap',
        done: { on: 'sheetOpen', button: 'Compris' },
      },
    ],
  },
];

// ── Lot 4 : fêtes, hiver et album ────────────────────────────────────────────────────────────

const fete = (ctx) => q(ctx, 'fete', null);
const feteEngine = (ctx) => fete(ctx)?.engine || null;
const hiddenLeft = (ctx) => (fete(ctx)?.hidden?.items || []).filter((x) => !x.found);
const winterQ = (ctx) => q(ctx, 'winter', null);
const waitingPlot = (ctx) => plots(ctx).find((p) => p.action === 'harvest' && p.wait && (Number.isFinite(p.wait.machineIn) || Number.isFinite(p.wait.staffIn)));
const feteStarted = (ctx) => {
  const f = fete(ctx);
  if (!f) return false;
  if (f.done || f.result) return true;
  return (f.hidden?.foundByPlayer || 0) > 0;
};
const feederEmptyDays = (ctx) => {
  const fd = S(ctx).cozy?.winter?.feeder;
  if (!fd?.here) return 0;
  return absDay(ctx) - (Number.isFinite(fd.filledDay) ? fd.filledDay : absDay(ctx) - 2);
};

const cozyLessons = [
  {
    id: 'cozy.album',
    chapter: 'cozy',
    title: 'L\'album de la ferme',
    tier: 'U',
    priority: 20,
    trigger: { on: ['dawn', 'harvested', 'collected'], when: (ctx) => albumFound(ctx).length > 0 },
    acquired: (ctx) => albumFound(ctx).length >= 3,
    steps: [
      {
        id: 'page',
        say: () => 'Une case de l\'album ! Chaque chose vécue y a sa page. Il est dans le Menu.',
        face: 'happy',
        target: () => UI.menu,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
    reminders: ['album'],
  },
  {
    id: 'cozy.albumReward',
    chapter: 'cozy',
    title: 'Une page complète',
    tier: 'U',
    priority: 40,
    trigger: { on: ['dawn'], when: (ctx) => claimable(ctx) > 0 },
    stillRelevant: (ctx) => claimable(ctx) > 0,
    acquired: (ctx) => (album(ctx).claimed || []).length > 0,
    steps: [
      {
        id: 'claim',
        say: () => 'Une page de l\'album est complète ! Son cadeau vous attend dans le Menu.',
        face: 'proud',
        target: () => UI.menu,
        gesture: 'tap',
        done: { on: 'sheetOpen', button: 'Compris' },
      },
    ],
    reminders: ['album'],
  },
  {
    id: 'cozy.helpers',
    chapter: 'cozy',
    title: 'Vos récoltes vous attendent',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['dawn'], when: (ctx) => cozyOn(ctx) && !!S(ctx).cozy?.parts?.helpers && !!waitingPlot(ctx) },
    stillRelevant: (ctx) => !!waitingPlot(ctx),
    acquired: (ctx) => (lifetime(ctx).cozy?.handPicked || 0) >= 20,
    steps: [
      {
        id: 'hand',
        say: () => 'L\'équipe vous laisse les récoltes 3 jours. À la main : +25 % !',
        face: 'happy',
        target: (ctx) => {
          const p = waitingPlot(ctx);
          return p ? { plot: p.index, label: 'une récolte qui vous attend' } : UI.field;
        },
        gesture: 'swipe',
        done: { on: 'harvested', when: isPlayer, button: 'Compris' },
      },
    ],
    reminders: ['waiting'],
  },
  {
    id: 'cozy.fete',
    chapter: 'cozy',
    title: 'Jour de fête',
    tier: 'E',
    priority: 70,
    trigger: { on: ['feteSoon'], when: (ctx) => cozyOn(ctx) && ctx.ev?.engine !== 'foire' },
    acquired: (ctx) => (lifetime(ctx).cozy?.fetes || 0) > 0,
    steps: [
      {
        id: 'soon',
        say: () => 'Demain, c\'est jour de fête : un petit jeu, sans chrono.',
        face: 'happy',
        target: () => UI.todo,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
    reminders: ['fete'],
  },
  {
    id: 'fete.chasse',
    chapter: 'cozy',
    title: 'La chasse aux trésors',
    tier: 'E',
    priority: 75,
    where: 'fete',
    trigger: { on: ['feteMode'], when: (ctx) => cozyOn(ctx) && ctx.signal?.data?.on === true && feteEngine(ctx) === 'chasse' },
    stillRelevant: (ctx) => hiddenLeft(ctx).length > 0,
    acquired: (ctx) => albumHas(ctx, /\.eggHunt$/),
    steps: [
      {
        id: 'find',
        say: () => 'Des trésors sont cachés dans la ferme : touchez-les !',
        face: 'happy',
        target: (ctx) => {
          const it = hiddenLeft(ctx)[0];
          return it ? { scene: { type: 'feteItem', index: it.index }, label: 'un objet caché' } : UI.field;
        },
        gesture: 'tap',
        done: { on: 'feteFound' },
      },
      {
        id: 'hint',
        say: () => 'Bloqué ? L\'indice est ici.',
        face: 'content',
        target: () => ({ ui: '#cz-bar-hint', label: 'le bouton Indice' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'fete.marmite',
    chapter: 'cozy',
    title: 'La soupe partagée',
    tier: 'E',
    priority: 75,
    trigger: { on: ['sheetOpen'], when: (ctx) => cozyOn(ctx) && ctx.signal?.data?.id === 'cz-fete' && feteEngine(ctx) === 'marmite' && !feteStarted(ctx) },
    acquired: (ctx) => albumHas(ctx, /\.soup$/),
    steps: [
      {
        id: 'soup',
        say: () => 'Mettez 1 à 3 légumes de l\'année dans la marmite.',
        face: 'happy',
        sheet: 'cz-fete',
        target: () => ({ ui: '.cz-tile', sheet: 'cz-fete', label: 'les légumes de l\'année' }),
        gesture: 'tap',
        done: { on: 'feteDone', button: 'Compris' },
      },
    ],
  },
  {
    id: 'fete.etal',
    chapter: 'cozy',
    title: 'Le stand de la ferme',
    tier: 'E',
    priority: 75,
    trigger: { on: ['sheetOpen'], when: (ctx) => cozyOn(ctx) && ctx.signal?.data?.id === 'cz-fete' && feteEngine(ctx) === 'etal' && !feteStarted(ctx) },
    acquired: (ctx) => albumHas(ctx, /\.stand$/),
    steps: [
      {
        id: 'crates',
        say: () => 'Remplissez les cagettes : la variété et la qualité comptent.',
        face: 'happy',
        sheet: 'cz-fete',
        target: () => ({ ui: '.cz-tile', sheet: 'cz-fete', label: 'les produits de l\'année' }),
        gesture: 'tap',
        done: { on: 'feteDone', button: 'Compris' },
      },
    ],
  },
  {
    id: 'fete.paniers',
    chapter: 'cozy',
    title: 'Les paniers de Noël',
    tier: 'E',
    priority: 75,
    trigger: { on: ['sheetOpen'], when: (ctx) => cozyOn(ctx) && ctx.signal?.data?.id === 'cz-fete' && feteEngine(ctx) === 'paniers' && !feteStarted(ctx) },
    acquired: (ctx) => albumHas(ctx, /\.christmas$/),
    steps: [
      {
        id: 'basket',
        say: () => 'Garnissez un panier pour chaque voisin.',
        face: 'happy',
        sheet: 'cz-fete',
        target: () => ({ ui: '#cz-basket-0', sheet: 'cz-fete', label: 'le premier panier' }),
        gesture: 'tap',
        done: { on: 'feteDone', button: 'Compris' },
      },
    ],
  },
  {
    id: 'fete.theme',
    chapter: 'cozy',
    title: 'La fête de l\'année',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['feteStarted'], when: (ctx) => cozyOn(ctx) && !!(ctx.ev?.fete?.themeId || fete(ctx)?.themeId) },
    steps: [
      {
        id: 'new',
        say: () => 'Une fête de l\'année : même jeu, nouveau décor !',
        face: 'happy',
        target: () => UI.todo,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'cozy.seedFair',
    chapter: 'cozy',
    title: 'La foire aux graines',
    tier: 'E',
    priority: 70,
    trigger: { on: ['sheetOpen'], when: (ctx) => cozyOn(ctx) && ctx.signal?.data?.id === 'cz-fete' && feteEngine(ctx) === 'foire' },
    acquired: (ctx) => albumHas(ctx, /\.seedFair$/),
    steps: [
      {
        id: 'packs',
        say: () => 'Des sachets à −25 % : vos semis du printemps les prendront.',
        face: 'happy',
        sheet: 'cz-fete',
        target: () => ({ ui: '[id^="cz-pack-"]', sheet: 'cz-fete', label: 'un sachet de graines' }),
        gesture: 'look',
        done: { on: 'seedPackBought', button: 'Compris' },
      },
    ],
  },
  {
    id: 'cozy.winter',
    chapter: 'cozy',
    title: 'Les trouvailles d\'hiver',
    tier: 'E',
    priority: 70,
    trigger: { on: ['winterFind', 'dawn'], when: (ctx) => cozyOn(ctx) && (winterQ(ctx)?.finds || []).length > 0 },
    stillRelevant: (ctx) => (winterQ(ctx)?.finds || []).length > 0,
    acquired: (ctx) => albumHas(ctx, /^edge\./),
    steps: [
      {
        id: 'pick',
        say: () => 'En lisière, des trouvailles d\'hiver : touchez-les.',
        face: 'happy',
        target: (ctx) => {
          const f = (winterQ(ctx)?.finds || [])[0];
          return f ? { scene: { type: 'winterFind', id: f.id }, label: f.name ? `une trouvaille : ${f.name.toLowerCase()}` : 'une trouvaille' } : UI.field;
        },
        gesture: 'tap',
        done: { on: 'winterPicked' },
        buttons: ['later'],
      },
    ],
    reminders: ['winter'],
  },
  {
    id: 'winter.feeder',
    chapter: 'cozy',
    title: 'La mangeoire',
    tier: 'U',
    priority: 40,
    trigger: { on: ['seasonStart', 'dawn'], when: (ctx) => cozyOn(ctx) && !!winterQ(ctx)?.feeder?.canFill },
    stillRelevant: (ctx) => !!winterQ(ctx)?.feeder?.canFill,
    acquired: (ctx) => Object.keys(lifetime(ctx).cozy?.birds || {}).length > 0,
    steps: [
      {
        id: 'fill',
        say: () => 'Remplissez la mangeoire : demain, un oiseau viendra.',
        face: 'happy',
        target: () => ({ scene: { type: 'feeder' }, label: 'la mangeoire' }),
        gesture: 'tap',
        done: { on: 'feederFilled' },
        buttons: ['later'],
      },
    ],
    reminders: ['winter'],
  },
  {
    id: 'winter.veillee',
    chapter: 'cozy',
    title: 'La veillée',
    tier: 'U',
    priority: 40,
    trigger: { on: ['storyReady', 'dawn'], when: (ctx) => cozyOn(ctx) && !!winterQ(ctx)?.story?.available },
    stillRelevant: (ctx) => !!winterQ(ctx)?.story?.available,
    acquired: (ctx) => (album(ctx).stories || 0) > 0,
    steps: [
      {
        id: 'window',
        say: () => 'Ce soir, veillée chez moi : touchez ma fenêtre.',
        face: 'happy',
        target: () => ({ scene: { type: 'storyWindow' }, label: 'la fenêtre de Joseph' }),
        gesture: 'tap',
        done: { on: 'storyHeard' },
        buttons: ['later'],
      },
    ],
    reminders: ['veillee'],
  },
  {
    id: 'cozy.lanterns',
    chapter: 'cozy',
    title: 'Les lanternes',
    tier: 'U',
    priority: 40,
    where: 'dialog',
    trigger: { on: ['dialogOpen'], when: (ctx) => ctx.signal?.data?.id === 'cz-lanterns' || ctx.signal?.data?.page === 'lanterns' },
    acquired: (ctx) => (ctx?.progress?.lanterns?.career?.years || 0) + Object.keys(ctx?.progress?.lanterns?.levels || {}).length > 1,
    steps: [
      {
        id: 'lights',
        say: () => 'Une lanterne par critère, toujours. L\'an prochain, on fait mieux !',
        face: 'proud',
        target: () => ({ ui: '#cz-lanterns', label: 'les lanternes de l\'année' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
];

export const LESSONS = mouseWords([...surpriseLessons, ...villageLessons, ...cozyLessons]);

// ── Rappels des lots (§ 8.4) ─────────────────────────────────────────────────────────────────

function cartFillable(ctx) {
  const c = cart(ctx);
  if (!c || c.daysLeft !== 0) return false;
  const ripe = new Set(plots(ctx).filter((p) => p.action === 'harvest' && p.cropId).map((p) => p.cropId));
  return (c.crates || []).some((k) => !k.full && (k.canLoad || ripe.has(k.cropId)));
}

export const REMINDERS = [
  {
    id: 'cart',
    chapter: 'village',
    title: 'La charrette part',
    example: 'La charrette part ce soir. Elle revient la saison prochaine.',
    when: (ctx) => (varietyOn(ctx) && cartFillable(ctx) && dayProgress(ctx) >= 0.3 ? { text: 'La charrette part ce soir. Elle revient la saison prochaine.', target: { scene: { type: 'cart' }, label: 'la charrette' } } : null),
    wait: 0,
    todo: 'v-cart',
  },
  {
    id: 'cards',
    chapter: 'village',
    title: 'Le cadeau de la saison',
    example: 'Votre cadeau de saison vous attend.',
    when: (ctx) => (varietyOn(ctx) && cardsOffer(ctx) ? { text: 'Votre cadeau de saison vous attend.' } : null),
    wait: 2,
    todo: 'v-cards',
  },
  {
    id: 'challenges',
    chapter: 'village',
    title: 'Les défis',
    example: 'Un défi pour la saison ?',
    when: (ctx) => (varietyOn(ctx) && challengesOpen(ctx) && (S(ctx).time?.dayOfSeason || 1) >= 2 ? { text: 'Un défi pour la saison ? Quand vous voulez.' } : null),
    wait: 0,
    todo: 'v-challenges',
    oncePerSeason: true,
  },
  {
    id: 'merchant',
    chapter: 'village',
    title: 'Basile repart',
    example: 'Basile repart ce soir. Il revient la saison prochaine.',
    when: (ctx) => {
      const m = merchant(ctx);
      const ok = varietyOn(ctx) && !!m?.here && m.daysLeft === 0 && !(m.stall || []).some((it) => it.sold);
      return ok ? { text: 'Basile repart ce soir. Il revient la saison prochaine.', target: { scene: { type: 'merchant' }, label: 'la roulotte' } } : null;
    },
    wait: 0,
    todo: 'v-merchant',
  },
  {
    id: 'fete',
    chapter: 'cozy',
    title: 'La fête du village',
    example: 'C\'est la fête au village ! Un petit jeu ?',
    when: (ctx) => {
      const f = fete(ctx);
      const ok = cozyOn(ctx) && !!f && f.engine !== 'foire' && !feteStarted(ctx) && dayProgress(ctx) >= 0.4;
      return ok ? { text: 'C\'est la fête au village ! Un petit jeu ?' } : null;
    },
    wait: 0,
    todo: 'cz-fete',
  },
  {
    id: 'winter',
    chapter: 'cozy',
    title: 'L\'hiver vivant',
    example: 'Des trouvailles vous attendent en lisière.',
    when: (ctx) => {
      if (!cozyOn(ctx)) return null;
      const w = winterQ(ctx);
      if ((w?.finds || []).length >= 3) return { text: 'Des trouvailles vous attendent en lisière.' };
      if (w?.feeder?.canFill && feederEmptyDays(ctx) >= 2) return { text: 'La mangeoire est vide. Les oiseaux reviendront.', target: { scene: { type: 'feeder' }, label: 'la mangeoire' } };
      return null;
    },
    wait: 1,
    todo: (ctx) => ((winterQ(ctx)?.finds || []).length >= 3 ? 'cz-finds' : 'cz-feeder'),
    go: (app) => {
      const items = app.todo?.rawItems?.() || [];
      (items.find((x) => x.id === 'cz-finds') || items.find((x) => x.id === 'cz-feeder'))?.go?.();
    },
  },
  {
    id: 'veillee',
    chapter: 'cozy',
    title: 'La veillée',
    example: 'Je vous attends ce soir, au coin du feu.',
    when: (ctx) => (cozyOn(ctx) && winterQ(ctx)?.story?.available ? { text: 'Je vous attends ce soir, au coin du feu.', target: { scene: { type: 'storyWindow' }, label: 'la fenêtre de Joseph' } } : null),
    wait: 2,
    todo: 'cz-story',
  },
  {
    id: 'album',
    chapter: 'cozy',
    title: 'Une page de l\'album',
    example: 'Une page de l\'album est complète !',
    when: (ctx) => (claimable(ctx) > 0 ? { text: 'Une page de l\'album est complète ! Son cadeau vous attend.' } : null),
    wait: 1,
    todo: () => ({ id: 'coach-album', prio: 78, text: 'Une page de l\'album est complète : recevez son cadeau', short: 'un cadeau de l\'album', icon: 'star', go: (app) => app.album?.open?.() }),
    go: (app) => app.album?.open?.(),
  },
];
