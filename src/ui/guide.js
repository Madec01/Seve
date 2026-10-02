// « Guide de la ferme » (lot 1 « confort », E5 / A10) : tout ce que le tutoriel et les conseils
// expliquent, à relire quand on veut, en français facile (phrases courtes, un mot difficile = une
// explication). Ouvert depuis le menu Pause (niveaux et carrière), le Carnet (carrière) et la feuille
// « Messages ».
//
// openGuide(app, { topic }) → ouvre la feuille 'guide' (sections repliables, la première ouverte ;
// `topic` : id d'une section à ouvrir, ex. 'words' pour les mots de la ferme).
// GUIDE_SECTIONS, GLOSSARY : textes (exportés pour les tests et la doc).

import { el } from './dom.js';
import { icon } from './icons.js';
import { HINTS } from './hints.js';

/** Mots de la ferme expliqués simplement. mode : 'levels' | 'career' | 'both'. */
export const GLOSSARY = [
  { word: 'Fermage', mode: 'levels', text: 'Le loyer de la ferme. On le paie le dernier soir de chaque saison.' },
  { word: 'Charges de saison', mode: 'career', text: 'Le loyer de la ferme et de vos terrains. On le paie le dernier soir de chaque saison. Plus la ferme est grande, plus il est cher.' },
  { word: 'Charges du jour', mode: 'both', text: 'Ce que la ferme coûte chaque matin : l\'entretien, les salaires, le carburant.' },
  { word: 'Entretien', mode: 'both', text: 'Le soin des animaux et des bâtiments. Il coûte un peu chaque jour.' },
  { word: 'Patrimoine', mode: 'career', text: 'Tout ce que vaut votre ferme : votre argent, vos terrains, et la moitié du prix de vos bâtiments, machines et animaux. On enlève vos dettes.' },
  { word: 'Rang', mode: 'career', text: 'La taille de votre ferme, de 1 à 6. Il monte quand le patrimoine est assez grand et que les objectifs sont faits. Chaque rang débloque des choses.' },
  { word: 'Cours', mode: 'career', text: 'Le prix du marché pour une culture, ce jour-là. « ×1,2 » veut dire 20 % plus cher que d\'habitude.' },
  { word: 'Hors saison', mode: 'career', text: 'Une récolte vendue hors de sa saison (grâce à la serre ou au grenier) se vend plus cher.' },
  { word: 'Grenier', mode: 'career', text: 'Un bâtiment pour garder vos récoltes. Vous les vendez plus tard, quand le cours remonte.' },
  { word: 'Atelier', mode: 'both', text: 'Il transforme une récolte en produit plus cher : confiture, fromage… Le produit se vend tout seul le matin.' },
  { word: 'Vendre en l\'état', mode: 'both', text: 'Vendre tout de suite ce qui est dans l\'atelier, sans attendre. On reçoit le prix de la récolte, pas celui du produit.' },
  { word: 'Plan de culture', mode: 'career', text: 'Ce que le semoir et les jardiniers sèment sur un champ, saison par saison.' },
  { word: 'Congé', mode: 'career', text: 'Un employé en congé ne travaille pas. Il n\'est pas payé. Pratique en hiver.' },
  { word: 'Chômage technique', mode: 'career', text: 'Quand la caisse est vide, l\'équipe s\'arrête et n\'est pas payée. Tout reprend quand l\'argent revient.' },
  { word: 'Carburant', mode: 'career', text: 'Ce que les machines à moteur consomment les jours où elles travaillent.' },
  { word: 'Dette', mode: 'both', text: 'L\'argent que vous devez à Joseph. Une partie de vos ventes le rembourse toute seule. Vous pouvez aussi le rembourser plus tôt.' },
  { word: 'Faillite', mode: 'both', text: 'En mode Classique : si vous ne pouvez pas payer, la partie s\'arrête. En mode Détente, il n\'y a jamais de faillite.' },
  { word: 'Détente et Classique', mode: 'both', text: 'Les deux façons de jouer. Détente : Joseph vous aide, rien n\'est perdu. Classique : un vrai défi.' },
  { word: 'Gel', mode: 'both', text: 'Le premier matin d\'hiver, les cultures fragiles meurent. Récoltez-les avant. Le navet et le chou résistent.' },
  { word: 'Sol fatigué', mode: 'levels', text: 'Dans certains niveaux, replanter la même culture au même endroit donne moins. Changez de culture.' },
  { word: 'Étoiles', mode: 'levels', text: 'Gagnées en finissant un niveau avec assez d\'argent. Elles achètent des bonus dans la grange.' },
  { word: 'Écus', mode: 'both', text: 'Gagnés en jouant (succès, fin d\'année, quêtes). Ils achètent des décorations pour la ferme.' },
];

/** Sections du guide. mode : 'levels' | 'career' | 'both' ; lines : phrases courtes. */
export const GUIDE_SECTIONS = [
  {
    id: 'gestures',
    title: 'Les gestes',
    icon: 'harvest',
    mode: 'both',
    lines: [
      'Touchez une parcelle vide : vous choisissez une graine.',
      'Touchez une culture : vous l\'arrosez.',
      'Touchez une culture mûre : vous la récoltez. L\'argent arrive tout de suite.',
      'Glissez le doigt sur le champ : vous arrosez ou récoltez plusieurs parcelles d\'un coup.',
      'Appui long (gardez le doigt posé) sur une parcelle ou un bâtiment : sa fiche, pour tout savoir.',
      '« Semer partout » : la même graine sur toutes les parcelles libres. Le jeu se souvient de votre choix.',
      'Glissez ailleurs que sur le champ : la vue se déplace.',
    ],
  },
  {
    id: 'time',
    title: 'Le temps',
    icon: 'calendar',
    mode: 'both',
    lines: [
      'Une journée dure 20 secondes à la vitesse normale.',
      'Le bouton de vitesse change la vitesse ; un appui long met en pause.',
      'Le temps ne passe que quand vous jouez. Quand vous quittez, la ferme attend.',
      'La partie est sauvegardée chaque matin et quand vous quittez.',
    ],
  },
  {
    id: 'todo',
    title: 'La ligne « À faire »',
    icon: 'info',
    mode: 'both',
    lines: [
      'En bas de l\'écran, une ligne dit la chose la plus utile à faire maintenant.',
      'Touchez-la : le jeu vous montre l\'endroit, ou ouvre la bonne fiche.',
      'La cloche à droite ouvre les messages : les derniers messages du jeu, à relire.',
      'Chaque matin, un petit résumé dit ce que la journée d\'hier a rapporté.',
    ],
  },
  {
    id: 'crops',
    title: 'Les cultures',
    icon: 'seed',
    mode: 'both',
    lines: [
      'Chaque culture pousse en quelques jours. La fiche des graines dit combien.',
      'Arrosée, une culture pousse plus vite. Il faut arroser chaque jour.',
      'La pluie arrose pour vous.',
      '« Gain par jour » : ce que la culture rapporte, divisé par ses jours de pousse. Plus c\'est grand, mieux c\'est.',
      'L\'hiver, le gel tue les cultures fragiles. Récoltez avant. Le navet et le chou résistent au froid.',
      'Le pommier reste toute l\'année : pas d\'arrosage, pas de gel. Il donne des pommes en été et en automne.',
    ],
  },
  {
    id: 'money',
    title: 'L\'argent et le fermage',
    icon: 'bill',
    mode: 'levels',
    lines: [
      'Le fermage, c\'est le loyer de la ferme. On le paie le dernier soir de chaque saison.',
      'La barre du haut montre combien et dans combien de jours. Elle dit aussi si votre argent suffira.',
      'Gardez toujours de quoi payer le fermage avant d\'acheter.',
      'En mode Détente, s\'il manque de l\'argent, Joseph vous l\'avance. Une partie de vos ventes le rembourse ensuite.',
      'Payez le fermage de l\'hiver : l\'année est gagnée. Plus il vous reste d\'argent, plus vous gagnez d\'étoiles.',
    ],
  },
  {
    id: 'invest',
    title: 'Acheter',
    icon: 'coin',
    mode: 'levels',
    lines: [
      'L\'onglet « Acheter » montre les bâtiments et les animaux.',
      'Un poulailler, une ruche, une vache… rapportent un peu chaque matin, même en hiver.',
      'Un atelier transforme vos récoltes en produits plus chers.',
      'L\'arrosage automatique arrose vos cultures chaque matin.',
    ],
  },
  {
    id: 'career',
    title: 'Ma ferme (carrière)',
    icon: 'star',
    mode: 'career',
    lines: [
      'Votre ferme dure plusieurs années. Elle grandit petit à petit.',
      'Chaque saison, il faut payer les charges de saison (le loyer de la ferme et des terrains).',
      'La forêt autour de la ferme est à vendre, terrain par terrain : onglet « Acheter », ou touchez un panneau « À vendre ».',
      'Un terrain acheté devient un champ, un pré pour les animaux, un verger, une cour d\'ateliers…',
      'Le Carnet montre les objectifs du prochain rang. Chaque rang débloque de nouvelles choses.',
    ],
  },
  {
    id: 'animals',
    title: 'Les animaux',
    icon: 'harvest',
    mode: 'career',
    lines: [
      'Les abris (poulailler, étable…) gardent les produits des animaux pendant 3 jours.',
      'Touchez un abri pour ramasser. Glissez le doigt sur plusieurs abris : vous ramassez tout.',
      'Le bouton « Tout ramasser » ramasse tous les abris d\'un coup.',
      'Un abri plein ne garde plus la production du jour : ramassez souvent.',
    ],
  },
  {
    id: 'team',
    title: 'L\'équipe et les machines',
    icon: 'harvest',
    mode: 'career',
    lines: [
      'Avec une maison plus grande, vous pouvez embaucher des employés (onglet « Équipe »).',
      'Chaque employé a un métier : arroser, semer, récolter, s\'occuper des animaux, vendre.',
      'Les employés sont payés chaque jour. En hiver, mettez-les en congé.',
      'Les machines travaillent seules chaque jour. Leur interrupteur est dans la fiche du terrain.',
      'Récolter à la main rapporte un peu plus.',
    ],
  },
  {
    id: 'visitors',
    title: 'Visiteurs, commandes et Joseph',
    icon: 'calendar',
    mode: 'career',
    lines: [
      'Des visiteurs passent avec une commande ou un objet à vendre.',
      'Leur proposition reste dans le Carnet (page « Agenda ») et dans la ligne « À faire » tant qu\'elle est valable.',
      'Refuser ne coûte rien. Si c\'est raté, ce n\'est pas grave.',
      'Joseph, votre voisin, demande parfois un service (une quête). Il paie bien, et votre amitié grandit (♥).',
      'Des corbeaux peuvent se poser sur une parcelle. Touchez-la pour les chasser, sinon la récolte vaut moitié moins.',
      'Chaque automne, le comice agricole juge trois épreuves.',
    ],
  },
];

function sectionNode(app, s, openIds) {
  const id = `guide-${s.id}`;
  const isOpen = openIds.has(s.id);
  const body = el('div.guide-body', { id: `${id}-body`, hidden: !isOpen }, s.node || el('ul.guide-lines', s.lines.map((t) => el('li', t))));
  const head = el(
    'button.guide-head',
    {
      type: 'button',
      id,
      'aria-expanded': isOpen ? 'true' : 'false',
      'aria-controls': `${id}-body`,
      onclick: (e) => {
        const btn = e.currentTarget;
        const on = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', on ? 'true' : 'false');
        body.hidden = !on;
        app.audio.play('page', { volume: 0.5 });
      },
    },
    icon(s.icon || 'info', 'sm'),
    el('span.guide-head-label', s.title),
    el('span.guide-chevron', { 'aria-hidden': 'true' }, '›'),
  );
  return el('section.guide-sec', head, body);
}

/** Contenu du guide pour le mode en cours (niveaux ou carrière). */
export function guideContent(app, { topic = null } = {}) {
  const career = app.game?.mode === 'career';
  const fits = (m) => m === 'both' || (career ? m === 'career' : m === 'levels');
  const sections = GUIDE_SECTIONS.filter((s) => fits(s.mode)).map((s) => ({ ...s }));
  sections.push({
    id: 'words',
    title: 'Les mots de la ferme',
    icon: 'info',
    node: el('dl.guide-words', GLOSSARY.filter((g) => fits(g.mode)).flatMap((g) => [el('dt', g.word), el('dd', g.text)])),
  });
  const hints = Object.entries(HINTS).filter(([id]) => (career ? id.startsWith('career.') || ['processing', 'processingBought', 'tree'].includes(id) : !id.startsWith('career.')));
  sections.push({
    id: 'hints',
    title: 'Les conseils de Joseph',
    icon: 'star',
    node: el('ul.guide-hints', hints.map(([, h]) => el('li', el('b', h.title), el('span', h.text)))),
  });
  const openIds = new Set([topic && sections.some((s) => s.id === topic) ? topic : sections[0].id]);
  return el(
    'div.guide',
    el('p.sheet-hint.guide-intro', 'Tout ce qu\'il faut savoir, en phrases courtes. Touchez un titre pour l\'ouvrir.'),
    sections.map((s) => sectionNode(app, s, openIds)),
  );
}

export function openGuide(app, { topic = null } = {}) {
  if (!app.game || app.inMenu) return;
  if (app.dialogs.isOpen()) app.dialogs.closeAll();
  app.sheets.open({ id: 'guide', kind: 'panel', tall: true, title: 'Guide de la ferme', icon: icon('info', 'md'), content: guideContent(app, { topic }) });
  app.audio.play('page', { volume: 0.5 });
  if (topic) requestAnimationFrame(() => document.getElementById(`guide-${topic}`)?.scrollIntoView({ block: 'start' }));
}
