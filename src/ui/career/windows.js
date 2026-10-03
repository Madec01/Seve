// Mode Carrière — fenêtres (§ 10.8) : bilan de l'année, passage de rang, Joseph vous dépanne, une passe
// difficile (coup dur), vente de secours, faillite (Classique), accueil de Joseph, au revoir d'un employé.
// Seuls le passage de rang, le bilan annuel, le coup dur et la faillite mettent le jeu en pause.
//
// createCareerWindows(app, { getGame, openJournal, openTeam }) → {
//   queue(kind, ev), queueBanner(banner), process(), reset(), intro(game), farewell(staff) }
// Les fenêtres attendent la fin de la journée (processPending) et s'enchaînent une à une, dans l'ordre :
// faillite → prêt de Joseph → vente de secours → coup dur → rang → bilan de l'année ; le bandeau de la
// nouvelle saison vient ensuite.

import { el, fmt, gain, loss, plural, signed } from '../dom.js';
import { icon, achievementIcon, ecuIcon, cropIcon } from '../icons.js';
import { season } from '../text.js';
import { bar, cIcon, INCOME_LABELS, SPENT_LABELS, josephSays, rankIcon, animalIcon, machineIcon, portrait } from './util.js';
import { unlockIcon, unlockName } from './journal.js';

const ORDER = ['bankrupt', 'loan', 'rescue', 'hardship', 'rank', 'year'];

export function createCareerWindows(app, { getGame, openJournal }) {
  let pending = [];
  let banner = null;

  function reset() {
    pending = [];
    banner = null;
  }

  function queue(kind, ev) {
    if (kind === 'bankrupt') pending = [];
    pending.push({ kind, ev });
    pending.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  }

  function queueBanner(b) {
    banner = b;
  }

  function process() {
    const g = getGame();
    if (!g || app.dialogs.isOpen()) return;
    if (pending.length) {
      const item = pending.shift();
      app.sheets.close('silent');
      const show = { bankrupt, loan, rescue, hardship, rank, year }[item.kind];
      try {
        show(item.ev, g);
      } catch (err) {
        console.warn(`Fenêtre de carrière (${item.kind}) :`, err);
      }
      return;
    }
    if (banner) {
      app.toasts.banner({ ...banner, duration: banner.duration || 4600 });
      banner = null;
    }
  }

  const btn = (...a) => app.dialogs.btn(...a);
  const next = () => app.dialogs.closeTop();

  function burst(node) {
    if (!node || app.reducedMotion?.()) return;
    const b = el('span.confetti.c-confetti', { 'aria-hidden': 'true' });
    for (let k = 0; k < 18; k++) {
      const c = el('i');
      c.style.setProperty('--a', `${Math.round((360 / 18) * k + Math.random() * 14)}deg`);
      c.style.setProperty('--d', `${60 + Math.round(Math.random() * 70)}px`);
      c.style.setProperty('--c', ['#fddc00', '#e2665b', '#7cc955', '#63aff3', '#fff1d2'][k % 5]);
      b.append(c);
    }
    node.append(b);
    setTimeout(() => b.remove(), 1400);
  }

  /** Écus et succès gagnés (bilan de l'année, passage de rang). */
  function rewardsNode(rec) {
    if (!rec) return null;
    const ecus = (rec.rewards?.ecus || 0) + (rec.rewards?.achievementEcus || 0);
    const achs = rec.achievements || [];
    const nodes = [];
    if (ecus) nodes.push(el('p.end-ecus', ecuIcon('sprite--sm'), `+${plural(ecus, 'écu')}`, el('small', ` (vous en avez ${fmt(app.progression.ecus())})`)));
    if (achs.length) {
      nodes.push(
        el(
          'div.end-achs',
          el('h3.sum-title', icon('star', 'sm'), achs.length > 1 ? `${achs.length} succès débloqués` : 'Succès débloqué'),
          el('div.end-ach-list', achs.map((id) => {
            const d = app.progression.achievementDef(id);
            return el('span.end-ach', achievementIcon(id, true, 'sprite--md', d?.reward?.stars || 0), el('span', d?.name || id), d?.reward ? el('small', app.progression.rewardText(d.reward)) : null);
          })),
        ),
      );
    }
    return nodes.length ? el('div.end-rewards', nodes) : null;
  }

  // ── Bilan de l'année ──────────────────────────────────────────────────────────
  function year(ev, g) {
    const r = ev.report || {};
    const y = ev.year ?? r.year ?? g.state.time.year - 1;
    let rec = null;
    const albumBefore = app.album?.available?.() ? app.album.snapshot() : null;
    try {
      rec = app.progression.careerYear?.({ year: y, rank: r.rank, net: r.net, report: r, career: g.query.career.achievementContext?.(), context: g.query.achievementContext?.() }) || null;
    } catch (err) {
      console.warn('recordCareerYear :', err);
    }
    // (Lot 4) Cases de l'album trouvées par le bilan de l'année.
    if (albumBefore) app.album.announceSince(albumBefore);
    const inc = Object.entries(r.incomeBy || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const sp = Object.entries(r.spentBy || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    let s = null;
    try {
      s = g.query.career.summary();
    } catch {
      s = null;
    }
    const n = s?.nextRank;
    const body = el(
      'div.end-screen.c-year-end',
      el('p.end-farm', `${s?.farmName || ''} · ${r.rankName || s?.rankName || ''}`),
      el('div.c-year-net', el('small', 'Bénéfice de l\'année'), el(`b.${(r.net || 0) >= 0 ? 'pos' : 'neg'}`, signed(r.net || 0)), el('small', `Il vous reste ${plural(g.state.money, 'pièce')} · patrimoine ${fmt(r.patrimony ?? s?.patrimony ?? 0)}`)),
      r.bestCrop ? el('p.c-best', cropIcon(r.bestCrop.cropId, 'sprite--md'), el('span', `Meilleure culture : ${r.bestCrop.name}`, el('small', ` · ${fmt(r.bestCrop.income)} pièces`))) : null,
      el(
        'div.c-year-cols',
        el('div.sum-lines', el('h3.sum-title', 'Revenus'), inc.length ? inc.map(([k, v]) => el('div.sum-line', el('span', INCOME_LABELS[k] || k), el('b.pos', gain(v)))) : el('p.stats-empty', 'Aucun.'), el('div.sum-total', el('div.sum-line', el('span', 'Total'), el('b.pos', gain(r.income || 0))))),
        el('div.sum-lines', el('h3.sum-title', 'Dépenses'), sp.length ? sp.map(([k, v]) => el('div.sum-line', el('span', SPENT_LABELS[k] || k), el('b.neg', loss(v)))) : el('p.stats-empty', 'Aucune.'), el('div.sum-total', el('div.sum-line', el('span', 'Total'), el('b.neg', loss(r.spent || 0))))),
      ),
      r.joseph?.questsDone ? el('p.stats-note.c-year-joseph', `Quêtes de Joseph réussies : ${r.joseph.questsDone}${r.questEcus ? ` · ${plural(r.questEcus, 'écu')} déjà gagnés` : ''} · amitié ${r.joseph.hearts || 0} ♥`) : null,
      app.cozy?.yearBlock?.(r) || null,
      app.valley?.yearBlock?.(r) || null,
      app.variety?.yearLines?.(r) || null,
      el('p.stats-note', `${plural(r.harvests || 0, 'récolte')} cette année${r.lotsBought ? ` · ${plural(r.lotsBought, 'terrain')} à vous` : ''}${r.debt ? ` · dette envers Joseph : ${fmt(r.debt)}` : ''}.`),
      n
        ? el(
            'div.c-year-rank',
            el('h3.sum-title', rankIcon(n.rank, 'sprite--sm'), `Prochain rang : ${n.name}`),
            el('div.c-obj', el('span.c-obj-box', (s.patrimony || 0) >= n.patrimony ? '✓' : ''), el('span.c-obj-label', `Patrimoine ${fmt(n.patrimony)}`), el('small', `${fmt(Math.min(s.patrimony, n.patrimony))} / ${fmt(n.patrimony)}`)),
            n.objectives.map((o) => el(`div.c-obj${o.done ? '.is-done' : ''}`, el('span.c-obj-box', o.done ? '✓' : ''), el('span.c-obj-label', o.label), el('small', o.target > 1 ? `${fmt(o.progress)} / ${fmt(o.target)}` : o.done ? 'fait' : 'à faire'))),
          )
        : el('p.end-record', icon('star', 'sm'), 'Votre ferme est un Domaine : jouez librement !'),
      rewardsNode(rec),
    );
    const node = app.dialogs.frame({
      title: `Année ${y} terminée !`,
      ribbon: 'ribbon',
      cls: 'dialog--season.dialog--career-year',
      body,
      actions: [btn([`Commencer l'année ${y + 1}`, icon('play', 'sm')], () => next(), 'btn--red', { id: 'c-year-next', 'data-autofocus': '' })],
    });
    app.dialogs.open(node, { id: 'career-year', pauses: true, sound: false });
    app.audio.play('victory', { pitch: 0, volume: 0.8 });
    app.saveNow?.();
  }

  // ── Passage de rang ───────────────────────────────────────────────────────────
  function rank(ev, g) {
    let rec = null;
    try {
      rec = app.progression.careerRank?.(ev.rank) || null;
    } catch (err) {
      console.warn('recordCareerRank :', err);
    }
    const female = g.state.career?.farmerGender === 'fermiere';
    const unlocks = ev.unlocks || [];
    const crest = el('div.c-rank-crest', rankIcon(ev.rank, 'sprite--hero'));
    const body = el(
      'div.end-screen.c-rankup',
      crest,
      el('p.end-lead', 'Votre ferme devient une ', el('b', ev.name), ' !'),
      ev.title ? el('p.c-rank-title', `Vous êtes maintenant ${female ? 'une' : 'un'} « ${ev.title} ».`) : null,
      unlocks.length
        ? el('div.c-unlocks', el('small.c-unlocks-title', 'Nouveau :'), el('div.c-unlock-list', unlocks.map((u) => el('span.c-unlock', unlockIcon(u), el('span', unlockName(u))))))
        : null,
      rewardsNode(rec) || (ev.ecus ? el('p.end-ecus', ecuIcon('sprite--sm'), `+${plural(ev.ecus, 'écu')}`) : null),
    );
    const node = app.dialogs.frame({
      title: 'Nouveau rang !',
      ribbon: 'ribbon',
      cls: 'dialog--victory.dialog--career-rank',
      body,
      actions: [btn('Formidable !', () => next(), 'btn--red', { id: 'c-rank-ok', 'data-autofocus': '' })],
    });
    app.dialogs.open(node, { id: 'career-rank', pauses: true, sound: false });
    app.audio.play('victory', { pitch: 0, delay: 0.1 });
    app.vibrate?.([15, 60, 15, 60, 30]);
    setTimeout(() => burst(crest), 250);
    app.saveNow?.();
  }

  // ── Joseph vous dépanne (charges de saison) ───────────────────────────────────
  function loan(ev) {
    const share = ev.repayShare === 0.5 ? 'La moitié' : `${Math.round((ev.repayShare || 0.5) * 100)} %`;
    const pct = ev.amount > 0 ? Math.round(((ev.debt - ev.amount) / ev.amount) * 100) : 0;
    const body = el(
      'div.loan-screen',
      josephSays(`« Il vous manquait ${plural(ev.missing, 'pièce')} pour les charges ${season(ev.seasonId, 'of')} ? Pas de souci, entre voisins on s'entraide ! »`, 'content'),
      el(
        'div.loan-facts',
        el('div.sum-line', el('span', 'Joseph vous avance'), el('b.pos', plural(ev.amount, 'pièce'))),
        el('div.sum-line.loan-owe', el('span', pct ? `Vous lui devez (+${pct} %)` : 'Vous lui devez'), el('b.warn', plural(ev.debt, 'pièce'))),
      ),
      el(
        'ul.loan-list',
        el('li', icon('coin', 'sm'), el('span', `${share} de chacune de vos ventes lui revient automatiquement, jusqu'au remboursement.`)),
        el('li', icon('bill', 'sm'), el('span', 'Vous pouvez le rembourser plus tôt : Carnet → Joseph.')),
        el('li', icon('info', 'sm'), el('span', 'Tant que vous lui devez de l\'argent, il ne pourra pas vous aider une deuxième fois.')),
      ),
    );
    const node = app.dialogs.frame({ title: 'Joseph vous dépanne', ribbon: 'ribbon', cls: 'dialog--loan', body, actions: [btn('Merci Joseph !', () => next(), 'btn--red', { id: 'c-loan-ok', 'data-autofocus': '' })] });
    app.dialogs.open(node, { id: 'career-loan', sound: false });
    app.audio.play('unlock', { volume: 0.55, pitch: 0 });
  }

  // ── Une passe difficile ───────────────────────────────────────────────────────
  function hardship(ev, g) {
    const detente = g.state.career?.difficulty !== 'classique';
    const body = el(
      'div.loan-screen.c-hardship',
      josephSays(`« Les charges sont payées, mais la caisse est vide (${fmt(ev.money ?? g.state.money)}). Ne vous en faites pas, ça arrive à tout le monde ! »`, 'surprised'),
      el(
        'ul.loan-list',
        el('li', cIcon('leave', 'sprite--sm', 'info'), el('span', 'Vos employés sont en chômage technique : ni travail, ni salaire.')),
        el('li', cIcon('fuel', 'sprite--sm', 'info'), el('span', 'Les machines à carburant s\'arrêtent.')),
        el('li', icon('lock', 'sm'), el('span', 'Plus d\'achats pour l\'instant, sauf les graines.')),
        el('li', icon('star', 'sm'), el('span', 'Tout reprend dès que l\'argent repasse au-dessus de 50.')),
      ),
      el('p.stats-note', detente ? 'Récoltez, ramassez les œufs, vendez un peu de stock : la ferme se relève vite. Si la caisse est encore très basse aux charges suivantes, la coopérative rachètera des animaux ou des machines.' : 'Récoltez et vendez vite pour renflouer la caisse.'),
    );
    const node = app.dialogs.frame({ title: 'Une passe difficile', ribbon: 'ribbon', cls: 'dialog--loan', body, actions: [btn('Compris', () => next(), 'btn--red', { id: 'c-hardship-ok', 'data-autofocus': '' })] });
    app.dialogs.open(node, { id: 'career-hardship', pauses: true, sound: false });
    app.audio.play('warning');
  }

  // ── Vente de secours ──────────────────────────────────────────────────────────
  function rescue(ev, g) {
    const invs = g.query.investments();
    const cat = (() => {
      try {
        return g.query.career.machineCatalog?.() || [];
      } catch {
        return [];
      }
    })();
    const body = el(
      'div.loan-screen',
      josephSays('« La coopérative est passée : elle a racheté de quoi remettre la caisse à zéro. Vos terrains, vos bâtiments et votre équipe restent à vous. »', 'surprised'),
      el(
        'div.loan-facts',
        (ev.sold || []).map((s) =>
          el(
            'div.sum-line',
            el('span', s.kind === 'animal' ? animalIcon(s.id, 'sprite--xs') : machineIcon(s.id, 'sprite--xs'), ' ', s.kind === 'animal' ? invs.find((i) => i.id === s.id)?.name || s.id : cat.find((m) => m.id === s.id)?.name || 'Machine'),
            el('b.pos', gain(s.amount)),
          ),
        ),
        el('div.sum-line.loan-owe', el('span', 'Total'), el('b.pos', gain(ev.total || 0))),
      ),
    );
    const node = app.dialogs.frame({ title: 'Vente de secours', ribbon: 'ribbon', cls: 'dialog--loan', body, actions: [btn('D\'accord', () => next(), 'btn--red', { id: 'c-rescue-ok', 'data-autofocus': '' })] });
    app.dialogs.open(node, { id: 'career-rescue', sound: false });
  }

  // ── Faillite (Classique) ──────────────────────────────────────────────────────
  function bankrupt(ev, g) {
    app.careerEnded?.(ev);
    const body = el(
      'div.end-screen.c-bankrupt',
      josephSays(`« Les charges ${season(ev.seasonId, 'of')} s'élevaient à ${plural(ev.amountDue, 'pièce')}, et la caisse n'y était pas… La ferme est vendue. Je suis désolé. »`, 'surprised'),
      el(
        'div.loan-facts',
        el('div.sum-line', el('span', 'Ferme'), el('b', ev.farmName || g.state.career?.farmName || '')),
        el('div.sum-line', el('span', 'Années'), el('b', fmt(ev.year || 1))),
        el('div.sum-line', el('span', 'Rang atteint'), el('b', `${ev.rank || 1}/6`)),
        el('div.sum-line', el('span', 'Meilleur patrimoine'), el('b', fmt(ev.archive?.patrimony ?? ev.patrimony ?? 0))),
      ),
      el('p.stats-note', 'Elle rejoint les archives de la grange. En mode Détente, il n\'y a jamais de faillite.'),
    );
    const node = app.dialogs.frame({
      title: 'La ferme est vendue',
      ribbon: 'dark',
      cls: 'dialog--bankrupt',
      body,
      actions: [
        btn('Menu', () => app.quitToMenu({ ended: true }), '', { id: 'c-bankrupt-menu' }),
        btn('Nouvelle ferme', () => {
          app.quitToMenu({ ended: true });
          app.newFarm?.();
        }, 'btn--red', { id: 'c-bankrupt-new', 'data-autofocus': '' }),
      ],
    });
    app.dialogs.open(node, { id: 'career-bankrupt', closable: false, sound: false });
    app.audio.playMusic?.(null, { fade: 1 });
    app.audio.play('bankrupt', { pitch: 0, delay: 0.3 });
  }

  // ── Accueil (nouvelle ferme) : trois bulles de Joseph ─────────────────────────
  function intro(g) {
    let charges = 20;
    try {
      charges = g.query.career.charges().season.amount;
    } catch {
      /* valeur par défaut */
    }
    const lines = [
      ['Bienvenue chez vous ! La ferme est petite, mais la forêt tout autour est à vendre, terrain par terrain…', 'happy'],
      [`Chaque saison, il y a des charges : ${fmt(charges)} pièces pour commencer. Elles grandissent avec la ferme.`, 'content'],
      ['Je vous ai laissé deux poules. Touchez le poulailler pour ramasser les œufs !', 'proud'],
    ];
    let i = 0;
    const speech = el('div');
    const nextBtn = btn('Suivant', () => step(), 'btn--red', { id: 'c-intro-next', 'data-autofocus': '' });
    const paint = () => {
      const [text, expr] = lines[i];
      speech.replaceChildren(josephSays(`« ${text} »`, expr, 'Joseph, votre voisin'));
      nextBtn.textContent = i === lines.length - 1 ? 'C\'est parti !' : 'Suivant';
      nextBtn.dataset.step = String(i + 1);
    };
    const step = () => {
      i += 1;
      if (i >= lines.length) {
        next();
        app.hints.maybe('career.start', null);
        return;
      }
      paint();
    };
    paint();
    const node = app.dialogs.frame({ title: 'Bienvenue !', ribbon: 'ribbon', cls: 'dialog--loan.dialog--career-intro', body: el('div.loan-screen', speech), actions: [nextBtn] });
    app.dialogs.open(node, { id: 'career-intro', pauses: true, sound: false });
  }

  /** « Au revoir, Lucie ! Merci pour tout. » */
  function farewell(s) {
    const body = el('div.end-screen', el('div.end-illus', portrait(s.look, 'sprite--hero')), el('p.end-lead', `Au revoir, ${s.name} ! Merci pour tout.`));
    const node = app.dialogs.frame({ title: 'Au revoir', ribbon: 'ribbon', cls: 'dialog--confirm', body, actions: [btn('Au revoir !', () => next(), 'btn--red', { id: 'c-farewell-ok', 'data-autofocus': '' })] });
    app.dialogs.open(node, { id: 'career-farewell' });
  }

  void openJournal;
  void bar;
  return { queue, queueBanner, process, reset, intro, farewell, get pending() {
    return pending.length;
  } };
}
