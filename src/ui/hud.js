// Barre du haut : argent (compteur animé), date et saison, météo du jour et de demain,
// prochain fermage (avec alerte), vitesses et menu.
//
// createHud(root, app) → { bind(game), refresh(), frame(dt), onEvent(ev) }
// Le DOM est construit une fois ; refresh() ne change que les textes et classes (appelé sur les
// événements du jeu) ; frame() anime seulement le compteur d'argent et la barre du jour.

import { el, fmt, plural, signed } from './dom.js';
import { icon, setIcon } from './icons.js';
import { season, weatherName, WEATHER_HINTS } from './text.js';

const SPEEDS = [
  { speed: 0, icon: 'pause', label: 'Pause', key: 'Espace' },
  { speed: 1, icon: 'play', label: 'Vitesse normale', key: '1' },
  { speed: 2, icon: 'fast', label: 'Vitesse ×2', key: '2' },
  { speed: 4, icon: 'faster', label: 'Vitesse ×4', key: '3' },
];

export function createHud(root, app) {
  let game = null;
  let shownMoney = 0;
  let targetMoney = 0;
  let shownInt = null;
  let pendingDelta = 0;
  let deltaTimer = null;

  // ── Construction ───────────────────────────────────────────────────────────────
  const moneyValue = el('span.money-value', '0');
  const moneyPops = el('span.money-pops');
  const money = el(
    'div.chip.hud-money.has-tip',
    { id: 'hud-money', 'data-tip-side': 'bottom' },
    icon('coin', 'md'),
    moneyValue,
    moneyPops,
  );
  money._tip = () => moneyTip();

  const seasonIcon = icon('spring', 'md');
  const dateMain = el('span.date-main', '');
  const dayFill = el('span.dayline-fill');
  const daySun = el('span.dayline-sun');
  const date = el(
    'div.chip.hud-date.has-tip',
    { id: 'hud-date', 'data-tip-side': 'bottom' },
    seasonIcon,
    el('div.hud-stack', dateMain, el('span.dayline', dayFill, daySun)),
  );
  date._tip = () => dateTip();

  const wToday = icon('sunny', 'md');
  const wName = el('span.w-name', '');
  const wTomorrow = icon('sunny', 'sm');
  const weather = el(
    'div.chip.hud-weather.has-tip',
    { id: 'hud-weather', 'data-tip-side': 'bottom' },
    wToday,
    wName,
    el('span.w-sep'),
    el('span.w-tomorrow', el('span.w-label', 'Demain'), wTomorrow),
  );
  weather._tip = () => weatherTip();

  const billAmount = el('b.bill-amount', '');
  const billDays = el('span.bill-days', '');
  const bill = el(
    'div.chip.hud-bill.has-tip',
    { id: 'hud-bill', 'data-tip-side': 'bottom' },
    icon('bill', 'md'),
    el('div.hud-stack', el('span.bill-line', el('span.bill-label', 'Fermage '), billAmount), billDays),
  );
  bill._tip = () => billTip();

  const speedButtons = SPEEDS.map((s) => {
    const b = el(
      'button.hud-btn.speed-btn',
      {
        type: 'button',
        id: `speed-${s.speed}`,
        'aria-label': s.label,
        'data-tip': `${s.label} (${s.key})`,
        'data-tip-side': 'bottom',
        onclick: () => app.setSpeed(s.speed, { fromUser: true }),
      },
      icon(s.icon, 'md'),
      s.speed > 1 ? el('span.speed-num', `×${s.speed}`) : null,
    );
    b.dataset.speed = s.speed;
    return b;
  });
  const speed = el('div.hud-speed', { id: 'hud-speed', role: 'group', 'aria-label': 'Vitesse du temps' }, speedButtons);

  const muteIcon = icon('sound', 'md');
  const muteBtn = el(
    'button.hud-btn.hud-mute',
    { type: 'button', id: 'hud-mute', 'aria-label': 'Couper le son', 'data-tip-side': 'bottom', onclick: () => app.toggleMute() },
    muteIcon,
  );
  const menuBtn = el(
    'button.hud-btn.hud-menu',
    { type: 'button', id: 'hud-menu', 'aria-label': 'Menu', 'data-tip': 'Menu (Échap)', 'data-tip-side': 'bottom', onclick: () => app.openPauseMenu() },
    icon('menu', 'md'),
  );

  root.append(money, date, weather, bill, el('div.hud-spacer'), speed, muteBtn, menuBtn);

  // ── Infobulles ────────────────────────────────────────────────────────────────
  function moneyTip() {
    if (!game) return null;
    const f = game.query.finance();
    return el(
      'div.tip-rows',
      el('div.tip-title', 'Argent'),
      row('Revenus automatiques', `${signed(f.dailyIncome)} / jour`),
      row('Charges quotidiennes', `${signed(-f.dailyCharges)} / jour`),
      row('Solde quotidien', `${signed(f.net)} / jour`, f.net < 0 ? 'neg' : 'pos'),
      f.money < 0 ? el('div.tip-note.neg', 'Vous êtes à découvert : attention au prochain fermage !') : null,
    );
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
    if (p.daysLeft > 0) nodes.push(row(`Revenus nets (${plural(p.daysLeft, 'jour')})`, signed(p.netTotal)));
    if (p.loanTotal) nodes.push(row('Mensualité du prêt', signed(-p.loanTotal)));
    if (p.crops > 0) nodes.push(row('Récoltes à venir (estimation)', signed(p.crops)));
    nodes.push(row('Prévision', fmt(p.projected), p.projected >= p.amount ? 'pos' : 'neg'));
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
    const projected = f.money + netTotal - loanTotal + crops;
    const state = f.money >= bill.amount + loanTotal - Math.min(0, netTotal) ? 'ok' : projected >= bill.amount ? 'warn' : 'danger';
    return { amount: bill.amount, daysLeft, seasonId: bill.seasonId, money: f.money, netTotal, loanTotal, crops, projected, state };
  }

  // ── Mises à jour ──────────────────────────────────────────────────────────────
  function refresh() {
    if (!game) return;
    const c = game.query.calendar();
    const w = game.query.forecast();
    targetMoney = game.state.money;

    setIcon(seasonIcon, c.seasonId);
    dateMain.textContent = `Jour ${c.day} · ${c.seasonName} (${c.dayOfSeason}/${c.seasonLength})`;
    date.dataset.season = c.seasonId;

    setIcon(wToday, w.today);
    wName.textContent = weatherName(w.today);
    setIcon(wTomorrow, w.tomorrow || 'sunny');
    weather.querySelector('.w-tomorrow').style.visibility = w.tomorrow ? '' : 'hidden';

    const p = projection();
    const status = game.state.status;
    billAmount.textContent = fmt(p.amount);
    if (status === 'victory') billDays.textContent = 'payé : année finie !';
    else if (status === 'bankrupt') billDays.textContent = 'impayé';
    else billDays.textContent = p.daysLeft === 0 ? 'ce soir !' : p.daysLeft === 1 ? 'demain soir' : `dans ${p.daysLeft} jours`;
    const state = status === 'victory' ? 'ok' : status === 'bankrupt' ? 'danger' : p.state;
    bill.classList.toggle('is-ok', state === 'ok');
    bill.classList.toggle('is-warn', state === 'warn');
    bill.classList.toggle('is-danger', state === 'danger');
    bill.classList.toggle('is-urgent', status === 'playing' && p.daysLeft <= 1 && p.state !== 'ok');

    const sp = game.state.speed;
    for (const b of speedButtons) {
      const on = Number(b.dataset.speed) === sp;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    root.classList.toggle('is-paused', sp === 0);
    refreshMute();
    app.tooltip?.refresh(money);
    app.tooltip?.refresh(bill);
  }

  function refreshMute() {
    const muted = !!app.settings.muted;
    setIcon(muteIcon, muted ? 'mute' : 'sound');
    muteBtn.dataset.tip = muted ? 'Remettre le son' : 'Couper le son';
    muteBtn.setAttribute('aria-label', muteBtn.dataset.tip);
    muteBtn.classList.toggle('is-active', muted);
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
    }
    // Avancée de la journée
    const p = game.state.time.elapsed / 20;
    const k = Math.max(0, Math.min(1, p));
    dayFill.style.transform = `scaleX(${k.toFixed(4)})`;
    daySun.style.left = `${(k * 100).toFixed(2)}%`;
  }

  function bind(g) {
    game = g;
    shownMoney = g.state.money;
    targetMoney = g.state.money;
    shownInt = null;
    moneyPops.textContent = '';
    refresh();
    frame(0);
  }

  function onEvent(ev) {
    if (ev.type === 'moneyChanged') {
      targetMoney = ev.money;
      if (ev.delta) popDelta(ev.delta);
      money.classList.remove('is-bump');
      void money.offsetWidth;
      money.classList.add('is-bump');
    }
  }

  return { bind, refresh, frame, onEvent, refreshMute, projection, el: root };
}
