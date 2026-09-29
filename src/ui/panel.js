// Panneau de droite : onglets « Investissements » (cartes d'achat) et « Bilan » (revenus,
// charges, fermages, prêt, statistiques de l'année).
//
// createPanel(root, app) → { bind(game), refresh(), onEvent(ev), setTab(id), focusInvestment(id),
//                            toggle(force), isOpen() }
// Les cartes sont construites une fois par partie puis mises à jour en place (pas de
// reconstruction du DOM à chaque événement) ; le bilan est reconstruit seulement quand son
// onglet est visible, au plus une fois par image.

import { BASE_DAILY_CHARGE, SEASONS } from '../data/balance.js';
import { CROPS } from '../data/crops.js';
import { clear, dec, el, fmt, gain, loss, plural, signed } from './dom.js';
import { cropIcon, icon, investmentIcon, seasonIncomes } from './icons.js';
import { cropCount, incomePhrase, incomeProfile, season } from './text.js';

const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export function createPanel(root, app) {
  let game = null;
  let tab = 'shop';
  let dirty = { shop: true, stats: true };
  let scheduled = false;
  const cards = new Map(); // id → { node, parts }

  // ── Structure ─────────────────────────────────────────────────────────────────
  const levelTitle = el('div.panel-level', '');
  const tabShop = el('button.tab', { type: 'button', role: 'tab', id: 'tab-shop', onclick: () => setTab('shop', true) }, icon('coin', 'sm'), el('span', 'Investissements'));
  const tabStats = el('button.tab', { type: 'button', role: 'tab', id: 'tab-stats', onclick: () => setTab('stats', true) }, icon('bill', 'sm'), el('span', 'Bilan'));
  const shopList = el('div.shop-list', { role: 'tabpanel', id: 'panel-shop' });
  const statsBody = el('div.stats', { role: 'tabpanel', id: 'panel-stats' });
  const scroller = el('div.panel-scroll', shopList, statsBody);
  const closeBtn = el('button.panel-close', { type: 'button', 'aria-label': 'Fermer le panneau', 'data-tip': 'Replier le panneau', onclick: () => toggle(false, true) }, icon('close', 'sm'));
  const inner = el('div.panel-inner', el('div.panel-head', levelTitle, closeBtn), el('div.tabs', { role: 'tablist' }, tabShop, tabStats), scroller);
  const handle = el(
    'button.panel-handle',
    { type: 'button', id: 'panel-handle', 'aria-label': 'Ouvrir le panneau Investissements et bilan', onclick: () => toggle(undefined, true) },
    icon('coin', 'md'),
    el('span.panel-handle-text', 'Ferme'),
  );
  root.append(handle, inner);

  // ── Onglets ───────────────────────────────────────────────────────────────────
  function setTab(id, fromUser = false) {
    if (fromUser && id !== tab) app.audio.play('page');
    tab = id;
    tabShop.classList.toggle('is-active', id === 'shop');
    tabStats.classList.toggle('is-active', id === 'stats');
    tabShop.setAttribute('aria-selected', id === 'shop');
    tabStats.setAttribute('aria-selected', id === 'stats');
    shopList.hidden = id !== 'shop';
    statsBody.hidden = id !== 'stats';
    scroller.scrollTop = 0;
    schedule();
  }

  function isOpen() {
    return !document.body.classList.contains('panel-collapsed');
  }

  /** Ouvre ou replie le panneau (force = true/false, ou bascule). */
  function toggle(force, fromUser = false) {
    const open = force === undefined ? !isOpen() : !!force;
    if (open === isOpen()) return;
    document.body.classList.toggle('panel-collapsed', !open);
    if (fromUser) {
      app.audio.play(open ? 'open' : 'close');
      app.settings.panelCollapsed = !open;
      app.saveSettings();
    }
    app.onLayoutChange?.();
    if (open) schedule();
  }

  // ── Cartes d'investissement ───────────────────────────────────────────────────
  function buildCards() {
    clear(shopList);
    cards.clear();
    const list = game.query.investments();
    shopList.append(
      el(
        'p.shop-intro',
        'Les investissements rapportent chaque matin, à l\'aube. Achetés tôt, ils rapportent gros ; achetés tard, ils n\'ont plus le temps de se rembourser.',
      ),
    );
    for (const inv of list) {
      const name = el('div.card-name', inv.name);
      const owned = el('span.card-owned', '');
      const desc = el('div.card-desc', inv.description);
      const stats = el('div.card-stats');
      const price = el('span.buy-price', '');
      const buyLabel = el('span.buy-label', 'Acheter');
      const buy = el(
        'button.btn.btn--buy.has-tip',
        { type: 'button', 'data-tip-side': 'left', onclick: () => onBuy(inv.id, buy) },
        buyLabel,
        el('span.buy-cost', icon('coin', 'sm'), price),
      );
      buy._tip = () => buyTip(inv.id);
      const node = el(
        'article.card',
        { dataset: { id: inv.id }, id: `card-${inv.id}` },
        el('div.card-icon', investmentIcon(inv.id, 'sprite--card')),
        el('div.card-main', el('div.card-top', name, owned), desc, stats, el('div.card-foot', buy)),
      );
      shopList.append(node);
      cards.set(inv.id, { node, owned, stats, price, buy, buyLabel });
    }
  }

  function incomeText(inv) {
    const e = inv.effects || {};
    const parts = [];
    const profile = incomeProfile(inv.incomeBySeason);
    if (profile.groups.some((g) => g.value > 0)) {
      if (profile.constant) parts.push({ label: 'Revenu', value: `+${profile.value} / jour`, cls: 'pos', tip: 'Versé chaque matin, toute l\'année.' });
      else {
        const storm = e.noIncomeOn?.includes('storm') ? ' Rien les jours d\'orage.' : '';
        parts.push({
          label: 'Revenu / jour',
          node: seasonIncomes(inv.incomeBySeason, 1, game.query.calendar().seasonId),
          wide: true,
          tip: `${capitalize(incomePhrase(inv.incomeBySeason))}.${storm}`,
        });
      }
    }
    if (e.shearing) parts.push({ label: 'Tonte', value: `+${e.shearing} en fin de saison`, cls: 'pos', tip: 'Versée à l\'aube du dernier jour du printemps, de l\'été et de l\'automne (pas en hiver), juste avant le fermage.' });
    if (e.growthBonus) parts.push({ label: 'Pousse', value: `+${Math.round(e.growthBonus * 100)} % (hors hiver)`, cls: 'pos' });
    if (e.priceBonus) parts.push({ label: 'Ventes', value: `+${Math.round(e.priceBonus * 100)} %`, cls: 'pos', tip: 'Toutes vos récoltes se vendent plus cher.' });
    if (e.chargeReduction) parts.push({ label: 'Charges', value: `−${e.chargeReduction} / jour`, cls: 'pos', tip: 'Les charges quotidiennes ne descendent jamais sous zéro.' });
    if (e.waterPlots) {
      const lvl = inv.owned;
      const next = e.waterPlots[Math.min(lvl, e.waterPlots.length - 1)];
      const cur = lvl > 0 ? e.waterPlots[lvl - 1] : 0;
      const label = (n) => (n === null ? 'tout le champ' : `${n} parcelles`);
      parts.push({ label: 'Arrose', value: lvl > 0 ? label(cur) : label(next), cls: 'pos' });
      if (lvl > 0 && lvl < inv.max) parts.push({ label: 'Niveau suivant', value: label(next) });
    }
    if (inv.upkeep) parts.push({ label: 'Entretien', value: `−${inv.upkeep} / jour${inv.kind === 'upgrade' ? '' : ' chacun'}`, cls: 'neg' });
    return parts;
  }

  function buyTip(id) {
    const inv = game?.query.investments().find((i) => i.id === id);
    if (!inv) return null;
    if (inv.canBuy) return `Acheter ${inv.kind === 'upgrade' ? 'le niveau suivant' : 'une unité'} pour ${fmt(inv.nextCost)} pièces`;
    return inv.reason;
  }

  function updateCards() {
    const list = game.query.investments();
    for (const inv of list) {
      const c = cards.get(inv.id);
      if (!c) continue;
      const maxed = inv.nextCost === null;
      c.owned.textContent = inv.kind === 'upgrade' ? `Niveau ${inv.owned}/${inv.max}` : `${inv.owned}/${inv.max}`;
      c.owned.classList.toggle('is-some', inv.owned > 0);
      clear(c.stats);
      for (const p of incomeText(inv)) {
        const s = el(`span.stat${p.wide ? '.stat--wide' : ''}`, el('span.stat-label', p.label), p.node || el(`b${p.cls ? `.${p.cls}` : ''}`, p.value));
        if (p.tip) s.dataset.tip = p.tip;
        c.stats.append(s);
      }
      c.price.textContent = maxed ? '' : fmt(inv.nextCost);
      c.buyLabel.textContent = maxed ? (inv.kind === 'upgrade' ? 'Niveau max' : 'Complet') : inv.owned > 0 ? (inv.kind === 'upgrade' ? 'Améliorer' : 'Encore un') : 'Acheter';
      c.buy.querySelector('.buy-cost').hidden = maxed;
      c.buy.classList.toggle('is-disabled', !inv.canBuy);
      c.buy.setAttribute('aria-disabled', inv.canBuy ? 'false' : 'true');
      c.node.classList.toggle('is-maxed', maxed);
      c.node.classList.toggle('is-owned', inv.owned > 0);
      c.node.classList.toggle('is-affordable', inv.canBuy);
      app.tooltip?.refresh(c.buy);
    }
  }

  function onBuy(id, button) {
    const res = app.buyInvestment(id);
    if (res && res.ok) {
      button.classList.remove('is-flash');
      void button.offsetWidth;
      button.classList.add('is-flash');
    }
  }

  /** Ouvre le panneau sur la carte d'un investissement (clic dans la scène). */
  function focusInvestment(id) {
    toggle(true);
    setTab('shop');
    flush();
    const c = cards.get(id);
    if (!c) return;
    c.node.scrollIntoView({ block: 'nearest', behavior: document.documentElement.classList.contains('reduced-motion') ? 'auto' : 'smooth' });
    c.node.classList.remove('is-focus');
    void c.node.offsetWidth;
    c.node.classList.add('is-focus');
  }

  // ── Bilan ─────────────────────────────────────────────────────────────────────
  function section(title, ...children) {
    return el('section.stats-section', el('h3.stats-title', title), children);
  }

  function line(label, value, cls = '', tip = null) {
    if (value === '0') cls = 'mid';
    const n = el('div.stats-line', el('span.stats-label', label), el(`b.stats-value${cls ? `.${cls}` : ''}`, value));
    if (tip) n.dataset.tip = tip;
    return n;
  }

  function buildStats() {
    clear(statsBody);
    const q = game.query;
    const f = q.finance();
    const cal = q.calendar();
    const lvl = q.level();
    const invs = q.investments();
    const sum = q.summary();

    // Aujourd'hui : revenus et charges
    const incomeLines = [];
    for (const inv of invs) {
      if (!inv.owned) continue;
      const units = inv.kind === 'upgrade' ? 1 : inv.owned;
      const amount = (inv.income || 0) * units;
      if (amount > 0) incomeLines.push(line(`${inv.name}${units > 1 ? ` ×${units}` : ''}`, gain(amount), 'pos'));
    }
    const chargeLines = [line('Entretien de la ferme', `−${BASE_DAILY_CHARGE}`, 'neg')];
    let solar = 0;
    for (const inv of invs) {
      if (!inv.owned) continue;
      const units = inv.kind === 'upgrade' ? 1 : inv.owned;
      if (inv.upkeep) chargeLines.push(line(`Entretien : ${inv.name.toLowerCase()}${units > 1 ? ` ×${units}` : ''}`, loss(inv.upkeep * units), 'neg'));
      if (inv.effects?.chargeReduction) solar += inv.effects.chargeReduction * units;
    }
    if (solar) chargeLines.push(line('Panneaux solaires', gain(solar), 'pos', 'Les charges ne descendent jamais sous zéro.'));
    statsBody.append(
      section(
        `Chaque matin ${season(cal.seasonId, 'in')}`,
        incomeLines.length ? incomeLines : el('p.stats-empty', 'Aucun revenu automatique pour l\'instant : achetez un investissement.'),
        chargeLines,
        el('div.stats-total', line('Solde quotidien estimé', `${signed(f.net)} / jour`, f.net >= 0 ? 'pos' : 'neg')),
        f.priceBonus ? el('p.stats-note', `Vos récoltes se vendent ${Math.round(f.priceBonus * 100)} % plus cher grâce à l'étal.`) : null,
        f.waterCost ? el('p.stats-note', `Chaque arrosage coûte ${plural(f.waterCost, 'pièce')}, même automatique.`) : null,
      ),
    );

    // Fermages de l'année
    const proj = app.hud.projection();
    const rentRows = SEASONS.map((s, i) => {
      const status = i < cal.seasonIndex ? 'paid' : i === cal.seasonIndex ? 'current' : 'next';
      const label = status === 'paid' ? 'payé' : status === 'current' ? (proj.daysLeft === 0 ? 'ce soir' : `dans ${plural(proj.daysLeft, 'jour')}`) : `${plural(lvl.seasonLengths[i], 'jour')}`;
      return el(
        `div.rent-row.is-${status}`,
        icon(s, 'sm'),
        el('span.rent-season', season(s)),
        el('span.rent-status', label),
        el('b.rent-amount', fmt(lvl.rents[i])),
      );
    });
    statsBody.append(
      section(
        'Fermages de l\'année',
        el('div.rent-table', rentRows),
        el(
          `p.stats-note.is-${proj.state}`,
          proj.state === 'ok'
            ? 'Le prochain fermage est couvert.'
            : proj.state === 'warn'
              ? `Prévision au soir du fermage : ${fmt(proj.projected)} pièces (récoltes comprises).`
              : `Prévision au soir du fermage : ${fmt(proj.projected)} pièces. Il manque ${fmt(proj.amount - proj.projected)} pièces !`,
        ),
      ),
    );

    // Prêt
    if (f.loan) {
      statsBody.append(
        section(
          'Prêt de la banque',
          line('Mensualité', `${fmt(f.loan.payment)} tous les ${f.loan.every} jours`),
          line('Prochaine mensualité', f.loan.nextInDays === null ? 'aucune' : f.loan.nextInDays === 0 ? 'aujourd\'hui' : `dans ${plural(f.loan.nextInDays, 'jour')}`, f.loan.nextInDays !== null && f.loan.nextInDays <= 1 ? 'neg' : ''),
          line('Reste à rembourser', `${fmt(f.loan.remaining)} (${plural(f.loan.paymentsLeft, 'mensualité')})`),
        ),
      );
    }

    // Marché
    if (lvl.modifiers.priceVolatility) {
      const crops = q.plantableCrops();
      const all = CROPS.filter((c) => !lvl.crops || lvl.crops.includes(c.id));
      statsBody.append(
        section(
          'Cours du marché aujourd\'hui',
          el(
            'div.market',
            all.map((c) => {
              const m = game.state.market?.[c.id] ?? 1;
              const plantable = crops.some((p) => p.id === c.id);
              return el(
                `div.market-row${plantable ? '' : '.is-dim'}`,
                cropIcon(c.id, 'sprite--sm'),
                el('span', c.name),
                el(`b.${m >= 1.15 ? 'pos' : m <= 0.85 ? 'neg' : 'mid'}`, `×${dec(m)}`),
              );
            }),
          ),
          el('p.stats-note', 'Le cours change chaque matin et revient vite vers ×1.'),
        ),
      );
    }

    // Bilan de l'année
    const spent = sum.seedsSpent + sum.investmentsSpent + sum.plotsSpent;
    const harvested = Object.entries(sum.cropsHarvested).filter(([, n]) => n > 0);
    statsBody.append(
      section(
        'Depuis le début de l\'année',
        line('Récoltes vendues', gain(sum.harvestIncome), 'pos'),
        line('Revenus des investissements', gain(sum.investmentIncome), 'pos'),
        line('Charges quotidiennes', loss(sum.charges), 'neg'),
        sum.waterSpent ? line('Arrosage', loss(sum.waterSpent), 'neg') : null,
        sum.loanPaid ? line('Prêt remboursé', loss(sum.loanPaid), 'neg') : null,
        line('Fermages payés', loss(sum.rentsPaid), 'neg'),
        line('Achats (graines, parcelles, investissements)', loss(spent), 'neg', `Graines ${fmt(sum.seedsSpent)} · Parcelles ${fmt(sum.plotsSpent)} · Investissements ${fmt(sum.investmentsSpent)}`),
        el('div.stats-total', line('Bilan', signed(sum.net), sum.net >= 0 ? 'pos' : 'neg')),
        harvested.length
          ? el(
              'div.harvest-list',
              harvested.map(([id, n]) => el('span.harvest-chip.has-tip', { 'data-tip': cropCount(id, n) }, cropIcon(id, 'sprite--sm'), el('b', `×${n}`))),
            )
          : el('p.stats-empty', 'Aucune récolte pour l\'instant.'),
        sum.cropsLost.frost || sum.cropsLost.rot
          ? el(
              'p.stats-note.is-danger',
              [sum.cropsLost.frost ? `${plural(sum.cropsLost.frost, 'culture')} gelée${sum.cropsLost.frost > 1 ? 's' : ''}` : null, sum.cropsLost.rot ? `${plural(sum.cropsLost.rot, 'culture')} pourrie${sum.cropsLost.rot > 1 ? 's' : ''}` : null]
                .filter(Boolean)
                .join(' · '),
            )
          : null,
      ),
    );

    // Objectifs du niveau
    const [t2, t3] = lvl.starThresholds;
    statsBody.append(
      section(
        'Objectifs',
        el('div.goal', icon('star', 'sm'), el('span', 'Payer les quatre fermages')),
        el('div.goal', icon('star', 'sm'), icon('star', 'sm'), el('span', `Finir l'année avec ${fmt(t2)} pièces`)),
        el('div.goal', icon('star', 'sm'), icon('star', 'sm'), icon('star', 'sm'), el('span', `Finir l'année avec ${fmt(t3)} pièces`)),
      ),
    );
  }

  // ── Mises à jour groupées ─────────────────────────────────────────────────────
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flush);
  }

  function flush() {
    scheduled = false;
    if (!game) return;
    if (dirty.shop) {
      updateCards();
      dirty.shop = false;
    }
    if (tab === 'stats' && dirty.stats && isOpen()) {
      const top = scroller.scrollTop;
      buildStats();
      scroller.scrollTop = top;
      dirty.stats = false;
    }
  }

  function refresh() {
    dirty = { shop: true, stats: true };
    schedule();
  }

  function bind(g) {
    game = g;
    const lvl = g.query.level();
    clear(levelTitle);
    levelTitle.append(el('span.panel-level-num', `Niveau ${lvl.id}`), el('span.panel-level-name', lvl.name));
    buildCards();
    setTab('shop');
    refresh();
  }

  function onEvent(ev) {
    // Toute modification d'argent ou de saison peut changer l'état des boutons et le bilan.
    if (['moneyChanged', 'purchased', 'dawn', 'seasonStart', 'harvested', 'planted', 'watered', 'plotUnlocked', 'frost', 'rot', 'billPaid', 'bankrupt', 'victory'].includes(ev.type)) refresh();
  }

  setTab('shop');

  return {
    bind,
    refresh,
    onEvent,
    setTab,
    focusInvestment,
    toggle,
    isOpen,
    get tab() {
      return tab;
    },
    cardOf: (id) => cards.get(id)?.node || null,
  };
}

