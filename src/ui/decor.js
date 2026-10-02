// Personnalisation : mode décoration (téléphone d'abord) et éléments partagés avec la grange.
//
// createDecor(app) → { available(), active, enter({ fromMenu }), exit(), onHit(hit) → bool,
//                      hoverText(hit), openSlot(id), openSlots(), openSign(), openOutfit(),
//                      openPath(), openFence(), onKey(e) }
// Exports partagés : cosmeticTile(app, item, opts), unlockFlow(app, item) → Promise<bool>,
//                    validateFarmName(text, max) → { ok, value, error }, farmNameForm(app, opts)
//
// Mode décoration : la partie se met en pause (raison 'decor'), la scène montre les repères des
// emplacements (scene.setDecorMode(true)) et la barre d'onglets est remplacée par la barre
// « Objets · Allées · Clôture · Tenue · Terminer », avec le solde d'écus. Toucher un
// emplacement → feuille du bas (objets à poser, à débloquer en écus, « Retirer ») ; le panneau
// de la ferme → son nom ; le fermier → sa tenue. Tout est enregistré dans la progression et
// appliqué à la scène (scene.setCosmetics). Depuis le menu principal (grange → Ma ferme), on
// décore la ferme de démonstration derrière le menu. La personnalisation n'a aucun effet sur le jeu.

import { v3 } from './v3.js';
import { el, fmt, plural, setText } from './dom.js';
import { cosmeticIcon, ecuIcon, icon, outfitIcon } from './icons.js';

const CATEGORY_TITLE = { small: 'Petit décor', large: 'Grand décor', path: 'Allées', fence: 'Clôture du champ', outfit: 'Tenue du fermier' };

/** Nom de la ferme : espaces retirés, 1 à `max` caractères, lettres (accents compris), chiffres, espaces, ' - . & */
export function validateFarmName(text, max = 18) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, value, error: 'Le nom ne peut pas être vide.' };
  const len = [...value].length;
  if (len > max) return { ok: false, value, error: `${max} caractères au plus (${plural(len - max, 'caractère')} de trop).` };
  if (!/^[\p{L}\p{N} '’\-.&]+$/u.test(value)) return { ok: false, value, error: 'Lettres, chiffres, espaces, apostrophes et traits d\'union seulement.' };
  if (!/\p{L}/u.test(value)) return { ok: false, value, error: 'Le nom doit contenir au moins une lettre.' };
  return { ok: true, value };
}

/**
 * Formulaire « Nom de la ferme » (champ, compteur, erreur, « Valider »).
 * opts : { onSaved(name) }
 */
export function farmNameForm(app, { onSaved } = {}) {
  const P = app.progression;
  const max = v3.cosmetics?.FARM_NAME_MAX || 18;
  const input = el('input.name-input', {
    type: 'text',
    id: 'farm-name-input',
    value: P.farmName(),
    maxLength: max + 6, // on laisse taper un peu plus : le message explique la limite
    autocomplete: 'off',
    autocapitalize: 'words',
    spellcheck: 'false',
    enterKeyHint: 'done',
    'aria-label': 'Nom de la ferme',
  });
  const count = el('span.name-count');
  const error = el('p.name-error', { role: 'alert' });
  const save = el('button.btn.btn--red', { type: 'button', id: 'farm-name-save' }, 'Valider');
  const check = () => {
    const r = validateFarmName(input.value, max);
    const len = [...input.value.trim()].length;
    setText(count, `${len}/${max}`);
    count.classList.toggle('is-over', len > max);
    setText(error, input.value.trim() && !r.ok ? r.error : '');
    save.classList.toggle('is-disabled', !r.ok);
    save.setAttribute('aria-disabled', r.ok ? 'false' : 'true');
    return r;
  };
  const submit = () => {
    const r = check();
    if (!r.ok) {
      app.audio.play('error');
      setText(error, r.error);
      return;
    }
    P.setFarmName(r.value);
    app.audio.play('confirm');
    input.blur();
    app.applyCosmetics?.();
    app.toasts.show({ kind: 'success', icon: 'star', text: `Votre ferme s'appelle désormais « ${P.farmName()} ».` });
    onSaved?.(P.farmName());
  };
  input.addEventListener('input', check);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    e.stopPropagation(); // pas de raccourcis du jeu pendant la saisie
  });
  // Clavier du téléphone : la feuille reste au-dessus (hauteur utile = visualViewport).
  input.addEventListener('focus', () => setTimeout(() => input.scrollIntoView({ block: 'nearest' }), 300));
  save.addEventListener('click', submit);
  check();
  return el('div.name-form', el('div.name-row', input, save), el('div.name-meta', error, count));
}

/** État d'un objet pour le joueur : 'placed' | 'owned' | 'buyable' | 'poor' | 'tofind' (lot 2 : à trouver à la ferme). */
function stateOf(app, item, placed) {
  if (placed) return 'placed';
  if (app.progression.owns(item.id) || item.isDefault) return 'owned';
  // (lot 2) Décor trouvé à la ferme (surprise, trouvaille) : ne s'achète jamais.
  if (item.found) return 'tofind';
  if (!item.price) return 'owned';
  return app.progression.ecus() >= item.price ? 'buyable' : 'poor';
}

/** (lot 2) Où se trouve un décor « trouvé à la ferme ». */
function foundHint(item) {
  if (item.id === 'statue.small') return 'en défrichant un terrain (carrière)';
  // (lot 3) Étal de Basile le colporteur ; cadeau de la journaliste (année du boom touristique, carrière).
  if (item.id === 'lantern.peddler' || item.id === 'weathervane.rooster') return 'à l\'étal de Basile le colporteur';
  if (item.id === 'sign.magazine') return 'grâce à la journaliste de « Campagne & Jardins » (carrière)';
  return 'au petit matin, sous une vieille souche';
}

/**
 * Tuile d'un objet (≥ 64 px) : icône, nom, « Posé » / « Débloqué » / écus / « Il manque… ».
 * opts : { placed, placedLabel, onPick(item) }
 */
export function cosmeticTile(app, item, { placed = false, placedLabel = 'Posé', onPick, count = 0 } = {}) {
  const st = stateOf(app, item, placed);
  const missing = st === 'poor' ? item.price - app.progression.ecus() : 0;
  const status =
    st === 'placed'
      ? el('span.cos-status.is-placed', `✓ ${placedLabel}`)
      : st === 'owned'
        ? el('span.cos-status', count ? `Posé ×${count}` : item.found ? 'Trouvé à la ferme' : 'Débloqué')
        : st === 'tofind'
          ? el('span.cos-status.is-tofind', 'À trouver à la ferme')
          : st === 'buyable'
            ? el('span.cos-status.is-price', ecuIcon('sprite--xs'), fmt(item.price))
            : el('span.cos-status.is-poor', `Il manque ${plural(missing, 'écu')}`);
  return el(
    `button.cos-tile.is-${st}`,
    {
      type: 'button',
      id: `cos-${item.id.replace(/\./g, '-')}`,
      'aria-pressed': placed ? 'true' : 'false',
      'aria-label': `${item.name} : ${status.textContent}`,
      onclick: () => onPick?.(item, st),
    },
    el('span.cos-icon', item.category === 'outfit' ? outfitIcon(item.id, 'sprite--card') : cosmeticIcon(item, item.category === 'large' ? 'sprite--md' : 'sprite--card')),
    el('span.cos-name', item.name),
    status,
  );
}

/** Débloque un objet (confirmation, écus). Renvoie true si l'objet est possédé à la fin. */
export async function unlockFlow(app, item) {
  const P = app.progression;
  if (P.owns(item.id) || item.isDefault) return true;
  if (item.found) {
    // (lot 2) Ne s'achète pas (progression.buyCosmetic le refuse) : il se trouve en jouant.
    app.audio.play('click');
    app.toasts.show({ kind: 'info', icon: 'star', title: item.name, text: `Cet objet ne s'achète pas : il se trouve à la ferme, ${foundHint(item)}.` });
    return false;
  }
  if (!item.price) return true;
  if (P.ecus() < item.price) {
    app.audio.play('error');
    app.toasts.show({ kind: 'error', text: `Il manque ${plural(item.price - P.ecus(), 'écu')} pour « ${item.name} ». Gagnez des écus en jouant (années réussies, succès).` });
    return false;
  }
  const ok = await app.dialogs.confirm({
    title: 'Débloquer ?',
    text: `Débloquer « ${item.name} » pour ${plural(item.price, 'écu')} ? Il vous restera ${plural(P.ecus() - item.price, 'écu')}. Un objet débloqué l'est pour toujours.`,
    ok: 'Débloquer',
  });
  if (!ok) return false;
  const res = P.buyCosmetic(item.id);
  if (!res?.ok) {
    app.audio.play('error');
    app.toasts.show({ kind: 'error', text: res?.reason || 'Achat impossible.' });
    return false;
  }
  app.audio.play('buy');
  app.audio.play('unlock', { delay: 0.2, volume: 0.6 });
  return true;
}

export function createDecor(app) {
  let active = false;
  let fromMenu = false;
  let bar = null;
  let header = null;
  let ecusNode = null;

  const P = () => app.progression;
  const available = () => !!P()?.available() && (v3.cosmetics?.COSMETICS || []).length > 0;
  const slots = () => v3.cosmetics?.DECOR_SLOTS || [];
  const items = (cat) => P().cosmeticsList(cat);

  function build() {
    if (bar) return;
    ecusNode = el('b.decor-ecus-value', '0');
    header = el(
      'div.decor-header',
      { 'aria-live': 'polite' },
      el('span.decor-title', 'Mode décoration'),
      el('span.decor-ecus', ecuIcon('sprite--sm'), ecusNode, el('span.decor-ecus-label', 'écus')),
    );
    const b = (id, label, ico, onclick, cls = '') =>
      el(`button.tabbar-btn.decor-btn${cls}`, { type: 'button', id: `decor-${id}`, onclick: () => { app.vibrate?.(8); onclick(); } }, el('span.tabbar-ico', ico), el('span.tabbar-label', label));
    bar = el(
      'nav.decorbar',
      { id: 'decorbar', 'aria-label': 'Décoration' },
      b('slots', 'Objets', icon('star', 'md'), () => openSlots()),
      b('path', 'Allées', icon('seed', 'md'), () => openPath()),
      b('fence', 'Clôture', icon('lock', 'md'), () => openFence()),
      b('outfit', 'Tenue', outfitIcon(P().cosmetics().outfit, 'sprite--sm'), () => openOutfit()),
      b('done', 'Terminer', icon('play', 'md'), () => exit(), '.is-done'),
    );
    document.body.append(header, bar);
  }

  function refreshBar() {
    if (!bar) return;
    setText(ecusNode, fmt(P().ecus()));
    const ob = bar.querySelector('#decor-outfit .tabbar-ico');
    if (ob) ob.replaceChildren(outfitIcon(P().cosmetics().outfit, 'sprite--sm'));
  }

  function enter({ fromMenu: menu = app.inMenu } = {}) {
    if (!available() || active) return;
    build();
    active = true;
    fromMenu = !!menu;
    app.dialogs.closeAll();
    app.sheets.close('silent');
    app.input?.cancel();
    if (!fromMenu) app.pushPause('decor');
    document.body.classList.add('in-decor');
    refreshBar();
    if (typeof app.scene?.setDecorMode === 'function') app.scene.setDecorMode(true);
    app.applyCosmetics?.();
    app.audio.play('open');
    app.onDecorChange?.(true);
    const sceneReady = typeof app.scene?.setDecorMode === 'function';
    app.toasts.show({
      kind: 'info',
      icon: 'star',
      text: sceneReady ? 'Touchez un repère « + » pour poser une décoration, le panneau pour renommer la ferme, le fermier pour sa tenue.' : 'Choisissez « Objets » pour poser une décoration sur un emplacement.',
      duration: 5200,
    });
  }

  function exit() {
    if (!active) return;
    active = false;
    app.sheets.close('silent');
    if (typeof app.scene?.setDecorMode === 'function') app.scene.setDecorMode(false);
    document.body.classList.remove('in-decor');
    app.audio.play('close');
    app.onDecorChange?.(false);
    if (fromMenu) {
      app.dialogs.mainMenu();
      app.grange.open('farm');
    } else {
      app.popPause('decor');
      app.tabbar.refresh();
    }
    // Succès « Jolie ferme » (décorations posées) : vérifié en quittant le mode.
    app.progression.checkGame(fromMenu ? null : app.game);
  }

  /** Cible touchée dans la scène en mode décoration. */
  function onHit(hit) {
    if (!active || !hit) return false;
    if (hit.type === 'decorSlot') {
      app.audio.play('page', { volume: 0.7 });
      openSlot(hit.id);
      return true;
    }
    if (hit.type === 'sign') {
      app.audio.play('page', { volume: 0.7 });
      openSign();
      app.revealDecorSlot?.('sign', 'decor-sign');
      return true;
    }
    if (hit.type === 'farmer') {
      app.audio.play('page', { volume: 0.7 });
      openOutfit();
      app.revealDecorSlot?.('farmer', 'decor-outfit');
      return true;
    }
    return false;
  }

  function hoverText(hit) {
    if (!hit) return null;
    if (hit.type === 'decorSlot') {
      const s = slots().find((x) => x.id === hit.id);
      const placed = P().cosmetics().decor[hit.id];
      const item = placed ? items().find((i) => i.id === placed) : null;
      return `${s?.name || hit.id}${item ? ` : ${item.name}` : ' (libre)'}`;
    }
    if (hit.type === 'sign') return `Panneau : « ${P().farmName()} » (cliquez pour renommer)`;
    if (hit.type === 'farmer') return 'Le fermier (cliquez pour changer de tenue)';
    return null;
  }

  function sheet(id, title, iconNode, content) {
    app.sheets.open({ id: `decor-${id}`, kind: 'popup', title, icon: iconNode, content, className: 'sheet--decor' });
  }

  function refreshOpen() {
    refreshBar();
    const cur = app.sheets.current;
    if (!cur?.startsWith('decor-')) return;
    const top = app.sheets.body.scrollTop;
    if (cur.startsWith('decor-slot:')) openSlot(cur.slice('decor-slot:'.length), true);
    else if (cur === 'decor-slots') openSlots(true);
    else if (cur === 'decor-outfit') openOutfit(true);
    else if (cur === 'decor-path') openPath(true);
    else if (cur === 'decor-fence') openFence(true);
    app.sheets.body.scrollTop = top;
  }

  function changed() {
    app.applyCosmetics?.();
    refreshOpen();
  }

  // ── Emplacement ───────────────────────────────────────────────────────────────
  function openSlot(slotId, silent = false) {
    const slot = slots().find((s) => s.id === slotId) || { id: slotId, name: slotId, kind: 'small' };
    const placedId = P().cosmetics().decor[slotId] || null;
    const list = items(slot.kind === 'large' ? 'large' : 'small');
    const placedItem = placedId ? list.find((i) => i.id === placedId) : null;
    const pick = async (item) => {
      if (item.id === placedId) return;
      if (!(await unlockFlow(app, item))) return;
      const res = P().placeDecor(slotId, item.id);
      if (!res?.ok) {
        app.audio.play('error');
        app.toasts.show({ kind: 'error', text: res?.reason || 'Impossible de poser cet objet ici.' });
        return;
      }
      app.audio.play('build', { volume: 0.7 });
      app.vibrate?.(12);
      changed();
    };
    const content = el(
      'div.decor-sheet',
      el('p.decor-now', placedItem ? ['Posé ici : ', el('b', placedItem.name)] : 'Emplacement libre : choisissez un objet.'),
      el('div.cos-grid', list.map((item) => cosmeticTile(app, item, { placed: item.id === placedId, onPick: pick }))),
      placedId
        ? el(
            'button.btn.btn--wide',
            {
              type: 'button',
              id: 'decor-remove',
              onclick: () => {
                P().placeDecor(slotId, null);
                app.audio.play('dig', { volume: 0.6 });
                changed();
              },
            },
            'Retirer',
          )
        : null,
      el('p.sheet-hint', 'Un objet débloqué l\'est pour toujours et se pose sur autant d\'emplacements que vous voulez. Purement décoratif.'),
    );
    if (silent && app.sheets.current === `decor-slot:${slotId}`) return app.sheets.setContent(content);
    sheet(`slot:${slotId}`, slot.name, placedItem ? cosmeticIcon(placedItem, 'sprite--md') : icon('star', 'md'), content);
    // L'emplacement reste visible au-dessus de la feuille (aussi depuis la liste « Objets »).
    app.revealDecorSlot?.(slotId, `decor-slot:${slotId}`);
  }

  /** Liste des emplacements (aussi utilisable sans les repères de la scène). */
  function openSlots(silent = false) {
    const decor = P().cosmetics().decor;
    const rows = slots()
      .filter((s) => s.kind !== 'sign')
      .map((s) => {
        const it = decor[s.id] ? items().find((i) => i.id === decor[s.id]) : null;
        return el(
          'button.slot-row',
          { type: 'button', id: `slot-${s.id.replace(/\./g, '-')}`, onclick: () => { app.audio.play('page', { volume: 0.6 }); openSlot(s.id); } },
          el('span.slot-icon', it ? cosmeticIcon(it, 'sprite--md') : el('span.slot-plus', '+')),
          el('span.slot-main', el('span.slot-name', s.name), el('span.slot-sub', it ? it.name : s.kind === 'large' ? 'Libre · grand décor' : 'Libre')),
        );
      });
    const content = el(
      'div.decor-sheet',
      el('div.slot-list', rows),
      el('button.btn.btn--wide', { type: 'button', id: 'decor-sign', onclick: () => openSign() }, icon('bill', 'sm'), `Nom de la ferme : ${P().farmName()}`),
      el('p.sheet-hint', 'Certains emplacements n\'existent pas dans tous les niveaux : l\'objet y reste enregistré et réapparaît ailleurs.'),
    );
    if (silent && app.sheets.current === 'decor-slots') return app.sheets.setContent(content);
    sheet('slots', 'Emplacements', icon('star', 'md'), content);
  }

  // ── Nom, tenue, allées, clôture ───────────────────────────────────────────────
  function openSign() {
    const content = el('div.decor-sheet', el('p.decor-now', 'Le nom s\'affiche sur le panneau de la ferme, au début de chaque année et dans la grange.'), farmNameForm(app, { onSaved: () => app.sheets.close() }));
    sheet('sign', 'Nom de la ferme', icon('bill', 'md'), content);
    const input = app.sheets.body.querySelector('input');
    if (input && !app.isTouch) input.focus();
  }

  function choiceSheet(id, title, category, currentId, apply, silent) {
    const list = items(category);
    const pick = async (item) => {
      if (item.id === currentId) return;
      if (!(await unlockFlow(app, item))) return;
      const res = apply(item.id);
      if (res && res.ok === false) {
        app.audio.play('error');
        app.toasts.show({ kind: 'error', text: res.reason || 'Impossible.' });
        return;
      }
      app.audio.play('confirm');
      changed();
    };
    const content = el(
      'div.decor-sheet',
      el('div.cos-grid', list.map((item) => cosmeticTile(app, item, { placed: item.id === currentId, placedLabel: 'Choisi', onPick: pick }))),
      el('p.sheet-hint', 'Purement décoratif : aucun effet sur le jeu.'),
    );
    if (silent && app.sheets.current === `decor-${id}`) return app.sheets.setContent(content);
    const cur = list.find((i) => i.id === currentId);
    sheet(id, title, cur ? cosmeticIcon(cur, 'sprite--md') : icon('star', 'md'), content);
  }

  const openOutfit = (silent) => choiceSheet('outfit', CATEGORY_TITLE.outfit, 'outfit', P().cosmetics().outfit, (id) => P().setOutfit(id), silent);
  const openPath = (silent) => choiceSheet('path', CATEGORY_TITLE.path, 'path', P().cosmetics().path, (id) => P().setPath(id), silent);
  const openFence = (silent) => choiceSheet('fence', CATEGORY_TITLE.fence, 'fence', P().cosmetics().fence, (id) => P().setFence(id), silent);

  function onKey(e) {
    if (!active) return false;
    if (e.key === 'Escape') {
      if (app.sheets.isOpen()) app.sheets.close('escape');
      else exit();
      return true;
    }
    return false;
  }

  return {
    available,
    enter,
    exit,
    onHit,
    hoverText,
    openSlot,
    openSlots,
    openSign,
    openOutfit,
    openPath,
    openFence,
    onKey,
    refresh: refreshOpen,
    get active() {
      return active;
    },
    get fromMenu() {
      return fromMenu;
    },
  };
}

export { CATEGORY_TITLE };
