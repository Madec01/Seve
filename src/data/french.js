// Petits outils d'accord en français pour les textes générés par le cœur (données pures, sans état).
//
//   nounPlural('cheval') → 'chevaux' ; nounPlural('pomme de terre') → 'pommes de terre' ;
//   nounPlural('cour des ateliers') → 'cours des ateliers' ; nounPlural('chou') → 'choux'.
//   countNoun(3, 'cheval') → '3 chevaux' ; countNoun(1, 'parcelle') → '1 parcelle'.
//   agree(phrase, n, 'payé') → 'payé' | 'payée' | 'payés' | 'payées' selon le genre du premier nom.

/** Pluriels irréguliers (mots simples, en minuscules). */
const IRREGULAR = {
  chou: 'choux', bijou: 'bijoux', caillou: 'cailloux', genou: 'genoux', hibou: 'hiboux', joujou: 'joujoux', pou: 'poux',
  œil: 'yeux', bétail: 'bétail', festival: 'festivals', bal: 'bals', carnaval: 'carnavals', chacal: 'chacals', régal: 'régals',
};

/** Pluriel d'un mot simple. */
function wordPlural(w) {
  const lower = w.toLowerCase();
  if (IRREGULAR[lower]) return matchCase(w, IRREGULAR[lower]);
  if (/[sxz]$/i.test(w)) return w;
  if (/(eau|au|eu)$/i.test(w) && !/^(pneu|bleu|landau|sarrau)$/i.test(w)) return `${w}x`;
  if (/al$/i.test(w)) return `${w.slice(0, -2)}aux`;
  return `${w}s`;
}

function matchCase(src, word) {
  return src[0] === src[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
}

/**
 * Pluriel d'un nom (éventuellement composé « X de Y », « X des Y », « X à Y ») : seul le premier
 * nom (et l'adjectif qui le suit directement, ex. « grand silo » → « grands silos ») prend la marque.
 */
export function nounPlural(noun) {
  const s = String(noun ?? '');
  const m = /^(.*?)(\s+(?:de|des|du|d'|à|au|aux|en)\s.*|\s+d'.*)$/i.exec(s);
  const head = m ? m[1] : s;
  const tail = m ? m[2] : '';
  return head.split(' ').map((w) => (w ? wordPlural(w) : w)).join(' ') + tail;
}

/** « 3 chevaux », « 1 parcelle » (n ≤ 1 : singulier). */
export function countNoun(n, noun) {
  return `${n} ${n > 1 ? nounPlural(noun) : noun}`;
}

/**
 * Noms féminins connus du jeu (premier nom d'un groupe, en minuscules, au singulier). Tout autre nom
 * est traité comme masculin.
 */
const FEMININE = new Set([
  'carotte', 'pomme', 'fraise', 'tomate', 'courgette', 'citrouille', 'botte', 'cerise', 'poire', 'parcelle',
  'poule', 'chèvre', 'vache', 'cane', 'brebis', 'truffe', 'confiture', 'farine', 'meule', 'pièce', 'récolte',
  'serre', 'mare', 'cour', 'étable', 'bergerie', 'chèvrerie', 'porcherie', 'écurie', 'fromagerie', 'grange',
  'maison', 'ruche', 'machine', 'graine', 'caisse', 'commande', 'quête', 'tarte', 'bouteille', 'laine', 'brioche',
]);

/** Genre du premier nom d'un groupe : 'f' ou 'm'. */
export function nounGender(phrase) {
  const first = String(phrase ?? '').trim().toLowerCase().split(/[\s']/)[0] || '';
  if (FEMININE.has(first)) return 'f';
  // Pluriel régulier d'un nom féminin connu (« carottes », « bottes »).
  if (first.endsWith('s') && FEMININE.has(first.slice(0, -1))) return 'f';
  return 'm';
}

/** Participe ou adjectif accordé avec `phrase` au nombre `n` : agree('pommes de terre', 5, 'payé') → 'payées'. */
export function agree(phrase, n, word) {
  return `${word}${nounGender(phrase) === 'f' ? 'e' : ''}${n > 1 ? 's' : ''}`;
}
