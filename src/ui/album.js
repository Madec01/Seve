// L'album de la ferme (lot 4, D1 — docs/GAME_DESIGN.md § 17.1, contrats : docs/ARCHITECTURE.md « Lot 4 »).
//
// createAlbum(app) → app.album = {
//   available()            le module d'album du cœur est-il là ?
//   open(pageId?)          fenêtre haute « L'album de la ferme » (en partie : le jeu se met en pause)
//   tabContent()           contenu du 4ᵉ onglet « Album » de la grange aux souvenirs (src/ui/grange.js)
//   onDawn(game)           à chaque aube (partie en cours seulement, comme les succès) : nouvelles cases et tampons
//   snapshot() / announceSince(snap)   cases trouvées par le bilan de fin (recordRunEnd / recordCareerYear)
//   badge()                nombre de nouveautés (cases pas encore vues, récompenses à recevoir) : pastilles
//   boot()                 au démarrage : rattrapage des anciennes parties (« N cases retrouvées… »)
//   reset()
// }
//
// Pages : onglets d'icônes (48 × 48), flèches ‹ › (48 × 48), points de page, grille de 3 colonnes (cases ≥ 104 × 120),
// fiche d'une case (grand dessin ×3, nom, anecdote ou indice, « Trouvée le 3 oct. · Ma ferme »), tampons ★ dorée,
// ◆ géant, 🎪 fête, ✉ visiteur, 🏅 meilleur résultat ; bandeau « Page complète ! » et « Recevoir » (aucune échéance).
// L'album vit dans la progression (progress.album) : il se remplit aussi en Classique, sans rien changer à la partie.

import { el, fmt, plural } from './dom.js';
import { icon, hasSprite, sprite } from './icons.js';
import { v3 } from './v3.js';

const STAMP_EMOJI = { gold: '★', giant: '◆', fete: '🎪', visitor: '✉', best: '🏅', heart: '♥' };
const STAMP_NAMES = { gold: 'Récolte dorée', giant: 'Légume géant', fete: 'Fête jouée', visitor: 'Visiteur accueilli', best: 'Le meilleur résultat', heart: 'Variété préférée' };
const PAGE_EMOJI = { garden: '🥕', homemade: '🍯', animals: '🐔', sky: '⛅', luck: '🍀', village: '🏠', years: '📅', fetes: '🎏', edge: '🌿', feeder: '🐦', stories: '🕯', heirlooms: '🌱', wildlife: '🦔', swaps: '🌱', crosses: '✨', wildlife2: '🐦', valleyWild: '🔭', places: '⛰' };
const SRC_NAMES = { levels: 'Les niveaux', career: 'Ma ferme', retro: 'avant l\'album' };

const MOD = { album: null, data: null };
async function loadModules() {
  try {
    MOD.album = await import('../core/album.js');
  } catch {
    /* module d'album absent : on regarde la progression */
  }
  try {
    MOD.data = await import('../data/album.js');
  } catch {
    /* données absentes */
  }
}

function ico(names, cls, emoji) {
  for (const n of (Array.isArray(names) ? names : [names]).filter(Boolean)) if (hasSprite(n)) return sprite(n, cls);
  return el(`span.cz-emoji.is-${/--(xs|sm)\b/.test(cls) ? 'sm' : /--(al-big|lg)\b/.test(cls) ? 'lg' : 'md'}`, { 'aria-hidden': 'true' }, emoji);
}

export function createAlbum(app) {
  loadModules();
  let pageIdx = 0;
  let detail = null; // caseId affiché dans la fiche
  let view = null; // racine de la vue affichée (fenêtre ou onglet de la grange)
  let lastDawn = '';
  const freshThisView = new Set(); // cases « Nouveau » vues pendant cette ouverture (le badge reste affiché)

  const fn = (name) => {
    const P = v3.progression;
    if (typeof P?.[name] === 'function') return P[name];
    if (typeof MOD.album?.[name] === 'function') return MOD.album[name];
    return null;
  };
  const available = () => !!(app.progression?.available() && fn('albumPages'));
  const progress = () => app.progression.get();

  function modeOf() {
    const g = app.game && !app.inMenu ? app.game : null;
    if (!g) return undefined;
    if (g.mode === 'career') return 'career';
    return g.difficulty === 'classique' ? 'classique' : 'detente';
  }

  function pages() {
    const f = fn('albumPages');
    if (!f) return [];
    try {
      return f(progress(), modeOf()) || [];
    } catch (err) {
      console.warn('albumPages :', err);
      return [];
    }
  }

  function caseName(caseId) {
    const c = MOD.data?.ALBUM_CASES_BY_ID?.[caseId];
    if (c) return c.name;
    for (const p of pages()) for (const c2 of p.cases || []) if (c2.caseId === caseId) return c2.name;
    return caseId;
  }

  function badge() {
    if (!available()) return 0;
    const ov = fn('albumOverview');
    if (ov) {
      try {
        const o = ov(progress());
        return (o.newCount || 0) + (o.claimable || 0);
      } catch {
        /* calcul de secours ci-dessous */
      }
    }
    let n = 0;
    for (const p of pages()) {
      n += (p.cases || []).filter((c) => c.isNew).length;
      n += (p.rewards || []).filter((r) => r.ready && !r.claimed).length;
    }
    return n;
  }

  // ── Vérification à l'aube (et rattrapage de fin de partie) ──────────────────
  function onDawn(game) {
    if (!available() || !game || game.state?.status !== 'playing' || game.__attract) return;
    const t = game.state.time || {};
    const key = `${t.year || 0}|${t.seasonIndex}|${t.day}`;
    if (key === lastDawn) return;
    lastDawn = key;
    const check = fn('checkAlbum');
    const record = fn('recordAlbum');
    if (!check || !record) return;
    let ctx = null;
    try {
      ctx = game.query.achievementContext?.() || null;
    } catch (err) {
      console.warn('achievementContext :', err);
      return;
    }
    const src = game.mode === 'career' ? 'career' : 'levels';
    // Cœur : nouveautés et succès « Album et fêtes » d'un coup (recordAlbumDawn), sinon check + record.
    const dawn = fn('recordAlbumDawn');
    if (dawn) {
      let r = null;
      try {
        r = dawn(progress(), ctx, Date.now(), src);
      } catch (err) {
        console.warn('recordAlbumDawn :', err);
      }
      if (!r) return;
      if (!(r.cases || []).length && !(r.stamps || []).length && !(r.achievements || []).length) return;
      if (r.progress) app.progression.commit(r.progress);
      announce(r.cases || [], r.stamps || []);
      if ((r.achievements || []).length) app.progression.announce(r.achievements, r.rewards || {});
      return;
    }
    let found;
    try {
      found = check(progress(), ctx);
    } catch (err) {
      console.warn('checkAlbum :', err);
      return;
    }
    if (!found || (!(found.cases || []).length && !(found.stamps || []).length)) return;
    let res;
    try {
      res = record(progress(), found, Date.now(), src);
    } catch (err) {
      console.warn('recordAlbum :', err);
      return;
    }
    if (res?.progress) app.progression.commit(res.progress);
    announce(res?.cases || found.cases || [], res?.stamps || found.stamps || []);
  }

  /** « Album : Pluie chaude ✓ » : un message par aube, les autres dans l'historique. */
  function announce(cases, stamps = []) {
    const list = cases || [];
    if (!list.length && !stamps.length) return;
    const texts = MOD.data?.ALBUM_TEXTS || {};
    const fmtFound = (name) => (texts.found || 'Album : {name} ✓').replace('{name}', name);
    if (list.length) {
      const first = caseName(list[0]);
      app.toasts.show({ prio: 'info', digest: 'case d\'album|cases d\'album', kind: 'achievement', key: 'album', sprite: ico(['icon.album'], 'sprite--sm', '📖'), title: fmtFound(first), text: list.length > 1 ? `et ${plural(list.length - 1, 'autre case', 'autres cases')} : Menu → L'album` : 'Menu → L\'album', duration: 3800, onClick: () => open(pageOf(list[0])) });
      for (const id of list.slice(1)) app.messages?.add?.({ kind: 'achievement', title: fmtFound(caseName(id)), text: 'Nouvelle case de l\'album.' });
      app.audio.play('page', { volume: 0.55, delay: 0.2 });
      app.hints?.maybe?.('cozy.album', null);
    } else {
      const s = stamps[0];
      app.toasts.show({ prio: 'info', digest: 'tampon d\'album|tampons d\'album', kind: 'achievement', key: 'album', sprite: ico([`album.stamp.${s.stamp}`], 'sprite--sm', STAMP_EMOJI[s.stamp] || '★'), title: `Album : tampon ${STAMP_NAMES[s.stamp]?.toLowerCase() || ''}`.trim(), text: caseName(s.caseId), duration: 3200 });
    }
    for (const s of stamps.slice(list.length ? 0 : 1)) app.messages?.add?.({ kind: 'achievement', title: `Tampon : ${STAMP_NAMES[s.stamp] || s.stamp}`, text: caseName(s.caseId) });
    app.onProgressChange?.();
  }

  function pageOf(caseId) {
    return String(caseId || '').split('.')[0];
  }

  const snapshot = () => new Set(Object.keys(progress()?.album?.found || {}));
  function announceSince(snap) {
    if (!snap || !available()) return;
    const now = Object.keys(progress()?.album?.found || {});
    const fresh = now.filter((id) => !snap.has(id));
    if (fresh.length) announce(fresh, []);
  }

  /** Au démarrage : les cases retrouvées dans les anciennes parties (une seule fois). */
  function boot() {
    let mig = null;
    try {
      const storage = app.storage;
      mig = storage?.albumMigration?.() || null;
    } catch {
      mig = null;
    }
    const n = mig?.cases?.length || 0;
    if (!n) return;
    const tpl = MOD.data?.ALBUM_TEXTS?.retro || '{n} case{s} de l\'album retrouvée{s} dans vos anciennes parties';
    const text = tpl.replace('{n}', fmt(n)).replace(/\{s\}/g, n > 1 ? 's' : '');
    setTimeout(() => {
      app.toasts.show({ prio: 'info', kind: 'achievement', key: 'album-retro', sprite: ico(['icon.album'], 'sprite--sm', '📖'), title: 'L\'album de la ferme', text: `${text}.`, duration: 6000, actionLabel: 'Voir', onClick: () => app.grange?.open?.('album') });
    }, 1400);
  }

  // ── Vue ───────────────────────────────────────────────────────────────────────
  function markSeen(page) {
    const mark = fn('markAlbumSeen');
    if (!mark || !page) return;
    const ids = (page.cases || []).filter((c) => c.isNew).map((c) => c.caseId);
    if (!ids.length) return;
    for (const id of ids) freshThisView.add(id);
    try {
      const next = mark(progress(), ids);
      if (next) app.progression.commit(next.progress || next);
    } catch (err) {
      console.warn('markAlbumSeen :', err);
    }
  }

  function caseIcon(c, cls) {
    const names = [c.icon, c.caseId?.startsWith('feeder.') && !c.icon?.startsWith('bird.') ? `bird.${c.id}` : null, `crop.${c.id}.icon`, `product.${c.id}`].filter(Boolean);
    for (const n of names) if (hasSprite(n)) return sprite(n, cls);
    return ico(['album.empty'], cls, c.found ? '★' : '?');
  }

  function stampsRow(c, { full = false } = {}) {
    const all = c.stampsPossible || c.possibleStamps || MOD.data?.ALBUM_CASES_BY_ID?.[c.caseId]?.stamps || [];
    const got = new Set(c.stamps || []);
    if (!all.length && !got.size) return null;
    const list = all.length ? all : [...got];
    return el(
      `span.al-stamps${full ? '.is-full' : ''}`,
      { 'aria-label': list.map((s) => `${STAMP_NAMES[s] || s} : ${got.has(s) ? 'oui' : 'pas encore'}`).join(', ') },
      list.map((s) => el(`span.al-stamp${got.has(s) ? '.is-on' : ''}.is-${s}`, { 'aria-hidden': 'true', title: STAMP_NAMES[s] }, got.has(s) ? ico([`album.stamp.${s}`], 'sprite--xs', STAMP_EMOJI[s] || '★') : el('span.al-stamp-empty', STAMP_EMOJI[s] || '·'), full ? el('small', STAMP_NAMES[s]) : null)),
    );
  }

  function caseBtn(c) {
    const isNew = c.isNew || freshThisView.has(c.caseId);
    const label = `${c.name}, ${c.found ? 'trouvée' : 'pas encore trouvée'}${isNew ? ', nouveau' : ''}${(c.stamps || []).length ? `, tampons : ${(c.stamps || []).map((s) => STAMP_NAMES[s] || s).join(', ')}` : ''}`;
    return el(
      `button.al-case${c.found ? '.is-found' : '.is-missing'}${isNew ? '.is-new' : ''}`,
      { type: 'button', role: 'listitem', id: `al-case-${c.caseId.replace(/\W/g, '-')}`, 'aria-label': label, onclick: () => showDetail(c.caseId) },
      el('span.al-case-ico', caseIcon(c, 'sprite--al')),
      el('span.al-case-name', c.name),
      stampsRow(c),
      isNew ? el('span.al-new', { 'aria-hidden': 'true' }, 'Nouveau') : null,
    );
  }

  function dateOf(at) {
    if (!at) return '';
    try {
      return new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  }

  function detailNode(page, c) {
    const found = c.found;
    const src = c.src || progress()?.album?.found?.[c.caseId]?.src;
    const at = c.at ?? progress()?.album?.found?.[c.caseId]?.at;
    const when = found ? (src === 'retro' ? 'Trouvée avant l\'album' : `Trouvée${at ? ` le ${dateOf(at)}` : ''}${src ? ` · ${SRC_NAMES[src] || src}` : ''}`) : null;
    return el(
      'section.al-detail',
      { role: 'dialog', 'aria-label': c.name, id: 'al-detail' },
      el('span.al-detail-ico', caseIcon(c, 'sprite--al-big')),
      el('div.al-detail-main', el('b.al-detail-name', c.name), found ? el('p.al-text', c.text || '') : el('p.al-hint', icon('info', 'sm'), el('span', c.hint || 'À découvrir en jouant.')), !found && c.modeNote ? el('p.al-mode', c.modeNote) : null, when ? el('small.al-when', when) : null, stampsRow(c, { full: true })),
      el('button.btn.btn--wide.al-detail-close', { type: 'button', id: 'al-detail-close', onclick: () => showDetail(null) }, 'Fermer'),
    );
  }

  function rewardRow(r, page) {
    const extra = (MOD.data?.ALBUM_EXTRA_REWARDS || []).find((x) => x.id === r.id);
    const name = r.id === page?.id ? (r.ready || r.claimed ? 'Page complète !' : 'Quand la page sera complète') : r.id === 'complete' ? 'L\'album complet !' : extra?.name || r.name || 'Récompense';
    const cos = r.cosmeticId ? (v3.cosmetics?.COSMETICS || []).find((x) => x.id === r.cosmeticId) : null;
    return el(
      `div.al-reward${r.claimed ? '.is-claimed' : r.ready ? '.is-ready' : ''}`,
      el('span.al-ribbon', ico(['album.ribbon'], 'sprite--md', '🎀')),
      el('div.al-reward-main', el('b', name), el('small', [r.ecus ? `${plural(r.ecus, 'écu')}` : null, cos ? cos.name : null].filter(Boolean).join(' · ') || ''), !r.ready && !r.claimed && r.progress ? el('small', r.progress) : null),
      r.claimed
        ? el('span.al-claimed', '✓ Reçu')
        : r.ready
          ? el('button.btn.btn--red.al-claim', { type: 'button', id: `al-claim-${String(r.id).replace(/\W/g, '-')}`, onclick: () => claim(r) }, 'Recevoir')
          : null,
    );
  }

  function claim(r) {
    const f = fn('claimAlbumReward');
    if (!f) return;
    let res;
    try {
      res = f(progress(), r.id);
    } catch (err) {
      console.warn('claimAlbumReward :', err);
      res = { ok: false, reason: 'Impossible pour l\'instant.' };
    }
    if (!res?.ok) {
      app.audio.play('error');
      app.toasts.show({ kind: 'error', text: res?.reason || 'Impossible pour l\'instant.', log: false });
      return;
    }
    if (res.progress) app.progression.commit(res.progress);
    const rw = res.rewards || {};
    const cos = rw.cosmeticId ? (v3.cosmetics?.COSMETICS || []).find((x) => x.id === rw.cosmeticId) : null;
    app.audio.tone?.('fanfare', { volume: 0.8 });
    app.vibrate?.([15, 60, 15, 60, 30]);
    app.toasts.show({ prio: 'important', kind: 'achievement', sprite: ico(['album.ribbon'], 'sprite--sm', '🎀'), title: rw.ecus ? `+${plural(rw.ecus, 'écu')}` : 'Reçu !', text: cos ? `${cos.name} : à poser avec « Décorer la ferme ».` : rw.already ? 'Vous l\'aviez déjà.' : 'Merci !', duration: 4600 });
    app.progression.checkGame?.(app.game && !app.inMenu && app.game.state.status === 'playing' ? app.game : null);
    app.applyCosmetics?.();
    paint();
  }

  function showDetail(caseId) {
    detail = caseId;
    paint();
    if (caseId) {
      app.audio.play('page', { volume: 0.6 });
      requestAnimationFrame(() => view?.querySelector('#al-detail-close')?.focus({ preventScroll: true }));
    } else if (app.keyboardMode) requestAnimationFrame(() => view?.querySelector('.al-case')?.focus({ preventScroll: true }));
  }

  function go(idx) {
    const list = pages();
    if (!list.length) return;
    markSeen(list[pageIdx]);
    pageIdx = (idx + list.length) % list.length;
    detail = null;
    app.audio.play('page', { volume: 0.6 });
    paint();
    view?.querySelector('.al-grid')?.scrollIntoView?.({ block: 'nearest' });
  }

  function paint() {
    if (!view) return;
    const list = pages();
    if (!list.length) {
      view.replaceChildren(el('p.sheet-empty', 'L\'album arrive bientôt.'));
      return;
    }
    pageIdx = Math.max(0, Math.min(list.length - 1, pageIdx));
    const page = list[pageIdx];
    const totalFound = list.reduce((a, p) => a + (p.found || 0), 0);
    const total = list.reduce((a, p) => a + (p.total || 0), 0);
    const tabs = el(
      'div.al-tabs',
      { role: 'tablist', 'aria-label': 'Pages de l\'album' },
      list.map((p, i) => {
        const dot = (p.cases || []).some((c) => c.isNew) || (p.rewards || []).some((r) => r.ready && !r.claimed);
        return el(
          `button.al-tab${i === pageIdx ? '.is-active' : ''}${p.done ? '.is-done' : ''}`,
          { type: 'button', role: 'tab', id: `al-tab-${p.id}`, 'aria-selected': i === pageIdx ? 'true' : 'false', 'aria-label': `${p.name} : ${p.found} sur ${p.total}${dot ? ', nouveauté' : ''}`, onclick: () => i !== pageIdx && go(i) },
          ico([p.icon, `album.page.${p.id}`], 'sprite--sm', PAGE_EMOJI[p.id] || '📖'),
          dot ? el('span.al-dot', { 'aria-hidden': 'true' }) : null,
        );
      }),
    );
    const head = el(
      'div.al-head',
      el('button.btn.al-arrow', { type: 'button', id: 'al-prev', 'aria-label': 'Page précédente', onclick: () => go(pageIdx - 1) }, '‹'),
      el('div.al-title', el('b', page.name), el('span.al-count', `${fmt(page.found)} / ${fmt(page.total)}`)),
      el('button.btn.al-arrow', { type: 'button', id: 'al-next', 'aria-label': 'Page suivante', onclick: () => go(pageIdx + 1) }, '›'),
    );
    const dots = el('div.al-dots', { 'aria-hidden': 'true' }, list.map((p, i) => el(`span${i === pageIdx ? '.is-on' : ''}`)));
    const rewards = (page.rewards || []).map((r) => rewardRow(r, page));
    // L'album complet (les 11 pages) : sous chaque page, dès qu'il est prêt (ou reçu).
    const ov = fn('albumOverview') ? (() => { try { return fn('albumOverview')(progress()); } catch { return null; } })() : null;
    if (ov?.complete && (ov.complete.ready || ov.complete.claimed)) rewards.push(rewardRow({ ...ov.complete, id: 'complete' }, page));
    const doneBanner = page.done ? el('p.al-complete', ico(['album.ribbon'], 'sprite--sm', '🎀'), 'Page complète !') : null;
    const grid = el('div.al-grid', { role: 'list', 'aria-label': `${page.name} : les cases` }, (page.cases || []).map(caseBtn));
    const c = detail ? (page.cases || []).find((x) => x.caseId === detail) : null;
    view.replaceChildren(
      ...[
      el('p.al-total', ico(['album.cover', 'icon.album'], 'sprite--md', '📖'), el('span', `${plural(totalFound, 'case')} sur ${fmt(total)}`)),
      tabs,
      head,
      dots,
      doneBanner,
      grid,
      rewards.length ? el('div.al-rewards', rewards) : null,
      c ? detailNode(page, c) : null,
      ].filter(Boolean),
    );
    view.classList.toggle('has-detail', !!c);
    // Les nouveautés de la page sont vues (le badge « Nouveau » reste le temps de cette ouverture).
    markSeen(page);
    const tab = view.querySelector('.al-tab.is-active');
    tab?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }

  function makeView(pageId = null) {
    const list = pages();
    if (pageId) {
      const k = list.findIndex((p) => p.id === pageId);
      if (k >= 0) pageIdx = k;
    } else {
      // Première page qui a une nouveauté, sinon la dernière regardée.
      const k = list.findIndex((p) => (p.cases || []).some((c) => c.isNew) || (p.rewards || []).some((r) => r.ready && !r.claimed));
      if (k >= 0) pageIdx = k;
    }
    detail = null;
    freshThisView.clear();
    view = el('div.al-root', { id: 'album-root' });
    // Gestes : glisser à gauche / à droite sur la grille change de page.
    let sx = null;
    view.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || e.target.closest?.('.al-tabs')) return;
      sx = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    view.addEventListener('touchend', (e) => {
      if (!sx) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx.x;
      const dy = t.clientY - sx.y;
      sx = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && !detail) go(pageIdx + (dx < 0 ? 1 : -1));
    });
    paint();
    return view;
  }

  function open(pageId = null) {
    if (!available()) {
      app.toasts.show({ kind: 'info', text: 'L\'album arrive bientôt.', log: false });
      return null;
    }
    const d = app.dialogs;
    const node = d.frame({
      title: 'L\'album de la ferme',
      ribbon: 'ribbon',
      cls: 'dialog--album',
      body: makeView(pageId),
      actions: [d.btn('Retour', () => d.closeTop(), 'btn--red', { id: 'album-back', 'data-autofocus': '' })],
      onClose: () => d.closeTop(),
    });
    const inGame = !!app.game && !app.inMenu && app.game.state?.status === 'playing';
    return d.open(node, {
      id: 'album',
      pauses: inGame,
      onClose: () => {
        view = null;
        app.onProgressChange?.();
        if (app.inMenu && app.dialogs.top() === 'main-menu') app.dialogs.mainMenu();
      },
    });
  }

  function tabContent() {
    if (!available()) return el('p.sheet-empty', 'L\'album arrive bientôt.');
    return makeView(null);
  }

  /** Débogage : toutes les cases (et tampons) de l'album dans la progression de test. */
  function fillAll() {
    const record = fn('recordAlbum');
    const all = MOD.data?.ALBUM_CASES || [];
    if (!record || !all.length) return 0;
    const cases = all.map((c) => c.caseId);
    const stamps = all.flatMap((c) => (c.stamps || []).map((s) => ({ caseId: c.caseId, stamp: s })));
    const res = record(progress(), { cases, stamps }, Date.now(), 'levels');
    if (res?.progress) app.progression.commit(res.progress);
    return cases.length;
  }

  function reset() {
    lastDawn = '';
  }

  return { available, open, tabContent, onDawn, snapshot, announceSince, announce, badge, boot, reset, pages, fillAll, refresh: () => paint() };
}

export { STAMP_NAMES };

