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

Licence CC0 : https://creativecommons.org/publicdomain/zero/1.0/
