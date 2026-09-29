// Interactions avec le champ, en feuilles du bas : choix de la graine (une touche = semer ;
// option « semer partout »), ouverture d'une parcelle, fiche d'une parcelle (pousse, arrosage,
// gel…) et fiche d'un bâtiment. Les mêmes contenus servent d'infobulles à la souris.
//
// createField(app) → { openSeedPicker(i), openUnlock(i), openPlotInfo(i), openInvestmentInfo(id),
//                      close(), isOpen(), plotTip(i), investmentTip(id), refresh(), onEvent(ev),
//                      onKey(e), current }

import { el, fmt, plural, dec } from './dom.js';
import { cropIcon, icon, investmentIcon, seasonIncomes } from './icons.js';
import { incomeProfile, season } from './text.js';

const FIELD_SHEETS = ['seeds', 'unlock', 'plot', 'investment'];

export function createField(app) {
  let current = null; // { kind: 'seeds' | 'unlock' | 'plot' | 'investment', index?, id? }
  let refreshQueued = false;
  let plantEverywhere = false;

  function close(sound = true) {
    if (!current) return;
    if (FIELD_SHEETS.includes(app.sheets.current)) app.sheets.close(sound ? 'close' : 'silent');
    current = null;
  }

  function isOpen() {
    return !!current && FIELD_SHEETS.includes(app.sheets.current);
  }

  function show(kind, target, opts, silent = false) {
    if (silent && app.sheets.current === kind) {
      app.sheets.setContent(opts.content);
      if (opts.title) app.sheets.setTitle(opts.title);
      current = { kind, ...target };
      return;
    }
    current = { kind, ...target };
    lastSig = signature(current);
    app.sheets.open({
      id: kind,
      kind: 'popup',
      ...opts,
      onClose: (reason) => {
        if (reason !== 'replace' || app.sheets.current !== kind) current = null;
        app.onPopupClosed?.();
      },
    });
    current = { kind, ...target };
    if (target.index !== undefined) app.revealPlot?.(target.index);
  }

  // ── Choix de la graine ────────────────────────────────────────────────────────
  function seedContent(index) {
    const game = app.game;
    const crops = game.query.plantableCrops(index);
    const cal = game.query.calendar();
    const lvl = game.query.level();
    const freeOthers = game.query.plots().filter((p) => p.action === 'plant' && p.index !== index).length;

    const rows = crops.map((c, i) => {
      const perDay = c.profit / Math.max(1, c.daysToMature);
      const warnings = [];
      if (c.willFreeze) warnings.push(el('span.warn-chip.is-frost', icon('winter', 'xs'), 'Gèlera avant d\'être mûre'));
      if (c.fatigue) warnings.push(el('span.warn-chip.is-fatigue', icon('info', 'xs'), `Sol fatigué −${Math.round(lvl.modifiers.soilFatigue * 100)} %`));
      if (c.frostHardy && cal.seasonId !== 'winter') warnings.push(el('span.warn-chip.is-hardy', icon('winter', 'xs'), 'Résiste au gel'));
      if (lvl.modifiers.priceVolatility && Math.abs(c.marketMultiplier - 1) > 0.01) {
        warnings.push(el(`span.warn-chip.${c.marketMultiplier > 1 ? 'is-up' : 'is-down'}`, `Cours ×${dec(c.marketMultiplier)}`));
      }
      if (!c.canAfford) warnings.push(el('span.warn-chip.is-frost', `Il manque ${plural(c.seedCost - game.state.money, 'pièce')}`));
      return el(
        `button.seed-row${c.canAfford ? '' : '.is-disabled'}${c.willFreeze ? '.will-freeze' : ''}`,
        {
          type: 'button',
          id: `seed-${c.id}`,
          dataset: { crop: c.id },
          'aria-disabled': c.canAfford ? 'false' : 'true',
          onclick: (e) => choose(c, e.shiftKey || plantEverywhere),
        },
        el('span.seed-key', String(i + 1)),
        el('span.seed-icon', cropIcon(c.id, 'sprite--seed')),
        el(
          'span.seed-main',
          el('span.seed-name', c.name),
          el(
            'span.seed-facts',
            el('span', icon('calendar', 'xs'), plural(c.daysToMature, 'jour')),
            el('span', icon('seed', 'xs'), fmt(c.seedCost)),
            el('span', icon('coin', 'xs'), fmt(c.sellPrice)),
          ),
          warnings.length ? el('span.seed-warns', warnings) : null,
        ),
        el(`span.seed-profit${perDay > 0 ? '.pos' : '.neg'}`, el('b', `+${dec(perDay)}`), el('small', 'par jour')),
      );
    });

    const everywhere = freeOthers > 0
      ? el(
          `button.opt-toggle.seed-all${plantEverywhere ? '.is-on' : ''}`,
          {
            type: 'button',
            role: 'switch',
            id: 'seed-all',
            'aria-checked': plantEverywhere ? 'true' : 'false',
            onclick: (e) => {
              plantEverywhere = !plantEverywhere;
              app.audio.play('toggle');
              e.currentTarget.classList.toggle('is-on', plantEverywhere);
              e.currentTarget.setAttribute('aria-checked', plantEverywhere ? 'true' : 'false');
            },
          },
          el('span.checkbox'),
          el('span.opt-label', `Semer partout (+ ${plural(freeOthers, 'parcelle libre', 'parcelles libres')})`),
        )
      : null;

    return el(
      'div.seed-picker',
      crops.length
        ? [
            el('div.seed-list', rows),
            everywhere,
            el('p.sheet-hint', 'Une culture arrosée pousse deux fois plus vite. Gain par jour = bénéfice ÷ jours de pousse.'),
          ]
        : el('p.sheet-empty', `Rien ne se plante ${season(cal.seasonId, 'in')}.`),
    );
  }

  function openSeedPicker(index, silent = false) {
    const game = app.game;
    if (!game) return;
    if (!silent) plantEverywhere = false;
    show('seeds', { index }, { title: 'Que semer ?', icon: icon('seed', 'md'), content: seedContent(index) }, silent);
    const first = app.sheets.body.querySelector('.seed-row:not(.is-disabled)');
    if (first && app.keyboardMode && !silent) first.focus({ preventScroll: true });
  }

  function choose(crop, all) {
    if (!current || current.kind !== 'seeds') return;
    const index = current.index;
    if (all) {
      const n = app.plantAll(crop.id, index);
      if (n > 0) close(false);
      return;
    }
    const res = app.plant(index, crop.id);
    if (res && res.ok) close(false);
  }

  // ── Ouverture d'une parcelle ──────────────────────────────────────────────────
  function unlockContent(index) {
    const game = app.game;
    const p = game.query.plot(index);
    const cost = p.unlockCost;
    const can = cost !== null && game.state.money >= cost;
    return el(
      'div.unlock-sheet',
      cost === null
        ? el('p', 'Le champ ne peut plus s\'agrandir.')
        : el('p', `Défricher cette parcelle pour ${plural(cost, 'pièce')} ? Chaque nouvelle parcelle coûte 10 pièces de plus que la précédente.`),
      !can && cost !== null ? el('p.card-reason', `Il manque ${plural(cost - game.state.money, 'pièce')}.`) : null,
      el(
        'div.sheet-actions',
        el('button.btn.btn--wide', { type: 'button', onclick: () => close() }, 'Annuler'),
        cost === null
          ? null
          : el(
              `button.btn.btn--wide${can ? '.btn--red' : '.is-disabled'}`,
              {
                type: 'button',
                id: 'unlock-confirm',
                'aria-disabled': can ? 'false' : 'true',
                onclick: () => {
                  const res = app.unlockPlot(index);
                  if (res && res.ok) close(false);
                },
              },
              'Ouvrir',
              el('span.buy-cost', icon('coin', 'sm'), fmt(cost)),
            ),
      ),
    );
  }

  function openUnlock(index, silent = false) {
    const p = app.game?.query.plot(index);
    if (!p || p.unlocked) return;
    show('unlock', { index }, { title: 'Nouvelle parcelle', icon: icon('lock', 'md'), content: unlockContent(index) }, silent);
  }

  // ── Fiche d'une parcelle ──────────────────────────────────────────────────────
  function plotContent(index) {
    const game = app.game;
    const p = game.query.plot(index);
    const f = game.query.finance();
    const nodes = [plotTip(index, { sheet: true })];
    const actions = [];
    if (p.action === 'water') {
      actions.push(el('button.btn.btn--red.btn--wide', { type: 'button', id: 'plot-water', onclick: () => { app.water(index); } }, icon('water', 'sm'), f.waterCost ? `Arroser (${fmt(f.waterCost)})` : 'Arroser'));
    } else if (p.action === 'harvest') {
      actions.push(el('button.btn.btn--red.btn--wide', { type: 'button', id: 'plot-harvest', onclick: () => { if (app.harvest(index)?.ok) close(false); } }, icon('harvest', 'sm'), `Récolter (+${fmt(p.harvestValue)})`));
    } else if (p.action === 'plant') {
      actions.push(el('button.btn.btn--red.btn--wide', { type: 'button', id: 'plot-plant', onclick: () => openSeedPicker(index) }, icon('seed', 'sm'), 'Semer'));
    }
    if (actions.length) nodes.push(el('div.sheet-actions', actions));
    return el('div.info-sheet', nodes);
  }

  function plotTitle(p) {
    if (!p.unlocked) return 'Parcelle en friche';
    if (!p.cropId) return 'Parcelle libre';
    return p.mature ? `${p.cropName} mûre` : p.cropName;
  }

  function openPlotInfo(index, silent = false) {
    const p = app.game?.query.plot(index);
    if (!p) return;
    if (!p.unlocked) return openUnlock(index, silent);
    show('plot', { index }, { title: plotTitle(p), icon: p.cropId ? cropIcon(p.cropId, 'sprite--md') : icon('seed', 'md'), content: plotContent(index) }, silent);
  }

  // ── Fiche d'un bâtiment ───────────────────────────────────────────────────────
  function investmentContent(id) {
    const game = app.game;
    const inv = game.query.investments().find((i) => i.id === id);
    const maxed = inv.nextCost === null;
    const buyLabel = maxed ? (inv.kind === 'upgrade' ? 'Niveau max' : 'Complet') : inv.owned > 0 ? (inv.kind === 'upgrade' ? 'Améliorer' : 'Encore un') : 'Acheter';
    return el(
      'div.info-sheet',
      investmentTip(id, { sheet: true }),
      !maxed && !inv.canBuy && inv.reason ? el('p.card-reason', inv.reason) : null,
      el(
        'div.sheet-actions',
        el('button.btn.btn--wide', { type: 'button', onclick: () => app.panel.focusInvestment(id) }, icon('coin', 'sm'), 'Tous les achats'),
        maxed
          ? null
          : el(
              `button.btn.btn--wide${inv.canBuy ? '.btn--red' : '.is-disabled'}`,
              { type: 'button', id: 'inv-buy', 'aria-disabled': inv.canBuy ? 'false' : 'true', onclick: () => app.buyInvestment(id) },
              buyLabel,
              el('span.buy-cost', icon('coin', 'sm'), fmt(inv.nextCost)),
            ),
      ),
    );
  }

  function openInvestmentInfo(id, silent = false) {
    const inv = app.game?.query.investments().find((i) => i.id === id);
    if (!inv) return;
    show('investment', { id }, { title: inv.name, icon: investmentIcon(id, 'sprite--md'), content: investmentContent(id) }, silent);
  }

  // ── Contenus (infobulle à la souris, fiche au toucher) ────────────────────────
  function plotTip(index, { sheet = false } = {}) {
    const game = app.game;
    const p = game?.query.plot(index);
    if (!p) return null;
    const rows = [];
    const verb = sheet ? null : 'Cliquez';
    if (!p.unlocked) {
      if (!sheet) rows.push(el('div.tip-title', icon('lock', 'sm'), 'Parcelle en friche'));
      rows.push(el('div', p.unlockCost === null ? 'Le champ ne peut plus s\'agrandir.' : `Débloquer : ${plural(p.unlockCost, 'pièce')}`));
      if (verb && p.unlockCost !== null) rows.push(el('div.tip-sub', `${verb} pour l'ouvrir.`));
    } else if (!p.cropId) {
      if (!sheet) rows.push(el('div.tip-title', icon('seed', 'sm'), 'Parcelle libre'));
      rows.push(el(sheet ? 'div' : 'div.tip-sub', sheet ? 'Rien ne pousse ici pour l\'instant.' : `${verb} pour semer.`));
      if (p.fatigue) rows.push(el('div.tip-note.warn', 'Sol fatigué : évitez de replanter la même culture.'));
    } else if (p.mature) {
      if (!sheet) rows.push(el('div.tip-title', cropIcon(p.cropId, 'sprite--xs'), `${p.cropName} mûre !`));
      rows.push(el('div', icon('coin', 'xs'), `Valeur : ${plural(p.harvestValue, 'pièce')}`));
      if (p.fatigue) rows.push(el('div.tip-note.warn', 'Sol fatigué : récolte réduite.'));
      if (verb) rows.push(el('div.tip-sub', `${verb} pour récolter.`));
    } else {
      if (!sheet) rows.push(el('div.tip-title', cropIcon(p.cropId, 'sprite--xs'), p.cropName));
      rows.push(el('div.tip-progress', el('span.tip-bar', el('span.tip-bar-fill', { style: { width: `${Math.round(p.progress * 100)}%` } })), el('span', `mûre dans ${plural(p.daysLeft, 'jour')}`)));
      rows.push(
        p.watered
          ? el('div.tip-ok', icon('water', 'xs'), 'Arrosée aujourd\'hui')
          : el('div.tip-note.warn', icon('water', 'xs'), game.state.weather.today === 'heatwave' ? 'Pas arrosée : ne poussera pas (canicule) !' : 'Pas arrosée : pousse deux fois moins vite'),
      );
      if (p.willFreeze) rows.push(el('div.tip-note.neg', icon('winter', 'xs'), 'Gèlera avant d\'être mûre !'));
      if (p.fatigue) rows.push(el('div.tip-note.warn', 'Sol fatigué : récolte réduite.'));
      if (!p.watered && verb) rows.push(el('div.tip-sub', game.state.money < (game.query.finance().waterCost || 0) ? 'Pas assez d\'argent pour arroser.' : `${verb} pour arroser${game.query.finance().waterCost ? ` (${plural(game.query.finance().waterCost, 'pièce')})` : ''}.`));
    }
    return el('div.tip-rows', rows);
  }

  function investmentTip(id, { sheet = false } = {}) {
    const game = app.game;
    const inv = game?.query.investments().find((i) => i.id === id);
    if (!inv) return null;
    const rows = [];
    if (!sheet) rows.push(el('div.tip-title', investmentIcon(id, 'sprite--xs'), inv.owned ? `${inv.name}${inv.kind === 'upgrade' ? ` (niveau ${inv.owned})` : inv.owned > 1 ? ` ×${inv.owned}` : ''}` : `À vendre : ${inv.name}`));
    else rows.push(el('div.tip-sub', inv.owned ? (inv.kind === 'upgrade' ? `Niveau ${inv.owned} sur ${inv.max}` : `Vous en avez ${inv.owned} (maximum ${inv.max})`) : 'Pas encore acheté'));
    const units = inv.kind === 'upgrade' ? 1 : Math.max(1, inv.owned);
    const profile = incomeProfile(inv.incomeBySeason, units);
    const incomeRows = () => {
      if (!profile.groups.some((g) => g.value > 0)) return;
      if (profile.constant) rows.push(el('div', icon('coin', 'xs'), `+${fmt(profile.value)} par jour, toute l'année`));
      else rows.push(el('div.tip-wrap', icon('coin', 'xs'), 'Par jour :', seasonIncomes(inv.incomeBySeason, units, game.query.calendar().seasonId)));
    };
    if (sheet || !inv.owned) rows.push(el('div', inv.description));
    incomeRows();
    if (inv.effects?.shearing) rows.push(el('div', `Tonte : +${fmt(inv.effects.shearing * units)} en fin de saison (sauf l'hiver)`));
    if (inv.upkeep) rows.push(el(sheet ? 'div' : 'div.tip-sub', `Entretien : −${fmt(inv.upkeep * units)} par jour`));
    if (!inv.owned && inv.nextCost !== null && !sheet) rows.push(el('div', icon('coin', 'xs'), `Prix : ${plural(inv.nextCost, 'pièce')}`));
    if (!sheet) rows.push(el('div.tip-sub', 'Cliquez pour voir la fiche.'));
    return el('div.tip-rows', rows);
  }

  /**
   * Résumé de ce qu'affiche la feuille ouverte : elle n'est reconstruite que s'il change (un
   * toucher en cours sur une ligne ne doit pas tomber sur un élément remplacé à chaque pièce gagnée).
   */
  function signature(c) {
    const g = app.game;
    if (!g) return '';
    if (c.kind === 'investment') return JSON.stringify(g.query.investments().find((i) => i.id === c.id));
    const p = g.query.plot(c.index);
    if (c.kind === 'seeds') {
      const free = g.query.plots().filter((q) => q.action === 'plant').length;
      return JSON.stringify([p.cropId, p.unlocked, free, g.query.calendar().seasonId, g.query.plantableCrops(c.index).map((x) => [x.id, x.canAfford, x.sellPrice, x.marketMultiplier, x.willFreeze, x.fatigue, x.daysToMature, x.canAfford ? 0 : x.seedCost - g.state.money])]);
    }
    if (c.kind === 'unlock') {
      const can = g.state.money >= (p.unlockCost ?? Infinity);
      return JSON.stringify([p.unlocked, p.unlockCost, can, can ? 0 : g.state.money]);
    }
    return JSON.stringify([p, g.query.finance().waterCost, g.state.weather.today]);
  }
  let lastSig = '';

  // Les chiffres (argent, cours, pousse) changent : la feuille ouverte est reconstruite.
  function refresh() {
    if (!isOpen()) return;
    const c = current;
    const sig = signature(c);
    if (sig === lastSig) return;
    lastSig = sig;
    if (c.kind === 'investment') return openInvestmentInfo(c.id, true);
    const p = app.game?.query.plot(c.index);
    if (!p) return close(false);
    if (c.kind === 'seeds') {
      if (!p.unlocked || p.cropId) return close(false);
      const focused = document.activeElement?.dataset?.crop;
      openSeedPicker(c.index, true);
      if (focused) app.sheets.body.querySelector(`[data-crop="${focused}"]`)?.focus({ preventScroll: true });
    } else if (c.kind === 'unlock') {
      if (p.unlocked) return close(false);
      openUnlock(c.index, true);
    } else if (c.kind === 'plot') {
      openPlotInfo(c.index, true);
    }
  }

  function onEvent(ev) {
    if (!isOpen()) return;
    if (ev.type === 'bankrupt' || ev.type === 'victory') {
      close(false);
      return;
    }
    if (['moneyChanged', 'dawn', 'seasonStart', 'planted', 'watered', 'harvested', 'plotUnlocked', 'frost', 'rot', 'purchased'].includes(ev.type) && !refreshQueued) {
      // Une aube émet plusieurs événements : une seule reconstruction par image.
      refreshQueued = true;
      requestAnimationFrame(() => {
        refreshQueued = false;
        refresh();
      });
    }
  }

  /** Raccourcis clavier dans le choix des graines (1..9). */
  function onKey(e) {
    if (!isOpen() || current.kind !== 'seeds') return false;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= 9) {
      const row = app.sheets.body.querySelectorAll('.seed-row')[n - 1];
      if (row) {
        row.click();
        return true;
      }
    }
    return false;
  }

  return {
    openSeedPicker: (i) => openSeedPicker(i),
    openUnlock: (i) => openUnlock(i),
    openPlotInfo: (i) => openPlotInfo(i),
    openInvestmentInfo: (id) => openInvestmentInfo(id),
    close,
    isOpen,
    plotTip,
    investmentTip,
    refresh,
    onEvent,
    onKey,
    reposition() {},
    get current() {
      return isOpen() ? current : null;
    },
  };
}
