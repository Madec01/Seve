// Mode Carrière — le Carnet (§ 10.7), « hub » de la carrière, onglets segmentés (≥ 48 px) :
//   Ferme  : blason du rang, titre, patrimoine vers le seuil suivant, objectifs, déblocages ;
//   Bilan  : charges (quotidiennes, de saison), l'année en cours par poste, années passées ;
//   Marché : grenier et cours du jour ;
//   Agenda : fêtes, comice, événement du jour, offres, quête de Joseph ;
//   Joseph : portrait, cœurs, prochain cadeau d'amitié, dette et remboursement.

import { el, fmt, gain, loss, plural, signed } from '../dom.js';
import { icon, cropIcon } from '../icons.js';
import { season, difficultyName } from '../text.js';
import { bar, cBtn, cIcon, CHARGE_LABELS, INCOME_LABELS, SPENT_LABELS, joseph, josephSays, line, rankIcon, animalIcon, lotIcon, buildingIcon, machineIcon, inDays } from './util.js';
import { marketSection } from './buildings.js';
import { offerCard, questCard } from './events.js';

const TABS = [
  { id: 'farm', label: 'Ferme' },
  { id: 'report', label: 'Bilan' },
  { id: 'market', label: 'Marché' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'joseph', label: 'Joseph' },
];

export function journalContent(ui) {
  const tab = TABS.some((t) => t.id === ui.journalTab) ? ui.journalTab : 'farm';
  const seg = el(
    'div.seg.c-seg5',
    { role: 'tablist', 'aria-label': 'Carnet' },
    TABS.map((t) =>
      el(
        `button.seg-btn${t.id === tab ? '.is-active' : ''}`,
        { type: 'button', role: 'tab', id: `c-jtab-${t.id}`, 'aria-selected': t.id === tab ? 'true' : 'false', onclick: () => {
          if (t.id === tab) return;
          ui.app.audio.play('page', { volume: 0.7 });
          ui.setJournalTab(t.id);
        } },
        el('span', t.label),
        el(`span.seg-dot${dotFor(ui, t.id) ? '.is-on' : ''}`, { 'aria-hidden': 'true' }),
      ),
    ),
  );
  let body;
  try {
    body = { farm: farmTab, report: reportTab, market: marketTab, agenda: agendaTab, joseph: josephTab }[tab](ui);
  } catch (err) {
    console.warn('Carnet :', err);
    body = el('p.sheet-empty', 'Cette page du carnet n\'est pas encore prête.');
  }
  return el('div.c-journal', seg, el('div.c-jpanel', { role: 'tabpanel' }, body));
}

function dotFor(ui, tab) {
  if (tab === 'agenda') {
    const quest = ui.q('quest', null);
    const offers = ui.q('events', null)?.offers || [];
    return (quest && !quest.accepted) || offers.length > 0;
  }
  return false;
}

// ── Ferme ───────────────────────────────────────────────────────────────────────
function farmTab(ui) {
  const { app, q, game } = ui;
  const s = q('summary', null);
  if (!s) return el('p.sheet-empty', 'Carnet indisponible.');
  const n = s.nextRank;
  const prevThreshold = 0;
  const parts = [
    el(
      'div.c-crest',
      el('span.c-crest-icon', rankIcon(s.rank, 'sprite--hero')),
      el(
        'div.c-crest-main',
        el('b.c-crest-farm', s.farmName),
        el('span.c-crest-rank', `${s.rankName} · rang ${s.rank}/6`),
        el('span.c-crest-title', s.title),
        el('small', `Année ${s.year} · ${season(s.seasonId)}, jour ${s.day} · ${difficultyName(s.difficulty)} · saisons de ${s.seasonLength} jours`),
      ),
    ),
    el(
      'section.c-sec',
      el('h3.stats-title', cIcon('patrimony', 'sprite--sm', 'coin'), 'Patrimoine'),
      el('div.c-patri', el('b', `${fmt(s.patrimony)}`), n ? el('span', ` / ${fmt(n.patrimony)} pour « ${n.name} »`) : el('span', ' · rang maximal !')),
      n ? bar(Math.max(0, s.patrimony - prevThreshold), n.patrimony - prevThreshold, s.patrimony >= n.patrimony ? 'is-full' : '') : null,
      el('p.stats-note', 'Patrimoine = argent + terrains + la moitié de ce que valent vos aménagements, bâtiments, machines et animaux − dette.'),
    ),
  ];
  if (n) {
    parts.push(
      el(
        'section.c-sec',
        el('h3.stats-title', rankIcon(n.rank, 'sprite--sm'), `Pour devenir « ${n.name} »`),
        el(
          'div.c-objs',
          el(`div.c-obj${s.patrimony >= n.patrimony ? '.is-done' : ''}`, el('span.c-obj-box', s.patrimony >= n.patrimony ? '✓' : ''), el('span.c-obj-label', `Patrimoine de ${fmt(n.patrimony)}`), el('small', `${fmt(Math.min(s.patrimony, n.patrimony))} / ${fmt(n.patrimony)}`)),
          n.objectives.map((o) =>
            el(
              `div.c-obj${o.done ? '.is-done' : ''}`,
              { id: `c-obj-${o.id}` },
              el('span.c-obj-box', o.done ? '✓' : ''),
              el('span.c-obj-label', o.label),
              el('small', o.target > 1 ? `${fmt(o.progress)} / ${fmt(o.target)}` : o.done ? 'fait' : 'à faire'),
              o.target > 1 && !o.done ? bar(o.progress, o.target) : null,
            ),
          ),
        ),
        n.unlocks?.length
          ? el(
              'div.c-unlocks',
              el('small.c-unlocks-title', 'Ce rang débloquera :'),
              el('div.c-unlock-list', n.unlocks.slice(0, 16).map((u) => el('span.c-unlock.is-locked', unlockIcon(u), el('span', unlockName(u))))),
            )
          : null,
      ),
    );
  }
  parts.push(
    el(
      'div.sheet-actions',
      cBtn(app, [cIcon('map', 'sprite--sm', 'seed'), 'Carte'], () => ui.open.map(), { id: 'c-j-map' }),
      app.progression?.available() ? cBtn(app, [icon('star', 'sm'), 'Succès'], () => app.grange.open('achievements'), { id: 'c-j-ach' }) : null,
    ),
  );
  void game;
  return el('div.c-jfarm', parts);
}

/** Nom d'un déblocage (sans « niv. 2 (niv. 2) » en double). */
export function unlockName(u) {
  return String(u.name || '').replace(/ niv\. (\d) \(niv\. \1\)/, ' niv. $1');
}

export function unlockIcon(u, cls = 'sprite--sm') {
  switch (u.kind) {
    case 'crop':
      return cropIcon(u.id, cls);
    case 'animal':
      return animalIcon(u.id, cls);
    case 'lotType':
      return lotIcon(u.id, cls);
    case 'building':
      return buildingIcon(u.id, u.level || 1, cls);
    case 'machine':
      return machineIcon(u.id, cls);
    case 'lots':
      return lotIcon('forSale', cls);
    default:
      return cIcon(u.id === 'hire' ? 'hire' : u.id === 'quests' ? 'quest' : 'level', cls, 'star');
  }
}

// ── Bilan ───────────────────────────────────────────────────────────────────────
export function chargesContent(ui) {
  const { q, game } = ui;
  const ch = q('charges', null);
  if (!ch) return el('p.sheet-empty', 'Indisponible.');
  const daily = ch.daily || [];
  const s = ch.season || {};
  const finance = game.query.finance();
  return el(
    'div.info-sheet.c-charges',
    el(
      'section.c-sec',
      el('h3.stats-title', 'Chaque matin'),
      daily.length ? daily.map((d) => line(CHARGE_LABELS[d.source] || d.source, d.source === 'solar' ? gain(d.amount) : loss(d.amount), d.source === 'solar' ? 'pos' : 'neg')) : el('p.stats-empty', 'Aucune charge quotidienne.'),
      el('div.stats-total', line('Total des charges', `${loss(ch.dailyTotal ?? daily.reduce((t, d) => t + d.amount, 0))} / jour`, 'neg')),
      finance.dailyIncome ? line('Revenus automatiques (animaux, étal…)', `${gain(finance.dailyIncome)} / jour`, 'pos') : null,
      el('p.stats-note', 'Salaires et carburant ne sont jamais prélevés quand l\'argent est négatif.'),
    ),
    el(
      'section.c-sec',
      el('h3.stats-title', 'Charges de saison (impôts et assurance)'),
      line(`${season(s.seasonId || 'spring')} : le soir du dernier jour`, `${fmt(s.amount || 0)} pièces`, 'neg'),
      line('Échéance', s.daysLeft === 0 ? 'ce soir' : inDays(s.daysLeft)),
      s.lots ? line(`Dont terrains (${s.lots} × ${fmt(s.perLot || 0)})`, fmt((s.lots || 0) * (s.perLot || 0))) : null,
      el('p.stats-note', 'Elles grandissent avec la ferme (par terrain acheté), pas avec le temps.'),
    ),
  );
}

function reportTab(ui) {
  const { q, game } = ui;
  const r = q('yearReport', null);
  const hist = q('history', []) || [];
  const parts = [chargesContent(ui)];
  if (r) {
    const inc = Object.entries(r.incomeBy || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const sp = Object.entries(r.spentBy || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    parts.push(
      el(
        'section.c-sec',
        el('h3.stats-title', `Année ${r.year} jusqu'ici`),
        inc.length ? inc.map(([k, v]) => line(INCOME_LABELS[k] || k, gain(v), 'pos')) : el('p.stats-empty', 'Aucun revenu pour l\'instant.'),
        sp.map(([k, v]) => line(SPENT_LABELS[k] || k, loss(v), 'neg')),
        el('div.stats-total', line('Bénéfice de l\'année', signed(r.net), r.net >= 0 ? 'pos' : 'neg')),
        r.bestCrop ? el('p.stats-note', cropIcon(r.bestCrop.cropId, 'sprite--xs'), ` Meilleure culture : ${r.bestCrop.name} (${fmt(r.bestCrop.income)} pièces, ${plural(r.bestCrop.count, 'récolte')})`) : null,
        r.debt ? line('Dette envers Joseph', `${fmt(r.debt)} pièces`, 'warn') : null,
      ),
    );
  }
  if (hist.length) {
    const max = Math.max(1, ...hist.map((h) => Math.abs(h.net)));
    const best = hist.reduce((b, h) => (!b || h.net > b.net ? h : b), null);
    parts.push(
      el(
        'section.c-sec',
        el('h3.stats-title', 'Années passées'),
        el(
          'div.c-years',
          hist.slice(-10).map((h) =>
            el(
              `div.c-year${h === best ? '.is-best' : ''}`,
              el('span.c-year-n', `An ${h.year}`),
              el('span.c-year-bar', el(`span.c-year-fill${h.net < 0 ? '.is-neg' : ''}`, { style: { width: `${Math.round((Math.abs(h.net) / max) * 100)}%` } })),
              el(`b.${h.net >= 0 ? 'pos' : 'neg'}`, signed(h.net)),
            ),
          ),
        ),
        best ? el('p.stats-note', `Meilleure année : l'année ${best.year} (${signed(best.net)}).`) : null,
      ),
    );
  }
  void game;
  return el('div.c-jreport', parts);
}

// ── Marché ──────────────────────────────────────────────────────────────────────
function marketTab(ui) {
  const { app, q } = ui;
  const s = q('stock', null);
  const b = q('building', null, 'storage');
  return el(
    'div.c-jmarket',
    b && b.level > 0 && s
      ? el(
          'div.c-stock-head',
          el('span.c-stock-cap', el('b', `${fmt(s.used)} / ${fmt(s.capacity)}`), el('small', `au grenier · valeur ${fmt(s.value)} pièces`)),
          bar(s.used, s.capacity, s.used >= s.capacity ? 'is-full' : ''),
        )
      : el('p.stats-note', 'Pas encore de grenier (rang 2, 400 pièces) : il garde les récoltes pour les vendre au bon cours.'),
    cBtn(app, [cIcon('storage', 'sprite--sm', 'coin'), b && b.level > 0 ? 'Ouvrir le grenier' : 'Voir le grenier'], () => ui.open.storage(), { id: 'c-j-storage', cls: 'btn--wide' }),
    marketSection(ui),
  );
}

// ── Agenda ──────────────────────────────────────────────────────────────────────
function agendaTab(ui) {
  const { q } = ui;
  const ev = q('events', null) || { today: null, active: null, offers: [], calendar: [], contest: null };
  const quest = q('quest', null);
  const parts = [];
  if (ev.today) parts.push(el('div.c-today', cIcon('event', 'sprite--md', 'star'), el('div', el('b', `Aujourd'hui : ${ev.today.name}`), ev.today.text || ev.today.description ? el('small', ev.today.text || ev.today.description) : null)));
  if (ev.active) parts.push(el('div.c-today.is-active', cIcon(ev.active.kind === 'crows' ? 'crow' : 'event', 'sprite--md', 'star'), el('div', el('b', ev.active.name || ev.active.data?.name || 'Événement en cours'), el('small', ev.active.text || ev.active.data?.text || ''))));
  if (quest) parts.push(el('section.c-sec', el('h3.stats-title', cIcon('quest', 'sprite--sm', 'star'), 'Quête de Joseph'), questCard(ui, quest)));
  if (ev.offers?.length) parts.push(el('section.c-sec', el('h3.stats-title', 'Propositions'), ev.offers.map((o) => offerCard(ui, o))));
  if (ev.contest) parts.push(contestSection(ev.contest));
  const cal = ev.calendar || [];
  if (cal.length) {
    parts.push(
      el(
        'section.c-sec',
        el('h3.stats-title', cIcon('calendar', 'sprite--sm', 'calendar'), 'Fêtes de l\'année'),
        el(
          'div.c-cal',
          cal.map((c) =>
            el(
              `div.c-cal-row${c.done ? '.is-done' : ''}${c.daysUntil === 0 ? '.is-today' : ''}`,
              icon(c.seasonId || 'spring', 'sm'),
              el('span.c-cal-name', c.name),
              el('small', c.done ? 'passée ✓' : c.daysUntil === 0 ? 'aujourd\'hui !' : `${season(c.seasonId).toLowerCase()}, jour ${c.day} · ${inDays(c.daysUntil)}`),
            ),
          ),
        ),
      ),
    );
  }
  if (!parts.length) parts.push(el('p.sheet-empty', 'Rien de prévu pour l\'instant. Les fêtes, le comice, les visiteurs et les quêtes de Joseph apparaîtront ici.'));
  return el('div.c-jagenda', parts);
}

function contestSection(c) {
  const goals = c.goals || [];
  return el(
    'section.c-sec',
    el('h3.stats-title', cIcon('contest', 'sprite--sm', 'star'), 'Comice agricole'),
    el('p.stats-note', c.awarded ? 'Le jury est passé.' : c.daysLeft === 0 ? 'Jugement ce soir !' : `Jugement ${inDays(c.daysLeft)} (dernier soir de l'automne).`),
    goals.map((g) =>
      el(
        `div.contest-goal${g.done ? '.is-done' : ''}`,
        el('div.contest-top', el('span.contest-name', g.done ? '✓ ' : '', g.label), el('b', `${fmt(Math.min(g.progress ?? 0, g.target))} / ${fmt(g.target)}`)),
        el('span.contest-bar', el('span.contest-bar-fill', { style: { width: `${Math.round(Math.min(1, (g.progress ?? 0) / Math.max(1, g.target)) * 100)}%` } })),
      ),
    ),
    c.prizePerGoal ? el('p.stats-note', `${fmt(c.prizePerGoal)} pièces par épreuve réussie, autant en plus si les trois le sont.`) : null,
  );
}

// ── Joseph ──────────────────────────────────────────────────────────────────────
function josephTab(ui) {
  const { app, q, game } = ui;
  const j = q('joseph', null) || { hearts: 0, nextGift: null, loan: null };
  const hearts = Math.max(0, Math.min(10, j.hearts || 0));
  const loan = j.loan || game.query.finance().neighbourLoan;
  const quest = q('quest', null);
  const parts = [
    josephSays(hearts >= 6 ? '« Toujours un plaisir de passer vous voir, voisin ! »' : hearts >= 2 ? '« Alors, cette ferme ? Elle grandit bien ! »' : '« Si vous avez besoin d\'un coup de main, je ne suis pas loin. »', hearts >= 6 ? 'happy' : 'content'),
    el(
      'section.c-sec',
      el('h3.stats-title', cIcon('heart', 'sprite--sm', 'star'), `Amitié : ${hearts} / 10`),
      el('div.c-hearts', Array.from({ length: 10 }, (_, i) => cIcon(i < hearts ? 'heart' : 'heart.empty', 'sprite--sm', i < hearts ? 'star' : 'star-empty'))),
      j.nextGift ? el('p.stats-note', `À ${j.nextGift.hearts} ♥ : ${j.nextGift.text}`) : el('p.stats-note', '+1 ♥ par quête réussie, +1 ♥ quand un prêt est remboursé en entier.'),
    ),
  ];
  if (quest) parts.push(el('section.c-sec', el('h3.stats-title', 'Sa demande'), questCard(ui, quest)));
  if (loan) {
    if (loan.debt > 0) {
      parts.push(
        el(
          'section.c-sec.neighbour-section.has-debt',
          el('h3.stats-title', 'Ce que vous lui devez'),
          line('Reste à rendre', `${fmt(loan.debt)} pièces`, 'warn'),
          el('p.stats-note', 'La moitié de chaque vente le rembourse toute seule. Vous pouvez aussi le rembourser plus tôt.'),
          el(
            'div.repay-grid',
            [20, 50, 100].filter((n) => n < loan.debt).map((n) => repayBtn(app, n, 'Rendre', `c-repay-${n}`, game)),
            repayBtn(app, loan.debt, 'Tout rendre', 'c-repay-all', game),
          ),
        ),
      );
    } else parts.push(el('p.stats-note', `S'il vous manque de l'argent un soir de charges, Joseph vous avance jusqu'à ${fmt(loan.maxMissing ?? 0)} pièces${loan.surcharge ? ` (à rendre avec ${Math.round(loan.surcharge * 100)} % de plus)` : ' (sans supplément)'}.`));
  } else parts.push(el('p.stats-note', 'En mode Classique, Joseph ne prête pas d\'argent : gardez des réserves pour les charges de saison.'));
  return el('div.c-jjoseph', parts);
}

function repayBtn(app, amount, label, id, game) {
  const can = game.state.money >= amount;
  return el(
    `button.btn.btn--repay${can ? '.btn--red' : '.is-disabled'}`,
    { type: 'button', id, 'aria-disabled': can ? 'false' : 'true', onclick: () => (can ? app.repayNeighbour(amount) : app.repayNeighbour(amount, { explain: true })) },
    el('span.buy-label', label),
    el('span.buy-cost', icon('coin', 'sm'), fmt(amount)),
  );
}

export { joseph };
