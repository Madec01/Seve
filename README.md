# Une année à la ferme

Jeu de gestion cosy en pixel art, jouable dans le navigateur.

Tu reprends une petite ferme. Le but : **tenir une année complète**, printemps, été, automne et hiver, sans faire faillite. Chaque niveau est une nouvelle année avec sa contrainte : sécheresse, pluies, petit terrain, hiver sans fin, marché fou, crédit à rembourser, année bio…

## Comment jouer

- **Cultiver** : clique sur une parcelle vide pour semer, arrose chaque jour (une culture arrosée pousse deux fois plus vite), récolte quand c'est mûr : l'argent tombe tout de suite.
- **Investir** : poulailler, ruches, vaches, moutons, étal, arrosage automatique, panneaux solaires, chambre d'hôte. Ils rapportent **chaque matin**, même quand rien ne pousse.
- **Payer le fermage** : à la fin de chaque saison, le loyer de la ferme est prélevé. Si l'argent manque, c'est la faillite.
- **Préparer l'hiver** : au premier jour de l'hiver, les cultures qui ne résistent pas au gel sont perdues, et presque rien ne pousse. Les revenus automatiques font la différence.
- Tenir jusqu'au bout de l'hiver : de une à trois étoiles selon l'argent restant, et le niveau suivant se débloque.

Raccourcis : **Espace** pause · **1 / 2 / 3** vitesses · **Échap** menu. Maj + clic sur une graine : semer sur toutes les parcelles vides.

## Lancer le jeu

Le jeu utilise des modules JavaScript : il faut le servir en HTTP (ouvrir `index.html` directement ne marche pas).

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000

## Pour les développeurs

| Commande | Rôle |
|---|---|
| `npm install` puis `node tools/build.js` | Construit la version publiée (`dist/`, `index.html`, `dev.html`, `sw.js`) — **avant chaque commit** |
| `node --test tests/` | Tests de la logique du jeu (et vérification que la version publiée est à jour) |
| `node tools/simulate.js` | Simulation d'équilibrage (joueurs-robots sur les 8 niveaux) |
| `tools/scene-preview.html` | Aperçu de la scène (saisons, météo, installations) |
| `tools/atlas-preview.html` | Aperçu de tous les sprites |
| `index.html?debug=1` | Outils de débogage (`window.__game`, `window.__debug`) |
| `dev.html` (ou `index.html?dev=1`) | Jeu non empaqueté : modules de `src/` et styles de `css/`, sans service worker |

- `docs/GAME_DESIGN.md` : règles, économie, niveaux.
- `docs/ARCHITECTURE.md` : organisation du code et contrats entre modules.
- `JOURNAL.md` : journal des modifications, idées et bugs.

Le jeu publié n'a aucune dépendance (HTML, CSS et JavaScript natifs). Une seule étape de construction (`node tools/build.js`, avec esbuild en dépendance de développement) réunit les modules et les styles en deux fichiers à empreinte (`dist/game.<empreinte>.js` / `.css`) : GitHub Pages n'a pas d'étape de construction, `dist/` est donc versionné dans le dépôt.

## Crédits

Graphismes Kenney (CC0), musique Sirental (CC BY 4.0), sons Kenney et Freesound (CC0), police Jersey 15 retouchée « Jersey Ferme » (OFL). Détail complet dans [`CREDITS.md`](CREDITS.md).
