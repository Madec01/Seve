// Mode Carrière — offres (visiteur acheteur, marchand ambulant, animal perdu, cadeau) et quêtes de
// Joseph (§ 8.2, § 8.3, § 10.8) : petites feuilles (illustration, texte de 2 lignes, 2 boutons pleine
// largeur ≥ 56 px) et cartes du Carnet. Les formes viennent du lot CORE-C (docs/ARCHITECTURE.md) ;
// tout champ absent est remplacé par un texte neutre.

import { el, fmt, plural } from '../dom.js';
import { icon, spriteAny } from '../icons.js';
import { cropCount } from '../text.js';
import { bar, cIcon, cropIcon, joseph, josephSays } from './util.js';

const OFFER_TITLES = {
  visitor: 'Un visiteur',
  order: 'Une commande',
  merchant: 'Marchand ambulant',
  stray: 'Un animal perdu',
  adoption: 'Un animal perdu',
  gift: 'Cadeau de Joseph',
};

export function offerTitle(o) {
  return o?.title || o?.data?.title || OFFER_TITLES[o?.kind] || 'Une proposition';
}

const idOf = (o) => o.offerId ?? o.id;

/** Texte d'une offre (celui du cœur, sinon reconstruit depuis ses données). */
export function offerText(o) {
  const d = o.data || {};
  if (o.text || d.text) return o.text || d.text;
  if ((o.kind === 'visitor' || o.kind === 'order') && d.cropId) return `${d.name || 'Une cliente'} voudrait ${cropCount(d.cropId, d.n || d.count || 1)}, payées ×${String(d.factor || 1.5).replace('.', ',')}.`;
  if (o.kind === 'merchant') return `${d.item?.name || d.name || 'Un objet'} pour ${fmt(d.price || d.cost || 0)} pièces, aujourd'hui seulement.`;
  return 'Une proposition pour votre ferme.';
}

function offerIcon(o) {
  const d = o.data || {};
  if (o.icon && !String(o.icon).startsWith('icon.')) return spriteAny([o.icon], 'sprite--card', 'star');
  if (d.cropId) return cropIcon(d.cropId, 'sprite--card');
  if (o.kind === 'gift') return joseph('happy', 'sprite--card');
  return cIcon(o.kind === 'merchant' ? 'coins' : o.kind === 'visitor' || o.kind === 'order' ? 'visitor' : 'event', 'sprite--card', 'star');
}

/** Carte d'une offre (Carnet, feuille) : forme offerInfo du lot CORE-C (titre, texte, détail, libellés). */
export function offerCard(ui, o, { big = false } = {}) {
  const id = idOf(o);
  const d = o.data || {};
  const accepted = !!o.accepted;
  const need = o.n ?? d.n ?? null;
  const progress = o.delivered ?? null;
  const actions = [];
  if (!accepted) {
    const can = o.canAccept !== false;
    actions.push(el(`button.btn.btn--wide${can ? '.btn--red' : '.is-disabled'}`, { type: 'button', id: `c-offer-yes-${id}`, 'aria-disabled': can ? 'false' : 'true', onclick: () => {
      if (!can) {
        ui.app.audio.play('error');
        ui.app.toasts.show({ kind: 'error', text: `Il manque ${plural((o.price || 0) - ui.game.state.money, 'pièce')}.` });
        return;
      }
      resolve(ui, 'acceptOffer', id);
    } }, o.acceptLabel || 'Accepter'));
    actions.push(el('button.btn.btn--wide', { type: 'button', id: `c-offer-no-${id}`, onclick: () => resolve(ui, 'declineOffer', id) }, o.declineLabel || 'Refuser'));
  } else if (o.canDeliver) {
    actions.push(el('button.btn.btn--red.btn--wide', { type: 'button', id: `c-offer-deliver-${id}`, onclick: () => resolve(ui, 'deliverOffer', id) }, `Livrer depuis le grenier (${fmt(Math.min(o.inStock || 0, need - (progress || 0)))})`));
  }
  return el(
    `article.c-offer${big ? '.is-big' : ''}`,
    { id: `c-offer-${id}` },
    el('div.c-offer-top', el('span.c-offer-icon', offerIcon(o)), el('div.c-offer-main', el('b', offerTitle(o)), el('p', offerText(o)))),
    accepted && need ? el('div.c-offer-prog', bar(progress || 0, need), el('small', `${fmt(progress || 0)} / ${fmt(need)}`)) : null,
    o.detail ? el('small.c-offer-detail', o.detail) : null,
    !accepted && o.daysLeft !== undefined ? el('small.c-offer-days', o.daysLeft <= 0 ? 'Aujourd\'hui seulement' : `Encore ${plural(o.daysLeft + 1, 'jour')}`) : null,
    actions.length ? el('div.c-offer-actions', actions) : null,
  );
}

function resolve(ui, action, id) {
  const res = ui.act(action, id);
  if (res?.ok) {
    ui.app.audio.play(action === 'declineOffer' ? 'click' : 'confirm', { volume: 0.7 });
    if (ui.app.sheets.current === 'c-offer') ui.app.sheets.close();
  }
}

export function offerContent(ui, id) {
  const offers = ui.q('events', null)?.offers || [];
  const o = offers.find((x) => idOf(x) === id);
  if (!o) return el('p.sheet-empty', 'Cette proposition n\'est plus d\'actualité.');
  return el('div.info-sheet.c-offer-sheet', offerCard(ui, o, { big: true }), el('p.sheet-hint', 'Rien ne se perd si vous refusez ou si c\'est raté.'));
}

// ── Quête de Joseph ─────────────────────────────────────────────────────────────
export function questCard(ui, quest) {
  const need = quest.need || {};
  const n = need.n || need.count || 1;
  const progress = Math.min(n, quest.progress || 0);
  const reward = quest.reward || {};
  const rewardText = [reward.money ? `${fmt(reward.money)} pièces` : null, reward.ecus ? `${plural(reward.ecus, 'écu')}` : null, reward.hearts ? `+${reward.hearts} ♥` : '+1 ♥'].filter(Boolean).join(' · ');
  const actions = [];
  if (!quest.accepted) {
    actions.push(el('button.btn.btn--red.btn--wide', { type: 'button', id: 'c-quest-yes', onclick: () => questAct(ui, 'acceptQuest') }, 'Accepter'));
    actions.push(el('button.btn.btn--wide', { type: 'button', id: 'c-quest-no', onclick: () => questAct(ui, 'declineQuest') }, 'Pas cette fois'));
  } else if (quest.canDeliver) {
    actions.push(el('button.btn.btn--red.btn--wide', { type: 'button', id: 'c-quest-deliver', onclick: () => questAct(ui, 'deliverQuest') }, 'Livrer depuis le grenier'));
  }
  return el(
    'article.c-quest',
    josephSays(`« ${quest.line ? `${quest.line} ` : ''}${quest.text || ''} »`.replace('«  »', '« J\'aurais besoin d\'un petit service… »'), quest.accepted ? 'content' : 'surprised'),
    quest.accepted ? el('div.c-offer-prog', bar(progress, n), el('small', `${fmt(progress)} / ${fmt(n)}`)) : null,
    el('div.c-quest-facts', el('span', icon('star', 'sm'), `Récompense : ${rewardText}`), quest.daysLeft !== undefined && quest.daysLeft !== null ? el('span', icon('calendar', 'sm'), quest.daysLeft <= 0 ? 'Dernier jour !' : `Jusqu'à la fin de la saison (${plural(quest.daysLeft, 'jour')})`) : null),
    actions.length ? el('div.c-offer-actions', actions) : null,
  );
}

function questAct(ui, action) {
  const res = ui.act(action);
  if (res?.ok) ui.app.audio.play(action === 'declineQuest' ? 'click' : 'confirm', { volume: 0.7 });
}

export function questContent(ui) {
  const quest = ui.q('quest', null);
  if (!quest) return el('div.info-sheet', josephSays('« Rien à vous demander pour l\'instant. Je repasserai à la prochaine saison ! »', 'content'));
  return el('div.info-sheet.c-quest-sheet', questCard(ui, quest), el('p.sheet-hint', 'Livraison : depuis le grenier, ou avec vos prochaines récoltes (mises de côté pour Joseph). Refuser ne coûte rien.'));
}
