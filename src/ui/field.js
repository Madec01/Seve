// Interactions avec le champ : choix de la graine (fenêtre près de la parcelle), confirmation
// d'ouverture d'une parcelle, infobulles de la scène (parcelles et investissements).
//
// createField(popupNode, app) → { openSeedPicker(i), openUnlock(i), close(), isOpen(),
//                                  plotTip(i), investmentTip(id), refresh(), onEvent(ev) }

import { clear, el, fmt, plural, placeNear, dec } from './dom.js';
import { cropIcon, icon, investmentIcon, seasonIncomes } from './icons.js';
import { incomeProfile, season } from './text.js';

export function createField(popup, app) {
  let current = null; // { kind: 'seed' | 'unlock', index }

  function close(sound = true) {
    if (!current) return;
    current = null;
    popup.classList.remove('is-visible');
    popup.setAttribute('aria-hidden', 'true');
    clear(popup);
    if (sound) app.audio.play('close', { volume: 0.6 });
    app.onPopupClosed?.();
  }

  function isOpen() {
    return !!current;
  }

  function show(content, index) {
    clear(popup);
    popup.append(content);
    popup.classList.add('is-visible');
    popup.setAttribute('aria-hidden', 'false');
    place(index);
  }

  /**
   * Place la fenêtre à côté du champ entier (à droite, sinon à gauche, dessous ou dessus) pour ne
   * cacher aucune parcelle ; si la place manque (petit écran), elle se colle à la parcelle visée.
   */
  function place(index) {
    const r = app.plotPageRect(index);
    if (!r) return;
    const field = app.fieldPageRect?.();
    const w = popup.offsetWidth; // (sans la mise à l'échelle de l'animation d'ouverture)
    const h = popup.offsetHeight;
    // Bord droit utile : la poignée du panneau replié ne doit pas être recouverte.
    const handle = document.getElementById('panel-handle');
    const hr = handle && handle.offsetParent !== null ? handle.getBoundingClientRect() : null;
    const vw = hr && hr.width ? Math.min(window.innerWidth, hr.left) : window.innerWidth;
    const vh = window.innerHeight;
    const hud = document.getElementById('hud')?.getBoundingClientRect().bottom || 0;
    const top = Math.max(8, app.inMenu ? 8 : hud + 6);
    const gap = 12;
    if (field) {
      const clampY = (y) => Math.round(Math.max(top, Math.min(vh - h - 8, y)));
      const clampX = (x) => Math.round(Math.max(8, Math.min(vw - w - 8, x)));
      const plotCy = r.top + r.height / 2;
      const candidates = [
        { side: 'right', ok: field.right + gap + w <= vw - 8, x: field.right + gap, y: clampY(plotCy - h / 2) },
        { side: 'left', ok: field.left - gap - w >= 8, x: field.left - gap - w, y: clampY(plotCy - h / 2) },
        { side: 'bottom', ok: field.bottom + gap + h <= vh - 8, x: clampX(r.left + r.width / 2 - w / 2), y: field.bottom + gap },
        { side: 'top', ok: field.top - gap - h >= top, x: clampX(r.left + r.width / 2 - w / 2), y: field.top - gap - h },
      ];
      let c = candidates.find((k) => k.ok && k.y >= top - 1);
      if (!c && h <= vh - top - 8) {
        // Pas de place à côté du champ : à côté de la parcelle visée (sans la cacher si possible),
        // sous la barre du haut.
        const y = clampY(plotCy - h / 2);
        if (r.right + gap + w <= vw - 8) c = { side: 'right', x: r.right + gap, y };
        else if (r.left - gap - w >= 8) c = { side: 'left', x: r.left - gap - w, y };
        else c = { side: 'over', x: vw - r.right >= r.left ? vw - w - 8 : 8, y };
      }
      if (c) {
        popup.style.left = `${Math.round(c.x)}px`;
        popup.style.top = `${Math.round(c.y)}px`;
        popup.dataset.side = c.side;
        return;
      }
    }
    placeNear(popup, r, window.innerWidth < 700 ? 'bottom' : 'right', 14);
  }

  // ── Choix de la graine ────────────────────────────────────────────────────────
  function openSeedPicker(index) {
    const game = app.game;
    if (!game) return;
    const crops = game.query.plantableCrops(index);
    const cal = game.query.calendar();
    const lvl = game.query.level();
    current = { kind: 'seed', index };
    app.audio.play('open', { volume: 0.7 });

    const rows = crops.map((c, i) => {
      const perDay = c.profit / Math.max(1, c.daysToMature);
      const warnings = [];
      if (c.willFreeze) warnings.push(el('span.warn-chip.is-frost', icon('winter', 'xs'), 'Gèlera avant d\'être mûre'));
      if (c.fatigue) warnings.push(el('span.warn-chip.is-fatigue', icon('info', 'xs'), `Sol fatigué : −${Math.round(lvl.modifiers.soilFatigue * 100)} %`));
      if (c.frostHardy && cal.seasonId !== 'winter') warnings.push(el('span.warn-chip.is-hardy', icon('winter', 'xs'), 'Résiste au gel'));
      if (lvl.modifiers.priceVolatility && Math.abs(c.marketMultiplier - 1) > 0.01) {
        warnings.push(el(`span.warn-chip.${c.marketMultiplier > 1 ? 'is-up' : 'is-down'}`, `Cours ×${dec(c.marketMultiplier)}`));
      }
      const b = el(
        `button.seed-row${c.canAfford ? '' : '.is-disabled'}${c.willFreeze ? '.will-freeze' : ''}`,
        {
          type: 'button',
          dataset: { crop: c.id },
          'aria-disabled': c.canAfford ? 'false' : 'true',
          onclick: (e) => choose(c, e.shiftKey),
        },
        el('span.seed-key', String(i + 1)),
        el('span.seed-icon', cropIcon(c.id, 'sprite--seed')),
        el(
          'span.seed-main',
          el('span.seed-name', c.name),
          el('span.seed-days', `${plural(c.daysToMature, 'jour')}${c.daysToMature !== c.growDays ? ` (${c.growDays} sans ruche)` : ''}`),
          warnings.length ? el('span.seed-warns', warnings) : null,
        ),
        el('span.seed-num.seed-cost', icon('coin', 'xs'), fmt(c.seedCost)),
        el('span.seed-num.seed-sell', fmt(c.sellPrice)),
        el(`span.seed-num.seed-profit${perDay > 0 ? '.pos' : '.neg'}`, `+${dec(perDay)}`),
      );
      if (!c.canAfford) b.dataset.tip = `Il manque ${plural(c.seedCost - game.state.money, 'pièce')}.`;
      return b;
    });

    const content = el(
      'div.popup-inner.seed-picker',
      { role: 'dialog', 'aria-label': 'Choisir une graine' },
      el('div.popup-head', icon('seed', 'md'), el('div.popup-title', 'Que semer ?'), el('button.popup-close', { type: 'button', 'aria-label': 'Fermer', onclick: () => close() }, icon('close', 'sm'))),
      crops.length
        ? [
            el('div.seed-header', el('span'), el('span'), el('span', 'Culture'), el('span', 'Graine'), el('span', 'Vente'), el('span', { 'data-tip': 'Gain par jour de pousse (arrosée)' }, 'Gain/j')),
            el('div.seed-list', rows),
            el('p.popup-hint', `Maj + clic : semer sur toutes les parcelles vides. Une culture arrosée pousse deux fois plus vite.`),
          ]
        : el('p.popup-empty', `Rien ne se plante ${season(cal.seasonId, 'in')}.`),
    );
    show(content, index);
    const first = popup.querySelector('.seed-row:not(.is-disabled)');
    if (first && app.keyboardMode) first.focus({ preventScroll: true });
  }

  function choose(crop, all) {
    if (!current) return;
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
  function openUnlock(index) {
    const game = app.game;
    const p = game?.query.plot(index);
    if (!p || p.unlocked) return;
    current = { kind: 'unlock', index };
    app.audio.play('open', { volume: 0.7 });
    const cost = p.unlockCost;
    const can = cost !== null && game.state.money >= cost;
    const confirm = el(
      `button.btn.btn--red${can ? '' : '.is-disabled'}`,
      {
        type: 'button',
        'aria-disabled': can ? 'false' : 'true',
        onclick: () => {
          const res = app.unlockPlot(index);
          if (res && res.ok) close(false);
        },
      },
      'Ouvrir',
      el('span.buy-cost', icon('coin', 'sm'), fmt(cost ?? 0)),
    );
    if (!can && cost !== null) confirm.dataset.tip = `Il manque ${plural(cost - game.state.money, 'pièce')}.`;
    const content = el(
      'div.popup-inner.unlock-popup',
      { role: 'dialog', 'aria-label': 'Ouvrir une parcelle' },
      el('div.popup-head', icon('lock', 'md'), el('div.popup-title', 'Nouvelle parcelle'), el('button.popup-close', { type: 'button', 'aria-label': 'Fermer', onclick: () => close() }, icon('close', 'sm'))),
      cost === null
        ? el('p', 'Le champ ne peut plus s\'agrandir.')
        : el('p', `Défricher cette parcelle pour ${plural(cost, 'pièce')} ? Chaque nouvelle parcelle coûte 10 pièces de plus que la précédente.`),
      el('div.popup-actions', el('button.btn', { type: 'button', onclick: () => close() }, 'Annuler'), cost === null ? null : confirm),
    );
    show(content, index);
    if (can && app.keyboardMode) confirm.focus({ preventScroll: true });
  }

  // ── Infobulles de la scène ────────────────────────────────────────────────────
  function plotTip(index) {
    const game = app.game;
    const p = game?.query.plot(index);
    if (!p) return null;
    const rows = [];
    if (!p.unlocked) {
      rows.push(el('div.tip-title', icon('lock', 'sm'), 'Parcelle en friche'));
      rows.push(el('div', p.unlockCost === null ? 'Le champ ne peut plus s\'agrandir.' : `Débloquer : ${plural(p.unlockCost, 'pièce')}`));
      if (p.unlockCost !== null) rows.push(el('div.tip-sub', 'Cliquez pour l\'ouvrir.'));
    } else if (!p.cropId) {
      rows.push(el('div.tip-title', icon('seed', 'sm'), 'Parcelle libre'));
      rows.push(el('div.tip-sub', 'Cliquez pour semer.'));
    } else if (p.mature) {
      rows.push(el('div.tip-title', cropIcon(p.cropId, 'sprite--xs'), `${p.cropName} mûre !`));
      rows.push(el('div', icon('coin', 'xs'), `Valeur : ${plural(p.harvestValue, 'pièce')}`));
      if (p.fatigue) rows.push(el('div.tip-note.warn', 'Sol fatigué : récolte réduite.'));
      rows.push(el('div.tip-sub', 'Cliquez pour récolter.'));
    } else {
      rows.push(el('div.tip-title', cropIcon(p.cropId, 'sprite--xs'), p.cropName));
      rows.push(el('div.tip-progress', el('span.tip-bar', el('span.tip-bar-fill', { style: { width: `${Math.round(p.progress * 100)}%` } })), el('span', `mûre dans ${plural(p.daysLeft, 'jour')}`)));
      rows.push(
        p.watered
          ? el('div.tip-ok', icon('water', 'xs'), 'Arrosée aujourd\'hui')
          : el('div.tip-note.warn', icon('water', 'xs'), game.state.weather.today === 'heatwave' ? 'Pas arrosée : ne poussera pas (canicule) !' : 'Pas arrosée : pousse deux fois moins vite'),
      );
      if (p.willFreeze) rows.push(el('div.tip-note.neg', icon('winter', 'xs'), 'Gèlera avant d\'être mûre !'));
      if (p.fatigue) rows.push(el('div.tip-note.warn', 'Sol fatigué : récolte réduite.'));
      if (!p.watered) rows.push(el('div.tip-sub', game.state.money < (game.query.finance().waterCost || 0) ? 'Pas assez d\'argent pour arroser.' : `Cliquez pour arroser${game.query.finance().waterCost ? ` (${plural(game.query.finance().waterCost, 'pièce')})` : ''}.`));
    }
    return el('div.tip-rows', rows);
  }

  function investmentTip(id) {
    const game = app.game;
    const inv = game?.query.investments().find((i) => i.id === id);
    if (!inv) return null;
    const rows = [el('div.tip-title', investmentIcon(id, 'sprite--xs'), inv.owned ? `${inv.name}${inv.kind === 'upgrade' ? ` (niveau ${inv.owned})` : inv.owned > 1 ? ` ×${inv.owned}` : ''}` : `À vendre : ${inv.name}`)];
    const units = inv.kind === 'upgrade' ? 1 : Math.max(1, inv.owned);
    const profile = incomeProfile(inv.incomeBySeason, units);
    const incomeRows = () => {
      if (!profile.groups.some((g) => g.value > 0)) return;
      if (profile.constant) rows.push(el('div', icon('coin', 'xs'), `+${fmt(profile.value)} par jour, toute l'année`));
      else rows.push(el('div', icon('coin', 'xs'), 'Par jour :', seasonIncomes(inv.incomeBySeason, units, game.query.calendar().seasonId)));
    };
    if (inv.owned) {
      incomeRows();
      if (inv.effects?.shearing) rows.push(el('div', `Tonte : +${fmt(inv.effects.shearing * units)} en fin de saison (sauf l'hiver)`));
      if (inv.upkeep) rows.push(el('div.tip-sub', `Entretien : −${fmt(inv.upkeep * units)} par jour`));
    } else {
      rows.push(el('div', inv.description));
      incomeRows();
      if (inv.nextCost !== null) rows.push(el('div', icon('coin', 'xs'), `Prix : ${plural(inv.nextCost, 'pièce')}`));
    }
    rows.push(el('div.tip-sub', 'Cliquez pour voir la fiche.'));
    return el('div.tip-rows', rows);
  }

  // Les chiffres (argent, cours) changent : la fenêtre ouverte est reconstruite.
  function refresh() {
    if (!current) return;
    const c = current;
    const p = app.game?.query.plot(c.index);
    if (!p) return close(false);
    if (c.kind === 'seed') {
      if (!p.unlocked || p.cropId) return close(false);
      const focused = document.activeElement?.dataset?.crop;
      openSeedPickerSilently(c.index);
      if (focused) popup.querySelector(`[data-crop="${focused}"]`)?.focus({ preventScroll: true });
    } else if (c.kind === 'unlock') {
      if (p.unlocked) return close(false);
      openUnlockSilently(c.index);
    }
  }

  function silently(fn, index) {
    const play = app.audio.play;
    app.audio.play = () => {};
    try {
      fn(index);
    } finally {
      app.audio.play = play;
    }
  }
  const openSeedPickerSilently = (i) => silently(openSeedPicker, i);
  const openUnlockSilently = (i) => silently(openUnlock, i);

  function onEvent(ev) {
    if (!current) return;
    if (['moneyChanged', 'dawn', 'seasonStart', 'planted', 'plotUnlocked', 'frost', 'rot', 'purchased'].includes(ev.type)) {
      requestAnimationFrame(refresh);
    }
    if (ev.type === 'bankrupt' || ev.type === 'victory') close(false);
  }

  /** Raccourcis clavier dans la fenêtre des graines (1..9). */
  function onKey(e) {
    if (!current || current.kind !== 'seed') return false;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= 9) {
      const rows = popup.querySelectorAll('.seed-row');
      const row = rows[n - 1];
      if (row) {
        row.click();
        return true;
      }
    }
    return false;
  }

  return {
    openSeedPicker,
    openUnlock,
    close,
    isOpen,
    plotTip,
    investmentTip,
    refresh,
    onEvent,
    onKey,
    reposition() {
      if (current) place(current.index);
    },
    get current() {
      return current;
    },
  };
}
