# Crédits

« Une année à la ferme » n'utilise que des ressources sous licence libre compatible avec un dépôt public.
Chaque fichier de `assets/` est listé ci-dessous avec son auteur, sa source et sa licence.

## Attribution obligatoire (CC BY 4.0)

> Musique : « Spring Farm », « Summer Farm », « Fall Farm », « Winter Farm », « Town Theme », « Night Time », « Festival Music » par Sirental (https://sirental.itch.io/farming-game-music), licence CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

Ce texte doit apparaître dans l'écran des crédits du jeu.
Modifications apportées : fichiers renommés ; les versions mp3 de secours ont été réencodées à partir des fichiers WAV originaux (pour que leur durée corresponde exactement à la boucle), les versions ogg sont celles d'origine.

| Fichier(s) | Morceau original |
|---|---|
| `assets/audio/music/spring.ogg` / `.mp3` | Spring Farm |
| `assets/audio/music/summer.ogg` / `.mp3` | Summer Farm |
| `assets/audio/music/autumn.ogg` / `.mp3` | Fall Farm |
| `assets/audio/music/winter.ogg` / `.mp3` | Winter Farm |
| `assets/audio/music/menu.ogg` / `.mp3` | Town Theme |
| `assets/audio/music/night.ogg` / `.mp3` | Night Time |
| `assets/audio/music/festival-intro.ogg` / `.mp3` | Festival Music (Festival_Intro) |
| `assets/audio/music/festival-loop.ogg` / `.mp3` | Festival Music (Festival_Loop) |
| `assets/audio/music/festival.ogg` / `.mp3` | Festival Music (Festival_Complete) |

## Police (SIL Open Font License 1.1)

- **Jersey 15** — Sarah Cadigan-Fried, © 2023 The Soft Type Project Authors.
  Source : https://github.com/scfried/soft-type-jersey (via Google Fonts, https://fonts.google.com/specimen/Jersey+15).
  Licence : SIL OFL 1.1 (pas de nom réservé), texte complet dans `assets/fonts/OFL-Jersey15.txt`.
  Fichier : `assets/fonts/Jersey15-Regular.ttf` (original, source de la version modifiée).
- **Jersey Ferme** — version modifiée de Jersey 15, sous la même licence SIL OFL 1.1 (`assets/fonts/OFL-Jersey15.txt`). **C'est la police du jeu** (`css/fonts.css`, nom CSS « Ferme », utilisé par `style.css` et le canevas).
  Fichiers : `assets/fonts/JerseyFerme-Regular.woff2` (graisses 400–549) et `JerseyFerme-Bold.woff2` (550–900), générés par `assets/fonts/build-ferme-font.py`.
  Modifications : « I » majuscule avec empattements (il était identique à « l ») et I accentués ; flèches → ← ↑ ↓ ↔, ✕, ★, ≥, ≤, ±, ✓, ✗, ½ et espaces fines ajoutés dans le même style ; lettres agrandies (cadratin 1350 → 1170 unités) ; hinting retiré ; graisse grasse créée en épaississant chaque glyphe d'un pixel.
  Pourquoi : avec Pixelify Sans, plusieurs majuscules se confondaient sur téléphone (« C » lu « O », « B » lu « G » ou « 8 », « Z » lu « 2 », « D » lu « O »).
- **Atkinson Hyperlegible** — Braille Institute of America, © 2020 (police conçue pour les personnes malvoyantes).
  Source : https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegible (Google Fonts, https://fonts.google.com/specimen/Atkinson+Hyperlegible ; https://www.brailleinstitute.org/freefont/).
  Licence : SIL OFL 1.1, texte complet dans `assets/fonts/OFL-AtkinsonHyperlegible.txt`.
  Fichiers : `assets/fonts/AtkinsonHyperlegible-Regular.woff2` et `AtkinsonHyperlegible-Bold.woff2` (conversion WOFF2 des TTF d'origine, glyphes inchangés). Police « très lisible » proposée dans Options › Accessibilité (nom CSS « Lisible », déclarée dans `css/style.css`).

## Graphismes — Kenney (CC0, domaine public)

Aucune attribution n'est exigée ; nous remercions Kenney (https://www.kenney.nl) par courtoisie.
Licences d'origine : `assets/sprites/LICENSE-kenney.txt`.

| Fichier(s) | Pack | Source |
|---|---|---|
| `assets/sprites/tiny-farm.png` | Tiny Farm 1.0 (planche `tilemap_packed.png`) | https://kenney.nl/assets/tiny-farm |
| `assets/sprites/tiny-town.png` | Tiny Town 1.1 (planche `tilemap_packed.png`) | https://kenney.nl/assets/tiny-town |
| `assets/sprites/ui/*.png` | UI Pack – Pixel Adventure 2.0 (tuiles « Thick outline », certaines assemblées par 3) | https://kenney.nl/assets/ui-pack-pixel-adventure |
| `assets/sprites/extra.png` | Tuiles dérivées de Tiny Farm (recoloriées / assemblées) et quelques tuiles dessinées pour le jeu dans le même style (panneau solaire, arroseur, graines semées), générées par `assets/sprites/generate-extra.py` ; placées elles aussi sous CC0 | — |
| `assets/sprites/v3.png` | Contenu « v3 », généré par `assets/sprites/generate-v3.py` : dessiné pour le jeu dans la palette et le style Kenney (contour sombre de 2 px) — citrouille, pomme de terre, fraise, courgette (étapes, récoltes, fanés), pommier (saisons), chèvre, produits (confiture, fromage, farine, pain, jus, lait de chèvre), moulin et ses ailes, fournil, décorations (chemin de pierres, massifs, banc, lampadaire, épouvantail, brouette, mare, nichoir, nain, haie, muret, panneau, boîte aux lettres), icônes de succès et d'atouts ; et tuiles Kenney recoloriées ou assemblées (sachets, sacs et cagettes, clôture blanche, murs chaulés et bas de toit de la fromagerie, arrosoir doré, écu d'argent, tenues du fermier, bouteille de lait). Placées sous CC0 | — |
| `assets/sprites/career.png` | Contenu du mode Carrière, généré par `assets/sprites/generate-career.py` : dessiné pour le jeu dans la palette et le style Kenney (contour sombre de 2 px) — cochon, lapins angora, cheval, canard, corbeau, chat, chien ; abris à niveaux (poulailler, bergerie, chèvrerie, étable, porcherie, clapier, écurie), maison (5 niveaux, manoir à tour et fanion), grenier et silos, chambre d'hôte agrandie, boutique et marché fermier, serre, conserverie, filature, château d'eau, convoyeur, embellissements ; machines (tracteur, remorque, semoir, moissonneuse, cueilleuse, collecteur) ; employés et employées (tenues, cheveux, peaux, poses), fermière, Joseph et villageois, portraits, outils tenus ; friche, pancartes, pavés et mare (autotuiles dérivées du chemin de Tiny Town), cerisier et poirier (recoloriés du pommier v3), produits, bulle, décor de fêtes, icônes d'interface et de succès ; et tuiles Kenney (Tiny Town, Tiny Farm) assemblées ou utilisées comme textures (toits, murs, portes, fenêtres, cagettes). Placées sous CC0 | — |
| `assets/sprites/ui/*-deep.png`, `assets/sprites/ui/button-blue.png` | Versions plus foncées de tuiles du UI Pack – Pixel Adventure (bouton rouge, case bois, bouton ardoise, rubans rouges ; bouton bleu = bouton ardoise recolorié) pour que le texte crème atteigne un contraste de 4,5:1 (accessibilité) ; placées sous CC0 | https://kenney.nl/assets/ui-pack-pixel-adventure |
| `assets/sprites/lot2.png` | Contenu du « lot 2 » (toucher et surprises), généré par `assets/sprites/generate-lot2.py` : dessiné pour le jeu dans la palette et le style Kenney (contour sombre de 2 px) — légumes géants 32 × 32 de chaque culture, pastilles de qualité (étincelle d'argent, étoile d'or), icônes dorées des récoltes (recoloriage des icônes Tiny Farm et v3), étincelles, pièce qui tourne, éclat, note de musique ; fée, renard, hérisson, papillon rare, coffre ancien, rond de champignons, chouette sculptée ; icônes de météos spéciales (style de `ui/icons.png`), étoile filante, voile de brouillard ; vieux puits, statue de lièvre, pot de pièces, bocal de graines, agneau perdu, souche qui brille (souche de `career.png`). Placées sous CC0 | — |
| `assets/sprites/lot3.png` | Contenu du « lot 3 » (variété), généré par `assets/sprites/generate-lot3.py` : dessiné pour le jeu dans la palette et le style Kenney (contour sombre de 2 px, 1 px pour les icônes) — tableau du village et feuilles de commande, charrette du marché tirée par un âne, roulotte du colporteur (fermée / étal ouvert) et Basile (sprite d'après le gabarit des fermiers de `career.png`), cultures rares petits pois, melon et poireau (étapes, icônes, fané, icônes dorées, légumes géants ; sachets, sacs et cagettes d'après les tuiles Tiny Farm), cagette de pommes, portraits 32 × 32 des 12 villageois, de Basile et des 9 visiteurs des années à thème, icônes d'onglets, de cartes, de défis, d'objets et de thèmes (style de `ui/icons.png` ; quelques-unes reprennent des tuiles Tiny Farm, v3 et carrière : poule, botte de foin, trèfle, panier, confiture, œufs, pomme, pain), médailles, stands des fêtes de thème, lanterne de colporteur, girouette au coq, panneau « Vu dans le magazine ». Placées sous CC0 | — |
| `assets/sprites/lot4.png` | Contenu du « lot 4 » (collection et enjeux doux), généré par `assets/sprites/generate-lot4.py` : création originale dessinée pour le jeu dans la palette et le style Kenney (contour sombre, 1 px pour les icônes) — album de la ferme (couverture, onglets de page, case vide, tampons, ruban), pelote de laine et poissons, trouvailles d'hiver, traces dans la neige, 8 oiseaux et mangeoire, fenêtre éclairée, vignette de la veillée, objets cachés et stands des fêtes (œufs, lampions, lanternes, grenouilles, marmite, étal, rubans, paniers, foire aux graines), M. le maire et Lili (gabarit des personnages de `career.png`), porte-lanternes et lanternes des critères, herbes folles, 21 décors de l'album, icônes des succès (médaillon de `career.png`) ; l'onglet « potager » reprend la carotte de Tiny Farm et l'onglet « fait maison » le pot de confiture de `v3.png`. Placées sous CC0 | — |
| `assets/sprites/valley1.png` | Contenu du lot V1 « La boîte en fer » de La Vallée vivante, généré par `assets/sprites/generate-valley1.py` : création originale dessinée pour le jeu dans la palette et le style Kenney (contour sombre, 1 px pour les icônes et les bêtes) — 12 variétés anciennes (icônes, plant et stade mûr recolorés et retouchés d'après les cultures de Tiny Farm et de `v3.png`, citrouille géante d'après `lot2.png`, pommes de Calville), 12 habitants en deux images (le hérisson de `lot2.png` et le rouge-gorge de `lot4.png` retournés), indices, haies champêtres et bandes fleuries des quatre saisons, nichoirs, tas de bois, hôtel à insectes, roseaux, chêne isolé, jachères fleuries, fleurs de lisière, cueillette des haies, boîte en fer, sachet, étiquette, vignettes de la boîte et de la vallée (6 étapes), pictogrammes (traits, aménagements, signes de vie), vols d'oiseaux et papillon, onglets d'album, 3 décors, icônes des succès (médaillon de `career.png`). Placées sous CC0 | — |
| `assets/sprites/valley2.png` | Contenu du lot V2 « Le troc et les croisements » de La Vallée vivante, généré par `assets/sprites/generate-valley2.py` : création originale dessinée pour le jeu dans la palette et le style Kenney (contour sombre, 1 px pour les icônes et les bêtes) — 12 variétés du village et 11 variétés croisées (icônes, plant et stade mûr recolorés et retouchés d'après les cultures de Tiny Farm et de `v3.png`, géants d'après `lot2.png`, pommes Api étoilé), Grainothèque en 5 niveaux et son emplacement, sachets, bocaux, étagère, punaise du troc, 4 habitants en deux images (le merle d'après le rouge-gorge de `lot4.png`), indices, nichoir à chauves-souris, pictogrammes, pollen, 3 vignettes de récits, onglets d'album, 3 décors, icônes des succès (médaillon de `career.png`). Placées sous CC0 | — |
| `assets/sprites/valley3.png`, `assets/sprites/valley3-bg.png` | Contenu du lot V3 « Le ruisseau » de La Vallée vivante, généré par `assets/sprites/generate-valley3.py` : création originale dessinée pour le jeu dans la palette et le style Kenney (contour sombre, 1 px pour les icônes, les bêtes et les objets) — grand fond de la vue de la vallée (192 × 432) en quatre saisons, six lieux dans chacun de leurs états (Ru des Saules, moulin, bois de la Combe, prairie des Coquelicots, étang du moulin, bocage du chemin creux, verger conservatoire), la ferme vue de loin (4 tailles), chantier, poteau, ponton, banc, Hélène (personnage et portrait, gabarit des portraits de `career.png`), 10 habitants en deux images, indices, champignons, poissons, Reinette grise (pommes posées d'après le pommier de `v3.png`), terres sauvages, clairières (d'après la forêt de Tiny Town), pictogrammes, 8 vignettes de récits, vignettes des étapes 6 et 7 (d'après celles de `valley1.png`), onglets d'album, 3 décors, icônes des succès (médaillon de `career.png`). Placées sous CC0 | — |
| `assets/sprites/valley4.png` | Contenu du lot V4 « Les cigognes » de La Vallée vivante, généré par `assets/sprites/generate-valley4.py` : création originale dessinée pour le jeu dans la palette et le style Kenney (contour sombre, 1 px pour les icônes, les bêtes et les objets) — 4 légendes (icônes, pousses sous cloche de verre, cloche vide, bocal), cigognes (debout, en vol, roue, nids, clocher), grue et vol en V, cerf, loriot, castor et barrage, vers luisants et lueurs, indices, tuiles de forêt mêlée et vieillie (raccordées à la forêt de Tiny Town), vignette de l'étape 8 (d'après celle de l'étape 7 de `valley3.png`), Joseph et Hélène assis, boîte en fer au ruban (d'après `valley1.png`), 9 vignettes de récits et d'épilogue (portrait de Joseph et maison de `career.png`, banc de `valley3.png`), 8 cartes postales, couverture et signet du livre, pictogrammes, onglets d'album, 3 décors, icônes des succès (médaillon de `career.png`). Placées sous CC0 | — |
| `assets/sprites/coach.png` | Le doigt de Joseph (accompagnement), généré par `assets/sprites/generate-coach.py` : création originale dessinée pour le jeu dans la palette Kenney — main gantée (toucher, appui long, pincer), petite flèche, et `portrait.joseph.point` (portrait de Joseph de `career.png` qui montre du doigt). Placées sous CC0 | — |
| `assets/sprites/intro.png` | Planche de l'intro « MG studios », générée par `assets/sprites/generate-intro.py` : tuiles extraites telles quelles de `tiny-town.png` et `tiny-farm.png` (Kenney, CC0 : herbe, clôture, arbres, terre, cultures, poule, vache, mouton) et de `valley1.png` (oiseaux, création du jeu, CC0), et **le coq dessiné pour l'intro** (création originale, 4 poses : repos, chant, ailes levées, poitrail gonflé). Le panneau « MG studios », la planchette « studios », le ciel, le soleil et les autres éléments de l'intro sont dessinés par le code (`src/intro/mg-studios.js`), créations originales. Placées sous CC0 | — |
| Sons de la vallée (lot V4) | Synthétisés par le jeu (Web Audio), aucune ressource extérieure | — |
| `assets/sprites/ui/icons.png`, `assets/sprites/ui/favicon.png` | Icônes de l'interface (météo, saisons, vitesses, étoiles…) dessinées pour le jeu dans la palette Kenney, et favicon (carotte de Tiny Farm agrandie), générées par `assets/sprites/ui/generate-icons.py` ; placées sous CC0 | — |
| `assets/icons/*.png` | Icônes de l'application (PWA : 192/512, maskable, monochrome, apple-touch-icon, favicons) : carotte et tournesol de Tiny Farm (contour affiné à 1 pixel), butte d'herbe et soleil dessinés pour le jeu, agrandis au plus proche voisin ; générées par `assets/icons/generate-app-icons.py` ; placées sous CC0 | — |
| `assets/screenshots/*.png` | Captures d'écran du jeu pour le manifeste de l'application ; même licence que le jeu | — |

## Effets sonores — Kenney (CC0, domaine public)

Tous normalisés (crête à −3 dBFS) et convertis en ogg + mp3.

| Fichier `assets/audio/sfx/…` | Pack | Fichier d'origine |
|---|---|---|
| `click` | Interface Sounds | `select_001.ogg` |
| `hover` | Interface Sounds | `tick_002.ogg` |
| `toggle` | Interface Sounds | `toggle_001.ogg` |
| `open` | Interface Sounds | `open_002.ogg` |
| `close` | Interface Sounds | `close_002.ogg` |
| `confirm` | Interface Sounds | `confirmation_001.ogg` |
| `error` | Interface Sounds | `error_008.ogg` |
| `warning` | Interface Sounds | `question_001.ogg` |
| `harvest` | Interface Sounds | `pluck_002.ogg` |
| `page` | RPG Audio | `bookFlip2.ogg` |
| `coin` | RPG Audio | `handleCoins2.ogg` |
| `buy` | RPG Audio | `handleCoins.ogg` |
| `dig` | RPG Audio | `chop.ogg` |
| `plant` | Impact Sounds | `footstep_snow_000.ogg` |
| `build` | Impact Sounds | `impactPlank_medium_000.ogg` |
| `frost` | Impact Sounds | `impactGlass_medium_000.ogg` |
| `rot` | Impact Sounds | `impactSoft_heavy_000.ogg` |
| `season-end` | Music Jingles | `Pizzicato jingles/jingles_PIZZI10.ogg` |
| `unlock` | Music Jingles | `Pizzicato jingles/jingles_PIZZI04.ogg` |
| `frost-jingle` | Music Jingles | `Pizzicato jingles/jingles_PIZZI01.ogg` |
| `bankrupt` | Music Jingles | `Pizzicato jingles/jingles_PIZZI07.ogg` |
| `victory` | Music Jingles | `Steel jingles/jingles_STEEL02.ogg` |

Ces sons Kenney d'interface (`click` à `warning`) ne jouent qu'avec le réglage « Sons de l'interface : Normaux ». Par défaut (« Doux »), l'interface joue des sons synthétisés par le jeu (`src/audio/ui-sounds.js` : « toc » de bois, frottement de papier, notes de marimba), créations originales sans ressource extérieure.

Sources : https://kenney.nl/assets/interface-sounds, https://kenney.nl/assets/rpg-audio, https://kenney.nl/assets/impact-sounds, https://kenney.nl/assets/music-jingles

## Sons d'animaux et ambiances — Freesound (CC0, domaine public)

Aucune attribution n'est exigée ; nous remercions les auteurs par courtoisie.
Extraits découpés, avec fondus, normalisés et convertis en ogg + mp3 ; les ambiances ont été rendues bouclables (fondu enchaîné de la fin sur le début).

| Fichier(s) | Auteur | Source | Traitement |
|---|---|---|---|
| `assets/audio/sfx/chicken` | Breviceps | https://freesound.org/people/Breviceps/sounds/456803/ | extrait de 1,5 s (6,95 → 8,45 s) |
| `assets/audio/sfx/rooster` | BenjaminNelan | https://freesound.org/people/BenjaminNelan/sounds/435506/ | complet (2,2 s), fondu de fin |
| `assets/audio/sfx/bees`, `assets/audio/ambience/bees` | DataJuggler | https://freesound.org/people/DataJuggler/sounds/750120/ | extrait de 3 s ; boucle de 30 s |
| `assets/audio/ambience/birds` | Psykophobia | https://freesound.org/people/Psykophobia/sounds/641561/ | boucle de 120 s |
| `assets/audio/sfx/cow` | JosephSardin | https://freesound.org/people/JosephSardin/sounds/177253/ | un meuglement de 2,45 s (5,65 → 8,1 s) |
| `assets/audio/sfx/sheep` | zachrau | https://freesound.org/people/zachrau/sounds/362283/ | un bêlement de 1,8 s (4,35 → 6,15 s) |
| `assets/audio/ambience/rain` | jmbphilmes | https://freesound.org/people/jmbphilmes/sounds/200273/ | boucle de 60 s, niveau relevé |
| `assets/audio/sfx/water` | derjuli | https://freesound.org/people/derjuli/sounds/467227/ | extrait de 1,9 s (18,4 → 20,3 s) |
| `assets/audio/ambience/wind` | magnuswaker | https://freesound.org/people/magnuswaker/sounds/555062/ | boucle de 6,8 s |
| `assets/audio/intro/ailes.mp3` (intro « MG studios ») | _stubb | « Wing Flap 1.wav », https://freesound.org/people/_stubb/sounds/389634/ (CC0 1.0, licence vérifiée le 2026-10-04) | extrait de 0,46 s (0,08 → 0,54 s de l'aperçu HQ, deux battements), passe-haut 150 Hz, fondus, normalisé à −3 dBFS, mp3 96 kb/s |
| `assets/audio/intro/coq.mp3`, `vache.mp3`, `mouton.mp3`, `poule.mp3` (intro « MG studios ») | BenjaminNelan, JosephSardin, zachrau, Breviceps | mêmes enregistrements que `sfx/rooster`, `sfx/cow`, `sfx/sheep`, `sfx/chicken` (pages ci-dessus) | découpes propres à l'intro, dans l'aperçu HQ : coq 0,155 → 1,90 s (cocorico complet), vache 1,18 → 2,36 s, mouton 9,09 → 9,90 s, poule 0,68 → 1,76 s (« cot · cot · codêêt », porte de bruit légère) ; retrait du continu, passe-haut doux (60 à 200 Hz), fondus d'entrée (4 à 40 ms) et de sortie (50 à 70 ms), crête à −3 dBFS, mp3 mono 96 kb/s |

Licence CC0 : https://creativecommons.org/publicdomain/zero/1.0/
