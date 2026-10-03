// Interface du lot 2 « Toucher & surprises » (B2 à B6) : messages, sons, récompenses et fenêtres.
//
// createLot2(app) → app.lot2
//   onEvent(ev, game)   main.js (wire) : giant, giantHarvested, surprise, specialWeather, forage, wish,
//                       wishGranted, finds (contrat : docs/ARCHITECTURE.md, « Lot 2 — contrats »)
//   frame()             main.js : montre les fenêtres en attente (vœu, trouvailles) quand rien d'autre n'est ouvert
//   reset(game|null)    nouvelle partie / retour au menu
//   openWish(game?)     fenêtre « Faites un vœu » (3 vœux du cœur → game.actions.makeWish)
//   openFinds(evs)      carte « Trouvailles » du défrichage (carrière) : une seule carte pour les terrains en attente
//   specialIcon(id, cls) sprite de l'icône d'une météo spéciale (repli : icône de base + signe)
//
// Récompenses (à faire côté interface, contrat) : écus (surprise.ecus, finds[].ecus) → progression
// (recordCareerEcus) ; décors trouvés (cosmeticId) → progression.unlockCosmetic, ou ecusIfOwned écus si déjà là.
// Chaque surprise a un message chaleureux (avec son dessin) et une ligne dans le résumé du matin.

import { el, fmt, plural } from './dom.js';
import { spriteAny } from './icons.js';
import { cropName } from './text.js';
import { v3 } from './v3.js';
import { agree } from '../data/french.js';
import { SPECIAL_WEATHERS_BY_ID } from '../data/surprises.js';

const SURPRISE_SPRITES = {
  fairy: ['fairy.0', 'fairy'],
  fox: ['animal.fox.sit', 'animal.fox', 'fox'],
  chest: ['chest.old.open', 'chest.old'],
  hedgehog: ['animal.hedgehog', 'hedgehog'],
  owl: ['owl.carved'],
  ring: ['mushroom.ring'],
};
const SURPRISE_SOUND = { fairy: 'magic', chest: 'reveal', owl: 'reveal' };
const BASE_ICON = { warmrain: 'rain', fog: 'cloudy', shootingstar: 'star', goldenhour: 'sunny', rainbow: 'sunny' };
const FIND_SPRITES = { chest: ['find.chest', 'chest.old'], well: ['find.well'], statue: ['find.statue'], coins: ['find.coins'], seedjar: ['find.seedjar'], lamb: ['find.lostlamb'] };
const WISH_SPRITES = { coins: ['icon.coin', 'find.coins'], growth: ['icon.grow'], luck: ['quality.gold'], water: ['icon.water'] };
const WISH_FALLBACK = { coins: 'coin', growth: 'seed', luck: 'star', water: 'water' };

/** Icône d'une météo spéciale : le dessin `icon.weather.<id>`, sinon l'icône de base avec un petit signe. */
export function specialIcon(id, cls = 'sprite--sm') {
  const names = [`icon.weather.${id}`];
  const node = spriteAny(names, cls, BASE_ICON[id] || 'sunny');
  if (node.classList.contains('ico--fallback')) return el('span.w-special', node);
  return node;
}

/**
 * (Vallée V3) Cartes « Trouvailles » en attente → une seule carte : les événements `finds` qui ont des trouvailles,
 * dans l'ordre d'achat (pur, testé : tests/valley3-qa.test.js).
 */
export function findsGroups(evs) {
  return (Array.isArray(evs) ? evs : [evs]).filter((ev) => ev && Array.isArray(ev.finds) && ev.finds.length);
}

export function createLot2(app) {
  let wishPending = null; // { game, options }
  const findsQueue = [];
  let shownWishDay = null;

  const dialogsBusy = () => app.dialogs.isOpen() || app.tutorial?.active || app.inMenu || !app.game;
  // (Vallée V3) Les fenêtres attendent aussi la fin des écrans et modes où l'on vise : vue de la vallée, terres
  // sauvages, aménagement, paire, décoration, chasse de la fête (elles les masqueraient, ou les feraient quitter).
  const screenBusy = () =>
    !!(app.valleyView?.active || app.places?.wilding || app.valley?.placing || app.heritage?.pairing || app.decor?.active || app.cozy?.feteMode);

  // ── Récompenses ────────────────────────────────────────────────────────────────
  function grantEcus(n) {
    const v = Math.floor(n || 0);
    if (v > 0) app.progression.careerEcus?.(v);
  }
  function grantCosmetic(id, ecusIfOwned) {
    const P = v3.progression;
    if (!id || typeof P?.unlockCosmetic !== 'function') {
      if (ecusIfOwned) grantEcus(ecusIfOwned);
      return null;
    }
    try {
      const r = P.unlockCosmetic(app.progression.get(), id);
      if (r?.progress) app.progression.commit(r.progress);
      if (r?.already && ecusIfOwned) grantEcus(ecusIfOwned);
      app.applyCosmetics?.();
      return r;
    } catch (err) {
      console.warn('unlockCosmetic :', err);
      return null;
    }
  }

  /** Texte d'un décor trouvé déjà possédé. */
  function ownedText(id) {
    return id === 'statue.small' ? 'Vous aviez déjà la petite statue' : 'Vous aviez déjà la chouette sculptée';
  }

  /** Gain réel d'une surprise, pour le résumé du matin (« +24 pièces », « +4 écus »). */
  function surpriseGain(ev, cos) {
    if (ev.amount) return `+${plural(ev.amount, 'pièce')}`;
    if (ev.ecus) return `+${plural(ev.ecus, 'écu')}`;
    if (cos?.already && ev.ecusIfOwned) return `+${plural(ev.ecusIfOwned, 'écu')}`;
    return '';
  }

  function morning(text) {
    app.todo?.morningNote?.(text);
  }

  // ── Météo spéciale ─────────────────────────────────────────────────────────────
  function specialToast(ev) {
    const def = SPECIAL_WEATHERS_BY_ID[ev.id] || {};
    app.toasts.show({ kind: 'success', sprite: specialIcon(ev.id), title: ev.name || def.name || 'Météo rare', text: ev.text || def.text || '', duration: 5200 });
    morning(`${ev.name || def.name} aujourd'hui !`);
    app.audio.tone?.(ev.id === 'shootingstar' ? 'wish' : 'chime', { volume: 0.7, delay: 0.3 });
  }

  // ── Vœu (étoile filante) ───────────────────────────────────────────────────────
  function openWish(game = app.game) {
    const st = game?.query?.surprises?.();
    const w = st?.wish || (wishPending && wishPending.game === game ? { options: wishPending.options } : null);
    if (!w || !w.options?.length) return false;
    wishPending = null;
    let handle = null;
    let done = false;
    const choose = (id) => {
      if (done) return;
      const res = game.actions.makeWish?.(id);
      if (!res || res.ok === false) {
        app.toasts.show({ kind: 'error', icon: 'info', text: res?.reason || 'Ce vœu ne peut pas être fait.', log: false });
        return;
      }
      done = true;
      handle.close('silent');
      app.audio.tone?.('reveal', { volume: 0.8 });
      app.vibrate?.([12, 40, 12]);
    };
    const stars = [];
    for (let i = 0; i < 14; i++) stars.push(el('span.star-dot', { style: `left:${(i * 37) % 100}%;top:${(i * 53) % 70}%` }));
    const body = el(
      'div.lot2-card',
      el('div.lot2-sky', { 'aria-hidden': 'true' }, ...stars, el('span.star-streak')),
      el('p.lot2-lead', 'Cette nuit, des étoiles filantes ont traversé le ciel. Choisissez un vœu :'),
      el(
        'div.wish-choices',
        w.options.map((o) => {
          const opt = typeof o === 'string' ? { id: o, name: o, text: '' } : o;
          return app.dialogs.btn(
            [spriteAny(WISH_SPRITES[opt.id] || [opt.icon], 'sprite--md', WISH_FALLBACK[opt.id] || 'star'), el('span.wish-text', el('b', opt.name), opt.text ? el('small', opt.text) : null)],
            () => choose(opt.id),
            'wish-choice btn--wide',
            { id: `wish-${opt.id}` },
          );
        }),
      ),
    );
    const node = app.dialogs.frame({ title: 'Faites un vœu', cls: 'dialog--wish', body, onClose: () => handle.close() });
    handle = app.dialogs.open(node, {
      id: 'wish',
      pauses: true,
      onClose: (reason) => {
        if (!done && reason !== 'replace') {
          // Plus tard : le vœu reste à faire aujourd'hui ; un message permet d'y revenir.
          app.toasts.show({ kind: 'info', sprite: specialIcon('shootingstar'), key: 'wish-later', title: 'Votre vœu attend', text: 'Faites-le quand vous voulez.', onClick: () => openWish(game), duration: 6000 });
        }
      },
    });
    app.audio.tone?.('wish', { volume: 0.7 });
    return true;
  }

  // ── Trouvailles du défrichage (carrière) ───────────────────────────────────────
  function findLine(f, i) {
    let detail = f.text || '';
    if (!detail && f.amount) detail = `+${fmt(f.amount)} pièces`;
    if (!detail && f.ecus) detail = `+${plural(f.ecus, 'écu')}`;
    return el(
      'li',
      { style: `--i:${i}` },
      spriteAny(FIND_SPRITES[f.kind] || [f.icon], 'sprite--md', 'star'),
      el('span.find-text', el('b', f.title || 'Une trouvaille'), detail ? el('small', detail) : null),
    );
  }

  /**
   * Carte « Trouvailles » : une seule carte pour tous les terrains défrichés depuis la dernière (achats en série, 16ᵉ
   * terrain) — `evs` : un événement `finds` ou une liste ; les trouvailles sont groupées par terrain.
   */
  function openFinds(evs) {
    const groups = findsGroups(evs);
    if (!groups.length) return;
    const count = groups.reduce((a, ev) => a + ev.finds.length, 0);
    let handle = null;
    const where = (ev) => (ev.lotName ? `« ${ev.lotName} »` : 'le terrain');
    let i = 0;
    const lists =
      groups.length === 1
        ? [el('ul.finds-list', groups[0].finds.map((f) => findLine(f, i++)))]
        : groups.map((ev) => el('section.finds-lot', el('h3.finds-lot-name', where(ev).replace(/^./, (c) => c.toUpperCase())), el('ul.finds-list', ev.finds.map((f) => findLine(f, i++)))));
    const body = el(
      'div.lot2-card',
      el('p.lot2-lead', groups.length === 1 ? `En défrichant ${where(groups[0])}, vous avez trouvé :` : `En défrichant ${groups.length} terrains, vous avez trouvé :`),
      ...lists,
    );
    const node = app.dialogs.frame({
      title: count > 1 ? 'Des trouvailles !' : 'Une trouvaille !',
      cls: 'dialog--finds',
      body,
      actions: [app.dialogs.btn('Merveilleux !', () => handle.close(), 'btn--wide', { 'data-autofocus': '', id: 'finds-ok' })],
      onClose: () => handle.close(),
    });
    handle = app.dialogs.open(node, { id: 'finds', pauses: true });
    app.audio.tone?.('reveal', { volume: 0.8 });
  }

  function onFinds(ev) {
    for (const f of ev.finds || []) {
      if (f.ecus) grantEcus(f.ecus);
      if (f.cosmeticId) {
        const r = grantCosmetic(f.cosmeticId, f.ecusIfOwned);
        // La carte dit ce qui a vraiment été reçu (décor déjà possédé → écus).
        if (r?.already && f.ecusIfOwned) f.text = `${ownedText(f.cosmeticId)} : +${plural(f.ecusIfOwned, 'écu')} à la place.`;
      }
    }
    // La carte arrive quand les trouvailles sont sorties des souches (défrichage ~1,6 s).
    findsQueue.push({ ev, at: performance.now() + 2100 + (ev.finds?.length || 1) * 550 });
  }

  // ── Événements ─────────────────────────────────────────────────────────────────
  function onEvent(ev, game) {
    switch (ev.type) {
      case 'giant': {
        const name = ev.cropName || cropName(ev.cropId);
        app.toasts.show({
          kind: 'success',
          sprite: spriteAny([`crop.${ev.cropId}.giant`, `crop.${ev.cropId}.icon`], 'sprite--sm', 'harvest'),
          title: 'Un légume géant !',
          text: `${name} ${agree(name, 1, 'géant')} au champ : à récolter à la main, ${fmt(ev.value || 0)} pièces !`,
          duration: 6000,
        });
        morning(`Un légume géant a poussé (${name.toLowerCase()}) !`);
        app.audio.tone?.('chime', { volume: 0.8, delay: 0.2 });
        break;
      }
      case 'giantHarvested': {
        if (ev.by && ev.by !== 'player') break;
        const name = ev.cropName || cropName(ev.cropId);
        app.audio.tone?.('fanfare', { volume: 0.9, throttle: 400 });
        app.vibrate?.([20, 60, 20, 60, 34]);
        app.toasts.show({
          kind: 'money',
          sprite: spriteAny([`crop.${ev.cropId}.giant`, `crop.${ev.cropId}.icon`], 'sprite--sm', 'harvest'),
          title: 'Récolte géante !',
          text: `${name} ${agree(name, 1, 'géant')} : +${fmt(ev.amount || 0)} pièces. Un souvenir pour longtemps !`,
          duration: 5200,
        });
        break;
      }
      case 'surprise': {
        const names = SURPRISE_SPRITES[ev.kind] || [ev.icon];
        // Récompenses d'abord : le message dit ce qui a vraiment été reçu (coffre, décor déjà possédé).
        if (ev.ecus) grantEcus(ev.ecus);
        const cos = ev.cosmeticId ? grantCosmetic(ev.cosmeticId, ev.ecusIfOwned) : null;
        let text = ev.text || '';
        if (cos?.already && ev.ecusIfOwned) text = `${ownedText(ev.cosmeticId)} : +${plural(ev.ecusIfOwned, 'écu')} à la place.`;
        else if (cos && !cos.already) text = `${text} Posez-la avec « Décorer la ferme » (Grange).`;
        app.toasts.show({ kind: 'success', sprite: spriteAny(names, 'sprite--sm', 'star'), title: ev.title || 'Une surprise !', text, duration: 6500 });
        const gain = surpriseGain(ev, cos);
        morning(`Surprise de la nuit : ${(ev.title || 'une surprise').replace(/^./, (c) => c.toLowerCase())}${gain ? ` (${gain})` : ''} !`);
        app.audio.tone?.(SURPRISE_SOUND[ev.kind] || 'chime', { volume: 0.8, delay: 0.35 });
        break;
      }
      case 'specialWeather':
        specialToast(ev);
        app.hud.refresh();
        break;
      case 'weather':
        if (ev.special) app.hud.refresh();
        break;
      case 'forage':
        // Le cercle de fées est déjà annoncé par sa surprise (même texte).
        if (ev.text && ev.kind !== 'ring') app.toasts.show({ kind: 'info', sprite: spriteAny(ev.kind === 'ring' ? ['mushroom.ring'] : ['mushrooms', 'mushroom', 'mushroom.ring'], 'sprite--sm', 'harvest'), text: ev.text, duration: 4200 });
        break;
      case 'wish':
        wishPending = { game, options: ev.options || [] };
        break;
      case 'wishGranted':
        app.toasts.show({ prio: 'important', kind: 'success', sprite: specialIcon('shootingstar'), title: `Vœu exaucé : ${ev.name || ''}`.trim(), text: ev.text || '', duration: 4600 });
        break;
      case 'finds':
        onFinds(ev);
        break;
      default:
        break;
    }
  }

  function frame() {
    if (!wishPending && !findsQueue.length) return;
    if (dialogsBusy() || screenBusy()) return;
    const now = performance.now();
    if (findsQueue.length && now >= findsQueue[0].at) {
      // Tout ce qui attend part ensemble : une seule carte, jamais une série de fenêtres.
      openFinds(findsQueue.splice(0).map((x) => x.ev));
      return;
    }
    if (wishPending && wishPending.game === app.game) {
      const day = app.game.state.time?.day;
      if (shownWishDay === `${app.game.state.time?.year || 0}|${day}`) {
        wishPending = null;
        return;
      }
      shownWishDay = `${app.game.state.time?.year || 0}|${day}`;
      openWish(app.game);
    } else if (wishPending) wishPending = null;
  }

  function reset() {
    wishPending = null;
    findsQueue.length = 0;
    shownWishDay = null;
  }

  return { onEvent, frame, reset, openWish, openFinds, specialIcon, grantEcus, grantCosmetic };
}

