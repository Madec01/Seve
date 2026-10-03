// « La grange aux souvenirs » : progression permanente, depuis le menu principal (et après une
// année). Fenêtre haute (plein écran en portrait) avec trois onglets segmentés (≥ 48 px) :
//   Bonus    : étoiles disponibles / gagnées, interrupteur « Bonus pendant les parties », arbre des
//              bonus par palier (achat immédiat, remboursement libre) ;
//   Succès   : les 26 succès des niveaux, puis ceux de la carrière (écus seulement) et les anciennes
//              fermes archivées ;
//   Ma ferme : écus, nom de la ferme, tenue, allées, clôture, boutique des décorations,
//              « Décorer la ferme ».
//
// createGrange(app) → { open(tab = 'bonus'), refresh(), isOpen() }

import { v3 } from './v3.js';
import { el, fmt, plural } from './dom.js';
import { achievementIcon, ecuIcon, icon, perkIcon } from './icons.js';
import { cosmeticTile, farmNameForm, unlockFlow, CATEGORY_TITLE } from './decor.js';

const TABS = [
  { id: 'bonus', label: 'Bonus' },
  { id: 'achievements', label: 'Succès' },
  { id: 'farm', label: 'Ma ferme' },
  // (Lot 4) L'album de la ferme (src/ui/album.js) : cases trouvées dans tous les modes, récompenses de page.
  { id: 'album', label: 'Album', when: (app) => !!app.album?.available?.() },
];

export function createGrange(app) {
  const grangeTabs = () => TABS.filter((t) => !t.when || t.when(app));
  let handle = null;
  let tab = 'bonus';
  let panel = null;
  let tabButtons = [];
  let farmTitle = null;
  const P = () => app.progression;

  function open(which = 'bonus') {
    if (!P()?.available()) return;
    tab = grangeTabs().some((t) => t.id === which) ? which : 'bonus';
    const d = app.dialogs;
    farmTitle = el('p.grange-farm', '');
    panel = el('div.grange-panel', { role: 'tabpanel', id: 'grange-panel' });
    tabButtons = grangeTabs().map((t) =>
      el(
        'button.seg-btn',
        {
          type: 'button',
          role: 'tab',
          id: `grange-tab-${t.id}`,
          'aria-controls': 'grange-panel',
          onclick: () => {
            if (tab === t.id) return;
            app.audio.play('page', { volume: 0.7 });
            tab = t.id;
            render(true);
          },
        },
        el('span', t.label),
        el('span.seg-dot', { 'aria-hidden': 'true' }),
      ),
    );
    const tabs = el(`div.seg${tabButtons.length >= 4 ? '.is-four' : ''}`, { role: 'tablist', 'aria-label': 'Grange aux souvenirs' }, tabButtons);
    const node = d.frame({
      title: 'La grange',
      ribbon: 'ribbon',
      cls: 'dialog--grange',
      body: [farmTitle, tabs, panel],
      actions: [d.btn('Retour', () => d.closeTop(), 'btn--red', { id: 'grange-back', 'data-autofocus': '' })],
      onClose: () => d.closeTop(),
    });
    handle = d.open(node, {
      id: 'grange',
      onClose: () => {
        handle = null;
        // Retour au menu : sa pastille dorée peut avoir changé.
        if (app.inMenu && app.dialogs.top() === 'main-menu') app.dialogs.mainMenu();
      },
    });
    render(true);
    return handle;
  }

  function isOpen() {
    return !!handle && app.dialogs.top() === 'grange';
  }

  /** Reconstruit l'onglet courant (garde la position de défilement si `reset` est faux). */
  function render(reset = false) {
    if (!panel) return;
    const scroller = panel.closest('.dialog-body');
    const top = scroller ? scroller.scrollTop : 0;
    for (const b of tabButtons) {
      const on = b.id === `grange-tab-${tab}`;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    }
    tabButtons[0].querySelector('.seg-dot').classList.toggle('is-on', P().canSpendStars());
    tabButtons[1].querySelector('.seg-dot').classList.toggle('is-on', !!app.hasNewAchievements?.());
    tabButtons[3]?.querySelector('.seg-dot').classList.toggle('is-on', (app.album?.badge?.() || 0) > 0);
    farmTitle.textContent = `Grange aux souvenirs · ${P().farmName()}`;
    const content = tab === 'bonus' ? bonusTab() : tab === 'achievements' ? achievementsTab() : tab === 'album' ? app.album.tabContent() : farmTab();
    panel.replaceChildren(content);
    if (tab === 'achievements') app.markAchievementsSeen?.();
    if (scroller) scroller.scrollTop = reset ? 0 : top;
  }

  // ── Bonus ─────────────────────────────────────────────────────────────────────
  function bonusTab() {
    const avail = P().starsAvailable();
    const earned = P().starsEarned();
    const spent = P().starsSpent();
    const list = P().perkList();
    const tiers = v3.perks?.PERK_TIERS || [...new Set(list.map((p) => p.tier))].map((t) => ({ tier: t, starsRequired: 0 }));

    const on = P().perksEnabled();
    const sw = el(
      `button.opt-toggle.perks-switch${on ? '.is-on' : ''}`,
      {
        type: 'button',
        role: 'switch',
        id: 'grange-perks-switch',
        'aria-checked': on ? 'true' : 'false',
        onclick: () => {
          app.audio.play('toggle');
          P().setPerksEnabled(!P().perksEnabled());
          render();
        },
      },
      el('span.checkbox'),
      el('span.opt-label', el('b', 'Bonus pendant les parties'), el('small', on ? 'Activés : ils s\'appliquent au lancement de chaque année.' : 'Désactivés : les parties se jouent sans aucun bonus (jeu d\'origine).')),
    );

    const head = el(
      'div.grange-stars',
      el('div.stars-big', icon('star', 'lg'), el('b', fmt(avail)), el('span', avail > 1 ? 'disponibles' : 'disponible')),
      el('div.stars-sub', `${plural(earned, 'étoile gagnée', 'étoiles gagnées')}${spent ? ` · ${fmt(spent)} dépensée${spent > 1 ? 's' : ''}` : ''}`),
    );

    const sections = tiers.map((t) => {
      const perks = list.filter((p) => p.tier === t.tier);
      const locked = earned < (t.starsRequired || 0);
      return el(
        `section.perk-tier${locked ? '.is-locked' : ''}`,
        el(
          'h3.perk-tier-title',
          `Palier ${t.tier}`,
          locked ? el('span.perk-tier-lock', icon('lock', 'sm'), `Il faut ${plural(t.starsRequired, 'étoile gagnée', 'étoiles gagnées')} (encore ${fmt(t.starsRequired - earned)})`) : t.starsRequired ? el('span.perk-tier-open', `dès ${t.starsRequired} ★`) : null,
        ),
        perks.map((p) => perkCard(p, locked)),
      );
    });

    return el(
      'div.grange-bonus',
      head,
      sw,
      app.game && !app.inMenu ? el('p.sheet-hint', 'Acheter ou rembourser un bonus ne change pas la partie en cours.') : null,
      sections,
      spent
        ? el(
            'div.grange-foot',
            app.dialogs.btn(
              'Rembourser tous les bonus',
              async () => {
                const ok = await app.dialogs.confirm({ title: 'Rembourser ?', text: `Toutes les étoiles dépensées (${fmt(spent)}) vous sont rendues. Vous pourrez racheter d'autres bonus.`, ok: 'Rembourser' });
                if (!ok) return;
                P().refundPerks();
                app.audio.play('coin');
                render();
              },
              'btn--wide',
              { id: 'grange-refund' },
            ),
          )
        : null,
      el('p.sheet-hint', 'Les étoiles se gagnent en réussissant les niveaux (jusqu\'à 3 par niveau) et avec certains succès. Les dépenser ne retire rien aux niveaux.'),
    );
  }

  function perkCard(p, tierLocked) {
    const maxed = p.rank >= p.maxRank;
    const pips = p.maxRank > 1 ? el('span.perk-pips', Array.from({ length: p.maxRank }, (_, i) => el(`span.pip${i < p.rank ? '.is-on' : ''}`))) : null;
    let action;
    if (maxed) action = el('span.perk-owned', 'Acquis ✓');
    else {
      const can = p.canBuy && !tierLocked;
      action = el(
        `button.btn.btn--perk${can ? '.btn--red' : '.is-disabled'}`,
        {
          type: 'button',
          id: `perk-${p.id}`,
          'aria-disabled': can ? 'false' : 'true',
          'aria-label': `${p.rank ? 'Rang suivant' : 'Acheter'} : ${p.name}, ${plural(p.nextCost, 'étoile')}`,
          onclick: () => buy(p),
        },
        icon('star', 'sm'),
        el('b', fmt(p.nextCost)),
      );
    }
    const reason = !maxed && !p.canBuy && !tierLocked && p.reason ? el('span.perk-reason', p.reason) : null;
    return el(
      `article.perk-card${p.rank ? '.is-owned' : ''}${maxed ? '.is-max' : ''}${tierLocked ? '.is-locked' : ''}`,
      { id: `perk-card-${p.id}` },
      el('span.perk-icon', perkIcon(p.id, 'sprite--md')),
      el('div.perk-main', el('div.perk-top', el('span.perk-name', p.name), pips), el('p.perk-desc', p.description), reason),
      el('div.perk-action', action),
    );
  }

  function buy(p) {
    const res = P().buyPerk(p.id);
    if (!res?.ok) {
      app.audio.play('error');
      app.toasts.show({ kind: 'error', text: res?.reason || 'Pas assez d\'étoiles.' });
      return;
    }
    app.audio.play('buy');
    app.audio.play('unlock', { delay: 0.15, volume: 0.6 });
    app.vibrate?.(15);
    render();
    const card = panel.querySelector(`#perk-card-${p.id}`);
    if (card) {
      card.classList.remove('is-bought');
      void card.offsetWidth;
      card.classList.add('is-bought');
    }
  }

  // ── Succès ────────────────────────────────────────────────────────────────────
  function achievementRow(a) {
    const r = a.reward || {};
    const date = a.at ? new Date(a.at) : null;
    const prog = !a.done && a.progress && a.progress.target > 1 ? a.progress : null;
    return el(
      `article.ach-row${a.done ? '.is-done' : ''}`,
      { id: `ach-${a.id}` },
      el('span.ach-icon', achievementIcon(a.id, a.done, 'sprite--md', r.stars || 0)),
      el(
        'div.ach-main',
        el('div.ach-top', el('span.ach-name', a.name), el('span.ach-reward', r.stars ? [icon('star', 'xs'), el('span', `+${r.stars}`)] : null, r.ecus ? [ecuIcon('sprite--xs'), el('span', fmt(r.ecus))] : null)),
        el('p.ach-desc', a.description),
        a.done
          ? el('span.ach-date', date && !Number.isNaN(date.getTime()) ? `Obtenu le ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Obtenu')
          : prog
            ? el('span.ach-prog', el('span.ach-bar', el('span.ach-bar-fill', { style: { width: `${Math.round(Math.min(1, prog.value / prog.target) * 100)}%` } })), el('span.ach-count', `${fmt(Math.min(prog.value, prog.target))} / ${fmt(prog.target)}`))
            : el('span.ach-date.is-todo', 'Pas encore'),
      ),
    );
  }

  /** Contexte d'une carrière en cours (progression des succès de carrière), ou null. */
  function careerContext() {
    const g = app.game;
    if (!g || g.mode !== 'career' || g.state.status !== 'playing') return null;
    try {
      return g.query.achievementContext();
    } catch {
      return null;
    }
  }

  function achievementsTab() {
    const list = P().achievementList(null);
    const careerAll = P().careerAchievementList ? P().careerAchievementList(careerContext()) : [];
    // (Vallée vivante) Les 7 succès de la Vallée, rangés sous leur propre titre.
    const valleyIds = new Set((v3.achievements?.VALLEY_ACHIEVEMENTS || []).map((a) => a.id));
    const career = careerAll.filter((a) => !valleyIds.has(a.id));
    const valley = careerAll.filter((a) => valleyIds.has(a.id));
    const vdone = valley.filter((a) => a.done).length;
    // (Lot 4) « Album et fêtes » : écus seulement.
    let cozy = [];
    try {
      if (typeof v3.progression?.cozyAchievementList === 'function') cozy = v3.progression.cozyAchievementList(P().get(), careerContext()) || [];
    } catch {
      cozy = [];
    }
    const zdone = cozy.filter((a) => a.done).length;
    const done = list.filter((a) => a.done).length;
    const cdone = career.filter((a) => a.done).length;
    const pc = P().get().career || {};
    const archive = (pc.archive || []).slice(0, 5);
    return el(
      'div.grange-ach',
      el(
        'div.ach-head',
        el('b.ach-score', `${done + cdone + zdone + vdone} / ${list.length + career.length + cozy.length + valley.length}`),
        el('span', 'succès obtenus'),
        el('span.ach-headbar', el('span.ach-bar-fill', { style: { width: `${list.length + career.length + cozy.length + valley.length ? Math.round(((done + cdone + zdone + vdone) / (list.length + career.length + cozy.length + valley.length)) * 100) : 0}%` } })),
      ),
      el('h3.farm-sec-title.ach-sec', `Les niveaux · ${done} / ${list.length}`),
      el('div.ach-list', list.map(achievementRow)),
      career.length ? el('h3.farm-sec-title.ach-sec', { id: 'ach-career' }, `Ma ferme (carrière) · ${cdone} / ${career.length}`) : null,
      career.length ? el('p.sheet-hint', 'Les succès de la carrière rapportent des écus (pas d\'étoile).') : null,
      career.length ? el('div.ach-list', career.map(achievementRow)) : null,
      valley.length ? el('h3.farm-sec-title.ach-sec', { id: 'ach-valley' }, `La Vallée · ${vdone} / ${valley.length}`) : null,
      valley.length ? el('div.ach-list', valley.map(achievementRow)) : null,
      cozy.length ? el('h3.farm-sec-title.ach-sec', { id: 'ach-cozy' }, `Album et fêtes · ${zdone} / ${cozy.length}`) : null,
      cozy.length ? el('div.ach-list', cozy.map(achievementRow)) : null,
      archive.length
        ? el(
            'section.farm-sec.ach-archive',
            el('h3.farm-sec-title', 'Anciennes fermes'),
            archive.map((a) => el('div.stats-line', el('span.stats-label', `${a.farmName} · ${plural(a.years, 'an')} · rang ${a.rank}`), el('b.stats-value', a.endedBy === 'bankrupt' ? 'vendue' : 'archivée'))),
          )
        : null,
      el('p.sheet-hint', 'Les succès se débloquent en jouant, pour toujours. Certains rapportent une étoile (★), tous rapportent des écus.'),
    );
  }

  // ── Ma ferme ──────────────────────────────────────────────────────────────────
  function farmTab() {
    const c = P().cosmetics();
    const counts = {};
    for (const id of Object.values(c.decor || {})) counts[id] = (counts[id] || 0) + 1;

    const choice = (category, currentId, apply) => {
      const list = P().cosmeticsList(category);
      if (!list.length) return null;
      return el(
        'section.farm-sec',
        el('h3.farm-sec-title', CATEGORY_TITLE[category]),
        el(
          'div.cos-grid',
          list.map((item) =>
            cosmeticTile(app, item, {
              placed: item.id === currentId,
              placedLabel: 'Choisi',
              onPick: async (it) => {
                if (it.id === currentId) return;
                if (!(await unlockFlow(app, it))) return;
                apply(it.id);
                app.audio.play('confirm');
                app.applyCosmetics?.();
                render();
              },
            }),
          ),
        ),
      );
    };

    const decoItems = [...P().cosmeticsList('small'), ...P().cosmeticsList('large')];
    const shop = decoItems.length
      ? el(
          'section.farm-sec',
          el('h3.farm-sec-title', 'Décorations'),
          el('p.farm-sec-sub', 'Débloquez-les ici, puis posez-les avec « Décorer la ferme ».'),
          el(
            'div.cos-grid',
            decoItems.map((item) =>
              cosmeticTile(app, item, {
                count: counts[item.id] || 0,
                onPick: async (it, st) => {
                  if (st === 'owned') {
                    app.audio.play('click');
                    app.toasts.show({ prio: 'important', kind: 'info', icon: 'star', text: `« ${it.name} » est débloqué : posez-le avec « Décorer la ferme ».` });
                    return;
                  }
                  if (await unlockFlow(app, it)) render();
                },
              }),
            ),
          ),
        )
      : null;

    return el(
      'div.grange-farm-tab',
      el('div.ecus-big', ecuIcon('sprite--md'), el('b', fmt(P().ecus())), el('span', P().ecus() > 1 ? 'écus' : 'écu')),
      el('p.sheet-hint', 'Les écus se gagnent en jouant : années réussies, lots de consolation et succès. Purement décoratifs.'),
      app.decor?.available()
        ? app.dialogs.btn([icon('star', 'sm'), 'Décorer la ferme'], () => app.decor.enter({ fromMenu: app.inMenu }), 'btn--red.btn--wide', { id: 'grange-decorate' })
        : null,
      el('section.farm-sec', el('h3.farm-sec-title', 'Nom de la ferme'), farmNameForm(app, { onSaved: () => render() })),
      choice('outfit', c.outfit, (id) => P().setOutfit(id)),
      choice('path', c.path, (id) => P().setPath(id)),
      choice('fence', c.fence, (id) => P().setFence(id)),
      shop,
    );
  }

  return {
    open,
    isOpen,
    refresh: () => {
      if (isOpen()) render();
    },
  };
}
