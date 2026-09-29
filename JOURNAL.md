# Journal du projet « Une année à la ferme »

Journal tenu à jour à chaque travail : modifications, idées, bugs, sauvegardes.

---

## Sauvegardes

Méthode : le proxy git de l'environnement n'autorise l'envoi que de la branche de travail. Les branches de sauvegarde sont donc créées sur GitHub via l'API ; le tag du même nom reste local.


| Date | Nom (branche + tag) | Contenu |
|---|---|---|
| 2026-09-29 | `backup/ancien-projet-2026-09-29` | Ancien projet « SÈVE — Le Chant des Racines » avant sa suppression complète (branche créée sur GitHub via l'API, commit `19aa16c` ; tag seulement en local) |
| 2026-09-29 | `backup/v1-complete-2026-09-29` | Première version complète du jeu (8 niveaux, rendu, interface, audio, revue de code), commit `3ebad21` |

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

### 2026-09-29 — Ressources et rendu de la ferme

- Ressources intégrées : Kenney Tiny Farm, Tiny Town et UI Pack Pixel Adventure (CC0), musique Sirental (CC BY 4.0), sons Kenney et Freesound (CC0, découpés et bouclés), police Pixelify Sans (OFL). Atlas de 247 sprites vérifié visuellement ; panneau solaire, arroseur et étapes de pousse intermédiaires dessinés dans le style Kenney (`assets/sprites/extra.png`).
- Scène canvas (`src/render/`) : monde fixe de 32 × 20 tuiles, champ clôturé, bâtiments et enclos qui apparaissent à l'achat, animaux qui se promènent, abeilles, fermier qui va à la parcelle, décor recoloré par saison (neige sur les toits en hiver), météo animée (pluie, orage, neige, feuilles, pétales, lucioles, canicule), lumière de l'aube au soir, textes flottants et particules. 60 images/s.

### 2026-09-29 — Interface, audio et câblage

- `index.html`, `css/style.css` : page unique (canvas + barre du haut, panneau, fenêtres, infobulle, messages, tutoriel), cadres Kenney en border-image au pixel près, trois échelles (×2, ×3, ×4) de 1024 × 600 à la 4K, panneau repliable, jouable au toucher en paysage.
- `src/ui/` : barre du haut (compteur d'argent animé, prévision du fermage colorée), panneau Investissements / Bilan, choix des graines près de la parcelle (Maj + clic : tout le champ), glisser pour arroser ou récolter, fenêtres (menu, niveaux, options, crédits, pause, fin de saison, faillite, victoire), messages, tutoriel du niveau 1 (Joseph, le voisin).
- `src/audio/audio.js` : Web Audio, fondus de 2 s, ambiances selon météo et saison, cris d'animaux ponctuels, coq à l'aube, limitation des sons répétés.
- `src/storage.js` : partie en cours, progression, options, tutoriel (localStorage protégé).
- `src/main.js` : chargement, boucle, raccourcis, sauvegarde automatique ; outils de débogage avec `?debug=1`.
- Icônes dessinées pour le jeu : `assets/sprites/ui/icons.png` (script `generate-icons.py`).

### 2026-09-29 — Lisibilité et finitions de l'interface

- Police retouchée « Pixelify Sans Ferme » : les chiffres 2, 5 et 7 de Pixelify se confondaient avec 8, S et 7 ; ils sont redessinés sur la grille de la police et les ligatures (fi, fl, ff) désactivées. Script : `assets/fonts/build-pixelify-ferme.py`.
- Revenus des investissements affichés par saison (icônes) ou « par jour » quand ils sont constants ; typographie française (espaces insécables) partout.
- Fenêtre des graines placée à côté du champ ; fenêtres accessibles au clavier (focus piégé, Échap) ; rappel compact du tutoriel ; confirmation avant de quitter ; infobulles détaillées sur l'argent et le fermage.

### 2026-09-29 — Revue de code et parties de bout en bout dans le navigateur

- Revue du cœur, de la sauvegarde, de l'audio, du rendu et de l'interface ; corrections listées dans « Bugs ».
- `loadGame()` vérifie la structure de l'état (sauvegarde abîmée ou ancienne → refusée, « Continuer » masqué) ; nouveau test : tout état atteint en jouant (8 niveaux) se recharge à l'identique.
- Parties complètes des niveaux 1 à 8 pilotées par l'interface (clics sur les parcelles, fenêtre des graines, cartes d'achat, bilans) à ×4 : 8 victoires (2 à 3 étoiles), niveau suivant débloqué, rechargement + « Continuer » à l'identique (niveaux 1, 3, 4, 7), faillite (niveaux 2 et 5) puis « Réessayer », aucune erreur ni avertissement dans la console.
- Tests « singe » (clics et touches au hasard, onglet caché, redimensionnements, tactile) sur les 8 niveaux ; longue partie à ×4 : 60 images/s, tas JS stable (6 à 10 Mo), particules bornées.

### 2026-09-29 — Mise en ligne

- Ajout de `.nojekyll` : le jeu peut être servi tel quel par GitHub Pages, directement depuis la branche de travail (pas besoin d'action de déploiement).

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
| 2026-09-29 | Sauvegarde abîmée ou d'une ancienne structure : acceptée par `loadGame`, plantait plus tard dans l'interface (« Continuer » inutilisable) | Corrigé (`checkState`, test) |
| 2026-09-29 | `update(Infinity)` faisait défiler une infinité de journées | Corrigé (test) |
| 2026-09-29 | Progression ou options abîmées dans le stockage local (niveaux en tableau, vitesse 3…) acceptées telles quelles | Corrigé (`storage.js`, tests) |
| 2026-09-29 | La vitesse préférée était réécrite par chaque pause automatique (fenêtre, tutoriel) | Corrigé (`main.js`) |
| 2026-09-29 | Écran déplacé vers un écran d'une autre densité de pixels : scène floue ou clics décalés jusqu'au prochain redimensionnement | Corrigé (`main.js`, requête média) |
| 2026-09-29 | Scène recréée (changement de zoom minimal) : planches de saison recolorées à nouveau (à-coup) ; `drawSprite` allouait à chaque sprite dessiné | Corrigé (cache, couches précalculées) |
| 2026-09-29 | Grand écran : plus de gouttes voulues que la réserve, la pluie recyclait des gouttes vivantes à chaque image | Corrigé (`effects.js`, bornes) |
| 2026-09-29 | Audio bloqué après une interruption iOS (état « interrupted ») | Corrigé (`audio.js`) |
| 2026-09-29 | Message d'achat : revenu de la saison en cours seulement (ruche achetée en hiver : aucun revenu annoncé) | Corrigé (`incomePhrase`) |
| 2026-09-29 | Tutoriel terminé ou passé : la bulle invisible restait par-dessus la scène, bloquait les clics et ses boutons relançaient le tutoriel (erreur `game` null, tutoriel remis à « non fait ») | Corrigé (`style.css`, `tutorial.js`) |
| 2026-09-29 | Tutoriel, étape « Investir » (sans pause) : la bulle recouvrait la moitié du champ pendant qu'on joue | Corrigé (bulle sous le champ) |
| 2026-09-29 | Reprise d'une partie en plein tutoriel (« Arroser », « Récolter ») : plus d'anneau sur la parcelle d'exemple | Corrigé (`tutorial.js`) |
| 2026-09-29 | Fenêtre des graines reconstruite plusieurs fois par aube ; barre du jour écrite à chaque image même en pause (reflow forcé avec le tutoriel) | Corrigé (`field.js`, `hud.js`, `main.js`) |
| 2026-09-29 | Écran de victoire quitté tout de suite : les sons des étoiles jouaient dans la partie suivante | Corrigé (`dialogs.js`) |
| 2026-09-29 | Avertissements « font preloaded but not used » vus une fois sous forte charge (8 navigateurs en parallèle) ; non reproduits ensuite | À surveiller |
