# Une année à la ferme

Jeu de gestion cosy en pixel art, jouable dans le navigateur (HTML + JavaScript en modules ES ; une seule étape de construction, `node tools/build.js`, réunit tout en deux fichiers à empreinte pour la publication).
Le but : tenir une année complète (4 saisons, en accéléré) sans faire faillite. Chaque niveau est une année avec ses contraintes.

## Règles de travail

@.claude/REGLES.md

Un hook `UserPromptSubmit` (dans `.claude/settings.json`) réinjecte ces règles à chaque message.

## Priorité : le téléphone

Le jeu se joue **d'abord sur téléphone, en portrait** (Android + Chrome), installable comme une application (PWA). Voir `docs/MOBILE.md` : toute décision se prend d'abord pour le téléphone.

## Documents de référence

- `docs/MOBILE.md` : cahier des charges de la version téléphone (prioritaire).

- `docs/GAME_DESIGN.md` : règles du jeu, économie, niveaux (la source de vérité du gameplay).
- `docs/ARCHITECTURE.md` : organisation du code, contrats entre modules, conventions.
- `JOURNAL.md` : journal des modifications, idées et bugs (à mettre à jour à chaque travail).
- `CREDITS.md` : origine et licence de chaque ressource (graphismes, sons, musique, police).

## Commandes

- Lancer le jeu : `python3 -m http.server 8000`, puis ouvrir http://localhost:8000
- Tests de la logique : `node --test tests/`
- Simulation d'équilibrage : `node tools/simulate.js`
- Construire la version publiée : `node tools/build.js` (après `npm install`, une fois) — **à lancer avant CHAQUE commit** qui touche le jeu (src/, css/, assets/, manifeste, sw.js) : paquet unique `dist/game.<empreinte>.js` + `.css`, `index.html`, `dev.html`, précache de `sw.js`. Committer `dist/`, `index.html`, `dev.html` et `sw.js` avec les sources. `node tools/build.js --check` (et `node --test tests/`) échoue si c'est périmé.
- Déboguer sans paquet : `dev.html` (ou `index.html?dev=1`) charge les modules de `src/` et les styles de `css/` directement, sans service worker.

## Conventions

- Ne jamais modifier `index.html`, `dev.html` ni `dist/` à la main : la page se modifie dans `src/index.template.html`, le chargeur dans `src/loader.js`.
- Code, commentaires et textes du jeu en français ; noms de variables et fonctions en anglais.
- La logique (`src/core`, `src/data`) est pure : aucun accès au DOM, testable sous Node.
- Seules des ressources sous licence libre compatible avec un dépôt public (CC0, CC BY, OFL) sont ajoutées, et chacune est listée dans `CREDITS.md`.
