# Journal du projet « Une année à la ferme »

Journal tenu à jour à chaque travail : modifications, idées, bugs, sauvegardes.

---

## Sauvegardes

Méthode : le proxy git de l'environnement n'autorise l'envoi que de la branche de travail. Les branches de sauvegarde sont donc créées sur GitHub via l'API ; le tag du même nom reste local.


| Date | Nom (branche + tag) | Contenu |
|---|---|---|
| 2026-09-29 | `backup/ancien-projet-2026-09-29` | Ancien projet « SÈVE — Le Chant des Racines » avant sa suppression complète (branche créée sur GitHub via l'API, commit `19aa16c` ; tag seulement en local) |
| 2026-09-29 | `backup/v1-complete-2026-09-29` | Première version complète du jeu (8 niveaux, rendu, interface, audio, revue de code), commit `3ebad21` |
| 2026-09-29 | `backup/avant-mobile-2026-09-29` | État juste avant la refonte « téléphone en portrait + application installable », commit `d6dbdaa` |

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

### 2026-09-29 — Application installable (PWA) et jeu hors ligne

- `manifest.webmanifest` : « Une année à la ferme » / « La Ferme », `start_url` et `scope` relatifs (`./`, fonctionne sous `/Seve/` sur GitHub Pages), `display: standalone` + `display_override: [fullscreen, standalone]`, `orientation: portrait`, couleurs `#3f2631` (thème) et `#2f4a33` (fond), icônes, 2 captures portrait (`assets/screenshots/`, prises sur l'ancienne interface : **à refaire** avec l'interface téléphone), catégorie jeux.
- Icônes (`assets/icons/`, générées par `assets/icons/generate-app-icons.py`) : carotte et tournesol de Tiny Farm (contour affiné à 1 px) sur une butte d'herbe, ciel chaud et soleil ; agrandissement au plus proche voisin avec un facteur entier. 192/512 « any » (badge arrondi), 192/512 « maskable » (motif dans la zone sûre), 512 « monochrome », apple-touch-icon 180, favicons 32/48. `<head>` d'`index.html` : manifeste, icônes, `color-scheme: only light` (pas d'assombrissement automatique de Chrome Android).
- `sw.js` (service worker à la racine) : précache de **tout le jeu** (≈ 177 fichiers, 25,8 Mo : HTML, CSS, modules JS, images, polices, sons ogg + mp3). Liste générée avec empreintes SHA-256 par `node tools/build-sw-manifest.js` (**à relancer après chaque modification d'un fichier du jeu**, `--check` pour vérifier). Entrées rangées par empreinte : une mise à jour ne retélécharge que les fichiers modifiés ; chaque fichier est vérifié (un CDN encore en retard fait échouer l'installation, retentée plus tard, au lieu de mélanger deux versions). Navigation → `index.html` de la version installée (cohérent avec les scripts en cache) ; fichiers → cache d'abord ; requêtes `Range` (audio) → réponse 206 construite depuis le cache ; nettoyage à l'activation ; `skipWaiting` seulement à la demande de la page.
- `src/pwa.js` : enregistrement (`./sw.js`), détection de mise à jour + `applyUpdate()` (« Nouvelle version disponible — Recharger »), invitation à installer (`canInstall()` / `promptInstall()` / `appinstalled`), `isStandalone()`, écran allumé (Wake Lock, repris au retour au premier plan), verrouillage portrait. Aucune interface : c'est à l'interface d'appeler ces fonctions.
- Vérifié avec Playwright (Chromium, Pixel 7), à la racine et sous `/Seve/` : installation et activation, 100 % des entrées en cache et servies, manifeste sans erreur et installable (CDP), jeu chargé et partie lancée **hors ligne** sans erreur, requêtes `Range` 206/416 correctes et `<audio>` lu hors ligne, mise à jour détectée, ancienne version conservée jusqu'au clic, puis bascule et nettoyage (seul le fichier modifié retéléchargé).

### 2026-09-29 — Interface téléphone (portrait) : barre du haut, onglets, feuilles du bas, gestes

- **Diagnostic des touches sur la V1** (Playwright, Pixel 7 émulé, vrais événements tactiles) : voir « Bugs » (parcelles de 12 px, barre du haut qui déborde, menu décalé, infos seulement au survol…).
- Nouvelle mise en page (`index.html`, `css/style.css` réécrite) : scène plein écran ; **barre du haut compacte sur 2 lignes** (argent 20 px + saison, météo aujourd'hui → demain, fermage coloré, **un seul gros bouton de vitesse** ×1 → ×2 → ×4 → pause, appui long = pause, course du soleil sur toute la largeur) ; **onglets en bas** Ferme · Acheter · Bilan · Menu (60 px, icônes + libellés, pastille dorée quand un achat est possible) ; marges `safe-area`, hauteur réelle via `visualViewport` (barre d'adresse de Chrome), `user-scalable=no`, pas de sélection ni de menu contextuel, `overscroll-behavior: none`.
- **Feuilles du bas** (`src/ui/sheets.js`) : Acheter, Bilan, graines, fiche de parcelle, fiche de bâtiment, fiches de la barre du haut (qui remplacent les infobulles) ; poignée, glisser vers le bas, ✕, toucher sur la scène. Sur grand écran en paysage, elles se rangent à droite et les onglets passent dans la barre du haut (souris + clavier comme avant, nouvelles touches B / N / F).
- **Gestes** (`src/ui/gestures.js`) : toucher = action immédiate (semer / arroser / récolter / ouvrir), toucher une parcelle déjà arrosée ou appui long = fiche, glisser depuis une parcelle = arrosage ou récolte en série, glisser ailleurs = défilement de la scène avec élan (`scene.scrollBy` / `scene.fling`), cible tolérante au doigt (`hitTest(…, { touch: true })`), vibration courte optionnelle.
- **Choix des graines** en grandes lignes (durée, graine, vente, gain par jour, avertissements), une touche pour semer, interrupteur « Semer partout ». Cartes d'achat avec bouton pleine largeur et raison écrite quand l'achat est impossible.
- **Fenêtres** (fin de saison, victoire, faillite, niveaux, options, crédits, pause, confirmations) en hautes feuilles en portrait : ruban de titre, ✕ à côté, boutons pleine largeur, fermeture par glissement ou toucher sur le fond ; centrées sur ordinateur. Menu principal qui tient dans 360 px (titre sur deux lignes).
- **Tutoriel** en portrait : textes raccourcis (« Touchez… » au doigt), bulle pleine largeur en haut ou en bas selon la cible (jamais dessus), la scène montre la parcelle visée (`scene.focusPlot`), bulle réduite d'elle-même en rappel si elle cacherait le champ pendant qu'on joue, étape « Investir » qui vise l'onglet Acheter puis la carte du poulailler.
- **Options** : « Vibrer au toucher », « Garder l'écran allumé pendant la partie » (Wake Lock via `src/pwa.js`), « Installer le jeu » (aussi dans le menu principal quand c'est possible) ; message « Nouvelle version disponible » (toucher = recharger après sauvegarde), « Jeu disponible hors ligne ».
- **Audio Android** : déverrouillé / relancé à chaque geste (`pointerup`, `touchend`, `click` : seuls gestes qui comptent pour Chrome au doigt), suspendu en arrière-plan (`visibilitychange`, `pagehide`), repris au retour (`pageshow`) ; la partie passe en pause et le menu de pause attend le joueur.
- `storage.js` : options `vibration` et `keepAwake` (l'ancienne `panelCollapsed` disparaît), test mis à jour.
- **Vérifié au doigt** (Playwright, `page.tap` / événements tactiles, jamais la souris) sur Pixel 7 (412 × 915, DPR 2,625), 360 × 740 (DPR 3) et 360 × 640 (DPR 2) : niveau 1 joué entièrement au doigt, tutoriel compris (semer, arroser, vitesse, récolter, fermage, poulailler, avertissement de gel, hiver) → **victoire sur les trois écrans** ; niveau 2 joué 6 jours ; défilement de la scène ; ouverture / fermeture de toutes les feuilles et fenêtres par toucher, ✕, glissement et toucher dehors ; appui long ; arrière-plan. Script de mesure : **toutes les cibles visibles ≥ 48 × 48 px et tous les textes ≥ 12 px sur chaque écran** (menu, niveaux, tutoriel, graines, fiches, acheter, bilan, pause, options, crédits, confirmation, fin de saison, victoire, faillite), aucun débordement horizontal, **aucune erreur console**. Ordinateur 1280 × 720 à la souris et au clavier : OK. `sw.js` régénéré (`node tools/build-sw-manifest.js`).

### 2026-09-29 — Police lisible sur téléphone (Jersey Ferme)

- **Audit** de toutes les lettres, chiffres, accents et symboles du jeu, en 400 / 500 / 600 / 700, de 12 à 20 px, rendus dans Chromium à DPR 2, 2,625 et 3, plus lecture des glyphes (fontTools) : dans Pixelify Sans, les majuscules à coins arrondis sur une grille de 5 × 7 pixels se confondent — **C ≈ O / 0**, **B ≈ G ≈ 8**, **Z ≈ 2**, **D ≈ O**, **G ≈ C**, **Q ≈ O**, **H** à bosse, **I ≈ l**, « j » peu lisible. Redessiner toutes ces majuscules revenait à refaire la police.
- **Nouvelle police : « Jersey Ferme »**, version modifiée de **Jersey 15** (Sarah Cadigan-Fried, SIL OFL 1.1), choisie après comparaison côte à côte de Jersey 10 / 15 / 20, Tiny5, VT323, DotGothic16, Micro 5, Handjet, Bytesized, Bitcount, Coral Pixels et des polices Kenney : formes franches (C ouvert, B et D à angles droits, Z à barre plate, chiffres distincts), accents français complets, style pixel chaleureux. `assets/fonts/build-ferme-font.py` : « I » à empattements (distinct de « l ») et I accentués, flèches → ← ↑ ↓ ↔, ✕, ★, ≥, ≤, ±, espaces fines, lettres ×1,15 (majuscules aussi hautes qu'avant, texte ~15 % plus étroit : aucun débordement nouveau), hinting retiré, graisse grasse (+1 pixel).
- `css/fonts.css` : deux fichiers (`JerseyFerme-Regular.woff2` pour 400–549, `JerseyFerme-Bold.woff2` pour 550–900) sous le nom CSS **« Ferme »** (renommé depuis « Pixelify Sans » dans `fonts.css`, `style.css`, `effects.js`, `main.js`). Crédits (`CREDITS.md`, écran Crédits) mis à jour, licence `assets/fonts/OFL-Jersey15.txt`.
- Vérifié en Pixel 7 émulé (menu, niveaux, tutoriel, graines, barre du haut, bilan) : chaque mot se lit du premier coup (« Carotte », « Blé », « Bilan », « Bienvenue », « C'est parti »), aucune erreur console.
- Préchargements de `index.html` passés aux nouveaux fichiers, fichiers Pixelify retirés du dépôt, liste hors ligne (`sw.js`) régénérée.

### 2026-09-29 — Téléphone : parcelle visible au-dessus des feuilles, champ du niveau 1, bandeau, messages, réparation du jeu

- **La parcelle touchée reste visible** au-dessus de la feuille qui s'ouvre (graines, ouverture, fiche) : nouvelle API de la scène `setOverlay(px)` (hauteur couverte par la feuille : la scène peut défiler au-delà du bas du monde, dans la forêt), `focusPlot(i, { margin, bottom, animate })` et `scrollTo(y, animate)` avec **défilement animé** (0,32 s, arrivée en douceur ; instantané si « Réduire les animations ») ; à la fermeture, la vue revient en douceur là où elle était. Une feuille « popup » laisse toujours ~150 px de scène au-dessus d'elle (360 × 640 compris). Le tutoriel fait défiler en douceur vers la parcelle entourée, et **l'anneau reste affiché au-dessus de la feuille des graines** (caché seulement s'il tomberait sous la feuille ou la barre du haut).
- **Champ du niveau 1 en portrait** (`layout-portrait.js`, `placeVisualCells`, index du cœur inchangés) : les 12 parcelles ouvertes forment un **bloc 4 × 3 centré** (toute la largeur de la clôture, côté portail) au lieu de 3 × 4 collé en bas à gauche ; les parcelles à acheter l'entourent, dessinées en herbe plus sombre avec pointillés clairs, et **une pièce qui se balance** sur celles qui touchent le potager (« à vendre », là où le champ s'agrandit). Vérifié sur les 8 niveaux (niveau 4 : 2 × 3 plein).
- **Bandeau de début de niveau / de saison** : posé sous la barre du haut et **en dessous d'elle** (z-index), des feuilles et du tutoriel ; sur téléphone, plus compact (sans icônes, texte entre les deux filets du ruban) ; il s'efface dès qu'une bulle ou le rappel du tutoriel s'affiche en haut (`toasts.hideBanner()`).
- **Messages (toasts)** : ne captent plus les touchers (sauf « Nouvelle version disponible », qui propose une action) ; au-dessus des onglets et de la feuille ouverte ; avec une feuille haute (Acheter, Bilan), en bas sur la fin de la liste plutôt que sur son titre et son ✕ ; les anciens qui passeraient sous la barre du haut s'effacent.
- **Jamais bloqué sur une version cassée** : garde-fou de démarrage en tête de `index.html` (script classique indépendant des modules) — si le jeu n'a pas appelé `window.__bootOk()` au bout de 12 s, ou si une erreur de script survient pendant le chargement (ou `__bootFail()` depuis `boot()`), et qu'une nouvelle version du service worker attend ou s'installe → `SKIP_WAITING` et **un seul** rechargement (repère `ferme.bootRecovery` en sessionStorage) ; sinon, bouton **« Réparer le jeu »** sur l'écran de chargement. Options → « En cas de problème » → **« Réparer le jeu (vider le cache) »** (`pwa.repairApp()` / `window.__repairGame()`) : désinscrit le service worker du jeu, supprime les caches `ferme-*`, recharge ; progression et partie (localStorage) conservées.
- Captures du manifeste refaites (`assets/screenshots/ferme-1.png` : la ferme en été, cultures, ruches, poules, moutons ; `ferme-2.png` : feuille Acheter ; 1080 × 2400) et libellés mis à jour.
- Docs : `docs/ARCHITECTURE.md` (feuilles, champ en portrait, messages, bandeau, garde-fou), `docs/MOBILE.md`, en-tête de `scene.js`.
- **Vérifié au doigt** (Playwright, Pixel 7 412 × 915 DPR 2,625 ; 360 × 740 DPR 3 ; 360 × 640 DPR 2) : niveau 1 joué entier, tutoriel compris → **victoire sur les trois écrans** ; à chaque feuille ouverte depuis une parcelle (70 à 84 fois par partie), la parcelle est entièrement visible entre la barre du haut et la feuille ; bandeau jamais sur la barre du haut ; tous les écrans et feuilles mesurés (cibles ≥ 48 px, textes ≥ 12 px, aucun débordement) ; ordinateur 1280 × 720 à la souris et au clavier ; garde-fou testé avec une copie du jeu servie à part (version cassée active + version corrigée publiée → rechargement automatique unique ; version cassée partout → bouton « Réparer », pas de boucle ; réparation depuis les options, progression conservée).

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
| 2026-09-29 | **Téléphone : « les touches ne marchent pas »** — causes trouvées (Pixel 7 émulé) : (1) parcelles de **12 × 12 px CSS** à l'écran (monde au zoom ×2 en pixels physiques, DPR 2,625) : un doigt (~40 px) tombait sur la parcelle voisine, la clôture ou l'allée, sans tolérance ; (2) la barre du haut (1 ligne de ~500 px) **dépassait l'écran** : bouton ×4, son et menu hors de l'écran (impossible d'accélérer ou d'ouvrir le menu) ; (3) le premier toucher sur la scène pendant que la fenêtre des graines était ouverte ne faisait que la fermer ; (4) toucher un bâtiment ouvrait le panneau plein écran (100 vw) qui recouvrait tout ; (5) toute l'information des parcelles et de la barre du haut n'existait qu'au **survol** (filtré au toucher) ; (6) le grand bandeau de début de partie captait les touchers en haut de la scène | Corrigé (scène portrait avec parcelles 2 × 2 tuiles et cible tolérante, nouvelle interface, gestes, fiches) |
| 2026-09-29 | Téléphone : **affichage coupé / décalé** — menu principal et titre en `white-space: nowrap` plus larges que l'écran (menu décalé vers la droite, coupé), fenêtres centrées en grille qui débordaient, hauteur `100%` sans suivre la barre d'adresse, pincement / double toucher pouvant zoomer la page (viewport sans `user-scalable=no`) | Corrigé (mise en page portrait, `--app-h` depuis `visualViewport`, viewport) |
| 2026-09-29 | Téléphone : **tout trop petit** — texte de base 15 px réduit à 13,5 px dans les cartes, boutons d'achat de 38 px, onglets de 40 px, bouton × de 30 px, lien « Passer le tutoriel » de 15 px de haut, bouton de réduction du tutoriel de 24 px | Corrigé (cibles ≥ 48 px, textes ≥ 14 px, mesurés par script) |
| 2026-09-29 | Audio sur Android : le déverrouillage n'écoutait que `pointerdown` (qui ne compte pas comme geste pour Chrome au doigt) après le premier démarrage | Corrigé (`pointerup`, `touchend`, `click`, reprise au retour) |
| 2026-09-29 | Feuille des graines reconstruite à chaque pièce gagnée : un toucher en cours pouvait tomber sur une ligne remplacée | Corrigé (reconstruction seulement si le contenu change) |
| 2026-09-29 | Cadres parchemin sans bord bas (feuilles, fenêtres) : la bordure basse de l'image était étirée dans le fond (bande sombre) | Corrigé (`border-image-slice` complet, largeur 0 en bas) |
| 2026-09-29 | Avertissements « font preloaded but not used » vus une fois sous forte charge (8 navigateurs en parallèle) ; non reproduits ensuite | À surveiller |
| 2026-09-29 | Téléphone : la feuille des graines (et les autres feuilles ouvertes depuis une parcelle) recouvrait la parcelle qu'on venait de toucher (l'ancien `revealPlot` mesurait la feuille pendant son animation et ne pouvait pas défiler au-delà du monde) | Corrigé (`scene.setOverlay`, `focusPlot` animé, `main.js`) |
| 2026-09-29 | Téléphone : après la fermeture d'une feuille, la scène restait défilée ; sur 360 × 640, des parcelles passaient sous la barre du haut | Corrigé (retour à la vue d'avant) |
| 2026-09-29 | Téléphone : le bandeau « Première année · Niveau 1 » pouvait couvrir la barre du haut (z-index au-dessus d'elle) et la bulle du tutoriel se posait sur lui | Corrigé (sous la barre, effacé par le tutoriel) |
| 2026-09-29 | Niveau 1 en portrait : les 12 parcelles ouvertes (3 × 4) collées en bas à gauche d'un grand champ 4 × 6 de pointillés à peine visibles | Corrigé (bloc 4 × 3 centré, parcelles « à vendre » lisibles) |
| 2026-09-29 | Messages en bas d'écran : ils captaient les touchers (scène et onglets dessous inutilisables pendant 3 s) ; avec une feuille haute, ils montaient sur la barre du haut | Corrigé (`pointer-events`, placement) |
| 2026-09-29 | PWA : une version publiée cassée restait servie par le service worker (index.html en cache d'abord, mise à jour seulement depuis la page) : joueur bloqué | Corrigé (garde-fou de démarrage, bouton « Réparer le jeu ») |
| 2026-09-29 | Police illisible sur téléphone : avec Pixelify Sans, « C » se lisait « O » (« Oarotte », « O'est parti »), « B » se lisait « G » (« Glé », « Gienvenue », « Gilan »), « Z » se lisait « 2 », « D » ≈ « O », « I » = « l » | Corrigé (police « Jersey Ferme », `build-ferme-font.py`) |
