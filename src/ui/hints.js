// Conseils « première fois » — PONT vers l'accompagnement (src/ui/coach/, docs/ACCOMPAGNEMENT.md § 1).
// L'ancienne bulle « Compris » est remplacée par le moteur de leçons de Joseph : `app.hints.maybe(id, target)` devient
// `app.coach.request(id, { target })`. Un identifiant qui a sa leçon au catalogue (src/ui/coach/lessons/) est montré
// comme une leçon ; un ancien conseil de la table HINTS (et des tables recopiées par variety.js, cozy.js, valley.js,
// heritage.js, places.js) qui n'a pas encore sa leçon est montré par le moteur comme une leçon d'une étape « Compris »
// (rien ne se perd pendant la migration des paquets LEÇONS). Ce pont disparaît quand plus aucun appel app.hints.* ne
// reste. Mémoire : progression.hintsSeen (mêmes identifiants : déjà vu = vu).
//
// createHints(app) → { maybe(id, target?, opts?), frame(), relayout(), clear(), active, current }
//   target : { selector, sheet? } | { plot: index } | { investment: id } | { rect: () => rect de la page } | null

export const HINTS = {
  processing: { title: 'Les ateliers', text: 'Nouveau : les ateliers transforment vos récoltes en produits plus chers, vendus tout seuls à l\'aube.', where: 'game' },
  processingBought: { title: 'Votre atelier', text: 'Interrupteur allumé : les récoltes compatibles y partent tant qu\'il reste une place. Sinon, elles se vendent comme d\'habitude.', where: 'game' },
  tree: { title: 'Le pommier', text: 'Le pommier reste toute l\'année : pas d\'arrosage, pas de gel, des pommes en été et en automne.', where: 'game' },
  goat: { title: 'Les chèvres', text: 'Les chèvres donnent du lait chaque jour ; avec une fromagerie, il devient du fromage.', where: 'game' },
  pollination: { title: 'Les abeilles', text: 'Sans abeilles, vos pommiers donnent moitié moins. Pensez à la ruche !', where: 'game' },
  contest: { title: 'Le concours', text: 'Concours le soir du 21ᵉ jour : 6 citrouilles, 12 produits, 3 fromages. Chaque épreuve rapporte 120.', where: 'game' },
  grange: { title: 'Vos étoiles', text: 'Vos étoiles achètent des bonus dans la grange aux souvenirs.', where: 'menu' },
  decor: { title: 'Vos écus', text: 'Vos écus décorent la ferme : Grange → Ma ferme.', where: 'menu' },
  // Mode Carrière (docs/CARRIERE.md § 10.8)
  'career.start': { title: 'Votre ferme', text: 'Semez, arrosez, récoltez comme d\'habitude. Le Carnet montre les objectifs du prochain rang.', where: 'game', who: 'joseph' },
  'career.collect': { title: 'Les œufs', text: 'Les abris gardent leurs produits 3 jours : touchez le poulailler pour les ramasser.', where: 'game', who: 'joseph' },
  'career.lotForSale': { title: 'La forêt à vendre', text: 'Vous pouvez acheter un terrain de forêt, autour de la ferme : touchez « Acheter ». Chaque terrain ajoute un peu de charges de saison.', where: 'game', who: 'joseph', relevant: (app) => (app.game?.state.career?.lotsBought || 0) === 0 },
  'career.plan': { title: 'Le plan de culture', text: 'Chaque champ a un plan par saison : c\'est ce que sèment le semoir et les jardiniers.', where: 'game', who: 'joseph' },
  'career.hire': { title: 'L\'embauche', text: 'La maison peut loger des employés : ouvrez l\'onglet « Équipe » pour embaucher.', where: 'game', who: 'joseph', relevant: (app) => !(app.game?.state.career?.staff || []).length },
  'career.leave': { title: 'L\'hiver', text: 'En hiver, les champs sont vides : mettez l\'équipe en congé pour ne pas payer de salaires.', where: 'game', who: 'joseph', relevant: (app) => (app.game?.state.career?.staff || []).some((x) => !x.onLeave) },
  'career.collectAll': { title: 'Tout ramasser', text: 'Plusieurs abris attendent : le bouton « Tout ramasser », en bas, les vide d\'un coup. Vous pouvez aussi glisser le doigt d\'un abri à l\'autre.', where: 'game', who: 'joseph' },
  'career.machine': { title: 'Votre machine', text: 'Elle travaille seule chaque jour. Son interrupteur est dans la fiche du terrain.', where: 'game', who: 'joseph' },
  'career.storage': { title: 'Le grenier', text: 'Quand le cours est bas, la récolte attend au grenier. Vendez-la quand le cours remonte.', where: 'game', who: 'joseph' },
  'career.quest': { title: 'Les quêtes de Joseph', text: 'Rendez-moi service : je paie bien, et notre amitié grandit (♥).', where: 'game', who: 'joseph' },
  'career.crows': { title: 'Les corbeaux', text: 'Touchez une parcelle marquée d\'un corbeau pour le chasser, sinon la récolte vaudra moitié moins.', where: 'game', who: 'joseph' },
  'career.yearEnd': { title: 'Fin de l\'année', text: 'Au soir du dernier jour d\'hiver : le bilan de l\'année, puis l\'année suivante avec la même ferme.', where: 'game', who: 'joseph' },
};

export function createHints(app) {
  return {
    /** Demande un conseil ; renvoie true s'il sera montré (maintenant ou plus tard). */
    maybe(id, target = null, opts = {}) {
      void opts;
      return !!app.coach?.request(id, { target });
    },
    frame() {},
    relayout() {},
    /** Le moteur vide sa file lui-même (coach.unbind) : rien à faire ici. */
    clear() {},
    get active() {
      return !!app.coach?.blocking;
    },
    get current() {
      return app.coach?.current?.lessonId || null;
    },
  };
}
