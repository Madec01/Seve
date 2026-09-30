// Barre du haut (compacte, deux lignes, pensée pour le téléphone en portrait) : argent et saison,
// météo du jour → demain, prochain fermage (couleur d'alerte), bouton de vitesse unique, et la
// course du soleil de la journée sur toute la largeur.
//
// createHud(root, app) → { bind(game), refresh(), frame(dt), onEvent(ev), openInfo(kind) }
// Le DOM est construit une fois ; refresh() ne change que les textes et classes (appelé sur les
// événements du jeu) ; frame() anime seulement le compteur d'argent et la barre du jour.

import { DAY_SECONDS } from '../data/balance.js';
import { el, fmt, plural, setText, signed } from './dom.js';
import { icon, setIcon, spriteAny } from './icons.js';
import { season, weatherHint, weatherName } from './text.js';

export function createHud(root, app) {
  let game = null;
  let career = false; // mode Carrière : année, rang, charges de saison
  let shownRank = null;
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
  const dateYear = el('span.date-year', '');
  const dateMain = el('span.date-main', dateYear, dateSeason, el('span.date-word', 'Jour'), dateDay);
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

  // Carrière : blason du rang et progression vers le rang suivant (toucher → le Carnet).
  const rankIconBox = el('span.rank-ico');
  const rankFill = el('span.rank-fill');
  const rankCell = el(
    'button.hud-cell.hud-rank',
    { type: 'button', id: 'hud-rank', hidden: true, 'aria-label': 'Rang de la ferme', onclick: () => app.careerUI?.open.journal('farm') },
    rankIconBox,
    el('span.rank-bar', rankFill),
  );

  root.append(el('div.hud-row', money, weather, bill, rankCell, speedBtn), dayline);

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
    const titles = { money: ['coin', 'Argent et saison'], weather: [game.state.weather.today, 'Météo'], bill: ['bill', career ? 'Charges de saison' : 'Prochain fermage'] };
    const debt = game.query.finance().neighbourLoan?.debt || 0;
    let actions = null;
    if (kind === 'bill') actions = el('div.sheet-actions', el('button.btn.btn--wide', { type: 'button', id: 'info-bilan', onclick: () => (career ? app.careerUI?.open.journal('report') : app.openTab('stats')) }, icon('bill', 'sm'), career ? 'Voir le carnet (bilan)' : 'Voir le bilan complet'));
    else if (kind === 'money' && debt > 0) actions = el('div.sheet-actions', el('button.btn.btn--wide', { type: 'button', id: 'info-repay', onclick: () => app.openNeighbour() }, icon('coin', 'sm'), 'Rembourser Joseph'));
    app.sheets.open({ id: `info-${kind}`, kind: 'popup', icon: icon(titles[kind][0], 'md'), title: titles[kind][1], content: el('div.info-sheet', infoDyn, actions) });
  }

  // ── Infobulles ────────────────────────────────────────────────────────────────
  function moneyTip() {
    if (!game) return null;
    if (career) return careerMoneyTip();
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
    const nl = f.neighbourLoan;
    if (nl && nl.debt > 0) {
      rows.push(el('div.tip-row.tip-debt', el('span', 'Dette envers Joseph'), el('b.warn', `${fmt(nl.debt)} pièces`)));
      rows.push(el('div.tip-sub', `${shareText(nl.repayShare)} de chaque vente lui revient jusqu'au remboursement.`));
    }
    if (f.money < 0) rows.push(el('div.tip-note.neg', 'Vous êtes à découvert : attention au prochain fermage !'));
    return el('div.tip-rows', rows);
  }

  function dateTip() {
    if (!game) return null;
    const c = game.query.calendar();
    return el(
      'div.tip-rows',
      el('div.tip-title', `${career ? `Année ${game.state.time.year} · ` : ''}${c.seasonName} — jour ${c.dayOfSeason} sur ${c.seasonLength}`),
      el('div', `Jour ${c.day} de l'année (sur ${c.totalDays}).`),
      el('div', c.daysLeftInSeason === 0 ? `Dernier jour ${season(c.seasonId, 'of')} : ${career ? 'les charges de saison se paient' : 'le fermage se paie'} ce soir.` : `Encore ${plural(c.daysLeftInSeason, 'jour')} avant la fin ${season(c.seasonId, 'of')}.`),
    );
  }

  /** Carrière : charges quotidiennes détaillées (ferme, entretien, salaires, carburant, solaire) et patrimoine. */
  function careerMoneyTip() {
    const f = game.query.finance();
    const cq = game.query.career;
    let ch = null;
    let sum = null;
    try {
      ch = cq.charges();
      sum = cq.summary();
    } catch {
      /* lot pas encore livré */
    }
    const labels = { farm: 'Charges de la ferme', upkeep: 'Entretien', wages: 'Salaires', fuel: 'Carburant', heating: 'Chauffage de la serre', solar: 'Panneaux solaires', neighbour: 'Part de Joseph' };
    const rows = [el('div.tip-title', `Argent : ${plural(f.money, 'pièce')}`)];
    if (f.dailyIncome) rows.push(row('Revenus automatiques (chaque matin)', `+${fmt(f.dailyIncome)}`, 'pos'));
    for (const d of ch?.daily || []) rows.push(row(labels[d.source] || d.source, d.source === 'solar' ? `+${fmt(d.amount)}` : `−${fmt(d.amount)}`, d.source === 'solar' ? 'pos' : 'neg'));
    rows.push(el('div.tip-row.tip-total', el('span', 'Solde de chaque matin'), el(`b.${f.net < 0 ? 'neg' : 'pos'}`, `${signed(f.net)} / jour`)));
    rows.push(el('div.tip-sub', 'Récoltes, ramassage des abris et ventes du grenier rapportent au moment où vous les faites.'));
    if (sum) rows.push(row('Patrimoine de la ferme', fmt(sum.patrimony)));
    const nl = f.neighbourLoan;
    if (nl && nl.debt > 0) rows.push(el('div.tip-row.tip-debt', el('span', 'Dette envers Joseph'), el('b.warn', `${fmt(nl.debt)} pièces`)));
    if (sum?.hardship) rows.push(el('div.tip-note.neg', 'Passe difficile : employés et machines à l\'arrêt jusqu\'à ce que l\'argent repasse au-dessus de 50.'));
    return el('div.tip-rows', rows);
  }

  function weatherTip() {
    if (!game) return null;
    const w = game.query.forecast();
    return el(
      'div.tip-rows',
      el('div.tip-title', `Aujourd'hui : ${weatherName(w.today)}`),
      el('div', weatherHint(w.today, game.level)),
      el('div.tip-sub', `Demain : ${weatherName(w.tomorrow)}. ${weatherHint(w.tomorrow, game.level)}`),
      w.afterTomorrow ? el('div.tip-sub', `Après-demain : ${weatherName(w.afterTomorrow)} (almanach).`) : null,
    );
  }

  function billTip() {
    if (!game) return null;
    const p = projection();
    const what = career ? 'Charges' : 'Fermage';
    const nodes = [
      el('div.tip-title', `${what} ${season(p.seasonId, 'of')} : ${fmt(p.amount)} pièces`),
      el('div', p.daysLeft === 0 ? `${career ? 'Elles seront prélevées' : 'Il sera prélevé'} ce soir.` : `${career ? 'Elles seront prélevées' : 'Il sera prélevé'} le soir du dernier jour de la saison, ${p.daysLeft === 1 ? 'demain' : `dans ${p.daysLeft} jours`}.`),
      row('Argent actuel', fmt(p.money)),
    ];
    if (p.daysLeft > 0) nodes.push(row(p.daysLeft > 1 ? `Solde des ${p.daysLeft} prochains matins` : 'Solde du prochain matin', signed(p.netTotal), p.netTotal < 0 ? 'neg' : ''));
    if (p.loanTotal) nodes.push(row('Mensualité du prêt', signed(-p.loanTotal)));
    if (p.crops > 0) nodes.push(row('Récoltes à venir (estimation)', signed(p.crops)));
    if (p.products > 0) nodes.push(row('Produits en cours (vendus aux prochaines aubes)', signed(p.products), 'pos'));
    if (p.neighbourShare > 0) nodes.push(row('Part de Joseph sur ces ventes', signed(-p.neighbourShare), 'warn'));
    nodes.push(el('div.tip-row.tip-total', el('span', 'Prévision ce soir-là'), el(`b.${p.projected >= p.amount ? 'pos' : p.state === 'loan' ? 'warn' : 'neg'}`, fmt(p.projected))));
    nodes.push(el(`div.tip-note.${p.state === 'danger' ? 'neg' : p.state === 'ok' ? 'pos' : 'warn'}`, stateText(p)));
    if (p.state === 'danger' && p.loanBlocked) nodes.push(el('div.tip-sub', p.loanBlocked));
    if (career) nodes.push(el('div.tip-sub', 'Impôts et assurance : ils grandissent avec la ferme (par terrain acheté). S\'il manque de l\'argent, les produits des ateliers puis le stock du grenier sont vendus d\'abord.'));
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

  /** « La moitié » (0,5), « Un quart »… de chaque vente pour le voisin. */
  function shareText(share) {
    if (share === 0.5) return 'La moitié';
    if (share === 0.25) return 'Un quart';
    return `${Math.round(share * 100)} %`;
  }

  /** Phrase d'état du fermage (fiche du fermage, bilan). */
  function stateText(p) {
    if (p.state === 'ok') return 'Vous avez déjà de quoi payer.';
    if (p.state === 'warn') return `Il manque encore ${fmt(p.amount - p.money)} pièces : récoltez avant ce soir-là.`;
    if (p.state === 'loan') return `Pas d'inquiétude : s'il manque un peu, Joseph pourra vous avancer environ ${fmt(p.lend)} pièces${p.surchargePct ? ` (à lui rendre avec ${p.surchargePct} % de plus)` : ''}. Récoltez pour ne pas en avoir besoin !`;
    if (career) {
      return game?.state.career?.difficulty === 'classique'
        ? 'Attention : sans assez d\'argent ce soir-là, la ferme sera vendue ! Récoltez, vendez du stock.'
        : 'Au rythme actuel, la caisse sera vide : une passe difficile s\'annonce (employés et machines à l\'arrêt un moment). Récoltez, vendez du stock !';
    }
    return 'Attention : au rythme actuel, vous ne pourrez pas payer. Faillite en vue !';
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
    let plantable = null; // calculé une seule fois (et seulement s'il sert) : grande ferme = 100+ parcelles
    for (const p of game.query.plots()) {
      if (!p.cropId) continue;
      if (p.mature) crops += p.harvestValue || 0;
      else if (p.daysLeft <= daysLeft && !p.willFreeze) {
        if (!plantable) plantable = new Map(game.query.plantableCrops().map((x) => [x.id, x]));
        const c = plantable.get(p.cropId);
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
    // Mode détente : tant qu'on doit de l'argent à Joseph, une part des ventes lui revient.
    const nl = f.neighbourLoan;
    const neighbourShare = nl && nl.debt > 0 ? Math.min(nl.debt, Math.ceil((crops + products) * nl.repayShare)) : 0;
    const projected = f.money + netTotal - loanTotal + crops + products - neighbourShare;
    let state = f.money >= bill.amount + loanTotal - Math.min(0, netTotal) ? 'ok' : projected >= bill.amount ? 'warn' : 'danger';
    // Le compte n'y sera pas, mais Joseph avancera ce qui manque : état rassurant (orange), pas le rouge.
    // Rouge seulement si ce serait vraiment la faillite (dette en cours, ou manque au-delà de son plafond).
    let lend = 0;
    let loanBlocked = null;
    if (state === 'danger' && nl) {
      const missing = bill.amount - projected;
      const last = bill.seasonId === 'winter';
      if (nl.available && missing <= nl.maxMissing) {
        state = 'loan';
        lend = missing + (last ? 0 : nl.cushion);
      } else if (!nl.available) {
        loanBlocked = `Vous devez encore ${fmt(nl.debt)} pièces à Joseph : il ne pourra pas vous aider cette fois. Récoltez, ou remboursez-le dans le ${career ? 'Carnet' : 'Bilan'}.`;
      } else {
        loanBlocked = `Joseph peut avancer au plus ${fmt(nl.maxMissing)} pièces ; il en manquerait ${fmt(missing)}.`;
      }
    }
    return { amount: bill.amount, daysLeft, seasonId: bill.seasonId, money: f.money, netTotal, loanTotal, crops, products, neighbourShare, projected, state, lend, loanBlocked, rentAutoSell: !!f.rentAutoSell, surchargePct: nl ? Math.round((nl.surcharge || 0) * 100) : 0 };
  }

  // ── Mises à jour ──────────────────────────────────────────────────────────────
  function refresh() {
    if (!game) return;
    const c = game.query.calendar();
    const w = game.query.forecast();
    targetMoney = game.state.money;

    setIcon(seasonIcon, c.seasonId);
    setText(dateYear, career ? `An ${game.state.time.year} ·` : '');
    setText(dateSeason, c.seasonName);
    setText(dateDay, ` ${c.dayOfSeason}/${c.seasonLength}`);
    if (career) refreshRank();
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
    else if (status === 'bankrupt') setText(billDays, career ? 'impayées' : 'impayé');
    else setText(billDays, p.daysLeft === 0 ? 'ce soir !' : p.daysLeft === 1 ? 'demain' : `dans ${p.daysLeft} j`);
    bill.setAttribute('aria-label', `${career ? 'Charges de saison' : 'Fermage'} : ${fmt(p.amount)} pièces, ${billDays.textContent}`);
    const state = status === 'victory' ? 'ok' : status === 'bankrupt' ? 'danger' : p.state;
    bill.classList.toggle('is-ok', state === 'ok');
    bill.classList.toggle('is-warn', state === 'warn' || state === 'loan');
    bill.classList.toggle('is-loan', state === 'loan');
    bill.classList.toggle('is-danger', state === 'danger');
    // Pas d'alarme qui clignote quand Joseph couvrira le manque : le jeu reste calme.
    bill.classList.toggle('is-urgent', status === 'playing' && p.daysLeft <= 1 && (p.state === 'warn' || p.state === 'danger'));

    const sp = game.state.speed;
    setIcon(speedIcon, sp === 0 ? 'pause' : sp === 1 ? 'play' : sp === 2 ? 'fast' : 'faster');
    setText(speedLabel, sp === 0 ? 'Pause' : `×${sp}`);
    speedBtn.dataset.speed = String(sp);
    speedBtn.setAttribute('aria-label', sp === 0 ? 'En pause : toucher pour reprendre' : `Vitesse ×${sp} : toucher pour changer`);
    root.classList.toggle('is-paused', sp === 0);
    app.tooltip?.refresh(money);
    app.tooltip?.refresh(bill);
  }

  /** Carrière : blason du rang et barre de patrimoine vers le rang suivant. */
  function refreshRank() {
    let sum = null;
    try {
      sum = game.query.career.summary();
    } catch {
      sum = null;
    }
    if (!sum) return;
    if (shownRank !== sum.rank) {
      shownRank = sum.rank;
      rankIconBox.replaceChildren(spriteAny([`icon.career.rank.${sum.rank}`], 'sprite--sm', 'star'));
    }
    const n = sum.nextRank;
    let k = 1;
    if (n) {
      const parts = [Math.min(1, Math.max(0, sum.patrimony / Math.max(1, n.patrimony)))];
      for (const o of n.objectives || []) parts.push(o.done ? 1 : Math.min(1, (o.progress || 0) / Math.max(1, o.target || 1)));
      k = parts.reduce((a, b) => a + b, 0) / parts.length;
    }
    rankFill.style.transform = `scaleX(${k.toFixed(3)})`;
    rankCell.classList.toggle('is-ready', !!n && k >= 0.999);
    rankCell.setAttribute('aria-label', n ? `${sum.rankName} : ${Math.round(k * 100)} % du chemin vers « ${n.name} »` : `${sum.rankName} : rang maximal`);
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
    career = g.mode === 'career';
    shownRank = null;
    root.classList.toggle('is-career', career);
    rankCell.hidden = !career;
    bill.querySelector('.hud-line--big .ico')?.setAttribute('data-kind', career ? 'charges' : 'rent');
    shownMoney = g.state.money;
    targetMoney = g.state.money;
    shownInt = null;
    shownDay = -1;
    moneyPops.textContent = '';
    refresh();
    frame(0);
  }

  function onEvent(ev) {
    if (app.sheets?.current?.startsWith('info-') && ['moneyChanged', 'dawn', 'weather', 'productSold', 'processingStarted', 'processingSoldRaw', 'contestProgress', 'loanRepayment', 'neighbourLoan'].includes(ev.type)) refreshInfo();
    if (ev.type === 'moneyChanged') {
      targetMoney = ev.money;
      if (ev.delta) popDelta(ev.delta);
      if (career) bumpSoft();
      else {
        money.classList.remove('is-bump');
        void money.offsetWidth;
        money.classList.add('is-bump');
      }
    }
  }

  // Carrière : l'équipe et les machines font bouger l'argent plusieurs fois par seconde. Relancer l'animation
  // en lisant offsetWidth forçait une mise en page à chaque fois : ici au plus 3 fois par seconde, et la classe
  // est remise à l'image suivante (aucune lecture de mise en page).
  let bumpAt = 0;
  let bumpQueued = false;
  function bumpSoft() {
    const now = performance.now();
    if (bumpQueued || now - bumpAt < 330) return;
    bumpAt = now;
    bumpQueued = true;
    money.classList.remove('is-bump');
    requestAnimationFrame(() => {
      bumpQueued = false;
      money.classList.add('is-bump');
    });
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

  return { bind, refresh, frame, onEvent, refreshMute, projection, stateText, openInfo, el: root };
}
