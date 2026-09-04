// Les Échos : douze fragments de mémoire enfouis sous la Cendre.
// Ils racontent l'histoire dans le désordre, comme des racines déterrées.

export const ECHOES = [
  { id: 'e1', act: 1, title: 'Relevé du gardien, an 0', text: 'Le Réseau bat à quatre-vingt-seize. Depuis toujours. On accorde les vergers dessus, on accorde les naissances dessus.' },
  { id: 'e2', act: 1, title: 'Note de l’atelier', text: 'Une corde ne casse pas d’un coup. Elle se détend. On croit qu’elle tient encore, et un matin il n’y a plus de note.' },
  { id: 'e3', act: 1, title: 'Chanson d’enfant', text: 'Do pour la racine, Ré pour la hâte, Mi pour la lumière, Sol pour la portée, La pour la peine.' },
  { id: 'e4', act: 1, title: 'Registre du marais', text: 'Marée haute : tout monte d’une tierce. Les anciens disaient que le marais mentait. Il ne mentait pas, il transposait.' },
  { id: 'e5', act: 2, title: 'Lettre non envoyée', text: 'Ils chantaient jour et nuit. La terre a commencé à trembler en mesure. Personne n’a voulu voir que trop de chant, c’est encore du bruit.' },
  { id: 'e6', act: 2, title: 'Compte rendu du Conseil', text: 'Motion refusée : « baisser le Réseau d’un demi-ton pendant une saison ». Le gardien Cendre a quitté la salle.' },
  { id: 'e7', act: 2, title: 'Fragment brûlé', text: '...ai coupé la corde de Do. Une seule. Je pensais que les autres tiendraient. Elles se sont tues l’une après l’autre, en trois jours.' },
  { id: 'e8', act: 2, title: 'Carnet d’Ondine', text: 'Il revient chaque nuit au même endroit et il essaie de fredonner. Il n’y arrive pas. Il a oublié la note qu’il a tuée.' },
  { id: 'e9', act: 3, title: 'Consigne du Luthier', text: 'On ne répare pas un Réseau en le rejouant plus fort. On le répare en lui rendant ses intervalles.' },
  { id: 'e10', act: 3, title: 'Mesure du Cœur', text: 'Le Cœur bat encore. À cent trente-deux. Trop vite. Il compense le silence en s’épuisant.' },
  { id: 'e11', act: 3, title: 'Dernière page du gardien', text: 'Si quelqu’un lit ceci : la corde de Do est encore là. Elle attend qu’on la pince. Je n’ai jamais osé.' },
  { id: 'e12', act: 3, title: 'Sans titre', text: 'Un accord, ce n’est pas des notes empilées. C’est des notes qui acceptent d’être ensemble.' },
];

export const ECHO_BY_ID = Object.fromEntries(ECHOES.map((e) => [e.id, e]));

export function nextEcho(save) {
  const found = new Set(save.echoes || []);
  const act = save.act || 1;
  const pool = ECHOES.filter((e) => !found.has(e.id) && e.act <= act);
  if (pool.length) return pool[0];
  const rest = ECHOES.filter((e) => !found.has(e.id));
  return rest.length ? rest[0] : null;
}

export const ACT_TITLES = {
  1: { name: 'Acte I — Le Silence', line: 'Quelque chose s’est tu, et personne ne sait quand.' },
  2: { name: 'Acte II — Ce qu’il a fait', line: 'Une main a coupé une corde, et l’a regretté toute sa vie.' },
  3: { name: 'Acte III — Réaccorder le Cœur', line: 'Il reste une note. Elle attend depuis longtemps.' },
};

export function actForSave(save) {
  const echoes = (save.echoes || []).length;
  if (echoes >= 8 || save.unlockedBiomes.includes('coeur')) return 3;
  if (echoes >= 4 || save.unlockedBiomes.includes('vallee')) return 2;
  return 1;
}
