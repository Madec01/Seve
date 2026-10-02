// Guidage (lot 1 « confort ») : la ligne « À faire maintenant » (E2), le résumé du matin (E5),
// l'écran « Où en étais-je ? » (E6) et le bouton « Tout ramasser » (F2).
//
// createTodo(app) → {
//   items(game?) → [{ id, prio, text, short, icon(), go() }]   choses utiles, la plus importante d'abord
//   tick(),                    à chaque image : recalcul au plus 4 fois par seconde, seulement si la ligne est visible
//   onEvent(ev, game),         aube → résumé du matin ; corbeaux → la vue va sur la parcelle
//   reset(game),               nouvelle partie (ou reprise) : oublie l'argent de la veille, les anneaux…
//   showResume(game),          fenêtre « Où en étais-je ? » (reprise depuis le menu)
//   morningToggle(),           interrupteur « Résumé du matin » (feuille Messages)
//   ring(rects), focusPlots(indexes)
// }
//
// La ligne est posée juste au-dessus des onglets (à portée de pouce), sur toute la largeur : une grande cible
// (≥ 48 px) avec la chose la plus utile à faire, le bouton « Tout ramasser » (carrière, au moins deux abris à
// ramasser) et la cloche des messages (nombre de non-lus). Elle se cache pendant les feuilles, les fenêtres, les
// bulles du tutoriel et des conseils, et en mode décoration. Variable CSS publiée : --todo-h (0 si cachée) ;
// body.has-todo. Styles : css/guidance.css.

import { el, fmt, plural, setText } from './dom.js';
import { icon, cropIcon, investmentIcon, spriteAny } from './icons.js';
import { cIcon, joseph as josephIcon, animalProductIcon } from './career/util.js';
import { cropCount, season } from './text.js';
import { bellIcon } from './messages.js';
import { readPrefs, writePrefs } from './guide-prefs.js';

const TICK_MS = 250;

export function createTodo(app) {
  // ── DOM ──────────────────────────────────────────────────────────────────────
  const mainIcon = el('span.todo-ico', { 'aria-hidden': 'true' });
  const mainLabel = el('small.todo-label', 'À faire');
  const mainText = el('span.todo-text', '');
  const main = el(
    'button.todo-main',
    { type: 'button', id: 'todo-main', onclick: () => go() },
    mainIcon,
    el('span.todo-body', mainLabel, mainText),
    el('span.todo-chevron', { 'aria-hidden': 'true' }, '›'),
  );
  const collectIcon = el('span.todo-ico', { 'aria-hidden': 'true' });
  const collectText = el('span.todo-collect-text', 'Tout ramasser');
  const collect = el('button.todo-collect', { type: 'button', id: 'todo-collect', hidden: true, onclick: () => collectAll() }, collectIcon, collectText);
  const bellBadge = el('span.todo-badge', { 'aria-hidden': 'true', hidden: true });
  const bell = el('button.todo-bell', { type: 'button', id: 'todo-bell', 'aria-label': 'Messages', onclick: () => openMessages() }, bellIcon(), bellBadge);
  const root = el('div.todo', { id: 'todo', role: 'region', 'aria-label': 'À faire maintenant', hidden: true }, main, collect, bell);
  const rings = el('div.todo-rings', { id: 'todo-rings', 'aria-hidden': 'true' });
  document.body.append(root, rings);

  let current = null; // élément affiché
  let lastTick = 0;
  let shown = false;
  let lastKey = '';
  let lastCollectKey = '';
  let lastH = -1;
  const morning = { prevMoney: null, pending: null, lastShownAt: -Infinity, notes: [] };

  app.messages?.onChange(() => paintBell());

  // ── Ce qu'il y a à faire ─────────────────────────────────────────────────────
  function safe(fn, fallback) {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch {
      return fallback;
    }
  }

  /** Requête de carrière protégée. */
  function cq(game, name, fallback, ...args) {
    const fn = game?.query.career?.[name];
    return typeof fn === 'function' ? safe(() => fn(...args), fallback) : fallback;
  }

  /** Terrains dont l'arrosage (ou le semis) est fait par une machine allumée ou un employé. */
  function automatedLots(game) {
    const water = new Set();
    const sow = new Set();
    for (const m of cq(game, 'machines', []) || []) {
      if (!m.lotId || m.on === false) continue;
      if (m.id === 'sprinklers' || m.id === 'sprinkler') water.add(m.lotId);
      if (m.id === 'seeder') sow.add(m.lotId);
    }
    for (const s of cq(game, 'staff', []) || []) {
      if (s.onLeave || !s.lotId) continue;
      const job = s.job || '';
      if (/water|arros/i.test(job)) water.add(s.lotId);
      if (/garden|sow|jardin/i.test(job)) {
        water.add(s.lotId);
        sow.add(s.lotId);
      }
    }
    return { water, sow };
  }

  /** Parcelle la plus proche du centre de la vue (carrière : grande carte) ; sinon la première. */
  function nearest(game, plots) {
    if (plots.length < 2) return plots[0];
    const s = app.scene;
    const view = safe(() => s?.viewRect?.(), null);
    if (!view || !s?.layout?.plotRect) return plots[0];
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    let best = plots[0];
    let bestD = Infinity;
    for (const p of plots) {
      const r = safe(() => s.layout.plotRect(p.index), null);
      if (!r) continue;
      const d = (r.x + r.w / 2 - cx) ** 2 + (r.y + r.h / 2 - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function items(game = app.game) {
    if (!game || game.state.status !== 'playing') return [];
    const career = game.mode === 'career';
    const out = [];
    const add = (it) => out.push(it);
    const plots = safe(() => game.query.plots(), []) || [];
    const auto = career ? automatedLots(game) : { water: new Set(), sow: new Set() };

    // Corbeaux (carrière) : la récolte vaudrait moitié moins.
    const crows = plots.filter((p) => p.crow);
    if (crows.length) {
      add({ id: 'crow', prio: 10, icon: () => cIco('crow', 'harvest'), text: `${crows.length > 1 ? `Corbeaux sur ${crows.length} parcelles` : 'Un corbeau sur une parcelle'} : touchez-${crows.length > 1 ? 'les' : 'la'} !`, short: crows.length > 1 ? `${crows.length} corbeaux à chasser` : 'un corbeau à chasser', go: () => focusPlots(crows.map((p) => p.index)) });
    }

    // Fermage / charges de saison qui risquent de manquer (3 jours avant au plus).
    const proj = safe(() => app.hud.projection(), null);
    if (proj && proj.state !== 'ok' && proj.daysLeft <= 3) {
      const missing = Math.max(0, Math.round(proj.amount - proj.money));
      if (missing > 0) {
        const what = career ? 'Charges' : 'Fermage';
        const when = proj.daysLeft === 0 ? 'ce soir' : proj.daysLeft === 1 ? 'demain' : `dans ${proj.daysLeft} j`;
        add({ id: 'rent', prio: proj.state === 'danger' ? 15 : 25, icon: () => icon('bill', 'md'), text: `${what} ${when} : il manque ${fmt(missing)}`, short: `${what.toLowerCase()} ${when} (il manque ${fmt(missing)})`, go: () => app.hud.openInfo?.('bill') });
      }
    }

    // Carrière : offres des visiteurs, quête de Joseph.
    if (career) {
      const offers = cq(game, 'events', null)?.offers || [];
      for (const o of offers) {
        const id = o.offerId ?? o.id;
        const who = o.data?.name || o.title || 'un visiteur';
        const Who = who.charAt(0).toUpperCase() + who.slice(1);
        if (!o.accepted) {
          const last = o.daysLeft !== undefined && o.daysLeft <= 0;
          add({ id: `offer-${id}`, prio: 30, icon: () => cIco(o.kind === 'visitor' || o.kind === 'order' ? 'visitor' : 'event', 'star'), text: `${Who} vous fait une proposition${last ? ' (aujourd\'hui seulement)' : ''}`, short: `une proposition (${who})`, go: () => app.careerUI?.open.offer(id) });
        } else if (o.n) {
          const done = o.delivered || 0;
          const what = o.data?.cropId ? cropCount(o.data.cropId, o.n).replace(/^\d+\s/, '') : 'produits';
          add({ id: `order-${id}`, prio: o.canDeliver ? 36 : 75, icon: () => (o.data?.cropId ? cropIcon(o.data.cropId, 'sprite--sm') : cIco('visitor', 'star')), text: o.canDeliver ? `Commande pour ${who} : livrez depuis le grenier` : `Commande pour ${who} : ${fmt(done)}/${fmt(o.n)} ${what}`, short: `la commande pour ${who} (${fmt(done)}/${fmt(o.n)})`, go: () => app.careerUI?.open.offer(id) });
        }
      }
      const quest = cq(game, 'quest', null);
      if (quest) {
        const n = quest.need?.n || quest.need?.count || 1;
        if (!quest.accepted) add({ id: 'quest-new', prio: 34, icon: () => joseph(), text: 'Joseph a une demande pour vous', short: 'une demande de Joseph', go: () => app.careerUI?.open.quest() });
        else {
          const prog = Math.min(n, quest.progress || 0);
          const what = quest.need?.cropId ? cropCount(quest.need.cropId, n).replace(/^\d+\s/, '') : quest.what || '';
          add({ id: 'quest', prio: quest.canDeliver ? 37 : 76, icon: () => joseph(), text: quest.canDeliver ? 'Quête de Joseph : livrez depuis le grenier' : `Quête de Joseph : ${fmt(prog)}/${fmt(n)}${what ? ` ${what}` : ''}`, short: `quête de Joseph (${fmt(prog)}/${fmt(n)})`, go: () => app.careerUI?.open.quest() });
        }
      }
    }

    // Le champ : récolter, ramasser, arroser, semer.
    const mature = plots.filter((p) => p.action === 'harvest' && !p.crow);
    if (mature.length) {
      const first = nearest(game, mature);
      add({ id: 'harvest', prio: 40, icon: () => (first.cropId ? cropIcon(first.cropId, 'sprite--sm') : icon('harvest', 'md')), text: `${plural(mature.length, 'parcelle')} à récolter`, short: `${plural(mature.length, 'parcelle')} à récolter`, go: () => focusPlots(mature.map((p) => p.index), first.index, 'harvest') });
    }
    if (career) {
      const sh = (cq(game, 'shelters', []) || []).filter((s) => Math.round(s.pending || 0) > 0);
      if (sh.length) {
        const total = sh.reduce((a, s) => a + Math.round(s.pending || 0), 0);
        const full = sh.some((s) => s.full);
        add({ id: 'collect', prio: full ? 32 : 45, icon: () => productIco(sh[0]), text: sh.length > 1 ? `Tout ramasser : ${sh.length} abris (+${fmt(total)})` : `${sh[0].name || 'Abri'} : à ramasser (+${fmt(total)})`, short: `${sh.length > 1 ? `${sh.length} abris` : (sh[0].name || 'un abri').toLowerCase()} à ramasser`, go: () => collectAll(), shelters: sh });
      }
    }
    const dry = plots.filter((p) => p.action === 'water' && !(p.lot && auto.water.has(p.lot)));
    if (dry.length) {
      const first = nearest(game, dry);
      add({ id: 'water', prio: 50, icon: () => icon('water', 'md'), text: `Arrosez ${plural(dry.length, 'parcelle')} (glissez le doigt)`, short: `${plural(dry.length, 'parcelle')} à arroser`, go: () => focusPlots(dry.map((p) => p.index), first.index, 'water') });
    }
    const empty = plots.filter((p) => p.action === 'plant' && !(p.lot && auto.sow.has(p.lot)));
    if (empty.length) {
      const crops = safe(() => game.query.plantableCrops(), []) || [];
      const ok = crops.some((c) => c.canAfford && !c.willFreeze && c.kind !== 'tree');
      if (ok) {
        const first = nearest(game, empty);
        add({ id: 'plant', prio: 55, icon: () => icon('seed', 'md'), text: `${plural(empty.length, 'parcelle libre', 'parcelles libres')} : semez`, short: `${plural(empty.length, 'parcelle')} à semer`, go: () => app.field.openSeedPicker(first.index) });
      }
    }

    // (Lot 3) Tableau du village, charrette, colporteur, cadeau et défis de la saison (src/ui/variety.js).
    for (const it of safe(() => app.variety?.todoItems?.(game), []) || []) add(it);

    if (career) {
      // Terrain à acheter (si l'argent suffit en gardant les charges de saison).
      const next = cq(game, 'nextLot', null);
      const charges = cq(game, 'charges', null)?.season?.amount || 0;
      if (next?.canBuy && game.state.money >= (next.price || 0) + charges) {
        add({ id: 'lot', prio: 70, icon: () => cIco('land', 'coin'), text: `${next.name || 'Un terrain'} est à vendre : ${fmt(next.price)}`, short: 'un terrain à acheter', go: () => app.careerUI?.open.lot(next.id) });
      }
      // Objectif du prochain rang.
      const s = cq(game, 'summary', null);
      const n = s?.nextRank;
      if (n) {
        const o = (n.objectives || []).find((x) => !x.done);
        const text = o
          ? `Objectif « ${n.name} » : ${objLabel(o)}${o.target > 1 ? ` (${fmt(o.progress)}/${fmt(o.target)})` : ''}`
          : `Objectif « ${n.name} » : patrimoine ${fmt(s.patrimony)}/${fmt(n.patrimony)}`;
        add({ id: 'rank', prio: 90, icon: () => cIco('level', 'star'), text, short: `objectif « ${n.name} »`, go: () => app.careerUI?.open.journal('farm') });
      }
    } else {
      // Concours (niveau 12).
      const contest = safe(() => game.query.contest?.(), null);
      if (contest && !contest.awarded) {
        const g = (contest.goals || []).find((x) => !x.done);
        if (g) add({ id: 'contest', prio: 72, icon: () => icon('star', 'md'), text: `Concours : ${g.label} (${fmt(g.progress)}/${fmt(g.target)})`, short: 'le concours', go: () => app.openTab('stats') });
      }
      // Un achat abordable qui laisse de quoi payer le fermage.
      const bill = safe(() => game.query.finance().nextBill.amount, 0);
      const inv = (safe(() => game.query.investments(), []) || []).filter((i) => i.canBuy && i.nextCost !== null && game.state.money - i.nextCost >= bill && i.owned === 0).sort((a, b) => a.nextCost - b.nextCost)[0];
      if (inv) add({ id: `buy-${inv.id}`, prio: 78, icon: () => investmentIcon(inv.id, 'sprite--sm'), text: `Vous pouvez acheter : ${inv.name} (${fmt(inv.nextCost)})`, short: `${inv.name.toLowerCase()} à acheter`, go: () => buyFocus(inv.id) });
      // But de l'année : les étoiles.
      const t = game.level?.starThresholds || [];
      const money = game.state.money;
      const target = t.find((x) => money < x);
      const stars = target === t[0] ? 2 : 3;
      add({
        id: 'goal',
        prio: 90,
        icon: () => icon('star', 'md'),
        text: target ? `Objectif : ${fmt(target)} pièces en fin d'année pour ${stars} étoiles (vous : ${fmt(money)})` : 'Objectif : gardez votre argent jusqu\'au fermage d\'hiver',
        short: target ? `${stars} étoiles dès ${fmt(target)} pièces` : 'garder votre argent',
        go: () => app.openTab('stats'),
      });
    }
    return out.sort((a, b) => a.prio - b.prio);
  }

  function objLabel(o) {
    return String(o.label || '').replace('{n}', fmt(o.target)).replace(/^./, (c) => c.toLowerCase());
  }

  function cIco(name, fallback) {
    return cIcon(name, 'sprite--sm', fallback);
  }
  function joseph() {
    return josephIcon('content', 'sprite--sm');
  }
  function productIco(s) {
    if (s?.animalId) return animalProductIcon(s.animalId, 'sprite--sm');
    return spriteAny([s?.product ? `product.${s.product}` : ''].filter(Boolean), 'sprite--sm', 'harvest');
  }

  // ── Actions ───────────────────────────────────────────────────────────────────
  function go() {
    if (!current) return;
    app.audio.play('click', { volume: 0.6 });
    app.vibrate?.(8);
    try {
      current.go();
    } catch (err) {
      console.warn('À faire :', err);
    }
    lastTick = 0;
  }

  function buyFocus(id) {
    app.openTab('shop');
    requestAnimationFrame(() => app.panel?.focusInvestment?.(id));
  }

  function collectAll() {
    const g = app.game;
    if (!g || g.mode !== 'career') return;
    const fn = g.actions.career?.collectAll;
    let res;
    if (typeof fn === 'function') res = app.careerUI?.act ? app.careerUI.act('collectAll') : fn();
    else {
      // Cœur sans collectAll : un abri après l'autre.
      for (const s of cq(g, 'shelters', []) || []) if ((s.pending || 0) > 0) res = app.careerUI?.act('collect', s.buildingId);
    }
    if (res?.ok) app.vibrate?.(15);
    lastTick = 0;
  }

  function openMessages() {
    app.audio.play('click', { volume: 0.6 });
    app.messages?.open();
  }

  /** Montre des parcelles : la vue va sur la première (si elle est cachée), puis un anneau les entoure. */
  function focusPlots(indexes, first = indexes[0], kind = null) {
    const s = app.scene;
    if (!s || first === undefined) return;
    const r0 = app.plotPageRect?.(first);
    const st = app.stageRect?.();
    // Le bas de la vue est couvert par la ligne « À faire » (et les messages juste au-dessus).
    // Carrière : la mini-carte (en bas à droite) couvre aussi le bas de la vue.
    const covered = app.game?.mode === 'career' && app.careerUI?.minimap?.shown ? 190 : 56;
    const visible = r0 && st && r0.top >= st.top + 4 && r0.bottom <= st.bottom - covered && r0.left >= st.left && r0.right <= st.right;
    if (!visible) safe(() => s.focusPlot(first, { margin: 40, bottom: covered, animate: !app.reducedMotion?.() }), null);
    // L'anneau suit la vue pendant son déplacement (quelques images).
    const list = indexes.slice(0, 24);
    let n = 0;
    const paint = () => {
      ring(list.map((i) => app.plotPageRect?.(i)).filter(Boolean));
      if (++n < 40) requestAnimationFrame(paint);
    };
    requestAnimationFrame(paint);
    clearTimeout(ringTimer);
    ringTimer = setTimeout(() => ring([]), 1900);
    if (kind && visible && list.length > 1 && app.isTouch) {
      app.toasts.show({ kind: 'info', icon: kind === 'water' ? 'water' : 'harvest', key: 'todo-swipe', text: kind === 'water' ? 'Glissez le doigt sur les parcelles entourées pour toutes les arroser.' : 'Glissez le doigt sur les parcelles entourées pour tout récolter.', duration: 3200, log: false });
    }
  }
  let ringTimer = null;

  function ring(rects) {
    rings.replaceChildren(
      ...rects.map((r) => {
        const n = el('span.todo-ring');
        n.style.left = `${Math.round(r.left - 3)}px`;
        n.style.top = `${Math.round(r.top - 3)}px`;
        n.style.width = `${Math.round(r.width + 6)}px`;
        n.style.height = `${Math.round(r.height + 6)}px`;
        return n;
      }),
    );
  }

  // ── Affichage ─────────────────────────────────────────────────────────────────
  function wanted() {
    const g = app.game;
    if (!g || app.inMenu || g.state.status !== 'playing') return false;
    if (app.dialogs?.isOpen()) return false;
    if (app.sheets?.isOpen() && !app.isWide()) return false;
    if (app.hints?.active) return false;
    if (app.tutorial?.active && app.tutorial.stepId !== 'wait-winter') return false;
    if (app.decor?.active) return false;
    if (document.body.classList.contains('is-rotated')) return false;
    return true;
  }

  function setShown(on) {
    if (on === shown) return;
    shown = on;
    root.hidden = !on;
    document.body.classList.toggle('has-todo', on);
    publishHeight();
    if (!on) ring([]);
  }

  let knownH = 58; // hauteur de la ligne la dernière fois qu'elle était visible (réserve de place pour la scène)
  function publishHeight() {
    const h = shown ? Math.round(root.offsetHeight) : 0;
    if (h > 0 && Math.abs(h - knownH) > 1) {
      knownH = h;
      app.onTodoResize?.();
    }
    if (h === lastH) return;
    lastH = h;
    document.documentElement.style.setProperty('--todo-h', `${h}px`);
  }

  function paint(list) {
    const top = list[0] || null;
    current = top;
    const key = top ? `${top.id}|${top.text}` : '';
    if (key !== lastKey) {
      lastKey = key;
      mainIcon.replaceChildren(top ? safe(top.icon, icon('info', 'md')) : icon('info', 'md'));
      setText(mainText, top ? top.text : 'La ferme pousse tranquillement.');
      main.setAttribute('aria-label', `À faire : ${top ? top.text : 'rien d\'urgent'}`);
      main.classList.toggle('is-urgent', !!top && top.prio <= 25);
    }
    // « Tout ramasser » à côté, quand au moins deux abris attendent et que la ligne parle d'autre chose.
    const col = list.find((x) => x.id === 'collect');
    const showCollect = !!col && col !== top && (col.shelters?.length || 0) >= 2;
    const ck = showCollect ? `${col.shelters.length}|${col.shelters[0]?.product}` : '';
    if (ck !== lastCollectKey) {
      lastCollectKey = ck;
      collect.hidden = !showCollect;
      if (showCollect) {
        collectIcon.replaceChildren(productIco(col.shelters[0]));
        collect.setAttribute('aria-label', `Tout ramasser (${col.shelters.length} abris)`);
      }
      publishHeight();
    }
  }

  function paintBell() {
    const n = app.messages?.unread || 0;
    bellBadge.hidden = n === 0;
    bellBadge.textContent = n > 9 ? '9+' : String(n);
    bell.setAttribute('aria-label', n ? `Messages (${n} nouveaux)` : 'Messages');
  }

  function tick() {
    const want = wanted();
    if (!want) {
      setShown(false);
      deliverMorning();
      return;
    }
    const now = performance.now();
    if (shown && now - lastTick < TICK_MS) return;
    lastTick = now;
    let list = [];
    try {
      list = items();
    } catch (err) {
      console.warn('À faire :', err);
    }
    paint(list);
    setShown(true);
    publishHeight();
    deliverMorning();
  }

  // ── Résumé du matin (E5) ──────────────────────────────────────────────────────
  function onEvent(ev, game) {
    if (ev.type === 'dawn') {
      const money = game.state.money;
      if (morning.prevMoney !== null && game.state.status === 'playing') {
        const delta = Math.round(money - morning.prevMoney);
        morning.pending = { delta, game, at: performance.now(), weather: ev.weather || game.state.weather?.today };
      }
      morning.prevMoney = money;
      lastTick = 0;
    } else if (ev.type === 'autoPaused') {
      // Option « pause chaque matin » (cœur : src/core/options.js) : le résumé du matin le dit.
      if (morning.pending) morning.pending.paused = true;
      else app.toasts.show({ kind: 'info', icon: 'pause', key: 'auto-pause', title: 'Pause du matin', text: 'Touchez le bouton de vitesse pour lancer la journée.', duration: 4200 });
    } else if (ev.type === 'crow' && game.mode === 'career') {
      // La parcelle visée par les corbeaux peut être hors de l'écran : la vue y va (sans fiche ni fenêtre ouverte).
      const plotsHit = ev.plots || [];
      if (plotsHit.length && !app.sheets.isOpen() && !app.dialogs.isOpen()) requestAnimationFrame(() => focusPlots(plotsHit));
      lastTick = 0;
    } else if (['harvested', 'planted', 'watered', 'collected', 'offer', 'offerResolved', 'questOffered', 'questDone', 'crowChased', 'rankUp', 'lotBought', 'ordersRenewed', 'orderProgress', 'orderDone', 'orderRemoved', 'cartArrived', 'cartProgress', 'crateFull', 'cartDeparted', 'cardsOffered', 'cardPicked', 'challengesOffered', 'challengeMedal', 'merchantSoon', 'merchantArrived', 'merchantLeft', 'merchantBought'].includes(ev.type)) {
      lastTick = 0;
    }
  }

  function morningText(p) {
    const parts = [];
    const d = p.delta;
    const yesterday = d > 0 ? `Hier : +${fmt(d)} pièces.` : d < 0 ? `Hier : ${fmt(d)} pièces.` : 'Hier : ni gain ni perte.';
    // (Lot 2) Surprises de la nuit, météo rare, légume géant : en tête du programme du jour.
    if (morning.notes.length) parts.push(morning.notes.splice(0).slice(0, 2).join(' '));
    const list = safe(() => items(p.game), []).filter((x) => !['goal', 'rank'].includes(x.id)).slice(0, 3);
    if (list.length) parts.push(`Aujourd'hui : ${list.map((x) => x.short).join(', ')}.`);
    else parts.push('Aujourd\'hui : rien d\'urgent, profitez !');
    return `${yesterday} ${parts.join(' ')}`;
  }

  function deliverMorning() {
    const p = morning.pending;
    if (!p) return;
    if (p.game !== app.game || app.inMenu) {
      morning.pending = null;
      return;
    }
    if (app.dialogs?.isOpen()) return; // après le bilan de saison
    morning.pending = null;
    const prefs = readPrefs();
    const c = safe(() => p.game.query.calendar(), null);
    const title = c ? `Bonjour ! ${p.game.mode === 'career' ? `${season(c.seasonId)}, jour ${c.dayOfSeason}` : `Jour ${c.day}`}` : 'Bonjour !';
    const text = `${morningText(p)}${p.paused ? ' Le jeu attend : touchez la vitesse pour lancer la journée.' : ''}`;
    const now = performance.now();
    // À ×4, une journée dure 5 s : au plus un résumé toutes les 25 s à l'écran (tous restent dans les messages).
    if ((prefs.morning || p.paused) && (p.paused || now - morning.lastShownAt > 25000) && !app.tutorial?.active) {
      morning.lastShownAt = now;
      app.toasts.show({ kind: 'info', icon: p.paused ? 'pause' : ['sunny', 'cloudy', 'rain', 'storm', 'heatwave', 'snow'].includes(p.weather) ? p.weather : 'sunny', key: 'morning', title, text, duration: p.paused ? 7000 : 5200 });
    } else {
      app.messages?.add({ kind: 'info', title, text });
    }
  }

  /** (Lot 2) Ligne ajoutée au prochain résumé du matin (surprise de l'aube, météo rare, légume géant). */
  function morningNote(text) {
    if (!text || morning.notes.includes(text)) return;
    morning.notes.push(text);
    if (morning.notes.length > 4) morning.notes.shift();
  }

  function morningToggle() {
    const on = readPrefs().morning;
    const btn = el(
      `button.opt-toggle.todo-morning-toggle${on ? '.is-on' : ''}`,
      {
        type: 'button',
        role: 'switch',
        id: 'todo-morning',
        'aria-checked': on ? 'true' : 'false',
        onclick: (e) => {
          const next = !readPrefs().morning;
          writePrefs({ morning: next });
          app.audio.play('toggle');
          e.currentTarget.classList.toggle('is-on', next);
          e.currentTarget.setAttribute('aria-checked', next ? 'true' : 'false');
        },
      },
      el('span.checkbox'),
      el('span.opt-label', 'Résumé du matin (un petit message chaque matin)'),
    );
    return btn;
  }

  // ── « Où en étais-je ? » (E6) ─────────────────────────────────────────────────
  function fieldLine(game) {
    const plots = safe(() => game.query.plots(), []) || [];
    const m = plots.filter((p) => p.action === 'harvest').length;
    const w = plots.filter((p) => p.action === 'water').length;
    const e = plots.filter((p) => p.action === 'plant').length;
    const grow = plots.filter((p) => p.cropId && !p.mature).length;
    const parts = [];
    if (m) parts.push(`${plural(m, 'culture mûre', 'cultures mûres')}`);
    if (grow) parts.push(`${plural(grow, 'culture')} qui ${grow > 1 ? 'poussent' : 'pousse'}`);
    if (w) parts.push(`${w} à arroser`);
    if (e) parts.push(`${plural(e, 'parcelle libre', 'parcelles libres')}`);
    return parts.length ? `Au champ : ${parts.join(', ')}.` : 'Le champ est vide.';
  }

  function showResume(game) {
    if (!game || game.state.status !== 'playing') return false;
    const career = game.mode === 'career';
    const c = safe(() => game.query.calendar(), null);
    const lines = [];
    let head;
    if (career) {
      const s = cq(game, 'summary', null);
      head = el('p.resume-farm', el('b', s?.farmName || 'Ma ferme'), el('span', ` · ${s?.rankName || ''}`));
      lines.push([icon(c?.seasonId || 'spring', 'sm'), `Année ${game.state.time.year} · ${season(c?.seasonId || 'spring')}, jour ${c?.dayOfSeason ?? 1} sur ${c?.seasonLength ?? 7}.`]);
    } else {
      const lvl = game.level;
      head = el('p.resume-farm', el('b', `Niveau ${lvl.id}`), el('span', ` · ${lvl.name}`));
      lines.push([icon(c?.seasonId || 'spring', 'sm'), `Jour ${c?.day ?? 1} · ${season(c?.seasonId || 'spring')} (encore ${plural(Math.max(0, (c?.daysLeftInSeason ?? 0)) + 1, 'jour')} dans la saison).`]);
    }
    lines.push([icon('coin', 'sm'), `Vous avez ${plural(game.state.money, 'pièce')}.`]);
    const proj = safe(() => app.hud.projection(), null);
    if (proj) {
      const what = career ? 'Charges de saison' : 'Fermage';
      const when = proj.daysLeft === 0 ? 'ce soir' : proj.daysLeft === 1 ? 'demain soir' : `dans ${plural(proj.daysLeft, 'jour')}`;
      const ok = game.state.money >= proj.amount;
      lines.push([icon('bill', 'sm'), `${what} : ${fmt(proj.amount)} pièces ${when}. ${ok ? 'C\'est couvert.' : `Il manque ${fmt(proj.amount - game.state.money)} pour l'instant.`}`]);
    }
    lines.push([icon('seed', 'sm'), fieldLine(game)]);
    const list = safe(() => items(game), []);
    const todo = list.slice(0, 3);
    const body = el(
      'div.resume',
      head,
      el('ul.resume-lines', lines.map(([ic, t]) => el('li', ic, el('span', t)))),
      todo.length ? el('div.resume-todo', el('h3.sum-title', 'À faire maintenant'), el('ul.resume-list', todo.map((x) => el('li', safe(x.icon, icon('info', 'sm')), el('span', x.text))))) : null,
    );
    const handle = { node: null };
    const close = () => app.dialogs.closeTop();
    const node = app.dialogs.frame({
      title: 'Où en étais-je ?',
      ribbon: 'ribbon',
      cls: 'dialog--resume',
      body,
      actions: [app.dialogs.btn(['Reprendre', icon('play', 'sm')], () => close(), 'btn--red', { id: 'resume-ok', 'data-autofocus': '' })],
      onClose: () => close(),
    });
    handle.node = app.dialogs.open(node, { id: 'resume', pauses: true });
    return true;
  }

  function reset(game) {
    morning.prevMoney = game ? game.state.money : null;
    morning.pending = null;
    morning.notes.length = 0;
    current = null;
    lastKey = '';
    lastCollectKey = '';
    lastTick = 0;
    ring([]);
    setShown(false);
  }

  paintBell();

  return {
    items,
    tick,
    onEvent,
    reset,
    showResume,
    morningToggle,
    morningNote,
    ring,
    focusPlots,
    collectAll,
    get visible() {
      return shown;
    },
    /** Place gardée en bas de la scène pendant la partie (la ligne + son écart avec les onglets), px CSS. */
    reserve: () => knownH + 6,
    el: root,
  };
}
