# Journal du projet « Une année à la ferme »

Journal tenu à jour à chaque travail : modifications, idées, bugs, sauvegardes.

---

## Sauvegardes

Méthode : le proxy git de l'environnement n'autorise l'envoi que de la branche de travail. Les branches de sauvegarde sont donc créées sur GitHub via l'API ; le tag du même nom reste local.


| Date | Nom (branche + tag) | Contenu |
|---|---|---|
| 2026-09-29 | `backup/ancien-projet-2026-09-29` | Ancien projet « SÈVE — Le Chant des Racines » avant sa suppression complète (branche créée sur GitHub via l'API, commit `19aa16c` ; tag seulement en local) |

---

## Modifications

### 2026-09-29 — Démarrage du projet

- Choix du concept : jeu de gestion cosy, survivre une année à la ferme, un niveau = une année avec des contraintes.
- Recherche des ressources libres (graphismes, musique, sons, police) et vérification des licences sur les pages officielles.
- Sauvegarde de l'ancien projet, puis suppression de tout son contenu du dépôt (demande de l'utilisateur).
- Mise en place des règles de travail (`.claude/REGLES.md`, relues à chaque message via un hook), de `CLAUDE.md` et de ce journal.
- Rédaction du game design (`docs/GAME_DESIGN.md`) et de l'architecture (`docs/ARCHITECTURE.md`).

### 2026-09-29 — Logique du jeu, données, tests et équilibrage

- Données pures dans `src/data/` : constantes (`balance.js`), 7 cultures, 8 investissements, 8 niveaux (ajouter une culture = ajouter une entrée).
- Cœur du jeu dans `src/core/` (sans DOM) : `game.js` suit le contrat de `docs/ARCHITECTURE.md` ; découpage en `calendar`, `farm`, `economy`, `weather`, `market`, `stats`, `events`, `rng` (mulberry32 à graine, trois flux indépendants : météo, marché, maladie).
- Ordre de l'aube documenté (pousse → gel → météo → maladie → pluie → marché → arrosage automatique → revenus → charges → prêt).
- 77 tests (`node --test tests/`, via `tests/index.js`, ou `node --test`).
- Simulation `tools/simulate.js` : 4 joueurs-robots (insouciant, équilibré, investisseur, optimisé) × 200 graines par niveau ; option `--trace` pour suivre une partie jour par jour.
- Équilibrage : investissements rentabilisés en 9 à 15 jours, cultures d'hiver peu rentables, fermage d'hiver élevé ; prêt du niveau 7 porté à 150 pièces tous les 7 jours (jours 4, 11, 18, 25), la mensualité de 40 pièces du premier jet ne pesait rien. Tableaux chiffrés mis à jour dans `docs/GAME_DESIGN.md`.

### 2026-09-29 — Interface, audio et câblage

- `index.html`, `css/style.css` : page unique (canvas + barre du haut, panneau, fenêtres, infobulle, messages, tutoriel), cadres Kenney en border-image au pixel près, trois échelles (×2, ×3, ×4) de 1024 × 600 à la 4K, panneau repliable, jouable au toucher en paysage.
- `src/ui/` : barre du haut (compteur d'argent animé, prévision du fermage colorée), panneau Investissements / Bilan, choix des graines près de la parcelle (Maj + clic : tout le champ), glisser pour arroser ou récolter, fenêtres (menu, niveaux, options, crédits, pause, fin de saison, faillite, victoire), messages, tutoriel du niveau 1 (Joseph, le voisin).
- `src/audio/audio.js` : Web Audio, fondus de 2 s, ambiances selon météo et saison, cris d'animaux ponctuels, coq à l'aube, limitation des sons répétés.
- `src/storage.js` : partie en cours, progression, options, tutoriel (localStorage protégé).
- `src/main.js` : chargement, boucle, raccourcis, sauvegarde automatique ; outils de débogage avec `?debug=1`.
- Icônes dessinées pour le jeu : `assets/sprites/ui/icons.png` (script `generate-icons.py`).

---

## Idées (à étudier plus tard)

- Chèvres et fromagerie (pas de sprite de chèvre dans le pack : à dessiner à partir du mouton).
- Atelier de confitures et transformation des récoltes.
- Abonnements « paniers » : revenu fixe hebdomadaire contre une obligation de livraison.
- Bonus permanents achetés avec les étoiles entre les niveaux.
- Commandes des voisins (« 5 tomates, payées le double »).
- Festival de fin d'été avec concours du plus gros légume.

---

## Bugs

| Date | Description | Statut |
|---|---|---|
| 2026-09-29 | Logique : l'arrosage gratuit était refusé quand l'argent était négatif (comparaison `argent < 0`) | Corrigé avant intégration |
