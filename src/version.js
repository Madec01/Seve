// Version des fichiers du jeu (images, sons) : jamais de mélange entre deux mises en ligne.
//
//   assetUrl('assets/sprites/tiny-farm.png')  → 'assets/sprites/tiny-farm.png?v=3f2a9c01d4'
//
// La table { chemin: empreinte } est écrite dans le paquet (dist/game.<empreinte>.js) par
// tools/build.js (option « define » d'esbuild). En mode développement (dev.html, modules non
// empaquetés) et sous Node (tests), elle n'existe pas : les chemins sont renvoyés tels quels.
//
// Le « ?v= » change quand le contenu du fichier change : le navigateur ne peut pas réutiliser une
// ancienne copie gardée dans son cache HTTP, et le service worker (sw.js) ne sert sa copie que si
// l'empreinte correspond (sinon : réseau).

const VERSIONS = globalThis.__FERME_ASSETS__ || null;

/** Adresse versionnée d'un fichier du jeu (chemin relatif à la racine, ex. 'assets/…'). */
export function assetUrl(path) {
  const v = VERSIONS && VERSIONS[path];
  return v ? `${path}?v=${v}` : path;
}
