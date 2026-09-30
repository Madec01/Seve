// Barre du haut (compacte, deux lignes, pensée pour le téléphone en portrait) : argent et saison,
// météo du jour → demain, prochain fermage (couleur d'alerte), bouton de vitesse unique, et la
// course du soleil de la journée sur toute la largeur.
//
// createHud(root, app) → { bind(game), refresh(), frame(dt), onEvent(ev), openInfo(kind) }
// Le DOM est construit une fois ; refresh() ne change que les textes et classes (appelé sur les
// événements du jeu) ; frame() anime seulement le compteur d'argent et la barre du jour.

import { DAY_SECONDS } from '../data/balance.js';
import { el, fmt, plural, setText, signed } from './dom.js';
import { icon, setIcon } from './icons.js';
import { season, weatherName, WEATHER_HINTS } from './text.js';

export function createHud(root, app) {
  let game = null;
  let shownMoney = 0;
  let targetMoney = 0;
  let shownInt = null;
  let shownDay = -1;
  let pendingDelta = 0;
  let deltaTimer = null;

  // ── Construction ───────────────────────────────────────────────────────────────
  // Trois cases touchables (≥ 48 px de haut, sur deux lignes de texte) et le bouton de vitesse.
  // Toucher une case ouvre sa fiche (ce qui était en infobulle) ; à la souris, l'infobulle reste.
  const moneyValue = el('span.money-value', '0');
  const moneyPops = el('span.money-pops');
  const seasonIcon = icon('spring', 'sm');
  const dateSeason = el('span.date-season', '');
  const dateDay = el('span.date-day', '');
  const dateMain = el('span.date-main', dateSeason, el('span.date-word', 'Jour'), dateDay);
  const money = el(
    'button.hud-cell.hud-money.has-tip',
    { type: 'button', id: 'hud-money', 'data-tip-side': 'bottom', 'aria-label': 'Argent et saison', onclick: () => openInfo('money') },
    el('span.hud-line.hud-line--big', icon('coin', 'sm'), moneyValue),
    el('span.hud-line.hud-date', { id: 'hud-date' }, seasonIcon, dateMain),
    moneyPops,
  );
  money._tip = () => el('div.tip-rows', dateTip(), moneyTip());

  const wToday = icon('sunny', 'md');
  const wName = el('span.w-name', '');
  const wTomorrow = icon('sunny', 'sm');
  const weather = el(
    'button.hud-cell.hud-weather.has-tip',
    { type: 'button', id: 'hud-weather', 'data-tip-side': 'bottom', 'aria-label': 'Météo', onclick: () => openInfo('weather') },
    el('span.hud-line.w-icons', wToday, el('span.w-arrow', '›'), el('span.w-tomorrow', wTomorrow)),
    el('span.hud-line.hud-small', wName),
  );
  weather._tip = () => weatherTip();

  const billAmount = el('b.bill-amount', '');
  const billDays = el('span.bill-days', '');
  const bill = el(
    'button.hud-cell.hud-bill.has-tip',
    { type: 'button', id: 'hud-bill', 'data-tip-side': 'bottom', 'aria-label': 'Prochain fermage', onclick: () => openInfo('bill') },
    el('span.hud-line.hud-line--big', icon('bill', 'sm'), billAmount),
    el('span.hud-line.hud-small', billDays),
  );
  bill._tip = () => billTip();

  // Vitesse : un seul gros bouton. Toucher : ×1 → ×2 → ×4 → pause → ×1 ; appui long : pause.
  const speedIcon = icon('play', 'md');
  const speedLabel = el('span.speed-label', '×1');
  const speedBtn = el(
    'button.hud-speed.has-tip',
    { type: 'button', id: 'hud-speed', 'aria-label': 'Vitesse du temps', 'data-tip-side': 'bottom' },
    speedIcon,
    speedLabel,
  );
  speedBtn._tip = () => 'Vitesse : ×1 → ×2 → ×4 → pause (Espace : pause, touches 1, 2, 3). Appui long : pause.';
  let pressTimer = null;
  let longPressed = false;
  speedBtn.addEventListener('pointerdown', () => {
    longPressed = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      longPressed = true;
      if (game && game.state.speed !== 0) {
        app.vibrate?.(25);
        app.setSpeed(0, { fromUser: true });
      }
    }, 500);
  });
  const cancelPress = () => clearTimeout(pressTimer);
  speedBtn.addEventListener('pointerup', cancelPress);
  speedBtn.addEventListener('pointercancel', cancelPress);
  speedBtn.addEventListener('pointerleave', cancelPress);
  speedBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  speedBtn.addEventListener('click', () => {
    if (longPressed) {
      longPressed = false;
      return;
    }
    if (!game) return;
    const sp = game.state.speed;
    const next = sp === 0 ? 1 : sp === 1 ? 2 : sp === 2 ? 4 : 0;
    app.vibrate?.(8);
    app.setSpeed(next, { fromUser: true });
  });

  const dayFill = el('span.dayline-fill');
  const daySun = el('span.dayline-sun');
  const dayline = el('div.hud-dayline', { 'aria-hidden': 'true' }, dayFill, daySun);

  root.append(el('div.hud-row', money, weather, bill, speedBtn), dayline);

  // Fiches de la barre du haut (au toucher : c'est la seule façon de voir ces détails). Seule la
  // partie chiffrée est reconstruite quand l'argent change ; le bouton reste le même élément.
  let infoDyn = null;
  let infoKind = null;
  function infoRows(kind) {
    if (kind === 'money') return [dateTip(), moneyTip()];
    if (kind === 'weather') return [weatherTip()];
    return [billTip()];
  }
  function openInfo(kind) {
    if (!game) return;
    app.audio.play('page', { volume: 0.7 });
    infoKind = kind;
    infoDyn = el('div.info-dyn', infoRows(kind));
    const titles = { money: ['coin', 'Argent et saison'], weather: [game.state.weather.today, 'Météo'], bill: ['bill', 'Prochain fermage'] };
    const actions = kind === 'bill' ? el('div.sheet-actions', el('button.btn.btn--wide', { type: 'button', id: 'info-bilan', onclick: () => app.openTab('stats') }, icon('bill', 'sm'), 'Voir le bilan complet')) : null;
    app.sheets.open({ id: `info-${kind}`, kind: 'popup', icon: icon(titles[kind][0], 'md'), title: titles[kind][1], content: el('div.info-sheet', infoDyn, actions) });
  }

  // ── Infobulles ────────────────────────────────────────────────────────────────
  function moneyTip() {
    if (!game) return null;
    const f = game.query.finance();
    const c = game.query.calendar();
    const rows = [el('div.tip-title', `Argent : ${plural(f.money, 'pièce')}`), el('div.tip-sub', `Chaque matin ${season(c.seasonId, 'in')} :`)];
    let listed = 0;
    for (const inv of game.query.investments()) {
      if (!inv.owned) continue;
      const units = inv.kind === 'upgrade' ? 1 : inv.owned;
      const amount = (inv.income || 0) * units;
      if (amount > 0) {
        rows.push(row(`${inv.name}${units > 1 ? ` ×${units}` : ''}`, `+${fmt(amount)}`, 'pos'));
        listed += 1;
      }
    }
    if (!listed) rows.push(row('Revenus automatiques', '0'));
    rows.push(row('Charges (ferme et entretien)', f.dailyCharges ? `−${fmt(f.dailyCharges)}` : '0', f.dailyCharges ? 'neg' : ''));
    rows.push(el('div.tip-row.tip-total', el('span', 'Solde de chaque matin'), el(`b.${f.net < 0 ? 'neg' : 'pos'}`, `${signed(f.net)} / jour`)));
    if (f.loan && f.loan.nextInDays !== null) rows.push(row('Prochaine mensualité du prêt', `−${fmt(f.loan.payment)}`, 'neg'));
    rows.push(el('div.tip-sub', 'Les récoltes, elles, rapportent au moment où vous les cueillez.'));
    if (f.money < 0) rows.push(el('div.tip-note.neg', 'Vous êtes à découvert : attention au prochain fermage !'));
    return el('div.tip-rows', rows);
  }

  function dateTip() {
    if (!game) return null;
    const c = game.query.calendar();
    return el(
      'div.tip-rows',
      el('div.tip-title', `${c.seasonName} — jour ${c.dayOfSeason} sur ${c.seasonLength}`),
      el('div', `Jour ${c.day} de l'année (sur ${c.totalDays}).`),
      el('div', c.daysLeftInSeason === 0 ? `Dernier jour ${season(c.seasonId, 'of')} : le fermage se paie ce soir.` : `Encore ${plural(c.daysLeftInSeason, 'jour')} avant la fin ${season(c.seasonId, 'of')}.`),
    );
  }

  function weatherTip() {
    if (!game) return null;
    const w = game.query.forecast();
    return el(
      'div.tip-rows',
      el('div.tip-title', `Aujourd'hui : ${weatherName(w.today)}`),
      el('div', WEATHER_HINTS[w.today] || ''),
      el('div.tip-sub', `Demain : ${weatherName(w.tomorrow)}. ${WEATHER_HINTS[w.tomorrow] || ''}`),
      w.afterTomorrow ? el('div.tip-sub', `Après-demain : ${weatherName(w.afterTomorrow)} (almanach).`) : null,
    );
  }

  function billTip() {
    if (!game) return null;
    const p = projection();
    const nodes = [
      el('div.tip-title', `Fermage ${season(p.seasonId, 'of')} : ${fmt(p.amount)} pièces`),
      el('div', p.daysLeft === 0 ? 'Il sera prélevé ce soir.' : `Il sera prélevé le soir du dernier jour de la saison, ${p.daysLeft === 1 ? 'demain' : `dans ${p.daysLeft} jours`}.`),
      row('Argent actuel', fmt(p.money)),
    ];
    if (p.daysLeft > 0) nodes.push(row(p.daysLeft > 1 ? `Solde des ${p.daysLeft} prochains matins` : 'Solde du prochain matin', signed(p.netTotal), p.netTotal < 0 ? 'neg' : ''));
    if (p.loanTotal) nodes.push(row('Mensualité du prêt', signed(-p.loanTotal)));
    if (p.crops > 0) nodes.push(row('Récoltes à venir (estimation)', signed(p.crops)));
    if (p.products > 0) nodes.push(row('Produits en cours (vendus aux prochaines aubes)', signed(p.products), 'pos'));
    nodes.push(el('div.tip-row.tip-total', el('span', 'Prévision ce soir-là'), el(`b.${p.projected >= p.amount ? 'pos' : 'neg'}`, fmt(p.projected))));
    nodes.push(
      el(
        `div.tip-note.${p.state === 'danger' ? 'neg' : p.state === 'warn' ? 'warn' : 'pos'}`,
        p.state === 'ok'
          ? 'Vous avez déjà de quoi payer.'
          : p.state === 'warn'
            ? `Il manque encore ${fmt(p.amount - p.money)} pièces : récoltez avant ce soir-là.`
            : 'Attention : au rythme actuel, vous ne pourrez pas payer. Faillite en vue !',
      ),
    );
    if (p.rentAutoSell && p.daysLeft === 0) {
      nodes.push(el('div.tip-note.warn', `Il manque ${fmt(Math.max(0, p.amount - p.money))} pièces : vos produits seront vendus en l'état ce soir.`));
    }
    nodes.push(el('div.tip-sub', `Prévision = argent actuel + solde des matins à venir + cultures qui seront mûres d'ici là${p.products ? ' + produits des ateliers' : ''}.`));
    const contest = typeof game.query.contest === 'function' ? game.query.contest() : null;
    if (contest && !contest.awarded) {
      const done = contest.goals.filter((g) => g.done).length;
      nodes.push(el('div.tip-sub', `Concours du village : ${done}/${contest.goals.length} épreuves réussies, jugement ${contest.daysLeft === 0 ? 'ce soir' : `dans ${plural(contest.daysLeft, 'jour')}`}.`));
    }
    return el('div.tip-rows', nodes);
  }

  function row(label, value, cls = '') {
    return el('div.tip-row', el('span', label), el(`b${cls ? `.${cls}` : ''}`, value));
  }

  // ── Calculs ───────────────────────────────────────────────────────────────────
  /** Prévision de l'argent au soir du fermage : argent + revenus nets + récoltes à venir − prêt. */
  function projection() {
    const f = game.query.finance();
    const bill = f.nextBill;
    const daysLeft = bill.daysLeft;
    const netTotal = f.net * daysLeft;
    let loanTotal = 0;
    if (f.loan && f.loan.nextInDays !== null && f.loan.nextInDays > 0 && f.loan.nextInDays <= daysLeft) {
      loanTotal = f.loan.payment * (1 + Math.floor((daysLeft - f.loan.nextInDays) / f.loan.every));
    }
    let crops = 0;
    for (const p of game.query.plots()) {
      if (!p.cropId) continue;
      if (p.mature) crops += p.harvestValue || 0;
      else if (p.daysLeft <= daysLeft && !p.willFreeze) {
        const c = game.query.plantableCrops().find((x) => x.id === p.cropId);
        crops += c ? c.sellPrice : 0;
      }
    }
    // Estimation des récoltes : prix des cultures plantables ; celles qui ne le sont plus cette
    // saison ne sont pas comptées (prudence).
    // Produits des ateliers : vendus à l'aube où ils sont prêts (avant le soir du fermage), sinon
    // vendus en l'état ce soir-là si l'argent manque (filet de sécurité du cœur).
    let products = 0;
    if (typeof game.query.processing === 'function') {
      for (const b of game.query.processing()) {
        for (const pl of b.places || []) {
          if (!pl) continue;
          products += pl.daysLeft <= daysLeft ? pl.value || 0 : pl.rawValue || 0;
        }
      }
    }
    const projected = f.money + netTotal - loanTotal + crops + products;
    const state = f.money >= bill.amount + loanTotal - Math.min(0, netTotal) ? 'ok' : projected >= bill.amount ? 'warn' : 'danger';
    return { amount: bill.amount, daysLeft, seasonId: bill.seasonId, money: f.money, netTotal, loanTotal, crops, products, projected, state, rentAutoSell: !!f.rentAutoSell };
  }

  // ── Mises à jour ──────────────────────────────────────────────────────────────
  function refresh() {
    if (!game) return;
    const c = game.query.calendar();
    const w = game.query.forecast();
    targetMoney = game.state.money;

    setIcon(seasonIcon, c.seasonId);
    setText(dateSeason, c.seasonName);
    setText(dateDay, ` ${c.dayOfSeason}/${c.seasonLength}`);
    money.dataset.season = c.seasonId;

    setIcon(wToday, w.today);
    setText(wName, weatherName(w.today));
    setIcon(wTomorrow, w.tomorrow || 'sunny');
    weather.querySelector('.w-tomorrow').style.visibility = w.tomorrow ? '' : 'hidden';
    weather.querySelector('.w-arrow').style.visibility = w.tomorrow ? '' : 'hidden';
    weather.setAttribute('aria-label', `Météo : ${weatherName(w.today)}${w.tomorrow ? `, demain ${weatherName(w.tomorrow)}` : ''}`);

    const p = projection();
    const status = game.state.status;
    setText(billAmount, fmt(p.amount));
    if (status === 'victory') setText(billDays, 'payé : année finie !');
    else if (status === 'bankrupt') setText(billDays, 'impayé');
    else setText(billDays, p.daysLeft === 0 ? 'ce soir !' : p.daysLeft === 1 ? 'demain' : `dans ${p.daysLeft} j`);
    bill.setAttribute('aria-label', `Fermage : ${fmt(p.amount)} pièces, ${billDays.textContent}`);
    const state = status === 'victory' ? 'ok' : status === 'bankrupt' ? 'danger' : p.state;
    bill.classList.toggle('is-ok', state === 'ok');
    bill.classList.toggle('is-warn', state === 'warn');
    bill.classList.toggle('is-danger', state === 'danger');
    bill.classList.toggle('is-urgent', status === 'playing' && p.daysLeft <= 1 && p.state !== 'ok');

    const sp = game.state.speed;
    setIcon(speedIcon, sp === 0 ? 'pause' : sp === 1 ? 'play' : sp === 2 ? 'fast' : 'faster');
    setText(speedLabel, sp === 0 ? 'Pause' : `×${sp}`);
    speedBtn.dataset.speed = String(sp);
    speedBtn.setAttribute('aria-label', sp === 0 ? 'En pause : toucher pour reprendre' : `Vitesse ×${sp} : toucher pour changer`);
    root.classList.toggle('is-paused', sp === 0);
    app.tooltip?.refresh(money);
    app.tooltip?.refresh(bill);
  }

  function refreshMute() {
    /* le son se règle dans le menu (options) ou avec la touche M */
  }

  function popDelta(delta) {
    pendingDelta += delta;
    if (deltaTimer) return;
    deltaTimer = setTimeout(() => {
      deltaTimer = null;
      const d = Math.round(pendingDelta);
      pendingDelta = 0;
      if (!d) return;
      const pop = el(`span.money-pop.${d > 0 ? 'pos' : 'neg'}`, signed(d));
      moneyPops.append(pop);
      setTimeout(() => pop.remove(), 1400);
    }, 120);
  }

  function frame(dt) {
    if (!game) return;
    // Compteur d'argent animé
    if (shownMoney !== targetMoney) {
      const diff = targetMoney - shownMoney;
      const step = diff * Math.min(1, dt * 9);
      shownMoney = Math.abs(diff) < 0.6 || Math.abs(step) >= Math.abs(diff) ? targetMoney : shownMoney + step;
    }
    const n = Math.round(shownMoney);
    if (n !== shownInt) {
      shownInt = n;
      moneyValue.textContent = fmt(n);
      money.classList.toggle('is-negative', n < 0);
      money.setAttribute('aria-label', `Argent : ${fmt(n)} pièces`);
    }
    // Avancée de la journée
    // (écritures de style seulement quand la valeur affichée change : pas de mise en page à
    // chaque image pendant une pause)
    const k = Math.max(0, Math.min(1, game.state.time.elapsed / DAY_SECONDS));
    const key = Math.round(k * 2000);
    if (key !== shownDay) {
      shownDay = key;
      dayFill.style.transform = `scaleX(${k.toFixed(4)})`;
      daySun.style.left = `calc(4px + ${k.toFixed(4)} * (100% - 8px))`;
    }
  }

  function bind(g) {
    game = g;
    shownMoney = g.state.money;
    targetMoney = g.state.money;
    shownInt = null;
    shownDay = -1;
    moneyPops.textContent = '';
    refresh();
    frame(0);
  }

  function onEvent(ev) {
    if (app.sheets?.current?.startsWith('info-') && ['moneyChanged', 'dawn', 'weather', 'productSold', 'processingStarted', 'processingSoldRaw', 'contestProgress'].includes(ev.type)) refreshInfo();
    if (ev.type === 'moneyChanged') {
      targetMoney = ev.money;
      if (ev.delta) popDelta(ev.delta);
      money.classList.remove('is-bump');
      void money.offsetWidth;
      money.classList.add('is-bump');
    }
  }

  let infoQueued = false;
  function refreshInfo() {
    if (infoQueued) return;
    infoQueued = true;
    requestAnimationFrame(() => {
      infoQueued = false;
      if (!game || !infoDyn || app.sheets?.current !== `info-${infoKind}`) return;
      const fresh = el('div.info-dyn', infoRows(infoKind));
      if (fresh.textContent !== infoDyn.textContent) infoDyn.replaceChildren(...fresh.childNodes);
    });
  }

  return { bind, refresh, frame, onEvent, refreshMute, projection, openInfo, el: root };
}
