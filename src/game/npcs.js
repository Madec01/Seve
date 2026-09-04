// Les personnages. Ils ne parlent pas : ils émettent. Chaque timbre est décrit
// ici, le synthétiseur s'occupe de la matière sonore.

export const NPCS = {
  pepin: {
    id: 'pepin', name: 'Pépin',
    color: '#8fce6a', accent: '#d7f5b8',
    voice: { base: 520, spread: 260, speed: 15, wobble: 0.55, timbre: 'clair' },
    size: 0.55,
    role: 'guide',
    intro: [
      'ÇA POUSSE ! ÇA POUSSE !',
      'Oh. Oh ! Tu es la Luthière ? La vraie ?',
      'Le Réseau s’est tu avant ma naissance. Je n’ai jamais entendu un accord.',
      'Tu vas m’en jouer un ? Dis. Dis dis dis.',
    ],
  },
  bourdon: {
    id: 'bourdon', name: 'Bourdon',
    color: '#f0a24a', accent: '#ffd79a',
    voice: { base: 145, spread: 60, speed: 7, wobble: 0.3, timbre: 'grave' },
    size: 0.95,
    role: 'marchand',
    intro: [
      'Mmmh. Encore quelqu’un qui croit qu’on répare une forêt avec de la volonté.',
      'On la répare avec de la sève. Et avec du temps. J’ai les deux, en stock.',
      'Pose ta récolte sur le comptoir. On verra ce qu’on peut faire repousser.',
    ],
  },
  ondine: {
    id: 'ondine', name: 'Ondine',
    color: '#4fc3b1', accent: '#b3f2e6',
    voice: { base: 340, spread: 400, speed: 9, wobble: 0.9, timbre: 'liquide' },
    size: 0.8,
    role: 'lore',
    intro: [
      'Tu entends l’eau, ou tu entends ce que l’eau recouvre ?',
      'Le Réseau n’est pas mort. On l’a fait taire. Ce n’est pas pareil.',
      'Quelqu’un a coupé la note. Quelqu’un qui l’aimait, sans doute.',
    ],
  },
  cendre: {
    id: 'cendre', name: 'Vieux-Cendre',
    color: '#9a8f80', accent: '#d6cec2',
    voice: { base: 110, spread: 40, speed: 5, wobble: 0.2, timbre: 'rauque' },
    size: 1.1,
    role: 'antagoniste',
    intro: [
      'Ne t’approche pas. Je salis ce que je touche.',
      'Ils chantaient trop fort. La terre n’en pouvait plus. J’ai voulu... baisser le son.',
      'Je n’ai pas su le rallumer. Voilà. Tu sais tout.',
    ],
  },
  luthier: {
    id: 'luthier', name: 'Le Luthier',
    color: '#e8dcc6', accent: '#fff6e0',
    voice: { base: 90, spread: 900, speed: 3, wobble: 0.1, timbre: 'accord' },
    size: 1.6,
    role: 'mythe',
    intro: [
      '...',
      '(Il ne parle pas. Il joue.)',
      '(Une note s’installe en toi, et tu sais désormais la semer.)',
    ],
  },
};

// Répliques contextuelles : le jeu commente ce que tu viens de faire.
export const BARKS = {
  pepin: {
    firstChord: ['UN ACCORD ! C’EST ÇA UN ACCORD ?!', 'Refais-le. REFAIS-LE.'],
    goodChain: ['Tu es EN RYTHME ! Je le sens dans mes racines !'],
    blightHigh: ['Ça devient gris... ça devient gris !', 'J’aime pas le gris.'],
    seasonClear: ['On a gagné une saison ! Une SAISON !'],
    wilt: ['Oh non. Elle avait un si joli son.'],
    idle: ['Tu crois que je vais devenir grand ?', 'Chut. Écoute. Là. Tu entends ?'],
  },
  bourdon: {
    shop: ['Ça vaut ce que ça vaut. C’est-à-dire beaucoup.'],
    poor: ['Reviens quand tes poches feront un bruit plus intéressant.'],
    rich: ['Tiens tiens. Quelqu’un a travaillé.'],
    idle: ['J’ai connu ce marais quand il chantait en ré. Tu me croiras pas.'],
  },
  ondine: {
    echo: ['Un souvenir. Il n’était pas perdu, seulement recouvert.'],
    idle: ['Pourquoi replantes-tu ce qui a déjà échoué ?', 'La bonne question, c’est : qui a éteint la première note ?'],
  },
  cendre: {
    approach: ['Va-t’en.', 'Tu ne veux pas savoir ce qu’il y a au Cœur.'],
    forgive: ['Tu... tu la rejoues. Ma note. Tu la rejoues.'],
  },
  luthier: {
    gift: ['(Une sixième corde vibre quelque part.)'],
  },
};

export function npcBark(id, key, rng) {
  const table = BARKS[id];
  if (!table || !table[key]) return null;
  const list = table[key];
  return rng ? rng.pick(list) : list[0];
}

export const NPC_ORDER = ['pepin', 'bourdon', 'ondine', 'cendre', 'luthier'];
