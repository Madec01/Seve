// Catalogue « Ma ferme » de l'accompagnement : carrière, rangs 1 → 6 (docs/ACCOMPAGNEMENT.md § 7.3) et rappels de la
// carrière (§ 8.4 : shelter, waiting, leave, stock, quest, offer). Paquet LEÇONS lots.
// Format : docs/ARCHITECTURE.md, « Accompagnement — contrats », Format d'une leçon / Rappels. PUR : aucun accès au DOM ;
// tout passe par `ctx` (lecture seule) et des requêtes protégées (une requête absente ne casse rien).
//
// Identifiants des anciens conseils repris tels quels (« déjà vu » reste vu) : career.start, career.collect,
// career.lotForSale, career.plan, career.hire, career.leave, career.machine, career.storage, career.quest, career.crows,
// career.yearEnd. (career.collectAll vit dans basics.js, career.theme dans lots.js.)
//
// RANK_HIGHLIGHTS : les 3 nouveautés mises en avant par la fenêtre « Nouveau rang » (src/ui/career/windows.js) et par
// la leçon du rang (career.rankN) ; `fold` = section de l'onglet « Acheter » à déplier pour montrer la carte.

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
/** Requête de carrière protégée : cq(ctx, 'shelters', []) */
function cq(ctx, name, fallback, ...args) {
  return safe(ctx, () => {
    const f = ctx.q?.career?.[name];
    return typeof f === 'function' ? f(...args) : undefined;
  }, fallback);
}
const C = (ctx) => ctx?.career || ctx?.state?.career || null;
const T = (ctx) => ctx?.state?.time || {};
const isPlayer = (ctx) => !ctx.ev?.by || ctx.ev.by === 'player';
const sig = (ctx, name, pred = () => true) => ctx.signal?.name === name && pred(ctx.signal.data || {});
const sheetOpened = (...ids) => ({ on: 'sheetOpen', when: (ctx) => ids.includes(ctx.signal?.data?.id) });
const lotsOf = (ctx) => C(ctx)?.lots || [];
const boughtLots = (ctx) => lotsOf(ctx).filter((l) => (l.index ?? 0) >= 3);
const building = (ctx, id) => C(ctx)?.buildings?.[id] || null;
const built = (ctx, id) => (building(ctx, id)?.level || 0) > 0;
const machines = (ctx) => Object.entries(C(ctx)?.machines || {}).filter(([, m]) => m).map(([key, m]) => ({ key, ...m }));
const staff = (ctx) => C(ctx)?.staff || [];
/** Rang (en partie : l'état ; au chargement : la sauvegarde de carrière du contexte de déduction). */
const rank = (ctx) => C(ctx)?.rank || ctx?.careerSave?.rank || 1;
const plots = (ctx) => safe(ctx, () => ctx.q.plots(), []) || [];
const year = (ctx) => (C(ctx) ? T(ctx).year || 1 : ctx?.careerSave?.year || 0);
const absDay = (ctx) => ctx?.day?.abs ?? T(ctx).day ?? 0;

/**
 * Jour où une condition de rappel est devenue vraie (mémoire de session, par partie) : un rappel attend `wait` jours de
 * jeu à partir de ce jour-là. La condition redevient fausse → oubliée.
 */
const SINCE = new WeakMap();
function since(ctx, key, cond) {
  const g = ctx?.game || ctx?.state || null;
  if (!g || typeof g !== 'object') return cond ? absDay(ctx) : null;
  let m = SINCE.get(g);
  if (!m) SINCE.set(g, (m = new Map()));
  if (!cond) {
    m.delete(key);
    return null;
  }
  if (!m.has(key)) m.set(key, absDay(ctx));
  return m.get(key);
}

const SHELTER_WORDS = {
  coop: ['Les poules ont pondu', 'le poulailler', false],
  sheepfold: ['Les moutons ont de la laine', 'la bergerie', true],
  goatShed: ['Les chèvres ont donné du lait', 'la chèvrerie', true],
  cowshed: ['Les vaches ont donné du lait', 'l\'étable', true],
  pigsty: ['Les cochons ont trouvé des truffes', 'la porcherie', true],
  hutch: ['Les lapins vous attendent', 'le clapier', false],
  stable: ['Les chevaux vous attendent', 'l\'écurie', true],
  duckPond: ['Les canards ont pondu', 'la mare', true],
};
const shelterName = (id) => SHELTER_WORDS[id]?.[1] || 'l\'abri';
/** « Le poulailler est plein » / « La bergerie est pleine ». */
const isFull = (id) => `${capital(shelterName(id))} est ${SHELTER_WORDS[id]?.[2] ? 'pleine' : 'plein'}`;
const capital = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const shelters = (ctx) => cq(ctx, 'shelters', []) || [];
const pendingShelter = (ctx) => shelters(ctx).find((s) => (s.pending || 0) > 0) || null;
const fullShelter = (ctx) => shelters(ctx).find((s) => s.full) || null;
const shelterTarget = (s, fallback = 'coop') => {
  const id = s?.buildingId || fallback;
  return { scene: { type: 'shelter', buildingId: id }, label: shelterName(id) };
};
const lotSign = (lotId, label = 'le panneau du terrain', slot) => ({ scene: slot === undefined ? { type: 'lotSign', lotId } : { type: 'lotSign', lotId, slot }, label });
const firstLotOfType = (ctx, type) => lotsOf(ctx).find((l) => l.type === type && (l.index ?? 0) >= 3) || null;
const lastLotOfType = (ctx, type) => [...lotsOf(ctx)].reverse().find((l) => l.type === type) || null;
const developedLots = (ctx) => boughtLots(ctx).filter((l) => l.type && l.type !== 'wild');
const offersOpen = (ctx) => (cq(ctx, 'events', null)?.offers || []).filter((o) => !o.accepted && o.kind !== 'themeVisitor');
const hasHorse = (ctx) => (ctx.state?.investments?.horse || 0) > 0 || built(ctx, 'stable');
const hasTractor = (ctx) => machines(ctx).some((m) => m.id === 'tractor');

const TAB = {
  buy: { ui: '#tab-buy', label: 'l\'onglet Acheter' },
  staff: { ui: '#tab-staff', label: 'l\'onglet Équipe' },
  journal: { ui: '#tab-journal', label: 'l\'onglet Carnet' },
  farm: { ui: '#tab-farm', label: 'l\'onglet Ferme' },
  menu: { ui: '#tab-menu', label: 'l\'onglet Menu' },
  bill: { ui: '#hud-bill', label: 'les charges de saison' },
  money: { ui: '#hud-money', label: 'votre argent' },
  todo: { ui: '#todo-main', label: 'la ligne « À faire »' },
};

// ── Les 3 nouveautés de chaque rang ──────────────────────────────────────────────────────────

export const RANK_HIGHLIGHTS = {
  2: [
    { kind: 'building', id: 'house', name: 'La maison, niveau 2', text: 'Elle loge vos premiers employés.', ui: '#c-bld-house', fold: 'shop-buildings' },
    { kind: 'building', id: 'storage', name: 'Le grenier', text: 'Il garde vos récoltes pour les vendre au bon prix.', ui: '#c-bld-storage', fold: 'shop-buildings' },
    { kind: 'machine', id: 'sprinklers', name: 'Les arroseurs', text: 'Ils arrosent tout un champ, chaque matin.', ui: '#c-machine-sprinklers', fold: 'shop-machines' },
  ],
  3: [
    { kind: 'machine', id: 'seeder', name: 'Le semoir', text: 'Il sème tout un champ, selon le plan.', ui: '#c-machine-seeder', fold: 'shop-machines' },
    { kind: 'machine', id: 'harvester', name: 'La moissonneuse', text: 'Elle récolte tout un champ.', ui: '#c-machine-harvester', fold: 'shop-machines' },
    { kind: 'building', id: 'guestHouse', name: 'La chambre d\'hôte', text: 'Des hôtes viennent dormir à la ferme.', ui: '#c-bld-guestHouse', fold: 'shop-buildings' },
  ],
  4: [
    { kind: 'machine', id: 'tractor', name: 'Le tracteur', text: 'Il tire les machines de niveau 2.', ui: '#c-machine-tractor', fold: 'shop-machines' },
    { kind: 'building', id: 'storage', name: 'Le silo', text: 'Le grenier devient silo : 100 places.', ui: '#c-bld-storage', fold: 'shop-buildings' },
    { kind: 'feature', id: 'machines2', name: 'Les machines de niveau 2', text: 'Elles font tout le terrain d\'un coup.', ui: '#c-machine-seeder', fold: 'shop-machines' },
  ],
  5: [
    { kind: 'building', id: 'house', name: 'Le manoir', text: 'La maison loge 8 employés.', ui: '#c-bld-house', fold: 'shop-buildings' },
    { kind: 'machine', id: 'waterTower', name: 'Le château d\'eau', text: 'Plus d\'entretien des arroseurs.', ui: '#c-machine-waterTower', fold: 'shop-machines' },
    { kind: 'building', id: 'roadsideStand', name: 'Le marché fermier', text: 'Vos ventes rapportent 40 % de plus.', ui: '#c-bld-roadsideStand', fold: 'shop-buildings' },
  ],
  6: [
    { kind: 'feature', id: 'domainSign', name: 'Le Domaine', text: '16 terrains : la ferme est complète.', ui: '#tab-journal', fold: null },
    { kind: 'feature', id: 'regionalFair', name: 'Le comice régional', text: 'Le grand concours de la région.', ui: '#tab-journal', fold: null },
    { kind: 'feature', id: 'free', name: 'Le jeu libre', text: 'Tout le temps est à vous.', ui: '#tab-journal', fold: null },
  ],
};

/** Leçon d'un rang : la fenêtre du rang fermée, « Acheter », puis les 3 cartes l'une après l'autre. */
function rankLesson(n, extra = {}) {
  const hl = RANK_HIGHLIGHTS[n];
  return {
    id: `career.rank${n}`,
    chapter: 'career',
    title: `Le rang ${n}`,
    modes: ['career'],
    tier: 'E',
    priority: 75,
    trigger: { on: ['rankClosed'], when: (ctx) => (ctx.signal?.data?.rank ?? rank(ctx)) === n },
    stillRelevant: (ctx) => rank(ctx) <= n,
    acquired: (ctx) => rank(ctx) > n,
    steps: [
      {
        id: 'tab',
        say: () => 'Nouveau rang ! Trois nouveautés à essayer. Ouvrez « Acheter ».',
        face: 'proud',
        target: () => TAB.buy,
        gesture: 'tap',
        done: sheetOpened('c-shop'),
        buttons: ['later'],
      },
      ...hl.map((h, i) => ({
        id: `new${i + 1}`,
        say: () => `${h.name} : ${h.text.charAt(0).toLowerCase()}${h.text.slice(1)}`,
        face: i === 2 ? 'happy' : 'content',
        target: () => ({ ui: h.ui, sheet: 'c-shop', label: h.name.toLowerCase() }),
        gesture: 'look',
        sheet: 'c-shop',
        // Déplie la section de l'onglet « Acheter » qui contient la carte (sections repliées par défaut).
        enter: h.fold ? (ctx, kit) => kit?.openSection?.(h.fold) : undefined,
        back: 'tab',
        done: { button: i === hl.length - 1 ? 'Compris' : 'Suivant' },
      })),
    ],
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
    id: 'career.collect',
    chapter: 'career',
    title: 'Les œufs',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['dawn'], when: (ctx) => !!pendingShelter(ctx) },
    stillRelevant: (ctx) => !!pendingShelter(ctx),
    acquired: (ctx) => Object.values(C(ctx)?.buildings || {}).some((b) => b && b.lastCollected !== null && b.lastCollected !== undefined),
    steps: [
      {
        id: 'tap',
        say: (ctx) => {
          const s = pendingShelter(ctx);
          const w = SHELTER_WORDS[s?.buildingId] || SHELTER_WORDS.coop;
          return `${w[0]} ! Touchez ${w[1]}.`;
        },
        face: 'happy',
        target: (ctx) => shelterTarget(pendingShelter(ctx)),
        gesture: 'tap',
        done: { on: 'collected', when: isPlayer },
        skipIf: (ctx) => !pendingShelter(ctx),
      },
      {
        id: 'keep',
        say: () => 'Un abri garde 3 jours de produits. Rien ne presse !',
        face: 'content',
        target: (ctx) => shelterTarget(shelters(ctx)[0]),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
    reminders: ['shelter'],
  },
  {
    id: 'career.start',
    chapter: 'career',
    title: 'Le but : le prochain rang',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['dawn'], when: (ctx) => year(ctx) === 1 && (T(ctx).seasonIndex || 0) === 0 && (T(ctx).dayOfSeason || 1) >= 3 },
    stillRelevant: (ctx) => rank(ctx) < 6,
    acquired: (ctx) => rank(ctx) >= 2 || year(ctx) >= 2,
    steps: [
      {
        id: 'tab',
        say: () => 'Votre but : le prochain rang. Il est dans le Carnet.',
        face: 'content',
        target: () => TAB.journal,
        gesture: 'tap',
        done: sheetOpened('c-journal'),
        buttons: ['later'],
      },
      {
        id: 'goals',
        say: () => 'Deux objectifs, et le patrimoine à atteindre.',
        face: 'happy',
        target: () => ({ ui: '.c-obj', sheet: 'c-journal', label: 'les objectifs du rang' }),
        gesture: 'look',
        sheet: 'c-journal',
        back: 'tab',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.charges',
    chapter: 'money',
    title: 'Les charges de saison',
    modes: ['career'],
    tier: 'E',
    priority: 90,
    trigger: {
      on: ['dawn'],
      when: (ctx) => year(ctx) === 1 && (T(ctx).seasonIndex || 0) === 0 && ((T(ctx).dayOfSeason || 1) >= 4 || (cq(ctx, 'charges', null)?.season?.daysLeft ?? 9) <= 3),
    },
    acquired: (ctx) => year(ctx) >= 2 || (!!C(ctx) && (T(ctx).seasonIndex || 0) >= 1),
    steps: [
      {
        id: 'what',
        say: (ctx) => {
          const n = cq(ctx, 'charges', null)?.season?.amount;
          return `Chaque saison, la ferme a des charges : ${Number.isFinite(n) ? n : 20} pièces.`;
        },
        face: 'content',
        target: () => TAB.bill,
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'grow',
        say: () => 'Elles montent quand la ferme grandit. Touchez ici pour voir le détail.',
        face: 'content',
        target: () => TAB.bill,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.lotForSale',
    chapter: 'career',
    title: 'La forêt à vendre',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: {
      on: ['dawn'],
      when: (ctx) => {
        if ((C(ctx)?.lotsBought || 0) > 0) return false;
        const next = cq(ctx, 'nextLot', null);
        return !!next && (next.canBuy || (ctx.state?.money || 0) >= (next.price || Infinity) * 0.8);
      },
    },
    stillRelevant: (ctx) => (C(ctx)?.lotsBought || 0) === 0,
    acquired: (ctx) => (C(ctx)?.lotsBought || 0) > 0,
    steps: [
      {
        id: 'sign',
        say: () => 'La forêt autour est à vendre. Touchez son panneau !',
        face: 'happy',
        target: (ctx) => {
          const next = cq(ctx, 'nextLot', null);
          return next ? { scene: { type: 'lotForSale', lotId: next.id }, label: 'le terrain à vendre' } : TAB.buy;
        },
        gesture: 'tap',
        done: sheetOpened('c-lot', 'c-shop'),
        buttons: ['later'],
      },
      {
        id: 'buy',
        say: () => 'On l\'achète ici. Chaque terrain ajoute un peu de charges.',
        face: 'content',
        target: () => ({ ui: '#c-lot-buy', sheet: 'c-lot', label: 'le bouton Acheter ce terrain' }),
        gesture: 'look',
        sheet: 'c-lot',
        skipIf: (ctx) => ctx.ui?.sheet !== 'c-lot',
        done: { button: 'Compris' },
      },
    ],
    next: 'career.map',
  },
  {
    id: 'career.map',
    chapter: 'career',
    title: 'La carte de la ferme',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['lotBought', 'dawn'], when: (ctx) => (C(ctx)?.lotsBought || 0) >= 1 },
    acquired: (ctx) => (C(ctx)?.lotsBought || 0) >= 2,
    steps: [
      {
        id: 'mini',
        say: () => 'La petite carte : touchez-la pour aller loin.',
        face: 'content',
        target: () => ({ ui: '#minimap', label: 'la mini-carte' }),
        gesture: 'tap',
        done: { button: 'Suivant' },
      },
      {
        id: 'big',
        say: () => 'Re-touchez « Ferme » : la grande carte.',
        face: 'happy',
        target: () => TAB.farm,
        gesture: 'tap',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.develop',
    chapter: 'career',
    title: 'Aménager un terrain',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['lotBought', 'dawn'], when: (ctx) => !!firstLotOfType(ctx, 'wild') },
    stillRelevant: (ctx) => !!firstLotOfType(ctx, 'wild'),
    acquired: (ctx) => developedLots(ctx).length > 0,
    steps: [
      {
        id: 'sign',
        say: () => 'Un terrain se transforme : champ, pré… Touchez son panneau.',
        face: 'content',
        target: (ctx) => {
          const l = firstLotOfType(ctx, 'wild');
          return l ? lotSign(l.id, 'le panneau du nouveau terrain') : TAB.buy;
        },
        gesture: 'tap',
        done: sheetOpened('c-lot'),
        buttons: ['later'],
      },
      {
        id: 'pick',
        say: () => 'Choisissez ici ce qu\'il devient.',
        face: 'happy',
        target: () => ({ ui: '#c-dev-field', sheet: 'c-lot', label: 'la liste des aménagements' }),
        gesture: 'look',
        sheet: 'c-lot',
        back: 'sign',
        done: { on: 'lotDeveloped' },
        buttons: ['later'],
      },
    ],
  },
  {
    id: 'career.plan',
    chapter: 'career',
    title: 'Le plan de culture',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['lotDeveloped'], when: (ctx) => ctx.ev?.lotType === 'field' },
    acquired: (ctx) => lotsOf(ctx).filter((l) => l.type === 'field').length >= 3,
    where: 'farm',
    steps: [
      {
        id: 'plan',
        say: () => 'Le plan dit quoi semer à chaque saison. Les machines et l\'équipe le suivent.',
        face: 'content',
        target: () => ({ ui: '#c-plan-spring', sheet: 'c-lot', label: 'le plan du printemps' }),
        gesture: 'look',
        sheet: 'c-lot',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.shelter',
    chapter: 'career',
    title: 'Un abri dans le pré',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['lotDeveloped'], when: (ctx) => ctx.ev?.lotType === 'meadow' },
    stillRelevant: (ctx) => lotsOf(ctx).some((l) => l.type === 'meadow' && (l.slots || []).some((s) => !s)),
    acquired: (ctx) => ['sheepfold', 'goatShed', 'cowshed', 'pigsty', 'hutch', 'stable'].some((id) => built(ctx, id)),
    steps: [
      {
        id: 'slot',
        say: () => 'Un pré accueille un abri : touchez une place libre.',
        face: 'content',
        target: (ctx) => {
          const l = lastLotOfType(ctx, 'meadow');
          const k = Math.max(0, (l?.slots || []).findIndex((s) => !s));
          return l ? lotSign(l.id, 'une place libre du pré', k) : TAB.buy;
        },
        gesture: 'tap',
        done: sheetOpened('c-build', 'c-lot'),
        buttons: ['later'],
      },
      {
        id: 'pick',
        say: () => 'Bergerie ou chèvrerie, au choix.',
        face: 'happy',
        target: () => ({ ui: '#c-opt-sheepfold', sheet: 'c-build', label: 'la bergerie' }),
        gesture: 'look',
        sheet: 'c-build',
        back: 'slot',
        done: { on: 'buildingBuilt' },
        buttons: ['later'],
      },
    ],
  },
  {
    id: 'career.shelterFull',
    chapter: 'career',
    title: 'Un abri plein',
    modes: ['career'],
    tier: 'U',
    priority: 45,
    trigger: { on: ['shelterFull'] },
    stillRelevant: (ctx) => !!fullShelter(ctx),
    steps: [
      {
        id: 'full',
        say: (ctx) => `${isFull(fullShelter(ctx)?.buildingId || 'coop')} : ramassez, ou agrandissez.`,
        face: 'content',
        target: (ctx) => shelterTarget(fullShelter(ctx)),
        gesture: 'tap',
        done: { on: 'collected', when: isPlayer },
        buttons: ['later'],
      },
    ],
    reminders: ['shelter'],
  },
  {
    id: 'career.stand',
    chapter: 'career',
    title: 'L\'étal',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: {
      on: ['dawn'],
      when: (ctx) => {
        if (built(ctx, 'roadsideStand')) return false;
        const b = cq(ctx, 'building', null, 'roadsideStand');
        const charges = cq(ctx, 'charges', null)?.season?.amount || 20;
        return !!b && !!b.canUpgrade && (ctx.state?.money || 0) >= (b.nextCost || Infinity) + 2 * charges;
      },
    },
    stillRelevant: (ctx) => !built(ctx, 'roadsideStand'),
    acquired: (ctx) => built(ctx, 'roadsideStand'),
    steps: [
      {
        id: 'stand',
        say: () => 'L\'étal fait payer vos récoltes 20 % plus cher. Il est dans « Acheter ».',
        face: 'content',
        target: () => TAB.buy,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.beehive',
    chapter: 'career',
    title: 'Les ruches',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['purchased'], when: (ctx) => ctx.ev?.investmentId === 'beehive' },
    acquired: (ctx) => !!C(ctx) && (ctx.state?.investments?.beehive || 0) > 0,
    steps: [
      {
        id: 'hive',
        say: () => 'Chaque ruche fait pousser toute la ferme un peu plus vite.',
        face: 'happy',
        target: () => ({ scene: { type: 'investment', id: 'beehive' }, label: 'la ruche' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.offer',
    chapter: 'career',
    title: 'Les visiteurs',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['offer'], when: (ctx) => ctx.ev?.kind !== 'themeVisitor' },
    stillRelevant: (ctx) => offersOpen(ctx).length > 0,
    acquired: (ctx) => year(ctx) >= 2,
    steps: [
      {
        id: 'who',
        say: () => 'Un visiteur veut des récoltes, payées plus cher.',
        face: 'content',
        target: (ctx) => {
          const o = offersOpen(ctx)[0];
          return o ? { scene: { type: 'visitor', offerId: o.id, kind: o.kind }, label: 'le visiteur' } : TAB.todo;
        },
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'answer',
        say: () => 'Sa demande est en bas. Refuser ne coûte rien.',
        face: 'happy',
        target: () => TAB.todo,
        gesture: 'tap',
        done: { on: ['todoGo', 'sheetOpen'], when: (ctx) => ctx.signal?.name === 'todoGo' || ctx.signal?.data?.id === 'c-offer' },
        buttons: ['later'],
      },
    ],
    reminders: ['offer'],
  },
  {
    id: 'career.crows',
    chapter: 'career',
    title: 'Les corbeaux',
    modes: ['career'],
    tier: 'E',
    priority: 85,
    urgent: true, // danger réel : passe même pendant l'attente d'un cours (allowedDuringCourse)
    trigger: { on: ['crow'] },
    stillRelevant: (ctx) => plots(ctx).some((p) => p.crow),
    steps: [
      {
        id: 'chase',
        say: () => 'Un corbeau ! Touchez la parcelle pour le chasser.',
        face: 'content',
        target: (ctx) => {
          const p = plots(ctx).find((x) => x.crow);
          return p ? { plot: p.index, label: 'la parcelle du corbeau' } : TAB.todo;
        },
        gesture: 'tap',
        done: { on: 'crowChased', when: isPlayer },
        skipIf: (ctx) => !plots(ctx).some((p) => p.crow),
      },
    ],
  },
  {
    id: 'career.finds',
    chapter: 'surprises',
    title: 'Les trouvailles',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['dialogClose'], when: (ctx) => ctx.signal?.data?.id === 'finds' },
    acquired: (ctx) => (C(ctx)?.lotsBought || 0) >= 2,
    steps: [
      {
        id: 'treasure',
        say: () => 'Au défrichage, on trouve parfois un trésor. Il va dans l\'album.',
        face: 'happy',
        target: () => TAB.menu,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.loan',
    chapter: 'money',
    title: 'Joseph vous dépanne',
    modes: ['career'],
    tier: 'E',
    priority: 90,
    urgent: true, // danger réel : passe même pendant l'attente d'un cours (allowedDuringCourse)
    trigger: { on: ['dialogClose'], when: (ctx) => ctx.signal?.data?.id === 'career-loan' },
    steps: [
      {
        id: 'repay',
        say: () => 'Une part de vos ventes me rembourse. Ou ici : Carnet, Joseph.',
        face: 'content',
        target: () => TAB.journal,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.hardship',
    chapter: 'money',
    title: 'Une passe difficile',
    modes: ['career'],
    tier: 'E',
    priority: 90,
    urgent: true, // danger réel : passe même pendant l'attente d'un cours (allowedDuringCourse)
    trigger: { on: ['dialogClose'], when: (ctx) => ctx.signal?.data?.id === 'career-hardship' },
    steps: [
      {
        id: 'rest',
        say: () => 'L\'équipe et les machines se reposent. Tout repart à 50 pièces.',
        face: 'content',
        target: () => TAB.money,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.yearEnd',
    chapter: 'career',
    title: 'Fin de l\'année',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['seasonWarning'], when: (ctx) => !!ctx.ev?.yearEnd },
    acquired: (ctx) => year(ctx) >= 2,
    steps: [
      {
        id: 'soon',
        say: () => 'Bientôt, le bilan de l\'année. Puis on continue, même ferme !',
        face: 'happy',
        target: () => TAB.bill,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  rankLesson(2, { next: null }),
  {
    id: 'career.hire',
    chapter: 'career',
    title: 'L\'embauche',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['buildingUpgraded', 'buildingBuilt', 'dawn'], when: (ctx) => (building(ctx, 'house')?.level || 1) >= 2 && staff(ctx).length === 0 },
    stillRelevant: (ctx) => staff(ctx).length === 0,
    acquired: (ctx) => staff(ctx).length > 0 || (C(ctx)?.nextStaffId || 1) > 1,
    steps: [
      {
        id: 'tab',
        say: () => 'La maison loge des employés. Ouvrez « Équipe ».',
        face: 'content',
        target: () => TAB.staff,
        gesture: 'tap',
        done: sheetOpened('c-team', 'c-hire'),
        skipIf: (ctx) => ['c-team', 'c-hire'].includes(ctx.ui?.sheet),
        buttons: ['later'],
      },
      {
        id: 'open',
        say: () => 'Touchez « Embaucher ».',
        face: 'content',
        target: () => ({ ui: '#c-open-hire', sheet: 'c-team', label: 'le bouton Embaucher' }),
        gesture: 'tap',
        sheet: 'c-team',
        back: 'tab',
        done: sheetOpened('c-hire'),
        skipIf: (ctx) => ctx.ui?.sheet === 'c-hire',
      },
      {
        id: 'pick',
        say: () => 'Choisissez un candidat : son métier est écrit.',
        face: 'happy',
        target: (ctx) => {
          const k = (cq(ctx, 'candidates', null)?.list || [])[0];
          return { ui: k ? `#c-cand-${k.id}` : '#c-hire-back', sheet: 'c-hire', label: 'le premier candidat' };
        },
        gesture: 'look',
        sheet: 'c-hire',
        back: 'tab',
        done: { on: 'staffHired' },
        buttons: ['later'],
      },
    ],
    next: 'career.assign',
  },
  {
    id: 'career.assign',
    chapter: 'career',
    title: 'Le travail de l\'équipe',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['staffHired'] },
    stillRelevant: (ctx) => staff(ctx).some((s) => !s.lotId),
    acquired: (ctx) => staff(ctx).some((s) => !!s.lotId),
    steps: [
      {
        id: 'tab',
        say: () => 'Dites-lui où travailler. Ouvrez « Équipe ».',
        face: 'content',
        target: () => TAB.staff,
        gesture: 'tap',
        done: sheetOpened('c-team', 'c-employee'),
        skipIf: (ctx) => ['c-team', 'c-employee'].includes(ctx.ui?.sheet),
      },
      {
        id: 'row',
        say: () => 'Touchez sa ligne.',
        face: 'content',
        target: (ctx) => {
          const s = staff(ctx).find((x) => !x.lotId) || staff(ctx)[0];
          return { ui: s ? `#c-staff-${s.id}` : '#c-open-hire', sheet: 'c-team', label: 'la ligne du nouvel employé' };
        },
        gesture: 'tap',
        sheet: 'c-team',
        back: 'tab',
        done: { on: ['sheetOpen', 'staffAssigned'], when: (ctx) => ctx.ev?.type === 'staffAssigned' || ctx.signal?.data?.id === 'c-employee' },
        skipIf: (ctx) => ctx.ui?.sheet === 'c-employee',
      },
      {
        id: 'job',
        say: () => 'Il arrose, sème et ramasse. La récolte, il vous la laisse.',
        face: 'happy',
        target: () => ({ ui: '#c-job-gardener', sheet: 'c-employee', label: 'les métiers' }),
        gesture: 'look',
        sheet: 'c-employee',
        back: 'tab',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.leave',
    chapter: 'career',
    title: 'Le congé d\'hiver',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['seasonStart', 'dawn'], when: (ctx) => ctx.day?.seasonId === 'winter' && staff(ctx).some((s) => !s.onLeave) },
    stillRelevant: (ctx) => staff(ctx).some((s) => !s.onLeave),
    acquired: (ctx) => staff(ctx).some((s) => s.onLeave),
    steps: [
      {
        id: 'tab',
        say: () => 'En hiver, les champs dorment : mettez l\'équipe en congé.',
        face: 'content',
        target: () => TAB.staff,
        gesture: 'tap',
        done: sheetOpened('c-team'),
        skipIf: (ctx) => ctx.ui?.sheet === 'c-team',
        buttons: ['later'],
      },
      {
        id: 'all',
        say: () => 'Un congé ne coûte rien. Touchez ici.',
        face: 'happy',
        target: () => ({ ui: '#c-team-leave', sheet: 'c-team', label: 'Toute l\'équipe en congé' }),
        gesture: 'tap',
        sheet: 'c-team',
        back: 'tab',
        done: { on: 'staffLeave' },
        buttons: ['later'],
      },
    ],
    reminders: ['leave'],
  },
  {
    id: 'career.storage',
    chapter: 'career',
    title: 'Le grenier',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['buildingBuilt', 'dawn'], when: (ctx) => built(ctx, 'storage') },
    acquired: (ctx) => Object.values(C(ctx)?.stock || {}).some((n) => n > 0) || (building(ctx, 'storage')?.level || 0) >= 2,
    steps: [
      {
        id: 'see',
        say: () => 'Le grenier garde vos récoltes quand le prix est bas. Touchez-le.',
        face: 'content',
        target: () => ({ scene: { type: 'building', buildingId: 'storage' }, label: 'le grenier' }),
        gesture: 'tap',
        done: sheetOpened('c-storage', 'c-building'),
        skipIf: (ctx) => ctx.ui?.sheet === 'c-storage',
        buttons: ['later'],
      },
      {
        id: 'mode',
        say: () => 'Choisissez quand il les garde.',
        face: 'happy',
        target: () => ({ ui: '#c-storage-mode', sheet: 'c-storage', label: 'le réglage du grenier' }),
        gesture: 'look',
        sheet: 'c-storage',
        back: 'see',
        done: { button: 'Compris' },
      },
    ],
    reminders: ['stock'],
  },
  {
    id: 'career.machine',
    chapter: 'career',
    title: 'Les machines',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['machineBought'] },
    acquired: (ctx) => machines(ctx).length > 0,
    steps: [
      {
        id: 'works',
        say: () => 'Elle travaille seule chaque jour.',
        face: 'happy',
        target: (ctx) => {
          const m = machines(ctx).at(-1);
          return m ? { scene: { type: 'machine', key: m.key }, label: 'la machine' } : TAB.buy;
        },
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'switch',
        say: () => 'Son interrupteur est dans la fiche du terrain.',
        face: 'content',
        target: (ctx) => {
          const m = machines(ctx).at(-1);
          return m?.lotId && m.lotId !== 'home' ? lotSign(m.lotId) : TAB.buy;
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.orchard',
    chapter: 'career',
    title: 'Le verger',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['lotDeveloped'], when: (ctx) => ctx.ev?.lotType === 'orchard' },
    acquired: (ctx) => !!firstLotOfType(ctx, 'orchard'),
    steps: [
      {
        id: 'trees',
        say: () => 'Un verger : plantez des pommiers. Ils restent d\'une année à l\'autre.',
        face: 'happy',
        target: (ctx) => {
          const l = lastLotOfType(ctx, 'orchard');
          const p = plots(ctx).find((x) => x.lot === l?.id && x.unlocked && !x.cropId);
          return p ? { plot: p.index, label: 'une place d\'arbre' } : l ? lotSign(l.id, 'le verger') : TAB.farm;
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.workshop',
    chapter: 'career',
    title: 'Les ateliers',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['lotDeveloped'], when: (ctx) => ctx.ev?.lotType === 'workshops' },
    acquired: (ctx) => ['jamWorkshop', 'dairy', 'mill', 'cannery', 'spinningMill'].some((id) => built(ctx, id)),
    steps: [
      {
        id: 'slot',
        say: () => 'Une place d\'atelier : touchez-la pour en bâtir un.',
        face: 'content',
        target: (ctx) => {
          const l = lastLotOfType(ctx, 'workshops');
          return l ? lotSign(l.id, 'une place d\'atelier', 0) : TAB.buy;
        },
        gesture: 'tap',
        done: sheetOpened('c-build', 'c-lot'),
        buttons: ['later'],
      },
      {
        id: 'what',
        say: () => 'Il change vos récoltes en produits plus chers.',
        face: 'happy',
        target: () => ({ ui: '#c-opt-jamWorkshop', sheet: 'c-build', label: 'l\'atelier de confitures' }),
        gesture: 'look',
        sheet: 'c-build',
        back: 'slot',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.greenhouse',
    chapter: 'career',
    title: 'La serre',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['buildingBuilt', 'lotDeveloped'], when: (ctx) => ctx.ev?.buildingId === 'greenhouse' || ctx.ev?.lotType === 'greenhouse' },
    acquired: (ctx) => built(ctx, 'greenhouse'),
    steps: [
      {
        id: 'winter',
        say: () => 'Dans la serre, tout pousse même en hiver. Arrosez-la !',
        face: 'happy',
        target: () => ({ scene: { type: 'building', buildingId: 'greenhouse' }, label: 'la serre' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.quest',
    chapter: 'career',
    title: 'Les quêtes de Joseph',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['questOffered'] },
    stillRelevant: (ctx) => !!cq(ctx, 'quest', null),
    acquired: (ctx) => (C(ctx)?.joseph?.questsDone || 0) > 0,
    steps: [
      {
        id: 'ask',
        say: () => 'J\'ai un service à vous demander. Rien ne presse !',
        face: 'happy',
        target: () => TAB.todo,
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'pay',
        say: () => 'Je paie bien, et notre amitié grandit.',
        face: 'proud',
        target: () => TAB.todo,
        gesture: 'tap',
        done: { on: ['todoGo', 'sheetOpen'], when: (ctx) => ctx.signal?.name === 'todoGo' || ctx.signal?.data?.id === 'c-quest' },
        buttons: ['later'],
      },
    ],
    reminders: ['quest'],
  },
  {
    id: 'career.hearts',
    chapter: 'career',
    title: 'L\'amitié de Joseph',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['josephHeart'] },
    acquired: (ctx) => (C(ctx)?.joseph?.hearts || 0) >= 2,
    steps: [
      {
        id: 'heart',
        say: () => 'Un cœur d\'amitié ! Voyez ce qu\'il vous ouvre : Carnet, Joseph.',
        face: 'proud',
        target: () => TAB.journal,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.contest',
    chapter: 'career',
    title: 'Le comice agricole',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['contestAnnounced'] },
    acquired: (ctx) => (C(ctx)?.lifetime?.contestsWon || 0) > 0 || year(ctx) >= 4,
    steps: [
      {
        id: 'what',
        say: () => 'Le comice ! Trois épreuves, jugées le dernier soir d\'automne.',
        face: 'happy',
        target: () => TAB.journal,
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'where',
        say: () => 'Vos progrès sont dans le Carnet, à l\'Agenda.',
        face: 'content',
        target: () => TAB.journal,
        gesture: 'tap',
        done: { button: 'Compris' },
      },
    ],
  },
  rankLesson(3),
  {
    id: 'career.traction',
    chapter: 'career',
    title: 'Cheval ou tracteur',
    modes: ['career'],
    tier: 'E',
    priority: 70,
    trigger: { on: ['machineBought', 'dawn'], when: (ctx) => machines(ctx).some((m) => m.id === 'seeder' || m.id === 'harvester') && !hasHorse(ctx) && !hasTractor(ctx) },
    stillRelevant: (ctx) => !hasHorse(ctx) && !hasTractor(ctx),
    acquired: (ctx) => hasHorse(ctx) || hasTractor(ctx),
    steps: [
      {
        id: 'need',
        say: () => 'Il lui faut un cheval ou un tracteur pour avancer.',
        face: 'content',
        target: () => TAB.buy,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.animals3',
    chapter: 'career',
    title: 'Cochons, lapins, chevaux',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['buildingBuilt'], when: (ctx) => ['pigsty', 'hutch', 'stable'].includes(ctx.ev?.buildingId) },
    acquired: (ctx) => ['pigsty', 'hutch', 'stable'].some((id) => built(ctx, id)),
    steps: [
      {
        id: 'what',
        say: (ctx) => {
          const id = ['pigsty', 'hutch', 'stable'].find((b) => b === ctx.ev?.buildingId) || ['pigsty', 'hutch', 'stable'].find((b) => built(ctx, b));
          if (id === 'hutch') return 'Chaque saison, les lapins font des petits.';
          if (id === 'stable') return 'Le cheval tire les machines, et promène les hôtes.';
          return 'En automne et en hiver, les cochons trouvent des truffes.';
        },
        face: 'happy',
        target: (ctx) => {
          const id = ['pigsty', 'hutch', 'stable'].find((b) => built(ctx, b)) || 'pigsty';
          return shelterTarget({ buildingId: id });
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.guestHouse',
    chapter: 'career',
    title: 'La chambre d\'hôte',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['buildingBuilt'], when: (ctx) => ctx.ev?.buildingId === 'guestHouse' },
    acquired: (ctx) => built(ctx, 'guestHouse'),
    steps: [
      {
        id: 'guests',
        say: () => 'Des hôtes viennent dormir : ça rapporte, surtout l\'été.',
        face: 'happy',
        target: () => ({ scene: { type: 'building', buildingId: 'guestHouse' }, label: 'la chambre d\'hôte' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.pond',
    chapter: 'career',
    title: 'La mare',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['buildingBuilt', 'lotDeveloped'], when: (ctx) => ctx.ev?.buildingId === 'duckPond' || ctx.ev?.lotType === 'pond' },
    acquired: (ctx) => built(ctx, 'duckPond') && (C(ctx)?.events?.fishedDay || 0) > 0,
    steps: [
      {
        id: 'fish',
        say: () => 'Touchez le ponton : une pêche par jour, même l\'hiver.',
        face: 'happy',
        target: (ctx) => ({ scene: { type: 'pond', buildingId: 'duckPond', lotId: building(ctx, 'duckPond')?.lotId || lastLotOfType(ctx, 'pond')?.id }, label: 'le ponton de la mare' }),
        gesture: 'tap',
        done: { on: 'fishCaught' },
        buttons: ['later'],
      },
    ],
  },
  rankLesson(4),
  {
    id: 'career.tractor',
    chapter: 'career',
    title: 'Le tracteur',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['machineBought'], when: (ctx) => ctx.ev?.id === 'tractor' },
    acquired: (ctx) => hasTractor(ctx),
    steps: [
      {
        id: 'what',
        say: () => 'Le tracteur : machines de niveau 2, jardiniers plus rapides.',
        face: 'proud',
        target: (ctx) => {
          const m = machines(ctx).find((x) => x.id === 'tractor');
          return m ? { scene: { type: 'machine', key: m.key }, label: 'le tracteur' } : TAB.buy;
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.mood',
    chapter: 'career',
    title: 'L\'humeur de l\'équipe',
    modes: ['career'],
    tier: 'U',
    priority: 40,
    trigger: { on: ['staffMood'], when: (ctx) => ctx.ev?.mood === 'tired' },
    stillRelevant: (ctx) => staff(ctx).some((s) => s.mood === 'tired'),
    acquired: (ctx) => year(ctx) >= 4,
    steps: [
      {
        id: 'tired',
        say: () => 'Un employé est las. 2 jours de congé ou une fête, et ça repart.',
        face: 'content',
        target: () => TAB.staff,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  rankLesson(5),
  {
    id: 'career.attraction',
    chapter: 'career',
    title: 'Une belle ferme',
    modes: ['career'],
    tier: 'U',
    priority: 20,
    trigger: {
      on: ['dawn', 'decor'],
      when: (ctx) => Object.entries(C(ctx)?.cosmetics?.decor || {}).some(([k, v]) => v && /^lot\d+(?:[we]\d)?\.corner$/.test(k)),
    },
    steps: [
      {
        id: 'pretty',
        say: () => 'Plus la ferme est belle, plus les touristes viennent.',
        face: 'proud',
        target: (ctx) => {
          const k = Object.entries(C(ctx)?.cosmetics?.decor || {}).find(([key, v]) => v && /\.corner$/.test(key))?.[0];
          const lotId = k ? k.split('.')[0].replace(/[we]\d$/, '') : null;
          return lotId ? lotSign(lotId, 'l\'embellissement') : TAB.money;
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'career.rank6',
    chapter: 'career',
    title: 'Le Domaine',
    modes: ['career'],
    tier: 'E',
    priority: 75,
    trigger: { on: ['rankClosed'], when: (ctx) => (ctx.signal?.data?.rank ?? rank(ctx)) === 6 },
    acquired: (ctx) => rank(ctx) >= 6,
    steps: [
      {
        id: 'domain',
        say: () => 'Un Domaine ! 16 terrains, et le comice régional.',
        face: 'proud',
        target: () => TAB.journal,
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'free',
        say: () => 'Maintenant, tout le temps est à vous.',
        face: 'happy',
        target: () => TAB.journal,
        gesture: 'look',
        done: { button: 'Merci, Joseph !' },
      },
    ],
  },
]);

// ── Rappels de la carrière (§ 8.4) ───────────────────────────────────────────────────────────

const winter = (ctx) => (ctx.day?.seasonId || '') === 'winter';
const fieldSown = (ctx) => plots(ctx).some((p) => p.cropId && p.lotType !== 'greenhouse' && p.kind !== 'tree');
const hasSeller = (ctx) => staff(ctx).some((s) => s.job === 'seller' && !s.onLeave);
const stockTotal = (ctx) => Object.values(C(ctx)?.stock || {}).reduce((a, n) => a + (n || 0), 0);
function goodStock(ctx) {
  const stock = C(ctx)?.stock || {};
  const market = cq(ctx, 'market', {}) || {};
  return Object.keys(stock).filter((id) => (stock[id] || 0) > 0 && (market[id]?.multiplier || 1) >= 1.15).sort((a, b) => (market[b]?.multiplier || 1) - (market[a]?.multiplier || 1))[0] || null;
}
const CROP_THE = { wheat: 'du blé', corn: 'du maïs', potato: 'de la pomme de terre', carrot: 'de la carotte', turnip: 'du navet', cabbage: 'du chou', tomato: 'de la tomate', sunflower: 'du tournesol', strawberry: 'de la fraise', pumpkin: 'de la citrouille', apple: 'de la pomme' };

export const REMINDERS = [
  {
    id: 'shelter',
    modes: ['career'],
    chapter: 'career',
    title: 'Un abri plein',
    example: 'Le poulailler est plein : un toucher et c\'est ramassé.',
    when: (ctx) => {
      const s = fullShelter(ctx);
      const at = since(ctx, 'shelter', !!s);
      return s ? { since: at, text: `${isFull(s.buildingId)} : un toucher et c'est ramassé.`, target: shelterTarget(s) } : null;
    },
    wait: 1,
    todo: 'collect',
  },
  {
    id: 'waiting',
    modes: ['career'],
    chapter: 'cozy',
    title: 'Vos récoltes vous attendent',
    example: 'Vos récoltes vous attendent encore un jour : +25 % à la main.',
    when: (ctx) => {
      const p = plots(ctx).find((x) => x.action === 'harvest' && x.wait && !x.wait.freeze && (x.wait.staffIn === 1 || x.wait.machineIn === 1));
      const at = since(ctx, 'waiting', !!p);
      return p ? { since: at, text: 'Vos récoltes vous attendent encore un jour : +25 % à la main.', target: { plot: p.index, label: 'une récolte qui vous attend' } } : null;
    },
    wait: 0,
    todo: 'cz-ripe',
  },
  {
    id: 'leave',
    modes: ['career'],
    chapter: 'career',
    title: 'Le congé d\'hiver',
    example: 'Les champs dorment : un congé pour l\'équipe ?',
    when: (ctx) => {
      const ok = winter(ctx) && (T(ctx).dayOfSeason || 1) >= 2 && staff(ctx).some((s) => !s.onLeave) && !fieldSown(ctx);
      const at = since(ctx, 'leave', ok);
      return ok ? { since: at, text: 'Les champs dorment : un congé pour l\'équipe ?', target: TAB.staff } : null;
    },
    wait: 0,
    todo: (ctx) => ({ id: 'coach-leave', prio: 70, text: 'Les champs dorment : un congé pour l\'équipe ?', short: 'un congé pour l\'équipe', icon: 'calendar', go: (app) => app.careerUI?.open?.team?.() }),
    go: (app) => app.careerUI?.open?.team?.(),
    oncePerSeason: true,
  },
  {
    id: 'stock',
    modes: ['career'],
    chapter: 'career',
    title: 'Le bon prix au grenier',
    example: 'Le cours du blé est haut : c\'est le moment de vendre.',
    when: (ctx) => {
      const crop = stockTotal(ctx) >= 10 && !hasSeller(ctx) ? goodStock(ctx) : null;
      const at = since(ctx, 'stock', !!crop);
      return crop ? { since: at, text: `Le cours ${CROP_THE[crop] || 'd\'une récolte'} est haut : c'est le moment de vendre.`, target: { scene: { type: 'building', buildingId: 'storage' }, label: 'le grenier' } } : null;
    },
    wait: 0,
    todo: (ctx) => {
      const crop = goodStock(ctx);
      return crop ? { id: 'coach-stock', prio: 65, text: `Le cours ${CROP_THE[crop] || 'd\'une récolte'} est haut : vendez au grenier`, short: 'vendre au grenier', icon: 'coin', go: (app) => app.careerUI?.open?.storage?.() } : null;
    },
    go: (app) => app.careerUI?.open?.storage?.(),
  },
  {
    id: 'quest',
    modes: ['career'],
    chapter: 'career',
    title: 'Une quête de Joseph',
    example: 'J\'ai vu que vous aviez de quoi me rendre service !',
    when: (ctx) => {
      const q = cq(ctx, 'quest', null);
      const ok = !!q && !!q.accepted && !!q.canDeliver;
      const at = since(ctx, 'quest', ok);
      return ok ? { since: at, text: 'J\'ai vu que vous aviez de quoi me rendre service !', target: TAB.todo } : null;
    },
    wait: 1,
    todo: 'quest',
  },
  {
    id: 'offer',
    modes: ['career'],
    chapter: 'career',
    title: 'Un visiteur attend',
    example: 'Mme Leblanc attend votre réponse. Refuser ne coûte rien.',
    when: (ctx) => {
      const o = offersOpen(ctx)[0];
      const at = since(ctx, `offer-${o?.id ?? ''}`, !!o);
      const who = o?.data?.name || o?.title || 'Un visiteur';
      return o ? { since: at, text: `${capital(who)} attend votre réponse. Refuser ne coûte rien.`, target: TAB.todo } : null;
    },
    wait: 2,
    todo: (ctx) => {
      const o = offersOpen(ctx)[0];
      return o ? `offer-${o.id}` : null;
    },
    go: (app) => {
      const o = (app.game?.query?.career?.events?.()?.offers || []).find((x) => !x.accepted && x.kind !== 'themeVisitor');
      if (o) app.careerUI?.open?.offer?.(o.id);
    },
  },
];

// Exportés pour les tests et lots.js.
export const _helpers = { safe, cq, since, shelterName };
