// Mode Carrière — interface (docs/CARRIERE.md § 10, contrats : docs/ARCHITECTURE.md « Mode Carrière »).
//
// createCareerUI(app) → {
//   active(),                       une carrière est en cours (app.game.mode === 'career')
//   bind(game, { resumed, created }), unbind(),
//   onGameEvent(ev, game),          messages, fenêtres en attente, sauvegardes, pastilles
//   processPending(),               fenêtres de fin de journée (rang, bilan annuel, coups durs, faillite)
//   openTab(id, { fromUser }), activeTab(), tabs(),
//   onHit(hit) → bool,              toucher dans la scène (terrains, abris, employés, corbeaux…)
//   open.* (map, lot, building, storage, team, employee, hire, journal, quest, offer, charges),
//   refresh(), frame(),             frame() : à chaque image (mini-carte)
//   minimap                         la mini-carte (src/ui/career/minimap.js)
// }
//
// Carte 2D (retours d'un joueur) : on achète un terrain précis de la lisière (buyLot(lot.id)), la vue va sur lui
// après l'achat ; la mini-carte en bas à droite et la grande carte (re-toucher « Ferme ») servent à se déplacer.
//
// Les feuilles de la carrière sont « vivantes » : leur contenu est reconstruit (au plus une fois par
// image) quand le jeu change, et seulement si ce qui est affiché a changé (un toucher en cours ne
// tombe pas sur un bouton remplacé à chaque pièce gagnée).
//
// Tout ce qui dépend des lots CORE-B (équipe, machines, animaux à ramasser) et CORE-C (événements,
// quêtes, comice) est protégé : requêtes absentes → valeurs vides ; actions absentes → « Bientôt
// disponible. » (réponse du cœur).

import { el, fmt, plural } from '../dom.js';
import { icon, sprite, cropIcon } from '../icons.js';
import { season } from '../text.js';
import { cIcon, joseph, lotIcon, buildingIcon, portrait, animalProductIcon, animalIcon, capitalize } from './util.js';
import { shopContent } from './shop.js';
import { mapContent, lotContent, buildOptionsContent, planPickerContent, lotInView } from './lots.js';
import { buildingContent, storageContent } from './buildings.js';
import { teamContent, employeeContent, hireContent } from './staff.js';
import { journalContent, chargesContent } from './journal.js';
import { offerContent, questContent, offerTitle } from './events.js';
import { createCareerWindows } from './windows.js';
import { createMinimap } from './minimap.js';

export const CAREER_TABS = [
  { id: 'farm', label: 'Ferme', icon: 'seed', key: 'F' },
  { id: 'buy', label: 'Acheter', icon: 'coin', key: 'B' },
  { id: 'staff', label: 'Équipe', sprite: 'icon.career.staff', icon: 'harvest', key: 'E' },
  { id: 'journal', label: 'Carnet', sprite: 'icon.career.calendar', icon: 'calendar', key: 'J' },
  { id: 'menu', label: 'Menu', icon: 'menu', key: 'Échap' },
];

/** Feuilles de la carrière → onglet actif. */
const SHEET_TAB = {
  'c-shop': 'buy',
  'c-team': 'staff',
  'c-employee': 'staff',
  'c-hire': 'staff',
  'c-journal': 'journal',
};

export function createCareerUI(app) {
  let game = null;
  let live = null; // { spec, lastHtml }
  let queued = false;
  let journalTab = 'farm';
  let mapHere = null; // terrain regardé quand la carte s'est ouverte
  const seen = { candidatesDay: null, questId: null, offers: new Set() };
  const badges = { staff: false, journal: false };

  const windows = createCareerWindows(app, {
    getGame: () => game,
    openJournal: (t) => open.journal(t),
    openTeam: () => open.team(),
  });

  const active = () => !!game && app.game === game && game.mode === 'career' && !app.inMenu;
  const Q = () => game?.query.career || {};

  const minimap = createMinimap(app, {
    active,
    openLot: (lotId) => {
      if (lotId) open.lot(lotId);
    },
    openMap: () => open.map(),
  });

  /** Montre un terrain à l'écran (défilement animé dans les deux sens) ; ferme la feuille ouverte. */
  function showLot(lotId) {
    if (app.sheets.isOpen()) app.sheets.close();
    requestAnimationFrame(() => app.scene?.focusLot?.(lotId, { animate: true }));
  }

  /**
   * Achète CE terrain de la lisière (carte 2D) ; ouvre sa fiche (choisir l'aménagement) et amène la vue sur lui
   * (après la reconstruction de la disposition : deux images plus tard).
   */
  function buyLot(lotId) {
    const res = act('buyLot', lotId);
    if (res?.ok) {
      const id = res.lotId || lotId;
      lotAfterWindows = id; // une fenêtre (nouveau rang…) peut s'intercaler : la fiche se rouvre ensuite
      open.lot(id);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (app.sheets.current === 'c-lot') app.revealLot?.(id, 'c-lot');
        else app.scene?.focusLot?.(id, { animate: true });
      }));
    }
    return res;
  }

  /** Requête de carrière protégée (lot pas encore livré ou erreur → valeur par défaut). */
  function q(name, fallback, ...args) {
    const fn = Q()[name];
    if (typeof fn !== 'function') return fallback;
    try {
      const v = fn(...args);
      return v === undefined ? fallback : v;
    } catch (err) {
      console.warn(`query.career.${name} :`, err);
      return fallback;
    }
  }

  /** Action de carrière : message d'erreur si refusée ; petit retour sonore si réussie. */
  function act(name, ...args) {
    const fn = game?.actions.career?.[name];
    if (typeof fn !== 'function') {
      app.audio.play('error');
      app.toasts.show({ kind: 'error', text: 'Bientôt disponible.' });
      return { ok: false, reason: 'Bientôt disponible.' };
    }
    let res;
    try {
      res = fn(...args);
    } catch (err) {
      console.warn(`actions.career.${name} :`, err);
      res = { ok: false, reason: 'Action impossible pour l\'instant.' };
    }
    if (res && !res.ok) {
      app.audio.play('error');
      app.toasts.show({ kind: 'error', text: res.reason || 'Action impossible.', log: false });
    } else {
      app.vibrate?.(12);
    }
    schedule();
    return res;
  }

  // ── Feuilles vivantes ─────────────────────────────────────────────────────────
  /**
   * spec : { id, title: string | () => string, icon: () => nœud, build: () => nœud, kind, tall,
   *          reveal?: { lotId } | { plot } }
   */
  function openLive(spec) {
    if (!game) return;
    const content = spec.build();
    const replacing = !!live;
    live = { spec, lastHtml: content.outerHTML };
    app.sheets.open({
      id: spec.id,
      kind: spec.kind || 'popup',
      tall: !!spec.tall,
      title: typeof spec.title === 'function' ? spec.title() : spec.title,
      icon: spec.icon ? spec.icon() : null,
      content,
      onClose: (reason) => {
        if (live && live.spec === spec && (reason !== 'replace' || app.sheets.current !== spec.id)) live = null;
      },
    });
    if (!replacing) app.audio.play('page', { volume: 0.5 });
    if (spec.reveal?.lotId) app.revealLot?.(spec.reveal.lotId, spec.id);
    app.tabbar?.refresh();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      lastLiveAt = performance.now();
      refreshLive();
      refreshBadges();
    });
  }

  // Événements du jeu : une grande ferme en émet presque à chaque image (employés, machines, abris). Les feuilles
  // ouvertes (compteurs de l'équipe, stock…) et les pastilles sont remises à jour au plus 4 fois par seconde ;
  // après un toucher (act), tout de suite (schedule).
  let lastLiveAt = 0;
  let softTimer = null;
  const LIVE_MS = 250;
  function scheduleSoft() {
    if (queued || softTimer) return;
    const wait = LIVE_MS - (performance.now() - lastLiveAt);
    if (wait <= 0) {
      schedule();
      return;
    }
    softTimer = setTimeout(() => {
      softTimer = null;
      schedule();
    }, wait);
  }

  function refreshLive() {
    if (!live || !active() || app.sheets.current !== live.spec.id) return;
    // Un doigt posé dans la feuille : on attend qu'il se lève (pas de bouton remplacé sous le doigt).
    if (pressing) {
      schedule();
      return;
    }
    let content;
    try {
      content = live.spec.build();
    } catch (err) {
      console.warn('Feuille de carrière :', err);
      return;
    }
    const html = content.outerHTML;
    if (html === live.lastHtml) return;
    live.lastHtml = html;
    app.sheets.setContent(content, true);
    const t = typeof live.spec.title === 'function' ? live.spec.title() : live.spec.title;
    if (t) app.sheets.setTitle(t);
  }

  let pressing = false;
  app.sheets.body.addEventListener('pointerdown', () => {
    pressing = true;
  });
  window.addEventListener('pointerup', () => {
    pressing = false;
  }, true);
  window.addEventListener('pointercancel', () => {
    pressing = false;
  }, true);

  function closeSheet() {
    if (app.sheets.isOpen()) app.sheets.close();
  }

  // ── Contexte passé aux contenus ───────────────────────────────────────────────
  const ui = {
    app,
    get game() {
      return game;
    },
    q,
    act,
    schedule,
    close: closeSheet,
    buyLot,
    showLot,
    minimap,
    get mapHere() {
      return mapHere;
    },
    get open() {
      return open;
    },
    get journalTab() {
      return journalTab;
    },
    setJournalTab(t) {
      journalTab = t;
      schedule();
      // Changement d'onglet : tout de suite, et en haut de la feuille.
      if (live?.spec.id === 'c-journal') {
        const content = live.spec.build();
        live.lastHtml = content.outerHTML;
        app.sheets.setContent(content, false);
      }
    },
    windows,
  };

  // ── Ouverture des feuilles ────────────────────────────────────────────────────
  const open = {
    shop() {
      openLive({ id: 'c-shop', kind: 'panel', tall: true, title: 'Acheter', icon: () => icon('coin', 'md'), build: () => shopContent(ui) });
    },
    map() {
      // « Vous êtes ici » : le terrain au centre de la vue, avant que la feuille ne la couvre.
      if (app.sheets.current !== 'c-map') mapHere = app.sheets.isOpen() ? mapHere : lotInView(app);
      openLive({ id: 'c-map', kind: 'panel', tall: true, title: 'Carte de la ferme', icon: () => cIcon('map', 'sprite--md', 'seed'), build: () => mapContent(ui) });
    },
    lot(lotId) {
      const lot = q('lot', null, lotId);
      if (!lot) return;
      openLive({
        id: 'c-lot',
        kind: 'popup',
        tall: false,
        title: () => q('lot', lot, lotId)?.name || lot.name,
        icon: () => lotIcon(lot.forSale ? 'forSale' : q('lot', lot, lotId)?.type, 'sprite--md'),
        build: () => lotContent(ui, lotId),
        reveal: { lotId },
      });
    },
    buildOptions(lotId, slot) {
      openLive({ id: 'c-build', kind: 'popup', title: 'Construire', icon: () => icon('coin', 'md'), build: () => buildOptionsContent(ui, lotId, slot), reveal: { lotId } });
    },
    plan(lotId, seasonId) {
      openLive({ id: 'c-plan', kind: 'popup', tall: true, title: `Plan : ${season(seasonId).toLowerCase()}`, icon: () => icon(seasonId, 'md'), build: () => planPickerContent(ui, lotId, seasonId) });
    },
    building(buildingId) {
      const b = q('building', null, buildingId);
      if (!b) return;
      if (buildingId === 'storage' && b.level > 0) return open.storage();
      openLive({
        id: 'c-building',
        kind: 'popup',
        title: () => q('building', b, buildingId)?.name || b.name,
        icon: () => buildingIcon(buildingId, q('building', b, buildingId)?.level || 1, 'sprite--md'),
        build: () => buildingContent(ui, buildingId),
        reveal: b.lotId ? { lotId: b.lotId } : null,
      });
    },
    storage() {
      openLive({ id: 'c-storage', kind: 'panel', tall: true, title: 'Grenier et marché', icon: () => cIcon('storage', 'sprite--md', 'coin'), build: () => storageContent(ui) });
      app.hints.maybe('career.storage', { selector: '#c-storage-mode' });
    },
    team() {
      openLive({ id: 'c-team', kind: 'panel', tall: true, title: 'Équipe', icon: () => cIcon('staff', 'sprite--md', 'harvest'), build: () => teamContent(ui) });
      markCandidatesSeen();
    },
    employee(staffId) {
      const s = q('staff', []).find((x) => x.id === staffId);
      if (!s) return;
      openLive({ id: 'c-employee', kind: 'panel', tall: true, title: () => q('staff', []).find((x) => x.id === staffId)?.name || s.name, icon: () => portrait(s.look, 'sprite--md'), build: () => employeeContent(ui, staffId) });
    },
    hire() {
      openLive({ id: 'c-hire', kind: 'panel', tall: true, title: 'Embaucher', icon: () => cIcon('hire', 'sprite--md', 'harvest'), build: () => hireContent(ui) });
      markCandidatesSeen();
    },
    journal(tab) {
      if (tab) journalTab = tab;
      openLive({ id: 'c-journal', kind: 'panel', tall: true, title: 'Carnet', icon: () => cIcon('calendar', 'sprite--md', 'calendar'), build: () => journalContent(ui) });
      badges.journal = false;
      refreshBadges();
    },
    charges() {
      openLive({ id: 'c-charges', kind: 'popup', title: 'Charges de la ferme', icon: () => icon('bill', 'md'), build: () => chargesContent(ui) });
    },
    quest() {
      openLive({ id: 'c-quest', kind: 'popup', title: 'Quête de Joseph', icon: () => joseph('content', 'sprite--md'), build: () => questContent(ui) });
    },
    offer(offerId) {
      const offers = q('events', { offers: [] })?.offers || [];
      const o = offers.find((x) => (x.offerId ?? x.id) === offerId) || offers[0];
      if (!o) return;
      const id = o.offerId ?? o.id;
      openLive({ id: 'c-offer', kind: 'popup', title: offerTitle(o), icon: () => cIcon(o.kind === 'visitor' ? 'visitor' : 'event', 'sprite--md', 'star'), build: () => offerContent(ui, id) });
    },
  };

  // ── Onglets ───────────────────────────────────────────────────────────────────
  function staffUnlocked() {
    const c = q('candidates', null);
    const cap = c?.capacity ?? 0;
    return cap > 0 || (q('staff', []) || []).length > 0;
  }

  function openTab(id, { fromUser = false } = {}) {
    if (!active()) return;
    if (id === 'menu') {
      app.openPauseMenu();
      return;
    }
    if (id === 'farm') {
      if (app.sheets.isOpen()) {
        app.sheets.close();
        return;
      }
      // Déjà sur la ferme : la carte des terrains.
      if (fromUser) open.map();
      else app.scene?.focusField?.();
      return;
    }
    const sheetFor = { buy: 'c-shop', staff: 'c-team', journal: 'c-journal' }[id];
    if (fromUser && sheetFor && SHEET_TAB[app.sheets.current] === id) {
      app.sheets.close();
      return;
    }
    if (id === 'buy') open.shop();
    else if (id === 'staff') open.team();
    else if (id === 'journal') open.journal();
  }

  function activeTab() {
    const s = app.sheets?.current;
    if (app.dialogs?.top() === 'pause') return 'menu';
    return SHEET_TAB[s] || 'farm';
  }

  function markCandidatesSeen() {
    const c = q('candidates', null);
    seen.candidatesDay = game?.state.career.candidatesDay ?? c?.nextInDays ?? null;
    badges.staff = false;
    refreshBadges();
  }

  function refreshBadges() {
    if (!active()) return;
    const tb = app.tabbar;
    if (!tb) return;
    // Acheter : le terrain suivant est achetable, ou un bâtiment peut monter de niveau.
    const next = q('nextLot', null);
    const bld = q('buildings', []) || [];
    tb.setBadge('buy', game.state.status === 'playing' && (!!next?.canBuy || bld.some((b) => b.canUpgrade && b.level > 0)));
    // Équipe : nouveaux candidats (pas encore vus) ; verrouillée avant le rang 2 et la maison niv. 2.
    const cands = q('candidates', null);
    const day = game.state.career?.candidatesDay ?? null;
    const unlocked = staffUnlocked();
    if (unlocked && cands?.canHire && (cands.list || []).length && day !== null && day !== seen.candidatesDay) badges.staff = true;
    // Onglet verrouillé : jamais de pastille (elle invitait à toucher un onglet qui ne s'ouvre pas).
    tb.setBadge('staff', unlocked && badges.staff);
    tb.setLocked?.('staff', !unlocked);
    // Carnet : quête ou offre nouvelle.
    const quest = q('quest', null);
    if (quest && !quest.accepted && quest.id !== seen.questId) badges.journal = true;
    const offers = q('events', { offers: [] })?.offers || [];
    for (const o of offers) {
      const id = o.offerId ?? o.id;
      if (!seen.offers.has(id)) {
        seen.offers.add(id);
        badges.journal = true;
      }
    }
    tb.setBadge('journal', badges.journal);
  }

  // ── Toucher dans la scène ─────────────────────────────────────────────────────
  /** Cibles propres à la carrière (docs/CARRIERE.md § 10.9). Renvoie true si le toucher est traité. */
  function onHit(hit, { long = false } = {}) {
    if (!active() || !hit) return false;
    switch (hit.type) {
      case 'lotSign':
        // Emplacement vide d'un pré ou d'une cour : directement le choix du bâtiment.
        if (Number.isInteger(hit.slot) && !long) open.buildOptions(hit.lotId, hit.slot);
        else open.lot(hit.lotId);
        return true;
      case 'joseph':
        if (q('quest', null)) open.quest();
        else open.journal('joseph');
        return true;
      case 'lotForSale': {
        // Le panneau « À vendre » touché : la feuille d'achat de CE terrain (prix, ou pourquoi pas encore).
        const lot = hit.lotId ? q('lot', null, hit.lotId) : null;
        const next = lot || q('nextLot', null);
        if (next) open.lot(next.id);
        else open.map();
        return true;
      }
      case 'shelter': {
        const b = q('building', null, hit.buildingId);
        if (!long && b && (b.pending || 0) > 0) {
          const res = act('collect', hit.buildingId);
          if (res?.ok) return true;
        }
        open.building(hit.buildingId);
        return true;
      }
      case 'building':
        if (['jamWorkshop', 'dairy', 'mill', 'cannery', 'spinningMill'].includes(hit.buildingId) && (game.state.investments[hit.buildingId] || 0) > 0) {
          app.field.openBuilding(hit.buildingId);
          return true;
        }
        open.building(hit.buildingId);
        return true;
      case 'machine': {
        const m = (q('machines', []) || []).find((x) => x.key === hit.key);
        if (m?.lotId) open.lot(m.lotId);
        else open.shop();
        return true;
      }
      case 'employee':
        open.employee(hit.staffId);
        return true;
      case 'pond': {
        if (!long) {
          const res = game.actions.career?.fish?.();
          if (res?.ok) {
            app.vibrate?.(15);
            schedule();
            return true;
          }
        }
        const pondLot = (q('lots', []) || []).find((l) => l.type === 'pond');
        if (pondLot) open.lot(pondLot.id);
        return true;
      }
      case 'crow':
        act('chaseCrow', hit.plotIndex);
        return true;
      case 'visitor': {
        // Visiteur (Mme Leblanc, marchand ambulant, animal perdu) : sa carte d'offre ; déjà partie → l'agenda.
        const offers = q('events', { offers: [] })?.offers || [];
        if (offers.some((o) => (o.offerId ?? o.id) === hit.offerId)) open.offer(hit.offerId);
        else if (offers.length) open.offer(offers[0].offerId ?? offers[0].id);
        else open.journal('agenda');
        return true;
      }
      default:
        return false;
    }
  }

  /** Toucher une parcelle marquée d'un corbeau : on le chasse d'abord. */
  function onPlotTap(index) {
    if (!active()) return false;
    const p = game.state.plots[index];
    if (!p?.crow) return false;
    const res = game.actions.career?.chaseCrow?.(index);
    if (res?.ok) {
      app.vibrate?.(15);
      app.audio.play('toggle');
      return true;
    }
    return false;
  }

  // ── Événements du jeu ─────────────────────────────────────────────────────────
  const grouped = { stored: 0, storedCrop: null, collected: 0, collectedIcon: null, collectedAll: 0, diverted: 0 };
  let groupTimer = null;
  function flushGrouped() {
    groupTimer = null;
    const t = app.toasts;
    if (grouped.stored) {
      t.show({ kind: 'info', sprite: grouped.storedCrop ? cropIcon(grouped.storedCrop, 'sprite--sm') : cIcon('storage'), key: 'c-stored', title: grouped.stored > 1 ? `${grouped.stored} récoltes au grenier` : 'Récolte au grenier', text: 'Le cours est bas : elle attend un meilleur prix.', duration: 2800 });
      grouped.stored = 0;
    }
    if (grouped.collected) {
      const all = grouped.collectedAll > 1;
      t.show({ kind: 'money', sprite: grouped.collectedIcon || icon('coin', 'md'), key: 'c-collect', title: all ? `Tout ramassé : ${grouped.collectedAll} abris` : 'Ramassé !', text: `+${fmt(grouped.collected)} pièces`, duration: 2600 });
      grouped.collected = 0;
      grouped.collectedAll = 0;
    }
    if (grouped.diverted) {
      t.show({ kind: 'info', icon: 'harvest', key: 'c-divert', text: `${plural(grouped.diverted, 'récolte mise', 'récoltes mises')} de côté pour une commande.`, duration: 2600 });
      grouped.diverted = 0;
    }
  }
  function group() {
    if (!groupTimer) groupTimer = setTimeout(flushGrouped, 350);
  }

  function nameOfStaff(id) {
    return (q('staff', []) || []).find((s) => s.id === id)?.name || game?.state.career.staff?.find((s) => s.id === id)?.name || 'Votre employé';
  }

  // Achats faits depuis une feuille ouverte : la feuille montre déjà le résultat (pas de pile de messages).
  const QUIET_IN_SHEET = new Set(['buildingBuilt', 'buildingUpgraded', 'staffHired', 'lotDeveloped', 'machineBought', 'machineUpgraded', 'purchased']);

  function onGameEvent(ev) {
    if (!game) return;
    const quiet = QUIET_IN_SHEET.has(ev.type) && app.sheets.isOpen();
    const t = quiet ? { show: () => null, banner: app.toasts.banner } : app.toasts;
    const c = game.state.career;
    switch (ev.type) {
      case 'seasonStart': {
        const ch = q('charges', null);
        const amount = ch?.season?.amount ?? game.query.finance().nextBill.amount;
        const days = (ch?.season?.daysLeft ?? 0) + 1;
        windows.queueBanner({ kind: 'season', icon: ev.seasonId, title: `${season(ev.seasonId)} · année ${ev.year ?? game.state.time.year}`, text: `Charges de saison : ${fmt(amount)} pièces dans ${plural(days, 'jour')}` });
        if (ev.seasonId === 'winter' && (c.staff || []).some((s) => !s.onLeave)) app.hints.maybe('career.leave', { selector: '#tab-staff' });
        break;
      }
      case 'seasonWarning': {
        const ch = q('charges', null);
        app.toasts.banner({
          kind: ev.frost ? 'frost' : 'warn',
          icon: ev.frost ? 'winter' : ev.nextSeasonId,
          title: ev.yearEnd ? `Fin de l'année dans ${plural(ev.daysLeft, 'jour')}` : `${capitalize(season(ev.nextSeasonId, 'the'))} arrive dans ${plural(ev.daysLeft, 'jour')}`,
          text: ev.frost ? 'Au premier matin d\'hiver, les cultures fragiles gèleront (sauf dans la serre).' : `Charges de saison : ${fmt(ch?.season?.amount ?? 0)} pièces`,
          duration: 5200,
        });
        if (ev.yearEnd) app.hints.maybe('career.yearEnd', { selector: '#hud-bill' });
        break;
      }
      case 'billPaid':
        if (ev.career) {
          app.audio.play('coin', { volume: 0.6 });
          t.show({ kind: 'warn', icon: 'bill', title: `Charges ${season(ev.seasonId, 'of')} payées`, text: `−${fmt(ev.amount)} pièces${ev.detail?.lots ? ` (dont ${fmt((ev.detail.perLot || 0) * ev.detail.lots)} pour ${plural(ev.detail.lots, 'terrain')})` : ''}`, duration: 4200 });
        }
        break;
      case 'lotBought':
        app.audio.play('dig');
        t.show({ kind: 'success', sprite: lotIcon('wild', 'sprite--sm'), title: `${ev.name || 'Nouveau terrain'} acheté !`, text: 'La forêt recule : choisissez maintenant son aménagement.', duration: 4200 });
        app.saveNow?.();
        break;
      case 'lotDeveloped':
        app.audio.play('build');
        t.show({ kind: 'success', sprite: lotIcon(ev.lotType, 'sprite--sm'), title: 'Terrain aménagé', text: developText(ev.lotType), duration: 4200 });
        if (ev.lotType === 'field') app.hints.maybe('career.plan', { selector: '#c-plan-spring' });
        app.saveNow?.();
        break;
      case 'buildingBuilt':
      case 'buildingUpgraded': {
        const b = q('building', null, ev.buildingId);
        app.audio.play('build');
        t.show({ kind: 'success', sprite: buildingIcon(ev.buildingId, ev.level, 'sprite--sm'), title: ev.type === 'buildingBuilt' ? `${b?.name || 'Bâtiment'} construit !` : `${b?.name || 'Bâtiment'} : niveau ${ev.level}`, text: buildingText(b), duration: 4200 });
        if (ev.buildingId === 'house' && ev.level >= 2) app.hints.maybe('career.hire', { selector: '#tab-staff' });
        if (ev.buildingId === 'storage') app.hints.maybe('career.storage', null);
        app.saveNow?.();
        break;
      }
      case 'machineBought':
      case 'machineUpgraded':
        app.audio.play('build');
        t.show({ kind: 'success', icon: 'star', title: ev.type === 'machineBought' ? 'Machine installée !' : `Machine : niveau ${ev.level}`, text: machineName(ev.id), duration: 3600 });
        if (ev.type === 'machineBought') app.hints.maybe('career.machine', null);
        app.saveNow?.();
        break;
      case 'staffHired':
        app.audio.play('unlock', { volume: 0.6 });
        t.show({ kind: 'success', sprite: portrait(ev.look || c.staff?.find((s) => s.id === ev.staffId)?.look, 'sprite--sm'), title: `Bienvenue, ${ev.name || nameOfStaff(ev.staffId)} !`, text: 'Touchez sa ligne dans « Équipe » pour lui confier un métier et un terrain.', duration: 4600 });
        app.saveNow?.();
        break;
      case 'staffLeft':
        break;
      case 'staffLevelUp':
        app.audio.play('unlock', { volume: 0.5 });
        t.show({ kind: 'success', sprite: portrait(c.staff?.find((s) => s.id === ev.staffId)?.look, 'sprite--sm'), title: `${ev.name || nameOfStaff(ev.staffId)} : niveau ${ev.level ?? ''}`, text: ev.text || 'Plus efficace chaque jour (le salaire suit).', duration: 4600 });
        break;
      case 'candidatesRenewed':
        badges.staff = true;
        break;
      case 'collected':
        if (ev.by === 'player' && ev.amount > 0) {
          grouped.collected += ev.amount;
          grouped.collectedAll += 1; // abris ramassés dans ce groupe (« Tout ramasser », glissé sur les abris)
          const def = game.state.career.buildings?.[ev.buildingId];
          grouped.collectedIcon = def ? animalProductIcon(shelterAnimal(ev.buildingId), 'sprite--sm') : null;
          group();
          app.audio.play('coin', { volume: 0.7 });
        }
        break;
      case 'animalBorn':
        t.show({ kind: 'success', sprite: animalIcon(ev.animalId, 'sprite--sm'), title: ev.count > 1 ? `${ev.count} petits sont nés !` : 'Une naissance !', text: `La famille s'agrandit (${ev.total ?? ''}).`.replace(' ()', ''), duration: 3600 });
        break;
      case 'truffleFound':
        t.show({ kind: 'money', sprite: animalProductIcon('pig', 'sprite--sm'), title: ev.count > 1 ? `${ev.count} truffes !` : 'Une truffe !', text: `Dans la porcherie, à ramasser (${fmt(ev.amount)}).`, duration: 3400 });
        break;
      case 'fishCaught':
        app.audio.play('coin');
        t.show({ kind: 'money', sprite: cIcon('fishing'), title: ev.name ? `${ev.name} !` : 'Belle prise !', text: `+${fmt(ev.amount)} pièces`, duration: 3000 });
        break;
      case 'stored':
        grouped.stored += ev.n || 1;
        grouped.storedCrop = ev.cropId;
        group();
        break;
      case 'stockSold':
        if (ev.reason !== 'player' && ev.amount > 0) {
          const why = { seller: 'Votre vendeur a vendu du stock au bon cours', charges: 'L\'argent manquait : du stock a été vendu pour les charges', fair: 'Jour de fête : le stock est parti à la foire' }[ev.reason] || 'Stock vendu';
          t.show({ kind: ev.reason === 'charges' ? 'warn' : 'money', sprite: cIcon('storage'), title: `${plural(ev.count, 'unité')} vendue${ev.count > 1 ? 's' : ''}`, text: `${why} : +${fmt(ev.amount)}.`, duration: 4200 });
        } else if (ev.reason === 'player') {
          app.audio.play('coin');
          t.show({ kind: 'money', sprite: cIcon('storage'), title: 'Vendu !', text: `${plural(ev.count, 'unité')} du grenier : +${fmt(ev.amount)} pièces`, duration: 3000 });
        }
        break;
      case 'harvested':
        if (ev.diverted) {
          grouped.diverted += 1;
          group();
        }
        break;
      case 'crow':
        app.audio.play('warning', { volume: 0.5 });
        {
          const n = (ev.plots || []).length || 1;
          // Texte accordé du cœur (« Un corbeau dans les champs : touchez-le pour le chasser. »), sinon le nôtre.
          t.show({ kind: 'warn', sprite: cIcon('crow'), title: 'Des corbeaux !', text: ev.text || (n > 1 ? `${n} parcelles : touchez-les pour les chasser.` : 'Une parcelle : touchez-la pour les chasser.'), duration: 5000 });
        }
        app.hints.maybe('career.crows', (ev.plots || []).length ? { plot: ev.plots[0] } : null);
        break;
      case 'crowChased':
        break;
      case 'careerEvent': {
        const d = ev.data || {};
        const title = ev.name || d.name || d.title || 'Du nouveau à la ferme';
        const text = ev.text || d.text || 'Touchez pour voir le carnet.';
        if (ev.kind === 'crows' || ev.id === 'crows') break; // message « Des corbeaux ! » (événement crow)
        if (d.offerId || ['visitor', 'merchant', 'stray'].includes(ev.kind)) break; // l'offre a son propre message
        t.show({ kind: 'info', sprite: cIcon(eventIconName(ev.kind || ev.id)), title, text, duration: 5200, onClick: () => open.journal('agenda') });
        break;
      }
      case 'offer': {
        const id = ev.offerId ?? ev.id;
        app.audio.play('warning', { volume: 0.45 });
        t.show({ kind: 'info', sprite: cIcon(ev.kind === 'visitor' ? 'visitor' : 'event'), title: offerTitle(ev), text: (ev.data?.text || ev.text || 'Une proposition vous attend.') + ' Touchez pour répondre.', duration: 6500, onClick: () => open.offer(id) });
        badges.journal = true;
        break;
      }
      case 'offerResolved':
        if (ev.outcome === 'delivered' && ev.amount) t.show({ kind: 'money', icon: 'coin', title: 'Commande livrée', text: `+${fmt(ev.amount)} pièces`, duration: 3400 });
        else if (ev.outcome === 'expired') t.show({ kind: 'info', icon: 'calendar', text: `${ev.data?.name || ev.name ? `La proposition (${ev.data?.name || ev.name})` : 'Une proposition'} a expiré : pas grave !`, duration: 3400 });
        break;
      case 'questOffered':
        // Demandée depuis le Carnet : la feuille s'ouvre déjà (pas de message en double).
        if (ev.asked) break;
        app.audio.play('warning', { volume: 0.45 });
        t.show({ kind: 'info', sprite: joseph('content', 'sprite--sm'), title: 'Joseph a une demande', text: `${ev.quest?.text || 'Une quête vous attend.'} Touchez pour voir.`, duration: 6000, onClick: () => open.quest() });
        badges.journal = true;
        app.hints.maybe('career.quest', { selector: '#tab-journal' });
        break;
      case 'questReminder':
        // Rappels à 3 jours et à 1 jour de l'échéance d'une quête acceptée (une fois chacun).
        app.audio.play('warning', { volume: 0.35 });
        t.show({ kind: ev.daysLeft <= 1 ? 'warn' : 'info', sprite: joseph('content', 'sprite--sm'), key: 'c-quest-reminder', title: ev.daysLeft <= 1 ? 'Quête de Joseph : dernier jour demain' : `Quête de Joseph : plus que ${plural(ev.daysLeft, 'jour')}`, text: `« ${ev.line || 'Petit rappel, rien de grave !'} » Touchez pour voir.`, duration: 5600, onClick: () => open.quest() });
        break;
      case 'questWithdrawn':
        // Proposition jamais acceptée : Joseph la retire, sans reproche (message discret).
        t.show({ kind: 'info', sprite: joseph('content', 'sprite--sm'), key: 'c-quest-withdrawn', text: `« ${ev.line || 'Finalement, je me suis débrouillé. Merci quand même !'} » — Joseph`, duration: 3400 });
        break;
      case 'offerReminder':
        app.audio.play('warning', { volume: 0.35 });
        t.show({ kind: 'warn', sprite: cIcon('visitor'), key: `c-offer-reminder-${ev.offerId}`, title: 'Commande : dernier jour demain', text: `${ev.text || 'Une commande attend encore.'} Touchez pour voir.`, duration: 5600, onClick: () => open.offer(ev.offerId) });
        break;
      case 'questProgress':
        break;
      case 'questDone':
        app.audio.play('unlock', { volume: 0.7 });
        try {
          app.progression.careerEcus?.(ev.ecus || 0);
        } catch (err) {
          console.warn('recordCareerEcus :', err);
        }
        t.show({ kind: 'success', sprite: joseph('happy', 'sprite--sm'), title: `Quête réussie : +${fmt(ev.amount || 0)} pièces`, text: `« ${ev.line || 'Formidable, merci !'} »${ev.ecus ? ` · +${plural(ev.ecus, 'écu')}` : ''}`, duration: 5200 });
        break;
      case 'questExpired':
        // Échec en douceur : aucune pénalité, ce qui a été mis de côté est payé.
        if (!ev.declined) t.show({ kind: 'info', sprite: joseph('content', 'sprite--sm'), title: 'Quête de Joseph terminée', text: `« ${ev.line || 'Ce n\'est pas grave du tout ! Merci d\'avoir essayé.'} »${ev.amount ? ` +${fmt(ev.amount)} pièces pour ce qui était livré.` : ' Aucune pénalité.'}`, duration: 5200 });
        break;
      case 'josephHeart':
        app.audio.play('unlock', { volume: 0.5 });
        t.show({ kind: 'success', sprite: cIcon('heart'), title: `Amitié de Joseph : ${ev.hearts} ♥`, text: ev.unlock ? `${ev.unlock.name} : ${ev.unlock.text}` : `« ${ev.line || 'On s\'entend bien, tous les deux.'} »`, duration: ev.unlock ? 6000 : 4200 });
        break;
      case 'josephOrchard':
        t.show({ kind: 'success', sprite: joseph('proud', 'sprite--sm'), title: 'Le verger de Joseph', text: `« ${ev.line || ''} »`, duration: 6000 });
        break;
      case 'festival':
        app.toasts.banner({ kind: 'season', icon: game.query.calendar().seasonId, title: ev.name, text: ev.text || 'Jour de fête à la ferme !', duration: 5200 });
        break;
      case 'contestAnnounced':
        t.show({ kind: 'info', sprite: cIcon('contest'), title: 'Le comice agricole est annoncé', text: 'Trois épreuves, jugées le dernier soir de l\'automne. Touchez pour les voir.', duration: 6000, onClick: () => open.journal('agenda') });
        break;
      case 'shelterFull':
        t.show({ kind: 'warn', icon: 'harvest', key: `full-${ev.buildingId}`, title: `${q('building', null, ev.buildingId)?.name || 'Abri'} : plein`, text: 'Ramassez vite : la production du jour se perd.', duration: 4200 });
        break;
      case 'touristsPassed':
        if (ev.pass === 1) t.show({ kind: 'money', sprite: cIcon('visitor'), title: 'Des touristes !', text: `+${fmt(ev.amount)} pièces à chaque passage aujourd'hui.`, duration: 3600 });
        break;
      case 'purchased': {
        const inv = game.query.investments().find((i) => i.id === ev.investmentId);
        app.audio.play('coin', { volume: 0.5 });
        t.show({ kind: 'success', sprite: inv?.category === 'animal' ? animalIcon(ev.investmentId, 'sprite--sm') : icon('coin', 'md'), title: `${inv?.name || 'Achat'} ×${ev.owned}`, text: inv?.category === 'animal' ? 'Ses produits s\'accumulent dans l\'abri : touchez-le pour ramasser.' : inv?.description || '', duration: 3600 });
        break;
      }
      case 'hardship':
        if (ev.stage === 'recovered') {
          app.audio.play('unlock', { volume: 0.6 });
          t.show({ kind: 'success', sprite: joseph('happy', 'sprite--sm'), title: 'La passe difficile est finie', text: 'Employés et machines se remettent au travail.', duration: 5000 });
        } else windows.queue('hardship', ev);
        break;
      case 'rescueSale':
        windows.queue('rescue', ev);
        break;
      case 'neighbourLoan':
        windows.queue('loan', ev);
        break;
      case 'rankUp':
        windows.queue('rank', ev);
        break;
      case 'yearEnd':
        windows.queue('year', ev);
        app.saveNow?.();
        break;
      case 'bankrupt':
        windows.queue('bankrupt', ev);
        break;
      case 'dawn':
        maybeCollectHint();
        maybeLotHint();
        break;
      default:
        break;
    }
    scheduleSoft();
  }

  function shelterAnimal(buildingId) {
    return { coop: 'hen', hutch: 'rabbit', duckPond: 'duck', goatShed: 'goat', cowshed: 'cow', sheepfold: 'sheep', pigsty: 'pig', stable: 'horse' }[buildingId] || 'hen';
  }

  function maybeCollectHint() {
    const b = (q('buildings', []) || []).filter((x) => (x.pending || 0) > 0);
    if (b.length) app.hints.maybe('career.collect', { selector: '#tab-farm' });
    // Plusieurs abris à ramasser : le bouton « Tout ramasser » de la ligne « À faire ».
    if (b.length >= 2) app.hints.maybe('career.collectAll', { selector: '#todo' });
  }

  /**
   * « La forêt à vendre » : dès que le premier terrain devient abordable (ou presque), pas un an plus tard en
   * ouvrant la boutique (le conseil couvrait alors le haut de la feuille « Acheter »).
   */
  function maybeLotHint() {
    if ((game.state.career?.lotsBought || 0) > 0) return;
    const next = q('nextLot', null);
    if (!next) return;
    if (next.canBuy || game.state.money >= (next.price || Infinity) * 0.8) app.hints.maybe('career.lotForSale', { selector: '#tab-buy' });
  }

  function developText(type) {
    return {
      field: '16 parcelles prêtes à semer. Réglez son plan de culture dans sa fiche.',
      meadow: 'Deux emplacements pour des abris d\'animaux.',
      orchard: 'Neuf emplacements pour des arbres fruitiers.',
      workshops: 'Deux emplacements pour des ateliers.',
      pond: 'Une mare pour les canards et la pêche.',
      greenhouse: 'Des cultures en toute saison, à l\'abri du gel.',
    }[type] || 'Le terrain est prêt.';
  }

  function buildingText(b) {
    if (!b) return '';
    const e = b.effects || {};
    if (e.staff !== undefined) return e.staff ? `Jusqu'à ${plural(e.staff, 'employé')}.` : '';
    if (e.capacity) return `Stock : ${plural(e.capacity, 'unité')} au plus.`;
    if (e.animals) return `Jusqu'à ${plural(e.animals, 'animal', 'animaux')}.`;
    if (e.places) return `${plural(e.places, 'place')} de travail.`;
    if (e.priceBonus) return `Ventes +${Math.round(e.priceBonus * 100)} %.`;
    if (e.plots) return `${plural(e.plots, 'parcelle')} sous verre.`;
    return '';
  }

  function machineName(id) {
    const cat = q('machineCatalog', []) || [];
    return cat.find((m) => m.id === id)?.name || '';
  }

  function eventIconName(kind) {
    return { visitor: 'visitor', tourists: 'visitor', crows: 'crow', rainbow: 'rainbow', dew: 'event', merchant: 'coins', stray: 'heart', gift: 'heart', fair: 'contest', contest: 'contest' }[kind] || 'event';
  }

  // ── Cycle de vie ──────────────────────────────────────────────────────────────
  function bind(g, { resumed = false, created = false, quiet = false } = {}) {
    game = g;
    live = null;
    lotAfterWindows = null;
    interruptedLot = null;
    seen.candidatesDay = g.state.career?.candidatesDay ?? null;
    seen.questId = null;
    seen.offers = new Set((q('events', { offers: [] })?.offers || []).map((o) => o.offerId ?? o.id));
    badges.staff = false;
    badges.journal = false;
    windows.reset();
    app.tabbar?.setTabs?.(CAREER_TABS);
    document.body.classList.add('is-career');
    refreshBadges();
    const s = q('summary', null);
    if (resumed) {
      // Reprise depuis le menu : la fenêtre « Où en étais-je ? » dit déjà tout (quiet).
      if (!quiet) app.toasts.show({ kind: 'info', icon: 'calendar', title: s?.farmName || 'Ma ferme', text: `Reprise : année ${s?.year ?? 1}, ${season(s?.seasonId || 'spring').toLowerCase()} jour ${s?.day ?? 1}.`, duration: 3600 });
    } else if (!created) {
      app.toasts.banner({ kind: 'season', icon: s?.seasonId || 'spring', title: s?.farmName || 'Ma ferme', text: `Année ${s?.year ?? 1} · ${s?.rankName || ''}`, duration: 3800 });
    }
    if (created) windows.intro(g);
    else app.hints.maybe('career.start', null);
  }

  function unbind() {
    game = null;
    live = null;
    windows.reset();
    document.body.classList.remove('is-career');
    app.tabbar?.setTabs?.(null);
  }

  // Fiche d'un terrain fermée par une fenêtre (achat d'un terrain → « Nouveau rang ! ») : rouverte quand toutes
  // les fenêtres sont fermées (avant, la feuille restait vide, avec son seul titre : bug [42] de l'analyse).
  let lotAfterWindows = null;
  let interruptedLot = null;

  function processPending() {
    if (!active()) return;
    flushGrouped();
    const lotOpen = app.sheets.current === 'c-lot' ? live?.spec.reveal?.lotId || null : null;
    const wasOpen = app.dialogs.isOpen();
    windows.process();
    if (!wasOpen && app.dialogs.isOpen()) {
      if (lotOpen && lotOpen === lotAfterWindows) interruptedLot = lotOpen;
      lotAfterWindows = null;
    } else if (!app.dialogs.isOpen()) {
      lotAfterWindows = null;
      if (interruptedLot && !windows.pending && !app.sheets.isOpen()) {
        const id = interruptedLot;
        interruptedLot = null;
        open.lot(id);
      } else if (interruptedLot && app.sheets.isOpen()) interruptedLot = null;
    }
  }

  /** À chaque image (après le dessin de la scène) : la mini-carte. */
  function frame() {
    minimap.frame();
  }

  return {
    active,
    bind,
    unbind,
    onGameEvent,
    processPending,
    openTab,
    activeTab,
    tabs: () => CAREER_TABS,
    onHit,
    onPlotTap,
    open,
    q,
    act,
    refresh: schedule,
    frame,
    minimap,
    buyLot,
    showLot,
    windows,
    get game() {
      return game;
    },
    staffUnlocked,
    portraitOf: (look) => portrait(look, 'sprite--sm'),
    sprite,
  };
}
