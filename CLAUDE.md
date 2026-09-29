# Une année à la ferme

Jeu de gestion cosy en pixel art, jouable dans le navigateur (HTML + JavaScript en modules ES, sans compilation).
Le but : tenir une année complète (4 saisons, en accéléré) sans faire faillite. Chaque niveau est une année avec ses contraintes.

## Règles de travail

@.claude/REGLES.md

Un hook `UserPromptSubmit` (dans `.claude/settings.json`) réinjecte ces règles à chaque message.

## Documents de référence

- `docs/GAME_DESIGN.md` : règles du jeu, économie, niveaux (la source de vérité du gameplay).
- `docs/ARCHITECTURE.md` : organisation du code, contrats entre modules, conventions.
- `JOURNAL.md` : journal des modifications, idées et bugs (à mettre à jour à chaque travail).
- `CREDITS.md` : origine et licence de chaque ressource (graphismes, sons, musique, police).

## Commandes

- Lancer le jeu : `python3 -m http.server 8000`, puis ouvrir http://localhost:8000
- Tests de la logique : `node --test tests/`
- Simulation d'équilibrage : `node tools/simulate.js`

## Conventions

- Code, commentaires et textes du jeu en français ; noms de variables et fonctions en anglais.
- La logique (`src/core`, `src/data`) est pure : aucun accès au DOM, testable sous Node.
- Seules des ressources sous licence libre compatible avec un dépôt public (CC0, CC BY, OFL) sont ajoutées, et chacune est listée dans `CREDITS.md`.
