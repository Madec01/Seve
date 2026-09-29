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
- **Jersey Ferme** — version modifiée de Jersey 15, sous la même licence SIL OFL 1.1 (`assets/fonts/OFL-Jersey15.txt`). **C'est la police du jeu** (`css/fonts.css`, nom CSS conservé : « Pixelify Sans », utilisé par `style.css` et le canevas).
  Fichiers : `assets/fonts/JerseyFerme-Regular.woff2` (graisses 400–549) et `JerseyFerme-Bold.woff2` (550–900), générés par `assets/fonts/build-ferme-font.py`.
  Modifications : « I » majuscule avec empattements (il était identique à « l ») et I accentués ; flèches → ← ↑ ↓ ↔, ✕, ★, ≥, ≤, ± et espaces fines ajoutés dans le même style ; lettres agrandies (cadratin 1350 → 1170 unités) ; hinting retiré ; graisse grasse créée en épaississant chaque glyphe d'un pixel.
  Pourquoi : avec Pixelify Sans, plusieurs majuscules se confondaient sur téléphone (« C » lu « O », « B » lu « G » ou « 8 », « Z » lu « 2 », « D » lu « O »).
- **Pixelify Sans** — Stefie Justprince, © 2021 The Pixelify Sans Project Authors, SIL OFL 1.1 (`assets/fonts/OFL.txt`), https://github.com/eifetx/Pixelify-Sans.
  **Plus utilisée par le jeu** depuis le passage à Jersey Ferme (voir ci-dessus). Fichiers encore présents en attendant leur retrait : `assets/fonts/PixelifySans-Variable.ttf` / `.woff2`, `PixelifySansFerme-Regular/-Medium/-SemiBold/-Bold.woff2` (version modifiée : chiffres 2, 5, 7 redessinés, ligatures retirées) et `build-pixelify-ferme.py`.

## Graphismes — Kenney (CC0, domaine public)

Aucune attribution n'est exigée ; nous remercions Kenney (https://www.kenney.nl) par courtoisie.
Licences d'origine : `assets/sprites/LICENSE-kenney.txt`.

| Fichier(s) | Pack | Source |
|---|---|---|
| `assets/sprites/tiny-farm.png` | Tiny Farm 1.0 (planche `tilemap_packed.png`) | https://kenney.nl/assets/tiny-farm |
| `assets/sprites/tiny-town.png` | Tiny Town 1.1 (planche `tilemap_packed.png`) | https://kenney.nl/assets/tiny-town |
| `assets/sprites/ui/*.png` | UI Pack – Pixel Adventure 2.0 (tuiles « Thick outline », certaines assemblées par 3) | https://kenney.nl/assets/ui-pack-pixel-adventure |
| `assets/sprites/extra.png` | Tuiles dérivées de Tiny Farm (recoloriées / assemblées) et quelques tuiles dessinées pour le jeu dans le même style (panneau solaire, arroseur, graines semées), générées par `assets/sprites/generate-extra.py` ; placées elles aussi sous CC0 | — |
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
