// Le livre de la vallée (Vallée vivante, lot V4 « Les cigognes », docs/VALLEE.md § 18.6 et § 18.10.4 ; contrat :
// docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V4 », « Ce que RENDER et UI consomment »).
//
// createValleyBook(app) → app.valleyBook = {
//   open(page?)    feuille plein écran (#vl-book), temps en pause ; page : index, ou 'cover' | 'beforeAfter' | 'year:<n>' |
//                  'seeds' | 'beings' | 'places' | 'calendar' | 'stories' | 'postcards'
//   close({ silent? }), isOpen, page, pages() → [{ id, title }], share() → Promise<'shared' | 'saved' | 'none'>,
//   reset(), debugState()
// }
// Pages qu'on tourne au doigt (glisser à gauche / à droite ≥ 40 px ; défilement vertical interne si une page dépasse) ou
// avec « ‹ » / « › » (≥ 48 px, en bas, à portée de pouce) ; « Sommaire » (≥ 48 px) ; lecteurs d'écran : chaque page est
// un titre et une liste. Partager (couverture) : une image 1080 × 1350 composée sur place (vignettes de la planche,
// police du jeu) → la feuille de partage du téléphone (navigator.share avec un fichier), sinon « Enregistrer l'image ».
// Aucun réseau, aucun compte. Données : query.career.valleyBook() (une page par année, phrases d'Hélène).

import { el, plural } from '../dom.js';
import { drawSprite, SPRITES } from '../../render/atlas.js';
import { vIcon } from './valley.js';
import { legendIcon, visitorIcon } from './storks.js';

const SWIPE = 40;

/**
 * Liste des pages du livre (pur) : couverture, avant / après, une page par année, graines, habitants et visiteurs,
 * lieux, calendrier, récits, plus loin.
 */
export function bookPages(book) {
  if (!book) return [];
  const out = [{ id: 'cover', title: 'Couverture' }, { id: 'beforeAfter', title: 'Avant / après' }];
  for (const y of book.years || []) out.push({ id: `year:${y.year}`, title: `An ${y.year}`, year: y.year });
  out.push({ id: 'seeds', title: 'Les graines' }, { id: 'beings', title: 'Les habitants et les visiteurs' }, { id: 'places', title: 'Les lieux' }, { id: 'calendar', title: 'Le calendrier de la vallée' }, { id: 'stories', title: 'Les récits' }, { id: 'postcards', title: 'Plus loin' });
  return out;
}

/** Les quatre chiffres de la page partagée (habitants, variétés sauvées, lieux restaurés, légendes réveillées). */
export function bookFigures(book) {
  const beings = (book?.beings || []).filter((b) => b.kind === 'species' && b.state === 'installed').length;
  const varieties = (book?.seeds || []).filter((s) => s.kind === 'variety' && s.state === 'saved').length;
  const places = (book?.places || []).filter((p) => p.restored).length;
  const legends = (book?.seeds || []).filter((s) => s.kind === 'legend' && s.state === 'awake').length;
  return { beings, varieties, places, legends };
}

export function createValleyBook(app) {
  let root = null;
  let body = null;
  let pageNo = null;
  let prevBtn = null;
  let nextBtn = null;
  let title = null;
  let isOpen = false;
  let page = 0;
  let list = [];
  let book = null;
  let toc = false;
  let press = null;
  let lastFocus = null;

  function safe(fn, fallback = null) {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch (err) {
      console.warn('Livre de la vallée :', err);
      return fallback;
    }
  }
  const q = (name, ...args) => {
    const fn = app.game?.query?.career?.[name];
    return typeof fn === 'function' ? safe(() => fn(...args), null) : null;
  };
  const on = () => !!app.storks?.on?.();

  // ── DOM ──────────────────────────────────────────────────────────────────────
  function build() {
    if (root) return;
    title = el('h2.vlb-title', { id: 'vlb-title' }, 'Le livre de la vallée');
    const tocBtn = el('button.btn.vlb-toc-btn', { type: 'button', id: 'vlb-toc', onclick: () => { app.vibrate?.(8); toggleToc(); } }, 'Sommaire');
    const closeBtn = el('button.vlb-close', { type: 'button', id: 'vlb-close', 'aria-label': 'Fermer le livre', onclick: () => close() }, '✕');
    body = el('div.vlb-body', { id: 'vlb-body', tabindex: '-1' });
    prevBtn = el('button.btn.vlb-nav.vlb-prev', { type: 'button', id: 'vlb-prev', 'aria-label': 'Page précédente', onclick: () => go(page - 1) }, '‹');
    nextBtn = el('button.btn.vlb-nav.vlb-next', { type: 'button', id: 'vlb-next', 'aria-label': 'Page suivante', onclick: () => go(page + 1) }, '›');
    pageNo = el('span.vlb-pageno', { id: 'vlb-pageno', 'aria-live': 'polite' });
    root = el(
      'section.vl-book',
      { id: 'vl-book', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vlb-title', hidden: true },
      el('header.vlb-head', el('span.vlb-ribbon', { 'aria-hidden': 'true' }, vIcon(['book.ribbon'], 'sprite--sm', '🔖')), title, tocBtn, closeBtn),
      body,
      el('nav.vlb-foot', { 'aria-label': 'Pages du livre' }, prevBtn, pageNo, nextBtn),
    );
    document.body.append(root);
    body.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary) return;
      press = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    body.addEventListener('pointerup', (e) => {
      if (!press) return;
      const dx = e.clientX - press.x;
      const dy = e.clientY - press.y;
      press = null;
      if (toc) return;
      if (Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy) * 1.3) go(page + (dx < 0 ? 1 : -1));
    });
    body.addEventListener('pointercancel', () => {
      press = null;
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (toc) toggleToc(false);
        else close();
      } else if (e.key === 'ArrowRight') go(page + 1);
      else if (e.key === 'ArrowLeft') go(page - 1);
    });
  }

  // ── Pages ─────────────────────────────────────────────────────────────────────
  const sec = (head, ...kids) => el('section.vlb-page', { 'aria-labelledby': 'vlb-ptitle' }, el('h3.vlb-ptitle', { id: 'vlb-ptitle' }, head), ...kids);
  const vignette = (name, cls = 'sprite--vlb-big') => el('div.vlb-vignette', vIcon([name, 'valley.stage.0'], cls, '🌿'));

  function coverPage() {
    const c = book.cover || {};
    return sec(
      book.title || 'La vallée',
      el('div.vlb-cover', vIcon(['book.cover'], 'sprite--vlb-cover', '📗'), el('p.vlb-cover-title', book.title || '')),
      vignette(c.vignette),
      el('p.vlb-since', book.sinceText || `depuis l'an ${book.since}`),
      el('p.vlb-signs', `${plural(c.signs || 0, 'signe de vie', 'signes de vie')} sur ${c.total || 99}`),
      el('button.btn.btn--red.btn--wide.vlb-share', { type: 'button', id: 'vlb-share', onclick: () => share() }, 'Partager'),
      el('p.sheet-hint', 'Une image faite ici même : rien ne part sur Internet.'),
    );
  }
  function beforeAfterPage() {
    const ba = book.beforeAfter || {};
    return sec(
      'Avant / après',
      el(
        'div.vlb-ba',
        el('figure.vlb-ba-fig', vIcon([ba.from?.vignette, 'valley.stage.0'], 'sprite--vlb-ba', '🌫'), el('figcaption', `L'an ${ba.from?.year ?? book.since}`)),
        el('span.vlb-ba-arrow', { 'aria-hidden': 'true' }, '→'),
        el('figure.vlb-ba-fig', vIcon([ba.to?.vignette, 'valley.stage.0'], 'sprite--vlb-ba', '🌿'), el('figcaption', `L'an ${ba.to?.year ?? ''}`)),
      ),
      el('p.vlb-big-line', ba.text || ''),
    );
  }
  function yearPage(y) {
    const lines = (y.lines || []).slice(0, 6);
    return sec(
      `An ${y.year}`,
      el('p.vlb-stage', `${y.approx ? 'vers ' : ''}${y.stageName || ''}`),
      vignette(y.vignette),
      lines.length ? el('ul.vlb-lines', lines.map((t) => el('li', t))) : el('p.vlb-quiet', 'Une année tranquille pour la vallée.'),
      y.helene ? el('p.vlb-helene', el('span.sr-only', 'Hélène : '), `« ${y.helene} »`, el('small', ' — Hélène')) : null,
    );
  }
  function gridItem(x, ico) {
    const known = x.state !== 'unknown';
    const what = x.kind === 'legend' ? (known ? 'réveillée' : 'endormie') : x.kind === 'visitor' ? (known ? 'vu' : 'pas encore venu') : x.kind === 'species' ? (known ? 'installé' : 'pas encore venu') : known ? (x.state === 'saved' ? 'sauvée' : 'en cours') : 'à retrouver';
    return el(
      `li.vlb-cell.is-${x.state}`,
      { 'aria-label': `${known ? x.name : 'Inconnu'} : ${what}${x.year ? `, l'an ${x.year}` : ''}` },
      el('span.vlb-cell-ico', { 'aria-hidden': 'true' }, known ? ico : el('span.vlb-q', '?')),
      el('span.vlb-cell-name', { 'aria-hidden': 'true' }, known ? x.name : '?'),
      x.year ? el('small', { 'aria-hidden': 'true' }, `${x.kind === 'variety' ? 'sauvée' : x.kind === 'legend' ? 'réveillée' : x.kind === 'visitor' ? 'vu' : 'venu'} l'an ${x.year}`) : null,
    );
  }
  function seedsPage() {
    const seeds = book.seeds || [];
    const vars = seeds.filter((s) => s.kind === 'variety');
    const legs = seeds.filter((s) => s.kind === 'legend');
    return sec(
      'Les graines',
      el('p.vl-count', `${vars.filter((s) => s.state === 'saved').length} / ${vars.length} variétés sauvées · ${legs.filter((s) => s.state === 'awake').length} / ${legs.length} légendes`),
      el('ul.vlb-grid', vars.map((s) => gridItem(s, vIcon([s.icon], 'sprite--md', '🌱')))),
      el('h4.vlb-sub', 'Les légendes'),
      el('ul.vlb-grid', legs.map((s) => gridItem(s, legendIcon({ id: s.id, icon: s.icon }, 'sprite--md')))),
    );
  }
  function beingsPage() {
    const all = book.beings || [];
    const sp = all.filter((b) => b.kind === 'species');
    const vis = all.filter((b) => b.kind === 'visitor');
    return sec(
      'Les habitants et les visiteurs',
      el('p.vl-count', `${sp.filter((b) => b.state === 'installed').length} / ${sp.length} habitants · ${vis.filter((b) => b.state === 'seen').length} / ${vis.length} visiteurs rares`),
      el('ul.vlb-grid', sp.map((b) => gridItem(b, vIcon([b.icon, `wild.${b.id}`], 'sprite--md', '🐾')))),
      el('h4.vlb-sub', 'Les visiteurs rares'),
      el('ul.vlb-grid', vis.map((b) => gridItem(b, visitorIcon(b.id, 'sprite--md')))),
    );
  }
  function placesPage() {
    return sec(
      'Les lieux',
      el(
        'ul.vlb-places',
        (book.places || []).map((p) => el(
          'li.vlb-place',
          { 'aria-label': `${p.name} : étape ${p.step} sur ${p.max}${p.restored ? `, restauré${p.restoredYear ? ` l'an ${p.restoredYear}` : ''}` : ''}` },
          el('span.vlb-place-pic', { 'aria-hidden': 'true' }, vIcon([p.vignette, `icon.place.${p.id}`], 'sprite--md', '⛰')),
          el('span.vlb-place-main', { 'aria-hidden': 'true' }, el('b', p.name), el('small', p.restored ? `Restauré${p.restoredYear ? ` l'an ${p.restoredYear}` : ''} ✓` : `Étape ${p.step} / ${p.max}${p.stepName ? ` · ${p.stepName}` : ''}`)),
        )),
      ),
    );
  }
  function calendarPage() {
    const cal = book.calendar || [];
    return sec(
      'Le calendrier de la vallée',
      cal.length ? el('ul.vlb-lines.vlb-cal', cal.map((c) => el('li', visitorIcon(c.id, 'sprite--sm'), el('span', c.when)))) : el('p.vlb-quiet', 'Quand les visiteurs rares seront venus, leurs rendez-vous seront notés ici.'),
    );
  }
  function storiesPage() {
    const st = (book.stories || []).filter((s) => s.available);
    const watched = book.epilogue?.read;
    return sec(
      'Les récits',
      el(
        'div.vlb-stories',
        st.map((s) => el(
          'button.btn.vl-chap.vlb-story',
          { type: 'button', id: `vlb-story-${s.kind}-${s.id}`, onclick: () => openStory(s) },
          s.read ? '' : el('span.vl-new', 'Nouveau · '),
          s.title,
        )),
      ),
      watched ? el('button.btn.btn--red.btn--wide.vlb-credits', { type: 'button', id: 'vlb-credits', onclick: () => { close({ silent: true }); requestAnimationFrame(() => app.storks?.playCredits?.()); } }, 'Regarder la vallée') : null,
    );
  }
  function openStory(s) {
    close({ silent: true });
    requestAnimationFrame(() => {
      if (s.kind === 'chapter') app.valley?.openChapter?.(s.id);
      else if (s.kind === 'epilogue') app.storks?.openEpilogue?.();
      else app.heritage?.openStory?.(s.id);
    });
  }
  function postcardsPage() {
    const pc = q('valley')?.postcards || {};
    const got = pc.got || book.postcards || [];
    const parts = [];
    if (!pc.open) parts.push(el('p.vlb-quiet', 'Après l\'épilogue de Joseph, vous pourrez envoyer un sachet de la boîte en fer aux vallées voisines.'));
    else {
      if (pc.sent) parts.push(el('p.vl-note', `Un sachet est en route vers ${pc.sent.valley}${pc.sent.daysLeft ? ` (encore ${plural(pc.sent.daysLeft, 'jour')})` : ''}.`));
      if (pc.canSend) parts.push(el('button.btn.btn--red.btn--wide.vlb-send', { type: 'button', id: 'vlb-send', onclick: () => sendSeeds() }, 'Envoyer un sachet de graines'));
      else if (pc.reason && !pc.sent) parts.push(el('p.stats-note', pc.reason));
    }
    parts.push(el('p.vl-count', `${got.length} / 8 cartes`));
    parts.push(el(
      'ul.vlb-cards',
      got.map((c) => el(
        `li.vlb-card${c.read ? '' : '.is-new'}`,
        { id: `vlb-card-${c.id}` },
        el('span.vlb-card-pic', { 'aria-hidden': 'true' }, vIcon([c.vignette], 'sprite--vlb-card', '✉')),
        el('div.vlb-card-main', el('b', c.valley), el('p.cz-say', `« ${c.text} »`), el('small', `— ${c.signer}${c.year ? ` · l'an ${c.year}` : ''}`)),
      )),
    ));
    return sec('Plus loin', ...parts);
  }
  function sendSeeds() {
    const fn = app.game?.actions?.career?.sendPostcardSeeds;
    const res = typeof fn === 'function' ? safe(() => fn(), null) : null;
    if (!res?.ok) {
      app.audio.play('error');
      app.toasts.show({ kind: 'error', text: res?.reason || 'Pas encore.', log: false });
      return;
    }
    app.audio.play('page', { volume: 0.6 });
    app.vibrate?.([10, 30, 10]);
    render();
  }
  function markPostcardsRead() {
    const pc = q('valley')?.postcards;
    const fn = app.game?.actions?.career?.readPostcard;
    if (!pc || typeof fn !== 'function') return;
    for (const c of pc.got || []) if (!c.read) safe(() => fn(c.id), null);
    app.careerUI?.refresh?.();
  }

  function pageNode(p) {
    if (!p) return el('p.sheet-empty', 'Le livre s\'écrit avec la vallée.');
    if (p.id === 'cover') return coverPage();
    if (p.id === 'beforeAfter') return beforeAfterPage();
    if (p.year) return yearPage((book.years || []).find((y) => y.year === p.year) || { year: p.year });
    if (p.id === 'seeds') return seedsPage();
    if (p.id === 'beings') return beingsPage();
    if (p.id === 'places') return placesPage();
    if (p.id === 'calendar') return calendarPage();
    if (p.id === 'stories') return storiesPage();
    if (p.id === 'postcards') return postcardsPage();
    return el('p.sheet-empty', '…');
  }
  function tocNode() {
    return el(
      'section.vlb-page.vlb-tocpage',
      el('h3.vlb-ptitle', 'Sommaire'),
      el('ol.vlb-toc', list.map((p, i) => el('li', el(`button.vlb-toc-item${i === page ? '.is-on' : ''}`, { type: 'button', id: `vlb-toc-${i}`, onclick: () => { toc = false; go(i, { focus: true }); } }, el('span', p.title), el('small', String(i + 1)))))),
    );
  }

  function render() {
    if (!root) return;
    book = q('valleyBook');
    list = bookPages(book);
    page = Math.max(0, Math.min(list.length - 1, page));
    body.replaceChildren(toc ? tocNode() : pageNode(list[page]));
    body.scrollTop = 0;
    pageNo.textContent = toc ? 'Sommaire' : `page ${page + 1} / ${list.length}`;
    prevBtn.disabled = toc || page <= 0;
    nextBtn.disabled = toc || page >= list.length - 1;
    root.querySelector('#vlb-toc')?.setAttribute('aria-pressed', toc ? 'true' : 'false');
    if (!toc && list[page]?.id === 'postcards') markPostcardsRead();
  }
  function go(i, { focus = false } = {}) {
    if (!isOpen) return;
    const n = Math.max(0, Math.min(list.length - 1, i));
    if (n === page && !toc) return;
    page = n;
    toc = false;
    app.audio.play('page', { volume: 0.55 });
    if (!app.reducedMotion?.()) {
      body.classList.remove('is-turn');
      void body.offsetWidth;
      body.classList.add('is-turn');
    }
    render();
    if (focus) body.focus({ preventScroll: true });
  }
  function toggleToc(force) {
    toc = force === undefined ? !toc : !!force;
    render();
  }

  function resolvePage(p) {
    if (Number.isInteger(p)) return p;
    if (typeof p !== 'string') return 0;
    const i = list.findIndex((x) => x.id === p);
    return i >= 0 ? i : 0;
  }

  function open(p = 0) {
    const g = app.game;
    if (!g || app.inMenu || !on()) return false;
    build();
    if (app.sheets.isOpen()) app.sheets.close('silent');
    book = q('valleyBook');
    if (!book) {
      app.toasts.show({ kind: 'error', text: 'Le livre s\'écrira quand la vallée sera commencée.', log: false });
      return false;
    }
    list = bookPages(book);
    page = resolvePage(p);
    toc = false;
    lastFocus = document.activeElement;
    isOpen = true;
    root.hidden = false;
    document.body.classList.add('in-valley-book');
    app.pushPause('book');
    safe(() => g.actions.career.openValleyBook?.(), null);
    app.audio.play('open', { volume: 0.6 });
    render();
    requestAnimationFrame(() => body.focus({ preventScroll: true }));
    app.coach?.signal?.('sheetOpen', { id: 'vl-book' });
    return true;
  }
  function close({ silent = false } = {}) {
    if (!isOpen) return;
    isOpen = false;
    root.hidden = true;
    toc = false;
    document.body.classList.remove('in-valley-book');
    app.popPause('book');
    if (!silent) app.audio.play('close', { volume: 0.6 });
    app.coach?.signal?.('sheetClose', { id: 'vl-book' });
    app.careerUI?.refresh?.();
    try {
      lastFocus?.focus?.({ preventScroll: true });
    } catch {
      /* rien */
    }
  }

  // ── Partager (image locale 1080 × 1350) ─────────────────────────────────────────
  function compose() {
    const b = book || q('valleyBook');
    if (!b) return null;
    const W = 1080;
    const H = 1350;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    // Papier
    c.fillStyle = '#f4ead2';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#3f2631';
    c.fillRect(0, 0, W, 16);
    c.fillRect(0, H - 16, W, 16);
    c.fillRect(0, 0, 16, H);
    c.fillRect(W - 16, 0, 16, H);
    c.fillStyle = '#c84a3a';
    c.fillRect(48, 16, 32, 110);
    const font = (px, bold = false) => `${bold ? 'bold ' : ''}${px}px 'Ferme', 'Lisible', system-ui, sans-serif`;
    c.fillStyle = '#3f2631';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.font = font(74, true);
    c.fillText(b.title || 'La vallée', W / 2, 150, W - 200);
    c.font = font(40);
    c.fillText(b.sinceText || '', W / 2, 210);
    // Avant / après (vignettes de la planche, × 8)
    const imgs = typeof app.images === 'function' ? app.images() : app.images;
    const ba = b.beforeAfter || {};
    const drawVig = (name, x, y, k, label) => {
      c.fillStyle = '#3a2a2f';
      c.fillRect(x - 10, y - 10, 96 * k + 20, 48 * k + 20);
      if (imgs && name && SPRITES[name]) {
        try {
          drawSprite(c, imgs, name, x, y, { scale: k });
        } catch {
          /* planche absente */
        }
      } else {
        c.fillStyle = '#7cc45a';
        c.fillRect(x, y, 96 * k, 48 * k);
      }
      c.fillStyle = '#3f2631';
      c.font = font(38, true);
      c.fillText(label, x + (96 * k) / 2, y + 48 * k + 56);
    };
    drawVig(ba.from?.vignette || 'valley.stage.0', 156, 262, 8, `L'an ${ba.from?.year ?? b.since} · avant`);
    drawVig(ba.to?.vignette || b.cover?.vignette || 'valley.stage.0', 156, 752, 8, `L'an ${ba.to?.year ?? ''} · aujourd'hui`);
    // Quatre chiffres
    const f = bookFigures(b);
    c.font = font(40, true);
    const text = `${f.beings} habitants · ${f.varieties} variétés · ${f.places} lieux · ${f.legends} légendes`;
    c.fillText(text, W / 2, 1296, W - 120);
    return cv;
  }
  async function share() {
    const cv = safe(() => compose(), null);
    if (!cv) return 'none';
    const blob = await new Promise((res) => {
      try {
        cv.toBlob((b) => res(b), 'image/png');
      } catch {
        res(null);
      }
    });
    if (!blob) return 'none';
    const name = 'la-vallee.png';
    let file = null;
    try {
      file = new File([blob], name, { type: 'image/png' });
    } catch {
      file = null;
    }
    if (file && navigator.canShare && navigator.share) {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: book?.title || 'La vallée' });
          return 'shared';
        }
      } catch (err) {
        if (err?.name === 'AbortError') return 'none';
      }
    }
    // Sinon : « Enregistrer l'image » (lien de téléchargement local, aucun réseau).
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    app.toasts.show({ kind: 'success', text: 'Image enregistrée : la-vallee.png', duration: 2600, log: false });
    return 'saved';
  }

  function reset() {
    if (isOpen) close({ silent: true });
    page = 0;
    book = null;
    list = [];
  }

  return {
    open,
    close,
    share,
    reset,
    compose,
    pages: () => list.map((p) => ({ id: p.id, title: p.title })),
    get isOpen() {
      return isOpen;
    },
    get page() {
      return page;
    },
    debugState: () => ({ open: isOpen, page, pages: list.length, toc, id: list[page]?.id || null }),
  };
}

