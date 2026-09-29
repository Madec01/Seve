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
| `node --test tests/` | Tests de la logique du jeu |
| `node tools/simulate.js` | Simulation d'équilibrage (joueurs-robots sur les 8 niveaux) |
| `tools/scene-preview.html` | Aperçu de la scène (saisons, météo, installations) |
| `tools/atlas-preview.html` | Aperçu de tous les sprites |
| `index.html?debug=1` | Outils de débogage (`window.__game`, `window.__debug`) |

- `docs/GAME_DESIGN.md` : règles, économie, niveaux.
- `docs/ARCHITECTURE.md` : organisation du code et contrats entre modules.
- `JOURNAL.md` : journal des modifications, idées et bugs.

Aucune dépendance, aucune compilation : HTML, CSS et JavaScript natifs.

## Crédits

Graphismes Kenney (CC0), musique Sirental (CC BY 4.0), sons Kenney et Freesound (CC0), police Pixelify Sans (OFL). Détail complet dans [`CREDITS.md`](CREDITS.md).
