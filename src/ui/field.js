// Interactions avec le champ, en feuilles du bas : choix de la graine (une touche = semer ;
// option « semer partout »), ouverture d'une parcelle, fiche d'une parcelle (pousse, arrosage,
// gel…, pommier : étape et « Arracher »), fiche d'un bâtiment et fiche d'un atelier
// (src/ui/buildings.js). Les mêmes contenus servent d'infobulles à la souris.
//
// createField(app) → { openSeedPicker(i), openUnlock(i), openPlotInfo(i), openInvestmentInfo(id),
//                      close(), isOpen(), plotTip(i), investmentTip(id), refresh(), onEvent(ev),
//                      onKey(e), current }

import { el, fmt, plural, dec } from './dom.js';
import { cropIcon, icon, investmentIcon, productIcon, seasonIncomes } from './icons.js';
import { incomeProfile, season, seasonList, waterEffect } from './text.js';
import { buildingContent, buildingSignature, confirmSellRaw, isProcessing, processingOf } from './buildings.js';
import { aboutSection } from './career/util.js';
import { readPrefs, writePrefs } from './guide-prefs.js';
import { agree } from '../data/french.js';

const FIELD_SHEETS = ['seeds', 'unlock', 'plot', 'investment', 'building'];

/** Étape d'un pommier en une phrase (fiche, infobulle). */
export function treeStatus(p) {
  const t = p.tree;
  if (!t) return '';
  if (t.stage !== 'adult') {
    const what = t.stage === 'sapling' ? 'Jeune plant' : 'Jeune arbre';
    return t.dormant ? `${what} · au repos pour l'hiver` : `${what} · adulte dans ${plural(Math.max(1, t.adultInDays), 'jour')}`;
  }
  if (t.fruitReady) return `Pommes mûres : ${fmt(p.harvestValue ?? 0)}`;
  if (t.dormant) return 'Au repos pour l\'hiver';
  if (t.blossom) return 'En fleurs · pommes dès l\'été';
  return `Pommes dans ${plural(Math.max(1, t.fruitDaysLeft), 'jour')}`;
}

/** Avancement affiché d'un pommier (0..1) : pousse, puis fruits. */
function treeProgress(t) {
  if (t.stage !== 'adult') return Math.max(0, Math.min(1, t.growth / Math.max(1, t.growDays)));
  return Math.max(0, Math.min(1, t.fruit / Math.max(1, t.fruitDays)));
}

export function createField(app) {
  let current = null; // { kind: 'seeds' | 'unlock' | 'plot' | 'investment', index?, id? }
  let refreshQueued = false;
  // « Semer partout » : le choix du joueur est retenu d'une fois sur l'autre (lot 1 « confort »).
  let plantEverywhere = readPrefs().sowAll;

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
    else if (target.id) app.revealInvestment?.(target.id, kind);
  }

  // ── Choix de la graine ────────────────────────────────────────────────────────
  function seedContent(index) {
    const game = app.game;
    const crops = game.query.plantableCrops(index);
    const cal = game.query.calendar();
    const lvl = game.query.level();
    const freeOthers = game.query.plots().filter((p) => p.action === 'plant' && p.index !== index).length;

    const rows = crops.map((c, i) => {
      const isTree = c.kind === 'tree' || !!c.tree;
      const perDay = c.profit / Math.max(1, c.daysToMature);
      const warnings = [];
      if (isTree) {
        warnings.push(el('span.warn-chip.is-hardy', icon('winter', 'xs'), 'Ne gèle pas · sans arrosage'));
        if (c.tree && c.tree.harvestsBeforeYearEnd === 0) warnings.push(el('span.warn-chip.is-frost', 'Aucune pomme avant la fin de l\'année'));
      }
      if (c.noWater) warnings.push(el('span.warn-chip.is-hardy', icon('water', 'xs'), 'Pousse sans arrosage'));
      if (c.product?.owned) warnings.push(el('span.warn-chip.is-product', productIcon(c.product.productId, 'sprite--xs'), `Atelier : ${fmt(c.product.value)}`));
      if (c.willFreeze && !isTree) warnings.push(el('span.warn-chip.is-frost', icon('winter', 'xs'), 'Gèlera avant d\'être mûre'));
      if (c.fatigue) warnings.push(el('span.warn-chip.is-fatigue', icon('info', 'xs'), `Sol fatigué −${Math.round(lvl.modifiers.soilFatigue * 100)} %`));
      if (c.frostHardy && !isTree && cal.seasonId !== 'winter') warnings.push(el('span.warn-chip.is-hardy', icon('winter', 'xs'), 'Résiste au gel'));
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
          isTree
            ? el(
                'span.seed-facts',
                el('span', icon('seed', 'xs'), fmt(c.seedCost)),
                el('span', icon('calendar', 'xs'), `adulte en ${plural(c.daysToMature ?? c.growDays, 'jour')}`),
              )
            : el(
                'span.seed-facts',
                el('span', icon('calendar', 'xs'), plural(c.daysToMature, 'jour')),
                el('span', icon('seed', 'xs'), fmt(c.seedCost)),
                el('span', icon('coin', 'xs'), fmt(c.sellPrice)),
              ),
          isTree ? el('span.seed-tree', `puis un panier (${fmt(c.tree?.basketPrice ?? c.sellPrice)}) tous les ${plural(c.tree?.fruitDays ?? 3, 'jour')} ${seasonList(c.tree?.fruitSeasons || ['summer', 'autumn'])}`) : null,
          warnings.length ? el('span.seed-warns', warnings) : null,
        ),
        isTree
          ? el(`span.seed-profit${(c.tree?.harvestsBeforeYearEnd ?? 1) > 0 ? '.pos' : '.neg'}`, el('b', `×${c.tree?.harvestsBeforeYearEnd ?? '?'}`), el('small', 'paniers'))
          : el(`span.seed-profit${perDay > 0 ? '.pos' : '.neg'}`, el('b', `+${dec(perDay)}`), el('small', 'par jour')),
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
              writePrefs({ sowAll: plantEverywhere });
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
            el('p.sheet-hint', `Une culture arrosée pousse ${waterEffect(game.level).faster}. Gain par jour = bénéfice ÷ jours de pousse.`),
          ]
        : el('p.sheet-empty', `Rien ne se plante ${season(cal.seasonId, 'in')}.`),
    );
  }

  function openSeedPicker(index, silent = false) {
    const game = app.game;
    if (!game) return;
    if (!silent) plantEverywhere = readPrefs().sowAll;
    show('seeds', { index }, { title: 'Que semer ?', icon: icon('seed', 'md'), content: seedContent(index) }, silent);
    const first = app.sheets.body.querySelector('.seed-row:not(.is-disabled)');
    if (first && app.keyboardMode && !silent) first.focus({ preventScroll: true });
    // Premier pommier proposé : un conseil (une fois pour toutes).
    if (!silent && app.sheets.body.querySelector('#seed-apple')) app.hints?.maybe('tree', { selector: '#seed-apple' });
  }

  function choose(crop, all) {
    if (!current || current.kind !== 'seeds') return;
    const index = current.index;
    // « Semer partout » ne plante jamais d'arbre.
    if (all && !(crop.kind === 'tree' || crop.tree || crop.sowAll === false)) {
      // plantAll peut demander confirmation (grosse dépense) : sa réponse arrive alors plus tard.
      Promise.resolve(app.plantAll(crop.id, index)).then((n) => {
        if (n > 0 && current?.kind === 'seeds' && current.index === index) close(false);
      });
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
    const toWorkshop = p.action === 'harvest' && p.processTarget?.hasRoom;
    if (p.action === 'water') {
      actions.push(el('button.btn.btn--red.btn--wide', { type: 'button', id: 'plot-water', onclick: () => { app.water(index); } }, icon('water', 'sm'), f.waterCost ? `Arroser (${fmt(f.waterCost)})` : 'Arroser'));
    } else if (p.action === 'harvest') {
      actions.push(el('button.btn.btn--red.btn--wide', { type: 'button', id: 'plot-harvest', onclick: () => { if (app.harvest(index)?.ok) close(false); } }, icon('harvest', 'sm'), p.forage && !p.cropId ? `Cueillir (+${fmt(p.forage.value)})` : toWorkshop ? 'Récolter → atelier' : p.storeTarget ? 'Récolter → grenier' : `Récolter (+${fmt(p.handValue ?? p.harvestValue ?? 0)})`));
    } else if (p.action === 'plant') {
      actions.push(el('button.btn.btn--red.btn--wide', { type: 'button', id: 'plot-plant', onclick: () => openSeedPicker(index) }, icon('seed', 'sm'), 'Semer'));
    }
    if (actions.length) nodes.push(el('div.sheet-actions', actions));
    if (p.kind === 'tree' && typeof game.actions.removeTree === 'function') {
      nodes.push(
        el(
          'button.btn.btn--wide.btn--danger-soft',
          {
            type: 'button',
            id: 'plot-remove-tree',
            onclick: async () => {
              const ok = await app.dialogs.confirm({
                title: 'Arracher le pommier ?',
                text: 'La parcelle redeviendra libre. Le pommier ne sera pas remboursé.',
                ok: 'Arracher',
                danger: true,
              });
              if (!ok) return;
              const res = app.removeTree(index);
              if (res?.ok) close(false);
            },
          },
          'Arracher le pommier',
        ),
      );
    }
    return el('div.info-sheet', nodes);
  }

  function plotTitle(p) {
    if (!p.unlocked) return 'Parcelle en friche';
    if (!p.cropId && p.forage) return p.forage.kind === 'ring' ? 'Cercle de fées' : 'Champignons à cueillir';
    if (!p.cropId) return 'Parcelle libre';
    if (p.giant) return `${p.cropName} ${agree(p.cropName, 1, 'géant')} !`;
    if (p.kind === 'tree') return p.tree?.fruitReady ? 'Pommier : pommes mûres' : p.cropName || 'Pommier';
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
    // Carrière : « À quoi ça sert » (rôle, effet, conseils) en haut de la fiche.
    const about = game.mode === 'career' && inv.role ? aboutSection(inv, { kind: inv.category === 'animal' ? 'animal' : 'item', levels: false }) : null;
    return el(
      'div.info-sheet',
      about,
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
    if (isProcessing(inv)) return openBuilding(id, silent);
    show('investment', { id }, { title: inv.name, icon: investmentIcon(id, 'sprite--md'), content: investmentContent(id) }, silent);
  }

  // ── Fiche d'un atelier (src/ui/buildings.js) ──────────────────────────────────
  const buildingActions = {
    toggle: (id, on) => app.setProcessing(id, on),
    sellRaw: (id, proc) => confirmSellRaw(app, id, proc),
    buy: (id) => app.buyInvestment(id),
    shop: (id) => app.panel.focusInvestment(id),
  };

  function openBuilding(id, silent = false) {
    const inv = app.game?.query.investments().find((i) => i.id === id);
    // Carrière : les ateliers ne sont pas des « achats » (investments) ; leur fiche est celle de la carrière.
    if (!inv && app.game?.mode === 'career') return app.careerUI?.open.building(id);
    if (!inv) return;
    show('building', { id }, { title: inv.name, icon: investmentIcon(id, 'sprite--md'), content: buildingContent(app, id, buildingActions) }, silent);
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
    } else if (!p.cropId && p.forage) {
      // (lot 2) Champignons du brouillard ou cercle de fées : à cueillir à la main.
      const ring = p.forage.kind === 'ring';
      if (!sheet) rows.push(el('div.tip-title', icon('harvest', 'sm'), ring ? 'Cercle de fées' : 'Champignons à cueillir'));
      rows.push(el('div', icon('coin', 'xs'), `Valeur : ${plural(p.forage.value, 'pièce')}`));
      rows.push(el('div.tip-sub', p.forage.daysLeft > 0 ? `Encore ${plural(p.forage.daysLeft + 1, 'jour')} pour les cueillir.` : 'Dernier jour pour les cueillir !'));
      rows.push(el('div.tip-sub', ring ? 'Des champignons rares, poussés en cercle pendant la nuit.' : 'Poussés dans le brouillard : cueillez-les avant de semer.'));
      if (verb) rows.push(el('div.tip-sub', `${verb} pour cueillir.`));
    } else if (!p.cropId) {
      if (!sheet) rows.push(el('div.tip-title', icon('seed', 'sm'), 'Parcelle libre'));
      rows.push(el(sheet ? 'div' : 'div.tip-sub', sheet ? 'Rien ne pousse ici pour l\'instant.' : `${verb} pour semer.`));
      if (p.fatigue) rows.push(el('div.tip-note.warn', 'Sol fatigué : évitez de replanter la même culture.'));
    } else if (p.kind === 'tree' && p.tree) {
      const t = p.tree;
      if (!sheet) rows.push(el('div.tip-title', cropIcon(p.cropId, 'sprite--xs'), p.cropName || 'Pommier'));
      rows.push(el('div.tip-strong', treeStatus(p)));
      if (!t.fruitReady && !t.dormant && !(t.stage === 'adult' && t.blossom)) {
        rows.push(el('div.tip-progress', el('span.tip-bar', el('span.tip-bar-fill', { style: { width: `${Math.round(treeProgress(t) * 100)}%` } })), el('span', t.stage === 'adult' ? 'fruits' : 'pousse')));
      }
      if (t.fruitReady) processRow(rows, p, sheet);
      rows.push(el('div.tip-ok', icon('winter', 'xs'), 'Pas d\'arrosage, ne gèle jamais.'));
      if (t.stage === 'adult' && Number.isFinite(t.harvestsLeftEstimate)) rows.push(el('div.tip-sub', t.harvestsLeftEstimate > 0 ? `Encore environ ${plural(t.harvestsLeftEstimate, 'panier')} d'ici la fin de l'année.` : 'Plus de pommes d\'ici la fin de l\'année.'));
      else if (t.stage !== 'adult') rows.push(el('div.tip-sub', 'Adulte, il donne un panier de pommes tous les 3 jours en été et en automne.'));
      if (verb) rows.push(el('div.tip-sub', t.fruitReady ? `${verb} pour cueillir les pommes.` : `${verb} pour voir sa fiche.`));
    } else if (p.mature && p.giant) {
      // (lot 2) Légume géant : 4 parcelles, récolté à la main en une fois.
      if (!sheet) rows.push(el('div.tip-title', cropIcon(p.cropId, 'sprite--xs'), `${p.cropName} ${agree(p.cropName, 1, 'géant')} !`));
      rows.push(el('div', icon('coin', 'xs'), `Valeur : ${plural(p.handValue ?? p.harvestValue ?? 0, 'pièce')}`));
      rows.push(el('div.tip-ok', 'Un légume géant sur 4 parcelles : il vaut 6 parcelles et ne pourrit pas.'));
      rows.push(el('div.tip-sub', 'Il se récolte à la main, en une fois.'));
      if (verb) rows.push(el('div.tip-sub', `${verb} pour récolter.`));
    } else if (p.mature) {
      if (!sheet) rows.push(el('div.tip-title', cropIcon(p.cropId, 'sprite--xs'), `${p.cropName} mûre !`));
      rows.push(el('div', icon('coin', 'xs'), `Valeur : ${plural(p.handValue ?? p.harvestValue, 'pièce')}`));
      qualityRows(rows, p, sheet);
      careerRows(rows, p);
      processRow(rows, p, sheet);
      if (p.fatigue) rows.push(el('div.tip-note.warn', 'Sol fatigué : récolte réduite.'));
      if (verb) rows.push(el('div.tip-sub', `${verb} pour récolter.`));
    } else {
      if (!sheet) rows.push(el('div.tip-title', cropIcon(p.cropId, 'sprite--xs'), p.cropName));
      rows.push(el('div.tip-progress', el('span.tip-bar', el('span.tip-bar-fill', { style: { width: `${Math.round(p.progress * 100)}%` } })), el('span', `mûre dans ${plural(p.daysLeft, 'jour')}`)));
      rows.push(
        p.watered
          ? el('div.tip-ok', icon('water', 'xs'), 'Arrosée aujourd\'hui')
          : p.needsWater === false
            ? el('div.tip-ok', icon('water', 'xs'), 'Pousse sans arrosage (sauf en canicule)')
            : el('div.tip-note.warn', icon('water', 'xs'), game.state.weather.today === 'heatwave' ? ((game.level.dryHeatwaveGrowth ?? 0) > 0 ? 'Pas arrosée : pousse à peine (canicule) !' : 'Pas arrosée : ne poussera pas (canicule) !') : `Pas arrosée : pousse ${waterEffect(game.level).slower}`),
      );
      qualityRows(rows, p, sheet);
      if (p.processTarget) rows.push(el('div.tip-sub', productIcon(p.processTarget.productId, 'sprite--xs'), `Transformable : ${p.processTarget.productName.toLowerCase()} ${fmt(p.processTarget.value)}`));
      if (p.willFreeze) rows.push(el('div.tip-note.neg', icon('winter', 'xs'), 'Gèlera avant d\'être mûre !'));
      if (p.crow) rows.push(el('div.tip-note.warn', 'Un corbeau ! Touchez la parcelle pour le chasser.'));
      if (p.fatigue) rows.push(el('div.tip-note.warn', 'Sol fatigué : récolte réduite.'));
      if (!p.watered && verb && p.needsWater !== false) rows.push(el('div.tip-sub', game.state.money < (game.query.finance().waterCost || 0) ? 'Pas assez d\'argent pour arroser.' : `${verb} pour arroser${game.query.finance().waterCost ? ` (${plural(game.query.finance().waterCost, 'pièce')})` : ''}.`));
    }
    return el('div.tip-rows', rows);
  }

  /**
   * (lot 2) Chances de la prochaine récolte à la main (belle, dorée) et soins remplis (docs/GAME_DESIGN.md § 15.1).
   * Fiche seulement (l'infobulle reste courte) ; rien quand les surprises sont désactivées (Classique).
   */
  function qualityRows(rows, p, sheet) {
    if (!sheet || !p.quality || p.kind === 'tree') return;
    const pct = (x) => `${dec(Math.round(x * 1000) / 10, 1).replace(/,0$/, '')} %`;
    rows.push(el('div.tip-quality', el('span', 'Prochaine récolte à la main :'), el('b.q-fine', `belle ${pct(p.quality.fine)}`), el('b.q-gold', `dorée ${pct(p.quality.gold)}`)));
    const c = p.care;
    if (!c) return;
    const care = (ok, text) => el(`span.care${ok ? '.is-ok' : ''}`, `${ok ? '✓' : '·'} ${text}`);
    rows.push(el('div.tip-care', care(c.wateredEveryDay, 'arrosée chaque jour'), care(c.bees, 'ruche'), care(c.rotation, 'sol reposé')));
  }

  /** Carrière : cueillie à la main (+10 %), grenier, cours du jour, corbeau (docs/CARRIERE.md § 3). */
  function careerRows(rows, p) {
    if (p.lot === undefined) return;
    if (p.crow) rows.push(el('div.tip-note.warn', 'Un corbeau ! Touchez la parcelle pour le chasser.'));
    else if (p.crowPenalty) rows.push(el('div.tip-note.warn', 'Le corbeau a abîmé la récolte : −50 %.'));
    if (p.storeTarget) rows.push(el('div.tip-sub', 'Cours bas : la récolte attendra au grenier.'));
    else if (p.handBonus && p.handBonus > 1) rows.push(el('div.tip-ok', `Cueillie à la main : +${Math.round((p.handBonus - 1) * 100)} %`));
    if (p.marketMultiplier && Math.abs(p.marketMultiplier - 1) > 0.01) rows.push(el('div.tip-sub', `Cours du jour ×${dec(p.marketMultiplier, 2)}${p.offSeason ? ' · hors saison ×1,25' : ''}`));
    else if (p.offSeason) rows.push(el('div.tip-sub', 'Hors saison : ×1,25'));
  }

  /** « À la récolte : part à l'atelier (1 place libre) → confiture de fraises 46 » / « Atelier plein : vendue 26 ». */
  function processRow(rows, p, sheet) {
    const t = p.processTarget;
    if (!t) return;
    if (t.hasRoom) {
      const proc = processingOf(app.game, t.buildingId);
      const free = proc ? (proc.places || []).filter((x) => !x).length : null;
      rows.push(
        el(
          `div.tip-note.is-product${sheet ? '' : '.tip-small'}`,
          productIcon(t.productId, 'sprite--xs'),
          `À la récolte : part à l'atelier${free ? ` (${plural(free, 'place libre', 'places libres')})` : ''} → ${t.productName.toLowerCase()} ${fmt(t.value)}`,
        ),
      );
    } else {
      rows.push(el('div.tip-note.warn', `Atelier plein : vendue ${fmt(p.harvestValue ?? 0)}`));
    }
  }

  function investmentTip(id, { sheet = false } = {}) {
    const game = app.game;
    const inv = game?.query.investments().find((i) => i.id === id);
    if (!inv) return null;
    const rows = [];
    if (!sheet && isProcessing(inv)) {
      const proc = inv.owned ? processingOf(game, id) : null;
      rows.push(el('div.tip-title', investmentIcon(id, 'sprite--xs'), inv.owned ? `${inv.name} (niveau ${inv.owned})` : `À vendre : ${inv.name}`));
      if (proc) {
        const used = (proc.places || []).filter(Boolean).length;
        rows.push(el('div', proc.on ? `${used}/${proc.places.length} places occupées` : 'Interrupteur éteint : rien n\'entre'));
        if (used) rows.push(el('div', icon('coin', 'xs'), `En cours : ${fmt(proc.value)} à la vente`));
      } else rows.push(el('div', inv.description));
      rows.push(el('div.tip-sub', 'Cliquez pour voir la fiche.'));
      return el('div.tip-rows', rows);
    }
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
    if (c.kind === 'building') return buildingSignature(g, c.id);
    const p = g.query.plot(c.index);
    if (c.kind === 'seeds') {
      const free = g.query.plots().filter((q) => q.action === 'plant').length;
      return JSON.stringify([p.cropId, p.unlocked, free, g.query.calendar().seasonId, g.query.plantableCrops(c.index).map((x) => [x.id, x.canAfford, x.sellPrice, x.marketMultiplier, x.willFreeze, x.fatigue, x.daysToMature, x.canAfford ? 0 : x.seedCost - g.state.money, x.product?.owned, x.tree?.harvestsBeforeYearEnd])]);
    }
    if (c.kind === 'unlock') {
      const can = g.state.money >= (p.unlockCost ?? Infinity);
      return JSON.stringify([p.unlocked, p.unlockCost, can, can ? 0 : g.state.money]);
    }
    const proc = p.processTarget ? processingOf(g, p.processTarget.buildingId) : null;
    return JSON.stringify([p, g.query.finance().waterCost, g.state.weather.today, proc ? proc.places.filter(Boolean).length : null]);
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
    if (c.kind === 'building') return openBuilding(c.id, true);
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
    if (['moneyChanged', 'dawn', 'seasonStart', 'planted', 'watered', 'harvested', 'plotUnlocked', 'frost', 'rot', 'purchased', 'processingStarted', 'productSold', 'processingSoldRaw', 'processingToggled', 'treeRemoved'].includes(ev.type) && !refreshQueued) {
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
    openBuilding: (id) => openBuilding(id),
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
